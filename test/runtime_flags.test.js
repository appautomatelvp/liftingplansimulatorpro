import { describe, expect, it, vi } from 'vitest';
import {
  applyFlagsToAccess,
  getFreePlanLimit,
  getTierSlotLimit,
  isMaintenance,
  isModuleDisabled,
  loadFlagsOnce
} from '../src/saas/runtime_flags.js';

describe('runtime feature flags kill-switch (T-01)', () => {
  it('handles empty or missing flags with safe defaults', () => {
    expect(getFreePlanLimit(null)).toBe(20);
    expect(getFreePlanLimit(undefined)).toBe(20);
    expect(isMaintenance(null, { role: 'user', status: 'active' })).toBe(false);
    expect(applyFlagsToAccess(null, { tier: 'free', role: 'user', status: 'active' }, 'cargo.oog')).toEqual({
      allowed: false,
      reason: 'tier_locked'
    });
  });

  it('blocks standard users during maintenance while allowing active admin and support', () => {
    const flags = { maintenanceMode: true, maintenanceMessage: 'Scheduled upgrade' };
    const normalUser = { role: 'user', tier: 'premium', status: 'active' };
    const activeAdmin = { role: 'admin', tier: 'admin', status: 'active' };
    const activeSupport = { role: 'support', tier: 'free', status: 'active' };
    const inactiveAdmin = { role: 'admin', tier: 'admin', status: 'locked' };

    expect(isMaintenance(flags, normalUser)).toBe(true);
    expect(applyFlagsToAccess(flags, normalUser, 'cargo.oog')).toEqual({ allowed: false, reason: 'maintenance' });

    expect(isMaintenance(flags, activeAdmin)).toBe(false);
    expect(isMaintenance(flags, activeSupport)).toBe(false);
    expect(isMaintenance(flags, inactiveAdmin)).toBe(true);
  });

  it('disables specific modules even for premium or admin accounts', () => {
    const flags = { disabledModules: ['cargo.oog', 'beam.truss'] };
    const admin = { role: 'admin', tier: 'admin', status: 'active' };
    const premium = { role: 'user', tier: 'premium', status: 'active' };

    expect(isModuleDisabled(flags, 'cargo.oog')).toBe(true);
    expect(applyFlagsToAccess(flags, admin, 'cargo.oog')).toEqual({ allowed: false, reason: 'disabled_module' });
    expect(applyFlagsToAccess(flags, premium, 'beam.truss')).toEqual({ allowed: false, reason: 'disabled_module' });
    expect(applyFlagsToAccess(flags, premium, 'beam.frame')).toEqual({ allowed: true, reason: 'ok' });
  });

  it('matches module prefix when parent group is disabled', () => {
    const flags = { disabledModules: ['beam'] };
    const premium = { role: 'user', tier: 'premium', status: 'active' };
    expect(isModuleDisabled(flags, 'beam.container')).toBe(true);
    expect(applyFlagsToAccess(flags, premium, 'beam.container')).toEqual({ allowed: false, reason: 'disabled_module' });
    expect(applyFlagsToAccess(flags, premium, 'cargo.oog')).toEqual({ allowed: true, reason: 'ok' });
  });

  it('clamps freePlanLimit between 1 and 200 and preserves premium/admin cap at 200', () => {
    expect(getFreePlanLimit({ freePlanLimit: 0 })).toBe(1);
    expect(getFreePlanLimit({ freePlanLimit: -10 })).toBe(1);
    expect(getFreePlanLimit({ freePlanLimit: 500 })).toBe(200);
    expect(getFreePlanLimit({ freePlanLimit: 12.9 })).toBe(12);
    expect(getTierSlotLimit({ tier: 'free', role: 'user' }, { freePlanLimit: 7 })).toBe(7);
    expect(getTierSlotLimit({ tier: 'premium', role: 'user' }, { freePlanLimit: 7 })).toBe(200);
    expect(getTierSlotLimit({ tier: 'free', role: 'admin' }, { freePlanLimit: 7 })).toBe(200);
  });

  it('reads feature flags at most once per session and caches the result', async () => {
    const spy = vi.fn().mockResolvedValue({ maintenanceMode: true, freePlanLimit: 15, disabledModules: ['beam.frame'] });
    const getFlags = loadFlagsOnce(spy);

    const [first, second] = await Promise.all([getFlags(), getFlags()]);
    const third = await getFlags();

    expect(spy).toHaveBeenCalledTimes(1);
    expect(first).toEqual(second);
    expect(third.freePlanLimit).toBe(15);
    expect(third.maintenanceMode).toBe(true);
  });

  it('falls back to safe defaults without throwing when flag loading fails', async () => {
    const spy = vi.fn().mockRejectedValue(new Error('network unavailable'));
    const getFlags = loadFlagsOnce(spy);
    const loaded = await getFlags();

    expect(loaded).toEqual({
      maintenanceMode: false,
      maintenanceMessage: '',
      freePlanLimit: 20,
      disabledModules: []
    });
  });

  it('evaluates access consistently across empty profiles', () => {
    expect(applyFlagsToAccess({}, null, 'cargo.oog')).toEqual({ allowed: false, reason: 'tier_locked' });
    expect(applyFlagsToAccess({}, null, 'unknown.feature')).toEqual({ allowed: true, reason: 'ok' });
  });
});
