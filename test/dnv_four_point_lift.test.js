import { describe, expect, it } from 'vitest';
import { computeAdaptiveSKL, resolveFourLegDiagonalLoad } from '../src/rigging/DnvFourPointLift.js';
import { applyDNV4LegSkewRule } from '../src/rigging/RiggingPhysicsSolver.js';

describe('DNV-ST-N001 4-Point Statically Indeterminate Lift (Golden Tests)', () => {
  it('(a) 20t symmetric rigid cargo with SKL=1.25 puts 12.5t on active diagonal and 0t on passive legs', () => {
    const res = resolveFourLegDiagonalLoad({
      totalLoadT: 20,
      cogOffsetXZ: { x: 0, z: 0 },
      skl: 1.25,
      isRigid: true,
      isEqualizer: false
    });
    expect(res.sklUsed).toBe(1.25);
    expect(res.heavyPairSharePct).toBe(100);
    expect(res.hasSkewRisk).toBe(true);
    const [a0, a1] = res.activeDiagonal;
    const [p0, p1] = res.passiveDiagonal;
    expect(res.tensionsT[a0]).toBeCloseTo(12.5, 3);
    expect(res.tensionsT[a1]).toBeCloseTo(12.5, 3);
    expect(res.tensionsT[p0]).toBe(0);
    expect(res.tensionsT[p1]).toBe(0);
  });

  it('(b) CoG shifted toward LP1 selects diagonal (LP1, LP3) = [0, 2] consistently', () => {
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
    expect(res.tensionsT[1]).toBe(0);
    expect(res.tensionsT[3]).toBe(0);
    expect(res.tensionsT[0] + res.tensionsT[2]).toBeCloseTo(25.0, 2);
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

  it('applyDNV4LegSkewRule delegates directly to DnvFourPointLift unified solver', () => {
    const shares = applyDNV4LegSkewRule([{ L0: 4 }, { L0: 4 }, { L0: 4 }, { L0: 4 }], [0.25, 0.25, 0.25, 0.25], 1.25);
    expect(shares[0] + shares[2]).toBeCloseTo(1.25, 4);
    expect(shares[1]).toBe(0);
    expect(shares[3]).toBe(0);
    expect(shares.sklUsed).toBe(1.25);
  });
});
