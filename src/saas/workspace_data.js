import {
  collection, doc, getDocs, limit, orderBy, query, runTransaction,
  serverTimestamp, startAfter
} from 'firebase/firestore';
import { readUsageQuota, recordUsageWrite } from './telemetry_usage.js';
import { getTierSlotLimit } from './runtime_flags.js';
import {
  MAX_PLAN_BYTES,
  PLAN_SCHEMA_VERSION,
  SOLVER_VERSION,
  SNAPSHOT_FIELDS,
  cleanText,
  buildEquipmentRecord,
  makePlanSnapshot,
  makeLegacyRigSnapshot,
  parsePlanSnapshot,
  migrateSnapshot
} from './plan_snapshot.js';

export {
  readUsageQuota,
  MAX_PLAN_BYTES,
  PLAN_SCHEMA_VERSION,
  SOLVER_VERSION,
  SNAPSHOT_FIELDS,
  buildEquipmentRecord,
  makePlanSnapshot,
  makeLegacyRigSnapshot,
  parsePlanSnapshot,
  migrateSnapshot
};

export const MAX_PAGE_SIZE = 20;
export const EXPORT_COOLDOWN_MS = 10_000;
export const MAX_EXPORT_PAGES = 15;

export function maximumSlots(profileOrTier, flags = null) {
  const profile = typeof profileOrTier === 'string' ? { tier: profileOrTier } : profileOrTier;
  return getTierSlotLimit(profile, flags);
}

async function createInAvailableSlot(db, uid, profileOrTier, type, value, flags = null) {
  const limitSlots = maximumSlots(profileOrTier, flags);
  const coll = collection(db, 'users', uid, type);
  const snapshot = await getDocs(query(coll, orderBy('updatedAt', 'desc'), limit(limitSlots)));
  const occupied = new Set(snapshot.docs.map((entry) => entry.id));
  const slot = Array.from({ length: limitSlots }, (_, index) => String(index + 1)).find((id) => !occupied.has(id));
  if (!slot) throw new Error(`Storage limit reached (${limitSlots} ${type === 'equipment' ? 'items' : 'plans'}). Archive or delete an item, or change your plan.`);
  const ref = doc(db, 'users', uid, type, slot);
  await runTransaction(db, async (transaction) => {
    if ((await transaction.get(ref)).exists()) throw new Error('A simultaneous save used this slot. Please retry.');
    transaction.set(ref, { ...value, createdAt: serverTimestamp(), updatedAt: serverTimestamp() });
  });
  return slot;
}

export async function createEquipment(db, profile, input, options = {}) {
  const value = buildEquipmentRecord(input, profile.uid);
  const slot = await createInAvailableSlot(db, profile.uid, profile, 'equipment', value, options?.flags || null);
  await recordUsageWrite(db, profile.uid, { equipmentDelta: 1 }).catch(() => {});
  return slot;
}

export async function updateEquipment(db, uid, id, input) {
  const value = buildEquipmentRecord(input, uid);
  const ref = doc(db, 'users', uid, 'equipment', String(id));
  await runTransaction(db, async (transaction) => {
    const current = await transaction.get(ref);
    if (!current.exists() || current.data().ownerUid !== uid) throw new Error('Equipment record was not found.');
    transaction.update(ref, { ...value, createdAt: current.data().createdAt, updatedAt: serverTimestamp() });
  });
}

export async function createLiftPlan(db, profile, { title, description = '', snapshot, archived = false, equipmentIds = [], flags = null }) {
  const serialized = typeof snapshot === 'string' ? snapshot : JSON.stringify(snapshot);
  parsePlanSnapshot(serialized);
  const value = {
    ownerUid: profile.uid, schemaVersion: PLAN_SCHEMA_VERSION,
    title: cleanText(title, 100, 'Title'), description: String(description).trim().slice(0, 500),
    revision: 1, solverVersion: SOLVER_VERSION, archived: Boolean(archived), snapshot: serialized,
    equipmentIds: normalizeEquipmentIds(equipmentIds)
  };
  const slot = await createInAvailableSlot(db, profile.uid, profile, 'liftPlans', value, flags);
  await recordUsageWrite(db, profile.uid, { plansDelta: 1 }).catch(() => {});
  return slot;
}

export async function updateLiftPlan(db, uid, id, patch) {
  const updates = {};
  if (patch.title !== undefined) updates.title = cleanText(patch.title, 100, 'Title');
  if (patch.description !== undefined) updates.description = String(patch.description).trim().slice(0, 500);
  if (patch.archived !== undefined) updates.archived = Boolean(patch.archived);
  if (patch.equipmentIds !== undefined) updates.equipmentIds = normalizeEquipmentIds(patch.equipmentIds);
  if (patch.snapshot !== undefined) { parsePlanSnapshot(patch.snapshot); updates.snapshot = patch.snapshot; }
  const ref = doc(db, 'users', uid, 'liftPlans', String(id));
  await runTransaction(db, async (transaction) => {
    const current = await transaction.get(ref);
    if (!current.exists() || current.data().ownerUid !== uid) throw new Error('Saved plan was not found.');
    transaction.update(ref, { ...updates, revision: (current.data().revision || 0) + 1, updatedAt: serverTimestamp() });
  });
}

