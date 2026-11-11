/**
 * plan_wizard — Vertical stack builder: pick layers top→bottom, live 3D connect.
 */
        const PlanWizard = (() => {
            const LAYERS = ['top', 'structure', 'cables', 'cargo'];

            const draft = {
                topMode: 'hook1',
                structure: 'spreader',
                stsSizeFt: 40,
                stsTwinLift: false,
                stsAttachMode: 'direct',
                slingType: 'wire',
                lugCount: 4,
                upperLen: 8,
                lowerLen: 2,
                hangerLen: 2,
                wll: 15,
                cargoId: 'flatrack',
                weight: 22,
                L: 12.192,
                W: 2.438,
                H: 2.591,
                craneType: 'hook_only',
                lugElev: 'top'
            };

            let activeLayer = 'top';
            let bound = false;
            let previewTimer = null;

            function isEn() {
                return state.lang === 'en';
            }

            function T(en, vi) {
                return isEn() ? en : vi;
            }

            function open() {
                activeLayer = 'top';
                seedDraftFromState();
                render();
                if (window.UI?.layout) window.UI.layout.openModal('plan-wizard-modal');
                else {
                    const m = document.getElementById('plan-wizard-modal');
                    if (m) { m.classList.add('open'); m.style.display = 'flex'; }
                }
                schedulePreview(true);
            }

            function close() {
                if (window.UI?.layout) window.UI.layout.closeModal('plan-wizard-modal');
                else {
                    const m = document.getElementById('plan-wizard-modal');
                    if (m) { m.classList.remove('open'); m.style.display = 'none'; }
                }
            }

            function seedDraftFromState() {
                draft.topMode = state.beamType === 'container_spreader'
                    ? 'container_spreader'
                    : ((state.hookCount || 1) >= 2 ? 'hook2' : 'hook1');
                draft.structure = state.beamType === 'container_spreader' ? 'spreader' : (state.beamType || 'spreader');
                draft.stsSizeFt = state.stsSizeFt || 40;
                draft.stsTwinLift = !!state.stsTwinLift;
                draft.stsAttachMode = state.stsAttachMode === 'cable' ? 'cable' : 'direct';
                draft.slingType = state.slingType || 'wire';
                draft.lugCount = state.planLugCount || (state.lugs && state.lugs.length) || 4;
                draft.upperLen = state.upperSlingLength != null ? state.upperSlingLength : (state.slingLength || 8);
                draft.lowerLen = state.lowerSlingLength != null ? state.lowerSlingLength : 2;
                draft.hangerLen = state.hangerSlingLength != null ? state.hangerSlingLength : 2;
                draft.wll = state.wllPerLeg || 15;
                draft.cargoId = state.cargoType || 'flatrack';
                draft.weight = state.weight || 22;
                draft.L = state.L || 12.192;
                draft.W = state.W || 2.438;
                draft.H = state.H || 2.591;
                draft.craneType = state.craneType || 'hook_only';
                draft.lugElev = state.lugElevPreset || 'top';
            }

            function applyStsSizeToDraft(ft) {
                if (ft === 'twin' || ft === 'Twin') {
                    draft.stsTwinLift = true;
                    draft.stsSizeFt = 40;
                    ft = 40;
                } else {
                    draft.stsTwinLift = false;
                    draft.stsSizeFt = ft;
                }
                const iso = (typeof isoTwistlockSpan === 'function')
                    ? isoTwistlockSpan(ft)
                    : { outerL: ft <= 20 ? 6.058 : (ft >= 45 ? 13.716 : 12.192), outerW: 2.438, outerH: ft >= 45 ? 2.896 : 2.591, cargoId: ft <= 20 ? 'container' : 'iso40' };
                draft.cargoId = iso.cargoId || draft.cargoId;
                draft.L = iso.outerL;
                draft.W = iso.outerW;
                draft.H = iso.outerH;
                draft.lugCount = 4;
                draft.upperLen = 2.4;
                draft.lowerLen = 0.22;
            }

            function resolveBeamType() {
                if (draft.topMode === 'container_spreader') return 'container_spreader';
                if (draft.lugCount >= 8) return 'spatial8';
                if (draft.lugCount === 2) return 'none';
                return draft.structure || 'spreader';
            }

            function resolveHookCount() {
                return draft.topMode === 'hook2' ? 2 : 1;
            }

            function needsHanger() {
                const b = resolveBeamType();
                return ['cascaded', 'modular_truss', 'spatial8'].includes(b)
                    || draft.structure === 'cascaded' || draft.structure === 'modular_truss';
            }

            function structureSkipped() {
                return draft.topMode === 'container_spreader';
            }

            function applyDraft(opts) {
                const finalApply = !!(opts && opts.final);
                const beam = resolveBeamType();
                const hooks = resolveHookCount();

                state.hookCount = hooks;
                state.planLugCount = beam === 'container_spreader' ? 4 : draft.lugCount;
                state.beamType = beam;
                state.stsSizeFt = draft.stsSizeFt || 40;
                state.stsTwinLift = !!draft.stsTwinLift;
                state.stsAttachMode = draft.stsAttachMode === 'cable' ? 'cable' : 'direct';
                state.slingType = beam === 'container_spreader' ? 'wire' : draft.slingType;
                state.craneType = draft.craneType || 'hook_only';
                state.lugElevPreset = draft.lugElev || 'top';
                state.pendingConform = 'structural';

                const even = (v, lo, hi) => {
                    let e = Math.round(Number(v) / 2) * 2;
                    if (e < lo) e = lo;
                    return Math.max(lo, Math.min(hi, e));
                };
                    if (beam === 'container_spreader') {
                    // Short hoist falls into headblock; lower = twistlock OR cable/chain legs
                    state.upperSlingLength = Math.max(1.2, Number(draft.upperLen) || 2.4);
                    state.slingLength = state.upperSlingLength;
                    state.lowerSlingLength = state.stsAttachMode === 'cable'
                        ? Math.max(1.0, Number(draft.lowerLen) || 2.0)
                        : 0.06;
                    state.hangerSlingLength = 2;
                    state.slingUserSet = true;
                    // Span = ISO twistlock centres (not outer / phủ bì)
                    const isoSpan = (typeof isoTwistlockSpan === 'function')
                        ? isoTwistlockSpan(state.stsSizeFt || 40)
                        : { spanX: 11.985, spanZ: 2.259 };
                    if (!state.gear) state.gear = {};
                    if (!state.gear.beam) state.gear.beam = {};
                    state.gear.beam.lengthM = isoSpan.spanX;
                    state.gear.beam.widthM = isoSpan.spanZ;
                    state.customBeamLengthMode = true;
                } else {
                    state.upperSlingLength = even(draft.upperLen, 8, 14);
                    state.slingLength = state.upperSlingLength;
                    state.lowerSlingLength = beam === 'none' ? state.upperSlingLength : even(draft.lowerLen, 2, 8);
                    state.hangerSlingLength = even(draft.hangerLen, 2, 8);
                    state.slingUserSet = true;
                }
                state.cableAdjustMode = false;
                state.wllPerLeg = Math.max(1, Number(draft.wll) || 15);
                state.holdCableLength = false;
                state.heldCableL0 = null;

                const cat = (typeof libraryCatalog !== 'undefined' && libraryCatalog.cargo)
                    ? libraryCatalog.cargo.find(c => c.id === draft.cargoId)
                    : null;
                state.cargoType = draft.cargoId;
                state.weightUserSet = true;
                if (cat) {
                    if (typeof setDimAndCoG === 'function') {
                        setDimAndCoG({
                            L: draft.L || cat.L,
                            W: draft.W || cat.W,
                            H: draft.H || cat.H,
                            weight: draft.weight || cat.weight,
                            cogX: cat.cogX != null ? cat.cogX : 0,
                            cogY: cat.cogY != null ? cat.cogY : -0.1,
                            cogZ: cat.cogZ != null ? cat.cogZ : 0
                        });
                    } else {
                        state.L = draft.L || cat.L;
                        state.W = draft.W || cat.W;
                        state.H = draft.H || cat.H;
                        state.weight = draft.weight || cat.weight;
                    }
                    if (cat.isoCode) state.isoCode = cat.isoCode;
                    if (cat.tareT != null) state.tareT = cat.tareT;
                    if (cat.maxPayloadT != null) state.maxPayloadT = cat.maxPayloadT;
                    if (cat.maxGrossT != null) state.maxGrossT = cat.maxGrossT;
                } else {
                    state.L = draft.L; state.W = draft.W; state.H = draft.H; state.weight = draft.weight;
                }

                const syncActive = (sel, attr, val) => {
                    document.querySelectorAll(sel).forEach(el => {
                        el.classList.toggle('active', el.getAttribute(attr) === val);
                    });
                };
                syncActive('#cargo-library .card-btn', 'data-cargo', state.cargoType);
                syncActive('#beam-store .card-btn', 'data-beam', state.beamType);
                syncActive('#sling-store .card-btn', 'data-sling', state.slingType);
                syncActive('#crane-store .card-btn', 'data-crane', state.craneType);

                if (typeof buildCraneVehicle === 'function') buildCraneVehicle();
                if (typeof rebuildCargoAndRig === 'function') rebuildCargoAndRig(true);
                if (typeof syncSlingSlidersFromState === 'function') syncSlingSlidersFromState();
                if (typeof computeRiggingMassBreakdown === 'function') computeRiggingMassBreakdown();
                if (typeof updateRiggingBOMUI === 'function') updateRiggingBOMUI();
                if (typeof syncHookToRigTaut === 'function') syncHookToRigTaut();

                const status = document.getElementById('sim-status-text');
                if (status) {
                    status.textContent = finalApply
                        ? T('✅ Lift plan applied — drag CoG / LP in 3D.', '✅ Đã áp dụng — kéo CoG / LP trên 3D.')
                        : T('🔄 Stack updated in 3D', '🔄 Đã nối khối 3D theo stack');
                }
                updateStackVisual();
            }

            function schedulePreview(immediate) {
                if (previewTimer) clearTimeout(previewTimer);
                const run = () => {
                    try { applyDraft({ final: false }); } catch (e) { console.warn(e); }
                };
                if (immediate) run();
                else previewTimer = setTimeout(run, 120);
            }

            function topLabel() {
                if (draft.topMode === 'hook2') return T('2 cranes / tandem', '2 móc · 2 cẩu');
                if (draft.topMode === 'container_spreader') return T(`STS ${draft.stsSizeFt}ft`, `STS ${draft.stsSizeFt}ft`);
                return T('1 Hook', '1 Móc');
            }

            function structureLabel() {
                if (structureSkipped()) return T(`Telescopic ${draft.stsSizeFt}ft`, `Bung ${draft.stsSizeFt}ft · twistlock`);
                const map = {
                    none: T('Direct bridle', 'Chùm cáp trực tiếp'),
                    spreader: T('Spreader beam', 'Dầm ngáng'),
                    lifting_beam: T('Lifting beam', 'Dầm nâng'),
                    frame: T('H-frame', 'Khung H'),
                    cascaded: T('Cascaded tiers', 'Nhiều tầng'),
                    modular_truss: T('Lattice truss', 'Giàn không gian'),
                    basket: T('Basket cradle', 'Ngáng ôm đáy'),
                    spatial8: T('8-pt tree', 'Cây 8 điểm'),
                    container_spreader: T('ISO spreader', 'Khung container')
                };
                return map[resolveBeamType()] || draft.structure;
            }

            function cargoLabel() {
                const cat = (typeof libraryCatalog !== 'undefined' && libraryCatalog.cargo)
                    ? libraryCatalog.cargo.find(c => c.id === draft.cargoId)
                    : null;
                const name = cat ? (cat.name || cat.id).split('—')[0].trim() : draft.cargoId;
                return `${name} · ${draft.weight} t`;
            }

            function chip(group, value, title, selected) {
                return `<button type="button" class="wiz-chip ${selected ? 'active' : ''}" data-wiz-group="${group}" data-wiz-val="${value}">${title}</button>`;
            }

            function optionRow(group, value, title, sub, selected) {
                return `<button type="button" class="wiz-opt ${selected ? 'active' : ''}" data-wiz-group="${group}" data-wiz-val="${value}">
                    <div class="text-[12px] font-bold ${selected ? 'text-sky-200' : 'text-white'}">${title}</div>
                    ${sub ? `<div class="text-[10px] text-slate-400 mt-0.5">${sub}</div>` : ''}
                </button>`;
            }

            function renderStackVisual() {
                const beam = resolveBeamType();
                const showStruct = beam !== 'none';
                const sts = draft.topMode === 'container_spreader';
                const blocks = sts ? [
                    { id: 'top', icon: '▣', label: T('Hoist / headblock', 'Tời / headblock'), on: true },
                    { id: 'struct', icon: '▬', label: `STS ${draft.stsSizeFt}ft · twistlock`, on: true },
                    { id: 'cargo', icon: '▢', label: cargoLabel(), on: true }
                ] : [
                    { id: 'top', icon: draft.topMode === 'hook2' ? '◉◉' : '◉', label: topLabel(), on: true },
                    { id: 'upper', icon: '┆', label: `${draft.slingType} · ${draft.upperLen} m`, on: true, slim: true },
                    showStruct
                        ? { id: 'struct', icon: '▬', label: structureLabel(), on: true }
                        : null,
                    showStruct
                        ? { id: 'lower', icon: '┆', label: `${draft.lugCount}× · ${draft.lowerLen} m · ${draft.wll} t`, on: true, slim: true }
                        : { id: 'lower', icon: '┆', label: `${draft.lugCount}× · ${draft.upperLen} m · ${draft.wll} t`, on: true, slim: true },
                    { id: 'cargo', icon: '▣', label: cargoLabel(), on: true }
                ].filter(Boolean);

                return `<div class="wiz-stack-visual" id="wiz-stack-visual">
                    ${blocks.map((b, i) => `
                        <div class="wiz-stack-block ${b.slim ? 'slim' : ''} ${b.on ? 'on' : ''} ${activeLayer === b.id || (b.id === 'struct' && activeLayer === 'structure') || ((b.id === 'upper' || b.id === 'lower') && activeLayer === 'cables') ? 'focus' : ''}" data-stack="${b.id}">
                            <span class="wiz-stack-ico">${b.icon}</span>
                            <span class="wiz-stack-lab">${b.label}</span>
                        </div>
                        ${i < blocks.length - 1 ? '<div class="wiz-stack-link"></div>' : ''}
                    `).join('')}
                </div>`;
            }

            function updateStackVisual() {
                const host = document.getElementById('wiz-stack-host');
                if (host) host.innerHTML = renderStackVisual();
            }

            function layerHeader(id, num, title, summary) {
                const open = activeLayer === id;
                return `<button type="button" class="wiz-layer-hd ${open ? 'open' : ''}" data-wiz-layer="${id}">
                    <span class="wiz-layer-num">${num}</span>
                    <span class="wiz-layer-title">${title}</span>
                    <span class="wiz-layer-sum">${summary}</span>
                    <span class="wiz-layer-chev">${open ? '▾' : '▸'}</span>
                </button>`;
            }

            function renderLayerTop() {
                return `<div class="wiz-layer-body">
                    <div class="text-[10px] text-slate-400 mb-2">${T('How does the lift start at the top?', 'Chọn cách kéo ở đỉnh — khối trên cùng')}</div>
                    <div class="grid grid-cols-1 gap-1.5">
                        ${optionRow('topMode', 'hook1', T('1 Crane Hook', '1 Móc cẩu'),
                            T('Normal single-hook lift (as now)', 'Kéo 1 móc như hiện tại'), draft.topMode === 'hook1')}
                        ${optionRow('topMode', 'hook2', T('2 Crane Hooks (tandem)', '2 Móc · 2 cần cẩu'),
                            T('Two cranes lifting together', 'Hai cần cẩu làm hàng cùng lúc'), draft.topMode === 'hook2')}
                        ${optionRow('topMode', 'container_spreader', T('STS Container Spreader', 'Spreader STS Container'),
                            T('Telescopic 20/40/45ft twistlock frame — no hook bridle', 'Ngáng bung 20/40/45ft · twistlock · không móc+4 cáp'), draft.topMode === 'container_spreader')}
                    </div>
                </div>`;
            }

            function renderLayerStructure() {
                if (structureSkipped()) {
                    return `<div class="wiz-layer-body">
                        <div class="text-[10px] text-slate-400 mb-2">${T('Telescopic ISO size (STS)', 'Chiều dài bung ngáng STS (chuẩn ISO)')}</div>
                        <div class="grid grid-cols-2 gap-1.5 mb-2">
                            ${[
                                [20, '20 ft', 'Retracted'],
                                [40, '40 ft', 'Master'],
                                [45, '45 ft', 'Extended'],
                                ['twin', '2×20 Twin', 'Twin-lift']
                            ].map(([v, t, s]) => optionRow(
                                'stsSizeFt', String(v), t, s,
                                v === 'twin' ? !!draft.stsTwinLift : (!draft.stsTwinLift && draft.stsSizeFt === v)
                            )).join('')}
                        </div>
                        <div class="text-[10px] text-slate-400 mb-1.5 mt-1">${T('How does the spreader grab the cargo?', 'Cách ngáng bắt kiện')}</div>
                        <div class="grid grid-cols-1 gap-1.5 mb-2">
                            ${optionRow('stsAttachMode', 'direct',
                                T('Direct twistlock', 'Gắp trực tiếp'),
                                T('Pins lock onto ISO corner castings — no lower slings', 'Twistlock chụp góc ISO — không cáp/ma ní dưới'),
                                draft.stsAttachMode !== 'cable')}
                            ${optionRow('stsAttachMode', 'cable',
                                T('Cable / chain legs', 'Dùng cáp / xích'),
                                T('Underside shackles → sling/chain → cargo lugs', 'Ma ní dưới ngáng → cáp/xích → tai kiện'),
                                draft.stsAttachMode === 'cable')}
                        </div>
                        <div class="text-[11px] text-amber-200/90 p-2 rounded border border-amber-700/40 bg-amber-950/25 leading-relaxed">
                            ${T('STS spreader = headblock + telescopic yellow frame. Direct = twistlocks; Cable = pick points + slings.',
                                'Ngáng STS = headblock + khung vàng bung. Trực tiếp = twistlock; Cáp = ma ní + cáp/xích xuống kiện.')}
                        </div>
                    </div>`;
                }
                const items = [
                    ['none', T('No beam', 'Không dầm'), T('Cables hook → cargo', 'Cáp móc → kiện')],
                    ['spreader', T('Spreader beam', 'Dầm ngáng'), T('Compression + upper/lower', 'Chịu nén + cáp trên/dưới')],
                    ['lifting_beam', T('Lifting beam', 'Dầm nâng'), T('Bending, low headroom', 'Chịu uốn')],
                    ['frame', T('H-frame', 'Khung H'), T('Rigid 4-corner', 'Cứng 4 góc')],
                    ['cascaded', T('Cascaded', 'Nhiều tầng'), T('Beam + hangers + sub', 'Dầm + treo + phụ')],
                    ['modular_truss', T('Lattice truss', 'Giàn'), T('Heavy compression', 'Chịu nén lớn')],
                    ['basket', T('Basket', 'Ôm đáy'), T('Under-slings', 'Cáp dưới đáy')]
                ];
                return `<div class="wiz-layer-body">
                    <div class="text-[10px] text-slate-400 mb-2">${T('Structure under the hook — next block down', 'Kết cấu dưới móc — khối nối tiếp')}</div>
                    <div class="grid grid-cols-1 gap-1.5">
                        ${items.map(([v, t, s]) => optionRow('structure', v, t, s, draft.structure === v)).join('')}
                    </div>
                </div>`;
            }

            function renderLayerCables() {
                if (structureSkipped()) {
                    return `<div class="wiz-layer-body">
                        <div class="text-[11px] text-sky-200/90 p-2 rounded border border-sky-700/40 bg-sky-950/30 leading-relaxed">
                            ${T('STS: hoist wire falls → headblock. Twistlocks lock into ISO corner castings — no bridle cables under the frame.',
                                'STS: cáp tời → headblock. Twistlock cắm góc ISO — không có chùm cáp bridle dưới khung.')}
                        </div>
                    </div>`;
                }
                const showLower = resolveBeamType() !== 'none';
                const showHanger = needsHanger();
                return `<div class="wiz-layer-body">
                    <div class="text-[10px] text-slate-400 mb-2">${T('Slings connecting the blocks', 'Cáp / xích nối các khối')}</div>
                    <div class="mb-2">
                        <div class="text-[9px] font-bold text-slate-500 mb-1 uppercase">${T('Type', 'Loại')}</div>
                        <div class="flex flex-wrap gap-1">
                            ${[['wire', 'Wire'], ['chain', 'Chain'], ['web', 'Web'], ['round_sling', 'Round'], ['grommet', 'Grommet']]
                                .map(([v, lab]) => chip('slingType', v, lab, draft.slingType === v)).join('')}
                        </div>
                    </div>
                    <div class="mb-2">
                        <div class="text-[9px] font-bold text-slate-500 mb-1 uppercase">${T('Cargo lift points', 'Điểm móc trên kiện')}</div>
                        <div class="flex flex-wrap gap-1">
                            ${[2, 4, 8].map(n => chip('lugCount', String(n), `${n} ${T('pts', 'điểm')}`, draft.lugCount === n)).join('')}
                        </div>
                    </div>
                    <div class="grid grid-cols-2 gap-1.5">
                        <label class="wiz-field"><span>${T('Upper (m)', 'Cáp trên (m)')}</span>
                            <input type="number" id="wiz-upper" min="2" max="40" step="2" value="${draft.upperLen}"></label>
                        ${showLower ? `<label class="wiz-field"><span>${T('Lower (m)', 'Cáp dưới (m)')}</span>
                            <input type="number" id="wiz-lower" min="2" max="20" step="2" value="${draft.lowerLen}"></label>` : ''}
                        ${showHanger ? `<label class="wiz-field"><span>${T('Hanger (m)', 'Cáp treo (m)')}</span>
                            <input type="number" id="wiz-hanger" min="2" max="12" step="2" value="${draft.hangerLen}"></label>` : ''}
                        <label class="wiz-field"><span>${T('WLL / leg (t)', 'WLL / nhánh (t)')}</span>
                            <input type="number" id="wiz-wll" min="1" max="500" step="0.5" value="${draft.wll}"></label>
                    </div>
                </div>`;
            }

            function renderLayerCargo() {
                const cargos = (typeof libraryCatalog !== 'undefined' && libraryCatalog.cargo)
                    ? libraryCatalog.cargo.slice(0, 22)
                    : [
                        { id: 'flatrack', name: 'Flat Rack' },
                        { id: 'container', name: 'ISO 20ft' },
                        { id: 'iso40', name: 'ISO 40ft' },
                        { id: 'iso40hc', name: 'ISO 40ft HC' },
                        { id: 'reefer', name: 'Reefer 40HC' },
                        { id: 'opentop', name: 'Open Top 20' },
                        { id: 'isotank', name: 'ISO Tank' },
                        { id: 'transformer', name: 'Transformer' }
                    ];
                return `<div class="wiz-layer-body">
                    <div class="text-[10px] text-slate-400 mb-2">${T('Bottom block — cargo (CoG by drag in 3D)', 'Khối đáy — kiện hàng (CoG kéo trên 3D)')}</div>
                    <div class="grid grid-cols-2 gap-1 max-h-36 overflow-y-auto mb-2">
                        ${cargos.map(c => optionRow(
                            'cargoId', c.id,
                            (c.name || c.id).split('—')[0].trim(),
                            c.badge || '',
                            draft.cargoId === c.id
                        )).join('')}
                    </div>
                    <div class="grid grid-cols-2 gap-1.5 mb-2">
                        <label class="wiz-field"><span>${T('Weight (t)', 'Tải (t)')}</span>
                            <input type="number" id="wiz-weight" min="0.5" max="2000" step="0.1" value="${draft.weight}"></label>
                        <label class="wiz-field"><span>L (m)</span>
                            <input type="number" id="wiz-L" min="0.5" max="40" step="0.01" value="${draft.L}"></label>
                        <label class="wiz-field"><span>W (m)</span>
                            <input type="number" id="wiz-W" min="0.4" max="12" step="0.01" value="${draft.W}"></label>
                        <label class="wiz-field"><span>H (m)</span>
                            <input type="number" id="wiz-H" min="0.3" max="12" step="0.01" value="${draft.H}"></label>
                    </div>
                    <div class="flex flex-wrap gap-1">
                        ${[['top', T('Lug top', 'Tai đỉnh')], ['mid', T('Lug mid', 'Tai giữa')], ['bottom', T('Lug bottom', 'Tai đáy')]]
                            .map(([v, lab]) => chip('lugElev', v, lab, draft.lugElev === v)).join('')}
                    </div>
                </div>`;
            }

            function render() {
                const root = document.getElementById('plan-wizard-body');
                const title = document.getElementById('plan-wizard-title');
                const sub = document.getElementById('plan-wizard-sub');
                if (!root) return;

                if (title) title.textContent = T('Build Lift Stack', 'Xếp Khối Phương Án');
                if (sub) sub.textContent = T('Top → bottom list · live 3D connect', 'Danh sách trên → dưới · nối 3D trực tiếp');

                root.innerHTML = `
                    <div id="wiz-stack-host" class="mb-3">${renderStackVisual()}</div>
                    <div class="wiz-layer-list">
                        <div class="wiz-layer ${activeLayer === 'top' ? 'open' : ''}">
                            ${layerHeader('top', '1', T('Top / Hook', 'Đỉnh / Móc'), topLabel())}
                            ${activeLayer === 'top' ? renderLayerTop() : ''}
                        </div>
                        <div class="wiz-layer ${activeLayer === 'structure' ? 'open' : ''}">
                            ${layerHeader('structure', '2', T('Beam / Frame', 'Dầm / Khung'), structureLabel())}
                            ${activeLayer === 'structure' ? renderLayerStructure() : ''}
                        </div>
                        <div class="wiz-layer ${activeLayer === 'cables' ? 'open' : ''}">
                            ${layerHeader('cables', '3',
                                structureSkipped()
                                    ? T('Hoist / twistlocks', 'Tời / twistlock')
                                    : T('Cables & points', 'Cáp & điểm móc'),
                                structureSkipped()
                                    ? T('No bridle slings', 'Không cáp bridle')
                                    : `${draft.slingType} · ${draft.lugCount} ${T('pts', 'điểm')} · ${draft.upperLen}/${draft.lowerLen} m`)}
                            ${activeLayer === 'cables' ? renderLayerCables() : ''}
                        </div>
                        <div class="wiz-layer ${activeLayer === 'cargo' ? 'open' : ''}">
                            ${layerHeader('cargo', '4', T('Cargo', 'Kiện hàng'), cargoLabel())}
                            ${activeLayer === 'cargo' ? renderLayerCargo() : ''}
                        </div>
                    </div>
                    <p class="text-[10px] text-slate-500 mt-3 leading-relaxed">
                        ${T('Click a group header to switch. Choices stay open until you open another group. 3D updates live.',
                            'Bấm tiêu đề nhóm để đổi. Nội dung chọn giữ nguyên đến khi mở nhóm khác. 3D cập nhật ngay.')}
                    </p>
                `;

                bindLayerHeaders();
                bindOptionClicks();
                bindFieldInputs();
            }

            function readFields() {
                const map = {
                    'wiz-upper': 'upperLen',
                    'wiz-lower': 'lowerLen',
                    'wiz-hanger': 'hangerLen',
                    'wiz-wll': 'wll',
                    'wiz-weight': 'weight',
                    'wiz-L': 'L',
                    'wiz-W': 'W',
                    'wiz-H': 'H'
                };
                Object.entries(map).forEach(([id, key]) => {
                    const el = document.getElementById(id);
                    if (el) draft[key] = parseFloat(el.value) || draft[key];
                });
            }

            function bindLayerHeaders() {
                document.querySelectorAll('#plan-wizard-body [data-wiz-layer]').forEach(btn => {
                    btn.addEventListener('click', () => {
                        const next = btn.dataset.wizLayer;
                        // Only switch groups on header click (options never auto-hide the open group).
                        if (next === activeLayer) return;
                        activeLayer = next;
                        render();
                    });
                });
            }

            function bindOptionClicks() {
                document.querySelectorAll('#plan-wizard-body .wiz-opt, #plan-wizard-body .wiz-chip').forEach(btn => {
                    btn.addEventListener('click', (e) => {
                        e.stopPropagation();
                        const g = btn.dataset.wizGroup;
                        let v = btn.dataset.wizVal;
                        if (g === 'lugCount') v = parseInt(v, 10);
                        if (g === 'stsSizeFt' && v !== 'twin') v = parseInt(v, 10);
                        draft[g] = v;

                        // Stay on current accordion group — only header click switches layers.
                        if (g === 'topMode' && v === 'container_spreader') {
                            draft.structure = 'container_spreader';
                            applyStsSizeToDraft(draft.stsTwinLift ? 'twin' : (draft.stsSizeFt || 40));
                        } else if (g === 'topMode') {
                            if (draft.structure === 'container_spreader') draft.structure = 'spreader';
                            draft.upperLen = 8;
                            draft.lowerLen = 2;
                        } else if (g === 'stsSizeFt') {
                            applyStsSizeToDraft(v);
                        } else if (g === 'stsAttachMode') {
                            draft.stsAttachMode = v === 'cable' ? 'cable' : 'direct';
                            if (draft.stsAttachMode === 'cable' && (!draft.lowerLen || draft.lowerLen < 0.8)) {
                                draft.lowerLen = 2;
                            }
                            if (draft.stsAttachMode === 'direct') draft.lowerLen = 0.06;
                        } else if (g === 'lugCount') {
                            if (v === 2) draft.structure = 'none';
                            if (v === 8 && draft.structure === 'none') draft.structure = 'cascaded';
                        } else if (g === 'cargoId' && typeof libraryCatalog !== 'undefined') {
                            const cat = libraryCatalog.cargo.find(c => c.id === v);
                            if (cat) {
                                draft.L = cat.L; draft.W = cat.W; draft.H = cat.H;
                                draft.weight = cat.weight;
                            }
                        }

                        render();
                        schedulePreview(true);
                    });
                });
            }

            function bindFieldInputs() {
                ['wiz-upper', 'wiz-lower', 'wiz-hanger', 'wiz-wll', 'wiz-weight', 'wiz-L', 'wiz-W', 'wiz-H'].forEach(id => {
                    const el = document.getElementById(id);
                    if (!el) return;
                    el.addEventListener('change', () => {
                        readFields();
                        schedulePreview(true);
                    });
                    el.addEventListener('input', () => {
                        readFields();
                        updateStackVisual();
                        schedulePreview(false);
                    });
                });
            }

            function applyAndClose() {
                readFields();
                applyDraft({ final: true });
                close();
            }

            function bindUi() {
                if (bound) return;
                bound = true;
                document.getElementById('btn-open-plan-wizard')?.addEventListener('click', () => open());
                document.getElementById('btn-open-plan-wizard-header')?.addEventListener('click', () => open());
                document.getElementById('btn-open-plan-wizard-drawer')?.addEventListener('click', () => open());
                document.getElementById('btn-close-plan-wizard')?.addEventListener('click', () => close());
                document.getElementById('btn-wiz-apply')?.addEventListener('click', () => applyAndClose());
                document.getElementById('btn-wiz-preview')?.addEventListener('click', () => {
                    readFields();
                    applyDraft({ final: false });
                });
            }

            return { open, close, bindUi, render, applyDraft };
        })();

        window.PlanWizard = PlanWizard;
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => PlanWizard.bindUi());
        } else {
            PlanWizard.bindUi();
        }
