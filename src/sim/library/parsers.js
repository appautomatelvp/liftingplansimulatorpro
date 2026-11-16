/**
 * library/parsers — STL/OBJ/GLB parsers
 * Split from legacy god-file (strangler Phase 2). Shared scope via assemble.
 */
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

        const portAssetRequests = new Map();
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

        function loadPortAssetOnce(cacheKey, loaderFn) {
            if (portAssetRequests.has(cacheKey)) return portAssetRequests.get(cacheKey);
            const promise = Promise.resolve().then(loaderFn);
            portAssetRequests.set(cacheKey, promise);
            return promise;
        }

        function paintIsoRealisticRoot(root) {
            root.traverse(child => {
                if (!child.isMesh) return;
                child.castShadow = true;
                child.receiveShadow = true;
                child.visible = true;
                if (child.geometry && !child.geometry.attributes.normal) {
                    child.geometry.computeVertexNormals();
                }
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
                    if (m.isMeshStandardMaterial || m.isMeshPhysicalMaterial) {
                        m.side = THREE.DoubleSide;
                        m.transparent = false;
                        m.opacity = 1;
                        m.depthWrite = true;
                        m.needsUpdate = true;
                        return m;
                    }
                    return new THREE.MeshStandardMaterial({
                        color: c,
                        roughness: Math.max(0.18, 1 - ((m.shininess || 30) / 120)),
                        metalness: isSteel ? 0.72 : 0.22,
                        side: THREE.DoubleSide,
                        transparent: false,
                        opacity: 1,
                        name
                    });
                });
                child.material = Array.isArray(child.material) ? upgraded : upgraded[0];
            });
            root.userData.isNormalizedAsset = true;
            root.userData.keepMaterials = true;
            root.userData.isoRealisticV2 = true;
        }

        let _sharedPortAssetLoader = null;
        function ensureCargoPortAsset(cargoType) {
            if (!cargoType) return;
            const LoaderCtor = window.CAE?.AssetLoaders || AssetLoaders;
            const loaders = _sharedPortAssetLoader || (_sharedPortAssetLoader = new LoaderCtor());
            const isoEntry = isoRealisticSuite.find(entry => entry.keys.includes(cargoType));
            if (isoEntry) {
                loadPortAssetOnce(`iso:${isoEntry.file}`, () =>
                    loaders.loadFromUrl(`/assets/models/${isoEntry.file}`, {
                        specKey: isoEntry.specKey,
                        cullInterior: false,
                        optimizeHull: false,
                        mode: 'cad_strict'
                    }).then(res => {
                        paintIsoRealisticRoot(res.root);
                        isoEntry.keys.forEach(k => { customCargoMeshes[k] = res.root; });
                        if (typeof rebuildCargoAndRig === 'function' && isoEntry.keys.includes(state.cargoType)) {
                            if (activeCargoVisual) activeCargoVisual.userData.meshKey = '';
                            rebuildCargoAndRig(false);
                        }
                    }).catch(e => {
                        console.warn(`[AssetManager] ${isoEntry.file} load notice:`, e);
                    })
                );
                return;
            }
            if (cargoType === 'car') {
                loadPortAssetOnce('cargo:bus', () =>
                    loaders.loadFromUrl('/assets/models/bus.obj', {
                        specKey: 'generic_cargo',
                        targetDimensions: { x: 9.0, y: 2.80, z: 2.38 },
                        forceExactDimensions: true,
                        mode: 'cad_strict'
                    }).then(res => {
                        const bodyMat = new THREE.MeshStandardMaterial({
                            color: 0x2c8c8a, roughness: 0.38, metalness: 0.22, side: THREE.DoubleSide, name: 'Vehicle_BodyPaint'
                        });
                        const glassMat = new THREE.MeshStandardMaterial({
                            color: 0x0b1526, roughness: 0.08, metalness: 0.86, transparent: false, opacity: 1.0, side: THREE.DoubleSide, name: 'Vehicle_Glass'
                        });
                        const darkMat = new THREE.MeshStandardMaterial({
                            color: 0x111827, roughness: 0.55, metalness: 0.45, side: THREE.DoubleSide, name: 'Vehicle_Trim'
                        });
                        res.root.traverse(child => {
                            if (!child.isMesh) return;
                            child.castShadow = true;
                            child.receiveShadow = true;
                            const matName = Array.isArray(child.material)
                                ? (child.material[0]?.name || '')
                                : (child.material?.name || '');
                            const n = `${child.name || ''} ${matName}`.toLowerCase();
                            if (n.includes('glass') || n.includes('window') || n.includes('wind') || n.startsWith('glass')) child.material = glassMat;
                            else if (n.includes('wheel') || n.includes('tyre') || n.includes('tire') || n.includes('chassis') || n.includes('under') || /^w_/.test(n)) child.material = darkMat;
                            else child.material = bodyMat;
                        });
                        res.root.name = 'Vehicle_Bus_CAD';
                        customCargoMeshes['car'] = res.root;
                        if (typeof rebuildCargoAndRig === 'function' && state.cargoType === 'car') {
                            if (activeCargoVisual) activeCargoVisual.userData.meshKey = '';
                            rebuildCargoAndRig(false);
                        }
                    }).catch(e => {
                        console.warn('[AssetManager] bus.obj load notice:', e);
                    })
                );
            }
        }

        function ensureBeamPortAsset(beamType, stsSizeFt = 40, stsTwinLift = false) {
            const loaders = new (window.CAE?.AssetLoaders || AssetLoaders)();
            if (beamType === 'container_spreader') {
                const target = stsTwinLift
                    ? { file: 'STS_Spreader_2x20ft_TwinLift.obj', key: 'sts_spreader_twin' }
                    : (Number(stsSizeFt) <= 20
                        ? { file: 'STS_Spreader_20ft_Retracted.obj', key: 'sts_spreader_20' }
                        : (Number(stsSizeFt) >= 45
                            ? { file: 'STS_Spreader_45ft_Extended.obj', key: 'sts_spreader_45' }
                            : { file: 'STS_Spreader_40ft_Master.obj', key: 'sts_spreader_40' }));
                loadPortAssetOnce(`beam:${target.key}`, () =>
                    loaders.loadFromUrl(`/assets/models/${target.file}`, { specKey: target.key })
                        .then(res => {
                            res.root.traverse(child => {
                                if (!child.isMesh) return;
                                child.castShadow = true;
                                child.receiveShadow = true;
                                const n = (child.name || '').toLowerCase();
                                const isFlip = n.includes('flip') || n.includes('guide');
                                const isHazard = n.includes('hazard') || n.includes('stripe');
                                const isSteel = n.includes('steel') || n.includes('head') || n.includes('hpu') || n.includes('grey');
                                if (isFlip) child.material = (MATS.stsFlipperRed || MATS.craneSafetyRed || MATS.redMaster).clone();
                                else if (isHazard) child.material = (MATS.stsHazardStripe || MATS.yellowHazard).clone();
                                else if (isSteel) child.material = (MATS.stsGreyBox || MATS.darkSteel || MATS.gunmetal).clone();
                                else child.material = (MATS.spreaderYellow || MATS.craneYellow || MATS.yellowHazard).clone();
                            });
                            res.root.userData.isNormalizedAsset = true;
                            res.root.userData.stsCad = true;
                            customBeamMeshes[target.key] = res.root;
                            if (state.beamType === 'container_spreader' && typeof rebuildSpreaderVisuals === 'function') {
                                rebuildSpreaderVisuals();
                                if (typeof mountBeamBodies === 'function') mountBeamBodies();
                            }
                        }).catch(e => console.warn(`[AssetManager] ${target.file} load notice:`, e))
                );
            } else if (beamType === 'modulift_spreader_glb' || beamType === 'spreader') {
                loadPortAssetOnce('beam:modulift_spreader_glb', () =>
                    loaders.loadFromUrl('/assets/models/modulift_spreader.glb', { specKey: 'modulift_spreader' })
                        .then(res => { customBeamMeshes['modulift_spreader_glb'] = res.root; })
                        .catch(() => {})
                );
            }
        }

        async function preloadStandardPortAssets() {
            try {
                const loaders = new (window.CAE?.AssetLoaders || AssetLoaders)();
                // Load only the currently selected cargo/beam CAD assets at boot; others load on demand.
                ensureCargoPortAsset(state.cargoType);
                ensureBeamPortAsset(state.beamType, state.stsSizeFt, state.stsTwinLift);

                loadPortAssetOnce('hw:crosby_shackle_glb', () =>
                    loaders.loadFromUrl('/assets/models/crosby_shackle.glb', { specKey: 'crosby_shackle_17t' })
                        .then(res => { customHwMeshes['crosby_shackle_glb'] = res.root; })
                        .catch(() => {})
                );

                loadPortAssetOnce('crane:sts_crane_glb', () =>
                    loaders.loadFromUrl('/assets/models/sts_crane.glb', { specKey: 'sts_gantry_crane' })
                        .then(res => { customCraneMeshes['sts_crane_glb'] = res.root; })
                        .catch(() => {})
                );
            } catch (e) {
                console.warn('[AssetManager] Preload assets notice:', e);
            }
        }

