# KẾ HOẠCH THỰC HIỆN (PLAN.md)
Trạng thái: ACTIVE
Tính năng: ULTIMATE MASTER DIRECTIVE — 5 Trụ cột Vật lý & Kỹ thuật Nâng hạ (DNV-ST-N001 / ASME B30) cho SafeLift3D
Nhánh Git: feat/horizon-clouds (backup: `_BACKUPS_LOCAL\...ultimate-physics-5-pillars.zip`)
Người lập kế hoạch: Model cao nhất (KHÔNG viết code ở bước này). Model thực thi gõ `làm tiếp` 1 lần để chạy một mạch Bước 1 → 11.

## 0. KẾT QUẢ KHÁM CODE (cái gì ĐÃ CÓ — không làm lại, chỉ nối dây / vá khoảng trống)
| Trụ cột | Đã có | Khoảng trống thật sự |
|---|---|---|
| 1. DNV 4 điểm | `applyDNV4LegSkewRule` (`RiggingPhysicsSolver.js:253`, 2 chân chéo 100% × SKL 1.25–1.5, đang nối vào solver dòng 521). | **Hai mô hình mâu thuẫn:** HUD (`telemetry.js:912` → `ElasticSlingEngine.evaluateFourLegIndeterminacy`) hiển thị chéo ~75–85%, còn solver dùng 100%. Chưa chọn chéo theo CoG lệch một cách nhất quán, chưa có dung sai chiều dài ±% từng sợi. |
| 1. WLL cục bộ | `computeShackleSideDerate` (`standards/hardware.js:79`, 45°=70%, 90°=50%). | Chưa phân biệt **Bow (thân) vs Pin (chốt)**; chưa biết dây đang tựa vào đâu; chưa có ứng suất cắt chốt riêng. |
| 2. Gizmo góc | Không có (chỉ nhãn chữ `α`, `β` ở `telemetry.js`). Mũi tên lực `forceArrows[]` có ở `shell_rebuild.js`. | **Thiếu hoàn toàn** cung góc 3D + tooltip; mũi tên lực chưa gốc ở CoG/điểm nối theo tỉ lệ T. |
| 3. Va chạm | `CollisionMaterialSolver.js` (CCD cầu quét–OBB, ma sát Coulomb), `TrueMeshSurfaceContact.js`, `sampleDunnageContactPointsForCargo`. | Chưa dùng Convex Hull / Compound collider cho Spreader–Lug–mép kiện; xích–xích chưa đẩy nhau; còn va chạm AABB ở `beams_seed.js`. |
| 4. XPBD dây/xích | `CableDynamicsXPBD.js`, `BrokenCableWhipXPBD.js` (có `computeElasticSnapRecoil`), profile theo vật liệu. | Chưa kiểm chứng bằng test số: (a) xích gập sắc vs cáp thép catenary rộng vs vải chịu gió; (b) đứt → **hai đầu giật ngược** vài khung hình đầu rồi mới rơi + giảm chấn không khí. |
| 5. Trọng lực / Dầm | Mô-men phục hồi `r×mg` (`beams_seed.js:2632`, `flatrack_payload.js:392`), `DeformableSteelStructure` (`[LOCKED]`, chỉ bật cho `lifting_beam`). | Chưa áp dụng uốn Euler–Bernoulli cho **mọi loại dầm** & chưa bẻ cong lưới 3D theo lực thật; "rơi tự do khi mất hết đường tải" chưa có test. |

## 1. Giả định đã chọn (founder không cần quyết)
1. **Một nguồn chân lý duy nhất** cho chia tải 4 chân: `RiggingPhysicsSolver.applyDNV4LegSkewRule`; HUD chỉ ĐỌC kết quả của solver (xóa tính toán trùng, theo luật DRY §2.8).
2. Công thức mới là **hàm thuần** trong file mới, **không import DOM/Three.js**, đơn vị SI, có Golden Test.
3. File `[LOCKED]` (`standards/*`, `DeformableSteelStructure.js`, `PhysicalCableSolver.js`, `firestore.rules`) **KHÔNG sửa**. Cần thêm dữ liệu cho chúng thì tạo file module mới bao ngoài (wrapper). Nếu bắt buộc phải sửa file khóa → DỪNG xin "ĐỒNG Ý".
4. File cũ phình (`beams_seed.js` 2987 dòng, `cables_break.js` 1555, `hoist_contacts.js` 1110, `telemetry.js` 1121): **chỉ chèn ≤ 25 dòng gọi hàm**; logic mới viết ở module riêng `< 250 dòng`, có `@purpose`.
5. Hiệu năng: gizmo/mũi tên dựng 1 lần, chỉ cập nhật thuộc tính; mặc định tắt trên `QUALITY_TIERS.performance`; mục tiêu 60 FPS (tablet DPR ≤ 1.5 giữ nguyên).
6. Tương thích ngược: không đổi cấu trúc `state.gear.*`/Firestore; trường mới đều tùy chọn có mặc định.

