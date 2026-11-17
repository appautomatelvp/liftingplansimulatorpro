# KẾ HOẠCH THỰC HIỆN (PLAN.md)
Trạng thái: DONE
Tính năng: UI/UX OPTIMIZATION & PBR MATERIAL UPGRADE — Sửa kéo thả CoG 3D, Dời Thước đo độ cao & Viewport gọn sạch, Angle Gizmo Always-On, 4 Quick Toggles trên Taskbar, Vật liệu PBR công nghiệp chống nhựa (hao mòn, rỉ sét cạnh, dầu mỡ cáp)
Nhánh Git: feat/horizon-clouds (backup: `_BACKUPS_LOCAL\LIFTING PLAN SIMULATOR PRO-090417112026 (test - ui-ux-pbr-cog).zip`)
Người lập kế hoạch: Model cao nhất (KHÔNG viết code ở bước này). Gõ `làm tiếp` 1 lần để chạy một mạch Bước 1 → 5.

## 0. KẾT QUẢ KHÁM CODE (NGUYÊN NHÂN GỐC RỄ)
1. **Lỗi kéo thả CoG (`hook_pool.js:318-343`, `editor.js:3373-3519`):**
   - `cogIndicatorGroup` chỉ gắn `dragType: 'cog'` vào quả cầu nhỏ `r=0.18m` nằm khuất bên trong thùng container; vòng đỏ `cogRing` không bắt chuột và chưa có tay cầm 3 trục X/Y/Z.
   - `onPointerDown` ở nhánh `'cog'` không chặn sự kiện lan (`e.preventDefault(); e.stopPropagation()`), dùng `window.innerWidth` lệch khung canvas nếu có viền, và `onPointerMove` gọi `rebuildCargoAndRig(false)` ở **mỗi khung hình**, phá hủy rồi dựng lại `cogIndicatorGroup` ngay trong lúc đang kéo!
2. **Thước đo độ cao & Hiển thị mặc định (`ElevationRulerTool.js:238`, `state.js:118`, `reconstruction_export.js:2108`):**
   - Offset thước `+1.55m` ngoài `halfL` vẫn bị chồng nhãn `Probe`/`Spreader` lên cạnh phải container 40ft.
   - `showSlingAngleGizmo` đang chỉ hiện khi hover (`_hoverSlingCableIdx >= 0`) chứ chưa mặc định `'always'`.
3. **Taskbar dưới (`index.html:430`):** Khoảng trống hàng trên bên phải nhóm `REC | Xem | Dừng` đủ chỗ đặt 4 nút bật/tắt nhanh: `[Góc]` `[Lực]` `[Thước]` `[CoG]`.
4. **Vật liệu PBR (`PBRMaterialFactory.js`, `StressPBRMaterials.js`, `scene.js`, `EnvironmentManager.js`):**
   - Container & thép (`MATS.containerBlue`, `yellowHazard`, `trafoGrey`, `wireRope`, `chainDark`) đang dùng `MeshPhysicalMaterial` trơn `roughness ~0.22-0.38` thiếu `roughnessMap` bụi/xước + thiếu `bumpMap`/`normalMap` tôn sóng & rỉ cạnh.

## 1. Giả định đã chọn
1. Giữ nguyên luật kích thước file `<250` dòng cho module mới (có `@purpose`), file cũ phình (`editor.js`, `hook_pool.js`, `presets_events.js`, `scene.js`) chỉ chèn `≤25` dòng gọi hàm.
2. Không sửa file `[LOCKED]` (`standards/*`, `physics-world/*`, `manifest.js`, `firestoreSanitize.js`, `localDataStore.js`).
3. Mọi nhãn nút mới đều song ngữ EN/VI (`src/i18n/sim_ui_phrases.js`) để Playwright `e2e/saas-accessibility.spec.js` luôn xanh.

## 2. File CẤM đụng
`src/core/standards/*`, `src/core/DeformableSteelStructure.js`, `src/core/PhysicalCableSolver.js`, `src/core/CraneLoadChartEngine.js`, `src/core/GroundPressureEngine.js`, `src/core/physics-world/*`, `src/sim/manifest.js`, `src/utils/firestoreSanitize.js`, `src/utils/localDataStore.js`, `firestore.rules`.

---

