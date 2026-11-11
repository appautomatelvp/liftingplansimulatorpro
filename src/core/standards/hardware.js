/**
 * ============================================================================
 * RIGGING HARDWARE SPECIFICATIONS & DERATING (ASME B30.26 / RR-C-271 / EN 13889)
 * ============================================================================
 */

export const HARDWARE_SAFETY_FACTOR_MIN = 5.0; // ASME B30.26 standard (or 6:1 for Crosby alloy shackles)

export const HARDWARE_TYPES = Object.freeze({
    bow_shackle: {
        id: 'bow_shackle',
        name: 'Bow / Anchor Shackle (Ma ní móng ngựa / Omega)',
        standard: 'ASME B30.26 / US Fed Spec RR-C-271 / EN 13889',
        allowsSideLoad: true,
        maxSideAngleDeg: 90
    },
    dee_shackle: {
        id: 'dee_shackle',
        name: 'Dee / Chain Shackle (Ma ní chữ U)',
        standard: 'ASME B30.26 / US Fed Spec RR-C-271 / EN 13889',
        allowsSideLoad: false,
        maxSideAngleDeg: 5
    },
    master_link: {
        id: 'master_link',
        name: 'Master Link / Oblong Link (Vòng khuyên hợp kim)',
        standard: 'EN 1677-4 / ASME B30.26',
        allowsSideLoad: false,
        maxSideAngleDeg: 15
    },
    eyebolt_shouldered: {
        id: 'eyebolt_shouldered',
        name: 'Shouldered Eye Bolt (Bulông vòng có vai đỡ)',
        standard: 'ASME B18.15 / ASME B30.26',
        allowsSideLoad: true,
        maxSideAngleDeg: 45
    },
    eyebolt_unshouldered: {
        id: 'eyebolt_unshouldered',
        name: 'Unshouldered Eye Bolt (Bulông vòng không vai)',
        standard: 'ASME B18.15',
        allowsSideLoad: false,
        maxSideAngleDeg: 5
    },
    swivel_hoist_ring: {
        id: 'swivel_hoist_ring',
        name: 'Swivel Hoist Ring (Tai cẩu xoay 360° lật 180°)',
        standard: 'ASME B30.26',
        allowsSideLoad: true,
        maxSideAngleDeg: 90
    }
});

/**
 * Validates Crosby / Green Pin geometric rule: D_pin must strictly exceed D_body.
 */
export function validateShackleGeometry(pinOrObj, bodyMm) {
    let pin = 0;
    let body = 0;
    if (pinOrObj && typeof pinOrObj === 'object') {
        pin = Number(pinOrObj.pinDiaMm || pinOrObj.pinMm) || 0;
        body = Number(pinOrObj.bodyDiaMm || pinOrObj.bodyMm) || 0;
    } else {
        pin = Number(pinOrObj) || 0;
        body = Number(bodyMm) || 0;
    }
    const isValid = pin > body;
    return {
        isValid,
        pinMm: pin,
        bodyMm: body,
        error: isValid ? null : `LỖI HÌNH HỌC MA NÍ: Đường kính chốt (D_pin = ${pin}mm) phải lớn hơn đường kính thân (D_body = ${body}mm) theo ASME B30.26 / Crosby!`
    };
}

/**
 * Computes side-loading derating per ASME B30.26 Figure 26-1.1.3-1.
 */
export function computeShackleSideDerate(hwType = 'bow_shackle', sideAngleDeg = 0) {
    const theta = Math.abs(Number(sideAngleDeg) || 0);
    const typeKey = String(hwType).toLowerCase();
    const isDee = typeKey.includes('dee') || typeKey === 'd_shackle';
    const isUnshouldered = typeKey.includes('unshouldered');

    // Strict in-line hardware: Dee shackle or unshouldered eyebolt
    if (isDee || isUnshouldered) {
        if (theta > 5.0) {
            return {
                factor: 0.0,
                capacityFactor: 0.0,
                isAllowed: false,
                isProhibited: true,
                isCriticalError: true,
                error: `LỖI VI PHẠM ASME B30.26: Ma ní chữ U (Dee) / Bulông không vai chỉ được kéo thẳng hàng! Góc lệch bên ${theta.toFixed(1)}° > 5° bị CẤM TUYỆT ĐỐI!`
            };
        }
        return {
            factor: 1.0,
            capacityFactor: 1.0,
            isAllowed: true,
            isProhibited: false,
            isCriticalError: false,
            error: null
        };
    }

    // Bow / Anchor Shackle derating curve
    if (theta > 90.0) {
        return {
            factor: 0.0,
            capacityFactor: 0.0,
            isAllowed: false,
            isProhibited: true,
            isCriticalError: true,
            error: `LỖI NGUY HIỂM NGHIÊM TRỌNG: Góc kéo lệch bên của ma ní (${theta.toFixed(1)}° > 90°) vượt quá giới hạn chịu lực của chốt!`
        };
    }
    if (theta <= 5.0) {
        return { factor: 1.0, capacityFactor: 1.0, isAllowed: true, isProhibited: false, isCriticalError: false, deratedPct: 0 };
    }
    if (theta <= 45.0) {
        return { factor: 0.70, capacityFactor: 0.70, isAllowed: true, isProhibited: false, isCriticalError: false, deratedPct: 30 }; // 70% of WLL
    }
    return { factor: 0.50, capacityFactor: 0.50, isAllowed: true, isProhibited: false, isCriticalError: false, deratedPct: 50 }; // 50% of WLL (45° to 90°)
}

/**
 * Computes self-weight of Crosby G-2130 forged alloy shackle from WLL (t).
 */
export function computeShackleMassKg(wllT = 17.0) {
    const wll = Math.max(0.5, Number(wllT) || 17.0);
    return Number((0.45 + 0.24 * Math.pow(wll, 1.18)).toFixed(1));
}
