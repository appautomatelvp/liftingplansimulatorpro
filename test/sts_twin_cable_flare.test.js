/**
 * Twin-lift outer-cable flare was retired (unrealistic). stsTwinCableMode is always false.
 * Twin-lift is twistlock-only (8 pins). Helpers may remain for legacy cleanup paths.
 */
import { describe, it, expect } from 'vitest';
import { createHeadlessSim } from './sim_test_harness.js';

describe('STS twin-lift (twistlock only — no outer-cable flare)', () => {
    it('stsTwinCableMode is permanently disabled', () => {
        const sim = createHeadlessSim();
        const state = sim.getState();
        expect(typeof globalThis.stsTwinCableMode).toBe('function');

        state.beamType = 'container_spreader';
        state.stsTwinLift = true;
        state.stsAttachMode = 'cable';
        expect(globalThis.stsTwinCableMode()).toBe(false);

        state.stsAttachMode = 'direct';
        expect(globalThis.stsTwinCableMode()).toBe(false);
    });

    it('applyStsAttachMode forces direct when twin-lift is on', () => {
        const sim = createHeadlessSim();
        const state = sim.getState();
        state.beamType = 'container_spreader';
        state.stsTwinLift = true;
        state.stsAttachMode = 'direct';
        expect(typeof globalThis.applyStsAttachMode).toBe('function');
        globalThis.applyStsAttachMode('cable');
        expect(state.stsAttachMode).toBe('direct');
    });

    it('flare helpers still exist but step is a no-op when mode is off', () => {
        const sim = createHeadlessSim();
        const state = sim.getState();
        const phy = sim.getPhy();
        state.beamType = 'container_spreader';
        state.stsTwinLift = true;
        state.stsAttachMode = 'cable';
        sim.rebuildCargoAndRig(true);
        if (!phy.twinCableFlare) {
            phy.twinCableFlare = { pitchA: 0, pitchB: 0, sepExtra: 0, peakSep: 0, peakPitch: 0 };
        }
        phy.twinCableFlare.pitchA = 0.4;
        phy.twinCableFlare.pitchB = 0.4;
        phy.groundClearance = 1.2;
        for (let i = 0; i < 30; i++) globalThis.stepStsTwinCableFlare(1 / 60);
        // Mode off → step clears / does not grow pry
        expect(Math.max(phy.twinCableFlare.pitchA || 0, phy.twinCableFlare.pitchB || 0)).toBeLessThan(0.05);
    });

    it('stsSizeLinked skipCargo leaves container dims when changing spreader', () => {
        const sim = createHeadlessSim();
        const state = sim.getState();
        state.beamType = 'container_spreader';
        state.stsTwinLift = false;
        state.stsSizeLinked = false;
        state.L = 12.192;
        state.W = 2.438;
        state.H = 2.591;
        state.cargoType = 'iso40';
        expect(typeof globalThis.applyStsSpreaderSize).toBe('function');
        globalThis.applyStsSpreaderSize(20, { skipCargo: true });
        expect(state.stsSizeFt).toBe(20);
        expect(state.L).toBeCloseTo(12.192, 2);
        expect(state.cargoType).toBe('iso40');
    });

    it('linked spreader size syncs matching ISO container', () => {
        const sim = createHeadlessSim();
        const state = sim.getState();
        state.beamType = 'container_spreader';
        state.stsTwinLift = false;
        state.stsSizeLinked = true;
        state.stsAttachMode = 'direct';
        globalThis.applyStsSpreaderSize(20);
        expect(state.stsSizeFt).toBe(20);
        expect(state.L).toBeCloseTo(6.058, 2);
    });

    it('cable mode keeps user spreader size when container changes class', () => {
        const sim = createHeadlessSim();
        const state = sim.getState();
        state.beamType = 'container_spreader';
        state.stsTwinLift = false;
        state.stsAttachMode = 'cable';
        state.stsSizeLinked = true; // UI may still look linked until attach forces false
        state.stsSizeFt = 40;
        state.L = 12.192;
        expect(typeof globalThis.applyStsAttachMode).toBe('function');
        globalThis.applyStsAttachMode('cable');
        expect(state.stsSizeLinked).toBe(false);
        globalThis.applyStsSpreaderSize(40, { skipCargo: true });
        expect(state.stsSizeFt).toBe(40);
        // Shrink cargo to 20ft — resolve must not rewrite stsSizeFt in cable mode
        state.L = 6.058;
        state.W = 2.438;
        state.H = 2.591;
        const fit = globalThis.resolveStsFitToCargo();
        expect(state.stsSizeFt).toBe(40);
        expect(fit.ft).toBe(40);
        expect(fit.independent).toBe(true);
        expect(fit.outerL).toBeCloseTo(12.192, 2);
    });
});
