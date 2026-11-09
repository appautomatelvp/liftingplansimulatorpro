/**
 * physics — part of the lifting simulator.
 * These files are assembled into one module so they share state, physics and the scene.
 */
        // --- 7. INTERACTIVE 2D TOP-DOWN FOOTPRINT MAP (LP1-LP4 & CoG) ---
        function draw2DFootprintMap() {
            const canvas = document.getElementById('cog-map-canvas');
            if (!canvas) return;
            const ctx = canvas.getContext('2d');
            const cw = canvas.width, ch = canvas.height;
            ctx.clearRect(0, 0, cw, ch);

            const { L, W, cogX, cogZ, lugs } = state;
            const scaleX = (cw - 20) / L;
            const scaleZ = (ch - 18) / W;
            const sc = Math.min(scaleX, scaleZ);

            const cx = cw / 2, cz = ch / 2;

            // Cargo Footprint Box
            const rw = L * sc, rh = W * sc;
            ctx.fillStyle = 'rgba(2, 132, 199, 0.22)';
            ctx.strokeStyle = '#38bdf8';
            ctx.lineWidth = 1.5;
            ctx.fillRect(cx - rw / 2, cz - rh / 2, rw, rh);
            ctx.strokeRect(cx - rw / 2, cz - rh / 2, rw, rh);

            // Center Crosshair
            ctx.strokeStyle = 'rgba(148, 163, 184, 0.35)';
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(cx - rw / 2, cz); ctx.lineTo(cx + rw / 2, cz);
            ctx.moveTo(cx, cz - rh / 2); ctx.lineTo(cx, cz + rh / 2);
            ctx.stroke();

            // Polygon connecting LP1-LP2-LP3-LP4
            ctx.strokeStyle = 'rgba(16, 185, 129, 0.6)';
            ctx.beginPath();
            lugs.forEach((p, idx) => {
                const px = cx + p.x * sc;
                const pz = cz + p.z * sc;
                if (idx === 0) ctx.moveTo(px, pz);
                else ctx.lineTo(px, pz);
            });
            ctx.closePath();
            ctx.stroke();

            // 4 Lifting Points Dots
            lugs.forEach((p, idx) => {
                const px = cx + p.x * sc;
                const pz = cz + p.z * sc;
                ctx.fillStyle = (state.selectedLP === String(idx)) ? '#38bdf8' : '#10b981';
                ctx.beginPath();
                ctx.arc(px, pz, 3.2, 0, Math.PI * 2);
                ctx.fill();
            });

            // CoG Target Dot
            const gx = cx + cogX * sc;
            const gz = cz + cogZ * sc;
            ctx.fillStyle = '#facc15';
            ctx.strokeStyle = '#ef4444';
            ctx.lineWidth = 1.5;
            ctx.beginPath();
            ctx.arc(gx, gz, 4.5, 0, Math.PI * 2);
            ctx.fill();
            ctx.stroke();
        }

        // --- 8. NEWTONIAN RIGID BODY: F = ma, steel-sling elasticity, shell contact ---
        const G_EARTH = 9.80665;

        // Deterministic PRNG (mulberry32) so debris / break-up physics is reproducible run-to-run.
        let _simRandState = 0x9e3779b9;
        function simRandom() {
            _simRandState = (_simRandState + 0x6d2b79f5) | 0;
            let t = Math.imul(_simRandState ^ (_simRandState >>> 15), 1 | _simRandState);
            t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
            return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
        }

        function chordAt(horiz, requestedLen) {
            const h = Math.max(0.1, horiz);
            const req = (requestedLen != null && requestedLen > 0) ? requestedLen : (h / Math.cos(60 * Math.PI / 180));
            const len = Math.max(0.35, req);
            const drop = len > h ? Math.sqrt(len * len - h * h) : 0.05;
            const beta = len > h ? Math.atan2(drop, h) : Math.asin(Math.min(1, Math.max(0.01, drop / len)));
            return { len, drop, beta };
        }

        function lugPlanCentroid() {
            const c = new THREE.Vector3();
            state.lugs.forEach(p => c.add(p));
            if (state.lugs.length) c.multiplyScalar(1 / state.lugs.length);
            return c;
        }

        function lowerPlanOffset(i) {
            const a = spreaderLocalAnchor(i);
            const c = lugPlanCentroid();
            const lug = state.lugs[i] || c;
            return Math.hypot(a.x - (lug.x - c.x), a.z - (lug.z - c.z));
        }

        function getRigSpec() {
            const { beamType } = state;
            const { spanX, spanZ } = getLPBoundingSpan();
            let mast = 0;
            if (beamType === 'cascaded' || beamType === 'inline4') mast = 1.15;
            else if (beamType === 'modular_truss') mast = 0.85;
            else if (beamType === 'spatial8' || beamType === 'inline8') mast = 2.2;

            // 1. Determine horizontal half-span for Tier 1 (upper bridle from hook)
            let horizU = Math.max(0.35, spanX / 2);
            if (beamType === 'none') {
                const lug = spanBase();
                horizU = Math.max(0.35, Math.hypot(lug.spanX / 2, lug.spanZ / 2));
            } else if (beamType === 'basket') {
                const lug = spanBase();
                const halfX = Math.max(0.25, lug.spanX / 2);
                const halfZ = Math.max(0.20, lug.spanZ / 2);
                horizU = Math.max(0.35, Math.hypot(halfX, halfZ));
            } else if (beamType === 'frame' || beamType === 'container_spreader' || (typeof customBeamMeshes !== 'undefined' && customBeamMeshes[beamType])) {
                horizU = Math.max(0.35, Math.hypot(spanX / 2, spanZ / 2));
            }

            // ASME B30.9 Minimum Bridle Angle is 30 deg to horizontal.
            // Absolute geometric limit: length cannot be shorter than horizU.
            // Standard recommended engineering bridle angle is 60 deg (equilateral bridle triangle).
            const cos30 = Math.cos(30 * Math.PI / 180); // ~0.866025
            const cos60 = Math.cos(60 * Math.PI / 180); // 0.50
            const minUpper = Math.max(0.8, Math.ceil((horizU / cos30) * 10) / 10);
            const recUpper = Math.max(minUpper, Math.round((horizU / cos60) * 10) / 10);
            const maxUpper = Math.max(25.0, Math.ceil(recUpper * 2.0));

            // Compute required vertical drop from beam underside to lowest lug
            let maxVDrop = 0.24;
            if (state.lugs && state.lugs.length) {
                let peakLugY = -1e9;
                let minLugY = 1e9;
                for (let i = 0; i < state.lugs.length; i++) {
                    const ly = state.lugs[i].y;
                    if (ly > peakLugY) peakLugY = ly;
                    if (ly < minLugY) minLugY = ly;
                }
                const hasOog = (state.cargoType === 'flatrack' || state.cargoType === 'opentop') && state.oogHasCargo !== false;
                const oogH = hasOog ? (state.oogCargoH || state.H) : 0;
                const cargoTopY = Math.max(peakLugY, (state.H || 2.6) * 0.5, hasOog ? (-state.H * 0.5 + 0.40 + oogH) : -1e9);
                const beamClearance = beamType === 'container_spreader' ? 0.12 : 0.24;
                const beamUndersideY = cargoTopY + beamClearance;
                maxVDrop = Math.max(0.24, beamUndersideY - minLugY);
            }

            let horizL = 0;
            if (beamType !== 'none') {
                for (let i = 0; i < state.lugs.length; i++) horizL = Math.max(horizL, lowerPlanOffset(i));
            }

            // Lower sling bounds
            let minLower, recLower, maxLower;
            if (beamType === 'none') {
                minLower = minUpper;
                recLower = recUpper;
                maxLower = maxUpper;
            } else {
                const geomDrop = Math.max(0.35, maxVDrop);
                minLower = Math.max(0.4, Math.ceil(Math.hypot(horizL, geomDrop) * 10) / 10);
                // Design the automatic lower tier at 45° to horizontal.  This
                // is comfortably above the 30° regulatory floor and avoids a
                // plan that can be rejected by its own safety interlock due to
                // millimetres of contact/solver rounding at pickup.
                const autoDrop = (horizL < 0.18)
                    ? Math.max(minLower, geomDrop)
                    : Math.max(geomDrop, horizL);
                recLower = Math.max(minLower, Math.round(Math.hypot(horizL, autoDrop) * 10) / 10);
                maxLower = Math.max(20.0, Math.ceil(recLower * 2.5));
            }

            // Proportional Rig Spec enforces ASME B30.9 geometric minimums
            if (state.upperSlingLength != null) {
                state.upperSlingLength = Math.max(minUpper, state.upperSlingLength);
            }
            if (state.lowerSlingLength != null && beamType !== 'none') {
                state.lowerSlingLength = Math.max(minLower, state.lowerSlingLength);
            }

            let topLeg, topDrop, lower, lowerDrop, betaDeg;

            if (beamType === 'basket') {
                const lug = spanBase();
                const halfX = Math.max(0.25, lug.spanX / 2);
                const halfZ = Math.max(0.20, lug.spanZ / 2);

                if (state.upperSlingLength != null || state.lowerSlingLength != null) {
                    const reqUpper = state.upperSlingLength != null ? state.upperSlingLength : recUpper;
                    const upper = chordAt(horizU, reqUpper);
                    topLeg = upper.len;
                    topDrop = upper.drop;
                    betaDeg = upper.beta * 180 / Math.PI;

                    if (state.lowerSlingLength != null) {
                        lower = Math.max(minLower, state.lowerSlingLength);
                        lowerDrop = Math.sqrt(Math.max(0.04, lower * lower - horizL * horizL));
                    } else {
                        lower = recLower;
                        lowerDrop = Math.sqrt(Math.max(0.04, lower * lower - horizL * horizL));
                    }
                } else {
                    const requested = state.slingUserSet ? Math.max(minUpper * 1.5, state.slingLength) : recUpper * 1.5;
                    const total = chordAt(horizU, requested);
                    const totalPlane = Math.sqrt(Math.max(0.64, total.len * total.len - halfZ * halfZ));
                    const upperAx = Math.max(0.55, (totalPlane - 0.28) * 0.56);
                    topLeg = Math.max(minUpper, Math.hypot(upperAx, halfZ));
                    lower = Math.max(minLower, totalPlane - 0.28 - upperAx);
                    topDrop = total.drop * 0.56;
                    lowerDrop = total.drop * 0.44;
                    betaDeg = total.beta * 180 / Math.PI;
                }
                return {
                    spanX, spanZ, topDrop, lower, lowerDrop, topLeg, mast: 0, betaDeg,
                    horizU, horizL, maxVDrop,
                    minUpper, maxUpper, recUpper,
                    minLower, maxLower, recLower
                };
            }

            const reqUpper = state.upperSlingLength != null ? state.upperSlingLength : (state.slingUserSet ? Math.max(0.4, state.slingLength) : recUpper);
            const upper = chordAt(horizU, reqUpper);
            topLeg = reqUpper;
            const topH = upper.drop;
            topDrop = (beamType === 'cascaded' || beamType === 'modular_truss' || beamType === 'inline4' || beamType === 'inline8' || beamType === 'spatial8') ? topH + mast : topH;
            betaDeg = upper.beta * 180 / Math.PI;

            if (beamType === 'none') {
                lower = topLeg;
                lowerDrop = topH;
                topDrop = 0;
            } else {
                lower = state.lowerSlingLength != null ? Math.max(0.35, state.lowerSlingLength) : recLower;
                lowerDrop = Math.sqrt(Math.max(0.04, lower * lower - horizL * horizL));
            }
            return {
                spanX, spanZ, topDrop, lower, lowerDrop, topLeg, mast, betaDeg,
                horizU, horizL, maxVDrop,
                minUpper, maxUpper, recUpper,
                minLower, maxLower, recLower
            };
        }

        function levelFrameQuat() {
            if (state.spreaderAlignWithCargo) {
                const e = new THREE.Euler().setFromQuaternion(phy.cargoQuat, 'YXZ');
                return new THREE.Quaternion().setFromEuler(new THREE.Euler(0, e.y, 0, 'YXZ'));
            }
            const yaw = THREE.MathUtils.degToRad(state.spreaderYawDeg || 0);
            return new THREE.Quaternion().setFromEuler(new THREE.Euler(0, yaw, 0, 'YXZ'));
        }

        function kinematicRigPose() {
            const spec = getRigSpec();
            const master = new THREE.Vector3(phy.hookPos.x, phy.hookPos.y + HOOK_MASTER_OFFSET_Y, phy.hookPos.z);
            const yawQ = levelFrameQuat();
            const centroid = new THREE.Vector3();
            let peak = -1e9;
            const count = Math.max(1, state.lugs.length);
            for (let i = 0; i < state.lugs.length; i++) {
                const p = state.lugs[i].clone().applyQuaternion(phy.cargoQuat).add(phy.cargoPos);
                centroid.add(p);
                if (p.y > peak) peak = p.y;
            }
            centroid.multiplyScalar(1 / count);
            let hang = master.clone().sub(centroid);
            if (hang.y < 0.65 || hang.lengthSq() < 0.25) hang.set(0, 1, 0);
            else {
                hang.x *= 0.25;
                hang.z *= 0.25;
                hang.normalize();
            }
            const cargoX = new THREE.Vector3(1, 0, 0).applyQuaternion(yawQ);
            let xAxis = cargoX.clone().addScaledVector(hang, -cargoX.dot(hang));
            if (xAxis.lengthSq() < 1e-6) xAxis = new THREE.Vector3(0, 0, 1).cross(hang);
            xAxis.normalize();
            const zAxis = new THREE.Vector3().crossVectors(xAxis, hang).normalize();
            const frameQ = new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(xAxis, hang, zAxis));
            const isGrounded = state.poseLock || (phy.groundClearance || 0) <= 0.05;
            const naturalY = master.y - (state.beamType === 'none' ? 0 : spec.topDrop);

            let spreaderPos = new THREE.Vector3(
                THREE.MathUtils.lerp(centroid.x, master.x, 0.35),
                naturalY,
                THREE.MathUtils.lerp(centroid.z, master.z, 0.35)
            );
            const shellY = cargoCeilingUnderBeam(spreaderPos.x, spreaderPos.z, spec);
            const floorY = Math.max(peak + 0.24, shellY);

            let spreaderY;
            if (state.beamType === 'none') {
                spreaderY = master.y;
            } else if (isGrounded) {
                // When cargo is grounded, Tier 2 positions the beam at spec.lowerDrop above cargo lugs.
                // If the hook is lowered below taut height, the hook pushes the beam down toward floorY.
                let yLugLow = 0.22;
                if (state.beamType === 'lifting_beam') yLugLow = 0.24;
                else if (state.beamType === 'frame') yLugLow = 0.18;
                else if (state.beamType === 'basket') yLugLow = 0.14;
                else if (state.beamType === 'container_spreader') yLugLow = 0.28;
                const beamFromLugs = peak + 0.12 + (spec.lowerDrop || 1.2) + yLugLow;
                const beamFromHook = naturalY;
                spreaderY = Math.max(floorY, Math.min(beamFromLugs, beamFromHook));
            } else {
                spreaderY = Math.max(floorY, naturalY);
            }
            spreaderPos.y = spreaderY;

            const clamped = state.beamType !== 'none' && spreaderPos.y <= floorY + 1e-4;
            const anchorVel = new THREE.Vector3(phy.hookVel.x, clamped ? 0 : phy.hookVel.y, phy.hookVel.z);
            return { spec, frameQ, master, spreaderPos, naturalY, clamped, anchorVel };
        }

        function computeRigPose() {
            if (phy.rigLive && phy.beams && phy.beams.length) {
                const top = phy.beams[0];
                const spec = getRigSpec();
                const master = new THREE.Vector3(phy.hookPos.x, phy.hookPos.y + HOOK_MASTER_OFFSET_Y, phy.hookPos.z);
                return {
                    spec,
                    frameQ: top.q.clone(),
                    master,
                    spreaderPos: top.x.clone(),
                    naturalY: top.x.y,
                    clamped: false,
                    anchorVel: top.v.clone(),
                    dynamic: true
                };
            }
            return kinematicRigPose();
        }

        function cargoCeilingUnderBeam(x, z, spec) {
            if (!activeCargoVisual || state.beamType === 'none') return -1e9;
            const clearance = state.beamType === 'container_spreader' ? 0.34 : 0.24;
            const hx = Math.max(0.2, (spec ? spec.spanX : state.L) * 0.45);
            const hz = Math.max(0.15, (spec ? spec.spanZ : state.W) * 0.45);
            let maxShellY = -1e9;
            const samples = [
                [0, 0], [-hx * 0.5, 0], [hx * 0.5, 0], [-hx, 0], [hx, 0],
                [0, -hz * 0.5], [0, hz * 0.5]
            ];
            for (let i = 0; i < samples.length; i++) {
                const sy = cargoShellTopWorldY(x + samples[i][0], z + samples[i][1], 0.14);
                if (sy > maxShellY) maxShellY = sy;
            }
            if (maxShellY < -1e5) return supportY(x, z) + clearance;
            return maxShellY + clearance;
        }

        function separateCargoFromBeam() {
            if (state.beamType === 'none' || !activeCargoVisual) return;
            cargoRootGroup.updateMatrixWorld(true);
            const box = new THREE.Box3().setFromObject(activeCargoVisual);
            const rig = computeRigPose();
            const underside = rig.spreaderPos.y - (state.beamType === 'container_spreader' ? 0.32 : 0.16);
            const half = Math.max(rig.spec.spanX, rig.spec.spanZ) * 0.5 + 0.25;
            const overlap = box.max.x > rig.spreaderPos.x - half && box.min.x < rig.spreaderPos.x + half
                && box.max.z > rig.spreaderPos.z - half && box.min.z < rig.spreaderPos.z + half;
            if (!overlap || box.max.y <= underside + 0.01) return;
            phy.cargoPos.y -= box.max.y - underside;
            if (phy.cargoVel.y > 0) phy.cargoVel.y = 0;
        }

        function dentCargo(speed) {
            if (!activeCargoVisual || !cargoRootGroup || (phy.impactCooldown || 0) > 0) return;
            phy.impactCooldown = 70;
            const mass = Math.max(80, state.weight * 1000);
            const energy = 0.5 * mass * speed * speed;
            const depth = Math.min(0.22, 0.04 + Math.sqrt(energy) / 24000);
            phy.damagePct = Math.min(100, (phy.damagePct || 0) + Math.min(48, energy / 28000));
            phy.shakeAmp = Math.min(0.42, 0.04 + energy / 2.5e6);
            spawnImpactDust();
            if (typeof simAudio !== 'undefined') {
                simAudio.playImpact(speed, energy, 'cargo');
            }
            const pts = supportPointsLocal();
            let contact = null;
            let best = Infinity;
            for (let i = 0; i < pts.length; i++) {
                const w = pts[i].clone().applyQuaternion(phy.cargoQuat).add(phy.cargoPos);
                if (w.y < best) { best = w.y; contact = w; }
            }
            if (!contact) return;
            ensureCargoBasePositions();
            restoreCargoBasePositions();
            cargoRootGroup.updateMatrixWorld(true);
            activeCargoVisual.updateMatrixWorld(true);
            const invCargoWorld = new THREE.Matrix4().copy(cargoRootGroup.matrixWorld).invert();
            // Impact contact point in cargoRootGroup local space (where (0,0,0) is true cargo geometric center)
            const cCargo = contact.clone().applyMatrix4(invCargoWorld);
            const dentRadius = 0.85;
            // Inward crumple direction pointing strictly from impact point toward cargo interior
            const inwardCargo = new THREE.Vector3(-cCargo.x * 0.35, -cCargo.y * 0.85 + 0.25, -cCargo.z * 0.35);
            if (inwardCargo.lengthSq() < 1e-6) inwardCargo.set(0, 1, 0);
            inwardCargo.normalize();

            activeCargoVisual.traverse(mesh => {
                if (!mesh.isMesh || !mesh.geometry || !mesh.geometry.attributes || !mesh.geometry.attributes.position) return;
                if (mesh.userData && (mesh.userData.isCADEdge || mesh.userData.noLugWeld)) return;
                if (mesh.name === 'impactScar') return;
                const pos = mesh.geometry.attributes.position;
                mesh.updateMatrixWorld(true);
                const meshToCargo = new THREE.Matrix4().multiplyMatrices(invCargoWorld, mesh.matrixWorld);
                const cargoToMesh = new THREE.Matrix4().copy(meshToCargo).invert();
                let changed = false;
                const vCargo = new THREE.Vector3();
                const origCargo = new THREE.Vector3();
                for (let v = 0; v < pos.count; v++) {
                    origCargo.set(pos.getX(v), pos.getY(v), pos.getZ(v)).applyMatrix4(meshToCargo);
                    const d = origCargo.distanceTo(cCargo);
                    if (d > dentRadius) continue;
                    const k = 1 - d / dentRadius;
                    const crush = Math.min(depth * k * k, d * 0.45, 0.18);
                    vCargo.copy(origCargo).addScaledVector(inwardCargo, crush);
                    // Strictly prevent any vertex from expanding outward beyond its original cargo profile
                    if (Math.abs(vCargo.x) > Math.abs(origCargo.x)) vCargo.x = origCargo.x;
                    if (Math.abs(vCargo.y) > Math.abs(origCargo.y)) vCargo.y = origCargo.y;
                    if (Math.abs(vCargo.z) > Math.abs(origCargo.z)) vCargo.z = origCargo.z;
                    vCargo.applyMatrix4(cargoToMesh);
                    pos.setXYZ(v, vCargo.x, vCargo.y, vCargo.z);
                    if (!mesh.geometry.attributes.color) {
                        const colors = new Float32Array(pos.count * 3);
                        colors.fill(1);
                        mesh.geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
                        if (mesh.material && !mesh.userData.colorMat) {
                            mesh.material = mesh.material.clone();
                            mesh.material.vertexColors = true;
                            mesh.userData.colorMat = true;
                        }
                    }
                    const col = mesh.geometry.attributes.color;
                    if (col) {
                        const burn = Math.max(0.25, 1 - k * 0.72);
                        col.setXYZ(v, col.getX(v) * burn, col.getY(v) * burn * 0.78, col.getZ(v) * burn * 0.62);
                        col.needsUpdate = true;
                    }
                    changed = true;
                }
                if (changed) {
                    pos.needsUpdate = true;
                    mesh.geometry.computeVertexNormals();
                    mesh.children.forEach(ch => {
                        if (ch.userData && ch.userData.isCADEdge) {
                            ch.geometry.dispose();
                            ch.geometry = new THREE.EdgesGeometry(mesh.geometry, 24);
                        }
                    });
                }
            });
            const scar = new THREE.Mesh(
                new THREE.SphereGeometry(0.36, 12, 8),
                new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.96, metalness: 0.12 })
            );
            scar.name = 'impactScar';
            scar.scale.set(1.35, 0.18, 1.05);
            cargoRootGroup.updateMatrixWorld(true);
            scar.position.copy(cCargo);
            const upLocal = new THREE.Vector3(0, 1, 0).transformDirection(invCargoWorld);
            if (upLocal.lengthSq() > 1e-6) scar.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), upLocal.normalize());
            cargoRootGroup.add(scar);
            const status = document.getElementById('sim-status-text');
            if (status) status.textContent = `Kiện rơi va đập mạnh ở ${speed.toFixed(1)} m/s (${(energy / 1000).toFixed(0)} kJ) — móp biến dạng tại điểm va chạm (${phy.damagePct.toFixed(0)}%).`;
            commitCargoBaseFromCurrent();
        }

        function spawnImpactDust(customOrigin) {
            if (!phy.dustGroup) {
                phy.dustGroup = new THREE.Group();
                scene.add(phy.dustGroup);
            }
            const geo = new THREE.SphereGeometry(0.08, 6, 6);
            const mat = new THREE.MeshBasicMaterial({ color: 0xd6d3d1, transparent: true, opacity: 0.7 });
            const origin = customOrigin ? customOrigin.clone() : phy.cargoPos.clone();
            origin.y = supportY(origin.x, origin.z) + 0.1;
            for (let i = 0; i < 16; i++) {
                const m = new THREE.Mesh(geo, mat.clone());
                m.position.copy(origin);
                m.userData.vel = new THREE.Vector3((simRandom() - 0.5) * 3.5, 0.6 + simRandom() * 2.2, (simRandom() - 0.5) * 3.5);
                m.userData.life = 40;
                phy.dustGroup.add(m);
            }
        }

        function ensureCargoBasePositions() {
            if (!activeCargoVisual) return;
            activeCargoVisual.traverse(mesh => {
                if (!mesh.isMesh || !mesh.geometry || !mesh.geometry.attributes || !mesh.geometry.attributes.position) return;
                const pos = mesh.geometry.attributes.position;
                if (!mesh.userData.basePos || mesh.userData.basePos.length !== pos.count * 3) {
                    mesh.userData.basePos = new Float32Array(pos.array);
                }
            });
        }

        function commitCargoBaseFromCurrent() {
            if (!activeCargoVisual) return;
            activeCargoVisual.traverse(mesh => {
                if (!mesh.isMesh || !mesh.geometry || !mesh.geometry.attributes || !mesh.geometry.attributes.position) return;
                const pos = mesh.geometry.attributes.position;
                if (!mesh.userData.basePos || mesh.userData.basePos.length !== pos.count * 3) mesh.userData.basePos = new Float32Array(pos.count * 3);
                mesh.userData.basePos.set(pos.array);
            });
        }

        function restoreCargoBasePositions() {
            if (!activeCargoVisual) return;
            activeCargoVisual.traverse(mesh => {
                const base = mesh.userData && mesh.userData.basePos;
                if (!mesh.isMesh || !base || !mesh.geometry || !mesh.geometry.attributes.position) return;
                mesh.geometry.attributes.position.array.set(base);
                mesh.geometry.attributes.position.needsUpdate = true;
            });
        }

        // Rigid steel containers & cargo do NOT stretch or enlarge their corner dimensions in mid-air when a sling breaks;
        // instead, the entire rigid body tilts/rolls around the remaining taut slings, and only dents inward upon ground impact.
        function stepCornerYield() {
            while (phy.cornerSag.length < state.lugs.length) phy.cornerSag.push(0);
            for (let i = 0; i < state.lugs.length; i++) phy.cornerSag[i] = 0;
        }

        function applyCornerYieldVisual() {
            if (phy.yieldApplied) {
                restoreCargoBasePositions();
                phy.yieldApplied = false;
            }
            placeLiftPoints();
        }

        // --- FLAT RACK LASHING RUPTURE, DECK SLIDING & FALLING PAYLOAD PHYSICS ---
        function resetFlatRackPayloadState() {
            phy.effectiveCargoWeightT = null;
            phy.oogState = {
                status: 'secured',
                strapsBroken: false,
                strapStress: 0,
                localPos: new THREE.Vector3(0, 0, 0),
                localVel: new THREE.Vector3(0, 0, 0),
                worldPos: new THREE.Vector3(),
                worldQuat: new THREE.Quaternion(),
                worldVel: new THREE.Vector3(),
                worldOmega: new THREE.Vector3(),
                slideSideSign: 1,
                impactedGround: false,
                // These values are intentionally kept in the simulation state
                // (rather than inferred from the meshes).  They make the
                // compound cargo / lashing system inspectable by the runtime
                // tests and by the incident telemetry panel.
                lashing: {
                    isIntact: true,
                    staticFriction: 0.32,
                    kineticFriction: 0.20,
                    capacityN: 0,
                    demandN: 0
                },
                endWalls: { negativeXIntact: true, positiveXIntact: true },
                deckNormalOffset: 0,
                lastCompoundPenetration: 0
            };
            if (!activeCargoVisual) return;
            const oogGroup = activeCargoVisual.getObjectByName('flatRackOogCargo');
            const lashingGroup = activeCargoVisual.getObjectByName('flatRackLashingStraps');
            const brokenGroup = activeCargoVisual.getObjectByName('flatRackBrokenStraps');
            if (oogGroup) {
                oogGroup.position.set(0, 0, 0);
                oogGroup.quaternion.identity();
                oogGroup.visible = true;
            }
            if (lashingGroup) lashingGroup.visible = true;
            if (brokenGroup) brokenGroup.visible = false;
        }

        function stepFlatRackPayloadPhysics(dt) {
            if (state.cargoType !== 'flatrack' || state.oogHasCargo === false || !activeCargoVisual) {
                phy.effectiveCargoWeightT = null;
                return;
            }
            const oogGroup = activeCargoVisual.getObjectByName('flatRackOogCargo');
            if (!oogGroup || !oogGroup.userData || !oogGroup.userData.oogMeta) return;
            if (!phy.oogState) resetFlatRackPayloadState();
            const st = phy.oogState;
            const meta = oogGroup.userData.oogMeta;
            const invCargoQ = phy.cargoQuat.clone().invert();
            const gLocal = new THREE.Vector3(0, -G_EARTH, 0).applyQuaternion(invCargoQ);
            const tiltRad = Math.acos(THREE.MathUtils.clamp(-gLocal.y / G_EARTH, -1, 1));
            const tiltDeg = THREE.MathUtils.radToDeg(tiltRad);
            const anyBrokenSling = (state.gear.legs || []).some(l => l && l.broken) || (state.gear.uppers || []).some(u => u && u.broken);
            const isGroundedFlat = state.poseLock || ((phy.groundClearance || 0) <= 0.05 && tiltDeg < 3.5);
            const payloadMassKg = Math.max(1000, ((state.weight || 22) - (state.tareT || 4.8)) * 1000);
            const gNormal = Math.max(0, -gLocal.y);
            const gParallel = Math.hypot(gLocal.x, gLocal.z);
            const lashing = st.lashing || (st.lashing = { isIntact: !st.strapsBroken, staticFriction: 0.32, kineticFriction: 0.20, capacityN: 0, demandN: 0 });
            // A scenario can specify its certified aggregate lashing MBL.  The
            // default remains deliberately conservative for the visual demo,
            // but physics always compares force (N) with force (N).
            const lashingCapacityN = Math.max(1,
                Number.isFinite(state.oogLashingMblN)
                    ? state.oogLashingMblN
                    : payloadMassKg * G_EARTH * 0.42
            );
            const lashingDemandN = Math.max(0, payloadMassKg * (gParallel - lashing.staticFriction * gNormal));
            lashing.capacityN = lashingCapacityN;
            lashing.demandN = lashingDemandN;

            if (st.status === 'secured') {
                // If cargo is resting flat on the ground / dunnage, normal reaction holds it firmly.
                // Straps never break while resting flat on dunnage.
                if (isGroundedFlat) {
                    st.strapStress = Math.max(0, st.strapStress - 1.5 * dt);
                    return;
                }

                // When hoisted or tilted into an inclined ramp:
                // Shear load on straps depends on cargo mass and sine of deck slope angle
                // Following an asymmetric sling rupture the lashing is already
                // shock-loaded and a small persistent deck slope is enough to
                // start ratchet slip.  An intact, normally handled Flat Rack
                // retains the much higher 18° static threshold.
                const critDeg = anyBrokenSling ? 3.0 : 18.0;
                if (tiltDeg > critDeg) {
                    const netRatio = Math.max(0.1, (Math.sin(tiltRad) - 0.28 * Math.cos(tiltRad)) / 0.25);
                    const massScale = Math.min(2.0, Math.max(0.6, payloadMassKg / 15000));
                    const rate = netRatio * massScale * (anyBrokenSling ? 5.5 : 2.2);
                    // The force gate makes an explicitly under-rated lashing
                    // fail immediately.  The accumulated dynamic term models
                    // shock loading after a sling parts, so a real sudden tilt
                    // does not need a fake position jump to release the load.
                    const overload = lashingDemandN / lashingCapacityN;
                    // Keep the original dynamic-incident accumulation at its
                    // nominal rate; an MBL overload only accelerates it.  This
                    // preserves realistic delayed rupture after a sudden sling
                    // failure while still making a demonstrably under-rated
                    // lashing fail without delay.
                    st.strapStress += Math.max(1, overload) * rate * dt;
                } else {
                    st.strapStress = Math.max(0, st.strapStress - 0.8 * dt);
                }

                if (lashingDemandN >= lashingCapacityN || st.strapStress >= 1.0) {
                    st.status = 'sliding';
                    st.strapsBroken = true;
                    lashing.isIntact = false;
                    if (typeof simAudio !== 'undefined') {
                        simAudio.playCableSnap({ role: 'strap', type: 'web' });
                    }
                    // Starts sliding smoothly from rest relative to the deck
                    st.localVel.set(0, 0, 0);
                    const lashingGroup = activeCargoVisual.getObjectByName('flatRackLashingStraps');
                    const brokenGroup = activeCargoVisual.getObjectByName('flatRackBrokenStraps');
                    if (lashingGroup) lashingGroup.visible = false;
                    if (brokenGroup) brokenGroup.visible = true;

                    // Spawn lashing snap sparks along both sides of the Flat Rack
                    [-0.32, 0.32].forEach(xf => [-1, 1].forEach(zf => {
                        const pLocal = new THREE.Vector3(xf * meta.cL, meta.cargoBottomY + meta.cH * 0.35, zf * meta.cW * 0.5);
                        spawnSnapSparks(pLocal.applyQuaternion(phy.cargoQuat).add(phy.cargoPos));
                    }));
                    const statusEl = document.getElementById('sim-status-text');
                    if (statusEl) {
                        statusEl.textContent = `CẢNH BÁO SỰ CỐ: Độ nghiêng sàn (${tiltDeg.toFixed(1)}°) vượt giới hạn giữ tải! DÂY CHẰNG BUỘC ĐÃ ĐỨT! Kiện hàng đang trượt theo độ dốc sàn Flat Rack!`;
                    }
                }
                return;
            }

            if (st.status === 'sliding') {
                if ((phy.groundClearance || 0) <= 0.05 && tiltDeg < 2.5) {
                    st.localVel.multiplyScalar(Math.exp(-dt * 14.0));
                    return;
                }

                // 1. Friction & sliding dynamics on the inclined deck plane
                let ax = gLocal.x;
                let az = gLocal.z;
                const gN = gNormal;
                const vSpd = Math.hypot(st.localVel.x, st.localVel.z);
                const muK = lashing.kineticFriction;

                if (vSpd > 1e-4) {
                    const fMag = Math.min(vSpd / dt, muK * gN);
                    ax -= fMag * (st.localVel.x / vSpd);
                    az -= fMag * (st.localVel.z / vSpd);
                } else if (Math.hypot(ax, az) < lashing.staticFriction * gN) {
                    // Static friction holds if slope is gentle
                    ax = 0;
                    az = 0;
                    st.localVel.set(0, 0, 0);
                }

                st.localVel.x += ax * dt;
                st.localVel.z += az * dt;
                st.localPos.x += st.localVel.x * dt;
                st.localPos.z += st.localVel.z * dt;

                // 2. Strict parallel travel limits along deck surface
                // Longitudinal (X): crate front reaches end bulkhead at freeSlideX.
                // As long as crate is supported on deck, it slides strictly parallel to the deck surface.
                const halfDeckX = state.L * 0.5;
                const halfCrateX = meta.cL * 0.5;
                const freeSlideX = Math.max(0.40, (halfDeckX - 0.20) - halfCrateX);
                const steepTiltX = tiltDeg >= 12.0 || Math.abs(st.localVel.x) > 0.55 || anyBrokenSling;

                // The Flat Rack is a compound solid: deck + two end walls.
                // An end wall is never skipped merely because the rack is
                // tilted.  Unless an explicit wall rating is exceeded, remove
                // only the closing component and leave lateral travel free.
                if (Math.abs(st.localPos.x) > freeSlideX) {
                    const side = st.localPos.x >= 0 ? 1 : -1;
                    const wallKey = side > 0 ? 'positiveXIntact' : 'negativeXIntact';
                    const wallIntact = !st.endWalls || st.endWalls[wallKey] !== false;
                    const wallLimitN = Math.max(1,
                        Number.isFinite(state.oogEndWallMblN)
                            ? state.oogEndWallMblN
                            // A steel Flat Rack bulkhead is intentionally much
                            // stronger than a normal lashing; it only fails in
                            // an explicitly configured destructive scenario.
                            : payloadMassKg * G_EARTH * 40
                    );
                    const impactForceN = payloadMassKg * Math.abs(st.localVel.x) / Math.max(dt, 1 / 120);
                    if (wallIntact && impactForceN <= wallLimitN) {
                        st.localPos.x = side * freeSlideX;
                        if (st.localVel.x * side > 0) st.localVel.x = 0;
                    } else if (st.endWalls) {
                        st.endWalls[wallKey] = false;
                    }
                }

                // Pure parallel sliding travel zones:
                // Along X: slides parallel until overhang passes beyond threshold
                const parallelLimitX = freeSlideX;
                const overX = Math.max(0, Math.abs(st.localPos.x) - parallelLimitX);

                // Along Z: open sides, slides parallel until CoG approaches the side edge
                const parallelLimitZ = Math.max(0.35, state.W * 0.36);
                const overZ = Math.max(0, Math.abs(st.localPos.z) - parallelLimitZ);

                // 3. Tipping fulcrum rotation angles:
                // When sliding longitudinally (along X), tipping down over the end rotates around Z axis!
                // When sliding laterally (along Z), tipping down over the side rotates around X axis!
                let tipAngleZ = 0; // Pitch around Z axis for X sliding
                let tipAngleX = 0; // Roll around X axis for Z sliding

                if (overX > 0 && steepTiltX) {
                    const tipProgX = Math.min(1.0, overX / 0.85);
                    tipAngleZ = -Math.sign(st.localPos.x) * (tipProgX * 0.58);
                }
                if (overZ > 0) {
                    const tipProgZ = Math.min(1.0, overZ / 0.45);
                    tipAngleX = Math.sign(st.localPos.z) * (tipProgZ * 0.52);
                }

                // Visual placement on deck:
                // If within parallel limits: strictly flush (Y = 0) and parallel (rotation = 0,0,0)
                const hasTipping = (Math.abs(tipAngleX) > 1e-4) || (Math.abs(tipAngleZ) > 1e-4);
                if (!hasTipping) {
                    oogGroup.position.set(st.localPos.x, 0, st.localPos.z);
                    oogGroup.rotation.set(0, 0, 0);
                    st.deckNormalOffset = 0;
                } else {
                    const dropY = -Math.max(Math.abs(tipAngleX) * 0.20, Math.abs(tipAngleZ) * 0.30);
                    oogGroup.position.set(st.localPos.x, dropY, st.localPos.z);
                    oogGroup.rotation.set(tipAngleX, 0, tipAngleZ);
                    st.deckNormalOffset = dropY;
                }

                // 4. Dislodgement when tipping progresses beyond critical support
                const isDislodgedX = steepTiltX && (!st.endWalls || st.endWalls.negativeXIntact === false || st.endWalls.positiveXIntact === false) && (overX >= 0.85);
                const isDislodgedZ = overZ >= 0.45;

                if (isDislodgedZ || isDislodgedX) {
                    const pCenterLocal = new THREE.Vector3(0, meta.centerY, 0);
                    st.worldQuat.copy(phy.cargoQuat).multiply(oogGroup.quaternion);
                    const oWorld = oogGroup.position.clone().applyQuaternion(phy.cargoQuat).add(phy.cargoPos);
                    st.worldPos.copy(oWorld).add(pCenterLocal.clone().applyQuaternion(st.worldQuat));

                    // Continuous velocity transfer from sliding deck frame to world frame
                    const vDeckPoint = phy.cargoVel.clone().add(new THREE.Vector3().crossVectors(phy.cargoOmega, oWorld.clone().sub(phy.cargoPos)));
                    const vSlideWorld = new THREE.Vector3(st.localVel.x, 0, st.localVel.z).applyQuaternion(phy.cargoQuat);
                    st.worldVel.copy(vSlideWorld).add(vDeckPoint);

                    // Gentle rotational velocity from tipping off the edge (proportional to sliding speed)
                    const vSlideSpd = Math.hypot(st.localVel.x, st.localVel.z);
                    const rollSign = Math.sign(st.localPos.z) || 1;
                    const pitchSign = Math.sign(st.localPos.x) || 1;
                    const tipOmegaX = isDislodgedZ ? rollSign * Math.min(0.65, vSlideSpd * 0.40) : 0;
                    const tipOmegaZ = isDislodgedX ? -pitchSign * Math.min(0.65, vSlideSpd * 0.40) : 0;
                    st.worldOmega.set(tipOmegaX, 0, tipOmegaZ).applyQuaternion(phy.cargoQuat).add(phy.cargoOmega);

                    st.status = 'falling';
                    // Flat Rack tare (ISO) remains on the hook; OOG payload becomes a separate body
                    const tareT = state.tareT != null ? state.tareT : (state.L > 9 ? 4.8 : 2.9);
                    phy.effectiveCargoWeightT = Math.min(state.weight, tareT);
                    st.massKg = Math.max(600, (state.weight - phy.effectiveCargoWeightT) * 1000);
                    st.half = meta.half
                        ? { hx: meta.half.hx, hy: meta.half.hy, hz: meta.half.hz }
                        : { hx: meta.cL * 0.5, hy: meta.cH * 0.5, hz: meta.cW * 0.5 };
                    st.frame = { L: state.L, W: state.W, H: state.H, deckH: meta.deckH || 0.30 };
                }
                return;
            }

            if (st.status === 'falling' || st.status === 'grounded') {
                st.worldVel.y -= G_EARTH * dt;
                st.worldPos.addScaledVector(st.worldVel, dt);
                const wLen = st.worldOmega.length();
                if (wLen > 1e-6) {
                    st.worldQuat.premultiply(new THREE.Quaternion().setFromAxisAngle(st.worldOmega.clone().multiplyScalar(1 / wLen), wLen * dt)).normalize();
                }

                // 8-corner ground collision for the fallen OOG crate
                const hx = meta.cL * 0.5;
                const hy = meta.cH * 0.5;
                const hz = meta.cW * 0.5;
                if (!st.half) st.half = { hx, hy, hz };
                if (!(st.massKg > 0)) st.massKg = Math.max(600, (state.weight - (phy.effectiveCargoWeightT || 2.5)) * 1000);
                let maxPen = 0;
                let hitPt = null;
                const groundContacts = [];
                for (let sx = -1; sx <= 1; sx += 2) {
                    for (let sy = -1; sy <= 1; sy += 2) {
                        for (let sz = -1; sz <= 1; sz += 2) {
                            const wCorner = new THREE.Vector3(sx * hx, sy * hy, sz * hz).applyQuaternion(st.worldQuat).add(st.worldPos);
                            const fY = supportY(wCorner.x, wCorner.z);
                            if (wCorner.y <= fY + 0.012) groundContacts.push({ point: wCorner, floorY: fY });
                            if (wCorner.y < fY) {
                                const pen = fY - wCorner.y;
                                if (pen > maxPen) {
                                    maxPen = pen;
                                    hitPt = wCorner;
                                }
                            }
                        }
                    }
                }
                if (maxPen > 0) {
                    // A rigid box must be pushed all the way to the external
                    // ground surface in this frame.  The old 8 cm cap left a
                    // visible part of the crate below ground and allowed it to
                    // hover during the next frame.
                    st.worldPos.y += maxPen + 0.001;
                    st.lastGroundPenetration = maxPen;
                    if (!st.impactedGround && st.worldVel.y < -0.35) {
                        st.impactedGround = true;
                        st.status = 'grounded';
                        if (hitPt) spawnImpactDust(hitPt);
                        if (typeof simAudio !== 'undefined') {
                            const oogMassKg = (state.weight * 0.7) * 1000;
                            const vy = Math.abs(st.worldVel.y);
                            simAudio.playImpact(vy, 0.5 * oogMassKg * vy * vy, 'ground');
                        }
                        const statusEl = document.getElementById('sim-status-text');
                        if (statusEl) {
                            statusEl.textContent = 'SỰ CỐ NGHIÊM TRỌNG: Kiện hàng trên Flat Rack đã đứt dây chằng, trượt khỏi sàn và RƠI ĐẬP XUỐNG ĐẤT!';
                        }
                    }
                    if (st.worldVel.y < 0) st.worldVel.y = 0;
                    if (st.worldVel.y > 0.3) st.worldVel.y = 0.1;
                    st.worldVel.x *= Math.exp(-dt * 14.0);
                    st.worldVel.z *= Math.exp(-dt * 14.0);
                    st.worldOmega.multiplyScalar(Math.exp(-dt * 5.0));
                }

                // A box that only touches at one edge has no valid support
                // polygon.  Apply the gravity moment about that contact so the
                // raised end falls naturally instead of freezing at a fake
                // 20--40 degree "rest" pose.  Four well-spaced contacts are a
                // valid flat rest and receive no artificial torque.
                if (groundContacts.length) {
                    let contactCentroid = new THREE.Vector3();
                    groundContacts.forEach(c => contactCentroid.add(c.point));
                    contactCentroid.multiplyScalar(1 / groundContacts.length);
                    const com = st.worldPos.clone();
                    const supportRadiusSq = groundContacts.reduce((best, c) => Math.max(best, c.point.distanceToSquared(contactCentroid)), 0);
                    const up = new THREE.Vector3(0, 1, 0).applyQuaternion(st.worldQuat);
                    const tiltFromLevel = Math.acos(THREE.MathUtils.clamp(Math.abs(up.y), 0, 1));
                    const hasBroadSupport = groundContacts.length >= 3 && supportRadiusSq > 0.18;
                    if (!hasBroadSupport && tiltFromLevel > THREE.MathUtils.degToRad(0.35)) {
                        const gravityForce = new THREE.Vector3(0, -Math.max(600, st.massKg || 600) * G_EARTH, 0);
                        const torque = new THREE.Vector3().crossVectors(com.sub(contactCentroid), gravityForce);
                        const invI = inertiaInverseAboutCog(
                            Math.max(600, st.massKg || 600),
                            Math.max(0.4, hx * 2), Math.max(0.4, hz * 2), Math.max(0.4, hy * 2),
                            0, 0, 0
                        );
                        const alpha = alphaFromTorque(torque, st.worldQuat, invI);
                        if (alpha && isFinite(alpha.x) && isFinite(alpha.y) && isFinite(alpha.z)) {
                            // Clamp only pathological solver spikes; real gravity
                            // still controls the angular response.
                            if (alpha.length() > 18) alpha.setLength(18);
                            st.worldOmega.addScaledVector(alpha, dt);
                        }
                    }
                    if (maxPen > 0 && !st.impactedGround && Math.abs(st.worldVel.y) < 0.36) {
                        st.status = 'grounded';
                    }
                }

                // Two separate bodies: empty Flat Rack ↔ fallen OOG crate (catch / slide / clear)
                resolveFlatRackFallenOogContacts(dt);

                const pCenter = new THREE.Vector3(0, meta.centerY, 0).applyQuaternion(st.worldQuat);
                const oWorld = st.worldPos.clone().sub(pCenter);
                oogGroup.position.copy(oWorld.sub(phy.cargoPos).applyQuaternion(invCargoQ));
                oogGroup.quaternion.copy(invCargoQ).multiply(st.worldQuat);
            }
        }

        function pointExitOrientedBox(worldPt, center, quat, hx, hy, hz, pad) {
            const p = Math.max(0, pad || 0);
            const invQ = quat.clone().invert();
            const local = worldPt.clone().sub(center).applyQuaternion(invQ);
            const dx = Math.abs(local.x) - (hx + p);
            const dy = Math.abs(local.y) - (hy + p);
            const dz = Math.abs(local.z) - (hz + p);
            if (dx >= 0 || dy >= 0 || dz >= 0) return null;
            let depth = -dx;
            const nLocal = new THREE.Vector3(Math.sign(local.x) || 1, 0, 0);
            if (-dy < depth) { depth = -dy; nLocal.set(0, Math.sign(local.y) || 1, 0); }
            if (-dz < depth) { depth = -dz; nLocal.set(0, 0, Math.sign(local.z) || 1); }
            return {
                depth,
                n: nLocal.applyQuaternion(quat).normalize(),
                local
            };
        }

        // Flat Rack is NOT a solid L×W×H box — only deck slab + two end bulkheads collide.
        function flatRackSolidBoxesLocal() {
            const { L, W, H } = state;
            const deckH = (phy.oogState && phy.oogState.frame && phy.oogState.frame.deckH) || 0.30;
            const deckCy = -H * 0.5 + deckH * 0.5;
            const postH = H - 0.18;
            return [
                { c: new THREE.Vector3(0, deckCy, 0), h: new THREE.Vector3(L * 0.5 - 0.04, deckH * 0.5, W * 0.5 - 0.04) },
                { c: new THREE.Vector3(L * 0.5 - 0.11, 0, 0), h: new THREE.Vector3(0.12, postH * 0.5, W * 0.5 - 0.06) },
                { c: new THREE.Vector3(-(L * 0.5 - 0.11), 0, 0), h: new THREE.Vector3(0.12, postH * 0.5, W * 0.5 - 0.06) }
            ];
        }

        function flatRackContactSampleLocals() {
            const { L, W, H } = state;
            const deckH = 0.30;
            const deckY = -H * 0.5 + deckH;
            const botY = -H * 0.5 + 0.04;
            const pts = [];
            // Dense samples along outer girders / deck edges — first outer contact wins
            for (let i = -8; i <= 8; i++) {
                const x = (i / 8) * (L * 0.49);
                [-1, 1].forEach(sz => {
                    pts.push(new THREE.Vector3(x, deckY, sz * W * 0.49));
                    pts.push(new THREE.Vector3(x, botY, sz * W * 0.49));
                    pts.push(new THREE.Vector3(x, deckY - 0.08, sz * W * 0.49));
                });
                pts.push(new THREE.Vector3(x, botY, 0));
                pts.push(new THREE.Vector3(x, deckY, 0));
            }
            // End bulkhead outer faces & corner posts (full height)
            [-1, 1].forEach(sx => {
                const ex = sx * (L * 0.5 - 0.02); // outermost face
                for (let j = -4; j <= 4; j++) {
                    const y = (j / 4) * (H * 0.48);
                    for (let k = -3; k <= 3; k++) {
                        const z = (k / 3) * (W * 0.48);
                        pts.push(new THREE.Vector3(ex, y, z));
                    }
                }
                [-1, 1].forEach(sz => {
                    pts.push(new THREE.Vector3(sx * (L * 0.5 - 0.11), H * 0.45, sz * (W * 0.5 - 0.11)));
                    pts.push(new THREE.Vector3(sx * (L * 0.5 - 0.11), -H * 0.45, sz * (W * 0.5 - 0.11)));
                });
            });
            return pts;
        }

        function oogContactSampleLocals(half) {
            const pts = [];
            const { hx, hy, hz } = half;
            [-1, 1].forEach(sx => [-1, 1].forEach(sy => [-1, 1].forEach(sz => {
                pts.push(new THREE.Vector3(sx * hx, sy * hy, sz * hz));
            })));
            [-1, 1].forEach(sx => [-1, 1].forEach(sy => {
                pts.push(new THREE.Vector3(sx * hx, sy * hy, 0));
                pts.push(new THREE.Vector3(sx * hx, 0, sy * hz));
                pts.push(new THREE.Vector3(0, sy * hy, sx * hz));
            }));
            return pts;
        }

        function pointExitFlatRackCompound(worldPt, pad) {
            const p = Math.max(0, pad || 0);
            const invQ = phy.cargoQuat.clone().invert();
            const local = worldPt.clone().sub(phy.cargoPos).applyQuaternion(invQ);
            let best = null;
            flatRackSolidBoxesLocal().forEach(box => {
                const rel = local.clone().sub(box.c);
                const hit = boxExit(rel, box.h.x + p, box.h.y + p, box.h.z + p);
                if (!hit) return;
                if (!best || hit.depth < best.depth) {
                    best = {
                        depth: hit.depth,
                        n: hit.n.clone().applyQuaternion(phy.cargoQuat).normalize()
                    };
                }
            });
            return best;
        }

        // Empty Flat Rack vs fallen OOG.
        // Hard rule: contact the OUTERMOST surface first — push Flat Rack fully out before any deeper point.
        // Grounded OOG is immovable; FR (tare) must rest / slide on the crate skin, never ghost through.
        function resolveFlatRackFallenOogContacts(dt) {
            const st = phy.oogState;
            if (!st || (st.status !== 'falling' && st.status !== 'grounded')) return;
            if (!st.half) return;
            if (!isFinite(phy.cargoPos.x) || !isFinite(st.worldPos.x)) return;
            const half = st.half;
            const tareT = state.tareT != null ? state.tareT : (state.L > 9 ? 4.8 : 2.9);
            const rackMass = Math.max(80, (phy.effectiveCargoWeightT != null ? phy.effectiveCargoWeightT : tareT) * 1000);
            const { L, W, H } = state;
            const invIRack = inertiaInverseAboutCog(rackMass, L, W, H, state.cogX, state.cogY, state.cogZ);
            const grounded = st.status === 'grounded';
            // A very small skin keeps two rendered steel/wood surfaces apart;
            // it is not a permissive overlap allowance.
            const pad = 0.002;
            const frSamples = flatRackContactSampleLocals();
            const oogSamples = oogContactSampleLocals(half);
            let totalMoved = 0;
            const maxTotalMove = 2.4;
            st.lastCompoundPenetration = 0;

            const findDeepest = () => {
                let best = null;
                // 1) Flat Rack outer skin points inside OOG volume
                for (let i = 0; i < frSamples.length; i++) {
                    const w = frSamples[i].clone().applyQuaternion(phy.cargoQuat).add(phy.cargoPos);
                    const hit = pointExitOrientedBox(w, st.worldPos, st.worldQuat, half.hx, half.hy, half.hz, pad);
                    if (!hit) continue;
                    if (!best || hit.depth > best.depth) best = { point: w, n: hit.n, depth: hit.depth, kind: 'frInOog' };
                }
                // 2) OOG outer corners/edges inside Flat Rack solids (deck / bulkheads)
                for (let i = 0; i < oogSamples.length; i++) {
                    const w = oogSamples[i].clone().applyQuaternion(st.worldQuat).add(st.worldPos);
                    const hit = pointExitFlatRackCompound(w, pad);
                    if (!hit) continue;
                    if (!best || hit.depth > best.depth) best = { point: w, n: hit.n, depth: hit.depth, kind: 'oogInFr' };
                }
                return best;
            };

            // Iterative deepest-first separation = collide at the first outer point, then the next, …
            for (let iter = 0; iter < 48; iter++) {
                if (totalMoved >= maxTotalMove) break;
                const deep = findDeepest();
                if (!deep || !(deep.depth > 0.0015) || !deep.n || !(deep.n.lengthSq() > 0.25)) break;
                st.lastCompoundPenetration = Math.max(st.lastCompoundPenetration, deep.depth);

                // sepDir pushes Flat Rack away from OOG, and OOG away from Flat Rack
                const sepDir = (deep.kind === 'frInOog') ? deep.n.clone() : deep.n.clone().negate();

                // Resolve the full measured penetration (plus skin) rather
                // than repeatedly leaving a visible fraction embedded.  The
                // contact impulse below removes only closing speed, preventing
                // the correction from becoming a launch impulse.
                const push = Math.min(deep.depth + 0.002, 0.18, maxTotalMove - totalMoved);
                phy.cargoPos.addScaledVector(sepDir, push);
                totalMoved += push;

                // Grounded crate stays planted
                if (!grounded) {
                    st.worldPos.addScaledVector(sepDir, -push * 0.25);
                } else {
                    const bottom = st.worldPos.y - half.hy;
                    const gy = supportY(st.worldPos.x, st.worldPos.z);
                    if (bottom < gy) st.worldPos.y += (gy - bottom);
                }

                // Kill closing velocity at the contact (allow tangential slide along the outer face)
                const com = cargoComNow();
                if (!isFinite(com.x)) break;
                const r = deep.point.clone().sub(com);
                const vPt = phy.cargoVel.clone().add(new THREE.Vector3().crossVectors(phy.cargoOmega, r));
                const vn = vPt.dot(sepDir);
                if (vn < 0) {
                    const jn = Math.min(-vn * 0.85, 1.6);
                    phy.cargoVel.addScaledVector(sepDir, jn);
                    const torque = alphaFromTorque(new THREE.Vector3().crossVectors(r, sepDir.clone().multiplyScalar(jn * 0.85)), phy.cargoQuat, invIRack);
                    if (torque && isFinite(torque.x)) phy.cargoOmega.add(torque);
                }
            }

            if (phy.cargoVel.length() > 2.4) phy.cargoVel.setLength(2.4);
            if (phy.cargoOmega.length() > 1.1) phy.cargoOmega.setLength(1.1);
            if (st.worldVel.length() > 3.5) st.worldVel.setLength(3.5);
            if (st.worldOmega.length() > 2.0) st.worldOmega.setLength(2.0);

            if (phy.effectiveCargoWeightT == null) {
                phy.effectiveCargoWeightT = Math.min(state.weight, tareT);
            }
        }

        function sanitizeSimBodies() {
            const badVec = (v) => !v || !isFinite(v.x) || !isFinite(v.y) || !isFinite(v.z);
            const badQ = (q) => !q || !isFinite(q.x) || !isFinite(q.y) || !isFinite(q.z) || !isFinite(q.w) || q.lengthSq() < 1e-8;
            const exploded = (v) => Math.abs(v.x) > 90 || Math.abs(v.y) > 90 || Math.abs(v.z) > 90;
            if (badVec(phy.cargoPos) || badVec(phy.cargoVel) || badVec(phy.cargoOmega) || badQ(phy.cargoQuat) || exploded(phy.cargoPos)) {
                phy.cargoVel.set(0, 0, 0);
                phy.cargoOmega.set(0, 0, 0);
                phy.cargoQuat.identity();
                phy.cargoPos.set(
                    isFinite(phy.hookPos.x) ? phy.hookPos.x : 0,
                    Math.max(1.2, (isFinite(phy.hookPos.y) ? phy.hookPos.y : 8) - 5),
                    isFinite(phy.hookPos.z) ? phy.hookPos.z : 0
                );
                applyLockedPose();
            }
            (phy.beams || []).forEach(b => {
                if (!b || !(badVec(b.x) || badVec(b.v) || badQ(b.q) || exploded(b.x))) return;
                b.v.set(0, 0, 0);
                b.w.set(0, 0, 0);
                b.q.identity();
                b.x.set(phy.cargoPos.x, phy.cargoPos.y + state.H * 0.5 + 1.2, phy.cargoPos.z);
            });
            if (phy.oogState && phy.oogState.worldPos && (badVec(phy.oogState.worldPos) || badVec(phy.oogState.worldVel) || exploded(phy.oogState.worldPos))) {
                phy.oogState.worldVel.set(0, 0, 0);
                phy.oogState.worldOmega.set(0, 0, 0);
                phy.oogState.worldQuat.identity();
                phy.oogState.worldPos.set(phy.cargoPos.x, Math.max(1, phy.oogState.half ? phy.oogState.half.hy : 1), phy.cargoPos.z + state.W);
                phy.oogState.status = 'grounded';
                phy.oogState.impactedGround = true;
            }
            (phy.cables || []).forEach(c => {
                if (!c.break) return;
                const br = c.break;
                ['tipU', 'tipL', 'velU', 'velL'].forEach(k => {
                    if (badVec(br[k])) {
                        br.velU && br.velU.set(0, 0, 0);
                        br.velL && br.velL.set(0, 0, 0);
                        if (c.a) br.tipU = attachWorld(c.a).add(new THREE.Vector3(0, -0.4, 0));
                        if (c.b) br.tipL = attachWorld(c.b).add(new THREE.Vector3(0, -0.3, 0));
                    }
                });
            });
        }

        function placeLiftPoints() {
            if (!cargoRootGroup) return;
            cargoRootGroup.updateMatrixWorld(true);
            const invQ = phy.cargoQuat.clone().invert();
            for (let i = 0; i < state.lugs.length; i++) {
                if (!state.lugs[i] || !padEyeMeshes[i] || !hwMeshes[i]) continue;
                const sag = new THREE.Vector3(0, -(phy.cornerSag[i] || 0), 0).applyQuaternion(invQ);
                padEyeMeshes[i].position.copy(state.lugs[i]).add(sag);
                const fit = slingCrownWorld(i);
                const anchor = state.beamType === 'none'
                    ? new THREE.Vector3(phy.hookPos.x, phy.hookPos.y + HOOK_MASTER_OFFSET_Y, phy.hookPos.z)
                    : slingAnchorWorld(i, computeRigPose());
                const dir = pathLeaveArrive(anchor, fit.ring, legRestLength(i, getRigSpec())).arrive;
                const worldQ = tensionQuaternion(fit.ring, fit.ring.clone().add(dir));
                const pinW = fit.ring;
                hwMeshes[i].position.copy(cargoRootGroup.worldToLocal(pinW));
                hwMeshes[i].quaternion.copy(invQ.clone().multiply(worldQ));
                const pinAxis = new THREE.Vector3(1, 0, 0).applyQuaternion(worldQ);
                orientPadEyeToPin(padEyeMeshes[i], (state.lugNormals && state.lugNormals[i]) ? state.lugNormals[i] : new THREE.Vector3(0, 1, 0), pinAxis);
            }
        }

        function spreaderLocalAnchor(i) {
            const plan = tierPlan(state.beamType);
            if (plan) {
                const hit = plan.cables.find(c => c.role === 'leg' && c.index === i);
                if (hit && hit.a && hit.a.kind === 'body') {
                    const host = plan.bodies.find(b => b.id === hit.a.id);
                    if (host) return host.origin.clone().add(new THREE.Vector3(hit.a.local[0], hit.a.local[1], hit.a.local[2]));
                }
            }
            const type = state.beamType;
            const posX = i === 0 || i === 3;
            const posZ = i === 0 || i === 1;
            if (type === 'spreader') {
                const m = memberSpec('main');
                return new THREE.Vector3(posX ? m.a : m.b, -0.22, posZ ? 0.065 : -0.065);
            }
            if (type === 'lifting_beam') {
                const m = memberSpec('main');
                return new THREE.Vector3(posX ? m.a : m.b, -0.24, posZ ? 0.065 : -0.065);
            }
            if (type === 'cascaded' || type === 'modular_truss') {
                const top = memberSpec(type === 'modular_truss' ? 'truss' : 'top');
                const bar = memberSpec(posX ? 'lowPlus' : 'lowMinus');
                return new THREE.Vector3(posX ? top.a : top.b, -0.18, posZ ? bar.a : bar.b);
            }
            if (type === 'frame') {
                const rail = memberSpec(posZ ? 'railPos' : 'railNeg');
                const end = memberSpec(posX ? 'endPos' : 'endNeg');
                return new THREE.Vector3(posX ? rail.a : rail.b, -0.18, posZ ? end.a : end.b);
            }
            if (type === 'basket') {
                const bar = memberSpec(posX ? 'barPos' : 'barNeg');
                const x = posX ? spanBase().spanX / 2 : -spanBase().spanX / 2;
                return new THREE.Vector3(x, -0.14, posZ ? bar.a : bar.b);
            }
            const { spanX, spanZ } = getLPBoundingSpan();
            const yOff = type === 'container_spreader' ? -0.28 : 0;
            return new THREE.Vector3(posX ? spanX / 2 : -spanX / 2, yOff, posZ ? spanZ / 2 : -spanZ / 2);
        }

        function slingAnchorWorld(i, rig) {
            const cable = (phy.cables || []).find(c => c.role === 'leg' && c.index === i);
            if (cable) return attachWorld(cable.a);
            if (state.beamType === 'none') return rig.master.clone();
            return spreaderLocalAnchor(i).applyQuaternion(rig.frameQ).add(rig.spreaderPos);
        }

        function padEyeRingWorld(i) {
            const rawNorm = (state.lugNormals && state.lugNormals[i]) ? state.lugNormals[i] : null;
            const n = (rawNorm && typeof rawNorm.clone === 'function')
                ? rawNorm.clone()
                : new THREE.Vector3(rawNorm?.x || 0, rawNorm?.y !== undefined ? rawNorm.y : 1, rawNorm?.z || 0);
            if (n.lengthSq() < 0.25) n.set(0, 1, 0);
            const q = (phy && phy.cargoQuat) ? phy.cargoQuat : new THREE.Quaternion();
            const pCargo = (phy && phy.cargoPos) ? phy.cargoPos : new THREE.Vector3();
            n.normalize().applyQuaternion(q);

            let rawLug = (state.lugs && state.lugs[i]) ? state.lugs[i] : null;
            let lug = (rawLug && typeof rawLug.clone === 'function')
                ? rawLug.clone()
                : (rawLug ? new THREE.Vector3(rawLug.x || 0, rawLug.y || 0, rawLug.z || 0) : null);
            if (!lug) {
                const sx = (i === 0 || i === 3) ? 1 : -1;
                const sz = (i === 0 || i === 1) ? 1 : -1;
                const L = state.L || 6.0, W = state.W || 2.4, H = state.H || 2.5;
                lug = new THREE.Vector3(sx * (L * 0.44), H * 0.48, sz * (W * 0.44));
            }
            const ring = lug.clone().applyQuaternion(q).add(pCargo);
            if (phy && phy.cornerSag && phy.cornerSag[i]) ring.y -= phy.cornerSag[i];
            ring.addScaledVector(n, 0.12);
            return { ring, n };
        }

        function cargoShackleScale(i) {
            const jaw = state.gear && state.gear.shackles && state.gear.shackles[i] ? state.gear.shackles[i].jawMm : 44;
            return THREE.MathUtils.clamp((jaw || 44) / 44, 0.45, 2.4);
        }

        function slingCrownWorld(i) {
            const { ring, n } = padEyeRingWorld(i);
            let dir = (n && typeof n.clone === 'function') ? n.clone() : new THREE.Vector3(0, 1, 0);
            const target = state.beamType === 'none'
                ? new THREE.Vector3(phy.hookPos.x, phy.hookPos.y + HOOK_MASTER_OFFSET_Y, phy.hookPos.z)
                : slingAnchorWorld(i, computeRigPose());
            const to = (target && ring) ? target.clone().sub(ring) : new THREE.Vector3(0, 1, 0);
            if (to.lengthSq() > 0.04) dir = to.normalize();
            const crownDist = hardwareCrownOffset(state.hwType || 'bow_shackle', cargoShackleScale(i));
            const crown = (ring && typeof ring.clone === 'function') ? ring.clone().addScaledVector(dir, crownDist) : new THREE.Vector3();
            return { ring: ring || new THREE.Vector3(), dir, crown };
        }

        function lugEyeWorld(i) {
            return slingCrownWorld(i).crown;
        }

        // A factory/start-up presentation can contain convenient 8 m upper and
        // 2 m lower strings.  They are *not* user engineering inputs once the
        // operator returns a tier to Auto.  Keeping them silently was the root
        // cause of impossible sling angles: the hook auto-lift was correctly
        // refused by the angle guard, yet the UI looked as though it had hoisted.
        //
        // `userSet` is written by the detailed gear editor.  The final branch
        // also keeps direct API/import values (for example a deliberate 12 m
        // slack test) valid without treating the known factory placeholders as
        // real manufactured cable lengths.
        function hasExplicitCableLength(item, role) {
            if (!item || item.lengthM == null) return false;
            if (item.userSet || state.slingUserSet || state.holdCableLength) return true;
            const factoryPlaceholder = role === 'upper' ? 8.0 : 2.0;
            return Math.abs(item.lengthM - factoryPlaceholder) > 0.005;
        }

        // Global sling selection applies to every uncustomised leg.  The
        // start-up sample is intentionally a chain assembly, so treating its
        // saved per-leg label as an individual override made a user-selected
        // wire/round sling continue to render as chain.
        function effectiveSlingType(item) {
            if (item && item.slingType) return item.slingType;
            return state.slingType || (item && item.slingType) || 'wire';
        }

        function legRestLength(i, spec) {
            const item = state.gear && state.gear.legs && state.gear.legs[i];
            const custom = hasExplicitCableLength(item, 'leg') ? item.lengthM : null;
            const delta = (state.legDeltaL && state.legDeltaL[i]) || 0;
            if (custom != null) return Math.max(0.35, custom + delta);
            if (state.lowerSlingLength != null) return Math.max(0.35, state.lowerSlingLength + delta);
            const base = spec ? spec.lower : 2.8;
            return Math.max(0.35, base + delta);
        }

        function autoSlingWll(rec, fallback) {
            if (!rec) return fallback || 10;
            const parts = Math.max(1, Math.min(4, rec.parts || 1));
            const type = effectiveSlingType(rec);
            const d = rec.diaMm || (type === 'web' ? 60 : (type === 'chain' ? 16 : 22));
            let singleWll = 0;
            if (type === 'chain') {
                const factor = (rec.grade === 'g100') ? 0.040 : 0.032;
                singleWll = factor * d * d;
            } else if (type === 'web') {
                singleWll = Math.max(0.5, d / 30);
            } else if (type === 'round_sling') {
                singleWll = (rec.grade === 'hmpe') ? (d * d / 120) : Math.max(0.5, d / 28);
            } else if (type === 'grommet') {
                singleWll = 1.8 * (0.0163 * d * d);
            } else {
                singleWll = 0.0163 * d * d;
            }
            return Math.max(0.2, Number((singleWll * parts).toFixed(2)));
        }

        function legSwl(i) {
            const item = state.gear && state.gear.legs && state.gear.legs[i];
            if (item && item.swlT != null) return item.swlT;
            return autoSlingWll(item, state.wllPerLeg);
        }

        function upperSwl(i) {
            const item = state.gear && state.gear.uppers && state.gear.uppers[i];
            if (item && item.swlT != null) return item.swlT;
            return autoSlingWll(item, state.wllPerLeg * 2);
        }

        function activeUpperIndexes() {
            if (state.beamType === 'none') return [];
            if (state.beamType === 'frame' || state.beamType === 'container_spreader' || state.beamType === 'basket' || customBeamMeshes[state.beamType]) return [0, 1, 2, 3];
            return [0, 1];
        }

        function cableInvMass(r, n, quat, invI, invMass) {
            const rxn = new THREE.Vector3().crossVectors(r, n);
            const ang = alphaFromTorque(rxn, quat, invI);
            const w = invMass + rxn.dot(ang);
            return Math.max(w, invMass * 0.25);
        }

        function solve3(A, b) {
            const M = A.map((row, i) => [row[0], row[1], row[2], b[i]]);
            for (let k = 0; k < 3; k++) {
                let piv = k;
                for (let i = k + 1; i < 3; i++) if (Math.abs(M[i][k]) > Math.abs(M[piv][k])) piv = i;
                if (Math.abs(M[piv][k]) < 1e-8) return null;
                if (piv !== k) { const tmp = M[k]; M[k] = M[piv]; M[piv] = tmp; }
                for (let i = k + 1; i < 3; i++) {
                    const f = M[i][k] / M[k][k];
                    for (let j = k; j < 4; j++) M[i][j] -= f * M[k][j];
                }
            }
            const x = [0, 0, 0];
            for (let i = 2; i >= 0; i--) {
                let s = M[i][3];
                for (let j = i + 1; j < 3; j++) s -= M[i][j] * x[j];
                x[i] = s / M[i][i];
            }
            return x;
        }

        function verticalShares(legs, weightT) {
            const n = legs.length;
            if (!n) return [];
            if (n === 1) return [weightT];
            let sx = 0, sz = 0, sxx = 0, szz = 0, sxz = 0;
            legs.forEach(L => {
                sx += L.rx; sz += L.rz; sxx += L.rx * L.rx; szz += L.rz * L.rz; sxz += L.rx * L.rz;
            });
            const coef = solve3(
                [[n, sx, sz], [sx, sxx + 1e-4, sxz], [sz, sxz, szz + 1e-4]],
                [weightT, 0, 0]
            );
            let V = legs.map(L => coef ? Math.max(0, coef[0] + coef[1] * L.rx + coef[2] * L.rz) : weightT / n);
            const sum = V.reduce((a, b) => a + b, 0);
            if (sum < 1e-4) V = legs.map(() => weightT / n);
            else V = V.map(v => v * weightT / sum);
            if (n >= 3) {
                const equal = weightT / n;
                const floorShare = equal * 0.34;
                if (V.some(v => v < floorShare)) {
                    V = V.map(v => Math.max(v, floorShare));
                    const lifted = V.reduce((a, b) => a + b, 0);
                    V = V.map(v => v * weightT / lifted);
                }
            }
            return V;
        }

        function upperAnchorWorld(i, rig) {
            const cable = (phy.cables || []).find(c => c.role === 'upper' && c.index === i);
            if (cable) return attachWorld(cable.b);
            const { beamType } = state;
            if (beamType === 'spreader' || beamType === 'lifting_beam') {
                const m = memberSpec('main');
                const x = i === 0 ? m.b : m.a;
                const y = beamType === 'lifting_beam' ? 0.24 : 0.22;
                return new THREE.Vector3(x, y, 0).applyQuaternion(rig.frameQ).add(rig.spreaderPos);
            }
            if (beamType === 'cascaded' || beamType === 'modular_truss') {
                const top = memberSpec(beamType === 'modular_truss' ? 'truss' : 'top');
                const x = i === 0 ? top.b : top.a;
                const y = (beamType === 'modular_truss' ? 0.85 : 1.15) + 0.22;
                return new THREE.Vector3(x, y, 0).applyQuaternion(rig.frameQ).add(rig.spreaderPos);
            }
            const low = spreaderLocalAnchor(i);
            return new THREE.Vector3(low.x, Math.abs(low.y), low.z).applyQuaternion(rig.frameQ).add(rig.spreaderPos);
        }

        function gearCableRecord(cable) {
            if (!cable) return null;
            if (cable.role === 'upper') return (state.gear.uppers && state.gear.uppers[cable.index]) || null;
            if (cable.role === 'leg') return (state.gear.legs && state.gear.legs[cable.index]) || null;
            if (cable.role === 'hanger') return (state.gear.hangers && state.gear.hangers[cable.index]) || null;
            if (cable.role === 'extra') return ((state.gear.extraCables || [])[cable.index]) || null;
            return null;
        }

        function estimateCableMassKg(cable) {
            const rec = gearCableRecord(cable);
            if (rec && rec.massKg != null && rec.massKg > 0) return rec.massKg;
            const len = Math.max(0.4, (cable && cable.L0) || state.slingLength || 2.5);
            let look = effectiveSlingType(rec);

            const parts = Math.max(1, Math.min(4, (rec && rec.parts) || 1));
            const d = Math.max(8, (rec && rec.diaMm) || (look === 'web' || look === 'round_sling' ? 60 : 20));
            let baseKg = 0;
            if (look === 'chain') baseKg = 0.022 * d * d * len + 1.8;
            else if (look === 'web') baseKg = 0.018 * d * len + 0.9;
            else if (look === 'round_sling') baseKg = 0.016 * d * len + 1.1;
            else if (look === 'grommet') baseKg = 0.0072 * d * d * len + 2.8;
            else baseKg = 0.0041 * d * d * len + 2.2;
            return baseKg * parts;
        }

        // Split a snapped cable into two free-hanging stubs. Upper stub hangs from end A
        // under its own mass only; lower stub hangs from end B. No A↔B tension remains.
        function initCableBreak(cable, frac) {
            if (!cable) return null;
            const pA = cable.a ? attachWorld(cable.a) : phy.hookPos.clone();
            const pB = cable.b ? attachWorld(cable.b) : phy.cargoPos.clone();
            const span = Math.max(0.25, pA.distanceTo(pB));
            const L0 = Math.max(0.35, cable.L0 || span);
            const f = THREE.MathUtils.clamp(frac != null ? frac : 0.48, 0.22, 0.78);
            const mid = pA.clone().lerp(pB, f);
            const along = pB.clone().sub(pA);
            if (along.lengthSq() < 1e-8) along.set(0, -1, 0);
            else along.normalize();
            const massKg = Math.max(0.4, estimateCableMassKg(cable));
            // A real severed sling unloads, but an inextensible simulation has
            // no large stored spring energy to launch it metres through the air.
            // Keep only a small directional recoil; gravity then dominates.
            const sep = 0.10 + simRandom() * 0.08;
            const jitter = () => (simRandom() - 0.5) * 0.10;
            // Capture attachment velocity so stubs inherit the motion at the snap instant
            const vA = endVelocity(cable.a, phy.cargoVel.clone(), phy.cargoOmega.clone());
            const vB = endVelocity(cable.b, phy.cargoVel.clone(), phy.cargoOmega.clone());
            const vMid = vA.clone().lerp(vB, f);
            const velU = vMid.clone().addScaledVector(along, -sep).add(new THREE.Vector3(jitter(), 0.04 + simRandom() * 0.06, jitter()));
            const velL = vMid.clone().addScaledVector(along, sep).add(new THREE.Vector3(jitter(), -0.08 - simRandom() * 0.08, jitter()));
            // Attachment motion is inherited, but a numerical contact impulse in
            // the previous solver frame must not turn a loose steel rope into a
            // projectile.  The cap is below a hazardous whip speed; gravity and
            // the attached rigid bodies still determine the subsequent motion.
            if (velU.length() > 0.30) velU.setLength(0.30);
            if (velL.length() > 0.30) velL.setLength(0.30);
            cable.break = {
                frac: f,
                upperLen: Math.max(0.16, L0 * f),
                lowerLen: Math.max(0.16, L0 * (1 - f)),
                tipU: mid.clone().addScaledVector(along, -0.03),
                tipL: mid.clone().addScaledVector(along, 0.03),
                velU,
                velL,
                massU: massKg * f,
                massL: massKg * (1 - f)
            };
            cable.tensionT = 0;
            cable.slack = true;
            cable._j = 0;
            return cable.break;
        }

        function ensureCableBreakState(cable) {
            if (!cable || !cableIsBroken(cable)) {
                if (cable && cable.break) cable.break = null;
                return null;
            }
            if (!cable.break) {
                // Manual broken=true (UI/test) still gets unload impulse + split stubs
                releaseSnapImpulse(cable);
                initCableBreak(cable);
            }
            return cable.break;
        }

        function clearCableBreak(cable) {
            if (cable) cable.break = null;
            if (typeof simAudio !== 'undefined') {
                const rec = gearCableRecord(cable);
                const reeveType = (rec && (rec.slingType || (rec.grade === 'g80' || rec.grade === 'g100' ? 'chain' : (rec.grade === 'poly' ? 'web' : (rec.grade === 'hmpe' ? 'round_sling' : 'wire'))))) || state.slingType || 'wire';
                simAudio.playCableReeve({
                    role: cable ? cable.role : 'leg',
                    type: reeveType
                });
            }
        }

        function settleBrokenTipOnSolids(tip, vel, previous, pad) {
            const radius = Math.max(0.018, pad || 0.024);
            const floor = supportY(tip.x, tip.z) + radius;
            let touching = false;
            let normal = null;
            if (tip.y < floor) {
                tip.y = floor;
                touching = true;
                normal = typeof supportNormal === 'function'
                    ? supportNormal(tip.x, tip.z)
                    : new THREE.Vector3(0, 1, 0);
            }

            // The cargo's local +Y is the normal of its tilted roof.  Removing
            // only the into-surface velocity retains the gravity component along
            // the roof, so the loose end actually slides off an inclined box.
            const roofY = typeof cargoRoofAtXZ === 'function'
                ? cargoRoofAtXZ(tip.x, tip.z, radius)
                : null;
            if (roofY != null && tip.y < roofY) {
                tip.y = roofY;
                touching = true;
                normal = new THREE.Vector3(0, 1, 0).applyQuaternion(phy.cargoQuat).normalize();
            }

            // Account for sides, beams and the cargo outer skin as well.  This
            // prevents a high-speed free end from tunnelling through a lid/rail.
            if (typeof pushPointClear === 'function') {
                const clear = pushPointClear(tip, radius, new Set());
                const correction = clear.clone().sub(tip);
                if (correction.lengthSq() > 1e-10) {
                    tip.copy(clear);
                    touching = true;
                    normal = correction.normalize();
                }
            }
            if (!touching || !normal) return;
            const into = vel.dot(normal);
            if (into < 0) vel.addScaledVector(normal, -into);
            // Surface friction kills only tangential energy; it must not pin the
            // tip against an inclined container roof.
            const vn = normal.clone().multiplyScalar(vel.dot(normal));
            vel.sub(vn).multiplyScalar(0.84).add(vn);
            if (previous && tip.distanceToSquared(previous) < 1e-7 && vel.lengthSq() < 0.004) vel.set(0, 0, 0);
        }

        function stepFreeRopeTip(tip, vel, pin, restLen, dt) {
            if (!tip || !vel || !pin) return;
            const L = Math.max(0.12, restLen || 0.5);
            const previous = tip.clone();
            vel.y -= G_EARTH * dt;
            // Air drag on a dangling wire stub
            const spd = vel.length();
            if (spd > 0.05) vel.addScaledVector(vel, -Math.min(1.8, 0.55 * spd) * dt / spd);
            tip.addScaledVector(vel, dt);
            settleBrokenTipOnSolids(tip, vel, previous, 0.024);
            const rel = tip.clone().sub(pin);
            const dist = rel.length();
            if (!(dist > 1e-6)) {
                tip.copy(pin).add(new THREE.Vector3(0.02, -Math.min(L, 0.35), 0));
                return;
            }
            const n = rel.multiplyScalar(1 / dist);
            // Unilateral inextensible stub: taut when stretched past rest length
            if (dist > L) {
                tip.copy(pin).addScaledVector(n, L);
                const vRad = vel.dot(n);
                if (vRad > 0) vel.addScaledVector(n, -vRad);
                settleBrokenTipOnSolids(tip, vel, previous, 0.024);
            }
        }

        // Attachment only feels the stub's own hanging weight — never the far-side payload.
        function applyHangingStubPull(end, pin, tip, restLen, massKg, dt, invMass, invI, vCom, omega) {
            if (!end || end.kind === 'hook' || !(massKg > 0.05) || !pin || !tip) return;
            const L = Math.max(0.12, restLen || 0.5);
            const delta = tip.clone().sub(pin);
            const dist = delta.length();
            if (!(dist > 0.04) || dist < L * 0.92) return;
            const n = delta.multiplyScalar(1 / dist); // pin → tip (rope pulls attachment toward tip)
            const vertical = Math.max(0, -n.y);
            const T = massKg * G_EARTH * (0.35 + 0.65 * vertical);
            kickEnd(end, n, T * dt, invMass, invI, vCom, omega);
        }

        function integrateBrokenCableStubs(dt, invMass, invI, vCom, omega) {
            (phy.cables || []).forEach(c => {
                if (!cableIsBroken(c)) {
                    if (c.break) c.break = null;
                    return;
                }
                const br = ensureCableBreakState(c);
                if (!br) return;
                const pinU = attachWorld(c.a);
                const pinL = attachWorld(c.b);
                stepFreeRopeTip(br.tipU, br.velU, pinU, br.upperLen, dt);
                stepFreeRopeTip(br.tipL, br.velL, pinL, br.lowerLen, dt);
                applyHangingStubPull(c.a, pinU, br.tipU, br.upperLen, br.massU, dt, invMass, invI, vCom, omega);
                applyHangingStubPull(c.b, pinL, br.tipL, br.lowerLen, br.massL, dt, invMass, invI, vCom, omega);
            });
        }

        function releaseSnapImpulse(cable) {
            if (!cable || !cable.b || cable.b.kind === 'hook') return;
            const isGrounded = (phy.groundClearance || 0) <= 0.05 || state.poseLock;
            const seenT = Math.max(
                cable.tensionT || 0,
                cable.role === 'leg' ? (phy.legTensions[cable.index] || 0) : 0,
                cable.role === 'upper' ? (phy.upperTensions[cable.index] || 0) : 0,
                isGrounded ? 0 : 0.35
            );
            if (seenT <= 1e-4) return;
            const pA = attachWorld(cable.a);
            const pB = attachWorld(cable.b);
            const unload = pB.clone().sub(pA);
            if (unload.lengthSq() < 1e-8) unload.set(0, -1, 0);
            else unload.normalize();
            // Soft unload only — large Δv from 90t+ snaps was launching bodies to NaN/infinity
            const mass = Math.max(80, state.weight * 1000);
            const maxDv = 0.75;
            const j = Math.min(seenT * 1000 * G_EARTH * 0.012, mass * maxDv);
            const invMass = 1 / mass;
            const invI = inertiaInverseAboutCog(mass, state.L, state.W, state.H, state.cogX, state.cogY, state.cogZ);
            if (!isGrounded) {
                kickEnd(cable.b, unload, j, invMass, invI, phy.cargoVel, phy.cargoOmega);
            }
            if (cable.a && cable.a.kind === 'body' && cable.a.body) {
                kickEnd(cable.a, unload.clone().negate(), j * 0.4, invMass, invI, phy.cargoVel, phy.cargoOmega);
            }
            if (phy.cargoVel.length() > 2.5) phy.cargoVel.setLength(2.5);
            if (phy.cargoOmega.length() > 1.2) phy.cargoOmega.setLength(1.2);
        }

        // A cable can be cut while the scenario is still in the convenient
        // "placed pose" preview mode.  A broken load path is never a pose: it must
        // immediately enter the dynamic solver so gravity and the remaining cables
        // can create the resulting swing, tilt, or fall on the next substep.
        function releaseRigForCableFailure() {
            if (!state.poseLock) return;
            state.poseLock = false;
            phy.rigLive = true;
            // The locked pose has no accumulated dynamic velocity.  Start the
            // failure from rest rather than inheriting stale values from a prior run.
            if (phy.cargoVel) phy.cargoVel.set(0, 0, 0);
            if (phy.cargoOmega) phy.cargoOmega.set(0, 0, 0);
            (phy.beams || []).forEach(b => {
                if (b.v) b.v.set(0, 0, 0);
                if (b.w) b.w.set(0, 0, 0);
            });
            syncPoseLockUI();
        }

        // A parted frame top bridle instantly removes the reaction at one
        // corner of the load path.  Preserve that real unbalanced moment as a
        // small angular impulse rather than waiting for a perfectly symmetric
        // constraint solver to discover it several frames later.  Equal cuts
        // at all four corners cancel naturally, while a single off-centre cut
        // starts the expected heavy, smooth list.
        function applyLostFrameBranchMoment(cable) {
            if (!cable || cable._frameMomentApplied || cable.role !== 'upper'
                || state.beamType !== 'frame' || (phy.groundClearance || 0) <= 0.05) return;
            const lower = (phy.cables || []).find(c => c.role === 'leg' && c.index === cable.index);
            if (!lower || !lower.b || lower.b.kind !== 'cargo') return;
            const mass = Math.max(80, (phy.effectiveCargoWeightT != null ? phy.effectiveCargoWeightT : state.weight) * 1000);
            const com = cargoComNow();
            const r = attachWorld(lower.b).sub(com);
            // Approximate the lost share of vertical support over the short
            // shock-transfer interval.  It is deliberately modest: gravity
            // and the remaining legs then govern the continuing motion.
            const lostReaction = new THREE.Vector3(0, -mass * G_EARTH * 0.30, 0);
            const torque = new THREE.Vector3().crossVectors(r, lostReaction);
            const invI = inertiaInverseAboutCog(mass, state.L, state.W, state.H, state.cogX, state.cogY, state.cogZ);
            const dOmega = alphaFromTorque(torque, phy.cargoQuat, invI).multiplyScalar(0.30);
            if (dOmega.length() > 0.22) dOmega.setLength(0.22);
            phy.cargoOmega.add(dOmega);
            cable._frameMomentApplied = true;
        }

        function noteCableSnap(cable, message) {
            releaseRigForCableFailure();
            const rec = gearCableRecord(cable);
            if (rec) rec.broken = true;
            releaseSnapImpulse(cable);
            applyLostFrameBranchMoment(cable);
            initCableBreak(cable);
            if (cable) cable._failureProcessed = true;
            const isGrounded = (phy.groundClearance || 0) <= 0.05 || state.poseLock;
            phy.shock = isGrounded ? 1.0 : 1.8;
            phy.shockFrames = isGrounded ? 0 : 14;
            const br = cable && cable.break;
            const pin = br ? br.tipU.clone().lerp(br.tipL, 0.5)
                : (cable.b ? attachWorld(cable.b) : phy.cargoPos.clone());
            spawnSnapSparks(pin);
            if (typeof simAudio !== 'undefined') {
                const snapType = (rec && (rec.slingType || (rec.grade === 'g80' || rec.grade === 'g100' ? 'chain' : (rec.grade === 'poly' ? 'web' : (rec.grade === 'hmpe' ? 'round_sling' : 'wire'))))) || state.slingType || 'wire';
                simAudio.playCableSnap({
                    role: cable ? cable.role : 'leg',
                    type: snapType
                });
            }
            const status = document.getElementById('sim-status-text');
            if (status) {
                if (isGrounded) {
                    status.textContent = message + ' Kiện hàng đang nằm trên mặt đất/đà kê — giữ nguyên trạng thái cân bằng trên sàn.';
                } else {
                    status.textContent = message + ' Các nhánh còn lại nhận hệ số xung kích 1.8.';
                }
            }
        }

        function spawnSnapSparks(origin) {
            if (!origin) return;
            if (!phy.sparkGroup) {
                phy.sparkGroup = new THREE.Group();
                scene.add(phy.sparkGroup);
            }
            const geo = new THREE.SphereGeometry(0.035, 6, 6);
            for (let i = 0; i < 14; i++) {
                const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: i % 2 ? 0xf97316 : 0xfacc15, transparent: true, opacity: 1 }));
                m.position.copy(origin);
                m.userData.vel = new THREE.Vector3((simRandom() - 0.5) * 6, simRandom() * 5, (simRandom() - 0.5) * 6);
                m.userData.life = 28;
                phy.sparkGroup.add(m);
            }
        }

        function publishXpbdLoads() {
            for (let i = 0; i < 8; i++) {
                phy.legTensions[i] = 0;
                phy.legSlacks[i] = true;
                phy.legForceN[i] = 0;
                if (i < 4) phy.upperTensions[i] = 0;
            }
            const grossLoadT = phy.massBreakdown ? phy.massBreakdown.grossCraneLoadT : (state.weight + (phy.gearWeight || 1.0));
            (phy.cables || []).forEach(c => {
                const n = c.n || new THREE.Vector3(0, 1, 0);
                const horiz = Math.abs(Math.asin(THREE.MathUtils.clamp(n.y, -1, 1)) * 180 / Math.PI);
                const slack = !(c.tensionT > 0.02) || cableIsBroken(c);
                if (c.role === 'leg' && c.index < 8 && state.gear.legs[c.index]) {
                    const leg = state.gear.legs[c.index];
                    phy.legAngleDeg[c.index] = horiz;
                    phy.legFactor[c.index] = 1 / Math.max(0.5, Math.abs(n.y));
                    phy.legSlacks[c.index] = slack;
                    const shock = (phy.shockFrames || 0) > 0 ? Math.min(1.35, Math.max(1.05, phy.shock || 1.18)) : 1;
                    // Clamp numerical solver impulse chatter to maximum physical dynamic load
                    const maxPhysicalLegT = grossLoadT * 2.0 * (phy.legFactor[c.index] || 1.0);
                    const physicalT = Math.min(c.tensionT, maxPhysicalLegT);
                    const seen = slack ? 0 : physicalT * shock;
                    phy.legTensions[c.index] = seen;
                    const mbl = legSwl(c.index) * Math.max(1.5, leg.sf || 5);
                    if (!slack && seen > mbl && phy.groundClearance >= 0.05) phy.breakHold[c.index] = (phy.breakHold[c.index] || 0) + 1;
                    else phy.breakHold[c.index] = 0;
                    if (phy.breakHold[c.index] >= 15) {
                        noteCableSnap(c, `Cáp LP${c.index + 1} đứt: sức căng ${seen.toFixed(1)} t vượt MBL ${mbl.toFixed(1)} t (SWL ${legSwl(c.index).toFixed(1)} t × ${leg.sf || 5}, góc ngang ${horiz.toFixed(0)}°, hệ số ${phy.legFactor[c.index].toFixed(2)}).`);
                        phy.legTensions[c.index] = 0;
                        phy.legSlacks[c.index] = true;
                    }
                }
                if (c.role === 'upper' && c.index < 4 && state.gear.uppers[c.index]) {
                    const upper = state.gear.uppers[c.index];
                    if (!phy.upperAngleDeg) phy.upperAngleDeg = [];
                    phy.upperAngleDeg[c.index] = horiz;
                    const shockU = (phy.shockFrames || 0) > 0 ? Math.min(1.35, Math.max(1.05, phy.shock || 1.18)) : 1;
                    const maxPhysicalUpperT = grossLoadT * 2.0 * (1 / Math.max(0.4, Math.abs(n.y)));
                    const physicalUT = Math.min(c.tensionT, maxPhysicalUpperT);
                    const seenU = slack ? 0 : physicalUT * shockU;
                    phy.upperTensions[c.index] = seenU;
                    const mbl = upperSwl(c.index) * Math.max(1.5, upper.sf || 5);
                    if (!slack && !upper.broken && seenU > mbl && phy.groundClearance >= 0.05) phy.upperBreakHold[c.index] += 1;
                    else phy.upperBreakHold[c.index] = 0;
                    if (phy.upperBreakHold[c.index] >= 15) {
                        noteCableSnap(c, `Cáp treo dầm ${c.index + 1} đứt: sức căng ${seenU.toFixed(1)} t vượt MBL ${mbl.toFixed(1)} t.`);
                        phy.upperTensions[c.index] = 0;
                    }
                }
                if (c.role === 'hanger' && state.gear.hangers && state.gear.hangers[c.index]) {
                    const hItem = state.gear.hangers[c.index];
                    const shockH = (phy.shockFrames || 0) > 0 ? Math.min(1.35, Math.max(1.05, phy.shock || 1.18)) : 1;
                    const maxPhysicalHangerT = grossLoadT * 2.0;
                    const physicalHT = Math.min(c.tensionT, maxPhysicalHangerT);
                    const seenH = slack ? 0 : physicalHT * shockH;
                    if (!phy.hangerTensions) phy.hangerTensions = [];
                    phy.hangerTensions[c.index] = seenH;
                    const mbl = (hItem.swlT || 25) * Math.max(1.5, hItem.sf || 5);
                    if (!slack && !hItem.broken && seenH > mbl && phy.groundClearance >= 0.05) {
                        noteCableSnap(c, `Cáp treo tầng dầm ${c.index + 1} đứt: sức căng ${seenH.toFixed(1)} t vượt MBL ${mbl.toFixed(1)} t.`);
                        phy.hangerTensions[c.index] = 0;
                    }
                }
            });
            const taut = [];
            for (let i = 0; i < state.lugs.length; i++) if (!phy.legSlacks[i]) taut.push(phy.legAngleDeg[i]);
            if (taut.length) phy.maxAngleVert = 90 - Math.min.apply(null, taut);
        }

        function publishCableLoads() {
            if (phy.cables && phy.cables.length) {
                publishXpbdLoads();
                return;
            }
            const rig = computeRigPose();
            const weightT = state.weight;
            const rCog = new THREE.Vector3(state.cogX, state.cogY, state.cogZ).applyQuaternion(phy.cargoQuat);
            const com = phy.cargoPos.clone().add(rCog);
            const geos = [];
            for (let i = 0; i < 4; i++) {
                const eye = lugEyeWorld(i);
                const anchor = slingAnchorWorld(i, rig);
                const delta = anchor.clone().sub(eye);
                const dist = delta.length();
                const L0 = legRestLength(i, rig.spec);
                const n = dist > 1e-4 ? delta.multiplyScalar(1 / dist) : new THREE.Vector3(0, 1, 0);
                const horiz = Math.asin(THREE.MathUtils.clamp(n.y, -1, 1)) * 180 / Math.PI;
                phy.legAngleDeg[i] = horiz;
                phy.legFactor[i] = 1 / Math.max(0.5, n.y);
                const broken = !!state.gear.legs[i].broken;
                geos.push({ eye, n, dist, slack: broken || dist < L0 - 0.02, ny: n.y, rx: eye.x - com.x, rz: eye.z - com.z });
            }
            const tautIdx = geos.map((g, i) => (!g.slack ? i : -1)).filter(i => i >= 0);
            const targets = [0, 0, 0, 0];
            if (tautIdx.length) {
                const groundFactor = phy.groundClearance > 0.02
                    ? 1.0
                    : Math.max(0.1, Math.min(1.0, (phy.groundClearance + 0.01) / 0.03));
                const effectiveWeight = weightT * groundFactor;
                const shares = verticalShares(tautIdx.map(i => geos[i]), effectiveWeight);
                const maxAllowedShare = (weightT / Math.max(2, geos.length)) * 1.5;
                tautIdx.forEach((i, k) => {
                    const ny = Math.max(0.5, geos[i].ny);
                    const snatch = Math.max(0, -phy.cargoVel.y) * 0.1 + Math.abs(phy.hookVel.y) * 0.06;
                    const dyn = 1 + Math.min(0.25, snatch);
                    const rawShare = (phy.groundClearance < 0.02) ? Math.min(shares[k], maxAllowedShare) : shares[k];
                    targets[i] = rawShare / ny * dyn;
                    phy.legFactor[i] = (1 / ny) * dyn;
                });
            }
            for (let i = 0; i < 4; i++) {
                const leg = state.gear.legs[i];
                phy.legSlacks[i] = geos[i].slack;
                if (leg.broken) {
                    phy.legTensions[i] = 0;
                    phy.breakHold[i] = 0;
                    continue;
                }
                phy.legTensions[i] = THREE.MathUtils.lerp(phy.legTensions[i] || 0, targets[i], 0.65);
                if (phy.legSlacks[i] && phy.legTensions[i] < 0.05) phy.legTensions[i] = 0;
                const mbl = legSwl(i) * Math.max(1.5, leg.sf || 5);
                if (!phy.legSlacks[i] && targets[i] > mbl && phy.groundClearance >= 0.02) phy.breakHold[i] += 1;
                else phy.breakHold[i] = 0;
                if (phy.breakHold[i] >= 8) {
                    leg.broken = true;
                    phy.legTensions[i] = 0;
                    phy.legSlacks[i] = true;
                    const status = document.getElementById('sim-status-text');
                    if (status) status.textContent = `Cáp LP${i + 1} đứt: sức căng ${targets[i].toFixed(1)} t vượt MBL ${mbl.toFixed(1)} t (SWL ${legSwl(i).toFixed(1)} t × ${leg.sf || 5}, góc ngang ${phy.legAngleDeg[i].toFixed(0)}°, hệ số ${phy.legFactor[i].toFixed(2)}).`;
                }
            }

            const uppers = activeUpperIndexes();
            phy.upperTensions = [0, 0, 0, 0];
            const carried = tautIdx.length ? weightT : Math.max(0.2, phy.gearWeight);
            const upperLegs = [];
            uppers.forEach(i => {
                if (state.gear.uppers[i].broken) return;
                const end = upperAnchorWorld(i, rig);
                const delta = rig.master.clone().sub(end);
                const dist = delta.length();
                const L0 = upperRestLength(i, rig.spec);
                if (dist < L0 - 0.02 || dist < 1e-4) return;
                const n = delta.multiplyScalar(1 / dist);
                upperLegs.push({ i, ny: n.y, rx: end.x - rig.master.x, rz: end.z - rig.master.z });
            });
            if (upperLegs.length) {
                const shares = verticalShares(upperLegs, carried);
                upperLegs.forEach((leg, k) => {
                    const ny = Math.max(0.5, leg.ny);
                    phy.upperTensions[leg.i] = shares[k] / ny;
                });
            }
            uppers.forEach(i => {
                const upper = state.gear.uppers[i];
                const mbl = upperSwl(i) * Math.max(1.5, upper.sf || 5);
                const tension = phy.upperTensions[i] || 0;
                if (!upper.broken && tension > mbl && phy.groundClearance >= 0.02) phy.upperBreakHold[i] += 1;
                else phy.upperBreakHold[i] = 0;
                if (phy.upperBreakHold[i] >= 8) {
                    upper.broken = true;
                    phy.upperTensions[i] = 0;
                    const status = document.getElementById('sim-status-text');
                    if (status) status.textContent = `Cáp treo dầm ${i + 1} đứt: sức căng vượt MBL ${mbl.toFixed(1)} t sau khi nhân hệ số góc.`;
                }
            });
            const tautHoriz = tautIdx.map(i => phy.legAngleDeg[i]);
            if (tautHoriz.length) phy.maxAngleVert = 90 - Math.min(...tautHoriz);
        }

        function inertiaInverseAboutCog(mass, L, W, H, cx, cy, cz) {
            const Ixx = Math.max(10, mass * (W * W + H * H) / 12);
            const Iyy = Math.max(10, mass * (L * L + W * W) / 12);
            const Izz = Math.max(10, mass * (L * L + H * H) / 12);
            return {
                Ixx: 1 / Ixx,
                Iyy: 1 / Iyy,
                Izz: 1 / Izz,
                Ixy: 0,
                Ixz: 0,
                Iyz: 0
            };
        }

        function applyInertiaInverse(invM, v) {
            return new THREE.Vector3(
                invM.Ixx * v.x + invM.Ixy * v.y + invM.Ixz * v.z,
                invM.Ixy * v.x + invM.Iyy * v.y + invM.Iyz * v.z,
                invM.Ixz * v.x + invM.Iyz * v.y + invM.Izz * v.z
            );
        }

        function alphaFromTorque(torqueWorld, quat, invM) {
            const invQ = quat.clone().invert();
            const local = torqueWorld.clone().applyQuaternion(invQ);
            return applyInertiaInverse(invM, local).applyQuaternion(quat);
        }

        function winchSpeedForLoad() {
            const massT = state.weight + (phy.gearWeight || 0);
            const swl = Math.max(5, state.gear && state.gear.hook ? state.gear.hook.swlT : 50);
            const vMax = 1.15;
            let v = vMax * Math.max(0.15, 1 - 0.78 * (massT / swl));
            const takingUp = phy.groundClearance < 0.05 && (phy.cables || []).some(c => c.role === 'leg' && (c.tensionT || 0) > 0.2 && !cableIsBroken(c));
            if (takingUp) v *= 0.34;
            return v;
        }

        // Ensures the 3D Hook Block + J-Hook + Master Link (extending down to y - 0.58m) NEVER penetrates
        // Ensures the 3D Hook Block + J-Hook + Master Link (extending down to y - 0.58m) NEVER penetrates
        // the Cargo outer shell, any Spreader/Lifting Beam body, or the Floor in any mode.
        function clampHookOutOfSolids() {
            const masterBottomOffset = 0.58; // Outer bottom of red Master Link below phy.hookPos.y
            let minHookY = supportY(phy.hookPos.x, phy.hookPos.z) + masterBottomOffset + 0.02;

            // Only allow cargo or beams to constrain the hook's minimum lowering floor
            // if the cargo is genuinely resting flat on the ground (pre-lift).
            // A suspended, airborne, or tilting load hangs from the crane hook and can NEVER
            // catapult the crane hook into the sky!
            const groundY = supportY(phy.cargoPos.x, phy.cargoPos.z);
            const cargoGrounded = phy.cargoPos.y <= groundY + state.H * 0.5 + 0.04 &&
                                  Math.abs(phy.cargoVel.y) < 0.10 &&
                                  !phy.autoHoistActive &&
                                  phy.hoistSpeed <= 0;

            if (cargoGrounded) {
                // 1. Check cargo 3D outer shell directly beneath hook (x, z)
                const shellTop = cargoShellTopWorldY(phy.hookPos.x, phy.hookPos.z, 0.20);
                if (shellTop > -1e5) {
                    minHookY = Math.max(minHookY, shellTop + masterBottomOffset + 0.02);
                }

                // 2. Check active spreader / lifting beam 3D bodies resting on cargo
                if (state.beamType !== 'none') {
                    const spec = getRigSpec();
                    const beamFloorY = cargoCeilingUnderBeam(phy.hookPos.x, phy.hookPos.z, spec);
                    (phy.beams || []).forEach(b => {
                        if (b.axis === 'frame') return; // Frame spreaders have an open center
                        const ends = segmentEnds(b);
                        const ab = ends[1].clone().sub(ends[0]);
                        const len2 = Math.max(1e-8, ab.lengthSq());
                        const t = THREE.MathUtils.clamp(
                            ((phy.hookPos.x - ends[0].x) * ab.x + (phy.hookPos.z - ends[0].z) * ab.z) / len2,
                            0,
                            1
                        );
                        const p = ends[0].clone().addScaledVector(ab, t);
                        const dHoriz = Math.hypot(phy.hookPos.x - p.x, phy.hookPos.z - p.z);
                        const bRad = (b.radius || 0.14);
                        const isResting = beamFloorY > -1e5 && Math.abs(p.y - beamFloorY) < 0.25;
                        if (isResting && dHoriz < bRad + 0.24 && phy.hookPos.y <= p.y + bRad + masterBottomOffset + 0.05) {
                            minHookY = Math.max(minHookY, p.y + bRad + masterBottomOffset + 0.02);
                        }
                    });
                }

                // 3. Test 3D spheres of the Hook Assembly against cargo outer shell
                const hookSpheres = [
                    { dy: -0.50, r: 0.12 },
                    { dy: -0.26, r: 0.18 },
                    { dy:  0.28, r: 0.26 }
                ];
                for (let i = 0; i < hookSpheres.length; i++) {
                    const hs = hookSpheres[i];
                    const center = new THREE.Vector3(phy.hookPos.x, phy.hookPos.y + hs.dy, phy.hookPos.z);
                    const pushed = pushOutOfCargoShellWorld(center, hs.r, false);
                    if (pushed.distanceToSquared(center) > 1e-8) {
                        const diff = pushed.sub(center);
                        if (diff.y > 0) {
                            minHookY = Math.max(minHookY, phy.hookPos.y + diff.y);
                        } else {
                            phy.hookPos.x += diff.x;
                            phy.hookPos.z += diff.z;
                        }
                    }
                }
            }

            if (phy.hookPos.y < minHookY) {
                phy.hookPos.y = minHookY;
                if (phy.hookVel.y < 0) phy.hookVel.y = 0;
            }
        }

        // Return 0 while the load-supporting legs are genuinely slack and 1
        // once they are transmitting the cargo load.  Upper bridles by
        // themselves carry only the light spreader, so they do not make a
        // mouse drag feel like it is hauling the full cargo prematurely.
        function hookDragLoadCoupling() {
            const legs = (phy.cables || []).filter(c => c.role === 'leg' && !cableIsBroken(c)
                && c.b && c.b.kind === 'cargo');
            if (!legs.length) return 0;

            let active = 0;
            let nearTaut = 0;
            let peakTension = 0;
            legs.forEach(cable => {
                const span = attachWorld(cable.a).distanceTo(attachWorld(cable.b));
                const tension = Math.max(0, cable.tensionT || 0, phy.legTensions[cable.index] || 0);
                const reportedSlack = cable.slack === true || phy.legSlacks[cable.index] === true;
                const isNearTaut = span >= cable.L0 - 0.045;
                // A constraint can be reported as non-slack one integration
                // frame before tension telemetry is written.  Count it only
                // once it reaches its declared length, avoiding false heavy
                // feel while a loose line is still draped over the cargo.
                if (!reportedSlack && (tension > 0.025 || isNearTaut)) active++;
                if (isNearTaut) nearTaut++;
                peakTension = Math.max(peakTension, tension);
            });

            const activeRatio = active / legs.length;
            const nearRatio = nearTaut / legs.length;
            const expectedPerLeg = Math.max(0.25, (state.weight || 1) / Math.max(1, legs.length));
            const tensionRatio = THREE.MathUtils.clamp(peakTension / expectedPerLeg, 0, 1);
            // A suspended load can be exactly at L0 on a solver frame, making
            // the per-frame impulse telemetry momentarily zero.  Geometry still
            // proves that its legs are carrying the load; mouse drag must feel
            // resisted there, while the same near-taut geometry on the ground
            // remains a light/slack command.
            const airborneNearTaut = !state.poseLock && (phy.groundClearance || 0) > 0.12
                ? nearRatio * 0.62
                : nearRatio * 0.16;
            // Near-taut is intentionally only a light pre-load.  The response
            // becomes properly heavy once force is measured in the legs.
            return THREE.MathUtils.clamp(Math.max(activeRatio * 0.78, tensionRatio * 0.92, airborneNearTaut), 0, 1);
        }

        function advanceMouseHookDrive(dt) {
            const demand = THREE.MathUtils.clamp((dragTarget && dragTarget.pointerSpeed) || 0.25, 0.08, 8.0);
            const coupling = hookDragLoadCoupling();
            // Empty/slack rig follows a brisk mouse pull.  At full cargo
            // coupling, cap speed and acceleration to emulate a loaded hoist
            // absorbing energy through the rigging rather than teleporting it.
            // The last portion of slack disappears very quickly in a real
            // pick.  Shape the response so a nearly taut 22 t load feels
            // heavy already at 80–90% coupling, rather than staying quick
            // until an abrupt hard stop at exactly 100%.
            const resistance = Math.pow(coupling, 0.45);
            const speedCap = THREE.MathUtils.lerp(6.4, 0.45, resistance);
            const requested = Math.min(demand, speedCap);
            const current = Math.max(0, phy.dragHookSpeed || 0);
            const rate = requested >= current
                ? THREE.MathUtils.lerp(13.0, 1.65, resistance)
                : THREE.MathUtils.lerp(19.0, 3.8, resistance);
            phy.dragHookSpeed = THREE.MathUtils.clamp(
                current + THREE.MathUtils.clamp(requested - current, -rate * dt, rate * dt),
                0,
                speedCap
            );
            phy.dragHookLoadCoupling = coupling;
            return Math.max(0.08, phy.dragHookSpeed);
        }

        function advanceHook(dt) {
            const prev = phy.hookPos.clone();
            const dragging = dragTarget && dragTarget.type === 'hook';
            const manual = dragging || Math.abs(phy.hoistSpeed) > 0.01;
            if (manual) phy.autoHoistActive = false;

            // Always use physical, finite winch speeds — NEVER teleport phy.hookPos!
            let maxWinch = dragging
                ? advanceMouseHookDrive(dt)
                : (phy.autoHoistActive ? 1.05 : (Math.abs(phy.hoistSpeed) > 0.01 ? Math.abs(phy.hoistSpeed) : 1.6));
            if (!dragging) {
                phy.dragHookSpeed = 0;
                phy.dragHookLoadCoupling = 0;
            }

            const rising = phy.autoHoistActive || phy.hoistSpeed > 0.01 || (phy.hookTarget.y > phy.hookPos.y + 0.01);

            // ASME B30.9 & OSHA Hard-coded safety trigger: Horizontal angle < 30° strictly blocks lifting
            const isLegBroken = (idx) => !!(state.gear && state.gear.legs && state.gear.legs[idx] && state.gear.legs[idx].broken);
            const tautAngles = (phy.legAngleDeg || []).filter((deg, i) => !isLegBroken(i) && (!phy.legSlacks || !phy.legSlacks[i]));
            const minHorizAngle = tautAngles.length ? Math.min(...tautAngles) : Math.max(0, 90 - (phy.maxAngleVert || 0));
            // The calculated automatic rig is designed at the 30° limit.
            // Allow a 1° numerical tolerance at pick-up; without it minute
            // XPBD/mesh rounding blocks a legal geometry before it can ever
            // take load.  Truly shallow (<29°) legs remain hard-blocked.
            const isAngleProhibited = minHorizAngle < 29.0 && (!phy.legSlacks || !phy.legSlacks.every(s => s));
            phy.isOperationBlocked = isAngleProhibited;

            if (isAngleProhibited && rising && phy.groundClearance > -0.02) {
                phy.autoHoistActive = false;
                phy.hoistSpeed = 0;
                phy.hookTarget.y = Math.min(phy.hookTarget.y, prev.y);
                const banner = document.getElementById('fit-banner');
                if (banner) {
                    banner.style.display = 'block';
                    banner.textContent = state.lang === 'en'
                        ? `Error: Horizontal sling angle is less than 30 degrees (${minHorizAngle.toFixed(1)}°). Operation prohibited under ASME B30.9.`
                        : `Error: Horizontal sling angle is less than 30 degrees (${minHorizAngle.toFixed(1)}°). Operation prohibited under ASME B30.9. (Lỗi: Góc nâng ngang cáp < 30°. Nghiêm cấm thao tác cẩu theo ASME B30.9 & OSHA).`;
                }
            }

            if (rising && phy.groundClearance < 0.05) {
                const aboutToTaut = (phy.cables || []).some(c => {
                    if (cableIsBroken(c)) return false;
                    // Only the lower legs can pick the cargo from the ground.
                    // Upper bridles becoming taut merely raise their own beam;
                    // throttling for those made basket/frame assemblies creep
                    // at 0.28 m/s for the whole empty take-up stroke.
                    return c.role === 'leg' && c.b && c.b.kind === 'cargo'
                        && attachWorld(c.a).distanceTo(attachWorld(c.b)) > c.L0 - 0.15;
                });
                if (aboutToTaut) maxWinch = Math.min(maxWinch, 0.28);
            }

            // Prevent hookTarget from running far ahead of hookPos while holding hoist button
            if (Math.abs(phy.hoistSpeed) > 0.01) {
                const maxLead = 0.04;
                phy.hookTarget.y = THREE.MathUtils.clamp(phy.hookTarget.y, phy.hookPos.y - maxLead, phy.hookPos.y + maxLead);
            }

            const to = new THREE.Vector3().subVectors(phy.hookTarget, phy.hookPos);
            const dist = to.length();
            const maxStep = maxWinch * dt;
            if (dist <= maxStep || dist < 1e-5) {
                phy.hookPos.copy(phy.hookTarget);
                phy.autoHoistActive = false;
            } else {
                phy.hookPos.addScaledVector(to.multiplyScalar(1 / dist), maxStep);
            }

            clampHookOutOfSolids();

            phy.hookVel.subVectors(phy.hookPos, prev).divideScalar(Math.max(dt, 1e-4));
            if (phy.hookVel.length() > 1.25) phy.hookVel.setLength(1.25);
        }

        function supportPointsLocal() {
            if (phy.supportLocals && phy.supportLocals.length) return phy.supportLocals;
            const { L, W, H } = state;
            return [
                new THREE.Vector3(-L / 2, -H / 2, -W / 2),
                new THREE.Vector3(L / 2, -H / 2, -W / 2),
                new THREE.Vector3(L / 2, -H / 2, W / 2),
                new THREE.Vector3(-L / 2, -H / 2, W / 2)
            ];
        }

        function rodInertiaInverse(mass, length, axis) {
            if (axis === 'frame') {
                const { spanX, spanZ } = getLPBoundingSpan();
                const sx = Math.max(0.5, spanX);
                const sz = Math.max(0.5, spanZ);
                const Ixx = Math.max(25, mass * (sz * sz / 12 + 0.08));
                const Izz = Math.max(25, mass * (sx * sx / 12 + 0.08));
                const Iyy = Math.max(40, Ixx + Izz);
                return { Ixx: 1 / Ixx, Iyy: 1 / Iyy, Izz: 1 / Izz, Ixy: 0, Ixz: 0, Iyz: 0 };
            }
            const r = 0.24;
            const spin = Math.max(35, mass * (r * r + 0.06));
            const bend = Math.max(12, mass * (length * length / 12 + r * r));
            if (axis === 'z') return { Ixx: 1 / bend, Iyy: 1 / bend, Izz: 1 / spin, Ixy: 0, Ixz: 0, Iyz: 0 };
            return { Ixx: 1 / spin, Iyy: 1 / bend, Izz: 1 / bend, Ixy: 0, Ixz: 0, Iyz: 0 };
        }

        function disposeBeamGroups() {
            (phy.beamGroups || []).forEach(g => {
                if (typeof scene !== 'undefined' && scene) scene.remove(g);
                g.traverse(o => { if (o.geometry && o.geometry.dispose) o.geometry.dispose(); });
            });
            phy.beamGroups = [];
            phy.beams = [];
            phy.cables = [];
        }

        function endOf(kind, id, x, y, z, index) {
            if (kind === 'hook') return { kind: 'hook' };
            if (kind === 'cargo') return { kind: 'cargo', index: index };
            return { kind: 'body', id: id, local: [x, y, z] };
        }

        function picksOf(id, scale, axis) {
            const spec = memberSpec(id);
            if (spec) return spec;
            const span = Math.max(0.4, (axis === 'z' ? state.W : state.L) * scale);
            return { length: span, a: span / 2, b: -span / 2 };
        }

        function tierPlan(type) {
            if (type !== 'inline4' && type !== 'inline8' && type !== 'spatial8') return null;
            const sx = Math.max(1.6, state.L * 0.92);
            const sz = Math.max(0.7, state.W * 0.86);
            const yLug = state.H / 2 - 0.02;
            const bodies = [];
            const cables = [];
            const lugs = [];
            const addBody = (id, mass, spec, axis, origin) => {
                bodies.push({ id: id, mass: mass, length: spec.length, axis: axis, origin: origin.clone(), members: [id] });
            };
            if (type === 'inline4') {
                const top = picksOf('i4top', 0.62, 'x');
                const a = picksOf('i4lowA', 0.28, 'x');
                const b = picksOf('i4lowB', 0.28, 'x');
                const yTop = 1.15;
                const xC = 0.30 * sx;
                addBody('i4top', 820, top, 'x', new THREE.Vector3(0, yTop, 0));
                addBody('i4lowA', 280, a, 'x', new THREE.Vector3(xC, 0, 0));
                addBody('i4lowB', 280, b, 'x', new THREE.Vector3(-xC, 0, 0));
                cables.push({ role: 'upper', index: 1, a: endOf('hook'), b: endOf('body', 'i4top', top.a, 0, 0) });
                cables.push({ role: 'upper', index: 0, a: endOf('hook'), b: endOf('body', 'i4top', top.b, 0, 0) });
                cables.push({ role: 'hanger', index: 0, a: endOf('body', 'i4top', top.a, 0, 0), b: endOf('body', 'i4lowA', 0, 0, 0) });
                cables.push({ role: 'hanger', index: 1, a: endOf('body', 'i4top', top.b, 0, 0), b: endOf('body', 'i4lowB', 0, 0, 0) });
                [[ 'i4lowA', xC, a.a, 0 ], [ 'i4lowA', xC, a.b, 1 ], [ 'i4lowB', -xC, b.b, 2 ], [ 'i4lowB', -xC, b.a, 3 ]].forEach(row => {
                    cables.push({ role: 'leg', index: row[3], a: endOf('body', row[0], row[2], 0, 0), b: endOf('cargo', null, 0, 0, 0, row[3]) });
                    lugs.push(new THREE.Vector3(row[1] + row[2], yLug, 0));
                });
            } else if (type === 'spatial8') {
                const top = picksOf('s8top', 0.72, 'x');
                const midP = picksOf('s8midP', 0.70, 'z');
                const midM = picksOf('s8midM', 0.70, 'z');
                const bots = ['s8a', 's8b', 's8c', 's8d'].map(id => picksOf(id, 0.16, 'x'));
                const yTop = 2.2;
                const yMid = 1.1;
                const mx = 0.32 * sx;
                const mz = Math.max(0.35, midP.length * 0.5);
                addBody('s8top', 900, top, 'x', new THREE.Vector3(0, yTop, 0));
                addBody('s8midP', 320, midP, 'z', new THREE.Vector3(mx, yMid, 0));
                addBody('s8midM', 320, midM, 'z', new THREE.Vector3(-mx, yMid, 0));
                const seats = [[mx, mz], [mx, -mz], [-mx, mz], [-mx, -mz]];
                seats.forEach((seat, i) => addBody(bots[i] && ['s8a', 's8b', 's8c', 's8d'][i], 220, bots[i], 'x', new THREE.Vector3(seat[0], 0, seat[1])));
                cables.push({ role: 'upper', index: 1, a: endOf('hook'), b: endOf('body', 's8top', top.a, 0, 0) });
                cables.push({ role: 'upper', index: 0, a: endOf('hook'), b: endOf('body', 's8top', top.b, 0, 0) });
                cables.push({ role: 'hanger', index: 0, a: endOf('body', 's8top', top.a, 0, 0), b: endOf('body', 's8midP', 0, 0, 0) });
                cables.push({ role: 'hanger', index: 1, a: endOf('body', 's8top', top.b, 0, 0), b: endOf('body', 's8midM', 0, 0, 0) });
                [['s8midP', mx, midP.a, 's8a', 0], ['s8midP', mx, midP.b, 's8b', 1], ['s8midM', -mx, midM.a, 's8c', 2], ['s8midM', -mx, midM.b, 's8d', 3]].forEach(row => {
                    cables.push({ role: 'hanger', index: 2 + row[4], a: endOf('body', row[0], 0, 0, row[2]), b: endOf('body', row[3], 0, 0, 0) });
                });
                seats.forEach((seat, i) => {
                    const id = ['s8a', 's8b', 's8c', 's8d'][i];
                    const spec = bots[i];
                    [spec.a, spec.b].forEach((along, k) => {
                        const idx = i * 2 + k;
                        cables.push({ role: 'leg', index: idx, a: endOf('body', id, along, 0, 0), b: endOf('cargo', null, 0, 0, 0, idx) });
                        lugs.push(new THREE.Vector3(seat[0] + along, yLug, seat[1]));
                    });
                });
            } else {
                const top = picksOf('n8top', 0.50, 'x');
                const midP = picksOf('n8midP', 0.26, 'x');
                const midM = picksOf('n8midM', 0.26, 'x');
                const lows = ['n8a', 'n8b', 'n8c', 'n8d'].map(id => picksOf(id, 0.14, 'x'));
                const yTop = 2.2;
                const yMid = 1.05;
                const mids = [0.22 * sx, -0.22 * sx];
                const lowsX = [0.34 * sx, 0.12 * sx, -0.12 * sx, -0.34 * sx];
                addBody('n8top', 800, top, 'x', new THREE.Vector3(0, yTop, 0));
                addBody('n8midP', 300, midP, 'x', new THREE.Vector3(mids[0], yMid, 0));
                addBody('n8midM', 300, midM, 'x', new THREE.Vector3(mids[1], yMid, 0));
                lowsX.forEach((x, i) => addBody(['n8a', 'n8b', 'n8c', 'n8d'][i], 200, lows[i], 'x', new THREE.Vector3(x, 0, 0)));
                cables.push({ role: 'upper', index: 1, a: endOf('hook'), b: endOf('body', 'n8top', top.a, 0, 0) });
                cables.push({ role: 'upper', index: 0, a: endOf('hook'), b: endOf('body', 'n8top', top.b, 0, 0) });
                cables.push({ role: 'hanger', index: 0, a: endOf('body', 'n8top', top.a, 0, 0), b: endOf('body', 'n8midP', 0, 0, 0) });
                cables.push({ role: 'hanger', index: 1, a: endOf('body', 'n8top', top.b, 0, 0), b: endOf('body', 'n8midM', 0, 0, 0) });
                [[ 'n8midP', mids[0], midP.a, 'n8a', 0 ], [ 'n8midP', mids[0], midP.b, 'n8b', 1 ], [ 'n8midM', mids[1], midM.a, 'n8c', 2 ], [ 'n8midM', mids[1], midM.b, 'n8d', 3 ]].forEach(row => {
                    cables.push({ role: 'hanger', index: 2 + row[4], a: endOf('body', row[0], row[2], 0, 0), b: endOf('body', row[3], 0, 0, 0) });
                });
                lowsX.forEach((x, i) => {
                    const id = ['n8a', 'n8b', 'n8c', 'n8d'][i];
                    [lows[i].a, lows[i].b].forEach((along, k) => {
                        const idx = i * 2 + k;
                        cables.push({ role: 'leg', index: idx, a: endOf('body', id, along, 0, 0), b: endOf('cargo', null, 0, 0, 0, idx) });
                        lugs.push(new THREE.Vector3(x + along, yLug, 0));
                    });
                });
            }
            return { bodies: bodies, cables: cables, lugs: lugs };
        }

        function placeRigLugs() {
            const plan = tierPlan(state.beamType);
            if (!plan) {
                if (state.lugs.length > 4) {
                    state.lugs.length = 4;
                    state.lugNormals.length = 4;
                    setSymmetricLugsFromDimensions();
                }
                return false;
            }
            while (state.lugs.length < plan.lugs.length) {
                state.lugs.push(new THREE.Vector3());
                state.lugNormals.push(new THREE.Vector3(0, 1, 0));
            }
            state.lugs.length = plan.lugs.length;
            state.lugNormals.length = plan.lugs.length;
            plan.lugs.forEach((p, i) => {
                state.lugs[i].set(p.x, p.y, p.z);
                state.lugNormals[i].set(0, 1, 0);
            });
            return true;
        }

        function buildTierMeshes(type) {
            const plan = tierPlan(type);
            if (!plan) return;
            plan.bodies.forEach(b => {
                const rad = b.origin.y > 1.6 ? 0.1 : 0.065;
                const mesh = new THREE.Mesh(new THREE.CylinderGeometry(rad, rad, Math.max(0.35, b.length), 18));
                if (b.axis === 'x') mesh.rotation.z = Math.PI / 2;
                if (b.axis === 'z') mesh.rotation.x = Math.PI / 2;
                mesh.position.copy(b.origin);
                tagMember(mesh, b.id);
            });
            plan.cables.forEach(c => {
                if (!c.b || c.b.kind !== 'body') return;
                const host = plan.bodies.find(b => b.id === c.b.id);
                if (!host) return;
                const p = host.origin.clone().add(new THREE.Vector3(c.b.local[0], c.b.local[1], c.b.local[2]));
                addJointShackle(p.x, p.y, p.z, host.id, { role: c.role, index: c.index });
            });
        }

        function beamRecipe() {
            const type = state.beamType;
            const tier = tierPlan(type);
            if (tier) return tier;
            const bodies = [];
            const cables = [];
            const add = (id, mass, length, axis, origin, members) => {
                bodies.push({ id: id, mass: mass, length: length, axis: axis, origin: origin.clone(), members: members });
            };
            const mb = phy.massBreakdown || computeRiggingMassBreakdown();
            const hwShareKg = ((mb.slingsMassT + mb.shacklesMassT + mb.turnbucklesMassT) * 1000) * 0.5;
            const userBeamKg = (state.gear && state.gear.beam && state.gear.beam.massT != null && state.gear.beam.massT > 0)
                ? state.gear.beam.massT * 1000
                : null;

            if (type === 'none') {
                for (let i = 0; i < state.lugs.length; i++) cables.push({ role: 'leg', index: i, a: endOf('hook'), b: endOf('cargo', null, 0, 0, 0, i) });
                return { bodies: bodies, cables: cables, lugs: null };
            }
            if (type === 'spreader' || type === 'lifting_beam') {
                const m = memberSpec('main');
                const yLug = type === 'lifting_beam' ? 0.24 : 0.22;
                const selfKg = userBeamKg != null ? userBeamKg : estimateMemberStructuralMassKg('main');
                add('main', Math.max(45, selfKg + hwShareKg), m.length, 'x', new THREE.Vector3(), ['main']);
                cables.push({ role: 'upper', index: 1, a: endOf('hook'), b: endOf('body', 'main', m.a, yLug, 0) });
                cables.push({ role: 'upper', index: 0, a: endOf('hook'), b: endOf('body', 'main', m.b, yLug, 0) });
                [[0, m.a, 0.065], [3, m.a, -0.065], [1, m.b, 0.065], [2, m.b, -0.065]].forEach(pair => {
                    cables.push({ role: 'leg', index: pair[0], a: endOf('body', 'main', pair[1], -yLug, pair[2]), b: endOf('cargo', null, 0, 0, 0, pair[0]) });
                });
                return { bodies: bodies, cables: cables, lugs: null };
            }
            if (type === 'cascaded' || type === 'modular_truss') {
                const topId = type === 'modular_truss' ? 'truss' : 'top';
                const top = memberSpec(topId);
                const yTop = type === 'modular_truss' ? 0.85 : 1.15;
                const plus = memberSpec('lowPlus');
                const minus = memberSpec('lowMinus');
                const mTop = estimateMemberStructuralMassKg(topId);
                const mPlus = estimateMemberStructuralMassKg('lowPlus');
                const mMinus = estimateMemberStructuralMassKg('lowMinus');
                const scale = userBeamKg != null ? userBeamKg / Math.max(10, mTop + mPlus + mMinus) : 1.0;
                add(topId, Math.max(45, mTop * scale + hwShareKg * 0.4), top.length, 'x', new THREE.Vector3(0, yTop, 0), [topId]);
                add('lowPlus', Math.max(35, mPlus * scale + hwShareKg * 0.3), plus.length, 'z', new THREE.Vector3(top.a, 0, 0), ['lowPlus']);
                add('lowMinus', Math.max(35, mMinus * scale + hwShareKg * 0.3), minus.length, 'z', new THREE.Vector3(top.b, 0, 0), ['lowMinus']);
                cables.push({ role: 'upper', index: 1, a: endOf('hook'), b: endOf('body', topId, top.a, 0.22, 0) });
                cables.push({ role: 'upper', index: 0, a: endOf('hook'), b: endOf('body', topId, top.b, 0.22, 0) });
                cables.push({ role: 'hanger', index: 0, a: endOf('body', topId, top.a, -0.22, 0), b: endOf('body', 'lowPlus', 0, 0.18, 0) });
                cables.push({ role: 'hanger', index: 1, a: endOf('body', topId, top.b, -0.22, 0), b: endOf('body', 'lowMinus', 0, 0.18, 0) });
                [[0, 'lowPlus', plus.a], [3, 'lowPlus', plus.b], [1, 'lowMinus', minus.a], [2, 'lowMinus', minus.b]].forEach(row => {
                    cables.push({ role: 'leg', index: row[0], a: endOf('body', row[1], 0, -0.18, row[2]), b: endOf('cargo', null, 0, 0, 0, row[0]) });
                });
                return { bodies: bodies, cables: cables, lugs: null };
            }
            if (type === 'basket') {
                const pos = memberSpec('barPos');
                const neg = memberSpec('barNeg');
                const mPos = estimateMemberStructuralMassKg('barPos');
                const mNeg = estimateMemberStructuralMassKg('barNeg');
                const scale = userBeamKg != null ? userBeamKg / Math.max(10, mPos + mNeg) : 1.0;
                const halfX = spanBase().spanX / 2;
                add('barPos', Math.max(35, mPos * scale + hwShareKg * 0.5), pos.length, 'z', new THREE.Vector3(halfX, 0, 0), ['barPos']);
                add('barNeg', Math.max(35, mNeg * scale + hwShareKg * 0.5), neg.length, 'z', new THREE.Vector3(-halfX, 0, 0), ['barNeg']);
                cables.push({ role: 'upper', index: 0, a: endOf('hook'), b: endOf('body', 'barPos', 0, 0.14, pos.a) });
                cables.push({ role: 'upper', index: 3, a: endOf('hook'), b: endOf('body', 'barPos', 0, 0.14, pos.b) });
                cables.push({ role: 'upper', index: 1, a: endOf('hook'), b: endOf('body', 'barNeg', 0, 0.14, neg.a) });
                cables.push({ role: 'upper', index: 2, a: endOf('hook'), b: endOf('body', 'barNeg', 0, 0.14, neg.b) });
                cables.push({ role: 'leg', index: 0, a: endOf('body', 'barPos', 0, -0.14, pos.a), b: endOf('cargo', null, 0, 0, 0, 0) });
                cables.push({ role: 'leg', index: 3, a: endOf('body', 'barPos', 0, -0.14, pos.b), b: endOf('cargo', null, 0, 0, 0, 3) });
                cables.push({ role: 'leg', index: 1, a: endOf('body', 'barNeg', 0, -0.14, neg.a), b: endOf('cargo', null, 0, 0, 0, 1) });
                cables.push({ role: 'leg', index: 2, a: endOf('body', 'barNeg', 0, -0.14, neg.b), b: endOf('cargo', null, 0, 0, 0, 2) });
                return { bodies: bodies, cables: cables, lugs: null };
            }
            if (type === 'frame') {
                const railPos = memberSpec('railPos');
                const railNeg = memberSpec('railNeg');
                const endPos = memberSpec('endPos');
                const endNeg = memberSpec('endNeg');
                const mRP = estimateMemberStructuralMassKg('railPos');
                const mRN = estimateMemberStructuralMassKg('railNeg');
                const mEP = estimateMemberStructuralMassKg('endPos');
                const mEN = estimateMemberStructuralMassKg('endNeg');
                const sumM = Math.max(10, mRP + mRN + mEP + mEN);
                const scale = userBeamKg != null ? userBeamKg / sumM : 1.0;
                const totalBeamKg = (mRP + mRN + mEP + mEN) * scale;
                const span = Math.max(spanBase().spanX, spanBase().spanZ, 1);
                add('frame', Math.max(50, totalBeamKg + hwShareKg), span, 'frame', new THREE.Vector3(), ['railPos', 'railNeg', 'endPos', 'endNeg']);
                for (let i = 0; i < 4; i++) {
                    const posX = i === 0 || i === 3;
                    const posZ = i === 0 || i === 1;
                    const rail = memberSpec(posZ ? 'railPos' : 'railNeg');
                    const end = memberSpec(posX ? 'endPos' : 'endNeg');
                    const x = posX ? rail.a : rail.b;
                    const z = posZ ? end.a : end.b;
                    cables.push({ role: 'upper', index: i, a: endOf('hook'), b: endOf('body', 'frame', x, 0.18, z) });
                    cables.push({ role: 'leg', index: i, a: endOf('body', 'frame', x, -0.18, z), b: endOf('cargo', null, 0, 0, 0, i) });
                }
                return { bodies: bodies, cables: cables, lugs: null };
            }
            const span = Math.max(spanBase().spanX, spanBase().spanZ, 1);
            const totalBeamKg = userBeamKg != null ? userBeamKg : (mb.beamMassT * 1000 || 650);
            add('assembly', Math.max(50, totalBeamKg + hwShareKg), span, 'x', new THREE.Vector3(), null);
            const n = Math.min(4, state.lugs.length);
            for (let i = 0; i < n; i++) {
                const p = spreaderLocalAnchor(i);
                const yUp = Math.abs(p.y) > 0.02 ? Math.abs(p.y) : 0.16;
                const yLow = Math.abs(p.y) > 0.02 ? -Math.abs(p.y) : -0.16;
                cables.push({ role: 'upper', index: i, a: endOf('hook'), b: endOf('body', 'assembly', p.x, yUp, p.z) });
                cables.push({ role: 'leg', index: i, a: endOf('body', 'assembly', p.x, yLow, p.z), b: endOf('cargo', null, 0, 0, 0, i) });
            }
            return { bodies: bodies, cables: cables, lugs: null };
        }

        function mountBeamBodies() {
            // Self-healing cleanup: return any previously claimed children from phy.beams back to spreaderRootGroup
            // and remove old phy.beamGroups from scene so calling mountBeamBodies() directly can never orphan meshes!
            if (phy.beams && phy.beams.length) {
                phy.beams.forEach(oldB => {
                    if (!oldB.group) return;
                    oldB.group.children.slice().forEach(ch => {
                        if (oldB.origin) ch.position.add(oldB.origin);
                        spreaderRootGroup.add(ch);
                    });
                    if (typeof scene !== 'undefined' && scene) scene.remove(oldB.group);
                });
            }
            if (phy.beamGroups && phy.beamGroups.length) {
                phy.beamGroups.forEach(g => {
                    if (typeof scene !== 'undefined' && scene) scene.remove(g);
                });
            }
            const hangers = [];
            spreaderRootGroup.traverse(o => { if (o.userData && o.userData.isHanger) hangers.push(o); });
            hangers.forEach(h => { if (h.parent) h.parent.remove(h); });
            const plan = beamRecipe();
            appendUserCables(plan);
            const dyn = plan.bodies.map(b => {
                const mass = Math.max(60, b.mass, (state.weight || 10) * 35);
                return {
                    id: b.id, mass: mass, length: b.length, axis: b.axis,
                    origin: b.origin.clone(), members: b.members,
                    x: new THREE.Vector3(), q: new THREE.Quaternion(),
                    v: new THREE.Vector3(), w: new THREE.Vector3(),
                    invMass: 1 / mass, invI: rodInertiaInverse(mass, Math.max(0.4, b.length), b.axis),
                    radius: solidRadius(b.members),
                    group: null
                };
            });
            phy.beams = dyn;
            phy.beamGroups = [];
            const claimed = new Set();
            dyn.forEach(b => {
                const g = new THREE.Group();
                g.userData.beamId = b.id;
                scene.add(g);
                b.group = g;
                phy.beamGroups.push(g);
                spreaderRootGroup.children.slice().forEach(ch => {
                    if (claimed.has(ch)) return;
                    const id = ch.userData && ch.userData.memberId;
                    const take = b.members == null ? true : (id && b.members.indexOf(id) >= 0);
                    if (!take) return;
                    claimed.add(ch);
                    ch.position.sub(b.origin);
                    g.add(ch);
                });
                calibrateBeamCollisionProxy(b);
            });
            const resolve = (end) => {
                if (!end || end.kind === 'hook' || end.kind === 'cargo') return { kind: end ? end.kind : 'hook', index: end ? end.index : 0 };
                const body = dyn.find(b => b.id === end.id);
                return { kind: 'body', body: body, local: new THREE.Vector3(end.local[0], end.local[1], end.local[2]) };
            };
            phy.cables = plan.cables.map(c => ({
                role: c.role, index: c.index, a: resolve(c.a), b: resolve(c.b),
                L0: 1, designL0: 1, tensionT: 0, slack: true, n: new THREE.Vector3(0, 1, 0),
                _lam: 0, _sum: 0, _n: 0, break: null
            }));
            syncCableRest(true);
            seedBeamsFromKinematic();
            syncCableRest(false);
            (phy.cables || []).forEach(c => {
                if (cableIsBroken(c)) initCableBreak(c);
                else c.break = null;
            });
            applyBeamVisuals();
        }

        function basketHangPointFromMaster(master, intactWorld, halfZ, dUpAx, sideSign) {
            // Free end of a bar after its lower leg snaps: hangs from upper sling under self-weight
            const lateral = intactWorld.clone().sub(master);
            lateral.y = 0;
            if (lateral.lengthSq() < 1e-6) lateral.set(0, 0, sideSign || 1);
            lateral.normalize();
            const alongBar = new THREE.Vector3().crossVectors(new THREE.Vector3(0, 1, 0), lateral);
            if (alongBar.lengthSq() < 1e-6) alongBar.set(0, 0, sideSign || 1);
            alongBar.normalize().multiplyScalar(halfZ * (sideSign || 1));
            const hang = master.clone()
                .add(new THREE.Vector3(0, -(dUpAx + 0.14), 0))
                .add(alongBar.multiplyScalar(0.15))
                .addScaledVector(lateral, 0.05);
            return hang;
        }

        function alignBasketBars(specInput) {
            if (state.beamType !== 'basket' || !phy.beams || !phy.beams.length) return;
            const spec = specInput || getRigSpec();
            const master = new THREE.Vector3(phy.hookPos.x, phy.hookPos.y + HOOK_MASTER_OFFSET_Y, phy.hookPos.z);
            const pairs = [
                { id: 'barPos', iA: 0, iB: 3 },
                { id: 'barNeg', iA: 1, iB: 2 }
            ];
            pairs.forEach(pair => {
                const b = phy.beams.find(item => item.id === pair.id);
                if (!b || !state.lugs[pair.iA] || !state.lugs[pair.iB]) return;
                const legABroken = !!(state.gear.legs[pair.iA] && state.gear.legs[pair.iA].broken);
                const legBBroken = !!(state.gear.legs[pair.iB] && state.gear.legs[pair.iB].broken);
                const lugA = attachWorld({ kind: 'cargo', index: pair.iA });
                const lugB = attachWorld({ kind: 'cargo', index: pair.iB });
                const specBar = memberSpec(pair.id);
                const halfZ = specBar
                    ? Math.max(0.15, Math.abs(specBar.a - specBar.b) * 0.5)
                    : Math.max(0.15, lugA.distanceTo(lugB) * 0.5);

                const cUpA = (phy.cables || []).find(c => c.role === 'upper' && c.index === pair.iA);
                const cUpB = (phy.cables || []).find(c => c.role === 'upper' && c.index === pair.iB);
                const L_up = (cUpA && cUpB && cUpA.L0 > 0.25)
                    ? 0.5 * (cUpA.L0 + cUpB.L0)
                    : 0.5 * (upperRestLength(pair.iA, spec) + upperRestLength(pair.iB, spec));
                const dUpAx = Math.sqrt(Math.max(0.09, L_up * L_up - halfZ * halfZ));

                // Broken lower leg → that end no longer tracks the cargo lug (no A↔B tension).
                // It hangs from the upper sling / rests on the cargo shell instead of being dragged through it.
                let eA = lugA;
                let eB = lugB;
                if (legABroken && !legBBroken) {
                    eA = basketHangPointFromMaster(master, lugB, halfZ, dUpAx, 1);
                } else if (legBBroken && !legABroken) {
                    eB = basketHangPointFromMaster(master, lugA, halfZ, dUpAx, -1);
                } else if (legABroken && legBBroken) {
                    eA = basketHangPointFromMaster(master, lugA, halfZ, dUpAx, 1);
                    eB = basketHangPointFromMaster(master, lugB, halfZ, dUpAx, -1);
                }

                const eMid = eA.clone().add(eB).multiplyScalar(0.5);
                const spanVec = eA.clone().sub(eB);
                const toMid = eMid.clone().sub(master);
                const dist = Math.max(1e-4, toMid.length());
                const u = toMid.clone().multiplyScalar(1 / dist);

                const cLowA = (phy.cables || []).find(c => c.role === 'leg' && c.index === pair.iA);
                const cLowB = (phy.cables || []).find(c => c.role === 'leg' && c.index === pair.iB);
                const L_low = (cLowA && cLowB && cLowA.L0 > 0.25)
                    ? 0.5 * (cLowA.L0 + cLowB.L0)
                    : (spec.lower || 1.5);
                const dLowAx = Math.sqrt(Math.max(0.04, L_low * L_low - halfZ * halfZ));

                const lowOffset = (legABroken || legBBroken)
                    ? 0.05
                    : (state.lowerSlingLength != null ? dLowAx : 0.20);
                const maxReach = (legABroken || legBBroken) ? (dUpAx + 0.55) : (dUpAx + 0.14);
                const dBar = Math.min(maxReach, Math.max(0.35, dist - lowOffset));
                b.x.copy(master).addScaledVector(u, dBar);
                const floorY = cargoCeilingUnderBeam(b.x.x, b.x.z, spec);
                if (b.x.y < floorY) b.x.y = floorY;

                let yAxis = master.clone().sub(b.x);
                if (yAxis.lengthSq() < 1e-6) yAxis.set(0, 1, 0);
                yAxis.normalize();
                let zAxis = spanVec.clone().addScaledVector(yAxis, -spanVec.dot(yAxis));
                if (zAxis.lengthSq() < 1e-6) zAxis.set(0, 0, 1);
                zAxis.normalize();
                const xAxis = new THREE.Vector3().crossVectors(yAxis, zAxis).normalize();
                zAxis = new THREE.Vector3().crossVectors(xAxis, yAxis).normalize();
                b.q.setFromRotationMatrix(new THREE.Matrix4().makeBasis(xAxis, yAxis, zAxis));
                b.v.copy(phy.hookVel);
                b.w.set(0, 0, 0);

                // Hard non-penetration after kinematic pose — bars must rest/push on cargo, never ghost through
                depenetrateBeamFromCargo(b, 4);
            });
        }

        function seedBeamsFromKinematic() {
            if (!phy.beams || !phy.beams.length) return;
            if (state.beamType === 'basket') {
                alignBasketBars();
                return;
            }
            const rig = kinematicRigPose();
            phy.beams.forEach(b => {
                b.x.copy(b.origin.clone().applyQuaternion(rig.frameQ).add(rig.spreaderPos));
                b.q.copy(rig.frameQ);
                b.v.copy(rig.anchorVel);
                b.w.set(0, 0, 0);
            });
        }

        function attachWorld(end) {
            if (!end) return new THREE.Vector3();
            if (end.kind === 'hook') return new THREE.Vector3(phy.hookPos.x, phy.hookPos.y + HOOK_MASTER_OFFSET_Y, phy.hookPos.z);
            if (end.kind === 'cargo') {
                const i = end.index || 0;
                const lug = state.lugs[i];
                if (!lug) return phy.cargoPos.clone();
                const n = state.lugNormals[i] ? state.lugNormals[i].clone() : new THREE.Vector3(0, 1, 0);
                if (n.lengthSq() < 0.25) n.set(0, 1, 0);
                n.normalize().applyQuaternion(phy.cargoQuat);
                const ring = lug.clone().applyQuaternion(phy.cargoQuat).add(phy.cargoPos);
                if (phy.cornerSag && phy.cornerSag[i]) ring.y -= phy.cornerSag[i];
                ring.addScaledVector(n, 0.12);
                return ring;
            }
            if (!end.body) return new THREE.Vector3();
            return end.local.clone().applyQuaternion(end.body.q).add(end.body.x);
        }

        function preserveOtherCables() {
            if (state.rigFit === 'auto') {
                state.holdCableLength = false;
                state.heldCableL0 = null;
            } else holdCableLengths();
        }

        function pickSpreaderPos(memberId, off) {
            const spec = memberSpec(memberId);
            if (!spec) return null;
            const type = state.beamType;
            const topId = type === 'modular_truss' ? 'truss' : 'top';
            if ((type === 'cascaded' || type === 'modular_truss') && (memberId === 'top' || memberId === 'truss')) {
                return new THREE.Vector3(off, type === 'modular_truss' ? 0.85 : 1.15, 0);
            }
            if ((type === 'cascaded' || type === 'modular_truss') && memberId === 'lowPlus') {
                const top = memberSpec(topId);
                return new THREE.Vector3(top ? top.a : 0, 0, off);
            }
            if ((type === 'cascaded' || type === 'modular_truss') && memberId === 'lowMinus') {
                const top = memberSpec(topId);
                return new THREE.Vector3(top ? top.b : 0, 0, off);
            }
            if (spec.axis === 'z') return new THREE.Vector3(0, 0, off);
            return new THREE.Vector3(off, 0, 0);
        }

        function placeExtraPicks() {
            memberCatalog().forEach(m => {
                const picks = memberStore(m.id).picks || [];
                picks.forEach(p => {
                    const pos = pickSpreaderPos(m.id, p.off || 0);
                    if (!pos) return;
                    addPickMark(pos.x, pos.y + 0.12, pos.z, m.id);
                });
            });
        }

        function appendUserCables(plan) {
            const bodies = plan.bodies || [];
            (state.gear.extraCables || []).forEach((ex, i) => {
                const spec = memberSpec(ex.memberId);
                if (!spec) return;
                const body = bodies.find(b => b.id === ex.memberId || (b.members && b.members.indexOf(ex.memberId) >= 0));
                if (!body) return;
                const off = ex.off || 0;
                const local = spec.axis === 'z' ? [0, 0.08, off] : [off, 0.08, 0];
                const a = endOf('body', body.id, local[0], local[1], local[2]);
                const b = ex.to === 'cargo' ? endOf('cargo', null, 0, 0, 0, ex.lug || 0) : endOf('hook');
                plan.cables.push({ role: 'extra', index: i, a: a, b: b });
            });
        }

        function holdCableLengths() {
            state.holdCableLength = true;
            if (!state.heldCableL0) state.heldCableL0 = { upper: [], leg: [], hanger: [] };
            (phy.cables || []).forEach(c => {
                if (!state.heldCableL0[c.role]) state.heldCableL0[c.role] = [];
                if (state.heldCableL0[c.role][c.index] == null) state.heldCableL0[c.role][c.index] = c.L0;
            });
        }

        function syncCableRest(captureDesign) {
            const spec = getRigSpec();
            (phy.cables || []).forEach(c => {
                if (c.role === 'extra') {
                    const ex = (state.gear.extraCables || [])[c.index];
                    const spanNow = Math.max(0.2, attachWorld(c.a).distanceTo(attachWorld(c.b)));
                    // A loose auxiliary chain/rope cannot have its manufactured
                    // length silently set to the pin-to-pin chord.  That creates an
                    // impossible, horizontal "zero-length-sag" line over a void.
                    // Preserve a user-entered length exactly; only the automatic
                    // design value receives a small, documented installation slack
                    // so gravity has real material length to form a catenary.
                    const style = (ex && ex.slingType) || state.slingType || 'wire';
                    const slackRatio = style === 'chain' ? 0.030
                        : ((style === 'web' || style === 'round_sling' || style === 'grommet') ? 0.018 : 0.015);
                    const installSlack = Math.min(0.22, Math.max(0.035, spanNow * slackRatio));
                    if (ex && (ex.lengthM == null || (captureDesign && !ex.userSet))) {
                        ex.lengthM = spanNow + installSlack;
                    }
                    c.L0 = Math.max(0.2, ex && ex.lengthM != null ? ex.lengthM : 1);
                    c.designL0 = c.L0;
                    return;
                }
                const item = c.role === 'leg' ? (state.gear.legs && state.gear.legs[c.index])
                    : (c.role === 'upper' ? (state.gear.uppers && state.gear.uppers[c.index])
                    : (c.role === 'hanger' ? (state.gear.hangers && state.gear.hangers[c.index])
                    : null));
                const turn = c.role === 'leg' ? (state.legDeltaL[c.index] || 0) : 0;
                const held = state.holdCableLength && state.heldCableL0 && state.heldCableL0[c.role] ? state.heldCableL0[c.role][c.index] : null;
                const customLength = hasExplicitCableLength(item, c.role);
                if (captureDesign && c.role === 'hanger' && held == null && !customLength) {
                    c.designL0 = Math.max(0.15, attachWorld(c.a).distanceTo(attachWorld(c.b)));
                }
                let nominal;
                if (customLength) nominal = item.lengthM;
                else if (held != null) nominal = held;
                else if (c.role === 'upper') nominal = spec.topLeg;
                else if (c.role === 'hanger') nominal = c.designL0 || Math.max(0.3, spec.mast || 1.15);
                else nominal = spec.lower;
                c.L0 = Math.max(0.2, nominal + turn);
                if (c.role !== 'hanger' || customLength) c.designL0 = c.L0;
            });
        }

        function applyBeamVisuals() {
            if (!phy.rigLive) seedBeamsFromKinematic();
            syncCableRest(false);
            (phy.beams || []).forEach(b => {
                if (!b.group) return;
                b.group.position.copy(b.x);
                b.group.quaternion.copy(b.q);
                b.group.scale.set(1, 1, 1);
            });
            if (spreaderRootGroup && phy.beams && phy.beams.length) {
                spreaderRootGroup.position.set(0, 0, 0);
                spreaderRootGroup.quaternion.identity();
                spreaderRootGroup.scale.set(1, 1, 1);
            }
        }

        function syncHookToRigTaut() {
            if (!state.poseLock && (phy.groundClearance || 0) > 0.05) return;
            const spec = getRigSpec();
            const { spanX, spanZ } = getLPBoundingSpan();
            const { beamType } = state;

            let worldLugY = 0;
            let peakLugY = -1e9;
            const count = Math.max(1, state.lugs.length);
            for (let i = 0; i < state.lugs.length; i++) {
                const p = state.lugs[i].clone().applyQuaternion(phy.cargoQuat).add(phy.cargoPos);
                worldLugY += p.y;
                if (p.y > peakLugY) peakLugY = p.y;
            }
            worldLugY /= count;
            if (peakLugY < -1e8) peakLugY = (typeof supportY === 'function' ? supportY(0, 0) : 0) + (state.H || 2.6);

            let horizU = Math.max(0.35, spanX / 2);
            if (beamType === 'none') {
                const lug = spanBase();
                horizU = Math.max(0.35, Math.hypot(lug.spanX / 2, lug.spanZ / 2));
            } else if (beamType === 'basket') {
                const lug = spanBase();
                const halfX = Math.max(0.25, lug.spanX / 2);
                const halfZ = Math.max(0.20, lug.spanZ / 2);
                horizU = Math.max(0.35, Math.hypot(halfX, halfZ));
            } else if (beamType === 'frame' || beamType === 'container_spreader' || (typeof customBeamMeshes !== 'undefined' && customBeamMeshes[beamType])) {
                horizU = Math.max(0.35, Math.hypot(spanX / 2, spanZ / 2));
            }

            const legCables = (phy.cables || []).filter(c => c.role === 'leg');
            const upperCables = (phy.cables || []).filter(c => c.role === 'upper');
            const hangerCables = (phy.cables || []).filter(c => c.role === 'hanger');

            let lowerDropActual = spec.lowerDrop;
            if (legCables.length) {
                lowerDropActual = 0;
                legCables.forEach(c => {
                    const hL = beamType === 'none' ? horizU : lowerPlanOffset(c.index || 0);
                    const d = Math.sqrt(Math.max(0.04, c.L0 * c.L0 - hL * hL));
                    if (d > lowerDropActual) lowerDropActual = d;
                });
            }

            let upperDropActual = 0;
            let beamStructuralSep = 0;
            if (beamType !== 'none') {
                upperDropActual = Math.max(0.2, spec.topDrop - (spec.mast || 0));
                if (upperCables.length) {
                    upperDropActual = 0;
                    upperCables.forEach(c => {
                        const d = Math.sqrt(Math.max(0.04, c.L0 * c.L0 - horizU * horizU));
                        if (d > upperDropActual) upperDropActual = d;
                    });
                }

                if (beamType === 'spreader') beamStructuralSep = 0.44;
                else if (beamType === 'lifting_beam') beamStructuralSep = 0.48;
                else if (beamType === 'frame') beamStructuralSep = 0.36;
                else if (beamType === 'basket') beamStructuralSep = 0.28;
                else if (beamType === 'container_spreader') beamStructuralSep = 0.50;
                else if (beamType === 'cascaded' || beamType === 'modular_truss') {
                    let hangerDrop = spec.mast || 1.0;
                    if (hangerCables.length) {
                        hangerDrop = Math.max(...hangerCables.map(c => c.L0));
                    }
                    beamStructuralSep = 0.44 + hangerDrop;
                } else {
                    beamStructuralSep = 0.44 + (spec.mast || 0);
                }
            }

            const lugBoreY = worldLugY + 0.12;
            const tautMasterY = (beamType === 'none')
                ? (lugBoreY + lowerDropActual)
                : (lugBoreY + lowerDropActual + beamStructuralSep + upperDropActual);

            const targetHookY = THREE.MathUtils.clamp(tautMasterY - HOOK_MASTER_OFFSET_Y, 2.8, 40.0);

            phy.hookPos.y = targetHookY;
            phy.hookTarget.y = targetHookY;
            phy.hookVel.set(0, 0, 0);

            const inpHookY = document.getElementById('inp-hook-y');
            if (inpHookY) inpHookY.value = targetHookY.toFixed(2);
            const numHookY = document.getElementById('num-hook-y');
            if (numHookY) numHookY.value = targetHookY.toFixed(2);
            const lblHookY = document.getElementById('val-hook-y');
            if (lblHookY) lblHookY.textContent = targetHookY.toFixed(1) + 'm';
        }
        window.syncHookToRigTaut = syncHookToRigTaut;

        function activeCogLocal() {
            // True CoG only — broken-sling load shift is handled by the XPBD cable solver,
            // not by faking a displaced centre of mass.
            const sx = state.cogX + ((phy.oogState && phy.oogState.status === 'sliding') ? phy.oogState.localPos.x * 0.72 : 0);
            const sz = state.cogZ + ((phy.oogState && phy.oogState.status === 'sliding') ? phy.oogState.localPos.z * 0.72 : 0);
            return new THREE.Vector3(sx, state.cogY, sz);
        }

        function cargoComNow() {
            return phy.cargoPos.clone().add(activeCogLocal().applyQuaternion(phy.cargoQuat));
        }

        function writeCargoCom(com) {
            phy.cargoPos.copy(com).sub(activeCogLocal().applyQuaternion(phy.cargoQuat));
        }

        function spinQuat(q, dth, maxAng) {
            const th = dth.length();
            if (!(th > 1e-10) || !isFinite(th)) return;
            const cap = maxAng == null ? 0.35 : maxAng;
            q.premultiply(new THREE.Quaternion().setFromAxisAngle(dth.clone().multiplyScalar(1 / th), Math.min(th, cap))).normalize();
        }

        function cableIsBroken(c) {
            if (c.role === 'leg') return !!(state.gear.legs && state.gear.legs[c.index] && state.gear.legs[c.index].broken);
            if (c.role === 'upper') return !!(state.gear.uppers && state.gear.uppers[c.index] && state.gear.uppers[c.index].broken);
            if (c.role === 'hanger') return !!(state.gear.hangers && state.gear.hangers[c.index] && state.gear.hangers[c.index].broken);
            if (c.role === 'extra') return !!((state.gear.extraCables || [])[c.index] && state.gear.extraCables[c.index].broken);
            return false;
        }

        // A four-point frame is two independent top bridle branches feeding
        // their matching lower legs.  If one top branch parts, its lower leg
        // remains an intact piece of steel but it is no longer a load path:
        // the frame drops/rotates toward the cargo and that leg goes slack.
        // Treating it as a rigid hidden substitute for the severed upper leg
        // was what kept a failed corner artificially suspended.
        function lowerLegIsUnloadedByTopFailure(c) {
            return !!(c && c.role === 'leg'
                && state.beamType === 'frame'
                && state.gear && state.gear.uppers
                && state.gear.uppers[c.index]
                && state.gear.uppers[c.index].broken);
        }

        // A basket spreader begins in a convenient, symmetric presentation pose.
        // That pose is useful only while its complete rigging is intact.  Once any
        // sling parts, the bars must become ordinary rigid bodies immediately:
        // continuing to call alignBasketBars() would overwrite gravity every frame
        // and make a severed bar appear to float beside the load.
        function basketUsesKinematicPose() {
            return state.beamType === 'basket'
                && !!(phy.cables && phy.cables.length)
                && !(phy.cables || []).some(cableIsBroken);
        }

        function beamIsSuspended(b) {
            if (!b) return true;
            if (state.beamType === 'basket' && basketUsesKinematicPose()) return true;
            const uppers = (phy.cables || []).filter(c => c.role === 'upper' && !cableIsBroken(c) && c.b && c.b.body === b);
            if (!uppers.length) return true;
            return uppers.some(c => !c.slack && (c._j > 1e-4 || attachWorld(c.a).distanceTo(attachWorld(c.b)) >= c.L0 - 0.02));
        }

        function endCompliance(end, n, invMass, invI) {
            if (!end || end.kind === 'hook') return 0;
            if (end.kind === 'cargo') return cableInvMass(attachWorld(end).sub(cargoComNow()), n, phy.cargoQuat, invI, invMass);
            if (!end.body || (state.beamType === 'basket' && basketUsesKinematicPose())) return 0;
            return cableInvMass(attachWorld(end).sub(end.body.x), n, end.body.q, end.body.invI, end.body.invMass);
        }

        function pushEnd(end, n, dl, invMass, invI) {
            if (!end || end.kind === 'hook' || !(Math.abs(dl) > 1e-12)) return;
            const limited = (quat, tensor, origin, apply) => {
                const r = attachWorld(end).sub(origin);
                let rot = alphaFromTorque(new THREE.Vector3().crossVectors(r, n.clone().multiplyScalar(dl)), quat, tensor);
                const th = rot.length();
                let use = dl;
                if (th > 0.08) {
                    use = dl * (0.08 / th);
                    rot = alphaFromTorque(new THREE.Vector3().crossVectors(r, n.clone().multiplyScalar(use)), quat, tensor);
                }
                apply(use, rot);
            };
            if (end.kind === 'cargo') {
                const com = cargoComNow();
                limited(phy.cargoQuat, invI, com, (use, rot) => {
                    com.addScaledVector(n, use * invMass);
                    spinQuat(phy.cargoQuat, rot, 0.08);
                    writeCargoCom(com);
                });
                return;
            }
            const b = end.body;
            if (!b || (state.beamType === 'basket' && basketUsesKinematicPose())) return;
            limited(b.q, b.invI, b.x, (use, rot) => {
                b.x.addScaledVector(n, use * b.invMass);
                spinQuat(b.q, rot, 0.08);
            });
        }

        function kickEnd(end, n, j, invMass, invI, vCom, omega) {
            if (!end || end.kind === 'hook' || !(Math.abs(j) > 1e-9)) return;
            if (end.kind === 'cargo') {
                const r = attachWorld(end).sub(cargoComNow());
                vCom.addScaledVector(n, j * invMass);
                omega.add(alphaFromTorque(new THREE.Vector3().crossVectors(r, n.clone().multiplyScalar(j)), phy.cargoQuat, invI));
                return;
            }
            const b = end.body;
            if (!b || (state.beamType === 'basket' && basketUsesKinematicPose())) return;
            const r = attachWorld(end).sub(b.x);
            b.v.addScaledVector(n, j * b.invMass);
            b.w.add(alphaFromTorque(new THREE.Vector3().crossVectors(r, n.clone().multiplyScalar(j)), b.q, b.invI));
        }

        function endVelocity(end, vCom, omega) {
            if (!end || end.kind === 'hook') return phy.hookVel.clone();
            if (end.kind === 'cargo') {
                const r = attachWorld(end).sub(cargoComNow());
                return vCom.clone().add(new THREE.Vector3().crossVectors(omega, r));
            }
            if (!end.body) return new THREE.Vector3();
            const r = attachWorld(end).sub(end.body.x);
            return end.body.v.clone().add(new THREE.Vector3().crossVectors(end.body.w, r));
        }

        function solidRadius(members) {
            let d = beamOuterDiameter();
            (members || []).forEach(id => { d = Math.max(d, memberDiameter(id)); });
            return d * 0.5 + 0.03;
        }

        // The physics proxy must enclose the visible steelwork, including end
        // fittings and lug plates. A nominal tube diameter alone leaves the
        // rendered parts able to pass through cargo.
        function beamCollisionRadius(b) {
            return Math.max(b && b.radius ? b.radius : 0.12, b && b.visualRadius ? b.visualRadius : 0.12);
        }

        function calibrateBeamCollisionProxy(b) {
            if (!b || !b.group) return;
            b.group.updateMatrixWorld(true);
            // setFromObject() returns world coordinates. Convert every child box
            // back into the beam's local frame, otherwise a raised beam acquires
            // its hook height as a fictitious collision radius.
            const toBeamLocal = new THREE.Matrix4().copy(b.group.matrixWorld).invert();
            const bounds = new THREE.Box3();
            b.group.traverse(child => {
                if (!child.isMesh || !child.geometry) return;
                if (!child.geometry.boundingBox) child.geometry.computeBoundingBox();
                if (!child.geometry.boundingBox) return;
                const childBounds = child.geometry.boundingBox.clone()
                    .applyMatrix4(child.matrixWorld)
                    .applyMatrix4(toBeamLocal);
                bounds.union(childBounds);
            });
            if (bounds.isEmpty()) return;
            const size = bounds.getSize(new THREE.Vector3());
            if (b.axis === 'x') {
                b.collisionLength = Math.max(b.length, size.x + 0.02);
                b.visualRadius = Math.max(Math.abs(bounds.min.y), Math.abs(bounds.max.y), Math.abs(bounds.min.z), Math.abs(bounds.max.z)) + 0.008;
            } else if (b.axis === 'z') {
                b.collisionLength = Math.max(b.length, size.z + 0.02);
                b.visualRadius = Math.max(Math.abs(bounds.min.x), Math.abs(bounds.max.x), Math.abs(bounds.min.y), Math.abs(bounds.max.y)) + 0.008;
            } else {
                b.visualRadius = Math.max(Math.abs(bounds.min.y), Math.abs(bounds.max.y)) + 0.008;
            }
        }

        function beamAxis(b) {
            return new THREE.Vector3(b.axis === 'z' ? 0 : 1, 0, b.axis === 'z' ? 1 : 0).applyQuaternion(b.q);
        }

        function segmentEnds(b) {
            const axis = beamAxis(b);
            const half = Math.max(0.05, (b.collisionLength || b.length) * 0.5);
            return [b.x.clone().addScaledVector(axis, -half), b.x.clone().addScaledVector(axis, half)];
        }

        // Collision geometry for a lifting member. A frame spreader is an open
        // rectangle: representing it as one centre line lets objects ghost through
        // its rails. Return every physical rail so contacts occur at the outer skin.
        function beamSegments(b) {
            if (!b || b.axis !== 'frame') return [segmentEnds(b)];
            const localX = new THREE.Vector3(1, 0, 0).applyQuaternion(b.q);
            const localZ = new THREE.Vector3(0, 0, 1).applyQuaternion(b.q);
            const span = getLPBoundingSpan();
            const halfX = (span.spanX || state.L || 6.0) * 0.5;
            const halfZ = (span.spanZ || state.W || 2.4) * 0.5;
            const c0 = b.x.clone().addScaledVector(localX, halfX).addScaledVector(localZ, halfZ);
            const c1 = b.x.clone().addScaledVector(localX, -halfX).addScaledVector(localZ, halfZ);
            const c2 = b.x.clone().addScaledVector(localX, -halfX).addScaledVector(localZ, -halfZ);
            const c3 = b.x.clone().addScaledVector(localX, halfX).addScaledVector(localZ, -halfZ);
            return [[c0, c1], [c1, c2], [c2, c3], [c3, c0]];
        }

        function closestOnSegments(p1, q1, p2, q2) {
            const d1 = q1.clone().sub(p1);
            const d2 = q2.clone().sub(p2);
            const r = p1.clone().sub(p2);
            const a = d1.dot(d1);
            const e = d2.dot(d2);
            const f = d2.dot(r);
            let s = 0;
            let t = 0;
            const eps = 1e-8;
            if (a <= eps && e <= eps) {
                return { pa: p1.clone(), pb: p2.clone() };
            }
            if (a <= eps) {
                t = THREE.MathUtils.clamp(f / e, 0, 1);
            } else {
                const c = d1.dot(r);
                if (e <= eps) {
                    s = THREE.MathUtils.clamp(-c / a, 0, 1);
                } else {
                    const b = d1.dot(d2);
                    const denom = a * e - b * b;
                    s = denom > eps ? THREE.MathUtils.clamp((b * f - c * e) / denom, 0, 1) : 0;
                    t = (b * s + f) / e;
                    if (t < 0) {
                        t = 0;
                        s = THREE.MathUtils.clamp(-c / a, 0, 1);
                    } else if (t > 1) {
                        t = 1;
                        s = THREE.MathUtils.clamp((b - c) / a, 0, 1);
                    }
                }
            }
            return { pa: p1.clone().addScaledVector(d1, s), pb: p2.clone().addScaledVector(d2, t) };
        }

        function craneSolids() {
            const t = state.craneType;
            if (t === 'hook_only') return [];
            if (t === 'gantry') {
                return [
                    { c: [-9.5, 8.2, -7.0], h: [0.35, 8.2, 0.35] },
                    { c: [-9.5, 8.2,  7.0], h: [0.35, 8.2, 0.35] },
                    { c: [ 9.5, 8.2, -7.0], h: [0.35, 8.2, 0.35] },
                    { c: [ 9.5, 8.2,  7.0], h: [0.35, 8.2, 0.35] }
                ];
            }
            if (t === 'crawler') return [{ c: [-8.5, 1.8, -7.5], h: [2.5, 1.8, 3.4] }];
            return [{ c: [-7.5, 1.4, -8.5], h: [2.2, 1.5, 4.8] }];
        }

        function boxExit(local, hx, hy, hz) {
            const dx = Math.abs(local.x) - hx;
            const dy = Math.abs(local.y) - hy;
            const dz = Math.abs(local.z) - hz;
            if (dx >= 0 || dy >= 0 || dz >= 0) return null;
            let depth = -dx;
            const n = new THREE.Vector3(Math.sign(local.x) || 1, 0, 0);
            if (-dy < depth) { depth = -dy; n.set(0, Math.sign(local.y) || 1, 0); }
            if (-dz < depth) { depth = -dz; n.set(0, 0, Math.sign(local.z) || 1); }
            return { depth: depth, n: n };
        }

        function stopClosing(v, w, origin, point, nrm, invM, invI, quat) {
            const rad = point.clone().sub(origin);
            const comp = Math.max(1e-8, cableInvMass(rad, nrm, quat, invI, invM));
            const vn = nrm.dot(v.clone().add(new THREE.Vector3().crossVectors(w, rad)));
            if (vn >= 0) return;
            const jn = -vn / comp;
            v.addScaledVector(nrm, jn * invM);
            w.add(alphaFromTorque(new THREE.Vector3().crossVectors(rad, nrm.clone().multiplyScalar(jn)), quat, invI));
        }

        function shoveBody(body, point, nrm, depth, v, w, maxStep) {
            const want = Math.min(Math.max(0, depth), maxStep != null ? maxStep : 0.28);
            body.x.addScaledVector(nrm, want);
            if (v && w) stopClosing(v, w, body.x, point, nrm, body.invMass, body.invI, body.q);
        }

        function beamContactSamples(b, nSegments) {
            const n = Math.max(2, nSegments || 6);
            if (b.axis !== 'frame') {
                const ends = segmentEnds(b);
                const pts = [];
                for (let i = 0; i <= n; i++) {
                    pts.push(ends[0].clone().lerp(ends[1], i / n));
                }
                return pts;
            }
            // Perimeter rectangular frame spreader: 4 outer rails in beam's true 3D orientation
            const localX = new THREE.Vector3(1, 0, 0).applyQuaternion(b.q);
            const localZ = new THREE.Vector3(0, 0, 1).applyQuaternion(b.q);
            const span = getLPBoundingSpan();
            const halfX = (span.spanX || state.L || 6.0) * 0.5;
            const halfZ = (span.spanZ || state.W || 2.4) * 0.5;

            const c0 = b.x.clone().addScaledVector(localX, halfX).addScaledVector(localZ, halfZ);
            const c1 = b.x.clone().addScaledVector(localX, -halfX).addScaledVector(localZ, halfZ);
            const c2 = b.x.clone().addScaledVector(localX, -halfX).addScaledVector(localZ, -halfZ);
            const c3 = b.x.clone().addScaledVector(localX, halfX).addScaledVector(localZ, -halfZ);

            const pts = [];
            for (let i = 0; i <= n; i++) {
                const t = i / n;
                pts.push(c0.clone().lerp(c1, t)); // railPos
                pts.push(c3.clone().lerp(c2, t)); // railNeg
            }
            const halfN = Math.max(1, Math.round(n * 0.4));
            for (let k = 1; k < halfN; k++) {
                const t = k / halfN;
                pts.push(c0.clone().lerp(c3, t)); // endPos
                pts.push(c1.clone().lerp(c2, t)); // endNeg
            }
            return pts;
        }

        // Multi-sample rigid depenetration: beam segment cannot occupy cargo volume
        function depenetrateBeamFromCargo(b, maxPasses) {
            if (!b || !activeCargoVisual) return false;
            const rad = beamCollisionRadius(b) + 0.012;
            let any = false;
            for (let pass = 0; pass < (maxPasses || 4); pass++) {
                const samples = beamContactSamples(b, 6);
                let bestDiff = null;
                let deepest = 0;
                let nHit = 0;
                const push = new THREE.Vector3();
                for (let oi = 0; oi < samples.length; oi++) {
                    const p = samples[oi];
                    const floor = supportY(p.x, p.z) + rad;
                    if (p.y < floor) {
                        const dy = floor - p.y;
                        const diff = new THREE.Vector3(0, dy, 0);
                        push.add(diff);
                        nHit += 1;
                        if (dy > deepest) { deepest = dy; bestDiff = diff.clone(); }
                        if (b.v && b.w) stopClosing(b.v, b.w, b.x, p, new THREE.Vector3(0, 1, 0), b.invMass, b.invI, b.q);
                    }
                    const cleared = pushOutOfCargoShellWorld(p, rad, false);
                    const diff = cleared.sub(p);
                    const depth = diff.length();
                    if (depth < 1e-5) continue;
                    push.add(diff);
                    nHit += 1;
                    if (depth > deepest) { deepest = depth; bestDiff = diff.clone(); }
                    if (b.v && b.w) stopClosing(b.v, b.w, b.x, p, diff.clone().multiplyScalar(1 / depth), b.invMass, b.invI, b.q);
                }
                if (!nHit) break;
                any = true;
                const step = push.multiplyScalar(1 / Math.max(1, nHit));
                const mag = step.length();
                if (mag < 1e-5) break;
                // Position correction only removes overlap.  Do not rotate a whole
                // beam once for every contact sample: that was an artificial torque
                // source and made steel members visibly twitch / teleport on impact.
                b.x.addScaledVector(step.normalize(), Math.min(mag * 0.60, Math.max(0.025, deepest * 0.45)));
                if (b.v) {
                    // Inelastic industrial-steel contact: kill closing velocity,
                    // keep only a modest tangential loss, and never impose a tiny
                    // global speed ceiling that turns a falling beam into foam.
                    b.v.multiplyScalar(step.y > 0 ? 0.82 : 0.90);
                    if (step.y > 0 && b.v.y < 0) b.v.y = 0;
                    if (b.v.length() > 14.0) b.v.setLength(14.0);
                }
                if (b.w) { b.w.multiplyScalar(0.82); if (b.w.length() > 3.2) b.w.setLength(3.2); }
                if (!isFinite(b.x.x)) {
                    b.x.set(phy.cargoPos.x, phy.cargoPos.y + 2, phy.cargoPos.z);
                    if (b.v) b.v.set(0, 0, 0);
                    break;
                }
                if (deepest < 0.002) break;
            }
            b.isRestingOnCargo = any;
            return any;
        }

        function keepSolidsApart(invMass, invI, vCom, omega) {
            const beams = phy.beams || [];
            const shoveCargo = (point, nrm, depth) => {
                const want = Math.min(Math.max(0, depth), 0.12);
                const com = cargoComNow();
                com.addScaledVector(nrm, want);
                writeCargoCom(com);
                stopClosing(vCom, omega, com, point, nrm, invMass, invI, phy.cargoQuat);
            };
            // 1. Spreader / Lifting Beam vs Floor & Cargo
            beams.forEach(b => {
                depenetrateBeamFromCargo(b, 2);
            });
            // 2. Beam vs Beam non-penetration
            for (let i = 0; i < beams.length; i++) {
                for (let k = i + 1; k < beams.length; k++) {
                    const a = beams[i];
                    const c = beams[k];
                    const need = beamCollisionRadius(a) + beamCollisionRadius(c);
                    beamSegments(a).forEach(sa => beamSegments(c).forEach(sc => {
                        const hit = closestOnSegments(sa[0], sa[1], sc[0], sc[1]);
                        const dist = hit.pa.distanceTo(hit.pb);
                        if (!(dist < need) || dist < 1e-4) return;
                        const nrm = hit.pb.clone().sub(hit.pa).multiplyScalar(1 / dist);
                        const want = Math.min(need - dist, 0.06);
                        const shareC = want * c.invMass / (a.invMass + c.invMass);
                        a.x.addScaledVector(nrm, -(want - shareC));
                        c.x.addScaledVector(nrm, shareC);
                        stopClosing(a.v, a.w, a.x, hit.pa, nrm.clone().negate(), a.invMass, a.invI, a.q);
                        stopClosing(c.v, c.w, c.x, hit.pb, nrm, c.invMass, c.invI, c.q);
                    }));
                }
            }
            // 3. Hook Block & Master Link vs Spreader Beams (Hook is also clamped above solids in clampHookOutOfSolids)
            clampHookOutOfSolids();
            const hooks = [
                { c: phy.hookPos.clone().add(new THREE.Vector3(0, 0.34, 0)), r: 0.26 },
                { c: phy.hookPos.clone().add(new THREE.Vector3(0, -0.32, 0)), r: 0.16 }
            ];
            hooks.forEach(hk => {
                beams.forEach(b => beamSegments(b).forEach(ends => {
                    const axis = ends[1].clone().sub(ends[0]);
                    const len2 = Math.max(1e-8, axis.lengthSq());
                    const s = THREE.MathUtils.clamp(hk.c.clone().sub(ends[0]).dot(axis) / len2, 0, 1);
                    const p = ends[0].clone().addScaledVector(axis, s);
                    const gap = p.distanceTo(hk.c);
                    const need = hk.r + beamCollisionRadius(b);
                    if (gap >= need || gap < 1e-4) return;
                    const pushDir = p.clone().sub(hk.c).multiplyScalar(1 / gap);
                    if (pushDir.y < 0 && p.y <= cargoCeilingUnderBeam(p.x, p.z, getRigSpec()) + 0.05) {
                        // Beam is already resting on cargo: raise hook instead of pushing beam into cargo
                        phy.hookPos.y += (need - gap);
                        if (phy.hookTarget.y < phy.hookPos.y) phy.hookTarget.y = phy.hookPos.y;
                    } else {
                        shoveBody(b, p, pushDir, need - gap, b.v, b.w);
                    }
                }));
            });
            // 4. Crane structural legs/outriggers vs Cargo & Beams
            craneSolids().forEach(box => {
                const center = new THREE.Vector3(box.c[0], box.c[1], box.c[2]);
                const half = box.h;
                contactLocals().forEach(corner => {
                    const p = corner.clone().applyQuaternion(phy.cargoQuat).add(phy.cargoPos);
                    const hit = boxExit(p.clone().sub(center), half[0], half[1], half[2]);
                    if (hit) shoveCargo(p, hit.n, hit.depth);
                });
                beams.forEach(b => {
                    const rad = beamCollisionRadius(b);
                    beamContactSamples(b, 8).forEach(p => {
                        const hit = boxExit(p.clone().sub(center), half[0] + rad, half[1] + rad, half[2] + rad);
                        if (hit) shoveBody(b, p, hit.n, hit.depth, b.v, b.w);
                    });
                });
            });
        }

        function contactLocals() {
            const { L, W, H } = state;
            const pts = [];
            [-1, 1].forEach(x => [-1, 1].forEach(y => [-1, 1].forEach(z => {
                pts.push(new THREE.Vector3(x * L / 2, y * H / 2, z * W / 2));
            })));
            (phy.supportLocals || []).forEach(p => pts.push(p.clone()));
            return pts;
        }

        function balanceBeamBridles() {
            // Beam orientation, swing, and equilibrium are governed strictly by XPBD
            // cable constraints, gravity, inertia, and contacts without artificial kinematic overrides.
            // Velocity and angular rates are physically integrated and damped per substep in the main loop.
        }

        function runXpbdFrame(frameDt) {
            phy.rigLive = true;
            if ((phy.shockFrames || 0) > 0) phy.shockFrames -= 1;
            const substeps = 20;
            const dt = frameDt / substeps;
            const activeWeightT = phy.effectiveCargoWeightT != null ? phy.effectiveCargoWeightT : state.weight;
            const mass = Math.max(80, activeWeightT * 1000);
            const invMass = 1 / mass;
            const { L, W, H, cogX, cogY, cogZ } = state;
            const slideCogX = cogX + ((phy.oogState && phy.oogState.status === 'sliding') ? phy.oogState.localPos.x * 0.72 : 0);
            const slideCogZ = cogZ + ((phy.oogState && phy.oogState.status === 'sliding') ? phy.oogState.localPos.z * 0.72 : 0);
            const invI = inertiaInverseAboutCog(mass, L, W, H, slideCogX, cogY, slideCogZ);
            const mu = state.groundId === 'soil' ? 0.62 : (state.groundId === 'rough' ? 0.48 : 0.5);
            (phy.cables || []).forEach(c => { c._sum = 0; c._n = 0; });
            let clearance = Infinity;

            for (let step = 0; step < substeps; step++) {
                advanceHook(dt);
                syncCableRest(false);

                const rCog = new THREE.Vector3(slideCogX, cogY, slideCogZ).applyQuaternion(phy.cargoQuat);
                const com = phy.cargoPos.clone().add(rCog);
                const vCom = phy.cargoVel.clone().add(new THREE.Vector3().crossVectors(phy.cargoOmega, rCog));
                const omega = phy.cargoOmega.clone();
                vCom.y -= G_EARTH * dt;
                const speed = vCom.length();
                if (speed > 0.05) {
                    const area = 0.35 * (L + W) * H;
                    const drag = 0.5 * 1.225 * 1.05 * area * speed * speed;
                    vCom.addScaledVector(vCom, -drag * invMass * dt / speed);
                }
                const wLen = omega.length();
                if (wLen > 1e-7) phy.cargoQuat.premultiply(new THREE.Quaternion().setFromAxisAngle(omega.clone().multiplyScalar(1 / wLen), wLen * dt)).normalize();
                com.addScaledVector(vCom, dt);
                writeCargoCom(com);

                if (basketUsesKinematicPose()) {
                    alignBasketBars();
                } else {
                    (phy.beams || []).forEach(b => {
                        b.v.y -= G_EARTH * dt;
                        const bs = b.v.length();
                        if (bs > 0.05) b.v.addScaledVector(b.v, -Math.min(0.4, 0.08 * bs) * dt);
                        const bw = b.w.length();
                        if (bw > 1e-7) b.q.premultiply(new THREE.Quaternion().setFromAxisAngle(b.w.clone().multiplyScalar(1 / bw), bw * dt)).normalize();
                        b.x.addScaledVector(b.v, dt);
                    });
                }

                const axialImpulseCap = (end, dir) => {
                    if (!end || end.kind === 'hook') return 1e8;
                    let mass, quat, tensor, origin;
                    if (end.kind === 'cargo') {
                        mass = 1 / Math.max(1e-8, invMass);
                        quat = phy.cargoQuat;
                        tensor = invI;
                        origin = cargoComNow();
                    } else if (end.body) {
                        mass = end.body.mass;
                        quat = end.body.q;
                        tensor = end.body.invI;
                        origin = end.body.x;
                    } else return 1e8;
                    const axis = dir ? dir.clone() : new THREE.Vector3(0, 1, 0);
                    const rxn = new THREE.Vector3().crossVectors(attachWorld(end).sub(origin), axis);
                    const ang = alphaFromTorque(rxn, quat, tensor).length();
                    const vCap = Math.max(10, (state.weight * 1000 + mass) * G_EARTH * dt * 2.5);
                    const wCap = ang > 1e-6 ? 0.35 / ang : 1e8;
                    const needed = (state.weight * 1000 + mass) * G_EARTH * dt * 1.45;
                    return Math.max(Math.min(vCap, wCap), needed);
                };
                (phy.cables || []).forEach(c => { c._j = 0; c.slack = true; });
                for (let iter = 0; iter < 8; iter++) {
                    balanceBeamBridles();
                    (phy.cables || []).forEach(c => {
                        // A lower sling remains a real, inextensible connection
                        // after its neighbouring upper bridle parts.  Disabling it
                        // created a phantom gap: its pins could separate by 10 m
                        // while the UI still stated a 2 m sling.  Only a cable that
                        // actually broke may lose its A↔B constraint.
                        if (cableIsBroken(c) || lowerLegIsUnloadedByTopFailure(c)
                            || !c.a || !c.b || (c.a.kind === 'body' && !c.a.body) || (c.b.kind === 'body' && !c.b.body)) {
                            c.slack = true;
                            c._j = 0;
                            return;
                        }
                        const pA = attachWorld(c.a);
                        const pB = attachWorld(c.b);
                        const delta = pB.clone().sub(pA);
                        const dist = delta.length();
                        if (!(dist > 1e-4)) return;
                        const n = delta.multiplyScalar(1 / dist);
                        c.n = n.clone().negate();
                        if (basketUsesKinematicPose() && c.role === 'upper') {
                            return;
                        }
                        const slackThresh = c.slack ? (c.L0 - 0.001) : (c.L0 - 0.004);
                        if (dist < slackThresh) {
                            c.slack = true;
                            return;
                        }
                        const sep = n.dot(endVelocity(c.b, vCom, omega)) - n.dot(endVelocity(c.a, vCom, omega));
                        const stretch = Math.max(0, dist - c.L0);
                        // Pure Split-Impulse Inextensible Cable Solver:
                        // 1) Velocity impulse ONLY resolves relative separating velocity (zero velocity injection from stretch!)
                        const wSum = Math.max(1e-8, endCompliance(c.a, n, invMass, invI) + endCompliance(c.b, n.clone().negate(), invMass, invI));
                        let j = (sep * 0.96) / wSum;
                        const cap = Math.min(axialImpulseCap(c.a, n), axialImpulseCap(c.b, n.clone().negate()));
                        if (j > cap) j = cap;
                        if (c._j + j < 0) j = -c._j;
                        c._j += j;
                        const isLegUnderRestingBeam = c.role === 'leg' && c.a && c.a.body && (c.a.body.isRestingOnCargo || !beamIsSuspended(c.a.body));
                        kickEnd(c.a, n, j, invMass, invI, vCom, omega);
                        if (!isLegUnderRestingBeam) {
                            kickEnd(c.b, n, -j, invMass, invI, vCom, omega);
                        }
                        // 2) Split position projection removes geometric drift without injecting upward bounce velocity
                        if (stretch > 1e-5) {
                            const corr = stretch * 0.78;
                            if (isLegUnderRestingBeam) {
                                const dl = corr / Math.max(1e-8, endCompliance(c.a, n, invMass, invI));
                                pushEnd(c.a, n, dl, invMass, invI);
                            } else {
                                const dl = corr / wSum;
                                pushEnd(c.a, n, dl, invMass, invI);
                                pushEnd(c.b, n, -dl, invMass, invI);
                            }
                        }
                        // Coincident rest length alone is not tension.  A cable is
                        // taut only after it has actually transmitted an impulse
                        // (or has a measurable geometric overrun).  Otherwise the
                        // renderer must be free to show its gravity sag instead of
                        // drawing a fake straight, unsupported line.
                        c.slack = c._j <= 1e-6 && dist < (c.L0 - 0.001);
                    });
                }
                if (basketUsesKinematicPose()) {
                    alignBasketBars();
                }

                const contacts = contactLocals();
                let minGap = Infinity;
                for (let pass = 0; pass < 2; pass++) {
                    for (let s = 0; s < contacts.length; s++) {
                        const comN = cargoComNow();
                        const wpt = contacts[s].clone().applyQuaternion(phy.cargoQuat).add(phy.cargoPos);
                        const gap = wpt.y - supportY(wpt.x, wpt.z);
                        if (gap < minGap) minGap = gap;
                        if (gap >= -1e-5) continue;
                        const nrm = (typeof supportNormal === 'function')
                            ? supportNormal(wpt.x, wpt.z)
                            : new THREE.Vector3(0, 1, 0);
                        const r = wpt.clone().sub(comN);
                        const w = Math.max(1e-8, cableInvMass(r, nrm, phy.cargoQuat, invI, invMass));
                        // gap is vertical against the height field, so convert it
                        // to normal penetration before projecting the contact.
                        const penetration = Math.min(-gap / Math.max(0.15, nrm.y), 0.2);
                        const lam = penetration / w;
                        comN.addScaledVector(nrm, lam * invMass);
                        spinQuat(phy.cargoQuat, alphaFromTorque(new THREE.Vector3().crossVectors(r, nrm.clone().multiplyScalar(lam)), phy.cargoQuat, invI));
                        writeCargoCom(comN);
                        const vpt = vCom.clone().add(new THREE.Vector3().crossVectors(omega, r));
                        const vn = vpt.dot(nrm);
                        if (vn < -3.2) phy.pendingImpact = Math.max(phy.pendingImpact || 0, -vn);
                        else if (vn < -0.22 && (phy.touchdownCooldown || 0) <= 0) {
                            phy.touchdownCooldown = 18;
                            if (typeof simAudio !== 'undefined') {
                                const contactSpeed = -vn;
                                const contactEnergy = 0.5 * mass * contactSpeed * contactSpeed;
                                simAudio.playImpact(contactSpeed, contactEnergy, 'touchdown');
                            }
                        }
                        let jn = 0;
                        if (vn < 0) {
                            jn = -vn / w;
                            vCom.addScaledVector(nrm, jn * invMass);
                            omega.add(alphaFromTorque(new THREE.Vector3().crossVectors(r, nrm.clone().multiplyScalar(jn)), phy.cargoQuat, invI));
                        }
                        const vt = vCom.clone().add(new THREE.Vector3().crossVectors(omega, r));
                        vt.addScaledVector(nrm, -vt.dot(nrm));
                        const slip = vt.length();
                        if (slip > 1e-5) {
                            const t = vt.multiplyScalar(1 / slip);
                            const wt = Math.max(1e-8, cableInvMass(r, t, phy.cargoQuat, invI, invMass));
                            const limit = mu * Math.max(jn, (mass * G_EARTH * dt) / contacts.length);
                            const jt = Math.min(slip / wt, limit);
                            vCom.addScaledVector(t, -jt * invMass);
                            omega.add(alphaFromTorque(new THREE.Vector3().crossVectors(r, t.clone().multiplyScalar(-jt)), phy.cargoQuat, invI));
                        }
                    }
                }
                if (minGap < 0.004) omega.multiplyScalar(Math.exp(-dt / 0.18));
                clearance = Math.min(clearance, minGap);

                keepSolidsApart(invMass, invI, vCom, omega);

                let anyTautLeg = false;
                const grossLoadStepLimitT = ((phy.effectiveCargoWeightT != null ? phy.effectiveCargoWeightT : state.weight) + (phy.gearWeight || 1.0)) * 3.0;
                (phy.cables || []).forEach(c => {
                    let stepT = (c._j > 1e-6 && !cableIsBroken(c)) ? (c._j / dt) / (1000 * G_EARTH) : 0;
                    if (stepT > grossLoadStepLimitT) stepT = grossLoadStepLimitT;
                    c._sum += stepT;
                    c._n += 1;
                    if (!c.slack && c.role === 'leg') anyTautLeg = true;
                });
                // Broken stubs: free tips fall under gravity; attachments only feel stub self-weight
                integrateBrokenCableStubs(dt, invMass, invI, vCom, omega);
                // Heavy steel inertia & non-bouncing hoist arrest:
                // Prevent runaway numerical explosion while leaving full freedom for smooth angular tilt and pendulum swinging
                if (anyTautLeg) {
                    const maxUpward = Math.max(0.6, Math.max(0, phy.hookVel.y) + 0.4);
                    if (vCom.y > maxUpward) vCom.y = maxUpward;
                }
                if (minGap < 0.35 && vCom.y > 0.8) vCom.y = Math.min(vCom.y, Math.max(0.2, phy.hookVel.y + 0.2));
                if (minGap < 0.02) {
                    if (vCom.y < 0) vCom.y = 0;
                    const slip = Math.hypot(vCom.x, vCom.z);
                    const hold = mu * G_EARTH * dt;
                    if (slip > 1e-5) {
                        const scale = Math.max(0, slip - hold) / slip;
                        vCom.x *= scale;
                        vCom.z *= scale;
                    }
                    if (minGap < 0.008 && (!phy.hookVel || phy.hookVel.y <= 0.01)) {
                        omega.multiplyScalar(Math.exp(-dt * 15.0));
                        vCom.multiplyScalar(Math.exp(-dt * 15.0));
                    }
                }
                // Heavy industrial rigging damping.  This removes residual chatter
                // without flattening free-fall acceleration or making a 20 t load
                // look weightless.  Ground contacts themselves are inelastic.
                omega.multiplyScalar(Math.exp(-dt * 1.35));
                vCom.x *= Math.exp(-dt * 0.75);
                vCom.z *= Math.exp(-dt * 0.75);
                if (omega.length() > 2.8) omega.setLength(2.8);
                // A 6 m free fall reaches about 10.8 m/s.  The former 1.8 m/s
                // cap was the principal cause of slow, buoyant-looking failures.
                // This is a numeric safety guard only, well above normal site drops.
                if (vCom.length() > 14.0) vCom.setLength(14.0);
                (phy.beams || []).forEach(b => {
                    b.w.multiplyScalar(Math.exp(-dt * 4.5));
                    b.v.x *= Math.exp(-dt * 1.2);
                    b.v.z *= Math.exp(-dt * 1.2);
                    if (anyTautLeg && b.v.y > Math.max(0.6, Math.max(0, phy.hookVel.y) + 0.4)) {
                        b.v.y = Math.max(0.6, Math.max(0, phy.hookVel.y) + 0.4);
                    }
                    // A released member has no hidden self-levelling motor.  Its
                    // angle is governed by gravity, cable reactions and contacts.
                    if (b.w.length() > 3.2) b.w.setLength(3.2);
                    if (b.v.length() > 14.0) b.v.setLength(14.0);
                });
                const r2 = activeCogLocal().applyQuaternion(phy.cargoQuat);
                phy.cargoOmega.copy(omega);
                phy.cargoVel.copy(vCom).sub(new THREE.Vector3().crossVectors(omega, r2));
            }

            (phy.cables || []).forEach(c => { c.tensionT = c._n ? c._sum / c._n : 0; });
            // Run after cable constraints so visible steel cannot be reinserted
            // into a roof by the final rigging solve of this frame.
            (phy.beams || []).forEach(b => depenetrateBeamFromCargo(b, state.beamType === 'basket' ? 6 : 10));
            if (basketUsesKinematicPose()) {
                alignBasketBars();
                (phy.beams || []).forEach(b => depenetrateBeamFromCargo(b, 2));
                (phy.cables || []).forEach(c => {
                    const pA = attachWorld(c.a);
                    const pB = attachWorld(c.b);
                    const dir = pA.clone().sub(pB);
                    if (dir.lengthSq() > 1e-6) c.n = dir.normalize();
                });
                const barShareT = ((phy.massBreakdown ? phy.massBreakdown.beamMassT : 0.25) || 0.25) * 0.25;
                (phy.cables || []).forEach(cUp => {
                    if (cUp.role !== 'upper') return;
                    const cLeg = (phy.cables || []).find(cl => cl.role === 'leg' && cl.index === cUp.index);
                    if (!cLeg || cableIsBroken(cUp) || cableIsBroken(cLeg)) {
                        cUp.tensionT = 0;
                        cUp.slack = true;
                        return;
                    }
                    const cosPlay = Math.max(0.55, cUp.n && cLeg.n ? Math.abs(cUp.n.dot(cLeg.n)) : 0.92);
                    cUp.slack = cLeg.slack;
                    cUp.tensionT = cLeg.slack ? 0 : (cLeg.tensionT + barShareT) / cosPlay;
                });
            }
            let comp = 0;
            let compN = 0;
            const topBeam = phy.beams && phy.beams.length ? phy.beams[0] : null;
            const beamAxis = topBeam
                ? new THREE.Vector3(topBeam.axis === 'z' ? 0 : 1, 0, topBeam.axis === 'z' ? 1 : 0).applyQuaternion(topBeam.q).normalize()
                : null;
            (phy.cables || []).forEach(c => {
                if (c.role !== 'upper' || !(c.tensionT > 0.05) || !c.n) return;
                const axialProj = beamAxis ? Math.abs(c.n.dot(beamAxis)) : Math.sqrt(Math.max(0, 1 - c.n.y * c.n.y));
                comp += c.tensionT * axialProj;
                compN += 1;
            });
            phy.beamCompression = compN ? comp / compN : 0;
            phy.groundClearance = isFinite(clearance) ? Math.max(0, clearance) : 0;

            // After cable XPBD: force Flat Rack off the OOG outer skin (cables must not leave it buried)
            if (phy.oogState && (phy.oogState.status === 'falling' || phy.oogState.status === 'grounded')) {
                resolveFlatRackFallenOogContacts(frameDt);
                resolveFlatRackFallenOogContacts(frameDt);
            }
        }

        function stepPhysicsEngine() {
            const frameDt = 1 / 60;
            const substeps = 16;
            const dt = frameDt / substeps;
            phy.simFrame = (phy.simFrame || 0) + 1;

            // A cable can also be marked broken by an external control, an
            // imported scenario, or an automatic overload rule.  Do this check
            // before the pose-lock early return: a broken load path can never
            // remain a kinematic display pose.  This makes the transition
            // deterministic even when a caller did not go through the editor
            // button / noteCableSnap helper.
            if (state.poseLock && (phy.cables || []).some(cableIsBroken)) {
                releaseRigForCableFailure();
            }

            // Breaks can arrive from the editor, imported scenarios, overload
            // logic or automated tests.  Route every path through the same
            // one-time release physics so a flag change cannot silently remove
            // a cable without releasing its stored tension / angular impulse.
            (phy.cables || []).forEach(cable => {
                if (!cableIsBroken(cable)) {
                    cable._failureProcessed = false;
                    return;
                }
                if (cable._failureProcessed) return;
                releaseRigForCableFailure();
                releaseSnapImpulse(cable);
                applyLostFrameBranchMoment(cable);
                initCableBreak(cable);
                cable._failureProcessed = true;
                phy.shock = Math.max(phy.shock || 1, 1.55);
                phy.shockFrames = Math.max(phy.shockFrames || 0, 10);
            });

            if (phy.hoistSpeed !== 0) {
                phy.autoHoistActive = false;
                const grossLoadT = phy.massBreakdown ? phy.massBreakdown.grossCraneLoadT : (state.weight + phy.gearWeight);
                const totalMassKg = Math.max(100, grossLoadT * 1000);
                const loadRatio = Math.min(0.92, (totalMassKg * 9.81) / 650000); // 65T winch capacity
                const speedMult = Math.max(0.15, 1.0 - loadRatio);
                const actualSpeed = phy.hoistSpeed * speedMult;
                phy.hookTarget.y = THREE.MathUtils.clamp(phy.hookTarget.y + actualSpeed * frameDt, 2.0, 32.0);
            }

            if (phy.slewRate !== 0) {
                let ang = Math.atan2(phy.hookTarget.z, phy.hookTarget.x);
                let r = Math.hypot(phy.hookTarget.x, phy.hookTarget.z);
                if (r < 0.85) r = 3.4;
                ang += THREE.MathUtils.degToRad(phy.slewRate) * frameDt;
                phy.hookTarget.x = THREE.MathUtils.clamp(Math.cos(ang) * r, -7, 7);
                phy.hookTarget.z = THREE.MathUtils.clamp(Math.sin(ang) * r, -6, 6);
                state.slewDeg = (THREE.MathUtils.radToDeg(ang) + 360) % 360;
                state.pullRadius = Math.hypot(phy.hookTarget.x, phy.hookTarget.z);
                state.pullAzimuthDeg = state.slewDeg;
                const slewEl = document.getElementById('val-slew');
                if (slewEl) slewEl.textContent = Math.round(state.slewDeg) + '°';
            }

            if (state.poseLock && (phy.hoistSpeed > 0 || phy.autoHoistActive || (dragTarget && dragTarget.type === 'hook') || phy.hookTarget.y > phy.hookPos.y + 0.05)) {
                state.poseLock = false;
                syncPoseLockUI();
            }

            if (state.poseLock) {
                phy.rigLive = false;
                resetFlatRackPayloadState();
                applyLockedPose();
                seedBeamsFromKinematic();
                advanceHook(frameDt);
                stepCornerYield(frameDt);
                phy.legTensions = [0, 0, 0, 0, 0, 0, 0, 0];
                phy.upperTensions = [0, 0, 0, 0];
                phy.legSlacks = [true, true, true, true, true, true, true, true];
                phy.legForceN = [0, 0, 0, 0, 0, 0, 0, 0];
                phy.groundClearance = 0;
                const hookY = document.getElementById('inp-hook-y');
                if (hookY) {
                    phy.suppressHookInput = true;
                    hookY.value = phy.hookPos.y.toFixed(2);
                    phy.suppressHookInput = false;
                }
                const hookLbl = document.getElementById('val-hook-y');
                if (hookLbl) hookLbl.textContent = phy.hookPos.y.toFixed(1) + 'm';
                const numHookY = document.getElementById('num-hook-y');
                if (numHookY && document.activeElement !== numHookY) numHookY.value = phy.hookPos.y.toFixed(1);
                return;
            }

            runXpbdFrame(frameDt);
            if (!(phy.beams && phy.beams.length)) separateCargoFromBeam();
            stepCornerYield(frameDt);
            stepFlatRackPayloadPhysics(frameDt);

            if ((phy.impactCooldown || 0) > 0) phy.impactCooldown--;
            if ((phy.touchdownCooldown || 0) > 0) phy.touchdownCooldown--;
            if ((phy.pendingImpact || 0) > 3.2) {
                dentCargo(phy.pendingImpact);
                phy.pendingImpact = 0;
            }

            sanitizeSimBodies();

            publishCableLoads();

            const hookY = document.getElementById('inp-hook-y');
            if (hookY) {
                phy.suppressHookInput = true;
                hookY.value = phy.hookPos.y.toFixed(2);
                phy.suppressHookInput = false;
            }
            const hookLbl = document.getElementById('val-hook-y');
            if (hookLbl) hookLbl.textContent = phy.hookPos.y.toFixed(1) + 'm';
            const numHookY = document.getElementById('num-hook-y');
            if (numHookY && document.activeElement !== numHookY) numHookY.value = phy.hookPos.y.toFixed(1);
        }

        function syncPoseLockUI() {
            const el = document.getElementById('lbl-pose-lock');
            const hud = document.getElementById('hud-pose');
            if (el) {
                el.textContent = state.poseLock ? L('POSE LOCKED', 'KHÓA GÓC ĐẶT') : L('FREE TO ROTATE', 'ĐANG ĐỂ VẬT LÝ XOAY');
                el.className = 'text-[10px] font-mono font-bold ' + (state.poseLock ? 'text-amber-300' : 'text-sky-300');
            }
            if (hud) hud.textContent = state.poseLock ? L('Pose locked', 'Góc đặt đang khóa') : L('Cargo rotating on the ropes', 'Hàng đang xoay theo cáp');
        }

        function applyLockedPose() {
            const eul = new THREE.Euler(
                THREE.MathUtils.degToRad(state.cargoPitchTrimDeg),
                THREE.MathUtils.degToRad(state.cargoYawDeg),
                THREE.MathUtils.degToRad(state.cargoRollTrimDeg),
                'YXZ'
            );
            phy.cargoQuat.setFromEuler(eul);
            phy.cargoOmega.set(0, 0, 0);
            phy.cargoVel.set(0, 0, 0);
            const pts = supportPointsLocal();
            phy.cargoPos.y = supportY(phy.cargoPos.x, phy.cargoPos.z) + state.H;
            for (let n = 0; n < 12; n++) {
                let minGap = Infinity;
                for (let i = 0; i < pts.length; i++) {
                    const w = pts[i].clone().applyQuaternion(phy.cargoQuat).add(phy.cargoPos);
                    const gap = w.y - supportY(w.x, w.z);
                    if (gap < minGap) minGap = gap;
                }
                if (!isFinite(minGap) || Math.abs(minGap) < 0.004) break;
                phy.cargoPos.y -= minGap;
            }
            phy.groundClearance = 0;
        }

        function paintSling(poolIndex, role, index, pointA, pointB, len, opts) {
            const sling = sling3DPool[poolIndex];
            if (!sling) return;
            const item = role === 'leg' ? (state.gear.legs && state.gear.legs[index])
                : (role === 'extra' ? ((state.gear.extraCables || [])[index] || null)
                : (role === 'hanger' ? (state.gear.hangers && state.gear.hangers[index])
                : (state.gear.uppers && (state.gear.uppers[index] || state.gear.uppers[0]))));
            const swl = role === 'extra' ? ((item && item.swlT) || 12)
                : (role === 'leg' ? legSwl(index)
                : (role === 'hanger' ? ((item && item.swlT) || 25)
                : upperSwl(Math.min(index || 0, 3))));
            const cable = (phy.cables || []).find(cb => cb.role === role && cb.index === index);
            const tension = role === 'leg' ? (phy.legTensions[index] || 0)
                : (role === 'upper' ? (phy.upperTensions[index] || 0)
                : (role === 'hanger' ? ((phy.hangerTensions && phy.hangerTensions[index]) || 0)
                : (role === 'extra' ? ((cable && cable.tensionT) || 0) : 0)));
            const brokenHalf = opts && opts.brokenHalf ? opts.brokenHalf : null;
            const isBrokenStub = !!brokenHalf || !!(item && item.broken);
            const itemSlingType = effectiveSlingType(item);
            sling.drawMeta = {
                role,
                index,
                broken: isBrokenStub,
                brokenHalf: brokenHalf,
                selected: gearIsSelected('sling', role, index),
                diaMm: item && item.diaMm ? item.diaMm : (itemSlingType === 'web' ? 50 : 18),
                grade: item && item.grade ? item.grade : '',
                slingType: itemSlingType,
                parts: (item && item.parts) || 1,
                partIndex: (opts && opts.partIndex != null) ? opts.partIndex : 0
            };
            const chordNow = pointA.distanceTo(pointB);
            const tautOverload = !isBrokenStub && tension > swl + 0.05 && chordNow <= Math.max(0.2, len) * 1.003;
            // Working length is EXACTLY L0 (user-set). Never inflate with chord while slack —
            // that made a 2 m sling draw like a 4 m S-curve over the cargo.
            // A snapped cable is rendered as two independent remnants.  Its
            // physical/rest length is the corresponding remnant (`len`), not
            // the original full cable L0 — using the full length made each half
            // look like it grew after cutting and prevented it from settling.
            const L0 = isBrokenStub
                ? Math.max(0.16, len || chordNow)
                : Math.max(0.2, (cable && cable.L0 > 0.2) ? cable.L0 : (len || chordNow));
            const tautness = isBrokenStub ? 0 : (typeof ropeTautness === 'function'
                ? ropeTautness(chordNow, L0, tension, swl)
                : (chordNow >= L0 - 0.012 ? 1 : 0));
            // Every intact sling is inextensible at the scale of this simulator.
            // Do not silently extend the rendered path to a bad pin-to-pin chord:
            // that masks a broken constraint and makes a 2 m sling look 10 m long.
            // A cable can be straight when taut, but its physical length remains L0.
            const effectiveLen = L0;
            sling.drawMeta.tautness = tautness;
            sling.drawMeta.L0 = L0;

            // Seat sling eye thimbles cleanly inside the forged shackle bow bearing crowns (or Master Link crown)
            // and lock shackle orientation vectors (shackleDirA / shackleDirB) to the exact joint tangents!
            let visA = pointA.clone();
            let visB = pointB.clone();
            let visLen = effectiveLen;
            const dirs = pathLeaveArrive(pointA, pointB, effectiveLen, role, index);
            let dirA = dirs.leave.clone();
            let dirB = dirs.arrive.clone();

            if (cable && chordNow > 0.28) {
                const hwType = state.hwType || 'bow_shackle';
                let insetA = 0;
                let insetB = 0;
                if (cable.a && cable.a.kind === 'body') insetA = hardwareCrownOffset(hwType, 1.0);
                if (cable.b && cable.b.kind === 'body') insetB = hardwareCrownOffset(hwType, 1.0);
                else if (cable.b && cable.b.kind === 'cargo' && pointB.distanceTo(attachWorld(cable.b)) < 0.03) {
                    insetB = hardwareCrownOffset(hwType, cargoShackleScale(cable.b.index || 0));
                }
                const maxInset = chordNow * 0.28;
                insetA = Math.min(insetA, maxInset);
                insetB = Math.min(insetB, maxInset);

                if (cable.a && cable.a.kind === 'body' && role === 'leg') {
                    if (dirA.y > -0.18) { dirA.y = -0.18; dirA.normalize(); }
                }
                if (cable.b && cable.b.kind === 'body' && role === 'upper') {
                    if (dirB.y < 0.18) { dirB.y = 0.18; dirB.normalize(); }
                }
                // Keep cargo shackle bow on the sling line — only a light pad-eye bias so the
                // pin can clear the lug without yanking the bow 90° off the chain/cable.
                if (cable.b && cable.b.kind === 'cargo') {
                    const lugIdx = cable.b.index || 0;
                    const ringRes = padEyeRingWorld(lugIdx);
                    const nLug = (ringRes && ringRes.n) ? ringRes.n : new THREE.Vector3(0, 1, 0);
                    const along = dirB.dot(nLug);
                    if (along < 0.08) {
                        dirB.addScaledVector(nLug, 0.10 - along).normalize();
                    }
                }

                if (insetA > 0) {
                    visA = pointA.clone().addScaledVector(dirA, insetA);
                    // Keep eye seated on hardware crown — only clear soft solids, not cargo pin itself
                    if (!(cable.a && cable.a.kind === 'cargo')) {
                        const cleared = pushOutOfCargoShellWorld(visA, 0.024);
                        const checkA = cleared.clone().sub(pointA);
                        if (checkA.lengthSq() > 1e-6) dirA = checkA.normalize();
                        visA = pointA.clone().addScaledVector(dirA, insetA);
                    }
                }
                if (insetB > 0) {
                    // Cargo pad-eye crown must stay exact; shell push was nudging the eye off the pin
                    visB = pointB.clone().addScaledVector(dirB, insetB);
                    if (!(cable.b && cable.b.kind === 'cargo')) {
                        const cleared = pushOutOfCargoShellWorld(visB, 0.028);
                        const checkB = cleared.clone().sub(pointB);
                        if (checkB.lengthSq() > 1e-6) dirB = checkB.normalize();
                        visB = pointB.clone().addScaledVector(dirB, insetB);
                    }
                }
                if (insetA > 0 || insetB > 0) {
                    visLen = Math.max(0.16, effectiveLen - insetA - insetB);
                }
            }

            sling.pinA = pointA.clone();
            sling.pinB = pointB.clone();
            sling.shackleDirA = dirA.clone();
            sling.shackleDirB = dirB.clone();

            update3DSlingGeometry(sling, visA, visB, visLen, itemSlingType, !sling.drawMeta.broken && tautOverload);
            // Lock shackles to rendered sling tangents so the bow follows the cable/chain
            if (sling.dirLeave && sling.dirLeave.lengthSq() > 1e-8) sling.shackleDirA.copy(sling.dirLeave).normalize();
            if (sling.dirArrive && sling.dirArrive.lengthSq() > 1e-8) sling.shackleDirB.copy(sling.dirArrive).normalize();
            // Re-seat eyes on the bow crowns along the final shackle axes
            if (cable && chordNow > 0.28) {
                const hwType = state.hwType || 'bow_shackle';
                let insetA = 0;
                let insetB = 0;
                if (cable.a && cable.a.kind === 'body') insetA = hardwareCrownOffset(hwType, 1.0);
                if (cable.b && cable.b.kind === 'body') insetB = hardwareCrownOffset(hwType, 1.0);
                else if (cable.b && cable.b.kind === 'cargo') insetB = hardwareCrownOffset(hwType, cargoShackleScale(cable.b.index || 0));
                const maxInset = chordNow * 0.28;
                insetA = Math.min(insetA, maxInset);
                insetB = Math.min(insetB, maxInset);
                if (insetA > 0) visA = pointA.clone().addScaledVector(sling.shackleDirA, insetA);
                if (insetB > 0) visB = pointB.clone().addScaledVector(sling.shackleDirB, insetB);
            }
            sling.visA = visA.clone();
            sling.visB = visB.clone();
            if (sling.endEyeA && sling.endEyeA.visible) sling.endEyeA.position.copy(visA);
            if (sling.endEyeB && sling.endEyeB.visible) sling.endEyeB.position.copy(visB);
        }

        function alignLinkedHardware(rig, master) {
            if (!rig) return;
            spreaderRootGroup.updateMatrixWorld(true);
            jointLinks.forEach(g => {
                const link = g.userData.jointLink;
                if (!link || !g.parent) return;
                let from;
                let dir;
                if (link.role === 'upper') {
                    const item = state.gear.uppers[link.index];
                    const cable = (phy.cables || []).find(c => c.role === 'upper' && c.index === link.index);
                    if (item && item.broken && cable && cable.break) {
                        from = attachWorld(cable.b);
                        dir = cable.break.tipL.clone().sub(from);
                        if (dir.lengthSq() < 1e-8) dir.set(0, -1, 0);
                        else dir.normalize();
                    } else {
                        const sling = sling3DPool.find(s => s.group.visible && s.drawMeta && s.drawMeta.role === 'upper' && s.drawMeta.index === link.index && s.drawMeta.brokenHalf !== 'upper');
                        if (sling && sling.pinB && sling.shackleDirB) {
                            from = sling.pinB.clone();
                            dir = sling.shackleDirB.clone();
                        } else {
                            from = upperAnchorWorld(link.index, rig);
                            const to = master.clone();
                            dir = pathLeaveArrive(from, to, upperRestLength(link.index, rig.spec), 'upper', link.index).leave;
                        }
                    }
                } else if (link.role === 'leg') {
                    const item = state.gear.legs[link.index];
                    const cable = (phy.cables || []).find(c => c.role === 'leg' && c.index === link.index);
                    if (item && item.broken && cable && cable.break) {
                        from = attachWorld(cable.a);
                        dir = cable.break.tipU.clone().sub(from);
                        if (dir.lengthSq() < 1e-8) dir.set(0, -1, 0);
                        else dir.normalize();
                    } else {
                        const sling = sling3DPool.find(s => s.group.visible && s.drawMeta && s.drawMeta.role === 'leg' && s.drawMeta.index === link.index && s.drawMeta.brokenHalf !== 'lower');
                        if (sling && sling.pinA && sling.shackleDirA) {
                            from = sling.pinA.clone();
                            dir = sling.shackleDirA.clone();
                        } else {
                            from = slingAnchorWorld(link.index, rig);
                            const to = lugEyeWorld(link.index);
                            dir = pathLeaveArrive(from, to, legRestLength(link.index, rig.spec), 'leg', link.index).leave;
                        }
                    }
                } else if (link.role === 'hanger' || link.role === 'hangerB') {
                    const cable = (phy.cables || []).find(c => c.role === 'hanger' && c.index === link.index);
                    if (!cable) return;
                    const top = attachWorld(cable.a);
                    const bot = attachWorld(cable.b);
                    from = link.role === 'hangerB' ? bot : top;
                    dir = link.role === 'hangerB' ? top.clone().sub(bot) : bot.clone().sub(top);
                    if (dir.lengthSq() < 1e-8) dir.set(0, -1, 0);
                    else dir.normalize();
                } else if (link.fromLocal && link.upLocal && phy.beams && phy.beams.length) {
                    const host = phy.beams.find(b => b.group === g.parent) || phy.beams[0];
                    from = link.fromLocal.clone().sub(host.origin).applyQuaternion(host.q).add(host.x);
                    const to = link.upLocal.clone().sub(host.origin).applyQuaternion(host.q).add(host.x);
                    dir = to.sub(from);
                    if (dir.lengthSq() < 1e-8) dir.set(0, 1, 0);
                    else dir.normalize();
                } else if (link.fromLocal && link.upLocal) {
                    from = link.fromLocal.clone().applyQuaternion(rig.frameQ).add(rig.spreaderPos);
                    const to = link.upLocal.clone().applyQuaternion(rig.frameQ).add(rig.spreaderPos);
                    dir = to.sub(from);
                    if (dir.lengthSq() < 1e-8) dir.set(0, 1, 0);
                    else dir.normalize();
                } else return;
                const worldQ = tensionQuaternion(from, from.clone().add(dir));
                const parent = g.parent;
                parent.updateMatrixWorld(true);
                const invP = parent.getWorldQuaternion(new THREE.Quaternion()).invert();
                g.position.copy(parent.worldToLocal(from.clone()));
                g.quaternion.copy(invP).multiply(worldQ);
            });
            if (!cargoRootGroup) return;
            const invCargo = phy.cargoQuat.clone().invert();
            for (let i = 0; i < state.lugs.length; i++) {
                if (!state.lugs[i] || !hwMeshes[i] || !padEyeMeshes[i]) continue;
                const ring = padEyeRingWorld(i).ring;
                const item = state.gear.legs[i];
                const sling = sling3DPool.find(s => s.group.visible && s.drawMeta && s.drawMeta.role === 'leg' && s.drawMeta.index === i && s.drawMeta.brokenHalf !== 'upper');
                let dir;
                if (item && item.broken) {
                    const cable = (phy.cables || []).find(c => c.role === 'leg' && c.index === i);
                    if (cable && cable.break) {
                        dir = cable.break.tipL.clone().sub(ring);
                        if (dir.lengthSq() < 1e-8) dir.set(0, -1, 0);
                        else dir.normalize();
                    } else {
                        const inward = phy.cargoPos.clone().sub(ring);
                        inward.y = 0;
                        if (inward.lengthSq() < 1e-6) inward.set(1, 0, 0);
                        dir = inward.normalize().add(new THREE.Vector3(0, -0.35, 0)).normalize();
                    }
                } else if (sling && sling.shackleDirB && sling.drawMeta && sling.drawMeta.brokenHalf !== 'upper') {
                    dir = sling.shackleDirB.clone();
                } else {
                    const anchor = state.beamType === 'none' ? master.clone() : slingAnchorWorld(i, rig);
                    dir = pathLeaveArrive(anchor, lugEyeWorld(i), legRestLength(i, rig.spec), 'leg', i).arrive;
                }
                const worldQ = tensionQuaternion(ring, ring.clone().add(dir));
                const pinW = ring;
                hwMeshes[i].position.copy(cargoRootGroup.worldToLocal(pinW));
                hwMeshes[i].quaternion.copy(invCargo).multiply(worldQ);
                orientPadEyeToPin(padEyeMeshes[i], (state.lugNormals && state.lugNormals[i]) ? state.lugNormals[i] : new THREE.Vector3(0, 1, 0), new THREE.Vector3(1, 0, 0).applyQuaternion(worldQ));
            }
        }

        function upperRestLength(index, spec) {
            const item = state.gear && state.gear.uppers && state.gear.uppers[index];
            const custom = hasExplicitCableLength(item, 'upper') ? item.lengthM : null;
            if (custom != null) return Math.max(0.35, custom);
            if (state.upperSlingLength != null) return Math.max(0.35, state.upperSlingLength);
            return Math.max(0.35, spec ? spec.topLeg : 4.5);
        }

        function refreshFitMarks() {
            if (!phy.fitGroup) {
                phy.fitGroup = new THREE.Group();
                phy.fitGroup.name = 'fitMarks';
                scene.add(phy.fitGroup);
            }
            while (phy.fitGroup.children.length) {
                const ch = phy.fitGroup.children.pop();
                if (ch.geometry) ch.geometry.dispose();
                if (ch.material) ch.material.dispose();
            }
            const gaps = [];
            {
                (phy.cables || []).forEach(c => {
                    if (cableIsBroken(c)) return;
                    const A = attachWorld(c.a);
                    const B = attachWorld(c.b);
                    const slack = A.distanceTo(B) - c.L0;
                    if (!(slack > 0.08)) return;
                    gaps.push({ role: c.role, index: c.index, slack: slack });
                    const dir = B.clone().sub(A);
                    if (dir.lengthSq() < 1e-8) return;
                    const n = dir.normalize();
                    const reach = A.clone().addScaledVector(n, Math.min(c.L0, A.distanceTo(B)));
                    const tip = new THREE.Mesh(new THREE.SphereGeometry(0.07, 10, 8), new THREE.MeshBasicMaterial({ color: 0xff2d2d }));
                    tip.position.copy(reach);
                    const miss = new THREE.Mesh(new THREE.SphereGeometry(0.055, 10, 8), new THREE.MeshBasicMaterial({ color: 0xff2d2d }));
                    miss.position.copy(B);
                    phy.fitGroup.add(tip, miss);
                });
            }
            const banner = document.getElementById('fit-banner');
            if (!banner) return;
            if (phy.isOperationBlocked) {
                banner.style.display = 'block';
                const isLegBroken = (idx) => !!(state.gear && state.gear.legs && state.gear.legs[idx] && state.gear.legs[idx].broken);
                const tautAngles = (phy.legAngleDeg || []).filter((deg, i) => !isLegBroken(i) && (!phy.legSlacks || !phy.legSlacks[i]));
                const minHorizAngle = tautAngles.length ? Math.min(...tautAngles) : Math.max(0, 90 - (phy.maxAngleVert || 0));
                banner.textContent = state.lang === 'en'
                    ? `Error: Horizontal sling angle is less than 30 degrees (${minHorizAngle.toFixed(1)}°). Operation prohibited under ASME B30.9.`
                    : `Error: Horizontal sling angle is less than 30 degrees (${minHorizAngle.toFixed(1)}°). Operation prohibited under ASME B30.9. (Lỗi: Góc nâng ngang cáp < 30°. Nghiêm cấm nâng cẩu theo ASME B30.9 & OSHA).`;
                return;
            }
            if (!gaps.length) {
                banner.style.display = 'none';
                banner.textContent = '';
                return;
            }
            const names = state.lang === 'en'
                ? { upper: 'upper sling', leg: 'sling leg', hanger: 'hanger', extra: 'extra rope' }
                : { upper: 'cáp trên', leg: 'cáp nhánh', hanger: 'cáp treo', extra: 'cáp thêm' };
            banner.style.display = 'block';
            banner.textContent = L('Rope will not stretch — ', 'Cáp không giãn — ') + gaps.map(g => L(
                `${names[g.role] || 'joint'} ${g.index + 1} stops short by ${g.slack.toFixed(2)} m`,
                `${names[g.role] || 'mối'} ${g.index + 1} không tới, thiếu ${g.slack.toFixed(2)} m`
            )).join(' · ');
        }
