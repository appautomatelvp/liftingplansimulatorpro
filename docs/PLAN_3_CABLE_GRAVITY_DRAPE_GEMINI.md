# PLAN 3 — KẾ HOẠCH NÂNG CẤP TRIỆT ĐỂ VẬT LÝ CÁP RỦ TRỌNG TRƯỜNG & ÔM BỀ MẶT 3D (DÀNH CHO GEMINI FLASH)

> [!IMPORTANT]
> **Mục tiêu cốt lõi:** Xử lý **tận gốc** hiện tượng cáp/xích cẩu bị gấp khúc zíc-zắc ngang lơ lửng giữa không trung (như hình chụp thực tế với dầm ngáng khung H-Beam Spreader và kiện Flat Rack chở hàng OOG), đảm bảo **100% dây cáp, xích, đai vải luôn chịu lực trọng trường hướng thẳng xuống đất ($-Y$)**, chỉ trượt/tựa tự nhiên trên bề mặt vật thể 3D thực sự cản đường và tuyệt đối không tự phóng ngang hoặc tạo sóng đàn xếp giữa không khí.

---

## PHẦN 1: CHẨN ĐOÁN CHÍNH XÁC 5 NGUYÊN NHÂN GỐC RỄ TRONG `src/sim/rigging.js`

Qua phân tích hình ảnh thực tế và giải thuật trong `src/sim/rigging.js`, hiện tượng xích tầng dưới bắn ngang 1.5m vào thành kiện hàng trắng (OOG) và gấp khúc nhiều tầng lơ lửng xuất phát từ **5 lỗi toán học tương tác trực tiếp với nhau**:

1. **Nguyên nhân 1 — Khuếch đại sai số phương ngang theo cấp số nhân trong `fitPathToFixedLength()` và ghi ngược vào trạng thái PBD (`rs.p`):**
   - Tại dòng `1905–1911`, khi tổng chiều dài dây `len < target` (do bị làm mượt hoặc bị kẹt chiều cao), hàm tính `scale = target / len > 1` rồi nhân phóng đại toàn bộ vector khoảng cách từ dây cung `AB` theo **cả 3 trục $(X, Y, Z)$**:
     `out[i].sub(onChord).multiplyScalar(scale).add(onChord)`.
   - Khi độ võng thẳng đứng ($\Delta y$) bị chặn bởi sàn/nóc giả, toàn bộ phần chiều dài dư `L0 - len` bị bơm vào **độ lệch phương ngang ($\Delta x, \Delta z$)**.
   - Nguy hiểm hơn, tại dòng `2774` trong `simulateSlackRope()`, `rs.p[i].copy(rs.rendered[i])` lưu trực tiếp mảng đã bị phóng đại ngang này làm đầu vào cho frame tiếp theo! Chỉ sau vài chục frame, một nhiễu ngang 1mm bị nhân bội thành các vây sóng ngang dài 1.5m đập thẳng vào thành kiện hàng OOG ở $x = \pm 4.4\text{m}$.

2. **Nguyên nhân 2 — Bẫy Heightmap 2D (`cargoLocalRoofY`, `liftRopeOntoCargoRoof`, `shouldClampToRoof`) khóa cứng không cho xích rủ xuống dưới tai cẩu vách đầu Flat Rack:**
   - Trong `cargoLocalRoofY()`: với `flatrack`, vùng vách đầu (`|lx| >= L * 0.5 - 0.22 - p`) trả về `H * 0.5 + p` (cao độ đỉnh vách đầu nơi gắn tai cẩu `pointB`).
   - Trong `simulateSlackRope()`: biến `bothEndsAboveRoof = solid && (minEndLocalY >= solid.roofY - 0.65)` nhận giá trị `true` khi cả đầu móc dầm ngáng (`pointA`) và tai cẩu trên đỉnh vách Flat Rack (`pointB`) đều ở cao. Hệ quả là `shouldClampToRoof(p)` luôn `true`, ép mọi điểm của sợi xích không được phép xuống thấp hơn `roofY` (`H * 0.5 + p` tại vách đầu hoặc `dunnageTopY + cH + p` tại kiện OOG)!
   - Khi sợi xích dài $2.5\text{m}$ nối giữa 2 điểm cách nhau $0.8\text{m}$ nhưng **bị cấm rủ xuống dưới `pointB.y`**, nó buộc phải bung ngang ra không trung.

