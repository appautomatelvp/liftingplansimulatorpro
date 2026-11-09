import { describe, it, expect } from 'vitest';
import {
    CraneLoadChartEngine,
    CRANE_MODELS,
    GroundPressureEngine,
    SOIL_BEARING_LIBRARY,
    COMMERCIAL_MAT_PRESETS,
    ElasticSlingEngine,
    SLING_MATERIALS
} from '../src/core/index.js';

describe('Phase 1 Core Safety Engines (Load Chart, Ground Pressure, Elastic Slings)', () => {

    describe('1. Crane Load Chart & LMI Engine (ASME B30.5 / EN 13000 / ASME P30.1)', () => {
        it('1.1 Accurately evaluates Liebherr LTM 1200 capacity at exact tabular points', () => {
            const engine = new CraneLoadChartEngine('liebherr_ltm1200');

            // At R = 8.0m, Boom = 35.8m, table capacity is exactly 59.0T
            const cap = engine.getRatedCapacityT(8.0, 35.8);
            expect(cap).toBeCloseTo(59.0, 1);

            // At R = 10.0m, Boom = 13.2m, table capacity is exactly 72.0T
            const capShort = engine.getRatedCapacityT(10.0, 13.2);
            expect(capShort).toBeCloseTo(72.0, 1);
        });

        it('1.2 Bilinearly interpolates capacity between both radius and boom lengths', () => {
            const engine = new CraneLoadChartEngine('liebherr_ltm1200');

            // Radius 7.0m is halfway between 6.0m and 8.0m
            // Boom 17.7m: Cap at 6m is 115T, at 8m is 89T -> Midpoint should be ~102T
            const capR7 = engine.getRatedCapacityT(7.0, 17.7);
            expect(capR7).toBeGreaterThan(95.0);
            expect(capR7).toBeLessThan(110.0);

            // Intermediate boom length 22.2m (between 17.7m and 26.7m)
            const capInterp = engine.getRatedCapacityT(8.0, 22.2);
            expect(capInterp).toBeGreaterThan(78.0);
            expect(capInterp).toBeLessThan(89.0);
        });

        it('1.3 Classifies ASME P30.1 Critical Lift (>= 85%) and Overload (> 100%)', () => {
            const engine = new CraneLoadChartEngine('liebherr_ltm1200');

            // R = 10m, Boom = 35.8m -> Rated capacity is 53.0T
            // Case A: 30T load -> 30 / 53 = 56.6% -> SAFE
            const evalSafe = engine.evaluateLift({ grossLoadT: 30.0, radiusM: 10.0, boomLengthM: 35.8 });
            expect(evalSafe.safetyStatus).toBe('SAFE');
            expect(evalSafe.isCriticalLift).toBe(false);
            expect(evalSafe.isOverloaded).toBe(false);

            // Case B: 46T load -> 46 / 53 = 86.8% -> CRITICAL LIFT (>= 85%)
            const evalCrit = engine.evaluateLift({ grossLoadT: 46.0, radiusM: 10.0, boomLengthM: 35.8 });
            expect(evalCrit.safetyStatus).toBe('CRITICAL_LIFT');
            expect(evalCrit.isCriticalLift).toBe(true);
            expect(evalCrit.isOverloaded).toBe(false);

            // Case C: 58T load -> 58 / 53 = 109.4% -> OVERLOAD
            const evalOver = engine.evaluateLift({ grossLoadT: 58.0, radiusM: 10.0, boomLengthM: 35.8 });
            expect(evalOver.safetyStatus).toBe('OVERLOADED');
            expect(evalOver.isOverloaded).toBe(true);
        });

        it('1.4 Detects failure mode: Structural Buckling at high angle vs Tipping at low angle', () => {
            const engine = new CraneLoadChartEngine('liebherr_ltm1200');

            // High boom angle: R = 6m on 35.8m boom -> angle ~80° -> Structural Buckling zone
            const evalHigh = engine.evaluateLift({ grossLoadT: 40.0, radiusM: 6.0, boomLengthM: 35.8 });
            expect(evalHigh.boomAngleDeg).toBeGreaterThan(75.0);
            expect(evalHigh.failureMode).toBe('STRUCTURAL_BUCKLING');

            // Lower boom angle: R = 24m on 35.8m boom -> angle ~48° -> Overturning/Tipping zone
            const evalLow = engine.evaluateLift({ grossLoadT: 18.0, radiusM: 24.0, boomLengthM: 35.8 });
            expect(evalLow.boomAngleDeg).toBeLessThan(65.0);
            expect(evalLow.failureMode).toBe('OVERTURNING_TIPPING');
        });
    });

    describe('2. Ground Bearing Pressure & Crane Mat Sizing Engine (CIRIA C703)', () => {
        it('2.1 Satisfies 3D static vertical equilibrium on 4 outriggers (sum P_i = TotalWeight)', () => {
            const engine = new GroundPressureEngine();

            const reactions = engine.calculateOutriggerReactions({
                carrierMassT: 60.0,
                counterweightT: 72.0,
                grossLoadT: 45.0,
                workingRadiusM: 12.0,
                slewAngleDeg: 0, // Over Front
                outriggerBase: { lengthM: 8.9, widthM: 8.3 }
            });

            // Total mass = 60 + 72 + 45 = 177.0T
            expect(reactions.totalWeightT).toBeCloseTo(177.0, 1);

            const sumPads = reactions.p1_frontRightT + reactions.p2_frontLeftT +
                            reactions.p3_rearLeftT + reactions.p4_rearRightT;
            expect(sumPads).toBeCloseTo(177.0, 0.5);

            // With boom over front (+X), front pads P1 and P2 carry significantly more load than rear pads P3 and P4
            expect(reactions.p1_frontRightT).toBeGreaterThan(reactions.p4_rearRightT);
            expect(reactions.p2_frontLeftT).toBeGreaterThan(reactions.p3_rearLeftT);
        });

        it('2.2 Shifts peak ground reaction as the crane slews to 90° (Over Right)', () => {
            const engine = new GroundPressureEngine();

            const reactionsRight = engine.calculateOutriggerReactions({
                carrierMassT: 60.0,
                counterweightT: 72.0,
                grossLoadT: 40.0,
                workingRadiusM: 10.0,
                slewAngleDeg: 90, // Over Right (+Z)
                outriggerBase: { lengthM: 8.9, widthM: 8.3 }
            });

            // Right side pads P1 and P4 must carry much higher load than left side pads P2 and P3
            expect(reactionsRight.p1_frontRightT).toBeGreaterThan(reactionsRight.p2_frontLeftT);
            expect(reactionsRight.p4_rearRightT).toBeGreaterThan(reactionsRight.p3_rearLeftT);
        });

        it('2.3 Accurately evaluates ground bearing pressure and recommends safe mat sizes', () => {
            const engine = new GroundPressureEngine();
            engine.setSoil('compacted_gravel'); // Capacity: 30.6 T/m²

            // Reaction load = 50T on float of area 0.28m² (no mat)
            // Pressure = 50 / 0.28 = 178.6 T/m² >> 30.6 T/m² -> FAILS SOIL CAPACITY
            const evalFloat = engine.evaluateSoilSafety(50.0, 0.28);
            expect(evalFloat.status).toBe('CRITICAL_SOIL_FAILURE');
            expect(evalFloat.soilUtilizationPct).toBeGreaterThan(100.0);

            // Safe mat area required: (50 * 1.25) / 30.6 = ~2.04 m²
            expect(evalFloat.requiredMatAreaM2).toBeGreaterThanOrEqual(2.0);

            // Evaluated with recommended mat 2.0m x 2.0m (Area = 4.0 m²)
            const evalWithMat = engine.evaluateSoilSafety(50.0, 4.0);
            expect(evalWithMat.status).toBe('SAFE');
            expect(evalWithMat.soilUtilizationPct).toBeLessThan(100.0);
            expect(evalWithMat.pressureTPerM2).toBeCloseTo(12.5, 1);
        });
    });

    describe('3. Elastic Sling Elongation & Static Indeterminacy Engine (ASME B30.9 / DNV-ST-N001)', () => {
        it('3.1 Calculates Hooke elongation: Polyester stretches ~30x more than Wire Rope', () => {
            const engine = new ElasticSlingEngine();

            const tensionT = 12.0;
            const lengthM = 6.0;
            const diaMm = 28;

            const stretchWire = engine.calculateElongation(tensionT, lengthM, 'wire', diaMm);
            const stretchPoly = engine.calculateElongation(tensionT, lengthM, 'poly', diaMm);

            // Wire rope (E = 105 GPa) elongation should be ~10 - 20 mm
            expect(stretchWire.deltaL_mm).toBeGreaterThan(5.0);
            expect(stretchWire.deltaL_mm).toBeLessThan(30.0);

            // Polyester (E = 2.8 GPa) elongation should be > 200 mm
            expect(stretchPoly.deltaL_mm).toBeGreaterThan(200.0);
            expect(stretchPoly.deltaL_mm / stretchWire.deltaL_mm).toBeGreaterThan(15.0);
        });

        it('3.2 Evaluates DNV-ST-N001 4-leg static indeterminacy and diagonal skew load sharing', () => {
            const engine = new ElasticSlingEngine();

            // Symmetrical ideal tension on 4 legs: 10T each (Total 40T)
            const symmetricTensions = [10.0, 10.0, 10.0, 10.0];

            // For rigid payload, DNV skew factor (e.g. 1.35) concentrates load on diagonal pair
            const indeterminacy = engine.evaluateFourLegIndeterminacy(symmetricTensions, true, 1.35);

            expect(indeterminacy.hasSkewRisk).toBe(true);
            expect(indeterminacy.realisticTensionsT[0]).toBeCloseTo(13.5, 1);
            expect(indeterminacy.realisticTensionsT[2]).toBeCloseTo(13.5, 1);

            // Total load remains 40T
            const total = indeterminacy.realisticTensionsT.reduce((a, b) => a + b, 0);
            expect(total).toBeCloseTo(40.0, 0.5);

            // Heavy diagonal carries > 65% of the total load
            expect(indeterminacy.heavyPairSharePct).toBeGreaterThan(65.0);
        });

        it('3.3 De-rates shackle capacity when subjected to out-of-plane side loading (ASME B30.26)', () => {
            const nominalWll = 17.0; // 17-Tonne Crosby Bow Shackle

            // 0° straight in-line pull -> 100% WLL
            const pull0 = ElasticSlingEngine.evaluateShackleSideLoading(nominalWll, 0);
            expect(pull0.derateFactor).toBe(1.00);
            expect(pull0.effectiveWllT).toBe(17.0);

            // 30° out-of-plane side pull -> 70% WLL (ASME B30.26 standard)
            const pull30 = ElasticSlingEngine.evaluateShackleSideLoading(nominalWll, 30);
            expect(pull30.derateFactor).toBe(0.70);
            expect(pull30.effectiveWllT).toBeCloseTo(11.9, 1);
            expect(pull30.status).toBe('WARNING_SIDE_LOAD');

            // 60° side pull -> 50% WLL
            const pull60 = ElasticSlingEngine.evaluateShackleSideLoading(nominalWll, 60);
            expect(pull60.derateFactor).toBe(0.50);
            expect(pull60.effectiveWllT).toBeCloseTo(8.5, 1);

            // > 90° reverse pull -> Prohibited
            const pull100 = ElasticSlingEngine.evaluateShackleSideLoading(nominalWll, 105);
            expect(pull100.isProhibited).toBe(true);
            expect(pull100.effectiveWllT).toBe(0.0);
        });
    });
});
