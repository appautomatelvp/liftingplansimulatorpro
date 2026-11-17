// @purpose: Tests cho Dynamic CMS Feature & 3D Asset Locks (system_config/feature_locks 3-state resolution & matrix HTML)
import { describe, it, expect } from 'vitest';
import {
  CMS_LOCK_ITEMS,
  LOCK_STATES,
  normalizeFeatureLocksDoc,
  evaluateItemLockState
} from '../src/saas/feature_locks_cms.js';
import { renderFeatureLocksSection } from '../src/saas/admin_feature_locks_panel.js';
import { saasT } from '../src/saas/i18n.js';

describe('Dynamic CMS Feature & 3D Asset Locks (3-state matrix)', () => {
  it('normalizes missing or unknown states back to catalog defaults', () => {
    const doc = normalizeFeatureLocksDoc({
      locks: {
        windSimulation: 'upgrading',
        crane_sts_gantry: 'invalid_state'
      }
    });
    expect(doc.locks.windSimulation).toBe(LOCK_STATES.UPGRADING);
    expect(doc.locks.crane_sts_gantry).toBe(LOCK_STATES.ACTIVE);
    expect(Object.keys(doc.locks).length).toBe(CMS_LOCK_ITEMS.length);
  });

  it('blocks Under Upgrade items for all tiers including Pro and Admin', () => {
    const featureLocks = { locks: { cargo_oog_transformer: LOCK_STATES.UPGRADING } };
    const proUser = { role: 'user', tier: 'pro', status: 'active' };
    const adminUser = { role: 'admin', tier: 'pro', status: 'active' };

    const resPro = evaluateItemLockState({ itemId: 'cargo_oog_transformer', profile: proUser, featureLocks });
    const resAdmin = evaluateItemLockState({ itemId: 'cargo_oog_transformer', profile: adminUser, featureLocks });
    expect(resPro.allowed).toBe(false);
    expect(resPro.state).toBe(LOCK_STATES.UPGRADING);
    expect(resPro.reason).toBe('upgrading');
    expect(resAdmin.allowed).toBe(false);
  });

  it('respects Tier Locked vs Active vs 24h Trial access', () => {
    const now = 2_000_000_000_000;
    const featureLocks = { locks: { windSimulation: LOCK_STATES.TIER_LOCKED } };
    const freeUser = { role: 'user', tier: 'free', status: 'active' };
    const trialUser = { role: 'user', tier: 'free', status: 'active', trialEndsAt: now + 60_000 };

    const evalFree = evaluateItemLockState({ itemId: 'windSimulation', profile: freeUser, featureLocks, nowMs: now });
    const evalTrial = evaluateItemLockState({ itemId: 'windSimulation', profile: trialUser, featureLocks, nowMs: now });
    expect(evalFree.allowed).toBe(false);
    expect(evalFree.reason).toBe('tier_locked');
    expect(evalTrial.allowed).toBe(true);
    expect(evalTrial.state).toBe(LOCK_STATES.ACTIVE);
  });

  it('renders 3-state matrix pills in admin panel with centralized i18n copy', () => {
    const html = renderFeatureLocksSection({
      tr: (k, v) => saasT(k, v, 'vi'),
      canEditUsers: true,
      featureLocks: { locks: { windSimulation: LOCK_STATES.UPGRADING } }
    });
    expect(html).toContain('data-section="locks"');
    expect(html).toContain('data-lock-item="windSimulation"');
    expect(html).toContain('data-lock-state="upgrading"');
    expect(saasT('cmsUpgradingNotice', null, 'vi')).toContain('Kỹ sư Lê Việt Phương');
  });
});