3. **Nguyên nhân 3 — Trọng lực quá yếu so với 15 lượt làm mượt Laplacian mỗi frame trong `simulateSlackRope()`:**
   - Mỗi frame, trọng lực Verlet chỉ kéo điểm dây xuống `G_EARTH * dt2 * 2.6 ≈ 0.007m` (`7mm`) đúng **1 lần duy nhất** trước vòng lặp `relax()`.
   - Trong khi đó, `relax()` chạy 12 vòng + 3 vòng hậu xử lý = **15 lượt kéo thẳng về trung điểm** (`p[i].lerp(mid, 0.30)`) **SAU KHI** đã giải ràng buộc chiều dài `segLen`.
   - 15 lượt làm mượt này xóa sạch lực kéo trọng trường 7mm, làm dây co ngắn lại rồi kích hoạt Nguyên nhân 1. Ngoài ra, bộ tạo lệch ngang nhân tạo (`latN` tại dòng `2648–2668` và `2716–2732`) liên tục đẩy dây sang ngang mỗi frame.

4. **Nguyên nhân 4 — Ghi đè cứng bán kính uốn `minR = 0.32m` làm mất tính mềm của Xích và Đai vải:**
   - Tại dòng `2818`, `simStiffR` đã được tính đúng: `(isChainNow || isFlatNow) ? 0 : Math.max(0.12, 8 * diaNowM)`.
   - Nhưng vào trong `simulateSlackRope()` (dòng `2592` và `2739`), code lại viết: `const minR = Math.max(0.32, stiffR || 0.32);`. Vì `0 || 0.32` bằng `0.32`, mọi sợi xích đều bị ép bán kính uốn tối thiểu tới `0.32m` như cáp thép cứng khổng lồ, khiến xích trong khe hẹp không thể gập chữ U thẳng đứng mà phình ngang.

5. **Nguyên nhân 5 — `seedSurfaceDrape()` và `useSurface` kích hoạt sai cho cáp nằm hoàn toàn bên ngoài kiện hàng OOG:**
   - Tại dòng `2295` của `solveDrapedRopePath()`, `useSurface = !!(solid && canDrape && (needsRoof || (slack > 0.06 && nearCargo)))` bật ngay cả khi cả `pointA` ($x = 5.5\text{m}$) và `pointB` ($x = 6.0\text{m}$) nằm hoàn toàn bên ngoài kiện hàng trắng OOG (`solid.hx = 4.4m`) và dây cung `AB` không hề cắt qua `solid`.
   - Khi `seedSurfaceDrape()` chạy, nó kẹp `roofStart.x` vào `[-solid.hx, +solid.hx]` ($x = 4.2\text{m}$), kéo sợi cáp bắn ngang $1.5\text{m}$ vào nóc kiện hàng trắng rồi lại kéo ngược ra `pointB`!

---

## PHẦN 2: QUY TẮC THIẾT KẾ VẬT LÝ BẮT BUỘC CHO GEMINI FLASH

Khi thực hiện 5 bước nâng cấp bên dưới trên file `src/sim/rigging.js`, **Gemini Flash** phải tuân thủ tuyệt đối các nguyên tắc sau:
1. **Không thay đổi chữ ký hàm (function signatures)** của bất kỳ hàm nào trong `src/sim/rigging.js` (`solveDrapedRopePath`, `simulateSlackRope`, `update3DSlingGeometry`, `routeRopeAroundBeams`, `pushOutOfCargoShellWorld`, `cargoShellTopWorldY`, v.v.).
2. **Bảo toàn 100% 160 bài kiểm thử đơn vị hiện có** trong `test/rigging.test.js` (đặc biệt các bài test `7`, `8`, `8b`, `8c`, `8d`, `12`, `12aa`, `12ab`, `12ac`, `12b`, `12c`).
3. **Định luật Trọng trường Tuyệt đối:** Mọi phần chiều dài cáp dư (`slack = L0 - chord > 0`) không bị cản bởi vật thể rắn **bắt buộc phải chuyển hóa thành độ võng hướng xuống dưới ($-Y$)** theo đường dây xích (Catenary $\cosh$ hoặc chữ U thẳng đứng), **tuyệt đối không bao giờ nhân phóng đại độ lệch phương ngang ($X, Z$)**.

