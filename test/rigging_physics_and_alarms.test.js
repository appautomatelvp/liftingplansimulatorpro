// test/rigging_physics_and_alarms.test.js
import { describe, it, expect } from 'vitest';
import {
  computeSlingAngle3D,
  classifyAngle,
  computeLegTension,
  evaluateZone,
  computeShackleSideDerate,
  solveCoGMomentEquilibrium,
  applyDNV4LegSkewRule,
  cascadeFailure,
  computeSpreaderCompression,
  computeLiftingBeamMoment
} from '../src/rigging/RiggingPhysicsSolver.js';
import { ZONE, DNV_4LEG, ANGLE_THRESHOLDS } from '../src/rigging/riggingConstants.js';

// ─────────────────────────────────────────────
// TEST 1: Low Angle Detection (ASME B30.9)
// ─────────────────────────────────────────────
describe('Test 1 — Low Angle (α = 29°)', () => {
  it('classifies 29° as CRITICAL_LOW_ANGLE and canLift = false', () => {
    const result = classifyAngle(29);
    expect(result.zone).toBe('CRITICAL_LOW_ANGLE');
    expect(result.canLift).toBe(false);
  });

  it('classifies 30° as WARNING_LOW_ANGLE and canLift = true', () => {
    const result = classifyAngle(30);
    expect(result.zone).toBe('WARNING_LOW_ANGLE');
    expect(result.canLift).toBe(true);
  });

  it('classifies 44.9° as WARNING_LOW_ANGLE and canLift = true', () => {
    const result = classifyAngle(44.9);
    expect(result.zone).toBe('WARNING_LOW_ANGLE');
    expect(result.canLift).toBe(true);
  });

  it('classifies 45° as SAFE and canLift = true', () => {
    const result = classifyAngle(45);
    expect(result.zone).toBe('SAFE');
    expect(result.canLift).toBe(true);
  });

  it('computes correct angle from 3D points in Y-up space', () => {
    // top = (0, 10, 0), bottom = (0, 0, 10)
    // horizDist = 10, vertDist = 10 -> angle = 45°
    const r = computeSlingAngle3D({ x: 0, y: 10, z: 0 }, { x: 0, y: 0, z: 10 });
    expect(r.angleDeg).toBeCloseTo(45, 1);
    expect(r.horizDist).toBeCloseTo(10, 1);
    expect(r.vertDist).toBeCloseTo(10, 1);
  });
});

// ─────────────────────────────────────────────
// TEST 2: DNV 4-Leg Skew Load Rule
// ─────────────────────────────────────────────
describe('Test 2 — DNV 4-Leg Statically Indeterminate (40t)', () => {
  const totalWeight = 40; // tonnes
  const angleDeg = 60; // 60°
  const SKL = DNV_4LEG.SKL_DEFAULT; // 1.25

  const lugs = [
    { x: -5, y: 0, z: -5, id: 'L0' },
    { x:  5, y: 0, z: -5, id: 'L1' },
    { x:  5, y: 0, z:  5, id: 'L2' },
    { x: -5, y: 0, z:  5, id: 'L3' },
  ];
  const cogWorld = { x: 0, y: 0, z: 0 };

  it('redistributes unequal elastic tension without forcing passive diagonal legs to 0t', () => {
    const cogShares = solveCoGMomentEquilibrium(lugs, cogWorld, totalWeight);
    const dnvShares = applyDNV4LegSkewRule(lugs, cogShares, SKL);
    expect(dnvShares[1]).toBeGreaterThan(0);
    expect(dnvShares[3]).toBeGreaterThan(0);
    expect(dnvShares[0] + dnvShares[1] + dnvShares[2] + dnvShares[3]).toBeCloseTo(1.0, 2);
    expect(dnvShares.dnvNotice).toBeTruthy();
  });

  it('assigns heavier diagonal tension (> 10t) while rigid opt-out keeps DNV 1.50 SKL envelope', () => {
    const cogShares = solveCoGMomentEquilibrium(lugs, cogWorld, totalWeight);
    const dnvShares = applyDNV4LegSkewRule(lugs, cogShares, SKL);

    // Active vertical load in tonnes: share * totalWeight
    const vertLoad0 = dnvShares[0] * totalWeight;
    const vertLoad2 = dnvShares[2] * totalWeight;

    expect(vertLoad0).toBeGreaterThan(10);
    expect(vertLoad2).toBeGreaterThan(10);

    // Tension with angle amplification at 60°: T = V / sin(60°)
    const T0 = computeLegTension(vertLoad0, 1.0, angleDeg, 1.0);
    const T2 = computeLegTension(vertLoad2, 1.0, angleDeg, 1.0);

    expect(T0).toBeGreaterThan(10);
    expect(T2).toBeGreaterThan(10);
  });

  it('Test 2b — Pure rigid SKL boundary 1.50 (elasticTorsion=false) assigns 30t to active diagonal', () => {
    const cogShares = solveCoGMomentEquilibrium(lugs, cogWorld, totalWeight);
    const dnvShares = applyDNV4LegSkewRule(lugs, cogShares, 1.50, { elasticTorsion: false });
    const vertLoad0 = dnvShares[0] * totalWeight;
    expect(vertLoad0).toBeCloseTo(30, 1); // 40 * 0.5 * 1.50 = 30t
  });
});

