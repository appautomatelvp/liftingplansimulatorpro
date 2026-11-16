/**
 * gear/editor — gear editor / selection UI
 * Split from legacy god-file (strangler Phase 2). Shared scope via assemble.
 */
/**
 * gear — part of the lifting simulator.
 * These files are assembled into one module so they share state, physics and the scene.
 */
        function freshGear() {
            // Placeholder ratings — overwritten by autoSizeGearForLoad(WLL/SWL/MBL) on boot / cargo change
            return {
                selection: [],
                legs: [0, 1, 2, 3, 4, 5, 6, 7].map(() => ({ lengthM: null, swlT: 16, diaMm: 22, massKg: null, sf: 5, mblT: 80, grade: null, broken: false, slingType: null, parts: 1 })),
                uppers: [0, 1, 2, 3].map(() => ({ lengthM: null, swlT: 26, diaMm: 26, massKg: null, sf: 5, mblT: 130, grade: null, broken: false, slingType: null, parts: 1 })),
                hangers: [0, 1, 2, 3, 4, 5].map(() => ({ lengthM: null, swlT: 16, diaMm: 22, massKg: null, sf: 5, mblT: 80, grade: null, broken: false, slingType: null, parts: 1 })),
                shackles: [0, 1, 2, 3].map(() => ({ swlT: 26, massKg: null, pinMm: 38, jawMm: 54, sf: 6, mblT: 156 })),
                beam: { swlT: 32, massT: null, lengthM: null, widthM: null, depthM: 0.24, sf: 4, mblT: 128 },
                hook: { swlT: 40, massKg: 380, sf: 4, mblT: 160 },
                members: {},
                extraCables: []
            };
        }

        function gearIsSelected(kind, role, index) {
            return state.gear.selection.some(s => s.kind === kind && (kind !== 'sling' || s.role === role) && s.index === index);
        }

        function gearIsCtrlHover(kind, role, index) {
            const h = state.gear && state.gear.ctrlHover;
            if (!h || h.kind !== kind) return false;
            if (kind === 'sling') return h.role === role && (h.index || 0) === (index || 0);
            if (kind === 'member') return h.memberId === role;
            return (h.index || 0) === (index || 0);
        }
        if (typeof window !== 'undefined') window.gearIsCtrlHover = gearIsCtrlHover;

        function gearRecord(sel) {
            if (sel.kind === 'sling' && sel.role === 'extra') return (state.gear.extraCables || [])[sel.index] || null;
            if (sel.kind === 'sling' && sel.role === 'upper') return (state.gear.uppers || [])[sel.index] || null;
            if (sel.kind === 'sling' && sel.role === 'hanger') return (state.gear.hangers || [])[sel.index] || null;
            if (sel.kind === 'sling') return (state.gear.legs || [])[sel.index] || null;
            if (sel.kind === 'shackle') return state.gear.shackles[sel.index];
            if (sel.kind === 'member') return memberStore(sel.memberId);
            if (sel.kind === 'beam') return state.gear.beam;
            if (sel.kind === 'cargo') {
                if (!state.gear.cargo) state.gear.cargo = {};
                Object.assign(state.gear.cargo, {
                    L: state.L, W: state.W, H: state.H, weight: state.weight,
                    cogX: state.cogX, cogY: state.cogY, cogZ: state.cogZ,
                    tareT: state.tareT != null ? state.tareT : null
                });
                return state.gear.cargo;
            }
            return state.gear.hook;
        }

        function gearItemLabel(s) {
            if (!s) return L('Item', 'Thiết bị');
            if (s.kind === 'member') {
                const spec = memberSpec(s.memberId);
                return spec ? bi(spec.nameKey) : bi('gearBeam');
            }
            if (s.kind === 'sling' && s.role === 'extra') return L(`Extra rope ${s.index + 1}`, `Cáp thêm ${s.index + 1}`);
            if (s.kind === 'sling' && s.role === 'upper') return L(`Upper sling ${s.index + 1}`, `Cáp treo dầm ${s.index + 1}`);
            if (s.kind === 'sling' && s.role === 'hanger') return L(`Hanger ${s.index + 1}`, `Cáp treo tầng dầm ${s.index + 1}`);
            if (s.kind === 'sling') return L(`Sling leg LP${s.index + 1}`, `Cáp nhánh LP${s.index + 1}`);
            if (s.kind === 'shackle') return L(`Shackle LP${s.index + 1}`, `Ma ní LP${s.index + 1}`);
            if (s.kind === 'beam') return bi('gearBeam');
            if (s.kind === 'cargo') return L('Cargo / Load', 'Kiện hàng');
            if (s.kind === 'hook') return bi('gearHook');
            return L('Item', 'Thiết bị');
        }

        function gearTitle() {
            const sel = state.gear.selection;
            if (!sel.length) return L('Gear data', 'Thông số thiết bị');
            if (sel.length === 1) return gearItemLabel(sel[0]);
            return L(`${sel.length} selected parts`, `${sel.length} thiết bị đã chọn`);
        }

        function gearItemKey(s) {
            return `${s.kind}|${s.role || ''}|${s.index}|${s.memberId || ''}`;
        }

        function mainMemberId() {
            if (state.beamType === 'spreader' || state.beamType === 'lifting_beam') return 'main';
            if (state.beamType === 'modular_truss') return 'truss';
            if (state.beamType === 'cascaded') return 'top';
            if (state.beamType === 'inline4') return 'i4top';
            if (state.beamType === 'inline8') return 'n8top';
            if (state.beamType === 'spatial8') return 's8top';
            const cat = memberCatalog();
            const along = cat.find(m => m.axis === 'x');
            return along ? along.id : (cat[0] ? cat[0].id : null);
        }

        function subMemberIds() {
            return ['lowPlus', 'lowMinus', 'barPos', 'barNeg'].filter(id => memberCatalog().some(m => m.id === id));
        }

        function releaseBeamLengthOverrides() {
            state.customBeamLengthMode = false;
            state.holdCableLength = false;
            state.heldCableL0 = null;
            if (state.gear && state.gear.beam) {
                state.gear.beam.lengthM = null;
                state.gear.beam.widthM = null;
            }
            if (state.gear && state.gear.members) {
                Object.keys(state.gear.members).forEach(id => {
                    state.gear.members[id].lengthM = null;
                    state.gear.members[id].aM = null;
                    state.gear.members[id].bM = null;
                    state.gear.members[id].picks = [];
                });
            }
            if (state.gear) state.gear.extraCables = [];
            if (state.gear) {
                state.gear.legs.forEach(l => { l.broken = false; });
                state.gear.uppers.forEach(u => { u.broken = false; });
                if (state.gear.hangers) state.gear.hangers.forEach(h => { h.broken = false; });
            }
        }

        /**
         * When switching beam topology (modular ↔ cascaded ↔ frame ↔ …), drop every
         * per-cable length lock inherited from the previous graph. Leaving asymmetric
         * Nhớm/userSet L0 on uppers is what locks a tilted cargo into the next plan.
         */
        function clearSlingLengthOverridesForBeamChange() {
            releaseBeamLengthOverrides();
            state.slingUserSet = false;
            state.upperSlingLength = null;
            state.lowerSlingLength = null;
            state.hangerSlingLength = 2.0;
            state.slingLength = null;
            state.cableAdjustMode = false;
            state.legDeltaL = [0, 0, 0, 0, 0, 0, 0, 0];
            if (state.gear) {
                const wipe = (rec) => {
                    if (!rec) return;
                    rec.lengthM = null;
                    rec.userSet = false;
                    rec.broken = false;
                };
                (state.gear.uppers || []).forEach(wipe);
                (state.gear.legs || []).forEach(wipe);
                (state.gear.hangers || []).forEach(wipe);
            }
            if (typeof syncCableAutoBalanceVisibility === 'function') syncCableAutoBalanceVisibility();
        }
        if (typeof window !== 'undefined') {
            window.clearSlingLengthOverridesForBeamChange = clearSlingLengthOverridesForBeamChange;
        }

        function appendSpreaderInspector(box) {
            const sel = state.gear.selection[0];
            const id = sel && sel.memberId ? sel.memberId : mainMemberId();
            const spec = id ? memberSpec(id) : null;
            if (!spec) return;
            const rec = memberStore(id);
            const addRow = (label, value, min, max, step, onChange) => {
                const row = createSliderRow({
                    label,
                    value,
                    min,
                    max,
                    step,
                    decimals: step < 1 ? 2 : 0,
                    unit: label.includes('(mm)') ? ' mm' : (label.includes('(m)') ? ' m' : (label.includes('(t)') ? ' t' : '')),
                    accent: label.includes('WLL') || label.includes('Tự trọng') ? 'amber' : 'sky',
                    onInput: (v) => {
                        preserveOtherCables();
                        onChange(THREE.MathUtils.clamp(v, min, max));
                        scheduleRebuildSpreaderVisuals();
                        if (state.poseLock) seedBeamsFromKinematic();
                    },
                    onChange: (v) => {
                        preserveOtherCables();
                        onChange(THREE.MathUtils.clamp(v, min, max));
                        scheduleRebuildSpreaderVisuals();
                        if (state.poseLock) seedBeamsFromKinematic();
                        renderGearFields();
                    }
                });
                box.appendChild(row.wrap);
            };
            const spanMax = spec.axis === 'z' ? 6 : 14;
            const spanMin = spec.axis === 'z' ? 0.6 : 1;
            addRow('Chiều dài thanh đang chọn (m)', spec.length, spanMin, spanMax, 0.05, v => {
                state.customBeamLengthMode = true;
                rec.lengthM = v;
            });
            addRow('Đường kính thanh đang chọn (mm)', (rec.odMm != null ? rec.odMm : memberDiameter(id) * 1000), 80, 400, 5, v => {
                rec.odMm = v;
            });
            addRow('WLL thanh đang chọn (t)', rec.swlT != null ? rec.swlT : (state.gear.beam.swlT || 40), 1, 2000, 0.5, v => {
                rec.swlT = v;
            });
            addRow('Tự trọng thanh đang chọn (t)', rec.massT != null ? rec.massT : 0.3, 0.02, 20, 0.05, v => {
                rec.massT = v;
            });
            const picks = rec.picks || [];
            picks.forEach((p, i) => {
                addRow(`Điểm bắt thêm ${i + 1} (m)`, p.off || 0, -spanMax / 2, spanMax / 2, 0.05, v => {
                    p.off = v;
                    (state.gear.extraCables || []).forEach(ex => { if (ex.pickId === p.id) ex.off = v; });
                });
            });
            (state.gear.extraCables || []).forEach((ex, i) => {
                if (ex.memberId !== id) return;
                addRow(`Cáp thêm ${i + 1} · dài (m)`, ex.lengthM != null ? ex.lengthM : 1, 0.2, 40, 0.05, v => {
                    ex.lengthM = v;
                    ex.userSet = true;
                });
            });
            const addPickBtn = document.createElement('button');
            addPickBtn.type = 'button';
            addPickBtn.className = 'w-full text-[11px] font-bold rounded bg-sky-800 hover:bg-sky-700 px-2 py-1';
            addPickBtn.textContent = L('Add a pick on this bar', 'Thêm điểm bắt trên thanh này');
            addPickBtn.addEventListener('click', () => { addMemberPick(id); });
            const addCableBtn = document.createElement('button');
            addCableBtn.type = 'button';
            addCableBtn.className = 'w-full text-[11px] font-bold rounded bg-amber-800 hover:bg-amber-700 px-2 py-1';
            addCableBtn.textContent = L('Add a rope on the latest pick', 'Thêm cáp vào điểm bắt mới nhất');
            addCableBtn.addEventListener('click', () => { addMemberCable(id); });
            const saveBtn = document.createElement('button');
            saveBtn.type = 'button';
            saveBtn.className = 'w-full text-[11px] font-bold rounded bg-emerald-800 hover:bg-emerald-700 px-2 py-1';
            saveBtn.textContent = L('Save this rig to the library', 'Lưu bộ treo này vào thư viện');
            saveBtn.addEventListener('click', saveCurrentRigToLibrary);
            box.appendChild(addPickBtn);
            box.appendChild(addCableBtn);
            box.appendChild(saveBtn);
        }

        function addMemberPick(id) {
            const spec = memberSpec(id);
            if (!spec) return;
            const rec = memberStore(id);
            if (!rec.picks) rec.picks = [];
            let off = 0;
            let guard = 0;
            while (rec.picks.some(p => Math.abs((p.off || 0) - off) < 0.18) && guard < 16) {
                off = (guard % 2 === 0 ? 1 : -1) * 0.28 * (Math.floor(guard / 2) + 1);
                guard++;
            }
            off = THREE.MathUtils.clamp(off, -spec.length / 2 + 0.1, spec.length / 2 - 0.1);
            rec.picks.push({ id: 'pk' + Date.now(), off: off });
            preserveOtherCables();
            scheduleRebuildSpreaderVisuals();
            if (state.poseLock) seedBeamsFromKinematic();
            renderGearFields();
            const status = document.getElementById('sim-status-text');
            if (status) status.textContent = `Đã thêm điểm bắt trên ${gearTitle()}.`;
        }

        function addMemberCable(id) {
            const rec = memberStore(id);
            const picks = rec.picks || [];
            if (!picks.length) addMemberPick(id);
            const pick = (memberStore(id).picks || []).slice(-1)[0];
            if (!pick) return;
            if (!state.gear.extraCables) state.gear.extraCables = [];
            if (state.gear.extraCables.length >= 8) {
                const status = document.getElementById('sim-status-text');
                if (status) status.textContent = 'Đã đủ 8 cáp thêm.';
                return;
            }
            const spec = memberSpec(id);
            state.gear.extraCables.push({
                id: 'ex' + Date.now(),
                memberId: id,
                pickId: pick.id,
                off: pick.off,
                to: spec && spec.axis === 'z' ? 'cargo' : 'hook',
                lug: state.gear.extraCables.length % Math.max(1, state.lugs.length),
                lengthM: null,
                swlT: 12,
                diaMm: 18,
                slingType: state.slingType || 'wire',
                broken: false
            });
            preserveOtherCables();
            scheduleRebuildSpreaderVisuals();
            if (state.poseLock) seedBeamsFromKinematic();
            renderGearFields();
            const status = document.getElementById('sim-status-text');
            if (status) status.textContent = 'Đã thêm một sợi cáp tại điểm bắt đang chọn.';
        }

        function saveCurrentRigToLibrary() {
            const snap = {
                id: 'userrig' + Date.now(),
                name: 'Bộ treo ' + new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }),
                beamType: state.beamType,
                slingType: state.slingType,
                hwType: state.hwType,
                slingLength: state.slingLength,
                rigFit: state.rigFit,
                members: JSON.parse(JSON.stringify(state.gear.members || {})),
                extraCables: JSON.parse(JSON.stringify(state.gear.extraCables || []))
            };
            const key = 'lp-user-rigs';
            const list = JSON.parse(localStorage.getItem(key) || '[]');
            list.unshift(snap);
            localStorage.setItem(key, JSON.stringify(list.slice(0, 24)));
            mountUserRigCard(snap);
            const status = document.getElementById('sim-status-text');
            if (status) status.textContent = `Đã lưu "${snap.name}" vào thư viện phương án dầm.`;
        }

        function applyUserRig(snap) {
            state.beamType = snap.beamType || state.beamType;
            state.slingType = snap.slingType || state.slingType;
            state.hwType = snap.hwType || state.hwType;
            if (snap.slingLength) state.slingLength = snap.slingLength;
            state.rigFit = snap.rigFit === 'auto' ? 'auto' : 'fixed';
            state.gear.members = JSON.parse(JSON.stringify(snap.members || {}));
            state.gear.extraCables = JSON.parse(JSON.stringify(snap.extraCables || []));
            state.holdCableLength = false;
            state.heldCableL0 = null;
            if (state.rigFit !== 'auto') state.customBeamLengthMode = true;
            document.querySelectorAll('#beam-store .card-btn').forEach(c => c.classList.toggle('active', c.dataset.beam === snap.id));
            syncRigFitButton();
            scheduleRebuildSpreaderVisuals();
            if (state.poseLock) seedBeamsFromKinematic();
            const status = document.getElementById('sim-status-text');
            if (status) status.textContent = `Đã mở "${snap.name}" từ thư viện.`;
        }

        function mountUserRigCard(snap) {
            const container = document.getElementById('beam-store');
            if (!container || container.querySelector(`[data-beam="${snap.id}"]`)) return;
            const card = document.createElement('div');
            card.className = 'card-btn';
            card.dataset.beam = snap.id;
            const n = (snap.extraCables || []).length;
            card.innerHTML = `<div class="text-[11px] font-bold text-emerald-300 truncate">${snap.name}</div><div class="text-[9px] text-slate-400 truncate">${n} cáp thêm · ${snap.rigFit === 'auto' ? 'Auto' : 'Cố định'}</div>`;
            card.addEventListener('click', () => applyUserRig(snap));
            container.appendChild(card);
        }

        function restoreUserRigs() {
            try {
                JSON.parse(localStorage.getItem('lp-user-rigs') || '[]').forEach(mountUserRigCard);
            } catch (err) { /* thư viện trống */ }
        }

        function syncRigFitButton() {
            const btn = document.getElementById('btn-rig-fit');
            if (!btn) return;
            const auto = state.rigFit === 'auto';
            btn.textContent = auto ? 'Auto cáp' : 'Cố định';
            btn.classList.toggle('emerald', auto);
            btn.classList.toggle('text-amber-200', !auto);
        }

        // The editor can be opened on the load itself, not only on one cable.
        // In that view "cut cable" must mean every lower leg which supports the
        // selected load.  Previously it only iterated selected sling records;
        // therefore clicking the generic button on a cargo panel cut *nothing*
        // while still showing a snap message.  That was particularly misleading
        // during a full-drop test.
        function selectedCargoSupportCables() {
            return (phy.cables || []).filter(c => c.role === 'leg'
                && c.b && c.b.kind === 'cargo');
        }

        function selectedRiggingCables() {
            const selection = state.gear.selection || [];
            const selected = [];
            const seen = new Set();
            const add = cable => {
                if (!cable || seen.has(cable)) return;
                seen.add(cable);
                selected.push(cable);
            };

            // Selecting the cargo is deliberately a load-level operation: all
            // lower legs release together, while upper slings and the hook stay
            // attached to their own spreader system.
            if (selection.some(s => s.kind === 'cargo')) {
                selectedCargoSupportCables().forEach(add);
            }
            selection.forEach(sel => {
                if (sel.kind !== 'sling') return;
                add((phy.cables || []).find(c => c.role === sel.role && c.index === sel.index));
            });
            return selected;
        }

        function selectedRiggingActionText() {
            const cargoSelected = (state.gear.selection || []).some(s => s.kind === 'cargo');
            if (!cargoSelected) return null;
            const count = selectedCargoSupportCables().length;
            return count === 1 ? 'cáp nhánh đỡ kiện hàng' : `toàn bộ ${count} cáp nhánh đỡ kiện hàng`;
        }

        function cutSelectedRiggingCables(frac) {
            const selection = state.gear.selection || [];
            let cutCount = 0;
            const target = selectedRiggingActionText() || gearTitle();
            const cables = selectedRiggingCables().filter(c => !cableIsBroken(c));
            cables.forEach(cable => {
                noteCableSnap(cable, `Đã chủ động cắt ${target}.`, frac);
                cutCount++;
            });
            selection.forEach(s => {
                if (s.kind === 'sling') {
                    const rec = gearRecord(s);
                    if (rec && !rec.broken) {
                        rec.broken = true;
                        cutCount++;
                    }
                }
            });
            return cutCount;
        }

        let cutHoverKey = null;
        let cutHoverMarker = null;

        function ensureCutHoverMarker() {
            if (cutHoverMarker) return cutHoverMarker;
            cutHoverMarker = new THREE.Mesh(
                new THREE.SphereGeometry(0.055, 12, 10),
                new THREE.MeshBasicMaterial({
                    color: 0xff0033,
                    transparent: true,
                    opacity: 0.92,
                    depthTest: false
                })
            );
            cutHoverMarker.renderOrder = 999;
            cutHoverMarker.visible = false;
            scene.add(cutHoverMarker);
            return cutHoverMarker;
        }

        function clearCutHoverVisual() {
            if (phy && phy.cables) {
                phy.cables.forEach(c => {
                    if (!c) return;
                    c._cutHover = false;
                });
            }
            cutHoverKey = null;
            if (cutHoverMarker) cutHoverMarker.visible = false;
        }

        /** Fat screen-space pick along sling paths — easier than pixel-perfect mesh hits. */
        function pickSlingCutHit(maxPx) {
            const radiusPx = maxPx != null ? maxPx : 36;
            const w = window.innerWidth;
            const h = window.innerHeight;
            const sx = (mouse.x + 1) * 0.5 * w;
            const sy = (-mouse.y + 1) * 0.5 * h;
            let best = null;
            const tmpA = new THREE.Vector3();
            const tmpB = new THREE.Vector3();
            const tmpP = new THREE.Vector3();

            const distPointSeg2D = (px, py, ax, ay, bx, by) => {
                const abx = bx - ax, aby = by - ay;
                const apx = px - ax, apy = py - ay;
                const ab2 = abx * abx + aby * aby;
                let t = ab2 > 1e-8 ? (apx * abx + apy * aby) / ab2 : 0;
                t = Math.max(0, Math.min(1, t));
                const qx = ax + abx * t, qy = ay + aby * t;
                const dx = px - qx, dy = py - qy;
                return { d: Math.hypot(dx, dy), t };
            };

            (typeof sling3DPool !== 'undefined' ? sling3DPool : []).forEach(s => {
                if (!s || !s.group || !s.group.visible || !s.drawMeta) return;
                if (s.drawMeta.brokenHalf) return;
                const pts = s.pathPoints;
                if (!pts || pts.length < 2) return;
                const role = s.drawMeta.role || 'leg';
                const index = s.drawMeta.index || 0;
                const cable = (phy.cables || []).find(c => c.role === role && c.index === index);
                if (cable && cableIsBroken(cable)) return;

                let acc = 0;
                const segLens = [];
                for (let i = 0; i < pts.length - 1; i++) {
                    const len = pts[i].distanceTo(pts[i + 1]);
                    segLens.push(len);
                    acc += len;
                }
                const total = Math.max(1e-6, acc);
                let along = 0;
                for (let i = 0; i < pts.length - 1; i++) {
                    tmpA.copy(pts[i]).project(camera);
                    tmpB.copy(pts[i + 1]).project(camera);
                    if ((tmpA.z < -1 && tmpB.z < -1) || (tmpA.z > 1 && tmpB.z > 1)) {
                        along += segLens[i];
                        continue;
                    }
                    const ax = (tmpA.x + 1) * 0.5 * w;
                    const ay = (-tmpA.y + 1) * 0.5 * h;
                    const bx = (tmpB.x + 1) * 0.5 * w;
                    const by = (-tmpB.y + 1) * 0.5 * h;
                    const hit = distPointSeg2D(sx, sy, ax, ay, bx, by);
                    if (hit.d <= radiusPx && (!best || hit.d < best.dPx)) {
                        tmpP.copy(pts[i]).lerp(pts[i + 1], hit.t);
                        const fracAlong = (along + segLens[i] * hit.t) / total;
                        best = {
                            kind: 'sling',
                            role,
                            index,
                            point: tmpP.clone(),
                            frac: fracAlong,
                            dPx: hit.d,
                            sling: s,
                            cable
                        };
                    }
                    along += segLens[i];
                }
            });
            return best;
        }

        function updateCutToolHover() {
            if (!state.cutToolActive) {
                clearCutHoverVisual();
                return;
            }
            const hit = pickSlingCutHit(40);
            const marker = ensureCutHoverMarker();
            if (!hit) {
                clearCutHoverVisual();
                return;
            }
            const key = `${hit.role}|${hit.index}`;
            // Entering a cable → one red flash on the sling + red cut-point marker
            if (key !== cutHoverKey) {
                clearCutHoverVisual();
                cutHoverKey = key;
                if (hit.cable) {
                    hit.cable._cutHover = true;
                    hit.cable._cutHoverFlash = true;
                    hit.cable._isFlashing = true;
                    hit.cable._flashStartTime = performance.now();
                }
            } else if (hit.cable) {
                hit.cable._cutHover = true;
            }
            marker.visible = true;
            marker.position.copy(hit.point);
            const pulse = 0.9 + 0.35 * Math.abs(Math.sin(performance.now() * 0.022));
            marker.scale.setScalar(pulse);
            if (marker.material) {
                marker.material.opacity = 0.75 + 0.25 * pulse;
            }
        }

        function syncCutToolButton() {
            const btn = document.getElementById('btn-cut-tool');
            if (!btn) return;
            const on = !!state.cutToolActive;
            btn.classList.toggle('ring-2', on);
            btn.classList.toggle('ring-rose-400', on);
            btn.classList.toggle('bg-rose-700', on);
            btn.classList.toggle('!bg-rose-700', on);
            btn.setAttribute('aria-pressed', on ? 'true' : 'false');
            document.body.classList.toggle('cut-tool-active', on);
            if (!on) {
                clearCutHoverVisual();
                document.body.style.cursor = '';
                const ghost = document.getElementById('cut-pliers-cursor');
                if (ghost) ghost.style.display = 'none';
            }
            const status = document.getElementById('sim-status-text');
            if (on && status) {
                status.textContent = L(
                    'Scissors ON — move near a rope/chain (it flashes red), then click to cut. Esc to cancel.',
                    'Kéo cắt BẬT — đưa gần cáp/xích (đoạn đó nháy đỏ), rồi bấm để cắt. Esc để tắt.'
                );
            }
        }

        function setCutToolActive(on, ev) {
            state.cutToolActive = !!on;
            if (state.cutToolActive) setCtrlPickMode(false);
            syncCutToolButton();
            if (on) updateCutToolHover();
            if (!state.cutToolActive) {
                const status = document.getElementById('sim-status-text');
                if (status && /kìm|kéo|Pliers|Scissors|cắt đúng|Kéo cắt/i.test(status.textContent || '')) {
                    status.textContent = L('Ready', 'Sẵn sàng');
                }
            }
        }

        /** Collapse drawers / gear editor / analysis HUD when clicking the 3D view. */
        function collapsePanelsForCanvasClick() {
            const drawerWasOpen = !!(document.body.classList.contains('drawer-open')
                || (document.getElementById('right-side-drawer') || {}).classList?.contains?.('drawer-open'));
            const gear = document.getElementById('gear-editor');
            const gearWasOpen = !!(document.body.classList.contains('gear-editor-open')
                || (gear && gear.style.display !== 'none' && gear.style.display !== '')
                || (state.gear.selection && state.gear.selection.length));
            if (typeof closeGearEditor === 'function') closeGearEditor();
            else {
                if (gear) gear.style.display = 'none';
                document.body.classList.remove('gear-editor-open');
                state.gear.selection = [];
                if (typeof updateGearSelectionRings === 'function') updateGearSelectionRings();
            }
            if (typeof closeRightDrawer === 'function') closeRightDrawer();
            const compHud = document.getElementById('compliance-hud-panel');
            if (compHud && !compHud.classList.contains('hidden')) {
                compHud.classList.add('hidden');
                document.getElementById('btn-open-compliance')?.classList.remove('active');
            }
            document.body.classList.remove('show-hud', 'show-cam');
            if (window.UI?.layout?.closeAllMenus) window.UI.layout.closeAllMenus();
            if (typeof syncSheetButtons === 'function') syncSheetButtons();
            // closeRightDrawer already triggers cinema when the drawer was open;
            // if only the gear panel was up, still reframe to full stage.
            if (!drawerWasOpen && gearWasOpen) {
                requestAnimationFrame(() => {
                    if (typeof window.startCinematicUiFrame === 'function') {
                        window.startCinematicUiFrame({ duration: 0.9 });
                    }
                });
            }
        }

        /** Fraction 0..1 of hit along cable A→B using rendered path when available. */
        function cutFractionAlongCable(cable, hitPoint) {
            if (!cable || !hitPoint) return 0.5;
            const sling = (typeof sling3DPool !== 'undefined' ? sling3DPool : []).find(s =>
                s && s.group && s.group.visible && s.drawMeta
                && s.drawMeta.role === cable.role && s.drawMeta.index === cable.index
                && !s.drawMeta.brokenHalf
            );
            const pts = sling && sling.pathPoints;
            if (pts && pts.length >= 2) {
                let bestD = Infinity;
                let bestAlong = 0;
                let acc = 0;
                const total = (() => {
                    let t = 0;
                    for (let i = 1; i < pts.length; i++) t += pts[i].distanceTo(pts[i - 1]);
                    return Math.max(1e-6, t);
                })();
                for (let i = 1; i < pts.length; i++) {
                    const a = pts[i - 1];
                    const b = pts[i];
                    const ab = b.clone().sub(a);
                    const len = ab.length();
                    if (len < 1e-8) continue;
                    const t = THREE.MathUtils.clamp(hitPoint.clone().sub(a).dot(ab) / (len * len), 0, 1);
                    const proj = a.clone().addScaledVector(ab, t);
                    const d = proj.distanceToSquared(hitPoint);
                    if (d < bestD) {
                        bestD = d;
                        bestAlong = (acc + len * t) / total;
                    }
                    acc += len;
                }
                return THREE.MathUtils.clamp(bestAlong, 0.12, 0.88);
            }
            const pA = attachWorld(cable.a);
            const pB = attachWorld(cable.b);
            const ab = pB.clone().sub(pA);
            const lenSq = ab.lengthSq();
            if (lenSq < 1e-8) return 0.5;
            return THREE.MathUtils.clamp(hitPoint.clone().sub(pA).dot(ab) / lenSq, 0.12, 0.88);
        }

        function cutCableAtHit(gearData, hitPoint) {
            if (!gearData || gearData.kind !== 'sling') return false;
            const cable = (phy.cables || []).find(c => c.role === gearData.role && c.index === gearData.index);
            if (!cable || cableIsBroken(cable)) return false;
            const frac = cutFractionAlongCable(cable, hitPoint);
            const label = gearData.role === 'upper'
                ? `cáp tầng trên #${(gearData.index || 0) + 1}`
                : (gearData.role === 'leg'
                    ? `cáp nhánh LP${(gearData.index || 0) + 1}`
                    : 'sợi cáp');
            noteCableSnap(
                cable,
                `✂ Đã cắt ${label} tại ${(frac * 100).toFixed(0)}% chiều dài — hai nửa văng theo trọng lực.`,
                frac
            );
            return true;
        }

        function repairSelectedRiggingCables() {
            const selection = state.gear.selection || [];
            let fixCount = 0;
            const cables = selectedRiggingCables().filter(c => cableIsBroken(c));
            cables.forEach(cable => {
                const rec = gearCableRecord(cable);
                if (rec) rec.broken = false;
                clearCableBreak(cable);
                fixCount++;
            });
            selection.forEach(s => {
                if (s.kind === 'sling') {
                    const rec = gearRecord(s);
                    if (rec && rec.broken) {
                        rec.broken = false;
                        fixCount++;
                    }
                }
            });
            return fixCount;
        }

        function syncGearEditorActionLabels() {
            const cutBtn = document.getElementById('gear-editor-cut');
            const repairBtn = document.getElementById('gear-editor-repair');
            const cargoText = selectedRiggingActionText();
            const sel = state.gear.selection || [];
            const slingItems = sel.filter(s => s.kind === 'sling');
            const hasCargo = sel.some(s => s.kind === 'cargo');

            const anyIntact = slingItems.some(s => {
                const rec = gearRecord(s);
                return rec && !rec.broken;
            }) || (hasCargo && selectedCargoSupportCables().some(c => !cableIsBroken(c)));

            const anyBroken = slingItems.some(s => {
                const rec = gearRecord(s);
                return rec && rec.broken;
            }) || (hasCargo && selectedCargoSupportCables().some(c => cableIsBroken(c)));

            const scissorsSvg = `<svg class="cut-scissors-icon" width="14" height="14" viewBox="0 0 32 32" aria-hidden="true"><circle cx="9" cy="24" r="4.2" fill="none" stroke="#fecdd3" stroke-width="2.4"/><circle cx="23" cy="24" r="4.2" fill="none" stroke="#fecdd3" stroke-width="2.4"/><path fill="#e2e8f0" d="M11.2 20.6 L6.2 5.8 L14.8 13.8 Z"/><path fill="#f8fafc" d="M20.8 20.6 L25.8 5.8 L17.2 13.8 Z"/><circle cx="16" cy="16.2" r="2" fill="#fda4af"/></svg>`;
            if (cutBtn) {
                if (slingItems.length > 0 || hasCargo) {
                    cutBtn.style.display = anyIntact ? 'inline-flex' : 'none';
                    const label = hasCargo ? `Cắt ${cargoText}` : (sel.length === 1 ? 'Cắt sợi cáp này' : `Cắt cả ${sel.length} cáp`);
                    cutBtn.innerHTML = `${scissorsSvg}<span>${label}</span>`;
                    cutBtn.title = cargoText ? `Cắt ${cargoText}; kiện hàng sẽ được giải phóng theo trọng lực.` : 'Cắt các cáp đang chọn.';
                } else {
                    cutBtn.style.display = 'inline-flex';
                    cutBtn.innerHTML = `${scissorsSvg}<span>Cắt thiết bị</span>`;
                }
            }
            if (repairBtn) {
                if (slingItems.length > 0 || hasCargo) {
                    repairBtn.style.display = anyBroken ? 'inline-flex' : 'none';
                    const label = hasCargo ? `🔗 Nối lại ${cargoText}` : (sel.length === 1 ? '🔗 Nối lại sợi cáp' : '🔗 Nối lại các cáp đứt');
                    repairBtn.innerHTML = `<span>🔗</span><span>${label}</span>`;
                    repairBtn.title = cargoText ? `Nối lại ${cargoText}.` : 'Nối lại các cáp đang chọn.';
                } else {
                    repairBtn.style.display = 'none';
                }
            }
        }

        function calculateAutoSlingSWL(rec) {
            const resolver = (typeof CAE !== 'undefined' && CAE.resolveSling)
                || (typeof window !== 'undefined' && window.CAE && window.CAE.resolveSling);
            if (resolver) {
                const spec = resolver(rec, { globalType: state.slingType });
                if (spec && isFinite(spec.wllEffectiveT)) return spec.wllEffectiveT;
                if (spec && isFinite(spec.wllT)) return spec.wllT;
            }
            if (typeof autoSlingWll === 'function') {
                return autoSlingWll(rec, state.wllPerLeg || 15.0);
            }
            const parts = Math.max(1, Math.min(4, (rec && rec.parts) || 1));
            const type = (rec && rec.slingType) || state.slingType || 'wire';
            const d = (rec && rec.diaMm) || 22;
            let singleWll = (type === 'chain') ? 0.0315 * d * d : 0.0163 * d * d;
            return Math.max(0.2, Number((singleWll * parts).toFixed(2)));
        }

        function calculateAutoSlingMass(rec, lengthM) {
            const resolver = (typeof CAE !== 'undefined' && CAE.resolveSling)
                || (typeof window !== 'undefined' && window.CAE && window.CAE.resolveSling);
            if (resolver) {
                const spec = resolver(rec, {
                    globalType: state.slingType,
                    lengthMFallback: lengthM || (rec && rec.lengthM) || state.slingLength || 2.5
                });
                if (spec && isFinite(spec.massKg)) return spec.massKg;
            }
            const parts = Math.max(1, Math.min(4, (rec && rec.parts) || 1));
            const look = (rec && rec.slingType) || state.slingType || 'wire';
            const d = Math.max(6, (rec && rec.diaMm) || (look === 'web' || look === 'round_sling' ? 60 : 20));
            const L = Math.max(0.3, Number(lengthM) || (rec && rec.lengthM) || state.slingLength || 2.5);
            let baseKg = (look === 'chain') ? (0.0218 * d * d * L + 0.0085 * d * d) : (0.0040 * d * d * L + 0.0028 * d * d);
            return Number((baseKg * parts).toFixed(1));
        }

        function createStepperControl({ value, min, max, step, decimals = 2, onChange }) {
            const wrap = document.createElement('div');
            wrap.className = 'flex items-center gap-1';

            const decBtn = document.createElement('button');
            decBtn.type = 'button';
            decBtn.className = 'w-6 h-6 flex items-center justify-center rounded bg-slate-800 hover:bg-sky-700 active:bg-sky-800 text-slate-200 border border-slate-700 text-xs font-bold leading-none select-none transition-colors';
            decBtn.textContent = '−';

            const input = document.createElement('input');
            input.type = 'number';
            input.step = String(step);
            if (min != null) input.min = String(min);
            if (max != null) input.max = String(max);
            input.value = Number(value).toFixed(decimals);
            input.className = 'flex-1 min-w-0 bg-slate-900 border border-slate-700 hover:border-sky-500 rounded px-1.5 py-0.5 text-right font-mono text-[11px] text-sky-200 focus:outline-none focus:border-sky-400';

            const incBtn = document.createElement('button');
            incBtn.type = 'button';
            incBtn.className = 'w-6 h-6 flex items-center justify-center rounded bg-slate-800 hover:bg-sky-700 active:bg-sky-800 text-slate-200 border border-slate-700 text-xs font-bold leading-none select-none transition-colors';
            incBtn.textContent = '+';

            decBtn.addEventListener('click', () => {
                let cur = parseFloat(input.value) || 0;
                cur = Math.max(min != null ? min : -Infinity, cur - step);
                input.value = cur.toFixed(decimals);
                onChange(cur);
            });

            incBtn.addEventListener('click', () => {
                let cur = parseFloat(input.value) || 0;
                cur = Math.min(max != null ? max : Infinity, cur + step);
                input.value = cur.toFixed(decimals);
                onChange(cur);
            });

            input.addEventListener('change', () => {
                let cur = parseFloat(input.value);
                if (!isFinite(cur)) return;
                if (min != null) cur = Math.max(min, cur);
                if (max != null) cur = Math.min(max, cur);
                input.value = cur.toFixed(decimals);
                onChange(cur);
            });

            wrap.appendChild(decBtn);
            wrap.appendChild(input);
            wrap.appendChild(incBtn);
            return { wrap, input, decBtn, incBtn };
        }

        /**
         * Unified horizontal slider + live readout (matches main drawer §1.2 / §1.3).
         * Prefer this for all dimension / CoG / capacity edits in popups.
         */
        function createSliderRow({
            label, value, min, max, step = 0.05, decimals = 2, unit = '',
            accent = 'sky', showNumber = true, nullable = false, placeholder = '',
            onInput, onChange
        }) {
            const wrap = document.createElement('div');
            wrap.className = `param-slider-row accent-${accent || 'sky'}`;

            const head = document.createElement('div');
            head.className = 'param-slider-head';
            const lab = document.createElement('span');
            lab.textContent = label;
            const right = document.createElement('div');
            right.className = 'flex items-center gap-1';
            const valEl = document.createElement('span');
            valEl.className = `param-slider-val ${accent === 'amber' ? 'text-amber-300' : accent === 'yellow' ? 'text-yellow-400' : accent === 'emerald' ? 'text-emerald-300' : 'text-sky-300'}`;
            const fmt = (v) => {
                if (v == null || !isFinite(v)) return placeholder || '—';
                return decimals <= 0 ? String(Math.round(v)) : Number(v).toFixed(decimals);
            };
            valEl.textContent = `${fmt(value)}${unit ? unit : ''}`;

            const num = document.createElement('input');
            num.type = 'number';
            num.className = 'param-slider-num';
            num.step = String(step);
            if (min != null) num.min = String(min);
            if (max != null) num.max = String(max);
            if (value != null && isFinite(value)) num.value = fmt(value);
            else num.placeholder = placeholder || 'Auto';
            if (!showNumber) num.style.display = 'none';

            right.appendChild(valEl);
            if (showNumber) right.appendChild(num);
            head.appendChild(lab);
            head.appendChild(right);

            const range = document.createElement('input');
            range.type = 'range';
            range.min = String(min != null ? min : 0);
            range.max = String(max != null ? max : 100);
            range.step = String(step);
            range.value = String(value != null && isFinite(value) ? value : (min != null ? min : 0));

            const emit = (raw, final) => {
                let v = parseFloat(raw);
                if (!isFinite(v)) {
                    if (nullable && final && String(raw).trim() === '') {
                        valEl.textContent = `${placeholder || 'Auto'}${unit || ''}`;
                        if (onChange) onChange(null);
                    }
                    return;
                }
                if (min != null) v = Math.max(min, v);
                if (max != null) v = Math.min(max, v);
                range.value = String(v);
                num.value = fmt(v);
                valEl.textContent = `${fmt(v)}${unit || ''}`;
                if (final) {
                    if (onChange) onChange(v);
                } else if (onInput) onInput(v);
                else if (onChange) onChange(v);
            };

            range.addEventListener('input', () => emit(range.value, false));
            range.addEventListener('change', () => emit(range.value, true));
            num.addEventListener('change', () => emit(num.value, true));
            num.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') { e.preventDefault(); emit(num.value, true); num.blur(); }
            });

            wrap.appendChild(head);
            wrap.appendChild(range);
            return { wrap, range, num, valEl, setValue: (v) => {
                if (v == null || !isFinite(v)) {
                    valEl.textContent = `${placeholder || 'Auto'}${unit || ''}`;
                    num.value = '';
                    return;
                }
                range.value = String(v);
                num.value = fmt(v);
                valEl.textContent = `${fmt(v)}${unit || ''}`;
            } };
        }

        function cargoIsoFamily(type) {
            const t = type || state.cargoType;
            if (['container', 'iso20hc', 'iso40', 'iso40hc', 'iso45hc', 'container10', 'iso53hc',
                'container_20ft_glb', 'container_40ft_glb'].includes(t)) return 'dry';
            if (t === 'opentop' || t === 'opentop40') return 'opentop';
            if (t === 'flatrack' || t === 'flatrack20') return 'flatrack';
            if (t === 'platform' || t === 'platform20') return 'platform';
            if (t === 'reefer' || t === 'reefer20') return 'reefer';
            if (t === 'isotank') return 'isotank';
            if (t === 'halfheight') return 'halfheight';
            if (t === 'drybulk') return 'drybulk';
            return null;
        }

        function isOogCapableCargo(type) {
            const t = type || state.cargoType;
            return t === 'opentop' || t === 'opentop40'
                || t === 'flatrack' || t === 'flatrack20'
                || t === 'platform' || t === 'platform20';
        }

        function isDeckOogCargo(type) {
            const t = type || state.cargoType;
            return t === 'flatrack' || t === 'flatrack20'
                || t === 'platform' || t === 'platform20';
        }

        function isoSiblingPresets(type) {
            const fam = cargoIsoFamily(type);
            const ids = {
                dry: ['container10', 'container', 'iso20hc', 'iso40', 'iso40hc', 'iso45hc'],
                opentop: ['opentop', 'opentop40'],
                flatrack: ['flatrack20', 'flatrack'],
                platform: ['platform20', 'platform'],
                reefer: ['reefer20', 'reefer'],
                isotank: ['isotank'],
                halfheight: ['halfheight'],
                drybulk: ['drybulk']
            }[fam] || [];
            const cat = (typeof libraryCatalog !== 'undefined' && libraryCatalog.cargo) ? libraryCatalog.cargo : [];
            return ids.map(id => cat.find(item => item.id === id)).filter(Boolean);
        }

        function shortIsoChipLabel(preset) {
            if (!preset) return '';
            const code = preset.isoCode || preset.badge || preset.id;
            const ft = preset.L >= 15 ? '53′'
                : preset.L >= 13 ? '45′'
                    : preset.L >= 9 ? '40′'
                        : preset.L >= 4 ? '20′'
                            : '10′';
            const hc = preset.H >= 2.85 ? ' HC' : (preset.H <= 0.7 ? '' : '');
            return `${ft}${hc} · ${code}`;
        }

        function applyIsoCargoPresetFromEditor(presetId) {
            const cat = (typeof libraryCatalog !== 'undefined' && libraryCatalog.cargo) ? libraryCatalog.cargo : [];
            const preset = cat.find(item => item.id === presetId);
            if (!preset || !preset.L) return;
            state.cargoType = presetId;
            state.isoCode = preset.isoCode || null;
            state.tareT = preset.tareT != null ? preset.tareT : null;
            state.maxPayloadT = preset.maxPayloadT != null ? preset.maxPayloadT : null;
            state.maxGrossT = preset.maxGrossT != null ? preset.maxGrossT : null;
            if (!state.weightUserSet) {
                state.weight = calibratedWeight(presetId, preset.L, preset.W, preset.H) || preset.weight;
            }
            setDimAndCoG({
                L: preset.L, W: preset.W, H: preset.H,
                weight: state.weight,
                cogX: preset.cogX != null ? preset.cogX : state.cogX,
                cogY: preset.cogY != null ? preset.cogY : state.cogY,
                cogZ: preset.cogZ != null ? preset.cogZ : state.cogZ
            });
            // Keep main library card highlight in sync
            document.querySelectorAll('#cargo-library .card-btn').forEach(card => {
                card.classList.toggle('active', card.dataset.cargo === presetId);
            });
            if (typeof syncOogCargoUI === 'function') syncOogCargoUI(true);
            // Linked direct STS: match spreader to this ISO box. Cable/unlinked: keep ngáng.
            {
                const indep = (typeof stsSpreaderSizeIndependent === 'function')
                    ? stsSpreaderSizeIndependent()
                    : (state.stsSizeLinked === false || (state.stsAttachMode || 'direct') === 'cable');
                if (state.beamType === 'container_spreader' && !state.stsTwinLift && !indep
                    && typeof resolveStsFitToCargo === 'function'
                    && typeof applyStsSpreaderSize === 'function') {
                    resolveStsFitToCargo();
                    applyStsSpreaderSize(state.stsSizeFt || 40, { skipCargo: true });
                } else if (typeof updateStsBeamDimUI === 'function') {
                    updateStsBeamDimUI();
                }
            }
            if (typeof autoSizeGearForLoad === 'function') {
                autoSizeGearForLoad(state.weight, { betaWorstDeg: 40 });
            }
            rebuildCargoAndRig(true);
            if (typeof draw2DFootprintMap === 'function') draw2DFootprintMap();
            refreshGearLive();
            renderGearFields();
        }

        function toggleOogHasCargoFromEditor() {
            state.oogHasCargo = !state.oogHasCargo;
            if (!state.weightUserSet) {
                const tare = state.tareT != null ? state.tareT
                    : ((state.cargoType === 'flatrack' || state.cargoType === 'flatrack20') ? 4.8
                        : ((state.cargoType === 'platform' || state.cargoType === 'platform20') ? 5.5 : 2.4));
                const loadedW = (typeof calibratedWeight === 'function')
                    ? (calibratedWeight(state.cargoType, state.L, state.W, state.H) || 20)
                    : 20;
                const evenW = Math.max(2, Math.round(loadedW / 2) * 2);
                const evenTare = Math.max(2, Math.round((Number(tare) || 2) / 2) * 2);
                state.weight = state.oogHasCargo ? evenW : evenTare;
                setDimAndCoG({
                    L: state.L, W: state.W, H: state.H, weight: state.weight,
                    cogX: state.cogX, cogY: state.cogY, cogZ: state.cogZ
                });
                if (typeof autoSizeGearForLoad === 'function') {
                    autoSizeGearForLoad(state.weight, { betaWorstDeg: 40 });
                }
            }
            if (typeof syncOogCargoUI === 'function') syncOogCargoUI(false);
            rebuildCargoAndRig(false);
            refreshGearLive();
            renderGearFields();
        }

        function applyOogFieldFromEditor(key, value) {
            state[key] = value;
            if (isDeckOogCargo()) {
                if (typeof resolveDeckOogGeometry === 'function') {
                    const g = resolveDeckOogGeometry(state.L, state.W, state.H);
                    if (typeof applyCombinedOogCoGDefault === 'function') {
                        applyCombinedOogCoGDefault(state.L, state.W, state.H, g);
                    }
                }
                if (typeof syncCoGSlidersFromState === 'function') syncCoGSlidersFromState();
            }
            if (typeof syncOogCargoUI === 'function') syncOogCargoUI(false);
            rebuildCargoAndRig(false);
            if (typeof draw2DFootprintMap === 'function') draw2DFootprintMap();
            refreshGearLive();
        }

        function applyCargoDimFromEditor(partial) {
            const c = gearRecord({ kind: 'cargo' }) || {};
            // ISO boxes: never free-drag outer L/W/H — only weight / CoG / tare / OOG fields
            if (cargoIsoFamily() && (partial.L != null || partial.W != null || partial.H != null)) {
                delete partial.L;
                delete partial.W;
                delete partial.H;
            }
            Object.assign(c, partial);
            state.gear.cargo = c;
            if (partial.weight != null) state.weightUserSet = true;
            if (partial.tareT !== undefined) state.tareT = partial.tareT;
            setDimAndCoG({
                L: c.L != null ? c.L : state.L,
                W: c.W != null ? c.W : state.W,
                H: c.H != null ? c.H : state.H,
                weight: c.weight != null ? c.weight : state.weight,
                cogX: c.cogX != null ? c.cogX : state.cogX,
                cogY: c.cogY != null ? c.cogY : state.cogY,
                cogZ: c.cogZ != null ? c.cogZ : state.cogZ
            });
            rebuildCargoAndRig(partial.L != null || partial.W != null || partial.H != null);
            if (typeof draw2DFootprintMap === 'function') draw2DFootprintMap();
            refreshGearLive();
        }

        function bindGearCogMapCanvas(canvas) {
            if (!canvas || canvas.dataset.boundCog === '1') return;
            canvas.dataset.boundCog = '1';
            let dragging = false;
            const applyFromEvent = (ev) => {
                const rect = canvas.getBoundingClientRect();
                const mx = ((ev.clientX - rect.left) / Math.max(1, rect.width)) * canvas.width;
                const mz = ((ev.clientY - rect.top) / Math.max(1, rect.height)) * canvas.height;
                const L = Math.max(0.5, state.L || 1);
                const W = Math.max(0.5, state.W || 1);
                const scaleX = (canvas.width - 20) / L;
                const scaleZ = (canvas.height - 18) / W;
                const sc = Math.min(scaleX, scaleZ);
                const cx = canvas.width / 2;
                const cz = canvas.height / 2;
                const cogX = THREE.MathUtils.clamp((mx - cx) / sc, -L * 0.45, L * 0.45);
                const cogZ = THREE.MathUtils.clamp((mz - cz) / sc, -W * 0.45, W * 0.45);
                applyCargoDimFromEditor({ cogX, cogZ });
                if (typeof syncCoGSlidersFromState === 'function') syncCoGSlidersFromState();
                const vx = canvas.parentElement && canvas.parentElement.querySelector('[data-gear-cog="X"]');
                const vz = canvas.parentElement && canvas.parentElement.querySelector('[data-gear-cog="Z"]');
                // Live spans refreshed via render only when needed — update nearby rows if present
                const panel = document.getElementById('gear-editor-fields');
                if (panel) {
                    panel.querySelectorAll('[data-gear-cog-key]').forEach(el => {
                        const key = el.getAttribute('data-gear-cog-key');
                        if (key === 'cogX') el.dispatchEvent(new CustomEvent('gear-sync', { detail: state.cogX }));
                        if (key === 'cogZ') el.dispatchEvent(new CustomEvent('gear-sync', { detail: state.cogZ }));
                    });
                }
                void vx; void vz;
            };
            canvas.addEventListener('pointerdown', (ev) => {
                dragging = true;
                try { canvas.setPointerCapture(ev.pointerId); } catch (_) { /* ignore */ }
                applyFromEvent(ev);
            });
            canvas.addEventListener('pointermove', (ev) => { if (dragging) applyFromEvent(ev); });
            const end = () => { dragging = false; };
            canvas.addEventListener('pointerup', end);
            canvas.addEventListener('pointercancel', end);
        }

        function renderCargoInspector(box) {
            try {
                renderCargoInspectorBody(box);
            } catch (err) {
                console.error('[renderCargoInspector]', err);
                const fallback = document.createElement('div');
                fallback.className = 'text-[10px] text-rose-300 bg-rose-950/40 border border-rose-700/50 rounded p-2';
                fallback.textContent = 'Không tải được form chỉnh kiện — xem console. Thử chọn lại kiện hàng.';
                box.appendChild(fallback);
            }
        }

        function renderCargoInspectorBody(box) {
            const c = gearRecord({ kind: 'cargo' }) || {};
            // Never shadow i18n helper L() with dimension locals — that emptied this panel.
            const dimL = state.L;
            const dimW = state.W;
            const dimH = state.H;
            const weight = state.weight;
            const isoFam = cargoIsoFamily();
            const siblings = isoSiblingPresets(state.cargoType);
            const oogCapable = isOogCapableCargo();
            const deckOog = isDeckOogCargo();
            const isOpenTop = state.cargoType === 'opentop' || state.cargoType === 'opentop40';
            const hasDeckCargo = state.oogHasCargo !== false;
            const cat = (typeof libraryCatalog !== 'undefined' && libraryCatalog.cargo) ? libraryCatalog.cargo : [];
            const preset = cat.find(item => item.id === state.cargoType);
            const tareVal = state.tareT != null ? state.tareT
                : (preset && preset.tareT != null ? preset.tareT : Math.max(0.5, weight * 0.12));

            // --- A. Container / ISO frame ---
            const frameSec = document.createElement('div');
            frameSec.className = 'bg-slate-900/70 p-2 rounded-lg border border-sky-500/30 space-y-1.5';
            const frameHead = document.createElement('div');
            frameHead.className = 'flex items-center justify-between gap-1';
            frameHead.innerHTML = `
                <span class="text-[10px] font-bold text-sky-300 uppercase tracking-wide">${isoFam ? 'Khung container ISO' : 'Kích thước kiện'}</span>
                <span class="text-[9px] font-mono font-bold px-1.5 py-0.5 rounded bg-sky-500/15 text-sky-300 border border-sky-500/40">${preset && preset.isoCode ? ('ISO ' + preset.isoCode) : (isoFam ? 'ISO 668' : 'FREE')}</span>
            `;
            frameSec.appendChild(frameHead);

            if (isoFam && siblings.length) {
                const hint = document.createElement('div');
                hint.className = 'text-[9px] text-slate-400 leading-snug';
                hint.textContent = L(
                    'Outer box follows world ISO sizes (ISO 668 / 1496). Pick a standard — L×W×H are locked.',
                    'Khung ngoài theo chuẩn ISO thế giới (ISO 668 / 1496). Chọn cỡ chuẩn — L×W×H bị khóa.'
                );
                frameSec.appendChild(hint);

                const chips = document.createElement('div');
                chips.className = 'flex flex-wrap gap-1';
                siblings.forEach(p => {
                    const btn = document.createElement('button');
                    btn.type = 'button';
                    const active = p.id === state.cargoType;
                    btn.className = active
                        ? 'text-[9px] font-bold px-1.5 py-0.5 rounded bg-sky-600 text-white border border-sky-400'
                        : 'text-[9px] font-medium px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-600 hover:bg-slate-700';
                    btn.textContent = shortIsoChipLabel(p);
                    btn.title = `${p.name}\n${p.L}×${p.W}×${p.H} m`;
                    btn.addEventListener('click', () => applyIsoCargoPresetFromEditor(p.id));
                    chips.appendChild(btn);
                });
                frameSec.appendChild(chips);

                const readouts = document.createElement('div');
                readouts.className = 'grid grid-cols-3 gap-1 text-[10px] font-mono';
                [
                    ['L', dimL, 'm'],
                    ['W', dimW, 'm'],
                    ['H', dimH, 'm']
                ].forEach(([lab, val, u]) => {
                    const cell = document.createElement('div');
                    cell.className = 'bg-slate-950/70 rounded border border-slate-800 px-1.5 py-1 text-center';
                    cell.innerHTML = `<div class="text-[8px] text-slate-400 uppercase">${lab}</div><div class="text-sky-200 font-bold">${Number(val).toFixed(3)} ${u}</div>`;
                    readouts.appendChild(cell);
                });
                frameSec.appendChild(readouts);
            } else {
                // Freeform OOG / vessel / machinery
                [
                    { key: 'L', label: 'Chiều dài (L)', value: dimL, min: 0.5, max: 30, step: 0.05, unit: 'm', accent: 'sky', decimals: 2 },
                    { key: 'W', label: 'Chiều rộng (W)', value: dimW, min: 0.4, max: 12, step: 0.05, unit: 'm', accent: 'sky', decimals: 2 },
                    { key: 'H', label: 'Chiều cao (H)', value: dimH, min: 0.2, max: 12, step: 0.05, unit: 'm', accent: 'sky', decimals: 2 }
                ].forEach(def => {
                    const row = createSliderRow({
                        ...def,
                        onInput: (v) => applyCargoDimFromEditor({ [def.key]: v }),
                        onChange: (v) => applyCargoDimFromEditor({ [def.key]: v })
                    });
                    frameSec.appendChild(row.wrap);
                });
            }

            const weightRow = createSliderRow({
                label: 'Tổng trọng lượng (Gross)',
                value: weight,
                min: 0.5, max: 500, step: 0.5, decimals: 1, unit: ' t', accent: 'amber',
                onInput: (v) => applyCargoDimFromEditor({ weight: v }),
                onChange: (v) => applyCargoDimFromEditor({ weight: v })
            });
            frameSec.appendChild(weightRow.wrap);

            const tareRow = createSliderRow({
                label: 'Tare (khung rỗng)',
                value: tareVal,
                min: 0, max: 80, step: 0.1, decimals: 2, unit: ' t', accent: 'emerald',
                onInput: (v) => applyCargoDimFromEditor({ tareT: v }),
                onChange: (v) => applyCargoDimFromEditor({ tareT: v })
            });
            frameSec.appendChild(tareRow.wrap);
            box.appendChild(frameSec);

            // --- B. Cargo on container (Flat Rack / Open Top / Platform) ---
            if (oogCapable) {
                const oogSec = document.createElement('div');
                oogSec.className = 'bg-slate-900/70 p-2 rounded-lg border border-amber-500/35 space-y-1.5 mt-1.5';
                const oogHead = document.createElement('div');
                oogHead.className = 'flex items-center justify-between gap-1';
                oogHead.innerHTML = `
                    <span class="text-[10px] font-bold text-amber-300 uppercase tracking-wide">Kiện hàng trên cont</span>
                    <span class="text-[9px] font-mono font-bold px-1.5 py-0.5 rounded ${hasDeckCargo ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40' : 'bg-slate-700 text-slate-300 border border-slate-500'}">${hasDeckCargo ? 'OOG / LOADED' : 'EMPTY TARE'}</span>
                `;
                oogSec.appendChild(oogHead);

                const togRow = document.createElement('div');
                togRow.className = 'flex gap-1';
                const btnCargo = document.createElement('button');
                btnCargo.type = 'button';
                btnCargo.className = hasDeckCargo
                    ? 'flex-1 py-1 px-2 rounded text-[10px] font-bold bg-emerald-600 text-white border border-emerald-400 shadow'
                    : 'flex-1 py-1 px-2 rounded text-[10px] font-bold bg-slate-800 text-slate-300 border border-slate-600';
                btnCargo.textContent = hasDeckCargo
                    ? L('📦 Cargo on deck: ON', '📦 Có hàng trên cont: BẬT')
                    : L('📦 Empty frame (tare)', '📦 Không hàng (rỗng)');
                btnCargo.addEventListener('click', toggleOogHasCargoFromEditor);
                togRow.appendChild(btnCargo);

                if (isOpenTop) {
                    const btnTarp = document.createElement('button');
                    btnTarp.type = 'button';
                    btnTarp.className = state.oogTarp
                        ? 'flex-1 py-1 px-2 rounded text-[10px] font-bold bg-sky-600 text-white border border-sky-400 shadow'
                        : 'flex-1 py-1 px-2 rounded text-[10px] font-bold bg-slate-800 text-slate-300 border border-slate-600';
                    btnTarp.textContent = state.oogTarp
                        ? L('⛺ Tarpaulin: ON', '⛺ Phủ bạt: BẬT')
                        : L('⛺ Tarpaulin: OFF', '⛺ Phủ bạt: TẮT');
                    btnTarp.addEventListener('click', () => {
                        state.oogTarp = !state.oogTarp;
                        if (typeof syncOogCargoUI === 'function') syncOogCargoUI(false);
                        rebuildCargoAndRig(false);
                        renderGearFields();
                    });
                    togRow.appendChild(btnTarp);
                }
                oogSec.appendChild(togRow);

                if (hasDeckCargo) {
                    const subHint = document.createElement('div');
                    subHint.className = 'text-[9px] text-slate-400 leading-snug';
                    if (deckOog) {
                        subHint.textContent = L(
                            'Cargo size vs ISO frame: + over-gauge (OOG), − inset. Frame L×W×H stay ISO.',
                            'Kích thước kiện so với khung ISO: + quá khổ (OOG), − thụt vào. Khung L×W×H giữ ISO.'
                        );
                        oogSec.appendChild(subHint);

                        const isFlat = state.cargoType === 'flatrack' || state.cargoType === 'flatrack20';
                        const minCrate = 0.50;
                        const maxInsetL = Math.max(0.15, (state.L - minCrate) * 0.5);
                        const maxInsetW = Math.max(0.15, (state.W - minCrate) * 0.5);
                        const deltaDefs = [
                            { key: 'oogOh', label: 'OH — so với nóc/sàn', min: -2, max: 4, accent: 'amber' },
                            { key: 'oogOwL', label: 'OW trái (−Z)', min: -maxInsetW, max: isFlat ? 2.5 : 0.40, accent: 'sky' },
                            { key: 'oogOwR', label: 'OW phải (+Z)', min: -maxInsetW, max: isFlat ? 2.5 : 0.40, accent: 'sky' },
                            { key: 'oogOlF', label: isFlat ? 'ΔL trước (≥40cm cánh)' : 'OL trước (+X)', min: -maxInsetL, max: isFlat ? -0.40 : 4, accent: 'emerald' },
                            { key: 'oogOlR', label: isFlat ? 'ΔL sau (≥40cm cánh)' : 'OL sau (−X)', min: -maxInsetL, max: isFlat ? -0.40 : 4, accent: 'emerald' }
                        ];
                        deltaDefs.forEach(def => {
                            const row = createSliderRow({
                                label: def.label,
                                value: Number(state[def.key]) || 0,
                                min: def.min, max: def.max, step: 0.05, decimals: 2, unit: ' m',
                                accent: def.accent,
                                onInput: (v) => applyOogFieldFromEditor(def.key, v),
                                onChange: (v) => applyOogFieldFromEditor(def.key, v)
                            });
                            oogSec.appendChild(row.wrap);
                        });

                        if (typeof resolveDeckOogGeometry === 'function') {
                            const geom = resolveDeckOogGeometry(state.L, state.W, state.H);
                            if (geom) {
                                const derived = document.createElement('div');
                                derived.className = 'text-[9px] font-mono text-slate-400 bg-slate-950/50 px-1.5 py-1 rounded border border-slate-800';
                                const crateFormatter = (typeof window !== 'undefined' && window.SafeLift && window.SafeLift.i18n)
                                    ? window.SafeLift.i18n.formatCargoCrateLabel
                                    : null;
                                derived.textContent = typeof crateFormatter === 'function'
                                    ? crateFormatter({ lang: state.lang, geom })
                                    : L(
                                        `Cargo crate ${geom.cL.toFixed(2)}×${geom.cW.toFixed(2)}×${geom.cH.toFixed(2)} m`,
                                        `Kiện quy đổi ${geom.cL.toFixed(2)}×${geom.cW.toFixed(2)}×${geom.cH.toFixed(2)} m`
                                    );
                                oogSec.appendChild(derived);
                            }
                        }
                    } else {
                        // Open Top absolute cargo dims inside bay
                        subHint.textContent = L(
                            'Cargo inside Open Top bay (absolute). Container outer size stays ISO.',
                            'Kiện trong hầm Open Top (kích thước tuyệt đối). Khung ngoài vẫn ISO.'
                        );
                        oogSec.appendChild(subHint);
                        const fitN = state.L > 9 ? 3 : 2;
                        const maxDiaByL = (state.L - 0.44 - 0.08 * (fitN - 1)) / fitN;
                        [
                            { key: 'oogCargoH', label: 'Cao hàng (Ø)', min: 0.8, max: Math.max(state.H * 1.35, maxDiaByL), accent: 'amber' },
                            { key: 'oogCargoW', label: 'Rộng hàng', min: 0.5, max: Math.max(0.85, state.W - 0.40), accent: 'sky' },
                            { key: 'oogCargoL', label: 'Dài hàng', min: 1.0, max: Math.max(1.5, state.L - 0.40), accent: 'emerald' }
                        ].forEach(def => {
                            const row = createSliderRow({
                                label: def.label,
                                value: Number(state[def.key]) || def.min,
                                min: def.min, max: def.max, step: 0.05, decimals: 2, unit: ' m',
                                accent: def.accent,
                                onInput: (v) => applyOogFieldFromEditor(def.key, v),
                                onChange: (v) => applyOogFieldFromEditor(def.key, v)
                            });
                            oogSec.appendChild(row.wrap);
                        });
                    }
                } else {
                    const emptyNote = document.createElement('div');
                    emptyNote.className = 'text-[9px] text-slate-400 bg-slate-950/40 px-1.5 py-1 rounded border border-slate-800';
                    emptyNote.textContent = L(
                        'Empty container — only tare / frame. Turn cargo ON to size the load on deck.',
                        'Cont rỗng — chỉ tare/khung. Bật hàng để chỉnh kích thước kiện trên sàn.'
                    );
                    oogSec.appendChild(emptyNote);
                }
                box.appendChild(oogSec);
            }

            // --- C. CoG (same as main §1.3) ---
            const cogSec = document.createElement('div');
            cogSec.className = 'gear-cog-block mt-1.5';
            const cogHead = document.createElement('div');
            cogHead.className = 'flex items-center justify-between mb-1';
            cogHead.innerHTML = `
                <span class="text-[10px] font-bold text-yellow-400 uppercase tracking-wide">Trọng tâm CoG</span>
                <button type="button" class="text-[9px] bg-slate-800 hover:bg-slate-700 text-slate-200 px-1.5 py-0.5 rounded border border-slate-600" data-gear-reset-cog>Đưa về tâm 0</button>
            `;
            cogSec.appendChild(cogHead);

            const cogBody = document.createElement('div');
            cogBody.className = 'flex gap-2 items-start';
            const mapCol = document.createElement('div');
            mapCol.className = 'flex flex-col items-center flex-none';
            const mapCanvas = document.createElement('canvas');
            mapCanvas.id = 'gear-cog-map-canvas';
            mapCanvas.width = 88;
            mapCanvas.height = 64;
            mapCanvas.className = 'rounded border border-slate-700 bg-slate-950 cursor-crosshair';
            mapCanvas.title = 'Kéo để đặt CoG trên mặt bằng';
            mapCol.appendChild(mapCanvas);
            const mapLbl = document.createElement('span');
            mapLbl.className = 'text-[8px] text-slate-400 mt-0.5';
            mapLbl.textContent = 'Mặt bằng LP & CoG';
            mapCol.appendChild(mapLbl);
            cogBody.appendChild(mapCol);

            const sliderCol = document.createElement('div');
            sliderCol.className = 'flex-1 space-y-1 min-w-0';
            const halfL = Math.max(0.5, dimL * 0.45);
            const halfW = Math.max(0.4, dimW * 0.45);
            [
                { key: 'cogX', label: 'Lệch dọc X (eX)', value: state.cogX, min: -halfL, max: halfL },
                { key: 'cogZ', label: 'Lệch ngang Z (eZ)', value: state.cogZ, min: -halfW, max: halfW },
                { key: 'cogY', label: 'Độ cao CoG (eY)', value: state.cogY, min: -1.0, max: Math.max(1.5, dimH * 0.55) }
            ].forEach(def => {
                const row = createSliderRow({
                    ...def,
                    step: 0.05, decimals: 2, unit: 'm', accent: 'yellow', showNumber: true,
                    onInput: (v) => {
                        applyCargoDimFromEditor({ [def.key]: v });
                        if (typeof syncCoGSlidersFromState === 'function') syncCoGSlidersFromState();
                    },
                    onChange: (v) => {
                        applyCargoDimFromEditor({ [def.key]: v });
                        if (typeof syncCoGSlidersFromState === 'function') syncCoGSlidersFromState();
                    }
                });
                row.wrap.setAttribute('data-gear-cog-key', def.key);
                row.wrap.addEventListener('gear-sync', (e) => row.setValue(e.detail));
                sliderCol.appendChild(row.wrap);
            });
            cogBody.appendChild(sliderCol);
            cogSec.appendChild(cogBody);

            const tip = document.createElement('div');
            tip.className = 'text-[9px] text-yellow-300/90 bg-yellow-500/10 px-1.5 py-1 rounded border border-yellow-500/20 mt-1.5';
            tip.innerHTML = isoFam
                ? '💡 Khung ISO cố định · chỉnh kiện trên cont / CoG · đồng bộ bảng chính.'
                : '💡 Kéo quả cầu <b>CoG</b> trên 3D hoặc thanh kéo — đồng bộ bảng chính.';
            cogSec.appendChild(tip);

            cogHead.querySelector('[data-gear-reset-cog]').addEventListener('click', () => {
                applyCargoDimFromEditor({ cogX: 0, cogY: 0, cogZ: 0 });
                if (typeof syncCoGSlidersFromState === 'function') syncCoGSlidersFromState();
                renderGearFields();
            });

            box.appendChild(cogSec);
            bindGearCogMapCanvas(mapCanvas);
            if (typeof draw2DFootprintMap === 'function') draw2DFootprintMap();
            else if (typeof draw2DFootprintMapOn === 'function') draw2DFootprintMapOn(mapCanvas);
        }

        function createAutoField({ label, unit = '', isAuto, value, autoValue, decimals = 1, onManualChange, onResetAuto }) {
            const wrap = document.createElement('div');
            wrap.className = 'flex flex-col gap-0.5';

            const top = document.createElement('div');
            top.className = 'flex items-center justify-between text-[10px] font-medium text-slate-300';
            top.innerHTML = `<span>${label}${unit ? ` (${unit})` : ''}:</span>`;

            if (isAuto) {
                const autoBadge = document.createElement('span');
                autoBadge.className = 'text-[9px] px-1.5 py-0.2 rounded bg-emerald-950 text-emerald-400 border border-emerald-600/40 font-mono font-bold leading-tight';
                autoBadge.textContent = 'Auto';
                autoBadge.title = 'Tự động tính toán theo tiêu chuẩn quốc tế ASME / EN';
                top.appendChild(autoBadge);
            } else {
                const resetBtn = document.createElement('button');
                resetBtn.type = 'button';
                resetBtn.className = 'text-[9px] px-1.5 py-0.2 rounded bg-amber-950/80 hover:bg-amber-900 text-amber-300 border border-amber-600/40 font-mono font-semibold transition-colors flex items-center gap-0.5';
                resetBtn.innerHTML = '<span>↺</span><span>Auto</span>';
                resetBtn.title = 'Khôi phục tính tự động theo tiêu chuẩn';
                resetBtn.addEventListener('click', onResetAuto);
                top.appendChild(resetBtn);
            }

            const input = document.createElement('input');
            input.type = 'number';
            input.step = decimals === 2 ? '0.01' : '0.1';
            input.className = `w-full bg-slate-900 border ${isAuto ? 'border-slate-700 text-emerald-300' : 'border-amber-600/60 text-amber-200'} rounded px-2 py-0.5 text-right font-mono text-[11px] focus:outline-none focus:border-sky-400`;
            input.value = Number(isAuto ? autoValue : value).toFixed(decimals);

            input.addEventListener('change', () => {
                const v = parseFloat(input.value);
                if (!isFinite(v)) return;
                onManualChange(v);
            });

            wrap.appendChild(top);
            wrap.appendChild(input);
            return { wrap, input };
        }

        function renderSlingInspector(box, sel) {
            const isImp = state.unitSystem === 'imperial';
            const primary = sel[0];
            const rec = gearRecord(primary) || {};
            const cable = (phy.cables || []).find(c => c.role === primary.role && c.index === primary.index);
            const activeL0 = cable ? cable.L0 : (rec.lengthM != null ? rec.lengthM : (primary.role === 'upper' ? (state.upperSlingLength || 4.0) : (state.slingLength || 3.0)));
            const spanNow = cable ? attachWorld(cable.a).distanceTo(attachWorld(cable.b)) : activeL0;

            const resolver = (typeof CAE !== 'undefined' && CAE.resolveSling)
                || (typeof window !== 'undefined' && window.CAE && window.CAE.resolveSling);
            const slingSpec = resolver ? resolver(rec, { globalType: state.slingType, lengthMFallback: activeL0 }) : null;

            const curType = slingSpec ? slingSpec.slingType : (rec.slingType || state.slingType || 'wire');
            const curGrade = slingSpec ? slingSpec.grade : (rec.grade || (curType === 'chain' ? 'g80' : 'iwrc_1960'));
            const curParts = slingSpec ? slingSpec.parts : Math.max(1, Math.min(4, rec.parts || 1));
            const curDia = slingSpec ? slingSpec.diameterMm : (rec.diaMm || (curType === 'web' ? 60 : (curType === 'round_sling' ? 40 : (curType === 'chain' ? 16 : 22))));
            const curSf = slingSpec ? slingSpec.sf : (rec.sf || (curType === 'chain' ? 4 : (curType === 'web' || curType === 'round_sling' ? 7 : 5)));
            const minStdSf = slingSpec ? slingSpec.minStdSf : (curType === 'chain' ? 4 : (curType === 'web' || curType === 'round_sling' ? 7 : 5));

            const isAutoSwl = rec.swlT == null;
            const autoSwlVal = slingSpec ? slingSpec.autoSwlT : calculateAutoSlingSWL(rec);
            const displaySwl = isAutoSwl ? autoSwlVal : rec.swlT;

            const isAutoMass = rec.massKg == null;
            const autoMassVal = slingSpec ? slingSpec.autoMassKg : calculateAutoSlingMass(rec, activeL0);
            const displayMass = isAutoMass ? autoMassVal : rec.massKg;

            const mbl = (slingSpec && isAutoSwl) ? slingSpec.mblT : (displaySwl * curSf);
            const EA = slingSpec ? (slingSpec.EA_MN * 1e6) : (100e9 * Math.PI * (curDia / 1000) * (curDia / 1000) * 0.25 * 0.52 * curParts);

            // --- 1. CHỦNG LOẠI & TIÊU CHUẨN VẬT LIỆU ---
            const sec1 = document.createElement('div');
            sec1.className = 'bg-slate-900/60 p-2 rounded-lg border border-slate-800/80 flex flex-col gap-1.5';

            const sec1Header = document.createElement('div');
            sec1Header.className = 'flex items-center justify-between text-[11px] font-bold text-sky-300';
            sec1Header.innerHTML = `<span>1. Quy Cách & Chủng Loại Cáp</span><span class="text-[9px] font-mono text-emerald-400 font-bold">${slingSpec ? slingSpec.label : 'EN / ASME B30.9'}</span>`;
            sec1.appendChild(sec1Header);

            const grid1 = document.createElement('div');
            grid1.className = 'grid grid-cols-2 gap-2 text-[10px]';

            // 1.1 Loại cáp
            const typeCol = document.createElement('div');
            typeCol.className = 'flex flex-col gap-0.5';
            typeCol.innerHTML = '<span class="text-slate-300 font-medium">Chủng loại dây cẩu:</span>';
            const typeSelect = document.createElement('select');
            typeSelect.className = 'w-full bg-slate-900 border border-slate-700 hover:border-sky-500 rounded px-1.5 py-1 text-[11px] text-sky-200 font-semibold focus:outline-none focus:border-sky-400';
            [
                ['chain', '⛓️ Xích cẩu (Alloy Chain · G80/G100/G120)'],
                ['wire', '🔩 Cáp thép (Wire Rope · IWRC/FC)'],
                ['web', '🎗️ Cáp bẹ dẹt (Webbing · EN 1492-1)'],
                ['round_sling', '⭕ Cáp vải tròn (Round · EN 1492-2)'],
                ['grommet', '🔄 Cáp vòng kín (Grommet IMCA)']
            ].forEach(([val, label]) => {
                const opt = document.createElement('option');
                opt.value = val;
                opt.textContent = label;
                if (curType === val) opt.selected = true;
                typeSelect.appendChild(opt);
            });
            typeSelect.addEventListener('change', () => {
                const newType = typeSelect.value;
                sel.forEach(s => {
                    const r = gearRecord(s);
                    if (!r) return;
                    r.slingType = newType;
                    r.slingTypeUserSet = true;
                    r.swlT = null;
                    r.massKg = null;
                    if (newType === 'chain') {
                        r.grade = 'g80';
                        r.sf = 4;
                        if (!r.diaMm || r.diaMm > 36 || r.diaMm < 10) r.diaMm = 16;
                    } else if (newType === 'wire') {
                        r.grade = 'iwrc_1960';
                        r.sf = 5;
                        if (!r.diaMm || r.diaMm > 52 || r.diaMm < 12) r.diaMm = 22;
                    } else if (newType === 'web') {
                        r.grade = 'poly';
                        r.sf = 7;
                        if (!r.diaMm || r.diaMm < 30) r.diaMm = 60;
                    } else if (newType === 'round_sling') {
                        r.grade = 'poly';
                        r.sf = 7;
                        if (!r.diaMm || r.diaMm < 25) r.diaMm = 40;
                    } else if (newType === 'grommet') {
                        r.grade = 'iwrc_1960';
                        r.sf = 5;
                        if (!r.diaMm || r.diaMm < 14) r.diaMm = 22;
                    }
                });
                computeRiggingMassBreakdown();
                scheduleRebuildSpreaderVisuals();
                renderGearFields();
            });
            typeCol.appendChild(typeSelect);
            grid1.appendChild(typeCol);

            // 1.2 Cấp bền / Lõi (Grade)
            const gradeCol = document.createElement('div');
            gradeCol.className = 'flex flex-col gap-0.5';
            gradeCol.innerHTML = '<span class="text-slate-300 font-medium">Cấp bền / Tiêu chuẩn:</span>';
            const gradeSelect = document.createElement('select');
            gradeSelect.className = 'w-full bg-slate-900 border border-slate-700 hover:border-sky-500 rounded px-1.5 py-1 text-[11px] text-sky-200 focus:outline-none focus:border-sky-400';
            let gradeOptions = [];
            if (curType === 'chain') {
                gradeOptions = [
                    ['g80', 'Grade 80 · EN 818-2 · SF 4:1'],
                    ['g100', 'Grade 100 · Siêu cường (+25% WLL)'],
                    ['g120', 'Grade 120 · Cường lực (+50% WLL)']
                ];
            } else if (curType === 'web') {
                gradeOptions = [
                    ['poly', 'Polyester PES · EN 1492-1 · SF 7:1'],
                    ['hmpe', 'HMPE Dyneema siêu chịu tải']
                ];
            } else if (curType === 'round_sling') {
                gradeOptions = [
                    ['poly', 'Polyester Core · EN 1492-2 · SF 7:1'],
                    ['hmpe', 'HMPE Dyneema Core · Siêu nhẹ']
                ];
            } else if (curType === 'grommet') {
                gradeOptions = [
                    ['iwrc_1960', 'IWRC 1960 N/mm² · IMCA M179'],
                    ['iwrc_2160', 'IWRC 2160 N/mm² · Siêu cường']
                ];
            } else {
                gradeOptions = [
                    ['iwrc_1960', 'IWRC 1960 N/mm² · Lõi thép'],
                    ['iwrc_2160', 'IWRC 2160 N/mm² · Cường độ cao'],
                    ['fc_1770', 'Fiber Core (FC) 1770 N/mm² · Lõi đay']
                ];
            }
            gradeOptions.forEach(([val, label]) => {
                const opt = document.createElement('option');
                opt.value = val;
                opt.textContent = label;
                const matches = (curGrade === val)
                    || (val.startsWith('iwrc') && String(curGrade).startsWith('iwrc'))
                    || (val.startsWith('fc') && String(curGrade).startsWith('fc'));
                if (matches) opt.selected = true;
                gradeSelect.appendChild(opt);
            });
            gradeSelect.addEventListener('change', () => {
                sel.forEach(s => {
                    const r = gearRecord(s);
                    if (r) {
                        r.grade = gradeSelect.value;
                        r.swlT = null; // Auto recalibrate
                        r.massKg = null;
                    }
                });
                computeRiggingMassBreakdown();
                scheduleRebuildSpreaderVisuals();
                renderGearFields();
            });
            gradeCol.appendChild(gradeSelect);
            grid1.appendChild(gradeCol);

            // 1.3 Số sợi ghép / chập (Parts)
            const partsCol = document.createElement('div');
            partsCol.className = 'flex flex-col gap-0.5';
            partsCol.innerHTML = '<span class="text-slate-300 font-medium">Số sợi chập (Parts):</span>';
            const partsSelect = document.createElement('select');
            partsSelect.className = 'w-full bg-slate-900 border border-slate-700 hover:border-sky-500 rounded px-1.5 py-1 text-[11px] text-sky-200 font-mono focus:outline-none focus:border-sky-400';
            [
                [1, '1 sợi (Đơn - Single)'],
                [2, '2 sợi (Chập đôi - 2-Part)'],
                [3, '3 sợi (Chập 3 - 3-Part)'],
                [4, '4 sợi (Chập 4 - 4-Part)']
            ].forEach(([val, label]) => {
                const opt = document.createElement('option');
                opt.value = val;
                opt.textContent = label;
                if (curParts === val) opt.selected = true;
                partsSelect.appendChild(opt);
            });
            partsSelect.addEventListener('change', () => {
                const pVal = parseInt(partsSelect.value, 10) || 1;
                sel.forEach(s => {
                    const r = gearRecord(s);
                    if (r) {
                        r.parts = pVal;
                        r.swlT = null;
                        r.massKg = null;
                    }
                });
                computeRiggingMassBreakdown();
                scheduleRebuildSpreaderVisuals();
                renderGearFields();
            });
            partsCol.appendChild(partsSelect);
            grid1.appendChild(partsCol);

            // 1.4 Đường kính ⌀ / Bản rộng W (mm) — horizontal slider
            const diaLabel = curType === 'web' ? 'Bản rộng W' : (curType === 'round_sling' ? 'Đường kính vỏ' : 'Đường kính ⌀');
            const diaStep = (curType === 'web') ? 10 : (curType === 'round_sling' ? 5 : 2);
            const diaMin = (curType === 'web') ? 25 : (curType === 'round_sling' ? 20 : 6);
            const diaMax = (curType === 'web') ? 350 : (curType === 'round_sling' ? 150 : 90);
            const diaRow = createSliderRow({
                label: diaLabel,
                value: curDia,
                min: diaMin,
                max: diaMax,
                step: diaStep,
                decimals: 0,
                unit: ' mm',
                accent: 'sky',
                onInput: (newDia) => {
                    sel.forEach(s => {
                        const r = gearRecord(s);
                        if (r) { r.diaMm = newDia; r.swlT = null; r.massKg = null; }
                    });
                    computeRiggingMassBreakdown();
                    scheduleRebuildSpreaderVisuals();
                },
                onChange: (newDia) => {
                    sel.forEach(s => {
                        const r = gearRecord(s);
                        if (r) { r.diaMm = newDia; r.swlT = null; r.massKg = null; }
                    });
                    computeRiggingMassBreakdown();
                    scheduleRebuildSpreaderVisuals();
                    renderGearFields();
                }
            });
            grid1.appendChild(diaRow.wrap);

            sec1.appendChild(grid1);
            box.appendChild(sec1);

            // --- 2. KÍCH THƯỚC, TẢI TRỌNG & KHỐI LƯỢNG (2-COLUMN GRID) ---
            const sec2 = document.createElement('div');
            sec2.className = 'bg-slate-900/60 p-2 rounded-lg border border-slate-800/80 flex flex-col gap-1.5';

            const sec2Header = document.createElement('div');
            sec2Header.className = 'flex items-center justify-between text-[11px] font-bold text-sky-300';
            sec2Header.innerHTML = '<span>2. Kích Thước & Tải Trọng Định Mức</span><span class="text-[9px] font-mono text-emerald-400">Tự Động Tính Toán</span>';
            sec2.appendChild(sec2Header);

            const grid2 = document.createElement('div');
            grid2.className = 'space-y-1.5 text-[10px]';

            // 2.1 Chiều dài làm việc — horizontal slider (same language as main panel)
            const isManualLen = rec.lengthM != null;
            const lenDisplayVal = isImp ? (activeL0 * 3.28084) : activeL0;
            const lenUnit = isImp ? 'ft' : 'm';
            const lenStep = isImp ? 0.5 : 0.1;
            const applyInspectorCableLengths = (meters, refreshPanel) => {
                sel.forEach(s => {
                    const r = gearRecord(s);
                    if (r) {
                        r.lengthM = meters;
                        r.userSet = true;
                        r._nhomAutoLen = false;
                        r._manualLengthOverride = true;
                    }
                    if (state.heldCableL0 && s.role && state.heldCableL0[s.role]) {
                        state.heldCableL0[s.role][s.index] = null;
                    }
                });
                state.slingUserSet = true;
                if (sel.every(s => s.role === 'upper')) state.upperSlingLength = meters;
                else if (sel.every(s => s.role === 'leg')) state.lowerSlingLength = meters;
                else if (sel.every(s => s.role === 'hanger')) state.hangerSlingLength = meters;
                syncCableRest(false);
                if (state.poseLock && typeof syncHookToRigTaut === 'function') syncHookToRigTaut();
                if (typeof applyBeamVisuals === 'function') applyBeamVisuals();
                if (typeof syncCableControlsSelection === 'function') syncCableControlsSelection();
                if (typeof syncSlingSlidersFromState === 'function') syncSlingSlidersFromState();
                if (refreshPanel) {
                    computeRiggingMassBreakdown();
                    renderGearFields();
                }
            };
            const lenRow = createSliderRow({
                label: `Chiều dài làm việc${!isManualLen ? ' · Auto' : ''}`,
                value: lenDisplayVal,
                min: isImp ? 1.0 : 0.3,
                max: isImp ? 130.0 : 40.0,
                step: lenStep,
                decimals: 2,
                unit: ` ${lenUnit}`,
                accent: isManualLen ? 'amber' : 'sky',
                onInput: (newVal) => {
                    const meters = isImp ? (newVal / 3.28084) : newVal;
                    applyInspectorCableLengths(meters, false);
                },
                onChange: (newVal) => {
                    const meters = isImp ? (newVal / 3.28084) : newVal;
                    applyInspectorCableLengths(meters, true);
                }
            });
            grid2.appendChild(lenRow.wrap);

            // 2.2 SWL / WLL (t) - Auto computed number with Auto badge or reset button
            const swlCol = createAutoField({
                label: 'SWL / WLL định mức',
                unit: 't',
                isAuto: isAutoSwl,
                value: rec.swlT != null ? rec.swlT : autoSwlVal,
                autoValue: autoSwlVal,
                decimals: 2,
                onManualChange: (val) => {
                    sel.forEach(s => {
                        const r = gearRecord(s);
                        if (r) r.swlT = val;
                    });
                    computeRiggingMassBreakdown();
                    scheduleRebuildSpreaderVisuals();
                    renderGearFields();
                },
                onResetAuto: () => {
                    sel.forEach(s => {
                        const r = gearRecord(s);
                        if (r) r.swlT = null;
                    });
                    computeRiggingMassBreakdown();
                    scheduleRebuildSpreaderVisuals();
                    renderGearFields();
                }
            });
            grid2.appendChild(swlCol.wrap);

            // 2.3 Khối lượng sợi cáp (kg) - Auto computed number with Auto badge or reset button
            const massCol = createAutoField({
                label: 'Khối lượng sợi cáp',
                unit: 'kg',
                isAuto: isAutoMass,
                value: rec.massKg != null ? rec.massKg : autoMassVal,
                autoValue: autoMassVal,
                decimals: 1,
                onManualChange: (val) => {
                    sel.forEach(s => {
                        const r = gearRecord(s);
                        if (r) r.massKg = val;
                    });
                    computeRiggingMassBreakdown();
                    scheduleRebuildSpreaderVisuals();
                    renderGearFields();
                },
                onResetAuto: () => {
                    sel.forEach(s => {
                        const r = gearRecord(s);
                        if (r) r.massKg = null;
                    });
                    computeRiggingMassBreakdown();
                    scheduleRebuildSpreaderVisuals();
                    renderGearFields();
                }
            });
            grid2.appendChild(massCol.wrap);

            // 2.4 Hệ số an toàn SF (MBL/SWL)
            const sfRow = createSliderRow({
                label: 'Hệ số an toàn SF · MBL/SWL',
                value: curSf,
                min: minStdSf || 2,
                max: 15,
                step: 0.5,
                decimals: 1,
                unit: '',
                accent: 'amber',
                onInput: (newSf) => {
                    sel.forEach(s => {
                        const r = gearRecord(s);
                        if (r) { r.sf = newSf; r.swlT = null; }
                    });
                    computeRiggingMassBreakdown();
                    scheduleRebuildSpreaderVisuals();
                },
                onChange: (newSf) => {
                    sel.forEach(s => {
                        const r = gearRecord(s);
                        if (r) { r.sf = newSf; r.swlT = null; }
                    });
                    computeRiggingMassBreakdown();
                    scheduleRebuildSpreaderVisuals();
                    renderGearFields();
                }
            });
            grid2.appendChild(sfRow.wrap);

            // 2.5 (If leg): Tăng đơ ΔL (m)
            if (primary.role === 'leg') {
                const curTurn = (state.legDeltaL[primary.index] || 0);
                const turnRow = createSliderRow({
                    label: 'Tăng đơ ΔL',
                    value: curTurn,
                    min: -1.5,
                    max: 2.5,
                    step: 0.02,
                    decimals: 2,
                    unit: ' m',
                    accent: 'sky',
                    onInput: (newTurn) => {
                        const clamped = THREE.MathUtils.clamp(newTurn, -1.5, 2.5);
                        sel.forEach(s => {
                            if (s.role !== 'leg') return;
                            while (state.legDeltaL.length <= s.index) state.legDeltaL.push(0);
                            state.legDeltaL[s.index] = clamped;
                            if (state.heldCableL0 && state.heldCableL0.leg) state.heldCableL0.leg[s.index] = null;
                        });
                        syncCableRest(false);
                        if (typeof applyBeamVisuals === 'function') applyBeamVisuals();
                    },
                    onChange: (newTurn) => {
                        const clamped = THREE.MathUtils.clamp(newTurn, -1.5, 2.5);
                        sel.forEach(s => {
                            if (s.role !== 'leg') return;
                            while (state.legDeltaL.length <= s.index) state.legDeltaL.push(0);
                            state.legDeltaL[s.index] = clamped;
                            if (state.heldCableL0 && state.heldCableL0.leg) state.heldCableL0.leg[s.index] = null;
                        });
                        syncCableRest(false);
                        if (typeof applyBeamVisuals === 'function') applyBeamVisuals();
                        if (typeof syncCableControlsSelection === 'function') syncCableControlsSelection();
                    }
                });
                grid2.appendChild(turnRow.wrap);

                // 2.6 Live Hooke strain readout
                const hookeCol = document.createElement('div');
                hookeCol.className = 'flex flex-col gap-0.5';
                const deltaM = (phy.cables && phy.cables[primary.index] && phy.cables[primary.index].deltaL) || 0;
                hookeCol.innerHTML = `
                    <div class="flex items-center justify-between">
                        <span class="text-slate-300 font-medium">Độ giãn Hooke:</span>
                        <span class="text-[9px] text-emerald-400 font-mono">Đàn hồi</span>
                    </div>
                    <div class="h-6 flex items-center justify-between px-2 bg-slate-900 border border-slate-700 rounded text-[11px] font-mono text-emerald-300">
                        <span>ΔL_Hooke:</span>
                        <span class="font-bold">+${(deltaM * 1000).toFixed(1)} mm</span>
                    </div>
                `;
                grid2.appendChild(hookeCol);
            }

            sec2.appendChild(grid2);
            box.appendChild(sec2);

            // --- 3. ĐO ĐẠC THỰC ĐỊA & ĐỒNG BỘ CÙNG TẦNG ---
            const sec3 = document.createElement('div');
            sec3.className = 'bg-slate-900/60 p-2 rounded-lg border border-slate-800/80 flex flex-col gap-1.5';

            const fitNote = (cable && spanNow > cable.L0 + 0.08) ? `<span class="text-rose-400 font-bold"> · Thiếu ${(spanNow - cable.L0).toFixed(2)} m</span>` : '';
            const tele = document.createElement('div');
            tele.className = 'text-[10px] font-mono text-slate-300 flex flex-wrap gap-x-2.5 gap-y-1 bg-slate-950/80 p-1.5 rounded border border-slate-800';
            tele.innerHTML = `
                <span>Đang dùng: <b class="text-sky-300">${activeL0.toFixed(2)} m</b></span>
                <span>Khoảng cách 2 đầu: <b class="text-sky-300">${spanNow.toFixed(2)} m</b>${fitNote}</span>
                <span>MBL: <b class="text-amber-300">${mbl.toFixed(1)} t</b></span>
                <span>EA: <b class="text-emerald-300">${(EA / 1e6).toFixed(0)} MN</b></span>
                <span>Chuẩn: <b class="text-sky-200">${slingSpec ? slingSpec.standard : 'ASME B30.9'}</b></span>
            `;
            if (slingSpec && slingSpec.warnings && slingSpec.warnings.length) {
                const warnDiv = document.createElement('div');
                warnDiv.className = 'w-full text-[10px] text-amber-300 bg-amber-950/60 border border-amber-600/40 rounded p-1 mt-0.5';
                warnDiv.textContent = '⚠️ ' + slingSpec.warnings.map(w => w.message).join(' | ');
                tele.appendChild(warnDiv);
            }
            sec3.appendChild(tele);

            // Synchronize All Slings in Tier (Áp dụng cho toàn bộ cáp cùng tầng)
            const tierName = primary.role === 'upper' ? 'cáp treo dầm' : (primary.role === 'hanger' ? 'cáp treo tầng dầm' : 'cáp nhánh LP');
            const syncBtn = document.createElement('button');
            syncBtn.type = 'button';
            syncBtn.className = 'w-full text-[10px] font-bold rounded bg-sky-950 hover:bg-sky-900 border border-sky-600/50 text-sky-200 py-1 px-2 flex items-center justify-center gap-1.5 transition-colors shadow';
            syncBtn.innerHTML = `<span>⇋</span><span>Áp dụng quy cách này cho toàn bộ ${tierName}</span>`;
            syncBtn.addEventListener('click', () => {
                const src = gearRecord(primary);
                if (!src) return;
                const tierList = primary.role === 'upper' ? state.gear.uppers : (primary.role === 'hanger' ? state.gear.hangers : state.gear.legs);
                if (tierList) {
                    tierList.forEach(item => {
                        item.slingType = src.slingType;
                        item.parts = src.parts;
                        item.grade = src.grade;
                        item.diaMm = src.diaMm;
                        item.sf = src.sf;
                        item.swlT = src.swlT;
                        item.massKg = src.massKg;
                    });
                }
                computeRiggingMassBreakdown();
                scheduleRebuildSpreaderVisuals();
                renderGearFields();
                const status = document.getElementById('sim-status-text');
                if (status) status.textContent = `Đã đồng bộ quy cách cáp cho toàn bộ ${tierName}.`;
            });
            sec3.appendChild(syncBtn);
            box.appendChild(sec3);
        }

        function renderGenericGearFields(box, sel) {
            if (sel[0] && sel[0].kind === 'cargo') {
                renderCargoInspector(box);
                return;
            }

            const isImp = state.unitSystem === 'imperial';
            const form = GEAR_FORMS[sel[0].kind] || [];

            const grid = document.createElement('div');
            grid.className = 'space-y-1.5 text-[10px] bg-slate-900/60 p-2 rounded-lg border border-slate-800/80';

            form.forEach(field => {
                const values = sel.map(s => {
                    const r = gearRecord(s);
                    return r ? r[field.key] : null;
                });
                const same = values.every(v => v === values[0]);
                const isLenField = field.unit === 'm' || field.key === 'lengthM' || field.key === 'widthM' || field.key === 'depthM' || field.key === 'aM' || field.key === 'bM';
                const unitStr = isLenField ? (isImp ? 'ft' : 'm') : field.unit;
                const labelText = (field.labelKey ? bi(field.labelKey) : field.label);

                // For shackle mass, auto calculate if null!
                if (sel[0].kind === 'shackle' && field.key === 'massKg') {
                    const r = gearRecord(sel[0]);
                    const isAuto = r && r.massKg == null;
                    const swl = (r && r.swlT) || 12;
                    const autoMass = Number((0.45 + 0.24 * Math.pow(swl, 1.18)).toFixed(1));
                    const row = createSliderRow({
                        label: 'Khối lượng ma ní',
                        value: isAuto ? autoMass : (r.massKg != null ? r.massKg : autoMass),
                        min: field.min, max: field.max, step: field.step, decimals: 1,
                        unit: ' kg', accent: isAuto ? 'emerald' : 'amber',
                        placeholder: 'Auto',
                        onInput: (val) => {
                            sel.forEach(s => { const rec = gearRecord(s); if (rec) rec.massKg = val; });
                            computeRiggingMassBreakdown();
                        },
                        onChange: (val) => {
                            sel.forEach(s => { const rec = gearRecord(s); if (rec) rec.massKg = val; });
                            computeRiggingMassBreakdown();
                            renderGearFields();
                        }
                    });
                    grid.appendChild(row.wrap);
                    return;
                }

                let dispMin = field.min;
                let dispMax = field.max;
                let dispStep = field.step;
                let rawVal = same && values[0] != null ? values[0] : null;
                let dispVal = rawVal;
                if (isImp && isLenField) {
                    dispMin = field.min * 3.28084;
                    dispMax = field.max * 3.28084;
                    dispStep = Math.max(0.05, field.step * 3.28084);
                    if (dispVal != null) dispVal = dispVal * 3.2808399;
                }
                const decimals = (field.step < 0.1 || isLenField) ? 2 : (field.step < 1 ? 1 : 0);
                const accent = field.key === 'swlT' || field.key === 'massT' || field.key === 'massKg' ? 'amber' : 'sky';

                const commitDisp = (disp, refresh) => {
                    const input = document.createElement('input');
                    input.dataset.key = field.key;
                    input.dataset.nullable = field.nullable ? '1' : '0';
                    if (sel.length === 1) {
                        input.dataset.scope = '1';
                        input.dataset.kind = sel[0].kind;
                        input.dataset.role = sel[0].role || '';
                        input.dataset.index = String(sel[0].index || 0);
                        input.dataset.memberId = sel[0].memberId || '';
                    }
                    if (disp == null && field.nullable) {
                        input.value = '';
                    } else {
                        input.value = String(disp);
                    }
                    commitGearField(input, refresh !== false);
                };

                const row = createSliderRow({
                    label: labelText,
                    value: dispVal,
                    min: dispMin,
                    max: dispMax,
                    step: dispStep,
                    decimals,
                    unit: unitStr ? ` ${unitStr}` : '',
                    accent,
                    nullable: !!field.nullable,
                    placeholder: same ? bi('autoVal') : bi('mixedVal'),
                    onInput: (v) => commitDisp(v, false),
                    onChange: (v) => commitDisp(v, true)
                });
                grid.appendChild(row.wrap);
            });

            box.appendChild(grid);

            if (sel.length === 1 && (sel[0].kind === 'member' || sel[0].kind === 'beam')) appendSpreaderInspector(box);
            if (sel.length === 1 && (sel[0].kind === 'hook' || sel[0].kind === 'beam' || sel[0].kind === 'shackle' || sel[0].kind === 'member')) {
                const rec = gearRecord(sel[0]);
                const note = document.createElement('div');
                note.className = 'text-[10px] font-mono text-slate-400 leading-snug bg-slate-900/60 p-2 rounded border border-slate-800';
                if (sel[0].kind === 'shackle' && rec) {
                    note.textContent = `Crosby WLL ${rec.swlT.toFixed(1)} t · chốt ${rec.pinMm} mm · má ${rec.jawMm} mm · tự trọng ${rec.massKg != null ? rec.massKg : (0.45 + 0.24 * Math.pow(rec.swlT, 1.18)).toFixed(1)} kg · MBL ${(rec.swlT * (rec.sf || 6)).toFixed(1)} t`;
                    box.appendChild(note);
                } else if (sel[0].kind === 'hook' && rec) {
                    note.textContent = `SWL móc ${rec.swlT.toFixed(1)} t · tự trọng ${rec.massKg} kg · MBL ${(rec.swlT * (rec.sf || 4)).toFixed(1)} t`;
                    box.appendChild(note);
                } else if ((sel[0].kind === 'beam' || sel[0].kind === 'member') && rec) {
                    const D = state.gear.beam.depthM || 0.28;
                    const wall = 0.012;
                    const inner = Math.max(0.02, D - 2 * wall);
                    const I = Math.PI / 64 * (Math.pow(D, 4) - Math.pow(inner, 4));
                    const span = Math.max(0.8, (rec.lengthM || state.L || 4));
                    const pcr = (Math.PI * Math.PI * 210e9 * I) / (span * span) / (1000 * G_EARTH);
                    note.textContent = `OD×thành ${(D * 1000).toFixed(0)}×${(wall * 1000).toFixed(0)} mm · Pcr Euler ${(Math.min(400, pcr)).toFixed(1)} t · nén hiện tại ${phy.beamCompression.toFixed(1)} t`;
                    box.appendChild(note);
                }
            }
        }

        function renderGearFields() {
            const box = document.getElementById('gear-editor-fields');
            const sel = state.gear.selection;
            if (!box) return;
            syncGearEditorActionLabels();
            box.innerHTML = '';
            if (!sel || !sel.length) return;

            // Multi-select: group similar kinds together so editing any spec updates all selected peers at once
            if (sel.length > 1) {
                const groups = [];
                const groupMap = new Map();
                sel.forEach(item => {
                    const gk = item.kind || 'other';
                    if (!groupMap.has(gk)) {
                        const bucket = [];
                        groupMap.set(gk, bucket);
                        groups.push({ kind: gk, items: bucket });
                    }
                    groupMap.get(gk).push(item);
                });

                const hint = document.createElement('div');
                hint.className = 'text-[10px] text-emerald-300/90 mb-1.5 px-1 py-1 rounded bg-emerald-950/40 border border-emerald-500/30';
                hint.textContent = L(
                    `Selected ${sel.length} items — changing a setting updates all matching items simultaneously.`,
                    `Đang chọn ${sel.length} thiết bị — chỉnh thông số sẽ tự động áp dụng đồng thời cho các thiết bị cùng loại.`
                );
                box.appendChild(hint);

                groups.forEach(({ kind, items }) => {
                    const card = document.createElement('section');
                    card.className = 'gear-item-card mb-2.5';
                    const head = document.createElement('div');
                    head.className = 'gear-item-card-head';
                    const title = document.createElement('div');
                    title.className = 'text-[11px] font-bold text-sky-300 uppercase tracking-wide';
                    title.textContent = items.length > 1
                        ? `${gearItemLabel(items[0]).replace(/\s*#?\d+$/, '')} (×${items.length} đồng bộ)`
                        : gearItemLabel(items[0]);
                    const rm = document.createElement('button');
                    rm.type = 'button';
                    rm.className = 'text-slate-400 hover:text-rose-300 text-[11px] px-1';
                    rm.title = L('Remove group from selection', 'Bỏ nhóm khỏi lựa chọn');
                    rm.textContent = '✕';
                    rm.addEventListener('click', () => {
                        const rmKeys = new Set(items.map(gearItemKey));
                        state.gear.selection = state.gear.selection.filter(s => !rmKeys.has(gearItemKey(s)));
                        if (!state.gear.selection.length) closeGearEditor();
                        else {
                            openGearEditor();
                            updateGearSelectionRings();
                        }
                    });
                    head.appendChild(title);
                    head.appendChild(rm);
                    card.appendChild(head);
                    const body = document.createElement('div');
                    body.className = 'gear-item-card-body';
                    if (kind === 'sling') renderSlingInspector(body, items);
                    else renderGenericGearFields(body, items);
                    card.appendChild(body);
                    box.appendChild(card);
                });
                return;
            }

            if (sel[0].kind === 'sling') {
                renderSlingInspector(box, sel);
                return;
            }
            if (sel[0].kind === 'cargo') {
                renderCargoInspector(box);
                return;
            }
            renderGenericGearFields(box, sel);
        }

        function commitTargetsFromInput(input) {
            if (input && input.dataset.scope === '1') {
                return [{
                    kind: input.dataset.kind,
                    role: input.dataset.role || null,
                    index: parseInt(input.dataset.index, 10) || 0,
                    memberId: input.dataset.memberId || null
                }];
            }
            return state.gear.selection.slice();
        }

        function commitGearField(input, refreshForm) {
            const key = input.dataset.key;
            const nullable = input.dataset.nullable === '1';
            const raw = input.value.trim();
            if (raw === '' && !nullable) return;
            const isImp = state.unitSystem === 'imperial';
            const isLenField = key === 'lengthM' || key === 'widthM' || key === 'depthM' || key === 'aM' || key === 'bM';
            let value = raw === '' ? null : parseFloat(raw);
            if (raw !== '' && !isFinite(value)) return;
            if (value != null && isImp && isLenField) {
                value = value / 3.2808399; // Convert input feet back to SI meters
            }
            const targets = commitTargetsFromInput(input);
            const geometryKey = isLenField;
            const slingLength = key === 'lengthM' && targets.length > 0 && targets.every(s => s.kind === 'sling');
            if (geometryKey && !slingLength) preserveOtherCables();
            targets.forEach(sel => {
                const rec = gearRecord(sel);
                if (!rec) return;
                rec[key] = value;
                if (key === 'lengthM' && (sel.role === 'extra' || sel.kind === 'sling')) {
                    rec.userSet = value != null;
                    rec._nhomAutoLen = false;
                    rec._manualLengthOverride = value != null;
                }
                if (key === 'lengthM' && sel.role && state.heldCableL0 && state.heldCableL0[sel.role]) {
                    state.heldCableL0[sel.role][sel.index] = null;
                }
            });
            if (slingLength) {
                syncCableRest(false);
                if (typeof syncCableControlsSelection === 'function') syncCableControlsSelection();
            }
            else if (geometryKey || key === 'massT' || key === 'massKg' || key === 'diaMm' || key === 'sf') scheduleRebuildSpreaderVisuals();
            if (key === 'diaMm' || key === 'parts' || key === 'slingType' || key === 'grade' || key === 'massKg' || key === 'swlT' || key === 'sf') {
                computeRiggingMassBreakdown();
            }
            if (key === 'jawMm' || key === 'pinMm' || key === 'swlT') {
                targets.forEach(sel => {
                    if (sel.kind !== 'shackle' || !hwMeshes[sel.index]) return;
                    const s = state.gear.shackles[sel.index];
                    const jawS = (s.jawMm || 44) / 44;
                    const rateS = Math.pow(Math.max(0.4, (s.swlT || 12) / 12), 0.33);
                    hwMeshes[sel.index].scale.setScalar(THREE.MathUtils.clamp(jawS * rateS, 0.45, 2.6));
                });
            }
            if (targets.some(s => s.kind === 'cargo')) {
                const c = state.gear.cargo || {};
                state.weightUserSet = key === 'weight';
                setDimAndCoG({
                    L: c.L != null ? c.L : state.L,
                    W: c.W != null ? c.W : state.W,
                    H: c.H != null ? c.H : state.H,
                    weight: c.weight != null ? c.weight : state.weight,
                    cogX: c.cogX != null ? c.cogX : state.cogX,
                    cogY: c.cogY != null ? c.cogY : state.cogY,
                    cogZ: c.cogZ != null ? c.cogZ : state.cogZ
                });
                if (key === 'tareT' && c.tareT != null) state.tareT = c.tareT;
                rebuildCargoAndRig(false);
            }
            if (refreshForm !== false) renderGearFields();
            const status = document.getElementById('sim-status-text');
            if (status && refreshForm !== false) status.textContent = `Đã ghi thông số cho ${gearTitle()}.`;
            if (status && slingLength && refreshForm === false) {
                const sel = targets[0];
                const cable = sel && (phy.cables || []).find(c => c.role === sel.role && c.index === sel.index);
                status.textContent = cable
                    ? `${gearItemLabel(sel)} dài ${cable.L0.toFixed(2)} m.`
                    : `Đã ghi chiều dài cho ${gearItemLabel(sel)}.`;
            }
        }

        function openGearEditor() {
            const panel = document.getElementById('gear-editor');
            if (!panel) return;
            state.leftCollapsed = true;
            state.rightCollapsed = true;
            syncSheetButtons();
            panel.style.display = 'block';
            document.body.classList.add('gear-editor-open');
            document.getElementById('gear-editor-title').textContent = gearTitle();
            document.getElementById('gear-editor-sub').textContent = L(
                'Ctrl+drag box to multi-select. Shift+drag adjusts camera. Click empty space to clear.',
                'Ctrl+kéo khung chọn nhiều. Shift+kéo chỉnh góc camera. Click chỗ trống để bỏ chọn.'
            );
            renderGearFields();
            refreshGearLive();
            // Compact left dock → cinematic reframe: cargo on free (right) third
            requestAnimationFrame(() => {
                if (typeof window.invalidateUiSafeNdcCache === 'function') {
                    window.invalidateUiSafeNdcCache();
                }
                if (typeof window.markCameraViewSettled === 'function') {
                    window.markCameraViewSettled();
                }
                if (state.cameraFollow) state.cameraFollow.suppressUiReframe = false;
                if (typeof window.reframeAutoToUiSafeCenter === 'function') {
                    window.reframeAutoToUiSafeCenter({ duration: 0.55, delay: 60 });
                } else if (typeof window.startCinematicUiFrame === 'function') {
                    window.startCinematicUiFrame({ duration: 0.55, force: true });
                }
            });
        }

        function closeGearEditor() {
            const panel = document.getElementById('gear-editor');
            const wasOpen = !!(document.body.classList.contains('gear-editor-open')
                || (panel && panel.style.display !== 'none' && panel.style.display !== '')
                || (state.gear.selection && state.gear.selection.length));
            state.gear.selection = [];
            if (panel) panel.style.display = 'none';
            document.body.classList.remove('gear-editor-open');
            if (typeof syncCableControlsSelection === 'function') syncCableControlsSelection();
            if (typeof updateGearSelectionRings === 'function') updateGearSelectionRings();
            if (typeof clearCtrlHoverHighlight === 'function') clearCtrlHoverHighlight();
            if (typeof window.invalidateUiSafeNdcCache === 'function') {
                window.invalidateUiSafeNdcCache();
            }
            if (wasOpen && state.cameraFollow) state.cameraFollow.suppressUiReframe = false;
            if (wasOpen && typeof window.reframeAutoToUiSafeCenter === 'function') {
                window.reframeAutoToUiSafeCenter({ duration: 0.5, delay: 60 });
            } else if (wasOpen && typeof window.startCinematicUiFrame === 'function') {
                window.startCinematicUiFrame({ duration: 0.5, force: true });
            }
        }

        // ── Ctrl-pick reticle + hover glow ──────────────────────────────────
        let ctrlPickActive = false;
        let ctrlPickPointer = { x: 0, y: 0 };
        const ctrlHoverMeshes = []; // meshes whose materials were swapped for glow

        function ensureCtrlPickCircle() {
            let el = document.getElementById('ctrl-pick-circle');
            if (!el) {
                el = document.createElement('div');
                el.id = 'ctrl-pick-circle';
                document.body.appendChild(el);
            }
            return el;
        }

        function isTypingFocusTarget(el) {
            if (!el) return false;
            const tag = (el.tagName || '').toUpperCase();
            return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || !!el.isContentEditable;
        }

        function setCtrlPickMode(on) {
            const want = !!on && !state.cutToolActive && !isTypingFocusTarget(document.activeElement);
            if (want === ctrlPickActive) {
                if (!want) return;
            }
            ctrlPickActive = want;
            document.body.classList.toggle('ctrl-pick-active', want);
            const el = ensureCtrlPickCircle();
            if (!want) {
                el.style.display = 'none';
                el.classList.remove('is-hot');
                clearCtrlHoverHighlight();
                return;
            }
            el.style.display = 'block';
            el.style.left = ctrlPickPointer.x + 'px';
            el.style.top = ctrlPickPointer.y + 'px';
            const status = document.getElementById('sim-status-text');
            if (status) {
                status.textContent = L(
                    'Ctrl pick — move the circle onto any part of an object (center not required), then click to edit.',
                    'Ctrl chọn — đưa vòng tròn chạm bất kỳ chỗ nào trên vật thể (không cần đúng tâm), rồi click để sửa.'
                );
            }
        }

        function clearCtrlHoverHighlight() {
            if (state.gear) state.gear.ctrlHover = null;
            while (ctrlHoverMeshes.length) {
                const mesh = ctrlHoverMeshes.pop();
                if (!mesh || !mesh.userData) continue;
                if (mesh.userData._ctrlPickOrigMat) {
                    mesh.material = mesh.userData._ctrlPickOrigMat;
                    delete mesh.userData._ctrlPickOrigMat;
                }
            }
            const el = document.getElementById('ctrl-pick-circle');
            if (el) el.classList.remove('is-hot');
            if (updateGearSelectionRings._hoverRing) {
                updateGearSelectionRings._hoverRing.visible = false;
            }
        }

        function ensureCtrlHoverRing() {
            if (updateGearSelectionRings._hoverRing) return updateGearSelectionRings._hoverRing;
            if (!updateGearSelectionRings.sharedGeo) {
                updateGearSelectionRings.sharedGeo = new THREE.TorusGeometry(0.28, 0.016, 8, 24);
            }
            const mat = (MATS.lpCtrlHover || MATS.lpSelected).clone
                ? (MATS.lpCtrlHover || MATS.lpSelected).clone()
                : MATS.lpSelected;
            if (mat.emissiveIntensity != null) mat.emissiveIntensity = 1.35;
            const ring = new THREE.Mesh(updateGearSelectionRings.sharedGeo, mat);
            ring.visible = false;
            ring.renderOrder = 998;
            scene.add(ring);
            updateGearSelectionRings._hoverRing = ring;
            return ring;
        }

        function collectMeshesForGearItem(item) {
            const out = [];
            if (!item) return out;
            const pushTraverse = (root) => {
                if (!root) return;
                root.traverse(o => {
                    if (o.isMesh && o.material) out.push(o);
                });
            };
            if (item.kind === 'sling') {
                // Sling glow is handled via drawMeta.ctrlHover → MATS.lpCtrlHover
                return out;
            }
            if (item.kind === 'shackle' && hwMeshes && hwMeshes[item.index]) {
                pushTraverse(hwMeshes[item.index]);
            } else if (item.kind === 'hook' && hookAssemblyGroup) {
                pushTraverse(hookAssemblyGroup);
            } else if (item.kind === 'cargo' && cargoRootGroup) {
                pushTraverse(cargoRootGroup);
            } else if (item.kind === 'beam') {
                pushTraverse(spreaderRootGroup);
                (phy.beamGroups || []).forEach(pushTraverse);
            } else if (item.kind === 'member') {
                const scanRoots = [];
                (phy.beamGroups || []).forEach(g => scanRoots.push(g));
                if (spreaderRootGroup) scanRoots.push(spreaderRootGroup);
                scanRoots.forEach(root => {
                    root.traverse(o => {
                        if (!o.isMesh || !o.material) return;
                        if (o.userData && o.userData.memberId === item.memberId) out.push(o);
                    });
                });
                if (!out.length) {
                    pushTraverse(spreaderRootGroup);
                    (phy.beamGroups || []).forEach(pushTraverse);
                }
            }
            return out;
        }

        function worldPosForGearItem(item) {
            if (!item) return null;
            if (item.kind === 'sling') {
                const sling = sling3DPool.find(s => s.group && s.group.visible && s.drawMeta
                    && s.drawMeta.role === item.role && s.drawMeta.index === item.index);
                return sling && sling.lastMid ? sling.lastMid.clone() : null;
            }
            if (item.kind === 'shackle' && hwMeshes && hwMeshes[item.index]) {
                const p = new THREE.Vector3();
                hwMeshes[item.index].getWorldPosition(p);
                return p;
            }
            if (item.kind === 'hook' && phy.hookPos) return phy.hookPos.clone();
            if (item.kind === 'cargo' && cargoRootGroup) {
                const p = new THREE.Vector3();
                cargoRootGroup.getWorldPosition(p);
                return p;
            }
            if (item.kind === 'beam' || item.kind === 'member') {
                const p = new THREE.Vector3();
                if (phy.beams && phy.beams[0] && phy.beams[0].x) return phy.beams[0].x.clone();
                if (spreaderRootGroup) {
                    spreaderRootGroup.getWorldPosition(p);
                    return p;
                }
            }
            return null;
        }

        function applyCtrlHoverHighlight(item) {
            const key = item ? gearItemKey(item) : null;
            const prev = state.gear && state.gear.ctrlHover
                ? gearItemKey(state.gear.ctrlHover)
                : null;
            if (key === prev && key) {
                const ring = ensureCtrlHoverRing();
                const pos = worldPosForGearItem(item);
                if (pos) {
                    ring.visible = true;
                    ring.position.copy(pos);
                    ring.lookAt(camera.position);
                    const pulse = 1.05 + 0.12 * Math.abs(Math.sin(performance.now() * 0.01));
                    ring.scale.setScalar(pulse);
                }
                return;
            }
            clearCtrlHoverHighlight();
            if (!item) return;
            state.gear.ctrlHover = normalizeGearItem(item);
            const meshes = collectMeshesForGearItem(item);
            meshes.forEach(mesh => {
                if (!mesh.material || mesh.userData._ctrlPickOrigMat) return;
                mesh.userData._ctrlPickOrigMat = mesh.material;
                const src = mesh.material;
                const cloned = Array.isArray(src) ? src.map(m => m.clone()) : src.clone();
                const list = Array.isArray(cloned) ? cloned : [cloned];
                list.forEach(m => {
                    if (!m) return;
                    if (m.emissive) {
                        m.emissive.setHex(0x0ea5e9);
                        m.emissiveIntensity = Math.max(m.emissiveIntensity || 0, 0.35) + 0.7;
                    }
                    if (m.color && typeof m.color.offsetHSL === 'function') {
                        m.color.offsetHSL(0, 0.05, 0.12);
                    }
                });
                mesh.material = cloned;
                ctrlHoverMeshes.push(mesh);
            });
            const ring = ensureCtrlHoverRing();
            const pos = worldPosForGearItem(item);
            if (pos) {
                ring.visible = true;
                ring.position.copy(pos);
                ring.lookAt(camera.position);
            }
            const el = document.getElementById('ctrl-pick-circle');
            if (el) el.classList.add('is-hot');
        }

        function updateCtrlPickHover(e) {
            if (!ctrlPickActive || state.cutToolActive || dragTarget || marqueeSelect || pendingCtrlSelect) {
                if (!ctrlPickActive) clearCtrlHoverHighlight();
                return;
            }
            const el = ensureCtrlPickCircle();
            ctrlPickPointer.x = e.clientX;
            ctrlPickPointer.y = e.clientY;
            el.style.display = 'block';
            el.style.left = e.clientX + 'px';
            el.style.top = e.clientY + 'px';

            // Only raycast over the 3D canvas — UI chrome should not steal hot state
            const onCanvas = renderer && e.target === renderer.domElement;
            if (!onCanvas) {
                clearCtrlHoverHighlight();
                return;
            }
            mouse.x = (e.clientX / window.innerWidth) * 2 - 1;
            mouse.y = -(e.clientY / window.innerHeight) * 2 + 1;
            raycaster.setFromCamera(mouse, camera);
            // Fat pick: circle overlapping any part of the object is enough (not only center)
            let gear = pickGearNearPointer(e.clientX, e.clientY, 48);
            if (!gear) {
                const gizmoHits = raycaster.intersectObjects(getInteractiveGizmos(), false);
                if (gizmoHits.length) {
                    const dt = gizmoHits[0].object.userData.dragType;
                    if (dt === 'lp') {
                        gear = { kind: 'shackle', role: null, index: gizmoHits[0].object.userData.lpIndex };
                    } else if (dt === 'hook') {
                        gear = { kind: 'hook', role: null, index: 0 };
                    } else if (dt === 'cog') {
                        gear = { kind: 'cargo', role: null, index: 0 };
                    }
                }
            }
            if (gear) applyCtrlHoverHighlight(gear);
            else clearCtrlHoverHighlight();
        }

        if (typeof window !== 'undefined') {
            window.openGearEditor = openGearEditor;
            window.closeGearEditor = closeGearEditor;
            window.applyIsoCargoPresetFromEditor = applyIsoCargoPresetFromEditor;
            window.cargoIsoFamily = cargoIsoFamily;
            window.isoSiblingPresets = isoSiblingPresets;
            window.isOogCapableCargo = isOogCapableCargo;
            window.simState = state;
            if (!window.state) window.state = state;
        }

        function refreshGearLive() {
            const live = document.getElementById('gear-editor-live');
            const panel = document.getElementById('gear-editor');
            if (!live || !panel || panel.style.display === 'none') return;
            const bits = state.gear.selection.map(s => {
                if (s.kind === 'sling' && s.role === 'upper') {
                    const upItem = state.gear.uppers && state.gear.uppers[s.index];
                    return (upItem && upItem.broken) ? `Treo ${s.index + 1} đứt` : `Treo ${s.index + 1} ${(phy.upperTensions[s.index] || 0).toFixed(2)} t`;
                }
                if (s.kind === 'sling' && s.role === 'hanger') {
                    const hItem = state.gear.hangers && state.gear.hangers[s.index];
                    const t = (phy.hangerTensions && phy.hangerTensions[s.index]) || 0;
                    return (hItem && hItem.broken) ? `Treo dầm ${s.index + 1} đứt` : `Treo dầm ${s.index + 1} ${t.toFixed(2)} t`;
                }
                if (s.kind === 'sling' && s.role === 'extra') {
                    const ex = (state.gear.extraCables || [])[s.index];
                    return (ex && ex.broken) ? `Thêm ${s.index + 1} đứt` : `Thêm ${s.index + 1}`;
                }
                if (s.kind === 'sling') {
                    const legItem = state.gear.legs && state.gear.legs[s.index];
                    return (legItem && legItem.broken) ? `LP${s.index + 1} đứt` : `LP${s.index + 1} ${(phy.legTensions[s.index] || 0).toFixed(2)} t`;
                }
                if (s.kind === 'hook') return `${bi('gearHook')} SWL ${state.gear.hook.swlT} t`;
                if (s.kind === 'member') {
                    const spec = memberSpec(s.memberId);
                    return spec ? `${bi(spec.nameKey)} L ${spec.length.toFixed(2)} m · A ${spec.a.toFixed(2)} · B ${spec.b.toFixed(2)}` : bi('gearBeam');
                }
                if (s.kind === 'beam') return `${bi('gearBeam')} SWL ${state.gear.beam.swlT} t`;
                if (s.kind === 'cargo') {
                    const iso = state.isoCode ? `ISO ${state.isoCode} · ` : '';
                    let extra = '';
                    if (isOogCapableCargo() && state.oogHasCargo !== false && isDeckOogCargo()
                        && typeof resolveDeckOogGeometry === 'function') {
                        const g = resolveDeckOogGeometry(state.L, state.W, state.H);
                        if (g) extra = ` · hàng ${g.cL.toFixed(2)}×${g.cW.toFixed(2)}×${g.cH.toFixed(2)}`;
                    } else if (isOogCapableCargo() && state.oogHasCargo === false) {
                        extra = ' · rỗng';
                    }
                    return `${iso}Khung ${state.L.toFixed(2)}×${state.W.toFixed(2)}×${state.H.toFixed(2)} m${extra} · ${state.weight.toFixed(1)} t`;
                }
                return `Ma ní LP${s.index + 1} SWL ${state.gear.shackles[s.index].swlT} t`;
            });
            live.textContent = bits.join(' · ');
        }

        function updateGearSelectionRings() {
            if (!updateGearSelectionRings.pool) {
                updateGearSelectionRings.pool = new THREE.Group();
                scene.add(updateGearSelectionRings.pool);
            }
            if (!updateGearSelectionRings.sharedGeo) {
                updateGearSelectionRings.sharedGeo = new THREE.TorusGeometry(0.28, 0.016, 8, 24);
            }
            const pool = updateGearSelectionRings.pool;
            const need = (state.gear.selection || []).length;
            // Grow reusable ring meshes once — never allocate TorusGeometry every frame
            while (pool.children.length < need) {
                pool.add(new THREE.Mesh(updateGearSelectionRings.sharedGeo, MATS.lpSelected));
            }
            for (let i = 0; i < pool.children.length; i++) {
                pool.children[i].visible = false;
            }
            (state.gear.selection || []).forEach((sel, idx) => {
                const ring = pool.children[idx];
                if (!ring) return;
                let pos = null;
                if (sel.kind === 'sling') {
                    const sling = sling3DPool.find(s => s.group.visible && s.drawMeta && s.drawMeta.role === sel.role && s.drawMeta.index === sel.index);
                    if (sling && sling.lastMid) pos = sling.lastMid;
                } else if (sel.kind === 'shackle' && hwMeshes[sel.index]) {
                    pos = new THREE.Vector3();
                    hwMeshes[sel.index].getWorldPosition(pos);
                } else if (sel.kind === 'member') {
                    pos = new THREE.Vector3();
                    let body = null;
                    const scanRoots = [];
                    (phy.beamGroups || []).forEach(g => scanRoots.push(g));
                    if (spreaderRootGroup) scanRoots.push(spreaderRootGroup);
                    for (let ri = 0; ri < scanRoots.length && !body; ri++) {
                        scanRoots[ri].traverse(o => {
                            if (!body && o.userData && o.userData.memberBody && o.userData.memberId === sel.memberId) body = o;
                        });
                    }
                    if (body) body.getWorldPosition(pos);
                    else if (phy.beams && phy.beams.length) pos.copy(phy.beams[0].x);
                    else if (spreaderRootGroup) spreaderRootGroup.getWorldPosition(pos);
                    else pos = null;
                } else if (sel.kind === 'beam') {
                    pos = new THREE.Vector3();
                    if (phy.beams && phy.beams.length) pos.copy(phy.beams[0].x);
                    else if (spreaderRootGroup) spreaderRootGroup.getWorldPosition(pos);
                    else pos = null;
                } else if (sel.kind === 'hook') {
                    pos = phy.hookPos.clone();
                } else if (sel.kind === 'cargo' && cargoRootGroup) {
                    pos = new THREE.Vector3();
                    cargoRootGroup.getWorldPosition(pos);
                }
                if (!pos) return;
                ring.visible = true;
                ring.position.copy(pos);
                ring.lookAt(camera.position);
            });
        }

        function normalizeGearItem(gear) {
            return {
                kind: gear.kind,
                role: gear.kind === 'sling' ? (gear.role || 'leg') : null,
                index: gear.index || 0,
                memberId: gear.memberId || null
            };
        }

        function setGearSelection(items) {
            const seen = new Set();
            state.gear.selection = [];
            (items || []).forEach(g => {
                const item = normalizeGearItem(g);
                const key = gearItemKey(item);
                if (seen.has(key)) return;
                seen.add(key);
                state.gear.selection.push(item);
            });
            if (state.gear.selection.length) {
                openGearEditor();
                if (typeof syncCableControlsSelection === 'function') syncCableControlsSelection();
                updateGearSelectionRings();
            } else {
                closeGearEditor();
                if (typeof syncCableControlsSelection === 'function') syncCableControlsSelection();
                updateGearSelectionRings();
            }
        }

        function applyGearSelection(gear, e) {
            // Plain click no longer selects (leaves LMB free for camera).
            // Double-click / Alt = single; Ctrl/Meta = toggle add/remove.
            const inspect = e.detail === 2 || e.altKey;
            const multi = !inspect && !!(e.ctrlKey || e.metaKey);
            if (!inspect && !multi) return;
            const item = normalizeGearItem(gear);
            if (!multi) {
                setGearSelection([item]);
                return;
            }
            const idx = state.gear.selection.findIndex(s => gearItemKey(s) === gearItemKey(item));
            if (idx >= 0) state.gear.selection.splice(idx, 1);
            else state.gear.selection.push(item);
            setGearSelection(state.gear.selection.slice());
        }

        let gearMarquee = null;
        let marqueeSelect = null;
        /** Ctrl gesture: click = single pick, drag past threshold = marquee box. */
        let pendingCtrlSelect = null;
        const CTRL_MARQUEE_THRESH_PX = 8;

        function ensureMarqueeEl() {
            if (gearMarquee && gearMarquee.isConnected) return gearMarquee;
            gearMarquee = document.getElementById('gear-marquee');
            if (!gearMarquee) {
                gearMarquee = document.createElement('div');
                gearMarquee.id = 'gear-marquee';
                document.body.appendChild(gearMarquee);
            }
            return gearMarquee;
        }

        function updateMarqueeEl() {
            const el = ensureMarqueeEl();
            if (!marqueeSelect) {
                el.style.display = 'none';
                return;
            }
            const x0 = Math.min(marqueeSelect.x0, marqueeSelect.x1);
            const y0 = Math.min(marqueeSelect.y0, marqueeSelect.y1);
            const w = Math.abs(marqueeSelect.x1 - marqueeSelect.x0);
            const h = Math.abs(marqueeSelect.y1 - marqueeSelect.y0);
            el.style.display = 'block';
            el.style.left = x0 + 'px';
            el.style.top = y0 + 'px';
            el.style.width = w + 'px';
            el.style.height = h + 'px';
        }

        function worldToScreenPx(world) {
            const v = world.clone().project(camera);
            return {
                x: (v.x * 0.5 + 0.5) * window.innerWidth,
                y: (-v.y * 0.5 + 0.5) * window.innerHeight,
                behind: v.z < -1 || v.z > 1
            };
        }

        function collectGearItemsInScreenRect(x0, y0, x1, y1) {
            const left = Math.min(x0, x1);
            const right = Math.max(x0, x1);
            const top = Math.min(y0, y1);
            const bottom = Math.max(y0, y1);
            if (right - left < 6 && bottom - top < 6) return [];
            const hits = [];
            const seen = new Set();
            const tryAdd = (item, worldPos) => {
                if (!item || !worldPos) return;
                const scr = worldToScreenPx(worldPos);
                if (scr.behind) return;
                if (scr.x < left || scr.x > right || scr.y < top || scr.y > bottom) return;
                const norm = normalizeGearItem(item);
                const key = gearItemKey(norm);
                if (seen.has(key)) return;
                seen.add(key);
                hits.push(norm);
            };

            sling3DPool.forEach(s => {
                if (!s.group || !s.group.visible || !s.drawMeta) return;
                const meta = s.drawMeta;
                const pos = s.lastMid
                    || (s.group.getWorldPosition ? (() => { const p = new THREE.Vector3(); s.group.getWorldPosition(p); return p; })() : null);
                if (!pos) return;
                tryAdd({ kind: 'sling', role: meta.role || 'leg', index: meta.index || 0 }, pos);
            });
            hwMeshes.forEach((h, i) => {
                if (!h) return;
                const p = new THREE.Vector3();
                h.getWorldPosition(p);
                tryAdd({ kind: 'shackle', index: i }, p);
            });
            if (hookAssemblyGroup) {
                const p = phy.hookPos ? phy.hookPos.clone() : new THREE.Vector3();
                if (!phy.hookPos) hookAssemblyGroup.getWorldPosition(p);
                tryAdd({ kind: 'hook', index: 0 }, p);
            }
            if (cargoRootGroup) {
                const p = new THREE.Vector3();
                cargoRootGroup.getWorldPosition(p);
                tryAdd({ kind: 'cargo', index: 0 }, p);
            }
            if (spreaderRootGroup && spreaderRootGroup.visible) {
                const p = new THREE.Vector3();
                spreaderRootGroup.getWorldPosition(p);
                tryAdd({ kind: 'beam', index: 0 }, p);
                spreaderRootGroup.traverse(o => {
                    if (!o.userData || !o.userData.memberId) return;
                    if (!(o.userData.memberBody || o.userData.gearKind === 'member')) return;
                    const mp = new THREE.Vector3();
                    o.getWorldPosition(mp);
                    tryAdd({ kind: 'member', index: 0, memberId: o.userData.memberId }, mp);
                });
            }
            (phy.beamGroups || []).forEach(g => {
                if (!g) return;
                const p = new THREE.Vector3();
                g.getWorldPosition(p);
                tryAdd({ kind: 'beam', index: 0 }, p);
            });
            return hits;
        }

        function finishMarqueeSelect(additive) {
            if (!marqueeSelect) return;
            const items = collectGearItemsInScreenRect(
                marqueeSelect.x0, marqueeSelect.y0, marqueeSelect.x1, marqueeSelect.y1
            );
            marqueeSelect = null;
            updateMarqueeEl();
            controls.enabled = true;
            document.body.style.cursor = 'default';
            if (!items.length) {
                if (!additive) {
                    closeGearEditor();
                }
                const status = document.getElementById('sim-status-text');
                if (status) {
                    status.textContent = L(
                        'No parts inside the selection box — selection cleared.',
                        'Không có thiết bị trong khung chọn — đã bỏ chọn.'
                    );
                }
                return;
            }
            if (additive && state.gear.selection.length) {
                const map = new Map(state.gear.selection.map(s => [gearItemKey(s), s]));
                items.forEach(it => map.set(gearItemKey(it), it));
                setGearSelection([...map.values()]);
            } else {
                setGearSelection(items);
            }
            const status = document.getElementById('sim-status-text');
            if (status) {
                status.textContent = L(
                    `Selected ${state.gear.selection.length} part(s). Edit on the left panel.`,
                    `Đã chọn ${state.gear.selection.length} thiết bị. Chỉnh thông số ở panel trái.`
                );
            }
        }

        function pickGearHit(opts) {
            const withPoint = !!(opts && opts.withPoint);
            const objs = [];
            sling3DPool.forEach(s => {
                if (!s.group || !s.group.visible) return;
                objs.push(s.group);
            });
            if (spreaderRootGroup && spreaderRootGroup.visible) objs.push(spreaderRootGroup);
            (phy.beamGroups || []).forEach(g => objs.push(g));
            if (cargoRootGroup) objs.push(cargoRootGroup);
            hwMeshes.forEach(h => objs.push(h));
            if (hookAssemblyGroup) objs.push(hookAssemblyGroup);
            // Fat ray thresholds — thin cables/chains are easy to miss at center
            const prevLine = raycaster.params.Line && raycaster.params.Line.threshold;
            const prevPts = raycaster.params.Points && raycaster.params.Points.threshold;
            if (!raycaster.params.Line) raycaster.params.Line = {};
            if (!raycaster.params.Points) raycaster.params.Points = {};
            raycaster.params.Line.threshold = 0.22;
            raycaster.params.Points.threshold = 0.28;
            const hits = raycaster.intersectObjects(objs, true);
            if (prevLine != null) raycaster.params.Line.threshold = prevLine;
            if (prevPts != null) raycaster.params.Points.threshold = prevPts;
            if (!hits || !hits.length) return null;

            // Prioritize hits on visible solid meshes (e.g. cylinder segment, chain link, beam, hook)
            // over transparent picker spheres within 0.25m distance
            let bestHit = null;
            for (let h = 0; h < hits.length; h++) {
                const hit = hits[h];
                const o = hit.object;
                if (o.name === 'hoistRopeL' || o.name === 'hoistRopeR') continue;
                if (o.userData && o.userData.dragType) continue;
                let target = o;
                let gearData = null;
                while (target) {
                    if (target.userData && target.userData.gearKind) {
                        gearData = {
                            kind: target.userData.gearKind,
                            role: target.userData.gearRole || 'leg',
                            index: target.userData.gearIndex || 0,
                            memberId: target.userData.memberId || null
                        };
                        break;
                    }
                    target = target.parent;
                }
                if (!gearData) continue;

                const isPicker = !!(o.material && o.material.transparent && o.material.opacity === 0);
                if (!bestHit) {
                    bestHit = { hit, gearData, isPicker };
                } else if (bestHit.isPicker && !isPicker && (hit.distance - bestHit.hit.distance < 0.25)) {
                    bestHit = { hit, gearData, isPicker };
                    break;
                } else if (!bestHit.isPicker) {
                    break;
                }
            }
            if (!bestHit) return null;
            if (withPoint) {
                return {
                    ...bestHit.gearData,
                    point: bestHit.hit.point.clone()
                };
            }
            return bestHit.gearData;
        }

        /** Screen-space distance from pointer to a world point (px). Infinity if behind camera. */
        function screenDistToWorld(world, sx, sy) {
            if (!world) return Infinity;
            const scr = worldToScreenPx(world);
            if (scr.behind) return Infinity;
            return Math.hypot(scr.x - sx, scr.y - sy);
        }

        /** Distance from pointer circle to projected AABB (0 if overlapping). */
        function screenDistToBox3(box, sx, sy) {
            if (!box || box.isEmpty()) return Infinity;
            const corners = [
                new THREE.Vector3(box.min.x, box.min.y, box.min.z),
                new THREE.Vector3(box.max.x, box.min.y, box.min.z),
                new THREE.Vector3(box.min.x, box.max.y, box.min.z),
                new THREE.Vector3(box.max.x, box.max.y, box.min.z),
                new THREE.Vector3(box.min.x, box.min.y, box.max.z),
                new THREE.Vector3(box.max.x, box.min.y, box.max.z),
                new THREE.Vector3(box.min.x, box.max.y, box.max.z),
                new THREE.Vector3(box.max.x, box.max.y, box.max.z)
            ];
            let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
            let any = false;
            for (let i = 0; i < corners.length; i++) {
                const scr = worldToScreenPx(corners[i]);
                if (scr.behind) continue;
                any = true;
                minX = Math.min(minX, scr.x);
                maxX = Math.max(maxX, scr.x);
                minY = Math.min(minY, scr.y);
                maxY = Math.max(maxY, scr.y);
            }
            if (!any) return Infinity;
            const cx = THREE.MathUtils.clamp(sx, minX, maxX);
            const cy = THREE.MathUtils.clamp(sy, minY, maxY);
            return Math.hypot(sx - cx, sy - cy);
        }

        /**
         * Fat pick for Ctrl circle / click: anything the reticle overlaps counts —
         * no need to hit the exact center of the mesh.
         * @param {number} [radiusPx] screen radius (default ≈ Ctrl circle radius)
         */
        function pickGearNearPointer(clientX, clientY, radiusPx) {
            const R = radiusPx != null ? radiusPx : 44;
            const sx = clientX != null ? clientX : ctrlPickPointer.x;
            const sy = clientY != null ? clientY : ctrlPickPointer.y;

            // 1) Exact / fat raycast first
            const exact = pickGearHit();
            if (exact) return exact;

            let best = null;
            const consider = (item, dist, bias) => {
                if (!(dist <= R)) return;
                const score = dist + (bias || 0);
                if (!best || score < best.score) best = { item, score };
            };

            // 2) Slings / chains — path proximity (same idea as cut-tool fat pick)
            const slingHit = (typeof pickSlingCutHit === 'function') ? pickSlingCutHit(R) : null;
            if (slingHit) {
                consider({ kind: 'sling', role: slingHit.role, index: slingHit.index }, slingHit.dPx || 0, 0);
            }
            // Also scan every visible sling mid / ends in case pathPoints missing
            sling3DPool.forEach(s => {
                if (!s || !s.group || !s.group.visible || !s.drawMeta) return;
                const item = {
                    kind: 'sling',
                    role: s.drawMeta.role || 'leg',
                    index: s.drawMeta.index || 0
                };
                if (s.lastMid) consider(item, screenDistToWorld(s.lastMid, sx, sy), 2);
                if (s.pathPoints && s.pathPoints.length) {
                    const a = s.pathPoints[0];
                    const b = s.pathPoints[s.pathPoints.length - 1];
                    consider(item, screenDistToWorld(a, sx, sy), 4);
                    consider(item, screenDistToWorld(b, sx, sy), 4);
                }
            });

            // 3) Hook
            if (phy.hookPos) {
                consider({ kind: 'hook', role: null, index: 0 }, screenDistToWorld(phy.hookPos, sx, sy), 1);
            }
            if (hookAssemblyGroup) {
                const box = new THREE.Box3().setFromObject(hookAssemblyGroup);
                consider({ kind: 'hook', role: null, index: 0 }, screenDistToBox3(box, sx, sy), 0);
            }

            // 4) Shackles / LP hardware
            (hwMeshes || []).forEach((h, i) => {
                if (!h) return;
                const p = new THREE.Vector3();
                h.getWorldPosition(p);
                consider({ kind: 'shackle', role: null, index: i }, screenDistToWorld(p, sx, sy), 1);
                const box = new THREE.Box3().setFromObject(h);
                consider({ kind: 'shackle', role: null, index: i }, screenDistToBox3(box, sx, sy), 0);
            });

            // 5) Spreader / beam members — any overlap with projected bbox
            const beamRoots = [];
            if (spreaderRootGroup && spreaderRootGroup.visible) beamRoots.push(spreaderRootGroup);
            (phy.beamGroups || []).forEach(g => beamRoots.push(g));
            beamRoots.forEach(root => {
                root.traverse(o => {
                    if (!o.isMesh || !o.geometry) return;
                    const ud = o.userData || {};
                    let item = null;
                    if (ud.gearKind === 'member' || ud.memberBody) {
                        item = { kind: 'member', role: null, index: 0, memberId: ud.memberId || 'spreader_main' };
                    } else if (ud.gearKind === 'beam') {
                        item = { kind: 'beam', role: null, index: 0 };
                    }
                    if (!item) return;
                    const box = new THREE.Box3().setFromObject(o);
                    consider(item, screenDistToBox3(box, sx, sy), 3);
                });
                // Whole spreader fallback
                const box = new THREE.Box3().setFromObject(root);
                consider({ kind: 'beam', role: null, index: 0 }, screenDistToBox3(box, sx, sy), 8);
            });

            // 6) Cargo — large AABB, easy to hit anywhere on the shell
            if (cargoRootGroup) {
                const box = new THREE.Box3().setFromObject(cargoRootGroup);
                consider({ kind: 'cargo', role: null, index: 0 }, screenDistToBox3(box, sx, sy), 6);
            }

            return best ? best.item : null;
        }
        if (typeof window !== 'undefined') window.pickGearNearPointer = pickGearNearPointer;

        function bindGearEditor() {
            document.getElementById('gear-editor-close').addEventListener('click', closeGearEditor);
            document.getElementById('gear-editor-clear').addEventListener('click', closeGearEditor);
            const cutToolBtn = document.getElementById('btn-cut-tool');
            if (cutToolBtn) {
                cutToolBtn.addEventListener('click', (ev) => {
                    setCutToolActive(!state.cutToolActive, ev);
                });
            }
            window.addEventListener('keydown', (ev) => {
                if (ev.key === 'Escape' && state.cutToolActive) {
                    setCutToolActive(false);
                    ev.preventDefault();
                }
                if (ev.key === 'Control' || ev.key === 'Meta' || ev.ctrlKey || ev.metaKey) {
                    if (!isTypingFocusTarget(ev.target) && !state.cutToolActive) {
                        setCtrlPickMode(true);
                    }
                }
                if (ev.key === 'Escape' && document.body.classList.contains('gear-editor-open')) {
                    closeGearEditor();
                    clearCtrlHoverHighlight();
                }
            });
            window.addEventListener('keyup', (ev) => {
                if (ev.key === 'Control' || ev.key === 'Meta') {
                    // Only leave pick mode when neither Ctrl nor Meta remains held
                    if (!ev.ctrlKey && !ev.metaKey) setCtrlPickMode(false);
                }
            });
            window.addEventListener('blur', () => setCtrlPickMode(false));
            // Click outside the gear panel → clear selection.
            // Plain canvas clicks also clear here (in addition to onPointerDown) so deselect
            // still works if the canvas target check flakes. Shift is left free for camera.
            document.addEventListener('pointerdown', (ev) => {
                const hasSel = !!(document.body.classList.contains('gear-editor-open')
                    || (state.gear.selection && state.gear.selection.length));
                if (!hasSel) return;
                const panel = document.getElementById('gear-editor');
                if (panel && panel.contains(ev.target)) return;
                if (ev.button != null && ev.button !== 0) return;
                if (ev.ctrlKey || ev.metaKey || ev.altKey || ev.detail === 2) return;
                if (state.cutToolActive || ev.shiftKey) return;
                closeGearEditor();
            }, true);
            syncCutToolButton();
            const cutBtn = document.getElementById('gear-editor-cut');
            if (cutBtn) {
                cutBtn.addEventListener('click', () => {
                    const target = selectedRiggingActionText() || gearTitle();
                    const snapped = cutSelectedRiggingCables();
                    if (snapped === 0) {
                        const status = document.getElementById('sim-status-text');
                        if (status) status.textContent = `Không còn cáp nguyên vẹn để cắt trên ${target}.`;
                        refreshGearLive();
                        renderGearFields();
                        return;
                    }
                    const status = document.getElementById('sim-status-text');
                    if (status) status.textContent = `Đã chủ động cắt ${target}.`;
                    refreshGearLive();
                    renderGearFields();
                });
            }
            document.getElementById('gear-editor-repair').addEventListener('click', () => {
                const target = selectedRiggingActionText() || gearTitle();
                const repaired = repairSelectedRiggingCables();
                // Non-cable hardware still keeps its former repair behaviour.
                if (repaired === 0) {
                    state.gear.selection.forEach(sel => {
                        const rec = gearRecord(sel);
                        if (rec && rec.broken) rec.broken = false;
                    });
                }
                const status = document.getElementById('sim-status-text');
                if (status) status.textContent = repaired > 0
                    ? `Đã nối lại ${target}.`
                    : 'Không có cáp đứt để nối lại.';
                refreshGearLive();
                renderGearFields();
            });
            document.getElementById('gear-editor-auto').addEventListener('click', () => {
                state.gear.selection.forEach(sel => {
                    const rec = gearRecord(sel);
                    if (!rec) return;
                    if (sel.kind === 'sling') { rec.lengthM = null; rec.swlT = null; rec.massKg = null; }
                    if (sel.kind === 'shackle') { rec.swlT = null; rec.massKg = null; }
                    if (sel.kind === 'beam') { rec.lengthM = null; rec.widthM = null; rec.massT = null; }
                    if (sel.kind === 'member') { rec.lengthM = null; rec.aM = null; rec.bM = null; rec.swlT = null; rec.massT = null; }
                });
                scheduleRebuildSpreaderVisuals();
                renderGearFields();
            });
        }

        function getInteractiveGizmos() {
            const list = [];
            hookAssemblyGroup.traverse(o => { if (o.userData?.dragType) list.push(o); });
            cogIndicatorGroup.traverse(o => { if (o.userData?.dragType) list.push(o); });
            padEyeMeshes.forEach(p => p.traverse(o => { if (o.userData?.dragType) list.push(o); }));
            if (cargoGroundAngleGroup && (phy.groundClearance || 0) <= 0.08) {
                cargoGroundAngleGroup.traverse(o => { if (o.userData?.dragType) list.push(o); });
            }
            return list;
        }

        function hookDragNowMs() {
            return (typeof performance !== 'undefined' && performance.now)
                ? performance.now()
                : Date.now();
        }

        function setHookDragCommand(worldPoint, nowMs = hookDragNowMs()) {
            if (!dragTarget || dragTarget.type !== 'hook') return;
            const next = new THREE.Vector3(
                THREE.MathUtils.clamp(worldPoint.x, -7, 7),
                THREE.MathUtils.clamp(worldPoint.y, 2.0, 28.0),
                THREE.MathUtils.clamp(worldPoint.z, -6, 6)
            );
            const prev = dragTarget.lastWorld || phy.hookTarget.clone();
            const elapsed = Math.max(0.012, Math.min(0.22, (nowMs - (dragTarget.lastMoveMs || nowMs)) / 1000));
            const sampleSpeed = THREE.MathUtils.clamp(next.distanceTo(prev) / elapsed, 0, 8.0);
            // A short low-pass filter preserves deliberate slow motion, while
            // avoiding a one-frame mouse spike turning into a crane impulse.
            dragTarget.pointerSpeed = THREE.MathUtils.lerp(
                dragTarget.pointerSpeed == null ? sampleSpeed : dragTarget.pointerSpeed,
                sampleSpeed,
                0.58
            );
            dragTarget.lastWorld = next.clone();
            dragTarget.lastMoveMs = nowMs;
            phy.hookTarget.copy(next);

            const inp = document.getElementById('inp-hook-y');
            const val = document.getElementById('val-hook-y');
            if (inp) inp.value = phy.hookTarget.y.toFixed(2);
            if (val) val.textContent = phy.hookTarget.y.toFixed(1) + 'm';
            const status = document.getElementById('sim-status-text');
            if (status) {
                const coupled = (phy.dragHookLoadCoupling || 0) > 0.18;
                status.textContent = coupled
                    ? 'Đang kéo móc: cáp đang căng — mô phỏng giảm tốc theo tải và lực căng.'
                    : 'Đang kéo móc: cáp còn chùng — phản hồi nhanh theo vận tốc kéo chuột.';
            }
        }

        function onPointerDown(e) {
            if (e.button != null && e.button !== 0) return;
            mouse.x = (e.clientX / window.innerWidth) * 2 - 1;
            mouse.y = -(e.clientY / window.innerHeight) * 2 + 1;
            raycaster.setFromCamera(mouse, camera);

            // Plain click on the 3D view collapses panels + clears selection.
            // Shift+drag = OrbitControls pan (left/right, up/down) — do not clear or steal.
            const onCanvas = e.target === renderer?.domElement;
            if (onCanvas && !e.shiftKey && !state.cutToolActive && e.detail !== 2 && !e.altKey && !e.ctrlKey && !e.metaKey) {
                collapsePanelsForCanvasClick();
            }

            // Shift: leave the event to OrbitControls (pan). Do not start gizmo/select.
            if (e.shiftKey && !e.ctrlKey && !e.metaKey && !e.altKey && !state.cutToolActive) {
                return;
            }

            // Scissors tool: fat pick along sling path → cut at nearest point
            if (state.cutToolActive) {
                const cutHit = pickSlingCutHit(44) || pickGearHit({ withPoint: true });
                if (cutHit && cutHit.kind === 'sling' && cutHit.point) {
                    const ok = cutCableAtHit(cutHit, cutHit.point);
                    clearCutHoverVisual();
                    const status = document.getElementById('sim-status-text');
                    if (status && !ok) {
                        status.textContent = L('That sling is already cut.', 'Sợi cáp này đã bị cắt.');
                    }
                    if (typeof refreshGearLive === 'function') refreshGearLive();
                    if (typeof renderGearFields === 'function') renderGearFields();
                    e.preventDefault();
                    e.stopPropagation();
                    return;
                }
                const status = document.getElementById('sim-status-text');
                if (status) {
                    status.textContent = L(
                        'Scissors: move closer to a rope or chain until it flashes red, then click.',
                        'Kéo cắt: đưa gần cáp/xích đến khi nháy đỏ, rồi bấm.'
                    );
                }
                e.preventDefault();
                e.stopPropagation();
                return;
            }

            // Ctrl/Meta: defer pick vs marquee until move/up (click = pick, drag = box select).
            // Shift is NOT marquee — OrbitControls uses Shift+LMB for pan.
            if ((e.ctrlKey || e.metaKey) && !e.altKey && e.detail !== 2) {
                pendingCtrlSelect = {
                    x0: e.clientX,
                    y0: e.clientY,
                    x1: e.clientX,
                    y1: e.clientY,
                    additive: true
                };
                marqueeSelect = null;
                dragTarget = null;
                controls.enabled = false;
                if (state.cameraFollow) state.cameraFollow.orbiting = true;
                e.preventDefault();
                e.stopPropagation();
                return;
            }

            // Selection via double-click / Alt — plain click keeps camera free; Ctrl handled above
            const forceSelect = e.detail === 2 || e.altKey;
            const gizmoHits = raycaster.intersectObjects(getInteractiveGizmos(), false);
            const wantGizmoDrag = !forceSelect && gizmoHits.length > 0;

            if (forceSelect) {
                // Alt / double-click: fat pick under pointer (circle / near miss OK)
                let gear = pickGearNearPointer(e.clientX, e.clientY, 48);
                if (!gear && gizmoHits.length) {
                    if (gizmoHits[0].object.userData.dragType === 'lp') {
                        gear = { kind: 'shackle', role: null, index: gizmoHits[0].object.userData.lpIndex };
                    } else if (gizmoHits[0].object.userData.dragType === 'hook') {
                        gear = { kind: 'hook', role: null, index: 0 };
                    } else if (gizmoHits[0].object.userData.dragType === 'cog') {
                        gear = { kind: 'cargo', role: null, index: 0 };
                    }
                }
                if (gear) {
                    applyGearSelection(gear, e);
                    dragTarget = null;
                    controls.enabled = true;
                    document.body.style.cursor = 'default';
                    e.preventDefault();
                    e.stopPropagation();
                    return;
                }
                // Miss on Alt/double-click → clear selection
                closeGearEditor();
            }

            const hits = gizmoHits;
            if (hits.length > 0 && wantGizmoDrag) {
                const hitObj = hits[0].object;
                const { dragType, lpIndex } = hitObj.userData;
                controls.enabled = false;
                document.body.style.cursor = 'grabbing';

                if (dragType === 'hook') {
                    dragTarget = {
                        type: 'hook',
                        pointerSpeed: 0.25,
                        lastWorld: phy.hookTarget.clone(),
                        lastMoveMs: hookDragNowMs()
                    };
                    phy.dragHookSpeed = 0;
                    phy.dragHookLoadCoupling = 0;
                    if (state.poseLock) {
                        state.poseLock = false;
                        syncPoseLockUI();
                    }
                    if (typeof window.setCameraFocusOverride === 'function') {
                        window.setCameraFocusOverride('hook', 0, 3500);
                    }
                    const camDir = new THREE.Vector3();
                    camera.getWorldDirection(camDir);
                    camDir.y = 0; camDir.normalize();
                    dragPlane.setFromNormalAndCoplanarPoint(camDir, phy.hookPos);
                    document.getElementById('sim-status-text').textContent = 'Đang kéo móc. Cáp giữ đúng chiều dài đã đặt: chùng thì nằm trên nóc, căng tới đâu thì nhấc điểm đó lên trước.';

                } else if (dragType === 'cog') {
                    dragTarget = { type: 'cog' };
                    if (typeof window.setCameraFocusOverride === 'function') {
                        window.setCameraFocusOverride('cog', 0, 4000);
                    }
                    const worldCoG = new THREE.Vector3();
                    cogIndicatorGroup.getWorldPosition(worldCoG);
                    const camDir = new THREE.Vector3();
                    camera.getWorldDirection(camDir);
                    dragPlane.setFromNormalAndCoplanarPoint(camDir, worldCoG);
                    document.getElementById('sim-status-text').textContent = '🎯 Đang kéo trực tiếp Trọng Tâm (CoG) 3D của kiện hàng...';

                } else if (dragType === 'lp') {
                    dragTarget = { type: 'lp', index: lpIndex };
                    selectLPTab(String(lpIndex));
                    if (typeof window.setCameraFocusOverride === 'function') {
                        window.setCameraFocusOverride('lp', lpIndex, 4000);
                    }
                    const worldLP = new THREE.Vector3();
                    padEyeMeshes[lpIndex].getWorldPosition(worldLP);
                    // Drag along horizontal plane at the pad-eye's current world height
                    dragPlane.setFromNormalAndCoplanarPoint(new THREE.Vector3(0, 1, 0), worldLP);
                    document.getElementById('sim-status-text').textContent = `📍 Đang kéo trực tiếp Điểm Neo LP${lpIndex + 1} trên mặt kiện hàng...`;

                } else if (dragType === 'cargoYaw') {
                    dragTarget = { type: 'cargoYaw' };
                    if (typeof window.setCameraFocusOverride === 'function') {
                        window.setCameraFocusOverride('cargoYaw', 0, 3500);
                    }
                    const gy = (typeof groundSurfaceY === 'function') ? groundSurfaceY(phy.cargoPos.x, phy.cargoPos.z) : 0;
                    dragPlane.setFromNormalAndCoplanarPoint(new THREE.Vector3(0, 1, 0), new THREE.Vector3(phy.cargoPos.x, gy, phy.cargoPos.z));
                    document.getElementById('sim-status-text').textContent = (state.lang === 'en')
                        ? '🧭 Rotating cargo ground orientation (yaw)...'
                        : '🧭 Đang kéo xoay hướng kiện hàng trên nền đất...';
                }
            }
        }

        function onPointerMove(e) {
            mouse.x = (e.clientX / window.innerWidth) * 2 - 1;
            mouse.y = -(e.clientY / window.innerHeight) * 2 + 1;
            raycaster.setFromCamera(mouse, camera);

            ctrlPickPointer.x = e.clientX;
            ctrlPickPointer.y = e.clientY;
            // Keep Ctrl-pick mode in sync even if keydown was missed (focus/OS quirks)
            if ((e.ctrlKey || e.metaKey) && !state.cutToolActive && !isTypingFocusTarget(document.activeElement)) {
                if (!ctrlPickActive) setCtrlPickMode(true);
                updateCtrlPickHover(e);
            } else if (ctrlPickActive && !(e.ctrlKey || e.metaKey)) {
                setCtrlPickMode(false);
            }

            if (state.cutToolActive) {
                updateCutToolHover();
                return;
            }

            // Promote Ctrl click → marquee once the pointer travels past threshold
            if (pendingCtrlSelect && !marqueeSelect) {
                pendingCtrlSelect.x1 = e.clientX;
                pendingCtrlSelect.y1 = e.clientY;
                const dx = pendingCtrlSelect.x1 - pendingCtrlSelect.x0;
                const dy = pendingCtrlSelect.y1 - pendingCtrlSelect.y0;
                if ((dx * dx + dy * dy) >= CTRL_MARQUEE_THRESH_PX * CTRL_MARQUEE_THRESH_PX) {
                    marqueeSelect = {
                        x0: pendingCtrlSelect.x0,
                        y0: pendingCtrlSelect.y0,
                        x1: pendingCtrlSelect.x1,
                        y1: pendingCtrlSelect.y1,
                        additive: !!pendingCtrlSelect.additive
                    };
                    pendingCtrlSelect = null;
                    document.body.style.cursor = 'crosshair';
                    updateMarqueeEl();
                }
                return;
            }

            if (marqueeSelect) {
                marqueeSelect.x1 = e.clientX;
                marqueeSelect.y1 = e.clientY;
                updateMarqueeEl();
                document.body.style.cursor = 'crosshair';
                return;
            }

            if (!dragTarget) {
                if (ctrlPickActive) return; // reticle owns the cursor
                const hits = raycaster.intersectObjects(getInteractiveGizmos(), false);
                document.body.style.cursor = hits.length > 0 ? 'grab' : 'default';
                return;
            }

            const intersectPt = new THREE.Vector3();
            if (!raycaster.ray.intersectPlane(dragPlane, intersectPt)) return;

            if (dragTarget.type === 'cargoYaw') {
                const dx = intersectPt.x - phy.cargoPos.x;
                const dz = intersectPt.z - phy.cargoPos.z;
                let angleDeg = -Math.atan2(dz, dx) * 180 / Math.PI;
                if (!e.shiftKey) {
                    angleDeg = Math.round(angleDeg / 5) * 5;
                } else {
                    angleDeg = Math.round(angleDeg);
                }
                if (typeof window.applyYawChange === 'function') {
                    window.applyYawChange(angleDeg);
                }
                return;
            }

            if (dragTarget.type === 'hook') {
                setHookDragCommand(intersectPt);

            } else if (dragTarget.type === 'cog') {
                const localPt = cargoRootGroup.worldToLocal(intersectPt.clone());
                const { L, W, H } = state;
                state.cogX = THREE.MathUtils.clamp(localPt.x, -L * 0.45, L * 0.45);
                state.cogY = THREE.MathUtils.clamp(localPt.y, -H * 0.45, H * 0.45);
                state.cogZ = THREE.MathUtils.clamp(localPt.z, -W * 0.45, W * 0.45);
                syncCoGSlidersFromState();
                rebuildCargoAndRig(false);

            } else if (dragTarget.type === 'lp') {
                const idx = dragTarget.index;
                const shellHits = raycaster.intersectObject(activeCargoVisual, true);
                let welded = false;
                for (let hi = 0; hi < shellHits.length; hi++) {
                    const meshHit = shellHits[hi];
                    if (!meshHit.face || !meshHit.object) continue;
                    const nWorld = meshHit.face.normal.clone().transformDirection(meshHit.object.matrixWorld).normalize();
                    if (nWorld.dot(raycaster.ray.direction) > -0.04) continue;
                    const localPt = cargoRootGroup.worldToLocal(meshHit.point.clone());
                    const nLocal = nWorld.clone().transformDirection(new THREE.Matrix4().copy(cargoRootGroup.matrixWorld).invert()).normalize();
                    state.lugs[idx].copy(localPt);
                    state.lugNormals[idx].copy(nLocal);
                    state.pendingConform = 'skip';
                    rebuildCargoAndRig(false);
                    welded = true;
                    break;
                }
                if (!welded) {
                    const localPt = cargoRootGroup.worldToLocal(intersectPt.clone());
                    const { L, W } = state;
                    state.lugs[idx].x = THREE.MathUtils.clamp(localPt.x, -L / 2 + 0.05, L / 2 - 0.05);
                    state.lugs[idx].z = THREE.MathUtils.clamp(localPt.z, -W / 2 + 0.05, W / 2 - 0.05);
                    state.pendingConform = 'nearest';
                    rebuildCargoAndRig(false);
                }
            }
        }

        function finishPendingCtrlClick(e) {
            const gesture = pendingCtrlSelect;
            pendingCtrlSelect = null;
            controls.enabled = true;
            if (state.cameraFollow) state.cameraFollow.orbiting = false;
            if (!gesture) return;
            const gizmoHits = raycaster.intersectObjects(getInteractiveGizmos(), false);
            let gear = pickGearNearPointer(gesture.x1, gesture.y1, 48);
            if (!gear && gizmoHits.length) {
                if (gizmoHits[0].object.userData.dragType === 'lp') {
                    gear = { kind: 'shackle', role: null, index: gizmoHits[0].object.userData.lpIndex };
                } else if (gizmoHits[0].object.userData.dragType === 'hook') {
                    gear = { kind: 'hook', role: null, index: 0 };
                } else if (gizmoHits[0].object.userData.dragType === 'cog') {
                    gear = { kind: 'cargo', role: null, index: 0 };
                }
            }
            if (gear) {
                applyGearSelection(gear, e || { ctrlKey: true });
                document.body.style.cursor = 'default';
                return;
            }
            // Ctrl-click empty space → clear selection
            closeGearEditor();
            document.body.style.cursor = 'default';
            const status = document.getElementById('sim-status-text');
            if (status) {
                status.textContent = L(
                    'Selection cleared. Hold Ctrl to pick or drag a box; Shift+drag orbits the camera.',
                    'Đã bỏ chọn. Giữ Ctrl để chọn hoặc kéo khung; Shift+kéo xoay góc camera.'
                );
            }
        }

        function onPointerUp(e) {
            if (marqueeSelect) {
                // Ctrl+drag box replaces selection; empty box clears
                finishMarqueeSelect(false);
                if (state.cameraFollow) state.cameraFollow.orbiting = false;
                return;
            }
            if (pendingCtrlSelect) {
                // Sync ray to release point before single pick
                mouse.x = (e.clientX / window.innerWidth) * 2 - 1;
                mouse.y = -(e.clientY / window.innerHeight) * 2 + 1;
                raycaster.setFromCamera(mouse, camera);
                pendingCtrlSelect.x1 = e.clientX;
                pendingCtrlSelect.y1 = e.clientY;
                finishPendingCtrlClick(e);
                return;
            }
            controls.enabled = true;
            if (dragTarget) {
                if (dragTarget.type === 'hook') {
                    // Releasing the mouse is a controlled hoist stop.  Do not
                    // let a target accumulated during a quick drag keep pulling
                    // the hook after the user has let go.
                    phy.hookTarget.copy(phy.hookPos);
                    phy.dragHookSpeed = 0;
                    phy.dragHookLoadCoupling = 0;
                }
                dragTarget = null;
                document.body.style.cursor = 'default';
                document.getElementById('sim-status-text').textContent = L(
                    'Hold Ctrl — circle picks a part, click or drag a box to select. Click empty space to clear. Shift+drag adjusts camera angle.',
                    'Giữ Ctrl — vòng tròn quét chi tiết, click hoặc kéo khung để chọn. Click chỗ trống để bỏ chọn. Shift+kéo chỉnh góc camera.'
                );
            }
        }

