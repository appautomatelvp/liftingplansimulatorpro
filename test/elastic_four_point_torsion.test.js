import { describe, expect, it } from 'vitest';
import {
  computeCableAxialStiffness,
  computeXpbdCableCompliance,
  solveElasticFourPointDistribution
} from '../src/rigging/ElasticFourPointSolver.js';
import { resolveFourLegDiagonalLoad } from '../src/rigging/DnvFourPointLift.js';
import { createHeadlessSim } from './sim_test_harness.js';

describe('Elastic 4-Point Lift Distribution (EA + Saint-Venant GJ Torsion)', () => {
  it('distributes unequal non-zero load across all 4 legs when beam torsion & cable EA are active', () => {
    const res = resolveFourLegDiagonalLoad({
      totalLoadT: 40,
      legLengthsM: [4.0, 4.018, 4.0, 4.018],
      beamGJ: 2.6e7,
      cableEA: 2.2e7,
      beamSpanM: 6.0,
      lugWidthM: 2.4
    });
    expect(res.elasticTorsionActive).toBe(true);
    const [a0, a1] = res.activeDiagonal;
    const [p0, p1] = res.passiveDiagonal;
    // Shorter diagonal carries heavier load, longer diagonal still carries real non-zero tension (never forced 0)
    expect(res.tensionsT[a0]).toBeGreaterThan(res.tensionsT[p0]);
    expect(res.tensionsT[a1]).toBeGreaterThan(res.tensionsT[p1]);
    expect(res.tensionsT[p0]).toBeGreaterThan(3.0);
    expect(res.tensionsT[p1]).toBeGreaterThan(3.0);
    const sumT = res.tensionsT.reduce((s, v) => s + v, 0);
    expect(sumT).toBeCloseTo(40.0, 1);
  });

  it('varies tension split organically with beam torsional stiffness GJ (never hardcoded)', () => {
    const softBeam = solveElasticFourPointDistribution({
      totalLoadT: 20,
      legLengthsM: [4.0, 4.015, 4.0, 4.015],
      beamGJ: 8.0e6,
      cableEA: 2.0e7
    });
    const stiffBeam = solveElasticFourPointDistribution({
      totalLoadT: 20,
      legLengthsM: [4.0, 4.015, 4.0, 4.015],
      beamGJ: 1.6e8,
      cableEA: 8.0e7
    });
    // Softer beam twists easier, letting secondary diagonal bear a larger share
    expect(softBeam.shares[1]).toBeGreaterThan(stiffBeam.shares[1]);
    expect(stiffBeam.heavyPairSharePct).toBeGreaterThan(softBeam.heavyPairSharePct);
  });

  it('computes bounded XPBD compliance alpha from cable material EA and beam torsion GJ', () => {
    const wireStiff = computeCableAxialStiffness({ material: 'wire', diameterMm: 22, lengthM: 4.0 });
    const webStiff = computeCableAxialStiffness({ material: 'web', diameterMm: 22, lengthM: 4.0 });
    expect(wireStiff.eaN).toBeGreaterThan(webStiff.eaN);

    const alphaWire = computeXpbdCableCompliance({ role: 'leg', index: 0, L0: 4.0 }, { beamType: 'spreader', beamLength: 6.0, slingType: 'wire' }, 1 / 60);
    const alphaWeb = computeXpbdCableCompliance({ role: 'leg', index: 0, L0: 4.0 }, { beamType: 'spreader', beamLength: 6.0, slingType: 'web' }, 1 / 60);
    expect(alphaWire).toBeGreaterThan(0);
    expect(alphaWeb).toBeGreaterThan(alphaWire);
  });

  it('resolves non-zero elastic tensions across all 4 taut legs in live headless XPBD lifting', () => {
    const sim = createHeadlessSim();
    const st = sim.getState();
    const phy = sim.getPhy();
    st.weight = 24;
    st.beamType = 'spreader';
    sim.rebuildCargoAndRig(false);
    // Tiny realistic 6mm tolerance on leg 1 & 3
    if (phy.cables) {
      phy.cables.filter((c) => c.role === 'leg').forEach((c, idx) => {
        if (idx === 1 || idx === 3) c.L0 += 0.006;
      });
    }
    sim.testLift(1.2, 600);
    sim.stepSim(60);
    const tautCount = phy.legTensions.slice(0, 4).filter((t) => t > 0.5).length;
    expect(tautCount).toBeGreaterThanOrEqual(4);
  });
});
