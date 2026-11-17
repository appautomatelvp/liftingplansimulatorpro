import { hasProAccess } from './trial_access.js';

export { hasProAccess };

export const TIERS = Object.freeze({
  FREE: 'free',
  PREMIUM: 'premium',
  PRO: 'pro',
  ENTERPRISE: 'enterprise',
  ADMIN: 'admin'
});

export const FEATURE_RULES = Object.freeze({
  'cargo.oog': { minTier: TIERS.PRO, label: 'Out-of-gauge cargo' },
  'cargo.specialized': { minTier: TIERS.PRO, label: 'Specialized machinery and cargo' },
  'beam.equalizer': { minTier: TIERS.PRO, label: 'Equalizer beam' },
  'beam.cascaded': { minTier: TIERS.PRO, label: 'Cascaded spreader system' },
  'beam.truss': { minTier: TIERS.PRO, label: 'Spreader truss' },
  'beam.container': { minTier: TIERS.PRO, label: 'STS container spreader' },
  'beam.frame': { minTier: TIERS.PRO, label: 'H-beam spreader frame' },
  windSimulation: { minTier: TIERS.PRO, label: '3D Wind Aerodynamics Simulation' },
  riskAssessmentGenerator: { minTier: TIERS.PRO, label: 'Automated JSA/HSE Risk Assessment PDF' }
});

const TIER_RANK = Object.freeze({ free: 0, premium: 1, pro: 1, enterprise: 2, admin: 3 });

export function normalizeTier(profile) {
  if (profile?.role === 'admin' || profile?.tier === 'admin') return TIERS.ADMIN;
  const t = String(profile?.tier || '').trim().toLowerCase();
  if (t === TIERS.ENTERPRISE) return TIERS.ENTERPRISE;
  if (t === TIERS.PRO) return TIERS.PRO;
  if (t === TIERS.PREMIUM) return TIERS.PREMIUM;
  return TIERS.FREE;
}

export function canAccessFeature(profile, featureId, nowMs = Date.now()) {
  const rule = FEATURE_RULES[featureId];
  if (!rule) return true;
  const normalized = normalizeTier(profile);
  const effectiveRank = Math.max(
    TIER_RANK[normalized] ?? 0,
    hasProAccess(profile, nowMs) ? (TIER_RANK[TIERS.PRO] ?? 1) : 0
  );
  return effectiveRank >= (TIER_RANK[rule.minTier] ?? 0);
}

export function getFeatureRule(featureId) {
  return FEATURE_RULES[featureId] || null;
}

/**
 * Password accounts must verify their email before accessing the workspace.
 * Federated providers such as Google are treated as pre-verified.
 */
export function needsEmailVerification(user) {
  if (!user || user.emailVerified === true) return false;
  const providers = Array.isArray(user.providerData)
    ? user.providerData.map((entry) => entry?.providerId).filter(Boolean)
    : [];
  if (providers.length > 0) {
    return providers.includes('password');
  }
  return Boolean(user.email);
}
