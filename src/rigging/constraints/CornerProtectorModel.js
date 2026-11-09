/**
 * ============================================================================
 * CORNER PROTECTOR & WEAR PAD MECHANICS (CornerProtectorModel.js)
 * Standards: ASME B30.9 D/d Ratio Sling Efficiency Table & Capstan Friction
 * ============================================================================
 */

export class CornerProtectorModel {
    /**
     * Computes sling bending efficiency eta based on D/d ratio (ASME B30.9 Table with Smooth Interpolation)
     * D = Diameter of bend curvature (or 2 * corner radius)
     * d = Diameter of wire rope / sling
     * @param {number} cornerRadiusMm - Corner edge radius in mm
     * @param {number} slingDiameterMm - Sling body diameter in mm
     * @returns {number} Efficiency factor between 0.0 and 1.0
     */
    static getBendEfficiency(cornerRadiusMm, slingDiameterMm) {
        const D = Math.max(0.5, 2 * cornerRadiusMm);
        const d = Math.max(1, slingDiameterMm);
        const ratio = D / d;

        if (ratio >= 25) return 1.0;
        if (ratio >= 20) return 0.97 + (ratio - 20) * (0.03 / 5);
        if (ratio >= 15) return 0.94 + (ratio - 15) * (0.03 / 5);
        if (ratio >= 10) return 0.92 + (ratio - 10) * (0.02 / 5);
        if (ratio >= 6) return 0.85 + (ratio - 6) * (0.07 / 4);
        if (ratio >= 4) return 0.80 + (ratio - 4) * (0.05 / 2);
        if (ratio >= 3) return 0.75 + (ratio - 3) * (0.05 / 1);
        if (ratio >= 2) return 0.65 + (ratio - 2) * (0.10 / 1);
        if (ratio >= 1) return 0.50 + (ratio - 1) * (0.15 / 1);
        if (ratio >= 0.5) return 0.35 + (ratio - 0.5) * (0.15 / 0.5);
        return Math.max(0.10, ratio * 0.5);
    }

    /**
     * Capstan friction equation for cable sliding over edge protector
     * T_out = T_in * exp(-mu * contactAngleRad)
     * @param {number} tensionInN - Input tension from winch/hook
     * @param {number} contactAngleRad - Wrap angle over corner
     * @param {number} frictionCoeff - Friction mu
     * @returns {{ tensionOutN: number, frictionLossN: number }}
     */
    static computeCapstanFriction(tensionInN, contactAngleRad, frictionCoeff = 0.25) {
        const factor = Math.exp(-frictionCoeff * Math.abs(contactAngleRad));
        const tensionOutN = tensionInN * factor;
        return {
            tensionOutN,
            frictionLossN: tensionInN - tensionOutN
        };
    }
}
