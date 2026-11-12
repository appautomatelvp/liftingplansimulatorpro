/**
 * Phase 1 / Phase 4 — Industrial alarms, DNV 4-leg tolerances, 3-zone MBL snap.
 */
import { describe, it, expect } from 'vitest';
import {
  resolveTopology,
  getHitchFactor,
  computeSlingAngle3D,
  classifyAngle,
  computeLegTension,
  evaluateZone,
  applyDNV4LegSkewRule,
  solveCoGMomentEquilibrium,
  cascadeFailure,
  evaluate,
  TOPOLOGY,
  HITCH,
  ZONE,
  DNV_4LEG,
  CASCADE_SHOCK
} from '../src/rigging/RiggingPhysicsSolver.js';
import { ANGLE_THRESHOLDS } from '../src/rigging/riggingConstants.js';

describe('Topology & hitch (Phase 1)', () => {
  it('maps beam types to load-path topologies', () => {
    expect(resolveTopology({ beamType: 'none' }, 1)).toBe(TOPOLOGY.DIRECT_HOOK);
    expect(resolveTopology({ beamType: 'none' }, 4)).toBe(TOPOLOGY.MULTI_LEG);
    expect(resolveTopology({ beamType: 'spreader' }, 4)).toBe(TOPOLOGY.SPREADER_BEAM);
    expect(resolveTopology({ beamType: 'lifting_beam' }, 4)).toBe(TOPOLOGY.LIFTING_BEAM);
    expect(resolveTopology({ beamType: 'container_spreader' }, 4)).toBe(TOPOLOGY.SPREADER_BEAM);
  });

  it('applies hitch WLL factors Vertical 1.0 / Choker 0.8 / Basket 2.0', () => {
    expect(getHitchFactor('Vertical')).toBe(HITCH.VERTICAL.wllFactor);
    expect(getHitchFactor({ rigSolver: { hitch: 'Choker' } })).toBe(0.8);
    expect(getHitchFactor({ rigSolver: { hitch: 'Basket_90deg' } })).toBe(2.0);
  });
});

describe('3D sling angle alarms (ASME B30.9)', () => {
  it('WARNING for 30° ≤ α < 45°, CRITICAL for α < 30°', () => {
    expect(classifyAngle(45).zone).toBe('SAFE');
    expect(classifyAngle(44.9).zone).toBe('WARNING_LOW_ANGLE');
    expect(classifyAngle(30).zone).toBe('WARNING_LOW_ANGLE');
    expect(classifyAngle(29.9).zone).toBe('CRITICAL_LOW_ANGLE');
    expect(classifyAngle(29.9).canLift).toBe(false);
  });

  it('computes α from 3D vectors (Y-up)', () => {
    const r = computeSlingAngle3D({ x: 0, y: 10, z: 0 }, { x: 0, y: 0, z: 10 });
    expect(r.angleDeg).toBeCloseTo(45, 1);
  });
});

describe('DNV 4-leg statically indeterminate (2 diagonal carry 100%)', () => {
  const lugs = [
    { x: -5, y: 0, z: -5 },
    { x: 5, y: 0, z: -5 },
    { x: 5, y: 0, z: 5 },
    { x: -5, y: 0, z: 5 }
  ];
  const W = 40;

  it('passive diagonal = 0; active diagonal sum share * SKL', () => {
    const cog = solveCoGMomentEquilibrium(lugs, { x: 0, z: 0 }, W);
    const dnv = applyDNV4LegSkewRule(lugs, cog, DNV_4LEG.SKL_DEFAULT);
    const zeros = [dnv[0], dnv[1], dnv[2], dnv[3]].filter((v) => v === 0);
    expect(zeros.length).toBe(2);
    const active = [dnv[0], dnv[1], dnv[2], dnv[3]].filter((v) => v > 0);
    expect(active.length).toBe(2);
    expect(active[0] * W).toBeGreaterThan(20);
    expect(active[0] * W).toBeCloseTo(25, 1); // 0.5 * 1.25 * 40
  });

  it('SKL=1.5 pushes active leg to 30t vertical share', () => {
    const cog = solveCoGMomentEquilibrium(lugs, { x: 0, z: 0 }, W);
    const dnv = applyDNV4LegSkewRule(lugs, cog, 1.5);
    const peak = Math.max(dnv[0], dnv[1], dnv[2], dnv[3]) * W;
    expect(peak).toBeCloseTo(30, 1);
  });
});

describe('3-Zone WLL/SWL/MBL', () => {
  const SWL = 10;
  const MBL = 50;

  it('Zone1 safe, Zone2 overload (no snap), Zone3 snap at MBL', () => {
    expect(evaluateZone(5, SWL, MBL).zone).toBe(ZONE.SAFE);
    expect(evaluateZone(15, SWL, MBL).zone).toBe(ZONE.OVERLOAD);
    expect(evaluateZone(50, SWL, MBL).zone).toBe(ZONE.SNAP);
  });

  it('cascade applies Kdyn≥2 and can secondary-snap', () => {
    const results = cascadeFailure(
      { id: 'L0', T_actual: 30 },
      [
        { id: 'L1', T_actual: 20, SWL_effective: 10, MBL: 25 },
        { id: 'L2', T_actual: 20, SWL_effective: 10, MBL: 25 }
      ],
      CASCADE_SHOCK
    );
    expect(CASCADE_SHOCK).toBeGreaterThanOrEqual(2);
    expect(results.every((r) => r.alsoSnapped)).toBe(true);
  });
});

