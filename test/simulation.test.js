import { describe, it, expect } from 'vitest';
import { RiggingPlanner } from '../src/core/RiggingPlanner.js';
import { SimulationEngine } from '../src/core/SimulationEngine.js';

describe('SimulationEngine Dynamic Multibody Verification (Cannon-es)', () => {
    it('1. Initial ground resting state is in static equilibrium with zero bounce', () => {
        const planner = new RiggingPlanner();
        const plan = planner.exportRiggingPlanJSON();
        const sim = new SimulationEngine();
        sim.initializeFromPlan(plan);

        // Step 60 frames (1 second) without hoist
        for (let i = 0; i < 60; i++) {
            sim.step(1 / 60);
        }

        // Cargo should be resting on ground with clearance = 0
        expect(sim.telemetry.groundClearanceM).toBe(0);
        // Vertical velocity must be virtually 0 (no bounce)
        expect(Math.abs(sim.bodies.cargo.velocity.y)).toBeLessThan(0.01);
    });

    it('2. Hoisting lifts 24-tonne cargo cleanly with realistic tension equilibrium', () => {
        const planner = new RiggingPlanner();
        const plan = planner.exportRiggingPlanJSON();
        const sim = new SimulationEngine();
        sim.initializeFromPlan(plan);

        // Hoist for 5 seconds (300 frames)
        for (let i = 0; i < 300; i++) {
            sim.setWinchCommand(1, 1 / 60);
            sim.step(1 / 60);
        }

        // Cargo should be lifted off the ground
        expect(sim.telemetry.groundClearanceM).toBeGreaterThan(1.0);

        // Check total lower tension: must match cargo mass within 3% tolerance
        const lowerTensions = sim.telemetry.tensions.filter(t => t.role === 'lower');
        expect(lowerTensions).toHaveLength(4);
        const sumLowerT = lowerTensions.reduce((sum, t) => sum + t.tensionT, 0);
        const targetCargoMassT = plan.cargo.massKg / 1000;
        expect(sumLowerT).toBeCloseTo(targetCargoMassT, 0);

        // Check total upper tension: must match gross mass (cargo + spreader) within dynamic margin
        const upperTensions = sim.telemetry.tensions.filter(t => t.role === 'upper');
        expect(upperTensions).toHaveLength(4);
        const sumUpperT = upperTensions.reduce((sum, t) => sum + t.tensionT, 0);
        const targetGrossMassT = (plan.cargo.massKg + plan.rigging.spreaderMassKg) / 1000;
        expect(sumUpperT).toBeGreaterThanOrEqual(targetGrossMassT * 0.95);
        expect(sumUpperT).toBeLessThanOrEqual(targetGrossMassT * 1.25); // DAF limit
    });

    it('3. Inextensible cable constraints exhibit NO rubber-band bounce when stopping hoist', () => {
        const planner = new RiggingPlanner();
        const plan = planner.exportRiggingPlanJSON();
        const sim = new SimulationEngine();
        sim.initializeFromPlan(plan);

        // Hoist for 3 seconds
        for (let i = 0; i < 180; i++) {
            sim.setWinchCommand(1, 1 / 60);
            sim.step(1 / 60);
        }

        // Stop winch and let hang in air for 2 seconds (120 frames)
        for (let i = 0; i < 120; i++) {
            sim.setWinchCommand(0, 1 / 60);
            sim.step(1 / 60);
        }

        // After stopping, vertical velocity must damp out completely (critically damped)
        expect(Math.abs(sim.bodies.cargo.velocity.y)).toBeLessThan(0.02);
    });

    it('4. Keeps pad-eyes and ground clearance in the physical frame when the CoG is eccentric and the load tilts', () => {
        const planner = new RiggingPlanner();
        planner.setCargo('eccentric_test', 'Eccentric test load', { x: 6, y: 2, z: 2 }, 12000, { x: 0.6, y: -0.2, z: 0.25 });
        const plan = planner.exportRiggingPlanJSON();
        const sim = new SimulationEngine();
        sim.initializeFromPlan(plan);

        const firstLeg = sim.constraints.lowerLegs[0].constraint;
        const firstPadEye = plan.cargo.padEyes[0].localPos;
        expect(firstLeg.pivotB.x).toBeCloseTo(firstPadEye.x - 0.6, 8);
        expect(firstLeg.pivotB.y).toBeCloseTo(firstPadEye.y + 0.2, 8);
        expect(firstLeg.pivotB.z).toBeCloseTo(firstPadEye.z - 0.25, 8);

        sim.bodies.cargo.quaternion.setFromAxisAngle({ x: 0, y: 0, z: 1 }, Math.PI / 6);
        sim.updateTelemetry(1 / 60);
        expect(sim.telemetry.groundClearanceM).toBe(0);
    });
});