// ─────────────────────────────────────────────
// TEST 3: 3-Zone Alarm Thresholds
// ─────────────────────────────────────────────
describe('Test 3 — 3-Zone Alarm Thresholds', () => {
  const SWL = 10; // tonnes
  const MBL = 50; // tonnes

  it('T = 5t -> ZONE.SAFE', () => {
    const r = evaluateZone(5, SWL, MBL);
    expect(r.zone).toBe(ZONE.SAFE);
    expect(r.pctSWL).toBeCloseTo(50, 0);
  });

  it('T = 10t -> ZONE.SAFE (boundary)', () => {
    const r = evaluateZone(10, SWL, MBL);
    expect(r.zone).toBe(ZONE.SAFE);
    expect(r.pctSWL).toBeCloseTo(100, 0);
  });

  it('T = 10.01t -> ZONE.OVERLOAD', () => {
    const r = evaluateZone(10.01, SWL, MBL);
    expect(r.zone).toBe(ZONE.OVERLOAD);
  });

  it('T = 15t -> ZONE.OVERLOAD (payload remains suspended)', () => {
    const r = evaluateZone(15, SWL, MBL);
    expect(r.zone).toBe(ZONE.OVERLOAD);
    expect(r.pctSWL).toBeCloseTo(150, 0);
  });

  it('T = 49.9t -> ZONE.OVERLOAD', () => {
    const r = evaluateZone(49.9, SWL, MBL);
    expect(r.zone).toBe(ZONE.OVERLOAD);
  });

  it('T = 50t -> ZONE.SNAP (boundary trigger)', () => {
    const r = evaluateZone(50, SWL, MBL);
    expect(r.zone).toBe(ZONE.SNAP);
  });

  it('T = 55t -> ZONE.SNAP (cascade trigger)', () => {
    const r = evaluateZone(55, SWL, MBL);
    expect(r.zone).toBe(ZONE.SNAP);
    expect(r.pctMBL).toBeGreaterThan(100);
  });
});

// ─────────────────────────────────────────────
// TEST 4: Cascade Failure Shock (DNV shock × 2.0)
// ─────────────────────────────────────────────
describe('Test 4 — Cascade Failure Shock', () => {
  it('surviving legs receive dynamic shock from snapped leg', () => {
    const survivingLegs = [
      { id: 'L1', T_actual: 8, SWL_effective: 10, MBL: 25 },
      { id: 'L2', T_actual: 8, SWL_effective: 10, MBL: 25 },
      { id: 'L3', T_actual: 8, SWL_effective: 10, MBL: 25 },
    ];

    // Snapped leg carried 20t -> shock = 20 * 2.0 = 40t
    // Each of 3 surviving gets 40 / 3 = 13.33t -> newT = 21.33t (< 25t MBL)
    const results = cascadeFailure({ id: 'L0', T_actual: 20 }, survivingLegs, 2.0);

    expect(results).toHaveLength(3);
    results.forEach(r => {
      expect(r.newT).toBeCloseTo(21.33, 1);
      expect(r.alsoSnapped).toBe(false);
    });
  });

  it('Test 4b — propagates to full cascade when shock pushes past MBL', () => {
    const survivingLegs = [
      { id: 'L1', T_actual: 20, SWL_effective: 10, MBL: 25 },
      { id: 'L2', T_actual: 20, SWL_effective: 10, MBL: 25 },
    ];
    // Snapped leg carried 30t -> shock = 30 * 2.0 = 60t
    // Each of 2 surviving gets 30t -> newT = 50t (> 25t MBL) -> alsoSnapped!
    const results = cascadeFailure({ id: 'L0_heavy', T_actual: 30 }, survivingLegs, 2.0);

    expect(results.every(r => r.alsoSnapped)).toBe(true);
  });
});

// ─────────────────────────────────────────────
// TEST 5: Hitch Factor WLL Derating
// ─────────────────────────────────────────────
describe('Test 5 — Hitch Factor WLL Derating', () => {
  it('Choker hitch (factor 0.8) at 60°: T = 10 / 0.8 / sin(60°)', () => {
    const T = computeLegTension(10, 0.8, 60, 1.0);
    const expected = (10 / 0.8) / Math.sin(60 * Math.PI / 180);
    expect(T).toBeCloseTo(expected, 2);
    expect(T).toBeGreaterThan(10);
  });

  it('Vertical hitch at 90°: T = exact load share', () => {
    const T = computeLegTension(10, 1.0, 90, 1.0);
    expect(T).toBeCloseTo(10, 2);
  });

  it('Basket 90° hitch (factor 2.0): T = loadShare / 2.0', () => {
    const T = computeLegTension(10, 2.0, 90, 1.0);
    expect(T).toBeCloseTo(5, 2);
  });
});

