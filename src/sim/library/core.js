/**
 * library/core — asset library UI / selection
 * Split from legacy god-file (strangler Phase 2). Shared scope via assemble.
 */
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

        const libraryPreviewCache = new Map();

        function previewLibraryItemIn3D(item, category) {
            if (!item) return;
            while (studioPreviewGroup.children.length > 0) {
                studioPreviewGroup.remove(studioPreviewGroup.children[0]);
            }
            const summaryEl = document.getElementById('lib-active-summary');
            if (summaryEl) summaryEl.textContent = `Đang chọn: ${item.name}`;

            const previewKey = `${category}:${item.id}`;
            let previewObj;
            if (libraryPreviewCache.has(previewKey)) {
                previewObj = libraryPreviewCache.get(previewKey);
            } else {
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
                } else {
                    previewObj = new THREE.Group();
                }

                if (libraryPreviewCache.size > 32) {
                    const oldest = libraryPreviewCache.keys().next().value;
                    libraryPreviewCache.delete(oldest);
                }
                libraryPreviewCache.set(previewKey, previewObj);
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

            if (item._cachedTris == null) {
                item._cachedTris = (window.CAE?.HullOptimizer || HullOptimizer).getTriCount(previewObj);
            }
            const statsEl = document.getElementById('studio-preview-stats');
            if (statsEl) {
                statsEl.textContent = `Mesh: ${item.meshName || previewObj.name || item.id} | ${item._cachedTris.toLocaleString()} tris | ${item.name} (${item.badge || '3D CAD'})`;
            }
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

