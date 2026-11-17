import { describe, expect, it } from 'vitest';
import { computeAdaptiveSKL, resolveFourLegDiagonalLoad } from '../src/rigging/DnvFourPointLift.js';
import { applyDNV4LegSkewRule } from '../src/rigging/RiggingPhysicsSolver.js';

describe('DNV-ST-N001 & Elastic 4-Point Torsional Lift (Golden Tests)', () => {
  it('(a) elastic 4-point beam torsion shares load organically across all 4 taut legs (never forces 0t)', () => {
    const res = resolveFourLegDiagonalLoad({
      totalLoadT: 20,
      cogOffsetXZ: { x: 0, z: 0 },
      legLengthsM: [4.0, 4.012, 4.0, 4.012],
      skl: 1.25,
      isRigid: true,
      isEqualizer: false
    });
    expect(res.elasticTorsionActive).toBe(true);
    const [a0, a1] = res.activeDiagonal;
    const [p0, p1] = res.passiveDiagonal;
    expect(res.tensionsT[a0]).toBeGreaterThan(res.tensionsT[p0]);
    expect(res.tensionsT[p0]).toBeGreaterThan(1.5);
    expect(res.tensionsT[p1]).toBeGreaterThan(1.5);
    expect(res.tensionsT.reduce((s, v) => s + v, 0)).toBeCloseTo(20.0, 1);

    // Pure infinite-rigidity edge benchmark still supported when elasticTorsion=false
    const pureRigid = resolveFourLegDiagonalLoad({
      totalLoadT: 20,
      skl: 1.25,
      isRigid: true,
      isEqualizer: false,
      elasticTorsion: false
    });
    expect(pureRigid.tensionsT[pureRigid.passiveDiagonal[0]]).toBe(0);
  });

  it('(b) CoG shifted toward LP1 concentrates higher load on (LP1, LP3) while keeping secondary diagonal active', () => {
    const lugPositions = [
      { x: -2, z: -1 }, // LP1 (idx 0)
      { x: 2, z: -1 },  // LP2 (idx 1)
      { x: 2, z: 1 },   // LP3 (idx 2)
      { x: -2, z: 1 }   // LP4 (idx 3)
    ];
    const res = resolveFourLegDiagonalLoad({
      totalLoadT: 20,
      lugPositions,
      cogOffsetXZ: { x: -1.2, z: -0.6 },
      skl: 1.25,
      isRigid: true,
      isEqualizer: false
    });
    expect(res.activeDiagonal).toEqual([0, 2]);
    expect(res.passiveDiagonal).toEqual([1, 3]);
    expect(res.tensionsT[0]).toBeGreaterThan(res.tensionsT[2]);
    expect(res.tensionsT[1]).toBeGreaterThan(0);
    expect(res.tensionsT[3]).toBeGreaterThan(0);
    expect(res.tensionsT.reduce((s, v) => s + v, 0)).toBeCloseTo(20.0, 1);
  });

  it('(c) clamps explicit and adaptive SKL strictly within [1.25, 1.50]', () => {
    expect(computeAdaptiveSKL({ skl: 0.9 })).toBe(1.25);
    expect(computeAdaptiveSKL({ skl: 2.4 })).toBe(1.50);
    const adaptive = computeAdaptiveSKL({
      legLengthsM: [5.0, 5.08, 4.92, 5.0],
      stretchStrainPerT: 0.002,
      totalLoadT: 40
    });
    expect(adaptive).toBeGreaterThanOrEqual(1.25);
    expect(adaptive).toBeLessThanOrEqual(1.50);
  });

  it('(d) equalizer beam bypasses indeterminate diagonal rule and distributes evenly across 4 legs', () => {
    const res = resolveFourLegDiagonalLoad({
      totalLoadT: 20,
      skl: 1.35,
      isRigid: true,
      isEqualizer: true
    });
    expect(res.sklUsed).toBe(1.0);
    expect(res.hasSkewRisk).toBe(false);
    expect(res.shares).toEqual([0.25, 0.25, 0.25, 0.25]);
    expect(res.tensionsT).toEqual([5, 5, 5, 5]);
  });

  it('applyDNV4LegSkewRule delegates to elastic torsional or rigid solver cleanly', () => {
    const elastic = applyDNV4LegSkewRule([{ L0: 4 }, { L0: 4.01 }, { L0: 4 }, { L0: 4.01 }], [0.25, 0.25, 0.25, 0.25], 1.25);
    expect(elastic[0] + elastic[1] + elastic[2] + elastic[3]).toBeCloseTo(1.0, 3);
    expect(elastic[1]).toBeGreaterThan(0);

    const rigid = applyDNV4LegSkewRule([{ L0: 4 }, { L0: 4 }, { L0: 4 }, { L0: 4 }], [0.25, 0.25, 0.25, 0.25], 1.25, { elasticTorsion: false });
    expect(rigid[0] + rigid[2]).toBeCloseTo(1.25, 4);
    expect(rigid[1]).toBe(0);
    expect(rigid[3]).toBe(0);
    expect(rigid.sklUsed).toBe(1.25);
  });
});
