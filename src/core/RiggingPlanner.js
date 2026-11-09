/**
 * ============================================================================
 * MODULE 2: RIGGING PLANNER (RiggingPlanner.js)
 * Architecture: CAE / Industrial Grade WebGL Physics Simulator
 * Mode: Kinematic Setup Mode (Interactive Geometric Rigging without Physics)
 * Standards: ASME B30.9 (Slings), ASME B30.20 (Below-the-Hook), ISO 3874
 * ============================================================================
 */

import * as THREE from 'three';

export class RiggingPlanner {
    constructor() {
        this.plan = {
            version: '2.0-CAE-RIGGING-PLAN',
            units: 'SI_METRIC',
            timestamp: new Date().toISOString(),
            cargo: {
                id: 'container_20ft',
                name: 'ISO 22G1 20ft Shipping Container',
                massKg: 24000,
                dimensions: { x: 6.06, y: 2.59, z: 2.44 },
                cogLocal: { x: 0.0, y: -0.1, z: 0.0 },
                padEyes: [
                    { id: 'pe_0', localPos: { x:  2.94, y: 1.295, z:  1.13 }, shackleId: 'crosby_17t', wllT: 17.0 },
                    { id: 'pe_1', localPos: { x: -2.94, y: 1.295, z:  1.13 }, shackleId: 'crosby_17t', wllT: 17.0 },
                    { id: 'pe_2', localPos: { x: -2.94, y: 1.295, z: -1.13 }, shackleId: 'crosby_17t', wllT: 17.0 },
                    { id: 'pe_3', localPos: { x:  2.94, y: 1.295, z: -1.13 }, shackleId: 'crosby_17t', wllT: 17.0 }
                ]
            },
            crane: {
                type: 'sts_post_panamax',
                name: 'Post-Panamax STS Container Crane',
                hookPosition: { x: 0.0, y: 10.5, z: 0.0 },
                winch: {
                    maxSpeedMps: 0.8,
                    minSpeedMps: 0.12,
                    stallForceN: 650000, // 65-tonne winch capacity limit
                    cableCount: 4,
                    criticalDamping: 0.99
                }
            },
            rigging: {
                type: 'container_spreader', // 'container_spreader' | 'spreader_beam' | 'bridle_4leg'
                spreaderMassKg: 9500,
                spreaderDimensions: { x: 6.06, y: 0.65, z: 2.44 },
                spreaderWllT: 50.0,
                topBridle: {
                    active: true,
                    cableType: 'wire_rope_6x36_iwrc',
                    diaMm: 32,
                    mblT: 125.0,
                    wllT: 25.0, // SF = 5.0
                    lengthM: 6.47
                },
                lowerLegs: [
                    { id: 'leg_0', padEyeIndex: 0, cableType: 'twistlock_direct', lengthM: 0.35, wllT: 17.0 },
                    { id: 'leg_1', padEyeIndex: 1, cableType: 'twistlock_direct', lengthM: 0.35, wllT: 17.0 },
                    { id: 'leg_2', padEyeIndex: 2, cableType: 'twistlock_direct', lengthM: 0.35, wllT: 17.0 },
                    { id: 'leg_3', padEyeIndex: 3, cableType: 'twistlock_direct', lengthM: 0.35, wllT: 17.0 }
                ]
            }
        };

        // Kinematic visual helpers
        this.selectedPadEyeIndex = null;
        this.listeners = new Set();
    }

    /**
     * Updates cargo configuration and updates pad-eye default positions.
     */
    setCargo(id, name, dimensions, massKg, cogLocal = { x: 0, y: 0, z: 0 }) {
        this.plan.cargo.id = id;
        this.plan.cargo.name = name;
        this.plan.cargo.dimensions = { ...dimensions };
        this.plan.cargo.massKg = massKg;
        this.plan.cargo.cogLocal = { ...cogLocal };

        // Automatically position 4 symmetric corner pad-eyes
        const hx = dimensions.x / 2 - 0.09;
        const hy = dimensions.y / 2;
        const hz = dimensions.z / 2 - 0.09;

        this.plan.cargo.padEyes = [
            { id: 'pe_0', localPos: { x:  hx, y: hy, z:  hz }, shackleId: 'crosby_17t', wllT: 17.0 },
            { id: 'pe_1', localPos: { x: -hx, y: hy, z:  hz }, shackleId: 'crosby_17t', wllT: 17.0 },
            { id: 'pe_2', localPos: { x: -hx, y: hy, z: -hz }, shackleId: 'crosby_17t', wllT: 17.0 },
            { id: 'pe_3', localPos: { x:  hx, y: hy, z: -hz }, shackleId: 'crosby_17t', wllT: 17.0 }
        ];

        // Adapt spreader span to match cargo length
        if (this.plan.rigging.type === 'container_spreader') {
            this.plan.rigging.spreaderDimensions.x = dimensions.x;
            this.plan.rigging.spreaderDimensions.z = dimensions.z;
        }

        this.notifyChange();
    }

