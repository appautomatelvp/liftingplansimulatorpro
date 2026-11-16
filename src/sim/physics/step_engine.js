/**
 * physics/step_engine — stepPhysicsEngine orchestration
 * Split from legacy god-file (strangler Phase 2). Shared scope via assemble.
 */
        function stepPhysicsEngine() {
            const frameDt = 1 / 60;
            const substeps = 16;
            const dt = frameDt / substeps;
            phy.simFrame = (phy.simFrame || 0) + 1;

            // A cable can also be marked broken by an external control, an
            // imported scenario, or an automatic overload rule.  Do this check
            // before the pose-lock early return: a broken load path can never
            // remain a kinematic display pose.  This makes the transition
            // deterministic even when a caller did not go through the editor
            // button / noteCableSnap helper.
            if (state.poseLock && (phy.cables || []).some(cableIsBroken)) {
                releaseRigForCableFailure();
            }

            // Breaks can arrive from the editor, imported scenarios, overload
            // logic or automated tests.  Route every path through the same
            // one-time release physics so a flag change cannot silently remove
            // a cable without releasing its stored tension / angular impulse.
            (phy.cables || []).forEach(cable => {
                if (!cableIsBroken(cable)) {
                    cable._failureProcessed = false;
                    return;
                }
                if (cable._failureProcessed) return;
                releaseRigForCableFailure();
                releaseSnapImpulse(cable);
                applyLostFrameBranchMoment(cable);
                initCableBreak(cable);
                cable._failureProcessed = true;
                phy.shock = Math.max(phy.shock || 1, 1.55);
                phy.shockFrames = Math.max(phy.shockFrames || 0, 10);
            });

            // Hạ đất: keep commanding lower every frame at live slider speed until seated.
            if (phy._setDownActive) {
                const aabbClr = (typeof cargoAabbClearance === 'function')
                    ? cargoAabbClearance()
                    : (phy.groundClearance || 0);
                const seated = (phy.groundClearance || 0) < 0.008 && aabbClr < 0.012;
                if (seated && !phy._setDownFullSlack) {
                    if (typeof finishSmoothSetDown === 'function') finishSmoothSetDown();
                } else if (seated && phy._setDownFullSlack) {
                    const stsDirectDown = state.beamType === 'container_spreader'
                        && typeof isStsDirectAttach === 'function' && isStsDirectAttach();
                    const allSlackNow = stsDirectDown || (typeof attachWorld === 'function' && (phy.cables || []).every(c => {
                        if (typeof cableIsBroken === 'function' && cableIsBroken(c)) return true;
                        return c.slack || attachWorld(c.a).distanceTo(attachWorld(c.b)) < (c.L0 || 1) - 0.02;
                    }));
                    if (allSlackNow && typeof finishSmoothSetDown === 'function') {
                        finishSmoothSetDown();
                    } else {
                        phy.hoistSpeed = (typeof hoistHoldSpeed === 'function') ? hoistHoldSpeed(-1) : -0.35;
                    }
                } else {
                    state.poseLock = false;
                    phy.autoHoistActive = false;
                    phy._stsPinsSnug = true;
                    const baseDown = (typeof hoistHoldSpeed === 'function')
                        ? hoistHoldSpeed(-1)
                        : -Math.abs((cargoHoistRates && cargoHoistRates().down) || 0.22);
                    const clr = Math.max(phy.groundClearance || 0, aabbClr);
                    let vDown = baseDown;
                    if (clr < 0.35) {
                        const ratio = Math.max(0.08, clr / 0.35);
                        vDown = baseDown * Math.pow(ratio, 0.65);
                    }
                    phy.hoistSpeed = vDown;
                }
            }

            if (phy.hoistSpeed !== 0) {
                phy.autoHoistActive = false;
                // Standardized constant cargo hoist speed regardless of cargo weight or spreader type
                const actualSpeed = phy.hoistSpeed;
                // Cargo ground clearance hard cap = 50 m AGL (hook ceiling leaves headroom for sling/spreader).
                const MAX_CARGO_AGL_M = 50;
                const MAX_HOOK_Y_M = 56;
                if (actualSpeed > 0 && (phy.groundClearance || 0) >= MAX_CARGO_AGL_M - 0.02) {
                    phy.hoistSpeed = 0;
                    phy.hookTarget.y = Math.min(phy.hookTarget.y, phy.hookPos ? phy.hookPos.y : phy.hookTarget.y);
                } else {
                    phy.hookTarget.y = THREE.MathUtils.clamp(
                        phy.hookTarget.y + actualSpeed * frameDt,
                        0.8,
                        MAX_HOOK_Y_M
                    );
                }
            }

            if (phy.slewRate !== 0) {
                let ang = Math.atan2(phy.hookTarget.z, phy.hookTarget.x);
                let r = Math.hypot(phy.hookTarget.x, phy.hookTarget.z);
                if (r < 0.85) r = 3.4;
                ang += THREE.MathUtils.degToRad(phy.slewRate) * frameDt;
                phy.hookTarget.x = THREE.MathUtils.clamp(Math.cos(ang) * r, -7, 7);
                phy.hookTarget.z = THREE.MathUtils.clamp(Math.sin(ang) * r, -6, 6);
                state.slewDeg = (THREE.MathUtils.radToDeg(ang) + 360) % 360;
                state.pullRadius = Math.hypot(phy.hookTarget.x, phy.hookTarget.z);
                state.pullAzimuthDeg = state.slewDeg;
                const slewEl = document.getElementById('val-slew');
                if (slewEl) slewEl.textContent = Math.round(state.slewDeg) + '°';
            }

            if (state.poseLock && (phy.hoistSpeed > 0 || phy.autoHoistActive || (dragTarget && dragTarget.type === 'hook') || phy.hookTarget.y > phy.hookPos.y + 0.05)) {
                state.poseLock = false;
                phy._nhomFreezeSpreader = false;
                syncPoseLockUI();
            }

            if (state.poseLock) {
                phy.rigLive = false;
                // Keep weather field alive while seated so rain/wind FX + HUD still update.
                if (typeof stepWindField === 'function') stepWindField(frameDt);
                if (typeof publishSeatedWeatherTelemetry === 'function') {
                    publishSeatedWeatherTelemetry();
                }
                resetFlatRackPayloadState();
                applyLockedPose();
                if (typeof syncCableRest === 'function') syncCableRest(false);
                // Paying out onto the cargo roof: drop Nhớm freeze so the beam can
                // follow the hook down and seat on the lid (never tunnel through).
                if ((phy.hoistSpeed || 0) < -0.01 || (phy.hookTarget && phy.hookPos && phy.hookTarget.y < phy.hookPos.y - 0.04)) {
                    phy._nhomFreezeSpreader = false;
                }
                if (phy._nhomFreezeSpreader && Array.isArray(phy.beams)) {
                    phy.beams.forEach(b => {
                        if (b.v) b.v.set(0, 0, 0);
                        if (b.w) b.w.set(0, 0, 0);
                        clampBeamAboveCargoRoof(b);
                    });
                } else {
                    seedBeamsFromKinematic();
                }
                // Hard roof clamp every pose-lock frame (safety net).
                if (Array.isArray(phy.beams)) phy.beams.forEach(clampBeamAboveCargoRoof);
                advanceHook(frameDt);
                if (phy._nhomFreezeSpreader && !phy.autoHoistActive
                    && Math.abs(phy.hoistSpeed || 0) < 0.01 && !(dragTarget && dragTarget.type === 'hook')
                    && phy.hookPos && phy.hookTarget && phy.hookPos.y < phy.hookTarget.y - 0.001) {
                    phy.hookPos.y = phy.hookTarget.y;
                    if (phy.hoist && phy.hoist.kin && phy.hoist.off) {
                        phy.hoist.kin.y = phy.hookTarget.y - phy.hoist.off.y;
                    }
                }
                stepCornerYield(frameDt);
                // Nhớm cáp: keep light pretension + non-slack flags so ropes DRAW taut
                // while cargo stays on the quay. Blanking tensions forced a gravity belly.
                if (phy._nhomFreezeSpreader) {
                    phy.legTensions = phy.legTensions || [0, 0, 0, 0, 0, 0, 0, 0];
                    phy.upperTensions = phy.upperTensions || [0, 0, 0, 0, 0, 0, 0, 0];
                    phy.legSlacks = phy.legSlacks || [true, true, true, true, true, true, true, true];
                    phy.legForceN = phy.legForceN || [0, 0, 0, 0, 0, 0, 0, 0];
                    for (let i = 0; i < phy.legTensions.length; i++) {
                        phy.legTensions[i] = 0;
                        phy.legSlacks[i] = true;
                        phy.legForceN[i] = 0;
                    }
                    for (let i = 0; i < phy.upperTensions.length; i++) phy.upperTensions[i] = 0;
                    (phy.cables || []).forEach(c => {
                        if (typeof cableIsBroken === 'function' && cableIsBroken(c)) return;
                        const span = (typeof attachWorld === 'function')
                            ? attachWorld(c.a).distanceTo(attachWorld(c.b))
                            : (c.L0 || 0);
                        const snug = span >= (c.L0 || 0) - 0.02;
                        c.slack = !snug;
                        if (!snug) return;
                        c.tensionT = Math.max(c.tensionT || 0, 0.10);
                        c._sum = c.tensionT * 9.81 * 1000;
                        if (c.role === 'leg' && c.index != null) {
                            phy.legSlacks[c.index] = false;
                            phy.legTensions[c.index] = Math.max(0.10, phy.legTensions[c.index] || 0);
                            phy.legForceN[c.index] = phy.legTensions[c.index] * 9.81 * 1000;
                        }
                        if (c.role === 'upper' && c.index != null) {
                            phy.upperTensions[c.index] = Math.max(0.10, phy.upperTensions[c.index] || 0);
                        }
                    });
                } else {
                    phy.legTensions = [0, 0, 0, 0, 0, 0, 0, 0];
                    phy.upperTensions = [0, 0, 0, 0, 0, 0, 0, 0];
                    phy.legSlacks = [true, true, true, true, true, true, true, true];
                    phy.legForceN = [0, 0, 0, 0, 0, 0, 0, 0];
                }
                phy.groundClearance = 0;
                const hookY = document.getElementById('inp-hook-y');
                if (hookY) {
                    phy.suppressHookInput = true;
                    hookY.value = phy.hookPos.y.toFixed(2);
                    phy.suppressHookInput = false;
                }
                const hookLbl = document.getElementById('val-hook-y');
                if (hookLbl) hookLbl.textContent = phy.hookPos.y.toFixed(1) + 'm';
                const numHookY = document.getElementById('num-hook-y');
                if (numHookY && document.activeElement !== numHookY) numHookY.value = phy.hookPos.y.toFixed(1);
                return;
            }

            runXpbdFrame(frameDt);
            if (!(phy.beams && phy.beams.length)) separateCargoFromBeam();
            stepCornerYield(frameDt);
            stepFlatRackPayloadPhysics(frameDt);

            if ((phy.impactCooldown || 0) > 0) phy.impactCooldown--;
            if ((phy.touchdownCooldown || 0) > 0) phy.touchdownCooldown--;
            if ((phy.pendingImpact || 0) > 3.2) {
                dentCargo(phy.pendingImpact);
                phy.pendingImpact = 0;
            }

            sanitizeSimBodies();

            publishCableLoads();

            const hookY = document.getElementById('inp-hook-y');
            if (hookY) {
                phy.suppressHookInput = true;
                hookY.value = phy.hookPos.y.toFixed(2);
                phy.suppressHookInput = false;
            }
            const hookLbl = document.getElementById('val-hook-y');
            if (hookLbl) hookLbl.textContent = phy.hookPos.y.toFixed(1) + 'm';
            const numHookY = document.getElementById('num-hook-y');
            if (numHookY && document.activeElement !== numHookY) numHookY.value = phy.hookPos.y.toFixed(1);
        }

        function syncPoseLockUI() {
            const el = document.getElementById('lbl-pose-lock');
            const hud = document.getElementById('hud-pose');
            if (el) {
                el.textContent = state.poseLock ? L('POSE LOCKED', 'KHÓA GÓC ĐẶT') : L('FREE TO ROTATE', 'ĐANG ĐỂ VẬT LÝ XOAY');
                el.className = 'text-[10px] font-mono font-bold ' + (state.poseLock ? 'text-amber-300' : 'text-sky-300');
            }
            if (hud) hud.textContent = state.poseLock ? L('Pose locked', 'Góc đặt đang khóa') : L('Cargo rotating on the ropes', 'Hàng đang xoay theo cáp');
        }

        function applyLockedPose() {
            const eul = new THREE.Euler(
                THREE.MathUtils.degToRad(state.cargoPitchTrimDeg),
                THREE.MathUtils.degToRad(state.cargoYawDeg),
                THREE.MathUtils.degToRad(state.cargoRollTrimDeg),
                'YXZ'
            );
            phy.cargoQuat.setFromEuler(eul);
            phy.cargoOmega.set(0, 0, 0);
            phy.cargoVel.set(0, 0, 0);
            // Twin+cable: flatten pitch for a true set-down seat, keep friction gap,
            // then refresh half meshes + lug locals before measuring contacts.
            if (typeof stsTwinCableMode === 'function' && stsTwinCableMode()) {
                const st = ensureTwinCableFlareState();
                st.pitchA = 0;
                st.pitchB = 0;
                if (typeof applyStsTwinCableFlareVisual === 'function') applyStsTwinCableFlareVisual();
                if (typeof syncTwinCableLugsFromFlare === 'function') syncTwinCableLugsFromFlare();
            }
            // Seat with the SAME contact set the free XPBD ground solver uses
            // (AABB corners + mesh support feet).  Using only supportPointsLocal
            // left the AABB bottom buried ~0.2 m on flat-rack/OOG cargos, so
            // unlocking pose (e.g. pressing Hạ after Nhớm cáp) launched the load.
            const pts = (typeof contactLocals === 'function') ? contactLocals() : supportPointsLocal();
            phy.cargoPos.y = supportY(phy.cargoPos.x, phy.cargoPos.z) + state.H;
            for (let n = 0; n < 12; n++) {
                let minGap = Infinity;
                for (let i = 0; i < pts.length; i++) {
                    const w = pts[i].clone().applyQuaternion(phy.cargoQuat).add(phy.cargoPos);
                    const gap = w.y - supportY(w.x, w.z);
                    if (gap < minGap) minGap = gap;
                }
                if (!isFinite(minGap) || Math.abs(minGap) < 0.004) break;
                phy.cargoPos.y -= minGap;
            }
            phy.groundClearance = 0;
            if (typeof stsTwinCableMode === 'function' && stsTwinCableMode()) {
                if (typeof applyStsTwinCableFlareVisual === 'function') applyStsTwinCableFlareVisual();
                if (typeof syncTwinCableLugsFromFlare === 'function') syncTwinCableLugsFromFlare();
            }
            // After set-down, STS must re-seat on the roof — but never clobber an active Nhớm Cáp pose.
            if (!phy._nhomFreezeSpreader && state.beamType === 'container_spreader' && typeof seatStsSpreaderToCargo === 'function') {
                seatStsSpreaderToCargo();
            }
        }

        function paintSling(poolIndex, role, index, pointA, pointB, len, opts) {
            const sling = sling3DPool[poolIndex];
            if (!sling) return;
            const item = role === 'leg' ? (state.gear.legs && state.gear.legs[index])
                : (role === 'extra' ? ((state.gear.extraCables || [])[index] || null)
                : (role === 'hanger' ? (state.gear.hangers && state.gear.hangers[index])
                : (state.gear.uppers && (state.gear.uppers[index] || state.gear.uppers[0]))));
            const swl = role === 'extra' ? ((item && item.swlT) || 12)
                : (role === 'leg' ? legSwl(index)
                : (role === 'hanger' ? ((item && item.swlT) || 25)
                : upperSwl(Math.min(index || 0, 3))));
            const cable = (phy.cables || []).find(cb => cb.role === role && cb.index === index);
            const tension = role === 'leg' ? (phy.legTensions[index] || 0)
                : (role === 'upper' ? (phy.upperTensions[index] || 0)
                : (role === 'hanger' ? ((phy.hangerTensions && phy.hangerTensions[index]) || 0)
                : (role === 'extra' ? ((cable && cable.tensionT) || 0) : 0)));
            const brokenHalf = opts && opts.brokenHalf ? opts.brokenHalf : null;
            const isBrokenStub = !!brokenHalf || !!(item && item.broken);
            const itemSlingType = effectiveSlingType(item);
            sling.drawMeta = {
                role,
                index,
                broken: isBrokenStub,
                brokenHalf: brokenHalf,
                selected: gearIsSelected('sling', role, index),
                ctrlHover: (typeof gearIsCtrlHover === 'function')
                    ? gearIsCtrlHover('sling', role, index)
                    : false,
                diaMm: item && item.diaMm ? item.diaMm : (itemSlingType === 'web' ? 50 : 18),
                grade: item && item.grade ? item.grade : '',
                slingType: itemSlingType,
                parts: (item && item.parts) || 1,
                partIndex: (opts && opts.partIndex != null) ? opts.partIndex : 0
            };
            const chordNow = pointA.distanceTo(pointB);
            const tautOverload = !isBrokenStub && tension > swl + 0.05 && chordNow <= Math.max(0.2, len) * 1.003;
            // Working length is EXACTLY L0 (user-set). Never inflate with chord while slack —
            // that made a 2 m sling draw like a 4 m S-curve over the cargo.
            // A snapped cable is rendered as two independent remnants.  Its
            // physical/rest length is the corresponding remnant (`len`), not
            // the original full cable L0 — using the full length made each half
            // look like it grew after cutting and prevented it from settling.
            const L0 = isBrokenStub
                ? Math.max(0.16, len || chordNow)
                : Math.max(0.2, (cable && cable.L0 > 0.2) ? cable.L0 : (len || chordNow));
            // Tautness from geometry only — never force "straight" while chord << L0
            // (that looked like rubber: already straight, then pin span grows).
            const tautness = isBrokenStub ? 0 : (typeof ropeTautness === 'function'
                ? ropeTautness(chordNow, L0, tension, swl)
                : (chordNow >= L0 - 0.012 ? 1 : 0));
            // Working length stays L0. Over-span is a constraint error, not a longer rope.
            const effectiveLen = L0;
            sling.drawMeta.tautness = tautness;
            sling.drawMeta.L0 = L0;

            // Seat sling eye thimbles cleanly inside the forged shackle bow bearing crowns (or Master Link crown)
            // and lock shackle orientation vectors (shackleDirA / shackleDirB) to the exact joint tangents!
            let visA = pointA.clone();
            let visB = pointB.clone();
            let visLen = effectiveLen;
            const dirs = pathLeaveArrive(pointA, pointB, effectiveLen, role, index);
            let dirA = dirs.leave.clone();
            let dirB = dirs.arrive.clone();

            // Fan multiple hook-hung legs along the master-link bottom bar (side-by-side rings)
            let hookFan = 0;
            if (cable && cable.a && cable.a.kind === 'hook' && (role === 'upper' || role === 'leg')) {
                const hookCables = (phy.cables || []).filter(c =>
                    c.role === role && c.a && c.a.kind === 'hook' && !(typeof cableIsBroken === 'function' && cableIsBroken(c)));
                const nFan = Math.max(1, hookCables.length);
                const fanIdx = Math.max(0, hookCables.findIndex(c => c.index === index));
                hookFan = (fanIdx - (nFan - 1) * 0.5) * 0.034;
                sling.drawMeta.hookFanOffset = hookFan;
            }

            const slingLook = itemSlingType || 'wire';
            const eyeScale = (typeof slingEyeScaleFromMeta === 'function')
                ? slingEyeScaleFromMeta(sling.drawMeta, slingLook)
                : 1.0;
            const stockScale = THREE.MathUtils.clamp(((sling.drawMeta.diaMm || 16) / 16), 0.5, 3.5);
            const endScale = THREE.MathUtils.clamp(stockScale * 0.82, 0.72, 1.12);
            // Match termination mesh scale so path tip lands on ferrule / hammerlock (no gap)
            const ferruleExit = (typeof wireEyeFerruleExit === 'function') ? wireEyeFerruleExit(eyeScale) : (0.195 * eyeScale);
            // Chain path starts at the far eye of the red đốt cuối (after thickness seating)
            const chainEndLenFor = (parentKind) => (typeof chainEndPathInset === 'function')
                ? chainEndPathInset(endScale, parentKind)
                : ((typeof chainTopAssemblyLength === 'function')
                    ? Math.max(0.02, chainTopAssemblyLength(endScale) - 0.032 * endScale)
                    : (0.040 * endScale));
            const termBodyA = slingLook === 'chain'
                ? chainEndLenFor(cable && cable.a ? cable.a.kind : 'hook')
                : 0;
            const termBodyB = slingLook === 'chain'
                ? chainEndLenFor(cable && cable.b ? cable.b.kind : 'cargo')
                : 0;

            // Broken stub = pin→free tip. Never treat the free tip as a second shackle.
            const attachEnd = isBrokenStub
                ? (brokenHalf === 'lower' ? cable && cable.b : cable && cable.a)
                : null;

            if (cable && chordNow > 0.28) {
                const hwType = state.hwType || 'bow_shackle';
                let insetA = 0;
                let insetB = 0;
                if (isBrokenStub) {
                    // Only the attached pin gets termination inset; free tip stays exact
                    const ae = attachEnd;
                    const termAtt = (slingLook === 'wire' || slingLook === 'grommet')
                        ? ferruleExit
                        : (slingLook === 'chain' ? chainEndLenFor(ae ? ae.kind : 'hook') : 0);
                    if (ae && ae.kind === 'hook') insetA = termAtt;
                    else if (ae && ae.kind === 'body') insetA = hardwareCrownOffset(hwType, 1.0) + termAtt;
                    else if (ae && ae.kind === 'cargo') insetA = hardwareCrownOffset(hwType, cargoShackleScale(ae.index || 0)) + termAtt;
                } else {
                    // Inset = bearing offset + termination body so rope/chain meets ferrule / red end-link
                    if (cable.a && cable.a.kind === 'hook') {
                        insetA = termBodyA;
                    } else if (cable.a && cable.a.kind === 'body') {
                        insetA = hardwareCrownOffset(hwType, 1.0) + termBodyA;
                    }
                    if (cable.b && cable.b.kind === 'body') {
                        insetB = hardwareCrownOffset(hwType, 1.0) + termBodyB;
                    } else if (cable.b && cable.b.kind === 'cargo') {
                        insetB = hardwareCrownOffset(hwType, cargoShackleScale(cable.b.index || 0)) + termBodyB;
                    }
                }
                const maxInset = chordNow * 0.28;
                insetA = Math.min(insetA, maxInset);
                insetB = Math.min(insetB, maxInset);

                if (!isBrokenStub && cable.a && cable.a.kind === 'body' && role === 'leg') {
                    if (dirA.y > -0.18) { dirA.y = -0.18; dirA.normalize(); }
                }
                if (!isBrokenStub && cable.b && cable.b.kind === 'body' && role === 'upper') {
                    if (dirB.y < 0.18) { dirB.y = 0.18; dirB.normalize(); }
                }
                // Keep cargo shackle bow on the sling line — only a light pad-eye bias so the
                // pin can clear the lug without yanking the bow 90° off the chain/cable.
                if (!isBrokenStub && cable.b && cable.b.kind === 'cargo') {
                    const lugIdx = cable.b.index || 0;
                    const ringRes = padEyeRingWorld(lugIdx);
                    const nLug = (ringRes && ringRes.n) ? ringRes.n : new THREE.Vector3(0, 1, 0);
                    const along = dirB.dot(nLug);
                    if (along < 0.08) {
                        dirB.addScaledVector(nLug, 0.10 - along).normalize();
                    }
                }

                if (insetA > 0) {
                    visA = pointA.clone().addScaledVector(dirA, insetA);
                    const skipShell = isBrokenStub
                        ? (attachEnd && attachEnd.kind === 'cargo')
                        : (cable.a && cable.a.kind === 'cargo');
                    if (!skipShell) {
                        const cleared = pushOutOfCargoShellWorld(visA, 0.024);
                        const checkA = cleared.clone().sub(pointA);
                        if (checkA.lengthSq() > 1e-6) dirA = checkA.normalize();
                        visA = pointA.clone().addScaledVector(dirA, insetA);
                    }
                }
                if (insetB > 0 && !isBrokenStub) {
                    // Cargo pad-eye crown must stay exact; shell push was nudging the eye off the pin
                    visB = pointB.clone().addScaledVector(dirB, insetB);
                    if (!(cable.b && cable.b.kind === 'cargo')) {
                        const cleared = pushOutOfCargoShellWorld(visB, 0.028);
                        const checkB = cleared.clone().sub(pointB);
                        if (checkB.lengthSq() > 1e-6) dirB = checkB.normalize();
                        visB = pointB.clone().addScaledVector(dirB, insetB);
                    }
                }
                // Free tip of a cut stub must stay outside solids
                if (isBrokenStub && typeof pushPointClear === 'function') {
                    visB = pushPointClear(visB, 0.034, new Set());
                }
                if (insetA > 0 || insetB > 0) {
                    visLen = Math.max(0.16, effectiveLen - insetA - insetB);
                }
            }

            // Visual seat on the master-link bottom bar: fan along link width.
            // Master is so le with the hook (opening in YZ) → width spans local Z.
            const seatA = pointA.clone();
            if (Math.abs(hookFan) > 1e-6 && !isBrokenStub) seatA.z += hookFan;
            sling.pinA = seatA;
            // True hardware pin for end-B (cargo/beam) — never the path tip after insets
            sling.pinB = pointB.clone();
            // Hardware leave through the bow (pin → sling). Keep SEPARATE from draped
            // path tangents so red đốt cuối nests through the shackle even when slack.
            sling.hwLeaveA = dirA.clone().normalize();
            sling.hwLeaveB = dirB.clone().normalize();
            sling.shackleDirA = dirA.clone();
            sling.shackleDirB = dirB.clone();
            // Parent ring plane normals for so-le end-link orientation (master YZ → +X; shackle local +Z)
            const masterN = new THREE.Vector3(1, 0, 0);
            if (typeof hookAssemblyGroup !== 'undefined' && hookAssemblyGroup) {
                const mq = new THREE.Quaternion();
                hookAssemblyGroup.getWorldQuaternion(mq);
                masterN.applyQuaternion(mq);
            }
            const normalForEnd = (kind, idx, leaveDir) => {
                const n = new THREE.Vector3(0, 0, 1);
                if (kind === 'hook') return masterN.clone();
                if (kind === 'cargo' && typeof hwMeshes !== 'undefined' && hwMeshes[idx]) {
                    const q = new THREE.Quaternion();
                    hwMeshes[idx].getWorldQuaternion(q);
                    return n.applyQuaternion(q);
                }
                // Crosby bow shackle: pin = local X, bow in XY → plane normal = local Z after tension pose
                const q = tensionQuaternion(new THREE.Vector3(), (leaveDir && leaveDir.clone()) || new THREE.Vector3(0, -1, 0));
                return n.applyQuaternion(q);
            };
            if (isBrokenStub && attachEnd) {
                // Attached end only — free tip has no parent ring
                sling.parentNormalA = normalForEnd(attachEnd.kind, attachEnd.index || 0, dirA);
                sling.parentNormalB = sling.parentNormalA.clone();
                const hwTypeNow = state.hwType || 'bow_shackle';
                sling.bearingInsetA = attachEnd.kind === 'hook' ? 0
                    : (attachEnd.kind === 'body' ? hardwareCrownOffset(hwTypeNow, 1.0)
                        : (attachEnd.kind === 'cargo'
                            ? hardwareCrownOffset(hwTypeNow, cargoShackleScale(attachEnd.index || 0))
                            : 0));
                sling.bearingInsetB = 0;
            } else {
                sling.parentNormalA = cable && cable.a
                    ? normalForEnd(cable.a.kind, cable.a.index || 0, dirA)
                    : masterN.clone();
                sling.parentNormalB = cable && cable.b
                    ? normalForEnd(cable.b.kind, cable.b.index || 0, dirB)
                    : masterN.clone();
                const hwTypeNow = state.hwType || 'bow_shackle';
                sling.bearingInsetA = (cable && cable.a && cable.a.kind === 'hook') ? 0
                    : ((cable && cable.a && cable.a.kind === 'body') ? hardwareCrownOffset(hwTypeNow, 1.0) : 0);
                sling.bearingInsetB = (cable && cable.b && cable.b.kind === 'body')
                    ? hardwareCrownOffset(hwTypeNow, 1.0)
                    : ((cable && cable.b && cable.b.kind === 'cargo')
                        ? hardwareCrownOffset(hwTypeNow, cargoShackleScale(cable.b.index || 0))
                        : 0);
            }

            // Keep rendered path start on the fanned seat axis
            if (Math.abs(hookFan) > 1e-6 && !isBrokenStub) {
                const shift = seatA.clone().sub(pointA);
                visA.add(shift);
            }

            // Pass 1: solve path so pinA/pinB + hwLeave* are set (needed for so-le nesting)
            update3DSlingGeometry(sling, visA, visB, visLen, itemSlingType, !sling.drawMeta.broken && tautOverload);
            // Align shackles to HARDWARE leave (through the bow), not the draped belly tangent —
            // otherwise red end-links sit beside the ma ní instead of nesting so le through it.
            if (sling.hwLeaveA && sling.hwLeaveA.lengthSq() > 1e-8) sling.shackleDirA.copy(sling.hwLeaveA).normalize();
            if (sling.hwLeaveB && sling.hwLeaveB.lengthSq() > 1e-8) sling.shackleDirB.copy(sling.hwLeaveB).normalize();
            // Pass 2: seat path ends inside shackle crowns using real hwLeave from pass 1
            if (cable && chordNow > 0.28 && !isBrokenStub) {
                const hwType = state.hwType || 'bow_shackle';
                let insetA = 0;
                let insetB = 0;
                if (cable.a && cable.a.kind === 'hook') {
                    insetA = termBodyA;
                } else if (cable.a && cable.a.kind === 'body') {
                    insetA = hardwareCrownOffset(hwType, 1.0) + termBodyA;
                }
                if (cable.b && cable.b.kind === 'body') {
                    insetB = hardwareCrownOffset(hwType, 1.0) + termBodyB;
                } else if (cable.b && cable.b.kind === 'cargo') {
                    insetB = hardwareCrownOffset(hwType, cargoShackleScale(cable.b.index || 0)) + termBodyB;
                }
                const maxInset = chordNow * 0.28;
                insetA = Math.min(insetA, maxInset);
                insetB = Math.min(insetB, maxInset);
                if (insetA > 0 && sling.pinA) {
                    visA = sling.pinA.clone().addScaledVector(sling.hwLeaveA || sling.shackleDirA, insetA);
                }
                if (insetB > 0 && sling.pinB) {
                    visB = sling.pinB.clone().addScaledVector(sling.hwLeaveB || sling.shackleDirB, insetB);
                }
                if ((insetA > 0 || insetB > 0) && sling.pinA && sling.pinB) {
                    visLen = Math.max(0.16, effectiveLen - insetA - insetB);
                    update3DSlingGeometry(sling, visA, visB, visLen, itemSlingType, !sling.drawMeta.broken && tautOverload);
                    if (sling.hwLeaveA && sling.hwLeaveA.lengthSq() > 1e-8) sling.shackleDirA.copy(sling.hwLeaveA).normalize();
                    if (sling.hwLeaveB && sling.hwLeaveB.lengthSq() > 1e-8) sling.shackleDirB.copy(sling.hwLeaveB).normalize();
                }
            }
            sling.visA = visA.clone();
            sling.visB = visB.clone();
        }

        function alignLinkedHardware(rig, master) {
            if (!rig) return;
            spreaderRootGroup.updateMatrixWorld(true);
            jointLinks.forEach(g => {
                const link = g.userData.jointLink;
                if (!link || !g.parent) return;
                let from;
                let dir;
                if (link.role === 'upper') {
                    const item = state.gear.uppers[link.index];
                    const cable = (phy.cables || []).find(c => c.role === 'upper' && c.index === link.index);
                    if (item && item.broken && cable && cable.break) {
                        from = attachWorld(cable.b);
                        dir = cable.break.tipL.clone().sub(from);
                        if (dir.lengthSq() < 1e-8) dir.set(0, -1, 0);
                        else dir.normalize();
                    } else {
                        const sling = sling3DPool.find(s => s.group.visible && s.drawMeta && s.drawMeta.role === 'upper' && s.drawMeta.index === link.index && s.drawMeta.brokenHalf !== 'upper');
                        if (sling && sling.pinB && sling.shackleDirB) {
                            from = sling.pinB.clone();
                            dir = sling.shackleDirB.clone();
                        } else {
                            from = upperAnchorWorld(link.index, rig);
                            const to = master.clone();
                            dir = pathLeaveArrive(from, to, upperRestLength(link.index, rig.spec), 'upper', link.index).leave;
                        }
                    }
                } else if (link.role === 'leg') {
                    const item = state.gear.legs[link.index];
                    const cable = (phy.cables || []).find(c => c.role === 'leg' && c.index === link.index);
                    if (item && item.broken && cable && cable.break) {
                        from = attachWorld(cable.a);
                        dir = cable.break.tipU.clone().sub(from);
                        if (dir.lengthSq() < 1e-8) dir.set(0, -1, 0);
                        else dir.normalize();
                    } else {
                        const sling = sling3DPool.find(s => s.group.visible && s.drawMeta && s.drawMeta.role === 'leg' && s.drawMeta.index === link.index && s.drawMeta.brokenHalf !== 'lower');
                        if (sling && sling.pinA && sling.shackleDirA) {
                            from = sling.pinA.clone();
                            dir = sling.shackleDirA.clone();
                        } else {
                            from = slingAnchorWorld(link.index, rig);
                            const to = lugEyeWorld(link.index);
                            dir = pathLeaveArrive(from, to, legRestLength(link.index, rig.spec), 'leg', link.index).leave;
                        }
                    }
                } else if (link.role === 'hanger' || link.role === 'hangerB') {
                    const cable = (phy.cables || []).find(c => c.role === 'hanger' && c.index === link.index);
                    if (!cable) return;
                    const top = attachWorld(cable.a);
                    const bot = attachWorld(cable.b);
                    from = link.role === 'hangerB' ? bot : top;
                    dir = link.role === 'hangerB' ? top.clone().sub(bot) : bot.clone().sub(top);
                    if (dir.lengthSq() < 1e-8) dir.set(0, -1, 0);
                    else dir.normalize();
                } else if (link.fromLocal && link.upLocal && phy.beams && phy.beams.length) {
                    const host = phy.beams.find(b => b.group === g.parent) || phy.beams[0];
                    from = link.fromLocal.clone().sub(host.origin).applyQuaternion(host.q).add(host.x);
                    const to = link.upLocal.clone().sub(host.origin).applyQuaternion(host.q).add(host.x);
                    dir = to.sub(from);
                    if (dir.lengthSq() < 1e-8) dir.set(0, 1, 0);
                    else dir.normalize();
                } else if (link.fromLocal && link.upLocal) {
                    from = link.fromLocal.clone().applyQuaternion(rig.frameQ).add(rig.spreaderPos);
                    const to = link.upLocal.clone().applyQuaternion(rig.frameQ).add(rig.spreaderPos);
                    dir = to.sub(from);
                    if (dir.lengthSq() < 1e-8) dir.set(0, 1, 0);
                    else dir.normalize();
                } else return;
                const worldQ = tensionQuaternion(from, from.clone().add(dir));
                const parent = g.parent;
                parent.updateMatrixWorld(true);
                const invP = parent.getWorldQuaternion(new THREE.Quaternion()).invert();
                g.position.copy(parent.worldToLocal(from.clone()));
                g.quaternion.copy(invP).multiply(worldQ);
            });
            if (!cargoRootGroup) return;
            const invCargo = phy.cargoQuat.clone().invert();
            for (let i = 0; i < state.lugs.length; i++) {
                if (!state.lugs[i] || !hwMeshes[i] || !padEyeMeshes[i]) continue;
                const ring = padEyeRingWorld(i).ring;
                const item = state.gear.legs[i];
                const sling = sling3DPool.find(s => s.group.visible && s.drawMeta && s.drawMeta.role === 'leg' && s.drawMeta.index === i && s.drawMeta.brokenHalf !== 'upper');
                let dir;
                if (item && item.broken) {
                    const cable = (phy.cables || []).find(c => c.role === 'leg' && c.index === i);
                    if (cable && cable.break) {
                        dir = cable.break.tipL.clone().sub(ring);
                        if (dir.lengthSq() < 1e-8) dir.set(0, -1, 0);
                        else dir.normalize();
                    } else {
                        const inward = phy.cargoPos.clone().sub(ring);
                        inward.y = 0;
                        if (inward.lengthSq() < 1e-6) inward.set(1, 0, 0);
                        dir = inward.normalize().add(new THREE.Vector3(0, -0.35, 0)).normalize();
                    }
                } else if (sling && sling.shackleDirB && sling.drawMeta && sling.drawMeta.brokenHalf !== 'upper') {
                    dir = sling.shackleDirB.clone();
                } else {
                    const anchor = state.beamType === 'none' ? master.clone() : slingAnchorWorld(i, rig);
                    dir = pathLeaveArrive(anchor, lugEyeWorld(i), legRestLength(i, rig.spec), 'leg', i).arrive;
                }
                const worldQ = tensionQuaternion(ring, ring.clone().add(dir));
                const pinW = ring;
                hwMeshes[i].position.copy(cargoRootGroup.worldToLocal(pinW));
                hwMeshes[i].quaternion.copy(invCargo).multiply(worldQ);
                orientPadEyeToPin(padEyeMeshes[i], (state.lugNormals && state.lugNormals[i]) ? state.lugNormals[i] : new THREE.Vector3(0, 1, 0), new THREE.Vector3(1, 0, 0).applyQuaternion(worldQ));
            }
        }

        function upperRestLength(index, spec) {
            const item = state.gear && state.gear.uppers && state.gear.uppers[index];
            const custom = hasExplicitCableLength(item, 'upper') ? item.lengthM : null;
            if (custom != null) return Math.max(0.35, custom);
            if (state.upperSlingLength != null) return Math.max(0.35, state.upperSlingLength);
            return Math.max(0.35, spec ? spec.topLeg : 4.5);
        }

        function refreshFitMarks() {
            if (!phy.fitGroup) {
                phy.fitGroup = new THREE.Group();
                phy.fitGroup.name = 'fitMarks';
                scene.add(phy.fitGroup);
            }
            while (phy.fitGroup.children.length) {
                const ch = phy.fitGroup.children.pop();
                if (ch.geometry) ch.geometry.dispose();
                if (ch.material) ch.material.dispose();
            }

            const banner = document.getElementById('fit-banner');
            if (!banner) return;

            // International Cable Sling Angle Safety Rules (ASME B30.9 / OSHA 1910.184 / ISO 12480):
            // - Angle Beta >= 60°: Optimal / Recommended
            // - 45° <= Beta < 60°: Acceptable with standard safety factors
            // - 30° <= Beta < 45°: Warning - High tension factor (LAF > 1.41)
            // - Beta < 30°: PROHIBITED BY ASME B30.9 & OSHA - Tension factor > 2.0x, risk of structural failure
            const cables = phy.cables || [];
            let worstCable = null;
            let minBeta = 90;
            const now = performance.now();

            const stsDirectFit = (typeof isStsDirectAttach === 'function') && isStsDirectAttach();
            const stsMode = state.beamType === 'container_spreader';
            cables.forEach(c => {
                if (cableIsBroken(c)) return;
                // STS direct = twistlocks only (no sling angle rules). STS uppers are
                // hidden headblock falls — never warn “cáp trên” in direct mode.
                if (stsDirectFit) return;
                if (stsMode && c.role === 'upper') return;
                const A = attachWorld(c.a);
                const B = attachWorld(c.b);
                const dist = A.distanceTo(B);
                if (dist < 0.1) return;
                // Only judge working (load-bearing) lines. Prelift / Nhớm / seated
                // legs with tiny vertical drop must NOT raise a false <30° ban —
                // that was flashing "cáp nhánh 8.8°" while chains were still slack.
                const tension = c.tensionT || 0;
                const geometricallyTaut = dist >= (c.L0 || 1) - 0.06;
                const loadBearing = tension > 0.35
                    || ((phy.groundClearance || 0) > 0.10 && geometricallyTaut && tension > 0.08);
                if (!loadBearing) {
                    c._angleDanger = false;
                    return;
                }
                const dy = Math.abs(B.y - A.y);
                const beta = Math.asin(THREE.MathUtils.clamp(dy / dist, 0, 1)) * (180 / Math.PI);

                if (beta < 45.0) {
                    if (beta < minBeta) {
                        minBeta = beta;
                        worstCable = c;
                    }
                    // Trigger 3-flash red pulse on this cable if entering warning zone
                    if (!c._hasFlashedForAngle) {
                        c._isFlashing = true;
                        c._flashStartTime = now;
                        c._hasFlashedForAngle = true;
                    }
                    c._angleDanger = (beta < 30.0);
                } else {
                    c._hasFlashedForAngle = false;
                    c._angleDanger = false;
                }
            });

            if (worstCable && minBeta < 45.0) {
                const roleNamesVi = { upper: 'cáp trên', leg: 'cáp nhánh', hanger: 'cáp treo', extra: 'cáp phụ' };
                const roleNamesEn = { upper: 'upper sling', leg: 'sling leg', hanger: 'hanger', extra: 'extra sling' };
                const cNameVi = `${roleNamesVi[worstCable.role] || 'nhánh cáp'} ${worstCable.index + 1}`;
                const cNameEn = `${roleNamesEn[worstCable.role] || 'sling leg'} ${worstCable.index + 1}`;

                banner.style.display = 'block';

                if (minBeta < 30.0) {
                    phy.isOperationBlocked = true;
                    banner.style.background = 'linear-gradient(180deg, rgba(153, 27, 27, 0.98) 0%, rgba(127, 29, 29, 0.98) 100%)';
                    banner.style.borderColor = '#ef4444';
                    banner.style.boxShadow = '0 8px 25px rgba(220, 38, 38, 0.55), 0 0 15px rgba(239, 68, 68, 0.45)';
                    banner.textContent = state.lang === 'en'
                        ? `⛔ PROHIBITED (ASME B30.9 / OSHA): Sling angle of ${cNameEn} is ${minBeta.toFixed(1)}° (< 30°)! Tension factor exceeds 200% — Operation prohibited.`
                        : `⛔ NGUY HIỂM (ASME B30.9 / OSHA): Góc kéo của ${cNameVi} = ${minBeta.toFixed(1)}° (< 30°)! Lực căng tăng vọt > 200% — Nghiêm cấm nâng cẩu.`;
                } else {
                    phy.isOperationBlocked = false;
                    banner.style.background = 'linear-gradient(180deg, rgba(146, 64, 14, 0.96) 0%, rgba(120, 53, 15, 0.98) 100%)';
                    banner.style.borderColor = '#f59e0b';
                    banner.style.boxShadow = '0 8px 25px rgba(245, 158, 11, 0.45), 0 0 15px rgba(245, 158, 11, 0.35)';
                    banner.textContent = state.lang === 'en'
                        ? `⚠️ SAFETY WARNING: Sling angle of ${cNameEn} is ${minBeta.toFixed(1)}° (< 45°) — High tension factor, ASME B30.9 recommends ≥ 60°.`
                        : `⚠️ CẢNH BÁO GÓC KÉO: Góc kéo của ${cNameVi} = ${minBeta.toFixed(1)}° (< 45°) — Hệ số tải căng cao, ASME B30.9 khuyến nghị ≥ 60°.`;
                }
            } else {
                phy.isOperationBlocked = false;
                banner.style.display = 'none';
                banner.textContent = '';
            }
        }
