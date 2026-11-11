/**
 * ============================================================================
 * ELASTIC SLING ELONGATION & 4-LEG STATIC INDETERMINACY ENGINE (ElasticSlingEngine.js)
 * Standards: ASME B30.9 (Slings), DNV-ST-N001 (Marine Operations & Offshore Lifting),
 *            ASME B30.26 (Rigging Hardware - Shackle Side-loading Limits)
 * ============================================================================
 * Purpose:
 *   1. Elastic elongation calculation: Delta_L = (F * L0) / (E * A)
 *   2. Material modulus library: Wire Rope (IWRC), Grade 100 Chain,
 *      Polyester Webbing/Round, HMPE/Dyneema.
 *   3. 4-Leg Static Indeterminacy: DNV skew load factor (diagonal load concentration).
 *   4. Shackle out-of-plane side-loading de-rating curve (Crosby / Green Pin standard).
 * ============================================================================
 */

export const SLING_MATERIALS = {
    WIRE_ROPE_IWRC: {
        id: 'wire',
        name: 'Cáp Thép Lõi Thép (Steel Wire Rope IWRC 6x36)',
        modulusE_GPa: 105.0, // GPa = 105 x 10^9 N/m²
        typicalElongationAtWLL_Pct: 0.8,
        description: 'Độ dãn thấp, độ bền uốn và chịu mài mòn cao'
    },
    ALLOY_CHAIN_GR100: {
        id: 'chain',
        name: 'Cáp Xích Thép Hợp Kim (Alloy Chain Grade 80/100)',
        modulusE_GPa: 195.0,
        typicalElongationAtWLL_Pct: 0.4,
        description: 'Độ dãn cực thấp, kết cấu cứng vững, chịu va đập tốt'
    },
    POLYESTER_WEBBING: {
        id: 'poly',
        name: 'Cáp Vải Bản Dệt Polyester (Synthetic Webbing Sling)',
        modulusE_GPa: 2.8,
        typicalElongationAtWLL_Pct: 4.2, // 3 - 5% elongation at rated load
        description: 'Độ dãn cao (3-5%), êm ái chống trầy xước bề mặt kiện'
    },
    WEBBING_SLING: {
        id: 'web',
        name: 'Cáp Vải Bản Dệt Polyester (Webbing Sling)',
        modulusE_GPa: 2.8,
        typicalElongationAtWLL_Pct: 4.2,
        description: 'Cáp vải bản dẹt mềm, phải được bảo vệ khi qua cạnh sắc'
    },
    ROUND_SLING: {
        id: 'round_sling',
        name: 'Cáp Vải Tròn Polyester (Round Sling)',
        modulusE_GPa: 2.8,
        typicalElongationAtWLL_Pct: 4.2,
        description: 'Lõi sợi chịu lực bọc vỏ, linh hoạt nhưng nhạy với cạnh sắc'
    },
    WIRE_ROPE_GROMMET: {
        id: 'grommet',
        name: 'Cáp Thép Khép Kín (Endless Grommet)',
        modulusE_GPa: 105.0,
        typicalElongationAtWLL_Pct: 0.8,
        description: 'Grommet cáp thép không mối nối dùng cho heavy lift'
    },
    HMPE_DYNEEMA: {
        id: 'dyneema',
        name: 'Cáp Sợi Siêu Bền HMPE / Dyneema (High Modulus Polyethylene)',
        modulusE_GPa: 32.0,
        typicalElongationAtWLL_Pct: 1.2,
        description: 'Siêu nhẹ, độ dãn thấp gần bằng cáp thép'
    }
};

/**
 * International Sling Color Coding & Geometric Matrix per EN 1492-1 (Web) & EN 1492-2 (Round)
 */
