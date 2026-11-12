/**
 * physics/footprint_rig — 2D map + kinematic rig pose + corner yield
 * Split from legacy god-file (strangler Phase 2). Shared scope via assemble.
 */
/**
 * physics — part of the lifting simulator.
 * These files are assembled into one module so they share state, physics and the scene.
 */
        // --- 7. INTERACTIVE 2D TOP-DOWN FOOTPRINT MAP (LP1-LP4 & CoG) ---
        function draw2DFootprintMapOn(canvas) {
            if (!canvas) return;
            const ctx = canvas.getContext('2d');
            if (!ctx) return;
            const cw = canvas.width, ch = canvas.height;
            ctx.clearRect(0, 0, cw, ch);

            const { L, W, cogX, cogZ, lugs } = state;
            const scaleX = (cw - 20) / Math.max(0.5, L);
            const scaleZ = (ch - 18) / Math.max(0.5, W);
            const sc = Math.min(scaleX, scaleZ);

            const cx = cw / 2, cz = ch / 2;

            // Cargo Footprint Box
            const rw = L * sc, rh = W * sc;
            ctx.fillStyle = 'rgba(2, 132, 199, 0.22)';
            ctx.strokeStyle = '#38bdf8';
            ctx.lineWidth = 1.5;
            ctx.fillRect(cx - rw / 2, cz - rh / 2, rw, rh);
            ctx.strokeRect(cx - rw / 2, cz - rh / 2, rw, rh);

            // Center Crosshair
            ctx.strokeStyle = 'rgba(148, 163, 184, 0.35)';
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(cx - rw / 2, cz); ctx.lineTo(cx + rw / 2, cz);
            ctx.moveTo(cx, cz - rh / 2); ctx.lineTo(cx, cz + rh / 2);
            ctx.stroke();

            // Polygon connecting LP1-LP2-LP3-LP4
            ctx.strokeStyle = 'rgba(16, 185, 129, 0.6)';
            ctx.beginPath();
            (lugs || []).forEach((p, idx) => {
                const px = cx + p.x * sc;
                const pz = cz + p.z * sc;
                if (idx === 0) ctx.moveTo(px, pz);
                else ctx.lineTo(px, pz);
            });
            ctx.closePath();
            ctx.stroke();

            // 4 Lifting Points Dots
            (lugs || []).forEach((p, idx) => {
                const px = cx + p.x * sc;
                const pz = cz + p.z * sc;
                ctx.fillStyle = (state.selectedLP === String(idx)) ? '#38bdf8' : '#10b981';
                ctx.beginPath();
                ctx.arc(px, pz, 3.2, 0, Math.PI * 2);
                ctx.fill();
            });

            // CoG Target Dot
            const gx = cx + cogX * sc;
            const gz = cz + cogZ * sc;
            ctx.fillStyle = '#facc15';
            ctx.strokeStyle = '#ef4444';
            ctx.lineWidth = 1.5;
            ctx.beginPath();
            ctx.arc(gx, gz, 4.5, 0, Math.PI * 2);
            ctx.fill();
            ctx.stroke();
        }

        function draw2DFootprintMap() {
            draw2DFootprintMapOn(document.getElementById('cog-map-canvas'));
            draw2DFootprintMapOn(document.getElementById('gear-cog-map-canvas'));
        }
        if (typeof window !== 'undefined') {
            window.draw2DFootprintMap = draw2DFootprintMap;
            window.draw2DFootprintMapOn = draw2DFootprintMapOn;
        }

        // --- 8. NEWTONIAN RIGID BODY: F = ma, steel-sling elasticity, shell contact ---
        const G_EARTH = 9.80665;
        /** Local Y of ISO twistlock foot group on STS assembly (match addIsoTwistlockFeet). */
        const STS_TWISTLOCK_FOOT_Y = -0.22;
        /** Tip of the black pin below the foot group origin. */
        const STS_TWISTLOCK_TIP_BELOW = 0.18;

        // Deterministic PRNG (mulberry32) so debris / break-up physics is reproducible run-to-run.
        let _simRandState = 0x9e3779b9;
        function simRandom() {
            _simRandState = (_simRandState + 0x6d2b79f5) | 0;
            let t = Math.imul(_simRandState ^ (_simRandState >>> 15), 1 | _simRandState);
            t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
            return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
        }

        function chordAt(horiz, requestedLen) {
            const h = Math.max(0.1, horiz);
            const req = (requestedLen != null && requestedLen > 0) ? requestedLen : (h / Math.cos(50 * Math.PI / 180));
            const len = Math.max(0.35, req);
            const drop = len > h ? Math.sqrt(len * len - h * h) : 0.05;
            const beta = len > h ? Math.atan2(drop, h) : Math.asin(Math.min(1, Math.max(0.01, drop / len)));
            return { len, drop, beta };
        }

        function lugPlanCentroid() {
            const c = new THREE.Vector3();
            state.lugs.forEach(p => c.add(p));
            if (state.lugs.length) c.multiplyScalar(1 / state.lugs.length);
            return c;
        }

        function lowerPlanOffset(i) {
            // Design L0 uses local plan span (stable when user yaws cargo).
            // World skew is handled by XPBD + kinematic lean — do NOT inflate L0 here
            // or legs become permanently overstretched and fling the cargo skyward.
            const a = spreaderLocalAnchor(i);
            const c = lugPlanCentroid();
            const lug = state.lugs[i] || c;
            return Math.hypot(a.x - (lug.x - c.x), a.z - (lug.z - c.z));
        }

        /** World-horizontal mismatch after relative cargo↔spreader yaw (diagnostics / lean only). */
        function lowerWorldSkewSpan(i) {
            const aLocal = spreaderLocalAnchor(i);
            const yawQ = levelFrameQuat();
            const aPlan = aLocal.clone().applyQuaternion(yawQ);
            const c = lugPlanCentroid();
            const lug = (state.lugs[i] || c).clone().sub(c).applyQuaternion(phy.cargoQuat);
            return Math.hypot(aPlan.x - lug.x, aPlan.z - lug.z);
        }

        function shortestDegDelta(a, b) {
            let d = ((a - b) % 360 + 540) % 360 - 180;
            return d;
        }

        /** Nominal spreader yaw (deg) before tension skew response. */
        function nominalSpreaderYawDeg() {
            if (state.spreaderAlignWithCargo) {
                const e = new THREE.Euler().setFromQuaternion(phy.cargoQuat, 'YXZ');
                return THREE.MathUtils.radToDeg(e.y);
            }
            return state.spreaderYawDeg || 0;
        }

        function getRigSpec() {
            const { beamType } = state;
            const { spanX, spanZ } = getLPBoundingSpan();
            let mast = 0;
            if (beamType === 'cascaded' || beamType === 'inline4') mast = 1.15;
            else if (beamType === 'modular_truss') mast = 0.85;
            else if (beamType === 'spatial8' || beamType === 'inline8') mast = 2.2;

            // 1. Determine horizontal half-span for Tier 1 (upper bridle from hook)
            let horizU = Math.max(0.35, spanX / 2);
            if (beamType === 'none') {
                const lug = spanBase();
                horizU = Math.max(0.35, Math.hypot(lug.spanX / 2, lug.spanZ / 2));
            } else if (beamType === 'basket') {
                const lug = spanBase();
                const halfX = Math.max(0.25, lug.spanX / 2);
                const halfZ = Math.max(0.20, lug.spanZ / 2);
                horizU = Math.max(0.35, Math.hypot(halfX, halfZ));
            } else if (beamType === 'container_spreader') {
                const stsDirectU = (typeof isStsDirectAttach === 'function')
                    ? isStsDirectAttach()
                    : (state.stsAttachMode || 'direct') !== 'cable';
                if (stsDirectU) {
                    horizU = Math.max(0.35, Math.hypot(0.55, 0.35));
                } else {
                    // Cable physics = H-beam bridle (visual 8-fall headblock is cosmetic only).
                    horizU = Math.max(0.35, Math.hypot(spanX / 2, spanZ / 2));
                }
            } else if (beamType === 'frame' || (typeof customBeamMeshes !== 'undefined' && customBeamMeshes[beamType])) {
                horizU = Math.max(0.35, Math.hypot(spanX / 2, spanZ / 2));
            }

            // Working pull-angle band β = 40–55° from horizontal (ASME allows ≥30°).
            // Min length at β=40°; preferred / ideal length at β=50° (even metres).
            const cos40 = Math.cos(40 * Math.PI / 180);
            const cos50 = Math.cos(50 * Math.PI / 180);
            const evenIntLen = (raw, lo, hi) => {
                let e = Math.round(raw / 2) * 2;
                if (e < raw) e += 2; // never shorter than geometry need
                if (e < lo) e = lo;
                if (e > hi) e = Math.ceil(raw / 2) * 2; // allow beyond preferred band
                if (e < raw) e = Math.ceil(raw / 2) * 2;
                return Math.max(2, e);
            };
            let minUpper = Math.max(0.8, Math.ceil((horizU / cos40) * 10) / 10);
            const rawUpper = Math.max(minUpper, horizU / cos50);
            let recUpper = evenIntLen(rawUpper, 8, 12);
            if (recUpper < minUpper) recUpper = evenIntLen(minUpper, 8, 40);
            let maxUpper = Math.max(25.0, Math.ceil(recUpper * 2.0));
            if (beamType === 'container_spreader') {
                const stsDirectU2 = (typeof isStsDirectAttach === 'function')
                    ? isStsDirectAttach()
                    : (state.stsAttachMode || 'direct') !== 'cable';
                if (stsDirectU2) {
                    minUpper = 0.12;
                    recUpper = 0.28;
                    maxUpper = 1.20;
                }
                // Cable: keep H-beam-style minUpper/recUpper from horizU above.
            }

            // Compute required vertical drop from beam underside to lowest lug
            let maxVDrop = 0.24;
            if (state.lugs && state.lugs.length) {
                let peakLugY = -1e9;
                let minLugY = 1e9;
                for (let i = 0; i < state.lugs.length; i++) {
                    const ly = state.lugs[i].y;
                    if (ly > peakLugY) peakLugY = ly;
                    if (ly < minLugY) minLugY = ly;
                }
                const hasOog = (state.cargoType === 'flatrack' || state.cargoType === 'opentop') && state.oogHasCargo !== false;
                const oogH = hasOog ? (state.oogCargoH || state.H) : 0;
                // Lower L0 sized to beam RESTING on cargo roof — not floating on an air gap.
                // (Old 0.24 m clearance made legs too long and left the beam hovering.)
                const cargoTopY = Math.max(
                    (state.H || 2.6) * 0.5,
                    hasOog ? (-state.H * 0.5 + 0.40 + oogH) : -1e9
                );
                const beamClearance = beamCargoContactPad();
                const beamUndersideY = cargoTopY + beamClearance;
                maxVDrop = Math.max(0.20, beamUndersideY - minLugY);
            }

            let horizL = 0;
            if (beamType !== 'none') {
                for (let i = 0; i < state.lugs.length; i++) horizL = Math.max(horizL, lowerPlanOffset(i));
            }

            // Lower sling bounds — even integers in the 2–4 m working band
            let minLower, recLower, maxLower;
            const stsDirect = beamType === 'container_spreader'
                && (typeof isStsDirectAttach === 'function'
                    ? isStsDirectAttach()
                    : (state.stsAttachMode || 'direct') !== 'cable');
            if (stsDirect) {
                // Twistlock pin protrusion only — spreader flush on container roof.
                minLower = 0.04;
                recLower = 0.06;
                maxLower = 0.12;
            } else if (beamType === 'none') {
                minLower = minUpper;
                recLower = recUpper;
                maxLower = maxUpper;
            } else {
                // H-beam / frame / STS cable: same lower-tier sizing (near-vertical 2–4 m).
                const geomDrop = Math.max(0.35, maxVDrop);
                minLower = Math.max(0.4, Math.ceil(Math.hypot(horizL, geomDrop) * 10) / 10);
                const autoDrop = (horizL < 0.18)
                    ? Math.max(minLower, geomDrop)
                    : Math.max(geomDrop, horizL * Math.tan(50 * Math.PI / 180));
                const rawLower = Math.max(minLower, Math.hypot(horizL, autoDrop));
                recLower = evenIntLen(rawLower, 2, 4);
                if (recLower < minLower) recLower = evenIntLen(minLower, 2, 40);
                maxLower = Math.max(20.0, Math.ceil(recLower * 2.5));
            }

            // Cascaded / truss middle tier (2-4-4): each hanger is a V-leg to a sub-beam end.
            // Recommend pin-to-pin ≥ hypot(vertical mast, half sub-beam span).
            const mastGeom = Math.max(0.6, mast || 1.0);
            const halfSub = (typeof cascadedSubBeamHalfSpan === 'function')
                ? cascadedSubBeamHalfSpan()
                : Math.max(0.50, (state.W || 2.438) * 0.45);
            const recHanger = evenIntLen(Math.max(2, Math.hypot(mastGeom, halfSub)), 2, 6);
            const minHanger = 0.5;
            const maxHanger = Math.max(12.0, recHanger * 3);

            // Clamp explicit upper/lower sling lengths to geometric safety limits [min, max]
            if (state.upperSlingLength != null) {
                state.upperSlingLength = THREE.MathUtils.clamp(state.upperSlingLength, minUpper, maxUpper);
            }
            if (state.lowerSlingLength != null) {
                state.lowerSlingLength = THREE.MathUtils.clamp(state.lowerSlingLength, minLower, maxLower);
            }
            if (state.hangerSlingLength != null) {
                state.hangerSlingLength = THREE.MathUtils.clamp(state.hangerSlingLength, minHanger, maxHanger);
            }

            let topLeg, topDrop, lower, lowerDrop, betaDeg;
            const hangerLen = state.hangerSlingLength != null ? state.hangerSlingLength : recHanger;

            if (beamType === 'basket') {
                const lug = spanBase();
                const halfX = Math.max(0.25, lug.spanX / 2);
                const halfZ = Math.max(0.20, lug.spanZ / 2);

                if (state.upperSlingLength != null || state.lowerSlingLength != null) {
                    const reqUpper = state.upperSlingLength != null
                        ? Math.max(minUpper, state.upperSlingLength)
                        : recUpper;
                    const upper = chordAt(horizU, reqUpper);
                    topLeg = Math.max(minUpper, reqUpper);
                    topDrop = upper.drop;
                    betaDeg = upper.beta * 180 / Math.PI;

                    if (state.lowerSlingLength != null) {
                        lower = Math.max(minLower, state.lowerSlingLength);
                        lowerDrop = Math.sqrt(Math.max(0.04, lower * lower - horizL * horizL));
                    } else {
                        lower = recLower;
                        lowerDrop = Math.sqrt(Math.max(0.04, lower * lower - horizL * horizL));
                    }
                } else {
                    const requested = state.slingUserSet
                        ? Math.max(minUpper + minLower, state.slingLength)
                        : Math.max(recUpper, minUpper + minLower);
                    const total = chordAt(horizU, requested);
                    const totalPlane = Math.sqrt(Math.max(0.64, total.len * total.len - halfZ * halfZ));
                    const upperAx = Math.max(0.55, (totalPlane - 0.28) * 0.58);
                    topLeg = Math.max(minUpper, Math.hypot(upperAx, halfZ));
                    lower = Math.max(minLower, totalPlane - 0.28 - upperAx);
                    topDrop = total.drop * 0.58;
                    lowerDrop = total.drop * 0.42;
                    betaDeg = total.beta * 180 / Math.PI;
                }
                return {
                    spanX, spanZ, topDrop, lower, lowerDrop, topLeg, mast: 0, betaDeg,
                    horizU, horizL, maxVDrop,
                    minUpper, maxUpper, recUpper,
                    minLower, maxLower, recLower,
                    hanger: hangerLen, minHanger, maxHanger, recHanger
                };
            }

            const reqUpper = state.upperSlingLength != null
                ? Math.max(minUpper, state.upperSlingLength)
                : (state.slingUserSet ? Math.max(minUpper, state.slingLength) : recUpper);
            const upper = chordAt(horizU, reqUpper);
            topLeg = reqUpper;
            const topH = upper.drop;
            // Multi-tier plans: vertical stack = upper drop + hanger length (not just mast stub)
            const usesHangerTier = (beamType === 'cascaded' || beamType === 'modular_truss'
                || beamType === 'inline4' || beamType === 'inline8' || beamType === 'spatial8');
            topDrop = usesHangerTier ? (topH + hangerLen) : topH;
            betaDeg = upper.beta * 180 / Math.PI;

            if (beamType === 'none') {
                lower = topLeg;
                lowerDrop = topH;
                topDrop = 0;
            } else {
                lower = state.lowerSlingLength != null
                    ? Math.max(minLower, state.lowerSlingLength)
                    : recLower;
                lowerDrop = Math.sqrt(Math.max(0.04, lower * lower - horizL * horizL));
            }
            return {
                spanX, spanZ, topDrop, lower, lowerDrop, topLeg, mast: hangerLen, betaDeg,
                horizU, horizL, maxVDrop,
                minUpper, maxUpper, recUpper,
                minLower, maxLower, recLower,
                hanger: hangerLen, minHanger, maxHanger, recHanger
            };
        }

        function levelFrameQuat() {
            const yaw = THREE.MathUtils.degToRad(nominalSpreaderYawDeg());
            return new THREE.Quaternion().setFromEuler(new THREE.Euler(0, yaw, 0, 'YXZ'));
        }

        /**
         * Kinematic seed for grounded / pretension: upper gear leans with askew cargo.
         * When cargo yaw ≠ spreader yaw (or CoG offset), hang follows the load and
         * beam yaw partially equalizes under lower-leg tension — not forced upright.
         */
        function kinematicRigPose() {
            const spec = getRigSpec();
            const master = new THREE.Vector3(phy.hookPos.x, phy.hookPos.y + HOOK_MASTER_OFFSET_Y, phy.hookPos.z);
            const centroid = new THREE.Vector3();
            let peak = -1e9;
            const count = Math.max(1, state.lugs.length);
            for (let i = 0; i < state.lugs.length; i++) {
                const p = state.lugs[i].clone().applyQuaternion(phy.cargoQuat).add(phy.cargoPos);
                centroid.add(p);
                if (p.y > peak) peak = p.y;
            }
            centroid.multiplyScalar(1 / count);

            // CoG world for lateral pull (skew load wants to drag the whole upper assembly)
            let cogW = centroid.clone();
            if (typeof cargoComNow === 'function') {
                const c = cargoComNow();
                if (c) cogW = c;
            } else if (phy.cargoPos && phy.cargoQuat) {
                cogW = new THREE.Vector3(state.cogX || 0, state.cogY || 0, state.cogZ || 0)
                    .applyQuaternion(phy.cargoQuat).add(phy.cargoPos);
            }

            const isGrounded = state.poseLock || (phy.groundClearance || 0) <= 0.05;
            const takingUp = isGrounded && (
                (phy.hoistSpeed || 0) > 0.01
                || !!phy.autoHoistActive
                || (phy.cables || []).some(c => c.role === 'leg' && (c.tensionT || 0) > 0.08 && !cableIsBroken(c))
            );

            // Mild yaw equalisation — enough to show skew, not enough to overstretch uppers
            const cargoYawDeg = THREE.MathUtils.radToDeg(
                new THREE.Euler().setFromQuaternion(phy.cargoQuat, 'YXZ').y
            );
            const baseYawDeg = nominalSpreaderYawDeg();
            const skewDeg = shortestDegDelta(cargoYawDeg, baseYawDeg);
            const swivel = state.hookSwivelEnabled !== false;
            const yawFollow = takingUp
                ? (swivel ? 0.22 : 0.08)
                : (isGrounded ? (swivel ? 0.14 : 0.04) : 0.10);
            const frameYawDeg = baseYawDeg + skewDeg * yawFollow;
            const yawQ = new THREE.Quaternion().setFromEuler(
                new THREE.Euler(0, THREE.MathUtils.degToRad(frameYawDeg), 0, 'YXZ')
            );

            // Hang lean: visible askew pull, but keep upper bridle geometry near design L0
            let hang = master.clone().sub(cogW);
            if (hang.y < 0.45 || hang.lengthSq() < 0.2) {
                hang.set(0, 1, 0);
            } else {
                const damp = takingUp ? 0.48 : (isGrounded ? 0.38 : 0.42);
                hang.x *= damp;
                hang.z *= damp;
                if (hang.lengthSq() < 1e-6) hang.set(0, 1, 0);
                else hang.normalize();
            }

            const beamX = new THREE.Vector3(1, 0, 0).applyQuaternion(yawQ);
            let xAxis = beamX.clone().addScaledVector(hang, -beamX.dot(hang));
            if (xAxis.lengthSq() < 1e-6) xAxis = new THREE.Vector3(0, 0, 1).cross(hang);
            xAxis.normalize();
            const zAxis = new THREE.Vector3().crossVectors(xAxis, hang).normalize();
            const frameQ = new THREE.Quaternion().setFromRotationMatrix(
                new THREE.Matrix4().makeBasis(xAxis, hang, zAxis)
            );

            const naturalY = master.y - (state.beamType === 'none' ? 0 : spec.topDrop);
            const stsMode = state.beamType === 'container_spreader';
            const stsDirectKin = stsMode
                && (typeof isStsDirectAttach === 'function'
                    ? isStsDirectAttach()
                    : (state.stsAttachMode || 'direct') !== 'cable');

            // Keep beam mostly under the hook (design bridle). Only a light CoG bias when skewed.
            // STS headblock: locked over cargo plan (hook = trolley above the box).
            const skewAmt = Math.min(1, Math.abs(skewDeg) / 45);
            const lateralBias = THREE.MathUtils.lerp(0.35, 0.28, skewAmt * (takingUp ? 1 : 0.6));
            let spreaderPos;
            if (stsMode) {
                spreaderPos = new THREE.Vector3(phy.cargoPos.x, naturalY, phy.cargoPos.z);
            } else {
                spreaderPos = new THREE.Vector3(
                    THREE.MathUtils.lerp(centroid.x, master.x, lateralBias),
                    naturalY,
                    THREE.MathUtils.lerp(centroid.z, master.z, lateralBias)
                );
                const cogPlanPull = 0.08 * skewAmt;
                spreaderPos.x = THREE.MathUtils.lerp(spreaderPos.x, cogW.x, cogPlanPull);
                spreaderPos.z = THREE.MathUtils.lerp(spreaderPos.z, cogW.z, cogPlanPull);
            }

            // Rest seat = TRUE cargo roof (white/OOG lid). Do NOT use peak lug Y —
            // flatrack corner posts sit above the load roof and were floating the beam.
            const restY = cargoCeilingUnderBeam(spreaderPos.x, spreaderPos.z, spec);

            // Hang height from ACTUAL upper L0 + pin span — never float with slack uppers.
            // Take-up order: hook rises → uppers go taut under gear weight → then lowers → then cargo.
            const hangFromHook = (state.beamType === 'none')
                ? master.y
                : computeUpperSupportedBeamY(master, spreaderPos, frameQ, spec, naturalY);

            let spreaderY;
            if (state.beamType === 'none') {
                spreaderY = master.y;
            } else if (stsDirectKin && isGrounded) {
                // Direct twistlock preview: sit flush on the roof — never float on long upper L0.
                spreaderY = restY;
            } else if (stsMode && isGrounded && !stsDirectKin) {
                // Cable STS on quay: stand off by lower sling length above the roof pad.
                const L0 = Math.max(0.8, state.lowerSlingLength || 2.0);
                const roof = cargoShellTopRaw(spreaderPos.x, spreaderPos.z, spec);
                spreaderY = Math.max(restY, roof + 0.28 + L0);
            } else {
                // Above restY → suspended on taut uppers. At/below → sit on cargo roof.
                spreaderY = Math.max(restY, hangFromHook);
            }
            spreaderPos.y = spreaderY;

            const clamped = state.beamType !== 'none' && spreaderPos.y <= restY + 1e-4;
            const anchorVel = new THREE.Vector3(phy.hookVel.x, clamped ? 0 : phy.hookVel.y, phy.hookVel.z);
            return { spec, frameQ, master, spreaderPos, naturalY, clamped, anchorVel, frameYawDeg, skewDeg };
        }

        /**
         * Beam centre Y so upper bridles are just taut under self-weight.
         * Uses live cable L0 (not only design topDrop) — otherwise a longer L0 leaves
         * the beam floating while uppers draw a deep catenary (impossible in take-up).
         */
        function computeUpperSupportedBeamY(master, spreaderPos, frameQ, spec, fallbackY) {
            const ups = (phy.cables || []).filter(c => c.role === 'upper' && !cableIsBroken(c));
            if (!ups.length) return fallbackY != null ? fallbackY : (master.y - (spec.topDrop || 2));
            let ySum = 0;
            let n = 0;
            ups.forEach(c => {
                const L0 = Math.max(0.35, c.L0 || (spec && spec.topLeg) || 4);
                let localY = 0.14;
                let horiz = Math.max(0.2, (spec && spec.horizU) || 1);
                if (c.b && c.b.kind === 'body' && c.b.local) {
                    localY = c.b.local.y || 0;
                    const at = new THREE.Vector3(c.b.local.x, 0, c.b.local.z)
                        .applyQuaternion(frameQ)
                        .add(spreaderPos);
                    horiz = Math.hypot(at.x - master.x, at.z - master.z);
                } else if (c.b && c.b.body && c.b.local) {
                    localY = c.b.local.y || 0;
                    const at = new THREE.Vector3(c.b.local.x, 0, c.b.local.z)
                        .applyQuaternion(frameQ)
                        .add(spreaderPos);
                    horiz = Math.hypot(at.x - master.x, at.z - master.z);
                }
                const drop = Math.sqrt(Math.max(0.05, L0 * L0 - horiz * horiz));
                // attach world y = beam.x.y + localY (level frame) → beam.x.y = master.y - drop - localY
                ySum += master.y - drop - localY;
                n += 1;
            });
            return n ? (ySum / n) : fallbackY;
        }

        /** Live / post-seed: drop beam onto taut uppers, or onto cargo roof if bridle is slack. */
        function settleBeamsToUpperBridle() {
            if (!phy.beams || !phy.beams.length || state.beamType === 'none') return;
            if (state.beamType === 'basket' && basketUsesKinematicPose()) return;
            const master = new THREE.Vector3(phy.hookPos.x, phy.hookPos.y + HOOK_MASTER_OFFSET_Y, phy.hookPos.z);
            const spec = getRigSpec();
            const stsCableGrounded = state.beamType === 'container_spreader'
                && (typeof isStsDirectAttach === 'function'
                    ? !isStsDirectAttach()
                    : (state.stsAttachMode || 'direct') === 'cable')
                && (phy.groundClearance || 0) < 0.08;
            phy.beams.forEach(b => {
                if (!b || b.axis === 'frame') return;
                let floorY = cargoCeilingUnderBeam(b.x.x, b.x.z, spec, b);
                // STS cable preview: keep the kinematic lower-leg stand-off — do not
                // collapse the frame onto the roof when uppers are being equalized.
                if (stsCableGrounded) {
                    const L0 = Math.max(0.8, state.lowerSlingLength || 2.0);
                    const roof = cargoShellTopRaw(b.x.x, b.x.z, spec);
                    floorY = Math.max(floorY, roof + 0.28 + L0 * 0.85);
                }
                const ups = (phy.cables || []).filter(c =>
                    c.role === 'upper' && !cableIsBroken(c) && c.b && c.b.body === b
                );
                let hangY = floorY;
                if (ups.length) {
                    hangY = computeUpperSupportedBeamY(master, b.x, b.q, spec, b.x.y);
                }
                // Never leave a beam floating above the roof with slack uppers
                const targetY = Math.max(floorY, hangY);
                if (b.x.y > targetY + 0.008) {
                    b.x.y = THREE.MathUtils.lerp(b.x.y, targetY, 0.9);
                    if (b.v) { b.v.y = Math.min(b.v.y, 0); }
                }
                // Hard floor: underside on cargo roof (or STS cable stand-off)
                if (b.x.y < floorY) b.x.y = floorY;
                depenetrateBeamFromCargo(b, 3);
                const shell = cargoShellTopRaw(b.x.x, b.x.z, spec);
                const underside = b.x.y - beamCargoContactPad(b);
                b.isRestingOnCargo = underside <= shell + 0.04;
            });
        }

        function computeRigPose() {
            if (phy.rigLive && phy.beams && phy.beams.length) {
                const top = phy.beams[0];
                const spec = getRigSpec();
                const master = new THREE.Vector3(phy.hookPos.x, phy.hookPos.y + HOOK_MASTER_OFFSET_Y, phy.hookPos.z);
                return {
                    spec,
                    frameQ: top.q.clone(),
                    master,
                    spreaderPos: top.x.clone(),
                    naturalY: top.x.y,
                    clamped: false,
                    anchorVel: top.v.clone(),
                    dynamic: true
                };
            }
            return kinematicRigPose();
        }

        /**
         * Rest pad = structural tube half-height ONLY.
         * Do NOT use visualRadius (lug plates / pad-eyes) — that floated the yellow
         * beam a whole "khúc" above the cargo lid while fittings cleared the roof.
         */
        function beamCargoContactPad(beam) {
            if (state.beamType === 'container_spreader') {
                // Direct: yellow CAD underside ≈ −0.34 local — pad must match that,
                // NOT collision radius (plan-span visualRadius floated the beam metres up).
                // Cable: small structural pad; stand-off comes from lower L0.
                return (typeof isStsDirectAttach === 'function' ? isStsDirectAttach() : (state.stsAttachMode || 'direct') !== 'cable')
                    ? 0.34
                    : 0.12;
            }
            if (beam && beam.radius > 0.04) return Math.max(0.045, beam.radius * 0.98);
            if (state.beamType === 'frame') return 0.08;
            if (state.beamType === 'lifting_beam') return 0.10;
            if (state.beamType === 'basket') return 0.08;
            if (state.beamType === 'spreader') return 0.09;
            return 0.09;
        }

        /** Raw cargo roof world Y under (x,z) — true lid, no lug-post / air-gap boost. */
        function cargoShellTopRaw(x, z, spec) {
            if (!activeCargoVisual || state.beamType === 'none') return -1e9;
            // Prefer wrap-solid roof (OOG lid / box top) — matches what the user sees
            if (typeof cargoWrapSolid === 'function' && typeof cargoLocalFromWorld === 'function') {
                const solid = cargoWrapSolid(0.01);
                if (solid) {
                    const loc = cargoLocalFromWorld(new THREE.Vector3(x, phy.cargoPos.y, z));
                    if (Math.abs(loc.x - solid.ox) <= solid.hx + 0.05
                        && Math.abs(loc.z - solid.oz) <= solid.hz + 0.05) {
                        const roofLocal = solid.roofY - 0.01; // strip the pad baked into wrap solid
                        return cargoWorldFromLocal(new THREE.Vector3(loc.x, roofLocal, loc.z)).y;
                    }
                }
            }
            const hx = Math.max(0.12, (spec ? spec.spanX : state.L) * 0.18);
            const hz = Math.max(0.08, (spec ? spec.spanZ : state.W) * 0.18);
            let maxShellY = -1e9;
            const samples = [[0, 0], [-hx * 0.4, 0], [hx * 0.4, 0], [0, -hz * 0.4], [0, hz * 0.4]];
            for (let i = 0; i < samples.length; i++) {
                const sy = cargoShellTopWorldY(x + samples[i][0], z + samples[i][1], 0.04);
                if (sy > maxShellY) maxShellY = sy;
            }
            if (maxShellY < -1e5) {
                const hasOog = (state.cargoType === 'flatrack' || state.cargoType === 'opentop') && state.oogHasCargo !== false;
                const localTop = hasOog
                    ? (-state.H * 0.5 + 0.40 + (state.oogCargoH || state.H))
                    : (state.H * 0.5);
                return new THREE.Vector3(0, localTop, 0).applyQuaternion(phy.cargoQuat).add(phy.cargoPos).y;
            }
            return maxShellY;
        }

        function cargoCeilingUnderBeam(x, z, spec, beam) {
            if (!activeCargoVisual || state.beamType === 'none') return -1e9;
            return cargoShellTopRaw(x, z, spec) + beamCargoContactPad(beam);
        }

        function separateCargoFromBeam() {
            if (state.beamType === 'none' || !activeCargoVisual) return;
            cargoRootGroup.updateMatrixWorld(true);
            const box = new THREE.Box3().setFromObject(activeCargoVisual);
            const rig = computeRigPose();
            const stsUnderside = (typeof isStsDirectAttach === 'function' && isStsDirectAttach()) ? 0.34 : 0.48;
            const underside = rig.spreaderPos.y - (state.beamType === 'container_spreader' ? stsUnderside : 0.16);
            const half = Math.max(rig.spec.spanX, rig.spec.spanZ) * 0.5 + 0.25;
            const overlap = box.max.x > rig.spreaderPos.x - half && box.min.x < rig.spreaderPos.x + half
                && box.max.z > rig.spreaderPos.z - half && box.min.z < rig.spreaderPos.z + half;
            if (!overlap || box.max.y <= underside + 0.01) return;
            phy.cargoPos.y -= box.max.y - underside;
            if (phy.cargoVel.y > 0) phy.cargoVel.y = 0;
        }

        function dentCargo(speed) {
            if (!activeCargoVisual || !cargoRootGroup || (phy.impactCooldown || 0) > 0) return;
            phy.impactCooldown = 70;
            const mass = Math.max(80, state.weight * 1000);
            const energy = 0.5 * mass * speed * speed;
            const depth = Math.min(0.22, 0.04 + Math.sqrt(energy) / 24000);
            phy.damagePct = Math.min(100, (phy.damagePct || 0) + Math.min(48, energy / 28000));
            phy.shakeAmp = Math.min(0.42, 0.04 + energy / 2.5e6);
            spawnImpactDust();
            if (typeof simAudio !== 'undefined') {
                simAudio.playImpact(speed, energy, 'cargo');
            }
            const pts = supportPointsLocal();
            let contact = null;
            let best = Infinity;
            for (let i = 0; i < pts.length; i++) {
                const w = pts[i].clone().applyQuaternion(phy.cargoQuat).add(phy.cargoPos);
                if (w.y < best) { best = w.y; contact = w; }
            }
            if (!contact) return;
            ensureCargoBasePositions();
            restoreCargoBasePositions();
            cargoRootGroup.updateMatrixWorld(true);
            activeCargoVisual.updateMatrixWorld(true);
            const invCargoWorld = new THREE.Matrix4().copy(cargoRootGroup.matrixWorld).invert();
            // Impact contact point in cargoRootGroup local space (where (0,0,0) is true cargo geometric center)
            const cCargo = contact.clone().applyMatrix4(invCargoWorld);
            const dentRadius = 0.85;
            // Inward crumple direction pointing strictly from impact point toward cargo interior
            const inwardCargo = new THREE.Vector3(-cCargo.x * 0.35, -cCargo.y * 0.85 + 0.25, -cCargo.z * 0.35);
            if (inwardCargo.lengthSq() < 1e-6) inwardCargo.set(0, 1, 0);
            inwardCargo.normalize();

            activeCargoVisual.traverse(mesh => {
                if (!mesh.isMesh || !mesh.geometry || !mesh.geometry.attributes || !mesh.geometry.attributes.position) return;
                if (mesh.userData && (mesh.userData.isCADEdge || mesh.userData.noLugWeld)) return;
                if (mesh.name === 'impactScar') return;
                const pos = mesh.geometry.attributes.position;
                mesh.updateMatrixWorld(true);
                const meshToCargo = new THREE.Matrix4().multiplyMatrices(invCargoWorld, mesh.matrixWorld);
                const cargoToMesh = new THREE.Matrix4().copy(meshToCargo).invert();
                let changed = false;
                const vCargo = new THREE.Vector3();
                const origCargo = new THREE.Vector3();
                for (let v = 0; v < pos.count; v++) {
                    origCargo.set(pos.getX(v), pos.getY(v), pos.getZ(v)).applyMatrix4(meshToCargo);
                    const d = origCargo.distanceTo(cCargo);
                    if (d > dentRadius) continue;
                    const k = 1 - d / dentRadius;
                    const crush = Math.min(depth * k * k, d * 0.45, 0.18);
                    vCargo.copy(origCargo).addScaledVector(inwardCargo, crush);
                    // Strictly prevent any vertex from expanding outward beyond its original cargo profile
                    if (Math.abs(vCargo.x) > Math.abs(origCargo.x)) vCargo.x = origCargo.x;
                    if (Math.abs(vCargo.y) > Math.abs(origCargo.y)) vCargo.y = origCargo.y;
                    if (Math.abs(vCargo.z) > Math.abs(origCargo.z)) vCargo.z = origCargo.z;
                    vCargo.applyMatrix4(cargoToMesh);
                    pos.setXYZ(v, vCargo.x, vCargo.y, vCargo.z);
                    if (!mesh.geometry.attributes.color) {
                        const colors = new Float32Array(pos.count * 3);
                        colors.fill(1);
                        mesh.geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
                        if (mesh.material && !mesh.userData.colorMat) {
                            mesh.material = mesh.material.clone();
                            mesh.material.vertexColors = true;
                            mesh.userData.colorMat = true;
                        }
                    }
                    const col = mesh.geometry.attributes.color;
                    if (col) {
                        const burn = Math.max(0.25, 1 - k * 0.72);
                        col.setXYZ(v, col.getX(v) * burn, col.getY(v) * burn * 0.78, col.getZ(v) * burn * 0.62);
                        col.needsUpdate = true;
                    }
                    changed = true;
                }
                if (changed) {
                    pos.needsUpdate = true;
                    mesh.geometry.computeVertexNormals();
                    mesh.children.forEach(ch => {
                        if (ch.userData && ch.userData.isCADEdge) {
                            ch.geometry.dispose();
                            ch.geometry = new THREE.EdgesGeometry(mesh.geometry, 24);
                        }
                    });
                }
            });
            const scar = new THREE.Mesh(
                new THREE.SphereGeometry(0.36, 12, 8),
                new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.96, metalness: 0.12 })
            );
            scar.name = 'impactScar';
            scar.scale.set(1.35, 0.18, 1.05);
            cargoRootGroup.updateMatrixWorld(true);
            scar.position.copy(cCargo);
            const upLocal = new THREE.Vector3(0, 1, 0).transformDirection(invCargoWorld);
            if (upLocal.lengthSq() > 1e-6) scar.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), upLocal.normalize());
            cargoRootGroup.add(scar);
            const status = document.getElementById('sim-status-text');
            if (status) status.textContent = `Kiện rơi va đập mạnh ở ${speed.toFixed(1)} m/s (${(energy / 1000).toFixed(0)} kJ) — móp biến dạng tại điểm va chạm (${phy.damagePct.toFixed(0)}%).`;
            commitCargoBaseFromCurrent();
        }

        function spawnImpactDust(customOrigin) {
            if (!phy.dustGroup) {
                phy.dustGroup = new THREE.Group();
                scene.add(phy.dustGroup);
            }
            const geo = new THREE.SphereGeometry(0.08, 6, 6);
            const mat = new THREE.MeshBasicMaterial({ color: 0xd6d3d1, transparent: true, opacity: 0.7 });
            const origin = customOrigin ? customOrigin.clone() : phy.cargoPos.clone();
            origin.y = supportY(origin.x, origin.z) + 0.1;
            for (let i = 0; i < 16; i++) {
                const m = new THREE.Mesh(geo, mat.clone());
                m.position.copy(origin);
                m.userData.vel = new THREE.Vector3((simRandom() - 0.5) * 3.5, 0.6 + simRandom() * 2.2, (simRandom() - 0.5) * 3.5);
                m.userData.life = 40;
                phy.dustGroup.add(m);
            }
        }

        function ensureCargoBasePositions() {
            if (!activeCargoVisual) return;
            activeCargoVisual.traverse(mesh => {
                if (!mesh.isMesh || !mesh.geometry || !mesh.geometry.attributes || !mesh.geometry.attributes.position) return;
                const pos = mesh.geometry.attributes.position;
                if (!mesh.userData.basePos || mesh.userData.basePos.length !== pos.count * 3) {
                    mesh.userData.basePos = new Float32Array(pos.array);
                }
            });
        }

        function commitCargoBaseFromCurrent() {
            if (!activeCargoVisual) return;
            activeCargoVisual.traverse(mesh => {
                if (!mesh.isMesh || !mesh.geometry || !mesh.geometry.attributes || !mesh.geometry.attributes.position) return;
                const pos = mesh.geometry.attributes.position;
                if (!mesh.userData.basePos || mesh.userData.basePos.length !== pos.count * 3) mesh.userData.basePos = new Float32Array(pos.count * 3);
                mesh.userData.basePos.set(pos.array);
            });
        }

        function restoreCargoBasePositions() {
            if (!activeCargoVisual) return;
            activeCargoVisual.traverse(mesh => {
                const base = mesh.userData && mesh.userData.basePos;
                if (!mesh.isMesh || !base || !mesh.geometry || !mesh.geometry.attributes.position) return;
                mesh.geometry.attributes.position.array.set(base);
                mesh.geometry.attributes.position.needsUpdate = true;
            });
        }

        // Rigid steel containers & cargo do NOT stretch or enlarge their corner dimensions in mid-air when a sling breaks;
        // instead, the entire rigid body tilts/rolls around the remaining taut slings, and only dents inward upon ground impact.
        function stepCornerYield() {
            while (phy.cornerSag.length < state.lugs.length) phy.cornerSag.push(0);
            for (let i = 0; i < state.lugs.length; i++) phy.cornerSag[i] = 0;
        }

        function applyCornerYieldVisual() {
            if (phy.yieldApplied) {
                restoreCargoBasePositions();
                phy.yieldApplied = false;
            }
            placeLiftPoints();
        }

