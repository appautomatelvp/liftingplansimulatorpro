# KẾ HOẠCH THỰC HIỆN (PLAN.md)
Trạng thái: ACTIVE
Tính năng: Hạ/Hạ đất êm chính xác, Camera Góc xoay mượt khi đang nâng/hạ, Lashing hết tõe đáy, Chỉnh đồng thời nhiều thiết bị cùng loại, Kiện đứng thật trên/nghiêng lệch khỏi Đà gỗ 3D, SWL mặc định ≥ 12 MT giữ nguyên kích thước, Cây thước đo cao độ 3D + Điểm đỏ di chuột
Nhánh Git: feat/horizon-clouds

## Mục tiêu & Chẩn đoán Gốc
1. **Hạ / Hạ đất bị giật & không chính xác:** `finishSmoothSetDown()` đang gọi `resetToInitialPreLiftState()` nhảy cóc toàn bộ kiện về `0°`, còn `btnDown` / `advanceHook()` ép `applyLockedPose()` ngay khi vừa chạm `0.04m`. Cần hạ êm vận tốc về 0 tại đúng vị trí/góc tiếp xúc thực tế thay vì teleport.
2. **Camera Góc giật khi đang nâng/hạ:** `cycleCargoAngleShot()` đóng băng `cf.paused = true` và `camCinema` tĩnh ở tọa độ cũ suốt `0.65s`, hết tween mới nhảy theo kiện. Cần giữ bám live `worldTarget` mỗi khung hình trong khi xoay mượt `lockedOffset`.
3. **Đầu dưới dây Lashing bị tõe vẩy:** `tieLeg.rotation.x = Math.atan2(dz, -dy)` bị ngược dấu khi `dy < 0`, hất ngang vây cam ra ngoài. Cần dùng `Quaternion.setFromUnitVectors((0,1,0), vecInward)` ôm khít đáy kiện vào D-ring bên trong thành Flat Rack.
4. **Chọn nhiều thiết bị cùng loại vẫn bắt ấn Áp dụng:** `renderGearFields()` đang chia từng card `[item]` riêng lẻ và `Tăng đơ ΔL` chỉ ghi `primary.index`. Cần gom cùng `kind` khi multi-select để sửa 1 ô là tất cả nhánh đang chọn đổi đồng thời ngay.
5. **Kiện hàng đè xuyên qua khúc gỗ kê:** `supportY(x, z)` trả về `0` nên kiện lọt qua đà gỗ `0.20m`. Cần hàm `evaluateDunnageSupportSurface` và lưới điểm chạm dưới bụng kiện để gỗ đỡ thật kiện (và nghiêng tự nhiên nếu đặt lệch khỏi thanh kê).
6. **SWL cáp mặc định ≥ 12 MT (giữ nguyên kích thước):** `autoSizeGearForLoad()` tính `wllLeg = 6–8 t` cho tải 20–24 t. Cần kẹp sàn `Math.max(12, wllRaw)` cho `swlT` (và `mblT`), còn `diaMm` vẫn tính theo chuẩn kích thước cũ.
7. **Cây thước đo độ cao 3D + Điểm Đỏ di chuột:** Module `ElevationRulerTool.js` vẽ thước vạch chuẩn từ mặt đất `0.00 m` kèm 4 mốc (Hook, Spreader, Đỉnh kiện, Đáy kiện), công tắc Ẩn/Hiện trong Display, và Raycaster hiện điểm đỏ + đường gióng ngang khi rê chuột lên bất kỳ chi tiết 3D nào.

## File `[LOCKED]` CẤM ĐỤNG
- `src/sim/manifest.js`, `/src/core/physics-world/*`, `/src/core/standards/*`, `CraneLoadChartEngine.js`, `GroundPressureEngine.js`, `PhysicalCableSolver.js`, `DeformableSteelStructure.js`, `/firestore.rules`, shims, `firestoreSanitize.js`, `localDataStore.js`.

---

## CÁC BƯỚC THỰC HIỆN TUẦN TỰ

### [x] Bước 1: Lashing đáy ôm khít + SWL mặc định ≥ 12 MT + Chỉnh đồng thời nhiều thiết bị cùng chọn
- **File sửa (3 file):**
  1. `src/rigging/FlatRackLashingPhysics.js`: sửa hướng `tieLeg` bằng `setFromUnitVectors((0,1,0), (0, dy, dz))` từ mép đáy kiện gập gọn vào trong D-ring khung Flat Rack, bỏ hẳn vây cam tõe ngang ra ngoài.
  2. `src/sim/physics/cables_break.js` (`autoSizeGearForLoad`): đặt sàn mặc định `swlT = Math.max(12, wllRaw)` ở chế độ bình thường trong khi giữ nguyên công thức tính `diaMm` (không phình đường kính dây).
  3. `src/sim/gear/editor.js` (`renderGearFields`, `renderSlingInspector`): khi multi-select (`sel.length > 1`), gom các thiết bị cùng `kind` thành nhóm chỉnh đồng bộ truyền thẳng mảng `groupItems` (và `Tăng đơ ΔL` ghi cho mọi nhánh `leg` trong `sel`), đổi thông số là cập nhật đồng loạt ngay lập tức.
