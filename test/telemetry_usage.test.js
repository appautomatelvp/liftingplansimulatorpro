import { describe, expect, it } from 'vitest';
import {
  buildNextUsageDoc,
  DAILY_WRITE_LIMIT,
  getSessionErrorSummary,
  MAX_ERROR_BUFFER,
  normalizeFeatureFlags,
  recordBoundedClientError,
  resetSessionErrorsForTest
} from '../src/saas/telemetry_usage.js';

describe('Spark usage quota, CMS feature flags, and bounded error monitor', () => {
  it('tracks daily write quota with rollover and enforces daily limit', () => {
    const first = buildNextUsageDoc(null, { dayKey: '2026-11-13', plansDelta: 1 });
    expect(first).toEqual({ dayKey: '2026-11-13', writesToday: 1, plansCount: 1, equipmentCount: 0 });

    const second = buildNextUsageDoc(first, { dayKey: '2026-11-13', equipmentDelta: 1 });
    expect(second).toEqual({ dayKey: '2026-11-13', writesToday: 2, plansCount: 1, equipmentCount: 1 });

    const rollover = buildNextUsageDoc({ dayKey: '2026-11-12', writesToday: 199, plansCount: 5, equipmentCount: 3 }, { dayKey: '2026-11-13' });
    expect(rollover).toEqual({ dayKey: '2026-11-13', writesToday: 1, plansCount: 5, equipmentCount: 3 });

    expect(() => buildNextUsageDoc({ dayKey: '2026-11-13', writesToday: DAILY_WRITE_LIMIT }, { dayKey: '2026-11-13' })).toThrow(/Daily Spark quota/);
  });

  it('normalizes CMS feature flags within schema bounds', () => {
    const flags = normalizeFeatureFlags({
      maintenanceMode: 1,
      maintenanceMessage: 'x'.repeat(350),
      freePlanLimit: 999,
      disabledModules: 'cargo.oog, beam.truss, cargo.oog'
    });
    expect(flags.maintenanceMode).toBe(true);
    expect(flags.maintenanceMessage.length).toBe(300);
    expect(flags.freePlanLimit).toBe(200);
    expect(flags.disabledModules).toEqual(['cargo.oog', 'beam.truss']);
  });

  it('caps in-memory session error telemetry cleanly', () => {
    resetSessionErrorsForTest();
    for (let i = 0; i < 25; i++) {
      recordBoundedClientError(`Failure #${i}`, 'unit-test');
    }
    const summary = getSessionErrorSummary();
    expect(summary.totalCount).toBe(25);
    expect(summary.recent).toHaveLength(MAX_ERROR_BUFFER);
    expect(summary.recent[0].message).toBe('Failure #15');
    expect(summary.recent[MAX_ERROR_BUFFER - 1].message).toBe('Failure #24');
  });
});
