// @purpose: Kiểm thử Vàng 3 trụ cột: Va chạm CCD & Ma sát, Cẩu 20 tấn lệch tâm + Cắt cáp quật XPBD, và Vật liệu PBR Ứng suất
import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { createHeadlessSim } from './sim_test_harness.js';
import {
  applyMaterialCoulombContact,
  computeMassScaledRestitution,
  resolveInterCableCapsuleCollisions,
  resolveSweptSphereObbCCD
} from '../src/rigging/CollisionMaterialSolver.js';
import { BrokenCableWhipSimulator } from '../src/rigging/BrokenCableWhipXPBD.js';
import {
  computeAsymmetricRiggingTorque,
  computeEccentricInertiaTensor,
  stepDetachedBodyUnderGravity
} from '../src/rigging/RigidInertialDynamics.js';
import { PBRMaterialFactory } from '../src/graphics/PBRMaterialFactory.js';
import {
  computeMechanicalStressVisual,
  resolveStressTintedMaterial
} from '../src/graphics/pbr/StressPBRMaterials.js';

describe('PILLAR 1 — Absolute CCD Collision, Material Friction & Mass-Scaled Restitution', () => {
  it('prevents high-speed swept tunneling against container OBB and quay ground', () => {
    const obb = [{
      center: new THREE.Vector3(0, 1.3, 0),
      half: new THREE.Vector3(3.0, 1.3, 1.22),
      quat: new THREE.Quaternion()
    }];
    const hit = resolveSweptSphereObbCCD(
      new THREE.Vector3(0, 3.2, 0),
      new THREE.Vector3(0, 1.1, 0),
      0.04,
      obb,
      0
    );
    expect(hit.collided).toBe(true);
    expect(hit.position.y).toBeGreaterThanOrEqual(2.639);
  });

  it('gives 20-ton steel cargo near-zero bounce (e <= 0.02) and forged shackle light metallic bounce', () => {
    const heavy = computeMassScaledRestitution('steel_on_concrete', 20_000, 6.0, 1 / 60);
    const shackle = computeMassScaledRestitution('steel_on_steel', 12, 4.0, 1 / 60);
    expect(heavy.restitution).toBeLessThanOrEqual(0.02);
    expect(heavy.impactForceN).toBeGreaterThan(5_000_000);
    expect(shackle.restitution).toBeGreaterThanOrEqual(0.14);
    expect(shackle.restitution).toBeLessThanOrEqual(0.22);
  });

  it('stops a dropped steel beam via gravity + Coulomb friction with zero floating', () => {
    const beam = {
      position: new THREE.Vector3(0, 2.0, 0),
      quaternion: new THREE.Quaternion().setFromEuler(new THREE.Euler(0, 0, THREE.MathUtils.degToRad(18))),
      velocity: new THREE.Vector3(1.8, 0, 0),
      omega: new THREE.Vector3(),
      massKg: 1800,
      halfX: 2.0,
      halfY: 0.25,
      halfZ: 0.25
    };
    for (let f = 0; f < 300; f++) {
      stepDetachedBodyUnderGravity(beam, 1 / 60, { groundY: 0, pairId: 'steel_on_concrete' });
    }
    expect(beam.grounded).toBe(true);
    expect(beam.position.y).toBeLessThan(0.5);
    expect(beam.velocity.length()).toBeLessThan(0.2);

    const stick = applyMaterialCoulombContact(new THREE.Vector3(0.15, -2.0, 0), new THREE.Vector3(0, 1, 0), 'steel_on_steel', 500, 1 / 60);
    expect(stick.sticking).toBe(true);
  });

  it('prevents two crossing dynamic chains from passing through each other', () => {
    const chainA = [new THREE.Vector3(-1.5, 4, 0), new THREE.Vector3(0, 3.2, 0), new THREE.Vector3(1.5, 4, 0)];
    const chainB = [new THREE.Vector3(0, 4, -1.5), new THREE.Vector3(0, 3.2, 0), new THREE.Vector3(0, 4, 1.5)];
    const sep = resolveInterCableCapsuleCollisions([chainA, chainB], [0.025, 0.025], 3);
    expect(sep).toBeGreaterThan(0);
    expect(chainA[1].distanceTo(chainB[1])).toBeGreaterThanOrEqual(0.049);
  });
});

