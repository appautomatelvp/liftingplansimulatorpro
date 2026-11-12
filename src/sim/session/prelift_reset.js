/**
 * session/prelift_reset — Nhớm / set-down / factory reset
 * Split from legacy god-file (strangler Phase 2). Shared scope via assemble.
 */
/**
 * session — part of the lifting simulator.
 * These files are assembled into one module so they share state, physics and the scene.
 */
        // --- 11. RESET TO INITIAL PRE-LIFT STATE, FACTORY RESET & SMOOTH AUTO-LEVEL ---

        /** Freeze hook/spreader/cables at the current suspended pose (after Nhấc thử / release Kéo). */
        function freezeSuspendedHoist() {
            phy.hoistSpeed = 0;
            phy.autoHoistActive = false;
            phy._trialLiftActive = false;
            if (phy.hookPos) {
                phy.hookTarget.x = phy.hookPos.x;
                phy.hookTarget.y = phy.hookPos.y;
                phy.hookTarget.z = phy.hookPos.z;
            }
            if (phy.hookVel) phy.hookVel.set(0, 0, 0);
            if (phy.cargoVel) phy.cargoVel.set(0, 0, 0);
            if (phy.cargoOmega) phy.cargoOmega.set(0, 0, 0);
            if (Array.isArray(phy.beams)) {
                phy.beams.forEach(b => {
                    if (b.v) b.v.set(0, 0, 0);
                    if (b.w) b.w.set(0, 0, 0);
                });
            }
            if ((phy.groundClearance || 0) > 0.08) {
                phy._stsPinsSnug = true;
                state.holdCableLength = true;
                if (!state.heldCableL0) state.heldCableL0 = { upper: [], leg: [], hanger: [], extra: [] };
                (phy.cables || []).forEach(c => {
                    if (typeof cableIsBroken === 'function' && cableIsBroken(c)) return;
                    const span = (typeof attachWorld === 'function')
                        ? attachWorld(c.a).distanceTo(attachWorld(c.b))
                        : (c.L0 || 1);
                    const L0 = Math.max(0.06, span);
                    c.L0 = L0;
                    c.designL0 = L0;
                    c.slack = false;
                    if (!state.heldCableL0[c.role]) state.heldCableL0[c.role] = [];
                    state.heldCableL0[c.role][c.index] = L0;
                });
                if (phy.hoist) {
                    if (typeof resetHoistDynamicState === 'function') resetHoistDynamicState(phy.hoist);
                    phy.hoist.kin.copy(phy.hookPos);
                }
            }
        }
        if (typeof window !== 'undefined') window.freezeSuspendedHoist = freezeSuspendedHoist;

        /**
         * Hạ đất: continuously and smoothly lowers the cargo to the ground at the configured speed,
         * with gentle touchdown deceleration, then snap-seat (poseLock).
         * Multiple clicks seamlessly continue the lowering motion without stuttering or velocity resets.
         */
        function beginSmoothSetDown() {
            const clearance = Math.max(
                phy.groundClearance || 0,
                (typeof cargoAabbClearance === 'function') ? cargoAabbClearance() : 0
            );
            // If already actively lowering to ground, smoothly keep lowering without resetting velocity
            if (phy._setDownActive) {
                const st = document.getElementById('sim-status-text');
                if (st) {
                    st.textContent = (typeof L === 'function')
                        ? L('Lowering in progress — descending smoothly to the quay...',
                            'Đang tiếp tục hạ đất — hạ êm xuống mặt sàn...')
                        : 'Đang tiếp tục hạ đất — hạ êm xuống mặt sàn...';
                }
                return;
            }
            // If already on ground, seat and lock immediately
            const alreadyDown = clearance < 0.04;
            if (alreadyDown) {
                finishSmoothSetDown();
                return;
            }
            // Cancel any active trial lift
            phy._trialLiftActive = false;
            phy._nhomFreezeSpreader = false;
            state.poseLock = false;
            if (typeof syncPoseLockUI === 'function') syncPoseLockUI();
            // Allow upper/leg payout while descending
            state.holdCableLength = false;
            state.heldCableL0 = null;
            phy._setDownActive = true;
            phy._stsPinsSnug = true;
            phy.autoHoistActive = true;
            phy.hoistSpeed = 0;
            if (phy.hookPos) phy.hookTarget.copy(phy.hookPos);

            const st = document.getElementById('sim-status-text');
            if (st) {
                st.textContent = (typeof L === 'function')
                    ? L('Setting down — lowering smoothly until cargo touches the quay.',
                        'Hạ đất — hạ êm từ từ theo tốc độ cài đặt đến khi kiện chạm đất an toàn.')
                    : 'Hạ đất — hạ êm từ từ theo tốc độ cài đặt đến khi kiện chạm đất an toàn.';
            }
        }

        function finishSmoothSetDown() {
            phy._setDownActive = false;
            phy._trialLiftActive = false;
            phy.autoHoistActive = false;
            phy.hoistSpeed = 0;
            resetToInitialPreLiftState();
        }
        if (typeof window !== 'undefined') {
            window.beginSmoothSetDown = beginSmoothSetDown;
            window.finishSmoothSetDown = finishSmoothSetDown;
        }

        function resetToInitialPreLiftState() {
            phy.autoHoistActive = false;
            phy.hoistSpeed = 0;
            phy._setDownActive = false;
            phy._trialLiftActive = false;
            phy._nhomFreezeSpreader = false;
            if (typeof invalidateContainerHomePad === 'function') invalidateContainerHomePad();
            if (phy.hookVel) phy.hookVel.set(0, 0, 0);
            if (phy.cargoVel) phy.cargoVel.set(0, 0, 0);
            if (phy.cargoOmega) phy.cargoOmega.set(0, 0, 0);
            // Keep yaw / plan — only kill spin for a clean set-down seat
            if (Array.isArray(phy.beams)) {
                phy.beams.forEach(b => {
                    if (b.v) b.v.set(0, 0, 0);
                    if (b.w) b.w.set(0, 0, 0);
                });
            }
            resetFlatRackPayloadState();
            // Drop Nhớm hold — parking the hook at design height with short snug L0
            // was snatching the cargo a few cm back into the air after Hạ đất.
            state.holdCableLength = false;
            state.heldCableL0 = null;
            // Seat on quay; twin residual gap is preserved inside applyLockedPose.
            state.poseLock = true;
            applyLockedPose();
            phy.legTensions = [0, 0, 0, 0, 0, 0, 0, 0];
            phy.legSlacks = [true, true, true, true, true, true, true, true];
            phy.upperTensions = [0, 0, 0, 0, 0, 0, 0, 0];
            phy.groundClearance = 0;
            syncPoseLockUI();
            parkHookSlack();
            // Seat the spreader on the cargo roof FIRST, then pay out L0 past the
            // live span. Measuring while the beam was still hanging made uppers
            // re-taut and snatch the cargo up a few cm after Hạ đất.
            if (Array.isArray(phy.beams) && state.beamType !== 'none') {
                phy.beams.forEach(b => {
                    if (typeof clampBeamAboveCargoRoof === 'function') {
                        clampBeamAboveCargoRoof(b);
                    }
                    const spec = (typeof getRigSpec === 'function') ? getRigSpec() : null;
                    if (typeof cargoCeilingUnderBeam === 'function') {
                        const floorY = cargoCeilingUnderBeam(b.x.x, b.x.z, spec, b);
                        if (isFinite(floorY) && floorY > -1e5) {
                            b.x.y = floorY;
                            b.isRestingOnCargo = true;
                            if (b.v) b.v.set(0, 0, 0);
                            if (b.group) b.group.position.copy(b.x);
                        }
                    }
                });
            }
            if (typeof attachWorld === 'function' && Array.isArray(phy.cables)) {
                if (state.gear && state.gear.legs) {
                    state.gear.legs.forEach(leg => {
                        if (!leg) return;
                        leg.lengthM = null;
                        leg.userSet = false;
                    });
                }
                if (state.gear && state.gear.uppers) {
                    state.gear.uppers.forEach(u => {
                        if (!u) return;
                        u.lengthM = null;
                        u.userSet = false;
                    });
                }
                phy.cables.forEach(c => {
                    if (typeof cableIsBroken === 'function' && cableIsBroken(c)) return;
                    const span = attachWorld(c.a).distanceTo(attachWorld(c.b));
                    const slack = Math.min(0.55, Math.max(0.18, span * 0.05));
                    const L0 = Math.max(0.08, span + slack);
                    c.L0 = L0;
                    c.designL0 = L0;
                    c.slack = true;
                    c.tensionT = 0;
                });
                phy.legSlacks = [true, true, true, true, true, true, true, true];
                phy.legTensions = [0, 0, 0, 0, 0, 0, 0, 0];
                phy.upperTensions = [0, 0, 0, 0, 0, 0, 0, 0];
            }
            // Keep beam on the roof after payout (kinematic hang would lift it again).
            phy._nhomFreezeSpreader = true;
            if (Array.isArray(phy.beams)) {
                phy.beams.forEach(b => {
                    if (typeof clampBeamAboveCargoRoof === 'function') clampBeamAboveCargoRoof(b);
                });
            }
            if (typeof applyLockedPose === 'function') applyLockedPose();
            phy.groundClearance = 0;
            state.pullRadius = 0;
            syncOrientationAndPullUI();
            if (typeof syncSlingSlidersFromState === 'function') syncSlingSlidersFromState();
            const gapNote = (phy.twinCableFlare && (phy.twinCableFlare.sepExtra || 0) > 0.08)
                ? L(' Residual twin gap kept after pry-open.', ' Giữ khe twin sau khi ngoác.')
                : '';
            document.getElementById('sim-status-text').textContent = L(
                'Set down. Cargo on the quay, ropes slack.' + gapNote,
                'Đã hạ đất. Kiện sát mặt đất, cáp chùng.' + gapNote
            );
        }

        /**
         * Nhớm cáp: cargo stays on the quay; take up slack at the CURRENT spreader/
         * hook pose. Never fly the beam skyward or lengthen ropes to a taut geometry.
         */
        function pretensionRig() {
            phy.autoHoistActive = false;
            phy.hoistSpeed = 0;
            if (phy.hookVel) phy.hookVel.set(0, 0, 0);
            if (phy.cargoVel) phy.cargoVel.set(0, 0, 0);
            if (phy.cargoOmega) phy.cargoOmega.set(0, 0, 0);
            if (Array.isArray(phy.beams)) {
                phy.beams.forEach(b => {
                    if (b.v) b.v.set(0, 0, 0);
                    if (b.w) b.w.set(0, 0, 0);
                });
            }

            // Keep residual twin gap if already pry-opened; only flatten pitch for seating.
            if (typeof stsTwinCableMode === 'function' && stsTwinCableMode()
                && phy.twinCableFlare) {
                phy.twinCableFlare.pitchA = 0;
                phy.twinCableFlare.pitchB = 0;
                phy.twinCableFlare.targetSmooth = 0;
                phy.twinCableFlare.active = (phy.twinCableFlare.sepExtra || 0) > 0.01;
                if (typeof applyStsTwinCableFlareVisual === 'function') applyStsTwinCableFlareVisual();
                if (typeof syncTwinCableLugsFromFlare === 'function') syncTwinCableLugsFromFlare();
            }

            // Seat cargo on the quay — do NOT reset yaw/plan to origin mid-job.
            if (typeof applyLockedPose === 'function') {
                state.poseLock = true;
                applyLockedPose();
            } else if (typeof supportY === 'function' && phy.cargoPos) {
                phy.cargoPos.y = supportY(phy.cargoPos.x, phy.cargoPos.z) + state.H * 0.5;
            }
            phy.groundClearance = 0;
            state.poseLock = true;
            if (typeof syncPoseLockUI === 'function') syncPoseLockUI();

            // Keep hook/spreader WHERE THEY ARE — Nhớm is take-up, not a hoist.
            // (Old syncHookToRigTaut / *0.998 ratchet flew the beam skyward on repeat clicks.)
            const hookSnap = phy.hookPos ? phy.hookPos.clone() : null;
            const beamSnaps = (Array.isArray(phy.beams) ? phy.beams : []).map(b => ({
                x: b.x ? b.x.clone() : null,
                q: b.q ? b.q.clone() : null
            }));

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
            phy.hookTarget.copy(phy.hookPos);

            if (Array.isArray(phy.beams) && phy.beams.length) {
                phy.beams.forEach(b => {
                    // STS: keep plan under trolley, but NEVER yank Y up to the hook —
                    // that lengthened lower chords and raised the yellow beam.
                    if (state.beamType === 'container_spreader' && phy.hookPos) {
                        b.x.x = phy.hookPos.x;
                        b.x.z = phy.hookPos.z;
                    }
                    if (b.v) b.v.set(0, 0, 0);
                    if (b.w) b.w.set(0, 0, 0);
                });
            }

            // Take up slack at the CURRENT pin-to-pin span only.
            // Never lengthen. Never ratchet shorter when already snug (repeat-click safe).
            state.holdCableLength = true;
            state.heldCableL0 = { upper: [], leg: [], hanger: [], extra: [] };
            let tookUp = false;
            // Pass 1: compute per-cable snug from current span
            const snugByKey = {};
            (phy.cables || []).forEach(c => {
                if (typeof cableIsBroken === 'function' && cableIsBroken(c)) return;
                const span = (typeof attachWorld === 'function')
                    ? attachWorld(c.a).distanceTo(attachWorld(c.b))
                    : (c.L0 || 1);
                const prev = c.L0 != null ? c.L0 : span;
                const minL0 = (c.role === 'leg'
                    && typeof isStsDirectAttach === 'function'
                    && isStsDirectAttach()) ? 0.04 : 0.08;
                // Nhớm = take up SLACK only. Never lengthen.
                let snug;
                if (prev > span + 0.012) {
                    snug = Math.max(minL0, span * 0.996);
                } else {
                    snug = Math.max(minL0, prev);
                }
                snugByKey[`${c.role}:${c.index}`] = { c, snug, prev };
            });
            // Pass 2: equalize UPPER and HANGER tiers to a shared even length so a
            // slight mid-pose tilt cannot lock permanently asymmetric L0 (the main
            // reason cascaded / frame / basket looked worse than modular after Nhớm).
            const equalizeRole = (role) => {
                const rows = Object.keys(snugByKey)
                    .filter(k => k.startsWith(role + ':'))
                    .map(k => snugByKey[k]);
                if (rows.length < 2) return;
                const avg = rows.reduce((s, r) => s + r.snug, 0) / rows.length;
                const even = Math.max(0.08, Math.round(avg * 100) / 100);
                rows.forEach(r => { r.snug = even; });
            };
            equalizeRole('upper');
            equalizeRole('hanger');

            Object.keys(snugByKey).forEach(k => {
                const { c, snug, prev } = snugByKey[k];
                if (Math.abs(snug - prev) > 1e-4) tookUp = true;
                c.L0 = snug;
                c.designL0 = snug;
                c.slack = false;
                c.tensionT = 0.12;
                c._sum = 0.12 * 9.81 * 1000;
                if (!state.heldCableL0[c.role]) state.heldCableL0[c.role] = [];
                state.heldCableL0[c.role][c.index] = snug;
                if (c.role === 'leg' && state.gear && state.gear.legs && state.gear.legs[c.index]) {
                    state.gear.legs[c.index].lengthM = snug;
                    state.gear.legs[c.index].userSet = true;
                }
                if (c.role === 'upper' && state.gear && state.gear.uppers && state.gear.uppers[c.index]) {
                    state.gear.uppers[c.index].lengthM = snug;
                    state.gear.uppers[c.index].userSet = true;
                }
                if (c.role === 'hanger' && state.gear && state.gear.hangers && state.gear.hangers[c.index]) {
                    state.gear.hangers[c.index].lengthM = snug;
                    state.gear.hangers[c.index].userSet = true;
                }
            });
            // Keep global tier lengths aligned with the equalized set
            const sampleUpper = (phy.cables || []).find(c => c.role === 'upper' && !cableIsBroken(c));
            if (sampleUpper && sampleUpper.L0 > 0.2) {
                state.upperSlingLength = sampleUpper.L0;
                state.slingLength = sampleUpper.L0;
            }
            const sampleHanger = (phy.cables || []).find(c => c.role === 'hanger' && !cableIsBroken(c));
            if (sampleHanger && sampleHanger.L0 > 0.2) {
                state.hangerSlingLength = sampleHanger.L0;
            }
            if (Array.isArray(phy.legSlacks)) phy.legSlacks.fill(false);
            if (Array.isArray(phy.legTensions)) phy.legTensions.fill(0.06);

            // Freeze before telemetry so poseLock kinematic seed cannot lift the beam.
            phy._nhomFreezeSpreader = true;
            if (typeof syncCableRest === 'function') syncCableRest(false);
            if (typeof updateSceneAndTelemetry === 'function') updateSceneAndTelemetry();
            if (typeof updateCraneKinematics === 'function') updateCraneKinematics();

            // Re-pin hook/beam after telemetry (absolute pose must match the snapshot).
            if (hookSnap && phy.hookPos) {
                phy.hookPos.copy(hookSnap);
                phy.hookTarget.copy(hookSnap);
                if (phy.hoist && phy.hoist.kin) phy.hoist.kin.copy(hookSnap);
            }
            beamSnaps.forEach((s, i) => {
                const b = phy.beams && phy.beams[i];
                if (!b || !s.x) return;
                b.x.copy(s.x);
                if (state.beamType === 'container_spreader' && phy.hookPos) {
                    b.x.x = phy.hookPos.x;
                    b.x.z = phy.hookPos.z;
                }
                if (s.q && b.q) b.q.copy(s.q);
                if (b.v) b.v.set(0, 0, 0);
                if (b.w) b.w.set(0, 0, 0);
                // Never leave the spreader buried inside the cargo solid.
                if (typeof clampBeamAboveCargoRoof === 'function') clampBeamAboveCargoRoof(b);
                else if (b.group) {
                    b.group.position.copy(b.x);
                    if (b.q) b.group.quaternion.copy(b.q);
                }
            });

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
                if (state.lang === 'en') {
                    statusEl.textContent = tookUp
                        ? '⚡ Slings snug at current height. Cargo still on the quay — ready to hoist.'
                        : '⚡ Already snug — hook/spreader unchanged. Ready to hoist.';
                } else {
                    statusEl.textContent = tookUp
                        ? '⚡ Đã nhớm căng cáp tại cao độ hiện tại. Kiện vẫn sát đất — sẵn sàng kéo lên.'
                        : '⚡ Cáp đã căng sẵn — giữ nguyên móc/ngáng. Sẵn sàng kéo lên.';
                }
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
                oogOh: state.oogOh,
                oogOwL: state.oogOwL,
                oogOwR: state.oogOwR,
                oogOlF: state.oogOlF,
                oogOlR: state.oogOlR,
                oogCargoOffsetX: state.oogCargoOffsetX,
                oogCargoOffsetZ: state.oogCargoOffsetZ,
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
            if (b.oogOh != null) state.oogOh = b.oogOh;
            if (b.oogOwL != null) state.oogOwL = b.oogOwL;
            if (b.oogOwR != null) state.oogOwR = b.oogOwR;
            if (b.oogOlF != null) state.oogOlF = b.oogOlF;
            if (b.oogOlR != null) state.oogOlR = b.oogOlR;
            if (b.oogCargoOffsetX != null) state.oogCargoOffsetX = b.oogCargoOffsetX;
            if (b.oogCargoOffsetZ != null) state.oogCargoOffsetZ = b.oogCargoOffsetZ;
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

            applyStartupAssemblyPreset();
            // Size cable / chain / beam / shackle / hook from cargo weight (MBL = WLL×SF)
            if (typeof autoSizeGearForLoad === 'function') {
                autoSizeGearForLoad(state.weight, { betaWorstDeg: 40 });
            }
            if (typeof applyPullAnglePreset === 'function') {
                applyPullAnglePreset(50);
            } else if (typeof applyAbsoluteSafeRiggingPreset === 'function') {
                // fall through — absolute preset also sizes gear
            }

            if (typeof syncSlingSlidersFromState === 'function') syncSlingSlidersFromState();
            else {
                const inpSlingL = document.getElementById('inp-slingL');
                if (inpSlingL) inpSlingL.value = state.upperSlingLength || 8;
                const vSlingL = document.getElementById('v-slingL');
                if (vSlingL) vSlingL.textContent = String(state.upperSlingLength || 8);
                const inpWll = document.getElementById('inp-wll');
                if (inpWll) inpWll.value = state.wllPerLeg || 16;
                const vWll = document.getElementById('v-wll');
                if (vWll) vWll.textContent = String(state.wllPerLeg || 16);
            }
            document.querySelectorAll('#sling-store .card-btn').forEach(c => c.classList.toggle('active', c.dataset.sling === 'wire'));
            document.querySelectorAll('#hw-store .card-btn').forEach(c => c.classList.toggle('active', c.dataset.hw === 'bow_shackle'));

            buildCraneVehicle();
            buildWorld();
            document.querySelectorAll('#scene-store .card-btn').forEach(c => c.classList.toggle('active', c.dataset.scene === 'studio'));
            document.querySelectorAll('#ground-store .card-btn').forEach(c => c.classList.toggle('active', c.dataset.ground === 'flat'));
            selectLPTab('all');
            rebuildCargoAndRig(true);
            if (typeof clearStsTwinCableFlareState === 'function') clearStsTwinCableFlareState();
            resetToInitialPreLiftState();
            document.getElementById('sim-status-text').textContent = '🧹 Đã Reset về mặc định';
        }

        /**
         * Auto-hoist so cargo underside clears the quay by `desiredClearance` metres.
         * Nhấc thử uses ~3 m. Never yank the hook downward after Nhớm.
         */
        function autoPositionHookForLift(desiredClearance) {
            const { beamType, cogX, cogZ } = state;
            const clearance = Math.max(0.35, desiredClearance != null ? desiredClearance : 1.0);
            const spec = getRigSpec();
            const support = (typeof supportY === 'function')
                ? supportY(phy.cargoPos.x, phy.cargoPos.z)
                : 0;
            const H = state.H || 2.6;
            // Target: cargo bottom ≈ support + clearance  →  centre = support + H/2 + clearance
            const wantCargoY = support + H * 0.5 + clearance;

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
                horizU = Math.max(0.35, Math.hypot(0.55, 0.35));
            } else if (beamType === 'frame' || customBeamMeshes[beamType]) {
                horizU = Math.max(0.35, Math.hypot(spanX / 2, spanZ / 2));
            }

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

            let targetY;
            if (stsDirectLift) {
                // Hook above flush twistlock seat at the trial-lift cargo height.
                const wantRoof = wantCargoY + H * 0.5;
                const beamY = wantRoof + 0.34;
                targetY = beamY + 0.22;
            } else {
                const tautMasterY = lugBoreY + lowerDropActual + beamStructuralSep + upperDropActual;
                // Raise so cargo reaches wantCargoY: delta from current cargo centre
                const cargoDelta = Math.max(0, wantCargoY - (phy.cargoPos ? phy.cargoPos.y : wantCargoY));
                targetY = tautMasterY - HOOK_MASTER_OFFSET_Y + cargoDelta;
            }

            const curY = phy.hookPos ? phy.hookPos.y : targetY;
            // Never yank downward after Nhớm; always climb at least a short step.
            targetY = Math.max(targetY, curY + 0.35);
            targetY = THREE.MathUtils.clamp(targetY, 2.8, 40.0);

            const azRad = THREE.MathUtils.degToRad(state.pullAzimuthDeg);
            const pullOffX = state.pullRadius * Math.cos(azRad);
            const pullOffZ = state.pullRadius * Math.sin(azRad);
            const rotatedCoG = new THREE.Vector3(cogX, 0, cogZ).applyAxisAngle(new THREE.Vector3(0, 1, 0), THREE.MathUtils.degToRad(state.cargoYawDeg));

            phy.hoistSpeed = 0;
            phy.autoHoistActive = true;
            phy._stsPinsSnug = true;
            phy.hookTarget.set(rotatedCoG.x + pullOffX, targetY, rotatedCoG.z + pullOffZ);
            // Lead clearly upward so advanceHook treats this as rising at cargoHoistRates.
            if (phy.hookPos && phy.hookTarget.y <= phy.hookPos.y + 0.05) {
                phy.hookTarget.y = phy.hookPos.y + Math.max(0.35, clearance * 0.25);
            }
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