## 2. Rủi ro
- **R1 (cao):** Đổi chia tải 4 chân làm các test cũ (`pretension_nhom_cap`, `rigging_physics_and_alarms`, `standards_compliance_engine`) đỏ → chỉ cập nhật test khi kết quả mới ĐÚNG chuẩn DNV, ghi lý do vào HISTORY.
- **R2 (cao):** CCD + convex hull tốn CPU → dùng broad-phase AABB trước, hull chỉ cho cặp gần nhau; kiểm `test/architecture/performance_budget.test.js`.
- **R3 (TB):** Whip làm cáp bắn ra ngoài/NaN → kẹp vận tốc, kiểm `Number.isFinite` mọi nút.
- **R4 (TB):** Gizmo che nhãn 3D khác → lớp `renderOrder` riêng, `depthTest:false`, tắt được.
- **R5:** `ReplayRecorder` (Ghi/Xem 60s) phải ghi được trạng thái mới (hệ số SKL, đầu cáp whip) — kiểm ở Bước 10.

## 3. File CẤM đụng
`src/core/standards/*`, `src/core/DeformableSteelStructure.js`, `src/core/PhysicalCableSolver.js`, `src/core/CraneLoadChartEngine.js`, `src/core/GroundPressureEngine.js`, `src/core/physics-world/*`, `src/sim/manifest.js` (thứ tự nạp; chỉ thêm khi bắt buộc và phải qua `architecture:gate`), `src/utils/firestoreSanitize.js`, `src/utils/localDataStore.js`, `firestore.rules`.

---

## CÁC BƯỚC THỰC HIỆN TUẦN TỰ (mỗi bước ≤ 3 file sửa/tạo; xong bước: `npx vitest run` + `npm run architecture:gate` + `./scripts/auto_check.ps1` xanh → tick `[x]` → `git commit -m "step N: ..."` → làm tiếp)

### [x] Bước 1: Hợp nhất mô hình chia tải DNV 4 điểm (Pillar 1.1 — nền móng)
- **Tạo:** `src/rigging/DnvFourPointLift.js` (<220 dòng, hàm thuần): `resolveFourLegDiagonalLoad({ totalLoadT, cogOffsetXZ, legLengthsM, toleranceFrac, stretchStrainPerT, skl })` → trả `{ activeDiagonal:[i,j], passiveDiagonal:[k,l], tensionsT[4], sklUsed, reasons }`. Quy tắc: chọn đường chéo gần CoG hơn; 2 chân chéo gánh 100% (theo hệ số CoG) × SKL ∈ [1.25, 1.50]; SKL tự tăng theo dung sai chiều dài + giãn cáp (không dùng 1/4).
- **Sửa (≤25 dòng):** `src/rigging/RiggingPhysicsSolver.js` (thay thân `applyDNV4LegSkewRule` bằng gọi hàm mới, giữ chữ ký cũ để không vỡ test), `src/rigging/index.js` (export).
- **Kiểm tra:** `npx vitest run test/rigging_physics_and_alarms.test.js test/standards_compliance_engine.test.js`.

### [x] Bước 2: Golden Test Pillar 1.1 + đồng bộ HUD
- **Tạo:** `test/dnv_four_point_lift.test.js` — bộ số mẫu ghi vào `auto_kit/test.md`: (a) cargo 20 t, 4 chân cân đối, CoG giữa, SKL=1.25 → 2 chân chéo mỗi chân = 20×0.5×1.25 = **12.5 t**, 2 chân kia = 0; (b) CoG lệch về góc LP1 → chéo (LP1,LP3) được chọn; (c) SKL kẹp [1.25, 1.50]; (d) có dầm cân bằng (equalizer) → chia đều (không áp luật).
- **Sửa (≤25 dòng):** `src/sim/telemetry.js` (dòng ~912: HUD đọc `phy.rigging.dnvShares` thay vì tự gọi `evaluateFourLegIndeterminacy`; giữ hàm cũ làm fallback), `auto_kit/test.md` (thêm Golden Test).
- **Kiểm tra:** `npx vitest run test/dnv_four_point_lift.test.js test/phase1_core_safety.test.js`.

