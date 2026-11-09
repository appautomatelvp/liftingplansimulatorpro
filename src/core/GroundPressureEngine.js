/**
 * ============================================================================
 * GROUND BEARING PRESSURE & CRANE MAT SIZING ENGINE (GroundPressureEngine.js)
 * Standards: CIRIA C703 (Crane Stability on Site), FEM 1.001, EN 13000,
 *            ASME P30.1 Section 4 (Ground Conditions & Supporting Surfaces)
 * ============================================================================
 * Purpose:
 *   1. Calculate exact 3D outrigger reaction forces (P1..P4) as crane slews 360°
 *      and changes working radius.
 *   2. Comprehensive soil bearing capacity library (Concrete, Macadam, Hard Clay,
 *      Soft Soil / Fill).
 *   3. Calculate ground bearing pressure under steel outrigger floats and timber/steel mats.
 *   4. Automatically size and recommend heavy crane mats to prevent catastrophic tip-over.
 * ============================================================================
 */

export const SOIL_BEARING_LIBRARY = {
    CONCRETE_SLAB: {
        id: 'concrete_slab',
        name: 'Sàn Bê Tông Cốt Thép Công Nghiệp (Concrete Slab)',
        capacityKPa: 2500, // 250 T/m²
        capacityTPerM2: 255.0,
        description: 'Bê tông mác 300+ liền khối, cốt thép dày'
    },
    COMPACTED_GRAVEL: {
        id: 'compacted_gravel',
        name: 'Đá Dăm / Cấp Phối Đầm Chặt K98 (Crushed Macadam)',
        capacityKPa: 300, // 30 T/m²
        capacityTPerM2: 30.6,
        description: 'Bãi thi công lu lèn đạt chuẩn K98, có lớp cấp phối đá'
    },
    HARD_CLAY: {
        id: 'hard_clay',
        name: 'Đất Sét Cứng / Cát Chặt Tự Nhiên (Hard Clay / Dense Sand)',
        capacityKPa: 150, // 15 T/m²
        capacityTPerM2: 15.3,
        description: 'Nền đất tự nhiên khô ráo, chịu tải trung bình khá'
    },
    SOFT_SOIL: {
        id: 'soft_soil',
        name: 'Đất Mềm / Cát San Lấp Chưa Đầm (Soft Clay / Uncompacted Fill)',
        capacityKPa: 50, // 5 T/m²
        capacityTPerM2: 5.1,
        description: 'Nền đất yếu, cát san lấp hoặc sau mưa lớn (Rất nguy hiểm)'
    }
};

export const COMMERCIAL_MAT_PRESETS = [
    { id: 'dish_only', name: 'Đĩa Chân Thép Tiêu Chuẩn (Ø 0.6m)', lengthM: 0.60, widthM: 0.60, areaM2: 0.28, type: 'steel_float' },
    { id: 'timber_small', name: 'Đà Gỗ Kê 1.2m × 1.2m (Dày 150mm)', lengthM: 1.20, widthM: 1.20, areaM2: 1.44, type: 'timber_mat' },
    { id: 'timber_medium', name: 'Tấm Gỗ Tự Nhiên 1.6m × 1.6m (Dày 200mm)', lengthM: 1.60, widthM: 1.60, areaM2: 2.56, type: 'timber_mat' },
    { id: 'steel_mat_2x2', name: 'Tấm Thép Hộp Hàn 2.0m × 2.0m (Chuyên Dụng)', lengthM: 2.00, widthM: 2.00, areaM2: 4.00, type: 'steel_box_mat' },
    { id: 'steel_mat_2_4x3', name: 'Tấm Thép Cẩu Hạng Nặng 2.4m × 3.0m', lengthM: 3.00, widthM: 2.40, areaM2: 7.20, type: 'heavy_steel_mat' },
    { id: 'mega_mat_3x4', name: 'Đệm Thép Đại Bản 3.0m × 4.0m (Mega Mat)', lengthM: 4.00, widthM: 3.00, areaM2: 12.00, type: 'mega_mat' }
];

export class GroundPressureEngine {
    constructor(options = {}) {
        this.selectedSoil = SOIL_BEARING_LIBRARY.COMPACTED_GRAVEL;
        this.matPreset = COMMERCIAL_MAT_PRESETS.find(p => p.id === 'steel_mat_2x2') || COMMERCIAL_MAT_PRESETS[3];
        this.safetyFactor = 1.25; // CIRIA C703 Ground Safety Factor

        if (options.soilType) this.setSoil(options.soilType);
        if (options.matPresetId) this.setMatPreset(options.matPresetId);
    }

