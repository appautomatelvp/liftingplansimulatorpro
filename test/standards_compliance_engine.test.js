import { describe, it, expect } from 'vitest';
import * as CAE from '../src/core/index.js';

describe('ANTIGRAVITY / LIFTING PLAN PRO — International Standards Compliance Suite', () => {

    describe('1. Steel Grades & ASME BTH-1 (Structural Lifting Devices)', () => {
        it('provides verified mechanical properties for structural steel grades', () => {
            const grades = ['A36', 'A572_50', 'S355JR', 'SS400', 'Q355B'];
            grades.forEach(g => {
                const spec = CAE.Standards.getSteelGradeSpec(g);
                expect(spec).toBeDefined();
                expect(spec.yieldMPa).toBeGreaterThan(200);
                expect(spec.tensileMPa).toBeGreaterThan(spec.yieldMPa);
                expect(spec.densityKgM3).toBeCloseTo(7850, 0);
            });
        });

        it('strictly enforces Category A (Nd = 2.0) and Category B (Nd = 3.0) design factors', () => {
            const catA = CAE.Standards.getDesignCategorySpec('A');
            const catB = CAE.Standards.getDesignCategorySpec('B');
            expect(catA.Nd).toBe(2.0);
            expect(catB.Nd).toBe(3.0);

            // S355JR: Fy = 355 MPa
            const stressA = CAE.Standards.getAllowableStress('S355JR', 'A');
            const stressB = CAE.Standards.getAllowableStress('S355JR', 'B');
            expect(stressA.allowableBendingMPa).toBeCloseTo(355 / 2.0, 1);
            expect(stressB.allowableBendingMPa).toBeCloseTo(355 / 3.0, 1);
            expect(stressA.allowableShearMPa).toBeCloseTo(0.577 * 355 / 2.0, 1);
        });

        it('checks lifting beam bending and shear per ASME BTH-1 / BS EN 13155', () => {
            const beamCheck = CAE.Standards.checkLiftingBeam({
                loadT: 20.0,
                spanM: 6.0,
                sectionModulusZ_cm3: 2800,
                shearAreaAv_cm2: 95,
                steelGrade: 'S355JR',
                designCategory: 'B'
            });
            expect(beamCheck.isValid).toBe(true);
            expect(beamCheck.momentMaxKNm).toBeCloseTo(20.0 * 9.80665 * 6.0 / 4, 1);
            expect(beamCheck.bendingUtilPercent).toBeGreaterThan(0);
            expect(beamCheck.bendingUtilPercent).toBeLessThan(100);
        });

        it('checks spreader bar compression and Euler buckling per ASME BTH-1', () => {
            const spreaderCheck = CAE.Standards.checkSpreaderBar({
                slingTensionT: 15.0,
                topBridleAngleDeg: 60.0,
                lengthM: 8.0,
                outerDiaMm: 219.1,
                wallThickMm: 8.0,
                steelGrade: 'S355JR',
                designCategory: 'B'
            });
            expect(spreaderCheck.isValid).toBe(true);
            expect(spreaderCheck.axialCompressionKN).toBeCloseTo(15.0 * 9.80665 * Math.cos(60 * Math.PI / 180), 1);
            expect(spreaderCheck.eulerPcrKN).toBeGreaterThan(spreaderCheck.axialCompressionKN);
            expect(spreaderCheck.bucklingUtilPercent).toBeLessThan(100);
        });
    });

    describe('2. Wire Rope Rigging per ISO 2408 / BS EN 12385-4 / ASME B30.9', () => {
        it('calculates exact linear mass using approved constant M = 0.0040 kg/m/mm²', () => {
            const wire26 = CAE.Standards.computeWireRopeSpec({
                diameterMm: 26,
                tensileGrade: 1960,
                core: 'iwrc',
                lengthM: 10.0,
                parts: 1,
                sf: 5.0
            });
            // W = 0.0040 * 26^2 = 2.704 kg/m
            expect(wire26.linearKgPerM).toBeCloseTo(2.704, 3);
            // End terminations = 0.0028 * 26^2 = 1.89 kg; Total = 10 * 2.704 + 1.89 = 28.93 kg
            expect(wire26.massKg).toBeCloseTo(28.9, 1);
        });

        it('calculates Fmin, MBL, and WLL at standard SF = 5.0 for 26mm IWRC 1960', () => {
            const wire26 = CAE.Standards.computeWireRopeSpec({
                diameterMm: 26,
                tensileGrade: 1960,
                core: 'iwrc',
                sf: 5.0
            });
            // Fmin = 26^2 * 1960 * 0.356 / 1000 = 471.69 kN
            expect(wire26.fMinKN).toBeCloseTo(471.69, 1);
            // MBL = 471.69 / 9.80665 = 48.10 t
            expect(wire26.mblT).toBeCloseTo(48.10, 1);
            // WLL = 48.10 / 5 = 9.62 t
            expect(wire26.wllT).toBeCloseTo(9.62, 1);
        });

        it('correctly derates WLL when Safety Factor SF is manually increased', () => {
            const wireSf5 = CAE.Standards.computeWireRopeSpec({ diameterMm: 26, sf: 5.0 });
            const wireSf6 = CAE.Standards.computeWireRopeSpec({ diameterMm: 26, sf: 6.0 });
            expect(wireSf5.mblT).toBeCloseTo(wireSf6.mblT, 1); // MBL remains physical property
            expect(wireSf6.wllT).toBeCloseTo(wireSf5.mblT / 6.0, 2);
            expect(wireSf6.wllT).toBeLessThan(wireSf5.wllT);
        });
    });

    describe('3. Alloy Steel Chain Slings per BS EN 818 / ASME B30.9', () => {
        it('calculates Grade 80, 100, and 120 capacities with SF = 4.0', () => {
            const g80 = CAE.Standards.computeChainSpec({ diameterMm: 16, grade: 'g80', sf: 4.0 });
            const g100 = CAE.Standards.computeChainSpec({ diameterMm: 16, grade: 'g100', sf: 4.0 });
            const g120 = CAE.Standards.computeChainSpec({ diameterMm: 16, grade: 'g120', sf: 4.0 });

            expect(g80.wllT).toBeCloseTo(0.0315 * 16 * 16, 1); // ~8.06 t
            expect(g100.wllT).toBeCloseTo(0.0394 * 16 * 16, 1); // ~10.09 t (+25%)
            expect(g120.wllT).toBeCloseTo(0.0473 * 16 * 16, 1); // ~12.11 t (+50%)
            expect(g80.mblT).toBeCloseTo(g80.wllT * 4.0, 1);
        });

        it('strictly blocks non-overhead lifting chain grades (G30, G43, G70)', () => {
            ['g30', 'g43', 'g70'].forEach(blockedGrade => {
                const spec = CAE.Standards.computeChainSpec({ diameterMm: 16, grade: blockedGrade });
                expect(spec.isValid).toBe(false);
                expect(spec.isBlocked).toBe(true);
                expect(spec.wllT).toBe(0);
                expect(spec.error).toContain('KHÔNG ĐƯỢC PHÉP');
            });
        });

        it('applies edge radius derating factors per EN 818-6', () => {
            const sharpEdge = CAE.Standards.computeChainSpec({
                diameterMm: 16,
                grade: 'g80',
                edgeRadiusMm: 10 // r < d (10 < 16) -> 50%
            });
            expect(sharpEdge.edgeDerate.derateFactor).toBe(0.50);
            expect(sharpEdge.effectiveWllT).toBeCloseTo(sharpEdge.wllT * 0.50, 1);

            const moderateEdge = CAE.Standards.computeChainSpec({
                diameterMm: 16,
                grade: 'g80',
                edgeRadiusMm: 24 // d <= r < 2d (16 <= 24 < 32) -> 70%
            });
            expect(moderateEdge.edgeDerate.derateFactor).toBe(0.70);
            expect(moderateEdge.effectiveWllT).toBeCloseTo(moderateEdge.wllT * 0.70, 1);

            const withProtector = CAE.Standards.computeChainSpec({
                diameterMm: 16,
                grade: 'g80',
                edgeRadiusMm: 10,
                hasCornerProtector: true // Protected -> 100%
            });
            expect(withProtector.edgeDerate.derateFactor).toBe(1.0);
            expect(withProtector.effectiveWllT).toBe(withProtector.wllT);
        });
    });

    describe('4. Synthetic Slings per BS EN 1492-1 (Web) & BS EN 1492-2 (Round)', () => {
        it('enforces international color code and stripe rules', () => {
            const ratings = [
                { wll: 1.0, color: '#9333ea', stripes: 1 }, // Purple
                { wll: 2.0, color: '#16a34a', stripes: 2 }, // Green
                { wll: 3.0, color: '#eab308', stripes: 3 }, // Yellow
                { wll: 4.0, color: '#64748b', stripes: 4 }, // Grey (#64748b)
                { wll: 5.0, color: '#dc2626', stripes: 5 }, // Red
                { wll: 6.0, color: '#92400e', stripes: 6 }, // Brown (#92400e)
                { wll: 8.0, color: '#2563eb', stripes: 8 }  // Blue
            ];

            ratings.forEach(r => {
                const spec = CAE.Standards.getEN1492SpecByWLL(r.wll);
                expect(spec.colorHex).toBe(r.color);
                expect(spec.stripeCount).toBe(r.stripes);
            });

            // Round slings must NOT have black capacity stripes per EN 1492-2
            const roundSling = CAE.Standards.computeSyntheticSlingSpec({
                slingType: 'round_sling',
                widthOrDiaMm: 40
            });
            expect(roundSling.stripeCount).toBe(0);
        });

        it('enforces synthetic safety factor SF = 7.0:1', () => {
            const web = CAE.Standards.computeSyntheticSlingSpec({
                slingType: 'web',
                widthOrDiaMm: 60
            });
            expect(web.sf).toBe(7.0);
            expect(web.mblT).toBeCloseTo(web.wllT * 7.0, 1);
        });
    });

    describe('5. Rigging Hardware per ASME B30.26 & RR-C-271', () => {
        it('validates shackle pin diameter exceeds body diameter (Dpin > Dbody)', () => {
            const valid = CAE.Standards.validateShackleGeometry({ bodyDiaMm: 25, pinDiaMm: 28 });
            expect(valid.isValid).toBe(true);

            const invalid = CAE.Standards.validateShackleGeometry({ bodyDiaMm: 28, pinDiaMm: 25 });
            expect(invalid.isValid).toBe(false);
            expect(invalid.error).toContain('D_pin');
        });

        it('enforces ASME B30.26 shackle side loading derating', () => {
            // Bow shackle: 0° -> 100%, 45° -> 70%, 90° -> 50%
            expect(CAE.Standards.computeShackleSideDerate('bow', 0).capacityFactor).toBe(1.0);
            expect(CAE.Standards.computeShackleSideDerate('bow', 45).capacityFactor).toBe(0.70);
            expect(CAE.Standards.computeShackleSideDerate('bow', 90).capacityFactor).toBe(0.50);

            // Dee shackle side-loaded > 5° is prohibited
            const deeCheck = CAE.Standards.computeShackleSideDerate('dee', 10);
            expect(deeCheck.isProhibited).toBe(true);
            expect(deeCheck.capacityFactor).toBe(0);
        });
    });

    describe('6. Sling Angle & Load Amplification Factor (ASME B30.9)', () => {
        it('calculates exact LAF = 1 / sin(alpha)', () => {
            expect(CAE.Standards.computeLoadAmplificationFactor(90)).toBeCloseTo(1.0, 3);
            expect(CAE.Standards.computeLoadAmplificationFactor(60)).toBeCloseTo(1.155, 3);
            expect(CAE.Standards.computeLoadAmplificationFactor(45)).toBeCloseTo(1.414, 3);
            expect(CAE.Standards.computeLoadAmplificationFactor(30)).toBeCloseTo(2.000, 3);
        });

        it('evaluates status: < 30° is CRITICAL, but does NOT hard-block simulation', () => {
            const shallow = CAE.Standards.evaluateAngleStatus(28.0);
            expect(shallow.isCritical).toBe(true);
            expect(shallow.status).toBe('CRITICAL');
            expect(shallow.alertColor).toBe('#ef4444');
            // Simulation permission flag:
            expect(shallow.allowSimulation).toBe(true);

            const warning = CAE.Standards.evaluateAngleStatus(40.0);
            expect(warning.status).toBe('WARNING');
            expect(warning.alertColor).toBe('#f59e0b');

            const safe = CAE.Standards.evaluateAngleStatus(65.0);
            expect(safe.status).toBe('OK');
        });
    });

    describe('7. Rigging Rule Engine (Single Source of Truth)', () => {
        it('resolves default chain record consistently with UI and Physics', () => {
            const rawRec = { diaMm: 16, lengthM: 3.0 };
            const resolved = CAE.Standards.resolveSling(rawRec, { globalType: 'chain' });

            expect(resolved.slingType).toBe('chain');
            expect(resolved.grade).toBe('g80');
            expect(resolved.sf).toBe(4.0);
            expect(resolved.minStdSf).toBe(4.0);
            expect(resolved.wllT).toBeCloseTo(0.0315 * 16 * 16, 1);
            expect(resolved.label).toContain('Xích hợp kim G80');
            expect(resolved.isValid).toBe(true);
        });

        it('resolves wire rope record with ISO 2408 parameters and SF = 5.0', () => {
            const rawRec = { diaMm: 26, lengthM: 4.0 };
            const resolved = CAE.Standards.resolveSling(rawRec, { globalType: 'wire' });

            expect(resolved.slingType).toBe('wire');
            expect(resolved.sf).toBe(5.0);
            expect(resolved.mblT).toBeCloseTo(48.1, 1);
            expect(resolved.wllT).toBeCloseTo(9.62, 1);
            expect(resolved.linearKgPerM).toBeCloseTo(2.704, 3);
        });

        it('resolves multi-part slings (chập đôi / 2-part) multiplying WLL and MBL', () => {
            const single = CAE.Standards.resolveSling({ diaMm: 22, parts: 1 }, { globalType: 'wire' });
            const double = CAE.Standards.resolveSling({ diaMm: 22, parts: 2 }, { globalType: 'wire' });

            expect(double.wllT).toBeCloseTo(single.wllT * 2, 1);
            expect(double.mblT).toBeCloseTo(single.mblT * 2, 1);
        });

        it('allows manual SF increase while re-derating WLL safely', () => {
            const std = CAE.Standards.resolveSling({ diaMm: 22, sf: 5.0 }, { globalType: 'wire' });
            const customSf = CAE.Standards.resolveSling({ diaMm: 22, sf: 8.0 }, { globalType: 'wire' });

            expect(customSf.sf).toBe(8.0);
            expect(customSf.mblT).toBeCloseTo(std.mblT, 1);
            expect(customSf.wllT).toBeLessThan(std.wllT);
            expect(customSf.wllT).toBeCloseTo(std.mblT / 8.0, 1);
        });
    });
});
