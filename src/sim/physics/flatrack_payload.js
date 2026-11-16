/**
 * physics/flatrack_payload — OOG lashing / slide / fall
 * Split from legacy god-file (strangler Phase 2). Shared scope via assemble.
 */
        // --- FLAT RACK LASHING RUPTURE, DECK SLIDING & FALLING PAYLOAD PHYSICS ---
        function resetFlatRackPayloadState() {
            phy.effectiveCargoWeightT = null;
            phy.oogState = {
                status: 'secured',
                strapsBroken: false,
                strapStress: 0,
                localPos: new THREE.Vector3(0, 0, 0),
                localVel: new THREE.Vector3(0, 0, 0),
                worldPos: new THREE.Vector3(),
                worldQuat: new THREE.Quaternion(),
                worldVel: new THREE.Vector3(),
                worldOmega: new THREE.Vector3(),
                slideSideSign: 1,
                impactedGround: false,
                // These values are intentionally kept in the simulation state
                // (rather than inferred from the meshes).  They make the
                // compound cargo / lashing system inspectable by the runtime
                // tests and by the incident telemetry panel.
                lashing: {
                    isIntact: true,
                    staticFriction: 0.32,
                    kineticFriction: 0.20,
                    capacityN: 0,
                    demandN: 0
                },
                endWalls: { negativeXIntact: true, positiveXIntact: true },
                deckNormalOffset: 0,
                lastCompoundPenetration: 0,
                ruptureCascadeTimer: 0
            };
            if (!activeCargoVisual) return;
            const oogGroup = activeCargoVisual.getObjectByName('flatRackOogCargo');
            const lashingGroup = activeCargoVisual.getObjectByName('flatRackLashingStraps');
            const brokenGroup = activeCargoVisual.getObjectByName('flatRackBrokenStraps');
            if (oogGroup) {
                oogGroup.position.set(0, 0, 0);
                oogGroup.quaternion.identity();
                oogGroup.visible = true;
            }
            if (lashingGroup) lashingGroup.visible = true;
            if (brokenGroup) brokenGroup.visible = false;
            if (typeof RIG !== 'undefined' && RIG.resetFlatRackLashingNodes) {
                RIG.resetFlatRackLashingNodes(activeCargoVisual);
            }
        }

        function stepFlatRackPayloadPhysics(dt) {
            if (state.cargoType !== 'flatrack' || state.oogHasCargo === false || !activeCargoVisual) {
                phy.effectiveCargoWeightT = null;
                return;
            }
            const oogGroup = activeCargoVisual.getObjectByName('flatRackOogCargo');
            if (!oogGroup || !oogGroup.userData || !oogGroup.userData.oogMeta) return;
            if (!phy.oogState) resetFlatRackPayloadState();
            const st = phy.oogState;
            const meta = oogGroup.userData.oogMeta;
            const invCargoQ = phy.cargoQuat.clone().invert();
            const gLocal = new THREE.Vector3(0, -G_EARTH, 0).applyQuaternion(invCargoQ);
            const tiltRad = Math.acos(THREE.MathUtils.clamp(-gLocal.y / G_EARTH, -1, 1));
            const tiltDeg = THREE.MathUtils.radToDeg(tiltRad);
            const anyBrokenSling = (state.gear.legs || []).some(l => l && l.broken) || (state.gear.uppers || []).some(u => u && u.broken);
            const isGroundedFlat = state.poseLock || ((phy.groundClearance || 0) <= 0.05 && tiltDeg < 3.5);
            const payloadMassKg = Math.max(1000, ((state.weight || 22) - (state.tareT || 4.8)) * 1000);
            const gNormal = Math.max(0, -gLocal.y);
            const gParallel = Math.hypot(gLocal.x, gLocal.z);
            const lashing = st.lashing || (st.lashing = { isIntact: !st.strapsBroken, staticFriction: 0.32, kineticFriction: 0.20, capacityN: 0, demandN: 0 });
            // A scenario can specify its certified aggregate lashing MBL.  The
            // default remains deliberately conservative for the visual demo,
            // but physics always compares force (N) with force (N).
            const lashingCapacityN = Math.max(1,
                Number.isFinite(state.oogLashingMblN)
                    ? state.oogLashingMblN
                    : payloadMassKg * G_EARTH * 0.42
            );
            const lashingDemandN = Math.max(0, payloadMassKg * (gParallel - lashing.staticFriction * gNormal));
            lashing.capacityN = lashingCapacityN;
            lashing.demandN = lashingDemandN;

            if (st.status === 'secured') {
                // If cargo is resting flat on the ground / dunnage, normal reaction holds it firmly.
                // Straps never break while resting flat on dunnage.
                if (isGroundedFlat) {
                    st.strapStress = Math.max(0, st.strapStress - 1.5 * dt);
                    return;
                }

                // When hoisted or tilted into an inclined ramp:
                // Shear load on straps depends on cargo mass and sine of deck slope angle
                // Following an asymmetric sling rupture the lashing is already
                // shock-loaded and a small persistent deck slope is enough to
                // start ratchet slip.  An intact, normally handled Flat Rack
                // retains the much higher 18° static threshold.
                const critDeg = anyBrokenSling ? 3.0 : 18.0;
                if (tiltDeg > critDeg) {
                    const netRatio = Math.max(0.1, (Math.sin(tiltRad) - 0.28 * Math.cos(tiltRad)) / 0.25);
                    const massScale = Math.min(2.0, Math.max(0.6, payloadMassKg / 15000));
                    const rate = netRatio * massScale * (anyBrokenSling ? 8.5 : 2.2);
                    // The force gate makes an explicitly under-rated lashing
                    // fail immediately.  The accumulated dynamic term models
                    // shock loading after a sling parts, so a real sudden tilt
                    // does not need a fake position jump to release the load.
                    const overload = lashingDemandN / lashingCapacityN;
                    // Keep the original dynamic-incident accumulation at its
                    // nominal rate; an MBL overload only accelerates it.  This
                    // preserves realistic delayed rupture after a sudden sling
                    // failure while still making a demonstrably under-rated
                    // lashing fail without delay.
                    st.strapStress += Math.max(1, overload) * rate * dt;
                } else {
                    st.strapStress = Math.max(0, st.strapStress - 0.8 * dt);
                }

                const sparkSnap = (node) => {
                    [-1, 1].forEach(sz => {
                        const pLocal = new THREE.Vector3(node.sx, meta.cargoBottomY + meta.cH * 0.35, sz * meta.cW * 0.5);
                        spawnSnapSparks(pLocal.applyQuaternion(phy.cargoQuat).add(phy.cargoPos));
                    });
                };
                if (typeof RIG !== 'undefined' && RIG.stepStaggeredLashingBreakPhysics) {
                    const res = RIG.stepStaggeredLashingBreakPhysics({
                        st, oogGroup, gLocal, dt, lashingDemandN, lashingCapacityN, onStrapSnap: sparkSnap
                    });
                    if (res.anySnappedNow && typeof simAudio !== 'undefined') simAudio.playCableSnap({ role: 'strap', type: 'web' });
                }

                if (lashingDemandN >= lashingCapacityN || st.strapStress >= 1.0) {
                    st.status = 'sliding';
                    st.strapsBroken = true;
                    lashing.isIntact = false;
                    st.aSlide = G_EARTH * (Math.sin(tiltRad) - lashing.kineticFriction * Math.cos(tiltRad));
                    st.deckTiltRad = tiltRad;
                    if (typeof simAudio !== 'undefined') {
                        simAudio.playCableSnap({ role: 'strap', type: 'web' });
                    }
                    st.localVel.set(0, 0, 0);
                    const brokenGroup = activeCargoVisual.getObjectByName('flatRackBrokenStraps');
                    if (brokenGroup) brokenGroup.visible = true;
                    if (typeof RIG !== 'undefined' && RIG.stepStaggeredLashingBreakPhysics) {
                        RIG.stepStaggeredLashingBreakPhysics({
                            st, oogGroup, gLocal, dt: Math.max(dt, 0.02), lashingDemandN, lashingCapacityN, onStrapSnap: sparkSnap
                        });
                    } else {
                        const lashingGroup = activeCargoVisual.getObjectByName('flatRackLashingStraps');
                        if (lashingGroup) lashingGroup.visible = false;
                        [-0.32, 0.32].forEach(xf => [-1, 1].forEach(zf => {
                            const pLocal = new THREE.Vector3(xf * meta.cL, meta.cargoBottomY + meta.cH * 0.35, zf * meta.cW * 0.5);
                            spawnSnapSparks(pLocal.applyQuaternion(phy.cargoQuat).add(phy.cargoPos));
                        }));
                    }
                    const statusEl = document.getElementById('sim-status-text');
                    if (statusEl) {
                        statusEl.textContent = `CẢNH BÁO SỰ CỐ: Độ nghiêng sàn (${tiltDeg.toFixed(1)}°) vượt giới hạn giữ tải! DÂY CHẰNG BUỘC ĐÃ ĐỨT! Kiện hàng đang trượt theo độ dốc sàn Flat Rack!`;
                    }
                }
                return;
            }

            if (st.status === 'sliding') {
                if (typeof RIG !== 'undefined' && RIG.stepStaggeredLashingBreakPhysics) {
                    RIG.stepStaggeredLashingBreakPhysics({
                        st, oogGroup, gLocal, dt, lashingDemandN, lashingCapacityN,
                        onStrapSnap: (node) => [-1, 1].forEach(sz => {
                            const pLocal = new THREE.Vector3(node.sx, meta.cargoBottomY + meta.cH * 0.35, sz * meta.cW * 0.5);
                            spawnSnapSparks(pLocal.applyQuaternion(phy.cargoQuat).add(phy.cargoPos));
                        })
                    });
                }
                if ((phy.groundClearance || 0) <= 0.05 && tiltDeg < 2.5) {
                    st.localVel.multiplyScalar(Math.exp(-dt * 14.0));
                    return;
                }

                // 1. Inclined-plane sliding (Phase 3):
                // a_slide = g (sinθ − μ_k cosθ) along the deck plane (gLocal XZ).
                // Motion stays PARALLEL to the deck (local Y locked) until edge tip-off.
                let ax = gLocal.x;
                let az = gLocal.z;
                const gN = gNormal;
                const vSpd = Math.hypot(st.localVel.x, st.localVel.z);
                const muK = lashing.kineticFriction;
                const aSlideMag = G_EARTH * (Math.sin(tiltRad) - muK * Math.cos(tiltRad));
                st.aSlide = aSlideMag;
                st.deckTiltRad = tiltRad;

                if (vSpd > 1e-4) {
                    const fMag = Math.min(vSpd / dt, muK * gN);
                    ax -= fMag * (st.localVel.x / vSpd);
                    az -= fMag * (st.localVel.z / vSpd);
                } else if (Math.hypot(ax, az) < lashing.staticFriction * gN) {
                    // Static friction holds if slope is gentle
                    ax = 0;
                    az = 0;
                    st.localVel.set(0, 0, 0);
                }

                st.localVel.x += ax * dt;
                st.localVel.z += az * dt;
                // Never accelerate into the deck normal while sliding on the board
                st.localVel.y = 0;
                st.localPos.x += st.localVel.x * dt;
                st.localPos.z += st.localVel.z * dt;

                // 2. Strict parallel travel limits along deck surface
                // Longitudinal (X): crate front reaches end bulkhead at freeSlideX.
                // As long as crate is supported on deck, it slides strictly parallel to the deck surface.
                const halfDeckX = state.L * 0.5;
                const halfCrateX = meta.cL * 0.5;
                const freeSlideX = Math.max(0.40, (halfDeckX - 0.20) - halfCrateX);
                const steepTiltX = tiltDeg >= 12.0 || Math.abs(st.localVel.x) > 0.55 || anyBrokenSling;

                // The Flat Rack is a compound solid: deck + two end walls.
                // An end wall is never skipped merely because the rack is
                // tilted.  Unless an explicit wall rating is exceeded, remove
                // only the closing component and leave lateral travel free.
                if (Math.abs(st.localPos.x) > freeSlideX) {
                    const side = st.localPos.x >= 0 ? 1 : -1;
                    const wallKey = side > 0 ? 'positiveXIntact' : 'negativeXIntact';
                    const wallIntact = !st.endWalls || st.endWalls[wallKey] !== false;
                    const wallLimitN = Math.max(1,
                        Number.isFinite(state.oogEndWallMblN)
                            ? state.oogEndWallMblN
                            // A steel Flat Rack bulkhead is intentionally much
                            // stronger than a normal lashing; it only fails in
                            // an explicitly configured destructive scenario.
                            : payloadMassKg * G_EARTH * 40
                    );
                    const impactForceN = payloadMassKg * Math.abs(st.localVel.x) / Math.max(dt, 1 / 120);
                    if (wallIntact && impactForceN <= wallLimitN) {
                        st.localPos.x = side * freeSlideX;
                        if (st.localVel.x * side > 0) st.localVel.x = 0;
                    } else if (st.endWalls) {
                        st.endWalls[wallKey] = false;
                    }
                }

                // Pure parallel sliding travel zones:
                // Along X: slides parallel until overhang passes beyond threshold
                const parallelLimitX = freeSlideX;
                const overX = Math.max(0, Math.abs(st.localPos.x) - parallelLimitX);

                // Along Z: open sides, slides parallel until CoG approaches the side edge
                const parallelLimitZ = Math.max(0.35, state.W * 0.36);
                const overZ = Math.max(0, Math.abs(st.localPos.z) - parallelLimitZ);

                // 3. Tipping fulcrum rotation angles:
                // When sliding longitudinally (along X), tipping down over the end rotates around Z axis!
                // When sliding laterally (along Z), tipping down over the side rotates around X axis!
                let tipAngleZ = 0; // Pitch around Z axis for X sliding
                let tipAngleX = 0; // Roll around X axis for Z sliding

                if (overX > 0 && steepTiltX) {
                    const tipProgX = Math.min(1.0, overX / 0.85);
                    tipAngleZ = -Math.sign(st.localPos.x) * (tipProgX * 0.58);
                }
                if (overZ > 0) {
                    const tipProgZ = Math.min(1.0, overZ / 0.45);
                    tipAngleX = Math.sign(st.localPos.z) * (tipProgZ * 0.52);
                }

                // Visual placement on deck:
                // If within parallel limits: strictly flush (Y = 0) and parallel (rotation = 0,0,0)
                const hasTipping = (Math.abs(tipAngleX) > 1e-4) || (Math.abs(tipAngleZ) > 1e-4);
                if (!hasTipping) {
                    oogGroup.position.set(st.localPos.x, 0, st.localPos.z);
                    oogGroup.rotation.set(0, 0, 0);
                    st.deckNormalOffset = 0;
                } else {
                    const dropY = -Math.max(Math.abs(tipAngleX) * 0.20, Math.abs(tipAngleZ) * 0.30);
                    oogGroup.position.set(st.localPos.x, dropY, st.localPos.z);
                    oogGroup.rotation.set(tipAngleX, 0, tipAngleZ);
                    st.deckNormalOffset = dropY;
                }

                // 4. Dislodgement when tipping progresses beyond critical support
                const isDislodgedX = steepTiltX && (!st.endWalls || st.endWalls.negativeXIntact === false || st.endWalls.positiveXIntact === false) && (overX >= 0.85);
                const isDislodgedZ = overZ >= 0.45;

                if (isDislodgedZ || isDislodgedX) {
                    const pCenterLocal = new THREE.Vector3(0, meta.centerY, 0);
                    st.worldQuat.copy(phy.cargoQuat).multiply(oogGroup.quaternion);
                    const oWorld = oogGroup.position.clone().applyQuaternion(phy.cargoQuat).add(phy.cargoPos);
                    st.worldPos.copy(oWorld).add(pCenterLocal.clone().applyQuaternion(st.worldQuat));

                    // Continuous velocity transfer from sliding deck frame to world frame
                    const vDeckPoint = phy.cargoVel.clone().add(new THREE.Vector3().crossVectors(phy.cargoOmega, oWorld.clone().sub(phy.cargoPos)));
                    const vSlideWorld = new THREE.Vector3(st.localVel.x, 0, st.localVel.z).applyQuaternion(phy.cargoQuat);
                    st.worldVel.copy(vSlideWorld).add(vDeckPoint);

                    // Gentle rotational velocity from tipping off the edge (proportional to sliding speed)
                    const vSlideSpd = Math.hypot(st.localVel.x, st.localVel.z);
                    const rollSign = Math.sign(st.localPos.z) || 1;
                    const pitchSign = Math.sign(st.localPos.x) || 1;
                    const tipOmegaX = isDislodgedZ ? rollSign * Math.min(0.65, vSlideSpd * 0.40) : 0;
                    const tipOmegaZ = isDislodgedX ? -pitchSign * Math.min(0.65, vSlideSpd * 0.40) : 0;
                    st.worldOmega.set(tipOmegaX, 0, tipOmegaZ).applyQuaternion(phy.cargoQuat).add(phy.cargoOmega);

                    st.status = 'falling';
                    // Flat Rack tare (ISO) remains on the hook; OOG payload becomes a separate body
                    const tareT = state.tareT != null ? state.tareT : (state.L > 9 ? 4.8 : 2.9);
                    phy.effectiveCargoWeightT = Math.min(state.weight, tareT);
                    st.massKg = Math.max(600, (state.weight - phy.effectiveCargoWeightT) * 1000);
                    st.half = meta.half
                        ? { hx: meta.half.hx, hy: meta.half.hy, hz: meta.half.hz }
                        : { hx: meta.cL * 0.5, hy: meta.cH * 0.5, hz: meta.cW * 0.5 };
                    st.frame = { L: state.L, W: state.W, H: state.H, deckH: meta.deckH || 0.30 };
                }
                return;
            }

            if (st.status === 'falling' || st.status === 'grounded') {
                st.worldVel.y -= G_EARTH * dt;
                st.worldPos.addScaledVector(st.worldVel, dt);
                const wLen = st.worldOmega.length();
                if (wLen > 1e-6) {
                    st.worldQuat.premultiply(new THREE.Quaternion().setFromAxisAngle(st.worldOmega.clone().multiplyScalar(1 / wLen), wLen * dt)).normalize();
                }

                // 8-corner ground collision for the fallen OOG crate
                const hx = meta.cL * 0.5;
                const hy = meta.cH * 0.5;
                const hz = meta.cW * 0.5;
                if (!st.half) st.half = { hx, hy, hz };
                if (!(st.massKg > 0)) st.massKg = Math.max(600, (state.weight - (phy.effectiveCargoWeightT || 2.5)) * 1000);
                let maxPen = 0;
                let hitPt = null;
                const groundContacts = [];
                for (let sx = -1; sx <= 1; sx += 2) {
                    for (let sy = -1; sy <= 1; sy += 2) {
                        for (let sz = -1; sz <= 1; sz += 2) {
                            const wCorner = new THREE.Vector3(sx * hx, sy * hy, sz * hz).applyQuaternion(st.worldQuat).add(st.worldPos);
                            const fY = supportY(wCorner.x, wCorner.z);
                            if (wCorner.y <= fY + 0.012) groundContacts.push({ point: wCorner, floorY: fY });
                            if (wCorner.y < fY) {
                                const pen = fY - wCorner.y;
                                if (pen > maxPen) {
                                    maxPen = pen;
                                    hitPt = wCorner;
                                }
                            }
                        }
                    }
                }
                if (maxPen > 0) {
                    // A rigid box must be pushed all the way to the external
                    // ground surface in this frame.  The old 8 cm cap left a
                    // visible part of the crate below ground and allowed it to
                    // hover during the next frame.
                    st.worldPos.y += maxPen + 0.001;
                    st.lastGroundPenetration = maxPen;
                    if (!st.impactedGround && st.worldVel.y < -0.35) {
                        st.impactedGround = true;
                        st.status = 'grounded';
                        if (hitPt) spawnImpactDust(hitPt);
                        if (typeof simAudio !== 'undefined') {
                            const oogMassKg = (state.weight * 0.7) * 1000;
                            const vy = Math.abs(st.worldVel.y);
                            simAudio.playImpact(vy, 0.5 * oogMassKg * vy * vy, 'ground');
                        }
                        const statusEl = document.getElementById('sim-status-text');
                        if (statusEl) {
                            statusEl.textContent = 'SỰ CỐ NGHIÊM TRỌNG: Kiện hàng trên Flat Rack đã đứt dây chằng, trượt khỏi sàn và RƠI ĐẬP XUỐNG ĐẤT!';
                        }
                    }
                    if (st.worldVel.y < 0) st.worldVel.y = 0;
                    if (st.worldVel.y > 0.3) st.worldVel.y = 0.1;
                    st.worldVel.x *= Math.exp(-dt * 14.0);
                    st.worldVel.z *= Math.exp(-dt * 14.0);
                    st.worldOmega.multiplyScalar(Math.exp(-dt * 5.0));
                }

                // A box that only touches at one edge has no valid support
                // polygon.  Apply the gravity moment about that contact so the
                // raised end falls naturally instead of freezing at a fake
                // 20--40 degree "rest" pose.  Four well-spaced contacts are a
                // valid flat rest and receive no artificial torque.
                if (groundContacts.length) {
                    let contactCentroid = new THREE.Vector3();
                    groundContacts.forEach(c => contactCentroid.add(c.point));
                    contactCentroid.multiplyScalar(1 / groundContacts.length);
                    const com = st.worldPos.clone();
                    const supportRadiusSq = groundContacts.reduce((best, c) => Math.max(best, c.point.distanceToSquared(contactCentroid)), 0);
                    const up = new THREE.Vector3(0, 1, 0).applyQuaternion(st.worldQuat);
                    const tiltFromLevel = Math.acos(THREE.MathUtils.clamp(Math.abs(up.y), 0, 1));
                    const hasBroadSupport = groundContacts.length >= 3 && supportRadiusSq > 0.18;
                    if (!hasBroadSupport && tiltFromLevel > THREE.MathUtils.degToRad(0.35)) {
                        const gravityForce = new THREE.Vector3(0, -Math.max(600, st.massKg || 600) * G_EARTH, 0);
                        const torque = new THREE.Vector3().crossVectors(com.sub(contactCentroid), gravityForce);
                        const invI = inertiaInverseAboutCog(
                            Math.max(600, st.massKg || 600),
                            Math.max(0.4, hx * 2), Math.max(0.4, hz * 2), Math.max(0.4, hy * 2),
                            0, 0, 0
                        );
                        const alpha = alphaFromTorque(torque, st.worldQuat, invI);
                        if (alpha && isFinite(alpha.x) && isFinite(alpha.y) && isFinite(alpha.z)) {
                            // Clamp only pathological solver spikes; real gravity
                            // still controls the angular response.
                            if (alpha.length() > 18) alpha.setLength(18);
                            st.worldOmega.addScaledVector(alpha, dt);
                        }
                    }
                    if (maxPen > 0 && !st.impactedGround && Math.abs(st.worldVel.y) < 0.36) {
                        st.status = 'grounded';
                    }
                }

                // Two separate bodies: empty Flat Rack ↔ fallen OOG crate (catch / slide / clear)
                resolveFlatRackFallenOogContacts(dt);

                const pCenter = new THREE.Vector3(0, meta.centerY, 0).applyQuaternion(st.worldQuat);
                const oWorld = st.worldPos.clone().sub(pCenter);
                oogGroup.position.copy(oWorld.sub(phy.cargoPos).applyQuaternion(invCargoQ));
                oogGroup.quaternion.copy(invCargoQ).multiply(st.worldQuat);
            }
        }

        function pointExitOrientedBox(worldPt, center, quat, hx, hy, hz, pad) {
            const p = Math.max(0, pad || 0);
            const invQ = quat.clone().invert();
            const local = worldPt.clone().sub(center).applyQuaternion(invQ);
            const dx = Math.abs(local.x) - (hx + p);
            const dy = Math.abs(local.y) - (hy + p);
            const dz = Math.abs(local.z) - (hz + p);
            if (dx >= 0 || dy >= 0 || dz >= 0) return null;
            let depth = -dx;
            const nLocal = new THREE.Vector3(Math.sign(local.x) || 1, 0, 0);
            if (-dy < depth) { depth = -dy; nLocal.set(0, Math.sign(local.y) || 1, 0); }
            if (-dz < depth) { depth = -dz; nLocal.set(0, 0, Math.sign(local.z) || 1); }
            return {
                depth,
                n: nLocal.applyQuaternion(quat).normalize(),
                local
            };
        }

        // Flat Rack is NOT a solid L×W×H box — only deck slab + two end bulkheads collide.
        function flatRackSolidBoxesLocal() {
            const { L, W, H } = state;
            const deckH = (phy.oogState && phy.oogState.frame && phy.oogState.frame.deckH) || 0.30;
            const deckCy = -H * 0.5 + deckH * 0.5;
            const postH = H - 0.18;
            return [
                { c: new THREE.Vector3(0, deckCy, 0), h: new THREE.Vector3(L * 0.5 - 0.04, deckH * 0.5, W * 0.5 - 0.04) },
                { c: new THREE.Vector3(L * 0.5 - 0.11, 0, 0), h: new THREE.Vector3(0.12, postH * 0.5, W * 0.5 - 0.06) },
                { c: new THREE.Vector3(-(L * 0.5 - 0.11), 0, 0), h: new THREE.Vector3(0.12, postH * 0.5, W * 0.5 - 0.06) }
            ];
        }

        function flatRackContactSampleLocals() {
            const { L, W, H } = state;
            const deckH = 0.30;
            const deckY = -H * 0.5 + deckH;
            const botY = -H * 0.5 + 0.04;
            const pts = [];
            // Dense samples along outer girders / deck edges — first outer contact wins
            for (let i = -8; i <= 8; i++) {
                const x = (i / 8) * (L * 0.49);
                [-1, 1].forEach(sz => {
                    pts.push(new THREE.Vector3(x, deckY, sz * W * 0.49));
                    pts.push(new THREE.Vector3(x, botY, sz * W * 0.49));
                    pts.push(new THREE.Vector3(x, deckY - 0.08, sz * W * 0.49));
                });
                pts.push(new THREE.Vector3(x, botY, 0));
                pts.push(new THREE.Vector3(x, deckY, 0));
            }
            // End bulkhead outer faces & corner posts (full height)
            [-1, 1].forEach(sx => {
                const ex = sx * (L * 0.5 - 0.02); // outermost face
                for (let j = -4; j <= 4; j++) {
                    const y = (j / 4) * (H * 0.48);
                    for (let k = -3; k <= 3; k++) {
                        const z = (k / 3) * (W * 0.48);
                        pts.push(new THREE.Vector3(ex, y, z));
                    }
                }
                [-1, 1].forEach(sz => {
                    pts.push(new THREE.Vector3(sx * (L * 0.5 - 0.11), H * 0.45, sz * (W * 0.5 - 0.11)));
                    pts.push(new THREE.Vector3(sx * (L * 0.5 - 0.11), -H * 0.45, sz * (W * 0.5 - 0.11)));
                });
            });
            return pts;
        }

        function oogContactSampleLocals(half) {
            const pts = [];
            const { hx, hy, hz } = half;
            [-1, 1].forEach(sx => [-1, 1].forEach(sy => [-1, 1].forEach(sz => {
                pts.push(new THREE.Vector3(sx * hx, sy * hy, sz * hz));
            })));
            [-1, 1].forEach(sx => [-1, 1].forEach(sy => {
                pts.push(new THREE.Vector3(sx * hx, sy * hy, 0));
                pts.push(new THREE.Vector3(sx * hx, 0, sy * hz));
                pts.push(new THREE.Vector3(0, sy * hy, sx * hz));
            }));
            return pts;
        }

        function pointExitFlatRackCompound(worldPt, pad) {
            const p = Math.max(0, pad || 0);
            const invQ = phy.cargoQuat.clone().invert();
            const local = worldPt.clone().sub(phy.cargoPos).applyQuaternion(invQ);
            let best = null;
            flatRackSolidBoxesLocal().forEach(box => {
                const rel = local.clone().sub(box.c);
                const hit = boxExit(rel, box.h.x + p, box.h.y + p, box.h.z + p);
                if (!hit) return;
                if (!best || hit.depth < best.depth) {
                    best = {
                        depth: hit.depth,
                        n: hit.n.clone().applyQuaternion(phy.cargoQuat).normalize()
                    };
                }
            });
            return best;
        }

        // Empty Flat Rack vs fallen OOG.
        // Hard rule: contact the OUTERMOST surface first — push Flat Rack fully out before any deeper point.
        // Grounded OOG is immovable; FR (tare) must rest / slide on the crate skin, never ghost through.
        function resolveFlatRackFallenOogContacts(dt) {
            const st = phy.oogState;
            if (!st || (st.status !== 'falling' && st.status !== 'grounded')) return;
            if (!st.half) return;
            if (!isFinite(phy.cargoPos.x) || !isFinite(st.worldPos.x)) return;
            const half = st.half;
            const tareT = state.tareT != null ? state.tareT : (state.L > 9 ? 4.8 : 2.9);
            const rackMass = Math.max(80, (phy.effectiveCargoWeightT != null ? phy.effectiveCargoWeightT : tareT) * 1000);
            const { L, W, H } = state;
            const invIRack = inertiaInverseAboutCog(rackMass, L, W, H, state.cogX, state.cogY, state.cogZ);
            const grounded = st.status === 'grounded';
            // A very small skin keeps two rendered steel/wood surfaces apart;
            // it is not a permissive overlap allowance.
            const pad = 0.002;
            const frSamples = flatRackContactSampleLocals();
            const oogSamples = oogContactSampleLocals(half);
            let totalMoved = 0;
            const maxTotalMove = 2.4;
            st.lastCompoundPenetration = 0;

            const findDeepest = () => {
                let best = null;
                // 1) Flat Rack outer skin points inside OOG volume
                for (let i = 0; i < frSamples.length; i++) {
                    const w = frSamples[i].clone().applyQuaternion(phy.cargoQuat).add(phy.cargoPos);
                    const hit = pointExitOrientedBox(w, st.worldPos, st.worldQuat, half.hx, half.hy, half.hz, pad);
                    if (!hit) continue;
                    if (!best || hit.depth > best.depth) best = { point: w, n: hit.n, depth: hit.depth, kind: 'frInOog' };
                }
                // 2) OOG outer corners/edges inside Flat Rack solids (deck / bulkheads)
                for (let i = 0; i < oogSamples.length; i++) {
                    const w = oogSamples[i].clone().applyQuaternion(st.worldQuat).add(st.worldPos);
                    const hit = pointExitFlatRackCompound(w, pad);
                    if (!hit) continue;
                    if (!best || hit.depth > best.depth) best = { point: w, n: hit.n, depth: hit.depth, kind: 'oogInFr' };
                }
                return best;
            };

            // Iterative deepest-first separation = collide at the first outer point, then the next, …
            for (let iter = 0; iter < 48; iter++) {
                if (totalMoved >= maxTotalMove) break;
                const deep = findDeepest();
                if (!deep || !(deep.depth > 0.0015) || !deep.n || !(deep.n.lengthSq() > 0.25)) break;
                st.lastCompoundPenetration = Math.max(st.lastCompoundPenetration, deep.depth);

                // sepDir pushes Flat Rack away from OOG, and OOG away from Flat Rack
                const sepDir = (deep.kind === 'frInOog') ? deep.n.clone() : deep.n.clone().negate();

                // Resolve the full measured penetration (plus skin) rather
                // than repeatedly leaving a visible fraction embedded.  The
                // contact impulse below removes only closing speed, preventing
                // the correction from becoming a launch impulse.
                const push = Math.min(deep.depth + 0.002, 0.18, maxTotalMove - totalMoved);
                phy.cargoPos.addScaledVector(sepDir, push);
                totalMoved += push;

                // Grounded crate stays planted
                if (!grounded) {
                    st.worldPos.addScaledVector(sepDir, -push * 0.25);
                } else {
                    const bottom = st.worldPos.y - half.hy;
                    const gy = supportY(st.worldPos.x, st.worldPos.z);
                    if (bottom < gy) st.worldPos.y += (gy - bottom);
                }

                // Kill closing velocity at the contact (allow tangential slide along the outer face)
                const com = cargoComNow();
                if (!isFinite(com.x)) break;
                const r = deep.point.clone().sub(com);
                const vPt = phy.cargoVel.clone().add(new THREE.Vector3().crossVectors(phy.cargoOmega, r));
                const vn = vPt.dot(sepDir);
                if (vn < 0) {
                    const jn = Math.min(-vn * 0.85, 1.6);
                    phy.cargoVel.addScaledVector(sepDir, jn);
                    const torque = alphaFromTorque(new THREE.Vector3().crossVectors(r, sepDir.clone().multiplyScalar(jn * 0.85)), phy.cargoQuat, invIRack);
                    if (torque && isFinite(torque.x)) phy.cargoOmega.add(torque);
                }
            }

            if (phy.cargoVel.length() > 2.4) phy.cargoVel.setLength(2.4);
            if (phy.cargoOmega.length() > 1.1) phy.cargoOmega.setLength(1.1);
            if (st.worldVel.length() > 3.5) st.worldVel.setLength(3.5);
            if (st.worldOmega.length() > 2.0) st.worldOmega.setLength(2.0);

            if (phy.effectiveCargoWeightT == null) {
                phy.effectiveCargoWeightT = Math.min(state.weight, tareT);
            }
        }

        function sanitizeSimBodies() {
            const badVec = (v) => !v || !isFinite(v.x) || !isFinite(v.y) || !isFinite(v.z);
            const badQ = (q) => !q || !isFinite(q.x) || !isFinite(q.y) || !isFinite(q.z) || !isFinite(q.w) || q.lengthSq() < 1e-8;
            const exploded = (v) => Math.abs(v.x) > 90 || Math.abs(v.y) > 90 || Math.abs(v.z) > 90;
            if (badVec(phy.cargoPos) || badVec(phy.cargoVel) || badVec(phy.cargoOmega) || badQ(phy.cargoQuat) || exploded(phy.cargoPos)) {
                phy.cargoVel.set(0, 0, 0);
                phy.cargoOmega.set(0, 0, 0);
                phy.cargoQuat.identity();
                phy.cargoPos.set(
                    isFinite(phy.hookPos.x) ? phy.hookPos.x : 0,
                    Math.max(1.2, (isFinite(phy.hookPos.y) ? phy.hookPos.y : 8) - 5),
                    isFinite(phy.hookPos.z) ? phy.hookPos.z : 0
                );
                applyLockedPose();
            }
            (phy.beams || []).forEach(b => {
                if (!b || !(badVec(b.x) || badVec(b.v) || badQ(b.q) || exploded(b.x))) return;
                b.v.set(0, 0, 0);
                b.w.set(0, 0, 0);
                b.q.identity();
                b.x.set(phy.cargoPos.x, phy.cargoPos.y + state.H * 0.5 + 1.2, phy.cargoPos.z);
            });
            if (phy.oogState && phy.oogState.worldPos && (badVec(phy.oogState.worldPos) || badVec(phy.oogState.worldVel) || exploded(phy.oogState.worldPos))) {
                phy.oogState.worldVel.set(0, 0, 0);
                phy.oogState.worldOmega.set(0, 0, 0);
                phy.oogState.worldQuat.identity();
                phy.oogState.worldPos.set(phy.cargoPos.x, Math.max(1, phy.oogState.half ? phy.oogState.half.hy : 1), phy.cargoPos.z + state.W);
                phy.oogState.status = 'grounded';
                phy.oogState.impactedGround = true;
            }
            (phy.cables || []).forEach(c => {
                if (!c.break) return;
                const br = c.break;
                ['tipU', 'tipL', 'velU', 'velL'].forEach(k => {
                    if (badVec(br[k])) {
                        br.velU && br.velU.set(0, 0, 0);
                        br.velL && br.velL.set(0, 0, 0);
                        if (c.a) br.tipU = attachWorld(c.a).add(new THREE.Vector3(0, -0.4, 0));
                        if (c.b) br.tipL = attachWorld(c.b).add(new THREE.Vector3(0, -0.3, 0));
                    }
                });
            });
        }

