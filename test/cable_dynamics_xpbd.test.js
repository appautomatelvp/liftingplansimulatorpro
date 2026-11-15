import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { CableDynamicsXPBD } from '../src/rigging/CableDynamicsXPBD.js';

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
});
