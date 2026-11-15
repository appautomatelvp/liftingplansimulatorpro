/**
 * rigging/draw_update — rope draw / nhomSnug visuals
 * Split from legacy god-file (strangler Phase 2). Shared scope via assemble.
 */
        // ---------------------------------------------------------------------------------
        // Slack cable morphology is solved by a persistent material-aware XPBD chain.
        // ---------------------------------------------------------------------------------
        function simulateSlackRope(slingObj, A, B, L, pad, allowA, allowB, material, diameterMm) {
            const N = slingObj.numSegments;
            const normalizedMaterial = material === 'round_sling' || material === 'synthetic' ? 'web' : material;
            const cargoKey = `${state.cargoType}|${state.oogHasCargo !== false ? 1 : 0}|${state.oogTarp !== false ? 1 : 0}|${state.L.toFixed(2)}|${state.W.toFixed(2)}|${state.H.toFixed(2)}|${(state.oogOh || 0).toFixed(2)}|${(state.oogCargoH || 0).toFixed(2)}`;
            const invQ = phy.cargoQuat.clone().invert();
            const tmp = new THREE.Vector3();
            const loc = new THREE.Vector3();

            const isUpperRole = !!(slingObj.drawMeta && slingObj.drawMeta.role === 'upper');
            const solid = cargoWrapSolid(pad);
            const locA = cargoLocalFromWorld(A);
            const locB = cargoLocalFromWorld(B);
            const minEndLocalY = Math.min(locA.y, locB.y);
            const bothEndsAboveRoof = solid && (minEndLocalY >= solid.roofY - 0.65);

            // True 3D roof interior check: ONLY true when the point is actually inside the XZ footprint of `solid`
            const isOverRoofInterior = (w) => {
                if (!solid) return false;
                loc.copy(w).sub(phy.cargoPos).applyQuaternion(invQ);
                return (loc.y >= solid.bottomY - 0.15)
                    && Math.abs(loc.x - solid.ox) <= solid.hx + pad * 0.5
                    && Math.abs(loc.z - solid.oz) <= solid.hz + pad * 0.5;
            };

            // Only clamp to `solid.roofY` when the node is over the solid's XZ interior AND approaching from above
            const shouldClampToRoof = (w) => {
                if (!solid) return false;
                loc.copy(w).sub(phy.cargoPos).applyQuaternion(invQ);
                if (state.cargoType === 'container' || state.cargoType === 'crate') {
                    return Math.abs(loc.x) <= state.L * 0.5 + pad * 0.5 && Math.abs(loc.z) <= state.W * 0.5 + pad * 0.5;
                }
                if (state.cargoType === 'flatrack') {
                    const hasCargo = state.oogHasCargo !== false;
                    if (hasCargo && isOverRoofInterior(w)) {
                        return isUpperRole || bothEndsAboveRoof || (loc.y >= solid.roofY - 0.25);
                    }
                    return false;
                }
                if (state.cargoType === 'opentop') {
                    return isOverRoofInterior(w) && (isUpperRole || bothEndsAboveRoof || loc.y >= solid.roofY - 0.25);
                }
                return isOverRoofInterior(w) && (bothEndsAboveRoof || loc.y >= solid.roofY - 0.25);
            };

            const outsideShell = (w) => {
                loc.copy(w).sub(phy.cargoPos).applyQuaternion(invQ);
                const o = pushOutOfCargoShellLocal(loc, pad, false);
                return o.distanceToSquared(loc) < 1e-10;
            };

            const clearExternalSolids = (p) => {
                const skip = ropeSkip(p, [A, B], allowA, allowB);
                const cleared = pushPointClear(p, pad, skip);
                p.copy(cleared);
            };

            const collide = (p, from) => {
                const prevPos = from ? from.clone() : null;
                let onHorizontalSurface = false;
                const floorY = supportY(p.x, p.z) + pad;
                if (p.y <= floorY + 0.004) {
                    p.y = floorY;
                    onHorizontalSurface = true;
                }
                if (shouldClampToRoof(p)) {
                    const roofY = cargoRoofAtXZ(p.x, p.z, pad);
                    if (roofY != null && p.y <= roofY + 0.004) {
                        p.y = roofY;
                        onHorizontalSurface = true;
                    }
                }
                if (!outsideShell(p)) {
                    if (from && outsideShell(from)) {
                        const STEPS = 8;
                        let lastOut = from;
                        for (let s = 1; s <= STEPS; s++) {
                            tmp.lerpVectors(from, p, s / STEPS);
                            if (tmp.y < floorY) tmp.y = floorY;
                            if (outsideShell(tmp)) { lastOut = tmp.clone(); } else break;
                        }
                        p.copy(lastOut);
                    }
                    tmp.copy(p).sub(phy.cargoPos).applyQuaternion(invQ);
                    const biasUp = shouldClampToRoof(p);
                    const out = pushOutOfCargoShellLocal(tmp.clone(), pad, biasUp);
                    if (out.distanceToSquared(tmp) > 1e-10) {
                        if (out.y > tmp.y + 0.002) onHorizontalSurface = true;
                        p.copy(out).applyQuaternion(phy.cargoQuat).add(phy.cargoPos);
                    }
                }
                if (p.y < floorY) {
                    p.y = floorY;
                    onHorizontalSurface = true;
                }
                if (shouldClampToRoof(p)) {
                    const roofY = cargoRoofAtXZ(p.x, p.z, pad);
                    if (roofY != null && p.y < roofY) {
                        p.y = roofY;
                        onHorizontalSurface = true;
                    }
                }
                clearExternalSolids(p);
                // Surface Coulomb friction damping when resting on a roof, deck, or ground
                if (onHorizontalSurface && prevPos) {
                    p.x = THREE.MathUtils.lerp(p.x, prevPos.x, 0.32);
                    p.z = THREE.MathUtils.lerp(p.z, prevPos.z, 0.32);
                }
            };

            const solver = slingObj.ropeSim;
            if (!(solver instanceof XPBDCableDynamics)
                || solver.segments !== N
                || solver.material !== normalizedMaterial
                || slingObj._ropeSimCargoKey !== cargoKey
                || Math.abs(solver.lengthM - L) > 0.25 * L + 0.1
                || solver.positions[0]?.distanceTo(A) > 1.2
                || solver.positions[N]?.distanceTo(B) > 1.2) {
                slingObj.ropeSim = new XPBDCableDynamics({ lengthM: L, diameterMm: diameterMm || 16, material: normalizedMaterial, segments: N });
                slingObj.ropeSim.reset(A, B);
                slingObj._ropeSimCargoKey = cargoKey;
            }
            const result = slingObj.ropeSim.step(1 / 60, A, B, {
                iterations: 6,
                collide: (point, index, radius) => collide(point, slingObj.ropeSim.previous[index], radius)
            });
            result[0].copy(A);
            result[result.length - 1].copy(B);
            return result;
        }

        function update3DSlingGeometry(slingObj, pointA, pointB, fixedLen, slingStyle, isOverloaded) {

            const meta = slingObj.drawMeta || {};
            const tagSling = (o) => {
                if (!o || !o.userData) return;
                o.userData.gearKind = 'sling';
                o.userData.gearRole = meta.role || 'leg';
                o.userData.gearIndex = meta.index || 0;
            };
            const end = pointB;
            slingObj.group.visible = true;
            const chord = pointA.distanceTo(end);
            const ropeR = 0.024;
            const cable = (phy.cables || []).find(c => c.role === meta.role && c.index === meta.index);
            const allowA = cable && endSolidId(cable.a) ? [endSolidId(cable.a)] : ['hook'];
            const allowB = cable && endSolidId(cable.b) ? [endSolidId(cable.b)] : [];

            const pathMeta = Object.assign({}, meta, {
                tautness: meta.tautness != null ? meta.tautness : 0
            });
            const gradeNow = meta.grade || '';
            let look = meta.slingType || slingStyle || 'wire';
            if (meta.slingType) {
                look = meta.slingType;
            } else if (slingStyle) {
                look = slingStyle;
            } else if (meta.grade === 'g80' || meta.grade === 'g100') {
                look = 'chain';
            } else if (meta.grade === 'poly') {
                look = 'web';
            } else if (meta.grade === 'hmpe') {
                look = 'round_sling';
            } else {
                look = 'wire';
            }

            const isChainNow = look === 'chain';
            const isFlatNow = look === 'web' || look === 'round_sling';
            const diaNowM = Math.max(6, meta.diaMm || (isFlatNow ? 50 : (isChainNow ? 16 : 20))) / 1000;
            // Collision radius = real half-thickness of what is drawn (chain link outer width / rope radius / strap)
            const simPad = isChainNow ? 1.1 * diaNowM
                : (isFlatNow ? 0.008 : diaNowM * 0.5 + 0.003);
            // Bending stiffness: steel wire rope resists tight folds (~8x dia); chain and straps fold freely
            const simStiffR = (isChainNow || isFlatNow) ? 0 : Math.max(0.12, 8 * diaNowM);
            const actualTension = (cable && cable.tensionT) || 0;
            // A segment whose pins happen to be exactly one nominal length apart
            // is not automatically loaded.  With no transmitted force, allow the
            // small real seating/link clearance of a loose sling to show as a
            // gravity catenary rather than a visually impossible horizontal bar.
            // An intact upper bridle in a lifted assembly is carrying at least the
            // suspended beam/rigging mass, even when a particular solver substep
            // reports a near-zero impulse.  Do not turn that load path into a
            // visual catenary: it is a tension member while the load is airborne.
            // This is deliberately limited to the upper tier; auxiliary ropes and
            // unloaded lower/extra slings continue to drape under gravity.
            // Every intact upper leg terminates at a beam/frame with non-zero
            // self-weight. It is therefore a loaded tension path even while the
            // editor is showing the convenient pose-locked placement preview.
            // Manufactured working length — NEVER grows with pin distance (that looks like rubber)
            const workLen = Math.max(0.16, (fixedLen != null && fixedLen > 0.15) ? fixedLen : ((cable && cable.L0 > 0.2) ? cable.L0 : chord));

            // Take-up / set-down order (gravity):
            //  HOIST:  uppers (near hook) taut first under gear weight → then lowers → then cargo
            //  LOWER:  lowers (near cargo) go slack first → beam seats on cargo → then uppers slack
            const beamBody = (cable && cable.a && cable.a.kind === 'body') ? cable.a.body
                : (cable && cable.b && cable.b.kind === 'body' ? cable.b.body : null);
            const cargoRoofY = (typeof cargoCeilingUnderBeam === 'function' && beamBody)
                ? cargoCeilingUnderBeam(beamBody.x.x, beamBody.x.z, (typeof getRigSpec === 'function') ? getRigSpec() : null, beamBody)
                : ((phy.cargoPos ? phy.cargoPos.y : 0) + (state.H || 2.6) * 0.5);
            const beamOffCargo = !!(beamBody && !beamBody.isRestingOnCargo
                && beamBody.x.y > cargoRoofY + 0.06);
            const beamOnCargo = !!(beamBody && (
                beamBody.isRestingOnCargo
                || !beamOffCargo
                || (typeof beamIsSuspended === 'function' && !beamIsSuspended(beamBody))
            ));
            const beamResting = !!(meta.role === 'leg' && beamOnCargo && !beamOffCargo);
            const cargoSuspended = !state.poseLock && (phy.groundClearance || 0) > 0.05;

            const geometricallyTaut = !meta.broken && chord >= workLen - 0.015;
            // Nhớm cáp: ropes are taken up to the live pin span while cargo stays on the quay.
            // Must still DRAW straight — do not force a gravity belly just because poseLock
            // reports near-zero solver tension.
            const nhomSnug = !!(phy && (phy._nhomFreezeSpreader || (state.poseLock && state.holdCableLength)))
                && geometricallyTaut;
            // Uppers look taut when they reach workLen while the beam is off the lid or when carrying suspended cargo
            const upperCarryingGear = meta.role === 'upper' && !meta.broken && (
                (beamOffCargo && chord >= workLen - 0.04)
                || (cargoSuspended && actualTension > 0.05)
                || nhomSnug
            );
            const lowerCarryingSuspendedLoad = meta.role === 'leg' && !meta.broken
                && cargoSuspended && actualTension > 0.05
                && !(cable && typeof lowerLegIsUnloadedByTopFailure === 'function' && lowerLegIsUnloadedByTopFailure(cable));
            const physicallyTaut = !meta.broken && (
                upperCarryingGear
                || lowerCarryingSuspendedLoad
                || nhomSnug
                || (geometricallyTaut && !beamResting
                    && !(meta.role === 'leg' && beamOnCargo && actualTension < 0.15))
            );

            // Phase 2: Hooke's Law elastic elongation ΔL_e = T·L0/(E·A) when load-bearing.
            // Slack morphology keeps manufactured L0 (arc-length ±1 mm via fitPath / PhysicalCableSolver).
            const tensionN = Math.max(0, actualTension) * 1000 * 9.81;
            const diaM = Math.max(0.006, diaNowM);
            const areaM2 = Math.PI * (diaM * 0.5) * (diaM * 0.5);
            const E_Pa = isChainNow ? 200e9 : (isFlatNow ? 5e9 : 100e9);
            const deltaLe = (physicallyTaut || upperCarryingGear || lowerCarryingSuspendedLoad)
                ? (tensionN * workLen) / Math.max(1e-8, E_Pa * areaM2)
                : 0;
            const renderLen = workLen + Math.min(0.08, deltaLe);
            if (cable) {
                cable._elasticElongationM = deltaLe;
                cable._renderArcTargetM = renderLen;
            }
            if (upperCarryingGear || lowerCarryingSuspendedLoad || nhomSnug) {
                pathMeta.tautness = 1;
            } else if (!physicallyTaut) {
                pathMeta.tautness = beamResting ? 0 : Math.min(pathMeta.tautness || 0, 0.35);
            }
            let rawPts;
            let usedDynamicXPBD = false;
            const SLING_DRAW_CACHE_VER = 10;
            const flashBusy = !!(cable && (cable._isFlashing || cable._angleDanger));
            if (!meta.broken && !meta.selected && !meta.ctrlHover && !isOverloaded && !flashBusy
                && slingObj.ropeSim == null && physicallyTaut
                && slingObj._cacheVer === SLING_DRAW_CACHE_VER
                && slingObj._cacheA && slingObj._cacheB
                && slingObj._cacheA.distanceToSquared(pointA) < 2.5e-5
                && slingObj._cacheB.distanceToSquared(end) < 2.5e-5
                && Math.abs((slingObj._cacheLen || 0) - renderLen) < 0.003
                && slingObj._cacheTaut === physicallyTaut
                && slingObj._cacheRest === beamResting
                && slingObj._cacheCtrlHover === !!meta.ctrlHover) {
                slingObj.group.visible = true;
                return;
            }
            slingObj._cacheVer = SLING_DRAW_CACHE_VER;
            slingObj._cacheA = pointA.clone();
            slingObj._cacheB = end.clone();
            slingObj._cacheLen = renderLen;
            slingObj._cacheTaut = physicallyTaut;
            slingObj._cacheRest = beamResting;
            slingObj._cacheCtrlHover = !!meta.ctrlHover;

            const isBrokenStub = !!meta.broken && !!meta.brokenHalf;
            const drapeOntoSolids = (pts) => {
                let out = pts;
                out = routeRopeAroundCargo(out, Math.max(simPad, simPad));
                if (typeof routeRopeAroundBeams === 'function') {
                    out = routeRopeAroundBeams(out, Math.max(simPad, 0.028), allowA, allowB);
                }
                return out;
            };

            if (isBrokenStub) {
                slingObj.ropeSim = null;
                const br = cable && cable.break;
                const settleAmt = br
                    ? (meta.brokenHalf === 'upper' ? (br.settleU || 0) : (br.settleL || 0))
                    : 0;
                const ageSettle = br ? THREE.MathUtils.clamp(((br.age || 0) - (br.wasTaut ? 0.45 : 0.12)) / 0.7, 0, 1) : 1;
                const settle = Math.max(settleAmt, ageSettle);
                rawPts = buildBrokenStubHangPath(pointA, end, renderLen, slingObj.numSegments, settle);
                for (let i = 1; i < rawPts.length - 1; i++) {
                    if (typeof pushPointClear === 'function') {
                        const cleared = pushPointClear(rawPts[i], 0.028, new Set());
                        if (cleared.y <= rawPts[i].y + 0.01) rawPts[i].copy(cleared);
                    }
                }
            } else if (physicallyTaut || upperCarryingGear) {
                // Phase 2 taut: razor-straight. Use PCS only when T is high enough for its
                // taut branch (T>5 kN); otherwise a low-T call would wrongly droop.
                slingObj.ropeSim = null;
                const PCS = (typeof CAE !== 'undefined' && CAE.PhysicalCableSolver) || null;
                if (PCS && tensionN > 5000) {
                    try {
                        const solver = new PCS(workLen, Math.max(8, diaNowM * 1000), isChainNow ? 200 : 110, 24);
                        const floorY = (typeof supportY === 'function')
                            ? Math.min(supportY(pointA.x, pointA.z), supportY(end.x, end.z)) - 0.02
                            : -1e3;
                        const res = solver.solveCableCurve3D(pointA, end, Math.max(tensionN, 5001), floorY);
                        rawPts = (res.points || []).map((p) => new THREE.Vector3(p.x, p.y, p.z));
                        if (cable) {
                            cable._maxSagM = res.maxTransverseDeviationM || 0;
                            cable._morphArcM = res.actualArcLength || renderLen;
                        }
                        // Enforce < 2 mm sag visually for suspended load paths
                        if ((res.maxTransverseDeviationM || 0) > 0.002) {
                            rawPts = [pointA.clone(), end.clone()];
                        }
                    } catch (_) {
                        rawPts = [pointA.clone(), end.clone()];
                    }
                } else {
                    rawPts = [pointA.clone(), end.clone()];
                }
                if (!rawPts || rawPts.length < 2) rawPts = [pointA.clone(), end.clone()];
            } else if (!meta.broken && renderLen > chord + 0.005) {
                // Every slack live cable uses the same persistent physical solver,
                // including pose-locked startup scenes; there is no static spline fallback.
                usedDynamicXPBD = true;
                rawPts = simulateSlackRope(
                    slingObj, pointA, end, renderLen,
                    simPad, allowA, allowB, look,
                    Math.max(6, meta.diaMm || (look === 'web' ? 50 : (look === 'chain' ? 16 : 20)))
                );
                if (cable) {
                    let arc = 0;
                    for (let i = 1; i < rawPts.length; i++) arc += rawPts[i].distanceTo(rawPts[i - 1]);
                    cable._morphArcM = arc;
                }
            } else {
                slingObj.ropeSim = null;
                rawPts = solveDrapedRopePath(pointA, end, renderLen, ropeR, allowA, allowB, pathMeta);
                rawPts = drapeOntoSolids(rawPts);
            }
            // Soften jagged polylines, then FORCE arc length back to exact workLen (inextensible)
            if (!usedDynamicXPBD && !physicallyTaut && rawPts && rawPts.length > 3) {
                rawPts = smoothSlingPolyline(rawPts, isChainNow ? 2 : 1);
                rawPts = drapeOntoSolids(rawPts);
            }
            const segCount = slingObj.numSegments;
            let pts = resampleSlingPath(rawPts, segCount);
            if (!usedDynamicXPBD && !isBrokenStub && !physicallyTaut && pts && pts.length >= 3 && typeof fitPathToFixedLength === 'function') {
                const solid = typeof cargoWrapSolid === 'function' ? cargoWrapSolid(simPad) : null;
                pts = fitPathToFixedLength(pts, pointA, end, workLen, solid, simPad);
            }
            // Length fitting and resampling can move a previously routed catenary
            // back through the cargo shell. Resolve contacts on the final rendered
            // nodes so the visible rope never clips through a roof or crate.
            if (!usedDynamicXPBD && !isBrokenStub && pts && pts.length >= 3 && typeof pushPointClear === 'function') {
                const endSkipA = ropeSkip(pointA, [pointA, end], allowA, allowB);
                const endSkipB = ropeSkip(end, [pointA, end], allowA, allowB);
                for (let i = 1; i < pts.length - 1; i++) {
                    const t = i / (pts.length - 1);
                    const skip = t < 0.5 ? endSkipA : endSkipB;
                    pts[i].copy(pushPointClear(pts[i], simPad, skip));
                    const supportY = cargoRoofAtXZ(pts[i].x, pts[i].z, simPad);
                    if (supportY != null && pts[i].y < supportY) pts[i].y = supportY;
                }
            }
            pts[0].copy(pointA);
            if (isBrokenStub) {
                end.copy(pts[pts.length - 1]);
                if (end.y > pointA.y - 0.02) end.y = pointA.y - 0.06;
                pts[pts.length - 1].copy(end);
            } else {
                pts[pts.length - 1].copy(end);
            }
            const reached = !meta.broken;

            const slingMeshNameMap = {
                wire: 'Wire_Rope_Sling',
                chain: 'Chain_Sling',
                web: 'Synthetic_Web_Sling',
                round_sling: 'Round_Sling',
                grommet: 'Grommet_Sling'
            };
            slingObj.group.name = slingMeshNameMap[look] || 'Wire_Rope_Sling';

            const wllNow = (cable && cable.swlT) || meta.swlT || state.wllPerLeg || 15.0;
            let mat = MATS.wireRope;
            if (look === 'chain') {
                mat = MATS.chainDark;
            } else if (look === 'web' || look === 'round_sling') {
                const getDynMat = (typeof window !== 'undefined' && window.getDynamicSlingMaterial)
                    || (typeof MATS !== 'undefined' && MATS.getDynamicSlingMaterial);
                if (getDynMat) {
                    mat = getDynMat(look, wllNow);
                } else {
                    mat = MATS.webGreen;
                }
                // Thin fabric must render from both faces
                if (mat && mat.side !== THREE.DoubleSide) {
                    mat = mat.clone();
                    mat.side = THREE.DoubleSide;
                }
            } else if (look === 'grommet') {
                mat = MATS.wireRope;
            }
            if (meta.broken || isOverloaded) mat = MATS.redMaster;
            else if (meta.selected) mat = MATS.lpSelected;
            else if (meta.ctrlHover) mat = MATS.lpCtrlHover || MATS.lpSelected;

            // International Sling Angle Warning / cut-hover enter: red pulse
            if (cable && cable._isFlashing && cable._flashStartTime) {
                const elapsed = performance.now() - cable._flashStartTime;
                // Cut-tool hover = one quick blink (~0.36s); angle danger = 3 pulses
                const flashWindow = (cable._cutHoverFlash || cable._forceFlowFlash) ? 420 : 1080;
                if (elapsed < flashWindow) {
                    const isRedPhase = (Math.floor(elapsed / 120) % 2) === 0;
                    if (isRedPhase) {
                        mat = MATS.flashRed || MATS.redMaster;
                    }
                } else {
                    cable._isFlashing = false;
                    cable._cutHoverFlash = false;
                }
            } else if (cable && cable._angleDanger) {
                mat = MATS.redMaster;
            }

            const dia = Math.max(6, meta.diaMm || (look === 'web' ? 50 : (look === 'chain' ? 16 : 20)));
            const hiLite = !!(meta.selected || meta.ctrlHover);
            // diaScale: legacy factor, still used to size end thimbles / eyes.
            const diaScale = THREE.MathUtils.clamp(dia / (look === 'web' ? 50 : 18), 0.55, 2.6) * (hiLite ? 1.35 : 1);
            // bodyK: true-to-scale factor for the rope body. Base cylinder radius is 0.018 m,
            // so scale = (dia_mm / 2000) / 0.018 = dia_mm / 36 gives the real diameter.
            const bodyK = (Math.max(dia, 10) / 36) * (hiLite ? 1.15 : 1);
            // stockScale: sizing for chain links and end hardware (16mm stock -> 1.0)
            const stockScale = THREE.MathUtils.clamp((dia || 16) / 16, 0.5, 3.5);
            const N = Math.max(1, pts.length - 1);
            const upY = new THREE.Vector3(0, 1, 0);
            const chain = look === 'chain';

            // Termination visibility flags for 5 rigging types
            const showWireEye = (look === 'wire') && !meta.broken && chord > 0.35;
            const showWebEye = (look === 'web') && !meta.broken && chord > 0.35;
            // Intact: both ends. Cut stub is painted pin→tip so attached hardware is always end A.
            const showChainEnds = (look === 'chain') && chord > 0.35
                && (!meta.broken || !!meta.brokenHalf);
            const showChainEndA = showChainEnds;
            const showChainEndB = showChainEnds && !meta.brokenHalf && reached;
            const showRoundTag = (look === 'round_sling') && !meta.broken && chord > 0.35;
            const showGrommetEye = (look === 'grommet') && !meta.broken && chord > 0.35;

            // Select specialized CAD-grade geometry for segments
            let targetGeo = WIRE_SEG_GEO;
            if (look === 'web') targetGeo = WEB_SEG_GEO;
            else if (look === 'round_sling') targetGeo = ROUND_SEG_GEO;
            else if (look === 'grommet') targetGeo = GROMMET_SEG_GEO;

            // Hide unused segment meshes when drawing with reduced sample count
            for (let i = N; i < slingObj.segments.length; i++) {
                slingObj.segments[i].visible = false;
                if (slingObj.links && slingObj.links[i]) slingObj.links[i].visible = false;
            }

            for (let i = 0; i < N; i++) {
                const seg = slingObj.segments[i];
                if (seg.geometry !== targetGeo) {
                    seg.geometry = targetGeo;
                }
                seg.material = mat;
                // Keep first/last wire segments visible so they meet the ferrule tip (hiding them
                // made cables look severed from the swaged sleeve).
                const hideTipForEye = false;
                // Chain: hide tube body, show articulated oval links; others: continuous body
                seg.visible = !chain && !hideTipForEye;
                const segVec = new THREE.Vector3().subVectors(pts[i + 1], pts[i]);
                const segLen = Math.max(0.001, segVec.length());
                const mid = pts[i].clone().lerp(pts[i + 1], 0.5);
                seg.position.copy(mid);
                const dir = segVec.clone().normalize();
                // Overlap segment ends; tip segments dig into ferrule/stub so the join is solid
                const tipDig = (!chain && (i === 0 || i === N - 1) && (showWireEye || showGrommetEye))
                    ? 0.022 * Math.max(1, bodyK) : 0;
                const overlapLen = segLen + tipDig + (i > 0 && i < N - 1 ? 0.018 * bodyK : 0.004);

                if (look === 'web') {
                    // Flat polyester webbing (EN 1492-1): wide × thin fabric — not a rigid plank
                    const widthM = Math.max(0.045, Math.min(0.30, dia / 1000));
                    const thickM = Math.max(0.0022, Math.min(0.008, widthM * 0.045));
                    seg.scale.set(widthM, overlapLen, thickM);
                    // Flat face lies in the vertical plane of the leg
                    const side = new THREE.Vector3().crossVectors(dir, upY);
                    if (side.lengthSq() < 1e-8) side.set(1, 0, 0);
                    side.normalize();
                    const nrm = new THREE.Vector3().crossVectors(dir, side).normalize();
                    seg.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(side, dir, nrm));
                } else {
                    seg.quaternion.setFromUnitVectors(upY, dir);
                    if (look === 'round_sling') {
                        // Dynamic cross-sectional flattening under load & pin contact
                        const tensionRatio = THREE.MathUtils.clamp(actualTension / Math.max(1, wllNow), 0, 1);
                        const pinSquash = (i === 0 || i === N - 1) ? 0.35 : ((i === 1 || i === N - 2) ? 0.18 : 0);
                        const flatFactor = THREE.MathUtils.clamp(tensionRatio * 0.28 + pinSquash, 0, 0.48);
                        const sx = bodyK * 0.72 * (1 + flatFactor * 0.65);
                        const sz = bodyK * 0.72 * (1 - flatFactor * 0.55);
                        seg.scale.set(sx, overlapLen, sz);
                    } else if (look === 'grommet') {
                        seg.scale.set(bodyK * 0.85, overlapLen, bodyK * 0.85);
                    } else {
                        seg.scale.set(bodyK, overlapLen, bodyK);
                    }
                }
                if (slingObj.links && slingObj.links[i]) {
                    const link = slingObj.links[i];
                    link.visible = false;
                }
            }

            // Interlocked Grade-80 / Grade-100 chain per EN 818-2 / ASME B30.9:
            // Center-to-center pitch under tension equals the inner link pitch p = 3d (48mm @ 16mm stock).
            // When taut, adjacent links rest metal-on-metal with ZERO air gap and zero penetration:
            // link i's top inner crown kisses link i+1's bottom inner crown snugly (tì vào nhau).
            if (chain && slingObj.linkInstances && (!meta.broken || meta.brokenHalf)) {
                const acc = [0];
                for (let k = 1; k < pts.length; k++) acc.push(acc[k - 1] + pts[k].distanceTo(pts[k - 1]));
                const total = acc[acc.length - 1] || 1;

                const stockScale = THREE.MathUtils.clamp((dia || 16) / 16, 0.5, 3.5);
                const nominalPitch = CHAIN_NOMINAL_PITCH * stockScale;
                const linkCount = Math.max(3, Math.round(total / nominalPitch));

                // Chain links share one GPU draw call; grow the buffer only if a longer chain needs it.
                if (slingObj.linkInstances.instanceMatrix.count < linkCount) {
                    const oldInstances = slingObj.linkInstances;
                    const capacity = Math.max(linkCount, oldInstances.instanceMatrix.count * 2);
                    const instances = new THREE.InstancedMesh(CHAIN_LINK_GEO, mat, capacity);
                    instances.castShadow = false;
                    instances.receiveShadow = false;
                    instances.frustumCulled = false;
                    slingObj.group.remove(oldInstances);
                    slingObj.group.add(instances);
                    slingObj.linkInstances = instances;
                }
                const instances = slingObj.linkInstances;
                instances.material = mat;

                // Exact physical pitch step along the path:
                // Spacing = total / linkCount ensures exact integer closure with zero accumulated drift.
                const step = total / linkCount;
                // Longitudinal scale: matches the exact step so each link's inside pitch equals step
                const sy = step / CHAIN_NOMINAL_PITCH;
                const sx = stockScale;

                // First black link so le to the red end-link / parent ring (same basis as orientEndLink)
                const nParentA = (slingObj.parentNormalA && slingObj.parentNormalA.isVector3
                    && slingObj.parentNormalA.lengthSq() > 1e-8)
                    ? slingObj.parentNormalA.clone().normalize()
                    : new THREE.Vector3(0, 0, 1);
                const leave0 = new THREE.Vector3().subVectors(pts[Math.min(1, pts.length - 1)], pts[0]);
                if (leave0.lengthSq() < 1e-8) leave0.copy(upY).negate();
                else leave0.normalize();
                let zEnd = new THREE.Vector3().crossVectors(nParentA, leave0);
                if (zEnd.lengthSq() < 1e-8) {
                    zEnd = Math.abs(leave0.y) < 0.92
                        ? new THREE.Vector3(0, 1, 0).cross(leave0)
                        : new THREE.Vector3(1, 0, 0).cross(leave0);
                }
                zEnd.normalize(); // red end-link plane normal
                // Black link 0 plane ⊥ end-link: normal ≈ zEnd × leave (so le / ngoắc, not coplanar weld)
                let zLink0 = new THREE.Vector3().crossVectors(zEnd, leave0);
                if (zLink0.lengthSq() < 1e-8) zLink0 = nParentA.clone();
                zLink0.normalize();

                let kCursor = 1;
                const instanceMatrix = new THREE.Matrix4();
                const instanceScale = new THREE.Vector3();
                const instanceQuaternion = new THREE.Quaternion();
                for (let i = 0; i < linkCount; i++) {
                    // Distance along path to link center:
                    // Link 0 center is at 0.5 * step (so its bottom inner crown sits at d = 0, kissing red end-link A).
                    // Link i and link i+1 meet at d = (i + 1) * step (zero gap, metal-on-metal).
                    // Link (linkCount - 1) top inner crown reaches d = total, kissing red end-link B.
                    const d = Math.min(total - 1e-4, Math.max(0, step * (i + 0.5)));
                    while (kCursor < acc.length - 1 && acc[kCursor] < d) kCursor++;
                    const span = Math.max(1e-6, acc[kCursor] - acc[kCursor - 1]);
                    const t = THREE.MathUtils.clamp((d - acc[kCursor - 1]) / span, 0, 1);
                    const p0 = pts[kCursor - 1];
                    const p1 = pts[kCursor];
                    const mid = p0.clone().lerp(p1, t);
                    const dir = new THREE.Vector3().subVectors(p1, p0);
                    if (dir.lengthSq() < 1e-8) dir.copy(upY);
                    else dir.normalize();
                    // Build basis: Y = chain dir, Z = link plane normal (alternating weave)
                    const yAxis = dir.clone();
                    let zAxis = (i % 2 === 0) ? zLink0.clone() : zEnd.clone();
                    // Re-orthogonalize along the local tangent so curves stay nested
                    let xAxis = new THREE.Vector3().crossVectors(yAxis, zAxis);
                    if (xAxis.lengthSq() < 1e-8) {
                        zAxis = Math.abs(yAxis.y) < 0.92
                            ? new THREE.Vector3(0, 1, 0).cross(yAxis)
                            : new THREE.Vector3(1, 0, 0).cross(yAxis);
                        zAxis.normalize();
                        xAxis = new THREE.Vector3().crossVectors(yAxis, zAxis);
                    }
                    xAxis.normalize();
                    zAxis.crossVectors(xAxis, yAxis).normalize();
                    instanceQuaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(xAxis, yAxis, zAxis));
                    instanceScale.set(sx, sy, sx);
                    instanceMatrix.compose(mid, instanceQuaternion, instanceScale);
                    instances.setMatrixAt(i, instanceMatrix);
                }
                instances.count = linkCount;
                instances.instanceMatrix.needsUpdate = true;
            } else if (slingObj.linkInstances) {
                slingObj.linkInstances.count = 0;
            }

            // Orient forged eye-thimbles + swaged ferrules inward from pts[0] and pts[N]
            const dirFromA = new THREE.Vector3().subVectors(pts[Math.min(2, N)], pts[0]);
            if (dirFromA.lengthSq() < 1e-6) dirFromA.copy(upY);
            dirFromA.normalize();

            const dirFromB = new THREE.Vector3().subVectors(pts[Math.max(0, N - 2)], pts[N]);
            if (dirFromB.lengthSq() < 1e-6) dirFromB.copy(upY).negate();
            dirFromB.normalize();

            // Record exact joint departure tangents so shackles align in 100% unison with the rendered sling
            slingObj.dirLeave = dirFromA.clone();
            slingObj.dirArrive = dirFromB.clone();
            slingObj.visA = pts[0].clone();
            slingObj.visB = pts[N].clone();
            slingObj.pathPoints = pts.map(p => p.clone());
            if (slingObj.drawMeta) slingObj.drawMeta.renderedLength = polylineLength(pts);

            const eyeScale = THREE.MathUtils.clamp(diaScale, 0.72, 1.45);
            const ferruleExit = typeof wireEyeFerruleExit === 'function' ? wireEyeFerruleExit(eyeScale) : (0.195 * eyeScale);
            // 1. Wire Rope Eyes (Thimble + Ferrule)
            // Path pts[0]/pts[N] are just inside the swaged tip. Pull the eye back so the
            // ferrule cone + rope stub swallow the first rope segment (no severed-cable gap).
            // Eye loop is so le / vuông góc to the parent master/shackle plane (same rule as chain ends).
            if (slingObj.endEyeA && slingObj.endEyeB) {
                slingObj.endEyeA.visible = showWireEye;
                slingObj.endEyeB.visible = showWireEye && reached;
                const tipOverlap = 0.028 * eyeScale;
                const orientWireEye = (mesh, seat, leave, parentNormal) => {
                    const yAxis = leave.clone().normalize();
                    const nParent = (parentNormal && parentNormal.lengthSq() > 1e-8)
                        ? parentNormal.clone().normalize()
                        : new THREE.Vector3(0, 0, 1);
                    let zAxis = new THREE.Vector3().crossVectors(nParent, yAxis);
                    if (zAxis.lengthSq() < 1e-8) {
                        zAxis = Math.abs(yAxis.y) < 0.92
                            ? new THREE.Vector3(0, 1, 0).cross(yAxis)
                            : new THREE.Vector3(1, 0, 0).cross(yAxis);
                    }
                    zAxis.normalize();
                    const xAxis = new THREE.Vector3().crossVectors(yAxis, zAxis).normalize();
                    zAxis.crossVectors(xAxis, yAxis).normalize();
                    mesh.position.copy(seat);
                    mesh.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(xAxis, yAxis, zAxis));
                    mesh.scale.setScalar(eyeScale);
                };
                if (showWireEye) {
                    const eyeOriginA = pts[0].clone();
                    const nA = (slingObj.parentNormalA && slingObj.parentNormalA.isVector3)
                        ? slingObj.parentNormalA : new THREE.Vector3(0, 0, 1);
                    orientWireEye(slingObj.endEyeA, eyeOriginA, dirFromA, nA);
                }
                if (showWireEye && reached) {
                    const eyeOriginB = pts[N].clone();
                    const nB = (slingObj.parentNormalB && slingObj.parentNormalB.isVector3)
                        ? slingObj.parentNormalB : new THREE.Vector3(0, 0, 1);
                    orientWireEye(slingObj.endEyeB, eyeOriginB, dirFromB, nB);
                }
            }

            // 2. Web Sling Becket Eyes (Folded Eye + Cross-Stitch + Safety Tag)
            if (slingObj.webEyeA && slingObj.webEyeB) {
                slingObj.webEyeA.visible = showWebEye;
                slingObj.webEyeB.visible = showWebEye && reached;
                const webWidthM = Math.max(0.045, Math.min(0.30, dia / 1000));
                const webEyeScale = THREE.MathUtils.clamp(webWidthM / 0.072, 0.7, 2.4);
                const orientWebEye = (mesh, seat, leave) => {
                    const yAxis = leave.clone().normalize();
                    const side = new THREE.Vector3().crossVectors(yAxis, upY);
                    if (side.lengthSq() < 1e-8) side.set(1, 0, 0);
                    side.normalize();
                    const nrm = new THREE.Vector3().crossVectors(yAxis, side).normalize();
                    mesh.position.copy(seat);
                    mesh.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(side, yAxis, nrm));
                    mesh.scale.set(webEyeScale, webEyeScale, Math.max(0.55, webEyeScale * 0.35));
                    mesh.traverse(m => {
                        if (m.isMesh && (m.name === 'Web_Eye_Loop' || m.name === 'Web_Cuff')) m.material = mat;
                    });
                };
                if (showWebEye) orientWebEye(slingObj.webEyeA, pts[0], dirFromA);
                if (showWebEye && reached) orientWebEye(slingObj.webEyeB, pts[N], dirFromB);
            }

            // 3. Chain End Hardware — red đốt cuối so le / vuông góc with parent master/shackle.
            // Parent plane normal N; child oval normal = N × leave ⇒ child plane ⊥ parent plane.
            // Thickness seating: child tube stays on the OPENING side of the parent bearing plane
            // (seat = crown − 2·tubeR) so bars tì đè — not mid-tube weld.
            if (slingObj.chainTopA && slingObj.chainBotB) {
                slingObj.chainTopA.visible = !!showChainEndA;
                slingObj.chainBotB.visible = !!showChainEndB;
                // Keep end-links smaller than the parent master/shackle so the so-le nest reads clearly
                const endScale = THREE.MathUtils.clamp(stockScale * 0.82, 0.72, 1.12);
                const topLen = typeof chainTopAssemblyLength === 'function'
                    ? chainTopAssemblyLength(endScale) : (0.072 * endScale);
                const childTubeR = typeof chainEndLinkTubeRadius === 'function'
                    ? chainEndLinkTubeRadius(endScale) : (0.014 * endScale);
                const shackleTubeR = (typeof hardwareTubeRadius === 'function')
                    ? hardwareTubeRadius(state.hwType || 'bow_shackle', endScale)
                    : (0.0185 * endScale);
                const masterTubeR = 0.022 * endScale;
                const orientEndLink = (mesh, seat, leave, parentNormal) => {
                    const yAxis = leave.clone().normalize();
                    const nParent = (parentNormal && parentNormal.lengthSq() > 1e-8)
                        ? parentNormal.clone().normalize()
                        : new THREE.Vector3(0, 0, 1);
                    let zAxis = new THREE.Vector3().crossVectors(nParent, yAxis);
                    if (zAxis.lengthSq() < 1e-8) {
                        zAxis = Math.abs(yAxis.y) < 0.92
                            ? new THREE.Vector3(0, 1, 0).cross(yAxis)
                            : new THREE.Vector3(1, 0, 0).cross(yAxis);
                    }
                    zAxis.normalize();
                    const xAxis = new THREE.Vector3().crossVectors(yAxis, zAxis).normalize();
                    zAxis.crossVectors(xAxis, yAxis).normalize();
                    mesh.position.copy(seat);
                    mesh.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(xAxis, yAxis, zAxis));
                    mesh.scale.setScalar(endScale);
                };
                if (showChainEndA) {
                    // Prefer hwLeave (pin→through bow); never draped belly tangent
                    const leaveA = (slingObj.hwLeaveA && slingObj.hwLeaveA.lengthSq() > 1e-8)
                        ? slingObj.hwLeaveA.clone().normalize()
                        : ((slingObj.shackleDirA && slingObj.shackleDirA.lengthSq() > 1e-8)
                            ? slingObj.shackleDirA.clone().normalize() : dirFromA.clone());
                    const crownA = (typeof slingObj.bearingInsetA === 'number') ? slingObj.bearingInsetA : 0;
                    // Hook master crown (inset 0) uses master tube; otherwise shackle bow stock
                    const parentRA = (crownA < 1e-6) ? masterTubeR : shackleTubeR;
                    const pullA = childTubeR + parentRA;
                    const seatA = (slingObj.pinA && slingObj.pinA.isVector3)
                        ? slingObj.pinA.clone().addScaledVector(leaveA, crownA - pullA)
                        : pts[0].clone().addScaledVector(leaveA, -(topLen - pullA));
                    const nA = (slingObj.parentNormalA && slingObj.parentNormalA.isVector3)
                        ? slingObj.parentNormalA : new THREE.Vector3(0, 0, 1);
                    orientEndLink(slingObj.chainTopA, seatA, leaveA, nA);
                }
                if (showChainEndB) {
                    const leaveB = (slingObj.hwLeaveB && slingObj.hwLeaveB.lengthSq() > 1e-8)
                        ? slingObj.hwLeaveB.clone().normalize()
                        : ((slingObj.shackleDirB && slingObj.shackleDirB.lengthSq() > 1e-8)
                            ? slingObj.shackleDirB.clone().normalize() : dirFromB.clone());
                    const crownB = (typeof slingObj.bearingInsetB === 'number') ? slingObj.bearingInsetB : 0;
                    const parentRB = (crownB < 1e-6) ? masterTubeR : shackleTubeR;
                    const pullB = childTubeR + parentRB;
                    const seatB = (slingObj.pinB && slingObj.pinB.isVector3)
                        ? slingObj.pinB.clone().addScaledVector(leaveB, crownB - pullB)
                        : pts[N].clone().addScaledVector(leaveB, -(topLen - pullB));
                    const nB = (slingObj.parentNormalB && slingObj.parentNormalB.isVector3)
                        ? slingObj.parentNormalB : new THREE.Vector3(0, 0, 1);
                    orientEndLink(slingObj.chainBotB, seatB, leaveB, nB);
                }
            }

            // 4. Round Sling Tag (Orange/White Capacity Tag at 25% of span)
            if (slingObj.roundTag) {
                slingObj.roundTag.visible = showRoundTag;
                if (showRoundTag) {
                    const tagIdx = Math.max(1, Math.min(N - 1, Math.round(N * 0.25)));
                    const pPrev = pts[tagIdx - 1];
                    const pNext = pts[tagIdx + 1] || pts[tagIdx];
                    slingObj.roundTag.position.copy(pts[tagIdx]);
                    slingObj.roundTag.quaternion.copy(tensionQuaternion(pPrev, pNext));
                    slingObj.roundTag.scale.setScalar(bodyK * 0.9);
                }
            }

            // 5. Grommet Seizing Eyes (Double-strand loop + Wire Seizing Sleeve)
            if (slingObj.grommetEyeA && slingObj.grommetEyeB) {
                slingObj.grommetEyeA.visible = showGrommetEye;
                slingObj.grommetEyeB.visible = showGrommetEye && reached;
                if (showGrommetEye) {
                    slingObj.grommetEyeA.position.copy(pts[0]);
                    slingObj.grommetEyeA.quaternion.copy(tensionQuaternion(pts[0], pts[0].clone().add(dirFromA)));
                    slingObj.grommetEyeA.scale.setScalar(eyeScale);
                }
                if (showGrommetEye && reached) {
                    slingObj.grommetEyeB.position.copy(pts[N]);
                    slingObj.grommetEyeB.quaternion.copy(tensionQuaternion(pts[N], pts[N].clone().add(dirFromB)));
                    slingObj.grommetEyeB.scale.setScalar(eyeScale);
                }
            }

            // Inline 3D Forged Turnbuckle / Rigging Screw when legDeltaL[i] is non-zero
            if (slingObj.turnbuckle) {
                const deltaL = meta.role === 'leg' ? (state.legDeltaL[meta.index] || 0) : 0;
                const showTb = meta.role === 'leg' && !meta.broken && Math.abs(deltaL) > 0.004 && chord > 0.75;
                slingObj.turnbuckle.visible = showTb;
                if (showTb) {
                    const tbIdx = Math.max(2, Math.min(N - 2, Math.round(N * 0.72)));
                    const pPrev = pts[tbIdx - 1];
                    const pNext = pts[tbIdx + 1];
                    const tbDir = new THREE.Vector3().subVectors(pNext, pPrev);
                    if (tbDir.lengthSq() < 1e-6) tbDir.copy(upY);
                    tbDir.normalize();
                    slingObj.turnbuckle.position.copy(pts[tbIdx]);
                    slingObj.turnbuckle.quaternion.copy(tensionQuaternion(pPrev, pPrev.clone().add(tbDir)));
                }
            }

            slingObj.lastMid = pts[Math.floor(N / 2)].clone();
            tagSling(slingObj.group);
            (slingObj.segments || []).forEach(tagSling);
            (slingObj.links || []).forEach(tagSling);
            tagSling(slingObj.endEyeA);
            tagSling(slingObj.endEyeB);
            tagSling(slingObj.webEyeA);
            tagSling(slingObj.webEyeB);
            tagSling(slingObj.chainTopA);
            tagSling(slingObj.chainBotB);
            tagSling(slingObj.roundTag);
            tagSling(slingObj.grommetEyeA);
            tagSling(slingObj.grommetEyeB);
            tagSling(slingObj.turnbuckle);
            if (slingObj.pickers) {
                slingObj.pickers.forEach((picker, k) => {
                    const idx = Math.min(N, Math.round(((k + 1) / (slingObj.pickers.length + 1)) * N));
                    picker.position.copy(pts[idx]);
                    picker.visible = true;
                    tagSling(picker);
                });
            }
        }