### [x] Bước 3: Ứng suất cục bộ phụ kiện — Bow vs Pin (Pillar 1.2)
- **Tạo:** `src/core/LocalizedHardwareStress.js` (<230 dòng, thuần, SI, bọc ngoài file khóa `standards/hardware.js` bằng cách GỌI `computeShackleSideDerate`, không sửa nó): `evaluateShackleComponentLoad({ wllT, pinMm, jawMm, loadT, bearingOn: 'pin'|'bow', sideAngleDeg })` → `{ bowLimitT, pinShearLimitT, governing, utilizationPct, derateFactor }`. Pin: ứng suất cắt kép τ = F/(2·A_pin) so với giới hạn chảy cắt; Bow: derating ASME B30.26 (45° = 70%, 90° = 50%).
- **Sửa (≤25 dòng):** `src/core/index.js` (export), `src/sim/physics/cables_break.js` (tại nơi đã tính quá tải phụ kiện, gọi hàm mới để lấy `governing`/`utilizationPct`; không chèn logic dài).
- **Tạo test:** `test/localized_hardware_stress.test.js` (ví dụ: shackle 17 t, dây tựa chốt vs thân; góc 45°/90° → 70%/50%; ranh giới không NaN).
- **Kiểm tra:** `npx vitest run test/localized_hardware_stress.test.js test/rigging.test.js`.

### [x] Bước 4: Truy vết "dây tựa vào đâu" + hiển thị ứng suất phụ kiện
- **Tạo:** `src/rigging/HardwareBearingTracker.js` (<200 dòng, dùng vị trí điểm tiếp xúc cục bộ sling-end ↔ shackle: nếu điểm nằm trong vùng cung chốt ±`pinHalfSpan` → `'pin'`, ngược lại `'bow'`; cũng tính góc tải ngang so với mặt phẳng má).
- **Sửa (≤25 dòng):** `src/sim/physics/step_engine.js` (gắn `meta.bearingOn`, `meta.sideAngleDeg` cho mỗi nhánh), `src/sim/telemetry.js` (dòng nhãn LP/MN: hiển thị `Pin 72%`/`Bow 55%` + tô đỏ khi vượt).
- **Kiểm tra:** `npx vitest run test/rigging_alarms_and_tolerances.test.js test/localized_hardware_stress.test.js`.

### [x] Bước 5: Gizmo góc 3D tương tác (Pillar 2.1)
- **Tạo:** `src/graphics/SlingAngleGizmo.js` (<250 dòng, Three.js, không logic vật lý): khi hover/chọn dây → vẽ (a) đường ngang đứt nét, (b) đường đặc dọc vector dây, (c) quạt cung bán trong suốt giữa hai đường (xanh ≥ 45°, vàng 30–44°, đỏ < 30°), (d) nhãn số độ. Tái sử dụng mesh (không tạo object mới mỗi khung), `dispose()` khi tắt, ẩn ở `performance`.
- **Sửa (≤25 dòng):** `src/graphics/index.js` (export `createSlingAngleGizmo`), `src/sim/library/reconstruction_export.js` (khởi tạo 1 lần cạnh `createElevationRulerTool`, gọi `update` theo cáp đang hover/chọn).
- **Tạo test:** `test/sling_angle_gizmo.test.js` (màu theo ngưỡng 45°/30°, độ mở cung = góc thật, `visible=false` khi không chọn, không rò geometry).
- **Kiểm tra:** `npx vitest run test/sling_angle_gizmo.test.js test/graphics.test.js` + `npm run build`.

