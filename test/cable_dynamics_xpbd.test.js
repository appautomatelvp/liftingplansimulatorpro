import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { CableDynamicsXPBD } from '../src/rigging/CableDynamicsXPBD.js';
import { BrokenCableWhipSimulator } from '../src/rigging/BrokenCableWhipXPBD.js';
import { resolveInterCableCapsuleCollisions } from '../src/rigging/CollisionMaterialSolver.js';

const endpointA = new THREE.Vector3(0, 10, 0);
const endpointB = new THREE.Vector3(5, 10, 0);

function settle(cable, frames = 480, collide) {
  cable.reset(endpointA, endpointB);
  for (let i = 0; i < frames; i++) cable.step(1 / 60, endpointA, endpointB, { collide, iterations: 12 });
  return cable.positions;
}

describe('XPBD cable dynamics and morphology', () => {
  it('preserves cable length and makes the freely articulated chain hang below a stiff wire rope', () => {
    const wire = new CableDynamicsXPBD({ lengthM: 10, diameterMm: 16, material: 'wire', segments: 32 });
    const chain = new CableDynamicsXPBD({ lengthM: 10, diameterMm: 16, material: 'chain', segments: 32 });
    const wirePoints = settle(wire);
    const chainPoints = settle(chain);
    const wireLow = Math.min(...wirePoints.map((point) => point.y));
    const chainLow = Math.min(...chainPoints.map((point) => point.y));

    expect(wire.getArcLength()).toBeCloseTo(10, 1);
    expect(chain.getArcLength()).toBeCloseTo(10, 1);
    expect(chainLow).toBeLessThan(wireLow - 0.04);
  });

  it('releases stored elastic energy as recoil when tension exceeds the breaking load', () => {
    const cable = new CableDynamicsXPBD({ lengthM: 5, diameterMm: 22, material: 'wire', segments: 24 });
    cable.reset(new THREE.Vector3(0, 8, 0), new THREE.Vector3(5, 8, 0));
    const intact = cable.breakAt(0, 350_000, 400_000);
    expect(intact.broken).toBe(false);

    const result = cable.breakAt(0, 500_000, 400_000);
    expect(result.broken).toBe(true);
    expect(result.storedElasticEnergyJ).toBeGreaterThan(0);
    expect(result.recoilSpeedMps).toBeGreaterThan(1);
    expect(cable.nodeVelocity(0).x).toBeLessThan(-1);
    expect(cable.brokenSegment).toBe(0);
  });

  it('keeps particles above ground and preserves arc length while slack', () => {
    const cable = new CableDynamicsXPBD({ lengthM: 10, diameterMm: 16, material: 'chain', segments: 40 });
    const a = new THREE.Vector3(0, 4, 0);
    const b = new THREE.Vector3(6, 4, 0);
    cable.reset(a, b);
    const collide = (point) => { point.y = Math.max(point.y, cable.radiusM); };
    for (let i = 0; i < 480; i++) cable.step(1 / 60, a, b, { collide, iterations: 12 });

    expect(Math.min(...cable.positions.map((point) => point.y))).toBeGreaterThanOrEqual(cable.radiusM - 1e-6);
    expect(cable.getArcLength()).toBeGreaterThan(9.9);
    expect(cable.getArcLength()).toBeLessThan(10.1);
  });

  it('separates non-neighboring cable nodes that overlap', () => {
    const cable = new CableDynamicsXPBD({ lengthM: 8, diameterMm: 20, material: 'chain', segments: 16 });
    cable.reset(new THREE.Vector3(0, 4, 0), new THREE.Vector3(8, 4, 0));
    cable.positions[5].copy(cable.positions[0]);

    cable._projectSelfCollision();

    expect(cable.positions[5].distanceTo(cable.positions[0])).toBeGreaterThanOrEqual(cable.radiusM * 2 - 1e-6);
  });

  it('drops an unpinned detached cable immediately under -9.81 m/s^2 gravity', () => {
    const cable = new CableDynamicsXPBD({ lengthM: 4, diameterMm: 18, material: 'wire', segments: 12 });
    const a = new THREE.Vector3(0, 6, 0);
    const b = new THREE.Vector3(3, 6, 0);
    cable.reset(a, b);
    cable.setPins(false, false);

    for (let i = 0; i < 40; i++) cable.step(1 / 60, a, b, { iterations: 8 });
    const maxY = Math.max(...cable.positions.map((p) => p.y));
    expect(maxY).toBeLessThan(4.5);
  });

  it('simulates high-tension XPBD snap whip recoil and settles without ground penetration', () => {
    const sim = new BrokenCableWhipSimulator({ totalLengthM: 6, breakFraction: 0.5, diameterMm: 22, material: 'wire', segmentsPerHalf: 10 });
    const anchorA = new THREE.Vector3(0, 5, 0);
    const anchorB = new THREE.Vector3(0, 1.2, 0);
    const snap = sim.triggerSnap(anchorA, anchorB, 180_000);
    expect(snap.recoilSpeedMps).toBeGreaterThan(5);

    const obbBoxes = [{
      center: new THREE.Vector3(0, 0.5, 0),
      half: new THREE.Vector3(1.5, 0.5, 1.5),
      quat: new THREE.Quaternion()
    }];
    let latest;
    for (let f = 0; f < 90; f++) {
      latest = sim.step(1 / 60, anchorA, anchorB, { obbBoxes, groundY: 0, pairId: 'steel_on_steel' });
    }
    const allPts = [...latest.upperPoints, ...latest.lowerPoints];
    const minY = Math.min(...allPts.map((p) => p.y));
    expect(minY).toBeGreaterThanOrEqual(sim.radiusM - 1e-3);
  });

  it('separates two swinging chains via inter-cable capsule collision solver', () => {
    const chainA = [new THREE.Vector3(-2, 5, 0), new THREE.Vector3(0, 4, 0), new THREE.Vector3(2, 5, 0)];
    const chainB = [new THREE.Vector3(0, 5, -2), new THREE.Vector3(0, 4, 0), new THREE.Vector3(0, 5, 2)];
    const hits = resolveInterCableCapsuleCollisions([chainA, chainB], [0.03, 0.03], 3);
    expect(hits).toBeGreaterThan(0);
    expect(chainA[1].distanceTo(chainB[1])).toBeGreaterThanOrEqual(0.059);
  });
});
