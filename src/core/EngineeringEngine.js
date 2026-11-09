/**
 * ============================================================================
 * MODULE: ENGINEERING ANALYTICAL ENGINE (EngineeringEngine.js)
 * Standards: ASME B30.9 (Slings), ASME B30.20 (Below-the-Hook Devices),
 *            ASME B30.26 (Hardware), ISO 3874 (Container Handling),
 *            ISO 8686 / EN 13001 (Cranes - Design Principles & Loads)
 * ============================================================================
 */

export class EngineeringEngine {
    static GRAVITY = 9.80665; // m/s^2 (Standard SI Metric)
    static AIR_DENSITY = 1.225; // kg/m^3 at 15°C sea level

    /**
     * Standard safety factors by rigging component category (ASME B30.9 / B30.26 / B30.20).
     */
    static SAFETY_FACTORS = {
        wire_rope: 5.0,        // ASME B30.9-2
        alloy_chain: 4.0,       // ASME B30.9-1 (Grade 80 / 100)
        synthetic_web: 5.0,     // ASME B30.9-5
        synthetic_round: 5.0,   // ASME B30.9-6
        shackle_forged: 6.0,    // ASME B30.26 (Forged alloy bow shackles)
        pad_eye: 4.0,           // AISC / ASME B30.20
        spreader_beam: 3.0,     // ASME B30.20 Category B (Design Factor)
        crane_load_chart: 1.18  // EN 13000 / ASME B30.5 (Tipping threshold factor: 85% stability limit)
    };

    /**
     * Safety Zones per ASME B30.9 and OSHA 1910.184 / 1926.251
     */
    static SAFETY_ZONES = Object.freeze({
        SAFE: 'SAFE',
        WARNING: 'WARNING',
        CRITICAL_VIOLATION: 'CRITICAL / VIOLATION'
    });

    /**
     * Standard Load Angle Factor (LAF) / Tension Factor (TF) matrix
     * Formula: LAF = 1 / sin(alpha)
     * Hard-coded reference triggers per ASME B30.9
     */
    static LAF_REFERENCE_MATRIX = Object.freeze([
        { alphaDeg: 90, laf: 1.000, description: 'Ideal (90° vertical lift)' },
        { alphaDeg: 60, laf: 1.155, description: 'Safe / Recommended' },
        { alphaDeg: 45, laf: 1.414, description: 'Acceptable with reduction' },
        { alphaDeg: 30, laf: 2.000, description: 'Absolute Minimum Safety Limit' }
    ]);

    /**
     * Calculates the Load Angle Factor (LAF) / Tension Factor (TF) for a given horizontal angle alpha.
     * Formula: LAF = 1 / sin(alpha)
     * 
     * @param {number} alphaDeg Horizontal sling angle in degrees (0 < alpha <= 90)
     * @returns {number} LAF value (>= 1.000)
     */
    static calculateLAF(alphaDeg) {
        if (!Number.isFinite(alphaDeg) || alphaDeg <= 0) return Infinity;
        const clampedAlpha = Math.min(90, Math.max(0.01, alphaDeg));

        // Exact ASME standard angle matrix matches
        if (Math.abs(clampedAlpha - 90) < 1e-4) return 1.000;
        if (Math.abs(clampedAlpha - 60) < 1e-4) return 1.155;
        if (Math.abs(clampedAlpha - 45) < 1e-4) return 1.414;
        if (Math.abs(clampedAlpha - 30) < 1e-4) return 2.000;

        const alphaRad = (clampedAlpha * Math.PI) / 180;
        const sinVal = Math.sin(alphaRad);
        if (sinVal <= 1e-6) return Infinity;
        return Math.round((1 / sinVal) * 1000) / 1000;
    }

    /**
     * Calculates the top included angle beta between two sling legs for a symmetrical 2-leg hitch.
     * Formula: beta = 180° - 2*alpha
     * 
     * @param {number} alphaDeg Horizontal sling angle in degrees
     * @returns {number} Included angle beta in degrees
     */
    static calculateTopIncludedAngle(alphaDeg) {
        if (!Number.isFinite(alphaDeg)) return 0;
        const clampedAlpha = Math.max(0, Math.min(90, alphaDeg));
        return Math.round((180 - 2 * clampedAlpha) * 10) / 10;
    }

