import {
  addDoc, collection, deleteDoc, doc, getDocs, limit, orderBy, query, serverTimestamp, setDoc
} from 'firebase/firestore';

export const AUDIT_ACTIONS = new Set(['USER_ACCESS_UPDATE', 'FLAGS_UPDATE', 'CATALOG_UPSERT', 'CATALOG_DELETE']);
export const AUDIT_TARGET_TYPES = new Set(['user', 'config', 'catalog']);
export const CATALOG_KINDS = new Set(['cargo', 'beam', 'sling', 'hardware']);
export const CATALOG_TIERS = new Set(['free', 'premium']);

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

export function buildAuditLogEntry({ actorUid, action, targetType, targetId, summary = '' } = {}) {
  if (!actorUid || typeof actorUid !== 'string') throw new Error('Actor UID is required for audit logs.');
  if (!AUDIT_ACTIONS.has(action)) throw new Error(`Unsupported audit action: ${action}`);
  if (!AUDIT_TARGET_TYPES.has(targetType)) throw new Error(`Unsupported audit target type: ${targetType}`);
  const cleanTargetId = String(targetId ?? '').trim().slice(0, 128);
  if (!cleanTargetId) throw new Error('Target ID is required for audit logs.');
  return {
    actorUid,
    action,
    targetType,
    targetId: cleanTargetId,
    summary: String(summary ?? '').trim().slice(0, 240)
  };
}

export async function appendAuditLog(db, entry) {
  if (!db) return null;
  const payload = buildAuditLogEntry(entry);
  return addDoc(collection(db, 'adminAuditLogs'), {
    ...payload,
    createdAt: serverTimestamp()
  });
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

export async function saveCatalogItem(db, actorUid, input) {
  const item = normalizeCatalogItem(input, actorUid);
  await setDoc(doc(db, 'catalog', item.id), {
    ...item,
    updatedAt: serverTimestamp()
  });
  await appendAuditLog(db, {
    actorUid,
    action: 'CATALOG_UPSERT',
    targetType: 'catalog',
    targetId: item.id,
    summary: `${item.kind}:${item.title} (${item.tier})`
  }).catch(() => {});
  return item;
}

export async function deleteCatalogItem(db, actorUid, itemId) {
  const cleanId = String(itemId ?? '').trim().toLowerCase();
  if (!/^[a-z0-9_-]{2,64}$/.test(cleanId)) throw new Error('Invalid catalog ID.');
  await deleteDoc(doc(db, 'catalog', cleanId));
  await appendAuditLog(db, {
    actorUid,
    action: 'CATALOG_DELETE',
    targetType: 'catalog',
    targetId: cleanId,
    summary: `Deleted catalog entry ${cleanId}`
  }).catch(() => {});
}
