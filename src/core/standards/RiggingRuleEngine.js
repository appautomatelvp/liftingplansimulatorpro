/**
 * ============================================================================
 * RIGGING RULE ENGINE (SINGLE SOURCE OF TRUTH)
 * Standardizing Slings, Hardware, MBL, WLL, Mass, and Safety Factors
 * ============================================================================
 */

import { computeWireRopeSpec, WIRE_ROPE_DIAMETERS_MM, WIRE_ROPE_SAFETY_FACTOR_MIN } from './wireRope.js';
import { computeChainSpec, CHAIN_DIAMETERS_MM, CHAIN_SAFETY_FACTOR_MIN, BLOCKED_CHAIN_GRADES } from './chain.js';
import { computeSyntheticSlingSpec, WEBBING_WIDTHS_MM, SYNTHETIC_SAFETY_FACTOR_MIN } from './syntheticSling.js';

export const SLING_TYPES = Object.freeze({
    WIRE: 'wire',
    CHAIN: 'chain',
    WEB: 'web',
    ROUND_SLING: 'round_sling',
    GROMMET: 'grommet'
});

export const STANDARD_SAFETY_FACTORS = Object.freeze({
    wire: WIRE_ROPE_SAFETY_FACTOR_MIN,       // 5.0
    chain: CHAIN_SAFETY_FACTOR_MIN,          // 4.0
    web: SYNTHETIC_SAFETY_FACTOR_MIN,        // 7.0
    round_sling: SYNTHETIC_SAFETY_FACTOR_MIN,// 7.0
    grommet: WIRE_ROPE_SAFETY_FACTOR_MIN     // 5.0
});

/**
 * Normalizes legacy or shorthand grade strings into standardized keys.
 */
export function normalizeGrade(gradeStr) {
    if (!gradeStr) return null;
    const str = String(gradeStr).toLowerCase().trim();
    if (str.includes('120')) return 'g120';
    if (str.includes('100')) return 'g100';
    if (str.includes('80') || str === 'chain_g80') return 'g80';
    if (str === 'g30' || str === 'g43' || str === 'g70') return str;
    if (str.includes('hmpe') || str.includes('dyneema')) return 'hmpe';
    if (str.includes('poly') || str.includes('pes')) return 'poly';
    if (str.includes('fc') || str.includes('fiber')) return 'fc_1770';
    if (str.includes('2160')) return 'iwrc_2160';
    if (str.includes('1770')) return 'iwrc_1770';
    return 'iwrc_1960'; // Default wire rope grade
}

/**
 * Normalizes sling type, considering grade hints if type is missing.
 */
export function normalizeSlingType(typeStr, gradeStr) {
    if (typeStr) {
        const t = String(typeStr).toLowerCase().trim();
        if (t === 'chain' || t === 'wire' || t === 'web' || t === 'round_sling' || t === 'grommet') return t;
    }
    const g = String(gradeStr || '').toLowerCase();
    if (g.includes('chain') || g === 'g80' || g === 'g100' || g === 'g120') return 'chain';
    if (g.includes('poly') || g.includes('pes')) return 'web';
    if (g.includes('hmpe')) return 'round_sling';
    return 'wire';
}

/**
 * Returns available catalog sizes (diameters / widths in mm).
 */
export function getSlingDiameterCatalog(type = 'wire') {
    switch (type) {
        case 'chain': return CHAIN_DIAMETERS_MM;
        case 'web': return WEBBING_WIDTHS_MM;
        case 'round_sling': return [24, 32, 40, 46, 52, 58, 66, 85];
        case 'grommet': return [16, 18, 20, 22, 24, 26, 28, 32, 36, 40, 48, 56];
        case 'wire':
        default: return WIRE_ROPE_DIAMETERS_MM;
    }
}

/**
 * Migrates and validates a raw sling record in-place, ensuring all required fields are present.
 */
export function migrateSlingRecord(rec, defaultGlobalType = 'chain') {
    if (!rec) return rec;
    const type = rec.slingType || normalizeSlingType(defaultGlobalType, rec.grade);
    rec.slingType = type;

    // Standardize grade
    if (!rec.grade) {
        if (type === 'chain') rec.grade = 'g80';
        else if (type === 'web' || type === 'round_sling') rec.grade = 'poly';
        else rec.grade = 'iwrc_1960';
    } else {
        rec.grade = normalizeGrade(rec.grade);
    }

    // Default safety factor per international standard
    const stdSf = STANDARD_SAFETY_FACTORS[type] || 5.0;
    if (rec.sf == null || rec.sf < stdSf) {
        rec.sf = stdSf;
    }

    // Default parts
    if (!rec.parts || rec.parts < 1) rec.parts = 1;

    // Default diameter matching catalog
    if (!rec.diaMm || rec.diaMm <= 0) {
        if (type === 'chain') rec.diaMm = 16;
        else if (type === 'web') rec.diaMm = 60;
        else if (type === 'round_sling') rec.diaMm = 40;
        else if (type === 'grommet') rec.diaMm = 22;
        else rec.diaMm = 22;
    }

    return rec;
}

/**
 * Resolves full verified engineering specifications for ANY sling component.
 * SINGLE SOURCE OF TRUTH for UI, Physics, Compliance, 3D Mesh & BOM.
 */
