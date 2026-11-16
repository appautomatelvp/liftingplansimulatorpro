# KẾ HOẠCH THỰC HIỆN (PLAN.md)
Trạng thái: ACTIVE
Tính năng: Bỏ cục tời khi tắt cẩu 3D, Kéo vị trí Cây thước 3D & Điểm Đỏ bắt cả Cáp/Ma ní, Double-Click Hạ/Kéo (chạm đất trùng cáp / lên 10m), Mở khóa chỉnh Chiều dài & Thông số Cáp/Công cụ, Hết giật STS Spreader Gắp trực tiếp
Nhánh Git: feat/horizon-clouds

## Mục tiêu & Chẩn đoán Gốc (Đã kiểm chứng trong code)
1. **Cục tời hộp đen + 2 puly lơ lửng khi chưa bật cần cẩu 3D (`scene.js:781-803`):** Nhánh `craneType === 'hook_only'` dựng khối hộp `crownBeam` + 2 đĩa puly `upperSheave` tại `y = 24.0`. Cần giữ `sheaveCrownGroup` là một `THREE.Group()` rỗng (giữ tọa độ neo dây cáp tời `girderY`), bỏ toàn bộ lưới hộp đen và puly phía trên.
2. **Thước đo độ cao 3D chưa kéo đặt vị trí được & rà chuột vào Cáp/Ma ní không hiện Điểm Đỏ (`ElevationRulerTool.js` + `reconstruction_export.js:2100` + `editor.js:3165`):**
   - `update()` luôn ép `rulerGroup.position.set(rx, 0, rz)` mỗi khung hình, không có tay nắm kéo và chưa nối vào `getInteractiveGizmos()`.
   - `onRulerMove` chỉ truyền `[cargoRootGroup, spreaderRootGroup, craneVehicleGroup, dunnageGroup, hookGroup]` mà bỏ sót `sling3DPool`, `hwMeshes` (ma ní), `padEyeMeshes`, `phy.beamGroups`, lại chỉ dùng `raycaster.intersectObjects` nên rất hay hụt các sợi dây cáp mảnh.
3. **Double-click `Hạ` & `Kéo` (`presets_events.js:2350-2522`, `prelift_reset.js:59-160`, `hoist_contacts.js:183-346`):**
   - Chưa có listener `dblclick`; hơn nữa `pointerup` của lần bấm thứ 2 gọi `stopHoistHold()` ngay trước `dblclick`. Cần gắn `dblclick` kích hoạt sau `pointerup`: double-click `Hạ` hạ êm tới khi kiện nằm hẳn trên đất/đà gỗ **và toàn bộ cáp trùng**, double-click `Kéo` nâng êm tới độ cao `10.0 m`.
4. **Không chỉnh được chiều dài và thông số cáp / công cụ sau F5 (`beams_seed.js:214`, `editor.js:1767`, `ui_units_bom.js:1666`, `presets_events.js:2612`):**
   - `syncCableRest()` ưu tiên `held != null` (`heldCableL0`) đè lên `item.lengthM` (`customLength`). Khi chỉnh chiều dài ở bảng bên trái (`renderSlingInspector`) hoặc `inp-selectedL` nhưng `holdCableLength` đang bật, `heldCableL0` không bị xóa nên `c.L0` giữ nguyên giá trị cũ.
   - `handleTestLift()` (`Nhấc thử`) tự ý xóa sạch `rec.userSet = false; rec.lengthM = null` của mọi nhánh cáp.
   - Khi đang `poseLock`, chỉnh chiều dài cáp ở `renderSlingInspector` chưa gọi `syncHookToRigTaut()` / `applyBeamVisuals()` nên người dùng không thấy thay đổi tức thì.
5. **STS Spreader `Gắp trực tiếp` (`direct`) hạ bị giật cục (`beams_seed.js:2321, 2404, 2673`):**
   - Vòng lặp XPBD bỏ qua giải lực cáp ở nhánh STS Direct (`beams_seed.js:2404`) nhưng lại vẫn tích phân rơi tự do `vCom.y -= G_EARTH * dt` (`beams_seed.js:2321`) khiến kiện tụt tự do nhiều centimet mỗi frame, rồi cuối frame `enforceStsDirectTwistlockCouple` mới kẹp kéo giật ngược trở lại khớp ngáng STS — tạo dao động răng cưa "giật cục" liên tục khi Hạ.