## CÁC BƯỚC THỰC HIỆN TUẦN TỰ (mỗi bước xong: `vitest` + `architecture:gate` + `auto_check.ps1` → tick `[x]` → `git commit` → làm tiếp)

### [x] Bước 1: Sửa triệt để lỗi kéo thả Gizmo CoG 3D (Phần 3)
- **Tạo:** `src/graphics/CoGGizmoHelper.js` (<180 dòng):
  - Dựng tay cầm 3 trục X (đỏ) / Y (xanh lá) / Z (xanh dương) thò ra ngoài tâm + khối hit vô hình (`r=0.42m`), toàn bộ gắn `depthTest:false`, `renderOrder:999` và `userData: { dragType: 'cog', cogAxis: 'x'|'y'|'z'|'free' }`.
  - Hàm thuần `applyCogDragDelta({ ray, dragPlane, axis, startPoint, cargoRootGroup, state })`: tính tọa độ cục bộ mới có kẹp biên an toàn `[-0.45*L/H/W, +0.45*L/H/W]` theo trục đang kéo (nếu `'x'|'y'|'z'` chỉ cho trượt theo 1 trục; `'free'` trượt mặt phẳng camera).
- **Sửa (≤25 dòng/file):**
  - `src/graphics/index.js` (export `CoGGizmoHelper.js`).
  - `src/sim/rigging/hook_pool.js` (~dòng 320): gắn tay cầm 3 trục CoG từ `GFX.createCoGAxisHandles` vào `cogIndicatorGroup`.
  - `src/sim/gear/editor.js` (~dòng 3250, 3373, 3511, 3590): chặn `e.preventDefault(); e.stopPropagation();` + `setPointerCapture` khi bắt trúng CoG (`controls.enabled = false`); trong `onPointerMove`, cập nhật `state.cogX/Y/Z`, dời `cogIndicatorGroup.position` & gọi `syncCoGSlidersFromState()` trực tiếp **không gọi** `rebuildCargoAndRig` liên tục mỗi frame (chỉ gọi 1 lần khi `onPointerUp` hoặc đổi nhẹ!).
- **Tạo test:** `test/cog_gizmo_drag.test.js` kiểm tra kéo CoG theo trục X/Y/Z và tự do cập nhật đúng `state.cogX/Y/Z` & kẹp giới hạn biên cargo.
- **Kiểm tra:** `npx vitest run test/cog_gizmo_drag.test.js test/v3_ruler_drag_hoist_sts_gear_regression.test.js` + `npm run architecture:gate`.

### [x] Bước 2: Dời Thước đo xa kiện, Viewport sạch mặc định & Angle Gizmo Always-On (Phần 1)
- **Sửa (≤25 dòng/file):**
  - `src/graphics/ElevationRulerTool.js` (~dòng 236): thêm tham số `offsetX` (mặc định `3.4` m ngoài `halfL` + margin rìa) và `offsetZ` (`-halfW - 0.85` m) + hỗ trợ `setDefaultOffset(x, z)` để thước luôn nằm thoáng hẳn bên rìa phải ngoài bounding box kiện hàng.
  - `src/sim/state.js` (~dòng 118): cấu hình mặc định gọn sạch (`showRuler: true`, `showSlingAngleGizmo: 'always'`, `showCoG: true`, `showGroundAngle: true`, `showHUD: true`, các label phụ `showForces`, `showSlingAngles`, `showShackleLoads`, `showSlingLengths`, `showVectors` đều `false`).
  - `src/sim/library/reconstruction_export.js` (~dòng 2108): khi `showSlingAngleGizmo !== 'off'` (mặc định `'always'`), nếu không hover sợi nào thì tự chọn nhánh cáp đại diện (nhánh đang căng có góc nhỏ nhất hoặc nhánh `0`) để quạt cung góc 3D luôn hiển thị rõ ngay khi mở app.
  - `src/sim/session/presets_events.js` (~dòng 2827): đồng bộ checkbox `chk-disp-angle-gizmo` theo `dOpt.showSlingAngleGizmo !== 'off'`.
- **Kiểm tra:** `npx vitest run test/sling_angle_gizmo.test.js test/v2_ux_dunnage_ruler_regression.test.js test/v3_ruler_drag_hoist_sts_gear_regression.test.js` + `npm run architecture:gate`.