### [ ] Bước 6: Tooltip giải thích + mũi tên lực thời gian thực (Pillar 2.1 tooltip + 2.2)
- **Tạo:** `src/graphics/ForceVectorField.js` (<220 dòng): mũi tên từ **CoG** và từ từng **điểm nối** (hook, ma ní, tai cẩu), độ dài/độ dày ∝ √T hoặc T chuẩn hóa theo SWL, màu theo vùng an toàn; cập nhật `setLength/setDirection` tại chỗ.
- **Sửa (≤25 dòng):** `src/sim/telemetry.js` (nạp lực mỗi khung vào field + tooltip song ngữ `Horizontal Sling Angle (α)…` / `Góc ngang của dây (α)…` đi qua `window.SafeLift.i18n.L`), `src/i18n/sim_ui_phrases.js` (thêm cặp câu EN/VI).
- **Tạo test:** `test/force_vector_field.test.js` (độ dài tỉ lệ T, gốc tại CoG, tooltip có đủ 2 ngôn ngữ).
- **Kiểm tra:** `npx vitest run test/force_vector_field.test.js test/i18n_keys.test.js`.

### [ ] Bước 7: Va chạm tuyệt đối — Compound/Convex collider + CCD (Pillar 3)
- **Tạo:** `src/rigging/CompoundColliders.js` (<250 dòng, hàm thuần): dựng collider hợp từ OBB con cho Spreader/H-beam/lug/mép kiện (hull đơn giản 8–12 đỉnh cho dầm; OBB cho cargo), broad-phase AABB → narrow-phase SAT; trả `{ penetrationM, normal, point }`.
- **Sửa (≤25 dòng):** `src/rigging/CollisionMaterialSolver.js` (dùng collider hợp thay AABB trong `resolveSweptSphereObbCCD`; xích–xích: chồng bán kính mắt xích → đẩy trượt), `src/sim/physics/beams_seed.js` (chèn ≤25 dòng gọi `resolveCompoundContact` cạnh `depenetrateBeamFromCargo`).
- **Tạo test:** `test/compound_collider_zero_penetration.test.js` (thả dầm nặng lên nóc container → nghỉ với `penetration < 1 mm`, ma sát giữ không trượt trên mặt phẳng nghiêng nhỏ; hai đoạn xích cắt nhau → tách ra, không xuyên).
- **Kiểm tra:** `npx vitest run test/compound_collider_zero_penetration.test.js test/architecture/performance_budget.test.js`.

### [ ] Bước 8: XPBD theo vật liệu + hiệu ứng đứt "giật ngược" (Pillar 4)
- **Tạo:** `src/rigging/CableMaterialBehavior.js` (<220 dòng): bảng hành vi (độ cứng uốn cao/thấp, gió cản cho vải: lực kéo `½ρCdAv²` theo diện tích dải), + hàm `applySnapWhip(cable, tensionN, mblN)` đặt vận tốc hồi đàn hồi cho 2 đầu đứt (hướng ngược lực căng, độ lớn từ `computeElasticSnapRecoil`), 6–10 khung đầu giữ `whipPhase`, sau đó tắt dần bằng giảm chấn không khí rồi rơi theo `g`.
- **Sửa (≤25 dòng):** `src/rigging/CableDynamicsXPBD.js` (nhận profile mới: xích uốn≈0 gập góc sắc, cáp thép catenary rộng, vải chịu gió), `src/sim/physics/cables_break.js` (tại điểm xử lý `T ≥ MBL` gọi `applySnapWhip`; không đổi logic cũ khác).
- **Tạo test:** `test/cable_whip_recoil.test.js`: (a) tension ≥ MBL → `removeConstraint`; (b) 5 khung đầu đầu cáp di chuyển NGƯỢC chiều căng trước khi y giảm; (c) xích slack: góc gập nhỏ hơn cáp thép cùng chiều dài; (d) vải: lệch ngang do gió > 0, cáp thép ≈ 0; (e) không NaN.
- **Kiểm tra:** `npx vitest run test/cable_whip_recoil.test.js test/cable_dynamics_xpbd.test.js test/custom_slings.test.js`.