## File `[LOCKED]` CẤM ĐỤNG
- `src/sim/manifest.js`, `/src/core/physics-world/*`, `/src/core/standards/*`, `CraneLoadChartEngine.js`, `GroundPressureEngine.js`, `PhysicalCableSolver.js`, `DeformableSteelStructure.js`, `/firestore.rules`, shims, `firestoreSanitize.js`, `localDataStore.js`.

---

## CÁC BƯỚC THỰC HIỆN TUẦN TỰ

### [x] Bước 1: Bỏ cục tời lơ lửng khi tắt cẩu 3D + Sửa triệt để giật cục khi Hạ STS Spreader `Gắp trực tiếp`
- **File sửa (3 file):**
  1. `src/sim/scene.js`: trong nhánh `type === 'hook_only'`, giữ `sheaveCrownGroup` là `THREE.Group()` rỗng tại `y = crownY = 24.0` (để dây cáp tời vẫn kéo thẳng lên đúng đỉnh), bỏ `crownBeam` và 2 bánh `upperSheave`.
  2. `src/sim/physics/beams_seed.js`: khi `state.beamType === 'container_spreader' && isStsDirectAttach() && cargoHasIntactLoadLegs()`, bỏ bước rơi tự do `vCom.y -= G_EARTH * dt` trong vòng lặp XPBD (để không tụt hụt rồi bị giật ngược bởi `enforceStsDirectTwistlockCouple`), tính `prevCargoY` nhất quán trước khi bước theo `stepRateLimitedY`, triệt tiêu dao động răng cưa khi Hạ.
  3. `src/sim/physics/hoist_contacts.js`: khi đang `holdLower` / `_setDownActive` ở STS Direct, bám `hookTarget.y` và `kinTarget.y` mượt theo vận tốc tời `rates.down`, tránh xung đột dừng/kéo với `kinHold`.
- **Kiểm tra:** `npx vitest run test/unified_hoist_and_sts_realism.test.js test/sts_spreader_realistic.test.js` + `npm run architecture:gate` + `npm run build`.

### [x] Bước 2: Mở khóa chỉnh tự do chiều dài & thông số cáp/công cụ sau F5
- **File sửa (3 file):**
  1. `src/sim/physics/beams_seed.js` (`syncCableRest`): đảm bảo `customLength` (do người dùng chủ động chỉnh tay `item.userSet && item.lengthM != null`) luôn được tôn trọng khi `item.userSet` mới cập nhật, không để `heldCableL0` cũ khóa chết.
  2. `src/sim/gear/editor.js`: trong `renderSlingInspector` & `commitGearField`, mọi thao tác sửa chiều dài (`lenRow`) phải cập nhật/xóa `state.heldCableL0[role][index]` tương ứng, gọi `syncCableRest(false)` + `applyBeamVisuals()` + cập nhật móc nếu cần; giữ trạng thái chỉnh thông số cáp/ma ní/dầm ổn định không tự reset về mặc định ngoài ý muốn.
  3. `src/sim/session/ui_units_bom.js`: sửa `onSelectedChange` (đồng bộ xóa `state.heldCableL0[sel.role][sel.index]`, hỗ trợ đồng thời nhóm nhiều cáp đang chọn) và đảm bảo các ô chỉnh chiều dài/thông số trong bảng cáp ghi thẳng xuống `state.gear` & `phy.cables`.
- **Kiểm tra:** `npx vitest run test/custom_slings.test.js test/v2_ux_dunnage_ruler_regression.test.js` + `npm run architecture:gate` + `npm run build`.

### [x] Bước 3: Nâng cấp Cây thước đo độ cao 3D — Cho phép kéo đặt vị trí tùy ý & Bắt Điểm Đỏ cả dây cáp lẫn ma ní
- **File tạo/sửa (3 file):**
  1. Tạo `src/graphics/ElevationRulerMath.js` (`< 120` dòng, `@purpose:`): hàm thuần bắt điểm 3D kết hợp Raycaster khối lớn + khoảng cách tia chuột tới từng đoạn dây cáp/xích và cụm ma ní/pad-eye (`segmentDistSq <= threshold^2`) để rê chuột vào bất kỳ đâu từ Hook đến Đáy kiện đều bắt chuẩn xác.
  2. `src/graphics/ElevationRulerTool.js` (`< 285` dòng): bổ sung tay nắm đế thước 3D (`userData.dragType = 'ruler'`), giữ vị trí người dùng đặt tay (`setCustomPosition(x, z)`, `clearCustomPosition()`), và nâng cấp `updateHover` dùng `ElevationRulerMath` bắt đủ Hook, Spreader, Dây cáp/Xích, Ma ní, Pad-eye, Kiện hàng, Đà gỗ.
  3. `src/graphics/index.js`: export `ElevationRulerMath`.
