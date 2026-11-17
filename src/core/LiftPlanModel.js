/**
 * ============================================================================
 * LIFT PLAN DATA MODEL (LiftPlanModel.js)
 * Standard: ASME P30.1 (Planning for Load Handling Activities)
 * Co-Standards: ASME B30.9, ASME B30.20, ASME B30.26, ISO 3874, DNV-ST-N001
 * ============================================================================
 */

import { EngineeringEngine } from './EngineeringEngine.js';
import { buildPdfBrandingChrome, renderRiskAssessmentSectionHTML } from './RiskAssessmentReport.js';

export class LiftPlanModel {
    constructor(customData = {}) {
        this.schemaVersion = '1.0.0-ASME-P30.1';
        this.timestamp = new Date().toISOString();

        // 1. GENERAL PROJECT & SITE METADATA
        this.metadata = {
            planId: customData.planId || `LP-${Date.now().toString(36).toUpperCase()}`,
            revision: customData.revision || 'Rev.01',
            projectName: customData.projectName || 'Port Container & Heavy Lift Operations',
            location: customData.location || 'Berth 04, Deepwater International Port Terminal',
            client: customData.client || 'Terminal Operating Authority',
            category: customData.category || 'CRITICAL_LIFT', // STANDARD | CRITICAL_LIFT | TANDEM_LIFT
            status: customData.status || 'DRAFT', // DRAFT | SUBMITTED | APPROVED | REJECTED
            datePrepared: customData.datePrepared || new Date().toISOString().split('T')[0]
        };

        // 2. ENVIRONMENTAL & SITE SOIL CONDITIONS
        this.environment = {
            windSpeedMps: customData.windSpeedMps || 6.5,
            maxWindLimitMps: customData.maxWindLimitMps || 12.0, // ASME/EN 13000 limit
            temperatureC: customData.temperatureC || 28,
            seaStateBeaufort: customData.seaStateBeaufort || 2,
            groundCondition: customData.groundCondition || 'Reinforced Concrete Apron',
            allowableBearingPressureKPa: customData.allowableBearingPressureKPa || 350.0, // 35 t/m²
            actualGroundPressureKpa: customData.groundBearingKpa,
            inspectionStatus: customData.inspectionStatus || 'VALID'
        };

        // 3. CARGO SPECIFICATIONS (VGM Certified per SOLAS VI/2 & ISO 668)
        this.cargo = {
            id: customData.cargoId || 'ISO-22G1-20FT',
            description: customData.cargoDesc || '20ft ISO Heavy-Duty Shipping Container',
            tareWeightKg: customData.tareWeightKg || 2200,
            payloadWeightKg: customData.payloadWeightKg || 21800,
            grossWeightKg: customData.grossWeightKg || 24000, // VGM Certified Weight
            dimensionsM: customData.dimensionsM || { length: 6.06, width: 2.44, height: 2.59 },
            cogOffsetM: customData.cogOffsetM || { x: 0.15, y: -0.10, z: -0.05 },
            surfaceAreaSqM: customData.surfaceAreaSqM || 31.4,
            padEyes: customData.padEyes || [
                { id: 'PE1_FR_TOP', x:  2.94, y: 1.295, z:  1.13, type: 'ISO 1161 Corner Casting', wllT: 17.0 },
                { id: 'PE2_FL_TOP', x: -2.94, y: 1.295, z:  1.13, type: 'ISO 1161 Corner Casting', wllT: 17.0 },
                { id: 'PE3_RL_TOP', x: -2.94, y: 1.295, z: -1.13, type: 'ISO 1161 Corner Casting', wllT: 17.0 },
                { id: 'PE4_RR_TOP', x:  2.94, y: 1.295, z: -1.13, type: 'ISO 1161 Corner Casting', wllT: 17.0 }
            ]
        };

        // 4. CRANE EQUIPMENT & LOAD CHART (ISO 8686 / EN 13000)
        this.crane = {
            model: customData.craneModel || 'ZPMC Post-Panamax STS Container Gantry Crane',
            type: customData.craneType || 'STS_GANTRY',
            boomLengthM: customData.boomLengthM || 65.0,
            workingRadiusM: customData.workingRadiusM || 28.0,
            maxRatedCapacityT: customData.maxRatedCapacityT || 65.0, // Rated capacity at 28m
            boomAngleDeg: customData.boomAngleDeg || 0, // Horizontal boom
            counterweightT: customData.counterweightT || 180.0,
            fallsCount: customData.fallsCount || 4,
            hookBlockMassKg: customData.hookBlockMassKg || 1200
        };

        // 5. BELOW-THE-HOOK RIGGING GEAR (ASME B30.20, ASME B30.9, ASME B30.26)
        this.rigging = {
            spreaderType: customData.spreaderType || 'Modulift 40ft/20ft Telescopic Spreader',
            spreaderMassKg: customData.spreaderMassKg || 9500,
            spreaderWllT: customData.spreaderWllT || 50.0,
            topBridle: {
                slingType: 'Steel Wire Rope 6x36 IWRC EIPS (EN 13414)',
                diameterMm: 36,
                lengthM: 6.5,
                slingAngleDeg: 60.0, // Angle to horizontal (beta >= 30 deg ASME B30.9)
                mblT: 145.0,
                safetyFactor: 5.0,
                wllT: 29.0,
                ...(customData.topBridle || {})
            },
            shackles: customData.shackles || {
                model: 'Crosby G-2130 Bolt-Type Anchor Shackle',
                wllT: 17.0,
                safetyFactor: 6.0
            },
            lowerConnections: customData.lowerConnections || {
                type: 'Direct Twistlock Pins (ISO 3874)',
                wllT: 17.0,
                count: 4
            },
            accessoriesTotalMassKg: customData.accessoriesMassKg || 450
        };

        // 6. ASME P30.1 RISK ASSESSMENT MATRIX (Probability x Severity)
        this.riskAssessment = [
            {
                hazard: 'Sling failure due to sharp edges or extreme sling angle (< 30°)',
                probability: 'LOW',
                severity: 'CRITICAL',
                mitigation: 'Inspect corner casting twistlocks; maintain bridle angle >= 60° (ASME B30.9).'
            },
            {
                hazard: 'Excessive ground bearing pressure under crane legs / outriggers',
                probability: 'MEDIUM',
                severity: 'HIGH',
                mitigation: 'Verify quay apron foundation capacity (350 kPa); monitor bogie load distribution.'
            },
            {
                hazard: 'Sudden dynamic snatch load from rapid hoisting or wave action (ship unmooring)',
                probability: 'LOW',
                severity: 'HIGH',
                mitigation: 'Apply ISO 8686 DAF 1.15; winch controller employs smooth torque-ramping motor curve.'
            },
            {
                hazard: 'High wind gusts exceeding operational threshold during STS boom transit',
                probability: 'MEDIUM',
                severity: 'HIGH',
                mitigation: 'Calibrated ultrasonic anemometer active; auto-abort if 3-sec gust > 12.0 m/s.'
            }
        ];

        // 7. STEP-BY-STEP LIFTING SEQUENCE
        this.sequenceSteps = [
            {
                stepNumber: 1,
                name: 'Pre-Lift Inspection & Exclusion Zone',
                description: 'Cordon off quayside 30m radius; verify personnel PPE and wind speed <= 12 m/s.'
            },
            {
                stepNumber: 2,
                name: 'Spreader Engagement & Twistlock Verification',
                description: 'Lower telescopic spreader onto container top; engage and lock all 4 ISO twistlocks. Visual pin lock confirmation.'
            },
            {
                stepNumber: 3,
                name: 'Trial Lift (150 mm Clearance)',
                description: 'Hoist cargo 150 mm off ground/trailer; hold for 60 seconds; check levelness (tilt < 2°), brake holding, and cable tension equilibrium.'
            },
            {
                stepNumber: 4,
                name: 'Main Transit & Slew/Trolley',
                description: 'Maintain 2.0 m minimum obstacle clearance. Trolley smoothly along STS boom to vessel bay.'
            },
            {
                stepNumber: 5,
                name: 'Cell Guide Entry & Landing',
                description: 'Align with ship cell guides; lower at controlled creeping speed (0.15 m/s); unlock twistlocks upon full landing.'
            }
        ];

        // 8. RESPONSIBLE ROLES & SIGNATURE BLOCKS (ASME P30.1 / BS 7121)
        this.approvals = {
            appointedPerson: {
                role: 'Appointed Person / Lifting Engineer',
                name: customData.apName || 'Nguyen Van A, PE',
                license: 'ASME P30.1 Certified / PE-77291',
                status: 'SIGNED',
                date: this.metadata.datePrepared
            },
            craneSupervisor: {
                role: 'Crane Operations Supervisor',
                name: customData.csName || 'Tran Huu B',
                license: 'LOLER / Port Ops License #4812',
                status: 'SIGNED',
                date: this.metadata.datePrepared
            },
            slingerSignaller: {
                role: 'Lead Slinger / Rigger',
                name: customData.ssName || 'Le Van C',
                license: 'Rigger Level 3 #8821',
                status: 'VERIFIED',
                date: this.metadata.datePrepared
            },
            terminalAuthority: {
                role: 'Port Terminal Safety Authority',
                name: customData.taName || 'Harbour Master Office',
                license: 'ISO 45001 Compliance Desk',
                status: 'APPROVED',
                date: this.metadata.datePrepared
            }
        };

        // 9. LIVE TELEMETRY & RIGGING HARDWARE DATA
        this.liveRigging = customData.liveRiggingData || null;
    }

