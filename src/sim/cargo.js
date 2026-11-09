/**
 * cargo — part of the lifting simulator.
 * These files are assembled into one module so they share state, physics and the scene.
 */
        // --- 6. BUILD 3D CARGO, TIMBER DUNNAGE & SPREADER BEAMS ---
        function rebuildDunnageBlocks() {
            while (dunnageGroup.children.length > 0) dunnageGroup.remove(dunnageGroup.children[0]);
            dunnageGroup.name = 'Timber_Dunnage';
            const { L, W } = state;
            const beamGeo = new THREE.BoxGeometry(0.28, DUNNAGE_H, W + 0.5);
            [-L * 0.34, L * 0.34].forEach((xPos, idx) => {
                const block = new THREE.Mesh(beamGeo, MATS.timberWood);
                block.name = `Timber_Dunnage_Block_${idx + 1}`;
                block.position.set(xPos, DUNNAGE_H / 2, 0);
                block.receiveShadow = true;
                block.castShadow = true;
                dunnageGroup.add(block);
            });
        }

        function addCornerCastings(group, L, W, H) {
            const boxGeo = new THREE.BoxGeometry(0.18, 0.18, 0.18);
            const holeGeoX = new THREE.BoxGeometry(0.19, 0.06, 0.09);
            const holeGeoY = new THREE.BoxGeometry(0.10, 0.19, 0.07);
            const holeGeoZ = new THREE.BoxGeometry(0.09, 0.06, 0.19);
            const holeMat = new THREE.MeshStandardMaterial({ color: 0x05070a, roughness: 0.9, metalness: 0.2 });
            [-1, 1].forEach(sx => [-1, 1].forEach(sy => [-1, 1].forEach(sz => {
                const ccGroup = new THREE.Group();
                const cc = new THREE.Mesh(boxGeo, MATS.darkSteel.clone());
                const hx = new THREE.Mesh(holeGeoX, holeMat);
                const hy = new THREE.Mesh(holeGeoY, holeMat);
                const hz = new THREE.Mesh(holeGeoZ, holeMat);
                ccGroup.add(cc, hx, hy, hz);
                ccGroup.position.set(sx * (L / 2 - 0.09), sy * (H / 2 - 0.09), sz * (W / 2 - 0.09));
                group.add(ccGroup);
            })));
        }

        // ISO 668 dry-van shell: thin skins + exterior trapezoidal corrugation (gân sóng), hollow interior
        function addCorrugatedShell(group, L, W, H, mat) {
            const skin = mat.clone();
            const wallT = 0.055;
            const floorH = 0.16;
            const roofT = 0.05;
            const corrugDepth = 0.038;
            const sideH = H - floorH - roofT - 0.04;

            // Timber / steel floor (interior)
            const floor = new THREE.Mesh(new THREE.BoxGeometry(L - 0.20, floorH, W - 0.20), MATS.timberWood ? MATS.timberWood.clone() : skin);
            floor.position.y = -H / 2 + floorH / 2;
            floor.receiveShadow = true;
            group.add(floor);

            // Top & bottom side rails + end sills (ISO main frame)
            const railH = 0.12;
            [-H / 2 + railH / 2, H / 2 - railH / 2].forEach(ry => {
                [-1, 1].forEach(sz => {
                    const sr = new THREE.Mesh(new THREE.BoxGeometry(L - 0.20, railH, 0.11), skin);
                    sr.position.set(0, ry, sz * (W / 2 - 0.055));
                    sr.castShadow = true;
                    group.add(sr);
                });
                [-1, 1].forEach(sx => {
                    const er = new THREE.Mesh(new THREE.BoxGeometry(0.11, railH, W - 0.20), skin);
                    er.position.set(sx * (L / 2 - 0.055), ry, 0);
                    group.add(er);
                });
            });

            // ±Z corrugated side walls (vertical trapezoid lobes on the OUTSIDE only)
            const numSideRibs = Math.max(12, Math.round(L / 0.28));
            const pitch = (L - 0.70) / Math.max(1, numSideRibs - 1);
            [-1, 1].forEach(sz => {
                const zWall = sz * (W / 2 - wallT * 0.5);
                const panel = new THREE.Mesh(new THREE.BoxGeometry(L - 0.36, sideH, wallT), skin);
                panel.position.set(0, -H / 2 + floorH + sideH / 2, zWall);
                panel.castShadow = true;
                panel.receiveShadow = true;
                group.add(panel);
                for (let i = 0; i < numSideRibs; i++) {
                    const rx = -L / 2 + 0.35 + i * pitch;
                    // Outer lobe
                    const lobe = new THREE.Mesh(new THREE.BoxGeometry(0.10, sideH - 0.04, corrugDepth), skin);
                    lobe.position.set(rx, panel.position.y, zWall + sz * (wallT * 0.5 + corrugDepth * 0.5));
                    group.add(lobe);
                    // Trapezoid shoulder (slightly wider, shallower)
                    const shoulder = new THREE.Mesh(new THREE.BoxGeometry(0.16, sideH - 0.08, corrugDepth * 0.45), skin);
                    shoulder.position.set(rx, panel.position.y, zWall + sz * (wallT * 0.5 + corrugDepth * 0.22));
                    group.add(shoulder);
                }
            });

            // −X front corrugated bulkhead
            const frontZ = -L / 2 + wallT * 0.5 + 0.02;
            const front = new THREE.Mesh(new THREE.BoxGeometry(wallT, sideH, W - 0.28), skin);
            front.position.set(frontZ, -H / 2 + floorH + sideH / 2, 0);
            front.castShadow = true;
            group.add(front);
            const numFrontRibs = Math.max(6, Math.round((W - 0.4) / 0.28));
            for (let i = 0; i < numFrontRibs; i++) {
                const rz = -W / 2 + 0.28 + i * ((W - 0.56) / Math.max(1, numFrontRibs - 1));
                const lobe = new THREE.Mesh(new THREE.BoxGeometry(corrugDepth, sideH - 0.06, 0.10), skin);
                lobe.position.set(frontZ - wallT * 0.5 - corrugDepth * 0.5, front.position.y, rz);
                group.add(lobe);
            }

            // +X rear doors (twin leaves) + locking rods
            const doorT = 0.05;
            const doorX = L / 2 - doorT * 0.5 - 0.02;
            [-1, 1].forEach(sz => {
                const leaf = new THREE.Mesh(new THREE.BoxGeometry(doorT, sideH - 0.06, W * 0.48 - 0.04), skin);
                leaf.position.set(doorX, -H / 2 + floorH + sideH / 2, sz * W * 0.25);
                leaf.castShadow = true;
                group.add(leaf);
            });
            // Door cams / horizontal anti-rack bars
            [-0.28, 0.08, 0.38].forEach(yf => {
                const bar = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.05, W - 0.30), MATS.galvSteel.clone());
                bar.position.set(doorX + 0.02, -H / 2 + floorH + sideH * (0.5 + yf * 0.35), 0);
                group.add(bar);
            });
            [-0.34, -0.14, 0.14, 0.34].forEach(zf => {
                const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.016, sideH - 0.12, 10), MATS.galvSteel.clone());
                rod.position.set(L / 2 - 0.01, -H / 2 + floorH + sideH / 2, zf * W);
                group.add(rod);
            });

            // CSC Safety Approval Plate on left door leaf
            const cscPlate = new THREE.Mesh(new THREE.BoxGeometry(0.015, 0.22, 0.32), new THREE.MeshStandardMaterial({ color: 0xcfd8dc, roughness: 0.35, metalness: 0.7 }));
            cscPlate.position.set(L / 2 + 0.01, -H / 2 + floorH + sideH * 0.45, -W * 0.22);
            group.add(cscPlate);

            // Door operating handles (Tay khóa xoay container)
            [-0.14, 0.14].forEach(zf => {
                const handle = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.03, 0.18), MATS.galvSteel.clone());
                handle.position.set(L / 2 + 0.025, -H / 2 + floorH + sideH * 0.38, zf * W + (zf < 0 ? 0.08 : -0.08));
                group.add(handle);
            });

            // Corrugated roof (transverse ribs)
            const roofY = H / 2 - roofT / 2;
            const roof = new THREE.Mesh(new THREE.BoxGeometry(L - 0.28, roofT, W - 0.28), skin);
            roof.position.y = roofY;
            roof.castShadow = true;
            group.add(roof);
            const numRoofRibs = Math.max(14, Math.round(L / 0.26));
            for (let i = 0; i < numRoofRibs; i++) {
                const rx = -L / 2 + 0.30 + i * ((L - 0.60) / Math.max(1, numRoofRibs - 1));
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

            // Two Hollow Corrugated Side Walls (Left -Z and Right +Z)
            const sideWallH = H - 0.24;
            const sidePanelGeo = new THREE.BoxGeometry(L - 0.24, sideWallH, wallThick);
            const numRibs = Math.max(10, Math.floor(L * 3.2));
            [-1, 1].forEach(sz => {
                const wz = sz * (W / 2 - wallThick * 0.65);
                const panel = new THREE.Mesh(sidePanelGeo, wallMat);
                panel.position.set(0, 0, wz);
                panel.castShadow = true;
                panel.receiveShadow = true;
                group.add(panel);

                for (let i = 0; i < numRibs; i++) {
                    const rx = -L / 2 + 0.34 + (i / (numRibs - 1)) * (L - 0.68);
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
            const cL = THREE.MathUtils.clamp(state.oogCargoL || L * 0.84, 1.2, L - 0.22);
            const cW = THREE.MathUtils.clamp(state.oogCargoW || W * 0.88, 0.9, W - 0.16);
            const cH = THREE.MathUtils.clamp(state.oogCargoH || H * 1.15, 0.6, 4.8);
            const cargoPeakY = floorTopY + cH;

            if (hasCargo) {
                const cargoGroup = new THREE.Group();
                // Heavy timber dunnage skid + steel machinery base
                const skidH = Math.min(0.18, cH * 0.12);
                const skid = new THREE.Mesh(new THREE.BoxGeometry(cL, skidH, cW), MATS.woodCrate.clone());
                skid.position.y = floorTopY + skidH / 2;
                cargoGroup.add(skid);

                // Giant OTR Mining Tires & Heavy Equipment Modules (matching real-world Open Top OOG cargo)
                const bodyH = Math.max(0.3, cH - skidH);
                const tireDia = bodyH;
                const tireR = tireDia * 0.5;
                const tireThick = Math.min(cW * 0.42, 0.78);
                const numTires = Math.max(2, Math.min(5, Math.floor(cL / Math.max(0.75, tireDia * 0.72))));
                const tireMat = MATS.rubberTire ? MATS.rubberTire.clone() : MATS.darkSteel.clone();

                // Central support rack + Giant OTR Tires standing upright inside the Open Top container
                const rack = new THREE.Mesh(new THREE.BoxGeometry(cL * 0.92, bodyH * 0.52, cW * 0.76), MATS.woodCrate.clone());
                rack.position.y = floorTopY + skidH + bodyH * 0.26;
                rack.castShadow = true;
                cargoGroup.add(rack);

                for (let t = 0; t < numTires; t++) {
                    const tx = numTires === 1 ? 0 : (-cL * 0.34 + (t / (numTires - 1)) * (cL * 0.68));
                    const tz = (t % 2 === 0 ? 1 : -1) * Math.min(0.12, (cW - tireThick) * 0.22);
                    const tireGroup = new THREE.Group();
                    tireGroup.position.set(tx, floorTopY + skidH + tireR, tz);
                    tireGroup.rotation.y = 0.22 * (t % 2 === 0 ? 1 : -1);

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

            // Dynamic 3D Deformable Tarpaulin Sheet (Tấm vải bạt phủ nóc căng phồng theo đỉnh hàng)
            if (hasTarp) {
                const tarpGroup = new THREE.Group();
                tarpGroup.name = 'openTopTarpaulin';
                const segX = 36;
                const segZ = 20;
                const tarpL = L - 0.04;
                const tarpW = W - 0.04;
                const skirtDrop = 0.28;
                const tarpMat = new THREE.MeshStandardMaterial({
                    color: 0xdbe4ee,
                    roughness: 0.62,
                    metalness: 0.06,
                    side: THREE.DoubleSide
                });

                // Top tented sheet vertices displaced smoothly over the cargo contour peak
                const topGeo = new THREE.PlaneGeometry(tarpL, tarpW, segX, segZ);
                topGeo.rotateX(-Math.PI / 2);
                const pos = topGeo.attributes.position;
                const overTop = hasCargo ? Math.max(0, cargoPeakY - H / 2 + 0.04) : 0;

                for (let i = 0; i < pos.count; i++) {
                    const vx = pos.getX(i);
                    const vz = pos.getZ(i);
                    const edgeX = Math.abs(vx) / (tarpL * 0.5);
                    const edgeZ = Math.abs(vz) / (tarpW * 0.5);
                    const rimLock = Math.max(0, 1 - Math.pow(Math.max(edgeX, edgeZ), 6));

                    // Smooth tenting profile over cargo footprint (cL x cW)
                    const ux = Math.max(0, 1 - Math.pow(vx / Math.max(0.35, cL * 0.54), 2));
                    const uz = Math.max(0, 1 - Math.pow(vz / Math.max(0.30, cW * 0.54), 2));
                    const dome = Math.pow(ux * uz, 0.65);

                    // Subtle realistic fabric tension ripples between roof bows
                    const bowWave = Math.cos((vx / Math.max(0.5, L)) * bowCount * Math.PI * 2) * 0.012 * (1 - dome * 0.6);
                    const baseCrown = 0.035 * (1 - edgeZ * edgeZ);
                    const yVal = H / 2 + 0.01 + rimLock * (overTop * dome + baseCrown + bowWave);
                    pos.setY(i, yVal);
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

            // 4. Toggleable & Adjustable OOG Cargo on Flat Rack (Supports Over-Width, Over-Length, Over-Height)
            if (state.oogHasCargo !== false) {
                const oogGroup = new THREE.Group();
                oogGroup.name = 'flatRackOogCargo';
                const cL = THREE.MathUtils.clamp(state.oogCargoL || L * 0.72, 1.5, 14.5);
                const cW = THREE.MathUtils.clamp(state.oogCargoW || W * 1.28, 1.0, 5.2);
                const cH = THREE.MathUtils.clamp(state.oogCargoH || H * 1.08, 0.8, 4.8);
                const dunnageH = 0.10;
                const cargoBottomY = deckTopY + dunnageH;
                const cargoTopY = cargoBottomY + cH;

                // Transverse Timber Dunnage Bearers & Wooden Pallets on deck (extending to max(W, cW))
                const bearerW = Math.max(W - 0.12, cW + 0.14);
                const numBearers = Math.max(4, Math.floor(cL * 0.85));
                for (let b = 0; b < numBearers; b++) {
                    const bx = -cL * 0.44 + (b / (numBearers - 1)) * (cL * 0.88);
                    const bearer = new THREE.Mesh(new THREE.BoxGeometry(0.16, dunnageH, bearerW), plankMat);
                    bearer.position.set(bx, deckTopY + dunnageH / 2, 0);
                    bearer.castShadow = true;
                    bearer.userData.noLugWeld = true;
                    group.add(bearer);
                }

                // Fore & Aft Cribbing Pallets on unoccupied deck ends (exactly like reference photo)
                const freeEndSpan = (L - 0.50 - cL) * 0.5;
                if (freeEndSpan > 0.65) {
                    [-1, 1].forEach(sx => {
                        const px = sx * (cL * 0.5 + freeEndSpan * 0.5);
                        const pallet = new THREE.Mesh(new THREE.BoxGeometry(freeEndSpan * 0.82, 0.11, W * 0.86), plankMat);
                        pallet.position.set(px, deckTopY + 0.055, 0);
                        pallet.userData.noLugWeld = true;
                        group.add(pallet);
                    });
                }

                // Heavy Plywood & Timber-Framed OOG Machinery Case
                const crateMat = MATS.woodCrate.clone();
                const crateBody = new THREE.Mesh(new THREE.BoxGeometry(cL, cH, cW), crateMat);
                crateBody.position.set(0, cargoBottomY + cH / 2, 0);
                crateBody.castShadow = true;
                crateBody.receiveShadow = true;
                oogGroup.add(crateBody);

                // Solid Heavy-Duty UV Waterproof Top Sheeting Hood (Lớp bạt nilon dày che đỉnh thùng hàng)
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
                polyHood.position.set(0, cargoTopY - hoodH / 2 + 0.015, 0);
                polyHood.castShadow = true;
                polyHood.receiveShadow = true;
                oogGroup.add(polyHood);

                // Exterior Timber Framing Studs & Horizontal Battens
                const studCount = Math.max(4, Math.floor(cL * 0.9));
                for (let s = 0; s < studCount; s++) {
                    const sx = -cL * 0.48 + (s / (studCount - 1)) * (cL * 0.96);
                    const stud = new THREE.Mesh(new THREE.BoxGeometry(0.09, cH + 0.02, cW + 0.04), plankMat);
                    stud.position.set(sx, cargoBottomY + cH / 2, 0);
                    oogGroup.add(stud);
                }
                [0.06, 0.52, 0.96].forEach(hf => {
                    const band = new THREE.Mesh(new THREE.BoxGeometry(cL + 0.04, 0.09, cW + 0.04), plankMat);
                    band.position.set(0, cargoBottomY + cH * hf, 0);
                    oogGroup.add(band);
                });

                // Heavy-Duty Orange Polyester Ratchet Lashing Straps (Dây chằng tăng đơ màu cam)
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
                for (let k = 0; k < strapCount; k++) {
                    const sx = -cL * 0.42 + (k / (strapCount - 1)) * (cL * 0.84);
                    // Top horizontal strap across roof cleanly resting on top of the hood
                    const topStrap = new THREE.Mesh(new THREE.BoxGeometry(0.065, 0.018, cW + 0.09), lashingStrapMat);
                    topStrap.position.set(sx, cargoTopY + 0.032, 0);
                    topStrap.castShadow = true;
                    lashingGroup.add(topStrap);

                    // Left & Right vertical/angled lashing legs down to Flat Rack side rails + Steel Ratchet Tensioner
                    [-1, 1].forEach(sz => {
                        const sideStrap = new THREE.Mesh(new THREE.BoxGeometry(0.065, cH + dunnageH, 0.018), lashingStrapMat);
                        sideStrap.position.set(sx, deckTopY + (cH + dunnageH) * 0.5, sz * (cW * 0.5 + 0.036));
                        sideStrap.castShadow = true;
                        lashingGroup.add(sideStrap);

                        // Metallic ratchet buckle tensioner at mid-lower height
                        const ratchet = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.18, 0.05), MATS.galvSteel);
                        ratchet.position.set(sx, cargoBottomY + cH * 0.28, sz * (cW * 0.5 + 0.045));
                        lashingGroup.add(ratchet);

                        // Snapped/frayed strap tail remaining on Flat Rack side girder after lashing rupture
                        const tailLen = 0.55 + (k % 2) * 0.18;
                        const brokenTail = new THREE.Mesh(new THREE.BoxGeometry(0.065, tailLen, 0.018), MATS.redMaster);
                        brokenTail.position.set(sx, deckTopY - tailLen * 0.38, sz * (W * 0.5 + 0.035));
                        brokenTail.rotation.x = sz * 0.28;
                        brokenTail.rotation.z = (k % 2 === 0 ? 1 : -1) * 0.16;
                        brokenLashingGroup.add(brokenTail);
                    });
                }
                oogGroup.add(lashingGroup);
                brokenLashingGroup.traverse(o => { o.userData.noLugWeld = true; });
                group.add(brokenLashingGroup);

                oogGroup.userData.oogMeta = {
                    cL,
                    cW,
                    cH,
                    // Exact outer envelope used by physics (separate from Flat Rack L/W/H)
                    half: { hx: cL * 0.5, hy: cH * 0.5, hz: cW * 0.5 },
                    centerY: cargoBottomY + cH / 2,
                    cargoBottomY,
                    deckTopY,
                    deckH: 0.30,
                    frameL: L,
                    frameW: W,
                    frameH: H
                };
                oogGroup.traverse(o => { o.userData.noLugWeld = true; });
                group.add(oogGroup);
            }
        }

        // 1C. ISO TANK CONTAINER 20FT (T11 / 22K2 with Diagonal Frame Bracing, Saddle Rings, Top Walkway, Ladder & Valves)
        function addIsoTankContainer3D(group, L, W, H) {
            const frameMat = new THREE.MeshStandardMaterial({ color: 0x0284c7, roughness: 0.38, metalness: 0.35 });
            const tankMat = MATS.tankSteel ? MATS.tankSteel.clone() : MATS.vesselSteel.clone();
            const darkMat = MATS.darkSteel.clone();
            const galvMat = MATS.galvSteel.clone();
            const beamThick = 0.11;

            const addStrut = (p1, p2, thick, mat) => {
                const vec = p2.clone().sub(p1);
                const len = vec.length();
                if (len < 0.05) return;
                const mesh = new THREE.Mesh(new THREE.BoxGeometry(thick, len, thick), mat);
                mesh.position.copy(p1).lerp(p2, 0.5);
                mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), vec.normalize());
                mesh.castShadow = true;
                group.add(mesh);
            };

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

            // 2. Authentic Diagonal Load-Transfer Bracing Struts on Side Frames & End Frames
            [-1, 1].forEach(sz => {
                const z = sz * hz;
                [-1, 1].forEach(sx => {
                    // Corner to saddle diagonal struts
                    addStrut(new THREE.Vector3(sx * hx, -hy, z), new THREE.Vector3(sx * L * 0.24, 0, z), 0.085, frameMat);
                    addStrut(new THREE.Vector3(sx * hx,  hy, z), new THREE.Vector3(sx * L * 0.24, 0, z), 0.085, frameMat);
                    addStrut(new THREE.Vector3(sx * L * 0.24, -hy, z), new THREE.Vector3(sx * L * 0.24, hy, z), 0.08, frameMat);
                });
            });
            [-1, 1].forEach(sx => {
                const x = sx * hx;
                [-1, 1].forEach(sz => {
                    addStrut(new THREE.Vector3(x, -hy, sz * hz), new THREE.Vector3(x, -0.15, sz * 0.22), 0.085, frameMat);
                    addStrut(new THREE.Vector3(x,  hy, sz * hz), new THREE.Vector3(x,  0.22, sz * 0.28), 0.08, frameMat);
                });
            });

            // 8 ISO 1161 Corner Castings
            addCornerCastings(group, L, W, H);

            // 3. Cylindrical Stainless/Clad Pressure Tank Shell + 2:1 Ellipsoidal Dished Heads + End Saddle Rings
            const radius = Math.min(W, H) * 0.425;
            const cylLen = L * 0.78;
            const shell = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, cylLen, 44), tankMat);
            shell.rotation.z = Math.PI / 2;
            shell.castShadow = true;
            shell.receiveShadow = true;
            group.add(shell);

            // Circumferential Stainless Cladding Seam Bands & Black End Saddle Rings
            [-0.48, -0.24, 0, 0.24, 0.48].forEach((xf, idx) => {
                const isEndRing = idx === 0 || idx === 4;
                const band = new THREE.Mesh(
                    new THREE.TorusGeometry(radius + (isEndRing ? 0.018 : 0.008), isEndRing ? 0.032 : 0.012, 12, 44),
                    isEndRing ? darkMat : galvMat
                );
                band.rotation.y = Math.PI / 2;
                band.position.x = xf * cylLen;
                group.add(band);
            });

            [-1, 1].forEach(sx => {
                const head = new THREE.Mesh(new THREE.SphereGeometry(radius, 36, 20), tankMat);
                head.scale.set(0.46, 1, 1);
                head.position.x = sx * (cylLen * 0.5);
                head.castShadow = true;
                group.add(head);
            });

            // 4. Top Aluminum Non-Slip Catwalk Walkway Grating + Folding Safety Handrail
            const walkY = radius + 0.055;
            const walkway = new THREE.Mesh(new THREE.BoxGeometry(L * 0.84, 0.028, 0.46), galvMat);
            walkway.position.set(0, walkY, 0.24);
            group.add(walkway);
            const crossWalk = new THREE.Mesh(new THREE.BoxGeometry(0.48, 0.028, W * 0.72), galvMat);
            crossWalk.position.set(0, walkY, 0);
            group.add(crossWalk);

            // Top Folding Safety Handrail along walkway
            const railTopY = Math.min(H / 2 + 0.16, walkY + 0.28);
            const topHandrail = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.014, L * 0.78, 10), galvMat);
            topHandrail.rotation.z = Math.PI / 2;
            topHandrail.position.set(0, railTopY, 0.44);
            group.add(topHandrail);
            [-0.36, -0.12, 0.12, 0.36].forEach(xf => {
                const stanchion = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, railTopY - walkY, 8), galvMat);
                stanchion.position.set(xf * L, 0.5 * (walkY + railTopY), 0.44);
                group.add(stanchion);
            });

            // 5. Recessed Top Manhole Dome, Spill Box & Safety Relief Valve
            const spillBox = new THREE.Mesh(new THREE.BoxGeometry(0.58, 0.14, 0.58), galvMat);
            spillBox.position.set(-0.15, radius - 0.01, 0);
            const manholeNeck = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 0.14, 24), tankMat);
            manholeNeck.position.set(-0.15, radius + 0.04, 0);
            const manholeLid = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.25, 0.04, 24), darkMat);
            manholeLid.position.set(-0.15, radius + 0.12, 0);
            const safetyValve = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.09, 0.18, 16), MATS.yellowHazard);
            safetyValve.position.set(0.32, radius + 0.06, 0);
            group.add(spillBox, manholeNeck, manholeLid, safetyValve);

            // 6. Rear Access Ladder (+X End) & Bottom Discharge Valve Manifold Box
            const ladderX = L / 2 - 0.04;
            const ladderZ = 0.34;
            [-0.16, 0.16].forEach(dz => {
                const stile = new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.016, H - 0.24, 8), galvMat);
                stile.position.set(ladderX, 0, ladderZ + dz);
                group.add(stile);
            });
            for (let r = 0; r < 8; r++) {
                const ry = -H * 0.38 + (r / 7) * (H * 0.76);
                const rung = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.32, 8), galvMat);
                rung.rotation.x = Math.PI / 2;
                rung.position.set(ladderX, ry, ladderZ);
                group.add(rung);
            }

            // Bottom Discharge Valve Box & CSC Data Plate
            const valveBox = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.34, 0.44), darkMat);
            valveBox.position.set(L / 2 - 0.26, -H / 2 + 0.28, -0.05);
            const valvePipe = new THREE.Mesh(new THREE.CylinderGeometry(0.065, 0.065, 0.28, 16), galvMat);
            valvePipe.rotation.z = Math.PI / 2;
            valvePipe.position.set(L / 2 - 0.12, -H / 2 + 0.28, -0.05);
            const dataPlate = new THREE.Mesh(new THREE.BoxGeometry(0.65, 0.48, 0.03), darkMat);
            dataPlate.position.set(-L * 0.28, -H * 0.18, W / 2 - 0.04);
            group.add(valveBox, valvePipe, dataPlate);

            // Hazmat Diamond Placards on both sides
            [-1, 1].forEach(sz => {
                const placard = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.28, 0.02), MATS.craneRed.clone());
                placard.rotation.z = Math.PI / 4;
                placard.position.set(L * 0.08, 0.08, sz * (radius + 0.015));
                group.add(placard);
            });
        }

        // --- HIGH-FIDELITY 3D REFRIGERATION MACHINERY UNIT (CARRIER TRANSICOLD / THERMO KING) ---
        function addReeferMachineryUnit(targetGroup, L, W, H) {
            const unitGroup = new THREE.Group();
            unitGroup.name = 'reeferRefrigerationUnit';

            const unitW = W * 0.88;
            const unitH = H * 0.84;
            const unitDepth = 0.38;
            const posX = -L / 2;

            const frameMat = new THREE.MeshStandardMaterial({
                color: 0x334155, // Slate / galvanized machinery frame
                roughness: 0.38,
                metalness: 0.65
            });
            const panelMat = new THREE.MeshStandardMaterial({
                color: 0xe2e8f0, // White-galvanized access panels
                roughness: 0.35,
                metalness: 0.45
            });
            const darkMat = new THREE.MeshStandardMaterial({
                color: 0x0f172a, // Deep charcoal fan housing / intake bay
                roughness: 0.6,
                metalness: 0.3
            });
            const chromeMat = new THREE.MeshStandardMaterial({
                color: 0xf1f5f9,
                roughness: 0.18,
                metalness: 0.92
            });
            const safetyYellow = new THREE.MeshStandardMaterial({
                color: 0xfacc15,
                roughness: 0.4,
                metalness: 0.1
            });
            const ledGreen = new THREE.MeshStandardMaterial({
                color: 0x10b981,
                emissive: 0x10b981,
                emissiveIntensity: 0.85,
                roughness: 0.2
            });

            // 1. Recessed Machinery Bay Casing (Flush into container front bulkhead)
            const casing = new THREE.Mesh(new THREE.BoxGeometry(unitDepth, unitH, unitW), frameMat);
            casing.position.set(posX + unitDepth / 2, 0, 0);
            casing.castShadow = true;
            casing.receiveShadow = true;
            unitGroup.add(casing);

            // Front Flange Perimeter Trim (Khung viền ôm sát vách mặt lưng)
            const flangeThick = 0.05;
            [-unitW / 2, unitW / 2].forEach(fz => {
                const sideFlange = new THREE.Mesh(new THREE.BoxGeometry(0.06, unitH, flangeThick), frameMat);
                sideFlange.position.set(posX + 0.02, 0, fz);
                unitGroup.add(sideFlange);
            });
            [-unitH / 2, unitH / 2].forEach(fy => {
                const hFlange = new THREE.Mesh(new THREE.BoxGeometry(0.06, flangeThick, unitW), frameMat);
                hFlange.position.set(posX + 0.02, fy, 0);
                unitGroup.add(hFlange);
            });

            // 2. Twin High-Flow Condenser Fan Grilles (Quạt hút tản nhiệt đôi)
            const fanR = Math.min(0.24, unitW * 0.22);
            const fanY = unitH * 0.22;
            [-unitW * 0.24, unitW * 0.24].forEach(fz => {
                // Recessed Fan Cowl Ring
                const cowl = new THREE.Mesh(new THREE.CylinderGeometry(fanR, fanR * 1.05, 0.06, 24), darkMat);
                cowl.rotation.z = Math.PI / 2;
                cowl.position.set(posX + 0.05, fanY, fz);
                unitGroup.add(cowl);

                // Circular Chrome Protective Wire Mesh Ring
                const guardRing = new THREE.Mesh(new THREE.TorusGeometry(fanR * 0.94, 0.012, 8, 24), chromeMat);
                guardRing.rotation.y = Math.PI / 2;
                guardRing.position.set(posX + 0.01, fanY, fz);
                unitGroup.add(guardRing);

                // Fan Motor Center Hub
                const hub = new THREE.Mesh(new THREE.CylinderGeometry(fanR * 0.28, fanR * 0.28, 0.05, 16), darkMat);
                hub.rotation.z = Math.PI / 2;
                hub.position.set(posX + 0.04, fanY, fz);
                unitGroup.add(hub);

                // 4 Fan Blades inside
                for (let b = 0; b < 4; b++) {
                    const angle = (b * Math.PI) / 2 + Math.PI / 8;
                    const blade = new THREE.Mesh(new THREE.BoxGeometry(0.018, fanR * 0.65, 0.045), chromeMat);
                    blade.position.set(posX + 0.04, fanY + Math.cos(angle) * fanR * 0.45, fz + Math.sin(angle) * fanR * 0.45);
                    blade.rotation.x = angle;
                    blade.rotation.y = 0.35;
                    unitGroup.add(blade);
                }
            });

            // 3. Condenser Intake Louvered Air Grille (Cụm nan chớp hút gió nhôm)
            const louverH = unitH * 0.32;
            const louverY = -unitH * 0.08;
            const louverW = unitW * 0.88;
            const numLouvers = 8;
            for (let l = 0; l < numLouvers; l++) {
                const ly = louverY - louverH / 2 + (l / (numLouvers - 1)) * louverH;
                const slat = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.016, louverW), panelMat);
                slat.position.set(posX + 0.03, ly, 0);
                slat.rotation.z = 0.35;
                unitGroup.add(slat);
            }

            // 4. Microprocessor Electronic Control Box (Hộp điều khiển màn hình LED)
            const ctrlW = unitW * 0.34;
            const ctrlH = unitH * 0.22;
            const ctrlBox = new THREE.Mesh(new THREE.BoxGeometry(0.08, ctrlH, ctrlW), frameMat);
            ctrlBox.position.set(posX + 0.04, -unitH * 0.32, -unitW * 0.26);
            unitGroup.add(ctrlBox);

            // LED Digital Display Window (-25.0°C)
            const ledDisp = new THREE.Mesh(new THREE.BoxGeometry(0.01, ctrlH * 0.32, ctrlW * 0.65), ledGreen);
            ledDisp.position.set(posX + 0.005, -unitH * 0.30, -unitW * 0.26);
            unitGroup.add(ledDisp);

            // Keypad Buttons
            [-0.04, 0.04].forEach(bz => {
                const btnMesh = new THREE.Mesh(new THREE.BoxGeometry(0.015, 0.025, 0.035), chromeMat);
                btnMesh.position.set(posX + 0.005, -unitH * 0.38, -unitW * 0.26 + bz);
                unitGroup.add(btnMesh);
            });

            // 5. 460V 3-Phase Industrial Power Cable & Plug Locker (Hộc cuộn dây nguồn & phích cắm)
            const cableBoxW = unitW * 0.34;
            const cableBoxH = unitH * 0.22;
            const cableBox = new THREE.Mesh(new THREE.BoxGeometry(0.10, cableBoxH, cableBoxW), darkMat);
            cableBox.position.set(posX + 0.05, -unitH * 0.32, unitW * 0.26);
            unitGroup.add(cableBox);

            // Coiled Marine Heavy-Duty Power Cable (Dây cáp cao su 460V uốn tròn)
            const cableCoil = new THREE.Mesh(new THREE.TorusGeometry(0.075, 0.022, 10, 20), darkMat);
            cableCoil.rotation.y = Math.PI / 2;
            cableCoil.position.set(posX + 0.02, -unitH * 0.32, unitW * 0.26);
            unitGroup.add(cableCoil);

            // Yellow Heavy-Duty Industrial Plug (Phích cắm điện 3 pha công nghiệp màu vàng)
            const plug = new THREE.Mesh(new THREE.CylinderGeometry(0.028, 0.028, 0.08, 12), safetyYellow);
            plug.rotation.z = Math.PI / 2;
            plug.position.set(posX + 0.01, -unitH * 0.32, unitW * 0.34);
            unitGroup.add(plug);

            // 6. Decals & Compliance Badges
            const voltDecal = new THREE.Mesh(new THREE.BoxGeometry(0.01, 0.09, 0.09), safetyYellow);
            voltDecal.rotation.x = Math.PI / 4;
            voltDecal.position.set(posX + 0.01, -unitH * 0.18, unitW * 0.26);
            unitGroup.add(voltDecal);

            const rPlate = new THREE.Mesh(new THREE.BoxGeometry(0.01, 0.06, 0.16), ledGreen);
            rPlate.position.set(posX + 0.01, -unitH * 0.18, -unitW * 0.26);
            unitGroup.add(rPlate);

            targetGroup.add(unitGroup);
        }

        // --- HIGH-FIDELITY 3D OPEN TOP ROOF ASSEMBLY (TARPAULIN, ROOF BOWS & SWINGING HEADER) ---
        function addOpenTopTopAssembly(targetGroup, L, W, H) {
            const topGroup = new THREE.Group();
            topGroup.name = 'openTopRoofAssembly';

            const wallMat = MATS.containerBlue.clone();
            const galvMat = MATS.galvSteel.clone();
            const hasTarp = state.oogTarp !== false;
            const hasCargo = state.oogHasCargo !== false;

            // 1. Removable Swinging Rear Door Header (Thanh xà gồ ngang đỉnh cửa sau tháo rời / xoay mở)
            const headerH = 0.12;
            const headerW = W - 0.22;
            const rearHeader = new THREE.Mesh(new THREE.BoxGeometry(0.12, headerH, headerW), wallMat);
            rearHeader.position.set(L / 2 - 0.08, H / 2 - headerH / 2, 0);
            rearHeader.castShadow = true;
            topGroup.add(rearHeader);

            // Heavy Galvanized Steel Pivot Hinges & Safety Retaining Pins on Rear Header
            [-headerW / 2 + 0.04, headerW / 2 - 0.04].forEach(hz => {
                const hingeLug = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.14, 12), galvMat);
                hingeLug.position.set(L / 2 - 0.08, H / 2 - headerH / 2, hz);
                topGroup.add(hingeLug);
            });

            // 2. Removable Arched Tubular Steel Roof Bows (Xà gồ mui cong đỡ bạt)
            const bowCount = Math.max(5, Math.floor(L * 1.1));
            for (let i = 0; i < bowCount; i++) {
                const bx = -L * 0.38 + (i / (bowCount - 1)) * (L * 0.76);
                const curve = new THREE.QuadraticBezierCurve3(
                    new THREE.Vector3(bx, H / 2 - 0.03, -W / 2 + 0.10),
                    new THREE.Vector3(bx, H / 2 + 0.055, 0),
                    new THREE.Vector3(bx, H / 2 - 0.03, W / 2 - 0.10)
                );
                const bowGeo = new THREE.TubeGeometry(curve, 16, 0.016, 8, false);
                const bow = new THREE.Mesh(bowGeo, galvMat);
                bow.castShadow = true;
                topGroup.add(bow);
            }

            // 3. Tarpaulin Cover (Bạt phủ PVC mui) when hasTarp is true
            if (hasTarp) {
                const tarpL = L - 0.04;
                const tarpW = W - 0.04;
                const skirtDrop = 0.28;
                const tarpMat = new THREE.MeshStandardMaterial({
                    color: 0xdbe4ee,
                    roughness: 0.62,
                    metalness: 0.06,
                    side: THREE.DoubleSide
                });

                const segX = 36;
                const segZ = 20;
                const topGeo = new THREE.PlaneGeometry(tarpL, tarpW, segX, segZ);
                topGeo.rotateX(-Math.PI / 2);
                const pos = topGeo.attributes.position;
                const floorTopY = -H / 2 + 0.18;
                const cH = THREE.MathUtils.clamp(state.oogCargoH || H * 1.15, 0.6, 4.8);
                const cargoPeakY = floorTopY + cH;
                const overTop = hasCargo ? Math.max(0, cargoPeakY - H / 2 + 0.04) : 0;
                const cL = THREE.MathUtils.clamp(state.oogCargoL || L * 0.84, 1.2, L - 0.22);
                const cW = THREE.MathUtils.clamp(state.oogCargoW || W * 0.88, 0.9, W - 0.16);

                for (let i = 0; i < pos.count; i++) {
                    const vx = pos.getX(i);
                    const vz = pos.getZ(i);
                    const edgeX = Math.abs(vx) / (tarpL * 0.5);
                    const edgeZ = Math.abs(vz) / (tarpW * 0.5);
                    const rimLock = Math.max(0, 1 - Math.pow(Math.max(edgeX, edgeZ), 6));

                    const ux = Math.max(0, 1 - Math.pow(vx / Math.max(0.35, cL * 0.54), 2));
                    const uz = Math.max(0, 1 - Math.pow(vz / Math.max(0.30, cW * 0.54), 2));
                    const dome = Math.pow(ux * uz, 0.65);

                    const bowWave = Math.cos((vx / Math.max(0.5, L)) * bowCount * Math.PI * 2) * 0.012 * (1 - dome * 0.6);
                    const baseCrown = 0.045 * (1 - edgeZ * edgeZ);
                    const yVal = H / 2 + 0.01 + rimLock * (overTop * dome + baseCrown + bowWave);
                    pos.setY(i, yVal);
                }
                topGeo.computeVertexNormals();
                const topTarpMesh = new THREE.Mesh(topGeo, tarpMat);
                topTarpMesh.castShadow = true;
                topTarpMesh.receiveShadow = true;
                topGroup.add(topTarpMesh);

                // 4 Skirt Flaps + Brass Grommets + TIR Lashing Cord
                [-1, 1].forEach(sz => {
                    const flap = new THREE.Mesh(new THREE.BoxGeometry(tarpL, skirtDrop, 0.02), tarpMat);
                    flap.position.set(0, H / 2 - skirtDrop / 2 + 0.01, sz * (tarpW / 2 + 0.01));
                    flap.castShadow = true;
                    topGroup.add(flap);

                    const eyeletCount = Math.floor(L * 2.8);
                    for (let e = 0; e < eyeletCount; e++) {
                        const ex = -tarpL / 2 + 0.22 + (e / (eyeletCount - 1)) * (tarpL - 0.44);
                        const ey = H / 2 - skirtDrop + 0.04;
                        const ring = new THREE.Mesh(new THREE.TorusGeometry(0.014, 0.0035, 6, 12), MATS.brassGold || galvMat);
                        ring.position.set(ex, ey, sz * (tarpW / 2 + 0.022));
                        topGroup.add(ring);
                    }
                });
                [-1, 1].forEach(sx => {
                    const endFlap = new THREE.Mesh(new THREE.BoxGeometry(0.02, skirtDrop, tarpW - 0.06), tarpMat);
                    endFlap.position.set(sx * (tarpL / 2 + 0.01), H / 2 - skirtDrop / 2 + 0.01, 0);
                    endFlap.castShadow = true;
                    topGroup.add(endFlap);
                });

                // Continuous Zigzag Customs TIR Lashing Cable
                const tirPoints = [];
                const nSteps = Math.floor(L * 3.2);
                for (let s = 0; s <= nSteps; s++) {
                    const px = -tarpL / 2 + 0.20 + (s / nSteps) * (tarpL - 0.40);
                    const py = (s % 2 === 0) ? (H / 2 - 0.02) : (H / 2 - skirtDrop + 0.02);
                    tirPoints.push(new THREE.Vector3(px, py, tarpW / 2 + 0.026));
                }
                const tirGeo = new THREE.BufferGeometry().setFromPoints(tirPoints);
                const tirMat = new THREE.LineBasicMaterial({ color: 0x38bdf8, linewidth: 2 });
                topGroup.add(new THREE.Line(tirGeo, tirMat));

                // Customs Lead Seal at Front-Right Corner
                const seal = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.04, 12), new THREE.MeshStandardMaterial({ color: 0xfacc15, metalness: 0.8 }));
                seal.position.set(tarpL / 2, H / 2 - skirtDrop + 0.02, tarpW / 2 + 0.03);
                topGroup.add(seal);
            } else {
                // When tarp is off: add internal timber floor & cargo if enabled
                const floorH = 0.18;
                const floorTopY = -H / 2 + floorH;
                const floorMat = MATS.timberWood ? MATS.timberWood.clone() : MATS.woodCrate.clone();
                const baseFloor = new THREE.Mesh(new THREE.BoxGeometry(L - 0.20, floorH, W - 0.20), floorMat);
                baseFloor.position.y = -H / 2 + floorH / 2;
                baseFloor.receiveShadow = true;
                topGroup.add(baseFloor);

                if (hasCargo) {
                    const cargoGroup = new THREE.Group();
                    const cL = THREE.MathUtils.clamp(state.oogCargoL || L * 0.84, 1.2, L - 0.22);
                    const cW = THREE.MathUtils.clamp(state.oogCargoW || W * 0.88, 0.9, W - 0.16);
                    const cH = THREE.MathUtils.clamp(state.oogCargoH || H * 1.15, 0.6, 4.8);
                    const skidH = Math.min(0.18, cH * 0.12);
                    const skid = new THREE.Mesh(new THREE.BoxGeometry(cL, skidH, cW), MATS.woodCrate.clone());
                    skid.position.y = floorTopY + skidH / 2;
                    cargoGroup.add(skid);

                    const bodyH = Math.max(0.3, cH - skidH);
                    const tireDia = bodyH;
                    const tireR = tireDia * 0.5;
                    const tireThick = Math.min(cW * 0.42, 0.78);
                    const numTires = Math.max(2, Math.min(5, Math.floor(cL / Math.max(0.75, tireDia * 0.72))));
                    const tireMat = MATS.rubberTire ? MATS.rubberTire.clone() : MATS.darkSteel.clone();

                    const rack = new THREE.Mesh(new THREE.BoxGeometry(cL * 0.92, bodyH * 0.52, cW * 0.76), MATS.woodCrate.clone());
                    rack.position.y = floorTopY + skidH + bodyH * 0.26;
                    rack.castShadow = true;
                    cargoGroup.add(rack);

                    for (let t = 0; t < numTires; t++) {
                        const tx = numTires === 1 ? 0 : (-cL * 0.34 + (t / (numTires - 1)) * (cL * 0.68));
                        [-1, 1].forEach(side => {
                            const tz = side * (cW * 0.28);
                            const tire = new THREE.Mesh(new THREE.CylinderGeometry(tireR, tireR, tireThick, 24), tireMat);
                            tire.rotation.x = Math.PI / 2;
                            tire.position.set(tx, floorTopY + skidH + tireR, tz);
                            tire.castShadow = true;
                            cargoGroup.add(tire);
                        });
                    }
                    topGroup.add(cargoGroup);
                }
            }

            targetGroup.add(topGroup);
        }

        function addIsoFamily(group, type, L, W, H) {
            if (type === 'opentop') {
                addOpenTopContainer3D(group, L, W, H);
                return;
            }
            if (type === 'flatrack') {
                addFlatRackContainer3D(group, L, W, H);
                return;
            }
            if (type === 'isotank') {
                addIsoTankContainer3D(group, L, W, H);
                return;
            }
            if (type === 'platform') {
                const deck = new THREE.Mesh(new THREE.BoxGeometry(L, Math.max(0.22, H * 0.55), W), MATS.darkSteel.clone());
                deck.position.y = -H / 2 + Math.max(0.11, H * 0.28);
                deck.castShadow = true;
                group.add(deck);
                [-0.55, 0.55].forEach(xf => [-1, 1].forEach(sz => {
                    const pocket = new THREE.Mesh(new THREE.BoxGeometry(L * 0.28, 0.1, 0.32), MATS.gunmetal);
                    pocket.position.set(xf * L * 0.5, -H / 2 + 0.18, sz * W * 0.22);
                    group.add(pocket);
                }));
                addCornerCastings(group, L, W, H);
                return;
            }
            const mat = type === 'iso40' ? MATS.boxMaroon : (type === 'iso40hc' ? MATS.boxGreen : MATS.reeferWhite);
            addCorrugatedShell(group, L, W, H, mat);
            if (type === 'reefer') {
                addReeferMachineryUnit(group, L, W, H);
            }
        }

        // 5. PROFESSIONAL 3D SCULPTED MODERN SUV / PICKUP VEHICLE ON WHEEL-GRID LIFTING CRADLE
        function addRealisticCar(group, L, W, H) {
            const paintMat = MATS.carRed.clone();
            const trimMat = MATS.carTrim ? MATS.carTrim.clone() : MATS.darkSteel.clone();
            const glassMat = MATS.glassDark.clone();
            const alloyMat = MATS.galvSteel.clone();
            const tireMat = MATS.rubberTire.clone();

            // 1. Under-Wheel Heavy Rigging Lifting Grid / Wheel Chock Cradle (at -H/2)
            const cradleH = 0.09;
            const cradleY = -H / 2 + cradleH / 2;
            [-1, 1].forEach(sz => {
                const sideBeam = new THREE.Mesh(new THREE.BoxGeometry(L * 0.86, cradleH, 0.11), MATS.yellowHazard);
                sideBeam.position.set(0, cradleY, sz * (W * 0.46));
                sideBeam.castShadow = true;
                group.add(sideBeam);
            });
            [-0.38, -0.24, 0.24, 0.38].forEach(xf => {
                const chockBar = new THREE.Mesh(new THREE.BoxGeometry(0.09, cradleH * 0.9, W * 0.96), MATS.darkSteel);
                chockBar.position.set(xf * L, cradleY, 0);
                group.add(chockBar);
            });

            // 2. 3D Sculpted Lower Body Tub, Flared Fenders & Hood
            const wheelR = H * 0.22;
            const wheelCenterY = -H / 2 + cradleH + wheelR * 0.88;
            const bodyLowerH = H * 0.34;
            const bodyLowerY = wheelCenterY + wheelR * 0.28;

            // Main central chassis & cabin floor tub
            const lowerTub = new THREE.Mesh(new THREE.BoxGeometry(L * 0.94, bodyLowerH, W * 0.86), paintMat);
            lowerTub.position.set(0, bodyLowerY, 0);
            lowerTub.castShadow = true;
            lowerTub.receiveShadow = true;
            group.add(lowerTub);

            // Sculpted Hood (+X) with Power Dome & Front Fascia slope
            const hood = new THREE.Mesh(new THREE.BoxGeometry(L * 0.32, H * 0.12, W * 0.82), paintMat);
            hood.position.set(L * 0.30, bodyLowerY + bodyLowerH * 0.46, 0);
            hood.rotation.z = -0.09;
            hood.castShadow = true;
            group.add(hood);

            // Flared 3D Wheel Arch Fender Bulges + Side Rocker Skirts
            [-1, 1].forEach(sz => {
                const sideSkirt = new THREE.Mesh(new THREE.BoxGeometry(L * 0.52, 0.10, 0.08), trimMat);
                sideSkirt.position.set(0, wheelCenterY - wheelR * 0.32, sz * (W * 0.44));
                group.add(sideSkirt);

                [-0.31, 0.31].forEach(xf => {
                    const arch = new THREE.Mesh(new THREE.TorusGeometry(wheelR * 1.12, 0.055, 10, 20, Math.PI), trimMat);
                    arch.position.set(xf * L, wheelCenterY + 0.02, sz * (W * 0.42));
                    group.add(arch);

                    // Dark inner wheel well liner
                    const well = new THREE.Mesh(new THREE.CylinderGeometry(wheelR * 1.06, wheelR * 1.06, 0.28, 20, 1, false, 0, Math.PI), trimMat);
                    well.rotation.x = Math.PI / 2;
                    well.rotation.y = Math.PI / 2;
                    well.position.set(xf * L, wheelCenterY, sz * (W * 0.35));
                    group.add(well);
                });
            });

            // 3. Tapered 3D Greenhouse Cabin (Roof, A/B/C Pillars, Windshield, Side Windows & Interior Seats)
            const cabBaseY = bodyLowerY + bodyLowerH * 0.48;
            const cabH = H * 0.36;
            const cabShape = new THREE.Shape();
            cabShape.moveTo(-L * 0.40, 0);
            cabShape.lineTo( L * 0.16, 0);
            cabShape.lineTo( L * 0.02, cabH);
            cabShape.lineTo(-L * 0.34, cabH);
            cabShape.closePath();

            const cabGeo = new THREE.ExtrudeGeometry(cabShape, {
                depth: W * 0.76,
                bevelEnabled: true,
                bevelThickness: 0.04,
                bevelSize: 0.04,
                bevelSegments: 3
            });
            cabGeo.translate(0, cabBaseY, -W * 0.38);
            // Taper cabin top inward along Z for true 3D tumblehome curvature
            const cPos = cabGeo.attributes.position;
            for (let i = 0; i < cPos.count; i++) {
                const vy = cPos.getY(i) - cabBaseY;
                const t = THREE.MathUtils.clamp(vy / Math.max(0.1, cabH), 0, 1);
                cPos.setZ(i, cPos.getZ(i) * (1 - 0.14 * t));
            }
            cabGeo.computeVertexNormals();
            const cabinMesh = new THREE.Mesh(cabGeo, paintMat);
            cabinMesh.castShadow = true;
            group.add(cabinMesh);

            // Tinted Windshield, Rear Window & Side Windows
            const windshield = new THREE.Mesh(new THREE.BoxGeometry(0.03, cabH * 0.88, W * 0.64), glassMat);
            windshield.position.set(L * 0.095, cabBaseY + cabH * 0.48, 0);
            windshield.rotation.z = 0.42;
            const rearGlass = new THREE.Mesh(new THREE.BoxGeometry(0.03, cabH * 0.82, W * 0.62), glassMat);
            rearGlass.position.set(-L * 0.375, cabBaseY + cabH * 0.48, 0);
            rearGlass.rotation.z = -0.22;
            group.add(windshield, rearGlass);

            [-1, 1].forEach(sz => {
                const sideWin = new THREE.Mesh(new THREE.BoxGeometry(L * 0.36, cabH * 0.64, 0.03), glassMat);
                sideWin.position.set(-L * 0.14, cabBaseY + cabH * 0.52, sz * (W * 0.365));
                sideWin.rotation.x = -sz * 0.12;
                group.add(sideWin);

                // Roof Rails & Side Mirrors
                const roofRail = new THREE.Mesh(new THREE.BoxGeometry(L * 0.32, 0.035, 0.04), alloyMat);
                roofRail.position.set(-L * 0.16, cabBaseY + cabH + 0.045, sz * (W * 0.26));
                const mirror = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.075, 0.16), paintMat);
                mirror.position.set(L * 0.08, cabBaseY + 0.08, sz * (W * 0.45));
                group.add(roofRail, mirror);
            });

            // 4. Front Grille, Skid Bumper, LED Headlamps & Rear Tail Light Bar
            const frontBumper = new THREE.Mesh(new THREE.BoxGeometry(0.14, H * 0.16, W * 0.88), trimMat);
            frontBumper.position.set(L * 0.46, bodyLowerY - bodyLowerH * 0.22, 0);
            const skidPlate = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.08, W * 0.52), alloyMat);
            skidPlate.position.set(L * 0.47, bodyLowerY - bodyLowerH * 0.36, 0);
            const grille = new THREE.Mesh(new THREE.BoxGeometry(0.06, H * 0.18, W * 0.54), trimMat);
            grille.position.set(L * 0.47, bodyLowerY + 0.04, 0);
            const rearBumper = new THREE.Mesh(new THREE.BoxGeometry(0.14, H * 0.16, W * 0.88), trimMat);
            rearBumper.position.set(-L * 0.46, bodyLowerY - bodyLowerH * 0.22, 0);
            const tailBar = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.07, W * 0.78), MATS.taillamp);
            tailBar.position.set(-L * 0.47, bodyLowerY + 0.12, 0);
            group.add(frontBumper, skidPlate, grille, rearBumper, tailBar);

            [-1, 1].forEach(sz => {
                const headLight = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.09, 0.22), MATS.headlamp);
                headLight.position.set(L * 0.465, bodyLowerY + 0.08, sz * (W * 0.32));
                group.add(headLight);
            });

            // 5. 4 Multi-Spoke Alloy Wheels, Tires, Brake Discs & Red Calipers
            const tireW = 0.25;
            const tireGeo = new THREE.CylinderGeometry(wheelR, wheelR, tireW, 28);
            tireGeo.rotateX(Math.PI / 2);
            const rimOuterGeo = new THREE.CylinderGeometry(wheelR * 0.68, wheelR * 0.68, tireW + 0.01, 24);
            rimOuterGeo.rotateX(Math.PI / 2);
            const discGeo = new THREE.CylinderGeometry(wheelR * 0.48, wheelR * 0.48, 0.04, 20);
            discGeo.rotateX(Math.PI / 2);

            [[0.31, -1], [0.31, 1], [-0.31, -1], [-0.31, 1]].forEach(([xf, sz]) => {
                const wGroup = new THREE.Group();
                wGroup.position.set(xf * L, wheelCenterY, sz * (W * 0.40));
                const tire = new THREE.Mesh(tireGeo, tireMat);
                tire.castShadow = true;
                const rim = new THREE.Mesh(rimOuterGeo, trimMat);
                const disc = new THREE.Mesh(discGeo, alloyMat);
                const hubCap = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, tireW + 0.03, 12), alloyMat);
                hubCap.rotation.x = Math.PI / 2;
                wGroup.add(tire, rim, disc, hubCap);

                // 6 Alloy Spokes
                for (let s = 0; s < 6; s++) {
                    const ang = (s / 6) * Math.PI * 2;
                    const spoke = new THREE.Mesh(new THREE.BoxGeometry(0.035, wheelR * 0.64, 0.025), alloyMat);
                    spoke.position.set(Math.cos(ang) * wheelR * 0.30, Math.sin(ang) * wheelR * 0.30, sz * (tireW * 0.48));
                    spoke.rotation.z = ang + Math.PI / 2;
                    wGroup.add(spoke);
                }
                group.add(wGroup);
            });
        }

        // 6. PROFESSIONAL 3D MARINE CABIN CRUISER / OFFSHORE CANO ON CONTOURED LIFTING CRADLE
        function addRealisticShip(group, L, W, H) {
            const hullMat = MATS.boatHull.clone();
            const bottomPaintMat = MATS.boxMaroon.clone();
            const deckMat = MATS.boatDeck ? MATS.boatDeck.clone() : MATS.timberWood.clone();
            const glassMat = MATS.glassDark.clone();
            const steelMat = MATS.galvSteel.clone();
            const darkMat = MATS.darkSteel.clone();

            // 1. Heavy Marine Lifting Cradle with Longitudinal Skid Beams & Contoured Hull Chocks
            const cradleBaseY = -H / 2;
            const skidH = H * 0.10;
            [-1, 1].forEach(sz => {
                const skidBeam = new THREE.Mesh(new THREE.BoxGeometry(L * 0.72, skidH, 0.16), MATS.orangeBeam.clone());
                skidBeam.position.set(-L * 0.04, cradleBaseY + skidH / 2, sz * (W * 0.42));
                skidBeam.castShadow = true;
                group.add(skidBeam);
            });
            [-0.28, 0.18].forEach(xf => {
                const cross = new THREE.Mesh(new THREE.BoxGeometry(0.24, skidH * 1.35, W * 0.92), MATS.orangeBeam.clone());
                cross.position.set(xf * L, cradleBaseY + skidH * 0.68, 0);
                // V-shaped padded hull chocks
                [-1, 1].forEach(sz => {
                    const chock = new THREE.Mesh(new THREE.BoxGeometry(0.22, H * 0.14, W * 0.34), darkMat);
                    chock.position.set(xf * L, cradleBaseY + skidH * 1.45, sz * (W * 0.22));
                    chock.rotation.x = -sz * 0.32;
                    group.add(chock);
                });
                group.add(cross);
            });

            // 2. True 3D Lofted Deep-V Marine Planing Hull (Stations from Stern -X to Flared Bow +X)
            const stations = 24;
            const hullBottomKeelY = cradleBaseY + H * 0.12;
            const sheerMidY = cradleBaseY + H * 0.52;
            const positions = [];
            const indices = [];

            // Cross-section profile points per station: 0:Keel, 1:PortChine, 2:PortSheer, 3:DeckCenter, 4:StbdSheer, 5:StbdChine
            const ringVerts = 7;
            for (let i = 0; i <= stations; i++) {
                const u = i / stations; // 0 = transom (-X), 1 = bow tip (+X)
                const x = THREE.MathUtils.lerp(-L * 0.44, L * 0.48, u);

                // Beam half-width envelope (wide aft planing hull, tapering smoothly to sharp bow stem)
                let beamFactor;
                if (u < 0.55) beamFactor = 0.92 + 0.08 * Math.sin((u / 0.55) * Math.PI * 0.5);
                else beamFactor = Math.cos(((u - 0.55) / 0.45) * Math.PI * 0.5);
                const halfSheerW = Math.max(0.015, (W * 0.48) * Math.pow(Math.max(0, beamFactor), 0.78));
                const halfChineW = halfSheerW * THREE.MathUtils.lerp(0.84, 0.45, Math.pow(u, 1.4));

                // Keel & Sheer elevation profile (bow flare rises toward +X, forefoot curves up at bow stem)
                const keelRise = u > 0.72 ? Math.pow((u - 0.72) / 0.28, 1.8) * (H * 0.34) : 0;
                const keelY = hullBottomKeelY + keelRise;
                const chineY = keelY + THREE.MathUtils.lerp(H * 0.13, H * 0.08, u) * (1 - Math.pow(u, 3) * 0.7);
                const sheerY = sheerMidY + Math.pow(u, 1.6) * (H * 0.12) - (1 - u) * (H * 0.04);

                const pts = [
                    [x, keelY, 0],
                    [x, chineY, -halfChineW],
                    [x, sheerY, -halfSheerW],
                    [x, sheerY + 0.03, 0],
                    [x, sheerY,  halfSheerW],
                    [x, chineY,  halfChineW],
                    [x, keelY, 0]
                ];
                pts.forEach(p => positions.push(p[0], p[1], p[2]));
            }

            for (let i = 0; i < stations; i++) {
                for (let j = 0; j < ringVerts - 1; j++) {
                    const a = i * ringVerts + j;
                    const b = (i + 1) * ringVerts + j;
                    const c = (i + 1) * ringVerts + (j + 1);
                    const d = i * ringVerts + (j + 1);
                    indices.push(a, b, d);
                    indices.push(b, c, d);
                }
            }
            // Close stern transom cap at i = 0
            indices.push(0, 2, 1, 0, 3, 2, 0, 4, 3, 0, 5, 4);

            const hullGeo = new THREE.BufferGeometry();
            hullGeo.setIndex(indices);
            hullGeo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
            hullGeo.computeVertexNormals();
            const hullMesh = new THREE.Mesh(hullGeo, hullMat);
            hullMesh.castShadow = true;
            hullMesh.receiveShadow = true;
            group.add(hullMesh);

            // Antifouling Lower Hull Waterline Band + Black Rubber Rub-Rail Fender
            const deckSole = new THREE.Mesh(new THREE.BoxGeometry(L * 0.74, 0.05, W * 0.78), deckMat);
            deckSole.position.set(-L * 0.04, sheerMidY - 0.02, 0);
            group.add(deckSole);

            // 3. Sleek Aerodynamic Cabin Superstructure, Wrap-Around Windshield & Radar Arch
            const cabBaseY = sheerMidY + 0.01;
            const cabH = H * 0.26;
            const cabin = new THREE.Mesh(new THREE.BoxGeometry(L * 0.34, cabH, W * 0.62), hullMat);
            cabin.position.set(-L * 0.04, cabBaseY + cabH * 0.45, 0);
            cabin.castShadow = true;
            group.add(cabin);

            // Raked Wrap-Around Tinted Marine Windshield & Side Windows
            const frontScreen = new THREE.Mesh(new THREE.BoxGeometry(L * 0.14, cabH * 0.78, W * 0.58), glassMat);
            frontScreen.position.set(L * 0.12, cabBaseY + cabH * 0.46, 0);
            frontScreen.rotation.z = 0.52;
            const sideGlass = new THREE.Mesh(new THREE.BoxGeometry(L * 0.28, cabH * 0.52, W * 0.64), glassMat);
            sideGlass.position.set(-L * 0.05, cabBaseY + cabH * 0.56, 0);
            group.add(frontScreen, sideGlass);

            // Swept-Back Marine Radar Arch + Radome + Navigation Lights
            const archY = cabBaseY + cabH;
            const radarArch = new THREE.Mesh(new THREE.BoxGeometry(0.18, H * 0.16, W * 0.56), hullMat);
            radarArch.position.set(-L * 0.14, archY + H * 0.07, 0);
            radarArch.rotation.z = -0.24;
            const radome = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.24, 0.12, 20), hullMat);
            radome.position.set(-L * 0.15, archY + H * 0.17, 0);
            const gpsMast = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.025, H * 0.18, 10), steelMat);
            gpsMast.position.set(-L * 0.15, archY + H * 0.26, 0);
            group.add(radarArch, radome, gpsMast);

            // 4. Stainless Bow Pulpit Rail, Side Stanchions & Life Buoys
            [-1, 1].forEach(sz => {
                const bowRail = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.014, L * 0.36, 10), steelMat);
                bowRail.rotation.z = Math.PI / 2 - 0.10;
                bowRail.rotation.y = -sz * 0.24;
                bowRail.position.set(L * 0.24, sheerMidY + 0.18, sz * (W * 0.28));
                const buoy = new THREE.Mesh(new THREE.TorusGeometry(0.14, 0.038, 10, 20), bottomPaintMat);
                buoy.position.set(-L * 0.14, cabBaseY + cabH * 0.45, sz * (W * 0.33));
                group.add(bowRail, buoy);
            });

            // 5. Twin Outboard Marine Engines on Stern Transom (-X)
            [-0.18, 0.18].forEach(zf => {
                const obGroup = new THREE.Group();
                obGroup.position.set(-L * 0.46, sheerMidY - H * 0.08, zf * W);
                const cowling = new THREE.Mesh(new THREE.BoxGeometry(0.36, H * 0.22, 0.24), darkMat);
                cowling.position.y = H * 0.12;
                const leg = new THREE.Mesh(new THREE.BoxGeometry(0.16, H * 0.28, 0.08), darkMat);
                leg.position.y = -H * 0.10;
                const propHub = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.05, 0.18, 12), steelMat);
                propHub.rotation.z = Math.PI / 2;
                propHub.position.set(-0.08, -H * 0.22, 0);
                obGroup.add(cowling, leg, propHub);
                group.add(obGroup);
            });
        }

        function buildCargoMesh(type, L, W, H) {
            const group = new THREE.Group();
            const CARGO_MESH_NAMES = {
                container: 'ISO_Container_20ft',
                container_20ft_glb: 'ISO_Container_20ft',
                iso40: 'ISO_Container_40ft',
                container_40ft_glb: 'ISO_Container_40ft',
                iso40hc: 'ISO_Container_40ft_HC',
                flatrack: 'Flat_Rack_Container',
                opentop: 'Open_Top_Container',
                isotank: 'Tank_Container_ISO_Tank',
                reefer: 'Reefer_Container',
                platform: 'Platform_Container',
                crate: 'Heavy_Lift_OOG_Cargo',
                offshore_skid: 'Heavy_Lift_OOG_Cargo',
                pipe: 'Heavy_Lift_OOG_Cargo',
                vessel: 'Pressure_Vessel',
                transformer: 'Transformer',
                wind_nacelle: 'Wind_Turbine_Nacelle',
                excavator: 'Excavator_Heavy_Machinery',
                boat: 'Tugboat_Vessel_Hull',
                car: 'SUV_Vehicle'
            };
            group.name = CARGO_MESH_NAMES[type] || `Cargo_${type}`;

            // 1. Check if model prototype exists in customCargoMeshes (or reuse authentic 22G1 standard geometry for dry ISO, Reefer & Open Top containers)
            const isStandardDryIso = (type === 'container' || type === 'container_20ft_glb' || type === 'iso40' || type === 'container_40ft_glb' || type === 'iso40hc');
            const isReefer = (type === 'reefer');
            const isOpenTop = (type === 'opentop');
            const isIsoModelFamily = (isStandardDryIso || isReefer || isOpenTop);
            const protoMesh = (customCargoMeshes && customCargoMeshes[type]) || (isIsoModelFamily && customCargoMeshes && customCargoMeshes['container_22g1']);

            if (protoMesh) {
                const clone = protoMesh.clone(true);
                clone.updateMatrixWorld(true);

                // If Open Top and tarp is toggled off (state.oogTarp === false), remove the top roof plate triangles from geometry
                if (isOpenTop && state.oogTarp === false) {
                    clone.traverse(child => {
                        if (child.isMesh && child.geometry && child.geometry.attributes && child.geometry.attributes.position) {
                            const geo = child.geometry;
                            const pos = geo.attributes.position;
                            const norm = geo.attributes.normal;
                            const uv = geo.attributes.uv;
                            const newPos = [];
                            const newNorm = norm ? [] : null;
                            const newUv = uv ? [] : null;
                            for (let i = 0; i < pos.count; i += 3) {
                                const y0 = pos.getY(i);
                                const y1 = pos.getY(i + 1);
                                const y2 = pos.getY(i + 2);
                                // Exclude top roof faces (unscaled Y in conts20ft.obj is > 2.37)
                                if (y0 > 2.37 && y1 > 2.37 && y2 > 2.37) {
                                    continue;
                                }
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
                        }
                    });
                }

                // Tint materials appropriately according to ISO container type
                // When using the dedicated Reefer 3D model, preserve its rich authentic PBR multi-materials!
                const isDedicatedReeferModel = (type === 'reefer' && (protoMesh === customCargoMeshes['reefer'] || protoMesh === customCargoMeshes['reefer_40hc']));
                if (isIsoModelFamily && !isDedicatedReeferModel) {
                    const bodyColor = (type === 'iso40' || type === 'container_40ft_glb') ? 0x881337 // ISO 40ft Burgundy / Deep Maroon
                                    : (type === 'iso40hc' ? 0x065f46 // 40ft High Cube Marine Forest Green
                                    : (type === 'reefer' ? 0xf8fafc // Reefer Clean Marine White (RAL 9003)
                                    : 0x1d4ed8)); // 20ft Standard & Open Top Marine Blue (RAL 5010)
                    const roughness = (type === 'reefer') ? 0.35 : 0.42;
                    const metalness = (type === 'reefer') ? 0.22 : 0.28;

                    clone.traverse(child => {
                        if (child.isMesh) {
                            child.castShadow = true;
                            child.receiveShadow = true;
                            if (Array.isArray(child.material)) {
                                child.material = [
                                    new THREE.MeshStandardMaterial({
                                        color: bodyColor,
                                        roughness: roughness,
                                        metalness: metalness,
                                        name: `ContainerBody_${type}`
                                    }),
                                    new THREE.MeshStandardMaterial({
                                        color: 0xe2e8f0,
                                        roughness: 0.22,
                                        metalness: 0.85,
                                        name: 'ContainerHardware_GalvanizedSteel'
                                    })
                                ];
                            } else if (child.material) {
                                child.material = new THREE.MeshStandardMaterial({
                                    color: bodyColor,
                                    roughness: roughness,
                                    metalness: metalness
                                });
                            }
                        }
                    });
                } else if (isDedicatedReeferModel) {
                    clone.traverse(child => {
                        if (child.isMesh) {
                            child.castShadow = true;
                            child.receiveShadow = true;
                        }
                    });
                }

                // Measure raw bounds of prototype
                const bbox = new THREE.Box3().setFromObject(clone);
                const sz = new THREE.Vector3();
                bbox.getSize(sz);
                const center = new THREE.Vector3();
                bbox.getCenter(center);

                // 1. Center strictly at (0, 0, 0)
                clone.position.sub(center);

                // 2. Proportionally scale to exactly match simulation dimensions (L, H, W)
                if (sz.x > 0.001 && sz.y > 0.001 && sz.z > 0.001 && L > 0 && H > 0 && W > 0) {
                    const sx = L / sz.x;
                    const sy = H / sz.y;
                    const szRate = W / sz.z;
                    clone.scale.multiply(new THREE.Vector3(sx, sy, szRate));
                }

                clone.updateMatrixWorld(true);
                // Ensure perfect geometric centering at (0, 0, 0) after scaling
                const postBox = new THREE.Box3().setFromObject(clone);
                const postCenter = new THREE.Vector3();
                postBox.getCenter(postCenter);
                clone.position.sub(postCenter);

                // Add clone to root group
                group.add(clone);

                // Add Type-Specific Architectural Details directly to root group (ensures perfect alignment in world coordinate space):
                // 1. Reefer: The authentic Carrier PrimeLINE 3D model ALREADY seamlessly integrates the machinery bay,
                //    condenser fan, V-frame, controller, compressor, and cable tray directly into the front bulkhead geometry.
                //    NEVER add detached external procedural blocks.
                const isDedicatedThermoKingModel = protoMesh === customCargoMeshes['reefer'] || protoMesh === customCargoMeshes['reefer_40hc'];
                if (isReefer && !isDedicatedThermoKingModel && !customCargoMeshes['reefer']) {
                    addReeferMachineryUnit(group, L, W, H);
                }

                // 2. Open Top: Add Arched Roof Bows, Swinging Door Header & Tarpaulin Cover directly to group
                if (isOpenTop) {
                    addOpenTopTopAssembly(group, L, W, H);
                }

                // 3. For High Cube dry container (45G1), add ISO 6346 standard yellow-black corner caution stripes directly to group
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

                return group;
            }

            if (type === 'iso40' || type === 'iso40hc' || type === 'reefer' || type === 'opentop' || type === 'flatrack' || type === 'isotank' || type === 'platform') {
                addIsoFamily(group, type, L, W, H);
            } else if (type === 'container') {
                // ISO 668 22G1 20ft — shared corrugated dry-van builder
                addCorrugatedShell(group, L, W, H, MATS.containerBlue.clone());
            } else if (type === 'crate') {
                // 2. HEAVY ENGINEERING SKID CRATE (Steel I-Beam Skid Base, Angle-Iron Frame, X-Bracing & Bolted Gussets)
                const skidH = H * 0.14;
                const coreBox = new THREE.Mesh(new THREE.BoxGeometry(L - 0.08, H - skidH, W - 0.08), MATS.woodCrate.clone());
                coreBox.position.y = skidH / 2;
                coreBox.castShadow = true; coreBox.receiveShadow = true;
                group.add(coreBox);

                // Heavy Steel Skid Runners at Base
                const runnerGeo = new THREE.BoxGeometry(L + 0.06, skidH, 0.18);
                [-W * 0.42, 0, W * 0.42].forEach(rz => {
                    const runner = new THREE.Mesh(runnerGeo, MATS.darkSteel.clone());
                    runner.position.set(0, -H / 2 + skidH / 2, rz);
                    group.add(runner);
                });

                // Vertical & Horizontal Steel Reinforcement Battens
                const vBattenGeo = new THREE.BoxGeometry(0.12, H - skidH + 0.04, W + 0.02);
                [-0.46, -0.16, 0.16, 0.46].forEach(xf => {
                    const vb = new THREE.Mesh(vBattenGeo, MATS.darkSteel.clone());
                    vb.position.set(xf * L, skidH / 2, 0);
                    group.add(vb);
                });

                const hBandGeo = new THREE.BoxGeometry(L + 0.02, 0.1, W + 0.02);
                [-H / 2 + skidH + 0.06, H / 2 - 0.05].forEach(hy => {
                    const hb = new THREE.Mesh(hBandGeo, MATS.darkSteel.clone());
                    hb.position.y = hy;
                    group.add(hb);
                });

            } else if (type === 'vessel') {
                // 3. ASME INDUSTRIAL PRESSURE VESSEL (Cylindrical Shell, Stiffener Rings, Ellipsoidal Heads, Contoured Saddles & Flanged Nozzles)
                const radius = Math.min(W, H) * 0.42;
                const cylLen = Math.max(1.2, L - radius * 1.5);
                const shellCenterY = H * 0.06;

                const body = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, cylLen, 40), MATS.vesselSteel.clone());
                body.rotation.z = Math.PI / 2;
                body.position.y = shellCenterY;
                body.castShadow = true;
                group.add(body);

                // Circumferential Stiffening / Weld Rings
                const ringGeo = new THREE.TorusGeometry(radius + 0.015, 0.028, 12, 40);
                [-0.42, -0.15, 0.15, 0.42].forEach(xf => {
                    const ring = new THREE.Mesh(ringGeo, MATS.gunmetal.clone());
                    ring.rotation.y = Math.PI / 2;
                    ring.position.set(xf * cylLen, shellCenterY, 0);
                    group.add(ring);
                });

                // 2:1 Ellipsoidal Dished Heads
                const headGeo = new THREE.SphereGeometry(radius, 36, 20);
                const headL = new THREE.Mesh(headGeo, MATS.vesselSteel.clone());
                headL.scale.set(0.6, 1, 1);
                headL.position.set(-cylLen / 2, shellCenterY, 0);
                const headR = headL.clone();
                headR.position.set(cylLen / 2, shellCenterY, 0);
                group.add(headL, headR);

                // 3 Top Flanged Nozzles + Bolted Blind Flanges
                [-0.28, 0, 0.28].forEach((xf, idx) => {
                    const nozR = idx === 1 ? 0.22 : 0.14;
                    const neck = new THREE.Mesh(new THREE.CylinderGeometry(nozR, nozR, 0.38, 20), MATS.vesselSteel.clone());
                    neck.position.set(xf * cylLen, shellCenterY + radius + 0.12, 0);
                    const flange = new THREE.Mesh(new THREE.CylinderGeometry(nozR * 1.45, nozR * 1.45, 0.08, 24), MATS.galvSteel.clone());
                    flange.position.set(xf * cylLen, shellCenterY + radius + 0.32, 0);
                    group.add(neck, flange);
                });

                // 2 Contoured Steel Saddle Supports with Baseplates & Rib Gussets
                const saddleH = shellCenterY + H / 2;
                [-0.32, 0.32].forEach(xf => {
                    const sx = xf * L;
                    const saddleWeb = new THREE.Mesh(new THREE.BoxGeometry(0.26, saddleH * 0.65, W * 0.88), MATS.orangeBeam.clone());
                    saddleWeb.position.set(sx, -H / 2 + saddleH * 0.325, 0);
                    const basePlate = new THREE.Mesh(new THREE.BoxGeometry(0.48, 0.08, W * 0.94), MATS.darkSteel.clone());
                    basePlate.position.set(sx, -H / 2 + 0.04, 0);
                    group.add(saddleWeb, basePlate);
                });

            } else if (type === 'transformer') {
                // 4. HIGH-VOLTAGE SUBSTATION POWER TRANSFORMER (Radiator Fin Banks, Ribbed Porcelain HV Bushings, Conservator & Piping)
                const skidH = H * 0.12;
                const baseSkid = new THREE.Mesh(new THREE.BoxGeometry(L, skidH, W), MATS.yellowHazard.clone());
                baseSkid.position.y = -H / 2 + skidH / 2;
                group.add(baseSkid);

                // Heavy Main Tank + External Vertical Stiffener Ribs
                const tankL = L * 0.62, tankH = H * 0.62, tankW = W * 0.66;
                const tankX = L * 0.08, tankY = -H / 2 + skidH + tankH / 2;
                const mainTank = new THREE.Mesh(new THREE.BoxGeometry(tankL, tankH, tankW), MATS.trafoGrey.clone());
                mainTank.position.set(tankX, tankY, 0);
                mainTank.castShadow = true;
                group.add(mainTank);

                // 4 Multi-Fin Cooling Radiator Banks on Front & Back Sides
                [-1, 1].forEach(sideZ => {
                    [-0.22, 0.22].forEach(bankOffset => {
                        const bx = tankX + bankOffset * tankL;
                        const bz = sideZ * (tankW / 2 + 0.18);
                        for (let f = -3; f <= 3; f++) {
                            const fin = new THREE.Mesh(new THREE.BoxGeometry(0.03, tankH * 0.82, 0.32), MATS.vesselSteel.clone());
                            fin.position.set(bx + f * 0.065, tankY, bz);
                            group.add(fin);
                        }
                    });
                });

                // 3 High-Voltage Ribbed Porcelain Bushings on Turrets
                [-0.2, 0.08, 0.36].forEach(bx => {
                    const px = L * bx;
                    const py = tankY + tankH / 2;
                    const turret = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.2, 0.22, 16), MATS.trafoGrey.clone());
                    turret.position.set(px, py + 0.11, -0.15);
                    group.add(turret);

                    for (let s = 0; s < 8; s++) {
                        const shed = new THREE.Mesh(new THREE.CylinderGeometry(0.11 - s * 0.004, 0.14 - s * 0.004, 0.07, 16), MATS.porcelain.clone());
                        shed.position.set(px, py + 0.26 + s * 0.085, -0.15);
                        group.add(shed);
                    }
                    const term = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.25, 12), MATS.galvSteel.clone());
                    term.position.set(px, py + 1.0, -0.15);
                    group.add(term);
                });

                // Cylindrical Oil Conservator Tank + Support Brackets on Offset Side (causing authentic CoG offset)
                const conserv = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.28, L * 0.48, 24), MATS.vesselSteel.clone());
                conserv.rotation.z = Math.PI / 2;
                conserv.position.set(L * 0.14, H * 0.36, W * 0.26);
                group.add(conserv);

                // Control Marshalling Cabinet on Left End
                const cabinet = new THREE.Mesh(new THREE.BoxGeometry(L * 0.22, tankH * 0.82, tankW * 0.78), MATS.vesselSteel.clone());
                cabinet.position.set(-L * 0.34, tankY - tankH * 0.08, 0);
                group.add(cabinet);

            } else if (type === 'car') {
                addRealisticCar(group, L, W, H);
            } else if (type === 'boat') {
                addRealisticShip(group, L, W, H);
            } else if (type === 'wind_nacelle') {
                const skid = new THREE.Mesh(new THREE.BoxGeometry(L * 0.85, H * 0.12, W * 0.85), MATS.yellowHazard.clone());
                skid.position.y = -H / 2 + H * 0.06;
                const housing = new THREE.Mesh(new THREE.BoxGeometry(L * 0.68, H * 0.72, W * 0.88), MATS.boatHull.clone());
                housing.position.set(-L * 0.08, 0, 0);
                housing.castShadow = true;
                const cooler = new THREE.Mesh(new THREE.BoxGeometry(L * 0.28, H * 0.18, W * 0.72), MATS.trafoGrey.clone());
                cooler.position.set(-L * 0.22, H * 0.42, 0);
                const rotorHub = new THREE.Mesh(new THREE.CylinderGeometry(H * 0.22, H * 0.36, L * 0.28, 32), MATS.boatHull.clone());
                rotorHub.rotation.z = -Math.PI / 2;
                rotorHub.position.set(L * 0.36, 0, 0);
                const flangeRing = new THREE.Mesh(new THREE.TorusGeometry(H * 0.32, 0.05, 16, 32), MATS.darkSteel.clone());
                flangeRing.rotation.y = Math.PI / 2;
                flangeRing.position.set(L * 0.24, 0, 0);
                group.add(skid, housing, cooler, rotorHub, flangeRing);

            } else if (type === 'excavator') {
                // 8. HEAVY TRACKED HYDRAULIC EXCAVATOR (3D Print CAD Grade)
                [-W * 0.38, W * 0.38].forEach(tz => {
                    const track = new THREE.Mesh(new THREE.BoxGeometry(L * 0.68, H * 0.24, W * 0.22), MATS.rubberTire.clone());
                    track.position.set(-L * 0.06, -H / 2 + H * 0.12, tz);
                    group.add(track);
                });
                const deck = new THREE.Mesh(new THREE.BoxGeometry(L * 0.54, H * 0.38, W * 0.84), MATS.yellowHazard.clone());
                deck.position.set(-L * 0.12, -H * 0.08, 0);
                const cab = new THREE.Mesh(new THREE.BoxGeometry(L * 0.24, H * 0.42, W * 0.34), MATS.glassDark.clone());
                cab.position.set(-L * 0.02, H * 0.22, W * 0.22);
                const boom1 = new THREE.Mesh(new THREE.BoxGeometry(L * 0.52, 0.26, 0.24), MATS.yellowHazard.clone());
                boom1.position.set(L * 0.16, H * 0.18, -W * 0.05);
                boom1.rotation.z = -0.32;
                const bucket = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.32, 0.52, 12, 1, false, 0, Math.PI * 1.2), MATS.darkSteel.clone());
                bucket.rotation.x = Math.PI / 2;
                bucket.position.set(L * 0.38, -H * 0.18, -W * 0.05);
                group.add(deck, cab, boom1, bucket);

            } else if (type === 'offshore_skid') {
                // 9. OFFSHORE OIL & GAS PROCESS SKID MODULE
                const baseFrame = new THREE.Mesh(new THREE.BoxGeometry(L, H * 0.14, W), MATS.yellowHazard.clone());
                baseFrame.position.y = -H / 2 + H * 0.07;
                group.add(baseFrame);
                // Corner Lifting Posts
                [[-L/2+0.12, -W/2+0.12], [L/2-0.12, -W/2+0.12], [-L/2+0.12, W/2-0.12], [L/2-0.12, W/2-0.12]].forEach(([px, pz]) => {
                    const post = new THREE.Mesh(new THREE.BoxGeometry(0.16, H, 0.16), MATS.yellowHazard.clone());
                    post.position.set(px, 0, pz);
                    group.add(post);
                });
                const sepDrum = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.45, L * 0.65, 28), MATS.vesselSteel.clone());
                sepDrum.rotation.z = Math.PI / 2;
                sepDrum.position.set(L * 0.08, H * 0.05, -W * 0.18);
                const pumpMotor = new THREE.Mesh(new THREE.BoxGeometry(L * 0.38, H * 0.42, W * 0.35), MATS.containerBlue.clone());
                pumpMotor.position.set(-L * 0.18, -H * 0.15, W * 0.22);
                group.add(sepDrum, pumpMotor);

            } else if (customCargoMeshes[type]) {
                // Custom User-Uploaded 3D Asset (GLB/GLTF/OBJ/STL Normalized Metric Scale)
                const proto = customCargoMeshes[type].clone();
                const bbox = new THREE.Box3().setFromObject(proto);
                const size = new THREE.Vector3();
                bbox.getSize(size);

                // If already normalized by AssetPipeline, maintain strict 1:1 metric scale without non-uniform stretching
                if (proto.userData && proto.userData.isNormalizedAsset) {
                    // Perfectly preserved 1:1 geometry
                } else if (Math.abs(size.x - L) > 0.05 || Math.abs(size.y - H) > 0.05 || Math.abs(size.z - W) > 0.05) {
                    // For legacy non-normalized assets: apply uniform scale if possible
                    const uniformScale = (L / Math.max(0.1, size.x) + H / Math.max(0.1, size.y) + W / Math.max(0.1, size.z)) / 3;
                    proto.scale.multiplyScalar(uniformScale);
                }

                const newBox = new THREE.Box3().setFromObject(proto);
                const center = new THREE.Vector3();
                newBox.getCenter(center);
                proto.position.sub(center);
                group.add(proto);
            }

            // Apply X-Ray Transparency if active
            if (state.xrayCargo) {
                group.traverse(m => {
                    if (m.isMesh && m.material) {
                        m.material.transparent = true;
                        m.material.opacity = 0.32;
                    }
                });
            }

            // Add crisp CAD / 3D-Print feature outlines
            applyCADFeatureEdges(group, false);

            return group;
        }

        const I18N = {
            vi: {
                hudHook: 'Tải Móc', hudHookUtil: '% SWL Móc', hudGross: 'Tổng Tải', hudRig: 'Bộ Treo',
                hudBeta: 'Góc β', hudTf: 'Hệ số TF', hudLeg: '% SWL Cáp', hudMbl: 'MBL Min',
                hudRadius: 'Bán kính R', hudCog: 'Lệch CoG', hudTilt: 'Nghiêng', hudClear: 'Cách Sàn', hudSpan: 'Nhịp dầm',
                gearAuto: 'Theo thông số chung', gearCut: 'Cắt cáp', gearRepair: 'Nối lại', gearClear: 'Bỏ chọn',
                memLen: 'Chiều dài làm việc', pickA: 'Điểm bắt cáp A (từ tâm)', pickB: 'Điểm bắt cáp B (từ tâm)',
                memSwl: 'SWL thanh', memMass: 'Tự trọng thanh', beamSwl: 'SWL cả bộ dầm', beamSf: 'Hệ số an toàn SF',
                autoVal: 'Tự động', mixedVal: 'Khác nhau',
                memTop: 'Dầm ngáng trên', memLowPlus: 'Dầm ngáng dưới +X', memLowMinus: 'Dầm ngáng dưới −X',
                memTubular: 'Ngáng ống Modulift', memMain: 'Dầm nâng chữ H', memRailPos: 'Thanh dọc +Z', memRailNeg: 'Thanh dọc −Z',
                memEndPos: 'Thanh đầu +X', memEndNeg: 'Thanh đầu −X', memBarPos: 'Dầm vòng +X', memBarNeg: 'Dầm vòng −X', memTruss: 'Dầm giàn trên',
                gearBeam: 'Bộ dầm ngáng', gearHook: 'Móc cẩu', gearAsm: 'SWL bộ dầm'
            },
            en: {
                hudHook: 'Hook Load', hudHookUtil: '% Hook SWL', hudGross: 'Gross Load', hudRig: 'Rigging',
                hudBeta: 'Angle β', hudTf: 'TF Factor', hudLeg: '% Leg SWL', hudMbl: 'MBL Min',
                hudRadius: 'Radius R', hudCog: 'CoG Off', hudTilt: 'Tilt', hudClear: 'Clearance', hudSpan: 'Span',
                gearAuto: 'Use global', gearCut: 'Cut sling', gearRepair: 'Reeve', gearClear: 'Clear',
                memLen: 'Working length', pickA: 'Pick point A from centre', pickB: 'Pick point B from centre',
                memSwl: 'Member SWL', memMass: 'Member self-weight', beamSwl: 'Assembly SWL', beamSf: 'Factor of safety',
                autoVal: 'Automatic', mixedVal: 'Mixed',
                memTop: 'Upper spreader beam', memLowPlus: 'Lower spreader +X', memLowMinus: 'Lower spreader −X',
                memTubular: 'Modulift tubular strut', memMain: 'H-section lifting beam', memRailPos: 'Longitudinal +Z', memRailNeg: 'Longitudinal −Z',
                memEndPos: 'End beam +X', memEndNeg: 'End beam −X', memBarPos: 'Basket beam +X', memBarNeg: 'Basket beam −X', memTruss: 'Upper truss beam',
                gearBeam: 'Spreader assembly', gearHook: 'Hook', gearAsm: 'Assembly SWL'
            }
        };
        function t(key) {
            const pack = I18N[state.lang] || I18N.en;
            return pack[key] || key;
        }
        function bi(key) {
            return t(key);
        }
        function L(en, vi) {
            return state.lang === 'en' ? en : vi;
        }

        function spanBase() {
            const xs = state.lugs.map(p => Math.abs(p.x));
            const zs = state.lugs.map(p => Math.abs(p.z));
            let spanX = Math.max(1.2, Math.max(...xs) * 2);
            let spanZ = Math.max(0.8, Math.max(...zs) * 2);
            const beam = state.gear && state.gear.beam;
            if (beam && beam.lengthM != null) spanX = Math.max(0.6, beam.lengthM);
            if (beam && beam.widthM != null) spanZ = Math.max(0.4, beam.widthM);
            return { spanX, spanZ };
        }

        function memberCatalog() {
            const type = state.beamType;
            if (type === 'container_spreader') return [
                { id: 'spreader_main', axis: 'x', nameKey: 'memMain' },
                { id: 'endPlus', axis: 'z', nameKey: 'memEndPos' },
                { id: 'endMinus', axis: 'z', nameKey: 'memEndNeg' }
            ];
            if (type === 'spreader') return [{ id: 'main', axis: 'x', nameKey: 'memTubular' }];
            if (type === 'lifting_beam') return [{ id: 'main', axis: 'x', nameKey: 'memMain' }];
            if (type === 'cascaded') return [
                { id: 'top', axis: 'x', nameKey: 'memTop' },
                { id: 'lowPlus', axis: 'z', nameKey: 'memLowPlus' },
                { id: 'lowMinus', axis: 'z', nameKey: 'memLowMinus' }
            ];
            if (type === 'modular_truss') return [
                { id: 'truss', axis: 'x', nameKey: 'memTruss' },
                { id: 'lowPlus', axis: 'z', nameKey: 'memLowPlus' },
                { id: 'lowMinus', axis: 'z', nameKey: 'memLowMinus' }
            ];
            if (type === 'frame') return [
                { id: 'railPos', axis: 'x', nameKey: 'memRailPos' },
                { id: 'railNeg', axis: 'x', nameKey: 'memRailNeg' },
                { id: 'endPos', axis: 'z', nameKey: 'memEndPos' },
                { id: 'endNeg', axis: 'z', nameKey: 'memEndNeg' }
            ];
            if (type === 'basket') return [
                { id: 'barPos', axis: 'z', nameKey: 'memBarPos' },
                { id: 'barNeg', axis: 'z', nameKey: 'memBarNeg' }
            ];
            if (type === 'inline4') return [
                { id: 'i4top', axis: 'x', nameKey: 'memTop', scale: 0.62 },
                { id: 'i4lowA', axis: 'x', nameKey: 'memLowPlus', scale: 0.28 },
                { id: 'i4lowB', axis: 'x', nameKey: 'memLowMinus', scale: 0.28 }
            ];
            if (type === 'inline8') return [
                { id: 'n8top', axis: 'x', nameKey: 'memTop', scale: 0.50 },
                { id: 'n8midP', axis: 'x', nameKey: 'memLowPlus', scale: 0.26 },
                { id: 'n8midM', axis: 'x', nameKey: 'memLowMinus', scale: 0.26 },
                { id: 'n8a', axis: 'x', nameKey: 'memLowPlus', scale: 0.14 },
                { id: 'n8b', axis: 'x', nameKey: 'memLowPlus', scale: 0.14 },
                { id: 'n8c', axis: 'x', nameKey: 'memLowMinus', scale: 0.14 },
                { id: 'n8d', axis: 'x', nameKey: 'memLowMinus', scale: 0.14 }
            ];
            if (type === 'spatial8') return [
                { id: 's8top', axis: 'x', nameKey: 'memTop', scale: 0.72 },
                { id: 's8midP', axis: 'z', nameKey: 'memLowPlus', scale: 0.70 },
                { id: 's8midM', axis: 'z', nameKey: 'memLowMinus', scale: 0.70 },
                { id: 's8a', axis: 'x', nameKey: 'memLowPlus', scale: 0.16 },
                { id: 's8b', axis: 'x', nameKey: 'memLowMinus', scale: 0.16 },
                { id: 's8c', axis: 'x', nameKey: 'memLowPlus', scale: 0.16 },
                { id: 's8d', axis: 'x', nameKey: 'memLowMinus', scale: 0.16 }
            ];
            return [];
        }

        function memberStore(id) {
            if (!state.gear.members) state.gear.members = {};
            if (!state.gear.members[id]) state.gear.members[id] = { lengthM: null, aM: null, bM: null, swlT: null, massT: null };
            return state.gear.members[id];
        }

        function memberSpec(id) {
            const cat = memberCatalog().find(m => m.id === id);
            if (!cat) return null;
            const base = spanBase();
            const rec = memberStore(id);
            const full = cat.axis === 'z' ? base.spanZ : base.spanX;
            const splayBar = cat.axis === 'z' && (state.beamType === 'cascaded' || state.beamType === 'modular_truss');
            const axisLen = cat.axis === 'z' ? Math.max(0.8, state.W) : Math.max(1.2, state.L);
            const designed = cat.scale != null ? Math.max(0.4, axisLen * cat.scale) : (splayBar ? Math.max(0.8, full * 0.58) : full);
            const length = Math.max(0.6, rec.lengthM != null ? rec.lengthM : designed);
            const lim = Math.max(0.08, length / 2 - 0.04);
            const a = THREE.MathUtils.clamp(rec.aM != null ? rec.aM : length / 2, -lim, lim);
            const b = THREE.MathUtils.clamp(rec.bM != null ? rec.bM : -length / 2, -lim, lim);
            return { id, axis: cat.axis, nameKey: cat.nameKey, length, a, b, rec };
        }

        function getLPBoundingSpan() {
            const base = spanBase();
            if (state.beamType === 'none') return base;
            if (state.beamType === 'inline4' || state.beamType === 'inline8' || state.beamType === 'spatial8') return base;
            const gap = (spec) => spec ? Math.max(0.4, Math.abs(spec.a - spec.b)) : 0;
            if (state.beamType === 'spreader' || state.beamType === 'lifting_beam') return { spanX: gap(memberSpec('main')), spanZ: base.spanZ };
            if (state.beamType === 'cascaded' || state.beamType === 'modular_truss') {
                const top = memberSpec(state.beamType === 'modular_truss' ? 'truss' : 'top');
                const z = Math.max(gap(memberSpec('lowPlus')), gap(memberSpec('lowMinus')));
                return { spanX: gap(top), spanZ: z };
            }
            if (state.beamType === 'container_spreader') return base;
            if (state.beamType === 'frame') {
                return {
                    spanX: Math.max(gap(memberSpec('railPos')), gap(memberSpec('railNeg'))),
                    spanZ: Math.max(gap(memberSpec('endPos')), gap(memberSpec('endNeg')))
                };
            }
            if (state.beamType === 'basket') {
                return { spanX: base.spanX, spanZ: Math.max(gap(memberSpec('barPos')), gap(memberSpec('barNeg'))) };
            }
            return base;
        }

        function beamOuterDiameter() {
            const d = state.gear && state.gear.beam ? state.gear.beam.depthM : 0.22;
            return THREE.MathUtils.clamp(d || 0.22, 0.08, 0.4);
        }

        function memberDiameter(id) {
            const rec = id && state.gear ? memberStore(id) : null;
            if (rec && rec.odMm != null) return THREE.MathUtils.clamp(rec.odMm, 80, 400) / 1000;
            return beamOuterDiameter();
        }

        // Physical structural mass estimate (kg) for an individual beam member when user has not overridden massT
        function estimateMemberStructuralMassKg(id) {
            const rec = memberStore(id);
            if (rec && rec.massT != null && rec.massT > 0) return rec.massT * 1000;
            const spec = memberSpec(id);
            const len = spec ? spec.length : 3.5;
            const type = state.beamType;
            if (type === 'spreader') {
                // Modulift tubular compression strut: hollow CHS steel pipe + 2 drop units + flanges
                const od = memberDiameter(id);
                // 52‰ wall ratio models the specified hollow Modulift tube
                // including collars without counting it as a solid bar.
                const wall = Math.max(0.008, od * 0.052);
                const area = Math.PI * (od * od - Math.pow(od - 2 * wall, 2)) * 0.25;
                return Math.max(45, area * len * 7850 + 82);
            }
            if (type === 'lifting_beam') {
                // Heavy wide-flange H-section bending beam + stiffeners + pad-eyes
                return Math.max(120, (98 + 20 * len) * len + 65);
            }
            if (type === 'container_spreader') {
                if (id === 'spreader_main') return Math.max(3200, 2600 + len * 380);
                return Math.max(650, 420 + len * 180);
            }
            if (type === 'modular_truss' && id === 'truss') {
                return Math.max(160, 88 * len + 110);
            }
            if (type === 'frame') {
                return Math.max(85, 62 * len + 35);
            }
            if (type === 'basket') {
                return Math.max(70, 54 * len + 28);
            }
            // Cascaded / multi-tier tubular members
            const od = memberDiameter(id);
            const wall = Math.max(0.007, od * 0.058);
            const area = Math.PI * (od * od - Math.pow(od - 2 * wall, 2)) * 0.25;
            return Math.max(40, area * len * 7850 + 48);
        }

        // Computes physically grounded masses (in metric tonnes) for every component in the rigging load path
        function computeRiggingMassBreakdown() {
            const slingMassKg = (item, lenM) => {
                if (item && item.massKg != null && item.massKg > 0) return item.massKg;
                let look = typeof effectiveSlingType === 'function'
                    ? effectiveSlingType(item)
                    : (state.slingType || (item && item.slingType) || 'wire');

                const parts = Math.max(1, Math.min(4, (item && item.parts) || 1));
                const d = Math.max(8, (item && item.diaMm) || (look === 'web' || look === 'round_sling' ? 60 : 20));
                const L = Math.max(0.4, lenM || 2.5);
                let baseKg = 0;
                if (look === 'chain') baseKg = 0.022 * d * d * L + 1.8;
                else if (look === 'web') baseKg = 0.018 * d * L + 0.9;
                else if (look === 'round_sling') baseKg = 0.016 * d * L + 1.1;
                else if (look === 'grommet') baseKg = 0.0072 * d * d * L + 2.8;
                else if (look === 'hmpe') baseKg = 0.0008 * d * d * L + 0.8;
                else baseKg = 0.0041 * d * d * L + 2.2; // 6x36 IWRC steel wire rope + thimbles/ferrules
                return baseKg * parts;
            };

            const shackleMassKg = (shRec, swlFallback) => {
                if (shRec && shRec.massKg != null && shRec.massKg > 0) return shRec.massKg;
                const swl = Math.max(2, (shRec && shRec.swlT) || swlFallback || state.wllPerLeg || 12);
                return 0.45 + 0.24 * Math.pow(swl, 1.18); // Crosby G-2130 forged alloy shackle curve
            };

            // 1. Beam / Spreader Assembly Self-Weight
            let beamMassKg = 0;
            if (state.beamType !== 'none') {
                if (state.gear && state.gear.beam && state.gear.beam.massT != null && state.gear.beam.massT > 0) {
                    beamMassKg = state.gear.beam.massT * 1000;
                } else {
                    const cat = memberCatalog();
                    if (cat.length) {
                        beamMassKg = cat.reduce((sum, m) => sum + estimateMemberStructuralMassKg(m.id), 0);
                    } else {
                        beamMassKg = 450;
                    }
                }
            }

            // 2. Slings (lower legs + upper slings + cascade hangers)
            let slingsKg = 0;
            const cables = phy.cables || [];
            if (cables.length) {
                cables.forEach(c => {
                    // Broken cables still weigh: upper stub hangs on A, lower stub hangs on B
                    if (c.role === 'leg') {
                        const rec = state.gear && state.gear.legs ? state.gear.legs[c.index] : null;
                        slingsKg += slingMassKg(rec, c.L0 || state.slingLength);
                    } else if (c.role === 'upper') {
                        const rec = state.gear && state.gear.uppers ? state.gear.uppers[c.index] : null;
                        slingsKg += slingMassKg(rec, c.L0 || state.slingLength);
                    } else if (c.role === 'hanger' || c.role === 'extra') {
                        const rec = c.role === 'extra' && state.gear && state.gear.extraCables
                            ? state.gear.extraCables[c.index] : null;
                        slingsKg += slingMassKg(rec, c.L0 || 1.2);
                    }
                });
            } else {
                const nLegs = state.lugs ? state.lugs.length : 4;
                for (let i = 0; i < nLegs; i++) {
                    const rec = state.gear && state.gear.legs ? state.gear.legs[i] : null;
                    slingsKg += slingMassKg(rec, state.slingLength);
                }
                if (state.beamType !== 'none') {
                    const nUp = (state.beamType === 'frame' || state.beamType === 'container_spreader' || state.beamType === 'basket') ? 4 : 2;
                    for (let i = 0; i < nUp; i++) {
                        const rec = state.gear && state.gear.uppers ? state.gear.uppers[i] : null;
                        slingsKg += slingMassKg(rec, state.slingLength);
                    }
                }
            }

            // 3. Shackles (Cargo Lug Shackles + Spreader Joint Shackles + Master Link)
            let shacklesKg = 4.2; // Forged alloy oval master link
            const nLugs = state.lugs ? state.lugs.length : 4;
            for (let i = 0; i < nLugs; i++) {
                const sh = state.gear && state.gear.shackles ? state.gear.shackles[i] : null;
                shacklesKg += shackleMassKg(sh, state.wllPerLeg);
            }
            const jointCount = jointLinks ? jointLinks.length : 0;
            for (let j = 0; j < jointCount; j++) {
                const link = jointLinks[j] && jointLinks[j].userData ? jointLinks[j].userData.jointLink : null;
                const swlEst = link && link.role === 'upper' ? state.wllPerLeg * 1.8 : state.wllPerLeg;
                shacklesKg += shackleMassKg(null, swlEst);
            }

            // 4. Inline Turnbuckles / Rigging Screws
            let turnbucklesKg = 0;
            for (let i = 0; i < nLugs; i++) {
                if (Math.abs((state.legDeltaL && state.legDeltaL[i]) || 0) > 0.004) {
                    turnbucklesKg += 6.5 + 0.35 * (state.wllPerLeg || 15);
                }
            }

            // 5. Crane Hook Block + 4-Part Hoist Line Deduction
            const hookBlockSelfKg = (state.gear && state.gear.hook && state.gear.hook.massKg != null)
                ? state.gear.hook.massKg
                : 380;
            const hoistLineKg = 4 * 1.65 * Math.max(2.0, 22.0 - (phy.hookPos ? phy.hookPos.y : 8.5));
            const hookTotalKg = hookBlockSelfKg + hoistLineKg;

            const beamMassT = beamMassKg / 1000;
            const slingsMassT = slingsKg / 1000;
            const shacklesMassT = shacklesKg / 1000;
            const turnbucklesMassT = turnbucklesKg / 1000;
            const hookBlockT = hookTotalKg / 1000;
            const belowHookRiggingT = beamMassT + slingsMassT + shacklesMassT + turnbucklesMassT;
            const grossHookLoadT = state.weight + belowHookRiggingT;
            const grossCraneLoadT = grossHookLoadT + hookBlockT;

            phy.massBreakdown = {
                cargoNetT: state.weight,
                beamMassT,
                slingsMassT,
                shacklesMassT,
                turnbucklesMassT,
                hookBlockT,
                belowHookRiggingT,
                grossHookLoadT,
                grossCraneLoadT
            };
            phy.gearWeight = belowHookRiggingT;
            return phy.massBreakdown;
        }

        function addLugPlate(x, y, z, memberId, boreAlongX) {
            const alloyMat = MATS.forgedAlloy || MATS.galvSteel;
            const plate = new THREE.Mesh(
                boreAlongX ? new THREE.BoxGeometry(0.028, 0.16, 0.14) : new THREE.BoxGeometry(0.14, 0.16, 0.028),
                MATS.yellowHazard
            );
            plate.position.set(x, y * 0.72, z);
            tagMember(plate, memberId);

            const boss = new THREE.Mesh(createBossRingGeometry(0.038, 0.020, 0.038), alloyMat);
            boss.position.set(x, y, z);
            if (boreAlongX) boss.rotation.y = Math.PI / 2;
            boss.userData.gearKind = 'member';
            boss.userData.memberId = memberId;
            boss.userData.memberBody = true;
            spreaderRootGroup.add(boss);
        }

        function addModuliftEnd(x, y, memberId, outward, twinLowerEars) {
            const od = memberDiameter(memberId);
            const flange = new THREE.Mesh(new THREE.CylinderGeometry(od * 0.68, od * 0.68, 0.028, 20), MATS.darkSteel);
            flange.rotation.z = Math.PI / 2;
            flange.position.set(x - outward * 0.34, y, 0);
            spreaderRootGroup.add(flange);

            const taper = new THREE.Mesh(new THREE.CylinderGeometry(od * 0.38, od * 0.56, 0.30, 18), MATS.yellowHazard);
            taper.rotation.z = Math.PI / 2;
            taper.position.set(x - outward * 0.18, y, 0);
            tagMember(taper, memberId);

            // End drop box head
            const dropBox = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.24, twinLowerEars ? 0.20 : 0.12), MATS.yellowHazard);
            dropBox.position.set(x, y, 0);
            tagMember(dropBox, memberId);

            // Top compression sling lug
            addLugPlate(x, y + 0.22, 0, memberId, false);
            if (twinLowerEars) {
                addLugPlate(x, y - 0.22,  0.065, memberId, false);
                addLugPlate(x, y - 0.22, -0.065, memberId, false);
            } else {
                addLugPlate(x, y - 0.22, 0, memberId, false);
            }
        }

        function dressTubularStrut(length, y, axis, memberId, originX = 0, originZ = 0) {
            const segments = Math.max(2, Math.round(length / 1.4));
            const od = memberDiameter(memberId);
            for (let i = 1; i < segments; i++) {
                const along = (-0.5 + i / segments) * length;
                // Bolted Modulift intermediate flange pair
                const flangePair = new THREE.Mesh(new THREE.CylinderGeometry(od * 0.68, od * 0.68, 0.036, 20), MATS.darkSteel);
                if (axis === 'x') {
                    flangePair.rotation.z = Math.PI / 2;
                    flangePair.position.set(originX + along, y, originZ);
                } else {
                    flangePair.rotation.x = Math.PI / 2;
                    flangePair.position.set(originX, y, originZ + along);
                }
                flangePair.userData.gearKind = 'member';
                flangePair.userData.memberId = memberId;
                flangePair.userData.memberBody = true;
                spreaderRootGroup.add(flangePair);
            }
        }

        function tagMember(mesh, id) {
            const mat = MATS.yellowHazard.clone();
            const on = state.gear && state.gear.selection.some(s => s.kind === 'member' && s.memberId === id);
            if (on) {
                mat.emissive = new THREE.Color(0x0369a1);
                mat.emissiveIntensity = 0.7;
            }
            mesh.material = mat;
            mesh.castShadow = true;
            mesh.userData.gearKind = 'member';
            mesh.userData.memberId = id;
            mesh.userData.memberBody = true;
            spreaderRootGroup.add(mesh);
        }

        function addPickMark(x, y, z, id) {
            const mark = new THREE.Mesh(new THREE.SphereGeometry(0.065, 12, 8), MATS.lpHighlight.clone());
            mark.position.set(x, y, z);
            mark.userData.gearKind = 'member';
            mark.userData.memberId = id;
            spreaderRootGroup.add(mark);
        }

        function addJointShackle(x, y, z, memberId, link) {
            const hw = state.hwType || 'bow_shackle';
            const g = buildHardwareMesh(hw);
            g.position.set(x, y, z);
            g.userData.jointLink = link;
            const tag = (o) => {
                o.userData.gearKind = 'member';
                o.userData.memberId = memberId;
                o.userData.memberBody = true;
            };
            tag(g);
            g.traverse(tag);
            jointLinks.push(g);
            spreaderRootGroup.add(g);
        }

        function rebuildSpreaderVisuals() {
            disposeBeamGroups();
            jointLinks.length = 0;
            while (spreaderRootGroup.children.length > 0) spreaderRootGroup.remove(spreaderRootGroup.children[0]);

            const { beamType } = state;
            const { spanX, spanZ } = getLPBoundingSpan();

            const BEAM_MESH_NAMES = {
                none: 'Bridle_Sling',
                spreader: 'Modular_Spreader_Beam',
                modulift_spreader_glb: 'Modular_Spreader_Beam',
                lifting_beam: 'Lifting_Beam',
                h_beam: 'H_Beam_Spreader',
                cascaded: 'Cascaded_Spreader_System',
                inline4: 'Cascaded_Spreader_System',
                spatial8: 'Cascaded_Spreader_System',
                inline8: 'Cascaded_Spreader_System',
                container_spreader: 'ISO_Container_Spreader',
                frame: 'H_Beam_Spreader',
                modular_truss: 'Spreader_Beam',
                basket: 'Spreader_Beam'
            };
            spreaderRootGroup.name = BEAM_MESH_NAMES[beamType] || 'Spreader_Beam';

            if (beamType === 'none') {
                spreaderRootGroup.visible = false;
                computeRiggingMassBreakdown();
                mountBeamBodies();
                return;
            }
            spreaderRootGroup.visible = true;

            if (beamType === 'container_spreader') {
                const halfX = spanX / 2;
                const halfZ = spanZ / 2;

                // Central Telescopic Spreader Mainframe Body
                const mainBodyW = Math.min(spanX * 0.72, 5.4);
                const mainBox = new THREE.Mesh(new THREE.BoxGeometry(mainBodyW, 0.58, 0.78), MATS.spreaderYellow);
                mainBox.position.set(0, 0, 0);
                tagMember(mainBox, 'spreader_main');

                [-1, 1].forEach(sx => {
                    const extLen = Math.max(0.8, halfX - mainBodyW / 4);
                    const extArm = new THREE.Mesh(new THREE.BoxGeometry(extLen, 0.44, 0.62), MATS.darkSteel);
                    extArm.position.set(sx * (mainBodyW / 4 + extLen / 2), 0, 0);
                    spreaderRootGroup.add(extArm);

                    const endBeam = new THREE.Mesh(new THREE.BoxGeometry(0.58, 0.52, spanZ + 0.22), MATS.spreaderYellow);
                    endBeam.position.set(sx * halfX, 0, 0);
                    tagMember(endBeam, sx > 0 ? 'endPlus' : 'endMinus');

                    [-1, 1].forEach(sz => {
                        const cornerX = sx * halfX;
                        const cornerZ = sz * halfZ;
                        const housing = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.42, 0.35), MATS.darkSteel);
                        housing.position.set(cornerX, -0.06, cornerZ);
                        const pin = new THREE.Mesh(new THREE.CylinderGeometry(0.048, 0.048, 0.25, 12), MATS.galvSteel);
                        pin.position.set(cornerX, -0.32, cornerZ);
                        const ind = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.14, 0.14), MATS.lpHighlight);
                        ind.position.set(cornerX + sx * 0.2, 0.1, cornerZ);
                        const flipperArm = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.82, 0.2), MATS.yellowHazard);
                        flipperArm.position.set(cornerX + sx * 0.24, -0.32, cornerZ + sz * 0.18);
                        flipperArm.rotation.z = -sx * 0.42;
                        flipperArm.rotation.x = sz * 0.42;
                        spreaderRootGroup.add(housing, pin, ind, flipperArm);
                    });
                });

                addPickMark(halfX, 0, halfZ, 'corner0');
                addPickMark(-halfX, 0, halfZ, 'corner1');
                addPickMark(-halfX, 0, -halfZ, 'corner2');
                addPickMark(halfX, 0, -halfZ, 'corner3');
                addJointShackle(halfX, 0.28, halfZ, 'corner0', { role: 'upper', index: 0 });
                addJointShackle(-halfX, 0.28, halfZ, 'corner1', { role: 'upper', index: 1 });
                addJointShackle(-halfX, 0.28, -halfZ, 'corner2', { role: 'upper', index: 2 });
                addJointShackle(halfX, 0.28, -halfZ, 'corner3', { role: 'upper', index: 3 });
                addJointShackle(halfX, -0.28, halfZ, 'corner0', { role: 'leg', index: 0 });
                addJointShackle(-halfX, -0.28, halfZ, 'corner1', { role: 'leg', index: 1 });
                addJointShackle(-halfX, -0.28, -halfZ, 'corner2', { role: 'leg', index: 2 });
                addJointShackle(halfX, -0.28, -halfZ, 'corner3', { role: 'leg', index: 3 });

            } else if (beamType === 'spreader') {
                // MODULIFT MODULAR TUBULAR COMPRESSION SPREADER STRUT
                const main = memberSpec('main');
                const od = memberDiameter('main');
                const coreLen = Math.max(0.3, Math.abs(main.a - main.b) - 0.64);
                const midX = (main.a + main.b) * 0.5;
                const strutPipe = new THREE.Mesh(new THREE.CylinderGeometry(od / 2, od / 2, coreLen, 28));
                strutPipe.rotation.z = Math.PI / 2;
                strutPipe.position.set(midX, 0, 0);
                tagMember(strutPipe, 'main');
                dressTubularStrut(coreLen, 0, 'x', 'main');

                addModuliftEnd(main.a, 0, 'main', main.a >= main.b ? 1 : -1, true);
                addModuliftEnd(main.b, 0, 'main', main.b > main.a ? 1 : -1, true);

                addPickMark(main.a, 0, 0, 'main');
                addPickMark(main.b, 0, 0, 'main');

                // Separated upper (+0.22m) and twin lower (-0.22m, ±0.065m) forged shackles
                addJointShackle(main.a,  0.22,  0.000, 'main', { role: 'upper', index: 1 });
                addJointShackle(main.a, -0.22,  0.065, 'main', { role: 'leg',   index: 0 });
                addJointShackle(main.a, -0.22, -0.065, 'main', { role: 'leg',   index: 3 });

                addJointShackle(main.b,  0.22,  0.000, 'main', { role: 'upper', index: 0 });
                addJointShackle(main.b, -0.22,  0.065, 'main', { role: 'leg',   index: 1 });
                addJointShackle(main.b, -0.22, -0.065, 'main', { role: 'leg',   index: 2 });

            } else if (beamType === 'lifting_beam') {
                // HEAVY WIDE-FLANGE STEEL H-SECTION LIFTING BEAM (ASME B30.20)
                const main = memberSpec('main');
                const web = new THREE.Mesh(new THREE.BoxGeometry(main.length, 0.28, 0.032));
                const topFlange = new THREE.Mesh(new THREE.BoxGeometry(main.length, 0.036, 0.24));
                topFlange.position.y = 0.155;
                const botFlange = new THREE.Mesh(new THREE.BoxGeometry(main.length, 0.036, 0.24));
                botFlange.position.y = -0.155;
                tagMember(web, 'main');
                tagMember(topFlange, 'main');
                tagMember(botFlange, 'main');

                // End closure plates & vertical web stiffener ribs
                [-main.length / 2, main.length / 2].forEach(ex => {
                    const endCap = new THREE.Mesh(new THREE.BoxGeometry(0.024, 0.34, 0.24), MATS.darkSteel);
                    endCap.position.x = ex;
                    spreaderRootGroup.add(endCap);
                });
                const ribs = Math.max(4, Math.round(main.length / 0.65));
                for (let r = 0; r < ribs; r++) {
                    const rx = -main.length / 2 + (r + 0.5) * (main.length / ribs);
                    [-0.08, 0.08].forEach(rz => {
                        const rib = new THREE.Mesh(new THREE.BoxGeometry(0.018, 0.27, 0.075), MATS.darkSteel);
                        rib.position.set(rx, 0, rz);
                        spreaderRootGroup.add(rib);
                    });
                }

                // Welded top & twin bottom pad-eyes
                [main.a, main.b].forEach(lx => {
                    addLugPlate(lx,  0.24,  0.000, 'main', false);
                    addLugPlate(lx, -0.24,  0.065, 'main', false);
                    addLugPlate(lx, -0.24, -0.065, 'main', false);
                });
                // Auxiliary central top bail eye (visual ASME B30.20 reference)
                addLugPlate(0, 0.23, 0, 'main', false);

                addPickMark(main.a, 0, 0, 'main');
                addPickMark(main.b, 0, 0, 'main');

                addJointShackle(main.a,  0.24,  0.000, 'main', { role: 'upper', index: 1 });
                addJointShackle(main.a, -0.24,  0.065, 'main', { role: 'leg',   index: 0 });
                addJointShackle(main.a, -0.24, -0.065, 'main', { role: 'leg',   index: 3 });

                addJointShackle(main.b,  0.24,  0.000, 'main', { role: 'upper', index: 0 });
                addJointShackle(main.b, -0.24,  0.065, 'main', { role: 'leg',   index: 1 });
                addJointShackle(main.b, -0.24, -0.065, 'main', { role: 'leg',   index: 2 });

            } else if (beamType === 'cascaded' || beamType === 'modular_truss') {
                const topId = beamType === 'modular_truss' ? 'truss' : 'top';
                const top = memberSpec(topId);
                const yTop = beamType === 'modular_truss' ? 0.85 : 1.15;
                if (beamType === 'modular_truss') {
                    const truss = createLatticeBoomMesh(top.length, 0.48, MATS.yellowHazard);
                    truss.rotation.z = -Math.PI / 2;
                    truss.position.set(-top.length / 2, yTop, 0);
                    truss.userData.memberId = topId;
                    truss.userData.gearKind = 'member';
                    truss.traverse(o => {
                        if (o.isMesh) {
                            o.userData.gearKind = 'member';
                            o.userData.memberId = topId;
                            o.userData.memberBody = true;
                        }
                    });
                    spreaderRootGroup.add(truss);
                } else {
                    const od = memberDiameter(topId);
                    const coreLen = Math.max(0.3, Math.abs(top.a - top.b) - 0.64);
                    const mainPipe = new THREE.Mesh(new THREE.CylinderGeometry(od / 2, od / 2, coreLen, 24));
                    mainPipe.rotation.z = Math.PI / 2;
                    mainPipe.position.set((top.a + top.b) * 0.5, yTop, 0);
                    tagMember(mainPipe, topId);
                    dressTubularStrut(coreLen, yTop, 'x', topId);
                }
                addModuliftEnd(top.a, yTop, topId, top.a >= 0 ? 1 : -1, false);
                addModuliftEnd(top.b, yTop, topId, top.b >= 0 ? 1 : -1, false);

                [{ spec: memberSpec('lowPlus'), x: top.a, hangerIndex: 0 }, { spec: memberSpec('lowMinus'), x: top.b, hangerIndex: 1 }].forEach(({ spec, x, hangerIndex }) => {
                    const sod = Math.max(0.06, memberDiameter(spec.id));
                    const sub = new THREE.Mesh(new THREE.CylinderGeometry(sod / 2, sod / 2, spec.length, 20));
                    sub.rotation.x = Math.PI / 2;
                    sub.position.set(x, 0, 0);
                    tagMember(sub, spec.id);
                    // Each lower cross-member is offset from the centreline. Its
                    // flange collars must follow that same X coordinate so visual
                    // geometry and its collision proxy describe the same steel.
                    dressTubularStrut(spec.length, 0, 'z', spec.id, x, 0);
                    addLugPlate(x,  0.18, 0,      spec.id, true);
                    addLugPlate(x, -0.18, spec.a, spec.id, true);
                    addLugPlate(x, -0.18, spec.b, spec.id, true);
                    const upperIndex = x >= 0 ? 1 : 0;
                    const legPos = x >= 0 ? 0 : 1;
                    const legNeg = x >= 0 ? 3 : 2;
                    addJointShackle(x, yTop + 0.22, 0, topId,   { role: 'upper',   index: upperIndex });
                    addJointShackle(x, yTop - 0.22, 0, topId,   { role: 'hanger',  index: hangerIndex });
                    addJointShackle(x,  0.18,       0, spec.id, { role: 'hangerB', index: hangerIndex });
                    addJointShackle(x, -0.18,  spec.a, spec.id, { role: 'leg',     index: legPos });
                    addJointShackle(x, -0.18,  spec.b, spec.id, { role: 'leg',     index: legNeg });
                    const hangerLen = Math.max(0.2, yTop - 0.08);
                    const hanger = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, hangerLen, 10), MATS.wireRope);
                    hanger.position.set(x, 0.08 + hangerLen / 2, 0);
                    hanger.userData.isHanger = true;
                    hanger.userData.gearKind = 'member';
                    hanger.userData.memberId = spec.id;
                    spreaderRootGroup.add(hanger);
                });

            } else if (beamType === 'frame') {
                // 4-POINT RECTANGULAR BOX-SECTION LIFTING FRAME
                const thick = 0.18;
                ['railPos', 'railNeg'].forEach(id => {
                    const spec = memberSpec(id);
                    const z = id === 'railPos' ? spanZ / 2 : -spanZ / 2;
                    const rail = new THREE.Mesh(new THREE.BoxGeometry(spec.length + thick, thick, thick));
                    rail.position.z = z;
                    tagMember(rail, id);
                    addPickMark(spec.a, 0, z, id);
                    addPickMark(spec.b, 0, z, id);
                });
                ['endPos', 'endNeg'].forEach(id => {
                    const spec = memberSpec(id);
                    const x = id === 'endPos' ? spanX / 2 : -spanX / 2;
                    const end = new THREE.Mesh(new THREE.BoxGeometry(thick, thick, spec.length + thick));
                    end.position.x = x;
                    tagMember(end, id);
                    addPickMark(x, 0, spec.a, id);
                    addPickMark(x, 0, spec.b, id);
                });
                [[spanX / 2, spanZ / 2, 0], [-spanX / 2, spanZ / 2, 1], [-spanX / 2, -spanZ / 2, 2], [spanX / 2, -spanZ / 2, 3]].forEach(([x, z, i]) => {
                    const id = z > 0 ? 'railPos' : 'railNeg';
                    // Corner stiffener gusset + separated upper/lower lugs
                    const gusset = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.20, 0.28), MATS.darkSteel);
                    gusset.position.set(x, 0, z);
                    gusset.userData.memberId = id;
                    gusset.userData.gearKind = 'member';
                    spreaderRootGroup.add(gusset);
                    addLugPlate(x,  0.18, z, id, false);
                    addLugPlate(x, -0.18, z, id, false);
                    addJointShackle(x,  0.18, z, id, { role: 'upper', index: i });
                    addJointShackle(x, -0.18, z, id, { role: 'leg',   index: i });
                });

            } else if (beamType === 'basket') {
                [{ id: 'barPos', x: spanX / 2 }, { id: 'barNeg', x: -spanX / 2 }].forEach(({ id, x }) => {
                    const spec = memberSpec(id);
                    const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.085, 0.085, spec.length, 24));
                    bar.rotation.x = Math.PI / 2;
                    bar.position.set(x, 0, 0);
                    tagMember(bar, id);
                    addPickMark(x, 0, spec.a, id);
                    addPickMark(x, 0, spec.b, id);
                    const legA = x > 0 ? 0 : 1;
                    const legB = x > 0 ? 3 : 2;
                    addLugPlate(x,  0.14, spec.a, id, true);
                    addLugPlate(x, -0.14, spec.a, id, true);
                    addLugPlate(x,  0.14, spec.b, id, true);
                    addLugPlate(x, -0.14, spec.b, id, true);
                    addJointShackle(x,  0.14, spec.a, id, { role: 'upper', index: legA });
                    addJointShackle(x, -0.14, spec.a, id, { role: 'leg',   index: legA });
                    addJointShackle(x,  0.14, spec.b, id, { role: 'upper', index: legB });
                    addJointShackle(x, -0.14, spec.b, id, { role: 'leg',   index: legB });
                });

            } else if (beamType === 'inline4' || beamType === 'inline8' || beamType === 'spatial8') {
                buildTierMeshes(beamType);

            } else if (customBeamMeshes[beamType]) {
                const customB = customBeamMeshes[beamType].clone();
                if (!(customB.userData && customB.userData.isNormalizedAsset)) {
                    const bbox = new THREE.Box3().setFromObject(customB);
                    const sz = new THREE.Vector3();
                    bbox.getSize(sz);
                    customB.scale.multiply(new THREE.Vector3(
                        (spanX + 0.3) / Math.max(0.2, sz.x),
                        1.0,
                        (spanZ + 0.2) / Math.max(0.2, sz.z)
                    ));
                }
                spreaderRootGroup.add(customB);
            }

            computeRiggingMassBreakdown();
            spreaderRootGroup.userData.gearKind = 'beam';
            spreaderRootGroup.userData.gearIndex = 0;
            placeExtraPicks();
            mountBeamBodies();
        }

        // --- 6B. SHELL CONTACT — pad-eyes weld to the real mesh, not the bounding box ---
        const surfaceRaycaster = new THREE.Raycaster();

        function cargoShellHits(localOrigin, localDir, maxDist) {
            if (!activeCargoVisual || !cargoRootGroup) return [];
            cargoRootGroup.updateMatrixWorld(true);
            const dir = localDir.clone().normalize();
            const worldOrigin = localOrigin.clone().applyMatrix4(cargoRootGroup.matrixWorld);
            const worldDir = dir.clone().transformDirection(cargoRootGroup.matrixWorld).normalize();
            surfaceRaycaster.set(worldOrigin, worldDir);
            surfaceRaycaster.near = 0;
            surfaceRaycaster.far = maxDist || 40;
            const raw = surfaceRaycaster.intersectObject(activeCargoVisual, true);
            const inv = new THREE.Matrix4().copy(cargoRootGroup.matrixWorld).invert();
            const hits = [];
            for (let i = 0; i < raw.length; i++) {
                const hit = raw[i];
                if (!hit.face || !hit.object) continue;
                if (hit.object.userData && (hit.object.userData.noLugWeld || hit.object.userData.isCADEdge)) continue;
                const nWorld = hit.face.normal.clone().transformDirection(hit.object.matrixWorld).normalize();
                if (nWorld.dot(worldDir) > -0.02) continue;
                const point = cargoRootGroup.worldToLocal(hit.point.clone());
                const normal = nWorld.clone().transformDirection(inv).normalize();
                hits.push({ point, normal });
            }
            return hits;
        }

        function firstShellHit(localOrigin, localDir, maxDist) {
            const hits = cargoShellHits(localOrigin, localDir, maxDist);
            return hits.length ? hits[0] : null;
        }

        function patchIsStable(point, normal, mode) {
            const offsets = [[0.2, 0], [-0.2, 0], [0, 0.2], [0, -0.2]];
            let agree = 0;
            for (let k = 0; k < offsets.length; k++) {
                const dx = offsets[k][0], dz = offsets[k][1];
                let hit = null;
                if (mode === 'bottom') {
                    hit = firstShellHit(new THREE.Vector3(point.x + dx, point.y - 1.4, point.z + dz), new THREE.Vector3(0, 1, 0), 3.2);
                } else if (mode === 'mid') {
                    const out = new THREE.Vector3(point.x, 0, point.z);
                    if (out.lengthSq() < 1e-6) out.set(1, 0, 0);
                    out.normalize();
                    hit = firstShellHit(new THREE.Vector3(point.x, point.y, point.z).addScaledVector(out, 1.3), out.clone().negate(), 2.6);
                } else {
                    hit = firstShellHit(new THREE.Vector3(point.x + dx, point.y + 1.4, point.z + dz), new THREE.Vector3(0, -1, 0), 3.2);
                }
                if (hit && Math.abs(hit.point.y - point.y) < 0.3 && hit.normal.dot(normal) > 0.4) agree++;
            }
            return agree >= 2;
        }

        function faceMatchesMode(hit, mode) {
            if (!hit) return false;
            if (mode === 'top') return hit.normal.y > 0.3;
            if (mode === 'bottom') return hit.normal.y < -0.3;
            if (mode === 'mid') return Math.abs(hit.normal.y) < 0.72;
            return true;
        }

        function pickStructuralHit(hits, mode) {
            const faced = hits.filter(h => faceMatchesMode(h, mode));
            if (!faced.length) return null;
            const stable = faced.filter(h => patchIsStable(h.point, h.normal, mode === 'nearest' ? 'top' : mode));
            return (stable.length ? stable : faced)[0];
        }

        function marchOntoShell(x, z, yHint, mode) {
            const { L, W, H } = state;
            const sx = x, sz = z;
            for (let t = 1; t >= 0.12; t -= 0.07) {
                const px = sx * t;
                const pz = sz * t;
                let hits = [];
                if (mode === 'bottom') {
                    hits = cargoShellHits(new THREE.Vector3(px, -H * 0.5 - 2.2, pz), new THREE.Vector3(0, 1, 0), H + 4);
                } else if (mode === 'mid') {
                    const radial = new THREE.Vector3(px, 0, pz);
                    if (radial.lengthSq() < 1e-6) radial.set(1, 0, 0);
                    radial.normalize();
                    const y = THREE.MathUtils.clamp(yHint, -H * 0.45, H * 0.45);
                    const outside = radial.clone().multiplyScalar(Math.max(L, W) * 0.85);
                    hits = cargoShellHits(new THREE.Vector3(outside.x, y, outside.z), radial.clone().negate(), Math.max(L, W) * 2);
                } else {
                    hits = cargoShellHits(new THREE.Vector3(px, H * 0.5 + 2.2, pz), new THREE.Vector3(0, -1, 0), H + 5);
                }
                const hit = pickStructuralHit(hits, mode);
                if (hit) return hit;
            }
            return null;
        }

        function findQuadrantMount(sx, sz, mode) {
            const { L, W, H } = state;
            const candidates = [];
            for (let a = 3; a <= 8; a++) {
                for (let b = 3; b <= 8; b++) {
                    const x = sx * (L * 0.5) * (a / 8) * 0.98;
                    const z = sz * (W * 0.5) * (b / 8) * 0.98;
                    let hits = [];
                    if (mode === 'bottom') hits = cargoShellHits(new THREE.Vector3(x, -H * 0.5 - 2.2, z), new THREE.Vector3(0, 1, 0), H + 4);
                    else if (mode === 'mid') {
                        const radial = new THREE.Vector3(x, 0, z);
                        if (radial.lengthSq() < 1e-6) continue;
                        radial.normalize();
                        const outside = radial.clone().multiplyScalar(Math.max(L, W) * 0.9);
                        hits = cargoShellHits(new THREE.Vector3(outside.x, 0, outside.z), radial.clone().negate(), Math.max(L, W) * 2);
                    } else hits = cargoShellHits(new THREE.Vector3(x, H * 0.5 + 2.2, z), new THREE.Vector3(0, -1, 0), H + 5);
                    const hit = pickStructuralHit(hits, mode);
                    if (!hit) continue;
                    const stable = patchIsStable(hit.point, hit.normal, mode);
                    candidates.push({ hit, stable });
                }
            }
            const pool = candidates.filter(c => c.stable);
            const use = pool.length ? pool : candidates;
            if (!use.length) return marchOntoShell(sx * L * 0.35, sz * W * 0.35, 0, mode);
            let band = use;
            if (mode === 'top' || mode === 'bottom') {
                const ys = use.map(c => c.hit.point.y);
                const extreme = mode === 'top' ? Math.max(...ys) : Math.min(...ys);
                const primary = use.filter(c => mode === 'top' ? c.hit.point.y >= extreme - 0.38 : c.hit.point.y <= extreme + 0.38);
                const spanOf = (list) => {
                    let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
                    list.forEach(c => {
                        minX = Math.min(minX, c.hit.point.x); maxX = Math.max(maxX, c.hit.point.x);
                        minZ = Math.min(minZ, c.hit.point.z); maxZ = Math.max(maxZ, c.hit.point.z);
                    });
                    return Math.hypot(maxX - minX, maxZ - minZ);
                };
                band = primary;
                if (primary.length < 3 || spanOf(primary) < 0.28) {
                    const rest = use.filter(c => mode === 'top' ? c.hit.point.y < extreme - 0.38 : c.hit.point.y > extreme + 0.38);
                    if (rest.length) {
                        const ys2 = rest.map(c => c.hit.point.y);
                        const extreme2 = mode === 'top' ? Math.max(...ys2) : Math.min(...ys2);
                        const secondary = rest.filter(c => mode === 'top' ? c.hit.point.y >= extreme2 - 0.42 : c.hit.point.y <= extreme2 + 0.42);
                        if (spanOf(secondary) > spanOf(primary)) band = secondary;
                    }
                }
                if (!band.length) band = use;
            }
            band.sort((a, b) => {
                const sa = Math.abs(a.hit.point.x) / Math.max(0.1, L) + Math.abs(a.hit.point.z) / Math.max(0.1, W);
                const sb = Math.abs(b.hit.point.x) / Math.max(0.1, L) + Math.abs(b.hit.point.z) / Math.max(0.1, W);
                return sb - sa;
            });
            return band[0].hit;
        }

        function projectDesiredToShell(desired, mode) {
            const { L, W, H } = state;
            if (mode === 'top' || mode === 'bottom' || mode === 'mid') {
                const marched = marchOntoShell(desired.x, desired.z, desired.y, mode);
                if (marched) return marched;
            }
            const bags = [];
            bags.push(cargoShellHits(new THREE.Vector3(desired.x, H * 0.5 + 2.2, desired.z), new THREE.Vector3(0, -1, 0), H + 5));
            bags.push(cargoShellHits(new THREE.Vector3(desired.x, -H * 0.5 - 2.2, desired.z), new THREE.Vector3(0, 1, 0), H + 5));
            const away = desired.clone();
            if (away.lengthSq() < 1e-6) away.set(0, 1, 0);
            away.normalize();
            bags.push(cargoShellHits(desired.clone().addScaledVector(away, Math.max(L, H, W)), away.clone().negate(), Math.max(L, H, W) * 2.2));
            const all = [];
            bags.forEach(list => list.forEach(h => all.push(h)));
            if (!all.length) return null;
            all.forEach(h => { h._d = h.point.distanceTo(desired); });
            all.sort((a, b) => a._d - b._d);
            return all[0];
        }

        function alreadyWelded(index) {
            const p = state.lugs[index];
            const n = state.lugNormals[index];
            if (!n || n.lengthSq() < 0.5) return false;
            const hit = firstShellHit(p.clone().addScaledVector(n, 0.45), n.clone().negate(), 0.9);
            return !!(hit && hit.point.distanceTo(p) < 0.045 && hit.normal.dot(n) > 0.82);
        }

        function conformLugToShell(index, mode) {
            if (mode === 'nearest' && alreadyWelded(index)) return;
            const desired = state.lugs[index].clone();
            let hit = projectDesiredToShell(desired, mode);
            if (!hit) {
                const sx = Math.sign(desired.x) || 1;
                const sz = Math.sign(desired.z) || 1;
                hit = findQuadrantMount(sx, sz, mode === 'nearest' ? state.lugElevPreset : mode);
            }
            if (!hit) return;
            state.lugs[index].copy(hit.point);
            state.lugNormals[index].copy(hit.normal).normalize();
        }

        function setSymmetricLugsFromDimensions() {
            while (state.lugs.length < 4) state.lugs.push(new THREE.Vector3());
            while (state.lugNormals.length < state.lugs.length) state.lugNormals.push(new THREE.Vector3(0, 1, 0));
            const { lugElevPreset, cargoType, L, W, H } = state;
            const signs = [[1, 1], [-1, 1], [-1, -1], [1, -1]];

            if (customCargoMeshes && customCargoMeshes[cargoType]) {
                const ly = lugElevPreset === 'bottom' ? -H / 2 + 0.12 : (lugElevPreset === 'mid' ? 0 : H / 2 - 0.05);
                for (let i = 0; i < 4; i++) {
                    state.lugs[i].set(signs[i][0] * (L / 2 - 0.18), ly, signs[i][1] * (W / 2 - 0.14));
                    state.lugNormals[i].set(0, 1, 0);
                }
                return;
            }

            const isoTypes = ['opentop', 'flatrack', 'isotank', 'container', 'iso40', 'iso40hc', 'reefer', 'platform'];
            if (isoTypes.includes(cargoType) && lugElevPreset !== 'mid') {
                const topY = cargoType === 'platform' ? (-H / 2 + Math.min(H * 0.24, 0.36)) : (H / 2);
                const ly = lugElevPreset === 'bottom' ? (-H / 2 + 0.08) : topY;
                const ny = lugElevPreset === 'bottom' ? -1 : 1;
                for (let i = 0; i < 4; i++) {
                    state.lugs[i].set(signs[i][0] * (L / 2 - 0.09), ly, signs[i][1] * (W / 2 - 0.09));
                    state.lugNormals[i].set(0, ny, 0);
                }
                return;
            }
            if (cargoType === 'car' || cargoType === 'boat') {
                const ly = cargoType === 'car' ? (-H / 2 + 0.14) : (-H * 0.42);
                const lx = cargoType === 'car' ? (L * 0.30) : (L * 0.25);
                const lz = cargoType === 'car' ? (W * 0.52) : (W * 0.46);
                for (let i = 0; i < 4; i++) {
                    state.lugs[i].set(signs[i][0] * lx, ly, signs[i][1] * lz);
                    state.lugNormals[i].set(0, 1, 0);
                }
                return;
            }
            for (let i = 0; i < 4; i++) {
                const hit = findQuadrantMount(signs[i][0], signs[i][1], lugElevPreset);
                if (hit) {
                    state.lugs[i].copy(hit.point);
                    state.lugNormals[i].copy(hit.normal).normalize();
                } else {
                    const ly = lugElevPreset === 'bottom' ? -H / 2 + 0.12 : (lugElevPreset === 'mid' ? 0 : H / 2);
                    state.lugs[i].set(signs[i][0] * (L / 2 - 0.15), ly, signs[i][1] * (W / 2 - 0.12));
                    state.lugNormals[i].set(0, lugElevPreset === 'bottom' ? -1 : (lugElevPreset === 'mid' ? signs[i][1] : 1), lugElevPreset === 'mid' ? signs[i][1] : 0).normalize();
                }
            }
        }

        function rebuildSupportMap() {
            const { L, W, H } = state;
            const found = [];
            const nx = 8, nz = 6;
            for (let ix = 0; ix < nx; ix++) {
                for (let iz = 0; iz < nz; iz++) {
                    const x = -L / 2 + L * ((ix + 0.5) / nx);
                    const z = -W / 2 + W * ((iz + 0.5) / nz);
                    const hit = firstShellHit(new THREE.Vector3(x, -H - 1.5, z), new THREE.Vector3(0, 1, 0), H * 2 + 3);
                    if (hit) found.push(hit.point.clone());
                }
            }
            if (!found.length) {
                phy.supportLocals = [
                    new THREE.Vector3(-L / 2, -H / 2, -W / 2),
                    new THREE.Vector3(L / 2, -H / 2, -W / 2),
                    new THREE.Vector3(L / 2, -H / 2, W / 2),
                    new THREE.Vector3(-L / 2, -H / 2, W / 2)
                ];
                return;
            }
            let minY = Infinity;
            found.forEach(p => { if (p.y < minY) minY = p.y; });
            const feet = found.filter(p => p.y <= minY + 0.045);
            const pool = feet.length ? feet : found;
            const chosen = [pool[0].clone()];
            while (chosen.length < Math.min(10, pool.length)) {
                let best = null, bestD = -1;
                for (let i = 0; i < pool.length; i++) {
                    let dmin = Infinity;
                    for (let c = 0; c < chosen.length; c++) dmin = Math.min(dmin, pool[i].distanceTo(chosen[c]));
                    if (dmin > bestD) { bestD = dmin; best = pool[i]; }
                }
                if (!best || bestD < 0.12) break;
                chosen.push(best.clone());
            }
            phy.supportLocals = chosen;
        }

        function orientPadEye(group, normal) {
            const n = normal.clone().normalize();
            if (n.lengthSq() < 0.5) n.set(0, 1, 0);
            const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), n);
            const heel = new THREE.Vector3(0, 0, 1).applyQuaternion(q);
            const flat = new THREE.Vector3(n.z, 0, -n.x);
            if (flat.lengthSq() > 1e-4) {
                flat.normalize();
                const cross = new THREE.Vector3().crossVectors(heel, flat);
                const twist = Math.atan2(n.dot(cross), heel.dot(flat));
                const spin = new THREE.Quaternion().setFromAxisAngle(n, twist);
                q.premultiply(spin);
            }
            group.quaternion.copy(q);
        }

        function orientPadEyeToPin(group, normalLocal, pinWorld) {
            const n = (normalLocal && normalLocal.lengthSq() > 0.25) ? normalLocal.clone().normalize() : new THREE.Vector3(0, 1, 0);
            const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), n);
            const pinLocal = pinWorld.clone().applyQuaternion(phy.cargoQuat.clone().invert());
            pinLocal.addScaledVector(n, -pinLocal.dot(n));
            if (pinLocal.lengthSq() > 1e-6) {
                pinLocal.normalize();
                const heel = new THREE.Vector3(0, 0, 1).applyQuaternion(q);
                const cross = new THREE.Vector3().crossVectors(heel, pinLocal);
                const twist = Math.atan2(n.dot(cross), heel.dot(pinLocal));
                q.premultiply(new THREE.Quaternion().setFromAxisAngle(n, twist));
            }
            group.quaternion.copy(q);
        }

        function rebuildCargoAndRig(resetSymmetricLugs = false) {
            const { cargoType, L, W, H, hwType, cogX, cogY, cogZ } = state;

            const oogKey = (cargoType === 'opentop' || cargoType === 'flatrack')
                ? `|${state.oogHasCargo ? 1 : 0}|${state.oogTarp ? 1 : 0}|${(state.oogCargoL || 0).toFixed(2)}|${(state.oogCargoW || 0).toFixed(2)}|${(state.oogCargoH || 0).toFixed(2)}`
                : '';
            const meshKey = cargoType + '|' + L.toFixed(3) + '|' + W.toFixed(3) + '|' + H.toFixed(3) + '|' + (state.xrayCargo ? 'x' : 's') + oogKey;
            if (!activeCargoVisual || activeCargoVisual.userData.meshKey !== meshKey) {
                if (activeCargoVisual) cargoRootGroup.remove(activeCargoVisual);
                const scars = cargoRootGroup.children.filter(ch => ch.name === 'impactScar');
                scars.forEach(ch => cargoRootGroup.remove(ch));
                activeCargoVisual = buildCargoMesh(cargoType, L, W, H);
                activeCargoVisual.userData.meshKey = meshKey;
                if (pbrFactory) pbrFactory.enforcePBRMaterials(activeCargoVisual);
                cargoRootGroup.add(activeCargoVisual);
                if (Array.isArray(sling3DPool)) {
                    sling3DPool.forEach(s => { s.ropeSim = null; });
                }
            }
            if (cargoRootGroup) cargoRootGroup.userData.gearKind = 'cargo';
            if (activeCargoVisual) {
                activeCargoVisual.userData.gearKind = 'cargo';
                activeCargoVisual.traverse(o => {
                    if (o.isMesh && o.userData) o.userData.gearKind = o.userData.gearKind || 'cargo';
                });
            }
            if (typeof resetFlatRackPayloadState === 'function') resetFlatRackPayloadState();
            cargoRootGroup.updateMatrixWorld(true);

            const hasExactMountPreset = ['opentop', 'flatrack', 'isotank', 'container', 'iso40', 'iso40hc', 'reefer', 'platform', 'car', 'boat'].includes(cargoType) && state.lugElevPreset !== 'mid';
            if (placeRigLugs()) {
                for (let i = 0; i < state.lugs.length; i++) conformLugToShell(i, 'nearest');
            } else if (resetSymmetricLugs || state.pendingConform === 'structural') {
                setSymmetricLugsFromDimensions();
                if (!hasExactMountPreset) {
                    for (let i = 0; i < state.lugs.length; i++) conformLugToShell(i, 'nearest');
                }
            } else if (state.pendingConform === 'preset') {
                if (hasExactMountPreset) {
                    setSymmetricLugsFromDimensions();
                } else {
                    for (let i = 0; i < state.lugs.length; i++) conformLugToShell(i, state.lugElevPreset);
                }
            } else if (state.pendingConform !== 'skip' && !hasExactMountPreset) {
                for (let i = 0; i < state.lugs.length; i++) conformLugToShell(i, 'nearest');
            }
            state.pendingConform = 'nearest';

            state.lugs.forEach(lp => {
                lp.x = THREE.MathUtils.clamp(lp.x, -L * 0.56, L * 0.56);
                lp.y = THREE.MathUtils.clamp(lp.y, -H * 0.56, H * 0.56);
                lp.z = THREE.MathUtils.clamp(lp.z, -W * 0.56, W * 0.56);
            });

            rebuildSupportMap();
            rebuildDunnageBlocks();

            cogIndicatorGroup.position.set(cogX, cogY, cogZ);

            state.lugs.forEach((pos, i) => {
                if (!pos) return;
                while (state.lugNormals.length <= i) state.lugNormals.push(new THREE.Vector3(0, 1, 0));
                const n = (state.lugNormals[i] || new THREE.Vector3(0, 1, 0)).clone();
                if (n.lengthSq() < 0.25) n.set(0, 1, 0);
                n.normalize();
                state.lugNormals[i].copy(n);
                if (padEyeMeshes[i]) {
                    padEyeMeshes[i].position.copy(pos);
                    orientPadEye(padEyeMeshes[i], n);
                    const baseMesh = padEyeMeshes[i].getObjectByName('lpBase');
                    if (baseMesh) {
                        baseMesh.material = (state.selectedLP === String(i)) ? MATS.lpSelected : MATS.lpHighlight;
                    }
                }

                if (hwMeshes[i]) {
                    while (hwMeshes[i].children.length > 0) hwMeshes[i].remove(hwMeshes[i].children[0]);
                    hwMeshes[i].add(buildHardwareMesh(hwType));
                    const jaw = state.gear && state.gear.shackles[i] ? state.gear.shackles[i].jawMm : 44;
                    hwMeshes[i].scale.setScalar(THREE.MathUtils.clamp((jaw || 44) / 44, 0.45, 2.4));
                    hwMeshes[i].userData.gearKind = 'shackle';
                    hwMeshes[i].userData.gearIndex = i;
                    hwMeshes[i].position.copy(pos).addScaledVector(n, 0.12);
                    if (padEyeMeshes[i]) hwMeshes[i].quaternion.copy(padEyeMeshes[i].quaternion);
                }
            });
            for (let i = 0; i < padEyeMeshes.length; i++) {
                const on = i < state.lugs.length;
                padEyeMeshes[i].visible = on;
                if (hwMeshes[i]) hwMeshes[i].visible = on;
                if (!on && forceArrows[i]) forceArrows[i].visible = false;
            }

            rebuildSpreaderVisuals();
            syncLPSlidersFromState();
            draw2DFootprintMap();

            document.getElementById('lbl-vol').textContent = (L * W * H).toFixed(1) + ' m³';
        }
