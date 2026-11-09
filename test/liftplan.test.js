import { describe, it, expect } from 'vitest';
import { LiftPlanModel } from '../src/core/LiftPlanModel.js';

describe('LiftPlanModel ASME P30.1 Verification', () => {
    it('1. Initializes default ASME P30.1 Critical Lift Plan with valid metadata and specs', () => {
        const plan = new LiftPlanModel();
        expect(plan.schemaVersion).toBe('1.0.0-ASME-P30.1');
        expect(plan.metadata.category).toBe('CRITICAL_LIFT');
        expect(plan.cargo.grossWeightKg).toBe(24000);
        expect(plan.crane.maxRatedCapacityT).toBe(65.0);
        expect(plan.rigging.topBridle.slingAngleDeg).toBe(60.0);
        expect(plan.approvals.appointedPerson.status).toBe('SIGNED');
        expect(plan.approvals.terminalAuthority.status).toBe('APPROVED');
    });

    it('2. Evaluates analytical engineering compliance correctly', () => {
        const plan = new LiftPlanModel();
        const compliance = plan.evaluateCompliance();
        expect(compliance).toBeDefined();
        expect(compliance.checks.length).toBeGreaterThanOrEqual(6);
        expect(compliance.isCompliant).toBe(true);

        const angleCheck = compliance.checks.find(c => c.name.includes('Góc nghiêng'));
        expect(angleCheck).toBeDefined();
        expect(angleCheck.status).toBe('PASS');

        const craneCheck = compliance.checks.find(c => c.name.includes('Biểu đồ tải'));
        expect(craneCheck).toBeDefined();
        expect(craneCheck.status).toBe('PASS');
    });

    it('3. Flags compliance violation when cargo exceeds crane capacity', () => {
        const plan = new LiftPlanModel({
            grossWeightKg: 85000, // Exceeds 65-tonne crane capacity
            maxRatedCapacityT: 65.0
        });
        const compliance = plan.evaluateCompliance();
        expect(compliance.isCompliant).toBe(false);

        const craneCheck = compliance.checks.find(c => c.name.includes('Biểu đồ tải'));
        expect(craneCheck.status).toBe('FAIL');
    });

    it('4. Serializes to standard JSON and generates ASME P30.1 printable HTML report', () => {
        const plan = new LiftPlanModel();
        const jsonStr = plan.exportJSON();
        const parsed = JSON.parse(jsonStr);
        expect(parsed.schemaVersion).toBe('1.0.0-ASME-P30.1');
        expect(parsed.cargo.grossWeightKg).toBe(24000);

        const html = plan.generatePrintableHTML();
        expect(html).toContain('CRITICAL LIFT PLAN');
        expect(html).toContain('ASME P30.1');
        expect(html).toContain('PASSED COMPLIANCE');
        expect(html).toContain('Appointed Person');
    });

    it('5. Generates 2D vector CAD schematics (Side Elevation, End Elevation, Top Plan)', () => {
        const plan = new LiftPlanModel({
            cargoDesc: '40ft Heavy Industrial Container',
            grossWeightKg: 32000,
            dimensionsM: { length: 12.192, width: 2.438, height: 2.591 },
            cogOffsetM: { x: 0.25, y: -0.15, z: 0.10 },
            liveRiggingData: {
                hasSpreader: true,
                beamSpanM: 12.0,
                beamCompT: 9.2,
                groundClearanceM: 1.2
            }
        });

        const sideSvg = plan.generateSideElevationSVG();
        expect(sideSvg).toContain('<svg');
        expect(sideSvg).toContain('MẶT CẮT ĐỨNG CẠNH (SIDE ELEVATION X-Y)');
        expect(sideSvg).toContain('ASME B30.20');
        expect(sideSvg).toContain('CoG');
        expect(sideSvg).toContain('GROUND DATUM');

        const endSvg = plan.generateEndElevationSVG();
        expect(endSvg).toContain('<svg');
        expect(endSvg).toContain('MẶT CẮT ĐẦU KIỆN (END ELEVATION Z-Y)');
        expect(endSvg).toContain('W = 2.44 m');

        const topSvg = plan.generateTopPlanSVG();
        expect(topSvg).toContain('<svg');
        expect(topSvg).toContain('MẶT BẰNG BỐ TRÍ TAI CẨU');
        expect(topSvg).toContain('LP1');
        expect(topSvg).toContain('LP2');
        expect(topSvg).toContain('LP3');
        expect(topSvg).toContain('LP4');
    });

    it('6. Generates ASME B30.9 Per-Cable Tension & LAF Analysis Table', () => {
        const plan = new LiftPlanModel({
            grossWeightKg: 28000,
            liveRiggingData: {
                upperCables: [
                    { id: 'L1-1', name: 'Cáp treo dầm L1-1', lengthM: 4.5, angleDeg: 60.0, tensionT: 8.08, wllT: 20.0 },
                    { id: 'L1-2', name: 'Cáp treo dầm L1-2', lengthM: 4.5, angleDeg: 60.0, tensionT: 8.08, wllT: 20.0 }
                ],
                lowerCables: [
                    { id: 'L2-1', name: 'Cáp nâng hạ L2-1', lengthM: 2.8, angleDeg: 90.0, tensionT: 7.00, wllT: 15.0 },
                    { id: 'L2-2', name: 'Cáp nâng hạ L2-2', lengthM: 2.8, angleDeg: 90.0, tensionT: 7.00, wllT: 15.0 }
                ]
            }
        });

        const cableTable = plan.generatePerCableAnalysisTableHTML();
        expect(cableTable).toContain('<table');
        expect(cableTable).toContain('L1-1');
        expect(cableTable).toContain('L2-1');
        expect(cableTable).toContain('1.155'); // LAF at 60°
        expect(cableTable).toContain('1.000'); // LAF at 90°
        expect(cableTable).toContain('SAFE');
    });

    it('7. Generates complete Rigging Bill of Materials (BOM) Table', () => {
        const plan = new LiftPlanModel({
            liveRiggingData: {
                bom: [
                    { itemNo: 1, category: 'Hook', name: 'Móc Cẩu Liebherr 100T', spec: 'DIN 15401', quantity: 1, wllT: 100, proofT: 200, standard: 'ASME B30.26', remarks: 'Main hook' },
                    { itemNo: 2, category: 'Spreader', name: 'Dầm Modulift 40ft', spec: 'Span 12.0m', quantity: 1, wllT: 50, proofT: 75, standard: 'ASME B30.20', remarks: 'Compression strut' }
                ]
            }
        });

        const bomHtml = plan.generateRiggingBOMTableHTML();
        expect(bomHtml).toContain('Móc Cẩu Liebherr 100T');
        expect(bomHtml).toContain('Dầm Modulift 40ft');
        expect(bomHtml).toContain('ASME B30.20');
    });

    it('8. Generates Safety Presets Comparison Table (Live vs Min Safe vs Absolute Safe)', () => {
        const plan = new LiftPlanModel({
            grossWeightKg: 20000
        });

        const compHtml = plan.generateSafetyComparisonTableHTML();
        expect(compHtml).toContain('Phương Án Nâng Tối Thiểu An Toàn');
        expect(compHtml).toContain('Phương Án Tuyệt Đối An Toàn');
        expect(compHtml).toContain('1.414'); // Min safe LAF at 45°
        expect(compHtml).toContain('Triệt tiêu 100% lực xé ngang');
    });

    it('9. Generates Formal Authorization & Signature Sign-Off Boxes', () => {
        const plan = new LiftPlanModel();
        const signOffHtml = plan.generateSignOffBoxHTML();
        expect(signOffHtml).toContain('Appointed Person / Lifting Engineer');
        expect(signOffHtml).toContain('Crane Operations Supervisor');
        expect(signOffHtml).toContain('Lead Slinger / Rigger');
        expect(signOffHtml).toContain('Port Terminal Safety Authority');
    });
});