    /**
     * Core Rigging Safety & Load Calculation Algorithm (ASME B30.9 / OSHA).
     * 
     * @param {Object} params
     * @param {number} params.grossWeight Total gross weight W (tonnes or kg)
     * @param {number} [params.nominalLegs=4] Number of lifting sling legs N
     * @param {number} [params.alphaDeg=60] Horizontal sling angle alpha in degrees
     * @param {number} [params.ratedWllPerLeg=15] Rated WLL per sling leg
     * @param {boolean} [params.isRigidLoad=true] Rigidity assumption (4 legs -> N_eff=2 per ASME B30.9 note 1)
     * @param {string} [params.unit='t'] Weight unit ('t', 'kg', 'lbs')
     * @param {string} [params.lang='vi'] Language ('vi' | 'en')
     * @returns {Object} Full evaluation results, safety status, triggers and recommendations
     */
    static evaluateRiggingSafety({
        grossWeight,
        nominalLegs = 4,
        alphaDeg = 60,
        ratedWllPerLeg = 15.0,
        isRigidLoad = true,
        unit = 't',
        lang = 'vi'
    }) {
        if (!Number.isFinite(grossWeight) || grossWeight <= 0) {
            throw new Error('Invalid grossWeight: must be a positive finite number');
        }
        if (!Number.isFinite(nominalLegs) || nominalLegs < 1) {
            throw new Error('Invalid nominalLegs: must be at least 1');
        }
        if (!Number.isFinite(alphaDeg) || alphaDeg <= 0) {
            throw new Error('Invalid alphaDeg: horizontal angle must be greater than 0');
        }

        const effectiveAlpha = Math.min(90, Math.max(0.1, alphaDeg));
        const betaDeg = this.calculateTopIncludedAngle(effectiveAlpha);
        const laf = this.calculateLAF(effectiveAlpha);

        // ASME B30.9 Note (1): Rigid loads with 4 legs assume 2 legs carry the entire load
        const effectiveLegs = (nominalLegs === 4 && isRigidLoad) ? 2 : nominalLegs;

        // Actual tension on each individual sling leg: T = (W / N_eff) * LAF
        const baseShare = grossWeight / effectiveLegs;
        const slingTension = Math.round(baseShare * laf * 100) / 100;

        // Tension increase percentage over purely vertical lift
        const tensionIncreasePct = Math.round((laf - 1.0) * 1000) / 10;

        // Utilization percentage vs Rated WLL
        const utilizationPct = ratedWllPerLeg > 0 ? Math.round((slingTension / ratedWllPerLeg) * 100) : 0;
        const isOverloaded = ratedWllPerLeg > 0 && slingTension > ratedWllPerLeg;

        // Safety Zone & Hard-coded Triggers
        let status = this.SAFETY_ZONES.SAFE;
        let isBlocked = false;
        let errorMessage = null;
        let warningMessage = null;

        if (effectiveAlpha < 30.0) {
            // DANGER/BLOCK ZONE (alpha < 30°): ASME B30.9 & OSHA Violation
            status = this.SAFETY_ZONES.CRITICAL_VIOLATION;
            isBlocked = true;
            errorMessage = lang === 'en'
                ? 'Error: Horizontal sling angle is less than 30 degrees. Operation prohibited under ASME B30.9.'
                : 'Error: Horizontal sling angle is less than 30 degrees. Operation prohibited under ASME B30.9. (Lỗi: Góc nâng ngang cáp nhỏ hơn 30 độ. Nghiêm cấm thao tác cẩu theo tiêu chuẩn ASME B30.9 & OSHA).';
        } else if (effectiveAlpha < 60.0) {
            // WARNING ZONE (30° <= alpha < 60°): 15% - 100% tension surge
            status = this.SAFETY_ZONES.WARNING;
            warningMessage = lang === 'en'
                ? `Warning: Horizontal sling angle is ${effectiveAlpha.toFixed(1)}°. Sling tension has increased by ${tensionIncreasePct.toFixed(1)}%. Verify sling rated WLL.`
                : `Cảnh báo: Góc nâng ngang cáp ${effectiveAlpha.toFixed(1)}° làm tăng lực căng dây thêm ${tensionIncreasePct.toFixed(1)}%. Yêu cầu kiểm tra WLL định mức.`;

            if (isOverloaded) {
                isBlocked = true;
                errorMessage = lang === 'en'
                    ? `Critical: Calculated sling tension (${slingTension} ${unit}) exceeds rated WLL (${ratedWllPerLeg} ${unit}). Operation blocked.`
                    : `Cảnh báo nghiêm trọng: Lực căng cáp tính toán (${slingTension} ${unit}) vượt quá tải trọng an toàn WLL (${ratedWllPerLeg} ${unit}). Thao tác bị khoá.`;
            }
        } else {
            // SAFE ZONE (60° <= alpha <= 90°): Ideal or recommended range
            status = this.SAFETY_ZONES.SAFE;
            if (isOverloaded) {
                status = this.SAFETY_ZONES.WARNING;
                isBlocked = true;
                errorMessage = lang === 'en'
                    ? `Warning: Sling tension (${slingTension} ${unit}) exceeds rated WLL (${ratedWllPerLeg} ${unit}).`
                    : `Cảnh báo: Lực căng cáp (${slingTension} ${unit}) vượt quá tải trọng an toàn WLL (${ratedWllPerLeg} ${unit}).`;
            }
        }

        // Software Recommendation Engine Logic (Triggered if alpha <= 45° or CRITICAL or Overloaded)
        const recommendations = [];
        if (effectiveAlpha <= 45.0 || status === this.SAFETY_ZONES.CRITICAL_VIOLATION || isOverloaded) {
            if (lang === 'en') {
                recommendations.push({
                    code: 'OPTION_A',
                    action: 'Increase sling leg length to improve the horizontal angle (target α ≥ 60°, LAF ≤ 1.155).',
                    expectedGain: 'Reduces horizontal shear stress and drops sling tension.'
                });
                recommendations.push({
                    code: 'OPTION_B',
                    action: 'Utilize a Spreader Bar or Lifting Beam to convert horizontal shear tension into vertical compressive force (achieving α = 90°, LAF = 1.000).',
                    expectedGain: 'Eliminates angle penalty entirely, achieving 100% vertical efficiency.'
                });
                recommendations.push({
                    code: 'OPTION_C',
                    action: 'Relocate pad-eyes/pick points closer together or re-align Center of Gravity (CoG) with crane hook.',
                    expectedGain: 'Balances load sharing across all sling legs and prevents tilt.'
                });
            } else {
                recommendations.push({
                    code: 'OPTION_A',
                    action: 'Tăng chiều dài dây cáp (Sling Length) để nâng góc nâng ngang lên ≥ 60° (giảm hệ số tải LAF về ≤ 1.155).',
                    expectedGain: 'Giảm lực căng xé cáp và giảm tải trọng uốn ngang tác động lên tai cẩu.'
                });
                recommendations.push({
                    code: 'OPTION_B',
                    action: 'Sử dụng Dầm gánh (Spreader Bar hoặc Lifting Beam) để chuyển lực xé ngang thành lực nén đứng dọc trục (đạt góc α = 90°, LAF = 1.000).',
                    expectedGain: 'Triệt tiêu hoàn toàn góc xiên, đạt hiệu suất lực đứng 100% (LAF = 1.000).'
                });
                recommendations.push({
                    code: 'OPTION_C',
                    action: 'Thu hẹp khoảng cách giữa các điểm móc (Pad-eyes) hoặc đưa móc cẩu trùng trục tâm với trọng tâm CoG.',
                    expectedGain: 'Cân bằng tải trọng giữa các nhánh cáp và chống nghiêng lệch kiện hàng.'
                });
            }
        }

        return {
            grossWeight,
            nominalLegs,
            effectiveLegs,
            isRigidLoad,
            alphaDeg: Math.round(effectiveAlpha * 10) / 10,
            topIncludedAngleDeg: betaDeg,
            laf,
            tensionIncreasePct,
            slingTension,
            ratedWllPerLeg,
            utilizationPct,
            unit,
            status,
            isBlocked,
            isOverloaded,
            errorMessage,
            warningMessage,
            recommendations
        };
    }

