/**
 * ============================================================================
 * ALLOY STEEL CHAIN SLING SPECIFICATIONS (BS EN 818 / ASME B30.9)
 * ============================================================================
 */

export const CHAIN_DIAMETERS_MM = Object.freeze([
    6, 7, 8, 10, 13, 16, 18, 20, 22, 26, 32
]);

export const CHAIN_GRADES = Object.freeze({
    g80: {
        id: 'g80',
        name: 'Grade 80 Short Link Alloy Steel Chain (EN 818-2)',
        standard: 'BS EN 818-2 / ASME B30.9',
        nominalStress_MPa: 800.0,
        wllFactor_K: 0.0315, // WLL(t) ≈ 0.0315 * d^2
        modulusE_GPa: 200.0,
        sfDefault: 4.0
    },
    g100: {
        id: 'g100',
        name: 'Grade 100 High-Performance Alloy Steel Chain (EN 818-4)',
        standard: 'EN 818-4 / PAS 1061',
        nominalStress_MPa: 1000.0,
        wllFactor_K: 0.0394, // +25% WLL vs G80
        modulusE_GPa: 200.0,
        sfDefault: 4.0
    },
    g120: {
        id: 'g120',
        name: 'Grade 120 Ultra-High-Strength Alloy Steel Chain',
        standard: 'EN 818 Special High Tensile',
        nominalStress_MPa: 1200.0,
        wllFactor_K: 0.0473, // +50% WLL vs G80
        modulusE_GPa: 205.0,
        sfDefault: 4.0
    }
});

// Non-overhead lifting grades strictly blocked by ASME B30.9 and OSHA 1910.184
export const BLOCKED_CHAIN_GRADES = Object.freeze(['g30', 'g43', 'g70']);

export const CHAIN_SAFETY_FACTOR_MIN = 4.0; // ASME B30.9 / EN 818-4

/**
 * Calculates edge radius derating factor per EN 818-6.
 */
export function computeChainEdgeDerate({
    edgeRadiusMm = null,
    dMm = 16,
    hasCornerProtector = false,
    temperatureC = 20
} = {}) {
    if (hasCornerProtector) {
        return { derateFactor: 1.0, isDerated: false, reason: 'Có đệm ke bảo vệ góc (Corner Protector)' };
    }
    let factor = 1.0;
    let reason = 'Đạt tiêu chuẩn an toàn tiếp xúc cạnh bo lớn';
    if (edgeRadiusMm != null && edgeRadiusMm > 0) {
        if (edgeRadiusMm < dMm) {
            factor = 0.50; // EN 818-6 Clause 5: r < d -> 50% WLL
            reason = `Cạnh sắc (r = ${edgeRadiusMm}mm < d = ${dMm}mm), giảm tải 50% theo EN 818-6`;
        } else if (edgeRadiusMm < 2 * dMm) {
            factor = 0.70; // EN 818-6: d <= r < 2d -> 70% WLL
            reason = `Cạnh bo vừa (d <= r < 2d), giảm tải 30% theo EN 818-6`;
        }
    }

    // Temperature derate
    if (temperatureC > 400) {
        factor *= 0.60;
        reason += ' · Nhiệt độ cao > 400°C';
    } else if (temperatureC > 300) {
        factor *= 0.75;
        reason += ' · Nhiệt độ cao > 300°C';
    } else if (temperatureC > 200) {
        factor *= 0.90;
        reason += ' · Nhiệt độ cao > 200°C';
    }

    return {
        derateFactor: Number(factor.toFixed(2)),
        isDerated: factor < 1.0,
        reason
    };
}

export function computeChainSpec({
    diameterMm = 16,
    grade = 'g80',
    lengthM = 2.5,
    parts = 1,
    sf = CHAIN_SAFETY_FACTOR_MIN,
    edgeRadiusMm = null,
    hasCornerProtector = false
} = {}) {
    const gradeKey = String(grade).toLowerCase();

    // Check for blocked non-overhead lifting chain
    if (BLOCKED_CHAIN_GRADES.includes(gradeKey)) {
        return {
            isValid: false,
            isBlocked: true,
            error: `CẢNH BÁO NGUY HIỂM: Xích ${gradeKey.toUpperCase()} (Grade 30/43/70) KHÔNG ĐƯỢC PHÉP dùng cho cẩu kéo nâng hạ người hoặc hàng hoá theo ASME B30.9 / OSHA!`,
            slingType: 'chain',
            wllT: 0,
            mblT: 0
        };
    }

    const d = Math.max(5, Number(diameterMm) || 16);
    const gradeData = CHAIN_GRADES[gradeKey] || CHAIN_GRADES.g80;
    const L = Math.max(0.3, Number(lengthM) || 2.5);
    const p = Math.max(1, Math.min(4, Number(parts) || 1));
    const safetyFactor = Math.max(CHAIN_SAFETY_FACTOR_MIN, Number(sf) || CHAIN_SAFETY_FACTOR_MIN);

    // 1. Mechanical MBL (Breaking strength at standard 4:1) and WLL = MBL / SF
    const baseWllFactor = gradeData.wllFactor_K; // At SF = 4.0
    const singleMblT = baseWllFactor * CHAIN_SAFETY_FACTOR_MIN * d * d;
    const singleWllT = singleMblT / safetyFactor;
    const totalWllT = singleWllT * p;
    const totalMblT = singleMblT * p;

    // 2. Linear mass and end fittings (Master Link + Clevis Eye Hook with Latch)
    const linearKgPerM = 0.0218 * d * d;
    const endHardwareMassKg = 0.0085 * d * d;
    const totalMassKg = p * (linearKgPerM * L + endHardwareMassKg);

    // 3. Edge Derate
    const edgeDerate = computeChainEdgeDerate({ edgeRadiusMm, dMm: d, hasCornerProtector });
    const effectiveWllT = totalWllT * edgeDerate.derateFactor;

    // 4. EA stiffness
    const diaM = d / 1000.0;
    const linkMetalAreaM2 = 2.0 * (Math.PI * diaM * diaM * 0.25); // 2 legs of link carry tension
    const EA_N = (gradeData.modulusE_GPa * 1e9) * linkMetalAreaM2 * p;

    return {
        isValid: true,
        isBlocked: false,
        standard: gradeData.standard,
        slingType: 'chain',
        diameterMm: d,
        grade: gradeData.id,
        gradeName: gradeData.name,
        parts: p,
        lengthM: L,
        sf: safetyFactor,
        linearKgPerM: Number(linearKgPerM.toFixed(3)),
        endHardwareMassKg: Number(endHardwareMassKg.toFixed(2)),
        massKg: Number(totalMassKg.toFixed(1)),
        mblT: Number(totalMblT.toFixed(2)),
        wllT: Number(totalWllT.toFixed(2)),
        effectiveWllT: Number(effectiveWllT.toFixed(2)),
        edgeDerate,
        E_GPa: gradeData.modulusE_GPa,
        EA_MN: Number((EA_N / 1e6).toFixed(1))
    };
}
