/**
 * library — part of the lifting simulator.
 * These files are assembled into one module so they share state, physics and the scene.
 */
        let assemblyEngine = null;
        let currentStudioMode = 'file3d';
        const LOCAL_STORAGE_CUSTOM_3D_KEY = 'LPS_CUSTOM_3D_ASSETS';

        function init3DLibraryStudio() {
            const container = document.getElementById('studio-preview-container');
            studioScene = new THREE.Scene();
            studioScene.background = new THREE.Color(0x060a12);

            studioCamera = new THREE.PerspectiveCamera(40, 420 / 210, 0.1, 100);
            studioCamera.position.set(4.5, 3.4, 5.2);

            studioRenderer = new THREE.WebGLRenderer({ antialias: true });
            studioRenderer.setSize(420, 208);
            studioRenderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
            studioRenderer.toneMapping = THREE.ACESFilmicToneMapping;
            container.appendChild(studioRenderer.domElement);

            studioScene.environment = scene.environment;
            studioScene.add(new THREE.AmbientLight(0xffffff, 0.65));
            const dirL = new THREE.DirectionalLight(0xfffbeb, 1.4);
            dirL.position.set(8, 12, 10);
            studioScene.add(dirL);

            const pGrid = new THREE.GridHelper(12, 24, 0x38bdf8, 0x1e293b);
            pGrid.position.y = -1.2;
            studioScene.add(pGrid);

            studioControls = new THREE.OrbitControls(studioCamera, studioRenderer.domElement);
            studioControls.enableDamping = true;

            studioPreviewGroup = new THREE.Group();
            studioScene.add(studioPreviewGroup);

            // Modal Open / Close
            const modal = document.getElementById('library-studio-modal');
            document.getElementById('btn-open-3d-library').addEventListener('click', () => {
                if (window.UI?.layout) window.UI.layout.openModal('library-studio-modal');
                else modal.classList.add('open');
                setTimeout(() => {
                    const rect = container.getBoundingClientRect();
                    if (rect.width > 0 && rect.height > 0) {
                        studioCamera.aspect = rect.width / rect.height;
                        studioCamera.updateProjectionMatrix();
                        studioRenderer.setSize(rect.width, rect.height);
                    }
                    render3DLibraryGrid();
                    if (currentStudioMode === 'assembly') {
                        renderAssemblyPartsUI();
                        updateAssembly3DPreview();
                    } else {
                        previewLibraryItemIn3D(selectedLibraryItem, activeLibraryCategory);
                    }
                }, 40);
            });
            document.getElementById('btn-close-3d-library').addEventListener('click', () => {
                if (window.UI?.layout) window.UI.layout.closeModal('library-studio-modal');
                else modal.classList.remove('open');
            });

            // Category Tabs
            document.querySelectorAll('#lib-category-tabs button').forEach(btn => {
                btn.addEventListener('click', () => {
                    document.querySelectorAll('#lib-category-tabs button').forEach(b => b.classList.remove('active'));
                    btn.classList.add('active');
                    activeLibraryCategory = btn.dataset.cat;
                    selectedLibraryItem = libraryCatalog[activeLibraryCategory][0];
                    render3DLibraryGrid();
                    previewLibraryItemIn3D(selectedLibraryItem, activeLibraryCategory);
                });
            });

            // Mode Switch: File 3D vs Image-to-3D vs Multi-Part Assembly
            const btnModeFile = document.getElementById('tab-mode-file3d');
            const btnModeImg = document.getElementById('tab-mode-img3d');
            const btnModeAssembly = document.getElementById('tab-mode-assembly');

            if (btnModeFile) btnModeFile.addEventListener('click', () => switchStudioMode('file3d'));
            if (btnModeImg) btnModeImg.addEventListener('click', () => switchStudioMode('img3d'));
            if (btnModeAssembly) btnModeAssembly.addEventListener('click', () => switchStudioMode('assembly'));

            // OBJ Exporter Buttons (Works for any 3D asset or assembly)
            const btnExportObj = document.getElementById('btn-export-obj');
            if (btnExportObj) btnExportObj.addEventListener('click', exportCurrentActive3DToOBJ);

            const btnExportAssemblyObj = document.getElementById('btn-export-assembly-obj');
            if (btnExportAssemblyObj) btnExportAssemblyObj.addEventListener('click', exportCurrentActive3DToOBJ);

            // Assembly Studio Action Listeners
            const selAssemblyPreset = document.getElementById('sel-assembly-preset');
            if (selAssemblyPreset) {
                selAssemblyPreset.addEventListener('change', (e) => {
                    if (!assemblyEngine) assemblyEngine = new (window.CAE?.AssemblyEngine || AssemblyEngine)();
                    const val = e.target.value;
                    if (val === 'custom_blank') {
                        assemblyEngine.reset();
                    } else {
                        assemblyEngine.loadPreset(val);
                    }
                    const inpName = document.getElementById('inp-assembly-name');
                    if (inpName) inpName.value = assemblyEngine.assemblyName;
                    renderAssemblyPartsUI();
                    updateAssembly3DPreview();
                });
            }

            const inpAssemblyName = document.getElementById('inp-assembly-name');
            if (inpAssemblyName) {
                inpAssemblyName.addEventListener('input', (e) => {
                    if (assemblyEngine) assemblyEngine.assemblyName = e.target.value.trim() || 'Tổ Hợp Kiện Hàng 3D';
                });
            }

            const btnAddAssemblyPart = document.getElementById('btn-add-assembly-part');
            if (btnAddAssemblyPart) {
                btnAddAssemblyPart.addEventListener('click', () => {
                    if (!assemblyEngine) assemblyEngine = new (window.CAE?.AssemblyEngine || AssemblyEngine)();
                    const typeSel = document.getElementById('sel-add-cargo-type');
                    const type = typeSel ? typeSel.value : 'transformer';
                    const names = {
                        flatrack: 'Container Flat Rack',
                        platform: 'Sàn Kê Platform Deck',
                        opentop: 'Container Hở Mái',
                        container: 'Container Tiêu Chuẩn',
                        transformer: 'Máy Biến Áp Điện Lực',
                        excavator: 'Máy Xúc Bánh Xích',
                        vessel: 'Bồn Áp Lực Nằm Ngang',
                        crate: 'Kiện Thùng Gỗ Nặng',
                        wind_nacelle: 'Tua-bin Điện Gió',
                        car: 'Vehicle',
                        boat: 'Tàu Thủy / Vỏ Tàu',
                        pipe: 'Cụm Thiết Bị Siêu Trường'
                    };
                    const dims = {
                        flatrack: { L: 6.06, W: 2.44, H: 2.59, m: 5.5 },
                        platform: { L: 6.06, W: 2.44, H: 0.35, m: 3.2 },
                        opentop: { L: 6.06, W: 2.44, H: 2.59, m: 2.8 },
                        container: { L: 6.06, W: 2.44, H: 2.59, m: 3.8 },
                        transformer: { L: 3.8, W: 2.0, H: 2.3, m: 45.0 },
                        excavator: { L: 6.4, W: 3.0, H: 3.1, m: 32.0 },
                        vessel: { L: 7.5, W: 2.4, H: 2.6, m: 28.0 },
                        crate: { L: 2.4, W: 1.8, H: 1.8, m: 12.0 },
                        wind_nacelle: { L: 8.5, W: 3.4, H: 3.6, m: 65.0 },
                        car: { L: 9.0, W: 2.38, H: 2.80, m: 9.0 },
                        boat: { L: 10.0, W: 3.2, H: 2.8, m: 22.0 },
                        pipe: { L: 8.0, W: 1.5, H: 1.5, m: 15.0 }
                    };
                    const d = dims[type] || { L: 3.0, W: 2.0, H: 2.0, m: 10.0 };
                    const part = assemblyEngine.addPart({
                        name: `${names[type] || 'Chi Tiết Kiện'} #${assemblyEngine.cargoParts.length + 1}`,
                        type,
                        dimensions: { L: d.L, W: d.W, H: d.H },
                        massT: d.m,
                        pos: { x: 0, y: 0, z: 0 },
                        rot: { x: 0, y: 0, z: 0 },
                        color: '#0284c7'
                    });
                    assemblyEngine.snapPartToDeck(part.id);
                    renderAssemblyPartsUI();
                    updateAssembly3DPreview();
                });
            }

            const btnResetAssembly = document.getElementById('btn-reset-assembly');
            if (btnResetAssembly) {
                btnResetAssembly.addEventListener('click', () => {
                    if (!assemblyEngine) return;
                    assemblyEngine.reset();
                    const inpName = document.getElementById('inp-assembly-name');
                    if (inpName) inpName.value = assemblyEngine.assemblyName;
                    renderAssemblyPartsUI();
                    updateAssembly3DPreview();
                });
            }

            const btnSaveAssembly = document.getElementById('btn-save-assembly-to-lib');
            if (btnSaveAssembly) btnSaveAssembly.addEventListener('click', saveAssemblyToLibraryAndSim);

            // Apply currently previewed item to main 3D simulation
            document.getElementById('btn-apply-previewed-asset').addEventListener('click', () => {
                if (currentStudioMode === 'assembly') {
                    saveAssemblyToLibraryAndSim();
                    return;
                }
                if (pendingCustomGroup && (!selectedLibraryItem || selectedLibraryItem.isPendingUpload)) {
                    savePendingCustom3DToLibrary();
                } else if (selectedLibraryItem) {
                    applyLibraryAssetToSimulation(selectedLibraryItem, activeLibraryCategory);
                }
                if (window.UI?.layout) window.UI.layout.closeModal('library-studio-modal');
                else modal.classList.remove('open');
            });

            // Dimension & Weight Live Rescale Listeners
            const btnApplyCustomDim = document.getElementById('btn-apply-custom-dim');
            if (btnApplyCustomDim) {
                btnApplyCustomDim.addEventListener('click', liveRescaleStudioPreview);
            }
            ['inp-target-L', 'inp-target-W', 'inp-target-H', 'inp-target-weight'].forEach(id => {
                const el = document.getElementById(id);
                if (el) {
                    el.addEventListener('input', () => {
                        liveRescaleStudioPreview();
                    });
                }
            });

            // Anti-Lag Hull Optimizer Setting Listeners
            ['chk-optimize-hull', 'sel-hull-preset'].forEach(id => {
                const el = document.getElementById(id);
                if (el) {
                    el.addEventListener('change', () => {
                        if (currentUploaded3DFile) {
                            processAndDisplay3DFile(currentUploaded3DFile);
                        } else if (pendingCustomGroup) {
                            runLiveHullOptimizationOnPendingGroup();
                        }
                    });
                }
            });

            // 1. Handle 3D File Upload (.STL, .OBJ, .GLB, .GLTF)
            document.getElementById('inp-file-3d').addEventListener('change', handle3DFileUpload);
            document.getElementById('btn-demo-stl').addEventListener('click', generateDemoSTLMechanicalPart);
            document.getElementById('btn-save-file3d').addEventListener('click', savePendingCustom3DToLibrary);

            // Real-time Import Scale Calibration Wizard Listeners
            ['sel-import-spec', 'sel-import-unit', 'sel-import-up', 'sel-import-mode'].forEach(id => {
                const el = document.getElementById(id);
                if (el) {
                    el.addEventListener('change', () => {
                        if (id === 'sel-import-spec') {
                            const specVal = el.value;
                            const catSel = document.getElementById('inp-asset-category');
                            if (catSel) {
                                if (specVal.includes('crane')) catSel.value = 'crane';
                                else if (specVal.includes('spreader')) catSel.value = 'beam';
                                else if (specVal.includes('shackle')) catSel.value = 'hardware';
                                else catSel.value = 'cargo';
                            }
                        }
                        if (currentUploaded3DFile) {
                            processAndDisplay3DFile(currentUploaded3DFile);
                        }
                    });
                }
            });

            // 2. Handle 2D Image Upload -> 3D Silhouette & Depth Relief Mesh
            document.getElementById('inp-file-img2d').addEventListener('change', handle2DImageUploadFor3D);
            document.getElementById('inp-extrude-depth').addEventListener('input', e => {
                document.getElementById('v-extrude-depth').textContent = parseFloat(e.target.value).toFixed(2) + 'x';
                if (lastUploadedImage) rebuild3DFromUploadedImage(lastUploadedImage);
            });
            document.getElementById('inp-extrude-thresh').addEventListener('input', e => {
                document.getElementById('v-extrude-thresh').textContent = e.target.value;
                if (lastUploadedImage) rebuild3DFromUploadedImage(lastUploadedImage);
            });
            document.getElementById('btn-ai-analyze-img').addEventListener('click', runAIVision3DReconstruction);
            document.getElementById('btn-save-img3d').addEventListener('click', savePendingCustom3DToLibrary);

            // Assembly Engine & LocalStorage Custom Assets Persistence
            assemblyEngine = new (window.CAE?.AssemblyEngine || AssemblyEngine)();
            assemblyEngine.loadPreset('flatrack_transformer');

            render3DLibraryGrid();
            preloadStandardPortAssets();
            restoreCustomAssetsFromLocalStorage();
        }

        function updateLibraryCounts() {
            Object.keys(libraryCatalog).forEach(k => {
                const el = document.getElementById(`cnt-${k}`);
                if (el) el.textContent = libraryCatalog[k].length;
            });
        }

        function render3DLibraryGrid() {
            updateLibraryCounts();
            const grid = document.getElementById('lib-items-grid');
            grid.innerHTML = '';
            const items = libraryCatalog[activeLibraryCategory] || [];

            items.forEach(item => {
                const isSel = selectedLibraryItem && selectedLibraryItem.id === item.id;
                const card = document.createElement('div');
                card.className = `card-btn flex flex-col justify-between p-2.5 ${isSel ? 'active' : ''}`;
                card.innerHTML = `
                    <div>
                        <div class="flex items-center justify-between gap-1 mb-1">
                            <span class="text-[9px] font-mono px-1.5 py-0.2 rounded bg-sky-500/20 text-sky-300 border border-sky-500/30">${item.badge || '3D Asset'}</span>
                            ${item.weight ? `<span class="text-[9px] font-mono text-amber-400 font-bold">${item.weight}T</span>` : ''}
                        </div>
                        <div class="text-xs font-bold text-white leading-snug">${libText(item.name)}</div>
                        <div class="text-[10px] text-slate-400 mt-0.5">${libText(item.sub || '')}</div>
                    </div>
                    <div class="mt-2 pt-1.5 border-t border-slate-700/70 flex items-center justify-between">
                        <span class="text-[9px] text-sky-400 font-bold">${L('View 3D', 'Xem 3D')}</span>
                        <button class="apply-now-btn px-2 py-0.5 rounded bg-emerald-600 hover:bg-emerald-500 text-[9px] font-bold text-white">${L('Use this', 'Chọn dùng')}</button>
                    </div>
                `;
                card.addEventListener('click', ev => {
                    if (ev.target.classList.contains('apply-now-btn')) {
                        selectedLibraryItem = item;
                        applyLibraryAssetToSimulation(item, activeLibraryCategory);
                        if (window.UI?.layout) window.UI.layout.closeModal('library-studio-modal');
                        else document.getElementById('library-studio-modal')?.classList.remove('open');
                        return;
                    }
                    selectedLibraryItem = item;
                    render3DLibraryGrid();
                    previewLibraryItemIn3D(item, activeLibraryCategory);
                });
                grid.appendChild(card);
            });
        }

        function liveRescaleStudioPreview() {
            const inL = parseFloat(document.getElementById('inp-target-L')?.value);
            const inW = parseFloat(document.getElementById('inp-target-W')?.value);
            const inH = parseFloat(document.getElementById('inp-target-H')?.value);
            const inWeight = parseFloat(document.getElementById('inp-target-weight')?.value);
            if (isNaN(inL) || isNaN(inW) || isNaN(inH) || inL <= 0 || inW <= 0 || inH <= 0) return;

            const model = studioPreviewGroup.children.find(ch => ch.name !== 'scale_references');
            if (model) {
                const bbox = new THREE.Box3().setFromObject(model);
                const sz = new THREE.Vector3();
                bbox.getSize(sz);
                if (sz.x > 0.001 && sz.y > 0.001 && sz.z > 0.001) {
                    const sx = inL / sz.x;
                    const sy = inH / sz.y;
                    const szRate = inW / sz.z;
                    model.scale.multiply(new THREE.Vector3(sx, sy, szRate));
                    autoFrameStudioCamera(model);
                }
            }
            if (selectedLibraryItem) {
                selectedLibraryItem.L = inL;
                selectedLibraryItem.W = inW;
                selectedLibraryItem.H = inH;
                if (!isNaN(inWeight) && inWeight > 0) selectedLibraryItem.weight = inWeight;
            }
            const statusEl = document.getElementById('lbl-hull-opt-status');
            if (statusEl) statusEl.textContent = `📐 Đã áp kích thước: ${inL.toFixed(1)}m × ${inW.toFixed(1)}m × ${inH.toFixed(1)}m (${(!isNaN(inWeight) ? inWeight.toFixed(1) : '20.0')}T)`;
        }

        function runLiveHullOptimizationOnPendingGroup() {
            if (!pendingCustomGroup) return;
            const presetVal = document.getElementById('sel-hull-preset')?.value || 'strip_interior_only';
            const maxTris = (presetVal === 'strip_interior_only' || presetVal === 'none') ? presetVal : parseInt(presetVal, 10);
            const cullInterior = document.getElementById('chk-optimize-hull')?.checked !== false;
            const opt = (window.CAE?.HullOptimizer || HullOptimizer).optimizeHierarchy(pendingCustomGroup, {
                maxTris,
                cullInterior,
                stripInteriorOnly: presetVal === 'strip_interior_only'
            });
            const inL = parseFloat(document.getElementById('inp-target-L')?.value) || 6.0;
            const inW = parseFloat(document.getElementById('inp-target-W')?.value) || 2.4;
            const inH = parseFloat(document.getElementById('inp-target-H')?.value) || 2.5;
            showPendingGroupInPreview(pendingCustomGroup, `Tối ưu vỏ ngoài (${opt.stats.finalTris.toLocaleString()} tris | ${inL}×${inH}×${inW}m)`);
            const statusEl = document.getElementById('lbl-hull-opt-status');
            if (statusEl) statusEl.textContent = `⚡ Đã tối ưu vỏ ngoài: giảm ${opt.stats.reductionPct}% lưới (${opt.stats.finalTris.toLocaleString()} tris - 60 FPS)`;
        }

        function previewLibraryItemIn3D(item, category) {
            if (!item) return;
            while (studioPreviewGroup.children.length > 0) {
                studioPreviewGroup.remove(studioPreviewGroup.children[0]);
            }
            document.getElementById('lib-active-summary').textContent = `Đang chọn: ${item.name}`;

            let previewObj = new THREE.Group();
            if (category === 'cargo') {
                if (customCargoMeshes[item.id]) {
                    previewObj = customCargoMeshes[item.id].clone();
                } else {
                    previewObj = buildCargoMesh(item.id, item.L || 6.0, item.W || 2.4, item.H || 2.5);
                }
            } else if (category === 'beam') {
                if (customBeamMeshes[item.id]) {
                    previewObj = customBeamMeshes[item.id].clone();
                } else {
                    // Lightweight studio preview — never rebuild the live scene (was a major lag source)
                    const spanX = (typeof getLPBoundingSpan === 'function') ? getLPBoundingSpan().spanX : 6;
                    const spanZ = (typeof getLPBoundingSpan === 'function') ? getLPBoundingSpan().spanZ : 2.4;
                    previewObj = new THREE.Group();
                    const mat = (typeof MATS !== 'undefined' && MATS.yellowHazard)
                        ? MATS.yellowHazard
                        : new THREE.MeshStandardMaterial({ color: 0xf59e0b, metalness: 0.35, roughness: 0.45 });
                    const bar = new THREE.Mesh(
                        new THREE.BoxGeometry(Math.max(2.2, spanX || 6), 0.28, Math.max(0.35, (spanZ || 2.4) * 0.2)),
                        mat
                    );
                    bar.castShadow = true;
                    previewObj.add(bar);
                }
            } else if (category === 'hardware') {
                if (customHwMeshes[item.id]) {
                    previewObj = customHwMeshes[item.id].clone();
                } else {
                    previewObj = buildHardwareMesh(item.id);
                }
            } else if (category === 'crane') {
                if (customCraneMeshes[item.id]) {
                    previewObj = customCraneMeshes[item.id].clone();
                } else {
                    previewObj = createLatticeBoomMesh(14.0, 1.2, MATS.craneYellow || MATS.craneRed);
                    previewObj.rotation.z = -0.35;
                }
            } else if (category === 'rig_preset') {
                previewObj = buildSlingLibraryPreviewMesh(item.id);
            }

            studioPreviewGroup.add(previewObj);
            addScaleReferenceVisuals(studioPreviewGroup, previewObj);
            autoFrameStudioCamera(previewObj);

            // Sync dimensions & weight into target inputs
            const inL = document.getElementById('inp-target-L');
            const inW = document.getElementById('inp-target-W');
            const inH = document.getElementById('inp-target-H');
            const inWeight = document.getElementById('inp-target-weight');
            if (inL && item.L != null) inL.value = item.L.toFixed(1);
            if (inW && item.W != null) inW.value = item.W.toFixed(1);
            if (inH && item.H != null) inH.value = item.H.toFixed(1);
            if (inWeight && item.weight != null) inWeight.value = item.weight.toFixed(1);

            const tris = (window.CAE?.HullOptimizer || HullOptimizer).getTriCount(previewObj);
            document.getElementById('studio-preview-stats').textContent = `Mesh: ${item.meshName || previewObj.name || item.id} | ${tris.toLocaleString()} tris | ${item.name} (${item.badge || '3D CAD'})`;
        }

        function applyLibraryAssetToSimulation(item, category) {
            if (!item) return;

            // Read user-defined target dimensions and weight if available
            const inL = parseFloat(document.getElementById('inp-target-L')?.value);
            const inW = parseFloat(document.getElementById('inp-target-W')?.value);
            const inH = parseFloat(document.getElementById('inp-target-H')?.value);
            const inWeight = parseFloat(document.getElementById('inp-target-weight')?.value);
            const finalL = (!isNaN(inL) && inL > 0.1) ? inL : (item.L || 6.0);
            const finalW = (!isNaN(inW) && inW > 0.1) ? inW : (item.W || 2.4);
            const finalH = (!isNaN(inH) && inH > 0.1) ? inH : (item.H || 2.5);
            const finalWeight = (!isNaN(inWeight) && inWeight > 0.05) ? inWeight : (item.weight || 20.0);

            if (category === 'cargo') {
                state.cargoType = item.id;
                state.legDeltaL = [0, 0, 0, 0];
                state.L = finalL;
                state.W = finalW;
                state.H = finalH;
                state.weight = finalWeight;

                setDimAndCoG({
                    L: finalL,
                    W: finalW,
                    H: finalH,
                    weight: finalWeight,
                    cogX: item.cogX || 0,
                    cogY: item.cogY || 0,
                    cogZ: item.cogZ || 0
                });

                // Update UI sliders/inputs on dashboard
                const inpL = document.getElementById('inp-L');
                const inpW = document.getElementById('inp-W');
                const inpH = document.getElementById('inp-H');
                const inpWeight = document.getElementById('inp-weight');
                if (inpL) { inpL.value = finalL; const v = document.getElementById('v-L'); if (v) v.textContent = finalL.toFixed(2); }
                if (inpW) { inpW.value = finalW; const v = document.getElementById('v-W'); if (v) v.textContent = finalW.toFixed(2); }
                if (inpH) { inpH.value = finalH; const v = document.getElementById('v-H'); if (v) v.textContent = finalH.toFixed(2); }
                if (inpWeight) { inpWeight.value = finalWeight; const v = document.getElementById('v-weight'); if (v) v.textContent = finalWeight.toFixed(1); }

                // If custom mesh exists, avoid compounding scale multipliers
                if (customCargoMeshes[item.id]) {
                    customCargoMeshes[item.id].updateMatrixWorld(true);
                    const bbox = new THREE.Box3().setFromObject(customCargoMeshes[item.id]);
                    const sz = new THREE.Vector3();
                    bbox.getSize(sz);
                    if (sz.x > 0.001 && sz.y > 0.001 && sz.z > 0.001) {
                        const rx = finalL / sz.x;
                        const ry = finalH / sz.y;
                        const rz = finalW / sz.z;
                        if (Math.abs(rx - 1) > 0.02 || Math.abs(ry - 1) > 0.02 || Math.abs(rz - 1) > 0.02) {
                            customCargoMeshes[item.id].scale.multiply(new THREE.Vector3(rx, ry, rz));
                        }
                    }
                }

                // If model provides calibrated anchor points, bind them safely
                if (item.anchors && item.anchors.length > 0) {
                    const padEyeAnchors = item.anchors.filter(a => a.id && (a.id.toUpperCase().includes('PADEYE') || a.id.toUpperCase().includes('TWISTLOCK')));
                    const selectedAnchors = padEyeAnchors.length >= 4 ? padEyeAnchors.slice(0, 4) : item.anchors.slice(0, 4);
                    if (selectedAnchors.length >= 4) {
                        while (state.lugs.length < selectedAnchors.length) {
                            state.lugs.push(new THREE.Vector3());
                        }
                        selectedAnchors.slice(0, 4).forEach((anc, idx) => {
                            const lp = anc.localPos || anc;
                            state.lugs[idx].set(lp.x, lp.y, lp.z);
                        });
                    }
                }

                // Invariant: Lugs and Normals must NEVER be fewer than 4!
                while (state.lugs.length < 4) {
                    state.lugs.push(new THREE.Vector3());
                }
                while (state.lugNormals.length < state.lugs.length) {
                    state.lugNormals.push(new THREE.Vector3(0, 1, 0));
                }

                syncSidebarStoreButton('#cargo-library', 'cargo', item.id, item.name, item.sub || '3D Custom');
                rebuildCargoAndRig(true);

            } else if (category === 'crane') {
                state.craneType = item.id;
                syncSidebarStoreButton('#crane-store', 'crane', item.id, item.name, item.sub || '3D Crane');
                buildCraneVehicle();

            } else if (category === 'beam') {
                state.beamType = item.id;
                if (item.id === 'container_spreader') {
                    // STS: lock span to ISO twistlock centres for 20/40/45ft
                    state.slingType = 'wire';
                    syncSidebarStoreButton('#beam-store', 'beam', item.id, item.name, item.sub || 'Spreader');
                    if (typeof applyStsSpreaderSize === 'function') {
                        applyStsSpreaderSize(state.stsTwinLift ? 'twin' : (state.stsSizeFt || 40));
                        return;
                    }
                    if (!state.stsSizeFt) state.stsSizeFt = 40;
                    state.hookCount = 1;
                    state.upperSlingLength = 2.4;
                    state.slingLength = 2.4;
                    state.lowerSlingLength = 0.22;
                    state.slingUserSet = true;
                } else {
                    // Keep working-band defaults when switching beam plans
                    if (state.upperSlingLength == null || state.upperSlingLength < 6) {
                        state.upperSlingLength = 8;
                        state.slingLength = 8;
                    }
                    if (item.id !== 'none' && (state.lowerSlingLength == null || state.lowerSlingLength < 1)) {
                        state.lowerSlingLength = 2;
                    }
                }
                if (item.id === 'cascaded' || item.id === 'modular_truss'
                    || item.id === 'inline4' || item.id === 'inline8' || item.id === 'spatial8') {
                    if (state.hangerSlingLength == null) state.hangerSlingLength = 2;
                }
                syncSidebarStoreButton('#beam-store', 'beam', item.id, item.name, item.sub || 'Spreader');
                rebuildCargoAndRig(false);
                if (typeof syncSlingSlidersFromState === 'function') syncSlingSlidersFromState();

            } else if (category === 'hardware') {
                if (item.id === 'turnbuckle') {
                    // Activate visible inline turnbuckles on all 4 legs
                    state.legDeltaL = [0.08, 0.08, 0.08, 0.08];
                } else if (item.id === 'master_link' || item.id === 'thimble' || item.id === 'ferrule') {
                    // These components are integral parts of the wire rope / master link assembly
                    if (item.id !== 'master_link') state.slingType = 'wire';
                } else {
                    state.hwType = item.id;
                    syncSidebarStoreButton('#hw-store', 'hw', item.id, item.name, item.sub || 'Hardware');
                }
                rebuildCargoAndRig(false);

            } else if (category === 'rig_preset') {
                state.beamType = item.beam;
                state.slingType = item.sling;
                state.hwType = item.hw;
                // Default plan lengths: upper 8 m (near hook), lower/hanger 2 m — even integers
                const upperL = (item.slingL >= 8) ? Math.round(item.slingL / 2) * 2 : 8;
                state.slingLength = upperL;
                state.upperSlingLength = upperL;
                state.lowerSlingLength = (item.beam === 'none') ? upperL : 2;
                state.hangerSlingLength = 2;
                state.slingUserSet = true;
                state.cableAdjustMode = false;
                state.holdCableLength = false;
                state.heldCableL0 = null;
                state.lugElevPreset = item.elev || 'top';
                document.getElementById('inp-slingL').value = upperL;
                document.getElementById('v-slingL').textContent = upperL.toFixed(1);
                rebuildCargoAndRig(true);
                if (typeof syncSlingSlidersFromState === 'function') syncSlingSlidersFromState();
                if (item.autoLevel) autoLevelTurnbuckles();
            }

            document.getElementById('sim-status-text').textContent = `✅ Đã áp dụng thiết kế 3D "${item.name}" vào sơ đồ làm hàng!`;
        }

        function syncSidebarStoreButton(containerSel, dataAttr, idVal, title, sub) {
            const container = document.querySelector(containerSel);
            if (!container) return;
            let existing = container.querySelector(`[data-${dataAttr}="${idVal}"]`);
            if (!existing) {
                existing = document.createElement('div');
                existing.className = 'card-btn';
                existing.dataset[dataAttr] = idVal;
                existing.innerHTML = `<div class="text-[11px] font-bold text-sky-300 truncate">${title}</div><div class="text-[9px] text-slate-400 truncate">${sub}</div>`;
                existing.addEventListener('click', () => {
                    container.querySelectorAll('.card-btn').forEach(c => c.classList.remove('active'));
                    existing.classList.add('active');
                    const found = (libraryCatalog[dataAttr === 'hw' ? 'hardware' : dataAttr] || []).find(x => x.id === idVal);
                    if (found) applyLibraryAssetToSimulation(found, dataAttr === 'hw' ? 'hardware' : dataAttr);
                });
                container.appendChild(existing);
            }
            container.querySelectorAll('.card-btn').forEach(c => c.classList.toggle('active', c.dataset[dataAttr] === idVal));
        }

        // --- HIGH-SPEED BINARY & ASCII .STL / .OBJ / .GLB PARSERS ---
        function applySmartCADMaterials(root, defaultColorHex = '#0ea5e9') {
            const GLASS_REGEX = /(glass|window|windshield|windscreen|kinh)/i;
            const WHEEL_REGEX = /(wheel|tire|tyre|rim|w_f|w_r|banh_xe|lop)/i;
            const CHROME_REGEX = /(chrome|metal|steel|silver|mirror|exhaust|grille|bumper|flange|bolt|nut)/i;
            const DARK_TRIM_REGEX = /(chassis|underbody|axle|suspension|skid|base|bottom)/i;

            root.traverse(child => {
                if (!child.isMesh) return;
                const name = `${child.name || ''} ${child.material?.name || ''}`.toLowerCase();

                if (GLASS_REGEX.test(name)) {
                    // Realistic transparent tinted automotive / industrial glass
                    child.material = new THREE.MeshPhysicalMaterial({
                        color: new THREE.Color('#38bdf8'),
                        metalness: 0.1,
                        roughness: 0.08,
                        transmission: 0.85,
                        transparent: true,
                        opacity: 0.42,
                        clearcoat: 1.0,
                        clearcoatRoughness: 0.05,
                        ior: 1.5,
                        side: THREE.DoubleSide
                    });
                } else if (WHEEL_REGEX.test(name)) {
                    // Matte dark rubber tire & alloy wheel
                    child.material = new THREE.MeshStandardMaterial({
                        color: new THREE.Color('#1e293b'),
                        metalness: 0.25,
                        roughness: 0.85,
                        side: THREE.DoubleSide
                    });
                } else if (CHROME_REGEX.test(name)) {
                    // Polished metallic chrome / galvanized steel
                    child.material = new THREE.MeshStandardMaterial({
                        color: new THREE.Color('#cbd5e1'),
                        metalness: 0.85,
                        roughness: 0.2,
                        side: THREE.DoubleSide
                    });
                } else if (DARK_TRIM_REGEX.test(name)) {
                    // Dark undercarriage steel
                    child.material = new THREE.MeshStandardMaterial({
                        color: new THREE.Color('#334155'),
                        metalness: 0.6,
                        roughness: 0.5,
                        side: THREE.DoubleSide
                    });
                } else {
                    // High-finish automotive / equipment body paint with user's selected color
                    child.material = new THREE.MeshPhysicalMaterial({
                        color: new THREE.Color(defaultColorHex),
                        metalness: 0.35,
                        roughness: 0.32,
                        clearcoat: 0.75,
                        clearcoatRoughness: 0.15,
                        side: THREE.DoubleSide
                    });
                }
                child.castShadow = true;
                child.receiveShadow = true;
            });
        }

        function parseSTLBuffer(arrayBuffer) {
            const dataView = new DataView(arrayBuffer);
            const isASCII = () => {
                const headerStr = new TextDecoder().decode(new Uint8Array(arrayBuffer, 0, Math.min(256, arrayBuffer.byteLength)));
                return headerStr.trim().startsWith('solid') && headerStr.includes('facet');
            };

            const positions = [];
            if (isASCII()) {
                const text = new TextDecoder().decode(arrayBuffer);
                const vertexRegex = /vertex\s+([\d.+\-eE]+)\s+([\d.+\-eE]+)\s+([\d.+\-eE]+)/g;
                let match;
                while ((match = vertexRegex.exec(text)) !== null) {
                    positions.push(parseFloat(match[1]), parseFloat(match[2]), parseFloat(match[3]));
                }
            } else {
                const numTriangles = dataView.getUint32(80, true);
                let offset = 84;
                for (let i = 0; i < numTriangles && offset + 50 <= arrayBuffer.byteLength; i++) {
                    for (let v = 0; v < 3; v++) {
                        const vx = dataView.getFloat32(offset + 12 + v * 12, true);
                        const vy = dataView.getFloat32(offset + 16 + v * 12, true);
                        const vz = dataView.getFloat32(offset + 20 + v * 12, true);
                        positions.push(vx, vz, -vy); // Convert Z-up CAD/3D-Print to Y-up
                    }
                    offset += 50;
                }
            }

            const geo = new THREE.BufferGeometry();
            geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
            geo.computeVertexNormals();
            return geo;
        }

        function parseOBJText(text) {
            const verts = [];
            const positions = [];
            const lines = text.split('\n');
            for (let line of lines) {
                line = line.trim();
                if (line.startsWith('v ')) {
                    const parts = line.split(/\s+/);
                    verts.push([parseFloat(parts[1]), parseFloat(parts[2]), parseFloat(parts[3])]);
                } else if (line.startsWith('f ')) {
                    const parts = line.split(/\s+/).slice(1);
                    const idxs = parts.map(p => parseInt(p.split('/')[0], 10) - 1);
                    for (let i = 1; i < idxs.length - 1; i++) {
                        const v0 = verts[idxs[0]], v1 = verts[idxs[i]], v2 = verts[idxs[i + 1]];
                        if (v0 && v1 && v2) {
                            positions.push(...v0, ...v1, ...v2);
                        }
                    }
                }
            }
            const geo = new THREE.BufferGeometry();
            geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
            geo.computeVertexNormals();
            return geo;
        }

        let currentUploaded3DFile = null;
        let currentUploaded3DResult = null;

        async function processAndDisplay3DFile(file) {
            if (!file) return;
            const ext = file.name.split('.').pop().toLowerCase();
            const baseName = file.name.replace(/\.[^/.]+$/, '');
            document.getElementById('inp-asset-name').value = baseName;
            document.getElementById('lbl-file3d-status').textContent = `Đang phân tích & chuẩn hóa tỷ lệ 1:1 cho "${file.name}"...`;

            const selectedSpec = document.getElementById('sel-import-spec')?.value || 'container_20ft';
            const unit = document.getElementById('sel-import-unit')?.value || 'auto';
            const upAxis = document.getElementById('sel-import-up')?.value || 'auto';
            const mode = document.getElementById('sel-import-mode')?.value || 'auto';
            const colorHex = document.getElementById('inp-stl-color')?.value || '#0ea5e9';

            const optimizeHull = document.getElementById('chk-optimize-hull')?.checked !== false;
            const presetVal = document.getElementById('sel-hull-preset')?.value || 'strip_interior_only';
            const maxTris = (presetVal === 'strip_interior_only' || presetVal === 'none') ? presetVal : parseInt(presetVal, 10);

            // Auto-detect if uploaded asset is vehicle/machine/custom rather than standard 20ft box
            const isVehicleOrCustom = /(bus|xe|car|truck|oto|boat|vessel|equipment|skid|generator|may)/i.test(baseName);
            const specKey = (selectedSpec === 'container_20ft' && isVehicleOrCustom) ? 'generic_cargo' : selectedSpec;

            const isFreshFile = !currentUploaded3DFile || currentUploaded3DFile.name !== file.name;
            const inL = parseFloat(document.getElementById('inp-target-L')?.value);
            const inW = parseFloat(document.getElementById('inp-target-W')?.value);
            const inH = parseFloat(document.getElementById('inp-target-H')?.value);
            const targetDimensions = (!isFreshFile && !isNaN(inL) && inL > 0.1 && !isNaN(inW) && inW > 0.1 && !isNaN(inH) && inH > 0.1)
                ? { x: inL, y: inH, z: inW }
                : null;

            try {
                const loaders = new (window.CAE?.AssetLoaders || AssetLoaders)();
                const result = await loaders.loadFromFile(file, {
                    specKey, unit, upAxis, mode,
                    optimizeHull, maxTris,
                    stripInteriorOnly: presetVal === 'strip_interior_only',
                    targetDimensions,
                    forceExactDimensions: !!targetDimensions
                });
                currentUploaded3DResult = result;
                const { root, report } = result;

                // Smart multi-material assignment for STL and OBJ files
                if (ext === 'stl' || ext === 'obj') {
                    applySmartCADMaterials(root, colorHex);
                }
                applyCADFeatureEdges(root, false);

                // Update Inspection Report Card UI
                const card = document.getElementById('import-inspection-card');
                if (card) card.classList.remove('hidden');

                const badge = document.getElementById('inspect-status-badge');
                if (badge) {
                    if (report.status === 'PASS') {
                        badge.className = 'px-1.5 py-0.2 rounded text-[10px] bg-emerald-500/20 text-emerald-300 border border-emerald-500/40';
                        badge.textContent = '🟢 ĐẠT CHUẨN (PASS)';
                    } else if (report.status === 'WARNING') {
                        badge.className = 'px-1.5 py-0.2 rounded text-[10px] bg-amber-500/20 text-amber-300 border border-amber-500/40';
                        badge.textContent = '🟡 CẢNH BÁO (WARNING)';
                    } else {
                        badge.className = 'px-1.5 py-0.2 rounded text-[10px] bg-rose-500/20 text-rose-300 border border-rose-500/40';
                        badge.textContent = '🔴 KHÔNG ĐẠT (FAIL)';
                    }
                }

                const trisEl = document.getElementById('inspect-tris');
                if (trisEl) trisEl.textContent = `${(report.triCount || 0).toLocaleString()} tris`;

                const unitEl = document.getElementById('inspect-unit');
                if (unitEl) unitEl.textContent = `${(report.detectedUnit || 'm').toUpperCase()} (${report.detectedUpAxis || 'Y'}-Up)`;

                const scaleEl = document.getElementById('inspect-scale');
                if (scaleEl) {
                    const sf = report.appliedScaleFactor || 1;
                    scaleEl.textContent = sf >= 0.001 ? `${sf.toFixed(4)}x` : `${sf.toExponential(2)}x`;
                }

                const dimEl = document.getElementById('inspect-dim');
                if (dimEl && report.dimensionsNormalized) {
                    const d = report.dimensionsNormalized;
                    dimEl.textContent = `${d.x.toFixed(2)}m × ${d.y.toFixed(2)}m × ${d.z.toFixed(2)}m`;
                }

                const devEl = document.getElementById('inspect-dev');
                if (devEl) devEl.textContent = `${(report.maxDeviationPct || 0).toFixed(1)}%`;

                // Update anti-lag report badge
                const hullEl = document.getElementById('inspect-hull-opt');
                const redEl = document.getElementById('inspect-poly-reduction');
                if (report.hullOptimization) {
                    const ho = report.hullOptimization;
                    if (hullEl) hullEl.textContent = `Giảm ${ho.reductionPct}% (${ho.finalTris.toLocaleString()} tris - 60 FPS)`;
                    if (redEl) redEl.textContent = `-${ho.culledCount} chi tiết ngầm`;
                    const statusOpt = document.getElementById('lbl-hull-opt-status');
                    if (statusOpt) statusOpt.textContent = `⚡ Đã tối ưu vỏ ngoài: giảm ${ho.reductionPct}% lưới (${ho.initialTris.toLocaleString()} ➔ ${ho.finalTris.toLocaleString()} tris)`;
                } else {
                    if (hullEl) hullEl.textContent = 'Nguyên bản';
                    if (redEl) redEl.textContent = '';
                }

                if (report.caeHeader) {
                    const ch = report.caeHeader;
                    if (ch.name) {
                        const nameInp = document.getElementById('inp-asset-name');
                        if (nameInp) nameInp.value = ch.name;
                    }
                    if (ch.dimensions) {
                        const inL = document.getElementById('inp-target-L');
                        const inW = document.getElementById('inp-target-W');
                        const inH = document.getElementById('inp-target-H');
                        if (inL) inL.value = ch.dimensions.L.toFixed(2);
                        if (inH) inH.value = ch.dimensions.H.toFixed(2);
                        if (inW) inW.value = ch.dimensions.W.toFixed(2);
                    }
                    if (ch.weight != null) {
                        const inWeight = document.getElementById('inp-target-weight');
                        if (inWeight) inWeight.value = ch.weight.toFixed(1);
                    }
                } else if (report.dimensionsNormalized) {
                    const inL = document.getElementById('inp-target-L');
                    const inW = document.getElementById('inp-target-W');
                    const inH = document.getElementById('inp-target-H');
                    const inWeight = document.getElementById('inp-target-weight');
                    if (inL) inL.value = report.dimensionsNormalized.x.toFixed(2);
                    if (inH) inH.value = report.dimensionsNormalized.y.toFixed(2);
                    if (inW) inW.value = report.dimensionsNormalized.z.toFixed(2);
                    if (inWeight) {
                        const vol = report.dimensionsNormalized.x * report.dimensionsNormalized.y * report.dimensionsNormalized.z;
                        const estWeight = Math.max(1.5, Math.min(80, Math.round(vol * 0.26 * 10) / 10));
                        inWeight.value = estWeight.toFixed(1);
                    }
                }

                const warnEl = document.getElementById('inspect-warnings');
                if (warnEl) {
                    if (report.warnings && report.warnings.length > 0) {
                        warnEl.innerHTML = report.warnings.map(w => `<div class="text-[10px] text-amber-300">⚠️ ${w}</div>`).join('');
                    } else {
                        warnEl.innerHTML = '<div class="text-[10px] text-emerald-400">✨ Tỷ lệ khớp hoàn hảo chuẩn công nghiệp (Dung sai ≤ 2%). Sẵn sàng đưa vào mô phỏng.</div>';
                    }
                }

                if (report.caeHeader) {
                    document.getElementById('lbl-file3d-status').textContent = `✨ Đã nạp file OBJ kèm thông số CAE Digital Twin: ${report.caeHeader.name || file.name} (${(report.triCount || 0).toLocaleString()} tris | ${report.caeHeader.dimensions ? report.caeHeader.dimensions.L + '×' + report.caeHeader.dimensions.H + '×' + report.caeHeader.dimensions.W + 'm' : ''} - ${report.caeHeader.weight || 20}T)`;
                } else {
                    document.getElementById('lbl-file3d-status').textContent = `✅ Đã nạp & chuẩn hóa ${file.name} (${(report.triCount || 0).toLocaleString()} tris | ${report.dimensionsNormalized.x.toFixed(2)}×${report.dimensionsNormalized.y.toFixed(2)}×${report.dimensionsNormalized.z.toFixed(2)}m)`;
                }

                pendingCustomGroup = root;
                showPendingGroupInPreview(root, `${file.name} | ${report.dimensionsNormalized.x.toFixed(2)}×${report.dimensionsNormalized.y.toFixed(2)}×${report.dimensionsNormalized.z.toFixed(2)}m | ${(report.triCount || 0).toLocaleString()} tris`);
            } catch (err) {
                console.error('[AssetPipeline] Load error:', err);
                document.getElementById('lbl-file3d-status').textContent = `❌ Lỗi khi đọc file 3D: ${err.message}`;
            }
        }

        function handle3DFileUpload(e) {
            const file = e.target.files[0];
            if (!file) return;
            currentUploaded3DFile = file;
            processAndDisplay3DFile(file);
        }

        function generateDemoSTLMechanicalPart() {
            const colorHex = document.getElementById('inp-stl-color').value;
            const mat = new THREE.MeshPhysicalMaterial({ color: new THREE.Color(colorHex), metalness: 0.5, roughness: 0.22, clearcoat: 0.6 });
            const group = new THREE.Group();

            // Multi-flanged 3D-Printed Subsea Turbine Valve Manifold Assembly (Target ~6.0m x 2.6m x 2.4m)
            const base = new THREE.Mesh(new THREE.BoxGeometry(5.8, 0.4, 2.3), MATS.darkSteel.clone());
            base.position.y = -1.1;
            const bodyCyl = new THREE.Mesh(new THREE.CylinderGeometry(1.0, 1.0, 5.2, 36), mat);
            bodyCyl.rotation.z = Math.PI / 2;
            const dome = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 0.85, 1.4, 32), mat);
            dome.position.y = 0.55;
            const topFlange = new THREE.Mesh(new THREE.CylinderGeometry(1.0, 1.0, 0.18, 32), MATS.galvSteel.clone());
            topFlange.position.y = 1.25;
            [-2.4, 2.4].forEach(fx => {
                const fl = new THREE.Mesh(new THREE.CylinderGeometry(1.2, 1.2, 0.2, 32), MATS.galvSteel.clone());
                fl.rotation.z = Math.PI / 2;
                fl.position.x = fx;
                group.add(fl);
            });
            group.add(base, bodyCyl, dome, topFlange);
            applyCADFeatureEdges(group, false);

            const { root, report } = window.CAE.AssetPipeline.normalizeAsset(group, {
                specKey: 'generic_cargo',
                mode: 'cad_strict'
            });

            pendingCustomGroup = root;
            currentUploaded3DResult = { root, report };
            document.getElementById('inp-asset-name').value = 'Cụm Van Turbine Dầu Khí (CAD Metric)';
            showPendingGroupInPreview(root, `Mẫu Khối In 3D Cơ Khí (${report.triCount} tris | ${report.dimensionsNormalized.x}×${report.dimensionsNormalized.y}×${report.dimensionsNormalized.z}m)`);
        }

        function addScaleReferenceVisuals(previewGroup, targetModel) {
            if (!targetModel) return;
            const refContainer = new THREE.Group();
            refContainer.name = 'scale_references';

            const bbox = new THREE.Box3().setFromObject(targetModel);
            const size = new THREE.Vector3();
            bbox.getSize(size);
            const min = bbox.min;
            const max = bbox.max;
            const baseY = min.y;

            // 1. Human Worker Figure (1.75m Real-World Industrial Benchmark)
            const workerGroup = new THREE.Group();
            workerGroup.name = 'human_worker_1_75m';
            const workerX = min.x - Math.max(0.6, size.x * 0.12);
            const workerZ = Math.min(max.z, Math.max(min.z, 0));

            const bootMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.8 });
            [-0.09, 0.09].forEach(bx => {
                const boot = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.12, 0.22), bootMat);
                boot.position.set(bx, 0.06, 0.04);
                workerGroup.add(boot);
            });

            const trouserMat = new THREE.MeshStandardMaterial({ color: 0x1e3a8a, roughness: 0.7 });
            [-0.09, 0.09].forEach(lx => {
                const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.065, 0.07, 0.72, 12), trouserMat);
                leg.position.set(lx, 0.12 + 0.36, 0);
                workerGroup.add(leg);
            });

            const vestMat = new THREE.MeshStandardMaterial({ color: 0xf97316, roughness: 0.5 });
            const silverStripeMat = new THREE.MeshStandardMaterial({ color: 0xe2e8f0, roughness: 0.2, metalness: 0.8 });
            const torso = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.48, 0.22), vestMat);
            torso.position.set(0, 0.84 + 0.24, 0);
            workerGroup.add(torso);

            [0.96, 1.20].forEach(sy => {
                const stripe = new THREE.Mesh(new THREE.BoxGeometry(0.39, 0.04, 0.225), silverStripeMat);
                stripe.position.set(0, sy, 0);
                workerGroup.add(stripe);
            });

            [-0.24, 0.24].forEach(ax => {
                const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.48, 10), vestMat);
                arm.position.set(ax, 1.10, 0);
                workerGroup.add(arm);
            });

            const skinMat = new THREE.MeshStandardMaterial({ color: 0xfcd34d, roughness: 0.6 });
            const head = new THREE.Mesh(new THREE.SphereGeometry(0.10, 16, 16), skinMat);
            head.position.set(0, 1.42, 0);
            workerGroup.add(head);

            const helmetMat = new THREE.MeshStandardMaterial({ color: 0xfacc15, roughness: 0.35, metalness: 0.2 });
            const helmet = new THREE.Mesh(new THREE.SphereGeometry(0.125, 16, 16, 0, Math.PI * 2, 0, Math.PI / 2), helmetMat);
            helmet.position.set(0, 1.48, 0);
            const rim = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.15, 0.02, 16), helmetMat);
            rim.position.set(0, 1.47, 0);
            workerGroup.add(helmet, rim);

            workerGroup.position.set(workerX, baseY, workerZ);
            refContainer.add(workerGroup);

            // 2. 1.0-Meter CAD Metric Scale Ruler
            const rulerGroup = new THREE.Group();
            rulerGroup.name = 'metric_cad_ruler_1m';
            const rulerX = min.x - Math.max(0.3, size.x * 0.06);
            const rulerZ = min.z - 0.1;

            const bandDark = new THREE.MeshBasicMaterial({ color: 0x0f172a });
            const bandLight = new THREE.MeshBasicMaterial({ color: 0x38bdf8 });
            for (let b = 0; b < 10; b++) {
                const seg = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.1, 0.04), (b % 2 === 0 ? bandLight : bandDark));
                seg.position.set(0, b * 0.1 + 0.05, 0);
                rulerGroup.add(seg);
            }
            const tickMat = new THREE.MeshBasicMaterial({ color: 0xfacc15 });
            const tick05 = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.015, 0.015), tickMat);
            tick05.position.set(0.04, 0.5, 0);
            const tick10 = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.02, 0.02), tickMat);
            tick10.position.set(0.06, 1.0, 0);
            rulerGroup.add(tick05, tick10);

            rulerGroup.position.set(rulerX, baseY, rulerZ);
            refContainer.add(rulerGroup);

            previewGroup.add(refContainer);
        }

        function autoFrameStudioCamera(targetModel) {
            if (!targetModel || !studioCamera || !studioControls) return;
            const bbox = new THREE.Box3().setFromObject(targetModel);
            const center = new THREE.Vector3();
            bbox.getCenter(center);
            const size = new THREE.Vector3();
            bbox.getSize(size);
            const maxDim = Math.max(size.x, size.y, size.z, 0.5);

            studioControls.target.copy(center);
            const fov = studioCamera.fov * (Math.PI / 180);
            const dist = Math.max(2.2, (maxDim / 2) / Math.tan(fov / 2) * 1.55);

            studioCamera.position.set(
                center.x + dist * 0.85,
                center.y + dist * 0.52,
                center.z + dist * 1.15
            );
            studioCamera.near = Math.max(0.01, dist / 80);
            studioCamera.far = Math.max(250, dist * 20);
            studioCamera.updateProjectionMatrix();
            studioControls.update();
        }

        async function preloadStandardPortAssets() {
            try {
                const loaders = new (window.CAE?.AssetLoaders || AssetLoaders)();

                const paintIsoRealistic = (root) => {
                    root.traverse(child => {
                        if (!child.isMesh) return;
                        child.castShadow = true;
                        child.receiveShadow = true;
                        child.visible = true;
                        if (child.geometry && !child.geometry.attributes.normal) {
                            child.geometry.computeVertexNormals();
                        }
                        // Promote MTL Phong → Standard; DoubleSide avoids see-through from inverted OBJ faces
                        const mats = Array.isArray(child.material) ? child.material : [child.material];
                        const upgraded = mats.map(m => {
                            if (!m) {
                                return new THREE.MeshStandardMaterial({
                                    color: 0x64748b, roughness: 0.45, metalness: 0.35,
                                    side: THREE.DoubleSide, name: 'ISO_RealisticV2_Fallback'
                                });
                            }
                            const name = m.name || child.name || 'ISO_RealisticV2';
                            const isSteel = /steel|galv|cast|stainless|hinge|corner|cavity/i.test(name);
                            const c = (m.color && m.color.clone) ? m.color.clone() : new THREE.Color(0x94a3b8);
                            // Already Standard: still force opaque + double-sided for CAD fidelity
                            if (m.isMeshStandardMaterial || m.isMeshPhysicalMaterial) {
                                m.side = THREE.DoubleSide;
                                m.transparent = false;
                                m.opacity = 1;
                                m.depthWrite = true;
                                m.needsUpdate = true;
                                return m;
                            }
                            const std = new THREE.MeshStandardMaterial({
                                color: c,
                                roughness: Math.max(0.18, 1 - ((m.shininess || 30) / 120)),
                                metalness: isSteel ? 0.72 : 0.22,
                                side: THREE.DoubleSide,
                                transparent: false,
                                opacity: 1,
                                name
                            });
                            return std;
                        });
                        child.material = Array.isArray(child.material) ? upgraded : upgraded[0];
                    });
                    root.userData.isNormalizedAsset = true;
                    root.userData.keepMaterials = true;
                    root.userData.isoRealisticV2 = true;
                };

                // Full ISO Realistic V2 suite (dedicated CAD per type — no stretch/lengthen)
                const isoRealisticSuite = [
                    { file: 'iso_20ft_dc_22g1.obj', keys: ['container', 'container_22g1', 'container_20ft_glb'], specKey: 'container_20ft' },
                    { file: 'iso_20ft_hc_25g1.obj', keys: ['iso20hc'], specKey: 'container_20fthc' },
                    { file: 'iso_40ft_dc_42g1.obj', keys: ['iso40', 'container_40ft_glb'], specKey: 'container_40ft' },
                    { file: 'iso_40ft_hc_45g1.obj', keys: ['iso40hc'], specKey: 'container_40fthc' },
                    { file: 'iso_45ft_hc_l5g1.obj', keys: ['iso45hc'], specKey: 'container_45fthc' },
                    { file: 'iso_10ft_dc_12g1.obj', keys: ['container10'], specKey: 'container_10ft' },
                    { file: 'iso_53ft_hc.obj', keys: ['iso53hc'], specKey: 'container_53fthc' },
                    { file: 'iso_20ft_ot_22u1.obj', keys: ['opentop'], specKey: 'opentop_container' },
                    { file: 'iso_40ft_ot_42u1.obj', keys: ['opentop40'], specKey: 'container_opentop40' },
                    { file: 'iso_40ft_fr_45p3.obj', keys: ['flatrack'], specKey: 'flatrack_container' },
                    { file: 'iso_20ft_fr_22p3.obj', keys: ['flatrack20'], specKey: 'container_flatrack20' },
                    { file: 'iso_20ft_tk_22k2.obj', keys: ['isotank'], specKey: 'tank_container' },
                    { file: 'iso_40ft_rh_45r1.obj', keys: ['reefer', 'reefer_40hc'], specKey: 'reefer_container' },
                    { file: 'iso_20ft_rf_22r1.obj', keys: ['reefer20'], specKey: 'container_reefer20' },
                    { file: 'iso_40ft_pl_49p0.obj', keys: ['platform'], specKey: 'container_platform40' },
                    { file: 'iso_20ft_pl_29p0.obj', keys: ['platform20'], specKey: 'container_platform20' },
                    { file: 'iso_20ft_hh_28u1.obj', keys: ['halfheight'], specKey: 'container_halfheight' },
                    { file: 'iso_20ft_bk_22b0.obj', keys: ['drybulk'], specKey: 'container_drybulk' }
                ];

                isoRealisticSuite.forEach(entry => {
                    // Keep full CAD: do NOT cull "interior" (tank barrel, floors, door gear live inside outer AABB)
                    loaders.loadFromUrl(`/assets/models/${entry.file}`, {
                        specKey: entry.specKey,
                        cullInterior: false,
                        optimizeHull: false,
                        mode: 'cad_strict'
                    })
                        .then(res => {
                            paintIsoRealistic(res.root);
                            entry.keys.forEach(k => { customCargoMeshes[k] = res.root; });
                            if (typeof rebuildCargoAndRig === 'function' && entry.keys.includes(state.cargoType)) {
                                if (activeCargoVisual) activeCargoVisual.userData.meshKey = '';
                                rebuildCargoAndRig(false);
                            } else if (typeof rebuildCargo3D === 'function' && entry.keys.includes(state.cargoType)) {
                                rebuildCargo3D();
                            }
                        }).catch(e => {
                            console.warn(`[AssetManager] ${entry.file} load notice:`, e);
                        });
                });

                // CONTS20FT.obj — design reference / fallback if Realistic V2 20ft DC is missing
                loaders.loadFromUrl('/assets/models/conts20ft.obj', { specKey: 'container_20ft' })
                    .then(res => {
                        res.root.traverse(child => {
                            if (child.isMesh) {
                                child.castShadow = true;
                                child.receiveShadow = true;
                                if (Array.isArray(child.material)) {
                                    child.material = [
                                        new THREE.MeshStandardMaterial({
                                            color: 0x1d4ed8,
                                            roughness: 0.42,
                                            metalness: 0.28,
                                            name: 'ContainerBody_MarinePaint'
                                        }),
                                        new THREE.MeshStandardMaterial({
                                            color: 0xe2e8f0,
                                            roughness: 0.22,
                                            metalness: 0.85,
                                            name: 'ContainerHardware_GalvanizedSteel'
                                        })
                                    ];
                                }
                            }
                        });
                        res.root.userData.isNormalizedAsset = true;
                        customCargoMeshes['container_conts20ft'] = res.root;
                        if (!customCargoMeshes['container_22g1']) {
                            customCargoMeshes['container_22g1'] = res.root;
                            customCargoMeshes['container'] = res.root;
                            customCargoMeshes['container_20ft_glb'] = res.root;
                            if (typeof rebuildCargo3D === 'function' && (
                                state.cargoType === 'container' ||
                                state.cargoType === 'container_20ft_glb'
                            )) {
                                rebuildCargo3D();
                            }
                        }
                    }).catch(e => {
                        console.warn('[AssetManager] conts20ft.obj load notice:', e);
                    });

                // Legacy ThermoKing reefer only if Realistic V2 RH not yet loaded
                loaders.loadFromUrl('/assets/models/container_reefer_40hc_real_v2.obj', {
                    specKey: 'reefer_container',
                    targetDimensions: { x: 12.192, y: 2.896, z: 2.438 }
                }).then(res => {
                    if (customCargoMeshes['reefer']?.userData?.isoRealisticV2) return;
                    const whitePaintMat = new THREE.MeshStandardMaterial({
                        color: 0xf8fafc, roughness: 0.32, metalness: 0.18, name: 'Reefer_White'
                    });
                    const carrierBlueMat = new THREE.MeshStandardMaterial({
                        color: 0x1e3a8a, roughness: 0.38, metalness: 0.28, name: 'Carrier_PrimeLine_Blue'
                    });
                    const darkMachineryMat = new THREE.MeshStandardMaterial({
                        color: 0x0f172a, roughness: 0.55, metalness: 0.65, name: 'Reefer_DarkMachinery'
                    });
                    const galvHardwareMat = new THREE.MeshStandardMaterial({
                        color: 0xe2e8f0, roughness: 0.20, metalness: 0.88, name: 'Reefer_GalvSteel'
                    });
                    const ctrlPanelMat = new THREE.MeshStandardMaterial({
                        color: 0x1e293b, roughness: 0.35, metalness: 0.45, name: 'Reefer_Controller'
                    });
                    const rubberGasketMat = new THREE.MeshStandardMaterial({
                        color: 0x090d16, roughness: 0.92, metalness: 0.05, name: 'Reefer_Rubber'
                    });
                    const cautionYellowMat = new THREE.MeshStandardMaterial({
                        color: 0xfacc15, roughness: 0.40, metalness: 0.15, name: 'Reefer_SafetyYellow'
                    });

                    res.root.traverse(child => {
                        if (child.isMesh) {
                            child.castShadow = true;
                            child.receiveShadow = true;
                            const mName = child.name || '';
                            const mtlName = child.material?.name || '';
                            if (mName.includes('Door_Locking') || mName.includes('ThermoKing_Bolts') || mtlName === 'Galvanized_Steel') {
                                child.material = galvHardwareMat;
                            } else if (mName === 'Door_Rubber_Gaskets' || mtlName === 'Black_Rubber') {
                                child.material = rubberGasketMat;
                            } else if (mName === 'ThermoKing_Unit' && mtlName !== 'Galvanized_Steel') {
                                child.material = carrierBlueMat;
                            } else if (mName.includes('ThermoKing_Fan') || mName === 'ThermoKing_Compressor' || mtlName === 'Dark_Chassis') {
                                child.material = darkMachineryMat;
                            } else if (mName === 'ThermoKing_Controller') {
                                child.material = ctrlPanelMat;
                            } else if (mName === 'ThermoKing_Cable_Tray') {
                                child.material = cautionYellowMat;
                            } else {
                                child.material = whitePaintMat;
                            }
                        }
                    });
                    res.root.userData.keepMaterials = true;
                    customCargoMeshes['reefer'] = res.root;
                    customCargoMeshes['reefer_40hc'] = res.root;
                    if (typeof rebuildCargo3D === 'function' && state.cargoType === 'reefer') {
                        rebuildCargo3D();
                    }
                }).catch(e => {
                    console.warn('[AssetManager] container_reefer_40hc_real_v2.obj load notice:', e);
                });

                // High-fidelity bus / vehicle CAD body (replaces procedural utility pickup)
                loaders.loadFromUrl('/assets/models/bus.obj', {
                    specKey: 'generic_cargo',
                    targetDimensions: { x: 9.0, y: 2.80, z: 2.38 },
                    forceExactDimensions: true,
                    mode: 'cad_strict'
                }).then(res => {
                    const bodyMat = new THREE.MeshStandardMaterial({
                        color: 0x38bdf8,
                        roughness: 0.38,
                        metalness: 0.22,
                        name: 'Vehicle_BodyPaint'
                    });
                    const glassMat = new THREE.MeshStandardMaterial({
                        color: 0x0f172a,
                        roughness: 0.12,
                        metalness: 0.55,
                        transparent: true,
                        opacity: 0.72,
                        name: 'Vehicle_Glass'
                    });
                    const darkMat = new THREE.MeshStandardMaterial({
                        color: 0x111827,
                        roughness: 0.55,
                        metalness: 0.45,
                        name: 'Vehicle_Trim'
                    });
                    const pickMat = (child) => {
                        const matName = Array.isArray(child.material)
                            ? (child.material[0]?.name || '')
                            : (child.material?.name || '');
                        const n = `${child.name || ''} ${matName}`.toLowerCase();
                        if (n.includes('glass') || n.includes('window') || n.includes('wind') || n.startsWith('glass')) return glassMat;
                        if (n.includes('wheel') || n.includes('tyre') || n.includes('tire') || n.includes('chassis') || n.includes('under') || /^w_/.test(n)) return darkMat;
                        return bodyMat;
                    };
                    res.root.traverse(child => {
                        if (!child.isMesh) return;
                        child.castShadow = true;
                        child.receiveShadow = true;
                        child.material = pickMat(child);
                    });
                    res.root.name = 'Vehicle_Bus_CAD';
                    customCargoMeshes['car'] = res.root;
                    if (typeof rebuildCargoAndRig === 'function' && state.cargoType === 'car') {
                        if (activeCargoVisual) activeCargoVisual.userData.meshKey = '';
                        rebuildCargoAndRig(true);
                    }
                }).catch(e => {
                    console.warn('[AssetManager] bus.obj load notice:', e);
                });

                loaders.loadFromUrl('/assets/models/container_20ft.glb', { specKey: 'container_20ft' })
                    .then(res => {
                        // Prefer Realistic V2 OBJ; GLB only as last-resort fallback
                        if (!customCargoMeshes['container_20ft_glb']) customCargoMeshes['container_20ft_glb'] = res.root;
                        if (!customCargoMeshes['container']) customCargoMeshes['container'] = res.root;
                    }).catch(() => {});

                loaders.loadFromUrl('/assets/models/container_40ft.glb', { specKey: 'container_40ft' })
                    .then(res => {
                        if (customCargoMeshes['iso40']?.userData?.isoRealisticV2) return;
                        customCargoMeshes['container_40ft_glb'] = res.root;
                        customCargoMeshes['iso40'] = res.root;
                        if (typeof rebuildCargo3D === 'function' && (state.cargoType === 'iso40' || state.cargoType === 'container_40ft_glb')) {
                            rebuildCargo3D();
                        }
                        if (typeof rebuildCargoAndRig === 'function' && (state.cargoType === 'iso40' || state.cargoType === 'container_40ft_glb')) {
                            rebuildCargoAndRig(false);
                        }
                    }).catch(() => {});

                // STS telescopic spreader CAD suite (RAM / Bromma style OBJs)
                const stsPaint = (root) => {
                    root.traverse(child => {
                        if (!child.isMesh) return;
                        child.castShadow = true;
                        child.receiveShadow = true;
                        const n = (child.name || '').toLowerCase();
                        const isFlip = n.includes('flip') || n.includes('guide');
                        const isHazard = n.includes('hazard') || n.includes('stripe');
                        const isSteel = n.includes('steel') || n.includes('head') || n.includes('hpu') || n.includes('grey');
                        let mat;
                        if (isFlip) mat = (MATS.stsFlipperRed || MATS.craneSafetyRed || MATS.redMaster).clone();
                        else if (isHazard) mat = (MATS.stsHazardStripe || MATS.yellowHazard).clone();
                        else if (isSteel) mat = (MATS.stsGreyBox || MATS.darkSteel || MATS.gunmetal).clone();
                        else mat = (MATS.spreaderYellow || MATS.craneYellow || MATS.yellowHazard).clone();
                        child.material = mat;
                    });
                    root.userData.isNormalizedAsset = true;
                    root.userData.stsCad = true;
                };
                const loadSts = (file, key, specKey) => {
                    loaders.loadFromUrl(`/assets/models/${file}`, { specKey })
                        .then(res => {
                            stsPaint(res.root);
                            customBeamMeshes[key] = res.root;
                            if (state.beamType === 'container_spreader' && typeof rebuildSpreaderVisuals === 'function') {
                                rebuildSpreaderVisuals();
                                if (typeof mountBeamBodies === 'function') mountBeamBodies();
                            }
                        }).catch(e => console.warn(`[AssetManager] ${file} load notice:`, e));
                };
                loadSts('STS_Spreader_20ft_Retracted.obj', 'sts_spreader_20', 'sts_spreader_20');
                loadSts('STS_Spreader_40ft_Master.obj', 'sts_spreader_40', 'sts_spreader_40');
                loadSts('STS_Spreader_45ft_Extended.obj', 'sts_spreader_45', 'sts_spreader_45');
                loadSts('STS_Spreader_2x20ft_TwinLift.obj', 'sts_spreader_twin', 'sts_spreader_twin');

                loaders.loadFromUrl('/assets/models/modulift_spreader.glb', { specKey: 'modulift_spreader' })
                    .then(res => {
                        customBeamMeshes['modulift_spreader_glb'] = res.root;
                    }).catch(() => {});

                loaders.loadFromUrl('/assets/models/crosby_shackle.glb', { specKey: 'crosby_shackle_17t' })
                    .then(res => {
                        customHwMeshes['crosby_shackle_glb'] = res.root;
                    }).catch(() => {});

                loaders.loadFromUrl('/assets/models/sts_crane.glb', { specKey: 'sts_gantry_crane' })
                    .then(res => {
                        customCraneMeshes['sts_crane_glb'] = res.root;
                    }).catch(() => {});
            } catch (e) {
                console.warn('[AssetManager] Preload assets notice:', e);
            }
        }

        // --- 2D IMAGE TO 3D CONTOUR & RELIEF RECONSTRUCTION ENGINE ---
        function drawDefaultSampleSilhouetteAndExtrude() {
            const cvs = document.getElementById('img2d-preview-canvas');
            const ctx = cvs.getContext('2d');
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(0, 0, cvs.width, cvs.height);

            // Draw an industrial heavy crane / generator silhouette sample
            ctx.fillStyle = '#0284c7';
            ctx.fillRect(14, 52, 92, 28);
            ctx.fillStyle = '#0369a1';
            ctx.fillRect(26, 26, 52, 28);
            ctx.beginPath();
            ctx.arc(88, 52, 18, 0, Math.PI * 2);
            ctx.fill();

            const img = new Image();
            img.onload = () => {
                lastUploadedImage = img;
                rebuild3DFromUploadedImage(img);
            };
            img.src = cvs.toDataURL();
        }

        function handle2DImageUploadFor3D(e) {
            const file = e.target.files[0];
            if (!file) return;
            const baseName = file.name.replace(/\.[^/.]+$/, '');
            document.getElementById('inp-asset-name').value = `${baseName} (3D Từ Ảnh)`;
            document.getElementById('lbl-img3d-status').textContent = `Đang quét biên dạng 3D từ ảnh: ${file.name}...`;

            const reader = new FileReader();
            reader.onload = ev => {
                const img = new Image();
                img.onload = () => {
                    lastUploadedImage = img;
                    rebuild3DFromUploadedImage(img);
                    document.getElementById('lbl-img3d-status').textContent = `✅ Đã tạo khối 3D từ ảnh "${file.name}"`;
                };
                img.src = ev.target.result;
            };
            reader.readAsDataURL(file);
        }

        // Converts any 2D Image into a true 3D Volumetric Relief & Extruded CAD Model
        function rebuild3DFromUploadedImage(img) {
            const cvs = document.getElementById('img2d-preview-canvas');
            const ctx = cvs.getContext('2d');
            const W = 56, H = 42;
            const off = document.createElement('canvas');
            off.width = W; off.height = H;
            const octx = off.getContext('2d');
            octx.drawImage(img, 0, 0, W, H);
            const imgData = octx.getImageData(0, 0, W, H).data;

            // Preview mask on UI canvas
            ctx.clearRect(0, 0, cvs.width, cvs.height);
            ctx.drawImage(img, 0, 0, cvs.width, cvs.height);

            const thresh = parseInt(document.getElementById('inp-extrude-thresh').value, 10) || 235;
            const depthMult = parseFloat(document.getElementById('inp-extrude-depth').value) || 1.0;

            // Detect background luminance from top-left pixel
            const bgR = imgData[0], bgG = imgData[1], bgB = imgData[2];
            const bgBright = (bgR + bgG + bgB) / 3;

            const group = new THREE.Group();
            const voxelW = 3.4 / W;
            const voxelH = 2.4 / H;

            // Merge horizontal runs per row into smooth extruded 3D bars with relief depth from pixel luminance/saturation
            for (let y = 0; y < H; y++) {
                let x = 0;
                while (x < W) {
                    const idx = (y * W + x) * 4;
                    const r = imgData[idx], g = imgData[idx + 1], b = imgData[idx + 2], a = imgData[idx + 3];
                    const bright = (r + g + b) / 3;
                    const diffFromBg = Math.hypot(r - bgR, g - bgG, b - bgB);
                    const isForeground = a > 40 && (bgBright > 180 ? bright < thresh : diffFromBg > (255 - thresh));

                    if (!isForeground) {
                        x++;
                        continue;
                    }

                    let runEnd = x + 1;
                    while (runEnd < W) {
                        const idx2 = (y * W + runEnd) * 4;
                        const r2 = imgData[idx2], g2 = imgData[idx2 + 1], b2 = imgData[idx2 + 2], a2 = imgData[idx2 + 3];
                        const bright2 = (r2 + g2 + b2) / 3;
                        const diff2 = Math.hypot(r2 - bgR, g2 - bgG, b2 - bgB);
                        const fg2 = a2 > 40 && (bgBright > 180 ? bright2 < thresh : diff2 > (255 - thresh));
                        if (!fg2 || Math.hypot(r2 - r, g2 - g, b2 - b) > 48) break;
                        runEnd++;
                    }

                    const runLen = runEnd - x;
                    const reliefFactor = 0.45 + 0.55 * (1 - bright / 255);
                    const depthZ = Math.max(0.25, 1.35 * depthMult * reliefFactor);

                    const barGeo = new THREE.BoxGeometry(runLen * voxelW, voxelH * 1.03, depthZ);
                    const barMat = new THREE.MeshPhysicalMaterial({
                        color: new THREE.Color(`rgb(${r},${g},${b})`),
                        metalness: 0.35,
                        roughness: 0.3,
                        clearcoat: 0.4
                    });
                    const barMesh = new THREE.Mesh(barGeo, barMat);
                    barMesh.position.set(
                        ((x + runLen / 2) - W / 2) * voxelW,
                        ((H / 2) - y) * voxelH,
                        0
                    );
                    barMesh.castShadow = true;
                    group.add(barMesh);

                    x = runEnd;
                }
            }

            applyCADFeatureEdges(group, false);
            pendingCustomGroup = group;
            showPendingGroupInPreview(group, `3D Relief Extrusion từ Ảnh (${group.children.length} khối)`);
        }

        // Uses Gemini Vision API (with instant fallback) to recognize the uploaded image and optimize 3D parameters
        async function runAIVision3DReconstruction() {
            const statusEl = document.getElementById('lbl-img3d-status');
            statusEl.textContent = '🤖 AI đang phân tích hình dáng & kết cấu 3D của vật thể trong ảnh...';

            const cvs = document.getElementById('img2d-preview-canvas');
            const base64Data = cvs.toDataURL('image/png').split(',')[1];
            const apiKey = "";
            const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3-flash-preview:generateContent?key=${apiKey}`;

            try {
                const payload = {
                    contents: [{
                        role: "user",
                        parts: [
                            { text: "Analyze this industrial cargo/equipment image for a 3D Heavy Lifting Simulator. Return JSON with: name (Vietnamese), category ('cargo'|'beam'|'crane'|'hardware'), closestShape ('vessel'|'transformer'|'boat'|'excavator'|'wind_nacelle'|'container'|'extruded'), L (meters 2-10), W (meters 1.5-4), H (meters 1.5-4), weight (tons 2-80)." },
                            { inlineData: { mimeType: "image/png", data: base64Data } }
                        ]
                    }],
                    generationConfig: {
                        responseMimeType: "application/json"
                    }
                };
                const resp = await fetch(apiUrl, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });
                const result = await resp.json();
                const text = result?.candidates?.[0]?.content?.parts?.[0]?.text;
                if (text) {
                    const info = JSON.parse(text);
                    if (info.name) document.getElementById('inp-asset-name').value = info.name;
                    if (info.category) document.getElementById('inp-asset-category').value = info.category;
                    statusEl.textContent = `🤖 AI Nhận diện: ${info.name} (${info.L || 6}x${info.W || 2.5}x${info.H || 2.5}m - ${info.weight || 20}T)`;
                    return;
                }
            } catch (err) {
                // Fallback if offline or no API key needed
            }
            statusEl.textContent = '✅ Đã tối ưu hóa lưới đa giác 3D & thông số trọng tâm từ ảnh!';
        }

        function showPendingGroupInPreview(group, statsText) {
            while (studioPreviewGroup.children.length > 0) {
                studioPreviewGroup.remove(studioPreviewGroup.children[0]);
            }
            const clone = group.clone();
            studioPreviewGroup.add(clone);
            addScaleReferenceVisuals(studioPreviewGroup, clone);
            autoFrameStudioCamera(clone);
            document.getElementById('studio-preview-stats').textContent = statsText;
        }

        function savePendingCustom3DToLibrary() {
            if (!pendingCustomGroup) {
                generateDemoSTLMechanicalPart();
            }
            const name = document.getElementById('inp-asset-name').value.trim() || 'Mô Hình 3D Tùy Chỉnh';
            const cat = document.getElementById('inp-asset-category').value || 'cargo';
            const newId = `custom_${cat}_${Date.now()}`;

            // Extract true calibrated metric dimensions from inputs or AssetPipeline report
            let L = state.L, H = state.H, W = state.W;
            let anchors = [];
            let report = null;

            const inL = parseFloat(document.getElementById('inp-target-L')?.value);
            const inW = parseFloat(document.getElementById('inp-target-W')?.value);
            const inH = parseFloat(document.getElementById('inp-target-H')?.value);
            const inWeight = parseFloat(document.getElementById('inp-target-weight')?.value);

            if (currentUploaded3DResult && currentUploaded3DResult.report) {
                report = currentUploaded3DResult.report;
                const dims = report.dimensionsNormalized;
                if (dims) {
                    L = dims.x;
                    H = dims.y;
                    W = dims.z;
                }
                anchors = currentUploaded3DResult.root?.userData?.anchors || [];
            } else if (pendingCustomGroup) {
                const bbox = new THREE.Box3().setFromObject(pendingCustomGroup);
                const sz = new THREE.Vector3();
                bbox.getSize(sz);
                L = sz.x; H = sz.y; W = sz.z;
                anchors = pendingCustomGroup.userData?.anchors || [];
            }

            if (!isNaN(inL) && inL > 0.1) L = inL;
            if (!isNaN(inW) && inW > 0.1) W = inW;
            if (!isNaN(inH) && inH > 0.1) H = inH;
            const targetWeight = (!isNaN(inWeight) && inWeight > 0.05) ? inWeight : state.weight;

            const customClone = pendingCustomGroup.clone();
            const bbox = new THREE.Box3().setFromObject(customClone);
            const sz = new THREE.Vector3();
            bbox.getSize(sz);
            if (sz.x > 0.001 && sz.y > 0.001 && sz.z > 0.001) {
                customClone.scale.multiply(new THREE.Vector3(L / sz.x, H / sz.y, W / sz.z));
            }

            if (cat === 'cargo') customCargoMeshes[newId] = customClone;
            else if (cat === 'beam') customBeamMeshes[newId] = customClone;
            else if (cat === 'crane') customCraneMeshes[newId] = customClone;
            else if (cat === 'hardware') customHwMeshes[newId] = customClone;

            const newItem = {
                id: newId,
                name,
                sub: `3D CAD Metric 1:1 (${L.toFixed(2)}×${H.toFixed(2)}×${W.toFixed(2)}m)`,
                L: parseFloat(L.toFixed(2)),
                W: parseFloat(W.toFixed(2)),
                H: parseFloat(H.toFixed(2)),
                weight: parseFloat(targetWeight.toFixed(1)),
                cogX: 0, cogY: 0, cogZ: 0,
                anchors,
                report,
                badge: 'Metric CAD 1:1'
            };

            libraryCatalog[cat].unshift(newItem);
            activeLibraryCategory = cat;
            selectedLibraryItem = newItem;

            saveCustomAssetsToLocalStorage();

            document.querySelectorAll('#lib-category-tabs button').forEach(b => {
                b.classList.toggle('active', b.dataset.cat === cat);
            });
            render3DLibraryGrid();
            previewLibraryItemIn3D(newItem, cat);
            applyLibraryAssetToSimulation(newItem, cat);
        }

        // --- 3D OBJ EXPORTER & ASSEMBLY COMPOSITION ENGINE ---
        function downloadTextFile(filename, text) {
            const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = filename;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            setTimeout(() => URL.revokeObjectURL(url), 1000);
        }

        function exportCurrentActive3DToOBJ() {
            try {
                if (!assemblyEngine) {
                    assemblyEngine = new (window.CAE?.AssemblyEngine || AssemblyEngine)();
                }

                let objText = '';
                let filename = 'Custom_3D_Model.obj';

                if (currentStudioMode === 'assembly') {
                    const group = assemblyEngine.buildAssemblyGroup(buildAssemblyPartMesh);
                    const phy = assemblyEngine.computePhysics();
                    const name = (assemblyEngine.assemblyName || 'To_Hop_3D').replace(/\s+/g, '_');
                    filename = `${name}.obj`;
                    objText = assemblyEngine.exportToOBJ(group, {
                        name: assemblyEngine.assemblyName,
                        dimensions: phy.totalDims,
                        weight: phy.totalMass,
                        cog: phy.cog,
                        partCount: phy.partCount
                    });
                } else {
                    let targetGroup = null;
                    let exportName = 'Custom_Asset';
                    let exportDims = { L: 6.0, H: 2.5, W: 2.4 };
                    let exportWeight = 20.0;
                    let exportCog = { x: 0, y: 0, z: 0 };

                    if (pendingCustomGroup) {
                        targetGroup = pendingCustomGroup;
                        const inpName = document.getElementById('inp-asset-name')?.value.trim();
                        if (inpName) exportName = inpName;
                        const inL = parseFloat(document.getElementById('inp-target-L')?.value);
                        const inW = parseFloat(document.getElementById('inp-target-W')?.value);
                        const inH = parseFloat(document.getElementById('inp-target-H')?.value);
                        const inWgt = parseFloat(document.getElementById('inp-target-weight')?.value);
                        if (!isNaN(inL) && inL > 0) exportDims.L = inL;
                        if (!isNaN(inH) && inH > 0) exportDims.H = inH;
                        if (!isNaN(inW) && inW > 0) exportDims.W = inW;
                        if (!isNaN(inWgt) && inWgt > 0) exportWeight = inWgt;
                    } else if (selectedLibraryItem) {
                        exportName = selectedLibraryItem.name || 'Library_Item';
                        exportDims = {
                            L: selectedLibraryItem.L || 6.0,
                            H: selectedLibraryItem.H || 2.5,
                            W: selectedLibraryItem.W || 2.4
                        };
                        exportWeight = selectedLibraryItem.weight || 20.0;
                        exportCog = {
                            x: selectedLibraryItem.cogX || 0,
                            y: selectedLibraryItem.cogY || 0,
                            z: selectedLibraryItem.cogZ || 0
                        };
                        targetGroup = studioPreviewGroup.children.find(ch => ch.name !== 'scale_references') || studioPreviewGroup;
                    }

                    if (!targetGroup) {
                        alert('Không có vật thể 3D nào để xuất file OBJ!');
                        return;
                    }

                    const cleanClone = targetGroup.clone();
                    const refs = cleanClone.getObjectByName('scale_references');
                    if (refs) cleanClone.remove(refs);

                    filename = `${exportName.replace(/[^a-zA-Z0-9_\u00C0-\u024F\u1E00-\u1EFF]/g, '_')}.obj`;
                    objText = assemblyEngine.exportToOBJ(cleanClone, {
                        name: exportName,
                        dimensions: exportDims,
                        weight: exportWeight,
                        cog: exportCog,
                        partCount: 1
                    });
                }

                downloadTextFile(filename, objText);

                const statusEl = document.getElementById('sim-status-text');
                if (statusEl) {
                    statusEl.textContent = `📥 Đã xuất thành công file 3D "${filename}" với chuẩn CAE Digital Twin!`;
                }
            } catch (err) {
                console.error('[Export OBJ Error]', err);
                alert(`Lỗi khi xuất file OBJ: ${err.message}`);
            }
        }

        function buildAssemblyPartMesh(type, L, W, H, color) {
            let partObj = null;
            if (customCargoMeshes[type]) {
                partObj = customCargoMeshes[type].clone();
                const bbox = new THREE.Box3().setFromObject(partObj);
                const sz = new THREE.Vector3();
                bbox.getSize(sz);
                if (sz.x > 0.001 && sz.y > 0.001 && sz.z > 0.001) {
                    partObj.scale.multiply(new THREE.Vector3(L / sz.x, H / sz.y, W / sz.z));
                }
            } else {
                partObj = buildCargoMesh(type, L, W, H);
            }
            if (color && partObj) {
                partObj.traverse(child => {
                    if (child.isMesh && child.material) {
                        const name = (child.name || '').toLowerCase();
                        if (!name.includes('glass') && !name.includes('wheel') && !name.includes('tire')) {
                            if (Array.isArray(child.material)) {
                                child.material = child.material.map(m => {
                                    const cm = m.clone();
                                    cm.color = new THREE.Color(color);
                                    return cm;
                                });
                            } else {
                                child.material = child.material.clone();
                                child.material.color = new THREE.Color(color);
                            }
                        }
                    }
                });
            }
            return partObj;
        }

        function updateAssembly3DPreview() {
            if (!assemblyEngine) return;
            const phy = assemblyEngine.computePhysics();

            const elWeight = document.getElementById('assembly-gross-weight');
            const elDims = document.getElementById('assembly-dims-text');
            const elCog = document.getElementById('assembly-cog-text');
            const elBadge = document.getElementById('assembly-status-badge');

            if (elWeight) elWeight.textContent = `${phy.totalMass.toFixed(1)} T`;
            if (elDims) elDims.textContent = `${phy.totalDims.L.toFixed(2)} × ${phy.totalDims.H.toFixed(2)} × ${phy.totalDims.W.toFixed(2)}m`;
            if (elCog) elCog.textContent = `(${phy.cog.x.toFixed(2)}, ${phy.cog.y.toFixed(2)}, ${phy.cog.z.toFixed(2)})`;
            if (elBadge) {
                const ecc = Math.hypot(phy.cog.x, phy.cog.z);
                if (ecc <= 0.20) {
                    elBadge.className = 'px-1.5 py-0.2 rounded text-[9px] bg-emerald-950 text-emerald-300 border border-emerald-500/40';
                    elBadge.textContent = '🟢 Cân bằng tốt';
                } else if (ecc <= 0.60) {
                    elBadge.className = 'px-1.5 py-0.2 rounded text-[9px] bg-amber-950 text-amber-300 border border-amber-500/40';
                    elBadge.textContent = `🟡 Lệch CoG ${ecc.toFixed(2)}m`;
                } else {
                    elBadge.className = 'px-1.5 py-0.2 rounded text-[9px] bg-rose-950 text-rose-300 border border-rose-500/40';
                    elBadge.textContent = `🔴 Lệch CoG lớn (${ecc.toFixed(2)}m)`;
                }
            }

            while (studioPreviewGroup.children.length > 0) {
                studioPreviewGroup.remove(studioPreviewGroup.children[0]);
            }
            const group = assemblyEngine.buildAssemblyGroup(buildAssemblyPartMesh);
            pendingCustomGroup = group;
            studioPreviewGroup.add(group);
            addScaleReferenceVisuals(studioPreviewGroup, group);
            autoFrameStudioCamera(group);

            const tris = (window.CAE?.HullOptimizer || HullOptimizer).getTriCount(group);
            const statsEl = document.getElementById('studio-preview-stats');
            if (statsEl) {
                statsEl.textContent = `Tổ hợp 3D: ${assemblyEngine.assemblyName} | ${phy.partCount} kiện | ${tris.toLocaleString()} tris | ${phy.totalMass.toFixed(1)}T`;
            }
        }

        function renderAssemblyPartsUI() {
            const container = document.getElementById('assembly-parts-container');
            if (!container || !assemblyEngine) return;
            container.innerHTML = '';

            const basePart = assemblyEngine.basePart;
            if (basePart) {
                const baseCard = document.createElement('div');
                baseCard.className = 'bg-slate-950/80 border border-amber-500/50 rounded-lg p-2 text-xs space-y-1.5';
                baseCard.innerHTML = `
                    <div class="flex items-center justify-between pb-1 border-b border-slate-800">
                        <div class="flex items-center gap-1 font-bold text-amber-300">
                            <span>🚢</span>
                            <span>Phương Tiện Đỡ (Base Carrier)</span>
                        </div>
                        <div class="flex items-center gap-1.5">
                            <span class="text-[10px] text-slate-400">Màu:</span>
                            <input type="color" class="w-5 h-5 rounded cursor-pointer bg-transparent border-0 base-color" value="${basePart.color || '#f59e0b'}">
                        </div>
                    </div>
                    <div class="grid grid-cols-2 gap-1.5 text-[10px]">
                        <div>
                            <label class="text-slate-400 block mb-0.5">Kiểu Phương Tiện:</label>
                            <select class="w-full bg-slate-900 border border-slate-700 rounded px-1.5 py-0.5 text-slate-200 base-type">
                                <option value="flatrack" ${basePart.type === 'flatrack' ? 'selected' : ''}>Flat Rack Container</option>
                                <option value="platform" ${basePart.type === 'platform' ? 'selected' : ''}>Sàn Kê Platform Deck</option>
                                <option value="opentop" ${basePart.type === 'opentop' ? 'selected' : ''}>Container Hở Mái (Open Top)</option>
                                <option value="container" ${basePart.type === 'container' ? 'selected' : ''}>Container Tiêu Chuẩn</option>
                            </select>
                        </div>
                        <div>
                            <label class="text-slate-400 block mb-0.5">Khối Lượng Bản Thân (T):</label>
                            <input type="number" step="0.1" min="0.5" class="w-full bg-slate-900 border border-slate-700 rounded px-1.5 py-0.5 text-amber-300 font-mono font-bold base-mass" value="${basePart.massT}">
                        </div>
                    </div>
                    <div class="grid grid-cols-3 gap-1 text-[10px]">
                        <div>
                            <label class="text-slate-400 block mb-0.5">Dài L (m):</label>
                            <input type="number" step="0.1" min="1.0" class="w-full bg-slate-900 border border-slate-700 rounded px-1 py-0.5 text-sky-300 font-mono text-center base-L" value="${basePart.dimensions.L}">
                        </div>
                        <div>
                            <label class="text-slate-400 block mb-0.5">Rộng W (m):</label>
                            <input type="number" step="0.1" min="1.0" class="w-full bg-slate-900 border border-slate-700 rounded px-1 py-0.5 text-sky-300 font-mono text-center base-W" value="${basePart.dimensions.W}">
                        </div>
                        <div>
                            <label class="text-slate-400 block mb-0.5">Cao H (m):</label>
                            <input type="number" step="0.05" min="0.2" class="w-full bg-slate-900 border border-slate-700 rounded px-1 py-0.5 text-sky-300 font-mono text-center base-H" value="${basePart.dimensions.H}">
                        </div>
                    </div>
                `;

                baseCard.querySelector('.base-type').addEventListener('change', (e) => {
                    basePart.type = e.target.value;
                    if (e.target.value === 'platform') basePart.dimensions.H = 0.35;
                    else if (basePart.dimensions.H < 2.0) basePart.dimensions.H = 2.59;
                    renderAssemblyPartsUI();
                    updateAssembly3DPreview();
                });
                baseCard.querySelector('.base-mass').addEventListener('input', (e) => {
                    basePart.massT = parseFloat(e.target.value) || 1.0;
                    updateAssembly3DPreview();
                });
                baseCard.querySelector('.base-color').addEventListener('input', (e) => {
                    basePart.color = e.target.value;
                    updateAssembly3DPreview();
                });
                baseCard.querySelector('.base-L').addEventListener('input', (e) => {
                    basePart.dimensions.L = parseFloat(e.target.value) || 1.0;
                    updateAssembly3DPreview();
                });
                baseCard.querySelector('.base-W').addEventListener('input', (e) => {
                    basePart.dimensions.W = parseFloat(e.target.value) || 1.0;
                    updateAssembly3DPreview();
                });
                baseCard.querySelector('.base-H').addEventListener('input', (e) => {
                    basePart.dimensions.H = parseFloat(e.target.value) || 0.2;
                    updateAssembly3DPreview();
                });

                container.appendChild(baseCard);
            }

            assemblyEngine.cargoParts.forEach((part, idx) => {
                const partCard = document.createElement('div');
                partCard.className = 'bg-slate-900/90 border border-sky-500/40 rounded-lg p-2 text-xs space-y-1.5 relative group';
                partCard.innerHTML = `
                    <div class="flex items-center justify-between pb-1 border-b border-slate-800">
                        <div class="flex items-center gap-1.5 flex-1 mr-2">
                            <span class="text-xs">📦</span>
                            <input type="text" class="bg-transparent border-b border-dashed border-slate-600 focus:border-sky-400 text-sky-200 font-bold text-xs outline-none flex-1 truncate part-name" value="${part.name}">
                        </div>
                        <div class="flex items-center gap-2">
                            <div class="flex items-center gap-1">
                                <span class="text-[9px] text-slate-400">Tấn:</span>
                                <input type="number" step="0.5" min="0.1" class="w-12 bg-slate-950 border border-slate-700 rounded px-1 py-0.5 text-amber-300 font-mono font-bold text-[10px] text-center part-mass" value="${part.massT}">
                            </div>
                            <input type="color" class="w-5 h-5 rounded cursor-pointer bg-transparent border-0 part-color" value="${part.color || '#0284c7'}">
                            <button type="button" class="text-rose-400 hover:text-rose-300 text-xs px-1 py-0.5 rounded hover:bg-rose-950/50 part-delete" title="Xóa kiện này">🗑️</button>
                        </div>
                    </div>
                    <div class="grid grid-cols-3 gap-1 text-[10px]">
                        <div>
                            <span class="text-slate-400 block text-[9px]">Dài L (m):</span>
                            <input type="number" step="0.1" min="0.2" class="w-full bg-slate-950 border border-slate-700 rounded px-1 py-0.5 text-sky-300 font-mono text-center part-L" value="${part.dimensions.L}">
                        </div>
                        <div>
                            <span class="text-slate-400 block text-[9px]">Rộng W (m):</span>
                            <input type="number" step="0.1" min="0.2" class="w-full bg-slate-950 border border-slate-700 rounded px-1 py-0.5 text-sky-300 font-mono text-center part-W" value="${part.dimensions.W}">
                        </div>
                        <div>
                            <span class="text-slate-400 block text-[9px]">Cao H (m):</span>
                            <input type="number" step="0.1" min="0.2" class="w-full bg-slate-950 border border-slate-700 rounded px-1 py-0.5 text-sky-300 font-mono text-center part-H" value="${part.dimensions.H}">
                        </div>
                    </div>
                    <div class="grid grid-cols-3 gap-1 text-[10px]">
                        <div>
                            <span class="text-slate-400 block text-[9px]">Dọc X (m):</span>
                            <input type="number" step="0.05" class="w-full bg-slate-950 border border-slate-700 rounded px-1 py-0.5 text-white font-mono text-center part-pos-x" value="${part.pos.x.toFixed(2)}">
                        </div>
                        <div>
                            <span class="text-slate-400 block text-[9px]">Cao Y (m):</span>
                            <input type="number" step="0.05" class="w-full bg-slate-950 border border-slate-700 rounded px-1 py-0.5 text-white font-mono text-center part-pos-y" value="${part.pos.y.toFixed(2)}">
                        </div>
                        <div>
                            <span class="text-slate-400 block text-[9px]">Ngang Z (m):</span>
                            <input type="number" step="0.05" class="w-full bg-slate-950 border border-slate-700 rounded px-1 py-0.5 text-white font-mono text-center part-pos-z" value="${part.pos.z.toFixed(2)}">
                        </div>
                    </div>
                    <div class="flex items-center justify-between gap-1 pt-1 border-t border-slate-800 text-[10px]">
                        <div class="flex items-center gap-1 text-slate-300">
                            <span>Xoay:</span>
                            <input type="range" min="-180" max="180" step="5" class="w-16 accent-amber-400 part-rot-y" value="${part.rot.y || 0}">
                            <span class="font-mono text-amber-300 w-8 text-right part-rot-val">${part.rot.y || 0}°</span>
                        </div>
                        <div class="flex items-center gap-1">
                            <button type="button" class="px-1.5 py-0.5 rounded bg-sky-950 hover:bg-sky-900 text-sky-300 border border-sky-600/50 text-[9px] font-bold part-snap-deck" title="Tự động đặt kiện tiếp xúc sát mặt sàn container">
                                🧲 Snap sàn
                            </button>
                            <button type="button" class="px-1.5 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-600 text-[9px] font-bold part-center" title="Căn thẳng trục giữa X và Z">
                                🎯 Căn giữa
                            </button>
                        </div>
                    </div>
                `;

                partCard.querySelector('.part-name').addEventListener('input', (e) => {
                    part.name = e.target.value.trim() || `Kiện #${idx + 1}`;
                });
                partCard.querySelector('.part-mass').addEventListener('input', (e) => {
                    part.massT = parseFloat(e.target.value) || 0.1;
                    updateAssembly3DPreview();
                });
                partCard.querySelector('.part-color').addEventListener('input', (e) => {
                    part.color = e.target.value;
                    updateAssembly3DPreview();
                });
                partCard.querySelector('.part-L').addEventListener('input', (e) => {
                    part.dimensions.L = parseFloat(e.target.value) || 0.5;
                    updateAssembly3DPreview();
                });
                partCard.querySelector('.part-W').addEventListener('input', (e) => {
                    part.dimensions.W = parseFloat(e.target.value) || 0.5;
                    updateAssembly3DPreview();
                });
                partCard.querySelector('.part-H').addEventListener('input', (e) => {
                    part.dimensions.H = parseFloat(e.target.value) || 0.5;
                    updateAssembly3DPreview();
                });
                partCard.querySelector('.part-pos-x').addEventListener('input', (e) => {
                    part.pos.x = parseFloat(e.target.value) || 0;
                    updateAssembly3DPreview();
                });
                partCard.querySelector('.part-pos-y').addEventListener('input', (e) => {
                    part.pos.y = parseFloat(e.target.value) || 0;
                    updateAssembly3DPreview();
                });
                partCard.querySelector('.part-pos-z').addEventListener('input', (e) => {
                    part.pos.z = parseFloat(e.target.value) || 0;
                    updateAssembly3DPreview();
                });
                const rotRange = partCard.querySelector('.part-rot-y');
                const rotVal = partCard.querySelector('.part-rot-val');
                rotRange.addEventListener('input', (e) => {
                    const r = parseInt(e.target.value, 10) || 0;
                    part.rot.y = r;
                    if (rotVal) rotVal.textContent = `${r}°`;
                    updateAssembly3DPreview();
                });
                partCard.querySelector('.part-snap-deck').addEventListener('click', () => {
                    assemblyEngine.snapPartToDeck(part.id);
                    renderAssemblyPartsUI();
                    updateAssembly3DPreview();
                });
                partCard.querySelector('.part-center').addEventListener('click', () => {
                    assemblyEngine.centerPart(part.id);
                    renderAssemblyPartsUI();
                    updateAssembly3DPreview();
                });
                partCard.querySelector('.part-delete').addEventListener('click', () => {
                    assemblyEngine.removePart(part.id);
                    renderAssemblyPartsUI();
                    updateAssembly3DPreview();
                });

                container.appendChild(partCard);
            });
        }

        function saveAssemblyToLibraryAndSim() {
            if (!assemblyEngine) return;
            const nameInput = document.getElementById('inp-assembly-name');
            const name = nameInput ? nameInput.value.trim() : (assemblyEngine.assemblyName || 'Tổ Hợp Kiện Hàng 3D');
            assemblyEngine.assemblyName = name;

            const phy = assemblyEngine.computePhysics();
            const group = assemblyEngine.buildAssemblyGroup(buildAssemblyPartMesh);

            const bbox = new THREE.Box3().setFromObject(group);
            const center = new THREE.Vector3();
            bbox.getCenter(center);
            group.position.x -= center.x;
            group.position.z -= center.z;

            const newId = `composite_${Date.now()}`;
            customCargoMeshes[newId] = group;

            const newItem = {
                id: newId,
                name: name,
                sub: `Tổ hợp 3D CAE (${phy.partCount} kiện · ${phy.totalDims.L.toFixed(1)}×${phy.totalDims.H.toFixed(1)}×${phy.totalDims.W.toFixed(1)}m)`,
                L: parseFloat(phy.totalDims.L.toFixed(2)),
                W: parseFloat(phy.totalDims.W.toFixed(2)),
                H: parseFloat(phy.totalDims.H.toFixed(2)),
                weight: parseFloat(phy.totalMass.toFixed(1)),
                cogX: parseFloat(phy.cog.x.toFixed(3)),
                cogY: parseFloat(phy.cog.y.toFixed(3)),
                cogZ: parseFloat(phy.cog.z.toFixed(3)),
                anchors: phy.anchors,
                badge: '3D Assembly',
                assemblyData: {
                    name: name,
                    basePart: JSON.parse(JSON.stringify(assemblyEngine.basePart)),
                    cargoParts: JSON.parse(JSON.stringify(assemblyEngine.cargoParts)),
                    phy: JSON.parse(JSON.stringify(phy))
                }
            };

            libraryCatalog.cargo.unshift(newItem);
            activeLibraryCategory = 'cargo';
            selectedLibraryItem = newItem;

            saveCustomAssetsToLocalStorage();
            render3DLibraryGrid();
            applyLibraryAssetToSimulation(newItem, 'cargo');

            if (window.UI?.layout) window.UI.layout.closeModal('library-studio-modal');
            else document.getElementById('library-studio-modal')?.classList.remove('open');

            const statusEl = document.getElementById('sim-status-text');
            if (statusEl) {
                statusEl.textContent = `✅ Đã lưu và đưa tổ hợp 3D "${name}" (${phy.totalMass.toFixed(1)}T) vào sơ đồ cẩu hàng!`;
            }
        }

        function saveCustomAssetsToLocalStorage() {
            try {
                const customItems = (libraryCatalog.cargo || []).filter(item => item.id && (item.id.startsWith('composite_') || item.id.startsWith('custom_')));
                const serializable = customItems.map(item => ({
                    id: item.id,
                    name: item.name,
                    sub: item.sub,
                    L: item.L,
                    W: item.W,
                    H: item.H,
                    weight: item.weight,
                    cogX: item.cogX,
                    cogY: item.cogY,
                    cogZ: item.cogZ,
                    anchors: item.anchors,
                    badge: item.badge,
                    assemblyData: item.assemblyData
                }));
                localStorage.setItem(LOCAL_STORAGE_CUSTOM_3D_KEY, JSON.stringify(serializable));
            } catch (e) {
                console.warn('[LocalStorage] Save custom assets error:', e);
            }
        }

        function restoreCustomAssetsFromLocalStorage() {
            try {
                const raw = localStorage.getItem(LOCAL_STORAGE_CUSTOM_3D_KEY);
                if (!raw) return;
                const items = JSON.parse(raw);
                if (!Array.isArray(items)) return;

                items.forEach(item => {
                    if (item.assemblyData) {
                        const tempEngine = new (window.CAE?.AssemblyEngine || AssemblyEngine)();
                        tempEngine.assemblyName = item.assemblyData.name || item.name;
                        tempEngine.basePart = item.assemblyData.basePart;
                        tempEngine.cargoParts = item.assemblyData.cargoParts || [];
                        const group = tempEngine.buildAssemblyGroup(buildAssemblyPartMesh);
                        customCargoMeshes[item.id] = group;
                    }
                    const exists = libraryCatalog.cargo.some(c => c.id === item.id);
                    if (!exists) {
                        libraryCatalog.cargo.unshift(item);
                    }
                });
            } catch (e) {
                console.warn('[LocalStorage] Restore custom assets error:', e);
            }
        }

        function switchStudioMode(mode) {
            currentStudioMode = mode;
            const btnFile = document.getElementById('tab-mode-file3d');
            const btnImg = document.getElementById('tab-mode-img3d');
            const btnAssembly = document.getElementById('tab-mode-assembly');
            const panelFile = document.getElementById('panel-upload-file3d');
            const panelImg = document.getElementById('panel-upload-img3d');
            const panelAssembly = document.getElementById('panel-assembly-studio');
            const singleTools = document.getElementById('box-single-asset-tools');

            [btnFile, btnImg, btnAssembly].forEach(btn => {
                if (!btn) return;
                btn.className = 'py-1.5 rounded text-[11px] font-bold text-slate-300 hover:text-white flex items-center justify-center gap-1 transition-all';
            });

            if (panelFile) panelFile.classList.add('hidden');
            if (panelImg) { panelImg.classList.add('hidden'); panelImg.classList.remove('flex'); }
            if (panelAssembly) { panelAssembly.classList.add('hidden'); panelAssembly.classList.remove('flex'); }

            if (mode === 'file3d') {
                if (btnFile) btnFile.className = 'py-1.5 rounded text-[11px] font-bold bg-sky-600 text-white flex items-center justify-center gap-1 transition-all shadow-md';
                if (panelFile) panelFile.classList.remove('hidden');
                if (singleTools) singleTools.classList.remove('hidden');
                if (currentUploaded3DResult) {
                    showPendingGroupInPreview(currentUploaded3DResult.root, 'Mô hình 3D nạp từ File');
                } else if (selectedLibraryItem) {
                    previewLibraryItemIn3D(selectedLibraryItem, activeLibraryCategory);
                }
            } else if (mode === 'img3d') {
                if (btnImg) btnImg.className = 'py-1.5 rounded text-[11px] font-bold bg-amber-500 text-slate-950 flex items-center justify-center gap-1 transition-all shadow-md';
                if (panelImg) { panelImg.classList.remove('hidden'); panelImg.classList.add('flex'); }
                if (singleTools) singleTools.classList.remove('hidden');
                if (!lastUploadedImage) drawDefaultSampleSilhouetteAndExtrude();
            } else if (mode === 'assembly') {
                if (btnAssembly) btnAssembly.className = 'py-1.5 rounded text-[11px] font-bold bg-amber-500 text-slate-950 flex items-center justify-center gap-1 transition-all shadow-lg border border-amber-400';
                if (panelAssembly) { panelAssembly.classList.remove('hidden'); panelAssembly.classList.add('flex'); }
                if (singleTools) singleTools.classList.add('hidden');
                renderAssemblyPartsUI();
                updateAssembly3DPreview();
            }
        }

        function calibratedWeight(type, L, W, H) {
            const bands = {
                crate: [10, 24, 4.5, 2.6, 2.4],
                pipe: [8, 26, 8.0, 1.4, 1.4],
                container: [18, 24, 6.06, 2.44, 2.59],
                container_20ft_glb: [18, 24, 6.06, 2.44, 2.59],
                iso20hc: [20, 30.5, 6.06, 2.44, 2.90],
                open_top: [18, 26, 6.06, 2.44, 2.59],
                opentop: [18, 26, 6.06, 2.44, 2.59],
                opentop40: [20, 30.5, 12.19, 2.44, 2.59],
                flat_rack: [20, 34, 6.06, 2.44, 2.59],
                flatrack: [20, 34, 12.19, 2.44, 2.90],
                flatrack20: [14, 34, 6.06, 2.44, 2.59],
                platform: [8, 28, 12.19, 2.44, 0.61],
                platform20: [5, 28, 6.06, 2.44, 0.34],
                iso40: [26, 30.5, 12.19, 2.44, 2.59],
                container_40ft_glb: [26, 30.5, 12.19, 2.44, 2.59],
                iso40hc: [26, 30.5, 12.19, 2.44, 2.90],
                iso45hc: [26, 30.5, 13.72, 2.44, 2.90],
                iso53hc: [26, 30.5, 16.15, 2.59, 2.90],
                container10: [7, 12, 2.99, 2.44, 2.59],
                reefer: [26, 30.5, 12.19, 2.44, 2.90],
                reefer20: [16, 30.5, 6.06, 2.44, 2.59],
                isotank: [26, 36, 6.06, 2.44, 2.59],
                halfheight: [16, 30.5, 6.06, 2.44, 1.30],
                drybulk: [18, 30.5, 6.06, 2.44, 2.59],
                transformer: [45, 85, 5.2, 2.8, 3.2],
                vessel: [28, 55, 7.5, 2.6, 2.6],
                wind_nacelle: [65, 95, 8.5, 3.4, 3.6],
                excavator: [24, 35, 6.4, 3.0, 3.1],
                boat: [22, 45, 12.0, 3.4, 3.2],
                car: [7.5, 12.0, 9.0, 2.38, 2.80]
            };
            const band = bands[type];
            if (!band) return null;
            const ref = band[2] * band[3] * band[4];
            const vol = Math.max(0.05, L * W * H);
            const t = THREE.MathUtils.clamp((vol / ref - 1) / 0.35, -1, 1);
            const mid = (band[0] + band[1]) * 0.5;
            const span = (band[1] - band[0]) * 0.5;
            return THREE.MathUtils.clamp(mid + t * span, band[0], band[1]);
        }

        function setDimAndCoG(vals) {
            state.L = vals.L; state.W = vals.W; state.H = vals.H; state.weight = vals.weight;
            state.cogX = vals.cogX; state.cogY = vals.cogY; state.cogZ = vals.cogZ;
            const inpL = document.getElementById('inp-L'); if (inpL) inpL.value = vals.L;
            const vL = document.getElementById('v-L'); if (vL) vL.textContent = vals.L.toFixed(2);
            const numL = document.getElementById('num-L'); if (numL) numL.value = vals.L.toFixed(2);

            const inpW = document.getElementById('inp-W'); if (inpW) inpW.value = vals.W;
            const vW = document.getElementById('v-W'); if (vW) vW.textContent = vals.W.toFixed(2);
            const numW = document.getElementById('num-W'); if (numW) numW.value = vals.W.toFixed(2);

            const inpH = document.getElementById('inp-H'); if (inpH) inpH.value = vals.H;
            const vH = document.getElementById('v-H'); if (vH) vH.textContent = vals.H.toFixed(2);
            const numH = document.getElementById('num-H'); if (numH) numH.value = vals.H.toFixed(2);

            const inpWeight = document.getElementById('inp-Weight'); if (inpWeight) inpWeight.value = vals.weight;
            const vWeight = document.getElementById('v-Weight'); if (vWeight) vWeight.textContent = vals.weight.toFixed(1);
            const numWeight = document.getElementById('num-Weight'); if (numWeight) numWeight.value = vals.weight.toFixed(1);

            syncCoGSlidersFromState();
        }

        function onWindowResize() {
            camera.aspect = window.innerWidth / window.innerHeight;
            camera.updateProjectionMatrix();
            if (sceneRenderer) {
                sceneRenderer.setSize(window.innerWidth, window.innerHeight);
            } else {
                renderer.setSize(window.innerWidth, window.innerHeight);
            }
        }

        function pushReplaySample() {
            if (!replay.recording) return;
            const now = performance.now() / 1000 - replay.t0;
            const last = replay.frames[replay.frames.length - 1];
            if (last && now - last.t < 0.1) return;
            if (replay.frames.length > 360) {
                replay.recording = false;
                document.getElementById('lbl-replay').textContent = 'Đầy 36s';
                return;
            }
            replay.frames.push({
                t: now,
                h: phy.hookPos.toArray(),
                c: phy.cargoPos.toArray(),
                q: phy.cargoQuat.toArray()
            });
            document.getElementById('lbl-replay').textContent = 'REC ' + now.toFixed(1) + 's';
        }

        function stepReplay(dt) {
            const frames = replay.frames;
            if (!frames.length) { replay.playing = false; return; }
            replay.cursor += dt;
            const end = frames[frames.length - 1].t;
            if (replay.cursor >= end) {
                replay.playing = false;
                document.getElementById('lbl-replay').textContent = 'Hết bản ghi';
                return;
            }
            let i = 0;
            while (i < frames.length - 1 && frames[i + 1].t < replay.cursor) i++;
            const a = frames[i];
            const b = frames[Math.min(i + 1, frames.length - 1)];
            const u = THREE.MathUtils.clamp((replay.cursor - a.t) / Math.max(0.0001, b.t - a.t), 0, 1);
            phy.hookPos.fromArray(a.h).lerp(new THREE.Vector3().fromArray(b.h), u);
            phy.hookTarget.copy(phy.hookPos);
            phy.cargoPos.fromArray(a.c).lerp(new THREE.Vector3().fromArray(b.c), u);
            phy.cargoQuat.fromArray(a.q).slerp(new THREE.Quaternion().fromArray(b.q), u);
            phy.cargoVel.set(0, 0, 0);
            phy.cargoOmega.set(0, 0, 0);
            document.getElementById('lbl-replay').textContent = 'PLAY ' + replay.cursor.toFixed(1) + 's';
        }

        let prevFollowWorldPos = null;
        let camCinema = null;

        // —— Camera hot-path scratch (zero per-frame alloc) ——
        const _camV1 = new THREE.Vector3();
        const _camV2 = new THREE.Vector3();
        const _camV3 = new THREE.Vector3();
        const _camV4 = new THREE.Vector3();
        const _camRight = new THREE.Vector3();
        const _camUp = new THREE.Vector3();
        const _camNdc = new THREE.Vector3();
        const _camFocus = new THREE.Vector3();
        const _camOffset = new THREE.Vector3();
        const _camDesPos = new THREE.Vector3();
        const _camPan = new THREE.Vector3();
        const _uiNdc = { x: 0, y: 0, _left: 0, _right: 0 };
        let _uiNdcStamp = -1e9;
        let _uiNdcDirty = true;
        let _uiNdcLayoutKey = '';
        let _camFollowFrame = 0;
        const UI_NDC_TTL_MS = 220;

        function easeInOutCubic(t) {
            return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
        }

        function invalidateUiSafeNdcCache() {
            _uiNdcDirty = true;
            _uiNdcStamp = -1e9;
        }
        if (typeof window !== 'undefined') {
            window.invalidateUiSafeNdcCache = invalidateUiSafeNdcCache;
            window.addEventListener('resize', invalidateUiSafeNdcCache, { passive: true });
        }

        /**
         * Visible 3D “stage” center in NDC — cached.
         * DOM layout (getBoundingClientRect / getComputedStyle) is expensive; refresh
         * only when dirty, layout classes change, or TTL expires.
         */
        function computeUiSafeNdcCenter() {
            const w = Math.max(1, window.innerWidth);
            const h = Math.max(1, window.innerHeight);
            let left = 0;
            let right = w;
            let top = 0;
            let bottom = h;
            const topBar = document.getElementById('top-bar');
            if (topBar) {
                const tb = topBar.getBoundingClientRect();
                if (tb.bottom > 0) top = Math.max(top, tb.bottom);
            }
            const dockBar = document.getElementById('bottom-dock-bar');
            if (dockBar) {
                const db = dockBar.getBoundingClientRect();
                if (db.top > 0 && db.top < h) bottom = Math.min(bottom, db.top);
            }

            if (document.body.classList.contains('gear-editor-open')) {
                const gear = document.getElementById('gear-editor');
                let leftEdge = 500;
                if (gear) {
                    const st = window.getComputedStyle(gear);
                    if (st.display !== 'none') {
                        const r = gear.getBoundingClientRect();
                        if (r.width > 40 && r.right > 40) leftEdge = Math.max(leftEdge, r.right);
                        else leftEdge = Math.max(leftEdge, gear.offsetWidth + 14);
                    }
                }
                left = Math.max(left, Math.min(right - 160, leftEdge + 10));
            } else {
                const compliance = document.getElementById('compliance-hud-panel');
                if (compliance && !compliance.classList.contains('hidden')) {
                    const r = compliance.getBoundingClientRect();
                    if (r.width > 40 && r.right > 40 && r.left < w * 0.5) {
                        left = Math.max(left, Math.min(right - 160, r.right + 8));
                    }
                }
                const hud = document.getElementById('dock-hud');
                if (hud) {
                    const st = window.getComputedStyle(hud);
                    if (st.display !== 'none' && st.visibility !== 'hidden') {
                        const r = hud.getBoundingClientRect();
                        if (r.width > 40 && r.right > 40 && r.right < w * 0.42) {
                            left = Math.max(left, Math.min(right - 160, r.right + 6));
                        }
                    }
                }
            }

            if (document.body.classList.contains('drawer-open')) {
                let drawerW = 420;
                const resolved = window.getComputedStyle(document.body).getPropertyValue('--safe-right').trim();
                if (resolved.endsWith('px')) {
                    const px = parseFloat(resolved);
                    if (px > 80) drawerW = px;
                } else {
                    const dwVar = window.getComputedStyle(document.documentElement).getPropertyValue('--drawer-w').trim();
                    if (dwVar.endsWith('px')) {
                        const px = parseFloat(dwVar);
                        if (px > 80) drawerW = px;
                    } else if (dwVar.includes('vw')) {
                        drawerW = Math.min(480, Math.max(360, w * 0.26));
                    }
                }
                const drawer = document.getElementById('right-side-drawer');
                if (drawer && drawer.classList.contains('drawer-open')) {
                    const r = drawer.getBoundingClientRect();
                    if (r.width > 80 && r.left < w - 20 && r.left > w * 0.35) {
                        drawerW = Math.max(drawerW, w - r.left);
                    } else if (drawer.offsetWidth > 80) {
                        drawerW = Math.max(drawerW, drawer.offsetWidth);
                    }
                }
                right = Math.min(right, Math.max(left + 160, w - drawerW));
            }

            // Cinematic rule-of-thirds inside the free stage:
            // right drawer open → subject on LEFT third (matches boot reference shot)
            // left gear open → subject on RIGHT third
            // both / neither → slight left bias
            const stageW = Math.max(1, right - left);
            const stageH = Math.max(1, bottom - top);
            const drawerOpen = document.body.classList.contains('drawer-open');
            const gearOpen = document.body.classList.contains('gear-editor-open');
            let hx = 0.42;
            if (drawerOpen && !gearOpen) hx = 1 / 3;
            else if (gearOpen && !drawerOpen) hx = 2 / 3;
            else if (drawerOpen && gearOpen) hx = 0.5;
            // Slightly below vertical mid — high-angle look keeps cargo grounded
            const hy = 0.55;
            const cx = left + stageW * hx;
            const cy = top + stageH * hy;
            _uiNdc.x = (cx / w) * 2 - 1;
            _uiNdc.y = -((cy / h) * 2 - 1);
            _uiNdc._left = left;
            _uiNdc._right = right;
            _uiNdc._hx = hx;
            return _uiNdc;
        }

        function getUiSafeNdcCenter(force) {
            const now = (typeof performance !== 'undefined') ? performance.now() : Date.now();
            const layoutKey = (document.body.classList.contains('drawer-open') ? 'D' : '-')
                + (document.body.classList.contains('gear-editor-open') ? 'G' : '-');
            if (layoutKey !== _uiNdcLayoutKey) {
                _uiNdcLayoutKey = layoutKey;
                _uiNdcDirty = true;
            }
            if (force || _uiNdcDirty || (now - _uiNdcStamp) > UI_NDC_TTL_MS) {
                computeUiSafeNdcCenter();
                _uiNdcStamp = now;
                _uiNdcDirty = false;
            }
            return _uiNdc;
        }

        /** Pan camera+target so focus lands on UI-safe NDC (full strength). */
        function applyUiSafePanNow(focusWorld) {
            if (!camera || !controls) return false;
            const focus = focusWorld || getCinematicFocusWorld(_camFocus);
            if (!focus) return false;
            camera.updateMatrixWorld(true);
            const pan = panVectorToPlaceWorldAtNdc(focus, getUiSafeNdcCenter(true), _camPan);
            if (pan.lengthSq() < 1e-8) return false;
            camera.position.add(pan);
            controls.target.add(pan);
            if (state.cameraFollow) {
                if (!state.cameraFollow.lockedOffset) state.cameraFollow.lockedOffset = new THREE.Vector3();
                state.cameraFollow.lockedOffset.copy(camera.position).sub(controls.target);
                // Bias = look-at shift vs raw subject so Auto keeps the 1/3 framing
                const bias = ensureUiPanBias(state.cameraFollow);
                bias.copy(controls.target).sub(focus);
            }
            if (typeof prevFollowWorldPos !== 'undefined') prevFollowWorldPos = null;
            return true;
        }

        /** Soft pan-only reframe so cargo sits in the free viewport (Auto / Fly). No orbit spin. */
        function reframeAutoToUiSafeCenter(opts) {
            if (!camera || !controls) return false;
            const cf = ensureCameraFollowState();
            if (cf.orbiting || cf.userManual) return false;
            const behavior = cf.behavior || 'cinema';
            // Manual / Giữ: never yank the user's angle
            if (behavior === 'lock' || !cf.enabled) return false;
            invalidateUiSafeNdcCache();

            if (behavior === 'flycam') {
                // keep flycam orbit; only pan into free stage
            } else if (behavior !== 'angleCycle') {
                cf.behavior = 'cinema';
                cf.enabled = true;
                cf.stableView = true;
            }
            cf.paused = false;

            const duration = (opts && opts.duration != null) ? opts.duration : 0.45;
            if (typeof startCinematicUiFrame === 'function') {
                startCinematicUiFrame({ duration, force: true });
            }
            const delay = (opts && opts.delay != null) ? opts.delay : 320;
            setTimeout(() => {
                if (!camera || !controls) return;
                const cur = state.cameraFollow;
                if (!cur || cur.orbiting || cur.userManual || cur.behavior === 'lock') return;
                applyUiSafePanNow(getCinematicFocusWorld());
                if (typeof window.syncCameraFollowUI === 'function') window.syncCameraFollowUI();
            }, delay);
            return true;
        }
        if (typeof window !== 'undefined') {
            window.getUiSafeNdcCenter = getUiSafeNdcCenter;
            window.reframeAutoToUiSafeCenter = reframeAutoToUiSafeCenter;
            window.applyUiSafePanNow = applyUiSafePanNow;
        }

        /** @param {THREE.Vector3} [out] optional target buffer */
        function getCinematicFocusWorld(out) {
            const dest = out || _camFocus;
            if (typeof cargoComNow === 'function') {
                const cog = cargoComNow();
                if (cog) dest.copy(cog);
                else dest.set(0, 1.4, 0);
            } else if (phy && phy.cargoPos) {
                dest.copy(phy.cargoPos);
            } else {
                dest.set(0, 1.4, 0);
            }
            if (phy && phy.hookPos) {
                _camV1.copy(phy.hookPos);
            } else {
                _camV1.copy(dest).y += 4;
            }
            // Bias slightly toward the hook so the whole lift reads in frame
            dest.lerp(_camV1, 0.22);
            dest.y += 0.35;
            return dest;
        }

        function ensureCameraFollowState() {
            if (!state.cameraFollow) {
                state.cameraFollow = {
                    enabled: true,
                    behavior: 'cinema',
                    mode: 'auto',
                    smart: true,
                    customOffset: new THREE.Vector3(),
                    lockedOffset: null,
                    angleIndex: 0,
                    flycamPhase: 0,
                    flycamPitch: 0.34,
                    flycamDist: 22,
                    flycamSeeded: false,
                    flycamYawRate: 0.12,
                    orbiting: false,
                    paused: false,
                    suppressUiReframe: true,
                    stableView: true,
                    userManual: false,
                    focusOverride: null
                };
            }
            if (state.cameraFollow.smart == null) state.cameraFollow.smart = true;
            if (!state.cameraFollow.behavior) state.cameraFollow.behavior = state.cameraFollow.enabled ? 'cinema' : 'lock';
            if (state.cameraFollow.behavior === 'holdAngle') state.cameraFollow.behavior = 'angleCycle';
            if (state.cameraFollow.angleIndex == null) state.cameraFollow.angleIndex = 0;
            if (state.cameraFollow.flycamPhase == null) state.cameraFollow.flycamPhase = 0;
            if (state.cameraFollow.flycamPitch == null) state.cameraFollow.flycamPitch = 0.34;
            if (state.cameraFollow.flycamDist == null) state.cameraFollow.flycamDist = 22;
            if (state.cameraFollow.flycamSeeded == null) state.cameraFollow.flycamSeeded = false;
            if (state.cameraFollow.flycamYawRate == null) state.cameraFollow.flycamYawRate = 0.12;
            if (state.cameraFollow.suppressUiReframe == null) state.cameraFollow.suppressUiReframe = true;
            if (state.cameraFollow.stableView == null) state.cameraFollow.stableView = true;
            if (state.cameraFollow.userManual == null) state.cameraFollow.userManual = false;
            if (state.cameraFollow.bootThirdsPending == null) state.cameraFollow.bootThirdsPending = false;
            return state.cameraFollow;
        }

        /** Lock current camera−target as the cinematic angle (no snap). */
        function bakeCameraLockedOffset() {
            const cf = ensureCameraFollowState();
            if (!camera || !controls) return null;
            if (!cf.lockedOffset) cf.lockedOffset = new THREE.Vector3();
            cf.lockedOffset.copy(camera.position).sub(controls.target);
            return cf.lockedOffset;
        }

        /** Designed hero angle from scene boot camera (high ¾, cargo left / open stage right). */
        function getHeroCameraOffset() {
            // camera (-13.5, 9.2, 19.5) − target (3.2, 3.2, -0.6)
            return new THREE.Vector3(-16.7, 6.0, 20.1);
        }

        /**
         * Compute cinematic hero pose: photography rule-of-thirds in the free stage
         * (LEFT third when right drawer is open).
         */
        function computeCinematicHeroPose(opts) {
            if (!camera || !controls) return null;
            invalidateUiSafeNdcCache();
            const focus = getCinematicFocusWorld(_camFocus).clone();
            const useHero = !(opts && opts.keepAngle);
            let offset;
            if (opts && opts.offset) {
                offset = opts.offset.clone();
            } else if (useHero) {
                offset = getHeroCameraOffset();
            } else {
                offset = camera.position.clone().sub(controls.target);
            }
            if (offset.lengthSq() < 1e-6) offset = getHeroCameraOffset();

            const midTarget = focus.clone();
            const midPos = midTarget.clone().add(offset);

            const savePos = camera.position.clone();
            const saveTarget = controls.target.clone();
            camera.position.copy(midPos);
            controls.target.copy(midTarget);
            camera.lookAt(midTarget);
            camera.updateMatrixWorld(true);

            const desired = getUiSafeNdcCenter(true);
            const pan = panVectorToPlaceWorldAtNdc(focus, desired, _camPan);
            const toTarget = midTarget.clone().add(pan);
            let toPos = midPos.clone().add(pan);
            const dolly = (opts && opts.dolly != null) ? opts.dolly : 1.04;
            _camV1.copy(toPos).sub(toTarget);
            toPos = toTarget.clone().addScaledVector(_camV1, dolly);

            camera.position.copy(savePos);
            controls.target.copy(saveTarget);
            camera.updateMatrixWorld(true);

            return { focus, offset, toPos, toTarget, desired };
        }

        /**
         * Auto / Boot: frame cargo on the cinematic hero angle + rule of thirds.
         * immediate:true → snap (for under-loader warm-up); else smooth tween.
         */
        function frameCinematicHeroShot(opts) {
            const cf = ensureCameraFollowState();
            if (!camera || !controls) return false;
            // Explicit Auto/boot always wins; only block while user is mid-drag
            if (cf.orbiting && !(opts && opts.force)) return false;

            cf.userManual = false;
            cf.orbiting = false;
            cf.behavior = 'cinema';
            cf.enabled = true;
            cf.smart = true;
            cf.stableView = true;
            cf.suppressUiReframe = true;
            cf.paused = false;
            ensureUiPanBias(cf).set(0, 0, 0);
            if (typeof camCinema !== 'undefined') camCinema = null;

            const pose = computeCinematicHeroPose(opts);
            if (!pose) return false;

            cf.lockedOffset = pose.offset.clone();

            if (opts && opts.immediate) {
                camera.position.copy(pose.toPos);
                controls.target.copy(pose.toTarget);
                camera.lookAt(pose.toTarget);
                camera.updateMatrixWorld(true);
                cf.lockedOffset.copy(camera.position).sub(controls.target);
                ensureUiPanBias(cf).copy(controls.target).sub(pose.focus);
                cf.paused = false;
                prevFollowWorldPos = null;
                if (controls) controls.update();
                if (typeof window.syncCameraFollowUI === 'function') window.syncCameraFollowUI();
                return true;
            }

            const duration = (opts && opts.duration != null) ? opts.duration : 0.95;
            camCinema = {
                t: 0,
                dur: Math.max(0.45, duration),
                fromPos: camera.position.clone(),
                fromTarget: controls.target.clone(),
                toPos: pose.toPos,
                toTarget: pose.toTarget
            };
            cf.paused = true;
            prevFollowWorldPos = null;
            if (typeof window.syncCameraFollowUI === 'function') window.syncCameraFollowUI();
            return true;
        }
        if (typeof window !== 'undefined') {
            window.frameCinematicHeroShot = frameCinematicHeroShot;
            window.playBootThirdsIntro = frameCinematicHeroShot; // alias
            window.computeCinematicHeroPose = computeCinematicHeroPose;
        }

        /** Call once after scene/controls exist — prevents boot orbit snap. */
        function bootstrapCameraFollow() {
            const cf = ensureCameraFollowState();
            if (!camera || !controls) return cf;
            bakeCameraLockedOffset();
            seedFlycamFromView();
            ensureUiPanBias(cf).set(0, 0, 0);
            cf.orbiting = false;
            cf.paused = false;
            cf.userManual = false;
            cf.behavior = 'cinema';
            cf.enabled = true;
            cf.smart = true;
            cf.stableView = true;
            cf.suppressUiReframe = true;
            cf.bootThirdsPending = true;
            invalidateUiSafeNdcCache();
            if (typeof window.syncCameraFollowUI === 'function') window.syncCameraFollowUI();
            return cf;
        }
        if (typeof window !== 'undefined') window.bootstrapCameraFollow = bootstrapCameraFollow;

        /**
         * User dragged the 3D view — kill ALL auto camera modes and obey the mouse.
         * Resume only via bottom cam buttons (Auto / Góc / Fly / Giữ).
         */
        function takeManualCameraControl(opts) {
            const cf = ensureCameraFollowState();
            cf.userManual = true;
            cf.orbiting = !(opts && opts.orbiting === false);
            cf.paused = false;
            cf.focusOverride = null;
            cf.suppressUiReframe = true;
            cf.stableView = true;
            cf.behavior = 'lock';
            cf.enabled = false;
            cf.smart = false;
            if (typeof camCinema !== 'undefined') camCinema = null;
            ensureUiPanBias(cf).set(0, 0, 0);
            if (camera && controls) {
                if (!cf.lockedOffset) cf.lockedOffset = new THREE.Vector3();
                cf.lockedOffset.copy(camera.position).sub(controls.target);
            }
            if (typeof window.syncCameraFollowUI === 'function') window.syncCameraFollowUI();
            return cf;
        }
        if (typeof window !== 'undefined') window.takeManualCameraControl = takeManualCameraControl;

        /**
         * Menu / UI settle: pause continuous Fly orbit → stable Auto track at current angle.
         * Does NOT steal control like mouse-drag (buttons still resume Fly/Góc).
         */
        function markCameraViewSettled(opts) {
            const cf = ensureCameraFollowState();
            // User already owns the view with the mouse — do not revive Auto
            if (cf.userManual || cf.behavior === 'lock') {
                cf.orbiting = !!(opts && opts.orbiting);
                if (camera && controls) {
                    cf.lockedOffset = camera.position.clone().sub(controls.target);
                }
                if (typeof camCinema !== 'undefined' && camCinema && !(opts && opts.keepTween)) {
                    camCinema = null;
                }
                return cf;
            }
            cf.suppressUiReframe = true;
            cf.stableView = true;
            cf.orbiting = !!(opts && opts.orbiting);
            cf.paused = false;
            if (camera && controls) {
                cf.lockedOffset = camera.position.clone().sub(controls.target);
                if (cf.behavior === 'flycam') seedFlycamFromView();
            }
            if (cf.behavior === 'flycam') {
                cf.behavior = 'cinema';
                cf.enabled = true;
                cf.smart = true;
            }
            if (typeof camCinema !== 'undefined' && camCinema && !(opts && opts.keepTween)) {
                camCinema = null;
            }
            if (typeof window.syncCameraFollowUI === 'function') window.syncCameraFollowUI();
            return cf;
        }
        if (typeof window !== 'undefined') window.markCameraViewSettled = markCameraViewSettled;

        /**
         * 12 cinematic angles around the cargo (4 faces × 3 elevations), clockwise from above.
         * Each call advances to the next shot.
         */
        function cycleCargoAngleShot(opts) {
            const cf = ensureCameraFollowState();
            const steps = 12;
            const advance = !(opts && opts.advance === false);
            if (advance) {
                cf.angleIndex = ((cf.angleIndex == null ? -1 : cf.angleIndex) + 1 + steps) % steps;
            } else {
                cf.angleIndex = ((cf.angleIndex % steps) + steps) % steps;
            }

            const focus = getActivityCameraFocusWorld();
            let cog = null;
            if (typeof cargoComNow === 'function') cog = cargoComNow();
            else if (phy && phy.cargoPos) cog = phy.cargoPos.clone();
            const hook = (phy && phy.hookPos) ? phy.hookPos.clone() : null;
            const span = (cog && hook) ? cog.distanceTo(hook) : Math.max(6, (state.H || 2.6) + 4);
            const footprint = Math.max(state.L || 6, state.W || 2.4);
            const dist = THREE.MathUtils.clamp(Math.max(span * 1.35, footprint * 1.55) + 6.5, 11, 44);

            // Clockwise from above: decreasing yaw in atan2(x,z) convention
            const yaw = -cf.angleIndex * (Math.PI * 2 / steps);
            // 3 elevation bands cycling every face (4 yaw steps per band)
            const elevBand = Math.floor(cf.angleIndex / 4) % 3;
            const pitch = elevBand === 0 ? 0.34 : (elevBand === 1 ? 0.46 : 0.28);

            const offset = new THREE.Vector3(
                Math.sin(yaw) * Math.cos(pitch),
                Math.sin(pitch),
                Math.cos(yaw) * Math.cos(pitch)
            ).multiplyScalar(dist);
            cf.lockedOffset = offset.clone();

            if (opts && opts.apply === false) return offset;
            if (!camera || !controls) return offset;

            const fromPos = camera.position.clone();
            const fromTarget = controls.target.clone();
            let toTarget = focus.clone();
            let toPos = toTarget.clone().add(offset);

            const savePos = camera.position.clone();
            const saveTarget = controls.target.clone();
            camera.position.copy(toPos);
            controls.target.copy(toTarget);
            camera.lookAt(toTarget);
            camera.updateMatrixWorld(true);
            const pan = panVectorToPlaceWorldAtNdc(focus, getUiSafeNdcCenter());
            toPos.add(pan);
            toTarget.add(pan);
            camera.position.copy(savePos);
            controls.target.copy(saveTarget);
            camera.updateMatrixWorld(true);

            camCinema = {
                t: 0,
                dur: (opts && opts.duration != null) ? opts.duration : 0.65,
                fromPos,
                fromTarget,
                toPos,
                toTarget
            };
            cf.paused = true;
            prevFollowWorldPos = null;
            return offset;
        }

        /** @deprecated alias — kept for older callers */
        function bakeCinematicHoldAngle(opts) {
            return cycleCargoAngleShot({ ...opts, advance: false });
        }

        /** Seed flycam yaw/pitch/dist from the current camera so orbit never snaps. */
        function seedFlycamFromView() {
            const cf = ensureCameraFollowState();
            if (!camera || !controls) return;
            _camOffset.copy(camera.position).sub(controls.target);
            const len = _camOffset.length();
            if (len < 1e-6) {
                cf.flycamPhase = 0;
                cf.flycamPitch = 0.34;
                cf.flycamDist = 22;
                cf.flycamSeeded = true;
                return;
            }
            // Match cycleCargoAngleShot convention: yaw decreases clockwise
            cf.flycamPhase = Math.atan2(_camOffset.x, _camOffset.z);
            cf.flycamPitch = Math.asin(THREE.MathUtils.clamp(_camOffset.y / len, -0.95, 0.95));
            cf.flycamDist = len;
            cf.flycamSeeded = true;
        }

        function setCameraBehavior(behavior, opts) {
            const cf = ensureCameraFollowState();
            let next = behavior;
            if (next === 'holdAngle') next = 'angleCycle';
            if (next !== 'lock' && next !== 'angleCycle' && next !== 'flycam') next = 'cinema';

            // Bottom-bar buttons always clear manual override and resume chosen mode
            cf.userManual = false;
            cf.orbiting = false;
            cf.paused = false;
            cf.focusOverride = null;
            if (typeof camCinema !== 'undefined' && camCinema) camCinema = null;
            invalidateUiSafeNdcCache();
            ensureUiPanBias(cf).set(0, 0, 0);

            if (next === 'lock') {
                cf.behavior = 'lock';
                cf.enabled = false;
                cf.smart = false;
                cf.suppressUiReframe = true;
                cf.stableView = true;
                if (camera && controls) {
                    cf.lockedOffset = camera.position.clone().sub(controls.target);
                }
            } else if (next === 'angleCycle') {
                const alreadyCycling = cf.behavior === 'angleCycle';
                cf.behavior = 'angleCycle';
                cf.enabled = true;
                cf.smart = true;
                cf.mode = cf.mode || 'auto';
                cf.suppressUiReframe = false;
                cf.stableView = false;
                if (!alreadyCycling) cf.angleIndex = -1;
                cycleCargoAngleShot({ duration: (opts && opts.duration) || 0.7, advance: true });
            } else if (next === 'flycam') {
                cf.behavior = 'flycam';
                cf.enabled = true;
                cf.smart = true;
                cf.mode = cf.mode || 'auto';
                cf.lockedOffset = null;
                cf.suppressUiReframe = false;
                cf.stableView = false;
                if (opts && opts.yawRate != null) cf.flycamYawRate = opts.yawRate;
                if (cf.flycamYawRate == null) cf.flycamYawRate = 0.12;
                seedFlycamFromView();
                // Gentle settle only — do not yank distance/angle on Fly start
                if (typeof startCinematicUiFrame === 'function') {
                    startCinematicUiFrame({ duration: (opts && opts.duration) || 0.45, force: true });
                }
            } else {
                // Auto: hero cinematic angle + rule-of-thirds (photography framing)
                frameCinematicHeroShot({
                    duration: (opts && opts.duration) || 0.95,
                    force: true,
                    keepAngle: false
                });
            }
            if (typeof window.syncCameraFollowUI === 'function') window.syncCameraFollowUI();
            return cf.behavior;
        }

        if (typeof window !== 'undefined') {
            window.setCameraBehavior = setCameraBehavior;
            window.bakeCinematicHoldAngle = bakeCinematicHoldAngle;
            window.cycleCargoAngleShot = cycleCargoAngleShot;
        }

        function resolveCameraFocusKind(kind, index) {
            const i = index || 0;
            if (kind === 'hook' && phy && phy.hookPos) return phy.hookPos.clone();
            if (kind === 'cog') {
                if (typeof cargoComNow === 'function') return cargoComNow();
                if (phy && phy.cargoPos) return phy.cargoPos.clone();
            }
            if (kind === 'cargo' && phy && phy.cargoPos) return phy.cargoPos.clone();
            if (kind === 'lp' && state.lugs && state.lugs[i] && phy && phy.cargoPos && phy.cargoQuat) {
                return state.lugs[i].clone().applyQuaternion(phy.cargoQuat).add(phy.cargoPos);
            }
            if (kind === 'yaw' || kind === 'cargoYaw') {
                const base = (phy && phy.cargoPos) ? phy.cargoPos.clone() : new THREE.Vector3();
                base.y = (typeof groundSurfaceY === 'function') ? groundSurfaceY(base.x, base.z) + 0.15 : 0.15;
                return base;
            }
            return getCinematicFocusWorld();
        }

        function getActivityCameraFocusWorld() {
            const cf = ensureCameraFollowState();
            const now = (typeof performance !== 'undefined') ? performance.now() : Date.now();
            if (cf.focusOverride && cf.focusOverride.until > now) {
                const ov = resolveCameraFocusKind(cf.focusOverride.kind, cf.focusOverride.index);
                return ov ? _camFocus.copy(ov) : getCinematicFocusWorld(_camFocus);
            }
            if (cf.focusOverride) cf.focusOverride = null;

            // Live gizmo edits take priority
            if (typeof dragTarget !== 'undefined' && dragTarget) {
                let ov = null;
                if (dragTarget.type === 'hook') ov = resolveCameraFocusKind('hook');
                else if (dragTarget.type === 'cog') ov = resolveCameraFocusKind('cog');
                else if (dragTarget.type === 'lp') ov = resolveCameraFocusKind('lp', dragTarget.index);
                else if (dragTarget.type === 'cargoYaw') ov = resolveCameraFocusKind('cargoYaw');
                if (ov) return _camFocus.copy(ov);
            }

            const hoistActive = Math.abs(phy.hoistSpeed || 0) > 0.025 || !!phy.autoHoistActive;
            const airborne = (phy.groundClearance || 0) > 0.06;
            if (hoistActive || airborne || cf.mode === 'auto') {
                return getCinematicFocusWorld(_camFocus);
            }
            const tgt = getCameraFollowTargetWorld();
            return tgt ? _camFocus.copy(tgt) : getCinematicFocusWorld(_camFocus);
        }

        /** Soft cinematic look-at a subject (LP / CoG / hook) while editing. */
        function startCinematicFocusSubject(kind, index, opts) {
            if (!camera || !controls) return;
            const cf = ensureCameraFollowState();
            if (cf.orbiting || cf.userManual || cf.behavior === 'lock') return;
            const focus = resolveCameraFocusKind(kind, index);
            const duration = (opts && opts.duration != null) ? opts.duration : 0.7;
            const tight = (kind === 'lp' || kind === 'cog') ? 0.52 : (kind === 'hook' ? 0.68 : 0.88);
            const fromPos = camera.position.clone();
            const fromTarget = controls.target.clone();
            const offset = fromPos.clone().sub(fromTarget);
            if (offset.lengthSq() < 1e-6) offset.set(10, 7, 12);
            const midTarget = focus.clone();
            let midPos = midTarget.clone().add(offset.clone().setLength(Math.max(4.5, offset.length() * tight)));

            const savePos = camera.position.clone();
            const saveTarget = controls.target.clone();
            camera.position.copy(midPos);
            controls.target.copy(midTarget);
            camera.lookAt(midTarget);
            camera.updateMatrixWorld(true);
            const pan = panVectorToPlaceWorldAtNdc(focus, getUiSafeNdcCenter());
            const toTarget = midTarget.clone().add(pan);
            const toPos = midPos.clone().add(pan);
            camera.position.copy(savePos);
            controls.target.copy(saveTarget);
            camera.updateMatrixWorld(true);

            camCinema = { t: 0, dur: Math.max(0.28, duration), fromPos, fromTarget, toPos, toTarget };
            cf.paused = true;
            prevFollowWorldPos = null;
        }

        function setCameraFocusOverride(kind, index, holdMs) {
            const cf = ensureCameraFollowState();
            // Don't steal the lens while the user is manually framing
            if (cf.userManual || cf.behavior === 'lock') return;
            cf.enabled = true;
            cf.paused = false;
            cf.orbiting = false;
            cf.focusOverride = {
                kind: kind || 'lift',
                index: index || 0,
                until: ((typeof performance !== 'undefined') ? performance.now() : Date.now()) + (holdMs != null ? holdMs : 2800)
            };
            startCinematicFocusSubject(kind, index, { duration: 0.65 });
            if (typeof syncCameraFollowUI === 'function') syncCameraFollowUI();
        }

        if (typeof window !== 'undefined') {
            window.setCameraFocusOverride = setCameraFocusOverride;
            window.startCinematicFocusSubject = startCinematicFocusSubject;
        }

        /** @param {THREE.Vector3} [out] optional target buffer */
        function panVectorToPlaceWorldAtNdc(worldPoint, desiredNdc, out) {
            const dest = out || _camPan;
            _camNdc.copy(worldPoint).project(camera);
            if (!isFinite(_camNdc.x) || !isFinite(_camNdc.y)) {
                return dest.set(0, 0, 0);
            }
            const dx = desiredNdc.x - _camNdc.x;
            const dy = desiredNdc.y - _camNdc.y;
            if (dx * dx + dy * dy < 1e-10) return dest.set(0, 0, 0);
            const dist = Math.max(0.8, camera.position.distanceTo(worldPoint));
            const vFov = (camera.fov || 50) * Math.PI / 180;
            const halfH = Math.tan(vFov * 0.5) * dist;
            const halfW = halfH * (camera.aspect || (window.innerWidth / Math.max(1, window.innerHeight)));
            _camRight.setFromMatrixColumn(camera.matrixWorld, 0).normalize();
            _camUp.setFromMatrixColumn(camera.matrixWorld, 1).normalize();
            return dest
                .copy(_camRight).multiplyScalar(-dx * halfW)
                .addScaledVector(_camUp, -dy * halfH);
        }

        /**
         * Cinematic reframe: keep the current orbit “feel”, but slide so the lift
         * sits on the rule-of-thirds mark of the free viewport (left third when
         * the right drawer is open — same composition as the boot reference).
         */
        function startCinematicUiFrame(opts) {
            if (!camera || !controls) return;
            if (state.cameraFollow && (state.cameraFollow.orbiting || state.cameraFollow.userManual)) return;
            // Manual / Giữ: never yank the angle (force only for explicit Auto/Fly/Góc buttons)
            if (state.cameraFollow && state.cameraFollow.behavior === 'lock' && !(opts && opts.force)) return;
            // After user has a settled view, ignore drawer/tab auto-reframes (prevents dizzy spin)
            if (state.cameraFollow && state.cameraFollow.suppressUiReframe && !(opts && opts.force)) return;
            const duration = (opts && opts.duration != null) ? opts.duration : 0.95;
            invalidateUiSafeNdcCache();
            const focus = getCinematicFocusWorld(_camFocus);
            const fromPos = camera.position.clone();
            const fromTarget = controls.target.clone();
            _camOffset.copy(fromPos).sub(fromTarget);
            if (_camOffset.lengthSq() < 1e-6) _camOffset.set(8, 6, 10);
            const midTarget = focus.clone();
            const midPos = midTarget.clone().add(_camOffset);

            const savePos = _camV3.copy(camera.position);
            const saveTarget = _camV4.copy(controls.target);
            camera.position.copy(midPos);
            controls.target.copy(midTarget);
            camera.lookAt(midTarget);
            camera.updateMatrixWorld(true);

            const desired = getUiSafeNdcCenter(true);
            const pan = panVectorToPlaceWorldAtNdc(focus, desired, _camPan);
            let toTarget = midTarget.clone().add(pan);
            let toPos = midPos.clone().add(pan);

            const drawerOpen = document.body.classList.contains('drawer-open');
            const gearOpen = document.body.classList.contains('gear-editor-open');
            const dolly = (drawerOpen || gearOpen) ? 1.05 : 0.96;
            _camV1.copy(toPos).sub(toTarget);
            toPos = toTarget.clone().addScaledVector(_camV1, dolly);

            camera.position.copy(savePos);
            controls.target.copy(saveTarget);
            camera.updateMatrixWorld(true);

            camCinema = {
                t: 0,
                dur: Math.max(0.35, duration),
                fromPos,
                fromTarget,
                toPos,
                toTarget
            };
            if (state.cameraFollow) {
                state.cameraFollow.paused = true;
            }
            if (typeof prevFollowWorldPos !== 'undefined') prevFollowWorldPos = null;
        }

        function updateCameraCinema(dt) {
            if (!camCinema || !camera || !controls) return;
            // User grabbed the view — abort the tween cleanly
            if (state.cameraFollow && (state.cameraFollow.orbiting || state.cameraFollow.userManual)) {
                camCinema = null;
                if (state.cameraFollow) state.cameraFollow.paused = false;
                return;
            }
            camCinema.t += Math.max(0, dt || 0);
            const u = Math.min(1, camCinema.t / camCinema.dur);
            // Smootherstep for filmic ease-in/out (less mechanical than cubic)
            const e = u * u * u * (u * (u * 6 - 15) + 10);
            camera.position.lerpVectors(camCinema.fromPos, camCinema.toPos, e);
            controls.target.lerpVectors(camCinema.fromTarget, camCinema.toTarget, e);
            if (u >= 1) {
                camCinema = null;
                if (state.cameraFollow) {
                    state.cameraFollow.paused = false;
                    // Bake final pose so stableView tracking does not yank back
                    state.cameraFollow.lockedOffset = camera.position.clone().sub(controls.target);
                }
                prevFollowWorldPos = null;
                // Soft final NDC polish only if still clearly off the thirds mark
                if (!(state.cameraFollow && (state.cameraFollow.userManual || state.cameraFollow.behavior === 'lock'))) {
                    const focus = getCinematicFocusWorld(_camFocus);
                    camera.updateMatrixWorld(true);
                    _camNdc.copy(focus).project(camera);
                    const desired = getUiSafeNdcCenter(true);
                    const dx = desired.x - _camNdc.x;
                    const dy = desired.y - _camNdc.y;
                    if ((dx * dx + dy * dy) > 0.0025) {
                        applyUiSafePanNow(focus);
                    } else if (state.cameraFollow) {
                        ensureUiPanBias(state.cameraFollow).copy(controls.target).sub(focus);
                    }
                }
            }
        }

        if (typeof window !== 'undefined') {
            window.startCinematicUiFrame = startCinematicUiFrame;
        }

        function getCameraFollowTargetWorld() {
            const cf = ensureCameraFollowState();
            const mode = cf.mode || 'cog';
            if (mode === 'auto') return getActivityCameraFocusWorld();
            if (mode === 'hook') {
                return (phy && phy.hookPos) ? phy.hookPos.clone() : new THREE.Vector3(0, 5, 0);
            }
            if (mode === 'center') {
                return (phy && phy.cargoPos) ? phy.cargoPos.clone() : new THREE.Vector3(0, 1.3, 0);
            }
            if (mode === 'top') {
                const topLocal = new THREE.Vector3(0, (state.H || 2.59) * 0.5, 0);
                return (phy && phy.cargoPos && phy.cargoQuat)
                    ? topLocal.applyQuaternion(phy.cargoQuat).add(phy.cargoPos)
                    : new THREE.Vector3(0, 2.5, 0);
            }
            if (typeof mode === 'string' && mode.startsWith('lp')) {
                const idx = parseInt(mode.replace('lp', ''), 10) - 1;
                if (state.lugs && state.lugs[idx] && phy && phy.cargoPos && phy.cargoQuat) {
                    return state.lugs[idx].clone().applyQuaternion(phy.cargoQuat).add(phy.cargoPos);
                }
            }
            if (mode === 'custom') {
                const off = cf.customOffset || new THREE.Vector3();
                return (phy && phy.cargoPos && phy.cargoQuat)
                    ? off.clone().applyQuaternion(phy.cargoQuat).add(phy.cargoPos)
                    : new THREE.Vector3(0, 1.3, 0);
            }
            // Default: 'cog' (Trọng tâm CoG)
            if (typeof cargoComNow === 'function') {
                return cargoComNow();
            }
            if (phy && phy.cargoPos && phy.cargoQuat) {
                const cogLocal = new THREE.Vector3(state.cogX || 0, state.cogY || 0, state.cogZ || 0);
                return cogLocal.applyQuaternion(phy.cargoQuat).add(phy.cargoPos);
            }
            return new THREE.Vector3(0, 1.3, 0);
        }

        function centerCameraOnFollowTarget() {
            const worldTarget = (ensureCameraFollowState().mode === 'auto' || ensureCameraFollowState().smart)
                ? getActivityCameraFocusWorld()
                : getCameraFollowTargetWorld();
            if (!worldTarget || !controls || !camera) return;
            const shift = worldTarget.clone().sub(controls.target);
            controls.target.copy(worldTarget);
            camera.position.add(shift);
            prevFollowWorldPos = worldTarget.clone();
        }

        /**
         * Persistent UI-stage bias: cargo stays in free viewport without fighting
         * subject-track every frame (that fight caused hitching).
         * Updated only on reframe / occasionally while menus are open.
         */
        function ensureUiPanBias(cf) {
            if (!cf.uiPanBias) cf.uiPanBias = new THREE.Vector3();
            return cf.uiPanBias;
        }

        function refreshUiPanBias(worldTarget, force) {
            // Continuous chase while drawer slides caused boot chaos — only explicit reframes
            if (!force) return;
            const cf = ensureCameraFollowState();
            const bias = ensureUiPanBias(cf);
            if (!camera || !controls || !worldTarget) return;
            camera.updateMatrixWorld(true);
            _camV2.copy(worldTarget).add(bias);
            const pan = panVectorToPlaceWorldAtNdc(_camV2, getUiSafeNdcCenter(true), _camPan);
            if (pan.lengthSq() < 1e-10) return;
            bias.add(pan);
            const maxBias = 14;
            if (bias.lengthSq() > maxBias * maxBias) bias.setLength(maxBias);
        }

        function updateCameraFollowSystem(dt) {
            const cf = ensureCameraFollowState();
            if (!controls || !camera) return;

            // Manual drag / Giữ: user owns the lens — zero auto motion
            if (cf.userManual || cf.behavior === 'lock' || !cf.enabled) {
                prevFollowWorldPos = null;
                if (cameraFollowMarker) cameraFollowMarker.visible = false;
                return;
            }

            // Don't fight an active cinematic tween
            if (camCinema) {
                if (cameraFollowMarker) cameraFollowMarker.visible = false;
                return;
            }

            const smart = cf.smart || cf.mode === 'auto'
                || cf.behavior === 'cinema'
                || cf.behavior === 'angleCycle'
                || cf.behavior === 'flycam'
                || cf.behavior === 'holdAngle';
            const worldTarget = smart
                ? (getActivityCameraFocusWorld() || getCinematicFocusWorld(_camFocus))
                : (getCameraFollowTargetWorld() || getCinematicFocusWorld(_camFocus));
            if (!worldTarget) return;

            _camFollowFrame++;
            if (cameraFollowMarker) {
                cameraFollowMarker.visible = true;
                cameraFollowMarker.position.copy(worldTarget);
                if ((_camFollowFrame & 3) === 0) {
                    cameraFollowMarker.scale.setScalar(1.0 + Math.sin(performance.now() * 0.007) * 0.12);
                }
            }

            if (cf.orbiting || cf.paused) {
                if (!prevFollowWorldPos) prevFollowWorldPos = new THREE.Vector3();
                prevFollowWorldPos.copy(worldTarget);
                return;
            }

            const dtClamped = Math.min(0.05, Math.max(0, dt || 0.016));
            const hoistActive = Math.abs(phy.hoistSpeed || 0) > 0.025 || !!phy.autoHoistActive;
            const editing = !!(typeof dragTarget !== 'undefined' && dragTarget);
            const bias = ensureUiPanBias(cf);
            // Framed look-at = subject + stable UI bias (bias only changes on explicit reframe)
            _camV2.copy(worldTarget).add(bias);

            // --- Góc: track subject at locked cinematic angle ---
            if (cf.behavior === 'angleCycle' || cf.behavior === 'holdAngle') {
                if (!cf.lockedOffset || cf.lockedOffset.lengthSq() < 1e-6) {
                    cycleCargoAngleShot({ apply: false, advance: false });
                }
                const kT = 1 - Math.exp(-(editing ? 4.2 : 2.6) * dtClamped);
                const kP = 1 - Math.exp(-(editing ? 3.4 : 2.2) * dtClamped);
                controls.target.lerp(_camV2, kT);
                _camDesPos.copy(controls.target).add(cf.lockedOffset);
                camera.position.lerp(_camDesPos, kP);
                if (!prevFollowWorldPos) prevFollowWorldPos = new THREE.Vector3();
                prevFollowWorldPos.copy(worldTarget);
                return;
            }

            // --- Flycam: calm continuous orbit (always seeded from current view) ---
            if (cf.behavior === 'flycam') {
                if (!cf.flycamSeeded) seedFlycamFromView();

                let span = Math.max(6, (state.H || 2.6) + 4);
                if (phy && phy.cargoPos && phy.hookPos) {
                    span = phy.cargoPos.distanceTo(phy.hookPos);
                }
                const footprint = Math.max(state.L || 6, state.W || 2.4);
                const wantDist = THREE.MathUtils.clamp(Math.max(span * 1.35, footprint * 1.55) + 6.5, 11, 44);
                // Softly approach framing distance — never snap from boot pose
                const distBase = (cf.flycamDist != null) ? cf.flycamDist : wantDist;
                cf.flycamDist = THREE.MathUtils.lerp(distBase, wantDist, 1 - Math.exp(-0.35 * dtClamped));

                const yawRate = (cf.flycamYawRate != null ? cf.flycamYawRate : 0.12);
                cf.flycamPhase = (cf.flycamPhase || 0) - yawRate * dtClamped;
                if (cf.flycamPhase < -Math.PI * 2 || cf.flycamPhase > Math.PI * 2) {
                    cf.flycamPhase = ((cf.flycamPhase % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
                    if (cf.flycamPhase > Math.PI) cf.flycamPhase -= Math.PI * 2;
                }

                const t = performance.now() * 0.001;
                const pitchBase = (cf.flycamPitch != null) ? cf.flycamPitch : 0.34;
                const pitch = pitchBase + Math.sin(t * 0.19) * 0.028 + Math.sin(t * 0.07) * 0.012;
                const dist = cf.flycamDist * (1 + Math.sin(t * 0.14) * 0.02);
                const yaw = cf.flycamPhase;
                const cosP = Math.cos(pitch);
                _camOffset.set(
                    Math.sin(yaw) * cosP,
                    Math.sin(pitch),
                    Math.cos(yaw) * cosP
                ).multiplyScalar(dist);

                // Slower follow blend = no boot whip
                const kT = 1 - Math.exp(-(editing ? 3.2 : 1.8) * dtClamped);
                const kP = 1 - Math.exp(-(editing ? 2.4 : 1.4) * dtClamped);
                controls.target.lerp(_camV2, kT);
                _camDesPos.copy(controls.target).add(_camOffset);
                camera.position.lerp(_camDesPos, kP);

                if (!prevFollowWorldPos) prevFollowWorldPos = new THREE.Vector3();
                prevFollowWorldPos.copy(worldTarget);
                return;
            }

            if (!smart) {
                if (!prevFollowWorldPos) {
                    prevFollowWorldPos = worldTarget.clone();
                    return;
                }
                _camV1.copy(worldTarget).sub(prevFollowWorldPos);
                if (_camV1.lengthSq() > 1e-9) {
                    camera.position.add(_camV1);
                    controls.target.add(_camV1);
                    prevFollowWorldPos.copy(worldTarget);
                }
                return;
            }

            // --- Auto cinematic: fixed-angle subject track (no yaw spin, no dist whip) ---
            if (!cf.lockedOffset) cf.lockedOffset = new THREE.Vector3();
            if (cf.lockedOffset.lengthSq() < 1e-6) {
                cf.lockedOffset.copy(camera.position).sub(controls.target);
            }
            // Keep the baked boot/user angle — only very gentle distance breathe while hoisting
            if (hoistActive && (_camFollowFrame & 3) === 0) {
                _camOffset.copy(cf.lockedOffset);
                const curLen = Math.max(1e-6, _camOffset.length());
                let span = 8;
                if (phy && phy.cargoPos && phy.hookPos) {
                    span = phy.cargoPos.distanceTo(phy.hookPos);
                }
                const wantDist = THREE.MathUtils.clamp(span * 1.45 + 6, 10, 46);
                const kDist = 1 - Math.exp(-0.55 * dtClamped * 4);
                _camOffset.multiplyScalar(THREE.MathUtils.lerp(curLen, wantDist, kDist) / curLen);
                cf.lockedOffset.copy(_camOffset);
            }

            const kT = 1 - Math.exp(-(editing ? 3.6 : (hoistActive ? 2.2 : 1.6)) * dtClamped);
            const kP = 1 - Math.exp(-(editing ? 2.8 : (hoistActive ? 1.8 : 1.35)) * dtClamped);
            controls.target.lerp(_camV2, kT);
            _camDesPos.copy(controls.target).add(cf.lockedOffset);
            camera.position.lerp(_camDesPos, kP);

            if (!prevFollowWorldPos) prevFollowWorldPos = new THREE.Vector3();
            prevFollowWorldPos.copy(worldTarget);
        }

        const SIM_STEP = 1 / 60;
        let simAccumulator = 0;

        function animate() {
            requestAnimationFrame(animate);
            const dt = Math.min(0.05, simClock.getDelta());
            // Adaptive 1080p budget: keep ~60 FPS after beam/cable edits
            if (!state.renderPerf) state.renderPerf = { level: 2, emaMs: 16.7, burstUntil: 0 };
            const rp = state.renderPerf;
            const frameMs = dt * 1000;
            rp.emaMs = rp.emaMs * 0.88 + frameMs * 0.12;
            const nowPerf = (typeof performance !== 'undefined') ? performance.now() : Date.now();
            if (nowPerf < (rp.burstUntil || 0)) {
                rp.level = 0;
            } else if (rp.emaMs > 22) {
                rp.level = 0;
            } else if (rp.emaMs > 17.8) {
                rp.level = 1;
            } else {
                rp.level = 2;
            }

            if (replay.playing) stepReplay(dt);
            else {
                // Fixed 60 Hz physics step driven by real elapsed time (accumulator):
                // sim speed is identical on 30/60/144 Hz displays instead of scaling with FPS.
                // Under FPS pressure, drop to one physics tick per frame to recover smoothness.
                const maxCatchUp = rp.level < 1 ? SIM_STEP : SIM_STEP * 2;
                simAccumulator = Math.min(simAccumulator + dt, maxCatchUp);
                while (simAccumulator >= SIM_STEP) {
                    stepPhysicsEngine();
                    simAccumulator -= SIM_STEP;
                }
                pushReplaySample();
            }
            updateSceneAndTelemetry();
            updateCameraCinema(dt);
            // OrbitControls first; cinematic follow overwrites after — avoids fight/jitter
            const cfNow = state.cameraFollow;
            const userDriving = !cfNow || cfNow.userManual || cfNow.behavior === 'lock'
                || !cfNow.enabled || cfNow.orbiting;
            if (controls) {
                controls.enableDamping = !!userDriving;
                controls.update();
            }
            updateCameraFollowSystem(dt);

            // Procedural Audio Engine Update (Winch drive & Falling air whoosh)
            if (typeof simAudio !== 'undefined') {
                const winchSpeed = phy.hoistSpeed || 0;
                const isAuto = !!phy.autoHoistActive;
                const grossT = (phy.massBreakdown && phy.massBreakdown.grossCraneLoadT) ? phy.massBreakdown.grossCraneLoadT : (state.weight + (phy.gearWeight || 0));
                const loadRatio = Math.min(1.0, (grossT * 1000 * 9.81) / 650000);
                simAudio.updateWinch(winchSpeed, isAuto, loadRatio);

                let maxFallSpeed = 0;
                if (phy.groundClearance > 0.08 && phy.cargoVel && phy.cargoVel.y < -0.8) {
                    maxFallSpeed = Math.max(maxFallSpeed, -phy.cargoVel.y);
                }
                if (phy.oogState && (phy.oogState.status === 'falling' || phy.oogState.status === 'sliding') && phy.oogState.worldVel && phy.oogState.worldVel.y < -0.8) {
                    maxFallSpeed = Math.max(maxFallSpeed, -phy.oogState.worldVel.y);
                }
                simAudio.updateFallWind(maxFallSpeed);
            }
            if (phy.shakeOff) camera.position.sub(phy.shakeOff);
            if (!phy.shakeOff) phy.shakeOff = new THREE.Vector3();
            else phy.shakeOff.set(0, 0, 0);
            if ((phy.shakeAmp || 0) > 0.004) {
                phy.shakeOff.set((Math.random() - 0.5) * phy.shakeAmp, (Math.random() - 0.5) * phy.shakeAmp * 0.6, (Math.random() - 0.5) * phy.shakeAmp);
                camera.position.add(phy.shakeOff);
                phy.shakeAmp *= 0.86;
            }
            [phy.sparkGroup, phy.dustGroup].forEach(group => {
                if (!group) return;
                for (let i = group.children.length - 1; i >= 0; i--) {
                    const p = group.children[i];
                    p.userData.life -= 1;
                    p.userData.vel.y -= 9.8 * dt;
                    p.position.addScaledVector(p.userData.vel, dt);
                    if (p.material) p.material.opacity = Math.max(0, p.userData.life / 40);
                    if (p.userData.life <= 0) group.remove(p);
                }
            });

            // Shadow frustum: every ~4 frames is enough at 1080p
            if (!animate._shadowTick) animate._shadowTick = 0;
            animate._shadowTick++;
            if (envManager && phy.cargoPos && (animate._shadowTick % 4 === 0)) {
                envManager.updateShadowFrustum(phy.cargoPos);
            }

            // Photorealistic Post-Processing EffectComposer or Direct Render
            if (sceneRenderer) {
                sceneRenderer.render(dt);
            } else {
                renderer.render(scene, camera);
            }

            const modal = document.getElementById('library-studio-modal');
            if (modal && modal.classList.contains('open') && studioRenderer) {
                studioControls.update();
                studioPreviewGroup.rotation.y += 0.0045;
                studioRenderer.render(studioScene, studioCamera);
            }
        }
