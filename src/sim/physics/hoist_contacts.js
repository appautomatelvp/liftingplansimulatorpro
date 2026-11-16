/**
 * physics/hoist_contacts — hook drive, solids clamp, beam recipes
 * Split from legacy god-file (strangler Phase 2). Shared scope via assemble.
 */
        function clampHookOutOfSolids() {
            const masterBottomOffset = 0.58; // Outer bottom of red Master Link below phy.hookPos.y
            let minHookY = supportY(phy.hookPos.x, phy.hookPos.z) + masterBottomOffset + 0.02;

            // Only allow cargo or beams to constrain the hook's minimum lowering floor
            // if the cargo is genuinely resting flat on the ground (pre-lift).
            // A suspended, airborne, or tilting load hangs from the crane hook and can NEVER
            // catapult the crane hook into the sky!
            const groundY = supportY(phy.cargoPos.x, phy.cargoPos.z);
            const cargoGrounded = state.poseLock
                || (
                    phy.cargoPos.y <= groundY + state.H * 0.5 + 0.04
                    && Math.abs(phy.cargoVel.y) < 0.10
                    && !phy.autoHoistActive
                    && phy.hoistSpeed <= 0
                );

            if (cargoGrounded) {
                if (state.beamType === 'container_spreader') {
                    // STS headblock sits at roof + 0.56 (no hanging J-hook block underneath)
                    minHookY = Math.max(minHookY, groundY + (state.H || 2.591) + 0.56);
                } else {
                    // 1. Cargo roof under the hook — prefer shell sample, fall back to AABB top.
                    const shellTop = cargoShellTopWorldY(phy.hookPos.x, phy.hookPos.z, 0.20);
                    const aabbTop = phy.cargoPos.y + (state.H || 2.6) * 0.5;
                    const roofY = (shellTop > -1e5) ? Math.max(shellTop, aabbTop - 0.05) : aabbTop;
                    minHookY = Math.max(minHookY, roofY + masterBottomOffset + 0.02);

                    // 2. Spreader / lifting beam is a solid: hook cannot sink through it.
                    if (state.beamType !== 'none') {
                        (phy.beams || []).forEach(b => {
                            if (!b || b.axis === 'frame') return;
                            const bRad = Math.max(0.10, b.radius || 0.14);
                            minHookY = Math.max(minHookY, b.x.y + bRad + masterBottomOffset + 0.02);
                        });
                    }

                    // 3. Test 3D spheres of the Hook Assembly against cargo outer shell
                    const hookSpheres = [
                        { dy: -0.50, r: 0.12 },
                        { dy: -0.26, r: 0.18 },
                        { dy:  0.28, r: 0.26 }
                    ];
                    for (let i = 0; i < hookSpheres.length; i++) {
                        const hs = hookSpheres[i];
                        const center = new THREE.Vector3(phy.hookPos.x, phy.hookPos.y + hs.dy, phy.hookPos.z);
                        const pushed = pushOutOfCargoShellWorld(center, hs.r, false);
                        if (pushed.distanceToSquared(center) > 1e-8) {
                            const diff = pushed.sub(center);
                            if (diff.y > 0) {
                                minHookY = Math.max(minHookY, phy.hookPos.y + diff.y);
                            } else {
                                phy.hookPos.x += diff.x;
                                phy.hookPos.z += diff.z;
                            }
                        }
                    }
                }
            }

            if (phy.hookPos.y < minHookY) {
                phy.hookPos.y = minHookY;
                if (phy.hookVel.y < 0) phy.hookVel.y = 0;
            }
        }

        // Return 0 while the load-supporting legs are genuinely slack and 1
        // once they are transmitting the cargo load.  Upper bridles by
        // themselves carry only the light spreader, so they do not make a
        // mouse drag feel like it is hauling the full cargo prematurely.
        function hookDragLoadCoupling() {
            const legs = (phy.cables || []).filter(c => c.role === 'leg' && !cableIsBroken(c)
                && c.b && c.b.kind === 'cargo');
            if (!legs.length) return 0;

            let active = 0;
            let nearTaut = 0;
            let peakTension = 0;
            legs.forEach(cable => {
                const span = attachWorld(cable.a).distanceTo(attachWorld(cable.b));
                const tension = Math.max(0, cable.tensionT || 0, phy.legTensions[cable.index] || 0);
                const reportedSlack = cable.slack === true || phy.legSlacks[cable.index] === true;
                const isNearTaut = span >= cable.L0 - 0.045;
                // A constraint can be reported as non-slack one integration
                // frame before tension telemetry is written.  Count it only
                // once it reaches its declared length, avoiding false heavy
                // feel while a loose line is still draped over the cargo.
                if (!reportedSlack && (tension > 0.025 || isNearTaut)) active++;
                if (isNearTaut) nearTaut++;
                peakTension = Math.max(peakTension, tension);
            });

            const activeRatio = active / legs.length;
            const nearRatio = nearTaut / legs.length;
            const expectedPerLeg = Math.max(0.25, (state.weight || 1) / Math.max(1, legs.length));
            const tensionRatio = THREE.MathUtils.clamp(peakTension / expectedPerLeg, 0, 1);
            // A suspended load can be exactly at L0 on a solver frame, making
            // the per-frame impulse telemetry momentarily zero.  Geometry still
            // proves that its legs are carrying the load; mouse drag must feel
            // resisted there, while the same near-taut geometry on the ground
            // remains a light/slack command.
            const airborneNearTaut = !state.poseLock && (phy.groundClearance || 0) > 0.12
                ? nearRatio * 0.62
                : nearRatio * 0.16;
            // Near-taut is intentionally only a light pre-load.  The response
            // becomes properly heavy once force is measured in the legs.
            return THREE.MathUtils.clamp(Math.max(activeRatio * 0.78, tensionRatio * 0.92, airborneNearTaut), 0, 1);
        }

        function advanceMouseHookDrive(dt) {
            const demand = THREE.MathUtils.clamp((dragTarget && dragTarget.pointerSpeed) || 0.25, 0.08, 8.0);
            const coupling = hookDragLoadCoupling();
            // Empty/slack rig follows a brisk mouse pull.  At full cargo
            // coupling, cap speed and acceleration to emulate a loaded hoist
            // absorbing energy through the rigging rather than teleporting it.
            // The last portion of slack disappears very quickly in a real
            // pick.  Shape the response so a nearly taut 22 t load feels
            // heavy already at 80–90% coupling, rather than staying quick
            // until an abrupt hard stop at exactly 100%.
            const resistance = Math.pow(coupling, 0.45);
            const speedCap = THREE.MathUtils.lerp(6.4, 0.45, resistance);
            const requested = Math.min(demand, speedCap);
            const current = Math.max(0, phy.dragHookSpeed || 0);
            const rate = requested >= current
                ? THREE.MathUtils.lerp(13.0, 1.65, resistance)
                : THREE.MathUtils.lerp(19.0, 3.8, resistance);
            phy.dragHookSpeed = THREE.MathUtils.clamp(
                current + THREE.MathUtils.clamp(requested - current, -rate * dt, rate * dt),
                0,
                speedCap
            );
            phy.dragHookLoadCoupling = coupling;
            return Math.max(0.08, phy.dragHookSpeed);
        }

        function advanceHook(dt) {
            const prev = phy.hookPos.clone();
            // Winch drives the suspension point (drum / boom nose projection); the
            // physical hook block hangs from it on an elastic hoist rope.  Any
            // external write to phy.hookPos is carried into the drum here.
            const hoist = syncHoistFromHook();
            const kinPrev = hoist.kin.clone();
            // Operator model: the drum is driven so that the *hook* (not the drum)
            // settles on hookTarget; the slowly tracked rope stretch offLP is the
            // compensation the operator applies.  kinHold = drum pose the operator
            // perceives as "hook on target".
            const comp = hoist.offLP.clone();
            const kinHold = kinPrev.clone().add(comp);
            const dragging = dragTarget && dragTarget.type === 'hook';
            const manual = dragging || Math.abs(phy.hoistSpeed) > 0.01;
            if (manual) phy.autoHoistActive = false;

            // Always use physical, finite winch speeds — NEVER teleport phy.hookPos!
            // Direction from target / hold button — NOT from autoHoistActive alone
            // (old code treated every auto move as "rising", so Hạ đất could not descend).
            const rates = cargoHoistRates();
            const errY = phy.hookTarget.y - kinHold.y;
            const rising = phy.hoistSpeed > 0.01 || errY > 0.02;
            const lowering = phy.hoistSpeed < -0.01 || errY < -0.02;

            let maxWinch;
            if (dragging) {
                maxWinch = advanceMouseHookDrive(dt);
            } else if (Math.abs(phy.hoistSpeed) > 0.01) {
                maxWinch = Math.abs(phy.hoistSpeed);
            } else if (phy.autoHoistActive) {
                maxWinch = rising ? rates.up : rates.down;
            } else {
                maxWinch = rates.up;
            }
            if (!dragging) {
                phy.dragHookSpeed = 0;
                phy.dragHookLoadCoupling = 0;
            }

            // Cargo already on quay: keep the load seated, but still allow paying out
            // the hook / spreader until they kiss the cargo roof (3D solid clamp).
            // Old code returned here and made Hạ useless whenever clearance ≈ 0.
            const aabbClr = (typeof cargoAabbClearance === 'function') ? cargoAabbClearance() : (phy.groundClearance || 0);
            const curClr = Math.max(phy.groundClearance || 0, aabbClr);
            const settleTol = phy._setDownActive ? 0.018 : 0.035;
            const groundedNow = curClr < settleTol && Math.abs(phy.cargoVel?.y || 0) < 0.14;
            if (groundedNow && lowering && !rising) {
                if (phy.cargoVel) phy.cargoVel.set(0, 0, 0);
                if (phy.cargoOmega) phy.cargoOmega.set(0, 0, 0);
                if (phy._setDownActive && typeof finishSmoothSetDown === 'function') {
                    finishSmoothSetDown();
                    return;
                }
                // Manual Hạ at quay: damp cargo gently without snapping quaternion or teleporting
                phy._setDownActive = false;
                phy.groundClearance = 0;
            }
            if (!dragging) {
                maxWinch = Math.min(maxWinch, rising ? rates.up : rates.down);
                if (phy._setDownActive && lowering && !rising && curClr < 0.45) {
                    maxWinch = Math.min(maxWinch, Math.max(0.14, 0.14 + curClr * 1.55));
                }
            }

            // ASME B30.9 & OSHA Hard-coded safety trigger: Horizontal angle < 30° strictly blocks lifting
            const isLegBroken = (idx) => !!(state.gear && state.gear.legs && state.gear.legs[idx] && state.gear.legs[idx].broken);
            const tautAngles = (phy.legAngleDeg || []).filter((deg, i) => !isLegBroken(i) && (!phy.legSlacks || !phy.legSlacks[i]));
            const minHorizAngle = tautAngles.length ? Math.min(...tautAngles) : Math.max(0, 90 - (phy.maxAngleVert || 0));
            // The calculated automatic rig is designed at the 30° limit.
            // Allow a 1° numerical tolerance at pick-up; without it minute
            // XPBD/mesh rounding blocks a legal geometry before it can ever
            // take load.  Truly shallow (<29°) user-shortened legs remain hard-blocked.
            const hasExplicitIllegalShortSling = !!(
                state.slingUserSet && state.beamType === 'none'
                && state.slingLength < (getRigSpec().minUpper - 0.05)
            );
            const isAngleProhibited = hasExplicitIllegalShortSling
                && minHorizAngle < 29.0
                && phy.groundClearance > 0.02
                && (!phy.legSlacks || !phy.legSlacks.every(s => s));
            phy.isOperationBlocked = isAngleProhibited;

            if (isAngleProhibited && rising && phy.groundClearance > -0.02) {
                phy.autoHoistActive = false;
                phy.hoistSpeed = 0;
                phy.hookTarget.y = Math.min(phy.hookTarget.y, kinHold.y);
                const banner = document.getElementById('fit-banner');
                if (banner) {
                    banner.style.display = 'block';
                    banner.textContent = state.lang === 'en'
                        ? `⛔ PROHIBITED (ASME B30.9 / OSHA): Sling angle is ${minHorizAngle.toFixed(1)}° (< 30°)! Tension factor exceeds 200% — Operation strictly prohibited.`
                        : `⛔ NGUY HIỂM (ASME B30.9 / OSHA): Góc nâng ngang cáp chỉ đạt ${minHorizAngle.toFixed(1)}° (< 30°)! Lực căng tăng vọt > 200% — Nghiêm cấm nâng cẩu.`;
                }
            }

            const MAX_CARGO_AGL_M = 50;
            if (rising && (phy.groundClearance || 0) >= MAX_CARGO_AGL_M - 0.05) {
                phy.autoHoistActive = false;
                phy.hoistSpeed = 0;
                phy.hookTarget.y = Math.min(phy.hookTarget.y, kinHold.y);
                const stCap = document.getElementById('sim-status-text');
                if (stCap) {
                    stCap.textContent = (typeof L === 'function')
                        ? L('Hoist limit: cargo at 50 m above ground.',
                            'Giới hạn nâng: kiện hàng đã đạt 50 m so với mặt đất.')
                        : 'Giới hạn nâng: kiện hàng đã đạt 50 m so với mặt đất.';
                }
            }

            if (rising && (phy.groundClearance || 0) < 0.05) {
                // Soft-pay L0 only during initial ground take-up so cables stay inextensible once airborne.
                if (typeof relieveCableOverstretch === 'function') {
                    relieveCableOverstretch({ rising: true, margin: 0.015, trigger: 0.035 });
                }
            }
            // Soft pickup only during tiny < 3cm final slack kiss so all plans lift cargo at the exact same speed
            if (rising && phy.groundClearance < 0.03) {
                const stsDirectRise = (typeof isStsDirectAttach === 'function') && isStsDirectAttach();
                const aboutToTaut = (phy.cables || []).some(c => {
                    if (cableIsBroken(c)) return false;
                    if (!(c.role === 'leg' && c.b && c.b.kind === 'cargo')) return false;
                    if (stsDirectRise) return false;
                    const d = attachWorld(c.a).distanceTo(attachWorld(c.b));
                    return d > c.L0 - 0.05 && d < c.L0 + 0.01;
                });
                if (aboutToTaut) {
                    maxWinch = Math.min(maxWinch, rates.up * 0.65);
                }
            }

            // Hold Kéo/Hạ / Hạ đất: maintain a smooth directional lead without micro-stuttering
            const holdLower = phy.hoistSpeed < -0.01 || !!phy._setDownActive;
            const holdRaise = phy.hoistSpeed > 0.01;
            if (holdLower || holdRaise) {
                if (holdLower) {
                    if (phy.hookTarget.y > kinHold.y - 0.02) {
                        phy.hookTarget.y = kinHold.y - 0.05;
                    }
                } else {
                    const maxLead = 0.04;
                    phy.hookTarget.y = THREE.MathUtils.clamp(phy.hookTarget.y, kinHold.y, kinHold.y + maxLead);
                }
                phy.hookTarget.x = phy.hookPos.x;
                phy.hookTarget.z = phy.hookPos.z;
            }

            const kinTarget = phy.hookTarget.clone().sub(comp);
            // Paying out: never haul the drum upward.  A residual offLP from a
            // prior suspended stretch would otherwise raise kinTarget above the
            // current drum and yank a snug grounded rig into the air.
            if (holdLower && kinTarget.y > hoist.kin.y) {
                kinTarget.y = hoist.kin.y - 0.02;
            }
            const to = new THREE.Vector3().subVectors(kinTarget, hoist.kin);
            const dist = to.length();
            // Hoist drive ramp: a real winch accelerates at ~1.5 m/s² and brakes
            // into a commanded stop instead of halting the drum in one frame
            // (which would shock-load the rope with the whole suspended mass).
            // A held hoist button leads the drum by <= maxLead so the braking
            // profile does not apply there; mouse drag has its own profile.
            let lineSpeed = maxWinch;
            if (!dragging) {
                const accel = 1.5;
                const prevSpeed = hoist.winchSpeed || 0;
                lineSpeed = Math.min(lineSpeed, prevSpeed + accel * dt);
                // Continuous Hạ / Hạ đất must not brake-to-stop mid-air
                const continuousLower = holdLower;
                if (!manual && !continuousLower) {
                    const brake = 2.5;
                    lineSpeed = Math.min(lineSpeed, Math.sqrt(2 * brake * dist) + 0.03);
                }
            }
            const maxStep = lineSpeed * dt;
            if (dist <= maxStep || dist < 1e-5) {
                hoist.kin.copy(kinTarget);
                // A held hoist button / Hạ đất keeps the drum turning; a reached
                // click-target (Nhấc thử) stops it.
                const keepWinching = manual || !!phy._setDownActive;
                hoist.winchSpeed = keepWinching ? lineSpeed : dist / Math.max(dt, 1e-4);
                if (!keepWinching) {
                    phy.autoHoistActive = false;
                    // Nhấc thử arrived: freeze suspended pose (do not drop).
                    if (phy._trialLiftActive && !lowering) {
                        phy._trialLiftActive = false;
                        if (typeof freezeSuspendedHoist === 'function') freezeSuspendedHoist();
                    }
                }
            } else {
                hoist.kin.addScaledVector(to.multiplyScalar(1 / dist), maxStep);
                hoist.winchSpeed = lineSpeed;
            }
            // Trial lift stops at exactly 3.0 m clearance (with ease-out settling)
            if (phy._trialLiftActive && (phy.groundClearance || 0) >= 2.98 && rising) {
                phy.autoHoistActive = false;
                phy.hoistSpeed = 0;
                phy.hookTarget.y = phy.hookPos.y;
                phy._trialLiftActive = false;
                if (typeof freezeSuspendedHoist === 'function') freezeSuspendedHoist();
                const st = document.getElementById('sim-status-text');
                if (st) {
                    st.textContent = (typeof L === 'function')
                        ? L('Trial lift complete — Cargo hovering steadily at 3.0 m above ground.',
                            'Đã hoàn thành nhấc thử — Kiện hàng cách đất 3.0 m và đang giữ treo ổn định.')
                        : 'Đã hoàn thành nhấc thử — Kiện hàng cách đất 3.0 m và đang giữ treo ổn định.';
                }
            }

            // Elastic hoist rope + hook block mass: hook follows the drum through a
            // spring/damper (vertical) and a pendulum (horizontal, real cranes).
            const kinVel = hoist.kin.clone().sub(kinPrev).divideScalar(Math.max(dt, 1e-4));
            stepHoistDynamics(dt, kinVel);

            clampHookOutOfSolids();
            reconcileHoistAfterClamp();

            phy.hookVel.subVectors(phy.hookPos, prev).divideScalar(Math.max(dt, 1e-4));
            // Hook block can rebound at several m/s after a load drop; the winch
            // itself is still limited to ~1.25 m/s by maxWinch above.
            if (phy.hookVel.length() > 4.0) phy.hookVel.setLength(4.0);
        }

        function supportPointsLocal() {
            if (phy.supportLocals && phy.supportLocals.length) return phy.supportLocals;
            const { L, W, H } = state;
            return [
                new THREE.Vector3(-L / 2, -H / 2, -W / 2),
                new THREE.Vector3(L / 2, -H / 2, -W / 2),
                new THREE.Vector3(L / 2, -H / 2, W / 2),
                new THREE.Vector3(-L / 2, -H / 2, W / 2)
            ];
        }

        function rodInertiaInverse(mass, length, axis) {
            if (axis === 'frame') {
                const { spanX, spanZ } = getLPBoundingSpan();
                const sx = Math.max(0.5, spanX);
                const sz = Math.max(0.5, spanZ);
                const Ixx = Math.max(25, mass * (sz * sz / 12 + 0.08));
                const Izz = Math.max(25, mass * (sx * sx / 12 + 0.08));
                const Iyy = Math.max(40, Ixx + Izz);
                return { Ixx: 1 / Ixx, Iyy: 1 / Iyy, Izz: 1 / Izz, Ixy: 0, Ixz: 0, Iyz: 0 };
            }
            const r = 0.24;
            const spin = Math.max(35, mass * (r * r + 0.06));
            const bend = Math.max(12, mass * (length * length / 12 + r * r));
            if (axis === 'z') return { Ixx: 1 / bend, Iyy: 1 / bend, Izz: 1 / spin, Ixy: 0, Ixz: 0, Iyz: 0 };
            return { Ixx: 1 / spin, Iyy: 1 / bend, Izz: 1 / bend, Ixy: 0, Ixz: 0, Iyz: 0 };
        }

        function disposeBeamGroups() {
            (phy.beamGroups || []).forEach(g => {
                if (typeof scene !== 'undefined' && scene) scene.remove(g);
                g.traverse(o => { if (o.geometry && o.geometry.dispose) o.geometry.dispose(); });
            });
            phy.beamGroups = [];
            phy.beams = [];
            phy.cables = [];
        }

        function endOf(kind, id, x, y, z, index) {
            if (kind === 'hook') return { kind: 'hook', index: 0 };
            if (kind === 'hook2') return { kind: 'hook', index: 1 };
            if (kind === 'cargo') return { kind: 'cargo', index: index };
            return { kind: 'body', id: id, local: [x, y, z] };
        }

        /** Dual-crane tandem: second hook offset along cargo length (m). */
        function dualHookOffsetX(sign) {
            const span = (typeof getLPBoundingSpan === 'function')
                ? getLPBoundingSpan().spanX
                : (state.L || 12);
            const half = Math.max(1.2, span * 0.28);
            return (sign >= 0 ? 1 : -1) * half;
        }
        if (typeof window !== 'undefined') window.dualHookOffsetX = dualHookOffsetX;

        function picksOf(id, scale, axis) {
            const spec = memberSpec(id);
            if (spec) return spec;
            const span = Math.max(0.4, (axis === 'z' ? state.W : state.L) * scale);
            return { length: span, a: span / 2, b: -span / 2 };
        }

        function tierPlan(type) {
            if (type !== 'inline4' && type !== 'inline8' && type !== 'spatial8') return null;
            const sx = Math.max(1.6, state.L * 0.92);
            const sz = Math.max(0.7, state.W * 0.86);
            const yLug = state.H / 2 - 0.02;
            const bodies = [];
            const cables = [];
            const lugs = [];
            const addBody = (id, mass, spec, axis, origin) => {
                bodies.push({ id: id, mass: mass, length: spec.length, axis: axis, origin: origin.clone(), members: [id] });
            };
            if (type === 'inline4') {
                const top = picksOf('i4top', 0.62, 'x');
                const a = picksOf('i4lowA', 0.28, 'x');
                const b = picksOf('i4lowB', 0.28, 'x');
                const yTop = (typeof cascadedTopOffsetY === 'function')
                    ? cascadedTopOffsetY()
                    : Math.max(1.40, (state.hangerSlingLength || 2) + 0.40);
                const xC = 0.30 * sx;
                addBody('i4top', 820, top, 'x', new THREE.Vector3(0, yTop, 0));
                addBody('i4lowA', 280, a, 'x', new THREE.Vector3(xC, 0, 0));
                addBody('i4lowB', 280, b, 'x', new THREE.Vector3(-xC, 0, 0));
                cables.push({ role: 'upper', index: 1, a: endOf('hook'), b: endOf('body', 'i4top', top.a, 0, 0) });
                cables.push({ role: 'upper', index: 0, a: endOf('hook'), b: endOf('body', 'i4top', top.b, 0, 0) });
                cables.push({ role: 'hanger', index: 0, a: endOf('body', 'i4top', top.a, 0, 0), b: endOf('body', 'i4lowA', 0, 0, 0) });
                cables.push({ role: 'hanger', index: 1, a: endOf('body', 'i4top', top.b, 0, 0), b: endOf('body', 'i4lowB', 0, 0, 0) });
                [[ 'i4lowA', xC, a.a, 0 ], [ 'i4lowA', xC, a.b, 1 ], [ 'i4lowB', -xC, b.b, 2 ], [ 'i4lowB', -xC, b.a, 3 ]].forEach(row => {
                    cables.push({ role: 'leg', index: row[3], a: endOf('body', row[0], row[2], 0, 0), b: endOf('cargo', null, 0, 0, 0, row[3]) });
                    lugs.push(new THREE.Vector3(row[1] + row[2], yLug, 0));
                });
            } else if (type === 'spatial8') {
                const top = picksOf('s8top', 0.72, 'x');
                const midP = picksOf('s8midP', 0.70, 'z');
                const midM = picksOf('s8midM', 0.70, 'z');
                const bots = ['s8a', 's8b', 's8c', 's8d'].map(id => picksOf(id, 0.16, 'x'));
                const yTop = 2.2;
                const yMid = 1.1;
                const mx = 0.32 * sx;
                const mz = Math.max(0.35, midP.length * 0.5);
                addBody('s8top', 900, top, 'x', new THREE.Vector3(0, yTop, 0));
                addBody('s8midP', 320, midP, 'z', new THREE.Vector3(mx, yMid, 0));
                addBody('s8midM', 320, midM, 'z', new THREE.Vector3(-mx, yMid, 0));
                const seats = [[mx, mz], [mx, -mz], [-mx, mz], [-mx, -mz]];
                seats.forEach((seat, i) => addBody(bots[i] && ['s8a', 's8b', 's8c', 's8d'][i], 220, bots[i], 'x', new THREE.Vector3(seat[0], 0, seat[1])));
                cables.push({ role: 'upper', index: 1, a: endOf('hook'), b: endOf('body', 's8top', top.a, 0, 0) });
                cables.push({ role: 'upper', index: 0, a: endOf('hook'), b: endOf('body', 's8top', top.b, 0, 0) });
                cables.push({ role: 'hanger', index: 0, a: endOf('body', 's8top', top.a, 0, 0), b: endOf('body', 's8midP', 0, 0, 0) });
                cables.push({ role: 'hanger', index: 1, a: endOf('body', 's8top', top.b, 0, 0), b: endOf('body', 's8midM', 0, 0, 0) });
                [['s8midP', mx, midP.a, 's8a', 0], ['s8midP', mx, midP.b, 's8b', 1], ['s8midM', -mx, midM.a, 's8c', 2], ['s8midM', -mx, midM.b, 's8d', 3]].forEach(row => {
                    cables.push({ role: 'hanger', index: 2 + row[4], a: endOf('body', row[0], 0, 0, row[2]), b: endOf('body', row[3], 0, 0, 0) });
                });
                seats.forEach((seat, i) => {
                    const id = ['s8a', 's8b', 's8c', 's8d'][i];
                    const spec = bots[i];
                    [spec.a, spec.b].forEach((along, k) => {
                        const idx = i * 2 + k;
                        cables.push({ role: 'leg', index: idx, a: endOf('body', id, along, 0, 0), b: endOf('cargo', null, 0, 0, 0, idx) });
                        lugs.push(new THREE.Vector3(seat[0] + along, yLug, seat[1]));
                    });
                });
            } else {
                const top = picksOf('n8top', 0.50, 'x');
                const midP = picksOf('n8midP', 0.26, 'x');
                const midM = picksOf('n8midM', 0.26, 'x');
                const lows = ['n8a', 'n8b', 'n8c', 'n8d'].map(id => picksOf(id, 0.14, 'x'));
                const yTop = 2.2;
                const yMid = 1.05;
                const mids = [0.22 * sx, -0.22 * sx];
                const lowsX = [0.34 * sx, 0.12 * sx, -0.12 * sx, -0.34 * sx];
                addBody('n8top', 800, top, 'x', new THREE.Vector3(0, yTop, 0));
                addBody('n8midP', 300, midP, 'x', new THREE.Vector3(mids[0], yMid, 0));
                addBody('n8midM', 300, midM, 'x', new THREE.Vector3(mids[1], yMid, 0));
                lowsX.forEach((x, i) => addBody(['n8a', 'n8b', 'n8c', 'n8d'][i], 200, lows[i], 'x', new THREE.Vector3(x, 0, 0)));
                cables.push({ role: 'upper', index: 1, a: endOf('hook'), b: endOf('body', 'n8top', top.a, 0, 0) });
                cables.push({ role: 'upper', index: 0, a: endOf('hook'), b: endOf('body', 'n8top', top.b, 0, 0) });
                cables.push({ role: 'hanger', index: 0, a: endOf('body', 'n8top', top.a, 0, 0), b: endOf('body', 'n8midP', 0, 0, 0) });
                cables.push({ role: 'hanger', index: 1, a: endOf('body', 'n8top', top.b, 0, 0), b: endOf('body', 'n8midM', 0, 0, 0) });
                [[ 'n8midP', mids[0], midP.a, 'n8a', 0 ], [ 'n8midP', mids[0], midP.b, 'n8b', 1 ], [ 'n8midM', mids[1], midM.a, 'n8c', 2 ], [ 'n8midM', mids[1], midM.b, 'n8d', 3 ]].forEach(row => {
                    cables.push({ role: 'hanger', index: 2 + row[4], a: endOf('body', row[0], row[2], 0, 0), b: endOf('body', row[3], 0, 0, 0) });
                });
                lowsX.forEach((x, i) => {
                    const id = ['n8a', 'n8b', 'n8c', 'n8d'][i];
                    [lows[i].a, lows[i].b].forEach((along, k) => {
                        const idx = i * 2 + k;
                        cables.push({ role: 'leg', index: idx, a: endOf('body', id, along, 0, 0), b: endOf('cargo', null, 0, 0, 0, idx) });
                        lugs.push(new THREE.Vector3(x + along, yLug, 0));
                    });
                });
            }
            return { bodies: bodies, cables: cables, lugs: lugs };
        }

        function placeRigLugs() {
            const plan = tierPlan(state.beamType);
            if (!plan) {
                const want = Math.max(2, Math.min(8, state.planLugCount || 4));
                if (state.lugs.length !== want) {
                    state.lugs.length = want;
                    state.lugNormals.length = want;
                    setSymmetricLugsFromDimensions();
                }
                return false;
            }
            while (state.lugs.length < plan.lugs.length) {
                state.lugs.push(new THREE.Vector3());
                state.lugNormals.push(new THREE.Vector3(0, 1, 0));
            }
            state.lugs.length = plan.lugs.length;
            state.lugNormals.length = plan.lugs.length;
            plan.lugs.forEach((p, i) => {
                state.lugs[i].set(p.x, p.y, p.z);
                state.lugNormals[i].set(0, 1, 0);
            });
            return true;
        }

        function buildTierMeshes(type) {
            const plan = tierPlan(type);
            if (!plan) return;
            plan.bodies.forEach(b => {
                const rad = b.origin.y > 1.6 ? 0.1 : 0.065;
                const mesh = new THREE.Mesh(new THREE.CylinderGeometry(rad, rad, Math.max(0.35, b.length), 18));
                if (b.axis === 'x') mesh.rotation.z = Math.PI / 2;
                if (b.axis === 'z') mesh.rotation.x = Math.PI / 2;
                mesh.position.copy(b.origin);
                tagMember(mesh, b.id);
            });
            plan.cables.forEach(c => {
                if (!c.b || c.b.kind !== 'body') return;
                const host = plan.bodies.find(b => b.id === c.b.id);
                if (!host) return;
                const p = host.origin.clone().add(new THREE.Vector3(c.b.local[0], c.b.local[1], c.b.local[2]));
                addJointShackle(p.x, p.y, p.z, host.id, { role: c.role, index: c.index });
            });
        }

        function beamRecipe() {
            const type = state.beamType;
            const tier = tierPlan(type);
            if (tier) return tier;
            const bodies = [];
            const cables = [];
            const add = (id, mass, length, axis, origin, members) => {
                bodies.push({ id: id, mass: mass, length: length, axis: axis, origin: origin.clone(), members: members });
            };
            const mb = phy.massBreakdown || computeRiggingMassBreakdown();
            const hwShareKg = ((mb.slingsMassT + mb.shacklesMassT + mb.turnbucklesMassT) * 1000) * 0.5;
            const userBeamKg = (state.gear && state.gear.beam && state.gear.beam.massT != null && state.gear.beam.massT > 0)
                ? state.gear.beam.massT * 1000
                : null;

            if (type === 'none') {
                for (let i = 0; i < state.lugs.length; i++) cables.push({ role: 'leg', index: i, a: endOf('hook'), b: endOf('cargo', null, 0, 0, 0, i) });
                return { bodies: bodies, cables: cables, lugs: null };
            }
            if (type === 'container_spreader') {
                // Physics unchanged: direct = 4 short headblock falls + twistlocks;
                // cable = H-beam 2-upper + 4-leg. The “8 vertical ropes” look is visual-only
                // (see updateStsHeadblockVisual) — never add them to the XPBD graph.
                const stsDirect = (typeof isStsDirectAttach === 'function')
                    ? isStsDirectAttach()
                    : (state.stsAttachMode || 'direct') !== 'cable';
                const fit = (typeof resolveStsFitToCargo === 'function')
                    ? resolveStsFitToCargo()
                    : ((typeof isoTwistlockSpan === 'function')
                        ? isoTwistlockSpan(state.stsSizeFt || 40)
                        : { spanX: spanBase().spanX, spanZ: spanBase().spanZ });
                const halfX = (fit.halfX != null) ? fit.halfX : ((fit.spanX || 11.985) * 0.5);
                const halfZ = (fit.halfZ != null) ? fit.halfZ : ((fit.spanZ || 2.259) * 0.5);
                const hangX = !stsDirect && fit.cargoHalfX != null ? fit.cargoHalfX : halfX;
                const hangZ = !stsDirect && fit.cargoHalfZ != null ? fit.cargoHalfZ : halfZ;
                const iso = fit.iso || fit;
                const selfKg = userBeamKg != null ? userBeamKg : (
                    estimateMemberStructuralMassKg('spreader_main')
                    + estimateMemberStructuralMassKg('endPlus')
                    + estimateMemberStructuralMassKg('endMinus')
                );
                add('assembly', Math.max(800, selfKg + hwShareKg), Math.max(fit.spanX || iso.spanX || 4, 4), 'frame', new THREE.Vector3(),
                    ['spreader_main', 'endPlus', 'endMinus']);
                phy._stsPinsSnug = false;

                if (stsDirect) {
                    const hb = [[0.55, 0.48, 0.32], [-0.55, 0.48, 0.32], [-0.55, 0.48, -0.32], [0.55, 0.48, -0.32]];
                    hb.forEach((p, i) => {
                        cables.push({ role: 'upper', index: i, a: endOf('hook'), b: endOf('body', 'assembly', p[0], p[1], p[2]) });
                    });
                    const corners = [
                        [halfX, halfZ], [-halfX, halfZ], [-halfX, -halfZ], [halfX, -halfZ]
                    ];
                    corners.forEach((c, i) => {
                        cables.push({
                            role: 'leg', index: i,
                            a: endOf('body', 'assembly', c[0], STS_TWISTLOCK_FOOT_Y, c[1]),
                            b: endOf('cargo', null, 0, 0, 0, i)
                        });
                    });
                } else {
                    const yTop = 0.22;
                    const yLow = -0.28;
                    cables.push({ role: 'upper', index: 1, a: endOf('hook'), b: endOf('body', 'assembly', hangX, yTop, 0) });
                    cables.push({ role: 'upper', index: 0, a: endOf('hook'), b: endOf('body', 'assembly', -hangX, yTop, 0) });
                    const corners = [
                        [hangX, hangZ], [-hangX, hangZ], [-hangX, -hangZ], [hangX, -hangZ]
                    ];
                    corners.forEach((c, i) => {
                        cables.push({
                            role: 'leg', index: i,
                            a: endOf('body', 'assembly', c[0], yLow, c[1]),
                            b: endOf('cargo', null, 0, 0, 0, i)
                        });
                    });
                }
                return { bodies: bodies, cables: cables, lugs: null };
            }
            if (type === 'spreader') {
                const m = memberSpec('main');
                const yLug = 0.22;
                const selfKg = userBeamKg != null ? userBeamKg : estimateMemberStructuralMassKg('main');
                add('main', Math.max(45, selfKg + hwShareKg), m.length, 'x', new THREE.Vector3(), ['main']);
                const dual = (state.hookCount || 1) >= 2;
                cables.push({ role: 'upper', index: 1, a: dual ? endOf('hook2') : endOf('hook'), b: endOf('body', 'main', m.a, yLug, 0) });
                cables.push({ role: 'upper', index: 0, a: endOf('hook'), b: endOf('body', 'main', m.b, yLug, 0) });
                [[0, m.a, 0.065], [3, m.a, -0.065], [1, m.b, 0.065], [2, m.b, -0.065]].forEach(pair => {
                    cables.push({ role: 'leg', index: pair[0], a: endOf('body', 'main', pair[1], -yLug, pair[2]), b: endOf('cargo', null, 0, 0, 0, pair[0]) });
                });
                return { bodies: bodies, cables: cables, lugs: null };
            }
            if (type === 'lifting_beam') {
                const topMode = state.liftingBeamTopMode || 'bridle2';
                const bottomMode = state.liftingBeamBottomMode || 'cable';
                const sp = spanBase();
                const hb = (typeof RIG !== 'undefined' && RIG.resolveHBeamCorners)
                    ? RIG.resolveHBeamCorners(sp.spanX, sp.spanZ, state, bottomMode)
                    : { halfX: sp.spanX * 0.5, halfZ: sp.spanZ * 0.5, outerX: sp.spanX + 0.28, corners: [[sp.spanX * 0.5, sp.spanZ * 0.5, 0], [-sp.spanX * 0.5, sp.spanZ * 0.5, 1], [-sp.spanX * 0.5, -sp.spanZ * 0.5, 2], [sp.spanX * 0.5, -sp.spanZ * 0.5, 3]] };
                const selfKg = userBeamKg != null ? userBeamKg : estimateMemberStructuralMassKg('main');
                add('main', Math.max(120, selfKg + hwShareKg), hb.outerX, 'x', new THREE.Vector3(), ['main']);
                const dual = (state.hookCount || 1) >= 2;
                if (topMode === 'direct_hook') {
                    cables.push({ role: 'upper', index: 0, a: endOf('hook'), b: endOf('body', 'main', 0, 0.30, 0) });
                } else {
                    cables.push({ role: 'upper', index: 1, a: dual ? endOf('hook2') : endOf('hook'), b: endOf('body', 'main', hb.halfX, 0.24, 0) });
                    cables.push({ role: 'upper', index: 0, a: endOf('hook'), b: endOf('body', 'main', -hb.halfX, 0.24, 0) });
                }
                const yLow = bottomMode === 'direct' ? STS_TWISTLOCK_FOOT_Y : -0.22;
                hb.corners.forEach(([cx, cz, idx]) => {
                    cables.push({ role: 'leg', index: idx, a: endOf('body', 'main', cx, yLow, cz), b: endOf('cargo', null, 0, 0, 0, idx) });
                });
                return { bodies: bodies, cables: cables, lugs: null };
            }
            if (type === 'cascaded' || type === 'modular_truss') {
                const topId = type === 'modular_truss' ? 'truss' : 'top';
                const top = memberSpec(topId);
                const yTop = (typeof cascadedTopOffsetY === 'function')
                    ? cascadedTopOffsetY()
                    : Math.max(type === 'modular_truss' ? 1.25 : 1.40, (state.hangerSlingLength || 2) + 0.40);
                const plus = memberSpec('lowPlus');
                const minus = memberSpec('lowMinus');
                const mTop = estimateMemberStructuralMassKg(topId);
                const mPlus = estimateMemberStructuralMassKg('lowPlus');
                const mMinus = estimateMemberStructuralMassKg('lowMinus');
                const scale = userBeamKg != null ? userBeamKg / Math.max(10, mTop + mPlus + mMinus) : 1.0;
                add(topId, Math.max(45, mTop * scale + hwShareKg * 0.4), top.length, 'x', new THREE.Vector3(0, yTop, 0), [topId]);
                add('lowPlus', Math.max(35, mPlus * scale + hwShareKg * 0.3), plus.length, 'z', new THREE.Vector3(top.a, 0, 0), ['lowPlus']);
                add('lowMinus', Math.max(35, mMinus * scale + hwShareKg * 0.3), minus.length, 'z', new THREE.Vector3(top.b, 0, 0), ['lowMinus']);
                // 2-4-4: 2 uppers → top beam; 4 hangers (2 per sub-beam, end-to-end V); 4 legs
                cables.push({ role: 'upper', index: 1, a: endOf('hook'), b: endOf('body', topId, top.a, 0.22, 0) });
                cables.push({ role: 'upper', index: 0, a: endOf('hook'), b: endOf('body', topId, top.b, 0.22, 0) });
                // Twin hangers from each main end → both ends of that sub-beam (never a centre drop)
                cables.push({ role: 'hanger', index: 0, a: endOf('body', topId, top.a, -0.22, 0.06), b: endOf('body', 'lowPlus', 0, 0.18, plus.a) });
                cables.push({ role: 'hanger', index: 1, a: endOf('body', topId, top.a, -0.22, -0.06), b: endOf('body', 'lowPlus', 0, 0.18, plus.b) });
                cables.push({ role: 'hanger', index: 2, a: endOf('body', topId, top.b, -0.22, 0.06), b: endOf('body', 'lowMinus', 0, 0.18, minus.a) });
                cables.push({ role: 'hanger', index: 3, a: endOf('body', topId, top.b, -0.22, -0.06), b: endOf('body', 'lowMinus', 0, 0.18, minus.b) });
                [[0, 'lowPlus', plus.a], [3, 'lowPlus', plus.b], [1, 'lowMinus', minus.a], [2, 'lowMinus', minus.b]].forEach(row => {
                    cables.push({ role: 'leg', index: row[0], a: endOf('body', row[1], 0, -0.18, row[2]), b: endOf('cargo', null, 0, 0, 0, row[0]) });
                });
                return { bodies: bodies, cables: cables, lugs: null };
            }
            if (type === 'basket') {
                const pos = memberSpec('barPos');
                const neg = memberSpec('barNeg');
                const mPos = estimateMemberStructuralMassKg('barPos');
                const mNeg = estimateMemberStructuralMassKg('barNeg');
                const scale = userBeamKg != null ? userBeamKg / Math.max(10, mPos + mNeg) : 1.0;
                const halfX = spanBase().spanX / 2;
                add('barPos', Math.max(35, mPos * scale + hwShareKg * 0.5), pos.length, 'z', new THREE.Vector3(halfX, 0, 0), ['barPos']);
                add('barNeg', Math.max(35, mNeg * scale + hwShareKg * 0.5), neg.length, 'z', new THREE.Vector3(-halfX, 0, 0), ['barNeg']);
                cables.push({ role: 'upper', index: 0, a: endOf('hook'), b: endOf('body', 'barPos', 0, 0.14, pos.a) });
                cables.push({ role: 'upper', index: 3, a: endOf('hook'), b: endOf('body', 'barPos', 0, 0.14, pos.b) });
                cables.push({ role: 'upper', index: 1, a: endOf('hook'), b: endOf('body', 'barNeg', 0, 0.14, neg.a) });
                cables.push({ role: 'upper', index: 2, a: endOf('hook'), b: endOf('body', 'barNeg', 0, 0.14, neg.b) });
                cables.push({ role: 'leg', index: 0, a: endOf('body', 'barPos', 0, -0.14, pos.a), b: endOf('cargo', null, 0, 0, 0, 0) });
                cables.push({ role: 'leg', index: 3, a: endOf('body', 'barPos', 0, -0.14, pos.b), b: endOf('cargo', null, 0, 0, 0, 3) });
                cables.push({ role: 'leg', index: 1, a: endOf('body', 'barNeg', 0, -0.14, neg.a), b: endOf('cargo', null, 0, 0, 0, 1) });
                cables.push({ role: 'leg', index: 2, a: endOf('body', 'barNeg', 0, -0.14, neg.b), b: endOf('cargo', null, 0, 0, 0, 2) });
                return { bodies: bodies, cables: cables, lugs: null };
            }
            if (type === 'frame') {
                const railPos = memberSpec('railPos');
                const railNeg = memberSpec('railNeg');
                const endPos = memberSpec('endPos');
                const endNeg = memberSpec('endNeg');
                const mRP = estimateMemberStructuralMassKg('railPos');
                const mRN = estimateMemberStructuralMassKg('railNeg');
                const mEP = estimateMemberStructuralMassKg('endPos');
                const mEN = estimateMemberStructuralMassKg('endNeg');
                const sumM = Math.max(10, mRP + mRN + mEP + mEN);
                const scale = userBeamKg != null ? userBeamKg / sumM : 1.0;
                const totalBeamKg = (mRP + mRN + mEP + mEN) * scale;
                const span = Math.max(spanBase().spanX, spanBase().spanZ, 1);
                add('frame', Math.max(50, totalBeamKg + hwShareKg), span, 'frame', new THREE.Vector3(), ['railPos', 'railNeg', 'endPos', 'endNeg']);
                const dualFrm = (state.hookCount || 1) >= 2;
                for (let i = 0; i < 4; i++) {
                    const posX = i === 0 || i === 3;
                    const posZ = i === 0 || i === 1;
                    const rail = memberSpec(posZ ? 'railPos' : 'railNeg');
                    const end = memberSpec(posX ? 'endPos' : 'endNeg');
                    const x = posX ? rail.a : rail.b;
                    const z = posZ ? end.a : end.b;
                    // Tandem: +X corners → crane A, −X corners → crane B
                    const hookEnd = (dualFrm && !posX) ? endOf('hook2') : endOf('hook');
                    cables.push({ role: 'upper', index: i, a: hookEnd, b: endOf('body', 'frame', x, 0.18, z) });
                    cables.push({ role: 'leg', index: i, a: endOf('body', 'frame', x, -0.18, z), b: endOf('cargo', null, 0, 0, 0, i) });
                }
                return { bodies: bodies, cables: cables, lugs: null };
            }
            const span = Math.max(spanBase().spanX, spanBase().spanZ, 1);
            const totalBeamKg = userBeamKg != null ? userBeamKg : (mb.beamMassT * 1000 || 650);
            add('assembly', Math.max(50, totalBeamKg + hwShareKg), span, 'x', new THREE.Vector3(), null);
            const n = Math.min(4, state.lugs.length);
            const dualAsm = (state.hookCount || 1) >= 2;
            for (let i = 0; i < n; i++) {
                const p = spreaderLocalAnchor(i);
                const yUp = Math.abs(p.y) > 0.02 ? Math.abs(p.y) : 0.16;
                const yLow = Math.abs(p.y) > 0.02 ? -Math.abs(p.y) : -0.16;
                const hookEnd = (dualAsm && p.x < 0) ? endOf('hook2') : endOf('hook');
                cables.push({ role: 'upper', index: i, a: hookEnd, b: endOf('body', 'assembly', p.x, yUp, p.z) });
                cables.push({ role: 'leg', index: i, a: endOf('body', 'assembly', p.x, yLow, p.z), b: endOf('cargo', null, 0, 0, 0, i) });
            }
            return { bodies: bodies, cables: cables, lugs: null };
        }

        function mountBeamBodies() {
            // Self-healing cleanup: return any previously claimed children from phy.beams back to spreaderRootGroup
            // and remove old phy.beamGroups from scene so calling mountBeamBodies() directly can never orphan meshes!
            if (phy.beams && phy.beams.length) {
                phy.beams.forEach(oldB => {
                    if (!oldB.group) return;
                    oldB.group.children.slice().forEach(ch => {
                        if (oldB.origin) ch.position.add(oldB.origin);
                        spreaderRootGroup.add(ch);
                    });
                    if (typeof scene !== 'undefined' && scene) scene.remove(oldB.group);
                });
            }
            if (phy.beamGroups && phy.beamGroups.length) {
                phy.beamGroups.forEach(g => {
                    if (typeof scene !== 'undefined' && scene) scene.remove(g);
                });
            }
            const hangers = [];
            spreaderRootGroup.traverse(o => { if (o.userData && o.userData.isHanger) hangers.push(o); });
            hangers.forEach(h => { if (h.parent) h.parent.remove(h); });
            const plan = beamRecipe();
            appendUserCables(plan);
            const dyn = plan.bodies.map(b => {
                const mass = Math.max(60, b.mass, (state.weight || 10) * 35);
                return {
                    id: b.id, mass: mass, length: b.length, axis: b.axis,
                    origin: b.origin.clone(), members: b.members,
                    x: new THREE.Vector3(), q: new THREE.Quaternion(),
                    v: new THREE.Vector3(), w: new THREE.Vector3(),
                    invMass: 1 / mass, invI: rodInertiaInverse(mass, Math.max(0.4, b.length), b.axis),
                    radius: solidRadius(b.members),
                    group: null
                };
            });
            phy.beams = dyn;
            phy.beamGroups = [];
            const claimed = new Set();
            dyn.forEach(b => {
                const g = new THREE.Group();
                g.userData.beamId = b.id;
                scene.add(g);
                b.group = g;
                phy.beamGroups.push(g);
                spreaderRootGroup.children.slice().forEach(ch => {
                    if (claimed.has(ch)) return;
                    const id = ch.userData && ch.userData.memberId;
                    const take = b.members == null ? true : (id && b.members.indexOf(id) >= 0);
                    if (!take) return;
                    claimed.add(ch);
                    ch.position.sub(b.origin);
                    g.add(ch);
                });
                calibrateBeamCollisionProxy(b);
            });
            // Safety net: any untagged decorative child left on spreaderRootGroup would
            // otherwise freeze at world origin after applyBeamVisuals zeros the root.
            if (dyn.length && spreaderRootGroup) {
                const primary = dyn[0];
                spreaderRootGroup.children.slice().forEach(ch => {
                    if (claimed.has(ch)) return;
                    claimed.add(ch);
                    if (!ch.userData) ch.userData = {};
                    if (!ch.userData.memberId) ch.userData.memberId = (primary.members && primary.members[0]) || primary.id;
                    ch.position.sub(primary.origin);
                    primary.group.add(ch);
                });
            }
            const resolve = (end) => {
                if (!end || end.kind === 'hook' || end.kind === 'cargo') return { kind: end ? end.kind : 'hook', index: end ? end.index : 0 };
                const body = dyn.find(b => b.id === end.id);
                return { kind: 'body', body: body, local: new THREE.Vector3(end.local[0], end.local[1], end.local[2]) };
            };
            phy.cables = plan.cables.map(c => ({
                role: c.role, index: c.index, a: resolve(c.a), b: resolve(c.b),
                L0: 1, designL0: 1, tensionT: 0, slack: true, n: new THREE.Vector3(0, 1, 0),
                _lam: 0, _sum: 0, _n: 0, break: null
            }));
            syncCableRest(true);
            seedBeamsFromKinematic();
            syncCableRest(false);
            (phy.cables || []).forEach(c => {
                if (cableIsBroken(c)) initCableBreak(c);
                else c.break = null;
            });
            applyBeamVisuals();
        }

        function basketHangPointFromMaster(master, intactWorld, halfZ, dUpAx, sideSign) {
            // Free end of a bar after its lower leg snaps: hangs from upper sling under self-weight
            const lateral = intactWorld.clone().sub(master);
            lateral.y = 0;
            if (lateral.lengthSq() < 1e-6) lateral.set(0, 0, sideSign || 1);
            lateral.normalize();
            const alongBar = new THREE.Vector3().crossVectors(new THREE.Vector3(0, 1, 0), lateral);
            if (alongBar.lengthSq() < 1e-6) alongBar.set(0, 0, sideSign || 1);
            alongBar.normalize().multiplyScalar(halfZ * (sideSign || 1));
            const hang = master.clone()
                .add(new THREE.Vector3(0, -(dUpAx + 0.14), 0))
                .add(alongBar.multiplyScalar(0.15))
                .addScaledVector(lateral, 0.05);
            return hang;
        }

        function alignBasketBars(specInput) {
            if (state.beamType !== 'basket' || !phy.beams || !phy.beams.length) return;
            const spec = specInput || getRigSpec();
            const master = new THREE.Vector3(phy.hookPos.x, phy.hookPos.y + HOOK_MASTER_OFFSET_Y, phy.hookPos.z);
            const isGrounded = state.poseLock || (phy.groundClearance || 0) <= 0.05;
            // Cargo not yet on the hook: only gear self-weight hangs → bars drop straight down.
            // "Load geometry" (tent out to the lugs) only appears once lowers start taking the lift.
            const legLoad = (phy.cables || []).some(c =>
                c.role === 'leg' && !cableIsBroken(c) && ((c.tensionT || 0) > 0.12 || (!c.slack && (c._j || 0) > 1e-4))
            );
            const loweringNow = !!(
                (phy.hoistSpeed || 0) < -0.01
                || phy._setDownActive
                || (phy.hookTarget && phy.hookPos && phy.hookTarget.y < phy.hookPos.y - 0.02)
            );
            const nhomTaut = !!(phy && phy._nhomFreezeSpreader && state.poseLock);
            const takingUp = !loweringNow && isGrounded && (
                (phy.hoistSpeed || 0) > 0.015
                || !!phy.autoHoistActive
                || legLoad
            );
            const cargoAirborne = !isGrounded;
            // 0 = free hang under hook (gravity), 1 = spread toward cargo lugs under lift
            let loadBlend = 0;
            if (cargoAirborne) loadBlend = 1;
            else if (takingUp) {
                const clear = THREE.MathUtils.clamp((phy.groundClearance || 0) / 0.12, 0, 1);
                loadBlend = THREE.MathUtils.clamp(0.15 + clear * 0.85 + (legLoad ? 0.35 : 0), 0, 1);
            }

            const pairs = [
                { id: 'barPos', iA: 0, iB: 3, side: 1 },
                { id: 'barNeg', iA: 1, iB: 2, side: -1 }
            ];
            pairs.forEach(pair => {
                const b = phy.beams.find(item => item.id === pair.id);
                if (!b || !state.lugs[pair.iA] || !state.lugs[pair.iB]) return;
                const legABroken = !!(state.gear.legs[pair.iA] && state.gear.legs[pair.iA].broken);
                const legBBroken = !!(state.gear.legs[pair.iB] && state.gear.legs[pair.iB].broken);
                const lugA = attachWorld({ kind: 'cargo', index: pair.iA });
                const lugB = attachWorld({ kind: 'cargo', index: pair.iB });
                const specBar = memberSpec(pair.id);
                const halfZ = specBar
                    ? Math.max(0.15, Math.abs(specBar.a - specBar.b) * 0.5)
                    : Math.max(0.15, lugA.distanceTo(lugB) * 0.5);
                const barRad = Math.max(0.06, beamCollisionRadius(b));

                const cUpA = (phy.cables || []).find(c => c.role === 'upper' && c.index === pair.iA);
                const cUpB = (phy.cables || []).find(c => c.role === 'upper' && c.index === pair.iB);
                const L_up = (cUpA && cUpB && cUpA.L0 > 0.25)
                    ? 0.5 * (cUpA.L0 + cUpB.L0)
                    : 0.5 * (upperRestLength(pair.iA, spec) + upperRestLength(pair.iB, spec));
                // Free hang: bar level under hook → half-span is along Z, drop = sqrt(L^2 - halfZ^2)
                const dUpAx = Math.sqrt(Math.max(0.09, L_up * L_up - halfZ * halfZ));

                let eA = lugA;
                let eB = lugB;
                if (legABroken && !legBBroken) {
                    eA = basketHangPointFromMaster(master, lugB, halfZ, dUpAx, 1);
                } else if (legBBroken && !legABroken) {
                    eB = basketHangPointFromMaster(master, lugA, halfZ, dUpAx, -1);
                } else if (legABroken && legBBroken) {
                    eA = basketHangPointFromMaster(master, lugA, halfZ, dUpAx, 1);
                    eB = basketHangPointFromMaster(master, lugB, halfZ, dUpAx, -1);
                }

                const eMid = eA.clone().add(eB).multiplyScalar(0.5);
                const spanVec = eA.clone().sub(eB);
                // Cargo-side unit in XZ (which end of the load this bar serves)
                const sideXZ = eMid.clone().sub(master);
                sideXZ.y = 0;
                if (sideXZ.lengthSq() < 1e-6) sideXZ.set(pair.side || 1, 0, 0);
                sideXZ.normalize();

                // --- Free hang (self-weight under gravity): straight down under the hook ---
                // Upper cables carry the ~450 kg steel bar vertically taut until it touches cargo roof.
                const freeSep = Math.max(barRad * 2.2, 0.14);
                const dropUpFree = Math.sqrt(Math.max(0.09, dUpAx * dUpAx - freeSep * freeSep));
                const freeHang = master.clone().addScaledVector(sideXZ, freeSep);
                freeHang.y -= (dropUpFree + 0.14);
                const floorFree = cargoCeilingUnderBeam(freeHang.x, freeHang.z, spec, b);
                if (!cargoAirborne && freeHang.y < floorFree) freeHang.y = floorFree;

                // --- True 2-link equilibrium under gravity: strictly conserve both upper (r1) and lower (r2) lengths ---
                const toMid = eMid.clone().sub(master);
                const dist = Math.max(1e-4, toMid.length());
                const u = toMid.clone().multiplyScalar(1 / dist);
                const cLowA = (phy.cables || []).find(c => c.role === 'leg' && c.index === pair.iA);
                const cLowB = (phy.cables || []).find(c => c.role === 'leg' && c.index === pair.iB);
                const L_low = (cLowA && cLowB && cLowA.L0 > 0.25)
                    ? 0.5 * (cLowA.L0 + cLowB.L0)
                    : (spec.lower || 1.5);
                // Lower slings run along the end of the cargo between bar ends and corner lugs (dz ≈ 0.04 m),
                // NOT across halfZ to the hook centerline (subtracting halfZ² shrank r2 by ~0.35 m and left
                // lower slings visibly slack in mid-air beneath floating bars).
                const halfLugZ = lugA.distanceTo(lugB) * 0.5;
                const dzLow = Math.abs(halfLugZ - halfZ);
                const dLowAx = Math.sqrt(Math.max(0.04, L_low * L_low - dzLow * dzLow));
                const r1 = (legABroken || legBBroken) ? (dUpAx + 0.55) : (dUpAx + 0.14);
                let r2 = dLowAx + 0.14;
                const distFree = freeHang.distanceTo(eMid);
                const floorAtLugSide = cargoCeilingUnderBeam(eMid.x, eMid.z, spec, b);
                const dyRoof = floorAtLugSide - eMid.y;
                const r2Roof = dLowAx + 0.06;
                const dxLowRoof = (r2Roof > Math.abs(dyRoof))
                    ? Math.sqrt(Math.max(0.01, r2Roof * r2Roof - dyRoof * dyRoof))
                    : 0.05;
                const distXZ = Math.hypot(eMid.x - master.x, eMid.z - master.z);
                const roofTethered = eMid.clone().addScaledVector(sideXZ, -Math.min(dxLowRoof, Math.max(0, distXZ - 0.14)));
                roofTethered.y = cargoCeilingUnderBeam(roofTethered.x, roofTethered.z, spec, b);
                // Cargo cannot be lifted at a shallow kink before full r1 + r2 length is taken up.
                b._basketPathReady = !state.poseLock && ((phy.groundClearance || 0) > 0.015 || dist >= r1 + r2 - 0.03);

                if (!cargoAirborne && distFree <= r2 + 0.02) {
                    // Lower sling is long enough to remain slack at plumb hang → gravity holds bar vertically under hook.
                    b.x.copy(freeHang);
                } else if (cargoAirborne || dist >= r1 + r2 - 1e-4) {
                    const maxReach = (legABroken || legBBroken) ? (dUpAx + 0.55) : r1;
                    b.x.copy(master).addScaledVector(u, Math.min(maxReach, dist));
                } else if (dist > Math.abs(r1 - r2) + 1e-4) {
                    // Gravity pulls steel bar to lower circle intersection so upper (r1) & lower (r2) NEVER stretch.
                    const down = new THREE.Vector3(0, -1, 0);
                    const vDown = down.clone().addScaledVector(u, -down.dot(u));
                    if (vDown.lengthSq() > 1e-6) vDown.normalize();
                    else vDown.copy(sideXZ);
                    const solveLowerCircle = (r2Val) => {
                        const a = (r1 * r1 - r2Val * r2Val + dist * dist) / (2 * dist);
                        const h = Math.sqrt(Math.max(0, r1 * r1 - a * a));
                        return master.clone().addScaledVector(u, a).addScaledVector(vDown, h);
                    };
                    let pInt = solveLowerCircle(r2);
                    // Refine padeye projection cos between upper axis (master - pInt) and lower leg (pInt - eMid)
                    const upDir = master.clone().sub(pInt);
                    const lowDir = pInt.clone().sub(eMid);
                    if (upDir.lengthSq() > 1e-6 && lowDir.lengthSq() > 1e-6) {
                        const alignCos = THREE.MathUtils.clamp(upDir.normalize().dot(lowDir.normalize()), 0.25, 1.0);
                        r2 = dLowAx + 0.14 * alignCos;
                        if (dist > Math.abs(r1 - r2) + 1e-4 && dist < r1 + r2 - 1e-4) {
                            pInt = solveLowerCircle(r2);
                        }
                    }
                    const floorInt = cargoCeilingUnderBeam(pInt.x, pInt.z, spec, b);
                    if (!cargoAirborne && pInt.y < floorInt) {
                        // Bar has landed on cargo roof: lower cable tethers bar at roofTethered (≤ r2 from lug),
                        // so bar never slides to cargo center or off cargo ends, and upper cable drapes slack under gravity.
                        b.x.copy(roofTethered.distanceTo(master) <= r1 + 0.02 ? roofTethered : pInt);
                    } else {
                        b.x.copy(pInt);
                    }
                } else {
                    // Very low hook (dist <= |r1 - r2|): keep bar on roof within lower cable radius r2 of lug.
                    b.x.copy(roofTethered);
                }

                // Seat on TRUE cargo roof when grounded so steel bar rests heavily on cargo lid.
                const floorY = cargoCeilingUnderBeam(b.x.x, b.x.z, spec, b);
                if (!cargoAirborne || (legABroken && legBBroken)) {
                    if (b.x.y < floorY) b.x.y = floorY;
                }
                const shell = cargoShellTopRaw(b.x.x, b.x.z, spec);
                b.isRestingOnCargo = !cargoAirborne && ((b.x.y - beamCargoContactPad(b)) <= shell + 0.04);

                // Orientation: level bar; Y points up the bridle to the hook (no upward "kênh")
                let yAxis = master.clone().sub(b.x);
                if (yAxis.lengthSq() < 1e-6) yAxis.set(0, 1, 0);
                yAxis.normalize();
                // Prefer designed Z span of the bar; fall back to lug span
                let zAxis = new THREE.Vector3(0, 0, 1).applyQuaternion(phy.cargoQuat || new THREE.Quaternion());
                if (spanVec.lengthSq() > 1e-6) {
                    zAxis = spanVec.clone().addScaledVector(yAxis, -spanVec.dot(yAxis));
                } else {
                    zAxis.addScaledVector(yAxis, -zAxis.dot(yAxis));
                }
                if (zAxis.lengthSq() < 1e-6) zAxis.set(0, 0, 1);
                zAxis.normalize();
                const xAxis = new THREE.Vector3().crossVectors(yAxis, zAxis).normalize();
                zAxis = new THREE.Vector3().crossVectors(xAxis, yAxis).normalize();
                b.q.setFromRotationMatrix(new THREE.Matrix4().makeBasis(xAxis, yAxis, zAxis));
                b.v.copy(phy.hookVel);
                b.w.set(0, 0, 0);

                if (!cargoAirborne || (legABroken && legBBroken)) {
                    depenetrateBeamFromCargo(b, 4);
                }
                if (b.isRestingOnCargo) b.isRestingOnCargo = true;
            });
        }

        function clampBeamAboveCargoRoof(b) {
            if (!b || state.beamType === 'none') return;
            const spec = (typeof getRigSpec === 'function') ? getRigSpec() : null;
            const floorY = cargoCeilingUnderBeam(b.x.x, b.x.z, spec, b);
            if (isFinite(floorY) && floorY > -1e5 && b.x.y < floorY) {
                b.x.y = floorY;
                if (b.v) b.v.y = Math.max(0, b.v.y);
                b.isRestingOnCargo = true;
            }
            if (typeof depenetrateBeamFromCargo === 'function') depenetrateBeamFromCargo(b, 4);
            if (b.group) {
                b.group.position.copy(b.x);
                if (b.q) b.group.quaternion.copy(b.q);
            }
        }

