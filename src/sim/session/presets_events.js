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

        function syncDrawerHeaderLanguage() {
            const tabTitles = {
                cargo: { icon: '📦', title: '1. Hàng Hóa & Trọng Tâm', sub: 'Kích thước, Khối lượng, Trọng tâm CoG & Hướng xoay', titleEn: '1. Cargo & Centre of Gravity', subEn: 'Dimensions, mass, centre of gravity (CoG) and orientation' },
                lugs: { icon: '📍', title: '2. Điểm Nâng & Tai Cẩu', sub: 'Vị trí Pad-eye, Bích hàn & Bảo vệ góc cáp', titleEn: '2. Lifting Points & Pad-eyes', subEn: 'Pad-eye locations, welded plates and sling corner protection' },
                rig: { icon: '🟠', title: '3. Dầm Ngáng & Đòn Gánh', sub: 'Spreader, Lifting Beam, Tầng 1 & Tầng 2', titleEn: '3. Spreaders & Lifting Beams', subEn: 'Spreader beams, lifting beams, tiers 1 and 2' },
                gear: { icon: '⛓️', title: '4. Cáp Treo & Phụ Kiện', sub: 'Sling cáp/xích, Shackle ma ní & Tải an toàn WLL', titleEn: '4. Slings & Hardware', subEn: 'Wire-rope and chain slings, shackles and rated working loads (WLL)' },
                crane: { icon: '🏗️', title: '5. Thiết Bị Cẩu & Móc', sub: 'Cần trục Liebherr, Móc cẩu & Biểu đồ tải LMI', titleEn: '5. Crane & Hook Block', subEn: 'Liebherr cranes, hook blocks and live load charts (LMI)' },
                site: { icon: '🌍', title: '6. Hiện Trường & Sàn Kê', sub: 'Nền đất, Đà kê dunnage & Tải trọng gió', titleEn: '6. Jobsite & Ground Support', subEn: 'Ground conditions, timber dunnage and wind loads' }
            };
            const t = tabTitles[currentDrawerTab] || tabTitles.cargo;
            const titleEl = document.getElementById('drawer-header-title');
            const iconEl = document.getElementById('drawer-header-icon');
            const subEl = document.getElementById('drawer-header-sub');
            if (titleEl) titleEl.textContent = state.lang === 'en' ? t.titleEn : t.title;
            if (iconEl) iconEl.textContent = t.icon;
            if (subEl) subEl.textContent = state.lang === 'en' ? t.subEn : t.sub;
        }

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

            // Header titles & icons follow the selected language.
            syncDrawerHeaderLanguage();

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

        // Complete the English coverage for the full 3D workspace shell and
        // all six engineering panels. Keep exact source phrases here so the
        // language switch never relies on browser auto-translation.
        Object.assign(UI_EN, {
            '📌 Đã lưu mốc ban đầu': '📌 Initial baseline saved',
            '👁️ Hiển Thị': '👁️ Display',
            '✨ Đồ Họa': '✨ Graphics',
            '📋 Hồ Sơ & Chuẩn': '📋 Plans & Standards',
            '⚙️ Hệ Thống': '⚙️ System',
            'Tạo Phương Án': 'Create Lift Plan',
            'Thông Số (1-6)': 'Parameters (1–6)',
            'Chỉ Số Tải & An Toàn': 'LOAD & SAFETY INDICATORS',
            'Hư hại tải động:': 'Dynamic load damage:',
            'DAF cáp cẩu:': 'Hoist-rope DAF:',
            'Thời tiết:': 'Weather:',
            'Mô Phỏng:': 'SIMULATION:',
            '🪝 TỜI:': '🪝 HOIST:',
            '🪝 Tời:': '🪝 Hoist:',
            'Tốc độ:': 'SPEED:',
            'Chậm': 'Slow',
            'Nhanh': 'Fast',
            'Cần:': 'SLEW:',
            'Cam:': 'CAMERA:',
            'Giữ': 'Hold',
            'Thời Gian Thực VN (Real-Time) · Sàn bê tông phẳng': 'Vietnam local time · Flat concrete testbed',
            '3. DẦM NGÁNG & ĐÒN GÁNH': '3. SPREADERS & LIFTING BEAMS',
            '3. Dầm Ngáng & Đòn Gánh': '3. Spreaders & Lifting Beams',
            '3. Dầm ngáng & đòn gánh': '3. Spreaders & Lifting Beams',
            'Spreader, Lifting Beam, Tầng 1 & Tầng 2': 'Spreader, lifting beam, tier 1 & tier 2',
            'Spreader, Lifting Beam, Tầng 1 & Tầng 2': 'Spreader, lifting beam, tiers 1 and 2',
            '✕ Đóng': '✕ Close',
            'Các trang hiệu chỉnh': 'Adjustment panels',
            '📦 1. Hàng hóa': '📦 1. Cargo',
            '📍 2. Điểm nâng': '📍 2. Lifting Points',
            '🟠 3. Dầm ngáng': '🟠 3. Spreaders',
            '⛓️ 4. Cáp treo': '⛓️ 4. Slings',
            '🏗️ 5. Cẩu 3D': '🏗️ 5. 3D Crane',
            '🌍 6. Hiện trường': '🌍 6. Jobsite',
            'Tạo phương án kéo hàng (Wizard)': 'Lift plan wizard',
            '1.1 Chủng Loại Kiện Hàng — Cargo & Load Types': '1.1 Cargo and load types',
            'Container tiêu chuẩn': 'Standard container',
            'Container mặt bằng': 'Flat rack container',
            'Container hở mái': 'Open-top container',
            'ISO Tank · Bồn chứa': 'ISO tank · Storage tank',
            'Siêu trường siêu trọng': 'Out-of-gauge cargo',
            'Máy biến áp': 'Transformer',
            'Bồn áp lực': 'Pressure vessel',
            'Tua-bin điện gió': 'Wind turbine',
            'Máy xúc / Xe cơ giới': 'Excavator / Vehicle',
            'Tàu kéo / Vỏ tàu thủy': 'Tugboat / Vessel hull',
            'Ống thép siêu trường': 'Oversize steel pipe',
            'Xe bus / Xe cơ giới · 3D CAD 1:1': 'Bus / Vehicle · 1:1 3D CAD',
            '1.2 Kích Thước Hình Học & Khối Lượng — Geometry & Mass': '1.2 Geometry and mass',
            '2.44m (Chuẩn)': '2.44 m (standard)',
            'Khối lượng:': 'Mass:',
            '2B. Hàng Quá Khổ Flat Rack (OOG)': '2B. Flat rack out-of-gauge cargo (OOG)',
            '📦 Có Hàng: BẬT': '📦 Cargo loaded: ON',
            '⛺ Mở Bạt (Xem Hàng)': '⛺ Open cover (view cargo)',
            'Cao hàng (Ø):': 'Cargo height (Ø):',
            'Rộng hàng:': 'Cargo width:',
            'Dài hàng:': 'Cargo length:',
            'Flat Rack: 2 cánh chặn quá dài. ΔL trước/sau chỉnh dài & lệch kiện nhưng mỗi đầu cách cánh ≥40 cm. OW vẫn được OOG. OH trừ thớt đáy.': 'Flat rack: two end stops restrain overlength cargo. Adjust front/rear ΔL and cargo offset while keeping at least 40 cm clearance at each end. OW remains OOG; OH excludes the bottom dunnage.',
            'OH — So với nóc cont:': 'OH — above container top:',
            'OW trái (−Z):': 'Left OW (−Z):',
            'OW phải (+Z):': 'Right OW (+Z):',
            'ΔL trước (cách cánh ≥40cm):': 'Front ΔL (≥40 cm from stop):',
            'ΔL sau (cách cánh ≥40cm):': 'Rear ΔL (≥40 cm from stop):',
            'Kiện quy đổi': 'Cargo envelope',
            'Khe cánh': 'End-stop clearance',
            'Xoay hướng kiện hàng tự do trước khi kéo (không bắt buộc song song với beam/spreader) để thử nghiệm các góc móc cáp xiên và kiểm tra lực vặn, xoay khi nâng.': 'Rotate the cargo freely before hoisting; it does not need to be parallel to the beam or spreader. Use this to explore skewed sling angles and assess torsion and rotation during lifting.',
            '180° Đảo': '180° Reverse',
            'Móc cẩu (hook):': 'Crane hook:',
            'Xoay được': 'Swivelling',
            'Khóa hướng': 'Orientation locked',
            '1.3 Trọng Tâm Kiện Hàng — Center of Gravity (CoG)': '1.3 Cargo centre of gravity (CoG)',
            '1.4 Góc Xoay, Hướng Xoay & Hướng Kéo': '1.4 Cargo orientation and pull direction',
            'Thẳng đứng (0°)': 'Vertical (0°)',
            '2.1 Điểm Nâng & Tai Cẩu — Lifting Points & Pad-eyes': '2.1 Lifting points and pad-eyes',
            'hàn sát vỏ thật của kiện. Kéo': 'are welded directly to the cargo shell. Drag an LP',
            'trên bề mặt 3D hoặc chỉnh tọa độ bên dưới.': 'on the 3D surface or edit its coordinates below.',
            'Pad-eye / Lug Plate (Tai cẩu / Bích cẩu)': 'Pad-eye / lug plate',
            'Vị trí Pad-eye / Lug Plate:': 'Pad-eye / lug plate location:',
            'Khoảng cách dọc |X| (cả 4):': 'Longitudinal spacing |X| (all 4):',
            'Khoảng cách ngang |Z| (cả 4):': 'Transverse spacing |Z| (all 4):',
            'Cao độ Pad-eye / Lug Plate (Y):': 'Pad-eye / lug plate elevation (Y):',
            'Turnbuckle — Tăng đơ chỉnh cáp (ΔL):': 'Turnbuckle — sling length adjustment (ΔL):',
            '3.1 Chủng Loại Dầm Ngáng — Spreaders & Lifting Beams': '3.1 Spreader and lifting-beam types',
            'Dầm ngáng lắp ghép (Nén)': 'Modular spreader beam (compression)',
            'Dầm nâng (Chịu uốn)': 'Lifting beam (bending)',
            'Dầm ngáng chữ H / Khung': 'H-beam spreader / frame',
            'Ngáng STS bung 20/40/45ft · twistlock': 'Extendable STS spreader 20/40/45 ft · twistlocks',
            '2-4-4 · dầm lớn→nhỏ = 2 cáp/đầu': '2-4-4 · two slings per end between beam tiers',
            '2-4-4 · giàn nén, 2 hangers/dầm phụ': '2-4-4 · compression truss, two hangers per sub-beam',
            'Chùm cáp 4 nhánh (Master Link)': 'Four-leg bridle (master link)',
            '2 cáp/thanh (4 upper) · ôm đáy': 'Two slings per beam (four upper legs) · basket hitch',
            '3.2 Kích Thước Dầm Ngáng (Spreader Span)': '3.2 Spreader dimensions and span',
            '⚡ Tự Khớp Kiện': '⚡ Fit to cargo',
            'Ngáng STS chỉ bung': 'STS spreader only extends to',
            '. Số đo là': '. Dimensions show',
            '(ISO 1161 / 668) — không phải kích thước phủ bì container.': '(ISO 1161 / 668), not the container overall dimensions.',
            '3 cỡ chuẩn': '3 standard sizes',
            'khoảng cách tâm twistlock': 'twistlock centre spacing',
            'Pitch twistlock đang chọn': 'Selected twistlock pitch',
            'Tự trọng: ~10.5 t': 'Self-weight: ~10.5 t',
            'Cách bắt kiện': 'Cargo connection',
            'Gắp trực tiếp': 'Direct pick',
            'Twistlock chụp góc ISO — không cáp / ma ní / xích dưới ngáng': 'ISO corner castings connect directly by twistlock — no lower slings, shackles or chains',
            'Dùng cáp / xích': 'Use slings / chains',
            'Điểm ma ní dưới ngáng → cáp/xích → tai cẩu kiện như dầm thường': 'Lower spreader shackle → sling/chain → cargo pad-eye, as with a standard beam',
            'Twin-lift 2×20 ft — hai cont cạnh nhau (8 twistlock, CAD twin)': 'Twin lift 2×20 ft — adjacent containers (8 twistlocks, twin CAD)',
            'Twin-lift chỉ': 'Twin lift only supports two containers',
            '(gồm chốt giữa). Không treo cáp 4 góc ngoài.': '(including the centre locks). Do not rig the four outer corners with slings.',
            'gắp twistlock': 'by twistlock',
            'Đồng bộ ngáng ↔ container (mặc định cùng cỡ ISO)': 'Synchronize spreader ↔ container (same ISO size by default)',
            'Bật: đổi một bên thì bên kia theo. Tắt: chỉnh ngáng hoặc container': 'On: changing either side updates the other. Off: adjust the spreader or container',
            ', cái còn lại giữ nguyên.': '; the other remains unchanged.',
            'độc lập': 'independently',
            'Chiều Dài Dầm (L):': 'Beam length (L):',
            'Tự trọng: ~1061 kg': 'Self-weight: ~1061 kg',
            'Quy cách:': 'Standard lengths:',
            '🌲 3.3 CẤU TRÚC PHÂN TẦNG CÁP & GÓC NÂNG': '🌲 3.3 Sling tiers and lift angles',
            '🌲 3.3 Cấu Trúc Phân Tầng Cáp & Góc Nâng': '🌲 3.3 Sling tiers and lift angles',
            'Góc kéo β:': 'Pull angle β:',
            'Góc đứng α:': 'Angle from vertical α:',
            'Hệ số TF (LAF):': 'Tension factor (LAF):',
            'Độ dài nhánh T1 (L₁):': 'Tier 1 leg length (L₁):',
            'Nấc dài:': 'Length presets:',
            'Góc kéo Tầng 1 (β ngang):': 'Tier 1 pull angle (β from horizontal):',
            '40° (tải cao)': '40° (higher leg load)',
            '50° mặc định': '50° default',
            '55° (êm)': '55° (smoother)',
            'Nấc góc:': 'Angle presets:',
            'Nhánh T1:': 'Tier 1 legs:',
            'Cáp treo giữa hệ 3 tầng — mặc định số chẵn 2–4 m, chỉnh thủ công được': 'Three-tier intermediate hangers — even 2–4 m defaults; manual adjustment available',
            'Độ dài hanger (H):': 'Hanger length (H):',
            'Nấc chuẩn:': 'Standard presets:',
            'Nhánh H:': 'Hanger legs:',
            'Góc nghiêng α: 62.0°': 'Angle from vertical α: 62.0°',
            '🎯 Đang chọn: Cáp L1-1': '🎯 Selected: Upper sling L1-1',
            'Lực căng T: 0.00 T': 'Leg tension: 0.00 t',
            'Góc α: 60.0°': 'Angle α: 60.0°',
            'Hệ số TF:': 'Tension factor:',
            'Độ dài nhánh T2 (L₂):': 'Tier 2 leg length (L₂):',
            'Nhánh T2:': 'Tier 2 legs:',
            'Nâng Tối Thiểu (β = 40°)': 'Minimum lift (β = 40°)',
            'Mặc định 50° / 8·2 m': 'Recommended 50° / 8·2 m',
            'Tinh chỉnh riêng sợi đang chọn': 'Adjust selected leg',
            '⚡ Áp dụng cả tầng': '⚡ Apply to entire tier',
            '4.1 Chủng Loại Cáp & Phụ Kiện Treo — Slings & Hardware': '4.1 Sling and hardware types',
            'Dây cáp thép': 'Wire-rope sling',
            'Dây xích cẩu': 'Chain sling',
            'Cáp vải dẹt': 'Flat webbing sling',
            'Cáp vải tròn': 'Round sling',
            'Cáp vòng kín': 'Endless sling',
            'Ma ní móng ngựa': 'Bow shackle',
            'Ma ní chữ D': 'D-shackle',
            'Móc chốt xỏ': 'Clevis hook',
            'Móc khuyên tròn': 'Eye hook',
            'Móc xoay 360°': '360° swivel hook',
            'Bu-lông vòng': 'Eye bolt',
            'Kẹp tôn': 'Plate clamp',
            'Cân cẩu điện tử': 'Dynamometer',
            '📋 BẢNG THIẾT BỊ RÁP BỘ HOÀN CHỈNH (RIGGING BOM)': '📋 COMPLETE RIGGING BILL OF MATERIALS (BOM)',
            '🪝 Móc & Khuyên:': '🪝 Hooks & master links:',
            '⛓️ Dây cáp (Slings):': '⛓️ Slings:',
            '🔩 Ma ní (Shackles):': '🔩 Shackles:',
            '⚖️ Dầm & Tăng đơ:': '⚖️ Beams & turnbuckles:',
            'WLL / SWL (Tải an toàn danh định nhánh):': 'WLL / SWL (rated working load per leg):',
            'Kích thước thân cáp (Ø / W):': 'Sling body size (Ø / W):',
            'Khối lượng tự động:': 'Calculated mass:',
            'Toàn bộ cụm cáp tuân thủ chuẩn': 'The complete sling assembly complies with',
            'Đầu cáp có': 'Sling ends use',
            ', gom vào': ', gathered into',
            '. Chỉnh ΔL ≠ 0 lắp': '. For ΔL ≠ 0, use',
            'Thimble (Bẹn)': 'Thimble',
            'Ferrule (Ép chì)': 'Ferrule',
            '4.2 Độ Dãn Cáp Hooke & Siêu Tĩnh 4 Nhánh': '4.2 Hookean sling stretch and four-leg statics',
            'Vật Liệu Cáp:': 'Sling material:',
            'Cáp Thép IWRC (E=105 GPa)': 'IWRC wire rope (E = 105 GPa)',
            'Xích Thép Gr100 (E=195 GPa)': 'Grade 100 chain (E = 195 GPa)',
            'Cáp Vải Polyester (E=2.8 GPa)': 'Polyester webbing (E = 2.8 GPa)',
            'Tính Chất Kiện Hàng:': 'Cargo behavior:',
            'Vật Cứng (Siêu tĩnh 4 nhánh)': 'Rigid (four-leg statically indeterminate)',
            'Vật Mềm (Chia đều 4 nhánh)': 'Flexible (equal load share across four legs)',
            'Lệch tải đường chéo (Skew Share):': 'Diagonal load imbalance (skew share):',
            'Võng Dầm/Sàn (w):': 'Beam/deck deflection (w):',
            'Xoắn Thân (ϕ):': 'Body torsion (ϕ):',
            'Võng Dầm:': 'Beam deflection:',
            'Phóng đại thị giác:': 'Visual exaggeration:',
            '📊 4.3 Thông Số Kỹ Thuật & Tải Trọng Cáp': '📊 4.3 Sling engineering data and loads',
            'Sling Angle (Góc cáp α)': 'Sling angle α',
            'Ngang β: 90.0°': 'From horizontal β: 90.0°',
            '⚖️ Khấu Trừ Khối Lượng Hệ Treo (Deductions)': '⚖️ Rigging mass deductions',
            'Kiện hàng tịnh (Net Cargo):': 'Net cargo:',
            'Ngáng / Dầm nâng (Spreader/Beam):': 'Spreader / lifting beam:',
            'Dây cáp + Ma ní + Tăng đơ:': 'Slings + shackles + turnbuckles:',
            'Cụm puly móc + Cáp tời (Hook Block):': 'Hook block + hoist rope:',
            'TỔNG TẢI TÍNH CẨU (GROSS LOAD):': 'TOTAL CRANE LOAD (GROSS LOAD):',
            'TENSION FORCE — LỰC CĂNG NHÁNH CÁP (LP1 → LP4)': 'TENSION FORCE — LEG LOADS (LP1 → LP4)',
            '5.1 Thiết Bị Cẩu 3D & Đầu Hook — 3D Cranes': '5.1 3D cranes and hook block',
            '🪝 Cụm Móc & Cáp Treo': '🪝 Hook block and hoist rope',
            'Chỉ hiện Đầu Hook · Góc nhìn 360°': 'Hook block only · 360° view',
            '🏗️ Cẩu Bánh Lốp LTM': '🏗️ LTM mobile crane',
            'Liebherr LTM 1200 · Chân chống H': 'Liebherr LTM 1200 · H outriggers',
            '🚜 Cẩu Bánh Xích LR': '🚜 LR crawler crane',
            'Liebherr LR 1300 · Cần giàn thép': 'Liebherr LR 1300 · lattice boom',
            '🏭 Cầu Trục Xưởng Test': '🏭 Test workshop overhead crane',
            '5.2 Bảng Tải Trọng Cẩu & LMI Thực Tế': '5.2 Crane load chart and live LMI',
            '🟢 AN TOÀN': '🟢 SAFE',
            'Dòng Cần Cẩu:': 'Crane model:',
            'Liebherr LR 1300 (300T Xích)': 'Liebherr LR 1300 (300 t crawler)',
            'Kato KR-500 (50T Bánh Béo)': 'Kato KR-500 (50 t rough-terrain)',
            'Độ Mở Chân Chống:': 'Outrigger spread:',
            '100% Tiêu Chuẩn (8.3m)': '100% full spread (8.3 m)',
            '75% Thu Hẹp (6.2m)': '75% spread (6.2 m)',
            '50% Hạn Chế (4.4m)': '50% restricted spread (4.4 m)',
            'Bán Kính R:': 'Radius R:',
            'Chiều Dài Cần:': 'Boom length:',
            'Góc Ngẩng Cần:': 'Boom angle:',
            'Sức Nâng Tối Đa:': 'Maximum capacity:',
            'Tải cẩu:': 'Crane load:',
            '75% Giám Sát': '75% monitoring threshold',
            '100% Quá Tải': '100% overload',
            'Điều chỉnh Chiều Dài Cần (Boom Length):': 'Adjust boom length:',
            'Điều chỉnh Góc Ngẩng Cần (Boom Angle):': 'Adjust boom angle:',
            'BỘI SUẤT PALĂNG & CỤM MÓC CẨU': 'REEVING AND HOOK BLOCK',
            'Số Nhánh Cáp Luồn (Reeving):': 'Number of rope falls (reeving):',
            '2 Nhánh (Tối đa 21.0 T)': '2 falls (max. 21.0 t)',
            '4 Nhánh (Tối đa 42.0 T)': '4 falls (max. 42.0 t)',
            '6 Nhánh (Tối đa 63.0 T)': '6 falls (max. 63.0 t)',
            '8 Nhánh (Tối đa 84.0 T)': '8 falls (max. 84.0 t)',
            '12 Nhánh (Tối đa 126.0 T)': '12 falls (max. 126.0 t)',
            'Khối Lượng Móc (Hook Tare):': 'Hook-block mass:',
            'Sức Nâng Dây Tời Palăng:': 'Hoist-rope capacity:',
            'Lực Kéo Đơn Nhánh:': 'Single-fall line pull:',
            '6.1 Sàn Thử Kỹ Thuật — Testbed Environment': '6.1 Engineering testbed environment',
            '🌤️ Môi Trường Theo Giờ VN (Real-Time)': '🌤️ Local-time environment',
            'Tự động theo giờ Việt Nam (nắng vàng ban ngày / xưởng đêm) · Lưới 1m/5m': 'Follows Vietnam local time (daylight / night workshop) · 1 m / 5 m grid',
            '🌤️ Sàn Thử Bê Tông Ngoài Trời': '🌤️ Outdoor concrete testbed',
            'Mặt phẳng rộng 200m · Ánh sáng tự nhiên': '200 m test area · Natural lighting',
            '📄 Bản Vẽ Lift Plan (ASME)': '📄 Lift plan drawing (ASME)',
            'Nền sáng kỹ thuật · Tối ưu in hồ sơ & soi cáp': 'Technical light background · Optimized for reports and sling inspection',
            '6.2 Sàn Kê & Tấm Lót Đà Gỗ (Timber Dunnage)': '6.2 Timber dunnage and mats',
            '🟢 ĐẠT CHUẨN NÉN': '🟢 WITHIN BEARING LIMIT',
            'Đà Gỗ Phẳng': 'Level timber dunnage',
            'Tiêu chuẩn': 'Standard',
            'Đà Nền Đất': 'Soil-supported dunnage',
            'Nền đất lún': 'Settling soil',
            'Đà Lệch Bậc': 'Stepped dunnage',
            'Lệch cao độ': 'Uneven elevation',
            'Số Thanh Kê / Cấu Hình:': 'Dunnage count / layout:',
            '2 Thanh Đà (2 Đầu Kiện)': '2 beams (at cargo ends)',
            '3 Thanh Đà (2 Đầu + Giữa)': '3 beams (ends + centre)',
            '4 Thanh Đà (Phân Bố Đều)': '4 beams (evenly spaced)',
            'Mảng Đà Chữ Thập (Grid Mat)': 'Cross-grid mat',
            'Tiết Diện Thanh Gỗ (B×H):': 'Timber section (W×H):',
            '150 × 150 mm (Gỗ Hộp)': '150 × 150 mm (sawn timber)',
            '200 × 200 mm (Chuẩn Heavy)': '200 × 200 mm (heavy duty)',
            '250 × 250 mm (Gỗ Tàu Biển)': '250 × 250 mm (marine timber)',
            '300 × 300 mm (Siêu Tải)': '300 × 300 mm (heavy load)',
            'Loại Gỗ / Vật Liệu:': 'Timber / material:',
            'Gỗ Cứng Nhóm II (Lim/Táu, 14 MPa)': 'Group II hardwood (14 MPa)',
            'Gỗ Thông / Tràm Xẻ (8 MPa)': 'Pine / acacia timber (8 MPa)',
            'Dầm Thép Hình I/H (Steel Beam)': 'I/H-section steel beam',
            'Chiều Dài Thanh Đà (m):': 'Dunnage length (m):',
            'Áp Lực Tiếp Xúc Mặt Gỗ:': 'Timber bearing pressure:',
            'Giới Hạn Nén Cho Phép:': 'Allowable bearing limit:',
            'ĐỊA CHẤT & ÁP LỰC TIẾP ĐẤT CỦA KIỆN (CARGO GBP)': 'GROUND CONDITIONS AND CARGO BEARING PRESSURE (GBP)',
            '🟢 AN TOÀN NỀN': '🟢 GROUND SAFE',
            'Nền Đất Vị Trí Hạ Kiện:': 'Ground beneath set-down area:',
            'Bê Tông Cảng / Sàn Đúc (350 T/m²)': 'Port concrete / cast slab (350 t/m²)',
            'Cấp Phối Đá Dăm K98 (30 T/m²)': 'K98 compacted aggregate (30 t/m²)',
            'Đất Sét Cứng Lu Lèn (15 T/m²)': 'Compacted stiff clay (15 t/m²)',
            'Đất Mềm Bãi Bồi / Cát Lấp (5 T/m²)': 'Soft alluvial soil / fill sand (5 t/m²)',
            'Độ Dốc Nền Đặt Kiện (°):': 'Cargo set-down ground slope (°):',
            'Áp Lực Đè Nền:': 'Ground bearing pressure:',
            'Hệ Số An Toàn Nền:': 'Ground safety factor:',
            'SF = 18.1 (Đạt)': 'SF = 18.1 (PASS)',
            'ÁP LỰC CHÂN CHỐNG CẨU & TẤM LÓT ĐẤT (GBP)': 'CRANE OUTRIGGER AND MAT BEARING PRESSURE (GBP)',
            '🟡 CẢNH BÁO NỀN YẾU': '🟡 WEAK GROUND WARNING',
            'Khảo Sát Nền Đất Vị Trí Cẩu:': 'Ground beneath crane:',
            'Đá Dăm K98 (30.6 T/m²)': 'K98 aggregate (30.6 t/m²)',
            'Sàn Bê Tông (250 T/m²)': 'Concrete slab (250 t/m²)',
            'Đất Sét Cứng (15.3 T/m²)': 'Stiff clay (15.3 t/m²)',
            'Đất Mềm / Cát Lấp (5.1 T/m²)': 'Soft soil / fill sand (5.1 t/m²)',
            'Tấm Lót Chân Chống (Mat):': 'Outrigger mat:',
            'Thép Hộp 2.0m × 2.0m (4.0m²)': 'Steel box mat 2.0 × 2.0 m (4.0 m²)',
            'Chỉ Đĩa Chân Ø0.6m (0.28m²)': 'Foot plate only Ø0.6 m (0.28 m²)',
            'Đà Gỗ 1.2m × 1.2m (1.44m²)': 'Timber mat 1.2 × 1.2 m (1.44 m²)',
            'Tấm Gỗ 1.6m × 1.6m (2.56m²)': 'Timber mat 1.6 × 1.6 m (2.56 m²)',
            'Thép Tấm 2.4m × 3.0m (7.2m²)': 'Steel plate 2.4 × 3.0 m (7.2 m²)',
            'PHẢN LỰC 4 CHÂN CHỐNG (OUTRIGGER REACTIONS):': 'FOUR OUTRIGGER REACTIONS:',
            'P2 (Trước-T):': 'P2 (front-right):',
            'P1 (Trước-P):': 'P1 (front-left):',
            'Áp lực đè nền:': 'Ground bearing pressure:',
            'Mat tối thiểu:': 'Minimum mat size:',
            '6.3 Tải Trọng Gió & Môi Trường Hiện Trường': '6.3 Wind loads and site conditions',
            '🟢 GIÓ AN TOÀN (CẤP 3)': '🟢 WIND SAFE (BEAUFORT 3)',
            'Mưa nghiêng theo hướng gió; mưa ≥ ~18 mm/h sẽ thỉnh thoảng': 'Rain follows the wind; at ≥18 mm/h, occasional',
            'để thấy kiện đong đưa.': 'to see cargo swing.',
            'chớp chân trời': 'distant lightning',
            'Nhấc thử / Kéo': 'Trial lift / Hoist',
            'Vận Tốc Gió Hiện Trường:': 'Site wind speed:',
            '3.5 m/s (12.6 km/h) · Beaufort 3 · biến thiên': '3.5 m/s (12.6 km/h) · Beaufort 3 · variable',
            '0 m/s (Yên ả)': '0 m/s (calm)',
            '≤ 9.8 m/s (Chuẩn cẩu)': '≤9.8 m/s (crane limit)',
            '12.8 m/s (Cảnh báo)': '12.8 m/s (warning)',
            '≥ 15 m/s (Dừng cẩu)': '≥15 m/s (stop crane)',
            'Hướng Gió Thổi:': 'Wind direction:',
            'Gió Dọc Kiện (0° - Đầu Kiện)': 'Along cargo (0° — end)',
            'Gió Ngang Thân Kiện (90° - Mạn Trái)': 'Across cargo (90° — port side)',
            'Gió Đuôi Kiện (180°)': 'From cargo rear (180°)',
            'Gió Mạn Phải (270°)': 'From starboard side (270°)',
            'Mô Phỏng Gió Giật (+30%)': 'Simulate gusts (+30%)',
            'Biến thiên thời tiết (tự dao động)': 'Variable weather (automatic)',
            'Mưa hiện trường:': 'Site rainfall:',
            '0 mm/h · Khô': '0 mm/h · Dry',
            '0 khô': '0 dry',
            '15 vừa': '15 moderate',
            '40 lớn': '40 heavy',
            '80+ rất lớn': '80+ very heavy',
            'Lực Gió Ngang (Fwind):': 'Lateral wind force (Fwind):',
            'Độ Dạt / Lệch Cáp:': 'Drift / sling deflection:',
            '0.07° (Đạt chuẩn)': '0.07° (within limit)',
            '0 mm/h · Khô': '0 mm/h · Dry',
            'SF = 18.1 (Đạt)': 'SF = 18.1 (PASS)',
            '": Đầu cáp có': '": Cable ends use',
            ': Đầu cáp có': ': Cable ends use',
            'mưa nghiêng theo hướng gió': 'rain driven by wind direction',
            '· nén ': '· compression ',
            '📏 m (Mét)': '📏 m (metric)',
            'Gió nhẹ gần như không lắc kiện nặng — kéo gió ≥ 10–15 m/s + mưa ≥ 40 mm/h rồi': 'Light winds barely move heavy cargo. Increase wind to ≥10–15 m/s and rain to ≥40 mm/h, then',
            '. Gió nhẹ gần như không lắc kiện nặng — kéo gió ≥ 10–15 m/s + mưa ≥ 40 mm/h rồi': '. Light winds barely move heavy cargo. Increase wind to ≥10–15 m/s and rain to ≥40 mm/h, then',
            'Lực mưa (Frain):': 'Rain force (Frain):',
            'Chọn dùng': 'Select',
            'Heavy Lift / Out of Gauge (OOG) — Hàng siêu trường siêu trọng': 'Heavy lift / out-of-gauge (OOG)',
            'Kiện máy công nghiệp đóng khung dầm thép gia cường': 'Industrial machinery in a reinforced steel frame',
            'Transformer — Máy biến áp': 'Transformer',
            'Máy biến áp lực 110kV có cánh tản nhiệt & sứ cách điện': '110 kV power transformer with radiators and bushings',
            'Pressure Vessel — Bồn áp lực': 'Pressure vessel',
            'Bồn trụ ngang ASME có tai cẩu hàn trên thân vỏ tròn': 'ASME horizontal vessel with pad-eyes welded to the shell',
            'Wind Turbine Nacelle — Tua-bin điện gió': 'Wind turbine nacelle',
            'Cụm máy phát điện gió nặng, lệch tâm CoG về phía Hub': 'Heavy wind-turbine generator with CoG offset toward the hub',
            'Excavator / Heavy Machinery — Máy xúc / Xe cơ giới nặng': 'Excavator / heavy machinery',
            'Máy xúc đào bánh xích công trường, cần gầu vươn': 'Crawler excavator with extended boom',
            'Tugboat / Vessel Hull — Tàu kéo / Vỏ tàu thủy': 'Tugboat / vessel hull',
            'Thân tàu chữ V có sống mũi, cabin lái & đệm chống va': 'V-hull with bow keel, wheelhouse and fenders',
            'Offshore Process Skid (OOG) — Cụm bơm dầu khí siêu trọng': 'Offshore process skid (OOG)',
            'Khung skid thép I-beam, đường ống mặt bích & cụm bơm đôi': 'I-beam skid frame, flanged pipework and twin pumps',
            'Vehicle — Xe bus / Xe cơ giới': 'Vehicle',
            'Mô hình 3D CAD 1:1 thân xe bus, trọng tâm thấp gần sàn': '1:1 3D CAD bus model with a low CoG near the deck',
            '💡 Chọn bất kỳ thiết kế 3D nào trong danh sách để': '💡 Select a 3D design from the list to',
            'hoặc bấm': 'or click',
            'Xem trước 3D': 'Preview 3D',
            '"Đưa Vào Sơ Đồ Cẩu"': '"Add to Lift Plan"',
            'Đang chọn: Container ISO': 'Selected: ISO container',
            '🔍 BUỒNG XEM TRƯỚC MÔ HÌNH IN 3D / CAD': '🔍 3D PRINT / CAD MODEL PREVIEW',
            'Mesh: Chuẩn CAD | Xoay chuột để kiểm tra khối 3D': 'CAD mesh | Drag to inspect the 3D model',
            'Xuất File 3D (.OBJ)': 'Export 3D file (.OBJ)',
            'Đưa Vào Sơ Đồ Làm Hàng': 'Add to lift plan',
            '2. Tạo Từ Ảnh (AI)': '2. Create from photo (AI)',
            '3. Ghép Tổ Hợp 3D': '3. Assemble 3D composition',
            'Phân Loại Vào Kho Thư Viện (Asset Category):': 'Library category:',
            '🗃️ 1. Cargo & Load Types — Hàng hóa & Kiện hàng': '🗃️ 1. Cargo and load types',
            '🪝 2. Rigging Hardware & Gears — Dụng cụ nâng hạ & Phụ kiện': '🪝 2. Rigging hardware and gear',
            '🟠 4. Spreaders & Lifting Beams — Dầm ngáng & Đòn gánh': '🟠 4. Spreaders and lifting beams',
            '🏗️ 5. Cranes & Hook Blocks — Phương tiện cần cẩu': '🏗️ 5. Cranes and hook blocks',
            'Kích Thước (L × W × H) & Khối Lượng Kiện 3D': '3D cargo dimensions (L × W × H) and mass',
            'Dài L (m):': 'Length L (m):',
            'Rộng W (m):': 'Width W (m):',
            'Tải Trọng (T):': 'Load (t):',
            '⚡ Lọc bỏ nội thất & Giữ vỏ ngoài sắc nét (Chống lag)': '⚡ Remove interior and preserve exterior detail (reduce lag)',
            'Chế độ tối ưu:': 'Optimization mode:',
            '✨ Lọc sạch ruột & Giữ 100% vỏ nét (Khuyên dùng)': '✨ Remove interior; preserve full exterior detail (recommended)',
            'Tối ưu nhẹ (Lọc ruột + Max 50k tris)': 'Light optimization (remove interior + max 50k triangles)',
            'Tối ưu cao (Max 25k tris cho máy yếu)': 'High optimization (max 25k triangles for low-end devices)',
            'Nguyên bản (Không lọc, không nén)': 'Original (no filtering or compression)',
            '✨ Tự động co giãn & tối ưu vỏ bọc 3D khi nạp': '✨ Auto-scale and optimize the 3D shell on import',
            '🔄 Cập Nhật Kích Thước (Live Resize)': '🔄 Update dimensions (live resize)',
            'Chuẩn Hóa Tỷ Lệ & Tọa Độ Metric 1:1': 'Normalize scale and metric coordinates to 1:1',
            'Quy Chuẩn Đối Chiếu (Standard Spec):': 'Reference specification:',
            'ISO Container 20ft — Container tiêu chuẩn': 'ISO 20 ft container',
            'ISO Container 40ft — Container tiêu chuẩn': 'ISO 40 ft container',
            'Flat Rack Container — Container mặt bằng': 'Flat rack container',
            'Open Top Container — Container hở mái': 'Open-top container',
            'Tank Container (ISO Tank) — Container bồn chứa': 'Tank container (ISO tank)',
            'Reefer Container — Container lạnh': 'Reefer container',
            'Heavy Lift / Out of Gauge (OOG) — Siêu trường siêu trọng': 'Heavy lift / out-of-gauge (OOG)',
            'Excavator / Heavy Machinery — Máy xúc / Xe cơ giới': 'Excavator / heavy machinery',
            'Modular Spreader Beam — Dầm ngáng lắp ghép': 'Modular spreader beam',
            'Lifting Beam / H-Beam Spreader — Dầm nâng chữ H': 'Lifting beam / H-beam spreader',
            'Bow Shackle / D-Shackle — Ma ní móng ngựa / Chữ D': 'Bow shackle / D-shackle',
            'STS Gantry Crane — Cẩu bờ Post-Panamax': 'STS gantry crane — Post-Panamax',
            'Mobile Harbor Crane — Cẩu chân đế LHM 550': 'Mobile harbour crane — LHM 550',
            'Đơn Vị File Gốc:': 'Source file units:',
            '✨ Tự Động (Auto-Detect)': '✨ Automatic (auto-detect)',
            'Milimét (mm - CAD / STEP)': 'Millimetres (mm — CAD / STEP)',
            'Mét (m - GLTF / Blender)': 'Metres (m — GLTF / Blender)',
            'Centimét (cm - 3ds Max)': 'Centimetres (cm — 3ds Max)',
            'Trục Thẳng Đứng (Up):': 'Up axis:',
            '✨ Tự Động (Auto)': '✨ Automatic',
            'Y-Up (Chuẩn WebGL / GLB)': 'Y-up (WebGL / GLB standard)',
            'Chế Độ Tỷ Lệ (Mode):': 'Scale mode:',
            '✨ Tự Động (Auto CAD/AI)': '✨ Automatic (CAD / AI)',
            'Tin Đơn Vị CAD (Strict 1:1)': 'Trust CAD units (strict 1:1)',
            'Khớp Đồng Dạng AI (No Distortion)': 'AI proportion match (no distortion)',
            'Báo Cáo Thẩm Định Tỷ Lệ:': 'Scale validation report:',
            '🟢 ĐẠT CHUẨN': '🟢 PASS',
            'Đơn vị:': 'Units:',
            'Hệ số Scale:': 'Scale factor:',
            'Kích thước đo:': 'Measured dimensions:',
            'Sai lệch chuẩn:': 'Standard deviation:',
            'Vỏ ngoài chống lag:': 'Optimized outer shell:',
            'Đã tối ưu 60 FPS': 'Optimized for 60 FPS',
            'Hỗ trợ trực tiếp các định dạng thiết kế máy in 3D & CAD công nghiệp:': 'Directly supports 3D-printing and industrial CAD formats:',
            '. Hệ thống sẽ tự động chuẩn hóa tỷ lệ mét, căn tâm và tạo cạnh sắc nét.': '. The system normalizes metric scale, centres the model and sharpens edges.',
            'Màu Sơn CAD:': 'CAD material colour:',
            '⚙️ Tạo Mẫu Khối Cơ Khí In 3D (Demo STL)': '⚙️ Create a mechanical 3D-print demo (STL)',
            '💾 Lưu Vào Thư Viện 3D': '💾 Save to 3D library',
            'Tải lên': 'Upload',
            '(Kiện hàng máy móc, Xe cộ, Tàu thuyền, Ngáng cẩu...). Hệ thống sẽ tự động tách nền, quét biên dạng 3D (Silhouette & Depth Relief Extrusion) kết hợp AI để dựng thành mô hình 3D tương ứng.': '(Machinery, vehicles, vessels, spreaders, and more.) The system removes the background, detects the silhouette and depth, then uses AI to build a corresponding 3D model.',
            '1 tấm hình chụp vật thể': 'one photo of the object',
            'Độ dày đùn khối 3D (Depth):': '3D extrusion depth:',
            'Ngưỡng tách nền (Threshold):': 'Background removal threshold:',
            '🤖 AI Nhận Diện & Tối Ưu Khối 3D': '🤖 AI recognition and 3D optimization',
            '💾 Lưu Mô Hình Vào Thư Viện': '💾 Save model to library',
            'Xưởng Ghép Tổ Hợp & Tùy Biến 3D': '3D assembly and customization workshop',
            'Đặt Tên Kiện Hàng Tổ Hợp 3D:': 'Name this 3D assembly:',
            'Mẫu Tổ Hợp Thực Tế Khuyên Dùng:': 'Recommended real-world assemblies:',
            '1 Click nạp trọn bộ': 'Load complete setup in one click',
            '📦 Flat Rack 20ft + Máy Biến Áp Điện Lực 45T': '📦 20 ft flat rack + 45 t power transformer',
            '🚜 Sàn Kê Platform 40ft + Máy Xúc Bánh Xích 32T': '🚜 40 ft platform + 32 t crawler excavator',
            '🪵 Sàn Kê Platform 20ft + 2 Kiện Thùng Gỗ Nặng': '🪵 20 ft platform + two heavy timber crates',
            '🛢️ Flat Rack 40ft + Bồn Áp Lực Nằm Ngang 35T': '🛢️ 40 ft flat rack + 35 t horizontal pressure vessel',
            '🚗 Container Hở Mái 20ft + Xe Bán Tải SUV': '🚗 20 ft open-top container + pickup / SUV',
            '🛠️ [Tự Tạo Mới Từ Đầu — Blank Canvas]': '🛠️ [Start from scratch — blank canvas]',
            'Sàn Kê Platform Deck': 'Platform deck',
            'Container Hở Mái (Open Top)': 'Open-top container',
            'Container Kín (Dry Container)': 'Dry container',
            'Máy Biến Áp (Transformer)': 'Transformer',
            'Máy Xúc Bánh Xích (Excavator)': 'Crawler excavator',
            'Bồn Áp Lực (Pressure Vessel)': 'Pressure vessel',
            'Kiện Thùng Gỗ / Khung Thép (Crate)': 'Timber crate / steel frame',
            'Tua-bin Điện Gió (Wind Nacelle)': 'Wind turbine nacelle',
            'Vehicle (Xe bus / Xe cơ giới)': 'Vehicle (bus / heavy machinery)',
            'Tàu Thủy / Vỏ Tàu (Vessel Hull)': 'Vessel hull',
            'Cụm Thiết Bị Siêu Trường (OOG Skid)': 'Out-of-gauge equipment skid',
            '➕ Thêm Kiện': '➕ Add cargo',
            '📊 THÔNG SỐ VẬT THỂ TỔ HỢP:': '📊 ASSEMBLY OBJECT DATA:',
            '📐 Kích thước phủ bì:': '📐 Overall dimensions:',
            '⚖️ Trọng tâm CoG:': '⚖️ Centre of gravity (CoG):',
            '⚓ Điểm móc cẩu:': '⚓ Lifting points:',
            '4 Gù đúc ISO tiêu chuẩn': '4 standard ISO corner castings',
            '🟢 Cân bằng tốt': '🟢 Well balanced',
            'Lưu Thư Viện & Cẩu': 'Save to library and crane',
            'Giữ Ctrl + kéo khung chuột để chọn nhiều thiết bị. Shift + kéo để xoay góc camera. Cuộn panel để chỉnh thông số.': 'Hold Ctrl and drag a box to select multiple items. Shift-drag to rotate the camera. Scroll the panel to adjust parameters.',
            'Kiểm Định An Toàn Quốc Tế': 'International safety checks',
            'Đánh Giá Tổng Thể:': 'Overall assessment:',
            '🟢 ĐẠT CHUẨN ASME / ISO': '🟢 COMPLIES WITH ASME / ISO',
            'Kiểm tra tự động thời gian thực': 'Real-time automatic checks',
            '📋 Xuất Hồ Sơ Lift Plan': '📋 Export lift plan',
            'Xếp Khối Phương Án': 'Lift plan sequence',
            'Danh sách trên → dưới · nối 3D trực tiếp': 'Top-to-bottom list · linked directly to the 3D view',
            '✅ Áp dụng & đóng': '✅ Apply and close',
            '← Chọn tầng · 3D cập nhật bên này': '← Select a tier · 3D updates here',
            '🔄 Đồng Bộ Hiện Trường 3D': '🔄 Sync with 3D jobsite',
            '📋 Chép JSON': '📋 Copy JSON',
            '💾 Tải JSON': '💾 Download JSON',
            '🖨️ In / Xuất PDF': '🖨️ Print / export PDF',
            '📄 Bản Báo Cáo Kỹ Thuật (Executive Report)': '📄 Engineering report',
            '💻 Dữ Liệu Gốc JSON (Schema)': '💻 Source JSON data (schema)',
            'Camera · Góc nhìn': 'Camera · Viewpoint',
            '1. Góc nhìn cố định': '1. Fixed viewpoints',
            'Chọn góc cố định sẽ chuyển sang chế độ': 'Selecting a fixed viewpoint switches to',
            'trên thanh Cam dưới.': 'the matching camera mode below.',
            '2. Điểm focus (khi Auto / Góc)': '2. Focus target (Auto / Angle modes)',
            'Tự động (kiện + móc)': 'Automatic (cargo + hook)',
            'Trọng tâm CoG': 'Centre of gravity (CoG)',
            'Tâm kiện': 'Cargo centre',
            'Đỉnh kiện': 'Cargo top',
            'Móc cẩu': 'Crane hook',
            'Tai cẩu LP1': 'Pad-eye LP1',
            'Tai cẩu LP2': 'Pad-eye LP2',
            'Tai cẩu LP3': 'Pad-eye LP3',
            'Tai cẩu LP4': 'Pad-eye LP4',
            'Tọa độ tùy chỉnh…': 'Custom coordinates…',
            '= cinematic tự xoay ·': '= cinematic auto-rotation ·',
            '= đứng yên ·': '= stationary ·',
            '= mỗi lần nhấn sang góc tiếp theo (12 góc quanh kiện) ·': '= each click advances to the next of 12 views around the cargo ·',
            '= flycam chuyên nghiệp, xoay liên tục quanh kiện.\n                Điều khiển nhanh ở hàng': '= professional flycam, continuously orbiting the cargo.\n                Quick controls are in the row',
            'dưới cùng.': 'at the bottom.',
            'Tùy Chọn Hiển Thị 3D': '3D display options',
            'Tất Cả': 'All',
            'Ẩn Hết': 'Hide all',
            'Lực kéo từng nhánh cáp': 'Tension in each sling leg',
            'Góc giữa các cáp (β, α)': 'Sling angles (β, α)',
            'Góc nền, vạch vàng & đỏ': 'Ground plane and guide lines',
            'Chịu lực móc cẩu & Cao độ Y': 'Hook load and elevation Y',
            'Chịu lực ma ní & Điểm neo LP': 'Shackle loads and lifting points',
            'Chiều dài cáp & Tăng đơ (ΔL)': 'Sling length and turnbuckles (ΔL)',
            'Trọng tâm kiện hàng (CoG)': 'Cargo centre of gravity (CoG)',
            'Mũi tên véc-tơ lực 3D': '3D force vectors',
            'Nét vẽ khung viền CAD': 'CAD edge outlines',
            'Bảng số liệu kỹ thuật (HUD)': 'Engineering data HUD',
            'Đồ Họa & Môi Trường CAE': 'CAE graphics and environment',
            'Ánh sáng & Môi trường:': 'Lighting and environment:',
            '🌤️ Theo Giờ Việt Nam (Thời Gian Thực)': '🌤️ Vietnam local time (real-time)',
            '☁️ Bãi Thử Nghiệm (Day)': '☁️ Test yard (day)',
            '📄 Bản Vẽ CAD (Print)': '📄 CAD drawing (print)',
            '🌅 Chiều Nắng Hoàng Hôn': '🌅 Sunset',
            '🌃 Xưởng Đêm Chiếu Sáng': '🌃 Illuminated night workshop',
            'Chất lượng đồ họa CAE:': 'CAE graphics quality:',
            '💎 Ultra (Chi tiết cao nhất)': '💎 Ultra (maximum detail)',
            '⚡ High (1080p / Cân bằng ~60 FPS)': '⚡ High (1080p / balanced ~60 FPS)',
            '📐 Studio (Kỹ thuật CAD)': '📐 Studio (engineering CAD)',
            '🔋 Performance (Máy yếu)': '🔋 Performance (low-end device)',
            'Tải file HDRI ngoài:': 'Load external HDRI:',
            '🌆 Chọn File HDRI': '🌆 Choose HDRI file',
            '📋 Hồ Sơ Kỹ Thuật & Thư Viện': '📋 Engineering documents and library',
            'Kiểm Định An Toàn (ASME/ISO)': 'Safety checks (ASME / ISO)',
            'Hồ Sơ Lift Plan ASME P30.1': 'ASME P30.1 lift plan',
            'Tạo Phương Án Kéo (Wizard)': 'Lift plan wizard',
            'Xuất Báo Cáo PDF': 'Export PDF report',
            'Thư Viện 3D & Upload CAD': '3D library and CAD upload',
            '⚙️ Cài Đặt Hệ Thống': '⚙️ System settings',
            'Âm thanh (M):': 'Sound (M):',
            'Ngôn ngữ:': 'Language:',
            'Hệ đo lường:': 'Units:',
            '📏 m (Mét)': '📏 m (metric)',
            'Toàn màn hình (H):': 'Fullscreen (H):',
            'Tời:': 'Hoist:',
            'SẴN SÀNG': 'READY',
            '📊 CHỈ SỐ TẢI & AN TOÀN': '📊 LOAD & SAFETY INDICATORS',
            'Chỉ Số Tải & An Toàn': 'Load & Safety Indicators',
            '🟢 AN TOÀN NỀN': '🟢 GROUND SAFE',
            '🟡 CẢNH BÁO NỀN YẾU': '🟡 WEAK GROUND WARNING',
            '🟢 GIÓ AN TOÀN (CẤP 3)': '🟢 WIND SAFE (BEAUFORT 3)',
            'CHUẨN AN TOÀN': 'WITHIN LIMITS',
            'Đang kéo trực tiếp Trọng Tâm (CoG) 3D của kiện hàng...': 'Dragging the cargo centre of gravity (CoG) in 3D…',
            'Đang kéo trực tiếp Điểm Neo LP': 'Dragging lifting point LP',
            ' trên mặt kiện hàng...': ' on the cargo surface…',
            'Đang kéo xoay hướng kiện hàng trên nền đất...': 'Rotating cargo orientation on the ground…',
            'Chưa thiết lập trạng thái ban đầu (Hãy bấm Đặt Mốc Đầu trước)': 'Initial state not set (click Set Home first)',
            'Hạ đất — hạ êm từ từ theo tốc độ cài đặt đến khi kiện chạm đất an toàn.': 'Set down — lower smoothly at the configured speed until the cargo lands safely.',
            'Nhấc thử — nâng kiện êm ái đến 3.0 m cách đất rồi giữ treo.': 'Trial lift — smoothly hoist the cargo to 3.0 m clearance and hold it suspended.',
            '🟡 CẢNH BÁO AN TOÀN': '🟡 SAFETY WARNING',
            'Móc cứng (chọn cẩu)': 'Rigid hook (select a crane)',
            'móc cứng (chọn cẩu)': 'rigid hook (select a crane)',
            'Khô': 'Dry',
            'Rất lớn': 'Very heavy',
            'Mưa lớn': 'Heavy rain',
            'Mưa vừa': 'Moderate rain',
            'Đang chọn:': 'Selected:',
            'Đang chọn cáp': 'Selected sling',
            'Cảnh báo': 'Warning',
            'Quá tải cẩu': 'Crane overload',
            'Đạt chuẩn': 'Within limits',
            'Bật âm thanh mô phỏng (M)': 'Enable simulation audio (M)',
            'Tắt âm thanh mô phỏng (M)': 'Mute simulation audio (M)',
            'Auto — đưa kiện về góc cinematic rule-of-thirds (1/3), dễ nhìn nhất': 'Auto — frame the cargo using the cinematic rule of thirds',
            'Giữ — camera đứng yên tại góc hiện tại': 'Hold — keep the camera at its current angle',
            'Góc — mỗi lần nhấn chuyển 1/12 góc cinematic quanh kiện (chiều kim đồng hồ)': 'Angle — each click advances clockwise to the next of 12 cinematic views',
            'Flycam — giả lập góc quay bay chuyên nghiệp, xoay liên tục quanh kiện': 'Flycam — professional aerial view orbiting continuously around the cargo',
            'Hạ nhanh 1.0m': 'Lower quickly by 1.0 m',
            'Hạ nhích 0.2m': 'Lower gradually by 0.2 m',
            'Kéo nhích 0.2m': 'Hoist gradually by 0.2 m',
            'Kéo nhanh 1.0m': 'Hoist quickly by 1.0 m',
            'Độ cao chuẩn (10.1m)': 'Standard height (10.1 m)',
            'Hạ thử sát đất 200mm': 'Lower to 200 mm above ground',
            'Tốc độ hoist (nâng/hạ kiện) — hook & spreader dùng chung': 'Hoist speed — shared by hook and spreader',
            'Tốc độ nâng/hạ kiện — hook & spreader cùng một tốc độ (1× ≈ 0.22 m/s)': 'Cargo hoist/lowering speed — hook and spreader move together (1× ≈ 0.22 m/s)',
            'Góc nhìn camera 3D & Chế độ bám': '3D camera views and tracking modes',
            'Tùy chọn ẩn/hiện CAD, X-Ray, véc-tơ lực và các chỉ số kỹ thuật 3D': 'Show or hide CAD, X-ray, force vectors and 3D engineering data',
            'Cấu hình đồ họa & Ánh sáng môi trường CAE': 'CAE graphics and environment lighting settings',
            'Hồ sơ Lift Plan, Tiêu chuẩn an toàn & Thư viện 3D': 'Lift plans, safety standards and 3D library',
            'Cài đặt hệ thống, đơn vị, âm thanh & toàn màn hình': 'System, units, audio and fullscreen settings',
            'Tạo phương án kéo hàng theo trình tự câu hỏi — dựng 3D trực tiếp': 'Build a lift plan with a guided workflow and live 3D preview',
            'Mở/Đóng Bảng Thông Số Kỹ Thuật (Phím 1-6 / Esc)': 'Open or close the engineering panels (keys 1–6 / Esc)',
            'Hệ số tải động cáp cẩu (lực căng cáp cẩu / tải tĩnh) · đỉnh': 'Hoist-rope dynamic amplification factor (peak rope tension / static load)',
            'Lực khí động thực tế lên kiện hàng (gió + mưa biến thiên) và góc dạt đo được': 'Measured wind and rain loads on cargo and resulting drift angle',
            'Khôi phục trạng thái xuất phát ban đầu': 'Restore the initial state',
            'Đóng bảng hiệu chỉnh (Phím Esc)': 'Close the adjustment panel (Esc)',
            'Tạo phương án kéo theo trình tự câu hỏi': 'Create a lift plan using the guided workflow',
            'Đặt lại góc xoay về 0° chuẩn': 'Reset orientation to the 0° datum',
            'Chọn hướng của Dầm/Spreader khi kiện xoay': 'Set beam/spreader orientation as the cargo rotates',
            'Dầm giữ nguyên hướng cẩu (0°), kiện xoay lệch góc để mô phỏng kéo xiên': 'Keep the beam aligned with the crane (0°) while the cargo skews to simulate an angled lift',
            'Dầm tự động xoay song song theo kiện hàng': 'Automatically keep the beam parallel to the cargo',
            'Móc xoay được thì bộ treo theo mặt phẳng cáp; khóa móc thì dao động xoắn phụ thuộc chiều dài cáp': 'With a swivel hook, the rig follows the sling plane; with a locked hook, torsional response depends on sling length',
            'Móc có bạc đạn xoay — bộ nâng theo kiện khi kéo xiên': 'Swivel-bearing hook — rig follows the cargo during an angled pull',
            'Móc khóa hướng — lắc/xoắn chủ yếu qua chiều dài cáp': 'Orientation-locked hook — swing and twist depend mainly on sling length',
            'Click hoặc kéo trên sơ đồ mặt bằng để đặt nhanh Trọng tâm CoG': 'Click or drag on the plan view to position the CoG',
            'Tự động căn chỉnh chiều dài dầm khớp với bề rộng kiện hàng (đảm bảo cáp dưới thả đứng 90°)': 'Automatically fit beam length to cargo width so the lower slings hang vertically',
            'Twistlock gắp trực tiếp trên nóc container': 'Direct pick from container top twistlocks',
            'Ma ní + cáp/xích từ ngáng xuống tai kiện': 'Shackle and sling/chain from spreader to cargo pad-eye',
            'Quy cách chuẩn Container 40ft (12.2m)': 'Standard 40 ft container length (12.2 m)',
            'Góc xoay kiện trên nền đất': 'Cargo ground orientation',
            'Đóng': 'Close',
            'Giảm 15°': 'Decrease by 15°',
            'Giảm 5°': 'Decrease by 5°',
            'Tăng 5°': 'Increase by 5°',
            'Tăng 15°': 'Increase by 15°',
            'Giảm 1.0m': 'Decrease by 1.0 m',
            'Giảm 0.2m': 'Decrease by 0.2 m',
            'Giảm 50mm': 'Decrease by 50 mm',
            'Tăng 50mm': 'Increase by 50 mm',
            'Tăng 0.2m': 'Increase by 0.2 m',
            'Tăng 1.0m': 'Increase by 1.0 m',
            'Giảm 0.5m': 'Decrease by 0.5 m',
            'Giảm 0.1m': 'Decrease by 0.1 m',
            'Tăng 0.1m': 'Increase by 0.1 m',
            'Tăng 0.5m': 'Increase by 0.5 m',
            'Lower Leg L2-1 (Đầu Dầm Trái ➔ Lug LP1)': 'Lower leg L2-1 (left beam end ➔ pad-eye LP1)',
            'Lower Leg L2-2 (Đầu Dầm Phải ➔ Lug LP2)': 'Lower leg L2-2 (right beam end ➔ pad-eye LP2)',
            'Lower Leg L2-3 (Đầu Dầm Phải ➔ Lug LP3)': 'Lower leg L2-3 (right beam end ➔ pad-eye LP3)',
            'Lower Leg L2-4 (Đầu Dầm Trái ➔ Lug LP4)': 'Lower leg L2-4 (left beam end ➔ pad-eye LP4)',
            'Chuyển ngôn ngữ sang Tiếng Anh': 'Switch language to English',
            'Chuyển đổi Mét (m) ⇄ Feet (ft)': 'Switch between metres (m) and feet (ft)',
            'Mặc định gần hook — số chẵn 8 m': 'Near-hook default — even 8 m length',
            'Cáp trên 10 m — số chẵn': 'Upper sling 10 m — even length',
            'Cáp dưới mặc định — số chẵn 2 m': 'Lower sling default — even 2 m length',
            'Cáp dưới 4 m — số chẵn': 'Lower sling 4 m — even length',
            'Xuất vật thể 3D hiện tại thành file Wavefront .OBJ chuẩn công nghiệp để lưu trữ hoặc đưa sang phần mềm CAD/3D khác': 'Export the current 3D object as an industry-standard Wavefront .OBJ for archiving or use in other CAD/3D software',
            'VD: Turbine Điện Gió 65T...': 'e.g. 65 t wind turbine…',
            'Dùng AI nhận diện vật thể trong ảnh và tối ưu cấu trúc 3D + thông số tải trọng': 'Use AI to identify the object and optimize its 3D structure and load data',
            'Xóa toàn bộ để làm lại từ đầu': 'Clear everything and start over',
            'Đặt lại thông số mặc định theo tiêu chuẩn': 'Restore standard defaults',
            'Cắt cáp mô phỏng đứt nhánh': 'Cut a sling to simulate failure',
            'Nối lại cáp đã đứt': 'Reeve the broken sling',
            'Đồng bộ lại stack 3D': 'Resynchronize the 3D stack',
            'Cập nhật lại số liệu theo hiện trường 3D hiện tại': 'Refresh values from the current 3D jobsite',
            'Sao chép dữ liệu JSON vào Clipboard': 'Copy JSON data to clipboard',
            'Tải file .liftplan.json về máy tính': 'Download the .liftplan.json file',
            'In hoặc Xuất file PDF hồ sơ chuẩn quốc tế': 'Print or export the international-standard report as PDF',
            'Điểm camera bám theo': 'Camera tracking target',
            'Tải file môi trường HDRI riêng (.hdr / .exr)': 'Load a custom HDRI environment (.hdr / .exr)',
            'Lower Leg L2-1 (Đầu Dầm Trái ➔ Lug LP1)': 'Lower leg L2-1 (left beam end ➔ pad-eye LP1)',
            'Lower Leg L2-2 (Đầu Dầm Phải ➔ Lug LP2)': 'Lower leg L2-2 (right beam end ➔ pad-eye LP2)',
            'Lower Leg L2-3 (Đầu Dầm Phải ➔ Lug LP3)': 'Lower leg L2-3 (right beam end ➔ pad-eye LP3)',
            'Lower Leg L2-4 (Đầu Dầm Trái ➔ Lug LP4)': 'Lower leg L2-4 (left beam end ➔ pad-eye LP4)',
            'Góc kéo thấp nhất trong dải làm việc β = 40° (tải cáp cao hơn) — tiết kiệm headroom; gear được chọn theo MBL/WLL/SWL tại β=40°': 'Minimum working angle β = 40° (higher sling load) — saves headroom; gear is selected by MBL/WLL/SWL at β = 40°',
            'Áp dụng mặc định làm việc: góc kéo β = 50° (dải 40–55°), cáp trên 8/10 m, cáp dưới 2/4 m (số chẵn); gear tự chọn theo WLL/SWL/MBL': 'Apply recommended setup: β = 50° (40–55° range), upper slings 8/10 m, lower slings 2/4 m; gear selected by WLL/SWL/MBL',
            'Tự động tính quy cách theo WLL chuẩn ASME/EN': 'Automatically size to ASME/EN WLL',
            'Ngưỡng cảnh báo 75%': '75% warning threshold',
            'Ngưỡng Cẩu Nguy Hiểm ASME P30.1 (85%)': 'ASME P30.1 crane danger threshold (85%)',
            'Chuyển ngôn ngữ sang Tiếng Việt': 'Switch language to Vietnamese',
            'Các trang hiệu chỉnh': 'Adjustment panels'
        });

        function libText(s) {
            if (!s) return '';
            if (state.lang !== 'en') return s;
            return UI_EN[s] || s;
        }

        const UI_VI = Object.entries(UI_EN).reduce((dict, [vi, en]) => {
            // Keep the first Vietnamese phrase for duplicate English labels.
            if (!Object.prototype.hasOwnProperty.call(dict, en)) dict[en] = vi;
            return dict;
        }, Object.create(null));

        function applyTextTranslation(node) {
            const raw = node && node.nodeValue;
            if (!raw || !raw.trim()) return;
            const phrase = raw.trim();
            const normalized = phrase.replace(/\s+/g, ' ');
            if (!node.__vi) {
                node.__vi = UI_EN[phrase] ? phrase
                    : (UI_EN[normalized] ? normalized
                        : (UI_VI[phrase] || UI_VI[normalized] || phrase));
            }
            const en = UI_EN[node.__vi];
            if (!en) return;
            const lead = raw.match(/^\s*/)[0];
            const tail = raw.match(/\s*$/)[0];
            const translated = lead + (state.lang === 'en' ? en : node.__vi) + tail;
            if (raw !== translated) node.nodeValue = translated;
        }

        const I18N_ATTRIBUTES = [
            ['title', 'viTitle'],
            ['placeholder', 'viPlaceholder'],
            ['aria-label', 'viAriaLabel'],
            ['alt', 'viAlt']
        ];

        function applyAttributeTranslations(el) {
            I18N_ATTRIBUTES.forEach(([attribute, sourceKey]) => {
                const current = el.getAttribute(attribute);
                if (!current) return;
                if (!el.dataset[sourceKey]) {
                    el.dataset[sourceKey] = UI_EN[current] ? current : (UI_VI[current] || current);
                }
                const translated = UI_EN[el.dataset[sourceKey]];
                if (translated) {
                    const value = state.lang === 'en' ? translated : el.dataset[sourceKey];
                    if (current !== value) el.setAttribute(attribute, value);
                }
            });
        }

        function applyPhrases(root) {
            const walker = document.createTreeWalker(root || document.body, NodeFilter.SHOW_TEXT);
            const nodes = [];
            while (walker.nextNode()) nodes.push(walker.currentNode);
            nodes.forEach(applyTextTranslation);
            (root || document.body).querySelectorAll('[title], [placeholder], [aria-label], [alt]').forEach(applyAttributeTranslations);
        }

        let localeObserverStarted = false;
        function observeLiveTranslations() {
            if (localeObserverStarted || typeof MutationObserver === 'undefined' || !document.body) return;
            localeObserverStarted = true;
            const observer = new MutationObserver(records => {
                records.forEach(record => {
                    if (record.type === 'characterData') {
                        applyTextTranslation(record.target);
                        return;
                    }
                    if (record.type === 'attributes') {
                        applyAttributeTranslations(record.target);
                        return;
                    }
                    record.addedNodes.forEach(node => {
                        if (node.nodeType === Node.TEXT_NODE) {
                            applyTextTranslation(node);
                        } else if (node.nodeType === Node.ELEMENT_NODE) {
                            applyPhrases(node);
                        }
                    });
                });
            });
            observer.observe(document.body, {
                subtree: true,
                childList: true,
                characterData: true,
                attributes: true,
                attributeFilter: ['title', 'placeholder', 'aria-label', 'alt']
            });
        }

        function applyLang() {
            applyPhrases(document.body);
            observeLiveTranslations();
            const api = (typeof window !== 'undefined' && window.SafeLift && window.SafeLift.i18n) ? window.SafeLift.i18n : null;
            if (api && typeof api.setLang === 'function') api.setLang(state.lang);
            if (api && typeof api.applyDataI18n === 'function') {
                api.applyDataI18n(document);
            } else {
                document.querySelectorAll('[data-i18n]').forEach(el => { el.textContent = bi(el.dataset.i18n); });
            }
            document.querySelectorAll('[data-i18n-title]').forEach(el => {
                if (el.dataset.i18nTitle) el.setAttribute('title', bi(el.dataset.i18nTitle));
            });
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
            if (langBtn) {
                langBtn.textContent = state.lang === 'vi' ? 'EN' : 'VI';
                const viAction = state.lang === 'vi' ? 'Chuyển ngôn ngữ sang Tiếng Anh' : 'Chuyển ngôn ngữ sang Tiếng Việt';
                const enAction = state.lang === 'vi' ? 'Switch language to English' : 'Switch language to Vietnamese';
                langBtn.setAttribute('aria-label', state.lang === 'vi' ? viAction : enAction);
                // Keep the translation source aligned when this label changes its action target.
                langBtn.dataset.viAriaLabel = viAction;
                langBtn.dataset.viTitle = viAction;
                langBtn.title = langBtn.getAttribute('aria-label');
            }
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
            if (typeof syncOogCargoUI === 'function') syncOogCargoUI(false);
            if (typeof document !== 'undefined' && typeof window !== 'undefined' && window.SafeLift?.cargoDerivedLast) {
                const dynEl = document.querySelector('[data-i18n-dynamic="cargo-derived"]');
                const fmt = window.SafeLift.i18n?.formatCargoDerivedLabel;
                if (dynEl && typeof fmt === 'function') {
                    dynEl.textContent = fmt({ ...window.SafeLift.cargoDerivedLast, lang: state.lang });
                }
            }
            if (state.gear.selection.length) openGearEditor();
            if (typeof updateUnitDisplayElements === 'function') updateUnitDisplayElements();
            if (typeof syncCableControlsSelection === 'function') syncCableControlsSelection();
            if (typeof syncSlingSlidersFromState === 'function') syncSlingSlidersFromState();
            syncDrawerHeaderLanguage();
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
                const api = (typeof window !== 'undefined' && window.SafeLift && window.SafeLift.i18n) ? window.SafeLift.i18n : null;
                if (api && typeof api.toggleLang === 'function') {
                    state.lang = api.toggleLang();
                } else {
                    state.lang = state.lang === 'vi' ? 'en' : 'vi';
                }
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
                    if (state.beamType !== 'none' && state.lowerSlingLength == null) {
                        const specNew = (typeof getRigSpec === 'function') ? getRigSpec() : null;
                        const recL = (specNew && specNew.recLower) || 2.0;
                        state.lowerSlingLength = recL;
                        if (state.gear && state.gear.legs) {
                            state.gear.legs.forEach(l => {
                                if (l) { l.lengthM = recL; l.userSet = true; }
                            });
                        }
                    }

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