### [x] Bước 3: Bổ sung 4 Quick Toggles lên thanh Taskbar dưới (Phần 2)
- **Sửa (≤25 dòng/file):**
  - `index.html` (~dòng 430): chèn nhóm 4 nút gọn ngay cạnh `REC | Xem | Dừng` ở hàng trên bên phải của thanh taskbar: `btn-qt-angle` (Góc), `btn-qt-tension` (Lực căng), `btn-qt-ruler` (Thước), `btn-qt-cog` (CoG).
  - `src/sim/session/presets_events.js` (~dòng 2827 & 3020): gắn sự kiện click cho 4 nút (đồng bộ hai chiều với `state.displayOptions` & cập nhật trạng thái sáng/tắt của nút ngay trong `syncDisplayOptionsUI()`).
  - `src/i18n/sim_ui_phrases.js`: thêm cặp EN/VI cho 4 nút quick toggles (`Góc` / `Angle`, `Lực căng` / `Tension`, `Thước` / `Ruler`, `CoG` / `CoG`).
- **Tạo / cập nhật test:** thêm kiểm chứng 4 Quick Toggles trong `test/cog_gizmo_drag.test.js` + chạy `test/i18n_keys.test.js`.
- **Kiểm tra:** `npx vitest run test/cog_gizmo_drag.test.js test/i18n_keys.test.js` + `npm run architecture:gate`.

### [x] Bước 4: Nâng cấp vật liệu PBR hao mòn công nghiệp & HDRI bãi cảng (Phần 4)
- **Tạo:** `src/graphics/pbr/IndustrialWearPBR.js` (<220 dòng):
  - `drawCorrugatedContainerMaps(size = 512, paintHex)`: sinh map màu sơn công nghiệp có vết trầy cạnh / rỉ sét nhẹ (`Edge Wear & Rust`), `normalMap` gân sóng container + bề mặt thép gồ ghề, và grunge `roughnessMap` (`0.42–0.85` không bóng nhựa).
  - `drawGreasedWireRopeMaps(size = 512)` & `drawForgedChainMaps(size = 256)`: cáp thép màu xám sẫm/đen dầu mỡ công nghiệp, roughness cao hơn (`0.46–0.58`); xích hợp kim kim loại cao (`metalness: 0.90`) nhưng bề mặt nhám lì rèn nóng (`roughness: 0.44`).
- **Sửa (≤25 dòng/file):**
  - `src/graphics/PBRMaterialFactory.js`: thêm `createIndustrialCargoMaterial(key, hex)` dùng `IndustrialWearPBR`, nâng roughness & dầu mỡ tối cho `createWireRopeMaterial()` và `createChainAlloyMaterial()`.
  - `src/sim/scene.js` (~dòng 34–89): áp dụng `createIndustrialCargoMaterial` cho `MATS.containerBlue`, `boxMaroon`, `boxGreen`, `reeferWhite`, `yellowHazard`, `orangeBeam`, `trafoGrey` (giữ cache không làm chậm frame).
  - `src/graphics/EnvironmentManager.js`: tinh chỉnh `generateProceduralSkyHDR` & ánh sáng nền công nghiệp tạo phản chiếu PMREM chân thực kiểu bãi cảng/nhà xưởng lên bề mặt kim loại.
- **Tạo test:** `test/industrial_pbr_materials.test.js` kiểm tra mọi vật liệu có `MeshStandardMaterial`/`MeshPhysicalMaterial`, `roughnessMap`, `normalMap`, `wireRope` tối dầu & `chainDark` metalness cao + nhám.
- **Kiểm tra:** `npx vitest run test/industrial_pbr_materials.test.js test/graphics.test.js` + `npm run architecture:gate` + `npm run build`.

### [x] Bước 5: Kiểm thử toàn diện & Nghiệm thu cuối
- Chạy: `npx vitest run`, `npm run architecture:gate`, `npm run build`, `npm run check:dist`, `npx playwright test e2e/saas-accessibility.spec.js --project=fhd-1080p`, `./scripts/auto_check.ps1`.
- Cập nhật `auto_memory/CONTEXT.md`, `STATE.md`, đặt `Trạng thái: DONE` trong `PLAN.md`, chạy `./scripts/auto_log.ps1 -Type feat ...`.
- **KHÔNG tự `git push`/deploy** — chỉ commit sạch tại chỗ và báo Founder tự kiểm tra trước khi cho phép đẩy GitHub.
