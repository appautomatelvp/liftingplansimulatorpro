/**
 * ============================================================================
 * AUTOMATED PHYSICS TEST GATES (physics_master_blueprint.test.js)
 * Master Verification Suite for Milestone M1 - M6 Requirements:
 *  - Free fall acceleration g = 9.81 m/s^2 (T1.1)
 *  - Zero-Floating Guarantee (T1.2)
 *  - Static Equilibrium & Elastic Elongation (T2.1)
 *  - Unilateral Cable Slack / No-Compression (T2.2)
 *  - Mass-Ratio Extreme Stability (30 tonnes vs 20 kg) (T2.3)
 *  - Spreader Beam Euler Column Buckling (T3.1)
 *  - Shackle Side-Loading Angular Derating (T4.1)
 *  - Plate Clamp Cam Friction & Slack Auto-Release (T4.2)
 *  - Dynamic Destruction: Cut Cable & Shock Load (T5.1)
 *  - Chain-Reaction Collapse / Cascade Failure (T5.2)
 *  - Real-Time Telemetry DLF (Dynamic Load Factor) (T6.1)
 * ============================================================================
 */

import { describe, it, expect } from 'vitest';
import { CannonBackend } from '../src/core/physics-world/CannonBackend.js';
import { RapierBackend } from '../src/core/physics-world/RapierBackend.js';
import { PhysicsWorldManager } from '../src/core/physics-world/PhysicsWorldManager.js';
import { UnilateralCableConstraint } from '../src/rigging/constraints/UnilateralCableConstraint.js';
import {
    ShackleConstraint,
    EyeboltConstraint,
    PlateClampConstraint,
    ContainerTwistlockConstraint,
    BeamMechanicsModel
} from '../src/rigging/constraints/HardwareConstraint.js';
import { CornerProtectorModel } from '../src/rigging/constraints/CornerProtectorModel.js';
import { G_ACCEL, TONNE } from '../src/core/physics-world/Units.js';

