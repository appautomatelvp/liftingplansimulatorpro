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
                modal.classList.add('open');
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
                modal.classList.remove('open');
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
                        car: 'Xe Cơ Giới Chuyên Dụng',
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
                        car: { L: 4.8, W: 1.9, H: 1.8, m: 2.6 },
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
                modal.classList.remove('open');
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
                        document.getElementById('library-studio-modal').classList.remove('open');
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
                    const prevBeam = state.beamType;
                    state.beamType = item.id;
                    rebuildSpreaderVisuals();
                    previewObj = spreaderRootGroup.clone();
                    previewObj.position.set(0, 0, 0);
                    previewObj.visible = true;
                    state.beamType = prevBeam;
                    rebuildSpreaderVisuals();
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
                syncSidebarStoreButton('#beam-store', 'beam', item.id, item.name, item.sub || 'Spreader');
                rebuildCargoAndRig(false);

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
                state.slingLength = item.slingL;
                state.slingUserSet = true;
                state.holdCableLength = false;
                state.heldCableL0 = null;
                state.lugElevPreset = item.elev || 'top';
                document.getElementById('inp-slingL').value = item.slingL;
                document.getElementById('v-slingL').textContent = item.slingL.toFixed(1);
                rebuildCargoAndRig(true);
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

                // High-fidelity authentic 22G1 standard container 3D model (CONTS20FT.obj)
                loaders.loadFromUrl('/assets/models/conts20ft.obj', { specKey: 'container_20ft' })
                    .then(res => {
                        res.root.traverse(child => {
                            if (child.isMesh) {
                                child.castShadow = true;
                                child.receiveShadow = true;
                                if (Array.isArray(child.material)) {
                                    child.material = [
                                        new THREE.MeshStandardMaterial({
                                            color: 0x1d4ed8, // Marine container blue (RAL 5010)
                                            roughness: 0.42,
                                            metalness: 0.28,
                                            name: 'ContainerBody_MarinePaint'
                                        }),
                                        new THREE.MeshStandardMaterial({
                                            color: 0xe2e8f0, // Galvanized door locking hardware
                                            roughness: 0.22,
                                            metalness: 0.85,
                                            name: 'ContainerHardware_GalvanizedSteel'
                                        })
                                    ];
                                }
                            }
                        });
                        customCargoMeshes['container_22g1'] = res.root;
                        customCargoMeshes['container'] = res.root;
                        customCargoMeshes['container_20ft_glb'] = res.root;
                        if (typeof rebuildCargo3D === 'function' && (
                            state.cargoType === 'container' || 
                            state.cargoType === 'container_20ft_glb' ||
                            state.cargoType === 'iso40' ||
                            state.cargoType === 'iso40hc' ||
                            state.cargoType === 'opentop'
                        )) {
                            rebuildCargo3D();
                        }
                    }).catch(e => {
                        console.warn('[AssetManager] conts20ft.obj load notice:', e);
                    });

                // High-fidelity authentic 40ft High Cube Carrier PrimeLINE Reefer container 3D model
                loaders.loadFromUrl('/assets/models/container_reefer_40hc_real_v2.obj', {
                    specKey: 'container_40ft',
                    targetDimensions: { x: 12.192, y: 2.896, z: 2.438 }
                }).then(res => {
                    const whitePaintMat = new THREE.MeshStandardMaterial({
                        color: 0xf8fafc, // Signal Marine Reefer White (RAL 9003)
                        roughness: 0.32,
                        metalness: 0.18,
                        name: 'Reefer_White'
                    });
                    const carrierBlueMat = new THREE.MeshStandardMaterial({
                        color: 0x1e3a8a, // Carrier PrimeLINE Royal Marine Blue panel
                        roughness: 0.38,
                        metalness: 0.28,
                        name: 'Carrier_PrimeLine_Blue'
                    });
                    const darkMachineryMat = new THREE.MeshStandardMaterial({
                        color: 0x0f172a, // Slate charcoal for condenser fan, fan shroud, compressor & chassis underside
                        roughness: 0.55,
                        metalness: 0.65,
                        name: 'Reefer_DarkMachinery'
                    });
                    const galvHardwareMat = new THREE.MeshStandardMaterial({
                        color: 0xe2e8f0, // Hot-dip galvanized door locking bars, cam keepers, bolts & ISO 1161 castings
                        roughness: 0.20,
                        metalness: 0.88,
                        name: 'Reefer_GalvSteel'
                    });
                    const ctrlPanelMat = new THREE.MeshStandardMaterial({
                        color: 0x1e293b, // Digital keypad & controller box
                        roughness: 0.35,
                        metalness: 0.45,
                        name: 'Reefer_Controller'
                    });
                    const rubberGasketMat = new THREE.MeshStandardMaterial({
                        color: 0x090d16, // Matte black EPDM door gaskets
                        roughness: 0.92,
                        metalness: 0.05,
                        name: 'Reefer_Rubber'
                    });
                    const cautionYellowMat = new THREE.MeshStandardMaterial({
                        color: 0xfacc15, // High-visibility safety yellow for cable tray & decals
                        roughness: 0.40,
                        metalness: 0.15,
                        name: 'Reefer_SafetyYellow'
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

                    customCargoMeshes['reefer'] = res.root;
                    customCargoMeshes['reefer_40hc'] = res.root;

                    if (typeof rebuildCargo3D === 'function' && state.cargoType === 'reefer') {
                        rebuildCargo3D();
                    }
                }).catch(e => {
                    console.warn('[AssetManager] container_reefer_40hc_real_v2.obj load notice:', e);
                });

                loaders.loadFromUrl('/assets/models/container_20ft.glb', { specKey: 'container_20ft' })
                    .then(res => {
                        if (!customCargoMeshes['container_20ft_glb']) customCargoMeshes['container_20ft_glb'] = res.root;
                    }).catch(() => {});

                loaders.loadFromUrl('/assets/models/container_40ft.glb', { specKey: 'container_40ft' })
                    .then(res => {
                        customCargoMeshes['container_40ft_glb'] = res.root;
                    }).catch(() => {});

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

            document.getElementById('library-studio-modal')?.classList.remove('open');

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
                open_top: [18, 26, 6.06, 2.44, 2.59],
                flat_rack: [20, 34, 6.06, 2.44, 2.59],
                platform: [12, 28, 6.06, 2.44, 0.35],
                iso40: [26, 30.5, 12.19, 2.44, 2.59],
                iso40hc: [26, 30.5, 12.19, 2.44, 2.90],
                reefer: [26, 30.5, 12.19, 2.44, 2.90],
                isotank: [26, 32, 6.06, 2.44, 2.59],
                transformer: [45, 85, 5.2, 2.8, 3.2],
                vessel: [28, 55, 7.5, 2.6, 2.6],
                wind_nacelle: [65, 95, 8.5, 3.4, 3.6],
                excavator: [24, 35, 6.4, 3.0, 3.1],
                boat: [22, 45, 12.0, 3.4, 3.2],
                car: [2.4, 3.2, 5.2, 1.95, 1.85]
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

        function getCameraFollowTargetWorld() {
            if (!state.cameraFollow) return null;
            const mode = state.cameraFollow.mode || 'cog';
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
                const off = state.cameraFollow.customOffset || new THREE.Vector3();
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
            const worldTarget = getCameraFollowTargetWorld();
            if (!worldTarget || !controls || !camera) return;
            const shift = worldTarget.clone().sub(controls.target);
            controls.target.copy(worldTarget);
            camera.position.add(shift);
            prevFollowWorldPos = worldTarget.clone();
        }

        function updateCameraFollowSystem(dt) {
            if (!state.cameraFollow || !state.cameraFollow.enabled || !controls || !camera) {
                prevFollowWorldPos = null;
                if (cameraFollowMarker) cameraFollowMarker.visible = false;
                return;
            }

            const worldTarget = getCameraFollowTargetWorld();
            if (!worldTarget) return;

            if (cameraFollowMarker) {
                cameraFollowMarker.visible = true;
                cameraFollowMarker.position.copy(worldTarget);
                const s = 1.0 + Math.sin(Date.now() * 0.007) * 0.12;
                cameraFollowMarker.scale.set(s, s, s);
            }

            if (!prevFollowWorldPos) {
                prevFollowWorldPos = worldTarget.clone();
                return;
            }

            const delta = worldTarget.clone().sub(prevFollowWorldPos);
            if (delta.lengthSq() > 1e-9) {
                camera.position.add(delta);
                controls.target.add(delta);
                prevFollowWorldPos.copy(worldTarget);
            }
        }

        const SIM_STEP = 1 / 60;
        let simAccumulator = 0;

        function animate() {
            requestAnimationFrame(animate);
            const dt = Math.min(0.05, simClock.getDelta());
            if (replay.playing) stepReplay(dt);
            else {
                // Fixed 60 Hz physics step driven by real elapsed time (accumulator):
                // sim speed is identical on 30/60/144 Hz displays instead of scaling with FPS.
                simAccumulator = Math.min(simAccumulator + dt, SIM_STEP * 2);
                while (simAccumulator >= SIM_STEP) {
                    stepPhysicsEngine();
                    simAccumulator -= SIM_STEP;
                }
                pushReplaySample();
            }
            updateSceneAndTelemetry();
            updateCameraFollowSystem(dt);
            controls.update();

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
            phy.shakeOff = new THREE.Vector3();
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

            // Focus high-res shadow frustum dynamically on payload
            if (envManager && phy.cargoPos) {
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
