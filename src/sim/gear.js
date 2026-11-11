/**
 * gear — part of the lifting simulator.
 * These files are assembled into one module so they share state, physics and the scene.
 */
        function freshGear() {
            return {
                selection: [],
                legs: [0, 1, 2, 3, 4, 5, 6, 7].map(() => ({ lengthM: null, swlT: null, diaMm: 22, massKg: null, sf: null, grade: null, broken: false, slingType: null, parts: 1 })),
                uppers: [0, 1, 2, 3].map(() => ({ lengthM: null, swlT: null, diaMm: 26, massKg: null, sf: null, grade: null, broken: false, slingType: null, parts: 1 })),
                hangers: [0, 1, 2, 3, 4, 5].map(() => ({ lengthM: null, swlT: null, diaMm: 22, massKg: null, sf: null, grade: null, broken: false, slingType: null, parts: 1 })),
                shackles: [0, 1, 2, 3].map(() => ({ swlT: 17, massKg: null, pinMm: 32, jawMm: 44, sf: 6 })),
                beam: { swlT: 40, massT: null, lengthM: null, widthM: null, depthM: 0.24, sf: 4 },
                hook: { swlT: 65, massKg: 380, sf: 4 },
                members: {},
                extraCables: []
            };
        }

        function gearIsSelected(kind, role, index) {
            return state.gear.selection.some(s => s.kind === kind && (kind !== 'sling' || s.role === role) && s.index === index);
        }

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

        function appendSpreaderInspector(box) {
            const sel = state.gear.selection[0];
            const id = sel && sel.memberId ? sel.memberId : mainMemberId();
            const spec = id ? memberSpec(id) : null;
            if (!spec) return;
            const rec = memberStore(id);
            const addRow = (label, value, min, max, step, onChange) => {
                const wrap = document.createElement('label');
                wrap.className = 'flex items-center justify-between gap-2 text-[10px]';
                const span = document.createElement('span');
                span.className = 'text-slate-300';
                span.textContent = label;
                const input = document.createElement('input');
                input.type = 'number';
                input.step = String(step);
                input.min = String(min);
                input.max = String(max);
                input.value = Number(value).toFixed(step < 1 ? 2 : 0);
                input.className = 'w-28 bg-slate-900 border border-slate-600 rounded px-1.5 py-0.5 text-right font-mono text-[11px] text-sky-200';
                input.addEventListener('change', () => {
                    const v = parseFloat(input.value);
                    if (!isFinite(v)) return;
                    preserveOtherCables();
                    onChange(THREE.MathUtils.clamp(v, min, max));
                    scheduleRebuildSpreaderVisuals();
                    if (state.poseLock) seedBeamsFromKinematic();
                    renderGearFields();
                });
                wrap.appendChild(span);
                wrap.appendChild(input);
                box.appendChild(wrap);
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
            const gearWasOpen = !!(gear && gear.style.display !== 'none' && gear.style.display !== '');
            if (typeof closeGearEditor === 'function') closeGearEditor();
            else {
                if (gear) gear.style.display = 'none';
                document.body.classList.remove('gear-editor-open');
                state.gear.selection = [];
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

            // 1.4 Đường kính ⌀ / Bản rộng W (mm)
            const diaCol = document.createElement('div');
            diaCol.className = 'flex flex-col gap-0.5';
            const diaLabel = curType === 'web' ? 'Bản rộng W (mm):' : (curType === 'round_sling' ? 'Đường kính vỏ (mm):' : 'Đường kính ⌀ (mm):');
            diaCol.innerHTML = `<span class="text-slate-300 font-medium">${diaLabel}</span>`;
            const diaStep = (curType === 'web') ? 10 : (curType === 'round_sling' ? 5 : 2);
            const diaMin = (curType === 'web') ? 25 : (curType === 'round_sling' ? 20 : 6);
            const diaMax = (curType === 'web') ? 350 : (curType === 'round_sling' ? 150 : 90);
            const diaCtrl = createStepperControl({
                value: curDia,
                min: diaMin,
                max: diaMax,
                step: diaStep,
                decimals: 0,
                onChange: (newDia) => {
                    sel.forEach(s => {
                        const r = gearRecord(s);
                        if (r) {
                            r.diaMm = newDia;
                            r.swlT = null;
                            r.massKg = null;
                        }
                    });
                    computeRiggingMassBreakdown();
                    scheduleRebuildSpreaderVisuals();
                    renderGearFields();
                }
            });
            diaCol.appendChild(diaCtrl.wrap);
            grid1.appendChild(diaCol);

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
            grid2.className = 'grid grid-cols-2 gap-2 text-[10px]';

            // 2.1 Chiều dài làm việc L (m) - Direct precision steppers, NO SLIDER!
            const lenCol = document.createElement('div');
            lenCol.className = 'flex flex-col gap-0.5';
            const isManualLen = rec.lengthM != null;
            const lenDisplayVal = isImp ? (activeL0 * 3.28084) : activeL0;
            const lenUnit = isImp ? 'ft' : 'm';
            const lenStep = isImp ? 0.5 : 0.1;
            lenCol.innerHTML = `
                <div class="flex items-center justify-between">
                    <span class="text-slate-300 font-medium">Chiều dài làm việc (${lenUnit}):</span>
                    ${!isManualLen ? '<span class="text-[9px] px-1 py-0.2 rounded bg-sky-950 text-sky-300 border border-sky-600/40 font-mono">Auto khớp</span>' : ''}
                </div>
            `;
            const lenCtrl = createStepperControl({
                value: lenDisplayVal,
                min: isImp ? 1.0 : 0.3,
                max: isImp ? 130.0 : 40.0,
                step: lenStep,
                decimals: 2,
                onChange: (newVal) => {
                    const meters = isImp ? (newVal / 3.28084) : newVal;
                    sel.forEach(s => {
                        const r = gearRecord(s);
                        if (r) {
                            r.lengthM = meters;
                            r.userSet = true;
                        }
                    });
                    syncCableRest(false);
                    if (typeof syncCableControlsSelection === 'function') syncCableControlsSelection();
                    computeRiggingMassBreakdown();
                    renderGearFields();
                }
            });
            lenCol.appendChild(lenCtrl.wrap);
            grid2.appendChild(lenCol);

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
            const sfCol = document.createElement('div');
            sfCol.className = 'flex flex-col gap-0.5';
            sfCol.innerHTML = `
                <div class="flex items-center justify-between">
                    <span class="text-slate-300 font-medium">Hệ số an toàn SF:</span>
                    <span class="text-[9px] text-slate-400 font-mono">MBL/SWL</span>
                </div>
            `;
            const sfCtrl = createStepperControl({
                value: curSf,
                min: minStdSf || 2,
                max: 15,
                step: 0.5,
                decimals: 1,
                onChange: (newSf) => {
                    sel.forEach(s => {
                        const r = gearRecord(s);
                        if (r) {
                            r.sf = newSf;
                            r.swlT = null; // Auto update SWL to match new SF
                        }
                    });
                    computeRiggingMassBreakdown();
                    scheduleRebuildSpreaderVisuals();
                    renderGearFields();
                }
            });
            sfCol.appendChild(sfCtrl.wrap);
            grid2.appendChild(sfCol);

            // 2.5 (If leg): Tăng đơ ΔL (m)
            if (primary.role === 'leg') {
                const turnCol = document.createElement('div');
                turnCol.className = 'flex flex-col gap-0.5';
                const curTurn = (state.legDeltaL[primary.index] || 0);
                turnCol.innerHTML = `
                    <div class="flex items-center justify-between">
                        <span class="text-slate-300 font-medium">Tăng đơ ΔL (m):</span>
                        <span class="text-[9px] text-sky-400 font-mono">Tinh chỉnh</span>
                    </div>
                `;
                const turnCtrl = createStepperControl({
                    value: curTurn,
                    min: -1.5,
                    max: 2.5,
                    step: 0.02,
                    decimals: 2,
                    onChange: (newTurn) => {
                        while (state.legDeltaL.length <= primary.index) state.legDeltaL.push(0);
                        state.legDeltaL[primary.index] = THREE.MathUtils.clamp(newTurn, -1.5, 2.5);
                    }
                });
                turnCol.appendChild(turnCtrl.wrap);
                grid2.appendChild(turnCol);

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
            const isImp = state.unitSystem === 'imperial';
            const form = GEAR_FORMS[sel[0].kind] || [];

            const grid = document.createElement('div');
            grid.className = 'grid grid-cols-2 gap-2 text-[10px] bg-slate-900/60 p-2 rounded-lg border border-slate-800/80';

            form.forEach(field => {
                const values = sel.map(s => {
                    const r = gearRecord(s);
                    return r ? r[field.key] : null;
                });
                const same = values.every(v => v === values[0]);
                const isLenField = field.unit === 'm' || field.key === 'lengthM' || field.key === 'widthM' || field.key === 'depthM' || field.key === 'aM' || field.key === 'bM';
                const unitStr = isLenField ? (isImp ? 'ft' : 'm') : field.unit;
                const labelText = (field.labelKey ? bi(field.labelKey) : field.label) + (unitStr ? ` (${unitStr})` : '');

                // For shackle mass, auto calculate if null!
                if (sel[0].kind === 'shackle' && field.key === 'massKg') {
                    const r = gearRecord(sel[0]);
                    const isAuto = r && r.massKg == null;
                    const swl = (r && r.swlT) || 12;
                    const autoMass = Number((0.45 + 0.24 * Math.pow(swl, 1.18)).toFixed(1));
                    const autoCol = createAutoField({
                        label: 'Khối lượng ma ní',
                        unit: 'kg',
                        isAuto,
                        value: r && r.massKg != null ? r.massKg : autoMass,
                        autoValue: autoMass,
                        decimals: 1,
                        onManualChange: (val) => {
                            sel.forEach(s => {
                                const rec = gearRecord(s);
                                if (rec) rec.massKg = val;
                            });
                            computeRiggingMassBreakdown();
                            renderGearFields();
                        },
                        onResetAuto: () => {
                            sel.forEach(s => {
                                const rec = gearRecord(s);
                                if (rec) rec.massKg = null;
                            });
                            computeRiggingMassBreakdown();
                            renderGearFields();
                        }
                    });
                    grid.appendChild(autoCol.wrap);
                    return;
                }

                const col = document.createElement('div');
                col.className = 'flex flex-col gap-0.5';
                col.innerHTML = `<span class="text-slate-300 font-medium">${labelText}:</span>`;

                const input = document.createElement('input');
                input.type = 'number';
                input.step = isImp && isLenField ? '0.1' : String(field.step);
                input.min = isImp && isLenField ? String((field.min * 3.28084).toFixed(1)) : String(field.min);
                input.max = isImp && isLenField ? String((field.max * 3.28084).toFixed(1)) : String(field.max);
                input.className = 'w-full bg-slate-900 border border-slate-700 hover:border-sky-500 rounded px-2 py-0.5 text-right font-mono text-[11px] text-sky-200 focus:outline-none focus:border-sky-400';
                input.dataset.key = field.key;
                input.dataset.nullable = field.nullable ? '1' : '0';
                if (sel.length === 1) {
                    input.dataset.scope = '1';
                    input.dataset.kind = sel[0].kind;
                    input.dataset.role = sel[0].role || '';
                    input.dataset.index = String(sel[0].index || 0);
                    input.dataset.memberId = sel[0].memberId || '';
                }

                let rawVal = same && values[0] != null ? values[0] : null;
                if (rawVal != null) {
                    input.value = (isImp && isLenField) ? (rawVal * 3.2808399).toFixed(2) : String(rawVal);
                } else {
                    input.placeholder = same ? bi('autoVal') : bi('mixedVal');
                }

                input.addEventListener('input', () => {
                    if (input.value.trim() === '' || input.value === '-' || input.value === '.') return;
                    commitGearField(input, false);
                });
                input.addEventListener('change', () => commitGearField(input, true));

                col.appendChild(input);
                grid.appendChild(col);
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

            // Multi-select: stack one scrollable card per object (left panel)
            if (sel.length > 1) {
                const hint = document.createElement('div');
                hint.className = 'text-[10px] text-slate-400 mb-1.5 px-0.5';
                hint.textContent = L(
                    'Shift+drag a box to select. Scroll to edit each part below.',
                    'Giữ Shift + kéo khung để chọn. Cuộn xuống để chỉnh từng thiết bị.'
                );
                box.appendChild(hint);

                sel.forEach((item) => {
                    const card = document.createElement('section');
                    card.className = 'gear-item-card mb-2.5';
                    const head = document.createElement('div');
                    head.className = 'gear-item-card-head';
                    const title = document.createElement('div');
                    title.className = 'text-[11px] font-bold text-sky-300 uppercase tracking-wide';
                    title.textContent = gearItemLabel(item);
                    const rm = document.createElement('button');
                    rm.type = 'button';
                    rm.className = 'text-slate-400 hover:text-rose-300 text-[11px] px-1';
                    rm.title = L('Remove from selection', 'Bỏ khỏi lựa chọn');
                    rm.textContent = '✕';
                    rm.addEventListener('click', () => {
                        state.gear.selection = state.gear.selection.filter(s => gearItemKey(s) !== gearItemKey(item));
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
                    if (item.kind === 'sling') renderSlingInspector(body, [item]);
                    else renderGenericGearFields(body, [item]);
                    card.appendChild(body);
                    box.appendChild(card);
                });
                return;
            }

            if (sel[0].kind === 'sling') {
                renderSlingInspector(box, sel);
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
                if (key === 'lengthM' && (sel.role === 'extra' || sel.kind === 'sling')) rec.userSet = value != null;
                if (key === 'lengthM' && value == null && state.heldCableL0 && state.heldCableL0[sel.role]) {
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
                'Shift+drag a box to multi-select. Double-click one part for a single edit. Scroll the left panel to adjust each item.',
                'Giữ Shift + kéo khung chuột để chọn nhiều. Nhấp đúp một vật để sửa đơn. Cuộn panel trái để chỉnh từng mục.'
            );
            renderGearFields();
            refreshGearLive();
            // Left info panel → Auto pans cargo into free space on the right
            requestAnimationFrame(() => {
                if (typeof window.invalidateUiSafeNdcCache === 'function') {
                    window.invalidateUiSafeNdcCache();
                }
                if (typeof window.markCameraViewSettled === 'function') {
                    window.markCameraViewSettled();
                }
                if (typeof window.reframeAutoToUiSafeCenter === 'function') {
                    window.reframeAutoToUiSafeCenter({ duration: 0.4, delay: 80 });
                } else if (typeof window.startCinematicUiFrame === 'function') {
                    window.startCinematicUiFrame({ duration: 0.4, force: true });
                }
            });
        }

        function closeGearEditor() {
            const panel = document.getElementById('gear-editor');
            const wasOpen = !!(panel && panel.style.display !== 'none' && panel.style.display !== '');
            state.gear.selection = [];
            if (panel) panel.style.display = 'none';
            document.body.classList.remove('gear-editor-open');
            if (typeof syncCableControlsSelection === 'function') syncCableControlsSelection();
            if (wasOpen && typeof window.reframeAutoToUiSafeCenter === 'function') {
                window.reframeAutoToUiSafeCenter({ duration: 0.4, delay: 80 });
            } else if (wasOpen && typeof window.startCinematicUiFrame === 'function') {
                window.startCinematicUiFrame({ duration: 0.4, force: true });
            }
        }

        if (typeof window !== 'undefined') {
            window.openGearEditor = openGearEditor;
            window.closeGearEditor = closeGearEditor;
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
                if (s.kind === 'cargo') return `Kiện ${state.L.toFixed(2)}×${state.W.toFixed(2)}×${state.H.toFixed(2)} m · ${state.weight.toFixed(1)} t`;
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
                const status = document.getElementById('sim-status-text');
                if (status) {
                    status.textContent = L(
                        'No parts inside the selection box.',
                        'Không có thiết bị trong khung chọn.'
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
            const hits = raycaster.intersectObjects(objs, true);
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
            });
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

            // Clicking the main 3D view auto-collapses floating windows (unless selecting/cutting)
            const onCanvas = e.target === renderer?.domElement;
            if (onCanvas && !e.shiftKey && !state.cutToolActive && e.detail !== 2 && !e.altKey && !e.ctrlKey && !e.metaKey) {
                collapsePanelsForCanvasClick();
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

            // Shift + drag = marquee multi-select (does not steal normal camera orbit)
            if (e.shiftKey && !e.altKey) {
                marqueeSelect = {
                    x0: e.clientX,
                    y0: e.clientY,
                    x1: e.clientX,
                    y1: e.clientY,
                    additive: !!(e.ctrlKey || e.metaKey)
                };
                dragTarget = null;
                controls.enabled = false;
                if (state.cameraFollow) state.cameraFollow.orbiting = true;
                document.body.style.cursor = 'crosshair';
                updateMarqueeEl();
                e.preventDefault();
                e.stopPropagation();
                return;
            }

            // Selection only via double-click / Alt / Ctrl — plain click keeps camera free
            const forceSelect = e.detail === 2 || e.altKey || e.ctrlKey || e.metaKey;
            const gizmoHits = raycaster.intersectObjects(getInteractiveGizmos(), false);
            const wantGizmoDrag = !forceSelect && gizmoHits.length > 0;

            if (forceSelect) {
                let gear = pickGearHit();
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

            if (state.cutToolActive) {
                updateCutToolHover();
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
                const hits = raycaster.intersectObjects(getInteractiveGizmos(), false);
                document.body.style.cursor = hits.length > 0 ? 'grab' : (e.shiftKey ? 'crosshair' : 'default');
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

        function onPointerUp(e) {
            if (marqueeSelect) {
                const additive = !!(marqueeSelect.additive || (e && (e.ctrlKey || e.metaKey)));
                finishMarqueeSelect(additive);
                if (state.cameraFollow) state.cameraFollow.orbiting = false;
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
                    'Shift+drag to select parts. Orbit freely with the mouse. Drag gizmos to move hook / LP / CoG.',
                    'Giữ Shift + kéo khung để chọn thiết bị. Xoay/kéo camera tự do bằng chuột. Kéo gizmo để dịch móc / LP / CoG.'
                );
            }
        }

        function parkHookSlack() {
            const lugsW = state.lugs.map(p => p.clone().applyQuaternion(phy.cargoQuat).add(phy.cargoPos));
            const cx = lugsW.reduce((s, p) => s + p.x, 0) / 4;
            const cz = lugsW.reduce((s, p) => s + p.z, 0) / 4;
            const maxY = Math.max(...lugsW.map(p => p.y));
            let standbyHookY;
            if (state.beamType === 'spreader') {
                const halfSpan = (state.L || 12.0) * 0.5;
                const upperL = state.upperSlingLength || 8.00;
                const lowerL = state.lowerSlingLength || 2.00;
                const upperH = Math.sqrt(Math.max(0.25, upperL * upperL - halfSpan * halfSpan));
                standbyHookY = THREE.MathUtils.clamp(maxY + lowerL + upperH, 2.4, 35.0);
            } else if (state.beamType === 'frame' || state.beamType === 'lifting_beam' || state.beamType === 'container_spreader') {
                const upperL = state.upperSlingLength || 4.5;
                const lowerL = state.lowerSlingLength || 2.5;
                standbyHookY = THREE.MathUtils.clamp(maxY + lowerL + upperL * 0.8, 2.4, 35.0);
            } else {
                standbyHookY = THREE.MathUtils.clamp(maxY + (state.slingLength || 4.0) * 0.8, 2.4, 30.0);
            }
            phy.autoHoistActive = false;
            phy.hoistSpeed = 0;
            phy.hookTarget.set(cx, standbyHookY, cz);
            phy.hookPos.copy(phy.hookTarget);
            phy.hookVel.set(0, 0, 0);
            phy.legTensions = [0, 0, 0, 0];
            phy.legSlacks = [true, true, true, true];
            const hookY = document.getElementById('inp-hook-y');
            if (hookY) hookY.value = standbyHookY.toFixed(2);
            const hookNum = document.getElementById('num-hook-y');
            if (hookNum) hookNum.value = standbyHookY.toFixed(2);
            const hookLbl = document.getElementById('val-hook-y');
            if (hookLbl) hookLbl.textContent = standbyHookY.toFixed(1) + 'm';
            const dockWinchEl = document.getElementById('val-hoist-y-dock') || document.getElementById('num-hoist-y-dock');
            if (dockWinchEl) dockWinchEl.textContent = standbyHookY.toFixed(1) + 'm';
            const numHookY = document.getElementById('num-hook-y');
            if (numHookY) numHookY.value = standbyHookY.toFixed(1);
        }
