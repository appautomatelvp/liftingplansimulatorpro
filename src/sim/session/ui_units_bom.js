/**
 * session/ui_units_bom — LP UI, units, topology, BOM, sling controls
 * Split from legacy god-file (strangler Phase 2). Shared scope via assemble.
 */
        // --- 12. UI EVENT BINDINGS & COLLAPSIBLE PANELS ---
        function selectLPTab(lpKey) {
            state.selectedLP = lpKey;
            document.querySelectorAll('#lp-tabs button').forEach(b => {
                const isAct = (b.dataset.lp === lpKey);
                b.className = isAct
                    ? 'py-1 rounded text-[10px] font-mono font-bold bg-sky-600 text-white border border-sky-400'
                    : 'py-1 rounded text-[10px] font-mono font-bold bg-slate-800 text-slate-300 border border-slate-700';
            });
            rebuildCargoAndRig(false);
        }

        function syncLPSlidersFromState() {
            const sel = state.selectedLP;
            const refIdx = (sel === 'all') ? 0 : parseInt(sel, 10);
            const lp = state.lugs[refIdx];

            document.getElementById('lbl-lp-x').textContent = (sel === 'all') ? L('Longitudinal |X| (all 4):', 'Khoảng cách dọc |X| (cả 4):') : L(`LP${refIdx + 1} longitudinal X:`, `Tọa độ dọc LP${refIdx + 1} (X):`);
            document.getElementById('lbl-lp-z').textContent = (sel === 'all') ? L('Transverse |Z| (all 4):', 'Khoảng cách ngang |Z| (cả 4):') : L(`LP${refIdx + 1} transverse Z:`, `Tọa độ ngang LP${refIdx + 1} (Z):`);

            const xVal = (sel === 'all') ? Math.abs(lp.x) : lp.x;
            const zVal = (sel === 'all') ? Math.abs(lp.z) : lp.z;

            const inpX = document.getElementById('inp-lpX');
            inpX.min = (sel === 'all') ? '0.2' : (-state.L / 2).toFixed(2);
            inpX.max = (state.L / 2).toFixed(2);
            inpX.value = xVal;
            document.getElementById('v-lpX').textContent = xVal.toFixed(2);

            const inpZ = document.getElementById('inp-lpZ');
            inpZ.min = (sel === 'all') ? '0.2' : (-state.W / 2).toFixed(2);
            inpZ.max = (state.W / 2).toFixed(2);
            inpZ.value = zVal;
            document.getElementById('v-lpZ').textContent = zVal.toFixed(2);

            const inpY = document.getElementById('inp-lpY');
            inpY.min = (-state.H / 2 + 0.1).toFixed(2);
            inpY.max = (state.H / 2).toFixed(2);
            inpY.value = lp.y;
            document.getElementById('v-lpY').textContent = lp.y.toFixed(2);

            const dL = state.legDeltaL[refIdx];
            document.getElementById('inp-lpDeltaL').value = dL;
            document.getElementById('v-lpDeltaL').textContent = (dL >= 0 ? '+' : '') + dL.toFixed(2);
        }

        function syncOogCargoUI(initDefaults = false) {
            const panel = document.getElementById('oog-cargo-panel');
            if (!panel) return;
            const isOpenTop = state.cargoType === 'opentop' || state.cargoType === 'opentop40';
            const isFlatRack = state.cargoType === 'flatrack' || state.cargoType === 'flatrack20';
            const isPlatform = state.cargoType === 'platform' || state.cargoType === 'platform20';
            const isDeckOog = isFlatRack || isPlatform;
            if (!isOpenTop && !isDeckOog) {
                panel.classList.add('hidden');
                return;
            }
            panel.classList.remove('hidden');

            if (initDefaults) {
                state.oogHasCargo = true;
                if (isOpenTop) {
                    state.oogTarp = true;
                    // OTR upright: L/W inside bay; H=Ø may exceed roof but must still fit in length
                    state.oogCargoL = Math.round(state.L * 0.86 * 20) / 20;
                    state.oogCargoW = Math.round(Math.min(state.W - 0.42, 0.95) * 20) / 20;
                    const fitN = state.L > 9 ? 3 : 2;
                    const maxDiaByL = (state.L - 0.44 - 0.08 * (fitN - 1)) / fitN;
                    state.oogCargoH = Math.round(Math.min(state.H * 1.18, maxDiaByL) * 20) / 20;
                } else {
                    state.oogTarp = false;
                    state.oogOh = isPlatform ? Math.max(1.2, state.H * 2.4) : 0.30;
                    if (isPlatform) {
                        // Platform: OW capped at +40 cm/side; OL free
                        state.oogOwL = 0.00;
                        state.oogOwR = 0.00;
                        state.oogOlF = 0.00;
                        state.oogOlR = 0.00;
                    } else {
                        // Flat Rack: max length still ≥40 cm clear of each end wing
                        state.oogOwL = 0.33;
                        state.oogOwR = 0.33;
                        state.oogOlF = -0.40;
                        state.oogOlR = -0.40;
                    }
                    if (typeof resolveDeckOogGeometry === 'function') {
                        const g = resolveDeckOogGeometry(state.L, state.W, state.H);
                        if (typeof applyCombinedOogCoGDefault === 'function') {
                            applyCombinedOogCoGDefault(state.L, state.W, state.H, g);
                        }
                    }
                }
            }

            const titleEl = document.getElementById('lbl-oog-title');
            if (titleEl) {
                titleEl.textContent = isOpenTop
                    ? L('2B. Open Top Cargo & Tarpaulin', '2B. Hàng Open Top & Vải Bạt Nóc')
                    : (isPlatform
                        ? L('2B. Platform Deck Cargo (OOG)', '2B. Hàng Trên Sàn Platform (OOG)')
                        : L('2B. Flat Rack OOG Cargo', '2B. Hàng Quá Khổ Flat Rack (OOG)'));
            }

            const btnCargo = document.getElementById('btn-oog-has-cargo');
            if (btnCargo) {
                btnCargo.textContent = state.oogHasCargo
                    ? L('📦 Cargo Loaded: ON', '📦 Có Hàng: BẬT')
                    : L('📦 Empty Container (Tare)', '📦 Không Hàng (Rỗng)');
                btnCargo.className = state.oogHasCargo
                    ? 'flex-1 py-1 px-2 rounded text-[10px] font-bold bg-emerald-600 text-white border border-emerald-400 shadow'
                    : 'flex-1 py-1 px-2 rounded text-[10px] font-bold bg-slate-800 text-slate-300 border border-slate-600';
            }

            const btnTarp = document.getElementById('btn-oog-tarp');
            if (btnTarp) {
                btnTarp.classList.toggle('hidden', !isOpenTop);
                btnTarp.textContent = state.oogTarp
                    ? L('⛺ Tarpaulin Cover: ON', '⛺ Phủ Bạt Nóc: BẬT')
                    : L('⛺ Open Roof (Inspect)', '⛺ Mở Bạt (Xem Hàng)');
                btnTarp.className = (isOpenTop ? '' : 'hidden ') + (state.oogTarp
                    ? 'flex-1 py-1 px-2 rounded text-[10px] font-bold bg-sky-600 text-white border border-sky-400 shadow'
                    : 'flex-1 py-1 px-2 rounded text-[10px] font-bold bg-slate-800 text-slate-300 border border-slate-600');
            }

            const dimsWrap = document.getElementById('oog-dims-wrap');
            if (dimsWrap) {
                dimsWrap.classList.toggle('opacity-40', !state.oogHasCargo);
                dimsWrap.classList.toggle('pointer-events-none', !state.oogHasCargo);
            }

            const absWrap = document.getElementById('oog-dims-absolute');
            const deltaWrap = document.getElementById('oog-dims-delta');
            if (absWrap) absWrap.classList.toggle('hidden', isDeckOog);
            if (deltaWrap) deltaWrap.classList.toggle('hidden', !isDeckOog);

            if (isDeckOog) {
                if (typeof clampDeckOogDeltas === 'function') clampDeckOogDeltas(state.L, state.W);

                const fmtSigned = (v, digits = 2) => {
                    const n = Math.round((Number(v) || 0) * 100) / 100;
                    const s = n.toFixed(digits);
                    return n > 0 ? `+${s}` : s;
                };

                // Per-type slider limits (Flat Rack end wings / Platform side rails)
                const minCrate = 0.50;
                const maxInsetL = Math.max(0.15, (state.L - minCrate) * 0.5);
                const maxInsetW = Math.max(0.15, (state.W - minCrate) * 0.5);
                const setRange = (key, lo, hi, step) => {
                    const inp = document.getElementById(`inp-${key}`);
                    const num = document.getElementById(`num-${key}`);
                    if (inp) {
                        inp.min = lo;
                        inp.max = hi;
                        if (step != null) inp.step = step;
                    }
                    if (num) {
                        num.min = lo;
                        num.max = hi;
                        if (step != null) num.step = step;
                    }
                };
                setRange('oogOh', -2, 4, 0.05);
                if (isFlatRack) {
                    setRange('oogOwL', -maxInsetW, 2.5, 0.05);
                    setRange('oogOwR', -maxInsetW, 2.5, 0.05);
                    setRange('oogOlF', -maxInsetL, -0.40, 0.05);
                    setRange('oogOlR', -maxInsetL, -0.40, 0.05);
                } else {
                    setRange('oogOwL', -maxInsetW, 0.40, 0.05);
                    setRange('oogOwR', -maxInsetW, 0.40, 0.05);
                    setRange('oogOlF', -maxInsetL, 4, 0.1);
                    setRange('oogOlR', -maxInsetL, 4, 0.1);
                }

                const lblOlF = document.getElementById('lbl-oog-olF');
                const lblOlR = document.getElementById('lbl-oog-olR');
                const lblOwL = document.getElementById('lbl-oog-owL');
                const lblOwR = document.getElementById('lbl-oog-owR');
                if (isFlatRack) {
                    if (lblOlF) lblOlF.textContent = L('ΔL front (gap ≥40cm to wing):', 'ΔL trước (cách cánh ≥40cm):');
                    if (lblOlR) lblOlR.textContent = L('ΔL rear (gap ≥40cm to wing):', 'ΔL sau (cách cánh ≥40cm):');
                    if (lblOwL) lblOwL.textContent = L('OW left (−Z):', 'OW trái (−Z):');
                    if (lblOwR) lblOwR.textContent = L('OW right (+Z):', 'OW phải (+Z):');
                } else {
                    if (lblOlF) lblOlF.textContent = L('OL front (+X):', 'OL trước (+X):');
                    if (lblOlR) lblOlR.textContent = L('OL rear (−X):', 'OL sau (−X):');
                    if (lblOwL) lblOwL.textContent = L('OW left (≤ +40cm):', 'OW trái (≤ +40cm):');
                    if (lblOwR) lblOwR.textContent = L('OW right (≤ +40cm):', 'OW phải (≤ +40cm):');
                }

                const syncDeltaField = (key, digits = 2) => {
                    const inp = document.getElementById(`inp-${key}`);
                    const lo = inp ? parseFloat(inp.min) : -5;
                    const hi = inp ? parseFloat(inp.max) : 6;
                    let v = Number(state[key]);
                    if (!Number.isFinite(v)) v = 0;
                    v = THREE.MathUtils.clamp(v, lo, hi);
                    state[key] = Math.round(v * 100) / 100;
                    const num = document.getElementById(`num-${key}`);
                    const lab = document.getElementById(`v-${key}`);
                    if (inp) inp.value = state[key];
                    if (num && document.activeElement !== num) num.value = state[key].toFixed(digits);
                    if (lab) lab.textContent = fmtSigned(state[key], digits);
                };
                ['oogOh', 'oogOwL', 'oogOwR', 'oogOlF', 'oogOlR'].forEach(k => syncDeltaField(k));

                let geom = null;
                if (typeof resolveDeckOogGeometry === 'function') {
                    geom = resolveDeckOogGeometry(state.L, state.W, state.H);
                }
                if (initDefaults && typeof applyCombinedOogCoGDefault === 'function') {
                    applyCombinedOogCoGDefault(state.L, state.W, state.H, geom);
                    if (typeof syncCoGSlidersFromState === 'function') syncCoGSlidersFromState();
                }

                const derived = document.getElementById('lbl-oog-derived');
                if (derived && geom) {
                    const gapF = isFlatRack ? Math.max(0, -geom.olF) : null;
                    const gapR = isFlatRack ? Math.max(0, -geom.olR) : null;
                    const gapNote = (isFlatRack && gapF != null)
                        ? L(` · End gaps ${gapF.toFixed(2)} / ${gapR.toFixed(2)} m`, ` · Khe cánh ${gapF.toFixed(2)} / ${gapR.toFixed(2)} m`)
                        : '';
                    derived.textContent = L(
                        `Derived crate ${geom.cL.toFixed(2)}×${geom.cW.toFixed(2)}×${geom.cH.toFixed(2)} m · Envelope CoG (${state.cogX.toFixed(2)}, ${state.cogY.toFixed(2)}, ${state.cogZ.toFixed(2)})`,
                        `Kiện quy đổi ${geom.cL.toFixed(2)}×${geom.cW.toFixed(2)}×${geom.cH.toFixed(2)} m · CoG bao (${state.cogX.toFixed(2)}, ${state.cogY.toFixed(2)}, ${state.cogZ.toFixed(2)})`
                    ) + gapNote;
                }

                const hint = document.getElementById('lbl-oog-delta-hint');
                if (hint) {
                    hint.textContent = isFlatRack
                        ? L(
                            'Flat Rack: end wings block over-length. ΔL front/rear adjust cargo length/position but each end keeps ≥40 cm clear of the wing. OW may go OOG. OH subtracts deck thickness.',
                            'Flat Rack: 2 cánh chặn quá dài. ΔL trước/sau chỉnh dài & lệch kiện nhưng mỗi đầu cách cánh ≥40 cm. OW vẫn được OOG. OH trừ thớt đáy.'
                        )
                        : L(
                            'Platform: no end walls — OL may overhang. OW left/right adjustable but ≤ +40 cm past each side edge. OH subtracts deck thickness.',
                            'Platform: không có cánh đầu — OL được thò dài. OW trái/phải chỉnh được nhưng ≤ +40 cm quá mép mỗi bên. OH trừ thớt đáy.'
                        );
                }
            } else {
                const inpH = document.getElementById('inp-oogH');
                const inpW = document.getElementById('inp-oogW');
                const inpL = document.getElementById('inp-oogL');
                const numH = document.getElementById('num-oogH');
                const numW = document.getElementById('num-oogW');
                const numL = document.getElementById('num-oogL');
                if (inpH) {
                    const fitN = state.L > 9 ? 3 : 2;
                    const maxDiaByL = (state.L - 0.44 - 0.08 * (fitN - 1)) / fitN;
                    inpH.max = Math.max(state.H * 1.35, maxDiaByL).toFixed(2);
                    if (state.oogCargoH > maxDiaByL) state.oogCargoH = Math.round(maxDiaByL * 100) / 100;
                    inpH.value = state.oogCargoH;
                    if (numH && document.activeElement !== numH) numH.value = state.oogCargoH.toFixed(2);
                    document.getElementById('v-oogH').textContent = state.oogCargoH.toFixed(2);
                }
                if (inpW) {
                    const otMaxW = Math.max(0.85, state.W - 0.40);
                    inpW.max = otMaxW.toFixed(2);
                    if (state.oogCargoW > otMaxW) state.oogCargoW = Math.min(0.95, otMaxW);
                    inpW.value = state.oogCargoW;
                    if (numW && document.activeElement !== numW) numW.value = state.oogCargoW.toFixed(2);
                    document.getElementById('v-oogW').textContent = state.oogCargoW.toFixed(2);
                }
                if (inpL) {
                    inpL.max = (state.L - 0.40).toFixed(1);
                    if (state.oogCargoL > state.L - 0.40) state.oogCargoL = Math.max(1.5, state.L - 0.40);
                    inpL.value = state.oogCargoL;
                    if (numL && document.activeElement !== numL) numL.value = state.oogCargoL.toFixed(2);
                    document.getElementById('v-oogL').textContent = state.oogCargoL.toFixed(2);
                }
            }

            const badge = document.getElementById('lbl-oog-badge');
            if (badge) {
                if (!state.oogHasCargo) {
                    badge.textContent = L('EMPTY TARE', 'CONT RỖNG');
                    badge.className = 'text-[9px] font-mono font-bold px-1.5 py-0.5 rounded bg-slate-700 text-slate-300 border border-slate-500';
                } else if (isDeckOog) {
                    const oh = state.oogOh || 0;
                    const ow = (state.oogOwL || 0) + (state.oogOwR || 0);
                    const ol = (state.oogOlF || 0) + (state.oogOlR || 0);
                    const fmt = (v) => (v > 0 ? `+${v.toFixed(2)}` : v.toFixed(2));
                    const flags = [];
                    if (Math.abs(oh) > 0.04) flags.push(`OH ${fmt(oh)}m`);
                    if (Math.abs(ow) > 0.04) flags.push(`OW ${fmt(ow)}m`);
                    if (Math.abs(ol) > 0.04) flags.push(`OL ${fmt(ol)}m`);
                    const anyOver = oh > 0.04 || ow > 0.04 || ol > 0.04;
                    if (flags.length) {
                        badge.textContent = (anyOver ? 'OOG: ' : 'INSET: ') + flags.join(' · ');
                        badge.className = anyOver
                            ? 'text-[9px] font-mono font-bold px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/40'
                            : 'text-[9px] font-mono font-bold px-1.5 py-0.5 rounded bg-sky-500/20 text-sky-300 border border-sky-500/40';
                    } else {
                        badge.textContent = 'IN-GAUGE';
                        badge.className = 'text-[9px] font-mono font-bold px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/40';
                    }
                } else {
                    const deckOffset = 0.18;
                    const overH = (state.oogCargoH + deckOffset) - state.H;
                    const overW = state.oogCargoW - state.W;
                    const overL = state.oogCargoL - state.L;
                    const flags = [];
                    if (overH > 0.04) flags.push(`OH +${overH.toFixed(2)}m`);
                    if (overW > 0.04) flags.push(`OW +${overW.toFixed(2)}m`);
                    if (overL > 0.04) flags.push(`OL +${overL.toFixed(2)}m`);
                    if (flags.length) {
                        badge.textContent = 'OOG: ' + flags.join(' · ');
                        badge.className = 'text-[9px] font-mono font-bold px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/40';
                    } else {
                        badge.textContent = 'IN-GAUGE';
                        badge.className = 'text-[9px] font-mono font-bold px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/40';
                    }
                }
            }
        }

        function syncCoGSlidersFromState() {
            document.getElementById('inp-cogX').value = state.cogX;
            document.getElementById('v-cogX').textContent = state.cogX.toFixed(2);
            document.getElementById('inp-cogZ').value = state.cogZ;
            document.getElementById('v-cogZ').textContent = state.cogZ.toFixed(2);
            document.getElementById('inp-cogY').value = state.cogY;
            document.getElementById('v-cogY').textContent = state.cogY.toFixed(2);
        }

        // --- Cable Lengths (Upper Bridle, Lower Legs, Selected Sling) & Metric/Imperial Conversion ---
        const M_TO_FT = 3.2808399;
        const FT_TO_M = 1 / 3.2808399;

        function isImperial() {
            return state.unitSystem === 'imperial';
        }

        function toDisplayLen(m) {
            if (m == null || isNaN(m)) return 0;
            return isImperial() ? (m * M_TO_FT) : m;
        }

        function fromInputLen(v) {
            if (v == null || isNaN(v)) return 0;
            return isImperial() ? (v * FT_TO_M) : v;
        }

        function getLenUnit() {
            return isImperial() ? 'ft' : 'm';
        }

        function updateUnitDisplayElements() {
            const isImp = isImperial();
            const unitStr = isImp ? 'ft' : 'm';

            const btnUnitHeader = document.getElementById('btn-unit-toggle');
            if (btnUnitHeader) {
                btnUnitHeader.innerHTML = isImp ? '📐 ft (Feet)' : '📏 m (Mét)';
                btnUnitHeader.title = isImp
                    ? (state.lang === 'en' ? 'Switch to Metric (m)' : 'Chuyển sang Hệ Mét (m)')
                    : (state.lang === 'en' ? 'Switch to Imperial (ft)' : 'Chuyển sang Hệ Feet/Inch (ft)');
            }

            const btnUnitPanel = document.getElementById('btn-unit-toggle-panel');
            const txtUnitBadge = document.getElementById('txt-unit-badge');
            if (txtUnitBadge) {
                txtUnitBadge.textContent = isImp ? (state.lang === 'en' ? 'Imperial (ft)' : 'Hệ Feet (ft)') : (state.lang === 'en' ? 'Metric (m)' : 'Hệ Mét (m)');
            }
            if (btnUnitPanel) {
                btnUnitPanel.classList.toggle('!bg-sky-700/60', isImp);
                btnUnitPanel.classList.toggle('!border-sky-400', isImp);
            }

            document.querySelectorAll('.unit-len').forEach(el => {
                el.textContent = unitStr;
            });

            // Adjust ranges & step sizes for Metric vs Imperial based on real physics geometry
            let spec = (typeof getRigSpec === 'function') ? getRigSpec() : null;
            const minUpperM = spec ? spec.minUpper : (isImp ? 3.0 : 1.0);
            const maxUpperM = spec ? spec.maxUpper : (isImp ? 90.0 : 30.0);
            const minLowerM = spec ? spec.minLower : (isImp ? 1.5 : 0.5);
            const maxLowerM = spec ? spec.maxLower : (isImp ? 90.0 : 30.0);

            const minUpper = toDisplayLen(minUpperM);
            const maxUpper = toDisplayLen(maxUpperM);
            const stepUpper = isImp ? 0.1 : 0.05;

            const minLower = toDisplayLen(minLowerM);
            const maxLower = toDisplayLen(maxLowerM);
            const stepLower = isImp ? 0.1 : 0.05;

            const minSel = isImp ? 1.0 : 0.3;
            const maxSel = isImp ? 100.0 : 35.0;
            const stepSel = isImp ? 0.1 : 0.05;

            const absMinUpper = toDisplayLen(0.35);
            const absMinLower = toDisplayLen(0.35);

            const inpUpper = document.getElementById('inp-upperL');
            const numUpper = document.getElementById('num-upperL');
            if (inpUpper) { inpUpper.min = absMinUpper.toFixed(2); inpUpper.max = Math.max(maxUpper, 35.0).toFixed(2); inpUpper.step = stepUpper; }
            if (numUpper) { numUpper.min = absMinUpper.toFixed(2); numUpper.max = Math.max(maxUpper, 50.0).toFixed(2); numUpper.step = stepUpper; }

            const inpLower = document.getElementById('inp-lowerL');
            const numLower = document.getElementById('num-lowerL');
            if (inpLower) { inpLower.min = absMinLower.toFixed(2); inpLower.max = Math.max(maxLower, 35.0).toFixed(2); inpLower.step = stepLower; }
            if (numLower) { numLower.min = absMinLower.toFixed(2); numLower.max = Math.max(maxLower, 50.0).toFixed(2); numLower.step = stepLower; }

            const inpSel = document.getElementById('inp-selectedL');
            const numSel = document.getElementById('num-selectedL');
            if (inpSel) { inpSel.min = minSel; inpSel.max = maxSel; inpSel.step = stepSel; }
            if (numSel) { numSel.min = minSel; numSel.max = maxSel; numSel.step = stepSel; }
        }

        // --- Rigging Topology & International Branching Tree (ASME B30.9, B30.26, DNV-ST-N001) ---
        function getRiggingTopology() {
            const type = state.beamType;
            const isNone = type === 'none';
            const isBasket = type === 'basket';
            const isFrame = type === 'frame' || type === 'container_spreader';
            const isCascade = type === 'cascaded' || type === 'modular_truss'
                || type === 'inline4' || type === 'inline8' || type === 'spatial8';
            const nLugs = (state.lugs && state.lugs.length) ? state.lugs.length : 4;

            const tier1 = [];
            const tier2 = [];
            const hangers = [];

            if (isNone) {
                for (let i = 0; i < nLugs; i++) {
                    tier1.push({
                        id: `L1-${i + 1}`,
                        code: `L1-${i + 1}`,
                        role: 'leg',
                        index: i,
                        tier: 1,
                        titleVi: `Cáp chùm trực tiếp L1-${i + 1} (Móc ➔ Tai cẩu LP${i + 1})`,
                        titleEn: `Direct Sling L1-${i + 1} (Hook ➔ Lug LP${i + 1})`,
                        shortLabel: `L1-${i + 1}`,
                        branch: `LP${i + 1}`
                    });
                }
            } else {
                // Tier 1: Upper Bridles (Hook ➔ Beam)
                if (isBasket) {
                    tier1.push({ id: 'L1-1', code: 'L1-1', role: 'upper', index: 0, tier: 1, titleVi: 'Cáp trên L1-1 (Móc ➔ Dầm Trước - Trái)', titleEn: 'Upper Sling L1-1 (Hook ➔ Front Beam Left)', shortLabel: 'L1-1', branch: 'Dầm Trước-Trái' });
                    tier1.push({ id: 'L1-2', code: 'L1-2', role: 'upper', index: 3, tier: 1, titleVi: 'Cáp trên L1-2 (Móc ➔ Dầm Trước - Phải)', titleEn: 'Upper Sling L1-2 (Hook ➔ Front Beam Right)', shortLabel: 'L1-2', branch: 'Dầm Trước-Phải' });
                    tier1.push({ id: 'L1-3', code: 'L1-3', role: 'upper', index: 1, tier: 1, titleVi: 'Cáp trên L1-3 (Móc ➔ Dầm Sau - Trái)', titleEn: 'Upper Sling L1-3 (Hook ➔ Rear Beam Left)', shortLabel: 'L1-3', branch: 'Dầm Sau-Trái' });
                    tier1.push({ id: 'L1-4', code: 'L1-4', role: 'upper', index: 2, tier: 1, titleVi: 'Cáp trên L1-4 (Móc ➔ Dầm Sau - Phải)', titleEn: 'Upper Sling L1-4 (Hook ➔ Rear Beam Right)', shortLabel: 'L1-4', branch: 'Dầm Sau-Phải' });
                } else if (isFrame) {
                    const cNames = ['Trước-Trái', 'Sau-Trái', 'Sau-Phải', 'Trước-Phải'];
                    const cEn = ['Front-Left', 'Rear-Left', 'Rear-Right', 'Front-Right'];
                    for (let i = 0; i < 4; i++) {
                        tier1.push({
                            id: `L1-${i + 1}`,
                            code: `L1-${i + 1}`,
                            role: 'upper',
                            index: i,
                            tier: 1,
                            titleVi: `Cáp trên L1-${i + 1} (Móc ➔ Khung Góc ${cNames[i]})`,
                            titleEn: `Upper Sling L1-${i + 1} (Hook ➔ Frame Corner ${cEn[i]})`,
                            shortLabel: `L1-${i + 1}`,
                            branch: `Góc ${i + 1}`
                        });
                    }
                } else {
                    tier1.push({ id: 'L1-1', code: 'L1-1', role: 'upper', index: 1, tier: 1, titleVi: 'Cáp trên L1-1 (Móc ➔ Dầm Trái)', titleEn: 'Upper Sling L1-1 (Hook ➔ Beam Left)', shortLabel: 'L1-1', branch: 'Dầm Trái' });
                    tier1.push({ id: 'L1-2', code: 'L1-2', role: 'upper', index: 0, tier: 1, titleVi: 'Cáp trên L1-2 (Móc ➔ Dầm Phải)', titleEn: 'Upper Sling L1-2 (Hook ➔ Beam Right)', shortLabel: 'L1-2', branch: 'Dầm Phải' });
                }

                if (isCascade) {
                    // Cascaded / Truss = 2-4-4: twin hangers to EACH sub-beam (end A + end B)
                    if (type === 'cascaded' || type === 'modular_truss') {
                        hangers.push({ id: 'H1', code: 'H1', role: 'hanger', index: 0, tier: 2, titleVi: 'H1 Dầm chính ➔ Dầm phụ + (đầu A)', titleEn: 'H1 Top ➔ Sub+ end A', shortLabel: 'H1', branch: 'Phụ+ A' });
                        hangers.push({ id: 'H2', code: 'H2', role: 'hanger', index: 1, tier: 2, titleVi: 'H2 Dầm chính ➔ Dầm phụ + (đầu B)', titleEn: 'H2 Top ➔ Sub+ end B', shortLabel: 'H2', branch: 'Phụ+ B' });
                        hangers.push({ id: 'H3', code: 'H3', role: 'hanger', index: 2, tier: 2, titleVi: 'H3 Dầm chính ➔ Dầm phụ − (đầu A)', titleEn: 'H3 Top ➔ Sub− end A', shortLabel: 'H3', branch: 'Phụ− A' });
                        hangers.push({ id: 'H4', code: 'H4', role: 'hanger', index: 3, tier: 2, titleVi: 'H4 Dầm chính ➔ Dầm phụ − (đầu B)', titleEn: 'H4 Top ➔ Sub− end B', shortLabel: 'H4', branch: 'Phụ− B' });
                    } else {
                        hangers.push({ id: 'H1', code: 'H1', role: 'hanger', index: 0, tier: 2, titleVi: 'Cáp treo dầm H1 (Dầm Chính ➔ Dầm Phụ 1)', titleEn: 'Hanger H1 (Top Beam ➔ Sub-beam 1)', shortLabel: 'H1', branch: 'Dầm Phụ 1' });
                        hangers.push({ id: 'H2', code: 'H2', role: 'hanger', index: 1, tier: 2, titleVi: 'Cáp treo dầm H2 (Dầm Chính ➔ Dầm Phụ 2)', titleEn: 'Hanger H2 (Top Beam ➔ Sub-beam 2)', shortLabel: 'H2', branch: 'Dầm Phụ 2' });
                        if (type === 'spatial8' || type === 'inline8') {
                            hangers.push({ id: 'H3', code: 'H3', role: 'hanger', index: 2, tier: 2, titleVi: 'Cáp treo dầm H3', titleEn: 'Hanger H3', shortLabel: 'H3', branch: 'Dầm Phụ 3' });
                            hangers.push({ id: 'H4', code: 'H4', role: 'hanger', index: 3, tier: 2, titleVi: 'Cáp treo dầm H4', titleEn: 'Hanger H4', shortLabel: 'H4', branch: 'Dầm Phụ 4' });
                        }
                    }
                }

                // Tier 2: Lower Legs (Beam ➔ Cargo Lugs)
                for (let i = 0; i < nLugs; i++) {
                    let parentBranch = '';
                    if (isBasket) {
                        parentBranch = (i === 0 || i === 3) ? 'Nhánh Dầm Trước' : 'Nhánh Dầm Sau';
                    } else if (isFrame) {
                        parentBranch = `Khung Góc ${i + 1}`;
                    } else {
                        parentBranch = (i === 0 || i === 3) ? 'Đầu Dầm Trái' : 'Đầu Dầm Phải';
                    }
                    tier2.push({
                        id: `L2-${i + 1}`,
                        code: `L2-${i + 1}`,
                        role: 'leg',
                        index: i,
                        tier: 2,
                        titleVi: `Cáp dưới L2-${i + 1} (${parentBranch} ➔ Tai cẩu LP${i + 1})`,
                        titleEn: `Lower Leg L2-${i + 1} (${parentBranch} ➔ Lug LP${i + 1})`,
                        shortLabel: `L2-${i + 1}`,
                        branch: `LP${i + 1}`
                    });
                }
            }

            return { tier1, tier2, hangers };
        }

        // --- Hardware Bill of Materials (BOM) Calculator ---
        function getRiggingBOM() {
            const type = state.beamType;
            const isNone = type === 'none';
            const isBasket = type === 'basket';
            const isFrame = type === 'frame' || type === 'container_spreader';
            const isCascade = type === 'cascaded' || type === 'modular_truss'
                || type === 'inline4' || type === 'inline8' || type === 'spatial8';
            const nLugs = (state.lugs && state.lugs.length) ? state.lugs.length : 4;

            const tier1Count = isNone ? nLugs : (isBasket || isFrame ? 4 : 2);
            const tier2Count = isNone ? 0 : nLugs;
            // Cascaded / truss = 2-4-4 → 4 hangers; spatial8/inline8 also 4; inline4 keeps 2.
            const hangerCount = !isCascade ? 0
                : (type === 'cascaded' || type === 'modular_truss' || type === 'spatial8' || type === 'inline8') ? 4
                : 2;
            const totalSlings = tier1Count + tier2Count + hangerCount;

            const topShackles = isNone ? nLugs : (isBasket || isFrame ? 4 : 2);
            const spreaderTopShackles = isNone ? 0 : (isCascade ? 4 : (isBasket || isFrame ? 4 : 2));
            const spreaderBottomShackles = isNone ? 0 : nLugs;
            const lugShackles = nLugs;
            const totalShackles = topShackles + spreaderTopShackles + spreaderBottomShackles + lugShackles;

            const beamCount = isNone ? 0 : (isBasket ? 2 : (isCascade ? 3 : 1));
            const beamDesc = isNone
                ? 'Không dùng dầm (Direct Bridle)'
                : (isBasket ? '2 Dầm ngáng đôi (Trước & Sau)' : (isCascade ? '3 Dầm ngáng (1 Chính + 2 Phụ)' : (isFrame ? '1 Khung ngáng 4 góc' : '1 Dầm ngáng Spreader')));
            const beamDescEn = isNone
                ? 'Direct Bridle (No Beam)'
                : (isBasket ? '2 Spreader Beams (Front & Rear)' : (isCascade ? '3 Cascaded Beams (1 Main + 2 Sub)' : (isFrame ? '1 Spreader Frame (4-point)' : '1 Spreader Beam')));

            const turnbuckleCount = (state.legDeltaL || []).filter(d => Math.abs(d) > 0.001).length;

            return {
                tier1Count,
                tier2Count,
                hangerCount,
                totalSlings,
                topShackles,
                spreaderTopShackles,
                spreaderBottomShackles,
                lugShackles,
                totalShackles,
                beamCount,
                beamDesc,
                beamDescEn,
                turnbuckleCount
            };
        }

        function updateRiggingBOMUI() {
            const bom = getRiggingBOM();
            const isEn = state.lang === 'en';

            const elHookCount = document.getElementById('bom-hook-count');
            const elHookDesc = document.getElementById('bom-hook-desc');
            const elSlingCount = document.getElementById('bom-sling-count');
            const elSlingDesc = document.getElementById('bom-sling-desc');
            const elShackleCount = document.getElementById('bom-shackle-count');
            const elShackleDesc = document.getElementById('bom-shackle-desc');
            const elBeamCount = document.getElementById('bom-beam-count');
            const elBeamDesc = document.getElementById('bom-beam-desc');

            if (elHookCount) {
                if (state.beamType === 'container_spreader') {
                    elHookCount.textContent = isEn
                        ? `STS ${state.stsSizeFt || 40}ft Spreader`
                        : `Ngáng STS ${state.stsSizeFt || 40}ft`;
                } else {
                    const nHook = (state.hookCount || 1) >= 2 ? 2 : 1;
                    elHookCount.textContent = isEn
                        ? `${nHook} Hook${nHook > 1 ? 's' : ''} · 1 Link`
                        : `${nHook} Móc · 1 Khuyên`;
                }
            }
            if (elHookDesc) {
                if (state.beamType === 'container_spreader') {
                    const direct = (typeof isStsDirectAttach === 'function')
                        ? isStsDirectAttach()
                        : (state.stsAttachMode || 'direct') !== 'cable';
                    elHookDesc.textContent = isEn
                        ? (direct
                            ? 'Headblock + twistlock direct on container (no lower slings)'
                            : 'Headblock + underside shackles + cable/chain to cargo lugs')
                        : (direct
                            ? 'Headblock + twistlock gắp trực tiếp nóc container (không cáp dưới)'
                            : 'Headblock + ma ní dưới ngáng + cáp/xích xuống tai kiện');
                } else {
                    const nHook = (state.hookCount || 1) >= 2 ? 2 : 1;
                    elHookDesc.textContent = isEn
                        ? (nHook > 1
                            ? '2 Crane Hooks (tandem / dual crane) · Master Link Assembly'
                            : (bom.tier1Count > 2 ? '1 Crane Hook · 1 Master Link Quad Assembly' : '1 Crane Hook · 1 Oblong Master Link'))
                        : (nHook > 1
                            ? '2 Móc · 2 cần cẩu làm hàng cùng lúc · Cụm vòng khuyên chính'
                            : (bom.tier1Count > 2 ? '1 Móc cẩu Liebherr · 1 Vòng khuyên chính (Quad/Sub-links)' : '1 Móc cẩu Liebherr · 1 Vòng khuyên chính Master Link'));
                }
            }

            if (elSlingCount) {
                elSlingCount.textContent = isEn ? `${bom.totalSlings} Slings` : `${bom.totalSlings} sợi cáp`;
            }
            if (elSlingDesc) {
                if (bom.tier2Count === 0) {
                    elSlingDesc.textContent = isEn ? `Tier 1: ${bom.tier1Count} Direct Slings` : `Tầng 1: ${bom.tier1Count} sợi cáp chùm trực tiếp`;
                } else {
                    const hTxt = bom.hangerCount ? (isEn ? ` · Hangers: ${bom.hangerCount}` : ` · Treo dầm: ${bom.hangerCount}`) : '';
                    elSlingDesc.textContent = isEn
                        ? `Tier 1: ${bom.tier1Count} · Tier 2: ${bom.tier2Count}${hTxt}`
                        : `Tầng 1: ${bom.tier1Count} sợi · Tầng 2: ${bom.tier2Count} sợi${hTxt}`;
                }
            }

            if (elShackleCount) {
                elShackleCount.textContent = isEn ? `${bom.totalShackles} Shackles` : `${bom.totalShackles} ma ní`;
            }
            if (elShackleDesc) {
                if (bom.spreaderTopShackles + bom.spreaderBottomShackles === 0) {
                    elShackleDesc.textContent = isEn
                        ? `${bom.topShackles} Top · ${bom.lugShackles} Cargo Lugs`
                        : `${bom.topShackles} Đỉnh · ${bom.lugShackles} Tai cẩu LP`;
                } else {
                    const beamSh = bom.spreaderTopShackles + bom.spreaderBottomShackles;
                    elShackleDesc.textContent = isEn
                        ? `${bom.topShackles} Top · ${beamSh} Spreader · ${bom.lugShackles} Lugs`
                        : `${bom.topShackles} Đỉnh · ${beamSh} Dầm ngáng · ${bom.lugShackles} Tai cẩu`;
                }
            }

            if (elBeamCount) {
                elBeamCount.textContent = isEn
                    ? `${bom.beamCount} Beam · ${bom.turnbuckleCount} TB`
                    : `${bom.beamCount} Dầm · ${bom.turnbuckleCount} T.Đơ`;
            }
            if (elBeamDesc) {
                elBeamDesc.textContent = isEn
                    ? `${bom.beamDescEn} · ${bom.turnbuckleCount} Turnbuckles`
                    : `${bom.beamDesc} · ${bom.turnbuckleCount} Tăng đơ cân CoG`;
            }
        }

        function updateCableQuickSelector() {
            const topo = getRiggingTopology();
            const currentSel = state.gear && state.gear.selection ? state.gear.selection.find(s => s.kind === 'sling') : null;

            const renderPills = (containerId, items) => {
                const container = document.getElementById(containerId);
                if (!container) return;
                container.innerHTML = '';

                items.forEach(item => {
                    const btn = document.createElement('button');
                    btn.type = 'button';
                    const isSelected = currentSel && currentSel.role === item.role && currentSel.index === item.index;
                    btn.className = `px-2 py-0.5 rounded text-[9.5px] font-mono font-bold border transition ${
                        isSelected
                            ? 'bg-sky-500 text-white border-sky-300 shadow-sm ring-1 ring-sky-300'
                            : 'bg-slate-800 text-slate-300 hover:text-white border-slate-700 hover:border-slate-500'
                    }`;
                    btn.textContent = item.shortLabel;
                    btn.title = state.lang === 'en' ? item.titleEn : item.titleVi;
                    btn.addEventListener('click', (e) => {
                        e.stopPropagation();
                        if (isSelected) {
                            state.gear.selection = (state.gear.selection || []).filter(s => s.kind !== 'sling');
                        } else {
                            state.gear.selection = [{ kind: 'sling', role: item.role, index: item.index }];
                        }
                        if (typeof updateGearSelectionRings === 'function') updateGearSelectionRings();
                        syncCableControlsSelection();
                        if (typeof renderGearFields === 'function') renderGearFields();
                    });
                    container.appendChild(btn);
                });
            };

            renderPills('tier1-quick-selector', topo.tier1);
            renderPills('hanger-quick-selector', topo.hangers);
            renderPills('tier2-quick-selector', topo.tier2);

            const legacyCont = document.getElementById('cable-quick-selector');
            if (legacyCont) legacyCont.innerHTML = '';
        }

        function syncCableControlsSelection() {
            const box = document.getElementById('box-selected-cable');
            if (!box) return;

            const sel = (state.gear && state.gear.selection) ? state.gear.selection.find(s => s.kind === 'sling') : null;
            if (!sel) {
                box.classList.add('hidden');
                document.querySelectorAll('#tier1-quick-selector button, #tier2-quick-selector button, #hanger-quick-selector button').forEach(p => {
                    p.classList.remove('bg-sky-500', 'text-white', 'border-sky-300', 'shadow-sm', 'ring-1', 'ring-sky-300');
                    p.classList.add('bg-slate-800', 'text-slate-300', 'border-slate-700');
                });
                return;
            }

            box.classList.remove('hidden');

            const topo = getRiggingTopology();
            const allItems = [...topo.tier1, ...topo.hangers, ...topo.tier2];
            const matched = allItems.find(it => it.role === sel.role && it.index === sel.index);

            const lbl = document.getElementById('lbl-selected-cable');
            if (lbl) {
                if (matched) {
                    lbl.textContent = `🎯 ${state.lang === 'en' ? 'Selected:' : 'Đang chọn:'} ${state.lang === 'en' ? matched.titleEn : matched.titleVi}`;
                } else {
                    lbl.textContent = `🎯 ${state.lang === 'en' ? 'Selected Cable' : 'Đang chọn cáp'}`;
                }
            }

            // Live Tension, Angle & WLL badge for selected cable
            let tensionT = 0;
            let angleDeg = 60.0;
            if (sel.role === 'leg') {
                tensionT = (phy.legTensions && phy.legTensions[sel.index]) || 0;
                angleDeg = (phy.legAngleDeg && phy.legAngleDeg[sel.index]) || 60.0;
            } else if (sel.role === 'upper') {
                tensionT = (phy.upperTensions && phy.upperTensions[sel.index]) || 0;
                angleDeg = (phy.upperAngleDeg && phy.upperAngleDeg[sel.index] != null) ? phy.upperAngleDeg[sel.index] : (spec ? spec.betaDeg : 60.0);
            } else if (sel.role === 'hanger') {
                tensionT = (phy.hangerTensions && phy.hangerTensions[sel.index]) || 0;
                angleDeg = 90.0;
            }

            const rec = (typeof gearRecord === 'function') ? gearRecord(sel) : null;
            const wllT = (rec && rec.swlT != null) ? rec.swlT : (state.wllPerLeg || 15.0);

            const elTen = document.getElementById('v-sel-tension');
            const elAng = document.getElementById('v-sel-angle');
            const elSwl = document.getElementById('v-sel-swl');
            if (elTen) elTen.textContent = `Lực căng T: ${tensionT.toFixed(2)} T`;
            if (elAng) elAng.textContent = `Góc α: ${angleDeg.toFixed(1)}°`;
            if (elSwl) elSwl.textContent = `WLL: ${wllT.toFixed(1)} T`;

            // Length
            let spec = (typeof getRigSpec === 'function') ? getRigSpec() : null;
            let lenM = null;
            if (rec && rec.lengthM != null) {
                lenM = rec.lengthM;
            } else if (sel.role === 'upper') {
                lenM = state.upperSlingLength != null ? state.upperSlingLength : (spec ? spec.topLeg : (state.slingLength || 8.0));
            } else if (sel.role === 'leg') {
                lenM = state.lowerSlingLength != null ? state.lowerSlingLength : (spec ? spec.lower : 2.0);
            } else if (sel.role === 'hanger') {
                lenM = state.hangerSlingLength != null ? state.hangerSlingLength : (spec ? (spec.hanger || 2.0) : 2.0);
            } else {
                lenM = 2.0;
            }

            const dispVal = toDisplayLen(lenM);
            const inpSel = document.getElementById('inp-selectedL');
            const numSel = document.getElementById('num-selectedL');
            if (inpSel) inpSel.value = dispVal.toFixed(2);
            if (numSel) numSel.value = dispVal.toFixed(2);

            // Highlight pills
            document.querySelectorAll('#tier1-quick-selector button, #tier2-quick-selector button, #hanger-quick-selector button').forEach(p => {
                const isCurrent = matched && p.textContent.trim() === matched.shortLabel;
                if (isCurrent) {
                    p.classList.add('bg-sky-500', 'text-white', 'border-sky-300', 'shadow-sm', 'ring-1', 'ring-sky-300');
                    p.classList.remove('bg-slate-800', 'text-slate-300', 'border-slate-700');
                } else {
                    p.classList.remove('bg-sky-500', 'text-white', 'border-sky-300', 'shadow-sm', 'ring-1', 'ring-sky-300');
                    p.classList.add('bg-slate-800', 'text-slate-300', 'border-slate-700');
                }
            });
        }

        function syncSlingSlidersFromState() {
            let spec = null;
            if (typeof getRigSpec === 'function') {
                spec = getRigSpec();
            }
            updateUnitDisplayElements();

            const upperM = state.upperSlingLength != null ? state.upperSlingLength : (spec ? spec.topLeg : 8.0);
            const lowerM = state.lowerSlingLength != null ? state.lowerSlingLength : (spec ? spec.lower : 2.0);
            const hangerM = state.hangerSlingLength != null ? state.hangerSlingLength : (spec ? (spec.hanger || 2.0) : 2.0);

            const dispUpper = toDisplayLen(upperM);
            const dispLower = toDisplayLen(lowerM);
            const dispHanger = toDisplayLen(hangerM);

            const inpUpper = document.getElementById('inp-upperL');
            const numUpper = document.getElementById('num-upperL');
            const vUpper = document.getElementById('v-upperL');
            if (inpUpper) inpUpper.value = dispUpper.toFixed(2);
            if (numUpper) numUpper.value = dispUpper.toFixed(2);
            if (vUpper) vUpper.textContent = dispUpper.toFixed(2);

            const inpLower = document.getElementById('inp-lowerL');
            const numLower = document.getElementById('num-lowerL');
            const vLower = document.getElementById('v-lowerL');
            if (inpLower) inpLower.value = dispLower.toFixed(2);
            if (numLower) numLower.value = dispLower.toFixed(2);
            if (vLower) vLower.textContent = dispLower.toFixed(2);

            const inpHanger = document.getElementById('inp-hangerL');
            const numHanger = document.getElementById('num-hangerL');
            const vHanger = document.getElementById('v-hangerL');
            if (inpHanger) inpHanger.value = dispHanger.toFixed(2);
            if (numHanger) numHanger.value = dispHanger.toFixed(2);
            if (vHanger) vHanger.textContent = dispHanger.toFixed(2);
            const lblHangerLen = document.getElementById('lbl-hanger-len-indicator');
            if (lblHangerLen) lblHangerLen.textContent = `${dispHanger.toFixed(2)} m`;

            // 0. Spreader Beam Length & Mass Sync
            let beamLenM = 12.2;
            if (state.beamType === 'container_spreader' && typeof isoTwistlockSpan === 'function') {
                beamLenM = isoTwistlockSpan(state.stsSizeFt || 40).spanX;
            } else if (typeof memberSpec === 'function') {
                const m = memberSpec('main');
                if (m && m.length) beamLenM = m.length;
            } else if (state.gear && state.gear.members && state.gear.members.main && state.gear.members.main.lengthM) {
                beamLenM = state.gear.members.main.lengthM;
            } else {
                beamLenM = Math.max(1.2, state.L || 12.2);
            }
            const inpBeamL = document.getElementById('inp-beamL');
            const numBeamL = document.getElementById('num-beamL');
            const vBeamL = document.getElementById('v-beamL');
            const vBeamMass = document.getElementById('v-beam-mass');
            if (inpBeamL) inpBeamL.value = beamLenM.toFixed(2);
            if (numBeamL) numBeamL.value = beamLenM.toFixed(2);
            if (vBeamL) vBeamL.textContent = beamLenM.toFixed(2);
            if (vBeamMass) {
                const massKg = Math.round(400 + beamLenM * 55);
                vBeamMass.textContent = `Tự trọng: ~${massKg} kg`;
            }
            if (typeof updateStsBeamDimUI === 'function') updateStsBeamDimUI();

            // Sync Tier 1 Angle Readouts (β to horizontal, α to vertical, LAF factor)
            const horizU = spec ? spec.horizU : Math.max(0.5, (state.L || 6.0) / 4);
            const cosBeta = THREE.MathUtils.clamp(horizU / upperM, 0.01, 0.999);
            const betaDeg = Math.acos(cosBeta) * 180 / Math.PI;
            const alphaDeg = 90 - betaDeg;
            const sinBeta = Math.sin(betaDeg * Math.PI / 180);
            const laf = sinBeta > 0.01 ? (1 / sinBeta) : 1.0;

            const inpUpperAngle = document.getElementById('inp-upper-angle');
            const lblUpperAngleVal = document.getElementById('lbl-upper-angle-val');
            const vBetaTxt = document.getElementById('v-upper-beta-txt');
            const vAlphaTxt = document.getElementById('v-upper-alpha-txt');
            const vLafTxt = document.getElementById('v-upper-laf-txt');
            const lblUpperLenIndicator = document.getElementById('lbl-upper-len-indicator');
            if (inpUpperAngle) inpUpperAngle.value = betaDeg.toFixed(1);
            if (lblUpperAngleVal) lblUpperAngleVal.textContent = betaDeg.toFixed(1);
            if (vBetaTxt) vBetaTxt.textContent = `${betaDeg.toFixed(1)}°`;
            if (vAlphaTxt) vAlphaTxt.textContent = `${alphaDeg.toFixed(1)}°`;
            if (vLafTxt) vLafTxt.textContent = laf.toFixed(3);
            if (lblUpperLenIndicator) lblUpperLenIndicator.textContent = `${dispUpper.toFixed(2)} m`;

            // Sync Tier 2 Readouts
            const lblLowerLenIndicator = document.getElementById('lbl-lower-len-indicator');
            if (lblLowerLenIndicator) lblLowerLenIndicator.textContent = `${dispLower.toFixed(2)} m`;
            const lblLowerAngle = document.getElementById('lbl-lower-angle-indicator');
            if (lblLowerAngle) {
                const horizL = spec ? (spec.horizL || 0) : 0;
                if (horizL < 0.1) {
                    lblLowerAngle.textContent = '🟢 Thẳng đứng 90° (Zero Lateral Shear)';
                    lblLowerAngle.className = 'text-emerald-400 font-bold';
                } else {
                    const deg = Math.atan2(dispLower, horizL) * 180 / Math.PI;
                    lblLowerAngle.textContent = `Góc nghiêng α: ${deg.toFixed(1)}°`;
                    lblLowerAngle.className = 'text-amber-300 font-bold';
                }
            }

            const inpSlingL = document.getElementById('inp-slingL');
            const vSlingL = document.getElementById('v-slingL');
            if (inpSlingL) inpSlingL.value = upperM.toFixed(1);
            if (vSlingL) vSlingL.textContent = upperM.toFixed(1);

            const inpWll = document.getElementById('inp-wll');
            const numWll = document.getElementById('num-wll');
            const vWll = document.getElementById('v-wll');
            if (inpWll) inpWll.value = (state.wllPerLeg || 15.0).toFixed(1);
            if (numWll) numWll.value = (state.wllPerLeg || 15.0).toFixed(1);
            if (vWll) vWll.textContent = (state.wllPerLeg || 15.0).toFixed(1);

            const inpSlingDia = document.getElementById('inp-sling-dia');
            const numSlingDia = document.getElementById('num-sling-dia');
            const badgeSlingSize = document.getElementById('badge-sling-size');
            const readoutMass = document.getElementById('readout-sling-unit-mass');
            const getPhysSpec = (typeof CAE !== 'undefined' && CAE.getSlingPhysicalSpec)
                || (typeof window !== 'undefined' && window.CAE && window.CAE.getSlingPhysicalSpec);
            if (getPhysSpec) {
                const spec = getPhysSpec(state.slingType || 'wire', state.wllPerLeg || 15.0, state.slingDiaMm);
                if (badgeSlingSize) badgeSlingSize.textContent = spec.specText;
                if (inpSlingDia && document.activeElement !== inpSlingDia) inpSlingDia.value = spec.diaMm;
                if (numSlingDia && document.activeElement !== numSlingDia) numSlingDia.value = spec.diaMm;
                if (readoutMass) {
                    const singleMassKg = spec.computeMassKg(upperM, 1);
                    readoutMass.textContent = `~${spec.linearMassKgPerM.toFixed(2)} kg/m · ${singleMassKg.toFixed(1)} kg/sợi`;
                }
            }

            const rowLower = document.getElementById('row-lower-sling');
            const rowHanger = document.getElementById('row-hanger-sling');
            const lblUpperTitle = document.getElementById('lbl-upper-title');
            const lblLowerTitle = document.getElementById('lbl-lower-title');
            const lblHangerTitle = document.getElementById('lbl-hanger-title');
            const angleUpper = spec ? spec.betaDeg : 50;
            const angleLower = (phy.legAngleDeg && phy.legAngleDeg[0] != null) ? phy.legAngleDeg[0] : 90.0;
            const showHanger = hasCascadedHangerTier();

            const stsDirectUi = state.beamType === 'container_spreader'
                && (typeof isStsDirectAttach === 'function'
                    ? isStsDirectAttach()
                    : (state.stsAttachMode || 'direct') !== 'cable');
            if (state.beamType === 'none' || stsDirectUi) {
                if (rowLower) rowLower.classList.add('hidden');
                if (rowHanger) rowHanger.classList.add('hidden');
                if (lblUpperTitle) {
                    if (stsDirectUi) {
                        lblUpperTitle.textContent = state.lang === 'en'
                            ? `Hoist falls (Headblock) [β: ${angleUpper.toFixed(0)}°]:`
                            : `Cáp tời → Headblock [β: ${angleUpper.toFixed(0)}°]:`;
                    } else {
                        lblUpperTitle.textContent = state.lang === 'en'
                            ? `Tier 1 (Direct Bridle: Hook ➔ Cargo) [β: ${angleUpper.toFixed(0)}°]:`
                            : `Tầng 1 (Cáp chùm trực tiếp — Móc ➔ Tai cẩu) [β: ${angleUpper.toFixed(0)}°]:`;
                    }
                }
            } else {
                if (rowLower) rowLower.classList.remove('hidden');
                if (rowHanger) {
                    if (showHanger) rowHanger.classList.remove('hidden');
                    else rowHanger.classList.add('hidden');
                }
                if (lblUpperTitle) lblUpperTitle.textContent = state.lang === 'en'
                    ? `Tier 1 (Top Bridle: Hook ➔ Beam) [β: ${angleUpper.toFixed(0)}°]:`
                    : `Tầng 1 (Top Bridle — Móc ➔ Dầm) [β: ${angleUpper.toFixed(0)}°]:`;
                if (lblLowerTitle) lblLowerTitle.textContent = state.lang === 'en'
                    ? (showHanger
                        ? `Tier 3 (Lower Legs: Sub-beam ➔ Cargo) [α: ${angleLower.toFixed(0)}°]:`
                        : `Tier 2 (Lower Legs: Beam ➔ Cargo) [α: ${angleLower.toFixed(0)}°]:`)
                    : (showHanger
                        ? `Tầng 3 (Lower Legs — Dầm phụ ➔ Tai Cẩu) [α: ${angleLower.toFixed(0)}°]:`
                        : `Tầng 2 (Lower Legs — Dầm ➔ Tai Cẩu) [α: ${angleLower.toFixed(0)}°]:`);
                if (lblHangerTitle) lblHangerTitle.textContent = state.lang === 'en'
                    ? `Tier 2 (Hanger: Main beam ➔ Sub-beam) [L: ${hangerM.toFixed(1)}m]:`
                    : `Tầng 2 (Hanger — Dầm chính ➔ Dầm phụ) [L: ${hangerM.toFixed(1)}m]:`;
            }

            syncCableAutoBalanceVisibility();
            updateCableQuickSelector();
            syncCableControlsSelection();
            updateRiggingBOMUI();
        }

        window.getRiggingTopology = getRiggingTopology;
        window.getRiggingBOM = getRiggingBOM;
        window.updateRiggingBOMUI = updateRiggingBOMUI;

        window.syncCableControlsSelection = syncCableControlsSelection;
        window.syncSlingSlidersFromState = syncSlingSlidersFromState;
        window.updateCableQuickSelector = updateCableQuickSelector;

        /** Toggle §3.2: STS ISO twistlock pitches vs generic beam L slider. */
        function updateStsBeamDimUI() {
            const isSts = state.beamType === 'container_spreader';
            const stsPanel = document.getElementById('sts-size-panel');
            const genPanel = document.getElementById('generic-beam-dim-panel');
            const autoFit = document.getElementById('btn-beam-auto-fit');
            const title = document.getElementById('lbl-beam-dim-title');
            if (stsPanel) {
                stsPanel.classList.toggle('hidden', !isSts);
                stsPanel.classList.toggle('flex', isSts);
            }
            if (genPanel) genPanel.classList.toggle('hidden', isSts);
            if (autoFit) autoFit.classList.toggle('hidden', isSts);
            if (title) {
                title.textContent = isSts
                    ? '3.2 Cỡ Ngáng STS — Pitch Twistlock ISO'
                    : '3.2 Kích Thước Dầm Ngáng (Spreader Span)';
            }
            if (!isSts) return;

            const ft = state.stsTwinLift ? 40 : (Number(state.stsSizeFt) || 40);
            const iso = (typeof isoTwistlockSpan === 'function')
                ? isoTwistlockSpan(ft)
                : { spanX: 11.985, spanZ: 2.259 };
            const pitchEl = document.getElementById('v-sts-pitch');
            const ftLbl = document.getElementById('v-sts-ft-label');
            const massEl = document.getElementById('v-sts-mass');
            if (pitchEl) pitchEl.textContent = `${iso.spanX.toFixed(3)} × ${iso.spanZ.toFixed(3)} m`;
            if (ftLbl) {
                ftLbl.textContent = state.stsTwinLift
                    ? '· Twin 2×20 ft'
                    : `· ${ft} ft`;
            }
            if (massEl) {
                const massT = ft <= 20 ? 8.5 : (ft >= 45 ? 11.2 : 9.5);
                massEl.textContent = `Tự trọng: ~${massT.toFixed(1)} t`;
            }
            document.querySelectorAll('.btn-sts-size').forEach(btn => {
                const btnFt = parseInt(btn.dataset.stsFt, 10);
                const on = !state.stsTwinLift && btnFt === ft;
                btn.classList.toggle('border-amber-500/80', on);
                btn.classList.toggle('bg-amber-950/50', on);
                btn.classList.toggle('shadow-sm', on);
                btn.classList.toggle('border-slate-700', !on);
                btn.classList.toggle('bg-slate-950/90', !on);
                const first = btn.querySelector('div');
                if (first) {
                    first.classList.toggle('text-amber-200', on);
                    first.classList.toggle('text-white', !on);
                }
            });
            const attach = state.stsAttachMode === 'cable' ? 'cable' : 'direct';
            document.querySelectorAll('.btn-sts-attach').forEach(btn => {
                const on = btn.dataset.stsAttach === attach;
                const isDirect = btn.dataset.stsAttach === 'direct';
                btn.classList.toggle('border-amber-500/80', on && isDirect);
                btn.classList.toggle('bg-amber-950/50', on && isDirect);
                btn.classList.toggle('border-sky-500/80', on && !isDirect);
                btn.classList.toggle('bg-sky-950/40', on && !isDirect);
                btn.classList.toggle('shadow-sm', on);
                btn.classList.toggle('border-slate-700', !on);
                btn.classList.toggle('bg-slate-950/90', !on);
                const first = btn.querySelector('div');
                if (first) {
                    first.classList.toggle('text-amber-200', on && isDirect);
                    first.classList.toggle('text-sky-200', on && !isDirect);
                    first.classList.toggle('text-white', !on);
                }
            });
            const chkTwin = document.getElementById('chk-sts-twin');
            if (chkTwin) chkTwin.checked = !!state.stsTwinLift;
            const chkLink = document.getElementById('chk-sts-size-linked');
            if (chkLink) {
                const cableHang = (state.stsAttachMode || 'direct') === 'cable' && !state.stsTwinLift;
                if (cableHang) state.stsSizeLinked = false;
                chkLink.checked = state.stsSizeLinked !== false;
                chkLink.disabled = cableHang;
                chkLink.title = cableHang
                    ? 'Chế độ cáp/xích: ngáng theo lựa chọn người dùng — không đồng bộ với container'
                    : 'Bật: đổi ngáng ↔ container cùng cỡ ISO. Tắt: chỉnh riêng.';
                const linkLab = (typeof chkLink.closest === 'function')
                    ? chkLink.closest('label')
                    : null;
                if (linkLab && linkLab.classList) linkLab.classList.toggle('opacity-50', cableHang);
            }
            // Twin: disable cable attach button (twistlock-only)
            const cableBtn = document.getElementById('btn-sts-attach-cable');
            if (cableBtn) {
                const blockCable = !!state.stsTwinLift;
                cableBtn.disabled = blockCable;
                cableBtn.classList.toggle('opacity-40', blockCable);
                cableBtn.classList.toggle('pointer-events-none', blockCable);
                cableBtn.title = blockCable
                    ? 'Twin-lift chỉ gắp twistlock (8 chốt) — không treo cáp 4 góc ngoài'
                    : 'Ma ní + cáp/xích từ ngáng xuống tai kiện';
            }
        }
        window.updateStsBeamDimUI = updateStsBeamDimUI;

        /** STS attach: direct twistlock on roof vs cable/chain legs from underside pick points. */
        function applyStsAttachMode(mode) {
            // Twin-lift is twistlock-only (8 pins). Cable-on-outer-corners is not offered.
            let next = mode === 'cable' ? 'cable' : 'direct';
            if (state.stsTwinLift && next === 'cable') {
                next = 'direct';
                const status = document.getElementById('sim-status-text');
                if (status) {
                    status.textContent = (typeof L === 'function')
                        ? L(
                            'Twin-lift uses direct twistlocks only (8 pins). Cable hang on outer corners is disabled.',
                            'Twin-lift chỉ gắp twistlock (8 chốt). Không dùng cáp treo 4 góc ngoài (không thực tế).'
                        )
                        : 'Twin-lift chỉ gắp twistlock — không dùng cáp 4 góc ngoài.';
                }
            }
            state.stsAttachMode = next;
            state.beamType = 'container_spreader';
            state.hookCount = 1;
            state.hookSwivelEnabled = false;
            // Cable hang: operator owns spreader size — never auto-rewrite when the box changes.
            if (next === 'cable') state.stsSizeLinked = false;
            if (phy) {
                phy._stsYawLockRad = THREE.MathUtils.degToRad(
                    state.spreaderAlignWithCargo ? (state.cargoYawDeg || 0) : (state.spreaderYawDeg || 0)
                );
                // Leaving cable mode (or re-entering) clears pry + residual gap on the twin pair
                if (typeof clearStsTwinCableFlareState === 'function') {
                    clearStsTwinCableFlareState();
                } else if (phy.twinCableFlare) {
                    phy.twinCableFlare.pitchA = 0;
                    phy.twinCableFlare.pitchB = 0;
                    phy.twinCableFlare.sepExtra = 0;
                    phy.twinCableFlare.peakSep = 0;
                    phy.twinCableFlare.peakPitch = 0;
                    phy.twinCableFlare.warned = false;
                    phy.twinCableFlare.gapWarned = false;
                    phy.twinCableFlare.active = false;
                }
            }
            if (next === 'direct') {
                state.lowerSlingLength = 0.06;
                state.upperSlingLength = 0.28;
                state.slingLength = state.upperSlingLength;
                state.slingUserSet = true;
                state.lugElevPreset = 'top';
                state.pendingConform = 'structural';
                // Drop any stale per-leg lengths / held L0 so twistlock gap stays flush
                if (state.gear && state.gear.legs) {
                    state.gear.legs.forEach(leg => {
                        if (!leg) return;
                        leg.lengthM = null;
                        leg.userSet = false;
                    });
                }
                if (state.heldCableL0 && state.heldCableL0.leg) state.heldCableL0.leg = [];
                state.legDeltaL = [0, 0, 0, 0];
            } else {
                // Cable lift physics = H-beam: real upper bridle + lower 4-corner legs.
                // (8 vertical headblock ropes are cosmetic only — not in the solver.)
                const spec = (typeof getRigSpec === 'function') ? getRigSpec() : null;
                const upperL = Math.max(2.0, (spec && spec.recUpper) || (spec && spec.topLeg) || 4.0);
                const lowerL = Math.max(1.5, (spec && spec.recLower) || (spec && spec.lower) || 2.0);
                state.upperSlingLength = upperL;
                state.lowerSlingLength = lowerL;
                state.slingLength = state.upperSlingLength;
                state.slingUserSet = true;
                state.holdCableLength = false;
                state.heldCableL0 = null;
                state.pendingConform = 'structural';
                phy._stsCableTakeUp = false;
                if (state.gear && state.gear.legs) {
                    state.gear.legs.forEach(leg => {
                        if (!leg) return;
                        leg.lengthM = lowerL;
                        leg.userSet = true;
                        leg.broken = false;
                    });
                }
                if (state.gear && state.gear.uppers) {
                    state.gear.uppers.forEach(u => {
                        if (!u) return;
                        u.lengthM = upperL;
                        u.userSet = true;
                    });
                }
            }
            if (typeof setSymmetricLugsFromDimensions === 'function') setSymmetricLugsFromDimensions();
            updateStsBeamDimUI();
            if (typeof rebuildCargoAndRig === 'function') rebuildCargoAndRig(false);
            else if (typeof rebuildSpreaderVisuals === 'function') rebuildSpreaderVisuals();
            // Direct: seat twistlocks. Cable: H-beam seat (stand-off + high hook + taut uppers).
            if (typeof seatStsSpreaderToCargo === 'function') seatStsSpreaderToCargo();
            else if (typeof syncHookToRigTaut === 'function') syncHookToRigTaut();
            syncSlingSlidersFromState();
            if (typeof updateRiggingBOMUI === 'function') updateRiggingBOMUI();
        }
        window.applyStsAttachMode = applyStsAttachMode;

        /**
         * Apply STS telescopic size: ISO 1161 twistlock centres (not outer / phủ bì).
         * @param {20|40|45|'twin'} size
         */
        function applyStsSpreaderSize(size, opts) {
            // Linked direct (default): changing spreader also sets matching ISO container.
            // Cable / unlinked / skipCargo: edit spreader alone — container stays as-is.
            if ((state.stsAttachMode || 'direct') === 'cable' && !state.stsTwinLift) {
                state.stsSizeLinked = false;
            }
            const linked = state.stsSizeLinked !== false
                && (state.stsAttachMode || 'direct') !== 'cable';
            const syncCargo = !(opts && opts.skipCargo === true)
                && (linked || !!(opts && opts.forceCargo));
            let ft = 40;
            const isTwin = (size === 'twin' || size === 'Twin');
            if (isTwin) {
                state.stsTwinLift = true;
                state.stsSizeFt = 40;
                ft = 40;
                // Twin always seats with twistlocks — never outer-cable hang
                if (state.stsAttachMode === 'cable') state.stsAttachMode = 'direct';
            } else {
                state.stsTwinLift = false;
                ft = Number(size) || 40;
                if (ft <= 20) ft = 20;
                else if (ft >= 45) ft = 45;
                else ft = 40;
                state.stsSizeFt = ft;
            }

            const iso = (typeof isoTwistlockSpan === 'function')
                ? isoTwistlockSpan(ft)
                : { spanX: ft <= 20 ? 5.853 : (ft >= 45 ? 13.557 : 11.985), spanZ: 2.259, outerL: ft <= 20 ? 6.058 : (ft >= 45 ? 13.716 : 12.192), outerW: 2.438, outerH: ft >= 45 ? 2.896 : 2.591, cargoId: ft <= 20 ? 'container' : (ft >= 45 ? 'iso40hc' : 'iso40') };

            if (!state.gear) state.gear = {};
            if (!state.gear.beam) state.gear.beam = {};
            // Beam span = twistlock pin centres (ISO), never outer envelope
            state.gear.beam.lengthM = iso.spanX;
            state.gear.beam.widthM = iso.spanZ;
            state.customBeamLengthMode = true;

            if (!state.gear.members) state.gear.members = {};
            if (!state.gear.members.spreader_main) state.gear.members.spreader_main = {};
            state.gear.members.spreader_main.lengthM = iso.spanX;
            if (!state.gear.members.main) state.gear.members.main = {};
            state.gear.members.main.lengthM = iso.spanX;

            state.beamType = 'container_spreader';
            state.hookCount = 1;
            // STS trolley headblock does not free-swivel like a hook block
            state.hookSwivelEnabled = false;
            if (phy) phy._stsYawLockRad = THREE.MathUtils.degToRad(
                state.spreaderAlignWithCargo ? (state.cargoYawDeg || 0) : (state.spreaderYawDeg || 0)
            );
            if (!state.stsAttachMode) state.stsAttachMode = 'direct';
            if (state.stsAttachMode === 'cable') {
                // H-beam style bridles above the yellow frame
                const spec = (typeof getRigSpec === 'function') ? getRigSpec() : null;
                state.upperSlingLength = Math.max(2.0, (spec && spec.recUpper) || (spec && spec.topLeg) || state.upperSlingLength || 4.0);
                if (state.lowerSlingLength == null || state.lowerSlingLength < 0.8) {
                    state.lowerSlingLength = Math.max(1.5, (spec && spec.recLower) || 2.0);
                }
            } else {
                // Direct: trolley headblock — short falls only
                state.upperSlingLength = 0.28;
                state.lowerSlingLength = 0.06;
                state.lugElevPreset = 'top';
            }
            state.slingLength = state.upperSlingLength;
            state.slingUserSet = true;
            state.pendingConform = 'structural';

            if (syncCargo) {
                if (isTwin) {
                    // Twin-lift: two 20ft dry vans end-to-end (~40ft cell), CAD twin spreader
                    state.L = 12.192;
                    state.W = 2.438;
                    state.H = 2.591;
                    state.cargoType = 'container';
                    state.weight = Math.max(36, state.weight || 40);
                    state.weightUserSet = true;
                    document.querySelectorAll('#cargo-library .card-btn').forEach(c => {
                        c.classList.toggle('active', c.dataset.cargo === 'container');
                    });
                } else if (iso.outerL) {
                    state.L = iso.outerL;
                    state.W = iso.outerW || 2.438;
                    state.H = iso.outerH || 2.591;
                    if (iso.cargoId) {
                        state.cargoType = iso.cargoId;
                        document.querySelectorAll('#cargo-library .card-btn').forEach(c => {
                            c.classList.toggle('active', c.dataset.cargo === iso.cargoId);
                        });
                    }
                }
            }

            if (typeof setSymmetricLugsFromDimensions === 'function') setSymmetricLugsFromDimensions();
            updateStsBeamDimUI();

            // Highlight STS card in store
            document.querySelectorAll('#beam-store .card-btn').forEach(c => {
                c.classList.toggle('active', c.dataset.beam === 'container_spreader');
            });

            if (typeof rebuildCargoAndRig === 'function') rebuildCargoAndRig(true);
            else if (typeof rebuildSpreaderVisuals === 'function') rebuildSpreaderVisuals();
            if ((state.stsAttachMode || 'direct') === 'direct'
                && typeof seatStsSpreaderToCargo === 'function') {
                seatStsSpreaderToCargo();
            } else if (typeof syncHookToRigTaut === 'function') {
                syncHookToRigTaut();
            }
            syncSlingSlidersFromState();
            if (typeof updateRiggingBOMUI === 'function') updateRiggingBOMUI();
        }
        window.applyStsSpreaderSize = applyStsSpreaderSize;

        function initSlingControls() {
            // 0. Spreader Beam Length Controls (Thanh kéo ngang Chiều dài Dầm)
            const inpBeamL = document.getElementById('inp-beamL');
            const numBeamL = document.getElementById('num-beamL');
            const onBeamLengthChange = (valRaw, source) => {
                if (state.beamType === 'container_spreader') return; // STS: ISO pitches only
                const val = parseFloat(valRaw);
                if (isNaN(val) || val <= 0) return;
                const minL = 1.0;
                const maxL = 30.0;
                const clampedVal = Math.min(maxL, Math.max(minL, val));

                if (source === 'slider' && numBeamL) numBeamL.value = clampedVal.toFixed(2);
                if (source === 'number' && inpBeamL) inpBeamL.value = clampedVal.toFixed(2);
                const vBeamL = document.getElementById('v-beamL');
                if (vBeamL) vBeamL.textContent = clampedVal.toFixed(2);

                const vBeamMass = document.getElementById('v-beam-mass');
                if (vBeamMass) {
                    const massKg = Math.round(400 + clampedVal * 55);
                    vBeamMass.textContent = `Tự trọng: ~${massKg} kg`;
                }

                if (!state.gear.members) state.gear.members = {};
                if (!state.gear.members.main) state.gear.members.main = { lengthM: null, aM: null, bM: null, swlT: null, massT: null };
                state.gear.members.main.lengthM = clampedVal;
                state.customBeamLengthMode = true;

                if (typeof syncHookToRigTaut === 'function') syncHookToRigTaut();
                rebuildCargoAndRig(false);
                syncSlingSlidersFromState();
                updateRiggingBOMUI();
            };

            if (inpBeamL) inpBeamL.addEventListener('input', e => onBeamLengthChange(e.target.value, 'slider'));
            if (numBeamL) numBeamL.addEventListener('input', e => onBeamLengthChange(e.target.value, 'number'));

            document.querySelectorAll('.btn-step-beam').forEach(btn => {
                btn.addEventListener('click', () => {
                    if (state.beamType === 'container_spreader') return;
                    const delta = parseFloat(btn.dataset.delta || 0);
                    const cur = parseFloat(numBeamL ? numBeamL.value : (inpBeamL ? inpBeamL.value : 12.2));
                    const next = Math.max(1.0, +(cur + delta).toFixed(2));
                    onBeamLengthChange(next, 'number');
                });
            });

            document.querySelectorAll('.btn-preset-beam').forEach(btn => {
                btn.addEventListener('click', () => {
                    if (state.beamType === 'container_spreader') return;
                    const val = parseFloat(btn.dataset.val);
                    if (!isNaN(val)) onBeamLengthChange(val, 'number');
                });
            });

            document.querySelectorAll('.btn-sts-size').forEach(btn => {
                btn.addEventListener('click', () => {
                    const ft = parseInt(btn.dataset.stsFt, 10);
                    if (!ft) return;
                    // Cable / unlinked → spreader only. Linked direct → also match container ISO.
                    const skipCargo = state.stsSizeLinked === false
                        || (state.stsAttachMode || 'direct') === 'cable';
                    applyStsSpreaderSize(ft, { skipCargo });
                });
            });
            document.querySelectorAll('.btn-sts-attach').forEach(btn => {
                btn.addEventListener('click', () => {
                    applyStsAttachMode(btn.dataset.stsAttach || 'direct');
                });
            });
            const chkTwin = document.getElementById('chk-sts-twin');
            if (chkTwin) {
                chkTwin.addEventListener('change', () => {
                    applyStsSpreaderSize(chkTwin.checked ? 'twin' : (state.stsSizeFt || 40));
                });
            }
            const chkLink = document.getElementById('chk-sts-size-linked');
            if (chkLink) {
                chkLink.addEventListener('change', () => {
                    state.stsSizeLinked = !!chkLink.checked;
                    updateStsBeamDimUI();
                    const status = document.getElementById('sim-status-text');
                    if (status) {
                        status.textContent = state.stsSizeLinked
                            ? 'Đồng bộ: đổi ngáng ↔ container cùng cỡ ISO.'
                            : 'Tách độc lập: chỉnh ngáng hoặc container riêng, cái kia giữ nguyên.';
                    }
                });
            }

            const btnBeamAutoFit = document.getElementById('btn-beam-auto-fit');
            if (btnBeamAutoFit) {
                btnBeamAutoFit.addEventListener('click', () => {
                    if (state.beamType === 'container_spreader') return;
                    if (state.gear && state.gear.members && state.gear.members.main) {
                        state.gear.members.main.lengthM = null; // restore auto-fit to cargo width/span
                    }
                    state.customBeamLengthMode = false;
                    if (typeof syncHookToRigTaut === 'function') syncHookToRigTaut();
                    rebuildCargoAndRig(false);
                    syncSlingSlidersFromState();
                    updateRiggingBOMUI();
                });
            }

            // 1. Upper Bridle Controls (Móc ➔ Dầm)
            const inpUpper = document.getElementById('inp-upperL');
            const numUpper = document.getElementById('num-upperL');
            const inpUpperAngle = document.getElementById('inp-upper-angle');
            const lblUpperAngleVal = document.getElementById('lbl-upper-angle-val');

            const onUpperChange = (valDisplay, source) => {
                const val = parseFloat(valDisplay);
                if (isNaN(val) || val <= 0) return;
                const minUpperDisp = toDisplayLen(0.35);
                const maxUpperDisp = toDisplayLen(50.0);
                const clampedVal = Math.min(maxUpperDisp, Math.max(minUpperDisp, val));

                if (source === 'slider' && numUpper) numUpper.value = clampedVal.toFixed(2);
                if (source === 'number' && inpUpper) inpUpper.value = clampedVal.toFixed(2);
                if (source === 'angle') {
                    if (numUpper) numUpper.value = clampedVal.toFixed(2);
                    if (inpUpper) inpUpper.value = clampedVal.toFixed(2);
                }
                const vUpper = document.getElementById('v-upperL');
                if (vUpper) vUpper.textContent = clampedVal.toFixed(2);

                const mVal = fromInputLen(clampedVal);
                state.upperSlingLength = mVal;
                state.slingLength = mVal;
                state.slingUserSet = true;
                markCableAdjustMode();
                if (state.heldCableL0) state.heldCableL0.upper = [];

                // Cập nhật đồng bộ tức thì cho TẤT CẢ các sợi cáp Tầng 1 (L1-1, L1-2, L1-3, L1-4)
                if (state.gear && state.gear.uppers) {
                    state.gear.uppers.forEach(u => {
                        if (u) {
                            u.lengthM = mVal;
                            u.userSet = true;
                        }
                    });
                }

                // Cập nhật góc tính toán β, α, LAF
                const spec = (typeof getRigSpec === 'function') ? getRigSpec() : null;
                const horizU = spec ? spec.horizU : Math.max(0.5, (state.L || 6.0) / 4);
                const cosBeta = THREE.MathUtils.clamp(horizU / mVal, 0.01, 0.999);
                const betaDeg = Math.acos(cosBeta) * 180 / Math.PI;
                const alphaDeg = 90 - betaDeg;
                const sinBeta = Math.sin(betaDeg * Math.PI / 180);
                const laf = sinBeta > 0.01 ? (1 / sinBeta) : 1.0;

                if (source !== 'angle' && inpUpperAngle) {
                    inpUpperAngle.value = betaDeg.toFixed(1);
                }
                if (lblUpperAngleVal) lblUpperAngleVal.textContent = betaDeg.toFixed(1);
                const vBetaTxt = document.getElementById('v-upper-beta-txt');
                if (vBetaTxt) vBetaTxt.textContent = `${betaDeg.toFixed(1)}°`;
                const vAlphaTxt = document.getElementById('v-upper-alpha-txt');
                if (vAlphaTxt) vAlphaTxt.textContent = `${alphaDeg.toFixed(1)}°`;
                const vLafTxt = document.getElementById('v-upper-laf-txt');
                if (vLafTxt) vLafTxt.textContent = laf.toFixed(3);
                const lblUpperLenIndicator = document.getElementById('lbl-upper-len-indicator');
                if (lblUpperLenIndicator) lblUpperLenIndicator.textContent = `${clampedVal.toFixed(2)} m`;

                const inpSlingL = document.getElementById('inp-slingL');
                const vSlingL = document.getElementById('v-slingL');
                if (inpSlingL) inpSlingL.value = mVal;
                if (vSlingL) vSlingL.textContent = mVal.toFixed(1);

                const sel = (state.gear && state.gear.selection) ? state.gear.selection.find(s => s.kind === 'sling' && s.role === 'upper') : null;
                if (sel) {
                    const inpSel = document.getElementById('inp-selectedL');
                    const numSel = document.getElementById('num-selectedL');
                    if (inpSel) inpSel.value = clampedVal.toFixed(2);
                    if (numSel) numSel.value = clampedVal.toFixed(2);
                }
                if (typeof syncHookToRigTaut === 'function') syncHookToRigTaut();
                rebuildCargoAndRig(false);
                syncCableControlsSelection();
                updateRiggingBOMUI();
            };
            if (inpUpper) inpUpper.addEventListener('input', e => onUpperChange(e.target.value, 'slider'));
            if (numUpper) numUpper.addEventListener('input', e => onUpperChange(e.target.value, 'number'));

            // Tier 1 Angle Slider: kéo góc tự động cập nhật độ dài L1
            const onUpperAngleChange = (betaDegVal) => {
                let beta = parseFloat(betaDegVal);
                if (isNaN(beta)) return;
                // Working pull band: even-friendly integers 40–55° from horizontal
                beta = Math.round(THREE.MathUtils.clamp(beta, 40, 55));
                const spec = (typeof getRigSpec === 'function') ? getRigSpec() : null;
                const horizU = spec ? spec.horizU : Math.max(0.5, (state.L || 6.0) / 4);
                const rad = beta * Math.PI / 180;
                const cosBeta = Math.cos(rad);
                if (cosBeta <= 0.01) return;
                const newLengthM = horizU / cosBeta;
                if (inpUpperAngle) inpUpperAngle.value = beta;
                if (lblUpperAngleVal) lblUpperAngleVal.textContent = String(beta);
                onUpperChange(toDisplayLen(newLengthM), 'angle');
            };
            if (inpUpperAngle) inpUpperAngle.addEventListener('input', e => onUpperAngleChange(e.target.value));

            document.querySelectorAll('.btn-preset-upper-angle').forEach(btn => {
                btn.addEventListener('click', () => {
                    const ang = parseFloat(btn.dataset.angle);
                    if (!isNaN(ang)) onUpperAngleChange(ang);
                });
            });

            // 2. Lower Legs Controls (Dầm ➔ Hàng)
            const inpLower = document.getElementById('inp-lowerL');
            const numLower = document.getElementById('num-lowerL');
            const onLowerChange = (valDisplay, source) => {
                const val = parseFloat(valDisplay);
                if (isNaN(val) || val <= 0) return;
                const minLowerDisp = toDisplayLen(0.35);
                const maxLowerDisp = toDisplayLen(50.0);
                const clampedVal = Math.min(maxLowerDisp, Math.max(minLowerDisp, val));

                if (source === 'slider' && numLower) numLower.value = clampedVal.toFixed(2);
                if (source === 'number' && inpLower) inpLower.value = clampedVal.toFixed(2);
                const vLower = document.getElementById('v-lowerL');
                if (vLower) vLower.textContent = clampedVal.toFixed(2);
                const lblLowerLenIndicator = document.getElementById('lbl-lower-len-indicator');
                if (lblLowerLenIndicator) lblLowerLenIndicator.textContent = `${clampedVal.toFixed(2)} m`;

                const mVal = fromInputLen(clampedVal);
                state.lowerSlingLength = mVal;
                state.slingUserSet = true;
                markCableAdjustMode();
                if (state.heldCableL0) state.heldCableL0.leg = [];

                // Cập nhật đồng bộ tức thì cho TẤT CẢ các sợi cáp Tầng 2 (L2-1, L2-2, L2-3, L2-4)
                if (state.gear && state.gear.legs) {
                    state.gear.legs.forEach(l => {
                        if (l) {
                            l.lengthM = mVal;
                            l.userSet = true;
                        }
                    });
                }

                const sel = (state.gear && state.gear.selection) ? state.gear.selection.find(s => s.kind === 'sling' && s.role === 'leg') : null;
                if (sel) {
                    const inpSel = document.getElementById('inp-selectedL');
                    const numSel = document.getElementById('num-selectedL');
                    if (inpSel) inpSel.value = clampedVal.toFixed(2);
                    if (numSel) numSel.value = clampedVal.toFixed(2);
                }
                if (typeof syncHookToRigTaut === 'function') syncHookToRigTaut();
                rebuildCargoAndRig(false);
                syncCableControlsSelection();
                updateRiggingBOMUI();
            };
            if (inpLower) inpLower.addEventListener('input', e => onLowerChange(e.target.value, 'slider'));
            if (numLower) numLower.addEventListener('input', e => onLowerChange(e.target.value, 'number'));

            // 3. Selected Single Cable Controls
            const inpSel = document.getElementById('inp-selectedL');
            const numSel = document.getElementById('num-selectedL');
            const onSelectedChange = (valDisplay, source) => {
                const sel = (state.gear && state.gear.selection) ? state.gear.selection.find(s => s.kind === 'sling') : null;
                if (!sel) return;
                const rec = (typeof gearRecord === 'function') ? gearRecord(sel) : null;
                if (!rec) return;

                const val = parseFloat(valDisplay);
                if (isNaN(val) || val <= 0) return;

                const spec = (typeof getRigSpec === 'function') ? getRigSpec() : null;
                let minDisp = 0.3;
                let maxDisp = 35.0;
                if (spec) {
                    if (sel.role === 'upper') {
                        minDisp = toDisplayLen(spec.minUpper);
                        maxDisp = toDisplayLen(spec.maxUpper);
                    } else if (sel.role === 'leg') {
                        minDisp = toDisplayLen(spec.minLower);
                        maxDisp = toDisplayLen(spec.maxLower);
                    } else if (sel.role === 'hanger') {
                        minDisp = toDisplayLen(spec.minHanger || 0.5);
                        maxDisp = toDisplayLen(spec.maxHanger || 12);
                    }
                }
                const clampedVal = Math.min(maxDisp, Math.max(minDisp, val));

                if (source === 'slider' && numSel) numSel.value = clampedVal.toFixed(2);
                if (source === 'number' && inpSel) inpSel.value = clampedVal.toFixed(2);

                const lenM = fromInputLen(clampedVal);
                rec.lengthM = lenM;
                rec.userSet = true;
                state.slingUserSet = true;

                if (sel.role === 'upper') {
                    state.upperSlingLength = lenM;
                } else if (sel.role === 'leg') {
                    state.lowerSlingLength = lenM;
                } else if (sel.role === 'hanger') {
                    state.hangerSlingLength = lenM;
                    if (state.gear && state.gear.hangers) {
                        state.gear.hangers.forEach(h => {
                            if (h) { h.lengthM = lenM; h.userSet = true; }
                        });
                    }
                }
                markCableAdjustMode();

                if (typeof syncHookToRigTaut === 'function') syncHookToRigTaut();
                if (typeof syncCableRest === 'function') syncCableRest(false);
                rebuildCargoAndRig(false);
                if (typeof renderGearFields === 'function') renderGearFields();
                syncSlingSlidersFromState();
            };
            if (inpSel) inpSel.addEventListener('input', e => onSelectedChange(e.target.value, 'slider'));
            if (numSel) numSel.addEventListener('input', e => onSelectedChange(e.target.value, 'number'));

            // Mid-tier hanger controls (cascaded / truss 3-level)
            const inpHanger = document.getElementById('inp-hangerL');
            const numHanger = document.getElementById('num-hangerL');
            const onHangerChange = (valDisplay, source) => {
                const val = parseFloat(valDisplay);
                if (isNaN(val) || val <= 0) return;
                const minH = toDisplayLen(0.5);
                const maxH = toDisplayLen(20.0);
                const clampedVal = Math.min(maxH, Math.max(minH, val));
                if (source === 'slider' && numHanger) numHanger.value = clampedVal.toFixed(2);
                if (source === 'number' && inpHanger) inpHanger.value = clampedVal.toFixed(2);
                const vHanger = document.getElementById('v-hangerL');
                if (vHanger) vHanger.textContent = clampedVal.toFixed(2);
                const lblH = document.getElementById('lbl-hanger-len-indicator');
                if (lblH) lblH.textContent = `${clampedVal.toFixed(2)} m`;

                const mVal = fromInputLen(clampedVal);
                state.hangerSlingLength = mVal;
                state.slingUserSet = true;
                markCableAdjustMode();
                if (state.heldCableL0) state.heldCableL0.hanger = [];
                if (state.gear && state.gear.hangers) {
                    state.gear.hangers.forEach(h => {
                        if (h) { h.lengthM = mVal; h.userSet = true; }
                    });
                }
                if (typeof syncHookToRigTaut === 'function') syncHookToRigTaut();
                rebuildCargoAndRig(false);
                syncCableControlsSelection();
                updateRiggingBOMUI();
            };
            if (inpHanger) inpHanger.addEventListener('input', e => onHangerChange(e.target.value, 'slider'));
            if (numHanger) numHanger.addEventListener('input', e => onHangerChange(e.target.value, 'number'));
            document.querySelectorAll('.btn-step-hanger').forEach(btn => {
                btn.addEventListener('click', () => {
                    const delta = parseFloat(btn.dataset.delta || 0);
                    const cur = parseFloat(numHanger ? numHanger.value : (inpHanger ? inpHanger.value : state.hangerSlingLength));
                    onHangerChange(Math.max(0.5, +(cur + delta).toFixed(2)), 'number');
                });
            });
            document.querySelectorAll('.btn-preset-hanger').forEach(btn => {
                btn.addEventListener('click', () => {
                    const val = parseFloat(btn.dataset.val);
                    if (!isNaN(val)) onHangerChange(val, 'number');
                });
            });

            const btnCableAutoBal = document.getElementById('btn-cable-auto-balance');
            if (btnCableAutoBal) {
                btnCableAutoBal.addEventListener('click', () => {
                    autoLevelTurnbuckles();
                });
            }

            // Step & Preset Buttons for Tier 1
            document.querySelectorAll('.btn-step-tier1').forEach(btn => {
                btn.addEventListener('click', () => {
                    const delta = parseFloat(btn.dataset.delta || 0);
                    const cur = parseFloat(numUpper ? numUpper.value : (inpUpper ? inpUpper.value : state.upperSlingLength));
                    const next = Math.max(0.5, +(cur + delta).toFixed(2));
                    onUpperChange(next, 'number');
                });
            });
            document.querySelectorAll('.btn-preset-tier1').forEach(btn => {
                btn.addEventListener('click', () => {
                    const val = parseFloat(btn.dataset.val);
                    if (!isNaN(val)) onUpperChange(val, 'number');
                });
            });

            // Step & Preset Buttons for Tier 2
            document.querySelectorAll('.btn-step-tier2').forEach(btn => {
                btn.addEventListener('click', () => {
                    const delta = parseFloat(btn.dataset.delta || 0);
                    const cur = parseFloat(numLower ? numLower.value : (inpLower ? inpLower.value : state.lowerSlingLength));
                    const next = Math.max(0.3, +(cur + delta).toFixed(2));
                    onLowerChange(next, 'number');
                });
            });
            document.querySelectorAll('.btn-preset-tier2').forEach(btn => {
                btn.addEventListener('click', () => {
                    const val = parseFloat(btn.dataset.val);
                    if (!isNaN(val)) onLowerChange(val, 'number');
                });
            });

            // Step Buttons for Selected Cable
            document.querySelectorAll('.btn-step-selected').forEach(btn => {
                btn.addEventListener('click', () => {
                    const delta = parseFloat(btn.dataset.delta || 0);
                    const cur = parseFloat(numSel ? numSel.value : (inpSel ? inpSel.value : 3.8));
                    const next = Math.max(0.3, +(cur + delta).toFixed(2));
                    onSelectedChange(next, 'number');
                });
            });

            // 4. Quick Actions for Selected Cable
            const btnSyncTier = document.getElementById('btn-sync-to-tier');
            if (btnSyncTier) {
                btnSyncTier.addEventListener('click', () => {
                    const sel = (state.gear && state.gear.selection) ? state.gear.selection.find(s => s.kind === 'sling') : null;
                    if (!sel) return;
                    const rec = (typeof gearRecord === 'function') ? gearRecord(sel) : null;
                    if (!rec || rec.lengthM == null) return;

                    const targetLenM = rec.lengthM;
                    if (sel.role === 'upper') {
                        state.upperSlingLength = targetLenM;
                        state.slingLength = targetLenM;
                        (state.gear.uppers || []).forEach(u => { u.lengthM = null; u.userSet = false; });
                    } else if (sel.role === 'leg') {
                        state.lowerSlingLength = targetLenM;
                        (state.gear.legs || []).forEach(l => { l.lengthM = null; l.userSet = false; });
                    } else if (sel.role === 'hanger') {
                        state.hangerSlingLength = targetLenM;
                        (state.gear.hangers || []).forEach(h => { h.lengthM = null; h.userSet = false; });
                    }
                    state.slingUserSet = true;
                    markCableAdjustMode();
                    if (typeof syncHookToRigTaut === 'function') syncHookToRigTaut();
                    syncSlingSlidersFromState();
                    rebuildCargoAndRig(false);
                });
            }

            const btnResetAuto = document.getElementById('btn-reset-to-auto');
            if (btnResetAuto) {
                btnResetAuto.addEventListener('click', () => {
                    const sel = (state.gear && state.gear.selection) ? state.gear.selection.find(s => s.kind === 'sling') : null;
                    if (!sel) return;
                    const rec = (typeof gearRecord === 'function') ? gearRecord(sel) : null;
                    if (rec) {
                        rec.lengthM = null;
                        rec.userSet = false;
                    }
                    if (sel.role === 'upper') {
                        state.upperSlingLength = null;
                    } else if (sel.role === 'leg') {
                        state.lowerSlingLength = null;
                    } else if (sel.role === 'hanger') {
                        state.hangerSlingLength = null;
                    }
                    state.slingUserSet = false;
                    if (typeof syncHookToRigTaut === 'function') syncHookToRigTaut();
                    if (typeof syncCableRest === 'function') syncCableRest(false);
                    syncSlingSlidersFromState();
                    rebuildCargoAndRig(false);
                    if (typeof renderGearFields === 'function') renderGearFields();
                });
            }

            const btnClearSel = document.getElementById('btn-clear-cable-selection');
            if (btnClearSel) {
                btnClearSel.addEventListener('click', () => {
                    if (state.gear && state.gear.selection) {
                        state.gear.selection = state.gear.selection.filter(s => s.kind !== 'sling');
                    }
                    syncCableControlsSelection();
                    if (typeof updateGearSelectionRings === 'function') updateGearSelectionRings();
                    if (typeof renderGearFields === 'function') renderGearFields();
                });
            }

            // 5. WLL / SWL Controls
            const inpWll = document.getElementById('inp-wll');
            const numWll = document.getElementById('num-wll');
            const onWllChange = (valRaw, source) => {
                const val = parseFloat(valRaw);
                if (isNaN(val) || val <= 0) return;

                if (source === 'slider' && numWll) numWll.value = val.toFixed(1);
                if (source === 'number' && inpWll) inpWll.value = val.toFixed(1);
                const vWll = document.getElementById('v-wll');
                if (vWll) vWll.textContent = val.toFixed(1);

                state.wllPerLeg = val;
                if (!state._manualSlingDia) {
                    const getSpec = (typeof CAE !== 'undefined' && CAE.getSlingPhysicalSpec)
                        || (typeof window !== 'undefined' && window.CAE && window.CAE.getSlingPhysicalSpec);
                    if (getSpec) {
                        const spec = getSpec(state.slingType || 'wire', val);
                        state.slingDiaMm = spec.diaMm;
                        if (state.gear) {
                            (state.gear.uppers || []).forEach(u => { u.diaMm = spec.diaMm; });
                            (state.gear.legs || []).forEach(l => { l.diaMm = spec.diaMm; });
                        }
                    }
                }
                computeRiggingMassBreakdown();
                syncSlingSlidersFromState();
                updateRiggingBOMUI();
            };
            if (inpWll) inpWll.addEventListener('input', e => onWllChange(e.target.value, 'slider'));
            if (numWll) numWll.addEventListener('input', e => onWllChange(e.target.value, 'number'));

            // 5.1. Sling Diameter / Width Controls
            const inpSlingDia = document.getElementById('inp-sling-dia');
            const numSlingDia = document.getElementById('num-sling-dia');
            const btnAutoSlingDia = document.getElementById('btn-auto-sling-dia');
            const onSlingDiaChange = (valRaw, source) => {
                const val = parseFloat(valRaw);
                if (isNaN(val) || val <= 0) return;
                state._manualSlingDia = true;
                state.slingDiaMm = val;
                if (source === 'slider' && numSlingDia) numSlingDia.value = val;
                if (source === 'number' && inpSlingDia) inpSlingDia.value = val;
                if (state.gear) {
                    (state.gear.uppers || []).forEach(u => { u.diaMm = val; });
                    (state.gear.legs || []).forEach(l => { l.diaMm = val; });
                }
                computeRiggingMassBreakdown();
                syncSlingSlidersFromState();
                updateRiggingBOMUI();
            };
            if (inpSlingDia) inpSlingDia.addEventListener('input', e => onSlingDiaChange(e.target.value, 'slider'));
            if (numSlingDia) numSlingDia.addEventListener('input', e => onSlingDiaChange(e.target.value, 'number'));
            if (btnAutoSlingDia) {
                btnAutoSlingDia.addEventListener('click', () => {
                    state._manualSlingDia = false;
                    state.slingDiaMm = null;
                    const getSpec = (typeof CAE !== 'undefined' && CAE.getSlingPhysicalSpec)
                        || (typeof window !== 'undefined' && window.CAE && window.CAE.getSlingPhysicalSpec);
                    if (getSpec) {
                        const spec = getSpec(state.slingType || 'wire', state.wllPerLeg || 15.0);
                        state.slingDiaMm = spec.diaMm;
                        if (state.gear) {
                            (state.gear.uppers || []).forEach(u => { u.diaMm = spec.diaMm; });
                            (state.gear.legs || []).forEach(l => { l.diaMm = spec.diaMm; });
                        }
                    }
                    computeRiggingMassBreakdown();
                    syncSlingSlidersFromState();
                    updateRiggingBOMUI();
                });
            }

            // 6. Metric ⇄ Imperial Unit System Switcher
            const toggleUnitSystem = () => {
                state.unitSystem = state.unitSystem === 'imperial' ? 'metric' : 'imperial';
                syncSlingSlidersFromState();
                if (typeof renderGearFields === 'function') renderGearFields();

                const status = document.getElementById('sim-status-text');
                if (status) {
                    status.textContent = state.unitSystem === 'imperial'
                        ? (state.lang === 'en' ? '📐 Unit switched to Imperial (feet / inches).' : '📐 Đã chuyển sang Hệ đo Feet (ft) & Inch.')
                        : (state.lang === 'en' ? '📏 Unit switched to Metric (meters / mm).' : '📏 Đã chuyển sang Hệ đo Mét (m) & Milimét.');
                }
            };
            const btnUnitHeader = document.getElementById('btn-unit-toggle');
            if (btnUnitHeader) btnUnitHeader.addEventListener('click', toggleUnitSystem);
            const btnUnitPanel = document.getElementById('btn-unit-toggle-panel');
            if (btnUnitPanel) btnUnitPanel.addEventListener('click', toggleUnitSystem);

            // 7. Safety Presets (ASME B30.9 Minimum Safe vs Absolute Safe)
            const btnRigMinSafe = document.getElementById('btn-rig-min-safe');
            if (btnRigMinSafe) btnRigMinSafe.addEventListener('click', applyMinSafeRiggingPreset);
            const btnRigIdealSafe = document.getElementById('btn-rig-ideal-safe');
            if (btnRigIdealSafe) btnRigIdealSafe.addEventListener('click', applyAbsoluteSafeRiggingPreset);
        }