describe('PILLAR 2 — 20-Ton Asymmetric Lift, Cable Cut Whip & True Gravity', () => {
  it('computes eccentric Steiner-Huygens inertia tensor and asymmetric tipping torque', () => {
    const inertia = computeEccentricInertiaTensor(20_000, { L: 6.0, W: 2.44, H: 2.59 }, { x: 0.85, y: 0.1, z: 0 });
    expect(inertia.ixy).toBeLessThan(0);
    expect(inertia.iyy).toBeGreaterThan(0);

    const anchors = [
      new THREE.Vector3(2.8, 2.5, 1.1),
      new THREE.Vector3(-2.8, 2.5, 1.1),
      new THREE.Vector3(-2.8, 2.5, -1.1),
      new THREE.Vector3(2.8, 2.5, -1.1)
    ];
    const torque = computeAsymmetricRiggingTorque({
      anchorPointsWorld: anchors,
      tensionsN: [0, 65_000, 65_000, 65_000], // Leg 0 snapped
      pullTargetWorld: new THREE.Vector3(0, 7, 0),
      cogWorld: new THREE.Vector3(0.85, 1.2, 0),
      massKg: 20_000,
      inertia
    });
    expect(torque.torqueMagnitudeNm).toBeGreaterThan(10_000);
    expect(torque.angularAccel.length()).toBeGreaterThan(0.05);
  });

  it('demonstrates asymmetric 20-ton lift, cable cut whip recoil, tumbling & ground collision in headless sim', () => {
    const sim = createHeadlessSim();
    const state = sim.getState();
    const phy = sim.getPhy();
    state.cargoType = 'container';
    state.L = 6.058;
    state.W = 2.438;
    state.H = 2.591;
    state.weight = 20;
    state.cogX = -0.88;
    state.cogY = -0.09;
    state.beamType = 'spreader';
    state.gear.beam.lengthM = 5.7;
    state.upperSlingLength = 4.45;
    state.lowerSlingLength = 1.28;
    state.slingLength = 1.28;
    state.gear.legs.forEach((l) => { l.lengthM = 1.28; });
    state.gear.uppers.forEach((u) => { u.lengthM = 4.45; });
    sim.rebuildCargoAndRig(true);
    state.poseLock = false;

    phy.hookPos.set(0, 7.8, 0);
    phy.hookTarget.set(0, 10.5, 0);
    phy.autoHoistActive = true;

    for (let f = 0; f < 300; f++) sim.stepPhysicsEngine(1 / 60);
    const tiltBeforeCut = new THREE.Vector3(0, 1, 0).applyQuaternion(phy.cargoQuat).angleTo(new THREE.Vector3(0, 1, 0));
    expect(tiltBeforeCut).toBeGreaterThan(0.05);

    const whipSim = new BrokenCableWhipSimulator({ totalLengthM: 4.5, breakFraction: 0.45, diameterMm: 22, material: 'wire', segmentsPerHalf: 10 });
    const snap = whipSim.triggerSnap(new THREE.Vector3(0, 10, 0), new THREE.Vector3(2.8, 6.8, 1.1), 110_000);
    expect(snap.recoilSpeedMps).toBeGreaterThan(5);
    const whipStep = whipSim.step(1 / 60, new THREE.Vector3(0, 10, 0), new THREE.Vector3(2.8, 6.8, 1.1), { groundY: 0 });
    expect(whipStep.upperPoints.length).toBe(11);

    // Cut asymmetric load-bearing legs and verify dynamic tumble + ground settle under -9.81 m/s^2
    const yBeforeCut = phy.cargoPos.y;
    state.gear.legs[0].broken = true;
    state.gear.legs[3].broken = true;
    for (let f = 0; f < 360; f++) sim.stepPhysicsEngine(1 / 60);

    expect(phy.cargoPos.y).toBeLessThan(yBeforeCut - 0.5);
    expect(phy.groundClearance).toBeLessThanOrEqual(0.25);
    expect(phy.groundClearance).toBeGreaterThanOrEqual(-0.08);
  });
});

describe('PILLAR 3 — Photorealistic PBR Material Maps & Mechanical Stress Visualization', () => {
  it('builds industrial painted steel & forged shackle PBR materials with correct Three.js colorSpaces', () => {
    const factory = new PBRMaterialFactory(null);
    const beamMat = factory.createPaintedSteelBeamMaterial('#eab308');
    const shackleMat = factory.createForgedShackleMaterial();

    expect(beamMat).toBeInstanceOf(THREE.MeshPhysicalMaterial);
    expect(beamMat.map.colorSpace).toBe(THREE.SRGBColorSpace);
    expect(beamMat.normalMap.colorSpace).toBe(THREE.NoColorSpace);
    expect(beamMat.roughnessMap.colorSpace).toBe(THREE.NoColorSpace);
    expect(beamMat.metalnessMap.colorSpace).toBe(THREE.NoColorSpace);

    expect(shackleMat).toBeInstanceOf(THREE.MeshPhysicalMaterial);
    expect(shackleMat.metalnessMap.colorSpace).toBe(THREE.NoColorSpace);
    expect(shackleMat.clearcoat).toBeGreaterThan(0.15);
  });

  it('tints cable material cleanly across 40% (safe), 85% (amber warning) and 115% (red overload) SWL', () => {
    const base = new THREE.MeshPhysicalMaterial({ color: 0x3e4554, metalness: 0.88, roughness: 0.32 });
    const cache = new Map();

    expect(computeMechanicalStressVisual(6, 15).zone).toBe('safe');
    expect(resolveStressTintedMaterial(base, 6, 15, cache)).toBe(base);

    const warn = resolveStressTintedMaterial(base, 12.75, 15, cache);
    expect(warn).not.toBe(base);
    expect(warn.emissiveIntensity).toBeGreaterThan(0.1);

    const over = resolveStressTintedMaterial(base, 17.25, 15, cache);
    expect(over.color.r).toBeGreaterThan(0.6);
    expect(over.emissiveIntensity).toBeGreaterThan(0.4);
  });
});
