/**
 * ============================================================================
 * COMPLIANCE & ASME P30.1 LIFT PLAN INTEGRATION MODULE (compliance.js)
 * Standards: ASME P30.1, ASME B30.9, ASME B30.20, ASME B30.26, ISO 3874, DNV-ST-N001
 * Assembled into virtual:lifting-sim so it has direct access to state, phy, L()
 * ============================================================================
 */

let activeLiftPlanModel = null;
let isComplianceHUDVisible = false;

function initComplianceUI() {
    const btnComp = document.getElementById('btn-open-compliance');
    const btnPlan = document.getElementById('btn-open-liftplan');
    const panelComp = document.getElementById('compliance-hud-panel');
    const modalPlan = document.getElementById('liftplan-modal');

    function reframeForComplianceHud() {
        if (typeof window.invalidateUiSafeNdcCache === 'function') {
            window.invalidateUiSafeNdcCache();
        }
        if (typeof window.reframeAutoToUiSafeCenter === 'function') {
            window.reframeAutoToUiSafeCenter({ duration: 0.5, delay: 80 });
        } else if (typeof window.startCinematicUiFrame === 'function') {
            window.startCinematicUiFrame({ duration: 0.5, force: true });
        }
    }

    if (btnComp && panelComp) {
        btnComp.addEventListener('click', () => {
            isComplianceHUDVisible = !isComplianceHUDVisible;
            panelComp.classList.toggle('hidden', !isComplianceHUDVisible);
            btnComp.classList.toggle('active', isComplianceHUDVisible);
            if (isComplianceHUDVisible) updateComplianceHUD();
            reframeForComplianceHud();
        });

        const closeCompBtn = document.getElementById('btn-close-compliance-hud');
        if (closeCompBtn) {
            closeCompBtn.addEventListener('click', () => {
                isComplianceHUDVisible = false;
                panelComp.classList.add('hidden');
                btnComp.classList.remove('active');
                reframeForComplianceHud();
            });
        }
    }

    if (btnPlan && modalPlan) {
        btnPlan.addEventListener('click', openLiftPlanModal);

        const closePlanBtn = document.getElementById('btn-close-liftplan-modal');
        if (closePlanBtn) {
            closePlanBtn.addEventListener('click', () => {
                if (window.UI?.layout) window.UI.layout.closeModal('liftplan-modal');
                else modalPlan.classList.remove('open');
            });
        }

        // Tab Navigation inside Lift Plan Modal
        const tabs = document.querySelectorAll('.liftplan-tab-btn');
        tabs.forEach(tab => {
            tab.addEventListener('click', () => {
                tabs.forEach(t => t.classList.remove('active', 'border-amber-400', 'text-amber-300'));
                tab.classList.add('active', 'border-amber-400', 'text-amber-300');
                const targetView = tab.dataset.view;
                document.querySelectorAll('.liftplan-view-page').forEach(page => {
                    page.classList.toggle('hidden', page.id !== `liftplan-view-${targetView}`);
                });
            });
        });

        // Print / PDF Button & Quick Export
        const printBtn = document.getElementById('btn-liftplan-print');
        if (printBtn) {
            printBtn.addEventListener('click', exportLiftPlanToPDF);
        }
        const quickPdfBtn = document.getElementById('btn-quick-export-pdf');
        if (quickPdfBtn) {
            quickPdfBtn.addEventListener('click', exportLiftPlanToPDF);
        }

        // Export JSON Button
        const jsonDownloadBtn = document.getElementById('btn-liftplan-download-json');
        if (jsonDownloadBtn) {
            jsonDownloadBtn.addEventListener('click', () => {
                if (!activeLiftPlanModel) activeLiftPlanModel = buildCurrentLiftPlanModel();
                const jsonStr = activeLiftPlanModel.exportJSON();
                const blob = new Blob([jsonStr], { type: 'application/json' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `${activeLiftPlanModel.metadata.planId}_${activeLiftPlanModel.metadata.revision}.liftplan.json`;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                URL.revokeObjectURL(url);
            });
        }

        // Copy JSON Button
        const copyJsonBtn = document.getElementById('btn-liftplan-copy-json');
        if (copyJsonBtn) {
            copyJsonBtn.addEventListener('click', () => {
                if (!activeLiftPlanModel) activeLiftPlanModel = buildCurrentLiftPlanModel();
                navigator.clipboard.writeText(activeLiftPlanModel.exportJSON()).then(() => {
                    const origText = copyJsonBtn.textContent;
                    copyJsonBtn.textContent = '✓ Đã Sao Chép!';
                    setTimeout(() => { copyJsonBtn.textContent = origText; }, 2000);
                });
            });
        }

        // Sync from 3D Live Scene
        const syncBtn = document.getElementById('btn-liftplan-sync-live');
        if (syncBtn) {
            syncBtn.addEventListener('click', () => {
                activeLiftPlanModel = buildCurrentLiftPlanModel();
                renderLiftPlanModalContent();
                const orig = syncBtn.textContent;
                syncBtn.textContent = '✓ Đã Đồng Bộ!';
                setTimeout(() => { syncBtn.textContent = orig; }, 1500);
            });
        }
    }
}

/**
 * Captures the current 3D viewport and opens the ASME P30.1 Lift Plan printable report / PDF export window.
 */
function exportLiftPlanToPDF() {
    if (window.SafeLift?.saas?.canAccessFeature && !window.SafeLift.saas.canAccessFeature('riskAssessmentGenerator')) {
        const trigger = document.getElementById('btn-liftplan-print') || document.getElementById('btn-comp-hud-export');
        trigger?.click();
        return;
    }
    activeLiftPlanModel = buildCurrentLiftPlanModel();
    let screenshot = null;
    const sr = window.sceneRenderer || sceneRenderer;
    if (sr && typeof sr.captureScreenshot === 'function') {
        try {
            screenshot = sr.captureScreenshot(1920, 1080);
        } catch (e) {
            console.warn('[Compliance] Screenshot capture error:', e);
        }
    }
    const licenseOptions = window.SafeLift?.saas?.getPdfLicenseOptions?.() || { isTrialActive: true, isProUser: false };
    const printableHtml = activeLiftPlanModel.generatePrintableHTML(screenshot, licenseOptions);
    const printWindow = window.open('', '_blank');
    if (printWindow) {
        printWindow.document.open();
        printWindow.document.write(printableHtml);
        printWindow.document.close();
    } else {
        alert('Vui lòng cho phép Pop-up để mở bản in Lift Plan!');
    }
}
window.exportLiftPlanToPDF = exportLiftPlanToPDF;

/**
 * Constructs a fully parameterized LiftPlanModel instance dynamically mapped
 * from the active 3D simulation state.
 */
function buildCurrentLiftPlanModel() {
    const mb = (typeof computeRiggingMassBreakdown === 'function') ? computeRiggingMassBreakdown() : (phy && phy.massBreakdown ? phy.massBreakdown : null);
    const grossWeightKg = Math.round((state.weight || 16.0) * 1000);
    const riggingMassKg = Math.round(((mb ? mb.belowHookRiggingT : (phy.gearWeight || 0.35))) * 1000);
    const radiusM = Math.max(4.0, Math.round(Math.hypot(phy.hookPos.x, phy.hookPos.z) * 10) / 10);
    const tautLegs = (phy.legAngleDeg || []).filter((_, i) => !phy.legSlacks || !phy.legSlacks[i]);
    const workingSlingAngle = tautLegs.length ? Math.min(...tautLegs) : 60.0;

    let craneName = 'Liebherr LTM 1200-5.1 Mobile Telescopic Crane (Outriggers 100%)';
    let craneCapT = 75.0;
    if (state.craneType === 'hook_only') { craneName = 'Overhead Hoist & Hook Rigging Test Stand'; craneCapT = 100.0; }
    else if (state.craneType === 'crawler') { craneName = 'Liebherr LR 1300 SX Lattice Crawler Crane'; craneCapT = 95.0; }
    else if (state.craneType === 'gantry') { craneName = 'Heavy Industrial Overhead Bridge Crane'; craneCapT = 80.0; }

    const spreaderNames = {
        none: 'None (Direct 4-Leg Bridle to Master Link)',
        spreader: 'Modulift Tubular Spreader Strut (ASME B30.20)',
        lifting_beam: 'Wide-Flange Steel H-Section Lifting Beam (ASME B30.20)',
        cascaded: '2-Tier Cascaded Modulift Spreader System',
        frame: '4-Point Rectangular Lifting Frame',
        modular_truss: 'Heavy Lattice Spreader Truss',
        basket: 'Twin Basket Spreader Bars',
        container_spreader: 'Telescopic ISO Twistlock Spreader'
    };

    const padEyes = state.lugs.map((lug, idx) => ({
        id: `PE${idx + 1}_LUG`,
        x: lug.x,
        y: lug.y,
        z: lug.z,
        type: state.cargoType && state.cargoType.includes('container') ? 'ISO 1161 Corner Casting' : 'Welded Pad-Eye ASME BTH-1 / B30.20',
        wllT: state.wllPerLeg || 15.0
    }));

    // Compile Live Rigging Telemetry
    const grossT = (grossWeightKg / 1000) || 16.0;
    const hasSpreader = state.beamType !== 'none';

    // Tier 1 Bridle Slings (Hook ➔ Spreader / Master Link)
    const upperCables = (state.gear && state.gear.uppers ? state.gear.uppers : [{}, {}, {}, {}]).map((u, i) => {
        const lenM = (u && u.lengthM) || state.upperSlingLength || state.slingLength || 3.8;
        const rawAngle = (phy && phy.upperAngleDeg && phy.upperAngleDeg[i] != null && !isNaN(phy.upperAngleDeg[i]))
            ? Math.abs(phy.upperAngleDeg[i]) : 60.0;
        const angleDeg = THREE.MathUtils.clamp(rawAngle, 10.0, 90.0);
        const laf = 1 / Math.sin(angleDeg * Math.PI / 180);
        let tensionT = (phy && phy.upperTensions && phy.upperTensions[i] != null && phy.upperTensions[i] > 0.05)
            ? phy.upperTensions[i] : null;
        if (tensionT == null || tensionT < 0.01) {
            tensionT = (grossT + (riggingMassKg / 1000)) / 4 * laf;
        }
        const wllT = (state.wllPerLeg || 15.0) * 1.5;
        const sf = wllT > 0 && tensionT > 0 ? ((wllT * 5.0) / tensionT) : 5.0;
        const utilPct = wllT > 0 ? (tensionT / wllT) * 100 : 0;
        const hierId = (typeof RIG !== 'undefined' && RIG.resolveCableLabel) ? RIG.resolveCableLabel('upper', i, state, phy) : `LP${i + 1}`;
        return {
            id: hierId,
            role: 'upper',
            tierName: 'Tầng 1 (Móc ➔ Dầm)',
            name: `Cáp ${hierId}`,
            lengthM: lenM,
            angleDeg: angleDeg,
            laf: laf,
            tensionT: tensionT,
            wllT: wllT,
            sf: sf,
            utilPct: utilPct,
            diaMm: (u && u.diaMm) || 26,
            type: state.slingType || 'wire'
        };
    });

    // Tier 2 Lower Legs (Spreader ➔ Cargo Lugs / Pad-Eyes)
    const lowerCables = (state.lugs || [{}, {}, {}, {}]).map((lug, i) => {
        const l = (state.gear && state.gear.legs && state.gear.legs[i]) || {};
        const lenM = l.lengthM || state.lowerSlingLength || 2.8;
        const rawAngle = (phy && phy.legAngleDeg && phy.legAngleDeg[i] != null && !isNaN(phy.legAngleDeg[i]))
            ? Math.abs(phy.legAngleDeg[i]) : (hasSpreader ? 90.0 : 60.0);
        const angleDeg = THREE.MathUtils.clamp(rawAngle, 10.0, 90.0);
        const laf = 1 / Math.sin(angleDeg * Math.PI / 180);
        let tensionT = (phy && phy.legTensions && phy.legTensions[i] != null && phy.legTensions[i] > 0.05)
            ? phy.legTensions[i] : null;
        if (tensionT == null || tensionT < 0.01) {
            tensionT = grossT / Math.max(1, state.lugs ? state.lugs.length : 4) * laf;
        }
        const wllT = typeof legSwl === 'function' ? legSwl(i) : (state.wllPerLeg || 15.0);
        const sf = wllT > 0 && tensionT > 0 ? ((wllT * 5.0) / tensionT) : 5.0;
        const utilPct = wllT > 0 ? (tensionT / wllT) * 100 : 0;
        const legHierId = (typeof RIG !== 'undefined' && RIG.resolveCableLabel) ? RIG.resolveCableLabel('leg', i, state, phy) : `LP${i + 1}`;
        return {
            id: legHierId,
            role: 'leg',
            tierName: hasSpreader ? 'Tầng 2 (Dầm ➔ Tai Cẩu)' : 'Tầng 1 (Móc ➔ Tai Cẩu)',
            name: `Cáp ${legHierId}`,
            lengthM: lenM,
            angleDeg: angleDeg,
            laf: laf,
            tensionT: tensionT,
            wllT: wllT,
            sf: sf,
            utilPct: utilPct,
            diaMm: l.diaMm || 26,
            type: state.slingType || 'wire'
        };
    });

    const alpha1Deg = upperCables[0] ? upperCables[0].angleDeg : 60.0;
    const beamCompT = hasSpreader ? (grossT / (2 * Math.tan(alpha1Deg * Math.PI / 180))) : 0;
    const beamWllT = (state.gear && state.gear.beam && state.gear.beam.swlT) || 40.0;
    const beamSpanM = state.L || 6.0;

    // Rigging BOM Items
    const bom = [
        {
            itemNo: 1,
            category: 'Hook & Master Link',
            name: 'Móc Cẩu & Bộ Vòng Khuyên Cẩu Mẹ (Quad Sub-Assembly)',
            spec: `Grade 100 Alloy Steel, WLL ${craneCapT.toFixed(0)}T`,
            quantity: 1,
            wllT: craneCapT,
            proofT: craneCapT * 2.0,
            standard: 'ASME B30.26 / EN 1677-4',
            remarks: 'Kết nối đỉnh chùm cáp Tầng 1'
        },
        {
            itemNo: 2,
            category: 'Tier 1 Bridle Slings',
            name: `Cáp Treo Dầm Tầng 1 (${upperCables.length} nhánh)`,
            spec: `${state.slingType === 'chain' ? 'Xích G80' : (state.slingType === 'web' ? 'Cáp Vải Dẹt' : 'Cáp Thép 6x36 IWRC')} Ø${upperCables[0].diaMm}mm × L=${upperCables[0].lengthM.toFixed(2)}m`,
            quantity: upperCables.length,
            wllT: upperCables[0].wllT,
            proofT: upperCables[0].wllT * 2.0,
            standard: 'ASME B30.9 / OSHA 1910.184',
            remarks: `Góc làm việc α = ${alpha1Deg.toFixed(1)}° (LAF = ${(1/Math.sin(alpha1Deg*Math.PI/180)).toFixed(3)})`
        }
    ];

    if (hasSpreader) {
        bom.push({
            itemNo: 3,
            category: 'Spreader Beam',
            name: spreaderNames[state.beamType] || 'Dầm Gánh Tải / Spreader Bar',
            spec: `Chiều dài Span ${beamSpanM.toFixed(1)}m, Chịu nén danh định ${beamWllT.toFixed(0)}T`,
            quantity: 1,
            wllT: beamWllT,
            proofT: beamWllT * 1.5,
            standard: 'ASME B30.20 / ASME BTH-1 Cat B',
            remarks: `Lực nén tính toán P = ${beamCompT.toFixed(1)} T (${((beamCompT/beamWllT)*100).toFixed(1)}% WLL)`
        });
        bom.push({
            itemNo: 4,
            category: 'Rigging Hardware',
            name: state.hwType === 'dshackle' ? 'Ma Ní Chữ D (D-Shackles)' : 'Ma Ní Móng Ngựa Bu-lông Chốt (Bow Shackles)',
            spec: `${state.hwType === 'dshackle' ? 'Crosby G-210' : 'Crosby G-2130'} Thép Hợp Kim WLL 17.0T`,
            quantity: 8,
            wllT: 17.0,
            proofT: 34.0,
            standard: 'ASME B30.26 / US RR-C-271',
            remarks: 'Hệ số an toàn SF 6:1'
        });
        bom.push({
            itemNo: 5,
            category: 'Tier 2 Lower Slings',
            name: `Cáp Hạ Tầng 2 (${lowerCables.length} sợi dầm ➔ hàng)`,
            spec: `${state.slingType === 'chain' ? 'Xích G80' : (state.slingType === 'web' ? 'Cáp Vải' : 'Cáp Thép 6x36 IWRC')} Ø${lowerCables[0].diaMm}mm × L=${lowerCables[0].lengthM.toFixed(2)}m`,
            quantity: lowerCables.length,
            wllT: lowerCables[0].wllT,
            proofT: lowerCables[0].wllT * 2.0,
            standard: 'ASME B30.9 / EN 13414',
            remarks: `Góc làm việc α = ${lowerCables[0].angleDeg.toFixed(1)}° (Lực căng T = ${lowerCables[0].tensionT.toFixed(2)} T)`
        });
    } else {
        bom.push({
            itemNo: 3,
            category: 'Rigging Hardware',
            name: state.hwType === 'dshackle' ? 'Ma Ní Chữ D (D-Shackles)' : 'Ma Ní Móng Ngựa Bu-lông Chốt (Bow Shackles)',
            spec: 'Crosby G-2130 Thép Hợp Kim WLL 17.0T',
            quantity: 4,
            wllT: 17.0,
            proofT: 34.0,
            standard: 'ASME B30.26 / US RR-C-271',
            remarks: 'Kết nối tai cẩu kiện hàng'
        });
    }

    bom.push({
        itemNo: bom.length + 1,
        category: 'Cargo Pad-Eyes',
        name: 'Tai Cẩu / Khóa Chóp Kiện Hàng (Pad-Eyes)',
        spec: state.cargoType && state.cargoType.includes('container') ? 'ISO 1161 Steel Corner Castings' : 'Welded Pad-Eye Plate ASME BTH-1',
        quantity: state.lugs ? state.lugs.length : 4,
        wllT: state.wllPerLeg || 15.0,
        proofT: (state.wllPerLeg || 15.0) * 2.0,
        standard: state.cargoType && state.cargoType.includes('container') ? 'ISO 1161 / ISO 3874' : 'ASME BTH-1 / AWS D1.1',
        remarks: 'Kiểm tra NDT / MPI định kỳ'
    });

    const liveRiggingData = {
        hasSpreader,
        beamType: state.beamType,
        beamName: spreaderNames[state.beamType] || 'Spreader Beam',
        beamSpanM,
        beamWllT,
        beamCompT,
        hookHeightM: (phy && phy.hookPos && Number.isFinite(phy.hookPos.y)) ? phy.hookPos.y : 12.0,
        groundClearanceM: (phy && phy.groundClearance && Number.isFinite(phy.groundClearance)) ? Math.max(0, phy.groundClearance) : 0,
        upperCables,
        lowerCables,
        bom
    };

    return new window.CAE.LiftPlanModel({
        planId: `LP-${Date.now().toString(36).toUpperCase()}`,
        projectName: 'Heavy Rigging & Critical Lift Engineering Plan',
        location: 'Flat Concrete Engineering Testbed (Metric 1:1)',
        cargoId: (state.cargoType || 'CRATE').toUpperCase(),
        cargoDesc: `${state.L.toFixed(1)}m × ${state.W.toFixed(1)}m × ${state.H.toFixed(1)}m Industrial Payload`,
        grossWeightKg,
        dimensionsM: { length: state.L, width: state.W, height: state.H },
        cogOffsetM: { x: state.cogX, y: state.cogY, z: state.cogZ },
        padEyes,
        craneModel: craneName,
        craneType: (state.craneType || 'MOBILE_TELESCOPIC').toUpperCase(),
        workingRadiusM: radiusM,
        maxRatedCapacityT: craneCapT,
        spreaderType: spreaderNames[state.beamType] || 'Custom Rigging Spreader Assembly',
        spreaderMassKg: state.beamType === 'none' ? 0 : riggingMassKg,
        spreaderWllT: (state.gear && state.gear.beam && state.gear.beam.swlT) || 40.0,
        topBridle: {
            slingType: state.slingType === 'chain'
                ? 'Grade 80/100 Alloy Chain Sling (EN 818-4 / ASME B30.9)'
                : (state.slingType === 'web'
                    ? 'Heavy Polyester Flat/Round Webbing Sling (ASME B30.9)'
                    : 'Steel Wire Rope 6x36 IWRC w/ Thimbles & Ferrules (ASME B30.9)'),
            diameterMm: (state.gear && state.gear.legs && state.gear.legs[0] && state.gear.legs[0].diaMm) || 20,
            lengthM: state.slingLength || 3.8,
            slingAngleDeg: workingSlingAngle,
            mblT: (state.wllPerLeg || 15.0) * 5.0,
            safetyFactor: 5.0,
            wllT: state.wllPerLeg || 15.0
        },
        windSpeedMps: Number.isFinite(Number(state.windSpeedMps)) ? Number(state.windSpeedMps) : 3.5,
        maxWindLimitMps: Number.isFinite(Number(state.maxWindLimitMps)) ? Number(state.maxWindLimitMps) : 13.8,
        groundBearingKpa: (phy && Number.isFinite(Number(phy.groundBearingKpa))) ? Number(phy.groundBearingKpa) : undefined,
        inspectionStatus: (state.gear && state.gear.inspectionStatus) || 'VALID',
        liveRiggingData
    });
}

function getCurrentLiftPlanSummary() {
    const model = buildCurrentLiftPlanModel();
    const compliance = model.evaluateCompliance();
    const finite = (value) => Number.isFinite(Number(value)) ? Number(value) : null;
    return {
        generatedAt: new Date().toISOString(),
        overallStatus: String(compliance.overallStatus || 'UNKNOWN').slice(0, 20),
        isCompliant: Boolean(compliance.isCompliant),
        cargo: {
            grossWeightKg: finite(model.cargo.grossWeightKg),
            dimensionsM: {
                length: finite(model.cargo.dimensionsM.length),
                width: finite(model.cargo.dimensionsM.width),
                height: finite(model.cargo.dimensionsM.height)
            },
            cogOffsetM: {
                x: finite(model.cargo.cogOffsetM.x),
                y: finite(model.cargo.cogOffsetM.y),
                z: finite(model.cargo.cogOffsetM.z)
            }
        },
        crane: {
            model: String(model.crane.model || '').slice(0, 120),
            workingRadiusM: finite(model.crane.workingRadiusM),
            maxRatedCapacityT: finite(model.crane.maxRatedCapacityT)
        },
        checks: (Array.isArray(compliance.checks) ? compliance.checks : []).slice(0, 30).map((check) => ({
            code: String(check.code || '').slice(0, 40),
            name: String(check.name || '').slice(0, 100),
            status: String(check.status || '').slice(0, 20),
            message: String(check.message || '').slice(0, 240)
        }))
    };
}

/**
 * Updates the floating Compliance HUD Panel with live criteria evaluated from the engine.
 */
function updateComplianceHUD() {
    const panel = document.getElementById('compliance-hud-panel');
    if (!panel || panel.classList.contains('hidden')) return;

    if (!window.CAE || !window.CAE.EngineeringEngine) return;

    const mb = (phy && phy.massBreakdown) ? phy.massBreakdown : null;
    const riggingMassKg = Math.round(((mb ? mb.belowHookRiggingT : (phy.gearWeight || 0.35))) * 1000);

    const plan = {
        cargo: {
            massKg: Math.round((state.weight || 16.0) * 1000),
            dimensions: { x: state.L || 4.5, y: state.H || 2.4, z: state.W || 2.6 },
            cogLocal: { x: state.cogX || 0, y: state.cogY || 0, z: state.cogZ || 0 },
            padEyes: (state.lugs || []).map(lug => ({
                localPos: { x: lug.x, y: lug.y, z: lug.z },
                wllT: state.wllPerLeg || 15.0
            }))
        },
        rigging: {
            spreaderMassKg: state.beamType === 'none' ? 0 : riggingMassKg,
            spreaderWllT: (state.gear && state.gear.beam && state.gear.beam.swlT) || 40.0,
            topBridle: {
                active: state.beamType !== 'none',
                wllT: (state.wllPerLeg || 15.0) * 1.8,
                lengthM: state.slingLength || 3.8
            },
            lowerLegs: (state.lugs || []).map((_, idx) => ({ wllT: typeof legSwl === 'function' ? legSwl(idx) : (state.wllPerLeg || 15.0) }))
        },
        crane: {
            hookPosition: {
                x: (phy && phy.hookPos && Number.isFinite(phy.hookPos.x)) ? phy.hookPos.x : 0,
                y: (phy && phy.hookPos && Number.isFinite(phy.hookPos.y)) ? phy.hookPos.y : 12,
                z: (phy && phy.hookPos && Number.isFinite(phy.hookPos.z)) ? phy.hookPos.z : 0
            }
        },
        environment: {
            windSpeedMps: 4.2,
            maxWindSpeedMps: 12.0
        }
    };

    const audit = window.CAE.EngineeringEngine.validateCompliance(plan);
    const badgeEl = document.getElementById('comp-hud-badge');
    if (badgeEl) {
        if (audit.overallStatus === 'PASS') {
            badgeEl.textContent = '🟢 ĐẠT CHUẨN ASME / ISO';
            badgeEl.className = 'px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/50 shadow-[0_0_8px_rgba(52,211,153,0.3)]';
        } else if (audit.overallStatus === 'WARNING') {
            badgeEl.textContent = '🟡 CẢNH BÁO AN TOÀN';
            badgeEl.className = 'px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-amber-500/20 text-amber-300 border border-amber-500/50 shadow-[0_0_8px_rgba(245,158,11,0.3)]';
        } else {
            badgeEl.textContent = '🔴 KHÔNG ĐẠT (VI PHẠM)';
            badgeEl.className = 'px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-red-500/20 text-red-400 border border-red-500/50 shadow-[0_0_8px_rgba(239,68,68,0.3)] animate-pulse';
        }
    }

    // Evaluate dedicated ASME B30.9 Sling Angle & LAF Analysis
    const tautLegs = (phy && phy.legAngleDeg) ? phy.legAngleDeg.filter((_, i) => !phy.legSlacks || !phy.legSlacks[i]) : [];
    const activeAlpha = tautLegs.length ? Math.min(...tautLegs) : Math.max(1, 90 - (phy.maxAngleVert || 30));
    const grossW = (state.weight || 16.0) + (riggingMassKg / 1000);
    const safetyEval = window.CAE.EngineeringEngine.evaluateRiggingSafety({
        grossWeight: grossW,
        nominalLegs: (state.lugs && state.lugs.length) || 4,
        alphaDeg: Number.isFinite(activeAlpha) ? activeAlpha : 60.0,
        ratedWllPerLeg: state.wllPerLeg || 15.0,
        isRigidLoad: true,
        unit: 'T',
        lang: state.lang || 'vi'
    });

    const isCrit = safetyEval.status === window.CAE.EngineeringEngine.SAFETY_ZONES.CRITICAL_VIOLATION;
    const isWarn = safetyEval.status === window.CAE.EngineeringEngine.SAFETY_ZONES.WARNING;
    const statusBg = isCrit ? 'bg-red-950/70 border-red-500/60 text-red-300' : (isWarn ? 'bg-amber-950/70 border-amber-500/60 text-amber-300' : 'bg-emerald-950/70 border-emerald-500/60 text-emerald-300');
    const statusBadge = isCrit ? 'bg-red-500/30 text-red-300 border-red-500 animate-pulse' : (isWarn ? 'bg-amber-500/30 text-amber-300 border-amber-500' : 'bg-emerald-500/30 text-emerald-300 border-emerald-500');

    const recsHtml = safetyEval.recommendations.length ? `
        <div class="mt-2 pt-1.5 border-t border-slate-700/60 flex flex-col gap-1 text-[10px]">
            <span class="font-bold text-amber-300 uppercase tracking-wider flex items-center gap-1">
                💡 Khuyến nghị kỹ thuật giảm tải (Recommendation Engine):
            </span>
            ${safetyEval.recommendations.map(r => `
                <div class="bg-slate-950/70 p-1.5 rounded border border-slate-800 text-[10px] leading-tight">
                    <span class="font-bold text-sky-300">${r.code}:</span>
                    <span class="text-slate-200"> ${r.action}</span>
                    <div class="text-[9px] text-slate-400 italic mt-0.5">➔ Lợi ích: ${r.expectedGain}</div>
                </div>
            `).join('')}
        </div>
    ` : '';

    const asmeCardHtml = `
        <div class="p-2 rounded-lg border ${statusBg} mb-2 flex flex-col gap-1.5 shadow-md">
            <div class="flex items-center justify-between border-b border-slate-700/60 pb-1">
                <span class="font-black text-[11px] tracking-wide text-white flex items-center gap-1.5">
                    📐 ĐÁNH GIÁ GÓC CÁP & HỆ SỐ LAF (ASME B30.9)
                </span>
                <span class="px-2 py-0.5 rounded font-mono font-extrabold text-[10px] border ${statusBadge}">
                    ${safetyEval.status}
                </span>
            </div>
            <div class="grid grid-cols-2 gap-1.5 text-[10.5px] font-mono">
                <div>Góc nâng ngang α: <b class="text-sky-300">${safetyEval.alphaDeg.toFixed(1)}°</b></div>
                <div>Góc đỉnh β: <b class="text-sky-300">${safetyEval.topIncludedAngleDeg.toFixed(1)}°</b></div>
                <div>Hệ số tải LAF: <b class="${isCrit ? 'text-red-400' : (isWarn ? 'text-amber-300' : 'text-emerald-300')}">${safetyEval.laf.toFixed(3)}</b></div>
                <div>Mức tăng lực ΔT: <b class="${isCrit ? 'text-red-400' : (isWarn ? 'text-amber-300' : 'text-emerald-300')}">+${safetyEval.tensionIncreasePct.toFixed(1)}%</b></div>
                <div>Lực căng/nhánh T: <b class="text-white">${safetyEval.slingTension.toFixed(2)} T</b></div>
                <div>Hiệu suất WLL: <b class="${safetyEval.utilizationPct > 100 ? 'text-red-400 font-bold' : 'text-emerald-300'}">${safetyEval.utilizationPct}%</b></div>
            </div>
            ${safetyEval.errorMessage ? `<div class="text-[10px] font-bold text-red-400 bg-red-950/80 p-1 rounded border border-red-500/50">${safetyEval.errorMessage}</div>` : ''}
            ${safetyEval.warningMessage && !safetyEval.errorMessage ? `<div class="text-[10px] font-medium text-amber-300 bg-amber-950/80 p-1 rounded border border-amber-500/50">${safetyEval.warningMessage}</div>` : ''}
            ${recsHtml}
        </div>
    `;

    const listEl = document.getElementById('comp-hud-list');
    if (listEl) {
        const checksHtml = audit.checks.map(c => {
            const isPass = c.status === 'PASS';
            const isW = c.status === 'WARNING';
            const statusIcon = isPass ? '✓' : (isW ? '⚠' : '✕');
            const statusColor = isPass ? 'text-emerald-400 border-emerald-500/40 bg-emerald-950/40' : (isW ? 'text-amber-400 border-amber-500/40 bg-amber-950/40' : 'text-red-400 border-red-500/50 bg-red-950/50');
            return `
                <div class="flex items-start justify-between gap-2 p-1.5 rounded bg-slate-900/80 border border-slate-800 text-[11px]">
                    <div class="flex-1">
                        <div class="font-bold text-slate-200 flex items-center gap-1.5">
                            <span>${c.name}</span>
                            <span class="text-[9px] font-mono text-slate-400">(${c.standard})</span>
                        </div>
                        <div class="text-[10px] text-slate-400 flex items-center gap-2 mt-0.5 font-mono">
                            <span>Hiện tại: <b class="text-sky-300">${c.value}</b></span>
                            <span>|</span>
                            <span>Giới hạn: <b class="text-amber-300">${c.limit}</b></span>
                        </div>
                    </div>
                    <div class="px-2 py-0.5 rounded font-mono font-bold text-xs border ${statusColor}">
                        ${statusIcon} ${c.status}
                    </div>
                </div>
            `;
        }).join('');

        listEl.innerHTML = asmeCardHtml + checksHtml;
    }
}

/**
 * Opens the ASME P30.1 Lift Plan Modal and renders live data.
 */
function openLiftPlanModal() {
    const modal = document.getElementById('liftplan-modal');
    if (!modal) return;

    activeLiftPlanModel = buildCurrentLiftPlanModel();
    if (window.UI?.layout) window.UI.layout.openModal('liftplan-modal');
    else modal.classList.add('open');
    renderLiftPlanModalContent();
}

/**
 * Populates the Lift Plan Modal views.
 */
function renderLiftPlanModalContent() {
    if (!activeLiftPlanModel) return;

    // View 1: Rendered Printable Document
    const reportContainer = document.getElementById('liftplan-report-container');
    if (reportContainer) {
        const fullHtml = activeLiftPlanModel.generatePrintableHTML();
        // Extract body contents for inline embedding
        const bodyContent = fullHtml.substring(fullHtml.indexOf('<body>') + 6, fullHtml.indexOf('</body>'));
        reportContainer.innerHTML = bodyContent;
    }

    // View 2: JSON Schema Raw Viewer
    const jsonViewer = document.getElementById('liftplan-json-viewer');
    if (jsonViewer) {
        jsonViewer.textContent = activeLiftPlanModel.exportJSON();
    }

    // Modal Header Subtitle
    const titleSub = document.getElementById('liftplan-modal-sub');
    if (titleSub) {
        titleSub.textContent = `Hồ Sơ: ${activeLiftPlanModel.metadata.planId} · ${activeLiftPlanModel.metadata.category} · ASME P30.1 / ISO 3874`;
    }
}
