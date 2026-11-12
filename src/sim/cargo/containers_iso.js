/**
 * cargo/containers_iso — ISO shells, flatrack, tank barrel
 * Split from legacy god-file (strangler Phase 2). Shared scope via assemble.
 */
/**
 * cargo — part of the lifting simulator.
 * These files are assembled into one module so they share state, physics and the scene.
 */
        // --- 6. BUILD 3D CARGO, TIMBER DUNNAGE & SPREADER BEAMS ---
        /** Floor cribbing intentionally omitted — propped blocks made static cargo sit proud of the ground. */
        function rebuildDunnageBlocks() {
            if (!dunnageGroup) return;
            while (dunnageGroup.children.length > 0) dunnageGroup.remove(dunnageGroup.children[0]);
            dunnageGroup.name = 'Timber_Dunnage';
            dunnageGroup.visible = false;
        }

        /**
         * ISO 1161 corner fittings — FIXED world size on every container length.
         * ~178 mm cube with aperture slots. No oversized black posts (those looked wrong vs CAD 20ft).
         */
        /** ISO 1161 top/side aperture centres from outer L×W (not phủ bì edge). */
        function isoCornerHoleHalf(L, W) {
            let spanX = 5.853;
            if (L >= 13.2) spanX = 13.557;
            else if (L >= 9.0) spanX = 11.985;
            const spanZ = 2.259;
            // Keep holes inside outer shell with standard casting inset
            const hx = Math.min(spanX * 0.5, L * 0.5 - 0.05);
            const hz = Math.min(spanZ * 0.5, W * 0.5 - 0.05);
            return { hx, hz, spanX: hx * 2, spanZ: hz * 2 };
        }

        /** Stamp ISO top twistlock holes on CAD containers (hole centres = ISO 1161 pitch). */
        function stampIsoTopTwistlockHoles(group, L, W, H) {
            const { hx, hz } = isoCornerHoleHalf(L, W);
            const holeMat = new THREE.MeshStandardMaterial({
                color: 0x05070a, roughness: 0.92, metalness: 0.15, side: THREE.DoubleSide
            });
            const ringMat = new THREE.MeshStandardMaterial({
                color: 0x1f2937, roughness: 0.55, metalness: 0.6, side: THREE.DoubleSide
            });
            const stamp = new THREE.Group();
            stamp.name = 'ISO_TopTwistlockHoles';
            [[1, 1], [-1, 1], [-1, -1], [1, -1]].forEach((s, i) => {
                const g = new THREE.Group();
                g.name = `ISO_Hole_${i}`;
                g.position.set(s[0] * hx, H / 2 + 0.002, s[1] * hz);
                const recess = new THREE.Mesh(new THREE.CylinderGeometry(0.052, 0.052, 0.02, 20), holeMat);
                const ring = new THREE.Mesh(new THREE.RingGeometry(0.052, 0.078, 20), ringMat);
                ring.rotation.x = -Math.PI / 2;
                ring.position.y = 0.012;
                g.add(recess, ring);
                stamp.add(g);
            });
            stamp.traverse(o => { o.userData.noLugWeld = true; });
            group.add(stamp);
            return stamp;
        }

        function addCornerCastings(group, L, W, H) {
            const CAST = 0.178;
            const half = CAST * 0.5;
            const { hx, hz } = isoCornerHoleHalf(L, W);
            const boxGeo = new THREE.BoxGeometry(CAST, CAST, CAST);
            const holeGeoX = new THREE.BoxGeometry(CAST + 0.01, 0.066, 0.092);
            const holeGeoY = new THREE.BoxGeometry(0.105, CAST + 0.01, 0.072);
            const holeGeoZ = new THREE.BoxGeometry(0.092, 0.066, CAST + 0.01);
            const holeMat = new THREE.MeshStandardMaterial({ color: 0x05070a, roughness: 0.9, metalness: 0.2 });
            const steel = MATS.darkSteel || MATS.gunmetal;
            // Casting body stays at outer corner; top/side hole discs sit on ISO 1161 centres
            [-1, 1].forEach(sx => [-1, 1].forEach(sy => [-1, 1].forEach(sz => {
                const ccGroup = new THREE.Group();
                ccGroup.name = 'ISO_CornerCasting';
                const body = new THREE.Mesh(boxGeo, steel.clone());
                body.position.set(
                    sx * (L / 2 - half) - sx * hx,
                    0,
                    sz * (W / 2 - half) - sz * hz
                );
                // Body local offset so group origin = ISO hole centre
                ccGroup.add(body);
                ccGroup.add(new THREE.Mesh(holeGeoX, holeMat));
                ccGroup.add(new THREE.Mesh(holeGeoY, holeMat));
                ccGroup.add(new THREE.Mesh(holeGeoZ, holeMat));
                ccGroup.position.set(sx * hx, sy * (H / 2 - half), sz * hz);
                group.add(ccGroup);
            })));
        }

        /** Map X so door/front ends keep native size; only the mid-body grows with target length. */
        function mapLengthPreserveEnds(x, L0, L1, keep) {
            const h0 = L0 * 0.5;
            const h1 = L1 * 0.5;
            const k = Math.min(keep, h0 * 0.42, h1 * 0.42);
            if (x <= -h0 + k) return x - (h0 - h1);
            if (x >= h0 - k) return x + (h1 - h0);
            const t = (x - (-h0 + k)) / Math.max(1e-6, L0 - 2 * k);
            return (-h1 + k) + t * (L1 - 2 * k);
        }

        /**
         * Lengthen authentic 20ft CAD into 40/HC/opentop:
         * - Door end + front end + corner castings stay unstretched
         * - Mid shell extends; then re-stamp side corrugation at fixed pitch (same look as 20ft)
         */
        function elongateIsoCadRoot(root, targetL, keep = 1.18) {
            root.updateMatrixWorld(true);
            const box = new THREE.Box3().setFromObject(root);
            const L0 = Math.max(0.5, box.max.x - box.min.x);
            if (Math.abs(targetL - L0) < 0.08) return L0;
            const _v = new THREE.Vector3();
            const _inv = new THREE.Matrix4();
            root.traverse(child => {
                if (!child.isMesh || !child.geometry || !child.geometry.attributes.position) return;
                let geo = child.geometry.clone();
                if (geo.index) geo = geo.toNonIndexed();
                child.geometry = geo;
                child.updateMatrixWorld(true);
                _inv.copy(child.matrixWorld).invert();
                const pos = geo.attributes.position;
                for (let i = 0; i < pos.count; i++) {
                    _v.fromBufferAttribute(pos, i).applyMatrix4(child.matrixWorld);
                    _v.x = mapLengthPreserveEnds(_v.x, L0, targetL, keep);
                    _v.applyMatrix4(_inv);
                    pos.setXYZ(i, _v.x, _v.y, _v.z);
                }
                pos.needsUpdate = true;
                geo.computeVertexNormals();
            });
            return L0;
        }

        /** Re-stamp vertical side corrugation at fixed pitch so lengthened CAD mid doesn't look stretched. */
        function restampSideCorrugation(group, L, W, H, bodyMat) {
            const pitch = 0.280;
            const inset = 1.05; // leave CAD door/front zones alone
            const depth = 0.045;
            const ribW = 0.095;
            const shoulderW = 0.155;
            const wallT = 0.02;
            const y0 = -H * 0.42;
            const ribH = H * 0.78;
            const mat = bodyMat.clone();
            for (let x = -L / 2 + inset; x <= L / 2 - inset + 1e-6; x += pitch) {
                [-1, 1].forEach(sz => {
                    const z0 = sz * (W / 2 - 0.01);
                    const lobe = new THREE.Mesh(new THREE.BoxGeometry(ribW, ribH, depth), mat);
                    lobe.position.set(x, y0 + ribH * 0.5, z0 + sz * (depth * 0.55));
                    lobe.castShadow = true;
                    group.add(lobe);
                    const sh = new THREE.Mesh(new THREE.BoxGeometry(shoulderW, ribH * 0.92, depth * 0.4), mat);
                    sh.position.set(x, y0 + ribH * 0.5, z0 + sz * (depth * 0.22));
                    group.add(sh);
                });
            }
            // Thin side skin fill so gaps between stretched CAD panels don't show
            [-1, 1].forEach(sz => {
                const span = Math.max(0.4, L - inset * 2);
                if (span < 0.5) return;
                const fill = new THREE.Mesh(new THREE.BoxGeometry(span, H * 0.72, wallT), mat);
                fill.position.set(0, 0, sz * (W / 2 - 0.04));
                fill.castShadow = true;
                group.add(fill);
            });
        }

        function tintIsoCadClone(clone, bodyColor) {
            const roughness = 0.42;
            const metalness = 0.28;
            clone.traverse(child => {
                if (!child.isMesh) return;
                child.castShadow = true;
                child.receiveShadow = true;
                if (Array.isArray(child.material)) {
                    child.material = [
                        new THREE.MeshStandardMaterial({
                            color: bodyColor, roughness, metalness, name: 'ContainerBody_Lengthened'
                        }),
                        new THREE.MeshStandardMaterial({
                            color: 0xe2e8f0, roughness: 0.22, metalness: 0.85, name: 'ContainerHardware_GalvanizedSteel'
                        })
                    ];
                } else {
                    child.material = new THREE.MeshStandardMaterial({ color: bodyColor, roughness, metalness });
                }
            });
            return new THREE.MeshStandardMaterial({ color: bodyColor, roughness, metalness });
        }

        function buildFrom20ftCadLengthened(group, type, L, W, H) {
            const proto = customCargoMeshes && customCargoMeshes['container_22g1'];
            if (!proto) return false;
            const clone = proto.clone(true);
            clone.updateMatrixWorld(true);

            if (type === 'opentop' && state.oogTarp === false) {
                clone.traverse(child => {
                    if (!child.isMesh || !child.geometry?.attributes?.position) return;
                    const geo = child.geometry;
                    const pos = geo.attributes.position;
                    const norm = geo.attributes.normal;
                    const uv = geo.attributes.uv;
                    const newPos = [];
                    const newNorm = norm ? [] : null;
                    const newUv = uv ? [] : null;
                    for (let i = 0; i < pos.count; i += 3) {
                        if (pos.getY(i) > 2.37 && pos.getY(i + 1) > 2.37 && pos.getY(i + 2) > 2.37) continue;
                        for (let j = 0; j < 3; j++) {
                            const idx = i + j;
                            newPos.push(pos.getX(idx), pos.getY(idx), pos.getZ(idx));
                            if (newNorm) newNorm.push(norm.getX(idx), norm.getY(idx), norm.getZ(idx));
                            if (newUv) newUv.push(uv.getX(idx), uv.getY(idx));
                        }
                    }
                    const openGeo = new THREE.BufferGeometry();
                    openGeo.setAttribute('position', new THREE.Float32BufferAttribute(newPos, 3));
                    if (newNorm) openGeo.setAttribute('normal', new THREE.Float32BufferAttribute(newNorm, 3));
                    if (newUv) openGeo.setAttribute('uv', new THREE.Float32BufferAttribute(newUv, 2));
                    openGeo.computeVertexNormals();
                    child.geometry = openGeo;
                });
            }

            const bodyColor = (type === 'iso40' || type === 'container_40ft_glb') ? 0x881337
                : (type === 'iso40hc' ? 0x065f46
                    : (type === 'opentop' ? 0x1d4ed8 : 0x1d4ed8));
            const bodyMat = tintIsoCadClone(clone, bodyColor);

            const bbox = new THREE.Box3().setFromObject(clone);
            const sz = new THREE.Vector3();
            bbox.getSize(sz);
            const center = new THREE.Vector3();
            bbox.getCenter(center);
            clone.position.sub(center);

            // Cross-section fit first (W/H), then lengthen X while preserving door/front
            if (sz.y > 0.01 && sz.z > 0.01) {
                clone.scale.y *= (H / sz.y);
                clone.scale.z *= (W / sz.z);
            }
            clone.updateMatrixWorld(true);
            const box2 = new THREE.Box3().setFromObject(clone);
            const L0 = box2.max.x - box2.min.x;
            const c2 = new THREE.Vector3();
            box2.getCenter(c2);
            clone.position.sub(c2);

            elongateIsoCadRoot(clone, L, 1.20);
            clone.updateMatrixWorld(true);
            const box3 = new THREE.Box3().setFromObject(clone);
            const c3 = new THREE.Vector3();
            box3.getCenter(c3);
            clone.position.sub(c3);

            group.add(clone);
            restampSideCorrugation(group, L, W, H, bodyMat);

            if (type === 'opentop') addOpenTopTopAssembly(group, L, W, H);
            if (type === 'iso40hc') {
                const stripeGeo = new THREE.BoxGeometry(0.32, 0.12, 0.02);
                const stripeMat = new THREE.MeshStandardMaterial({ color: 0xfacc15, roughness: 0.4, metalness: 0.2 });
                [-L / 2 + 0.20, L / 2 - 0.20].forEach(cx => {
                    [-W / 2 - 0.01, W / 2 + 0.01].forEach(cz => {
                        const stripe = new THREE.Mesh(stripeGeo, stripeMat);
                        stripe.position.set(cx, H / 2 - 0.12, cz);
                        group.add(stripe);
                    });
                });
            }
            return true;
        }

        // ISO 668 dry-van shell: thin skins + exterior corrugation.
        // Longer containers ADD more ribs at FIXED pitch — never stretch 20ft detailing.
        function addCorrugatedShell(group, L, W, H, mat) {
            const skin = mat.clone();
            const wallT = 0.055;
            const floorH = 0.16;
            const roofT = 0.05;
            const corrugDepth = 0.038;
            const RIB_PITCH = 0.280; // fixed ISO-like side corrugation pitch (m)
            const RIB_W = 0.100;
            const SHOULDER_W = 0.160;
            const ROOF_PITCH = 0.260;
            const sideH = H - floorH - roofT - 0.04;
            const inset = 0.35; // keep ribs clear of fixed corner posts / castings

            // Timber / steel floor (interior)
            const floor = new THREE.Mesh(new THREE.BoxGeometry(L - 0.20, floorH, W - 0.20), MATS.timberWood ? MATS.timberWood.clone() : skin);
            floor.position.y = -H / 2 + floorH / 2;
            floor.receiveShadow = true;
            group.add(floor);

            // Top & bottom side rails + end sills (ISO main frame) — fixed section sizes
            const railH = 0.12;
            const railT = 0.11;
            [-H / 2 + railH / 2, H / 2 - railH / 2].forEach(ry => {
                [-1, 1].forEach(sz => {
                    const sr = new THREE.Mesh(new THREE.BoxGeometry(Math.max(0.4, L - 0.20), railH, railT), skin);
                    sr.position.set(0, ry, sz * (W / 2 - railT * 0.5));
                    sr.castShadow = true;
                    group.add(sr);
                });
                [-1, 1].forEach(sx => {
                    const er = new THREE.Mesh(new THREE.BoxGeometry(railT, railH, Math.max(0.4, W - 0.20)), skin);
                    er.position.set(sx * (L / 2 - railT * 0.5), ry, 0);
                    group.add(er);
                });
            });

            // ±Z corrugated side walls — rib count grows with L, pitch stays RIB_PITCH
            const usableL = Math.max(RIB_PITCH, L - inset * 2);
            const numSideRibs = Math.max(4, Math.round(usableL / RIB_PITCH) + 1);
            [-1, 1].forEach(sz => {
                const zWall = sz * (W / 2 - wallT * 0.5);
                const panel = new THREE.Mesh(new THREE.BoxGeometry(Math.max(0.4, L - 0.36), sideH, wallT), skin);
                panel.position.set(0, -H / 2 + floorH + sideH / 2, zWall);
                panel.castShadow = true;
                panel.receiveShadow = true;
                group.add(panel);
                for (let i = 0; i < numSideRibs; i++) {
                    const rx = -L / 2 + inset + i * RIB_PITCH;
                    if (rx > L / 2 - inset) break;
                    const lobe = new THREE.Mesh(new THREE.BoxGeometry(RIB_W, sideH - 0.04, corrugDepth), skin);
                    lobe.position.set(rx, panel.position.y, zWall + sz * (wallT * 0.5 + corrugDepth * 0.5));
                    group.add(lobe);
                    const shoulder = new THREE.Mesh(new THREE.BoxGeometry(SHOULDER_W, sideH - 0.08, corrugDepth * 0.45), skin);
                    shoulder.position.set(rx, panel.position.y, zWall + sz * (wallT * 0.5 + corrugDepth * 0.22));
                    group.add(shoulder);
                }
            });

            // −X front corrugated bulkhead — fixed pitch across width
            const frontZ = -L / 2 + wallT * 0.5 + 0.02;
            const front = new THREE.Mesh(new THREE.BoxGeometry(wallT, sideH, W - 0.28), skin);
            front.position.set(frontZ, -H / 2 + floorH + sideH / 2, 0);
            front.castShadow = true;
            group.add(front);
            const usableW = Math.max(RIB_PITCH, W - 0.56);
            const numFrontRibs = Math.max(4, Math.round(usableW / RIB_PITCH) + 1);
            for (let i = 0; i < numFrontRibs; i++) {
                const rz = -W / 2 + 0.28 + i * RIB_PITCH;
                if (rz > W / 2 - 0.28) break;
                const lobe = new THREE.Mesh(new THREE.BoxGeometry(corrugDepth, sideH - 0.06, RIB_W), skin);
                lobe.position.set(frontZ - wallT * 0.5 - corrugDepth * 0.5, front.position.y, rz);
                group.add(lobe);
            }

            // +X rear doors — match CAD 20ft: twin leaves with 3 recessed horizontal panels each
            const doorT = 0.05;
            const doorX = L / 2 - doorT * 0.5 - 0.02;
            const doorH = sideH - 0.06;
            const doorY = -H / 2 + floorH + sideH / 2;
            const leafW = W * 0.48 - 0.04;
            [-1, 1].forEach(sz => {
                const leaf = new THREE.Mesh(new THREE.BoxGeometry(doorT, doorH, leafW), skin);
                leaf.position.set(doorX, doorY, sz * W * 0.25);
                leaf.castShadow = true;
                group.add(leaf);
                // Three recessed panels per leaf (like conts20ft.obj)
                [-0.30, 0.0, 0.30].forEach(yf => {
                    const panelH = doorH * 0.22;
                    const recess = new THREE.Mesh(
                        new THREE.BoxGeometry(0.012, panelH, leafW * 0.78),
                        new THREE.MeshStandardMaterial({ color: skin.color, roughness: 0.55, metalness: 0.2 })
                    );
                    recess.position.set(doorX + doorT * 0.55, doorY + yf * doorH * 0.55, sz * W * 0.25);
                    group.add(recess);
                });
            });
            // Horizontal cams / anti-rack bars
            [-0.22, 0.06, 0.34].forEach(yf => {
                const bar = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.045, W - 0.30), MATS.galvSteel.clone());
                bar.position.set(doorX + 0.02, doorY + yf * doorH * 0.5, 0);
                group.add(bar);
            });
            // Four locking rods (2 per leaf)
            [-0.34, -0.14, 0.14, 0.34].forEach(zf => {
                const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.016, doorH - 0.08, 10), MATS.galvSteel.clone());
                rod.position.set(L / 2 - 0.005, doorY, zf * W);
                group.add(rod);
            });

            const cscPlate = new THREE.Mesh(new THREE.BoxGeometry(0.015, 0.22, 0.32), new THREE.MeshStandardMaterial({ color: 0xcfd8dc, roughness: 0.35, metalness: 0.7 }));
            cscPlate.position.set(L / 2 + 0.01, doorY + doorH * 0.12, -W * 0.22);
            group.add(cscPlate);

            [-0.14, 0.14].forEach(zf => {
                const handle = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.03, 0.18), MATS.galvSteel.clone());
                handle.position.set(L / 2 + 0.025, doorY - doorH * 0.08, zf * W + (zf < 0 ? 0.08 : -0.08));
                group.add(handle);
            });

            // Corrugated roof — fixed transverse pitch
            const roofY = H / 2 - roofT / 2;
            const roof = new THREE.Mesh(new THREE.BoxGeometry(Math.max(0.4, L - 0.28), roofT, W - 0.28), skin);
            roof.position.y = roofY;
            roof.castShadow = true;
            group.add(roof);
            const roofUsable = Math.max(ROOF_PITCH, L - 0.60);
            const numRoofRibs = Math.max(6, Math.round(roofUsable / ROOF_PITCH) + 1);
            for (let i = 0; i < numRoofRibs; i++) {
                const rx = -L / 2 + 0.30 + i * ROOF_PITCH;
                if (rx > L / 2 - 0.30) break;
                const rRib = new THREE.Mesh(new THREE.BoxGeometry(0.08, corrugDepth, W - 0.34), skin);
                rRib.position.set(rx, roofY + roofT * 0.5 + corrugDepth * 0.35, 0);
                group.add(rRib);
            }

            addCornerCastings(group, L, W, H);
        }

        // 1A. OPEN TOP CONTAINER (True Open Roof + Adjustable Internal Cargo + Dynamic Tenting Tarpaulin Cover)
        function addOpenTopContainer3D(group, L, W, H) {
            const wallMat = MATS.containerBlue.clone();
            const floorMat = MATS.timberWood ? MATS.timberWood.clone() : MATS.woodCrate.clone();
            const wallThick = 0.08;
            const floorH = 0.18;
            const floorTopY = -H / 2 + floorH;

            // Bottom base frame & timber plank floor inside the hollow container
            const baseFloor = new THREE.Mesh(new THREE.BoxGeometry(L - 0.16, floorH, W - 0.16), floorMat);
            baseFloor.position.y = -H / 2 + floorH / 2;
            baseFloor.receiveShadow = true;
            group.add(baseFloor);

            // Bottom & Top Longitudinal Side Rails
            const railGeo = new THREE.BoxGeometry(L - 0.18, 0.13, 0.12);
            [-H / 2 + 0.065, H / 2 - 0.065].forEach(ry => {
                [-W / 2 + 0.06, W / 2 - 0.06].forEach(rz => {
                    const r = new THREE.Mesh(railGeo, wallMat);
                    r.position.set(0, ry, rz);
                    r.castShadow = true;
                    group.add(r);
                });
            });

            // Two Hollow Corrugated Side Walls — fixed pitch ribs (more ribs when L grows)
            const sideWallH = H - 0.24;
            const sidePanelGeo = new THREE.BoxGeometry(L - 0.24, sideWallH, wallThick);
            const OT_PITCH = 0.280;
            const otInset = 0.34;
            const otUsable = Math.max(OT_PITCH, L - otInset * 2);
            const numRibs = Math.max(4, Math.round(otUsable / OT_PITCH) + 1);
            [-1, 1].forEach(sz => {
                const wz = sz * (W / 2 - wallThick * 0.65);
                const panel = new THREE.Mesh(sidePanelGeo, wallMat);
                panel.position.set(0, 0, wz);
                panel.castShadow = true;
                panel.receiveShadow = true;
                group.add(panel);

                for (let i = 0; i < numRibs; i++) {
                    const rx = -L / 2 + otInset + i * OT_PITCH;
                    if (rx > L / 2 - otInset) break;
                    const rib = new THREE.Mesh(new THREE.BoxGeometry(0.06, sideWallH, wallThick + 0.045), wallMat);
                    rib.position.set(rx, 0, wz);
                    group.add(rib);
                }
            });

            // Front Corrugated Bulkhead Wall (-X) & Rear Double Doors (+X) with removable top header
            const endWallGeo = new THREE.BoxGeometry(wallThick, sideWallH, W - 0.20);
            const frontWall = new THREE.Mesh(endWallGeo, wallMat);
            frontWall.position.set(-L / 2 + wallThick * 0.65, 0, 0);
            frontWall.castShadow = true;
            const rearDoors = new THREE.Mesh(endWallGeo, wallMat);
            rearDoors.position.set(L / 2 - wallThick * 0.65, 0, 0);
            rearDoors.castShadow = true;
            group.add(frontWall, rearDoors);

            [-L / 2 + 0.06, L / 2 - 0.06].forEach(ex => {
                [-H / 2 + 0.065, H / 2 - 0.065].forEach(ey => {
                    const er = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.13, W - 0.18), wallMat);
                    er.position.set(ex, ey, 0);
                    group.add(er);
                });
            });

            // 4 Galvanized Door Locking Bars at +X End
            [-0.33, -0.12, 0.12, 0.33].forEach(zf => {
                const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, H - 0.26, 10), MATS.galvSteel);
                rod.position.set(L / 2 - 0.02, 0, zf * W);
                group.add(rod);
            });

            // 8 ISO Corner Castings
            addCornerCastings(group, L, W, H);

            // Removable Arched Roof Bows (Thanh cung đỡ bạt) across the open top
            const bowCount = Math.max(5, Math.floor(L * 1.1));
            for (let i = 0; i < bowCount; i++) {
                const bx = -L * 0.38 + (i / (bowCount - 1)) * (L * 0.76);
                const bow = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, W - 0.16, 10), MATS.galvSteel);
                bow.rotation.x = Math.PI / 2;
                bow.position.set(bx, H / 2 - 0.03, 0);
                group.add(bow);
            }

            // Internal Cargo inside Open Top (Adjustable Height / Length / Width)
            const hasCargo = state.oogHasCargo !== false;
            const hasTarp = state.oogTarp !== false;
            const wallClear = 0.22;
            const maxInnerL = Math.max(1.2, L - wallClear * 2);
            const maxInnerW = Math.max(0.85, W - wallClear * 2);
            const halfInnerL = maxInnerL * 0.5;
            const cL = THREE.MathUtils.clamp(state.oogCargoL || L * 0.84, 1.2, maxInnerL);
            const cW = THREE.MathUtils.clamp(state.oogCargoW || Math.min(0.95, maxInnerW * 0.72), 0.55, maxInnerW);
            const wantDia = THREE.MathUtils.clamp(state.oogCargoH || H * 1.22, 0.6, 4.8);
            const skidH = 0.10;
            let numTires = Math.max(1, Math.min(4, Math.round(cL / Math.max(1.0, wantDia * 1.05))));
            const fitDia = (n) => (maxInnerL - 0.08 * Math.max(0, n - 1)) / n;
            while (numTires > 1 && fitDia(numTires) < Math.min(wantDia, H * 0.85)) numTires -= 1;
            const tireDia = THREE.MathUtils.clamp(Math.min(wantDia, fitDia(numTires)), 0.8, maxInnerL - 0.04);
            const tireR = tireDia * 0.5;
            const tireThick = Math.min(cW * 0.92, maxInnerW - 0.10, 0.95);
            const maxCenterX = Math.max(0, halfInnerL - tireR - 0.02);
            const cargoPeakY = floorTopY + skidH + tireDia;

            if (hasCargo) {
                const cargoGroup = new THREE.Group();
                const skid = new THREE.Mesh(
                    new THREE.BoxGeometry(Math.min(cL, maxInnerL), skidH, Math.min(tireThick + 0.28, maxInnerW - 0.04)),
                    MATS.woodCrate.clone()
                );
                skid.position.y = floorTopY + skidH / 2;
                cargoGroup.add(skid);

                const tireMat = MATS.rubberTire ? MATS.rubberTire.clone() : MATS.darkSteel.clone();

                const rackH = Math.min(tireR * 0.45, H * 0.28);
                const rack = new THREE.Mesh(
                    new THREE.BoxGeometry(Math.min(cL, maxInnerL) * 0.90, rackH, Math.min(tireThick * 0.5, maxInnerW * 0.35)),
                    MATS.woodCrate.clone()
                );
                rack.position.y = floorTopY + skidH + rackH / 2;
                rack.castShadow = true;
                cargoGroup.add(rack);

                for (let t = 0; t < numTires; t++) {
                    let tx = 0;
                    if (numTires > 1) {
                        const span = Math.min(cL - tireDia, maxCenterX * 2);
                        tx = THREE.MathUtils.clamp(-span * 0.5 + (t / (numTires - 1)) * span, -maxCenterX, maxCenterX);
                    }
                    const tireGroup = new THREE.Group();
                    // Axis along width (Z) — Ø in X/Y; X clamped inside ends, Z inside side walls
                    tireGroup.position.set(tx, floorTopY + skidH + tireR, 0);

                    // Outer treaded OTR tire carcass
                    const carcass = new THREE.Mesh(new THREE.CylinderGeometry(tireR, tireR, tireThick, 28), tireMat);
                    carcass.rotation.x = Math.PI / 2;
                    carcass.castShadow = true;
                    tireGroup.add(carcass);

                    // Deep aggressive OTR lug treads around circumference
                    const lugCount = 18;
                    for (let k = 0; k < lugCount; k++) {
                        const ang = (k / lugCount) * Math.PI * 2;
                        const lug = new THREE.Mesh(new THREE.BoxGeometry(tireR * 0.14, 0.045, tireThick * 0.94), tireMat);
                        lug.position.set(Math.cos(ang) * (tireR - 0.01), Math.sin(ang) * (tireR - 0.01), 0);
                        lug.rotation.z = ang + Math.PI / 2;
                        tireGroup.add(lug);
                    }

                    // Deep recessed hub bore
                    const hub = new THREE.Mesh(new THREE.CylinderGeometry(tireR * 0.44, tireR * 0.44, tireThick + 0.02, 20), MATS.darkSteel);
                    hub.rotation.x = Math.PI / 2;
                    tireGroup.add(hub);

                    cargoGroup.add(tireGroup);
                }
                cargoGroup.traverse(o => { o.userData.noLugWeld = true; });
                group.add(cargoGroup);
            }

            // Dynamic tarp draped over upright tire crowns
            if (hasTarp) {
                const tarpGroup = new THREE.Group();
                tarpGroup.name = 'openTopTarpaulin';
                const tarpL = L - 0.04;
                const tarpW = W - 0.04;
                const skirtDrop = 0.28;
                const rimY = H / 2 + 0.01;
                const tarpMat = new THREE.MeshStandardMaterial({
                    color: 0x3f6b4e,
                    roughness: 0.78,
                    metalness: 0.02,
                    side: THREE.DoubleSide
                });

                const topGeo = new THREE.PlaneGeometry(tarpL, tarpW, 56, 28);
                topGeo.rotateX(-Math.PI / 2);
                const pos = topGeo.attributes.position;
                const tireCenterY = floorTopY + skidH + tireR;
                const rEff = tireR + 0.10;
                const tireXsProc = [];
                if (hasCargo) {
                    for (let t = 0; t < numTires; t++) {
                        if (numTires === 1) tireXsProc.push(0);
                        else {
                            const span = Math.min(cL - tireDia, maxCenterX * 2);
                            tireXsProc.push(THREE.MathUtils.clamp(
                                -span * 0.5 + (t / (numTires - 1)) * span,
                                -maxCenterX,
                                maxCenterX
                            ));
                        }
                    }
                }
                for (let i = 0; i < pos.count; i++) {
                    const vx = pos.getX(i);
                    const vz = pos.getZ(i);
                    const edge = Math.max(Math.abs(vx) / (tarpL * 0.5), Math.abs(vz) / (tarpW * 0.5));
                    const rimLock = Math.max(0, 1 - Math.pow(THREE.MathUtils.clamp(edge, 0, 1), 4.5));
                    let peak = rimY + 0.03;
                    for (let t = 0; t < tireXsProc.length; t++) {
                        const dx = vx - tireXsProc[t];
                        if (Math.abs(dx) > rEff) continue;
                        const yArc = tireCenterY + Math.sqrt(Math.max(0, rEff * rEff - dx * dx));
                        const zKeep = Math.max(0, 1 - Math.pow(Math.abs(vz) / Math.max(0.35, tarpW * 0.46), 2.4));
                        peak = Math.max(peak, THREE.MathUtils.lerp(rimY + 0.04, yArc + 0.04, zKeep));
                    }
                    if (!hasCargo) peak = rimY + 0.04;
                    pos.setY(i, rimY + rimLock * Math.max(0.02, peak - rimY));
                }
                topGeo.computeVertexNormals();
                const topTarpMesh = new THREE.Mesh(topGeo, tarpMat);
                topTarpMesh.castShadow = true;
                topTarpMesh.receiveShadow = true;
                tarpGroup.add(topTarpMesh);

                // 4 Side & End Tarpaulin Skirt Flaps + Brass Grommet Eyelets + TIR Lashing Cord
                [-1, 1].forEach(sz => {
                    const flap = new THREE.Mesh(new THREE.BoxGeometry(tarpL, skirtDrop, 0.018), tarpMat);
                    flap.position.set(0, H / 2 - skirtDrop / 2 + 0.01, sz * (W / 2 + 0.008));
                    tarpGroup.add(flap);

                    // Lashing rope & grommets along side skirt hem
                    const cord = new THREE.Mesh(new THREE.CylinderGeometry(0.009, 0.009, tarpL - 0.12, 8), MATS.galvSteel);
                    cord.rotation.z = Math.PI / 2;
                    cord.position.set(0, H / 2 - skirtDrop + 0.04, sz * (W / 2 + 0.022));
                    tarpGroup.add(cord);

                    const grommets = Math.max(8, Math.floor(L * 2.2));
                    for (let g = 0; g < grommets; g++) {
                        const gx = -tarpL * 0.46 + (g / (grommets - 1)) * (tarpL * 0.92);
                        const ring = new THREE.Mesh(new THREE.TorusGeometry(0.022, 0.006, 6, 12), MATS.yellowHazard);
                        ring.position.set(gx, H / 2 - skirtDrop + 0.04, sz * (W / 2 + 0.018));
                        tarpGroup.add(ring);
                    }
                });
                [-1, 1].forEach(sx => {
                    const eFlap = new THREE.Mesh(new THREE.BoxGeometry(0.018, skirtDrop, tarpW), tarpMat);
                    eFlap.position.set(sx * (L / 2 + 0.008), H / 2 - skirtDrop / 2 + 0.01, 0);
                    tarpGroup.add(eFlap);
                });
                tarpGroup.traverse(o => { o.userData.noLugWeld = true; });
                group.add(tarpGroup);
            }
        }

        // 1B. FLAT RACK 40ft / 20ft (Hapag-Lloyd Heavy I-Beam Deck, End Bulkheads, Toggleable OOG Cargo & Ratchet Straps)
        function addFlatRackContainer3D(group, L, W, H) {
            const orangeMat = new THREE.MeshStandardMaterial({ color: 0xd95f18, roughness: 0.42, metalness: 0.28 });
            const plankMat = MATS.timberWood ? MATS.timberWood.clone() : MATS.woodCrate.clone();
            const strapMat = new THREE.MeshStandardMaterial({ color: 0xff5500, roughness: 0.55, metalness: 0.08 });
            const deckH = 0.30;
            const deckTopY = -H / 2 + deckH;

            // 1. Two Deep Heavy-Duty I-Beam Longitudinal Side Girders
            const girderWebGeo = new THREE.BoxGeometry(L - 0.32, deckH - 0.06, 0.08);
            const flangeGeo = new THREE.BoxGeometry(L - 0.20, 0.035, 0.18);
            [-1, 1].forEach(sz => {
                const gz = sz * (W / 2 - 0.09);
                const web = new THREE.Mesh(girderWebGeo, orangeMat);
                web.position.set(0, -H / 2 + deckH / 2, gz);
                web.castShadow = true;
                const topFlange = new THREE.Mesh(flangeGeo, orangeMat);
                topFlange.position.set(0, deckTopY - 0.018, gz);
                const botFlange = new THREE.Mesh(flangeGeo, orangeMat);
                botFlange.position.set(0, -H / 2 + 0.018, gz);
                group.add(web, topFlange, botFlange);

                // Heavy Counterbalance Spring Cylinders near both ends (authentic Flat Rack hinge dampeners)
                [-1, 1].forEach(sx => {
                    const spring = new THREE.Mesh(new THREE.CylinderGeometry(0.036, 0.036, L * 0.14, 12), MATS.darkSteel);
                    spring.rotation.z = Math.PI / 2 - sx * 0.04;
                    spring.position.set(sx * (L * 0.35), -H / 2 + deckH * 0.42, sz * (W / 2 - 0.01));
                    group.add(spring);
                });

                // Forged Lashing Rings along both side girders
                const numRings = Math.max(6, Math.floor(L * 0.9));
                for (let r = 0; r < numRings; r++) {
                    const rx = -L * 0.40 + (r / (numRings - 1)) * (L * 0.80);
                    const lRing = new THREE.Mesh(new THREE.TorusGeometry(0.038, 0.010, 8, 14), MATS.yellowHazard);
                    lRing.position.set(rx, deckTopY - 0.05, sz * (W / 2 + 0.01));
                    group.add(lRing);
                }
            });

            // 2. Segmented Hardwood Timber Plank Deck between the I-beam side girders
            const numPlanks = Math.max(18, Math.floor(L * 3.2));
            const plankW = (L - 0.48) / numPlanks;
            const plankGeo = new THREE.BoxGeometry(plankW * 0.88, 0.06, W - 0.32);
            for (let p = 0; p < numPlanks; p++) {
                const px = -L / 2 + 0.24 + (p + 0.5) * plankW;
                const plank = new THREE.Mesh(plankGeo, plankMat);
                plank.position.set(px, deckTopY - 0.035, 0);
                plank.receiveShadow = true;
                group.add(plank);
            }
            // Under-deck steel cross-members
            const crossCount = Math.max(8, Math.floor(L * 1.2));
            for (let c = 0; c < crossCount; c++) {
                const cx = -L * 0.42 + (c / (crossCount - 1)) * (L * 0.84);
                const cross = new THREE.Mesh(new THREE.BoxGeometry(0.08, deckH * 0.72, W - 0.18), orangeMat);
                cross.position.set(cx, -H / 2 + deckH * 0.38, 0);
                group.add(cross);
            }

            // 3. Two Heavy-Duty End Bulkheads (Tapered Corner Posts + Corrugated End Shield + Height Decal)
            const postH = H - 0.18;
            [-1, 1].forEach(sx => {
                const ex = sx * (L / 2 - 0.11);
                // Center bulkhead shield panel
                const panel = new THREE.Mesh(new THREE.BoxGeometry(0.09, postH, W - 0.38), orangeMat);
                panel.position.set(ex, 0, 0);
                panel.castShadow = true;
                group.add(panel);

                // Top header cross-beam on bulkhead
                const header = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.14, W - 0.16), orangeMat);
                header.position.set(ex, H / 2 - 0.10, 0);
                group.add(header);

                // Heavy Tapered Vertical Corner Posts + Yellow Height Marking Plate
                [-1, 1].forEach(sz => {
                    const pz = sz * (W / 2 - 0.11);
                    const post = new THREE.Mesh(new THREE.BoxGeometry(0.20, postH, 0.20), orangeMat);
                    post.position.set(ex, 0, pz);
                    post.castShadow = true;
                    group.add(post);

                    const badge = new THREE.Mesh(new THREE.BoxGeometry(0.21, 0.28, 0.16), MATS.yellowHazard);
                    badge.position.set(ex, H * 0.22, pz);
                    group.add(badge);
                });
            });

            // 8 ISO Corner Castings (top & bottom of the 4 corner posts)
            addCornerCastings(group, L, W, H);

            // 4. Toggleable OOG cargo on deck
            addDeckOogCargoOverlay(group, L, W, H, deckTopY);
        }

        /** Prefer CAD wood/floor mesh top; fallback keeps cargo ON the deck (not into it). */
        function measureCadDeckTopY(group, L, W, H, fallbackY) {
            let best = null;
            group.updateMatrixWorld(true);
            group.traverse(child => {
                if (!child.isMesh || !child.geometry) return;
                const n = `${child.name || ''} ${child.material?.name || ''}`.toLowerCase();
                if (!(n.includes('floor') || n.includes('wood') || n.includes('deck') || n.includes('plank'))) return;
                const box = new THREE.Box3().setFromObject(child);
                if (!Number.isFinite(box.max.y)) return;
                if (best == null || box.max.y > best) best = box.max.y;
            });
            if (best != null) return best;
            return fallbackY != null ? fallbackY : (-H / 2 + Math.min(0.60, Math.max(0.35, H * 0.20)));
        }

        function isDeckOogCargoType(type = state.cargoType) {
            return type === 'flatrack' || type === 'flatrack20'
                || type === 'platform' || type === 'platform20';
        }

        /** Nominal deck / floor thickness for Flat Rack & Platform (m). */
        function flatRackDeckThickness(H, deckTopY) {
            if (Number.isFinite(deckTopY)) {
                return Math.max(0.08, Math.min(0.60, deckTopY - (-H * 0.5)));
            }
            if (state.cargoType === 'platform' || state.cargoType === 'platform20') {
                return Math.max(0.22, Math.min(0.55, H * 0.55));
            }
            return 0.30;
        }

        /** End-wall / side-rail clearance rules (m). */
        const OOG_FR_END_CLEAR_M = 0.40;   // Flat Rack: ≥40 cm from each end wing
        const OOG_PLAT_SIDE_MAX_M = 0.40;  // Platform: ≤40 cm past each side edge

        function isFlatRackCargoType(type = state.cargoType) {
            return type === 'flatrack' || type === 'flatrack20';
        }
        function isPlatformCargoType(type = state.cargoType) {
            return type === 'platform' || type === 'platform20';
        }

        /**
         * Type-specific delta limits:
         * - Flat Rack: OL cannot pass end wings; each end keeps ≥40 cm clearance
         *   (olF/olR ≤ −0.40). Length still adjustable via asymmetric insets.
         * - Platform: OW cannot exceed +40 cm past each side rail.
         */
        function clampDeckOogDeltas(L = state.L, W = state.W) {
            const minCrateL = 0.50;
            const minCrateW = 0.50;
            const maxInsetL = Math.max(0.15, (L - minCrateL) * 0.5);
            const maxInsetW = Math.max(0.15, (W - minCrateW) * 0.5);

            let oh = Number(state.oogOh) || 0;
            let owL = Number(state.oogOwL) || 0;
            let owR = Number(state.oogOwR) || 0;
            let olF = Number(state.oogOlF) || 0;
            let olR = Number(state.oogOlR) || 0;

            oh = THREE.MathUtils.clamp(oh, -2.0, 6.0);

            if (isFlatRackCargoType()) {
                // Locked by front/rear wings — never over-length; ≥40 cm clear each end
                const olMax = -OOG_FR_END_CLEAR_M;
                const olMin = -maxInsetL;
                olF = THREE.MathUtils.clamp(olF, olMin, olMax);
                olR = THREE.MathUtils.clamp(olR, olMin, olMax);
                // Ensure cL ≥ min after both insets
                if (L + olF + olR < minCrateL) {
                    const need = minCrateL - L;
                    const share = need * 0.5;
                    olF = Math.min(olF, share);
                    olR = Math.min(olR, share);
                    olF = THREE.MathUtils.clamp(olF, olMin, olMax);
                    olR = THREE.MathUtils.clamp(olR, olMin, olMax);
                }
                owL = THREE.MathUtils.clamp(owL, -maxInsetW, 2.5);
                owR = THREE.MathUtils.clamp(owR, -maxInsetW, 2.5);
            } else if (isPlatformCargoType()) {
                // Side rails: width adjustable but ≤ +40 cm past each edge
                owL = THREE.MathUtils.clamp(owL, -maxInsetW, OOG_PLAT_SIDE_MAX_M);
                owR = THREE.MathUtils.clamp(owR, -maxInsetW, OOG_PLAT_SIDE_MAX_M);
                olF = THREE.MathUtils.clamp(olF, -maxInsetL, 4.0);
                olR = THREE.MathUtils.clamp(olR, -maxInsetL, 4.0);
            } else {
                owL = THREE.MathUtils.clamp(owL, -maxInsetW, 2.5);
                owR = THREE.MathUtils.clamp(owR, -maxInsetW, 2.5);
                olF = THREE.MathUtils.clamp(olF, -maxInsetL, 4.0);
                olR = THREE.MathUtils.clamp(olR, -maxInsetL, 4.0);
            }

            state.oogOh = Math.round(oh * 100) / 100;
            state.oogOwL = Math.round(owL * 100) / 100;
            state.oogOwR = Math.round(owR * 100) / 100;
            state.oogOlF = Math.round(olF * 100) / 100;
            state.oogOlR = Math.round(olR * 100) / 100;
            return { oh, owL, owR, olF, olR, olMaxFr: -OOG_FR_END_CLEAR_M, owMaxPlat: OOG_PLAT_SIDE_MAX_M };
        }

        /**
         * Flat Rack / Platform OOG: UI deltas → absolute crate size.
         * OH = height above container highest point; physical crate height subtracts
         * deck (thớt đáy) + dunnage because cargo sits on the deck, not ground.
         * OW L/R and OL F/R are signed deltas vs the ISO envelope (clamped per type).
         */
        function resolveDeckOogGeometry(L = state.L, W = state.W, H = state.H, deckTopY = null) {
            const deckThick = flatRackDeckThickness(H, deckTopY);
            const dunnageH = 0.12;
            const { oh, owL, owR, olF, olR } = clampDeckOogDeltas(L, W);

            const resolvedDeckTop = Number.isFinite(deckTopY) ? deckTopY : (-H * 0.5 + deckThick);
            // Top of cargo = container top (+H/2) + OH  ⇒  cH = H − deck − dunnage + OH
            let cH = H - deckThick - dunnageH + oh;
            cH = THREE.MathUtils.clamp(cH, 0.30, 8.0);
            const cL = THREE.MathUtils.clamp(L + olF + olR, 0.50, 24.0);
            const cW = THREE.MathUtils.clamp(W + owL + owR, 0.50, 8.0);
            const offsetX = (olF - olR) * 0.5;
            const offsetZ = (owR - owL) * 0.5;
            const cargoBottomY = resolvedDeckTop + dunnageH + 0.01;
            const cargoTopY = cargoBottomY + cH;

            state.oogCargoL = Math.round(cL * 100) / 100;
            state.oogCargoW = Math.round(cW * 100) / 100;
            state.oogCargoH = Math.round(cH * 100) / 100;
            state.oogCargoOffsetX = Math.round(offsetX * 1000) / 1000;
            state.oogCargoOffsetZ = Math.round(offsetZ * 1000) / 1000;

            return {
                cL, cW, cH, offsetX, offsetZ,
                deckThick, dunnageH, cargoBottomY, cargoTopY,
                oh, owL, owR, olF, olR, deckTopY: resolvedDeckTop
            };
        }

        /** Default CoG = geometric centre of combined container + cargo envelope. */
        function applyCombinedOogCoGDefault(L = state.L, W = state.W, H = state.H, geom = null) {
            const g = geom || resolveDeckOogGeometry(L, W, H);
            // Outer envelope: container face wins when cargo is inset (negative delta)
            const envMinX = -L * 0.5 - Math.max(0, g.olR);
            const envMaxX = L * 0.5 + Math.max(0, g.olF);
            const envMinZ = -W * 0.5 - Math.max(0, g.owL);
            const envMaxZ = W * 0.5 + Math.max(0, g.owR);
            const envMinY = -H * 0.5;
            const envMaxY = Math.max(H * 0.5, g.cargoTopY);
            state.cogX = Math.round(((envMinX + envMaxX) * 0.5) * 100) / 100;
            state.cogZ = Math.round(((envMinZ + envMaxZ) * 0.5) * 100) / 100;
            state.cogY = Math.round(((envMinY + envMaxY) * 0.5) * 100) / 100;
            return { cogX: state.cogX, cogY: state.cogY, cogZ: state.cogZ };
        }

        /** OOG crate + dunnage + lashing straps on Flat Rack / Platform decks (works with CAD or procedural). */
        function addDeckOogCargoOverlay(group, L, W, H, deckTopY) {
            if (state.oogHasCargo === false) return;
            const plankMat = MATS.timberWood ? MATS.timberWood.clone() : MATS.woodCrate.clone();
            const strapMat = new THREE.MeshStandardMaterial({ color: 0xff5500, roughness: 0.55, metalness: 0.08 });
            const oogGroup = new THREE.Group();
            oogGroup.name = 'flatRackOogCargo';
            oogGroup.userData.noStructuralDeform = true;
            const geom = resolveDeckOogGeometry(L, W, H, deckTopY);
            const { cL, cW, cH, offsetX, offsetZ, dunnageH, cargoBottomY, cargoTopY } = geom;
            const deckH = geom.deckThick;

            const bearerW = Math.max(W - 0.12, cW + 0.14);
            const numBearers = Math.max(4, Math.floor(cL * 0.85));
            for (let b = 0; b < numBearers; b++) {
                const bx = offsetX + (numBearers <= 1 ? 0 : (-cL * 0.44 + (b / (numBearers - 1)) * (cL * 0.88)));
                const bearer = new THREE.Mesh(new THREE.BoxGeometry(0.16, dunnageH, bearerW), plankMat);
                bearer.position.set(bx, deckTopY + dunnageH / 2, offsetZ);
                bearer.castShadow = true;
                bearer.userData.noLugWeld = true;
                group.add(bearer);
            }

            const freeEndSpan = (L - 0.50 - cL) * 0.5;
            if (freeEndSpan > 0.65) {
                [-1, 1].forEach(sx => {
                    const px = offsetX + sx * (cL * 0.5 + freeEndSpan * 0.5);
                    const pallet = new THREE.Mesh(new THREE.BoxGeometry(freeEndSpan * 0.82, 0.11, W * 0.86), plankMat);
                    pallet.position.set(px, deckTopY + 0.055, offsetZ);
                    pallet.userData.noLugWeld = true;
                    group.add(pallet);
                });
            }

            const crateMat = MATS.woodCrate.clone();
            const crateBody = new THREE.Mesh(new THREE.BoxGeometry(cL, cH, cW), crateMat);
            crateBody.position.set(offsetX, cargoBottomY + cH / 2, offsetZ);
            crateBody.castShadow = true;
            crateBody.receiveShadow = true;
            oogGroup.add(crateBody);

            const hoodH = Math.min(0.68, cH * 0.28);
            const polyHoodMat = new THREE.MeshStandardMaterial({
                color: 0xf1f5f9,
                roughness: 0.45,
                metalness: 0.02,
                polygonOffset: true,
                polygonOffsetFactor: -1.0,
                polygonOffsetUnits: -2.0
            });
            const polyHood = new THREE.Mesh(new THREE.BoxGeometry(cL + 0.06, hoodH, cW + 0.06), polyHoodMat);
            polyHood.position.set(offsetX, cargoTopY - hoodH / 2 + 0.015, offsetZ);
            polyHood.castShadow = true;
            polyHood.receiveShadow = true;
            oogGroup.add(polyHood);

            const studCount = Math.max(4, Math.floor(cL * 0.9));
            for (let s = 0; s < studCount; s++) {
                const sx = offsetX + (studCount <= 1 ? 0 : (-cL * 0.48 + (s / (studCount - 1)) * (cL * 0.96)));
                const stud = new THREE.Mesh(new THREE.BoxGeometry(0.09, cH + 0.02, cW + 0.04), plankMat);
                stud.position.set(sx, cargoBottomY + cH / 2, offsetZ);
                oogGroup.add(stud);
            }
            [0.06, 0.52, 0.96].forEach(hf => {
                const band = new THREE.Mesh(new THREE.BoxGeometry(cL + 0.04, 0.09, cW + 0.04), plankMat);
                band.position.set(offsetX, cargoBottomY + cH * hf, offsetZ);
                oogGroup.add(band);
            });

            // Over-the-top ratchet lashing: top across cargo, sides outside faces, anchor at deck rail
            const lashingGroup = new THREE.Group();
            lashingGroup.name = 'flatRackLashingStraps';
            const brokenLashingGroup = new THREE.Group();
            brokenLashingGroup.name = 'flatRackBrokenStraps';
            brokenLashingGroup.visible = false;

            const lashingStrapMat = strapMat.clone();
            lashingStrapMat.polygonOffset = true;
            lashingStrapMat.polygonOffsetFactor = -2.0;
            lashingStrapMat.polygonOffsetUnits = -4.0;

            const strapCount = Math.max(4, Math.min(8, Math.floor(cL * 0.85)));
            const railZ = Math.max(W * 0.5 + 0.02, Math.abs(offsetZ) + cW * 0.5 + 0.08);
            for (let k = 0; k < strapCount; k++) {
                const sx = offsetX + (strapCount <= 1 ? 0 : (-cL * 0.42 + (k / (strapCount - 1)) * (cL * 0.84)));
                const topStrap = new THREE.Mesh(new THREE.BoxGeometry(0.065, 0.018, cW + 0.12), lashingStrapMat);
                topStrap.position.set(sx, cargoTopY + 0.04, offsetZ);
                topStrap.castShadow = true;
                lashingGroup.add(topStrap);

                [-1, 1].forEach(sz => {
                    const sideH = Math.max(0.4, cargoTopY - deckTopY);
                    const sideStrap = new THREE.Mesh(new THREE.BoxGeometry(0.065, sideH, 0.018), lashingStrapMat);
                    sideStrap.position.set(sx, deckTopY + sideH * 0.5, offsetZ + sz * (cW * 0.5 + 0.04));
                    sideStrap.castShadow = true;
                    lashingGroup.add(sideStrap);

                    // Short pull-down from cargo side to FR side rail (outside cargo)
                    const pullLen = Math.max(0.18, railZ - (Math.abs(offsetZ) + cW * 0.5));
                    const pull = new THREE.Mesh(new THREE.BoxGeometry(0.055, 0.016, pullLen), lashingStrapMat);
                    pull.position.set(sx, deckTopY + 0.04, offsetZ + sz * (cW * 0.5 + pullLen * 0.5 + 0.02));
                    lashingGroup.add(pull);

                    const ratchet = new THREE.Mesh(new THREE.BoxGeometry(0.10, 0.16, 0.06), MATS.galvSteel);
                    ratchet.position.set(sx, cargoBottomY + cH * 0.22, offsetZ + sz * (cW * 0.5 + 0.055));
                    lashingGroup.add(ratchet);

                    const tailLen = 0.45 + (k % 2) * 0.14;
                    const brokenTail = new THREE.Mesh(new THREE.BoxGeometry(0.065, tailLen, 0.018), MATS.redMaster);
                    brokenTail.position.set(sx, deckTopY + 0.08, sz * (railZ + 0.02));
                    brokenTail.rotation.x = sz * 0.35;
                    brokenLashingGroup.add(brokenTail);
                });
            }
            oogGroup.add(lashingGroup);
            brokenLashingGroup.traverse(o => { o.userData.noLugWeld = true; });
            group.add(brokenLashingGroup);

            oogGroup.position.set(0, 0, 0);
            oogGroup.userData.oogMeta = {
                cL, cW, cH,
                half: { hx: cL * 0.5, hy: cH * 0.5, hz: cW * 0.5 },
                centerY: cargoBottomY + cH / 2,
                cargoBottomY,
                deckTopY,
                deckH,
                offsetX,
                offsetZ,
                oh: geom.oh,
                owL: geom.owL,
                owR: geom.owR,
                olF: geom.olF,
                olR: geom.olR,
                frameL: L,
                frameW: W,
                frameH: H
            };
            oogGroup.traverse(o => { o.userData.noLugWeld = true; });
            group.add(oogGroup);
        }

        /**
         * Open Top OOG: upright OTR mining tires (no side-wall pierce); may rise above roof.
         * Tarp ON → hide CAD tarp and drape fabric over tire crowns (not a square crate).
         */
        function addOpenTopOogCargoAndTarp(group, L, W, H) {
            const hasCargo = state.oogHasCargo !== false;
            const hasTarp = state.oogTarp !== false;
            // Hard rule: cargo may exceed ROOF (Y) only — never past end doors (X) or side walls (Z)
            const wallClear = 0.22;
            const maxInnerL = Math.max(1.2, L - wallClear * 2);
            const maxInnerW = Math.max(0.85, W - wallClear * 2);
            const halfInnerL = maxInnerL * 0.5;
            const halfInnerW = maxInnerW * 0.5;

            const cL = THREE.MathUtils.clamp(state.oogCargoL || L * 0.86, 1.2, maxInnerL);
            const cW = THREE.MathUtils.clamp(
                state.oogCargoW || Math.min(0.95, maxInnerW * 0.72),
                0.55,
                maxInnerW
            );
            // Wanted over-height Ø — will be clamped so the circle still fits in length
            const wantDia = THREE.MathUtils.clamp(state.oogCargoH || H * 1.22, 0.8, 4.8);

            const floorTopY = measureCadDeckTopY(group, L, W, H, -H / 2 + 0.14);
            const skidH = 0.10;

            // Thickness along width (Z) — must stay inside side walls
            const tireThickSafe = Math.min(cW * 0.92, maxInnerW - 0.10, halfInnerW * 2 - 0.06, 0.95);
            const tireHalfZ = tireThickSafe * 0.5;
            const halfThickMax = halfInnerW - 0.02;

            // Fit N upright tires in length: each needs full Ø along X (circle), Ø may still rise above roof
            let numTires = Math.max(1, Math.min(4, Math.round(cL / Math.max(1.0, wantDia * 1.05))));
            let tireDia = wantDia;
            const gap = 0.08;
            const fitDia = (n) => (maxInnerL - gap * Math.max(0, n - 1)) / n;
            while (numTires > 1 && fitDia(numTires) < Math.min(wantDia, H * 0.85)) {
                numTires -= 1;
            }
            tireDia = Math.min(wantDia, fitDia(numTires));
            // Absolute: one tire cannot be longer than the inner bay
            tireDia = THREE.MathUtils.clamp(tireDia, 0.8, maxInnerL - 0.04);
            const tireR = tireDia * 0.5;

            // Centers: |tx| + tireR ≤ halfInnerL  (no poke past doors/front)
            const maxCenterX = Math.max(0, halfInnerL - tireR - 0.02);
            const tireXs = [];
            if (numTires === 1) {
                tireXs.push(0);
            } else {
                const span = Math.min(cL - tireDia, maxCenterX * 2);
                for (let t = 0; t < numTires; t++) {
                    const u = t / (numTires - 1);
                    const tx = -span * 0.5 + u * span;
                    tireXs.push(THREE.MathUtils.clamp(tx, -maxCenterX, maxCenterX));
                }
            }
            const tireCenterY = floorTopY + skidH + tireR;
            const cargoPeakY = hasCargo ? (tireCenterY + tireR) : (H / 2);

            // Bay footprint actually occupied (inside walls)
            const usedL = Math.min(maxInnerL, tireDia * numTires + gap * Math.max(0, numTires - 1));
            state.oogCargoL = Math.round(Math.min(cL, Math.max(usedL, tireDia)) * 100) / 100;
            state.oogCargoW = Math.round(Math.min(cW, tireThickSafe + 0.12, maxInnerW) * 100) / 100;
            state.oogCargoH = Math.round(tireDia * 100) / 100;

            // Hide CAD tarp / roof sheet / baked cargo that would pierce or sit flat at rim
            group.updateMatrixWorld(true);
            group.traverse(child => {
                if (!child.isMesh || !child.geometry) return;
                if (child.parent && (child.parent.name === 'openTopOogCargo' || child.parent.name === 'openTopTarpaulin')) return;
                const n = `${child.name || ''} ${child.material?.name || ''}`.toLowerCase();
                const isTarpish = n.includes('tarp') || n.includes('canvas') || n.includes('cover')
                    || n.includes('awning') || n.includes('roof_bow') || n.includes('opentop_roof')
                    || n.includes('rolled_tarpaulin') || n.includes('bow') || n.includes('sheet')
                    || n.includes('tarpaulin') || n.includes('roofpanel') || n.includes('roof_panel');
                const isCadCargo = n.includes('cargo') || n.includes('crate') || n.includes('payload')
                    || n.includes('tyre') || n.includes('tire') || n.includes('oog');
                if (isCadCargo && hasCargo) {
                    child.visible = false;
                    return;
                }
                // Nameless thin lid near top rail → treat as CAD tarp/roof sheet
                let isFlatTopLid = false;
                try {
                    const bb = new THREE.Box3().setFromObject(child);
                    const sz = new THREE.Vector3();
                    bb.getSize(sz);
                    const midY = (bb.min.y + bb.max.y) * 0.5;
                    isFlatTopLid = sz.y < 0.18 && sz.x > L * 0.45 && sz.z > W * 0.45 && midY > H * 0.28;
                } catch (_) { /* ignore */ }
                if (isTarpish || isFlatTopLid) {
                    child.visible = hasTarp && !hasCargo;
                }
            });

            if (hasCargo) {
                const cargoGroup = new THREE.Group();
                cargoGroup.name = 'openTopOogCargo';
                const tireMat = MATS.rubberTire ? MATS.rubberTire.clone() : new THREE.MeshStandardMaterial({
                    color: 0x1c1917, roughness: 0.92, metalness: 0.05
                });
                const hubMat = MATS.darkSteel ? MATS.darkSteel.clone() : tireMat.clone();
                const woodMat = MATS.timberWood ? MATS.timberWood.clone() : MATS.woodCrate.clone();

                const skidW = Math.min(tireThickSafe + 0.28, maxInnerW - 0.04);
                const skid = new THREE.Mesh(new THREE.BoxGeometry(cL * 0.96, skidH, skidW), woodMat);
                skid.position.y = floorTopY + skidH / 2;
                skid.receiveShadow = true;
                cargoGroup.add(skid);

                const rackH = Math.min(tireR * 0.45, H * 0.28);
                const rack = new THREE.Mesh(
                    new THREE.BoxGeometry(cL * 0.88, rackH, Math.min(tireThickSafe * 0.5, maxInnerW * 0.35)),
                    woodMat
                );
                rack.position.y = floorTopY + skidH + rackH / 2;
                rack.castShadow = true;
                cargoGroup.add(rack);

                tireXs.forEach((tx, t) => {
                    const tireGroup = new THREE.Group();
                    tireGroup.name = `OTR_Tire_${t + 1}`;
                    // Upright on tread; cylinder axis = container width (Z). Diameter in X–Y only.
                    tireGroup.position.set(tx, tireCenterY, 0);

                    const carcass = new THREE.Mesh(
                        new THREE.CylinderGeometry(tireR, tireR, tireThickSafe, 36),
                        tireMat
                    );
                    carcass.rotation.x = Math.PI / 2;
                    carcass.castShadow = true;
                    carcass.receiveShadow = true;
                    tireGroup.add(carcass);

                    const lugCount = 20;
                    for (let k = 0; k < lugCount; k++) {
                        const ang = (k / lugCount) * Math.PI * 2;
                        const lug = new THREE.Mesh(
                            new THREE.BoxGeometry(tireR * 0.16, 0.05, tireThickSafe * 0.90),
                            tireMat
                        );
                        lug.position.set(Math.cos(ang) * (tireR - 0.02), Math.sin(ang) * (tireR - 0.02), 0);
                        lug.rotation.z = ang + Math.PI / 2;
                        tireGroup.add(lug);
                    }

                    const hub = new THREE.Mesh(
                        new THREE.CylinderGeometry(tireR * 0.42, tireR * 0.42, tireThickSafe + 0.02, 24),
                        hubMat
                    );
                    hub.rotation.x = Math.PI / 2;
                    tireGroup.add(hub);

                    const rim = new THREE.Mesh(new THREE.TorusGeometry(tireR * 0.52, 0.035, 8, 28), hubMat);
                    rim.rotation.y = Math.PI / 2;
                    tireGroup.add(rim);

                    cargoGroup.add(tireGroup);

                    // Chocks — clamped inside side walls
                    [-1, 1].forEach(sz => {
                        const chockZ = THREE.MathUtils.clamp(
                            sz * (tireHalfZ + 0.10),
                            -halfThickMax + 0.08,
                            halfThickMax - 0.08
                        );
                        const chock = new THREE.Mesh(new THREE.BoxGeometry(0.20, 0.12, 0.16), woodMat);
                        chock.position.set(tx, floorTopY + skidH + 0.06, chockZ);
                        cargoGroup.add(chock);
                    });
                });

                cargoGroup.traverse(o => {
                    o.userData.noLugWeld = true;
                    if (o.isMesh) o.renderOrder = 0;
                });
                group.add(cargoGroup);
            }

            if (!hasTarp) return;

            const tarpMat = new THREE.MeshStandardMaterial({
                color: 0x3f6b4e, roughness: 0.78, metalness: 0.02, side: THREE.DoubleSide, depthWrite: true
            });
            const tarpGroup = new THREE.Group();
            tarpGroup.name = 'openTopTarpaulin';
            const rimY = H / 2 + 0.01;
            const coverClearance = 0.10;
            const tarpL = L - 0.04;
            const tarpW = W - 0.04;

            if (hasCargo) {
                const topGeo = new THREE.PlaneGeometry(tarpL, tarpW, 64, 32);
                topGeo.rotateX(-Math.PI / 2);
                const pos = topGeo.attributes.position;
                const halfTW = tarpW * 0.5;
                const rEff = tireR + coverClearance;
                for (let i = 0; i < pos.count; i++) {
                    const vx = pos.getX(i);
                    const vz = pos.getZ(i);
                    const edgeX = Math.abs(vx) / (tarpL * 0.5);
                    const edgeZ = Math.abs(vz) / halfTW;
                    const edge = Math.max(edgeX, edgeZ);
                    // Lock to top rail at perimeter; full lift in the bay
                    const rimLock = Math.max(0, 1 - Math.pow(THREE.MathUtils.clamp(edge, 0, 1), 4.5));

                    // Upper semicircle of each upright tire (crown above rim when OOG)
                    let peak = rimY + 0.03;
                    for (let t = 0; t < tireXs.length; t++) {
                        const dx = vx - tireXs[t];
                        if (Math.abs(dx) > rEff) continue;
                        const yArc = tireCenterY + Math.sqrt(Math.max(0, rEff * rEff - dx * dx));
                        // Keep cover high across tire thickness; tuck only near side rails
                        const zKeep = Math.max(0, 1 - Math.pow(Math.abs(vz) / Math.max(0.35, halfTW * 0.92), 2.4));
                        peak = Math.max(peak, THREE.MathUtils.lerp(rimY + 0.04, yArc + 0.04, zKeep));
                    }
                    // Soft valley between tires still above rails
                    if (peak < cargoPeakY * 0.55 + rimY * 0.45) {
                        peak = Math.max(peak, rimY + 0.05 + (1 - edge) * 0.08);
                    }
                    pos.setY(i, rimY + rimLock * Math.max(0.02, peak - rimY));
                }
                topGeo.computeVertexNormals();
                const sheet = new THREE.Mesh(topGeo, tarpMat);
                sheet.castShadow = true;
                sheet.receiveShadow = true;
                sheet.renderOrder = 4;
                tarpGroup.add(sheet);
            } else {
                const flat = new THREE.Mesh(new THREE.BoxGeometry(tarpL, 0.03, tarpW), tarpMat);
                flat.position.y = rimY + 0.02;
                tarpGroup.add(flat);
            }

            const skirt = Math.min(0.34, H * 0.14);
            [-1, 1].forEach(sz => {
                const flap = new THREE.Mesh(new THREE.BoxGeometry(tarpL, skirt, 0.018), tarpMat);
                flap.position.set(0, rimY - skirt / 2 + 0.02, sz * (W / 2 - 0.005));
                tarpGroup.add(flap);
            });
            [-1, 1].forEach(sx => {
                const eFlap = new THREE.Mesh(new THREE.BoxGeometry(0.018, skirt, tarpW - 0.08), tarpMat);
                eFlap.position.set(sx * (L / 2 - 0.005), rimY - skirt / 2 + 0.02, 0);
                tarpGroup.add(eFlap);
            });
            tarpGroup.traverse(o => {
                o.userData.noLugWeld = true;
                if (o.isMesh && o.material) {
                    o.renderOrder = Math.max(o.renderOrder || 0, 3);
                    o.material.depthWrite = true;
                    o.material.polygonOffset = true;
                    o.material.polygonOffsetFactor = -4;
                    o.material.polygonOffsetUnits = -4;
                }
            });
            group.add(tarpGroup);
        }

        /**
         * ISO Tank: keep CAD/procedural frame, replace sparse barrel with pressure-vessel style tank
         * (shell + stiffener rings + dished heads + nozzles + saddles) fitted inside the frame.
         */
        function installIsoTankPressureVesselBarrel(group, L, W, H) {
            // Hide low-detail CAD barrel / catwalk scraps that conflict with the upgraded vessel
            const toHide = [];
            group.traverse(child => {
                if (!child.isMesh) return;
                const n = `${child.name || ''} ${child.material?.name || ''}`.toLowerCase();
                if (n.includes('barrel') || n.includes('stainless') || n.includes('tank_barrel')
                    || n.includes('catwalk') || n.includes('isotank_barrel') || n.includes('fallback')) {
                    toHide.push(child);
                }
            });
            toHide.forEach(m => { m.visible = false; });

            const vessel = new THREE.Group();
            vessel.name = 'ISOTank_PressureVesselBarrel';
            const tankMat = (MATS.tankSteel || MATS.vesselSteel).clone();
            tankMat.metalness = 0.82;
            tankMat.roughness = 0.26;
            tankMat.side = THREE.DoubleSide;
            const ringMat = (MATS.gunmetal || MATS.darkSteel).clone();
            const galvMat = MATS.galvSteel.clone();
            const saddleMat = (MATS.orangeBeam || MATS.craneYellow || MATS.darkSteel).clone();

            // Fit inside ISO frame with clearance to posts/rails
            const radius = Math.min(W, H) * 0.38;
            const cylLen = Math.max(2.2, L * 0.78);
            const shellCenterY = -H * 0.02;

            const body = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, cylLen, 48), tankMat);
            body.rotation.z = Math.PI / 2;
            body.position.y = shellCenterY;
            body.castShadow = true;
            body.receiveShadow = true;
            vessel.add(body);

            const ringGeo = new THREE.TorusGeometry(radius + 0.012, 0.024, 10, 40);
            [-0.42, -0.14, 0.14, 0.42].forEach(xf => {
                const ring = new THREE.Mesh(ringGeo, ringMat);
                ring.rotation.y = Math.PI / 2;
                ring.position.set(xf * cylLen, shellCenterY, 0);
                vessel.add(ring);
            });

            const headGeo = new THREE.SphereGeometry(radius, 36, 22);
            [-1, 1].forEach(sx => {
                const head = new THREE.Mesh(headGeo, tankMat);
                head.scale.set(0.55, 1, 1);
                head.position.set(sx * (cylLen * 0.5), shellCenterY, 0);
                head.castShadow = true;
                vessel.add(head);
            });

            // Top manway / nozzles (like pressure vessel reference)
            [-0.26, 0, 0.26].forEach((xf, idx) => {
                const nozR = idx === 1 ? 0.20 : 0.13;
                const neck = new THREE.Mesh(new THREE.CylinderGeometry(nozR, nozR, 0.28, 20), tankMat);
                neck.position.set(xf * cylLen * 0.85, shellCenterY + radius + 0.08, 0);
                const flange = new THREE.Mesh(new THREE.CylinderGeometry(nozR * 1.4, nozR * 1.4, 0.06, 22), galvMat);
                flange.position.set(xf * cylLen * 0.85, shellCenterY + radius + 0.22, 0);
                vessel.add(neck, flange);
            });

            // Contoured saddles on bottom rails (stay inside frame)
            const saddleH = Math.max(0.35, shellCenterY + H / 2 - 0.12);
            [-0.30, 0.30].forEach(xf => {
                const sx = xf * L;
                const web = new THREE.Mesh(new THREE.BoxGeometry(0.22, saddleH * 0.55, W * 0.72), saddleMat);
                web.position.set(sx, -H / 2 + saddleH * 0.28, 0);
                const base = new THREE.Mesh(new THREE.BoxGeometry(0.40, 0.07, W * 0.78), MATS.darkSteel.clone());
                base.position.set(sx, -H / 2 + 0.05, 0);
                // Curved cradle block under shell
                const cradle = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.16, radius * 1.55), saddleMat);
                cradle.position.set(sx, shellCenterY - radius + 0.02, 0);
                vessel.add(web, base, cradle);
            });

            // Side walkway remnant + ladder hint (professional ISO tank cues)
            const walk = new THREE.Mesh(new THREE.BoxGeometry(L * 0.72, 0.03, 0.36), galvMat);
            walk.position.set(0, shellCenterY + radius + 0.04, W * 0.18);
            vessel.add(walk);

            vessel.traverse(o => { o.userData.noLugWeld = true; });
            group.add(vessel);
        }

        /** Diagonal X-bracing on ISO tank side/end bays (classic T11 / 22K2 look). */
        function addIsoTankXBracing(group, L, W, H, mat) {
            const frameMat = mat || new THREE.MeshStandardMaterial({ color: 0x0284c7, roughness: 0.38, metalness: 0.35 });
            const hx = L / 2 - 0.08;
            const hy = H / 2 - 0.08;
            const hz = W / 2 - 0.08;
            const braceThick = 0.078;

            const addStrut = (p1, p2, thick) => {
                const vec = p2.clone().sub(p1);
                const len = vec.length();
                if (len < 0.05) return;
                const mesh = new THREE.Mesh(new THREE.BoxGeometry(thick, len, thick), frameMat);
                mesh.name = 'ISOTank_XBrace';
                mesh.position.copy(p1).lerp(p2, 0.5);
                mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), vec.normalize());
                mesh.castShadow = true;
                mesh.userData.noLugWeld = true;
                group.add(mesh);
            };

            // Side frames (±Z): full X braces in each end bay + mid upright
            [-1, 1].forEach(sz => {
                const z = sz * hz;
                [-1, 1].forEach(sx => {
                    const x0 = sx * hx;
                    const x1 = sx * (L * 0.22);
                    // Classic X (hai đường chéo giao nhau trong khoang góc)
                    addStrut(new THREE.Vector3(x0, -hy, z), new THREE.Vector3(x1, hy, z), braceThick);
                    addStrut(new THREE.Vector3(x0, hy, z), new THREE.Vector3(x1, -hy, z), braceThick);
                    // Vertical mid post at bay inner edge
                    addStrut(new THREE.Vector3(x1, -hy, z), new THREE.Vector3(x1, hy, z), braceThick * 0.92);
                    // Short corner-to-saddle kickers (load path to tank saddles)
                    addStrut(new THREE.Vector3(x0, -hy, z), new THREE.Vector3(sx * L * 0.28, -H * 0.08, z), braceThick * 0.9);
                    addStrut(new THREE.Vector3(x0, hy, z), new THREE.Vector3(sx * L * 0.28, H * 0.08, z), braceThick * 0.9);
                });
            });

            // End frames (±X): X braces left/right of tank heads
            [-1, 1].forEach(sx => {
                const x = sx * hx;
                [-1, 1].forEach(sz => {
                    const z0 = sz * hz;
                    const z1 = sz * (W * 0.18);
                    addStrut(new THREE.Vector3(x, -hy, z0), new THREE.Vector3(x, hy, z1), braceThick);
                    addStrut(new THREE.Vector3(x, hy, z0), new THREE.Vector3(x, -hy, z1), braceThick);
                    addStrut(new THREE.Vector3(x, -hy, z0), new THREE.Vector3(x, -0.12, z1 * 0.55), braceThick * 0.88);
                    addStrut(new THREE.Vector3(x, hy, z0), new THREE.Vector3(x, 0.18, z1 * 0.55), braceThick * 0.88);
                });
            });
        }

        // 1C. ISO TANK CONTAINER 20FT (T11 / 22K2 with Diagonal Frame Bracing, Saddle Rings, Top Walkway, Ladder & Valves)
        function addIsoTankContainer3D(group, L, W, H) {
            const frameMat = new THREE.MeshStandardMaterial({ color: 0x0284c7, roughness: 0.38, metalness: 0.35 });
            const beamThick = 0.11;

            const hx = L / 2 - 0.08;
            const hy = H / 2 - 0.08;
            const hz = W / 2 - 0.08;

            // 1. 4 Longitudinal Main Rails, 4 Vertical Corner Posts & 4 Transverse End Beams
            [-1, 1].forEach(sy => [-1, 1].forEach(sz => {
                const rail = new THREE.Mesh(new THREE.BoxGeometry(L - 0.16, beamThick, beamThick), frameMat);
                rail.position.set(0, sy * hy, sz * hz);
                rail.castShadow = true;
                group.add(rail);
            }));
            [-1, 1].forEach(sx => [-1, 1].forEach(sz => {
                const post = new THREE.Mesh(new THREE.BoxGeometry(beamThick, H - 0.16, beamThick), frameMat);
                post.position.set(sx * hx, 0, sz * hz);
                post.castShadow = true;
                group.add(post);
            }));
            [-1, 1].forEach(sx => [-1, 1].forEach(sy => {
                const endBeam = new THREE.Mesh(new THREE.BoxGeometry(beamThick, beamThick, W - 0.16), frameMat);
                endBeam.position.set(sx * hx, sy * hy, 0);
                group.add(endBeam);
            }));

            // 2. X-bracing at corner bays (side + end frames)
            addIsoTankXBracing(group, L, W, H, frameMat);

            // 8 ISO 1161 Corner Castings
            addCornerCastings(group, L, W, H);

            // 3. Pressure-vessel style barrel fitted inside ISO frame (learned from vessel cargo CAD)
            installIsoTankPressureVesselBarrel(group, L, W, H);
        }