// ─────────────────────────────────────────────
// TEST 6: Dynamic Amplification Factor (Kdyn)
// ─────────────────────────────────────────────
describe('Test 6 — Kdyn Amplification', () => {
  it('Kdyn = 1.0 at rest (az = 0)', () => {
    const T = computeLegTension(10, 1.0, 90, 1.0);
    expect(T).toBeCloseTo(10, 2);
  });

  it('Kdyn = 1.5 at 0.5g vertical acceleration', () => {
    const T = computeLegTension(10, 1.0, 90, 1.5);
    expect(T).toBeCloseTo(15, 2);
  });
});

// ─────────────────────────────────────────────
// TEST 7: 2-Lug Moment Equilibrium
// ─────────────────────────────────────────────
describe('Test 7 — 2-Lug CoG Moment Equilibrium', () => {
  it('symmetric 2-lug with CoG offset +2m (span 10m): V = [0.3W, 0.7W]', () => {
    const lugs = [
      { x: -5, y: 0, z: 0, id: 'L0' },
      { x:  5, y: 0, z: 0, id: 'L1' }
    ];
    const cogWorld = { x: 2, y: 0, z: 0 };
    const shares = solveCoGMomentEquilibrium(lugs, cogWorld, 100);

    expect(shares[0]).toBeCloseTo(0.3, 2);
    expect(shares[1]).toBeCloseTo(0.7, 2);
    expect(shares[0] + shares[1]).toBeCloseTo(1.0, 4);
  });
});

// ─────────────────────────────────────────────
// TEST 8: 3-Lug 3D Moment Equilibrium
// ─────────────────────────────────────────────
describe('Test 8 — 3-Lug 3D Moment Equilibrium', () => {
  it('equilateral triangle with centered CoG splits 1/3 each', () => {
    const lugs = [
      { x: 0, y: 0, z: -4, id: 'L0' },
      { x: 3.464, y: 0, z: 2, id: 'L1' },
      { x: -3.464, y: 0, z: 2, id: 'L2' }
    ];
    const cogWorld = { x: 0, y: 0, z: 0 };
    const shares = solveCoGMomentEquilibrium(lugs, cogWorld, 90);

    expect(shares[0]).toBeCloseTo(1 / 3, 2);
    expect(shares[1]).toBeCloseTo(1 / 3, 2);
    expect(shares[2]).toBeCloseTo(1 / 3, 2);
  });
});

// ─────────────────────────────────────────────
// TEST 9: Shackle Side-Loading Derating (ASME B30.26)
// ─────────────────────────────────────────────
describe('Test 9 — Shackle Side-Loading Derating', () => {
  it('Dee shackle at 6° triggers CRITICAL_SIDE_LOAD error', () => {
    const r = computeShackleSideDerate('dee_shackle', 6);
    expect(r.factor).toBe(0.0);
    expect(r.isAllowed).toBe(false);
    expect(r.status).toBe('CRITICAL_SIDE_LOAD');
  });

  it('Bow shackle side-load derating curve: 30° -> 0.7, 60° -> 0.5', () => {
    const r30 = computeShackleSideDerate('bow_shackle', 30);
    expect(r30.factor).toBe(0.70);

    const r60 = computeShackleSideDerate('bow_shackle', 60);
    expect(r60.factor).toBe(0.50);

    const r91 = computeShackleSideDerate('bow_shackle', 91);
    expect(r91.factor).toBe(0.0);
    expect(r91.status).toBe('CRITICAL_ERROR');
  });
});

// ─────────────────────────────────────────────
// TEST 10: Spreader Beam Compression
// ─────────────────────────────────────────────
describe('Test 10 — Spreader Beam Axial Compression', () => {
  it('V = 40t, alpha_top = 60°: N = 40 / (2 * tan(60°)) = 11.55t', () => {
    const N = computeSpreaderCompression(40, 60);
    expect(N).toBeCloseTo(11.55, 1);
  });
});

// ─────────────────────────────────────────────
// TEST 11: Lifting Beam Bending Moment
// ─────────────────────────────────────────────
describe('Test 11 — Lifting Beam Bending Moment', () => {
  it('W = 40t, L = 6m: M = W * L / 4 = 60 t*m', () => {
    const M = computeLiftingBeamMoment(40, 6);
    expect(M).toBeCloseTo(60, 1);
  });
});