---

## PHẦN 3: HƯỚNG DẪN CHỈNH SỬA TỪNG BƯỚC CHO GEMINI FLASH

### BƯỚC 1: Sửa triệt để `fitPathToFixedLength()` & `catenaryPoints()` — Chấm dứt khuếch đại lệch ngang, hỗ trợ Catenary thẳng đứng

- **Vị trí 1 (Dòng `1833–1931` trong `src/sim/rigging.js`):** Thay thế hàm `fitPathToFixedLength` bằng phiên bản chỉ điều chỉnh độ võng theo phương trọng trường ($-Y$) và cân bằng độ dài đoạn mà không bao giờ phóng đại phương ngang:

```javascript
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
            // Path longer than L0: blend toward straight reference until arc ≈ L0
            if (len > target + 0.015) {
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
            } else if (len < target - 0.015) {
                // Path shorter than L0: deepen vertical gravity belly (-Y) ONLY.
                // NEVER scale horizontal (X, Z) offsets!
                const base = out.map(p => p.clone());
                let lo = 0;
                let hi = Math.max(0.25, (target - chord) * 1.15);
                for (let k = 0; k < 16; k++) {
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

            // Final pass: if still slightly longer than target, pull gently toward chord without scaling X/Z outward
            len = measure(out);
            if (len > target + 0.015 && len > 1e-4) {
                const t = THREE.MathUtils.clamp(1 - target / len, 0, 0.90);
                for (let i = 1; i < N; i++) {
                    out[i].lerp(str[i], t * 0.75);
                }
                out[0].copy(pointA);
                out[N].copy(pointB);
            }
            return out;
        }
```

- **Vị trí 2 (Dòng `2400–2430` trong `src/sim/rigging.js`):** Cập nhật `catenaryPoints()` để khi 2 đầu dây gần như thẳng đứng ($h < 0.06\text{m}$), dây tạo bụng chữ U thẳng đứng mượt mà thay vì gập 180° trên cùng một trục:

```javascript
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
```

---

### BƯỚC 2: Sửa `liftRopeOntoCargoRoof()` và `pushPointClear()` — Va chạm 3D theo hướng tiếp cận thực tế thay vì dịch chuyển tức thời lên nóc Heightmap 2D

- **Vị trí (Dòng `1618–1692` trong `src/sim/rigging.js`):** Thay thế `liftRopeOntoCargoRoof` và `pushPointClear` bằng:

```javascript
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
```

---

### BƯỚC 3: Sửa `solveDrapedRopePath()` — Không bao giờ kéo cáp nằm ngoài vật thể chạy ngang lên nóc vật thể

- **Vị trí (Dòng `2270–2357` trong `src/sim/rigging.js`):** Thay đoạn tính `nearCargo` / `useSurface` và hậu xử lý của `solveDrapedRopePath` bằng:

