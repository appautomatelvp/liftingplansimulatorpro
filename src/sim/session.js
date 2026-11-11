/**
 * session — part of the lifting simulator.
 * These files are assembled into one module so they share state, physics and the scene.
 */
        // --- 11. RESET TO INITIAL PRE-LIFT STATE, FACTORY RESET & SMOOTH AUTO-LEVEL ---
        function resetToInitialPreLiftState() {
            phy.autoHoistActive = false;
            phy.hoistSpeed = 0;
            if (phy.hookVel) phy.hookVel.set(0, 0, 0);
            if (phy.cargoVel) phy.cargoVel.set(0, 0, 0);
            if (phy.cargoOmega) phy.cargoOmega.set(0, 0, 0);
            if (phy.cargoQuat) phy.cargoQuat.identity();
            if (phy.cargoPos) { phy.cargoPos.x = 0; phy.cargoPos.z = 0; }
            if (Array.isArray(phy.beams)) {
                phy.beams.forEach(b => {
                    if (b.v) b.v.set(0, 0, 0);
                    if (b.w) b.w.set(0, 0, 0);
                });
            }
            resetFlatRackPayloadState();
            // Keep plan position — NEVER teleport to y=3 (that made cargo "nảy lên" before set-down)
            state.poseLock = true;
            applyLockedPose();
            phy.legTensions = [0, 0, 0, 0, 0, 0, 0, 0];
            phy.legSlacks = [true, true, true, true, true, true, true, true];
            phy.upperTensions = [0, 0, 0, 0];
            phy.groundClearance = 0;
            syncPoseLockUI();
            parkHookSlack();
            state.pullRadius = 0;
            syncOrientationAndPullUI();
            if (typeof syncSlingSlidersFromState === 'function') syncSlingSlidersFromState();
            document.getElementById('sim-status-text').textContent = L('Set down. The cargo is at the placed angle and the ropes are slack.', 'Đã hạ đất. Kiện nằm đúng góc đặt, cáp đang chùng.');
        }

        // Nhóm kiện hàng cho căng cáp: kiện vẫn nằm trên mặt đất nhưng các sợi cáp đã căng sẵn sàng nâng hạ
        function pretensionRig() {
            phy.autoHoistActive = false;
            phy.hoistSpeed = 0;
            state.holdCableLength = false;
            state.heldCableL0 = null;
            if (phy.hookVel) phy.hookVel.set(0, 0, 0);
            if (phy.cargoVel) phy.cargoVel.set(0, 0, 0);
            if (phy.cargoOmega) phy.cargoOmega.set(0, 0, 0);
            if (phy.cargoQuat) phy.cargoQuat.identity();
            if (phy.cargoPos) { phy.cargoPos.x = 0; phy.cargoPos.z = 0; }

            // Giữ kiện hàng ổn định trên mặt đất / đà kê (cùng điểm tiếp xúc với XPBD)
            if (typeof applyLockedPose === 'function') {
                const keepLock = state.poseLock;
                state.poseLock = true;
                applyLockedPose();
                state.poseLock = keepLock;
            } else if (typeof supportY === 'function') {
                const sY = supportY(phy.cargoPos.x, phy.cargoPos.z);
                phy.cargoPos.y = sY + state.H * 0.5;
            }
            phy.groundClearance = 0;

            // Đặt móc lên đúng cao độ hình học làm căng cáp
            if (typeof syncHookToRigTaut === 'function') {
                syncHookToRigTaut();
            }
            // Snug pose starts with an unloaded hoist rope — clear any leftover
            // elastic stretch / operator compensation from a previous lift so the
            // next "Hạ" pays out instead of hauling the hook up.
            if (phy.hoist && typeof resetHoistDynamicState === 'function') {
                resetHoistDynamicState(phy.hoist);
                phy.hoist.kin.copy(phy.hookPos);
            } else if (phy.hoist) {
                phy.hoist.off.set(0, 0, 0);
                phy.hoist.offLP.set(0, 0, 0);
                phy.hoist.vel.set(0, 0, 0);
                phy.hoist.tensionN = 0;
                phy.hoist.tensionLP = 0;
                phy.hoist.kin.copy(phy.hookPos);
            }
            state.poseLock = true;
            if (typeof syncPoseLockUI === 'function') syncPoseLockUI();

            // Cân bằng dầm ngáng nằm ngang trên kiện ở cao độ căng cáp
            const spec = (typeof getRigSpec === 'function') ? getRigSpec() : null;
            let lowerDrop = (spec && spec.lowerDrop) || 2.0;
            const legCables = (phy.cables || []).filter(c => c.role === 'leg');
            if (legCables.length) {
                lowerDrop = 0;
                legCables.forEach(c => {
                    const hL = (typeof lowerPlanOffset === 'function') ? lowerPlanOffset(c.index || 0) : 0;
                    const d = Math.sqrt(Math.max(0.04, (c.L0 || 2) * (c.L0 || 2) - hL * hL));
                    if (d > lowerDrop) lowerDrop = d;
                });
            }

            let worldLugY = 0;
            if (state.lugs && state.lugs.length) {
                for (let i = 0; i < state.lugs.length; i++) {
                    const p = state.lugs[i].clone().applyQuaternion(phy.cargoQuat).add(phy.cargoPos);
                    worldLugY += p.y;
                }
                worldLugY /= Math.max(1, state.lugs.length);
            }

            let yLugLow = 0.22;
            if (state.beamType === 'lifting_beam') yLugLow = 0.24;
            else if (state.beamType === 'frame') yLugLow = 0.18;
            else if (state.beamType === 'basket') yLugLow = 0.14;
            else if (state.beamType === 'container_spreader') yLugLow = 0.28;
            const beamTautY = worldLugY + 0.12 + lowerDrop + yLugLow;
            if (Array.isArray(phy.beams)) {
                // Seed from kinematic pose so skewed cargo already leans the upper gear
                // (do NOT force identity — that wiped askew take-up physics).
                if (typeof seedBeamsFromKinematic === 'function') {
                    seedBeamsFromKinematic();
                }
                phy.beams.forEach(b => {
                    b.x.y = Math.max(b.x.y, beamTautY);
                    b.v.set(0, 0, 0);
                    b.w.set(0, 0, 0);
                });
            }

            // Đánh dấu toàn bộ cáp vào trạng thái vừa căng (pretensioned / snug)
            (phy.cables || []).forEach(c => {
                c.slack = false;
                c._sum = 0.05 * 9.81 * 1000;
                c.tensionT = 0.05;
            });
            if (Array.isArray(phy.legSlacks)) phy.legSlacks.fill(false);
            if (Array.isArray(phy.legTensions)) phy.legTensions.fill(0.05);

            if (typeof syncCableRest === 'function') syncCableRest(false);
            if (typeof updateSceneAndTelemetry === 'function') updateSceneAndTelemetry();
            if (typeof updateCraneKinematics === 'function') updateCraneKinematics();

            const inpHookY = document.getElementById('inp-hook-y');
            if (inpHookY) inpHookY.value = phy.hookPos.y.toFixed(2);
            const numHookY = document.getElementById('num-hook-y');
            if (numHookY) numHookY.value = phy.hookPos.y.toFixed(2);
            const lblHookY = document.getElementById('val-hook-y');
            if (lblHookY) lblHookY.textContent = phy.hookPos.y.toFixed(1) + 'm';
            const dockWinchEl = document.getElementById('val-hoist-y-dock') || document.getElementById('num-hoist-y-dock');
            if (dockWinchEl) dockWinchEl.textContent = phy.hookPos.y.toFixed(1) + 'm';

            const statusEl = document.getElementById('sim-status-text');
            if (statusEl) {
                statusEl.textContent = state.lang === 'en'
                    ? '⚡ Slings snug & pre-tensioned. Ready to hoist or lower.'
                    : '⚡ Đã nhóm căng cáp. Kiện trên mặt đất, sẵn sàng kéo lên hoặc hạ.';
            }
        }
        window.pretensionRig = pretensionRig;

        function syncResetButtonState() {
            const btnReset = document.getElementById('btn-reset-all');
            if (!btnReset) return;

            const hasBaseline = Boolean(state.userBaselineState);
            btnReset.disabled = !hasBaseline;

            if (hasBaseline) {
                btnReset.classList.remove('opacity-40', 'cursor-not-allowed', '!bg-slate-900', '!border-slate-700', 'text-slate-400');
                btnReset.classList.add('!bg-rose-950/90', '!border-rose-500/60', 'text-rose-200', 'hover:bg-rose-900/80', 'cursor-pointer');
                btnReset.title = state.lang === 'en'
                    ? 'Reset to saved initial baseline state'
                    : 'Khôi phục về trạng thái mốc ban đầu đã thiết lập';
            } else {
                btnReset.classList.add('opacity-40', 'cursor-not-allowed', '!bg-slate-900', '!border-slate-700', 'text-slate-400');
                btnReset.classList.remove('!bg-rose-950/90', '!border-rose-500/60', 'text-rose-200', 'hover:bg-rose-900/80', 'cursor-pointer');
                btnReset.title = state.lang === 'en'
                    ? 'Initial baseline state not set yet (Click [Set Home] first)'
                    : 'Chưa thiết lập trạng thái ban đầu (Hãy bấm Đặt Mốc Đầu trước)';
            }
        }

        function saveUserInitialBaselineState() {
            const isSuspended = (!state.poseLock && (phy.groundClearance || 0) > 0.02) || (phy.hookPos && phy.hookPos.y > 4.5 && phy.cargoPos && phy.cargoPos.y > (supportY(0, 0) + (state.H || 2.6) * 0.5 + 0.04));
            state.userBaselineState = {
                cargoType: state.cargoType,
                L: state.L,
                W: state.W,
                H: state.H,
                weight: state.weight,
                weightUserSet: state.weightUserSet,
                isoCode: state.isoCode,
                tareT: state.tareT,
                maxPayloadT: state.maxPayloadT,
                maxGrossT: state.maxGrossT,

                cogX: state.cogX,
                cogY: state.cogY,
                cogZ: state.cogZ,

                lugElevPreset: state.lugElevPreset,
                selectedLP: state.selectedLP,
                lugs: state.lugs.map(p => p.clone()),
                lugNormals: (state.lugNormals || []).map(n => n.clone()),
                customLugPositions: state.customLugPositions ? JSON.parse(JSON.stringify(state.customLugPositions)) : null,
                customMesh: state.customMesh,

                oogHasCargo: state.oogHasCargo,
                oogTarp: state.oogTarp,
                oogCargoL: state.oogCargoL,
                oogCargoW: state.oogCargoW,
                oogCargoH: state.oogCargoH,

                beamType: state.beamType,
                hookCount: state.hookCount || 1,
                stsSizeFt: state.stsSizeFt || 40,
                stsTwinLift: !!state.stsTwinLift,
                stsAttachMode: state.stsAttachMode || 'direct',
                slingType: state.slingType,
                hwType: state.hwType,
                slingLength: state.slingLength,
                upperSlingLength: state.upperSlingLength,
                lowerSlingLength: state.lowerSlingLength,
                hangerSlingLength: state.hangerSlingLength,
                unitSystem: state.unitSystem,
                slingUserSet: state.slingUserSet,
                wllPerLeg: state.wllPerLeg,
                legDeltaL: [...state.legDeltaL],
                gear: JSON.parse(JSON.stringify(state.gear)),
                customBeamLengthMode: state.customBeamLengthMode,
                rigFit: state.rigFit,
                holdCableLength: state.holdCableLength,
                heldCableL0: state.heldCableL0 ? { ...state.heldCableL0 } : null,

                craneType: state.craneType,
                slewDeg: state.slewDeg,
                sceneId: state.sceneId,
                groundId: state.groundId,

                cargoYawDeg: state.cargoYawDeg,
                cargoPitchTrimDeg: state.cargoPitchTrimDeg,
                cargoRollTrimDeg: state.cargoRollTrimDeg,
                pullAzimuthDeg: state.pullAzimuthDeg,
                pullRadius: state.pullRadius,
                spreaderYawDeg: state.spreaderYawDeg,
                spreaderAlignWithCargo: Boolean(state.spreaderAlignWithCargo),
                hookSwivelEnabled: state.hookSwivelEnabled !== false,
                displayOptions: JSON.parse(JSON.stringify(state.displayOptions || {})),

                // Mid-air suspended state persistence
                isSuspended: Boolean(isSuspended),
                cargoPos: phy.cargoPos ? phy.cargoPos.clone() : null,
                cargoQuat: phy.cargoQuat ? phy.cargoQuat.clone() : null,
                groundClearance: phy.groundClearance || 0,
                poseLock: Boolean(state.poseLock),
                beamPoses: (phy.beams || []).map(b => ({ id: b.id, x: b.x.clone(), q: b.q.clone() })),

                hookTarget: phy.hookTarget.clone(),
                hookPos: phy.hookPos.clone()
            };

            syncResetButtonState();

            if (typeof simAudio !== 'undefined' && simAudio.playClack) {
                simAudio.playClack(1.0);
            }

            const btnBaseline = document.getElementById('btn-set-baseline');
            if (btnBaseline) {
                const origHtml = btnBaseline.innerHTML;
                btnBaseline.innerHTML = '✅ ' + (state.lang === 'en' ? 'Saved' : 'Đã Lưu Mốc');
                btnBaseline.classList.add('!bg-emerald-700/80', '!text-white', '!border-emerald-400');
                setTimeout(() => {
                    btnBaseline.innerHTML = origHtml;
                    btnBaseline.classList.remove('!bg-emerald-700/80', '!text-white', '!border-emerald-400');
                }, 1500);
            }

            const status = document.getElementById('sim-status-text');
            if (status) {
                status.textContent = state.lang === 'en'
                    ? (isSuspended ? '📌 Saved suspended pose' : '📌 Saved baseline pose')
                    : (isSuspended ? '📌 Đã lưu mốc lơ lửng' : '📌 Đã lưu mốc ban đầu');
            }
        }

        function resetToUserInitialBaselineState() {
            if (!state.userBaselineState) {
                const status = document.getElementById('sim-status-text');
                if (status) {
                    status.textContent = state.lang === 'en'
                        ? '⚠️ Baseline not set'
                        : '⚠️ Chưa đặt mốc ban đầu';
                }
                if (typeof simAudio !== 'undefined' && simAudio.playSnap) {
                    simAudio.playSnap(0.4);
                }
                return;
            }

            const b = state.userBaselineState;

            // 1. Restore Cargo & CoG
            state.cargoType = b.cargoType;
            state.weightUserSet = b.weightUserSet;
            state.isoCode = b.isoCode;
            state.tareT = b.tareT;
            state.maxPayloadT = b.maxPayloadT;
            state.maxGrossT = b.maxGrossT;
            setDimAndCoG({
                L: b.L,
                W: b.W,
                H: b.H,
                weight: b.weight,
                cogX: b.cogX,
                cogY: b.cogY,
                cogZ: b.cogZ
            });

            // 2. Restore Lugs
            state.lugElevPreset = b.lugElevPreset;
            state.selectedLP = b.selectedLP || 'all';
            state.lugs = b.lugs.map(p => p.clone());
            state.lugNormals = (b.lugNormals || []).map(n => n.clone());
            state.customLugPositions = b.customLugPositions ? JSON.parse(JSON.stringify(b.customLugPositions)) : null;
            state.customMesh = b.customMesh;
            state.pendingConform = 'skip';

            // 3. Restore OOG Cargo
            state.oogHasCargo = b.oogHasCargo;
            state.oogTarp = b.oogTarp;
            state.oogCargoL = b.oogCargoL;
            state.oogCargoW = b.oogCargoW;
            state.oogCargoH = b.oogCargoH;
            if (typeof syncOogCargoUI === 'function') syncOogCargoUI(false);

            // 4. Restore Rigging Gear & Beam
            state.beamType = b.beamType;
            if (b.hookCount != null) state.hookCount = b.hookCount;
            if (b.stsSizeFt != null) state.stsSizeFt = b.stsSizeFt;
            if (b.stsTwinLift != null) state.stsTwinLift = !!b.stsTwinLift;
            if (b.stsAttachMode) state.stsAttachMode = b.stsAttachMode;
            state.slingType = b.slingType;
            state.hwType = b.hwType;
            state.slingLength = b.slingLength;
            state.upperSlingLength = b.upperSlingLength !== undefined ? b.upperSlingLength : null;
            state.lowerSlingLength = b.lowerSlingLength !== undefined ? b.lowerSlingLength : null;
            state.hangerSlingLength = b.hangerSlingLength !== undefined ? b.hangerSlingLength : 2.00;
            if (b.unitSystem) state.unitSystem = b.unitSystem;
            state.slingUserSet = b.slingUserSet;
            state.wllPerLeg = b.wllPerLeg;
            state.legDeltaL = [...b.legDeltaL];
            state.gear = JSON.parse(JSON.stringify(b.gear));
            state.customBeamLengthMode = b.customBeamLengthMode;
            state.rigFit = b.rigFit;
            state.holdCableLength = b.holdCableLength;
            state.heldCableL0 = b.heldCableL0 ? { ...b.heldCableL0 } : null;

            if (typeof syncSlingSlidersFromState === 'function') syncSlingSlidersFromState();
            else {
                const inpSlingL = document.getElementById('inp-slingL');
                if (inpSlingL) inpSlingL.value = state.slingLength;
                const vSlingL = document.getElementById('v-slingL');
                if (vSlingL) vSlingL.textContent = state.slingLength.toFixed(1);

                const inpWll = document.getElementById('inp-wll');
                if (inpWll) inpWll.value = state.wllPerLeg;
                const vWll = document.getElementById('v-wll');
                if (vWll) vWll.textContent = state.wllPerLeg.toFixed(1);
            }

            syncRigFitButton();
            closeGearEditor();

            // 5. Restore Crane & World Environment
            state.craneType = b.craneType;
            state.slewDeg = b.slewDeg;
            phy.slewRate = 0;
            state.sceneId = b.sceneId;
            state.groundId = b.groundId;

            // 6. Restore Orientation & Pull
            state.cargoYawDeg = b.cargoYawDeg;
            state.cargoPitchTrimDeg = b.cargoPitchTrimDeg;
            state.cargoRollTrimDeg = b.cargoRollTrimDeg;
            state.pullAzimuthDeg = b.pullAzimuthDeg;
            state.pullRadius = b.pullRadius;
            state.spreaderYawDeg = b.spreaderYawDeg || 0;
            state.spreaderAlignWithCargo = Boolean(b.spreaderAlignWithCargo);
            state.hookSwivelEnabled = b.hookSwivelEnabled !== false;
            if (b.displayOptions) {
                state.displayOptions = { ...b.displayOptions };
                if (typeof syncDisplayOptionsUI === 'function') syncDisplayOptionsUI();
            }
            syncOrientationAndPullUI();

            // 7. Reset Damages & Velocities
            phy.damagePct = 0;
            if (phy.cargoVel) phy.cargoVel.set(0, 0, 0);
            if (phy.cargoOmega) phy.cargoOmega.set(0, 0, 0);
            if (phy.cargoQuat) phy.cargoQuat.identity();
            if (phy.cargoPos) { phy.cargoPos.x = 0; phy.cargoPos.z = 0; }
            if (phy.hookVel) phy.hookVel.set(0, 0, 0);
            phy.autoHoistActive = false;
            phy.hoistSpeed = 0;

            // 8. Rebuild visual assemblies
            buildCraneVehicle();
            buildWorld();
            rebuildCargoAndRig(false);

            // 9. Sync store cards active state
            document.querySelectorAll('#cargo-library .card-btn').forEach(c => c.classList.toggle('active', c.dataset.cargo === state.cargoType));
            document.querySelectorAll('#beam-store .card-btn').forEach(c => c.classList.toggle('active', c.dataset.beam === state.beamType));
            document.querySelectorAll('#sling-store .card-btn').forEach(c => c.classList.toggle('active', c.dataset.sling === state.slingType));
            document.querySelectorAll('#hw-store .card-btn').forEach(c => c.classList.toggle('active', c.dataset.hw === state.hwType));
            document.querySelectorAll('#crane-store .card-btn').forEach(c => c.classList.toggle('active', c.dataset.crane === state.craneType));
            document.querySelectorAll('#scene-store .card-btn').forEach(c => c.classList.toggle('active', c.dataset.scene === state.sceneId));
            document.querySelectorAll('#ground-store .card-btn').forEach(c => c.classList.toggle('active', c.dataset.ground === state.groundId));

            // 10. Restore Pose (Pre-lift ground vs Mid-air suspended)
            if (b.isSuspended && b.cargoPos && b.cargoQuat) {
                state.poseLock = Boolean(b.poseLock);
                phy.cargoPos.copy(b.cargoPos);
                phy.cargoQuat.copy(b.cargoQuat);
                phy.groundClearance = b.groundClearance || 0;
                if (b.hookTarget) phy.hookTarget.copy(b.hookTarget);
                if (b.hookPos) phy.hookPos.copy(b.hookPos);
                if (b.beamPoses && phy.beams) {
                    b.beamPoses.forEach(bp => {
                        const bm = phy.beams.find(m => m.id === bp.id);
                        if (bm) { bm.x.copy(bp.x); bm.q.copy(bp.q); bm.v.set(0, 0, 0); bm.w.set(0, 0, 0); }
                    });
                }
                syncPoseLockUI();
                const inpHookY = document.getElementById('inp-hook-y');
                if (inpHookY) inpHookY.value = phy.hookTarget.y;
                const vHookY = document.getElementById('val-hook-y');
                if (vHookY) vHookY.textContent = phy.hookTarget.y.toFixed(1) + 'm';
                syncCableRest(false);
                applyBeamVisuals();
            } else {
                resetToInitialPreLiftState();
                if (b.hookTarget) {
                    phy.hookTarget.copy(b.hookTarget);
                    phy.hookPos.copy(b.hookPos || b.hookTarget);
                    const inpHookY = document.getElementById('inp-hook-y');
                    if (inpHookY) inpHookY.value = phy.hookTarget.y;
                    const vHookY = document.getElementById('val-hook-y');
                    if (vHookY) vHookY.textContent = phy.hookTarget.y.toFixed(1) + 'm';
                }
            }

            if (typeof simAudio !== 'undefined' && simAudio.playClack) {
                simAudio.playClack(1.0);
            }

            const status = document.getElementById('sim-status-text');
            if (status) {
                status.textContent = state.lang === 'en'
                    ? (b.isSuspended ? '🔄 Reset to suspended pose' : '🔄 Reset to baseline pose')
                    : (b.isSuspended ? '🔄 Đã khôi phục mốc lơ lửng' : '🔄 Đã khôi phục mốc ban đầu');
            }
        }

        // Resets ALL Cargo, LP1-LP4, CoG, Rigging Gear & Crane parameters back to factory default
        function resetAllToFactoryDefaults() {
            state.slingType = 'wire';
            state.hwType = 'bow_shackle';
            state.slingLength = 8.0;
            state.upperSlingLength = 8.0;
            state.lowerSlingLength = 2.0;
            state.hangerSlingLength = 2.0;
            state.cableAdjustMode = false;
            state.unitSystem = 'metric';
            state.slingUserSet = true;
            state.weightUserSet = false;
            phy.damagePct = 0;
            phy.hookPos.set(0, 10.87, 0);
            phy.hookTarget.set(0, 10.87, 0);
            phy.hookVel.set(0, 0, 0);
            phy.hoistSpeed = 0;
            if (phy.cargoVel) phy.cargoVel.set(0, 0, 0);
            if (phy.cargoOmega) phy.cargoOmega.set(0, 0, 0);
            if (phy.cargoQuat) phy.cargoQuat.identity();
            if (phy.cargoPos) { phy.cargoPos.x = 0; phy.cargoPos.z = 0; }
            // Elastic hoist / wind field start from rest
            if (phy.hoist && typeof resetHoistDynamicState === 'function') {
                resetHoistDynamicState(phy.hoist);
                phy.hoist.kin.copy(phy.hookPos);
                phy.hoist.dafPeak = 1;
            }
            if (phy.windField) { phy.windField.u = 0; phy.windField.v = 0; phy.windField.w = 0; }
            state.wllPerLeg = 15.0;
            state.gear = freshGear();
            closeGearEditor();
            state.lugElevPreset = 'top';
            state.selectedLP = 'all';
            state.legDeltaL = [0, 0, 0, 0];
            state.cargoYawDeg = 0;
            state.cargoPitchTrimDeg = 0;
            state.cargoRollTrimDeg = 0;
            state.pullAzimuthDeg = 0;
            state.pullRadius = 0;
            state.poseLock = true;
            state.sceneId = 'studio';
            state.groundId = 'flat';
            state.customBeamLengthMode = false;
            state.rigFit = 'fixed';
            state.holdCableLength = false;
            state.heldCableL0 = null;
            syncRigFitButton();
            state.slewDeg = 0;
            phy.slewRate = 0;
            syncOrientationAndPullUI();
            syncPoseLockUI();

            if (typeof syncSlingSlidersFromState === 'function') syncSlingSlidersFromState();
            else {
                const inpSlingL = document.getElementById('inp-slingL');
                if (inpSlingL) inpSlingL.value = 3.8;
                const vSlingL = document.getElementById('v-slingL');
                if (vSlingL) vSlingL.textContent = '3.8';
                const inpWll = document.getElementById('inp-wll');
                if (inpWll) inpWll.value = 15.0;
                const vWll = document.getElementById('v-wll');
                if (vWll) vWll.textContent = '15.0';
            }

            applyStartupAssemblyPreset();
            document.querySelectorAll('#sling-store .card-btn').forEach(c => c.classList.toggle('active', c.dataset.sling === 'wire'));
            document.querySelectorAll('#hw-store .card-btn').forEach(c => c.classList.toggle('active', c.dataset.hw === 'bow_shackle'));

            buildCraneVehicle();
            buildWorld();
            document.querySelectorAll('#scene-store .card-btn').forEach(c => c.classList.toggle('active', c.dataset.scene === 'studio'));
            document.querySelectorAll('#ground-store .card-btn').forEach(c => c.classList.toggle('active', c.dataset.ground === 'flat'));
            selectLPTab('all');
            rebuildCargoAndRig(true);
            resetToInitialPreLiftState();
            document.getElementById('sim-status-text').textContent = '🧹 Đã Reset về mặc định';
        }

        function autoPositionHookForLift(desiredClearance) {
            const { beamType, cogX, cogZ } = state;
            const spec = getRigSpec();
            let worldLugY = 0;
            state.lugs.forEach(p => {
                worldLugY += p.clone().applyQuaternion(phy.cargoQuat).add(phy.cargoPos).y;
            });
            worldLugY /= Math.max(1, state.lugs.length);

            const lugBoreY = worldLugY + 0.12;
            const { spanX, spanZ } = getLPBoundingSpan();
            let horizU = Math.max(0.35, spanX / 2);
            if (beamType === 'none') {
                const lug = spanBase();
                horizU = Math.max(0.35, Math.hypot(lug.spanX / 2, lug.spanZ / 2));
            } else if (beamType === 'basket') {
                horizU = Math.max(0.35, spanZ / 2);
            } else if (beamType === 'container_spreader') {
                // Headblock sheave landings — NOT full twistlock span (that made upperDrop = 0).
                horizU = Math.max(0.35, Math.hypot(0.55, 0.35));
            } else if (beamType === 'frame' || customBeamMeshes[beamType]) {
                horizU = Math.max(0.35, Math.hypot(spanX / 2, spanZ / 2));
            }

            // Compute actual vertical drops from active XPBD cable rest lengths (c.L0) + 3D beam lug separation
            const legCables = (phy.cables || []).filter(c => c.role === 'leg');
            const upperCables = (phy.cables || []).filter(c => c.role === 'upper');
            const hangerCables = (phy.cables || []).filter(c => c.role === 'hanger');
            const stsDirectLift = beamType === 'container_spreader'
                && (typeof isStsDirectAttach === 'function' ? isStsDirectAttach() : (state.stsAttachMode || 'direct') !== 'cable');

            let lowerDropActual = spec.lowerDrop;
            if (legCables.length) {
                lowerDropActual = 0;
                legCables.forEach(c => {
                    const hL = beamType === 'none' ? horizU : lowerPlanOffset(c.index || 0);
                    const floor = stsDirectLift ? 0.002 : 0.04;
                    const d = Math.sqrt(Math.max(floor, c.L0 * c.L0 - hL * hL));
                    if (d > lowerDropActual) lowerDropActual = d;
                });
            }
            if (stsDirectLift) lowerDropActual = Math.min(lowerDropActual, 0.08);

            let upperDropActual = 0;
            let beamStructuralSep = 0;
            if (beamType !== 'none') {
                upperDropActual = Math.max(0.2, spec.topDrop - (spec.mast || 0));
                if (upperCables.length) {
                    upperDropActual = 0;
                    upperCables.forEach(c => {
                        const d = Math.sqrt(Math.max(0.04, c.L0 * c.L0 - horizU * horizU));
                        if (d > upperDropActual) upperDropActual = d;
                    });
                }

                if (beamType === 'spreader') beamStructuralSep = 0.68;
                else if (beamType === 'lifting_beam') beamStructuralSep = 0.72;
                else if (beamType === 'frame') beamStructuralSep = 0.60;
                else if (beamType === 'basket') beamStructuralSep = 0.52;
                else if (beamType === 'container_spreader') beamStructuralSep = stsDirectLift ? 0.55 : 0.80;
                else if (beamType === 'cascaded' || beamType === 'modular_truss') {
                    let hangerDrop = spec.mast || 1.0;
                    if (hangerCables.length) {
                        hangerDrop = Math.max(...hangerCables.map(c => c.L0));
                    }
                    beamStructuralSep = 0.68 + 0.48 + hangerDrop;
                } else {
                    beamStructuralSep = 0.68 + (spec.mast || 0);
                }
            }

            const tautMasterY = lugBoreY + lowerDropActual + beamStructuralSep + upperDropActual;
            const targetY = THREE.MathUtils.clamp(tautMasterY - HOOK_MASTER_OFFSET_Y + desiredClearance, 2.8, 30.0);
            // Smoothly hoist hook at realistic crane winch speed instead of jumping
            const azRad = THREE.MathUtils.degToRad(state.pullAzimuthDeg);
            const pullOffX = state.pullRadius * Math.cos(azRad);
            const pullOffZ = state.pullRadius * Math.sin(azRad);
            const rotatedCoG = new THREE.Vector3(cogX, 0, cogZ).applyAxisAngle(new THREE.Vector3(0, 1, 0), THREE.MathUtils.degToRad(state.cargoYawDeg));

            phy.autoHoistActive = true;
            phy.hookTarget.set(rotatedCoG.x + pullOffX, targetY, rotatedCoG.z + pullOffZ);
            syncOrientationAndPullUI();
        }

        function syncOrientationAndPullUI() {
            const roundedYaw = Math.round(state.cargoYawDeg);
            const inpCargoYaw = document.getElementById('inp-cargoYaw');
            if (inpCargoYaw) inpCargoYaw.value = state.cargoYawDeg;
            const vCargoYaw = document.getElementById('v-cargoYaw');
            if (vCargoYaw) vCargoYaw.textContent = roundedYaw;

            // Header: Cargo Heading & Yaw controls
            const hdrInpYaw = document.getElementById('hdr-inp-cargo-yaw');
            if (hdrInpYaw) hdrInpYaw.value = roundedYaw;

            // Tab 1: Ground Cargo Heading & Yaw controls
            const inpGroundYaw = document.getElementById('inp-groundCargoYaw');
            if (inpGroundYaw) inpGroundYaw.value = roundedYaw;
            const vGroundYaw = document.getElementById('v-groundCargoYaw');
            if (vGroundYaw) vGroundYaw.textContent = roundedYaw;

            // Calculate skew angle relative to spreader beam
            const spreaderYaw = state.spreaderAlignWithCargo ? state.cargoYawDeg : (state.spreaderYawDeg || 0);
            let skewDeg = Math.abs(state.cargoYawDeg - spreaderYaw) % 360;
            if (skewDeg > 180) skewDeg = 360 - skewDeg;
            const vSkew = document.getElementById('v-skewAngle');
            if (vSkew) {
                vSkew.textContent = `${skewDeg.toFixed(1)}°`;
                vSkew.className = skewDeg > 0.1 ? 'text-amber-400 font-bold text-xs' : 'text-slate-400 font-bold text-xs';
            }

            // Sync Tab 1 Quick presets active state
            document.querySelectorAll('.ground-yaw-quick').forEach(b => {
                const py = parseInt(b.dataset.yaw, 10);
                const isAct = (py === roundedYaw);
                b.classList.toggle('active', isAct);
                if (isAct) {
                    b.classList.remove('bg-slate-800', 'text-slate-300', 'border-slate-700');
                    b.classList.add('bg-amber-600', 'text-white', 'border-amber-400', 'shadow');
                } else {
                    b.classList.remove('bg-amber-600', 'text-white', 'border-amber-400', 'shadow');
                    b.classList.add('bg-slate-800', 'text-slate-300', 'border-slate-700');
                }
            });

            // Sync Spreader alignment buttons
            const btnFixed = document.getElementById('btn-spreader-align-fixed');
            const btnFollow = document.getElementById('btn-spreader-align-follow');
            if (btnFixed && btnFollow) {
                if (state.spreaderAlignWithCargo) {
                    btnFollow.className = 'py-0.5 px-2 rounded text-[10px] font-bold bg-sky-600 text-white border border-sky-400 shadow transition';
                    btnFixed.className = 'py-0.5 px-2 rounded text-[10px] font-bold bg-slate-800 text-slate-300 border border-slate-700 hover:text-white transition';
                } else {
                    btnFixed.className = 'py-0.5 px-2 rounded text-[10px] font-bold bg-sky-600 text-white border border-sky-400 shadow transition';
                    btnFollow.className = 'py-0.5 px-2 rounded text-[10px] font-bold bg-slate-800 text-slate-300 border border-slate-700 hover:text-white transition';
                }
            }

            const btnSwivelOn = document.getElementById('btn-hook-swivel-on');
            const btnSwivelOff = document.getElementById('btn-hook-swivel-off');
            if (btnSwivelOn && btnSwivelOff) {
                const swivel = state.hookSwivelEnabled !== false;
                btnSwivelOn.className = swivel
                    ? 'py-0.5 px-2 rounded text-[10px] font-bold bg-sky-600 text-white border border-sky-400 shadow transition'
                    : 'py-0.5 px-2 rounded text-[10px] font-bold bg-slate-800 text-slate-300 border border-slate-700 hover:text-white transition';
                btnSwivelOff.className = !swivel
                    ? 'py-0.5 px-2 rounded text-[10px] font-bold bg-sky-600 text-white border border-sky-400 shadow transition'
                    : 'py-0.5 px-2 rounded text-[10px] font-bold bg-slate-800 text-slate-300 border border-slate-700 hover:text-white transition';
            }

            const inpCargoPitch = document.getElementById('inp-cargoPitch');
            if (inpCargoPitch) inpCargoPitch.value = state.cargoPitchTrimDeg;
            const vCargoPitch = document.getElementById('v-cargoPitch');
            if (vCargoPitch) vCargoPitch.textContent = state.cargoPitchTrimDeg.toFixed(1);

            const inpCargoRoll = document.getElementById('inp-cargoRoll');
            if (inpCargoRoll) inpCargoRoll.value = state.cargoRollTrimDeg;
            const vCargoRoll = document.getElementById('v-cargoRoll');
            if (vCargoRoll) vCargoRoll.textContent = state.cargoRollTrimDeg.toFixed(1);

            const inpPullAzimuth = document.getElementById('inp-pullAzimuth');
            if (inpPullAzimuth) inpPullAzimuth.value = state.pullAzimuthDeg;
            const vPullAzimuth = document.getElementById('v-pullAzimuth');
            if (vPullAzimuth) vPullAzimuth.textContent = Math.round(state.pullAzimuthDeg);

            const inpPullRadius = document.getElementById('inp-pullRadius');
            if (inpPullRadius) inpPullRadius.value = state.pullRadius;
            const vPullRadius = document.getElementById('v-pullRadius');
            if (vPullRadius) vPullRadius.textContent = state.pullRadius.toFixed(2);

            const inpHookX = document.getElementById('inp-hookX');
            if (inpHookX) inpHookX.value = phy.hookTarget.x.toFixed(2);
            const vHookX = document.getElementById('v-hookX');
            if (vHookX) vHookX.textContent = phy.hookTarget.x.toFixed(2);

            const inpHookZ = document.getElementById('inp-hookZ');
            if (inpHookZ) inpHookZ.value = phy.hookTarget.z.toFixed(2);
            const vHookZ = document.getElementById('v-hookZ');
            if (vHookZ) vHookZ.textContent = phy.hookTarget.z.toFixed(2);

            const lblPullVec = document.getElementById('lbl-pull-vec');
            if (lblPullVec) {
                lblPullVec.textContent = state.pullRadius > 0.05
                    ? L(`Offset ${state.pullRadius.toFixed(2)} m @ ${Math.round(state.pullAzimuthDeg)}°`, `Lệch ${state.pullRadius.toFixed(2)} m @ ${Math.round(state.pullAzimuthDeg)}°`)
                    : L('Vertical (0°)', 'Thẳng đứng (0°)');
            }

            if (typeof updateCargoGroundAngleIndicator3D === 'function') {
                updateCargoGroundAngleIndicator3D();
            }
        }

        // Exact Geometric Turnbuckle Solver for Arbitrary LP1-LP4 & 3D CoG
        function autoLevelTurnbuckles() {
            const { cogX, cogZ, lugs, beamType, slingLength } = state;
            const { spanX, spanZ } = getLPBoundingSpan();
            const spec = (typeof getRigSpec === 'function') ? getRigSpec() : null;

            // Target a level cargo: equalize geometric path lengths, then write
            // per-leg L0 (not only turnbuckle delta) so tilted loads rebalance.
            const nominalV = (state.lowerSlingLength != null ? state.lowerSlingLength : (spec ? spec.lower : slingLength)) * 0.80;
            const dists = lugs.map((p, i) => {
                if (beamType === 'none') {
                    const dx = p.x - cogX;
                    const dz = p.z - cogZ;
                    const dy = nominalV - (p.y - lugs[0].y);
                    return Math.sqrt(dx * dx + dz * dz + dy * dy);
                } else {
                    const sx = (i === 0 || i === 3) ? spanX / 2 : -spanX / 2;
                    const sz = (i === 0 || i === 1) ? spanZ / 2 : -spanZ / 2;
                    const dx = p.x - sx - cogX * 0.65;
                    const dz = (beamType === 'spreader' || beamType === 'lifting_beam') ? p.z : (p.z - sz - cogZ * 0.65);
                    const dy = nominalV * 0.6 - (p.y - lugs[0].y);
                    return Math.sqrt(dx * dx + dz * dz + dy * dy);
                }
            });

            const avgD = dists.reduce((a, b) => a + b, 0) / Math.max(1, dists.length);
            state.legDeltaL = dists.map(d => THREE.MathUtils.clamp(d - avgD, -1.5, 1.5));

            // Recalculate leg cable lengths so the shortest/longest match geometry
            const baseLower = state.lowerSlingLength != null
                ? state.lowerSlingLength
                : (spec ? spec.lower : Math.max(2, avgD));
            if (state.gear && state.gear.legs) {
                state.gear.legs.forEach((leg, i) => {
                    if (!leg) return;
                    const len = Math.max(0.4, +(baseLower + (state.legDeltaL[i] || 0)).toFixed(2));
                    leg.lengthM = len;
                    leg.userSet = true;
                });
            }
            // Keep tier mean as the tier setpoint (even integer when near band)
            const meanLeg = dists.length
                ? dists.reduce((a, b) => a + b, 0) / dists.length
                : baseLower;
            if (beamType !== 'none') {
                let evenMean = Math.round(meanLeg / 2) * 2;
                if (evenMean < 2) evenMean = 2;
                if (Math.abs(meanLeg - evenMean) < 0.35) state.lowerSlingLength = evenMean;
                else state.lowerSlingLength = +meanLeg.toFixed(2);
            } else {
                state.upperSlingLength = +meanLeg.toFixed(2);
                state.slingLength = state.upperSlingLength;
            }
            if (state.heldCableL0) {
                state.heldCableL0.leg = [];
                state.heldCableL0.upper = [];
            }
            state.slingUserSet = true;

            // Clear cargo trim so solver starts from a level attitude
            state.cargoPitchTrimDeg = 0;
            state.cargoRollTrimDeg = 0;

            computeRiggingMassBreakdown();
            if (typeof syncCableRest === 'function') syncCableRest(false);
            rebuildSpreaderVisuals();
            syncLPSlidersFromState();
            if (typeof syncSlingSlidersFromState === 'function') syncSlingSlidersFromState();
            autoPositionHookForLift(0.85);
            const status = document.getElementById('sim-status-text');
            if (status) {
                status.textContent = state.lang === 'en'
                    ? '⚖️ Auto-balanced: cable lengths recalculated for level cargo'
                    : '⚖️ Auto cân bằng: đã tính lại chiều dài các sợi cáp theo kiện ngang';
            }
        }

        function markCableAdjustMode() {
            state.cableAdjustMode = true;
            const row = document.getElementById('row-cable-auto-balance');
            if (row) row.classList.remove('hidden');
        }

        function syncCableAutoBalanceVisibility() {
            const row = document.getElementById('row-cable-auto-balance');
            if (!row) return;
            if (state.cableAdjustMode) row.classList.remove('hidden');
            else row.classList.add('hidden');
        }

        function hasCascadedHangerTier() {
            const t = state.beamType;
            return t === 'cascaded' || t === 'modular_truss' || t === 'inline4' || t === 'inline8' || t === 'spatial8';
        }

        // --- 12. UI EVENT BINDINGS & COLLAPSIBLE PANELS ---
        function selectLPTab(lpKey) {
            state.selectedLP = lpKey;
            document.querySelectorAll('#lp-tabs button').forEach(b => {
                const isAct = (b.dataset.lp === lpKey);
                b.className = isAct
                    ? 'py-1 rounded text-[10px] font-mono font-bold bg-sky-600 text-white border border-sky-400'
                    : 'py-1 rounded text-[10px] font-mono font-bold bg-slate-800 text-slate-300 border border-slate-700';
            });
            rebuildCargoAndRig(false);
        }

        function syncLPSlidersFromState() {
            const sel = state.selectedLP;
            const refIdx = (sel === 'all') ? 0 : parseInt(sel, 10);
            const lp = state.lugs[refIdx];

            document.getElementById('lbl-lp-x').textContent = (sel === 'all') ? L('Longitudinal |X| (all 4):', 'Khoảng cách dọc |X| (cả 4):') : L(`LP${refIdx + 1} longitudinal X:`, `Tọa độ dọc LP${refIdx + 1} (X):`);
            document.getElementById('lbl-lp-z').textContent = (sel === 'all') ? L('Transverse |Z| (all 4):', 'Khoảng cách ngang |Z| (cả 4):') : L(`LP${refIdx + 1} transverse Z:`, `Tọa độ ngang LP${refIdx + 1} (Z):`);

            const xVal = (sel === 'all') ? Math.abs(lp.x) : lp.x;
            const zVal = (sel === 'all') ? Math.abs(lp.z) : lp.z;

            const inpX = document.getElementById('inp-lpX');
            inpX.min = (sel === 'all') ? '0.2' : (-state.L / 2).toFixed(2);
            inpX.max = (state.L / 2).toFixed(2);
            inpX.value = xVal;
            document.getElementById('v-lpX').textContent = xVal.toFixed(2);

            const inpZ = document.getElementById('inp-lpZ');
            inpZ.min = (sel === 'all') ? '0.2' : (-state.W / 2).toFixed(2);
            inpZ.max = (state.W / 2).toFixed(2);
            inpZ.value = zVal;
            document.getElementById('v-lpZ').textContent = zVal.toFixed(2);

            const inpY = document.getElementById('inp-lpY');
            inpY.min = (-state.H / 2 + 0.1).toFixed(2);
            inpY.max = (state.H / 2).toFixed(2);
            inpY.value = lp.y;
            document.getElementById('v-lpY').textContent = lp.y.toFixed(2);

            const dL = state.legDeltaL[refIdx];
            document.getElementById('inp-lpDeltaL').value = dL;
            document.getElementById('v-lpDeltaL').textContent = (dL >= 0 ? '+' : '') + dL.toFixed(2);
        }

        function syncOogCargoUI(initDefaults = false) {
            const panel = document.getElementById('oog-cargo-panel');
            if (!panel) return;
            const isOpenTop = state.cargoType === 'opentop' || state.cargoType === 'opentop40';
            const isFlatRack = state.cargoType === 'flatrack' || state.cargoType === 'flatrack20';
            const isPlatform = state.cargoType === 'platform' || state.cargoType === 'platform20';
            if (!isOpenTop && !isFlatRack && !isPlatform) {
                panel.classList.add('hidden');
                return;
            }
            panel.classList.remove('hidden');

            if (initDefaults) {
                state.oogHasCargo = true;
                if (isOpenTop) {
                    state.oogTarp = true;
                    // OTR upright: L/W inside bay; H=Ø may exceed roof but must still fit in length
                    state.oogCargoL = Math.round(state.L * 0.86 * 20) / 20;
                    state.oogCargoW = Math.round(Math.min(state.W - 0.42, 0.95) * 20) / 20;
                    // ~2 tires in 20ft / 3 in 40ft, slight over-height, never past ends
                    const fitN = state.L > 9 ? 3 : 2;
                    const maxDiaByL = (state.L - 0.44 - 0.08 * (fitN - 1)) / fitN;
                    state.oogCargoH = Math.round(Math.min(state.H * 1.18, maxDiaByL) * 20) / 20;
                } else if (isPlatform) {
                    state.oogTarp = false;
                    state.oogCargoL = Math.round(state.L * 0.72 * 10) / 10;
                    state.oogCargoW = Math.round(Math.max(state.W * 1.15, 2.8) * 20) / 20;
                    state.oogCargoH = Math.round(Math.max(1.8, state.H * 3.2) * 20) / 20;
                } else {
                    state.oogTarp = false;
                    state.oogCargoL = Math.round(state.L * 0.72 * 10) / 10;
                    state.oogCargoW = Math.round(state.W * 1.28 * 20) / 20;
                    state.oogCargoH = Math.round(state.H * 1.08 * 20) / 20;
                }
            }

            const titleEl = document.getElementById('lbl-oog-title');
            if (titleEl) {
                titleEl.textContent = isOpenTop
                    ? L('2B. Open Top Cargo & Tarpaulin', '2B. Hàng Open Top & Vải Bạt Nóc')
                    : (isPlatform
                        ? L('2B. Platform Deck Cargo (OOG)', '2B. Hàng Trên Sàn Platform (OOG)')
                        : L('2B. Flat Rack OOG Cargo', '2B. Hàng Quá Khổ Flat Rack (OOG)'));
            }

            const btnCargo = document.getElementById('btn-oog-has-cargo');
            if (btnCargo) {
                btnCargo.textContent = state.oogHasCargo
                    ? L('📦 Cargo Loaded: ON', '📦 Có Hàng: BẬT')
                    : L('📦 Empty Container (Tare)', '📦 Không Hàng (Rỗng)');
                btnCargo.className = state.oogHasCargo
                    ? 'flex-1 py-1 px-2 rounded text-[10px] font-bold bg-emerald-600 text-white border border-emerald-400 shadow'
                    : 'flex-1 py-1 px-2 rounded text-[10px] font-bold bg-slate-800 text-slate-300 border border-slate-600';
            }

            const btnTarp = document.getElementById('btn-oog-tarp');
            if (btnTarp) {
                btnTarp.classList.toggle('hidden', !isOpenTop);
                btnTarp.textContent = state.oogTarp
                    ? L('⛺ Tarpaulin Cover: ON', '⛺ Phủ Bạt Nóc: BẬT')
                    : L('⛺ Open Roof (Inspect)', '⛺ Mở Bạt (Xem Hàng)');
                btnTarp.className = (isOpenTop ? '' : 'hidden ') + (state.oogTarp
                    ? 'flex-1 py-1 px-2 rounded text-[10px] font-bold bg-sky-600 text-white border border-sky-400 shadow'
                    : 'flex-1 py-1 px-2 rounded text-[10px] font-bold bg-slate-800 text-slate-300 border border-slate-600');
            }

            const dimsWrap = document.getElementById('oog-dims-wrap');
            if (dimsWrap) {
                dimsWrap.classList.toggle('opacity-40', !state.oogHasCargo);
                dimsWrap.classList.toggle('pointer-events-none', !state.oogHasCargo);
            }

            const inpH = document.getElementById('inp-oogH');
            const inpW = document.getElementById('inp-oogW');
            const inpL = document.getElementById('inp-oogL');
            if (inpH) {
                // OT: Ø may exceed roof, but circular tire still must fit inside bay length
                if (isOpenTop) {
                    const fitN = state.L > 9 ? 3 : 2;
                    const maxDiaByL = (state.L - 0.44 - 0.08 * (fitN - 1)) / fitN;
                    inpH.max = Math.max(state.H * 1.35, maxDiaByL).toFixed(2);
                    if (state.oogCargoH > maxDiaByL) state.oogCargoH = Math.round(maxDiaByL * 100) / 100;
                }
                inpH.value = state.oogCargoH;
                document.getElementById('v-oogH').textContent = state.oogCargoH.toFixed(2);
            }
            if (inpW) {
                // Open Top: never over-width (side walls). FR/Platform may go OOG width.
                const otMaxW = Math.max(0.85, state.W - 0.40);
                inpW.max = isOpenTop ? otMaxW.toFixed(2) : '5.20';
                if (isOpenTop && state.oogCargoW > otMaxW) state.oogCargoW = Math.min(0.95, otMaxW);
                inpW.value = state.oogCargoW;
                document.getElementById('v-oogW').textContent = state.oogCargoW.toFixed(2);
            }
            if (inpL) {
                inpL.max = isOpenTop ? (state.L - 0.40).toFixed(1) : '14.5';
                if (isOpenTop && state.oogCargoL > state.L - 0.40) state.oogCargoL = Math.max(1.5, state.L - 0.40);
                inpL.value = state.oogCargoL;
                document.getElementById('v-oogL').textContent = state.oogCargoL.toFixed(2);
            }

            const badge = document.getElementById('lbl-oog-badge');
            if (badge) {
                if (!state.oogHasCargo) {
                    badge.textContent = L('EMPTY TARE', 'CONT RỖNG');
                    badge.className = 'text-[9px] font-mono font-bold px-1.5 py-0.5 rounded bg-slate-700 text-slate-300 border border-slate-500';
                } else {
                    const deckOffset = isOpenTop ? 0.18 : (isPlatform ? Math.max(0.12, state.H) : 0.40);
                    const overH = (state.oogCargoH + deckOffset) - state.H;
                    const overW = state.oogCargoW - state.W;
                    const overL = state.oogCargoL - state.L;
                    const flags = [];
                    if (overH > 0.04) flags.push(`OH +${overH.toFixed(2)}m`);
                    if (overW > 0.04) flags.push(`OW +${overW.toFixed(2)}m`);
                    if (overL > 0.04) flags.push(`OL +${overL.toFixed(2)}m`);
                    if (flags.length) {
                        badge.textContent = 'OOG: ' + flags.join(' · ');
                        badge.className = 'text-[9px] font-mono font-bold px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/40';
                    } else {
                        badge.textContent = 'IN-GAUGE';
                        badge.className = 'text-[9px] font-mono font-bold px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/40';
                    }
                }
            }
        }

        function syncCoGSlidersFromState() {
            document.getElementById('inp-cogX').value = state.cogX;
            document.getElementById('v-cogX').textContent = state.cogX.toFixed(2);
            document.getElementById('inp-cogZ').value = state.cogZ;
            document.getElementById('v-cogZ').textContent = state.cogZ.toFixed(2);
            document.getElementById('inp-cogY').value = state.cogY;
            document.getElementById('v-cogY').textContent = state.cogY.toFixed(2);
        }

        // --- Cable Lengths (Upper Bridle, Lower Legs, Selected Sling) & Metric/Imperial Conversion ---
        const M_TO_FT = 3.2808399;
        const FT_TO_M = 1 / 3.2808399;

        function isImperial() {
            return state.unitSystem === 'imperial';
        }

        function toDisplayLen(m) {
            if (m == null || isNaN(m)) return 0;
            return isImperial() ? (m * M_TO_FT) : m;
        }

        function fromInputLen(v) {
            if (v == null || isNaN(v)) return 0;
            return isImperial() ? (v * FT_TO_M) : v;
        }

        function getLenUnit() {
            return isImperial() ? 'ft' : 'm';
        }

        function updateUnitDisplayElements() {
            const isImp = isImperial();
            const unitStr = isImp ? 'ft' : 'm';

            const btnUnitHeader = document.getElementById('btn-unit-toggle');
            if (btnUnitHeader) {
                btnUnitHeader.innerHTML = isImp ? '📐 ft (Feet)' : '📏 m (Mét)';
                btnUnitHeader.title = isImp
                    ? (state.lang === 'en' ? 'Switch to Metric (m)' : 'Chuyển sang Hệ Mét (m)')
                    : (state.lang === 'en' ? 'Switch to Imperial (ft)' : 'Chuyển sang Hệ Feet/Inch (ft)');
            }

            const btnUnitPanel = document.getElementById('btn-unit-toggle-panel');
            const txtUnitBadge = document.getElementById('txt-unit-badge');
            if (txtUnitBadge) {
                txtUnitBadge.textContent = isImp ? (state.lang === 'en' ? 'Imperial (ft)' : 'Hệ Feet (ft)') : (state.lang === 'en' ? 'Metric (m)' : 'Hệ Mét (m)');
            }
            if (btnUnitPanel) {
                btnUnitPanel.classList.toggle('!bg-sky-700/60', isImp);
                btnUnitPanel.classList.toggle('!border-sky-400', isImp);
            }

            document.querySelectorAll('.unit-len').forEach(el => {
                el.textContent = unitStr;
            });

            // Adjust ranges & step sizes for Metric vs Imperial based on real physics geometry
            let spec = (typeof getRigSpec === 'function') ? getRigSpec() : null;
            const minUpperM = spec ? spec.minUpper : (isImp ? 3.0 : 1.0);
            const maxUpperM = spec ? spec.maxUpper : (isImp ? 90.0 : 30.0);
            const minLowerM = spec ? spec.minLower : (isImp ? 1.5 : 0.5);
            const maxLowerM = spec ? spec.maxLower : (isImp ? 90.0 : 30.0);

            const minUpper = toDisplayLen(minUpperM);
            const maxUpper = toDisplayLen(maxUpperM);
            const stepUpper = isImp ? 0.1 : 0.05;

            const minLower = toDisplayLen(minLowerM);
            const maxLower = toDisplayLen(maxLowerM);
            const stepLower = isImp ? 0.1 : 0.05;

            const minSel = isImp ? 1.0 : 0.3;
            const maxSel = isImp ? 100.0 : 35.0;
            const stepSel = isImp ? 0.1 : 0.05;

            const absMinUpper = toDisplayLen(0.35);
            const absMinLower = toDisplayLen(0.35);

            const inpUpper = document.getElementById('inp-upperL');
            const numUpper = document.getElementById('num-upperL');
            if (inpUpper) { inpUpper.min = absMinUpper.toFixed(2); inpUpper.max = Math.max(maxUpper, 35.0).toFixed(2); inpUpper.step = stepUpper; }
            if (numUpper) { numUpper.min = absMinUpper.toFixed(2); numUpper.max = Math.max(maxUpper, 50.0).toFixed(2); numUpper.step = stepUpper; }

            const inpLower = document.getElementById('inp-lowerL');
            const numLower = document.getElementById('num-lowerL');
            if (inpLower) { inpLower.min = absMinLower.toFixed(2); inpLower.max = Math.max(maxLower, 35.0).toFixed(2); inpLower.step = stepLower; }
            if (numLower) { numLower.min = absMinLower.toFixed(2); numLower.max = Math.max(maxLower, 50.0).toFixed(2); numLower.step = stepLower; }

            const inpSel = document.getElementById('inp-selectedL');
            const numSel = document.getElementById('num-selectedL');
            if (inpSel) { inpSel.min = minSel; inpSel.max = maxSel; inpSel.step = stepSel; }
            if (numSel) { numSel.min = minSel; numSel.max = maxSel; numSel.step = stepSel; }
        }

        // --- Rigging Topology & International Branching Tree (ASME B30.9, B30.26, DNV-ST-N001) ---
        function getRiggingTopology() {
            const type = state.beamType;
            const isNone = type === 'none';
            const isBasket = type === 'basket';
            const isFrame = type === 'frame' || type === 'container_spreader';
            const isCascade = type === 'cascaded' || type === 'modular_truss'
                || type === 'inline4' || type === 'inline8' || type === 'spatial8';
            const nLugs = (state.lugs && state.lugs.length) ? state.lugs.length : 4;

            const tier1 = [];
            const tier2 = [];
            const hangers = [];

            if (isNone) {
                for (let i = 0; i < nLugs; i++) {
                    tier1.push({
                        id: `L1-${i + 1}`,
                        code: `L1-${i + 1}`,
                        role: 'leg',
                        index: i,
                        tier: 1,
                        titleVi: `Cáp chùm trực tiếp L1-${i + 1} (Móc ➔ Tai cẩu LP${i + 1})`,
                        titleEn: `Direct Sling L1-${i + 1} (Hook ➔ Lug LP${i + 1})`,
                        shortLabel: `L1-${i + 1}`,
                        branch: `LP${i + 1}`
                    });
                }
            } else {
                // Tier 1: Upper Bridles (Hook ➔ Beam)
                if (isBasket) {
                    tier1.push({ id: 'L1-1', code: 'L1-1', role: 'upper', index: 0, tier: 1, titleVi: 'Cáp trên L1-1 (Móc ➔ Dầm Trước - Trái)', titleEn: 'Upper Sling L1-1 (Hook ➔ Front Beam Left)', shortLabel: 'L1-1', branch: 'Dầm Trước-Trái' });
                    tier1.push({ id: 'L1-2', code: 'L1-2', role: 'upper', index: 3, tier: 1, titleVi: 'Cáp trên L1-2 (Móc ➔ Dầm Trước - Phải)', titleEn: 'Upper Sling L1-2 (Hook ➔ Front Beam Right)', shortLabel: 'L1-2', branch: 'Dầm Trước-Phải' });
                    tier1.push({ id: 'L1-3', code: 'L1-3', role: 'upper', index: 1, tier: 1, titleVi: 'Cáp trên L1-3 (Móc ➔ Dầm Sau - Trái)', titleEn: 'Upper Sling L1-3 (Hook ➔ Rear Beam Left)', shortLabel: 'L1-3', branch: 'Dầm Sau-Trái' });
                    tier1.push({ id: 'L1-4', code: 'L1-4', role: 'upper', index: 2, tier: 1, titleVi: 'Cáp trên L1-4 (Móc ➔ Dầm Sau - Phải)', titleEn: 'Upper Sling L1-4 (Hook ➔ Rear Beam Right)', shortLabel: 'L1-4', branch: 'Dầm Sau-Phải' });
                } else if (isFrame) {
                    const cNames = ['Trước-Trái', 'Sau-Trái', 'Sau-Phải', 'Trước-Phải'];
                    const cEn = ['Front-Left', 'Rear-Left', 'Rear-Right', 'Front-Right'];
                    for (let i = 0; i < 4; i++) {
                        tier1.push({
                            id: `L1-${i + 1}`,
                            code: `L1-${i + 1}`,
                            role: 'upper',
                            index: i,
                            tier: 1,
                            titleVi: `Cáp trên L1-${i + 1} (Móc ➔ Khung Góc ${cNames[i]})`,
                            titleEn: `Upper Sling L1-${i + 1} (Hook ➔ Frame Corner ${cEn[i]})`,
                            shortLabel: `L1-${i + 1}`,
                            branch: `Góc ${i + 1}`
                        });
                    }
                } else {
                    tier1.push({ id: 'L1-1', code: 'L1-1', role: 'upper', index: 1, tier: 1, titleVi: 'Cáp trên L1-1 (Móc ➔ Dầm Trái)', titleEn: 'Upper Sling L1-1 (Hook ➔ Beam Left)', shortLabel: 'L1-1', branch: 'Dầm Trái' });
                    tier1.push({ id: 'L1-2', code: 'L1-2', role: 'upper', index: 0, tier: 1, titleVi: 'Cáp trên L1-2 (Móc ➔ Dầm Phải)', titleEn: 'Upper Sling L1-2 (Hook ➔ Beam Right)', shortLabel: 'L1-2', branch: 'Dầm Phải' });
                }

                if (isCascade) {
                    hangers.push({ id: 'H1', code: 'H1', role: 'hanger', index: 0, tier: 2, titleVi: 'Cáp treo dầm H1 (Dầm Chính ➔ Dầm Phụ 1)', titleEn: 'Hanger H1 (Top Beam ➔ Sub-beam 1)', shortLabel: 'H1', branch: 'Dầm Phụ 1' });
                    hangers.push({ id: 'H2', code: 'H2', role: 'hanger', index: 1, tier: 2, titleVi: 'Cáp treo dầm H2 (Dầm Chính ➔ Dầm Phụ 2)', titleEn: 'Hanger H2 (Top Beam ➔ Sub-beam 2)', shortLabel: 'H2', branch: 'Dầm Phụ 2' });
                    if (type === 'spatial8' || type === 'inline8') {
                        hangers.push({ id: 'H3', code: 'H3', role: 'hanger', index: 2, tier: 2, titleVi: 'Cáp treo dầm H3', titleEn: 'Hanger H3', shortLabel: 'H3', branch: 'Dầm Phụ 3' });
                        hangers.push({ id: 'H4', code: 'H4', role: 'hanger', index: 3, tier: 2, titleVi: 'Cáp treo dầm H4', titleEn: 'Hanger H4', shortLabel: 'H4', branch: 'Dầm Phụ 4' });
                    }
                }

                // Tier 2: Lower Legs (Beam ➔ Cargo Lugs)
                for (let i = 0; i < nLugs; i++) {
                    let parentBranch = '';
                    if (isBasket) {
                        parentBranch = (i === 0 || i === 3) ? 'Nhánh Dầm Trước' : 'Nhánh Dầm Sau';
                    } else if (isFrame) {
                        parentBranch = `Khung Góc ${i + 1}`;
                    } else {
                        parentBranch = (i === 0 || i === 3) ? 'Đầu Dầm Trái' : 'Đầu Dầm Phải';
                    }
                    tier2.push({
                        id: `L2-${i + 1}`,
                        code: `L2-${i + 1}`,
                        role: 'leg',
                        index: i,
                        tier: 2,
                        titleVi: `Cáp dưới L2-${i + 1} (${parentBranch} ➔ Tai cẩu LP${i + 1})`,
                        titleEn: `Lower Leg L2-${i + 1} (${parentBranch} ➔ Lug LP${i + 1})`,
                        shortLabel: `L2-${i + 1}`,
                        branch: `LP${i + 1}`
                    });
                }
            }

            return { tier1, tier2, hangers };
        }

        // --- Hardware Bill of Materials (BOM) Calculator ---
        function getRiggingBOM() {
            const type = state.beamType;
            const isNone = type === 'none';
            const isBasket = type === 'basket';
            const isFrame = type === 'frame' || type === 'container_spreader';
            const isCascade = type === 'cascaded' || type === 'modular_truss'
                || type === 'inline4' || type === 'inline8' || type === 'spatial8';
            const nLugs = (state.lugs && state.lugs.length) ? state.lugs.length : 4;

            const tier1Count = isNone ? nLugs : (isBasket || isFrame ? 4 : 2);
            const tier2Count = isNone ? 0 : nLugs;
            const hangerCount = !isCascade ? 0 : ((type === 'spatial8' || type === 'inline8') ? 4 : 2);
            const totalSlings = tier1Count + tier2Count + hangerCount;

            const topShackles = isNone ? nLugs : (isBasket || isFrame ? 4 : 2);
            const spreaderTopShackles = isNone ? 0 : (isCascade ? 4 : (isBasket || isFrame ? 4 : 2));
            const spreaderBottomShackles = isNone ? 0 : nLugs;
            const lugShackles = nLugs;
            const totalShackles = topShackles + spreaderTopShackles + spreaderBottomShackles + lugShackles;

            const beamCount = isNone ? 0 : (isBasket ? 2 : (isCascade ? 3 : 1));
            const beamDesc = isNone
                ? 'Không dùng dầm (Direct Bridle)'
                : (isBasket ? '2 Dầm ngáng đôi (Trước & Sau)' : (isCascade ? '3 Dầm ngáng (1 Chính + 2 Phụ)' : (isFrame ? '1 Khung ngáng 4 góc' : '1 Dầm ngáng Spreader')));
            const beamDescEn = isNone
                ? 'Direct Bridle (No Beam)'
                : (isBasket ? '2 Spreader Beams (Front & Rear)' : (isCascade ? '3 Cascaded Beams (1 Main + 2 Sub)' : (isFrame ? '1 Spreader Frame (4-point)' : '1 Spreader Beam')));

            const turnbuckleCount = (state.legDeltaL || []).filter(d => Math.abs(d) > 0.001).length;

            return {
                tier1Count,
                tier2Count,
                hangerCount,
                totalSlings,
                topShackles,
                spreaderTopShackles,
                spreaderBottomShackles,
                lugShackles,
                totalShackles,
                beamCount,
                beamDesc,
                beamDescEn,
                turnbuckleCount
            };
        }

        function updateRiggingBOMUI() {
            const bom = getRiggingBOM();
            const isEn = state.lang === 'en';

            const elHookCount = document.getElementById('bom-hook-count');
            const elHookDesc = document.getElementById('bom-hook-desc');
            const elSlingCount = document.getElementById('bom-sling-count');
            const elSlingDesc = document.getElementById('bom-sling-desc');
            const elShackleCount = document.getElementById('bom-shackle-count');
            const elShackleDesc = document.getElementById('bom-shackle-desc');
            const elBeamCount = document.getElementById('bom-beam-count');
            const elBeamDesc = document.getElementById('bom-beam-desc');

            if (elHookCount) {
                if (state.beamType === 'container_spreader') {
                    elHookCount.textContent = isEn
                        ? `STS ${state.stsSizeFt || 40}ft Spreader`
                        : `Ngáng STS ${state.stsSizeFt || 40}ft`;
                } else {
                    const nHook = (state.hookCount || 1) >= 2 ? 2 : 1;
                    elHookCount.textContent = isEn
                        ? `${nHook} Hook${nHook > 1 ? 's' : ''} · 1 Link`
                        : `${nHook} Móc · 1 Khuyên`;
                }
            }
            if (elHookDesc) {
                if (state.beamType === 'container_spreader') {
                    const direct = (typeof isStsDirectAttach === 'function')
                        ? isStsDirectAttach()
                        : (state.stsAttachMode || 'direct') !== 'cable';
                    elHookDesc.textContent = isEn
                        ? (direct
                            ? 'Headblock + twistlock direct on container (no lower slings)'
                            : 'Headblock + underside shackles + cable/chain to cargo lugs')
                        : (direct
                            ? 'Headblock + twistlock gắp trực tiếp nóc container (không cáp dưới)'
                            : 'Headblock + ma ní dưới ngáng + cáp/xích xuống tai kiện');
                } else {
                    const nHook = (state.hookCount || 1) >= 2 ? 2 : 1;
                    elHookDesc.textContent = isEn
                        ? (nHook > 1
                            ? '2 Crane Hooks (tandem / dual crane) · Master Link Assembly'
                            : (bom.tier1Count > 2 ? '1 Crane Hook · 1 Master Link Quad Assembly' : '1 Crane Hook · 1 Oblong Master Link'))
                        : (nHook > 1
                            ? '2 Móc · 2 cần cẩu làm hàng cùng lúc · Cụm vòng khuyên chính'
                            : (bom.tier1Count > 2 ? '1 Móc cẩu Liebherr · 1 Vòng khuyên chính (Quad/Sub-links)' : '1 Móc cẩu Liebherr · 1 Vòng khuyên chính Master Link'));
                }
            }

            if (elSlingCount) {
                elSlingCount.textContent = isEn ? `${bom.totalSlings} Slings` : `${bom.totalSlings} sợi cáp`;
            }
            if (elSlingDesc) {
                if (bom.tier2Count === 0) {
                    elSlingDesc.textContent = isEn ? `Tier 1: ${bom.tier1Count} Direct Slings` : `Tầng 1: ${bom.tier1Count} sợi cáp chùm trực tiếp`;
                } else {
                    const hTxt = bom.hangerCount ? (isEn ? ` · Hangers: ${bom.hangerCount}` : ` · Treo dầm: ${bom.hangerCount}`) : '';
                    elSlingDesc.textContent = isEn
                        ? `Tier 1: ${bom.tier1Count} · Tier 2: ${bom.tier2Count}${hTxt}`
                        : `Tầng 1: ${bom.tier1Count} sợi · Tầng 2: ${bom.tier2Count} sợi${hTxt}`;
                }
            }

            if (elShackleCount) {
                elShackleCount.textContent = isEn ? `${bom.totalShackles} Shackles` : `${bom.totalShackles} ma ní`;
            }
            if (elShackleDesc) {
                if (bom.spreaderTopShackles + bom.spreaderBottomShackles === 0) {
                    elShackleDesc.textContent = isEn
                        ? `${bom.topShackles} Top · ${bom.lugShackles} Cargo Lugs`
                        : `${bom.topShackles} Đỉnh · ${bom.lugShackles} Tai cẩu LP`;
                } else {
                    const beamSh = bom.spreaderTopShackles + bom.spreaderBottomShackles;
                    elShackleDesc.textContent = isEn
                        ? `${bom.topShackles} Top · ${beamSh} Spreader · ${bom.lugShackles} Lugs`
                        : `${bom.topShackles} Đỉnh · ${beamSh} Dầm ngáng · ${bom.lugShackles} Tai cẩu`;
                }
            }

            if (elBeamCount) {
                elBeamCount.textContent = isEn
                    ? `${bom.beamCount} Beam · ${bom.turnbuckleCount} TB`
                    : `${bom.beamCount} Dầm · ${bom.turnbuckleCount} T.Đơ`;
            }
            if (elBeamDesc) {
                elBeamDesc.textContent = isEn
                    ? `${bom.beamDescEn} · ${bom.turnbuckleCount} Turnbuckles`
                    : `${bom.beamDesc} · ${bom.turnbuckleCount} Tăng đơ cân CoG`;
            }
        }

        function updateCableQuickSelector() {
            const topo = getRiggingTopology();
            const currentSel = state.gear && state.gear.selection ? state.gear.selection.find(s => s.kind === 'sling') : null;

            const renderPills = (containerId, items) => {
                const container = document.getElementById(containerId);
                if (!container) return;
                container.innerHTML = '';

                items.forEach(item => {
                    const btn = document.createElement('button');
                    btn.type = 'button';
                    const isSelected = currentSel && currentSel.role === item.role && currentSel.index === item.index;
                    btn.className = `px-2 py-0.5 rounded text-[9.5px] font-mono font-bold border transition ${
                        isSelected
                            ? 'bg-sky-500 text-white border-sky-300 shadow-sm ring-1 ring-sky-300'
                            : 'bg-slate-800 text-slate-300 hover:text-white border-slate-700 hover:border-slate-500'
                    }`;
                    btn.textContent = item.shortLabel;
                    btn.title = state.lang === 'en' ? item.titleEn : item.titleVi;
                    btn.addEventListener('click', (e) => {
                        e.stopPropagation();
                        if (isSelected) {
                            state.gear.selection = (state.gear.selection || []).filter(s => s.kind !== 'sling');
                        } else {
                            state.gear.selection = [{ kind: 'sling', role: item.role, index: item.index }];
                        }
                        if (typeof updateGearSelectionRings === 'function') updateGearSelectionRings();
                        syncCableControlsSelection();
                        if (typeof renderGearFields === 'function') renderGearFields();
                    });
                    container.appendChild(btn);
                });
            };

            renderPills('tier1-quick-selector', topo.tier1);
            renderPills('hanger-quick-selector', topo.hangers);
            renderPills('tier2-quick-selector', topo.tier2);

            const legacyCont = document.getElementById('cable-quick-selector');
            if (legacyCont) legacyCont.innerHTML = '';
        }

        function syncCableControlsSelection() {
            const box = document.getElementById('box-selected-cable');
            if (!box) return;

            const sel = (state.gear && state.gear.selection) ? state.gear.selection.find(s => s.kind === 'sling') : null;
            if (!sel) {
                box.classList.add('hidden');
                document.querySelectorAll('#tier1-quick-selector button, #tier2-quick-selector button, #hanger-quick-selector button').forEach(p => {
                    p.classList.remove('bg-sky-500', 'text-white', 'border-sky-300', 'shadow-sm', 'ring-1', 'ring-sky-300');
                    p.classList.add('bg-slate-800', 'text-slate-300', 'border-slate-700');
                });
                return;
            }

            box.classList.remove('hidden');

            const topo = getRiggingTopology();
            const allItems = [...topo.tier1, ...topo.hangers, ...topo.tier2];
            const matched = allItems.find(it => it.role === sel.role && it.index === sel.index);

            const lbl = document.getElementById('lbl-selected-cable');
            if (lbl) {
                if (matched) {
                    lbl.textContent = `🎯 ${state.lang === 'en' ? 'Selected:' : 'Đang chọn:'} ${state.lang === 'en' ? matched.titleEn : matched.titleVi}`;
                } else {
                    lbl.textContent = `🎯 ${state.lang === 'en' ? 'Selected Cable' : 'Đang chọn cáp'}`;
                }
            }

            // Live Tension, Angle & WLL badge for selected cable
            let tensionT = 0;
            let angleDeg = 60.0;
            if (sel.role === 'leg') {
                tensionT = (phy.legTensions && phy.legTensions[sel.index]) || 0;
                angleDeg = (phy.legAngleDeg && phy.legAngleDeg[sel.index]) || 60.0;
            } else if (sel.role === 'upper') {
                tensionT = (phy.upperTensions && phy.upperTensions[sel.index]) || 0;
                angleDeg = (phy.upperAngleDeg && phy.upperAngleDeg[sel.index] != null) ? phy.upperAngleDeg[sel.index] : (spec ? spec.betaDeg : 60.0);
            } else if (sel.role === 'hanger') {
                tensionT = (phy.hangerTensions && phy.hangerTensions[sel.index]) || 0;
                angleDeg = 90.0;
            }

            const rec = (typeof gearRecord === 'function') ? gearRecord(sel) : null;
            const wllT = (rec && rec.swlT != null) ? rec.swlT : (state.wllPerLeg || 15.0);

            const elTen = document.getElementById('v-sel-tension');
            const elAng = document.getElementById('v-sel-angle');
            const elSwl = document.getElementById('v-sel-swl');
            if (elTen) elTen.textContent = `Lực căng T: ${tensionT.toFixed(2)} T`;
            if (elAng) elAng.textContent = `Góc α: ${angleDeg.toFixed(1)}°`;
            if (elSwl) elSwl.textContent = `WLL: ${wllT.toFixed(1)} T`;

            // Length
            let spec = (typeof getRigSpec === 'function') ? getRigSpec() : null;
            let lenM = null;
            if (rec && rec.lengthM != null) {
                lenM = rec.lengthM;
            } else if (sel.role === 'upper') {
                lenM = state.upperSlingLength != null ? state.upperSlingLength : (spec ? spec.topLeg : (state.slingLength || 8.0));
            } else if (sel.role === 'leg') {
                lenM = state.lowerSlingLength != null ? state.lowerSlingLength : (spec ? spec.lower : 2.0);
            } else if (sel.role === 'hanger') {
                lenM = state.hangerSlingLength != null ? state.hangerSlingLength : (spec ? (spec.hanger || 2.0) : 2.0);
            } else {
                lenM = 2.0;
            }

            const dispVal = toDisplayLen(lenM);
            const inpSel = document.getElementById('inp-selectedL');
            const numSel = document.getElementById('num-selectedL');
            if (inpSel) inpSel.value = dispVal.toFixed(2);
            if (numSel) numSel.value = dispVal.toFixed(2);

            // Highlight pills
            document.querySelectorAll('#tier1-quick-selector button, #tier2-quick-selector button, #hanger-quick-selector button').forEach(p => {
                const isCurrent = matched && p.textContent.trim() === matched.shortLabel;
                if (isCurrent) {
                    p.classList.add('bg-sky-500', 'text-white', 'border-sky-300', 'shadow-sm', 'ring-1', 'ring-sky-300');
                    p.classList.remove('bg-slate-800', 'text-slate-300', 'border-slate-700');
                } else {
                    p.classList.remove('bg-sky-500', 'text-white', 'border-sky-300', 'shadow-sm', 'ring-1', 'ring-sky-300');
                    p.classList.add('bg-slate-800', 'text-slate-300', 'border-slate-700');
                }
            });
        }

        function syncSlingSlidersFromState() {
            let spec = null;
            if (typeof getRigSpec === 'function') {
                spec = getRigSpec();
            }
            updateUnitDisplayElements();

            const upperM = state.upperSlingLength != null ? state.upperSlingLength : (spec ? spec.topLeg : 8.0);
            const lowerM = state.lowerSlingLength != null ? state.lowerSlingLength : (spec ? spec.lower : 2.0);
            const hangerM = state.hangerSlingLength != null ? state.hangerSlingLength : (spec ? (spec.hanger || 2.0) : 2.0);

            const dispUpper = toDisplayLen(upperM);
            const dispLower = toDisplayLen(lowerM);
            const dispHanger = toDisplayLen(hangerM);

            const inpUpper = document.getElementById('inp-upperL');
            const numUpper = document.getElementById('num-upperL');
            const vUpper = document.getElementById('v-upperL');
            if (inpUpper) inpUpper.value = dispUpper.toFixed(2);
            if (numUpper) numUpper.value = dispUpper.toFixed(2);
            if (vUpper) vUpper.textContent = dispUpper.toFixed(2);

            const inpLower = document.getElementById('inp-lowerL');
            const numLower = document.getElementById('num-lowerL');
            const vLower = document.getElementById('v-lowerL');
            if (inpLower) inpLower.value = dispLower.toFixed(2);
            if (numLower) numLower.value = dispLower.toFixed(2);
            if (vLower) vLower.textContent = dispLower.toFixed(2);

            const inpHanger = document.getElementById('inp-hangerL');
            const numHanger = document.getElementById('num-hangerL');
            const vHanger = document.getElementById('v-hangerL');
            if (inpHanger) inpHanger.value = dispHanger.toFixed(2);
            if (numHanger) numHanger.value = dispHanger.toFixed(2);
            if (vHanger) vHanger.textContent = dispHanger.toFixed(2);
            const lblHangerLen = document.getElementById('lbl-hanger-len-indicator');
            if (lblHangerLen) lblHangerLen.textContent = `${dispHanger.toFixed(2)} m`;

            // 0. Spreader Beam Length & Mass Sync
            let beamLenM = 12.2;
            if (state.beamType === 'container_spreader' && typeof isoTwistlockSpan === 'function') {
                beamLenM = isoTwistlockSpan(state.stsSizeFt || 40).spanX;
            } else if (typeof memberSpec === 'function') {
                const m = memberSpec('main');
                if (m && m.length) beamLenM = m.length;
            } else if (state.gear && state.gear.members && state.gear.members.main && state.gear.members.main.lengthM) {
                beamLenM = state.gear.members.main.lengthM;
            } else {
                beamLenM = Math.max(1.2, state.L || 12.2);
            }
            const inpBeamL = document.getElementById('inp-beamL');
            const numBeamL = document.getElementById('num-beamL');
            const vBeamL = document.getElementById('v-beamL');
            const vBeamMass = document.getElementById('v-beam-mass');
            if (inpBeamL) inpBeamL.value = beamLenM.toFixed(2);
            if (numBeamL) numBeamL.value = beamLenM.toFixed(2);
            if (vBeamL) vBeamL.textContent = beamLenM.toFixed(2);
            if (vBeamMass) {
                const massKg = Math.round(400 + beamLenM * 55);
                vBeamMass.textContent = `Tự trọng: ~${massKg} kg`;
            }
            if (typeof updateStsBeamDimUI === 'function') updateStsBeamDimUI();

            // Sync Tier 1 Angle Readouts (β to horizontal, α to vertical, LAF factor)
            const horizU = spec ? spec.horizU : Math.max(0.5, (state.L || 6.0) / 4);
            const cosBeta = THREE.MathUtils.clamp(horizU / upperM, 0.01, 0.999);
            const betaDeg = Math.acos(cosBeta) * 180 / Math.PI;
            const alphaDeg = 90 - betaDeg;
            const sinBeta = Math.sin(betaDeg * Math.PI / 180);
            const laf = sinBeta > 0.01 ? (1 / sinBeta) : 1.0;

            const inpUpperAngle = document.getElementById('inp-upper-angle');
            const lblUpperAngleVal = document.getElementById('lbl-upper-angle-val');
            const vBetaTxt = document.getElementById('v-upper-beta-txt');
            const vAlphaTxt = document.getElementById('v-upper-alpha-txt');
            const vLafTxt = document.getElementById('v-upper-laf-txt');
            const lblUpperLenIndicator = document.getElementById('lbl-upper-len-indicator');
            if (inpUpperAngle) inpUpperAngle.value = betaDeg.toFixed(1);
            if (lblUpperAngleVal) lblUpperAngleVal.textContent = betaDeg.toFixed(1);
            if (vBetaTxt) vBetaTxt.textContent = `${betaDeg.toFixed(1)}°`;
            if (vAlphaTxt) vAlphaTxt.textContent = `${alphaDeg.toFixed(1)}°`;
            if (vLafTxt) vLafTxt.textContent = laf.toFixed(3);
            if (lblUpperLenIndicator) lblUpperLenIndicator.textContent = `${dispUpper.toFixed(2)} m`;

            // Sync Tier 2 Readouts
            const lblLowerLenIndicator = document.getElementById('lbl-lower-len-indicator');
            if (lblLowerLenIndicator) lblLowerLenIndicator.textContent = `${dispLower.toFixed(2)} m`;
            const lblLowerAngle = document.getElementById('lbl-lower-angle-indicator');
            if (lblLowerAngle) {
                const horizL = spec ? (spec.horizL || 0) : 0;
                if (horizL < 0.1) {
                    lblLowerAngle.textContent = '🟢 Thẳng đứng 90° (Zero Lateral Shear)';
                    lblLowerAngle.className = 'text-emerald-400 font-bold';
                } else {
                    const deg = Math.atan2(dispLower, horizL) * 180 / Math.PI;
                    lblLowerAngle.textContent = `Góc nghiêng α: ${deg.toFixed(1)}°`;
                    lblLowerAngle.className = 'text-amber-300 font-bold';
                }
            }

            const inpSlingL = document.getElementById('inp-slingL');
            const vSlingL = document.getElementById('v-slingL');
            if (inpSlingL) inpSlingL.value = upperM.toFixed(1);
            if (vSlingL) vSlingL.textContent = upperM.toFixed(1);

            const inpWll = document.getElementById('inp-wll');
            const numWll = document.getElementById('num-wll');
            const vWll = document.getElementById('v-wll');
            if (inpWll) inpWll.value = (state.wllPerLeg || 15.0).toFixed(1);
            if (numWll) numWll.value = (state.wllPerLeg || 15.0).toFixed(1);
            if (vWll) vWll.textContent = (state.wllPerLeg || 15.0).toFixed(1);

            const inpSlingDia = document.getElementById('inp-sling-dia');
            const numSlingDia = document.getElementById('num-sling-dia');
            const badgeSlingSize = document.getElementById('badge-sling-size');
            const readoutMass = document.getElementById('readout-sling-unit-mass');
            const getPhysSpec = (typeof CAE !== 'undefined' && CAE.getSlingPhysicalSpec)
                || (typeof window !== 'undefined' && window.CAE && window.CAE.getSlingPhysicalSpec);
            if (getPhysSpec) {
                const spec = getPhysSpec(state.slingType || 'wire', state.wllPerLeg || 15.0, state.slingDiaMm);
                if (badgeSlingSize) badgeSlingSize.textContent = spec.specText;
                if (inpSlingDia && document.activeElement !== inpSlingDia) inpSlingDia.value = spec.diaMm;
                if (numSlingDia && document.activeElement !== numSlingDia) numSlingDia.value = spec.diaMm;
                if (readoutMass) {
                    const singleMassKg = spec.computeMassKg(upperM, 1);
                    readoutMass.textContent = `~${spec.linearMassKgPerM.toFixed(2)} kg/m · ${singleMassKg.toFixed(1)} kg/sợi`;
                }
            }

            const rowLower = document.getElementById('row-lower-sling');
            const rowHanger = document.getElementById('row-hanger-sling');
            const lblUpperTitle = document.getElementById('lbl-upper-title');
            const lblLowerTitle = document.getElementById('lbl-lower-title');
            const lblHangerTitle = document.getElementById('lbl-hanger-title');
            const angleUpper = spec ? spec.betaDeg : 42.5;
            const angleLower = (phy.legAngleDeg && phy.legAngleDeg[0] != null) ? phy.legAngleDeg[0] : 90.0;
            const showHanger = hasCascadedHangerTier();

            const stsDirectUi = state.beamType === 'container_spreader'
                && (typeof isStsDirectAttach === 'function'
                    ? isStsDirectAttach()
                    : (state.stsAttachMode || 'direct') !== 'cable');
            if (state.beamType === 'none' || stsDirectUi) {
                if (rowLower) rowLower.classList.add('hidden');
                if (rowHanger) rowHanger.classList.add('hidden');
                if (lblUpperTitle) {
                    if (stsDirectUi) {
                        lblUpperTitle.textContent = state.lang === 'en'
                            ? `Hoist falls (Headblock) [β: ${angleUpper.toFixed(0)}°]:`
                            : `Cáp tời → Headblock [β: ${angleUpper.toFixed(0)}°]:`;
                    } else {
                        lblUpperTitle.textContent = state.lang === 'en'
                            ? `Tier 1 (Direct Bridle: Hook ➔ Cargo) [β: ${angleUpper.toFixed(0)}°]:`
                            : `Tầng 1 (Cáp chùm trực tiếp — Móc ➔ Tai cẩu) [β: ${angleUpper.toFixed(0)}°]:`;
                    }
                }
            } else {
                if (rowLower) rowLower.classList.remove('hidden');
                if (rowHanger) {
                    if (showHanger) rowHanger.classList.remove('hidden');
                    else rowHanger.classList.add('hidden');
                }
                if (lblUpperTitle) lblUpperTitle.textContent = state.lang === 'en'
                    ? `Tier 1 (Top Bridle: Hook ➔ Beam) [β: ${angleUpper.toFixed(0)}°]:`
                    : `Tầng 1 (Top Bridle — Móc ➔ Dầm) [β: ${angleUpper.toFixed(0)}°]:`;
                if (lblLowerTitle) lblLowerTitle.textContent = state.lang === 'en'
                    ? (showHanger
                        ? `Tier 3 (Lower Legs: Sub-beam ➔ Cargo) [α: ${angleLower.toFixed(0)}°]:`
                        : `Tier 2 (Lower Legs: Beam ➔ Cargo) [α: ${angleLower.toFixed(0)}°]:`)
                    : (showHanger
                        ? `Tầng 3 (Lower Legs — Dầm phụ ➔ Tai Cẩu) [α: ${angleLower.toFixed(0)}°]:`
                        : `Tầng 2 (Lower Legs — Dầm ➔ Tai Cẩu) [α: ${angleLower.toFixed(0)}°]:`);
                if (lblHangerTitle) lblHangerTitle.textContent = state.lang === 'en'
                    ? `Tier 2 (Hanger: Main beam ➔ Sub-beam) [L: ${hangerM.toFixed(1)}m]:`
                    : `Tầng 2 (Hanger — Dầm chính ➔ Dầm phụ) [L: ${hangerM.toFixed(1)}m]:`;
            }

            syncCableAutoBalanceVisibility();
            updateCableQuickSelector();
            syncCableControlsSelection();
            updateRiggingBOMUI();
        }

        window.getRiggingTopology = getRiggingTopology;
        window.getRiggingBOM = getRiggingBOM;
        window.updateRiggingBOMUI = updateRiggingBOMUI;

        window.syncCableControlsSelection = syncCableControlsSelection;
        window.syncSlingSlidersFromState = syncSlingSlidersFromState;
        window.updateCableQuickSelector = updateCableQuickSelector;

        /** Toggle §3.2: STS ISO twistlock pitches vs generic beam L slider. */
        function updateStsBeamDimUI() {
            const isSts = state.beamType === 'container_spreader';
            const stsPanel = document.getElementById('sts-size-panel');
            const genPanel = document.getElementById('generic-beam-dim-panel');
            const autoFit = document.getElementById('btn-beam-auto-fit');
            const title = document.getElementById('lbl-beam-dim-title');
            if (stsPanel) {
                stsPanel.classList.toggle('hidden', !isSts);
                stsPanel.classList.toggle('flex', isSts);
            }
            if (genPanel) genPanel.classList.toggle('hidden', isSts);
            if (autoFit) autoFit.classList.toggle('hidden', isSts);
            if (title) {
                title.textContent = isSts
                    ? '3.2 Cỡ Ngáng STS — Pitch Twistlock ISO'
                    : '3.2 Kích Thước Dầm Ngáng (Spreader Span)';
            }
            if (!isSts) return;

            const ft = state.stsTwinLift ? 40 : (Number(state.stsSizeFt) || 40);
            const iso = (typeof isoTwistlockSpan === 'function')
                ? isoTwistlockSpan(ft)
                : { spanX: 11.985, spanZ: 2.259 };
            const pitchEl = document.getElementById('v-sts-pitch');
            const ftLbl = document.getElementById('v-sts-ft-label');
            const massEl = document.getElementById('v-sts-mass');
            if (pitchEl) pitchEl.textContent = `${iso.spanX.toFixed(3)} × ${iso.spanZ.toFixed(3)} m`;
            if (ftLbl) {
                ftLbl.textContent = state.stsTwinLift
                    ? '· Twin 2×20 ft'
                    : `· ${ft} ft`;
            }
            if (massEl) {
                const massT = ft <= 20 ? 8.5 : (ft >= 45 ? 11.2 : 9.5);
                massEl.textContent = `Tự trọng: ~${massT.toFixed(1)} t`;
            }
            document.querySelectorAll('.btn-sts-size').forEach(btn => {
                const btnFt = parseInt(btn.dataset.stsFt, 10);
                const on = !state.stsTwinLift && btnFt === ft;
                btn.classList.toggle('border-amber-500/80', on);
                btn.classList.toggle('bg-amber-950/50', on);
                btn.classList.toggle('shadow-sm', on);
                btn.classList.toggle('border-slate-700', !on);
                btn.classList.toggle('bg-slate-950/90', !on);
                const first = btn.querySelector('div');
                if (first) {
                    first.classList.toggle('text-amber-200', on);
                    first.classList.toggle('text-white', !on);
                }
            });
            const attach = state.stsAttachMode === 'cable' ? 'cable' : 'direct';
            document.querySelectorAll('.btn-sts-attach').forEach(btn => {
                const on = btn.dataset.stsAttach === attach;
                const isDirect = btn.dataset.stsAttach === 'direct';
                btn.classList.toggle('border-amber-500/80', on && isDirect);
                btn.classList.toggle('bg-amber-950/50', on && isDirect);
                btn.classList.toggle('border-sky-500/80', on && !isDirect);
                btn.classList.toggle('bg-sky-950/40', on && !isDirect);
                btn.classList.toggle('shadow-sm', on);
                btn.classList.toggle('border-slate-700', !on);
                btn.classList.toggle('bg-slate-950/90', !on);
                const first = btn.querySelector('div');
                if (first) {
                    first.classList.toggle('text-amber-200', on && isDirect);
                    first.classList.toggle('text-sky-200', on && !isDirect);
                    first.classList.toggle('text-white', !on);
                }
            });
            const chkTwin = document.getElementById('chk-sts-twin');
            if (chkTwin) chkTwin.checked = !!state.stsTwinLift;
        }
        window.updateStsBeamDimUI = updateStsBeamDimUI;

        /** STS attach: direct twistlock on roof vs cable/chain legs from underside pick points. */
        function applyStsAttachMode(mode) {
            const next = mode === 'cable' ? 'cable' : 'direct';
            state.stsAttachMode = next;
            state.beamType = 'container_spreader';
            state.hookCount = 1;
            state.hookSwivelEnabled = false;
            if (phy) {
                phy._stsYawLockRad = THREE.MathUtils.degToRad(
                    state.spreaderAlignWithCargo ? (state.cargoYawDeg || 0) : (state.spreaderYawDeg || 0)
                );
            }
            if (next === 'direct') {
                state.lowerSlingLength = 0.06;
                state.upperSlingLength = Math.max(1.2, state.upperSlingLength || 2.4);
                state.slingLength = state.upperSlingLength;
                state.slingUserSet = true;
                state.lugElevPreset = 'top';
                state.pendingConform = 'structural';
                // Drop any stale per-leg lengths / held L0 so twistlock gap stays flush
                if (state.gear && state.gear.legs) {
                    state.gear.legs.forEach(leg => {
                        if (!leg) return;
                        leg.lengthM = null;
                        leg.userSet = false;
                    });
                }
                if (state.heldCableL0 && state.heldCableL0.leg) state.heldCableL0.leg = [];
                state.legDeltaL = [0, 0, 0, 0];
            } else {
                // Normal flexible legs with shackle pick points under the spreader
                if (state.lowerSlingLength == null || state.lowerSlingLength < 0.8) {
                    state.lowerSlingLength = 2.0;
                }
                state.upperSlingLength = Math.max(1.2, state.upperSlingLength || 2.4);
                state.slingLength = state.upperSlingLength;
                state.slingUserSet = true;
                state.pendingConform = 'structural';
            }
            if (typeof setSymmetricLugsFromDimensions === 'function') setSymmetricLugsFromDimensions();
            updateStsBeamDimUI();
            if (typeof flushRebuildSpreaderVisuals === 'function') flushRebuildSpreaderVisuals();
            if (typeof rebuildCargoAndRig === 'function') rebuildCargoAndRig(false);
            else if (typeof rebuildSpreaderVisuals === 'function') rebuildSpreaderVisuals();
            if (typeof syncHookToRigTaut === 'function') syncHookToRigTaut();
            syncSlingSlidersFromState();
            if (typeof updateRiggingBOMUI === 'function') updateRiggingBOMUI();
        }
        window.applyStsAttachMode = applyStsAttachMode;

        /**
         * Apply STS telescopic size: ISO 1161 twistlock centres (not outer / phủ bì).
         * @param {20|40|45|'twin'} size
         */
        function applyStsSpreaderSize(size, opts) {
            const syncCargo = !(opts && opts.skipCargo === true);
            let ft = 40;
            const isTwin = (size === 'twin' || size === 'Twin');
            if (isTwin) {
                state.stsTwinLift = true;
                state.stsSizeFt = 40;
                ft = 40;
            } else {
                state.stsTwinLift = false;
                ft = Number(size) || 40;
                if (ft <= 20) ft = 20;
                else if (ft >= 45) ft = 45;
                else ft = 40;
                state.stsSizeFt = ft;
            }

            const iso = (typeof isoTwistlockSpan === 'function')
                ? isoTwistlockSpan(ft)
                : { spanX: ft <= 20 ? 5.853 : (ft >= 45 ? 13.557 : 11.985), spanZ: 2.259, outerL: ft <= 20 ? 6.058 : (ft >= 45 ? 13.716 : 12.192), outerW: 2.438, outerH: ft >= 45 ? 2.896 : 2.591, cargoId: ft <= 20 ? 'container' : (ft >= 45 ? 'iso40hc' : 'iso40') };

            if (!state.gear) state.gear = {};
            if (!state.gear.beam) state.gear.beam = {};
            // Beam span = twistlock pin centres (ISO), never outer envelope
            state.gear.beam.lengthM = iso.spanX;
            state.gear.beam.widthM = iso.spanZ;
            state.customBeamLengthMode = true;

            if (!state.gear.members) state.gear.members = {};
            if (!state.gear.members.spreader_main) state.gear.members.spreader_main = {};
            state.gear.members.spreader_main.lengthM = iso.spanX;
            if (!state.gear.members.main) state.gear.members.main = {};
            state.gear.members.main.lengthM = iso.spanX;

            state.beamType = 'container_spreader';
            state.hookCount = 1;
            // STS trolley headblock does not free-swivel like a hook block
            state.hookSwivelEnabled = false;
            if (phy) phy._stsYawLockRad = THREE.MathUtils.degToRad(
                state.spreaderAlignWithCargo ? (state.cargoYawDeg || 0) : (state.spreaderYawDeg || 0)
            );
            if (!state.stsAttachMode) state.stsAttachMode = 'direct';
            state.upperSlingLength = Math.max(1.2, state.upperSlingLength || 2.4);
            if (state.stsAttachMode === 'cable') {
                if (state.lowerSlingLength == null || state.lowerSlingLength < 0.8) state.lowerSlingLength = 2.0;
            } else {
                state.lowerSlingLength = 0.06;
                state.lugElevPreset = 'top';
            }
            state.slingLength = state.upperSlingLength;
            state.slingUserSet = true;
            state.pendingConform = 'structural';

            if (syncCargo) {
                if (isTwin) {
                    // Twin-lift: two 20ft dry vans end-to-end (~40ft cell), CAD twin spreader
                    state.L = 12.192;
                    state.W = 2.438;
                    state.H = 2.591;
                    state.cargoType = 'container';
                    state.weight = Math.max(36, state.weight || 40);
                    state.weightUserSet = true;
                    document.querySelectorAll('#cargo-library .card-btn').forEach(c => {
                        c.classList.toggle('active', c.dataset.cargo === 'container');
                    });
                } else if (iso.outerL) {
                    state.L = iso.outerL;
                    state.W = iso.outerW || 2.438;
                    state.H = iso.outerH || 2.591;
                    if (iso.cargoId) {
                        state.cargoType = iso.cargoId;
                        document.querySelectorAll('#cargo-library .card-btn').forEach(c => {
                            c.classList.toggle('active', c.dataset.cargo === iso.cargoId);
                        });
                    }
                }
            }

            if (typeof setSymmetricLugsFromDimensions === 'function') setSymmetricLugsFromDimensions();
            updateStsBeamDimUI();

            // Highlight STS card in store
            document.querySelectorAll('#beam-store .card-btn').forEach(c => {
                c.classList.toggle('active', c.dataset.beam === 'container_spreader');
            });

            if (typeof flushRebuildSpreaderVisuals === 'function') flushRebuildSpreaderVisuals();
            if (typeof rebuildCargoAndRig === 'function') rebuildCargoAndRig(true);
            else if (typeof rebuildSpreaderVisuals === 'function') rebuildSpreaderVisuals();
            if (typeof syncHookToRigTaut === 'function') syncHookToRigTaut();
            syncSlingSlidersFromState();
            if (typeof updateRiggingBOMUI === 'function') updateRiggingBOMUI();
        }
        window.applyStsSpreaderSize = applyStsSpreaderSize;

        function initSlingControls() {
            // 0. Spreader Beam Length Controls (Thanh kéo ngang Chiều dài Dầm)
            const inpBeamL = document.getElementById('inp-beamL');
            const numBeamL = document.getElementById('num-beamL');
            const onBeamLengthChange = (valRaw, source) => {
                if (state.beamType === 'container_spreader') return; // STS: ISO pitches only
                const val = parseFloat(valRaw);
                if (isNaN(val) || val <= 0) return;
                const minL = 1.0;
                const maxL = 30.0;
                const clampedVal = Math.min(maxL, Math.max(minL, val));

                if (source === 'slider' && numBeamL) numBeamL.value = clampedVal.toFixed(2);
                if (source === 'number' && inpBeamL) inpBeamL.value = clampedVal.toFixed(2);
                const vBeamL = document.getElementById('v-beamL');
                if (vBeamL) vBeamL.textContent = clampedVal.toFixed(2);

                const vBeamMass = document.getElementById('v-beam-mass');
                if (vBeamMass) {
                    const massKg = Math.round(400 + clampedVal * 55);
                    vBeamMass.textContent = `Tự trọng: ~${massKg} kg`;
                }

                if (!state.gear.members) state.gear.members = {};
                if (!state.gear.members.main) state.gear.members.main = { lengthM: null, aM: null, bM: null, swlT: null, massT: null };
                state.gear.members.main.lengthM = clampedVal;
                state.customBeamLengthMode = true;

                if (typeof syncHookToRigTaut === 'function') syncHookToRigTaut();
                rebuildCargoAndRig(false);
                syncSlingSlidersFromState();
                updateRiggingBOMUI();
            };

            if (inpBeamL) inpBeamL.addEventListener('input', e => onBeamLengthChange(e.target.value, 'slider'));
            if (numBeamL) numBeamL.addEventListener('input', e => onBeamLengthChange(e.target.value, 'number'));

            document.querySelectorAll('.btn-step-beam').forEach(btn => {
                btn.addEventListener('click', () => {
                    if (state.beamType === 'container_spreader') return;
                    const delta = parseFloat(btn.dataset.delta || 0);
                    const cur = parseFloat(numBeamL ? numBeamL.value : (inpBeamL ? inpBeamL.value : 12.2));
                    const next = Math.max(1.0, +(cur + delta).toFixed(2));
                    onBeamLengthChange(next, 'number');
                });
            });

            document.querySelectorAll('.btn-preset-beam').forEach(btn => {
                btn.addEventListener('click', () => {
                    if (state.beamType === 'container_spreader') return;
                    const val = parseFloat(btn.dataset.val);
                    if (!isNaN(val)) onBeamLengthChange(val, 'number');
                });
            });

            document.querySelectorAll('.btn-sts-size').forEach(btn => {
                btn.addEventListener('click', () => {
                    const ft = parseInt(btn.dataset.stsFt, 10);
                    if (!ft) return;
                    applyStsSpreaderSize(ft);
                });
            });
            document.querySelectorAll('.btn-sts-attach').forEach(btn => {
                btn.addEventListener('click', () => {
                    applyStsAttachMode(btn.dataset.stsAttach || 'direct');
                });
            });
            const chkTwin = document.getElementById('chk-sts-twin');
            if (chkTwin) {
                chkTwin.addEventListener('change', () => {
                    applyStsSpreaderSize(chkTwin.checked ? 'twin' : (state.stsSizeFt || 40));
                });
            }

            const btnBeamAutoFit = document.getElementById('btn-beam-auto-fit');
            if (btnBeamAutoFit) {
                btnBeamAutoFit.addEventListener('click', () => {
                    if (state.beamType === 'container_spreader') return;
                    if (state.gear && state.gear.members && state.gear.members.main) {
                        state.gear.members.main.lengthM = null; // restore auto-fit to cargo width/span
                    }
                    state.customBeamLengthMode = false;
                    if (typeof syncHookToRigTaut === 'function') syncHookToRigTaut();
                    rebuildCargoAndRig(false);
                    syncSlingSlidersFromState();
                    updateRiggingBOMUI();
                });
            }

            // 1. Upper Bridle Controls (Móc ➔ Dầm)
            const inpUpper = document.getElementById('inp-upperL');
            const numUpper = document.getElementById('num-upperL');
            const inpUpperAngle = document.getElementById('inp-upper-angle');
            const lblUpperAngleVal = document.getElementById('lbl-upper-angle-val');

            const onUpperChange = (valDisplay, source) => {
                const val = parseFloat(valDisplay);
                if (isNaN(val) || val <= 0) return;
                const minUpperDisp = toDisplayLen(0.35);
                const maxUpperDisp = toDisplayLen(50.0);
                const clampedVal = Math.min(maxUpperDisp, Math.max(minUpperDisp, val));

                if (source === 'slider' && numUpper) numUpper.value = clampedVal.toFixed(2);
                if (source === 'number' && inpUpper) inpUpper.value = clampedVal.toFixed(2);
                if (source === 'angle') {
                    if (numUpper) numUpper.value = clampedVal.toFixed(2);
                    if (inpUpper) inpUpper.value = clampedVal.toFixed(2);
                }
                const vUpper = document.getElementById('v-upperL');
                if (vUpper) vUpper.textContent = clampedVal.toFixed(2);

                const mVal = fromInputLen(clampedVal);
                state.upperSlingLength = mVal;
                state.slingLength = mVal;
                state.slingUserSet = true;
                markCableAdjustMode();
                if (state.heldCableL0) state.heldCableL0.upper = [];

                // Cập nhật đồng bộ tức thì cho TẤT CẢ các sợi cáp Tầng 1 (L1-1, L1-2, L1-3, L1-4)
                if (state.gear && state.gear.uppers) {
                    state.gear.uppers.forEach(u => {
                        if (u) {
                            u.lengthM = mVal;
                            u.userSet = true;
                        }
                    });
                }

                // Cập nhật góc tính toán β, α, LAF
                const spec = (typeof getRigSpec === 'function') ? getRigSpec() : null;
                const horizU = spec ? spec.horizU : Math.max(0.5, (state.L || 6.0) / 4);
                const cosBeta = THREE.MathUtils.clamp(horizU / mVal, 0.01, 0.999);
                const betaDeg = Math.acos(cosBeta) * 180 / Math.PI;
                const alphaDeg = 90 - betaDeg;
                const sinBeta = Math.sin(betaDeg * Math.PI / 180);
                const laf = sinBeta > 0.01 ? (1 / sinBeta) : 1.0;

                if (source !== 'angle' && inpUpperAngle) {
                    inpUpperAngle.value = betaDeg.toFixed(1);
                }
                if (lblUpperAngleVal) lblUpperAngleVal.textContent = betaDeg.toFixed(1);
                const vBetaTxt = document.getElementById('v-upper-beta-txt');
                if (vBetaTxt) vBetaTxt.textContent = `${betaDeg.toFixed(1)}°`;
                const vAlphaTxt = document.getElementById('v-upper-alpha-txt');
                if (vAlphaTxt) vAlphaTxt.textContent = `${alphaDeg.toFixed(1)}°`;
                const vLafTxt = document.getElementById('v-upper-laf-txt');
                if (vLafTxt) vLafTxt.textContent = laf.toFixed(3);
                const lblUpperLenIndicator = document.getElementById('lbl-upper-len-indicator');
                if (lblUpperLenIndicator) lblUpperLenIndicator.textContent = `${clampedVal.toFixed(2)} m`;

                const inpSlingL = document.getElementById('inp-slingL');
                const vSlingL = document.getElementById('v-slingL');
                if (inpSlingL) inpSlingL.value = mVal;
                if (vSlingL) vSlingL.textContent = mVal.toFixed(1);

                const sel = (state.gear && state.gear.selection) ? state.gear.selection.find(s => s.kind === 'sling' && s.role === 'upper') : null;
                if (sel) {
                    const inpSel = document.getElementById('inp-selectedL');
                    const numSel = document.getElementById('num-selectedL');
                    if (inpSel) inpSel.value = clampedVal.toFixed(2);
                    if (numSel) numSel.value = clampedVal.toFixed(2);
                }
                if (typeof syncHookToRigTaut === 'function') syncHookToRigTaut();
                rebuildCargoAndRig(false);
                syncCableControlsSelection();
                updateRiggingBOMUI();
            };
            if (inpUpper) inpUpper.addEventListener('input', e => onUpperChange(e.target.value, 'slider'));
            if (numUpper) numUpper.addEventListener('input', e => onUpperChange(e.target.value, 'number'));

            // Tier 1 Angle Slider: kéo góc tự động cập nhật độ dài L1
            const onUpperAngleChange = (betaDegVal) => {
                const beta = parseFloat(betaDegVal);
                if (isNaN(beta) || beta < 25 || beta > 85) return;
                const spec = (typeof getRigSpec === 'function') ? getRigSpec() : null;
                const horizU = spec ? spec.horizU : Math.max(0.5, (state.L || 6.0) / 4);
                const rad = beta * Math.PI / 180;
                const cosBeta = Math.cos(rad);
                if (cosBeta <= 0.01) return;
                const newLengthM = horizU / cosBeta;
                onUpperChange(toDisplayLen(newLengthM), 'angle');
            };
            if (inpUpperAngle) inpUpperAngle.addEventListener('input', e => onUpperAngleChange(e.target.value));

            document.querySelectorAll('.btn-preset-upper-angle').forEach(btn => {
                btn.addEventListener('click', () => {
                    const ang = parseFloat(btn.dataset.angle);
                    if (!isNaN(ang)) onUpperAngleChange(ang);
                });
            });

            // 2. Lower Legs Controls (Dầm ➔ Hàng)
            const inpLower = document.getElementById('inp-lowerL');
            const numLower = document.getElementById('num-lowerL');
            const onLowerChange = (valDisplay, source) => {
                const val = parseFloat(valDisplay);
                if (isNaN(val) || val <= 0) return;
                const minLowerDisp = toDisplayLen(0.35);
                const maxLowerDisp = toDisplayLen(50.0);
                const clampedVal = Math.min(maxLowerDisp, Math.max(minLowerDisp, val));

                if (source === 'slider' && numLower) numLower.value = clampedVal.toFixed(2);
                if (source === 'number' && inpLower) inpLower.value = clampedVal.toFixed(2);
                const vLower = document.getElementById('v-lowerL');
                if (vLower) vLower.textContent = clampedVal.toFixed(2);
                const lblLowerLenIndicator = document.getElementById('lbl-lower-len-indicator');
                if (lblLowerLenIndicator) lblLowerLenIndicator.textContent = `${clampedVal.toFixed(2)} m`;

                const mVal = fromInputLen(clampedVal);
                state.lowerSlingLength = mVal;
                state.slingUserSet = true;
                markCableAdjustMode();
                if (state.heldCableL0) state.heldCableL0.leg = [];

                // Cập nhật đồng bộ tức thì cho TẤT CẢ các sợi cáp Tầng 2 (L2-1, L2-2, L2-3, L2-4)
                if (state.gear && state.gear.legs) {
                    state.gear.legs.forEach(l => {
                        if (l) {
                            l.lengthM = mVal;
                            l.userSet = true;
                        }
                    });
                }

                const sel = (state.gear && state.gear.selection) ? state.gear.selection.find(s => s.kind === 'sling' && s.role === 'leg') : null;
                if (sel) {
                    const inpSel = document.getElementById('inp-selectedL');
                    const numSel = document.getElementById('num-selectedL');
                    if (inpSel) inpSel.value = clampedVal.toFixed(2);
                    if (numSel) numSel.value = clampedVal.toFixed(2);
                }
                if (typeof syncHookToRigTaut === 'function') syncHookToRigTaut();
                rebuildCargoAndRig(false);
                syncCableControlsSelection();
                updateRiggingBOMUI();
            };
            if (inpLower) inpLower.addEventListener('input', e => onLowerChange(e.target.value, 'slider'));
            if (numLower) numLower.addEventListener('input', e => onLowerChange(e.target.value, 'number'));

            // 3. Selected Single Cable Controls
            const inpSel = document.getElementById('inp-selectedL');
            const numSel = document.getElementById('num-selectedL');
            const onSelectedChange = (valDisplay, source) => {
                const sel = (state.gear && state.gear.selection) ? state.gear.selection.find(s => s.kind === 'sling') : null;
                if (!sel) return;
                const rec = (typeof gearRecord === 'function') ? gearRecord(sel) : null;
                if (!rec) return;

                const val = parseFloat(valDisplay);
                if (isNaN(val) || val <= 0) return;

                const spec = (typeof getRigSpec === 'function') ? getRigSpec() : null;
                let minDisp = 0.3;
                let maxDisp = 35.0;
                if (spec) {
                    if (sel.role === 'upper') {
                        minDisp = toDisplayLen(spec.minUpper);
                        maxDisp = toDisplayLen(spec.maxUpper);
                    } else if (sel.role === 'leg') {
                        minDisp = toDisplayLen(spec.minLower);
                        maxDisp = toDisplayLen(spec.maxLower);
                    } else if (sel.role === 'hanger') {
                        minDisp = toDisplayLen(spec.minHanger || 0.5);
                        maxDisp = toDisplayLen(spec.maxHanger || 12);
                    }
                }
                const clampedVal = Math.min(maxDisp, Math.max(minDisp, val));

                if (source === 'slider' && numSel) numSel.value = clampedVal.toFixed(2);
                if (source === 'number' && inpSel) inpSel.value = clampedVal.toFixed(2);

                const lenM = fromInputLen(clampedVal);
                rec.lengthM = lenM;
                rec.userSet = true;
                state.slingUserSet = true;

                if (sel.role === 'upper') {
                    state.upperSlingLength = lenM;
                } else if (sel.role === 'leg') {
                    state.lowerSlingLength = lenM;
                } else if (sel.role === 'hanger') {
                    state.hangerSlingLength = lenM;
                    if (state.gear && state.gear.hangers) {
                        state.gear.hangers.forEach(h => {
                            if (h) { h.lengthM = lenM; h.userSet = true; }
                        });
                    }
                }
                markCableAdjustMode();

                if (typeof syncHookToRigTaut === 'function') syncHookToRigTaut();
                if (typeof syncCableRest === 'function') syncCableRest(false);
                rebuildCargoAndRig(false);
                if (typeof renderGearFields === 'function') renderGearFields();
                syncSlingSlidersFromState();
            };
            if (inpSel) inpSel.addEventListener('input', e => onSelectedChange(e.target.value, 'slider'));
            if (numSel) numSel.addEventListener('input', e => onSelectedChange(e.target.value, 'number'));

            // Mid-tier hanger controls (cascaded / truss 3-level)
            const inpHanger = document.getElementById('inp-hangerL');
            const numHanger = document.getElementById('num-hangerL');
            const onHangerChange = (valDisplay, source) => {
                const val = parseFloat(valDisplay);
                if (isNaN(val) || val <= 0) return;
                const minH = toDisplayLen(0.5);
                const maxH = toDisplayLen(20.0);
                const clampedVal = Math.min(maxH, Math.max(minH, val));
                if (source === 'slider' && numHanger) numHanger.value = clampedVal.toFixed(2);
                if (source === 'number' && inpHanger) inpHanger.value = clampedVal.toFixed(2);
                const vHanger = document.getElementById('v-hangerL');
                if (vHanger) vHanger.textContent = clampedVal.toFixed(2);
                const lblH = document.getElementById('lbl-hanger-len-indicator');
                if (lblH) lblH.textContent = `${clampedVal.toFixed(2)} m`;

                const mVal = fromInputLen(clampedVal);
                state.hangerSlingLength = mVal;
                state.slingUserSet = true;
                markCableAdjustMode();
                if (state.heldCableL0) state.heldCableL0.hanger = [];
                if (state.gear && state.gear.hangers) {
                    state.gear.hangers.forEach(h => {
                        if (h) { h.lengthM = mVal; h.userSet = true; }
                    });
                }
                if (typeof syncHookToRigTaut === 'function') syncHookToRigTaut();
                rebuildCargoAndRig(false);
                syncCableControlsSelection();
                updateRiggingBOMUI();
            };
            if (inpHanger) inpHanger.addEventListener('input', e => onHangerChange(e.target.value, 'slider'));
            if (numHanger) numHanger.addEventListener('input', e => onHangerChange(e.target.value, 'number'));
            document.querySelectorAll('.btn-step-hanger').forEach(btn => {
                btn.addEventListener('click', () => {
                    const delta = parseFloat(btn.dataset.delta || 0);
                    const cur = parseFloat(numHanger ? numHanger.value : (inpHanger ? inpHanger.value : state.hangerSlingLength));
                    onHangerChange(Math.max(0.5, +(cur + delta).toFixed(2)), 'number');
                });
            });
            document.querySelectorAll('.btn-preset-hanger').forEach(btn => {
                btn.addEventListener('click', () => {
                    const val = parseFloat(btn.dataset.val);
                    if (!isNaN(val)) onHangerChange(val, 'number');
                });
            });

            const btnCableAutoBal = document.getElementById('btn-cable-auto-balance');
            if (btnCableAutoBal) {
                btnCableAutoBal.addEventListener('click', () => {
                    autoLevelTurnbuckles();
                });
            }

            // Step & Preset Buttons for Tier 1
            document.querySelectorAll('.btn-step-tier1').forEach(btn => {
                btn.addEventListener('click', () => {
                    const delta = parseFloat(btn.dataset.delta || 0);
                    const cur = parseFloat(numUpper ? numUpper.value : (inpUpper ? inpUpper.value : state.upperSlingLength));
                    const next = Math.max(0.5, +(cur + delta).toFixed(2));
                    onUpperChange(next, 'number');
                });
            });
            document.querySelectorAll('.btn-preset-tier1').forEach(btn => {
                btn.addEventListener('click', () => {
                    const val = parseFloat(btn.dataset.val);
                    if (!isNaN(val)) onUpperChange(val, 'number');
                });
            });

            // Step & Preset Buttons for Tier 2
            document.querySelectorAll('.btn-step-tier2').forEach(btn => {
                btn.addEventListener('click', () => {
                    const delta = parseFloat(btn.dataset.delta || 0);
                    const cur = parseFloat(numLower ? numLower.value : (inpLower ? inpLower.value : state.lowerSlingLength));
                    const next = Math.max(0.3, +(cur + delta).toFixed(2));
                    onLowerChange(next, 'number');
                });
            });
            document.querySelectorAll('.btn-preset-tier2').forEach(btn => {
                btn.addEventListener('click', () => {
                    const val = parseFloat(btn.dataset.val);
                    if (!isNaN(val)) onLowerChange(val, 'number');
                });
            });

            // Step Buttons for Selected Cable
            document.querySelectorAll('.btn-step-selected').forEach(btn => {
                btn.addEventListener('click', () => {
                    const delta = parseFloat(btn.dataset.delta || 0);
                    const cur = parseFloat(numSel ? numSel.value : (inpSel ? inpSel.value : 3.8));
                    const next = Math.max(0.3, +(cur + delta).toFixed(2));
                    onSelectedChange(next, 'number');
                });
            });

            // 4. Quick Actions for Selected Cable
            const btnSyncTier = document.getElementById('btn-sync-to-tier');
            if (btnSyncTier) {
                btnSyncTier.addEventListener('click', () => {
                    const sel = (state.gear && state.gear.selection) ? state.gear.selection.find(s => s.kind === 'sling') : null;
                    if (!sel) return;
                    const rec = (typeof gearRecord === 'function') ? gearRecord(sel) : null;
                    if (!rec || rec.lengthM == null) return;

                    const targetLenM = rec.lengthM;
                    if (sel.role === 'upper') {
                        state.upperSlingLength = targetLenM;
                        state.slingLength = targetLenM;
                        (state.gear.uppers || []).forEach(u => { u.lengthM = null; u.userSet = false; });
                    } else if (sel.role === 'leg') {
                        state.lowerSlingLength = targetLenM;
                        (state.gear.legs || []).forEach(l => { l.lengthM = null; l.userSet = false; });
                    } else if (sel.role === 'hanger') {
                        state.hangerSlingLength = targetLenM;
                        (state.gear.hangers || []).forEach(h => { h.lengthM = null; h.userSet = false; });
                    }
                    state.slingUserSet = true;
                    markCableAdjustMode();
                    if (typeof syncHookToRigTaut === 'function') syncHookToRigTaut();
                    syncSlingSlidersFromState();
                    rebuildCargoAndRig(false);
                });
            }

            const btnResetAuto = document.getElementById('btn-reset-to-auto');
            if (btnResetAuto) {
                btnResetAuto.addEventListener('click', () => {
                    const sel = (state.gear && state.gear.selection) ? state.gear.selection.find(s => s.kind === 'sling') : null;
                    if (!sel) return;
                    const rec = (typeof gearRecord === 'function') ? gearRecord(sel) : null;
                    if (rec) {
                        rec.lengthM = null;
                        rec.userSet = false;
                    }
                    if (sel.role === 'upper') {
                        state.upperSlingLength = null;
                    } else if (sel.role === 'leg') {
                        state.lowerSlingLength = null;
                    } else if (sel.role === 'hanger') {
                        state.hangerSlingLength = null;
                    }
                    state.slingUserSet = false;
                    if (typeof syncHookToRigTaut === 'function') syncHookToRigTaut();
                    if (typeof syncCableRest === 'function') syncCableRest(false);
                    syncSlingSlidersFromState();
                    rebuildCargoAndRig(false);
                    if (typeof renderGearFields === 'function') renderGearFields();
                });
            }

            const btnClearSel = document.getElementById('btn-clear-cable-selection');
            if (btnClearSel) {
                btnClearSel.addEventListener('click', () => {
                    if (state.gear && state.gear.selection) {
                        state.gear.selection = state.gear.selection.filter(s => s.kind !== 'sling');
                    }
                    syncCableControlsSelection();
                    if (typeof updateGearSelectionRings === 'function') updateGearSelectionRings();
                    if (typeof renderGearFields === 'function') renderGearFields();
                });
            }

            // 5. WLL / SWL Controls
            const inpWll = document.getElementById('inp-wll');
            const numWll = document.getElementById('num-wll');
            const onWllChange = (valRaw, source) => {
                const val = parseFloat(valRaw);
                if (isNaN(val) || val <= 0) return;

                if (source === 'slider' && numWll) numWll.value = val.toFixed(1);
                if (source === 'number' && inpWll) inpWll.value = val.toFixed(1);
                const vWll = document.getElementById('v-wll');
                if (vWll) vWll.textContent = val.toFixed(1);

                state.wllPerLeg = val;
                if (!state._manualSlingDia) {
                    const getSpec = (typeof CAE !== 'undefined' && CAE.getSlingPhysicalSpec)
                        || (typeof window !== 'undefined' && window.CAE && window.CAE.getSlingPhysicalSpec);
                    if (getSpec) {
                        const spec = getSpec(state.slingType || 'wire', val);
                        state.slingDiaMm = spec.diaMm;
                        if (state.gear) {
                            (state.gear.uppers || []).forEach(u => { u.diaMm = spec.diaMm; });
                            (state.gear.legs || []).forEach(l => { l.diaMm = spec.diaMm; });
                        }
                    }
                }
                computeRiggingMassBreakdown();
                syncSlingSlidersFromState();
                updateRiggingBOMUI();
            };
            if (inpWll) inpWll.addEventListener('input', e => onWllChange(e.target.value, 'slider'));
            if (numWll) numWll.addEventListener('input', e => onWllChange(e.target.value, 'number'));

            // 5.1. Sling Diameter / Width Controls
            const inpSlingDia = document.getElementById('inp-sling-dia');
            const numSlingDia = document.getElementById('num-sling-dia');
            const btnAutoSlingDia = document.getElementById('btn-auto-sling-dia');
            const onSlingDiaChange = (valRaw, source) => {
                const val = parseFloat(valRaw);
                if (isNaN(val) || val <= 0) return;
                state._manualSlingDia = true;
                state.slingDiaMm = val;
                if (source === 'slider' && numSlingDia) numSlingDia.value = val;
                if (source === 'number' && inpSlingDia) inpSlingDia.value = val;
                if (state.gear) {
                    (state.gear.uppers || []).forEach(u => { u.diaMm = val; });
                    (state.gear.legs || []).forEach(l => { l.diaMm = val; });
                }
                computeRiggingMassBreakdown();
                syncSlingSlidersFromState();
                updateRiggingBOMUI();
            };
            if (inpSlingDia) inpSlingDia.addEventListener('input', e => onSlingDiaChange(e.target.value, 'slider'));
            if (numSlingDia) numSlingDia.addEventListener('input', e => onSlingDiaChange(e.target.value, 'number'));
            if (btnAutoSlingDia) {
                btnAutoSlingDia.addEventListener('click', () => {
                    state._manualSlingDia = false;
                    state.slingDiaMm = null;
                    const getSpec = (typeof CAE !== 'undefined' && CAE.getSlingPhysicalSpec)
                        || (typeof window !== 'undefined' && window.CAE && window.CAE.getSlingPhysicalSpec);
                    if (getSpec) {
                        const spec = getSpec(state.slingType || 'wire', state.wllPerLeg || 15.0);
                        state.slingDiaMm = spec.diaMm;
                        if (state.gear) {
                            (state.gear.uppers || []).forEach(u => { u.diaMm = spec.diaMm; });
                            (state.gear.legs || []).forEach(l => { l.diaMm = spec.diaMm; });
                        }
                    }
                    computeRiggingMassBreakdown();
                    syncSlingSlidersFromState();
                    updateRiggingBOMUI();
                });
            }

            // 6. Metric ⇄ Imperial Unit System Switcher
            const toggleUnitSystem = () => {
                state.unitSystem = state.unitSystem === 'imperial' ? 'metric' : 'imperial';
                syncSlingSlidersFromState();
                if (typeof renderGearFields === 'function') renderGearFields();

                const status = document.getElementById('sim-status-text');
                if (status) {
                    status.textContent = state.unitSystem === 'imperial'
                        ? (state.lang === 'en' ? '📐 Unit switched to Imperial (feet / inches).' : '📐 Đã chuyển sang Hệ đo Feet (ft) & Inch.')
                        : (state.lang === 'en' ? '📏 Unit switched to Metric (meters / mm).' : '📏 Đã chuyển sang Hệ đo Mét (m) & Milimét.');
                }
            };
            const btnUnitHeader = document.getElementById('btn-unit-toggle');
            if (btnUnitHeader) btnUnitHeader.addEventListener('click', toggleUnitSystem);
            const btnUnitPanel = document.getElementById('btn-unit-toggle-panel');
            if (btnUnitPanel) btnUnitPanel.addEventListener('click', toggleUnitSystem);

            // 7. Safety Presets (ASME B30.9 Minimum Safe vs Absolute Safe)
            const btnRigMinSafe = document.getElementById('btn-rig-min-safe');
            if (btnRigMinSafe) btnRigMinSafe.addEventListener('click', applyMinSafeRiggingPreset);
            const btnRigIdealSafe = document.getElementById('btn-rig-ideal-safe');
            if (btnRigIdealSafe) btnRigIdealSafe.addEventListener('click', applyAbsoluteSafeRiggingPreset);
        }

        // --- ASME B30.9 RIGGING SAFETY PRESET ENGINES ---
        function applyMinSafeRiggingPreset() {
            const spec = (typeof getRigSpec === 'function') ? getRigSpec() : null;
            const evenInt = (raw, lo, hi) => {
                let e = Math.round(raw / 2) * 2;
                if (e < lo) e = lo;
                if (e > hi) e = Math.ceil(raw / 2) * 2;
                return Math.max(lo, e);
            };
            // Working band: pull angle β ≈ 45°, even-integer lengths
            const minSafeUpper = evenInt(spec ? spec.recUpper : 8, 8, 10);
            const minSafeLower = evenInt(spec ? spec.recLower : 2, 2, 4);
            const minSafeHanger = evenInt(spec ? (spec.recHanger || 2) : 2, 2, 4);

            state.upperSlingLength = minSafeUpper;
            state.slingLength = minSafeUpper;
            state.slingUserSet = true;
            markCableAdjustMode();
            if (state.heldCableL0) state.heldCableL0.upper = [];

            if (state.gear && state.gear.uppers) {
                state.gear.uppers.forEach(u => {
                    if (u) { u.lengthM = minSafeUpper; u.userSet = true; }
                });
            }

            if (state.beamType !== 'none') {
                state.lowerSlingLength = minSafeLower;
                if (state.heldCableL0) state.heldCableL0.leg = [];
                if (state.gear && state.gear.legs) {
                    state.gear.legs.forEach(l => {
                        if (l) { l.lengthM = minSafeLower; l.userSet = true; }
                    });
                }
            }
            if (hasCascadedHangerTier()) {
                state.hangerSlingLength = minSafeHanger;
                if (state.heldCableL0) state.heldCableL0.hanger = [];
                if (state.gear && state.gear.hangers) {
                    state.gear.hangers.forEach(h => {
                        if (h) { h.lengthM = minSafeHanger; h.userSet = true; }
                    });
                }
            }

            if (typeof syncHookToRigTaut === 'function') syncHookToRigTaut();
            rebuildCargoAndRig(false);
            syncSlingSlidersFromState();
            syncCableControlsSelection();
            updateRiggingBOMUI();

            const status = document.getElementById('sim-status-text');
            if (status) {
                status.textContent = state.lang === 'en'
                    ? '🛡️ Preset: β ≈ 45°, upper 8/10 m, lower 2/4 m (even integers).'
                    : '🛡️ Đã áp dụng: góc kéo β ≈ 45°, cáp trên 8/10 m, cáp dưới 2/4 m (số chẵn).';
            }
        }

        function applyAbsoluteSafeRiggingPreset() {
            const spec = (typeof getRigSpec === 'function') ? getRigSpec() : null;
            const idealUpper = (spec && spec.recUpper) ? spec.recUpper : 8;
            const idealLower = (spec && spec.recLower) ? spec.recLower : 2;
            const idealHanger = (spec && spec.recHanger) ? spec.recHanger : 2;

            state.upperSlingLength = idealUpper;
            state.slingLength = idealUpper;
            state.slingUserSet = true;
            markCableAdjustMode();
            if (state.heldCableL0) state.heldCableL0.upper = [];

            if (state.gear && state.gear.uppers) {
                state.gear.uppers.forEach(u => {
                    if (u) { u.lengthM = idealUpper; u.userSet = true; }
                });
            }

            if (state.beamType !== 'none') {
                state.lowerSlingLength = idealLower;
                if (state.heldCableL0) state.heldCableL0.leg = [];
                if (state.gear && state.gear.legs) {
                    state.gear.legs.forEach(l => {
                        if (l) { l.lengthM = idealLower; l.userSet = true; }
                    });
                }
            }
            if (hasCascadedHangerTier()) {
                state.hangerSlingLength = idealHanger;
                if (state.heldCableL0) state.heldCableL0.hanger = [];
                if (state.gear && state.gear.hangers) {
                    state.gear.hangers.forEach(h => {
                        if (h) { h.lengthM = idealHanger; h.userSet = true; }
                    });
                }
            }

            if (typeof syncHookToRigTaut === 'function') syncHookToRigTaut();
            rebuildCargoAndRig(false);
            syncSlingSlidersFromState();
            syncCableControlsSelection();
            updateRiggingBOMUI();

            const status = document.getElementById('sim-status-text');
            if (status) {
                status.textContent = state.lang === 'en'
                    ? `⭐ Default plan: β ≈ 42.5°, upper ${idealUpper} m, lower ${idealLower} m` + (hasCascadedHangerTier() ? `, hanger ${idealHanger} m` : '') + '.'
                    : `⭐ Mặc định: góc kéo ~42.5°, cáp trên ${idealUpper} m, cáp dưới ${idealLower} m` + (hasCascadedHangerTier() ? `, treo ${idealHanger} m` : '') + '.';
            }
        }

        window.applyMinSafeRiggingPreset = applyMinSafeRiggingPreset;
        window.applyAbsoluteSafeRiggingPreset = applyAbsoluteSafeRiggingPreset;

        window.initSlingControls = initSlingControls;

        // 25% RIGHT-SIDE SLIDE-OVER DRAWER ARCHITECTURE
        let currentDrawerTab = 'cargo';
        let isDrawerOpen = false;

        function openRightDrawer(tabName) {
            if (tabName) currentDrawerTab = tabName;
            const drawer = document.getElementById('right-side-drawer');
            if (!drawer) return;

            // Close all dropdown menus to prevent overlap
            if (window.UI?.layout) window.UI.layout.closeAllMenus();

            // Dynamically fit drawer cleanly between top-bar and bottom of screen
            const topBar = document.getElementById('top-bar');
            const topH = (topBar ? topBar.offsetHeight : 44) || 44;
            drawer.style.top = `${topH}px`;
            drawer.style.bottom = '0px';

            // Switch page
            document.querySelectorAll('.drawer-page').forEach(page => page.classList.remove('active'));
            const targetPage = document.getElementById(`drawer-page-${currentDrawerTab}`);
            if (targetPage) targetPage.classList.add('active');

            const bodyContainer = drawer.querySelector('.drawer-body-container') || drawer.querySelector('div:last-child');
            if (bodyContainer) bodyContainer.scrollTop = 0;
            drawer.scrollTop = 0;
            if (targetPage) targetPage.scrollTop = 0;

            // Switch inner pills
            document.querySelectorAll('.drawer-inner-tab-btn').forEach(btn => {
                btn.classList.toggle('active', btn.dataset.drawerTab === currentDrawerTab);
            });

            // Switch footer nav buttons
            document.querySelectorAll('.drawer-nav-btn').forEach(btn => {
                btn.classList.toggle('active', btn.dataset.drawerTab === currentDrawerTab);
            });

            // Header titles & icons
            const tabTitles = {
                cargo: { icon: '📦', title: '1. Hàng Hóa & Trọng Tâm', sub: 'Kích thước, Khối lượng, Trọng tâm CoG & Hướng xoay' },
                lugs: { icon: '📍', title: '2. Điểm Nâng & Tai Cẩu', sub: 'Vị trí Pad-eye, Bích hàn & Bảo vệ góc cáp' },
                rig: { icon: '🟠', title: '3. Dầm Ngáng & Đòn Gánh', sub: 'Spreader, Lifting Beam, Tầng 1 & Tầng 2' },
                gear: { icon: '⛓️', title: '4. Cáp Treo & Phụ Kiện', sub: 'Sling cáp/xích, Shackle ma ní & Tải an toàn WLL' },
                crane: { icon: '🏗️', title: '5. Thiết Bị Cẩu & Móc', sub: 'Cần trục Liebherr, Móc cẩu & Biểu đồ tải LMI' },
                site: { icon: '🌍', title: '6. Hiện Trường & Sàn Kê', sub: 'Nền đất, Đà kê dunnage & Tải trọng gió' }
            };
            const t = tabTitles[currentDrawerTab] || tabTitles.cargo;
            const titleEl = document.getElementById('drawer-header-title');
            const iconEl = document.getElementById('drawer-header-icon');
            const subEl = document.getElementById('drawer-header-sub');
            if (titleEl) titleEl.textContent = t.title;
            if (iconEl) iconEl.textContent = t.icon;
            if (subEl) subEl.textContent = t.sub;

            drawer.classList.remove('drawer-closed');
            drawer.classList.add('drawer-open');
            if (typeof document !== 'undefined' && document.body) {
                document.body.classList.add('drawer-open');
            }
            isDrawerOpen = true;

            state.leftCollapsed = (currentDrawerTab !== 'cargo' && currentDrawerTab !== 'lugs');
            state.rightCollapsed = !state.leftCollapsed;
            syncSheetButtons();
            // Settle Auto framing into free-stage LEFT third (boot snap is handled under loader)
            requestAnimationFrame(() => {
                if (typeof window.invalidateUiSafeNdcCache === 'function') {
                    window.invalidateUiSafeNdcCache();
                }
                if (typeof window.markCameraViewSettled === 'function') {
                    window.markCameraViewSettled();
                } else if (state.cameraFollow) {
                    state.cameraFollow.suppressUiReframe = true;
                    state.cameraFollow.stableView = true;
                    if (state.cameraFollow.behavior === 'flycam') state.cameraFollow.behavior = 'cinema';
                    if (typeof window.syncCameraFollowUI === 'function') window.syncCameraFollowUI();
                }
                // Skip visible boot tween here — bootSimulator pre-frames under the loading screen
                if (state.cameraFollow && state.cameraFollow.bootThirdsPending) return;
                if (typeof window.reframeAutoToUiSafeCenter === 'function') {
                    window.reframeAutoToUiSafeCenter({ duration: 0.65, delay: 320 });
                }
            });
        }

        function closeRightDrawer() {
            const drawer = document.getElementById('right-side-drawer');
            if (!drawer) return;
            const wasOpen = isDrawerOpen || drawer.classList.contains('drawer-open');
            drawer.classList.add('drawer-closed');
            drawer.classList.remove('drawer-open');
            if (typeof document !== 'undefined' && document.body) {
                document.body.classList.remove('drawer-open');
            }
            isDrawerOpen = false;

            document.querySelectorAll('.drawer-nav-btn').forEach(btn => btn.classList.remove('active'));
            state.leftCollapsed = true;
            state.rightCollapsed = true;
            syncSheetButtons();
            if (wasOpen && typeof window.reframeAutoToUiSafeCenter === 'function') {
                window.reframeAutoToUiSafeCenter({ duration: 0.4, delay: 300 });
            }
        }

        function toggleRightDrawer(tabName) {
            if (isDrawerOpen && currentDrawerTab === tabName) {
                closeRightDrawer();
            } else {
                openRightDrawer(tabName);
            }
        }

        if (typeof window !== 'undefined' && typeof window.addEventListener === 'function') {
            window.addEventListener('resize', () => {
                if (isDrawerOpen) {
                    const topBar = document.getElementById('top-bar');
                    const drawer = document.getElementById('right-side-drawer');
                    if (drawer && topBar) {
                        const topH = (topBar ? topBar.offsetHeight : 44) || 44;
                        drawer.style.top = `${topH}px`;
                        drawer.style.bottom = '0px';
                    }
                }
            });
        }

        function syncSheetButtons() {
            const leftBtn = document.getElementById('btn-collapse-left');
            const rightBtn = document.getElementById('btn-collapse-right');
            if (leftBtn) leftBtn.textContent = state.leftCollapsed ? (state.lang === 'en' ? 'Shapes' : 'Hình thái') : (state.lang === 'en' ? 'Close' : 'Đóng kiện');
            if (rightBtn) rightBtn.textContent = state.rightCollapsed ? (state.lang === 'en' ? 'Arrange' : 'Bố trí') : (state.lang === 'en' ? 'Close' : 'Đóng dụng cụ');
        }

        function toggleLeftPanel(forceState) {
            if (typeof forceState === 'boolean') {
                if (forceState) closeRightDrawer();
                else openRightDrawer('cargo');
            } else {
                toggleRightDrawer('cargo');
            }
        }

        function toggleRightPanel(forceState) {
            if (typeof forceState === 'boolean') {
                if (forceState) closeRightDrawer();
                else openRightDrawer('rig');
            } else {
                toggleRightDrawer('rig');
            }
        }

        const UI_EN = {
            'Sẵn sàng mô phỏng': 'Ready',
            '1. Kiện': '1. Cargo',
            'Hình thái': 'Shapes',
            '2. Cẩu': '2. Crane',
            'Hạ': 'Lower',
            'Móc': 'Hook',
            'Kéo': 'Hoist',
            '3. Dụng cụ': '3. Gear',
            'Bố trí': 'Arrange',
            'Thư viện': 'Library',
            '4. Thông số': '4. Data',
            'Phiếu chọn': 'Selected',
            'Cố định': 'Fixed',
            'Cân bằng': 'Level',
            '5. Mô phỏng': '5. Simulate',
            'Nhấc thử': 'Trial lift',
            'Đong đưa': 'Swing',
            'Dừng': 'Stop',
            'Sẵn sàng': 'Ready',
            'Hạ đất': 'Set down',
            'Số liệu': 'Readout',
            'Góc': 'Views',
            'Lực': 'Forces',
            'Nhãn': 'Marks',
            'Kiện': 'Cargo',
            'Neo': 'Lugs',
            'Sự cố': 'Incident',
            'Hiện trường': 'Site',
            '1. Thư Viện Kiện Hàng 3D': '1. Cargo library',
            'Container lạnh': 'Refrigerated',
            'Mở nóc': 'Open top',
            'Sàn + vách đầu': 'Deck and end walls',
            'Container bồn': 'Tank container',
            'Sàn phẳng': 'Flat platform',
            '📦 Thùng Máy': '📦 Machinery case',
            'Gỗ/Thép': 'Timber / steel',
            '🛢️ Bồn Áp Lực': '🛢️ Pressure vessel',
            'Trụ ngang': 'Horizontal shell',
            '⚡ Biến Áp': '⚡ Transformer',
            'Lệch tâm': 'Offset CoG',
            '🚗 Xe Cơ Giới': '🚗 Vehicle',
            '🚢 Tàu Thủy': '🚢 Vessel',
            'Thân tàu + ca bin': 'Hull and cabin',
            '🚜 Máy Xúc': '🚜 Excavator',
            'Bánh xích': 'Crawler tracks',
            'Tua-bin gió': 'Wind turbine',
            '2. Kích Thước Hình Học & Tải Trọng': '2. Size and weight',
            'Dài (L):': 'Length (L):',
            'Rộng (W):': 'Width (W):',
            'Nặng (W):': 'Weight:',
            'Tấn': 't',
            '3. Đặt Trọng Tâm Kiện Hàng (3D CoG)': '3. Cargo centre of gravity',
            'Đưa Về Tâm 0': 'Centre it',
            'Mặt bằng LP & CoG': 'Plan of LP and CoG',
            'Lệch dọc X (eX):': 'Longitudinal offset X:',
            'Lệch ngang Z (eZ):': 'Transverse offset Z:',
            'Độ cao CoG (eY):': 'CoG height Y:',
            'Mẹo:': 'Tip:',
            'Bấm': 'Press',
            '🔍 X-Ray Hàng': 'X-Ray',
            'hoặc kéo trực tiếp quả cầu': 'or drag the',
            'trên 3D/Sơ đồ.': 'sphere in the 3D view or on the plan.',
            '4. Thiết Lập Điểm Neo (Lifting Points)': '4. Lifting points',
            'Đối Xứng 4 Góc': 'Symmetric corners',
            'Tai cẩu': 'Pad-eyes',
            'hàn sát vỏ thật': 'are welded to the real shell',
            'của kiện (không đặt theo hộp bao). Kéo LP trên bề mặt 3D, hoặc chỉnh tọa độ — điểm sẽ bám lại mặt vỏ.': 'of the cargo, not a bounding box. Drag an LP on the 3D surface, or edit the coordinates. The point snaps back to the shell.',
            'Vị trí lắp tai cẩu:': 'Pad-eye elevation:',
            'Trên Đỉnh Hàng': 'Top',
            'Giữa Thân': 'Mid-height',
            'Đáy Hàng': 'Bottom',
            'Cả 4': 'All 4',
            'Tọa độ Dọc LP (X):': 'LP longitudinal X:',
            'Tọa độ Ngang LP (Z):': 'LP transverse Z:',
            'Cao độ Tai cẩu (Y):': 'Pad-eye height Y:',
            'Tăng đơ chỉnh độ dài cáp (ΔL):': 'Turnbuckle length trim (ΔL):',
            '2C. Hướng Đặt & Góc Xoay Kiện Trên Nền Đất': '2C. Cargo Pre-Lift Ground Orientation',
            'Góc xoay hướng kiện (Yaw ψ):': 'Cargo heading yaw ψ:',
            'Hướng dầm ngáng:': 'Spreader heading:',
            'Dầm 0° Cẩu (Xiên)': 'Spreader 0° (Skew)',
            'Xoay theo kiện': 'Follow cargo',
            'Độ lệch kiện vs dầm (Δθ):': 'Cargo vs Spreader skew (Δθ):',
            '5. Góc Xoay, Hướng Xoay & Hướng Kéo': '5. Orientation and pull',
            'Đặt Lại 0°': 'Reset 0°',
            'Đặt kiện ở đúng góc sự cố khi còn trên mặt đất, bắt cáp, rồi kéo. Khi cáp căng, hàng được thả để vật lý xoay thật.': 'Set the incident angle while the cargo is on the ground, attach the rig, then hoist. Once the ropes go taut the cargo is free to rotate.',
            'KHÓA GÓC ĐẶT': 'POSE LOCKED',
            'Khóa lại góc này': 'Lock this pose',
            'Đứng thẳng': 'Upright',
            'Nghiêng 28°': 'Heel 28°',
            'Đổ nằm phải': 'Lay right',
            'Đổ nằm trái': 'Lay left',
            'Cắm đầu': 'Nose down',
            'Ngửa lệch': 'Nose up',
            'Góc Xoay Ngang Hàng (Yaw ψ):': 'Cargo yaw ψ:',
            '0° Chuẩn': '0° datum',
            'Góc Chúc Dọc (Pitch):': 'Pitch:',
            'Góc Nghiêng (Roll):': 'Roll:',
            '🧭 ĐIỀU KHIỂN HƯỚNG KÉO CẨU (PULL VECTOR)': 'PULL DIRECTION',
            'Thẳng đứng': 'Vertical',
            'Hướng Phương Vị Kéo (Azimuth φ):': 'Pull azimuth φ:',
            'Độ Lệch Tầm Kéo Ngang (Pull Offset R):': 'Horizontal pull offset R:',
            'Móc Cẩu Dọc (X):': 'Hook X:',
            'Móc Cẩu Ngang (Z):': 'Hook Z:',
            'Bối cảnh thao tác': 'Work site',
            '⚓ Cảng container': '⚓ Container port',
            'Bãi, cầu cảng, mặt nước': 'Yard, quay and water',
            '🌤️ Bãi ngoài trời': '🌤️ Open yard',
            'Sân công trường, trời sáng': 'Jobsite, daylight',
            '🏙️ Khu đông dân': '🏙️ Urban site',
            'Nhà, đường, người qua lại': 'Buildings, road and people',
            '🌊 Ngoài khơi': '🌊 Offshore',
            'Sàn thép trên biển': 'Steel deck at sea',
            'Mặt nền': 'Ground',
            'Phẳng': 'Flat',
            'Bê tông / sàn': 'Concrete / deck',
            'Đất đầm': 'Compacted soil',
            'Đường đất, có gỗ kê': 'Dirt, with dunnage',
            'Gồ ghề': 'Rough',
            'Mấp mô': 'Uneven',
            'Nền gồ ghề đổi điểm tiếp xúc của kiện. Khu đông dân cộng thêm mức rủi ro vì có người và công trình xung quanh.': 'Rough ground changes the contact points. An urban site adds risk from people and structures nearby.',
            '1. Phương Tiện Máy Cẩu (3D Cranes)': '1. Crane',
            'Bám theo Móc Cẩu': 'Tracks the hook',
            '🏗️ Cẩu Bờ Cảng LHM': '🏗️ Harbour crane',
            '🌉 Cẩu Giàn RTG/STS': '🌉 Gantry crane',
            '🚜 Cẩu Bánh Xích': '🚜 Crawler crane',
            '🚢 Cẩu Nổi Sà Lan': '🚢 Floating crane',
            '2. Phương Án Dầm Ngáng (Spreader Beams)': '2. Spreader arrangement',
            '🔗 Chùm 4 Cáp Chụm': '🔗 4-leg bridle',
            '🏗️ Dầm Ngáng Đơn H': '🏗️ Single spreader',
            '🟠 Hệ Ngáng Ống 2 Tầng': '🟠 Cascaded spreader',
            '🟧 Khung Ngáng Hộp': '🟧 Box frame',
            '➰ Cáp Vòng Ôm Đáy': '➰ Basket hitch',
            '📐 Dầm Giàn Không Gian': '📐 Truss spreader',
            '3. Kho Dây Cáp, Ma Ní & Móc (Gear Store)': '3. Rope, shackle and hook store',
            'Cáp Thép': 'Wire rope',
            'Xích G80': 'Grade 80 chain',
            'Cáp Vải': 'Webbing sling',
            'Ma Ní Omega': 'Bow shackle',
            'Ma Ní Chữ D': 'D shackle',
            'Móc Clevis': 'Clevis hook',
            'Chiều dài nhánh trên (L):': 'Upper leg length (L):',
            'WLL mỗi nhánh:': 'WLL per leg:',
            'Nhấp đúp dây cáp, ma ní, dầm hoặc móc trên mô hình để nhập SWL, chiều dài, kích thước và khối lượng. Giữ Ctrl và chọn nhiều món cùng loại để sửa một lúc. Góc cáp là đường thẳng giữa hai ma ní; mặc định ~40–45° so với phương ngang (cáp trên 8–10 m, cáp dưới 2–4 m). Đổi chiều dài thì góc đổi theo khẩu độ.': 'Double-click a rope, shackle, beam or the hook to edit SWL, length, size and weight. Ctrl-click selects several items of the same type. The rope angle is the line between the two pins. Defaults are ~40–45° to the horizontal (upper 8–10 m, lower 2–4 m). Changing the length changes the angle for the same span.',
            'Giữ Shift + kéo khung chuột để chọn nhiều thiết bị; thông số hiện bên trái và có thể cuộn. Nhấp đúp để sửa một món. Chuột trái xoay/kéo camera tự do — không còn bị khóa vào kiện hàng khi đang thao tác góc nhìn.': 'Hold Shift and drag a box to multi-select parts; parameters stack on the left and scroll. Double-click edits one item. Left-drag orbits the camera freely — the view is no longer locked to the cargo while you reframe.',
            '📊 Thông Số Kỹ Thuật & Tải Trọng Cáp': 'Rope engineering data',
            'CHUẨN AN TOÀN': 'WITHIN LIMITS',
            'Góc Cáp (Dọc α)': 'Rope angle from vertical α',
            'Ngang β: 61.5°': 'To horizontal β',
            'Độ Nghiêng Hàng': 'Out of level',
            'Cách sàn: 0.00m': 'Clearance',
            'Tổng Tải Móc Cẩu': 'Hook load',
            'LỰC CĂNG 4 NHÁNH CÁP (LP1 → LP4)': 'FOUR LEG TENSIONS (LP1 → LP4)',
            'CHƯA KÉO (CÁP CHÙNG)': 'SLACK — NOT HOISTING',
            '💡 Kiện hàng đang đặt trên đà gỗ kê (Dunnage). Bạn có thể kéo trực tiếp các điểm LP1-LP4 hoặc CoG, sau đó bấm': 'The cargo is on the dunnage. Drag LP1–LP4 or the CoG, then press',
            '🏗️ Nhấc Thử Tải': 'Trial lift',
            'Hư hỏng vỏ · Damage': 'Shell damage',
            'Rủi ro': 'Risk',
            'AN TOÀN': 'SAFE',
            'Cảng container': 'Container port',
            'Góc đặt đang khóa': 'Pose locked',
            '🎥 Góc Nhìn:': 'Camera:',
            'Góc Phối Cảnh 3D': 'Isometric',
            'Toàn Cảnh Máy Cẩu': 'Crane view',
            'Mặt Trước (Dọc)': 'Front',
            'Mặt Bên (Ngang)': 'Side',
            'Mặt Bằng (Từ Trên)': 'Plan',
            'Thông số thiết bị': 'Gear data',
            'Ctrl+nhấp đúp hoặc Alt+nhấp để mở phiếu kỹ thuật. Ctrl+nhấp gộp cùng loại.': 'Ctrl+double-click or Alt+click opens the data sheet. Ctrl+click adds another item of the same type.',
            'Nhấp bất kỳ chi tiết 3D để sửa thông số. Ctrl+nhấp để gộp cùng loại.': 'Click any 3D part to edit its data. Ctrl+click adds another item of the same type.',
            'Nhấp bất kỳ chi tiết 3D để sửa. Để trống chiều dài/SWL để theo thông số chung.': 'Click any 3D part to edit. Blank length or SWL follows the global slider.',
            'Giữ Shift + kéo khung chuột để chọn nhiều. Nhấp đúp một vật để sửa đơn. Cuộn panel trái để chỉnh từng mục.': 'Shift+drag a box to multi-select. Double-click one part for a single edit. Scroll the left panel to adjust each item.',
            'Giữ Shift + kéo khung để chọn. Cuộn xuống để chỉnh từng thiết bị.': 'Shift+drag a box to select. Scroll to edit each part below.',
            'Theo thông số chung · Use global': 'Use global',
            'Nối lại · Reeve': 'Reeve',
            'Bỏ chọn · Clear': 'Clear',
            'Hình thái kiện hàng': 'Cargo shape',
            'Di chuyển móc và cần cẩu': 'Move the hook and crane',
            'Mở hình thái kiện, kích thước, điểm neo': 'Open cargo shape, size and lifting points',
            'Giữ để hạ móc': 'Hold to lower the hook',
            'Giữ để kéo móc': 'Hold to hoist the hook',
            'Giữ để quay cần sang trái': 'Hold to slew left',
            'Giữ để quay cần sang phải': 'Hold to slew right',
            'Bố trí dụng cụ làm hàng': 'Arrange the lifting gear',
            'Mở kho cẩu, dầm, cáp, ma ní': 'Open the crane, beam, rope and shackle store',
            'Kho thư viện 3D, STL và ảnh': '3D library, STL and photos',
            'Thông số của món đang chọn': 'Data for the selected item',
            'Mở phiếu của cáp, ma ní, dầm hoặc móc đang chọn': 'Open the sheet for the selected rope, shackle, beam or hook',
            'Cố định: chỉ đổi món đang chọn. Auto: cáp đổi dài để vẫn lắp được.': 'Fixed: only the selected item changes. Auto: rope lengths retune so the rig still assembles.',
            'Chỉnh tăng đơ cho hàng nằm phẳng': 'Trim the turnbuckles so the cargo hangs level',
            'Chạy và xem mô phỏng': 'Run and review the simulation',
            'Kéo thử tải từ từ': 'Hoist a trial load slowly',
            'Tạo xung đong đưa': 'Apply a swing impulse',
            'Ghi thao tác': 'Record the operation',
            'Xem lại thao tác': 'Play the recording',
            'Dừng ghi hoặc phát': 'Stop recording or playback',
            'Hạ kiện về đà kê, giữ điểm neo': 'Set the cargo back on the dunnage and keep the lifting points',
            'Đưa toàn bộ về mặc định': 'Restore factory defaults',
            'Hiện số liệu tải': 'Show the load readout',
            'Hiện nút góc nhìn': 'Show the camera buttons',
            'Nhìn xuyên kiện': 'See through the cargo',
            'Nét CAD': 'CAD edges',
            'Mũi tên lực': 'Force arrows',
            'Nhãn điểm neo': 'Lifting-point labels',
            'Nhãn trọng tâm': 'CoG label',
            'Ẩn hoặc hiện toàn bộ nhãn': 'Hide or show every label',
            'Đóng các bảng để xem mô phỏng': 'Close the sheets and keep the view',
            'Switch language / Đổi ngôn ngữ': 'Switch language',
            '📦 TRUNG TÂM THƯ VIỆN THIẾT KẾ 3D & AI 3D RECONSTRUCTION STUDIO': '3D library and reconstruction studio',
            'STL / OBJ / GLB / ẢNH 2D → 3D': 'STL / OBJ / GLB / photo to 3D',
            'Quản lý kho Kiện hàng, Cần cẩu, Dầm ngáng, Phương án bắt cáp & Dụng cụ nâng hạ — Cho phép Upload file thiết kế in 3D hoặc Tạo khối 3D tự động từ Ảnh chụp': 'Cargo, cranes, spreaders, rigging plans and lifting gear. Upload a 3D file or build a solid from a photo.',
            '✕ Đóng & Quay Lại Mô Phỏng 3D': 'Close and return to the 3D view',
            '🗃️ Kiện Hàng 3D (': 'Cargo (',
            '🏗️ Máy Cẩu (': 'Cranes (',
            '🟠 Dầm Ngáng (': 'Spreaders (',
            '🔗 Phương Án Cáp (': 'Rigging plans (',
            '🪝 Kho Ma Ní & Móc (': 'Shackles and hooks (',
            'Tare 2.3 t + hàng, dải 18–24 t': 'Tare 2.3 t plus cargo, band 18–24 t',
            'Dải công nghiệp 26–30.5 t': 'Industrial band 26–30.5 t',
            'Container lạnh Reefer 40ft': '40 ft reefer container',
            'Mở nóc, khung cung': 'Open top, roof bows',
            'Sàn + hai vách đầu': 'Deck and two end walls',
            'Dải bồn 26–32 t': 'Tank band 26–32 t',
            'Sàn phẳng không vách': 'Flat deck, no walls',
            'Thùng Máy Công Nghiệp': 'Industrial machinery case',
            'Khung dầm thép gia cường': 'Stiffened steel frame',
            'Bồn Áp Lực ASME': 'ASME pressure vessel',
            'Dải bồn chịu áp 28–55 t': 'Pressure-vessel band 28–55 t',
            'Máy Biến Áp 110kV': '110 kV transformer',
            'Dải máy biến áp 45–85 t': 'Transformer band 45–85 t',
            'Xe Bán Tải / SUV': 'Vehicle',
            'Dải xe 2.4–3.2 t': 'Vehicle band 2.4–3.2 t',
            'Tàu Lai Công Tác': 'Workboat',
            'Dải tàu 22–45 t': 'Vessel band 22–45 t',
            'Tua-bin Điện Gió (Nacelle)': 'Wind-turbine nacelle',
            'Dải nacelle 65–95 t': 'Nacelle band 65–95 t',
            'Máy Xúc Đào Bánh Xích': 'Crawler excavator',
            '🎯 CoG (Kéo 3D)': 'CoG — drag in 3D',
            '🔍 Xem 3D': 'View 3D',
            'Chọn Dùng': 'Use this',
            'Đặt Tên Vật Phẩm / Thiết Bị 3D:': 'Item name:',
            'Phân Loại Vào Kho Thư Viện:': 'Library category:',
            '📂 Bấm chọn File 3D (.STL, .OBJ, .GLB) từ máy tính': 'Choose a 3D file (.STL, .OBJ, .GLB)',
            'Bấm chọn File 3D (.STL, .OBJ, .GLB) từ máy tính': 'Choose a 3D file (.STL, .OBJ, .GLB)',
            'Chưa chọn file (Hoặc bấm nút Tạo Mẫu STL Thử Nghiệm bên dưới)': 'No file selected',
            '🖼️ Chọn Tấm Hình Vật Phẩm (.PNG, .JPG, .WEBP)': 'Choose a photo (.PNG, .JPG, .WEBP)',
            'Chọn Tấm Hình Vật Phẩm (.PNG, .JPG, .WEBP)': 'Choose a photo (.PNG, .JPG, .WEBP)',
            'Tự động tách nền & đùn khối nổi 3D': 'Remove the background and extrude a 3D solid'
        };

        function libText(s) {
            if (!s) return '';
            if (state.lang !== 'en') return s;
            return UI_EN[s] || s;
        }

        function applyPhrases(root) {
            const walker = document.createTreeWalker(root || document.body, NodeFilter.SHOW_TEXT);
            const nodes = [];
            while (walker.nextNode()) nodes.push(walker.currentNode);
            nodes.forEach(node => {
                const raw = node.nodeValue;
                if (!raw || !raw.trim()) return;
                if (!node.__vi) node.__vi = raw.trim();
                const en = UI_EN[node.__vi];
                if (!en) return;
                const lead = raw.match(/^\s*/)[0];
                const tail = raw.match(/\s*$/)[0];
                node.nodeValue = lead + (state.lang === 'en' ? en : node.__vi) + tail;
            });
            (root || document.body).querySelectorAll('[title]').forEach(el => {
                if (!el.dataset.viTitle) el.dataset.viTitle = el.getAttribute('title') || '';
                const en = UI_EN[el.dataset.viTitle];
                if (!en) return;
                el.setAttribute('title', state.lang === 'en' ? en : el.dataset.viTitle);
            });
        }

        function applyLang() {
            applyPhrases(document.body);
            document.querySelectorAll('[data-i18n]').forEach(el => { el.textContent = bi(el.dataset.i18n); });
            const buttons = {
                'btn-reset-initial': ['Hạ đất', 'Set down'],
                'btn-set-baseline': ['📌 Đặt Mốc Đầu', '📌 Set Home'],
                'btn-reset-all': ['🔴 Reset', '🔴 Reset'],
                'btn-hoist-down': ['Hạ', 'Lower'],
                'btn-hoist-up': ['Kéo', 'Hoist'],
                'btn-pretension': ['⚡ Nhớm cáp', '⚡ Snug rig'],
                'btn-test-lift': ['Nhấc thử', 'Trial lift'],
                'btn-swing-test': ['Đong đưa', 'Swing'],
                'btn-slew-left': ['⟲', '⟲'],
                'btn-slew-right': ['⟳', '⟳'],
                'btn-rec': ['Ghi', 'Record'],
                'btn-replay': ['Xem', 'Play'],
                'btn-replay-stop': ['Dừng', 'Stop'],
                'btn-auto-level': ['Cân bằng', 'Level'],
                'btn-cable-auto-balance': ['⚖️ Auto cân bằng (tính lại chiều dài cáp)', '⚖️ Auto-balance (recalc cable lengths)'],
                'btn-xray': ['X-Ray', 'X-Ray'],
                'btn-toggle-cad-edges': ['CAD', 'CAD'],
                'btn-toggle-vectors': ['Lực', 'Force'],
                'btn-toggle-lp-labels': ['LP', 'LP'],
                'btn-toggle-cog-label': ['CoG', 'CoG']
            };
            Object.keys(buttons).forEach(id => {
                const el = document.getElementById(id);
                if (!el) return;
                const pair = buttons[id];
                el.textContent = state.lang === 'en' ? pair[1] : pair[0];
                el.title = el.textContent;
            });
            syncResetButtonState();
            document.querySelectorAll('.cam-btn').forEach(btn => {
                const map = {
                    iso: ['📐 Iso', '📐 Iso'],
                    hook: ['🪝 Móc', '🪝 Hook'],
                    front: ['⬆️ Đứng', '⬆️ Front'],
                    side: ['➡️ Bên', '➡️ Side'],
                    top: ['📄 Bằng', '📄 Plan'],
                    crane: ['🏗️ Cẩu', '🏗️ Crane']
                };
                const pair = map[btn.dataset.cam];
                if (!pair) return;
                btn.textContent = state.lang === 'en' ? pair[1] : pair[0];
                btn.title = btn.textContent;
            });
            const langBtn = document.getElementById('btn-lang');
            if (langBtn) langBtn.textContent = state.lang === 'vi' ? 'EN' : 'VI';
            toggleLeftPanel(state.leftCollapsed);
            toggleRightPanel(state.rightCollapsed);
            const full = document.getElementById('btn-fullscreen-view');
            if (full) {
                const hidden = state.leftCollapsed && state.rightCollapsed;
                full.textContent = hidden ? (state.lang === 'en' ? 'Sheets' : 'Bảng') : 'Full';
                full.title = hidden
                    ? L('Open the data sheet', 'Mở bảng thông số')
                    : L('Close the sheets and keep the view', 'Đóng bảng, chỉ xem mô phỏng');
            }
            const allHidden = !state.showVectors && !state.showLPLabels && !state.showCoGLabel;
            const hideBtn = document.getElementById('btn-hide-all-indicators');
            if (hideBtn) hideBtn.textContent = allHidden
                ? (state.lang === 'en' ? 'Marks' : 'Nhãn')
                : (state.lang === 'en' ? 'Hide' : 'Ẩn');
            syncSoundButton();
            if (state.gear.selection.length) openGearEditor();
            if (typeof syncSlingSlidersFromState === 'function') syncSlingSlidersFromState();
        }

        function syncSoundButton() {
            const btn = document.getElementById('btn-sound-toggle');
            if (!btn || typeof simAudio === 'undefined') return;
            const muted = simAudio.isMuted();
            btn.textContent = muted
                ? (state.lang === 'en' ? '🔇 Muted' : '🔇 Tắt')
                : (state.lang === 'en' ? '🔊 Audio' : '🔊 Âm thanh');
            btn.classList.toggle('active', !muted);
            btn.classList.toggle('text-slate-400', muted);
            btn.title = muted
                ? (state.lang === 'en' ? 'Unmute sound effects (M)' : 'Bật âm thanh mô phỏng (M)')
                : (state.lang === 'en' ? 'Mute sound effects (M)' : 'Tắt âm thanh mô phỏng (M)');
        }

        function setupUIEvents() {
            bindGearEditor();
            const btnSound = document.getElementById('btn-sound-toggle');
            if (btnSound) {
                btnSound.addEventListener('click', () => {
                    if (typeof simAudio !== 'undefined') {
                        simAudio.toggleMute();
                        syncSoundButton();
                    }
                });
                syncSoundButton();
            }
            const langBtn = document.getElementById('btn-lang');
            if (langBtn) langBtn.addEventListener('click', () => {
                state.lang = state.lang === 'vi' ? 'en' : 'vi';
                applyLang();
            });

            // Photorealistic Graphics & HDRI Atmosphere Controls
            const selGfxPreset = document.getElementById('sel-gfx-preset');
            if (selGfxPreset) {
                selGfxPreset.addEventListener('change', e => {
                    const em = window.envManager || envManager;
                    if (em) em.applyPreset(e.target.value);
                });
            }
            const selGfxQuality = document.getElementById('sel-gfx-quality');
            if (selGfxQuality) {
                selGfxQuality.addEventListener('change', e => {
                    const sr = window.sceneRenderer || sceneRenderer;
                    if (sr) sr.setQuality(e.target.value);
                });
            }
            const btnUploadHdri = document.getElementById('btn-upload-hdri');
            const inpHdri = document.getElementById('inp-custom-hdri');
            if (btnUploadHdri && inpHdri) {
                btnUploadHdri.addEventListener('click', () => inpHdri.click());
                inpHdri.addEventListener('change', async e => {
                    const file = e.target.files && e.target.files[0];
                    const em = window.envManager || envManager;
                    if (!file || !em) return;
                    try {
                        btnUploadHdri.textContent = '⏳ Nạp...';
                        await em.loadHDREnvironment(file);
                        btnUploadHdri.textContent = '✅ ' + file.name.slice(0, 8);
                    } catch (err) {
                        console.error('[Graphics] Failed to load custom HDRI:', err);
                        alert('Lỗi nạp file HDRI/EXR: ' + (err.message || err));
                        btnUploadHdri.textContent = '❌ Lỗi';
                    }
                });
            }


            // Right-Side Drawer Navigation Buttons
            document.querySelectorAll('.drawer-nav-btn').forEach(btn => {
                btn.addEventListener('click', () => {
                    toggleRightDrawer(btn.dataset.drawerTab);
                });
            });

            document.querySelectorAll('.drawer-inner-tab-btn').forEach(btn => {
                btn.addEventListener('click', () => {
                    openRightDrawer(btn.dataset.drawerTab);
                });
            });

            const btnCloseDrawer = document.getElementById('btn-close-drawer');
            if (btnCloseDrawer) {
                btnCloseDrawer.addEventListener('click', () => {
                    closeRightDrawer();
                });
            }

            const btnToggleDrawer = document.getElementById('btn-toggle-drawer');
            if (btnToggleDrawer) {
                btnToggleDrawer.addEventListener('click', () => {
                    toggleRightDrawer(currentDrawerTab || 'cargo');
                });
            }

            // 1. Panel Collapse & Fullscreen Clean View Buttons
            document.getElementById('btn-collapse-left').addEventListener('click', () => toggleLeftPanel());
            document.getElementById('btn-rig-fit').addEventListener('click', () => {
                state.rigFit = state.rigFit === 'auto' ? 'fixed' : 'auto';
                if (state.rigFit === 'auto') {
                    state.holdCableLength = false;
                    state.heldCableL0 = null;
                    (state.gear.extraCables || []).forEach(ex => { ex.userSet = false; });
                    syncCableRest(true);
                } else holdCableLengths();
                syncRigFitButton();
                const status = document.getElementById('sim-status-text');
                if (status) status.textContent = state.rigFit === 'auto'
                    ? 'Chế độ Auto: đổi một kích thước thì cáp co giãn theo để vẫn lắp được.'
                    : 'Chế độ cố định: chỉ đổi đúng món đang chọn. Chỗ không lắp được hiện thanh đỏ.';
            });
            document.getElementById('btn-gear-sheet').addEventListener('click', () => {
                if (!state.gear.selection.length) {
                    const status = document.getElementById('sim-status-text');
                    if (status) status.textContent = 'Bấm một sợi cáp, ma ní, dầm hoặc móc trên mô hình để mở thông số.';
                    return;
                }
                openGearEditor();
            });
            document.getElementById('btn-toggle-hud').addEventListener('click', () => {
                document.body.classList.toggle('show-hud');
            });
            document.getElementById('btn-toggle-cam').addEventListener('click', () => {
                document.body.classList.toggle('show-cam');
            });
            syncRigFitButton();
            restoreUserRigs();
            document.getElementById('btn-collapse-right').addEventListener('click', () => toggleRightPanel());

            const btnFull = document.getElementById('btn-fullscreen-view');
            btnFull.addEventListener('click', () => {
                const gear = document.getElementById('gear-editor');
                const gearOpen = gear && gear.style.display !== 'none' && gear.style.display !== '';
                const any = !state.leftCollapsed || !state.rightCollapsed || gearOpen;
                if (any) {
                    state.leftCollapsed = true;
                    state.rightCollapsed = true;
                    if (gear) gear.style.display = 'none';
                    document.body.classList.remove('gear-editor-open');
                    syncSheetButtons();
                } else toggleLeftPanel(false);
            });

            window.addEventListener('keydown', e => {
                if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.tagName === 'SELECT') return;
                if (window.UI?.layout?.shouldSuspend3DHotkeys()) {
                    if (e.key === 'Escape') {
                        if (window.UI.layout.handleEscape()) {
                            e.preventDefault();
                            return;
                        }
                    }
                    return;
                }
                if (e.key === 'Escape') {
                    if (window.UI?.layout && window.UI.layout.handleEscape()) {
                        e.preventDefault();
                        return;
                    }
                }
                if (e.key === 'F1' || e.key === '1') { e.preventDefault(); toggleRightDrawer('cargo'); }
                if (e.key === 'F2' || e.key === '2') { e.preventDefault(); toggleRightDrawer('lugs'); }
                if (e.key === 'F3' || e.key === '3') { e.preventDefault(); toggleRightDrawer('rig'); }
                if (e.key === 'F4' || e.key === '4') { e.preventDefault(); toggleRightDrawer('gear'); }
                if (e.key === 'F5' || e.key === '5') { e.preventDefault(); toggleRightDrawer('crane'); }
                if (e.key === 'F6' || e.key === '6') { e.preventDefault(); toggleRightDrawer('site'); }
                if (e.key === 'h' || e.key === 'H') btnFull.click();
                if (e.key === 'm' || e.key === 'M') {
                    if (typeof simAudio !== 'undefined') {
                        simAudio.toggleMute();
                        syncSoundButton();
                    }
                }
            });
            syncResetButtonState();

            // 3. X-Ray Cargo Toggle
            const btnXray = document.getElementById('btn-xray');
            btnXray.addEventListener('click', () => {
                state.xrayCargo = !state.xrayCargo;
                btnXray.classList.toggle('border-sky-400', state.xrayCargo);
                btnXray.classList.toggle('text-sky-300', state.xrayCargo);
                rebuildCargoAndRig(false);
            });

            // 4. Crane Vehicle Selector
            const craneCards = document.querySelectorAll('#crane-store .card-btn');
            craneCards.forEach(card => {
                card.addEventListener('click', () => {
                    craneCards.forEach(c => c.classList.remove('active'));
                    card.classList.add('active');
                    state.craneType = card.dataset.crane;
                    buildCraneVehicle();
                });
            });

            // 5. Cargo Library Cards
            const cargoCards = document.querySelectorAll('#cargo-library .card-btn');
            cargoCards.forEach(card => {
                card.addEventListener('click', () => {
                    cargoCards.forEach(c => c.classList.remove('active'));
                    card.classList.add('active');
                    const type = card.dataset.cargo;
                    state.cargoType = type;
                    state.slingUserSet = false;
                    state.upperSlingLength = null;
                    state.lowerSlingLength = null;
                    releaseBeamLengthOverrides();
                    state.legDeltaL = [0, 0, 0, 0];
                    state.cargoYawDeg = 0;
                    state.cargoPitchTrimDeg = 0;
                    state.cargoRollTrimDeg = 0;
                    state.poseLock = true;
                    const preset = libraryCatalog.cargo.find(item => item.id === type);
                    if (preset && preset.L) {
                        state.weightUserSet = false;
                        state.isoCode = preset.isoCode || null;
                        state.tareT = preset.tareT != null ? preset.tareT : null;
                        state.maxPayloadT = preset.maxPayloadT != null ? preset.maxPayloadT : null;
                        state.maxGrossT = preset.maxGrossT != null ? preset.maxGrossT : null;
                        setDimAndCoG({
                            L: preset.L, W: preset.W, H: preset.H,
                            weight: calibratedWeight(type, preset.L, preset.W, preset.H) || preset.weight,
                            cogX: preset.cogX || 0, cogY: preset.cogY || 0, cogZ: preset.cogZ || 0
                        });
                    } else {
                        state.isoCode = null;
                        state.tareT = null;
                        state.maxPayloadT = null;
                        state.maxGrossT = null;
                    }
                    syncOogCargoUI(true);
                    syncOrientationAndPullUI();
                    rebuildCargoAndRig(true);
                    resetToInitialPreLiftState();
                });
            });

            // 5B. OOG Cargo & Tarpaulin Controls (Open Top / Flat Rack)
            const btnOogCargo = document.getElementById('btn-oog-has-cargo');
            if (btnOogCargo) {
                btnOogCargo.addEventListener('click', () => {
                    state.oogHasCargo = !state.oogHasCargo;
                    if (!state.weightUserSet) {
                        const tare = state.tareT != null ? state.tareT
                            : ((state.cargoType === 'flatrack' || state.cargoType === 'flatrack20') ? 4.8
                                : ((state.cargoType === 'platform' || state.cargoType === 'platform20') ? 5.5 : 2.4));
                        const loadedW = calibratedWeight(state.cargoType, state.L, state.W, state.H) || 20.0;
                        state.weight = state.oogHasCargo ? Math.round(loadedW * 10) / 10 : tare;
                        const wEl = document.getElementById('inp-Weight');
                        const wv = document.getElementById('v-Weight');
                        if (wEl) wEl.value = state.weight;
                        if (wv) wv.textContent = state.weight.toFixed(1);
                    }
                    syncOogCargoUI(false);
                    rebuildCargoAndRig(false);
                });
            }
            const btnOogTarp = document.getElementById('btn-oog-tarp');
            if (btnOogTarp) {
                btnOogTarp.addEventListener('click', () => {
                    state.oogTarp = !state.oogTarp;
                    syncOogCargoUI(false);
                    rebuildCargoAndRig(false);
                });
            }
            const bindOogSlider = (id, key) => {
                const el = document.getElementById(`inp-${id}`);
                const vEl = document.getElementById(`v-${id}`);
                if (!el) return;
                el.addEventListener('input', e => {
                    let val = parseFloat(e.target.value);
                    const isOT = state.cargoType === 'opentop' || state.cargoType === 'opentop40';
                    if (isOT && key === 'oogCargoW') val = Math.min(val, Math.max(0.85, state.W - 0.40));
                    if (isOT && key === 'oogCargoL') val = Math.min(val, Math.max(1.2, state.L - 0.40));
                    state[key] = val;
                    if (vEl) vEl.textContent = state[key].toFixed(2);
                    syncOogCargoUI(false);
                    rebuildCargoAndRig(false);
                });
            };
            bindOogSlider('oogH', 'oogCargoH');
            bindOogSlider('oogW', 'oogCargoW');
            bindOogSlider('oogL', 'oogCargoL');

            // 6. Individual LP1-LP4 Selector Tabs & Sliders
            document.querySelectorAll('#lp-tabs button').forEach(btn => {
                btn.addEventListener('click', () => selectLPTab(btn.dataset.lp));
            });

            document.getElementById('btn-sym-lugs').addEventListener('click', () => {
                state.legDeltaL = [0, 0, 0, 0];
                selectLPTab('all');
                rebuildCargoAndRig(true);
            });

            const elevBtns = document.querySelectorAll('#lug-elevation-group button');
            elevBtns.forEach(btn => {
                btn.addEventListener('click', () => {
                    elevBtns.forEach(b => b.className = 'px-2 py-0.5 rounded text-[10px] font-bold bg-slate-700 text-slate-300');
                    btn.className = 'px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-600 text-white';
                    state.lugElevPreset = btn.dataset.elev;
                    state.pendingConform = 'preset';
                    rebuildCargoAndRig(false);
                });
            });

            document.getElementById('inp-lpX').addEventListener('input', e => {
                const val = parseFloat(e.target.value);
                document.getElementById('v-lpX').textContent = val.toFixed(2);
                if (state.selectedLP === 'all') {
                    const d = Math.abs(val);
                    state.lugs[0].x = d; state.lugs[1].x = -d; state.lugs[2].x = -d; state.lugs[3].x = d;
                } else {
                    state.lugs[parseInt(state.selectedLP, 10)].x = val;
                }
                rebuildCargoAndRig(false);
            });

            document.getElementById('inp-lpZ').addEventListener('input', e => {
                const val = parseFloat(e.target.value);
                document.getElementById('v-lpZ').textContent = val.toFixed(2);
                if (state.selectedLP === 'all') {
                    const d = Math.abs(val);
                    state.lugs[0].z = d; state.lugs[1].z = d; state.lugs[2].z = -d; state.lugs[3].z = -d;
                } else {
                    state.lugs[parseInt(state.selectedLP, 10)].z = val;
                }
                rebuildCargoAndRig(false);
            });

            document.getElementById('inp-lpY').addEventListener('input', e => {
                const val = parseFloat(e.target.value);
                document.getElementById('v-lpY').textContent = val.toFixed(2);
                if (state.selectedLP === 'all') {
                    state.lugs.forEach(p => { p.y = val; });
                } else {
                    state.lugs[parseInt(state.selectedLP, 10)].y = val;
                }
                rebuildCargoAndRig(false);
            });

            document.getElementById('inp-lpDeltaL').addEventListener('input', e => {
                const val = parseFloat(e.target.value);
                document.getElementById('v-lpDeltaL').textContent = (val >= 0 ? '+' : '') + val.toFixed(2);
                if (state.selectedLP === 'all') {
                    state.legDeltaL = [val, val, val, val];
                } else {
                    state.legDeltaL[parseInt(state.selectedLP, 10)] = val;
                }
            });

            // 7. Interactive 2D Map Click/Drag to place CoG
            const mapCanvas = document.getElementById('cog-map-canvas');
            let isDraggingMap = false;
            const updateCoGFromMap = ev => {
                const rect = mapCanvas.getBoundingClientRect();
                const mx = ev.clientX - rect.left;
                const mz = ev.clientY - rect.top;
                const sc = Math.min((mapCanvas.width - 20) / state.L, (mapCanvas.height - 18) / state.W);
                state.cogX = THREE.MathUtils.clamp((mx - mapCanvas.width / 2) / sc, -state.L * 0.45, state.L * 0.45);
                state.cogZ = THREE.MathUtils.clamp((mz - mapCanvas.height / 2) / sc, -state.W * 0.45, state.W * 0.45);
                syncCoGSlidersFromState();
                rebuildCargoAndRig(false);
            };
            mapCanvas.addEventListener('pointerdown', ev => { isDraggingMap = true; updateCoGFromMap(ev); });
            window.addEventListener('pointermove', ev => { if (isDraggingMap) updateCoGFromMap(ev); });
            window.addEventListener('pointerup', () => { isDraggingMap = false; });

            // 8. Dimensions & CoG Sliders and Stepper/Preset Inputs
            const bindSlider = (id, key, dec, resetSymLugs = false) => {
                const el = document.getElementById(`inp-${id}`);
                const vEl = document.getElementById(`v-${id}`);
                const numEl = document.getElementById(`num-${id}`);
                if (el) {
                    el.addEventListener('input', e => {
                        const val = parseFloat(e.target.value);
                        state[key] = val;
                        if (key === 'slingLength') {
                            state.slingUserSet = true;
                            if (state.heldCableL0) state.heldCableL0.upper = [];
                        }
                        if (key === 'weight') state.weightUserSet = true;
                        if ((key === 'L' || key === 'W' || key === 'H') && !state.weightUserSet) {
                            const w = calibratedWeight(state.cargoType, state.L, state.W, state.H);
                            if (w) {
                                state.weight = Math.round(w * 10) / 10;
                                const wEl = document.getElementById('inp-Weight');
                                const wv = document.getElementById('v-Weight');
                                const wn = document.getElementById('num-Weight');
                                if (wEl) wEl.value = state.weight;
                                if (wv) wv.textContent = state.weight.toFixed(1);
                                if (wn) wn.value = state.weight.toFixed(1);
                            }
                        }
                        if (vEl) vEl.textContent = val.toFixed(dec);
                        if (numEl && document.activeElement !== numEl) numEl.value = val.toFixed(dec);
                        rebuildCargoAndRig(resetSymLugs);
                    });
                }
                if (numEl) {
                    numEl.addEventListener('change', e => {
                        const val = parseFloat(e.target.value);
                        if (isNaN(val) || val <= 0) return;
                        state[key] = val;
                        if (key === 'weight') state.weightUserSet = true;
                        if (el) el.value = val;
                        if (vEl) vEl.textContent = val.toFixed(dec);
                        rebuildCargoAndRig(resetSymLugs);
                    });
                }
            };
            bindSlider('L', 'L', 2, true);
            bindSlider('W', 'W', 2, true);
            bindSlider('H', 'H', 2, true);
            bindSlider('Weight', 'weight', 1, false);
            bindSlider('cogX', 'cogX', 2, false);
            bindSlider('cogZ', 'cogZ', 2, false);
            bindSlider('cogY', 'cogY', 2, false);

            // Stepper and Preset Buttons for Cargo Dimensions & Weight
            document.querySelectorAll('.btn-step-cargo').forEach(btn => {
                btn.addEventListener('click', () => {
                    const target = btn.dataset.target;
                    const delta = parseFloat(btn.dataset.delta || 0);
                    const cur = state[target] || 0;
                    const next = Math.max(0.2, +(cur + delta).toFixed(2));
                    state[target] = next;
                    if (target === 'weight') state.weightUserSet = true;
                    const numEl = document.getElementById(`num-${target === 'weight' ? 'Weight' : target}`);
                    const inpEl = document.getElementById(`inp-${target === 'weight' ? 'Weight' : target}`);
                    const vEl = document.getElementById(`v-${target === 'weight' ? 'Weight' : target}`);
                    if (numEl) numEl.value = next.toFixed(2);
                    if (inpEl) inpEl.value = next;
                    if (vEl) vEl.textContent = next.toFixed(2);
                    rebuildCargoAndRig(target === 'L' || target === 'W' || target === 'H');
                });
            });

            document.querySelectorAll('.btn-preset-cargo').forEach(btn => {
                btn.addEventListener('click', () => {
                    const target = btn.dataset.target;
                    const val = parseFloat(btn.dataset.val);
                    if (isNaN(val)) return;
                    state[target] = val;
                    if (target === 'weight') state.weightUserSet = true;
                    const numEl = document.getElementById(`num-${target === 'weight' ? 'Weight' : target}`);
                    const inpEl = document.getElementById(`inp-${target === 'weight' ? 'Weight' : target}`);
                    const vEl = document.getElementById(`v-${target === 'weight' ? 'Weight' : target}`);
                    if (numEl) numEl.value = val.toFixed(2);
                    if (inpEl) inpEl.value = val;
                    if (vEl) vEl.textContent = val.toFixed(2);
                    rebuildCargoAndRig(target === 'L' || target === 'W' || target === 'H');
                });
            });

            // OOG Steppers and Inputs
            const bindOogField = (id, key) => {
                const numEl = document.getElementById(`num-${id}`);
                const inpEl = document.getElementById(`inp-${id}`);
                const vEl = document.getElementById(`v-${id}`);
                if (numEl) {
                    numEl.addEventListener('change', e => {
                        const val = parseFloat(e.target.value);
                        if (isNaN(val) || val <= 0) return;
                        state[key] = val;
                        if (inpEl) inpEl.value = val;
                        if (vEl) vEl.textContent = val.toFixed(2);
                        rebuildCargoAndRig(false);
                    });
                }
            };
            bindOogField('oogH', 'oogCargoH');
            bindOogField('oogW', 'oogCargoW');
            bindOogField('oogL', 'oogCargoL');

            document.querySelectorAll('.btn-step-oog').forEach(btn => {
                btn.addEventListener('click', () => {
                    const target = btn.dataset.target;
                    const delta = parseFloat(btn.dataset.delta || 0);
                    const stateKey = target === 'oogH' ? 'oogCargoH' : (target === 'oogW' ? 'oogCargoW' : 'oogCargoL');
                    const cur = state[stateKey] || 0;
                    let next = Math.max(0.5, +(cur + delta).toFixed(2));
                    const isOT = state.cargoType === 'opentop' || state.cargoType === 'opentop40';
                    if (isOT && stateKey === 'oogCargoW') next = Math.min(next, Math.max(0.85, state.W - 0.40));
                    if (isOT && stateKey === 'oogCargoL') next = Math.min(next, Math.max(1.2, state.L - 0.40));
                    state[stateKey] = next;
                    const numEl = document.getElementById(`num-${target}`);
                    const inpEl = document.getElementById(`inp-${target}`);
                    const vEl = document.getElementById(`v-${target}`);
                    if (numEl) numEl.value = next.toFixed(2);
                    if (inpEl) inpEl.value = next;
                    if (vEl) vEl.textContent = next.toFixed(2);
                    rebuildCargoAndRig(false);
                });
            });

            // Detailed Sling Length Controls (Upper & Lower Tiers, Selected Cable, Metric/Imperial)
            initSlingControls();
            syncSlingSlidersFromState();

            document.getElementById('btn-reset-cog').addEventListener('click', () => {
                state.cogX = 0; state.cogY = 0; state.cogZ = 0;
                state.legDeltaL = [0, 0, 0, 0];
                syncCoGSlidersFromState();
                rebuildCargoAndRig(false);
            });

            // 9. Beam, Sling & Hardware Store Cards
            const beamCards = document.querySelectorAll('#beam-store .card-btn');
            beamCards.forEach(card => {
                card.addEventListener('click', () => {
                    beamCards.forEach(c => c.classList.remove('active'));
                    card.classList.add('active');
                    state.beamType = card.dataset.beam;
                    if (state.beamType === 'container_spreader') {
                        state.slingType = 'wire';
                        applyStsSpreaderSize(state.stsTwinLift ? 'twin' : (state.stsSizeFt || 40));
                        return;
                    }
                    state.slingUserSet = false;
                    state.upperSlingLength = null;
                    state.lowerSlingLength = null;
                    if (typeof updateStsBeamDimUI === 'function') updateStsBeamDimUI();
                    // Beam-only rebuild — skip full cargo mesh/lug rebuild (was the main lag source)
                    if (typeof flushRebuildSpreaderVisuals === 'function') flushRebuildSpreaderVisuals();
                    rebuildSpreaderVisuals();
                    if (phy.groundClearance > 0.05) autoPositionHookForLift(0.75);
                    else if (typeof syncHookToRigTaut === 'function') syncHookToRigTaut();
                    syncSlingSlidersFromState();
                });
            });

            const slingCards = document.querySelectorAll('#sling-store .card-btn');
            slingCards.forEach(card => {
                card.addEventListener('click', () => {
                    slingCards.forEach(c => c.classList.remove('active'));
                    card.classList.add('active');
                    const selectedType = card.dataset.sling;
                    state.slingType = selectedType;

                    // Automatically sync elastic material type & DNV-ST-N001 selector
                    if (selectedType === 'wire' || selectedType === 'grommet') {
                        state.slingMaterialType = 'wire';
                    } else if (selectedType === 'chain') {
                        state.slingMaterialType = 'chain';
                    } else if (selectedType === 'web' || selectedType === 'round_sling') {
                        state.slingMaterialType = 'poly';
                    }
                    const selMat = document.getElementById('sel-sling-material');
                    if (selMat) selMat.value = state.slingMaterialType;

                    // Auto-compute standard diameter / width based on WLL
                    const getSpec = (typeof CAE !== 'undefined' && CAE.getSlingPhysicalSpec)
                        || (typeof window !== 'undefined' && window.CAE && window.CAE.getSlingPhysicalSpec);
                    const spec = getSpec ? getSpec(selectedType, state.wllPerLeg || 15.0) : null;
                    if (spec) {
                        state.slingDiaMm = spec.diaMm;
                    }

                    if (state.gear) {
                        (state.gear.uppers || []).forEach(u => {
                            u.slingType = selectedType;
                            if (spec) u.diaMm = spec.diaMm;
                            u.grade = (selectedType === 'chain') ? 'g80' : ((selectedType === 'web' || selectedType === 'round_sling') ? 'poly' : 'iwrc');
                        });
                        (state.gear.legs || []).forEach(l => {
                            l.slingType = selectedType;
                            if (spec) l.diaMm = spec.diaMm;
                            l.grade = (selectedType === 'chain') ? 'g80' : ((selectedType === 'web' || selectedType === 'round_sling') ? 'poly' : 'iwrc');
                        });
                    }

                    computeRiggingMassBreakdown();
                    syncSlingSlidersFromState();
                    updateRiggingBOMUI();
                    rebuildCargoAndRig(false);
                    rebuildSpreaderVisuals();
                });
            });

            const hwCards = document.querySelectorAll('#hw-store .card-btn');
            hwCards.forEach(card => {
                card.addEventListener('click', () => {
                    hwCards.forEach(c => c.classList.remove('active'));
                    card.classList.add('active');
                    state.hwType = card.dataset.hw;
                    rebuildCargoAndRig(false);
                });
            });

            // 10. Crane Hoist & Pendant Buttons (Direct Click Steppers, Presets, Number Inputs & Slew)
            const numHookY = document.getElementById('num-hook-y');
            const inpHookY = document.getElementById('inp-hook-y');
            const valHookY = document.getElementById('val-hook-y');

            const setHookHeight = (targetY) => {
                const clampedY = THREE.MathUtils.clamp(targetY, 0.5, 40.0);
                if (state.poseLock && clampedY > (phy.hookPos ? phy.hookPos.y : 0) + 0.04) {
                    state.poseLock = false;
                    syncPoseLockUI();
                }
                // Center hook over CoG if lifting from ground so cables tension evenly
                if (phy.groundClearance < 0.08 && clampedY > (phy.hookPos ? phy.hookPos.y : 0) + 0.05) {
                    const rotatedCoG = new THREE.Vector3(state.cogX, 0, state.cogZ).applyAxisAngle(new THREE.Vector3(0, 1, 0), THREE.MathUtils.degToRad(state.cargoYawDeg));
                    const azRad = THREE.MathUtils.degToRad(state.pullAzimuthDeg || 0);
                    const pullOffX = (state.pullRadius || 0) * Math.cos(azRad);
                    const pullOffZ = (state.pullRadius || 0) * Math.sin(azRad);
                    phy.hookTarget.x = rotatedCoG.x + pullOffX;
                    phy.hookTarget.z = rotatedCoG.z + pullOffZ;
                }
                phy.hookTarget.y = clampedY;
                // Physical smooth winch transition — never teleport phy.hookPos.y directly
                phy.autoHoistActive = true;
                if (numHookY && document.activeElement !== numHookY) numHookY.value = clampedY.toFixed(1);
                if (inpHookY) inpHookY.value = clampedY.toFixed(2);
                if (valHookY) valHookY.textContent = clampedY.toFixed(1) + 'm';
            };

            if (numHookY) {
                numHookY.addEventListener('change', e => {
                    const y = parseFloat(e.target.value);
                    if (!isNaN(y)) setHookHeight(y);
                });
            }

            document.querySelectorAll('.btn-step-hoist').forEach(btn => {
                btn.addEventListener('click', () => {
                    const delta = parseFloat(btn.dataset.delta || 0);
                    const curY = phy.hookTarget ? phy.hookTarget.y : (phy.hookPos ? phy.hookPos.y : 10.1);
                    setHookHeight(+(curY + delta).toFixed(2));
                });
            });

            document.querySelectorAll('.btn-hoist-preset').forEach(btn => {
                btn.addEventListener('click', () => {
                    const h = parseFloat(btn.dataset.height || 10.1);
                    if (!isNaN(h)) setHookHeight(h);
                });
            });

            document.querySelectorAll('.btn-slew-step').forEach(btn => {
                btn.addEventListener('click', () => {
                    const slewVal = parseFloat(btn.dataset.slew || 0);
                    state.slewDeg = ((state.slewDeg || 0) + slewVal) % 360;
                    if (state.slewDeg > 180) state.slewDeg -= 360;
                    if (state.slewDeg < -180) state.slewDeg += 360;
                    const valSlew = document.getElementById('val-slew');
                    if (valSlew) valSlew.textContent = Math.round(state.slewDeg) + '°';
                });
            });

            if (inpHookY) {
                inpHookY.addEventListener('input', e => {
                    if (phy.suppressHookInput) return;
                    const nextY = parseFloat(e.target.value);
                    if (phy.autoHoistActive && Math.abs(nextY - phy.hookPos.y) < 0.08) return;
                    if (state.poseLock && nextY > phy.hookPos.y + 0.04) {
                        state.poseLock = false;
                        syncPoseLockUI();
                    }
                    if (phy.groundClearance < 0.05 && nextY > (phy.hookPos ? phy.hookPos.y : 0) + 0.05) {
                        const rotatedCoG = new THREE.Vector3(state.cogX, 0, state.cogZ).applyAxisAngle(new THREE.Vector3(0, 1, 0), THREE.MathUtils.degToRad(state.cargoYawDeg));
                        const azRad = THREE.MathUtils.degToRad(state.pullAzimuthDeg || 0);
                        const pullOffX = (state.pullRadius || 0) * Math.cos(azRad);
                        const pullOffZ = (state.pullRadius || 0) * Math.sin(azRad);
                        phy.hookTarget.x = rotatedCoG.x + pullOffX;
                        phy.hookTarget.z = rotatedCoG.z + pullOffZ;
                    }
                    phy.hookTarget.y = nextY;
                    phy.autoHoistActive = true;
                    if (valHookY) valHookY.textContent = phy.hookTarget.y.toFixed(1) + 'm';
                    if (numHookY && document.activeElement !== numHookY) numHookY.value = phy.hookTarget.y.toFixed(1);
                });
            }

            const btnUp = document.getElementById('btn-hoist-up');
            const btnDown = document.getElementById('btn-hoist-down');
            const stopHoistHold = () => {
                phy.hoistSpeed = 0;
                phy.hookTarget.x = phy.hookPos.x;
                phy.hookTarget.y = phy.hookPos.y;
                phy.hookTarget.z = phy.hookPos.z;
                phy.hookVel.set(0, 0, 0);
            };
            btnUp.addEventListener('pointerdown', e => {
                e.preventDefault();
                // Resume design sling lengths when the operator starts to hoist again
                state.holdCableLength = false;
                state.heldCableL0 = null;
                if (state.poseLock) {
                    state.poseLock = false;
                    syncPoseLockUI();
                }
                // STS direct: snug twistlock rest lengths to current pin gap so hoist picks immediately
                if (typeof isStsDirectAttach === 'function' && isStsDirectAttach() && typeof attachWorld === 'function') {
                    state.lowerSlingLength = 0.06;
                    (phy.cables || []).forEach(c => {
                        if (c.role !== 'leg') return;
                        const span = attachWorld(c.a).distanceTo(attachWorld(c.b));
                        c.L0 = Math.max(0.04, Math.min(0.12, span + 0.005));
                        c.designL0 = c.L0;
                        c.slack = false;
                    });
                    if (state.gear && state.gear.legs) {
                        state.gear.legs.forEach(leg => {
                            if (!leg) return;
                            leg.lengthM = null;
                            leg.userSet = false;
                        });
                    }
                }
                if (phy.groundClearance < 0.08) {
                    const rotatedCoG = new THREE.Vector3(state.cogX, 0, state.cogZ).applyAxisAngle(new THREE.Vector3(0, 1, 0), THREE.MathUtils.degToRad(state.cargoYawDeg));
                    const azRad = THREE.MathUtils.degToRad(state.pullAzimuthDeg || 0);
                    const pullOffX = (state.pullRadius || 0) * Math.cos(azRad);
                    const pullOffZ = (state.pullRadius || 0) * Math.sin(azRad);
                    phy.hookTarget.x = rotatedCoG.x + pullOffX;
                    phy.hookTarget.z = rotatedCoG.z + pullOffZ;
                } else {
                    phy.hookTarget.x = phy.hookPos.x;
                    phy.hookTarget.z = phy.hookPos.z;
                }
                phy.hookTarget.y = phy.hookPos.y;
                phy.autoHoistActive = false;
                phy.hoistSpeed = 0.50;
            });
            btnUp.addEventListener('pointerup', stopHoistHold);
            btnUp.addEventListener('pointerleave', stopHoistHold);
            btnUp.addEventListener('pointercancel', stopHoistHold);
            btnDown.addEventListener('pointerdown', e => {
                e.preventDefault();
                const wasGrounded = (phy.groundClearance || 0) < 0.15;
                // Unlocking pose must not launch the cargo — kill residual / settle on deck
                if (phy.cargoVel) phy.cargoVel.set(0, 0, 0);
                if (phy.cargoOmega) phy.cargoOmega.set(0, 0, 0);
                if (phy.hookVel) phy.hookVel.set(0, 0, 0);
                if (wasGrounded && typeof applyLockedPose === 'function') {
                    state.poseLock = true;
                    applyLockedPose();
                    if (typeof seedBeamsFromKinematic === 'function') seedBeamsFromKinematic();
                    // Capture current pin-to-pin spans as held rest lengths (+4 cm
                    // pay-out slack).  syncCableRest runs every XPBD frame and would
                    // otherwise restore the design L0 and instantly re-pick the load.
                    state.holdCableLength = true;
                    state.heldCableL0 = { upper: [], leg: [], hanger: [], extra: [] };
                    (phy.cables || []).forEach(c => {
                        if (typeof cableIsBroken === 'function' && cableIsBroken(c)) return;
                        const span = (typeof attachWorld === 'function')
                            ? attachWorld(c.a).distanceTo(attachWorld(c.b))
                            : (c.L0 || 1);
                        const L0 = Math.max(0.2, span + 0.04);
                        if (!state.heldCableL0[c.role]) state.heldCableL0[c.role] = [];
                        state.heldCableL0[c.role][c.index] = L0;
                        c.L0 = L0;
                        c.designL0 = L0;
                        c.slack = true;
                        c.tensionT = 0;
                        c._sum = 0;
                    });
                    if (Array.isArray(phy.legSlacks)) phy.legSlacks.fill(true);
                    if (Array.isArray(phy.legTensions)) phy.legTensions.fill(0);
                    phy.groundClearance = 0;
                }
                if (Array.isArray(phy.beams)) {
                    phy.beams.forEach(b => {
                        if (b.v) b.v.set(0, 0, 0);
                        if (b.w) b.w.set(0, 0, 0);
                    });
                }
                // Grounded / snug lower: drop elastic hoist compensation so paying
                // out cannot haul the drum up through a stale offLP.
                if (wasGrounded && phy.hoist) {
                    if (typeof resetHoistDynamicState === 'function') resetHoistDynamicState(phy.hoist);
                    else {
                        phy.hoist.off.set(0, 0, 0);
                        phy.hoist.offLP.set(0, 0, 0);
                        phy.hoist.vel.set(0, 0, 0);
                        phy.hoist.tensionN = 0;
                        phy.hoist.tensionLP = 0;
                    }
                    phy.hoist.kin.copy(phy.hookPos);
                    phy.solverMaxOverrun = 0;
                }
                if (state.poseLock) {
                    state.poseLock = false;
                    syncPoseLockUI();
                }
                phy.autoHoistActive = false;
                phy.hookTarget.x = phy.hookPos.x;
                phy.hookTarget.z = phy.hookPos.z;
                phy.hookTarget.y = phy.hookPos.y;
                phy.hoistSpeed = -0.50;
            });
            btnDown.addEventListener('pointerup', stopHoistHold);
            btnDown.addEventListener('pointerleave', stopHoistHold);
            btnDown.addEventListener('pointercancel', stopHoistHold);

            // Unified Simulation Controls
            const handlePretension = () => {
                pretensionRig();
            };
            document.querySelectorAll('#btn-pretension, .btn-action-pretension').forEach(btn => btn.addEventListener('click', handlePretension));

            const handleTestLift = () => {
                // Settle beam under hook before XPBD so skewed seeds don't overstretch
                if (typeof seedBeamsFromKinematic === 'function') seedBeamsFromKinematic();
                if (typeof syncCableRest === 'function') syncCableRest(false);
                // Zero residual velocities before take-up
                phy.cargoVel.set(0, 0, 0);
                phy.cargoOmega.set(0, 0, 0);
                if (Array.isArray(phy.beams)) {
                    phy.beams.forEach(b => {
                        if (b.v) b.v.set(0, 0, 0);
                        if (b.w) b.w.set(0, 0, 0);
                    });
                }
                state.poseLock = false;
                syncPoseLockUI();
                // 1.0–1.2 m clear is a real trial lift; 3.2 m was launching the load
                autoPositionHookForLift(1.15);
                document.getElementById('sim-status-text').textContent = '🏗️ Đang nhấc thử tải...';
            };
            document.querySelectorAll('#btn-test-lift, .btn-action-test-lift').forEach(btn => btn.addEventListener('click', handleTestLift));

            const handleSwingTest = () => {
                if (phy.groundClearance < 0.15) autoPositionHookForLift(0.85);
                const massScale = THREE.MathUtils.clamp(Math.sqrt(16 / Math.max(4, state.weight)), 0.45, 1.15);
                phy.cargoVel.x += 0.38 * massScale;
                phy.cargoVel.z += 0.24 * massScale;
                phy.cargoOmega.y += 0.08 * massScale;
                document.getElementById('sim-status-text').textContent = '💨 Đang thử đung đưa...';
            };
            document.querySelectorAll('#btn-swing-test, .btn-action-swing-test').forEach(btn => btn.addEventListener('click', handleSwingTest));

            // Auto-level turnbuckles
            const handleAutoLevel = () => {
                autoLevelTurnbuckles();
            };
            document.querySelectorAll('#btn-auto-level, .btn-action-auto-level').forEach(btn => btn.addEventListener('click', handleAutoLevel));

            // Reset Initial / Set Down
            const handleResetInitial = () => {
                resetToInitialPreLiftState();
            };
            document.querySelectorAll('#btn-reset-initial, .btn-action-reset-initial').forEach(btn => btn.addEventListener('click', handleResetInitial));

            // Hard Reset / Reset to Baseline
            const handleResetAll = () => {
                if (state.userBaselineState) {
                    resetToUserInitialBaselineState();
                } else {
                    resetToInitialPreLiftState();
                }
            };
            document.querySelectorAll('#btn-hard-reset, #btn-reset-all, .btn-action-reset-all').forEach(btn => btn.addEventListener('click', handleResetAll));

            // Set Baseline
            const handleSetBaseline = () => {
                saveUserInitialBaselineState();
            };
            document.querySelectorAll('#btn-set-baseline, #hdr-btn-set-baseline, .btn-action-set-baseline').forEach(btn => btn.addEventListener('click', handleSetBaseline));

            const holdBtn = (id, onDown, onUp) => {
                const el = document.getElementById(id);
                el.addEventListener('pointerdown', e => { e.preventDefault(); onDown(); });
                el.addEventListener('pointerup', onUp);
                el.addEventListener('pointerleave', onUp);
            };
            holdBtn('btn-slew-left', () => { phy.slewRate = -32; }, () => { if (phy.slewRate < 0) phy.slewRate = 0; });
            holdBtn('btn-slew-right', () => { phy.slewRate = 32; }, () => { if (phy.slewRate > 0) phy.slewRate = 0; });

            document.getElementById('btn-rec').addEventListener('click', () => {
                replay.recording = true;
                replay.playing = false;
                replay.frames = [];
                replay.t0 = performance.now() / 1000;
                document.getElementById('lbl-replay').textContent = 'REC 0.0s';
                document.getElementById('btn-rec')?.classList.add('ring-2', 'ring-rose-400', 'animate-pulse');
                document.getElementById('btn-replay')?.classList.remove('ring-2', 'ring-sky-400');
                document.getElementById('sim-status-text').textContent = '⏺ Đang ghi lại...';
            });
            document.getElementById('btn-replay').addEventListener('click', () => {
                document.getElementById('btn-rec')?.classList.remove('ring-2', 'ring-rose-400', 'animate-pulse');
                if (!replay.frames.length) {
                    document.getElementById('lbl-replay').textContent = 'Chưa có bản ghi';
                    return;
                }
                replay.recording = false;
                replay.playing = true;
                replay.cursor = 0;
                phy.slewRate = 0;
                phy.hoistSpeed = 0;
                document.getElementById('btn-replay')?.classList.add('ring-2', 'ring-sky-400');
                document.getElementById('sim-status-text').textContent = '▶ Đang xem lại...';
            });
            document.getElementById('btn-replay-stop').addEventListener('click', () => {
                replay.recording = false;
                replay.playing = false;
                document.getElementById('btn-rec')?.classList.remove('ring-2', 'ring-rose-400', 'animate-pulse');
                document.getElementById('btn-replay')?.classList.remove('ring-2', 'ring-sky-400');
                document.getElementById('lbl-replay').textContent = 'Đã dừng';
            });

            document.querySelectorAll('#left-tabs button').forEach(btn => {
                btn.addEventListener('click', () => {
                    document.querySelectorAll('#left-tabs button').forEach(b => b.classList.toggle('active', b === btn));
                    document.querySelectorAll('.left-page').forEach(page => page.classList.toggle('active', page.dataset.page === btn.dataset.page));
                });
            });
            document.querySelectorAll('#scene-store .card-btn').forEach(card => {
                card.addEventListener('click', () => {
                    document.querySelectorAll('#scene-store .card-btn').forEach(c => c.classList.remove('active'));
                    card.classList.add('active');
                    state.sceneId = card.dataset.scene;
                    const sceneToPreset = { studio: 'liebherr_studio', yard: 'overcast', sheet: 'print_plan' };
                    const targetPreset = sceneToPreset[state.sceneId] || 'liebherr_studio';
                    if (selGfxPreset) selGfxPreset.value = targetPreset;
                    buildWorld();
                    if (state.poseLock) applyLockedPose();
                });
            });
            document.querySelectorAll('#ground-store .card-btn').forEach(card => {
                card.addEventListener('click', () => {
                    document.querySelectorAll('#ground-store .card-btn').forEach(c => c.classList.remove('active'));
                    card.classList.add('active');
                    state.groundId = card.dataset.ground;
                    buildWorld();
                    if (state.poseLock) applyLockedPose();
                });
            });
            document.querySelectorAll('.pose-preset').forEach(btn => {
                btn.addEventListener('click', () => {
                    state.cargoPitchTrimDeg = parseFloat(btn.dataset.pitch);
                    state.cargoRollTrimDeg = parseFloat(btn.dataset.roll);
                    state.poseLock = true;
                    syncOrientationAndPullUI();
                    applyLockedPose();
                    parkHookSlack();
                    syncPoseLockUI();
                    document.getElementById('sim-status-text').textContent = 'Đã đặt góc sự cố trên nền. Bắt cáp rồi kéo — khi cáp căng, hàng xoay theo vật lý.';
                });
            });
            document.getElementById('btn-pose-lock').addEventListener('click', () => {
                state.poseLock = true;
                applyLockedPose();
                parkHookSlack();
                syncPoseLockUI();
            });

            // 11. Granular Indicator Toggles (CAD Edges, Force Vectors, LP Labels, CoG Label & Master Hide All)
            // 11. Granular Technical Display Options & Popover (Lực, góc, ma ní, cáp, nền...)
            const syncDisplayOptionsUI = () => {
                const dOpt = state.displayOptions;
                if (!dOpt) return;

                const setChk = (id, val) => {
                    const el = document.getElementById(id);
                    if (el) el.checked = Boolean(val);
                };

                setChk('chk-disp-forces', dOpt.showForces);
                setChk('chk-disp-angles', dOpt.showSlingAngles);
                setChk('chk-disp-ground', dOpt.showGroundAngle);
                setChk('chk-disp-hook', dOpt.showHookLoad);
                setChk('chk-disp-shackle', dOpt.showShackleLoads);
                setChk('chk-disp-lengths', dOpt.showSlingLengths);
                setChk('chk-disp-cog', dOpt.showCoG);
                setChk('chk-disp-vectors', dOpt.showVectors);
                setChk('chk-disp-cad', dOpt.showCADEdges);
                setChk('chk-disp-hud', dOpt.showHUD);

                // Backward-compatibility state sync
                state.showVectors = Boolean(dOpt.showVectors);
                state.showCADEdges = Boolean(dOpt.showCADEdges);
                state.showLPLabels = Boolean(dOpt.showForces || dOpt.showSlingAngles || dOpt.showShackleLoads || dOpt.showSlingLengths);
                state.showCoGLabel = Boolean(dOpt.showCoG);
                state.showGroundAngleIndicator = Boolean(dOpt.showGroundAngle);

                // Apply directly to 3D scene elements
                scene.traverse(o => { if (o.userData?.isCADEdge) o.visible = Boolean(dOpt.showCADEdges); });
                if (cargoGroundAngleGroup) cargoGroundAngleGroup.visible = Boolean(dOpt.showGroundAngle);
                const lblGround = document.getElementById('lbl-ground-angle');
                if (lblGround) lblGround.style.display = (dOpt.showGroundAngle !== false) ? '' : 'none';
                if (typeof updateCargoGroundAngleIndicator3D === 'function') updateCargoGroundAngleIndicator3D();
                if (cogIndicatorGroup) cogIndicatorGroup.visible = Boolean(dOpt.showCoG);
                if (plumbLineMesh) plumbLineMesh.visible = Boolean(dOpt.showCoG);

                const hudBar = document.getElementById('top-telemetry-hud');
                if (hudBar) hudBar.style.display = dOpt.showHUD ? '' : 'none';

                // Sync top toolbar button active states
                const btnCad = document.getElementById('btn-toggle-cad-edges');
                if (btnCad) {
                    btnCad.classList.toggle('border-sky-400', Boolean(dOpt.showCADEdges));
                    btnCad.classList.toggle('text-sky-300', Boolean(dOpt.showCADEdges));
                }
                const btnVec = document.getElementById('btn-toggle-vectors');
                if (btnVec) {
                    btnVec.classList.toggle('border-sky-400', Boolean(dOpt.showVectors));
                    btnVec.classList.toggle('text-sky-300', Boolean(dOpt.showVectors));
                }
            };
            window.syncDisplayOptionsUI = syncDisplayOptionsUI;
            const syncIndicatorButtonsUI = syncDisplayOptionsUI; // alias for safety

            // Unified Top Bar Dropdown Management
            const allDropdowns = [
                { menuId: 'menu-camera', btnId: 'btn-menu-camera', panelId: 'dropdown-panel-camera', arrowId: 'arrow-camera-menu' },
                { menuId: 'menu-display', btnId: 'btn-display-options', panelId: 'display-options-popover', arrowId: 'arrow-display-options' },
                { menuId: 'menu-gfx', btnId: 'btn-toggle-gfx', panelId: 'gfx-menu-popover', arrowId: 'arrow-gfx-menu' },
                { menuId: 'menu-docs', btnId: 'btn-menu-docs', panelId: 'dropdown-panel-docs', arrowId: 'arrow-docs-menu' },
                { menuId: 'menu-system', btnId: 'btn-menu-system', panelId: 'dropdown-panel-system', arrowId: 'arrow-system-menu' }
            ];

            function closeAllTopDropdowns() {
                allDropdowns.forEach(d => {
                    const panel = document.getElementById(d.panelId);
                    if (panel) {
                        panel.classList.add('hidden');
                        panel.classList.remove('open');
                    }
                    const wrap = document.getElementById(d.menuId);
                    if (wrap) wrap.classList.remove('open');
                    const btn = document.getElementById(d.btnId);
                    if (btn) btn.setAttribute('aria-expanded', 'false');
                    if (d.arrowId) {
                        const arrow = document.getElementById(d.arrowId);
                        if (arrow) arrow.style.transform = 'rotate(0deg)';
                    }
                });
            }
            if (window.UI?.layout) {
                window.UI.layout.closeAllMenus = closeAllTopDropdowns;
            }

            allDropdowns.forEach(d => {
                const btn = document.getElementById(d.btnId);
                const panel = document.getElementById(d.panelId);
                const wrap = document.getElementById(d.menuId);
                if (btn && panel) {
                    btn.setAttribute('aria-haspopup', 'true');
                    btn.setAttribute('aria-expanded', 'false');
                    panel.addEventListener('click', (e) => e.stopPropagation());
                    panel.addEventListener('pointerdown', (e) => e.stopPropagation());

                    btn.addEventListener('click', (e) => {
                        e.stopPropagation();
                        const isCurrentlyHidden = panel.classList.contains('hidden');
                        closeAllTopDropdowns();
                        if (isCurrentlyHidden) {
                            panel.classList.remove('hidden');
                            panel.classList.add('open');
                            if (wrap) wrap.classList.add('open');
                            btn.setAttribute('aria-expanded', 'true');
                            panel.style.zIndex = 'var(--z-popover)';
                            if (d.arrowId) {
                                const arrow = document.getElementById(d.arrowId);
                                if (arrow) arrow.style.transform = 'rotate(180deg)';
                            }

                            // Keep within viewport boundaries
                            const rect = btn.getBoundingClientRect();
                            const pWidth = panel.offsetWidth || 280;
                            let safeLeft = rect.left;
                            if (safeLeft + pWidth > window.innerWidth - 16) {
                                safeLeft = Math.max(12, window.innerWidth - pWidth - 16);
                            }
                            if (safeLeft < 12) safeLeft = 12;
                            panel.style.position = 'fixed';
                            panel.style.top = `${rect.bottom + 6}px`;
                            panel.style.left = `${safeLeft}px`;
                            panel.style.right = 'auto';
                        }
                    });
                }
            });

            // Close dropdowns upon clicking action items inside docs panel or camera presets
            ['btn-open-compliance', 'btn-open-liftplan', 'btn-open-plan-wizard', 'btn-quick-export-pdf', 'btn-open-3d-library'].forEach(id => {
                document.getElementById(id)?.addEventListener('click', () => closeAllTopDropdowns());
            });
            document.querySelectorAll('#dropdown-panel-camera .cam-btn').forEach(btn => {
                btn.addEventListener('click', () => closeAllTopDropdowns());
            });

            document.getElementById('btn-display-close')?.addEventListener('click', (e) => {
                e.stopPropagation();
                closeAllTopDropdowns();
            });

            document.getElementById('btn-close-gfx-popover')?.addEventListener('click', (e) => {
                e.stopPropagation();
                closeAllTopDropdowns();
            });

            window.addEventListener('click', () => closeAllTopDropdowns());

            // HUD Extra Stats Toggle Button
            const btnToggleHudExtra = document.getElementById('btn-toggle-hud-extra');
            if (btnToggleHudExtra) {
                btnToggleHudExtra.addEventListener('click', (e) => {
                    e.stopPropagation();
                    const extraItems = document.querySelectorAll('.hud-extra-stat');
                    let isNowExpanded = false;
                    extraItems.forEach(el => {
                        el.classList.toggle('hidden');
                        if (!el.classList.contains('hidden')) isNowExpanded = true;
                    });
                    btnToggleHudExtra.textContent = isNowExpanded ? '− Gọn Lại' : '+ Chi Tiết';
                    btnToggleHudExtra.className = isNowExpanded
                        ? 'shrink-0 px-1 py-0.5 rounded text-[8px] font-mono font-bold text-amber-300 bg-amber-950/80 border border-amber-500/60 transition'
                        : 'shrink-0 px-1 py-0.5 rounded text-[8px] font-mono font-bold text-slate-400 hover:text-amber-300 bg-slate-800/80 hover:bg-slate-700/80 border border-slate-700 transition';
                });
            }

            // Quick "All" and "None" buttons
            document.getElementById('btn-display-all')?.addEventListener('click', () => {
                Object.keys(state.displayOptions).forEach(k => { state.displayOptions[k] = true; });
                syncDisplayOptionsUI();
            });

            document.getElementById('btn-display-none')?.addEventListener('click', () => {
                Object.keys(state.displayOptions).forEach(k => { state.displayOptions[k] = false; });
                syncDisplayOptionsUI();
            });

            // Bind Individual Checkboxes
            const bindChk = (id, key) => {
                const el = document.getElementById(id);
                if (el) {
                    el.addEventListener('change', () => {
                        state.displayOptions[key] = el.checked;
                        syncDisplayOptionsUI();
                    });
                }
            };

            bindChk('chk-disp-forces', 'showForces');
            bindChk('chk-disp-angles', 'showSlingAngles');
            bindChk('chk-disp-ground', 'showGroundAngle');
            bindChk('chk-disp-hook', 'showHookLoad');
            bindChk('chk-disp-shackle', 'showShackleLoads');
            bindChk('chk-disp-lengths', 'showSlingLengths');
            bindChk('chk-disp-cog', 'showCoG');
            bindChk('chk-disp-vectors', 'showVectors');
            bindChk('chk-disp-cad', 'showCADEdges');
            bindChk('chk-disp-hud', 'showHUD');

            // Top toolbar buttons
            document.getElementById('btn-toggle-cad-edges')?.addEventListener('click', () => {
                state.displayOptions.showCADEdges = !state.displayOptions.showCADEdges;
                syncDisplayOptionsUI();
            });

            document.getElementById('btn-toggle-vectors')?.addEventListener('click', () => {
                state.displayOptions.showVectors = !state.displayOptions.showVectors;
                syncDisplayOptionsUI();
            });

            document.getElementById('btn-toggle-lp-labels')?.addEventListener('click', () => {
                const cur = state.displayOptions.showForces || state.displayOptions.showSlingAngles;
                state.displayOptions.showForces = !cur;
                state.displayOptions.showSlingAngles = !cur;
                syncDisplayOptionsUI();
            });

            document.getElementById('btn-toggle-cog-label')?.addEventListener('click', () => {
                state.displayOptions.showCoG = !state.displayOptions.showCoG;
                syncDisplayOptionsUI();
            });

            document.getElementById('btn-hide-all-indicators')?.addEventListener('click', () => {
                const anyOn = Object.values(state.displayOptions).some(Boolean);
                Object.keys(state.displayOptions).forEach(k => { state.displayOptions[k] = !anyOn; });
                syncDisplayOptionsUI();
            });

            syncDisplayOptionsUI();
            toggleLeftPanel(true);
            openRightDrawer('rig');
            applyLang();

            // 12. Detailed Orientation, Rotation & Pulling Vector UI Events
            const applyYawChange = newYaw => {
                state.cargoYawDeg = THREE.MathUtils.clamp(newYaw, -180, 180);
                if (dunnageGroup && phy.cargoPos) {
                    dunnageGroup.position.set(phy.cargoPos.x, 0, phy.cargoPos.z);
                    dunnageGroup.rotation.y = THREE.MathUtils.degToRad(state.cargoYawDeg);
                }
                syncOrientationAndPullUI();
                if (phy.groundClearance < 0.1 || state.poseLock) {
                    state.poseLock = true;
                    applyLockedPose();
                    parkHookSlack();
                    syncPoseLockUI();
                }
                // Instant upper-gear lean with cargo skew (before next physics frame)
                if (typeof seedBeamsFromKinematic === 'function') seedBeamsFromKinematic();
                if (typeof applyBeamVisuals === 'function') applyBeamVisuals();
                if (typeof updateCargoGroundAngleIndicator3D === 'function') {
                    updateCargoGroundAngleIndicator3D();
                }
            };
            window.applyYawChange = applyYawChange;

            // Events for Header Yaw Controls
            const hdrInpYaw = document.getElementById('hdr-inp-cargo-yaw');
            if (hdrInpYaw) {
                hdrInpYaw.addEventListener('input', e => applyYawChange(parseFloat(e.target.value) || 0));
                hdrInpYaw.addEventListener('change', e => applyYawChange(parseFloat(e.target.value) || 0));
            }
            document.getElementById('hdr-btn-yaw-m5')?.addEventListener('click', () => applyYawChange(state.cargoYawDeg - 5));
            document.getElementById('hdr-btn-yaw-p5')?.addEventListener('click', () => applyYawChange(state.cargoYawDeg + 5));
            document.getElementById('hdr-btn-yaw-0')?.addEventListener('click', () => applyYawChange(0));
            document.getElementById('hdr-btn-yaw-45')?.addEventListener('click', () => applyYawChange(45));
            document.getElementById('hdr-btn-yaw-90')?.addEventListener('click', () => applyYawChange(90));


            // Events for Tab 3 (Sự cố) Yaw Controls
            const inpCargoYaw = document.getElementById('inp-cargoYaw');
            if (inpCargoYaw) inpCargoYaw.addEventListener('input', e => applyYawChange(parseFloat(e.target.value)));
            const btnYawMinus = document.getElementById('btn-yaw-minus');
            if (btnYawMinus) btnYawMinus.addEventListener('click', () => applyYawChange(state.cargoYawDeg - 5));
            const btnYawPlus = document.getElementById('btn-yaw-plus');
            if (btnYawPlus) btnYawPlus.addEventListener('click', () => applyYawChange(state.cargoYawDeg + 5));
            document.querySelectorAll('.yaw-preset').forEach(btn => {
                btn.addEventListener('click', () => applyYawChange(parseFloat(btn.dataset.yaw)));
            });

            // Events for Tab 1 (Kiện) Ground Cargo Yaw Controls
            const inpGroundYaw = document.getElementById('inp-groundCargoYaw');
            if (inpGroundYaw) inpGroundYaw.addEventListener('input', e => applyYawChange(parseFloat(e.target.value)));
            const btnGroundM15 = document.getElementById('btn-ground-yaw-m15');
            if (btnGroundM15) btnGroundM15.addEventListener('click', () => applyYawChange(state.cargoYawDeg - 15));
            const btnGroundM5 = document.getElementById('btn-ground-yaw-m5');
            if (btnGroundM5) btnGroundM5.addEventListener('click', () => applyYawChange(state.cargoYawDeg - 5));
            const btnGroundP5 = document.getElementById('btn-ground-yaw-p5');
            if (btnGroundP5) btnGroundP5.addEventListener('click', () => applyYawChange(state.cargoYawDeg + 5));
            const btnGroundP15 = document.getElementById('btn-ground-yaw-p15');
            if (btnGroundP15) btnGroundP15.addEventListener('click', () => applyYawChange(state.cargoYawDeg + 15));
            document.querySelectorAll('.ground-yaw-quick').forEach(btn => {
                btn.addEventListener('click', () => applyYawChange(parseFloat(btn.dataset.yaw)));
            });
            const btnResetGroundYaw = document.getElementById('btn-reset-ground-yaw');
            if (btnResetGroundYaw) btnResetGroundYaw.addEventListener('click', () => applyYawChange(0));

            // Spreader Alignment vs Skew Toggles
            const btnAlignFixed = document.getElementById('btn-spreader-align-fixed');
            if (btnAlignFixed) {
                btnAlignFixed.addEventListener('click', () => {
                    state.spreaderAlignWithCargo = false;
                    syncOrientationAndPullUI();
                    if (typeof seedBeamsFromKinematic === 'function') seedBeamsFromKinematic();
                    if (typeof rebuildSpreaderVisuals === 'function') rebuildSpreaderVisuals();
                });
            }
            const btnAlignFollow = document.getElementById('btn-spreader-align-follow');
            if (btnAlignFollow) {
                btnAlignFollow.addEventListener('click', () => {
                    state.spreaderAlignWithCargo = true;
                    syncOrientationAndPullUI();
                    if (typeof seedBeamsFromKinematic === 'function') seedBeamsFromKinematic();
                    if (typeof rebuildSpreaderVisuals === 'function') rebuildSpreaderVisuals();
                });
            }

            const btnHookSwivelOn = document.getElementById('btn-hook-swivel-on');
            if (btnHookSwivelOn) {
                btnHookSwivelOn.addEventListener('click', () => {
                    state.hookSwivelEnabled = true;
                    syncOrientationAndPullUI();
                    if (typeof seedBeamsFromKinematic === 'function') seedBeamsFromKinematic();
                });
            }
            const btnHookSwivelOff = document.getElementById('btn-hook-swivel-off');
            if (btnHookSwivelOff) {
                btnHookSwivelOff.addEventListener('click', () => {
                    state.hookSwivelEnabled = false;
                    syncOrientationAndPullUI();
                    if (typeof seedBeamsFromKinematic === 'function') seedBeamsFromKinematic();
                });
            }

            document.getElementById('inp-cargoPitch').addEventListener('input', e => {
                state.cargoPitchTrimDeg = parseFloat(e.target.value);
                syncOrientationAndPullUI();
                if (phy.groundClearance < 0.12) {
                    state.poseLock = true;
                    applyLockedPose();
                    parkHookSlack();
                    syncPoseLockUI();
                }
            });
            document.getElementById('inp-cargoRoll').addEventListener('input', e => {
                state.cargoRollTrimDeg = parseFloat(e.target.value);
                syncOrientationAndPullUI();
                if (phy.groundClearance < 0.12) {
                    state.poseLock = true;
                    applyLockedPose();
                    parkHookSlack();
                    syncPoseLockUI();
                }
            });

            const updateHookFromPullVector = () => {
                const azRad = THREE.MathUtils.degToRad(state.pullAzimuthDeg);
                const rotCoG = new THREE.Vector3(state.cogX, 0, state.cogZ).applyAxisAngle(
                    new THREE.Vector3(0, 1, 0),
                    THREE.MathUtils.degToRad(state.cargoYawDeg)
                );
                phy.autoHoistActive = false;
                phy.hookTarget.x = THREE.MathUtils.clamp(rotCoG.x + state.pullRadius * Math.cos(azRad), -6.5, 6.5);
                phy.hookTarget.z = THREE.MathUtils.clamp(rotCoG.z + state.pullRadius * Math.sin(azRad), -5.5, 5.5);
                syncOrientationAndPullUI();
            };

            document.getElementById('inp-pullAzimuth').addEventListener('input', e => {
                phy.autoHoistActive = false;
                state.pullAzimuthDeg = parseFloat(e.target.value);
                updateHookFromPullVector();
            });
            document.getElementById('inp-pullRadius').addEventListener('input', e => {
                phy.autoHoistActive = false;
                state.pullRadius = parseFloat(e.target.value);
                updateHookFromPullVector();
            });

            document.getElementById('inp-hookX').addEventListener('input', e => {
                phy.autoHoistActive = false;
                phy.hookTarget.x = parseFloat(e.target.value);
                state.pullRadius = Math.hypot(phy.hookTarget.x, phy.hookTarget.z);
                state.pullAzimuthDeg = (Math.atan2(phy.hookTarget.z, phy.hookTarget.x) * 180 / Math.PI + 360) % 360;
                syncOrientationAndPullUI();
            });
            document.getElementById('inp-hookZ').addEventListener('input', e => {
                phy.autoHoistActive = false;
                phy.hookTarget.z = parseFloat(e.target.value);
                state.pullRadius = Math.hypot(phy.hookTarget.x, phy.hookTarget.z);
                state.pullAzimuthDeg = (Math.atan2(phy.hookTarget.z, phy.hookTarget.x) * 180 / Math.PI + 360) % 360;
                syncOrientationAndPullUI();
            });

            document.getElementById('btn-reset-orient').addEventListener('click', () => {
                state.cargoYawDeg = 0;
                state.cargoPitchTrimDeg = 0;
                state.cargoRollTrimDeg = 0;
                state.pullAzimuthDeg = 0;
                state.pullRadius = 0;
                phy.hookTarget.x = 0;
                phy.hookTarget.z = 0;
                applyYawChange(0);
            });

            document.querySelectorAll('.cam-btn').forEach(btn => {
                btn.addEventListener('click', () => {
                    document.querySelectorAll('.cam-btn').forEach(b => b.classList.remove('active'));
                    btn.classList.add('active');
                    const mode = btn.dataset.cam;
                    if (mode === 'iso') { camera.position.set(-13.5, 9.2, 19.5); controls.target.set(3.2, 3.2, -0.6); }
                    if (mode === 'hook') {
                        camera.position.set(phy.hookPos.x + 2.6, phy.hookPos.y - 0.5, phy.hookPos.z + 3.0);
                        controls.target.set(phy.hookPos.x, phy.hookPos.y - 1.0, phy.hookPos.z);
                    }
                    if (mode === 'front') { camera.position.set(0, 3.4, 12.5); controls.target.set(0, 2.6, 0); }
                    if (mode === 'side') { camera.position.set(12.5, 3.4, 0); controls.target.set(0, 2.6, 0); }
                    if (mode === 'top') { camera.position.set(0, 18.5, 0.01); controls.target.set(0, 1.0, 0); }
                    if (mode === 'crane') { camera.position.set(15.5, 9.5, 17.5); controls.target.set(-2.0, 4.5, -2.0); }
                    controls.update();
                    if (typeof prevFollowWorldPos !== 'undefined') prevFollowWorldPos = null;
                    // Preset angles freeze into manual hold so auto cinema won't override
                    if (state.cameraFollow) {
                        state.cameraFollow.userManual = true;
                        state.cameraFollow.behavior = 'lock';
                        state.cameraFollow.enabled = false;
                        state.cameraFollow.smart = false;
                        state.cameraFollow.suppressUiReframe = true;
                        state.cameraFollow.stableView = true;
                        state.cameraFollow.lockedOffset = camera.position.clone().sub(controls.target);
                        state.cameraFollow.orbiting = false;
                        state.cameraFollow.paused = false;
                    }
                    if (typeof window.syncCameraFollowUI === 'function') window.syncCameraFollowUI();
                });
            });

            // Camera behavior: Auto | Giữ | Góc | Fly
            const btnCamCinema = document.getElementById('btn-cam-cinema');
            const btnCamLock = document.getElementById('btn-cam-lock');
            const btnCamHoldAngle = document.getElementById('btn-cam-hold-angle');
            const btnCamFlycam = document.getElementById('btn-cam-flycam');
            const btnCamFollow = document.getElementById('btn-cam-follow');
            const lblCamFollow = document.getElementById('cam-follow-label');
            const selCamFollowMode = document.getElementById('sel-cam-follow-mode');

            const styleCamBehaviorBtn = (btn, on) => {
                if (!btn) return;
                btn.classList.toggle('!bg-sky-700', on);
                btn.classList.toggle('!border-sky-400', on);
                btn.classList.toggle('!text-white', on);
                btn.classList.toggle('active', on);
                if (!on) {
                    btn.classList.add('text-slate-300');
                } else {
                    btn.classList.remove('text-slate-300');
                }
            };

            const syncCameraFollowUI = () => {
                if (!state.cameraFollow) {
                    state.cameraFollow = {
                        enabled: true, behavior: 'cinema', mode: 'auto', smart: true,
                        customOffset: new THREE.Vector3(), lockedOffset: null, angleIndex: 0,
                        flycamPhase: 0, flycamPitch: 0.34, flycamDist: 22, flycamSeeded: false,
                        flycamYawRate: 0.12,
                        orbiting: false, paused: false, userManual: false,
                        suppressUiReframe: true, stableView: true, focusOverride: null
                    };
                }
                if (state.cameraFollow.behavior === 'holdAngle') state.cameraFollow.behavior = 'angleCycle';
                if (!state.cameraFollow.behavior) {
                    state.cameraFollow.behavior = state.cameraFollow.enabled ? 'cinema' : 'lock';
                }
                if (state.cameraFollow.userManual == null) state.cameraFollow.userManual = false;
                if (state.cameraFollow.angleIndex == null) state.cameraFollow.angleIndex = 0;
                const behavior = state.cameraFollow.behavior;
                const mode = state.cameraFollow.mode || 'auto';
                const userManual = !!state.cameraFollow.userManual;
                const angleN = ((state.cameraFollow.angleIndex % 12) + 12) % 12 + 1;

                styleCamBehaviorBtn(btnCamCinema, !userManual && behavior === 'cinema');
                styleCamBehaviorBtn(btnCamLock, userManual || behavior === 'lock');
                styleCamBehaviorBtn(btnCamHoldAngle, !userManual && behavior === 'angleCycle');
                styleCamBehaviorBtn(btnCamFlycam, !userManual && behavior === 'flycam');

                if (lblCamFollow) {
                    if (userManual) {
                        lblCamFollow.textContent = state.lang === 'en' ? 'Mode: Manual' : 'Chế độ: Thủ công';
                    } else if (behavior === 'cinema') {
                        lblCamFollow.textContent = state.lang === 'en' ? 'Mode: Auto' : 'Chế độ: Auto';
                    } else if (behavior === 'angleCycle') {
                        lblCamFollow.textContent = state.lang === 'en'
                            ? `Mode: Angle ${angleN}/12`
                            : `Chế độ: Góc ${angleN}/12`;
                    } else if (behavior === 'flycam') {
                        lblCamFollow.textContent = state.lang === 'en' ? 'Mode: Flycam' : 'Chế độ: Flycam';
                    } else {
                        lblCamFollow.textContent = state.lang === 'en' ? 'Mode: Hold' : 'Chế độ: Giữ';
                    }
                }
                if (selCamFollowMode) {
                    const locked = userManual || behavior === 'lock';
                    selCamFollowMode.classList.toggle('opacity-40', locked);
                    selCamFollowMode.disabled = locked;
                    selCamFollowMode.value = mode;
                }
            };

            if (typeof window !== 'undefined') window.syncCameraFollowUI = syncCameraFollowUI;

            const applyCamBehavior = (behavior) => {
                if (typeof window.setCameraBehavior === 'function') {
                    window.setCameraBehavior(behavior);
                } else if (typeof setCameraBehavior === 'function') {
                    setCameraBehavior(behavior);
                } else {
                    state.cameraFollow = state.cameraFollow || {};
                    state.cameraFollow.behavior = behavior;
                    state.cameraFollow.enabled = behavior !== 'lock';
                    syncCameraFollowUI();
                }
            };

            if (btnCamCinema) {
                btnCamCinema.addEventListener('click', () => {
                    // Always re-run hero cinematic framing (rule of thirds) — even if already on Auto
                    if (typeof window.frameCinematicHeroShot === 'function') {
                        window.frameCinematicHeroShot({ duration: 0.95, force: true });
                    } else {
                        applyCamBehavior('cinema');
                    }
                });
            }
            if (btnCamLock) btnCamLock.addEventListener('click', () => applyCamBehavior('lock'));
            if (btnCamHoldAngle) btnCamHoldAngle.addEventListener('click', () => applyCamBehavior('angleCycle'));
            if (btnCamFlycam) btnCamFlycam.addEventListener('click', () => applyCamBehavior('flycam'));

            // Legacy hidden toggle still maps to cinema ↔ lock
            if (btnCamFollow) {
                btnCamFollow.addEventListener('click', () => {
                    const cur = (state.cameraFollow && state.cameraFollow.behavior) || 'cinema';
                    applyCamBehavior(cur === 'lock' ? 'cinema' : 'lock');
                });
            }

            if (selCamFollowMode) {
                selCamFollowMode.addEventListener('change', e => {
                    if (!state.cameraFollow) {
                        state.cameraFollow = {
                            enabled: true, behavior: 'flycam', mode: 'auto', smart: true,
                            customOffset: new THREE.Vector3(), lockedOffset: null, angleIndex: 0,
                            flycamPhase: 0, flycamYawRate: 0.18,
                            orbiting: false, paused: false, userManual: false,
                            suppressUiReframe: false, stableView: false, focusOverride: null
                        };
                    }
                    // Focus-mode select is an explicit control — clear manual override
                    if (state.cameraFollow.userManual || state.cameraFollow.behavior === 'lock') {
                        applyCamBehavior('angleCycle');
                    }
                    state.cameraFollow.userManual = false;
                    state.cameraFollow.mode = e.target.value;
                    state.cameraFollow.smart = state.cameraFollow.mode === 'auto'
                        || state.cameraFollow.behavior === 'cinema'
                        || state.cameraFollow.behavior === 'angleCycle'
                        || state.cameraFollow.behavior === 'flycam';
                    state.cameraFollow.paused = false;
                    state.cameraFollow.orbiting = false;
                    if (state.cameraFollow.mode === 'custom') {
                        const px = prompt('Nhập tọa độ Offset X (m) trên kiện:', state.cameraFollow.customOffset?.x || 0);
                        const py = prompt('Nhập tọa độ Offset Y (m) trên kiện:', state.cameraFollow.customOffset?.y || 0);
                        const pz = prompt('Nhập tọa độ Offset Z (m) trên kiện:', state.cameraFollow.customOffset?.z || 0);
                        if (px !== null && py !== null && pz !== null) {
                            state.cameraFollow.customOffset = new THREE.Vector3(parseFloat(px) || 0, parseFloat(py) || 0, parseFloat(pz) || 0);
                        }
                    }
                    if (state.cameraFollow.behavior === 'angleCycle' && typeof window.cycleCargoAngleShot === 'function') {
                        window.cycleCargoAngleShot({ duration: 0.65, advance: false });
                    } else if (typeof window.startCinematicUiFrame === 'function') {
                        // Focus-mode select is an explicit camera control — always allow
                        window.startCinematicUiFrame({ duration: 0.75, force: true });
                    }
                    syncCameraFollowUI();
                });
            }

            syncCameraFollowUI();

            // -------------------------------------------------------------
            // ENGINEERING CONTROLS: TIMBER DUNNAGE, CARGO SOIL, WIND & BOOM
            // -------------------------------------------------------------
            function updateSiteEngineeringCalculations() {
                const grossTon = (state.W_cargo || 22.0) + (state.W_rig || 1.23);
                const dunnageQty = parseInt(document.getElementById('sel-dunnage-qty')?.value || '2', 10) || 2;
                const sectionStr = document.getElementById('sel-dunnage-section')?.value || '200x200';
                const sectionParts = sectionStr.split('x').map(Number);
                const widthM = (sectionParts[0] || 200) / 1000;
                const dunnageLenM = parseFloat(document.getElementById('inp-dunnage-length')?.value || '3.0') || 3.0;
                const woodType = document.getElementById('sel-dunnage-wood')?.value || 'hardwood';
                
                // Allowable compression perp to grain: Hardwood ~14 MPa, Softwood ~8 MPa, Steel ~240 MPa
                const allowableMPa = woodType === 'hardwood' ? 14.0 : (woodType === 'softwood' ? 8.0 : 240.0);
                const allowableEl = document.getElementById('val-dunnage-allowable');
                if (allowableEl) allowableEl.textContent = `≤ ${allowableMPa.toFixed(1)} MPa`;

                // Total contact area between cargo and dunnage
                const cargoWidthM = Math.min(state.W || 2.4, dunnageLenM);
                const totalContactAreaM2 = Math.max(0.1, dunnageQty * widthM * cargoWidthM * 0.5);
                const totalForceN = grossTon * 9810;
                const contactPressureMPa = (totalForceN / (totalContactAreaM2 * 1e6));
                
                const pressEl = document.getElementById('val-dunnage-pressure');
                const badgeEl = document.getElementById('dunnage-status-badge');
                if (pressEl) pressEl.textContent = `${contactPressureMPa.toFixed(2)} MPa`;
                if (badgeEl) {
                    if (contactPressureMPa <= allowableMPa) {
                        badgeEl.className = 'text-[9px] font-mono font-bold px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-400 border border-emerald-500/40';
                        badgeEl.textContent = '🟢 ĐẠT CHUẨN NÉN';
                    } else {
                        badgeEl.className = 'text-[9px] font-mono font-bold px-2 py-0.5 rounded bg-rose-500/20 text-rose-400 border border-rose-500/40';
                        badgeEl.textContent = '🔴 VƯỢT GIỚI HẠN NÉN';
                    }
                }

                // Ground bearing pressure under dunnage
                const groundSoilType = document.getElementById('sel-cargo-soil')?.value || 'concrete';
                const soilCapMap = { concrete: 350.0, gravel: 30.0, stiff_clay: 15.0, soft_ground: 5.1 };
                const soilCap = soilCapMap[groundSoilType] || 350.0;
                const dunnageGroundArea = Math.max(0.2, dunnageQty * widthM * dunnageLenM);
                const cargoGbpTpm2 = grossTon / dunnageGroundArea;
                const cargoGbpKpa = cargoGbpTpm2 * 9.81;
                const soilSf = soilCap / Math.max(0.1, cargoGbpTpm2);

                const gbpValEl = document.getElementById('val-cargo-ground-press');
                const soilSfEl = document.getElementById('val-cargo-soil-sf');
                const soilBadge = document.getElementById('cargo-soil-badge');
                if (gbpValEl) gbpValEl.textContent = `${cargoGbpTpm2.toFixed(1)} T/m² (${cargoGbpKpa.toFixed(0)} kPa)`;
                if (soilSfEl) soilSfEl.textContent = `SF = ${soilSf.toFixed(1)} (${soilSf >= 1.5 ? 'Đạt' : 'Yếu'})`;
                if (soilBadge) {
                    if (soilSf >= 1.5) {
                        soilBadge.className = 'text-[9px] font-mono font-bold px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-400 border border-emerald-500/40';
                        soilBadge.textContent = '🟢 AN TOÀN NỀN';
                    } else {
                        soilBadge.className = 'text-[9px] font-mono font-bold px-2 py-0.5 rounded bg-rose-500/20 text-rose-400 border border-rose-500/40';
                        soilBadge.textContent = '🔴 NGUY CƠ LÚN NỀN';
                    }
                }

                // Wind Force & Deflection
                const windSpeed = parseFloat(document.getElementById('rng-wind-speed')?.value || '3.5') || 3.5;
                const isGust = Boolean(document.getElementById('chk-wind-gust')?.checked);
                const windDirDeg = parseFloat(document.getElementById('sel-wind-dir')?.value || '0') || 0;
                // Feed the live physics: the solver's stochastic wind field (dynamics.js)
                // takes the mean speed / direction / gust envelope from the site panel.
                if (state.wind) {
                    state.wind.speedMps = windSpeed;
                    state.wind.dirDeg = windDirDeg;
                    state.wind.gust = isGust;
                    state.wind.enabled = windSpeed > 0.01;
                }
                const effectiveWindSpeed = isGust ? windSpeed * 1.3 : windSpeed;
                const windSpeedKmH = effectiveWindSpeed * 3.6;

                let beaufort = 0;
                if (effectiveWindSpeed >= 24.5) beaufort = 10;
                else if (effectiveWindSpeed >= 20.8) beaufort = 9;
                else if (effectiveWindSpeed >= 17.2) beaufort = 8;
                else if (effectiveWindSpeed >= 13.9) beaufort = 7;
                else if (effectiveWindSpeed >= 10.8) beaufort = 6;
                else if (effectiveWindSpeed >= 8.0) beaufort = 5;
                else if (effectiveWindSpeed >= 5.5) beaufort = 4;
                else if (effectiveWindSpeed >= 3.4) beaufort = 3;
                else if (effectiveWindSpeed >= 1.6) beaufort = 2;
                else if (effectiveWindSpeed >= 0.3) beaufort = 1;

                const windValEl = document.getElementById('val-wind-speed');
                if (windValEl) {
                    windValEl.textContent = `${effectiveWindSpeed.toFixed(1)} m/s (${windSpeedKmH.toFixed(1)} km/h) · Beaufort ${beaufort}${isGust ? ' (Giật)' : ''}`;
                }

                const projectedArea = (state.L || 6.0) * (state.H || 2.5);
                const airDensity = 1.225;
                const cd = 1.2;
                const windForceN = 0.5 * airDensity * Math.pow(effectiveWindSpeed, 2) * cd * projectedArea;
                const windForceKN = windForceN / 1000;
                const windForceKgf = windForceN / 9.81;

                const forceValEl = document.getElementById('val-wind-force');
                if (forceValEl) forceValEl.textContent = `${windForceKN.toFixed(2)} kN (${windForceKgf.toFixed(0)} kgf)`;

                const totalWeightN = grossTon * 9810;
                const driftDeg = (Math.atan2(windForceN, Math.max(1000, totalWeightN)) * 180 / Math.PI);
                const driftEl = document.getElementById('val-wind-drift');
                if (driftEl) driftEl.textContent = `${driftDeg.toFixed(2)}° (${effectiveWindSpeed <= 9.8 ? 'Đạt chuẩn' : 'Cần giám sát'})`;
                // Design (static) values above; the live solver values are published per frame
                // by refreshLiveWindReadout() once the airborne cargo actually feels the gusts.
                phy.windDesign = { forceKN: windForceKN, driftDeg };

                const windBadge = document.getElementById('wind-status-badge');
                if (windBadge) {
                    if (effectiveWindSpeed <= 9.8) {
                        windBadge.className = 'text-[9px] font-mono font-bold px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-400 border border-emerald-500/40';
                        windBadge.textContent = `🟢 GIÓ AN TOÀN (CẤP ${beaufort})`;
                    } else if (effectiveWindSpeed <= 13.8) {
                        windBadge.className = 'text-[9px] font-mono font-bold px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/40';
                        windBadge.textContent = `🟡 CẢNH BÁO GIÓ (CẤP ${beaufort})`;
                    } else {
                        windBadge.className = 'text-[9px] font-mono font-bold px-2 py-0.5 rounded bg-rose-500/20 text-rose-400 border border-rose-500/40';
                        windBadge.textContent = `🔴 DỪNG CẨU KHẨN CẤP (CẤP ${beaufort})`;
                    }
                }
            }

            // Bind Site inputs
            ['sel-dunnage-qty', 'sel-dunnage-section', 'sel-dunnage-wood', 'inp-dunnage-length', 'sel-cargo-soil', 'rng-wind-speed', 'chk-wind-gust', 'sel-wind-dir'].forEach(id => {
                document.getElementById(id)?.addEventListener('input', updateSiteEngineeringCalculations);
                document.getElementById(id)?.addEventListener('change', updateSiteEngineeringCalculations);
            });

            const rngSlope = document.getElementById('rng-ground-slope');
            const valSlope = document.getElementById('val-ground-slope');
            if (rngSlope && valSlope) {
                rngSlope.addEventListener('input', () => {
                    valSlope.textContent = `${parseFloat(rngSlope.value).toFixed(1)}°`;
                    updateSiteEngineeringCalculations();
                });
            }

            // Bind Crane Boom & Reeving controls
            const rngBoomLen = document.getElementById('rng-boom-len');
            const valBoomLenSlider = document.getElementById('val-boom-len-slider');
            if (rngBoomLen && valBoomLenSlider) {
                rngBoomLen.addEventListener('input', () => {
                    valBoomLenSlider.textContent = `${parseFloat(rngBoomLen.value).toFixed(1)} m`;
                    const lmiBoomLen = document.getElementById('lmi-boom-len');
                    if (lmiBoomLen) lmiBoomLen.textContent = `${parseFloat(rngBoomLen.value).toFixed(1)} m`;
                });
            }

            const rngBoomAng = document.getElementById('rng-boom-ang');
            const valBoomAngSlider = document.getElementById('val-boom-ang-slider');
            if (rngBoomAng && valBoomAngSlider) {
                rngBoomAng.addEventListener('input', () => {
                    valBoomAngSlider.textContent = `${parseFloat(rngBoomAng.value).toFixed(1)}°`;
                    const lmiBoomAng = document.getElementById('lmi-boom-ang');
                    if (lmiBoomAng) lmiBoomAng.textContent = `${parseFloat(rngBoomAng.value).toFixed(1)}°`;
                });
            }

            const selReeving = document.getElementById('sel-crane-reeving');
            const valReevingCap = document.getElementById('val-reeving-capacity');
            if (selReeving && valReevingCap) {
                selReeving.addEventListener('change', () => {
                    const parts = parseInt(selReeving.value, 10) || 4;
                    const cap = parts * 10.5;
                    valReevingCap.textContent = `${cap.toFixed(1)} T`;
                });
            }

            updateSiteEngineeringCalculations();

            if (typeof bindPhase1Controls === 'function') {
                bindPhase1Controls();
            }
        }

        // ============================================================================
        // 13. 3D ASSET LIBRARY STUDIO, STL/OBJ/GLB PARSER & AI IMAGE-TO-3D ENGINE