export const EN1492_COLOR_TABLE = [
    { maxWllT: 1.0, colorNameVi: 'Tím (1T)', colorHex: '#9333ea', stripeCount: 1, webWidthMm: 30, webThickMm: 5.0, roundDiaMm: 24, linearMassWeb: 0.24, linearMassRound: 0.32 },
    { maxWllT: 2.0, colorNameVi: 'Xanh lá (2T)', colorHex: '#16a34a', stripeCount: 2, webWidthMm: 60, webThickMm: 6.0, roundDiaMm: 32, linearMassWeb: 0.48, linearMassRound: 0.58 },
    { maxWllT: 3.0, colorNameVi: 'Vàng (3T)', colorHex: '#eab308', stripeCount: 3, webWidthMm: 90, webThickMm: 7.0, roundDiaMm: 40, linearMassWeb: 0.74, linearMassRound: 0.85 },
    { maxWllT: 4.0, colorNameVi: 'Xám (4T)', colorHex: '#64748b', stripeCount: 4, webWidthMm: 120, webThickMm: 7.5, roundDiaMm: 46, linearMassWeb: 0.98, linearMassRound: 1.12 },
    { maxWllT: 5.0, colorNameVi: 'Đỏ (5T)', colorHex: '#dc2626', stripeCount: 5, webWidthMm: 150, webThickMm: 8.0, roundDiaMm: 52, linearMassWeb: 1.25, linearMassRound: 1.42 },
    { maxWllT: 6.0, colorNameVi: 'Nâu (6T)', colorHex: '#92400e', stripeCount: 6, webWidthMm: 180, webThickMm: 8.5, roundDiaMm: 58, linearMassWeb: 1.52, linearMassRound: 1.70 },
    { maxWllT: 8.0, colorNameVi: 'Xanh dương (8T)', colorHex: '#2563eb', stripeCount: 8, webWidthMm: 240, webThickMm: 9.0, roundDiaMm: 66, linearMassWeb: 2.05, linearMassRound: 2.25 },
    { maxWllT: Infinity, colorNameVi: 'Cam (Heavy 10T+)', colorHex: '#ea580c', stripeCount: 0, webWidthMm: 300, webThickMm: 10.0, roundDiaMm: 85, linearMassWeb: 2.80, linearMassRound: 3.10 }
];

export function getEN1492ColorSpec(wllT = 2.0) {
    const wll = Math.max(0.1, Number(wllT) || 2.0);
    for (const entry of EN1492_COLOR_TABLE) {
        if (wll <= entry.maxWllT) return entry;
    }
    return EN1492_COLOR_TABLE[EN1492_COLOR_TABLE.length - 1];
}

