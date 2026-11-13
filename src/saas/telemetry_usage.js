import { doc, getDoc, runTransaction, serverTimestamp, setDoc } from 'firebase/firestore';

export const DAILY_WRITE_LIMIT = 200;
export const MAX_ERROR_BUFFER = 10;

export function utcDayKey(now = new Date()) {
  return new Date(now).toISOString().slice(0, 10);
}

export function clampCount(value, min = 0, max = 200) {
  const n = Math.trunc(Number(value));
  if (!Number.isFinite(n)) return min;
  return Math.min(max, Math.max(min, n));
}

export function buildNextUsageDoc(existing, { dayKey = utcDayKey(), plansDelta = 0, equipmentDelta = 0, plansCount = null, equipmentCount = null } = {}) {
  const prev = existing && typeof existing === 'object' ? existing : {};
  const sameDay = prev.dayKey === dayKey;
  const currentWrites = sameDay ? clampCount(prev.writesToday ?? 0, 0, DAILY_WRITE_LIMIT) : 0;
  if (sameDay && currentWrites >= DAILY_WRITE_LIMIT) {
    const err = new Error('Daily Spark quota write budget reached for this account.');
    err.code = 'safelift/daily-write-limit';
    throw err;
  }
  const nextPlans = plansCount != null
    ? clampCount(plansCount)
    : clampCount((prev.plansCount ?? 0) + plansDelta);
  const nextEquipment = equipmentCount != null
    ? clampCount(equipmentCount)
    : clampCount((prev.equipmentCount ?? 0) + equipmentDelta);
  return {
    dayKey,
    writesToday: sameDay ? currentWrites + 1 : 1,
    plansCount: nextPlans,
    equipmentCount: nextEquipment
  };
}

export async function recordUsageWrite(db, uid, options = {}) {
  if (!db || !uid) return null;
  const ref = doc(db, 'users', uid, 'meta', 'usage');
  const dayKey = utcDayKey();
  return runTransaction(db, async (transaction) => {
    const snap = await transaction.get(ref);
    const next = buildNextUsageDoc(snap.exists() ? snap.data() : null, { ...options, dayKey });
    const payload = { ...next, updatedAt: serverTimestamp() };
    transaction.set(ref, payload);
    return next;
  });
}

export async function readUsageQuota(db, uid) {
  if (!db || !uid) return null;
  const snap = await getDoc(doc(db, 'users', uid, 'meta', 'usage'));
  if (!snap.exists()) return { dayKey: utcDayKey(), writesToday: 0, plansCount: 0, equipmentCount: 0, limit: DAILY_WRITE_LIMIT };
  const data = snap.data() || {};
  const today = utcDayKey();
  return {
    dayKey: String(data.dayKey || today),
    writesToday: data.dayKey === today ? clampCount(data.writesToday ?? 0) : 0,
    plansCount: clampCount(data.plansCount ?? 0),
    equipmentCount: clampCount(data.equipmentCount ?? 0),
    limit: DAILY_WRITE_LIMIT
  };
}

export function normalizeFeatureFlags(raw = {}) {
  const modulesRaw = Array.isArray(raw.disabledModules)
    ? raw.disabledModules
    : String(raw.disabledModules || '').split(',').map((s) => s.trim()).filter(Boolean);
  return {
    maintenanceMode: Boolean(raw.maintenanceMode),
    maintenanceMessage: String(raw.maintenanceMessage ?? '').trim().slice(0, 300),
    freePlanLimit: clampCount(raw.freePlanLimit ?? 20, 1, 200),
    disabledModules: [...new Set(modulesRaw.map((m) => String(m).trim().slice(0, 40)).filter(Boolean))].slice(0, 20)
  };
}

export async function readFeatureFlags(db) {
  const defaults = normalizeFeatureFlags({});
  if (!db) return defaults;
  try {
    const snap = await getDoc(doc(db, 'config', 'featureFlags'));
    return snap.exists() ? normalizeFeatureFlags(snap.data()) : defaults;
  } catch {
    return defaults;
  }
}

export async function saveFeatureFlags(db, adminUid, flags) {
  if (!db || !adminUid) throw new Error('Administrator session is required to update feature flags.');
  const normalized = normalizeFeatureFlags(flags);
  await setDoc(doc(db, 'config', 'featureFlags'), {
    ...normalized,
    updatedBy: adminUid,
    updatedAt: serverTimestamp()
  });
  return normalized;
}

const sessionErrors = [];
let totalErrorCount = 0;

export function recordBoundedClientError(message, source = 'runtime') {
  totalErrorCount += 1;
  const entry = {
    message: String(message || 'Unknown error').slice(0, 160),
    source: String(source || 'runtime').slice(0, 40),
    at: new Date().toISOString()
  };
  sessionErrors.push(entry);
  if (sessionErrors.length > MAX_ERROR_BUFFER) {
    sessionErrors.splice(0, sessionErrors.length - MAX_ERROR_BUFFER);
  }
  return entry;
}

export function getSessionErrorSummary() {
  return {
    totalCount: totalErrorCount,
    recent: sessionErrors.map((e) => ({ ...e }))
  };
}

export function resetSessionErrorsForTest() {
  sessionErrors.length = 0;
  totalErrorCount = 0;
}

let errorListenersInstalled = false;
export function installBoundedErrorCounter() {
  if (errorListenersInstalled || typeof window === 'undefined') return () => {};
  errorListenersInstalled = true;
  const onError = (event) => recordBoundedClientError(event?.message || event?.error?.message, 'window.error');
  const onRejection = (event) => recordBoundedClientError(event?.reason?.message || String(event?.reason || 'Unhandled rejection'), 'unhandledrejection');
  window.addEventListener('error', onError);
  window.addEventListener('unhandledrejection', onRejection);
  return () => {
    window.removeEventListener('error', onError);
    window.removeEventListener('unhandledrejection', onRejection);
    errorListenersInstalled = false;
  };
}
