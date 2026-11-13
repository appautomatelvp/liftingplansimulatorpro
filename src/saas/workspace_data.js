import {
  collection, doc, getDocs, limit, orderBy, query, runTransaction,
  serverTimestamp, startAfter
} from 'firebase/firestore';

export const MAX_PAGE_SIZE = 20;
export const MAX_PLAN_BYTES = 48_000;
export const PLAN_SCHEMA_VERSION = 1;
export const SOLVER_VERSION = '5.0';
export const EXPORT_COOLDOWN_MS = 10_000;
export const MAX_EXPORT_PAGES = 15;

const EQUIPMENT_CATEGORIES = new Set(['hook', 'sling', 'chain', 'shackle', 'spreader', 'lifting_beam', 'crane', 'other']);
const SNAPSHOT_FIELDS = [
  'cargoType', 'L', 'W', 'H', 'weight', 'oogHasCargo', 'oogTarp', 'oogOh', 'oogOwL', 'oogOwR', 'oogOlF', 'oogOlR',
  'oogCargoOffsetX', 'oogCargoOffsetZ', 'oogCargoL', 'oogCargoW', 'oogCargoH', 'isoCode', 'tareT', 'maxPayloadT', 'maxGrossT',
  'cogX', 'cogY', 'cogZ', 'craneType', 'hookCount', 'planLugCount', 'stsSizeFt', 'stsTwinLift', 'stsAttachMode', 'stsSizeLinked',
  'beamType', 'slingType', 'slingUserSet', 'weightUserSet', 'hwType', 'slingLength', 'upperSlingLength', 'lowerSlingLength',
  'hangerSlingLength', 'wllPerLeg', 'gear', 'rigFit', 'unitSystem', 'windSpeedMps', 'windAreaM2', 'windLimitMps', 'slewDeg'
];
const NUMERIC_INPUTS = new Set([
  'L', 'W', 'H', 'weight', 'oogOh', 'oogOwL', 'oogOwR', 'oogOlF', 'oogOlR', 'oogCargoOffsetX', 'oogCargoOffsetZ',
  'oogCargoL', 'oogCargoW', 'oogCargoH', 'tareT', 'maxPayloadT', 'maxGrossT', 'cogX', 'cogY', 'cogZ', 'hookCount',
  'planLugCount', 'stsSizeFt', 'slingLength', 'upperSlingLength', 'lowerSlingLength', 'hangerSlingLength', 'wllPerLeg',
  'windSpeedMps', 'windAreaM2', 'windLimitMps', 'slewDeg'
]);
const BOOLEAN_INPUTS = new Set(['oogHasCargo', 'oogTarp', 'stsTwinLift', 'stsSizeLinked', 'slingUserSet', 'weightUserSet']);
const STRING_INPUTS = new Set(['cargoType', 'isoCode', 'craneType', 'stsAttachMode', 'beamType', 'slingType', 'hwType', 'rigFit', 'unitSystem']);

function cleanText(value, max, field) {
  const text = String(value ?? '').trim();
  if (!text || text.length > max) throw new Error(`${field} is required and must be under ${max} characters.`);
  return text;
}

function finiteOrNull(value, field, min = 0, max = 1_000_000) {
  if (value === '' || value == null) return null;
  const number = Number(value);
  if (!Number.isFinite(number) || number < min || number > max) throw new Error(`${field} is outside the allowed range.`);
  return number;
}

function safeJson(value) {
  return JSON.parse(JSON.stringify(value, (_key, item) => {
    if (typeof item === 'number' && !Number.isFinite(item)) return null;
    if (typeof item === 'function' || typeof item === 'undefined') return undefined;
    return item;
  }));
}

export function buildEquipmentRecord(input, uid) {
  const category = EQUIPMENT_CATEGORIES.has(input.category) ? input.category : 'other';
  return {
    ownerUid: uid, schemaVersion: 1,
    name: cleanText(input.name, 80, 'Name'), category,
    manufacturer: String(input.manufacturer ?? '').trim().slice(0, 80),
    model: String(input.model ?? '').trim().slice(0, 80),
    wllT: finiteOrNull(input.wllT, 'WLL', 0, 100_000),
    lengthM: finiteOrNull(input.lengthM, 'Length', 0, 10_000),
    massKg: finiteOrNull(input.massKg, 'Mass', 0, 10_000_000),
    safetyFactor: finiteOrNull(input.safetyFactor, 'Safety factor', 0, 1_000),
    certificateNo: String(input.certificateNo ?? '').trim().slice(0, 100),
    inspectionExpiry: String(input.inspectionExpiry ?? '').trim().slice(0, 10),
    notes: String(input.notes ?? '').trim().slice(0, 500)
  };
}

