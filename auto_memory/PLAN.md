# KẾ HOẠCH THỰC HIỆN (PLAN.md)
Trạng thái: ACTIVE
Tính năng: Đồng bộ 3D Tab 6 (Đà gỗ / Địa chất-Độ dốc / Tấm lót chân chống), Dây chằng Flat Rack ôm sát & đứt tự nhiên, Camera Follow (đổi tên từ Auto, bỏ tự zoom-in)
Nhánh Git: feat/horizon-clouds

## Mục tiêu & Giả định
1. **Tab 6 Công trường -> Hình khối 3D thật:**
   - Khi đổi *Đà Gỗ Phẳng / Đà Nền Đất / Đà Lệch Bậc*, *Số Thanh Kê (2/3/4/Grid Mat)*, *Tiết Diện (150..300mm)*, *Loại Gỗ/Thép*, *Chiều Dài Thanh Đà*, *Nền Đất Hạ Kiện & Độ Dốc (°)*, và *Tấm Lót Chân Chống (Mat)* → hình khối 3D trên sân khấu thay đổi tức thì, nhìn rõ sự khác biệt.
2. **Dây chằng Flat Rack ôm sát & đứt tự nhiên:**
   - Sửa lỗi dây chằng + móc kéo ngang bên dưới bị lòi ra ngoài không trung ở `addDeckOogCargoOverlay`; buộc neo gọn bên trong/mép dầm Flat Rack và ôm khít kiện hàng OOG.
   - Khi quá tải hoặc nghiêng vượt ngưỡng: từng sợi dây đứt tuần tự theo phân bố lực nghiêng thực tế + sai lệch ngẫu nhiên có kiểm soát (`relStrength`), tóe lửa đúng sợi đang đứt và 2 đầu dây văng/rủ tự nhiên, đồng thời vẫn giữ nguyên hợp đồng dữ liệu `phy.oogState.lashing` để toàn bộ Golden Test không gãy.
3. **Camera Auto -> Follow (không tự zoom-in):**
   - Đổi tên nút & nhãn `Auto` thành `Follow`.
   - Khi bật `Follow`, camera giữ nguyên góc nhìn & khoảng zoom hiện tại của người dùng và tịnh tiến bám theo kiện hàng di chuyển (`worldTarget`), tuyệt đối không tự ép zoom-in (`wantDist`) hay giật góc.

## Rủi ro & File CẤM đụng
- `[LOCKED]` CẤM sửa: `src/sim/manifest.js`, `/src/core/physics-world/*`, `/src/core/standards/*`, `CraneLoadChartEngine.js`, `GroundPressureEngine.js`, `PhysicalCableSolver.js`, `DeformableSteelStructure.js`, `/firestore.rules`, shims, `firestoreSanitize.js`, `localDataStore.js`.
- Các file `⚠️>300` (`containers_iso.js`, `scene.js`, `presets_events.js`, `telemetry.js`, `flatrack_payload.js`, `reconstruction_export.js`, `index.html`) chỉ gọi hàm gọn `<= 25` dòng; toàn bộ logic dựng hình/vật lý mới đặt trong 2 module `< 240` dòng có `@purpose:` ở dòng đầu.

---

## CÁC BƯỚC THỰC HIỆN TUẦN TỰ

### [x] Bước 1: Dựng module 3D Sàn Kê Đà Gỗ, Đệm Độ Dốc & Tấm Lót Chân Chống
- **File tạo/sửa (3 file):**
  1. Tạo `src/graphics/JobsiteSiteVisuals.js` (`< 240` dòng, `@purpose:`):
     - `readJobsiteVisualConfig(state)`: đọc `#sel-dunnage-qty`, `#sel-dunnage-section`, `#sel-dunnage-wood`, `#inp-dunnage-length`, `#sel-cargo-soil`, `#rng-ground-slope`, `#sel-crane-mat`, `state.groundId`.
     - `rebuildDunnageVisual3D({ THREE, dunnageGroup, state, MATS })`: dựng 2/3/4 thanh đà hoặc Grid Mat chữ thập 2 tầng đúng tiết diện `B×H`, chiều dài, chất liệu (`hardwood`, `softwood`, `steel_beam`), hiệu ứng preset (`flat` ngang, `soil` lún nền đất đệm, `rough` giật cấp lệch cao độ) + thảm nền địa chất nghiêng theo `slopeDeg` (`0..5°`). Bật `dunnageGroup.visible = true`.
     - `syncCraneOutriggerMats3D({ THREE, craneVehicleGroup, presetId, MATS })`: đổi hình dạng 4 tấm lót dưới chân chống cẩu theo `dish_only` (ẩn tấm, giữ đĩa tròn), `timber_small` (1.2×1.2m), `timber_medium` (1.6×1.6m), `steel_mat_2x2` (2.0×2.0m), `steel_mat_2_4x3` (2.4×3.0m).
  2. Sửa `src/graphics/index.js`: export `JobsiteSiteVisuals`.
  3. Sửa `src/sim/cargo/containers_iso.js` (`<= 12` dòng thay đổi): gọi `GFX.rebuildDunnageVisual3D(...)` trong `rebuildDunnageBlocks()`.
- **Kiểm tra:** `npm run architecture:gate` + `npm run build` + `./scripts/auto_check.ps1`.