    /**
     * Updates an individual pad-eye's position on the cargo.
     */
    updatePadEye(index, localPos, wllT = 17.0) {
        if (index >= 0 && index < this.plan.cargo.padEyes.length) {
            this.plan.cargo.padEyes[index].localPos = { ...localPos };
            if (wllT) this.plan.cargo.padEyes[index].wllT = wllT;
            this.notifyChange();
        }
    }

    /**
     * Configures the spreader beam assembly or bridle.
     */
    setRiggingGear(type, spreaderMassKg = 9500, slingLengthM = 3.8) {
        this.plan.rigging.type = type;
        this.plan.rigging.spreaderMassKg = spreaderMassKg;
        this.plan.rigging.topBridle.lengthM = slingLengthM;

        if (type === 'bridle_4leg') {
            // Direct 4-leg bridle from crane hook directly to cargo
            this.plan.rigging.spreaderMassKg = 0;
            this.plan.rigging.lowerLegs = this.plan.cargo.padEyes.map((_, i) => ({
                id: `leg_${i}`,
                padEyeIndex: i,
                cableType: 'wire_rope_6x36_iwrc',
                lengthM: slingLengthM,
                wllT: 15.0
            }));
        } else {
            // Spreader with direct twistlocks or vertical drops
            this.plan.rigging.lowerLegs = this.plan.cargo.padEyes.map((_, i) => ({
                id: `leg_${i}`,
                padEyeIndex: i,
                cableType: 'twistlock_direct',
                lengthM: 0.35,
                wllT: 17.0
            }));
        }

        this.notifyChange();
    }

    /**
     * Evaluates theoretical geometric sling tension factors (ASME B30.9).
     * Calculates angle to horizontal beta and tension multiplier.
     */
    evaluateKinematicTensionFactors() {
        const { cargo, rigging, crane } = this.plan;
        const totalMassKg = cargo.massKg + rigging.spreaderMassKg;
        const totalWeightN = totalMassKg * 9.81;

        const results = [];
        const hookY = crane.hookPosition.y;

        cargo.padEyes.forEach((pe, i) => {
            const leg = rigging.lowerLegs[i];
            const dropH = Math.max(0.2, (hookY - 1.5) - pe.localPos.y);
            const spanX = Math.abs(pe.localPos.x);
            const spanZ = Math.abs(pe.localPos.z);
            const planRadius = Math.hypot(spanX, spanZ);

            const chordLength = Math.hypot(planRadius, dropH);
            const betaRad = Math.asin(Math.min(1.0, Math.max(0.1, dropH / chordLength)));
            const betaDeg = betaRad * (180 / Math.PI);
            const tensionFactor = 1 / Math.sin(betaRad);

            // Estimated static share with CoG factor
            const staticShareN = (totalWeightN / cargo.padEyes.length) * tensionFactor;
            const staticShareT = staticShareN / 9810;

            results.push({
                index: i,
                padEyeId: pe.id,
                betaDeg: Math.round(betaDeg * 10) / 10,
                tensionFactor: Math.round(tensionFactor * 100) / 100,
                estimatedTensionT: Math.round(staticShareT * 10) / 10,
                wllT: pe.wllT,
                utilizationPct: Math.round((staticShareT / pe.wllT) * 1000) / 10
            });
        });

        return {
            totalGrossMassKg: totalMassKg,
            totalGrossWeightN: totalWeightN,
            legs: results
        };
    }

    /**
     * Exports the clean, serializable Rigging Plan JSON manifest.
     */
    exportRiggingPlanJSON() {
        this.plan.timestamp = new Date().toISOString();
        return JSON.parse(JSON.stringify(this.plan));
    }

    /**
     * Imports a pre-saved Rigging Plan JSON manifest.
     */
    importRiggingPlanJSON(json) {
        if (!json || !json.cargo || !json.rigging) {
            throw new Error('[RiggingPlanner] Invalid RiggingPlanJSON format.');
        }
        this.plan = JSON.parse(JSON.stringify(json));
        this.notifyChange();
    }

    subscribe(callback) {
        this.listeners.add(callback);
        return () => this.listeners.delete(callback);
    }

    notifyChange() {
        const exported = this.exportRiggingPlanJSON();
        this.listeners.forEach(fn => fn(exported));
    }
}