export function makePlanSnapshot(state, analysis = null) {
  const inputs = {};
  for (const key of SNAPSHOT_FIELDS) {
    if (Object.hasOwn(state || {}, key)) inputs[key] = safeJson(state[key]);
  }
  if (Array.isArray(state?.lugs)) inputs.lugs = state.lugs.slice(0, 8).map((lug) => ({ x: Number(lug.x) || 0, y: Number(lug.y) || 0, z: Number(lug.z) || 0 }));
  const snapshot = {
    schemaVersion: PLAN_SCHEMA_VERSION,
    solverVersion: SOLVER_VERSION,
    savedAt: new Date().toISOString(),
    inputs,
    analysis: analysis ? safeJson(analysis) : null
  };
  const serialized = JSON.stringify(snapshot);
  if (new TextEncoder().encode(serialized).length > MAX_PLAN_BYTES) throw new Error('Plan data exceeds the 48 KB limit. Remove excess custom rigging metadata.');
  return serialized;
}

export function makeLegacyRigSnapshot(state, legacyRig) {
  if (!legacyRig || typeof legacyRig !== 'object' || Array.isArray(legacyRig)) throw new Error('This saved rig is invalid.');
  if (!legacyRig.members || typeof legacyRig.members !== 'object' || Array.isArray(legacyRig.members)) throw new Error('This saved rig has invalid equipment settings.');
  if (!Array.isArray(legacyRig.extraCables) || legacyRig.extraCables.length > 8) throw new Error('This saved rig has an invalid number of additional cables.');
  const inputs = {
    ...(state || {}),
    beamType: typeof legacyRig.beamType === 'string' ? legacyRig.beamType : state?.beamType,
    slingType: typeof legacyRig.slingType === 'string' ? legacyRig.slingType : state?.slingType,
    hwType: typeof legacyRig.hwType === 'string' ? legacyRig.hwType : state?.hwType,
    slingLength: legacyRig.slingLength ?? state?.slingLength,
    rigFit: legacyRig.rigFit === 'auto' ? 'auto' : 'fixed',
    gear: {
      ...(state?.gear || {}),
      members: safeJson(legacyRig.members),
      extraCables: safeJson(legacyRig.extraCables)
    }
  };
  return makePlanSnapshot(inputs);
}

export function parsePlanSnapshot(serialized) {
  if (typeof serialized !== 'string' || new TextEncoder().encode(serialized).length > MAX_PLAN_BYTES) throw new Error('This saved plan is invalid or exceeds the allowed size.');
  const parsed = JSON.parse(serialized);
  if (parsed.schemaVersion !== PLAN_SCHEMA_VERSION || !parsed.inputs || typeof parsed.inputs !== 'object') throw new Error('This plan uses an unsupported schema version.');
  const inputs = {};
  const allowedKeys = new Set([...SNAPSHOT_FIELDS, 'lugs']);
  for (const [key, value] of Object.entries(parsed.inputs)) {
    if (!allowedKeys.has(key)) throw new Error('This saved plan contains unsupported simulation fields.');
    if (NUMERIC_INPUTS.has(key) && value != null && (typeof value !== 'number' || !Number.isFinite(value))) throw new Error(`Invalid numeric value in ${key}.`);
    if (BOOLEAN_INPUTS.has(key) && typeof value !== 'boolean') throw new Error(`Invalid setting in ${key}.`);
    if (STRING_INPUTS.has(key) && (typeof value !== 'string' || value.length > 100)) throw new Error(`Invalid setting in ${key}.`);
    if (key === 'gear' && (!value || typeof value !== 'object' || Array.isArray(value))) throw new Error('Invalid rigging gear data.');
    if (key === 'lugs' && (!Array.isArray(value) || value.length > 8 || value.some((lug) => !lug || !['x', 'y', 'z'].every((axis) => Number.isFinite(lug[axis]))))) throw new Error('Invalid lift point data.');
    inputs[key] = safeJson(value);
  }
  const analysis = parsed.analysis && typeof parsed.analysis === 'object' ? safeJson(parsed.analysis) : null;
  return { schemaVersion: parsed.schemaVersion, solverVersion: String(parsed.solverVersion || ''), savedAt: String(parsed.savedAt || ''), inputs, analysis };
}

