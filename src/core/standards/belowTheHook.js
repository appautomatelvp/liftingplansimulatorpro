/**
 * ============================================================================
 * BELOW-THE-HOOK LIFTING DEVICES (ASME BTH-1 / ASME B30.20 / BS EN 13155)
 * ============================================================================
 */

import { STEEL_GRADES, DESIGN_CATEGORIES, getAllowableStress } from './steelGrades.js';

export const G_ACCEL = 9.80665;

/**
 * Checks a Lifting Beam (Dầm nâng chịu uốn) under pure bending and vertical shear.
 */
export function checkLiftingBeam({
    loadT = null,
    bendingMomentMax_kNm = null,
    sectionModulus_Zx_cm3 = null,
    sectionModulusZ_cm3 = null,
    shearForce_kN = null,
    webArea_Aw_cm2 = null,
    shearAreaAv_cm2 = null,
    steelGrade = 'S355JR',
    designCategory = 'B',
    spanM = 6.0
} = {}) {
    const limits = getAllowableStress(steelGrade, designCategory);
    const span = Math.max(0.5, Number(spanM) || 6.0);

    let M_kNm = Number(bendingMomentMax_kNm);
    let V_kN = Number(shearForce_kN);
    if (!isFinite(M_kNm) || M_kNm <= 0) {
        const load = Number(loadT) || 10.0;
        M_kNm = (load * G_ACCEL * span) / 4.0;
    }
    if (!isFinite(V_kN) || V_kN <= 0) {
        const load = Number(loadT) || 10.0;
        V_kN = (load * G_ACCEL) / 2.0;
    }

    const Z_cm3 = Number(sectionModulus_Zx_cm3 || sectionModulusZ_cm3) || 800.0;
    const Aw_cm2 = Number(webArea_Aw_cm2 || shearAreaAv_cm2) || 45.0;

    // Actual bending stress: sigma = M / Zx (MPa)
    const Zx_m3 = (Z_cm3 * 1e-6);
    const sigmaActual_MPa = (M_kNm * 1e3) / Math.max(1e-7, Zx_m3) / 1e6;

    // Actual shear stress: tau = V / Aw (MPa)
    const Aw_m2 = (Aw_cm2 * 1e-4);
    const tauActual_MPa = (V_kN * 1e3) / Math.max(1e-7, Aw_m2) / 1e6;

    const bendingRatio = sigmaActual_MPa / limits.sigmaAllow_MPa;
    const shearRatio = tauActual_MPa / limits.tauAllow_MPa;
    const combinedUnity = Math.sqrt(bendingRatio * bendingRatio + 3 * shearRatio * shearRatio);

    const isSafe = combinedUnity <= 1.0;

    return {
        isValid: isSafe,
        deviceType: 'lifting_beam',
        standard: 'ASME BTH-1 / ASME B30.20',
        steelGrade,
        designCategory,
        allowableStress: limits,
        momentMaxKNm: Number(M_kNm.toFixed(2)),
        shearForceKN: Number(V_kN.toFixed(2)),
        sigmaActual_MPa: Number(sigmaActual_MPa.toFixed(1)),
        tauActual_MPa: Number(tauActual_MPa.toFixed(1)),
        bendingRatio: Number(bendingRatio.toFixed(3)),
        shearRatio: Number(shearRatio.toFixed(3)),
        bendingUtilPercent: Number((bendingRatio * 100).toFixed(1)),
        shearUtilPercent: Number((shearRatio * 100).toFixed(1)),
        combinedUnity: Number(combinedUnity.toFixed(3)),
        isSafe,
        status: isSafe ? 'PASSED_BTH1' : 'OVERSTRESSED_BTH1'
    };
}

/**
 * Checks a Spreader Bar / Strut (Thanh ngáng chịu nén) under axial compression and Euler buckling.
 */
export function checkSpreaderBar({
    slingTension_T_t = null,
    slingTensionT = null,
    slingAngleDeg = null,
    topBridleAngleDeg = null,
    lengthM = null,
    spanM = 6.0,
    outerDiaMm = 219.0,
    wallThickMm = 12.0,
    steelGrade = 'S355JR',
    designCategory = 'B'
} = {}) {
    const limits = getAllowableStress(steelGrade, designCategory);
    const span = Math.max(0.5, Number(lengthM || spanM) || 6.0);
    const angle = Number(topBridleAngleDeg != null ? topBridleAngleDeg : (slingAngleDeg != null ? slingAngleDeg : 60.0));
    const tensionT = Number(slingTensionT != null ? slingTensionT : (slingTension_T_t != null ? slingTension_T_t : 20.0));
    const alphaRad = (Math.max(15, Math.min(85, angle)) * Math.PI) / 180.0;

    // Axial compressive force: Fcomp = (T * cos(alpha)) or T / tan(alpha)
    const Fcomp_t = tensionT * Math.cos(alphaRad);
    const Fcomp_N = Fcomp_t * 1000.0 * G_ACCEL;

    // Pipe section properties
    const D = outerDiaMm / 1000.0;
    const t = wallThickMm / 1000.0;
    const dInner = Math.max(0.01, D - 2 * t);
    const crossAreaM2 = Math.PI * 0.25 * (D * D - dInner * dInner);
    const momentOfInertia_I = (Math.PI / 64.0) * (Math.pow(D, 4) - Math.pow(dInner, 4));
    const radiusOfGyration_r = Math.sqrt(momentOfInertia_I / crossAreaM2);
    const slenderness_lambda = span / Math.max(0.001, radiusOfGyration_r);

    // Euler critical buckling load: Pcr = (pi^2 * E * I) / L^2 (N)
    const E_Pa = limits.steel.E_GPa * 1e9;
    const Pcr_N = (Math.PI * Math.PI * E_Pa * momentOfInertia_I) / (span * span);
    const Pcr_t = Pcr_N / (1000.0 * G_ACCEL);

    // Allowable compressive load: Pall = Pcr / Nd
    const Pall_t = Pcr_t / limits.category.Nd;
    const compressionRatio = Fcomp_t / Math.max(0.1, Pall_t);

    const isSafe = compressionRatio <= 1.0 && slenderness_lambda <= 180;

    return {
        isValid: isSafe,
        deviceType: 'spreader_bar',
        standard: 'ASME BTH-1 / BS EN 13155',
        steelGrade,
        designCategory,
        spanM: span,
        slenderness_lambda: Number(slenderness_lambda.toFixed(1)),
        Fcomp_t: Number(Fcomp_t.toFixed(2)),
        axialCompressionKN: Number((Fcomp_N / 1e3).toFixed(2)),
        Pcr_t: Number(Pcr_t.toFixed(2)),
        eulerPcrKN: Number((Pcr_N / 1e3).toFixed(2)),
        Pall_t: Number(Pall_t.toFixed(2)),
        compressionRatio: Number(compressionRatio.toFixed(3)),
        bucklingUtilPercent: Number((compressionRatio * 100).toFixed(1)),
        isSafe,
        status: isSafe ? 'PASSED_BTH1' : 'BUCKLING_RISK_BTH1'
    };
}
