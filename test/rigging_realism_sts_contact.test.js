// @purpose: Bộ kiểm thử vàng xác minh tiếp xúc bề mặt 3D thực (0mm khe hở), dầm chữ H, kích thước STS ISO 668/1161 và vật lý đứt cáp
import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { createHeadlessSim } from './sim_test_harness.js';
import {
  bakeCargoSurfaceField,
  conformPathToTrueCargoSurface,
  projectPointOntoTrueCargoSurface,
  sampleTrueCargoRoofY
} from '../src/rigging/TrueMeshSurfaceContact.js';
import {
  calibrateStsCadToIsoEnvelope,
  computeIsoContainerSpreaderSpec,
  solveStsDirectTwistlockPose,
  syncStsHeadblockHoistRopes
} from '../src/rigging/StsSpreaderRealism.js';
import { BrokenCableWhipSimulator } from '../src/rigging/BrokenCableWhipXPBD.js';
import { stepBrokenWhipPath } from '../src/rigging/RigidInertialDynamics.js';
import { DeformableSteelStructure } from '../src/core/DeformableSteelStructure.js';

describe('REALISM UPGRADE — 6 Industrial 3D Physics & Rigging Acceptance Tests', () => {
  it('1. Wraps chains flush onto curved 3D spherical cargo skin with zero AABB air-gap and zero penetration', () => {
    const group = new THREE.Group();
    const R = 1.5;
    const sphereMesh = new THREE.Mesh(new THREE.SphereGeometry(R, 28, 18), new THREE.MeshStandardMaterial());
    const baseSkid = new THREE.Mesh(new THREE.BoxGeometry(3.2, 0.25, 3.2), new THREE.MeshStandardMaterial());
    baseSkid.position.y = -1.5;
    group.add(sphereMesh, baseSkid);
    group.updateMatrixWorld(true);

    const dims = { L: 3.2, W: 3.2, H: 3.2 };
    const field = bakeCargoSurfaceField(group, dims, 'custom_sphere_tank');
    expect(field).not.toBeNull();
    expect(field.detectedSphere).not.toBeNull();

    const chainPad = 0.017;
    const peakY = sampleTrueCargoRoofY(0, 0, chainPad, 'custom_sphere_tank', dims, field);
    const shoulderY = sampleTrueCargoRoofY(1.1, 0, chainPad, 'custom_sphere_tank', dims, field);
    // At apex: R + pad; at x=1.1: sqrt((R+pad)^2 - 1.1^2), NOT flat H*0.5
    expect(peakY).toBeCloseTo(R + chainPad, 2);
    expect(shoulderY).toBeLessThan(peakY - 0.35);

    const tautChain = [new THREE.Vector3(-1.8, 0.2, 0), new THREE.Vector3(1.8, 0.2, 0)];
    const wrapped = conformPathToTrueCargoSurface(tautChain, chainPad, 'custom_sphere_tank', dims, field, true);
    expect(wrapped.length).toBeGreaterThan(6);
    for (let i = 1; i < wrapped.length - 1; i++) {
      const dist = wrapped[i].length();
      expect(dist).toBeGreaterThanOrEqual(R + chainPad - 0.002);
      expect(dist).toBeLessThanOrEqual(R + chainPad + 0.03);
    }

    const pushed = projectPointOntoTrueCargoSurface(new THREE.Vector3(0, 0.6, 0), chainPad, 'custom_sphere_tank', dims, field, true);
    expect(pushed.length()).toBeGreaterThanOrEqual(R + chainPad - 0.002);

    // Points 2m ABOVE any 3D cargo skin must NEVER be kicked radially outward (fixes dogleg kink below shackles)
    const boxGroup = new THREE.Group();
    boxGroup.add(new THREE.Mesh(new THREE.BoxGeometry(12.192, 2.591, 2.438), new THREE.MeshStandardMaterial()));
    const boxField = bakeCargoSurfaceField(boxGroup, { L: 12.192, W: 2.438, H: 2.591 }, 'iso40');
    const skyPt = new THREE.Vector3(4.5, 3.4, 1.09);
    const untouched = projectPointOntoTrueCargoSurface(skyPt, 0.02, 'iso40', { L: 12.192, W: 2.438, H: 2.591 }, boxField, true);
    expect(untouched.distanceTo(skyPt)).toBeLessThan(1e-6);
  });

  it('2. Bends 32-segment H-beam flanges and internal dark ribs together so ribs never protrude below bottom flange', () => {
    const beamGroup = new THREE.Group();
    const len = 10.0;
    const web = new THREE.Mesh(new THREE.BoxGeometry(len, 0.274, 0.028, 32, 1, 1));
    const topF = new THREE.Mesh(new THREE.BoxGeometry(len, 0.036, 0.24, 32, 1, 1));
    topF.position.y = 0.155;
    const botF = new THREE.Mesh(new THREE.BoxGeometry(len, 0.036, 0.24, 32, 1, 1));
    botF.position.y = -0.155;
    const midRib = new THREE.Mesh(new THREE.BoxGeometry(0.016, 0.244, 0.064));
    midRib.position.set(0, 0, 0.068);
    beamGroup.add(web, topF, botF, midRib);
    beamGroup.updateMatrixWorld(true);

    const solver = new DeformableSteelStructure(len, 2.0e-3, 1.0e-3, 200, 79.3);
    solver.applyMeshDeformation(beamGroup, 350_000, 0, 0, 3.0, 'x');

    const botFlangeBox = new THREE.Box3().setFromObject(botF);
    const midRibBox = new THREE.Box3().setFromObject(midRib);
    // Mid-span rib bottom must stay strictly inside/above the deflected bottom flange outer bottom
    expect(midRibBox.min.y).toBeGreaterThanOrEqual(botFlangeBox.min.y - 0.002);
  });

  it('3. Calibrates STS Spreader CAD outer frame to ISO 668/1161 (2.438m width) and spans 8 headblock ropes to hookPos', () => {
    const spec40 = computeIsoContainerSpreaderSpec(12.192, 2.438);
    expect(spec40.outerLength).toBeCloseTo(12.192, 3);
    expect(spec40.outerWidth).toBeCloseTo(2.438, 3);
    expect(spec40.pinSpanX).toBeCloseTo(11.985, 3);
    expect(spec40.pinSpanZ).toBeCloseTo(2.259, 3);

    const cad = new THREE.Group();
    const chassis = new THREE.Mesh(
      new THREE.BoxGeometry(15.2, 0.6, 3.35),
      new THREE.MeshStandardMaterial({ color: 0xeab308, name: 'Yellow_Frame' })
    );
    chassis.name = 'STS_Yellow_Chassis';
    const flipper = new THREE.Mesh(
      new THREE.BoxGeometry(0.4, 0.7, 0.5),
      new THREE.MeshStandardMaterial({ color: 0xdc2626, name: 'Red_Flipper' })
    );
    flipper.name = 'Guide_Flipper_Corner';
    flipper.position.set(7.6, -0.1, 1.85);
    cad.add(chassis, flipper);

    const res = calibrateStsCadToIsoEnvelope(cad, spec40);
    expect(res.outerX).toBeCloseTo(12.192, 2);
    expect(res.outerZ).toBeCloseTo(2.438, 2);

    const ropeGeo = new THREE.CylinderGeometry(0.018, 0.018, 1, 6);
    const vis = {
      block: new THREE.Mesh(new THREE.BoxGeometry(1.35, 0.28, 0.85)),
      ropes: Array.from({ length: 8 }, () => new THREE.Mesh(ropeGeo))
    };
    const hbLocals = [
      [0.42, 0.48, 0.26], [-0.42, 0.48, 0.26], [-0.42, 0.48, -0.26], [0.42, 0.48, -0.26],
      [0.56, 0.48, 0.14], [-0.56, 0.48, 0.14], [-0.56, 0.48, -0.14], [0.56, 0.48, -0.14]
    ];
    syncStsHeadblockHoistRopes(vis, new THREE.Vector3(0, 6.0, 0), new THREE.Quaternion(), new THREE.Vector3(0, 10.5, 0), hbLocals);
    expect(vis.block.position.y).toBeCloseTo(10.5, 2);
    expect(vis.ropes[0].scale.y).toBeGreaterThan(3.5);
  });

  it('4. Broken cable lower/upper stubs obey gravity without shooting red spikes into the sky', () => {
    const anchorLower = new THREE.Vector3(5.99, 2.59, 1.13);
    const cutTipStart = new THREE.Vector3(5.99, 3.85, 1.13);
    const slingObj = { numSegments: 10 };
    const br = { age: 0.016, wasTaut: true, snapTensionT: 18, upperLen: 1.2, lowerLen: 1.3, frac: 0.5 };
    const meta = { brokenHalf: 'lower', diaMm: 18 };
    let pts = null;
    for (let f = 1; f <= 45; f++) {
      br.age = f / 60;
      pts = stepBrokenWhipPath(slingObj, br, meta, anchorLower, cutTipStart, 1.3, 'chain', { L: 12.192, W: 2.438, H: 2.591 }, new THREE.Vector3(0, 1.295, 0), new THREE.Quaternion(), 0);
    }
    expect(pts).not.toBeNull();
    // Must never launch upward past the original cut tip + 0.15m
    const maxY = Math.max(...pts.map((p) => p.y));
    expect(maxY).toBeLessThan(cutTipStart.y + 0.15);
    // Gravity lowers the free cut tip over 0.75s
    expect(pts[pts.length - 1].y).toBeLessThan(cutTipStart.y - 0.15);

    const whip = new BrokenCableWhipSimulator({ totalLengthM: 2.5, diameterMm: 20, material: 'wire' });
    const stubPts = whip.stepSingleStub(new THREE.Vector3(0, 6, 0), new THREE.Vector3(0, 4.8, 0), 1.2, 1 / 60, { tensionN: 120_000 });
    expect(stubPts[0].distanceTo(stubPts[stubPts.length - 1])).toBeLessThanOrEqual(1.22);
  });

  it('5. STS direct twistlock & cable hoisting respect ground contact, eccentric tilt, and headless physics stability', () => {
    const grounded = solveStsDirectTwistlockPose({
      beamPos: new THREE.Vector3(0, 2.5, 0), // tries to sink below roof (2.591 + 0.34 = 2.931)
      cargoDims: { L: 12.192, W: 2.438, H: 2.591 },
      cogOffset: { x: -1.2, z: 0.2 },
      floorY: 0
    });
    expect(grounded.seatedOnDeck).toBe(true);
    expect(grounded.clampedBeamY).toBeCloseTo(2.591 + 0.34, 3);

    const lifted = solveStsDirectTwistlockPose({
      beamPos: new THREE.Vector3(0, 6.0, 0),
      cargoDims: { L: 12.192, W: 2.438, H: 2.591 },
      cogOffset: { x: -1.4, z: 0.3 },
      floorY: 0
    });
    expect(lifted.seatedOnDeck).toBe(false);
    expect(Math.abs(lifted.tiltPitchRad)).toBeGreaterThan(0.01);

    const sim = createHeadlessSim();
    const state = sim.getState();
    const phy = sim.getPhy();
    state.cargoType = 'iso40';
    state.L = 12.192;
    state.W = 2.438;
    state.H = 2.591;
    state.weight = 26;
    state.beamType = 'container_spreader';
    state.stsAttachMode = 'cable';
    state.lowerSlingLength = 1.8;
    sim.rebuildCargoAndRig(true);
    state.poseLock = false;
    phy.hookTarget.y += 1.5;
    for (let f = 0; f < 90; f++) sim.stepPhysicsEngine(1 / 60);
    expect(Number.isFinite(phy.cargoPos.y)).toBe(true);
    expect(state.gear.beam.lengthM).toBeCloseTo(11.985, 2);
    expect(state.gear.beam.widthM).toBeCloseTo(2.259, 2);
  });
});
