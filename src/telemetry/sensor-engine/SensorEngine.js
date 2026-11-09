/**
 * ============================================================================
 * REAL-TIME PHYSICS TELEMETRY SENSOR ENGINE (SensorEngine.js)
 * Measures Real Solver Quantities (No Fake Static Math):
 *  - Real Tension T_i = lambda / (h^2)
 *  - Dynamic Load Factor (DLF) = Total Vertical Force / (Static Weight)
 *  - % SWL & % MBL Utilization
 *  - 3D Sling Angles & Cargo Pitch / Roll / Yaw
 *  - Crane Hook Working Radius & Load Chart Capacity Check
 * ============================================================================
 */

import { G_ACCEL, TONNE } from '../../core/physics-world/Units.js';

export class SensorEngine {
    /**
     * @param {Object} options
     * @param {import('../../core/physics-world/IPhysicsBackend.js').IPhysicsBackend} options.backend
     * @param {import('../../core/physics-world/ConstraintGraph.js').ConstraintGraph} options.graph
     * @param {number} [options.totalCargoMassKg=10000]
     * @param {Function} [options.loadChartFn] - Callback (radiusM) => ratedCapacityTonnes
     */
    constructor(options) {
        this.backend = options.backend;
        this.graph = options.graph;
        this.totalCargoMassKg = options.totalCargoMassKg || 10000;
        this.loadChartFn = options.loadChartFn || ((r) => 50.0); // Default 50t chart

        this.history = [];
        this.maxHistoryLength = 600; // 5-10 seconds buffer at 60-120fps

        // Telemetry frame snapshot
        this.currentFrame = {
            timestamp: 0,
            dlf: 1.0,
            totalHookLoadN: 0,
            totalHookLoadTonnes: 0,
            craneRadiusM: 0,
            craneRatedCapacityTonnes: 50,
            craneCapacityUtilizationPct: 0,
            isCraneOverloaded: false,
            cargo: {
                position: { x: 0, y: 0, z: 0 },
                pitchDeg: 0,
                rollDeg: 0,
                yawDeg: 0,
                linvel: { x: 0, y: 0, z: 0 },
                angvel: { x: 0, y: 0, z: 0 }
            },
            cables: []
        };
    }

    setCargoMass(massKg) {
        this.totalCargoMassKg = Math.max(1, massKg);
    }

    /**
     * Converts quaternion to Euler Angles in degrees (Pitch, Roll, Yaw)
     */
    static quaternionToEulerDeg(q) {
        const { x, y, z, w } = q;

        // Roll (x-axis rotation)
        const sinr_cosp = 2 * (w * x + y * z);
        const cosr_cosp = 1 - 2 * (x * x + y * y);
        const roll = Math.atan2(sinr_cosp, cosr_cosp) * (180 / Math.PI);

        // Pitch (y-axis rotation)
        const sinp = 2 * (w * y - z * x);
        let pitch;
        if (Math.abs(sinp) >= 1) {
            pitch = Math.sign(sinp) * 90; // use 90 degrees if out of range
        } else {
            pitch = Math.asin(sinp) * (180 / Math.PI);
        }

        // Yaw (z-axis rotation)
        const siny_cosp = 2 * (w * z + x * y);
        const cosy_cosp = 1 - 2 * (y * y + z * z);
        const yaw = Math.atan2(siny_cosp, cosy_cosp) * (180 / Math.PI);

        return { pitch, roll, yaw };
    }