export function getSlingPhysicalSpec(slingType = 'wire', wllT = 15.0, customDiaMm = null, grade = '') {
    const type = slingType || 'wire';
    const wll = Math.max(0.2, Number(wllT) || 15.0);
    const enSpec = getEN1492ColorSpec(wll);

    let diaMm = customDiaMm;
    let thicknessMm = 0;
    let modulusE_GPa = 105.0;
    let materialId = 'wire';
    let colorHex = '#94a3b8';
    let colorNameVi = 'Thép mạ kẽm / IWRC';
    let stripeCount = 0;
    let linearMassKgPerM = 0;
    let endHardwareMassKg = 0;

    if (type === 'chain') {
        materialId = 'chain';
        modulusE_GPa = 195.0;
        colorHex = '#272b33';
        colorNameVi = (grade === 'g100') ? 'Xích hợp kim Grade 100' : 'Xích hợp kim Grade 80';
        const k = (grade === 'g100') ? 0.0398 : 0.0318;
        if (!diaMm || diaMm <= 0) diaMm = Math.max(6, Math.round(Math.sqrt(wll / k)));
        thicknessMm = diaMm;
        linearMassKgPerM = 0.0218 * diaMm * diaMm;
        endHardwareMassKg = 0.0085 * diaMm * diaMm;
    } else if (type === 'web') {
        materialId = (grade === 'hmpe') ? 'dyneema' : 'poly';
        modulusE_GPa = (grade === 'hmpe') ? 32.0 : 2.8;
        colorHex = enSpec.colorHex;
        colorNameVi = enSpec.colorNameVi;
        stripeCount = enSpec.stripeCount;
        if (!diaMm || diaMm <= 0) diaMm = enSpec.webWidthMm;
        thicknessMm = enSpec.webThickMm;
        linearMassKgPerM = 1.38e-3 * diaMm * thicknessMm;
        endHardwareMassKg = 0.15 + (diaMm / 300) * 0.45;
    } else if (type === 'round_sling') {
        materialId = (grade === 'hmpe') ? 'dyneema' : 'poly';
        modulusE_GPa = (grade === 'hmpe') ? 32.0 : 2.8;
        colorHex = enSpec.colorHex;
        colorNameVi = enSpec.colorNameVi;
        stripeCount = 0; // Round sling does not have black capacity stripes per EN 1492-2
        if (!diaMm || diaMm <= 0) diaMm = enSpec.roundDiaMm;
        thicknessMm = diaMm;
        linearMassKgPerM = 0.00054 * diaMm * diaMm;
        endHardwareMassKg = 0.18;
    } else if (type === 'grommet') {
        materialId = 'wire';
        modulusE_GPa = 105.0;
        colorHex = '#6e7885';
        colorNameVi = 'Cáp thép vòng kín IMCA M179';
        if (!diaMm || diaMm <= 0) diaMm = Math.max(10, Math.round(Math.sqrt(wll / (1.75 * 0.0163))));
        thicknessMm = diaMm;
        linearMassKgPerM = 2 * 0.00425 * diaMm * diaMm;
        endHardwareMassKg = 0.0018 * diaMm * diaMm + 2 * (0.00425 * diaMm * diaMm * 0.35);
    } else { // 'wire'
        materialId = 'wire';
        modulusE_GPa = (grade === 'fc' || String(grade).startsWith('fc')) ? 90.0 : 110.0;
        colorHex = '#6e7885';
        colorNameVi = 'Cáp thép 6x36 IWRC';
        if (!diaMm || diaMm <= 0) diaMm = Math.max(8, Math.round(Math.sqrt((wll * 5.0) / (1.960 * 0.356))));
        thicknessMm = diaMm;
        // User confirmed standard: linear mass factor M = 0.0040 kg/m/mm² (ISO 2408 6x36 IWRC)
        linearMassKgPerM = (grade === 'fc' || String(grade).startsWith('fc')) ? (0.0036 * diaMm * diaMm) : (0.0040 * diaMm * diaMm);
        endHardwareMassKg = 0.0028 * diaMm * diaMm;
    }

    return {
        slingType: type,
        materialId,
        modulusE_GPa,
        diaMm,
        thicknessMm,
        colorHex,
        colorNameVi,
        stripeCount,
        linearMassKgPerM,
        endHardwareMassKg,
        computeMassKg: (lengthM = 2.5, parts = 1) => {
            const L = Math.max(0.3, Number(lengthM) || 2.5);
            const p = Math.max(1, Math.min(4, Number(parts) || 1));
            return p * (linearMassKgPerM * L + endHardwareMassKg);
        }
    };
}

export class ElasticSlingEngine {
    static getEN1492ColorSpec = getEN1492ColorSpec;
    static getSlingPhysicalSpec = getSlingPhysicalSpec;
    static calculateElongation(tT, lM, mType, dMm) {
        return new ElasticSlingEngine().calculateElongation(tT, lM, mType, dMm);
    }

    constructor() {
        this.gravity = 9.80665;
    }

    /**
     * Calculates the cross-sectional structural area A in mm² for a given sling diameter / capacity.
     *
     * @param {string} materialType 'wire' | 'chain' | 'poly' | 'dyneema'
     * @param {number} diameterMm Sling diameter in mm (e.g. 28mm wire rope, 16mm chain)
     * @returns {number} Effective metallic/fiber area A in m²
     */
    static getEffectiveAreaM2(materialType, diameterMm = 28) {
        const d_m = (diameterMm || 28) / 1000;
        let fillFactor = 0.50; // Wire rope metallic area fill factor ~0.50

        if (materialType === 'chain') {
            // 2 cross sections of chain link: 2 * (pi * d^2 / 4)
            return 2 * (Math.PI * Math.pow(d_m, 2) / 4);
        } else if (materialType === 'poly' || materialType === 'web' || materialType === 'round_sling') {
            // Equivalent fiber tensile core area
            fillFactor = 0.40;
        } else if (materialType === 'dyneema') {
            fillFactor = 0.55;
        }

        return (Math.PI * Math.pow(d_m, 2) / 4) * fillFactor;
    }

