import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { createHeadlessSim } from './sim_test_harness.js';

function makeFlatRack() {
    const sim = createHeadlessSim();
    const state = sim.getState();
    const phy = sim.getPhy();
    state.cargoType = 'flatrack';
    state.L = 12.2;
    state.W = 2.44;
    state.H = 2.59;
    state.weight = 22;
    state.oogHasCargo = true;
    sim.rebuildCargoAndRig(true);
    state.poseLock = false;
    return { sim, state, phy };
}

function pointInsideObb(point, box) {
    const local = point.clone().sub(box.center).applyQuaternion(box.quat.clone().invert());
    return Math.abs(local.x) < box.half.x - 0.002 &&
        Math.abs(local.y) < box.half.y - 0.002 &&
        Math.abs(local.z) < box.half.z - 0.002;
}

describe('SOLID COLLISION AND SETTLING — compound Flat Rack and ground contacts', () => {
    it('separates an OOG box from the Flat Rack deck/end-wall compound collider', () => {
        const { sim, phy } = makeFlatRack();
        // Start deliberately overlapping the deck.  The real runtime contact
        // solver, not a standalone toy world, must expel the overlap.
        phy.cargoPos.set(0, 3.0, 0);
        sim.setOogFreeBody({
            position: new THREE.Vector3(0, 3.0, 0),
            quaternion: new THREE.Quaternion(),
            velocity: new THREE.Vector3()
        });
        for (let frame = 0; frame < 90; frame++) sim.stepFlatRackPayloadPhysics(1 / 60);

        const boxes = sim.getFlatRackSolidBoxesWorld();
        const corners = sim.getOogWorldCorners();
        const penetrations = corners.filter(corner => boxes.some(box => pointInsideObb(corner, box)));

        expect(penetrations).toHaveLength(0);
        expect(phy.oogState.lastCompoundPenetration || 0).toBeLessThan(0.01);
    });

    it('uses gravity torque to settle an unsupported tilted OOG box onto the ground', () => {
        const { sim, phy } = makeFlatRack();
        const halfY = sim.getCargoVisual().getObjectByName('flatRackOogCargo').userData.oogMeta.half.hy;
        sim.setOogFreeBody({
            position: new THREE.Vector3(0, sim.getSupportY(0, 0) + halfY + 2.2, 0),
            quaternion: new THREE.Quaternion().setFromEuler(new THREE.Euler(0, 0, THREE.MathUtils.degToRad(32))),
            velocity: new THREE.Vector3(0, -0.4, 0)
        });

        for (let frame = 0; frame < 720; frame++) sim.stepFlatRackPayloadPhysics(1 / 60);

        const up = new THREE.Vector3(0, 1, 0).applyQuaternion(phy.oogState.worldQuat);
        const tiltDeg = THREE.MathUtils.radToDeg(Math.acos(THREE.MathUtils.clamp(Math.abs(up.y), 0, 1)));
        const minGap = Math.min(...sim.getOogWorldCorners().map(corner => corner.y - sim.getSupportY(corner.x, corner.z)));

        expect(phy.oogState.status).toBe('grounded');
        expect(minGap).toBeGreaterThanOrEqual(-0.003);
        // A rectangular load can rest flat (0 deg) or on a structural side
        // (90 deg), but may not stop in an unsupported in-between pose.
        expect(Math.min(tiltDeg, Math.abs(90 - tiltDeg))).toBeLessThan(3.0);
    });
});