export function resolveSling(rec, {
    lengthMFallback = 2.5,
    globalType = null
} = {}) {
    const rawType = (rec && rec.slingType) || globalType || (rec && rec.grade && normalizeSlingType(null, rec.grade)) || 'wire';
    const type = normalizeSlingType(rawType, rec && rec.grade);
    const grade = normalizeGrade(rec && rec.grade);
    const parts = Math.max(1, Math.min(4, (rec && rec.parts) || 1));
    const L = Math.max(0.3, Number((rec && rec.lengthM) != null ? rec.lengthM : lengthMFallback));
    const minStdSf = STANDARD_SAFETY_FACTORS[type] || 5.0;
    const currentSf = Math.max(minStdSf, Number((rec && rec.sf) || minStdSf));

    let spec = null;
    let label = '';
    const errors = [];
    const warnings = [];

    if (type === 'chain') {
        const d = (rec && rec.diaMm) || 16;
        spec = computeChainSpec({
            diameterMm: d,
            grade: grade || 'g80',
            lengthM: L,
            parts,
            sf: currentSf,
            edgeRadiusMm: rec && rec.edgeRadiusMm,
            hasCornerProtector: rec && rec.cornerProtector
        });
        if (spec.isBlocked) {
            errors.push({ code: 'CHAIN_GRADE_BLOCKED', message: spec.error });
        }
        label = `Xích hợp kim ${spec.grade ? spec.grade.toUpperCase() : 'G80'} · EN 818`;
    } else if (type === 'web') {
        const width = (rec && rec.diaMm) || 60;
        spec = computeSyntheticSlingSpec({
            slingType: 'web',
            widthOrDiaMm: width,
            material: (grade === 'hmpe') ? 'hmpe' : 'poly',
            lengthM: L,
            parts,
            sf: currentSf
        });
        label = `Cáp vải dẹt ${spec.widthOrDiaMm}mm · EN 1492-1`;
    } else if (type === 'round_sling') {
        const dia = (rec && rec.diaMm) || 40;
        spec = computeSyntheticSlingSpec({
            slingType: 'round_sling',
            widthOrDiaMm: dia,
            material: (grade === 'hmpe') ? 'hmpe' : 'poly',
            lengthM: L,
            parts,
            sf: currentSf
        });
        label = `Cáp vải tròn Ø${spec.widthOrDiaMm}mm · EN 1492-2`;
    } else if (type === 'grommet') {
        const d = (rec && rec.diaMm) || 22;
        const wireSpec = computeWireRopeSpec({
            diameterMm: d,
            tensileGrade: 1960,
            core: 'iwrc',
            lengthM: L,
            parts: parts * 2, // 2 body legs in endless grommet
            sf: currentSf
        });
        // Grommet efficiency factor per IMCA M179 ≈ 1.8x single wire rope MBL
        spec = {
            ...wireSpec,
            standard: 'IMCA M179 / ASME B30.9 (Endless Grommet)',
            slingType: 'grommet',
            mblT: Number((wireSpec.mblT * 0.90).toFixed(2)), // 1.8 / 2 = 0.9 efficiency on doubled parts
            wllT: Number(((wireSpec.mblT * 0.90) / currentSf).toFixed(2)),
            massKg: Number((wireSpec.massKg * 1.08).toFixed(1)) // seizing and core tucks
        };
        label = `Cáp vòng kín Grommet Ø${d}mm · IMCA M179`;
    } else {
        // Standard Steel Wire Rope IWRC / FC
        const d = (rec && rec.diaMm) || 22;
        const Rr = (grade === 'iwrc_2160') ? 2160 : ((grade === 'iwrc_1770' || grade === 'fc_1770') ? 1770 : 1960);
        const coreKey = (grade && grade.startsWith('fc')) ? 'fc' : 'iwrc';
        spec = computeWireRopeSpec({
            diameterMm: d,
            tensileGrade: Rr,
            core: coreKey,
            lengthM: L,
            parts,
            sf: currentSf
        });
        label = `Cáp thép ${d}mm ${coreKey.toUpperCase()} ${Rr} N/mm² · ISO 2408`;
    }

    // Handle Manual Overrides with Validation
    const isAutoSwl = (rec && rec.swlT) == null;
    const isAutoMass = (rec && rec.massKg) == null;

    let resolvedWllT = isAutoSwl ? spec.wllT : Number(rec.swlT);
    let resolvedMassKg = isAutoMass ? spec.massKg : Number(rec.massKg);

    // Validation: Manual SWL cannot exceed calculated standard WLL (MBL / SF)
    if (!isAutoSwl && resolvedWllT > spec.wllT * 1.02) {
        warnings.push({
            code: 'SWL_EXCEEDS_STANDARD',
            message: `Tải trọng người dùng nhập (${resolvedWllT} t) vượt quá tải trọng chuẩn (${spec.wllT} t) theo ${spec.standard}!`
        });
    }

    return {
        isValid: errors.length === 0,
        slingType: type,
        grade: grade || spec.grade,
        label,
        standard: spec.standard,
        diameterMm: spec.diameterMm || spec.widthOrDiaMm,
        parts,
        lengthM: L,
        sf: currentSf,
        minStdSf,
        isAutoSwl,
        isAutoMass,
        autoSwlT: spec.wllT,
        autoMassKg: spec.massKg,
        wllT: resolvedWllT,
        wllEffectiveT: (spec.effectiveWllT != null && isAutoSwl) ? spec.effectiveWllT : resolvedWllT,
        mblT: spec.mblT,
        linearKgPerM: spec.linearKgPerM,
        endHardwareMassKg: spec.endHardwareMassKg,
        massKg: resolvedMassKg,
        E_GPa: spec.E_GPa,
        EA_MN: spec.EA_MN,
        colorHex: spec.colorHex || '#94a3b8',
        stripeCount: spec.stripeCount || 0,
        errors,
        warnings
    };
}
