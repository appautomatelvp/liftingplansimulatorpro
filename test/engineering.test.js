import { describe, it, expect } from 'vitest';
import { EngineeringEngine } from '../src/core/EngineeringEngine.js';

describe('EngineeringEngine Analytical Formulation (ASME / ISO)', () => {
    it('1. Symmetrical 4-point lift tension matches analytical formula T = W / (4 * sin(beta))', () => {
        const massKg = 24000;
        const totalWeightN = massKg * EngineeringEngine.GRAVITY;
        const padEyes = [
            { x:  2.5, y: 1.3, z:  1.0 },
            { x: -2.5, y: 1.3, z:  1.0 },
            { x: -2.5, y: 1.3, z: -1.0 },
            { x:  2.5, y: 1.3, z: -1.0 }
        ];
        const cog = { x: 0, y: 0, z: 0 };
        const apexH = 4.0;
        const daf = 1.0; // static test

        const tensions = EngineeringEngine.calculateSlingTensions(massKg, padEyes, cog, apexH, daf);
        expect(tensions).toHaveLength(4);

        // Every leg should have identical tension
        const t0 = tensions[0];
        const horizR = Math.hypot(2.5, 1.0);
        const legLen = Math.hypot(horizR, apexH);
        const sinBeta = apexH / legLen;
        const expectedLegN = (totalWeightN / 4) / sinBeta;

        expect(t0.staticN).toBeCloseTo(expectedLegN, -1);
        expect(tensions[1].staticN).toBeCloseTo(expectedLegN, -1);
        expect(tensions[2].staticN).toBeCloseTo(expectedLegN, -1);
        expect(tensions[3].staticN).toBeCloseTo(expectedLegN, -1);
    });

    it('2. Eccentric Center of Gravity (CoG) shifts load proportionally to heavy side', () => {
        const massKg = 24000;
        const padEyes = [
            { x:  3.0, y: 1.3, z:  1.0 },
            { x: -3.0, y: 1.3, z:  1.0 },
            { x: -3.0, y: 1.3, z: -1.0 },
            { x:  3.0, y: 1.3, z: -1.0 }
        ];
        // Shift CoG +1.0m towards +X
        const cogShift = { x: 1.0, y: 0, z: 0 };
        const apexH = 4.0;

        const tensions = EngineeringEngine.calculateSlingTensions(massKg, padEyes, cogShift, apexH, 1.0);
        
        // Legs on +X side (index 0 and 3) must carry significantly higher load than -X (index 1 and 2)
        expect(tensions[0].staticN).toBeGreaterThan(tensions[1].staticN);
        expect(tensions[3].staticN).toBeGreaterThan(tensions[2].staticN);

        // Vertical component sum must strictly equal total weight (within 0.5% rounding margin)
        const totalWeightN = massKg * EngineeringEngine.GRAVITY;
        const sumVerticalN = tensions.reduce((acc, t) => acc + (t.staticN / t.tensionFactor), 0);
        expect(Math.abs(sumVerticalN - totalWeightN)).toBeLessThan(totalWeightN * 0.005);
    });

    it('3. Dynamic Amplification Factor (DAF) calculates per ISO 8686', () => {
        const dafSlow = EngineeringEngine.calculateDAF(0.2, 'shore');
        const dafFast = EngineeringEngine.calculateDAF(0.8, 'shore');
        expect(dafSlow).toBeGreaterThanOrEqual(1.05);
        expect(dafFast).toBeGreaterThan(dafSlow);
        expect(dafFast).toBeLessThanOrEqual(1.4);
    });

    it('4. Wind load calculation obeys quadratic velocity law EN 13001-2', () => {
        const area = 15.0; // m^2
        const wind10 = EngineeringEngine.calculateWindLoad(area, 10.0, 1.2);
        const wind20 = EngineeringEngine.calculateWindLoad(area, 20.0, 1.2);
        // Double wind speed => 4x force
        expect(wind20.forceN).toBeCloseTo(wind10.forceN * 4, -1);
    });

    it('5. Load chart correctly interpolates capacity at arbitrary radius', () => {
        const chart = [
            { radiusM: 10, capacityT: 60.0 },
            { radiusM: 20, capacityT: 40.0 },
            { radiusM: 30, capacityT: 25.0 }
        ];
        const eval15 = EngineeringEngine.evaluateLoadChart(chart, 15);
        expect(eval15.ratedCapacityT).toBe(50.0);
        expect(eval15.maxSafeLoadT).toBe(42.5); // 85% rule
    });

    it('6. Compliance Matrix flags critical angle violation if beta < 30 deg', () => {
        const badPlan = {
            cargo: { massKg: 20000, padEyes: [{ x: 5, y: 0, z: 2 }, { x: -5, y: 0, z: 2 }, { x: -5, y: 0, z: -2 }, { x: 5, y: 0, z: -2 }] },
            rigging: { spreaderMassKg: 0, topBridle: { active: true, lengthM: 1.0 } }, // extremely short bridle => flat angle
            crane: { hookPosition: { x: 0, y: 1.0, z: 0 } },
            environment: { windSpeedMps: 4 }
        };
        const audit = EngineeringEngine.validateCompliance(badPlan);
        expect(audit.overallStatus).toBe('FAIL');
        const betaCheck = audit.checks.find(c => c.code === 'ASME_B30_9_BETA');
        expect(betaCheck.status).toBe('FAIL');
    });

    it('7. calculateSlingTensions handles { localPos: {x,y,z} } format and NEVER outputs NaN', () => {
        const massKg = 24000;
        const padEyesLocalPos = [
            { id: 'pe_0', localPos: { x:  2.94, y: 1.295, z:  1.13 }, wllT: 17.0 },
            { id: 'pe_1', localPos: { x: -2.94, y: 1.295, z:  1.13 }, wllT: 17.0 },
            { id: 'pe_2', localPos: { x: -2.94, y: 1.295, z: -1.13 }, wllT: 17.0 },
            { id: 'pe_3', localPos: { x:  2.94, y: 1.295, z: -1.13 }, wllT: 17.0 }
        ];
        const cog = { x: 0, y: -0.1, z: 0 };
        const apexH = 3.5;

        const tensions = EngineeringEngine.calculateSlingTensions(massKg, padEyesLocalPos, cog, apexH, 1.15);
        expect(tensions).toHaveLength(4);
        tensions.forEach(t => {
            expect(Number.isFinite(t.betaDeg)).toBe(true);
            expect(Number.isNaN(t.betaDeg)).toBe(false);
            expect(Number.isFinite(t.dynamicT)).toBe(true);
            expect(Number.isNaN(t.dynamicT)).toBe(false);
            expect(t.betaDeg).toBeGreaterThan(30.0);
            expect(t.dynamicT).toBeGreaterThan(0);
        });
    });

    it('8. validateCompliance fails gracefully with DATA_INTEGRITY when pad-eyes are missing or corrupted', () => {
        const corruptPlan = {
            cargo: { massKg: 20000, padEyes: [] }, // empty pad-eyes
            rigging: { spreaderMassKg: 0 },
            crane: { hookPosition: { x: 0, y: 10, z: 0 } }
        };
        const audit = EngineeringEngine.validateCompliance(corruptPlan);
        expect(audit.overallStatus).toBe('FAIL');
        expect(audit.isCompliant).toBe(false);
        const integrityCheck = audit.checks.find(c => c.code === 'DATA_INTEGRITY');
        expect(integrityCheck).toBeDefined();
        expect(integrityCheck.status).toBe('FAIL');

        // Verify that NO check value contains NaN
        audit.checks.forEach(c => {
            expect(String(c.value)).not.toContain('NaN');
            expect(String(c.limit)).not.toContain('NaN');
        });
    });

    it('9. validateCompliance with full LiftPlan format produces 100% valid numbers and zero NaNs', () => {
        const validPlan = {
            cargo: {
                massKg: 24000,
                dimensions: { x: 6.06, y: 2.59, z: 2.44 },
                cogLocal: { x: 0.1, y: -0.1, z: 0.05 },
                padEyes: [
                    { localPos: { x:  2.94, y: 1.295, z:  1.13 }, wllT: 17.0 },
                    { localPos: { x: -2.94, y: 1.295, z:  1.13 }, wllT: 17.0 },
                    { localPos: { x: -2.94, y: 1.295, z: -1.13 }, wllT: 17.0 },
                    { localPos: { x:  2.94, y: 1.295, z: -1.13 }, wllT: 17.0 }
                ]
            },
            rigging: {
                spreaderMassKg: 9500,
                spreaderWllT: 50.0,
                topBridle: { active: true, lengthM: 6.5, wllT: 29.0 },
                lowerLegs: [{ wllT: 17.0 }, { wllT: 17.0 }, { wllT: 17.0 }, { wllT: 17.0 }]
            },
            crane: {
                hookPosition: { x: 0, y: 12, z: 0 }
            },
            environment: {
                windSpeedMps: 4.2,
                maxWindSpeedMps: 12.0
            }
        };

        const audit = EngineeringEngine.validateCompliance(validPlan);
        expect(audit.overallStatus).toBe('PASS');
        expect(audit.isCompliant).toBe(true);
        expect(audit.checks.length).toBeGreaterThanOrEqual(6);

        audit.checks.forEach(c => {
            expect(String(c.value)).not.toContain('NaN');
            expect(String(c.limit)).not.toContain('NaN');
            expect(String(c.value)).not.toContain('undefined');
        });
    });

    it('10. calculateLAF strictly adheres to ASME B30.9 / OSHA Standard Reference Matrix', () => {
        // Hard-coded matrix triggers:
        // α = 90° -> LAF = 1.000 (Ideal)
        // α = 60° -> LAF = 1.155 (Safe / Recommended)
        // α = 45° -> LAF = 1.414 (Acceptable with reduction)
        // α = 30° -> LAF = 2.000 (Absolute Minimum Safety Limit)
        expect(EngineeringEngine.calculateLAF(90)).toBe(1.000);
        expect(EngineeringEngine.calculateLAF(60)).toBe(1.155);
        expect(EngineeringEngine.calculateLAF(45)).toBe(1.414);
        expect(EngineeringEngine.calculateLAF(30)).toBe(2.000);

        // General angle tests: LAF = 1 / sin(alpha)
        // α = 50° -> sin(50°) ≈ 0.766044 -> LAF ≈ 1.305
        expect(EngineeringEngine.calculateLAF(50)).toBe(1.305);
        // α = 20° -> sin(20°) ≈ 0.342020 -> LAF ≈ 2.924
        expect(EngineeringEngine.calculateLAF(20)).toBe(2.924);

        // Edge conditions: <= 0 returns Infinity
        expect(EngineeringEngine.calculateLAF(0)).toBe(Infinity);
        expect(EngineeringEngine.calculateLAF(-10)).toBe(Infinity);
    });

    it('11. calculateTopIncludedAngle computes beta = 180° - 2*alpha correctly', () => {
        expect(EngineeringEngine.calculateTopIncludedAngle(90)).toBe(0);
        expect(EngineeringEngine.calculateTopIncludedAngle(60)).toBe(60);
        expect(EngineeringEngine.calculateTopIncludedAngle(45)).toBe(90);
        expect(EngineeringEngine.calculateTopIncludedAngle(30)).toBe(120);
    });

    it('12. evaluateRiggingSafety correctly classifies SAFE ZONE (60° <= α <= 90°)', () => {
        const result = EngineeringEngine.evaluateRiggingSafety({
            grossWeight: 10.0, // 10 tonnes
            nominalLegs: 2,
            alphaDeg: 60,
            ratedWllPerLeg: 10.0,
            isRigidLoad: false,
            unit: 't',
            lang: 'en'
        });

        // T = (10 / 2) * 1.155 = 5.775 -> 5.78 T
        expect(result.status).toBe(EngineeringEngine.SAFETY_ZONES.SAFE);
        expect(result.isBlocked).toBe(false);
        expect(result.laf).toBe(1.155);
        expect(result.slingTension).toBeCloseTo(5.78, 1);
        expect(result.tensionIncreasePct).toBe(15.5);
        expect(result.errorMessage).toBeNull();
    });

    it('13. evaluateRiggingSafety triggers WARNING ZONE (30° <= α < 60°) and checks WLL', () => {
        const result = EngineeringEngine.evaluateRiggingSafety({
            grossWeight: 10.0,
            nominalLegs: 2,
            alphaDeg: 45,
            ratedWllPerLeg: 10.0,
            isRigidLoad: false,
            unit: 't',
            lang: 'en'
        });

        // T = (10 / 2) * 1.414 = 7.07 T
        expect(result.status).toBe(EngineeringEngine.SAFETY_ZONES.WARNING);
        expect(result.isBlocked).toBe(false); // 7.07T < 10.0T WLL
        expect(result.laf).toBe(1.414);
        expect(result.slingTension).toBeCloseTo(7.07, 1);
        expect(result.tensionIncreasePct).toBe(41.4);
        expect(result.warningMessage).toContain('Warning: Horizontal sling angle');

        // Recommendation engine triggered because alpha <= 45°
        expect(result.recommendations.length).toBeGreaterThanOrEqual(2);
        expect(result.recommendations[0].code).toBe('OPTION_A');
        expect(result.recommendations[1].code).toBe('OPTION_B');
    });

    it('14. evaluateRiggingSafety BLOCKS operation in DANGER ZONE (α < 30°) per ASME B30.9', () => {
        const result = EngineeringEngine.evaluateRiggingSafety({
            grossWeight: 10.0,
            nominalLegs: 2,
            alphaDeg: 25,
            ratedWllPerLeg: 15.0,
            isRigidLoad: false,
            unit: 't',
            lang: 'en'
        });

        expect(result.status).toBe(EngineeringEngine.SAFETY_ZONES.CRITICAL_VIOLATION);
        expect(result.isBlocked).toBe(true);
        expect(result.errorMessage).toContain('Error: Horizontal sling angle is less than 30 degrees. Operation prohibited under ASME B30.9.');
        expect(result.recommendations.length).toBeGreaterThanOrEqual(2);
    });

    it('15. evaluateRiggingSafety implements 4-leg rigid hitch rule (N_eff = 2) per ASME B30.9 Note 1', () => {
        // Gross weight 10T, 4 legs, 60° horizontal angle
        // If rigid: N_eff = 2 -> T = (10 / 2) * 1.155 = 5.78 T
        const rigidResult = EngineeringEngine.evaluateRiggingSafety({
            grossWeight: 10.0,
            nominalLegs: 4,
            alphaDeg: 60,
            ratedWllPerLeg: 10.0,
            isRigidLoad: true
        });
        expect(rigidResult.effectiveLegs).toBe(2);
        expect(rigidResult.slingTension).toBeCloseTo(5.78, 1);

        // If flexible / equalized: N_eff = 4 -> T = (10 / 4) * 1.155 = 2.89 T
        const flexibleResult = EngineeringEngine.evaluateRiggingSafety({
            grossWeight: 10.0,
            nominalLegs: 4,
            alphaDeg: 60,
            ratedWllPerLeg: 10.0,
            isRigidLoad: false
        });
        expect(flexibleResult.effectiveLegs).toBe(4);
        expect(flexibleResult.slingTension).toBeCloseTo(2.89, 1);
    });

    it('16. evaluateRiggingSafety blocks operation when sling tension exceeds rated WLL', () => {
        const overloadResult = EngineeringEngine.evaluateRiggingSafety({
            grossWeight: 20.0,
            nominalLegs: 2,
            alphaDeg: 60,
            ratedWllPerLeg: 8.0, // T = (20/2)*1.155 = 11.55 T > 8.0 T
            isRigidLoad: false,
            unit: 't',
            lang: 'en'
        });

        expect(overloadResult.isBlocked).toBe(true);
        expect(overloadResult.isOverloaded).toBe(true);
        expect(overloadResult.errorMessage).toContain('exceeds rated WLL');
    });

    it('17. evaluateRiggingSafety validates inputs and rejects non-finite or negative numbers', () => {
        expect(() => EngineeringEngine.evaluateRiggingSafety({ grossWeight: -5 })).toThrow();
        expect(() => EngineeringEngine.evaluateRiggingSafety({ grossWeight: 10, nominalLegs: 0 })).toThrow();
        expect(() => EngineeringEngine.evaluateRiggingSafety({ grossWeight: 10, nominalLegs: 4, alphaDeg: -5 })).toThrow();
    });
});