```javascript
            // Check whether the A→B span actually crosses over/into the main solid footprint in local (X, Z)
            let spanCrossesSolid = false;
            if (solid) {
                const locA = cargoLocalFromWorld(pointA);
                const locB = cargoLocalFromWorld(pointB);
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

            // Only attempt surface roof drape if the span actually crosses over the solid footprint
            // and L0 is long enough to wrap around the corner.
            let minCorner = chord;
            if (solid && spanCrossesSolid) {
                const locA = cargoLocalFromWorld(pointA);
                const locB = cargoLocalFromWorld(pointB);
                const edgeDist = Math.min(
                    Math.abs(Math.abs(locA.x - solid.ox) - solid.hx) + Math.abs(Math.abs(locB.x - solid.ox) - solid.hx),
                    Math.abs(Math.abs(locA.z - solid.oz) - solid.hz) + Math.abs(Math.abs(locB.z - solid.oz) - solid.hz)
                );
                minCorner = Math.min(chord * 1.15, chord + edgeDist * 0.5 + minR);
            }
            const canDrape = L0 >= minCorner - 0.05;
            const useSurface = !!(solid && spanCrossesSolid && canDrape && (needsRoof || slack > 0.06));

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
                // Clear any actual 3D shell contact (e.g. bulkhead, deck, or side wall) without roof-teleporting
                for (let i = 1; i < pts.length - 1; i++) {
                    pts[i] = pushPointClear(pts[i], pad * 0.85, ropeSkip(pts[i], ends, allowA, allowB));
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

            // Light surface glue after fit (only when useSurface is active)
            if (useSurface && solid) {
                for (let i = 1; i < pts.length - 1; i++) {
                    const locI = cargoLocalFromWorld(pts[i]);
                    if (Math.abs(locI.x - solid.ox) <= solid.hx && Math.abs(locI.z - solid.oz) <= solid.hz) {
                        const roofY = cargoRoofAtXZ(pts[i].x, pts[i].z, pad * 0.35);
                        if (roofY != null && pts[i].y < roofY) pts[i].y = roofY;
                    }
                }
                pts = fitPathToFixedLength(pts, pointA, pointB, targetLen, solid, pad);
            }

            const solidCheck = cargoWrapSolid(pad);
            if (solidCheck && spanCrossesSolid) {
                const locA2 = cargoLocalFromWorld(pointA);
                const locB2 = cargoLocalFromWorld(pointB);
                const bothEndsAbove = (Math.min(locA2.y, locB2.y) >= solidCheck.roofY - 0.35);
                for (let i = 1; i < pts.length - 1; i++) {
                    const locI = cargoLocalFromWorld(pts[i]);
                    const isInsideRoof = (locI.y >= solidCheck.bottomY - 0.10)
                        && Math.abs(locI.x - solidCheck.ox) <= Math.max(0.1, solidCheck.hx - 0.12)
                        && Math.abs(locI.z - solidCheck.oz) <= Math.max(0.1, solidCheck.hz - 0.12);
                    if (isInsideRoof && (bothEndsAbove || locI.y >= solidCheck.roofY - 0.25)) {
                        const roofY = cargoRoofAtXZ(pts[i].x, pts[i].z, pad * 0.5);
                        if (roofY != null && pts[i].y < roofY) pts[i].y = roofY;
                    }
                }
            }

            pts[0].copy(pointA);
            pts[pts.length - 1].copy(pointB);
            return pts;
```

---

### BƯỚC 4: Nâng cấp toàn diện `simulateSlackRope()` — Giải thuật XPBD Trọng trường Thuần túy & Tiếp xúc Bề mặt 3D

- **Vị trí (Dòng `2496–2779` trong `src/sim/rigging.js`):** Thay thế toàn bộ hàm `simulateSlackRope` bằng:

