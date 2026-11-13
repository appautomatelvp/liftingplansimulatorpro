import { canAccessFeature } from './access.js';
import { clampCount, normalizeFeatureFlags } from './telemetry_usage.js';

const STAFF_BYPASS_ROLES = new Set(['admin', 'support']);

export function getFreePlanLimit(flags) {
  const normalized = normalizeFeatureFlags(flags || {});
  return clampCount(normalized.freePlanLimit ?? 20, 1, 200);
}

export function getTierSlotLimit(profile, flags = null) {
  if (profile?.tier === 'premium' || profile?.tier === 'admin' || profile?.role === 'admin') {
    return 200;
  }
  return getFreePlanLimit(flags);
}

export function isMaintenance(flags, profile) {
  const normalized = normalizeFeatureFlags(flags || {});
  if (!normalized.maintenanceMode) return false;
  if (profile?.status === 'active' && STAFF_BYPASS_ROLES.has(profile?.role)) {
    return false;
  }
  return true;
}

export function isModuleDisabled(flags, featureId) {
  if (!featureId) return false;
  const normalized = normalizeFeatureFlags(flags || {});
  const target = String(featureId).trim().toLowerCase();
  if (!target) return false;
  const prefix = target.split('.')[0];
  return normalized.disabledModules.some((entry) => {
    const clean = String(entry).trim().toLowerCase();
    return clean === target || (prefix && clean === prefix);
  });
}

export function applyFlagsToAccess(flags, profile, featureId) {
  if (isMaintenance(flags, profile)) {
    return { allowed: false, reason: 'maintenance' };
  }
  if (featureId && isModuleDisabled(flags, featureId)) {
    return { allowed: false, reason: 'disabled_module' };
  }
  if (featureId && !canAccessFeature(profile, featureId)) {
    return { allowed: false, reason: 'tier_locked' };
  }
  return { allowed: true, reason: 'ok' };
}

export function loadFlagsOnce(readFn) {
  let cachedPromise = null;
  return () => {
    if (!cachedPromise) {
      cachedPromise = Promise.resolve()
        .then(() => (typeof readFn === 'function' ? readFn() : {}))
        .then((raw) => normalizeFeatureFlags(raw || {}))
        .catch(() => normalizeFeatureFlags({}));
    }
    return cachedPromise;
  };
}