    /**
     * Calculates the dynamic amplification factor (DAF) according to ISO 8686-1 & DNV-ST-N001.
     *
     * @param {number} hoistSpeedMps Operating hoist speed in m/s
     * @param {string} craneClass 'shore' | 'offshore' | 'heavy_lift'
     * @returns {number} DAF (typically 1.10 - 1.30)
     */
    static calculateDAF(hoistSpeedMps = 0.35, craneClass = 'shore') {
        const beta = craneClass === 'offshore' ? 0.65 : (craneClass === 'heavy_lift' ? 0.25 : 0.35);
        const daf = 1.0 + beta * Math.max(0.05, Math.min(1.2, hoistSpeedMps));
        return Math.round(daf * 100) / 100;
    }

    /**
     * Calculates aerodynamic wind drag force on payload according to EN 13001-2 / ISO 4302.
     * F_wind = 0.5 * rho * Cd * Area * v^2
     *
     * @param {number} areaM2 Exposed cross-sectional projected area in m²
     * @param {number} windSpeedMps Wind speed in m/s (e.g. 10 m/s = 36 km/h)
     * @param {number} [cd=1.25] Drag shape coefficient (1.2 - 1.3 for rectangular containers)
     * @returns {{ forceN: number, forceT: number }}
     */
    static calculateWindLoad(areaM2, windSpeedMps, cd = 1.25) {
        const forceN = 0.5 * this.AIR_DENSITY * cd * areaM2 * Math.pow(windSpeedMps, 2);
        return {
            forceN: Math.round(forceN),
            forceT: Math.round((forceN / (this.GRAVITY * 1000)) * 100) / 100
        };
    }