    /**
     * Executes analytical engineering verification across all criteria.
     * @returns {Object} Complete compliance report with green/yellow/red flags
     */
    evaluateCompliance() {
        const planForEngine = {
            cargo: {
                massKg: this.cargo.grossWeightKg,
                dimensions: {
                    x: this.cargo.dimensionsM.length,
                    y: this.cargo.dimensionsM.height,
                    z: this.cargo.dimensionsM.width
                },
                cogLocal: this.cargo.cogOffsetM,
                padEyes: this.cargo.padEyes.map(pe => ({ localPos: { x: pe.x, y: pe.y, z: pe.z }, wllT: pe.wllT }))
            },
            rigging: {
                spreaderMassKg: this.rigging.spreaderMassKg,
                topBridle: {
                    active: true,
                    wllT: this.rigging.topBridle.wllT,
                    lengthM: this.rigging.topBridle.lengthM
                },
                lowerLegs: [
                    { wllT: this.rigging.lowerConnections.wllT },
                    { wllT: this.rigging.lowerConnections.wllT },
                    { wllT: this.rigging.lowerConnections.wllT },
                    { wllT: this.rigging.lowerConnections.wllT }
                ]
            },
            crane: {
                capacityT: this.crane.maxRatedCapacityT,
                workingRadiusM: this.crane.workingRadiusM
            },
            environment: {
                windSpeedMps: this.environment.windSpeedMps,
                maxWindSpeedMps: this.environment.maxWindLimitMps
            }
        };

        return EngineeringEngine.validateCompliance(planForEngine);
    }

    /**
     * Serializes plan to plain object for JSON serialization.
     */
    toJSON() {
        return {
            schemaVersion: this.schemaVersion,
            timestamp: this.timestamp,
            metadata: this.metadata,
            environment: this.environment,
            cargo: this.cargo,
            crane: this.crane,
            rigging: this.rigging,
            riskAssessment: this.riskAssessment,
            sequenceSteps: this.sequenceSteps,
            approvals: this.approvals
        };
    }

    /**
     * Exports plan as JSON string conforming to LiftingPlan Schema.
     */
    exportJSON() {
        return JSON.stringify(this.toJSON(), null, 2);
    }

    /**
     * Generates a 2D CAD Technical Side Elevation Schematic (Section X-Y) as vector SVG.
     * Complies with ASME P30.1 and ASME B30.20 visualization guidelines.
     */
    generateSideElevationSVG() {
        const L = (this.cargo.dimensionsM && this.cargo.dimensionsM.length) || 6.0;
        const H = (this.cargo.dimensionsM && this.cargo.dimensionsM.height) || 2.6;
        const grossT = (this.cargo.grossWeightKg / 1000) || 16.0;
        const hasSpreader = !!(this.liveRigging && this.liveRigging.hasSpreader);
        const spanM = (this.liveRigging && this.liveRigging.beamSpanM) || L;
        const compT = (this.liveRigging && this.liveRigging.beamCompT) || 0;
        const upperLen = (this.liveRigging && this.liveRigging.upperCables && this.liveRigging.upperCables[0]) 
            ? this.liveRigging.upperCables[0].lengthM : (this.rigging.topBridle.lengthM || 3.8);
        const upperAngle = (this.liveRigging && this.liveRigging.upperCables && this.liveRigging.upperCables[0]) 
            ? this.liveRigging.upperCables[0].angleDeg : (this.rigging.topBridle.slingAngleDeg || 60.0);
        const lowerLen = (this.liveRigging && this.liveRigging.lowerCables && this.liveRigging.lowerCables[0]) 
            ? this.liveRigging.lowerCables[0].lengthM : 2.8;
        const lowerAngle = (this.liveRigging && this.liveRigging.lowerCables && this.liveRigging.lowerCables[0]) 
            ? this.liveRigging.lowerCables[0].angleDeg : (hasSpreader ? 90.0 : 60.0);
        const clearanceM = (this.liveRigging && this.liveRigging.groundClearanceM) || 0.6;
        const cogX = (this.cargo.cogOffsetM && this.cargo.cogOffsetM.x) || 0;

        const W_box = Math.max(220, Math.min(500, L * 36));
        const H_box = Math.max(50, Math.min(85, H * 25));
        const midX = 410;
        const groundY = 365;
        const botY = groundY - 35;
        const topY = botY - H_box;
        const leftX = midX - W_box / 2;
        const rightX = midX + W_box / 2;

        const hookX = midX;
        const hookY = 60;

        let spreaderSvg = '';
        if (hasSpreader) {
            const beamW = Math.max(200, Math.min(480, spanM * 36));
            const beamY = topY - 80;
            const bLeft = midX - beamW / 2;
            const bRight = midX + beamW / 2;

            spreaderSvg = `
                <!-- Tier 1 Bridle Slings -->
                <line x1="${hookX}" y1="${hookY + 25}" x2="${bLeft}" y2="${beamY}" stroke="#38bdf8" stroke-width="3" stroke-linecap="round"/>
                <line x1="${hookX}" y1="${hookY + 25}" x2="${bRight}" y2="${beamY}" stroke="#38bdf8" stroke-width="3" stroke-linecap="round"/>
                <text x="${(hookX + bLeft) / 2 - 35}" y="${(hookY + beamY) / 2}" fill="#38bdf8" font-size="11" font-weight="bold" font-family="monospace">L1=${upperLen.toFixed(2)}m (α1=${upperAngle.toFixed(1)}°)</text>

                <!-- Spreader Beam (ASME B30.20) -->
                <rect x="${bLeft}" y="${beamY - 7}" width="${beamW}" height="14" fill="#d97706" stroke="#fbbf24" stroke-width="1.5" rx="3"/>
                <text x="${midX}" y="${beamY + 4}" fill="#fef08a" font-size="9.5" font-weight="bold" font-family="monospace" text-anchor="middle">⇥ NÉN DẦM / COMPRESSION: ${compT.toFixed(1)} T ⇤ (ASME B30.20)</text>

                <!-- Tier 2 Lower Slings -->
                <line x1="${bLeft}" y1="${beamY + 7}" x2="${leftX}" y2="${topY}" stroke="#fbbf24" stroke-width="2.5" stroke-linecap="round"/>
                <line x1="${bRight}" y1="${beamY + 7}" x2="${rightX}" y2="${topY}" stroke="#fbbf24" stroke-width="2.5" stroke-linecap="round"/>
                <text x="${leftX - 12}" y="${(beamY + topY) / 2 + 4}" fill="#fbbf24" font-size="10.5" font-family="monospace" text-anchor="end">L2=${lowerLen.toFixed(2)}m (α2=${lowerAngle.toFixed(1)}°)</text>
            `;
        } else {
            spreaderSvg = `
                <!-- Direct Bridle Slings -->
                <line x1="${hookX}" y1="${hookY + 25}" x2="${leftX}" y2="${topY}" stroke="#38bdf8" stroke-width="3" stroke-linecap="round"/>
                <line x1="${hookX}" y1="${hookY + 25}" x2="${rightX}" y2="${topY}" stroke="#38bdf8" stroke-width="3" stroke-linecap="round"/>
                <text x="${(hookX + leftX) / 2 - 35}" y="${(hookY + topY) / 2}" fill="#38bdf8" font-size="11" font-weight="bold" font-family="monospace">L=${upperLen.toFixed(2)}m (α=${upperAngle.toFixed(1)}°)</text>
            `;
        }

        const cogMarkerX = midX + cogX * 36;
        const cogMarkerY = topY + H_box / 2;

        return `
        <svg viewBox="0 0 820 400" width="100%" height="320" xmlns="http://www.w3.org/2000/svg" style="background:#070d19;border-radius:6px;border:1px solid #1e293b;">
            <defs>
                <pattern id="cadGridSide" width="30" height="30" patternUnits="userSpaceOnUse">
                    <path d="M 30 0 L 0 0 0 30" fill="none" stroke="#0f1d33" stroke-width="0.8"/>
                </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#cadGridSide)"/>

            <text x="20" y="26" fill="#38bdf8" font-size="12" font-weight="bold" font-family="monospace">MẶT CẮT ĐỨNG CẠNH (SIDE ELEVATION X-Y) · TỶ LỆ KỸ THUẬT 1:50</text>
            <text x="20" y="42" fill="#64748b" font-size="9.5" font-family="monospace">TIÊU CHUẨN THIẾT KẾ: ASME P30.1 / ASME B30.9 / ASME B30.20</text>

            <line x1="20" y1="${groundY}" x2="800" y2="${groundY}" stroke="#64748b" stroke-width="2" stroke-dasharray="8,4"/>
            <text x="30" y="${groundY + 16}" fill="#94a3b8" font-size="9" font-family="monospace">MẶT ĐẤT CHUẨN / GROUND DATUM (±0.000m)</text>
            <text x="${leftX - 15}" y="${groundY - 14}" fill="#38bdf8" font-size="9.5" font-family="monospace" text-anchor="end">Độ cao nâng: ${clearanceM.toFixed(2)}m</text>

            <!-- Crane Hook Block Assembly -->
            <rect x="${hookX - 20}" y="${hookY - 35}" width="40" height="26" fill="#eab308" stroke="#1e293b" stroke-width="1.5" rx="3"/>
            <path d="M ${hookX - 14} ${hookY - 35} L ${hookX - 6} ${hookY - 9} M ${hookX} ${hookY - 35} L ${hookX + 8} ${hookY - 9}" stroke="#000" stroke-width="3"/>
            <path d="M ${hookX} ${hookY - 9} C ${hookX} 4, ${hookX - 14} 12, ${hookX - 10} 22 C ${hookX - 7} 28, ${hookX + 4} 28, ${hookX + 8} 20" fill="none" stroke="#94a3b8" stroke-width="3.5" stroke-linecap="round"/>
            <ellipse cx="${hookX}" cy="${hookY + 22}" rx="7" ry="10" fill="none" stroke="#cbd5e1" stroke-width="2.5"/>

            ${spreaderSvg}

            <!-- Cargo Body -->
            <rect x="${leftX}" y="${topY}" width="${W_box}" height="${H_box}" fill="#c2410c" fill-opacity="0.85" stroke="#f97316" stroke-width="2" rx="3"/>
            <text x="${midX}" y="${topY + H_box / 2 - 6}" fill="#ffffff" font-size="12" font-weight="bold" text-anchor="middle" font-family="sans-serif">${this.cargo.description}</text>
            <text x="${midX}" y="${topY + H_box / 2 + 10}" fill="#fed7aa" font-size="10.5" font-family="monospace" text-anchor="middle">KÍCH THƯỚC: ${L.toFixed(1)}m × ${H.toFixed(1)}m · TỔNG TẢI: ${grossT.toFixed(2)} T VGM</text>

            <!-- Pad-Eye Attachment Points -->
            <circle cx="${leftX}" cy="${topY}" r="4.5" fill="#38bdf8" stroke="#ffffff" stroke-width="1.5"/>
            <circle cx="${rightX}" cy="${topY}" r="4.5" fill="#38bdf8" stroke="#ffffff" stroke-width="1.5"/>
            <text x="${leftX - 8}" y="${topY - 6}" fill="#94a3b8" font-size="8.5" font-family="monospace" text-anchor="end">LP2 / LP3</text>
            <text x="${rightX + 8}" y="${topY - 6}" fill="#94a3b8" font-size="8.5" font-family="monospace">LP1 / LP4</text>

            <!-- Center of Gravity (CoG) Marker -->
            <circle cx="${cogMarkerX}" cy="${cogMarkerY}" r="7" fill="none" stroke="#eab308" stroke-width="2"/>
            <path d="M ${cogMarkerX - 7} ${cogMarkerY} L ${cogMarkerX + 7} ${cogMarkerY} M ${cogMarkerX} ${cogMarkerY - 7} L ${cogMarkerX} ${cogMarkerY + 7}" stroke="#eab308" stroke-width="2"/>
            <path d="M ${cogMarkerX} ${cogMarkerY} L ${cogMarkerX + 7} ${cogMarkerY} A 7 7 0 0 1 ${cogMarkerX} ${cogMarkerY + 7} Z" fill="#ef4444"/>
            <path d="M ${cogMarkerX} ${cogMarkerY} L ${cogMarkerX - 7} ${cogMarkerY} A 7 7 0 0 1 ${cogMarkerX} ${cogMarkerY - 7} Z" fill="#ef4444"/>
            <text x="${cogMarkerX + 12}" y="${cogMarkerY + 4}" fill="#facc15" font-size="10" font-weight="bold" font-family="monospace">CoG (X: ${cogX.toFixed(2)}m)</text>

            <!-- Dimension Line: Cargo Length L -->
            <line x1="${leftX}" y1="${botY + 14}" x2="${rightX}" y2="${botY + 14}" stroke="#94a3b8" stroke-width="1.2"/>
            <path d="M ${leftX} ${botY + 10} L ${leftX} ${botY + 18} M ${rightX} ${botY + 10} L ${rightX} ${botY + 18}" stroke="#94a3b8" stroke-width="1.2"/>
            <text x="${midX}" y="${botY + 26}" fill="#cbd5e1" font-size="10" font-family="monospace" text-anchor="middle">L = ${L.toFixed(2)} m</text>
        </svg>
        `;
    }

