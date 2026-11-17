// @purpose: Unit tests cho trial_access (24h Pro trial, device fingerprint anti-abuse, countdown & expiry)
import { describe, it, expect } from 'vitest';
import {
  TRIAL_DURATION_MS,
  hasProAccess,
  getTrialState,
  formatCountdownHms,
  getOrCreateDeviceFingerprint,
  hasLocalTrialClaimed,
  markLocalTrialClaimed
} from '../src/saas/trial_access.js';

function makeStorage(initial = {}) {
  const map = new Map(Object.entries(initial));
  return {
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => map.set(k, String(v))
  };
}

describe('24h Pro Trial Access & Anti-Abuse', () => {
  it('grants Pro access during active 24h trial and revokes cleanly when expired', () => {
    const now = 1_700_000_000_000;
    const trialUser = {
      uid: 'u1',
      tier: 'free',
      role: 'user',
      status: 'active',
      trialStartedAt: now - 3_600_000,
      trialEndsAt: now + (23 * 3_600_000)
    };
    expect(hasProAccess(trialUser, now)).toBe(true);
    expect(getTrialState(trialUser, now).inTrial).toBe(true);
    expect(getTrialState(trialUser, now).expired).toBe(false);

    const expiredUser = { ...trialUser, trialEndsAt: now - 1000 };
    expect(hasProAccess(expiredUser, now)).toBe(false);
    expect(getTrialState(expiredUser, now).inTrial).toBe(false);
    expect(getTrialState(expiredUser, now).expired).toBe(true);
  });

  it('grants Pro access permanently for pro, premium, enterprise tiers and admin role', () => {
    const now = 1_700_000_000_000;
    expect(hasProAccess({ tier: 'pro', status: 'active' }, now)).toBe(true);
    expect(hasProAccess({ tier: 'premium', status: 'active' }, now)).toBe(true);
    expect(hasProAccess({ tier: 'enterprise', status: 'active' }, now)).toBe(true);
    expect(hasProAccess({ role: 'admin', tier: 'free', status: 'active' }, now)).toBe(true);
    expect(hasProAccess({ tier: 'pro', status: 'locked' }, now)).toBe(false);
  });

  it('formats countdown cleanly as HH:MM:SS and bounds progress percentage', () => {
    expect(formatCountdownHms(0)).toBe('00:00:00');
    expect(formatCountdownHms(-5000)).toBe('00:00:00');
    expect(formatCountdownHms((23 * 3600 + 59 * 60 + 5) * 1000)).toBe('23:59:05');

    const now = 2_000_000_000_000;
    const state = getTrialState({
      tier: 'free',
      status: 'active',
      trialStartedAt: now - TRIAL_DURATION_MS / 2,
      trialEndsAt: now + TRIAL_DURATION_MS / 2
    }, now);
    expect(state.progressPct).toBeCloseTo(50, 1);
  });

  it('persists device fingerprint & anti-abuse claim flag locally', () => {
    const storage = makeStorage();
    const fp1 = getOrCreateDeviceFingerprint(storage);
    const fp2 = getOrCreateDeviceFingerprint(storage);
    expect(fp1).toBe(fp2);
    expect(fp1.length).toBeGreaterThanOrEqual(8);
    expect(hasLocalTrialClaimed(storage)).toBe(false);

    markLocalTrialClaimed(fp1, 'uid-first', storage);
    expect(hasLocalTrialClaimed(storage)).toBe(true);
  });
});
