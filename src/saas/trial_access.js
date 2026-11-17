// @purpose: Quản lý dùng thử Pro 24h, dấu vân tay thiết bị chống lạm dụng nhiều Gmail và hàm hasProAccess(user)

export const TRIAL_DURATION_MS = 24 * 60 * 60 * 1000;
export const DEVICE_FP_STORAGE_KEY = 'safelift_device_fp_v1';
export const TRIAL_CLAIMED_STORAGE_KEY = 'safelift_trial_claimed_v1';

const PAID_PRO_TIERS = new Set(['pro', 'premium', 'enterprise', 'admin']);

export function toMillis(value) {
  if (value == null) return null;
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (value instanceof Date) {
    const ms = value.getTime();
    return Number.isFinite(ms) ? ms : null;
  }
  if (typeof value === 'object') {
    if (typeof value.toMillis === 'function') {
      const ms = value.toMillis();
      return Number.isFinite(ms) ? ms : null;
    }
    if (typeof value.seconds === 'number') {
      return value.seconds * 1000 + Math.round((Number(value.nanoseconds) || 0) / 1e6);
    }
  }
  if (typeof value === 'string') {
    const ms = Date.parse(value);
    return Number.isFinite(ms) ? ms : null;
  }
  return null;
}

export function hashFingerprintSeed(rawInput = '') {
  const str = String(rawInput || 'safelift3d-anon-device');
  let h1 = 0x811c9dc5;
  let h2 = 0x9e3779b9;
  for (let i = 0; i < str.length; i++) {
    const code = str.charCodeAt(i);
    h1 ^= code;
    h1 = Math.imul(h1, 0x01000193);
    h2 ^= (code + i * 31);
    h2 = Math.imul(h2, 0x85ebca6b);
  }
  return `fp_${(h1 >>> 0).toString(16).padStart(8, '0')}${(h2 >>> 0).toString(16).padStart(8, '0')}`;
}

export function getOrCreateDeviceFingerprint(storage = typeof localStorage !== 'undefined' ? localStorage : null) {
  try {
    const cached = storage?.getItem?.(DEVICE_FP_STORAGE_KEY);
    if (cached && /^fp_[0-9a-f]{16}$/i.test(cached)) return cached;
  } catch { /* ignore storage errors */ }

  const nav = typeof navigator !== 'undefined' ? navigator : {};
  const scr = typeof screen !== 'undefined' ? screen : {};
  let tz = 'UTC';
  try { tz = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'; } catch { /* ignore */ }
  const seed = [
    nav.userAgent || '',
    nav.language || '',
    nav.platform || '',
    nav.hardwareConcurrency || '',
    scr.width || 0,
    scr.height || 0,
    scr.colorDepth || 0,
    tz
  ].join('|');

  const fp = hashFingerprintSeed(seed);
  try {
    storage?.setItem?.(DEVICE_FP_STORAGE_KEY, fp);
  } catch { /* ignore storage errors */ }
  return fp;
}

export function hasLocalTrialClaimed(storage = typeof localStorage !== 'undefined' ? localStorage : null) {
  try {
    return Boolean(storage?.getItem?.(TRIAL_CLAIMED_STORAGE_KEY));
  } catch {
    return false;
  }
}

export function markLocalTrialClaimed(fp, uid, storage = typeof localStorage !== 'undefined' ? localStorage : null) {
  try {
    storage?.setItem?.(TRIAL_CLAIMED_STORAGE_KEY, JSON.stringify({ fp: String(fp || ''), uid: String(uid || ''), at: Date.now() }));
  } catch { /* ignore storage errors */ }
}

/**
 * Computes whether a user currently holds Pro-level simulation & export privileges
 * (paid pro/premium/enterprise, active admin, or active 24h trial window).
 */
export function hasProAccess(user, nowMs = Date.now()) {
  if (!user || typeof user !== 'object') return false;
  if (user.status === 'locked' || user.status === 'banned') return false;
  const tier = String(user.tier || '').trim().toLowerCase();
  const role = String(user.role || '').trim().toLowerCase();
  if (role === 'admin' || PAID_PRO_TIERS.has(tier)) return true;
  const endsMs = toMillis(user.trialEndsAt);
  return endsMs !== null && nowMs < endsMs;
}

export function formatCountdownHms(remainingMs) {
  const totalSec = Math.max(0, Math.floor((Number(remainingMs) || 0) / 1000));
  const hrs = Math.floor(totalSec / 3600);
  const mins = Math.floor((totalSec % 3600) / 60);
  const secs = totalSec % 60;
  return `${String(hrs).padStart(2, '0')}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

export function getTrialState(user, nowMs = Date.now()) {
  if (!user || typeof user !== 'object') {
    return { isPaidPro: false, inTrial: false, expired: false, remainingMs: 0, progressPct: 0, formattedHms: '00:00:00', trialEndsMs: null };
  }
  const tier = String(user.tier || 'free').trim().toLowerCase();
  const role = String(user.role || 'user').trim().toLowerCase();
  const isPaidPro = role === 'admin' || PAID_PRO_TIERS.has(tier);
  const endsMs = toMillis(user.trialEndsAt);
  const startsMs = toMillis(user.trialStartedAt);
  if (isPaidPro) {
    return { isPaidPro: true, inTrial: false, expired: false, remainingMs: 0, progressPct: 100, formattedHms: '00:00:00', trialEndsMs: endsMs };
  }
  if (endsMs === null) {
    return { isPaidPro: false, inTrial: false, expired: false, remainingMs: 0, progressPct: 0, formattedHms: '00:00:00', trialEndsMs: null };
  }
  const totalSpan = startsMs !== null && endsMs > startsMs ? Math.min(TRIAL_DURATION_MS, endsMs - startsMs) : TRIAL_DURATION_MS;
  const remainingMs = Math.max(0, endsMs - nowMs);
  const inTrial = tier === 'free' && remainingMs > 0;
  const expired = tier === 'free' && remainingMs === 0;
  const progressPct = Math.max(0, Math.min(100, (remainingMs / Math.max(1, totalSpan)) * 100));
  return {
    isPaidPro: false,
    inTrial,
    expired,
    remainingMs,
    progressPct,
    formattedHms: formatCountdownHms(remainingMs),
    trialEndsMs: endsMs
  };
}
