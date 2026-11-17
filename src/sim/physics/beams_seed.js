/**
 * physics/beams_seed — seed beams, cable graph, contacts
 * Split from legacy god-file (strangler Phase 2). Shared scope via assemble.
 */
        function seedBeamsFromKinematic() {
            if (!phy.beams || !phy.beams.length) return;
            // Nhớm cáp freeze: keep XY pose, but NEVER allow the beam through the roof.
            if (phy._nhomFreezeSpreader && state.poseLock) {
                phy.beams.forEach(b => {
                    if (b.v) b.v.set(0, 0, 0);
                    if (b.w) b.w.set(0, 0, 0);
                    clampBeamAboveCargoRoof(b);
                });
                return;
            }
            if (state.beamType === 'basket') {
                alignBasketBars();
                return;
            }
            // Direct twistlock: seat as STS headblock. Cable hang: same kinematic path as H-beam.
            if (state.beamType === 'container_spreader'
                && typeof isStsDirectAttach === 'function' && isStsDirectAttach()
                && typeof seatStsSpreaderToCargo === 'function') {
                seatStsSpreaderToCargo();
                return;
            }
            if (state.beamType === 'lifting_beam' && (state.liftingBeamBottomMode === 'direct' || state.liftingBeamTopMode === 'direct_hook')) {
                const b0 = (phy.beams || [])[0];
                if (b0 && state.liftingBeamBottomMode === 'direct') {
                    const roof = (typeof supportY === 'function' ? supportY(phy.cargoPos.x, phy.cargoPos.z) : 0) + (state.H || 2.591);
                    b0.x.set(phy.cargoPos.x, roof + 0.34, phy.cargoPos.z);
                    b0.q.copy(phy.cargoQuat || new THREE.Quaternion());
                    b0.isRestingOnCargo = true;
                    if (state.liftingBeamTopMode === 'direct_hook') {
                        const mOff = (typeof HOOK_MASTER_OFFSET_Y === 'number') ? HOOK_MASTER_OFFSET_Y : -0.56;
                        phy.hookPos.set(b0.x.x, b0.x.y + 0.44 - mOff, b0.x.z);
                        phy.hookTarget.copy(phy.hookPos);
                    }
                    return;
                }
            }
            const rig = kinematicRigPose();
            phy.beams.forEach(b => {
                b.x.copy(b.origin.clone().applyQuaternion(rig.frameQ).add(rig.spreaderPos));
                b.q.copy(rig.frameQ);
                b.v.copy(rig.anchorVel);
                b.w.set(0, 0, 0);
                const floorY = cargoCeilingUnderBeam(b.x.x, b.x.z, rig.spec, b);
                if (rig.clamped || b.x.y < floorY + 0.02) {
                    b.x.y = floorY;
                    b.isRestingOnCargo = true;
                } else {
                    b.isRestingOnCargo = false;
                }
                depenetrateBeamFromCargo(b, 4);
            });
            settleBeamsToUpperBridle();
        }

        function attachWorld(end) {
            if (!end) return new THREE.Vector3();
            if (end.kind === 'hook') {
                const dual = (state.hookCount || 1) >= 2 && state.beamType !== 'container_spreader';
                const ox = dual ? dualHookOffsetX((end.index || 0) === 1 ? -1 : 1) : 0;
                return new THREE.Vector3(
                    phy.hookPos.x + ox,
                    phy.hookPos.y + HOOK_MASTER_OFFSET_Y,
                    phy.hookPos.z
                );
            }
            if (end.kind === 'cargo') {
                const i = end.index || 0;
                // Detached twin 20ft: lug rides with the free-falling half, not the fused COM.
                const fallenHalf = (phy.twinFallen && (
                    (i === 1 || i === 2) ? phy.twinFallen.A
                        : (i === 0 || i === 3) ? phy.twinFallen.B
                            : null
                )) || null;
                if (fallenHalf && fallenHalf.x && fallenHalf.q) {
                    const loc = (fallenHalf.lugLocal && fallenHalf.lugLocal[i])
                        ? fallenHalf.lugLocal[i].clone()
                        : new THREE.Vector3(
                            (i === 0 || i === 3 ? 1 : -1) * ((fallenHalf.half && fallenHalf.half.hx) || 2.9),
                            (fallenHalf.half && fallenHalf.half.hy) || ((state.H || 2.591) * 0.5),
                            (i === 0 || i === 1 ? 1 : -1) * ((fallenHalf.half && fallenHalf.half.hz) || 1.1)
                        );
                    const ring = loc.applyQuaternion(fallenHalf.q).add(fallenHalf.x);
                    const n = new THREE.Vector3(0, 1, 0).applyQuaternion(fallenHalf.q).normalize();
                    const stsDirect = typeof isStsDirectAttach === 'function' && isStsDirectAttach();
                    if (!stsDirect) ring.addScaledVector(n, 0.12);
                    return ring;
                }
                const lug = state.lugs[i];
                if (!lug) return phy.cargoPos.clone();
                const n = state.lugNormals[i] ? state.lugNormals[i].clone() : new THREE.Vector3(0, 1, 0);
                if (n.lengthSq() < 0.25) n.set(0, 1, 0);
                n.normalize().applyQuaternion(phy.cargoQuat);
                const ring = lug.clone().applyQuaternion(phy.cargoQuat).add(phy.cargoPos);
                if (phy.cornerSag && phy.cornerSag[i]) ring.y -= phy.cornerSag[i];
                const directPin = (typeof isStsDirectAttach === 'function' && isStsDirectAttach())
                    || (state.beamType === 'lifting_beam' && state.liftingBeamBottomMode === 'direct');
                if (!directPin) ring.addScaledVector(n, 0.12);
                return ring;
            }
            if (!end.body) return new THREE.Vector3();
            return end.local.clone().applyQuaternion(end.body.q).add(end.body.x);
        }

        function preserveOtherCables() {
            if (state.rigFit === 'auto') {
                state.holdCableLength = false;
                state.heldCableL0 = null;
            } else holdCableLengths();
        }

        function pickSpreaderPos(memberId, off) {
            const spec = memberSpec(memberId);
            if (!spec) return null;
            const type = state.beamType;
            const topId = type === 'modular_truss' ? 'truss' : 'top';
            if ((type === 'cascaded' || type === 'modular_truss') && (memberId === 'top' || memberId === 'truss')) {
                const yTop = (typeof cascadedTopOffsetY === 'function')
                    ? cascadedTopOffsetY()
                    : Math.max(type === 'modular_truss' ? 1.25 : 1.40, (state.hangerSlingLength || 2) + 0.40);
                return new THREE.Vector3(off, yTop, 0);
            }
            if ((type === 'cascaded' || type === 'modular_truss') && memberId === 'lowPlus') {
                const top = memberSpec(topId);
                return new THREE.Vector3(top ? top.a : 0, 0, off);
            }
            if ((type === 'cascaded' || type === 'modular_truss') && memberId === 'lowMinus') {
                const top = memberSpec(topId);
                return new THREE.Vector3(top ? top.b : 0, 0, off);
            }
            if (spec.axis === 'z') return new THREE.Vector3(0, 0, off);
            return new THREE.Vector3(off, 0, 0);
        }

        function placeExtraPicks() {
            memberCatalog().forEach(m => {
                const picks = memberStore(m.id).picks || [];
                picks.forEach(p => {
                    const pos = pickSpreaderPos(m.id, p.off || 0);
                    if (!pos) return;
                    addPickMark(pos.x, pos.y + 0.12, pos.z, m.id);
                });
            });
        }

        function appendUserCables(plan) {
            const bodies = plan.bodies || [];
            (state.gear.extraCables || []).forEach((ex, i) => {
                const spec = memberSpec(ex.memberId);
                if (!spec) return;
                const body = bodies.find(b => b.id === ex.memberId || (b.members && b.members.indexOf(ex.memberId) >= 0));
                if (!body) return;
                const off = ex.off || 0;
                const local = spec.axis === 'z' ? [0, 0.08, off] : [off, 0.08, 0];
                const a = endOf('body', body.id, local[0], local[1], local[2]);
                const b = ex.to === 'cargo' ? endOf('cargo', null, 0, 0, 0, ex.lug || 0) : endOf('hook');
                plan.cables.push({ role: 'extra', index: i, a: a, b: b });
            });
        }

        function holdCableLengths() {
            state.holdCableLength = true;
            if (!state.heldCableL0) state.heldCableL0 = { upper: [], leg: [], hanger: [] };
            (phy.cables || []).forEach(c => {
                if (!state.heldCableL0[c.role]) state.heldCableL0[c.role] = [];
                if (state.heldCableL0[c.role][c.index] == null) state.heldCableL0[c.role][c.index] = c.L0;
            });
        }

        function syncCableRest(captureDesign) {
            const spec = getRigSpec();
            if (captureDesign) phy._stsPinsSnug = false;
            (phy.cables || []).forEach(c => {
                if (c.role === 'extra') {
                    const ex = (state.gear.extraCables || [])[c.index];
                    const spanNow = Math.max(0.2, attachWorld(c.a).distanceTo(attachWorld(c.b)));
                    // A loose auxiliary chain/rope cannot have its manufactured
                    // length silently set to the pin-to-pin chord.  That creates an
                    // impossible, horizontal "zero-length-sag" line over a void.
                    // Preserve a user-entered length exactly; only the automatic
                    // design value receives a small, documented installation slack
                    // so gravity has real material length to form a catenary.
                    const style = (ex && ex.slingType) || state.slingType || 'wire';
                    const slackRatio = style === 'chain' ? 0.030
                        : ((style === 'web' || style === 'round_sling' || style === 'grommet') ? 0.018 : 0.015);
                    const installSlack = Math.min(0.22, Math.max(0.035, spanNow * slackRatio));
                    if (ex && (ex.lengthM == null || (captureDesign && !ex.userSet))) {
                        ex.lengthM = spanNow + installSlack;
                    }
                    c.L0 = Math.max(0.2, ex && ex.lengthM != null ? ex.lengthM : 1);
                    c.designL0 = c.L0;
                    return;
                }
                const item = c.role === 'leg' ? (state.gear.legs && state.gear.legs[c.index])
                    : (c.role === 'upper' ? (state.gear.uppers && state.gear.uppers[c.index])
                    : (c.role === 'hanger' ? (state.gear.hangers && state.gear.hangers[c.index])
                    : null));
                const turn = c.role === 'leg' ? (state.legDeltaL[c.index] || 0) : 0;
                const held = state.holdCableLength && state.heldCableL0 && state.heldCableL0[c.role] ? state.heldCableL0[c.role][c.index] : null;
                const customLength = hasExplicitCableLength(item, c.role);
                const userEditedAfterHold = !!(customLength && item && item.userSet && !item._nhomAutoLen && item._manualLengthOverride);
                if (captureDesign && c.role === 'hanger' && held == null && !customLength) {
                    c.designL0 = Math.max(0.15, attachWorld(c.a).distanceTo(attachWorld(c.b)));
                }
                const isLbDirectTopPin = c.role === 'upper' && state.beamType === 'lifting_beam' && state.liftingBeamTopMode === 'direct_hook';
                const isLbDirectBotPin = c.role === 'leg' && state.beamType === 'lifting_beam' && state.liftingBeamBottomMode === 'direct';
                let nominal;
                // User-edited manual length overrides temporary held snapshot; Nhớm hold still wins for unedited cables.
                if (isLbDirectTopPin) nominal = 0.04;
                else if (isLbDirectBotPin) nominal = 0.12;
                else if (userEditedAfterHold) nominal = item.lengthM;
                else if (held != null) nominal = held;
                else if (customLength) nominal = item.lengthM;
                else if (c.role === 'upper') nominal = spec.topLeg;
                else if (c.role === 'hanger') {
                    nominal = (state.hangerSlingLength != null)
                        ? state.hangerSlingLength
                        : (spec.hanger || c.designL0 || Math.max(0.3, spec.mast || 2.0));
                }
                else nominal = spec.lower;
                const directLink = isLbDirectTopPin || isLbDirectBotPin
                    || (c.role === 'leg' && typeof isStsDirectAttach === 'function' && isStsDirectAttach());
                const minL0 = directLink ? 0.04 : 0.2;
                c.L0 = Math.max(minL0, nominal + turn);
                if (c.role !== 'hanger' || customLength) c.designL0 = c.L0;
            });
        }

        function applyBeamVisuals() {
            if (!phy.rigLive) seedBeamsFromKinematic();
            syncCableRest(false);
            (phy.beams || []).forEach(b => {
                if (!b.group) return;
                b.group.position.copy(b.x);
                b.group.quaternion.copy(b.q);
                b.group.scale.set(1, 1, 1);
            });
            if (spreaderRootGroup && phy.beams && phy.beams.length) {
                spreaderRootGroup.position.set(0, 0, 0);
                spreaderRootGroup.quaternion.identity();
                spreaderRootGroup.scale.set(1, 1, 1);
            }
            if (typeof updateStsHeadblockVisual === 'function') updateStsHeadblockVisual();
        }

        /**
         * Seat STS spreader onto the cargo footprint:
         * - plan: centred so black twistlock “gù” sit in ISO roof holes
         * - direct: pins engaged in castings, yellow underside on roof
         * - cable: stand-off = lower sling L0
         * - hook = short headblock above the yellow beam
         */
        function seatStsSpreaderToCargo() {
            if (state.beamType !== 'container_spreader') return false;
            if (phy._stsSeating) return false;
            phy._stsSeating = true;
            try {
                const spec = (typeof getRigSpec === 'function') ? getRigSpec() : null;
                let b = (phy.beams || [])[0];
                const stsDirect = typeof isStsDirectAttach === 'function'
                    ? isStsDirectAttach()
                    : (state.stsAttachMode || 'direct') !== 'cable';

                // Linked direct only: auto-match telescopic size to cargo.
                // Cable / unlinked: never rewrite the operator's stsSizeFt.
                const sizeIndependent = (typeof stsSpreaderSizeIndependent === 'function')
                    ? stsSpreaderSizeIndependent()
                    : (state.stsSizeLinked === false || (state.stsAttachMode || 'direct') === 'cable');
                if (typeof resolveStsFitToCargo === 'function' && !state.stsTwinLift && !sizeIndependent) {
                    const before = Number(state.stsSizeFt) || 40;
                    const fit = resolveStsFitToCargo();
                    if (fit.ft !== before && typeof rebuildSpreaderVisuals === 'function') {
                        rebuildSpreaderVisuals();
                        b = (phy.beams || [])[0];
                    }
                }

                // Lug locals = ISO hole centres (same pitch as procedural feet / stamped roof holes).
                if (typeof setSymmetricLugsFromDimensions === 'function') {
                    const prevElev = state.lugElevPreset;
                    state.lugElevPreset = 'top';
                    setSymmetricLugsFromDimensions();
                    state.lugElevPreset = prevElev || 'top';
                }

                const yaw = (typeof stsLockedYawRad === 'function')
                    ? stsLockedYawRad()
                    : THREE.MathUtils.degToRad(state.cargoYawDeg || 0);
                const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, yaw, 0, 'YXZ'));
                if (phy.cargoQuat) softLockYawQuat(phy.cargoQuat, yaw, 0.0, 1.0);

                const roof = cargoShellTopRaw(phy.cargoPos.x, phy.cargoPos.z, spec);
                let beamY;
                if (stsDirect) {
                    // Tip ~5 cm into the casting; yellow underside (~−0.34) lands on the roof.
                    const tipLocalY = STS_TWISTLOCK_FOOT_Y - STS_TWISTLOCK_TIP_BELOW;
                    beamY = (roof - 0.05) - tipLocalY;
                    beamY = Math.min(beamY, roof + 0.34);
                } else {
                    // Cable = H-beam stand-off: yellow frame hangs on lower legs above the roof.
                    const L0 = Math.max(0.8, state.lowerSlingLength || 2.0);
                    beamY = roof + 0.28 + L0;
                }

                phy.hookPos.x = phy.cargoPos.x;
                phy.hookPos.z = phy.cargoPos.z;
                if (stsDirect) {
                    phy.hookPos.y = beamY + 0.22;
                } else {
                    // Cable physics = H-beam: hook high on taut upper bridle (not headblock gap).
                    const spec = (typeof getRigSpec === 'function') ? getRigSpec() : null;
                    const upperL = Math.max(
                        2.0,
                        state.upperSlingLength
                            || (spec && (spec.recUpper || spec.topLeg))
                            || 4.0
                    );
                    let horizU = 0.55;
                    if (typeof getLPBoundingSpan === 'function') {
                        const sp = getLPBoundingSpan();
                        horizU = Math.max(0.35, Math.hypot((sp.spanX || 0) / 2, (sp.spanZ || 0) / 2));
                    } else if (spec && spec.horizU) {
                        horizU = Math.max(0.35, spec.horizU);
                    }
                    const upperDrop = Math.sqrt(Math.max(0.25, upperL * upperL - horizU * horizU));
                    const masterOff = (typeof HOOK_MASTER_OFFSET_Y === 'number') ? HOOK_MASTER_OFFSET_Y : -0.56;
                    phy.hookPos.y = THREE.MathUtils.clamp(
                        beamY + 0.14 + upperDrop - masterOff,
                        beamY + 1.2,
                        40.0
                    );
                }
                phy.hookTarget.copy(phy.hookPos);
                if (phy.hookVel) phy.hookVel.set(0, 0, 0);

                if (b && b.x) {
                    b.x.set(phy.cargoPos.x, beamY, phy.cargoPos.z);
                    if (b.q) b.q.copy(q);
                    if (b.v) b.v.set(0, 0, 0);
                    if (b.w) b.w.set(0, 0, 0);
                    b.isRestingOnCargo = !!stsDirect;
                }

                // Snap pin attach XY onto cargo hole XY (kill residual plan offset).
                if (stsDirect && b && b.x && typeof attachWorld === 'function') {
                    let dx = 0;
                    let dz = 0;
                    let n = 0;
                    (phy.cables || []).forEach(c => {
                        if (c.role !== 'leg' || cableIsBroken(c)) return;
                        const A = attachWorld(c.a);
                        const B = attachWorld(c.b);
                        dx += B.x - A.x;
                        dz += B.z - A.z;
                        n += 1;
                    });
                    if (n > 0) {
                        b.x.x += dx / n;
                        b.x.z += dz / n;
                        phy.hookPos.x = b.x.x;
                        phy.hookPos.z = b.x.z;
                        phy.hookTarget.copy(phy.hookPos);
                    }
                    (phy.cables || []).forEach(c => {
                        if (c.role !== 'leg' || cableIsBroken(c)) return;
                        c.L0 = Math.max(0.04, Math.min(0.12, state.lowerSlingLength || 0.06));
                        c.designL0 = c.L0;
                        c.slack = false;
                    });
                    phy._stsPinsSnug = true;
                } else if (!stsDirect && b && b.x && typeof attachWorld === 'function') {
                    // Cable hang: equalize 4 lower legs + upper bridle to live spans.
                    // Uppers near-taut so the frame cannot free-fall onto the roof on unlock.
                    const legSpans = [];
                    (phy.cables || []).forEach(c => {
                        if (c.role !== 'leg' || cableIsBroken(c)) return;
                        legSpans.push({
                            c,
                            span: attachWorld(c.a).distanceTo(attachWorld(c.b))
                        });
                    });
                    let maxLeg = 0;
                    legSpans.forEach(row => { maxLeg = Math.max(maxLeg, row.span); });
                    const wantLeg = Math.max(0.8, maxLeg + 0.05);
                    legSpans.forEach(row => {
                        const c = row.c;
                        c.L0 = wantLeg;
                        c.designL0 = wantLeg;
                        c.slack = true;
                        c._j = 0;
                        const leg = state.gear && state.gear.legs && state.gear.legs[c.index];
                        if (leg) {
                            leg.lengthM = wantLeg;
                            leg.userSet = true;
                            leg.broken = false;
                        }
                        if (state.heldCableL0) {
                            if (!state.heldCableL0.leg) state.heldCableL0.leg = [];
                            state.heldCableL0.leg[c.index] = wantLeg;
                        }
                    });
                    if (legSpans.length) {
                        state.lowerSlingLength = wantLeg;
                        state.slingUserSet = true;
                        state.holdCableLength = true;
                    }

                    // Equalize upper bridle to live span (H-beam) — near-taut, not headblock-short.
                    const upSpans = [];
                    (phy.cables || []).forEach(c => {
                        if (c.role !== 'upper' || cableIsBroken(c)) return;
                        upSpans.push({
                            c,
                            span: attachWorld(c.a).distanceTo(attachWorld(c.b))
                        });
                    });
                    let maxUp = 0;
                    upSpans.forEach(row => { maxUp = Math.max(maxUp, row.span); });
                    const wantUp = Math.max(1.5, maxUp + 0.02);
                    upSpans.forEach(row => {
                        const c = row.c;
                        c.L0 = wantUp;
                        c.designL0 = wantUp;
                        c.slack = false;
                        c._j = 0;
                        const up = state.gear && state.gear.uppers && state.gear.uppers[c.index];
                        if (up) {
                            up.lengthM = wantUp;
                            up.userSet = true;
                        }
                        if (state.heldCableL0) {
                            if (!state.heldCableL0.upper) state.heldCableL0.upper = [];
                            state.heldCableL0.upper[c.index] = wantUp;
                        }
                    });
                    if (upSpans.length) {
                        state.upperSlingLength = wantUp;
                        state.slingLength = wantUp;
                    }

                    // Clear stale break holds from a prior failed take-up
                    if (Array.isArray(phy.breakHold)) {
                        for (let i = 0; i < phy.breakHold.length; i++) phy.breakHold[i] = 0;
                    }
                    phy._stsPinsSnug = false;
                    phy._stsCableTakeUp = true;
                }

                // Update mesh pose directly — do NOT call applyBeamVisuals (re-enters seed→seat).
                if (b && b.group) {
                    b.group.position.copy(b.x);
                    b.group.quaternion.copy(b.q);
                }

                const inpHookY = document.getElementById('inp-hook-y');
                if (inpHookY) inpHookY.value = phy.hookPos.y.toFixed(2);
                const numHookY = document.getElementById('num-hook-y');
                if (numHookY) numHookY.value = phy.hookPos.y.toFixed(2);
                const lblHookY = document.getElementById('val-hook-y');
                if (lblHookY) lblHookY.textContent = phy.hookPos.y.toFixed(1) + 'm';
                return true;
            } finally {
                phy._stsSeating = false;
            }
        }
        if (typeof window !== 'undefined') window.seatStsSpreaderToCargo = seatStsSpreaderToCargo;

        function syncHookToRigTaut() {
            if (!state.poseLock && (phy.groundClearance || 0) > 0.05) return;
            // Direct STS only: twistlock seat. Cable STS uses the same bridle taut path as H-beam.
            if (state.beamType === 'container_spreader'
                && typeof isStsDirectAttach === 'function' && isStsDirectAttach()) {
                seatStsSpreaderToCargo();
                return;
            }
            const spec = getRigSpec();
            const { spanX, spanZ } = getLPBoundingSpan();
            const { beamType } = state;

            let worldLugY = 0;
            let peakLugY = -1e9;
            const count = Math.max(1, state.lugs.length);
            for (let i = 0; i < state.lugs.length; i++) {
                const p = state.lugs[i].clone().applyQuaternion(phy.cargoQuat).add(phy.cargoPos);
                worldLugY += p.y;
                if (p.y > peakLugY) peakLugY = p.y;
            }
            worldLugY /= count;
            if (peakLugY < -1e8) peakLugY = (typeof supportY === 'function' ? supportY(0, 0) : 0) + (state.H || 2.6);

            let horizU = Math.max(0.35, spanX / 2);
            if (beamType === 'none') {
                const lug = spanBase();
                horizU = Math.max(0.35, Math.hypot(lug.spanX / 2, lug.spanZ / 2));
            } else if (beamType === 'basket') {
                const lug = spanBase();
                const halfX = Math.max(0.25, lug.spanX / 2);
                const halfZ = Math.max(0.20, lug.spanZ / 2);
                horizU = Math.max(0.35, Math.hypot(halfX, halfZ));
            } else if (beamType === 'frame' || (typeof customBeamMeshes !== 'undefined' && customBeamMeshes[beamType])) {
                horizU = Math.max(0.35, Math.hypot(spanX / 2, spanZ / 2));
            }

            const legCables = (phy.cables || []).filter(c => c.role === 'leg');
            const upperCables = (phy.cables || []).filter(c => c.role === 'upper');
            const hangerCables = (phy.cables || []).filter(c => c.role === 'hanger');

            let lowerDropActual = spec.lowerDrop;
            if (legCables.length) {
                lowerDropActual = 0;
                legCables.forEach(c => {
                    const hL = beamType === 'none' ? horizU : lowerPlanOffset(c.index || 0);
                    const d = Math.sqrt(Math.max(0.04, c.L0 * c.L0 - hL * hL));
                    if (d > lowerDropActual) lowerDropActual = d;
                });
            }

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

                if (beamType === 'spreader') beamStructuralSep = 0.44;
                else if (beamType === 'lifting_beam') beamStructuralSep = 0.48;
                else if (beamType === 'frame') beamStructuralSep = 0.36;
                else if (beamType === 'basket') beamStructuralSep = 0.28;
                else if (beamType === 'container_spreader') beamStructuralSep = 0.50;
                else if (beamType === 'cascaded' || beamType === 'modular_truss') {
                    let hangerDrop = spec.mast || 1.0;
                    if (hangerCables.length) {
                        hangerDrop = Math.max(...hangerCables.map(c => c.L0));
                    }
                    beamStructuralSep = 0.44 + hangerDrop;
                } else {
                    beamStructuralSep = 0.44 + (spec.mast || 0);
                }
            }

            const lugBoreY = worldLugY + 0.12;
            const tautMasterY = (beamType === 'none')
                ? (lugBoreY + lowerDropActual)
                : (lugBoreY + lowerDropActual + beamStructuralSep + upperDropActual);

            const targetHookY = THREE.MathUtils.clamp(tautMasterY - HOOK_MASTER_OFFSET_Y, 2.8, 40.0);

            phy.hookPos.y = targetHookY;
            phy.hookTarget.y = targetHookY;
            phy.hookVel.set(0, 0, 0);

            const inpHookY = document.getElementById('inp-hook-y');
            if (inpHookY) inpHookY.value = targetHookY.toFixed(2);
            const numHookY = document.getElementById('num-hook-y');
            if (numHookY) numHookY.value = targetHookY.toFixed(2);
            const lblHookY = document.getElementById('val-hook-y');
            if (lblHookY) lblHookY.textContent = targetHookY.toFixed(1) + 'm';
        }
        window.syncHookToRigTaut = syncHookToRigTaut;

        function activeCogLocal() {
            // True CoG only — broken-sling load shift is handled by the XPBD cable solver,
            // not by faking a displaced centre of mass.
            const sx = state.cogX + ((phy.oogState && phy.oogState.status === 'sliding') ? phy.oogState.localPos.x * 0.72 : 0);
            const sz = state.cogZ + ((phy.oogState && phy.oogState.status === 'sliding') ? phy.oogState.localPos.z * 0.72 : 0);
            return new THREE.Vector3(sx, state.cogY, sz);
        }

        function cargoComNow() {
            return phy.cargoPos.clone().add(activeCogLocal().applyQuaternion(phy.cargoQuat));
        }

        function writeCargoCom(com) {
            phy.cargoPos.copy(com).sub(activeCogLocal().applyQuaternion(phy.cargoQuat));
        }

        function spinQuat(q, dth, maxAng) {
            const th = dth.length();
            if (!(th > 1e-10) || !isFinite(th)) return;
            const cap = maxAng == null ? 0.35 : maxAng;
            q.premultiply(new THREE.Quaternion().setFromAxisAngle(dth.clone().multiplyScalar(1 / th), Math.min(th, cap))).normalize();
        }

        function cableIsBroken(c) {
            if (c.role === 'leg') return !!(state.gear.legs && state.gear.legs[c.index] && state.gear.legs[c.index].broken);
            if (c.role === 'upper') return !!(state.gear.uppers && state.gear.uppers[c.index] && state.gear.uppers[c.index].broken);
            if (c.role === 'hanger') return !!(state.gear.hangers && state.gear.hangers[c.index] && state.gear.hangers[c.index].broken);
            if (c.role === 'extra') return !!((state.gear.extraCables || [])[c.index] && state.gear.extraCables[c.index].broken);
            return false;
        }

        /** True while at least one lower leg can still carry the cargo. */
        function cargoHasIntactLoadLegs() {
            return (phy.cables || []).some(c =>
                c.role === 'leg'
                && !cableIsBroken(c)
                && !lowerLegIsUnloadedByTopFailure(c)
                && c.b && c.b.kind === 'cargo'
            );
        }

        /** Fused-body height of the geometric underside above the quay (m). */
        function cargoAabbClearance() {
            const H = state.H || 2.6;
            const sY = (typeof supportY === 'function')
                ? supportY(phy.cargoPos.x, phy.cargoPos.z)
                : 0;
            const bottom = phy.cargoPos.y - H * 0.5;
            return bottom - sY;
        }

        // A four-point frame is two independent top bridle branches feeding
        // their matching lower legs.  If one top branch parts, its lower leg
        // remains an intact piece of steel but it is no longer a load path:
        // the frame drops/rotates toward the cargo and that leg goes slack.
        // Treating it as a rigid hidden substitute for the severed upper leg
        // was what kept a failed corner artificially suspended.
        function lowerLegIsUnloadedByTopFailure(c) {
            return !!(c && c.role === 'leg'
                && state.beamType === 'frame'
                && state.gear && state.gear.uppers
                && state.gear.uppers[c.index]
                && state.gear.uppers[c.index].broken);
        }

        // A basket spreader begins in a convenient, symmetric presentation pose.
        // That pose is useful only while its complete rigging is intact.  Once any
        // sling parts, the bars must become ordinary rigid bodies immediately:
        // continuing to call alignBasketBars() would overwrite gravity every frame
        // and make a severed bar appear to float beside the load.
        function basketUsesKinematicPose() {
            return state.beamType === 'basket'
                && !!(phy.cables && phy.cables.length)
                && !(phy.cables || []).some(cableIsBroken);
        }

        function beamIsSuspended(b) {
            if (!b) return true;
            // Basket bars resting on the cargo (or hanging with slack uppers) are NOT suspended
            if (b.isRestingOnCargo) return false;
            // Direct STS headblock: always treated suspended so twistlock legs haul cargo.
            // Cable STS: fall through to upper-bridle check like H-beam.
            if (state.beamType === 'container_spreader'
                && typeof isStsDirectAttach === 'function' && isStsDirectAttach()) {
                return true;
            }
            const uppers = (phy.cables || []).filter(c => c.role === 'upper' && !cableIsBroken(c) && c.b && c.b.body === b);
            if (!uppers.length) return true;
            // Kinematic basket presentation: upper solver skips impulse calculation, so c.slack
            // must not gate suspension — check live span vs L0 while bar is clear of cargo roof.
            if (state.beamType === 'basket' && basketUsesKinematicPose()) {
                return uppers.some(c => {
                    const pa = attachWorld(c.a);
                    const pb = attachWorld(c.b);
                    return pa.distanceTo(pb) >= (c.L0 || 1) - 0.025;
                });
            }
            const anyTaut = uppers.some(c => {
                const pa = attachWorld(c.a);
                const pb = attachWorld(c.b);
                const chord = pa.distanceTo(pb);
                return !c.slack && (c._j > 1e-4 || chord >= (c.L0 || 1) - 0.02);
            });
            return anyTaut;
        }

        /** STS headblock/trolley heading — no free hook-block swivel. */
        function stsLockedYawRad() {
            if (phy._stsYawLockRad == null || !isFinite(phy._stsYawLockRad)) {
                phy._stsYawLockRad = THREE.MathUtils.degToRad(nominalSpreaderYawDeg());
            }
            return phy._stsYawLockRad;
        }

        /** Soft-blend a body's quaternion yaw toward trolley heading (no hard snap → no giật). */
        function softLockYawQuat(q, wantYaw, maxLean, blend) {
            if (!q) return;
            const e = new THREE.Euler().setFromQuaternion(q, 'YXZ');
            let dy = wantYaw - e.y;
            while (dy > Math.PI) dy -= Math.PI * 2;
            while (dy < -Math.PI) dy += Math.PI * 2;
            const k = THREE.MathUtils.clamp(blend != null ? blend : 0.22, 0.05, 1);
            e.y += dy * k;
            e.x = THREE.MathUtils.clamp(e.x, -maxLean, maxLean);
            e.z = THREE.MathUtils.clamp(e.z, -maxLean, maxLean);
            q.setFromEuler(e);
        }

        /**
         * STS can sway (pitch/roll) but must not spin about vertical like a hook.
         * Soft-locks yaw of spreader + cargo to the trolley heading.
         */
        function constrainStsSpreaderYaw(dt) {
            if (state.beamType !== 'container_spreader') return;
            const want = stsLockedYawRad();
            const damp = Math.exp(-(dt || 0.016) * 8.0);
            // Headblock stays level — asymmetric twin/cut load lists the cargo, not the yellow beam.
            const blend = Math.min(1, 18.0 * (dt || 0.016));
            if (phy.cargoOmega) {
                phy.cargoOmega.y *= damp;
                if (Math.abs(phy.cargoOmega.y) < 0.015) phy.cargoOmega.y = 0;
            }
            softLockYawQuat(phy.cargoQuat, want, 0.12, 0.18);
            (phy.beams || []).forEach(b => {
                if (!b || !b.q) return;
                if (b.w) {
                    b.w.x *= Math.exp(-(dt || 0.016) * 22);
                    b.w.y *= damp;
                    b.w.z *= Math.exp(-(dt || 0.016) * 22);
                    if (Math.abs(b.w.y) < 0.015) b.w.y = 0;
                    if (Math.abs(b.w.x) < 0.02) b.w.x = 0;
                    if (Math.abs(b.w.z) < 0.02) b.w.z = 0;
                }
                softLockYawQuat(b.q, want, 0.06, 0.16);
                const e = new THREE.Euler().setFromQuaternion(b.q, 'YXZ');
                e.x *= (1 - blend);
                e.z *= (1 - blend);
                if (Math.abs(e.x) < 0.012) e.x = 0;
                if (Math.abs(e.z) < 0.012) e.z = 0;
                e.y = want;
                b.q.setFromEuler(e);
            });
        }

        /**
         * Twin-lift + outer-only cable was retired: real STS twin uses 8 twistlocks
         * (incl. mid-junction). Outer-cable “bửa ra” is not an offered mode anymore.
         * Kept as a permanent false so flare/step paths stay inert.
         */
        function stsTwinCableMode() {
            return false;
        }

        function twinTwentyLayout() {
            const cL = 6.058;
            const gap = 0.076;
            const halfSep = (cL + gap) * 0.5;
            const holes = (typeof isoCornerHoleHalf === 'function')
                ? isoCornerHoleHalf(state.L || 12.192, state.W || 2.438)
                : { hx: 5.9925, hz: 1.1295 };
            const H = state.H || 2.591;
            return {
                cL,
                gap,
                halfSep,
                hx: holes.hx,
                hz: holes.hz,
                lugY: H * 0.5
            };
        }

        function ensureTwinCableFlareState() {
            if (!phy.twinCableFlare) {
                phy.twinCableFlare = {
                    pitchA: 0,
                    pitchB: 0,
                    // Extra junction opening beyond the nominal 76 mm twin gap (m).
                    // Locked by ground friction at the inner corners when the pair pries open.
                    sepExtra: 0,
                    peakSep: 0,
                    peakPitch: 0,
                    warned: false,
                    gapWarned: false,
                    active: false
                };
            }
            const st = phy.twinCableFlare;
            if (st.sepExtra == null) st.sepExtra = 0;
            if (st.peakSep == null) st.peakSep = 0;
            if (st.peakPitch == null) st.peakPitch = 0;
            if (st.gapWarned == null) st.gapWarned = false;
            return st;
        }

        /**
         * Per-20ft CoG offset in that half's local frame (origin = geometric centre).
         * Twin-lift: each box has its OWN mass centre — never one fused assembly CoG.
         * state.cogX/Y/Z = same relative offset inside each 20ft (ISO default ≈ 0).
         */
        function twinHalfLocalCog(layout) {
            const lay = layout || twinTwentyLayout();
            const halfW = (state.W || 2.438) * 0.45;
            return new THREE.Vector3(
                THREE.MathUtils.clamp(state.cogX || 0, -lay.cL * 0.45, lay.cL * 0.45),
                state.cogY || 0,
                THREE.MathUtils.clamp(state.cogZ || 0, -halfW, halfW)
            );
        }

        /** Outer cable pick → that half's CoG lever (m). CoG toward junction → longer pry arm. */
        function twinOuterToCogLever(layout) {
            const lay = layout || twinTwentyLayout();
            const cx = twinHalfLocalCog(lay).x;
            return Math.max(0.55, lay.hx - lay.halfSep + cx);
        }

        /** Target pry angle (rad) from unsupported mid-span — grows with lift-off. */
        function twinCableFlareTargetPitch(clearanceM) {
            const layout = twinTwentyLayout();
            const lever = twinOuterToCogLever(layout); // each box tips about its outer pick around its own CoG
            const rise = Math.max(0, clearanceM || 0);
            // Light lift → small pry; full hoist → strong open (biến thiên theo độ cao).
            const raw = Math.atan2(rise * 1.25, lever);
            return THREE.MathUtils.clamp(raw, 0, 1.05);
        }

        function makeTwinCogMarker(name, color) {
            const g = new THREE.Group();
            g.name = name;
            const sphere = new THREE.Mesh(
                new THREE.SphereGeometry(0.14, 18, 18),
                new THREE.MeshBasicMaterial({ color: color, depthTest: false })
            );
            sphere.renderOrder = 999;
            sphere.name = name + '_Sphere';
            const ring = new THREE.Mesh(
                new THREE.RingGeometry(0.18, 0.24, 24),
                new THREE.MeshBasicMaterial({ color: 0xef4444, side: THREE.DoubleSide, depthTest: false })
            );
            ring.renderOrder = 999;
            const drop = new THREE.Line(
                new THREE.BufferGeometry().setFromPoints([
                    new THREE.Vector3(0, -1.6, 0),
                    new THREE.Vector3(0, 1.6, 0)
                ]),
                new THREE.LineBasicMaterial({ color: color, depthTest: false })
            );
            drop.renderOrder = 998;
            g.add(sphere, ring, drop);
            g.userData.twinCog = true;
            return g;
        }

        /** Attach / sync one CoG gizmo per 20ft so each tips about its own mass centre. */
        function ensureTwinCogMarkers() {
            if (!activeCargoVisual) return null;
            const boxA = activeCargoVisual.getObjectByName('Twin_20ft_A');
            const boxB = activeCargoVisual.getObjectByName('Twin_20ft_B');
            if (!boxA || !boxB) return null;
            let mA = boxA.getObjectByName('Twin_CoG_A');
            let mB = boxB.getObjectByName('Twin_CoG_B');
            if (!mA) {
                mA = makeTwinCogMarker('Twin_CoG_A', 0xfacc15);
                boxA.add(mA);
            }
            if (!mB) {
                mB = makeTwinCogMarker('Twin_CoG_B', 0xfbbf24);
                boxB.add(mB);
            }
            const local = twinHalfLocalCog();
            mA.position.copy(local);
            mB.position.copy(local);
            const show = !(state.displayOptions && state.displayOptions.showCoG === false)
                && state.showCoGLabel !== false;
            mA.visible = show;
            mB.visible = show;
            // Fused single CoG is wrong for twin — hide while dual markers are live
            if (typeof cogIndicatorGroup !== 'undefined' && cogIndicatorGroup) {
                cogIndicatorGroup.visible = false;
            }
            return { mA, mB, local };
        }

        function clearTwinCogMarkers() {
            if (!activeCargoVisual) return;
            ['Twin_20ft_A', 'Twin_20ft_B'].forEach(n => {
                const box = activeCargoVisual.getObjectByName(n);
                if (!box) return;
                ['Twin_CoG_A', 'Twin_CoG_B'].forEach(cn => {
                    const m = box.getObjectByName(cn);
                    if (m) box.remove(m);
                });
            });
        }
        if (typeof window !== 'undefined') {
            window.ensureTwinCogMarkers = ensureTwinCogMarkers;
            window.twinHalfLocalCog = twinHalfLocalCog;
            window.twinOuterToCogLever = twinOuterToCogLever;
        }

        /**
         * How far one half's inner bottom toe walks outward when pitched about the
         * outer cable pick. Both halves → total junction gap increase ≈ 2× this.
         */
        function twinCableInnerBottomOutward(pitchRad, layout) {
            const a = Math.max(0, pitchRad || 0);
            if (!(a > 1e-6)) return 0;
            const innerX0 = (layout.gap || 0.076) * 0.5; // +X box inner face at rest
            const botY0 = -(layout.lugY || 1.3);
            const pivotX = layout.hx;
            const pivotY = layout.lugY;
            const dx = innerX0 - pivotX;
            const dy = botY0 - pivotY;
            const nx = pivotX + dx * Math.cos(a) - dy * Math.sin(a);
            return Math.max(0, nx - innerX0);
        }

        function twinCableGeometricSep(pitchRad, layout) {
            return 2 * twinCableInnerBottomOutward(pitchRad, layout || twinTwentyLayout());
        }

        /** Friction retain [0..1] + creep (m/s): heavier + steeper contact → less slide-back. */
        function twinCableFrictionParams(peakPitchRad, weightT) {
            const ang = Math.sin(THREE.MathUtils.clamp(peakPitchRad || 0, 0, 1.05));
            const wF = THREE.MathUtils.clamp((weightT || 40) / 40, 0.35, 1.8);
            // After first toe scrape, keep most of the opened gap (realistic set-down).
            const retain = THREE.MathUtils.clamp(0.72 + 0.22 * ang + 0.10 * Math.min(1.25, wF), 0.78, 0.97);
            const creep = (0.07 / Math.max(0.45, wF)) * (1.15 - 0.80 * ang);
            return { retain, creep, ang, wF };
        }

        /**
         * Pose of one 20ft half in cargo-root frame.
         * side +1 = Twin_20ft_B (+X), −1 = Twin_20ft_A (−X).
         */
        function twinHalfPose(side, pitchAbs, sepExtra, layout) {
            const lay = layout || twinTwentyLayout();
            const a = (side >= 0 ? 1 : -1) * Math.max(0, pitchAbs || 0);
            // Always apply drag-open sepExtra — old blend→0 at high pitch hid the gap
            // so fully lifted twins looked “quá gần” vs reality.
            const halfOut = lay.halfSep + 0.5 * Math.max(0, sepExtra || 0);
            const restX = (side >= 0 ? 1 : -1) * halfOut;
            const pivotX = (side >= 0 ? 1 : -1) * lay.hx;
            const lugY = lay.lugY;
            if (!(Math.abs(a) > 1e-5)) {
                return { x: restX, y: 0, z: 0, rotZ: 0 };
            }
            const cos = Math.cos(a);
            const sin = Math.sin(a);
            const dx = restX - pivotX;
            const dy = 0 - lugY;
            return {
                x: pivotX + dx * cos - dy * sin,
                y: lugY + dx * sin + dy * cos,
                z: 0,
                rotZ: a
            };
        }

        function twinHalfMatrix(side, pitchAbs, sepExtra, layout) {
            const p = twinHalfPose(side, pitchAbs, sepExtra, layout);
            const m = new THREE.Matrix4();
            m.makeRotationZ(p.rotZ);
            m.setPosition(p.x, p.y, p.z);
            return m;
        }

        /**
         * Place one 20ft half so it pivots about its outer top casting (cable pick),
         * dropping the inner end toward the twin junction.
         */
        function placeTwinHalfAboutOuterPivot(box, restX, pivotX, pitchRad, lugY) {
            if (!box) return;
            const a = pitchRad || 0;
            if (!(Math.abs(a) > 1e-5)) {
                box.position.set(restX, 0, 0);
                box.rotation.set(0, 0, 0);
                return;
            }
            const cos = Math.cos(a);
            const sin = Math.sin(a);
            const dx = restX - pivotX;
            const dy = 0 - lugY;
            box.position.set(
                pivotX + dx * cos - dy * sin,
                lugY + dx * sin + dy * cos,
                0
            );
            box.rotation.set(0, 0, a);
        }

        function resetStsTwinCableFlareVisual() {
            if (!activeCargoVisual) return;
            const a = activeCargoVisual.getObjectByName('Twin_20ft_A');
            const b = activeCargoVisual.getObjectByName('Twin_20ft_B');
            const layout = twinTwentyLayout();
            const st = phy.twinCableFlare;
            const halfOut = layout.halfSep + 0.5 * Math.max(0, (st && st.sepExtra) || 0);
            if (a) {
                a.position.set(-halfOut, 0, 0);
                a.rotation.set(0, 0, 0);
            }
            if (b) {
                b.position.set(halfOut, 0, 0);
                b.rotation.set(0, 0, 0);
            }
        }

        function clearStsTwinCableFlareState() {
            const st = ensureTwinCableFlareState();
            st.pitchA = 0;
            st.pitchB = 0;
            st.sepExtra = 0;
            st.peakSep = 0;
            st.peakPitch = 0;
            st.targetSmooth = 0;
            st._lugKey = '';
            st._slideLocked = false;
            st._slideBudget = 0;
            st.warned = false;
            st.gapWarned = false;
            resetStsTwinCableFlareVisual();
            st.active = false;
            clearTwinFallenHalves();
        }

        /** Lug indices on each twin 20ft: A (−X)=1,2 ; B (+X)=0,3 */
        function twinHalfLegIndices(side) {
            return side < 0 ? [1, 2] : [0, 3];
        }

        function twinHalfFullyCut(side) {
            return twinHalfLegIndices(side).every(idx => {
                const c = (phy.cables || []).find(x => x.role === 'leg' && x.index === idx);
                return !c || cableIsBroken(c);
            });
        }

        function clearTwinFallenHalves() {
            const fallen = phy.twinFallen;
            if (!fallen) return;
            ['A', 'B'].forEach(key => {
                const h = fallen[key];
                if (!h || !h.mesh) return;
                // Re-attach under cargo visual if still orphaned in the scene
                if (activeCargoVisual && h.mesh.parent !== activeCargoVisual) {
                    try {
                        activeCargoVisual.attach(h.mesh);
                    } catch (e) { /* ignore */ }
                }
                h.mesh.visible = true;
            });
            phy.twinFallen = { A: null, B: null };
            phy.effectiveCargoWeightT = null;
        }

        /**
         * When both outer legs of one twin 20ft are cut, that half becomes a free
         * rigid body and falls under gravity (fused twin would otherwise hover).
         */
        function detachTwinHalfIfCut(side) {
            if (!stsTwinCableMode() || !twinHalfFullyCut(side)) return false;
            if (!phy.twinFallen) phy.twinFallen = { A: null, B: null };
            const key = side < 0 ? 'A' : 'B';
            if (phy.twinFallen[key]) return false;
            const name = side < 0 ? 'Twin_20ft_A' : 'Twin_20ft_B';
            const box = activeCargoVisual && activeCargoVisual.getObjectByName(name);
            if (!box) return false;

            const layout = twinTwentyLayout();
            const st = phy.twinCableFlare || {};
            const pitch = Math.max(st.pitchA || 0, st.pitchB || 0);
            const localPose = twinHalfPose(side, pitch, st.sepExtra || 0, layout);
            // Prefer physics COM + flared half local — mesh matrixWorld is often stale
            // (headless / before visual sync), which left cut halves "lơ lửng" at ground height.
            const pos = new THREE.Vector3(localPose.x, localPose.y, localPose.z)
                .applyQuaternion(phy.cargoQuat || new THREE.Quaternion())
                .add(phy.cargoPos);
            const quat = (phy.cargoQuat || new THREE.Quaternion()).clone().multiply(
                new THREE.Quaternion().setFromAxisAngle(
                    new THREE.Vector3(0, 0, 1),
                    localPose.rotZ || 0
                )
            );

            if (typeof scene !== 'undefined' && scene && box.parent) {
                try { scene.attach(box); } catch (e) { /* keep parent */ }
            }
            box.position.copy(pos);
            box.quaternion.copy(quat);
            box.updateMatrixWorld(true);

            const H = state.H || 2.591;
            const W = state.W || 2.438;
            const halfMassKg = Math.max(800, ((state.weight || 40) * 1000) * 0.48);
            const v0 = (phy.cargoVel || new THREE.Vector3()).clone();
            v0.y = Math.min(v0.y, -1.6);
            // Tip the unsupported inner edge outward as it drops
            const w0 = (phy.cargoOmega || new THREE.Vector3()).clone().multiplyScalar(0.35);
            w0.z += (side < 0 ? -0.55 : 0.55);

            const lugLocal = {};
            const hole20 = (typeof isoCornerHoleHalf === 'function')
                ? isoCornerHoleHalf(layout.cL, W)
                : { hx: layout.cL * 0.5 - 0.1, hz: W * 0.5 - 0.1 };
            twinHalfLegIndices(side).forEach(idx => {
                const sx = (idx === 0 || idx === 3) ? 1 : -1;
                const sz = (idx === 0 || idx === 1) ? 1 : -1;
                // Corner hole in half-local (box centre = origin)
                lugLocal[idx] = new THREE.Vector3(
                    sx * (hole20.hx != null ? hole20.hx : layout.cL * 0.48),
                    H * 0.5,
                    sz * (hole20.hz != null ? hole20.hz : W * 0.48)
                );
                // Ensure cut stubs exist so remnants hang (not a frozen straight line).
                const c = (phy.cables || []).find(x => x.role === 'leg' && x.index === idx);
                if (c && typeof ensureCableBreakState === 'function') ensureCableBreakState(c);
            });

            phy.twinFallen[key] = {
                side,
                mesh: box,
                x: pos.clone(),
                q: quat.clone(),
                v: v0,
                w: w0,
                half: { hx: layout.cL * 0.5, hy: H * 0.5, hz: W * 0.5 },
                lugLocal,
                massKg: halfMassKg,
                grounded: false
            };
            const baseW = phy.effectiveCargoWeightT != null ? phy.effectiveCargoWeightT : (state.weight || 40);
            phy.effectiveCargoWeightT = Math.max(4, baseW * 0.52);
            if (phy.twinCableFlare) {
                if (side < 0) phy.twinCableFlare.pitchA = 0;
                else phy.twinCableFlare.pitchB = 0;
            }
            state.poseLock = false;
            phy.rigLive = true;
            return true;
        }

        function checkTwinHalfDetachment() {
            if (!stsTwinCableMode()) return;
            const aCut = detachTwinHalfIfCut(-1);
            const bCut = detachTwinHalfIfCut(1);
            if ((aCut || bCut) && typeof syncPoseLockUI === 'function') syncPoseLockUI();
        }

        function stepTwinFallenHalves(frameDt) {
            const fallen = phy.twinFallen;
            if (!fallen) return;
            const dt = Math.max(1e-4, frameDt || 0.016);
            ['A', 'B'].forEach(key => {
                const h = fallen[key];
                if (!h || !h.x) return;
                if (h.grounded) {
                    if (h.mesh) {
                        h.mesh.position.copy(h.x);
                        h.mesh.quaternion.copy(h.q);
                    }
                    return;
                }
                h.v.y -= G_EARTH * dt;
                h.v.x *= Math.exp(-dt * 0.35);
                h.v.z *= Math.exp(-dt * 0.35);
                h.w.multiplyScalar(Math.exp(-dt * 1.5));
                if (h.v.length() > 18) h.v.setLength(18);
                if (h.w.length() > 4) h.w.setLength(4);
                h.x.addScaledVector(h.v, dt);
                const wLen = h.w.length();
                if (wLen > 1e-6) {
                    h.q.premultiply(
                        new THREE.Quaternion().setFromAxisAngle(h.w.clone().multiplyScalar(1 / wLen), wLen * dt)
                    ).normalize();
                }
                let minGap = Infinity;
                [-1, 1].forEach(sx => [-1, 1].forEach(sy => [-1, 1].forEach(sz => {
                    const wpt = new THREE.Vector3(
                        sx * h.half.hx, sy * h.half.hy, sz * h.half.hz
                    ).applyQuaternion(h.q).add(h.x);
                    const gap = wpt.y - ((typeof supportY === 'function') ? supportY(wpt.x, wpt.z) : 0);
                    if (gap < minGap) minGap = gap;
                })));
                if (minGap < 0.02) {
                    if (minGap < 0) h.x.y -= minGap;
                    if (h.v.y < 0) h.v.y *= -0.08;
                    h.v.x *= 0.42;
                    h.v.z *= 0.42;
                    h.w.multiplyScalar(0.28);
                    // Flatten onto quay once toes plant — cut half must not hover on a tip.
                    if (minGap < 0.04 && h.v.length() < 1.8) {
                        const e = new THREE.Euler().setFromQuaternion(h.q, 'YXZ');
                        e.x *= 0.72;
                        e.z *= 0.72;
                        if (Math.abs(e.x) < 0.08) e.x = 0;
                        if (Math.abs(e.z) < 0.08) e.z = 0;
                        h.q.setFromEuler(e);
                        // Re-seat after flatten
                        let gap2 = Infinity;
                        [-1, 1].forEach(sx => [-1, 1].forEach(sy => [-1, 1].forEach(sz => {
                            const wpt = new THREE.Vector3(
                                sx * h.half.hx, sy * h.half.hy, sz * h.half.hz
                            ).applyQuaternion(h.q).add(h.x);
                            const gap = wpt.y - ((typeof supportY === 'function') ? supportY(wpt.x, wpt.z) : 0);
                            if (gap < gap2) gap2 = gap;
                        })));
                        if (gap2 < 0) h.x.y -= gap2;
                    }
                    if (Math.abs(h.v.y) < 0.45 && h.v.length() < 0.7) {
                        h.v.set(0, 0, 0);
                        h.w.set(0, 0, 0);
                        h.grounded = true;
                    }
                }
                if (h.mesh) {
                    h.mesh.position.copy(h.x);
                    h.mesh.quaternion.copy(h.q);
                    h.mesh.visible = true;
                }
            });
        }

        function applyStsTwinCableFlareVisual() {
            const st = ensureTwinCableFlareState();
            if (!stsTwinCableMode() || !activeCargoVisual) {
                if (st.active) {
                    st.sepExtra = 0;
                    st.peakSep = 0;
                    st.peakPitch = 0;
                    resetStsTwinCableFlareVisual();
                    st.active = false;
                    st.pitchA = 0;
                    st.pitchB = 0;
                }
                clearTwinCogMarkers();
                return;
            }
            const fallen = phy.twinFallen || {};
            const layout = twinTwentyLayout();
            const boxA = activeCargoVisual.getObjectByName('Twin_20ft_A');
            const boxB = activeCargoVisual.getObjectByName('Twin_20ft_B');
            const pitch = Math.max(st.pitchA || 0, st.pitchB || 0);
            const poseA = twinHalfPose(-1, pitch, st.sepExtra || 0, layout);
            const poseB = twinHalfPose(1, pitch, st.sepExtra || 0, layout);
            // Detached halves are free bodies — do not overwrite their world pose.
            if (boxA && !fallen.A) {
                boxA.position.set(poseA.x, poseA.y, poseA.z);
                boxA.rotation.set(0, 0, poseA.rotZ);
            }
            if (boxB && !fallen.B) {
                boxB.position.set(poseB.x, poseB.y, poseB.z);
                boxB.rotation.set(0, 0, poseB.rotZ);
            }
            // Each 20ft carries its own CoG — tips about outer pick when mid is unsupported
            ensureTwinCogMarkers();
            st.active = true;
        }

        /**
         * Move cargo-local lug points onto the actual outer castings of each
         * flared / separated 20ft — otherwise cables stay glued to the fused envelope.
         */
        function syncTwinCableLugsFromFlare() {
            if (!stsTwinCableMode() || !state.lugs || state.lugs.length < 4) return;
            const st = ensureTwinCableFlareState();
            const layout = twinTwentyLayout();
            const pitch = Math.max(st.pitchA || 0, st.pitchB || 0);
            const hole20 = (typeof isoCornerHoleHalf === 'function')
                ? isoCornerHoleHalf(layout.cL, state.W || 2.438)
                : { hx: 2.9265, hz: layout.hz };
            const matA = twinHalfMatrix(-1, pitch, st.sepExtra || 0, layout);
            const matB = twinHalfMatrix(1, pitch, st.sepExtra || 0, layout);
            // Lug signs: 0 (+X+Z) B, 1 (−X+Z) A, 2 (−X−Z) A, 3 (+X−Z) B
            const map = [
                { side: 1, sx: 1, sz: 1 },
                { side: -1, sx: -1, sz: 1 },
                { side: -1, sx: -1, sz: -1 },
                { side: 1, sx: 1, sz: -1 }
            ];
            const fallen = phy.twinFallen || {};
            for (let i = 0; i < 4; i++) {
                const m = map[i];
                // Fallen half owns its lugs via attachWorld — don't glue them to the fused envelope.
                if ((m.side < 0 && fallen.A) || (m.side > 0 && fallen.B)) continue;
                const mat = m.side > 0 ? matB : matA;
                const local = new THREE.Vector3(
                    m.sx * hole20.hx,
                    layout.lugY,
                    m.sz * (hole20.hz != null ? hole20.hz : layout.hz)
                );
                local.applyMatrix4(mat);
                if (!state.lugs[i]) state.lugs[i] = new THREE.Vector3();
                state.lugs[i].copy(local);
                if (state.lugNormals && state.lugNormals[i]) {
                    // Approximate top-face normal after half pitch
                    const n = new THREE.Vector3(0, 1, 0);
                    const q = new THREE.Quaternion().setFromAxisAngle(
                        new THREE.Vector3(0, 0, 1),
                        m.side > 0 ? pitch : -pitch
                    );
                    n.applyQuaternion(q).normalize();
                    state.lugNormals[i].copy(n);
                }
            }
        }

        /** Contact samples for seating / XPBD: real twin-half corners, not fused AABB. */
        function twinCableContactLocals() {
            const st = ensureTwinCableFlareState();
            const layout = twinTwentyLayout();
            const pitch = Math.max(st.pitchA || 0, st.pitchB || 0);
            const H = state.H || layout.lugY * 2;
            const W = state.W || 2.438;
            const fallen = phy.twinFallen || {};
            const pts = [];
            [-1, 1].forEach(side => {
                if ((side < 0 && fallen.A) || (side > 0 && fallen.B)) return;
                const mat = twinHalfMatrix(side, pitch, st.sepExtra || 0, layout);
                [-1, 1].forEach(lx => [-1, 1].forEach(ly => [-1, 1].forEach(lz => {
                    pts.push(new THREE.Vector3(
                        lx * layout.cL * 0.5,
                        ly * H * 0.5,
                        lz * W * 0.5
                    ).applyMatrix4(mat));
                })));
            });
            return pts;
        }

        /** Junction-end bottom toes in cargo-local (nothing lifts these — they must drag). */
        function twinInnerBottomLocals(pitchAbs, sepExtra, layout) {
            const lay = layout || twinTwentyLayout();
            const H = state.H || lay.lugY * 2;
            const W = state.W || 2.438;
            const fallen = phy.twinFallen || {};
            const pts = [];
            [-1, 1].forEach(side => {
                if ((side < 0 && fallen.A) || (side > 0 && fallen.B)) return;
                const mat = twinHalfMatrix(side, pitchAbs, sepExtra || 0, lay);
                // Inner face of each 20ft faces the twin junction
                const innerX = -side * lay.cL * 0.5;
                [-1, 1].forEach(sz => {
                    pts.push(new THREE.Vector3(innerX, -H * 0.5, sz * W * 0.5).applyMatrix4(mat));
                });
            });
            return pts;
        }

        function twinInnerBottomWorldMinY(pitchAbs, sepExtra, layout) {
            let minY = Infinity;
            twinInnerBottomLocals(pitchAbs, sepExtra, layout).forEach(pLoc => {
                const w = pLoc.clone().applyQuaternion(phy.cargoQuat).add(phy.cargoPos);
                if (w.y < minY) minY = w.y;
            });
            return minY;
        }

        /**
         * Pitch that keeps junction toes on the quay for the current cargoPos.
         * Outer cables may rise; the middle has no pick — it stays planted and drags.
         */
        function twinPitchToPlantInner(sepExtra, layout) {
            const lay = layout || twinTwentyLayout();
            const sY = (typeof supportY === 'function')
                ? supportY(phy.cargoPos.x, phy.cargoPos.z)
                : 0;
            let lo = 0;
            let hi = 1.05;
            // If already below ground at pitch 0, no pry needed for plant
            if (twinInnerBottomWorldMinY(0, sepExtra, lay) <= sY + 0.01) return 0;
            for (let i = 0; i < 16; i++) {
                const mid = (lo + hi) * 0.5;
                const y = twinInnerBottomWorldMinY(mid, sepExtra, lay);
                if (y > sY + 0.004) lo = mid; // still floating → pry more
                else hi = mid;
            }
            return (lo + hi) * 0.5;
        }

        /**
         * Only fix penetration (toes below quay). Floating is fixed by increasing pitch —
         * dropping cargoPos would collapse the pry and lift the middle off the ground again.
         */
        /** True when at least one lower leg is geometrically taking load (not slack). */
        function stsLegsGeometricallyTaut(eps) {
            const tol = eps != null ? eps : 0.02;
            return (phy.cables || []).some(c => {
                if (c.role !== 'leg' || cableIsBroken(c) || !c.a || !c.b) return false;
                const span = attachWorld(c.a).distanceTo(attachWorld(c.b));
                return span >= (c.L0 || 1) - tol;
            });
        }

        function clampTwinInnerToesPenetration(pitchAbs, sepExtra, layout) {
            const lay = layout || twinTwentyLayout();
            const sY = (typeof supportY === 'function')
                ? supportY(phy.cargoPos.x, phy.cargoPos.z)
                : 0;
            const minY = twinInnerBottomWorldMinY(pitchAbs, sepExtra, lay);
            if (!isFinite(minY)) return false;
            if (minY < sY - 0.008) {
                // Never plant-shove the fused body into the air while legs are still slack —
                // that looked like “cáp chưa căng mà cont đã vống”.
                if (!stsLegsGeometricallyTaut(0.03) && (phy.groundClearance || 0) < 0.06) {
                    return false;
                }
                phy.cargoPos.y += (sY - minY);
                // Plant shove must not rebound the fused body upward (nẩy).
                if (phy.cargoVel) {
                    if (phy.cargoVel.y > 0.04) phy.cargoVel.y = 0.04;
                    phy.cargoVel.x *= 0.92;
                    phy.cargoVel.z *= 0.92;
                }
                if (phy.cargoOmega) phy.cargoOmega.multiplyScalar(0.88);
                return true;
            }
            return Math.abs(minY - sY) <= 0.04;
        }

        function stepStsTwinCableFlare(frameDt) {
            const st = ensureTwinCableFlareState();
            if (!stsTwinCableMode()) {
                if (st.pitchA || st.pitchB || st.active || st.sepExtra || st.peakSep) {
                    clearStsTwinCableFlareState();
                }
                return;
            }
            const dt = Math.max(1e-4, frameDt || 0.016);
            const clearance = phy.groundClearance || 0;
            const grounded = !!state.poseLock || clearance <= 0.04;
            const lowering = (phy.hoistSpeed || 0) < -0.01
                || (phy.hookVel && phy.hookVel.y < -0.02);
            // No intact load path (all legs cut) → drop plant pitch; gravity owns the fall.
            if (!cargoHasIntactLoadLegs()) {
                st.pitchA = 0;
                st.pitchB = 0;
                st.targetSmooth = 0;
                st.planted = false;
                st.active = (st.sepExtra || 0) > 0.02;
                applyStsTwinCableFlareVisual();
                return;
            }

            // HARD RULE: outer ends may only pry open while lower legs are
            // geometrically taut. Hoist button / clearance alone must NOT open the V
            // (that produced “cáp xệ mà cont đã ngoác”).
            const legsTaut = stsLegsGeometricallyTaut(0.02);
            const hoistUp = (typeof isHoistRising === 'function')
                ? isHoistRising()
                : ((phy.hoistSpeed || 0) > 0.01
                    || (phy.autoHoistActive && phy.hookTarget && phy.hookPos && phy.hookTarget.y > phy.hookPos.y + 0.02)
                    || (phy.hookVel && phy.hookVel.y > 0.02));
            const lifting = legsTaut && (hoistUp || (clearance > 0.02 && !lowering));
            const layout = twinTwentyLayout();
            const prevPitch = Math.max(st.pitchA || 0, st.pitchB || 0);
            const sY = (typeof supportY === 'function')
                ? supportY(phy.cargoPos.x, phy.cargoPos.z)
                : 0;

            // Middle has no cable — pry only under real outer-cable haul.
            // Gap scales with lift height once legs are taut.
            let target;
            if (!legsTaut) {
                // Slack / not yet picking: gravity collapses any false V immediately.
                if (lowering && clearance < 0.14 && prevPitch > 0.02) {
                    target = Math.max(0, prevPitch * (clearance < 0.05 ? 0.52 : 0.76));
                } else {
                    target = 0;
                }
            } else if (grounded && !lifting) {
                target = 0;
            } else if (lowering && clearance < 0.14) {
                // First corner down → collapse pitch; hold opened gap (short scrape then lock).
                target = Math.max(0, prevPitch * (clearance < 0.05 ? 0.52 : 0.76));
            } else {
                const plantPitch = twinPitchToPlantInner(st.sepExtra || 0, layout);
                const risePitch = twinCableFlareTargetPitch(Math.max(0.02, clearance));
                // Outer haul opens the V; plantPitch keeps junction toes on the quay while dragging.
                target = THREE.MathUtils.clamp(Math.max(plantPitch, risePitch), 0, 1.05);
            }

            // Smooth target to kill frame-to-frame plant-solve chatter (giật / nẩy)
            // Collapse faster when legs go slack so we don't leave a flying V on soft ropes.
            const trackRate = legsTaut ? 2.2 : 7.0;
            st.targetSmooth = (st.targetSmooth == null)
                ? target
                : THREE.MathUtils.lerp(st.targetSmooth, target, Math.min(1, trackRate * dt));
            const k = Math.min(1, (legsTaut ? 2.6 : 8.0) * dt);
            let dA = (st.targetSmooth - st.pitchA) * k;
            let dB = (st.targetSmooth - st.pitchB) * k;
            const maxPitchStep = (legsTaut ? 0.035 : 0.12) * (dt / (1 / 60));
            dA = THREE.MathUtils.clamp(dA, -maxPitchStep, maxPitchStep);
            dB = THREE.MathUtils.clamp(dB, -maxPitchStep, maxPitchStep);
            st.pitchA += dA;
            st.pitchB += dB;
            if (st.pitchA < 1e-4) st.pitchA = 0;
            if (st.pitchB < 1e-4) st.pitchB = 0;
            let pitch = Math.max(st.pitchA, st.pitchB);

            // Soft chase plant pitch if toes float — only while legs haul.
            if (legsTaut && lifting && !(grounded && !lifting)) {
                const toeY = twinInnerBottomWorldMinY(pitch, st.sepExtra || 0, layout);
                if (toeY > sY + 0.03) {
                    const need = twinPitchToPlantInner(st.sepExtra || 0, layout);
                    const chase = Math.min(1, 2.4 * dt);
                    st.pitchA = THREE.MathUtils.lerp(st.pitchA, Math.max(st.pitchA, need), chase);
                    st.pitchB = THREE.MathUtils.lerp(st.pitchB, Math.max(st.pitchB, need), chase);
                    pitch = Math.max(st.pitchA, st.pitchB);
                }
            }
            // Plant shove only under taut outer haul — never from a slack-cable pose.
            if (legsTaut) {
                clampTwinInnerToesPenetration(pitch, st.sepExtra || 0, layout);
            }

            const toeY2 = twinInnerBottomWorldMinY(pitch, st.sepExtra || 0, layout);
            st.planted = pitch > 0.04 && toeY2 <= sY + 0.06;
            st.peakPitch = Math.max(st.peakPitch || 0, pitch);

            // Drag: toes scrape outward → geometric sep; friction locks the peak.
            // Extra open with height so full hoist “ngoác nhiều” hơn nhấc nhẹ.
            const geomSep = twinCableGeometricSep(pitch, layout);
            const heightOpen = clearance > 0.12
                ? THREE.MathUtils.clamp((clearance - 0.12) * 0.32, 0, 0.70)
                : 0;
            const wantSep = geomSep + heightOpen;
            const innerPlanted = st.planted || pitch > 0.04;
            const sepCap = 2.2;
            if (innerPlanted || pitch >= prevPitch) {
                st.peakSep = Math.min(sepCap, Math.max(st.peakSep || 0, wantSep));
            }
            const weightT = Math.max(1,
                phy.effectiveCargoWeightT != null ? phy.effectiveCargoWeightT : (state.weight || 40)
            );
            const fr = twinCableFrictionParams(st.peakPitch || pitch, weightT);
            const floorSep = (st.peakSep || 0) * fr.retain;

            // Lower touchdown: brief light scrape, then hold residual gap while settling flat.
            // Opening the gap further requires taut outer haul — slack ropes cannot pry.
            if (legsTaut && lowering && st.planted && clearance < 0.14 && !st._slideLocked) {
                st.sepExtra = Math.max(st.sepExtra || 0, wantSep, floorSep);
                st.sepExtra += fr.creep * 0.55 * dt;
                st._slideBudget = (st._slideBudget || 0) + fr.creep * 0.55 * dt;
                if ((st._slideBudget || 0) > 0.045 || clearance < 0.03) {
                    st._slideLocked = true;
                    st.peakSep = Math.max(st.peakSep || 0, st.sepExtra || 0);
                }
            } else if (legsTaut && pitch >= prevPitch - 1e-4 && (lifting || pitch > 0.05)) {
                st.sepExtra = Math.max(st.sepExtra || 0, wantSep, floorSep);
                st._slideLocked = false;
                st._slideBudget = 0;
            } else {
                // Slack: keep friction-locked residual if already set down; otherwise do not grow.
                const desired = legsTaut
                    ? Math.max(floorSep, wantSep * (lowering ? 0.15 : 1))
                    : (st._slideLocked || grounded ? floorSep : 0);
                if ((st.sepExtra || 0) > desired) {
                    const creepRate = st._slideLocked ? fr.creep * 0.15 : (legsTaut ? fr.creep : fr.creep * 2.5);
                    st.sepExtra = Math.max(desired, st.sepExtra - creepRate * dt);
                } else if (legsTaut) {
                    st.sepExtra = Math.max(st.sepExtra || 0, desired);
                }
            }
            st.sepExtra = THREE.MathUtils.clamp(st.sepExtra || 0, 0, sepCap);
            st.peakSep = Math.min(sepCap, Math.max(st.peakSep || 0, st.sepExtra));

            if (!st.warned && pitch > 0.12) {
                st.warned = true;
                const statusEl = document.getElementById('sim-status-text');
                if (statusEl) {
                    statusEl.textContent = (typeof L === 'function')
                        ? L(
                            'WARNING: STS twin-lift on cables — no mid pick. Each 20ft tips about its own CoG; outer corners rise; junction toes drag apart.',
                            'CẢNH BÁO: Twin-lift STS bắt cáp — không điểm kéo giữa. Mỗi cont nghiêng quanh CoG riêng; hai đầu ngoài nhấc; góc trong kê đất và lết ra (tõe là tất yếu).'
                        )
                        : 'CẢNH BÁO: Góc giữa không được kéo — kê đất và lết ra.';
                }
            }
            if (!st.gapWarned && grounded && pitch < 0.06 && (st.sepExtra || 0) > 0.12) {
                st.gapWarned = true;
                const gapMm = Math.round(((layout.gap || 0.076) + st.sepExtra) * 1000);
                const statusEl = document.getElementById('sim-status-text');
                if (statusEl) {
                    statusEl.textContent = (typeof L === 'function')
                        ? L(
                            `Set down after drag-open: residual junction gap ≈ ${gapMm} mm — no longer a flush twin-lift.`,
                            `Đã hạ sau khi lết bửa: khe giữa hai cont còn ≈ ${gapMm} mm — không còn khép sát twin-lift.`
                        )
                        : `Đã hạ sau khi lết bửa — khe còn ≈ ${gapMm} mm.`;
                }
            }
            applyStsTwinCableFlareVisual();
            // Lug rewrite only when pose moved enough — every-frame sync jittered cables
            const lugKey = `${pitch.toFixed(3)}|${(st.sepExtra || 0).toFixed(3)}`;
            if (st._lugKey !== lugKey) {
                st._lugKey = lugKey;
                syncTwinCableLugsFromFlare();
            }
        }

        /**
         * STS direct only: yellow spreader tracks the trolley as a headblock.
         * Cable mode skips this — 4-corner hang behaves like an H-beam spreader.
         */
        function enforceStsSpreaderAsHeadblock(frameDt) {
            if (state.beamType !== 'container_spreader') return;
            // Cable mode uses H-beam XPBD — do not headblock-teleport or rewrite upper L0.
            if (typeof isStsDirectAttach === 'function' ? !isStsDirectAttach()
                : (state.stsAttachMode || 'direct') === 'cable') return;
            const b = (phy.beams || [])[0];
            if (!b || !b.x) return;
            const dt = Math.max(1e-4, frameDt || 0.016);
            const rates = cargoHoistRates();
            const blendXZ = Math.min(1, 6 * dt);

            b.x.x = THREE.MathUtils.lerp(b.x.x, phy.hookPos.x, blendXZ);
            b.x.z = THREE.MathUtils.lerp(b.x.z, phy.hookPos.z, blendXZ);
            if (b.v) {
                b.v.x = THREE.MathUtils.lerp(b.v.x || 0, phy.hookVel ? phy.hookVel.x : 0, blendXZ);
                b.v.z = THREE.MathUtils.lerp(b.v.z || 0, phy.hookVel ? phy.hookVel.z : 0, blendXZ);
            }

            let maxLegOver = 0;
            let anyLeg = false;
            (phy.cables || []).forEach(c => {
                if (c.role !== 'leg' || cableIsBroken(c) || !c.a || !c.b) return;
                anyLeg = true;
                const span = attachWorld(c.a).distanceTo(attachWorld(c.b));
                maxLegOver = Math.max(maxLegOver, span - (c.L0 || 1));
            });

            const rising = (typeof isHoistRising === 'function')
                ? isHoistRising()
                : ((phy.hoistSpeed || 0) > 0.01 || (phy.hookVel && phy.hookVel.y > 0.02));
            if (rising || maxLegOver > 0.02) b.isRestingOnCargo = false;

            const roofContactY = ((typeof supportY === 'function') ? supportY(b.x.x, b.x.z) : 0) + (state.H || 2.591) + 0.34;
            const stepSpeed = rising ? rates.up : rates.down;
            const nextBeamY = (typeof RIG !== 'undefined' && RIG.computeStsHeadblockFollow)
                ? RIG.computeStsHeadblockFollow({
                    hookPosY: phy.hookPos.y,
                    beamY: b.x.y,
                    roofContactY,
                    maxSpeedMps: stepSpeed,
                    dt
                })
                : Math.max(roofContactY, phy.hookPos.y - 0.22);
            const prevBeamY = b.x.y;
            b.x.y = nextBeamY;
            if (b.v) {
                const rawVy = (nextBeamY - prevBeamY) / dt;
                b.v.y = THREE.MathUtils.clamp(rawVy, -rates.down * 1.05, rates.up * 1.05);
            }

            (phy.cables || []).forEach(c => {
                if (c.role !== 'upper' || cableIsBroken(c)) return;
                const want = Math.max(0.12, Math.min(0.55, c.designL0 || state.upperSlingLength || 0.28));
                if (Math.abs((c.L0 || 0) - want) > 0.08) c.L0 = want;
            });
        }

        if (typeof window !== 'undefined') {
            window.stsTwinCableMode = stsTwinCableMode;
            window.stsLegsGeometricallyTaut = stsLegsGeometricallyTaut;
            window.cargoHasIntactLoadLegs = cargoHasIntactLoadLegs;
            window.cargoAabbClearance = cargoAabbClearance;
            window.detachTwinHalfIfCut = detachTwinHalfIfCut;
            window.checkTwinHalfDetachment = checkTwinHalfDetachment;
            window.stepTwinFallenHalves = stepTwinFallenHalves;
            window.twinCableFlareTargetPitch = twinCableFlareTargetPitch;
            window.twinCableInnerBottomOutward = twinCableInnerBottomOutward;
            window.twinCableGeometricSep = twinCableGeometricSep;
            window.twinCableFrictionParams = twinCableFrictionParams;
            window.twinHalfPose = twinHalfPose;
            window.twinHalfMatrix = twinHalfMatrix;
            window.placeTwinHalfAboutOuterPivot = placeTwinHalfAboutOuterPivot;
            window.applyStsTwinCableFlareVisual = applyStsTwinCableFlareVisual;
            window.syncTwinCableLugsFromFlare = syncTwinCableLugsFromFlare;
            window.twinCableContactLocals = twinCableContactLocals;
            window.twinInnerBottomLocals = twinInnerBottomLocals;
            window.twinInnerBottomWorldMinY = twinInnerBottomWorldMinY;
            window.twinPitchToPlantInner = twinPitchToPlantInner;
            window.clampTwinInnerToesPenetration = clampTwinInnerToesPenetration;
            window.stepStsTwinCableFlare = stepStsTwinCableFlare;
            window.clearStsTwinCableFlareState = clearStsTwinCableFlareState;
            window.twinTwentyLayout = twinTwentyLayout;
        }

        /**
         * STS direct twistlock couple — soft follow (lerp) so hoist is smooth, not giật.
         * Pins stay engaged; cargo rides with spreader without teleport snaps.
         */
        function enforceStsDirectTwistlockCouple(frameDt) {
            if (typeof isStsDirectAttach !== 'function' || !isStsDirectAttach()) {
                phy._stsPinsSnug = false;
                return;
            }
            // Preview / set-down: hard-seat pins over ISO holes (fixes “ngáng lệch cont”).
            if (state.poseLock) {
                seatStsSpreaderToCargo();
                return;
            }
            const b = (phy.beams || [])[0];
            if (!b || !b.x) return;

            const rising = (typeof isHoistRising === 'function')
                ? isHoistRising()
                : ((phy.hoistSpeed || 0) > 0.01
                    || (phy.hookVel && phy.hookVel.y > 0.02)
                    || (phy.hookTarget && phy.hookPos && phy.hookTarget.y > phy.hookPos.y + 0.03));
            const lowering = (typeof isHoistLowering === 'function')
                ? isHoistLowering()
                : ((phy.hoistSpeed || 0) < -0.01
                    || !!phy._setDownActive
                    || (phy.hookTarget && phy.hookPos && phy.hookTarget.y < phy.hookPos.y - 0.03));
            const clearance = phy.groundClearance || 0;
            const airborne = clearance > 0.08;
            // Once twistlocks have picked the box, stay locked while airborne —
            // releasing Kéo / finishing Nhấc thử must NOT drop the load.
            const holdPins = airborne || rising || lowering || !!phy._stsPinsSnug;
            if (!holdPins && clearance < 0.08) {
                phy._stsPinsSnug = false;
                return;
            }

            const uppers = (phy.cables || []).filter(c => c.role === 'upper' && !cableIsBroken(c));
            const uppersTaut = uppers.some(c => {
                const chord = attachWorld(c.a).distanceTo(attachWorld(c.b));
                return chord >= (c.L0 || 1) - 0.03 || (c.tensionT || 0) > 0.05 || (c._j || 0) > 1e-4;
            });

            b.isRestingOnCargo = false;
            const suspended = beamIsSuspended(b) || uppersTaut || rising || lowering || airborne;
            const snugGround = clearance < 0.08 && (rising || uppersTaut);
            if (!holdPins && !suspended && !snugGround) {
                phy._stsPinsSnug = false;
                return;
            }

            // Snug pin L0 once on engage — rewriting every frame shocks XPBD (giật)
            if (!phy._stsPinsSnug) {
                (phy.cables || []).forEach(c => {
                    if (c.role !== 'leg' || cableIsBroken(c)) return;
                    const span = attachWorld(c.a).distanceTo(attachWorld(c.b));
                    c.L0 = Math.max(0.04, Math.min(0.12, span + 0.004));
                    c.slack = false;
                });
                phy._stsPinsSnug = true;
            } else {
                (phy.cables || []).forEach(c => {
                    if (c.role !== 'leg' || cableIsBroken(c)) return;
                    const span = attachWorld(c.a).distanceTo(attachWorld(c.b));
                    // Only correct if pin gap opened a lot (detach risk)
                    if (span > (c.L0 || 0.06) + 0.10) {
                        c.L0 = Math.min(0.12, span * 0.97);
                    }
                    c.slack = false;
                });
            }

            // Hard twistlock lock: yellow underside ≈ −0.34 on roof — NO rate-lag gap
            // (soft lerp made “kéo vô hình” with a big air gap under the spreader).
            const H = state.H || 2.6;
            const groundBaseY = (typeof supportY === 'function') ? supportY(b.x.x, b.x.z) : 0;
            const floorY = groundBaseY + H * 0.5;
            const brokenCorners = (phy.cables || []).filter(c => c.role === 'leg' && cableIsBroken(c)).length;
            const yaw = stsLockedYawRad();
            const pose = (typeof RIG !== 'undefined' && RIG.solveStsDirectTwistlockPose)
                ? RIG.solveStsDirectTwistlockPose({
                    beamPos: b.x, cargoPos: phy.cargoPos, cargoDims: state,
                    cogOffset: { x: state.cogX || 0, z: state.cogZ || 0 },
                    yawRad: yaw, floorY: groundBaseY, brokenCorners
                })
                : { clampedBeamY: Math.max(floorY + 0.34, b.x.y), cargoY: Math.max(floorY, b.x.y - 0.34 - H * 0.5), clearance: Math.max(0, b.x.y - 0.34 - H * 0.5 - floorY), quat: null, seatedOnDeck: false };
            b.x.y = pose.clampedBeamY;
            const rates = (typeof cargoHoistRates === 'function') ? cargoHoistRates() : { up: 0.85, down: 0.85 };
            const dtSec = Math.max(1e-4, frameDt || (1 / 60));
            const prevCargoY = phy.cargoPos.y || (groundBaseY + H * 0.5);
            const nextY = (typeof RIG !== 'undefined' && RIG.stepRateLimitedY)
                ? RIG.stepRateLimitedY(prevCargoY, pose.cargoY, (rising ? rates.up : rates.down) * 1.05, dtSec)
                : pose.cargoY;

            if (nextY > prevCargoY - 0.002 || nextY < prevCargoY + 0.002
                || suspended || rising || lowering || snugGround) {
                phy.cargoPos.x = b.x.x;
                phy.cargoPos.z = b.x.z;
                phy.cargoPos.y = nextY;
                phy.solverMaxOverrun = 0;

                if (phy.cargoVel) {
                    const vy = THREE.MathUtils.clamp((nextY - prevCargoY) / dtSec, -rates.down * 1.05, rates.up * 1.05);
                    phy.cargoVel.set(b.v ? b.v.x : 0, (lowering && vy > 0) ? 0 : vy, b.v ? b.v.z : 0);
                }
                if (phy.cargoOmega) phy.cargoOmega.set(0, 0, 0);

                if (pose.quat) {
                    phy.cargoQuat.slerp(pose.quat, 0.25);
                    b.q.slerp(pose.quat, 0.25);
                } else {
                    softLockYawQuat(phy.cargoQuat, yaw, 0.0, 1.0);
                    softLockYawQuat(b.q, yaw, 0.0, 1.0);
                }

                (phy.cables || []).forEach(c => {
                    if (c.role !== 'leg' || cableIsBroken(c)) return;
                    const span = attachWorld(c.a).distanceTo(attachWorld(c.b));
                    c.L0 = Math.max(0.04, Math.min(0.12, span));
                    c.slack = false;
                });

                const actualClear = Math.max(0, nextY - (groundBaseY + H * 0.5));
                b.isRestingOnCargo = actualClear <= 0.02;
                phy.groundClearance = actualClear;
            }
        }

        function endCompliance(end, n, invMass, invI) {
            if (!end) return 0;
            // The hook block is a real dynamic body on an elastic hoist rope
            // (see dynamics.js).  Its generalized inverse mass lets the cable
            // solver share impulses two-way, which is what produces hook
            // bounce / DAF instead of an infinitely stiff kinematic anchor.
            if (end.kind === 'hook') return hoistHookInvMass(n);
            if (end.kind === 'cargo') return cableInvMass(attachWorld(end).sub(cargoComNow()), n, phy.cargoQuat, invI, invMass);
            if (!end.body || (state.beamType === 'basket' && basketUsesKinematicPose())) return 0;
            return cableInvMass(attachWorld(end).sub(end.body.x), n, end.body.q, end.body.invI, end.body.invMass);
        }

        // Position-level compliance: identical to the velocity-level one except
        // for the hook block, whose drift clean-up share is weighted with the
        // suspended load (see hoistHookInvMassPos).
        function endCompliancePos(end, n, invMass, invI) {
            if (!end) return 0;
            if (end.kind === 'hook') return hoistHookInvMassPos(n);
            return endCompliance(end, n, invMass, invI);
        }

        function pushEnd(end, n, dl, invMass, invI) {
            if (!end || !(Math.abs(dl) > 1e-12)) return;
            if (end.kind === 'hook') { hoistPushHook(n, dl); return; }
            const limited = (quat, tensor, origin, apply) => {
                const r = attachWorld(end).sub(origin);
                let rot = alphaFromTorque(new THREE.Vector3().crossVectors(r, n.clone().multiplyScalar(dl)), quat, tensor);
                const th = rot.length();
                let use = dl;
                if (th > 0.08) {
                    use = dl * (0.08 / th);
                    rot = alphaFromTorque(new THREE.Vector3().crossVectors(r, n.clone().multiplyScalar(use)), quat, tensor);
                }
                apply(use, rot);
            };
            if (end.kind === 'cargo') {
                const com = cargoComNow();
                limited(phy.cargoQuat, invI, com, (use, rot) => {
                    com.addScaledVector(n, use * invMass);
                    spinQuat(phy.cargoQuat, rot, 0.08);
                    writeCargoCom(com);
                });
                return;
            }
            const b = end.body;
            if (!b || (state.beamType === 'basket' && basketUsesKinematicPose())) return;
            limited(b.q, b.invI, b.x, (use, rot) => {
                b.x.addScaledVector(n, use * b.invMass);
                spinQuat(b.q, rot, 0.08);
            });
        }

        function kickEnd(end, n, j, invMass, invI, vCom, omega) {
            if (!end || !(Math.abs(j) > 1e-9)) return;
            if (end.kind === 'hook') { hoistKickHook(n, j); return; }
            if (end.kind === 'cargo') {
                const r = attachWorld(end).sub(cargoComNow());
                vCom.addScaledVector(n, j * invMass);
                omega.add(alphaFromTorque(new THREE.Vector3().crossVectors(r, n.clone().multiplyScalar(j)), phy.cargoQuat, invI));
                return;
            }
            const b = end.body;
            if (!b || (state.beamType === 'basket' && basketUsesKinematicPose())) return;
            const r = attachWorld(end).sub(b.x);
            b.v.addScaledVector(n, j * b.invMass);
            b.w.add(alphaFromTorque(new THREE.Vector3().crossVectors(r, n.clone().multiplyScalar(j)), b.q, b.invI));
        }

        function endVelocity(end, vCom, omega) {
            if (!end || end.kind === 'hook') return phy.hookVel.clone();
            if (end.kind === 'cargo') {
                const r = attachWorld(end).sub(cargoComNow());
                return vCom.clone().add(new THREE.Vector3().crossVectors(omega, r));
            }
            if (!end.body) return new THREE.Vector3();
            const r = attachWorld(end).sub(end.body.x);
            return end.body.v.clone().add(new THREE.Vector3().crossVectors(end.body.w, r));
        }

        function solidRadius(members) {
            let d = beamOuterDiameter();
            (members || []).forEach(id => { d = Math.max(d, memberDiameter(id)); });
            return d * 0.5 + 0.03;
        }

        // The physics proxy must enclose the visible steelwork, including end
        // fittings and lug plates. A nominal tube diameter alone leaves the
        // rendered parts able to pass through cargo.
        function beamCollisionRadius(b) {
            return Math.max(b && b.radius ? b.radius : 0.12, b && b.visualRadius ? b.visualRadius : 0.12);
        }

        function calibrateBeamCollisionProxy(b) {
            if (!b || !b.group) return;
            b.group.updateMatrixWorld(true);
            // setFromObject() returns world coordinates. Convert every child box
            // back into the beam's local frame, otherwise a raised beam acquires
            // its hook height as a fictitious collision radius.
            const toBeamLocal = new THREE.Matrix4().copy(b.group.matrixWorld).invert();
            const bounds = new THREE.Box3();
            b.group.traverse(child => {
                if (!child.isMesh || !child.geometry) return;
                if (!child.geometry.boundingBox) child.geometry.computeBoundingBox();
                if (!child.geometry.boundingBox) return;
                const childBounds = child.geometry.boundingBox.clone()
                    .applyMatrix4(child.matrixWorld)
                    .applyMatrix4(toBeamLocal);
                bounds.union(childBounds);
            });
            if (bounds.isEmpty()) return;
            const size = bounds.getSize(new THREE.Vector3());
            if (b.axis === 'x') {
                b.collisionLength = Math.max(b.length, size.x + 0.02);
                b.visualRadius = state.beamType === 'lifting_beam'
                    ? 0.20
                    : (Math.max(Math.abs(bounds.min.y), Math.abs(bounds.max.y), Math.abs(bounds.min.z), Math.abs(bounds.max.z)) + 0.008);
            } else if (b.axis === 'z') {
                b.collisionLength = Math.max(b.length, size.z + 0.02);
                b.visualRadius = Math.max(Math.abs(bounds.min.x), Math.abs(bounds.max.x), Math.abs(bounds.min.y), Math.abs(bounds.max.y)) + 0.008;
            } else {
                b.visualRadius = Math.max(Math.abs(bounds.min.y), Math.abs(bounds.max.y)) + 0.008;
            }
        }

        function beamAxis(b) {
            return new THREE.Vector3(b.axis === 'z' ? 0 : 1, 0, b.axis === 'z' ? 1 : 0).applyQuaternion(b.q);
        }

        function segmentEnds(b) {
            const axis = beamAxis(b);
            const half = Math.max(0.05, (b.collisionLength || b.length) * 0.5);
            return [b.x.clone().addScaledVector(axis, -half), b.x.clone().addScaledVector(axis, half)];
        }

        // Collision geometry for a lifting member. A frame spreader is an open
        // rectangle: representing it as one centre line lets objects ghost through
        // its rails. Return every physical rail so contacts occur at the outer skin.
        function beamSegments(b) {
            if (!b || b.axis !== 'frame') return [segmentEnds(b)];
            const localX = new THREE.Vector3(1, 0, 0).applyQuaternion(b.q);
            const localZ = new THREE.Vector3(0, 0, 1).applyQuaternion(b.q);
            const span = getLPBoundingSpan();
            const halfX = (span.spanX || state.L || 6.0) * 0.5;
            const halfZ = (span.spanZ || state.W || 2.4) * 0.5;
            const c0 = b.x.clone().addScaledVector(localX, halfX).addScaledVector(localZ, halfZ);
            const c1 = b.x.clone().addScaledVector(localX, -halfX).addScaledVector(localZ, halfZ);
            const c2 = b.x.clone().addScaledVector(localX, -halfX).addScaledVector(localZ, -halfZ);
            const c3 = b.x.clone().addScaledVector(localX, halfX).addScaledVector(localZ, -halfZ);
            return [[c0, c1], [c1, c2], [c2, c3], [c3, c0]];
        }

        function closestOnSegments(p1, q1, p2, q2) {
            const d1 = q1.clone().sub(p1);
            const d2 = q2.clone().sub(p2);
            const r = p1.clone().sub(p2);
            const a = d1.dot(d1);
            const e = d2.dot(d2);
            const f = d2.dot(r);
            let s = 0;
            let t = 0;
            const eps = 1e-8;
            if (a <= eps && e <= eps) {
                return { pa: p1.clone(), pb: p2.clone() };
            }
            if (a <= eps) {
                t = THREE.MathUtils.clamp(f / e, 0, 1);
            } else {
                const c = d1.dot(r);
                if (e <= eps) {
                    s = THREE.MathUtils.clamp(-c / a, 0, 1);
                } else {
                    const b = d1.dot(d2);
                    const denom = a * e - b * b;
                    s = denom > eps ? THREE.MathUtils.clamp((b * f - c * e) / denom, 0, 1) : 0;
                    t = (b * s + f) / e;
                    if (t < 0) {
                        t = 0;
                        s = THREE.MathUtils.clamp(-c / a, 0, 1);
                    } else if (t > 1) {
                        t = 1;
                        s = THREE.MathUtils.clamp((b - c) / a, 0, 1);
                    }
                }
            }
            return { pa: p1.clone().addScaledVector(d1, s), pb: p2.clone().addScaledVector(d2, t) };
        }

        function craneSolids() {
            const t = state.craneType;
            if (t === 'hook_only') return [];
            if (t === 'gantry') {
                return [
                    { c: [-9.5, 8.2, -7.0], h: [0.35, 8.2, 0.35] },
                    { c: [-9.5, 8.2,  7.0], h: [0.35, 8.2, 0.35] },
                    { c: [ 9.5, 8.2, -7.0], h: [0.35, 8.2, 0.35] },
                    { c: [ 9.5, 8.2,  7.0], h: [0.35, 8.2, 0.35] }
                ];
            }
            if (t === 'crawler') return [{ c: [-8.5, 1.8, -7.5], h: [2.5, 1.8, 3.4] }];
            return [{ c: [-7.5, 1.4, -8.5], h: [2.2, 1.5, 4.8] }];
        }

        function boxExit(local, hx, hy, hz) {
            const dx = Math.abs(local.x) - hx;
            const dy = Math.abs(local.y) - hy;
            const dz = Math.abs(local.z) - hz;
            if (dx >= 0 || dy >= 0 || dz >= 0) return null;
            let depth = -dx;
            const n = new THREE.Vector3(Math.sign(local.x) || 1, 0, 0);
            if (-dy < depth) { depth = -dy; n.set(0, Math.sign(local.y) || 1, 0); }
            if (-dz < depth) { depth = -dz; n.set(0, 0, Math.sign(local.z) || 1); }
            return { depth: depth, n: n };
        }

        function stopClosing(v, w, origin, point, nrm, invM, invI, quat) {
            const rad = point.clone().sub(origin);
            const comp = Math.max(1e-8, cableInvMass(rad, nrm, quat, invI, invM));
            const vn = nrm.dot(v.clone().add(new THREE.Vector3().crossVectors(w, rad)));
            if (vn >= 0) return;
            const jn = -vn / comp;
            v.addScaledVector(nrm, jn * invM);
            w.add(alphaFromTorque(new THREE.Vector3().crossVectors(rad, nrm.clone().multiplyScalar(jn)), quat, invI));
        }

        function shoveBody(body, point, nrm, depth, v, w, maxStep) {
            const want = Math.min(Math.max(0, depth), maxStep != null ? maxStep : 0.28);
            body.x.addScaledVector(nrm, want);
            if (v && w) stopClosing(v, w, body.x, point, nrm, body.invMass, body.invI, body.q);
        }

        function beamContactSamples(b, nSegments) {
            const n = Math.max(2, nSegments || 6);
            if (b.axis !== 'frame') {
                const ends = segmentEnds(b);
                const pts = [];
                for (let i = 0; i <= n; i++) {
                    pts.push(ends[0].clone().lerp(ends[1], i / n));
                }
                return pts;
            }
            // Perimeter rectangular frame spreader: 4 outer rails in beam's true 3D orientation
            const localX = new THREE.Vector3(1, 0, 0).applyQuaternion(b.q);
            const localZ = new THREE.Vector3(0, 0, 1).applyQuaternion(b.q);
            const span = getLPBoundingSpan();
            const halfX = (span.spanX || state.L || 6.0) * 0.5;
            const halfZ = (span.spanZ || state.W || 2.4) * 0.5;

            const c0 = b.x.clone().addScaledVector(localX, halfX).addScaledVector(localZ, halfZ);
            const c1 = b.x.clone().addScaledVector(localX, -halfX).addScaledVector(localZ, halfZ);
            const c2 = b.x.clone().addScaledVector(localX, -halfX).addScaledVector(localZ, -halfZ);
            const c3 = b.x.clone().addScaledVector(localX, halfX).addScaledVector(localZ, -halfZ);

            const pts = [];
            for (let i = 0; i <= n; i++) {
                const t = i / n;
                pts.push(c0.clone().lerp(c1, t)); // railPos
                pts.push(c3.clone().lerp(c2, t)); // railNeg
            }
            const halfN = Math.max(1, Math.round(n * 0.4));
            for (let k = 1; k < halfN; k++) {
                const t = k / halfN;
                pts.push(c0.clone().lerp(c3, t)); // endPos
                pts.push(c1.clone().lerp(c2, t)); // endNeg
            }
            return pts;
        }

        // Multi-sample rigid depenetration: beam segment cannot occupy cargo volume
        function depenetrateBeamFromCargo(b, maxPasses) {
            if (!b || !activeCargoVisual) return false;
            if (typeof RIG !== 'undefined' && RIG.buildCompoundBeamCollider && RIG.resolveCompoundContact && phy.cargoPos) {
                const cargoCol = RIG.buildCompoundCargoCollider({ center: phy.cargoPos, quat: phy.cargoQuat, L: state.L || 6, W: state.W || 2.4, H: state.H || 2.6 });
                const beamCol = RIG.buildCompoundBeamCollider({ center: b.x, quat: b.q, spanX: state.beamLength || 6, beamHeight: Math.max(0.28, beamCargoContactPad(b) * 2), isHBeam: state.beamType === 'hbeam' });
                const satHit = RIG.resolveCompoundContact(beamCol, cargoCol);
                if (satHit.collided && satHit.penetrationM > 0.0005) {
                    b.x.addScaledVector(new THREE.Vector3(satHit.normal.x, satHit.normal.y, satHit.normal.z), satHit.penetrationM);
                    if (b.v && b.w) stopClosing(b.v, b.w, b.x, satHit.point || b.x, new THREE.Vector3(satHit.normal.x, satHit.normal.y, satHit.normal.z), b.invMass, b.invI, b.q);
                }
            }
            // Roof seating uses structural tube radius — fat visualRadius left a visible air gap
            const restRad = beamCargoContactPad(b) + 0.006;
            const sideRad = Math.max(restRad, Math.min(beamCollisionRadius(b), restRad + 0.04) + 0.008);
            let any = false;
            for (let pass = 0; pass < (maxPasses || 4); pass++) {
                const samples = beamContactSamples(b, 6);
                let deepest = 0;
                let nHit = 0;
                const push = new THREE.Vector3();
                for (let oi = 0; oi < samples.length; oi++) {
                    const p = samples[oi];
                    const floor = supportY(p.x, p.z) + restRad;
                    if (p.y < floor) {
                        const dy = floor - p.y;
                        push.add(new THREE.Vector3(0, dy, 0));
                        nHit += 1;
                        if (dy > deepest) deepest = dy;
                        if (b.v && b.w) stopClosing(b.v, b.w, b.x, p, new THREE.Vector3(0, 1, 0), b.invMass, b.invI, b.q);
                    }
                    // Prefer roof-normal push with restRad so the tube sits on the lid
                    const clearedRest = pushOutOfCargoShellWorld(p.clone(), restRad, false);
                    let diff = clearedRest.clone().sub(p);
                    if (diff.lengthSq() < 1e-10) {
                        const clearedSide = pushOutOfCargoShellWorld(p.clone(), sideRad, false);
                        diff = clearedSide.sub(p);
                    }
                    const depth = diff.length();
                    if (depth < 1e-5) continue;
                    push.add(diff);
                    nHit += 1;
                    if (depth > deepest) deepest = depth;
                    if (b.v && b.w) stopClosing(b.v, b.w, b.x, p, diff.clone().multiplyScalar(1 / depth), b.invMass, b.invI, b.q);
                }
                if (!nHit) break;
                any = true;
                const step = push.multiplyScalar(1 / Math.max(1, nHit));
                const mag = step.length();
                if (mag < 1e-5) break;
                b.x.addScaledVector(step.normalize(), Math.min(mag * 0.60, Math.max(0.025, deepest * 0.45)));
                if (b.v) {
                    b.v.multiplyScalar(step.y > 0 ? 0.82 : 0.90);
                    if (step.y > 0 && b.v.y < 0) b.v.y = 0;
                    if (b.v.length() > 14.0) b.v.setLength(14.0);
                }
                if (b.w) { b.w.multiplyScalar(0.82); if (b.w.length() > 3.2) b.w.setLength(3.2); }
                if (!isFinite(b.x.x)) {
                    b.x.set(phy.cargoPos.x, phy.cargoPos.y + 2, phy.cargoPos.z);
                    if (b.v) b.v.set(0, 0, 0);
                    break;
                }
                if (deepest < 0.002) break;
            }
            // Hard kiss onto cargo lid when uppers are slack (set-down) — never while bridle carries the beam
            const spec = getRigSpec();
            const shell = cargoShellTopRaw(b.x.x, b.x.z, spec);
            const seatY = shell + beamCargoContactPad(b);
            if (b.x.y < seatY) b.x.y = seatY;
            const ups = (phy.cables || []).filter(c =>
                c.role === 'upper' && !cableIsBroken(c) && c.b && c.b.body === b
            );
            const uppersSlack = !ups.length || ups.every(c => {
                const chord = attachWorld(c.a).distanceTo(attachWorld(c.b));
                return chord < (c.L0 || 1) - 0.015;
            });
            if (uppersSlack && b.x.y > seatY && b.x.y < seatY + 0.28) {
                b.x.y = seatY;
            }
            b.isRestingOnCargo = uppersSlack && Math.abs(b.x.y - seatY) < 0.06;
            return any || b.isRestingOnCargo;
        }

        function keepSolidsApart(invMass, invI, vCom, omega) {
            const beams = phy.beams || [];
            const shoveCargo = (point, nrm, depth) => {
                const want = Math.min(Math.max(0, depth), 0.12);
                const com = cargoComNow();
                com.addScaledVector(nrm, want);
                writeCargoCom(com);
                stopClosing(vCom, omega, com, point, nrm, invMass, invI, phy.cargoQuat);
            };
            // 1. Spreader / Lifting Beam vs Floor & Cargo
            // STS twin+cable / lifting: skip — flare brings outer roofs toward the
            // yellow headblock; contact shoves then fight the legs → bounce.
            const skipStsBeamCargo = state.beamType === 'container_spreader'
                && (
                    (phy.groundClearance || 0) > 0.03
                    || Math.abs(phy.hoistSpeed || 0) > 0.01
                    || !!phy.autoHoistActive
                    || (phy.twinCableFlare && (phy.twinCableFlare.active
                        || (phy.twinCableFlare.pitchA || 0) > 0.02
                        || (phy.twinCableFlare.pitchB || 0) > 0.02))
                );
            if (!skipStsBeamCargo) {
                beams.forEach(b => {
                    depenetrateBeamFromCargo(b, 2);
                });
            }
            // 2. Beam vs Beam non-penetration
            for (let i = 0; i < beams.length; i++) {
                for (let k = i + 1; k < beams.length; k++) {
                    const a = beams[i];
                    const c = beams[k];
                    const need = beamCollisionRadius(a) + beamCollisionRadius(c);
                    beamSegments(a).forEach(sa => beamSegments(c).forEach(sc => {
                        const hit = closestOnSegments(sa[0], sa[1], sc[0], sc[1]);
                        const dist = hit.pa.distanceTo(hit.pb);
                        if (!(dist < need) || dist < 1e-4) return;
                        const nrm = hit.pb.clone().sub(hit.pa).multiplyScalar(1 / dist);
                        const want = Math.min(need - dist, 0.06);
                        const shareC = want * c.invMass / (a.invMass + c.invMass);
                        a.x.addScaledVector(nrm, -(want - shareC));
                        c.x.addScaledVector(nrm, shareC);
                        stopClosing(a.v, a.w, a.x, hit.pa, nrm.clone().negate(), a.invMass, a.invI, a.q);
                        stopClosing(c.v, c.w, c.x, hit.pb, nrm, c.invMass, c.invI, c.q);
                    }));
                }
            }
            // 3. Hook Block & Master Link vs Spreader Beams (Hook is also clamped above solids in clampHookOutOfSolids)
            clampHookOutOfSolids();
            const hooks = [
                { c: phy.hookPos.clone().add(new THREE.Vector3(0, 0.34, 0)), r: 0.26 },
                { c: phy.hookPos.clone().add(new THREE.Vector3(0, -0.32, 0)), r: 0.16 }
            ];
            const skipHookPush = state.beamType === 'lifting_beam' && state.liftingBeamTopMode === 'direct_hook';
            if (!skipHookPush) hooks.forEach(hk => {
                beams.forEach(b => beamSegments(b).forEach(ends => {
                    const axis = ends[1].clone().sub(ends[0]);
                    const len2 = Math.max(1e-8, axis.lengthSq());
                    const s = THREE.MathUtils.clamp(hk.c.clone().sub(ends[0]).dot(axis) / len2, 0, 1);
                    const p = ends[0].clone().addScaledVector(axis, s);
                    const gap = p.distanceTo(hk.c);
                    const need = hk.r + beamCollisionRadius(b);
                    if (gap >= need || gap < 1e-4) return;
                    const pushDir = p.clone().sub(hk.c).multiplyScalar(1 / gap);
                    if (pushDir.y < 0 && p.y <= cargoCeilingUnderBeam(p.x, p.z, getRigSpec()) + 0.05) {
                        // Beam resting on cargo: raise hook — but NEVER while operator is lowering
                        // (that fought Hạ / Hạ đất and froze the suspended load in mid-air).
                        const loweringNow = (typeof isHoistLowering === 'function')
                            ? isHoistLowering()
                            : ((phy.hoistSpeed || 0) < -0.01 || !!phy._setDownActive);
                        if (!loweringNow) {
                            phy.hookPos.y += (need - gap);
                            if (phy.hookTarget.y < phy.hookPos.y) phy.hookTarget.y = phy.hookPos.y;
                        }
                    } else {
                        shoveBody(b, p, pushDir, need - gap, b.v, b.w);
                    }
                }));
            });
            // 4. Crane structural legs/outriggers vs Cargo & Beams
            craneSolids().forEach(box => {
                const center = new THREE.Vector3(box.c[0], box.c[1], box.c[2]);
                const half = box.h;
                contactLocals().forEach(corner => {
                    const p = corner.clone().applyQuaternion(phy.cargoQuat).add(phy.cargoPos);
                    const hit = boxExit(p.clone().sub(center), half[0], half[1], half[2]);
                    if (hit) shoveCargo(p, hit.n, hit.depth);
                });
                beams.forEach(b => {
                    const rad = beamCollisionRadius(b);
                    beamContactSamples(b, 8).forEach(p => {
                        const hit = boxExit(p.clone().sub(center), half[0] + rad, half[1] + rad, half[2] + rad);
                        if (hit) shoveBody(b, p, hit.n, hit.depth, b.v, b.w);
                    });
                });
            });
        }

        function contactLocals() {
            // Twin+cable pry: each 20ft is articulated — fused L×W×H AABB buries the
            // dropped inner toes and mis-seats Nhớm cáp / Hạ đất.
            // After all legs are cut, do NOT use flared toe contacts — they kiss the
            // quay while the COM floats and the solver freezes the fall (no gravity).
            if (typeof stsTwinCableMode === 'function' && stsTwinCableMode()
                && cargoHasIntactLoadLegs()
                && phy.twinCableFlare
                && (phy.twinCableFlare.active
                    || (phy.twinCableFlare.sepExtra || 0) > 0.001
                    || (phy.twinCableFlare.pitchA || 0) > 0.001
                    || (phy.twinCableFlare.pitchB || 0) > 0.001)
                && typeof twinCableContactLocals === 'function') {
                const twinPts = twinCableContactLocals();
                (phy.supportLocals || []).forEach(p => twinPts.push(p.clone()));
                return twinPts;
            }
            const { L, W, H } = state;
            const pts = [];
            [-1, 1].forEach(x => [-1, 1].forEach(y => [-1, 1].forEach(z => {
                pts.push(new THREE.Vector3(x * L / 2, y * H / 2, z * W / 2));
            })));
            // Underside rib grid aligned with exact dunnage sleeper stations (±0.39L, ±0.13L, 0) so cargo rests on timber & tilts if off-center
            [-0.39, -0.26, -0.13, 0, 0.13, 0.26, 0.39].forEach(fx => {
                [-0.46, 0, 0.46].forEach(fz => {
                    pts.push(new THREE.Vector3(fx * L, -H / 2, fz * W));
                });
            });
            if (typeof GFX !== 'undefined' && GFX.sampleDunnageContactPointsForCargo && typeof dunnageGroup !== 'undefined') {
                GFX.sampleDunnageContactPointsForCargo({
                    THREE, cargoPos: phy.cargoPos, cargoQuat: phy.cargoQuat, L, W, H, dunnageGroup
                }).forEach(p => pts.push(p));
            }
            (phy.supportLocals || []).forEach(p => pts.push(p.clone()));
            return pts;
        }

        function balanceBeamBridles() {
            // Beam orientation, swing, and equilibrium are governed strictly by XPBD
            // cable constraints, gravity, inertia, and contacts without artificial kinematic overrides.
            // Velocity and angular rates are physically integrated and damped per substep in the main loop.
        }

        function runXpbdFrame(frameDt) {
            phy.rigLive = true;
            if ((phy.shockFrames || 0) > 0) phy.shockFrames -= 1;
            // Adaptive substeps: quiet / editing → fewer; lively swing → full accuracy
            const speedHint = (phy.cargoVel ? phy.cargoVel.length() : 0)
                + (phy.hookVel ? phy.hookVel.length() * 0.5 : 0)
                + ((phy.beams || []).reduce((s, b) => s + (b.v ? b.v.length() : 0), 0) * 0.25);
            const perfLow = !!(state.renderPerf && state.renderPerf.level < 1);
            let substeps = 20;
            if (perfLow) substeps = 10;
            else if (speedHint < 0.08 && (phy.groundClearance || 0) < 0.12) substeps = 10;
            else if (speedHint < 0.35) substeps = 14;
            substeps = Math.max(8, substeps);
            const dt = frameDt / substeps;
            const activeWeightT = phy.effectiveCargoWeightT != null ? phy.effectiveCargoWeightT : state.weight;
            const mass = Math.max(80, activeWeightT * 1000);
            const invMass = 1 / mass;
            const { L, W, H, cogX, cogY, cogZ } = state;
            const slideCogX = cogX + ((phy.oogState && phy.oogState.status === 'sliding') ? phy.oogState.localPos.x * 0.72 : 0);
            const slideCogZ = cogZ + ((phy.oogState && phy.oogState.status === 'sliding') ? phy.oogState.localPos.z * 0.72 : 0);
            const invI = inertiaInverseAboutCog(mass, L, W, H, slideCogX, cogY, slideCogZ);
            const mu = state.groundId === 'soil' ? 0.62 : (state.groundId === 'rough' ? 0.48 : 0.5);
            (phy.cables || []).forEach(c => { c._sum = 0; c._n = 0; });
            let clearance = Infinity;

            // Rest lengths change with gear edits, not every XPBD substep
            syncCableRest(false);

            // Site wind: mean + shear + stochastic turbulence, advanced once per frame
            stepWindField(frameDt);

            const rCog0 = new THREE.Vector3(slideCogX, cogY, slideCogZ).applyQuaternion(phy.cargoQuat);
            const vCom = phy.cargoVel.clone().add(new THREE.Vector3().crossVectors(phy.cargoOmega, rCog0));
            const omega = phy.cargoOmega.clone();

            const stsDirectControlled = state.beamType === 'container_spreader'
                && typeof isStsDirectAttach === 'function'
                && isStsDirectAttach()
                && cargoHasIntactLoadLegs();

            for (let step = 0; step < substeps; step++) {
                if (stsDirectControlled && phy.hoist) {
                    // Prevent elastic hoist spring from oscillating on unloaded STS Direct cables during Hạ / Hạ đất.
                    phy.hoist.vel.y = 0;
                    phy.hoist.off.y = THREE.MathUtils.lerp(phy.hoist.off.y, 0, 0.45);
                    phy.hoist.offLP.y = THREE.MathUtils.lerp(phy.hoist.offLP.y, 0, 0.45);
                }
                advanceHook(dt);

                const rCog = new THREE.Vector3(slideCogX, cogY, slideCogZ).applyQuaternion(phy.cargoQuat);
                const com = phy.cargoPos.clone().add(rCog);
                if (stsDirectControlled && !state.poseLock) {
                    // STS Direct is driven smoothly by the headblock & twistlock coupler after XPBD.
                    // Skipping free-fall gravity integration avoids cargo dropping below the spreader every substep
                    // only to be snapped back upward at end-of-frame (giật cục khi Hạ).
                    vCom.set(0, 0, 0);
                    omega.set(0, 0, 0);
                } else {
                    vCom.y -= G_EARTH * dt;
                    // Aerodynamics: relative-wind drag per exposed face, pressure-centre
                    // torque on an eccentric CoG, and quadratic rotational air damping.
                    applyCargoAerodynamics(dt, vCom, omega, invMass, invI, rCog);
                    // Euler gyroscopic coupling  I·ω̇ = −ω × (I·ω)  (implicit, stable)
                    applyGyroscopicTerm(omega, phy.cargoQuat, invI, dt);
                    const wLen = omega.length();
                    if (wLen > 1e-7) phy.cargoQuat.premultiply(new THREE.Quaternion().setFromAxisAngle(omega.clone().multiplyScalar(1 / wLen), wLen * dt)).normalize();
                    com.addScaledVector(vCom, dt);
                    writeCargoCom(com);
                }

                if (basketUsesKinematicPose()) {
                    alignBasketBars();
                } else if (stsDirectControlled) {
                    // STS Direct headblock & twistlocks track trolley deterministically at unified hoist rate
                    (phy.beams || []).forEach(b => { b.v.y = 0; });
                } else {
                    (phy.beams || []).forEach(b => {
                        b.v.y -= G_EARTH * dt;
                        const bs = b.v.length();
                        if (bs > 0.05) b.v.addScaledVector(b.v, -Math.min(0.4, 0.08 * bs) * dt);
                        applyBeamAerodynamics(dt, b);
                        applyGyroscopicTerm(b.w, b.q, b.invI, dt);
                        // Locked hook / STS spreader: torsional restore — no free swivel like a hook block
                        const lockYaw = state.hookSwivelEnabled === false
                            || state.beamType === 'container_spreader';
                        if (lockYaw) {
                            const eul = new THREE.Euler().setFromQuaternion(b.q, 'YXZ');
                            const wantYaw = state.beamType === 'container_spreader'
                                ? stsLockedYawRad()
                                : THREE.MathUtils.degToRad(nominalSpreaderYawDeg());
                            let dy = wantYaw - eul.y;
                            while (dy > Math.PI) dy -= Math.PI * 2;
                            while (dy < -Math.PI) dy += Math.PI * 2;
                            const stiff = state.beamType === 'container_spreader' ? 18.0 : 5.5;
                            b.w.y += dy * stiff * dt;
                            b.w.y *= Math.exp(-dt * (state.beamType === 'container_spreader' ? 12.0 : 3.2));
                        }
                        const bw = b.w.length();
                        if (bw > 1e-7) b.q.premultiply(new THREE.Quaternion().setFromAxisAngle(b.w.clone().multiplyScalar(1 / bw), bw * dt)).normalize();
                        b.x.addScaledVector(b.v, dt);
                    });
                    // Take-up invariant: a floating beam cannot leave upper bridles slack
                    settleBeamsToUpperBridle();
                }

                const axialImpulseCap = (end, dir) => {
                    if (!end || end.kind === 'hook') return 1e8;
                    let mass, quat, tensor, origin;
                    if (end.kind === 'cargo') {
                        mass = 1 / Math.max(1e-8, invMass);
                        quat = phy.cargoQuat;
                        tensor = invI;
                        origin = cargoComNow();
                    } else if (end.body) {
                        mass = end.body.mass;
                        quat = end.body.q;
                        tensor = end.body.invI;
                        origin = end.body.x;
                    } else return 1e8;
                    const axis = dir ? dir.clone() : new THREE.Vector3(0, 1, 0);
                    const rxn = new THREE.Vector3().crossVectors(attachWorld(end).sub(origin), axis);
                    const ang = alphaFromTorque(rxn, quat, tensor).length();
                    const vCap = Math.max(10, (state.weight * 1000 + mass) * G_EARTH * dt * 2.5);
                    const wCap = ang > 1e-6 ? 0.35 / ang : 1e8;
                    const needed = (state.weight * 1000 + mass) * G_EARTH * dt * 1.45;
                    return Math.max(Math.min(vCap, wCap), needed);
                };
                (phy.cables || []).forEach(c => { c._j = 0; c.slack = true; });
                for (let iter = 0; iter < 8; iter++) {
                    balanceBeamBridles();
                    (phy.cables || []).forEach(c => {
                        // A lower sling remains a real, inextensible connection
                        // after its neighbouring upper bridle parts.  Disabling it
                        // created a phantom gap: its pins could separate by 10 m
                        // while the UI still stated a 2 m sling.  Only a cable that
                        // actually broke may lose its A↔B constraint.
                        if (cableIsBroken(c) || lowerLegIsUnloadedByTopFailure(c)
                            || !c.a || !c.b || (c.a.kind === 'body' && !c.a.body) || (c.b.kind === 'body' && !c.b.body)) {
                            c.slack = true;
                            c._j = 0;
                            return;
                        }
                        if (state.beamType === 'container_spreader' && typeof isStsDirectAttach === 'function' && isStsDirectAttach() && cargoHasIntactLoadLegs()) {
                            c.slack = false;
                            c._j = 0;
                            return;
                        }
                        const pA = attachWorld(c.a);
                        const pB = attachWorld(c.b);
                        const delta = pB.clone().sub(pA);
                        const dist = delta.length();
                        if (!(dist > 1e-4)) return;
                        const n = delta.multiplyScalar(1 / dist);
                        c.n = n.clone().negate();
                        if (basketUsesKinematicPose() && c.role === 'upper') {
                            const bar = c.b && c.b.body;
                            c.slack = dist < (c.L0 - 0.025) || !!(bar && bar.isRestingOnCargo);
                            return;
                        }
                        const slackThresh = c.slack ? (c.L0 - 0.001) : (c.L0 - 0.004);
                        if (dist < slackThresh) {
                            c.slack = true;
                            return;
                        }
                        const sep = n.dot(endVelocity(c.b, vCom, omega)) - n.dot(endVelocity(c.a, vCom, omega));
                        // Hard near-inextensible cap — large soft stretch looked like rubber bands.
                        // STS haul is progressive but capped soft so we don't overshoot → bounce.
                        const rawStretch = Math.max(0, dist - c.L0);
                        // Direct STS pins only: soft haul. Cable STS = same stretch cap as H-beam.
                        const stsDirectLeg = c.role === 'leg'
                            && state.beamType === 'container_spreader'
                            && typeof isStsDirectAttach === 'function'
                            && isStsDirectAttach()
                            && rawStretch > 0.05;
                        const stretch = Math.min(
                            rawStretch,
                            stsDirectLeg ? Math.min(0.028, 0.012 + rawStretch * 0.15) : 0.035
                        );
                        // Geometric overrun bookkeeping for the hoist model: a large
                        // overrun means the rig is being re-seated after a discontinuity
                        // (rebuild / teleport), not loaded physically.
                        if (rawStretch > (phy.solverMaxOverrun || 0)) phy.solverMaxOverrun = rawStretch;
                        // Pure Split-Impulse Inextensible Cable Solver:
                        // 1) Velocity impulse ONLY resolves relative separating velocity (zero velocity injection from stretch!)
                        const wSum = Math.max(1e-8, endCompliance(c.a, n, invMass, invI) + endCompliance(c.b, n.clone().negate(), invMass, invI));
                        let j = (sep * 0.96) / wSum;
                        const cap = Math.min(axialImpulseCap(c.a, n), axialImpulseCap(c.b, n.clone().negate()));
                        if (j > cap) j = cap;
                        if (c._j + j < 0) j = -c._j;
                        c._j += j;
                        // STS direct: twistlocks stay locked — always transmit lift into the cargo.
                        const stsDirectPin = c.role === 'leg'
                            && (typeof isStsDirectAttach === 'function')
                            && isStsDirectAttach();
                        const isLegUnderRestingBeam = !stsDirectPin
                            && c.role === 'leg' && c.a && c.a.body
                            && (c.a.body.isRestingOnCargo
                                || !beamIsSuspended(c.a.body)
                                || (state.beamType === 'basket' && basketUsesKinematicPose() && c.a.body._basketPathReady === false));
                        kickEnd(c.a, n, j, invMass, invI, vCom, omega);
                        if (!isLegUnderRestingBeam) {
                            kickEnd(c.b, n, -j, invMass, invI, vCom, omega);
                        }
                        // 2) Split position projection removes geometric drift without injecting upward bounce velocity
                        if (stretch > 1e-5) {
                            const hoistStopped = !phy.autoHoistActive && Math.abs(phy.hoistSpeed || 0) < 0.01 && (!phy.hookVel || phy.hookVel.y <= 0.01);
                            // Direct STS pins: soft projection. Cable STS = same as H-beam (harder corr).
                            const stsSoft = !!stsDirectLeg;
                            const corr = stretch * (hoistStopped
                                ? 0.28
                                : (stsSoft ? 0.32 : (rawStretch > 0.35 ? 0.35 : 0.92)));
                            if (isLegUnderRestingBeam) {
                                const dl = corr / Math.max(1e-8, endCompliancePos(c.a, n, invMass, invI));
                                pushEnd(c.a, n, dl, invMass, invI);
                            } else {
                                const wPos = Math.max(1e-8, endCompliancePos(c.a, n, invMass, invI) + endCompliancePos(c.b, n.clone().negate(), invMass, invI));
                                const dl = corr / wPos;
                                pushEnd(c.a, n, dl, invMass, invI);
                                pushEnd(c.b, n, -dl, invMass, invI);
                            }
                        }
                        // Coincident rest length alone is not tension.  A cable is
                        // taut only after it has actually transmitted an impulse
                        // (or has a measurable geometric overrun).  Otherwise the
                        // renderer must be free to show its gravity sag instead of
                        // drawing a fake straight, unsupported line.
                        // Legs under a beam still parked on the cargo carry no lift
                        // load — keep them slack even if pins happen to sit ~L0 apart.
                        if (isLegUnderRestingBeam && c._j <= 1e-5 && stretch < 0.008) {
                            c.slack = true;
                            c._j = 0;
                        } else {
                            c.slack = c._j <= 1e-6 && dist < (c.L0 - 0.001);
                        }
                    });
                }
                if (basketUsesKinematicPose()) {
                    alignBasketBars();
                }

                const contacts = contactLocals();
                let minGap = Infinity;
                for (let pass = 0; pass < 2; pass++) {
                    for (let s = 0; s < contacts.length; s++) {
                        const comN = cargoComNow();
                        const wpt = contacts[s].clone().applyQuaternion(phy.cargoQuat).add(phy.cargoPos);
                        const gap = wpt.y - supportY(wpt.x, wpt.z);
                        if (gap < minGap) minGap = gap;
                        if (gap >= -1e-5) continue;
                        const nrm = (typeof supportNormal === 'function')
                            ? supportNormal(wpt.x, wpt.z)
                            : new THREE.Vector3(0, 1, 0);
                        const r = wpt.clone().sub(comN);
                        const w = Math.max(1e-8, cableInvMass(r, nrm, phy.cargoQuat, invI, invMass));
                        // gap is vertical against the height field, so convert it
                        // to normal penetration before projecting the contact.
                        const penetration = Math.min(-gap / Math.max(0.15, nrm.y), 0.2);
                        const lam = penetration / w;
                        comN.addScaledVector(nrm, lam * invMass);
                        spinQuat(phy.cargoQuat, alphaFromTorque(new THREE.Vector3().crossVectors(r, nrm.clone().multiplyScalar(lam)), phy.cargoQuat, invI));
                        writeCargoCom(comN);
                        const vpt = vCom.clone().add(new THREE.Vector3().crossVectors(omega, r));
                        const vn = vpt.dot(nrm);
                        if (vn < -3.2) phy.pendingImpact = Math.max(phy.pendingImpact || 0, -vn);
                        else if (vn < -0.22 && (phy.touchdownCooldown || 0) <= 0) {
                            phy.touchdownCooldown = 18;
                            if (typeof simAudio !== 'undefined') {
                                const contactSpeed = -vn;
                                const contactEnergy = 0.5 * mass * contactSpeed * contactSpeed;
                                simAudio.playImpact(contactSpeed, contactEnergy, 'touchdown');
                            }
                        }
                        let jn = 0;
                        if (vn < 0) {
                            jn = -vn / w;
                            vCom.addScaledVector(nrm, jn * invMass);
                            omega.add(alphaFromTorque(new THREE.Vector3().crossVectors(r, nrm.clone().multiplyScalar(jn)), phy.cargoQuat, invI));
                        }
                        const vt = vCom.clone().add(new THREE.Vector3().crossVectors(omega, r));
                        vt.addScaledVector(nrm, -vt.dot(nrm));
                        const slip = vt.length();
                        if (slip > 1e-5) {
                            const t = vt.multiplyScalar(1 / slip);
                            const wt = Math.max(1e-8, cableInvMass(r, t, phy.cargoQuat, invI, invMass));
                            const limit = mu * Math.max(jn, (mass * G_EARTH * dt) / contacts.length);
                            const jt = Math.min(slip / wt, limit);
                            vCom.addScaledVector(t, -jt * invMass);
                            omega.add(alphaFromTorque(new THREE.Vector3().crossVectors(r, t.clone().multiplyScalar(-jt)), phy.cargoQuat, invI));
                        }
                    }
                }
                if (minGap < 0.004) omega.multiplyScalar(Math.exp(-dt / 0.18));
                clearance = Math.min(clearance, minGap);

                keepSolidsApart(invMass, invI, vCom, omega);

                let anyTautLeg = false;
                const grossLoadStepLimitT = ((phy.effectiveCargoWeightT != null ? phy.effectiveCargoWeightT : state.weight) + (phy.gearWeight || 1.0)) * 3.0;
                (phy.cables || []).forEach(c => {
                    let stepT = (c._j > 1e-6 && !cableIsBroken(c)) ? (c._j / dt) / (1000 * G_EARTH) : 0;
                    if (stepT > grossLoadStepLimitT) stepT = grossLoadStepLimitT;
                    c._sum += stepT;
                    c._n += 1;
                    if (!c.slack && c.role === 'leg') anyTautLeg = true;
                });
                // Broken stubs: free tips fall under gravity; attachments only feel stub self-weight
                integrateBrokenCableStubs(dt, invMass, invI, vCom, omega);
                // Heavy steel inertia & non-bouncing hoist arrest:
                // Prevent runaway numerical explosion while leaving full freedom for smooth angular tilt and pendulum swinging
                const hoistStopped = !phy.autoHoistActive && Math.abs(phy.hoistSpeed || 0) < 0.01 && (!phy.hookVel || phy.hookVel.y <= 0.01);
                if (anyTautLeg || hoistStopped) {
                    const maxUpward = (phy.hookVel && phy.hookVel.y > 0.01)
                        ? (phy.hookVel.y + 0.35)
                        : 0.015;
                    if (vCom.y > maxUpward) vCom.y = maxUpward;
                }
                if (minGap < 0.35 && vCom.y > 0.8) vCom.y = Math.min(vCom.y, Math.max(0.2, phy.hookVel.y + 0.2));
                // Lowering near deck: never allow an upward bounce (Hạ → nảy / giật)
                const lowering = (phy.hoistSpeed || 0) < -0.01
                    || (phy.hookTarget && phy.hookTarget.y < phy.hookPos.y - 0.02)
                    || (phy.hookVel && phy.hookVel.y < -0.02);
                if (lowering && minGap < 0.35 && vCom.y > 0) vCom.y = 0;
                if (lowering && minGap < 0.20) {
                    omega.multiplyScalar(Math.exp(-dt * 8));
                    vCom.x *= Math.exp(-dt * 4);
                    vCom.z *= Math.exp(-dt * 4);
                }

                // Arrest against the quay only when the fused body is actually down.
                // Twin flare toes kissing the ground after a cable cut must NOT freeze
                // a mid-air COM (looked like “cắt cáp mà đứng yên giữa trời”).
                const aabbClear = cargoAabbClearance();
                const trulySeated = aabbClear < 0.06;
                const freeFallCut = !cargoHasIntactLoadLegs() && aabbClear > 0.10;
                if (minGap < 0.02 && trulySeated && !freeFallCut) {
                    if (vCom.y < 0) vCom.y = 0;
                    if (lowering && vCom.y > 0) vCom.y = 0;
                    const slip = Math.hypot(vCom.x, vCom.z);
                    const hold = mu * G_EARTH * dt;
                    if (slip > 1e-5) {
                        const scale = Math.max(0, slip - hold) / slip;
                        vCom.x *= scale;
                        vCom.z *= scale;
                    }
                    // Phase 3: gravitational restoring torque τ = r_CoG × mg
                    // Only when nearly settled (no hoist) — avoid kicking grounded cargo airborne.
                    if (Math.abs(phy.hoistSpeed || 0) < 0.01 && !phy.autoHoistActive) {
                        const up = new THREE.Vector3(0, 1, 0).applyQuaternion(phy.cargoQuat);
                        const tilt = Math.acos(THREE.MathUtils.clamp(up.y, -1, 1));
                        if (tilt > 0.12 && Math.abs(vCom.y) < 0.15) {
                            const rCogW = new THREE.Vector3(slideCogX, cogY, slideCogZ).applyQuaternion(phy.cargoQuat);
                            const weightForce = new THREE.Vector3(0, -mass * G_EARTH, 0);
                            const tauG = new THREE.Vector3().crossVectors(rCogW, weightForce);
                            const align = new THREE.Vector3().crossVectors(up, new THREE.Vector3(0, 1, 0));
                            tauG.addScaledVector(align, mass * G_EARTH * 0.25 * tilt);
                            omega.add(alphaFromTorque(tauG, phy.cargoQuat, invI).multiplyScalar(dt));
                        }
                    }
                    if (minGap < 0.008 && (!phy.hookVel || phy.hookVel.y <= 0.01)) {
                        omega.multiplyScalar(Math.exp(-dt * 15.0));
                        vCom.multiplyScalar(Math.exp(-dt * 15.0));
                    }
                } else if (freeFallCut && vCom.y > 0) {
                    // Anti-float: detached load path never climbs mid-air
                    vCom.y = 0;
                }
                // Stable industrial damping. Slightly softer when airborne so askew
                // lifts can sway, but never soft enough to explode after take-up.
                const airborne = minGap > 0.08;
                const gearT = Math.max(0.2, phy.gearWeight || 1.0);
                const gearStubborn = THREE.MathUtils.clamp(Math.sqrt(gearT / 1.2), 0.75, 1.8);
                let upperLen = 2.5;
                const uppers = (phy.cables || []).filter(c => c.role === 'upper' && !cableIsBroken(c));
                if (uppers.length) {
                    upperLen = uppers.reduce((s, c) => s + (c.L0 || 2.5), 0) / uppers.length;
                }
                const lenSwing = THREE.MathUtils.clamp(Math.sqrt(Math.max(0.8, upperLen) / 2.5), 0.85, 1.25);
                const cargoDamp = airborne ? Math.max(2.18, 2.28 / lenSwing) : 1.35;
                const planDamp = airborne ? (0.55 / lenSwing) : 0.75;
                omega.multiplyScalar(Math.exp(-dt * cargoDamp));
                vCom.x *= Math.exp(-dt * planDamp);
                vCom.z *= Math.exp(-dt * planDamp);
                if (omega.length() > 2.8) omega.setLength(2.8);
                if (vCom.length() > 14.0) vCom.setLength(14.0);
                (phy.beams || []).forEach(b => {
                    const beamWDamp = airborne
                        ? (2.8 * gearStubborn / lenSwing)
                        : (4.5 * gearStubborn);
                    const beamPlanDamp = airborne ? (0.9 / lenSwing) : 1.2;
                    b.w.multiplyScalar(Math.exp(-dt * beamWDamp));
                    b.v.x *= Math.exp(-dt * beamPlanDamp);
                    b.v.z *= Math.exp(-dt * beamPlanDamp);
                    if (anyTautLeg || hoistStopped) {
                        const maxBeamUpward = (phy.hookVel && phy.hookVel.y > 0.01)
                            ? (phy.hookVel.y + 0.35)
                            : 0.035;
                        if (b.v.y > maxBeamUpward) b.v.y = maxBeamUpward;
                    }
                    if (b.w.length() > 3.2) b.w.setLength(3.2);
                    if (b.v.length() > 14.0) b.v.setLength(14.0);
                });
                const r2 = activeCogLocal().applyQuaternion(phy.cargoQuat);
                phy.cargoOmega.copy(omega);
                phy.cargoVel.copy(vCom).sub(new THREE.Vector3().crossVectors(omega, r2));
            }

            (phy.cables || []).forEach(c => { c.tensionT = c._n ? c._sum / c._n : 0; });
            // STS direct: soft couple once after XPBD (hard double-snap was the hoist jerk)
            const stsDirectNow = (typeof isStsDirectAttach === 'function') && isStsDirectAttach();
            if (state.beamType === 'container_spreader') enforceStsSpreaderAsHeadblock(frameDt);
            if (stsDirectNow) {
                enforceStsDirectTwistlockCouple(frameDt);
                if (typeof RIG !== 'undefined' && RIG.populateStsDirectTensions) {
                    const clrNow = (phy.groundClearance || 0) > 0.015 || (typeof isHoistRising === 'function' && isHoistRising());
                    RIG.populateStsDirectTensions(phy.cables, state.weight || 0, phy.gearWeight || 9.5, clrNow);
                }
            }
            if (state.beamType === 'lifting_beam' && typeof RIG !== 'undefined' && RIG.solveHBeamDirectCoupling) {
                const topM = state.liftingBeamTopMode || 'bridle2';
                const botM = state.liftingBeamBottomMode || 'cable';
                const b0 = (phy.beams || [])[0];
                if (b0 && (topM === 'direct_hook' || botM === 'direct')) {
                    const gY = (typeof supportY === 'function') ? supportY(b0.x.x, b0.x.z) : 0;
                    const upOk = !(phy.cables || []).some(c => c.role === 'upper' && cableIsBroken(c));
                    if (topM === 'direct_hook' && upOk) {
                        b0.x.x = THREE.MathUtils.lerp(b0.x.x, phy.hookPos.x, 0.5);
                        b0.x.z = THREE.MathUtils.lerp(b0.x.z, phy.hookPos.z, 0.5);
                    }
                    const yawR = THREE.MathUtils.degToRad(state.cargoYawDeg || 0);
                    const sol = RIG.solveHBeamDirectCoupling({
                        beamPos: b0.x, beamQuat: b0.q, hookPos: phy.hookPos, cargoPos: phy.cargoPos,
                        cargoDims: state, cogOffset: { x: state.cogX || 0, z: state.cogZ || 0 }, yawRad: yawR,
                        floorY: gY, topMode: upOk ? topM : 'bridle2', bottomMode: botM, masterOffsetY: HOOK_MASTER_OFFSET_Y
                    });
                    if (topM === 'direct_hook' && upOk) b0.x.y = sol.nextBeamY;
                    if (botM === 'direct' && !state.poseLock && (beamIsSuspended(b0) || (phy.groundClearance || 0) > 0.05 || sol.clearance > 0.02)) {
                        phy.cargoPos.x = b0.x.x; phy.cargoPos.z = b0.x.z; phy.cargoPos.y = sol.cargoY;
                        phy.cargoQuat.slerp(sol.quat, 0.25); b0.q.slerp(sol.quat, 0.25);
                        phy.groundClearance = sol.clearance; b0.isRestingOnCargo = sol.seatedOnDeck;
                    }
                }
            }
            constrainStsSpreaderYaw(frameDt);
            // Airborne: kill false slack flicker on load-bearing legs (chains looked hung)
            if ((phy.groundClearance || 0) > 0.08) {
                (phy.cables || []).forEach(c => {
                    if (c.role !== 'leg' || cableIsBroken(c) || lowerLegIsUnloadedByTopFailure(c)) return;
                    const span = attachWorld(c.a).distanceTo(attachWorld(c.b));
                    if (span >= (c.L0 || 1) - 0.04 || (c.tensionT || 0) > 0.05) {
                        c.slack = false;
                        if ((c.tensionT || 0) < 0.08) c.tensionT = Math.max(c.tensionT || 0, 0.12);
                    }
                });
            }
            // Skip depenetration while STS is lifting / flared — beam↔cargo shoves
            // fight outer cable picks and make the twin “nẩy tưng tưng”.
            const stsBusy = state.beamType === 'container_spreader'
                && (
                    stsDirectNow
                    || (phy.hoistSpeed || 0) > 0.01
                    || (phy.hoistSpeed || 0) < -0.01
                    || !!phy.autoHoistActive
                    || (phy.groundClearance || 0) > 0.04
                    || (phy.twinCableFlare && (
                        phy.twinCableFlare.active
                        || (phy.twinCableFlare.pitchA || 0) > 0.02
                        || (phy.twinCableFlare.pitchB || 0) > 0.02
                    ))
                );
            const lbDirectBusy = state.beamType === 'lifting_beam' && (state.liftingBeamBottomMode || 'cable') === 'direct' && (phy.groundClearance || 0) > 0.02;
            if (!stsBusy && !lbDirectBusy && (state.beamType !== 'basket' || (phy.groundClearance || 0) <= 0.05)) {
                (phy.beams || []).forEach(b => depenetrateBeamFromCargo(b, state.beamType === 'basket' ? 6 : 10));
            }
            if (basketUsesKinematicPose()) {
                alignBasketBars();
                if ((phy.groundClearance || 0) <= 0.05) {
                    (phy.beams || []).forEach(b => depenetrateBeamFromCargo(b, 2));
                }
                (phy.cables || []).forEach(c => {
                    const pA = attachWorld(c.a);
                    const pB = attachWorld(c.b);
                    const dir = pA.clone().sub(pB);
                    if (dir.lengthSq() > 1e-6) c.n = dir.normalize();
                });
                const barShareT = ((phy.massBreakdown ? phy.massBreakdown.beamMassT : 0.25) || 0.25) * 0.25;
                (phy.cables || []).forEach(cUp => {
                    if (cUp.role !== 'upper') return;
                    const cLeg = (phy.cables || []).find(cl => cl.role === 'leg' && cl.index === cUp.index);
                    if (!cLeg || cableIsBroken(cUp) || cableIsBroken(cLeg)) {
                        cUp.tensionT = 0;
                        cUp.slack = true;
                        return;
                    }
                    const cosPlay = Math.max(0.55, cUp.n && cLeg.n ? Math.abs(cUp.n.dot(cLeg.n)) : 0.92);
                    cUp.slack = cLeg.slack;
                    cUp.tensionT = cLeg.slack ? 0 : (cLeg.tensionT + barShareT) / cosPlay;
                });
            }
            let comp = 0;
            let compN = 0;
            const topBeam = phy.beams && phy.beams.length ? phy.beams[0] : null;
            const beamAxis = topBeam
                ? new THREE.Vector3(topBeam.axis === 'z' ? 0 : 1, 0, topBeam.axis === 'z' ? 1 : 0).applyQuaternion(topBeam.q).normalize()
                : null;
            (phy.cables || []).forEach(c => {
                if (c.role !== 'upper' || !(c.tensionT > 0.05) || !c.n) return;
                const axialProj = beamAxis ? Math.abs(c.n.dot(beamAxis)) : Math.sqrt(Math.max(0, 1 - c.n.y * c.n.y));
                comp += c.tensionT * axialProj;
                compN += 1;
            });
            phy.beamCompression = compN ? comp / compN : 0;
            phy.groundClearance = isFinite(clearance) ? Math.max(0, clearance) : 0;

            // After cable XPBD: force Flat Rack off the OOG outer skin (cables must not leave it buried)
            if (phy.oogState && (phy.oogState.status === 'falling' || phy.oogState.status === 'grounded')) {
                resolveFlatRackFallenOogContacts(frameDt);
                resolveFlatRackFallenOogContacts(frameDt);
            }
            publishAeroTelemetry();
            publishHoistTelemetry();
            stepStructuralDeformation(frameDt);
            // Twin + cable: outer-only picks → unsupported junction pries open
            stepStsTwinCableFlare(frameDt);
            // Detached twin 20fts after cable cut fall under gravity
            if (typeof checkTwinHalfDetachment === 'function') checkTwinHalfDetachment();
            if (typeof stepTwinFallenHalves === 'function') stepTwinFallenHalves(frameDt);

            // === PHASE 1: Industrial rigging evaluate (topology / hitch / DNV / 3-zone) ===
            // Sits atop XPBD — does not alter runXpbdFrame integration order.
            const rigSolver = (typeof window !== 'undefined' && window.RIG && window.RIG.RiggingPhysicsSolver)
                ? window.RIG.RiggingPhysicsSolver
                : ((typeof RIG !== 'undefined' && RIG.RiggingPhysicsSolver) ? RIG.RiggingPhysicsSolver : null);
            if (rigSolver && state.rigSolver && state.rigSolver.enabled !== false) {
                try {
                    rigSolver.evaluate(phy, state, {
                        legSwl,
                        attachWorld,
                        cableIsBroken,
                        breakCable: (cable, frac) => {
                            // Zone 3 only: full snap path (impulse + free-fall + audio)
                            if (typeof noteCableSnap === 'function') {
                                noteCableSnap(
                                    cable,
                                    `Zone-3 MBL snap ${cable.role || 'leg'}${(cable.index != null) ? (' #' + (cable.index + 1)) : ''}: T ≥ MBL (cascade Kdyn≥2).`,
                                    frac || 0.5
                                );
                            } else if (typeof initCableBreak === 'function') {
                                initCableBreak(cable, frac || 0.5);
                            }
                        }
                    });
                } catch (e) {
                    // Non-fatal evaluation guard
                }
            }
            // === END PHASE 1 RIGGING EVALUATE ===
        }

        function stepStructuralDeformation(frameDt) {
            if (!phy.structuralDeformation) {
                phy.structuralDeformation = {
                    cargoDeflectionMm: 0,
                    cargoTwistDeg: 0,
                    beamDeflectionMm: 0,
                    beamTwistDeg: 0,
                    spreaderAmplification: 1.0,
                    eccentricTorqueNm: 0
                };
            }
            const StructClass = (typeof CAE !== 'undefined' && CAE.DeformableSteelStructure)
                || (typeof globalThis !== 'undefined' && globalThis.CAE && globalThis.CAE.DeformableSteelStructure)
                || (typeof window !== 'undefined' && window.CAE && window.CAE.DeformableSteelStructure);

            const visScale = (state && typeof state.visualExaggerationScale === 'number')
                ? state.visualExaggerationScale
                : 5.0;

            let targetCargoDeflectionMm = 0;
            let targetCargoTwistDeg = 0;
            let targetBeamDeflectionMm = 0;
            let targetBeamTwistDeg = 0;
            let targetSpreaderAmp = 1.0;
            let targetTorqueNm = 0;

            const airborne = !state.poseLock && (phy.groundClearance || 0) > 0.05;
            const cargoMassKg = Math.max(80, (phy.effectiveCargoWeightT != null ? phy.effectiveCargoWeightT : state.weight) * 1000);
            const totalCargoWeightN = cargoMassKg * 9.81;

            // 1. BEAM DEFORMATION
            if (phy.beams && phy.beams.length && state.beamType !== 'none') {
                const topBeam = phy.beams[0];
                const beamL = Math.max(1.0, topBeam.len || (state.beamLength || 6.0));
                const swlRef = Math.max(10, (state.gear?.beam?.swlT) || topBeam.swl || 30);
                const I_beam = Math.max(8.5e-4, beamL * beamL * swlRef * 4.5e-7); // m^4 (HEB / welded girder scaled with span & SWL)
                const J_beam = I_beam * 0.45; // m^4
                const P_compressionN = Math.max(0, (phy.beamCompression || 0) * 1000 * 9.81);

                // Vertical bending force on the beam (lower legs pulling down while upper bridle pulls up)
                let beamVerticalLoadN = 0;
                let beamLeftTensionN = 0;
                let beamRightTensionN = 0;
                (phy.cables || []).forEach(c => {
                    if (c.role === 'leg' && c.tensionT > 0.01 && !cableIsBroken(c)) {
                        const tN = c.tensionT * 1000 * 9.81;
                        beamVerticalLoadN += tN;
                        if (c.index % 2 === 0) beamLeftTensionN += tN;
                        else beamRightTensionN += tN;
                    }
                });

                if (airborne && beamVerticalLoadN < 100) {
                    beamVerticalLoadN = totalCargoWeightN;
                }

                const beamTorqueNm = Math.abs(beamLeftTensionN - beamRightTensionN) * (beamL * 0.25);

                if (StructClass) {
                    const beamStruct = new StructClass(beamL, I_beam, J_beam, 200, 79.3);
                    const beamState = beamStruct.computeDeformationState(beamVerticalLoadN, P_compressionN, beamTorqueNm);
                    targetBeamDeflectionMm = beamState.maxBendingDeflectionMm;
                    targetBeamTwistDeg = beamState.maxTorsionalTwistDeg;
                    targetSpreaderAmp = beamState.amplificationFactor;

                    // Phase 2: bind mesh flex for lifting beams (Euler-Bernoulli + Saint-Venant).
                    // Modulift/STS CAD fittings tear under vertex warp — keep those rigid (telemetry only).
                    const canWarpBeam = state.beamType === 'lifting_beam'
                        || state.beamType === 'straight'
                        || state.beamType === 'adjustable';
                    if (topBeam.group && typeof beamStruct.applyMeshDeformation === 'function') {
                        if (canWarpBeam && airborne) {
                            beamStruct.applyMeshDeformation(
                                topBeam.group,
                                beamVerticalLoadN,
                                P_compressionN,
                                beamTorqueNm,
                                Math.min(3.0, visScale),
                                topBeam.axis === 'z' ? 'z' : 'x'
                            );
                        } else {
                            beamStruct.applyMeshDeformation(
                                topBeam.group, 0, 0, 0, 1.0,
                                topBeam.axis === 'z' ? 'z' : 'x'
                            );
                        }
                    }
                }
            }

            // 2. CARGO DEFORMATION — only long steel decks (flat rack / platform). Closed ISO boxes
            // stay rigid; applying Euler bending to nested pad-eyes/OOG crates tore the model apart.
            const cargoL = Math.max(1.0, state.L || 12.0);
            const I_cargo = 2.5e-4; // m^4 (longitudinal steel I-beams of flatrack / chassis)
            const J_cargo = 1.0e-4; // m^4
            const cargoFlexTypes = { flatrack: 1, platform: 1 };
            const cargoCanFlex = !!cargoFlexTypes[state.cargoType];

            if (airborne && cargoCanFlex) {
                // Flat rack / platform decks: Euler-Bernoulli sag + Saint-Venant twist under eccentric CoG.
                const F_cargoN = totalCargoWeightN;
                const cogEccentricityM = Math.hypot(state.cogZ || 0, (state.cogX || 0) * 0.5);
                targetTorqueNm = totalCargoWeightN * cogEccentricityM;

                if (StructClass) {
                    const cargoStruct = new StructClass(cargoL, I_cargo, J_cargo, 200, 79.3);
                    const cargoState = cargoStruct.computeDeformationState(F_cargoN, 0, targetTorqueNm);
                    targetCargoDeflectionMm = cargoState.maxBendingDeflectionMm;
                    targetCargoTwistDeg = cargoState.maxTorsionalTwistDeg;
                    // Warp only the named deck mesh if present; never the full cargoRoot (pad-eyes/OOG tear).
                    const deck = (typeof cargoRootGroup !== 'undefined' && cargoRootGroup)
                        ? (cargoRootGroup.getObjectByName('flatRackDeck')
                            || cargoRootGroup.getObjectByName('FlatRack_Deck')
                            || cargoRootGroup.getObjectByName('platformDeck'))
                        : null;
                    if (deck && typeof cargoStruct.applyMeshDeformation === 'function') {
                        cargoStruct.applyMeshDeformation(
                            deck, F_cargoN, 0, targetTorqueNm, Math.min(6, visScale), 'x'
                        );
                    }
                }
            } else if (StructClass && typeof cargoRootGroup !== 'undefined' && cargoRootGroup) {
                const deck = cargoRootGroup.getObjectByName('flatRackDeck')
                    || cargoRootGroup.getObjectByName('FlatRack_Deck')
                    || cargoRootGroup.getObjectByName('platformDeck');
                if (deck) {
                    const cargoStruct = new StructClass(cargoL, I_cargo, J_cargo, 200, 79.3);
                    cargoStruct.applyMeshDeformation(deck, 0, 0, 0, 1.0, 'x');
                }
            }

            // Smooth updates to telemetry data
            const smoothFactor = Math.min(1.0, 12 * (frameDt || 0.016));
            const sd = phy.structuralDeformation;
            sd.cargoDeflectionMm += (targetCargoDeflectionMm - sd.cargoDeflectionMm) * smoothFactor;
            sd.cargoTwistDeg += (targetCargoTwistDeg - sd.cargoTwistDeg) * smoothFactor;
            sd.beamDeflectionMm += (targetBeamDeflectionMm - sd.beamDeflectionMm) * smoothFactor;
            sd.beamTwistDeg += (targetBeamTwistDeg - sd.beamTwistDeg) * smoothFactor;
            sd.spreaderAmplification = targetSpreaderAmp;
            sd.eccentricTorqueNm += (targetTorqueNm - sd.eccentricTorqueNm) * smoothFactor;
        }

