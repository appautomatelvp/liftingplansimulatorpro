/**
 * ============================================================================
 * PHYSICS WORLD MANAGER (PhysicsWorldManager.js)
 * Master Coordinator for Real-Time Physics-Based Rigging & Heavy Lift Simulator
 * Architecture:
 *  - Multibody WASM backend (Rapier3D / Cannon-es via IPhysicsBackend)
 *  - Decoupled Fixed Timestep (120/240Hz, Substeps) + Alpha Interpolation
 *  - Multibody Rigging Constraint Solver & Rope Mechanics
 *  - Dynamic Destruction & Cascade Failure Manager
 *  - Zero-Floating Enforcer (Instant Free-Fall for Disconnected Objects)
 *  - Real-Time Sensor Telemetry Engine
 * ============================================================================
 */

import { FixedStepLoop } from './FixedStepLoop.js';
import { ConstraintGraph } from './ConstraintGraph.js';
import { DestructionSolver } from '../../simulation/destruction-manager/DestructionSolver.js';
import { SensorEngine } from '../../telemetry/sensor-engine/SensorEngine.js';

export class PhysicsWorldManager {
    /**
     * @param {Object} options
     * @param {import('./IPhysicsBackend.js').IPhysicsBackend} options.backend
     * @param {number} [options.fixedHz=120] - Outer solver frequency
     * @param {number} [options.substeps=6] - Sub-steps per step (giving h = 1/(120*6) ≈ 1.39 ms)
     * @param {string} [options.rootId='crane_hook']
     * @param {Function} [options.onEvent] - Event listener
     */
    constructor(options) {
        this.backend = options.backend;
        this.rootId = options.rootId || 'crane_hook';
        this.onEvent = options.onEvent || (() => {});

        this.graph = new ConstraintGraph(this.rootId);
        this.destruction = new DestructionSolver({
            graph: this.graph,
            backend: this.backend,
            onEvent: (evt, data) => this.onEvent(evt, data)
        });

        this.sensors = new SensorEngine({
            backend: this.backend,
            graph: this.graph
        });

        this.simTime = 0;
        this.bodyMasses = new Map();
        this.bodyTypes = new Map();

        // Snapshots for render interpolation (alpha)
        this.prevTransforms = new Map();
        this.currTransforms = new Map();

        this.loop = new FixedStepLoop({
            fixedDt: 1 / (options.fixedHz || 120),
            substeps: options.substeps || 6,
            onSubstep: (h, subIndex) => this._stepSubstep(h, subIndex),
            onStepComplete: (fixedDt) => this._onStepComplete(fixedDt)
        });
    }

    async init() {
        await this.backend.init();
    }

    /**
     * Registers a body into the physics world
     */
    addBody(desc) {
        this.backend.createBody(desc);
        this.graph.addNode(desc.id);
        this.bodyMasses.set(desc.id, desc.mass || 1.0);
        this.bodyTypes.set(desc.id, desc.type || 'dynamic');

        const initialTf = this.backend.getTransform(desc.id);
        this.prevTransforms.set(desc.id, JSON.parse(JSON.stringify(initialTf)));
        this.currTransforms.set(desc.id, JSON.parse(JSON.stringify(initialTf)));
        return desc.id;
    }

    addCollider(bodyId, shapeDesc) {
        this.backend.addCollider(bodyId, shapeDesc);
    }

    /**
     * Connects two bodies with an industrial rigging constraint
     * @param {import('../../rigging/constraints/UnilateralCableConstraint.js').UnilateralCableConstraint} constraint
     */
    addConstraint(constraint) {
        this.graph.addConstraint(constraint);
        if (typeof constraint.bindNative === 'function') {
            constraint.bindNative(this.backend);
        }
    }

    /**
     * Manually cuts a cable branch by ID
     * @param {string} constraintId
     */
    cutCable(constraintId) {
        this.destruction.queueCutCommand(constraintId);
    }

    /**
     * Single Sub-step Physics Solve
     * @private
     */
    _stepSubstep(h, subIndex) {
        this.simTime += h;

        // 1. Evaluate destruction (manual cuts & overload snaps)
        this.destruction.evaluateSubstep(h, this.simTime);

        // 2. Pre-step constraint update (anchor positions, normal vectors)
        const activeConstraints = this.graph.getActiveConstraints();
        for (const c of activeConstraints) {
            const stateA = this.backend.getTransform(c.bodyA);
            const stateB = this.backend.getTransform(c.bodyB);
            if (typeof c.update === 'function') {
                c.update(h, stateA, stateB);
            }
        }

        // 3. Step backend rigid-body and contact dynamics for duration h
        this.backend.step(h);

        // 4. Post-step constraint update to read latest tensions from multipliers
        for (const c of activeConstraints) {
            const stateA = this.backend.getTransform(c.bodyA);
            const stateB = this.backend.getTransform(c.bodyB);
            if (typeof c.update === 'function') {
                c.update(h, stateA, stateB);
            }
        }
    }

    /**
     * Outer step complete callback: capture snapshots for interpolation & telemetry
     * @private
     */
    _onStepComplete(fixedDt) {
        for (const id of this.graph.nodes) {
            const curr = this.currTransforms.get(id);
            if (curr) {
                this.prevTransforms.set(id, JSON.parse(JSON.stringify(curr)));
            }
            const latest = this.backend.getTransform(id);
            this.currTransforms.set(id, latest);
        }

        // Sample telemetry
        this.sensors.sample(this.simTime);
    }

    /**
     * Advances simulation with real elapsed frame time
     * @param {number} frameDt
     * @returns {number} alpha [0, 1) for render interpolation
     */
    update(frameDt) {
        return this.loop.advance(frameDt);
    }

    /**
     * Gets interpolated transform for smooth 60fps rendering without physics jitter
     * @param {string} bodyId
     * @param {number} alpha - Interpolation factor [0, 1)
     */
    getInterpolatedTransform(bodyId, alpha) {
        const prev = this.prevTransforms.get(bodyId);
        const curr = this.currTransforms.get(bodyId);

        if (!prev || !curr) {
            return this.backend.getTransform(bodyId);
        }

        // Lerp position
        const px = prev.position.x + (curr.position.x - prev.position.x) * alpha;
        const py = prev.position.y + (curr.position.y - prev.position.y) * alpha;
        const pz = prev.position.z + (curr.position.z - prev.position.z) * alpha;

        // Normalized quaternion slerp / nlerp
        const q1 = prev.quaternion;
        const q2 = curr.quaternion;
        let dot = q1.x * q2.x + q1.y * q2.y + q1.z * q2.z + q1.w * q2.w;

        let q2x = q2.x, q2y = q2.y, q2z = q2.z, q2w = q2.w;
        if (dot < 0) {
            dot = -dot;
            q2x = -q2x; q2y = -q2y; q2z = -q2z; q2w = -q2w;
        }

        let rx = q1.x + (q2x - q1.x) * alpha;
        let ry = q1.y + (q2y - q1.y) * alpha;
        let rz = q1.z + (q2z - q1.z) * alpha;
        let rw = q1.w + (q2w - q1.w) * alpha;

        const len = Math.sqrt(rx * rx + ry * ry + rz * rz + rw * rw);
        if (len > 1e-6) {
            rx /= len; ry /= len; rz /= len; rw /= len;
        }

        return {
            position: { x: px, y: py, z: pz },
            quaternion: { x: rx, y: ry, z: rz, w: rw },
            linvel: curr.linvel,
            angvel: curr.angvel
        };
    }
}
