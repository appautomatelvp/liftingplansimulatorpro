/**
 * ============================================================================
 * STEEL WIRE ROPE SPECIFICATIONS & CALCULATIONS (ISO 2408 / BS EN 12385-4 / ASME B30.9)
 * ============================================================================
 */

export const WIRE_ROPE_DIAMETERS_MM = Object.freeze([
    6, 8, 9, 10, 11, 12, 13, 14, 16, 18, 20, 22, 24, 26, 28, 32, 36, 40, 44, 48, 52, 56, 64
]);

export const WIRE_ROPE_CORES = Object.freeze({
    iwrc: {
        id: 'iwrc',
        name: 'IWRC (Independent Wire Rope Core - Lõi Thép)',
        // Nominal linear mass coefficient W = M * d^2 (kg/m)
        // User confirmed standard: M = 0.0040 kg/m/mm²
        linearMassFactor_M: 0.0040,
        spinningLossFactor_K: 0.356,
        modulusE_GPa: 110.0,
        fillFactor: 0.58
    },
    fc: {
        id: 'fc',
        name: 'FC (Fiber Core - Lõi Sợi / Đay)',
        linearMassFactor_M: 0.0036,
        spinningLossFactor_K: 0.330,
        modulusE_GPa: 90.0,
        fillFactor: 0.50
    }
});

export const WIRE_ROPE_TENSILE_GRADES = Object.freeze([1770, 1960, 2160]);

export const WIRE_ROPE_SAFETY_FACTOR_MIN = 5.0; // ASME B30.9 / TCVN 4244

/**
 * Calculates ISO 2408 compliant mechanical properties for Steel Wire Rope.
 * 
 * Calibration Check:
 *   d = 26mm, Rr = 1960 N/mm², IWRC (K=0.356, M=0.0040):
 *   Fmin = 26² * 1960 * 0.356 / 1000 = 471.69 kN
 *   MBL = 471.69 / 9.80665 ≈ 48.10 t
 *   WLL = 48.10 / 5 = 9.62 t
 */
export function computeWireRopeSpec({
    diameterMm = 26,
    tensileGrade = 1960,
    core = 'iwrc',
    lengthM = 2.5,
    parts = 1,
    sf = WIRE_ROPE_SAFETY_FACTOR_MIN
} = {}) {
    const d = Math.max(4, Number(diameterMm) || 26);
    const Rr = WIRE_ROPE_TENSILE_GRADES.includes(Number(tensileGrade)) ? Number(tensileGrade) : 1960;
    const coreKey = core === 'fc' ? 'fc' : 'iwrc';
    const coreData = WIRE_ROPE_CORES[coreKey];
    const L = Math.max(0.3, Number(lengthM) || 2.5);
    const p = Math.max(1, Math.min(4, Number(parts) || 1));
    const safetyFactor = Math.max(WIRE_ROPE_SAFETY_FACTOR_MIN, Number(sf) || WIRE_ROPE_SAFETY_FACTOR_MIN);

    // 1. Linear Mass: W = M * d^2 (kg/m per part)
    const linearKgPerM = coreData.linearMassFactor_M * d * d;

    // 2. Minimum Breaking Load per ISO 2408: Fmin = (d^2 * Rr * K) / 1000 (kN)
    const singleFminKN = (d * d * Rr * coreData.spinningLossFactor_K) / 1000.0;
    const singleMblT = singleFminKN / 9.80665;

    // 3. WLL per part and total parts
    const singleWllT = singleMblT / safetyFactor;
    const totalWllT = singleWllT * p;
    const totalMblT = singleMblT * p;

    // 4. Hardware and assembly tare mass (Thimbles, Ferrules / Spelter Sockets)
    const endHardwareMassKg = 0.0028 * d * d;
    const totalMassKg = p * (linearKgPerM * L + endHardwareMassKg);

    // 5. Tensile Stiffness EA (N)
    const diaM = d / 1000.0;
    const metalAreaM2 = Math.PI * diaM * diaM * 0.25 * coreData.fillFactor;
    const EA_N = (coreData.modulusE_GPa * 1e9) * metalAreaM2 * p;

    return {
        standard: 'ISO 2408 / BS EN 12385-4 / ASME B30.9',
        slingType: 'wire',
        diameterMm: d,
        tensileGrade: Rr,
        core: coreKey,
        coreName: coreData.name,
        parts: p,
        lengthM: L,
        sf: safetyFactor,
        linearKgPerM: Number(linearKgPerM.toFixed(3)),
        endHardwareMassKg: Number(endHardwareMassKg.toFixed(2)),
        massKg: Number(totalMassKg.toFixed(1)),
        fMinKN: Number((singleFminKN * p).toFixed(2)),
        mblT: Number(totalMblT.toFixed(2)),
        wllT: Number(totalWllT.toFixed(2)),
        E_GPa: coreData.modulusE_GPa,
        EA_MN: Number((EA_N / 1e6).toFixed(1))
    };
}
