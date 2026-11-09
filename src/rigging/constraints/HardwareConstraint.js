/**
 * ============================================================================
 * HARDWARE & RIGGING ACCESSORY CONSTRAINTS (HardwareConstraint.js)
 * Implements Physical Models for Groups 2, 3, 4, 5, 6, 8:
 *  - Shackles (Side-load penalty ASME B30.26)
 *  - Eyebolts & Swivel Hoist Rings
 *  - Swivels (Zero torsional resistance / free yaw)
 *  - Plate Lifting Clamps (Cam friction & slack auto-release)
 *  - Container Twistlocks (Corner casting lock & no-drop safety)
 *  - Spreader / Lifting / Equalizer Beams (Euler buckling & central pivot)
 * ============================================================================
 */

import { E_MODULUS, GPA } from '../../core/physics-world/Units.js';

export class ShackleConstraint {
    /**
     * @param {Object} config
     * @param {string} config.id
     * @param {string} config.parentBody
     * @param {string} config.childBody
     * @param {number} config.wllN
     * @param {number} [config.mblN]
     * @param {'BOW'|'DEE'} [config.type='BOW']
     */
    constructor(config) {
        this.id = config.id;
        this.group = 2; // Group 2: Shackles
        this.parentBody = config.parentBody;
        this.childBody = config.childBody;
        this.wllN = config.wllN;
        this.mblN = config.mblN || (this.wllN * 5);
        this.type = config.type || 'BOW';
        this.isBroken = false;
    }

    /**
     * Calculates WLL reduction factor based on out-of-plane side load angle (ASME B30.26)
     * 0 deg: 100%
     * 45 deg: 70%
     * 90 deg: 50%
     * @param {number} angleRad - Side-load angle in radians
     * @returns {number} Efficiency factor between 0.0 and 1.0
     */
    getSideLoadFactor(angleRad) {
        const deg = Math.abs(angleRad * (180 / Math.PI));
        if (deg <= 5) return 1.0;
        if (deg <= 45) {
            // Linear interpolate from 1.0 to 0.70
            return 1.0 - (deg - 5) * (0.30 / 40);
        }
        if (deg <= 90) {
            // Linear interpolate from 0.70 to 0.50
            return 0.70 - (deg - 45) * (0.20 / 45);
        }
        return 0.50;
    }

    getEffectiveWLL(angleRad = 0) {
        return this.wllN * this.getSideLoadFactor(angleRad);
    }

    getEffectiveMBL(angleRad = 0) {
        return this.mblN * this.getSideLoadFactor(angleRad);
    }
}

export class EyeboltConstraint {
    /**
     * @param {Object} config
     * @param {string} config.id
     * @param {number} config.wllN
     * @param {'SHOULDER'|'SWIVEL_HOIST_RING'|'NON_SHOULDER'} [config.type='SHOULDER']
     */
    constructor(config) {
        this.id = config.id;
        this.group = 3; // Group 3: Eyebolts & Hoist Rings
        this.wllN = config.wllN;
        this.mblN = config.mblN || (this.wllN * 5);
        this.type = config.type || 'SHOULDER';
    }

    /**
     * Capacity reduction according to ASME B30.26
     */
    getAngularCapacityFactor(angleRad) {
        if (this.type === 'SWIVEL_HOIST_RING') {
            // 360 rotation + 180 pivot: 100% capacity at all rated angles!
            return 1.0;
        }

        const deg = Math.abs(angleRad * (180 / Math.PI));
        if (this.type === 'NON_SHOULDER') {
            // Strictly vertical only! Side load prohibited
            return deg <= 5 ? 1.0 : 0.0;
        }

        // SHOULDER EYEBOLT
        if (deg <= 5) return 1.0;
        if (deg <= 45) {
            return 1.0 - (deg - 5) * (0.70 / 40); // drops to 30% at 45 deg
        }
        if (deg <= 90) {
            return 0.30 - (deg - 45) * (0.05 / 45); // drops to 25% at 90 deg
        }
        return 0.25;
    }
}

export class PlateClampConstraint {
    /**
     * Plate lifting clamp with cam-locking mechanism
     * Clamping force F_grip = k_cam * Tension
     * Holding friction = mu * F_grip
     * If tension drops to zero (slack), clamp releases!
     */
    constructor(config) {
        this.id = config.id;
        this.group = 4; // Group 4: Clamps & Hooks
        this.wllN = config.wllN;
        this.mblN = config.mblN || (this.wllN * 4);
        this.mu = config.mu || 0.35; // Steel-on-steel friction
        this.camFactor = config.camFactor || 3.0; // Mechanical cam leverage
        this.safetyLatchEngaged = config.safetyLatchEngaged !== undefined ? config.safetyLatchEngaged : true;
        this.isReleased = false;
    }

