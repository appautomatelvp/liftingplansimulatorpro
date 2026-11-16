/**
 * cargo/specialty_meshes — reefer, open-top, car/ship, rebuild helpers
 * Split from legacy god-file (strangler Phase 2). Shared scope via assemble.
 */
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
            if (type === 'flatrack' || type === 'flatrack20') {
                addFlatRackContainer3D(group, L, W, H);
                return;
            }
            if (type === 'isotank') {
                addIsoTankContainer3D(group, L, W, H);
                return;
            }
            if (type === 'platform' || type === 'platform20') {
                const deckH = Math.max(0.22, H * 0.55);
                const deckTopY = -H / 2 + deckH;
                const deck = new THREE.Mesh(new THREE.BoxGeometry(L, deckH, W), MATS.darkSteel.clone());
                deck.position.y = -H / 2 + deckH * 0.5;
                deck.castShadow = true;
                group.add(deck);
                [-0.55, 0.55].forEach(xf => [-1, 1].forEach(sz => {
                    const pocket = new THREE.Mesh(new THREE.BoxGeometry(L * 0.28, 0.1, 0.32), MATS.gunmetal);
                    pocket.position.set(xf * L * 0.5, -H / 2 + 0.18, sz * W * 0.22);
                    group.add(pocket);
                }));
                addCornerCastings(group, L, W, H);
                addDeckOogCargoOverlay(group, L, W, H, deckTopY);
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

        function applyXRayToCargo(group, isXray) {
            if (!group) return;
            group.traverse(m => {
                if (m.isMesh && m.material && !m.userData?.isCADEdge) {
                    const mats = Array.isArray(m.material) ? m.material : [m.material];
                    mats.forEach(mat => {
                        if (mat.userData?.origOpacity === undefined) {
                            mat.userData.origOpacity = mat.opacity !== undefined ? mat.opacity : 1.0;
                            mat.userData.origTransparent = Boolean(mat.transparent);
                            mat.userData.origDepthWrite = Boolean(mat.depthWrite);
                        }
                        if (isXray) {
                            mat.transparent = true;
                            mat.opacity = 0.28;
                            mat.depthWrite = false;
                        } else {
                            mat.transparent = mat.userData.origTransparent;
                            mat.opacity = mat.userData.origOpacity;
                            mat.depthWrite = mat.userData.origDepthWrite;
                        }
                        mat.needsUpdate = true;
                    });
                }
            });
        }
        window.applyXRayToCargo = applyXRayToCargo;

        function buildCargoMesh(type, L, W, H) {
            const group = new THREE.Group();
            const finishCargoGroup = (g) => {
                if (state.xrayCargo) applyXRayToCargo(g, true);
                if (typeof applyCADFeatureEdges === 'function' && !g.userData?._cadEdgesApplied) {
                    applyCADFeatureEdges(g, false);
                    g.userData = g.userData || {};
                    g.userData._cadEdgesApplied = true;
                }
                return g;
            };
            const CARGO_MESH_NAMES = {
                container: 'ISO_Container_20ft',
                container_20ft_glb: 'ISO_Container_20ft',
                iso20hc: 'ISO_Container_20ft_HC',
                iso40: 'ISO_Container_40ft',
                container_40ft_glb: 'ISO_Container_40ft',
                iso40hc: 'ISO_Container_40ft_HC',
                iso45hc: 'ISO_Container_45ft_HC',
                container10: 'ISO_Container_10ft',
                iso53hc: 'ISO_Container_53ft_HC',
                flatrack: 'Flat_Rack_Container',
                flatrack20: 'Flat_Rack_Container_20ft',
                opentop: 'Open_Top_Container',
                opentop40: 'Open_Top_Container_40ft',
                isotank: 'Tank_Container_ISO_Tank',
                reefer: 'Reefer_Container',
                reefer20: 'Reefer_Container_20ft',
                platform: 'Platform_Container',
                platform20: 'Platform_Container_20ft',
                halfheight: 'Half_Height_Container',
                drybulk: 'Dry_Bulk_Container',
                crate: 'Heavy_Lift_OOG_Cargo',
                offshore_skid: 'Heavy_Lift_OOG_Cargo',
                pipe: 'Heavy_Lift_OOG_Cargo',
                vessel: 'Pressure_Vessel',
                transformer: 'Transformer',
                wind_nacelle: 'Wind_Turbine_Nacelle',
                excavator: 'Excavator_Heavy_Machinery',
                boat: 'Tugboat_Vessel_Hull',
                car: 'Vehicle'
            };
            group.name = CARGO_MESH_NAMES[type] || `Cargo_${type}`;

            // CAD prototypes:
            // - Dedicated Realistic V2 OBJ when present (preferred — no stretch)
            // - 20ft 22G1 / CONTS20FT as fallback for 20ft dry van
            // - Lengthen 22G1 only when open-top has no dedicated CAD
            const isTrue20ftDry = (type === 'container' || type === 'container_20ft_glb');
            const isStandardDryIso = (isTrue20ftDry || type === 'iso40' || type === 'container_40ft_glb'
                || type === 'iso40hc' || type === 'iso20hc' || type === 'iso45hc'
                || type === 'container10' || type === 'iso53hc');
            const isReefer = (type === 'reefer' || type === 'reefer20');
            const isOpenTop = (type === 'opentop' || type === 'opentop40');
            const isIsoModelFamily = (isStandardDryIso || isReefer || isOpenTop
                || type === 'flatrack' || type === 'flatrack20' || type === 'isotank'
                || type === 'platform' || type === 'platform20' || type === 'halfheight' || type === 'drybulk');
            const dedicatedProto = customCargoMeshes && customCargoMeshes[type];

            // Fit a dedicated CAD root into L×W×H, preserving authored materials when marked.
            const mountDedicatedIsoCad = (srcRoot, bodyColorFallback) => {
                const src = srcRoot.clone(true);
                const keepMats = !!(srcRoot.userData && (srcRoot.userData.keepMaterials || srcRoot.userData.isoRealisticV2));
                if (!keepMats && bodyColorFallback != null) tintIsoCadClone(src, bodyColorFallback);
                else {
                    src.traverse(child => {
                        if (child.isMesh) {
                            child.castShadow = true;
                            child.receiveShadow = true;
                        }
                    });
                }
                const bbox = new THREE.Box3().setFromObject(src);
                const sz = new THREE.Vector3();
                bbox.getSize(sz);
                const center = new THREE.Vector3();
                bbox.getCenter(center);
                src.position.sub(center);
                if (sz.x > 0.01 && sz.y > 0.01 && sz.z > 0.01) {
                    src.scale.multiply(new THREE.Vector3(L / sz.x, H / sz.y, W / sz.z));
                }
                src.updateMatrixWorld(true);
                const box2 = new THREE.Box3().setFromObject(src);
                const c2 = new THREE.Vector3();
                box2.getCenter(c2);
                src.position.sub(c2);
                group.add(src);
                return group;
            };

            // Dedicated Realistic V2 (or any keyed CAD) — never stretch another size into this type.
            if (dedicatedProto && isIsoModelFamily) {
                mountDedicatedIsoCad(dedicatedProto, null);
                // Dry / OT / reefer: ensure top twistlock holes sit on ISO 1161 centres (match STS feet)
                if (isStandardDryIso || isReefer || isOpenTop) {
                    stampIsoTopTwistlockHoles(group, L, W, H);
                }
                if (isOpenTop) {
                    addOpenTopOogCargoAndTarp(group, L, W, H);
                }
                if (type === 'flatrack' || type === 'flatrack20') {
                    const deckTopY = measureCadDeckTopY(group, L, W, H, -H / 2 + Math.min(0.60, H * 0.205));
                    addDeckOogCargoOverlay(group, L, W, H, deckTopY);
                }
                if (type === 'platform' || type === 'platform20') {
                    const deckTopY = measureCadDeckTopY(group, L, W, H, H / 2 - 0.01);
                    addDeckOogCargoOverlay(group, L, W, H, deckTopY);
                }
                if (type === 'isotank') {
                    installIsoTankPressureVesselBarrel(group, L, W, H);
                    // CAD frame is often rails-only — restore classic corner X-bracing
                    const braceMat = new THREE.MeshStandardMaterial({
                        color: 0x0369a1, roughness: 0.36, metalness: 0.42, side: THREE.DoubleSide
                    });
                    addIsoTankXBracing(group, L, W, H, braceMat);
                }
                return finishCargoGroup(group);
            }

            // Fallback: 40ft DC CAD for iso40 / HC only when dedicated HC OBJ missing.
            if ((type === 'iso40' || type === 'container_40ft_glb' || type === 'iso40hc')
                && customCargoMeshes && (customCargoMeshes['iso40'] || customCargoMeshes['container_40ft_glb'])) {
                const src40 = customCargoMeshes['iso40'] || customCargoMeshes['container_40ft_glb'];
                const bodyColor = type === 'iso40hc' ? 0x065f46 : 0x881337;
                mountDedicatedIsoCad(src40, src40.userData?.isoRealisticV2 ? null : bodyColor);
                if (type === 'iso40hc' && !src40.userData?.isoRealisticV2) {
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
                return finishCargoGroup(group);
            }

            // Open-top (and only when no dedicated CAD): lengthen 20ft CAD preserving door/front.
            if (!dedicatedProto && type === 'opentop' && customCargoMeshes && customCargoMeshes['container_22g1']) {
                if (buildFrom20ftCadLengthened(group, type, L, W, H)) {
                    return finishCargoGroup(group);
                }
            }

            const protoMesh = dedicatedProto
                || (isTrue20ftDry && customCargoMeshes && customCargoMeshes['container_22g1'])
                || null;

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

                // 2. Fit dims. Shared 22G1 is 20ft-only (never stretch into 40/HC).
                //    Dedicated CAD may axis-fit; shared 20ft uses near-uniform W/H fit.
                if (sz.x > 0.001 && sz.y > 0.001 && sz.z > 0.001 && L > 0 && H > 0 && W > 0) {
                    const sx = L / sz.x;
                    const sy = H / sz.y;
                    const szRate = W / sz.z;
                    const isShared20ftProto = !dedicatedProto && protoMesh === (customCargoMeshes && customCargoMeshes['container_22g1']);
                    if (isShared20ftProto && Math.abs(sx - 1) > 0.12) {
                        // Refuse anisotropic stretch — fall through to procedural ISO shell below.
                    } else {
                        if (isShared20ftProto) {
                            clone.scale.multiplyScalar((sy + szRate) * 0.5);
                        } else {
                            clone.scale.multiply(new THREE.Vector3(sx, sy, szRate));
                        }
                        clone.updateMatrixWorld(true);
                        const postBox = new THREE.Box3().setFromObject(clone);
                        const postCenter = new THREE.Vector3();
                        postBox.getCenter(postCenter);
                        clone.position.sub(postCenter);
                        group.add(clone);

                        const isDedicatedThermoKingModel = protoMesh === customCargoMeshes['reefer'] || protoMesh === customCargoMeshes['reefer_40hc'];
                        if (isReefer && !isDedicatedThermoKingModel && !customCargoMeshes['reefer']) {
                            addReeferMachineryUnit(group, L, W, H);
                        }
                        if (isOpenTop) {
                            addOpenTopTopAssembly(group, L, W, H);
                        }
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
                        return finishCargoGroup(group);
                    }
                } else {
                    clone.updateMatrixWorld(true);
                    group.add(clone);
                    return finishCargoGroup(group);
                }
            }

            // Procedural ISO family — fixed corner castings / posts / corrugation pitch; L only adds ribs.
            if (type === 'iso40' || type === 'iso40hc' || type === 'reefer' || type === 'opentop' || type === 'flatrack' || type === 'isotank' || type === 'platform' || type === 'container_40ft_glb') {
                addIsoFamily(group, type === 'container_40ft_glb' ? 'iso40' : type, L, W, H);
            } else if (type === 'container' || type === 'container_20ft_glb') {
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

            return finishCargoGroup(group);
        }

        // Prefer centralized SafeLift3D i18n (src/i18n); fall back to local pack.
        const I18N = (typeof window !== 'undefined' && window.SafeLift && window.SafeLift.i18n && window.SafeLift.i18n.KEYS)
            ? window.SafeLift.i18n.KEYS
            : {
                vi: {
                    hudHook: 'Tải Móc', hudHookUtil: '% SWL Móc', hudGross: 'Tổng Tải', hudRig: 'Bộ Treo',
                    hudBeta: 'Góc β', hudTf: 'Hệ số TF', hudLeg: '% SWL Cáp', hudMbl: 'MBL Min',
                    hudRadius: 'Bán kính R', hudCog: 'Lệch CoG', hudTilt: 'Nghiêng', hudClear: 'Cách Sàn', hudSpan: 'Nhịp dầm',
                    gearAuto: 'Theo thông số chung', gearCut: 'Cắt cáp', gearRepair: 'Nối lại', gearClear: 'Bỏ chọn',
                    cutTool: 'Cắt',
                    cutToolTitle: 'Kéo cắt cáp: bật rồi bấm vào cáp/xích để cắt đúng chỗ',
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
                    cutTool: 'Cut',
                    cutToolTitle: 'Cable scissors: turn on, then click a rope/chain to cut at that point',
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
            const api = (typeof window !== 'undefined' && window.SafeLift && window.SafeLift.i18n) ? window.SafeLift.i18n : null;
            if (api && typeof api.t === 'function') return api.t(key, state.lang);
            const pack = I18N[state.lang] || I18N.en;
            return pack[key] || key;
        }
        function bi(key) {
            return t(key);
        }
        function L(en, vi) {
            const api = (typeof window !== 'undefined' && window.SafeLift && window.SafeLift.i18n) ? window.SafeLift.i18n : null;
            if (api && typeof api.L === 'function') return api.L(en, vi, state.lang);
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

        /** ISO 1161 / 668 twistlock centre pitch for STS telescopic spreader (ft). */
        function isoTwistlockSpan(ft) {
            const size = Number(ft) || (state.stsSizeFt || 40);
            if (size <= 20) return { spanX: 5.853, spanZ: 2.259, outerL: 6.058, outerW: 2.438, outerH: 2.591, cargoId: 'container' };
            if (size >= 45) return { spanX: 13.557, spanZ: 2.259, outerL: 13.716, outerW: 2.438, outerH: 2.896, cargoId: 'iso40hc' };
            return { spanX: 11.985, spanZ: 2.259, outerL: 12.192, outerW: 2.438, outerH: 2.591, cargoId: 'iso40' };
        }
        if (typeof window !== 'undefined') window.isoTwistlockSpan = isoTwistlockSpan;

        /** Pick STS ft class from cargo outer length so spreader corners match the box. */
        function stsFtFromCargoLength(L) {
            const len = L != null ? L : (state.L || 12.192);
            if (len >= 13.0) return 45;
            if (len >= 9.0) return 40;
            return 20;
        }

        /**
         * Cable hang (and explicit unlink): spreader size is the operator's choice only.
         * Direct + linked: auto-match telescopic size to the box on deck.
         */
        function stsSpreaderSizeIndependent() {
            if (state.stsTwinLift) return false;
            if ((state.stsAttachMode || 'direct') === 'cable') return true;
            return state.stsSizeLinked === false;
        }
        if (typeof window !== 'undefined') window.stsSpreaderSizeIndependent = stsSpreaderSizeIndependent;

        /**
         * Resolve ISO pitch + outer envelope for the STS spreader mesh / pins.
         * Independent (cable or unlinked): never mutate stsSizeFt; yellow + pins follow chosen ft.
         * Linked direct: auto-match ft to cargo, then flush yellow to cargo outer.
         */
        function resolveStsFitToCargo() {
            let ft = Number(state.stsSizeFt) || 40;
            const independent = stsSpreaderSizeIndependent();
            if (!state.stsTwinLift && !independent) {
                const need = stsFtFromCargoLength(state.L);
                // Never keep a shorter telescopic size than the cargo on deck
                if (need > ft) ft = need;
                if (state.L < 9 && ft > 20) ft = 20;
                state.stsSizeFt = ft;
            }
            const iso = isoTwistlockSpan(ft);
            const cargoOuterL = state.L || iso.outerL;
            const cargoOuterW = state.W || iso.outerW;
            const cargoHoles = isoCornerHoleHalf(cargoOuterL, cargoOuterW);
            // Mesh + pin pitch always follow chosen STS class when independent;
            // linked direct keeps yellow flush with the box (ft already matched).
            const outerL = independent ? iso.outerL : cargoOuterL;
            const outerW = independent ? iso.outerW : cargoOuterW;
            const halfX = independent ? (iso.spanX * 0.5) : cargoHoles.hx;
            const halfZ = independent ? (iso.spanZ * 0.5) : cargoHoles.hz;
            return {
                ft,
                iso,
                independent: !!independent,
                outerL,
                outerW,
                halfX,
                halfZ,
                spanX: halfX * 2,
                spanZ: halfZ * 2,
                cargoOuterL,
                cargoOuterW,
                cargoHalfX: cargoHoles.hx,
                cargoHalfZ: cargoHoles.hz
            };
        }
        if (typeof window !== 'undefined') window.resolveStsFitToCargo = resolveStsFitToCargo;

        /**
         * Measure STS CAD main-frame plan size (exclude red flippers/guides) → match
         * container OUTER corners. Names in CAD are often "Flip" / "Guide", not "flipper".
         */
        function measureStsCadFramePlanSpan(root) {
            root.updateMatrixWorld(true);
            const box = new THREE.Box3();
            let any = false;
            root.traverse(o => {
                if (!o.isMesh) return;
                const n = `${o.name || ''} ${o.material?.name || ''}`.toLowerCase();
                // Exclude guide arms / flippers — they sit outside the yellow end beams
                // and would inflate spanZ → under-scale → ngáng hẹp hơn cont.
                if (n.includes('flip') || n.includes('guide')) return;
                if (n.includes('twistlock') || n.includes('pin')) return;
                box.expandByObject(o);
                any = true;
            });
            if (!any || box.isEmpty()) box.setFromObject(root);
            const sz = new THREE.Vector3();
            box.getSize(sz);
            return { spanX: Math.max(0.5, sz.x), spanZ: Math.max(0.5, sz.z) };
        }

        /**
         * Measure STS CAD twistlock pin centres (ISO group / DarkSteel_Twistlock meshes).
         */
        function measureStsCadTwistlockSpan(root) {
            root.updateMatrixWorld(true);
            const centers = [];
            const pushCenter = (obj) => {
                const b = new THREE.Box3().setFromObject(obj);
                if (b.isEmpty()) return;
                const c = new THREE.Vector3();
                b.getCenter(c);
                centers.push(c);
            };
            let twistGroup = null;
            root.traverse(o => {
                const n = (o.name || '').toLowerCase();
                if (n.includes('corner_twistlock') || n.includes('twistlocks_iso') || n === '08_corner_twistlocks_iso') {
                    twistGroup = o;
                }
            });
            if (twistGroup) {
                let meshCount = 0;
                twistGroup.traverse(o => {
                    if (!o.isMesh) return;
                    meshCount += 1;
                    pushCenter(o);
                });
                if (meshCount <= 1) {
                    centers.length = 0;
                    const quads = { pp: [], pm: [], mp: [], mm: [] };
                    const _v = new THREE.Vector3();
                    twistGroup.traverse(o => {
                        if (!o.isMesh || !o.geometry) return;
                        const pos = o.geometry.attributes && o.geometry.attributes.position;
                        if (!pos) return;
                        o.updateMatrixWorld(true);
                        for (let i = 0; i < pos.count; i += Math.max(1, Math.floor(pos.count / 800))) {
                            _v.fromBufferAttribute(pos, i).applyMatrix4(o.matrixWorld);
                            const key = (_v.x >= 0 ? 'p' : 'm') + (_v.z >= 0 ? 'p' : 'm');
                            quads[key].push(_v.clone());
                        }
                    });
                    Object.keys(quads).forEach(k => {
                        const arr = quads[k];
                        if (!arr.length) return;
                        const c = new THREE.Vector3();
                        arr.forEach(p => c.add(p));
                        c.multiplyScalar(1 / arr.length);
                        centers.push(c);
                    });
                }
            }
            if (centers.length < 2) {
                root.traverse(o => {
                    if (!o.isMesh) return;
                    const n = `${o.name || ''} ${o.material?.name || ''}`.toLowerCase();
                    if (n.includes('twistlock')) pushCenter(o);
                });
            }
            if (centers.length < 2) return null;
            let maxX = 0, maxZ = 0;
            centers.forEach(c => {
                maxX = Math.max(maxX, Math.abs(c.x));
                maxZ = Math.max(maxZ, Math.abs(c.z));
            });
            if (maxX < 0.4 || maxZ < 0.4) return null;
            return { spanX: maxX * 2, spanZ: maxZ * 2, centers };
        }

        /** Procedural ISO twistlock feet at exact ±span/2 (guarantees hole alignment). */
        function addIsoTwistlockFeet(parent, halfX, halfZ, yTop, isTwin = false) {
            const steel = MATS.darkSteel || MATS.gunmetal || new THREE.MeshStandardMaterial({ color: 0x374151 });
            const pinMat = steel.clone ? steel.clone() : steel;
            const housingMat = (MATS.spreaderYellow || MATS.yellowHazard || pinMat).clone
                ? (MATS.spreaderYellow || MATS.yellowHazard || pinMat).clone()
                : pinMat;
            const feet = new THREE.Group();
            feet.name = 'ISO_Twistlock_Feet';
            [[1, 1], [-1, 1], [-1, -1], [1, -1]].forEach((s, i) => {
                const g = new THREE.Group();
                g.name = `Twistlock_${i}`;
                g.position.set(s[0] * halfX, yTop, s[1] * halfZ);
                // Housing pad above the pin
                const pad = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.08, 0.16), housingMat);
                pad.position.y = 0.02;
                // Conical / stepped twistlock pin (ISO guide) pointing down into casting
                const pin = new THREE.Mesh(new THREE.CylinderGeometry(0.028, 0.034, 0.12, 12), pinMat);
                pin.position.y = -0.08;
                const tip = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.028, 0.05, 10), pinMat);
                tip.position.y = -0.165;
                g.add(pad, pin, tip);
                feet.add(g);
            });

            if (isTwin) {
                // Add 4 center twin-lift twistlocks accurately seated into the inner corner casting holes of both 20ft containers
                const innerX = 0.1405;
                [[1, 1], [-1, 1], [-1, -1], [1, -1]].forEach((s, i) => {
                    const g = new THREE.Group();
                    g.name = `Twistlock_Twin_Center_${i}`;
                    g.position.set(s[0] * innerX, yTop, s[1] * halfZ);
                    const pad = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.08, 0.16), housingMat);
                    pad.position.y = 0.02;
                    const pin = new THREE.Mesh(new THREE.CylinderGeometry(0.028, 0.034, 0.12, 12), pinMat);
                    pin.position.y = -0.08;
                    const tip = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.028, 0.05, 10), pinMat);
                    tip.position.y = -0.165;
                    g.add(pad, pin, tip);
                    feet.add(g);
                });
            }

            feet.traverse(o => {
                if (!o.isMesh) return;
                o.castShadow = true;
                o.userData.gearKind = 'member';
                o.userData.memberId = 'spreader_main';
                o.userData.memberBody = true;
            });
            parent.add(feet);
            return feet;
        }

        /** STS direct twistlock on roof vs cable/chain legs from spreader pick points. */
        function isStsDirectAttach() {
            return state.beamType === 'container_spreader'
                && (state.stsAttachMode || 'direct') !== 'cable';
        }
        if (typeof window !== 'undefined') window.isStsDirectAttach = isStsDirectAttach;

        /**
         * Cosmetic only: 8 near-vertical headblock falls for STS look.
         * Does NOT touch phy.cables / XPBD — physics stays 4-fall direct or 2+4 cable.
         */
        const STS_HB_VIS_LOCALS = [
            [0.42, 0.48, 0.26], [-0.42, 0.48, 0.26], [-0.42, 0.48, -0.26], [0.42, 0.48, -0.26],
            [0.56, 0.48, 0.14], [-0.56, 0.48, 0.14], [-0.56, 0.48, -0.14], [0.56, 0.48, -0.14]
        ];

        function ensureStsHeadblockVisual() {
            if (phy._stsHbVis && phy._stsHbVis.root && phy._stsHbVis.root.parent) return phy._stsHbVis;
            const root = new THREE.Group();
            root.name = 'STS_HeadblockVisual';
            const blockMat = new THREE.MeshStandardMaterial({
                color: 0x334155, metalness: 0.72, roughness: 0.38
            });
            const ropeMat = new THREE.MeshStandardMaterial({
                color: 0x1e293b, metalness: 0.55, roughness: 0.45
            });
            const block = new THREE.Mesh(new THREE.BoxGeometry(1.35, 0.28, 0.85), blockMat);
            block.castShadow = true;
            root.add(block);
            const ropes = [];
            const ropeGeo = new THREE.CylinderGeometry(0.018, 0.018, 1, 6);
            for (let i = 0; i < 8; i++) {
                const mesh = new THREE.Mesh(ropeGeo, ropeMat);
                mesh.castShadow = true;
                root.add(mesh);
                ropes.push(mesh);
            }
            scene.add(root);
            phy._stsHbVis = { root, block, ropes, ropeGeo };
            return phy._stsHbVis;
        }

        function clearStsHeadblockVisual() {
            const vis = phy._stsHbVis;
            if (!vis || !vis.root) return;
            if (vis.root.parent) vis.root.parent.remove(vis.root);
            vis.ropes.forEach(m => {
                if (m.geometry && m.geometry !== vis.ropeGeo) m.geometry.dispose();
            });
            if (vis.ropeGeo) vis.ropeGeo.dispose();
            if (vis.block && vis.block.geometry) vis.block.geometry.dispose();
            phy._stsHbVis = null;
        }

        function updateStsHeadblockVisual() {
            if (state.beamType !== 'container_spreader') {
                if (phy._stsHbVis && phy._stsHbVis.root) phy._stsHbVis.root.visible = false;
                return;
            }
            const b = (phy.beams || [])[0];
            if (!b || !b.x) {
                if (phy._stsHbVis && phy._stsHbVis.root) phy._stsHbVis.root.visible = false;
                return;
            }
            const vis = ensureStsHeadblockVisual();
            vis.root.visible = true;
            if (typeof RIG !== 'undefined' && RIG.syncStsHeadblockHoistRopes) {
                RIG.syncStsHeadblockHoistRopes(vis, b.x, b.q, phy.hookPos, STS_HB_VIS_LOCALS);
                return;
            }
            const q = b.q || new THREE.Quaternion();
            const hbLocal = new THREE.Vector3(0, 0.92, 0);
            const hbWorld = hbLocal.applyQuaternion(q).add(b.x);
            vis.block.position.copy(hbWorld);
            vis.block.quaternion.copy(q);
        }
        if (typeof window !== 'undefined') {
            window.updateStsHeadblockVisual = updateStsHeadblockVisual;
            window.clearStsHeadblockVisual = clearStsHeadblockVisual;
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
            if (state.beamType === 'spreader') return { spanX: gap(memberSpec('main')), spanZ: base.spanZ };
            if (state.beamType === 'lifting_beam') {
                const mainGap = gap(memberSpec('main'));
                if (typeof RIG !== 'undefined' && RIG.resolveHBeamCorners) {
                    const hb = RIG.resolveHBeamCorners(mainGap, base.spanZ, state, state.liftingBeamBottomMode || 'cable');
                    return { spanX: hb.spanX, spanZ: hb.spanZ };
                }
                return { spanX: mainGap, spanZ: base.spanZ };
            }
            if (state.beamType === 'cascaded' || state.beamType === 'modular_truss') {
                const top = memberSpec(state.beamType === 'modular_truss' ? 'truss' : 'top');
                const z = Math.max(gap(memberSpec('lowPlus')), gap(memberSpec('lowMinus')));
                return { spanX: gap(top), spanZ: z };
            }
            if (state.beamType === 'container_spreader') {
                const fit = typeof resolveStsFitToCargo === 'function'
                    ? resolveStsFitToCargo()
                    : isoTwistlockSpan(state.stsSizeFt || 40);
                return { spanX: fit.spanX || fit.iso?.spanX || 11.985, spanZ: fit.spanZ || fit.iso?.spanZ || 2.259 };
            }
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
        let _massBreakdownCache = null;
        let _massBreakdownDirty = true;
        function markMassBreakdownDirty() {
            _massBreakdownDirty = true;
            _massBreakdownCache = null;
        }
        if (typeof window !== 'undefined') window.markMassBreakdownDirty = markMassBreakdownDirty;

        function computeRiggingMassBreakdown() {
            if (!_massBreakdownDirty && _massBreakdownCache) return _massBreakdownCache;
            const slingMassKg = (item, lenM) => {
                if (item && item.massKg != null && item.massKg > 0) return item.massKg;
                let look = typeof effectiveSlingType === 'function'
                    ? effectiveSlingType(item)
                    : (state.slingType || (item && item.slingType) || 'wire');

                const parts = Math.max(1, Math.min(4, (item && item.parts) || 1));
                const d = Math.max(8, (item && item.diaMm) || (look === 'web' || look === 'round_sling' ? 60 : 20));
                const L = Math.max(0.4, lenM || 2.5);
                const swl = (item && item.swlT) || state.wllPerLeg || 15.0;
                const grade = (item && item.grade) || '';

                const getSpec = (typeof CAE !== 'undefined' && CAE.getSlingPhysicalSpec)
                    || (typeof window !== 'undefined' && window.CAE && window.CAE.getSlingPhysicalSpec);
                if (getSpec) {
                    const spec = getSpec(look, swl, d, grade);
                    if (spec && typeof spec.computeMassKg === 'function') {
                        return spec.computeMassKg(L, parts);
                    }
                }

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
            _massBreakdownCache = phy.massBreakdown;
            _massBreakdownDirty = false;
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
            // Collar sits on the pipe face (pipe ends ~0.30 m inboard of lug center)
            const flange = new THREE.Mesh(new THREE.CylinderGeometry(od * 0.72, od * 0.72, 0.032, 24), MATS.darkSteel);
            flange.rotation.z = Math.PI / 2;
            flange.position.set(x - outward * 0.30, y, 0);
            flange.userData.gearKind = 'member';
            flange.userData.memberId = memberId;
            flange.userData.memberBody = true;
            flange.castShadow = true;
            spreaderRootGroup.add(flange);

            // Taper sleeve overlaps pipe OD → drop-box (continuous steel, no floating end)
            const taper = new THREE.Mesh(new THREE.CylinderGeometry(od * 0.42, od * 0.58, 0.32, 20), MATS.yellowHazard);
            taper.rotation.z = Math.PI / 2;
            taper.position.set(x - outward * 0.16, y, 0);
            tagMember(taper, memberId);

            // End drop box head
            const dropBox = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.26, twinLowerEars ? 0.22 : 0.14), MATS.yellowHazard);
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

        // Coalesce rapid OD/length/type tweaks into one mesh rebuild (keeps 1080p UI responsive)
        let _spreaderRebuildTimer = null;
        function scheduleRebuildSpreaderVisuals(delayMs) {
            const ms = delayMs == null ? 90 : delayMs;
            if (_spreaderRebuildTimer) clearTimeout(_spreaderRebuildTimer);
            _spreaderRebuildTimer = setTimeout(() => {
                _spreaderRebuildTimer = null;
                rebuildSpreaderVisuals();
            }, ms);
        }
        function flushRebuildSpreaderVisuals() {
            if (_spreaderRebuildTimer) {
                clearTimeout(_spreaderRebuildTimer);
                _spreaderRebuildTimer = null;
                rebuildSpreaderVisuals();
            }
        }
        if (typeof window !== 'undefined') {
            window.scheduleRebuildSpreaderVisuals = scheduleRebuildSpreaderVisuals;
            window.flushRebuildSpreaderVisuals = flushRebuildSpreaderVisuals;
        }

        function markRenderPerfBurst(ms) {
            if (!state.renderPerf) state.renderPerf = { level: 2, emaMs: 16.7, burstUntil: 0 };
            state.renderPerf.burstUntil = (typeof performance !== 'undefined' ? performance.now() : Date.now()) + (ms || 1600);
            state.renderPerf.level = 0;
            // Invalidate sling geometry caches so first frame after rebuild redraws seating
            if (Array.isArray(sling3DPool)) {
                sling3DPool.forEach(s => {
                    s._cacheA = null;
                    s._cacheB = null;
                    s._cacheLen = null;
                    s._cacheTaut = null;
                });
            }
        }
        if (typeof window !== 'undefined') window.markRenderPerfBurst = markRenderPerfBurst;

        function rebuildSpreaderVisuals() {
            if (_spreaderRebuildTimer) {
                clearTimeout(_spreaderRebuildTimer);
                _spreaderRebuildTimer = null;
            }
            if (typeof markMassBreakdownDirty === 'function') markMassBreakdownDirty();
            markRenderPerfBurst(1800);
            disposeBeamGroups();
            jointLinks.length = 0;
            while (spreaderRootGroup.children.length > 0) spreaderRootGroup.remove(spreaderRootGroup.children[0]);

            const { beamType } = state;
            if (typeof ensureBeamPortAsset === 'function') {
                ensureBeamPortAsset(beamType, state.stsSizeFt, state.stsTwinLift);
            }
            const { spanX, spanZ } = getLPBoundingSpan();
            if (beamType !== 'container_spreader' && phy._stsHbVis && phy._stsHbVis.root) {
                phy._stsHbVis.root.visible = false;
            }

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
                // Yellow body + pins follow chosen STS ISO class (20/40/45/twin).
                // Linked direct: resolveStsFitToCargo already matched ft → cargo outer.
                // Cable / unlinked: mesh stays at user stsSizeFt even if box is another size.
                const fit = resolveStsFitToCargo();
                const { outerL, outerW, halfX, halfZ, ft, iso } = fit;
                const halfOuterX = outerL * 0.5;
                const halfOuterZ = outerW * 0.5;
                const targetOuterL = (iso && iso.outerL) || outerL;
                const targetOuterW = (iso && iso.outerW) || outerW;
                const targetSpanX = (iso && iso.spanX) || (halfX * 2);
                const targetSpanZ = (iso && iso.spanZ) || (halfZ * 2);

                // Beam pitch = selected STS twistlock centres (not cargo footprint when independent)
                if (state.gear && state.gear.beam) {
                    state.gear.beam.lengthM = targetSpanX;
                    state.gear.beam.widthM = targetSpanZ;
                }

                const stsKey = state.stsTwinLift
                    ? 'sts_spreader_twin'
                    : (ft <= 20 ? 'sts_spreader_20' : (ft >= 45 ? 'sts_spreader_45' : 'sts_spreader_40'));
                const stsCad = customBeamMeshes && customBeamMeshes[stsKey];

                if (stsCad) {
                    const cad = stsCad.clone(true);
                    if (typeof RIG !== 'undefined' && RIG.calibrateStsCadToIsoEnvelope) {
                        RIG.calibrateStsCadToIsoEnvelope(cad, {
                            outerLength: targetOuterL,
                            outerWidth: targetOuterW,
                            endBeamBottomY: -0.34
                        });
                    } else {
                        cad.updateMatrixWorld(true);
                        const box = new THREE.Box3().setFromObject(cad);
                        const sz = new THREE.Vector3(), c = new THREE.Vector3();
                        box.getSize(sz); box.getCenter(c);
                        cad.position.sub(c);
                        cad.scale.set(targetOuterL / Math.max(0.5, sz.x), 1, targetOuterW / Math.max(0.5, sz.z));
                    }

                    // Hide CAD twistlocks — procedural feet sit on exact ISO hole centres
                    cad.traverse(o => {
                        const n = `${o.name || ''} ${o.material?.name || ''}`.toLowerCase();
                        if (n.includes('twistlock')) {
                            o.visible = false;
                            return;
                        }
                        if (!o.isMesh) return;
                        o.castShadow = true;
                        o.receiveShadow = true;
                        o.userData.gearKind = 'member';
                        o.userData.memberId = 'spreader_main';
                        o.userData.memberBody = true;
                    });

                    // Calibration for STS Twin-Lift center mechanism: ensure twin center modules align with container corners (X = ±0.1405m)
                    if (state.stsTwinLift) {
                        cad.traverse(child => {
                            if (!child.isMesh || !child.geometry) return;
                            const n = (child.name || '').toLowerCase();
                            if (n.includes('twinlift_center_module')) {
                                const pos = child.geometry.attributes.position;
                                if (pos && !child.userData._twinFitted) {
                                    let needsShift = false;
                                    for (let i = 0; i < pos.count; i++) {
                                        const x = pos.getX(i);
                                        if (x < -0.28 && x > -0.6) { needsShift = true; break; }
                                    }
                                    if (needsShift) {
                                        for (let i = 0; i < pos.count; i++) {
                                            const x = pos.getX(i);
                                            if (x < -0.22 && x > -0.6) pos.setX(i, x + 0.1995);
                                            else if (x > 0.22 && x < 0.6) pos.setX(i, x - 0.1995);
                                        }
                                        pos.needsUpdate = true;
                                        child.geometry.computeBoundingBox();
                                    }
                                    child.userData._twinFitted = true;
                                }
                            }
                        });
                    }

                    const box3 = new THREE.Box3().setFromObject(cad);
                    cad.position.y -= (box3.min.y + 0.34);

                    cad.userData.gearKind = 'member';
                    cad.userData.memberId = 'spreader_main';
                    cad.userData.memberBody = true;
                    spreaderRootGroup.add(cad);
                } else {
                    const yellow = MATS.spreaderYellow || MATS.yellowHazard;
                    const bar = new THREE.Mesh(new THREE.BoxGeometry(outerL * 0.52, 0.55, 0.85), yellow);
                    bar.userData.gearKind = 'member';
                    bar.userData.memberId = 'spreader_main';
                    bar.userData.memberBody = true;
                    spreaderRootGroup.add(bar);
                    [-1, 1].forEach(sx => {
                        const end = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.5, outerW), yellow);
                        // End beams span full container width — corners = cont corners
                        end.position.set(sx * (halfOuterX - 0.22), 0, 0);
                        end.userData.gearKind = 'member';
                        end.userData.memberId = sx > 0 ? 'endPlus' : 'endMinus';
                        end.userData.memberBody = true;
                        spreaderRootGroup.add(end);
                    });
                    if (state.stsTwinLift) {
                        [-1, 1].forEach(sx => {
                            const midBlock = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.45, outerW), yellow);
                            midBlock.position.set(sx * 0.1405, -0.05, 0);
                            midBlock.userData.gearKind = 'member';
                            midBlock.userData.memberId = sx > 0 ? 'twinCenterPlus' : 'twinCenterMinus';
                            midBlock.userData.memberBody = true;
                            spreaderRootGroup.add(midBlock);
                        });
                    }
                }

                // Corner locator pads: guarantee yellow reaches exactly ±outer/2 even if CAD drifts
                {
                    const yellow = MATS.spreaderYellow || MATS.yellowHazard;
                    const pads = new THREE.Group();
                    pads.name = 'STS_OuterCornerPads';
                    [[1, 1], [-1, 1], [-1, -1], [1, -1]].forEach((s, i) => {
                        const pad = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.10, 0.22), yellow);
                        pad.position.set(s[0] * (halfOuterX - 0.11), -0.18, s[1] * (halfOuterZ - 0.11));
                        pad.userData.gearKind = 'member';
                        pad.userData.memberId = 'spreader_main';
                        pad.userData.memberBody = true;
                        pad.name = `OuterCorner_${i}`;
                        pads.add(pad);
                    });
                    spreaderRootGroup.add(pads);
                }

                // Twistlock feet follow selected STS pitch (visual telescopic size).
                addIsoTwistlockFeet(spreaderRootGroup, halfX, halfZ, -0.22, state.stsTwinLift);

                // Cable hang: shackle / leg pick points sit above CARGO corner holes so the
                // four legs hang near-vertical (normal hoist). Angled 40→20 outer-corner
                // hang caused endless sway + Zone-3 snaps. Mesh may still be a longer STS.
                const cableHang = typeof isStsDirectAttach === 'function'
                    ? !isStsDirectAttach()
                    : (state.stsAttachMode || 'direct') === 'cable';
                const hangX = cableHang
                    ? (fit.cargoHalfX != null ? fit.cargoHalfX : halfX)
                    : halfX;
                const hangZ = cableHang
                    ? (fit.cargoHalfZ != null ? fit.cargoHalfZ : halfZ)
                    : halfZ;

                addPickMark(hangX, 0, hangZ, 'corner0');
                addPickMark(-hangX, 0, hangZ, 'corner1');
                addPickMark(-hangX, 0, -hangZ, 'corner2');
                addPickMark(hangX, 0, -hangZ, 'corner3');

                if (cableHang) {
                    [
                        [hangX, hangZ, 0], [-hangX, hangZ, 1],
                        [-hangX, -hangZ, 2], [hangX, -hangZ, 3]
                    ].forEach(row => {
                        addJointShackle(row[0], -0.28, row[1], 'spreader_main', { role: 'leg', index: row[2] });
                    });
                }

            } else if (beamType === 'spreader') {
                // MODULIFT MODULAR TUBULAR COMPRESSION SPREADER STRUT
                const main = memberSpec('main');
                const od = memberDiameter('main');
                // End fittings ~0.30 m each side; pipe must overlap taper so no air gap
                const endInset = 0.30;
                const spanAB = Math.abs(main.a - main.b);
                const coreLen = Math.max(0.3, spanAB - endInset * 2);
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
                const main = memberSpec('main');
                const topMode = state.liftingBeamTopMode || 'bridle2';
                const bottomMode = state.liftingBeamBottomMode || 'cable';
                if (typeof RIG !== 'undefined' && RIG.buildHStyleLiftingBeamMeshes) {
                    RIG.buildHStyleLiftingBeamMeshes({
                        group: spreaderRootGroup,
                        yellowMat: MATS.yellowHazard,
                        darkMat: MATS.darkSteel,
                        spanX: main.length,
                        spanZ,
                        cargoDims: state,
                        topMode,
                        bottomMode,
                        tagMesh: tagMember,
                        addLug: addLugPlate,
                        addPick: addPickMark,
                        addShackle: addJointShackle,
                        addTwistlockFeet: addIsoTwistlockFeet
                    });
                } else {
                    const web = new THREE.Mesh(new THREE.BoxGeometry(main.length, 0.274, 0.028, 32, 1, 1));
                    tagMember(web, 'main');
                }

            } else if (beamType === 'cascaded' || beamType === 'modular_truss') {
                const topId = beamType === 'modular_truss' ? 'truss' : 'top';
                const top = memberSpec(topId);
                // Must match physics beamRecipe yTop (pin-to-pin hanger = hangerSlingLength)
                const yTop = (typeof cascadedTopOffsetY === 'function')
                    ? cascadedTopOffsetY()
                    : Math.max(beamType === 'modular_truss' ? 1.25 : 1.40, (state.hangerSlingLength || 2) + 0.40);
                if (beamType === 'modular_truss') {
                    const trussMat = (MATS.yellowHazard && MATS.yellowHazard.clone)
                        ? MATS.yellowHazard.clone()
                        : MATS.yellowHazard;
                    if (trussMat && trussMat.metalness != null) {
                        trussMat.metalness = 0.55;
                        trussMat.roughness = 0.38;
                    }
                    const truss = createLatticeBoomMesh(top.length, 0.52, trussMat);
                    truss.rotation.z = -Math.PI / 2;
                    truss.position.set(-top.length / 2, yTop, 0);
                    truss.userData.memberId = topId;
                    truss.userData.gearKind = 'member';
                    truss.traverse(o => {
                        if (o.isMesh) {
                            o.userData.gearKind = 'member';
                            o.userData.memberId = topId;
                            o.userData.memberBody = true;
                            o.castShadow = true;
                            o.receiveShadow = true;
                        }
                    });
                    if (typeof applyCADFeatureEdges === 'function') applyCADFeatureEdges(truss, false);
                    spreaderRootGroup.add(truss);
                } else {
                    const od = memberDiameter(topId);
                    const endInset = 0.30;
                    const coreLen = Math.max(0.3, Math.abs(top.a - top.b) - endInset * 2);
                    const mainPipe = new THREE.Mesh(new THREE.CylinderGeometry(od / 2, od / 2, coreLen, 24));
                    mainPipe.rotation.z = Math.PI / 2;
                    mainPipe.position.set((top.a + top.b) * 0.5, yTop, 0);
                    tagMember(mainPipe, topId);
                    dressTubularStrut(coreLen, yTop, 'x', topId);
                }
                addModuliftEnd(top.a, yTop, topId, top.a >= 0 ? 1 : -1, false);
                addModuliftEnd(top.b, yTop, topId, top.b >= 0 ? 1 : -1, false);

                // 2-4-4 visuals: each sub-beam gets TWO hangers to its two ends (V), never a centre drop
                [
                    { spec: memberSpec('lowPlus'), x: top.a, hA: 0, hB: 1 },
                    { spec: memberSpec('lowMinus'), x: top.b, hA: 2, hB: 3 }
                ].forEach(({ spec, x, hA, hB }) => {
                    const sod = Math.max(0.08, memberDiameter(spec.id));
                    const sub = new THREE.Mesh(new THREE.CylinderGeometry(sod / 2, sod / 2, spec.length, 22));
                    sub.rotation.x = Math.PI / 2;
                    sub.position.set(x, 0, 0);
                    tagMember(sub, spec.id);
                    dressTubularStrut(spec.length, 0, 'z', spec.id, x, 0);
                    // Top eyes of sub-beam at BOTH ends (hanger landing) + underside leg eyes
                    addLugPlate(x,  0.18, spec.a, spec.id, true);
                    addLugPlate(x,  0.18, spec.b, spec.id, true);
                    addLugPlate(x, -0.18, spec.a, spec.id, true);
                    addLugPlate(x, -0.18, spec.b, spec.id, true);
                    const upperIndex = x >= 0 ? 1 : 0;
                    const legPos = x >= 0 ? 0 : 1;
                    const legNeg = x >= 0 ? 3 : 2;
                    addJointShackle(x, yTop + 0.22, 0, topId, { role: 'upper', index: upperIndex });
                    // Twin drop from main-beam end fitting
                    addJointShackle(x, yTop - 0.22,  0.06, topId, { role: 'hanger', index: hA });
                    addJointShackle(x, yTop - 0.22, -0.06, topId, { role: 'hanger', index: hB });
                    addJointShackle(x, 0.18, spec.a, spec.id, { role: 'hangerB', index: hA });
                    addJointShackle(x, 0.18, spec.b, spec.id, { role: 'hangerB', index: hB });
                    addJointShackle(x, -0.18, spec.a, spec.id, { role: 'leg', index: legPos });
                    addJointShackle(x, -0.18, spec.b, spec.id, { role: 'leg', index: legNeg });
                    // Placeholder V stubs (stripped by mountBeamBodies; XPBD draws live cables)
                    const hangerLen = Math.max(0.35, (typeof cascadedTopOffsetY === 'function'
                        ? (state.hangerSlingLength || 2.0)
                        : (yTop - 0.40)));
                    [spec.a, spec.b].forEach((zEnd, i) => {
                        const stub = new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.016, hangerLen, 8), MATS.wireRope);
                        stub.position.set(x, 0.18 + hangerLen * 0.5, zEnd * 0.15);
                        stub.userData.isHanger = true;
                        stub.userData.gearKind = 'member';
                        stub.userData.memberId = spec.id;
                        stub.userData.hangerIndex = i === 0 ? hA : hB;
                        spreaderRootGroup.add(stub);
                    });
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

