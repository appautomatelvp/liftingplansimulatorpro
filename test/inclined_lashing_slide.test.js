import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { createHeadlessSim } from './sim_test_harness.js';

function makeInclinedRack() {
    const sim = createHeadlessSim();
    const state = sim.getState();
    const phy = sim.getPhy();
    state.cargoType = 'flatrack';
    state.L = 12.2;
    state.W = 2.44;
    state.H = 2.59;
    state.weight = 22;
    state.oogHasCargo = true;
    state.poseLock = false;
    sim.rebuildCargoAndRig(true);
    phy.cargoPos.set(0, 8, 0);
    phy.cargoQuat.setFromEuler(new THREE.Euler(0, 0, THREE.MathUtils.degToRad(42)));
    phy.groundClearance = 4;
    return { sim, state, phy };
}

describe('INCLINED LASHING SLIDE — rupture, deck-parallel slide, solid end wall', () => {
    it('breaks a certified under-rated lashing and begins a gravity-driven deck-parallel slide', () => {
        const { sim, state, phy } = makeInclinedRack();
        // N is deliberately tiny to model a lashing already critically damaged.
        state.oogLashingMblN = 1;
        sim.stepFlatRackPayloadPhysics(1 / 60);

        expect(phy.oogState.lashing.isIntact).toBe(false);
        expect(phy.oogState.strapsBroken).toBe(true);
        expect(phy.oogState.status).toBe('sliding');

        const start = phy.oogState.localPos.clone();
        for (let frame = 0; frame < 8; frame++) sim.stepFlatRackPayloadPhysics(1 / 60);
        const moved = phy.oogState.localPos.clone().sub(start);
        const crate = sim.getCargoVisual().getObjectByName('flatRackOogCargo');

        expect(Math.hypot(moved.x, moved.z)).toBeGreaterThan(0.04);
        // Until a real edge is reached, local Y and local rotation remain
        // locked to the deck plane (normal offset = zero).
        expect(crate.position.y).toBeCloseTo(0, 5);
        expect(crate.rotation.x).toBeCloseTo(0, 5);
        expect(crate.rotation.z).toBeCloseTo(0, 5);
    });

    it('uses the compound Flat Rack end wall as a hard barrier instead of allowing a longitudinal ghost-through', () => {
        const { sim, state, phy } = makeInclinedRack();
        state.oogLashingMblN = 1;
        sim.stepFlatRackPayloadPhysics(1 / 60);
        const st = phy.oogState;
        const meta = sim.getCargoVisual().getObjectByName('flatRackOogCargo').userData.oogMeta;
        const freeSlideX = Math.max(0.40, (state.L * 0.5 - 0.20) - meta.half.hx);
        const sign = st.localVel.x >= 0 ? 1 : -1;
        st.localPos.x = sign * (freeSlideX - 0.01);
        st.localVel.x = sign * 3.0;

        for (let frame = 0; frame < 8; frame++) sim.stepFlatRackPayloadPhysics(1 / 60);

        expect(Math.abs(st.localPos.x)).toBeLessThanOrEqual(freeSlideX + 0.002);
        // No velocity may remain *into* the wall.  Gravity can legitimately
        // accelerate the crate back down the deck in the opposite direction.
        expect(st.localVel.x * sign).toBeLessThanOrEqual(0.05);
        expect(st.endWalls[sign > 0 ? 'positiveXIntact' : 'negativeXIntact']).toBe(true);
        expect(st.status).toBe('sliding');
    });
});
