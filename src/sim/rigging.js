/**
 * rigging — part of the lifting simulator.
 * Builds authentic 3D rigging hardware (multi-sheave hook block, forged J-hook,
 * interlocked oval master link, ASME BTH-1 bored pad-eyes, Crosby G-2130/G-2150
 * shackles, eye-spliced thimbles/ferrules, and inline rigging turnbuckles).
 */

        // Helper: Sweeps a circular cross-section with variable radius along a 3D curve
        function createVariableTubeGeometry(curve, tubularSegments, radialSegments, radiusFn) {
            const frames = curve.computeFrenetFrames(tubularSegments, false);
            const positions = [];
            const normals = [];
            const uvs = [];
            const indices = [];
            const vertex = new THREE.Vector3();
            const normal = new THREE.Vector3();

            for (let i = 0; i <= tubularSegments; i++) {
                const u = i / tubularSegments;
                const P = curve.getPointAt(u);
                const N = frames.normals[i];
                const B = frames.binormals[i];
                const r = radiusFn(u);

                for (let j = 0; j <= radialSegments; j++) {
                    const v = (j / radialSegments) * Math.PI * 2;
                    const sin = Math.sin(v);
                    const cos = -Math.cos(v);

                    normal.x = cos * N.x + sin * B.x;
                    normal.y = cos * N.y + sin * B.y;
                    normal.z = cos * N.z + sin * B.z;
                    normal.normalize();

                    vertex.x = P.x + r * normal.x;
                    vertex.y = P.y + r * normal.y;
                    vertex.z = P.z + r * normal.z;

                    positions.push(vertex.x, vertex.y, vertex.z);
                    normals.push(normal.x, normal.y, normal.z);
                    uvs.push(u, j / radialSegments);
                }
            }

            const stride = radialSegments + 1;
            for (let i = 0; i < tubularSegments; i++) {
                for (let j = 0; j < radialSegments; j++) {
                    const a = i * stride + j;
                    const b = (i + 1) * stride + j;
                    const c = (i + 1) * stride + (j + 1);
                    const d = i * stride + (j + 1);
                    indices.push(a, b, d);
                    indices.push(b, c, d);
                }
            }

            const geo = new THREE.BufferGeometry();
            geo.setIndex(indices);
            geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
            geo.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
            geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
            return geo;
        }

        // Helper: Forged Alloy Crane J-Hook with inner saddle bowl at y = -0.340
        function createForgedCraneHookGroup() {
            const hookGroup = new THREE.Group();
            const alloyMat = MATS.forgedAlloy || MATS.galvSteel;

            // Cylindrical Machined Swivel Shank & Collar
            const thrustCollar = new THREE.Mesh(new THREE.CylinderGeometry(0.068, 0.068, 0.042, 24), alloyMat);
            thrustCollar.position.y = 0.065;
            const shank = new THREE.Mesh(new THREE.CylinderGeometry(0.042, 0.046, 0.11, 24), alloyMat);
            shank.position.y = 0.0;
            hookGroup.add(thrustCollar, shank);

            // Variable-section Forged J-Hook Spine:
            // At saddle bottom (0, -0.386, 0), radius = 0.046 -> top inner saddle is at exact y = -0.340
            const spinePts = [
                new THREE.Vector3( 0.000, -0.035, 0),
                new THREE.Vector3( 0.028, -0.105, 0),
                new THREE.Vector3( 0.112, -0.225, 0),
                new THREE.Vector3( 0.102, -0.340, 0),
                new THREE.Vector3( 0.000, -0.386, 0),
                new THREE.Vector3(-0.098, -0.340, 0),
                new THREE.Vector3(-0.146, -0.245, 0),
                new THREE.Vector3(-0.130, -0.168, 0)
            ];
            const spineCurve = new THREE.CatmullRomCurve3(spinePts, false, 'centripetal', 0.45);
            const hookGeo = createVariableTubeGeometry(spineCurve, 44, 18, (u) => {
                if (u < 0.15) return THREE.MathUtils.lerp(0.042, 0.044, u / 0.15);
                if (u < 0.56) return THREE.MathUtils.lerp(0.044, 0.047, Math.sin(((u - 0.15) / 0.41) * Math.PI));
                return THREE.MathUtils.lerp(0.045, 0.013, Math.pow((u - 0.56) / 0.44, 0.85));
            });
            const hookMesh = new THREE.Mesh(hookGeo, alloyMat);
            hookMesh.castShadow = true;

            // Rounded forged point cap at hook tip
            const tipCap = new THREE.Mesh(new THREE.SphereGeometry(0.013, 12, 10), alloyMat);
            tipCap.position.copy(spinePts[spinePts.length - 1]);

            // Neck hinge boss + spring-loaded safety latch bridging throat
            const latchBoss = new THREE.Mesh(new THREE.BoxGeometry(0.036, 0.036, 0.042), alloyMat);
            latchBoss.position.set(-0.018, -0.098, 0);
            const latchPin = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.052, 12), MATS.darkSteel);
            latchPin.rotation.x = Math.PI / 2;
            latchPin.position.set(-0.024, -0.098, 0);

            const latchStart = new THREE.Vector3(-0.024, -0.098, 0);
            const latchEnd = new THREE.Vector3(-0.122, -0.174, 0);
            const latchVec = latchEnd.clone().sub(latchStart);
            const latchLen = latchVec.length();
            const latchBar = new THREE.Mesh(new THREE.BoxGeometry(0.012, latchLen, 0.028), alloyMat);
            latchBar.position.copy(latchStart).lerp(latchEnd, 0.5);
            latchBar.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), latchVec.normalize());

            hookGroup.add(hookMesh, tipCap, latchBoss, latchPin, latchBar);
            return hookGroup;
        }

        // Helper: Tapered Trapezoidal Hazard-Chevron Cheek Plate with normalized UVs
        function createHookCheekPlateGeometry(depth) {
            const shape = new THREE.Shape();
            const rTop = 0.092;
            const rBot = 0.072;
            const cxL = -0.150, cyTop = 0.540;
            const cxR =  0.150;
            const cxB =  0.000, cyBot = 0.215;

            // Smooth rounded inverted triangle / trapezoid around the 3 bolt centers
            shape.absarc(cxL, cyTop, rTop, Math.PI * 0.5, Math.PI * 1.18, false);
            shape.absarc(cxB, cyBot, rBot, Math.PI * 1.18, Math.PI * 1.82, false);
            shape.absarc(cxR, cyTop, rTop, -Math.PI * 0.18, Math.PI * 0.5, false);
            shape.closePath();

            const geo = new THREE.ExtrudeGeometry(shape, {
                depth,
                bevelEnabled: true,
                bevelThickness: 0.005,
                bevelSize: 0.005,
                bevelSegments: 2,
                curveSegments: 20
            });
            geo.translate(0, 0, -depth / 2);

            // Normalize planar XY UVs to [0..1] so diagonal hazard stripes map cleanly
            geo.computeBoundingBox();
            const bb = geo.boundingBox;
            const spanX = Math.max(0.01, bb.max.x - bb.min.x);
            const spanY = Math.max(0.01, bb.max.y - bb.min.y);
            const uv = geo.attributes.uv;
            const pos = geo.attributes.position;
            for (let i = 0; i < uv.count; i++) {
                const u = (pos.getX(i) - bb.min.x) / spanX;
                const v = (pos.getY(i) - bb.min.y) / spanY;
                uv.setXY(i, u * 0.85, v * 0.85);
            }
            uv.needsUpdate = true;
            return geo;
        }

        // --- 5. BUILD HOOK BLOCK, PAD-EYES, COG GIZMO & SLING POOL ---
        function buildHookAndRiggingPool() {
            hookAssemblyGroup = new THREE.Group();
            const alloyMat = MATS.forgedAlloy || MATS.galvSteel;

            // 1. 4-Part Dynamic Hoist Wire Ropes (tangent to the 2 grooved sheaves at x = ±0.15 ± 0.125)
            const hoistFallGeo = new THREE.CylinderGeometry(0.0165, 0.0165, 1.0, 12);
            for (let i = 0; i < 4; i++) {
                const fall = new THREE.Mesh(hoistFallGeo, MATS.wireRope);
                fall.name = 'hoistFall' + i;
                fall.castShadow = true;
                hookAssemblyGroup.add(fall);
            }
            // Legacy fallback references (kept hidden when 4-part falls are active)
            const ropeL = new THREE.Mesh(hoistFallGeo, MATS.wireRope);
            ropeL.name = 'hoistRopeL';
            ropeL.visible = false;
            const ropeR = new THREE.Mesh(hoistFallGeo, MATS.wireRope);
            ropeR.name = 'hoistRopeR';
            ropeR.visible = false;
            hookAssemblyGroup.add(ropeL, ropeR);

            // 2. Twin Grooved Steel Pulley Sheaves (x = ±0.15, y = 0.54)
            [-0.15, 0.15].forEach(sx => {
                const sheaveGroup = new THREE.Group();
                sheaveGroup.position.set(sx, 0.54, 0);

                // Machined outer alloy rims
                [-0.024, 0.024].forEach(fz => {
                    const rim = new THREE.Mesh(new THREE.CylinderGeometry(0.142, 0.142, 0.010, 28), alloyMat);
                    rim.rotation.x = Math.PI / 2;
                    rim.position.z = fz;
                    rim.castShadow = true;
                    sheaveGroup.add(rim);
                });
                // Recessed groove hub
                const grooveHub = new THREE.Mesh(new THREE.CylinderGeometry(0.116, 0.116, 0.044, 24), MATS.darkSteel);
                grooveHub.rotation.x = Math.PI / 2;
                sheaveGroup.add(grooveHub);

                // Lower 180-deg wire rope wrap seated inside sheave groove
                const wrapArc = new THREE.Mesh(new THREE.TorusGeometry(0.125, 0.0165, 10, 22, Math.PI), MATS.wireRope);
                wrapArc.rotation.z = Math.PI;
                sheaveGroup.add(wrapArc);

                hookAssemblyGroup.add(sheaveGroup);
            });

            // 3. Tapered Trapezoidal Hazard-Chevron Side Cheek Plates + Internal Spacer Core
            const cheekGeo = createHookCheekPlateGeometry(0.022);
            [-0.056, 0.056].forEach(cz => {
                const plate = new THREE.Mesh(cheekGeo, MATS.hookChevrons || MATS.yellowHazard);
                plate.position.z = cz;
                plate.castShadow = true;
                plate.receiveShadow = true;
                hookAssemblyGroup.add(plate);
            });

            // Swivel crosshead trunnion block between the cheek plates
            const trunnion = new THREE.Mesh(new THREE.CylinderGeometry(0.064, 0.064, 0.092, 20), MATS.darkSteel);
            trunnion.rotation.x = Math.PI / 2;
            trunnion.position.set(0, 0.125, 0);
            hookAssemblyGroup.add(trunnion);

            // 4. Three Heavy Hex Through-Bolts, Washers & Nuts (matching reference block)
            [
                [-0.15, 0.54],
                [ 0.15, 0.54],
                [ 0.00, 0.225]
            ].forEach(([bx, by]) => {
                const stud = new THREE.Mesh(new THREE.CylinderGeometry(0.021, 0.021, 0.205, 16), alloyMat);
                stud.rotation.x = Math.PI / 2;
                stud.position.set(bx, by, 0);
                hookAssemblyGroup.add(stud);

                [-1, 1].forEach(sz => {
                    const washer = new THREE.Mesh(new THREE.CylinderGeometry(0.042, 0.042, 0.007, 20), MATS.darkSteel);
                    washer.rotation.x = Math.PI / 2;
                    washer.position.set(bx, by, sz * 0.073);

                    const hexNut = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.024, 6), alloyMat);
                    hexNut.rotation.x = Math.PI / 2;
                    hexNut.position.set(bx, by, sz * 0.088);
                    hexNut.castShadow = true;
                    hookAssemblyGroup.add(washer, hexNut);
                });
            });

            // 5. Forged Alloy Steel J-Hook with Safety Latch (inner saddle at y = -0.340)
            const forgedHook = createForgedCraneHookGroup();
            forgedHook.name = 'Swivel_Hook';
            hookAssemblyGroup.add(forgedHook);

            // 6. Interlocked Forged Red Oval Master Link
            // Top inner crown = -0.450 + (0.268/2 - 0.024) = -0.340 (rests flush in hook saddle!)
            // Bottom inner crown = -0.450 - (0.268/2 - 0.024) = -0.560 === HOOK_MASTER_OFFSET_Y
            masterLinkMesh = createOvalMasterLink(0.268, 0.156, 0.024);
            masterLinkMesh.name = 'Master_Link';
            masterLinkMesh.position.set(0, -0.450, 0);
            masterLinkMesh.rotation.y = Math.PI / 2;
            hookAssemblyGroup.add(masterLinkMesh);

            // Invisible Hit Sphere for Dragging Hook
            const grabSphere = new THREE.Mesh(
                new THREE.SphereGeometry(0.95, 12, 12),
                new THREE.MeshBasicMaterial({ visible: false })
            );
            grabSphere.position.set(0, 0.1, 0);
            grabSphere.userData = { dragType: 'hook' };
            hookAssemblyGroup.add(grabSphere);

            hookAssemblyGroup.name = 'Crane_Hook_Block';
            scene.add(hookAssemblyGroup);
            hookAssemblyGroup.userData.gearKind = 'hook';
            hookAssemblyGroup.userData.gearIndex = 0;
            const hookPick = new THREE.Mesh(
                new THREE.SphereGeometry(0.30, 10, 8),
                new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false })
            );
            hookPick.position.y = -0.15;
            hookPick.userData.gearKind = 'hook';
            hookPick.userData.gearIndex = 0;
            hookAssemblyGroup.add(hookPick);

            // Plumb Line from Hook to Floor
            plumbLineMesh = new THREE.Line(
                new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0, HOOK_MASTER_OFFSET_Y, 0), new THREE.Vector3(0, -24, 0)]),
                new THREE.LineDashedMaterial({ color: 0xfacc15, dashSize: 0.22, gapSize: 0.15, opacity: 0.65, transparent: true })
            );
            plumbLineMesh.computeLineDistances();
            hookAssemblyGroup.add(plumbLineMesh);

            // Cargo Root Group
            cargoRootGroup = new THREE.Group();
            cargoRootGroup.name = 'Cargo_Payload_Root';
            scene.add(cargoRootGroup);

            // Draggable 3D CoG Sphere Gizmo + 3-Axis Crosshair
            cogIndicatorGroup = new THREE.Group();
            cogIndicatorGroup.name = 'Center_of_Gravity_CoG';
            const cogSphere = new THREE.Mesh(
                new THREE.SphereGeometry(0.18, 24, 24),
                new THREE.MeshBasicMaterial({ color: 0xfacc15, depthTest: false })
            );
            cogSphere.name = 'Center_of_Gravity_Sphere';
            cogSphere.renderOrder = 999;
            cogSphere.userData = { dragType: 'cog' };

            const cogRing = new THREE.Mesh(
                new THREE.RingGeometry(0.24, 0.31, 32),
                new THREE.MeshBasicMaterial({ color: 0xef4444, side: THREE.DoubleSide, depthTest: false })
            );
            cogRing.renderOrder = 999;

            // Vertical CoG Reference Drop Line inside Cargo
            cogDropLine = new THREE.Line(
                new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0, -2, 0), new THREE.Vector3(0, 2, 0)]),
                new THREE.LineBasicMaterial({ color: 0xfacc15, depthTest: false })
            );
            cogDropLine.renderOrder = 998;

            cogIndicatorGroup.add(cogSphere, cogRing, cogDropLine);
            cargoRootGroup.add(cogIndicatorGroup);

            // Up to 8 welded pad-eyes + hardware shackles
            for (let i = 0; i < 8; i++) {
                const padEye = createDraggablePadEye(i);
                padEye.name = `Pad_Eye_Lug_Plate_LP${i + 1}`;
                cargoRootGroup.add(padEye);
                padEyeMeshes.push(padEye);

                const hwGroup = new THREE.Group();
                hwGroup.name = `Shackle_Hardware_LP${i + 1}`;
                hwGroup.userData.gearKind = 'shackle';
                hwGroup.userData.gearIndex = i;
                cargoRootGroup.add(hwGroup);
                hwMeshes.push(hwGroup);

                const arrow = new THREE.ArrowHelper(
                    new THREE.Vector3(0, 1, 0),
                    new THREE.Vector3(0, 0, 0),
                    1.5,
                    0x10b981,
                    0.35,
                    0.2
                );
                arrow.name = `Tension_Force_Vector_LP${i + 1}`;
                scene.add(arrow);
                forceArrows.push(arrow);
            }

            // Spreader Root Group
            spreaderRootGroup = new THREE.Group();
            spreaderRootGroup.name = 'Spreader_Beam_Assembly';
            spreaderRootGroup.userData.gearKind = 'beam';
            spreaderRootGroup.userData.gearIndex = 0;
            scene.add(spreaderRootGroup);

            // Pool: dense chain link budget so long uppers stay interlocked end-to-end
            for (let i = 0; i < 48; i++) {
                const slingObj = createArticulated3DSling(28, 200);
                slingObj.group.name = `Wire_Rope_Sling_${i + 1}`;
                scene.add(slingObj.group);
                sling3DPool.push(slingObj);
            }
        }

        function createOvalMasterLink(height, width, radius) {
            const group = new THREE.Group();
            const halfH = Math.max(0.01, (height - width) / 2);
            const topArc = new THREE.Mesh(new THREE.TorusGeometry(width / 2, radius, 14, 28, Math.PI), MATS.redMaster);
            topArc.position.y = halfH;
            const botArc = new THREE.Mesh(new THREE.TorusGeometry(width / 2, radius, 14, 28, Math.PI), MATS.redMaster);
            botArc.rotation.z = Math.PI;
            botArc.position.y = -halfH;
            const sideGeo = new THREE.CylinderGeometry(radius, radius, halfH * 2, 14);
            const sideL = new THREE.Mesh(sideGeo, MATS.redMaster);
            sideL.position.x = -width / 2;
            const sideR = new THREE.Mesh(sideGeo, MATS.redMaster);
            sideR.position.x = width / 2;
            // Welded splice collar on one side bar
            const weldCollar = new THREE.Mesh(new THREE.CylinderGeometry(radius * 1.18, radius * 1.18, 0.028, 14), MATS.redMaster);
            weldCollar.position.set(width / 2, 0, 0);
            group.add(topArc, botArc, sideL, sideR, weldCollar);
            group.traverse(m => { if (m.isMesh) m.castShadow = true; });
            return group;
        }

        // Helper: Welded ASME BTH-1 Pad-Eye with real open pin bore at (0, 0.12, 0) along Z axis
        function createBoredLugGeometry(baseHalfW, baseY, holeY, outerR, boreR, thickness) {
            const shape = new THREE.Shape();
            shape.moveTo(-baseHalfW, baseY);
            shape.lineTo(-outerR, holeY * 0.85);
            shape.absarc(0, holeY, outerR, Math.PI, 0, true);
            shape.lineTo(baseHalfW, baseY);
            shape.closePath();

            const hole = new THREE.Path();
            hole.absarc(0, holeY, boreR, 0, Math.PI * 2, false);
            shape.holes.push(hole);

            const geo = new THREE.ExtrudeGeometry(shape, {
                depth: thickness,
                bevelEnabled: true,
                bevelThickness: 0.0025,
                bevelSize: 0.0025,
                bevelSegments: 1,
                curveSegments: 24
            });
            geo.translate(0, 0, -thickness / 2);
            return geo;
        }

        function createBossRingGeometry(outerR, boreR, thickness) {
            const shape = new THREE.Shape();
            shape.absarc(0, 0, outerR, 0, Math.PI * 2, false);
            const hole = new THREE.Path();
            hole.absarc(0, 0, boreR, 0, Math.PI * 2, true);
            shape.holes.push(hole);
            const geo = new THREE.ExtrudeGeometry(shape, { depth: thickness, bevelEnabled: false, curveSegments: 22 });
            geo.translate(0, 0, -thickness / 2);
            return geo;
        }

        function createDraggablePadEye(lpIndex) {
            const group = new THREE.Group();
            const alloyMat = MATS.forgedAlloy || MATS.galvSteel;

            // Welded steel baseplate (highlighted when LP selected)
            const basePlate = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.020, 0.16), MATS.lpHighlight);
            basePlate.position.y = 0.010;
            basePlate.name = 'lpBase';

            // Perimeter weld bead collar around cheek plate root
            const weldBead = new THREE.Mesh(new THREE.BoxGeometry(0.185, 0.014, 0.046), MATS.darkSteel);
            weldBead.position.y = 0.022;

            // Main vertical ASME BTH-1 cheek plate in XY plane, pin bore along Z at y = 0.12
            const cheekPlate = new THREE.Mesh(
                createBoredLugGeometry(0.082, 0.018, 0.12, 0.066, 0.022, 0.026),
                MATS.yellowHazard
            );

            // Machined pin boss reinforcement rings (total width 0.042m -> fits cleanly inside 48mm shackle jaw)
            const bossRing = new THREE.Mesh(
                createBossRingGeometry(0.042, 0.022, 0.042),
                alloyMat
            );
            bossRing.position.set(0, 0.12, 0);

            // Invisible Hit Sphere so dragging individual LP1..LP8 on 3D cargo is responsive
            const hitSphere = new THREE.Mesh(
                new THREE.SphereGeometry(0.36, 12, 12),
                new THREE.MeshBasicMaterial({ visible: false })
            );
            hitSphere.position.y = 0.12;
            hitSphere.userData = { dragType: 'lp', lpIndex };

            group.add(basePlate, weldBead, cheekPlate, bossRing, hitSphere);
            group.traverse(m => { if (m.isMesh && m.visible) m.castShadow = true; });
            return group;
        }

        // Returns the distance from the hardware pin center (0,0,0) to its inner sling-bearing crown along +Y
        function hardwareCrownOffset(type, scale) {
            const s = scale == null ? 1.0 : scale;
            if (type === 'wide_shackle') return 0.174 * s;
            if (type === 'd_shackle') return 0.136 * s;
            if (type === 'plate_clamp' || type === 'lifting_clamp') return 0.148 * s;
            if (type === 'hook' || type === 'clevis_hook') return 0.140 * s;
            if (type === 'eye_hook') return 0.155 * s;
            if (type === 'swivel_hook') return 0.178 * s;
            if (type === 'master_link') return 0.195 * s;
            if (type === 'turnbuckle') return 0.245 * s;
            if (type === 'wire_rope_clip') return 0.135 * s;
            if (type === 'eye_bolt') return 0.118 * s;
            if (type === 'thimble') return 0.110 * s;
            if (type === 'ferrule') return 0.150 * s;
            if (type === 'load_cell') return 0.220 * s;
            return 0.142 * s; // bow_shackle default
        }

        function buildHardwareMesh(type) {
            const group = new THREE.Group();
            const alloyMat = MATS.forgedAlloy || MATS.galvSteel;

            if (customHwMeshes[type]) {
                const clone = customHwMeshes[type].clone();
                clone.name = type;
                group.name = type;
                group.add(clone);
                return group;
            }

            if (type === 'bow_shackle' || type === 'wide_shackle' || type === 'crosby_shackle_glb') {
                // Crosby G-2130 Safety Bolt-Type Anchor / Bow Shackle:
                // Pin center at (0, 0, 0) along X; clear jaw gap [-0.024, +0.024]; inner crown at y = 0.142 (or 0.174 wide)
                group.name = type === 'wide_shackle' ? 'Wide_Body_Bow_Shackle' : 'Bow_Shackle';
                const wide = type === 'wide_shackle';
                const wScale = wide ? 1.32 : 1.0;
                const hCrown = wide ? 0.194 : 0.160;
                const barR = wide ? 0.020 : 0.0185;
                const jawX = 0.039;

                // Forged pin eye boss collars at (±jawX, 0, 0)
                [-jawX, jawX].forEach(ex => {
                    const eyeBoss = new THREE.Mesh(new THREE.CylinderGeometry(0.032, 0.032, 0.030, 18), alloyMat);
                    eyeBoss.rotation.z = Math.PI / 2;
                    eyeBoss.position.set(ex, 0, 0);
                    group.add(eyeBoss);
                });

                // Continuous closed-loop Omega Bow curving from (-jawX, 0) over crown to (+jawX, 0)
                const bowCurve = new THREE.CatmullRomCurve3([
                    new THREE.Vector3(-jawX, 0.004, 0),
                    new THREE.Vector3(-0.052 * wScale, 0.046, 0),
                    new THREE.Vector3(-0.074 * wScale, hCrown * 0.62, 0),
                    new THREE.Vector3(-0.048 * wScale, hCrown * 0.90, 0),
                    new THREE.Vector3( 0.000, hCrown, 0),
                    new THREE.Vector3( 0.048 * wScale, hCrown * 0.90, 0),
                    new THREE.Vector3( 0.074 * wScale, hCrown * 0.62, 0),
                    new THREE.Vector3( 0.052 * wScale, 0.046, 0),
                    new THREE.Vector3( jawX, 0.004, 0)
                ], false, 'centripetal', 0.45);
                const bowMesh = new THREE.Mesh(new THREE.TubeGeometry(bowCurve, 32, barR, 14, false), alloyMat);
                bowMesh.name = 'Shackle_Bow';

                // Forged Red Alloy Bolt Pin passing straight through (0, 0, 0) along X
                const pinShank = new THREE.Mesh(new THREE.CylinderGeometry(0.0195, 0.0195, 0.142, 16), MATS.redMaster);
                pinShank.rotation.z = Math.PI / 2;
                pinShank.name = 'Safety_Bolt_Pin';

                const hexHead = new THREE.Mesh(new THREE.CylinderGeometry(0.033, 0.033, 0.020, 6), MATS.redMaster);
                hexHead.rotation.z = Math.PI / 2;
                hexHead.position.set(0.066, 0, 0);

                const hexNut = new THREE.Mesh(new THREE.CylinderGeometry(0.030, 0.030, 0.018, 6), alloyMat);
                hexNut.rotation.z = Math.PI / 2;
                hexNut.position.set(-0.064, 0, 0);
                hexNut.name = 'Safety_Hex_Nut';

                const cotterPin = new THREE.Mesh(new THREE.BoxGeometry(0.006, 0.048, 0.006), MATS.yellowHazard);
                cotterPin.position.set(-0.077, 0, 0);
                cotterPin.name = 'Safety_Cotter_Pin';

                group.add(bowMesh, pinShank, hexHead, hexNut, cotterPin);

            } else if (type === 'd_shackle') {
                // Crosby G-2150 Safety Bolt-Type Chain / Dee Shackle:
                // Straight parallel legs at x = ±0.040, semicircular crown at y = 0.154 (inner y = 0.136)
                group.name = 'D_Shackle';
                const jawX = 0.040;
                const barR = 0.018;
                [-jawX, jawX].forEach(ex => {
                    const eyeBoss = new THREE.Mesh(new THREE.CylinderGeometry(0.031, 0.031, 0.028, 18), alloyMat);
                    eyeBoss.rotation.z = Math.PI / 2;
                    eyeBoss.position.set(ex, 0, 0);
                    group.add(eyeBoss);
                });

                const dCurve = new THREE.CatmullRomCurve3([
                    new THREE.Vector3(-jawX, 0.004, 0),
                    new THREE.Vector3(-jawX, 0.095, 0),
                    new THREE.Vector3(-jawX * 0.72, 0.142, 0),
                    new THREE.Vector3( 0.000, 0.154, 0),
                    new THREE.Vector3( jawX * 0.72, 0.142, 0),
                    new THREE.Vector3( jawX, 0.095, 0),
                    new THREE.Vector3( jawX, 0.004, 0)
                ], false, 'centripetal', 0.35);
                const dBody = new THREE.Mesh(new THREE.TubeGeometry(dCurve, 28, barR, 14, false), alloyMat);
                dBody.name = 'Dee_Shackle_Body';

                const pinShank = new THREE.Mesh(new THREE.CylinderGeometry(0.0195, 0.0195, 0.142, 16), MATS.redMaster);
                pinShank.rotation.z = Math.PI / 2;
                const hexHead = new THREE.Mesh(new THREE.CylinderGeometry(0.032, 0.032, 0.020, 6), MATS.redMaster);
                hexHead.rotation.z = Math.PI / 2;
                hexHead.position.set(0.066, 0, 0);
                const hexNut = new THREE.Mesh(new THREE.CylinderGeometry(0.029, 0.029, 0.018, 6), alloyMat);
                hexNut.rotation.z = Math.PI / 2;
                hexNut.position.set(-0.064, 0, 0);
                const cotterPin = new THREE.Mesh(new THREE.BoxGeometry(0.006, 0.046, 0.006), MATS.yellowHazard);
                cotterPin.position.set(-0.077, 0, 0);

                group.add(dBody, pinShank, hexHead, hexNut, cotterPin);

            } else if (type === 'eye_hook') {
                // Crosby A-323 Forged Alloy Eye Hook with Spring Safety Latch
                group.name = 'Eye_Hook';
                const hookCurve = new THREE.CatmullRomCurve3([
                    new THREE.Vector3(-0.046, 0.036, 0),
                    new THREE.Vector3(-0.056, 0.012, 0),
                    new THREE.Vector3(-0.032, -0.018, 0),
                    new THREE.Vector3( 0.005, -0.022, 0),
                    new THREE.Vector3( 0.042, 0.004, 0),
                    new THREE.Vector3( 0.046, 0.058, 0),
                    new THREE.Vector3( 0.012, 0.105, 0),
                    new THREE.Vector3( 0.000, 0.125, 0)
                ], false, 'centripetal', 0.45);
                const jBody = new THREE.Mesh(createVariableTubeGeometry(hookCurve, 32, 14, u => THREE.MathUtils.lerp(0.010, 0.024, Math.sin(u * Math.PI * 0.85))), MATS.redMaster);
                const topEye = new THREE.Mesh(new THREE.TorusGeometry(0.034, 0.012, 12, 24), MATS.redMaster);
                topEye.position.set(0, 0.145, 0);
                const latch = new THREE.Mesh(new THREE.BoxGeometry(0.008, 0.068, 0.016), alloyMat);
                latch.position.set(-0.020, 0.068, 0);
                latch.rotation.z = -0.52;
                group.add(jBody, topEye, latch);

            } else if (type === 'swivel_hook') {
                // Ball-Bearing 360° Swivel Hoist Hook with Safety Latch
                group.name = 'Swivel_Hook';
                const hookCurve = new THREE.CatmullRomCurve3([
                    new THREE.Vector3(-0.046, 0.034, 0),
                    new THREE.Vector3(-0.056, 0.010, 0),
                    new THREE.Vector3(-0.030, -0.018, 0),
                    new THREE.Vector3( 0.006, -0.020, 0),
                    new THREE.Vector3( 0.042, 0.006, 0),
                    new THREE.Vector3( 0.044, 0.055, 0),
                    new THREE.Vector3( 0.004, 0.098, 0)
                ], false, 'centripetal', 0.45);
                const jBody = new THREE.Mesh(createVariableTubeGeometry(hookCurve, 30, 14, u => THREE.MathUtils.lerp(0.010, 0.024, Math.sin(u * Math.PI * 0.85))), MATS.redMaster);
                // 360-degree thrust bearing swivel housing
                const swivelCup = new THREE.Mesh(new THREE.CylinderGeometry(0.028, 0.024, 0.038, 18), alloyMat);
                swivelCup.position.set(0, 0.115, 0);
                // Forged top swivel bail clevis loop (inner crown at y = 0.178)
                const bailLoop = new THREE.Mesh(new THREE.TorusGeometry(0.038, 0.012, 12, 24), MATS.redMaster);
                bailLoop.position.set(0, 0.155, 0);
                const latch = new THREE.Mesh(new THREE.BoxGeometry(0.008, 0.064, 0.016), alloyMat);
                latch.position.set(-0.020, 0.062, 0);
                latch.rotation.z = -0.52;
                group.add(jBody, swivelCup, bailLoop, latch);

            } else if (type === 'master_link') {
                // Crosby A-342 Oblong Master Link (bottom bearing at y = 0, top crown at y = 0.195)
                group.name = 'Master_Link';
                const link = createOvalMasterLink(0.225, 0.130, 0.020);
                link.position.set(0, 0.098, 0);
                group.add(link);

            } else if (type === 'turnbuckle') {
                // Crosby HG-228 Jaw & Jaw Forged Open-Body Turnbuckle (pin at y = 0, top pin at y = 0.245)
                group.name = 'Turnbuckle';
                const tb = createInlineTurnbuckleGroup();
                tb.visible = true;
                tb.scale.setScalar(0.55);
                tb.position.set(0, 0.122, 0);
                const botPin = new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.016, 0.095, 14), MATS.redMaster);
                botPin.rotation.z = Math.PI / 2;
                const topEye = new THREE.Mesh(new THREE.TorusGeometry(0.028, 0.010, 10, 20), alloyMat);
                topEye.position.set(0, 0.245, 0);
                group.add(tb, botPin, topEye);

            } else if (type === 'wire_rope_clip') {
                // Crosby G-450 Red-U-Bolt Wire Rope Clip / Clamp ("Never Saddle a Dead Horse")
                group.name = 'Wire_Rope_Clip_UBolt';
                const loop = createSlingEyeTerminationGroup();
                loop.position.set(0, 0, 0);
                // Forged grooved saddle + Red U-bolt + twin hex nuts at y = 0.095..0.135
                [-0.022, 0.022].forEach(cy => {
                    const saddle = new THREE.Mesh(new THREE.BoxGeometry(0.048, 0.026, 0.042), alloyMat);
                    saddle.position.set(0, 0.110 + cy, 0.012);
                    const uArc = new THREE.Mesh(new THREE.TorusGeometry(0.020, 0.0065, 8, 16, Math.PI), MATS.redMaster);
                    uArc.rotation.x = Math.PI / 2;
                    uArc.position.set(0, 0.110 + cy, -0.014);
                    [-0.018, 0.018].forEach(nx => {
                        const nut = new THREE.Mesh(new THREE.CylinderGeometry(0.011, 0.011, 0.014, 6), alloyMat);
                        nut.rotation.x = Math.PI / 2;
                        nut.position.set(nx, 0.110 + cy, 0.034);
                        group.add(nut);
                    });
                    group.add(saddle, uArc);
                });
                group.add(loop);

            } else if (type === 'eye_bolt') {
                // DIN 580 / ASME B18.15 Forged Shoulder Machinery Eye Bolt
                group.name = 'Eye_Bolt';
                const shoulder = new THREE.Mesh(new THREE.CylinderGeometry(0.038, 0.044, 0.026, 20), alloyMat);
                shoulder.position.y = 0.013;
                const threadedShank = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.085, 16), MATS.darkSteel);
                threadedShank.position.y = -0.038;
                const eyeRing = new THREE.Mesh(new THREE.TorusGeometry(0.048, 0.018, 14, 28), alloyMat);
                eyeRing.position.y = 0.074;
                group.add(shoulder, threadedShank, eyeRing);

            } else if (type === 'thimble') {
                // Heavy-Duty Galvanized Teardrop Wire Rope Thimble (G-414)
                group.name = 'Thimble';
                const thimbleCurve = new THREE.CatmullRomCurve3([
                    new THREE.Vector3(-0.016, 0.118, 0),
                    new THREE.Vector3(-0.044, 0.062, 0),
                    new THREE.Vector3(-0.038, 0.016, 0),
                    new THREE.Vector3( 0.000, 0.000, 0),
                    new THREE.Vector3( 0.038, 0.016, 0),
                    new THREE.Vector3( 0.044, 0.062, 0),
                    new THREE.Vector3( 0.016, 0.118, 0)
                ], false, 'centripetal', 0.45);
                const thMesh = new THREE.Mesh(new THREE.TubeGeometry(thimbleCurve, 28, 0.016, 12, false), alloyMat);
                group.add(thMesh);

            } else if (type === 'ferrule') {
                // EN 13411-3 Swaged Wire Rope Sleeve / Ferrule Termination
                group.name = 'Ferrule_Wire_Rope_Sleeve';
                const term = createSlingEyeTerminationGroup();
                term.scale.setScalar(1.15);
                group.add(term);

            } else if (type === 'load_cell') {
                // Digital Wireless Crane Tension Load Cell / Dynamometer
                group.name = 'Load_Cell_Dynamometer';
                const botClevis = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.10, 14), MATS.redMaster);
                botClevis.rotation.z = Math.PI / 2;
                const lowerLug = new THREE.Mesh(new THREE.BoxGeometry(0.052, 0.055, 0.036), alloyMat);
                lowerLug.position.y = 0.028;
                const cellBody = new THREE.Mesh(new THREE.BoxGeometry(0.096, 0.115, 0.052), MATS.yellowHazard);
                cellBody.position.y = 0.110;
                const lcdScreen = new THREE.Mesh(new THREE.BoxGeometry(0.068, 0.034, 0.008), MATS.darkSteel);
                lcdScreen.position.set(0, 0.122, 0.026);
                const topEye = new THREE.Mesh(new THREE.TorusGeometry(0.034, 0.012, 12, 22), alloyMat);
                topEye.position.y = 0.205;
                group.add(botClevis, lowerLug, cellBody, lcdScreen, topEye);

            } else if (type === 'plate_clamp' || type === 'lifting_clamp') {
                // Universal Articulated Steel Plate Clamp / Lifting Clamp
                group.name = 'Lifting_Clamp_Plate_Clamp';
                const jawBody = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.13, 0.085), MATS.yellowHazard);
                jawBody.position.y = 0.035;
                const camBolt = new THREE.Mesh(new THREE.CylinderGeometry(0.020, 0.020, 0.10, 14), MATS.darkSteel);
                camBolt.rotation.x = Math.PI / 2;
                camBolt.position.y = 0.025;
                const lockLever = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.085, 10), MATS.redMaster);
                lockLever.position.set(0.068, 0.055, 0);
                lockLever.rotation.z = -0.45;
                const liftEye = new THREE.Mesh(new THREE.TorusGeometry(0.048, 0.015, 12, 24), MATS.redMaster);
                liftEye.position.y = 0.115;
                group.add(jawBody, camBolt, lockLever, liftEye);

            } else {
                // Forged Alloy Clevis Sling Hook + Safety Latch (clevis pin at y = 0, eye at y = 0.140)
                group.name = 'Clevis_Hook';
                const clevisEarL = new THREE.Mesh(new THREE.BoxGeometry(0.018, 0.065, 0.042), MATS.redMaster);
                clevisEarL.position.set(-0.030, 0.018, 0);
                const clevisEarR = new THREE.Mesh(new THREE.BoxGeometry(0.018, 0.065, 0.042), MATS.redMaster);
                clevisEarR.position.set(0.030, 0.018, 0);
                const clevisPin = new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.016, 0.095, 14), alloyMat);
                clevisPin.rotation.z = Math.PI / 2;

                const eyeRing = new THREE.Mesh(new THREE.TorusGeometry(0.045, 0.015, 12, 22), MATS.redMaster);
                eyeRing.position.y = 0.110;

                const latch = new THREE.Mesh(new THREE.BoxGeometry(0.010, 0.065, 0.018), alloyMat);
                latch.position.set(0.028, 0.075, 0);
                latch.rotation.z = 0.35;
                group.add(clevisEarL, clevisEarR, clevisPin, eyeRing, latch);
            }

            group.traverse(m => { if (m.isMesh) m.castShadow = true; });
            return group;
        }

        // Helper: Teardrop Wire-Rope Eye + Forged Steel Thimble + Swaged Aluminum Ferrule
        // Local origin (0,0,0) is the exact inner bearing contact point; +Y points inward along the sling!
        function createSlingEyeTerminationGroup() {
            const termGroup = new THREE.Group();
            termGroup.name = 'Wire_Rope_Eye_Termination';
            const alloyMat = MATS.forgedAlloy || MATS.galvSteel;

            // Teardrop wire-rope eye loop + steel thimble liner
            // Inner nose at y = -0.002 (hugs bearing pin/crown), converges into ferrule at y = 0.095
            const eyeCurve = new THREE.CatmullRomCurve3([
                new THREE.Vector3(-0.010, 0.098, 0),
                new THREE.Vector3(-0.032, 0.046, 0),
                new THREE.Vector3(-0.028, 0.010, 0),
                new THREE.Vector3( 0.000, -0.008, 0),
                new THREE.Vector3( 0.028, 0.010, 0),
                new THREE.Vector3( 0.032, 0.046, 0),
                new THREE.Vector3( 0.010, 0.098, 0)
            ], false, 'centripetal', 0.4);
            const wireEye = new THREE.Mesh(new THREE.TubeGeometry(eyeCurve, 22, 0.013, 10, false), MATS.wireRope);
            wireEye.name = 'Wire_Rope_Eye_Loop';

            const thimbleCurve = new THREE.CatmullRomCurve3([
                new THREE.Vector3(-0.012, 0.078, 0),
                new THREE.Vector3(-0.022, 0.038, 0),
                new THREE.Vector3( 0.000, 0.002, 0),
                new THREE.Vector3( 0.022, 0.038, 0),
                new THREE.Vector3( 0.012, 0.078, 0)
            ], false, 'centripetal', 0.4);
            const thimbleMesh = new THREE.Mesh(new THREE.TubeGeometry(thimbleCurve, 16, 0.0085, 8, false), alloyMat);
            thimbleMesh.name = 'Thimble';

            // Tapered swaged ferrule sleeve crimping the eye splice
            const ferruleBody = new THREE.Mesh(new THREE.CylinderGeometry(0.023, 0.027, 0.088, 16), MATS.ferruleSilver);
            ferruleBody.position.y = 0.126;
            ferruleBody.name = 'Ferrule_Wire_Rope_Sleeve';
            const ferruleCone = new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.023, 0.026, 16), MATS.ferruleSilver);
            ferruleCone.position.y = 0.182;

            termGroup.add(wireEye, thimbleMesh, ferruleBody, ferruleCone);
            termGroup.traverse(m => { if (m.isMesh) m.castShadow = true; });
            return termGroup;
        }

        // Helper: Stitched Web-Sling Eye Sleeve for synthetic slings
        function createWebEyeSleeveGroup() {
            const g = new THREE.Group();
            g.name = 'Synthetic_Web_Eye_Sleeve';
            const loop = new THREE.Mesh(new THREE.TorusGeometry(0.028, 0.011, 8, 16), MATS.darkSteel);
            loop.position.y = 0.026;
            const cuff = new THREE.Mesh(new THREE.BoxGeometry(0.068, 0.095, 0.024), MATS.webGreen);
            cuff.position.y = 0.092;
            g.add(loop, cuff);
            return g;
        }

        // Helper: Inline Forged Open-Body Turnbuckle / Rigging Screw (Crosby HG-228 style)
        function createInlineTurnbuckleGroup() {
            const tb = new THREE.Group();
            tb.name = 'Turnbuckle';
            const alloyMat = MATS.forgedAlloy || MATS.galvSteel;

            // Open twin-bar forged turnbuckle frame (length 0.30m)
            [-0.028, 0.028].forEach(bx => {
                const sideBar = new THREE.Mesh(new THREE.CylinderGeometry(0.011, 0.011, 0.28, 10), alloyMat);
                sideBar.position.x = bx;
                tb.add(sideBar);
            });
            [-0.14, 0.14].forEach(by => {
                const endBoss = new THREE.Mesh(new THREE.CylinderGeometry(0.032, 0.032, 0.042, 6), MATS.redMaster);
                endBoss.position.y = by;
                tb.add(endBoss);
            });
            // Threaded screw rods + hex jam locknuts extending ±0.24m along local Y
            [-1, 1].forEach(sy => {
                const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.013, 0.013, 0.14, 12), alloyMat);
                rod.position.y = sy * 0.21;
                const lockNut = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, 0.016, 6), MATS.yellowHazard);
                lockNut.position.y = sy * 0.175;
                tb.add(rod, lockNut);
            });
            tb.visible = false;
            tb.traverse(m => { if (m.isMesh) m.castShadow = true; });
            return tb;
        }

        // Builds a standalone 3D preview assembly for Slings, Ropes, Bridles & Taglines in the 3D Asset Library
        function buildSlingLibraryPreviewMesh(presetId) {
            const g = new THREE.Group();
            g.name = presetId || 'Sling_Assembly';
            if (presetId === 'sling_wire_rope' || presetId === 'preset_modulift_iso') {
                g.name = 'Wire_Rope_Sling';
                const topEye = createSlingEyeTerminationGroup();
                topEye.position.set(0, 1.35, 0);
                topEye.rotation.z = Math.PI;
                const botEye = createSlingEyeTerminationGroup();
                botEye.position.set(0, -1.35, 0);
                const rope = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, 2.32, 16), MATS.wireRope);
                const shTop = buildHardwareMesh('bow_shackle');
                shTop.position.set(0, 1.49, 0);
                shTop.rotation.z = Math.PI;
                const shBot = buildHardwareMesh('bow_shackle');
                shBot.position.set(0, -1.49, 0);
                g.add(topEye, botEye, rope, shTop, shBot);
                return g;
            }
            if (presetId === 'sling_chain') {
                g.name = 'Chain_Sling';
                const ml = createOvalMasterLink(0.28, 0.16, 0.024);
                ml.position.set(0, 1.35, 0);
                g.add(ml);
                for (let i = 0; i < 32; i++) {
                    const lk = createOvalChainLinkGroup();
                    lk.position.set(0, 1.20 - i * CHAIN_NEST_PITCH, 0);
                    if (i % 2) lk.rotation.y = Math.PI / 2;
                    lk.scale.set(1.1, 1.1 * CHAIN_LINK_ELONG, 1.1);
                    g.add(lk);
                }
                const hk = buildHardwareMesh('clevis_hook');
                hk.position.set(0, -1.25, 0);
                g.add(hk);
                return g;
            }
            if (presetId === 'sling_web') {
                g.name = 'Synthetic_Web_Sling';
                const flatBand = new THREE.Mesh(new THREE.BoxGeometry(0.14, 2.30, 0.024), MATS.webGreen);
                const eyeA = createWebEyeSleeveGroup();
                eyeA.position.set(0, 1.25, 0);
                eyeA.rotation.z = Math.PI;
                const eyeB = createWebEyeSleeveGroup();
                eyeB.position.set(0, -1.25, 0);
                g.add(flatBand, eyeA, eyeB);
                return g;
            }
            if (presetId === 'sling_round') {
                g.name = 'Round_Sling';
                const roundLoop = new THREE.Mesh(
                    new THREE.TorusGeometry(0.85, 0.052, 18, 48),
                    new THREE.MeshStandardMaterial({ color: 0x9333ea, roughness: 0.65, metalness: 0.05 })
                );
                roundLoop.scale.set(0.42, 1.45, 1.0);
                const wearPad = new THREE.Mesh(new THREE.CylinderGeometry(0.065, 0.065, 0.45, 16), MATS.darkSteel);
                wearPad.position.set(0.35, 0, 0);
                g.add(roundLoop, wearPad);
                return g;
            }
            if (presetId === 'sling_grommet') {
                g.name = 'Grommet_Sling';
                const grommetLoop = new THREE.Mesh(
                    new THREE.TorusGeometry(0.95, 0.044, 18, 52),
                    MATS.wireRope
                );
                grommetLoop.scale.set(0.45, 1.45, 1.0);
                const markSleeve = new THREE.Mesh(new THREE.CylinderGeometry(0.054, 0.054, 0.28, 16), MATS.redMaster);
                markSleeve.position.set(-0.42, 0, 0);
                g.add(grommetLoop, markSleeve);
                return g;
            }
            if (presetId === 'sling_tagline') {
                g.name = 'Tagline';
                const sh = buildHardwareMesh('bow_shackle');
                sh.position.set(-1.1, 0.9, 0);
                const tagCurve = new THREE.CatmullRomCurve3([
                    new THREE.Vector3(-1.1, 0.85, 0),
                    new THREE.Vector3(-0.4, 0.25, 0.15),
                    new THREE.Vector3( 0.4, -0.35, -0.10),
                    new THREE.Vector3( 1.2, -0.95, 0)
                ]);
                const rope = new THREE.Mesh(
                    new THREE.TubeGeometry(tagCurve, 36, 0.018, 12, false),
                    new THREE.MeshStandardMaterial({ color: 0xfacc15, roughness: 0.72, metalness: 0.05 })
                );
                const coil = new THREE.Mesh(
                    new THREE.TorusGeometry(0.22, 0.032, 12, 28),
                    new THREE.MeshStandardMaterial({ color: 0xfacc15, roughness: 0.72, metalness: 0.05 })
                );
                coil.rotation.x = Math.PI / 2;
                coil.position.set(1.25, -0.98, 0);
                g.add(sh, rope, coil);
                return g;
            }
            // Default: Multi-leg Bridle Sling (2-Leg, 3-Leg, 4-Leg)
            g.name = 'Bridle_Sling';
            const ml = createOvalMasterLink(0.32, 0.18, 0.026);
            ml.position.set(0, 1.35, 0);
            g.add(ml);
            const corners = [[0.9, -1.1, 0.6], [-0.9, -1.1, 0.6], [-0.9, -1.1, -0.6], [0.9, -1.1, -0.6]];
            corners.forEach(([cx, cy, cz]) => {
                const pTop = new THREE.Vector3(0, 1.22, 0);
                const pBot = new THREE.Vector3(cx, cy, cz);
                const dir = pBot.clone().sub(pTop);
                const len = dir.length();
                const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, len, 12), MATS.wireRope);
                leg.position.copy(pTop).lerp(pBot, 0.5);
                leg.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.normalize());
                const sh = buildHardwareMesh('bow_shackle');
                sh.position.copy(pBot);
                g.add(leg, sh);
            });
            return g;
        }

        // Grade-80 oval link, true proportions for 16 mm stock (EN 818-2 style): pitch p = 3d = 48 mm,
        // inside width ~1.4d, so centerline half-width = (22 + 16) / 2 = 19 mm. Scales linearly with d / 16.
        // Torus in XY, long axis = +Y after scale — matches path tangent via setFromUnitVectors(up, dir).
        const CHAIN_LINK_MAJOR = 0.019;   // centerline half-width (m) @ 16 mm stock
        const CHAIN_LINK_TUBE = 0.008;    // stock radius (m) @ 16 mm stock
        const CHAIN_LINK_ELONG = 1.55;    // stretch → long oval
        const CHAIN_LINK_GEO = new THREE.TorusGeometry(CHAIN_LINK_MAJOR, CHAIN_LINK_TUBE, 8, 18);
        // Outer length along tangent at unit scale
        const CHAIN_LINK_OUTER = 2 * (CHAIN_LINK_MAJOR + CHAIN_LINK_TUBE) * CHAIN_LINK_ELONG;
        // Real link-to-link center pitch: 3 x stock diameter
        const CHAIN_NEST_PITCH = 0.048;

        function createOvalChainLinkGroup() {
            const mesh = new THREE.Mesh(CHAIN_LINK_GEO, MATS.chainDark);
            mesh.scale.set(1, CHAIN_LINK_ELONG, 1);
            mesh.castShadow = false;
            mesh.receiveShadow = false;
            mesh.userData.linkPitch = CHAIN_NEST_PITCH;
            return mesh;
        }

        function createArticulated3DSling(numSegments, numLinks) {
            const group = new THREE.Group();
            const segments = [];
            const nSeg = Math.max(8, numSegments | 0);
            const nLink = Math.max(nSeg, numLinks | 0);

            const endEyeA = createSlingEyeTerminationGroup();
            const endEyeB = createSlingEyeTerminationGroup();
            const webEyeA = createWebEyeSleeveGroup();
            const webEyeB = createWebEyeSleeveGroup();
            const turnbuckle = createInlineTurnbuckleGroup();
            group.add(endEyeA, endEyeB, webEyeA, webEyeB, turnbuckle);

            const segGeo = new THREE.CylinderGeometry(0.018, 0.018, 1.0, 8);
            for (let i = 0; i < nSeg; i++) {
                const segMesh = new THREE.Mesh(segGeo, MATS.wireRope);
                segMesh.castShadow = (i % 4 === 0);
                segMesh.receiveShadow = false;
                group.add(segMesh);
                segments.push(segMesh);
            }
            const pickMat = new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false });
            const pickers = [0.25, 0.5, 0.75].map(() => {
                const picker = new THREE.Mesh(new THREE.SphereGeometry(0.045, 8, 6), pickMat);
                picker.visible = false;
                group.add(picker);
                return picker;
            });
            const links = [];
            for (let i = 0; i < nLink; i++) {
                const link = new THREE.Mesh(CHAIN_LINK_GEO, MATS.chainDark);
                link.visible = false;
                link.castShadow = false;
                link.receiveShadow = false;
                link.scale.set(1, CHAIN_LINK_ELONG, 1);
                group.add(link);
                links.push(link);
            }
            return {
                group,
                segments,
                endEyeA,
                endEyeB,
                webEyeA,
                webEyeB,
                turnbuckle,
                links,
                numSegments: nSeg,
                numLinks: nLink,
                pickers,
                drawMeta: null,
                lastMid: new THREE.Vector3()
            };
        }

        function releaseLocalBox(q, cx, cy, cz, hx, hy, hz, biasUp) {
            const dPosX = (cx + hx) - q.x;
            const dNegX = q.x - (cx - hx);
            const dTop  = (cy + hy) - q.y;
            const dBottom = q.y - (cy - hy);
            const dPosZ = (cz + hz) - q.z;
            const dNegZ = q.z - (cz - hz);
            if (dPosX <= 0 || dNegX <= 0 || dTop <= 0 || dBottom <= 0 || dPosZ <= 0 || dNegZ <= 0) {
                return false;
            }
            const dSideX = Math.min(dPosX, dNegX);
            const dSideZ = Math.min(dPosZ, dNegZ);
            const dSideMin = Math.min(dSideX, dSideZ);

            if (biasUp) {
                // Bias up: when hanging from above, slack slings drape on top of the solid roof (+Y).
                // Never push downward through the container floor (ny = -1 strictly forbidden)!
                // Only push out sideways if close to a vertical side wall near the bottom.
                if (dTop <= dSideMin * 2.5 || q.y >= cy - hy * 0.45) {
                    q.y = cy + hy + 0.008;
                    return true;
                }
                if (dSideX < dSideZ) {
                    q.x = (q.x >= cx) ? (cx + hx + 0.008) : (cx - hx - 0.008);
                } else {
                    q.z = (q.z >= cz) ? (cz + hz + 0.008) : (cz - hz - 0.008);
                }
                return true;
            }

            // General 6-face minimum penetration ejection
            let minD = dTop;
            let nx = 0, ny = 1, nz = 0;
            if (dBottom < minD) { minD = dBottom; nx = 0; ny = -1; nz = 0; }
            if (dPosX < minD)   { minD = dPosX;   nx = 1; ny = 0;  nz = 0; }
            if (dNegX < minD)   { minD = dNegX;   nx = -1; ny = 0; nz = 0; }
            if (dPosZ < minD)   { minD = dPosZ;   nx = 0; ny = 0;  nz = 1; }
            if (dNegZ < minD)   { minD = dNegZ;   nx = 0; ny = 0;  nz = -1; }

            q.x += nx * (minD + 0.008);
            q.y += ny * (minD + 0.008);
            q.z += nz * (minD + 0.008);
            return true;
        }

        // Exact shape-aware 3D outer-shell collision in cargo local space
        function pushOutOfCargoShellLocal(localPt, pad, biasUp) {
            const q = localPt.clone();
            const { cargoType, L, W, H } = state;
            const p = Math.max(0.008, pad || 0.02);
            const up = !!biasUp;

            if (cargoType === 'vessel' || cargoType === 'pipe') {
                const radius = Math.min(W, H) * 0.42 + 0.022;
                const cylLen = Math.max(1.2, L - Math.min(W, H) * 0.42 * 1.5);
                const halfCyl = cylLen * 0.5;
                const shellCenterY = H * 0.06;
                const headRx = Math.min(W, H) * 0.42 * 0.6;
                const R = radius + p;

                if (Math.abs(q.x) <= halfCyl) {
                    const dy = q.y - shellCenterY;
                    const dz = q.z;
                    const rYZ = Math.hypot(dy, dz);
                    if (rYZ < R) {
                        if (rYZ > 1e-5) {
                            const s = (R + 0.004) / rYZ;
                            q.y = shellCenterY + dy * s;
                            q.z = dz * s;
                        } else {
                            q.y = shellCenterY + R + 0.004;
                        }
                    }
                } else if (Math.abs(q.x) <= halfCyl + headRx + p) {
                    const cx = Math.sign(q.x) * halfCyl;
                    const rx = headRx + p;
                    const dx = q.x - cx;
                    const dy = q.y - shellCenterY;
                    const dz = q.z;
                    const norm2 = (dx * dx) / (rx * rx) + (dy * dy + dz * dz) / (R * R);
                    if (norm2 < 1.0) {
                        const norm = Math.sqrt(Math.max(1e-8, norm2));
                        const scale = 1.005 / norm;
                        q.x = cx + dx * scale;
                        q.y = shellCenterY + dy * scale;
                        q.z = dz * scale;
                    }
                }

                // 3 Top Flanged Nozzles
                [-0.28, 0, 0.28].forEach((xf, idx) => {
                    const nx = xf * cylLen;
                    const nozR = (idx === 1 ? 0.22 : 0.14) * 1.45 + p;
                    const nyTop = shellCenterY + radius + 0.36 + p;
                    if (q.y >= shellCenterY + radius * 0.7 && q.y <= nyTop) {
                        const dx = q.x - nx;
                        const dz = q.z;
                        const rXZ = Math.hypot(dx, dz);
                        if (rXZ < nozR) {
                            const topDist = nyTop - q.y;
                            const sideDist = nozR - rXZ;
                            if (topDist < sideDist) {
                                q.y = nyTop + 0.004;
                            } else if (rXZ > 1e-5) {
                                q.x = nx + (dx / rXZ) * (nozR + 0.004);
                                q.z = (dz / rXZ) * (nozR + 0.004);
                            } else {
                                q.z = nozR + 0.004;
                            }
                        }
                    }
                });

                // 2 Contoured Steel Saddle Supports
                const saddleH = shellCenterY + H * 0.5;
                [-0.32, 0.32].forEach(xf => {
                    releaseLocalBox(q, xf * L, -H * 0.5 + saddleH * 0.325, 0, 0.24 + p, saddleH * 0.34 + p, W * 0.45 + p, up);
                });
                return q;
            }

            if (cargoType === 'opentop') {
                const floorTopY = -H * 0.5 + 0.18;
                const hasCargo = state.oogHasCargo !== false;
                const hasTarp = state.oogTarp !== false;
                const cL = THREE.MathUtils.clamp(state.oogCargoL || L * 0.84, 1.2, L - 0.22);
                const cW = THREE.MathUtils.clamp(state.oogCargoW || W * 0.88, 0.9, W - 0.16);
                const cH = THREE.MathUtils.clamp(state.oogCargoH || H * 1.15, 0.6, 4.8);
                const cargoPeakY = floorTopY + cH;

                if (hasTarp) {
                    // Tented tarpaulin cover over the open top container roof + internal cargo peak
                    const ux = Math.max(0, 1 - Math.pow(q.x / Math.max(0.4, (L * 0.48)), 2));
                    const uz = Math.max(0, 1 - Math.pow(q.z / Math.max(0.3, (W * 0.48)), 2));
                    const cxNorm = Math.max(0, 1 - Math.pow(q.x / Math.max(0.35, cL * 0.54), 2));
                    const czNorm = Math.max(0, 1 - Math.pow(q.z / Math.max(0.30, cW * 0.54), 2));
                    const bulge = (hasCargo && cargoPeakY > H * 0.5 - 0.05)
                        ? Math.max(0, cargoPeakY - H * 0.5 + 0.06) * Math.pow(cxNorm * czNorm, 0.65)
                        : 0.04 * ux * uz;
                    const roofSurfaceY = H * 0.5 + bulge;
                    if (Math.abs(q.x) <= L * 0.5 + p && Math.abs(q.z) <= W * 0.5 + p && q.y > -H * 0.5 - p && q.y < roofSurfaceY + p) {
                        const dTop = (roofSurfaceY + p) - q.y;
                        const dSideX = (L * 0.5 + p) - Math.abs(q.x);
                        const dSideZ = (W * 0.5 + p) - Math.abs(q.z);
                        if (up || dTop <= Math.min(dSideX, dSideZ) + 0.12) {
                            q.y = roofSurfaceY + p + 0.008;
                        } else if (dSideX < dSideZ) {
                            q.x = (Math.sign(q.x) || 1) * (L * 0.5 + p + 0.008);
                        } else {
                            q.z = (Math.sign(q.z) || 1) * (W * 0.5 + p + 0.008);
                        }
                    }
                } else {
                    // Open roof: 4 perimeter walls + floor + optional internal cargo
                    releaseLocalBox(q, 0, -H * 0.5 + 0.09, 0, L * 0.5 + p, 0.09 + p, W * 0.5 + p, up);
                    [-1, 1].forEach(sz => {
                        releaseLocalBox(q, 0, 0, sz * (W * 0.5 - 0.06), L * 0.5 + p, H * 0.5 + p, 0.07 + p, up);
                    });
                    [-1, 1].forEach(sx => {
                        releaseLocalBox(q, sx * (L * 0.5 - 0.06), 0, 0, 0.07 + p, H * 0.5 + p, W * 0.5 + p, up);
                    });
                    if (hasCargo) {
                        releaseLocalBox(q, 0, floorTopY + cH * 0.5, 0, cL * 0.5 + p, cH * 0.5 + p, cW * 0.5 + p, up);
                    }
                }
                return q;
            }

            if (cargoType === 'flatrack') {
                // Heavy I-beam bottom deck + two end bulkheads
                const deckTopY = -H * 0.5 + 0.30;
                releaseLocalBox(q, 0, -H * 0.5 + 0.15, 0, L * 0.5 + p, 0.15 + p, W * 0.5 + p, up);
                [-1, 1].forEach(sx => {
                    releaseLocalBox(q, sx * (L * 0.5 - 0.11), 0, 0, 0.11 + p, H * 0.5 + p, W * 0.5 + p, up);
                });
                // Adjustable OOG Cargo on Flat Rack (supports Over-Width, Over-Length, Over-Height)
                const oogStatus = phy.oogState ? phy.oogState.status : 'secured';
                if (state.oogHasCargo !== false && oogStatus !== 'falling' && oogStatus !== 'grounded') {
                    const cL = THREE.MathUtils.clamp(state.oogCargoL || L * 0.72, 1.5, 14.5);
                    const cW = THREE.MathUtils.clamp(state.oogCargoW || W * 1.28, 1.0, 5.2);
                    const cH = THREE.MathUtils.clamp(state.oogCargoH || H * 1.08, 0.8, 4.8);
                    const dunnageTopY = deckTopY + 0.10;
                    const ox = (oogStatus === 'sliding' && phy.oogState) ? phy.oogState.localPos.x : 0;
                    const oz = (oogStatus === 'sliding' && phy.oogState) ? phy.oogState.localPos.z : 0;
                    releaseLocalBox(q, ox, dunnageTopY + cH * 0.5, oz, cL * 0.5 + p, cH * 0.5 + p, cW * 0.5 + p, up);
                }
                return q;
            }

            if (cargoType === 'platform') {
                const deckH = Math.max(0.22, H * 0.55);
                releaseLocalBox(q, 0, -H * 0.5 + deckH * 0.5, 0, L * 0.5 + p, deckH * 0.5 + p, W * 0.5 + p, up);
                return q;
            }

            if (cargoType === 'isotank') {
                const cylR = Math.min(W, H) * 0.43 + p;
                const halfCyl = L * 0.46 + p;
                if (Math.abs(q.x) <= halfCyl) {
                    const rYZ = Math.hypot(q.y, q.z);
                    if (rYZ < cylR) {
                        if (rYZ > 1e-5) {
                            q.y *= (cylR + 0.004) / rYZ;
                            q.z *= (cylR + 0.004) / rYZ;
                        } else {
                            q.y = cylR + 0.004;
                        }
                    }
                }
                // Perimeter ISO frame rails & posts
                const railR = 0.08 + p;
                [-1, 1].forEach(sy => [-1, 1].forEach(sz => {
                    releaseLocalBox(q, 0, sy * (H * 0.5 - 0.08), sz * (W * 0.5 - 0.08), L * 0.5 + p, railR, railR, up);
                }));
                [-1, 1].forEach(sx => [-1, 1].forEach(sz => {
                    releaseLocalBox(q, sx * (L * 0.5 - 0.08), 0, sz * (W * 0.5 - 0.08), railR, H * 0.5 + p, railR, up);
                }));
                return q;
            }

            if (cargoType === 'car') {
                // Lifting frame + lower vehicle body + tapered greenhouse cabin
                releaseLocalBox(q, 0, -H * 0.5 + H * 0.28, 0, L * 0.49 + p, H * 0.28 + p, W * 0.48 + p, up);
                releaseLocalBox(q, -L * 0.05, H * 0.16, 0, L * 0.28 + p, H * 0.24 + p, W * 0.41 + p, up);
                return q;
            }

            if (cargoType === 'boat') {
                // Lifting cradle + deep-V hull + cabin superstructure
                releaseLocalBox(q, 0, -H * 0.5 + H * 0.28, 0, L * 0.48 + p, H * 0.28 + p, W * 0.48 + p, up);
                releaseLocalBox(q, -L * 0.06, H * 0.14, 0, L * 0.24 + p, H * 0.24 + p, W * 0.36 + p, up);
                return q;
            }

            if (cargoType === 'transformer') {
                const skidH = H * 0.12;
                releaseLocalBox(q, 0, -H * 0.5 + skidH * 0.5, 0, L * 0.5 + p, skidH * 0.5 + p, W * 0.5 + p, up);
                const tankL = L * 0.64, tankH = H * 0.64, tankW = W * 0.72;
                const tankX = L * 0.08, tankY = -H * 0.5 + skidH + tankH * 0.5;
                releaseLocalBox(q, tankX, tankY, 0, tankL * 0.5 + p, tankH * 0.5 + p, tankW * 0.5 + p, up);
                releaseLocalBox(q, L * 0.14, H * 0.36, W * 0.26, L * 0.25 + p, 0.29 + p, 0.29 + p, up);
                releaseLocalBox(q, -L * 0.34, tankY - tankH * 0.08, 0, L * 0.12 + p, tankH * 0.42 + p, tankW * 0.40 + p, up);
                return q;
            }

            // Default Rounded-Edge Industrial Box (Container, Crate, Skid, etc.)
            if (up) {
                releaseLocalBox(q, 0, 0, 0, L * 0.5 + p, H * 0.5 + p, W * 0.5 + p, true);
                return q;
            }
            const bevel = Math.min(0.06, Math.min(L, W, H) * 0.04);
            const coreHx = Math.max(0.05, L * 0.5 - bevel);
            const coreHy = Math.max(0.05, H * 0.5 - bevel);
            const coreHz = Math.max(0.05, W * 0.5 - bevel);
            const cx = THREE.MathUtils.clamp(q.x, -coreHx, coreHx);
            const cy = THREE.MathUtils.clamp(q.y, -coreHy, coreHy);
            const cz = THREE.MathUtils.clamp(q.z, -coreHz, coreHz);
            const dx = q.x - cx, dy = q.y - cy, dz = q.z - cz;
            const dist = Math.hypot(dx, dy, dz);
            const rad = bevel + p;
            if (dist < rad) {
                if (dist > 1e-5) {
                    const s = (rad + 0.004) / dist;
                    q.x = cx + dx * s;
                    q.y = cy + dy * s;
                    q.z = cz + dz * s;
                } else {
                    releaseLocalBox(q, 0, 0, 0, L * 0.5 + p, H * 0.5 + p, W * 0.5 + p, up);
                }
            }
            return q;
        }

        function pushOutOfCargoShellWorld(worldPt, pad, biasUp) {
            const invQ = phy.cargoQuat.clone().invert();
            const local = worldPt.clone().sub(phy.cargoPos).applyQuaternion(invQ);
            const pushedLocal = pushOutOfCargoShellLocal(local, pad, biasUp);
            if (pushedLocal.distanceToSquared(local) < 1e-10) return worldPt.clone();
            return pushedLocal.applyQuaternion(phy.cargoQuat).add(phy.cargoPos);
        }

        // Returns the highest world Y of the cargo's actual 3D outer shell at (worldX, worldZ)
        function cargoShellTopWorldY(worldX, worldZ, radiusMargin) {
            const r = Math.max(0, radiusMargin || 0);
            const samples = [[0, 0], [r, 0], [-r, 0], [0, r], [0, -r]];
            let maxY = -1e9;
            const testY = phy.cargoPos.y;
            const hasOog = (state.cargoType === 'flatrack' || state.cargoType === 'opentop') && state.oogHasCargo !== false;
            const maxHalfX = Math.max(state.L, hasOog ? (state.oogCargoL || state.L) : state.L) * 0.54 + 0.15;
            const maxHalfZ = Math.max(state.W, hasOog ? (state.oogCargoW || state.W) : state.W) * 0.54 + 0.15;
            const oogTopLocalY = -state.H * 0.5 + (state.cargoType === 'flatrack' ? 0.40 : 0.18) + (state.oogCargoH || state.H);
            const probeHeights = [
                -state.H * 0.5 + 0.12,
                0,
                state.H * 0.5 - 0.12
            ];
            if (hasOog) {
                probeHeights.push(oogTopLocalY - 0.12);
            }
            for (let i = 0; i < samples.length; i++) {
                const sx = worldX + samples[i][0];
                const sz = worldZ + samples[i][1];
                const probe = new THREE.Vector3(sx, testY, sz);
                const invQ = phy.cargoQuat.clone().invert();
                const loc = probe.sub(phy.cargoPos).applyQuaternion(invQ);
                if (Math.abs(loc.x) > maxHalfX || Math.abs(loc.z) > maxHalfZ) continue;
                let bestLocalY = -state.H * 0.5;
                for (let k = 0; k < probeHeights.length; k++) {
                    const py = probeHeights[k];
                    const pTest = new THREE.Vector3(loc.x, py, loc.z);
                    const outP = pushOutOfCargoShellLocal(pTest, 0.01);
                    if (outP.y > py + 1e-4 && outP.y > bestLocalY) {
                        bestLocalY = outP.y;
                    }
                }
                const wPt = new THREE.Vector3(loc.x, bestLocalY, loc.z).applyQuaternion(phy.cargoQuat).add(phy.cargoPos);
                if (wPt.y > maxY) maxY = wPt.y;
            }
            return maxY;
        }

        function releaseBox(q, center, quat, hx, hy, hz) {
            const local = q.clone().sub(center).applyQuaternion(quat.clone().invert());
            const dx = Math.abs(local.x) - hx;
            const dy = Math.abs(local.y) - hy;
            const dz = Math.abs(local.z) - hz;
            if (dx >= 0 || dy >= 0 || dz >= 0) return;
            let depth = -dx;
            const n = new THREE.Vector3(Math.sign(local.x) || 1, 0, 0);
            if (-dy < depth) { depth = -dy; n.set(0, Math.sign(local.y) || 1, 0); }
            if (-dz < depth) { depth = -dz; n.set(0, 0, Math.sign(local.z) || 1); }
            n.applyQuaternion(quat);
            q.addScaledVector(n, depth + 0.008);
        }

        function releaseCapsule(q, a, b, rad) {
            const ab = b.clone().sub(a);
            const len2 = Math.max(1e-8, ab.lengthSq());
            const t = THREE.MathUtils.clamp(q.clone().sub(a).dot(ab) / len2, 0, 1);
            const c = a.clone().addScaledVector(ab, t);
            const d = q.clone().sub(c);
            const dist = d.length();
            if (dist >= rad) return;
            const n = dist > 1e-6 ? d.multiplyScalar(1 / dist) : new THREE.Vector3(0, 1, 0);
            q.copy(c).addScaledVector(n, rad + 0.006);
        }

        function releaseSphere(q, x, y, z, rad) {
            const c = new THREE.Vector3(x, y, z);
            const d = q.clone().sub(c);
            const dist = d.length();
            if (dist >= rad) return;
            const n = dist > 1e-6 ? d.multiplyScalar(1 / dist) : new THREE.Vector3(0, 1, 0);
            q.copy(c).addScaledVector(n, rad + 0.006);
        }

        function endSolidId(end) {
            if (!end) return null;
            if (end.kind === 'cargo') return 'cargo';
            if (end.kind === 'hook') return 'hook';
            if (end.kind === 'body') {
                const id = end.id || (end.body && end.body.id);
                return id ? 'beam:' + id : null;
            }
            return null;
        }

        function cargoLocalFromWorld(worldPt) {
            return worldPt.clone().sub(phy.cargoPos).applyQuaternion(phy.cargoQuat.clone().invert());
        }

        function cargoWorldFromLocal(localPt) {
            return localPt.clone().applyQuaternion(phy.cargoQuat).add(phy.cargoPos);
        }

        // Outer box the rope can lie on (Flat Rack OOG, Open Top, or generic container) — local cargo frame
        function cargoWrapSolid(pad) {
            const p = Math.max(0.02, pad || 0.03);
            const { cargoType, L, W, H } = state;
            if (cargoType === 'flatrack') {
                const hasCargo = state.oogHasCargo !== false;
                const st = phy.oogState ? phy.oogState.status : 'secured';
                const deckTopY = -H * 0.5 + 0.30;
                if (hasCargo && st !== 'falling' && st !== 'grounded') {
                    const cL = THREE.MathUtils.clamp(state.oogCargoL || L * 0.72, 1.5, 14.5);
                    const cW = THREE.MathUtils.clamp(state.oogCargoW || W * 1.28, 1.0, 5.2);
                    const cH = THREE.MathUtils.clamp(state.oogCargoH || H * 1.08, 0.8, 4.8);
                    const dunnageTopY = deckTopY + 0.10;
                    return {
                        ox: (st === 'sliding' && phy.oogState) ? phy.oogState.localPos.x : 0,
                        oy: dunnageTopY + cH * 0.5,
                        oz: (st === 'sliding' && phy.oogState) ? phy.oogState.localPos.z : 0,
                        hx: cL * 0.5 + p,
                        hy: cH * 0.5 + p,
                        hz: cW * 0.5 + p,
                        roofY: dunnageTopY + cH + p,
                        bottomY: dunnageTopY + p
                    };
                }
                return {
                    ox: 0,
                    oy: -H * 0.5 + 0.15,
                    oz: 0,
                    hx: L * 0.5 + p,
                    hy: 0.15 + p,
                    hz: W * 0.5 + p,
                    roofY: deckTopY + p,
                    bottomY: -H * 0.5 + p
                };
            }
            if (cargoType === 'opentop') {
                const floorTopY = -H * 0.5 + 0.18;
                const hasCargo = state.oogHasCargo !== false;
                const hasTarp = state.oogTarp !== false;
                const cL = THREE.MathUtils.clamp(state.oogCargoL || L * 0.84, 1.2, L - 0.22);
                const cW = THREE.MathUtils.clamp(state.oogCargoW || W * 0.88, 0.9, W - 0.16);
                const cH = THREE.MathUtils.clamp(state.oogCargoH || H * 1.15, 0.6, 4.8);
                const cargoPeakY = floorTopY + cH;
                if (hasTarp) {
                    const bulge = (hasCargo && cargoPeakY > H * 0.5 - 0.05)
                        ? Math.max(0, cargoPeakY - H * 0.5 + 0.06)
                        : 0.04;
                    return {
                        ox: 0, oy: 0, oz: 0,
                        hx: L * 0.5 + p,
                        hy: H * 0.5 + bulge * 0.5 + p,
                        hz: W * 0.5 + p,
                        roofY: H * 0.5 + bulge + p,
                        bottomY: -H * 0.5 + p
                    };
                }
                if (hasCargo) {
                    return {
                        ox: 0,
                        oy: floorTopY + cH * 0.5,
                        oz: 0,
                        hx: cL * 0.5 + p,
                        hy: cH * 0.5 + p,
                        hz: cW * 0.5 + p,
                        roofY: cargoPeakY + p,
                        bottomY: floorTopY + p
                    };
                }
                return {
                    ox: 0,
                    oy: -H * 0.5 + 0.09,
                    oz: 0,
                    hx: L * 0.5 + p,
                    hy: 0.09 + p,
                    hz: W * 0.5 + p,
                    roofY: floorTopY + p,
                    bottomY: -H * 0.5 + p
                };
            }
            if (cargoType === 'platform') {
                const deckH = Math.max(0.22, H * 0.55);
                return {
                    ox: 0,
                    oy: -H * 0.5 + deckH * 0.5,
                    oz: 0,
                    hx: L * 0.5 + p,
                    hy: deckH * 0.5 + p,
                    hz: W * 0.5 + p,
                    roofY: -H * 0.5 + deckH + p,
                    bottomY: -H * 0.5 + p
                };
            }
            return {
                ox: 0, oy: 0, oz: 0,
                hx: L * 0.5 + p, hy: H * 0.5 + p, hz: W * 0.5 + p,
                roofY: H * 0.5 + p,
                bottomY: -H * 0.5 + p
            };
        }

        // Returns the local height (Y) of the solid roof / cargo surface at (lx, lz)
        function cargoLocalRoofY(lx, lz, pad) {
            const p = Math.max(0.015, pad || 0.025);
            const { cargoType, L, W, H } = state;

            if (cargoType === 'opentop') {
                const floorTopY = -H * 0.5 + 0.18;
                const hasCargo = state.oogHasCargo !== false;
                const hasTarp = state.oogTarp !== false;
                const cL = THREE.MathUtils.clamp(state.oogCargoL || L * 0.84, 1.2, L - 0.22);
                const cW = THREE.MathUtils.clamp(state.oogCargoW || W * 0.88, 0.9, W - 0.16);
                const cH = THREE.MathUtils.clamp(state.oogCargoH || H * 1.15, 0.6, 4.8);
                const cargoPeakY = floorTopY + cH;

                if (Math.abs(lx) > L * 0.5 + p || Math.abs(lz) > W * 0.5 + p) return null;

                if (hasTarp) {
                    const ux = Math.max(0, 1 - Math.pow(lx / Math.max(0.4, (L * 0.48)), 2));
                    const uz = Math.max(0, 1 - Math.pow(lz / Math.max(0.3, (W * 0.48)), 2));
                    const cxNorm = Math.max(0, 1 - Math.pow(lx / Math.max(0.35, cL * 0.54), 2));
                    const czNorm = Math.max(0, 1 - Math.pow(lz / Math.max(0.30, cW * 0.54), 2));
                    const bulge = (hasCargo && cargoPeakY > H * 0.5 - 0.05)
                        ? Math.max(0, cargoPeakY - H * 0.5 + 0.06) * Math.pow(cxNorm * czNorm, 0.65)
                        : 0.04 * ux * uz;
                    return H * 0.5 + bulge + p;
                }

                if (hasCargo && Math.abs(lx) <= cL * 0.5 + p && Math.abs(lz) <= cW * 0.5 + p) {
                    return cargoPeakY + p;
                }

                const wallThick = 0.08 + p;
                const nearRim = (Math.abs(lx) >= L * 0.5 - wallThick) || (Math.abs(lz) >= W * 0.5 - wallThick);
                if (nearRim) return H * 0.5 + p;

                return floorTopY + p;
            }

            if (cargoType === 'flatrack') {
                const deckTopY = -H * 0.5 + 0.30;
                const hasCargo = state.oogHasCargo !== false;
                const st = phy.oogState ? phy.oogState.status : 'secured';
                if (hasCargo && st !== 'falling' && st !== 'grounded') {
                    const ox = (st === 'sliding' && phy.oogState) ? phy.oogState.localPos.x : 0;
                    const oz = (st === 'sliding' && phy.oogState) ? phy.oogState.localPos.z : 0;
                    const cL = THREE.MathUtils.clamp(state.oogCargoL || L * 0.72, 1.5, 14.5);
                    const cW = THREE.MathUtils.clamp(state.oogCargoW || W * 1.28, 1.0, 5.2);
                    const cH = THREE.MathUtils.clamp(state.oogCargoH || H * 1.08, 0.8, 4.8);
                    const dunnageTopY = deckTopY + 0.10;
                    if (Math.abs(lx - ox) <= cL * 0.5 + p && Math.abs(lz - oz) <= cW * 0.5 + p) {
                        return dunnageTopY + cH + p;
                    }
                }
                if (Math.abs(lx) > L * 0.5 + p || Math.abs(lz) > W * 0.5 + p) return null;
                if (Math.abs(lx) >= L * 0.5 - 0.22 - p) return H * 0.5 + p;
                return deckTopY + p;
            }

            if (cargoType === 'vessel' || cargoType === 'pipe') {
                const radius = Math.min(W, H) * 0.42 + 0.022;
                const cylLen = Math.max(1.2, L - Math.min(W, H) * 0.42 * 1.5);
                const shellCenterY = H * 0.06;
                if (Math.abs(lx) <= cylLen * 0.5 + radius + p && Math.abs(lz) <= radius + p) {
                    const r2 = (radius + p) * (radius + p) - lz * lz;
                    let topY = shellCenterY + (r2 > 0 ? Math.sqrt(r2) : 0);
                    [-0.28, 0, 0.28].forEach((xf, idx) => {
                        const nx = xf * cylLen;
                        const nozR = (idx === 1 ? 0.22 : 0.14) * 1.45 + p;
                        if (Math.hypot(lx - nx, lz) <= nozR) {
                            topY = Math.max(topY, shellCenterY + radius + 0.36 + p);
                        }
                    });
                    return topY;
                }
                return null;
            }

            if (cargoType === 'platform') {
                if (Math.abs(lx) <= L * 0.5 + p && Math.abs(lz) <= W * 0.5 + p) {
                    const deckH = Math.max(0.22, H * 0.55);
                    return -H * 0.5 + deckH + p;
                }
                return null;
            }

            // Closed containers & crates: solid top roof across full L x W footprint
            if (Math.abs(lx) <= L * 0.5 + p && Math.abs(lz) <= W * 0.5 + p) {
                return H * 0.5 + p;
            }
            return null;
        }

        // Exact world Y of the solid cargo roof/surface at (worldX, worldZ)
        function cargoRoofAtXZ(worldX, worldZ, pad) {
            const loc0 = cargoLocalFromWorld(new THREE.Vector3(worldX, phy.cargoPos.y, worldZ));
            const ly0 = cargoLocalRoofY(loc0.x, loc0.z, pad);
            if (ly0 == null) return null;
            const wPt0 = cargoWorldFromLocal(new THREE.Vector3(loc0.x, ly0, loc0.z));
            const loc1 = cargoLocalFromWorld(new THREE.Vector3(worldX, wPt0.y, worldZ));
            const ly1 = cargoLocalRoofY(loc1.x, loc1.z, pad);
            if (ly1 != null) {
                return cargoWorldFromLocal(new THREE.Vector3(loc1.x, ly1, loc1.z)).y;
            }
            return wPt0.y;
        }

        function liftRopeOntoCargoRoof(worldPt, pad) {
            const p = Math.max(0.02, pad || 0.028);
            const q = worldPt.clone();
            const solid = cargoWrapSolid(p);
            const invQ = phy.cargoQuat.clone().invert();
            const loc = q.clone().sub(phy.cargoPos).applyQuaternion(invQ);

            if (!solid || loc.y < solid.bottomY - 0.15) return q;

            // Side-hug: below the lid and near/outside a vertical face → push OUT the wall, do NOT climb to roof
            if (loc.y < solid.roofY - 0.05) {
                const ax = Math.abs(loc.x - solid.ox);
                const az = Math.abs(loc.z - solid.oz);
                const inX = ax <= solid.hx + p * 1.25;
                const inZ = az <= solid.hz + p * 1.25;
                const nearFaceX = inZ && ax >= solid.hx - p * 2.2;
                const nearFaceZ = inX && az >= solid.hz - p * 2.2;
                if (nearFaceX || nearFaceZ) {
                    if (nearFaceX && (!nearFaceZ || (solid.hx - ax) <= (solid.hz - az))) {
                        loc.x = solid.ox + Math.sign(loc.x - solid.ox || 1) * (solid.hx + p * 0.55);
                    } else {
                        loc.z = solid.oz + Math.sign(loc.z - solid.oz || 1) * (solid.hz + p * 0.55);
                    }
                    loc.y = Math.max(loc.y, solid.bottomY);
                    return loc.applyQuaternion(phy.cargoQuat).add(phy.cargoPos);
                }
            }

            const roofY = cargoRoofAtXZ(q.x, q.z, p);
            if (roofY != null && q.y < roofY) q.y = roofY;
            const loc2 = q.clone().sub(phy.cargoPos).applyQuaternion(invQ);
            const nearVol = Math.abs(loc2.x - solid.ox) <= solid.hx + 1.2
                && Math.abs(loc2.z - solid.oz) <= solid.hz + 1.2;
            if (nearVol) {
                loc2.copy(pushOutOfCargoShellLocal(loc2, p, true));
                const w2 = loc2.clone().applyQuaternion(phy.cargoQuat).add(phy.cargoPos);
                if (roofY != null && w2.y < roofY) w2.y = roofY;
                return w2;
            }
            return q;
        }

        function pushPointClear(p, rad, skip) {
            const q = p.clone();
            const skipSet = skip || new Set();
            const ropePad = Math.max(0.028, rad || 0.024);
            for (let n = 0; n < 2; n++) {
                if (!skipSet.has('cargo')) q.copy(liftRopeOntoCargoRoof(q, ropePad));
                (phy.beams || []).forEach(b => {
                    if (skipSet.has('beam:' + b.id)) return;
                    const segments = typeof beamSegments === 'function' ? beamSegments(b) : [segmentEnds(b)];
                    segments.forEach(ends => {
                        const beamRadius = typeof beamCollisionRadius === 'function'
                            ? beamCollisionRadius(b)
                            : (b.radius || 0.12);
                        releaseCapsule(q, ends[0], ends[1], beamRadius + ropePad);
                    });
                });
                if (!skipSet.has('hook')) {
                    releaseSphere(q, phy.hookPos.x, phy.hookPos.y + 0.36, phy.hookPos.z, 0.24 + ropePad);
                    releaseSphere(q, phy.hookPos.x, phy.hookPos.y - 0.20, phy.hookPos.z, 0.14 + ropePad);
                }
                const floor = supportY(q.x, q.z) + ropePad;
                if (q.y < floor) q.y = floor;
                if (!skipSet.has('cargo')) {
                    const solid = cargoWrapSolid(ropePad);
                    const loc = cargoLocalFromWorld(q);
                    if (solid && loc.y >= solid.bottomY - 0.15) {
                        const roofY = cargoRoofAtXZ(q.x, q.z, ropePad);
                        if (roofY != null && q.y < roofY) q.y = roofY;
                    }
                }
            }
            return q;
        }

        function chordNeedsRoofDrape(a, b, samples, pad) {
            const n = Math.max(8, samples | 0);
            const p = Math.max(0.025, pad || 0.03);
            const solid = cargoWrapSolid(p);
            if (!solid) return false;
            for (let i = 1; i < n; i++) {
                const w = new THREE.Vector3().lerpVectors(a, b, i / n);
                const loc = cargoLocalFromWorld(w);
                if (loc.y < solid.bottomY - 0.10) continue;
                const roofY = cargoRoofAtXZ(w.x, w.z, p);
                if (roofY != null && w.y < roofY + 0.02) return true;
            }
            return false;
        }

        function ropeSkip(p, ends, allowA, allowB) {
            // Only ignore the attached solid near its own pin — mid-span must still clear the beam/cargo
            const skip = new Set();
            const near2 = 0.40 * 0.40;
            if (ends && ends[0] && p.distanceToSquared(ends[0]) < near2) {
                (allowA || []).forEach(id => { if (id && id !== 'cargo') skip.add(id); });
            }
            if (ends && ends[1] && p.distanceToSquared(ends[1]) < near2) {
                (allowB || []).forEach(id => { if (id && id !== 'cargo') skip.add(id); });
            }
            return skip;
        }

        function keepRopeClear(pts, rad, allowA, allowB) {
            if (!pts || pts.length < 2) return pts || [];
            const ends = [pts[0].clone(), pts[pts.length - 1].clone()];
            const out = pts.map(p => p.clone());
            for (let pass = 0; pass < 3; pass++) {
                for (let i = 1; i < out.length - 1; i++) {
                    out[i] = pushPointClear(out[i], rad, ropeSkip(out[i], ends, allowA, allowB));
                }
            }
            out[0].copy(ends[0]);
            out[out.length - 1].copy(ends[1]);
            return out;
        }

        function settleRope(pts, rad, allowA, allowB) {
            if (!pts || pts.length < 3) return pts;
            const ends = [pts[0].clone(), pts[pts.length - 1].clone()];
            for (let pass = 0; pass < 3; pass++) {
                for (let i = 1; i < pts.length - 1; i++) {
                    pts[i] = pushPointClear(pts[i], rad, ropeSkip(pts[i], ends, allowA, allowB));
                }
            }
            pts[0].copy(ends[0]);
            pts[pts.length - 1].copy(ends[1]);
            return pts;
        }

        // Node-only tests miss a common failure mode: a rendered segment can pass
        // through a beam while both end nodes are outside it. Route every crossing
        // around the beam's outer capsule, with a small bridge over its upper skin.
        function routeRopeAroundBeams(pts, rad, allowA, allowB) {
            if (!pts || pts.length < 2) return pts || [];
            const ends = [pts[0].clone(), pts[pts.length - 1].clone()];
            let out = pts.map(p => p.clone());
            const ropeRadius = Math.max(0.012, rad || 0.024);

            for (let pass = 0; pass < 2; pass++) {
                const next = [out[0].clone()];
                let changed = false;
                for (let i = 0; i < out.length - 1; i++) {
                    const a = out[i];
                    const b = out[i + 1];
                    const mid = a.clone().lerp(b, 0.5);
                    const skip = ropeSkip(mid, ends, allowA, allowB);
                    let best = null;

                    (phy.beams || []).forEach(beam => {
                        if (skip.has('beam:' + beam.id)) return;
                        const beamRadius = typeof beamCollisionRadius === 'function'
                            ? beamCollisionRadius(beam)
                            : (beam.radius || 0.12);
                        const need = beamRadius + ropeRadius;
                        const segments = typeof beamSegments === 'function' ? beamSegments(beam) : [segmentEnds(beam)];
                        segments.forEach(segment => {
                            const hit = closestOnSegments(a, b, segment[0], segment[1]);
                            const distance = hit.pa.distanceTo(hit.pb);
                            if (distance >= need || (best && distance >= best.distance)) return;
                            const up = new THREE.Vector3(0, 1, 0).applyQuaternion(beam.q).normalize();
                            let normal = distance > 1e-5
                                ? hit.pa.clone().sub(hit.pb).multiplyScalar(1 / distance)
                                : up.clone();
                            // A rope landing on steel takes the upper external path;
                            // this avoids a visually implausible under-cut through it.
                            if (normal.dot(up) < 0.25) normal = up;
                            best = { hit, distance, need, normal };
                        });
                    });

                    if (best) {
                        const direction = b.clone().sub(a);
                        if (direction.lengthSq() > 1e-8) direction.normalize();
                        else direction.set(1, 0, 0);
                        const crest = best.hit.pb.clone().addScaledVector(best.normal, best.need + 0.006);
                        const run = Math.min(Math.max(0.05, best.need * 1.15), a.distanceTo(b) * 0.42);
                        const pre = crest.clone().addScaledVector(direction, -run);
                        const post = crest.clone().addScaledVector(direction, run);
                        next.push(pre, crest, post);
                        changed = true;
                    }
                    next.push(b.clone());
                }
                out = next;
                for (let i = 1; i < out.length - 1; i++) {
                    out[i] = pushPointClear(out[i], ropeRadius, ropeSkip(out[i], ends, allowA, allowB));
                }
                out[0].copy(ends[0]);
                out[out.length - 1].copy(ends[1]);
                if (!changed) break;
            }
            return out;
        }

        function trimRopeLength(pts, maxLen) {
            if (!pts || pts.length < 2) return { pts: pts || [], reached: true };
            const out = [pts[0].clone()];
            let acc = 0;
            for (let i = 1; i < pts.length; i++) {
                const step = pts[i].distanceTo(out[out.length - 1]);
                if (acc + step > maxLen + 1e-4) {
                    const t = (maxLen - acc) / Math.max(1e-6, step);
                    out.push(out[out.length - 1].clone().lerp(pts[i], THREE.MathUtils.clamp(t, 0, 1)));
                    return { pts: out, reached: false };
                }
                acc += step;
                out.push(pts[i].clone());
            }
            return { pts: out, reached: true };
        }

        // Force polyline arc length ≈ L0 with ends pinned (inextensible sling).
        // Too long → take up toward chord; too short → deepen catenary belly.
        function fitPathToFixedLength(pts, pointA, pointB, L0, solid, pad) {
            if (!pts || pts.length < 3) return pts || [];
            const N = pts.length - 1;
            const chord = Math.max(0.001, pointA.distanceTo(pointB));
            const target = Math.max(chord + 0.002, L0 || chord);
            const out = pts.map(p => p.clone());
            out[0].copy(pointA);
            out[N].copy(pointB);

            const measure = arr => {
                let a = 0;
                for (let i = 1; i < arr.length; i++) a += arr[i].distanceTo(arr[i - 1]);
                return a;
            };

            // Straight reference (clear of lid if needed)
            const str = [];
            for (let i = 0; i <= N; i++) {
                const p = new THREE.Vector3().lerpVectors(pointA, pointB, i / N);
                if (solid) {
                    const roofY = cargoRoofAtXZ(p.x, p.z, pad * 0.35);
                    if (roofY != null && p.y < roofY) p.y = roofY;
                }
                str.push(p);
            }
            str[0].copy(pointA);
            str[N].copy(pointB);

            let len = measure(out);
            // Path longer than L0: blend toward straight until arc ≈ L0
            if (len > target + 0.02) {
                let lo = 0;
                let hi = 1;
                for (let k = 0; k < 14; k++) {
                    const mid = 0.5 * (lo + hi);
                    for (let i = 1; i < N; i++) {
                        out[i].copy(pts[i]).lerp(str[i], mid);
                    }
                    out[0].copy(pointA);
                    out[N].copy(pointB);
                    len = measure(out);
                    if (len > target) lo = mid;
                    else hi = mid;
                }
                const blend = 0.5 * (lo + hi);
                for (let i = 1; i < N; i++) out[i].copy(pts[i]).lerp(str[i], blend);
            } else if (len < target - 0.02) {
                // Path shorter than L0: deepen gravity belly until arc ≈ L0
                let lo = 0;
                let hi = Math.max(0.15, (target - chord) * 0.85);
                for (let k = 0; k < 12; k++) {
                    const sag = 0.5 * (lo + hi);
                    for (let i = 1; i < N; i++) {
                        const t = i / N;
                        out[i].copy(pts[i]);
                        out[i].y -= sag * Math.sin(t * Math.PI);
                        if (solid) {
                            const roofY = cargoRoofAtXZ(out[i].x, out[i].z, pad * 0.35);
                            if (roofY != null && out[i].y < roofY) out[i].y = roofY;
                        }
                    }
                    out[0].copy(pointA);
                    out[N].copy(pointB);
                    len = measure(out);
                    if (len < target) lo = sag;
                    else hi = sag;
                }
            }
            out[0].copy(pointA);
            out[N].copy(pointB);
            // Final equalize: pull/push mid points along chain to hit L0 within ~1 cm
            len = measure(out);
            if (Math.abs(len - target) > 0.015 && len > 1e-4) {
                const scale = target / len;
                // Radial scale of offsets from chord — preserves shape family, hits length
                for (let i = 1; i < N; i++) {
                    const onChord = new THREE.Vector3().lerpVectors(pointA, pointB, i / N);
                    out[i].sub(onChord).multiplyScalar(scale).add(onChord);
                    if (solid) {
                        const roofY = cargoRoofAtXZ(out[i].x, out[i].z, pad * 0.35);
                        if (roofY != null && out[i].y < roofY) out[i].y = roofY;
                    }
                }
                out[0].copy(pointA);
                out[N].copy(pointB);
                // One more blend if still long (roof glue can re-lengthen)
                len = measure(out);
                if (len > target + 0.02) {
                    const t = THREE.MathUtils.clamp(1 - target / len, 0, 0.85);
                    for (let i = 1; i < N; i++) {
                        const onChord = new THREE.Vector3().lerpVectors(pointA, pointB, i / N);
                        out[i].lerp(onChord, t * 0.65);
                    }
                    out[0].copy(pointA);
                    out[N].copy(pointB);
                }
            }
            return out;
        }

        function resamplePolyline(ctrl, count) {
            if (!ctrl || ctrl.length < 2) return ctrl || [];
            const N = Math.max(2, count | 0);
            const acc = [0];
            for (let i = 1; i < ctrl.length; i++) acc.push(acc[i - 1] + ctrl[i].distanceTo(ctrl[i - 1]));
            const total = acc[acc.length - 1];
            const out = [ctrl[0].clone()];
            if (total < 1e-6) {
                for (let i = 1; i <= N; i++) out.push(ctrl[ctrl.length - 1].clone());
                return out;
            }
            let k = 1;
            for (let i = 1; i < N; i++) {
                const d = total * (i / N);
                while (k < acc.length - 1 && acc[k] < d) k++;
                const span = Math.max(1e-6, acc[k] - acc[k - 1]);
                out.push(ctrl[k - 1].clone().lerp(ctrl[k], THREE.MathUtils.clamp((d - acc[k - 1]) / span, 0, 1)));
            }
            out.push(ctrl[ctrl.length - 1].clone());
            return out;
        }

        // 0 = fully slack (drape/hang), 1 = pulled to working length (straight)
        function ropeTautness(chord, L0, tension, swl) {
            const rest = Math.max(0.2, L0 || chord);
            const c = Math.max(0.001, chord);
            if (c >= rest - 0.018) return 1.0;
            // Length-driven: sag vanishes only as chord approaches L0
            const slackFrac = THREE.MathUtils.clamp((rest - c) / Math.max(0.12, rest * 0.42), 0, 1);
            const lengthTaut = 1 - slackFrac;
            // Load-driven: tension gradually takes up remaining belly (never beyond length allow)
            const loadTaut = THREE.MathUtils.clamp((tension || 0) / Math.max(0.06, (swl || 5) * 0.1), 0, 1);
            const t = THREE.MathUtils.clamp(lengthTaut * (0.55 + 0.45 * loadTaut), 0, 1);
            // Smoothstep for "từ từ căng"
            return t * t * (3 - 2 * t);
        }

        function polylineLength(pts) {
            let acc = 0;
            for (let i = 1; i < pts.length; i++) acc += pts[i].distanceTo(pts[i - 1]);
            return acc;
        }

        // Heavy steel wire: min bend radius ≈ 8–12× rope diameter (no sharp folds)
        function ropeMinBendRadius(ropeR, meta) {
            const dia = Math.max(0.014, (ropeR || 0.024) * 2);
            const stiff = (meta && (meta.grade === 'g80' || meta.grade === 'g100')) ? 6.5 : 10.0;
            return THREE.MathUtils.clamp(dia * stiff, 0.16, 0.42);
        }

        function enforceMinBendRadius(pts, minR) {
            if (!pts || pts.length < 3 || !(minR > 0.05)) return pts;
            for (let pass = 0; pass < 2; pass++) {
                for (let i = 1; i < pts.length - 1; i++) {
                    const a = pts[i - 1];
                    const b = pts[i];
                    const c = pts[i + 1];
                    const ba = new THREE.Vector3().subVectors(a, b);
                    const bc = new THREE.Vector3().subVectors(c, b);
                    const la = ba.length();
                    const lc = bc.length();
                    if (la < 1e-5 || lc < 1e-5) continue;
                    ba.multiplyScalar(1 / la);
                    bc.multiplyScalar(1 / lc);
                    const cos = THREE.MathUtils.clamp(ba.dot(bc), -1, 1);
                    const ang = Math.acos(cos);
                    const turn = Math.PI - ang;
                    const maxTurn = Math.min(1.15, ((la + lc) * 0.5) / minR);
                    if (turn <= maxTurn + 0.02) continue;
                    // Flatten toward chord — increases local R
                    const mid = a.clone().lerp(c, 0.5);
                    const t = THREE.MathUtils.clamp(1 - maxTurn / Math.max(1e-4, turn), 0.1, 0.72);
                    b.lerp(mid, t * 0.62);
                }
            }
            return pts;
        }

        // Hard eject any sample still inside the cargo AABB (no tunneling)
        function ejectFromCargoSolid(worldPt, pad, solid) {
            if (!solid) return worldPt.clone();
            const p = Math.max(0.03, pad || 0.03);
            const loc = cargoLocalFromWorld(worldPt);
            const dx = Math.abs(loc.x - solid.ox) - solid.hx;
            const dy = Math.abs(loc.y - solid.oy) - solid.hy;
            const dz = Math.abs(loc.z - solid.oz) - solid.hz;
            if (dx >= 0 || dy >= 0 || dz >= 0) {
                // Outside — still keep clear of lid if sitting in footprint below roof
                if (dx <= 0 && dz <= 0 && loc.y < solid.roofY && (solid.roofY - loc.y) < 2.2) {
                    loc.y = solid.roofY;
                    return cargoWorldFromLocal(loc);
                }
                return worldPt.clone();
            }
            // Inside: push out nearest face (prefer roof when in upper half)
            let depth = -dx;
            let nx = Math.sign(loc.x - solid.ox) || 1, ny = 0, nz = 0;
            if (-dy < depth) { depth = -dy; nx = 0; ny = Math.sign(loc.y - solid.oy) || 1; nz = 0; }
            if (-dz < depth) { depth = -dz; nx = 0; ny = 0; nz = Math.sign(loc.z - solid.oz) || 1; }
            if (loc.y >= solid.oy - solid.hy * 0.05 && -dy <= depth * 1.35 + 0.02) {
                depth = -dy; nx = 0; ny = 1; nz = 0;
            }
            loc.x += nx * (depth + p);
            loc.y += ny * (depth + p);
            loc.z += nz * (depth + p);
            return cargoWorldFromLocal(loc);
        }

        // Corner/edge drape under gravity: sit ON the lid, large-R roll, then catenary belly to B
        function seedSurfaceDrape(pointA, pointB, solid, pad, targetLen, minBendR) {
            const locA = cargoLocalFromWorld(pointA);
            const locB = cargoLocalFromWorld(pointB);
            const R = Math.max(0.20, minBendR || 0.24);
            // Touch height = lid (solid.roofY already includes rope pad) — no extra float
            const sitY = solid.roofY;

            // Drop point on lid under A (or nearest inboard point if A is outside)
            const roofStart = new THREE.Vector3(
                THREE.MathUtils.clamp(locA.x, solid.ox - solid.hx + R * 0.2, solid.ox + solid.hx - R * 0.2),
                sitY,
                THREE.MathUtils.clamp(locA.z, solid.oz - solid.hz + R * 0.2, solid.oz + solid.hz - R * 0.2)
            );

            // Edge facing B (or the outer face if B is still over the lid)
            const aimX = locB.x - solid.ox;
            const aimZ = locB.z - solid.oz;
            let edge = new THREE.Vector3();
            let outN = new THREE.Vector3();
            // Prefer the edge that the A→B chord actually crosses
            const fromOutside = Math.abs(locA.x - solid.ox) > solid.hx - 0.05 || Math.abs(locA.z - solid.oz) > solid.hz - 0.05;
            if (Math.abs(aimX) * solid.hz >= Math.abs(aimZ) * solid.hx) {
                const sx = Math.sign(aimX) || (fromOutside ? Math.sign(locA.x - solid.ox) || 1 : 1);
                edge.set(
                    solid.ox + sx * solid.hx,
                    sitY,
                    THREE.MathUtils.clamp(0.65 * locB.z + 0.35 * locA.z, solid.oz - solid.hz + R * 0.15, solid.oz + solid.hz - R * 0.15)
                );
                outN.set(sx, 0, 0);
            } else {
                const sz = Math.sign(aimZ) || 1;
                edge.set(
                    THREE.MathUtils.clamp(0.65 * locB.x + 0.35 * locA.x, solid.ox - solid.hx + R * 0.15, solid.ox + solid.hx - R * 0.15),
                    sitY,
                    solid.oz + sz * solid.hz
                );
                outN.set(0, 0, sz);
            }

            const filletIn = edge.clone().addScaledVector(outN, -R);
            filletIn.y = sitY;
            const leave = edge.clone().addScaledVector(outN, R * 0.15);
            leave.y = sitY - R; // bottom of fillet — leave point toward B
            // If B is still near the lid, leave toward B at sit height instead of diving the full R
            if (locB.y > sitY - R * 0.6) {
                leave.y = Math.min(sitY - 0.04, locB.y + 0.02);
                leave.addScaledVector(outN, pad * 0.5);
            }

            const wRoof = cargoWorldFromLocal(roofStart);
            const wFilletIn = cargoWorldFromLocal(filletIn);
            const wLeave = cargoWorldFromLocal(leave);

            // Supported length (no free belly yet)
            let supported = pointA.distanceTo(wRoof) + wRoof.distanceTo(wFilletIn) + (Math.PI * 0.5 * R);
            const freeChord = wLeave.distanceTo(pointB);
            const hangBudget = Math.max(0, targetLen - supported - freeChord);

            const ctrl = [pointA.clone()];

            // A → lid: soft drop with gravity belly, then sit ON the roof
            for (let i = 1; i <= 5; i++) {
                const t = i / 5;
                const p = pointA.clone().lerp(wRoof, t);
                // Free-air sag before touchdown
                const slackDrop = Math.max(0, pointA.y - sitY);
                if (t < 1 && slackDrop > 0.05) {
                    p.y -= Math.min(slackDrop * 0.35, hangBudget * 0.15 + 0.08) * Math.sin(t * Math.PI);
                }
                const roofY = cargoRoofAtXZ(p.x, p.z, pad * 0.5);
                if (roofY != null && t > 0.45) p.y = Math.max(p.y, roofY);
                ctrl.push(p);
            }
            ctrl[ctrl.length - 1].copy(wRoof);

            // Across lid to fillet — keep glued to sitY (đúng trọng lực: nằm trên nóc)
            for (let i = 1; i <= 6; i++) {
                const p = wRoof.clone().lerp(wFilletIn, i / 6);
                const roofY = cargoRoofAtXZ(p.x, p.z, pad * 0.5);
                p.y = roofY != null ? roofY : sitY;
                // Tiny mid-span belly on long lid runs
                if (i > 0 && i < 6 && hangBudget > 0.2) {
                    p.y -= 0.02 * Math.sin((i / 6) * Math.PI);
                    if (roofY != null) p.y = Math.max(p.y, roofY - 0.005);
                }
                ctrl.push(p);
            }

            // Large-R corner roll — steel cable rests on the edge, never sharp fold
            const arcN = 10;
            for (let i = 1; i <= arcN; i++) {
                const t = i / arcN;
                const ang = t * Math.PI * 0.5;
                const loc = filletIn.clone();
                loc.addScaledVector(outN, R * (1 - Math.cos(ang)));
                loc.y = sitY - R * Math.sin(ang);
                ctrl.push(cargoWorldFromLocal(loc));
            }
            ctrl[ctrl.length - 1].copy(wLeave);

            // Free span leave → B: true catenary belly (độ võng theo trọng lực)
            const freeLen = Math.max(freeChord, freeChord + hangBudget);
            const freeCat = catenaryPoints(wLeave, pointB, freeLen, 12);
            if (freeCat && freeCat.length > 2) {
                for (let i = 1; i < freeCat.length; i++) ctrl.push(freeCat[i]);
            } else {
                const sag = Math.min(hangBudget * 0.5, Math.max(0.12, hangBudget * 0.4));
                for (let i = 1; i <= 8; i++) {
                    const t = i / 8;
                    const p = wLeave.clone().lerp(pointB, t);
                    p.y -= sag * Math.sin(t * Math.PI);
                    ctrl.push(p);
                }
                ctrl[ctrl.length - 1].copy(pointB);
            }
            return ctrl;
        }

        // Soft settle: gravity belly + sit on lid/edge + bend stiffness
        function settleSoftRope(pts, targetLen, pad, ends, allowA, allowB, gravityScale, solid, minBendR) {
            if (!pts || pts.length < 3) return pts;
            const n = pts.length - 1;
            const segLen = targetLen / n;
            const g = 0.12 * THREE.MathUtils.clamp(gravityScale == null ? 1 : gravityScale, 0, 1.6);
            const iters = solid ? 5 : 2;
            for (let it = 0; it < iters; it++) {
                // Gravity — deepen the võng
                for (let i = 1; i < pts.length - 1; i++) {
                    pts[i].y -= g * (0.7 + 0.45 * Math.sin((i / n) * Math.PI));
                }
                for (let i = 1; i < pts.length - 1; i++) {
                    // Over the lid footprint: glue down onto the roof (contact), don't float
                    if (solid) {
                        const roofY = cargoRoofAtXZ(pts[i].x, pts[i].z, pad * 0.35);
                        if (roofY != null) {
                            if (pts[i].y < roofY + 0.35) pts[i].y = Math.max(pts[i].y, roofY);
                            // If settle pulled below, sit on lid
                            if (pts[i].y < roofY) pts[i].y = roofY;
                        } else {
                            pts[i] = ejectFromCargoSolid(pts[i], pad * 0.7, solid);
                        }
                    }
                    pts[i] = pushPointClear(pts[i], pad * 0.7, ropeSkip(pts[i], ends, allowA, allowB));
                }
                for (let pass = 0; pass < 2; pass++) {
                    for (let i = 0; i < n; i++) {
                        const a = pts[i];
                        const b = pts[i + 1];
                        const dx = b.x - a.x, dy = b.y - a.y, dz = b.z - a.z;
                        const d = Math.sqrt(dx * dx + dy * dy + dz * dz) || 1e-8;
                        const corr = (d - segLen) / d;
                        if (i === 0) {
                            b.x -= dx * corr; b.y -= dy * corr; b.z -= dz * corr;
                        } else if (i === n - 1) {
                            a.x += dx * corr; a.y += dy * corr; a.z += dz * corr;
                        } else {
                            const h = corr * 0.5;
                            a.x += dx * h; a.y += dy * h; a.z += dz * h;
                            b.x -= dx * h; b.y -= dy * h; b.z -= dz * h;
                        }
                    }
                    pts[0].copy(ends[0]);
                    pts[pts.length - 1].copy(ends[1]);
                }
                if (minBendR > 0.05 && it === iters - 1) enforceMinBendRadius(pts, minBendR);
                pts[0].copy(ends[0]);
                pts[pts.length - 1].copy(ends[1]);
                // Re-glue lid contacts after bend pass
                if (solid) {
                    for (let i = 1; i < pts.length - 1; i++) {
                        const roofY = cargoRoofAtXZ(pts[i].x, pts[i].z, pad * 0.35);
                        if (roofY != null && pts[i].y < roofY + 0.25) {
                            pts[i].y = Math.max(pts[i].y, roofY);
                        } else if (roofY == null) {
                            pts[i] = ejectFromCargoSolid(pts[i], pad * 0.7, solid);
                        }
                    }
                }
            }
            return pts;
        }

        // Soft inextensible rope/chain: drapes under gravity, conforms to solids, straightens only as tautness→1
        function solveDrapedRopePath(pointA, pointB, fixedLen, ropeR, allowA, allowB, meta) {
            const N = 28;
            const down = new THREE.Vector3(0, -1, 0);
            const m = meta || {};
            if (m.broken) {
                const chordBr = Math.max(0.001, pointA.distanceTo(pointB));
                const ropeLen = Math.max(chordBr, fixedLen || chordBr);
                const hung = catenaryPoints(pointA, pointB, ropeLen, N);
                if (hung && hung.length > 2) return hung;
                const pts = [];
                for (let i = 0; i <= N; i++) {
                    const t = i / N;
                    const p = new THREE.Vector3().lerpVectors(pointA, pointB, t);
                    p.addScaledVector(down, 0.22 * Math.sin(t * Math.PI) * Math.max(0, ropeLen - chordBr));
                    pts.push(p);
                }
                pts[0].copy(pointA);
                pts[N].copy(pointB);
                return pts;
            }

            const chord = Math.max(0.001, pointA.distanceTo(pointB));
            // Exact working length — never draw longer than L0 just because the drape seed is long
            const L0 = Math.max(0.2, fixedLen || chord);
            const targetLen = L0;
            const slack = Math.max(0, L0 - chord);
            const ends = [pointA.clone(), pointB.clone()];
            const pad = Math.max(0.028, (ropeR || 0.024) + 0.006);
            const needsRoof = chordNeedsRoofDrape(pointA, pointB, 18, pad);
            const solid = cargoWrapSolid(pad);
            const tautness = THREE.MathUtils.clamp(m.tautness != null ? m.tautness : (slack <= 0.02 ? 1 : 0), 0, 1);
            const minR = ropeMinBendRadius(ropeR, m);

            // Overstretched / fully taut + clear air → straight working line
            if (chord >= L0 - 0.012 && !needsRoof) {
                const pts = [];
                for (let i = 0; i <= N; i++) pts.push(new THREE.Vector3().lerpVectors(pointA, pointB, i / N));
                return pts;
            }
            if (tautness > 0.97 && !needsRoof) {
                const pts = [];
                for (let i = 0; i <= N; i++) pts.push(new THREE.Vector3().lerpVectors(pointA, pointB, i / N));
                return pts;
            }

            let nearCargo = false;
            if (solid) {
                const margin = Math.max(solid.hx, solid.hz, solid.hy) + 1.8;
                const nearEnd = (p) => {
                    const loc = cargoLocalFromWorld(p);
                    return Math.abs(loc.x - solid.ox) <= solid.hx + margin
                        && Math.abs(loc.z - solid.oz) <= solid.hz + margin
                        && loc.y <= solid.roofY + margin
                        && loc.y >= solid.bottomY - margin;
                };
                nearCargo = nearEnd(pointA) || nearEnd(pointB);
            }
            // Only attempt surface drape if L0 can actually reach a short corner path
            // (approx A→edge→B). If L0 is too short for a roof tour, use free-air catenary of L0.
            let minCorner = chord;
            if (solid && nearCargo) {
                const locA = cargoLocalFromWorld(pointA);
                const locB = cargoLocalFromWorld(pointB);
                const edgeDist = Math.min(
                    Math.abs(Math.abs(locA.x - solid.ox) - solid.hx) + Math.abs(Math.abs(locB.x - solid.ox) - solid.hx),
                    Math.abs(Math.abs(locA.z - solid.oz) - solid.hz) + Math.abs(Math.abs(locB.z - solid.oz) - solid.hz)
                );
                minCorner = Math.min(chord * 1.15, chord + edgeDist * 0.5 + minR);
            }
            const canDrape = L0 >= minCorner - 0.05;
            const useSurface = !!(solid && canDrape && (needsRoof || (slack > 0.06 && nearCargo)));

            let pts;
            if (useSurface) {
                const seed = seedSurfaceDrape(pointA, pointB, solid, pad, targetLen, minR);
                pts = resamplePolyline(seed, N);
            } else {
                const cat = catenaryPoints(pointA, pointB, targetLen, N);
                if (cat && cat.length > 2) {
                    pts = cat;
                } else {
                    pts = [pointA.clone()];
                    const sag = Math.min(slack * 0.55, Math.max(0.12, slack * 0.42));
                    for (let i = 1; i < N; i++) {
                        const t = i / N;
                        const p = new THREE.Vector3().lerpVectors(pointA, pointB, t);
                        p.y -= sag * Math.sin(t * Math.PI);
                        pts.push(p);
                    }
                    pts.push(pointB.clone());
                }
            }

            pts[0].copy(pointA);
            pts[pts.length - 1].copy(pointB);

            if (useSurface && tautness < 0.92) {
                const grav = (1 - tautness) * (0.7 + Math.min(1.0, slack / Math.max(0.2, targetLen * 0.15)));
                settleSoftRope(pts, targetLen, pad, ends, allowA, allowB, grav, solid, minR);
            }

            // HARD RULE: arc length must equal L0 (võng OK, dài thêm thì không)
            pts = fitPathToFixedLength(pts, pointA, pointB, targetLen, useSurface ? solid : null, pad);

            // Light surface glue after fit (must not re-lengthen past L0)
            if (useSurface && solid) {
                for (let i = 1; i < pts.length - 1; i++) {
                    const roofY = cargoRoofAtXZ(pts[i].x, pts[i].z, pad * 0.35);
                    if (roofY != null && pts[i].y < roofY) pts[i].y = roofY;
                }
                pts = fitPathToFixedLength(pts, pointA, pointB, targetLen, solid, pad);
            }

            const solidCheck = cargoWrapSolid(pad);
            if (solidCheck) {
                const locA2 = cargoLocalFromWorld(pointA);
                const locB2 = cargoLocalFromWorld(pointB);
                const bothEndsAbove = (Math.min(locA2.y, locB2.y) >= solidCheck.roofY - 0.35);
                for (let i = 1; i < pts.length - 1; i++) {
                    const roofY = cargoRoofAtXZ(pts[i].x, pts[i].z, pad * 0.5);
                    const locI = cargoLocalFromWorld(pts[i]);
                    const isInsideRoof = (locI.y >= solidCheck.bottomY - 0.10)
                        && Math.abs(locI.x - solidCheck.ox) <= Math.max(0.1, solidCheck.hx - 0.12)
                        && Math.abs(locI.z - solidCheck.oz) <= Math.max(0.1, solidCheck.hz - 0.12);
                    if (roofY != null && (bothEndsAbove || isInsideRoof)) {
                        if (pts[i].y < roofY) pts[i].y = roofY;
                    }
                }
            }

            pts[0].copy(pointA);
            pts[pts.length - 1].copy(pointB);
            return pts;
        }

        function slingPathPoints(pointA, pointB, fixedLen, meta) {
            return solveDrapedRopePath(pointA, pointB, fixedLen, 0.024, ['hook'], [], meta || { role: 'leg', broken: false });
        }

        // True hanging-cable (catenary) curve for a rope of exact length ropeLen between A and B.
        // Solves  sqrt(s^2 - v^2) = 2a*sinh(h/(2a))  for the catenary parameter a (h = horizontal span,
        // v = height difference), so slack rope hangs under gravity exactly like a real cable.
        function trueCatenaryPoints(A, B, ropeLen, N) {
            const dx = B.x - A.x, dz = B.z - A.z;
            const h = Math.hypot(dx, dz);
            const v = B.y - A.y;
            if (h < 0.03 || !(ropeLen > Math.abs(v) + 1e-4)) return null;
            const r = Math.sqrt(Math.max(0, ropeLen * ropeLen - v * v)) / h;
            if (!(r > 1.000001)) return null;
            // sinh(u)/u = r, u = h/(2a)  (monotonic in u>0)
            let lo = 1e-6, hi = 1;
            while (Math.sinh(hi) / hi < r && hi < 600) hi *= 2;
            for (let k = 0; k < 60; k++) {
                const mid = 0.5 * (lo + hi);
                if (Math.sinh(mid) / mid < r) lo = mid; else hi = mid;
            }
            const u = 0.5 * (lo + hi);
            const a = h / (2 * u);
            if (!isFinite(a) || a <= 0) return null;
            const x0 = h / 2 - a * Math.atanh(THREE.MathUtils.clamp(v / ropeLen, -0.999999, 0.999999));
            const yAt = x => a * (Math.cosh((x - x0) / a) - Math.cosh(x0 / a));
            const yEnd = yAt(h);
            const ux = dx / h, uz = dz / h;
            const pts = [];
            for (let i = 0; i <= N; i++) {
                const x = h * i / N;
                // remove residual numerical error so ends land exactly on A and B
                const y = yAt(x) + (v - yEnd) * (x / h);
                pts.push(new THREE.Vector3(A.x + ux * x, A.y + y, A.z + uz * x));
            }
            pts[0].copy(A);
            pts[N].copy(B);
            return pts;
        }

        function catenaryPoints(A, B, ropeLen, segCount) {
            const straight = A.distanceTo(B);
            const N = segCount || 20;
            if (!(ropeLen > straight + 0.004)) return null;
            const trueCat = trueCatenaryPoints(A, B, ropeLen, N);
            if (trueCat) return trueCat;
            const dyBias = THREE.MathUtils.clamp((A.y - B.y) / Math.max(0.5, ropeLen), -0.35, 0.35);
            const buildSag = sag => {
                const pts = [A.clone()];
                for (let i = 1; i < N; i++) {
                    const t = i / N;
                    // Classic catenary belly — asymmetric when ends differ in height
                    const s = Math.sin(t * Math.PI) * (1 + 0.22 * dyBias * (t - 0.5));
                    const p = new THREE.Vector3().lerpVectors(A, B, t);
                    p.y -= sag * s;
                    pts.push(p);
                }
                pts.push(B.clone());
                return pts;
            };
            const arcLen = pts => polylineLength(pts);
            // Allow deep belly so slack heavy rope shows clear độ trũng
            let lo = 0;
            let hi = Math.max(ropeLen - straight, ropeLen * 0.85);
            for (let k = 0; k < 14; k++) {
                const mid = 0.5 * (lo + hi);
                if (arcLen(buildSag(mid)) < ropeLen) lo = mid;
                else hi = mid;
            }
            return buildSag(0.5 * (lo + hi));
        }

        function tensionQuaternion(fromWorld, toWorld) {
            const yAxis = toWorld.clone().sub(fromWorld);
            if (yAxis.lengthSq() < 1e-8) yAxis.set(0, 1, 0);
            else yAxis.normalize();
            const down = new THREE.Vector3(0, -1, 0);
            const normal = new THREE.Vector3().crossVectors(yAxis, down);
            if (normal.lengthSq() < 1e-6) {
                const fallback = Math.abs(yAxis.x) < 0.9 ? new THREE.Vector3(1, 0, 0) : new THREE.Vector3(0, 0, 1);
                normal.crossVectors(yAxis, fallback);
            }
            normal.normalize();
            const xAxis = new THREE.Vector3().crossVectors(yAxis, normal).normalize();
            const zAxis = new THREE.Vector3().crossVectors(xAxis, yAxis).normalize();
            return new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(xAxis, yAxis, zAxis));
        }

        function pathLeaveArrive(from, to, len, role, index) {
            // Clean pin→pin tangents for shackle aiming. Do NOT project onto the cargo roof —
            // that yanked arrive sideways along the lid and twisted shackles ~90° off the sling.
            const leave = new THREE.Vector3().subVectors(to, from);
            const arrive = new THREE.Vector3().subVectors(from, to);
            if (leave.lengthSq() < 1e-8) leave.set(0, 1, 0);
            if (arrive.lengthSq() < 1e-8) arrive.set(0, 1, 0);
            return { leave: leave.normalize(), arrive: arrive.normalize(), pts: null };
        }

        function restRopeOnCargo(pts) {
            if (!pts || pts.length < 3) return pts;
            for (let i = 1; i < pts.length - 1; i++) {
                pts[i] = pushOutOfCargoShellWorld(pts[i], 0.026);
            }
            return pts;
        }

        function resampleSlingPath(pts, segments) {
            const count = Math.max(1, segments);
            if (!pts || pts.length < 2) return pts || [];
            const acc = [0];
            for (let i = 1; i < pts.length; i++) acc.push(acc[i - 1] + pts[i].distanceTo(pts[i - 1]));
            const total = acc[acc.length - 1];
            const out = [pts[0].clone()];
            if (total < 1e-5) {
                for (let s = 1; s <= count; s++) out.push(pts[pts.length - 1].clone());
                return out;
            }
            let k = 1;
            for (let s = 1; s < count; s++) {
                const d = total * (s / count);
                while (k < acc.length - 1 && acc[k] < d) k++;
                const span = Math.max(1e-6, acc[k] - acc[k - 1]);
                const t = THREE.MathUtils.clamp((d - acc[k - 1]) / span, 0, 1);
                out.push(pts[k - 1].clone().lerp(pts[k], t));
            }
            out.push(pts[pts.length - 1].clone());
            return out;
        }

        // ---------------------------------------------------------------------------------
        // Slack rope / chain physics: position-based dynamics (Verlet + inextensible links).
        // The rope has a fixed length L, is pinned at both shackle ends, hangs under gravity,
        // can only rest ON the outer shell of the cargo (never pass through it) and on the ground.
        // Wire / web ropes resist sharp folds (bending stiffness); chain folds freely.
        // State is kept per sling so it settles and swings naturally frame to frame.
        // ---------------------------------------------------------------------------------
        function simulateSlackRope(slingObj, A, B, L, pad, stiffR, allowA, allowB) {
            const N = slingObj.numSegments;
            const segLen = L / N;
            let rs = slingObj.ropeSim;
            const cargoKey = state.cargoType + '|' + (state.oogHasCargo !== false ? 1 : 0) + '|' + (state.oogTarp !== false ? 1 : 0) + '|' + state.L.toFixed(2) + '|' + state.W.toFixed(2) + '|' + state.H.toFixed(2) + '|' + ((state.oogCargoH || 0)).toFixed(2);
            const reseed = !rs || rs.N !== N || rs.cargoKey !== cargoKey
                || rs.p[0].distanceTo(A) > 1.2 || rs.p[N].distanceTo(B) > 1.2
                || Math.abs(rs.L - L) > 0.25 * L + 0.1;
            const invQ = phy.cargoQuat.clone().invert();
            const tmp = new THREE.Vector3();
            const loc = new THREE.Vector3();

            const solid = cargoWrapSolid(pad);
            const locA = cargoLocalFromWorld(A);
            const locB = cargoLocalFromWorld(B);
            const minEndLocalY = Math.min(locA.y, locB.y);
            const bothEndsAboveRoof = solid && (minEndLocalY >= solid.roofY - 0.65);

            const isOverRoofInterior = (w) => {
                if (!solid) return false;
                loc.copy(w).sub(phy.cargoPos).applyQuaternion(invQ);
                return (loc.y >= solid.bottomY - 0.10)
                    && Math.abs(loc.x - solid.ox) <= solid.hx + pad * 0.6
                    && Math.abs(loc.z - solid.oz) <= solid.hz + pad * 0.6;
            };

            const shouldClampToRoof = (w) => bothEndsAboveRoof || isOverRoofInterior(w);

            const outsideShell = (w) => {
                loc.copy(w).sub(phy.cargoPos).applyQuaternion(invQ);
                const o = pushOutOfCargoShellLocal(loc, pad, true);
                return o.distanceToSquared(loc) < 1e-10;
            };
            // Collision with ground + cargo shell. `from` = last valid (outside) position of this node:
            // when the node has crossed into the solid we put it back where it entered (it lands ON the
            // surface it fell onto) instead of ejecting it through the nearest face, which could be the
            // opposite side of the cargo (rope tunnelling underneath).
            // Resolve contacts while the PBD solver is running.  Do not add visual
            // waypoints after the fact: that turns one physical contact into a row of
            // sharp loops when the path is resampled for chain links.
            const clearExternalSolids = (p) => {
                const skip = ropeSkip(p, [A, B], allowA, allowB);
                const cleared = pushPointClear(p, pad, skip);
                p.copy(cleared);
            };
            const collide = (p, from) => {
                if (p.y < pad) p.y = pad;
                const roofY = cargoRoofAtXZ(p.x, p.z, pad);
                if (roofY != null && shouldClampToRoof(p)) {
                    if (p.y < roofY) p.y = roofY;
                }
                if (outsideShell(p)) {
                    clearExternalSolids(p);
                    return;
                }
                if (from && outsideShell(from)) {
                    const STEPS = 10;
                    let lastOut = from;
                    for (let s = 1; s <= STEPS; s++) {
                        tmp.lerpVectors(from, p, s / STEPS);
                        if (tmp.y < pad) tmp.y = pad;
                        if (outsideShell(tmp)) { lastOut = tmp.clone(); } else break;
                    }
                    p.copy(lastOut);
                    if (p.y < pad) p.y = pad;
                    if (roofY != null && shouldClampToRoof(p)) {
                        if (p.y < roofY) p.y = roofY;
                    }
                }
                // Fallback / final clean-up: nearest-face ejection (biased up to roof)
                tmp.copy(p).sub(phy.cargoPos).applyQuaternion(invQ);
                const out = pushOutOfCargoShellLocal(tmp.clone(), pad, true);
                if (out.distanceToSquared(tmp) > 1e-10) {
                    p.copy(out).applyQuaternion(phy.cargoQuat).add(phy.cargoPos);
                    if (p.y < pad) p.y = pad;
                    if (roofY != null && shouldClampToRoof(p)) {
                        if (p.y < roofY) p.y = roofY;
                    }
                }
                clearExternalSolids(p);
            };
            // A single rope segment can otherwise tunnel through a thin rail while
            // both of its nodes are clear.  Spread the contact correction over the
            // two neighbouring nodes; the following distance/bend passes turn this
            // into one smooth bearing arc instead of a kinked detour.
            const resolveSegmentContacts = (p) => {
                for (let i = 0; i < N; i++) {
                    const mid = p[i].clone().lerp(p[i + 1], 0.5);
                    const cleared = pushPointClear(mid, pad, ropeSkip(mid, [A, B], allowA, allowB));
                    const correction = cleared.sub(mid);
                    if (correction.lengthSq() < 1e-10) continue;
                    if (i > 0) p[i].addScaledVector(correction, 0.52);
                    if (i + 1 < N) p[i + 1].addScaledVector(correction, 0.52);
                }
            };
            const relax = (p, iters, withCollide, ref) => {
                const minR = Math.max(0.32, stiffR || 0.32);
                for (let it = 0; it < iters; it++) {
                    p[0].copy(A);
                    p[N].copy(B);
                    // 1) Distance constraints (Gauss-Seidel sweeps)
                    for (let s = 0; s < N; s++) {
                        const i = (it & 1) ? (N - 1 - s) : s;
                        const a = p[i], b = p[i + 1];
                        const dx = b.x - a.x, dy = b.y - a.y, dz = b.z - a.z;
                        const d = Math.sqrt(dx * dx + dy * dy + dz * dz) || 1e-9;
                        const k = (d - segLen) / d;
                        const wa = i === 0 ? 0 : 0.5, wb = (i + 1) === N ? 0 : 0.5;
                        const ws = wa + wb || 1;
                        const factor = k > 0 ? 1.0 : 0.75;
                        a.x += dx * k * factor * (wa / ws); a.y += dy * k * factor * (wa / ws); a.z += dz * k * factor * (wa / ws);
                        b.x -= dx * k * factor * (wb / ws); b.y -= dy * k * factor * (wb / ws); b.z -= dz * k * factor * (wb / ws);
                    }
                    // 2) Laplacian curvature smoothing: suppresses high-frequency zig-zag spatial modes (k >= 2)
                    // while preserving the fundamental catenary / C-arc (k = 1)
                    const kBend = 0.30;
                    for (let i = 1; i < N; i++) {
                        const mid = p[i - 1].clone().add(p[i + 1]).multiplyScalar(0.5);
                        p[i].lerp(mid, kBend);
                    }
                    // 3) Minimum bend radius enforcement: prevents sharp switchbacks or saw-tooth kinks
                    enforceMinBendRadius(p, minR);

                    // 4) Collision with surface / cargo shell
                    if (withCollide && (it % 2 === 0)) {
                        for (let i = 1; i < N; i++) {
                            collide(p[i], ref ? ref[i] : null);
                            if (ref) ref[i].copy(p[i]);
                        }
                        resolveSegmentContacts(p);
                    }
                }
                for (let i = 1; i < N; i++) {
                    collide(p[i], ref ? ref[i] : null);
                }
                resolveSegmentContacts(p);
                p[0].copy(A);
                p[N].copy(B);
            };

            if (reseed) {
                let seed = catenaryPoints(A, B, L, N);
                if (!seed || seed.length !== N + 1) {
                    seed = [];
                    for (let i = 0; i <= N; i++) {
                        const q = new THREE.Vector3().lerpVectors(A, B, i / N);
                        q.y -= 0.25 * L * Math.sin(Math.PI * i / N);
                        seed.push(q);
                    }
                }
                // Mode 1 outward elastica pre-bias: when cable hits roof/ground, excess length
                // must bow outward in a single smooth C-arc rather than buckling into 1D saw-tooth wiggles
                const chordHoriz = new THREE.Vector3(B.x - A.x, 0, B.z - A.z);
                const chordHorizLen = chordHoriz.length();
                if (chordHorizLen > 0.1 && L > chordHorizLen) {
                    const uChord = chordHoriz.clone().multiplyScalar(1 / chordHorizLen);
                    let latN = new THREE.Vector3(-uChord.z, 0, uChord.x);
                    const midHoriz = A.clone().add(B).multiplyScalar(0.5);
                    const toOut = midHoriz.clone().sub(phy.cargoPos || new THREE.Vector3());
                    toOut.y = 0;
                    if (latN.dot(toOut) < 0) latN.negate();

                    const excess = Math.max(0, L - chordHorizLen);
                    const maxSag = solid ? Math.min(0.40, solid.hz * 0.32) : 0.40;
                    const latSag = Math.min(maxSag, 0.22 * Math.sqrt(excess * (L + chordHorizLen)));
                    for (let i = 1; i < N; i++) {
                        const t = i / N;
                        const roofY = cargoRoofAtXZ(seed[i].x, seed[i].z, pad);
                        if (roofY != null && seed[i].y <= roofY + 0.15) {
                            seed[i].addScaledVector(latN, latSag * Math.sin(t * Math.PI));
                        }
                    }
                }
                // ref = last valid (outside-the-solid) position per node. Start from the straight chord
                // (always above the cargo for a hanging rig) so the first contact is found on the surface.
                const ref = seed.map((_, i) => new THREE.Vector3().lerpVectors(A, B, i / N));
                for (let i = 1; i < N; i++) { collide(seed[i], ref[i]); ref[i].copy(seed[i]); }
                relax(seed, 28, true, ref);
                rs = slingObj.ropeSim = {
                    N,
                    L,
                    cargoKey,
                    p: seed,
                    prev: seed.map(v => v.clone()),
                    rendered: seed.map(v => v.clone()),
                    ref,
                    prevA: A.clone(),
                    prevB: B.clone()
                };
            } else {
                rs.L = L;
                rs.cargoKey = cargoKey;
                const p = rs.p, prev = rs.prev, ref = rs.ref;
                const dA = rs.prevA ? A.clone().sub(rs.prevA) : new THREE.Vector3();
                const dB = rs.prevB ? B.clone().sub(rs.prevB) : new THREE.Vector3();
                rs.prevA = A.clone();
                rs.prevB = B.clone();

                // Overdamped Verlet integration: carries endpoints smoothly without whipping or phantom bounce
                const dt2 = (1 / 60) * (1 / 60);
                for (let i = 1; i < N; i++) {
                    const t = i / N;
                    const q = p[i], o = prev[i];
                    // Follow endpoint motion smoothly so moving hook/beam doesn't shock interior nodes
                    q.addScaledVector(dA, 1 - t).addScaledVector(dB, t);
                    o.addScaledVector(dA, 1 - t).addScaledVector(dB, t);
                    let vx = (q.x - o.x) * 0.48;
                    let vy = (q.y - o.y) * 0.48;
                    let vz = (q.z - o.z) * 0.48;
                    const vMag = Math.hypot(vx, vy, vz);
                    if (vMag > 0.025) {
                        const sc = 0.025 / vMag;
                        vx *= sc; vy *= sc; vz *= sc;
                    }
                    o.copy(q);
                    q.x += vx;
                    q.y += vy - G_EARTH * dt2 * 2.6;
                    q.z += vz;
                }
                // Mode 1 outward bias on flat surfaces: keeps excess slack bowed smoothly outward
                const chordHoriz = new THREE.Vector3(B.x - A.x, 0, B.z - A.z);
                const chordHorizLen = chordHoriz.length();
                if (chordHorizLen > 0.1 && L > chordHorizLen + 0.05) {
                    const uChord = chordHoriz.clone().multiplyScalar(1 / chordHorizLen);
                    let latN = new THREE.Vector3(-uChord.z, 0, uChord.x);
                    const midHoriz = A.clone().add(B).multiplyScalar(0.5);
                    const toOut = midHoriz.clone().sub(phy.cargoPos || new THREE.Vector3());
                    toOut.y = 0;
                    if (latN.dot(toOut) < 0) latN.negate();
                    for (let i = 1; i < N; i++) {
                        const t = i / N;
                        const roofY = cargoRoofAtXZ(p[i].x, p[i].z, pad);
                        if (roofY != null && p[i].y <= roofY + 0.08) {
                            p[i].addScaledVector(latN, 0.003 * Math.sin(t * Math.PI));
                        }
                    }
                }
                relax(p, 12, true, ref);
                prev[0].copy(p[0]); prev[N].copy(p[N]);
            }

            // Smooth out kinks & high-frequency zig-zags so draped cable curves naturally
            let pOut = rs.p.map(v => v.clone());
            const minBendR = Math.max(0.32, stiffR || 0.32);
            for (let pass = 0; pass < 3; pass++) {
                enforceMinBendRadius(pOut, minBendR);
                for (let i = 1; i < N; i++) {
                    const mid = pOut[i - 1].clone().add(pOut[i + 1]).multiplyScalar(0.5);
                    pOut[i].lerp(mid, 0.28);
                    collide(pOut[i], null);
                }
                resolveSegmentContacts(pOut);
            }
            enforceMinBendRadius(pOut, minBendR);
            // Smoothing, roof clamping and the temporal filter above can subtly
            // lengthen a path.  Re-project the final drawn rope back to its
            // manufactured length before placing any links/tube segments.  Never
            // manufacture metres of steel just to join two temporarily bad pins.
            if (A.distanceTo(B) <= L + 0.004) {
                pOut = fitPathToFixedLength(pOut, A, B, L, solid, pad);
            }
            if (!rs.rendered || rs.rendered.length !== N + 1) {
                rs.rendered = pOut.map(v => v.clone());
            }
            rs.rendered[0].copy(A);
            rs.rendered[N].copy(B);
            for (let i = 1; i < N; i++) {
                const roofY = cargoRoofAtXZ(pOut[i].x, pOut[i].z, pad);
                if (roofY != null && shouldClampToRoof(pOut[i])) {
                    if (pOut[i].y < roofY) pOut[i].y = roofY;
                }
                // Temporal low-pass filter eliminates any frame-to-frame micro-oscillation
                rs.rendered[i].lerp(pOut[i], 0.42);
                collide(rs.rendered[i], null);
                if (roofY != null && shouldClampToRoof(rs.rendered[i])) {
                    if (rs.rendered[i].y < roofY) rs.rendered[i].y = roofY;
                }
                // Write back stabilized positions and sync prev to prevent collision ejection from becoming velocity!
                rs.p[i].copy(rs.rendered[i]);
                rs.prev[i].lerp(rs.p[i], 0.65);
                pOut[i].copy(rs.rendered[i]);
            }
            return pOut;
        }

        function update3DSlingGeometry(slingObj, pointA, pointB, fixedLen, slingStyle, isOverloaded) {

            const meta = slingObj.drawMeta || {};
            const end = pointB;
            slingObj.group.visible = true;
            const chord = pointA.distanceTo(end);
            const ropeR = 0.024;
            const cable = (phy.cables || []).find(c => c.role === meta.role && c.index === meta.index);
            const allowA = cable && endSolidId(cable.a) ? [endSolidId(cable.a)] : ['hook'];
            const allowB = cable && endSolidId(cable.b) ? [endSolidId(cable.b)] : [];

            const pathMeta = Object.assign({}, meta, {
                tautness: meta.tautness != null ? meta.tautness : 0
            });
            const gradeNow = meta.grade || '';
            let look = meta.slingType || slingStyle || 'wire';
            if (meta.slingType) {
                look = meta.slingType;
            } else if (slingStyle) {
                look = slingStyle;
            } else if (meta.grade === 'g80' || meta.grade === 'g100') {
                look = 'chain';
            } else if (meta.grade === 'poly') {
                look = 'web';
            } else if (meta.grade === 'hmpe') {
                look = 'round_sling';
            } else {
                look = 'wire';
            }

            const isChainNow = look === 'chain';
            const isFlatNow = look === 'web' || look === 'round_sling';
            const diaNowM = Math.max(6, meta.diaMm || (isFlatNow ? 50 : (isChainNow ? 16 : 20))) / 1000;
            // Collision radius = real half-thickness of what is drawn (chain link outer width / rope radius / strap)
            const simPad = isChainNow ? 1.1 * diaNowM
                : (isFlatNow ? 0.008 : diaNowM * 0.5 + 0.003);
            // Bending stiffness: steel wire rope resists tight folds (~8x dia); chain and straps fold freely
            const simStiffR = (isChainNow || isFlatNow) ? 0 : Math.max(0.12, 8 * diaNowM);
            const actualTension = (cable && cable.tensionT) || 0;
            // A segment whose pins happen to be exactly one nominal length apart
            // is not automatically loaded.  With no transmitted force, allow the
            // small real seating/link clearance of a loose sling to show as a
            // gravity catenary rather than a visually impossible horizontal bar.
            // An intact upper bridle in a lifted assembly is carrying at least the
            // suspended beam/rigging mass, even when a particular solver substep
            // reports a near-zero impulse.  Do not turn that load path into a
            // visual catenary: it is a tension member while the load is airborne.
            // This is deliberately limited to the upper tier; auxiliary ropes and
            // unloaded lower/extra slings continue to drape under gravity.
            // Every intact upper leg terminates at a beam/frame with non-zero
            // self-weight. It is therefore a loaded tension path even while the
            // editor is showing the convenient pose-locked placement preview.
            const upperNominalLength = (cable && cable.L0 > 0.2) ? cable.L0 : fixedLen;
            const suspendedUpper = meta.role === 'upper' && !meta.broken && cable
                && !cableIsBroken(cable)
                // A lifted load has consumed the upper support path even if a
                // numerical substep is exactly at L0.  On the ground, however,
                // a deliberately long upper sling must remain free to drape.
                && ((phy.groundClearance || 0) > 0.04 || !!phy.autoHoistActive || chord >= upperNominalLength - 0.012);
            const nominalL0 = (cable && cable.L0 > 0.2) ? cable.L0 : fixedLen;
            const geometricallyTaut = chord >= nominalL0 - 0.022;
            const forceFree = !!(cable && cable.slack && actualTension < 0.015 && !suspendedUpper && !geometricallyTaut);
            const freeAllowance = isChainNow ? Math.min(0.18, Math.max(0.035, chord * 0.025))
                : Math.min(0.10, Math.max(0.018, chord * (isFlatNow ? 0.008 : 0.012)));
            const renderLen = forceFree && fixedLen <= chord + 0.012
                ? chord + freeAllowance
                : fixedLen;
            let rawPts;
            // Length alone does not mean that a sling is slack.  The physics solver
            // supplies tautness from L0 and actual load; only a non-taut sling gets
            // the gravity-driven hanging solve.
            const physicallyTaut = !meta.broken && !forceFree
                && (suspendedUpper || geometricallyTaut || pathMeta.tautness >= 0.97);
            // A severed half is still a real piece of flexible material.  Render
            // it through the same PBD/contact solve as a slack rope so it lies on
            // the roof, slides across a tilted surface and falls off an edge.
            const isBrokenStub = !!meta.broken && !!meta.brokenHalf;
            if ((!meta.broken && !physicallyTaut && renderLen > chord + 0.012)
                || (isBrokenStub && renderLen > chord + 0.004)) {
                // Slack: real hanging rope that rests on (never inside) the cargo shell / ground
                rawPts = simulateSlackRope(slingObj, pointA, end, renderLen, simPad, simStiffR, allowA, allowB);
            } else {
                slingObj.ropeSim = null;
                rawPts = solveDrapedRopePath(pointA, end, renderLen, ropeR, allowA, allowB, pathMeta);
            }
            let pts = resampleSlingPath(rawPts, slingObj.numSegments);
            // Keep the renderer's fixed segment count. The smooth physical path is
            // resampled only for visual link/strand placement; no extra zig-zag nodes.
            // Intact: pin→pin. Broken stub: attachment pin → free tip (both endpoints matter)
            pts[0].copy(pointA);
            pts[pts.length - 1].copy(end);
            const reached = !meta.broken;

            const slingMeshNameMap = {
                wire: 'Wire_Rope_Sling',
                chain: 'Chain_Sling',
                web: 'Synthetic_Web_Sling',
                round_sling: 'Round_Sling',
                grommet: 'Grommet_Sling'
            };
            slingObj.group.name = slingMeshNameMap[look] || 'Wire_Rope_Sling';

            let mat = MATS.wireRope;
            if (look === 'chain') mat = MATS.chainDark;
            else if (look === 'web' || look === 'round_sling') mat = MATS.webGreen;
            if (meta.broken || isOverloaded) mat = MATS.redMaster;
            else if (meta.selected) mat = MATS.lpSelected;

            const dia = Math.max(6, meta.diaMm || (look === 'web' ? 50 : (look === 'chain' ? 16 : 20)));
            // diaScale: legacy factor, still used to size end thimbles / eyes.
            const diaScale = THREE.MathUtils.clamp(dia / (look === 'web' ? 50 : 18), 0.55, 2.6) * (meta.selected ? 1.35 : 1);
            // bodyK: true-to-scale factor for the rope body. Base cylinder radius is 0.018 m,
            // so scale = (dia_mm / 2000) / 0.018 = dia_mm / 36 gives the real diameter.
            const bodyK = (Math.max(dia, 10) / 36) * (meta.selected ? 1.15 : 1);
            const N = slingObj.numSegments;
            const upY = new THREE.Vector3(0, 1, 0);
            const chain = look === 'chain';

            // Trim cylindrical rope body slightly at both ends when wire eye-thimbles are visible so rope starts inside ferrule
            const showWireEye = (look === 'wire' || look === 'grommet') && !meta.broken && chord > 0.35;
            const showWebEye = (look === 'web' || look === 'round_sling') && !meta.broken && chord > 0.35;

            for (let i = 0; i < N; i++) {
                const seg = slingObj.segments[i];
                seg.material = mat;
                const hideTipForEye = showWireEye && (i === 0 || (reached && i === N - 1));
                // Chain: hide tube body, show articulated oval links; wire: continuous stiff tube
                seg.visible = !chain && !hideTipForEye;
                const segVec = new THREE.Vector3().subVectors(pts[i + 1], pts[i]);
                const segLen = Math.max(0.001, segVec.length());
                const mid = pts[i].clone().lerp(pts[i + 1], 0.5);
                seg.position.copy(mid);
                const dir = segVec.clone().normalize();
                seg.quaternion.setFromUnitVectors(upY, dir);
                // Overlap segment ends slightly so curved drapes look continuous
                const overlapLen = segLen + (i > 0 && i < N - 1 ? 0.018 * bodyK : 0.004);
                // True-to-scale bodies: web = flat strap (width = dia, ~8 mm thick); round sling tube ~0.6 x nominal;
                // wire / grommet = real rope diameter.
                if (look === 'web') seg.scale.set(bodyK, overlapLen, 0.22);
                else if (look === 'round_sling') seg.scale.set(bodyK * 0.6, overlapLen, bodyK * 0.6);
                else if (look === 'grommet') seg.scale.set(bodyK, overlapLen, bodyK);
                else seg.scale.set(bodyK, overlapLen, bodyK);
                if (slingObj.links && slingObj.links[i]) {
                    const link = slingObj.links[i];
                    link.visible = false;
                }
            }

            // Interlocked Grade-80 chain: pitch locked to link size so ovals always nest (no floating rings)
            if (chain && slingObj.links && !meta.broken) {
                const arc = Math.max(0.05, polylineLength(pts));
                // Size from sling diameter (16 mm stock → scale 1)
                const stockScale = THREE.MathUtils.clamp((dia || 16) / 16, 0.5, 3.5);
                const pitch = CHAIN_NEST_PITCH * stockScale;
                const maxLinks = slingObj.numLinks || slingObj.links.length;
                // Cover full A→B; if arc is long, use every slot and grow links so they still overlap
                let linkCount = Math.max(4, Math.ceil(arc / pitch));
                let nest = 1;
                if (linkCount > maxLinks) {
                    linkCount = maxLinks;
                    nest = (arc / linkCount) / pitch; // >1 when packing sparse — grow mesh to close gaps
                }
                const step = arc / linkCount;
                const ls = stockScale * Math.max(1, nest);
                // True proportions: links keep their real size (no artificial inflation)
                const sx = ls;
                const sy = ls * CHAIN_LINK_ELONG;

                const acc = [0];
                for (let k = 1; k < pts.length; k++) acc.push(acc[k - 1] + pts[k].distanceTo(pts[k - 1]));
                const total = acc[acc.length - 1] || 1;
                let kCursor = 1;
                for (let i = 0; i < slingObj.links.length; i++) {
                    const link = slingObj.links[i];
                    if (!link) continue;
                    if (i >= linkCount) {
                        link.visible = false;
                        continue;
                    }
                    // Sit first/last links close to the pins (no floating gap above shackle)
                    const d = Math.min(total - 1e-4, step * (i + 0.5));
                    while (kCursor < acc.length - 1 && acc[kCursor] < d) kCursor++;
                    const span = Math.max(1e-6, acc[kCursor] - acc[kCursor - 1]);
                    const t = THREE.MathUtils.clamp((d - acc[kCursor - 1]) / span, 0, 1);
                    const p0 = pts[kCursor - 1];
                    const p1 = pts[kCursor];
                    const mid = p0.clone().lerp(p1, t);
                    const dir = new THREE.Vector3().subVectors(p1, p0);
                    if (dir.lengthSq() < 1e-8) dir.copy(upY);
                    else dir.normalize();
                    link.visible = true;
                    link.material = mat;
                    link.position.copy(mid);
                    link.quaternion.setFromUnitVectors(upY, dir);
                    // Alternate plane 90° about chain axis = classic weave / interlock
                    if (i % 2) link.rotateY(Math.PI / 2);
                    link.scale.set(sx, sy, sx);
                }
            } else if (slingObj.links) {
                slingObj.links.forEach(link => { if (link) link.visible = false; });
            }

            // Orient forged eye-thimbles + swaged ferrules inward from pts[0] and pts[N]
            const dirFromA = new THREE.Vector3().subVectors(pts[Math.min(2, N)], pts[0]);
            if (dirFromA.lengthSq() < 1e-6) dirFromA.copy(upY);
            dirFromA.normalize();

            const dirFromB = new THREE.Vector3().subVectors(pts[Math.max(0, N - 2)], pts[N]);
            if (dirFromB.lengthSq() < 1e-6) dirFromB.copy(upY).negate();
            dirFromB.normalize();

            // Record exact joint departure tangents so shackles align in 100% unison with the rendered sling
            slingObj.dirLeave = dirFromA.clone();
            slingObj.dirArrive = dirFromB.clone();
            slingObj.visA = pts[0].clone();
            slingObj.visB = pts[N].clone();
            slingObj.pathPoints = pts.map(p => p.clone());
            if (slingObj.drawMeta) slingObj.drawMeta.renderedLength = polylineLength(pts);

            const eyeScale = THREE.MathUtils.clamp(diaScale, 0.72, 1.45);
            if (slingObj.endEyeA && slingObj.endEyeB) {
                slingObj.endEyeA.visible = showWireEye;
                slingObj.endEyeB.visible = showWireEye && reached;
                if (showWireEye) {
                    slingObj.endEyeA.position.copy(pts[0]);
                    slingObj.endEyeA.quaternion.copy(tensionQuaternion(pts[0], pts[0].clone().add(dirFromA)));
                    slingObj.endEyeA.scale.setScalar(eyeScale);
                }
                if (showWireEye && reached) {
                    slingObj.endEyeB.position.copy(pts[N]);
                    slingObj.endEyeB.quaternion.copy(tensionQuaternion(pts[N], pts[N].clone().add(dirFromB)));
                    slingObj.endEyeB.scale.setScalar(eyeScale);
                }
            }

            if (slingObj.webEyeA && slingObj.webEyeB) {
                slingObj.webEyeA.visible = showWebEye;
                slingObj.webEyeB.visible = showWebEye && reached;
                if (showWebEye) {
                    slingObj.webEyeA.position.copy(pts[0]);
                    slingObj.webEyeA.quaternion.copy(tensionQuaternion(pts[0], pts[0].clone().add(dirFromA)));
                }
                if (showWebEye && reached) {
                    slingObj.webEyeB.position.copy(pts[N]);
                    slingObj.webEyeB.quaternion.copy(tensionQuaternion(pts[N], pts[N].clone().add(dirFromB)));
                }
            }

            // Inline 3D Forged Turnbuckle / Rigging Screw when legDeltaL[i] is non-zero
            if (slingObj.turnbuckle) {
                const deltaL = meta.role === 'leg' ? (state.legDeltaL[meta.index] || 0) : 0;
                const showTb = meta.role === 'leg' && !meta.broken && Math.abs(deltaL) > 0.004 && chord > 0.75;
                slingObj.turnbuckle.visible = showTb;
                if (showTb) {
                    const tbIdx = Math.max(2, Math.min(N - 2, Math.round(N * 0.72)));
                    const pPrev = pts[tbIdx - 1];
                    const pNext = pts[tbIdx + 1];
                    const tbDir = new THREE.Vector3().subVectors(pNext, pPrev);
                    if (tbDir.lengthSq() < 1e-6) tbDir.copy(upY);
                    tbDir.normalize();
                    slingObj.turnbuckle.position.copy(pts[tbIdx]);
                    slingObj.turnbuckle.quaternion.copy(tensionQuaternion(pPrev, pPrev.clone().add(tbDir)));
                }
            }

            slingObj.lastMid = pts[Math.floor(N / 2)].clone();
            const tagSling = (o) => {
                if (!o || !o.userData) return;
                o.userData.gearKind = 'sling';
                o.userData.gearRole = meta.role || 'leg';
                o.userData.gearIndex = meta.index || 0;
            };
            tagSling(slingObj.group);
            (slingObj.segments || []).forEach(tagSling);
            (slingObj.links || []).forEach(tagSling);
            tagSling(slingObj.endEyeA);
            tagSling(slingObj.endEyeB);
            tagSling(slingObj.webEyeA);
            tagSling(slingObj.webEyeB);
            tagSling(slingObj.turnbuckle);
            if (slingObj.pickers) {
                slingObj.pickers.forEach((picker, k) => {
                    const idx = Math.min(N, Math.round(((k + 1) / (slingObj.pickers.length + 1)) * N));
                    picker.position.copy(pts[idx]);
                    picker.visible = true;
                    tagSling(picker);
                });
            }
        }
