/**
 * session/presets_events — ASME presets, drawers, i18n, setupUIEvents
 * Split from legacy god-file (strangler Phase 2). Shared scope via assemble.
 */
        // --- ASME B30.9 RIGGING SAFETY PRESET ENGINES ---
        function applyPullAnglePreset(betaDeg) {
            const beta = THREE.MathUtils.clamp(Number(betaDeg) || 50, 40, 55);
            const spec = (typeof getRigSpec === 'function') ? getRigSpec() : null;
            const horizU = spec ? spec.horizU : Math.max(0.5, (state.L || 6.0) / 4);
            const cosB = Math.cos(beta * Math.PI / 180);
            if (cosB <= 0.01) return beta;
            let len = horizU / cosB;
            len = Math.max(2, Math.ceil(len / 2) * 2);
            state.upperSlingLength = len;
            state.slingLength = len;
            state.slingUserSet = true;
            markCableAdjustMode();
            if (state.heldCableL0) state.heldCableL0.upper = [];
            if (state.gear && state.gear.uppers) {
                state.gear.uppers.forEach(u => {
                    if (u) { u.lengthM = len; u.userSet = true; }
                });
            }
            const inp = document.getElementById('inp-upper-angle');
            const lbl = document.getElementById('lbl-upper-angle-val');
            if (inp) inp.value = beta;
            if (lbl) lbl.textContent = String(beta);
            return beta;
        }

        function applyMinSafeRiggingPreset() {
            const spec = (typeof getRigSpec === 'function') ? getRigSpec() : null;
            const evenInt = (raw, lo, hi) => {
                let e = Math.round(raw / 2) * 2;
                if (e < lo) e = lo;
                if (e > hi) e = Math.ceil(raw / 2) * 2;
                return Math.max(lo, e);
            };
            // Low end of working band: β = 40° (more headroom, higher tension — gear sized for this)
            const beta = applyPullAnglePreset(40);
            const minSafeUpper = evenInt(state.upperSlingLength || (spec ? spec.recUpper : 8), 8, 14);
            const minSafeLower = evenInt(spec ? spec.recLower : 2, 2, 4);
            const minSafeHanger = evenInt(spec ? (spec.recHanger || 2) : 2, 2, 4);

            state.upperSlingLength = minSafeUpper;
            state.slingLength = minSafeUpper;
            state.slingUserSet = true;
            markCableAdjustMode();
            if (state.heldCableL0) state.heldCableL0.upper = [];

            if (state.gear && state.gear.uppers) {
                state.gear.uppers.forEach(u => {
                    if (u) { u.lengthM = minSafeUpper; u.userSet = true; }
                });
            }

            if (state.beamType !== 'none') {
                state.lowerSlingLength = minSafeLower;
                if (state.heldCableL0) state.heldCableL0.leg = [];
                if (state.gear && state.gear.legs) {
                    state.gear.legs.forEach(l => {
                        if (l) { l.lengthM = minSafeLower; l.userSet = true; }
                    });
                }
            }
            if (hasCascadedHangerTier()) {
                state.hangerSlingLength = minSafeHanger;
                if (state.heldCableL0) state.heldCableL0.hanger = [];
                if (state.gear && state.gear.hangers) {
                    state.gear.hangers.forEach(h => {
                        if (h) { h.lengthM = minSafeHanger; h.userSet = true; }
                    });
                }
            }

            if (typeof autoSizeGearForLoad === 'function') autoSizeGearForLoad(state.weight, { betaWorstDeg: 40 });
            if (typeof syncHookToRigTaut === 'function') syncHookToRigTaut();
            rebuildCargoAndRig(false);
            syncSlingSlidersFromState();
            syncCableControlsSelection();
            updateRiggingBOMUI();

            const status = document.getElementById('sim-status-text');
            if (status) {
                status.textContent = state.lang === 'en'
                    ? `🛡️ Preset: β = ${beta}°, upper ${minSafeUpper} m, lower ${minSafeLower} m (even). Gear auto-sized for load.`
                    : `🛡️ Đã áp dụng: góc kéo β = ${beta}°, cáp trên ${minSafeUpper} m, cáp dưới ${minSafeLower} m (số chẵn). Gear tự chọn theo tải.`;
            }
        }

        function applyAbsoluteSafeRiggingPreset() {
            const spec = (typeof getRigSpec === 'function') ? getRigSpec() : null;
            // Mid/high of working band: β = 50° (even)
            const beta = applyPullAnglePreset(50);
            const idealUpper = (typeof evenTon === 'function')
                ? evenTon(state.upperSlingLength || (spec && spec.recUpper) || 8, 8)
                : Math.max(8, Math.ceil((state.upperSlingLength || 8) / 2) * 2);
            const idealLower = (spec && spec.recLower) ? spec.recLower : 2;
            const idealHanger = (spec && spec.recHanger) ? spec.recHanger : 2;

            state.upperSlingLength = idealUpper;
            state.slingLength = idealUpper;
            state.slingUserSet = true;
            markCableAdjustMode();
            if (state.heldCableL0) state.heldCableL0.upper = [];

            if (state.gear && state.gear.uppers) {
                state.gear.uppers.forEach(u => {
                    if (u) { u.lengthM = idealUpper; u.userSet = true; }
                });
            }

            if (state.beamType !== 'none') {
                state.lowerSlingLength = idealLower;
                if (state.heldCableL0) state.heldCableL0.leg = [];
                if (state.gear && state.gear.legs) {
                    state.gear.legs.forEach(l => {
                        if (l) { l.lengthM = idealLower; l.userSet = true; }
                    });
                }
            }
            if (hasCascadedHangerTier()) {
                state.hangerSlingLength = idealHanger;
                if (state.heldCableL0) state.heldCableL0.hanger = [];
                if (state.gear && state.gear.hangers) {
                    state.gear.hangers.forEach(h => {
                        if (h) { h.lengthM = idealHanger; h.userSet = true; }
                    });
                }
            }

            if (typeof autoSizeGearForLoad === 'function') autoSizeGearForLoad(state.weight, { betaWorstDeg: 40 });
            if (typeof syncHookToRigTaut === 'function') syncHookToRigTaut();
            rebuildCargoAndRig(false);
            syncSlingSlidersFromState();
            syncCableControlsSelection();
            updateRiggingBOMUI();

            const status = document.getElementById('sim-status-text');
            if (status) {
                status.textContent = state.lang === 'en'
                    ? `⭐ Default plan: β = ${beta}°, upper ${idealUpper} m, lower ${idealLower} m` + (hasCascadedHangerTier() ? `, hanger ${idealHanger} m` : '') + '. Gear auto-sized (WLL/SWL/MBL).'
                    : `⭐ Mặc định: góc kéo β = ${beta}°, cáp trên ${idealUpper} m, cáp dưới ${idealLower} m` + (hasCascadedHangerTier() ? `, treo ${idealHanger} m` : '') + '. Gear tự chọn (WLL/SWL/MBL).';
            }
        }

        window.applyMinSafeRiggingPreset = applyMinSafeRiggingPreset;
        window.applyAbsoluteSafeRiggingPreset = applyAbsoluteSafeRiggingPreset;

        window.initSlingControls = initSlingControls;

        // 25% RIGHT-SIDE SLIDE-OVER DRAWER ARCHITECTURE
        let currentDrawerTab = 'cargo';
        let isDrawerOpen = false;

        function openRightDrawer(tabName) {
            if (tabName) currentDrawerTab = tabName;
            const drawer = document.getElementById('right-side-drawer');
            if (!drawer) return;

            // Close all dropdown menus to prevent overlap
            if (window.UI?.layout) window.UI.layout.closeAllMenus();

            // Dynamically fit drawer cleanly between top-bar and bottom of screen
            const topBar = document.getElementById('top-bar');
            const topH = (topBar ? topBar.offsetHeight : 44) || 44;
            drawer.style.top = `${topH}px`;
            drawer.style.bottom = '0px';

            // Switch page
            document.querySelectorAll('.drawer-page').forEach(page => page.classList.remove('active'));
            const targetPage = document.getElementById(`drawer-page-${currentDrawerTab}`);
            if (targetPage) targetPage.classList.add('active');

            const bodyContainer = drawer.querySelector('.drawer-body-container') || drawer.querySelector('div:last-child');
            if (bodyContainer) bodyContainer.scrollTop = 0;
            drawer.scrollTop = 0;
            if (targetPage) targetPage.scrollTop = 0;

            // Switch inner pills
            document.querySelectorAll('.drawer-inner-tab-btn').forEach(btn => {
                btn.classList.toggle('active', btn.dataset.drawerTab === currentDrawerTab);
            });

            // Switch footer nav buttons
            document.querySelectorAll('.drawer-nav-btn').forEach(btn => {
                btn.classList.toggle('active', btn.dataset.drawerTab === currentDrawerTab);
            });

            // Header titles & icons
            const tabTitles = {
                cargo: { icon: '📦', title: '1. Hàng Hóa & Trọng Tâm', sub: 'Kích thước, Khối lượng, Trọng tâm CoG & Hướng xoay' },
                lugs: { icon: '📍', title: '2. Điểm Nâng & Tai Cẩu', sub: 'Vị trí Pad-eye, Bích hàn & Bảo vệ góc cáp' },
                rig: { icon: '🟠', title: '3. Dầm Ngáng & Đòn Gánh', sub: 'Spreader, Lifting Beam, Tầng 1 & Tầng 2' },
                gear: { icon: '⛓️', title: '4. Cáp Treo & Phụ Kiện', sub: 'Sling cáp/xích, Shackle ma ní & Tải an toàn WLL' },
                crane: { icon: '🏗️', title: '5. Thiết Bị Cẩu & Móc', sub: 'Cần trục Liebherr, Móc cẩu & Biểu đồ tải LMI' },
                site: { icon: '🌍', title: '6. Hiện Trường & Sàn Kê', sub: 'Nền đất, Đà kê dunnage & Tải trọng gió' }
            };
            const t = tabTitles[currentDrawerTab] || tabTitles.cargo;
            const titleEl = document.getElementById('drawer-header-title');
            const iconEl = document.getElementById('drawer-header-icon');
            const subEl = document.getElementById('drawer-header-sub');
            if (titleEl) titleEl.textContent = t.title;
            if (iconEl) iconEl.textContent = t.icon;
            if (subEl) subEl.textContent = t.sub;

            drawer.classList.remove('drawer-closed');
            drawer.classList.add('drawer-open');
            if (typeof document !== 'undefined' && document.body) {
                document.body.classList.add('drawer-open');
            }
            isDrawerOpen = true;

            state.leftCollapsed = (currentDrawerTab !== 'cargo' && currentDrawerTab !== 'lugs');
            state.rightCollapsed = !state.leftCollapsed;
            syncSheetButtons();
            // Settle Auto framing into free-stage LEFT third (boot snap is handled under loader)
            requestAnimationFrame(() => {
                if (typeof window.invalidateUiSafeNdcCache === 'function') {
                    window.invalidateUiSafeNdcCache();
                }
                if (typeof window.markCameraViewSettled === 'function') {
                    window.markCameraViewSettled();
                } else if (state.cameraFollow) {
                    state.cameraFollow.suppressUiReframe = true;
                    state.cameraFollow.stableView = true;
                    if (state.cameraFollow.behavior === 'flycam') state.cameraFollow.behavior = 'cinema';
                    if (typeof window.syncCameraFollowUI === 'function') window.syncCameraFollowUI();
                }
                // Skip visible boot tween here — bootSimulator pre-frames under the loading screen
                if (state.cameraFollow && state.cameraFollow.bootThirdsPending) return;
                if (typeof window.reframeAutoToUiSafeCenter === 'function') {
                    window.reframeAutoToUiSafeCenter({ duration: 0.65, delay: 320 });
                }
            });
        }

        function closeRightDrawer() {
            const drawer = document.getElementById('right-side-drawer');
            if (!drawer) return;
            const wasOpen = isDrawerOpen || drawer.classList.contains('drawer-open');
            drawer.classList.add('drawer-closed');
            drawer.classList.remove('drawer-open');
            if (typeof document !== 'undefined' && document.body) {
                document.body.classList.remove('drawer-open');
            }
            isDrawerOpen = false;

            document.querySelectorAll('.drawer-nav-btn').forEach(btn => btn.classList.remove('active'));
            state.leftCollapsed = true;
            state.rightCollapsed = true;
            syncSheetButtons();
            if (wasOpen && typeof window.reframeAutoToUiSafeCenter === 'function') {
                window.reframeAutoToUiSafeCenter({ duration: 0.4, delay: 300 });
            }
        }

        function toggleRightDrawer(tabName) {
            if (isDrawerOpen && currentDrawerTab === tabName) {
                closeRightDrawer();
            } else {
                openRightDrawer(tabName);
            }
        }

        if (typeof window !== 'undefined' && typeof window.addEventListener === 'function') {
            window.addEventListener('resize', () => {
                if (isDrawerOpen) {
                    const topBar = document.getElementById('top-bar');
                    const drawer = document.getElementById('right-side-drawer');
                    if (drawer && topBar) {
                        const topH = (topBar ? topBar.offsetHeight : 44) || 44;
                        drawer.style.top = `${topH}px`;
                        drawer.style.bottom = '0px';
                    }
                }
            });
        }

        function syncSheetButtons() {
            const leftBtn = document.getElementById('btn-collapse-left');
            const rightBtn = document.getElementById('btn-collapse-right');
            if (leftBtn) leftBtn.textContent = state.leftCollapsed ? (state.lang === 'en' ? 'Shapes' : 'Hình thái') : (state.lang === 'en' ? 'Close' : 'Đóng kiện');
            if (rightBtn) rightBtn.textContent = state.rightCollapsed ? (state.lang === 'en' ? 'Arrange' : 'Bố trí') : (state.lang === 'en' ? 'Close' : 'Đóng dụng cụ');
        }

        function toggleLeftPanel(forceState) {
            if (typeof forceState === 'boolean') {
                if (forceState) closeRightDrawer();
                else openRightDrawer('cargo');
            } else {
                toggleRightDrawer('cargo');
            }
        }

        function toggleRightPanel(forceState) {
            if (typeof forceState === 'boolean') {
                if (forceState) closeRightDrawer();
                else openRightDrawer('rig');
            } else {
                toggleRightDrawer('rig');
            }
        }

        const UI_EN = {
            'Sẵn sàng mô phỏng': 'Ready',
            '1. Kiện': '1. Cargo',
            'Hình thái': 'Shapes',
            '2. Cẩu': '2. Crane',
            'Hạ': 'Lower',
            'Móc': 'Hook',
            'Kéo': 'Hoist',
            '3. Dụng cụ': '3. Gear',
            'Bố trí': 'Arrange',
            'Thư viện': 'Library',
            '4. Thông số': '4. Data',
            'Phiếu chọn': 'Selected',
            'Cố định': 'Fixed',
            'Cân bằng': 'Level',
            '5. Mô phỏng': '5. Simulate',
            'Nhấc thử': 'Trial lift',
            'Đong đưa': 'Swing',
            'Dừng': 'Stop',
            'Sẵn sàng': 'Ready',
            'Hạ đất': 'Set down',
            'Số liệu': 'Readout',
            'Góc': 'Views',
            'Lực': 'Forces',
            'Nhãn': 'Marks',
            'Kiện': 'Cargo',
            'Neo': 'Lugs',
            'Sự cố': 'Incident',
            'Hiện trường': 'Site',
            '1. Thư Viện Kiện Hàng 3D': '1. Cargo library',
            'Container lạnh': 'Refrigerated',
            'Mở nóc': 'Open top',
            'Sàn + vách đầu': 'Deck and end walls',
            'Container bồn': 'Tank container',
            'Sàn phẳng': 'Flat platform',
            '📦 Thùng Máy': '📦 Machinery case',
            'Gỗ/Thép': 'Timber / steel',
            '🛢️ Bồn Áp Lực': '🛢️ Pressure vessel',
            'Trụ ngang': 'Horizontal shell',
            '⚡ Biến Áp': '⚡ Transformer',
            'Lệch tâm': 'Offset CoG',
            '🚗 Xe Cơ Giới': '🚗 Vehicle',
            '🚢 Tàu Thủy': '🚢 Vessel',
            'Thân tàu + ca bin': 'Hull and cabin',
            '🚜 Máy Xúc': '🚜 Excavator',
            'Bánh xích': 'Crawler tracks',
            'Tua-bin gió': 'Wind turbine',
            '2. Kích Thước Hình Học & Tải Trọng': '2. Size and weight',
            'Dài (L):': 'Length (L):',
            'Rộng (W):': 'Width (W):',
            'Nặng (W):': 'Weight:',
            'Tấn': 't',
            '3. Đặt Trọng Tâm Kiện Hàng (3D CoG)': '3. Cargo centre of gravity',
            'Đưa Về Tâm 0': 'Centre it',
            'Mặt bằng LP & CoG': 'Plan of LP and CoG',
            'Lệch dọc X (eX):': 'Longitudinal offset X:',
            'Lệch ngang Z (eZ):': 'Transverse offset Z:',
            'Độ cao CoG (eY):': 'CoG height Y:',
            'Mẹo:': 'Tip:',
            'Bấm': 'Press',
            '🔍 X-Ray Hàng': 'X-Ray',
            'hoặc kéo trực tiếp quả cầu': 'or drag the',
            'trên 3D/Sơ đồ.': 'sphere in the 3D view or on the plan.',
            '4. Thiết Lập Điểm Neo (Lifting Points)': '4. Lifting points',
            'Đối Xứng 4 Góc': 'Symmetric corners',
            'Tai cẩu': 'Pad-eyes',
            'hàn sát vỏ thật': 'are welded to the real shell',
            'của kiện (không đặt theo hộp bao). Kéo LP trên bề mặt 3D, hoặc chỉnh tọa độ — điểm sẽ bám lại mặt vỏ.': 'of the cargo, not a bounding box. Drag an LP on the 3D surface, or edit the coordinates. The point snaps back to the shell.',
            'Vị trí lắp tai cẩu:': 'Pad-eye elevation:',
            'Trên Đỉnh Hàng': 'Top',
            'Giữa Thân': 'Mid-height',
            'Đáy Hàng': 'Bottom',
            'Cả 4': 'All 4',
            'Tọa độ Dọc LP (X):': 'LP longitudinal X:',
            'Tọa độ Ngang LP (Z):': 'LP transverse Z:',
            'Cao độ Tai cẩu (Y):': 'Pad-eye height Y:',
            'Tăng đơ chỉnh độ dài cáp (ΔL):': 'Turnbuckle length trim (ΔL):',
            '2C. Hướng Đặt & Góc Xoay Kiện Trên Nền Đất': '2C. Cargo Pre-Lift Ground Orientation',
            'Góc xoay hướng kiện (Yaw ψ):': 'Cargo heading yaw ψ:',
            'Hướng dầm ngáng:': 'Spreader heading:',
            'Dầm 0° Cẩu (Xiên)': 'Spreader 0° (Skew)',
            'Xoay theo kiện': 'Follow cargo',
            'Độ lệch kiện vs dầm (Δθ):': 'Cargo vs Spreader skew (Δθ):',
            '5. Góc Xoay, Hướng Xoay & Hướng Kéo': '5. Orientation and pull',
            'Đặt Lại 0°': 'Reset 0°',
            'Đặt kiện ở đúng góc sự cố khi còn trên mặt đất, bắt cáp, rồi kéo. Khi cáp căng, hàng được thả để vật lý xoay thật.': 'Set the incident angle while the cargo is on the ground, attach the rig, then hoist. Once the ropes go taut the cargo is free to rotate.',
            'KHÓA GÓC ĐẶT': 'POSE LOCKED',
            'Khóa lại góc này': 'Lock this pose',
            'Đứng thẳng': 'Upright',
            'Nghiêng 28°': 'Heel 28°',
            'Đổ nằm phải': 'Lay right',
            'Đổ nằm trái': 'Lay left',
            'Cắm đầu': 'Nose down',
            'Ngửa lệch': 'Nose up',
            'Góc Xoay Ngang Hàng (Yaw ψ):': 'Cargo yaw ψ:',
            '0° Chuẩn': '0° datum',
            'Góc Chúc Dọc (Pitch):': 'Pitch:',
            'Góc Nghiêng (Roll):': 'Roll:',
            '🧭 ĐIỀU KHIỂN HƯỚNG KÉO CẨU (PULL VECTOR)': 'PULL DIRECTION',
            'Thẳng đứng': 'Vertical',
            'Hướng Phương Vị Kéo (Azimuth φ):': 'Pull azimuth φ:',
            'Độ Lệch Tầm Kéo Ngang (Pull Offset R):': 'Horizontal pull offset R:',
            'Móc Cẩu Dọc (X):': 'Hook X:',
            'Móc Cẩu Ngang (Z):': 'Hook Z:',
            'Bối cảnh thao tác': 'Work site',
            '⚓ Cảng container': '⚓ Container port',
            'Bãi, cầu cảng, mặt nước': 'Yard, quay and water',
            '🌤️ Bãi ngoài trời': '🌤️ Open yard',
            'Sân công trường, trời sáng': 'Jobsite, daylight',
            '🏙️ Khu đông dân': '🏙️ Urban site',
            'Nhà, đường, người qua lại': 'Buildings, road and people',
            '🌊 Ngoài khơi': '🌊 Offshore',
            'Sàn thép trên biển': 'Steel deck at sea',
            'Mặt nền': 'Ground',
            'Phẳng': 'Flat',
            'Bê tông / sàn': 'Concrete / deck',
            'Đất đầm': 'Compacted soil',
            'Đường đất, có gỗ kê': 'Dirt, with dunnage',
            'Gồ ghề': 'Rough',
            'Mấp mô': 'Uneven',
            'Nền gồ ghề đổi điểm tiếp xúc của kiện. Khu đông dân cộng thêm mức rủi ro vì có người và công trình xung quanh.': 'Rough ground changes the contact points. An urban site adds risk from people and structures nearby.',
            '1. Phương Tiện Máy Cẩu (3D Cranes)': '1. Crane',
            'Bám theo Móc Cẩu': 'Tracks the hook',
            '🏗️ Cẩu Bờ Cảng LHM': '🏗️ Harbour crane',
            '🌉 Cẩu Giàn RTG/STS': '🌉 Gantry crane',
            '🚜 Cẩu Bánh Xích': '🚜 Crawler crane',
            '🚢 Cẩu Nổi Sà Lan': '🚢 Floating crane',
            '2. Phương Án Dầm Ngáng (Spreader Beams)': '2. Spreader arrangement',
            '🔗 Chùm 4 Cáp Chụm': '🔗 4-leg bridle',
            '🏗️ Dầm Ngáng Đơn H': '🏗️ Single spreader',
            '🟠 Hệ Ngáng Ống 2 Tầng': '🟠 Cascaded spreader',
            '🟧 Khung Ngáng Hộp': '🟧 Box frame',
            '➰ Cáp Vòng Ôm Đáy': '➰ Basket hitch',
            '📐 Dầm Giàn Không Gian': '📐 Truss spreader',
            '3. Kho Dây Cáp, Ma Ní & Móc (Gear Store)': '3. Rope, shackle and hook store',
            'Cáp Thép': 'Wire rope',
            'Xích G80': 'Grade 80 chain',
            'Cáp Vải': 'Webbing sling',
            'Ma Ní Omega': 'Bow shackle',
            'Ma Ní Chữ D': 'D shackle',
            'Móc Clevis': 'Clevis hook',
            'Chiều dài nhánh trên (L):': 'Upper leg length (L):',
            'WLL mỗi nhánh:': 'WLL per leg:',
            'Nhấp đúp dây cáp, ma ní, dầm hoặc móc trên mô hình để nhập SWL, chiều dài, kích thước và khối lượng. Giữ Ctrl và chọn nhiều món cùng loại để sửa một lúc. Góc cáp là đường thẳng giữa hai ma ní; mặc định ~40–55° so với phương ngang (cáp trên 8–10 m, cáp dưới 2–4 m). Đổi chiều dài thì góc đổi theo khẩu độ.': 'Double-click a rope, shackle, beam or the hook to edit SWL, length, size and weight. Ctrl-click selects several items of the same type. The rope angle is the line between the two pins. Defaults are ~40–55° to the horizontal (upper 8–10 m, lower 2–4 m). Changing the length changes the angle for the same span.',
            'Giữ Ctrl + kéo khung chuột để chọn nhiều thiết bị; thông số hiện bên trái và có thể cuộn. Nhấp đúp để sửa một món. Shift+kéo xoay góc camera — chuột trái vẫn xoay/kéo tự do.': 'Hold Ctrl and drag a box to multi-select parts; parameters stack on the left and scroll. Double-click edits one item. Shift+drag adjusts camera angle — left-drag still orbits freely.',
            'Giữ Shift + kéo khung chuột để chọn nhiều thiết bị; thông số hiện bên trái và có thể cuộn. Nhấp đúp để sửa một món. Chuột trái xoay/kéo camera tự do — không còn bị khóa vào kiện hàng khi đang thao tác góc nhìn.': 'Hold Ctrl and drag a box to multi-select parts; parameters stack on the left and scroll. Double-click edits one item. Shift+drag adjusts camera angle — left-drag still orbits freely.',
            '📊 Thông Số Kỹ Thuật & Tải Trọng Cáp': 'Rope engineering data',
            'CHUẨN AN TOÀN': 'WITHIN LIMITS',
            'Góc Cáp (Dọc α)': 'Rope angle from vertical α',
            'Ngang β: 61.5°': 'To horizontal β',
            'Độ Nghiêng Hàng': 'Out of level',
            'Cách sàn: 0.00m': 'Clearance',
            'Tổng Tải Móc Cẩu': 'Hook load',
            'LỰC CĂNG 4 NHÁNH CÁP (LP1 → LP4)': 'FOUR LEG TENSIONS (LP1 → LP4)',
            'CHƯA KÉO (CÁP CHÙNG)': 'SLACK — NOT HOISTING',
            '💡 Kiện hàng đang đặt trên đà gỗ kê (Dunnage). Bạn có thể kéo trực tiếp các điểm LP1-LP4 hoặc CoG, sau đó bấm': 'The cargo is on the dunnage. Drag LP1–LP4 or the CoG, then press',
            '🏗️ Nhấc Thử Tải': 'Trial lift',
            'Hư hỏng vỏ · Damage': 'Shell damage',
            'Rủi ro': 'Risk',
            'AN TOÀN': 'SAFE',
            'Cảng container': 'Container port',
            'Góc đặt đang khóa': 'Pose locked',
            '🎥 Góc Nhìn:': 'Camera:',
            'Góc Phối Cảnh 3D': 'Isometric',
            'Toàn Cảnh Máy Cẩu': 'Crane view',
            'Mặt Trước (Dọc)': 'Front',
            'Mặt Bên (Ngang)': 'Side',
            'Mặt Bằng (Từ Trên)': 'Plan',
            'Thông số thiết bị': 'Gear data',
            'Ctrl+nhấp đúp hoặc Alt+nhấp để mở phiếu kỹ thuật. Ctrl+nhấp gộp cùng loại.': 'Ctrl+double-click or Alt+click opens the data sheet. Ctrl+click adds another item of the same type.',
            'Nhấp bất kỳ chi tiết 3D để sửa thông số. Ctrl+nhấp để gộp cùng loại.': 'Click any 3D part to edit its data. Ctrl+click adds another item of the same type.',
            'Nhấp bất kỳ chi tiết 3D để sửa. Để trống chiều dài/SWL để theo thông số chung.': 'Click any 3D part to edit. Blank length or SWL follows the global slider.',
            'Giữ Ctrl + kéo khung chuột để chọn nhiều. Nhấp đúp một vật để sửa đơn. Cuộn panel trái để chỉnh từng mục. Shift+kéo chỉnh góc camera.': 'Ctrl+drag a box to multi-select. Double-click one part for a single edit. Scroll the left panel to adjust each item. Shift+drag adjusts camera angle.',
            'Giữ Shift + kéo khung chuột để chọn nhiều. Nhấp đúp một vật để sửa đơn. Cuộn panel trái để chỉnh từng mục.': 'Ctrl+drag a box to multi-select. Double-click one part for a single edit. Scroll the left panel to adjust each item. Shift+drag adjusts camera angle.',
            'Giữ Ctrl + kéo khung để chọn. Cuộn xuống để chỉnh từng thiết bị.': 'Ctrl+drag a box to select. Scroll to edit each part below.',
            'Giữ Shift + kéo khung để chọn. Cuộn xuống để chỉnh từng thiết bị.': 'Ctrl+drag a box to select. Scroll to edit each part below.',
            'Theo thông số chung · Use global': 'Use global',
            'Nối lại · Reeve': 'Reeve',
            'Bỏ chọn · Clear': 'Clear',
            'Hình thái kiện hàng': 'Cargo shape',
            'Di chuyển móc và cần cẩu': 'Move the hook and crane',
            'Mở hình thái kiện, kích thước, điểm neo': 'Open cargo shape, size and lifting points',
            'Giữ để hạ móc': 'Hold to lower the hook',
            'Giữ để kéo móc': 'Hold to hoist the hook',
            'Giữ để quay cần sang trái': 'Hold to slew left',
            'Giữ để quay cần sang phải': 'Hold to slew right',
            'Bố trí dụng cụ làm hàng': 'Arrange the lifting gear',
            'Mở kho cẩu, dầm, cáp, ma ní': 'Open the crane, beam, rope and shackle store',
            'Kho thư viện 3D, STL và ảnh': '3D library, STL and photos',
            'Thông số của món đang chọn': 'Data for the selected item',
            'Mở phiếu của cáp, ma ní, dầm hoặc móc đang chọn': 'Open the sheet for the selected rope, shackle, beam or hook',
            'Cố định: chỉ đổi món đang chọn. Auto: cáp đổi dài để vẫn lắp được.': 'Fixed: only the selected item changes. Auto: rope lengths retune so the rig still assembles.',
            'Chỉnh tăng đơ cho hàng nằm phẳng': 'Trim the turnbuckles so the cargo hangs level',
            'Chạy và xem mô phỏng': 'Run and review the simulation',
            'Kéo thử tải từ từ': 'Hoist a trial load slowly',
            'Tạo xung đong đưa': 'Apply a swing impulse',
            'Ghi thao tác': 'Record the operation',
            'Xem lại thao tác': 'Play the recording',
            'Dừng ghi hoặc phát': 'Stop recording or playback',
            'Hạ kiện về đà kê, giữ điểm neo': 'Set the cargo back on the dunnage and keep the lifting points',
            'Đưa toàn bộ về mặc định': 'Restore factory defaults',
            'Hiện số liệu tải': 'Show the load readout',
            'Hiện nút góc nhìn': 'Show the camera buttons',
            'Nhìn xuyên kiện': 'See through the cargo',
            'Nét CAD': 'CAD edges',
            'Mũi tên lực': 'Force arrows',
            'Nhãn điểm neo': 'Lifting-point labels',
            'Nhãn trọng tâm': 'CoG label',
            'Ẩn hoặc hiện toàn bộ nhãn': 'Hide or show every label',
            'Đóng các bảng để xem mô phỏng': 'Close the sheets and keep the view',
            'Switch language / Đổi ngôn ngữ': 'Switch language',
            '📦 TRUNG TÂM THƯ VIỆN THIẾT KẾ 3D & AI 3D RECONSTRUCTION STUDIO': '3D library and reconstruction studio',
            'STL / OBJ / GLB / ẢNH 2D → 3D': 'STL / OBJ / GLB / photo to 3D',
            'Quản lý kho Kiện hàng, Cần cẩu, Dầm ngáng, Phương án bắt cáp & Dụng cụ nâng hạ — Cho phép Upload file thiết kế in 3D hoặc Tạo khối 3D tự động từ Ảnh chụp': 'Cargo, cranes, spreaders, rigging plans and lifting gear. Upload a 3D file or build a solid from a photo.',
            '✕ Đóng & Quay Lại Mô Phỏng 3D': 'Close and return to the 3D view',
            '🗃️ Kiện Hàng 3D (': 'Cargo (',
            '🏗️ Máy Cẩu (': 'Cranes (',
            '🟠 Dầm Ngáng (': 'Spreaders (',
            '🔗 Phương Án Cáp (': 'Rigging plans (',
            '🪝 Kho Ma Ní & Móc (': 'Shackles and hooks (',
            'Tare 2.3 t + hàng, dải 18–24 t': 'Tare 2.3 t plus cargo, band 18–24 t',
            'Dải công nghiệp 26–30.5 t': 'Industrial band 26–30.5 t',
            'Container lạnh Reefer 40ft': '40 ft reefer container',
            'Mở nóc, khung cung': 'Open top, roof bows',
            'Sàn + hai vách đầu': 'Deck and two end walls',
            'Dải bồn 26–32 t': 'Tank band 26–32 t',
            'Sàn phẳng không vách': 'Flat deck, no walls',
            'Thùng Máy Công Nghiệp': 'Industrial machinery case',
            'Khung dầm thép gia cường': 'Stiffened steel frame',
            'Bồn Áp Lực ASME': 'ASME pressure vessel',
            'Dải bồn chịu áp 28–55 t': 'Pressure-vessel band 28–55 t',
            'Máy Biến Áp 110kV': '110 kV transformer',
            'Dải máy biến áp 45–85 t': 'Transformer band 45–85 t',
            'Xe Bán Tải / SUV': 'Vehicle',
            'Dải xe 2.4–3.2 t': 'Vehicle band 2.4–3.2 t',
            'Tàu Lai Công Tác': 'Workboat',
            'Dải tàu 22–45 t': 'Vessel band 22–45 t',
            'Tua-bin Điện Gió (Nacelle)': 'Wind-turbine nacelle',
            'Dải nacelle 65–95 t': 'Nacelle band 65–95 t',
            'Máy Xúc Đào Bánh Xích': 'Crawler excavator',
            '🎯 CoG (Kéo 3D)': 'CoG — drag in 3D',
            '🔍 Xem 3D': 'View 3D',
            'Chọn Dùng': 'Use this',
            'Đặt Tên Vật Phẩm / Thiết Bị 3D:': 'Item name:',
            'Phân Loại Vào Kho Thư Viện:': 'Library category:',
            '📂 Bấm chọn File 3D (.STL, .OBJ, .GLB) từ máy tính': 'Choose a 3D file (.STL, .OBJ, .GLB)',
            'Bấm chọn File 3D (.STL, .OBJ, .GLB) từ máy tính': 'Choose a 3D file (.STL, .OBJ, .GLB)',
            'Chưa chọn file (Hoặc bấm nút Tạo Mẫu STL Thử Nghiệm bên dưới)': 'No file selected',
            '🖼️ Chọn Tấm Hình Vật Phẩm (.PNG, .JPG, .WEBP)': 'Choose a photo (.PNG, .JPG, .WEBP)',
            'Chọn Tấm Hình Vật Phẩm (.PNG, .JPG, .WEBP)': 'Choose a photo (.PNG, .JPG, .WEBP)',
            'Tự động tách nền & đùn khối nổi 3D': 'Remove the background and extrude a 3D solid'
        };

        function libText(s) {
            if (!s) return '';
            if (state.lang !== 'en') return s;
            return UI_EN[s] || s;
        }

        function applyPhrases(root) {
            const walker = document.createTreeWalker(root || document.body, NodeFilter.SHOW_TEXT);
            const nodes = [];
            while (walker.nextNode()) nodes.push(walker.currentNode);
            nodes.forEach(node => {
                const raw = node.nodeValue;
                if (!raw || !raw.trim()) return;
                if (!node.__vi) node.__vi = raw.trim();
                const en = UI_EN[node.__vi];
                if (!en) return;
                const lead = raw.match(/^\s*/)[0];
                const tail = raw.match(/\s*$/)[0];
                node.nodeValue = lead + (state.lang === 'en' ? en : node.__vi) + tail;
            });
            (root || document.body).querySelectorAll('[title]').forEach(el => {
                if (!el.dataset.viTitle) el.dataset.viTitle = el.getAttribute('title') || '';
                const en = UI_EN[el.dataset.viTitle];
                if (!en) return;
                el.setAttribute('title', state.lang === 'en' ? en : el.dataset.viTitle);
            });
        }

        function applyLang() {
            applyPhrases(document.body);
            document.querySelectorAll('[data-i18n]').forEach(el => { el.textContent = bi(el.dataset.i18n); });
            const buttons = {
                'btn-reset-initial': ['Hạ đất', 'Set down'],
                'btn-set-baseline': ['📌 Đặt Mốc Đầu', '📌 Set Home'],
                'btn-reset-all': ['🔴 Reset', '🔴 Reset'],
                'btn-hoist-down': ['Hạ', 'Lower'],
                'btn-hoist-up': ['Kéo', 'Hoist'],
                'btn-pretension': ['⚡ Nhớm cáp', '⚡ Snug rig'],
                'btn-test-lift': ['Nhấc thử', 'Trial lift'],
                'btn-swing-test': ['Đong đưa', 'Swing'],
                'btn-slew-left': ['⟲', '⟲'],
                'btn-slew-right': ['⟳', '⟳'],
                'btn-rec': ['Ghi', 'Record'],
                'btn-replay': ['Xem', 'Play'],
                'btn-replay-stop': ['Dừng', 'Stop'],
                'btn-auto-level': ['Cân bằng', 'Level'],
                'btn-cable-auto-balance': ['⚖️ Auto cân bằng (tính lại chiều dài cáp)', '⚖️ Auto-balance (recalc cable lengths)'],
                'btn-xray': ['X-Ray', 'X-Ray'],
                'btn-toggle-cad-edges': ['CAD', 'CAD'],
                'btn-toggle-vectors': ['Lực', 'Force'],
                'btn-toggle-lp-labels': ['LP', 'LP'],
                'btn-toggle-cog-label': ['CoG', 'CoG']
            };
            Object.keys(buttons).forEach(id => {
                const el = document.getElementById(id);
                if (!el) return;
                const pair = buttons[id];
                el.textContent = state.lang === 'en' ? pair[1] : pair[0];
                el.title = el.textContent;
            });
            syncResetButtonState();
            document.querySelectorAll('.cam-btn').forEach(btn => {
                const map = {
                    iso: ['📐 Iso', '📐 Iso'],
                    hook: ['🪝 Móc', '🪝 Hook'],
                    front: ['⬆️ Đứng', '⬆️ Front'],
                    side: ['➡️ Bên', '➡️ Side'],
                    top: ['📄 Bằng', '📄 Plan'],
                    crane: ['🏗️ Cẩu', '🏗️ Crane']
                };
                const pair = map[btn.dataset.cam];
                if (!pair) return;
                btn.textContent = state.lang === 'en' ? pair[1] : pair[0];
                btn.title = btn.textContent;
            });
            const langBtn = document.getElementById('btn-lang');
            if (langBtn) langBtn.textContent = state.lang === 'vi' ? 'EN' : 'VI';
            toggleLeftPanel(state.leftCollapsed);
            toggleRightPanel(state.rightCollapsed);
            const full = document.getElementById('btn-fullscreen-view');
            if (full) {
                const hidden = state.leftCollapsed && state.rightCollapsed;
                full.textContent = hidden ? (state.lang === 'en' ? 'Sheets' : 'Bảng') : 'Full';
                full.title = hidden
                    ? L('Open the data sheet', 'Mở bảng thông số')
                    : L('Close the sheets and keep the view', 'Đóng bảng, chỉ xem mô phỏng');
            }
            const allHidden = !state.showVectors && !state.showLPLabels && !state.showCoGLabel;
            const hideBtn = document.getElementById('btn-hide-all-indicators');
            if (hideBtn) hideBtn.textContent = allHidden
                ? (state.lang === 'en' ? 'Marks' : 'Nhãn')
                : (state.lang === 'en' ? 'Hide' : 'Ẩn');
            syncSoundButton();
            if (state.gear.selection.length) openGearEditor();
            if (typeof syncSlingSlidersFromState === 'function') syncSlingSlidersFromState();
        }

        function syncSoundButton() {
            const btn = document.getElementById('btn-sound-toggle');
            if (!btn || typeof simAudio === 'undefined') return;
            const muted = simAudio.isMuted();
            btn.textContent = muted
                ? (state.lang === 'en' ? '🔇 Muted' : '🔇 Tắt')
                : (state.lang === 'en' ? '🔊 Audio' : '🔊 Âm thanh');
            btn.classList.toggle('active', !muted);
            btn.classList.toggle('text-slate-400', muted);
            btn.title = muted
                ? (state.lang === 'en' ? 'Unmute sound effects (M)' : 'Bật âm thanh mô phỏng (M)')
                : (state.lang === 'en' ? 'Mute sound effects (M)' : 'Tắt âm thanh mô phỏng (M)');
        }

        function setupUIEvents() {
            bindGearEditor();
            const btnSound = document.getElementById('btn-sound-toggle');
            if (btnSound) {
                btnSound.addEventListener('click', () => {
                    if (typeof simAudio !== 'undefined') {
                        simAudio.toggleMute();
                        syncSoundButton();
                    }
                });
                syncSoundButton();
            }
            const langBtn = document.getElementById('btn-lang');
            if (langBtn) langBtn.addEventListener('click', () => {
                state.lang = state.lang === 'vi' ? 'en' : 'vi';
                applyLang();
            });

            // Photorealistic Graphics & HDRI Atmosphere Controls
            const selGfxPreset = document.getElementById('sel-gfx-preset');
            if (selGfxPreset) {
                selGfxPreset.addEventListener('change', e => {
                    const em = window.envManager || envManager;
                    if (em) em.applyPreset(e.target.value);
                });
            }
            const selGfxQuality = document.getElementById('sel-gfx-quality');
            if (selGfxQuality) {
                selGfxQuality.addEventListener('change', e => {
                    const sr = window.sceneRenderer || sceneRenderer;
                    if (sr) sr.setQuality(e.target.value);
                });
            }
            const btnUploadHdri = document.getElementById('btn-upload-hdri');
            const inpHdri = document.getElementById('inp-custom-hdri');
            if (btnUploadHdri && inpHdri) {
                btnUploadHdri.addEventListener('click', () => inpHdri.click());
                inpHdri.addEventListener('change', async e => {
                    const file = e.target.files && e.target.files[0];
                    const em = window.envManager || envManager;
                    if (!file || !em) return;
                    try {
                        btnUploadHdri.textContent = '⏳ Nạp...';
                        await em.loadHDREnvironment(file);
                        btnUploadHdri.textContent = '✅ ' + file.name.slice(0, 8);
                    } catch (err) {
                        console.error('[Graphics] Failed to load custom HDRI:', err);
                        alert('Lỗi nạp file HDRI/EXR: ' + (err.message || err));
                        btnUploadHdri.textContent = '❌ Lỗi';
                    }
                });
            }


            // Right-Side Drawer Navigation Buttons
            document.querySelectorAll('.drawer-nav-btn').forEach(btn => {
                btn.addEventListener('click', () => {
                    toggleRightDrawer(btn.dataset.drawerTab);
                });
            });

            document.querySelectorAll('.drawer-inner-tab-btn').forEach(btn => {
                btn.addEventListener('click', () => {
                    openRightDrawer(btn.dataset.drawerTab);
                });
            });

            const btnCloseDrawer = document.getElementById('btn-close-drawer');
            if (btnCloseDrawer) {
                btnCloseDrawer.addEventListener('click', () => {
                    closeRightDrawer();
                });
            }

            const btnToggleDrawer = document.getElementById('btn-toggle-drawer');
            if (btnToggleDrawer) {
                btnToggleDrawer.addEventListener('click', () => {
                    toggleRightDrawer(currentDrawerTab || 'cargo');
                });
            }

            // 1. Panel Collapse & Fullscreen Clean View Buttons
            document.getElementById('btn-collapse-left').addEventListener('click', () => toggleLeftPanel());
            document.getElementById('btn-rig-fit').addEventListener('click', () => {
                state.rigFit = state.rigFit === 'auto' ? 'fixed' : 'auto';
                if (state.rigFit === 'auto') {
                    state.holdCableLength = false;
                    state.heldCableL0 = null;
                    (state.gear.extraCables || []).forEach(ex => { ex.userSet = false; });
                    syncCableRest(true);
                } else holdCableLengths();
                syncRigFitButton();
                const status = document.getElementById('sim-status-text');
                if (status) status.textContent = state.rigFit === 'auto'
                    ? 'Chế độ Auto: đổi một kích thước thì cáp co giãn theo để vẫn lắp được.'
                    : 'Chế độ cố định: chỉ đổi đúng món đang chọn. Chỗ không lắp được hiện thanh đỏ.';
            });
            document.getElementById('btn-gear-sheet').addEventListener('click', () => {
                if (!state.gear.selection.length) {
                    const status = document.getElementById('sim-status-text');
                    if (status) status.textContent = 'Bấm một sợi cáp, ma ní, dầm hoặc móc trên mô hình để mở thông số.';
                    return;
                }
                openGearEditor();
            });
            document.getElementById('btn-toggle-hud').addEventListener('click', () => {
                document.body.classList.toggle('show-hud');
            });
            document.getElementById('btn-toggle-cam').addEventListener('click', () => {
                document.body.classList.toggle('show-cam');
            });
            syncRigFitButton();
            restoreUserRigs();
            document.getElementById('btn-collapse-right').addEventListener('click', () => toggleRightPanel());

            const btnFull = document.getElementById('btn-fullscreen-view');
            btnFull.addEventListener('click', () => {
                const gear = document.getElementById('gear-editor');
                const gearOpen = gear && gear.style.display !== 'none' && gear.style.display !== '';
                const any = !state.leftCollapsed || !state.rightCollapsed || gearOpen;
                if (any) {
                    state.leftCollapsed = true;
                    state.rightCollapsed = true;
                    if (gear) gear.style.display = 'none';
                    document.body.classList.remove('gear-editor-open');
                    syncSheetButtons();
                } else toggleLeftPanel(false);
            });

            window.addEventListener('keydown', e => {
                if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.tagName === 'SELECT') return;
                if (window.UI?.layout?.shouldSuspend3DHotkeys()) {
                    if (e.key === 'Escape') {
                        if (window.UI.layout.handleEscape()) {
                            e.preventDefault();
                            return;
                        }
                    }
                    return;
                }
                if (e.key === 'Escape') {
                    if (window.UI?.layout && window.UI.layout.handleEscape()) {
                        e.preventDefault();
                        return;
                    }
                }
                if (e.key === 'F1' || e.key === '1') { e.preventDefault(); toggleRightDrawer('cargo'); }
                if (e.key === 'F2' || e.key === '2') { e.preventDefault(); toggleRightDrawer('lugs'); }
                if (e.key === 'F3' || e.key === '3') { e.preventDefault(); toggleRightDrawer('rig'); }
                if (e.key === 'F4' || e.key === '4') { e.preventDefault(); toggleRightDrawer('gear'); }
                if (e.key === 'F5' || e.key === '5') { e.preventDefault(); toggleRightDrawer('crane'); }
                if (e.key === 'F6' || e.key === '6') { e.preventDefault(); toggleRightDrawer('site'); }
                if (e.key === 'h' || e.key === 'H') btnFull.click();
                if (e.key === 'm' || e.key === 'M') {
                    if (typeof simAudio !== 'undefined') {
                        simAudio.toggleMute();
                        syncSoundButton();
                    }
                }
            });
            syncResetButtonState();

            // 3. X-Ray Cargo Toggle
            const btnXray = document.getElementById('btn-xray');
            if (btnXray) {
                btnXray.addEventListener('click', () => {
                    state.xrayCargo = !state.xrayCargo;
                    if (typeof applyXRayToCargo === 'function') {
                        applyXRayToCargo(cargoRootGroup, state.xrayCargo);
                    }
                    syncDisplayOptionsUI();
                });
            }

            // 4. Crane Vehicle Selector
            const craneCards = document.querySelectorAll('#crane-store .card-btn');
            craneCards.forEach(card => {
                card.addEventListener('click', () => {
                    craneCards.forEach(c => c.classList.remove('active'));
                    card.classList.add('active');
                    state.craneType = card.dataset.crane;
                    buildCraneVehicle();
                });
            });

            // 5. Cargo Library Cards
            const cargoCards = document.querySelectorAll('#cargo-library .card-btn');
            cargoCards.forEach(card => {
                card.addEventListener('click', () => {
                    cargoCards.forEach(c => c.classList.remove('active'));
                    card.classList.add('active');
                    const type = card.dataset.cargo;
                    state.cargoType = type;
                    state.slingUserSet = false;
                    state.upperSlingLength = null;
                    state.lowerSlingLength = null;
                    releaseBeamLengthOverrides();
                    state.legDeltaL = [0, 0, 0, 0];
                    state.cargoYawDeg = 0;
                    state.cargoPitchTrimDeg = 0;
                    state.cargoRollTrimDeg = 0;
                    state.poseLock = true;
                    const preset = libraryCatalog.cargo.find(item => item.id === type);
                    if (preset && preset.L) {
                        state.weightUserSet = false;
                        state.isoCode = preset.isoCode || null;
                        state.tareT = preset.tareT != null ? preset.tareT : null;
                        state.maxPayloadT = preset.maxPayloadT != null ? preset.maxPayloadT : null;
                        state.maxGrossT = preset.maxGrossT != null ? preset.maxGrossT : null;
                        setDimAndCoG({
                            L: preset.L, W: preset.W, H: preset.H,
                            weight: calibratedWeight(type, preset.L, preset.W, preset.H) || preset.weight,
                            cogX: preset.cogX || 0, cogY: preset.cogY || 0, cogZ: preset.cogZ || 0
                        });
                    } else {
                        state.isoCode = null;
                        state.tareT = null;
                        state.maxPayloadT = null;
                        state.maxGrossT = null;
                    }
                    syncOogCargoUI(true);
                    syncOrientationAndPullUI();
                    // Linked direct: auto-match STS pitch to the new box.
                    // Cable / unlinked: keep the operator's spreader size (e.g. 40ft ngáng + 20ft cont).
                    if (state.beamType === 'container_spreader' && !state.stsTwinLift) {
                        const indep = (typeof stsSpreaderSizeIndependent === 'function')
                            ? stsSpreaderSizeIndependent()
                            : (state.stsSizeLinked === false || (state.stsAttachMode || 'direct') === 'cable');
                        if (!indep
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
                    resetToInitialPreLiftState();
                    if (typeof seatStsSpreaderToCargo === 'function') seatStsSpreaderToCargo();
                });
            });

            // 5B. OOG Cargo & Tarpaulin Controls (Open Top / Flat Rack)
            const btnOogCargo = document.getElementById('btn-oog-has-cargo');
            if (btnOogCargo) {
                btnOogCargo.addEventListener('click', () => {
                    state.oogHasCargo = !state.oogHasCargo;
                    if (!state.weightUserSet) {
                        const tare = state.tareT != null ? state.tareT
                            : ((state.cargoType === 'flatrack' || state.cargoType === 'flatrack20') ? 4.8
                                : ((state.cargoType === 'platform' || state.cargoType === 'platform20') ? 5.5 : 2.4));
                        const loadedW = calibratedWeight(state.cargoType, state.L, state.W, state.H) || 20;
                        const evenW = Math.max(2, Math.round(loadedW / 2) * 2);
                        const evenTare = Math.max(2, Math.round((Number(tare) || 2) / 2) * 2);
                        state.weight = state.oogHasCargo ? evenW : evenTare;
                        const wEl = document.getElementById('inp-Weight');
                        const wv = document.getElementById('v-Weight');
                        if (wEl) wEl.value = state.weight;
                        if (wv) wv.textContent = String(state.weight);
                        if (typeof autoSizeGearForLoad === 'function') {
                            autoSizeGearForLoad(state.weight, { betaWorstDeg: 40 });
                        }
                    }
                    syncOogCargoUI(false);
                    rebuildCargoAndRig(false);
                });
            }
            const btnOogTarp = document.getElementById('btn-oog-tarp');
            if (btnOogTarp) {
                btnOogTarp.addEventListener('click', () => {
                    state.oogTarp = !state.oogTarp;
                    syncOogCargoUI(false);
                    rebuildCargoAndRig(false);
                });
            }
            const applyDeckOogDeltaChange = () => {
                if (typeof resolveDeckOogGeometry === 'function') {
                    const g = resolveDeckOogGeometry(state.L, state.W, state.H);
                    if (typeof applyCombinedOogCoGDefault === 'function') {
                        applyCombinedOogCoGDefault(state.L, state.W, state.H, g);
                    }
                }
                if (typeof syncCoGSlidersFromState === 'function') syncCoGSlidersFromState();
                syncOogCargoUI(false);
                rebuildCargoAndRig(false);
            };

            const bindOogSlider = (id, key) => {
                const el = document.getElementById(`inp-${id}`);
                const vEl = document.getElementById(`v-${id}`);
                if (!el) return;
                el.addEventListener('input', e => {
                    let val = parseFloat(e.target.value);
                    const isOT = state.cargoType === 'opentop' || state.cargoType === 'opentop40';
                    if (isOT && key === 'oogCargoW') val = Math.min(val, Math.max(0.85, state.W - 0.40));
                    if (isOT && key === 'oogCargoL') val = Math.min(val, Math.max(1.2, state.L - 0.40));
                    state[key] = val;
                    if (vEl) vEl.textContent = state[key].toFixed(2);
                    syncOogCargoUI(false);
                    rebuildCargoAndRig(false);
                });
            };
            bindOogSlider('oogH', 'oogCargoH');
            bindOogSlider('oogW', 'oogCargoW');
            bindOogSlider('oogL', 'oogCargoL');

            const fmtOogSigned = (v, digits = 2) => {
                const n = Math.round((Number(v) || 0) * 100) / 100;
                const s = n.toFixed(digits);
                return n > 0 ? `+${s}` : s;
            };
            const clampOogDeltaInput = (key, raw) => {
                const el = document.getElementById(`inp-${key}`);
                const lo = el ? parseFloat(el.min) : -5;
                const hi = el ? parseFloat(el.max) : 6;
                const v = parseFloat(raw);
                if (!Number.isFinite(v)) return 0;
                return THREE.MathUtils.clamp(Math.round(v * 100) / 100, lo, hi);
            };
            const bindOogDeltaSlider = (key) => {
                const el = document.getElementById(`inp-${key}`);
                const vEl = document.getElementById(`v-${key}`);
                const numEl = document.getElementById(`num-${key}`);
                if (!el) return;
                el.addEventListener('input', e => {
                    state[key] = clampOogDeltaInput(key, e.target.value);
                    if (vEl) vEl.textContent = fmtOogSigned(state[key]);
                    if (numEl && document.activeElement !== numEl) numEl.value = state[key].toFixed(2);
                    applyDeckOogDeltaChange();
                });
                if (numEl) {
                    numEl.addEventListener('change', e => {
                        const val = clampOogDeltaInput(key, e.target.value);
                        state[key] = val;
                        el.value = val;
                        if (vEl) vEl.textContent = fmtOogSigned(val);
                        applyDeckOogDeltaChange();
                    });
                }
            };
            ['oogOh', 'oogOwL', 'oogOwR', 'oogOlF', 'oogOlR'].forEach(bindOogDeltaSlider);

            document.querySelectorAll('.btn-step-oog-delta').forEach(btn => {
                btn.addEventListener('click', () => {
                    const key = btn.dataset.key;
                    const delta = parseFloat(btn.dataset.delta || 0);
                    if (!key) return;
                    state[key] = clampOogDeltaInput(key, (state[key] || 0) + delta);
                    applyDeckOogDeltaChange();
                });
            });

            // 6. Individual LP1-LP4 Selector Tabs & Sliders
            document.querySelectorAll('#lp-tabs button').forEach(btn => {
                btn.addEventListener('click', () => selectLPTab(btn.dataset.lp));
            });

            document.getElementById('btn-sym-lugs').addEventListener('click', () => {
                state.legDeltaL = [0, 0, 0, 0];
                selectLPTab('all');
                rebuildCargoAndRig(true);
            });

            const elevBtns = document.querySelectorAll('#lug-elevation-group button');
            elevBtns.forEach(btn => {
                btn.addEventListener('click', () => {
                    elevBtns.forEach(b => b.className = 'px-2 py-0.5 rounded text-[10px] font-bold bg-slate-700 text-slate-300');
                    btn.className = 'px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-600 text-white';
                    state.lugElevPreset = btn.dataset.elev;
                    state.pendingConform = 'preset';
                    rebuildCargoAndRig(false);
                });
            });

            document.getElementById('inp-lpX').addEventListener('input', e => {
                const val = parseFloat(e.target.value);
                document.getElementById('v-lpX').textContent = val.toFixed(2);
                if (state.selectedLP === 'all') {
                    const d = Math.abs(val);
                    state.lugs[0].x = d; state.lugs[1].x = -d; state.lugs[2].x = -d; state.lugs[3].x = d;
                } else {
                    state.lugs[parseInt(state.selectedLP, 10)].x = val;
                }
                rebuildCargoAndRig(false);
            });

            document.getElementById('inp-lpZ').addEventListener('input', e => {
                const val = parseFloat(e.target.value);
                document.getElementById('v-lpZ').textContent = val.toFixed(2);
                if (state.selectedLP === 'all') {
                    const d = Math.abs(val);
                    state.lugs[0].z = d; state.lugs[1].z = d; state.lugs[2].z = -d; state.lugs[3].z = -d;
                } else {
                    state.lugs[parseInt(state.selectedLP, 10)].z = val;
                }
                rebuildCargoAndRig(false);
            });

            document.getElementById('inp-lpY').addEventListener('input', e => {
                const val = parseFloat(e.target.value);
                document.getElementById('v-lpY').textContent = val.toFixed(2);
                if (state.selectedLP === 'all') {
                    state.lugs.forEach(p => { p.y = val; });
                } else {
                    state.lugs[parseInt(state.selectedLP, 10)].y = val;
                }
                rebuildCargoAndRig(false);
            });

            document.getElementById('inp-lpDeltaL').addEventListener('input', e => {
                const val = parseFloat(e.target.value);
                document.getElementById('v-lpDeltaL').textContent = (val >= 0 ? '+' : '') + val.toFixed(2);
                if (state.selectedLP === 'all') {
                    state.legDeltaL = [val, val, val, val];
                } else {
                    state.legDeltaL[parseInt(state.selectedLP, 10)] = val;
                }
            });

            // 7. Interactive 2D Map Click/Drag to place CoG
            const mapCanvas = document.getElementById('cog-map-canvas');
            let isDraggingMap = false;
            const updateCoGFromMap = ev => {
                const rect = mapCanvas.getBoundingClientRect();
                const mx = ev.clientX - rect.left;
                const mz = ev.clientY - rect.top;
                const sc = Math.min((mapCanvas.width - 20) / state.L, (mapCanvas.height - 18) / state.W);
                state.cogX = THREE.MathUtils.clamp((mx - mapCanvas.width / 2) / sc, -state.L * 0.45, state.L * 0.45);
                state.cogZ = THREE.MathUtils.clamp((mz - mapCanvas.height / 2) / sc, -state.W * 0.45, state.W * 0.45);
                syncCoGSlidersFromState();
                rebuildCargoAndRig(false);
            };
            mapCanvas.addEventListener('pointerdown', ev => { isDraggingMap = true; updateCoGFromMap(ev); });
            window.addEventListener('pointermove', ev => { if (isDraggingMap) updateCoGFromMap(ev); });
            window.addEventListener('pointerup', () => { isDraggingMap = false; });

            // 8. Dimensions & CoG Sliders and Stepper/Preset Inputs
            const bindSlider = (id, key, dec, resetSymLugs = false) => {
                const el = document.getElementById(`inp-${id}`);
                const vEl = document.getElementById(`v-${id}`);
                const numEl = document.getElementById(`num-${id}`);
                if (el) {
                    el.addEventListener('input', e => {
                        const val = parseFloat(e.target.value);
                        // ISO containers: L/W/H snap to world-standard sizes (ISO 668 / 1496 family)
                        if ((key === 'L' || key === 'W' || key === 'H')
                            && typeof cargoIsoFamily === 'function' && cargoIsoFamily()
                            && typeof isoSiblingPresets === 'function'
                            && typeof applyIsoCargoPresetFromEditor === 'function') {
                            const siblings = isoSiblingPresets(state.cargoType);
                            if (siblings.length) {
                                let best = siblings[0];
                                let bestScore = Infinity;
                                siblings.forEach(p => {
                                    const dL = Math.abs(p.L - (key === 'L' ? val : state.L));
                                    const dW = Math.abs(p.W - (key === 'W' ? val : state.W));
                                    const dH = Math.abs(p.H - (key === 'H' ? val : state.H));
                                    const score = key === 'L' ? (dL * 12 + dH)
                                        : key === 'H' ? (dH * 12 + dL)
                                            : (dW * 12 + dL);
                                    if (score < bestScore) { bestScore = score; best = p; }
                                });
                                if (best && best.id) {
                                    applyIsoCargoPresetFromEditor(best.id);
                                    return;
                                }
                            }
                        }
                        state[key] = val;
                        if (key === 'slingLength') {
                            state.slingUserSet = true;
                            if (state.heldCableL0) state.heldCableL0.upper = [];
                        }
                        if (key === 'weight') {
                            state.weightUserSet = true;
                            state.weight = Math.max(2, Math.round(val / 2) * 2);
                            if (el) el.value = state.weight;
                            if (vEl) vEl.textContent = String(state.weight);
                            if (numEl && document.activeElement !== numEl) numEl.value = String(state.weight);
                            if (typeof autoSizeGearForLoad === 'function') {
                                autoSizeGearForLoad(state.weight, { betaWorstDeg: 40 });
                            }
                        }
                        if ((key === 'L' || key === 'W' || key === 'H') && !state.weightUserSet) {
                            const w = calibratedWeight(state.cargoType, state.L, state.W, state.H);
                            if (w) {
                                state.weight = Math.max(2, Math.round(w / 2) * 2);
                                const wEl = document.getElementById('inp-Weight');
                                const wv = document.getElementById('v-Weight');
                                const wn = document.getElementById('num-Weight');
                                if (wEl) wEl.value = state.weight;
                                if (wv) wv.textContent = String(state.weight);
                                if (wn) wn.value = String(state.weight);
                                if (typeof autoSizeGearForLoad === 'function') {
                                    autoSizeGearForLoad(state.weight, { betaWorstDeg: 40 });
                                }
                            }
                        }
                        if ((key === 'L' || key === 'W' || key === 'H')
                            && (state.cargoType === 'flatrack' || state.cargoType === 'flatrack20'
                                || state.cargoType === 'platform' || state.cargoType === 'platform20')
                            && state.oogHasCargo !== false
                            && typeof applyCombinedOogCoGDefault === 'function') {
                            applyCombinedOogCoGDefault(state.L, state.W, state.H);
                            if (typeof syncCoGSlidersFromState === 'function') syncCoGSlidersFromState();
                            if (typeof syncOogCargoUI === 'function') syncOogCargoUI(false);
                        }
                        if (key !== 'weight') {
                            if (vEl) vEl.textContent = val.toFixed(dec);
                            if (numEl && document.activeElement !== numEl) numEl.value = val.toFixed(dec);
                        }
                        rebuildCargoAndRig(resetSymLugs);
                    });
                }
                if (numEl) {
                    numEl.addEventListener('change', e => {
                        let val = parseFloat(e.target.value);
                        if (isNaN(val) || val <= 0) return;
                        if (key === 'weight') {
                            state.weightUserSet = true;
                            val = Math.max(2, Math.round(val / 2) * 2);
                            if (typeof autoSizeGearForLoad === 'function') {
                                autoSizeGearForLoad(val, { betaWorstDeg: 40 });
                            }
                        }
                        state[key] = val;
                        if (el) el.value = val;
                        if (vEl) vEl.textContent = key === 'weight' ? String(val) : val.toFixed(dec);
                        if (numEl) numEl.value = key === 'weight' ? String(val) : val.toFixed(dec);
                        rebuildCargoAndRig(resetSymLugs);
                    });
                }
            };
            bindSlider('L', 'L', 2, true);
            bindSlider('W', 'W', 2, true);
            bindSlider('H', 'H', 2, true);
            bindSlider('Weight', 'weight', 0, false);
            bindSlider('cogX', 'cogX', 2, false);
            bindSlider('cogZ', 'cogZ', 2, false);
            bindSlider('cogY', 'cogY', 2, false);

            const snapMainDimToIso = (key, rawVal) => {
                if (!(key === 'L' || key === 'W' || key === 'H')) return false;
                if (typeof cargoIsoFamily !== 'function' || !cargoIsoFamily()) return false;
                if (typeof isoSiblingPresets !== 'function' || typeof applyIsoCargoPresetFromEditor !== 'function') return false;
                const siblings = isoSiblingPresets(state.cargoType);
                if (!siblings.length) return false;
                let best = siblings[0];
                let bestScore = Infinity;
                siblings.forEach(p => {
                    const dL = Math.abs(p.L - (key === 'L' ? rawVal : state.L));
                    const dW = Math.abs(p.W - (key === 'W' ? rawVal : state.W));
                    const dH = Math.abs(p.H - (key === 'H' ? rawVal : state.H));
                    const score = key === 'L' ? (dL * 12 + dH)
                        : key === 'H' ? (dH * 12 + dL)
                            : (dW * 12 + dL);
                    if (score < bestScore) { bestScore = score; best = p; }
                });
                if (best && best.id) {
                    applyIsoCargoPresetFromEditor(best.id);
                    return true;
                }
                return false;
            };

            // Stepper and Preset Buttons for Cargo Dimensions & Weight
            document.querySelectorAll('.btn-step-cargo').forEach(btn => {
                btn.addEventListener('click', () => {
                    const target = btn.dataset.target;
                    const delta = parseFloat(btn.dataset.delta || 0);
                    const cur = state[target] || 0;
                    let next = Math.max(0.2, +(cur + delta).toFixed(2));
                    if (target === 'weight') {
                        state.weightUserSet = true;
                        next = Math.max(2, Math.round(next / 2) * 2);
                    }
                    if (snapMainDimToIso(target, next)) return;
                    state[target] = next;
                    const numEl = document.getElementById(`num-${target === 'weight' ? 'Weight' : target}`);
                    const inpEl = document.getElementById(`inp-${target === 'weight' ? 'Weight' : target}`);
                    const vEl = document.getElementById(`v-${target === 'weight' ? 'Weight' : target}`);
                    if (numEl) numEl.value = target === 'weight' ? String(next) : next.toFixed(2);
                    if (inpEl) inpEl.value = next;
                    if (vEl) vEl.textContent = target === 'weight' ? String(next) : next.toFixed(2);
                    if (target === 'weight' && typeof autoSizeGearForLoad === 'function') {
                        autoSizeGearForLoad(next, { betaWorstDeg: 40 });
                    }
                    rebuildCargoAndRig(target === 'L' || target === 'W' || target === 'H');
                });
            });

            document.querySelectorAll('.btn-preset-cargo').forEach(btn => {
                btn.addEventListener('click', () => {
                    const target = btn.dataset.target;
                    let val = parseFloat(btn.dataset.val);
                    if (isNaN(val)) return;
                    if (target === 'weight') {
                        state.weightUserSet = true;
                        val = Math.max(2, Math.round(val / 2) * 2);
                    }
                    if (snapMainDimToIso(target, val)) return;
                    state[target] = val;
                    const numEl = document.getElementById(`num-${target === 'weight' ? 'Weight' : target}`);
                    const inpEl = document.getElementById(`inp-${target === 'weight' ? 'Weight' : target}`);
                    const vEl = document.getElementById(`v-${target === 'weight' ? 'Weight' : target}`);
                    if (numEl) numEl.value = target === 'weight' ? String(val) : val.toFixed(2);
                    if (inpEl) inpEl.value = val;
                    if (vEl) vEl.textContent = target === 'weight' ? String(val) : val.toFixed(2);
                    if (target === 'weight' && typeof autoSizeGearForLoad === 'function') {
                        autoSizeGearForLoad(val, { betaWorstDeg: 40 });
                    }
                    rebuildCargoAndRig(target === 'L' || target === 'W' || target === 'H');
                });
            });

            // OOG Steppers and Inputs
            const bindOogField = (id, key) => {
                const numEl = document.getElementById(`num-${id}`);
                const inpEl = document.getElementById(`inp-${id}`);
                const vEl = document.getElementById(`v-${id}`);
                if (numEl) {
                    numEl.addEventListener('change', e => {
                        const val = parseFloat(e.target.value);
                        if (isNaN(val) || val <= 0) return;
                        state[key] = val;
                        if (inpEl) inpEl.value = val;
                        if (vEl) vEl.textContent = val.toFixed(2);
                        rebuildCargoAndRig(false);
                    });
                }
            };
            bindOogField('oogH', 'oogCargoH');
            bindOogField('oogW', 'oogCargoW');
            bindOogField('oogL', 'oogCargoL');

            document.querySelectorAll('.btn-step-oog').forEach(btn => {
                btn.addEventListener('click', () => {
                    const target = btn.dataset.target;
                    const delta = parseFloat(btn.dataset.delta || 0);
                    const stateKey = target === 'oogH' ? 'oogCargoH' : (target === 'oogW' ? 'oogCargoW' : 'oogCargoL');
                    const cur = state[stateKey] || 0;
                    let next = Math.max(0.5, +(cur + delta).toFixed(2));
                    const isOT = state.cargoType === 'opentop' || state.cargoType === 'opentop40';
                    if (isOT && stateKey === 'oogCargoW') next = Math.min(next, Math.max(0.85, state.W - 0.40));
                    if (isOT && stateKey === 'oogCargoL') next = Math.min(next, Math.max(1.2, state.L - 0.40));
                    state[stateKey] = next;
                    const numEl = document.getElementById(`num-${target}`);
                    const inpEl = document.getElementById(`inp-${target}`);
                    const vEl = document.getElementById(`v-${target}`);
                    if (numEl) numEl.value = next.toFixed(2);
                    if (inpEl) inpEl.value = next;
                    if (vEl) vEl.textContent = next.toFixed(2);
                    rebuildCargoAndRig(false);
                });
            });

            // Detailed Sling Length Controls (Upper & Lower Tiers, Selected Cable, Metric/Imperial)
            initSlingControls();
            syncSlingSlidersFromState();

            document.getElementById('btn-reset-cog').addEventListener('click', () => {
                const isDeckOog = state.cargoType === 'flatrack' || state.cargoType === 'flatrack20'
                    || state.cargoType === 'platform' || state.cargoType === 'platform20';
                if (isDeckOog && state.oogHasCargo !== false && typeof applyCombinedOogCoGDefault === 'function') {
                    applyCombinedOogCoGDefault(state.L, state.W, state.H);
                } else {
                    state.cogX = 0; state.cogY = 0; state.cogZ = 0;
                }
                state.legDeltaL = [0, 0, 0, 0];
                syncCoGSlidersFromState();
                rebuildCargoAndRig(false);
            });

            // 9. Beam, Sling & Hardware Store Cards
            const beamCards = document.querySelectorAll('#beam-store .card-btn');
            beamCards.forEach(card => {
                card.addEventListener('click', () => {
                    const nextType = card.dataset.beam;
                    if (!nextType || nextType === state.beamType) {
                        // Re-click same card: still force UI highlight sync
                        beamCards.forEach(c => c.classList.toggle('active', c.dataset.beam === nextType));
                        return;
                    }
                    beamCards.forEach(c => c.classList.remove('active'));
                    card.classList.add('active');

                    // Drop asymmetric L0 / Nhớm locks from the previous topology
                    if (typeof clearSlingLengthOverridesForBeamChange === 'function') {
                        clearSlingLengthOverridesForBeamChange();
                    } else {
                        state.slingUserSet = false;
                        state.upperSlingLength = null;
                        state.lowerSlingLength = null;
                        state.holdCableLength = false;
                        state.heldCableL0 = null;
                        state.legDeltaL = [0, 0, 0, 0, 0, 0, 0, 0];
                    }

                    // Leaving STS restores free hook swivel & design bridle lengths
                    if (state.beamType === 'container_spreader' && nextType !== 'container_spreader') {
                        state.hookSwivelEnabled = true;
                        state.customBeamLengthMode = false;
                    }

                    state.beamType = nextType;

                    if (state.beamType === 'container_spreader') {
                        state.slingType = 'wire';
                        applyStsSpreaderSize(state.stsTwinLift ? 'twin' : (state.stsSizeFt || 40));
                        document.querySelectorAll('#beam-store .card-btn').forEach(c => {
                            c.classList.toggle('active', c.dataset.beam === 'container_spreader');
                        });
                        if (typeof autoSizeGearForLoad === 'function') {
                            autoSizeGearForLoad(state.weight, { betaWorstDeg: 40 });
                        }
                        return;
                    }

                    if (typeof updateStsBeamDimUI === 'function') updateStsBeamDimUI();
                    if (typeof autoSizeGearForLoad === 'function') {
                        autoSizeGearForLoad(state.weight, { betaWorstDeg: 40 });
                    }
                    // Prefer default β=50° lengths for the new topology (even metres)
                    if (typeof applyPullAnglePreset === 'function') applyPullAnglePreset(50);

                    rebuildSpreaderVisuals();
                    // Always re-seat level — inheriting a mid-air tilt into a new cable graph
                    // is what made cascaded / frame / basket look “broken” vs modular.
                    if (typeof resetToInitialPreLiftState === 'function') {
                        resetToInitialPreLiftState();
                    } else if (typeof syncHookToRigTaut === 'function') {
                        syncHookToRigTaut();
                    }
                    syncSlingSlidersFromState();
                    if (typeof updateRiggingBOMUI === 'function') updateRiggingBOMUI();
                    document.querySelectorAll('#beam-store .card-btn').forEach(c => {
                        c.classList.toggle('active', c.dataset.beam === state.beamType);
                    });
                });
            });

            const slingCards = document.querySelectorAll('#sling-store .card-btn');
            slingCards.forEach(card => {
                card.addEventListener('click', () => {
                    slingCards.forEach(c => c.classList.remove('active'));
                    card.classList.add('active');
                    const selectedType = card.dataset.sling;
                    state.slingType = selectedType;

                    // Automatically sync elastic material type & DNV-ST-N001 selector
                    if (selectedType === 'wire' || selectedType === 'grommet') {
                        state.slingMaterialType = 'wire';
                    } else if (selectedType === 'chain') {
                        state.slingMaterialType = 'chain';
                    } else if (selectedType === 'web' || selectedType === 'round_sling') {
                        state.slingMaterialType = 'poly';
                    }
                    const selMat = document.getElementById('sel-sling-material');
                    if (selMat) selMat.value = state.slingMaterialType;

                    // Re-size WLL/MBL/dia for new material SF (wire/chain SF5, web/round SF7)
                    if (typeof autoSizeGearForLoad === 'function') {
                        autoSizeGearForLoad(state.weight, { betaWorstDeg: 40 });
                    }
                    const getSpec = (typeof CAE !== 'undefined' && CAE.getSlingPhysicalSpec)
                        || (typeof window !== 'undefined' && window.CAE && window.CAE.getSlingPhysicalSpec);
                    const spec = getSpec ? getSpec(selectedType, state.wllPerLeg || 16) : null;
                    if (spec) {
                        state.slingDiaMm = (typeof evenMm === 'function')
                            ? evenMm(spec.diaMm)
                            : spec.diaMm;
                    }

                    if (state.gear) {
                        (state.gear.uppers || []).forEach(u => {
                            u.slingType = selectedType;
                            if (spec) u.diaMm = state.slingDiaMm || spec.diaMm;
                            u.grade = (selectedType === 'chain') ? 'g80' : ((selectedType === 'web' || selectedType === 'round_sling') ? 'poly' : 'iwrc');
                        });
                        (state.gear.legs || []).forEach(l => {
                            l.slingType = selectedType;
                            if (spec) l.diaMm = state.slingDiaMm || spec.diaMm;
                            l.grade = (selectedType === 'chain') ? 'g80' : ((selectedType === 'web' || selectedType === 'round_sling') ? 'poly' : 'iwrc');
                        });
                    }

                    computeRiggingMassBreakdown();
                    syncSlingSlidersFromState();
                    updateRiggingBOMUI();
                    rebuildCargoAndRig(false);
                    rebuildSpreaderVisuals();
                });
            });

            const hwCards = document.querySelectorAll('#hw-store .card-btn');
            hwCards.forEach(card => {
                card.addEventListener('click', () => {
                    hwCards.forEach(c => c.classList.remove('active'));
                    card.classList.add('active');
                    state.hwType = card.dataset.hw;
                    rebuildCargoAndRig(false);
                });
            });

            // 10. Crane Hoist & Pendant Buttons (Direct Click Steppers, Presets, Number Inputs & Slew)
            const numHookY = document.getElementById('num-hook-y');
            const inpHookY = document.getElementById('inp-hook-y');
            const valHookY = document.getElementById('val-hook-y');

            const setHookHeight = (targetY) => {
                // Hook ceiling leaves headroom so cargo AGL can reach the 50 m hard stop.
                const clampedY = THREE.MathUtils.clamp(targetY, 0.5, 56.0);
                if (state.poseLock && clampedY > (phy.hookPos ? phy.hookPos.y : 0) + 0.04) {
                    state.poseLock = false;
                    syncPoseLockUI();
                }
                // Center hook over CoG if lifting from ground so cables tension evenly
                if (phy.groundClearance < 0.08 && clampedY > (phy.hookPos ? phy.hookPos.y : 0) + 0.05) {
                    const rotatedCoG = new THREE.Vector3(state.cogX, 0, state.cogZ).applyAxisAngle(new THREE.Vector3(0, 1, 0), THREE.MathUtils.degToRad(state.cargoYawDeg));
                    const azRad = THREE.MathUtils.degToRad(state.pullAzimuthDeg || 0);
                    const pullOffX = (state.pullRadius || 0) * Math.cos(azRad);
                    const pullOffZ = (state.pullRadius || 0) * Math.sin(azRad);
                    phy.hookTarget.x = rotatedCoG.x + pullOffX;
                    phy.hookTarget.z = rotatedCoG.z + pullOffZ;
                }
                phy.hookTarget.y = clampedY;
                // Physical smooth winch transition — never teleport phy.hookPos.y directly
                phy.autoHoistActive = true;
                if (numHookY && document.activeElement !== numHookY) numHookY.value = clampedY.toFixed(1);
                if (inpHookY) inpHookY.value = clampedY.toFixed(2);
                if (valHookY) valHookY.textContent = clampedY.toFixed(1) + 'm';
            };

            if (numHookY) {
                numHookY.addEventListener('change', e => {
                    const y = parseFloat(e.target.value);
                    if (!isNaN(y)) setHookHeight(y);
                });
            }

            document.querySelectorAll('.btn-step-hoist').forEach(btn => {
                btn.addEventListener('click', () => {
                    const delta = parseFloat(btn.dataset.delta || 0);
                    const curY = phy.hookTarget ? phy.hookTarget.y : (phy.hookPos ? phy.hookPos.y : 10.1);
                    setHookHeight(+(curY + delta).toFixed(2));
                });
            });

            document.querySelectorAll('.btn-hoist-preset').forEach(btn => {
                btn.addEventListener('click', () => {
                    const h = parseFloat(btn.dataset.height || 10.1);
                    if (!isNaN(h)) setHookHeight(h);
                });
            });

            document.querySelectorAll('.btn-slew-step').forEach(btn => {
                btn.addEventListener('click', () => {
                    const slewVal = parseFloat(btn.dataset.slew || 0);
                    state.slewDeg = ((state.slewDeg || 0) + slewVal) % 360;
                    if (state.slewDeg > 180) state.slewDeg -= 360;
                    if (state.slewDeg < -180) state.slewDeg += 360;
                    const valSlew = document.getElementById('val-slew');
                    if (valSlew) valSlew.textContent = Math.round(state.slewDeg) + '°';
                });
            });

            if (inpHookY) {
                inpHookY.addEventListener('input', e => {
                    if (phy.suppressHookInput) return;
                    const nextY = parseFloat(e.target.value);
                    if (phy.autoHoistActive && Math.abs(nextY - phy.hookPos.y) < 0.08) return;
                    if (state.poseLock && nextY > phy.hookPos.y + 0.04) {
                        state.poseLock = false;
                        syncPoseLockUI();
                    }
                    if (phy.groundClearance < 0.05 && nextY > (phy.hookPos ? phy.hookPos.y : 0) + 0.05) {
                        const rotatedCoG = new THREE.Vector3(state.cogX, 0, state.cogZ).applyAxisAngle(new THREE.Vector3(0, 1, 0), THREE.MathUtils.degToRad(state.cargoYawDeg));
                        const azRad = THREE.MathUtils.degToRad(state.pullAzimuthDeg || 0);
                        const pullOffX = (state.pullRadius || 0) * Math.cos(azRad);
                        const pullOffZ = (state.pullRadius || 0) * Math.sin(azRad);
                        phy.hookTarget.x = rotatedCoG.x + pullOffX;
                        phy.hookTarget.z = rotatedCoG.z + pullOffZ;
                    }
                    phy.hookTarget.y = nextY;
                    phy.autoHoistActive = true;
                    if (valHookY) valHookY.textContent = phy.hookTarget.y.toFixed(1) + 'm';
                    if (numHookY && document.activeElement !== numHookY) numHookY.value = phy.hookTarget.y.toFixed(1);
                });
            }

            const btnUp = document.getElementById('btn-hoist-up');
            const btnDown = document.getElementById('btn-hoist-down');
            let hoistHoldArmed = false;
            const stopHoistHold = (e) => {
                // Only act on a real Kéo/Hạ release — ignore stray pointerleave while
                // Nhấc thử / Hạ đất are driving autoHoist.
                if (!hoistHoldArmed) return;
                hoistHoldArmed = false;
                if (e && e.pointerId != null) {
                    try {
                        if (btnUp && btnUp.hasPointerCapture?.(e.pointerId)) btnUp.releasePointerCapture(e.pointerId);
                        if (btnDown && btnDown.hasPointerCapture?.(e.pointerId)) btnDown.releasePointerCapture(e.pointerId);
                    } catch (_) { /* ignore */ }
                }
                // Hạ đất keeps paying out after the click — do not freeze it on pendant leave.
                if (phy._setDownActive) {
                    phy.hoistSpeed = (typeof hoistHoldSpeed === 'function')
                        ? hoistHoldSpeed(-1)
                        : phy.hoistSpeed;
                    return;
                }
                if (phy._trialLiftActive) {
                    phy.hoistSpeed = 0;
                    return;
                }
                // Hold position — do NOT unload / drop a suspended load.
                freezeSuspendedHoist();
            };
            btnUp.addEventListener('pointerdown', e => {
                e.preventDefault();
                try { btnUp.setPointerCapture(e.pointerId); } catch (_) { /* ignore */ }
                hoistHoldArmed = true;
                phy._setDownActive = false;
                phy._trialLiftActive = false;
                phy._nhomFreezeSpreader = false;
                // Keep Nhớm snug L0 into the lift, but immediately relieve any pin span
                // that already exceeds L0 (otherwise the first winch frame snaps Zone-3).
                if (typeof relieveCableOverstretch === 'function') {
                    relieveCableOverstretch({ rising: true, margin: 0.02 });
                }
                if (state.holdCableLength && state.heldCableL0 && typeof attachWorld === 'function') {
                    let payoutOnly = true;
                    (phy.cables || []).forEach(c => {
                        if (typeof cableIsBroken === 'function' && cableIsBroken(c)) return;
                        const held = state.heldCableL0[c.role] && state.heldCableL0[c.role][c.index];
                        if (held == null) return;
                        const span = attachWorld(c.a).distanceTo(attachWorld(c.b));
                        if (held <= span + 0.06) payoutOnly = false;
                    });
                    if (payoutOnly) {
                        state.holdCableLength = false;
                        state.heldCableL0 = null;
                    }
                }
                // Reset jittery slack rope sims so chains don't "fly" into the lift
                if (typeof sling3DPool !== 'undefined' && Array.isArray(sling3DPool)) {
                    sling3DPool.forEach(s => { if (s) s.ropeSim = null; });
                }
                if (state.poseLock) {
                    state.poseLock = false;
                    syncPoseLockUI();
                }
                // STS direct: seat flush first, then snug pin L0 so the lift is twistlock-locked (no ghost gap).
                // STS cable: H-beam seat (high hook + lower stand-off) before take-up.
                if (typeof isStsDirectAttach === 'function' && isStsDirectAttach()) {
                    state.lowerSlingLength = 0.06;
                    if (typeof seatStsSpreaderToCargo === 'function') seatStsSpreaderToCargo();
                    if (typeof attachWorld === 'function') {
                        (phy.cables || []).forEach(c => {
                            if (c.role !== 'leg') return;
                            const span = attachWorld(c.a).distanceTo(attachWorld(c.b));
                            c.L0 = Math.max(0.04, Math.min(0.12, span + 0.002));
                            c.designL0 = c.L0;
                            c.slack = false;
                        });
                    }
                    if (state.gear && state.gear.legs) {
                        state.gear.legs.forEach(leg => {
                            if (!leg) return;
                            leg.lengthM = null;
                            leg.userSet = false;
                        });
                    }
                    phy._stsPinsSnug = true;
                } else if (state.beamType === 'container_spreader'
                    && (state.stsAttachMode || 'direct') === 'cable'
                    && (phy.groundClearance || 0) < 0.12
                    && typeof seatStsSpreaderToCargo === 'function') {
                    seatStsSpreaderToCargo();
                }
                if (phy.groundClearance < 0.08) {
                    const rotatedCoG = new THREE.Vector3(state.cogX, 0, state.cogZ).applyAxisAngle(new THREE.Vector3(0, 1, 0), THREE.MathUtils.degToRad(state.cargoYawDeg));
                    const azRad = THREE.MathUtils.degToRad(state.pullAzimuthDeg || 0);
                    const pullOffX = (state.pullRadius || 0) * Math.cos(azRad);
                    const pullOffZ = (state.pullRadius || 0) * Math.sin(azRad);
                    phy.hookTarget.x = rotatedCoG.x + pullOffX;
                    phy.hookTarget.z = rotatedCoG.z + pullOffZ;
                } else {
                    phy.hookTarget.x = phy.hookPos.x;
                    phy.hookTarget.z = phy.hookPos.z;
                }
                phy.hookTarget.y = phy.hookPos.y;
                phy.autoHoistActive = false;
                phy.hoistSpeed = (typeof hoistHoldSpeed === 'function')
                    ? hoistHoldSpeed(1)
                    : 0.22 * (typeof hoistSpeedScaleFactor === 'function' ? hoistSpeedScaleFactor() : (state.hoistSpeedScale || 1));
            });
            btnUp.addEventListener('pointerup', stopHoistHold);
            btnUp.addEventListener('pointercancel', stopHoistHold);
            // pointerleave only if capture failed (desktop mouse slip off button)
            btnUp.addEventListener('pointerleave', (e) => {
                if (hoistHoldArmed && !(btnUp.hasPointerCapture && btnUp.hasPointerCapture(e.pointerId))) {
                    stopHoistHold(e);
                }
            });
            btnDown.addEventListener('pointerdown', e => {
                e.preventDefault();
                try { btnDown.setPointerCapture(e.pointerId); } catch (_) { /* ignore */ }
                hoistHoldArmed = true;
                phy._trialLiftActive = false;
                phy._nhomFreezeSpreader = false;
                // Operator Hạ cancels an in-progress Hạ đất auto sequence
                phy._setDownActive = false;
                const clearance = Math.max(
                    phy.groundClearance || 0,
                    (typeof cargoAabbClearance === 'function') ? cargoAabbClearance() : 0
                );
                // Cargo on quay: keep the load seated, but still pay out the hook /
                // spreader until they rest on the cargo roof (all solids are 3D).
                const wasGrounded = clearance < 0.05;
                if (wasGrounded) {
                    if (phy.cargoVel) phy.cargoVel.set(0, 0, 0);
                    if (phy.cargoOmega) phy.cargoOmega.set(0, 0, 0);
                    if (Array.isArray(phy.beams)) {
                        phy.beams.forEach(b => {
                            if (b.v) b.v.set(0, 0, 0);
                            if (b.w) b.w.set(0, 0, 0);
                        });
                    }
                    phy._nhomFreezeSpreader = false;
                    state.holdCableLength = false;
                    state.heldCableL0 = null;
                    state.poseLock = true;
                    phy.groundClearance = 0;
                    if (typeof applyLockedPose === 'function') applyLockedPose();
                    if (typeof syncPoseLockUI === 'function') syncPoseLockUI();
                    phy.autoHoistActive = false;
                    phy.hookTarget.x = phy.hookPos.x;
                    phy.hookTarget.z = phy.hookPos.z;
                    phy.hookTarget.y = phy.hookPos.y;
                    phy.hoistSpeed = (typeof hoistHoldSpeed === 'function')
                        ? hoistHoldSpeed(-1)
                        : -0.22 * (typeof hoistSpeedScaleFactor === 'function' ? hoistSpeedScaleFactor() : (state.hoistSpeedScale || 1));
                    const st = document.getElementById('sim-status-text');
                    if (st) {
                        st.textContent = (typeof L === 'function')
                            ? L('Lowering hook/spreader onto the cargo roof — load stays on the quay.',
                                'Hạ móc/ngáng xuống nóc kiện — kiện vẫn sát đất.')
                            : 'Hạ móc/ngáng xuống nóc kiện — kiện vẫn sát đất.';
                    }
                    return;
                }
                if (phy.cargoVel) phy.cargoVel.set(0, 0, 0);
                if (phy.cargoOmega) phy.cargoOmega.set(0, 0, 0);
                if (phy.hookVel) phy.hookVel.set(0, 0, 0);
                if (Array.isArray(phy.beams)) {
                    phy.beams.forEach(b => {
                        if (b.v) b.v.set(0, 0, 0);
                        if (b.w) b.w.set(0, 0, 0);
                    });
                }
                if (state.poseLock) {
                    state.poseLock = false;
                    syncPoseLockUI();
                }
                // Allow payout while lowering from a frozen Nhấc thử hold
                state.holdCableLength = false;
                state.heldCableL0 = null;
                phy._stsPinsSnug = true;
                phy.autoHoistActive = false;
                phy.hookTarget.x = phy.hookPos.x;
                phy.hookTarget.z = phy.hookPos.z;
                phy.hookTarget.y = phy.hookPos.y;
                phy.hoistSpeed = (typeof hoistHoldSpeed === 'function')
                    ? hoistHoldSpeed(-1)
                    : -0.22 * (typeof hoistSpeedScaleFactor === 'function' ? hoistSpeedScaleFactor() : (state.hoistSpeedScale || 1));
            });
            btnDown.addEventListener('pointerup', stopHoistHold);
            btnDown.addEventListener('pointercancel', stopHoistHold);
            btnDown.addEventListener('pointerleave', (e) => {
                if (hoistHoldArmed && !(btnDown.hasPointerCapture && btnDown.hasPointerCapture(e.pointerId))) {
                    stopHoistHold(e);
                }
            });

            const rngHoistSpeed = document.getElementById('rng-hoist-speed');
            const valHoistSpeed = document.getElementById('val-hoist-speed');
            const syncHoistSpeedUI = () => {
                const v = THREE.MathUtils.clamp(state.hoistSpeedScale != null ? state.hoistSpeedScale : 1, 0.25, 2);
                state.hoistSpeedScale = v;
                if (rngHoistSpeed && document.activeElement !== rngHoistSpeed) rngHoistSpeed.value = String(v);
                if (valHoistSpeed) valHoistSpeed.textContent = `${v.toFixed(2)}×`;
            };
            const applyHoistSpeedFromSlider = () => {
                if (!rngHoistSpeed) return;
                const v = THREE.MathUtils.clamp(parseFloat(rngHoistSpeed.value) || 1, 0.25, 2);
                state.hoistSpeedScale = v;
                if (valHoistSpeed) valHoistSpeed.textContent = `${v.toFixed(2)}×`;
                // Live-update held Kéo/Hạ so slider works while the button is down
                if (Math.abs(phy.hoistSpeed || 0) > 0.01 && typeof hoistHoldSpeed === 'function') {
                    phy.hoistSpeed = hoistHoldSpeed(phy.hoistSpeed > 0 ? 1 : -1);
                }
            };
            if (rngHoistSpeed) {
                // Stop dock/pendant from stealing pointer events on the range
                rngHoistSpeed.style.pointerEvents = 'auto';
                rngHoistSpeed.addEventListener('pointerdown', e => e.stopPropagation());
                rngHoistSpeed.addEventListener('click', e => e.stopPropagation());
                rngHoistSpeed.addEventListener('input', applyHoistSpeedFromSlider);
                rngHoistSpeed.addEventListener('change', applyHoistSpeedFromSlider);
                syncHoistSpeedUI();
            }
            window.syncHoistSpeedUI = syncHoistSpeedUI;

            // Unified Simulation Controls
            const handlePretension = () => {
                pretensionRig();
            };
            document.querySelectorAll('#btn-pretension, .btn-action-pretension').forEach(btn => btn.addEventListener('click', handlePretension));

            const handleTestLift = () => {
                const curClearance = Math.max(
                    phy.groundClearance || 0,
                    (typeof cargoAabbClearance === 'function') ? cargoAabbClearance() : 0
                );
                // 1. If trial lift is already active, keep smoothly lifting without interruption or velocity reset
                if (phy._trialLiftActive) {
                    const st = document.getElementById('sim-status-text');
                    if (st) {
                        st.textContent = (typeof L === 'function')
                            ? L('Trial lift in progress — lifting smoothly to 3.0 m above ground...',
                                'Đang tiếp tục nhấc thử — nâng êm đến 3.0 m cách đất...')
                            : 'Đang tiếp tục nhấc thử — nâng êm đến 3.0 m cách đất...';
                    }
                    return;
                }
                // 2. If already suspended at 3.0m or higher, keep steady hover hold
                if (curClearance >= 2.95) {
                    const st = document.getElementById('sim-status-text');
                    if (st) {
                        st.textContent = (typeof L === 'function')
                            ? L('Cargo is already at 3.0 m trial height and stably suspended.',
                                'Kiện hàng đã cách đất 3.0 m và đang giữ treo ổn định.')
                            : 'Kiện hàng đã cách đất 3.0 m và đang giữ treo ổn định.';
                    }
                    return;
                }
                // 3. Cancel any set-down in progress
                phy._setDownActive = false;
                phy._nhomFreezeSpreader = false;

                // 4. If cargo was on ground, seat spreader once and release poseLock.
                // Cable STS: re-seat H-beam-style (high hook + lower stand-off) so the
                // yellow frame cannot free-fall into the box on the first Kéo frames.
                if (state.poseLock || curClearance < 0.05) {
                    if (state.beamType === 'container_spreader'
                        && typeof seatStsSpreaderToCargo === 'function') {
                        seatStsSpreaderToCargo();
                    }
                    state.poseLock = false;
                    syncPoseLockUI();
                }

                // 5. Soft-release length hold: keep snug L0 but relieve any overstretch
                // so the first winch frames cannot Zone-3 snap after Nhớm.
                if (typeof relieveCableOverstretch === 'function') {
                    relieveCableOverstretch({ rising: true, margin: 0.025 });
                }
                state.holdCableLength = false;
                state.heldCableL0 = null;
                // Drop per-cable Nhớm userSet locks — otherwise L0 stays glued to the
                // seated span and the first centimetre of hoist overstretches to MBL.
                if (state.gear) {
                    const unlock = (rec) => {
                        if (!rec || !rec.userSet) return;
                        rec.userSet = false;
                        rec.lengthM = null;
                    };
                    (state.gear.uppers || []).forEach(unlock);
                    (state.gear.legs || []).forEach(unlock);
                    (state.gear.hangers || []).forEach(unlock);
                }
                if (typeof sling3DPool !== 'undefined' && Array.isArray(sling3DPool)) {
                    sling3DPool.forEach(s => { if (s) s.ropeSim = null; });
                }
                phy._stsPinsSnug = true;
                phy.hoistSpeed = 0;
                phy._trialLiftActive = true;
                phy.autoHoistActive = true;

                // Prime initial hookTarget towards 3.0m clearance
                autoPositionHookForLift(3.0);

                const st = document.getElementById('sim-status-text');
                if (st) {
                    st.textContent = (typeof L === 'function')
                        ? L('Trial lift — raising cargo smoothly to 3.0 m above ground, then hold.',
                            'Nhấc thử — nâng kiện êm ái đến 3.0 m cách đất rồi giữ treo.')
                        : 'Nhấc thử — nâng kiện êm ái đến 3.0 m cách đất rồi giữ treo.';
                }
            };
            document.querySelectorAll('#btn-test-lift, .btn-action-test-lift').forEach(btn => btn.addEventListener('click', handleTestLift));

            const handleSwingTest = () => {
                if (phy.groundClearance < 0.15) autoPositionHookForLift(0.85);
                const massScale = THREE.MathUtils.clamp(Math.sqrt(16 / Math.max(4, state.weight)), 0.45, 1.15);
                phy.cargoVel.x += 0.38 * massScale;
                phy.cargoVel.z += 0.24 * massScale;
                phy.cargoOmega.y += 0.08 * massScale;
                document.getElementById('sim-status-text').textContent = '💨 Đang thử đung đưa...';
            };
            document.querySelectorAll('#btn-swing-test, .btn-action-swing-test').forEach(btn => btn.addEventListener('click', handleSwingTest));

            // Auto-level turnbuckles
            const handleAutoLevel = () => {
                autoLevelTurnbuckles();
            };
            document.querySelectorAll('#btn-auto-level, .btn-action-auto-level').forEach(btn => btn.addEventListener('click', handleAutoLevel));

            // Reset Initial / Set Down — gradual lower until cargo touches quay
            const handleResetInitial = () => {
                beginSmoothSetDown();
            };
            document.querySelectorAll('#btn-reset-initial, .btn-action-reset-initial').forEach(btn => btn.addEventListener('click', handleResetInitial));

            // Hard Reset / Reset to Baseline
            const handleResetAll = () => {
                if (state.userBaselineState) {
                    resetToUserInitialBaselineState();
                } else {
                    resetToInitialPreLiftState();
                }
            };
            document.querySelectorAll('#btn-hard-reset, #btn-reset-all, .btn-action-reset-all').forEach(btn => btn.addEventListener('click', handleResetAll));

            // Set Baseline
            const handleSetBaseline = () => {
                saveUserInitialBaselineState();
            };
            document.querySelectorAll('#btn-set-baseline, #hdr-btn-set-baseline, .btn-action-set-baseline').forEach(btn => btn.addEventListener('click', handleSetBaseline));

            const holdBtn = (id, onDown, onUp) => {
                const el = document.getElementById(id);
                el.addEventListener('pointerdown', e => { e.preventDefault(); onDown(); });
                el.addEventListener('pointerup', onUp);
                el.addEventListener('pointerleave', onUp);
            };
            holdBtn('btn-slew-left', () => { phy.slewRate = -32; }, () => { if (phy.slewRate < 0) phy.slewRate = 0; });
            holdBtn('btn-slew-right', () => { phy.slewRate = 32; }, () => { if (phy.slewRate > 0) phy.slewRate = 0; });

            document.getElementById('btn-rec').addEventListener('click', () => {
                replay.recording = true;
                replay.playing = false;
                replay.frames = [];
                replay.t0 = performance.now() / 1000;
                document.getElementById('lbl-replay').textContent = 'REC 0.0s';
                document.getElementById('btn-rec')?.classList.add('ring-2', 'ring-rose-400', 'animate-pulse');
                document.getElementById('btn-replay')?.classList.remove('ring-2', 'ring-sky-400');
                document.getElementById('sim-status-text').textContent = '⏺ Đang ghi lại...';
            });
            document.getElementById('btn-replay').addEventListener('click', () => {
                document.getElementById('btn-rec')?.classList.remove('ring-2', 'ring-rose-400', 'animate-pulse');
                if (!replay.frames.length) {
                    document.getElementById('lbl-replay').textContent = 'Chưa có bản ghi';
                    return;
                }
                replay.recording = false;
                replay.playing = true;
                replay.cursor = 0;
                phy.slewRate = 0;
                phy.hoistSpeed = 0;
                document.getElementById('btn-replay')?.classList.add('ring-2', 'ring-sky-400');
                document.getElementById('sim-status-text').textContent = '▶ Đang xem lại...';
            });
            document.getElementById('btn-replay-stop').addEventListener('click', () => {
                replay.recording = false;
                replay.playing = false;
                document.getElementById('btn-rec')?.classList.remove('ring-2', 'ring-rose-400', 'animate-pulse');
                document.getElementById('btn-replay')?.classList.remove('ring-2', 'ring-sky-400');
                document.getElementById('lbl-replay').textContent = 'Đã dừng';
            });

            document.querySelectorAll('#left-tabs button').forEach(btn => {
                btn.addEventListener('click', () => {
                    document.querySelectorAll('#left-tabs button').forEach(b => b.classList.toggle('active', b === btn));
                    document.querySelectorAll('.left-page').forEach(page => page.classList.toggle('active', page.dataset.page === btn.dataset.page));
                });
            });
            document.querySelectorAll('#scene-store .card-btn').forEach(card => {
                card.addEventListener('click', () => {
                    document.querySelectorAll('#scene-store .card-btn').forEach(c => c.classList.remove('active'));
                    card.classList.add('active');
                    state.sceneId = card.dataset.scene;
                    const sceneToPreset = { studio: 'liebherr_studio', yard: 'overcast', sheet: 'print_plan' };
                    const targetPreset = sceneToPreset[state.sceneId] || 'liebherr_studio';
                    if (selGfxPreset) selGfxPreset.value = targetPreset;
                    buildWorld();
                    if (state.poseLock) applyLockedPose();
                });
            });
            document.querySelectorAll('#ground-store .card-btn').forEach(card => {
                card.addEventListener('click', () => {
                    document.querySelectorAll('#ground-store .card-btn').forEach(c => c.classList.remove('active'));
                    card.classList.add('active');
                    state.groundId = card.dataset.ground;
                    buildWorld();
                    if (state.poseLock) applyLockedPose();
                });
            });
            document.querySelectorAll('.pose-preset').forEach(btn => {
                btn.addEventListener('click', () => {
                    state.cargoPitchTrimDeg = parseFloat(btn.dataset.pitch);
                    state.cargoRollTrimDeg = parseFloat(btn.dataset.roll);
                    state.poseLock = true;
                    syncOrientationAndPullUI();
                    applyLockedPose();
                    parkHookSlack();
                    syncPoseLockUI();
                    document.getElementById('sim-status-text').textContent = 'Đã đặt góc sự cố trên nền. Bắt cáp rồi kéo — khi cáp căng, hàng xoay theo vật lý.';
                });
            });
            document.getElementById('btn-pose-lock').addEventListener('click', () => {
                state.poseLock = true;
                applyLockedPose();
                parkHookSlack();
                syncPoseLockUI();
            });

            // 11. Granular Indicator Toggles (CAD Edges, Force Vectors, LP Labels, CoG Label & Master Hide All)
            // 11. Granular Technical Display Options & Popover (Lực, góc, ma ní, cáp, nền...)
            const syncDisplayOptionsUI = () => {
                const dOpt = state.displayOptions;
                if (!dOpt) return;

                const setChk = (id, val) => {
                    const el = document.getElementById(id);
                    if (el) el.checked = Boolean(val);
                };

                setChk('chk-disp-forces', dOpt.showForces);
                setChk('chk-disp-angles', dOpt.showSlingAngles);
                setChk('chk-disp-ground', dOpt.showGroundAngle);
                setChk('chk-disp-hook', dOpt.showHookLoad);
                setChk('chk-disp-shackle', dOpt.showShackleLoads);
                setChk('chk-disp-lengths', dOpt.showSlingLengths);
                setChk('chk-disp-cog', dOpt.showCoG);
                setChk('chk-disp-vectors', dOpt.showVectors);
                setChk('chk-disp-cad', dOpt.showCADEdges);
                setChk('chk-disp-hud', dOpt.showHUD);

                // Backward-compatibility state sync
                state.showVectors = Boolean(dOpt.showVectors);
                state.showCADEdges = Boolean(dOpt.showCADEdges);
                state.showLPLabels = Boolean(dOpt.showForces || dOpt.showSlingAngles || dOpt.showShackleLoads || dOpt.showSlingLengths);
                state.showCoGLabel = Boolean(dOpt.showCoG);
                state.showGroundAngleIndicator = Boolean(dOpt.showGroundAngle);

                // Apply directly to 3D scene elements
                scene.traverse(o => { if (o.userData?.isCADEdge) o.visible = Boolean(dOpt.showCADEdges); });
                if (cargoGroundAngleGroup) cargoGroundAngleGroup.visible = Boolean(dOpt.showGroundAngle);
                const lblGround = document.getElementById('lbl-ground-angle');
                if (lblGround) lblGround.style.display = (dOpt.showGroundAngle !== false) ? '' : 'none';
                if (typeof updateCargoGroundAngleIndicator3D === 'function') updateCargoGroundAngleIndicator3D();
                if (cogIndicatorGroup) cogIndicatorGroup.visible = Boolean(dOpt.showCoG);
                if (plumbLineMesh) plumbLineMesh.visible = Boolean(dOpt.showCoG);

                const hudBar = document.getElementById('top-telemetry-hud');
                if (hudBar) hudBar.style.display = dOpt.showHUD ? '' : 'none';

                // Sync top toolbar button active states
                const btnCad = document.getElementById('btn-toggle-cad-edges');
                if (btnCad) {
                    const isCadOn = Boolean(dOpt.showCADEdges);
                    btnCad.classList.toggle('active', isCadOn);
                    btnCad.classList.toggle('border-sky-400', isCadOn);
                    btnCad.classList.toggle('text-sky-300', isCadOn);
                }
                const btnXray = document.getElementById('btn-xray');
                if (btnXray) {
                    btnXray.classList.toggle('active', Boolean(state.xrayCargo));
                    btnXray.classList.toggle('border-sky-400', Boolean(state.xrayCargo));
                    btnXray.classList.toggle('text-sky-300', Boolean(state.xrayCargo));
                }
                const btnVec = document.getElementById('btn-toggle-vectors');
                if (btnVec) {
                    const isVecOn = Boolean(dOpt.showVectors || dOpt.showForces);
                    btnVec.classList.toggle('active', isVecOn);
                    btnVec.classList.toggle('border-sky-400', isVecOn);
                    btnVec.classList.toggle('text-sky-300', isVecOn);
                }
            };
            window.syncDisplayOptionsUI = syncDisplayOptionsUI;
            const syncIndicatorButtonsUI = syncDisplayOptionsUI; // alias for safety

            // Unified Top Bar Dropdown Management
            const allDropdowns = [
                { menuId: 'menu-camera', btnId: 'btn-menu-camera', panelId: 'dropdown-panel-camera', arrowId: 'arrow-camera-menu' },
                { menuId: 'menu-display', btnId: 'btn-display-options', panelId: 'display-options-popover', arrowId: 'arrow-display-options' },
                { menuId: 'menu-gfx', btnId: 'btn-toggle-gfx', panelId: 'gfx-menu-popover', arrowId: 'arrow-gfx-menu' },
                { menuId: 'menu-docs', btnId: 'btn-menu-docs', panelId: 'dropdown-panel-docs', arrowId: 'arrow-docs-menu' },
                { menuId: 'menu-system', btnId: 'btn-menu-system', panelId: 'dropdown-panel-system', arrowId: 'arrow-system-menu' }
            ];

            function closeAllTopDropdowns() {
                allDropdowns.forEach(d => {
                    const panel = document.getElementById(d.panelId);
                    if (panel) {
                        panel.classList.add('hidden');
                        panel.classList.remove('open');
                    }
                    const wrap = document.getElementById(d.menuId);
                    if (wrap) wrap.classList.remove('open');
                    const btn = document.getElementById(d.btnId);
                    if (btn) btn.setAttribute('aria-expanded', 'false');
                    if (d.arrowId) {
                        const arrow = document.getElementById(d.arrowId);
                        if (arrow) arrow.style.transform = 'rotate(0deg)';
                    }
                });
            }
            if (window.UI?.layout) {
                window.UI.layout.closeAllMenus = closeAllTopDropdowns;
            }

            allDropdowns.forEach(d => {
                const btn = document.getElementById(d.btnId);
                const panel = document.getElementById(d.panelId);
                const wrap = document.getElementById(d.menuId);
                if (btn && panel) {
                    btn.setAttribute('aria-haspopup', 'true');
                    btn.setAttribute('aria-expanded', 'false');
                    panel.addEventListener('click', (e) => e.stopPropagation());
                    panel.addEventListener('pointerdown', (e) => e.stopPropagation());

                    btn.addEventListener('click', (e) => {
                        e.stopPropagation();
                        const isCurrentlyHidden = panel.classList.contains('hidden');
                        closeAllTopDropdowns();
                        if (isCurrentlyHidden) {
                            panel.classList.remove('hidden');
                            panel.classList.add('open');
                            if (wrap) wrap.classList.add('open');
                            btn.setAttribute('aria-expanded', 'true');
                            panel.style.zIndex = 'var(--z-popover)';
                            if (d.arrowId) {
                                const arrow = document.getElementById(d.arrowId);
                                if (arrow) arrow.style.transform = 'rotate(180deg)';
                            }

                            // Keep within viewport boundaries
                            const rect = btn.getBoundingClientRect();
                            const pWidth = panel.offsetWidth || 280;
                            let safeLeft = rect.left;
                            if (safeLeft + pWidth > window.innerWidth - 16) {
                                safeLeft = Math.max(12, window.innerWidth - pWidth - 16);
                            }
                            if (safeLeft < 12) safeLeft = 12;
                            panel.style.position = 'fixed';
                            panel.style.top = `${rect.bottom + 6}px`;
                            panel.style.left = `${safeLeft}px`;
                            panel.style.right = 'auto';
                        }
                    });
                }
            });

            // Close dropdowns upon clicking action items inside docs panel or camera presets
            ['btn-open-compliance', 'btn-open-liftplan', 'btn-open-plan-wizard', 'btn-quick-export-pdf', 'btn-open-3d-library'].forEach(id => {
                document.getElementById(id)?.addEventListener('click', () => closeAllTopDropdowns());
            });
            document.querySelectorAll('#dropdown-panel-camera .cam-btn').forEach(btn => {
                btn.addEventListener('click', () => closeAllTopDropdowns());
            });

            document.getElementById('btn-display-close')?.addEventListener('click', (e) => {
                e.stopPropagation();
                closeAllTopDropdowns();
            });

            document.getElementById('btn-close-gfx-popover')?.addEventListener('click', (e) => {
                e.stopPropagation();
                closeAllTopDropdowns();
            });

            window.addEventListener('click', () => closeAllTopDropdowns());

            // HUD Extra Stats Toggle Button
            const btnToggleHudExtra = document.getElementById('btn-toggle-hud-extra');
            if (btnToggleHudExtra) {
                btnToggleHudExtra.addEventListener('click', (e) => {
                    e.stopPropagation();
                    const extraItems = document.querySelectorAll('.hud-extra-stat');
                    let isNowExpanded = false;
                    extraItems.forEach(el => {
                        el.classList.toggle('hidden');
                        if (!el.classList.contains('hidden')) isNowExpanded = true;
                    });
                    btnToggleHudExtra.textContent = isNowExpanded ? '− Gọn Lại' : '+ Chi Tiết';
                    btnToggleHudExtra.className = isNowExpanded
                        ? 'shrink-0 px-1 py-0.5 rounded text-[8px] font-mono font-bold text-amber-300 bg-amber-950/80 border border-amber-500/60 transition'
                        : 'shrink-0 px-1 py-0.5 rounded text-[8px] font-mono font-bold text-slate-400 hover:text-amber-300 bg-slate-800/80 hover:bg-slate-700/80 border border-slate-700 transition';
                });
            }

            // Quick "All" and "None" buttons
            document.getElementById('btn-display-all')?.addEventListener('click', () => {
                Object.keys(state.displayOptions).forEach(k => { state.displayOptions[k] = true; });
                syncDisplayOptionsUI();
            });

            document.getElementById('btn-display-none')?.addEventListener('click', () => {
                Object.keys(state.displayOptions).forEach(k => { state.displayOptions[k] = false; });
                syncDisplayOptionsUI();
            });

            // Bind Individual Checkboxes
            const bindChk = (id, key) => {
                const el = document.getElementById(id);
                if (el) {
                    el.addEventListener('change', () => {
                        state.displayOptions[key] = el.checked;
                        syncDisplayOptionsUI();
                    });
                }
            };

            bindChk('chk-disp-forces', 'showForces');
            bindChk('chk-disp-angles', 'showSlingAngles');
            bindChk('chk-disp-ground', 'showGroundAngle');
            bindChk('chk-disp-hook', 'showHookLoad');
            bindChk('chk-disp-shackle', 'showShackleLoads');
            bindChk('chk-disp-lengths', 'showSlingLengths');
            bindChk('chk-disp-cog', 'showCoG');
            bindChk('chk-disp-vectors', 'showVectors');
            bindChk('chk-disp-cad', 'showCADEdges');
            bindChk('chk-disp-hud', 'showHUD');

            // Top toolbar buttons
            document.getElementById('btn-toggle-cad-edges')?.addEventListener('click', () => {
                state.displayOptions.showCADEdges = !state.displayOptions.showCADEdges;
                if (state.displayOptions.showCADEdges && typeof applyCADFeatureEdges === 'function') {
                    applyCADFeatureEdges(cargoRootGroup, false);
                    applyCADFeatureEdges(spreaderRootGroup, false);
                }
                syncDisplayOptionsUI();
            });

            document.getElementById('btn-toggle-vectors')?.addEventListener('click', () => {
                const turnOn = !state.displayOptions.showVectors || !state.displayOptions.showForces;
                state.displayOptions.showVectors = turnOn;
                state.displayOptions.showForces = turnOn;
                syncDisplayOptionsUI();
            });

            document.getElementById('btn-toggle-lp-labels')?.addEventListener('click', () => {
                const cur = state.displayOptions.showForces || state.displayOptions.showSlingAngles;
                state.displayOptions.showForces = !cur;
                state.displayOptions.showSlingAngles = !cur;
                syncDisplayOptionsUI();
            });

            document.getElementById('btn-toggle-cog-label')?.addEventListener('click', () => {
                state.displayOptions.showCoG = !state.displayOptions.showCoG;
                syncDisplayOptionsUI();
            });

            document.getElementById('btn-hide-all-indicators')?.addEventListener('click', () => {
                const anyOn = Object.values(state.displayOptions).some(Boolean);
                Object.keys(state.displayOptions).forEach(k => { state.displayOptions[k] = !anyOn; });
                syncDisplayOptionsUI();
            });

            syncDisplayOptionsUI();
            toggleLeftPanel(true);
            openRightDrawer('rig');
            applyLang();

            // 12. Detailed Orientation, Rotation & Pulling Vector UI Events
            const applyYawChange = newYaw => {
                state.cargoYawDeg = THREE.MathUtils.clamp(newYaw, -180, 180);
                if (dunnageGroup && phy.cargoPos) {
                    dunnageGroup.position.set(phy.cargoPos.x, 0, phy.cargoPos.z);
                    dunnageGroup.rotation.y = THREE.MathUtils.degToRad(state.cargoYawDeg);
                }
                syncOrientationAndPullUI();
                if (phy.groundClearance < 0.1 || state.poseLock) {
                    state.poseLock = true;
                    applyLockedPose();
                    parkHookSlack();
                    syncPoseLockUI();
                }
                // Instant upper-gear lean with cargo skew (before next physics frame)
                if (typeof seedBeamsFromKinematic === 'function') seedBeamsFromKinematic();
                if (typeof applyBeamVisuals === 'function') applyBeamVisuals();
                if (typeof updateCargoGroundAngleIndicator3D === 'function') {
                    updateCargoGroundAngleIndicator3D();
                }
            };
            window.applyYawChange = applyYawChange;

            // Events for Header Yaw Controls
            const hdrInpYaw = document.getElementById('hdr-inp-cargo-yaw');
            if (hdrInpYaw) {
                hdrInpYaw.addEventListener('input', e => applyYawChange(parseFloat(e.target.value) || 0));
                hdrInpYaw.addEventListener('change', e => applyYawChange(parseFloat(e.target.value) || 0));
            }
            document.getElementById('hdr-btn-yaw-m5')?.addEventListener('click', () => applyYawChange(state.cargoYawDeg - 5));
            document.getElementById('hdr-btn-yaw-p5')?.addEventListener('click', () => applyYawChange(state.cargoYawDeg + 5));
            document.getElementById('hdr-btn-yaw-0')?.addEventListener('click', () => applyYawChange(0));
            document.getElementById('hdr-btn-yaw-45')?.addEventListener('click', () => applyYawChange(45));
            document.getElementById('hdr-btn-yaw-90')?.addEventListener('click', () => applyYawChange(90));


            // Events for Tab 3 (Sự cố) Yaw Controls
            const inpCargoYaw = document.getElementById('inp-cargoYaw');
            if (inpCargoYaw) inpCargoYaw.addEventListener('input', e => applyYawChange(parseFloat(e.target.value)));
            const btnYawMinus = document.getElementById('btn-yaw-minus');
            if (btnYawMinus) btnYawMinus.addEventListener('click', () => applyYawChange(state.cargoYawDeg - 5));
            const btnYawPlus = document.getElementById('btn-yaw-plus');
            if (btnYawPlus) btnYawPlus.addEventListener('click', () => applyYawChange(state.cargoYawDeg + 5));
            document.querySelectorAll('.yaw-preset').forEach(btn => {
                btn.addEventListener('click', () => applyYawChange(parseFloat(btn.dataset.yaw)));
            });

            // Events for Tab 1 (Kiện) Ground Cargo Yaw Controls
            const inpGroundYaw = document.getElementById('inp-groundCargoYaw');
            if (inpGroundYaw) inpGroundYaw.addEventListener('input', e => applyYawChange(parseFloat(e.target.value)));
            const btnGroundM15 = document.getElementById('btn-ground-yaw-m15');
            if (btnGroundM15) btnGroundM15.addEventListener('click', () => applyYawChange(state.cargoYawDeg - 15));
            const btnGroundM5 = document.getElementById('btn-ground-yaw-m5');
            if (btnGroundM5) btnGroundM5.addEventListener('click', () => applyYawChange(state.cargoYawDeg - 5));
            const btnGroundP5 = document.getElementById('btn-ground-yaw-p5');
            if (btnGroundP5) btnGroundP5.addEventListener('click', () => applyYawChange(state.cargoYawDeg + 5));
            const btnGroundP15 = document.getElementById('btn-ground-yaw-p15');
            if (btnGroundP15) btnGroundP15.addEventListener('click', () => applyYawChange(state.cargoYawDeg + 15));
            document.querySelectorAll('.ground-yaw-quick').forEach(btn => {
                btn.addEventListener('click', () => applyYawChange(parseFloat(btn.dataset.yaw)));
            });
            const btnResetGroundYaw = document.getElementById('btn-reset-ground-yaw');
            if (btnResetGroundYaw) btnResetGroundYaw.addEventListener('click', () => applyYawChange(0));

            // Spreader Alignment vs Skew Toggles
            const btnAlignFixed = document.getElementById('btn-spreader-align-fixed');
            if (btnAlignFixed) {
                btnAlignFixed.addEventListener('click', () => {
                    state.spreaderAlignWithCargo = false;
                    syncOrientationAndPullUI();
                    if (typeof seedBeamsFromKinematic === 'function') seedBeamsFromKinematic();
                    if (typeof rebuildSpreaderVisuals === 'function') rebuildSpreaderVisuals();
                });
            }
            const btnAlignFollow = document.getElementById('btn-spreader-align-follow');
            if (btnAlignFollow) {
                btnAlignFollow.addEventListener('click', () => {
                    state.spreaderAlignWithCargo = true;
                    syncOrientationAndPullUI();
                    if (typeof seedBeamsFromKinematic === 'function') seedBeamsFromKinematic();
                    if (typeof rebuildSpreaderVisuals === 'function') rebuildSpreaderVisuals();
                });
            }

            const btnHookSwivelOn = document.getElementById('btn-hook-swivel-on');
            if (btnHookSwivelOn) {
                btnHookSwivelOn.addEventListener('click', () => {
                    state.hookSwivelEnabled = true;
                    syncOrientationAndPullUI();
                    if (typeof seedBeamsFromKinematic === 'function') seedBeamsFromKinematic();
                });
            }
            const btnHookSwivelOff = document.getElementById('btn-hook-swivel-off');
            if (btnHookSwivelOff) {
                btnHookSwivelOff.addEventListener('click', () => {
                    state.hookSwivelEnabled = false;
                    syncOrientationAndPullUI();
                    if (typeof seedBeamsFromKinematic === 'function') seedBeamsFromKinematic();
                });
            }

            document.getElementById('inp-cargoPitch').addEventListener('input', e => {
                state.cargoPitchTrimDeg = parseFloat(e.target.value);
                syncOrientationAndPullUI();
                if (phy.groundClearance < 0.12) {
                    state.poseLock = true;
                    applyLockedPose();
                    parkHookSlack();
                    syncPoseLockUI();
                }
            });
            document.getElementById('inp-cargoRoll').addEventListener('input', e => {
                state.cargoRollTrimDeg = parseFloat(e.target.value);
                syncOrientationAndPullUI();
                if (phy.groundClearance < 0.12) {
                    state.poseLock = true;
                    applyLockedPose();
                    parkHookSlack();
                    syncPoseLockUI();
                }
            });

            const updateHookFromPullVector = () => {
                const azRad = THREE.MathUtils.degToRad(state.pullAzimuthDeg);
                const rotCoG = new THREE.Vector3(state.cogX, 0, state.cogZ).applyAxisAngle(
                    new THREE.Vector3(0, 1, 0),
                    THREE.MathUtils.degToRad(state.cargoYawDeg)
                );
                phy.autoHoistActive = false;
                phy.hookTarget.x = THREE.MathUtils.clamp(rotCoG.x + state.pullRadius * Math.cos(azRad), -6.5, 6.5);
                phy.hookTarget.z = THREE.MathUtils.clamp(rotCoG.z + state.pullRadius * Math.sin(azRad), -5.5, 5.5);
                syncOrientationAndPullUI();
            };

            document.getElementById('inp-pullAzimuth').addEventListener('input', e => {
                phy.autoHoistActive = false;
                state.pullAzimuthDeg = parseFloat(e.target.value);
                updateHookFromPullVector();
            });
            document.getElementById('inp-pullRadius').addEventListener('input', e => {
                phy.autoHoistActive = false;
                state.pullRadius = parseFloat(e.target.value);
                updateHookFromPullVector();
            });

            document.getElementById('inp-hookX').addEventListener('input', e => {
                phy.autoHoistActive = false;
                phy.hookTarget.x = parseFloat(e.target.value);
                state.pullRadius = Math.hypot(phy.hookTarget.x, phy.hookTarget.z);
                state.pullAzimuthDeg = (Math.atan2(phy.hookTarget.z, phy.hookTarget.x) * 180 / Math.PI + 360) % 360;
                syncOrientationAndPullUI();
            });
            document.getElementById('inp-hookZ').addEventListener('input', e => {
                phy.autoHoistActive = false;
                phy.hookTarget.z = parseFloat(e.target.value);
                state.pullRadius = Math.hypot(phy.hookTarget.x, phy.hookTarget.z);
                state.pullAzimuthDeg = (Math.atan2(phy.hookTarget.z, phy.hookTarget.x) * 180 / Math.PI + 360) % 360;
                syncOrientationAndPullUI();
            });

            document.getElementById('btn-reset-orient').addEventListener('click', () => {
                state.cargoYawDeg = 0;
                state.cargoPitchTrimDeg = 0;
                state.cargoRollTrimDeg = 0;
                state.pullAzimuthDeg = 0;
                state.pullRadius = 0;
                phy.hookTarget.x = 0;
                phy.hookTarget.z = 0;
                applyYawChange(0);
            });

            document.querySelectorAll('.cam-btn').forEach(btn => {
                btn.addEventListener('click', () => {
                    document.querySelectorAll('.cam-btn').forEach(b => b.classList.remove('active'));
                    btn.classList.add('active');
                    const mode = btn.dataset.cam;
                    if (mode === 'iso') { camera.position.set(-13.5, 9.2, 19.5); controls.target.set(3.2, 3.2, -0.6); }
                    if (mode === 'hook') {
                        camera.position.set(phy.hookPos.x + 2.6, phy.hookPos.y - 0.5, phy.hookPos.z + 3.0);
                        controls.target.set(phy.hookPos.x, phy.hookPos.y - 1.0, phy.hookPos.z);
                    }
                    if (mode === 'front') { camera.position.set(0, 3.4, 12.5); controls.target.set(0, 2.6, 0); }
                    if (mode === 'side') { camera.position.set(12.5, 3.4, 0); controls.target.set(0, 2.6, 0); }
                    if (mode === 'top') { camera.position.set(0, 18.5, 0.01); controls.target.set(0, 1.0, 0); }
                    if (mode === 'crane') { camera.position.set(15.5, 9.5, 17.5); controls.target.set(-2.0, 4.5, -2.0); }
                    controls.update();
                    if (typeof prevFollowWorldPos !== 'undefined') prevFollowWorldPos = null;
                    // Preset angles freeze into manual hold so auto cinema won't override
                    if (state.cameraFollow) {
                        state.cameraFollow.userManual = true;
                        state.cameraFollow.behavior = 'lock';
                        state.cameraFollow.enabled = false;
                        state.cameraFollow.smart = false;
                        state.cameraFollow.suppressUiReframe = true;
                        state.cameraFollow.stableView = true;
                        state.cameraFollow.lockedOffset = camera.position.clone().sub(controls.target);
                        state.cameraFollow.orbiting = false;
                        state.cameraFollow.paused = false;
                    }
                    if (typeof window.syncCameraFollowUI === 'function') window.syncCameraFollowUI();
                });
            });

            // Camera behavior: Auto | Giữ | Góc | Fly
            const btnCamCinema = document.getElementById('btn-cam-cinema');
            const btnCamLock = document.getElementById('btn-cam-lock');
            const btnCamHoldAngle = document.getElementById('btn-cam-hold-angle');
            const btnCamFlycam = document.getElementById('btn-cam-flycam');
            const btnCamFollow = document.getElementById('btn-cam-follow');
            const lblCamFollow = document.getElementById('cam-follow-label');
            const selCamFollowMode = document.getElementById('sel-cam-follow-mode');

            const styleCamBehaviorBtn = (btn, on) => {
                if (!btn) return;
                btn.classList.toggle('!bg-sky-700', on);
                btn.classList.toggle('!border-sky-400', on);
                btn.classList.toggle('!text-white', on);
                btn.classList.toggle('active', on);
                if (!on) {
                    btn.classList.add('text-slate-300');
                } else {
                    btn.classList.remove('text-slate-300');
                }
            };

            const syncCameraFollowUI = () => {
                if (!state.cameraFollow) {
                    state.cameraFollow = {
                        enabled: true, behavior: 'cinema', mode: 'auto', smart: true,
                        customOffset: new THREE.Vector3(), lockedOffset: null, angleIndex: 0,
                        flycamPhase: 0, flycamPitch: 0.34, flycamDist: 22, flycamSeeded: false,
                        flycamYawRate: 0.12,
                        orbiting: false, paused: false, userManual: false,
                        suppressUiReframe: true, stableView: true, focusOverride: null
                    };
                }
                if (state.cameraFollow.behavior === 'holdAngle') state.cameraFollow.behavior = 'angleCycle';
                if (!state.cameraFollow.behavior) {
                    state.cameraFollow.behavior = state.cameraFollow.enabled ? 'cinema' : 'lock';
                }
                if (state.cameraFollow.userManual == null) state.cameraFollow.userManual = false;
                if (state.cameraFollow.angleIndex == null) state.cameraFollow.angleIndex = 0;
                const behavior = state.cameraFollow.behavior;
                const mode = state.cameraFollow.mode || 'auto';
                const userManual = !!state.cameraFollow.userManual;
                const angleN = ((state.cameraFollow.angleIndex % 12) + 12) % 12 + 1;

                styleCamBehaviorBtn(btnCamCinema, !userManual && behavior === 'cinema');
                styleCamBehaviorBtn(btnCamLock, userManual || behavior === 'lock');
                styleCamBehaviorBtn(btnCamHoldAngle, !userManual && behavior === 'angleCycle');
                styleCamBehaviorBtn(btnCamFlycam, !userManual && behavior === 'flycam');

                if (lblCamFollow) {
                    if (userManual) {
                        lblCamFollow.textContent = state.lang === 'en' ? 'Mode: Manual' : 'Chế độ: Thủ công';
                    } else if (behavior === 'cinema') {
                        lblCamFollow.textContent = state.lang === 'en' ? 'Mode: Auto' : 'Chế độ: Auto';
                    } else if (behavior === 'angleCycle') {
                        lblCamFollow.textContent = state.lang === 'en'
                            ? `Mode: Angle ${angleN}/12`
                            : `Chế độ: Góc ${angleN}/12`;
                    } else if (behavior === 'flycam') {
                        lblCamFollow.textContent = state.lang === 'en' ? 'Mode: Flycam' : 'Chế độ: Flycam';
                    } else {
                        lblCamFollow.textContent = state.lang === 'en' ? 'Mode: Hold' : 'Chế độ: Giữ';
                    }
                }
                if (selCamFollowMode) {
                    const locked = userManual || behavior === 'lock';
                    selCamFollowMode.classList.toggle('opacity-40', locked);
                    selCamFollowMode.disabled = locked;
                    selCamFollowMode.value = mode;
                }
            };

            if (typeof window !== 'undefined') window.syncCameraFollowUI = syncCameraFollowUI;

            const applyCamBehavior = (behavior) => {
                if (typeof window.setCameraBehavior === 'function') {
                    window.setCameraBehavior(behavior);
                } else if (typeof setCameraBehavior === 'function') {
                    setCameraBehavior(behavior);
                } else {
                    state.cameraFollow = state.cameraFollow || {};
                    state.cameraFollow.behavior = behavior;
                    state.cameraFollow.enabled = behavior !== 'lock';
                    syncCameraFollowUI();
                }
            };

            if (btnCamCinema) {
                btnCamCinema.addEventListener('click', () => {
                    // Always re-run hero cinematic framing (rule of thirds) — even if already on Auto
                    if (typeof window.frameCinematicHeroShot === 'function') {
                        window.frameCinematicHeroShot({ duration: 0.95, force: true });
                    } else {
                        applyCamBehavior('cinema');
                    }
                });
            }
            if (btnCamLock) btnCamLock.addEventListener('click', () => applyCamBehavior('lock'));
            if (btnCamHoldAngle) btnCamHoldAngle.addEventListener('click', () => applyCamBehavior('angleCycle'));
            if (btnCamFlycam) btnCamFlycam.addEventListener('click', () => applyCamBehavior('flycam'));

            // Legacy hidden toggle still maps to cinema ↔ lock
            if (btnCamFollow) {
                btnCamFollow.addEventListener('click', () => {
                    const cur = (state.cameraFollow && state.cameraFollow.behavior) || 'cinema';
                    applyCamBehavior(cur === 'lock' ? 'cinema' : 'lock');
                });
            }

            if (selCamFollowMode) {
                selCamFollowMode.addEventListener('change', e => {
                    if (!state.cameraFollow) {
                        state.cameraFollow = {
                            enabled: true, behavior: 'flycam', mode: 'auto', smart: true,
                            customOffset: new THREE.Vector3(), lockedOffset: null, angleIndex: 0,
                            flycamPhase: 0, flycamYawRate: 0.18,
                            orbiting: false, paused: false, userManual: false,
                            suppressUiReframe: false, stableView: false, focusOverride: null
                        };
                    }
                    // Focus-mode select is an explicit control — clear manual override
                    if (state.cameraFollow.userManual || state.cameraFollow.behavior === 'lock') {
                        applyCamBehavior('angleCycle');
                    }
                    state.cameraFollow.userManual = false;
                    state.cameraFollow.mode = e.target.value;
                    state.cameraFollow.smart = state.cameraFollow.mode === 'auto'
                        || state.cameraFollow.behavior === 'cinema'
                        || state.cameraFollow.behavior === 'angleCycle'
                        || state.cameraFollow.behavior === 'flycam';
                    state.cameraFollow.paused = false;
                    state.cameraFollow.orbiting = false;
                    if (state.cameraFollow.mode === 'custom') {
                        const px = prompt('Nhập tọa độ Offset X (m) trên kiện:', state.cameraFollow.customOffset?.x || 0);
                        const py = prompt('Nhập tọa độ Offset Y (m) trên kiện:', state.cameraFollow.customOffset?.y || 0);
                        const pz = prompt('Nhập tọa độ Offset Z (m) trên kiện:', state.cameraFollow.customOffset?.z || 0);
                        if (px !== null && py !== null && pz !== null) {
                            state.cameraFollow.customOffset = new THREE.Vector3(parseFloat(px) || 0, parseFloat(py) || 0, parseFloat(pz) || 0);
                        }
                    }
                    if (state.cameraFollow.behavior === 'angleCycle' && typeof window.cycleCargoAngleShot === 'function') {
                        window.cycleCargoAngleShot({ duration: 0.65, advance: false });
                    } else if (typeof window.startCinematicUiFrame === 'function') {
                        // Focus-mode select is an explicit camera control — always allow
                        window.startCinematicUiFrame({ duration: 0.75, force: true });
                    }
                    syncCameraFollowUI();
                });
            }

            syncCameraFollowUI();

            // -------------------------------------------------------------
            // ENGINEERING CONTROLS: TIMBER DUNNAGE, CARGO SOIL, WIND & BOOM
            // -------------------------------------------------------------
            function updateSiteEngineeringCalculations() {
                const grossTon = (state.W_cargo || 22.0) + (state.W_rig || 1.23);
                const dunnageQty = parseInt(document.getElementById('sel-dunnage-qty')?.value || '2', 10) || 2;
                const sectionStr = document.getElementById('sel-dunnage-section')?.value || '200x200';
                const sectionParts = sectionStr.split('x').map(Number);
                const widthM = (sectionParts[0] || 200) / 1000;
                const dunnageLenM = parseFloat(document.getElementById('inp-dunnage-length')?.value || '3.0') || 3.0;
                const woodType = document.getElementById('sel-dunnage-wood')?.value || 'hardwood';
                
                // Allowable compression perp to grain: Hardwood ~14 MPa, Softwood ~8 MPa, Steel ~240 MPa
                const allowableMPa = woodType === 'hardwood' ? 14.0 : (woodType === 'softwood' ? 8.0 : 240.0);
                const allowableEl = document.getElementById('val-dunnage-allowable');
                if (allowableEl) allowableEl.textContent = `≤ ${allowableMPa.toFixed(1)} MPa`;

                // Total contact area between cargo and dunnage
                const cargoWidthM = Math.min(state.W || 2.4, dunnageLenM);
                const totalContactAreaM2 = Math.max(0.1, dunnageQty * widthM * cargoWidthM * 0.5);
                const totalForceN = grossTon * 9810;
                const contactPressureMPa = (totalForceN / (totalContactAreaM2 * 1e6));
                
                const pressEl = document.getElementById('val-dunnage-pressure');
                const badgeEl = document.getElementById('dunnage-status-badge');
                if (pressEl) pressEl.textContent = `${contactPressureMPa.toFixed(2)} MPa`;
                if (badgeEl) {
                    if (contactPressureMPa <= allowableMPa) {
                        badgeEl.className = 'text-[9px] font-mono font-bold px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-400 border border-emerald-500/40';
                        badgeEl.textContent = '🟢 ĐẠT CHUẨN NÉN';
                    } else {
                        badgeEl.className = 'text-[9px] font-mono font-bold px-2 py-0.5 rounded bg-rose-500/20 text-rose-400 border border-rose-500/40';
                        badgeEl.textContent = '🔴 VƯỢT GIỚI HẠN NÉN';
                    }
                }

                // Ground bearing pressure under dunnage
                const groundSoilType = document.getElementById('sel-cargo-soil')?.value || 'concrete';
                const soilCapMap = { concrete: 350.0, gravel: 30.0, stiff_clay: 15.0, soft_ground: 5.1 };
                const soilCap = soilCapMap[groundSoilType] || 350.0;
                const dunnageGroundArea = Math.max(0.2, dunnageQty * widthM * dunnageLenM);
                const cargoGbpTpm2 = grossTon / dunnageGroundArea;
                const cargoGbpKpa = cargoGbpTpm2 * 9.81;
                const soilSf = soilCap / Math.max(0.1, cargoGbpTpm2);

                const gbpValEl = document.getElementById('val-cargo-ground-press');
                const soilSfEl = document.getElementById('val-cargo-soil-sf');
                const soilBadge = document.getElementById('cargo-soil-badge');
                if (gbpValEl) gbpValEl.textContent = `${cargoGbpTpm2.toFixed(1)} T/m² (${cargoGbpKpa.toFixed(0)} kPa)`;
                if (soilSfEl) soilSfEl.textContent = `SF = ${soilSf.toFixed(1)} (${soilSf >= 1.5 ? 'Đạt' : 'Yếu'})`;
                if (soilBadge) {
                    if (soilSf >= 1.5) {
                        soilBadge.className = 'text-[9px] font-mono font-bold px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-400 border border-emerald-500/40';
                        soilBadge.textContent = '🟢 AN TOÀN NỀN';
                    } else {
                        soilBadge.className = 'text-[9px] font-mono font-bold px-2 py-0.5 rounded bg-rose-500/20 text-rose-400 border border-rose-500/40';
                        soilBadge.textContent = '🔴 NGUY CƠ LÚN NỀN';
                    }
                }

                // Wind Force & Deflection + rain
                const windSpeed = parseFloat(document.getElementById('rng-wind-speed')?.value || '3.5') || 3.5;
                const isGust = Boolean(document.getElementById('chk-wind-gust')?.checked);
                const weatherVary = document.getElementById('chk-weather-vary')
                    ? Boolean(document.getElementById('chk-weather-vary').checked)
                    : true;
                const windDirDeg = parseFloat(document.getElementById('sel-wind-dir')?.value || '0') || 0;
                const rainMmH = parseFloat(document.getElementById('rng-rain-mmh')?.value || '0') || 0;
                // Feed the live physics: setpoints (base*) + flags; live speed/rain may wander when vary=on.
                if (!state.wind) state.wind = {};
                state.wind.baseSpeedMps = windSpeed;
                state.wind.dirDeg = windDirDeg;
                state.wind.gust = isGust;
                state.wind.vary = weatherVary;
                state.wind.enabled = windSpeed > 0.01;
                // Always apply slider setpoints immediately so FX/HUD don't stay dry/calm
                // until the next weather-modulation tick (esp. when "biến thiên" is on).
                state.wind.speedMps = windSpeed;
                if (!state.weather) state.weather = { rainMmH: 0, rainBaseMmH: 0, wetFactor: 0 };
                state.weather.rainBaseMmH = rainMmH;
                state.weather.rainMmH = rainMmH;

                const liveWind = (typeof weatherVary === 'boolean' && weatherVary && state.wind.speedMps != null)
                    ? state.wind.speedMps
                    : windSpeed;
                const effectiveWindSpeed = isGust ? liveWind * 1.3 : liveWind;
                const windSpeedKmH = effectiveWindSpeed * 3.6;
                const liveRain = state.weather.rainMmH != null ? state.weather.rainMmH : rainMmH;

                let beaufort = 0;
                if (effectiveWindSpeed >= 24.5) beaufort = 10;
                else if (effectiveWindSpeed >= 20.8) beaufort = 9;
                else if (effectiveWindSpeed >= 17.2) beaufort = 8;
                else if (effectiveWindSpeed >= 13.9) beaufort = 7;
                else if (effectiveWindSpeed >= 10.8) beaufort = 6;
                else if (effectiveWindSpeed >= 8.0) beaufort = 5;
                else if (effectiveWindSpeed >= 5.5) beaufort = 4;
                else if (effectiveWindSpeed >= 3.4) beaufort = 3;
                else if (effectiveWindSpeed >= 1.6) beaufort = 2;
                else if (effectiveWindSpeed >= 0.3) beaufort = 1;

                const windValEl = document.getElementById('val-wind-speed');
                if (windValEl) {
                    windValEl.textContent = `${effectiveWindSpeed.toFixed(1)} m/s (${windSpeedKmH.toFixed(1)} km/h) · Beaufort ${beaufort}${isGust ? ' (Giật)' : ''}${weatherVary ? ' · biến thiên' : ''}`;
                }
                const rainValEl = document.getElementById('val-rain-mmh');
                if (rainValEl) {
                    let rainLabel = 'Khô';
                    if (liveRain >= 80) rainLabel = 'Rất lớn';
                    else if (liveRain >= 40) rainLabel = 'Mưa lớn';
                    else if (liveRain >= 15) rainLabel = 'Mưa vừa';
                    else if (liveRain >= 2) rainLabel = 'Mưa nhỏ';
                    rainValEl.textContent = `${liveRain.toFixed(0)} mm/h · ${rainLabel}`;
                }

                const projectedArea = (state.L || 6.0) * (state.H || 2.5);
                const airDensity = 1.225;
                const cd = 1.2;
                const windForceN = 0.5 * airDensity * Math.pow(effectiveWindSpeed, 2) * cd * projectedArea;
                const windForceKN = windForceN / 1000;
                const windForceKgf = windForceN / 9.81;

                const forceValEl = document.getElementById('val-wind-force');
                if (forceValEl) forceValEl.textContent = `${windForceKN.toFixed(2)} kN (${windForceKgf.toFixed(0)} kgf)`;

                const totalWeightN = grossTon * 9810;
                const driftDeg = (Math.atan2(windForceN, Math.max(1000, totalWeightN)) * 180 / Math.PI);
                const driftEl = document.getElementById('val-wind-drift');
                if (driftEl) driftEl.textContent = `${driftDeg.toFixed(2)}° (${effectiveWindSpeed <= 9.8 ? 'Đạt chuẩn' : 'Cần giám sát'})`;
                // Design (static) values above; the live solver values are published per frame
                // by refreshLiveWindReadout() once the airborne cargo actually feels the gusts.
                phy.windDesign = { forceKN: windForceKN, driftDeg };

                const rainForceN = (liveRain / 1000 / 3600) * 1000 * Math.max(0.2, (state.L || 6) * (state.W || 2.4)) * 8.5;
                const rainForceEl = document.getElementById('val-rain-force');
                if (rainForceEl) rainForceEl.textContent = `${(rainForceN / 1000).toFixed(2)} kN`;

                const windBadge = document.getElementById('wind-status-badge');
                if (windBadge) {
                    const rainTag = liveRain >= 40 ? ' · MƯA LỚN' : (liveRain >= 15 ? ' · MƯA' : '');
                    if (effectiveWindSpeed <= 9.8 && liveRain < 60) {
                        windBadge.className = 'text-[9px] font-mono font-bold px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-400 border border-emerald-500/40';
                        windBadge.textContent = `🟢 GIÓ AN TOÀN (CẤP ${beaufort})${rainTag}`;
                    } else if (effectiveWindSpeed <= 13.8 && liveRain < 80) {
                        windBadge.className = 'text-[9px] font-mono font-bold px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/40';
                        windBadge.textContent = `🟡 CẢNH BÁO GIÓ (CẤP ${beaufort})${rainTag}`;
                    } else {
                        windBadge.className = 'text-[9px] font-mono font-bold px-2 py-0.5 rounded bg-rose-500/20 text-rose-400 border border-rose-500/40';
                        windBadge.textContent = `🔴 DỪNG CẨU KHẨN CẤP (CẤP ${beaufort})${rainTag}`;
                    }
                }
            }

            // Bind Site inputs
            ['sel-dunnage-qty', 'sel-dunnage-section', 'sel-dunnage-wood', 'inp-dunnage-length', 'sel-cargo-soil', 'rng-wind-speed', 'chk-wind-gust', 'chk-weather-vary', 'sel-wind-dir', 'rng-rain-mmh'].forEach(id => {
                document.getElementById(id)?.addEventListener('input', updateSiteEngineeringCalculations);
                document.getElementById(id)?.addEventListener('change', updateSiteEngineeringCalculations);
            });

            const rngSlope = document.getElementById('rng-ground-slope');
            const valSlope = document.getElementById('val-ground-slope');
            if (rngSlope && valSlope) {
                rngSlope.addEventListener('input', () => {
                    valSlope.textContent = `${parseFloat(rngSlope.value).toFixed(1)}°`;
                    updateSiteEngineeringCalculations();
                });
            }

            // Bind Crane Boom & Reeving controls
            const rngBoomLen = document.getElementById('rng-boom-len');
            const valBoomLenSlider = document.getElementById('val-boom-len-slider');
            if (rngBoomLen && valBoomLenSlider) {
                rngBoomLen.addEventListener('input', () => {
                    valBoomLenSlider.textContent = `${parseFloat(rngBoomLen.value).toFixed(1)} m`;
                    const lmiBoomLen = document.getElementById('lmi-boom-len');
                    if (lmiBoomLen) lmiBoomLen.textContent = `${parseFloat(rngBoomLen.value).toFixed(1)} m`;
                });
            }

            const rngBoomAng = document.getElementById('rng-boom-ang');
            const valBoomAngSlider = document.getElementById('val-boom-ang-slider');
            if (rngBoomAng && valBoomAngSlider) {
                rngBoomAng.addEventListener('input', () => {
                    valBoomAngSlider.textContent = `${parseFloat(rngBoomAng.value).toFixed(1)}°`;
                    const lmiBoomAng = document.getElementById('lmi-boom-ang');
                    if (lmiBoomAng) lmiBoomAng.textContent = `${parseFloat(rngBoomAng.value).toFixed(1)}°`;
                });
            }

            const selReeving = document.getElementById('sel-crane-reeving');
            const valReevingCap = document.getElementById('val-reeving-capacity');
            if (selReeving && valReevingCap) {
                selReeving.addEventListener('change', () => {
                    const parts = parseInt(selReeving.value, 10) || 4;
                    const cap = parts * 10.5;
                    valReevingCap.textContent = `${cap.toFixed(1)} T`;
                });
            }

            updateSiteEngineeringCalculations();

            if (typeof bindPhase1Controls === 'function') {
                bindPhase1Controls();
            }
        }

        // ============================================================================
        // 13. 3D ASSET LIBRARY STUDIO, STL/OBJ/GLB PARSER & AI IMAGE-TO-3D ENGINE