```javascript
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
            const bothEndsAboveRoof = solid && (minEndLocalY >= solid.roofY - 0.35);

            // True 3D roof interior check: ONLY true when the point is actually inside the XZ footprint of `solid`
            const isOverRoofInterior = (w) => {
                if (!solid) return false;
                loc.copy(w).sub(phy.cargoPos).applyQuaternion(invQ);
                return (loc.y >= solid.bottomY - 0.10)
                    && Math.abs(loc.x - solid.ox) <= Math.max(0.05, solid.hx - pad * 0.2)
                    && Math.abs(loc.z - solid.oz) <= Math.max(0.05, solid.hz - pad * 0.2);
            };

            // Only clamp to `solid.roofY` when the node is over the solid's XZ interior AND approaching from above
            const shouldClampToRoof = (w) => {
                if (!solid || !isOverRoofInterior(w)) return false;
                loc.copy(w).sub(phy.cargoPos).applyQuaternion(invQ);
                return bothEndsAboveRoof || (loc.y >= solid.roofY - 0.25);
            };

            const outsideShell = (w) => {
                loc.copy(w).sub(phy.cargoPos).applyQuaternion(invQ);
                const o = pushOutOfCargoShellLocal(loc, pad, false);
                return o.distanceToSquared(loc) < 1e-10;
            };

            const clearExternalSolids = (p) => {
                const skip = ropeSkip(p, [A, B], allowA, allowB);
                const cleared = pushPointClear(p, pad, skip);
                p.copy(cleared);
            };

            const collide = (p, from) => {
                const prevPos = from ? from.clone() : null;
                let onHorizontalSurface = false;
                const floorY = supportY(p.x, p.z) + pad;
                if (p.y <= floorY + 0.004) {
                    p.y = floorY;
                    onHorizontalSurface = true;
                }
                if (shouldClampToRoof(p)) {
                    const roofY = cargoRoofAtXZ(p.x, p.z, pad);
                    if (roofY != null && p.y <= roofY + 0.004) {
                        p.y = roofY;
                        onHorizontalSurface = true;
                    }
                }
                if (!outsideShell(p)) {
                    if (from && outsideShell(from)) {
                        const STEPS = 8;
                        let lastOut = from;
                        for (let s = 1; s <= STEPS; s++) {
                            tmp.lerpVectors(from, p, s / STEPS);
                            if (tmp.y < floorY) tmp.y = floorY;
                            if (outsideShell(tmp)) { lastOut = tmp.clone(); } else break;
                        }
                        p.copy(lastOut);
                    }
                    tmp.copy(p).sub(phy.cargoPos).applyQuaternion(invQ);
                    const biasUp = shouldClampToRoof(p);
                    const out = pushOutOfCargoShellLocal(tmp.clone(), pad, biasUp);
                    if (out.distanceToSquared(tmp) > 1e-10) {
                        if (out.y > tmp.y + 0.002) onHorizontalSurface = true;
                        p.copy(out).applyQuaternion(phy.cargoQuat).add(phy.cargoPos);
                    }
                }
                if (p.y < floorY) {
                    p.y = floorY;
                    onHorizontalSurface = true;
                }
                if (shouldClampToRoof(p)) {
                    const roofY = cargoRoofAtXZ(p.x, p.z, pad);
                    if (roofY != null && p.y < roofY) {
                        p.y = roofY;
                        onHorizontalSurface = true;
                    }
                }
                clearExternalSolids(p);
                // Surface Coulomb friction damping when resting on a roof, deck, or ground
                if (onHorizontalSurface && prevPos) {
                    p.x = THREE.MathUtils.lerp(p.x, prevPos.x, 0.32);
                    p.z = THREE.MathUtils.lerp(p.z, prevPos.z, 0.32);
                }
            };

            const resolveSegmentContacts = (p) => {
                for (let i = 0; i < N; i++) {
                    const mid = p[i].clone().lerp(p[i + 1], 0.5);
                    const cleared = pushPointClear(mid, pad, ropeSkip(mid, [A, B], allowA, allowB));
                    const correction = cleared.sub(mid);
                    if (correction.lengthSq() < 1e-10) continue;
                    if (i > 0) p[i].addScaledVector(correction, 0.50);
                    if (i + 1 < N) p[i + 1].addScaledVector(correction, 0.50);
                }
            };

            // Respect material bending stiffness: 0 for chain/web slings, >0 for steel wire rope
            const minR = (stiffR != null && stiffR >= 0) ? stiffR : 0.16;
            const kBend = minR > 0.05 ? 0.08 : 0.015;

            const projectDistanceConstraints = (p) => {
                p[0].copy(A);
                p[N].copy(B);
                // Symmetric forward + backward Gauss-Seidel sweep so both pins pull equally
                for (let dir = 0; dir < 2; dir++) {
                    for (let s = 0; s < N; s++) {
                        const i = dir === 0 ? s : (N - 1 - s);
                        const a = p[i], b = p[i + 1];
                        const dx = b.x - a.x, dy = b.y - a.y, dz = b.z - a.z;
                        const d = Math.sqrt(dx * dx + dy * dy + dz * dz) || 1e-9;
                        const k = (d - segLen) / d;
                        const wa = i === 0 ? 0 : 0.5;
                        const wb = (i + 1) === N ? 0 : 0.5;
                        const ws = wa + wb || 1;
                        a.x += dx * k * (wa / ws); a.y += dy * k * (wa / ws); a.z += dz * k * (wa / ws);
                        b.x -= dx * k * (wb / ws); b.y -= dy * k * (wb / ws); b.z -= dz * k * (wb / ws);
                    }
                }
                p[0].copy(A);
                p[N].copy(B);
            };

            const relax = (p, iters, withCollide, ref, gStep) => {
                const grav = gStep != null ? gStep : 0.0045;
                for (let it = 0; it < iters; it++) {
                    // 1) Gravity pull (-Y) inside every relaxation substep so free spans always hang straight down
                    if (grav > 0) {
                        for (let i = 1; i < N; i++) {
                            p[i].y -= grav;
                        }
                    }
                    // 2) Light curvature smoothing + material bend radius BEFORE distance projection
                    if (kBend > 0) {
                        for (let i = 1; i < N; i++) {
                            const mid = p[i - 1].clone().add(p[i + 1]).multiplyScalar(0.5);
                            p[i].lerp(mid, kBend);
                        }
                    }
                    if (minR > 0.05) {
                        enforceMinBendRadius(p, minR);
                    }
                    // 3) Exact inextensible segment length projection (segLen = L / N)
                    projectDistanceConstraints(p);

                    // 4) 3D solid & ground contact resolution
                    if (withCollide && (it % 2 === 0 || it === iters - 1)) {
                        for (let i = 1; i < N; i++) {
                            collide(p[i], ref ? ref[i] : null);
                            if (ref) ref[i].copy(p[i]);
                        }
                        resolveSegmentContacts(p);
                        projectDistanceConstraints(p);
                    }
                }
                for (let i = 1; i < N; i++) {
                    collide(p[i], ref ? ref[i] : null);
                    if (ref) ref[i].copy(p[i]);
                }
                resolveSegmentContacts(p);
                projectDistanceConstraints(p);
            };

            if (reseed) {
                let seed = catenaryPoints(A, B, L, N);
                if (!seed || seed.length !== N + 1) {
                    seed = [];
                    for (let i = 0; i <= N; i++) {
                        const q = new THREE.Vector3().lerpVectors(A, B, i / N);
                        q.y -= 0.35 * Math.max(0.05, L - A.distanceTo(B)) * Math.sin(Math.PI * i / N);
                        seed.push(q);
                    }
                }
                const ref = seed.map((_, i) => new THREE.Vector3().lerpVectors(A, B, i / N));
                for (let i = 1; i < N; i++) { collide(seed[i], ref[i]); ref[i].copy(seed[i]); }
                relax(seed, 24, true, ref, 0.008);
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

                // Overdamped Verlet integration with strong downward gravity
                const dt2 = (1 / 60) * (1 / 60);
                for (let i = 1; i < N; i++) {
                    const t = i / N;
                    const q = p[i], o = prev[i];
                    q.addScaledVector(dA, 1 - t).addScaledVector(dB, t);
                    o.addScaledVector(dA, 1 - t).addScaledVector(dB, t);
                    let vx = (q.x - o.x) * 0.42;
                    let vy = (q.y - o.y) * 0.48;
                    let vz = (q.z - o.z) * 0.42;
                    const vMag = Math.hypot(vx, vy, vz);
                    if (vMag > 0.025) {
                        const sc = 0.025 / vMag;
                        vx *= sc; vy *= sc; vz *= sc;
                    }
                    o.copy(q);
                    q.x += vx;
                    q.y += vy - G_EARTH * dt2 * 3.2;
                    q.z += vz;
                }
                relax(p, 12, true, ref, 0.0045);
                prev[0].copy(p[0]); prev[N].copy(p[N]);
            }

            let pOut = rs.p.map(v => v.clone());
            if (minR > 0.05) {
                enforceMinBendRadius(pOut, minR);
                projectDistanceConstraints(pOut);
            }
            for (let i = 1; i < N; i++) {
                collide(pOut[i], rs.ref ? rs.ref[i] : null);
            }
            projectDistanceConstraints(pOut);

            if (!rs.rendered || rs.rendered.length !== N + 1) {
                rs.rendered = pOut.map(v => v.clone());
            }
            rs.rendered[0].copy(A);
            rs.rendered[N].copy(B);
            for (let i = 1; i < N; i++) {
                rs.rendered[i].lerp(pOut[i], 0.48);
                collide(rs.rendered[i], rs.ref ? rs.ref[i] : null);
                rs.p[i].copy(pOut[i]);
                rs.prev[i].lerp(rs.p[i], 0.65);
                pOut[i].copy(rs.rendered[i]);
            }
            return pOut;
        }
```

