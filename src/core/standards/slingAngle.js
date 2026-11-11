/**
 * ============================================================================
 * SLING ANGLE KINEMATICS & LOAD ANGLE FACTOR (ASME B30.9 / DNV-ST-N001)
 * ============================================================================
 */

export const MINIMUM_SAFE_ANGLE_DEG = 30.0;
export const RECOMMENDED_ANGLE_DEG = 60.0;
export const CAUTION_ANGLE_DEG = 45.0;

/**
 * Calculates Load Angle Factor (LAF) per ASME B30.9: LAF = 1 / sin(alpha)
 * where alpha is the horizontal angle of the sling leg (0° < alpha <= 90°).
 */
export function lafOf(alphaDeg = 60.0) {
    const clamped = Math.max(1.0, Math.min(90.0, Number(alphaDeg) || 60.0));
    const rad = (clamped * Math.PI) / 180.0;
    return Number((1.0 / Math.sin(rad)).toFixed(4));
}

export const computeLoadAmplificationFactor = lafOf;

/**
 * Evaluates sling angle safety status.
 * Per user directive: Angle < 30° triggers a RED CRITICAL WARNING banner,
 * but allows physical simulation to continue.
 */
export function evaluateAngleStatus(alphaDeg = 60.0) {
    const alpha = Number(alphaDeg) || 0;
    const laf = lafOf(alpha);

    if (alpha < MINIMUM_SAFE_ANGLE_DEG) {
        return {
            status: 'CRITICAL',
            isCritical: true,
            isWarning: true,
            isSafe: false,
            allowSimulation: true,
            alertColor: '#ef4444',
            alphaDeg: Number(alpha.toFixed(1)),
            laf,
            messageVi: `CẢNH BÁO NGUY HIỂM NGHIÊM TRỌNG: Góc cẩu α = ${alpha.toFixed(1)}° < 30°! Lực căng tăng vọt (LAF = ${laf.toFixed(2)}x), vi phạm ASME B30.9!`,
            colorClass: 'text-red-400 bg-red-950/80 border-red-600'
        };
    }
    if (alpha < CAUTION_ANGLE_DEG) {
        return {
            status: 'WARNING',
            isCritical: false,
            isWarning: true,
            isSafe: true,
            allowSimulation: true,
            alertColor: '#f59e0b',
            alphaDeg: Number(alpha.toFixed(1)),
            laf,
            messageVi: `CẢNH BÁO: Góc cẩu α = ${alpha.toFixed(1)}° (< 45°). Hệ số tải tăng cao (LAF = ${laf.toFixed(2)}x), ASME B30.9 khuyến nghị ≥ 60°.`,
            colorClass: 'text-amber-300 bg-amber-950/80 border-amber-600'
        };
    }
    return {
        status: 'OK',
        isCritical: false,
        isWarning: false,
        isSafe: true,
        allowSimulation: true,
        alertColor: '#10b981',
        alphaDeg: Number(alpha.toFixed(1)),
        laf,
        messageVi: `Góc cẩu an toàn chuẩn ASME/EN: α = ${alpha.toFixed(1)}° (LAF = ${laf.toFixed(2)}x).`,
        colorClass: 'text-emerald-300 bg-emerald-950/80 border-emerald-600'
    };
}

/**
 * Computes tension in a single sling leg: T = (Static_Share * Kdyn) * LAF
 */
export function computeLegTension(staticShareT = 5.0, kDyn = 1.10, alphaDeg = 60.0) {
    const laf = lafOf(alphaDeg);
    const tensionT = staticShareT * Math.max(1.0, kDyn) * laf;
    return Number(tensionT.toFixed(2));
}
