/**
 * rigging/hook_pool — hook block, pad-eyes, sling pool
 * Split from legacy god-file (strangler Phase 2). Shared scope via assemble.
 */
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

            // 6. Interlocked Forged Red Oval Master Link — so le / vuông góc with the J-hook
            // plane (hook spine in XY, link opening in YZ). Hook stock passes through the
            // oblong hole; top inner crown tì đè on the saddle instead of coplanar mesh-weld.
            // Hook saddle inner ≈ y=-0.340; top inner crown = centerY + (H/2 - r).
            // Inner width (ML_W - 2*ML_R ≈ 136 mm) clears saddle stock (~Ø92 mm).
            const ML_H = 0.300, ML_W = 0.180, ML_R = 0.022;
            const mlInnerHalf = ML_H * 0.5 - ML_R; // 0.128
            const hookSaddleY = -0.340;
            // Seat crown on saddle; keep bottom crown at HOOK_MASTER_OFFSET_Y (-0.608)
            const mlCenterY = hookSaddleY - mlInnerHalf - 0.012;
            masterLinkMesh = createOvalMasterLink(ML_H, ML_W, ML_R);
            masterLinkMesh.name = 'Master_Link';
            masterLinkMesh.position.set(0, mlCenterY, 0);
            masterLinkMesh.rotation.set(0, Math.PI / 2, 0); // opening in YZ — so le with hook
            masterLinkMesh.userData.bearing = {
                topY: mlCenterY + mlInnerHalf,
                bottomY: mlCenterY - mlInnerHalf,
                tubeR: ML_R,
                height: ML_H,
                width: ML_W,
                planeNormal: new THREE.Vector3(1, 0, 0) // after +90° Y: link plane = YZ
            };
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

            // Pool: denser tube samples + chain link budget for soft bends (not long broken sticks)
            for (let i = 0; i < 48; i++) {
                const slingObj = createArticulated3DSling(48, 500);
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

        // Stock radius of the bearing bar the sling nests against (m, unscaled mesh)
        function hardwareTubeRadius(type, scale) {
            const s = scale == null ? 1.0 : scale;
            if (type === 'wide_shackle') return 0.020 * s;
            if (type === 'd_shackle') return 0.018 * s;
            if (type === 'master_link') return 0.020 * s;
            if (type === 'hook' || type === 'clevis_hook' || type === 'eye_hook' || type === 'swivel_hook') return 0.016 * s;
            return 0.0185 * s; // bow_shackle default
        }

        // Wire-eye local Y where the rope body must begin (inside the swaged tip + stub overlap)
        function wireEyeFerruleExit(scale) {
            const s = scale == null ? 1.0 : scale;
            // Stub center 0.208, half-height 0.0275 → tip ≈ 0.235; start path mid-stub
            return 0.218 * s;
        }

        // Hook-block master link: pin is the BOTTOM inner crown. Eyes/chain tops hang from it.
        function masterLinkHookBearingInset(scale) {
            const s = scale == null ? 1.0 : scale;
            // Bearing is at the pin; path starts after the full eye+ferrule so rope meets the sleeve
            return wireEyeFerruleExit(s);
        }

        // Red đốt cuối: near inner crown → far inner crown (black links nest through the far eye)
        function chainEndLinkTubeRadius(scale) {
            const s = scale == null ? 1.0 : scale;
            return 0.014 * s; // must match createChainEndHardwareGroup subR
        }
        function chainTopAssemblyLength(scale) {
            const s = scale == null ? 1.0 : scale;
            // 2 * innerHalf = subH - 2*subR = 0.115 - 0.028 = 0.087
            return 0.087 * s;
        }
        // Leave-distance from parent bearing plane to path start (far eye), after thickness seating
        function chainEndPathInset(scale, parentKind) {
            const s = scale == null ? 1.0 : scale;
            const childR = chainEndLinkTubeRadius(s);
            const parentR = (parentKind === 'hook' || parentKind === 'master_link')
                ? 0.022 * s
                : ((typeof hardwareTubeRadius === 'function')
                    ? hardwareTubeRadius(state.hwType || 'bow_shackle', s)
                    : 0.0185 * s);
            // seat = crown − (parentR+childR); far crown = seat + 2*innerHalf
            return Math.max(0.02, chainTopAssemblyLength(s) - (parentR + childR));
        }

        // Same eyeScale used by update3DSlingGeometry — keep path inset ↔ ferrule tip in sync
        function slingEyeScaleFromMeta(meta, look) {
            const dia = Math.max(6, (meta && meta.diaMm) || (look === 'web' ? 50 : (look === 'chain' ? 16 : 20)));
            const diaScale = THREE.MathUtils.clamp(dia / (look === 'web' ? 50 : 18), 0.55, 2.6)
                * ((meta && meta.selected) ? 1.35 : 1);
            return THREE.MathUtils.clamp(diaScale, 0.72, 1.45);
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

        // Helper: Realistic 6-Strand Helical Twisted Wire Rope Cylinder Geometry
        function createHelicalWireStrandGeometry(radius = 0.018, length = 1.0, radialSegs = 18, heightSegs = 6) {
            const geo = new THREE.CylinderGeometry(radius, radius, length, radialSegs, heightSegs, false);
            const pos = geo.attributes.position;
            for (let i = 0; i < pos.count; i++) {
                const x = pos.getX(i);
                const y = pos.getY(i);
                const z = pos.getZ(i);
                const phi = Math.atan2(z, x);
                const v = (y / length) + 0.5;
                const psi = 6 * (phi + v * (Math.PI * 0.75));
                const lobe = 1.0 - 0.14 * Math.pow(1 - Math.abs(Math.cos(psi * 0.5)), 1.6);
                pos.setX(i, x * lobe);
                pos.setZ(i, z * lobe);
            }
            geo.computeVertexNormals();
            return geo;
        }

        // Helper: Natural Bunched Wrinkle Geometry for Round Sling Protective Sleeve
        function createRoundSlingWrinkleGeometry(radius = 0.018, length = 1.0, radialSegs = 16, heightSegs = 6) {
            const geo = new THREE.CylinderGeometry(radius, radius, length, radialSegs, heightSegs, false);
            const pos = geo.attributes.position;
            for (let i = 0; i < pos.count; i++) {
                const x = pos.getX(i);
                const y = pos.getY(i);
                const z = pos.getZ(i);
                const theta = Math.atan2(z, x);
                const v = y / length;
                const wrinkle = 1.0 + 0.075 * Math.sin(v * 22) + 0.04 * Math.cos(v * 40 + 2 * theta);
                pos.setX(i, x * wrinkle);
                pos.setZ(i, z * wrinkle);
            }
            geo.computeVertexNormals();
            return geo;
        }

        // Helper: Red chain end-link (đốt cuối) that nests through a master-link or shackle bow.
        // Contract: local origin = INNER hole-edge; +Y into the chain body (tube stock on +Y).
        // Caller seats origin at parentCrown − 2·tubeR so child stock fills the OPENING side of
        // the bearing plane and tì đè the parent bar (so le) — not a mid-tube weld.
        // Orientation: plane ⊥ parent via orientEndLink.
        function createChainEndHardwareGroup(isTop = true) {
            const g = new THREE.Group();
            g.name = isTop ? 'Chain_End_Link_Top' : 'Chain_End_Link_Bottom';
            const redMat = MATS.chainPowderRed || MATS.redMaster;

            // Eye must clear bow Ø≈37 mm with so-le nest; stock thick enough to read tì đè.
            // Inner width = 0.090-0.028 = 0.062; stock Ø28 mm.
            const subH = 0.115, subW = 0.090, subR = 0.014;
            const innerHalf = subH * 0.5 - subR; // 0.0435
            const sub = createOvalMasterLink(subH, subW, subR);
            sub.name = 'Chain_End_Link';
            // Origin = near inner crown; +Y along sling. Flip so crown faces the parent pin.
            sub.rotation.x = Math.PI;
            sub.position.y = innerHalf;
            sub.traverse(m => {
                if (m.isMesh) m.material = redMat;
            });

            // Pure oblong — black Grade-80 links nest through the far eye (no fake hammerlock weld)
            g.userData.bearingLength = 2 * innerHalf; // ≈0.087
            g.userData.tubeR = subR;
            g.userData.innerHalf = innerHalf;
            g.add(sub);
            g.traverse(m => { if (m.isMesh) m.castShadow = true; });
            return g;
        }

        // Helper: Heavy-Duty Orange/White Warning Label Tag for Round Sling
        function createRoundSlingTagGroup() {
            const g = new THREE.Group();
            g.name = 'Round_Sling_Safety_Tag';
            const tagMat = new THREE.MeshStandardMaterial({ color: 0xea580c, roughness: 0.75, metalness: 0.05 });
            const whiteMat = new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.85, metalness: 0.02 });

            const mainTag = new THREE.Mesh(new THREE.BoxGeometry(0.036, 0.11, 0.004), tagMat);
            const flapTag = new THREE.Mesh(new THREE.BoxGeometry(0.032, 0.07, 0.002), whiteMat);
            flapTag.position.set(0.016, -0.012, 0.003);
            flapTag.rotation.z = 0.10;

            g.add(mainTag, flapTag);
            return g;
        }

        // Helper: Seamless Endless Grommet Eye with Metallic Wire Seizing Sleeve
        function createGrommetSeizingEyeGroup() {
            const g = new THREE.Group();
            g.name = 'Grommet_Seizing_Eye';
            const wireMat = MATS.wireRope;
            const seizingMat = MATS.galvSteel || MATS.forgedAlloy;

            const loopCurveA = new THREE.CatmullRomCurve3([
                new THREE.Vector3(-0.018, 0.088, 0),
                new THREE.Vector3(-0.032, 0.042, 0),
                new THREE.Vector3( 0.000, -0.006, 0),
                new THREE.Vector3( 0.032, 0.042, 0),
                new THREE.Vector3( 0.018, 0.088, 0)
            ], false, 'centripetal', 0.4);
            const loopA = new THREE.Mesh(new THREE.TubeGeometry(loopCurveA, 18, 0.011, 8, false), wireMat);

            const loopCurveB = new THREE.CatmullRomCurve3([
                new THREE.Vector3(-0.008, 0.088, 0.016),
                new THREE.Vector3(-0.022, 0.042, 0.016),
                new THREE.Vector3( 0.000, -0.006, 0.016),
                new THREE.Vector3( 0.022, 0.042, 0.016),
                new THREE.Vector3( 0.008, 0.088, 0.016)
            ], false, 'centripetal', 0.4);
            const loopB = new THREE.Mesh(new THREE.TubeGeometry(loopCurveB, 18, 0.011, 8, false), wireMat);

            const seizingSleeve = new THREE.Mesh(new THREE.CylinderGeometry(0.024, 0.024, 0.065, 14), seizingMat);
            seizingSleeve.position.y = 0.115;

            g.add(loopA, loopB, seizingSleeve);
            g.traverse(m => { if (m.isMesh) m.castShadow = true; });
            return g;
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
            ferruleCone.name = 'Ferrule_Wire_Rope_Tip';
            // Rope stub that exits the swaged tip and overlaps the first path segment
            const ropeStub = new THREE.Mesh(
                new THREE.CylinderGeometry(0.014, 0.013, 0.055, 10),
                MATS.wireRope
            );
            ropeStub.position.y = 0.208; // extends well past tip face into the rope body
            ropeStub.name = 'Ferrule_Rope_Stub';

            termGroup.add(wireEye, thimbleMesh, ferruleBody, ferruleCone, ropeStub);
            termGroup.traverse(m => { if (m.isMesh) m.castShadow = true; });
            return termGroup;
        }

        // Helper: Stitched Web-Sling Eye Sleeve for synthetic slings with EN 1492-1 Becket Eye, Cross-Stitch & Tag
        function createWebEyeSleeveGroup() {
            const g = new THREE.Group();
            g.name = 'Synthetic_Web_Eye_Sleeve';

            // Soft becket eye — flattened tube so it reads as folded webbing, not a hose
            const eyeCurve = new THREE.CatmullRomCurve3([
                new THREE.Vector3(-0.018, 0.095, 0),
                new THREE.Vector3(-0.034, 0.048, 0),
                new THREE.Vector3( 0.000, -0.002, 0),
                new THREE.Vector3( 0.034, 0.048, 0),
                new THREE.Vector3( 0.018, 0.095, 0)
            ], false, 'centripetal', 0.35);
            const loop = new THREE.Mesh(new THREE.TubeGeometry(eyeCurve, 24, 0.007, 8, false), MATS.webGreen);
            loop.name = 'Web_Eye_Loop';
            const wearLiner = new THREE.Mesh(new THREE.TubeGeometry(eyeCurve, 16, 0.0045, 8, false), MATS.darkSteel);

            const cuff = new THREE.Mesh(new THREE.BoxGeometry(0.078, 0.10, 0.012), MATS.webGreen);
            cuff.position.y = 0.100;
            cuff.name = 'Web_Cuff';

            const stitchMat = new THREE.MeshBasicMaterial({ color: 0x111827 });
            const stitchX1 = new THREE.Mesh(new THREE.BoxGeometry(0.045, 0.003, 0.025), stitchMat);
            stitchX1.position.y = 0.095;
            stitchX1.rotation.z = 0.785;
            const stitchX2 = new THREE.Mesh(new THREE.BoxGeometry(0.045, 0.003, 0.025), stitchMat);
            stitchX2.position.y = 0.095;
            stitchX2.rotation.z = -0.785;

            const tagMat = new THREE.MeshStandardMaterial({ color: 0x1d4ed8, roughness: 0.82, metalness: 0.05 });
            const tag = new THREE.Mesh(new THREE.BoxGeometry(0.038, 0.075, 0.003), tagMat);
            tag.position.set(0.036, 0.092, 0);
            tag.rotation.z = -0.22;

            g.add(loop, wearLiner, cuff, stitchX1, stitchX2, tag);
            g.traverse(m => { if (m.isMesh) m.castShadow = true; });
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
                const rope = new THREE.Mesh(createHelicalWireStrandGeometry(0.022, 2.32, 18, 12), MATS.wireRope);
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
                // +Y of end-link = into chain; rotate so bearing faces outward, body toward mid-span
                const topAssembly = createChainEndHardwareGroup(true);
                topAssembly.position.set(0, 1.38, 0);
                topAssembly.rotation.z = Math.PI; // +Y downward into chain
                g.add(topAssembly);
                const topFar = 1.38 - chainTopAssemblyLength(1);
                const prevScale = 1.1;
                const prevPitch = CHAIN_NOMINAL_PITCH * prevScale;
                const prevCount = 32;
                for (let i = 0; i < prevCount; i++) {
                    const lk = createOvalChainLinkGroup();
                    // Nest first link into the red far eye; adjacent links touch metal-on-metal (tì vào nhau)
                    lk.position.set(0, topFar - (i + 0.5) * prevPitch, 0);
                    if (i % 2) lk.rotation.y = Math.PI / 2;
                    lk.scale.set(prevScale, prevScale, prevScale);
                    g.add(lk);
                }
                const botHook = createChainEndHardwareGroup(false);
                botHook.position.set(0, topFar - prevCount * prevPitch, 0); // +Y upward into chain
                g.add(botHook);
                return g;
            }
            if (presetId === 'sling_web') {
                g.name = 'Synthetic_Web_Sling';
                const webMat = (typeof window !== 'undefined' && window.getDynamicSlingMaterial)
                    ? window.getDynamicSlingMaterial('web', 2.0)
                    : MATS.webGreen;
                const flatBand = new THREE.Mesh(new THREE.BoxGeometry(0.12, 2.30, 0.02), webMat);
                const eyeA = createWebEyeSleeveGroup();
                eyeA.position.set(0, 1.25, 0);
                eyeA.rotation.z = Math.PI;
                const eyeB = createWebEyeSleeveGroup();
                eyeB.position.set(0, -1.25, 0);
                eyeA.traverse(m => { if (m.isMesh && (m.name === 'Web_Eye_Loop' || m.name === 'Web_Cuff')) m.material = webMat; });
                eyeB.traverse(m => { if (m.isMesh && (m.name === 'Web_Eye_Loop' || m.name === 'Web_Cuff')) m.material = webMat; });
                g.add(flatBand, eyeA, eyeB);
                return g;
            }
            if (presetId === 'sling_round') {
                g.name = 'Round_Sling';
                const roundMat = (typeof window !== 'undefined' && window.getDynamicSlingMaterial)
                    ? window.getDynamicSlingMaterial('round_sling', 4.0)
                    : (MATS.webGreen || MATS.wireRope);
                const roundLoop = new THREE.Mesh(
                    new THREE.TorusGeometry(0.85, 0.046, 18, 48),
                    roundMat
                );
                roundLoop.scale.set(0.42, 1.45, 1.0);
                const tagGroup = createRoundSlingTagGroup();
                tagGroup.position.set(0.35, 0, 0);
                g.add(roundLoop, tagGroup);
                return g;
            }
            if (presetId === 'sling_grommet') {
                g.name = 'Grommet_Sling';
                const grommetLoop = new THREE.Mesh(
                    new THREE.TorusGeometry(0.95, 0.044, 18, 52),
                    MATS.wireRope
                );
                grommetLoop.scale.set(0.45, 1.45, 1.0);
                const topSeize = createGrommetSeizingEyeGroup();
                topSeize.position.set(0, 1.35, 0);
                topSeize.rotation.z = Math.PI;
                const botSeize = createGrommetSeizingEyeGroup();
                botSeize.position.set(0, -1.35, 0);
                g.add(grommetLoop, topSeize, botSeize);
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

        // Helper: Stadium Curve for Grade-80 Oval Links (EN 818-2 Standard)
        // straightHalf default = 13 mm → inside length 2*(sH+R-tubeR) = 3d @ 16 mm stock
        class StadiumCurve extends THREE.Curve {
            constructor(straightHalf = 0.013, radius = 0.019) {
                super();
                this.sH = straightHalf;
                this.R = radius;
                this.arcLen = Math.PI * radius;
                this.straightLen = 2 * straightHalf;
                this.totalLen = 2 * this.straightLen + 2 * this.arcLen;
            }
            getPoint(t, optionalTarget = new THREE.Vector3()) {
                const s = t * this.totalLen;
                const R = this.R;
                const sH = this.sH;
                if (s <= this.straightLen) {
                    const u = s / this.straightLen;
                    return optionalTarget.set(R, -sH + u * 2 * sH, 0);
                }
                const s2 = s - this.straightLen;
                if (s2 <= this.arcLen) {
                    const ang = (s2 / this.arcLen) * Math.PI;
                    return optionalTarget.set(R * Math.cos(ang), sH + R * Math.sin(ang), 0);
                }
                const s3 = s2 - this.arcLen;
                if (s3 <= this.straightLen) {
                    const u = s3 / this.straightLen;
                    return optionalTarget.set(-R, sH - u * 2 * sH, 0);
                }
                const s4 = s3 - this.straightLen;
                const ang = Math.PI + (s4 / this.arcLen) * Math.PI;
                return optionalTarget.set(R * Math.cos(ang), -sH + R * Math.sin(ang), 0);
            }
        }

        function mergeBufferGeometries(geos) {
            let totalPos = 0, totalIdx = 0;
            geos.forEach(g => {
                totalPos += g.attributes.position.count;
                totalIdx += g.index ? g.index.count : 0;
            });
            const positions = new Float32Array(totalPos * 3);
            const normals = new Float32Array(totalPos * 3);
            const uvs = new Float32Array(totalPos * 2);
            const indices = totalIdx > 0 ? (totalPos > 65535 ? new Uint32Array(totalIdx) : new Uint16Array(totalIdx)) : null;

            let posOffset = 0, idxOffset = 0, vertexOffset = 0;
            geos.forEach(g => {
                positions.set(g.attributes.position.array, posOffset * 3);
                if (g.attributes.normal) normals.set(g.attributes.normal.array, posOffset * 3);
                if (g.attributes.uv) uvs.set(g.attributes.uv.array, posOffset * 2);
                if (indices && g.index) {
                    for (let i = 0; i < g.index.count; i++) {
                        indices[idxOffset + i] = g.index.array[i] + vertexOffset;
                    }
                    idxOffset += g.index.count;
                }
                vertexOffset += g.attributes.position.count;
                posOffset += g.attributes.position.count;
            });
            const merged = new THREE.BufferGeometry();
            merged.setAttribute('position', new THREE.BufferAttribute(positions, 3));
            merged.setAttribute('normal', new THREE.BufferAttribute(normals, 3));
            merged.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
            if (indices) merged.setIndex(new THREE.BufferAttribute(indices, 1));
            return merged;
        }

        function createGrommetDoubleStrandGeometry(radius = 0.013, length = 1.0, sep = 0.024) {
            const geo1 = createHelicalWireStrandGeometry(radius, length, 12, 4);
            geo1.translate(-sep * 0.5, 0, 0);
            const geo2 = createHelicalWireStrandGeometry(radius, length, 12, 4);
            geo2.translate(sep * 0.5, 0, 0);
            return mergeBufferGeometries([geo1, geo2]);
        }

        // Grade-80 / Grade-100 short-link chain per EN 818-2 / ASME B30.9 @ 16 mm nominal stock:
        //   d = 16 mm, inside pitch p = 3d = 48 mm, inside width w = 22 mm (~1.38d)
        //   centerline radius R = (w + d) / 2 = (22 + 16) / 2 = 19 mm = 0.019 m
        //   stock radius tubeR = d / 2 = 8 mm = 0.008 m
        //   straight half sH = p / 2 - (R - tubeR) = 24 - 11 = 13 mm = 0.013 m
        // Center-to-center pitch under tension:
        //   Adjacent links pull taut against each other until inner saddle contacts kiss metal-on-metal:
        //   p_taut = 2 * (sH + R - tubeR) = 2 * (13 + 19 - 8) = 48 mm = 0.048 m = 3d.
        const CHAIN_LINK_MAJOR = 0.019;     // centerline half-width (m) @ 16 mm stock
        const CHAIN_LINK_TUBE = 0.008;      // stock radius (m) @ 16 mm stock
        const CHAIN_LINK_STRAIGHT = 0.013;  // stadium straight half → inside length = 48 mm
        const CHAIN_LINK_GEO = new THREE.TubeGeometry(
            new StadiumCurve(CHAIN_LINK_STRAIGHT, CHAIN_LINK_MAJOR), 28, CHAIN_LINK_TUBE, 12, true
        );
        const CHAIN_NOMINAL_PITCH = 2 * (CHAIN_LINK_STRAIGHT + CHAIN_LINK_MAJOR - CHAIN_LINK_TUBE); // 0.048 m (EN 818-2 pitch p = 3d @ 16mm stock)
        const CHAIN_NEST_PITCH = CHAIN_NOMINAL_PITCH;

        function createOvalChainLinkGroup() {
            const mesh = new THREE.Mesh(CHAIN_LINK_GEO, MATS.chainDark);
            mesh.castShadow = false;
            mesh.receiveShadow = false;
            mesh.userData.linkPitch = CHAIN_NEST_PITCH;
            return mesh;
        }

        // Shared reusable geometries for high-performance 60fps rendering across all 5 sling types
        const WIRE_SEG_GEO = createHelicalWireStrandGeometry(0.018, 1.0, 18, 6);
        const ROUND_SEG_GEO = createRoundSlingWrinkleGeometry(0.018, 1.0, 16, 6);
        // Unit webbing strap: local Y = length, X = width, Z = thickness (thin fabric)
        const WEB_SEG_GEO = new THREE.BoxGeometry(1.0, 1.0, 1.0);
        const GROMMET_SEG_GEO = createGrommetDoubleStrandGeometry(0.013, 1.0, 0.024);

        function createArticulated3DSling(numSegments, numLinks) {
            const group = new THREE.Group();
            const segments = [];
            const nSeg = Math.max(8, numSegments | 0);
            const nLink = Math.max(nSeg, Math.max(numLinks | 0, 500));

            const endEyeA = createSlingEyeTerminationGroup();
            const endEyeB = createSlingEyeTerminationGroup();
            const webEyeA = createWebEyeSleeveGroup();
            const webEyeB = createWebEyeSleeveGroup();
            const chainTopA = createChainEndHardwareGroup(true);
            const chainBotB = createChainEndHardwareGroup(false);
            const roundTag = createRoundSlingTagGroup();
            const grommetEyeA = createGrommetSeizingEyeGroup();
            const grommetEyeB = createGrommetSeizingEyeGroup();
            const turnbuckle = createInlineTurnbuckleGroup();
            group.add(endEyeA, endEyeB, webEyeA, webEyeB, chainTopA, chainBotB, roundTag, grommetEyeA, grommetEyeB, turnbuckle);

            const segGeo = WIRE_SEG_GEO;
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
                chainTopA,
                chainBotB,
                roundTag,
                grommetEyeA,
                grommetEyeB,
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
                    const geom = (typeof resolveDeckOogGeometry === 'function')
                        ? resolveDeckOogGeometry(L, W, H, deckTopY)
                        : null;
                    const cL = geom ? geom.cL : THREE.MathUtils.clamp(state.oogCargoL || L * 0.72, 1.5, 14.5);
                    const cW = geom ? geom.cW : THREE.MathUtils.clamp(state.oogCargoW || W * 1.28, 1.0, 5.2);
                    const cH = geom ? geom.cH : THREE.MathUtils.clamp(state.oogCargoH || H * 1.08, 0.8, 4.8);
                    const dunnageTopY = deckTopY + (geom ? geom.dunnageH : 0.12);
                    const baseOx = geom ? geom.offsetX : (state.oogCargoOffsetX || 0);
                    const baseOz = geom ? geom.offsetZ : (state.oogCargoOffsetZ || 0);
                    const ox = baseOx + ((oogStatus === 'sliding' && phy.oogState) ? phy.oogState.localPos.x : 0);
                    const oz = baseOz + ((oogStatus === 'sliding' && phy.oogState) ? phy.oogState.localPos.z : 0);
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
                // Full bus / vehicle envelope — ropes must hug the outer shell, never chord through cabin glass
                const bodyHx = L * 0.495 + p;
                const bodyHy = H * 0.48 + p;
                const bodyHz = W * 0.48 + p;
                releaseLocalBox(q, 0, H * 0.02, 0, bodyHx, bodyHy, bodyHz, up);
                // Slightly narrower roof crown so side-hug paths stay on the exterior flanks
                releaseLocalBox(q, 0, H * 0.28, 0, L * 0.46 + p, H * 0.22 + p, W * 0.44 + p, up);
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
            const oogTopLocalY = (state.cargoType === 'flatrack' && typeof resolveDeckOogGeometry === 'function')
                ? resolveDeckOogGeometry(state.L, state.W, state.H).cargoTopY
                : (-state.H * 0.5 + (state.cargoType === 'flatrack' ? 0.42 : 0.18) + (state.oogCargoH || state.H));
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
                    const geom = (typeof resolveDeckOogGeometry === 'function')
                        ? resolveDeckOogGeometry(L, W, H, deckTopY)
                        : null;
                    const cL = geom ? geom.cL : THREE.MathUtils.clamp(state.oogCargoL || L * 0.72, 1.5, 14.5);
                    const cW = geom ? geom.cW : THREE.MathUtils.clamp(state.oogCargoW || W * 1.28, 1.0, 5.2);
                    const cH = geom ? geom.cH : THREE.MathUtils.clamp(state.oogCargoH || H * 1.08, 0.8, 4.8);
                    const dunnageTopY = deckTopY + (geom ? geom.dunnageH : 0.12);
                    const baseOx = geom ? geom.offsetX : (state.oogCargoOffsetX || 0);
                    const baseOz = geom ? geom.offsetZ : (state.oogCargoOffsetZ || 0);
                    return {
                        ox: baseOx + ((st === 'sliding' && phy.oogState) ? phy.oogState.localPos.x : 0),
                        oy: dunnageTopY + cH * 0.5,
                        oz: baseOz + ((st === 'sliding' && phy.oogState) ? phy.oogState.localPos.z : 0),
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

            if (!solid || loc.y < -state.H * 0.5 - 0.15) return q;

            const ax = Math.abs(loc.x - solid.ox);
            const az = Math.abs(loc.z - solid.oz);
            const inSolidXZ = ax <= solid.hx - p * 0.25 && az <= solid.hz - p * 0.25;

            // Side-hug: below the top bevel of the main solid → eject out the nearest side/shell face, do NOT teleport to roof!
            if (loc.y < solid.roofY - 0.22) {
                const nearFaceX = az <= solid.hz + p * 1.25 && ax >= solid.hx - p * 2.4 && ax <= solid.hx + p * 1.25;
                const nearFaceZ = ax <= solid.hx + p * 1.25 && az >= solid.hz - p * 2.4 && az <= solid.hz + p * 1.25;
                if (nearFaceX || nearFaceZ) {
                    if (nearFaceX && (!nearFaceZ || (solid.hx - ax) <= (solid.hz - az))) {
                        loc.x = solid.ox + Math.sign(loc.x - solid.ox || 1) * (solid.hx + p * 0.45);
                    } else {
                        loc.z = solid.oz + Math.sign(loc.z - solid.oz || 1) * (solid.hz + p * 0.45);
                    }
                }
                // Always resolve against true 3D cargo shell (deck, bulkheads, OOG box) without forced upward roof teleport
                const pushed = pushOutOfCargoShellLocal(loc, p, false);
                return pushed.applyQuaternion(phy.cargoQuat).add(phy.cargoPos);
            }

            // Near or above the roof surface and inside the solid XZ footprint → rest on top of the roof
            if (inSolidXZ) {
                const roofY = cargoRoofAtXZ(q.x, q.z, p);
                if (roofY != null && q.y < roofY) q.y = roofY;
            }
            const loc2 = q.clone().sub(phy.cargoPos).applyQuaternion(invQ);
            const pushed2 = pushOutOfCargoShellLocal(loc2, p, inSolidXZ);
            const w2 = pushed2.applyQuaternion(phy.cargoQuat).add(phy.cargoPos);
            if (inSolidXZ) {
                const roofY = cargoRoofAtXZ(w2.x, w2.z, p);
                if (roofY != null && w2.y < roofY) w2.y = roofY;
            }
            return w2;
        }

        function pushPointClear(p, rad, skip) {
            const q = p.clone();
            const skipSet = skip || new Set();
            const ropePad = Math.max(0.024, rad || 0.024);
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

        // Taut wrap: climb the flank to the roof-edge corner, then go straight to
        // the high pin. Leave point sits ON the cargo corner — no outward bulge.
        function seedTautCornerWrap(pointA, pointB, solid, pad, minBendR) {
            const locA = cargoLocalFromWorld(pointA);
            const locB = cargoLocalFromWorld(pointB);
            // Only a hair of clearance so the leave point reads as the true corner
            const p = Math.max(0.008, Math.min(0.018, (pad || 0.028) * 0.45));
            const highIsA = locA.y >= locB.y;
            const locHigh = highIsA ? locA : locB;
            const locLow = highIsA ? locB : locA;
            const wHigh = highIsA ? pointA.clone() : pointB.clone();
            const wLow = highIsA ? pointB.clone() : pointA.clone();

            const faceScoreZ = Math.abs(locLow.z - solid.oz) / Math.max(1e-4, solid.hz);
            const faceScoreX = Math.abs(locLow.x - solid.ox) / Math.max(1e-4, solid.hx);
            const useZFace = faceScoreZ >= faceScoreX * 0.85;

            // Geodesic leave point = projection of the high pin onto the contacted roof edge
            // (clamped). That makes free-air run straight into the corner, not loop outside.
            let edgeLocal;
            let outN;
            if (useZFace) {
                const sz = Math.sign(locLow.z - solid.oz) || 1;
                const edgeX = THREE.MathUtils.clamp(locHigh.x, solid.ox - solid.hx, solid.ox + solid.hx);
                edgeLocal = new THREE.Vector3(edgeX, solid.roofY, solid.oz + sz * (solid.hz + p));
                outN = new THREE.Vector3(0, 0, sz);
            } else {
                const sx = Math.sign(locLow.x - solid.ox) || 1;
                const edgeZ = THREE.MathUtils.clamp(locHigh.z, solid.oz - solid.hz, solid.oz + solid.hz);
                edgeLocal = new THREE.Vector3(solid.ox + sx * (solid.hx + p), solid.roofY, edgeZ);
                outN = new THREE.Vector3(sx, 0, 0);
            }

            const wCorner = cargoWorldFromLocal(edgeLocal);
            const ctrl = [wLow];

            // Climb on the exterior face from lug up to the roof-edge corner
            for (let i = 1; i <= 6; i++) {
                const t = i / 6;
                const loc = new THREE.Vector3(
                    THREE.MathUtils.lerp(locLow.x, edgeLocal.x, t),
                    THREE.MathUtils.lerp(locLow.y, edgeLocal.y, t),
                    THREE.MathUtils.lerp(locLow.z, edgeLocal.z, t)
                );
                if (useZFace) {
                    loc.z = solid.oz + Math.sign(outN.z) * (solid.hz + p);
                    loc.x = THREE.MathUtils.clamp(loc.x, solid.ox - solid.hx, solid.ox + solid.hx);
                } else {
                    loc.x = solid.ox + Math.sign(outN.x) * (solid.hx + p);
                    loc.z = THREE.MathUtils.clamp(loc.z, solid.oz - solid.hz, solid.oz + solid.hz);
                }
                // Last climb sample snaps exactly onto the corner
                if (i === 6) loc.copy(edgeLocal);
                ctrl.push(cargoWorldFromLocal(loc));
            }

            // Free-air taut segment starts AT the corner and goes straight to the high pin
            for (let i = 1; i <= 10; i++) {
                ctrl.push(wCorner.clone().lerp(wHigh, i / 10));
            }
            ctrl[ctrl.length - 1].copy(wHigh);

            if (highIsA) ctrl.reverse();
            return ctrl;
        }

        // If a rendered segment still cuts the cargo solid, push the crest to the
        // nearest exterior flank / roof-edge — never drag mid-span across the lid.
        function routeRopeAroundCargo(pts, pad) {
            if (!pts || pts.length < 2) return pts || [];
            const solid = cargoWrapSolid(pad);
            if (!solid) return pts.map(p => p.clone());
            const ropePad = Math.max(0.02, pad || 0.028);
            let out = pts.map(p => p.clone());
            const ends = [out[0].clone(), out[out.length - 1].clone()];

            for (let pass = 0; pass < 2; pass++) {
                const next = [out[0].clone()];
                let changed = false;
                for (let i = 0; i < out.length - 1; i++) {
                    const a = out[i];
                    const b = out[i + 1];
                    let deepest = null;
                    for (let s = 1; s <= 10; s++) {
                        const t = s / 11;
                        const w = a.clone().lerp(b, t);
                        const loc = cargoLocalFromWorld(w);
                        const dx = Math.abs(loc.x - solid.ox) - solid.hx;
                        const dy = Math.abs(loc.y - solid.oy) - solid.hy;
                        const dz = Math.abs(loc.z - solid.oz) - solid.hz;
                        if (dx < 0 && dy < 0 && dz < 0) {
                            const depth = Math.min(-dx, -dy, -dz);
                            if (!deepest || depth > deepest.depth) deepest = { loc, depth };
                        }
                    }
                    if (deepest) {
                        const loc = deepest.loc.clone();
                        const toX = solid.hx - Math.abs(loc.x - solid.ox);
                        const toZ = solid.hz - Math.abs(loc.z - solid.oz);
                        const toRoof = solid.roofY - loc.y;
                        const clear = Math.min(0.014, ropePad * 0.55);
                        const crestLocal = loc.clone();
                        // Snap to the nearest exterior face / roof-edge corner — no outward loop
                        if (toRoof + 0.06 < Math.min(toX, toZ)) {
                            crestLocal.y = solid.roofY + clear * 0.5;
                            if (toX <= toZ) crestLocal.x = solid.ox + Math.sign(loc.x - solid.ox || 1) * (solid.hx + clear);
                            else crestLocal.z = solid.oz + Math.sign(loc.z - solid.oz || 1) * (solid.hz + clear);
                        } else if (toX <= toZ) {
                            crestLocal.x = solid.ox + Math.sign(loc.x - solid.ox || 1) * (solid.hx + clear);
                        } else {
                            crestLocal.z = solid.oz + Math.sign(loc.z - solid.oz || 1) * (solid.hz + clear);
                        }
                        next.push(cargoWorldFromLocal(crestLocal));
                        changed = true;
                    }
                    next.push(b.clone());
                }
                out = next;
                for (let i = 1; i < out.length - 1; i++) {
                    out[i] = ejectFromCargoSolid(out[i], ropePad, solid);
                }
                out[0].copy(ends[0]);
                out[out.length - 1].copy(ends[1]);
                if (!changed) break;
            }
            return out;
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
        // Too long → take up toward chord; too short → deepen vertical gravity belly ONLY (never scale horizontal X/Z!).
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

            const clampSolidRoof = (p) => {
                if (!solid) return;
                const loc = cargoLocalFromWorld(p);
                if (Math.abs(loc.x - solid.ox) <= solid.hx && Math.abs(loc.z - solid.oz) <= solid.hz && loc.y >= solid.bottomY - 0.10) {
                    const roofY = cargoRoofAtXZ(p.x, p.z, pad * 0.35);
                    if (roofY != null && p.y < roofY) p.y = roofY;
                }
            };

            // Straight reference (clear of lid only where actually crossing solid footprint)
            const str = [];
            for (let i = 0; i <= N; i++) {
                const p = new THREE.Vector3().lerpVectors(pointA, pointB, i / N);
                clampSolidRoof(p);
                str.push(p);
            }
            str[0].copy(pointA);
            str[N].copy(pointB);

            let len = measure(out);
            // Path longer than L0: blend toward straight reference until arc === L0 within < 0.2 mm
            if (len > target + 0.0002) {
                const pureStr = [];
                for (let i = 0; i <= N; i++) {
                    pureStr.push(new THREE.Vector3().lerpVectors(pointA, pointB, i / N));
                }
                const strLen = measure(str);
                const ref = (strLen <= target + 0.0001) ? str : pureStr;
                let lo = 0;
                let hi = 1;
                for (let k = 0; k < 28; k++) {
                    const mid = 0.5 * (lo + hi);
                    for (let i = 1; i < N; i++) {
                        out[i].copy(pts[i]).lerp(ref[i], mid);
                    }
                    out[0].copy(pointA);
                    out[N].copy(pointB);
                    len = measure(out);
                    if (len > target) lo = mid;
                    else hi = mid;
                }
                const blend = 0.5 * (lo + hi);
                for (let i = 1; i < N; i++) out[i].copy(pts[i]).lerp(ref[i], blend);
            } else if (len < target - 0.0002) {
                // Path shorter than L0: deepen vertical gravity belly (-Y) ONLY.
                // NEVER scale horizontal (X, Z) offsets!
                const base = out.map(p => p.clone());
                let lo = 0;
                let hi = Math.max(0.35, (target - chord) * 1.45);
                for (let k = 0; k < 28; k++) {
                    const sag = 0.5 * (lo + hi);
                    for (let i = 1; i < N; i++) {
                        const t = i / N;
                        out[i].copy(base[i]);
                        out[i].y -= sag * Math.sin(t * Math.PI);
                        clampSolidRoof(out[i]);
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
        // Driven by chord→L0 take-up only. Tension must NOT make a short chord look taut
        // (that caused "straight then stretch like rubber" while the hook rose).
        function ropeTautness(chord, L0, tension, swl) {
            const rest = Math.max(0.2, L0 || chord);
            const c = Math.max(0.001, chord);
            if (c >= rest - 0.012) return 1.0;
            const slackFrac = THREE.MathUtils.clamp((rest - c) / Math.max(0.1, rest * 0.5), 0, 1);
            const lengthTaut = 1 - slackFrac;
            // Tiny load hint only in the last ~8% of take-up
            const near = c >= rest * 0.92;
            const loadTaut = near
                ? THREE.MathUtils.clamp((tension || 0) / Math.max(0.08, (swl || 5) * 0.12), 0, 0.25)
                : 0;
            const t = THREE.MathUtils.clamp(lengthTaut * 0.92 + loadTaut * 0.08, 0, 1);
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
            const N = 40;
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

            // Check whether the A→B span actually crosses over/into the main solid footprint in local (X, Z)
            let spanCrossesSolid = false;
            let endsNearRoof = false;
            if (solid) {
                const locA = cargoLocalFromWorld(pointA);
                const locB = cargoLocalFromWorld(pointB);
                const marginY = 1.5;
                const nearY = (Math.max(locA.y, locB.y) >= solid.bottomY - marginY) && (Math.min(locA.y, locB.y) <= solid.roofY + 4.0);
                endsNearRoof = (Math.max(locA.y, locB.y) >= solid.roofY - 0.45);

                if (nearY) {
                    const bothOutsidePosX = (locA.x - solid.ox > solid.hx + pad * 0.5) && (locB.x - solid.ox > solid.hx + pad * 0.5);
                    const bothOutsideNegX = (locA.x - solid.ox < -solid.hx - pad * 0.5) && (locB.x - solid.ox < -solid.hx - pad * 0.5);
                    const bothOutsidePosZ = (locA.z - solid.oz > solid.hz + pad * 0.5) && (locB.z - solid.oz > solid.hz + pad * 0.5);
                    const bothOutsideNegZ = (locA.z - solid.oz < -solid.hz - pad * 0.5) && (locB.z - solid.oz < -solid.hz - pad * 0.5);

                    if (!bothOutsidePosX && !bothOutsideNegX && !bothOutsidePosZ && !bothOutsideNegZ) {
                        for (let s = 0; s <= 16; s++) {
                            const t = s / 16;
                            const lx = locA.x + (locB.x - locA.x) * t;
                            const lz = locA.z + (locB.z - locA.z) * t;
                            if (Math.abs(lx - solid.ox) <= solid.hx + pad * 0.5 && Math.abs(lz - solid.oz) <= solid.hz + pad * 0.5) {
                                spanCrossesSolid = true;
                                break;
                            }
                        }
                    }
                }
            }

            // If the free chord would pierce the shell: taut legs wrap the flank→corner
            // then go straight up to the high pin. Slack legs may still drape on the lid.
            let minCorner = chord;
            let sideWrapLen = chord;
            if (solid && (spanCrossesSolid || needsRoof)) {
                const locA = cargoLocalFromWorld(pointA);
                const locB = cargoLocalFromWorld(pointB);
                const locHigh = locA.y >= locB.y ? locA : locB;
                const locLow = locA.y >= locB.y ? locB : locA;
                const climb = Math.max(0, solid.roofY - locLow.y);
                const freeAir = Math.hypot(
                    locHigh.x - THREE.MathUtils.clamp(locLow.x, solid.ox - solid.hx, solid.ox + solid.hx),
                    Math.max(0, locHigh.y - solid.roofY),
                    locHigh.z - (Math.abs(locLow.z - solid.oz) >= Math.abs(locLow.x - solid.ox)
                        ? solid.oz + Math.sign(locLow.z - solid.oz || 1) * solid.hz
                        : locLow.z)
                );
                sideWrapLen = climb + freeAir + minR * 0.5;
                minCorner = Math.max(chord + minR * 0.35, sideWrapLen);
            }
            const mustWrapExterior = !!(solid && (needsRoof || spanCrossesSolid) && chordNeedsRoofDrape(pointA, pointB, 24, pad));
            const tautWrap = mustWrapExterior && (tautness >= 0.55 || slack <= 0.12);
            const canDrape = L0 >= minCorner - 0.05;
            const useLidDrape = !!(solid && spanCrossesSolid && !tautWrap
                && canDrape && (needsRoof || (slack > 0.06 && endsNearRoof)));
            const wrapTarget = mustWrapExterior ? Math.max(targetLen, minCorner + pad) : targetLen;

            let pts;
            if (tautWrap) {
                const seed = seedTautCornerWrap(pointA, pointB, solid, pad, minR);
                pts = resamplePolyline(seed, N);
            } else if (useLidDrape) {
                const seed = seedSurfaceDrape(pointA, pointB, solid, pad, wrapTarget, minR);
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

            if (useLidDrape && tautness < 0.92) {
                const grav = (1 - tautness) * (0.7 + Math.min(1.0, slack / Math.max(0.2, targetLen * 0.15)));
                settleSoftRope(pts, wrapTarget, pad, ends, allowA, allowB, grav, solid, minR);
            }

            if (tautWrap && solid) {
                // Keep the corner-wrap silhouette; never blend back toward a piercing chord
                // or glue free-air nodes onto the roof lid (that made the false 90° kink).
                for (let i = 1; i < pts.length - 1; i++) {
                    const locI = cargoLocalFromWorld(pts[i]);
                    const belowCrest = locI.y < solid.roofY + pad;
                    const onFlankBand = Math.abs(locI.z - solid.oz) >= solid.hz - pad * 2
                        || Math.abs(locI.x - solid.ox) >= solid.hx - pad * 2;
                    if (belowCrest && onFlankBand) {
                        pts[i] = ejectFromCargoSolid(pts[i], pad, solid);
                    } else {
                        const dx = Math.abs(locI.x - solid.ox) - solid.hx;
                        const dy = Math.abs(locI.y - solid.oy) - solid.hy;
                        const dz = Math.abs(locI.z - solid.oz) - solid.hz;
                        if (dx < 0 && dy < 0 && dz < 0) pts[i] = ejectFromCargoSolid(pts[i], pad, solid);
                    }
                }
            } else if (useLidDrape && solid) {
                pts = fitPathToFixedLength(pts, pointA, pointB, wrapTarget, solid, pad);
                for (let i = 1; i < pts.length - 1; i++) {
                    const locI = cargoLocalFromWorld(pts[i]);
                    if (Math.abs(locI.x - solid.ox) <= solid.hx && Math.abs(locI.z - solid.oz) <= solid.hz) {
                        const roofY = cargoRoofAtXZ(pts[i].x, pts[i].z, pad * 0.35);
                        if (roofY != null && pts[i].y < roofY) pts[i].y = roofY;
                    } else {
                        pts[i] = ejectFromCargoSolid(pts[i], pad, solid);
                    }
                }
                pts = fitPathToFixedLength(pts, pointA, pointB, wrapTarget, solid, pad);
            } else if (!mustWrapExterior) {
                pts = fitPathToFixedLength(pts, pointA, pointB, targetLen, null, pad);
            }

            pts = routeRopeAroundCargo(pts, pad);
            pts[0].copy(pointA);
            pts[pts.length - 1].copy(pointB);
            return pts;
        }

        function slingPathPoints(pointA, pointB, fixedLen, meta) {
            return solveDrapedRopePath(pointA, pointB, fixedLen, 0.024, ['hook'], [], meta || { role: 'leg', broken: false });
        }

        // Broken stub path: whip may swing the tip, but the settled shape is a
        // near-vertical hang under the pin — tip points straight down (no fishhook).
        function buildBrokenStubHangPath(pin, tip, ropeLen, N, settleAmt) {
            const n = Math.max(4, N | 0);
            const L = Math.max(0.12, ropeLen || pin.distanceTo(tip));
            const settle = THREE.MathUtils.clamp(settleAmt != null ? settleAmt : 0, 0, 1);
            // Blend tip toward vertical hang under pin as settle → 1
            const floorY = (typeof supportY === 'function') ? supportY(pin.x, pin.z) + 0.03 : (pin.y - L);
            const hangTip = new THREE.Vector3(
                pin.x,
                pin.y - Math.min(L * 0.995, Math.max(0.12, pin.y - floorY)),
                pin.z
            );
            if (typeof pushPointClear === 'function') {
                hangTip.copy(pushPointClear(hangTip, 0.03, new Set()));
                if (hangTip.y > pin.y - 0.05) {
                    hangTip.set(pin.x, pin.y - Math.min(L * 0.9, 0.35), pin.z);
                }
            }
            const end = tip.clone().lerp(hangTip, settle * 0.92);
            // Keep tip at/below pin and within rest length
            if (end.y > pin.y - 0.02) end.y = pin.y - 0.06;
            const rel = end.clone().sub(pin);
            const dist = rel.length();
            if (dist > L && dist > 1e-6) end.copy(pin).addScaledVector(rel.multiplyScalar(1 / dist), L);

            const pts = [];
            for (let i = 0; i <= n; i++) {
                const t = i / n;
                // Mostly straight hang; tiny pendulum bow only while still swinging
                const swing = (1 - settle) * 0.18;
                const bow = Math.sin(Math.PI * t) * swing;
                const p = pin.clone().lerp(end, t);
                // Lateral bow in the pin→tip horizontal direction (not upward)
                const latx = end.x - pin.x;
                const latz = end.z - pin.z;
                const latLen = Math.hypot(latx, latz);
                if (latLen > 1e-5 && swing > 0.01) {
                    p.x += (-latz / latLen) * bow * latLen;
                    p.z += (latx / latLen) * bow * latLen;
                }
                // Force monotonic drop — never climb toward the tip
                if (i > 0 && p.y > pts[i - 1].y - 0.001) {
                    p.y = pts[i - 1].y - Math.max(0.004, (pin.y - end.y) / n);
                }
                pts.push(p);
            }
            pts[0].copy(pin);
            pts[pts.length - 1].copy(end);
            // Last segment always faces down
            if (pts.length >= 2) {
                const last = pts[pts.length - 1];
                const prev = pts[pts.length - 2];
                if (last.y >= prev.y) last.y = prev.y - 0.02;
                // When settled, straighten last third onto the vertical
                if (settle > 0.35) {
                    for (let i = Math.floor(pts.length * 0.55); i < pts.length; i++) {
                        const t = (i - Math.floor(pts.length * 0.55)) / Math.max(1, pts.length - 1 - Math.floor(pts.length * 0.55));
                        const y = THREE.MathUtils.lerp(pts[Math.floor(pts.length * 0.55)].y, end.y, t);
                        pts[i].x = THREE.MathUtils.lerp(pts[i].x, end.x, settle);
                        pts[i].z = THREE.MathUtils.lerp(pts[i].z, end.z, settle);
                        pts[i].y = Math.min(pts[i].y, y);
                    }
                    pts[pts.length - 1].copy(end);
                }
            }
            return pts;
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

            // Near-vertical span (h < 0.06m): form a natural vertical U-loop with tiny lateral separation
            // so the downward and upward strands do not fold 180° onto the exact same line.
            const dx = B.x - A.x, dz = B.z - A.z;
            const h = Math.hypot(dx, dz);
            const spreadDir = new THREE.Vector3();
            if (h > 1e-4) {
                spreadDir.set(dx / h, 0, dz / h);
            } else {
                const mid = A.clone().add(B).multiplyScalar(0.5).sub(phy.cargoPos || new THREE.Vector3());
                mid.y = 0;
                if (mid.lengthSq() > 1e-4) spreadDir.copy(mid.normalize());
                else spreadDir.set(1, 0, 0);
            }
            const spreadAmp = h < 0.06 ? Math.min(0.035, 0.5 * (0.06 - h) + 0.015) : 0;

            const dyBias = THREE.MathUtils.clamp((A.y - B.y) / Math.max(0.5, ropeLen), -0.35, 0.35);
            const buildSag = sag => {
                const pts = [A.clone()];
                for (let i = 1; i < N; i++) {
                    const t = i / N;
                    const s = Math.sin(t * Math.PI) * (1 + 0.22 * dyBias * (t - 0.5));
                    const p = new THREE.Vector3().lerpVectors(A, B, t);
                    p.y -= sag * s;
                    if (spreadAmp > 0) {
                        p.addScaledVector(spreadDir, spreadAmp * Math.sin(t * Math.PI));
                    }
                    pts.push(p);
                }
                pts.push(B.clone());
                return pts;
            };
            const arcLen = pts => polylineLength(pts);
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

        /** Chaikin corner-cutting — softens long gãy-đốt polylines into fluid bends. */
        function smoothSlingPolyline(pts, passes) {
            if (!pts || pts.length < 3) return pts || [];
            let cur = pts.map(p => p.clone());
            const nPass = Math.max(1, Math.min(3, passes | 0));
            for (let pass = 0; pass < nPass; pass++) {
                const next = [cur[0].clone()];
                for (let i = 0; i < cur.length - 1; i++) {
                    const a = cur[i];
                    const b = cur[i + 1];
                    next.push(a.clone().lerp(b, 0.25));
                    next.push(a.clone().lerp(b, 0.75));
                }
                next.push(cur[cur.length - 1].clone());
                // Keep endpoints exact; trim if explosion of points
                next[0].copy(pts[0]);
                next[next.length - 1].copy(pts[pts.length - 1]);
                cur = next;
            }
            return cur;
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

