import { describe, it, expect, beforeAll } from 'vitest';
import { createHeadlessSim } from '../sim_test_harness.js';

describe('Performance budgets (Phase 6)', () => {
  let api;

  beforeAll(() => {
    api = createHeadlessSim();
  }, 60_000);

  it('60 physics steps complete within soft budget (2.5s)', () => {
    const t0 = performance.now();
    api.stepSim(60);
    const ms = performance.now() - t0;
    expect(ms).toBeLessThan(2500);
  });
});
