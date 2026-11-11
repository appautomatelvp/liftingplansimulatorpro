/**
 * ============================================================================
 * STEEL GRADES & MATERIAL MATRICES (ASME BTH-1 / AISC / EN 10025)
 * ============================================================================
 */

export const STEEL_GRADES = Object.freeze({
    A36: {
        id: 'A36',
        name: 'ASTM A36 Structural Carbon Steel',
        standard: 'ASTM A36',
        Fy: 250.0, // Yield Strength (MPa = N/mm²)
        Fu: 400.0, // Ultimate Tensile Strength (MPa)
        E_GPa: 200.0,
        densityKgM3: 7850
    },
    A572_50: {
        id: 'A572_50',
        name: 'ASTM A572 Grade 50 High-Strength Low-Alloy',
        standard: 'ASTM A572',
        Fy: 345.0,
        Fu: 450.0,
        E_GPa: 205.0,
        densityKgM3: 7850
    },
    S355JR: {
        id: 'S355JR',
        name: 'EN 10025-2 S355JR Non-Alloy Structural Steel',
        standard: 'EN 10025-2',
        Fy: 355.0,
        Fu: 470.0,
        E_GPa: 210.0,
        densityKgM3: 7850
    },
    SS400: {
        id: 'SS400',
        name: 'JIS G3101 SS400 General Structural Steel',
        standard: 'JIS G3101',
        Fy: 245.0,
        Fu: 400.0,
        E_GPa: 200.0,
        densityKgM3: 7850
    },
    Q355B: {
        id: 'Q355B',
        name: 'GB/T 1591 Q355B High Strength Structural Steel',
        standard: 'GB/T 1591',
        Fy: 355.0,
        Fu: 470.0,
        E_GPa: 206.0,
        densityKgM3: 7850
    }
});

export const DESIGN_CATEGORIES = Object.freeze({
    A: {
        id: 'A',
        name: 'Category A (Controlled Environment)',
        description: 'Môi trường cẩu tiêu chuẩn, tải trọng xác định chính xác, tải động thấp.',
        Nd: 2.0 // Design Factor per ASME BTH-1
    },
    B: {
        id: 'B',
        name: 'Category B (Severe / Offshore / Marine)',
        description: 'Môi trường khắc nghiệt ngoài khơi, cảng biển, công trường nặng, có rung lắc và giật động.',
        Nd: 3.0 // Design Factor per ASME BTH-1
    }
});

export function getSteelGradeSpec(steelGradeId = 'S355JR') {
    const s = STEEL_GRADES[steelGradeId];
    if (!s) return null;
    return {
        ...s,
        yieldMPa: s.Fy,
        tensileMPa: s.Fu
    };
}

export function getDesignCategorySpec(categoryId = 'B') {
    return DESIGN_CATEGORIES[categoryId] || null;
}

export function getAllowableStress(steelGradeId = 'S355JR', categoryId = 'B') {
    const steel = STEEL_GRADES[steelGradeId] || STEEL_GRADES.S355JR;
    const cat = DESIGN_CATEGORIES[categoryId] || DESIGN_CATEGORIES.B;
    const sigmaAllow = steel.Fy / cat.Nd;
    const tauAllow = (0.577 * steel.Fy) / cat.Nd; // Von Mises pure shear limit
    const sigmaAllow_MPa = Number(sigmaAllow.toFixed(2));
    const tauAllow_MPa = Number(tauAllow.toFixed(2));
    return {
        steel,
        category: cat,
        sigmaAllow_MPa,
        tauAllow_MPa,
        allowableBendingMPa: sigmaAllow_MPa,
        allowableShearMPa: tauAllow_MPa
    };
}