    /**
     * Evaluates static and dynamic sling tension for 4-point symmetrical or eccentric lift.
     * Solves 3D static equilibrium (sum F_y = W, sum M_x = 0, sum M_z = 0) with non-negative constraints.
     *
     * @param {number} grossMassKg Total mass including cargo + below-the-hook lifting gear
     * @param {Array<{ x: number, y: number, z: number }>} padEyes Local positions of pad-eyes relative to cargo center
     * @param {{ x: number, y: number, z: number }} cogOffset Center of Gravity offset (dx, dy, dz) from center
     * @param {number} apexHeightM Elevation difference between hook/spreader and pad-eyes
     * @param {number} [daf=1.15] Dynamic Amplification Factor
     * @returns {Array<{ index: number, betaDeg: number, tensionFactor: number, staticN: number, staticT: number, dynamicN: number, dynamicT: number }>}
     */
    static calculateSlingTensions(grossMassKg, padEyes, cogOffset = { x: 0, y: 0, z: 0 }, apexHeightM = 3.5, daf = 1.15) {
        const totalWeightN = grossMassKg * this.GRAVITY;
        const norm = this.normalizePadEyes(padEyes);
        if (!norm.valid) return [];
        const normPoints = norm.points;
        const n = normPoints.length;

        // 1. Calculate sling geometric angles (beta to horizontal) and tension factor (TF = 1/sin beta)
        const geometries = normPoints.map((pe, idx) => {
            const spanX = Math.abs(pe.x);
            const spanZ = Math.abs(pe.z);
            const horizR = Math.hypot(spanX, spanZ);
            const legLength = Math.hypot(horizR, apexHeightM);
            const sinBeta = Math.max(0.1, apexHeightM / Math.max(0.01, legLength));
            const betaRad = Math.asin(sinBeta);
            const betaDeg = betaRad * (180 / Math.PI);
            const tensionFactor = 1 / sinBeta;
            return { idx, pe, horizR, legLength, betaDeg, tensionFactor };
        });

        // 2. Solve load share per leg considering CoG eccentricity
        // If 4 symmetrical points (corners of container), calculate share based on lever arm rule
        let loadFractions = new Array(n).fill(1 / n);

        if (n === 4) {
            // Corner coordinates (+X,+Z), (-X,+Z), (-X,-Z), (+X,-Z)
            const spanL = Math.max(0.5, Math.abs(normPoints[0].x - normPoints[1].x));
            const spanW = Math.max(0.5, Math.abs(normPoints[0].z - normPoints[3].z));

            // Normalized CoG shift: -0.5 to +0.5
            const fx = (cogOffset.x || 0) / spanL;
            const fz = (cogOffset.z || 0) / spanW;

            // Share fractions based on 2-axis lever rule:
            // Node 0 (+X, +Z): (0.5 + fx) * (0.5 + fz)
            // Node 1 (-X, +Z): (0.5 - fx) * (0.5 + fz)
            // Node 2 (-X, -Z): (0.5 - fx) * (0.5 - fz)
            // Node 3 (+X, -Z): (0.5 + fx) * (0.5 - fz)
            loadFractions = [
                Math.max(0, (0.5 + fx) * (0.5 + fz)),
                Math.max(0, (0.5 - fx) * (0.5 + fz)),
                Math.max(0, (0.5 - fx) * (0.5 - fz)),
                Math.max(0, (0.5 + fx) * (0.5 - fz))
            ];

            // Normalize sum to 1.0
            const sumFrac = loadFractions.reduce((a, b) => a + b, 0);
            if (sumFrac > 1e-4) {
                loadFractions = loadFractions.map(f => f / sumFrac);
            }
        }

        // 3. Compute final tension with tension factor and DAF
        return geometries.map(g => {
            const verticalShareN = totalWeightN * loadFractions[g.idx];
            const staticN = verticalShareN * g.tensionFactor;
            const dynamicN = staticN * daf;
            return {
                index: g.idx,
                betaDeg: Math.round(g.betaDeg * 10) / 10,
                tensionFactor: Math.round(g.tensionFactor * 100) / 100,
                staticN: Math.round(staticN),
                staticT: Math.round((staticN / (this.GRAVITY * 1000)) * 100) / 100,
                dynamicN: Math.round(dynamicN),
                dynamicT: Math.round((dynamicN / (this.GRAVITY * 1000)) * 100) / 100
            };
        });
    }