### [ ] Bước 9: Trọng lực thật — rơi tự do khi mất đường tải + mô-men phục hồi + dầm uốn (Pillar 5)
- **Tạo:** `src/rigging/LoadPathGravity.js` (<230 dòng): `computeLoadPathConnectivity(cables)` → nếu mọi đường tải từ hook → kiện/dầm/phụ kiện đều đứt, đánh dấu vật thể `freeFall=true` (gia tốc −9.81 m/s², giảm chấn nhỏ); `computeRestingTorque({ cogWorld, supportPolygon, mass })` cho kiện chạm đất mà CoG ngoài đa giác đỡ (τ = r × mg đập đầu cao xuống); `bendingDeflectionProfile(beam, loadN)` Euler–Bernoulli δ(x) để bẻ lưới 3D (bọc `DeformableSteelStructure` SẴN CÓ qua `CAE`, không sửa file khóa).
- **Sửa (≤25 dòng):** `src/sim/physics/beams_seed.js` (gọi connectivity + torque tại vòng lặp vật lý; mở rộng `canWarpBeam` từ `lifting_beam` sang mọi dầm có `memberBody`), `src/sim/physics/step_engine.js` (cờ `freeFall`).
- **Tạo test:** `test/load_path_gravity.test.js`: (a) cắt hết cáp → sau 1 s y cargo/spreader giảm ≈ ½·g·t² (±5%); (b) kiện treo nghiêng chạm đất, CoG ngoài đa giác → đầu cao hạ xuống đến nằm phẳng; (c) dầm 12 m, tải 30 t → độ võng giữa nhịp đúng công thức 5wL⁴/384EI (±5%).
- **Kiểm tra:** `npx vitest run test/load_path_gravity.test.js test/pretension_nhom_cap.test.js test/rigging_realism_sts_contact.test.js`.

### [ ] Bước 10: Ghi/Xem 60 s ghi đủ trạng thái mới + công tắc giao diện
- **Sửa (≤25 dòng mỗi file):** `src/rigging/ReplayRecorder.js` (lưu thêm `sklUsed`, `activeDiagonal`, `whipPhase` + vận tốc đầu cáp đứt, `freeFall`, độ võng dầm; phát lại khôi phục đủ), `index.html` + `src/sim/session/presets_events.js` (thêm công tắc *Hiện cung góc / Mũi tên lực / Ứng suất phụ kiện* trong menu Hiển Thị, mặc định **Gizmo = hover**, lưu qua `localDataStore`; từ điển EN/VI đầy đủ).
- **Tạo test (bổ sung vào file sẵn có):** thêm ca vào `test/v3_ruler_drag_hoist_sts_gear_regression.test.js` (ghi → đứt cáp → xem lại: đầu cáp giật ngược đúng khung hình).
- **Kiểm tra:** `npx vitest run test/v3_ruler_drag_hoist_sts_gear_regression.test.js test/i18n_keys.test.js`.

### [ ] Bước 11: Nghiệm thu cuối + ghi nhớ dự án
- Chạy toàn bộ: `npx vitest run`, `npm run architecture:gate`, `npm run build`, `npm run check:dist`, `npx playwright test e2e/saas-accessibility.spec.js --project=fhd-1080p` (giữ test song ngữ EN/VI xanh), `./scripts/auto_check.ps1`.
- Cập nhật `auto_memory/CONTEXT.md` (quyết định: nguồn chân lý DNV duy nhất; module mới), thêm Golden Test vào `auto_kit/test.md`, đặt `Trạng thái: DONE`, `./scripts/auto_log.ps1 -Type feat ...`.
- **KHÔNG tự `git push`/deploy** — chờ founder gõ "ĐỒNG Ý" (luật §1.4).

## 4. Tiêu chí hoàn thành (đối chiếu yêu cầu gốc)
1. Chân chéo: cargo 4 chân không có dầm cân bằng → đúng 2 chân chéo gánh 100% × SKL ∈ [1.25, 1.5], 2 chân kia = 0 (test Bước 1–2).
2. Phụ kiện: dây tựa chốt dùng giới hạn cắt chốt, tải bên thân ma ní áp 70%/50% (test Bước 3–4).
3. Hover/chọn dây ra cung góc xanh/vàng/đỏ + tooltip song ngữ; mũi tên lực gốc ở CoG và điểm nối tỉ lệ T (Bước 5–6).
4. Không xuyên: dầm thả lên container nghỉ < 1 mm xuyên; xích không xuyên nhau (Bước 7).
5. Đứt dây: đầu cáp giật ngược vài khung đầu rồi rơi; xích gập sắc, cáp thép võng rộng, vải lệch gió (Bước 8).
6. Mất đường tải → rơi theo g; kiện chạm đất CoG hụt đỡ → đập phẳng; dầm võng đúng Euler–Bernoulli (Bước 9).
7. Toàn bộ test hiện có + test mới xanh; `build`, `architecture:gate`, E2E song ngữ xanh; không file mới > 300 dòng; không đụng file `[LOCKED]`.
