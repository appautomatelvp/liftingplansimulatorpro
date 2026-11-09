/**
 * gear — part of the lifting simulator.
 * These files are assembled into one module so they share state, physics and the scene.
 */
        function freshGear() {
            return {
                selection: [],
                legs: [0, 1, 2, 3, 4, 5, 6, 7].map(() => ({ lengthM: null, swlT: null, diaMm: 20, massKg: null, sf: 5, grade: 'iwrc', broken: false, slingType: null, parts: 1 })),
                uppers: [0, 1, 2, 3].map(() => ({ lengthM: null, swlT: null, diaMm: 24, massKg: null, sf: 5, grade: 'iwrc', broken: false, slingType: null, parts: 1 })),
                hangers: [0, 1, 2, 3, 4, 5].map(() => ({ lengthM: null, swlT: null, diaMm: 22, massKg: null, sf: 5, grade: 'iwrc', broken: false, slingType: null, parts: 1 })),
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

        function gearTitle() {
            const sel = state.gear.selection;
            if (!sel.length) return L('Gear data', 'Thông số thiết bị');
            if (sel.length === 1) {
                const s = sel[0];
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
                return bi('gearHook');
            }
            const names = state.lang === 'en'
                ? { sling: sel[0].role === 'upper' ? 'upper slings' : (sel[0].role === 'hanger' ? 'hangers' : 'sling legs'), shackle: 'shackles', beam: 'beams', hook: 'hooks', member: 'members', cargo: 'cargo units' }
                : { sling: sel[0].role === 'upper' ? 'cáp treo dầm' : (sel[0].role === 'hanger' ? 'cáp treo tầng dầm' : 'cáp nhánh'), shackle: 'ma ní', beam: 'dầm', hook: 'móc', member: 'thanh', cargo: 'kiện hàng' };
            return `${sel.length} ${names[sel[0].kind] || L('items', 'thiết bị')}`;
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
                    rebuildSpreaderVisuals();
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
            rebuildSpreaderVisuals();
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
            rebuildSpreaderVisuals();
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
            rebuildSpreaderVisuals();
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

        function cutSelectedRiggingCables() {
            const cables = selectedRiggingCables().filter(c => !cableIsBroken(c));
            const target = selectedRiggingActionText() || gearTitle();
            cables.forEach(cable => noteCableSnap(cable, `Đã chủ động cắt ${target}.`));
            return cables.length;
        }

        function repairSelectedRiggingCables() {
            const cables = selectedRiggingCables().filter(c => cableIsBroken(c));
            cables.forEach(cable => {
                const rec = gearCableRecord(cable);
                if (rec) rec.broken = false;
                clearCableBreak(cable);
            });
            return cables.length;
        }

        function syncGearEditorActionLabels() {
            const cutBtn = document.getElementById('gear-editor-cut');
            const repairBtn = document.getElementById('gear-editor-repair');
            const cargoText = selectedRiggingActionText();
            if (cutBtn) {
                cutBtn.textContent = cargoText ? `✂ Cắt ${cargoText}` : '✂ Cắt cáp';
                cutBtn.title = cargoText
                    ? `Cắt ${cargoText}; kiện hàng sẽ được giải phóng theo trọng lực.`
                    : 'Cắt các cáp đang chọn.';
            }
            if (repairBtn) {
                repairBtn.textContent = cargoText ? `Nối lại ${cargoText}` : 'Nối lại';
                repairBtn.title = cargoText ? `Nối lại ${cargoText}.` : 'Nối lại các cáp đang chọn.';
            }
        }

        function renderGearFields() {
            const box = document.getElementById('gear-editor-fields');
            const sel = state.gear.selection;
            if (!box) return;
            syncGearEditorActionLabels();
            box.innerHTML = '';
            if (!sel.length) return;

            // If multiple items are selected, show switcher pills so the user can isolate any single item with 1 click
            if (sel.length > 1) {
                const nav = document.createElement('div');
                nav.className = 'flex flex-wrap items-center gap-1 p-1 bg-slate-900/90 rounded border border-slate-700 mb-2';
                const allBtn = document.createElement('button');
                allBtn.type = 'button';
                allBtn.className = 'px-2 py-0.5 rounded text-[10px] font-bold bg-sky-600 text-white shadow';
                allBtn.textContent = `⚡ Cả nhóm (${sel.length})`;
                nav.appendChild(allBtn);

                sel.forEach((item, itemIdx) => {
                    const btn = document.createElement('button');
                    btn.type = 'button';
                    btn.className = 'px-2 py-0.5 rounded text-[10px] font-medium bg-slate-800 hover:bg-sky-700 text-slate-200 border border-slate-700';
                    let label = '';
                    if (item.kind === 'sling') {
                        if (item.role === 'upper') label = `Cáp trên ${item.index + 1}`;
                        else if (item.role === 'hanger') label = `Treo dầm ${item.index + 1}`;
                        else if (item.role === 'extra') label = `Cáp thêm ${item.index + 1}`;
                        else label = `Cáp LP${item.index + 1}`;
                    } else if (item.kind === 'shackle') {
                        label = `Ma ní LP${item.index + 1}`;
                    } else {
                        label = item.kind;
                    }
                    btn.textContent = label;
                    btn.addEventListener('click', () => {
                        state.gear.selection = [item];
                        document.getElementById('gear-editor-title').textContent = gearTitle();
                        document.getElementById('gear-editor-sub').textContent = L('Click any 3D part to edit.', 'Nhấp bất kỳ chi tiết 3D để sửa.');
                        renderGearFields();
                        refreshGearLive();
                        updateGearSelectionRings();
                    });
                    nav.appendChild(btn);
                });
                box.appendChild(nav);
            }

            const isImp = state.unitSystem === 'imperial';
            const form = GEAR_FORMS[sel[0].kind] || [];
            form.forEach(field => {
                const values = sel.map(s => {
                    const r = gearRecord(s);
                    return r ? r[field.key] : null;
                });
                const same = values.every(v => v === values[0]);
                const wrap = document.createElement('label');
                wrap.className = 'flex items-center justify-between gap-2 text-[10px]';
                const span = document.createElement('span');
                span.className = 'text-slate-300';
                const isLenField = field.unit === 'm' || field.key === 'lengthM' || field.key === 'widthM' || field.key === 'depthM' || field.key === 'aM' || field.key === 'bM';
                const unitStr = isLenField ? (isImp ? 'ft' : 'm') : field.unit;
                span.textContent = (field.labelKey ? bi(field.labelKey) : field.label) + (unitStr ? ` (${unitStr})` : '');

                const input = document.createElement('input');
                input.type = 'number';
                input.step = isImp && isLenField ? '0.1' : String(field.step);
                input.min = isImp && isLenField ? String((field.min * 3.28084).toFixed(1)) : String(field.min);
                input.max = isImp && isLenField ? String((field.max * 3.28084).toFixed(1)) : String(field.max);
                input.className = 'w-24 bg-slate-900 border border-slate-600 rounded px-1.5 py-0.5 text-right font-mono text-[11px] text-sky-200';
                input.dataset.key = field.key;
                input.dataset.nullable = field.nullable ? '1' : '0';

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

                // If this is a sling's lengthM, provide BOTH a slider AND number input side-by-side!
                if (sel[0].kind === 'sling' && field.key === 'lengthM') {
                    const slider = document.createElement('input');
                    slider.type = 'range';
                    slider.className = 'flex-1 accent-sky-400 h-1.5 cursor-pointer';
                    slider.min = input.min;
                    slider.max = input.max;
                    slider.step = input.step;
                    const valNum = parseFloat(input.value) || (isImp ? 12.0 : 3.8);
                    slider.value = String(valNum);

                    slider.addEventListener('input', () => {
                        input.value = parseFloat(slider.value).toFixed(2);
                        commitGearField(input, false);
                    });
                    input.addEventListener('input', () => {
                        const v = parseFloat(input.value);
                        if (isFinite(v)) slider.value = String(v);
                    });

                    const ctrlBox = document.createElement('div');
                    ctrlBox.className = 'flex items-center gap-2 flex-1 max-w-[280px]';
                    ctrlBox.appendChild(slider);
                    ctrlBox.appendChild(input);
                    wrap.appendChild(span);
                    wrap.appendChild(ctrlBox);
                    box.appendChild(wrap);
                    return;
                }

                wrap.appendChild(span);
                wrap.appendChild(input);
                box.appendChild(wrap);
            });
            if (sel.length === 1 && (sel[0].kind === 'member' || sel[0].kind === 'beam')) appendSpreaderInspector(box);
            if (sel.length === 1 && sel[0].kind === 'member') {
                const spec = memberSpec(sel[0].memberId);
                const note = document.createElement('div');
                note.className = 'text-[10px] font-mono text-slate-400 leading-snug';
                note.textContent = spec
                    ? L(
                        `In use: length ${spec.length.toFixed(2)} m, pick A ${spec.a.toFixed(2)} m, pick B ${spec.b.toFixed(2)} m. Positive is +X on a longitudinal beam and +Z on a transverse beam.`,
                        `Đang dùng: dài ${spec.length.toFixed(2)} m, điểm A ${spec.a.toFixed(2)} m, điểm B ${spec.b.toFixed(2)} m. Dương là +X trên dầm dọc và +Z trên dầm ngang.`
                    )
                    : '';
                box.appendChild(note);
                [['swlT', 'beamSwl', 0.5, 1, 2000], ['sf', 'beamSf', 0.5, 2, 8]].forEach(([key, labelKey, step, min, max]) => {
                    if (sel[0].kind === 'member' && key === 'swlT') return;
                    const wrap = document.createElement('label');
                    wrap.className = 'flex items-center justify-between gap-2 text-[10px]';
                    const span = document.createElement('span');
                    span.className = 'text-slate-300';
                    span.textContent = (sel[0].kind === 'member'
                        ? (key === 'swlT' ? 'SWL thanh đang chọn' : 'SF thanh đang chọn')
                        : bi(labelKey)) + (key === 'swlT' ? ' (t)' : '');
                    const input = document.createElement('input');
                    input.type = 'number';
                    input.step = String(step);
                    input.min = String(min);
                    input.max = String(max);
                    input.className = 'w-28 bg-slate-900 border border-slate-600 rounded px-1.5 py-0.5 text-right font-mono text-[11px] text-sky-200';
                    const memberRec = sel[0].kind === 'member' ? memberStore(sel[0].memberId) : state.gear.beam;
                    input.value = String(memberRec[key] != null ? memberRec[key] : (key === 'swlT' ? state.gear.beam.swlT : state.gear.beam.sf));
                    input.addEventListener('change', () => {
                        const value = parseFloat(input.value);
                        if (!isFinite(value)) return;
                        memberRec[key] = value;
                    });
                    wrap.appendChild(span);
                    wrap.appendChild(input);
                    box.appendChild(wrap);
                });
            }
            if (sel.length === 1 && (sel[0].kind === 'sling' || sel[0].kind === 'hook' || sel[0].kind === 'beam' || sel[0].kind === 'shackle' || sel[0].kind === 'member')) {
                const rec = gearRecord(sel[0]);
                const note = document.createElement('div');
                note.className = 'text-[10px] font-mono text-slate-400 leading-snug';
                if (sel[0].kind === 'sling' && rec) {
                    const parts = Math.max(1, Math.min(4, (rec && rec.parts) || 1));
                    const swl = rec.swlT != null ? rec.swlT : (sel[0].role === 'upper' ? upperSwl(sel[0].index) : legSwl(sel[0].index));
                    const diaM = Math.max(0.004, (rec.diaMm || 18) / 1000);
                    const curType = rec.slingType || (rec.grade === 'g80' || rec.grade === 'g100' ? 'chain' : (rec.grade === 'poly' ? 'web' : (rec.grade === 'hmpe' ? 'round_sling' : 'wire')));
                    const chain = curType === 'chain';
                    const E = chain ? 200e9 : (curType === 'web' || curType === 'round_sling' ? 8e9 : 110e9);
                    const fill = (curType === 'web' || curType === 'round_sling') ? 6 : 0.52;
                    const EA = E * Math.PI * diaM * diaM * 0.25 * fill * parts;
                    const L0 = rec.lengthM != null ? rec.lengthM : (state.slingLength || 4.5);
                    const cable = (phy.cables || []).find(c => c.role === sel[0].role && c.index === sel[0].index);
                    const spanNow = cable ? attachWorld(cable.a).distanceTo(attachWorld(cable.b)) : 0;
                    const fit = cable && spanNow > cable.L0 + 0.08 ? ` · thiếu ${(spanNow - cable.L0).toFixed(2)} m, không chạm đầu kia` : '';
                    const mbl = (swl * (rec.sf || (chain ? 4 : (curType === 'web' || curType === 'round_sling' ? 7 : 5))));
                    note.textContent = `Đang dùng ${cable ? cable.L0.toFixed(2) : L0.toFixed(2)} m${parts > 1 ? ` (${parts} sợi song song)` : ''} · hai đầu cách ${spanNow.toFixed(2)} m${fit} · MBL ${mbl.toFixed(1)} t · EA ${(EA / 1e6).toFixed(0)} MN`;
                    box.appendChild(note);

                    // 1. Sling Type Selector (Loại cáp / dây cẩu)
                    const typeWrap = document.createElement('div');
                    typeWrap.className = 'flex flex-col gap-1 mt-1.5 pt-1.5 border-t border-slate-800';
                    const typeHeader = document.createElement('div');
                    typeHeader.className = 'flex items-center justify-between text-[10px] text-slate-300 font-semibold';
                    typeHeader.innerHTML = '<span>Loại cáp / Dây cẩu</span><span class="text-sky-400 font-mono text-[9px]">3D + Vật lý</span>';
                    typeWrap.appendChild(typeHeader);

                    const typeSelect = document.createElement('select');
                    typeSelect.className = 'w-full bg-slate-900 border border-sky-600/60 rounded px-2 py-1 text-[11px] text-sky-200 font-medium focus:ring-1 focus:ring-sky-400';
                    [
                        ['wire', '🔩 Cáp thép (Wire Rope · IWRC)'],
                        ['chain', '⛓️ Xích tải cẩu (Alloy Chain · G80/G100)'],
                        ['web', '🎗️ Cáp vải dẹt / Cáp bẹ (Flat Webbing · EN 1492-1)'],
                        ['round_sling', '⭕ Cáp vải tròn (Endless Round Sling · EN 1492-2)'],
                        ['grommet', '🔄 Cáp vòng kín (Grommet Wire Sling)']
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
                            if (newType === 'chain') {
                                r.grade = 'g80';
                                r.sf = 4;
                                if (!r.diaMm || r.diaMm > 36 || r.diaMm < 10) r.diaMm = 16;
                            } else if (newType === 'wire') {
                                r.grade = 'iwrc';
                                r.sf = 5;
                                if (!r.diaMm || r.diaMm > 52 || r.diaMm < 12) r.diaMm = 24;
                            } else if (newType === 'web') {
                                r.grade = 'poly';
                                r.sf = 7;
                                if (!r.diaMm || r.diaMm < 30) r.diaMm = 60;
                            } else if (newType === 'round_sling') {
                                r.grade = 'poly';
                                r.sf = 7;
                                if (!r.diaMm || r.diaMm < 25) r.diaMm = 55;
                            } else if (newType === 'grommet') {
                                r.grade = 'iwrc';
                                r.sf = 5;
                                if (!r.diaMm || r.diaMm < 14) r.diaMm = 22;
                            }
                        });
                        computeRiggingMassBreakdown();
                        rebuildSpreaderVisuals();
                        renderGearFields();
                    });
                    typeWrap.appendChild(typeSelect);
                    box.appendChild(typeWrap);

                    // 2. Multi-Part / Parallel Lines Selector (Ghép thêm số lượng sợi cáp)
                    const partsWrap = document.createElement('div');
                    partsWrap.className = 'flex items-center justify-between gap-2 mt-1 text-[10px] text-slate-300';
                    const partsLabel = document.createElement('span');
                    partsLabel.innerHTML = 'Số sợi ghép / Chập (Parts):';
                    const partsSelect = document.createElement('select');
                    partsSelect.className = 'w-36 bg-slate-900 border border-slate-600 rounded px-1.5 py-0.5 text-right font-mono text-[11px] text-sky-200';
                    [
                        [1, '1 sợi (Đơn - Single)'],
                        [2, '2 sợi (Chập đôi - 2-Part)'],
                        [3, '3 sợi (Chập 3 - 3-Part)'],
                        [4, '4 sợi (Chập 4 - 4-Part)']
                    ].forEach(([val, label]) => {
                        const opt = document.createElement('option');
                        opt.value = val;
                        opt.textContent = label;
                        if (((rec.parts) || 1) === val) opt.selected = true;
                        partsSelect.appendChild(opt);
                    });
                    partsSelect.addEventListener('change', () => {
                        const pVal = parseInt(partsSelect.value, 10) || 1;
                        sel.forEach(s => {
                            const r = gearRecord(s);
                            if (r) r.parts = pVal;
                        });
                        computeRiggingMassBreakdown();
                        rebuildSpreaderVisuals();
                        renderGearFields();
                    });
                    partsWrap.appendChild(partsLabel);
                    partsWrap.appendChild(partsSelect);
                    box.appendChild(partsWrap);

                    // 3. Grade / Material Selector
                    const gradeWrap = document.createElement('div');
                    gradeWrap.className = 'flex flex-col gap-1 mt-1';
                    let gradeOptions = [];
                    if (curType === 'chain') {
                        gradeOptions = [
                            ['g80', 'Grade 80 · EN 818-4 · E 200 GPa'],
                            ['g100', 'Grade 100 · Siêu cường (+25% WLL) · E 200 GPa']
                        ];
                    } else if (curType === 'web') {
                        gradeOptions = [
                            ['poly', 'Polyester PES · EN 1492-1 · SF 7:1'],
                            ['hmpe', 'HMPE Dyneema bẹ dệt siêu bền']
                        ];
                    } else if (curType === 'round_sling') {
                        gradeOptions = [
                            ['poly', 'Polyester Core · EN 1492-2 · SF 7:1'],
                            ['hmpe', 'HMPE Dyneema Core · Siêu nhẹ siêu khỏe']
                        ];
                    } else {
                        gradeOptions = [
                            ['iwrc', 'IWRC 1960 N/mm² · Lõi thép · E 110 GPa'],
                            ['fc', 'Fiber Core (FC) 1770 N/mm² · Lõi đay · E 90 GPa']
                        ];
                    }
                    const grade = document.createElement('select');
                    grade.className = 'w-full bg-slate-900 border border-slate-600 rounded px-1.5 py-1 text-[11px] text-sky-200';
                    gradeOptions.forEach(([id, label]) => {
                        const opt = document.createElement('option');
                        opt.value = id;
                        opt.textContent = label;
                        if ((rec.grade || gradeOptions[0][0]) === id) opt.selected = true;
                        grade.appendChild(opt);
                    });
                    grade.addEventListener('change', () => {
                        sel.forEach(s => {
                            const r = gearRecord(s);
                            if (r) r.grade = grade.value;
                        });
                        computeRiggingMassBreakdown();
                        rebuildSpreaderVisuals();
                        renderGearFields();
                    });
                    gradeWrap.appendChild(grade);
                    box.appendChild(gradeWrap);

                    // 4. Synchronize All Slings in Tier (Áp dụng cho tất cả cáp cùng tầng)
                    const tierName = sel[0].role === 'upper' ? 'cáp treo dầm' : (sel[0].role === 'hanger' ? 'cáp treo tầng dầm' : 'cáp nhánh LP');
                    const syncBtn = document.createElement('button');
                    syncBtn.type = 'button';
                    syncBtn.className = 'w-full mt-1 text-[10px] font-semibold rounded bg-sky-950 hover:bg-sky-900 border border-sky-600/50 text-sky-200 py-1 px-2 flex items-center justify-center gap-1 transition-colors';
                    syncBtn.innerHTML = `<span>⇋</span><span>Áp dụng quy cách này cho tất cả ${tierName}</span>`;
                    syncBtn.addEventListener('click', () => {
                        const src = gearRecord(sel[0]);
                        if (!src) return;
                        const tierList = sel[0].role === 'upper' ? state.gear.uppers : (sel[0].role === 'hanger' ? state.gear.hangers : state.gear.legs);
                        if (tierList) {
                            tierList.forEach(item => {
                                item.slingType = src.slingType;
                                item.parts = src.parts;
                                item.grade = src.grade;
                                item.diaMm = src.diaMm;
                                item.sf = src.sf;
                                item.swlT = src.swlT;
                            });
                        }
                        computeRiggingMassBreakdown();
                        rebuildSpreaderVisuals();
                        renderGearFields();
                        const status = document.getElementById('sim-status-text');
                        if (status) status.textContent = `Đã đồng bộ quy cách cáp cho toàn bộ ${tierName}.`;
                    });
                    box.appendChild(syncBtn);

                    if (sel[0].role === 'leg') {
                        const turn = document.createElement('label');
                        turn.className = 'flex items-center justify-between gap-2 mt-1 text-[10px] text-slate-300';
                        turn.textContent = 'Tăng đơ ΔL (m)';
                        const input = document.createElement('input');
                        input.type = 'number';
                        input.step = '0.01';
                        input.className = 'w-28 bg-slate-900 border border-slate-600 rounded px-1.5 py-0.5 text-right font-mono text-[11px] text-sky-200';
                        input.value = ((state.legDeltaL[sel[0].index] || 0)).toFixed(2);
                        input.addEventListener('change', () => {
                            const v = parseFloat(input.value);
                            if (!isFinite(v)) return;
                            while (state.legDeltaL.length <= sel[0].index) state.legDeltaL.push(0);
                            state.legDeltaL[sel[0].index] = THREE.MathUtils.clamp(v, -1.5, 2.5);
                        });
                        turn.appendChild(input);
                        box.appendChild(turn);
                    }
                } else if (sel[0].kind === 'shackle' && rec) {
                    note.textContent = `Crosby WLL ${rec.swlT.toFixed(1)} t · chốt ${rec.pinMm} mm · má ${rec.jawMm} mm · tự trọng ${rec.massKg} kg · MBL ${(rec.swlT * (rec.sf || 6)).toFixed(1)} t`;
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

            const slingItems = sel.filter(s => s.kind === 'sling');
            if (slingItems.length > 0) {
                const anyIntact = slingItems.some(s => {
                    const rec = gearRecord(s);
                    return rec && !rec.broken;
                });
                const anyBroken = slingItems.some(s => {
                    const rec = gearRecord(s);
                    return rec && rec.broken;
                });
                const actBox = document.createElement('div');
                actBox.className = 'flex gap-1.5 pt-2 mt-1 border-t border-slate-800';
                if (anyIntact) {
                    const snapBtn = document.createElement('button');
                    snapBtn.type = 'button';
                    snapBtn.className = 'flex-1 text-[11px] font-bold rounded bg-rose-700 hover:bg-rose-600 active:bg-rose-800 text-white px-2 py-1.5 shadow flex items-center justify-center gap-1';
                    snapBtn.innerHTML = `<span>✂</span><span>${sel.length === 1 ? 'Cắt sợi cáp này (Đứt nhánh)' : `Cắt cả ${sel.length} cáp đang chọn`}</span>`;
                    snapBtn.addEventListener('click', () => {
                        slingItems.forEach(s => {
                            const rec = gearRecord(s);
                            const cable = (phy.cables || []).find(c => c.role === s.role && c.index === s.index);
                            // noteCableSnap is the atomic physical failure operation:
                            // it releases a placed pose, removes the A↔B constraint and
                            // creates the two gravity-driven cable remnants.  Marking the
                            // record alone only changes the UI and must never be the normal
                            // path for a user-initiated cut.
                            if (cable) noteCableSnap(cable, `Đã chủ động cắt ${gearTitle()}.`);
                            else if (rec) rec.broken = true;
                        });
                        const status = document.getElementById('sim-status-text');
                        if (status) status.textContent = `Đã chủ động cắt ${gearTitle()}.`;
                        refreshGearLive();
                        renderGearFields();
                    });
                    actBox.appendChild(snapBtn);
                }
                if (anyBroken) {
                    const fixBtn = document.createElement('button');
                    fixBtn.type = 'button';
                    fixBtn.className = 'flex-1 text-[11px] font-bold rounded bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-white px-2 py-1.5 shadow flex items-center justify-center gap-1';
                    fixBtn.innerHTML = `<span>🔗</span><span>${sel.length === 1 ? 'Nối lại sợi cáp này' : `Nối lại các cáp đứt`}</span>`;
                    fixBtn.addEventListener('click', () => {
                        slingItems.forEach(s => {
                            const rec = gearRecord(s);
                            if (rec) rec.broken = false;
                            const cable = (phy.cables || []).find(c => c.role === s.role && c.index === s.index);
                            if (cable) clearCableBreak(cable);
                        });
                        const status = document.getElementById('sim-status-text');
                        if (status) status.textContent = `Đã nối lại ${gearTitle()}.`;
                        refreshGearLive();
                        renderGearFields();
                    });
                    actBox.appendChild(fixBtn);
                }
                box.appendChild(actBox);
            }
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
            const geometryKey = isLenField;
            const slingLength = key === 'lengthM' && state.gear.selection.length > 0 && state.gear.selection.every(s => s.kind === 'sling');
            if (geometryKey && !slingLength) preserveOtherCables();
            state.gear.selection.forEach(sel => {
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
            else if (geometryKey || key === 'massT' || key === 'massKg' || key === 'diaMm' || key === 'sf') rebuildSpreaderVisuals();
            if (key === 'diaMm' || key === 'parts' || key === 'slingType' || key === 'grade' || key === 'massKg' || key === 'swlT' || key === 'sf') {
                computeRiggingMassBreakdown();
            }
            if (key === 'jawMm' || key === 'pinMm' || key === 'swlT') {
                state.gear.selection.forEach(sel => {
                    if (sel.kind !== 'shackle' || !hwMeshes[sel.index]) return;
                    const s = state.gear.shackles[sel.index];
                    const jawS = (s.jawMm || 44) / 44;
                    const rateS = Math.pow(Math.max(0.4, (s.swlT || 12) / 12), 0.33);
                    hwMeshes[sel.index].scale.setScalar(THREE.MathUtils.clamp(jawS * rateS, 0.45, 2.6));
                });
            }
            if (state.gear.selection.some(s => s.kind === 'cargo')) {
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
                const sel = state.gear.selection[0];
                const cable = sel && (phy.cables || []).find(c => c.role === sel.role && c.index === sel.index);
                status.textContent = cable
                    ? `${gearTitle()} dài ${cable.L0.toFixed(2)} m.`
                    : `Đã ghi chiều dài cho ${gearTitle()}.`;
            }
        }

        function openGearEditor() {
            const panel = document.getElementById('gear-editor');
            if (!panel) return;
            state.leftCollapsed = true;
            state.rightCollapsed = true;
            syncSheetButtons();
            panel.style.display = 'block';
            document.getElementById('gear-editor-title').textContent = gearTitle();
            document.getElementById('gear-editor-sub').textContent = state.gear.selection.length > 1
                ? L('One entry writes the whole selection.', 'Một số ghi cho cả nhóm.')
                : L('Click any 3D part to edit. Blank length or SWL follows the global slider.', 'Nhấp bất kỳ chi tiết 3D để sửa. Để trống chiều dài/SWL để theo thông số chung.');
            renderGearFields();
            refreshGearLive();
        }

        function closeGearEditor() {
            state.gear.selection = [];
            const panel = document.getElementById('gear-editor');
            if (panel) panel.style.display = 'none';
            if (typeof syncCableControlsSelection === 'function') syncCableControlsSelection();
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
            const pool = updateGearSelectionRings.pool;
            while (pool.children.length) pool.remove(pool.children[0]);
            state.gear.selection.forEach(sel => {
                const ring = new THREE.Mesh(new THREE.TorusGeometry(0.28, 0.016, 8, 24), MATS.lpSelected);
                let pos = null;
                if (sel.kind === 'sling') {
                    const sling = sling3DPool.find(s => s.group.visible && s.drawMeta && s.drawMeta.role === sel.role && s.drawMeta.index === sel.index);
                    if (sling && sling.lastMid) pos = sling.lastMid;
                } else if (sel.kind === 'shackle' && hwMeshes[sel.index]) {
                    pos = new THREE.Vector3();
                    hwMeshes[sel.index].getWorldPosition(pos);
                } else if (sel.kind === 'member' && spreaderRootGroup) {
                    pos = new THREE.Vector3();
                    let body = null;
                    spreaderRootGroup.traverse(o => {
                        if (!body && o.userData && o.userData.memberBody && o.userData.memberId === sel.memberId) body = o;
                    });
                    (body || spreaderRootGroup).getWorldPosition(pos);
                } else if (sel.kind === 'beam' && spreaderRootGroup) {
                    pos = new THREE.Vector3();
                    spreaderRootGroup.getWorldPosition(pos);
                } else if (sel.kind === 'hook') {
                    pos = phy.hookPos.clone();
                } else if (sel.kind === 'cargo' && cargoRootGroup) {
                    pos = new THREE.Vector3();
                    cargoRootGroup.getWorldPosition(pos);
                }
                if (!pos) return;
                ring.position.copy(pos);
                ring.lookAt(camera.position);
                pool.add(ring);
            });
        }

        function applyGearSelection(gear, e) {
            const inspect = e.detail === 2 || e.altKey;
            const multi = !inspect && !!(e.ctrlKey || e.metaKey);
            const item = { kind: gear.kind, role: gear.kind === 'sling' ? (gear.role || 'leg') : null, index: gear.index, memberId: gear.memberId || null };
            if (!multi) state.gear.selection = [item];
            else {
                const same = state.gear.selection.length === 0 || state.gear.selection.every(s => s.kind === item.kind && s.role === item.role);
                if (!same) state.gear.selection = [item];
                else {
                    const idx = state.gear.selection.findIndex(s => s.kind === item.kind && s.role === item.role && s.index === item.index && s.memberId === item.memberId);
                    if (idx >= 0) state.gear.selection.splice(idx, 1);
                    else state.gear.selection.push(item);
                }
            }
            if (state.gear.selection.length) {
                openGearEditor();
                if (typeof syncCableControlsSelection === 'function') syncCableControlsSelection();
            } else {
                closeGearEditor();
                if (typeof syncCableControlsSelection === 'function') syncCableControlsSelection();
            }
        }

        function pickGearHit() {
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
            return bestHit ? bestHit.gearData : null;
        }

        function bindGearEditor() {
            document.getElementById('gear-editor-close').addEventListener('click', closeGearEditor);
            document.getElementById('gear-editor-clear').addEventListener('click', closeGearEditor);
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
                    if (sel.kind === 'sling') { rec.lengthM = null; rec.swlT = null; }
                    if (sel.kind === 'beam') { rec.lengthM = null; rec.widthM = null; rec.massT = null; }
                    if (sel.kind === 'member') { rec.lengthM = null; rec.aM = null; rec.bM = null; rec.swlT = null; rec.massT = null; }
                });
                rebuildSpreaderVisuals();
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

            const forceSelect = e.detail === 2 || e.altKey || e.ctrlKey || e.metaKey;
            const gizmoHits = raycaster.intersectObjects(getInteractiveGizmos(), false);
            const wantGizmoDrag = !forceSelect && gizmoHits.length > 0;

            if (!wantGizmoDrag) {
                let gear = pickGearHit();
                if (!gear && forceSelect && gizmoHits.length) {
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
            if (hits.length > 0) {
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
                    const camDir = new THREE.Vector3();
                    camera.getWorldDirection(camDir);
                    camDir.y = 0; camDir.normalize();
                    dragPlane.setFromNormalAndCoplanarPoint(camDir, phy.hookPos);
                    document.getElementById('sim-status-text').textContent = 'Đang kéo móc. Cáp giữ đúng chiều dài đã đặt: chùng thì nằm trên nóc, căng tới đâu thì nhấc điểm đó lên trước.';

                } else if (dragType === 'cog') {
                    dragTarget = { type: 'cog' };
                    const worldCoG = new THREE.Vector3();
                    cogIndicatorGroup.getWorldPosition(worldCoG);
                    const camDir = new THREE.Vector3();
                    camera.getWorldDirection(camDir);
                    dragPlane.setFromNormalAndCoplanarPoint(camDir, worldCoG);
                    document.getElementById('sim-status-text').textContent = '🎯 Đang kéo trực tiếp Trọng Tâm (CoG) 3D của kiện hàng...';

                } else if (dragType === 'lp') {
                    dragTarget = { type: 'lp', index: lpIndex };
                    selectLPTab(String(lpIndex));
                    const worldLP = new THREE.Vector3();
                    padEyeMeshes[lpIndex].getWorldPosition(worldLP);
                    // Drag along horizontal plane at the pad-eye's current world height
                    dragPlane.setFromNormalAndCoplanarPoint(new THREE.Vector3(0, 1, 0), worldLP);
                    document.getElementById('sim-status-text').textContent = `📍 Đang kéo trực tiếp Điểm Neo LP${lpIndex + 1} trên mặt kiện hàng...`;

                } else if (dragType === 'cargoYaw') {
                    dragTarget = { type: 'cargoYaw' };
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

            if (!dragTarget) {
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

        function onPointerUp() {
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
                document.getElementById('sim-status-text').textContent = L('Drag the hook, a lifting point or the CoG in the 3D view', 'Kéo trực tiếp móc, điểm neo hoặc trọng tâm trên mô hình');
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
                const upperL = state.upperSlingLength || 8.68;
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