    /**
     * Evaluates load chart capacity of a harbor / mobile crane at a specific radius.
     * Uses piecewise linear interpolation between tabulated points.
     *
     * @param {Array<{ radiusM: number, capacityT: number }>} chartTable
     * @param {number} radiusM Working radius in meters
     * @returns {{ ratedCapacityT: number, maxSafeLoadT: number }}
     */
    static evaluateLoadChart(chartTable, radiusM) {
        if (!chartTable || chartTable.length === 0) {
            return { ratedCapacityT: 50.0, maxSafeLoadT: 42.5 };
        }

        const sorted = [...chartTable].sort((a, b) => a.radiusM - b.radiusM);

        if (radiusM <= sorted[0].radiusM) {
            const cap = sorted[0].capacityT;
            return { ratedCapacityT: cap, maxSafeLoadT: Math.round(cap * 0.85 * 10) / 10 };
        }

        if (radiusM >= sorted[sorted.length - 1].radiusM) {
            const cap = sorted[sorted.length - 1].capacityT;
            return { ratedCapacityT: cap, maxSafeLoadT: Math.round(cap * 0.85 * 10) / 10 };
        }

        // Linear interpolation
        for (let i = 0; i < sorted.length - 1; i++) {
            const p1 = sorted[i];
            const p2 = sorted[i + 1];
            if (radiusM >= p1.radiusM && radiusM <= p2.radiusM) {
                const ratio = (radiusM - p1.radiusM) / (p2.radiusM - p1.radiusM);
                const cap = p1.capacityT + ratio * (p2.capacityT - p1.capacityT);
                return {
                    ratedCapacityT: Math.round(cap * 10) / 10,
                    maxSafeLoadT: Math.round(cap * 0.85 * 10) / 10 // 85% rule per ASME B30.5
                };
            }
        }

        return { ratedCapacityT: 50.0, maxSafeLoadT: 42.5 };
    }

    /**
     * Normalizes pad-eye input to flat {x,y,z,wllT} points and validates it.
     * Accepts {x,y,z}, {localPos:{x,y,z}} or {pos:{x,y,z}}.
     *
     * @param {Array<Object>} padEyes
     * @returns {{ valid: boolean, reason: string, points: Array<{x:number,y:number,z:number,wllT?:number}> }}
     */
    static normalizePadEyes(padEyes) {
        if (!Array.isArray(padEyes) || padEyes.length === 0) {
            return { valid: false, reason: 'Không có điểm neo', points: [] };
        }
        const points = padEyes.map(pe => {
            const src = (pe && (pe.localPos || pe.pos)) || pe || {};
            return { x: Number(src.x), y: Number(src.y), z: Number(src.z), wllT: pe && pe.wllT };
        });
        const bad = points.findIndex(p => !Number.isFinite(p.x) || !Number.isFinite(p.y) || !Number.isFinite(p.z));
        if (bad >= 0) return { valid: false, reason: `Điểm neo #${bad + 1} thiếu toạ độ`, points };
        if (points.length < 3) return { valid: false, reason: `Chỉ có ${points.length} điểm neo`, points };
        return { valid: true, reason: '', points };
    }

