export const TIERS = Object.freeze({
  FREE: 'free',
  PREMIUM: 'premium',
  ADMIN: 'admin'
});

export const FEATURE_RULES = Object.freeze({
  'cargo.oog': { minTier: TIERS.PREMIUM, label: 'Out-of-gauge cargo' },
  'cargo.specialized': { minTier: TIERS.PREMIUM, label: 'Specialized machinery and cargo' },
  'beam.equalizer': { minTier: TIERS.PREMIUM, label: 'Equalizer beam' },
  'beam.cascaded': { minTier: TIERS.PREMIUM, label: 'Cascaded spreader system' },
  'beam.truss': { minTier: TIERS.PREMIUM, label: 'Spreader truss' },
  'beam.container': { minTier: TIERS.PREMIUM, label: 'STS container spreader' },
  'beam.frame': { minTier: TIERS.PREMIUM, label: 'H-beam spreader frame' }
});

const TIER_RANK = Object.freeze({ free: 0, premium: 1, admin: 2 });

export function normalizeTier(profile) {
  if (profile?.role === 'admin' || profile?.tier === 'admin') return TIERS.ADMIN;
  return profile?.tier === TIERS.PREMIUM ? TIERS.PREMIUM : TIERS.FREE;
}

export function canAccessFeature(profile, featureId) {
  const rule = FEATURE_RULES[featureId];
  if (!rule) return true;
  const tier = normalizeTier(profile);
  return (TIER_RANK[tier] ?? 0) >= (TIER_RANK[rule.minTier] ?? 0);
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