    /**
     * Calculates Hooke's law elastic elongation for a single sling leg.
     * Formula: Delta_L = (Tension_N * Length_m) / (E * Area_m2)
     *
     * @param {number} tensionTonnes Tension force on the sling leg in Tonnes
     * @param {number} nominalLengthM Unstretched sling length L0 in meters
     * @param {string} materialType 'wire' | 'chain' | 'poly' | 'dyneema'
     * @param {number} [diameterMm=28] Sling diameter in mm
     * @returns {{ deltaL_mm: number, strainPct: number, stretchedLengthM: number }}
     */
    calculateElongation(tensionTonnes, nominalLengthM, materialType = 'wire', diameterMm = 28) {
        let tT = tensionTonnes;
        let lM = nominalLengthM;
        let mType = materialType;
        let dMm = diameterMm;

        // Support both object argument ({ tensionT, lengthM, diaMm, material }) and positional arguments
        if (tensionTonnes && typeof tensionTonnes === 'object') {
            tT = tensionTonnes.tensionT ?? tensionTonnes.tensionTonnes ?? 0;
            lM = tensionTonnes.lengthM ?? tensionTonnes.nominalLengthM ?? 5.0;
            mType = tensionTonnes.material ?? tensionTonnes.materialType ?? 'wire';
            dMm = tensionTonnes.diaMm ?? tensionTonnes.diameterMm ?? 28;
        }

        const aliases = {
            wire_rope_sling: 'wire', webbing_sling: 'web', synthetic_web_sling: 'web',
            chain_sling: 'chain', grommet_sling: 'grommet', polyester: 'poly'
        };
        const normalizedType = aliases[mType] || mType;
        const mat = SLING_MATERIALS[normalizedType?.toUpperCase()] ||
                    Object.values(SLING_MATERIALS).find(m => m.id === normalizedType) ||
                    SLING_MATERIALS.WIRE_ROPE_IWRC;

        const tensionN = Math.max(0, Number(tT) || 0) * 1000 * this.gravity;
        const L0 = Math.max(0.5, Number(lM) || 5.0);
        const E = mat.modulusE_GPa * 1e9; // N/m²
        const A = ElasticSlingEngine.getEffectiveAreaM2(mat.id, dMm);

        const deltaL_m = (tensionN * L0) / (E * A);
        const deltaL_mm = Math.round(deltaL_m * 1000 * 10) / 10;
        const strainPct = Math.round((deltaL_m / L0) * 10000) / 100;
        const stretchedLengthM = Math.round((L0 + deltaL_m) * 1000) / 1000;

        return {
            materialName: mat.name,
            nominalLengthM: L0,
            deltaL_mm,
            strainPct,
            stretchedLengthM
        };
    }

    /**
     * Evaluates an individual sling angle measured from the horizontal.  The
     * 30° / 45° boundaries are the safety rule used by the live planning HUD.
     */
    static evaluateSlingAngle(angleFromHorizontalDeg) {
        const angleDeg = Math.max(0, Math.min(90, Number(angleFromHorizontalDeg) || 0));
        return {
            angleDeg,
            severity: angleDeg < 30 ? 'CRITICAL' : (angleDeg < 45 ? 'WARNING' : 'SAFE'),
            verticalFactor: 1 / Math.max(0.05, Math.sin(angleDeg)),
            messageVi: angleDeg < 30
                ? 'Góc cáp dưới 30°: nguy hiểm theo ASME, lực căng tăng rất mạnh.'
                : (angleDeg < 45 ? 'Góc cáp dưới 45°: cần xem xét giảm tải hoặc tăng khẩu độ.' : 'Góc cáp nằm trong vùng làm việc thông thường.')
        };
    }

    /** Dynamic amplification from measured vertical acceleration / abrupt motion. */
    static dynamicLoadFactor(verticalAccelerationMps2 = 0, hoistSpeedMps = 0) {
        const accel = Math.abs(Number(verticalAccelerationMps2) || 0);
        const speed = Math.abs(Number(hoistSpeedMps) || 0);
        return Math.max(1, Math.min(2.5, 1 + accel / 9.80665 * 0.55 + speed * 0.12));
    }