---

### BƯỚC 5: Bổ sung bài kiểm thử hồi quy chống gấp khúc ngang trong `test/rigging.test.js`

- Thêm test `8e` ngay sau test `8d` trong `test/rigging.test.js`:

```javascript
    it('8e. Flat Rack with OOG cargo + H-Frame spreader: slack lower chains hang downward under gravity without horizontal mid-air zig-zag onto OOG box', () => {
        const ctx = loadRiggingToContext({
            cargoType: 'flatrack',
            L: 12.19,
            W: 2.44,
            H: 2.59,
            oogHasCargo: true,
            oogCargoL: 8.8,
            oogCargoW: 2.4,
            oogCargoH: 2.4,
            spreaderType: 'h_frame',
            spreaderSpan: 11.0,
            slingType: 'chain',
            lowerGrade: 'g80'
        });
        ctx.state.cargoType = 'flatrack';
        ctx.state.spreaderType = 'h_frame';
        ctx.state.spreaderSpan = 11.0;
        ctx.state.slingType = 'chain';
        ctx.state.lowerGrade = 'g80';
        ctx.rebuildCargo3D();
        ctx.autoPlacePoints();
        ctx.resetPhysicsState();

        // Lower hook so lower chains have generous slack above the flatrack bulkhead lugs
        ctx.phy.hookPos.y -= 1.2;
        for (let step = 0; step < 30; step++) {
            ctx.updatePhysics(1 / 60);
            ctx.update3DRigging();
        }

        const lowerCables = ctx.phy.cables.filter(c => c.role === 'lower');
        expect(lowerCables.length).toBeGreaterThanOrEqual(4);

        lowerCables.forEach((cable, idx) => {
            const A = ctx.endWorld(cable.a);
            const B = ctx.endWorld(cable.b);
            const slingObj = ctx.slings3D[idx];
            expect(slingObj).toBeDefined();
            const pts = ctx.simulateSlackRope(slingObj, A, B, Math.max(cable.L0, A.distanceTo(B) + 0.8), 0.018, 0, ['beam:frame'], ['cargo']);

            const minX = Math.min(Math.abs(A.x), Math.abs(B.x));
            const maxX = Math.max(Math.abs(A.x), Math.abs(B.x));
            let minY = Infinity;
            for (let i = 0; i < pts.length; i++) {
                if (pts[i].y < minY) minY = pts[i].y;
                // Must NEVER shoot horizontally inward to the OOG box wall at |x| = 4.4m!
                expect(Math.abs(pts[i].x)).toBeGreaterThanOrEqual(minX - 0.28);
                expect(Math.abs(pts[i].x)).toBeLessThanOrEqual(maxX + 0.28);
                // Must not float above highest pin
                expect(pts[i].y).toBeLessThanOrEqual(Math.max(A.y, B.y) + 0.04);
            }
            // Must exhibit a true downward gravity belly below the lower pin (or midpoint if steep)
            const midChordY = 0.5 * (A.y + B.y);
            expect(minY).toBeLessThan(midChordY - 0.08);
        });
    });
```

---

## PHẦN 4: QUY TRÌNH KIỂM TRA & NGHIỆM THU BẮT BUỘC SAU KHI SỬA

Sau khi **Gemini Flash** hoàn tất chỉnh sửa 5 bước trên, chạy lần lượt các lệnh sau tại thư mục gốc dự án để nghiệm thu:

1. **Chạy toàn bộ Unit & Physics Tests (Vitest):**
   ```powershell
   npm test
   ```
   - **Tiêu chuẩn đạt:** `17 passed (17)`, `161 passed (161)` (160 test cũ + 1 test `8e` mới đều XANH 100%).
2. **Chạy kiểm tra Build Production:**
   ```powershell
   npm run build
   ```
   - **Tiêu chuẩn đạt:** `built in ...` không có bất kỳ lỗi cú pháp hay cảnh báo import nào.
3. **Chạy bộ E2E Playwright Test:**
   ```powershell
   npx playwright test
   ```
   - **Tiêu chuẩn đạt:** `28 passed` trên cả 4 độ phân giải màn hình.
