/**
 * cargo/shell_rebuild — shell contact, pad-eyes, rebuildCargoAndRig
 * Split from legacy god-file (strangler Phase 2). Shared scope via assemble.
 */
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
            // Outer-to-inner scan (8 down to 3) prioritizing corner lift anchors; breaks early on solid hits
            outerScan:
            for (let a = 8; a >= 3; a--) {
                for (let b = 8; b >= 3; b--) {
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
                    if (stable && candidates.filter(c => c.stable).length >= 5) break outerScan;
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
            const wantN = Math.max(2, Math.min(8, state.planLugCount || state.lugs.length || 4));
            while (state.lugs.length < wantN) state.lugs.push(new THREE.Vector3());
            state.lugs.length = wantN;
            while (state.lugNormals.length < state.lugs.length) state.lugNormals.push(new THREE.Vector3(0, 1, 0));
            state.lugNormals.length = state.lugs.length;
            const { lugElevPreset, cargoType, L, W, H } = state;
            const signs = [[1, 1], [-1, 1], [-1, -1], [1, -1]];

            // 2-leg: longitudinal pair only
            if (wantN === 2) {
                const ly = lugElevPreset === 'bottom' ? (-H / 2 + 0.12)
                    : (lugElevPreset === 'mid' ? 0 : (H / 2 - 0.08));
                state.lugs[0].set(L / 2 - 0.25, ly, 0);
                state.lugs[1].set(-(L / 2 - 0.25), ly, 0);
                state.lugNormals[0].set(0, lugElevPreset === 'bottom' ? -1 : 1, 0);
                state.lugNormals[1].set(0, lugElevPreset === 'bottom' ? -1 : 1, 0);
                return;
            }

            const isoTypes = [
                'opentop', 'opentop40', 'flatrack', 'flatrack20', 'isotank',
                'container', 'container_20ft_glb', 'iso20hc', 'iso40', 'container_40ft_glb',
                'iso40hc', 'iso45hc', 'container10', 'iso53hc',
                'reefer', 'reefer20', 'platform', 'platform20', 'halfheight', 'drybulk'
            ];

            if (customCargoMeshes && customCargoMeshes[cargoType] && !isoTypes.includes(cargoType)) {
                if (cargoType === 'car') {
                    const ly = lugElevPreset === 'bottom' ? (-H / 2 + 0.16)
                        : (lugElevPreset === 'mid' ? (-H * 0.08) : (H / 2 - 0.08));
                    for (let i = 0; i < Math.min(4, wantN); i++) {
                        state.lugs[i].set(signs[i][0] * (L * 0.38), ly, signs[i][1] * (W * 0.52));
                        state.lugNormals[i].set(0, lugElevPreset === 'bottom' ? -1 : 1, 0);
                    }
                    return;
                }
                const ly = lugElevPreset === 'bottom' ? -H / 2 + 0.12 : (lugElevPreset === 'mid' ? 0 : H / 2 - 0.05);
                for (let i = 0; i < Math.min(4, wantN); i++) {
                    state.lugs[i].set(signs[i][0] * (L / 2 - 0.18), ly, signs[i][1] * (W / 2 - 0.14));
                    state.lugNormals[i].set(0, 1, 0);
                }
                return;
            }

            if (isoTypes.includes(cargoType) && lugElevPreset !== 'mid') {
                const topY = (cargoType === 'platform' || cargoType === 'platform20')
                    ? (-H / 2 + Math.min(H * 0.24, 0.36))
                    : (H / 2);
                const ly = lugElevPreset === 'bottom' ? (-H / 2 + 0.08) : topY;
                const ny = lugElevPreset === 'bottom' ? -1 : 1;
                // STS / ISO boxes: lug points = corner casting hole centres (match spreader feet)
                const useIsoHoles = (state.beamType === 'container_spreader' || isoTypes.includes(cargoType))
                    && lugElevPreset !== 'bottom';
                const holes = useIsoHoles ? isoCornerHoleHalf(L, W) : null;
                const hx = holes ? holes.hx : (L / 2 - 0.09);
                const hz = holes ? holes.hz : (W / 2 - 0.09);
                for (let i = 0; i < 4; i++) {
                    state.lugs[i].set(signs[i][0] * hx, ly, signs[i][1] * hz);
                    state.lugNormals[i].set(0, ny, 0);
                }
                return;
            }
            if (cargoType === 'car' || cargoType === 'boat') {
                // Vehicle: chassis mounts just outside the body flanks so lower legs wrap the exterior
                const ly = cargoType === 'car'
                    ? (lugElevPreset === 'bottom' ? (-H / 2 + 0.16) : (lugElevPreset === 'mid' ? (-H * 0.08) : (H / 2 - 0.08)))
                    : (-H * 0.42);
                const lx = cargoType === 'car' ? (L * 0.38) : (L * 0.25);
                const lz = cargoType === 'car' ? (W * 0.52) : (W * 0.46);
                for (let i = 0; i < 4; i++) {
                    state.lugs[i].set(signs[i][0] * lx, ly, signs[i][1] * lz);
                    state.lugNormals[i].set(0, lugElevPreset === 'bottom' ? -1 : 1, 0);
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

        /** Twin-lift: two ISO 20ft dry vans end-to-end under a 40ft twin STS spreader.
         *  Separate meshes (not one fused hull) so cable-mode can pry the junction open —
         *  STS mid-beam centres are twistlock seats only, not cable eyes. */
        function buildStsTwinTwentyVisual(H) {
            const group = new THREE.Group();
            group.name = 'ISO_Twin_20ft_Pair';
            const cL = 6.058;
            const cW = 2.438;
            const cH = H || 2.591;
            const gap = 0.076; // quay cell gap between ends
            const halfSep = (cL + gap) * 0.5;
            [-1, 1].forEach((sx, idx) => {
                const box = buildCargoMesh('container', cL, cW, cH);
                box.position.set(sx * halfSep, 0, 0);
                box.name = idx === 0 ? 'Twin_20ft_A' : 'Twin_20ft_B';
                box.userData.twinHalf = idx === 0 ? 'A' : 'B';
                box.userData.twinRestX = sx * halfSep;
                // Clone + tint body panels so the pair reads as two distinct units
                box.traverse(o => {
                    if (!o.isMesh || !o.material) return;
                    const src = Array.isArray(o.material) ? o.material : [o.material];
                    const cloned = src.map(m => {
                        if (!m || !m.clone) return m;
                        const mm = m.clone();
                        if (mm.color && typeof mm.color.getHex === 'function') {
                            const hex = mm.color.getHex();
                            if (hex > 0x222222 && hex < 0xe8e8e8) {
                                if (idx === 0) mm.color.offsetHSL(0.02, 0.06, -0.05);
                                else mm.color.offsetHSL(-0.05, 0.08, 0.03);
                            }
                        }
                        return mm;
                    });
                    o.material = Array.isArray(o.material) ? cloned : cloned[0];
                });
                group.add(box);
            });
            return group;
        }
        if (typeof window !== 'undefined') window.buildStsTwinTwentyVisual = buildStsTwinTwentyVisual;

        // Visual cache for instant model switching (0ms stutter, eliminates geometry churn)
        const cargoMeshCache = new Map();
        const MAX_CARGO_CACHE_SIZE = 24;

        function rebuildCargoAndRig(resetSymmetricLugs = false) {
            const { cargoType, L, W, H, hwType, cogX, cogY, cogZ } = state;
            const twinLift = !!(state.stsTwinLift && state.beamType === 'container_spreader');
            // New cargo / size = new home pad reference once seated again
            if (typeof invalidateContainerHomePad === 'function') invalidateContainerHomePad();

            const oogKey = (cargoType === 'opentop' || cargoType === 'opentop40'
                || cargoType === 'flatrack' || cargoType === 'flatrack20'
                || cargoType === 'platform' || cargoType === 'platform20')
                ? `|${state.oogHasCargo ? 1 : 0}|${state.oogTarp ? 1 : 0}|${(state.oogOh || 0).toFixed(2)}|${(state.oogOwL || 0).toFixed(2)}|${(state.oogOwR || 0).toFixed(2)}|${(state.oogOlF || 0).toFixed(2)}|${(state.oogOlR || 0).toFixed(2)}|${(state.oogCargoL || 0).toFixed(2)}|${(state.oogCargoW || 0).toFixed(2)}|${(state.oogCargoH || 0).toFixed(2)}`
                : '';
            // Include custom OBJ readiness so late-loaded prototypes (e.g. bus.obj / Realistic V2) force a visual rebuild
            const hasOwnCad = !!(customCargoMeshes && customCargoMeshes[cargoType]);
            const has40Cad = !!(customCargoMeshes && (customCargoMeshes['iso40'] || customCargoMeshes['container_40ft_glb']));
            const has22g1 = !!(customCargoMeshes && customCargoMeshes['container_22g1']);
            const uses40Cad = (cargoType === 'iso40' || cargoType === 'container_40ft_glb' || cargoType === 'iso40hc');
            const lengthensFrom20 = (cargoType === 'opentop' && !hasOwnCad);
            const protoKey = hasOwnCad ? '|cad'
                : (uses40Cad && has40Cad ? '|cad40'
                    : (lengthensFrom20 && has22g1 ? '|cad20L' : '|proc'));
            const meshKey = cargoType + '|' + L.toFixed(3) + '|' + W.toFixed(3) + '|' + H.toFixed(3)
                + '|' + (state.xrayCargo ? 'x' : 's') + oogKey + protoKey
                + (twinLift ? '|twin20' : '');
            if (!activeCargoVisual || activeCargoVisual.userData.meshKey !== meshKey) {
                if (activeCargoVisual) cargoRootGroup.remove(activeCargoVisual);
                const scars = cargoRootGroup.children.filter(ch => ch.name === 'impactScar');
                scars.forEach(ch => cargoRootGroup.remove(ch));

                if (cargoMeshCache.has(meshKey)) {
                    // Instantaneous switch from memory cache (0ms lag, no geometry churn)
                    activeCargoVisual = cargoMeshCache.get(meshKey);
                    cargoRootGroup.add(activeCargoVisual);
                    cargoMeshCache.delete(meshKey);
                    cargoMeshCache.set(meshKey, activeCargoVisual);
                } else {
                    activeCargoVisual = twinLift
                        ? buildStsTwinTwentyVisual(H || 2.591)
                        : buildCargoMesh(cargoType, L, W, H);
                    activeCargoVisual.userData.meshKey = meshKey;
                    // Keep authored MTL / CAD materials on Realistic V2 containers, reefers, vehicles
                    const cadProto = customCargoMeshes && customCargoMeshes[cargoType];
                    const keepCadMaterials = !!(cadProto && (
                        cargoType === 'car'
                        || cadProto.userData?.keepMaterials
                        || cadProto.userData?.isoRealisticV2
                    ));
                    if (pbrFactory && !keepCadMaterials) pbrFactory.enforcePBRMaterials(activeCargoVisual);
                    if (state.xrayCargo) applyXRayToCargo(activeCargoVisual, true);
                    if (typeof applyCADFeatureEdges === 'function' && !activeCargoVisual.userData?._cadEdgesApplied) {
                        applyCADFeatureEdges(activeCargoVisual, false);
                        activeCargoVisual.userData._cadEdgesApplied = true;
                    }
                    cargoRootGroup.add(activeCargoVisual);

                    if (cargoMeshCache.size >= MAX_CARGO_CACHE_SIZE) {
                        const oldestKey = cargoMeshCache.keys().next().value;
                        cargoMeshCache.delete(oldestKey);
                    }
                    cargoMeshCache.set(meshKey, activeCargoVisual);
                }

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

            const hasExactMountPreset = [
                'opentop', 'opentop40', 'flatrack', 'flatrack20', 'isotank',
                'container', 'container_20ft_glb', 'iso20hc', 'iso40', 'container_40ft_glb',
                'iso40hc', 'iso45hc', 'container10', 'iso53hc',
                'reefer', 'reefer20', 'platform', 'platform20', 'halfheight', 'drybulk',
                'car', 'boat'
            ].includes(cargoType) && state.lugElevPreset !== 'mid';
            if (placeRigLugs()) {
                // Exact CAD anchors already placed; only conform if explicit mid-elevation requested
                if (state.lugElevPreset === 'mid') {
                    for (let i = 0; i < state.lugs.length; i++) conformLugToShell(i, 'mid');
                }
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
            // STS direct twistlock: no pad-eyes / shackles on container corners — pins lock into ISO castings.
            const stsDirectHideLp = typeof isStsDirectAttach === 'function' && isStsDirectAttach();
            for (let i = 0; i < padEyeMeshes.length; i++) {
                const on = i < state.lugs.length && !stsDirectHideLp;
                padEyeMeshes[i].visible = on;
                if (hwMeshes[i]) hwMeshes[i].visible = on;
                if (!on && forceArrows[i]) forceArrows[i].visible = false;
            }

            rebuildSpreaderVisuals();
            syncLPSlidersFromState();
            draw2DFootprintMap();

            document.getElementById('lbl-vol').textContent = (L * W * H).toFixed(1) + ' m³';
        }