    setSoil(soilKey) {
        if (SOIL_BEARING_LIBRARY[soilKey]) {
            this.selectedSoil = SOIL_BEARING_LIBRARY[soilKey];
        } else {
            const found = Object.values(SOIL_BEARING_LIBRARY).find(s => s.id === soilKey);
            if (found) this.selectedSoil = found;
        }
        return this.selectedSoil;
    }

    setMatPreset(presetId) {
        const found = COMMERCIAL_MAT_PRESETS.find(p => p.id === presetId);
        if (found) this.matPreset = found;
        return this.matPreset;
    }

    /**
     * Solves 3D moment equilibrium to find reaction forces on all 4 outriggers.
     * Coordinate Frame:
     *   Center (0,0) is slewing center of crane.
     *   +X: Crane Front (Cabin direction)
     *   -X: Crane Rear (Counterweight direction)
     *   +Z: Crane Right
     *   -Z: Crane Left
     *
     * Outrigger numbering:
     *   P1: Front-Right (+X, +Z)
     *   P2: Front-Left  (+X, -Z)
     *   P3: Rear-Left   (-X, -Z)
     *   P4: Rear-Right  (-X, +Z)
     *
     * @param {Object} params
     * @param {number} params.carrierMassT Mass of crane chassis and boom
     * @param {number} params.counterweightT Mass of counterweight
     * @param {number} params.counterweightRadiusM Distance from slewing center to CW CoG (m)
     * @param {number} params.grossLoadT Suspended load (Cargo + Rigging + Hook)
     * @param {number} params.workingRadiusM Working radius from slewing center (m)
     * @param {number} params.slewAngleDeg Slewing angle in degrees (0° = Over Front, 90° = Over Right, 180° = Over Rear, 270° = Over Left)
     * @param {Object} params.outriggerBase { lengthM, widthM }
     * @returns {Object} 4-point outrigger forces (Tonnes and kN)
     */
    calculateOutriggerReactions(params) {
        const Mc = Number(params.carrierMassT) || 60.0;
        const Mcw = Number(params.counterweightT) || 50.0;
        const Rcw = Number(params.counterweightRadiusM) || 4.8;
        const Wload = Number(params.grossLoadT) || 20.0;
        const Rload = Number(params.workingRadiusM) || 10.0;
        const psiRad = ((Number(params.slewAngleDeg) || 0) * Math.PI) / 180;

        const baseL = (params.outriggerBase && params.outriggerBase.lengthM) || 8.90;
        const baseW = (params.outriggerBase && params.outriggerBase.widthM) || 8.30;
        const xSpan = baseL / 2;
        const zSpan = baseW / 2;

        // Total gravity load
        const totalWeightT = Mc + Mcw + Wload;

        // Load position in crane slewing plane
        const xLoad = Rload * Math.cos(psiRad);
        const zLoad = Rload * Math.sin(psiRad);

        // Counterweight position (180° opposite to boom direction)
        const xCw = -Rcw * Math.cos(psiRad);
        const zCw = -Rcw * Math.sin(psiRad);

        // Carrier chassis CoG offset (carrier usually has slight front/rear offset, here assumed centered)
        const xChassis = 0;
        const zChassis = 0;

        // Total Moments about Center of Outrigger Box
        // M_pitch (about Z axis): M_z = sum(mass_i * x_i)
        // M_roll  (about X axis): M_x = sum(mass_i * z_i)
        const M_pitch = Wload * xLoad + Mcw * xCw + Mc * xChassis;
        const M_roll = Wload * zLoad + Mcw * zCw + Mc * zChassis;

        // Outrigger vertical reactions from 2-axis planar tilt equilibrium:
        // P_i = TotalWeight / 4 ± (M_pitch / (2 * xSpan)) ± (M_roll / (2 * zSpan))
        const P_base = totalWeightT / 4;
        const delta_pitch = M_pitch / (2 * xSpan);
        const delta_roll = M_roll / (2 * zSpan);

        let p1 = P_base + delta_pitch + delta_roll; // Front-Right (+X, +Z)
        let p2 = P_base + delta_pitch - delta_roll; // Front-Left  (+X, -Z)
        let p3 = P_base - delta_pitch - delta_roll; // Rear-Left   (-X, -Z)
        let p4 = P_base - delta_pitch + delta_roll; // Rear-Right  (-X, +Z)

        // Non-negative ground contact: Outrigger cannot pull up on the ground!
        // If an outrigger lifts off (P < 0), redistribute over remaining 3 pads.
        const pads = [p1, p2, p3, p4];
        let hasTipping = false;
        if (pads.some(p => p < 0)) {
            hasTipping = true;
            // Simple non-negative clamp and proportional scale to preserve total vertical equilibrium
            const positiveSum = pads.filter(p => p > 0).reduce((a, b) => a + b, 0);
            if (positiveSum > 0) {
                const scale = totalWeightT / positiveSum;
                p1 = Math.max(0, p1 * scale);
                p2 = Math.max(0, p2 * scale);
                p3 = Math.max(0, p3 * scale);
                p4 = Math.max(0, p4 * scale);
            }
        }

        const maxReactionT = Math.max(p1, p2, p3, p4);

        return {
            totalWeightT: Math.round(totalWeightT * 10) / 10,
            p1_frontRightT: Math.round(p1 * 10) / 10,
            p2_frontLeftT: Math.round(p2 * 10) / 10,
            p3_rearLeftT: Math.round(p3 * 10) / 10,
            p4_rearRightT: Math.round(p4 * 10) / 10,
            maxReactionT: Math.round(maxReactionT * 10) / 10,
            maxReactionKN: Math.round(maxReactionT * 9.80665 * 10) / 10,
            hasTippingRisk: hasTipping
        };
    }