    /**
     * Static two-pick equilibrium for an equalizer beam or a grab-hook length
     * adjustment. Positive CoG offset is toward the right-hand pick.
     */
    static calculateEqualizerBalance(grossWeightT, cogOffsetM, pickSpanM) {
        const W = Math.max(0, Number(grossWeightT) || 0);
        const halfSpan = Math.max(0.05, Math.abs(Number(pickSpanM) || 0) * 0.5);
        const r = Math.max(-halfSpan, Math.min(halfSpan, Number(cogOffsetM) || 0));
        const leftShareT = W * (halfSpan - r) / (2 * halfSpan);
        const rightShareT = W - leftShareT;
        // For small angles, raising the heavy pick by this differential moves
        // the hook resultant toward the CoG. It is a setup recommendation, not
        // a substitute for a certified lift calculation.
        const grabHookTrimM = Math.abs(r) * 2;
        return {
            leftShareT,
            rightShareT,
            heavySide: r > 0 ? 'right' : (r < 0 ? 'left' : 'balanced'),
            grabHookTrimM,
            isWithinPickSpan: Math.abs(Number(cogOffsetM) || 0) <= halfSpan
        };
    }

    /**
     * Synthetic slings lose a large portion of their breaking capacity over an
     * unprotected sharp edge. Steel chain/rope is retained at nominal MBL here;
     * detailed abrasion damage is a separate inspection concern.
     */
    static evaluateSharpEdgeProtection(materialType, hasCornerProtector, edgeExposed = true) {
        const synthetic = ['web', 'poly', 'round_sling', 'webbing_sling', 'synthetic_web_sling'].includes(materialType);
        const edgeFactor = synthetic && edgeExposed && !hasCornerProtector ? 0.35 : 1;
        return {
            edgeFactor,
            effectiveMblFactor: edgeFactor,
            isCritical: edgeFactor < 1,
            messageVi: edgeFactor < 1
                ? 'Cáp vải/round sling đang tỳ cạnh sắc không có protector: MBL hiệu dụng giảm còn 35%.'
                : 'Không có giảm bền cạnh sắc đang hoạt động.'
        };
    }

    /**
     * Evaluates 4-leg static indeterminacy and diagonal skew load sharing per DNV-ST-N001.
     * For a rigid payload, small length tolerances cause 2 diagonal legs to take 75% to 85% of load.
     *
     * @param {Array<number>} symmetricTensionsT Array of 4 idealized static tensions [T1, T2, T3, T4]
     * @param {boolean} isRigidPayload Whether cargo behaves as a rigid body (Container, Skid, Machine)
     * @param {number} [skewFactor=1.35] DNV Skew Load Factor (typically 1.25 - 1.50)
     * @returns {Object} Realistic load sharing across 4 legs with diagonal overload warning
     */
    evaluateFourLegIndeterminacy(symmetricTensionsT, isRigidPayload = true, skewFactor = 1.35) {
        if (!Array.isArray(symmetricTensionsT) || symmetricTensionsT.length !== 4) {
            return { realisticTensionsT: symmetricTensionsT, heavyPairSharePct: 50.0, hasSkewRisk: false };
        }

        if (!isRigidPayload) {
            // Flexible cargo deforms, distributing load evenly without skew risk
            return {
                realisticTensionsT: symmetricTensionsT.map(t => Math.round(t * 100) / 100),
                skewFactor: 1.0,
                heavyPairSharePct: 50.0,
                hasSkewRisk: false,
                skewDescriptionVi: 'Hàng có độ mềm dẻo, tải trọng phân bổ đều 4 nhánh.'
            };
        }

        // Diagonal pair 1: Leg 0 (+X,+Z) and Leg 2 (-X,-Z)
        // Diagonal pair 2: Leg 1 (-X,+Z) and Leg 3 (+X,-Z)
        // DNV-ST-N001 Rule: Assume Diagonal 1 carries the heavy share (SF * base) and Diagonal 2 carries the remainder
        const totalStaticT = symmetricTensionsT.reduce((a, b) => a + b, 0);
        const sf = Math.max(1.15, Math.min(1.50, Number(skewFactor) || 1.35));

        // When load is at rest or zero tension, retain theoretical DNV-ST-N001 skew share (default ~67.5%)
        if (totalStaticT < 0.001) {
            const defaultSharePct = Math.round((sf / 2) * 1000) / 10;
            return {
                realisticTensionsT: [0, 0, 0, 0],
                skewFactor: sf,
                heavyPairSharePct: defaultSharePct,
                hasSkewRisk: defaultSharePct > 65.0,
                skewDescriptionVi: `Theo chuẩn DNV-ST-N001: 2 nhánh đường chéo gánh ${defaultSharePct}% tổng tải trọng do tính chất siêu tĩnh của vật thể cứng.`
            };
        }

        // Heavily loaded diagonal takes: (totalStaticT / 2) * (sf / 2)
        // Or each leg in the heavy diagonal is multiplied by sf:
        const t0_heavy = symmetricTensionsT[0] * sf;
        const t2_heavy = symmetricTensionsT[2] * sf;
        const heavySum = t0_heavy + t2_heavy;

        // Light diagonal carries remaining load:
        const remainingT = Math.max(0.1, totalStaticT - heavySum);
        const t1_light = remainingT * (symmetricTensionsT[1] / Math.max(0.01, symmetricTensionsT[1] + symmetricTensionsT[3]));
        const t3_light = remainingT * (symmetricTensionsT[3] / Math.max(0.01, symmetricTensionsT[1] + symmetricTensionsT[3]));

        const realisticTensionsT = [
            Math.round(t0_heavy * 100) / 100,
            Math.round(t1_light * 100) / 100,
            Math.round(t2_heavy * 100) / 100,
            Math.round(t3_light * 100) / 100
        ];

        const heavyPairSharePct = Math.round((heavySum / Math.max(0.01, totalStaticT)) * 1000) / 10;

        return {
            realisticTensionsT,
            skewFactor: sf,
            heavyPairSharePct,
            hasSkewRisk: heavyPairSharePct > 65.0,
            skewDescriptionVi: `Theo chuẩn DNV-ST-N001: 2 nhánh đường chéo gánh ${heavyPairSharePct}% tổng tải trọng do tính chất siêu tĩnh của vật thể cứng.`
        };
    }