    /**
     * Generates a 2D CAD Technical End Elevation Schematic (Section Z-Y) as vector SVG.
     */
    generateEndElevationSVG() {
        const W = (this.cargo.dimensionsM && this.cargo.dimensionsM.width) || 2.44;
        const H = (this.cargo.dimensionsM && this.cargo.dimensionsM.height) || 2.59;
        const cogZ = (this.cargo.cogOffsetM && this.cargo.cogOffsetM.z) || 0;

        const W_box = Math.max(140, Math.min(260, W * 55));
        const H_box = Math.max(50, Math.min(85, H * 25));
        const midX = 410;
        const groundY = 320;
        const botY = groundY - 35;
        const topY = botY - H_box;
        const leftX = midX - W_box / 2;
        const rightX = midX + W_box / 2;
        const hookX = midX;
        const hookY = 55;

        return `
        <svg viewBox="0 0 820 340" width="100%" height="260" xmlns="http://www.w3.org/2000/svg" style="background:#070d19;border-radius:6px;border:1px solid #1e293b;">
            <defs>
                <pattern id="cadGridEnd" width="30" height="30" patternUnits="userSpaceOnUse">
                    <path d="M 30 0 L 0 0 0 30" fill="none" stroke="#0f1d33" stroke-width="0.8"/>
                </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#cadGridEnd)"/>

            <text x="20" y="26" fill="#38bdf8" font-size="12" font-weight="bold" font-family="monospace">MẶT CẮT ĐẦU KIỆN (END ELEVATION Z-Y) · TỶ LỆ KỸ THUẬT 1:30</text>
            <text x="20" y="42" fill="#64748b" font-size="9.5" font-family="monospace">MẶT CẮT NGANG THỂ HIỆN BỀ RỘNG VÀ ĐỘ LỆCH TÂM THEO TRỤC Z</text>

            <line x1="20" y1="${groundY}" x2="800" y2="${groundY}" stroke="#64748b" stroke-width="2" stroke-dasharray="8,4"/>
            <text x="30" y="${groundY + 14}" fill="#94a3b8" font-size="9" font-family="monospace">GROUND LEVEL (±0.000m)</text>

            <!-- Hook & Slings -->
            <rect x="${hookX - 16}" y="${hookY - 30}" width="32" height="22" fill="#eab308" stroke="#000" rx="2"/>
            <circle cx="${hookX}" cy="${hookY + 12}" r="6" fill="none" stroke="#cbd5e1" stroke-width="2"/>
            <line x1="${hookX}" y1="${hookY + 18}" x2="${leftX}" y2="${topY}" stroke="#38bdf8" stroke-width="2.5"/>
            <line x1="${hookX}" y1="${hookY + 18}" x2="${rightX}" y2="${topY}" stroke="#38bdf8" stroke-width="2.5"/>

            <!-- Cargo End Face -->
            <rect x="${leftX}" y="${topY}" width="${W_box}" height="${H_box}" fill="#9a3412" stroke="#f97316" stroke-width="2" rx="3"/>
            <line x1="${midX}" y1="${topY}" x2="${midX}" y2="${botY}" stroke="#ea580c" stroke-width="2"/>
            <circle cx="${midX - 15}" cy="${topY + H_box / 2}" r="3" fill="#cbd5e1"/>
            <circle cx="${midX + 15}" cy="${topY + H_box / 2}" r="3" fill="#cbd5e1"/>

            <text x="${midX}" y="${topY + H_box / 2 - 8}" fill="#fff" font-size="11" font-weight="bold" text-anchor="middle">MẶT ĐẦU KIỆN (END PROFILE)</text>
            <text x="${midX}" y="${topY + H_box / 2 + 10}" fill="#fed7aa" font-size="10" font-family="monospace" text-anchor="middle">W = ${W.toFixed(2)}m · H = ${H.toFixed(2)}m</text>

            <!-- Pad-Eye End Points -->
            <circle cx="${leftX}" cy="${topY}" r="4" fill="#38bdf8" stroke="#fff" stroke-width="1.5"/>
            <circle cx="${rightX}" cy="${topY}" r="4" fill="#38bdf8" stroke="#fff" stroke-width="1.5"/>

            <!-- CoG Z Offset -->
            <circle cx="${midX + cogZ * 55}" cy="${topY + H_box / 2}" r="6" fill="none" stroke="#facc15" stroke-width="2"/>
            <text x="${midX + cogZ * 55 + 10}" y="${topY + H_box / 2 + 4}" fill="#facc15" font-size="9.5" font-family="monospace" font-weight="bold">CoG (Z: ${cogZ.toFixed(2)}m)</text>

            <!-- Width Dimension Line -->
            <line x1="${leftX}" y1="${botY + 12}" x2="${rightX}" y2="${botY + 12}" stroke="#94a3b8" stroke-width="1.2"/>
            <text x="${midX}" y="${botY + 24}" fill="#cbd5e1" font-size="10" font-family="monospace" text-anchor="middle">W = ${W.toFixed(2)} m</text>
        </svg>
        `;
    }

