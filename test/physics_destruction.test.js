import { describe, it, expect } from 'vitest';
import { createHeadlessSim } from './sim_test_harness.js';

function makeSuspendedFlatRack(beamType = 'spreader') {
    const sim = createHeadlessSim();
    const state = sim.getState();
    const phy = sim.getPhy();
    state.cargoType = 'flatrack';
    state.L = 12.2;
    state.W = 2.44;
    state.H = 2.59;
    state.weight = 22;
    state.beamType = beamType;
    state.oogHasCargo = true;
    sim.rebuildCargoAndRig(true);
    state.poseLock = false;
    phy.cargoPos.set(0, 8.5, 0);
    phy.cargoVel.set(0, 0, 0);
    phy.cargoOmega.set(0, 0, 0);
    phy.hookPos.set(0, 15, 0);
    phy.hookTarget.copy(phy.hookPos);
    phy.autoHoistActive = false;
    return { sim, state, phy };
}

function severAll(state, roles) {
    if (roles.includes('leg')) state.gear.legs.forEach(cable => { cable.broken = true; });
    if (roles.includes('upper')) state.gear.uppers.forEach(cable => { cable.broken = true; });
}

describe('PHYSICS DESTRUCTION — graph disconnection and absolute free fall', () => {
    it('releases the Flat Rack immediately when every lower support cable is severed', () => {
        const { sim, state, phy } = makeSuspendedFlatRack('spreader');
        severAll(state, ['leg']);
        const y0 = phy.cargoPos.y;

        for (let frame = 0; frame < 45; frame++) sim.stepPhysicsEngine(1 / 60);

        expect(phy.cargoPos.y).toBeLessThan(y0 - 0.7);
        expect(phy.cargoVel.y).toBeLessThan(-4.5);
        expect(state.poseLock).toBe(false);
    });

    it('does not leave cargo supported when every upper load-path cable is severed', () => {
        const { sim, state, phy } = makeSuspendedFlatRack('spreader');
        severAll(state, ['upper']);
        const y0 = phy.cargoPos.y;

        for (let frame = 0; frame < 60; frame++) sim.stepPhysicsEngine(1 / 60);

        expect(phy.cargoPos.y).toBeLessThan(y0 - 1.1);
        expect(phy.cargoVel.y).toBeLessThan(-5.5);
    });

    it('settles a completely disconnected rigid load on the ground rather than retaining lift', () => {
        const { sim, state, phy } = makeSuspendedFlatRack('none');
        severAll(state, ['leg']);

        let peakY = phy.cargoPos.y;
        for (let frame = 0; frame < 520; frame++) {
            sim.stepPhysicsEngine(1 / 60);
            peakY = Math.max(peakY, phy.cargoPos.y);
        }

        expect(peakY).toBeLessThanOrEqual(8.56);
        expect(phy.groundClearance).toBeLessThanOrEqual(0.05);
        expect(phy.cargoVel.length()).toBeLessThan(0.9);
    });
});
