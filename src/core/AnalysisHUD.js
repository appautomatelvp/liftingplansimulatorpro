/**
 * ============================================================================
 * MODULE 4: ANALYSIS & TELEMETRY HUD (AnalysisHUD.js)
 * Architecture: CAE / Industrial Grade WebGL Physics Simulator
 * Telemetry: Real-time Tension Vector Evaluation, WLL Exceedance, CoG & Tilt
 * ============================================================================
 */

import * as THREE from 'three';

export class AnalysisHUD {
    constructor(domContainerId = 'dock-hud') {
        this.container = document.getElementById(domContainerId);
        this.statusLed = document.getElementById('status-led');
        this.statusText = document.getElementById('sim-status-text');

        // Dynamic 3D Floating Tension Vectors and Labels
        this.vectorArrows = [];
        this.labels = [];
    }

    /**
     * Updates the UI elements based on live telemetry from SimulationEngine.
     *
     * @param {Object} telemetry Data object from SimulationEngine
     * @param {Object} plan Current Rigging Plan
     */
    update(telemetry, plan) {
        if (!telemetry) return;

        const {
            grossMassKg,
            hoistMotorSpeedMps,
            hoistMotorLoadPct,
            tensions,
            cargoRotationDeg,
            groundClearanceM
        } = telemetry;

        // Check for any WLL exceedance across all rigging legs
        const hasOverload = tensions.some(t => t.isOverloaded);
        const maxUtil = tensions.reduce((max, t) => Math.max(max, t.utilizationPct || 0), 0);

        // 1. Executive Status LED & Text Update
        if (this.statusLed && this.statusText) {
            if (hasOverload) {
                this.statusLed.className = 'w-2.5 h-2.5 rounded-full bg-rose-500 shadow-[0_0_12px_#f43f5e] animate-pulse';
                this.statusText.textContent = `CẢNH BÁO QUÁ TẢI (MAX ${Math.round(maxUtil)}% WLL)`;
                this.statusText.className = 'text-xs font-mono font-bold text-rose-300';
            } else if (maxUtil > 85) {
                this.statusLed.className = 'w-2.5 h-2.5 rounded-full bg-amber-400 shadow-[0_0_10px_#fbbf24]';
                this.statusText.textContent = `CẬN TẢI CHO PHÉP (${Math.round(maxUtil)}% WLL)`;
                this.statusText.className = 'text-xs font-mono font-bold text-amber-300';
            } else {
                this.statusLed.className = 'w-2.5 h-2.5 rounded-full bg-emerald-400 shadow-[0_0_10px_#34d399]';
                this.statusText.textContent = 'MÔ PHỎNG AN TOÀN (B30.9)';
                this.statusText.className = 'text-xs font-mono font-bold text-emerald-300';
            }
        }

        // 2. Update Dock HUD Cards if present
        const elGross = document.getElementById('hud-gross-mass');
        if (elGross) elGross.textContent = `${(grossMassKg / 1000).toFixed(1)} T`;

        const elTilt = document.getElementById('hud-cargo-tilt');
        if (elTilt) {
            const tiltMax = Math.max(Math.abs(cargoRotationDeg.pitch), Math.abs(cargoRotationDeg.roll));
            elTilt.textContent = `${tiltMax.toFixed(1)}°`;
            elTilt.className = tiltMax > 5.0 ? 'text-rose-400 font-bold' : (tiltMax > 2.5 ? 'text-amber-400' : 'text-emerald-400');
        }

        const elClear = document.getElementById('hud-clearance');
        if (elClear) elClear.textContent = `${groundClearanceM.toFixed(2)} m`;

        const elMotor = document.getElementById('hud-motor-load');
        if (elMotor) elMotor.textContent = `${hoistMotorLoadPct}% (${hoistMotorSpeedMps.toFixed(2)} m/s)`;

        // 3. Update Individual Leg Labels (LP1..LP4)
        tensions.forEach((leg, i) => {
            const lbl = document.getElementById(`lbl-t${i}`);
            if (lbl) {
                lbl.textContent = `LP${i + 1}: ${leg.tensionT.toFixed(1)}T (${leg.utilizationPct}%)`;
                if (leg.isOverloaded) {
                    lbl.className = 'label-3d !border-rose-500 !text-rose-300 !bg-rose-950/90 shadow-[0_0_12px_rgba(244,63,94,0.6)] animate-pulse';
                } else if (leg.utilizationPct > 85) {
                    lbl.className = 'label-3d !border-amber-500 !text-amber-300 !bg-amber-950/90';
                } else {
                    lbl.className = 'label-3d !border-emerald-500 !text-emerald-300 !bg-slate-900/90';
                }
            }
        });
    }

    /**
     * Formats engineering numbers cleanly with metric units.
     */
    static formatForce(n) {
        if (n >= 10000) return `${(n / 1000).toFixed(1)} kN`;
        return `${Math.round(n)} N`;
    }

    static formatMass(kg) {
        if (kg >= 1000) return `${(kg / 1000).toFixed(2)} t`;
        return `${Math.round(kg)} kg`;
    }
}
