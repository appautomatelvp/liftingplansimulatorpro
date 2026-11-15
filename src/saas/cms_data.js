import {
  addDoc, collection, doc, getDocs, limit, orderBy, query, serverTimestamp, writeBatch
} from 'firebase/firestore';
import { normalizeFeatureFlags } from './telemetry_usage.js';

export const AUDIT_ACTIONS = new Set(['USER_ACCESS_UPDATE', 'FLAGS_UPDATE', 'CATALOG_UPSERT', 'CATALOG_DELETE']);
export const AUDIT_TARGET_TYPES = new Set(['user', 'config', 'catalog']);
export const CATALOG_KINDS = new Set(['cargo', 'beam', 'sling', 'hardware']);
export const CATALOG_TIERS = new Set(['free', 'premium']);

const SENSITIVE_KEY_RE = /token|secret|password|apikey|cookie|credential/i;

export function canAccessCms(profile) {
  return profile?.status === 'active' && ['admin', 'support', 'catalog-editor'].includes(profile?.role);
}

export function canReadUsersAndAudit(profile) {
  return profile?.status === 'active' && ['admin', 'support'].includes(profile?.role);
}

export function canEditUsersAndFlags(profile) {
  return profile?.status === 'active' && profile?.role === 'admin';
}

export function canManageCatalog(profile) {
  return profile?.status === 'active' && ['admin', 'catalog-editor'].includes(profile?.role);
}

export function serializeAuditState(value) {
  if (value == null) return '';
  if (typeof value === 'string') return value.trim().slice(0, 400);
  try {
    const serialized = JSON.stringify(value, (key, inner) => {
      if (key && SENSITIVE_KEY_RE.test(key)) return undefined;
      return inner;
    });
    if (!serialized) return '';
    return serialized.length <= 400 ? serialized : `${serialized.slice(0, 397)}...`;
  } catch {
    return '';
  }
}

export function buildAuditLogEntry({
  actorUid,
  action,
  targetType,
  targetId,
  summary = '',
  reason = '',
  before = null,
  after = null
} = {}) {
  if (!actorUid || typeof actorUid !== 'string') throw new Error('Actor UID is required for audit logs.');
  if (!AUDIT_ACTIONS.has(action)) throw new Error(`Unsupported audit action: ${action}`);
  if (!AUDIT_TARGET_TYPES.has(targetType)) throw new Error(`Unsupported audit target type: ${targetType}`);
  const cleanTargetId = String(targetId ?? '').trim().slice(0, 128);
  if (!cleanTargetId) throw new Error('Target ID is required for audit logs.');
  const cleanReason = String(reason ?? '').trim().slice(0, 200);
  if (action === 'USER_ACCESS_UPDATE' && !cleanReason) {
    throw new Error('Reason is required for user access updates.');
  }
  const entry = {
    actorUid,
    action,
    targetType,
    targetId: cleanTargetId,
    summary: String(summary ?? '').trim().slice(0, 240)
  };
  if (cleanReason) entry.reason = cleanReason;
  const beforeStr = serializeAuditState(before);
  const afterStr = serializeAuditState(after);
  if (beforeStr) entry.before = beforeStr;
  if (afterStr) entry.after = afterStr;
  return entry;
}

export async function appendAuditLog(db, entry) {
  if (!db) return null;
  const payload = buildAuditLogEntry(entry);
  return addDoc(collection(db, 'adminAuditLogs'), {
    ...payload,
    createdAt: serverTimestamp()
  });
}

export async function commitWithAudit(db, applyWrites, auditEntry, deps = {}) {
  if (!db) throw new Error('Firestore instance is required for atomic CMS commit.');
  const payload = buildAuditLogEntry(auditEntry);
  const batch = (deps.createBatch || writeBatch)(db);
  await applyWrites(batch);
  const logRef = (deps.createLogRef || ((database) => doc(collection(database, 'adminAuditLogs'))))(db);
  batch.set(logRef, {
    ...payload,
    createdAt: (deps.timestamp || serverTimestamp)()
  });
  await batch.commit();
  return payload;
}

export async function listAuditLogs(db, pageLimit = 20) {
  if (!db) return [];
  const boundedLimit = Math.min(25, Math.max(1, Math.trunc(Number(pageLimit) || 20)));
  const snap = await getDocs(query(collection(db, 'adminAuditLogs'), orderBy('createdAt', 'desc'), limit(boundedLimit)));
  return snap.docs.map((entry) => ({ id: entry.id, ...entry.data() }));
}

function optionalFiniteNumber(value, label, min = 0, max = 10_000_000) {
  if (value === '' || value == null) return null;
  const num = Number(value);
  if (!Number.isFinite(num) || num < min || num > max) throw new Error(`${label} must be between ${min} and ${max}.`);
  return num;
}

