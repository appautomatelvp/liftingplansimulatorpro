/**
 * physics/cables_break — anchors, XPBD loads, snap stubs
 * Split from legacy god-file (strangler Phase 2). Shared scope via assemble.
 */
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
                const { spanX, spanZ } = getLPBoundingSpan();
                const yOff = state.liftingBeamBottomMode === 'direct' ? STS_TWISTLOCK_FOOT_Y : -0.22;
                return new THREE.Vector3(posX ? spanX * 0.5 : -spanX * 0.5, yOff, posZ ? spanZ * 0.5 : -spanZ * 0.5);
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
            // holdCableLength must NOT imply explicit length — Nhớm stores the live
            // pin-to-pin in heldCableL0; lengthM is only authoritative when userSet.
            if (item.userSet || state.slingUserSet) return true;
            const factoryPlaceholder = role === 'upper' ? 8.0 : 2.0;
            return Math.abs(item.lengthM - factoryPlaceholder) > 0.005;
        }

        /**
         * Cascaded / truss (2-4-4): each main-beam end drops TWO hangers to the
         * TWO ends of its sub-beam (V), not a single centre drop.
         * hangerSlingLength = pin-to-pin along each V leg; stack height is the
         * vertical component + shackle eye clearance (~0.40 m).
         */
        function cascadedSubBeamHalfSpan() {
            try {
                if (typeof memberSpec === 'function') {
                    const plus = memberSpec('lowPlus');
                    if (plus) return Math.max(0.35, Math.abs(plus.a - plus.b) * 0.5);
                }
            } catch (_) { /* member catalog may not be ready during early boot */ }
            return Math.max(0.50, (state.W || 2.438) * 0.45);
        }
        function cascadedTopOffsetY(hangerLenM) {
            const hangerM = (hangerLenM != null)
                ? hangerLenM
                : ((state.hangerSlingLength != null)
                    ? state.hangerSlingLength
                    : ((typeof getRigSpec === 'function' && getRigSpec().hanger) || 2.0));
            const halfZ = cascadedSubBeamHalfSpan();
            const pinClear = 0.40;
            const vert = Math.sqrt(Math.max(0.36, Number(hangerM) * Number(hangerM) - halfZ * halfZ));
            const minY = (state.beamType === 'modular_truss') ? 1.25 : 1.40;
            return Math.max(minY, vert + pinClear);
        }
        if (typeof window !== 'undefined') {
            window.cascadedTopOffsetY = cascadedTopOffsetY;
            window.cascadedSubBeamHalfSpan = cascadedSubBeamHalfSpan;
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

        /** Round up to an even positive integer (tonnes / mm) for readable field ratings. */
        function evenTon(x, lo = 2) {
            const n = Math.ceil(Math.max(lo, Number(x) || lo) / 2) * 2;
            return n;
        }
        function evenMm(x, lo = 8) {
            return evenTon(x, lo);
        }

        /** Design SF: wire/chain/grommet = 5, synthetic web/round = 7 (ASME B30.9). */
        function slingSafetyFactor(type) {
            const t = type || 'wire';
            return (t === 'web' || t === 'round_sling') ? 7 : 5;
        }

        /**
         * Auto-size WLL / diameter / beam / shackle / hook from cargo weight.
         * Sizes for worst pull in the 40–55° working band (β = 40° → highest tension).
         * WLL marked capacity; MBL = WLL × SF; SWL = WLL × hitch derating in the solver.
         * Ratings are even integers and slightly oversized (~25% margin).
         */
        function autoSizeGearForLoad(weightT = state.weight, opts = {}) {
            const W = Math.max(2, Number(weightT) || 22);
            const margin = opts.margin != null ? opts.margin : 1.25;
            const betaWorstDeg = opts.betaWorstDeg != null ? opts.betaWorstDeg : 40;
            const hitchRaw = (typeof RIG !== 'undefined' && RIG.getHitchFactor)
                ? RIG.getHitchFactor(state)
                : ((typeof getHitchFactor === 'function') ? getHitchFactor(state) : 1.0);
            const hitch = Math.max(0.5, Number(hitchRaw) || 1.0);
            const nUpper = Math.max(1, (typeof activeUpperIndexes === 'function' ? activeUpperIndexes().length : 2) || 2);
            const nLegs = Math.max(1, (state.lugs && state.lugs.length) || 4);
            const sinB = Math.max(0.20, Math.sin(betaWorstDeg * Math.PI / 180));

            // Upper bridle: each fall carries W/nUpper with vertical component sin(β)
            const Tupper = (W / nUpper) / sinB;
            // Legs under spreader ≈ vertical; direct bridle uses same angle factor
            const Tleg = (state.beamType === 'none')
                ? (W / nLegs) / sinB
                : (W / nLegs);

            const minDefaultSwl = opts.allowSmallSwl ? 2 : 12;
            const wllLegRaw = evenTon((Tleg * margin) / hitch, 2);
            const wllUpperRaw = evenTon((Tupper * margin) / hitch, 2);
            const wllLeg = Math.max(minDefaultSwl, wllLegRaw);
            const wllUpper = Math.max(minDefaultSwl, wllUpperRaw);
            // Cascaded 2-4-4 hangers: 4 V-legs; each ~W/4 with cos from half-span
            const nHanger = (state.beamType === 'cascaded' || state.beamType === 'modular_truss') ? 4
                : ((state.beamType === 'inline4' || state.beamType === 'inline8' || state.beamType === 'spatial8') ? 2 : 2);
            const halfZH = (typeof cascadedSubBeamHalfSpan === 'function') ? cascadedSubBeamHalfSpan() : 1.0;
            const hangerLM = Math.max(halfZH + 0.5, state.hangerSlingLength || 2);
            const cosHanger = Math.max(0.30, Math.sqrt(Math.max(0.05, 1 - Math.pow(halfZH / hangerLM, 2))));
            const Thanger = (W / Math.max(1, nHanger)) / cosHanger;
            const wllHangerRaw = evenTon((Thanger * margin) / hitch, 2);
            const wllHanger = Math.max(minDefaultSwl, wllHangerRaw);
            const wllBeam = evenTon(W * margin, 4);
            const wllShackle = evenTon(Math.max(wllLeg, wllUpper, wllHanger), 4);
            const wllHook = evenTon(W * margin * 1.25, 8);

            const globalType = state.slingType || 'wire';
            const getSpec = (typeof CAE !== 'undefined' && CAE.getSlingPhysicalSpec)
                || (typeof window !== 'undefined' && window.CAE && window.CAE.getSlingPhysicalSpec);

            const paint = (rec, wllT, sizeRefWllT, fallbackType) => {
                if (!rec) return;
                const type = (typeof effectiveSlingType === 'function')
                    ? (effectiveSlingType(rec) || fallbackType || globalType)
                    : (rec.slingType || fallbackType || globalType);
                const sf = slingSafetyFactor(type);
                rec.swlT = wllT;
                rec.sf = sf;
                rec.mblT = evenTon(wllT * sf, wllT * sf);
                if (getSpec) {
                    const spec = getSpec(type, sizeRefWllT, null, rec.grade || '');
                    if (spec && spec.diaMm) rec.diaMm = evenMm(spec.diaMm, type === 'web' ? 30 : 8);
                }
            };

            if (state.gear) {
                (state.gear.legs || []).forEach(l => paint(l, wllLeg, wllLegRaw, globalType));
                (state.gear.uppers || []).forEach(u => paint(u, wllUpper, wllUpperRaw, globalType));
                (state.gear.hangers || []).forEach(h => paint(h, wllHanger, wllHangerRaw, globalType));
                if (state.gear.beam) {
                    state.gear.beam.swlT = wllBeam;
                    state.gear.beam.sf = state.gear.beam.sf || 4;
                    state.gear.beam.mblT = evenTon(wllBeam * (state.gear.beam.sf || 4));
                }
                (state.gear.shackles || []).forEach(s => {
                    if (!s) return;
                    s.swlT = wllShackle;
                    s.sf = 6;
                    s.mblT = evenTon(wllShackle * 6);
                });
                if (state.gear.hook) {
                    state.gear.hook.swlT = wllHook;
                    state.gear.hook.sf = state.gear.hook.sf || 4;
                    state.gear.hook.mblT = evenTon(wllHook * (state.gear.hook.sf || 4));
                }
            }

            state.wllPerLeg = wllLeg;
            const sampleDia = (state.gear && state.gear.legs && state.gear.legs[0] && state.gear.legs[0].diaMm)
                || (state.gear && state.gear.uppers && state.gear.uppers[0] && state.gear.uppers[0].diaMm);
            if (sampleDia) state.slingDiaMm = sampleDia;

            // Keep WLL UI widgets in sync when present
            const inpWll = document.getElementById('inp-wll');
            const numWll = document.getElementById('num-wll');
            const vWll = document.getElementById('v-wll');
            if (inpWll) inpWll.value = wllLeg;
            if (numWll) numWll.value = wllLeg;
            if (vWll) vWll.textContent = String(wllLeg);

            return {
                weightT: W, betaWorstDeg, hitch, margin,
                Tupper, Tleg, wllLeg, wllUpper, wllBeam, wllShackle, wllHook
            };
        }
        if (typeof window !== 'undefined') {
            window.autoSizeGearForLoad = autoSizeGearForLoad;
            window.evenTon = evenTon;
            window.evenMm = evenMm;
            window.slingSafetyFactor = slingSafetyFactor;
        }

        /**
         * Prevent instant Zone-3 snaps when the winch rises after Nhớm: pin span can
         * jump several centimetres before beam/cargo XPBD catches up. Soft-pay L0
         * only when overstretch exceeds `trigger` (never shorten), and always leave
         * `keepStretch` of elastic preload so releasing the winch does not catapult.
         * Continuous L0=span+margin zeroed tension and caused bounce on hoist release.
         */
        function relieveCableOverstretch(opts = {}) {
            if (typeof attachWorld !== 'function' || !phy.cables) return;
            // Legacy callers pass `margin` as a payout pad; treat small margins as
            // residual stretch to keep, not as extra slack beyond the pin span.
            const keepStretch = opts.keepStretch != null
                ? opts.keepStretch
                : Math.min(0.02, Math.max(0.008, opts.margin != null ? opts.margin : 0.012));
            const trigger = opts.trigger != null ? opts.trigger : 0.035;
            (phy.cables || []).forEach(c => {
                if (!c || (typeof cableIsBroken === 'function' && cableIsBroken(c))) return;
                const span = attachWorld(c.a).distanceTo(attachWorld(c.b));
                if (!(span > 0.05)) return;
                const L0 = c.L0 || 0;
                if (span - L0 <= trigger) return;
                const need = Math.max(L0, span - keepStretch);
                if (need <= L0 + 1e-4) return;
                c.L0 = need;
                c.designL0 = need;
                c.slack = false;
                if (state.heldCableL0) {
                    if (!state.heldCableL0[c.role]) state.heldCableL0[c.role] = [];
                    state.heldCableL0[c.role][c.index] = need;
                }
                const rec = (typeof gearCableRecord === 'function') ? gearCableRecord(c) : null;
                if (rec && (rec.userSet || state.holdCableLength)) {
                    rec.lengthM = need;
                }
            });
        }
        if (typeof window !== 'undefined') window.relieveCableOverstretch = relieveCableOverstretch;

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
                const yTop = (typeof cascadedTopOffsetY === 'function')
                    ? cascadedTopOffsetY()
                    : Math.max(beamType === 'modular_truss' ? 1.25 : 1.40, (state.hangerSlingLength || 2) + 0.40);
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

        function estimateCableSnapRecoil(cable, tensionT, massKg) {
            const rec = gearCableRecord(cable);
            const type = effectiveSlingType(rec);
            const diameterM = Math.max(0.008, ((rec && rec.diaMm) || (type === 'web' || type === 'round_sling' ? 60 : 20)) / 1000);
            const circularArea = Math.PI * diameterM * diameterM / 4;
            const youngsModulusPa = type === 'web' || type === 'round_sling' ? 5e9 : type === 'chain' ? 200e9 : 100e9;
            // Effective load-bearing area accounts for the voids between wire-rope strands,
            // chain links, and the thin textile section of a web sling.
            const effectiveArea = type === 'web' || type === 'round_sling'
                ? Math.max(1e-6, diameterM * diameterM * 0.04)
                : circularArea * (type === 'chain' ? 0.72 : 0.22);
            const forceN = Math.max(0, tensionT) * 1000 * G_EARTH;
            const extensionM = forceN * Math.max(0.35, cable.L0 || 2) / (youngsModulusPa * effectiveArea);
            const elasticEnergyJ = 0.5 * forceN * extensionM;
            const recoilSpeedMps = Math.sqrt((2 * elasticEnergyJ) / Math.max(0.4, massKg));
            return {
                elasticEnergyJ,
                recoilSpeedMps: THREE.MathUtils.clamp(recoilSpeedMps, 0, 28)
            };
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
            const snapEnergy = estimateCableSnapRecoil(cable, seenT, massKg);

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
                const whip = snapEnergy.recoilSpeedMps;
                velU = vMid.clone()
                    .addScaledVector(along, -whip)
                    .add(new THREE.Vector3(jitter(), -0.8 - simRandom() * 0.6, jitter()));
                velL = vMid.clone()
                    .addScaledVector(along, whip)
                    .add(new THREE.Vector3(jitter(), -1.0 - simRandom() * 0.7, jitter()));
                const velCap = 30;
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
                snapElasticEnergyJ: wasTaut ? snapEnergy.elasticEnergyJ : 0,
                recoilSpeedMps: wasTaut ? snapEnergy.recoilSpeedMps : 0,
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
            if (previous && typeof RIG !== 'undefined' && RIG.applyBrokenTipCCD) {
                const ccd = RIG.applyBrokenTipCCD(tip, vel, previous, radius, phy.cargoPos, phy.cargoQuat, state, supportY(tip.x, tip.z));
                if (ccd.collided) { touching = true; normal = ccd.normal; }
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

        /**
         * Red force-flow FX: when a sling goes slack → taut under hoist, a glowing
         * tube + traveling beads run from the pull end down the load path.
         */
        function ensureForceFlowGroup() {
            if (!phy.forceFlowGroup) {
                phy.forceFlowGroup = new THREE.Group();
                phy.forceFlowGroup.name = 'CableForceFlowFX';
                scene.add(phy.forceFlowGroup);
            }
            if (!phy.forceFlows) phy.forceFlows = [];
            return phy.forceFlowGroup;
        }

        function cableForcePathPoints(cable) {
            if (!cable) return null;
            let pts = null;
            const pool = (typeof sling3DPool !== 'undefined') ? sling3DPool : [];
            const sling = pool.find(s => s && s.drawMeta
                && s.drawMeta.role === cable.role
                && s.drawMeta.index === cable.index
                && s.pathPoints && s.pathPoints.length >= 2
                && s.group && s.group.visible);
            if (sling) {
                pts = sling.pathPoints.map(p => p.clone());
            } else if (typeof attachWorld === 'function' && cable.a && cable.b) {
                pts = [attachWorld(cable.a).clone(), attachWorld(cable.b).clone()];
            }
            if (!pts || pts.length < 2) return null;
            // Flow along the load path toward the cargo / downhill from the pull.
            const towardCargo = !!(cable.b && cable.b.kind === 'cargo');
            const fromHook = !!(cable.a && cable.a.kind === 'hook');
            if (!towardCargo && !fromHook && pts[0].y < pts[pts.length - 1].y) {
                pts.reverse();
            }
            return pts;
        }

        function spawnCableForceFlow(cable) {
            if (!cable || (typeof cableIsBroken === 'function' && cableIsBroken(cable))) return;
            // STS headblock falls stay visually quiet — no red FX on the 8 verticals.
            if (cable.role === 'upper' && state.beamType === 'container_spreader') return;
            const pts = cableForcePathPoints(cable);
            if (!pts || pts.length < 2) return;
            const group = ensureForceFlowGroup();
            const key = `${cable.role || 'leg'}|${cable.index || 0}`;
            const recent = (phy.forceFlows || []).filter(f => f.key === key && f.age < 0.55).length;
            if (recent >= 2) return;

            const curvePts = pts.length >= 3 ? pts : [
                pts[0],
                pts[0].clone().lerp(pts[pts.length - 1], 0.5),
                pts[pts.length - 1]
            ];
            const curve = new THREE.CatmullRomCurve3(curvePts);
            const segs = Math.max(12, Math.min(40, curvePts.length * 6));
            const radius = 0.016 + Math.min(0.028, (cable.tensionT || 0.1) * 0.004);
            const tube = new THREE.Mesh(
                new THREE.TubeGeometry(curve, segs, radius, 5, false),
                new THREE.MeshBasicMaterial({
                    color: 0xef4444,
                    transparent: true,
                    opacity: 0.72,
                    depthTest: false,
                    depthWrite: false
                })
            );
            tube.renderOrder = 1001;

            const beads = new THREE.Group();
            const beadGeo = new THREE.SphereGeometry(0.038, 8, 8);
            const nBeads = 6;
            for (let i = 0; i < nBeads; i++) {
                const mat = new THREE.MeshBasicMaterial({
                    color: i % 2 ? 0xff1a1a : 0xf97316,
                    transparent: true,
                    opacity: 1,
                    depthTest: false,
                    depthWrite: false
                });
                const b = new THREE.Mesh(beadGeo, mat);
                b.userData.s = -i * 0.11;
                b.renderOrder = 1002;
                beads.add(b);
            }

            const root = new THREE.Group();
            root.add(tube);
            root.add(beads);
            group.add(root);

            phy.forceFlows.push({
                key,
                role: cable.role,
                index: cable.index,
                root,
                tube,
                beads,
                curve,
                age: 0,
                life: 1.45,
                speed: 1.65
            });
        }

        function updateCableForceFlows(dt) {
            if (!phy.forceFlows || !phy.forceFlows.length) return;
            const group = ensureForceFlowGroup();
            const step = Math.max(1e-4, dt || 0.016);
            for (let i = phy.forceFlows.length - 1; i >= 0; i--) {
                const f = phy.forceFlows[i];
                f.age += step;
                const u = f.age / Math.max(0.2, f.life);
                if (u >= 1) {
                    group.remove(f.root);
                    f.root.traverse(o => {
                        if (o.geometry) o.geometry.dispose();
                        if (o.material) {
                            if (Array.isArray(o.material)) o.material.forEach(m => m.dispose && m.dispose());
                            else if (o.material.dispose) o.material.dispose();
                        }
                    });
                    phy.forceFlows.splice(i, 1);
                    continue;
                }
                // Refresh path periodically so the red line sticks to a moving cable
                f._pathTick = (f._pathTick || 0) + 1;
                if (f.age < 1.0 && (f._pathTick % 4 === 0) && typeof attachWorld === 'function') {
                    const live = (phy.cables || []).find(c => c && c.role === f.role && c.index === f.index);
                    const pts = live ? cableForcePathPoints(live) : null;
                    if (pts && pts.length >= 2) {
                        const curvePts = pts.length >= 3 ? pts : [
                            pts[0],
                            pts[0].clone().lerp(pts[pts.length - 1], 0.5),
                            pts[pts.length - 1]
                        ];
                        f.curve = new THREE.CatmullRomCurve3(curvePts);
                        if (f.tube) {
                            if (f.tube.geometry) f.tube.geometry.dispose();
                            const segs = Math.max(12, Math.min(40, curvePts.length * 6));
                            f.tube.geometry = new THREE.TubeGeometry(f.curve, segs, 0.02, 5, false);
                        }
                    }
                }
                const fade = u < 0.12 ? (u / 0.12) : Math.max(0, 1 - (u - 0.12) / 0.88);
                if (f.tube && f.tube.material) {
                    f.tube.material.opacity = 0.2 + 0.55 * fade;
                }
                f.beads.children.forEach(b => {
                    b.userData.s += f.speed * step;
                    const t = THREE.MathUtils.clamp(b.userData.s, 0, 1);
                    if (f.curve) b.position.copy(f.curve.getPointAt(t));
                    if (b.material) {
                        b.material.opacity = (b.userData.s < 0 || b.userData.s > 1) ? 0 : fade;
                    }
                    const pulse = 0.8 + 0.4 * Math.abs(Math.sin((b.userData.s + f.age) * 16));
                    b.scale.setScalar(pulse);
                });
            }
        }

        function syncCableForceFlowTriggers() {
            (phy.cables || []).forEach(c => {
                if (!c || (typeof cableIsBroken === 'function' && cableIsBroken(c))) {
                    c._forceFlowWasSlack = true;
                    return;
                }
                const taut = !c.slack && (c.tensionT || 0) > 0.055;
                // First sample: arm the edge detector without firing (avoid FX on scene load)
                if (c._forceFlowWasSlack === undefined) {
                    c._forceFlowWasSlack = !taut;
                    return;
                }
                if (taut && c._forceFlowWasSlack) {
                    spawnCableForceFlow(c);
                    // Brief red flash on the sling body (same channel as cut-hover)
                    c._isFlashing = true;
                    c._flashStartTime = performance.now();
                    c._forceFlowFlash = true;
                    c._cutHoverFlash = true;
                }
                c._forceFlowWasSlack = !taut;
            });
        }
        if (typeof window !== 'undefined') {
            window.updateCableForceFlows = updateCableForceFlows;
            window.spawnCableForceFlow = spawnCableForceFlow;
            window.syncCableForceFlowTriggers = syncCableForceFlowTriggers;
        }

        function publishXpbdLoads() {
            for (let i = 0; i < 8; i++) {
                phy.legTensions[i] = 0;
                phy.legSlacks[i] = true;
                phy.legForceN[i] = 0;
                if (i < 8) phy.upperTensions[i] = 0;
            }
            // During take-up, never allow L0 < live span (prevents false Zone-3 snaps)
            if ((phy.hoistSpeed || 0) > 0.01 || phy.autoHoistActive || phy._trialLiftActive) {
                relieveCableOverstretch({ rising: true, margin: 0.01 });
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
                    // Hitch-derated SWL (Phase 1) — Zone 2 overload does NOT snap
                    const hitchF = (typeof RIG !== 'undefined' && RIG.getHitchFactor)
                        ? RIG.getHitchFactor(state)
                        : 1.0;
                    const swlEff = legSwl(c.index) * hitchF;
                    const mbl = swlEff * Math.max(1.5, leg.sf || 5);
                    c._alarmZone = (!slack && seen > swlEff)
                        ? (seen >= mbl ? 3 : 2)
                        : 1;
                    c._elasticStretchVisual = (c._alarmZone === 2)
                        ? Math.min(1, (seen - swlEff) / Math.max(1e-3, mbl - swlEff))
                        : 0;
                    // Zone 3 only (T ≥ MBL). STS cable first-pick suppresses snaps —
                    // take-up impulse spikes were cutting healthy legs mid-hoist.
                    const stsCableTakeUp = state.beamType === 'container_spreader'
                        && (state.stsAttachMode || 'direct') === 'cable'
                        && ((phy.groundClearance || 0) < 0.50 || !!phy._stsCableTakeUp);
                    const liftClear = (phy.groundClearance || 0) >= 0.12;
                    if (stsCableTakeUp) {
                        phy.breakHold[c.index] = 0;
                    } else if (!slack && seen >= mbl && liftClear) {
                        phy.breakHold[c.index] = (phy.breakHold[c.index] || 0) + 1;
                    } else {
                        phy.breakHold[c.index] = 0;
                    }
                    if (phy.breakHold[c.index] >= 36) {
                        phy.shock = Math.max(phy.shock || 1, 2.0);
                        noteCableSnap(c, `Cáp LP${c.index + 1} đứt Zone-3: T=${seen.toFixed(1)} t ≥ MBL ${mbl.toFixed(1)} t (SWL_eff ${swlEff.toFixed(1)} t × SF ${leg.sf || 5}, α≈${horiz.toFixed(0)}°). Cascade shock ≥2.`);
                        phy.legTensions[c.index] = 0;
                        phy.legSlacks[c.index] = true;
                    }
                }
                if (c.role === 'upper' && c.index < 8 && state.gear.uppers[c.index]) {
                    const upper = state.gear.uppers[c.index];
                    if (!phy.upperAngleDeg) phy.upperAngleDeg = [];
                    phy.upperAngleDeg[c.index] = horiz;
                    const shockU = (phy.shockFrames || 0) > 0 ? Math.min(1.35, Math.max(1.05, phy.shock || 1.18)) : 1;
                    const maxPhysicalUpperT = grossLoadT * 2.0 * (1 / Math.max(0.4, Math.abs(n.y)));
                    const physicalUT = Math.min(c.tensionT, maxPhysicalUpperT);
                    const seenU = slack ? 0 : physicalUT * shockU;
                    phy.upperTensions[c.index] = seenU;
                    const mbl = upperSwl(c.index) * Math.max(1.5, upper.sf || 5);
                    const liftClearU = (phy.groundClearance || 0) >= 0.12;
                    if (!slack && !upper.broken && seenU > mbl && liftClearU) phy.upperBreakHold[c.index] += 1;
                    else phy.upperBreakHold[c.index] = 0;
                    if (phy.upperBreakHold[c.index] >= 36) {
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
                    if (!phy.hangerBreakHold) phy.hangerBreakHold = [];
                    const mbl = (hItem.swlT || 25) * Math.max(1.5, hItem.sf || 5);
                    const liftClearH = (phy.groundClearance || 0) >= 0.12;
                    if (!slack && !hItem.broken && seenH > mbl && liftClearH) {
                        phy.hangerBreakHold[c.index] = (phy.hangerBreakHold[c.index] || 0) + 1;
                    } else {
                        phy.hangerBreakHold[c.index] = 0;
                    }
                    if (phy.hangerBreakHold[c.index] >= 36) {
                        noteCableSnap(c, `Cáp treo tầng dầm ${c.index + 1} đứt: sức căng ${seenH.toFixed(1)} t vượt MBL ${mbl.toFixed(1)} t.`);
                        phy.hangerTensions[c.index] = 0;
                    }
                }
            });
            const taut = [];
            for (let i = 0; i < state.lugs.length; i++) if (!phy.legSlacks[i]) taut.push(phy.legAngleDeg[i]);
            if (taut.length) phy.maxAngleVert = 90 - Math.min.apply(null, taut);
            // Slack → taut: spawn red force-flow along the load path
            if (typeof syncCableForceFlowTriggers === 'function') syncCableForceFlowTriggers();
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
            phy.upperTensions = [0, 0, 0, 0, 0, 0, 0, 0];
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

        function hoistSpeedScaleFactor() {
            return THREE.MathUtils.clamp(state.hoistSpeedScale != null ? state.hoistSpeedScale : 1, 0.25, 2.0);
        }

        function cargoHoistRates() {
            const scale = hoistSpeedScaleFactor();
            if (typeof RIG !== 'undefined' && RIG.computeUnifiedHoistRates) {
                return RIG.computeUnifiedHoistRates(scale);
            }
            const v = 0.85 * scale;
            return { up: v, down: v };
        }

        function winchSpeedForLoad() {
            return cargoHoistRates().up;
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
