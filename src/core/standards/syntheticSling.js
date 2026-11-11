/**
 * ============================================================================
 * SYNTHETIC WEBBING & ROUND SLING SPECIFICATIONS (BS EN 1492-1 / EN 1492-2 / ASME B30.9)
 * ============================================================================
 */

export const SYNTHETIC_SAFETY_FACTOR_MIN = 7.0; // EN 1492-1 / EN 1492-2

export const WEBBING_WIDTHS_MM = Object.freeze([
    30, 60, 90, 120, 150, 180, 240, 300
]);

export const EN1492_COLOR_MATRIX = Object.freeze([
    { maxWllT: 1.0, colorNameVi: 'Tím (1T)', colorHex: '#9333ea', stripeCount: 1, webWidthMm: 30, webThickMm: 5.0, roundDiaMm: 24, linearMassWeb: 0.24, linearMassRound: 0.32 },
    { maxWllT: 2.0, colorNameVi: 'Xanh lá (2T)', colorHex: '#16a34a', stripeCount: 2, webWidthMm: 60, webThickMm: 6.0, roundDiaMm: 32, linearMassWeb: 0.48, linearMassRound: 0.58 },
    { maxWllT: 3.0, colorNameVi: 'Vàng (3T)', colorHex: '#eab308', stripeCount: 3, webWidthMm: 90, webThickMm: 7.0, roundDiaMm: 40, linearMassWeb: 0.74, linearMassRound: 0.85 },
    { maxWllT: 4.0, colorNameVi: 'Xám (4T)', colorHex: '#64748b', stripeCount: 4, webWidthMm: 120, webThickMm: 7.5, roundDiaMm: 46, linearMassWeb: 0.98, linearMassRound: 1.12 },
    { maxWllT: 5.0, colorNameVi: 'Đỏ (5T)', colorHex: '#dc2626', stripeCount: 5, webWidthMm: 150, webThickMm: 8.0, roundDiaMm: 52, linearMassWeb: 1.25, linearMassRound: 1.42 },
    { maxWllT: 6.0, colorNameVi: 'Nâu (6T)', colorHex: '#92400e', stripeCount: 6, webWidthMm: 180, webThickMm: 8.5, roundDiaMm: 58, linearMassWeb: 1.52, linearMassRound: 1.70 },
    { maxWllT: 8.0, colorNameVi: 'Xanh dương (8T)', colorHex: '#2563eb', stripeCount: 8, webWidthMm: 240, webThickMm: 9.0, roundDiaMm: 66, linearMassWeb: 2.05, linearMassRound: 2.25 },
    { maxWllT: Infinity, colorNameVi: 'Cam (Heavy 10T+)', colorHex: '#ea580c', stripeCount: 0, webWidthMm: 300, webThickMm: 10.0, roundDiaMm: 85, linearMassWeb: 2.80, linearMassRound: 3.10 }
]);

export function getEN1492SpecByWLL(wllT = 2.0) {
    const targetWll = Math.max(0.1, Number(wllT) || 2.0);
    for (const item of EN1492_COLOR_MATRIX) {
        if (targetWll <= item.maxWllT) return item;
    }
    return EN1492_COLOR_MATRIX[EN1492_COLOR_MATRIX.length - 1];
}

export function computeSyntheticSlingSpec({
    slingType = 'web', // 'web' | 'round_sling'
    widthOrDiaMm = 60,
    material = 'poly', // 'poly' | 'hmpe'
    lengthM = 2.5,
    parts = 1,
    sf = SYNTHETIC_SAFETY_FACTOR_MIN
} = {}) {
    const isRound = slingType === 'round_sling';
    const isHmpe = material === 'hmpe';
    const safetyFactor = Math.max(SYNTHETIC_SAFETY_FACTOR_MIN, Number(sf) || SYNTHETIC_SAFETY_FACTOR_MIN);
    const L = Math.max(0.3, Number(lengthM) || 2.5);
    const p = Math.max(1, Math.min(4, Number(parts) || 1));

    let singleWllT = 0;
    let colorSpec = null;
    let linearKgPerM = 0;
    let endHardwareMassKg = 0;
    const size = Math.max(isRound ? 20 : 25, Number(widthOrDiaMm) || (isRound ? 40 : 60));

    if (isRound) {
        // Round Sling EN 1492-2
        if (isHmpe) {
            singleWllT = (size * size) / 120.0;
        } else {
            // Find closest round sling matching table diameter
            let best = EN1492_COLOR_MATRIX[0];
            let bestDiff = Math.abs(best.roundDiaMm - size);
            for (const item of EN1492_COLOR_MATRIX) {
                const diff = Math.abs(item.roundDiaMm - size);
                if (diff < bestDiff) {
                    bestDiff = diff;
                    best = item;
                }
            }
            colorSpec = best;
            singleWllT = (best.maxWllT === Infinity) ? (size / 8.5) : best.maxWllT;
        }
        colorSpec = colorSpec || getEN1492SpecByWLL(singleWllT);
        linearKgPerM = 0.00054 * size * size;
        endHardwareMassKg = 0.18;
    } else {
        // Flat Webbing Sling EN 1492-1
        singleWllT = isHmpe ? (size / 20.0) : Math.max(0.5, size / 30.0);
        colorSpec = getEN1492SpecByWLL(singleWllT);
        linearKgPerM = 1.38e-3 * size * colorSpec.webThickMm;
        endHardwareMassKg = 0.15 + (size / 300.0) * 0.45;
    }

    const singleMblT = singleWllT * SYNTHETIC_SAFETY_FACTOR_MIN;
    const actualSingleWllT = singleMblT / safetyFactor;
    const totalWllT = actualSingleWllT * p;
    const totalMblT = singleMblT * p;
    const totalMassKg = p * (linearKgPerM * L + endHardwareMassKg);

    const modulusE_GPa = isHmpe ? 32.0 : 2.8;
    const fill = 6.0;
    const diaM = size / 1000.0;
    const EA_N = (modulusE_GPa * 1e9) * (Math.PI * diaM * diaM * 0.25 * fill) * p;

    return {
        standard: isRound ? 'BS EN 1492-2 / ASME B30.9' : 'BS EN 1492-1 / ASME B30.9',
        slingType: isRound ? 'round_sling' : 'web',
        material: isHmpe ? 'hmpe' : 'poly',
        materialName: isHmpe ? 'HMPE Dyneema Core' : '100% High Tenacity Polyester (PES)',
        widthOrDiaMm: size,
        parts: p,
        lengthM: L,
        sf: safetyFactor,
        colorHex: colorSpec.colorHex,
        colorNameVi: colorSpec.colorNameVi,
        stripeCount: isRound ? 0 : colorSpec.stripeCount, // Round sling has NO black stripes per EN 1492-2
        linearKgPerM: Number(linearKgPerM.toFixed(3)),
        endHardwareMassKg: Number(endHardwareMassKg.toFixed(2)),
        massKg: Number(totalMassKg.toFixed(1)),
        mblT: Number(totalMblT.toFixed(2)),
        wllT: Number(totalWllT.toFixed(2)),
        E_GPa: modulusE_GPa,
        EA_MN: Number((EA_N / 1e6).toFixed(1))
    };
}
