/**
 * Phase 0 characterization baseline — invariants that must hold through the strangler migration.
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { createHeadlessSim } from '../sim_test_harness.js';
import { SIM_PARTS, SIM_PARTS_HEADLESS } from '../../src/sim/manifest.js';
import fs from 'node:fs';
import path from 'node:path';

describe('Architecture characterization baseline', () => {
    it('manifest lists ordered sim parts and files exist', () => {
        expect(SIM_PARTS.length).toBeGreaterThan(10);
        const dir = path.resolve('src/sim');
        for (const file of SIM_PARTS) {
            expect(fs.existsSync(path.join(dir, file)), `missing part: ${file}`).toBe(true);
        }
    });

    it('headless subset is a subset of full assemble order', () => {
        for (const file of SIM_PARTS_HEADLESS) {
            expect(SIM_PARTS).toContain(file);
        }
    });

    describe('headless lift invariants', () => {
        let api;

        beforeAll(() => {
            api = createHeadlessSim();
        }, 60_000);

        it('boots with state, phy, and cables', () => {
            const state = api.getState();
            const phy = api.getPhy();
            expect(state).toBeTruthy();
            expect(phy).toBeTruthy();
            expect(Array.isArray(phy.cables)).toBe(true);
            expect(phy.cargoPos).toBeTruthy();
            expect(phy.hookPos).toBeTruthy();
        });

        it('getRigSpec returns a topology with lower/upper lengths', () => {
            const spec = api.getRigSpec();
            expect(spec).toBeTruthy();
            expect(Number(spec.lower) || Number(spec.topLeg) || 0).toBeGreaterThan(0);
            expect(Number.isFinite(spec.spanX)).toBe(true);
        });

        it('stepPhysicsEngine advances without throwing', () => {
            expect(() => api.stepSim(30)).not.toThrow();
            const phy = api.getPhy();
            expect(Number.isFinite(phy.cargoPos.y)).toBe(true);
            expect(Number.isFinite(phy.hookPos.y)).toBe(true);
        });

        it('supportY returns a finite ground height near origin', () => {
            const y = api.getSupportY(0, 0);
            expect(Number.isFinite(y)).toBe(true);
            expect(y).toBeLessThan(2);
        });
    });
});