    /**
     * Generates a 2D CAD Technical Top Plan Schematic (Section X-Z) as vector SVG.
     */
    generateTopPlanSVG() {
        const L = (this.cargo.dimensionsM && this.cargo.dimensionsM.length) || 6.0;
        const W = (this.cargo.dimensionsM && this.cargo.dimensionsM.width) || 2.44;
        const cogX = (this.cargo.cogOffsetM && this.cargo.cogOffsetM.x) || 0;
        const cogZ = (this.cargo.cogOffsetM && this.cargo.cogOffsetM.z) || 0;

        const W_box = Math.max(220, Math.min(480, L * 34));
        const H_box = Math.max(70, Math.min(130, W * 36));
        const midX = 410;
        const midY = 150;
        const leftX = midX - W_box / 2;
        const rightX = midX + W_box / 2;
        const topY = midY - H_box / 2;
        const botY = midY + H_box / 2;

        const cogMarkerX = midX + cogX * 34;
        const cogMarkerY = midY + cogZ * 36;

        return `
        <svg viewBox="0 0 820 300" width="100%" height="240" xmlns="http://www.w3.org/2000/svg" style="background:#070d19;border-radius:6px;border:1px solid #1e293b;">
            <defs>
                <pattern id="cadGridTop" width="30" height="30" patternUnits="userSpaceOnUse">
                    <path d="M 30 0 L 0 0 0 30" fill="none" stroke="#0f1d33" stroke-width="0.8"/>
                </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#cadGridTop)"/>

            <text x="20" y="26" fill="#38bdf8" font-size="12" font-weight="bold" font-family="monospace">MẶT BẰNG BỐ TRÍ TAI CẨU &amp; CHIẾU BẰNG (TOP PLAN VIEW X-Z)</text>
            <text x="20" y="42" fill="#64748b" font-size="9.5" font-family="monospace">VỊ TRÍ 4 ĐIỂM NÂNG LP1..LP4 VÀ TỌA ĐỘ TRỌNG TÂM CoG</text>

            <!-- Centerlines -->
            <line x1="${midX}" y1="50" x2="${midX}" y2="250" stroke="#475569" stroke-width="1" stroke-dasharray="8,4"/>
            <line x1="120" y1="${midY}" x2="700" y2="${midY}" stroke="#475569" stroke-width="1" stroke-dasharray="8,4"/>

            <!-- Cargo Footprint -->
            <rect x="${leftX}" y="${topY}" width="${W_box}" height="${H_box}" fill="#7c2d12" stroke="#ea580c" stroke-width="2" rx="4"/>
            <text x="${midX}" y="${midY - 18}" fill="#ffffff" font-size="11" font-weight="bold" text-anchor="middle">${this.cargo.description}</text>
            <text x="${midX}" y="${midY - 2}" fill="#fdba74" font-size="10" font-family="monospace" text-anchor="middle">MẶT BẰNG CHIẾU X-Z: ${L.toFixed(1)}m × ${W.toFixed(1)}m</text>

            <!-- 4 Corner Lugs (LP1, LP2, LP3, LP4) -->
            <circle cx="${leftX}" cy="${topY}" r="5.5" fill="#38bdf8" stroke="#ffffff" stroke-width="1.5"/>
            <text x="${leftX - 8}" y="${topY - 6}" fill="#38bdf8" font-size="9.5" font-weight="bold" font-family="monospace" text-anchor="end">LP2 (-${(L/2).toFixed(1)}, +${(W/2).toFixed(1)})</text>
            <circle cx="${rightX}" cy="${topY}" r="5.5" fill="#38bdf8" stroke="#ffffff" stroke-width="1.5"/>
            <text x="${rightX + 8}" y="${topY - 6}" fill="#38bdf8" font-size="9.5" font-weight="bold" font-family="monospace">LP1 (+${(L/2).toFixed(1)}, +${(W/2).toFixed(1)})</text>
            <circle cx="${leftX}" cy="${botY}" r="5.5" fill="#38bdf8" stroke="#ffffff" stroke-width="1.5"/>
            <text x="${leftX - 8}" y="${botY + 14}" fill="#38bdf8" font-size="9.5" font-weight="bold" font-family="monospace" text-anchor="end">LP3 (-${(L/2).toFixed(1)}, -${(W/2).toFixed(1)})</text>
            <circle cx="${rightX}" cy="${botY}" r="5.5" fill="#38bdf8" stroke="#ffffff" stroke-width="1.5"/>
            <text x="${rightX + 8}" y="${botY + 14}" fill="#38bdf8" font-size="9.5" font-weight="bold" font-family="monospace">LP4 (+${(L/2).toFixed(1)}, -${(W/2).toFixed(1)})</text>

            <!-- Sling Rays from Center Hook to Corners -->
            <line x1="${midX}" y1="${midY}" x2="${leftX}" y2="${topY}" stroke="#38bdf8" stroke-width="1.5" stroke-dasharray="4,3"/>
            <line x1="${midX}" y1="${midY}" x2="${rightX}" y2="${topY}" stroke="#38bdf8" stroke-width="1.5" stroke-dasharray="4,3"/>
            <line x1="${midX}" y1="${midY}" x2="${leftX}" y2="${botY}" stroke="#38bdf8" stroke-width="1.5" stroke-dasharray="4,3"/>
            <line x1="${midX}" y1="${midY}" x2="${rightX}" y2="${botY}" stroke="#38bdf8" stroke-width="1.5" stroke-dasharray="4,3"/>

            <!-- Center of Gravity (CoG) Target -->
            <circle cx="${cogMarkerX}" cy="${cogMarkerY}" r="7" fill="none" stroke="#facc15" stroke-width="2"/>
            <path d="M ${cogMarkerX - 7} ${cogMarkerY} L ${cogMarkerX + 7} ${cogMarkerY} M ${cogMarkerX} ${cogMarkerY - 7} L ${cogMarkerX} ${cogMarkerY + 7}" stroke="#facc15" stroke-width="2"/>
            <path d="M ${cogMarkerX} ${cogMarkerY} L ${cogMarkerX + 7} ${cogMarkerY} A 7 7 0 0 1 ${cogMarkerX} ${cogMarkerY + 7} Z" fill="#ef4444"/>
            <path d="M ${cogMarkerX} ${cogMarkerY} L ${cogMarkerX - 7} ${cogMarkerY} A 7 7 0 0 1 ${cogMarkerX} ${cogMarkerY - 7} Z" fill="#ef4444"/>
            <text x="${cogMarkerX + 12}" y="${cogMarkerY + 16}" fill="#facc15" font-size="9.5" font-weight="bold" font-family="monospace">CoG (ΔX:${cogX.toFixed(2)}m, ΔZ:${cogZ.toFixed(2)}m)</text>

            <!-- Wind Indicator -->
            <g transform="translate(730, 45)">
                <circle cx="0" cy="0" r="16" fill="#1e293b" stroke="#38bdf8" stroke-width="1.5"/>
                <path d="M 0 12 L 0 -12 M -5 -7 L 0 -12 L 5 -7" stroke="#38bdf8" stroke-width="2" stroke-linecap="round"/>
                <text x="0" y="26" fill="#94a3b8" font-size="8" font-family="monospace" text-anchor="middle">GIÓ: ${this.environment.windSpeedMps}m/s</text>
            </g>
        </svg>
        `;
    }

