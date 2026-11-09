/**
 * ============================================================================
 * UNILATERAL CABLE CONSTRAINT (UnilateralCableConstraint.js)
 * Formulation: Multibody Coupled Distance Constraint with Compliance & Critical Damping
 * Standard: ASME B30.9, DNV-ST-N001
 * Behavior:
 *   - Pure Tension Only (Slack when distance <= L0, zero compressive resistance)
 *   - Physical Elastic Elongation: Delta L = (T * L0) / (E * A)
 *   - Viscous Material Damping: F_damping = c * (v_rel . n)
 *   - Simultaneous Equation Solving (Zero Mass Ratio Instability)
 *   - Destruction Managed by DestructionSolver (No premature self-breaking)
 * ============================================================================
 */

import * as CANNON from 'cannon-es';
import { RopeConstraint } from '../../core/RopeConstraint.js';
import { E_MODULUS, MATERIAL_DAMPING } from '../../core/physics-world/Units.js';

export class UnilateralCableConstraint {
    /**
     * @param {Object} config
     * @param {string} config.id - Unique ID
     * @param {string} config.bodyA - Parent body ID (e.g. Hook or Spreader)
     * @param {{x: number, y: number, z: number}} config.anchorA - Local attachment on bodyA
     * @param {string} config.bodyB - Child body ID (e.g. Spreader or Cargo)
     * @param {{x: number, y: number, z: number}} config.anchorB - Local attachment on bodyB
     * @param {number} config.restLength - Natural resting length L0 in meters
     * @param {number} [config.diameterMm=28] - Cable nominal diameter in mm
     * @param {number} [config.wllN=100000] - Working Load Limit in Newtons
     * @param {number} [config.mblN=500000] - Minimum Breaking Load in Newtons
     * @param {'STEEL_WIRE_ROPE_IWRC'|'POLYESTER_WEBBING'|'CHAIN_GRADE_80'|'POLYESTER_ROUND'|'HMPE_DYNEEMA'} [config.material='STEEL_WIRE_ROPE_IWRC']
     * @param {number} [config.dampingRatio] - Viscous damping ratio (zeta)
     * @param {Function} [config.bendEfficiencyFn] - Returns D/d bending efficiency factor (0.0 to 1.0)
     */
    constructor(config) {
        this.id = config.id;
        this.group = 1; // Group 1: Slings & Lines
        this.bodyA = config.bodyA;
        this.anchorA = { x: config.anchorA?.x || 0, y: config.anchorA?.y || 0, z: config.anchorA?.z || 0 };
        this.bodyB = config.bodyB;
        this.anchorB = { x: config.anchorB?.x || 0, y: config.anchorB?.y || 0, z: config.anchorB?.z || 0 };

        this.restLength = Math.max(0.01, config.restLength);
        this.diameterMm = config.diameterMm || 28;
        this.wllN = config.wllN || 100000;
        this.mblN = config.mblN || (this.wllN * 5); // Default 5:1 design factor

        this.material = config.material || 'STEEL_WIRE_ROPE_IWRC';
        this.E = E_MODULUS[this.material] || E_MODULUS.STEEL_WIRE_ROPE_IWRC;

        // Cross-sectional metal area
        const radiusM = (this.diameterMm / 1000) / 2;
        const fillFactor = (this.material.includes('STEEL_WIRE') ? 0.58 : 0.85);
        this.A = Math.PI * radiusM * radiusM * fillFactor;

        this.k = (this.E * this.A) / this.restLength;
        this.compliance = 1 / Math.max(1e-9, this.k);

        this.dampingRatio = config.dampingRatio !== undefined
            ? config.dampingRatio
            : (MATERIAL_DAMPING.STEEL_WIRE);

        this.bendEfficiencyFn = config.bendEfficiencyFn || (() => 1.0);

        // State variables
        this.tensionN = 0;
        this.currentLength = this.restLength;
        this.elongationM = 0;
        this.isBroken = false;
        this.brokenTime = null;
        this.isSlack = false;
        this.shockPeakTensionN = 0;

        // World anchor cache
        this.worldPosA = { x: 0, y: 0, z: 0 };
        this.worldPosB = { x: 0, y: 0, z: 0 };

        /** @type {RopeConstraint|null} */
        this.nativeRope = null;
    }

    getEffectiveMBL() {
        const bendFactor = Math.max(0.1, Math.min(1.0, this.bendEfficiencyFn()));
        return this.mblN * bendFactor;
    }

    bindNative(backend) {
        if (backend && backend.bodies) {
            const bodyA = backend.bodies.get(this.bodyA);
            const bodyB = backend.bodies.get(this.bodyB);
            if (bodyA && bodyB) {
                const pA = new CANNON.Vec3(this.anchorA.x, this.anchorA.y, this.anchorA.z);
                const pB = new CANNON.Vec3(this.anchorB.x, this.anchorB.y, this.anchorB.z);
                // Pass Infinity to RopeConstraint: DestructionSolver manages overload & snapping
                this.nativeRope = new RopeConstraint(bodyA, pA, bodyB, pB, this.restLength, Infinity);
                backend.addConstraint(this.id, this.nativeRope);
            }
        }
    }

    update(h, stateA, stateB) {
        if (this.isBroken) {
            this.tensionN = 0;
            this.isSlack = true;
            return;
        }

        if (this.nativeRope) {
            this.nativeRope.update();
            const measuredTension = Math.abs(this.nativeRope.distanceEquation?.multiplier || 0);
            this.tensionN = measuredTension;
            if (this.tensionN > this.shockPeakTensionN) {
                this.shockPeakTensionN = this.tensionN;
            }

            // Transform world anchor points
            const wpA = UnilateralCableConstraint.transformPoint(this.anchorA, stateA.position, stateA.quaternion);
            const wpB = UnilateralCableConstraint.transformPoint(this.anchorB, stateB.position, stateB.quaternion);
            this.worldPosA = wpA;
            this.worldPosB = wpB;

            const dx = wpB.x - wpA.x;
            const dy = wpB.y - wpA.y;
            const dz = wpB.z - wpA.z;
            this.currentLength = Math.sqrt(dx * dx + dy * dy + dz * dz);

            this.isSlack = (this.currentLength <= this.restLength);
            // Elastic stretch Delta L = (T * L0) / (E * A)
            this.elongationM = (this.tensionN * this.restLength) / Math.max(1e-9, this.E * this.A);
        }
    }

    static transformPoint(localPoint, pos, quat) {
        const { x: px, y: py, z: pz } = pos;
        const { x: qx, y: qy, z: qz, w: qw } = quat;

        const vx = localPoint.x;
        const vy = localPoint.y;
        const vz = localPoint.z;

        const tx = 2 * (qy * vz - qz * vy);
        const ty = 2 * (qz * vx - qx * vz);
        const tz = 2 * (qx * vy - qy * vx);

        return {
            x: px + vx + qw * tx + (qy * tz - qz * ty),
            y: py + vy + qw * ty + (qz * tx - qx * tz),
            z: pz + vz + qw * tz + (qx * ty - qy * tx)
        };
    }
}