export function normalizeCatalogItem(input = {}, actorUid = '') {
  const id = String(input.id ?? '').trim().toLowerCase();
  if (!/^[a-z0-9_-]{2,64}$/.test(id)) {
    throw new Error('Catalog ID must be 2–64 lowercase letters, digits, "_" or "-".');
  }
  if (!actorUid) throw new Error('Editor UID is required.');
  const kind = CATALOG_KINDS.has(input.kind) ? input.kind : 'hardware';
  const title = String(input.title ?? '').trim().slice(0, 100);
  if (!title) throw new Error('Catalog title is required.');
  const tier = CATALOG_TIERS.has(input.tier) ? input.tier : 'free';
  return {
    id,
    kind,
    title,
    category: String(input.category ?? '').trim().slice(0, 60),
    wllT: optionalFiniteNumber(input.wllT, 'WLL (t)', 0, 100_000),
    massKg: optionalFiniteNumber(input.massKg, 'Mass (kg)', 0, 10_000_000),
    tier,
    enabled: Boolean(input.enabled ?? true),
    notes: String(input.notes ?? '').trim().slice(0, 300),
    updatedBy: actorUid
  };
}

export async function listCatalogItems(db, pageLimit = 30) {
  if (!db) return [];
  const boundedLimit = Math.min(50, Math.max(1, Math.trunc(Number(pageLimit) || 30)));
  const snap = await getDocs(query(collection(db, 'catalog'), orderBy('updatedAt', 'desc'), limit(boundedLimit)));
  return snap.docs.map((entry) => ({ id: entry.id, ...entry.data() }));
}

export async function setUserAccessWithAudit(db, actorUid, targetUid, update, { reason = '', beforeUser = null } = {}) {
  const allowed = {};
  if (update?.tier === 'free' || update?.tier === 'premium') allowed.tier = update.tier;
  if (update?.status === 'active' || update?.status === 'locked' || update?.status === 'banned') allowed.status = update.status;
  if (!Object.keys(allowed).length) throw new Error('No valid access change was provided.');

  const beforeState = beforeUser
    ? { tier: beforeUser.tier || 'free', status: beforeUser.status || 'active' }
    : null;
  const afterState = {
    tier: allowed.tier ?? beforeUser?.tier ?? null,
    status: allowed.status ?? beforeUser?.status ?? null
  };

  await commitWithAudit(
    db,
    (batch) => {
      batch.update(doc(db, 'users', targetUid), allowed);
    },
    {
      actorUid,
      action: 'USER_ACCESS_UPDATE',
      targetType: 'user',
      targetId: targetUid,
      summary: JSON.stringify(allowed),
      reason,
      before: beforeState,
      after: afterState
    }
  );
}

export async function saveFeatureFlagsWithAudit(db, adminUid, flags, { reason = '', beforeFlags = null } = {}) {
  if (!db || !adminUid) throw new Error('Administrator session is required to update feature flags.');
  const normalized = normalizeFeatureFlags(flags);
  await commitWithAudit(
    db,
    (batch) => {
      batch.set(doc(db, 'config', 'featureFlags'), {
        ...normalized,
        updatedBy: adminUid,
        updatedAt: serverTimestamp()
      });
    },
    {
      actorUid: adminUid,
      action: 'FLAGS_UPDATE',
      targetType: 'config',
      targetId: 'featureFlags',
      summary: `maintenance=${normalized.maintenanceMode}, freeLimit=${normalized.freePlanLimit}`,
      reason,
      before: beforeFlags ? normalizeFeatureFlags(beforeFlags) : null,
      after: normalized
    }
  );
  return normalized;
}

export async function saveCatalogItem(db, actorUid, input, { reason = '', beforeItem = null } = {}) {
  const item = normalizeCatalogItem(input, actorUid);
  await commitWithAudit(
    db,
    (batch) => {
      batch.set(doc(db, 'catalog', item.id), {
        ...item,
        updatedAt: serverTimestamp()
      });
    },
    {
      actorUid,
      action: 'CATALOG_UPSERT',
      targetType: 'catalog',
      targetId: item.id,
      summary: `${item.kind}:${item.title} (${item.tier})`,
      reason,
      before: beforeItem ? { kind: beforeItem.kind, title: beforeItem.title, tier: beforeItem.tier, enabled: beforeItem.enabled, wllT: beforeItem.wllT } : null,
      after: { kind: item.kind, title: item.title, tier: item.tier, enabled: item.enabled, wllT: item.wllT }
    }
  );
  return item;
}

export async function deleteCatalogItem(db, actorUid, itemId, { reason = '', beforeItem = null } = {}) {
  const cleanId = String(itemId ?? '').trim().toLowerCase();
  if (!/^[a-z0-9_-]{2,64}$/.test(cleanId)) throw new Error('Invalid catalog ID.');
  await commitWithAudit(
    db,
    (batch) => {
      batch.delete(doc(db, 'catalog', cleanId));
    },
    {
      actorUid,
      action: 'CATALOG_DELETE',
      targetType: 'catalog',
      targetId: cleanId,
      summary: `Deleted catalog entry ${cleanId}`,
      reason,
      before: beforeItem ? { id: cleanId, kind: beforeItem.kind, title: beforeItem.title, tier: beforeItem.tier } : { id: cleanId },
      after: { deleted: true }
    }
  );
}