    /**
     * Generates a detailed Per-Cable Tension, Angle & Safety Factor Analysis Table HTML (ASME B30.9).
     */
    generatePerCableAnalysisTableHTML() {
        const cables = [];
        if (this.liveRigging && this.liveRigging.upperCables && this.liveRigging.upperCables.length) {
            cables.push(...this.liveRigging.upperCables);
        }
        if (this.liveRigging && this.liveRigging.lowerCables && this.liveRigging.lowerCables.length) {
            cables.push(...this.liveRigging.lowerCables);
        }

        if (!cables.length) {
            const grossT = (this.cargo.grossWeightKg / 1000) || 16.0;
            const angle = this.rigging.topBridle.slingAngleDeg || 60.0;
            const laf = EngineeringEngine.calculateLAF(angle);
            const t = (grossT / 4) * laf;
            for (let i = 1; i <= 4; i++) {
                cables.push({
                    id: `L1-${i}`,
                    role: 'upper',
                    tierName: 'Tầng 1 (Móc ➔ Hàng)',
                    name: `Cáp nâng L1-${i}`,
                    lengthM: this.rigging.topBridle.lengthM || 3.8,
                    angleDeg: angle,
                    laf: laf,
                    tensionT: t,
                    wllT: this.rigging.topBridle.wllT || 15.0,
                    sf: 5.0,
                    utilPct: (t / (this.rigging.topBridle.wllT || 15.0)) * 100,
                    diaMm: this.rigging.topBridle.diameterMm || 26,
                    type: 'wire'
                });
            }
        }

        const rows = cables.map(c => {
            const angle = c.angleDeg || 60.0;
            const laf = EngineeringEngine.calculateLAF(angle);
            const beta = EngineeringEngine.calculateTopIncludedAngle(angle);
            const tension = c.tensionT || 0;
            const wll = c.wllT || 15.0;
            const util = wll > 0 ? (tension / wll) * 100 : 0;
            const sf = (wll * 5.0) / Math.max(0.01, tension);

            let statusBadge = '<span style="color:#34d399;font-weight:bold;">🟢 SAFE (Lý Tưởng)</span>';
            let rowBg = '';
            if (angle < 30.0) {
                statusBadge = '<span style="color:#ef4444;font-weight:bold;">🔴 CẤM CẨU (&lt;30°)</span>';
                rowBg = 'background: #3b0d14;';
            } else if (angle < 45.0) {
                statusBadge = '<span style="color:#f97316;font-weight:bold;">🟠 CẬN NGUY HIỂM</span>';
                rowBg = 'background: #2a140a;';
            } else if (angle < 60.0) {
                statusBadge = '<span style="color:#fbbf24;font-weight:bold;">🟡 CẢNH BÁO (+15-41%)</span>';
                rowBg = 'background: #221c08;';
            }

            return `
                <tr style="border-bottom: 1px solid #334155; ${rowBg}">
                    <td style="padding: 7px 10px; font-weight: bold; font-family: monospace; color: #38bdf8;">${c.id}</td>
                    <td style="padding: 7px 10px; font-size: 11px;">${c.name}</td>
                    <td style="padding: 7px 10px; font-family: monospace;">${c.lengthM.toFixed(2)} m</td>
                    <td style="padding: 7px 10px; font-family: monospace; font-weight: bold; color: ${angle < 45 ? '#fbbf24' : '#34d399'};">${angle.toFixed(1)}°</td>
                    <td style="padding: 7px 10px; font-family: monospace;">${beta.toFixed(1)}°</td>
                    <td style="padding: 7px 10px; font-family: monospace; font-weight: bold; color: #38bdf8;">${laf.toFixed(3)}</td>
                    <td style="padding: 7px 10px; font-family: monospace; font-weight: bold; color: #f8fafc;">${tension.toFixed(2)} T</td>
                    <td style="padding: 7px 10px; font-family: monospace;">${wll.toFixed(1)} T</td>
                    <td style="padding: 7px 10px; font-family: monospace; color: ${util > 90 ? '#ef4444' : (util > 75 ? '#fbbf24' : '#34d399')}; font-weight: bold;">${util.toFixed(1)}%</td>
                    <td style="padding: 7px 10px; font-family: monospace;">${sf.toFixed(1)}:1</td>
                    <td style="padding: 7px 10px;">${statusBadge}</td>
                </tr>
            `;
        }).join('');

        return `
            <table style="width: 100%; border-collapse: collapse; margin-top: 8px; font-size: 11px;">
                <thead>
                    <tr style="background: #090d16; border-bottom: 2px solid #475569;">
                        <th style="padding: 8px 10px;">Mã Cáp</th>
                        <th style="padding: 8px 10px;">Phân Nhánh &amp; Vị Trí</th>
                        <th style="padding: 8px 10px;">Chiều Dài L</th>
                        <th style="padding: 8px 10px;">Góc Ngang α</th>
                        <th style="padding: 8px 10px;">Góc Đỉnh β</th>
                        <th style="padding: 8px 10px;">Hệ Số LAF</th>
                        <th style="padding: 8px 10px;">Lực Căng T</th>
                        <th style="padding: 8px 10px;">SWL/WLL</th>
                        <th style="padding: 8px 10px;">Tải (%)</th>
                        <th style="padding: 8px 10px;">Hệ Số SF</th>
                        <th style="padding: 8px 10px;">Tiêu Chuẩn ASME B30.9</th>
                    </tr>
                </thead>
                <tbody>
                    ${rows}
                </tbody>
            </table>
        `;
    }

    /**
     * Generates a complete Rigging Bill of Materials (BOM) Table HTML.
     */
    generateRiggingBOMTableHTML() {
        const bomItems = (this.liveRigging && this.liveRigging.bom) ? this.liveRigging.bom : [];
        if (!bomItems.length) {
            bomItems.push(
                { itemNo: 1, category: 'Hook & Master Link', name: 'Móc Cẩu & Vòng Khuyên Cẩu Mẹ (Quad Sub-Assembly)', spec: `WLL ${this.crane.maxRatedCapacityT.toFixed(0)}T Grade 100`, quantity: 1, wllT: this.crane.maxRatedCapacityT, proofT: this.crane.maxRatedCapacityT * 2, standard: 'ASME B30.26 / EN 1677', remarks: 'Điểm treo chính' },
                { itemNo: 2, category: 'Tier 1 Bridle Slings', name: 'Cáp Treo Dầm Tầng 1 (Chùm 4 nhánh)', spec: `Wire Rope Ø${this.rigging.topBridle.diameterMm}mm × L=${this.rigging.topBridle.lengthM.toFixed(2)}m`, quantity: 4, wllT: this.rigging.topBridle.wllT, proofT: this.rigging.topBridle.wllT * 2, standard: 'ASME B30.9', remarks: 'Hệ số an toàn 5:1' },
                { itemNo: 3, category: 'Rigging Hardware', name: 'Ma Ní Móng Ngựa Crosby G-2130', spec: 'Crosby Alloy Steel WLL 17.0T', quantity: 4, wllT: 17.0, proofT: 34.0, standard: 'ASME B30.26', remarks: 'SF 6:1' },
                { itemNo: 4, category: 'Cargo Pad-Eyes', name: 'Tai Cẩu Kiện Hàng (Corner Castings)', spec: 'ISO 1161 Steel Castings', quantity: 4, wllT: 17.0, proofT: 34.0, standard: 'ISO 1161 / ASME BTH-1', remarks: 'Điểm móc cố định' }
            );
        }

        const rows = bomItems.map(item => `
            <tr style="border-bottom: 1px solid #334155;">
                <td style="padding: 7px 10px; font-weight: bold; font-family: monospace; text-align: center; color: #94a3b8;">${item.itemNo}</td>
                <td style="padding: 7px 10px; font-weight: 600; color: #38bdf8;">${item.category}</td>
                <td style="padding: 7px 10px; font-weight: bold; color: #f8fafc;">${item.name}</td>
                <td style="padding: 7px 10px; font-family: monospace; font-size: 11px;">${item.spec}</td>
                <td style="padding: 7px 10px; font-family: monospace; font-weight: bold; text-align: center;">${item.quantity}</td>
                <td style="padding: 7px 10px; font-family: monospace; font-weight: bold; color: #34d399;">${item.wllT ? item.wllT.toFixed(1) + ' T' : '-'}</td>
                <td style="padding: 7px 10px; font-family: monospace; color: #cbd5e1;">${item.proofT ? item.proofT.toFixed(1) + ' T' : '-'}</td>
                <td style="padding: 7px 10px; font-size: 10.5px; color: #94a3b8;">${item.standard}</td>
                <td style="padding: 7px 10px; font-size: 11px; color: #cbd5e1;">${item.remarks || '-'}</td>
            </tr>
        `).join('');

        return `
            <table style="width: 100%; border-collapse: collapse; margin-top: 8px; font-size: 11px;">
                <thead>
                    <tr style="background: #090d16; border-bottom: 2px solid #475569;">
                        <th style="padding: 8px 10px; text-align: center;">STT</th>
                        <th style="padding: 8px 10px;">Hạng Mục</th>
                        <th style="padding: 8px 10px;">Tên Thiết Bị / Dụng Cụ</th>
                        <th style="padding: 8px 10px;">Quy Cách &amp; Kích Thước</th>
                        <th style="padding: 8px 10px; text-align: center;">SL</th>
                        <th style="padding: 8px 10px;">SWL/WLL</th>
                        <th style="padding: 8px 10px;">Thử Tải (Proof)</th>
                        <th style="padding: 8px 10px;">Tiêu Chuẩn Áp Dụng</th>
                        <th style="padding: 8px 10px;">Ghi Chú Kỹ Thuật</th>
                    </tr>
                </thead>
                <tbody>
                    ${rows}
                </tbody>
            </table>
        `;
    }

