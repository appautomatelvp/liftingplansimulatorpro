import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import {
  buildCompoundBeamCollider,
  buildCompoundCargoCollider,
  resolveCompoundContact,
  resolveCompoundSweptContact
} from '../src/rigging/CompoundColliders.js';
import {
  applyMaterialCoulombContact,
  resolveInterCableCapsuleCollisions,
  resolveSweptSphereObbCCD
} from '../src/rigging/CollisionMaterialSolver.js';

describe('Absolute Compound Collision, CCD Zero-Penetration & Friction (Pillar 3)', () => {
  it('stops a dropped heavy spreader beam on container roof with < 1 mm penetration', () => {
    const cargoHull = buildCompoundCargoCollider({
      center: { x: 0, y: 1.3, z: 0 },
      L: 6.06,
      W: 2.44,
      H: 2.60
    });
    const makeBeam = (pos) => buildCompoundBeamCollider({
      center: pos,
      spanX: 5.8,
      beamWidth: 0.36,
      beamHeight: 0.40,
      endPlateHeight: 0.56
    });

    const hit = resolveCompoundSweptContact({
      prevPos: { x: 0, y: 3.10, z: 0 },
      nextPos: { x: 0, y: 2.45, z: 0 }, // large fast drop step that would otherwise clip into roof (roof top = 2.60)
      makeColliderA: makeBeam,
      colliderB: cargoHull,
      groundY: 0
    });
    expect(hit.collided).toBe(true);
    expect(hit.normal.y).toBeGreaterThan(0.9);

    const restHit = resolveCompoundContact(makeBeam(hit.position), cargoHull);
    expect(restHit.penetrationM).toBeLessThan(0.001); // strictly < 1 mm!
  });

  it('prevents sliding under mild tilt using Coulomb static friction and zero-bounce heavy mass damping', () => {
    const slopeRad = (8 * Math.PI) / 180;
    const normal = new THREE.Vector3(-Math.sin(slopeRad), Math.cos(slopeRad), 0).normalize();
    const incoming = new THREE.Vector3(0.05, -0.45, 0);
    const contact = applyMaterialCoulombContact(incoming, normal, 'steel_on_steel', 5000, 1 / 60);
    expect(contact.sticking).toBe(true);
    expect(contact.velocity.length()).toBeLessThan(0.05);
    expect(contact.restitution).toBeLessThanOrEqual(0.02);
  });

  it('supports compound colliders inside resolveSweptSphereObbCCD and keeps crossing chains separated', () => {
    const beamCol = buildCompoundBeamCollider({ center: { x: 0, y: 2, z: 0 }, spanX: 6 });
    const ccd = resolveSweptSphereObbCCD(new THREE.Vector3(2.85, 2.6, 0), new THREE.Vector3(2.85, 2.0, 0), 0.04, beamCol, 0);
    expect(ccd.collided).toBe(true);
    expect(ccd.position.y).toBeGreaterThan(2.2);

    const chainA = [new THREE.Vector3(-1, 2, 0), new THREE.Vector3(0, 2, 0), new THREE.Vector3(1, 2, 0)];
    const chainB = [new THREE.Vector3(0, 2, -1), new THREE.Vector3(0, 2, 0), new THREE.Vector3(0, 2, 1)];
    const seps = resolveInterCableCapsuleCollisions([chainA, chainB], [0.045, 0.045], 4);
    expect(seps).toBeGreaterThan(0);
    expect(chainA[1].distanceTo(chainB[1])).toBeGreaterThanOrEqual(0.085);
  });
});
