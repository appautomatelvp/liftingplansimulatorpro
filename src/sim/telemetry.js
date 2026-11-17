/**
 * telemetry — part of the lifting simulator.
 * These files are assembled into one module so they share state, physics and the scene.
 */
        // --- 9. UPDATE 3D SCENE, CRANES, CABLES & TELEMETRY ---
        function updateSceneAndTelemetry() {
            const { H, beamType, slingType, slingLength, wllPerLeg } = state;
            const { spanX, spanZ } = getLPBoundingSpan();

            // STS: yellow spreader IS the trolley head — hide entire forged hook block
            // (no J-hook / master-link / hanging bridle above the beam).
            const stsMode = state.beamType === 'container_spreader';
            const dualHooks = (state.hookCount || 1) >= 2 && !stsMode;
            if (hookAssemblyGroup) {
                hookAssemblyGroup.visible = !stsMode;
                const swivel = hookAssemblyGroup.getObjectByName('Swivel_Hook');
                const master = hookAssemblyGroup.getObjectByName('Master_Link');
                if (swivel) swivel.visible = !stsMode;
                if (master) master.visible = !stsMode;
            }
            // Ensure tandem second hook exists when needed
            if (dualHooks && typeof scene !== 'undefined' && !window._hookAssemblyB) {
                if (typeof createForgedCraneHookGroup === 'function' && hookAssemblyGroup) {
                    const clone = hookAssemblyGroup.clone(true);
                    clone.name = 'Crane_Hook_Block_B';
                    clone.traverse(o => { if (o.isMesh) { o.castShadow = true; } });
                    scene.add(clone);
                    window._hookAssemblyB = clone;
                }
            }
            if (window._hookAssemblyB) {
                window._hookAssemblyB.visible = dualHooks;
            }

            const hookOffA = dualHooks && typeof dualHookOffsetX === 'function' ? dualHookOffsetX(1) : 0;
            const hookOffB = dualHooks && typeof dualHookOffsetX === 'function' ? dualHookOffsetX(-1) : 0;
            hookAssemblyGroup.position.set(phy.hookPos.x + hookOffA, phy.hookPos.y, phy.hookPos.z);
            if (window._hookAssemblyB && dualHooks) {
                window._hookAssemblyB.position.set(phy.hookPos.x + hookOffB, phy.hookPos.y, phy.hookPos.z);
                window._hookAssemblyB.rotation.y = hookAssemblyGroup.rotation.y;
            }
            // Hook yaw: swivel follows upper-gear plane; locked hook stays on crane heading
            {
                let wantYaw = 0;
                if (state.hookSwivelEnabled !== false) {
                    const top = phy.beams && phy.beams[0];
                    if (top && top.q) {
                        const e = new THREE.Euler().setFromQuaternion(top.q, 'YXZ');
                        wantYaw = e.y;
                    } else if (typeof nominalSpreaderYawDeg === 'function') {
                        wantYaw = THREE.MathUtils.degToRad(nominalSpreaderYawDeg());
                    }
                } else {
                    // Fixed hook: face boom / trolley (hook target from crane origin)
                    wantYaw = Math.atan2(phy.hookPos.x, phy.hookPos.z);
                }
                const cur = hookAssemblyGroup.rotation.y;
                let d = wantYaw - cur;
                while (d > Math.PI) d -= Math.PI * 2;
                while (d < -Math.PI) d += Math.PI * 2;
                const k = state.hookSwivelEnabled !== false ? 0.18 : 0.08;
                hookAssemblyGroup.rotation.y = cur + d * k;
                if (window._hookAssemblyB && dualHooks) window._hookAssemblyB.rotation.y = hookAssemblyGroup.rotation.y;
            }
            cargoRootGroup.position.copy(phy.cargoPos);
            cargoRootGroup.quaternion.copy(phy.cargoQuat);
            applyCornerYieldVisual();
            // Twin+cable pry: each 20ft pivots about its outer cable picks after root pose
            if (typeof applyStsTwinCableFlareVisual === 'function') applyStsTwinCableFlareVisual();
            const depthScale = THREE.MathUtils.clamp((state.gear.beam.depthM || 0.28) / 0.28, 0.4, 2.2);
            spreaderRootGroup.scale.set(1, beamType === 'none' ? 1 : depthScale, 1);

            // Update Crane Boom / Trolley to follow Hook in real time
            updateCraneKinematics();

            const rigNow = computeRigPose();
            const masterLinkWorld = rigNow.master.clone();
            const frameQ = rigNow.frameQ;
            const specNow = rigNow.spec;
            if (!state.holdCableLength && !state.slingUserSet && !(state.gear && state.gear.uppers.some(u => u.lengthM != null))) {
                const shown = beamType === 'basket'
                    ? Math.hypot(
                        Math.sqrt(Math.max(0.09, specNow.topLeg * specNow.topLeg - Math.pow(spanZ * 0.5, 2))) + 0.28 + specNow.lower,
                        spanZ * 0.5
                    )
                    : specNow.topLeg;
                const el = document.getElementById('inp-slingL');
                const vEl = document.getElementById('v-slingL');
                if (el && vEl && Math.abs((parseFloat(el.value) || 0) - shown) > 0.04) {
                    if (parseFloat(el.max) < shown + 1) el.max = (shown + 4).toFixed(1);
                    el.value = shown.toFixed(2);
                    vEl.textContent = shown.toFixed(1);
                    state.slingLength = Math.round(shown * 10) / 10;
                }
            }

            const hwWorldPos = state.lugs.map((_, i) => lugEyeWorld(i));

            sling3DPool.forEach(s => {
                s.group.visible = false;
                if (s.pickers) s.pickers.forEach(p => { p.visible = false; });
            });

            let maxAngleVertDeg = 0;
            const noteSlingAngle = (from, to) => {
                const vec = new THREE.Vector3().subVectors(from, to);
                const ang = Math.atan2(Math.hypot(vec.x, vec.z), Math.max(0.1, vec.y)) * (180 / Math.PI);
                if (ang > maxAngleVertDeg) maxAngleVertDeg = ang;
            };

            applyBeamVisuals();
            if (phy.cables && phy.cables.length) {
                let poolIdx = 0;
                phy.cables.forEach((c) => {
                    // Direct STS: twistlocks are solid pins — no flexible lower slings.
                    // Cable STS: draw normal legs (wire/chain + shackles) to cargo lugs.
                    const stsDirect = stsMode && (typeof isStsDirectAttach === 'function'
                        ? isStsDirectAttach()
                        : (state.stsAttachMode || 'direct') !== 'cable');
                    // STS headblock / H-Beam direct modes hide virtual link segments
                    const lbDirectTop = state.beamType === 'lifting_beam' && state.liftingBeamTopMode === 'direct_hook';
                    const lbDirectBot = state.beamType === 'lifting_beam' && state.liftingBeamBottomMode === 'direct';
                    if ((stsMode || lbDirectTop) && c.role === 'upper') return;
                    if ((stsDirect || lbDirectBot) && c.role === 'leg') return;
                    const A = attachWorld(c.a);
                    const B = attachWorld(c.b);
                    const role = c.role === 'leg' ? 'leg' : (c.role === 'upper' ? 'upper' : (c.role === 'extra' ? 'extra' : 'hanger'));
                    const rec = gearCableRecord(c);
                    const parts = Math.max(1, Math.min(4, (rec && rec.parts) || 1));
                    const isBroken = cableIsBroken(c);
                    const br = isBroken ? ensureCableBreakState(c) : null;

                    if (parts === 1) {
                        if (isBroken && br && br.tipU && br.tipL) {
                            if (poolIdx < sling3DPool.length) paintSling(poolIdx++, role, c.index, A, br.tipU, br.upperLen, { brokenHalf: 'upper', partIndex: 0, totalParts: 1 });
                            if (poolIdx < sling3DPool.length) paintSling(poolIdx++, role, c.index, B, br.tipL, br.lowerLen, { brokenHalf: 'lower', partIndex: 0, totalParts: 1 });
                        } else if (poolIdx < sling3DPool.length) {
                            paintSling(poolIdx++, role, c.index, A, B, c.L0 || 1, { partIndex: 0, totalParts: 1 });
                        }
                    } else {
                        const diaM = Math.max(0.012, ((rec && rec.diaMm) || 20) / 1000);
                        const spacing = Math.max(0.045, diaM * 1.6);
                        const dir = B.clone().sub(A);
                        let u = new THREE.Vector3(0, 0, 1);
                        if (dir.lengthSq() > 1e-6) {
                            dir.normalize();
                            if (Math.abs(dir.y) < 0.94) u.crossVectors(dir, new THREE.Vector3(0, 1, 0)).normalize();
                            else u.crossVectors(dir, new THREE.Vector3(1, 0, 0)).normalize();
                        }
                        for (let k = 0; k < parts; k++) {
                            const offsetDist = (k - (parts - 1) * 0.5) * spacing;
                            const off = u.clone().multiplyScalar(offsetDist);
                            const Ak = A.clone().add(off);
                            const Bk = B.clone().add(off);
                            if (isBroken && br && br.tipU && br.tipL) {
                                if (poolIdx < sling3DPool.length) paintSling(poolIdx++, role, c.index, Ak, br.tipU.clone().add(off), br.upperLen, { brokenHalf: 'upper', partIndex: k, totalParts: parts });
                                if (poolIdx < sling3DPool.length) paintSling(poolIdx++, role, c.index, Bk, br.tipL.clone().add(off), br.lowerLen, { brokenHalf: 'lower', partIndex: k, totalParts: parts });
                            } else if (poolIdx < sling3DPool.length) {
                                paintSling(poolIdx++, role, c.index, Ak, Bk, c.L0 || 1, { partIndex: k, totalParts: parts });
                            }
                        }
                    }
                    if (c.role !== 'hanger' && !isBroken) noteSlingAngle(A.y > B.y ? A : B, A.y > B.y ? B : A);
                });
            } else if (beamType === 'none') {
                hwWorldPos.forEach((wPos, i) => {
                    paintSling(i, 'leg', i, masterLinkWorld, wPos, legRestLength(i, specNow));
                    noteSlingAngle(masterLinkWorld, wPos);
                });
            } else if (!(phy.beams && phy.beams.length)) {
                const spreaderPos = rigNow.spreaderPos;
                spreaderRootGroup.position.copy(spreaderPos);
                spreaderRootGroup.quaternion.copy(frameQ);

                if (beamType === 'spreader' || beamType === 'lifting_beam' || beamType === 'cascaded' || beamType === 'modular_truss') {
                    const leftTop = upperAnchorWorld(0, rigNow);
                    const rightTop = upperAnchorWorld(1, rigNow);
                    paintSling(4, 'upper', 0, masterLinkWorld, leftTop, upperRestLength(0, specNow));
                    paintSling(5, 'upper', 1, masterLinkWorld, rightTop, upperRestLength(1, specNow));
                    hwWorldPos.forEach((wPos, i) => {
                        paintSling(i, 'leg', i, slingAnchorWorld(i, rigNow), wPos, legRestLength(i, specNow));
                    });
                    noteSlingAngle(masterLinkWorld, leftTop);
                } else {
                    hwWorldPos.forEach((wPos, i) => {
                        const frameCorner = slingAnchorWorld(i, rigNow);
                        paintSling(4 + i, 'upper', i, masterLinkWorld, frameCorner, upperRestLength(i, specNow));
                        paintSling(i, 'leg', i, frameCorner, wPos, legRestLength(i, specNow));
                        noteSlingAngle(masterLinkWorld, frameCorner);
                    });
                }
            }
            // Align shackles every frame normally; every other frame when FPS is low
            const perfLevel = (state.renderPerf && state.renderPerf.level != null) ? state.renderPerf.level : 2;
            if (!updateSceneAndTelemetry._alignTick) updateSceneAndTelemetry._alignTick = 0;
            updateSceneAndTelemetry._alignTick++;
            if (perfLevel >= 1 || (updateSceneAndTelemetry._alignTick % 2 === 0)) {
                alignLinkedHardware(rigNow, masterLinkWorld);
            }
            // DOM / fit-marks: ~12 Hz; selection rings still track camera when needed
            const nowUi = (typeof performance !== 'undefined') ? performance.now() : Date.now();
            const lastUi = updateSceneAndTelemetry._lastUiMs || 0;
            const uiInterval = perfLevel < 1 ? 120 : 80;
            const doUi = (nowUi - lastUi) >= uiInterval;
            if (doUi) {
                updateSceneAndTelemetry._lastUiMs = nowUi;
                refreshFitMarks();
                updateGearSelectionRings();
                refreshGearLive();
            } else if (state.gear && state.gear.selection && state.gear.selection.length) {
                updateGearSelectionRings();
            }

            const tautHoriz = phy.legAngleDeg.filter((_, i) => state.gear.legs[i] && !phy.legSlacks[i] && !state.gear.legs[i].broken);
            phy.maxAngleVert = tautHoriz.length ? (90 - Math.min(...tautHoriz)) : maxAngleVertDeg;

            // Update 3D Floor Compass Rose & Pulling Direction Vector Arrow
            if (pullCompassGroup) {
                pullCompassGroup.position.x = phy.cargoPos.x;
                pullCompassGroup.position.z = phy.cargoPos.z;
                const pullVecHoriz = new THREE.Vector3(phy.hookPos.x - phy.cargoPos.x, 0, phy.hookPos.z - phy.cargoPos.z);
                const pullDist = pullVecHoriz.length();
                if (pullDist > 0.08) {
                    pullDirectionArrow.visible = true;
                    pullDirectionArrow.setDirection(pullVecHoriz.clone().normalize());
                    pullDirectionArrow.setLength(Math.min(4.6, 1.0 + pullDist * 0.9), 0.55, 0.32);
                } else {
                    pullDirectionArrow.visible = false;
                }
            }

            // Update 3D Ground Cargo Heading & Azimuth Protractor Indicator
            if (typeof updateCargoGroundAngleIndicator3D === 'function') {
                updateCargoGroundAngleIndicator3D();
            }

            // Dunnage stays fixed at its quay staging datum so shifted cargo interacts / tilts off it naturally

            hwWorldPos.forEach((wPos, i) => {
                const arrow = forceArrows[i];
                if (!arrow) return;
                const tVal = phy.legTensions[i] || 0;
                const showVec = Boolean(state.displayOptions?.showVectors ?? state.showVectors);
                if (showVec) {
                    arrow.visible = true;
                    arrow.position.copy(wPos);
                    const dir = new THREE.Vector3().subVectors(slingAnchorWorld(i, rigNow), wPos);
                    if (dir.lengthSq() < 1e-8) dir.set(0, 1, 0);
                    arrow.setDirection(dir.normalize());
                    const swl = Math.max(0.05, legSwl(i));
                    const len = THREE.MathUtils.clamp(0.75 + (tVal / swl) * 2.2, 0.75, 3.5);
                    const col = (tVal > swl) ? 0xef4444 : (tVal > swl * 0.8 ? 0xfacc15 : 0x10b981);
                    arrow.setColor(new THREE.Color(col));
                    arrow.setLength(len, 0.35, 0.2);
                } else {
                    arrow.visible = false;
                }
            });

            const upVec = new THREE.Vector3(0, 1, 0).applyQuaternion(phy.cargoQuat);
            phy.tiltDeg = Math.acos(THREE.MathUtils.clamp(upVec.y, -1, 1)) * (180 / Math.PI);

            const nowTel = (typeof performance !== 'undefined') ? performance.now() : Date.now();
            const lastTel = updateSceneAndTelemetry._lastTelMs || 0;
            if ((nowTel - lastTel) >= 80) {
                updateSceneAndTelemetry._lastTelMs = nowTel;
                updateUITelemetry(hwWorldPos, masterLinkWorld, rigNow);
            }
        }

        function updateUITelemetry(hwWorldPos, masterLinkWorld, rigNow) {
            const { weight } = state;
            let maxT = 0;
            let wllPerLeg = state.wllPerLeg;
            let worstUtil = 0;
            for (let i = 0; i < state.lugs.length; i++) {
                if (!state.gear.legs[i]) continue;
                const swl = Math.max(0.05, legSwl(i));
                const util = phy.legTensions[i] / swl;
                if (util > worstUtil) {
                    worstUtil = util;
                    maxT = phy.legTensions[i];
                    wllPerLeg = swl;
                }
            }
            const anyBroken = state.gear.legs.some(l => l.broken) || state.gear.uppers.some(u => u.broken) || (state.gear.hangers || []).some(h => h.broken);
            const allSlack = phy.legSlacks.every(s => s);
            const hookOver = (weight + phy.gearWeight) > (state.gear.hook.swlT || 9999);
            const beamOver = state.beamType !== 'none' && phy.legTensions.reduce((a, b) => a + b, 0) > (state.gear.beam.swlT || 9999);

            const vertAng = phy.maxAngleVert;
            const horizAng = Math.max(0, 90 - vertAng);
            const elVert = document.getElementById('out-angle-vert');
            elVert.textContent = vertAng.toFixed(1) + '°';
            document.getElementById('out-angle-horiz').textContent = L(`Horiz β: ${horizAng.toFixed(1)}°`, `Ngang β: ${horizAng.toFixed(1)}°`);
            elVert.className = 'font-mono font-bold text-xs ' + (vertAng > 60 ? 'text-red-400' : (vertAng > 45 ? 'text-amber-400' : 'text-emerald-400'));

            const elTilt = document.getElementById('out-tilt');
            elTilt.textContent = phy.tiltDeg.toFixed(1) + '°';
            elTilt.className = 'font-mono font-bold text-xs ' + (phy.tiltDeg > 5 ? 'text-red-400' : (phy.tiltDeg > 2 ? 'text-amber-400' : 'text-white'));
            document.getElementById('out-clearance').textContent = L(`Clearance ${phy.groundClearance.toFixed(2)} m`, `Cách sàn: ${phy.groundClearance.toFixed(2)} m`);

            const mb = computeRiggingMassBreakdown();
            const totalHookLoad = (phy.groundClearance > 0.02)
                ? mb.grossHookLoadT
                : (allSlack ? mb.belowHookRiggingT : (phy.legTensions.reduce((a, b) => a + b, 0) * Math.cos(vertAng * Math.PI / 180) + mb.belowHookRiggingT));
            document.getElementById('out-total-load').textContent = totalHookLoad.toFixed(2) + ' T';

            // Update Top Bar Live Rigging Mass Capsule & Right Panel Deductions Table
            const setTxt = (id, txt) => { const el = document.getElementById(id); if (el) el.textContent = txt; };
            setTxt('top-net-load', `${mb.cargoNetT.toFixed(2)} T`);
            setTxt('top-rig-load', `${mb.belowHookRiggingT.toFixed(2)} T`);
            setTxt('top-gross-load', `${mb.grossCraneLoadT.toFixed(2)} T`);
            setTxt('ded-cargo', `${(mb.cargoNetT * 1000).toFixed(0)} kg (${mb.cargoNetT.toFixed(2)} T)`);
            setTxt('ded-beam', `${(mb.beamMassT * 1000).toFixed(0)} kg`);
            setTxt('ded-slings', `${((mb.slingsMassT + mb.shacklesMassT + mb.turnbucklesMassT) * 1000).toFixed(0)} kg`);
            setTxt('ded-hook', `${(mb.hookBlockT * 1000).toFixed(0)} kg`);
            setTxt('ded-total', `${mb.grossCraneLoadT.toFixed(2)} T`);
            setTxt('ded-comp', state.beamType === 'none' ? '0.00 T' : `${(phy.beamCompression || 0).toFixed(2)} T`);

            const sd = phy.structuralDeformation;
            if (sd) {
                setTxt('out-structural-deflection', `${sd.cargoDeflectionMm.toFixed(1)} mm`);
                setTxt('out-beam-deflection', `${sd.beamDeflectionMm.toFixed(1)} mm`);
                setTxt('out-structural-twist', `${sd.cargoTwistDeg.toFixed(2)}°`);
                setTxt('hud-deflection', `${(sd.cargoDeflectionMm > 0.05 ? sd.cargoDeflectionMm : sd.beamDeflectionMm).toFixed(1)} mm`);
            }

            const hudLoad = document.getElementById('hud-load');
            if (hudLoad) {
                const hookSwl = Math.max(0.1, state.gear.hook.swlT || 65);
                const hookUtil = totalHookLoad / hookSwl * 100;
                const tautAngles = phy.legAngleDeg.filter((deg, i) => !state.gear.legs[i].broken && !phy.legSlacks[i]);
                const beta = tautAngles.length ? Math.min(...tautAngles) : 90;
                const tf = 1 / Math.max(0.5, Math.sin(beta * Math.PI / 180));
                let mblMin = Infinity;
                for (let i = 0; i < state.lugs.length; i++) {
                    if (!state.gear.legs[i]) continue;
                    const mbl = legSwl(i) * Math.max(1.5, state.gear.legs[i].sf || 5);
                    if (mbl < mblMin) mblMin = mbl;
                }
                const span = getLPBoundingSpan();
                hudLoad.textContent = totalHookLoad.toFixed(2) + ' t';
                const hookUtilEl = document.getElementById('hud-hook-util');
                if (hookUtilEl) {
                    hookUtilEl.textContent = hookUtil.toFixed(0) + '%';
                    hookUtilEl.className = 'font-mono font-bold text-sm leading-none ' + (hookUtil > 100 ? 'text-red-400' : (hookUtil > 80 ? 'text-amber-300' : 'text-amber-200'));
                }
                const grossEl = document.getElementById('hud-gross');
                if (grossEl) grossEl.textContent = mb.grossCraneLoadT.toFixed(2) + ' t';
                const rigEl = document.getElementById('hud-rig');
                if (rigEl) rigEl.textContent = mb.belowHookRiggingT.toFixed(2) + ' t';
                const betaEl = document.getElementById('hud-beta');
                if (betaEl) {
                    betaEl.textContent = beta.toFixed(0) + '°';
                    betaEl.className = 'font-mono font-bold text-sm leading-none ' + (beta < 30 ? 'text-red-400' : (beta < 45 ? 'text-amber-300' : 'text-sky-200'));
                }
                const tfEl = document.getElementById('hud-tf');
                if (tfEl) tfEl.textContent = tf.toFixed(2);
                const legPct = Math.round((maxT / Math.max(0.1, wllPerLeg)) * 100);
                const legEl = document.getElementById('hud-leg-util');
                if (legEl) {
                    legEl.textContent = legPct + '%';
                    legEl.className = 'font-mono font-bold text-sm leading-none ' + (legPct > 100 ? 'text-red-400' : (legPct > 80 ? 'text-amber-300' : 'text-emerald-300'));
                }
                const mblEl = document.getElementById('hud-mbl');
                if (mblEl) mblEl.textContent = (isFinite(mblMin) ? mblMin.toFixed(1) : '—') + ' t';
                const radEl = document.getElementById('hud-radius');
                if (radEl) radEl.textContent = Math.hypot(phy.hookPos.x, phy.hookPos.z).toFixed(1) + ' m';
                const cogEl = document.getElementById('hud-cog');
                if (cogEl) cogEl.textContent = `${state.cogX.toFixed(2)} / ${state.cogZ.toFixed(2)} m`;
                const spanEl = document.getElementById('hud-span');
                if (spanEl) spanEl.textContent = state.lang === 'en'
                    ? `${span.spanX.toFixed(2)} × ${span.spanZ.toFixed(2)} m · compression ${(phy.beamCompression || 0).toFixed(1)} t`
                    : `${span.spanX.toFixed(2)} × ${span.spanZ.toFixed(2)} m · nén ${(phy.beamCompression || 0).toFixed(1)} t`;
                document.getElementById('hud-tilt').textContent = phy.tiltDeg.toFixed(1) + '°';
                document.getElementById('hud-clear').textContent = phy.groundClearance.toFixed(2) + ' m';
                const dmg = document.getElementById('hud-damage');
                if (dmg) dmg.textContent = (phy.damagePct || 0).toFixed(0) + '%';
                // Live hoist-rope dynamics (elastic hoist, dynamics.js) and measured aerodynamics
                const dafEl = document.getElementById('hud-daf');
                if (dafEl) {
                    const h = phy.hoist;
                    if (h && typeof hoistElasticEnabled === 'function' && hoistElasticEnabled()) {
                        const daf = h.daf || 0;
                        dafEl.textContent = state.lang === 'en'
                            ? `${daf.toFixed(2)} (peak ${(h.dafPeak || 1).toFixed(2)}) · ${(h.tensionN / 9806.65).toFixed(1)} t · stretch ${(h.stretchMm || 0).toFixed(0)} mm`
                            : `${daf.toFixed(2)} (đỉnh ${(h.dafPeak || 1).toFixed(2)}) · ${(h.tensionN / 9806.65).toFixed(1)} t · giãn ${(h.stretchMm || 0).toFixed(0)} mm`;
                        dafEl.className = 'hud-val font-mono font-bold ' + (daf > 1.35 ? 'text-red-400' : (daf > 1.15 ? 'text-amber-300' : 'text-amber-200'));
                    } else {
                        dafEl.textContent = state.lang === 'en' ? 'rigid hook (select a crane)' : 'móc cứng (chọn cẩu)';
                        dafEl.className = 'hud-val font-mono font-bold text-slate-500';
                    }
                }
                const windEl = document.getElementById('hud-wind');
                if (windEl && phy.wind) {
                    const w = phy.wind;
                    const live = w.vector ? w.vector.length() : 0;
                    const rainMm = w.rainMmH != null ? w.rainMmH : ((state.weather && state.weather.rainMmH) || 0);
                    const rainN = w.rainForceN || 0;
                    windEl.textContent = state.lang === 'en'
                        ? `${live.toFixed(1)} m/s · rain ${rainMm.toFixed(0)} mm/h · ${(w.forceN / 1000).toFixed(2)} kN · drift ${(w.driftDeg || 0).toFixed(1)}°`
                        : `${live.toFixed(1)} m/s · mưa ${rainMm.toFixed(0)} mm/h · ${(w.forceN / 1000).toFixed(2)} kN · dạt ${(w.driftDeg || 0).toFixed(1)}°`;
                    windEl.className = 'hud-val font-mono font-bold ' + ((w.driftDeg || 0) > 3 || rainMm >= 40 ? 'text-amber-300' : 'text-sky-300');
                    // Site panel: once airborne, show the measured values next to the design estimate
                    if (phy.groundClearance > 0.05 && phy.windDesign) {
                        const fEl = document.getElementById('val-wind-force');
                        if (fEl) fEl.textContent = state.lang === 'en'
                            ? `${(w.forceN / 1000).toFixed(2)} kN measured (design ${phy.windDesign.forceKN.toFixed(2)} kN)`
                            : `${(w.forceN / 1000).toFixed(2)} kN thực (tk ${phy.windDesign.forceKN.toFixed(2)} kN)`;
                        const dEl = document.getElementById('val-wind-drift');
                        if (dEl) dEl.textContent = state.lang === 'en'
                            ? `${(w.driftDeg || 0).toFixed(2)}° measured (design ${phy.windDesign.driftDeg.toFixed(2)}°)`
                            : `${(w.driftDeg || 0).toFixed(2)}° đo (tk ${phy.windDesign.driftDeg.toFixed(2)}°)`;
                    }
                    const rEl = document.getElementById('val-rain-force');
                    if (rEl) rEl.textContent = `${(rainN / 1000).toFixed(2)} kN`;
                    const rainValLive = document.getElementById('val-rain-mmh');
                    if (rainValLive && state.wind && state.wind.vary) {
                        let rainLabel = state.lang === 'en' ? 'Dry' : 'Khô';
                        if (rainMm >= 80) rainLabel = state.lang === 'en' ? 'Very heavy' : 'Rất lớn';
                        else if (rainMm >= 40) rainLabel = state.lang === 'en' ? 'Heavy' : 'Mưa lớn';
                        else if (rainMm >= 15) rainLabel = state.lang === 'en' ? 'Moderate' : 'Mưa vừa';
                        else if (rainMm >= 2) rainLabel = state.lang === 'en' ? 'Light' : 'Mưa nhỏ';
                        rainValLive.textContent = `${rainMm.toFixed(0)} mm/h · ${rainLabel}`;
                    }
                }
                let risk = Math.min(40, (maxT / Math.max(0.1, wllPerLeg)) * 40);
                risk += Math.min(30, Math.max(0, vertAng - 25) * 0.8);
                if (phy.groundClearance > 0.05) risk += Math.min(25, phy.tiltDeg * 1.4);
                if (state.groundId === 'rough') risk += 8;
                risk = Math.max(0, Math.min(100, risk));
                const riskEl = document.getElementById('hud-risk');
                const riskBar = document.getElementById('hud-riskbar');
                riskBar.style.width = risk.toFixed(0) + '%';
                if (risk > 66) {
                    riskEl.textContent = L('DANGER', 'NGUY HIỂM');
                    riskEl.className = 'font-mono font-bold text-red-400';
                } else if (risk > 34) {
                    riskEl.textContent = L('WATCH', 'THEO DÕI');
                    riskEl.className = 'font-mono font-bold text-amber-300';
                } else {
                    riskEl.textContent = L('SAFE', 'AN TOÀN');
                    riskEl.className = 'font-mono font-bold text-emerald-300';
                }
            }
            const utilPct = Math.round((maxT / wllPerLeg) * 100);
            document.getElementById('out-util').textContent = L(`Max WLL: ${utilPct}%`, `Tải SWL: ${utilPct}%`);

            const elSlack = document.getElementById('out-slack-state');
            if (allSlack) {
                elSlack.textContent = L('SLACK — NOT HOISTING', 'CHƯA KÉO (CÁP CHÙNG)');
                elSlack.className = 'font-mono text-amber-400';
            } else if (phy.groundClearance > 0.03) {
                elSlack.textContent = L('AIRBORNE', 'ĐANG TREO TẢI');
                elSlack.className = 'font-mono text-sky-400';
            } else {
                elSlack.textContent = L('TAUT', 'CÁP CĂNG');
                elSlack.className = 'font-mono text-emerald-400';
            }

            const badge = document.getElementById('badge-safety');
            const led = document.getElementById('status-led');
            const advice = document.getElementById('eng-advice');

            if (anyBroken) {
                badge.textContent = L('ROPE PARTED', 'CÁP ĐÃ ĐỨT');
                badge.className = 'text-[9px] font-mono font-bold px-2 py-0.5 rounded bg-red-500/20 text-red-400 border border-red-500/50 animate-pulse';
                led.className = 'w-2.5 h-2.5 rounded-full bg-red-500 shadow-[0_0_10px_#ef4444]';
                const brokenUpper = (state.gear.uppers || []).filter(u => u && u.broken).length;
                const intactUpper = (state.gear.uppers || []).filter(u => u && !u.broken).length;
                advice.textContent = brokenUpper && intactUpper >= 3
                    ? L('The frame is now held by three points only. With a perfectly centred CoG it may settle nearly level, but it has no redundant support: any CoG offset, sway, or length mismatch causes tilt. Stop the lift and reeve the failed leg.', 'Khung hiện chỉ còn treo ba điểm. Nếu CoG đúng tâm nó có thể tạm cân bằng gần ngang, nhưng đã mất dự phòng: chỉ cần lệch CoG, đong đưa hoặc chênh chiều dài là sẽ nghiêng. Dừng nâng và nối lại nhánh đứt.')
                    : L('The parted corner is no longer held and sags under gravity. The other corners stay loaded. Select the parted rope and press Reeve after reducing the load or raising the SWL.', 'Góc mất cáp không còn bị níu nên trũng xuống theo trọng lực. Các góc còn cáp vẫn chịu sức căng. Chọn sợi đứt rồi bấm Nối lại sau khi giảm tải hoặc tăng SWL.');
            } else if (maxT > wllPerLeg) {
                badge.textContent = L('ROPE OVERLOAD', 'QUÁ TẢI CÁP');
                badge.className = 'text-[9px] font-mono font-bold px-2 py-0.5 rounded bg-red-500/20 text-red-400 border border-red-500/50 animate-pulse';
                led.className = 'w-2.5 h-2.5 rounded-full bg-red-500 shadow-[0_0_10px_#ef4444]';
                advice.textContent = L(
                    `Tension ${maxT.toFixed(2)} t exceeds SWL ${wllPerLeg.toFixed(1)} t. A flatter angle raises rope force (T = leg load × L/H). Change the angle, lengthen the rope, or raise the SWL.`,
                    `Sức căng ${maxT.toFixed(2)} t vượt SWL ${wllPerLeg.toFixed(1)} t. Góc càng thấp so với mặt ngang thì lực trong cáp càng lớn (T = tải nhánh × L/H). Đổi góc, tăng chiều dài hoặc tăng SWL.`
                );
            } else if (hookOver || beamOver) {
                badge.textContent = hookOver ? L('HOOK SWL EXCEEDED', 'VƯỢT SWL MÓC') : L('BEAM SWL EXCEEDED', 'VƯỢT SWL DẦM');
                badge.className = 'text-[9px] font-mono font-bold px-2 py-0.5 rounded bg-red-500/20 text-red-400 border border-red-500/50';
                led.className = 'w-2.5 h-2.5 rounded-full bg-red-500 shadow-[0_0_10px_#ef4444]';
                advice.textContent = hookOver
                    ? L(`Hook load exceeds the hook SWL of ${state.gear.hook.swlT} t. Double-click the hook to edit the SWL, or reduce the cargo weight.`, `Tải móc vượt SWL móc ${state.gear.hook.swlT} t. Nhấp đúp vào móc để nhập lại SWL hoặc giảm khối lượng hàng.`)
                    : L(`The combined leg force exceeds the beam SWL of ${state.gear.beam.swlT} t. Double-click the beam to edit it.`, `Tổng lực nhánh vượt SWL dầm ${state.gear.beam.swlT} t. Nhấp đúp vào dầm để sửa thông số.`);
            } else if ((vertAng > 60 || horizAng < 30) && !allSlack) {
                badge.textContent = L('CRITICAL / VIOLATION', 'VI PHẠM ASME B30.9');
                badge.className = 'text-[9px] font-mono font-bold px-2 py-0.5 rounded bg-red-500/20 text-red-400 border border-red-500/50 animate-pulse';
                led.className = 'w-2.5 h-2.5 rounded-full bg-red-500 shadow-[0_0_10px_#ef4444]';
                advice.textContent = L(
                    'Error: Horizontal sling angle is less than 30 degrees. Operation prohibited under ASME B30.9. Solutions: A) Increase sling leg length to reach α ≥ 60°; B) Use a Spreader Bar or Lifting Beam.',
                    'Lỗi: Góc nâng ngang cáp < 30° (LAF ≥ 2.0). Nghiêm cấm nâng cẩu theo ASME B30.9 & OSHA! Giải pháp: A) Tăng chiều dài cáp để đạt α ≥ 60°; B) Sử dụng Dầm gánh Spreader Bar.'
                );
            } else if (horizAng < 45 && !allSlack) {
                badge.textContent = L('WARNING: LOW ANGLE', 'CẢNH BÁO GÓC THẤP');
                badge.className = 'text-[9px] font-mono font-bold px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/50';
                led.className = 'w-2.5 h-2.5 rounded-full bg-amber-400 shadow-[0_0_10px_#facc15]';
                advice.textContent = L(
                    `Warning: Horizontal angle ${horizAng.toFixed(1)}° increases tension by >41%. Recommend increasing sling length or adding a spreader bar.`,
                    `Cảnh báo: Góc nâng ngang ${horizAng.toFixed(1)}° làm tăng lực căng cáp >41% (LAF > 1.414). Khuyến nghị: A) Tăng chiều dài cáp; B) Sử dụng dầm ngáng Spreader Bar.`
                );
            } else if (phy.tiltDeg > 2.5 && phy.groundClearance > 0.04) {
                badge.textContent = L(`OUT OF LEVEL ${phy.tiltDeg.toFixed(1)}°`, `NGHIÊNG LỆCH TÂM ${phy.tiltDeg.toFixed(1)}°`);
                badge.className = 'text-[9px] font-mono font-bold px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/50';
                led.className = 'w-2.5 h-2.5 rounded-full bg-amber-400 shadow-[0_0_10px_#facc15]';
                advice.innerHTML = L('The cargo is tilted by the CoG or by uneven LP1–LP4. Press Level to trim the turnbuckles.', 'Kiện hàng bị nghiêng do lệch CoG hoặc LP1–LP4 không đối xứng. Bấm Cân bằng để chỉnh tăng đơ.');
            } else if (allSlack) {
                badge.textContent = L('STANDBY', 'TRẠNG THÁI CHỜ');
                badge.className = 'text-[9px] font-mono font-bold px-2 py-0.5 rounded bg-slate-800 text-amber-300 border border-amber-500/40';
                led.className = 'w-2.5 h-2.5 rounded-full bg-amber-400 shadow-[0_0_10px_#facc15]';
                advice.innerHTML = L('The cargo is sitting on the dunnage. Set LP1–LP4 and the CoG, then press Trial lift.', 'Kiện hàng đang đặt trên đà kê. Hãy chỉnh LP1–LP4 và CoG, sau đó bấm Nhấc thử.');
            } else {
                badge.textContent = L('WITHIN LIMITS', 'CHUẨN AN TOÀN');
                badge.className = 'text-[9px] font-mono font-bold px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-400 border border-emerald-500/40';
                led.className = 'w-2.5 h-2.5 rounded-full bg-emerald-400 shadow-[0_0_10px_#34d399]';
                advice.textContent = L('The lift is within limits: sling angle under 45° from vertical, the cargo is level, and the four leg tensions are inside the WLL.', 'Phương án nâng hạ đạt chuẩn an toàn: góc nâng α < 45°, kiện hàng thăng bằng và lực căng 4 nhánh nằm trong giới hạn WLL.');
            }

            for (let i = 0; i < 4; i++) {
                const t = phy.legTensions[i];
                const swl = Math.max(0.05, legSwl(i));
                const pct = Math.min(100, (t / swl) * 100);
                const bar = document.getElementById(`bar-t${i}`);
                const val = document.getElementById(`val-t${i}`);
                bar.style.width = pct + '%';
                val.textContent = state.gear.legs[i].broken ? L('PARTED', 'ĐỨT') : (t.toFixed(2) + ' T');

                const colorClass = state.gear.legs[i].broken || t > swl ? 'text-red-400' : (t > swl * 0.8 ? 'text-amber-400' : 'text-emerald-400');
                const barColor = state.gear.legs[i].broken || t > swl ? 'bg-red-500' : (t > swl * 0.8 ? 'bg-amber-400' : 'bg-emerald-400');
                bar.className = `${barColor} h-full transition-all duration-75`;
                val.className = `font-mono font-bold text-[10px] w-14 text-right ${colorClass}`;

                const dOpt = state.displayOptions || {
                    showForces: true,
                    showSlingAngles: true,
                    showGroundAngle: true,
                    showHookLoad: true,
                    showShackleLoads: true,
                    showSlingLengths: true,
                    showCoG: true,
                    showVectors: false,
                    showCADEdges: true,
                    showHUD: true
                };

                const anyLPInfo = dOpt.showForces || dOpt.showSlingAngles || dOpt.showShackleLoads || dOpt.showSlingLengths;
                const lbl = document.getElementById(`lbl-t${i}`);
                if (lbl) {
                    if (anyLPInfo) {
                        const rig = rigNow || computeRigPose();
                        const anchor = (state.beamType === 'none') ? masterLinkWorld : slingAnchorWorld(i, rig);
                        const midPt = hwWorldPos[i].clone().lerp(anchor, 0.42);
                        projectToScreen(midPt, lbl);
                        if (state.gear.legs[i].broken) {
                            _setElemTextCached(lbl, `LP${i + 1}: ${L('PARTED', 'ĐỨT')}`, 'label-3d text-red-400 border-red-500/60 font-bold');
                        } else {
                            const parts = [`LP${i + 1}`];
                            if (dOpt.showForces) {
                                parts.push(phy.legSlacks[i] ? '0.0T' : `${t.toFixed(1)}T`);
                            }
                            if (dOpt.showSlingAngles) {
                                parts.push(`${Math.round(phy.legAngleDeg[i] || 60)}°`);
                            }
                            if (dOpt.showShackleLoads) {
                                parts.push(`${state.lang === 'en' ? 'SH' : 'MN'}: ${Math.round(pct)}%`);
                            }
                            if (dOpt.showSlingLengths) {
                                const turn = state.legDeltaL[i] || 0;
                                const turnStr = Math.abs(turn) > 0.01 ? ` (${turn > 0 ? '+' : ''}${turn.toFixed(2)}m)` : '';
                                parts.push(`L: ${state.slingLength.toFixed(1)}m${turnStr}`);
                            }
                            _setElemTextCached(lbl, parts.join(' · '), `label-3d ${colorClass}`);
                        }
                    } else {
                        _setElemPosCached(lbl, 0, 0, '0');
                    }
                }
            }

            const dOpt = state.displayOptions || {};
            const lblHook = document.getElementById('lbl-hook');
            const lblCog = document.getElementById('lbl-cog');

            if (lblHook) {
                if (dOpt.showHookLoad || dOpt.showSlingAngles) {
                    const hookWorld = phy.hookPos.clone().add(new THREE.Vector3(0, 0.85, 0));
                    const isClamped = projectToScreenClamped(hookWorld, lblHook, 52, 90);
                    const parts = [];
                    if (dOpt.showHookLoad) {
                        const swl = state.craneSWL || 64;
                        const pctSwl = Math.round((totalHookLoad / Math.max(1, swl)) * 100);
                        const pfx = isClamped ? L('⬆️ HOOK', '⬆️ MÓC') : L('🪝 HOOK', '🪝 MÓC');
                        parts.push(`${pfx}: ${totalHookLoad.toFixed(2)}T (${pctSwl}% SWL)`);
                    }
                    if (dOpt.showSlingAngles) {
                        parts.push(`α: ${vertAng.toFixed(0)}°`);
                    }
                    parts.push(`Y: ${phy.hookPos.y.toFixed(1)}m`);
                    _setElemTextCached(lblHook, parts.join(' | '), null);
                } else {
                    _setElemPosCached(lblHook, 0, 0, '0');
                }
            }

            const lblGround = document.getElementById('lbl-ground-angle');
            if (lblGround) {
                if (dOpt.showGroundAngle !== false) {
                    const yawDeg = state.cargoYawDeg || 0;
                    const yawRad = THREE.MathUtils.degToRad(yawDeg);
                    const R = Math.max(3.8, Math.hypot((state.L || 6) * 0.5, (state.W || 2.4) * 0.5) + 0.95);
                    const badgeDist = R + 1.25;
                    const cPos = phy.cargoPos || { x: 0, z: 0 };
                    const groundPos = new THREE.Vector3(
                        cPos.x + badgeDist * Math.cos(yawRad),
                        0.02,
                        cPos.z - badgeDist * Math.sin(yawRad)
                    );
                    projectToScreen(groundPos, lblGround);
                    const sign = (yawDeg > 0.05) ? '+' : (yawDeg < -0.05 ? '' : '');
                    _setElemTextCached(lblGround, `${sign}${yawDeg.toFixed(1)}°`, null);
                } else {
                    _setElemPosCached(lblGround, 0, 0, '0');
                }
            }

            const twinCogMode = typeof stsTwinCableMode === 'function' && stsTwinCableMode()
                && state.stsTwinLift && activeCargoVisual;
            if (twinCogMode && typeof ensureTwinCogMarkers === 'function') {
                ensureTwinCogMarkers();
            }

            if (cogIndicatorGroup) {
                // Twin cable lift: two per-box CoGs — hide fused centre marker
                cogIndicatorGroup.visible = Boolean(dOpt.showCoG !== false) && !twinCogMode;
            }
            if (plumbLineMesh) plumbLineMesh.visible = Boolean(dOpt.showCoG !== false) && !twinCogMode;

            const lblCogA = document.getElementById('lbl-cog-a');
            const lblCogB = document.getElementById('lbl-cog-b');
            if (lblCog) {
                if (dOpt.showCoG !== false && !twinCogMode && cogIndicatorGroup) {
                    const cogWorld = new THREE.Vector3();
                    cogIndicatorGroup.getWorldPosition(cogWorld);
                    projectToScreen(cogWorld, lblCog);
                    lblCog.textContent = `🎯 CoG (${state.cogX.toFixed(2)}, ${state.cogY.toFixed(2)}, ${state.cogZ.toFixed(2)})`;
                    lblCog.style.opacity = '1';
                } else {
                    lblCog.style.opacity = '0';
                }
            }
            if (lblCogA && lblCogB) {
                if (dOpt.showCoG !== false && twinCogMode) {
                    const boxA = activeCargoVisual.getObjectByName('Twin_20ft_A');
                    const boxB = activeCargoVisual.getObjectByName('Twin_20ft_B');
                    const mA = boxA && boxA.getObjectByName('Twin_CoG_A');
                    const mB = boxB && boxB.getObjectByName('Twin_CoG_B');
                    const wA = new THREE.Vector3();
                    const wB = new THREE.Vector3();
                    if (mA) {
                        mA.getWorldPosition(wA);
                        projectToScreen(wA, lblCogA);
                        lblCogA.textContent = `🎯 CoG A (${state.cogX.toFixed(2)}, ${state.cogY.toFixed(2)}, ${state.cogZ.toFixed(2)})`;
                        lblCogA.style.opacity = '1';
                    } else {
                        lblCogA.style.opacity = '0';
                    }
                    if (mB) {
                        mB.getWorldPosition(wB);
                        projectToScreen(wB, lblCogB);
                        lblCogB.textContent = `🎯 CoG B (${state.cogX.toFixed(2)}, ${state.cogY.toFixed(2)}, ${state.cogZ.toFixed(2)})`;
                        lblCogB.style.opacity = '1';
                    } else {
                        lblCogB.style.opacity = '0';
                    }
                } else {
                    lblCogA.style.opacity = '0';
                    lblCogB.style.opacity = '0';
                }
            }

            if (typeof isComplianceHUDVisible !== 'undefined' && isComplianceHUDVisible) {
                updateComplianceHUD();
            }

            // Update live telemetry badge for active selected cable
            const selSling = state.gear && state.gear.selection ? state.gear.selection.find(s => s.kind === 'sling') : null;
            if (selSling) {
                let tensionT = 0;
                let angleDeg = 60.0;
                let wllT = state.wllPerLeg || 15.0;
                if (selSling.role === 'leg') {
                    tensionT = (phy.legTensions && phy.legTensions[selSling.index]) || 0;
                    angleDeg = (phy.legAngleDeg && phy.legAngleDeg[selSling.index]) || 60.0;
                    wllT = (state.gear.legs[selSling.index] && state.gear.legs[selSling.index].swlT) || state.wllPerLeg || 15.0;
                } else if (selSling.role === 'upper') {
                    tensionT = (phy.upperTensions && phy.upperTensions[selSling.index]) || 0;
                    angleDeg = (phy.upperAngleDeg && phy.upperAngleDeg[selSling.index] != null)
                        ? phy.upperAngleDeg[selSling.index]
                        : (typeof getRigSpec === 'function' ? getRigSpec().betaDeg : 60.0);
                    wllT = (state.gear.uppers[selSling.index] && state.gear.uppers[selSling.index].swlT) || (state.wllPerLeg * 1.8) || 27.0;
                } else if (selSling.role === 'hanger') {
                    tensionT = (phy.hangerTensions && phy.hangerTensions[selSling.index]) || 0;
                    angleDeg = 90.0;
                    wllT = (state.gear.hangers && state.gear.hangers[selSling.index] && state.gear.hangers[selSling.index].swlT) || 25.0;
                }

                const laf = window.CAE?.EngineeringEngine?.calculateLAF(angleDeg) || (1 / Math.max(0.01, Math.sin(angleDeg * Math.PI / 180)));
                const utilPct = Math.round((tensionT / Math.max(0.01, wllT)) * 100);
                const isCrit = angleDeg < 30.0;
                const isWarn = angleDeg < 60.0 && !isCrit;
                const zoneText = isCrit ? L('CRITICAL', 'NGUY HIỂM') : (isWarn ? L('WARNING', 'CẢNH BÁO') : L('SAFE', 'AN TOÀN'));
                const zoneColor = isCrit ? 'text-red-400 font-bold' : (isWarn ? 'text-amber-300 font-bold' : 'text-emerald-300 font-bold');

                const elTen = document.getElementById('v-sel-tension');
                const elAng = document.getElementById('v-sel-angle');
                const elSwl = document.getElementById('v-sel-swl');
                if (elTen) elTen.innerHTML = state.lang === 'en'
                    ? `Leg tension: <b class="text-white">${tensionT.toFixed(2)} t</b> (${utilPct}%)`
                    : `Lực căng T: <b class="text-white">${tensionT.toFixed(2)} T</b> (${utilPct}%)`;
                if (elAng) elAng.innerHTML = `${L('Angle α:', 'Góc α:')} <b class="text-sky-300">${angleDeg.toFixed(1)}°</b> · LAF: <b class="${zoneColor}">${laf.toFixed(3)}</b>`;
                if (elSwl) elSwl.innerHTML = `WLL: ${wllT.toFixed(1)} T · <span class="${zoneColor}">[${zoneText}]</span>`;
            }

            // Phase 1 Core Safety: Crane Load Chart Matrix, Ground Pressure & Elastic Sling Dynamics
            updatePhase1CoreSafetyTelemetry(mb);

            // === PHASE 1: Rigging UI store + 3-zone / angle HUD ===
            const rigUI = (typeof window !== 'undefined' && window.RIG && window.RIG.riggingUIStore)
                ? window.RIG.riggingUIStore
                : ((typeof RIG !== 'undefined' && RIG.riggingUIStore) ? RIG.riggingUIStore : null);
            if (rigUI && typeof rigUI.sync === 'function') {
                try {
                    rigUI.sync(phy, state);
                } catch (e) {
                    // Non-fatal UI telemetry guard
                }
            }
            const rg = phy.rigging;
            if (rg) {
                const hud = document.getElementById('compliance-hud-panel')
                    || document.getElementById('rigging-alarm-hud');
                if (hud && rigUI) {
                    const ui = rigUI.getState();
                    hud.classList.remove('border-green-500', 'border-red-500', 'border-red-600', 'animate-pulse', 'animate-ping');
                    const cls = (ui.hudBorderClass || 'border-green-500').split(/\s+/);
                    cls.forEach((c) => { if (c) hud.classList.add(c); });
                }
                const zoneEl = document.getElementById('v-rig-zone');
                if (zoneEl) {
                    const label = rg.zoneLabel || 'SAFE';
                    const color = label === 'SAFE' ? 'text-emerald-300' : 'text-red-400 font-bold';
                    const zoneShow = label === 'SAFE' ? L('SAFE', 'AN TOÀN') : (label === 'WARNING' ? L('WARNING', 'CẢNH BÁO') : label);
                    zoneEl.innerHTML = `${L('Zone:', 'Vùng:')} <b class="${color}">${zoneShow}</b>`
                        + (rg.topology ? ` · ${rg.topology}` : '')
                        + (rg.minAngleDeg != null ? ` · α<sub>min</sub> ${rg.minAngleDeg.toFixed(0)}°` : '');
                }
                const dnvEl = document.getElementById('v-rig-dnv');
                if (dnvEl) {
                    dnvEl.textContent = rg.dnvNotice || '';
                    dnvEl.classList.toggle('hidden', !rg.dnvNotice);
                }
                if (rg.sirenActive || (rigUI && rigUI.getState().sirenActive)) {
                    if (typeof simAudio !== 'undefined' && simAudio.playAlarmChirp && !(phy._alarmChirpCool > 0)) {
                        simAudio.playAlarmChirp();
                        phy._alarmChirpCool = 45;
                    }
                }
                if ((phy._alarmChirpCool || 0) > 0) phy._alarmChirpCool -= 1;
            }
            // === END PHASE 1 RIGGING HUD ===
        }

        let craneLoadChartEngine = null;
        let groundPressureEngine = null;
        let elasticSlingEngine = null;

        function ensurePhase1Engines() {
            const C = window.CAE;
            if (!C) return false;
            if (!craneLoadChartEngine && C.CraneLoadChartEngine) {
                craneLoadChartEngine = new C.CraneLoadChartEngine(state.craneModelId || 'liebherr_ltm1200');
                if (state.craneOutriggerExtensionPct) {
                    craneLoadChartEngine.setOutriggerExtension(state.craneOutriggerExtensionPct);
                }
            }
            if (!groundPressureEngine && C.GroundPressureEngine) {
                groundPressureEngine = new C.GroundPressureEngine({
                    soilType: state.soilType || 'compacted_gravel',
                    matPresetId: state.craneMatPresetId || 'steel_mat_2x2'
                });
            }
            if (!elasticSlingEngine && C.ElasticSlingEngine) {
                elasticSlingEngine = new C.ElasticSlingEngine();
            }
            return Boolean(craneLoadChartEngine && groundPressureEngine && elasticSlingEngine);
        }

        function updatePhase1CoreSafetyTelemetry(mb) {
            if (!ensurePhase1Engines()) return;

            // 1. Crane kinematics & Working Radius
            const slewOrg = (craneDynamicParts && craneDynamicParts.slewOrigin)
                ? craneDynamicParts.slewOrigin
                : new THREE.Vector3(-7.5, 1.68, -8.5);
            const dx = phy.hookPos.x - slewOrg.x;
            const dz = phy.hookPos.z - slewOrg.z;
            const craneR = Math.max(3.0, Math.hypot(dx, dz));
            // Slew angle: 0° over front (+X), 90° over right (+Z), 180° over rear (-X), 270° over left (-Z)
            const slewAngleDeg = (Math.atan2(dz, dx) * (180 / Math.PI) + 360) % 360;
            const boomLenM = (craneDynamicParts && craneDynamicParts.boomLen)
                ? craneDynamicParts.boomLen
                : (state.craneBoomLengthM || 35.8);

            const grossLoadT = (mb && mb.grossCraneLoadT != null)
                ? mb.grossCraneLoadT
                : ((phy.groundClearance > 0.02) ? (state.weight + 2.8) : 0);

            // A. Crane Load Chart & LMI Evaluation (ASME B30.5 / EN 13000 / ASME P30.1)
            const lmi = craneLoadChartEngine.evaluateLift({
                grossLoadT: grossLoadT,
                radiusM: craneR,
                boomLengthM: boomLenM
            });

            const elRad = document.getElementById('lmi-radius');
            if (elRad) elRad.textContent = `${craneR.toFixed(1)} m`;
            const elBoom = document.getElementById('lmi-boom-len');
            if (elBoom) elBoom.textContent = `${(lmi.boomLengthM || boomLenM).toFixed(1)} m`;
            const elAng = document.getElementById('lmi-boom-ang');
            if (elAng) elAng.textContent = `${(lmi.boomAngleDeg || 70).toFixed(1)}°`;
            const elCap = document.getElementById('lmi-rated-cap');
            if (elCap) elCap.textContent = `${(lmi.ratedCapacityT || 0).toFixed(1)} T`;

            const elUtil = document.getElementById('lmi-util-pct');
            const utilPct = lmi.utilizationPct || 0;
            if (elUtil) {
                elUtil.textContent = `${utilPct.toFixed(1)}%`;
                elUtil.className = `font-extrabold ${lmi.isOverloaded ? 'text-red-400' : (lmi.isCriticalLift ? 'text-amber-300' : 'text-emerald-400')}`;
            }

            const elBar = document.getElementById('lmi-util-bar');
            if (elBar) {
                elBar.style.width = `${Math.min(100, utilPct)}%`;
                elBar.className = `h-full transition-all duration-100 ${lmi.isOverloaded ? 'bg-red-500' : (lmi.isCriticalLift ? 'bg-amber-500' : 'bg-emerald-500')}`;
            }

            const _tBadge = (txt) => (typeof window !== 'undefined' && window.SafeLift?.i18n?.translateBadge)
                ? window.SafeLift.i18n.translateBadge(txt, state.lang)
                : txt;

            const elBadge = document.getElementById('lmi-status-badge');
            if (elBadge) {
                const rawLmiBadge = lmi.alertBadge || (lmi.isOverloaded ? '🚨 QUÁ TẢI CẨU' : (lmi.isCriticalLift ? '⚠️ CRITICAL LIFT' : '🟢 AN TOÀN'));
                elBadge.textContent = _tBadge(rawLmiBadge);
                elBadge.className = `text-[9px] font-mono font-bold px-2 py-0.5 rounded ${
                    lmi.isOverloaded ? 'bg-red-500/20 text-red-400 border border-red-500/50 animate-pulse' :
                    (lmi.isCriticalLift ? 'bg-amber-500/20 text-amber-300 border border-amber-500/50' :
                    'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40')
                }`;
            }

            // B. Ground Bearing Pressure & Mat Sizing Engine (CIRIA C703)
            const craneModel = craneLoadChartEngine.crane;
            const reactions = groundPressureEngine.calculateOutriggerReactions({
                carrierMassT: craneModel.carrierMassT,
                counterweightT: craneLoadChartEngine.selectedCounterweightT || craneLoadChartEngine.counterweightT || 50,
                counterweightRadiusM: 3.8,
                grossLoadT: grossLoadT,
                workingRadiusM: craneR,
                slewAngleDeg: slewAngleDeg,
                outriggerBase: craneModel.outriggerBase
            });

            const p1 = Number(reactions.p1_frontRightT) || 0;
            const p2 = Number(reactions.p2_frontLeftT) || 0;
            const p3 = Number(reactions.p3_rearLeftT) || 0;
            const p4 = Number(reactions.p4_rearRightT) || 0;
            const maxReaction = Number(reactions.maxReactionT) || Math.max(p1, p2, p3, p4);

            const setTxt = (id, str) => { const el = document.getElementById(id); if (el) el.textContent = str; };
            setTxt('val-p1', `${p1.toFixed(1)} T`);
            setTxt('val-p2', `${p2.toFixed(1)} T`);
            setTxt('val-p3', `${p3.toFixed(1)} T`);
            setTxt('val-p4', `${p4.toFixed(1)} T`);
            setTxt('outrigger-max-p', `Max: ${maxReaction.toFixed(1)} T`);

            const soilEval = groundPressureEngine.evaluateSoilSafety(maxReaction);
            const soilBadge = document.getElementById('soil-status-badge');
            if (soilBadge) {
                const rawSoil = soilEval.badge || (soilEval.status === 'SAFE' ? '🟢 ĐẠT CHUẨN NỀN' : '🚨 LÚN SỤT NỀN');
                soilBadge.textContent = _tBadge(rawSoil);
                soilBadge.className = `text-[9px] font-mono font-bold px-2 py-0.5 rounded ${
                    soilEval.status === 'SOIL_BEARING_FAILURE' ? 'bg-red-500/20 text-red-400 border border-red-500/50 animate-pulse' :
                    (soilEval.status === 'ELEVATED_PRESSURE' ? 'bg-amber-500/20 text-amber-300 border border-amber-500/50' :
                    'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40')
                }`;
            }
            const pT = soilEval.pressureTPerM2 || 0;
            const pKPa = soilEval.pressureKPa || 0;
            const reqMat = soilEval.requiredMatAreaM2 || 0;
            setTxt('soil-pressure-val', `${pT.toFixed(1)} T/m² (${pKPa.toFixed(0)} kPa)`);
            setTxt('soil-mat-req', `≥ ${reqMat.toFixed(2)} m²`);

            // C. Elastic Hooke Sling Elongation & DNV-ST-N001 4-Leg Skew Load
            const matType = state.slingMaterialType || 'wire';
            const isRigid = state.isRigidPayload !== false;
            const legTens = (phy.legTensions && phy.legTensions.length === 4) ? phy.legTensions : [0, 0, 0, 0];
            const dnvMeta = phy.rigging && phy.rigging.dnvMeta;
            const dnvShares = phy.rigging && Array.isArray(phy.rigging.dnvShares) && phy.rigging.dnvShares.length === 4 ? phy.rigging.dnvShares : null;
            const skew = dnvMeta
                ? { heavyPairSharePct: dnvMeta.heavyPairSharePct, hasSkewRisk: dnvMeta.hasSkewRisk, sklUsed: dnvMeta.sklUsed }
                : (dnvShares
                    ? { heavyPairSharePct: 100.0, hasSkewRisk: isRigid }
                    : elasticSlingEngine.evaluateFourLegIndeterminacy(legTens, isRigid));

            for (let i = 0; i < 4; i++) {
                const tVal = (phy.legTensions && phy.legTensions[i]) || 0;
                const L0 = (state.gear && state.gear.legs && state.gear.legs[i] && state.gear.legs[i].lengthM) || state.lowerSlingLength || state.slingLength || 3.0;
                const diaMm = (state.gear && state.gear.legs && state.gear.legs[i] && state.gear.legs[i].diaMm) || 24;
                const elon = elasticSlingEngine.calculateElongation({
                    tensionT: tVal,
                    lengthM: L0,
                    diaMm: diaMm,
                    material: matType
                });
                const deltaVal = (elon && elon.deltaL_mm != null) ? elon.deltaL_mm : 0;
                setTxt(`val-delta-l${i}`, `+${deltaVal.toFixed(1)} mm`);
            }

            const share1 = (skew && skew.heavyPairSharePct != null) ? skew.heavyPairSharePct : 50.0;
            const share2 = Math.max(0, Math.round((100 - share1) * 10) / 10);
            setTxt('skew-share-pct', `${share1.toFixed(1)}% / ${share2.toFixed(1)}%`);
            const skewBadge = document.getElementById('skew-status-badge');
            if (skewBadge) {
                skewBadge.textContent = skew.hasSkewRisk ? L('⚠️ DNV SKEW UNEQUAL LOAD', '⚠️ DNV LỆCH TẢI 4 NHÁNH') : 'DNV-ST-N001';
                skewBadge.className = `text-[9px] font-mono font-bold px-2 py-0.5 rounded ${
                    skew.hasSkewRisk ? 'bg-amber-500/20 text-amber-300 border border-amber-500/50' :
                    'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
                }`;
            }
        }

        function bindPhase1Controls() {
            ensurePhase1Engines();

            const selCrane = document.getElementById('sel-crane-model');
            if (selCrane) {
                selCrane.value = state.craneModelId || 'liebherr_ltm1200';
                selCrane.addEventListener('change', e => {
                    state.craneModelId = e.target.value;
                    if (craneLoadChartEngine) craneLoadChartEngine.selectCrane(e.target.value);
                    if (typeof updateSceneAndTelemetry === 'function') updateSceneAndTelemetry();
                });
            }

            const selOutrigger = document.getElementById('sel-outrigger-ext');
            if (selOutrigger) {
                selOutrigger.value = String(state.craneOutriggerExtensionPct || 100);
                selOutrigger.addEventListener('change', e => {
                    const ext = parseInt(e.target.value, 10);
                    state.craneOutriggerExtensionPct = ext;
                    if (craneLoadChartEngine) craneLoadChartEngine.setOutriggerExtension(ext);
                    if (typeof updateSceneAndTelemetry === 'function') updateSceneAndTelemetry();
                });
            }

            const selSoil = document.getElementById('sel-soil-type');
            if (selSoil) {
                selSoil.value = state.soilType || 'compacted_gravel';
                selSoil.addEventListener('change', e => {
                    state.soilType = e.target.value;
                    if (groundPressureEngine) groundPressureEngine.setSoil(e.target.value);
                    if (typeof updateSceneAndTelemetry === 'function') updateSceneAndTelemetry();
                });
            }

            const selMat = document.getElementById('sel-crane-mat');
            if (selMat) {
                selMat.value = state.craneMatPresetId || 'steel_mat_2x2';
                selMat.addEventListener('change', e => {
                    state.craneMatPresetId = e.target.value;
                    if (groundPressureEngine) groundPressureEngine.setMatPreset(e.target.value);
                    if (typeof GFX !== 'undefined' && GFX.syncCraneOutriggerMats3D) {
                        GFX.syncCraneOutriggerMats3D({ THREE, craneVehicleGroup, presetId: state.craneMatPresetId, MATS });
                    }
                    if (typeof updateSceneAndTelemetry === 'function') updateSceneAndTelemetry();
                });
            }

            const selMatSling = document.getElementById('sel-sling-material');
            if (selMatSling) {
                selMatSling.value = state.slingMaterialType || 'wire';
                selMatSling.addEventListener('change', e => {
                    state.slingMaterialType = e.target.value;
                    if (typeof updateSceneAndTelemetry === 'function') updateSceneAndTelemetry();
                });
            }

            const selRigid = document.getElementById('sel-payload-rigidity');
            if (selRigid) {
                selRigid.value = state.isRigidPayload !== false ? 'rigid' : 'flexible';
                selRigid.addEventListener('change', e => {
                    state.isRigidPayload = (e.target.value === 'rigid');
                    if (typeof updateSceneAndTelemetry === 'function') updateSceneAndTelemetry();
                });
            }

            const inpExagg = document.getElementById('inp-visual-exaggeration');
            if (inpExagg) {
                inpExagg.value = String(state.visualExaggerationScale || 5.0);
                inpExagg.addEventListener('input', e => {
                    const val = parseFloat(e.target.value);
                    if (Number.isFinite(val)) {
                        state.visualExaggerationScale = val;
                        const lbl = document.getElementById('val-visual-exaggeration');
                        if (lbl) lbl.textContent = val.toFixed(1) + 'x';
                    }
                });
            }
        }

        const _projTmpVec = new THREE.Vector3();
        function _setElemPosCached(domElem, xPx, yPx, opacityStr) {
            if (!domElem) return;
            if (domElem._cOpacity !== opacityStr) {
                domElem.style.opacity = opacityStr;
                domElem._cOpacity = opacityStr;
            }
            if (opacityStr === '0') return;
            const lx = `${Math.round(xPx * 2) * 0.5}px`;
            const ty = `${Math.round(yPx * 2) * 0.5}px`;
            if (domElem._cLeft !== lx) { domElem.style.left = lx; domElem._cLeft = lx; }
            if (domElem._cTop !== ty) { domElem.style.top = ty; domElem._cTop = ty; }
        }
        function _setElemTextCached(domElem, text, className) {
            if (!domElem) return;
            if (text != null && domElem._cText !== text) { domElem.textContent = text; domElem._cText = text; }
            if (className != null && domElem._cClass !== className) { domElem.className = className; domElem._cClass = className; }
        }
        function projectToScreen(worldPos, domElem) {
            const v = _projTmpVec.copy(worldPos).project(camera);
            if (v.z > 1) {
                _setElemPosCached(domElem, 0, 0, '0');
                return;
            }
            const x = (v.x * 0.5 + 0.5) * window.innerWidth;
            const y = (-(v.y * 0.5) + 0.5) * window.innerHeight;
            _setElemPosCached(domElem, x, y, '1');
        }

        function projectToScreenClamped(worldPos, domElem, topMin = 50, bottomMargin = 85) {
            const v = _projTmpVec.copy(worldPos).project(camera);
            if (v.z > 1) {
                _setElemPosCached(domElem, 0, 0, '0');
                return false;
            }
            let x = (v.x * 0.5 + 0.5) * window.innerWidth;
            let y = (-(v.y * 0.5) + 0.5) * window.innerHeight;
            let isClamped = false;

            // Horizontally clamp so it stays comfortably inside viewport
            x = THREE.MathUtils.clamp(x, 140, Math.max(140, window.innerWidth - 180));

            // If world point is above the screen or below the screen
            if (y < topMin) {
                y = topMin;
                isClamped = true;
            } else if (y > window.innerHeight - bottomMargin) {
                y = window.innerHeight - bottomMargin;
                isClamped = true;
            }

            _setElemPosCached(domElem, x, y, '1');
            return isClamped;
        }

        // --- 10. DIRECT 3D INTERACTIVE DRAGGING FOR HOOK, LP1-LP4 & 3D COG ---
        const GEAR_FORMS = {
            sling: [
                { key: 'lengthM', label: 'Chiều dài làm việc', unit: 'm', step: 0.01, min: 0.3, max: 40, nullable: true },
                { key: 'swlT', label: 'SWL / WLL', unit: 't', step: 0.1, min: 0.2, max: 500, nullable: true },
                { key: 'diaMm', label: 'Đường kính / Bề rộng', unit: 'mm', step: 0.5, min: 4, max: 300, nullable: false },
                { key: 'massKg', label: 'Khối lượng', unit: 'kg', step: 0.1, min: 0.1, max: 800, nullable: true },
                { key: 'sf', label: 'Hệ số an toàn MBL/SWL', unit: '', step: 0.5, min: 2, max: 10, nullable: false }
            ],
            shackle: [
                { key: 'swlT', label: 'SWL / WLL', unit: 't', step: 0.1, min: 0.5, max: 500, nullable: false },
                { key: 'massKg', label: 'Khối lượng', unit: 'kg', step: 0.1, min: 0.2, max: 200, nullable: true },
                { key: 'pinMm', label: 'Đường kính chốt', unit: 'mm', step: 0.5, min: 6, max: 120, nullable: false },
                { key: 'jawMm', label: 'Độ mở má', unit: 'mm', step: 0.5, min: 10, max: 250, nullable: false },
                { key: 'sf', label: 'Hệ số an toàn', unit: '', step: 0.5, min: 3, max: 8, nullable: false }
            ],
            beam: [
                { key: 'swlT', labelKey: 'beamSwl', unit: 't', step: 0.5, min: 1, max: 2000, nullable: false },
                { key: 'lengthM', labelKey: 'memLen', unit: 'm', step: 0.01, min: 0.6, max: 30, nullable: true },
                { key: 'widthM', label: 'Chiều rộng dầm', unit: 'm', step: 0.01, min: 0.4, max: 12, nullable: true },
                { key: 'depthM', label: 'Chiều cao tiết diện', unit: 'm', step: 0.01, min: 0.08, max: 1.5, nullable: false },
                { key: 'massT', label: 'Tự trọng bộ dầm', unit: 't', step: 0.01, min: 0.05, max: 40, nullable: true },
                { key: 'sf', labelKey: 'beamSf', unit: '', step: 0.5, min: 2, max: 8, nullable: false }
            ],
            member: [
                { key: 'lengthM', labelKey: 'memLen', unit: 'm', step: 0.01, min: 0.6, max: 40, nullable: true },
                { key: 'aM', labelKey: 'pickA', unit: 'm', step: 0.01, min: -20, max: 20, nullable: true },
                { key: 'bM', labelKey: 'pickB', unit: 'm', step: 0.01, min: -20, max: 20, nullable: true },
                { key: 'swlT', labelKey: 'memSwl', unit: 't', step: 0.5, min: 1, max: 2000, nullable: true },
                { key: 'massT', labelKey: 'memMass', unit: 't', step: 0.01, min: 0.02, max: 40, nullable: true }
            ],
            hook: [
                { key: 'swlT', label: 'SWL móc', unit: 't', step: 0.5, min: 1, max: 2000, nullable: false },
                { key: 'massKg', label: 'Khối lượng', unit: 'kg', step: 1, min: 5, max: 8000, nullable: false },
                { key: 'sf', label: 'Hệ số an toàn', unit: '', step: 0.5, min: 2, max: 8, nullable: false }
            ],
            cargo: [
                { key: 'L', label: 'Chiều dài', unit: 'm', step: 0.01, min: 0.5, max: 30, nullable: false },
                { key: 'W', label: 'Chiều rộng', unit: 'm', step: 0.01, min: 0.4, max: 12, nullable: false },
                { key: 'H', label: 'Chiều cao', unit: 'm', step: 0.01, min: 0.2, max: 12, nullable: false },
                { key: 'weight', label: 'Tổng trọng lượng', unit: 't', step: 0.1, min: 0.1, max: 500, nullable: false },
                { key: 'tareT', label: 'Tare (khung rỗng)', unit: 't', step: 0.01, min: 0, max: 80, nullable: true },
                { key: 'cogX', label: 'CoG X', unit: 'm', step: 0.01, min: -20, max: 20, nullable: false },
                { key: 'cogY', label: 'CoG Y', unit: 'm', step: 0.01, min: -20, max: 20, nullable: false },
                { key: 'cogZ', label: 'CoG Z', unit: 'm', step: 0.01, min: -20, max: 20, nullable: false }
            ]
        };