    /**
     * Generates a Safety Presets & Mitigation Comparison Table HTML.
     */
    generateSafetyComparisonTableHTML() {
        const grossT = (this.cargo.grossWeightKg / 1000) || 16.0;
        const curAlpha = (this.liveRigging && this.liveRigging.upperCables && this.liveRigging.upperCables[0]) 
            ? this.liveRigging.upperCables[0].angleDeg : (this.rigging.topBridle.slingAngleDeg || 60.0);
        const curLaf = EngineeringEngine.calculateLAF(curAlpha);
        const curT = (grossT / 4) * curLaf;

        const lafA = EngineeringEngine.calculateLAF(45.0);
        const tA = (grossT / 4) * lafA;

        const lafB1 = EngineeringEngine.calculateLAF(60.0);
        const tB1 = (grossT / 4) * lafB1;
        const tB2 = grossT / 4;

        return `
            <table style="width: 100%; border-collapse: collapse; margin-top: 8px; font-size: 11px;">
                <thead>
                    <tr style="background: #090d16; border-bottom: 2px solid #475569;">
                        <th style="padding: 8px 10px;">Phương Án Nâng</th>
                        <th style="padding: 8px 10px;">Góc Cáp α (Tầng 1 / Tầng 2)</th>
                        <th style="padding: 8px 10px;">Hệ Số Góc LAF</th>
                        <th style="padding: 8px 10px;">Lực Căng Cáp Max (T)</th>
                        <th style="padding: 8px 10px;">Lực Xé Ngang Kiện Hàng</th>
                        <th style="padding: 8px 10px;">Yêu Cầu Chiều Cao (Headroom)</th>
                        <th style="padding: 8px 10px;">Khuyến Nghị Kỹ Sư (ASME P30.1)</th>
                    </tr>
                </thead>
                <tbody>
                    <tr style="border-bottom: 1px solid #334155;">
                        <td style="padding: 8px 10px; font-weight: bold; color: #38bdf8;">1. Cấu Hình Đang Mô Phỏng (Live)</td>
                        <td style="padding: 8px 10px; font-family: monospace;">α = ${curAlpha.toFixed(1)}°</td>
                        <td style="padding: 8px 10px; font-family: monospace; font-weight: bold;">${curLaf.toFixed(3)}</td>
                        <td style="padding: 8px 10px; font-family: monospace; font-weight: bold; color: #f8fafc;">${curT.toFixed(2)} T</td>
                        <td style="padding: 8px 10px; color: ${curAlpha >= 85 ? '#34d399' : '#fbbf24'};">${curAlpha >= 85 ? 'Gần như triệt tiêu (0 kN)' : 'Tồn tại thành phần xé ngang Fx = T·cos(α)'}</td>
                        <td style="padding: 8px 10px;">Tùy chỉnh theo thanh trượt</td>
                        <td style="padding: 8px 10px;">Kiểm tra độ chùng và cân bằng tải</td>
                    </tr>
                    <tr style="border-bottom: 1px solid #334155; background: #221c08;">
                        <td style="padding: 8px 10px; font-weight: bold; color: #fbbf24;">2. Phương Án Nâng Tối Thiểu An Toàn</td>
                        <td style="padding: 8px 10px; font-family: monospace;">α = 45.0° (Cả 2 tầng)</td>
                        <td style="padding: 8px 10px; font-family: monospace; font-weight: bold; color: #fbbf24;">1.414</td>
                        <td style="padding: 8px 10px; font-family: monospace; font-weight: bold; color: #fbbf24;">${tA.toFixed(2)} T (+41.4%)</td>
                        <td style="padding: 8px 10px; color: #fbbf24;">Lực ép ngang Fx = 100% trọng lượng nhánh</td>
                        <td style="padding: 8px 10px; color: #34d399; font-weight: bold;">Tiết kiệm chiều cao nâng tối đa (Low Headroom)</td>
                        <td style="padding: 8px 10px; color: #cbd5e1;">Phù hợp khi chiều cao móc bị giới hạn nhà xưởng, yêu cầu kiểm định WLL cáp chịu tăng tải</td>
                    </tr>
                    <tr style="border-bottom: 1px solid #334155; background: #0f291e;">
                        <td style="padding: 8px 10px; font-weight: bold; color: #34d399;">3. Phương Án Tuyệt Đối An Toàn (Chuẩn Quốc Tế)</td>
                        <td style="padding: 8px 10px; font-family: monospace;">Tầng 1: α = 60.0°<br/>Tầng 2: α = 90.0° (Thẳng đứng)</td>
                        <td style="padding: 8px 10px; font-family: monospace; font-weight: bold; color: #34d399;">T1: 1.155<br/>T2: 1.000</td>
                        <td style="padding: 8px 10px; font-family: monospace; font-weight: bold; color: #34d399;">T1: ${tB1.toFixed(2)} T<br/>T2: ${tB2.toFixed(2)} T</td>
                        <td style="padding: 8px 10px; color: #34d399; font-weight: bold;">Triệt tiêu 100% lực xé ngang vào hàng (Dầm gánh chịu lực nén)</td>
                        <td style="padding: 8px 10px;">Yêu cầu chiều cao tiêu chuẩn tự do</td>
                        <td style="padding: 8px 10px; color: #34d399; font-weight: bold;">CẤU HÌNH VÀNG CHUẨN ASME B30.9 &amp; B30.20: Bảo vệ kiện hàng và tai cẩu tối đa!</td>
                    </tr>
                </tbody>
            </table>
        `;
    }

    /**
     * Generates Formal Engineering Authorization & Signature Box HTML (ASME P30.1 / BS 7121).
     */
    generateSignOffBoxHTML() {
        return `
            <div class="grid-4" style="margin-top: 14px;">
                <div style="background: #090d16; padding: 12px; border-radius: 6px; border: 1px solid #334155;">
                    <div class="data-label">${this.approvals.appointedPerson.role}</div>
                    <div style="font-weight: bold; margin-top: 4px; color: #f8fafc;">${this.approvals.appointedPerson.name}</div>
                    <div style="font-size: 10px; color: #94a3b8;">${this.approvals.appointedPerson.license}</div>
                    <div style="margin-top: 12px; border-top: 1px dashed #475569; padding-top: 6px; display: flex; justify-content: space-between; align-items: center;">
                        <span style="color: #10b981; font-weight: bold; font-family: monospace;">✓ ${this.approvals.appointedPerson.status}</span>
                        <span style="font-size: 10px; color: #64748b;">${this.approvals.appointedPerson.date}</span>
                    </div>
                </div>

                <div style="background: #090d16; padding: 12px; border-radius: 6px; border: 1px solid #334155;">
                    <div class="data-label">${this.approvals.craneSupervisor.role}</div>
                    <div style="font-weight: bold; margin-top: 4px; color: #f8fafc;">${this.approvals.craneSupervisor.name}</div>
                    <div style="font-size: 10px; color: #94a3b8;">${this.approvals.craneSupervisor.license}</div>
                    <div style="margin-top: 12px; border-top: 1px dashed #475569; padding-top: 6px; display: flex; justify-content: space-between; align-items: center;">
                        <span style="color: #10b981; font-weight: bold; font-family: monospace;">✓ ${this.approvals.craneSupervisor.status}</span>
                        <span style="font-size: 10px; color: #64748b;">${this.approvals.craneSupervisor.date}</span>
                    </div>
                </div>

                <div style="background: #090d16; padding: 12px; border-radius: 6px; border: 1px solid #334155;">
                    <div class="data-label">${this.approvals.slingerSignaller.role}</div>
                    <div style="font-weight: bold; margin-top: 4px; color: #f8fafc;">${this.approvals.slingerSignaller.name}</div>
                    <div style="font-size: 10px; color: #94a3b8;">${this.approvals.slingerSignaller.license}</div>
                    <div style="margin-top: 12px; border-top: 1px dashed #475569; padding-top: 6px; display: flex; justify-content: space-between; align-items: center;">
                        <span style="color: #38bdf8; font-weight: bold; font-family: monospace;">✓ ${this.approvals.slingerSignaller.status}</span>
                        <span style="font-size: 10px; color: #64748b;">${this.approvals.slingerSignaller.date}</span>
                    </div>
                </div>

                <div style="background: #090d16; padding: 12px; border-radius: 6px; border: 1px solid #334155;">
                    <div class="data-label">${this.approvals.terminalAuthority.role}</div>
                    <div style="font-weight: bold; margin-top: 4px; color: #f8fafc;">${this.approvals.terminalAuthority.name}</div>
                    <div style="font-size: 10px; color: #94a3b8;">${this.approvals.terminalAuthority.license}</div>
                    <div style="margin-top: 12px; border-top: 1px dashed #475569; padding-top: 6px; display: flex; justify-content: space-between; align-items: center;">
                        <span style="color: #f59e0b; font-weight: bold; font-family: monospace;">✓ ${this.approvals.terminalAuthority.status}</span>
                        <span style="font-size: 10px; color: #64748b;">${this.approvals.terminalAuthority.date}</span>
                    </div>
                </div>
            </div>
        `;
    }