export function migrateSnapshot(snapshot, fromVersion = snapshot?.solverVersion) {
  if (!snapshot || typeof snapshot !== 'object' || Array.isArray(snapshot)) {
    throw new Error('Cannot migrate an invalid plan snapshot.');
  }
  const sourceVersion = String(fromVersion ?? snapshot.solverVersion ?? '').trim();
  const baseInputs = snapshot.inputs && typeof snapshot.inputs === 'object' ? safeJson(snapshot.inputs) : {};
  const analysis = snapshot.analysis && typeof snapshot.analysis === 'object' ? safeJson(snapshot.analysis) : null;
  const base = {
    schemaVersion: snapshot.schemaVersion || PLAN_SCHEMA_VERSION,
    solverVersion: sourceVersion || SOLVER_VERSION,
    savedAt: String(snapshot.savedAt || ''),
    inputs: baseInputs,
    analysis
  };

  if (sourceVersion === SOLVER_VERSION) {
    return {
      snapshot: base,
      fromVersion: sourceVersion,
      toVersion: SOLVER_VERSION,
      migrated: false,
      compatible: true,
      warnings: []
    };
  }

  const isKnownLegacy = sourceVersion === '' || sourceVersion === 'legacy' || /^4\.\d+$/.test(sourceVersion);
  if (isKnownLegacy) {
    const migratedInputs = { ...baseInputs };
    if (migratedInputs.unitSystem === undefined) migratedInputs.unitSystem = 'metric';
    if (migratedInputs.rigFit === undefined) migratedInputs.rigFit = 'fixed';
    if (migratedInputs.windSpeedMps === undefined) migratedInputs.windSpeedMps = 0;
    if (migratedInputs.windLimitMps === undefined) migratedInputs.windLimitMps = 15;
    if (migratedInputs.slewDeg === undefined) migratedInputs.slewDeg = 0;
    return {
      snapshot: { ...base, solverVersion: SOLVER_VERSION, inputs: migratedInputs },
      fromVersion: sourceVersion || 'legacy',
      toVersion: SOLVER_VERSION,
      migrated: true,
      compatible: true,
      warnings: ['LEGACY_SOLVER_MIGRATED']
    };
  }

  return {
    snapshot: base,
    fromVersion: sourceVersion,
    toVersion: SOLVER_VERSION,
    migrated: false,
    compatible: false,
    warnings: ['UNKNOWN_SOLVER_VERSION']
  };
}

function maximumSlots(tier) { return tier === 'premium' || tier === 'admin' ? 200 : 20; }

async function createInAvailableSlot(db, uid, tier, type, value) {
  const coll = collection(db, 'users', uid, type);
  const snapshot = await getDocs(query(coll, orderBy('updatedAt', 'desc'), limit(maximumSlots(tier))));
  const occupied = new Set(snapshot.docs.map((entry) => entry.id));
  const slot = Array.from({ length: maximumSlots(tier) }, (_, index) => String(index + 1)).find((id) => !occupied.has(id));
  if (!slot) throw new Error(`Storage limit reached (${maximumSlots(tier)} ${type === 'equipment' ? 'items' : 'plans'}). Archive or delete an item, or change your plan.`);
  const ref = doc(db, 'users', uid, type, slot);
  await runTransaction(db, async (transaction) => {
    if ((await transaction.get(ref)).exists()) throw new Error('A simultaneous save used this slot. Please retry.');
    transaction.set(ref, { ...value, createdAt: serverTimestamp(), updatedAt: serverTimestamp() });
  });
  return slot;
}

export async function createEquipment(db, profile, input) {
  const value = buildEquipmentRecord(input, profile.uid);
  return createInAvailableSlot(db, profile.uid, profile.tier, 'equipment', value);
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

export async function createLiftPlan(db, profile, { title, description = '', snapshot, archived = false, equipmentIds = [] }) {
  const serialized = typeof snapshot === 'string' ? snapshot : JSON.stringify(snapshot);
  parsePlanSnapshot(serialized);
  const value = {
    ownerUid: profile.uid, schemaVersion: PLAN_SCHEMA_VERSION,
    title: cleanText(title, 100, 'Title'), description: String(description).trim().slice(0, 500),
    revision: 1, solverVersion: SOLVER_VERSION, archived: Boolean(archived), snapshot: serialized,
    equipmentIds: normalizeEquipmentIds(equipmentIds)
  };
  return createInAvailableSlot(db, profile.uid, profile.tier, 'liftPlans', value);
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