    /**
     * Calculates shackle out-of-plane side loading de-rating according to ASME B30.26.
     * Standard Crosby / Green Pin de-rating curve:
     *   Angle 0° - 5°: 100% of WLL
     *   Angle 5° - 45°: 70% of WLL
     *   Angle 45° - 90°: 50% of WLL
     *   Angle > 90°: 0% (Strictly Prohibited - pin bending / nut stripping hazard)
     *
     * @param {number} nominalWllT Rated WLL along in-line straight pull (Tonnes)
     * @param {number} outOfPlaneAngleDeg Angle between sling pull direction and pad-eye centerline (degrees)
     * @returns {Object} Effective WLL, de-rating factor, and safety compliance status
     */
    static evaluateShackleSideLoading(nominalWllT, outOfPlaneAngleDeg = 0) {
        const wll = Math.max(0.1, Number(nominalWllT) || 17.0);
        const angle = Math.abs(Number(outOfPlaneAngleDeg) || 0);

        let derateFactor = 1.00;
        let isProhibited = false;
        let status = 'SAFE';
        let alertMessageVi = 'Lực kéo thẳng trục, đạt 100% WLL ma ní.';

        if (angle <= 5.0) {
            derateFactor = 1.00;
            status = 'SAFE';
        } else if (angle <= 45.0) {
            derateFactor = 0.70;
            status = 'WARNING_SIDE_LOAD';
            alertMessageVi = `Góc kéo xiên lệch mặt phẳng tai cẩu ${angle.toFixed(1)}°: Ma ní bị giảm tải xuống 70% WLL theo ASME B30.26.`;
        } else if (angle <= 90.0) {
            derateFactor = 0.50;
            status = 'CRITICAL_SIDE_LOAD';
            alertMessageVi = `CẢNH BÁO: Góc kéo lệch ${angle.toFixed(1)}° (> 45°): Ma ní chỉ còn 50% sức tải WLL! Nguy cơ uốn cong chốt ren ma ní.`;
        } else {
            derateFactor = 0.00;
            isProhibited = true;
            status = 'PROHIBITED';
            alertMessageVi = `NGHIÊM CẤM (ASME B30.26): Góc kéo lệch ${angle.toFixed(1)}° (> 90°). Ma ní bị uốn ngược, nghiêm cấm thao tác cẩu!`;
        }

        const effectiveWllT = Math.round(wll * derateFactor * 100) / 100;

        return {
            nominalWllT: wll,
            outOfPlaneAngleDeg: Math.round(angle * 10) / 10,
            derateFactor,
            effectiveWllT,
            isProhibited,
            status,
            alertMessageVi
        };
    }
}