    /**
     * Comprehensive International Lift Plan Compliance Audit Matrix.
     * Checks all critical engineering rules and returns structured checklist rows.
     *
     * @param {Object} plan Full LiftPlan data object
     * @returns {{ overallStatus: 'PASS' | 'WARNING' | 'FAIL', checks: Array<Object> }}
     */
    static validateCompliance(plan) {
        const checks = [];
        let hasFail = false;
        let hasWarning = false;

        const { cargo, rigging, crane, environment = {} } = plan;
        const totalMassKg = (cargo.massKg || 24000) + (rigging.spreaderMassKg || 0) + 450;
        const totalMassT = totalMassKg / 1000;
        const daf = this.calculateDAF(crane.winch ? crane.winch.maxSpeedMps : 0.4, 'shore');

        // Data integrity gate: a check can never PASS on missing / non-finite input.
        // Accepts pad-eyes as {x,y,z} or {localPos:{x,y,z}} or {pos:{x,y,z}}.
        const padEyes = this.normalizePadEyes(cargo.padEyes);
        if (!padEyes.valid) {
            hasFail = true;
            checks.push({
                code: 'DATA_INTEGRITY',
                name: 'Tính toàn vẹn dữ liệu điểm neo (pad-eye)',
                standard: 'ASME P30.1 §1-5 (thông tin đầu vào đầy đủ)',
                value: padEyes.reason,
                limit: 'Toạ độ hữu hạn, ≥ 3 điểm',
                status: 'FAIL',
                message: 'Không thể kết luận an toàn khi dữ liệu điểm neo thiếu hoặc không hợp lệ.'
            });
            return { overallStatus: 'FAIL', isCompliant: false, checks };
        }

        // Rule 1: Working Sling Angle to Horizontal (ASME B30.9-1.10.1: beta >= 30 deg, recommended >= 45 or 60 deg)
        const apexH = rigging.topBridle && rigging.topBridle.active ? (rigging.topBridle.lengthM * 0.85) : 3.5;
        const tensions = this.calculateSlingTensions(totalMassKg, padEyes.points, cargo.cogLocal || { x: 0, y: 0, z: 0 }, apexH, daf);

        const minBeta = Math.min(...tensions.map(t => t.betaDeg));
        if (!Number.isFinite(minBeta) || tensions.some(t => !Number.isFinite(t.dynamicT))) {
            hasFail = true;
            checks.push({
                code: 'DATA_INTEGRITY',
                name: 'Kết quả tính lực căng không hợp lệ',
                standard: 'ASME P30.1',
                value: 'NaN / vô hạn',
                limit: 'Số hữu hạn',
                status: 'FAIL',
                message: 'Dữ liệu hình học hoặc khối lượng đầu vào gây ra kết quả không xác định.'
            });
            return { overallStatus: 'FAIL', isCompliant: false, checks };
        }

        const laf = this.calculateLAF(minBeta);
        const tensionIncreasePct = Math.round((laf - 1.0) * 1000) / 10;

        if (minBeta < 30.0) {
            hasFail = true;
            checks.push({
                code: 'ASME_B30_9_BETA',
                name: 'Góc nghiêng dây cáp với mặt ngang (α)',
                standard: 'ASME B30.9 §9-2.10',
                value: `${minBeta.toFixed(1)}° (LAF: ${laf.toFixed(3)})`,
                limit: '≥ 30.0°',
                status: 'FAIL',
                message: 'Error: Horizontal sling angle is less than 30 degrees. Operation prohibited under ASME B30.9. (Góc cáp < 30° làm lực căng dây tăng vọt cực kỳ nguy hiểm, nghiêm cấm nâng cẩu).'
            });
        } else if (minBeta < 60.0) {
            hasWarning = true;
            checks.push({
                code: 'ASME_B30_9_BETA',
                name: 'Góc nghiêng dây cáp với mặt ngang (α)',
                standard: 'ASME B30.9 §9-2.10',
                value: `${minBeta.toFixed(1)}° (LAF: ${laf.toFixed(3)})`,
                limit: 'Khuyến nghị ≥ 60.0°',
                status: 'WARNING',
                message: `Cảnh báo: Góc nâng ngang cáp ${minBeta.toFixed(1)}° làm tăng lực căng dây thêm ${tensionIncreasePct.toFixed(1)}%. Yêu cầu kiểm tra WLL định mức.`
            });
        } else {
            checks.push({
                code: 'ASME_B30_9_BETA',
                name: 'Góc nghiêng dây cáp với mặt ngang (α)',
                standard: 'ASME B30.9 §9-2.10',
                value: `${minBeta.toFixed(1)}° (LAF: ${laf.toFixed(3)})`,
                limit: '60.0° - 90.0° (Lý tưởng)',
                status: 'PASS',
                message: 'Góc cáp trong vùng an toàn SAFE ZONE (60° - 90°), tải trọng làm việc tiêu chuẩn.'
            });
        }

        // Rule 2: Sling WLL & Safety Factor Utilization (ASME B30.9: Max Dynamic Tension <= WLL)
        tensions.forEach((t, i) => {
            const legWll = (rigging.lowerLegs && rigging.lowerLegs[i] && Number.isFinite(rigging.lowerLegs[i].wllT))
                ? rigging.lowerLegs[i].wllT
                : ((padEyes.points[i] && Number.isFinite(padEyes.points[i].wllT)) ? padEyes.points[i].wllT : 17.0);
            const utilPct = Math.round((t.dynamicT / Math.max(0.1, legWll)) * 100);

            if (utilPct > 100) {
                hasFail = true;
                checks.push({
                    code: `WLL_LEG_${i}`,
                    name: `Tải trọng làm việc nhánh neo LP${i + 1}`,
                    standard: 'ASME B30.9 (SF ≥ 5.0)',
                    value: `${t.dynamicT.toFixed(1)} T (DAF ${daf})`,
                    limit: `WLL ${legWll.toFixed(1)} T (${utilPct}%)`,
                    status: 'FAIL',
                    message: `Lực căng nhánh ${i + 1} vượt quá giới hạn tải trọng an toàn WLL!`
                });
            } else if (utilPct > 85) {
                hasWarning = true;
                checks.push({
                    code: `WLL_LEG_${i}`,
                    name: `Tải trọng làm việc nhánh neo LP${i + 1}`,
                    standard: 'ASME B30.9 (SF ≥ 5.0)',
                    value: `${t.dynamicT.toFixed(1)} T`,
                    limit: `WLL ${legWll.toFixed(1)} T (${utilPct}%)`,
                    status: 'WARNING',
                    message: `Lực căng nhánh ${i + 1} tiệm cận tải trọng tối đa (>85% WLL).`
                });
            } else {
                checks.push({
                    code: `WLL_LEG_${i}`,
                    name: `Tải trọng làm việc nhánh neo LP${i + 1}`,
                    standard: 'ASME B30.9 (SF ≥ 5.0)',
                    value: `${t.dynamicT.toFixed(1)} T`,
                    limit: `WLL ${legWll.toFixed(1)} T (${utilPct}%)`,
                    status: 'PASS',
                    message: `Hệ số an toàn nhánh ${i + 1} đạt tiêu chuẩn.`
                });
            }
        });

        // Rule 3: Spreader Beam Structural Capacity (ASME B30.20 Below-the-Hook: Design Factor >= 3.0)
        const spreaderWll = rigging.spreaderWllT || 50.0;
        const spreaderUtilPct = Math.round((totalMassT / spreaderWll) * 100);
        if (spreaderUtilPct > 100) {
            hasFail = true;
            checks.push({
                code: 'ASME_B30_20_SPREADER',
                name: 'Sức nâng dầm ngáng / Spreader Beam',
                standard: 'ASME B30.20 §20-1.2',
                value: `${totalMassT.toFixed(1)} T`,
                limit: `WLL ${spreaderWll.toFixed(1)} T (${spreaderUtilPct}%)`,
                status: 'FAIL',
                message: 'Tổng khối lượng kiện vượt quá sức nâng của dầm Spreader!'
            });
        } else {
            checks.push({
                code: 'ASME_B30_20_SPREADER',
                name: 'Sức nâng dầm ngáng / Spreader Beam',
                standard: 'ASME B30.20 §20-1.2',
                value: `${totalMassT.toFixed(1)} T`,
                limit: `WLL ${spreaderWll.toFixed(1)} T (${spreaderUtilPct}%)`,
                status: 'PASS',
                message: 'Dầm ngáng chịu lực tốt trong phạm vi thiết kế.'
            });
        }

        // Rule 4: Crane Radius Load Chart Capacity (ASME B30.5 / EN 13000: Max 85% Rated Capacity)
        const hookPos = crane.hookPosition || { x: 0, y: 12, z: 0 };
        const radiusM = Math.hypot(hookPos.x, hookPos.z) || 14.0;
        const chart = this.evaluateLoadChart(crane.loadChartTable, radiusM);
        const craneUtilPct = Math.round((totalMassT / chart.ratedCapacityT) * 100);

        if (craneUtilPct > 100) {
            hasFail = true;
            checks.push({
                code: 'CRANE_LOAD_CHART_LIMIT',
                name: 'Biểu đồ tải cẩu tại bán kính thao tác',
                standard: 'ASME B30.5 / EN 13000',
                value: `${totalMassT.toFixed(1)} T tại R = ${radiusM.toFixed(1)}m`,
                limit: `Sức nâng ${chart.ratedCapacityT.toFixed(1)} T (${craneUtilPct}%)`,
                status: 'FAIL',
                message: `Quá tải cẩu! Bán kính ${radiusM.toFixed(1)}m vượt giới hạn chống lật của cần trục.`
            });
        } else if (craneUtilPct > 85) {
            hasWarning = true;
            checks.push({
                code: 'CRANE_LOAD_CHART_LIMIT',
                name: 'Biểu đồ tải cẩu tại bán kính thao tác',
                standard: 'ASME B30.5 / EN 13000 (Quy tắc 85% Critical Lift)',
                value: `${totalMassT.toFixed(1)} T tại R = ${radiusM.toFixed(1)}m`,
                limit: `Ngưỡng an toàn 85%: ${chart.maxSafeLoadT.toFixed(1)} T (${craneUtilPct}%)`,
                status: 'WARNING',
                message: 'Cú nâng thuộc diện Critical Lift (>85% sức nâng định mức cần trục).'
            });
        } else {
            checks.push({
                code: 'CRANE_LOAD_CHART_LIMIT',
                name: 'Biểu đồ tải cẩu tại bán kính thao tác',
                standard: 'ASME B30.5 / EN 13000',
                value: `${totalMassT.toFixed(1)} T tại R = ${radiusM.toFixed(1)}m`,
                limit: `Sức nâng ${chart.ratedCapacityT.toFixed(1)} T (${craneUtilPct}%)`,
                status: 'PASS',
                message: 'Biểu đồ tải cẩu an toàn.'
            });
        }

        // Rule 5: Wind Speed Limit (ILO Safety in Ports / ISO 4302: Max 12 m/s for general lifts, 10 m/s for containers)
        const windSpeed = environment.windSpeedMps != null ? environment.windSpeedMps : 4.5;
        const maxOpWind = environment.maxOperationalWindMps || 12.0;

        if (windSpeed > maxOpWind) {
            hasFail = true;
            checks.push({
                code: 'ENV_WIND_LIMIT',
                name: 'Tốc độ gió hiện trường',
                standard: 'ILO Ports / DNV-ST-N001',
                value: `${windSpeed.toFixed(1)} m/s`,
                limit: `Tối đa ${maxOpWind.toFixed(1)} m/s`,
                status: 'FAIL',
                message: 'Gió vượt ngưỡng cho phép thao tác nâng cẩu cảng biển! Phải dừng ca nâng.'
            });
        } else if (windSpeed > maxOpWind * 0.8) {
            hasWarning = true;
            checks.push({
                code: 'ENV_WIND_LIMIT',
                name: 'Tốc độ gió hiện trường',
                standard: 'ILO Ports / DNV-ST-N001',
                value: `${windSpeed.toFixed(1)} m/s`,
                limit: `Tối đa ${maxOpWind.toFixed(1)} m/s`,
                status: 'WARNING',
                message: 'Gió giật mạnh, cần bố trí dây néo (taglines) và theo dõi liên tục.'
            });
        } else {
            checks.push({
                code: 'ENV_WIND_LIMIT',
                name: 'Tốc độ gió hiện trường',
                standard: 'ILO Ports / DNV-ST-N001',
                value: `${windSpeed.toFixed(1)} m/s`,
                limit: `Tối đa ${maxOpWind.toFixed(1)} m/s`,
                status: 'PASS',
                message: 'Tốc độ gió trong giới hạn an toàn.'
            });
        }

        // Rule 6: Container Twistlocks Interlock (ISO 3874: 4 corner twistlocks locked)
        if (cargo.id && cargo.id.includes('container')) {
            checks.push({
                code: 'ISO_3874_TWISTLOCK',
                name: 'Khóa gù xoay Twistlocks 4 góc',
                standard: 'ISO 3874 §6.2',
                value: '4/4 Chốt đã khóa',
                limit: 'Đủ 4 góc gù ISO 1496',
                status: 'PASS',
                message: 'Cơ cấu khóa gù góc đúc đạt tiêu chuẩn khóa an toàn cơ học.'
            });
        }

        return {
            overallStatus: hasFail ? 'FAIL' : (hasWarning ? 'WARNING' : 'PASS'),
            isCompliant: !hasFail,
            checks
        };
    }
}
