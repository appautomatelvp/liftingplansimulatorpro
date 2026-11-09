/**
 * Destructive rigging integration tests.
 * These exercise the production Cannon world and its live load-bearing graph;
 * no replacement/mock physics engine is used here.
 */
import { describe, test, expect } from 'vitest';
import { RiggingPlanner } from './src/core/RiggingPlanner.js';
import { SimulationEngine } from './src/core/SimulationEngine.js';
import { EngineeringEngine } from './src/core/EngineeringEngine.js';

const G = EngineeringEngine.GRAVITY;
const DT = 1 / 60;

function raisedAssembly() {
    const planner = new RiggingPlanner();
    const sim = new SimulationEngine();
    sim.initializeFromPlan(planner.exportRiggingPlanJSON());

    // Move the whole assembled rig without changing any cable geometry, leaving
    // enough fall distance that the assertions cannot sample ground contact.
    const lift = 12;
    sim.bodies.craneHook.position.y += lift;
    sim.bodies.spreader.position.y += lift;
    sim.bodies.cargo.position.y += lift;
    sim.winch.hookHeight += lift;
    sim.winch.targetHeight += lift;
    sim.bodies.spreader.velocity.setZero();
    sim.bodies.cargo.velocity.setZero();
    return sim;
}

function assertFreeFall(sim, bodies, seconds = 0.3) {
    const start = new Map(bodies.map(([id, body]) => [id, { y: body.position.y }]));
    const steps = Math.round(seconds / DT);
    for (let frame = 0; frame < steps; frame++) {
        sim.step(DT);
        if (frame === 0) {
            bodies.forEach(([id, body]) => {
                const initial = start.get(id);
                expect(body.isSupported, `${id} must be marked detached immediately`).toBe(false);
                expect(body.sleepState, `${id} may not sleep after losing its load path`).not.toBe(2);
                expect(body.position.y, `${id} must start descending on the first frame`).toBeLessThan(initial.y);
                expect(body.velocity.y, `${id} must receive downward gravity`).toBeLessThan(0);
            });
        }
    }
    const t = steps * DT;
    bodies.forEach(([id, body]) => {
        const initial = start.get(id);
        // The production world uses semi-implicit Euler.  This is its exact
        // discrete equivalent of y = y0 - ½gt², rather than an arbitrary loose
        // visual tolerance: Σ(i·g·dt)dt for i = 1…N.
        const expectedDrop = G * DT * DT * steps * (steps + 1) * 0.5;
        const actualDrop = initial.y - body.position.y;
        // Cannon has deliberately small damping: this accepts integration error,
        // but rejects a body that is held/floating after its load path is gone.
        expect(actualDrop, `${id} free-fall displacement`).toBeGreaterThan(expectedDrop * 0.99);
        expect(actualDrop, `${id} free-fall displacement`).toBeLessThan(expectedDrop * 1.01);
        expect(body.velocity.y, `${id} vertical free-fall velocity`).toBeCloseTo(-G * t, 1);
    });
}

describe('Production load-path failure and free-fall physics', () => {
    test('1. Cutting every top bridle detaches spreader and cargo, both falling at g = 9.81 m/s²', () => {
        const sim = raisedAssembly();
        const graph = sim.cutCables(['upper_0', 'upper_1', 'upper_2', 'upper_3']);

        expect(graph.linksScanned).toBe(8);
        expect(graph.detachedIds).toEqual(expect.arrayContaining(['spreader', 'cargo']));
        assertFreeFall(sim, [['spreader', sim.bodies.spreader], ['cargo', sim.bodies.cargo]]);
    });

    test('2. Cutting every lower sling keeps the spreader supported but releases the cargo at g = 9.81 m/s²', () => {
        const sim = raisedAssembly();
        const graph = sim.cutCables(['lower_0', 'lower_1', 'lower_2', 'lower_3']);

        expect(graph.supportedIds.has('spreader')).toBe(true);
        expect(graph.detachedIds).toEqual(['cargo']);
        const beamY = sim.bodies.spreader.position.y;
        assertFreeFall(sim, [['cargo', sim.bodies.cargo]]);
        expect(Math.abs(sim.bodies.spreader.position.y - beamY)).toBeLessThan(0.03);
    });

    test('3. A single cut preserves an alternate load path; only after its final path is removed does the cargo fall', () => {
        const sim = raisedAssembly();
        const initial = sim.cutCables('lower_0');
        expect(initial.supportedIds.has('cargo')).toBe(true);
        expect(sim.bodies.cargo.isSupported).toBe(true);

        const terminal = sim.cutCables(['lower_1', 'lower_2', 'lower_3']);
        expect(terminal.detachedIds).toContain('cargo');
        assertFreeFall(sim, [['cargo', sim.bodies.cargo]], 0.2);
    });

    test('4. Fail-fast floating detector rejects a detached body whose gravity response is removed', () => {
        const sim = raisedAssembly();
        sim.cutCables(['lower_0', 'lower_1', 'lower_2', 'lower_3']);
        const cargo = sim.bodies.cargo;
        const y0 = cargo.position.y;

        // Deliberately reproduce the historical bug: a detached body is frozen.
        cargo.velocity.setZero();
        cargo.type = 4; // CANNON.Body.KINEMATIC
        sim.step(DT);

        expect(cargo.isSupported).toBe(false);
        expect(() => {
            if (cargo.position.y >= y0 || cargo.velocity.y >= 0) {
                throw new Error('[CRITICAL PHYSICS FAILURE - FLOATING DETACHED BODY]');
            }
        }).toThrow(/FLOATING DETACHED BODY/);
    });
});