### [x] Bước 2: Nối sự kiện Tab 6 Công trường & Xe cẩu với 3D
- **File sửa (3 file):**
  1. `src/sim/scene.js` (`<= 18` dòng thay đổi): gắn `userData.isOutriggerMatAnchor` cho 4 chân chống trong `buildCraneVehicle()`, gọi `GFX.syncCraneOutriggerMats3D(...)` và gọi `GFX.rebuildDunnageVisual3D(...)` trong `buildEnvironment()` (bỏ ẩn `dunnageGroup` ở chế độ `rough`).
  2. `src/sim/session/presets_events.js` (`<= 18` dòng thay đổi): gọi `rebuildDunnageBlocks()` trong `updateSiteEngineeringCalculations()` và khi click `#ground-store .card-btn` để đổi đà gỗ/địa chất/độ dốc là 3D đổi ngay.
  3. `src/sim/telemetry.js` (`<= 15` dòng thay đổi): khi `#sel-crane-mat` đổi giá trị thì gọi `GFX.syncCraneOutriggerMats3D(...)`; giữ `dunnageGroup` bám vị trí/góc xoay & nghiêng theo độ dốc.
- **Kiểm tra:** `npm run architecture:gate` + `npm run build` + `./scripts/auto_check.ps1`.

### [x] Bước 3: Dây chằng Flat Rack ôm khít kiện & helper đứt tuần tự tự nhiên
- **File tạo/sửa (3 file):**
  1. Tạo `src/rigging/FlatRackLashingPhysics.js` (`< 230` dòng, `@purpose:`):
     - `buildTightFlatRackLashingVisuals({ THREE, oogGroup, group, MATS, dims })`: bọc dây chằng sát mặt trên/mặt bên `polyHood` & thùng hàng, kéo chéo gọn vào vòng neo trong mép dầm Flat Rack (`<= Math.max(W*0.5 - 0.03, Math.abs(offsetZ) + cW*0.5 + 0.035)`), bỏ hẳn thanh ngang lòi ra ngoài không trung; tạo sẵn 2 đoạn dây đứt (`brokenTop`, `brokenBot`) cho từng sợi kèm thông số `relStrength` & `seed`.
     - `stepStaggeredLashingBreakPhysics({ st, oogGroup, gLocal, tiltDeg, tiltRad, payloadMassKg, dt, anyBrokenSling, spawnSnapSparksAtLocal })`: tính tải cục bộ theo từng sợi (bên dốc thấp hơn chịu tải cao hơn + `relStrength`), cho đứt rải rác tự nhiên (`0.04s–0.32s`) thay vì biến mất đồng loạt 1 frame, kích hoạt văng/rủ đuôi dây theo trọng lực.
  2. Sửa `src/rigging/index.js`: export `FlatRackLashingPhysics`.
  3. Sửa `src/sim/cargo/containers_iso.js` (`<= 15` dòng thay đổi): thay khối dựng dây chằng cũ trong `addDeckOogCargoOverlay` bằng `RIG.buildTightFlatRackLashingVisuals(...)`.
- **Kiểm tra:** `npm run architecture:gate` + `npm run build` + `./scripts/auto_check.ps1`.

### [ ] Bước 4: Nối vật lý đứt dây chằng & sửa logic Camera Follow (bỏ tự zoom-in)
- **File sửa (3 file):**
  1. `src/sim/physics/flatrack_payload.js` (`<= 20` dòng thay đổi): gọi `RIG.stepStaggeredLashingBreakPhysics(...)` trong `stepFlatRackPayloadPhysics` và reset trạng thái từng sợi trong `resetFlatRackPayloadState` (giữ nguyên toàn bộ trường `st.lashing` cho Golden Test).
  2. `src/sim/library/reconstruction_export.js` (`<= 22` dòng thay đổi):
     - Trong `setCameraBehavior`: bật `cinema` (`Follow`) không gọi `frameCinematicHeroShot` ép xoay/zoom mà giữ nguyên `cf.lockedOffset = camera.position - controls.target` hiện tại của người dùng (trừ lúc khởi động `immediate`).
     - Trong `updateCameraFollowSystem`: bỏ khối `wantDist` tự ép zoom khi nâng hàng; bám mượt `worldTarget` tịnh tiến (`controls.target` & `camera.position` cùng giữ nguyên `cf.lockedOffset` hoặc cho phép người dùng lăn chuột zoom tự do không bị giật lại).
  3. `src/sim/session/presets_events.js` (`<= 15` dòng thay đổi): khi bấm `#btn-cam-cinema` (`Follow`) gọi `applyCamBehavior('cinema')` thay vì `frameCinematicHeroShot` (không giật zoom); đổi text `'Auto'` -> `'Follow'` trong `syncCameraFollowUI` & từ điển EN/VI.
- **Kiểm tra:** `npx vitest run` + `npm run architecture:gate` + `npm run build` + `./scripts/auto_check.ps1`.

### [ ] Bước 5: Đổi nút giao diện thành `Follow`, thêm test hồi quy & nghiệm thu toàn bộ
- **File sửa/tạo (2 file):**
  1. `index.html` (`<= 8` dòng thay đổi): đổi chữ & tooltip `Auto` -> `Follow` ở `#btn-cam-cinema`, `#cam-follow-label` và mô tả popover Camera.
  2. Tạo `test/jobsite_lashing_follow_regression.test.js` (`< 200` dòng): test 3D dunnage/mats/slope config, Flat Rack lashing nằm trong biên khung (không lòi ngang) + đứt tuần tự theo độ nghiêng/seed, Camera Follow giữ nguyên khoảng cách zoom khi vật nâng lên.
- **Kiểm tra cuối:** `npx vitest run`, `npm run architecture:gate`, `npm run build`, `npm run check:dist`, `./scripts/auto_check.ps1`, `./scripts/auto_log.ps1`.
