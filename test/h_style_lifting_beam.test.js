// @purpose: Kiểm thử vàng cấu tạo H-Style Lifting Beam 4 góc và 4 tổ hợp liên kết Trên/Dưới
import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import {
  buildHStyleLiftingBeamMeshes,
  resolveHBeamCorners,
  solveHBeamDirectCoupling
} from '../src/rigging/HStyleLiftingBeam.js';
import { createHeadlessSim } from './sim_test_harness.js';

function countUserDataFlag(root, flag) {
  let count = 0;
  root.traverse((obj) => {
    if (obj.userData && obj.userData[flag]) count++;
  });
  return count;
}

describe('H-Style Lifting Beam (2 Crossbars + 4 Corners + Top/Bottom Modes)', () => {
  it('1. Builds main H-beam, 2 transverse crossbars, and switches between shackles and ISO twistlock feet', () => {
    const cargoDims = { L: 12.192, W: 2.438, H: 2.591 };
    const yellowMat = new THREE.MeshStandardMaterial();
    const darkMat = new THREE.MeshStandardMaterial();

    const cableGroup = new THREE.Group();
    const cableCalls = { lugs: 0, picks: 0, shackles: 0, twistlocks: 0 };
    const cableLayout = buildHStyleLiftingBeamMeshes({
      group: cableGroup,
      yellowMat,
      darkMat,
      spanX: 8.4,
      spanZ: 2.2,
      cargoDims,
      topMode: 'bridle2',
      bottomMode: 'cable',
      tagMesh: (m) => cableGroup.add(m),
      addLug: (x, y, z) => { cableCalls.lugs++; const m = new THREE.Group(); m.position.set(x, y, z); cableGroup.add(m); },
      addPick: (x, y, z) => { cableCalls.picks++; const m = new THREE.Group(); m.position.set(x, y, z); cableGroup.add(m); },
      addShackle: (x, y, z) => { cableCalls.shackles++; const m = new THREE.Group(); m.position.set(x, y, z); cableGroup.add(m); },
      addTwistlockFeet: (g) => { cableCalls.twistlocks++; const m = new THREE.Group(); m.userData.isTwistlockFoot = true; g.add(m); }
    });

    expect(cableLayout.halfX).toBeCloseTo(4.2, 2);
    expect(cableLayout.halfZ).toBeCloseTo(1.1, 2);
    expect(cableLayout.corners).toHaveLength(4);
    const crossbarWebs = cableGroup.children.filter(
      (c) => c.isMesh && Math.abs(Math.abs(c.position.x) - 4.2) < 0.05 && Math.abs(c.position.y - 0.124) < 0.01
    );
    expect(crossbarWebs).toHaveLength(2);
    expect(cableCalls.lugs).toBe(6); // 2 upper bridle lugs + 4 corner lower lugs
    expect(cableCalls.shackles).toBe(6); // 2 upper bridle shackles + 4 corner shackles
    expect(cableCalls.twistlocks).toBe(0);

    const directGroup = new THREE.Group();
    const directCalls = { lugs: 0, picks: 0, shackles: 0, twistlocks: 0 };
    const directLayout = buildHStyleLiftingBeamMeshes({
      group: directGroup,
      yellowMat,
      darkMat,
      spanX: 8.4,
      spanZ: 2.2,
      cargoDims,
      topMode: 'direct_hook',
      bottomMode: 'direct',
      tagMesh: (m) => directGroup.add(m),
      addLug: () => { directCalls.lugs++; },
      addPick: () => { directCalls.picks++; },
      addShackle: () => { directCalls.shackles++; },
      addTwistlockFeet: (g, hx, hz) => {
        directCalls.twistlocks++;
        const m = new THREE.Group();
        m.userData.isTwistlockFoot = true;
        m.userData.hx = hx;
        m.userData.hz = hz;
        g.add(m);
      }
    });

    expect(directLayout.spanX).toBeCloseTo(cargoDims.L - 0.207, 2);
    expect(directLayout.spanZ).toBeCloseTo(cargoDims.W - 0.179, 2);
    expect(directCalls.lugs).toBe(0);
    expect(directCalls.shackles).toBe(0);
    expect(directCalls.twistlocks).toBe(1);
    expect(countUserDataFlag(directGroup, 'isTwistlockFoot')).toBe(1);
    expect(directCalls.picks).toBe(5); // 1 center bail pick + 4 crossbar corner picks
  });

  it('2. Resolves 4 symmetric corners and solves direct twistlock coupling & ground seating', () => {
    const cableCorners = resolveHBeamCorners(7.6, 2.0, { L: 9.0, W: 2.4, H: 2.4 }, 'cable');
    expect(cableCorners.corners.map(([cx, cz]) => [Number(cx.toFixed(2)), Number(cz.toFixed(2))])).toEqual([
      [3.8, 1],
      [-3.8, 1],
      [-3.8, -1],
      [3.8, -1]
    ]);

    const grounded = solveHBeamDirectCoupling({
      beamPos: new THREE.Vector3(0, 2.4, 0),
      hookPos: new THREE.Vector3(0, 3.0, 0),
      cargoDims: { L: 12.192, W: 2.438, H: 2.591 },
      cogOffset: { x: -0.6, z: 0.1 },
      floorY: 0,
      topMode: 'direct_hook',
      bottomMode: 'direct'
    });
    expect(grounded.seatedOnDeck).toBe(true);
    expect(grounded.nextBeamY).toBeCloseTo(2.591 + 0.34, 3);
    expect(grounded.cargoY).toBeCloseTo(2.591 * 0.5, 4);

    const lifted = solveHBeamDirectCoupling({
      beamPos: new THREE.Vector3(0, 5.2, 0),
      hookPos: new THREE.Vector3(0, 5.56, 0),
      cargoDims: { L: 12.192, W: 2.438, H: 2.591 },
      cogOffset: { x: -0.6, z: 0.1 },
      floorY: 0,
      topMode: 'direct_hook',
      bottomMode: 'direct'
    });
    expect(lifted.seatedOnDeck).toBe(false);
    expect(lifted.clearance).toBeGreaterThan(1.0);
    expect(lifted.cargoY).toBeGreaterThan(2.5);
  });

  it('3. Runs all 4 Top x Bottom attachment combinations cleanly in headless physics', () => {
    const cases = [
      { topMode: 'bridle2', bottomMode: 'cable', expectedUpper: 2 },
      { topMode: 'direct_hook', bottomMode: 'cable', expectedUpper: 1 },
      { topMode: 'bridle2', bottomMode: 'direct', expectedUpper: 2 },
      { topMode: 'direct_hook', bottomMode: 'direct', expectedUpper: 1 }
    ];

    for (const tc of cases) {
      const sim = createHeadlessSim();
      const s = sim.getState();
      const phy = sim.getPhy();
      s.cargoType = 'iso40';
      s.L = 12.192;
      s.W = 2.438;
      s.H = 2.591;
      s.weight = 24;
      s.beamType = 'lifting_beam';
      s.liftingBeamTopMode = tc.topMode;
      s.liftingBeamBottomMode = tc.bottomMode;
      s.slingUserSet = false;
      sim.rebuildCargoAndRig(true);

      const uppers = phy.cables.filter((c) => c.role === 'upper');
      const legs = phy.cables.filter((c) => c.role === 'leg');
      expect(uppers).toHaveLength(tc.expectedUpper);
      expect(legs).toHaveLength(4);

      const beamX = phy.beams[0].x.x;
      const beamZ = phy.beams[0].x.z;
      if (tc.topMode === 'direct_hook') {
        expect(Math.abs(sim.attachWorld(uppers[0].b).x - beamX)).toBeLessThan(0.05);
      } else {
        const beamEndXs = uppers.map((c) => Math.abs(sim.attachWorld(c.b).x - beamX));
        expect(Math.min(...beamEndXs)).toBeGreaterThan(2.5);
      }

      // Verify the 4 lower cables attach to distinct 4 crossbar corners (±X, ±Z)
      const signs = new Set(
        legs.map((c) => {
          const p = sim.attachWorld(c.a);
          return `${Math.sign(p.x - beamX)}:${Math.sign(p.z - beamZ)}`;
        })
      );
      expect(signs.size).toBe(4);

      const legSpans = legs.map((leg) => sim.attachWorld(leg.a).distanceTo(sim.attachWorld(leg.b)));
      if (tc.bottomMode === 'direct') {
        for (const span of legSpans) expect(span).toBeLessThan(0.35);
      } else {
        for (const span of legSpans) expect(span).toBeGreaterThan(0.5);
      }

      s.poseLock = false;
      sim.testLift(1.0, 1200);
      sim.stepSim(60);

      expect(Number.isFinite(phy.cargoPos.y)).toBe(true);
      expect(
        phy.cargoPos.y,
        `combo=${tc.topMode}+${tc.bottomMode} hookY=${phy.hookPos.y.toFixed(2)} tgtY=${phy.hookTarget.y.toFixed(2)} beamY=${phy.beams[0].x.y.toFixed(2)}`
      ).toBeGreaterThan(s.H * 0.5 + 0.35);
      expect(phy.beams[0]).toBeDefined();
      expect(Number.isFinite(phy.beams[0].x.y)).toBe(true);
      expect(phy.beams[0].x.y).toBeGreaterThan(phy.cargoPos.y + s.H * 0.5);
    }
  });
});