- **Kiểm tra:** `npx vitest run test/v2_ux_dunnage_ruler_regression.test.js` + `npm run architecture:gate` + `npm run build`.

### [x] Bước 4: Double-Click `Hạ` (chạm hẳn đất & toàn bộ cáp trùng) + Double-Click `Kéo` (lên đúng `10.0 m`) + giữ chiều dài khi bấm `Nhấc thử`
- **File sửa (3 file):**
  1. `src/sim/session/prelift_reset.js`: thêm/nâng cấp `beginSmoothSetDown()` + `finishSmoothSetDown()` để khi chạm mặt đất/đà gỗ tự xả trùng toàn bộ các nhánh cáp treo (`c.slack = true`, `c.tensionT = 0`), và thêm `beginAutoHoistToClearance(10.0)` để tự động nâng êm tới độ cao `10.0 m`.
  2. `src/sim/physics/hoist_contacts.js`: cập nhật `advanceHook(dt)` hỗ trợ đích độ cao tự động `_autoTargetClearanceM` (cho lệnh `Kéo` double-click tới `10.0 m`) và hạ thả chùng dây trọn vẹn cho `_setDownActive` trước khi khóa `finishSmoothSetDown()`.
  3. `src/sim/session/presets_events.js`: gắn `dblclick` lên `#btn-hoist-down` (gọi auto hạ đất trùng cáp) và `#btn-hoist-up` (gọi auto nâng tới `10.0 m`) tách bạch khỏi `stopHoistHold()`; đồng thời bỏ đoạn xóa `rec.userSet`/`rec.lengthM` trong `handleTestLift()` để độ dài người dùng vừa chỉnh không bị mất khi bấm `Nhấc thử`.
- **Kiểm tra:** `npx vitest run test/rigging.test.js test/unified_hoist_and_sts_realism.test.js` + `npm run architecture:gate` + `npm run build`.

### [x] Bước 5: Nối mạch kéo Thước 3D + Bắt Điểm Đỏ đủ Cáp/Ma ní trên Scene & Viết kiểm thử nghiệm thu
- **File sửa/tạo (3 file):**
  1. `src/sim/gear/editor.js`: cho phép nắm kéo tay cầm `'ruler'` của Cây thước 3D trên mặt sàn XZ mượt mà (`controls.enabled = false` khi đang kéo, trả lại khi nhả chuột).
  2. `src/sim/library/reconstruction_export.js`: truyền đầy đủ `targets` và `segmentSources` (`hookGroup`, `spreaderRootGroup`, `phy.beamGroups`, `sling3DPool`, `hwMeshes`, `padEyeMeshes`, `cargoRootGroup`, `dunnageGroup`) vào `phy._elevationRuler.updateHover` + truyền danh sách mesh kéo của thước nếu cần.
  3. Tạo `test/v3_ruler_drag_hoist_sts_gear_regression.test.js` kiểm chứng cả 6 yêu cầu + chạy trọn bộ: `npx vitest run`, `npm run architecture:gate`, `npm run build`, `npm run check:dist`, `./scripts/auto_check.ps1`, `./scripts/auto_log.ps1`.

### [ ] Bước 6: Nâng cấp `Ghi / Xem / Dừng` ghi & phát lại TOÀN BỘ trạng thái mô phỏng
- **File tạo/sửa (3 file):**
  1. Tạo `src/sim/library/ReplayRecorder.js` (`< 240` dòng, `@purpose:`): bộ ghi & phát lại toàn trạng thái (Hook + Dầm/Ngáng `beams[]` + Kiện + Từng sợi cáp `L0/tensionT/slack/broken/break tips` + Góc quay cẩu `craneAngleDeg` + Khóa `poseLock` & `groundClearance`), lưu snapshot ban đầu khi bấm `Ghi`, khôi phục sạch khi `Dừng`.
  2. `src/sim/library/reconstruction_export.js`: ủy quyền `pushReplaySample()` và `stepReplay()` sang `ReplayRecorder` (`<= 18` dòng).
  3. `src/sim/session/presets_events.js` & `test/v3_ruler_drag_hoist_sts_gear_regression.test.js`: nối nút `Ghi`/`Xem`/`Dừng` với ReplayRecorder và bổ sung kiểm thử hồi quy cho toàn bộ, rồi chạy kiểm tra toàn bộ dự án (`npx vitest run`, `npm run architecture:gate`, `npm run build`, `npm run check:dist`, `./scripts/auto_check.ps1`, `./scripts/auto_log.ps1`).
