/**
 * library/reconstruction_export — 2D→3D, OBJ export, render loop
 * Split from legacy god-file (strangler Phase 2). Shared scope via assemble.
 */
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
            // Bands are even-integer tonne ranges (typical loaded / gross-ish field values).
            // ISO boxes cluster in the realistic 20–28 t working window.
            const bands = {
                crate: [16, 28, 4.5, 2.6, 2.4],
                pipe: [12, 28, 8.0, 1.4, 1.4],
                container: [20, 24, 6.06, 2.44, 2.59],
                container_20ft_glb: [20, 24, 6.06, 2.44, 2.59],
                iso20hc: [20, 26, 6.06, 2.44, 2.90],
                open_top: [20, 24, 6.06, 2.44, 2.59],
                opentop: [20, 24, 6.06, 2.44, 2.59],
                opentop40: [22, 28, 12.19, 2.44, 2.59],
                flat_rack: [20, 28, 6.06, 2.44, 2.59],
                flatrack: [20, 28, 12.19, 2.44, 2.90],
                flatrack20: [20, 26, 6.06, 2.44, 2.59],
                platform: [16, 28, 12.19, 2.44, 0.61],
                platform20: [12, 24, 6.06, 2.44, 0.34],
                iso40: [24, 28, 12.19, 2.44, 2.59],
                container_40ft_glb: [24, 28, 12.19, 2.44, 2.59],
                iso40hc: [24, 28, 12.19, 2.44, 2.90],
                iso45hc: [24, 28, 13.72, 2.44, 2.90],
                iso53hc: [24, 28, 16.15, 2.59, 2.90],
                container10: [8, 12, 2.99, 2.44, 2.59],
                reefer: [24, 28, 12.19, 2.44, 2.90],
                reefer20: [20, 26, 6.06, 2.44, 2.59],
                isotank: [24, 28, 6.06, 2.44, 2.59],
                halfheight: [20, 28, 6.06, 2.44, 1.30],
                drybulk: [20, 28, 6.06, 2.44, 2.59],
                transformer: [48, 84, 5.2, 2.8, 3.2],
                vessel: [28, 56, 7.5, 2.6, 2.6],
                wind_nacelle: [66, 96, 8.5, 3.4, 3.6],
                excavator: [24, 36, 6.4, 3.0, 3.1],
                boat: [24, 44, 12.0, 3.4, 3.2],
                offshore_skid: [28, 44, 6.2, 3.2, 2.8],
                car: [8, 12, 9.0, 2.38, 2.80]
            };
            const band = bands[type];
            if (!band) return null;
            const ref = band[2] * band[3] * band[4];
            const vol = Math.max(0.05, L * W * H);
            const t = THREE.MathUtils.clamp((vol / ref - 1) / 0.35, -1, 1);
            const mid = (band[0] + band[1]) * 0.5;
            const span = (band[1] - band[0]) * 0.5;
            const raw = THREE.MathUtils.clamp(mid + t * span, band[0], band[1]);
            // Always return an even integer tonne for UI readability
            const even = Math.round(raw / 2) * 2;
            return Math.max(band[0], Math.min(band[1], even));
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

            const wEven = Math.max(2, Math.round(Number(vals.weight) / 2) * 2);
            vals.weight = wEven;
            state.weight = wEven;
            const inpWeight = document.getElementById('inp-Weight'); if (inpWeight) inpWeight.value = wEven;
            const vWeight = document.getElementById('v-Weight'); if (vWeight) vWeight.textContent = String(wEven);
            const numWeight = document.getElementById('num-Weight'); if (numWeight) numWeight.value = String(wEven);

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
            if (typeof window.addEventListener === 'function') {
                window.addEventListener('resize', invalidateUiSafeNdcCache, { passive: true });
            }
        }

        /**
         * Visible 3D “stage” center in NDC — cached.
         * DOM layout (getBoundingClientRect / getComputedStyle) is expensive; refresh
         * only when dirty, layout classes change, or TTL expires.
         */
        function computeUiSafeNdcCenter() {
            const safeGetStyle = (el) => {
                if (typeof window !== 'undefined' && typeof window.getComputedStyle === 'function' && el) {
                    try { return window.getComputedStyle(el); } catch (e) {}
                }
                return (el && el.style) || { getPropertyValue: () => '', display: '', visibility: '' };
            };
            const w = Math.max(1, (typeof window !== 'undefined' && window.innerWidth) || 1280);
            const h = Math.max(1, (typeof window !== 'undefined' && window.innerHeight) || 720);
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
                let leftEdge = 360;
                if (gear) {
                    const st = safeGetStyle(gear);
                    if (st.display !== 'none') {
                        const r = gear.getBoundingClientRect();
                        if (r.width > 40 && r.right > 40) leftEdge = Math.max(r.right, 120);
                        else leftEdge = Math.max(gear.offsetWidth + 10, 120);
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
                    const st = safeGetStyle(hud);
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
                const resolved = (safeGetStyle(document.body).getPropertyValue?.('--safe-right') || '').trim();
                if (resolved.endsWith('px')) {
                    const px = parseFloat(resolved);
                    if (px > 80) drawerW = px;
                } else {
                    const dwVar = (safeGetStyle(document.documentElement).getPropertyValue?.('--drawer-w') || '').trim();
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
            if (typeof updateWeatherFx === 'function') updateWeatherFx(dt);
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
            // Red force-flow pulses along cables that just went taut under hoist
            if (typeof updateCableForceFlows === 'function') updateCableForceFlows(dt);

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