function normalizeEquipmentIds(value) {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.map(String).filter((id) => /^[1-9]\d{0,2}$/.test(id) && Number(id) <= 200))].slice(0, 20);
}

export async function deleteWorkspaceItem(db, uid, type, id) {
  const ref = doc(db, 'users', uid, type, String(id));
  await runTransaction(db, async (transaction) => {
    const current = await transaction.get(ref);
    if (!current.exists() || current.data().ownerUid !== uid) throw new Error('Record was not found.');
    transaction.delete(ref);
  });
  await recordUsageWrite(db, uid, type === 'equipment' ? { equipmentDelta: -1 } : { plansDelta: -1 }).catch(() => {});
}

export async function listWorkspacePage(db, uid, type, { cursor = null, pageSize = MAX_PAGE_SIZE, archived = null } = {}) {
  const constraints = [orderBy('updatedAt', 'desc')];
  if (cursor) constraints.push(startAfter(cursor));
  constraints.push(limit(Math.min(Math.max(1, pageSize), MAX_PAGE_SIZE) + 1));
  const snapshot = await getDocs(query(collection(db, 'users', uid, type), ...constraints));
  let docs = snapshot.docs;
  let hasMore = docs.length > MAX_PAGE_SIZE;
  if (hasMore) docs = docs.slice(0, MAX_PAGE_SIZE);
  let items = docs.map((entry) => ({ id: entry.id, ...entry.data() }));
  if (type === 'liftPlans' && archived !== null) items = items.filter((item) => Boolean(item.archived) === archived);
  return { items, cursor: docs.length ? docs[docs.length - 1] : null, hasMore };
}

function serializeTimestamp(value) {
  if (value && typeof value.toDate === 'function') return value.toDate().toISOString();
  return value || null;
}

async function collectAllPages(db, uid, type, fetchPage) {
  const results = [];
  let cursor = null;
  for (let pageIndex = 0; pageIndex < MAX_EXPORT_PAGES; pageIndex++) {
    const page = await fetchPage(db, uid, type, { cursor, pageSize: MAX_PAGE_SIZE });
    results.push(...(page.items || []));
    if (!page.hasMore || !page.cursor || page.cursor === cursor) break;
    cursor = page.cursor;
  }
  return results;
}

export async function exportAllWorkspaceData({
  db,
  profile,
  fetchPage = listWorkspacePage,
  cooldownMs = EXPORT_COOLDOWN_MS,
  lastExportAt = 0,
  now = Date.now()
} = {}) {
  if (!profile?.uid) throw new Error('Account profile is required to export data.');
  const elapsed = now - Number(lastExportAt || 0);
  if (lastExportAt > 0 && elapsed < cooldownMs) {
    const retryAfterSec = Math.max(1, Math.ceil((cooldownMs - elapsed) / 1000));
    const err = new Error(`Export cooldown active (${retryAfterSec}s).`);
    err.code = 'safelift/export-cooldown';
    err.retryAfterSec = retryAfterSec;
    throw err;
  }

  const [rawPlans, rawEquipment] = await Promise.all([
    collectAllPages(db, profile.uid, 'liftPlans', fetchPage),
    collectAllPages(db, profile.uid, 'equipment', fetchPage)
  ]);

  const liftPlans = rawPlans.map((item) => {
    let parsedSnapshot = null;
    let snapshotError = null;
    if (typeof item.snapshot === 'string') {
      try {
        parsedSnapshot = parsePlanSnapshot(item.snapshot);
      } catch (err) {
        snapshotError = err?.message || 'Unable to parse snapshot';
      }
    }
    return {
      id: item.id,
      schemaVersion: item.schemaVersion ?? PLAN_SCHEMA_VERSION,
      title: item.title || '',
      description: item.description || '',
      revision: Number(item.revision) || 1,
      solverVersion: item.solverVersion || '',
      archived: Boolean(item.archived),
      equipmentIds: Array.isArray(item.equipmentIds) ? item.equipmentIds : [],
      createdAt: serializeTimestamp(item.createdAt),
      updatedAt: serializeTimestamp(item.updatedAt),
      snapshot: parsedSnapshot,
      ...(snapshotError ? { snapshotError } : {})
    };
  });

  const equipment = rawEquipment.map((item) => ({
    id: item.id,
    schemaVersion: item.schemaVersion ?? 1,
    name: item.name || '',
    category: item.category || 'other',
    manufacturer: item.manufacturer || '',
    model: item.model || '',
    wllT: item.wllT ?? null,
    lengthM: item.lengthM ?? null,
    massKg: item.massKg ?? null,
    safetyFactor: item.safetyFactor ?? null,
    certificateNo: item.certificateNo || '',
    inspectionExpiry: item.inspectionExpiry || '',
    notes: item.notes || '',
    createdAt: serializeTimestamp(item.createdAt),
    updatedAt: serializeTimestamp(item.updatedAt)
  }));

  return {
    schemaVersion: 1,
    exportedAt: new Date(now).toISOString(),
    account: {
      uid: profile.uid,
      email: profile.email || '',
      displayName: profile.displayName || '',
      role: profile.role || 'user',
      tier: profile.tier || 'free'
    },
    liftPlans,
    equipment
  };
}