describe('evaluate() integration on phy.rigging', () => {
  it('writes topology, hitch, zones without requiring DOM', () => {
    const phy = {
      cables: [
        {
          role: 'leg', index: 0, L0: 4, tensionT: 6,
          a: { kind: 'hook' }, b: { kind: 'cargo' }
        },
        {
          role: 'leg', index: 1, L0: 4, tensionT: 6,
          a: { kind: 'hook' }, b: { kind: 'cargo' }
        },
        {
          role: 'leg', index: 2, L0: 4, tensionT: 6,
          a: { kind: 'hook' }, b: { kind: 'cargo' }
        },
        {
          role: 'leg', index: 3, L0: 4, tensionT: 6,
          a: { kind: 'hook' }, b: { kind: 'cargo' }
        }
      ],
      groundClearance: 1.2,
      cargoPos: { x: 0, y: 2, z: 0 },
      hookVel: { y: 0 },
      effectiveCargoWeightT: 40
    };
    const state = {
      beamType: 'none',
      weight: 40,
      cogX: 0, cogY: 0, cogZ: 0,
      poseLock: false,
      rigSolver: { enabled: true, hitch: 'Vertical', skl: 1.25 },
      gear: { legs: [{ sf: 5 }, { sf: 5 }, { sf: 5 }, { sf: 5 }] }
    };
    const pts = [
      [{ x: 0, y: 6, z: 0 }, { x: -2, y: 2, z: -2 }],
      [{ x: 0, y: 6, z: 0 }, { x: 2, y: 2, z: -2 }],
      [{ x: 0, y: 6, z: 0 }, { x: 2, y: 2, z: 2 }],
      [{ x: 0, y: 6, z: 0 }, { x: -2, y: 2, z: 2 }]
    ];
    evaluate(phy, state, {
      legSwl: () => 30,
      cableIsBroken: () => false,
      attachWorld: (end) => {
        const i = phy.cables.findIndex((c) => c.a === end || c.b === end);
        const pair = pts[Math.max(0, i)];
        const p = end === phy.cables[i].a ? pair[0] : pair[1];
        return {
          x: p.x, y: p.y, z: p.z,
          distanceTo(o) {
            return Math.hypot(this.x - o.x, this.y - o.y, this.z - o.z);
          }
        };
      }
    });
    expect(phy.rigging.topology).toBe(TOPOLOGY.MULTI_LEG);
    expect(phy.rigging.hitchFactor).toBe(1);
    expect(phy.rigging.legs).toHaveLength(4);
    expect(phy.rigging.dnvNotice).toBeTruthy();
    expect(phy.rigging.overallZone).toBeGreaterThanOrEqual(ZONE.SAFE);
    // Angles ~45° → not CRITICAL
    expect(phy.rigging.minAngleDeg).toBeGreaterThan(ANGLE_THRESHOLDS.CRITICAL_MAX - 1);
  });

  it('Zone 2 overload does not call breakCable; Zone 3 does', () => {
    let breaks = 0;
    const cable = {
      role: 'leg', index: 0, L0: 2, tensionT: 12,
      a: {}, b: {}
    };
    const phy = {
      cables: [cable],
      groundClearance: 1,
      cargoPos: { x: 0, y: 3, z: 0 },
      hookVel: { y: 0 },
      effectiveCargoWeightT: 10
    };
    const state = {
      beamType: 'none',
      weight: 10,
      poseLock: false,
      rigSolver: { enabled: true, hitch: 'Vertical' },
      gear: { legs: [{ sf: 5 }] }
    };
    evaluate(phy, state, {
      legSwl: () => 10, // SWL=10, MBL=50; T=12 → OVERLOAD
      cableIsBroken: () => false,
      breakCable: () => { breaks += 1; },
      attachWorld: (end) => ({
        x: 0, y: end === cable.a ? 5 : 2, z: 0,
        distanceTo(o) { return Math.abs(this.y - o.y); }
      })
    });
    expect(phy.rigging.overallZone).toBe(ZONE.OVERLOAD);
    expect(breaks).toBe(0);

    cable.tensionT = 55; // ≥ MBL 50
    evaluate(phy, state, {
      legSwl: () => 10,
      cableIsBroken: () => false,
      breakCable: () => { breaks += 1; },
      attachWorld: (end) => ({
        x: 0, y: end === cable.a ? 5 : 2, z: 0,
        distanceTo(o) { return Math.abs(this.y - o.y); }
      })
    });
    expect(phy.rigging.overallZone).toBe(ZONE.SNAP);
    expect(breaks).toBeGreaterThanOrEqual(1);
  });
});