    /**
     * Evaluates Ground Bearing Pressure (GBP) for given reaction force and mat area.
     * Compares directly against soil bearing capacity.
     *
     * @param {number} reactionForceT Outrigger vertical load in Tonnes
     * @param {number} [matAreaM2=1.44] Area of mat in m²
     * @returns {Object}
     */
    evaluateSoilSafety(reactionForceT, matAreaM2 = 1.44) {
        const forceT = Math.max(0.1, Number(reactionForceT) || 10.0);
        const area = Math.max(0.2, Number(matAreaM2) || 1.44);

        // Ground pressure: q = Force / Area (Tonnes / m² and kPa)
        const pressureTPerM2 = forceT / area;
        const pressureKPa = pressureTPerM2 * 9.80665;

        const allowableTPerM2 = this.selectedSoil.capacityTPerM2;
        const soilUtilizationPct = Math.round((pressureTPerM2 / allowableTPerM2) * 1000) / 10;

        // Minimum required mat area to stay under allowable soil bearing limit with safety factor
        const requiredMatAreaM2 = Math.round(((forceT * this.safetyFactor) / allowableTPerM2) * 100) / 100;

        // Recommend best commercial mat from presets
        const recommendedMat = COMMERCIAL_MAT_PRESETS.find(m => m.areaM2 >= requiredMatAreaM2) || COMMERCIAL_MAT_PRESETS[COMMERCIAL_MAT_PRESETS.length - 1];

        let status = 'SAFE';
        let badge = '🟢 NỀN ĐẤT ĐẠT CHUẨN';
        let alertMessageVi = 'Áp lực đè lên đất nằm trong giới hạn cho phép an toàn.';

        if (soilUtilizationPct > 100.0) {
            status = 'CRITICAL_SOIL_FAILURE';
            badge = '⛔ NGUY CƠ SỤT LÚN NỀN';
            alertMessageVi = `NGUY CƠ LÚN NỀN: Áp lực chân chống (${pressureTPerM2.toFixed(1)} T/m²) vượt quá sức chịu tải của ${this.selectedSoil.name} (${allowableTPerM2.toFixed(1)} T/m²)! Đạt ${soilUtilizationPct.toFixed(1)}%. Cần lót tấm mat tối thiểu ${requiredMatAreaM2} m².`;
        } else if (soilUtilizationPct >= 80.0) {
            status = 'WARNING_SOIL';
            badge = '🟡 CẢNH BÁO NỀN YẾU';
            alertMessageVi = `Cảnh báo: Áp lực chân đạt ${soilUtilizationPct.toFixed(1)}% sức chịu tải nền đất. Khuyến nghị tăng kích thước tấm lót để tránh lún cục bộ.`;
        }

        return {
            soilName: this.selectedSoil.name,
            soilCapacityKPa: this.selectedSoil.capacityKPa,
            soilCapacityTPerM2: this.selectedSoil.capacityTPerM2,
            matAreaM2: Math.round(area * 100) / 100,
            pressureTPerM2: Math.round(pressureTPerM2 * 10) / 10,
            pressureKPa: Math.round(pressureKPa),
            soilUtilizationPct,
            requiredMatAreaM2,
            recommendedMat,
            status,
            badge,
            alertMessageVi
        };
    }
}
