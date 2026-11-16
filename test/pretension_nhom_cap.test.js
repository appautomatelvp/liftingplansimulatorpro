// @purpose: Kiểm thử vàng nút Nhớm Cáp (pretensionRig): kiện chạm đất 0.00m và toàn bộ hệ cáp căng đúng chiều dài thực
import { describe, expect, it } from 'vitest';
import { createHeadlessSim } from './sim_test_harness.js';

function assertAllCablesTautGrounded(sim, s, phy, expectedCargoBaseY, label = '') {
  expect(phy.groundClearance).toBe(0);
  expect(s.poseLock).toBe(true);
  expect(phy.cargoPos.y).toBeCloseTo(expectedCargoBaseY, 3);
  expect(phy.cables.length).toBeGreaterThan(0);

  for (const c of phy.cables) {
    if (c.role === 'extra') continue;
    const span = sim.attachWorld(c.a).distanceTo(sim.attachWorld(c.b));
    const pA = sim.attachWorld(c.a);
    const pB = sim.attachWorld(c.b);
    expect(c.slack, `${label} role=${c.role}#${c.index} span=${span.toFixed(3)} L0=${c.L0.toFixed(3)} pA=(${pA.x.toFixed(2)},${pA.y.toFixed(2)},${pA.z.toFixed(2)}) pB=(${pB.x.toFixed(2)},${pB.y.toFixed(2)},${pB.z.toFixed(2)}) bY=${phy.beams[0]?.x.y.toFixed(2)}`).toBe(false);
    expect(span, `${label} role=${c.role}#${c.index}`).toBeGreaterThanOrEqual(c.L0 - 0.025);
    expect(span, `${label} role=${c.role}#${c.index}`).toBeLessThanOrEqual(c.L0 + 0.025);
    expect(c.tensionT).toBeGreaterThan(0.05);
  }
}

describe('Nhớm Cáp (pretensionRig) — Grounded Cargo + Full Real-Length Taut Rigging', () => {
  it('1. Pulls hook and spreader up from Hạ đất slack pose until all cables are taut while cargo remains on ground', () => {
    const sim = createHeadlessSim();
    const s = sim.getState();
    const phy = sim.getPhy();

    const topologies = [
      { beamType: 'none' },
      { beamType: 'spreader' },
      { beamType: 'frame' },
      { beamType: 'lifting_beam', topMode: 'bridle2', bottomMode: 'cable' },
      { beamType: 'lifting_beam', topMode: 'direct_hook', bottomMode: 'cable' },
      { beamType: 'lifting_beam', topMode: 'bridle2', bottomMode: 'direct' },
      { beamType: 'lifting_beam', topMode: 'direct_hook', bottomMode: 'direct' },
      { beamType: 'basket' },
      { beamType: 'inline4' },
      { beamType: 'container_spreader', stsAttachMode: 'cable' },
      { beamType: 'container_spreader', stsAttachMode: 'direct' }
    ];

    for (const tc of topologies) {
      s.cargoType = 'iso40';
      s.L = 12.192;
      s.W = 2.438;
      s.H = 2.591;
      s.weight = 24;
      s.beamType = tc.beamType;
      if (tc.topMode) s.liftingBeamTopMode = tc.topMode;
      if (tc.bottomMode) s.liftingBeamBottomMode = tc.bottomMode;
      if (tc.stsAttachMode) s.stsAttachMode = tc.stsAttachMode;
      s.upperSlingLength = 8.0;
      s.lowerSlingLength = 2.0;
      s.slingLength = 8.0;
      s.slingUserSet = false;
      sim.rebuildCargoAndRig(true);

      // Simulate pressing Hạ đất while seated (makes ropes slack & drops hook/beam down)
      globalThis.finishSmoothSetDown();
      sim.stepSim(10);
      const slackHookY = phy.hookPos.y;

      // Press Nhớm Cáp!
      globalThis.pretensionRig();
      sim.stepSim(30);

      assertAllCablesTautGrounded(sim, s, phy, s.H * 0.5, JSON.stringify(tc));

      if (tc.beamType !== 'container_spreader' && tc.bottomMode !== 'direct') {
        if (tc.beamType !== 'none' && phy.beams[0]) {
          expect(phy.beams[0].x.y).toBeGreaterThan(s.H + 0.5);
        }
      }

      // Repeat click must be strictly idempotent (never drift or launch upward)
      const firstHookY = phy.hookPos.y;
      globalThis.pretensionRig();
      sim.stepSim(15);
      expect(Math.abs(phy.hookPos.y - firstHookY)).toBeLessThan(0.01);
    }
  });

  it('2. Recovers from manual hook-down slack and transitions smoothly into a clean lift', () => {
    const sim = createHeadlessSim();
    const s = sim.getState();
    const phy = sim.getPhy();

    s.cargoType = 'iso40';
    s.L = 12.192;
    s.W = 2.438;
    s.H = 2.591;
    s.weight = 24;
    s.beamType = 'lifting_beam';
    s.liftingBeamTopMode = 'bridle2';
    s.liftingBeamBottomMode = 'cable';
    s.slingUserSet = true;
    s.upperSlingLength = 8.0;
    s.lowerSlingLength = 2.0;
    sim.rebuildCargoAndRig(true);

    // Manually drop hook low so cables go visibly slack
    phy.hookPos.y = 4.2;
    phy.hookTarget.y = 4.2;
    sim.stepSim(20);
    expect(phy.cables.some((c) => c.slack)).toBe(true);

    // Press Nhớm Cáp -> must raise hook & H-beam up to real 8m + 2m taut pose (not shrink L0!)
    globalThis.pretensionRig();
    sim.stepSim(20);

    assertAllCablesTautGrounded(sim, s, phy, s.H * 0.5);
    const upper = phy.cables.find((c) => c.role === 'upper');
    const leg = phy.cables.find((c) => c.role === 'leg');
    expect(upper.L0).toBeGreaterThan(6.5);
    expect(leg.L0).toBeGreaterThan(1.5);
    expect(phy.hookPos.y).toBeGreaterThan(9.0);

    // Subsequent trial lift climbs smoothly without snapping
    s.poseLock = false;
    sim.testLift(1.0, 900);
    sim.stepSim(30);
    expect(phy.cargoPos.y).toBeGreaterThan(s.H * 0.5 + 0.5);
    expect(phy.cables.every((c) => !s.gear?.legs?.[c.index]?.broken)).toBe(true);
  });
});
