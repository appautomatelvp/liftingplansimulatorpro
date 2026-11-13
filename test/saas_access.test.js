import { describe, expect, it } from 'vitest';
import { canAccessFeature, FEATURE_RULES, normalizeTier } from '../src/saas/access.js';

describe('SafeLift3D SaaS tier access', () => {
  it('keeps core tools open to free accounts', () => {
    expect(canAccessFeature({ role: 'user', tier: 'free' }, 'core.cargo')).toBe(true);
    expect(canAccessFeature({ role: 'user', tier: 'free' }, 'beam.lifting')).toBe(true);
  });

  it('locks premium catalog features for free accounts', () => {
    for (const featureId of Object.keys(FEATURE_RULES)) {
      expect(canAccessFeature({ role: 'user', tier: 'free' }, featureId), featureId).toBe(false);
    }
  });

  it('allows premium and administrator profiles to use gated catalog features', () => {
    expect(canAccessFeature({ role: 'user', tier: 'premium' }, 'cargo.oog')).toBe(true);
    expect(canAccessFeature({ role: 'user', tier: 'premium' }, 'beam.truss')).toBe(true);
    expect(canAccessFeature({ role: 'admin', tier: 'free' }, 'beam.equalizer')).toBe(true);
  });

  it('treats unknown tiers as free and unknown feature IDs as ungated', () => {
    expect(normalizeTier({ role: 'user', tier: 'enterprise' })).toBe('free');
    expect(canAccessFeature({ role: 'user', tier: 'enterprise' }, 'cargo.specialized')).toBe(false);
    expect(canAccessFeature({ role: 'user', tier: 'free' }, 'core.new-tool')).toBe(true);
  });

  it('does not grant administrator tier to regular premium users', () => {
    expect(normalizeTier({ role: 'user', tier: 'premium' })).toBe('premium');
    expect(normalizeTier({ role: 'user', tier: 'premium' })).not.toBe('admin');
  });
});
