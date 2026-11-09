/**
 * scene — part of the lifting simulator.
 * Clean Wide Flat Rigging & Heavy-Lift Engineering Testbed (No Seaport Clutter).
 * These files are assembled into one module so they share state, physics and the scene.
 */
        function initMaterials() {
            const PbrClass = window.GFX?.PBRMaterialFactory || GFX?.PBRMaterialFactory;
            if (PbrClass) {
                pbrFactory = new PbrClass();
                window.pbrFactory = pbrFactory;
            }

            // Forged & Machined Rigging Steel Materials
            MATS.yellowHazard = new THREE.MeshPhysicalMaterial({ color: 0xfacc15, metalness: 0.42, roughness: 0.28, clearcoat: 0.35 });
            MATS.orangeBeam = new THREE.MeshPhysicalMaterial({ color: 0xf97316, metalness: 0.48, roughness: 0.26, clearcoat: 0.35 });
            MATS.redMaster = new THREE.MeshPhysicalMaterial({ color: 0xdc2626, metalness: 0.52, roughness: 0.24, clearcoat: 0.45 });
            MATS.craneRed = new THREE.MeshPhysicalMaterial({ color: 0xc81e1e, metalness: 0.4, roughness: 0.28, clearcoat: 0.4 });
            MATS.gantryBlue = new THREE.MeshPhysicalMaterial({ color: 0x0284c7, metalness: 0.42, roughness: 0.28, clearcoat: 0.4 });
            MATS.bargePurple = new THREE.MeshPhysicalMaterial({ color: 0x0f766e, metalness: 0.38, roughness: 0.32, clearcoat: 0.35 });
            MATS.galvSteel = new THREE.MeshStandardMaterial({ color: 0xe2e8f0, metalness: 0.90, roughness: 0.20 });
            MATS.forgedAlloy = new THREE.MeshPhysicalMaterial({ color: 0xcbd5e1, metalness: 0.92, roughness: 0.22, clearcoat: 0.25 });
            MATS.darkSteel = new THREE.MeshStandardMaterial({ color: 0x1e293b, metalness: 0.76, roughness: 0.34 });
            MATS.gunmetal = new THREE.MeshStandardMaterial({ color: 0x334155, metalness: 0.84, roughness: 0.26 });

            // Hyper-Realistic Procedural PBR Textures & Optically Physical Materials
            if (pbrFactory) {
                MATS.wireRope = pbrFactory.createWireRopeMaterial();
                MATS.quayConcrete = pbrFactory.createQuayConcreteMaterial();
                MATS.waterDeepSea = pbrFactory.createMaritimeWaterMaterial();
                MATS.hookChevrons = new THREE.MeshPhysicalMaterial({
                    map: pbrFactory.createHazardChevronTexture(6),
                    metalness: 0.42,
                    roughness: 0.24,
                    clearcoat: 0.5
                });
            } else {
                MATS.wireRope = new THREE.MeshStandardMaterial({ color: 0x94a3b8, metalness: 0.86, roughness: 0.28 });
                MATS.quayConcrete = new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.88, metalness: 0.08 });
                MATS.waterDeepSea = new THREE.MeshPhysicalMaterial({ color: 0x03445e, roughness: 0.15, metalness: 0.8, transparent: true, opacity: 0.92 });
                MATS.hookChevrons = MATS.yellowHazard;
            }

            MATS.chainDark = new THREE.MeshStandardMaterial({ color: 0x4b5563, metalness: 0.92, roughness: 0.26 });
            MATS.webGreen = new THREE.MeshStandardMaterial({ color: 0x10b981, metalness: 0.08, roughness: 0.76 });
            MATS.ferruleSilver = new THREE.MeshStandardMaterial({ color: 0xf1f5f9, metalness: 0.94, roughness: 0.14 });
            MATS.timberWood = new THREE.MeshStandardMaterial({ color: 0x92400e, roughness: 0.82, metalness: 0.05 });
            MATS.lpHighlight = new THREE.MeshStandardMaterial({ color: 0x10b981, emissive: 0x064e3b, metalness: 0.55, roughness: 0.25 });
            MATS.lpSelected = new THREE.MeshStandardMaterial({ color: 0x38bdf8, emissive: 0x0369a1, metalness: 0.65, roughness: 0.2 });

            // High-Precision CAD / Industrial Cargo Surface Materials
            MATS.containerBlue = new THREE.MeshPhysicalMaterial({ color: 0x0369a1, metalness: 0.35, roughness: 0.38, clearcoat: 0.35 });
            MATS.woodCrate = new THREE.MeshStandardMaterial({ color: 0xb45309, metalness: 0.12, roughness: 0.72 });
            MATS.vesselSteel = new THREE.MeshPhysicalMaterial({ color: 0xdbeafe, metalness: 0.72, roughness: 0.22, clearcoat: 0.45 });
            MATS.trafoGrey = new THREE.MeshPhysicalMaterial({ color: 0x64748b, metalness: 0.58, roughness: 0.3, clearcoat: 0.35 });
            MATS.porcelain = new THREE.MeshPhysicalMaterial({ color: 0x7c2d12, metalness: 0.15, roughness: 0.15, clearcoat: 0.9 });
            MATS.carRed = new THREE.MeshPhysicalMaterial({ color: 0xb91c1c, metalness: 0.55, roughness: 0.16, clearcoat: 1.0, clearcoatRoughness: 0.12 });
            MATS.carTrim = new THREE.MeshStandardMaterial({ color: 0x111827, metalness: 0.4, roughness: 0.45 });
            MATS.headlamp = new THREE.MeshStandardMaterial({ color: 0xfff7d6, emissive: 0xfff1b8, emissiveIntensity: 0.8, metalness: 0.2, roughness: 0.25 });
            MATS.taillamp = new THREE.MeshStandardMaterial({ color: 0xef4444, emissive: 0x991b1b, emissiveIntensity: 0.6 });
            MATS.boatHull = new THREE.MeshPhysicalMaterial({ color: 0xf8fafc, metalness: 0.28, roughness: 0.22, clearcoat: 0.75 });
            MATS.hullBoot = new THREE.MeshPhysicalMaterial({ color: 0x7f1d1d, metalness: 0.35, roughness: 0.4, clearcoat: 0.3 });
            MATS.boatDeck = new THREE.MeshPhysicalMaterial({ color: 0x0f766e, metalness: 0.25, roughness: 0.45, clearcoat: 0.25 });
            MATS.boxMaroon = new THREE.MeshPhysicalMaterial({ color: 0x9f1239, metalness: 0.35, roughness: 0.4, clearcoat: 0.3 });
            MATS.boxGreen = new THREE.MeshPhysicalMaterial({ color: 0x166534, metalness: 0.32, roughness: 0.42, clearcoat: 0.28 });
            MATS.reeferWhite = new THREE.MeshPhysicalMaterial({ color: 0xf8fafc, metalness: 0.25, roughness: 0.35, clearcoat: 0.4 });
            MATS.tankSteel = new THREE.MeshPhysicalMaterial({ color: 0xe2e8f0, metalness: 0.82, roughness: 0.18, clearcoat: 0.55 });
            MATS.glassDark = new THREE.MeshPhysicalMaterial({ color: 0x0f172a, metalness: 0.85, roughness: 0.08, clearcoat: 1.0 });
            MATS.rubberTire = new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.88, metalness: 0.05 });
            MATS.cadEdgeLine = new THREE.LineBasicMaterial({
                color: 0x0f172a,
                transparent: true,
                opacity: 0.65,
                polygonOffset: true,
                polygonOffsetFactor: -1.0,
                polygonOffsetUnits: -4.0,
                depthTest: true
            });
            MATS.cadLightEdge = new THREE.LineBasicMaterial({
                color: 0x94a3b8,
                transparent: true,
                opacity: 0.55,
                polygonOffset: true,
                polygonOffsetFactor: -1.0,
                polygonOffsetUnits: -4.0,
                depthTest: true
            });

            // Crane & Spreader Industrial Finish Materials (preserving PBR concrete above!)
            MATS.craneYellow = new THREE.MeshPhysicalMaterial({ color: 0xf59e0b, metalness: 0.36, roughness: 0.30, clearcoat: 0.38 });
            MATS.craneWhite = new THREE.MeshPhysicalMaterial({ color: 0xf8fafc, metalness: 0.25, roughness: 0.35, clearcoat: 0.3 });
            MATS.craneSafetyRed = new THREE.MeshPhysicalMaterial({ color: 0xdc2626, metalness: 0.35, roughness: 0.35, clearcoat: 0.3 });
            MATS.spreaderYellow = new THREE.MeshPhysicalMaterial({ color: 0xeab308, metalness: 0.46, roughness: 0.25, clearcoat: 0.45 });
            MATS.craneRailSteel = new THREE.MeshStandardMaterial({ color: 0x94a3b8, metalness: 0.88, roughness: 0.18 });
            MATS.maerskCyan = new THREE.MeshPhysicalMaterial({ color: 0x0284c7, metalness: 0.3, roughness: 0.38, clearcoat: 0.3 });
            MATS.evergreenGreen = new THREE.MeshPhysicalMaterial({ color: 0x15803d, metalness: 0.3, roughness: 0.38, clearcoat: 0.3 });
            MATS.hapagOrange = new THREE.MeshPhysicalMaterial({ color: 0xea580c, metalness: 0.3, roughness: 0.38, clearcoat: 0.3 });
        }

        // Helper: Adds crisp CAD feature crease outlines to any 3D Group
        function applyCADFeatureEdges(rootGroup, useLightEdge = false) {
            const lineMat = useLightEdge ? MATS.cadLightEdge : MATS.cadEdgeLine;
            const meshes = [];
            rootGroup.traverse(obj => {
                if (obj.isMesh && obj.visible && obj.geometry && !obj.userData?.noCADEdge) {
                    const gType = obj.geometry.type || '';
                    const vCount = obj.geometry.attributes?.position?.count || 0;
                    if (gType.includes('Sphere') || gType.includes('Torus') || vCount > 240) return;
                    meshes.push(obj);
                }
            });
            meshes.forEach(m => {
                const edgesGeo = new THREE.EdgesGeometry(m.geometry, 28);
                const line = new THREE.LineSegments(edgesGeo, lineMat);
                line.visible = state.showCADEdges;
                line.userData.isCADEdge = true;
                line.raycast = function () {};
                m.add(line);
                cadEdgeObjects.push(line);
            });
        }

        // Generates a Procedural Studio HDRI Reflection Environment so forged steel & wire ropes look razor-sharp
        function createStudioEnvironmentMap(rendererInstance) {
            const pmremGenerator = new THREE.PMREMGenerator(rendererInstance);
            pmremGenerator.compileEquirectangularShader();
            const envScene = new THREE.Scene();
            envScene.background = new THREE.Color(0x131924);

            const topLight = new THREE.Mesh(
                new THREE.PlaneGeometry(34, 34),
                new THREE.MeshBasicMaterial({ color: 0xffffff })
            );
            topLight.position.set(0, 16, 0);
            topLight.rotation.x = Math.PI / 2;
            envScene.add(topLight);

            const sideLight1 = new THREE.Mesh(
                new THREE.PlaneGeometry(26, 14),
                new THREE.MeshBasicMaterial({ color: 0x60a5fa })
            );
            sideLight1.position.set(16, 6, 12);
            sideLight1.lookAt(0, 0, 0);
            envScene.add(sideLight1);

            const sideLight2 = new THREE.Mesh(
                new THREE.PlaneGeometry(26, 14),
                new THREE.MeshBasicMaterial({ color: 0xfef08a })
            );
            sideLight2.position.set(-16, 8, -12);
            sideLight2.lookAt(0, 0, 0);
            envScene.add(sideLight2);

            const envTex = pmremGenerator.fromScene(envScene, 0.04).texture;
            pmremGenerator.dispose();
            return envTex;
        }

        function initScene() {
            scene = new THREE.Scene();
            camera = new THREE.PerspectiveCamera(40, window.innerWidth / window.innerHeight, 0.15, 220);
            // Perspective framing on Flat Rack Container + Spreader Beam + Hook (1/3 left offset for open right drawer)
            camera.position.set(-13.5, 9.2, 19.5);

            const container = document.getElementById('canvas-container');
            const GfxRendererClass = window.GFX?.SceneRenderer || GFX?.SceneRenderer;
            if (GfxRendererClass) {
                sceneRenderer = new GfxRendererClass(container, scene, camera, { quality: 'high' });
                renderer = sceneRenderer.renderer;
                envManager = sceneRenderer.envManager;
                pbrFactory = sceneRenderer.pbrFactory;
                keyLight = envManager.sunLight;
                fillLight = envManager.fillLight;
            } else {
                renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
                renderer.setSize(window.innerWidth, window.innerHeight);
                renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
                renderer.shadowMap.enabled = true;
                renderer.shadowMap.type = THREE.PCFSoftShadowMap;
                renderer.outputColorSpace = THREE.SRGBColorSpace;
                renderer.toneMapping = THREE.ACESFilmicToneMapping;
                renderer.toneMappingExposure = 1.18;
                container.appendChild(renderer.domElement);
                scene.environment = createStudioEnvironmentMap(renderer);

                keyLight = new THREE.DirectionalLight(0xffffff, 1.55);
                keyLight.position.set(20, 36, 24);
                keyLight.castShadow = true;
                keyLight.shadow.mapSize.width = 2048;
                keyLight.shadow.mapSize.height = 2048;
                keyLight.shadow.camera.left = -26;
                keyLight.shadow.camera.right = 26;
                keyLight.shadow.camera.top = 26;
                keyLight.shadow.camera.bottom = -26;
                keyLight.shadow.bias = -0.0002;
                scene.add(keyLight);

                fillLight = new THREE.DirectionalLight(0x60a5fa, 0.65);
                fillLight.position.set(-18, 16, -14);
                scene.add(fillLight);
                scene.add(new THREE.AmbientLight(0xffffff, 0.45));
            }

            window.sceneRenderer = sceneRenderer;
            window.envManager = envManager;
            window.pbrFactory = pbrFactory;

            controls = new THREE.OrbitControls(camera, renderer.domElement);
            controls.enableDamping = true;
            controls.dampingFactor = 0.06;
            controls.minDistance = 1.2;
            controls.maxDistance = 120.0;
            controls.maxPolarAngle = Math.PI / 2 - 0.004;
            controls.target.set(3.2, 3.2, -0.6);

            // Camera Follow Target 3D Reticle Marker
            cameraFollowMarker = new THREE.Group();
            cameraFollowMarker.name = 'CameraFollowMarker';
            const ringGeo = new THREE.RingGeometry(0.18, 0.23, 32);
            const ringMat = new THREE.MeshBasicMaterial({ color: 0x38bdf8, side: THREE.DoubleSide, transparent: true, opacity: 0.85 });
            const ringMesh = new THREE.Mesh(ringGeo, ringMat);
            ringMesh.rotation.x = Math.PI / 2;
            const coreMesh = new THREE.Mesh(new THREE.OctahedronGeometry(0.08), new THREE.MeshBasicMaterial({ color: 0x38bdf8 }));
            cameraFollowMarker.add(ringMesh, coreMesh);
            cameraFollowMarker.visible = false;
            scene.add(cameraFollowMarker);

            // Wide Flat Engineered Concrete Testbed Slab (200m x 200m, zero background obstacles)
            floorMesh = new THREE.Mesh(
                new THREE.PlaneGeometry(200, 200),
                MATS.quayConcrete || new THREE.MeshStandardMaterial({ color: 0x263244, roughness: 0.88, metalness: 0.06 })
            );
            floorMesh.rotation.x = -Math.PI / 2;
            floorMesh.receiveShadow = true;
            scene.add(floorMesh);

            // Dual-Scale Engineering Metric Grid (1m subdivisions + 5m major grid)
            gridHelper = new THREE.Group();
            const minorGrid = new THREE.GridHelper(100, 100, 0x334155, 0x1e293b);
            minorGrid.material.transparent = true;
            minorGrid.material.opacity = 0.45;
            const majorGrid = new THREE.GridHelper(100, 20, 0x475569, 0x334155);
            majorGrid.position.y = 0.002;
            majorGrid.material.transparent = true;
            majorGrid.material.opacity = 0.68;
            gridHelper.add(minorGrid, majorGrid);
            gridHelper.position.y = 0.006;
            scene.add(gridHelper);

            envDressing = new THREE.Group();
            scene.add(envDressing);
            waterMesh = null; // No maritime water plane in Rigging Testbed

            // Timber Dunnage Cribbing Blocks (Đà gỗ kê tải chuẩn kỹ thuật trên sàn phẳng)
            dunnageGroup = new THREE.Group();
            scene.add(dunnageGroup);

            // Crane / Overhead Hoist Root Group
            craneVehicleGroup = new THREE.Group();
            scene.add(craneVehicleGroup);

            // 3D Pulling Direction Compass Rose & Vector Indicator on Floor
            buildPullDirectionCompass3D();

            // 3D Ground Cargo Heading Angle Indicator & Floor Protractor
            buildCargoGroundAngleIndicator3D();

            raycaster = new THREE.Raycaster();
            mouse = new THREE.Vector2();
            dragPlane = new THREE.Plane();

            renderer.domElement.addEventListener('pointerdown', onPointerDown, true);
            window.addEventListener('pointermove', onPointerMove);
            window.addEventListener('pointerup', onPointerUp);
            window.addEventListener('resize', onWindowResize);
            buildWorld();
        }

        function groundSurfaceY(x, z) {
            if (state.groundId === 'soil') {
                return 0.05 * Math.sin(x * 0.42) * Math.cos(z * 0.36) + 0.02 * Math.sin((x + z) * 0.9);
            }
            if (state.groundId === 'rough') {
                return 0.22 * Math.sin(x * 0.72 + 0.4) * Math.cos(z * 0.64)
                    + 0.11 * Math.sin(x * 1.55 + z * 1.2)
                    + 0.05 * Math.cos(z * 2.1);
            }
            return 0;
        }

        function supportY(x, z) {
            const g = groundSurfaceY(x, z);
            return state.groundId === 'rough' ? g : g + DUNNAGE_H;
        }

        // Unit normal for the height-field used by the contact solver. Using the
        // terrain normal lets a load settle and slide on a slope realistically.
        function supportNormal(x, z) {
            let dx = 0;
            let dz = 0;
            if (state.groundId === 'soil') {
                dx = 0.05 * 0.42 * Math.cos(x * 0.42) * Math.cos(z * 0.36)
                    + 0.02 * 0.9 * Math.cos((x + z) * 0.9);
                dz = -0.05 * 0.36 * Math.sin(x * 0.42) * Math.sin(z * 0.36)
                    + 0.02 * 0.9 * Math.cos((x + z) * 0.9);
            } else if (state.groundId === 'rough') {
                dx = 0.22 * 0.72 * Math.cos(x * 0.72 + 0.4) * Math.cos(z * 0.64)
                    + 0.11 * 1.55 * Math.cos(x * 1.55 + z * 1.2);
                dz = -0.22 * 0.64 * Math.sin(x * 0.72 + 0.4) * Math.sin(z * 0.64)
                    + 0.11 * 1.2 * Math.cos(x * 1.55 + z * 1.2)
                    - 0.05 * 2.1 * Math.sin(z * 2.1);
            }
            return new THREE.Vector3(-dx, 1, -dz).normalize();
        }

        function boxCorners(L, W, H) {
            const pts = [];
            [-1, 1].forEach(sx => [-1, 1].forEach(sy => [-1, 1].forEach(sz => {
                pts.push(new THREE.Vector3(sx * L / 2, sy * H / 2, sz * W / 2));
            })));
            return pts;
        }

        const SCENE_LABELS = {
            studio: 'Studio Kỹ Thuật (Dark)',
            yard: 'Sân Thử Bê Tông (Daylight)',
            sheet: 'Bản Vẽ Lift Plan (ASME)',
            port: 'Studio Kỹ Thuật (Dark)',
            urban: 'Studio Kỹ Thuật (Dark)',
            offshore: 'Sân Thử Bê Tông (Daylight)'
        };
        const GROUND_LABELS = { flat: 'Sàn bê tông phẳng', soil: 'Nền đất đầm + đà kê', rough: 'Nền nghiêng / gồ ghề' };

        function buildWorld() {
            const sceneToPreset = {
                studio: 'liebherr_studio',
                yard: 'overcast',
                sheet: 'print_plan',
                port: 'liebherr_studio',
                urban: 'sunset',
                offshore: 'overcast'
            };
            const targetPreset = sceneToPreset[state.sceneId] || 'liebherr_studio';

            if (envManager) {
                envManager.applyPreset(targetPreset);
            } else {
                const isLightSheet = state.sceneId === 'sheet';
                const sky = isLightSheet ? 0xeef2f6 : (state.sceneId === 'yard' ? 0x1e293b : 0x131924);
                scene.background = new THREE.Color(sky);
                scene.fog = new THREE.FogExp2(sky, 0.0005);
            }

            const isPrintSheet = state.sceneId === 'sheet';
            if (state.groundId === 'flat') {
                if (isPrintSheet) {
                    floorMesh.material = new THREE.MeshStandardMaterial({
                        color: 0xe2e8f0,
                        roughness: 0.92,
                        metalness: 0.02
                    });
                } else if (MATS.quayConcrete) {
                    floorMesh.material = MATS.quayConcrete;
                } else {
                    floorMesh.material = new THREE.MeshStandardMaterial({
                        color: 0x283446,
                        roughness: 0.88,
                        metalness: 0.06
                    });
                }
            } else {
                const groundTint = { soil: 0x5c472e, rough: 0x4b5563 };
                floorMesh.material = new THREE.MeshStandardMaterial({
                    color: groundTint[state.groundId] || 0x334155,
                    roughness: 0.94,
                    metalness: 0.05
                });
            }

            const prevGeo = floorMesh.geometry;
            if (state.groundId === 'flat') {
                const geo = new THREE.PlaneGeometry(200, 200);
                geo.rotateX(-Math.PI / 2);
                floorMesh.geometry = geo;
                floorMesh.rotation.x = 0;
            } else {
                const seg = state.groundId === 'rough' ? 52 : 28;
                const geo = new THREE.PlaneGeometry(140, 140, seg, seg);
                geo.rotateX(-Math.PI / 2);
                const p = geo.attributes.position;
                for (let i = 0; i < p.count; i++) p.setY(i, groundSurfaceY(p.getX(i), p.getZ(i)));
                geo.computeVertexNormals();
                floorMesh.geometry = geo;
                floorMesh.rotation.x = 0;
            }
            prevGeo.dispose();
            gridHelper.visible = state.groundId === 'flat';

            // Clear any previous dressing — keep ONLY flat-ground CAD engineering reference lines (zero buildings/ships/containers!)
            while (envDressing.children.length) envDressing.remove(envDressing.children[0]);

            if (state.groundId === 'flat') {
                const ringColor = isPrintSheet ? 0x64748b : 0x38bdf8;
                const axisColor = isPrintSheet ? 0x94a3b8 : 0x475569;

                // Concentric Working-Radius Gauge Circles on Testbed Floor (R = 6m, 10m, 14m, 18m)
                [6.0, 10.0, 14.0, 18.0].forEach((r, idx) => {
                    const ring = new THREE.Mesh(
                        new THREE.RingGeometry(r - 0.025, r + 0.025, 96),
                        new THREE.MeshBasicMaterial({
                            color: ringColor,
                            side: THREE.DoubleSide,
                            transparent: true,
                            opacity: idx === 1 ? 0.30 : 0.16
                        })
                    );
                    ring.rotation.x = -Math.PI / 2;
                    ring.position.set(0, 0.009, 0);
                    ring.userData.noCADEdge = true;
                    envDressing.add(ring);
                });

                // Clean X & Z Engineering Centerlines through Load Datum (0, 0, 0)
                const xAxisLine = new THREE.Mesh(
                    new THREE.PlaneGeometry(40, 0.03),
                    new THREE.MeshBasicMaterial({ color: axisColor, transparent: true, opacity: 0.38, side: THREE.DoubleSide })
                );
                xAxisLine.rotation.x = -Math.PI / 2;
                xAxisLine.position.set(0, 0.009, 0);
                xAxisLine.userData.noCADEdge = true;

                const zAxisLine = new THREE.Mesh(
                    new THREE.PlaneGeometry(0.03, 40),
                    new THREE.MeshBasicMaterial({ color: axisColor, transparent: true, opacity: 0.38, side: THREE.DoubleSide })
                );
                zAxisLine.rotation.x = -Math.PI / 2;
                zAxisLine.position.set(0, 0.009, 0);
                zAxisLine.userData.noCADEdge = true;

                envDressing.add(xAxisLine, zAxisLine);
            }

            const hudScene = document.getElementById('hud-scene');
            if (hudScene) {
                hudScene.textContent = `${L(
                    { studio: 'Engineering studio', yard: 'Concrete test pad', sheet: 'Lift-plan CAD sheet' }[state.sceneId] || 'Engineering studio',
                    SCENE_LABELS[state.sceneId] || 'Studio Kỹ Thuật'
                )} · ${L(
                    { flat: 'Flat concrete', soil: 'Compacted soil', rough: 'Uneven ground' }[state.groundId] || 'Flat concrete',
                    GROUND_LABELS[state.groundId] || 'Sàn bê tông phẳng'
                )}`;
            }
            if (dunnageGroup) dunnageGroup.visible = state.groundId !== 'rough';
        }

        // --- 4. BUILD CLEAN RIGGING-FOCUSED CRANE & OVERHEAD HOIST MODES ---
        function buildCraneVehicle() {
            while (craneVehicleGroup.children.length > 0) {
                craneVehicleGroup.remove(craneVehicleGroup.children[0]);
            }
            craneDynamicParts = {};

            const type = state.craneType;

            if (type === 'hook_only') {
                // 1. PURE OVERHEAD HOOK & HOIST MODE (Zero crane clutter — 360° unobstructed rigging view)
                const sheaveCrownGroup = new THREE.Group();
                const crownY = 24.0;
                sheaveCrownGroup.position.set(0, crownY, 0);

                const crownBeam = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.28, 0.68), MATS.darkSteel);
                crownBeam.position.y = 0.22;
                sheaveCrownGroup.add(crownBeam);

                [-0.18, 0.18].forEach(sx => {
                    const upperSheave = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.24, 0.14, 24), MATS.gunmetal);
                    upperSheave.rotation.z = Math.PI / 2;
                    upperSheave.position.set(sx, 0.02, 0);
                    sheaveCrownGroup.add(upperSheave);
                });

                craneVehicleGroup.add(sheaveCrownGroup);
                craneDynamicParts = {
                    type: 'gantry',
                    trolleyGroup: sheaveCrownGroup,
                    girderY: crownY
                };

            } else if (type === 'mobile_telescopic' || type === 'harbour' || type === 'portal_harbour') {
                // 2. LIEBHERR LTM 1200-5.1 ALL-TERRAIN MOBILE TELESCOPIC CRANE ON EXTENDED OUTRIGGERS
                // Positioned cleanly on flat testbed at (-7.5m, -8.5m) -> Working radius ~11.3m to (0,0)
                const baseX = -7.5;
                const baseZ = -8.5;
                const chassisYaw = Math.atan2(-baseX, -baseZ); // Align carrier neatly along working sector

                const carrierGroup = new THREE.Group();
                carrierGroup.position.set(baseX, 0, baseZ);
                carrierGroup.rotation.y = chassisYaw;
                craneVehicleGroup.add(carrierGroup);

                // 5-Axle All-Terrain Carrier Frame (11.0m long x 2.75m wide)
                const chassisDeck = new THREE.Mesh(new THREE.BoxGeometry(2.72, 0.58, 10.8), MATS.darkSteel);
                chassisDeck.position.set(0, 1.12, -0.4);
                chassisDeck.castShadow = true;
                const yellowSkirt = new THREE.Mesh(new THREE.BoxGeometry(2.78, 0.34, 9.2), MATS.craneYellow);
                yellowSkirt.position.set(0, 1.32, -0.2);
                carrierGroup.add(chassisDeck, yellowSkirt);

                // Front Carrier Driver Cab (+Z end)
                const driverCab = new THREE.Mesh(new THREE.BoxGeometry(2.68, 1.45, 2.05), MATS.craneYellow);
                driverCab.position.set(0, 1.75, 4.4);
                driverCab.castShadow = true;
                const driverWindshield = new THREE.Mesh(new THREE.BoxGeometry(2.52, 0.76, 1.15), MATS.glassDark);
                driverWindshield.position.set(0, 1.98, 4.92);
                const frontBumper = new THREE.Mesh(new THREE.BoxGeometry(2.76, 0.38, 0.42), MATS.gunmetal);
                frontBumper.position.set(0, 0.78, 5.38);
                carrierGroup.add(driverCab, driverWindshield, frontBumper);

                // 5 Axles (10 Heavy All-Terrain Tires raised slightly on outriggers!)
                [-4.2, -2.5, -0.8, 1.1, 2.8].forEach(az => {
                    [-1.28, 1.28].forEach(ax => {
                        const tire = new THREE.Mesh(new THREE.CylinderGeometry(0.56, 0.56, 0.42, 24), MATS.rubberTire);
                        tire.rotation.z = Math.PI / 2;
                        tire.position.set(ax, 0.64, az); // Raised 8cm clear of ground on outrigger jacks!
                        tire.castShadow = true;
                        const rim = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.28, 0.44, 16), MATS.galvSteel);
                        rim.rotation.z = Math.PI / 2;
                        rim.position.copy(tire.position);
                        carrierGroup.add(tire, rim);
                    });
                });

                // 4 Fully Extended H-Style Telescoping Outrigger Beams + Hydraulic Jacks + Timber/Steel Spreader Mats
                [-3.8, 3.2].forEach(oz => {
                    const outBox = new THREE.Mesh(new THREE.BoxGeometry(8.2, 0.36, 0.48), MATS.darkSteel);
                    outBox.position.set(0, 0.92, oz);
                    outBox.castShadow = true;
                    carrierGroup.add(outBox);

                    [-3.95, 3.95].forEach(ox => {
                        const innerBeam = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.28, 0.36), MATS.yellowHazard);
                        innerBeam.position.set(ox * 0.82, 0.92, oz);

                        const jackBarrel = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, 0.88, 18), MATS.craneYellow);
                        jackBarrel.position.set(ox, 0.78, oz);
                        const jackRod = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.56, 16), MATS.ferruleSilver);
                        jackRod.position.set(ox, 0.36, oz);
                        const floatFoot = new THREE.Mesh(new THREE.CylinderGeometry(0.36, 0.42, 0.10, 20), MATS.darkSteel);
                        floatFoot.position.set(ox, 0.15, oz);

                        // Heavy Engineered Outrigger Spreader Mat (1.7m x 1.7m x 0.10m) resting flush on floor
                        const matPad = new THREE.Mesh(new THREE.BoxGeometry(1.70, 0.10, 1.70), MATS.timberWood);
                        matPad.position.set(ox, 0.05, oz);
                        matPad.receiveShadow = true;
                        matPad.castShadow = true;
                        const matRim = new THREE.Mesh(new THREE.BoxGeometry(1.74, 0.04, 1.74), MATS.darkSteel);
                        matRim.position.set(ox, 0.02, oz);

                        carrierGroup.add(innerBeam, jackBarrel, jackRod, floatFoot, matPad, matRim);
                    });
                });

                // Slewing Bearing Turntable Ring (at rear-center of carrier: local z = -1.6m)
                const slewLocalZ = -1.6;
                const worldPivot = new THREE.Vector3(0, 0, slewLocalZ).applyAxisAngle(new THREE.Vector3(0, 1, 0), chassisYaw);
                const slewCenterX = baseX + worldPivot.x;
                const slewCenterZ = baseZ + worldPivot.z;

                const slewRing = new THREE.Mesh(new THREE.CylinderGeometry(1.28, 1.32, 0.28, 32), MATS.gunmetal);
                slewRing.position.set(slewCenterX, 1.54, slewCenterZ);
                craneVehicleGroup.add(slewRing);

                const slewGroup = new THREE.Group();
                slewGroup.position.set(slewCenterX, 1.68, slewCenterZ);
                craneVehicleGroup.add(slewGroup);

                // Superstructure Deck, Engine Cowling & Stacked 74T Counterweight Slabs
                const superDeck = new THREE.Mesh(new THREE.BoxGeometry(2.65, 1.55, 4.8), MATS.craneYellow);
                superDeck.position.set(0, 0.85, -1.1);
                superDeck.castShadow = true;
                const engineVent = new THREE.Mesh(new THREE.BoxGeometry(2.68, 0.85, 1.9), MATS.darkSteel);
                engineVent.position.set(0, 0.98, -1.8);
                slewGroup.add(superDeck, engineVent);

                for (let c = 0; c < 5; c++) {
                    const cwSlab = new THREE.Mesh(
                        new THREE.BoxGeometry(2.95, 0.28, 1.25),
                        c % 2 === 0 ? MATS.darkSteel : MATS.craneYellow
                    );
                    cwSlab.position.set(0, 0.45 + c * 0.30, -3.45);
                    cwSlab.castShadow = true;
                    slewGroup.add(cwSlab);
                }

                // Tilted Crane Operator Superstructure Cab (+X side)
                const opCab = new THREE.Mesh(new THREE.BoxGeometry(0.98, 1.52, 1.95), MATS.craneYellow);
                opCab.position.set(1.56, 1.05, 0.65);
                opCab.rotation.x = -0.18; // Tilted upward to view high hook & boom tip
                opCab.castShadow = true;
                const opGlass = new THREE.Mesh(new THREE.BoxGeometry(1.02, 1.12, 1.52), MATS.glassDark);
                opGlass.position.set(1.58, 1.15, 0.78);
                opGlass.rotation.x = -0.18;
                slewGroup.add(opCab, opGlass);

                // Boom Heel Pivot Trunnion & Dynamic Hydraulic Luffing Cylinder
                const boomPivot = new THREE.Group();
                boomPivot.position.set(0, 1.65, -0.65);
                slewGroup.add(boomPivot);

                const boomLen = 21.5;
                const teleBoom = createTelescopicBoomMesh(boomLen, MATS.craneYellow);
                boomPivot.add(teleBoom);

                // Luffing Hydraulic Cylinder (Pivots dynamically in updateCraneKinematics)
                const luffBase = new THREE.Group();
                luffBase.position.set(0, 0.65, 0.65);
                const luffBarrel = new THREE.Mesh(new THREE.CylinderGeometry(0.21, 0.24, 5.4, 20), MATS.darkSteel);
                luffBarrel.position.y = 2.7;
                luffBarrel.castShadow = true;
                const luffRod = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.14, 5.4, 18), MATS.ferruleSilver);
                luffRod.name = 'luffRod';
                luffRod.position.y = 5.2;
                luffBase.add(luffBarrel, luffRod);
                slewGroup.add(luffBase);

                craneDynamicParts = {
                    type: 'slewing_telescopic',
                    slewGroup,
                    boomPivot,
                    luffBase,
                    luffRod,
                    boomLen,
                    pivotLocal: new THREE.Vector3(0, 1.65, -0.65),
                    luffLocal: new THREE.Vector3(0, 0.65, 0.65),
                    slewOrigin: new THREE.Vector3(slewCenterX, 1.68, slewCenterZ)
                };

            } else if (type === 'crawler') {
                // 3. LIEBHERR LR 1300 HEAVY LATTICE BOOM CRAWLER CRANE ON FLAT PAD
                const baseX = -8.5, baseZ = -7.2;

                [-2.1, 2.1].forEach(dz => {
                    const trackSideFrame = new THREE.Mesh(new THREE.BoxGeometry(6.4, 0.72, 0.95), MATS.darkSteel);
                    trackSideFrame.position.set(baseX, 0.55, baseZ + dz);
                    trackSideFrame.castShadow = true;
                    craneVehicleGroup.add(trackSideFrame);

                    [-3.1, 3.1].forEach(sx => {
                        const tumbler = new THREE.Mesh(new THREE.CylinderGeometry(0.52, 0.52, 1.08, 20), MATS.gunmetal);
                        tumbler.rotation.x = Math.PI / 2;
                        tumbler.position.set(baseX + sx, 0.55, baseZ + dz);
                        craneVehicleGroup.add(tumbler);
                    });

                    const beltTop = new THREE.Mesh(new THREE.BoxGeometry(6.5, 0.14, 1.12), MATS.rubberTire);
                    beltTop.position.set(baseX, 1.02, baseZ + dz);
                    const beltBot = beltTop.clone();
                    beltBot.position.set(baseX, 0.08, baseZ + dz);
                    craneVehicleGroup.add(beltTop, beltBot);
                });

                const carbody = new THREE.Mesh(new THREE.BoxGeometry(4.0, 0.75, 3.4), MATS.craneYellow);
                carbody.position.set(baseX, 1.1, baseZ);
                craneVehicleGroup.add(carbody);

                const slewGroup = new THREE.Group();
                slewGroup.position.set(baseX, 1.5, baseZ);
                craneVehicleGroup.add(slewGroup);

                const superBody = new THREE.Mesh(new THREE.BoxGeometry(3.4, 2.2, 4.8), MATS.craneYellow);
                superBody.position.set(0, 1.1, -0.7);
                superBody.castShadow = true;
                slewGroup.add(superBody);

                const engineBay = new THREE.Mesh(new THREE.BoxGeometry(3.45, 1.35, 2.2), MATS.darkSteel);
                engineBay.position.set(0, 1.3, -1.6);
                slewGroup.add(engineBay);

                const cab = new THREE.Mesh(new THREE.BoxGeometry(1.15, 1.65, 1.95), MATS.glassDark);
                cab.position.set(1.85, 1.15, 1.15);
                cab.rotation.x = -0.14;
                slewGroup.add(cab);

                for (let c = 0; c < 5; c++) {
                    const cwSlab = new THREE.Mesh(new THREE.BoxGeometry(3.8, 0.38, 1.5), c % 2 === 0 ? MATS.darkSteel : MATS.craneYellow);
                    cwSlab.position.set(0, 0.55 + c * 0.42, -3.7);
                    slewGroup.add(cwSlab);
                }

                const mastL = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 6.5, 10), MATS.craneYellow);
                mastL.position.set(-0.9, 4.5, -0.8);
                mastL.rotation.x = -0.35;
                const mastR = mastL.clone();
                mastR.position.x = 0.9;
                slewGroup.add(mastL, mastR);

                const boomPivot = new THREE.Group();
                boomPivot.position.set(0, 1.6, 1.45);
                slewGroup.add(boomPivot);

                const boomLen = 22.0;
                const boomMesh = createLatticeBoomMesh(boomLen, 1.15, MATS.craneYellow);
                boomPivot.add(boomMesh);

                craneDynamicParts = {
                    type: 'slewing',
                    slewGroup,
                    boomPivot,
                    boomLen,
                    basePos: new THREE.Vector3(baseX, 3.1, baseZ + 1.45)
                };

            } else if (type === 'gantry' || type === 'rtg' || type === 'sts_crane_glb') {
                // 4. CLEAN INDUSTRIAL TEST-BAY OVERHEAD GANTRY CRANE (No port rails or container clutter)
                const spanX = 18.0;
                const spanZ = 14.0;
                const girderY = 17.5;

                [-spanX / 2, spanX / 2].forEach(lx => {
                    const sill = new THREE.Mesh(new THREE.BoxGeometry(0.95, 0.55, spanZ + 1.6), MATS.darkSteel);
                    sill.position.set(lx, 0.28, 0);
                    sill.castShadow = true;
                    craneVehicleGroup.add(sill);

                    [-spanZ / 2, spanZ / 2].forEach(lz => {
                        const col = new THREE.Mesh(new THREE.BoxGeometry(0.75, girderY, 0.75), MATS.craneYellow);
                        col.position.set(lx, girderY / 2 + 0.55, lz);
                        col.castShadow = true;
                        const pad = new THREE.Mesh(new THREE.BoxGeometry(1.35, 0.16, 1.35), MATS.gunmetal);
                        pad.position.set(lx, 0.08, lz);
                        craneVehicleGroup.add(col, pad);
                    });

                    const endTruck = new THREE.Mesh(new THREE.BoxGeometry(0.95, 0.95, spanZ + 1.2), MATS.craneYellow);
                    endTruck.position.set(lx, girderY + 0.85, 0);
                    craneVehicleGroup.add(endTruck);
                });

                // Twin Overhead Bridge Box Girders (Move along Z with hook!)
                const bridgeGroup = new THREE.Group();
                bridgeGroup.position.set(0, girderY + 1.55, 0);
                [-0.95, 0.95].forEach(gz => {
                    const girder = new THREE.Mesh(new THREE.BoxGeometry(spanX + 1.2, 1.05, 0.62), MATS.craneYellow);
                    girder.position.set(0, 0, gz);
                    girder.castShadow = true;
                    const rail = new THREE.Mesh(new THREE.BoxGeometry(spanX + 1.0, 0.10, 0.14), MATS.craneRailSteel);
                    rail.position.set(0, 0.58, gz);
                    bridgeGroup.add(girder, rail);
                });
                craneVehicleGroup.add(bridgeGroup);

                // Hoist Winch Trolley on Bridge
                const trolleyGroup = new THREE.Group();
                trolleyGroup.position.set(0, girderY + 1.85, 0);
                const trolleyFrame = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.48, 2.3), MATS.darkSteel);
                trolleyFrame.castShadow = true;
                const winchDrum = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.32, 1.35, 20), MATS.gunmetal);
                winchDrum.rotation.z = Math.PI / 2;
                winchDrum.position.set(0, 0.42, 0);
                trolleyGroup.add(trolleyFrame, winchDrum);
                craneVehicleGroup.add(trolleyGroup);

                craneDynamicParts = {
                    type: 'bridge_gantry',
                    bridgeGroup,
                    trolleyGroup,
                    girderY: girderY + 1.65
                };

            } else if (customCraneMeshes[type]) {
                const customClone = customCraneMeshes[type].clone();
                const bbox = new THREE.Box3().setFromObject(customClone);
                const craneH = Math.max(8.0, bbox.max.y - bbox.min.y);
                let hookAnchorY = craneH * 0.68;

                if (customClone.userData && customClone.userData.anchors) {
                    const trNode = customClone.userData.anchors.find(a => a.id.toUpperCase().includes('TROLLEY') || a.id.toUpperCase().includes('HOOK'));
                    if (trNode && Number.isFinite(trNode.localPos.y)) {
                        hookAnchorY = trNode.localPos.y;
                    }
                }

                customClone.position.set(0, 0, -10.0);
                craneVehicleGroup.add(customClone);
                craneDynamicParts = {
                    type: 'custom_static',
                    topY: Math.max(8.0, hookAnchorY)
                };
            }

            if (pbrFactory) pbrFactory.enforcePBRMaterials(craneVehicleGroup);
            applyCADFeatureEdges(craneVehicleGroup, false);
        }

        // Helper: Builds a 4-section Nested Octagonal Telescopic Hydraulic Boom along local +Y from 0 to boomLen
        function createTelescopicBoomMesh(boomLen, mat) {
            const group = new THREE.Group();
            const sections = 4;
            const secLen = (boomLen * 1.08) / sections;

            for (let s = 0; s < sections; s++) {
                const frac = s / sections;
                const rBot = 0.56 - s * 0.085;
                const rTop = rBot - 0.015;
                const yStart = frac * (boomLen - secLen * 0.35);
                const actualLen = s === sections - 1 ? (boomLen - yStart) : secLen;

                const tube = new THREE.Mesh(new THREE.CylinderGeometry(rTop, rBot, actualLen, 8), s === 0 ? mat : MATS.forgedAlloy);
                tube.rotation.y = Math.PI / 8;
                tube.scale.set(0.88, 1, 1.06); // Authentic Liebherr Oviform oval-octagonal cross section
                tube.position.set(0, yStart + actualLen / 2, 0);
                tube.castShadow = true;
                group.add(tube);

                if (s < sections - 1) {
                    const collar = new THREE.Mesh(new THREE.CylinderGeometry(rTop + 0.035, rTop + 0.035, 0.28, 8), MATS.darkSteel);
                    collar.rotation.y = Math.PI / 8;
                    collar.scale.set(0.88, 1, 1.06);
                    collar.position.set(0, yStart + actualLen - 0.1, 0);
                    group.add(collar);
                }
            }

            // Luffing Cylinder Upper Pin Boss on Base Section (at y = 6.2m)
            const lugBoss = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.65, 0.45), MATS.darkSteel);
            lugBoss.position.set(0, 6.2, 0.42);
            group.add(lugBoss);

            // Boom Nose Multi-Sheave Headblock Assembly at y = boomLen
            const headCheek = new THREE.Mesh(new THREE.BoxGeometry(0.66, 1.05, 0.86), MATS.darkSteel);
            headCheek.position.set(0, boomLen - 0.1, 0.18);
            headCheek.castShadow = true;
            group.add(headCheek);

            [-0.18, 0.18].forEach(sx => {
                const sheave = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.32, 0.12, 24), MATS.craneYellow);
                sheave.rotation.z = Math.PI / 2;
                sheave.position.set(sx, boomLen + 0.02, 0.36);
                group.add(sheave);
            });

            return group;
        }

        // Builds a 3D Compass Rose & Pulling Vector Arrow around the Cargo so users see exact Rotation & Pull Direction
        function buildPullDirectionCompass3D() {
            pullCompassGroup = new THREE.Group();
            pullCompassGroup.position.set(0, 0.02, 0);

            const outerRing = new THREE.Mesh(
                new THREE.RingGeometry(4.2, 4.30, 64),
                new THREE.MeshBasicMaterial({ color: 0x0284c7, side: THREE.DoubleSide, transparent: true, opacity: 0.35 })
            );
            outerRing.rotation.x = -Math.PI / 2;
            outerRing.userData.noCADEdge = true;
            pullCompassGroup.add(outerRing);

            const innerRing = new THREE.Mesh(
                new THREE.RingGeometry(2.8, 2.85, 48),
                new THREE.MeshBasicMaterial({ color: 0x10b981, side: THREE.DoubleSide, transparent: true, opacity: 0.28 })
            );
            innerRing.rotation.x = -Math.PI / 2;
            innerRing.userData.noCADEdge = true;
            pullCompassGroup.add(innerRing);

            pullDirectionArrow = new THREE.ArrowHelper(
                new THREE.Vector3(1, 0, 0),
                new THREE.Vector3(0, 0.12, 0),
                3.5,
                0x10b981,
                0.55,
                0.32
            );
            pullDirectionArrow.visible = false;
            pullCompassGroup.add(pullDirectionArrow);

            scene.add(pullCompassGroup);
        }

        // ============================================================================
        // 9C. ULTRA-CLEAR 3D GROUND ANGLE INDICATOR & SPREADER REFERENCE AXES
        // Yellow Ribbon (Parallel to Spreader) & Red Ribbon (Perpendicular to Spreader),
        // Swept Arc, and Large Clean Degree Readout outside the cargo.
        // ============================================================================
        let groundAngleBadgeTexture = null;
        let groundAngleBadgeCanvas = null;
        let groundAngleParts = {};

        function makeAxisTagTexture(text, color, bgColor = 'rgba(15, 23, 42, 0.94)') {
            const canvas = document.createElement('canvas');
            canvas.width = 400;
            canvas.height = 80;
            const ctx = canvas.getContext('2d');
            ctx.clearRect(0, 0, 400, 80);

            // Card background
            ctx.fillStyle = bgColor;
            ctx.strokeStyle = color;
            ctx.lineWidth = 3;
            const x = 4, y = 4, w = 392, h = 72, r = 16;
            ctx.beginPath();
            if (ctx.roundRect) ctx.roundRect(x, y, w, h, r);
            else ctx.rect(x, y, w, h);
            ctx.fill();
            ctx.stroke();

            // Text
            ctx.fillStyle = color;
            ctx.font = 'bold 28px "JetBrains Mono", monospace, sans-serif';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(text, 200, 40);

            const tex = new THREE.CanvasTexture(canvas);
            tex.minFilter = THREE.LinearFilter;
            tex.magFilter = THREE.LinearFilter;
            return tex;
        }

        function getGroundAngleBadgeTexture(angleDeg) {
            if (!groundAngleBadgeCanvas) {
                groundAngleBadgeCanvas = document.createElement('canvas');
                groundAngleBadgeCanvas.width = 380;
                groundAngleBadgeCanvas.height = 190;
            }
            const ctx = groundAngleBadgeCanvas.getContext('2d');
            ctx.clearRect(0, 0, 380, 190);

            // Sleek Rounded Pill Card Background
            const x = 12, y = 12, w = 356, h = 166, r = 36;
            ctx.beginPath();
            if (ctx.roundRect) ctx.roundRect(x, y, w, h, r);
            else ctx.rect(x, y, w, h);
            ctx.closePath();

            // Dark glassy gradient
            const grad = ctx.createLinearGradient(0, y, 0, y + h);
            grad.addColorStop(0, 'rgba(10, 18, 30, 0.96)');
            grad.addColorStop(1, 'rgba(4, 8, 15, 0.99)');
            ctx.fillStyle = grad;
            ctx.fill();

            // Glowing border (Amber if skewed, Cyan if aligned)
            const absA = Math.abs(angleDeg);
            ctx.lineWidth = 6;
            ctx.strokeStyle = absA > 0.1 ? '#f59e0b' : '#38bdf8';
            ctx.stroke();

            // HUGE, CLEAR, BOLD ANGLE NUMBER ONLY - NO EXTRA TEXT/CLUTTER!
            ctx.fillStyle = absA > 0.1 ? '#fbbf24' : '#38bdf8';
            ctx.font = '900 110px "JetBrains Mono", monospace, sans-serif';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            const sign = (angleDeg > 0.05) ? '+' : (angleDeg < -0.05 ? '' : '');
            const angleStr = `${sign}${angleDeg.toFixed(1)}°`;
            ctx.fillText(angleStr, 190, 95);

            if (!groundAngleBadgeTexture) {
                groundAngleBadgeTexture = new THREE.CanvasTexture(groundAngleBadgeCanvas);
                groundAngleBadgeTexture.minFilter = THREE.LinearFilter;
                groundAngleBadgeTexture.magFilter = THREE.LinearFilter;
                groundAngleBadgeTexture.generateMipmaps = false;
            } else {
                groundAngleBadgeTexture.needsUpdate = true;
            }
            return groundAngleBadgeTexture;
        }

        function buildCargoGroundAngleIndicator3D() {
            if (cargoGroundAngleGroup) {
                scene.remove(cargoGroundAngleGroup);
                cargoGroundAngleGroup.traverse(o => {
                    if (o.geometry && o.geometry.dispose) o.geometry.dispose();
                    if (o.material && o.material.dispose) o.material.dispose();
                });
            }

            cargoGroundAngleGroup = new THREE.Group();
            cargoGroundAngleGroup.name = 'Cargo_Ground_Angle_Indicator';
            cargoGroundAngleGroup.position.set(0, 0.012, 0);

            const R = Math.max(3.8, Math.hypot((state.L || 6) * 0.5, (state.W || 2.4) * 0.5) + 0.95);

            // 1. Concentric Protractor Graduation Rings
            const outerRing = new THREE.Mesh(
                new THREE.RingGeometry(R - 0.04, R + 0.04, 96),
                new THREE.MeshBasicMaterial({ color: 0x0284c7, side: THREE.DoubleSide, transparent: true, opacity: 0.55 })
            );
            outerRing.rotation.x = -Math.PI / 2;
            outerRing.userData.noCADEdge = true;
            cargoGroundAngleGroup.add(outerRing);

            const innerRing = new THREE.Mesh(
                new THREE.RingGeometry(R * 0.45 - 0.03, R * 0.45 + 0.03, 64),
                new THREE.MeshBasicMaterial({ color: 0x38bdf8, side: THREE.DoubleSide, transparent: true, opacity: 0.35 })
            );
            innerRing.rotation.x = -Math.PI / 2;
            innerRing.userData.noCADEdge = true;
            cargoGroundAngleGroup.add(innerRing);

            // 2. 360° Protractor Graduation Ticks
            const tickPositions = [];
            for (let deg = 0; deg < 360; deg += 15) {
                const rad = deg * Math.PI / 180;
                const cosA = Math.cos(rad);
                const sinA = -Math.sin(rad);

                const isCardinal = (deg % 90 === 0);
                const isMajor = (deg % 30 === 0 || deg % 45 === 0);
                const tickLen = isCardinal ? 0.60 : (isMajor ? 0.40 : 0.22);
                const rIn = R - tickLen;
                const rOut = R;

                tickPositions.push(rIn * cosA, 0.002, rIn * sinA);
                tickPositions.push(rOut * cosA, 0.002, rOut * sinA);
            }
            const tickGeo = new THREE.BufferGeometry();
            tickGeo.setAttribute('position', new THREE.Float32BufferAttribute(tickPositions, 3));
            const tickMat = new THREE.LineBasicMaterial({ color: 0x38bdf8, transparent: true, opacity: 0.65 });
            const ticksLine = new THREE.LineSegments(tickGeo, tickMat);
            ticksLine.userData.noCADEdge = true;
            cargoGroundAngleGroup.add(ticksLine);

            // ====================================================================
            // 3. VẠCH VÀNG: SONG SONG VỚI NGÁNG / SPREADER BEAM (PARALLEL AXIS)
            // ====================================================================
            const yellowGroup = new THREE.Group();
            yellowGroup.name = 'Yellow_Spreader_Parallel_Group';

            const yellowRibbon = new THREE.Mesh(
                new THREE.PlaneGeometry(2 * (R + 0.8), 0.16),
                new THREE.MeshBasicMaterial({ color: 0xfacc15, side: THREE.DoubleSide, depthWrite: false })
            );
            yellowRibbon.rotation.x = -Math.PI / 2;
            yellowRibbon.position.y = 0.003;
            yellowRibbon.userData.noCADEdge = true;
            yellowGroup.add(yellowRibbon);

            const yellowArrowFwd = new THREE.Mesh(
                new THREE.ConeGeometry(0.18, 0.45, 14),
                new THREE.MeshBasicMaterial({ color: 0xfacc15 })
            );
            yellowArrowFwd.rotation.z = -Math.PI / 2;
            yellowArrowFwd.position.set(R + 0.85, 0.003, 0);
            yellowArrowFwd.userData.noCADEdge = true;
            yellowGroup.add(yellowArrowFwd);

            const yellowArrowBack = new THREE.Mesh(
                new THREE.ConeGeometry(0.18, 0.45, 14),
                new THREE.MeshBasicMaterial({ color: 0xfacc15 })
            );
            yellowArrowBack.rotation.z = Math.PI / 2;
            yellowArrowBack.position.set(-(R + 0.85), 0.003, 0);
            yellowArrowBack.userData.noCADEdge = true;
            yellowGroup.add(yellowArrowBack);

            // Yellow Reference Tag
            const yellowTagTex = makeAxisTagTexture('// SONG SONG NGÁNG (0°)', '#facc15');
            const yellowTagMesh = new THREE.Mesh(
                new THREE.PlaneGeometry(1.9, 0.38),
                new THREE.MeshBasicMaterial({ map: yellowTagTex, side: THREE.DoubleSide, transparent: true, depthWrite: false })
            );
            yellowTagMesh.rotation.x = -Math.PI / 2;
            yellowTagMesh.position.set(R * 0.58, 0.005, 0.32);
            yellowTagMesh.userData.noCADEdge = true;
            yellowGroup.add(yellowTagMesh);

            cargoGroundAngleGroup.add(yellowGroup);

            // ====================================================================
            // 4. VẠCH ĐỎ: VUÔNG GÓC VỚI NGÁNG / SPREADER BEAM (PERPENDICULAR AXIS)
            // ====================================================================
            const redGroup = new THREE.Group();
            redGroup.name = 'Red_Spreader_Perpendicular_Group';

            const redRibbon = new THREE.Mesh(
                new THREE.PlaneGeometry(2 * (R + 0.8), 0.16),
                new THREE.MeshBasicMaterial({ color: 0xef4444, side: THREE.DoubleSide, depthWrite: false })
            );
            redRibbon.rotation.x = -Math.PI / 2;
            redRibbon.position.y = 0.003;
            redRibbon.userData.noCADEdge = true;
            redGroup.add(redRibbon);

            const redArrowPos = new THREE.Mesh(
                new THREE.ConeGeometry(0.18, 0.45, 14),
                new THREE.MeshBasicMaterial({ color: 0xef4444 })
            );
            redArrowPos.rotation.z = -Math.PI / 2;
            redArrowPos.position.set(R + 0.85, 0.003, 0);
            redArrowPos.userData.noCADEdge = true;
            redGroup.add(redArrowPos);

            const redArrowNeg = new THREE.Mesh(
                new THREE.ConeGeometry(0.18, 0.45, 14),
                new THREE.MeshBasicMaterial({ color: 0xef4444 })
            );
            redArrowNeg.rotation.z = Math.PI / 2;
            redArrowNeg.position.set(-(R + 0.85), 0.003, 0);
            redArrowNeg.userData.noCADEdge = true;
            redGroup.add(redArrowNeg);

            // Red Reference Tag
            const redTagTex = makeAxisTagTexture('⊥ VUÔNG GÓC NGÁNG (90°)', '#ef4444');
            const redTagMesh = new THREE.Mesh(
                new THREE.PlaneGeometry(1.9, 0.38),
                new THREE.MeshBasicMaterial({ map: redTagTex, side: THREE.DoubleSide, transparent: true, depthWrite: false })
            );
            redTagMesh.rotation.x = -Math.PI / 2;
            redTagMesh.position.set(R * 0.58, 0.005, 0.32);
            redTagMesh.userData.noCADEdge = true;
            redGroup.add(redTagMesh);

            cargoGroundAngleGroup.add(redGroup);

            // ====================================================================
            // 5. Dynamic Cargo Heading Axis (Local +X of Cargo)
            // ====================================================================
            const headingGroup = new THREE.Group();
            headingGroup.name = 'Cargo_Heading_Group';

            const headingRibbon = new THREE.Mesh(
                new THREE.PlaneGeometry(R + 0.65, 0.16),
                new THREE.MeshBasicMaterial({ color: 0x38bdf8, side: THREE.DoubleSide, depthWrite: false })
            );
            headingRibbon.rotation.x = -Math.PI / 2;
            headingRibbon.position.set((R + 0.65) * 0.5, 0.004, 0);
            headingRibbon.userData.noCADEdge = true;
            headingGroup.add(headingRibbon);

            const headingArrow = new THREE.Mesh(
                new THREE.ConeGeometry(0.20, 0.50, 14),
                new THREE.MeshBasicMaterial({ color: 0x38bdf8 })
            );
            headingArrow.rotation.z = -Math.PI / 2;
            headingArrow.position.set(R + 0.70, 0.004, 0);
            headingArrow.userData.noCADEdge = true;
            headingGroup.add(headingArrow);

            // Interactive 3D Rotation Handle Ring for direct mouse drag
            const handleMesh = new THREE.Mesh(
                new THREE.TorusGeometry(0.28, 0.06, 12, 24),
                new THREE.MeshStandardMaterial({ color: 0xf59e0b, emissive: 0xb45309, emissiveIntensity: 0.5, roughness: 0.3 })
            );
            handleMesh.rotation.x = Math.PI / 2;
            handleMesh.position.set(R + 0.70, 0.018, 0);
            handleMesh.userData.dragType = 'cargoYaw';
            handleMesh.userData.noCADEdge = true;
            cargoYawGizmoHandle = handleMesh;
            headingGroup.add(handleMesh);

            cargoGroundAngleGroup.add(headingGroup);

            // 6. Dynamic Swept Angle Arc & Shaded Sector
            const sectorMesh = new THREE.Mesh(
                new THREE.BufferGeometry(),
                new THREE.MeshBasicMaterial({ color: 0xf59e0b, side: THREE.DoubleSide, transparent: true, opacity: 0.28, depthWrite: false })
            );
            sectorMesh.userData.noCADEdge = true;
            cargoGroundAngleGroup.add(sectorMesh);

            const arcLine = new THREE.Line(
                new THREE.BufferGeometry(),
                new THREE.LineBasicMaterial({ color: 0xf59e0b, transparent: true, opacity: 0.85 })
            );
            arcLine.userData.noCADEdge = true;
            cargoGroundAngleGroup.add(arcLine);

            // 7. Rotated Cargo Ground Footprint Rectangle Outline
            const footprintGeo = new THREE.BufferGeometry();
            const footprintMat = new THREE.LineBasicMaterial({ color: 0x38bdf8, transparent: true, opacity: 0.55 });
            const footprintLine = new THREE.Line(footprintGeo, footprintMat);
            footprintLine.userData.noCADEdge = true;
            cargoGroundAngleGroup.add(footprintLine);

            // 8. Large Dynamic 3D Ground Angle Readout Badge (Numbers Only, Placed Outside Footprint)
            const badgeTex = getGroundAngleBadgeTexture(state.cargoYawDeg || 0);
            const badgeMesh = new THREE.Mesh(
                new THREE.PlaneGeometry(2.0, 1.0),
                new THREE.MeshBasicMaterial({ map: badgeTex, side: THREE.DoubleSide, transparent: true, opacity: 0.98, depthWrite: false })
            );
            badgeMesh.rotation.x = -Math.PI / 2;
            badgeMesh.position.set(R + 1.25, 0.007, 0);
            badgeMesh.userData.noCADEdge = true;
            cargoGroundAngleGroup.add(badgeMesh);

            // Cache parts for rapid dynamic updates
            groundAngleParts = {
                R,
                outerRing,
                innerRing,
                ticksLine,
                yellowGroup,
                redGroup,
                headingGroup,
                sectorMesh,
                arcLine,
                footprintLine,
                badgeMesh,
                handleMesh
            };

            scene.add(cargoGroundAngleGroup);
            updateCargoGroundAngleIndicator3D();
        }

        function updateCargoGroundAngleIndicator3D() {
            if (!cargoGroundAngleGroup || !groundAngleParts.outerRing) return;

            // Visibility driven by displayOptions
            const showGround = (state.displayOptions && state.displayOptions.showGroundAngle !== undefined)
                ? state.displayOptions.showGroundAngle
                : (state.showGroundAngleIndicator !== false);

            cargoGroundAngleGroup.visible = Boolean(showGround);
            if (!showGround) return;

            const yawDeg = state.cargoYawDeg || 0;
            const yawRad = THREE.MathUtils.degToRad(yawDeg);
            const { L, W } = state;
            const currentR = Math.max(3.8, Math.hypot((L || 6) * 0.5, (W || 2.4) * 0.5) + 0.95);

            if (Math.abs(currentR - groundAngleParts.R) > 0.35) {
                buildCargoGroundAngleIndicator3D();
                return;
            }

            const R = groundAngleParts.R;

            // Spreader reference orientation (Yellow is parallel to spreader, Red is perpendicular)
            const spreaderDeg = state.spreaderAlignWithCargo ? yawDeg : (state.spreaderYawDeg || 0);
            const spreaderRad = THREE.MathUtils.degToRad(spreaderDeg);

            // 1. Rotate Yellow Group (Parallel to Spreader)
            if (groundAngleParts.yellowGroup) {
                groundAngleParts.yellowGroup.rotation.y = spreaderRad;
            }

            // 2. Rotate Red Group (Perpendicular to Spreader)
            if (groundAngleParts.redGroup) {
                groundAngleParts.redGroup.rotation.y = spreaderRad + Math.PI / 2;
            }

            // 3. Rotate Heading Group (Cargo Orientation)
            if (groundAngleParts.headingGroup) {
                groundAngleParts.headingGroup.rotation.y = yawRad;
            }

            // 4. Update Swept Angle Arc & Shaded Sector (Between Spreader and Cargo Heading)
            const deltaRad = yawRad - spreaderRad;
            const deltaDeg = yawDeg - spreaderDeg;
            const arcRadius = R * 0.72;
            const segCount = Math.max(4, Math.min(48, Math.round(Math.abs(deltaDeg) / 3)));
            const sectorVertices = [];
            const arcPoints = [];

            if (Math.abs(deltaDeg) > 0.2) {
                for (let i = 0; i <= segCount; i++) {
                    const frac = i / segCount;
                    const a = spreaderRad + frac * deltaRad;
                    const px = arcRadius * Math.cos(a);
                    const pz = -arcRadius * Math.sin(a);
                    arcPoints.push(px, 0.005, pz);

                    if (i < segCount) {
                        const aNext = spreaderRad + ((i + 1) / segCount) * deltaRad;
                        const nx = arcRadius * Math.cos(aNext);
                        const nz = -arcRadius * Math.sin(aNext);
                        sectorVertices.push(0, 0.004, 0);
                        sectorVertices.push(px, 0.004, pz);
                        sectorVertices.push(nx, 0.004, nz);
                    }
                }
                groundAngleParts.sectorMesh.visible = true;
                groundAngleParts.sectorMesh.geometry.dispose();
                groundAngleParts.sectorMesh.geometry = new THREE.BufferGeometry();
                groundAngleParts.sectorMesh.geometry.setAttribute('position', new THREE.Float32BufferAttribute(sectorVertices, 3));

                groundAngleParts.arcLine.visible = true;
                groundAngleParts.arcLine.geometry.dispose();
                groundAngleParts.arcLine.geometry = new THREE.BufferGeometry();
                groundAngleParts.arcLine.geometry.setAttribute('position', new THREE.Float32BufferAttribute(arcPoints, 3));
            } else {
                groundAngleParts.sectorMesh.visible = false;
                groundAngleParts.arcLine.visible = false;
            }

            // 5. Update Rotated Cargo Footprint Outline
            const halfL = (L || 6) * 0.5;
            const halfW = (W || 2.4) * 0.5;
            const cornersLocal = [
                new THREE.Vector3(-halfL, 0.003, -halfW),
                new THREE.Vector3(halfL, 0.003, -halfW),
                new THREE.Vector3(halfL, 0.003, halfW),
                new THREE.Vector3(-halfL, 0.003, halfW),
                new THREE.Vector3(-halfL, 0.003, -halfW)
            ];
            const footprintPos = [];
            cornersLocal.forEach(p => {
                p.applyAxisAngle(new THREE.Vector3(0, 1, 0), yawRad);
                footprintPos.push(p.x, p.y, p.z);
            });
            groundAngleParts.footprintLine.geometry.setAttribute('position', new THREE.Float32BufferAttribute(footprintPos, 3));
            groundAngleParts.footprintLine.geometry.attributes.position.needsUpdate = true;

            // 6. Update Large Angle Readout Badge (Numbers Only, Placed Outside Footprint)
            getGroundAngleBadgeTexture(yawDeg);

            // Position badge cleanly outside cargo perimeter at R + 1.25
            const badgeAngle = (Math.abs(deltaDeg) > 1.0) ? (spreaderRad + deltaRad * 0.5) : yawRad;
            const badgeDist = R + 1.25;
            const bx = badgeDist * Math.cos(badgeAngle);
            const bz = -badgeDist * Math.sin(badgeAngle);
            if (groundAngleParts.badgeMesh) {
                groundAngleParts.badgeMesh.position.set(bx, 0.007, bz);
                // ALWAYS VISIBLE - do not hide when cargo is lifted in the air!
                groundAngleParts.badgeMesh.visible = true;
            }

            // Follow cargo ground position
            if (phy.cargoPos) {
                cargoGroundAngleGroup.position.x = phy.cargoPos.x;
                cargoGroundAngleGroup.position.z = phy.cargoPos.z;
            }
        }

        // Helper to generate a realistic 3D Lattice Crane Boom / Truss along local +Y axis from 0 to boomLen
        function createLatticeBoomMesh(boomLen, width, mat) {
            const group = new THREE.Group();
            const halfW = width / 2;
            const chordGeo = new THREE.CylinderGeometry(0.055, 0.055, boomLen, 8);

            [[-halfW, -halfW], [halfW, -halfW], [-halfW, halfW], [halfW, halfW]].forEach(([cx, cz]) => {
                const chord = new THREE.Mesh(chordGeo, mat);
                chord.position.set(cx, boomLen / 2, cz);
                chord.castShadow = true;
                group.add(chord);
            });

            const numBays = Math.max(6, Math.round(boomLen / 1.4));
            const bayH = boomLen / numBays;
            const strutLen = Math.hypot(width, bayH);
            const strutGeo = new THREE.CylinderGeometry(0.028, 0.028, strutLen, 6);

            for (let i = 0; i < numBays; i++) {
                const yMid = (i + 0.5) * bayH;
                [-halfW, halfW].forEach(fz => {
                    const s = new THREE.Mesh(strutGeo, mat);
                    s.position.set(0, yMid, fz);
                    s.rotation.z = Math.atan2(width, bayH) * (i % 2 === 0 ? 1 : -1);
                    group.add(s);
                });
                [-halfW, halfW].forEach(fx => {
                    const sSide = new THREE.Mesh(strutGeo, mat);
                    sSide.position.set(fx, yMid, 0);
                    sSide.rotation.x = Math.atan2(width, bayH) * (i % 2 === 0 ? -1 : 1);
                    group.add(sSide);
                });
            }

            const tipHead = new THREE.Mesh(new THREE.CylinderGeometry(0.38, 0.38, width + 0.16, 18), MATS.yellowHazard);
            tipHead.rotation.z = Math.PI / 2;
            tipHead.position.set(0, boomLen, 0);
            group.add(tipHead);

            return group;
        }

        // Updates the 3D Crane Boom / Trolley & 4-Part Hoist Ropes to dynamically track `phy.hookPos`
        function updateCraneKinematics() {
            const hp = phy.hookPos;
            const ropeTopOffset = 0.54; // Top of hook block sheaves relative to hookPos

            const updateHoistFalls = (topY) => {
                const ropeLen = Math.max(0.4, topY - (hp.y + ropeTopOffset));
                const fallOffsets = [
                    [-0.275, 0],
                    [-0.025, 0],
                    [ 0.025, 0],
                    [ 0.275, 0]
                ];
                let hasFourFalls = false;
                for (let idx = 0; idx < 4; idx++) {
                    const fall = hookAssemblyGroup.getObjectByName('hoistFall' + idx);
                    if (fall) {
                        hasFourFalls = true;
                        fall.scale.set(1, ropeLen, 1);
                        fall.position.set(fallOffsets[idx][0], ropeTopOffset + ropeLen / 2, fallOffsets[idx][1]);
                        fall.rotation.set(0, 0, 0);
                    }
                }
                const ropeL = hookAssemblyGroup.getObjectByName('hoistRopeL');
                const ropeR = hookAssemblyGroup.getObjectByName('hoistRopeR');
                if (ropeL && ropeR) {
                    ropeL.visible = !hasFourFalls;
                    ropeR.visible = !hasFourFalls;
                    if (!hasFourFalls) {
                        ropeL.scale.set(1, ropeLen, 1);
                        ropeL.position.set(-0.15, ropeTopOffset + ropeLen / 2, 0);
                        ropeR.scale.set(1, ropeLen, 1);
                        ropeR.position.set(0.15, ropeTopOffset + ropeLen / 2, 0);
                    }
                }
            };

            if (craneDynamicParts.type === 'gantry') {
                craneDynamicParts.trolleyGroup.position.x = hp.x;
                craneDynamicParts.trolleyGroup.position.z = hp.z;
                updateHoistFalls(craneDynamicParts.girderY);

            } else if (craneDynamicParts.type === 'bridge_gantry') {
                craneDynamicParts.bridgeGroup.position.z = hp.z;
                craneDynamicParts.trolleyGroup.position.x = hp.x;
                craneDynamicParts.trolleyGroup.position.z = hp.z;
                updateHoistFalls(craneDynamicParts.girderY);

            } else if (craneDynamicParts.type === 'slewing_telescopic') {
                const slewOrg = craneDynamicParts.slewOrigin;
                const dx = hp.x - slewOrg.x;
                const dz = hp.z - slewOrg.z;
                const slewAngle = Math.atan2(dx, dz);
                craneDynamicParts.slewGroup.rotation.y = slewAngle;

                const horizFromSlew = Math.hypot(dx, dz);
                const pivotZ = craneDynamicParts.pivotLocal.z; // -0.65
                const horizFromPivot = Math.max(2.5, horizFromSlew - pivotZ);
                const boomLen = craneDynamicParts.boomLen;
                const clampedR = Math.min(boomLen * 0.90, horizFromPivot);
                const tiltFromVert = Math.asin(clampedR / boomLen);
                craneDynamicParts.boomPivot.rotation.x = tiltFromVert;

                // Orient hydraulic luffing cylinder from luffLocal toward boom attachment pin (6.2m along boom)
                if (craneDynamicParts.luffBase && craneDynamicParts.luffRod) {
                    const attachDist = 6.2;
                    const pinLocalY = craneDynamicParts.pivotLocal.y + attachDist * Math.cos(tiltFromVert);
                    const pinLocalZ = craneDynamicParts.pivotLocal.z + attachDist * Math.sin(tiltFromVert);
                    const vy = pinLocalY - craneDynamicParts.luffLocal.y;
                    const vz = pinLocalZ - craneDynamicParts.luffLocal.z;
                    const cylLen = Math.hypot(vy, vz);
                    craneDynamicParts.luffBase.rotation.x = Math.atan2(vz, vy);
                    const rodExt = Math.max(0.5, cylLen - 2.7);
                    craneDynamicParts.luffRod.position.y = 2.7 + rodExt / 2;
                    craneDynamicParts.luffRod.scale.set(1, rodExt / 5.4, 1);
                }

                const tipY = slewOrg.y + craneDynamicParts.pivotLocal.y + boomLen * Math.cos(tiltFromVert);
                updateHoistFalls(tipY);

            } else if (craneDynamicParts.type === 'slewing') {
                const base = craneDynamicParts.basePos;
                const dx = hp.x - base.x;
                const dz = hp.z - base.z;
                const horizDist = Math.hypot(dx, dz);
                craneDynamicParts.slewGroup.rotation.y = Math.atan2(dx, dz);

                const boomLen = craneDynamicParts.boomLen;
                const clampedR = Math.min(boomLen * 0.92, Math.max(2.5, horizDist));
                const tiltFromVert = Math.asin(clampedR / boomLen);
                craneDynamicParts.boomPivot.rotation.x = tiltFromVert;

                const tipY = base.y + boomLen * Math.cos(tiltFromVert);
                updateHoistFalls(tipY);

            } else if (craneDynamicParts.type === 'custom_static') {
                updateHoistFalls(craneDynamicParts.topY);
            }
        }