describe('PHYSICS SIMULATOR MASTER GATES (M1 - M6)', () => {

    // ------------------------------------------------------------------------
    // M1: CORE PHYSICS & FREE FALL GATES
    // ------------------------------------------------------------------------
    it('T1.1: Free Fall Acceleration g = 9.81 m/s^2 within 0.5% error', async () => {
        const backend = new CannonBackend({ gravityY: -G_ACCEL });
        await backend.init();

        const initialY = 10.0;
        backend.createBody({
            id: 'test_box',
            type: 'dynamic',
            mass: 1000.0,
            position: { x: 0, y: initialY, z: 0 }
        });

        // Analytical physics:
        // y(t) = y0 - 0.5 * g * t^2
        // For t = 1.0 s: y(1) = 10 - 0.5 * 9.81 * 1.0 = 5.095 m
        // Velocity: v(1) = -g * t = -9.81 m/s
        const dt = 1 / 120;
        for (let i = 0; i < 120; i++) {
            backend.step(dt);
        }

        const state = backend.getTransform('test_box');
        const expectedY = initialY - 0.5 * G_ACCEL * (1.0 * 1.0);
        const expectedVy = -G_ACCEL * 1.0;

        expect(state.position.y).toBeCloseTo(expectedY, 1);
        expect(state.linvel.y).toBeCloseTo(expectedVy, 1);
        backend.dispose();
    });

    it('T1.2: Zero-Floating Guarantee - Disconnected body falls immediately', async () => {
        const backend = new CannonBackend({ gravityY: -G_ACCEL });
        const manager = new PhysicsWorldManager({ backend, fixedHz: 120 });
        await manager.init();

        // Spawn cargo at height 15m without any cables attached
        manager.addBody({
            id: 'unconnected_cargo',
            type: 'dynamic',
            mass: 5000.0,
            position: { x: 0, y: 15.0, z: 0 }
        });

        // Run 60 frames
        for (let i = 0; i < 60; i++) {
            manager.update(1 / 60);
        }

        const state = backend.getTransform('unconnected_cargo');
        // Must NOT remain hovering at 15m! Must have fallen under gravity
        expect(state.position.y).toBeLessThan(14.0);
        expect(state.linvel.y).toBeLessThan(-5.0);
        backend.dispose();
    });

    // ------------------------------------------------------------------------
    // M2: XPBD CABLE SOLVER & SLACK UNILATERAL GATES
    // ------------------------------------------------------------------------
    it('T2.1: Static Equilibrium & Elastic Elongation Delta L = (T * L0) / (E * A)', async () => {
        const backend = new CannonBackend({ gravityY: -G_ACCEL });
        const manager = new PhysicsWorldManager({ backend, fixedHz: 120, substeps: 6 });
        await manager.init();

        const cargoMassKg = 30 * TONNE; // 30 tonnes container
        const restLengthM = 6.0;

        // Kinematic hook
        manager.addBody({
            id: 'crane_hook',
            type: 'kinematicPosition',
            mass: 0,
            position: { x: 0, y: 20.0, z: 0 }
        });

        // Dynamic Cargo initially suspended at hook.y - restLength
        manager.addBody({
            id: 'cargo_30t',
            type: 'dynamic',
            mass: cargoMassKg,
            position: { x: 0, y: 20.0 - restLengthM, z: 0 }
        });

        // Heavy-duty steel wire rope sling (IWRC)
        const cable = new UnilateralCableConstraint({
            id: 'main_cable',
            bodyA: 'crane_hook',
            anchorA: { x: 0, y: 0, z: 0 },
            bodyB: 'cargo_30t',
            anchorB: { x: 0, y: 0, z: 0 },
            restLength: restLengthM,
            diameterMm: 48, // 48 mm steel wire
            wllN: 400 * 1000,
            mblN: 1500 * 1000,
            dampingRatio: 0.1
        });
        manager.addConstraint(cable);

        // Run simulation for 2.0 seconds to settle into equilibrium
        for (let i = 0; i < 120; i++) {
            manager.update(1 / 60);
        }

        const expectedWeightN = cargoMassKg * G_ACCEL; // 294,300 N
        expect(cable.tensionN).toBeGreaterThan(expectedWeightN * 0.90);
        expect(cable.tensionN).toBeLessThan(expectedWeightN * 1.10);

        // Elastic stretch Delta L = (T * L0) / (E * A)
        const theoreticalDeltaL = (expectedWeightN * restLengthM) / (cable.E * cable.A);
        expect(cable.elongationM).toBeGreaterThan(0.001);
        expect(cable.elongationM).toBeCloseTo(theoreticalDeltaL, 1);

        backend.dispose();
    });

    it('T2.2: Unilateral Slack Behavior - Zero tension when distance <= L0', async () => {
        const backend = new CannonBackend({ gravityY: -G_ACCEL });
        const manager = new PhysicsWorldManager({ backend, fixedHz: 120 });
        await manager.init();

        manager.addBody({
            id: 'crane_hook',
            type: 'kinematicPosition',
            mass: 0,
            position: { x: 0, y: 10.0, z: 0 }
        });

        // Cargo placed 2 meters below hook, but cable rest length is 5 meters -> slack!
        manager.addBody({
            id: 'slack_cargo',
            type: 'dynamic',
            mass: 2000.0,
            position: { x: 0, y: 8.0, z: 0 }
        });

        const slackCable = new UnilateralCableConstraint({
            id: 'slack_cable',
            bodyA: 'crane_hook',
            anchorA: { x: 0, y: 0, z: 0 },
            bodyB: 'slack_cargo',
            anchorB: { x: 0, y: 0, z: 0 },
            restLength: 5.0
        });
        manager.addConstraint(slackCable);

        manager.update(1 / 60);

        // Cable must be slack: zero tension, zero compressive force!
        expect(slackCable.isSlack).toBe(true);
        expect(slackCable.tensionN).toBe(0);

        backend.dispose();
    });

    it('T2.3: Extreme Mass Ratio Stability (30,000 kg cargo on light node) without explosion', async () => {
        const backend = new CannonBackend({ gravityY: -G_ACCEL });
        const manager = new PhysicsWorldManager({ backend, fixedHz: 120, substeps: 6 });
        await manager.init();

        // Hook (immovable)
        manager.addBody({
            id: 'crane_hook',
            type: 'kinematicPosition',
            mass: 0,
            position: { x: 0, y: 25.0, z: 0 }
        });

        // Ultra-light intermediate rigging link (only 25 kg)
        manager.addBody({
            id: 'light_link',
            type: 'dynamic',
            mass: 25.0,
            position: { x: 0, y: 23.0, z: 0 }
        });

        // Ultra-heavy container (30,000 kg) -> Mass ratio 1200:1 !
        manager.addBody({
            id: 'heavy_cargo',
            type: 'dynamic',
            mass: 30000.0,
            position: { x: 0, y: 17.0, z: 0 }
        });

        // Top cable to light link
        const topCable = new UnilateralCableConstraint({
            id: 'top_cable',
            bodyA: 'crane_hook',
            anchorA: { x: 0, y: 0, z: 0 },
            bodyB: 'light_link',
            anchorB: { x: 0, y: 0, z: 0 },
            restLength: 2.0,
            diameterMm: 52
        });

        // Bottom cable from light link to 30t cargo
        const bottomCable = new UnilateralCableConstraint({
            id: 'bottom_cable',
            bodyA: 'light_link',
            anchorA: { x: 0, y: 0, z: 0 },
            bodyB: 'heavy_cargo',
            anchorB: { x: 0, y: 0, z: 0 },
            restLength: 6.0,
            diameterMm: 52
        });

        manager.addConstraint(topCable);
        manager.addConstraint(bottomCable);

        for (let i = 0; i < 60; i++) {
            manager.update(1 / 60);
        }

        const cargoTf = backend.getTransform('heavy_cargo');
        const linkTf = backend.getTransform('light_link');

        // Check for NaN or numerical explosion
        expect(Number.isNaN(cargoTf.position.y)).toBe(false);
        expect(Number.isNaN(linkTf.position.y)).toBe(false);
        expect(cargoTf.position.y).toBeGreaterThan(10.0);
        expect(linkTf.position.y).toBeGreaterThan(15.0);

        backend.dispose();
    });

    // ------------------------------------------------------------------------
    // M3 & M4: MECHANICAL HARDWARE & BEAMS GATES
    // ------------------------------------------------------------------------
    it('T3.1: Spreader Beam Euler Buckling Evaluation', () => {
        const lengthM = 6.0;
        const odM = 0.300;
        const thkM = 0.012;

        const safeRes = BeamMechanicsModel.evaluateSpreaderBuckling(300 * 1000, lengthM, odM, thkM);
        expect(safeRes.isBuckled).toBe(false);
        expect(safeRes.bucklingRatio).toBeLessThan(0.5);

        const overloadRes = BeamMechanicsModel.evaluateSpreaderBuckling(safeRes.criticalLoadN * 1.05, lengthM, odM, thkM);
        expect(overloadRes.isBuckled).toBe(true);
        expect(overloadRes.bucklingRatio).toBeGreaterThan(1.0);
    });

    it('T4.1: Shackle Side-Loading Penalty Derating (ASME B30.26)', () => {
        const shackle = new ShackleConstraint({
            id: 'shackle_55t',
            parentBody: 'hook',
            childBody: 'sling',
            wllN: 55000 * G_ACCEL
        });

        expect(shackle.getSideLoadFactor(0)).toBe(1.0);

        const factor45 = shackle.getSideLoadFactor(Math.PI / 4);
        expect(factor45).toBeCloseTo(0.70, 2);

        const factor90 = shackle.getSideLoadFactor(Math.PI / 2);
        expect(factor90).toBeCloseTo(0.50, 2);
    });

    it('T4.2: Plate Lifting Clamp - Grips under tension and releases when slack', () => {
        const clamp = new PlateClampConstraint({
            id: 'plate_clamp',
            wllN: 50000,
            safetyLatchEngaged: false
        });

        const gripActive = clamp.evaluateGrip(20000);
        expect(gripActive.gripped).toBe(true);
        expect(gripActive.holdingForceN).toBeGreaterThan(10000);

        const gripSlack = clamp.evaluateGrip(0);
        expect(gripSlack.gripped).toBe(false);
        expect(clamp.isReleased).toBe(true);
    });

    it('T4.5: Corner Protector - Capstan Friction & D/d Efficiency Factor', () => {
        const bareEfficiency = CornerProtectorModel.getBendEfficiency(2, 24);
        expect(bareEfficiency).toBeLessThan(0.35);

        const protectedEfficiency = CornerProtectorModel.getBendEfficiency(60, 24);
        expect(protectedEfficiency).toBeGreaterThanOrEqual(0.80);

        const friction = CornerProtectorModel.computeCapstanFriction(100000, Math.PI / 2, 0.20);
        expect(friction.tensionOutN).toBeLessThan(100000);
        expect(friction.frictionLossN).toBeGreaterThan(0);
    });

    // ------------------------------------------------------------------------
    // M5: DYNAMIC DESTRUCTION & CASCADE COLLAPSE GATES
    // ------------------------------------------------------------------------
    it('T5.1: Manual Cut Cable Triggers Asymmetric Tilt & Shock Load', async () => {
        const backend = new CannonBackend({ gravityY: -G_ACCEL });
        const manager = new PhysicsWorldManager({ backend, fixedHz: 120, substeps: 6 });
        await manager.init();

        manager.addBody({
            id: 'crane_hook',
            type: 'kinematicPosition',
            mass: 0,
            position: { x: 0, y: 15.0, z: 0 }
        });

        // 10t container suspended by 2 legs (Left & Right)
        manager.addBody({
            id: 'cargo',
            type: 'dynamic',
            mass: 10 * TONNE,
            position: { x: 0, y: 10.0, z: 0 }
        });

        // Exact geometric distance: sqrt(2^2 + 5^2) = 5.385m
        const restLen = 5.385;

        // Left cable
        const cableLeft = new UnilateralCableConstraint({
            id: 'cable_left',
            bodyA: 'crane_hook',
            anchorA: { x: 0, y: 0, z: 0 },
            bodyB: 'cargo',
            anchorB: { x: -2.0, y: 0, z: 0 },
            restLength: restLen,
            wllN: 150000,
            mblN: 600000
        });

        // Right cable
        const cableRight = new UnilateralCableConstraint({
            id: 'cable_right',
            bodyA: 'crane_hook',
            anchorA: { x: 0, y: 0, z: 0 },
            bodyB: 'cargo',
            anchorB: { x: 2.0, y: 0, z: 0 },
            restLength: restLen,
            wllN: 150000,
            mblN: 600000
        });

        manager.addConstraint(cableLeft);
        manager.addConstraint(cableRight);

        // Stabilize for 30 steps
        for (let i = 0; i < 30; i++) manager.update(1 / 60);

        expect(cableLeft.tensionN).toBeGreaterThan(10000);
        expect(cableRight.tensionN).toBeGreaterThan(10000);

        // Cut the left cable!
        manager.cutCable('cable_left');

        // Step simulation after cut
        for (let i = 0; i < 40; i++) {
            manager.update(1 / 60);
        }

        // 1. Left cable must be broken
        expect(cableLeft.isBroken).toBe(true);

        // 2. Right cable must have absorbed the shock load
        expect(cableRight.shockPeakTensionN).toBeGreaterThan(60000);

        // 3. Cargo must have tilted / rotated due to asymmetric torque!
        const cargoTf = backend.getTransform('cargo');
        expect(Math.abs(cargoTf.quaternion.z)).toBeGreaterThan(0.01);

        backend.dispose();
    });

    it('T5.2: Overload Auto-Snap & Chain-Reaction Cascade Failure', async () => {
        const backend = new CannonBackend({ gravityY: -G_ACCEL });
        const manager = new PhysicsWorldManager({ backend, fixedHz: 120, substeps: 6 });
        await manager.init();

        manager.addBody({
            id: 'crane_hook',
            type: 'kinematicPosition',
            mass: 0,
            position: { x: 0, y: 15.0, z: 0 }
        });

        // Heavy cargo 20 tonnes = 196,200 N
        manager.addBody({
            id: 'heavy_cargo',
            type: 'dynamic',
            mass: 20 * TONNE,
            position: { x: 0, y: 10.0, z: 0 }
        });

        // Geometric distance: sqrt(1^2 + 5^2) = 5.099m
        const restLen = 5.099;

        // Two cables with MBL = 180,000 N each
        // While both are intact, each supports ~100,000 N < 180,000 N (Safe)
        // Once branch 1 is cut, branch 2 takes 196,200 N + dynamic shock > 180,000 N -> Cascade Overload Snap!
        const c1 = new UnilateralCableConstraint({
            id: 'branch_1',
            bodyA: 'crane_hook',
            anchorA: { x: 0, y: 0, z: 0 },
            bodyB: 'heavy_cargo',
            anchorB: { x: -1.0, y: 0, z: 0 },
            restLength: restLen,
            mblN: 180000
        });

        const c2 = new UnilateralCableConstraint({
            id: 'branch_2',
            bodyA: 'crane_hook',
            anchorA: { x: 0, y: 0, z: 0 },
            bodyB: 'heavy_cargo',
            anchorB: { x: 1.0, y: 0, z: 0 },
            restLength: restLen,
            mblN: 180000
        });

        manager.addConstraint(c1);
        manager.addConstraint(c2);

        for (let i = 0; i < 20; i++) manager.update(1 / 60);

        // Both cables should be safely carrying tension
        expect(c1.tensionN).toBeGreaterThan(50000);
        expect(c2.tensionN).toBeGreaterThan(50000);

        // Manually cut branch 1
        manager.cutCable('branch_1');

        // Advance simulation -> branch 2 must auto-snap due to overload shock load!
        for (let i = 0; i < 40; i++) {
            manager.update(1 / 60);
        }

        expect(c1.isBroken).toBe(true);
        expect(c2.isBroken).toBe(true); // Branch 2 collapsed in chain reaction!
        expect(manager.destruction.cascadeCount).toBeGreaterThanOrEqual(2);

        backend.dispose();
    });

    // ------------------------------------------------------------------------
    // M6: REAL-TIME TELEMETRY GATES
    // ------------------------------------------------------------------------
    it('T6.1: Real-Time Telemetry DLF (Dynamic Load Factor) and Hook Metrics', async () => {
        const backend = new CannonBackend({ gravityY: -G_ACCEL });
        const manager = new PhysicsWorldManager({ backend, fixedHz: 120, substeps: 6 });
        await manager.init();

        const massKg = 10 * TONNE;
        manager.sensors.setCargoMass(massKg);

        manager.addBody({
            id: 'crane_hook',
            type: 'kinematicPosition',
            mass: 0,
            position: { x: 6.0, y: 20.0, z: 8.0 } // Radius = sqrt(6^2 + 8^2) = 10m
        });

        manager.addBody({
            id: 'cargo',
            type: 'dynamic',
            mass: massKg,
            position: { x: 6.0, y: 14.0, z: 8.0 }
        });

        const cable = new UnilateralCableConstraint({
            id: 'sling_main',
            bodyA: 'crane_hook',
            anchorA: { x: 0, y: 0, z: 0 },
            bodyB: 'cargo',
            anchorB: { x: 0, y: 0, z: 0 },
            restLength: 6.0,
            wllN: 200000,
            mblN: 800000
        });
        manager.addConstraint(cable);

        // Settle for 120 frames
        for (let i = 0; i < 120; i++) manager.update(1 / 60);

        const telem = manager.sensors.currentFrame;
        expect(telem.craneRadiusM).toBeCloseTo(10.0, 1);
        expect(telem.totalHookLoadTonnes).toBeCloseTo(10.0, 0); // Settles near 10t
        expect(telem.dlf).toBeCloseTo(1.0, 0); // Settles near 1.0
        expect(telem.cables.length).toBe(1);
        expect(telem.cables[0].pctSWL).toBeGreaterThan(40);
        expect(telem.cables[0].pctSWL).toBeLessThan(70);

        backend.dispose();
    });
});