- **Kiểm tra:** `npx vitest run test/jobsite_lashing_follow_regression.test.js test/custom_slings.test.js` + `npm run architecture:gate` + `npm run build`.

### [ ] Bước 2: Hạ / Hạ đất êm chính xác & Camera Góc xoay mượt khi đang nâng/hạ
- **File sửa (3 file):**
  1. `src/sim/session/prelift_reset.js` (`finishSmoothSetDown`): khi hạ đất xong, dập tắt vận tốc êm tại chỗ dựa trên tiếp xúc thực tế thay vì gọi `resetToInitialPreLiftState()` giật kiện về `0°` và hất móc lên.
  2. `src/sim/physics/hoist_contacts.js` (`advanceHook`): làm mượt ngưỡng chạm đất (`< 0.018m`) và giảm tốc tời êm khi hạ/hạ đất, không giật snap `applyLockedPose()` giữa chừng.
  3. `src/sim/library/reconstruction_export.js` (`cycleCargoAngleShot`, `updateCameraFollowSystem`): bỏ đóng băng `cf.paused = true` khi chuyển góc; nội suy mượt vector góc `cf.targetAngleOffset` bám trực tiếp `worldTarget` đang di chuyển mỗi khung hình.
- **Kiểm tra:** `npx vitest run test/rigging.test.js` + `npm run architecture:gate` + `npm run build`.

### [ ] Bước 3: Vật lý tương tác 3D thật với Khúc gỗ kê (Đỡ kiện & Nghiêng tự nhiên khi lệch)
- **File sửa (3 file):**
  1. `src/graphics/JobsiteSiteVisuals.js`: đặt mặt tấm nền `sitePad` ngang mặt đất `y = 0.00 m` (khi `slopeDeg = 0`), lưu `siteProfile` chứa các thanh đà gỗ đỡ `beams[]`, và thêm hàm thuần `evaluateDunnageSupportSurface(x, z, dunnageGroup)`.
  2. `src/sim/scene.js`: nối `supportY(x, z)` và `supportNormal(x, z)` vào `GFX.evaluateDunnageSupportSurface` (chuyển tọa độ theo vị trí/góc đà kê thực).
  3. `src/sim/physics/beams_seed.js`: mở rộng `contactLocals()` thêm dãy điểm dò dọc đáy kiện tại nhịp đà kê để kiện đè thật lên mặt gỗ (không xuyên qua) và tự nghiêng nhẹ theo trọng lực nếu đặt lệch/hụt đầu khỏi thanh gỗ.
- **Kiểm tra:** `npx vitest run test/pretension_nhom_cap.test.js test/jobsite_lashing_follow_regression.test.js` + `npm run build`.

### [ ] Bước 4: Dựng Cây thước đo độ cao 3D + Điểm Đỏ di chuột & nút Bật/Tắt trong Display
- **File tạo/sửa (3 file):**
  1. Tạo `src/graphics/ElevationRulerTool.js` (`< 240` dòng, `@purpose:`): cột thước chia vạch từ `0.00 m` đến trên Hook, 4 chỉ dấu live (**Hook**, **Spreader**, **Đỉnh Kiện**, **Đáy Kiện**) kèm nhãn mét rõ nét, và Raycaster hiện **Điểm Đỏ** + đường gióng ngang khi rê chuột lên bất kỳ chi tiết 3D nào.
  2. `src/graphics/index.js`: export `ElevationRulerTool`.
  3. `index.html`: thêm tùy chọn ẩn/hiện cây thước (`#chk-disp-ruler` — `📏 Thước đo cao độ 3D`) trong popover Hiển thị.
- **Kiểm tra:** `npm run architecture:gate` + `npm run build`.

### [ ] Bước 5: Nối mạch Cây thước, sửa giật `btnDown` & Nghiệm thu toàn bộ + Golden Test
- **File sửa/tạo (3–4 file):**
  1. `src/sim/library/reconstruction_export.js`: cập nhật cây thước `ElevationRulerTool` trong `animate()` và xử lý hover chuột `pointermove`.
  2. `src/sim/session/presets_events.js`: gắn bật/tắt `#chk-disp-ruler`, hỗ trợ nút Tất cả/Ẩn hết, và bỏ ép `applyLockedPose()` giật khi giữ nút `Hạ` (`btnDown`).
  3. Tạo `test/v2_ux_dunnage_ruler_regression.test.js` (kiểm tra đủ 7 yêu cầu) + cập nhật `expectedCargoBaseY` động theo `sim.getSupportY(0, 0)` ở `test/pretension_nhom_cap.test.js` nếu gỗ kê nâng đáy kiện.
- **Kiểm tra cuối:** `npx vitest run`, `npm run architecture:gate`, `npm run build`, `npm run check:dist`, `./scripts/auto_check.ps1`, `./scripts/auto_log.ps1`.