    /**
     * Generates an executive, printable HTML engineering document complying with ASME P30.1.
     * Can be opened directly in a new window and printed to PDF (`window.print()`).
     * @param {string|null} [screenshotUrl] High-res 3D elevation data URL
     * @param {object} [options] License watermark & branding flags ({ isTrialActive, isProUser })
     */
    generatePrintableHTML(screenshotUrl = null, options = {}) {
        const audit = this.evaluateCompliance();
        const branding = buildPdfBrandingChrome(options);
        const jsaRiskPageHtml = renderRiskAssessmentSectionHTML(this, branding);
        const overallBadge = audit.isCompliant
            ? '<span style="background:#065f46;color:#34d399;padding:4px 10px;border-radius:6px;font-weight:bold;font-size:12px;border:1px solid #059669;">PASSED COMPLIANCE</span>'
            : '<span style="background:#881337;color:#f87171;padding:4px 10px;border-radius:6px;font-weight:bold;font-size:12px;border:1px solid #dc2626;">NON-COMPLIANT / REJECTED</span>';

        const checkRows = audit.checks.map(c => {
            const isPass = c.status === 'PASS';
            const isWarn = c.status === 'WARNING';
            const icon = isPass ? '🟢 PASS' : (isWarn ? '🟡 WARN' : '🔴 FAIL');
            const color = isPass ? '#10b981' : (isWarn ? '#f59e0b' : '#ef4444');
            return `
                <tr style="border-bottom: 1px solid #334155;">
                    <td style="padding: 8px 12px; font-weight: 600;">${c.name}</td>
                    <td style="padding: 8px 12px; font-family: monospace;">${c.value}</td>
                    <td style="padding: 8px 12px; font-family: monospace;">${c.limit}</td>
                    <td style="padding: 8px 12px; font-weight: bold; color: ${color};">${icon}</td>
                    <td style="padding: 8px 12px; font-size: 11px; color: #94a3b8;">${c.standard}</td>
                </tr>
            `;
        }).join('');

        const riskRows = this.riskAssessment.map(r => `
            <tr style="border-bottom: 1px solid #334155;">
                <td style="padding: 8px 12px; font-size: 12px;">${r.hazard}</td>
                <td style="padding: 8px 12px; font-size: 11px; font-weight: bold; color: ${r.probability === 'HIGH' ? '#ef4444' : (r.probability === 'MEDIUM' ? '#f59e0b' : '#38bdf8')}">${r.probability}</td>
                <td style="padding: 8px 12px; font-size: 11px; font-weight: bold; color: ${r.severity === 'CRITICAL' ? '#ef4444' : '#f59e0b'}">${r.severity}</td>
                <td style="padding: 8px 12px; font-size: 12px; color: #cbd5e1;">${r.mitigation}</td>
            </tr>
        `).join('');

        const stepRows = this.sequenceSteps.map(s => `
            <tr style="border-bottom: 1px solid #334155;">
                <td style="padding: 8px 12px; font-weight: bold; width: 40px; text-align: center;">${s.stepNumber}</td>
                <td style="padding: 8px 12px; font-weight: 600; width: 220px;">${s.name}</td>
                <td style="padding: 8px 12px; font-size: 12px; color: #cbd5e1;">${s.description}</td>
            </tr>
        `).join('');

        return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <title>ASME P30.1 Lift Plan Document - ${this.metadata.planId}</title>
    <style>
        @page { size: A4; margin: 10mm 12mm; }
        body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif; background: #0f172a; color: #f8fafc; margin: 0; padding: 24px; font-size: 11.5px; line-height: 1.45; }
        @media print {
            body { background: white !important; color: #0f172a !important; padding: 0 !important; font-size: 10.5px !important; }
            .no-print { display: none !important; }
            .box-card { border: 1px solid #cbd5e1 !important; background: white !important; color: #0f172a !important; page-break-inside: avoid !important; }
            table { color: #0f172a !important; page-break-inside: avoid !important; }
            th { background: #f1f5f9 !important; color: #0f172a !important; border-bottom: 2px solid #94a3b8 !important; }
            td { border-bottom: 1px solid #e2e8f0 !important; }
            svg { max-width: 100% !important; page-break-inside: avoid !important; }
        }
        .box-card { background: #1e293b; border: 1px solid #334155; border-radius: 8px; padding: 16px; margin-bottom: 16px; }
        h1, h2, h3 { margin: 0 0 8px 0; color: #f8fafc; }
        @media print { h1, h2, h3 { color: #0f172a !important; } }
        table { width: 100%; border-collapse: collapse; text-align: left; }
        th { background: #090d16; padding: 8px 12px; font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px; color: #94a3b8; }
        .grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
        .grid-3 { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 16px; }
        .grid-4 { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; }
        .data-label { font-size: 10px; text-transform: uppercase; color: #94a3b8; font-weight: bold; margin-bottom: 2px; }
        .data-val { font-size: 13px; font-weight: bold; color: #38bdf8; font-family: monospace; }
        .print-btn { background: #0284c7; color: white; border: none; padding: 8px 18px; border-radius: 6px; font-weight: bold; cursor: pointer; display: inline-flex; align-items: center; gap: 6px; font-size: 12px; }
        .print-btn:hover { background: #0369a1; }
        ${branding.css}
    </style>
</head>
<body>
    ${branding.watermarkHtml}
    ${branding.headerStripHtml}
    <!-- Top Print & Action Controls -->
    <div class="no-print" style="margin-bottom: 20px; display: flex; justify-content: space-between; align-items: center;">
        <div>
            <span style="font-size: 14px; font-weight: bold; color: #38bdf8;">SafeLift3D - Professional Engineering Export</span>
        </div>
        <div style="display: flex; gap: 10px;">
            <button class="print-btn" onclick="window.print()">🖨️ In Báo Cáo / Lưu PDF</button>
            <button class="print-btn" style="background: #334155;" onclick="window.close()">Đóng Cửa Sổ</button>
        </div>
    </div>

    <!-- Header Block -->
    <div class="box-card" style="display: flex; justify-content: space-between; align-items: flex-start; border-left: 6px solid #f59e0b;">
        <div>
            <div style="display: flex; align-items: center; gap: 10px;">
                <span style="font-size: 24px;">🏗️</span>
                <div>
                    <h1 style="font-size: 18px; font-weight: 900; letter-spacing: 0.5px;">CRITICAL LIFT PLAN &amp; PHƯƠNG ÁN NÂNG HẠ KỸ THUẬT CHUẨN ASME P30.1</h1>
                    <div style="font-size: 11px; color: #94a3b8;">Standard Compliance: ASME P30.1 · ASME B30.9 / B30.20 / B30.26 · OSHA 1910.184 · ISO 3874 · DNV-ST-N001</div>
                </div>
            </div>
            <div style="margin-top: 12px; font-size: 12px;">
                <div>Dự án: <b>${this.metadata.projectName}</b></div>
                <div>Địa điểm / Hiện trường: <b>${this.metadata.location}</b></div>
            </div>
        </div>
        <div style="text-align: right;">
            <div style="margin-bottom: 6px;">${overallBadge}</div>
            <div style="font-family: monospace; font-size: 12px; color: #cbd5e1;">Mã Lift Plan: <b>${this.metadata.planId}</b></div>
            <div style="font-size: 11px; color: #94a3b8;">Rev: <b>${this.metadata.revision}</b> | Ngày lập: <b>${this.metadata.datePrepared}</b></div>
        </div>
    </div>

    ${screenshotUrl ? `
    <!-- 3D Rigging Elevation & Arrangement Drawing (ASME P30.1 Digital Twin View) -->
    <div class="box-card" style="padding: 12px; text-align: center;">
        <div style="font-size: 11px; font-weight: bold; color: #94a3b8; text-transform: uppercase; margin-bottom: 8px; text-align: left; display: flex; justify-content: space-between;">
            <span>Mô Hình 3D Hiện Trường &amp; Bố Trí Dây Cáp (Digital Twin Simulation View)</span>
            <span style="color: #38bdf8;">ASME P30.1 §3-1.3 Visual Verification</span>
        </div>
        <img src="${screenshotUrl}" style="max-width: 100%; max-height: 480px; border-radius: 6px; border: 1px solid #475569; object-fit: contain; width: 100%; background: #070b12;" alt="3D Lift Arrangement">
    </div>
    ` : ''}

    <!-- MỤC 1: BẢN VẼ MẶT CẮT KỸ THUẬT 2D VECTOR (CAD ELEVATIONS) -->
    <div class="box-card">
        <h3>1. BẢN VẼ MẶT CẮT KỸ THUẬT 2D &amp; MẶT BẰNG BỐ TRÍ DÂY CÁP (CAD 2D SCHEMATICS)</h3>
        <div style="font-size: 11px; color: #94a3b8; margin-bottom: 12px;">
            Bản vẽ mặt cắt vector 1:1 thể hiện chính xác cao độ móc cẩu, độ võng cáp, góc nghiêng ngang α, khoảng hở gầm và tọa độ trọng tâm (CoG).
        </div>
        <div style="margin-bottom: 12px;">
            ${this.generateSideElevationSVG()}
        </div>
        <div class="grid-2">
            <div>
                ${this.generateEndElevationSVG()}
            </div>
            <div>
                ${this.generateTopPlanSVG()}
            </div>
        </div>
    </div>

    <!-- MỤC 2: THÔNG SỐ CẨU & THÔNG SỐ KIỆN HÀNG -->
    <div class="grid-2">
        <!-- Crane Equipment -->
        <div class="box-card">
            <h3>2. THÔNG SỐ THIẾT BỊ CẨU &amp; TẢI TRỌNG (CRANE CONFIGURATION)</h3>
            <div class="grid-2" style="margin-top: 10px;">
                <div>
                    <div class="data-label">Chủng Loại &amp; Model Cẩu</div>
                    <div style="font-weight: bold; font-size: 12px;">${this.crane.model}</div>
                </div>
                <div>
                    <div class="data-label">Cấu Hình Cẩu</div>
                    <div style="font-weight: bold;">${this.crane.type}</div>
                </div>
                <div>
                    <div class="data-label">Bán Kính Hoạt Động (Radius)</div>
                    <div class="data-val">${this.crane.workingRadiusM.toFixed(1)} m</div>
                </div>
                <div>
                    <div class="data-label">Chiều Dài Cần (Boom Length)</div>
                    <div class="data-val">${this.crane.boomLengthM.toFixed(1)} m</div>
                </div>
                <div>
                    <div class="data-label">Sức Nâng Biểu Đồ (Load Chart WLL)</div>
                    <div class="data-val">${this.crane.maxRatedCapacityT.toFixed(1)} T</div>
                </div>
                <div>
                    <div class="data-label">Khối Lượng Cụm Móc (Hook Block)</div>
                    <div class="data-val">${(this.crane.hookBlockMassKg / 1000).toFixed(2)} T</div>
                </div>
            </div>
        </div>

        <!-- Cargo Specifications -->
        <div class="box-card">
            <h3>3. THÔNG SỐ KIỆN HÀNG (CARGO VGM SPECIFICATIONS)</h3>
            <div class="grid-2" style="margin-top: 10px;">
                <div>
                    <div class="data-label">Nhận Diện / Tên Kiện Hàng</div>
                    <div style="font-weight: bold; font-size: 12px;">${this.cargo.description}</div>
                </div>
                <div>
                    <div class="data-label">Kích Thước Bao (Dài × Rộng × Cao)</div>
                    <div class="data-val">${this.cargo.dimensionsM.length} × ${this.cargo.dimensionsM.width} × ${this.cargo.dimensionsM.height} m</div>
                </div>
                <div>
                    <div class="data-label">Tổng Khối Lượng (VGM SOLAS)</div>
                    <div class="data-val">${(this.cargo.grossWeightKg / 1000).toFixed(2)} T</div>
                </div>
                <div>
                    <div class="data-label">Độ Lệch Trọng Tâm CoG (X, Y, Z)</div>
                    <div class="data-val">[${this.cargo.cogOffsetM.x}, ${this.cargo.cogOffsetM.y}, ${this.cargo.cogOffsetM.z}] m</div>
                </div>
                <div>
                    <div class="data-label">Diện Tích Cản Gió Dự Kiến</div>
                    <div class="data-val">${this.cargo.surfaceAreaSqM.toFixed(1)} m²</div>
                </div>
                <div>
                    <div class="data-label">Điểm Móc Cẩu Kiện Hàng</div>
                    <div style="font-size: 11px; font-weight: bold;">4× ISO Corner Castings / Pad-Eyes</div>
                </div>
            </div>
        </div>
    </div>

    <!-- MỤC 3: PHÂN TÍCH CHI TIẾT TỪNG SỢI CÁP & GÓC NÂNG ASME B30.9 -->
    <div class="box-card">
        <h3>4. PHÂN TÍCH CHI TIẾT LỰC CĂNG TỪNG SỢI CÁP &amp; HỆ SỐ GÓC LAF (ASME B30.9)</h3>
        <div style="font-size: 11px; color: #94a3b8; margin-bottom: 8px;">
            Tiêu chuẩn đánh giá: ASME B30.9 §9-2.10 &amp; OSHA 1910.184 / 1926.251 · Công thức: LAF = 1 / sin(α) · Lực căng nhánh T = (W / N) × LAF
        </div>
        ${this.generatePerCableAnalysisTableHTML()}
    </div>

    <!-- MỤC 4: BẢNG THIẾT BỊ RÁP BỘ HOÀN CHỈNH (RIGGING BOM) -->
    <div class="box-card">
        <h3>5. BẢNG THIẾT BỊ RÁP BỘ HOÀN CHỈNH (RIGGING HARDWARE BILL OF MATERIALS - BOM)</h3>
        <div style="font-size: 11px; color: #94a3b8; margin-bottom: 8px;">
            Danh mục đầy đủ các trang thiết bị dưới móc cẩu (Below-the-Hook Rigging Assembly) chuẩn ASME B30.20, ASME B30.26 và EN 1677.
        </div>
        ${this.generateRiggingBOMTableHTML()}
    </div>

    <!-- MỤC 5: SO SÁNH PHƯƠNG ÁN AN TOÀN & ĐỀ XUẤT KỸ THUẬT -->
    <div class="box-card">
        <h3>6. SO SÁNH PHƯƠNG ÁN AN TOÀN &amp; ĐỀ XUẤT KỸ THUẬT (RECOMMENDATION ENGINE)</h3>
        <div style="font-size: 11px; color: #94a3b8; margin-bottom: 8px;">
            So sánh phân tích giữa Phương án Hiện tại, Phương án Tối thiểu An toàn (α ≥ 45°) và Phương án Tuyệt đối An toàn (Tầng 1 α = 60°, Tầng 2 α = 90° triệt tiêu lực xé).
        </div>
        ${this.generateSafetyComparisonTableHTML()}
    </div>

    <!-- MỤC 6: BẢNG KIỂM ĐỊNH TUÂN THỦ AN TOÀN KỸ THUẬT -->
    <div class="box-card">
        <h3>7. KIỂM ĐỊNH TUÂN THỦ AN TOÀN KỸ THUẬT TỔNG THỂ (ANALYTICAL AUDIT MATRIX)</h3>
        <table style="margin-top: 8px;">
            <thead>
                <tr>
                    <th>Hạng Mục Kiểm Định</th>
                    <th>Giá Trị Phân Tích Thực Tế</th>
                    <th>Giới Hạn Tiêu Chuẩn Cho Phép</th>
                    <th>Trạng Thái</th>
                    <th>Tiêu Chuẩn Viện Dẫn</th>
                </tr>
            </thead>
            <tbody>
                ${checkRows}
            </tbody>
        </table>
    </div>

    <!-- MỤC 7: MA TRẬN ĐÁNH GIÁ RỦI RO -->
    <div class="box-card">
        <h3>8. ASME P30.1 MA TRẬN ĐÁNH GIÁ RỦI RO &amp; BIỆN PHÁP KIỂM SOÁT (RISK ASSESSMENT)</h3>
        <table style="margin-top: 8px;">
            <thead>
                <tr>
                    <th style="width: 32%;">Mối Nguy Hiểm Xác Định</th>
                    <th style="width: 12%;">Xác Suất (P)</th>
                    <th style="width: 12%;">Mức Độ Nghiêm Trọng (S)</th>
                    <th>Biện Pháp Phòng Ngừa &amp; Giảm Thiểu</th>
                </tr>
            </thead>
            <tbody>
                ${riskRows}
            </tbody>
        </table>
    </div>

    <!-- MỤC 8: TRÌNH TỰ VẬN HÀNH NÂNG HẠ TỪNG BƯỚC -->
    <div class="box-card">
        <h3>9. QUY TRÌNH THAO TÁC NÂNG HẠ TỪNG BƯỚC (STEP-BY-STEP OPERATION SEQUENCE)</h3>
        <table style="margin-top: 8px;">
            <thead>
                <tr>
                    <th style="width: 40px; text-align: center;">Bước</th>
                    <th style="width: 220px;">Giai Đoạn Nâng Hạ</th>
                    <th>Quy Trình &amp; Thao Tác Kỹ Thuật</th>
                </tr>
            </thead>
            <tbody>
                ${stepRows}
            </tbody>
        </table>
    </div>

    <!-- MỤC 9: PHÊ DUYỆT & CHỮ KÝ KỸ THUẬT -->
    <div class="box-card">
        <h3>10. PHÊ DUYỆT &amp; CHỮ KÝ KỸ THUẬT (AUTHORIZATION &amp; SIGN-OFF BLOCKS)</h3>
        ${this.generateSignOffBoxHTML()}
    </div>

    <!-- MỤC 10: INTEGRATED JSA / HSE RISK ASSESSMENT PAGE -->
    ${jsaRiskPageHtml}

    <!-- Document Footer -->
    ${branding.footerHtml}
</body>
</html>`;
    }
}
