/**
 * physics — part of the lifting simulator.
 * These files are assembled into one module so they share state, physics and the scene.
 */
        // --- 7. INTERACTIVE 2D TOP-DOWN FOOTPRINT MAP (LP1-LP4 & CoG) ---
        function draw2DFootprintMap() {
            const canvas = document.getElementById('cog-map-canvas');
            if (!canvas) return;
            const ctx = canvas.getContext('2d');
            const cw = canvas.width, ch = canvas.height;
            ctx.clearRect(0, 0, cw, ch);

            const { L, W, cogX, cogZ, lugs } = state;
            const scaleX = (cw - 20) / L;
            const scaleZ = (ch - 18) / W;
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
            lugs.forEach((p, idx) => {
                const px = cx + p.x * sc;
                const pz = cz + p.z * sc;
                if (idx === 0) ctx.moveTo(px, pz);
                else ctx.lineTo(px, pz);
            });
            ctx.closePath();
            ctx.stroke();

            // 4 Lifting Points Dots
            lugs.forEach((p, idx) => {
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
            const req = (requestedLen != null && requestedLen > 0) ? requestedLen : (h / Math.cos(42.5 * Math.PI / 180));
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
                // STS headblock sheave landings — clustered under hoist, not a wide bridle.
                horizU = Math.max(0.35, Math.hypot(0.55, 0.35));
            } else if (beamType === 'frame' || (typeof customBeamMeshes !== 'undefined' && customBeamMeshes[beamType])) {
                horizU = Math.max(0.35, Math.hypot(spanX / 2, spanZ / 2));
            }

            // ASME B30.9 Minimum Bridle Angle is 30° to horizontal.
            // Default plan targets ~40–45° pull angle with even-integer lengths
            // (upper 8/10 m, lower 2/4 m) so every starter geometry is editable
            // but starts near the user's preferred working band.
            const cos30 = Math.cos(30 * Math.PI / 180);
            const cos42 = Math.cos(42.5 * Math.PI / 180);
            const evenIntLen = (raw, lo, hi) => {
                let e = Math.round(raw / 2) * 2;
                if (e < raw) e += 2; // never shorter than geometry need
                if (e < lo) e = lo;
                if (e > hi) e = Math.ceil(raw / 2) * 2; // allow beyond preferred band
                if (e < raw) e = Math.ceil(raw / 2) * 2;
                return Math.max(2, e);
            };
            let minUpper = Math.max(0.8, Math.ceil((horizU / cos30) * 10) / 10);
            const rawUpper = Math.max(minUpper, horizU / cos42);
            let recUpper = evenIntLen(rawUpper, 8, 10);
            if (recUpper < minUpper) recUpper = evenIntLen(minUpper, 8, 40);
            let maxUpper = Math.max(25.0, Math.ceil(recUpper * 2.0));
            if (beamType === 'container_spreader') {
                // STS trolley headblock: spreader IS the hoist head — tiny vertical
                // falls only (no hanging J-hook bridle above the yellow beam).
                minUpper = 0.12;
                recUpper = 0.28;
                maxUpper = 1.20;
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
            } else if (beamType === 'container_spreader') {
                // Cable lift: spreader stands off the roof by a real sling length.
                minLower = 1.0;
                recLower = 2.0;
                maxLower = 8.0;
            } else {
                const geomDrop = Math.max(0.35, maxVDrop);
                minLower = Math.max(0.4, Math.ceil(Math.hypot(horizL, geomDrop) * 10) / 10);
                // Prefer a short, near-vertical lower tier (2 or 4 m).  Only grow
                // past 4 m when geometry (wide plan offset / tall drop) demands it.
                const autoDrop = (horizL < 0.18)
                    ? Math.max(minLower, geomDrop)
                    : Math.max(geomDrop, horizL * Math.tan(42.5 * Math.PI / 180));
                const rawLower = Math.max(minLower, Math.hypot(horizL, autoDrop));
                recLower = evenIntLen(rawLower, 2, 4);
                if (recLower < minLower) recLower = evenIntLen(minLower, 2, 40);
                maxLower = Math.max(20.0, Math.ceil(recLower * 2.5));
            }

            // Cascaded / truss middle tier (hangers): even integer, default 2 m
            const mastGeom = Math.max(0.6, mast || 1.0);
            const recHanger = evenIntLen(Math.max(2, mastGeom), 2, 4);
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
            phy.beams.forEach(b => {
                if (!b || b.axis === 'frame') return;
                const floorY = cargoCeilingUnderBeam(b.x.x, b.x.z, spec, b);
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
                // Hard floor: underside on cargo roof
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
                lastCompoundPenetration: 0
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

                if (lashingDemandN >= lashingCapacityN || st.strapStress >= 1.0) {
                    st.status = 'sliding';
                    st.strapsBroken = true;
                    lashing.isIntact = false;
                    if (typeof simAudio !== 'undefined') {
                        simAudio.playCableSnap({ role: 'strap', type: 'web' });
                    }
                    // Starts sliding smoothly from rest relative to the deck
                    st.localVel.set(0, 0, 0);
                    const lashingGroup = activeCargoVisual.getObjectByName('flatRackLashingStraps');
                    const brokenGroup = activeCargoVisual.getObjectByName('flatRackBrokenStraps');
                    if (lashingGroup) lashingGroup.visible = false;
                    if (brokenGroup) brokenGroup.visible = true;

                    // Spawn lashing snap sparks along both sides of the Flat Rack
                    [-0.32, 0.32].forEach(xf => [-1, 1].forEach(zf => {
                        const pLocal = new THREE.Vector3(xf * meta.cL, meta.cargoBottomY + meta.cH * 0.35, zf * meta.cW * 0.5);
                        spawnSnapSparks(pLocal.applyQuaternion(phy.cargoQuat).add(phy.cargoPos));
                    }));
                    const statusEl = document.getElementById('sim-status-text');
                    if (statusEl) {
                        statusEl.textContent = `CẢNH BÁO SỰ CỐ: Độ nghiêng sàn (${tiltDeg.toFixed(1)}°) vượt giới hạn giữ tải! DÂY CHẰNG BUỘC ĐÃ ĐỨT! Kiện hàng đang trượt theo độ dốc sàn Flat Rack!`;
                    }
                }
                return;
            }

            if (st.status === 'sliding') {
                if ((phy.groundClearance || 0) <= 0.05 && tiltDeg < 2.5) {
                    st.localVel.multiplyScalar(Math.exp(-dt * 14.0));
                    return;
                }

                // 1. Friction & sliding dynamics on the inclined deck plane
                let ax = gLocal.x;
                let az = gLocal.z;
                const gN = gNormal;
                const vSpd = Math.hypot(st.localVel.x, st.localVel.z);
                const muK = lashing.kineticFriction;

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

        function placeLiftPoints() {
            if (!cargoRootGroup) return;
            // STS direct twistlock: hide cargo pad-eyes + shackles — pins lock into ISO castings.
            if (typeof isStsDirectAttach === 'function' && isStsDirectAttach()) {
                for (let i = 0; i < padEyeMeshes.length; i++) {
                    if (padEyeMeshes[i]) padEyeMeshes[i].visible = false;
                    if (hwMeshes[i]) hwMeshes[i].visible = false;
                }
                return;
            }
            cargoRootGroup.updateMatrixWorld(true);
            const invQ = phy.cargoQuat.clone().invert();
            for (let i = 0; i < state.lugs.length; i++) {
                if (!state.lugs[i] || !padEyeMeshes[i] || !hwMeshes[i]) continue;
                padEyeMeshes[i].visible = true;
                hwMeshes[i].visible = true;
                const sag = new THREE.Vector3(0, -(phy.cornerSag[i] || 0), 0).applyQuaternion(invQ);
                padEyeMeshes[i].position.copy(state.lugs[i]).add(sag);
                const fit = slingCrownWorld(i);
                const anchor = state.beamType === 'none'
                    ? new THREE.Vector3(phy.hookPos.x, phy.hookPos.y + HOOK_MASTER_OFFSET_Y, phy.hookPos.z)
                    : slingAnchorWorld(i, computeRigPose());
                const dir = pathLeaveArrive(anchor, fit.ring, legRestLength(i, getRigSpec())).arrive;
                const worldQ = tensionQuaternion(fit.ring, fit.ring.clone().add(dir));
                const pinW = fit.ring;
                hwMeshes[i].position.copy(cargoRootGroup.worldToLocal(pinW));
                hwMeshes[i].quaternion.copy(invQ.clone().multiply(worldQ));
                const pinAxis = new THREE.Vector3(1, 0, 0).applyQuaternion(worldQ);
                orientPadEyeToPin(padEyeMeshes[i], (state.lugNormals && state.lugNormals[i]) ? state.lugNormals[i] : new THREE.Vector3(0, 1, 0), pinAxis);
            }
        }

        function spreaderLocalAnchor(i) {
            const plan = tierPlan(state.beamType);
            if (plan) {
                const hit = plan.cables.find(c => c.role === 'leg' && c.index === i);
                if (hit && hit.a && hit.a.kind === 'body') {
                    const host = plan.bodies.find(b => b.id === hit.a.id);
                    if (host) return host.origin.clone().add(new THREE.Vector3(hit.a.local[0], hit.a.local[1], hit.a.local[2]));
                }
            }
            const type = state.beamType;
            const posX = i === 0 || i === 3;
            const posZ = i === 0 || i === 1;
            if (type === 'spreader') {
                const m = memberSpec('main');
                return new THREE.Vector3(posX ? m.a : m.b, -0.22, posZ ? 0.065 : -0.065);
            }
            if (type === 'lifting_beam') {
                const m = memberSpec('main');
                return new THREE.Vector3(posX ? m.a : m.b, -0.24, posZ ? 0.065 : -0.065);
            }
            if (type === 'cascaded' || type === 'modular_truss') {
                const top = memberSpec(type === 'modular_truss' ? 'truss' : 'top');
                const bar = memberSpec(posX ? 'lowPlus' : 'lowMinus');
                return new THREE.Vector3(posX ? top.a : top.b, -0.18, posZ ? bar.a : bar.b);
            }
            if (type === 'frame') {
                const rail = memberSpec(posZ ? 'railPos' : 'railNeg');
                const end = memberSpec(posX ? 'endPos' : 'endNeg');
                return new THREE.Vector3(posX ? rail.a : rail.b, -0.18, posZ ? end.a : end.b);
            }
            if (type === 'basket') {
                const bar = memberSpec(posX ? 'barPos' : 'barNeg');
                const x = posX ? spanBase().spanX / 2 : -spanBase().spanX / 2;
                return new THREE.Vector3(x, -0.14, posZ ? bar.a : bar.b);
            }
            const { spanX, spanZ } = getLPBoundingSpan();
            const yOff = type === 'container_spreader' ? -0.28 : 0;
            return new THREE.Vector3(posX ? spanX / 2 : -spanX / 2, yOff, posZ ? spanZ / 2 : -spanZ / 2);
        }

        function slingAnchorWorld(i, rig) {
            const cable = (phy.cables || []).find(c => c.role === 'leg' && c.index === i);
            if (cable) return attachWorld(cable.a);
            if (state.beamType === 'none') return rig.master.clone();
            return spreaderLocalAnchor(i).applyQuaternion(rig.frameQ).add(rig.spreaderPos);
        }

        function padEyeRingWorld(i) {
            const fallenHalf = (phy && phy.twinFallen && (
                (i === 1 || i === 2) ? phy.twinFallen.A
                    : (i === 0 || i === 3) ? phy.twinFallen.B
                        : null
            )) || null;
            if (fallenHalf && fallenHalf.x && fallenHalf.q) {
                const loc = (fallenHalf.lugLocal && fallenHalf.lugLocal[i])
                    ? fallenHalf.lugLocal[i].clone()
                    : new THREE.Vector3(0, (fallenHalf.half && fallenHalf.half.hy) || 1.2, 0);
                const n = new THREE.Vector3(0, 1, 0).applyQuaternion(fallenHalf.q).normalize();
                const ring = loc.applyQuaternion(fallenHalf.q).add(fallenHalf.x);
                const stsDirect = typeof isStsDirectAttach === 'function' && isStsDirectAttach();
                if (!stsDirect) ring.addScaledVector(n, 0.12);
                return { ring, n };
            }
            const rawNorm = (state.lugNormals && state.lugNormals[i]) ? state.lugNormals[i] : null;
            const n = (rawNorm && typeof rawNorm.clone === 'function')
                ? rawNorm.clone()
                : new THREE.Vector3(rawNorm?.x || 0, rawNorm?.y !== undefined ? rawNorm.y : 1, rawNorm?.z || 0);
            if (n.lengthSq() < 0.25) n.set(0, 1, 0);
            const q = (phy && phy.cargoQuat) ? phy.cargoQuat : new THREE.Quaternion();
            const pCargo = (phy && phy.cargoPos) ? phy.cargoPos : new THREE.Vector3();
            n.normalize().applyQuaternion(q);

            let rawLug = (state.lugs && state.lugs[i]) ? state.lugs[i] : null;
            let lug = (rawLug && typeof rawLug.clone === 'function')
                ? rawLug.clone()
                : (rawLug ? new THREE.Vector3(rawLug.x || 0, rawLug.y || 0, rawLug.z || 0) : null);
            if (!lug) {
                const sx = (i === 0 || i === 3) ? 1 : -1;
                const sz = (i === 0 || i === 1) ? 1 : -1;
                const L = state.L || 6.0, W = state.W || 2.4, H = state.H || 2.5;
                lug = new THREE.Vector3(sx * (L * 0.44), H * 0.48, sz * (W * 0.44));
            }
            const ring = lug.clone().applyQuaternion(q).add(pCargo);
            if (phy && phy.cornerSag && phy.cornerSag[i]) ring.y -= phy.cornerSag[i];
            const stsDirect = typeof isStsDirectAttach === 'function' && isStsDirectAttach();
            if (!stsDirect) ring.addScaledVector(n, 0.12);
            return { ring, n };
        }

        function cargoShackleScale(i) {
            const jaw = state.gear && state.gear.shackles && state.gear.shackles[i] ? state.gear.shackles[i].jawMm : 44;
            return THREE.MathUtils.clamp((jaw || 44) / 44, 0.45, 2.4);
        }

        function slingCrownWorld(i) {
            const { ring, n } = padEyeRingWorld(i);
            let dir = (n && typeof n.clone === 'function') ? n.clone() : new THREE.Vector3(0, 1, 0);
            // STS direct: attachment IS the ISO casting face — no shackle crown stand-off.
            if (typeof isStsDirectAttach === 'function' && isStsDirectAttach()) {
                return { ring: ring || new THREE.Vector3(), dir, crown: (ring && ring.clone) ? ring.clone() : new THREE.Vector3() };
            }
            const target = state.beamType === 'none'
                ? new THREE.Vector3(phy.hookPos.x, phy.hookPos.y + HOOK_MASTER_OFFSET_Y, phy.hookPos.z)
                : slingAnchorWorld(i, computeRigPose());
            const to = (target && ring) ? target.clone().sub(ring) : new THREE.Vector3(0, 1, 0);
            if (to.lengthSq() > 0.04) dir = to.normalize();
            const crownDist = hardwareCrownOffset(state.hwType || 'bow_shackle', cargoShackleScale(i));
            const crown = (ring && typeof ring.clone === 'function') ? ring.clone().addScaledVector(dir, crownDist) : new THREE.Vector3();
            return { ring: ring || new THREE.Vector3(), dir, crown };
        }

        function lugEyeWorld(i) {
            return slingCrownWorld(i).crown;
        }

        // A factory/start-up presentation can contain convenient 8 m upper and
        // 2 m lower strings.  They are *not* user engineering inputs once the
        // operator returns a tier to Auto.  Keeping them silently was the root
        // cause of impossible sling angles: the hook auto-lift was correctly
        // refused by the angle guard, yet the UI looked as though it had hoisted.
        //
        // `userSet` is written by the detailed gear editor.  The final branch
        // also keeps direct API/import values (for example a deliberate 12 m
        // slack test) valid without treating the known factory placeholders as
        // real manufactured cable lengths.
        function hasExplicitCableLength(item, role) {
            if (!item || item.lengthM == null) return false;
            if (item.userSet || state.slingUserSet || state.holdCableLength) return true;
            const factoryPlaceholder = role === 'upper' ? 8.0 : 2.0;
            return Math.abs(item.lengthM - factoryPlaceholder) > 0.005;
        }

        // Global sling selection applies to every uncustomised leg.  The
        // start-up sample is intentionally a chain assembly, so treating its
        // saved per-leg label as an individual override made a user-selected
        // wire/round sling continue to render as chain.
        function effectiveSlingType(item) {
            if (item && item.slingType) return item.slingType;
            return state.slingType || (item && item.slingType) || 'wire';
        }

        function legRestLength(i, spec) {
            const item = state.gear && state.gear.legs && state.gear.legs[i];
            const custom = hasExplicitCableLength(item, 'leg') ? item.lengthM : null;
            const delta = (state.legDeltaL && state.legDeltaL[i]) || 0;
            const floor = (typeof isStsDirectAttach === 'function' && isStsDirectAttach()) ? 0.04 : 0.35;
            if (custom != null) return Math.max(floor, custom + delta);
            if (state.lowerSlingLength != null) return Math.max(floor, state.lowerSlingLength + delta);
            const base = spec ? spec.lower : 2.8;
            return Math.max(floor, base + delta);
        }

        function autoSlingWll(rec, fallback) {
            if (!rec) return fallback || 10;
            const parts = Math.max(1, Math.min(4, rec.parts || 1));
            const type = effectiveSlingType(rec);
            const d = rec.diaMm || (type === 'web' ? 60 : (type === 'chain' ? 16 : 22));
            let singleWll = 0;
            if (type === 'chain') {
                const factor = (rec.grade === 'g100') ? 0.040 : 0.032;
                singleWll = factor * d * d;
            } else if (type === 'web') {
                singleWll = Math.max(0.5, d / 30);
            } else if (type === 'round_sling') {
                singleWll = (rec.grade === 'hmpe') ? (d * d / 120) : Math.max(0.5, d / 28);
            } else if (type === 'grommet') {
                singleWll = 1.8 * (0.0163 * d * d);
            } else {
                singleWll = 0.0163 * d * d;
            }
            return Math.max(0.2, Number((singleWll * parts).toFixed(2)));
        }

        function legSwl(i) {
            const item = state.gear && state.gear.legs && state.gear.legs[i];
            if (item && item.swlT != null) return item.swlT;
            return autoSlingWll(item, state.wllPerLeg);
        }

        function upperSwl(i) {
            const item = state.gear && state.gear.uppers && state.gear.uppers[i];
            if (item && item.swlT != null) return item.swlT;
            return autoSlingWll(item, state.wllPerLeg * 2);
        }

        function activeUpperIndexes() {
            if (state.beamType === 'none') return [];
            if (state.beamType === 'frame' || state.beamType === 'container_spreader' || state.beamType === 'basket' || customBeamMeshes[state.beamType]) return [0, 1, 2, 3];
            return [0, 1];
        }

        function cableInvMass(r, n, quat, invI, invMass) {
            const rxn = new THREE.Vector3().crossVectors(r, n);
            const ang = alphaFromTorque(rxn, quat, invI);
            const w = invMass + rxn.dot(ang);
            return Math.max(w, invMass * 0.25);
        }

        function solve3(A, b) {
            const M = A.map((row, i) => [row[0], row[1], row[2], b[i]]);
            for (let k = 0; k < 3; k++) {
                let piv = k;
                for (let i = k + 1; i < 3; i++) if (Math.abs(M[i][k]) > Math.abs(M[piv][k])) piv = i;
                if (Math.abs(M[piv][k]) < 1e-8) return null;
                if (piv !== k) { const tmp = M[k]; M[k] = M[piv]; M[piv] = tmp; }
                for (let i = k + 1; i < 3; i++) {
                    const f = M[i][k] / M[k][k];
                    for (let j = k; j < 4; j++) M[i][j] -= f * M[k][j];
                }
            }
            const x = [0, 0, 0];
            for (let i = 2; i >= 0; i--) {
                let s = M[i][3];
                for (let j = i + 1; j < 3; j++) s -= M[i][j] * x[j];
                x[i] = s / M[i][i];
            }
            return x;
        }

        function verticalShares(legs, weightT) {
            const n = legs.length;
            if (!n) return [];
            if (n === 1) return [weightT];
            let sx = 0, sz = 0, sxx = 0, szz = 0, sxz = 0;
            legs.forEach(L => {
                sx += L.rx; sz += L.rz; sxx += L.rx * L.rx; szz += L.rz * L.rz; sxz += L.rx * L.rz;
            });
            const coef = solve3(
                [[n, sx, sz], [sx, sxx + 1e-4, sxz], [sz, sxz, szz + 1e-4]],
                [weightT, 0, 0]
            );
            let V = legs.map(L => coef ? Math.max(0, coef[0] + coef[1] * L.rx + coef[2] * L.rz) : weightT / n);
            const sum = V.reduce((a, b) => a + b, 0);
            if (sum < 1e-4) V = legs.map(() => weightT / n);
            else V = V.map(v => v * weightT / sum);
            if (n >= 3) {
                const equal = weightT / n;
                const floorShare = equal * 0.34;
                if (V.some(v => v < floorShare)) {
                    V = V.map(v => Math.max(v, floorShare));
                    const lifted = V.reduce((a, b) => a + b, 0);
                    V = V.map(v => v * weightT / lifted);
                }
            }
            return V;
        }

        function upperAnchorWorld(i, rig) {
            const cable = (phy.cables || []).find(c => c.role === 'upper' && c.index === i);
            if (cable) return attachWorld(cable.b);
            const { beamType } = state;
            if (beamType === 'spreader' || beamType === 'lifting_beam') {
                const m = memberSpec('main');
                const x = i === 0 ? m.b : m.a;
                const y = beamType === 'lifting_beam' ? 0.24 : 0.22;
                return new THREE.Vector3(x, y, 0).applyQuaternion(rig.frameQ).add(rig.spreaderPos);
            }
            if (beamType === 'cascaded' || beamType === 'modular_truss') {
                const top = memberSpec(beamType === 'modular_truss' ? 'truss' : 'top');
                const x = i === 0 ? top.b : top.a;
                const hangerM = (state.hangerSlingLength != null)
                    ? state.hangerSlingLength
                    : ((typeof getRigSpec === 'function' && getRigSpec().hanger) || 2.0);
                const yTop = Math.max(beamType === 'modular_truss' ? 0.85 : 1.0, hangerM);
                return new THREE.Vector3(x, yTop + 0.22, 0).applyQuaternion(rig.frameQ).add(rig.spreaderPos);
            }
            const low = spreaderLocalAnchor(i);
            return new THREE.Vector3(low.x, Math.abs(low.y), low.z).applyQuaternion(rig.frameQ).add(rig.spreaderPos);
        }

        function gearCableRecord(cable) {
            if (!cable) return null;
            if (cable.role === 'upper') return (state.gear.uppers && state.gear.uppers[cable.index]) || null;
            if (cable.role === 'leg') return (state.gear.legs && state.gear.legs[cable.index]) || null;
            if (cable.role === 'hanger') return (state.gear.hangers && state.gear.hangers[cable.index]) || null;
            if (cable.role === 'extra') return ((state.gear.extraCables || [])[cable.index]) || null;
            return null;
        }

        function estimateCableMassKg(cable) {
            const rec = gearCableRecord(cable);
            if (rec && rec.massKg != null && rec.massKg > 0) return rec.massKg;
            const len = Math.max(0.4, (cable && cable.L0) || state.slingLength || 2.5);
            let look = effectiveSlingType(rec);

            const parts = Math.max(1, Math.min(4, (rec && rec.parts) || 1));
            const d = Math.max(8, (rec && rec.diaMm) || (look === 'web' || look === 'round_sling' ? 60 : 20));
            let baseKg = 0;
            if (look === 'chain') baseKg = 0.022 * d * d * len + 1.8;
            else if (look === 'web') baseKg = 0.018 * d * len + 0.9;
            else if (look === 'round_sling') baseKg = 0.016 * d * len + 1.1;
            else if (look === 'grommet') baseKg = 0.0072 * d * d * len + 2.8;
            else baseKg = 0.0041 * d * d * len + 2.2;
            return baseKg * parts;
        }

        // Split a snapped cable into two free-hanging stubs. Upper stub hangs from end A
        // under its own mass only; lower stub hangs from end B. No A↔B tension remains.
        function initCableBreak(cable, frac) {
            if (!cable) return null;
            const pA = cable.a ? attachWorld(cable.a) : phy.hookPos.clone();
            const pB = cable.b ? attachWorld(cable.b) : phy.cargoPos.clone();
            const span = Math.max(0.25, pA.distanceTo(pB));
            const L0 = Math.max(0.35, cable.L0 || span);
            const f = THREE.MathUtils.clamp(frac != null ? frac : 0.48, 0.22, 0.78);
            const mid = pA.clone().lerp(pB, f);
            const along = pB.clone().sub(pA);
            if (along.lengthSq() < 1e-8) along.set(0, -1, 0);
            else along.normalize();
            const massKg = Math.max(0.4, estimateCableMassKg(cable));
            const upperLen = Math.max(0.16, L0 * f);
            const lowerLen = Math.max(0.16, L0 * (1 - f));

            // Was the sling carrying load when it parted?
            const seenT = Math.max(
                cable.tensionT || 0,
                cable.role === 'leg' ? (phy.legTensions[cable.index] || 0) : 0,
                cable.role === 'upper' ? (phy.upperTensions[cable.index] || 0) : 0
            );
            const wasTaut = !cable.slack && (seenT > 0.12 || span >= L0 - 0.03);

            const down = new THREE.Vector3(0, -1, 0);
            const lat = new THREE.Vector3(along.x, 0, along.z);
            if (lat.lengthSq() > 1e-6) lat.normalize();
            else lat.set(1, 0, 0);

            // Seed tip in free air beside/below the pin — never onto the cargo roof above the pin
            // (that made cut ends "chổng trời"). Prefer lateral hang clear of the shell.
            const hangTip = (pin, len, sideSign) => {
                // Nearly full hang length — short drop left a U-curl with tip "ngóc đầu"
                const drop = Math.min(len * 0.96, Math.max(0.22, len * 0.90));
                const side = 0.08 + Math.min(0.18, len * 0.06);
                let tip = pin.clone()
                    .addScaledVector(down, drop)
                    .addScaledVector(lat, sideSign * side);
                if (typeof pushPointClear === 'function') {
                    for (let attempt = 0; attempt < 4; attempt++) {
                        const cleared = pushPointClear(tip, 0.032, new Set());
                        tip.copy(cleared);
                        if (tip.y <= pin.y + 0.02) break;
                        // Ejected upward onto a roof — try further sideways/down
                        tip.copy(pin)
                            .addScaledVector(down, drop * (0.5 + attempt * 0.15))
                            .addScaledVector(lat, sideSign * side * (1.4 + attempt * 0.5));
                    }
                }
                if (tip.y > pin.y) tip.y = pin.y - 0.05;
                const rel = tip.clone().sub(pin);
                const d = rel.length();
                if (d > len && d > 1e-6) tip.copy(pin).addScaledVector(rel.multiplyScalar(1 / d), len * 0.95);
                if (d < 0.08) tip.copy(pin).addScaledVector(down, Math.min(len * 0.5, 0.3));
                return tip;
            };

            let tipU;
            let tipL;
            const jitter = () => (simRandom() - 0.5) * (wasTaut ? 0.20 : 0.05);
            const vA = endVelocity(cable.a, phy.cargoVel.clone(), phy.cargoOmega.clone());
            const vB = endVelocity(cable.b, phy.cargoVel.clone(), phy.cargoOmega.clone());
            const vMid = vA.clone().lerp(vB, f);
            let velU;
            let velL;

            if (wasTaut) {
                // TAUT SNAP: tips start near the cut, then whip apart along the cable axis.
                // Stored tension → impulsive recoil; gravity takes over after the whip.
                const sep = 0.06 + Math.min(0.20, seenT * 0.04);
                tipU = mid.clone().addScaledVector(along, -0.04).addScaledVector(down, 0.02);
                tipL = mid.clone().addScaledVector(along, 0.04).addScaledVector(down, 0.02);
                if (typeof pushPointClear === 'function') {
                    tipU.copy(pushPointClear(tipU, 0.03, new Set()));
                    tipL.copy(pushPointClear(tipL, 0.03, new Set()));
                }
                // Clamp tips to rest lengths from their pins
                const clampToPin = (tip, pin, len) => {
                    const r = tip.clone().sub(pin);
                    const d = r.length();
                    if (d > len && d > 1e-6) tip.copy(pin).addScaledVector(r.multiplyScalar(1 / d), len * 0.98);
                    return tip;
                };
                tipU = clampToPin(tipU, pA, upperLen);
                tipL = clampToPin(tipL, pB, lowerLen);
                const whip = 1.2 + Math.min(3.5, seenT * 0.55);
                velU = vMid.clone()
                    .addScaledVector(along, -whip)
                    .add(new THREE.Vector3(jitter(), -0.8 - simRandom() * 0.6, jitter()));
                velL = vMid.clone()
                    .addScaledVector(along, whip)
                    .add(new THREE.Vector3(jitter(), -1.0 - simRandom() * 0.7, jitter()));
                const velCap = 0.32;
                if (velU.length() > velCap) velU.setLength(velCap);
                if (velL.length() > velCap) velL.setLength(velCap);
            } else {
                // SLACK CUT: no stored energy — stubs simply droop under gravity.
                tipU = hangTip(pA, upperLen, -1);
                tipL = hangTip(pB, lowerLen, 1);
                velU = vMid.clone().add(new THREE.Vector3(jitter(), -0.25 - simRandom() * 0.15, jitter()));
                velL = vMid.clone().add(new THREE.Vector3(jitter(), -0.30 - simRandom() * 0.15, jitter()));
                if (velU.length() > 0.32) velU.setLength(0.32);
                if (velL.length() > 0.32) velL.setLength(0.32);
            }

            cable.break = {
                frac: f,
                upperLen,
                lowerLen,
                tipU,
                tipL,
                velU,
                velL,
                massU: massKg * f,
                massL: massKg * (1 - f),
                wasTaut: !!wasTaut,
                snapTensionT: seenT,
                age: 0,
                settleU: 0,
                settleL: 0
            };
            cable.tensionT = 0;
            cable.slack = true;
            cable._j = 0;
            return cable.break;
        }

        function ensureCableBreakState(cable) {
            if (!cable || !cableIsBroken(cable)) {
                if (cable && cable.break) cable.break = null;
                return null;
            }
            if (!cable.break) {
                // Manual broken=true (UI/test) still gets unload impulse + split stubs
                releaseSnapImpulse(cable);
                initCableBreak(cable);
            }
            return cable.break;
        }

        function clearCableBreak(cable) {
            if (cable) cable.break = null;
            if (typeof simAudio !== 'undefined') {
                const rec = gearCableRecord(cable);
                const reeveType = (rec && (rec.slingType || (rec.grade === 'g80' || rec.grade === 'g100' ? 'chain' : (rec.grade === 'poly' ? 'web' : (rec.grade === 'hmpe' ? 'round_sling' : 'wire'))))) || state.slingType || 'wire';
                simAudio.playCableReeve({
                    role: cable ? cable.role : 'leg',
                    type: reeveType
                });
            }
        }

        function settleBrokenTipOnSolids(tip, vel, previous, pad) {
            const radius = Math.max(0.018, pad || 0.024);
            const floor = supportY(tip.x, tip.z) + radius;
            let touching = false;
            let normal = null;
            if (tip.y < floor) {
                tip.y = floor;
                touching = true;
                normal = typeof supportNormal === 'function'
                    ? supportNormal(tip.x, tip.z)
                    : new THREE.Vector3(0, 1, 0);
            }

            // The cargo's local +Y is the normal of its tilted roof.  Removing
            // only the into-surface velocity retains the gravity component along
            // the roof, so the loose end actually slides off an inclined box.
            const roofY = typeof cargoRoofAtXZ === 'function'
                ? cargoRoofAtXZ(tip.x, tip.z, radius)
                : null;
            if (roofY != null && tip.y < roofY) {
                tip.y = roofY;
                touching = true;
                normal = new THREE.Vector3(0, 1, 0).applyQuaternion(phy.cargoQuat).normalize();
            }

            // Account for sides, beams and the cargo outer skin as well.  This
            // prevents a high-speed free end from tunnelling through a lid/rail.
            if (typeof pushPointClear === 'function') {
                const clear = pushPointClear(tip, radius, new Set());
                const correction = clear.clone().sub(tip);
                if (correction.lengthSq() > 1e-10) {
                    tip.copy(clear);
                    touching = true;
                    normal = correction.normalize();
                }
            }
            if (!touching || !normal) return;
            const into = vel.dot(normal);
            if (into < 0) vel.addScaledVector(normal, -into);
            // Surface friction kills only tangential energy; it must not pin the
            // tip against an inclined container roof.
            const vn = normal.clone().multiplyScalar(vel.dot(normal));
            vel.sub(vn).multiplyScalar(0.84).add(vn);
            if (previous && tip.distanceToSquared(previous) < 1e-7 && vel.lengthSq() < 0.004) vel.set(0, 0, 0);
        }

        function stepFreeRopeTip(tip, vel, pin, restLen, dt, opts) {
            if (!tip || !vel || !pin) return;
            const L = Math.max(0.12, restLen || 0.5);
            const previous = tip.clone();
            const wasTaut = !!(opts && opts.wasTaut);
            const age = (opts && opts.age != null) ? opts.age : 0;
            // Gravity always on; after the whip window, settle hard to a vertical hang
            vel.y -= G_EARTH * dt * (wasTaut ? 1.2 : 1.55);

            // Rest pose = straight down under the pin (same XZ). Only nudge aside if a solid blocks.
            const floorY = (typeof supportY === 'function')
                ? supportY(pin.x, pin.z) + 0.034
                : (pin.y - L);
            const dropIdeal = Math.min(L * 0.995, Math.max(0.18, L * 0.98));
            const hangTarget = new THREE.Vector3(
                pin.x,
                pin.y - Math.min(dropIdeal, Math.max(0.10, pin.y - floorY)),
                pin.z
            );
            if (typeof pushPointClear === 'function') {
                let ht = hangTarget.clone();
                const sideSign = (opts && opts.sideSign) ? opts.sideSign : 1;
                for (let k = 0; k < 5; k++) {
                    const cleared = pushPointClear(ht, 0.030, new Set());
                    const blockedUp = cleared.y > pin.y - 0.06 || cleared.distanceToSquared(ht) > 1e-6 && cleared.y > ht.y + 0.01;
                    ht.copy(cleared);
                    // Free air under pin is preferred; only step aside when jammed into a solid/roof
                    if (ht.y <= pin.y - 0.08 && Math.hypot(ht.x - pin.x, ht.z - pin.z) < 0.35) break;
                    if (!blockedUp && ht.y <= pin.y - 0.05) break;
                    ht.set(
                        pin.x + sideSign * (0.05 + k * 0.07),
                        pin.y - Math.min(dropIdeal, Math.max(0.16, pin.y - floorY)),
                        pin.z
                    );
                }
                if (ht.y > pin.y - 0.04) ht.y = pin.y - Math.min(dropIdeal, 0.22);
                hangTarget.copy(ht);
            }

            const spd = vel.length();
            // Whip phase: keep momentum. Settle phase: yank tip under the pin.
            const whipWindow = wasTaut ? 0.55 : 0.18;
            const settling = age > whipWindow || spd < (wasTaut ? 1.1 : 0.55);
            const toHang = hangTarget.clone().sub(tip);
            if (toHang.lengthSq() > 1e-6) {
                const bias = settling ? 14.0 : (wasTaut && spd > 1.2 ? 1.8 : 6.0);
                vel.addScaledVector(toHang.normalize(), Math.min(settling ? 12.0 : 7.0, toHang.length() * bias) * dt);
            }
            // Kill sideways motion once settling so the stub ends "thẳng đuột" down
            if (settling) {
                vel.x *= Math.max(0, 1 - 6.5 * dt);
                vel.z *= Math.max(0, 1 - 6.5 * dt);
                // Soft positional pull toward vertical hang
                tip.x = THREE.MathUtils.lerp(tip.x, hangTarget.x, Math.min(1, 4.5 * dt));
                tip.z = THREE.MathUtils.lerp(tip.z, hangTarget.z, Math.min(1, 4.5 * dt));
            }
            if (spd > 0.05) vel.addScaledVector(vel, -Math.min(3.2, (settling ? 1.4 : (wasTaut ? 0.4 : 0.9)) * spd) * dt / spd);
            tip.addScaledVector(vel, dt);
            settleBrokenTipOnSolids(tip, vel, previous, 0.034);

            // Hard rule: free tip never above the pin
            if (tip.y > pin.y + 0.02) {
                tip.y = THREE.MathUtils.lerp(tip.y, pin.y - 0.1, 0.8);
                if (vel.y > 0) vel.y = -Math.abs(vel.y) - 0.5;
            }

            // Length constraint from pin
            let rel = tip.clone().sub(pin);
            let dist = rel.length();
            if (!(dist > 1e-6)) {
                tip.copy(hangTarget);
                settleBrokenTipOnSolids(tip, vel, previous, 0.034);
                if (opts && opts.settleKey && opts.breakState) opts.breakState[opts.settleKey] = 1;
                return;
            }
            if (dist > L) {
                tip.copy(pin).addScaledVector(rel.multiplyScalar(1 / dist), L);
                const n = tip.clone().sub(pin).normalize();
                const vRad = vel.dot(n);
                if (vRad > 0) vel.addScaledVector(n, -vRad);
            }
            settleBrokenTipOnSolids(tip, vel, previous, 0.034);
            if (typeof pushPointClear === 'function') {
                const cleared = pushPointClear(tip, 0.036, new Set());
                if (cleared.y > pin.y + 0.02) {
                    // Prefer stay under pin; only slide aside if roof keeps ejecting up
                    cleared.set(hangTarget.x, Math.min(cleared.y, pin.y - 0.08), hangTarget.z);
                    tip.copy(pushPointClear(cleared, 0.036, new Set()));
                    if (tip.y > pin.y) tip.y = pin.y - 0.05;
                } else {
                    const corr = cleared.clone().sub(tip);
                    if (corr.lengthSq() > 1e-10) {
                        tip.copy(cleared);
                        const cn = corr.normalize();
                        const into = vel.dot(cn);
                        if (into < 0) vel.addScaledVector(cn, -into);
                    }
                }
                rel = tip.clone().sub(pin);
                dist = rel.length();
                if (dist > L && dist > 1e-6) {
                    tip.copy(pin).addScaledVector(rel.multiplyScalar(1 / dist), L);
                    if (tip.y > pin.y) tip.y = pin.y - 0.02;
                    settleBrokenTipOnSolids(tip, vel, previous, 0.034);
                }
            }

            // When fully settled, snap tip under pin so render path is vertical
            if (settling && vel.length() < 0.45) {
                tip.x = THREE.MathUtils.lerp(tip.x, hangTarget.x, 0.35);
                tip.z = THREE.MathUtils.lerp(tip.z, hangTarget.z, 0.35);
                tip.y = Math.min(tip.y, hangTarget.y + 0.02);
                if (opts && opts.breakState && opts.settleKey) {
                    opts.breakState[opts.settleKey] = Math.min(1, (opts.breakState[opts.settleKey] || 0) + dt * 1.8);
                }
            } else if (opts && opts.breakState && opts.settleKey) {
                opts.breakState[opts.settleKey] = Math.max(0, (opts.breakState[opts.settleKey] || 0) - dt * 0.6);
            }
            const finalRel = tip.clone().sub(pin);
            const finalDist = finalRel.length();
            if (finalDist > L && finalDist > 1e-6) {
                tip.copy(pin).addScaledVector(finalRel.multiplyScalar(1 / finalDist), L);
            }
        }

        // Attachment only feels the stub's own hanging weight — never the far-side payload.
        function applyHangingStubPull(end, pin, tip, restLen, massKg, dt, invMass, invI, vCom, omega) {
            if (!end || end.kind === 'hook' || !(massKg > 0.05) || !pin || !tip) return;
            const L = Math.max(0.12, restLen || 0.5);
            const delta = tip.clone().sub(pin);
            const dist = delta.length();
            if (!(dist > 0.04) || dist < L * 0.92) return;
            const n = delta.multiplyScalar(1 / dist); // pin → tip (rope pulls attachment toward tip)
            const vertical = Math.max(0, -n.y);
            const T = massKg * G_EARTH * (0.35 + 0.65 * vertical);
            kickEnd(end, n, T * dt, invMass, invI, vCom, omega);
        }

        function integrateBrokenCableStubs(dt, invMass, invI, vCom, omega) {
            (phy.cables || []).forEach(c => {
                if (!cableIsBroken(c)) {
                    if (c.break) c.break = null;
                    return;
                }
                const br = ensureCableBreakState(c);
                if (!br) return;
                br.age = (br.age || 0) + dt;
                const pinU = attachWorld(c.a);
                const pinL = attachWorld(c.b);
                const whipOpts = { wasTaut: !!br.wasTaut, age: br.age, breakState: br };
                stepFreeRopeTip(br.tipU, br.velU, pinU, br.upperLen, dt, { ...whipOpts, sideSign: -1, settleKey: 'settleU' });
                stepFreeRopeTip(br.tipL, br.velL, pinL, br.lowerLen, dt, { ...whipOpts, sideSign: 1, settleKey: 'settleL' });
                applyHangingStubPull(c.a, pinU, br.tipU, br.upperLen, br.massU, dt, invMass, invI, vCom, omega);
                applyHangingStubPull(c.b, pinL, br.tipL, br.lowerLen, br.massL, dt, invMass, invI, vCom, omega);
            });
        }

        function releaseSnapImpulse(cable) {
            if (!cable || !cable.b || cable.b.kind === 'hook') return;
            const isGrounded = (phy.groundClearance || 0) <= 0.05 || state.poseLock;
            const seenT = Math.max(
                cable.tensionT || 0,
                cable.role === 'leg' ? (phy.legTensions[cable.index] || 0) : 0,
                cable.role === 'upper' ? (phy.upperTensions[cable.index] || 0) : 0,
                isGrounded ? 0 : 0.35
            );
            if (seenT <= 1e-4) return;
            const pA = attachWorld(cable.a);
            const pB = attachWorld(cable.b);
            const unload = pB.clone().sub(pA);
            if (unload.lengthSq() < 1e-8) unload.set(0, -1, 0);
            else unload.normalize();
            // Taut snap: stronger unload impulse so the load lists; slack cut: gentle.
            const mass = Math.max(80, state.weight * 1000);
            const tautFactor = (!cable.slack && seenT > 0.12) ? 0.028 : 0.008;
            const maxDv = (!cable.slack && seenT > 0.12) ? 1.15 : 0.35;
            const j = Math.min(seenT * 1000 * G_EARTH * tautFactor, mass * maxDv);
            const invMass = 1 / mass;
            const invI = inertiaInverseAboutCog(mass, state.L, state.W, state.H, state.cogX, state.cogY, state.cogZ);
            if (!isGrounded) {
                kickEnd(cable.b, unload, j, invMass, invI, phy.cargoVel, phy.cargoOmega);
            }
            if (cable.a && cable.a.kind === 'body' && cable.a.body) {
                kickEnd(cable.a, unload.clone().negate(), j * 0.4, invMass, invI, phy.cargoVel, phy.cargoOmega);
            }
            if (phy.cargoVel.length() > 2.5) phy.cargoVel.setLength(2.5);
            if (phy.cargoOmega.length() > 1.2) phy.cargoOmega.setLength(1.2);
        }

        // A cable can be cut while the scenario is still in the convenient
        // "placed pose" preview mode.  A broken load path is never a pose: it must
        // immediately enter the dynamic solver so gravity and the remaining cables
        // can create the resulting swing, tilt, or fall on the next substep.
        function releaseRigForCableFailure() {
            if (!state.poseLock) return;
            state.poseLock = false;
            phy.rigLive = true;
            // The locked pose has no accumulated dynamic velocity.  Start the
            // failure from rest rather than inheriting stale values from a prior run.
            if (phy.cargoVel) phy.cargoVel.set(0, 0, 0);
            if (phy.cargoOmega) phy.cargoOmega.set(0, 0, 0);
            (phy.beams || []).forEach(b => {
                if (b.v) b.v.set(0, 0, 0);
                if (b.w) b.w.set(0, 0, 0);
            });
            syncPoseLockUI();
        }

        // A parted frame top bridle instantly removes the reaction at one
        // corner of the load path.  Preserve that real unbalanced moment as a
        // small angular impulse rather than waiting for a perfectly symmetric
        // constraint solver to discover it several frames later.  Equal cuts
        // at all four corners cancel naturally, while a single off-centre cut
        // starts the expected heavy, smooth list.
        function applyLostFrameBranchMoment(cable) {
            if (!cable || cable._frameMomentApplied || cable.role !== 'upper'
                || state.beamType !== 'frame' || (phy.groundClearance || 0) <= 0.05) return;
            const lower = (phy.cables || []).find(c => c.role === 'leg' && c.index === cable.index);
            if (!lower || !lower.b || lower.b.kind !== 'cargo') return;
            const mass = Math.max(80, (phy.effectiveCargoWeightT != null ? phy.effectiveCargoWeightT : state.weight) * 1000);
            const com = cargoComNow();
            const r = attachWorld(lower.b).sub(com);
            // Approximate the lost share of vertical support over the short
            // shock-transfer interval.  It is deliberately modest: gravity
            // and the remaining legs then govern the continuing motion.
            const lostReaction = new THREE.Vector3(0, -mass * G_EARTH * 0.30, 0);
            const torque = new THREE.Vector3().crossVectors(r, lostReaction);
            const invI = inertiaInverseAboutCog(mass, state.L, state.W, state.H, state.cogX, state.cogY, state.cogZ);
            const dOmega = alphaFromTorque(torque, phy.cargoQuat, invI).multiplyScalar(0.30);
            if (dOmega.length() > 0.22) dOmega.setLength(0.22);
            phy.cargoOmega.add(dOmega);
            cable._frameMomentApplied = true;
        }

        function noteCableSnap(cable, message, frac) {
            releaseRigForCableFailure();
            const rec = gearCableRecord(cable);
            if (rec) rec.broken = true;
            releaseSnapImpulse(cable);
            applyLostFrameBranchMoment(cable);
            // frac = cut location along A→B (0..1); omit for mid-span default
            initCableBreak(cable, frac);
            if (cable) cable._failureProcessed = true;

            // Twin: if one 20ft lost both outer legs, that half free-falls on its own.
            if (typeof checkTwinHalfDetachment === 'function') checkTwinHalfDetachment();

            // All lower legs gone → free fall under gravity (never freeze mid-air).
            if (!cargoHasIntactLoadLegs()) {
                state.poseLock = false;
                phy.rigLive = true;
                if (typeof clearStsTwinCableFlareState === 'function') {
                    // Keep residual sep for wreckage look, but drop the plant pitch
                    // that was falsely seating toes on the quay while COM floated.
                    if (phy.twinCableFlare) {
                        phy.twinCableFlare.pitchA = 0;
                        phy.twinCableFlare.pitchB = 0;
                        phy.twinCableFlare.targetSmooth = 0;
                        phy.twinCableFlare.planted = false;
                        phy.twinCableFlare.active = (phy.twinCableFlare.sepExtra || 0) > 0.02;
                    }
                    if (typeof applyStsTwinCableFlareVisual === 'function') applyStsTwinCableFlareVisual();
                    if (typeof syncTwinCableLugsFromFlare === 'function') syncTwinCableLugsFromFlare();
                }
                if (phy.cargoVel && cargoAabbClearance() > 0.08) {
                    phy.cargoVel.y = Math.min(phy.cargoVel.y, -1.2);
                }
                if (typeof syncPoseLockUI === 'function') syncPoseLockUI();
            }

            const isGrounded = cargoAabbClearance() <= 0.05;
            phy.shock = isGrounded ? 1.0 : 1.8;
            phy.shockFrames = isGrounded ? 0 : 14;
            const br = cable && cable.break;
            const pin = br ? br.tipU.clone().lerp(br.tipL, 0.5)
                : (cable.b ? attachWorld(cable.b) : phy.cargoPos.clone());
            spawnSnapSparks(pin);
            if (typeof simAudio !== 'undefined') {
                const snapType = (rec && (rec.slingType || (rec.grade === 'g80' || rec.grade === 'g100' ? 'chain' : (rec.grade === 'poly' ? 'web' : (rec.grade === 'hmpe' ? 'round_sling' : 'wire'))))) || state.slingType || 'wire';
                simAudio.playCableSnap({
                    role: cable ? cable.role : 'leg',
                    type: snapType
                });
            }
            const status = document.getElementById('sim-status-text');
            if (status) {
                if (isGrounded) {
                    status.textContent = message + ' Kiện hàng đang nằm trên mặt đất/đà kê — giữ nguyên trạng thái cân bằng trên sàn.';
                } else if (!cargoHasIntactLoadLegs()) {
                    status.textContent = message + ' Mất toàn bộ đường tải — kiện rơi tự do theo trọng lực.';
                } else if (phy.twinFallen && (phy.twinFallen.A || phy.twinFallen.B)) {
                    status.textContent = message + ' Một 20ft twin đã mất cáp — rơi tự do; nửa còn lại vẫn treo.';
                } else {
                    status.textContent = message + ' Các nhánh còn lại nhận hệ số xung kích 1.8.';
                }
            }
        }

        function spawnSnapSparks(origin) {
            if (!origin) return;
            if (!phy.sparkGroup) {
                phy.sparkGroup = new THREE.Group();
                scene.add(phy.sparkGroup);
            }
            const geo = new THREE.SphereGeometry(0.035, 6, 6);
            for (let i = 0; i < 14; i++) {
                const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: i % 2 ? 0xf97316 : 0xfacc15, transparent: true, opacity: 1 }));
                m.position.copy(origin);
                m.userData.vel = new THREE.Vector3((simRandom() - 0.5) * 6, simRandom() * 5, (simRandom() - 0.5) * 6);
                m.userData.life = 28;
                phy.sparkGroup.add(m);
            }
        }

        function publishXpbdLoads() {
            for (let i = 0; i < 8; i++) {
                phy.legTensions[i] = 0;
                phy.legSlacks[i] = true;
                phy.legForceN[i] = 0;
                if (i < 4) phy.upperTensions[i] = 0;
            }
            const grossLoadT = phy.massBreakdown ? phy.massBreakdown.grossCraneLoadT : (state.weight + (phy.gearWeight || 1.0));
            (phy.cables || []).forEach(c => {
                const n = c.n || new THREE.Vector3(0, 1, 0);
                const horiz = Math.abs(Math.asin(THREE.MathUtils.clamp(n.y, -1, 1)) * 180 / Math.PI);
                const slack = !(c.tensionT > 0.02) || cableIsBroken(c);
                if (c.role === 'leg' && c.index < 8 && state.gear.legs[c.index]) {
                    const leg = state.gear.legs[c.index];
                    phy.legAngleDeg[c.index] = horiz;
                    phy.legFactor[c.index] = 1 / Math.max(0.5, Math.abs(n.y));
                    phy.legSlacks[c.index] = slack;
                    const shock = (phy.shockFrames || 0) > 0 ? Math.min(1.35, Math.max(1.05, phy.shock || 1.18)) : 1;
                    // Clamp numerical solver impulse chatter to maximum physical dynamic load
                    const maxPhysicalLegT = grossLoadT * 2.0 * (phy.legFactor[c.index] || 1.0);
                    const physicalT = Math.min(c.tensionT, maxPhysicalLegT);
                    const seen = slack ? 0 : physicalT * shock;
                    phy.legTensions[c.index] = seen;
                    const mbl = legSwl(c.index) * Math.max(1.5, leg.sf || 5);
                    if (!slack && seen > mbl && phy.groundClearance >= 0.05) phy.breakHold[c.index] = (phy.breakHold[c.index] || 0) + 1;
                    else phy.breakHold[c.index] = 0;
                    if (phy.breakHold[c.index] >= 15) {
                        noteCableSnap(c, `Cáp LP${c.index + 1} đứt: sức căng ${seen.toFixed(1)} t vượt MBL ${mbl.toFixed(1)} t (SWL ${legSwl(c.index).toFixed(1)} t × ${leg.sf || 5}, góc ngang ${horiz.toFixed(0)}°, hệ số ${phy.legFactor[c.index].toFixed(2)}).`);
                        phy.legTensions[c.index] = 0;
                        phy.legSlacks[c.index] = true;
                    }
                }
                if (c.role === 'upper' && c.index < 4 && state.gear.uppers[c.index]) {
                    const upper = state.gear.uppers[c.index];
                    if (!phy.upperAngleDeg) phy.upperAngleDeg = [];
                    phy.upperAngleDeg[c.index] = horiz;
                    const shockU = (phy.shockFrames || 0) > 0 ? Math.min(1.35, Math.max(1.05, phy.shock || 1.18)) : 1;
                    const maxPhysicalUpperT = grossLoadT * 2.0 * (1 / Math.max(0.4, Math.abs(n.y)));
                    const physicalUT = Math.min(c.tensionT, maxPhysicalUpperT);
                    const seenU = slack ? 0 : physicalUT * shockU;
                    phy.upperTensions[c.index] = seenU;
                    const mbl = upperSwl(c.index) * Math.max(1.5, upper.sf || 5);
                    if (!slack && !upper.broken && seenU > mbl && phy.groundClearance >= 0.05) phy.upperBreakHold[c.index] += 1;
                    else phy.upperBreakHold[c.index] = 0;
                    if (phy.upperBreakHold[c.index] >= 15) {
                        noteCableSnap(c, `Cáp treo dầm ${c.index + 1} đứt: sức căng ${seenU.toFixed(1)} t vượt MBL ${mbl.toFixed(1)} t.`);
                        phy.upperTensions[c.index] = 0;
                    }
                }
                if (c.role === 'hanger' && state.gear.hangers && state.gear.hangers[c.index]) {
                    const hItem = state.gear.hangers[c.index];
                    const shockH = (phy.shockFrames || 0) > 0 ? Math.min(1.35, Math.max(1.05, phy.shock || 1.18)) : 1;
                    const maxPhysicalHangerT = grossLoadT * 2.0;
                    const physicalHT = Math.min(c.tensionT, maxPhysicalHangerT);
                    const seenH = slack ? 0 : physicalHT * shockH;
                    if (!phy.hangerTensions) phy.hangerTensions = [];
                    phy.hangerTensions[c.index] = seenH;
                    const mbl = (hItem.swlT || 25) * Math.max(1.5, hItem.sf || 5);
                    if (!slack && !hItem.broken && seenH > mbl && phy.groundClearance >= 0.05) {
                        noteCableSnap(c, `Cáp treo tầng dầm ${c.index + 1} đứt: sức căng ${seenH.toFixed(1)} t vượt MBL ${mbl.toFixed(1)} t.`);
                        phy.hangerTensions[c.index] = 0;
                    }
                }
            });
            const taut = [];
            for (let i = 0; i < state.lugs.length; i++) if (!phy.legSlacks[i]) taut.push(phy.legAngleDeg[i]);
            if (taut.length) phy.maxAngleVert = 90 - Math.min.apply(null, taut);
        }

        function publishCableLoads() {
            if (phy.cables && phy.cables.length) {
                publishXpbdLoads();
                return;
            }
            const rig = computeRigPose();
            const weightT = state.weight;
            const rCog = new THREE.Vector3(state.cogX, state.cogY, state.cogZ).applyQuaternion(phy.cargoQuat);
            const com = phy.cargoPos.clone().add(rCog);
            const geos = [];
            for (let i = 0; i < 4; i++) {
                const eye = lugEyeWorld(i);
                const anchor = slingAnchorWorld(i, rig);
                const delta = anchor.clone().sub(eye);
                const dist = delta.length();
                const L0 = legRestLength(i, rig.spec);
                const n = dist > 1e-4 ? delta.multiplyScalar(1 / dist) : new THREE.Vector3(0, 1, 0);
                const horiz = Math.asin(THREE.MathUtils.clamp(n.y, -1, 1)) * 180 / Math.PI;
                phy.legAngleDeg[i] = horiz;
                phy.legFactor[i] = 1 / Math.max(0.5, n.y);
                const broken = !!state.gear.legs[i].broken;
                geos.push({ eye, n, dist, slack: broken || dist < L0 - 0.02, ny: n.y, rx: eye.x - com.x, rz: eye.z - com.z });
            }
            const tautIdx = geos.map((g, i) => (!g.slack ? i : -1)).filter(i => i >= 0);
            const targets = [0, 0, 0, 0];
            if (tautIdx.length) {
                const groundFactor = phy.groundClearance > 0.02
                    ? 1.0
                    : Math.max(0.1, Math.min(1.0, (phy.groundClearance + 0.01) / 0.03));
                const effectiveWeight = weightT * groundFactor;
                const shares = verticalShares(tautIdx.map(i => geos[i]), effectiveWeight);
                const maxAllowedShare = (weightT / Math.max(2, geos.length)) * 1.5;
                tautIdx.forEach((i, k) => {
                    const ny = Math.max(0.5, geos[i].ny);
                    const snatch = Math.max(0, -phy.cargoVel.y) * 0.1 + Math.abs(phy.hookVel.y) * 0.06;
                    const dyn = 1 + Math.min(0.25, snatch);
                    const rawShare = (phy.groundClearance < 0.02) ? Math.min(shares[k], maxAllowedShare) : shares[k];
                    targets[i] = rawShare / ny * dyn;
                    phy.legFactor[i] = (1 / ny) * dyn;
                });
            }
            for (let i = 0; i < 4; i++) {
                const leg = state.gear.legs[i];
                phy.legSlacks[i] = geos[i].slack;
                if (leg.broken) {
                    phy.legTensions[i] = 0;
                    phy.breakHold[i] = 0;
                    continue;
                }
                phy.legTensions[i] = THREE.MathUtils.lerp(phy.legTensions[i] || 0, targets[i], 0.65);
                if (phy.legSlacks[i] && phy.legTensions[i] < 0.05) phy.legTensions[i] = 0;
                const mbl = legSwl(i) * Math.max(1.5, leg.sf || 5);
                if (!phy.legSlacks[i] && targets[i] > mbl && phy.groundClearance >= 0.02) phy.breakHold[i] += 1;
                else phy.breakHold[i] = 0;
                if (phy.breakHold[i] >= 8) {
                    leg.broken = true;
                    phy.legTensions[i] = 0;
                    phy.legSlacks[i] = true;
                    const status = document.getElementById('sim-status-text');
                    if (status) status.textContent = `Cáp LP${i + 1} đứt: sức căng ${targets[i].toFixed(1)} t vượt MBL ${mbl.toFixed(1)} t (SWL ${legSwl(i).toFixed(1)} t × ${leg.sf || 5}, góc ngang ${phy.legAngleDeg[i].toFixed(0)}°, hệ số ${phy.legFactor[i].toFixed(2)}).`;
                }
            }

            const uppers = activeUpperIndexes();
            phy.upperTensions = [0, 0, 0, 0];
            const carried = tautIdx.length ? weightT : Math.max(0.2, phy.gearWeight);
            const upperLegs = [];
            uppers.forEach(i => {
                if (state.gear.uppers[i].broken) return;
                const end = upperAnchorWorld(i, rig);
                const delta = rig.master.clone().sub(end);
                const dist = delta.length();
                const L0 = upperRestLength(i, rig.spec);
                if (dist < L0 - 0.02 || dist < 1e-4) return;
                const n = delta.multiplyScalar(1 / dist);
                upperLegs.push({ i, ny: n.y, rx: end.x - rig.master.x, rz: end.z - rig.master.z });
            });
            if (upperLegs.length) {
                const shares = verticalShares(upperLegs, carried);
                upperLegs.forEach((leg, k) => {
                    const ny = Math.max(0.5, leg.ny);
                    phy.upperTensions[leg.i] = shares[k] / ny;
                });
            }
            uppers.forEach(i => {
                const upper = state.gear.uppers[i];
                const mbl = upperSwl(i) * Math.max(1.5, upper.sf || 5);
                const tension = phy.upperTensions[i] || 0;
                if (!upper.broken && tension > mbl && phy.groundClearance >= 0.02) phy.upperBreakHold[i] += 1;
                else phy.upperBreakHold[i] = 0;
                if (phy.upperBreakHold[i] >= 8) {
                    upper.broken = true;
                    phy.upperTensions[i] = 0;
                    const status = document.getElementById('sim-status-text');
                    if (status) status.textContent = `Cáp treo dầm ${i + 1} đứt: sức căng vượt MBL ${mbl.toFixed(1)} t sau khi nhân hệ số góc.`;
                }
            });
            const tautHoriz = tautIdx.map(i => phy.legAngleDeg[i]);
            if (tautHoriz.length) phy.maxAngleVert = 90 - Math.min(...tautHoriz);
        }

        function inertiaInverseAboutCog(mass, L, W, H, cx, cy, cz) {
            const Ixx = Math.max(10, mass * (W * W + H * H) / 12);
            const Iyy = Math.max(10, mass * (L * L + W * W) / 12);
            const Izz = Math.max(10, mass * (L * L + H * H) / 12);
            return {
                Ixx: 1 / Ixx,
                Iyy: 1 / Iyy,
                Izz: 1 / Izz,
                Ixy: 0,
                Ixz: 0,
                Iyz: 0
            };
        }

        function applyInertiaInverse(invM, v) {
            return new THREE.Vector3(
                invM.Ixx * v.x + invM.Ixy * v.y + invM.Ixz * v.z,
                invM.Ixy * v.x + invM.Iyy * v.y + invM.Iyz * v.z,
                invM.Ixz * v.x + invM.Iyz * v.y + invM.Izz * v.z
            );
        }

        function alphaFromTorque(torqueWorld, quat, invM) {
            const invQ = quat.clone().invert();
            const local = torqueWorld.clone().applyQuaternion(invQ);
            return applyInertiaInverse(invM, local).applyQuaternion(quat);
        }

        function winchSpeedForLoad() {
            const massT = state.weight + (phy.gearWeight || 0);
            const swl = Math.max(5, state.gear && state.gear.hook ? state.gear.hook.swlT : 50);
            // Cargo hoist view-speed (not a winch-reel demo). Cap near mid of old scale.
            const vMax = 0.55;
            let v = vMax * Math.max(0.20, 1 - 0.70 * (massT / swl));
            const takingUp = phy.groundClearance < 0.05 && (phy.cables || []).some(c => c.role === 'leg' && (c.tensionT || 0) > 0.2 && !cableIsBroken(c));
            if (takingUp) v *= 0.40;
            return v * hoistSpeedScaleFactor();
        }

        function hoistSpeedScaleFactor() {
            return THREE.MathUtils.clamp(state.hoistSpeedScale != null ? state.hoistSpeedScale : 1, 0.25, 2.0);
        }

        /**
         * ONE hoist rate for hook and STS spreader (swap mode → same feel).
         * Scale 1× → 0.85 m/s; slider-governed, perfectly symmetrical up & down.
         */
        function cargoHoistRates() {
            const scale = hoistSpeedScaleFactor();
            const v = 0.85 * scale;
            return { up: v, down: v };
        }

        /** Alias — identical to cargoHoistRates (no STS-only boost). */
        function stsSpreaderHoistRates() {
            return cargoHoistRates();
        }

        /** Hold-button hoistSpeed (±). Identical for spreader and hook. */
        function hoistHoldSpeed(direction) {
            const r = cargoHoistRates();
            return direction >= 0 ? r.up : -r.down;
        }

        /** True when the winch / auto target is commanding a raise (not every autoHoist). */
        function isHoistRising() {
            if (phy._trialLiftActive) return true;
            if ((phy.hoistSpeed || 0) > 0.01) return true;
            if (phy.hookVel && phy.hookVel.y > 0.025) return true;
            if (phy.autoHoistActive && phy.hookTarget && phy.hookPos
                && phy.hookTarget.y > phy.hookPos.y + 0.02) return true;
            return false;
        }

        /** True when paying out / auto-lowering toward a lower target (incl. Hạ đất). */
        function isHoistLowering() {
            if (phy._setDownActive) return true;
            if ((phy.hoistSpeed || 0) < -0.01) return true;
            if (phy.hookVel && phy.hookVel.y < -0.025) return true;
            if (phy.autoHoistActive && phy.hookTarget && phy.hookPos
                && phy.hookTarget.y < phy.hookPos.y - 0.02) return true;
            return false;
        }

        if (typeof window !== 'undefined') {
            window.hoistSpeedScaleFactor = hoistSpeedScaleFactor;
            window.cargoHoistRates = cargoHoistRates;
            window.stsSpreaderHoistRates = stsSpreaderHoistRates;
            window.hoistHoldSpeed = hoistHoldSpeed;
            window.isHoistRising = isHoistRising;
            window.isHoistLowering = isHoistLowering;
        }

        // Ensures the 3D Hook Block + J-Hook + Master Link (extending down to y - 0.58m) NEVER penetrates
        // Ensures the 3D Hook Block + J-Hook + Master Link (extending down to y - 0.58m) NEVER penetrates
        // the Cargo outer shell, any Spreader/Lifting Beam body, or the Floor in any mode.
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
            const groundedNow = (phy.groundClearance || 0) < 0.04 && aabbClr < 0.04;
            if (groundedNow && lowering && !rising) {
                if (phy.cargoVel) phy.cargoVel.set(0, 0, 0);
                if (phy.cargoOmega) phy.cargoOmega.set(0, 0, 0);
                if (phy._setDownActive && typeof finishSmoothSetDown === 'function') {
                    // Hạ đất finished — stop this frame. Continuing the winch after
                    // parkHookSlack was snatching the cargo back up a few cm.
                    finishSmoothSetDown();
                    return;
                }
                // Operator Hạ while cargo is already on the quay: keep cargo seated,
                // but fall through so the hook/spreader can still settle onto the roof.
                phy._setDownActive = false;
                state.poseLock = true;
                phy.groundClearance = 0;
                if (typeof applyLockedPose === 'function') applyLockedPose();
                if (typeof syncPoseLockUI === 'function') syncPoseLockUI();
            }
            // One shared cargo-hoist ceiling for hook and STS spreader (up == down).
            if (!dragging) {
                maxWinch = Math.min(maxWinch, rising ? rates.up : rates.down);
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

            if (rising && phy.groundClearance < 0.05) {
                const stsDirectRise = (typeof isStsDirectAttach === 'function') && isStsDirectAttach();
                const aboutToTaut = (phy.cables || []).some(c => {
                    if (cableIsBroken(c)) return false;
                    // Only the lower legs can pick the cargo from the ground.
                    // Upper bridles becoming taut merely raise their own beam;
                    // throttling for those made basket/frame assemblies creep
                    // at 0.28 m/s for the whole empty take-up stroke.
                    if (!(c.role === 'leg' && c.b && c.b.kind === 'cargo')) return false;
                    // Twistlocks are already engaged when seated — don't creep-throttle the whole lift.
                    if (stsDirectRise) return false;
                    return attachWorld(c.a).distanceTo(attachWorld(c.b)) > c.L0 - 0.15;
                });
                // Creep into first snatch — same for hook and spreader (no STS-only rate).
                if (aboutToTaut) {
                    maxWinch = Math.min(maxWinch, rates.up * 0.40);
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
                const hangerM = (state.hangerSlingLength != null) ? state.hangerSlingLength : 2.0;
                const yTop = Math.max(1.0, hangerM);
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
                // STS: headblock sheaves ← short hoist falls;
                // direct = twistlock pins; cable = underside pick points → sling/chain to cargo.
                const stsDirect = (typeof isStsDirectAttach === 'function')
                    ? isStsDirectAttach()
                    : (state.stsAttachMode || 'direct') !== 'cable';
                // Match visual twistlock feet / container holes (same as rebuildSpreaderVisuals)
                const fit = (typeof resolveStsFitToCargo === 'function')
                    ? resolveStsFitToCargo()
                    : ((typeof isoTwistlockSpan === 'function')
                        ? isoTwistlockSpan(state.stsSizeFt || 40)
                        : { spanX: spanBase().spanX, spanZ: spanBase().spanZ });
                const halfX = (fit.halfX != null) ? fit.halfX : ((fit.spanX || 11.985) * 0.5);
                const halfZ = (fit.halfZ != null) ? fit.halfZ : ((fit.spanZ || 2.259) * 0.5);
                const iso = fit.iso || fit;
                const selfKg = userBeamKg != null ? userBeamKg : (
                    estimateMemberStructuralMassKg('spreader_main')
                    + estimateMemberStructuralMassKg('endPlus')
                    + estimateMemberStructuralMassKg('endMinus')
                );
                add('assembly', Math.max(800, selfKg + hwShareKg), Math.max(fit.spanX || iso.spanX || 4, 4), 'frame', new THREE.Vector3(),
                    ['spreader_main', 'endPlus', 'endMinus']);
                phy._stsPinsSnug = false;
                // 4 hoist pockets on top of central yellow frame (RAM-style, not tall headblock)
                const hb = [[0.55, 0.48, 0.32], [-0.55, 0.48, 0.32], [-0.55, 0.48, -0.32], [0.55, 0.48, -0.32]];
                hb.forEach((p, i) => {
                    cables.push({ role: 'upper', index: i, a: endOf('hook'), b: endOf('body', 'assembly', p[0], p[1], p[2]) });
                });
                // Outer ISO corners ONLY — STS mid-beam twin centres have twistlock
                // seats, not cable eyes. Twin+cable therefore leaves the junction
                // unsupported (see stepStsTwinCableFlare / “bửa ra”).
                const corners = [
                    [halfX, halfZ], [-halfX, halfZ], [-halfX, -halfZ], [halfX, -halfZ]
                ];
                // Direct: pin attach at twistlock foot plane (gù đen); cable: shackle eye under end beams
                const pickY = stsDirect ? STS_TWISTLOCK_FOOT_Y : -0.28;
                corners.forEach((c, i) => {
                    cables.push({
                        role: 'leg', index: i,
                        a: endOf('body', 'assembly', c[0], pickY, c[1]),
                        b: endOf('cargo', null, 0, 0, 0, i)
                    });
                });
                return { bodies: bodies, cables: cables, lugs: null };
            }
            if (type === 'spreader' || type === 'lifting_beam') {
                const m = memberSpec('main');
                const yLug = type === 'lifting_beam' ? 0.24 : 0.22;
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
            if (type === 'cascaded' || type === 'modular_truss') {
                const topId = type === 'modular_truss' ? 'truss' : 'top';
                const top = memberSpec(topId);
                const hangerM = (state.hangerSlingLength != null)
                    ? state.hangerSlingLength
                    : ((typeof getRigSpec === 'function' && getRigSpec().hanger) || 2.0);
                const yTop = Math.max(type === 'modular_truss' ? 0.85 : 1.0, hangerM);
                const plus = memberSpec('lowPlus');
                const minus = memberSpec('lowMinus');
                const mTop = estimateMemberStructuralMassKg(topId);
                const mPlus = estimateMemberStructuralMassKg('lowPlus');
                const mMinus = estimateMemberStructuralMassKg('lowMinus');
                const scale = userBeamKg != null ? userBeamKg / Math.max(10, mTop + mPlus + mMinus) : 1.0;
                add(topId, Math.max(45, mTop * scale + hwShareKg * 0.4), top.length, 'x', new THREE.Vector3(0, yTop, 0), [topId]);
                add('lowPlus', Math.max(35, mPlus * scale + hwShareKg * 0.3), plus.length, 'z', new THREE.Vector3(top.a, 0, 0), ['lowPlus']);
                add('lowMinus', Math.max(35, mMinus * scale + hwShareKg * 0.3), minus.length, 'z', new THREE.Vector3(top.b, 0, 0), ['lowMinus']);
                cables.push({ role: 'upper', index: 1, a: endOf('hook'), b: endOf('body', topId, top.a, 0.22, 0) });
                cables.push({ role: 'upper', index: 0, a: endOf('hook'), b: endOf('body', topId, top.b, 0.22, 0) });
                cables.push({ role: 'hanger', index: 0, a: endOf('body', topId, top.a, -0.22, 0), b: endOf('body', 'lowPlus', 0, 0.18, 0) });
                cables.push({ role: 'hanger', index: 1, a: endOf('body', topId, top.b, -0.22, 0), b: endOf('body', 'lowMinus', 0, 0.18, 0) });
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
            const takingUp = isGrounded && (
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

                // --- Free hang (self-weight only): nearly vertical under the hook ---
                // Two bars only need a small X separation so they don't occupy one point.
                // They must NOT be forced out to the cargo end span (that looked like "kênh lên").
                const freeSep = Math.max(barRad * 2.2, 0.14);
                const freeHang = master.clone();
                freeHang.y -= dUpAx;
                freeHang.addScaledVector(sideXZ, freeSep);

                // --- Load geometry: along hook→lug mid, for when lowers take the cargo ---
                const toMid = eMid.clone().sub(master);
                const dist = Math.max(1e-4, toMid.length());
                const u = toMid.clone().multiplyScalar(1 / dist);
                const cLowA = (phy.cables || []).find(c => c.role === 'leg' && c.index === pair.iA);
                const cLowB = (phy.cables || []).find(c => c.role === 'leg' && c.index === pair.iB);
                const L_low = (cLowA && cLowB && cLowA.L0 > 0.25)
                    ? 0.5 * (cLowA.L0 + cLowB.L0)
                    : (spec.lower || 1.5);
                const dLowAx = Math.sqrt(Math.max(0.04, L_low * L_low - halfZ * halfZ));
                const fSeries = THREE.MathUtils.clamp((dUpAx + 0.14) / Math.max(0.5, dUpAx + 0.28 + dLowAx), 0.32, 0.72);
                const maxReach = (legABroken || legBBroken) ? (dUpAx + 0.55) : (dUpAx + 0.14);
                const dBarLoad = Math.min(maxReach, dist * fSeries);
                const loadHang = master.clone().addScaledVector(u, dBarLoad);

                let blend = loadBlend;
                if (cargoAirborne || takingUp || dist >= (dUpAx + dLowAx) * 0.72) {
                    blend = 1.0;
                } else if (isGrounded && loadBlend < 0.35) {
                    const pinApprox = freeHang.clone().addScaledVector(sideXZ, 0);
                    const reachA = pinApprox.distanceTo(lugA);
                    const reachB = pinApprox.distanceTo(lugB);
                    const over = Math.max(0, reachA - L_low, reachB - L_low);
                    if (over > 0.03) {
                        blend = Math.max(blend, THREE.MathUtils.clamp(over / Math.max(0.35, L_low), 0, 0.85));
                    }
                }
                b.x.copy(freeHang).lerp(loadHang, blend);

                // Seat on TRUE cargo roof ONLY when grounded/unloaded; when airborne on intact legs,
                // keep the bar strictly collinear on the master -> eMid tension line!
                const floorY = cargoCeilingUnderBeam(b.x.x, b.x.z, spec, b);
                if (!cargoAirborne || (legABroken && legBBroken)) {
                    if (b.x.y < floorY) b.x.y = floorY;
                    if (blend < 0.25 && freeHang.y <= floorY + 0.05) {
                        b.x.y = floorY;
                    }
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
            if (state.beamType === 'container_spreader' && typeof seatStsSpreaderToCargo === 'function') {
                seatStsSpreaderToCargo();
                return;
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
                // STS direct: twistlock seats in ISO casting face — no pad-eye / shackle stand-off.
                const stsDirect = typeof isStsDirectAttach === 'function' && isStsDirectAttach();
                if (!stsDirect) ring.addScaledVector(n, 0.12);
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
                const hangerM = (state.hangerSlingLength != null)
                    ? state.hangerSlingLength
                    : ((typeof getRigSpec === 'function' && getRigSpec().hanger) || 2.0);
                const yTop = Math.max(type === 'modular_truss' ? 0.85 : 1.0, hangerM);
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
                if (captureDesign && c.role === 'hanger' && held == null && !customLength) {
                    c.designL0 = Math.max(0.15, attachWorld(c.a).distanceTo(attachWorld(c.b)));
                }
                let nominal;
                if (customLength) nominal = item.lengthM;
                else if (held != null) nominal = held;
                else if (c.role === 'upper') nominal = spec.topLeg;
                else if (c.role === 'hanger') {
                    nominal = (state.hangerSlingLength != null)
                        ? state.hangerSlingLength
                        : (spec.hanger || c.designL0 || Math.max(0.3, spec.mast || 2.0));
                }
                else nominal = spec.lower;
                // STS direct twistlock pins are centimetres long — do NOT floor to 0.2 m
                // (that left permanent slack so the spreader rose without picking the box).
                const stsPin = c.role === 'leg'
                    && (typeof isStsDirectAttach === 'function')
                    && isStsDirectAttach();
                const minL0 = stsPin ? 0.04 : 0.2;
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

                // Spreader telescopic size must match cargo length — else gù bay ngoài lỗ góc.
                if (typeof resolveStsFitToCargo === 'function' && !state.stsTwinLift) {
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
                    const L0 = Math.max(0.8, state.lowerSlingLength || 2.0);
                    beamY = roof + 0.28 + L0;
                }

                phy.hookPos.x = phy.cargoPos.x;
                phy.hookPos.z = phy.cargoPos.z;
                phy.hookPos.y = beamY + 0.22;
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
            // STS: seat twistlocks / cable stand-off on the box — do not invent a long bridle float.
            if (state.beamType === 'container_spreader') {
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
            // STS: yellow spreader IS the trolley headblock. Tiny/phantom uppers must not
            // mark it “unsuspended”, or XPBD treats legs as parked and never hauls cargo
            // (cables rubber-band / “giãn” while the load stays on the quay).
            if (state.beamType === 'container_spreader') return true;
            const uppers = (phy.cables || []).filter(c => c.role === 'upper' && !cableIsBroken(c) && c.b && c.b.body === b);
            if (!uppers.length) return true;
            const anyTaut = uppers.some(c => {
                const pa = attachWorld(c.a);
                const pb = attachWorld(c.b);
                const chord = pa.distanceTo(pb);
                return !c.slack && (c._j > 1e-4 || chord >= (c.L0 || 1) - 0.02);
            });
            // Kinematic basket presentation is only "suspended" while uppers actually carry the bar
            if (state.beamType === 'basket' && basketUsesKinematicPose()) return anyTaut;
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
         * STS twin-lift + cable mode: real spreaders have NO cable eyes on the four
         * mid-beam “gù giữa”. Legs only pick the outer ISO corners, so the junction
         * where two 20fts meet is unsupported and the pair pries open (“bửa ra”).
         * Direct twistlock mode keeps the fused couple (centre pins engage castings).
         */
        function stsTwinCableMode() {
            return !!(state.stsTwinLift
                && state.beamType === 'container_spreader'
                && typeof isStsDirectAttach === 'function'
                && !isStsDirectAttach());
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

        /** Target pry angle (rad) from unsupported mid-span — grows with lift-off. */
        function twinCableFlareTargetPitch(clearanceM) {
            const layout = twinTwentyLayout();
            const lever = Math.max(0.8, layout.hx - layout.halfSep); // ~2.9 m outer→CoG
            const rise = Math.max(0, clearanceM || 0);
            // Light lift → small pry; full hoist → strong open (biến thiên theo độ cao).
            const raw = Math.atan2(rise * 1.25, lever);
            return THREE.MathUtils.clamp(raw, 0, 1.05);
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
                            'WARNING: STS twin-lift on cables — no mid pick. Outer corners rise; the junction toes stay on the quay and drag apart.',
                            'CẢNH BÁO: Twin-lift STS bắt cáp — không có điểm kéo giữa. Hai đầu ngoài nhấc lên; góc trong kê đất và lết ra ngoài.'
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
         * STS: yellow spreader tracks the trolley. Height follows at the SAME
         * cargo-hoist rate as the hook — never a fast lerp that snatches the load.
         */
        function enforceStsSpreaderAsHeadblock(frameDt) {
            if (state.beamType !== 'container_spreader') return;
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

            const headY = phy.hookPos.y - 0.18;
            const stsDirect = typeof isStsDirectAttach === 'function' && isStsDirectAttach();
            const rising = (typeof isHoistRising === 'function')
                ? isHoistRising()
                : ((phy.hoistSpeed || 0) > 0.01 || (phy.hookVel && phy.hookVel.y > 0.02));
            if (rising || maxLegOver > 0.02) b.isRestingOnCargo = false;

            const over = anyLeg ? Math.max(0, maxLegOver) : 0;
            const payback = stsDirect
                ? THREE.MathUtils.clamp(over * 0.35, 0, 0.45)
                : THREE.MathUtils.clamp(over * 0.85, 0, 0.90);
            const targetY = headY - payback;
            // Rate-limit to shared hoist speed so spreader never outruns the hook.
            const maxStep = (rising ? rates.up : rates.down) * dt * 1.05;
            const errY = targetY - b.x.y;
            b.x.y += THREE.MathUtils.clamp(errY, -maxStep, maxStep);
            if (b.v) {
                const hv = phy.hookVel ? phy.hookVel.y : 0;
                const capped = THREE.MathUtils.clamp(hv, -rates.down * 1.1, rates.up * 1.1);
                b.v.y = over > 0.05 ? Math.min(capped, 0) : capped;
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

            // Soft haul spreader with headblock falls (no hard Y teleport)
            if (rising && uppers.length) {
                const masterY = phy.hookPos.y + (typeof HOOK_MASTER_OFFSET_Y === 'number' ? HOOK_MASTER_OFFSET_Y : -0.56);
                let meanL0 = 0;
                uppers.forEach(c => { meanL0 += (c.L0 || 2.4); });
                meanL0 /= uppers.length;
                const horiz = Math.max(0.35, Math.hypot(0.55, 0.35));
                const drop = Math.sqrt(Math.max(0.2, meanL0 * meanL0 - horiz * horiz));
                const targetBeamY = masterY - drop;
                if (targetBeamY > b.x.y + 0.008) {
                    b.x.y = THREE.MathUtils.lerp(b.x.y, targetBeamY, 0.28);
                    if (b.v) {
                        const hv = phy.hookVel ? phy.hookVel.y : 0.25;
                        b.v.y = THREE.MathUtils.lerp(b.v.y || 0, Math.max(0.05, hv * 0.9), 0.35);
                    }
                }
            }

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
            const tipPad = 0.34;
            const H = state.H || 2.6;
            const floorY = (typeof supportY === 'function')
                ? supportY(b.x.x, b.x.z) + H * 0.5
                : H * 0.5;
            const lockedY = b.x.y - tipPad - H * 0.5;
            const nextY = Math.max(floorY, lockedY);

            if (nextY > (phy.cargoPos.y || 0) - 0.002 || nextY < (phy.cargoPos.y || 0) + 0.002
                || suspended || rising || lowering || snugGround) {
                phy.cargoPos.x = b.x.x;
                phy.cargoPos.z = b.x.z;
                phy.cargoPos.y = nextY;

                if (phy.cargoVel) {
                    if (b.v) phy.cargoVel.copy(b.v);
                    else if (phy.hookVel) phy.cargoVel.copy(phy.hookVel);
                    else phy.cargoVel.set(0, 0, 0);
                    // Never rebound upward while paying out / Hạ đất
                    if (lowering && phy.cargoVel.y > 0) phy.cargoVel.y = 0;
                }
                if (phy.cargoOmega) phy.cargoOmega.set(0, 0, 0);

                const yaw = stsLockedYawRad();
                softLockYawQuat(phy.cargoQuat, yaw, 0.0, 1.0);
                softLockYawQuat(b.q, yaw, 0.0, 1.0);

                // Keep pin L0 = live span so XPBD cannot stretch a ghost gap open.
                (phy.cables || []).forEach(c => {
                    if (c.role !== 'leg' || cableIsBroken(c)) return;
                    const span = attachWorld(c.a).distanceTo(attachWorld(c.b));
                    c.L0 = Math.max(0.04, Math.min(0.12, span));
                    c.slack = false;
                });

                b.isRestingOnCargo = false;
                phy.groundClearance = Math.max(0, phy.cargoPos.y - floorY);
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
                b.visualRadius = Math.max(Math.abs(bounds.min.y), Math.abs(bounds.max.y), Math.abs(bounds.min.z), Math.abs(bounds.max.z)) + 0.008;
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
            hooks.forEach(hk => {
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

            for (let step = 0; step < substeps; step++) {
                advanceHook(dt);

                const rCog = new THREE.Vector3(slideCogX, cogY, slideCogZ).applyQuaternion(phy.cargoQuat);
                const com = phy.cargoPos.clone().add(rCog);
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

                if (basketUsesKinematicPose()) {
                    alignBasketBars();
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
                        const pA = attachWorld(c.a);
                        const pB = attachWorld(c.b);
                        const delta = pB.clone().sub(pA);
                        const dist = delta.length();
                        if (!(dist > 1e-4)) return;
                        const n = delta.multiplyScalar(1 / dist);
                        c.n = n.clone().negate();
                        if (basketUsesKinematicPose() && c.role === 'upper') {
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
                        const stsLegHaul = c.role === 'leg'
                            && state.beamType === 'container_spreader'
                            && rawStretch > 0.05;
                        const stretch = Math.min(
                            rawStretch,
                            stsLegHaul ? Math.min(0.045, 0.018 + rawStretch * 0.20) : 0.035
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
                            && (c.a.body.isRestingOnCargo || !beamIsSuspended(c.a.body));
                        kickEnd(c.a, n, j, invMass, invI, vCom, omega);
                        if (!isLegUnderRestingBeam) {
                            kickEnd(c.b, n, -j, invMass, invI, vCom, omega);
                        }
                        // 2) Split position projection removes geometric drift without injecting upward bounce velocity
                        if (stretch > 1e-5) {
                            const hoistStopped = !phy.autoHoistActive && Math.abs(phy.hoistSpeed || 0) < 0.01 && (!phy.hookVel || phy.hookVel.y <= 0.01);
                            const stsSoft = stsLegHaul || (c.role === 'leg' && state.beamType === 'container_spreader');
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

                // Gravity gate: cargo must not rise while lower legs are still slack.
                const stsCable = state.beamType === 'container_spreader'
                    && !(typeof isStsDirectAttach === 'function' && isStsDirectAttach());
                const legsTautGeo = stsCable ? stsLegsGeometricallyTaut(0.025) : anyTautLeg;
                if (stsCable && !legsTautGeo) {
                    if (vCom.y > 0) vCom.y = 0;
                    if (minGap < 0.08) {
                        omega.multiplyScalar(Math.exp(-dt * 5));
                    }
                }

                // STS cable: follow hoist gently — hard glue to hookVel caused “giật lên”.
                if (stsCable && legsTautGeo) {
                    const hv = phy.hookVel ? phy.hookVel.y : 0;
                    const ratesNow = cargoHoistRates();
                    if (lowering) {
                        // Pay-out: settle under gravity, zero rebound (Hạ không nảy).
                        if (vCom.y > 0) vCom.y = 0;
                        if (vCom.y < -ratesNow.down * 1.35) vCom.y = -ratesNow.down * 1.35;
                        omega.multiplyScalar(Math.exp(-dt * 3.5));
                    } else {
                        const rel = vCom.y - hv;
                        vCom.y = hv + rel * Math.exp(-dt * 3.5);
                        const capUp = Math.min(ratesNow.up * 1.05, Math.max(0.02, hv + 0.04));
                        if (vCom.y > capUp) vCom.y = capUp;
                        omega.multiplyScalar(Math.exp(-dt * 2.0));
                    }
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
                    if (minGap < 0.008 && (!phy.hookVel || phy.hookVel.y <= 0.01)) {
                        omega.multiplyScalar(Math.exp(-dt * 15.0));
                        vCom.multiplyScalar(Math.exp(-dt * 15.0));
                    }
                } else if (freeFallCut && vCom.y > 0) {
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
            if (stsDirectNow) enforceStsDirectTwistlockCouple(frameDt);
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
            if (!stsBusy && (state.beamType !== 'basket' || (phy.groundClearance || 0) <= 0.05)) {
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

            // === RIGGING CONSTRAINT SOLVER (nangcap1) ===
            const rigSolver = (typeof window !== 'undefined' && window.RIG && window.RIG.RiggingPhysicsSolver)
                ? window.RIG.RiggingPhysicsSolver
                : ((typeof RIG !== 'undefined' && RIG.RiggingPhysicsSolver) ? RIG.RiggingPhysicsSolver : null);
            if (rigSolver && state.rigSolver && state.rigSolver.enabled) {
                try {
                    rigSolver.evaluate(phy, state, {
                        legSwl,
                        attachWorld,
                        cableIsBroken,
                        breakCable: (cable, frac) => {
                            if (typeof initCableBreak === 'function') initCableBreak(cable, frac || 0.5);
                        }
                    });
                } catch (e) {
                    // Non-fatal evaluation guard
                }
            }
            // === END RIGGING CONSTRAINT SOLVER ===
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
                const I_beam = 1.0e-4; // m^4 (HEB / tubular spreader section)
                const J_beam = 5.0e-5; // m^4
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

                    // Telemetry only — vertex-warping the beam group tears Modulift
                    // end fittings / lattice chords off the tube (visible air gaps).
                    if (topBeam.group && typeof beamStruct.applyMeshDeformation === 'function') {
                        beamStruct.applyMeshDeformation(
                            topBeam.group, 0, 0, 0, 1.0,
                            topBeam.axis === 'z' ? 'z' : 'x'
                        );
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
                // Suspended cargo weight causes central longitudinal sag (telemetry only).
                // Do NOT vertex-warp the cargo mesh: OOG crates, pad-eyes and straps are
                // separate parts — continuum bending tore the assembly into floating scraps.
                const F_cargoN = totalCargoWeightN;
                const cogEccentricityM = Math.hypot(state.cogZ || 0, (state.cogX || 0) * 0.5);
                targetTorqueNm = totalCargoWeightN * cogEccentricityM;

                if (StructClass) {
                    const cargoStruct = new StructClass(cargoL, I_cargo, J_cargo, 200, 79.3);
                    const cargoState = cargoStruct.computeDeformationState(F_cargoN, 0, targetTorqueNm);
                    targetCargoDeflectionMm = cargoState.maxBendingDeflectionMm;
                    targetCargoTwistDeg = cargoState.maxTorsionalTwistDeg;
                }
            }
            // Always restore any previously warped cargo vertices to the rigid assembly pose.
            if (StructClass && typeof cargoRootGroup !== 'undefined' && cargoRootGroup) {
                const cargoStruct = new StructClass(cargoL, I_cargo, J_cargo, 200, 79.3);
                cargoStruct.applyMeshDeformation(cargoRootGroup, 0, 0, 0, 1.0, 'x');
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
                const seated = (phy.groundClearance || 0) < 0.035 && aabbClr < 0.04;
                if (seated) {
                    if (typeof finishSmoothSetDown === 'function') finishSmoothSetDown();
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
                        const ratio = Math.max(0.18, clr / 0.35);
                        vDown = baseDown * Math.pow(ratio, 0.65);
                    }
                    phy.hoistSpeed = vDown;
                }
            }

            if (phy.hoistSpeed !== 0) {
                phy.autoHoistActive = false;
                const grossLoadT = phy.massBreakdown ? phy.massBreakdown.grossCraneLoadT : (state.weight + phy.gearWeight);
                const totalMassKg = Math.max(100, grossLoadT * 1000);
                const loadRatio = Math.min(0.92, (totalMassKg * 9.81) / 650000); // 65T winch capacity
                const speedMult = Math.max(0.15, 1.0 - loadRatio);
                const actualSpeed = phy.hoistSpeed * speedMult;
                phy.hookTarget.y = THREE.MathUtils.clamp(
                    phy.hookTarget.y + actualSpeed * frameDt,
                    0.8,
                    35.0
                );
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
                resetFlatRackPayloadState();
                applyLockedPose();
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
                stepCornerYield(frameDt);
                // Nhớm cáp: keep light pretension + non-slack flags so ropes DRAW taut
                // while cargo stays on the quay. Blanking tensions forced a gravity belly.
                if (phy._nhomFreezeSpreader) {
                    phy.legTensions = phy.legTensions || [0, 0, 0, 0, 0, 0, 0, 0];
                    phy.upperTensions = phy.upperTensions || [0, 0, 0, 0];
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
                    phy.upperTensions = [0, 0, 0, 0];
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
            // After set-down, STS direct must re-seat twistlocks flush on the roof.
            if (state.beamType === 'container_spreader' && typeof seatStsSpreaderToCargo === 'function') {
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
                // Slings resting loose or slack on the quay do not transmit tension;
                // only evaluate sling angle once the line is taut under load.
                const isTaut = (c.tensionT || 0) > 0.04 || dist >= (c.L0 || 1) - 0.06;
                if (!isTaut) return;
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