    evaluateGrip(tensionN) {
        if (this.isReleased) return { gripped: false, holdingForceN: 0 };

        // If cable goes slack (< 50N) and safety latch is not locked, clamp releases plate!
        if (tensionN < 50 && !this.safetyLatchEngaged) {
            this.isReleased = true;
            return { gripped: false, holdingForceN: 0 };
        }

        const gripNormalForceN = tensionN * this.camFactor;
        const maxHoldingFrictionN = gripNormalForceN * this.mu * 2; // Two clamp jaws

        return {
            gripped: true,
            gripNormalForceN,
            holdingForceN: maxHoldingFrictionN
        };
    }
}

export class ContainerTwistlockConstraint {
    /**
     * ISO Container Corner Casting Twistlock
     * Prevents unlocking under tensile load
     */
    constructor(config) {
        this.id = config.id;
        this.group = 8; // Group 8: Spreaders & Twistlocks
        this.cornerIndex = config.cornerIndex; // 0: FL, 1: FR, 2: RL, 3: RR
        this.locked = true;
        this.wllN = config.wllN || 250000; // 25 tonnes per corner
        this.mblN = config.mblN || (this.wllN * 3);
        this.isBroken = false;
    }

    tryUnlock(currentTensionN) {
        // Interlock safety: cannot twist lock open while supporting weight!
        if (currentTensionN > 1000) {
            return false; // Safety interlock prevents opening
        }
        this.locked = false;
        return true;
    }
}

export class BeamMechanicsModel {
    /**
     * Evaluates structural mechanics of Group 5 Beams:
     * - Spreader Beam: Euler Column Buckling under axial compression
     * - Lifting Beam: Bending moment and deflection
     * - Equalizer Beam: Rotational moment balance T1 * a = T2 * b
     */
    static evaluateSpreaderBuckling(axialCompressionN, lengthM, outerDiameterM, thicknessM, E = 210 * GPA) {
        // Second moment of area for circular pipe: I = pi * (D^4 - d^4) / 64
        const innerDiameterM = Math.max(0.001, outerDiameterM - 2 * thicknessM);
        const I = (Math.PI / 64) * (Math.pow(outerDiameterM, 4) - Math.pow(innerDiameterM, 4));

        // Euler Critical Buckling Load: P_cr = (pi^2 * E * I) / (K * L)^2 (Pinned ends K = 1.0)
        const K = 1.0;
        const P_cr = (Math.PI * Math.PI * E * I) / Math.pow(K * lengthM, 2);

        const bucklingRatio = axialCompressionN / P_cr;
        const isBuckled = bucklingRatio >= 1.0;

        return {
            criticalLoadN: P_cr,
            axialCompressionN,
            bucklingRatio,
            isBuckled
        };
    }

    static evaluateLiftingBeamBending(pointLoads, spanM, sectionModulusZ, yieldStrengthPa = 355 * 1e6) {
        // Max bending moment approximation for central load M = (W * L) / 4
        // Or sum of moment arms
        let maxMomentNm = 0;
        for (const load of pointLoads) {
            // load.forceN at distance load.x from left support
            const M = (load.forceN * load.x * (spanM - load.x)) / spanM;
            maxMomentNm += Math.abs(M);
        }

        // Bending stress: sigma = M / Z
        const bendingStressPa = maxMomentNm / Math.max(1e-7, sectionModulusZ);
        const stressRatio = bendingStressPa / yieldStrengthPa;
        const isYielded = stressRatio >= 1.0;

        return {
            maxMomentNm,
            bendingStressPa,
            yieldStrengthPa,
            stressRatio,
            isYielded
        };
    }

    static evaluateEqualizerBalance(armA, forceA, armB, forceB) {
        // Moment about center pivot: Tau = (forceA * armA) - (forceB * armB)
        const momentNm = (forceA * armA) - (forceB * armB);
        // Tilt equilibrium angle theta where arms project onto horizontal
        const isBalanced = Math.abs(momentNm) < 10.0;
        return {
            netMomentNm: momentNm,
            isBalanced,
            forceRatio: forceB > 0 ? (forceA / forceB) : 1.0,
            requiredArmRatio: armA > 0 ? (armB / armA) : 1.0
        };
    }
}