    /**
     * Samples real physical metrics from backend and constraint solver
     * @param {number} simTime - Simulation time in seconds
     * @param {string} [cargoBodyId='cargo']
     * @param {string} [hookBodyId='crane_hook']
     * @returns {typeof this.currentFrame}
     */
    sample(simTime, cargoBodyId = 'cargo', hookBodyId = 'crane_hook') {
        const hookTransform = this.backend.getTransform(hookBodyId);
        const cargoTransform = this.backend.getTransform(cargoBodyId);

        // 1. Working radius from crane origin (0, 0, 0)
        const radiusM = Math.sqrt(hookTransform.position.x * hookTransform.position.x + hookTransform.position.z * hookTransform.position.z);
        const ratedCapTonnes = Math.max(0.1, this.loadChartFn(radiusM));

        // 2. Measure cable tensions directly from solver
        const activeConstraints = this.graph.getActiveConstraints();
        const cableMetrics = [];
        let totalVerticalForceN = 0;

        for (const c of activeConstraints) {
            if (c.group === 1) { // Slings
                const tensionN = c.tensionN || 0;
                const mblEff = typeof c.getEffectiveMBL === 'function' ? c.getEffectiveMBL() : c.mblN;
                const wllEff = c.wllN || (mblEff / 5);

                const pctSWL = (tensionN / Math.max(1, wllEff)) * 100;
                const pctMBL = (tensionN / Math.max(1, mblEff)) * 100;

                // 3D Cable direction
                const dx = c.worldPosB.x - c.worldPosA.x;
                const dy = c.worldPosB.y - c.worldPosA.y;
                const dz = c.worldPosB.z - c.worldPosA.z;
                const length = Math.max(1e-4, Math.sqrt(dx * dx + dy * dy + dz * dz));

                // Vertical component on upper anchor (Hook/Spreader)
                const unitY = dy / length; // Negative when pointing downwards to cargo
                const verticalForceOnUpper = Math.abs(unitY * tensionN);
                totalVerticalForceN += verticalForceOnUpper;

                // Cable angle with horizontal (Sling Angle to Horizontal theta_h)
                // When vertical: unitY = -1 -> angle = 90 deg
                const angleFromHorizontalDeg = Math.asin(Math.min(1.0, Math.abs(unitY))) * (180 / Math.PI);

                cableMetrics.push({
                    id: c.id,
                    tensionN,
                    tensionTonnes: tensionN / (G_ACCEL * TONNE),
                    wllN: wllEff,
                    mblN: mblEff,
                    pctSWL,
                    pctMBL,
                    isOverSWL: pctSWL > 100,
                    isNearFailure: pctMBL > 85,
                    isSlack: c.isSlack,
                    elongationMm: (c.elongationM || 0) * 1000,
                    angleFromHorizontalDeg
                });
            }
        }

        // 3. Dynamic Load Factor (DLF)
        const staticCargoWeightN = this.totalCargoMassKg * G_ACCEL;
        const dlf = staticCargoWeightN > 0 ? (totalVerticalForceN / staticCargoWeightN) : 1.0;

        const totalHookLoadTonnes = totalVerticalForceN / (G_ACCEL * TONNE);
        const craneCapacityUtilPct = (totalHookLoadTonnes / ratedCapTonnes) * 100;

        // 4. Cargo Attitude
        const euler = SensorEngine.quaternionToEulerDeg(cargoTransform.quaternion);

        this.currentFrame = {
            timestamp: simTime,
            dlf,
            totalHookLoadN: totalVerticalForceN,
            totalHookLoadTonnes,
            craneRadiusM: radiusM,
            craneRatedCapacityTonnes: ratedCapTonnes,
            craneCapacityUtilizationPct: craneCapacityUtilPct,
            isCraneOverloaded: craneCapacityUtilPct > 100,
            isCraneWarning: craneCapacityUtilPct > 90,
            cargo: {
                position: cargoTransform.position,
                pitchDeg: euler.pitch,
                rollDeg: euler.roll,
                yawDeg: euler.yaw,
                linvel: cargoTransform.linvel,
                angvel: cargoTransform.angvel
            },
            cables: cableMetrics
        };

        this.history.push(this.currentFrame);
        if (this.history.length > this.maxHistoryLength) {
            this.history.shift();
        }

        return this.currentFrame;
    }
}
