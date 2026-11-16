# KẾ HOẠCH THỰC HIỆN (PLAN.md)
Trạng thái: ACTIVE
Tính năng: Chống xuyên đà gỗ khi kéo kiện ra vị trí bất kỳ, Ghi/Xem/Dừng tái hiện 100% (tối đa 60s), Tối ưu Tablet (iPad / Android >= 4GB RAM) giữ đủ bảng chức năng, Thước cao độ mặc định bên phải & số to gấp đôi, Dứt điểm giật STS Hạ/Hạ đất, Triển khai GitHub & Cloudflare Pages
Nhánh Git: feat/horizon-clouds

## Mục tiêu & Chẩn đoán Gốc
1. **Kéo kiện ra vị trí khác đè lên gỗ vẫn xuyên qua (`beams_seed.js:2268`):** `contactLocals()` chỉ lấy 7 cột điểm tĩnh theo `[-0.39..0.39] * L` (cách nhau ~1.7 m trên kiện 40ft), rộng hơn nhiều so với thanh gỗ `0.20 m` nên khi kéo lệch kiện X/Z, thân kiện lọt qua khe giữa các điểm dò. Cần tự động chiếu/bổ sung điểm tiếp xúc ngay tại giao tuyến giữa đáy kiện và từng thanh đà gỗ trong `dunnageGroup` (`siteProfile.beams`) ở mọi vị trí kéo/xoay.
2. **Ghi / Xem / Dừng chưa tái hiện Lắc kiện, Cắt cáp, Rớt kiện, Đứt dây & giới hạn 60s (`ReplayRecorder.js`, `presets_events.js`, `flatrack_payload.js`):**
   - Giới hạn hiện tại đang là `36s` (`MAX_REPLAY_FRAMES = 720`); cần nâng lên tối đa `60s` (`1200` khung hình @ 20Hz).
   - Khi phát lại (`stepReplayPlayback`), `stepPhysicsEngine()` tạm dừng nhưng `ReplayRecorder` mới chỉ đặt `phy.oogState` chứ chưa cập nhật lưới 3D `flatRackOogCargo` (vị trí `localPos` / `worldPos` rơi, góc nghiêng), chưa đồng bộ trạng thái đứt từng sợi dây chằng (`flatRackLashingStraps` / `flatRackBrokenStraps` + `strapNodes`), chưa reset `cable._failureProcessed` / giữ đủ `cable.break` khi chuyển giữa chưa cắt ↔ đã cắt, và chưa lưu snapshot cấu hình ban đầu (`initialMeta`) lúc ấn `Ghi`.
3. **Hoạt động mượt & đủ bảng chức năng trên iPad / Tablet Android (>= 4GB RAM) (`src/styles/app.css`, `src/graphics/SceneRenderer.js`, `src/sim/gear/editor.js`):**
   - `#top-bar` (`flex-wrap: nowrap; overflow-x: hidden`) và `#bottom-dock-bar` bị cắt mất nút/bảng điều khiển ở độ rộng tablet `768px–1279px`. Cần bật vuốt ngang / rớt dòng gọn cho `#top-bar` và `#bottom-dock-bar` trên tablet (`<= 1279px`), tối ưu chiều rộng ngăn kéo `#right-side-drawer` / `#gear-editor` và vùng chạm cảm ứng (`touch-action: none` trên canvas, DPR tối ưu `<= 1.5` trên thiết bị cảm ứng để tablet 4GB RAM chạy mượt không tràn VRAM).
4. **Cây thước cao độ mặc định bên PHẢI (như hình mẫu) khi F5 & con số to gấp đôi (`ElevationRulerTool.js`):**
   - Chuyển vị trí mặc định (`customPos === null`) sang bên phải `+X` (`cx + Math.max(2.4, L * 0.5) + 1.55`), và nhân đôi kích thước font/sprite của nhãn độ cao (`512x112`, scale `4.4 x 0.96`) lẫn số chia vạch (`1.85 x 0.48`).
5. **Spreader STS vẫn giật khi bấm `Hạ` hoặc `Hạ đất` (`step_engine.js`, `hoist_contacts.js`, `beams_seed.js`, `dynamics.js`):**
   - Lò xo cáp tời đàn hồi `stepHoistDynamics` mất tải trọng treo khi XPBD bỏ qua xung lực `c._j = 0` ở STS Direct (khiến móc cẩu rung nẩy khi bắt đầu/dừng `Hạ`), đồng thời `step_engine.js:45` ngắt `Hạ đất` quá sớm tại `0.035m` làm kiện rớt nấc cuối về `0m`. Cần khóa êm bộ giảm chấn tời khi STS hạ, giảm tốc mượt tới sát `0.005m` và giữ `prevCargoY` đồng nhất.
6. **Triển khai GitHub & Cloudflare Pages:** Chốt nhánh ổn định (`main`), push lên GitHub `origin` và deploy `dist/` lên Cloudflare Pages (`safelift3d`).

## File `[LOCKED]` CẤM ĐỤNG
- `src/sim/manifest.js`, `/src/core/physics-world/*`, `/src/core/standards/*`, `CraneLoadChartEngine.js`, `GroundPressureEngine.js`, `PhysicalCableSolver.js`, `DeformableSteelStructure.js`, `/firestore.rules`, shims, `firestoreSanitize.js`, `localDataStore.js`.

---

## CÁC BƯỚC THỰC HIỆN TUẦN TỰ

### [x] Bước 1: Chống kiện xuyên qua đà gỗ ở mọi vị trí kéo/xoay & Khử nốt giật khi `Hạ`/`Hạ đất` STS Spreader
- **File sửa (3 file):**
  1. `src/graphics/JobsiteSiteVisuals.js`: thêm hàm thuần `sampleDunnageContactPointsForCargo({ cargoPos, cargoQuat, L, W, H, dunnageGroup })` tính chính xác các điểm tiếp xúc trên đáy kiện nằm đúng đỉnh/mép các thanh đà gỗ (kể cả khi kéo lệch tâm hay xoay góc).
  2. `src/sim/physics/beams_seed.js`: gọi hàm trên trong `contactLocals()` (và `flatRackContactSampleLocals()`), đồng thời đồng bộ vận tốc/giảm nẩy cho STS Spreader khi `lowering`.
  3. `src/sim/physics/hoist_contacts.js` & `src/sim/physics/step_engine.js` (hoặc tách helper nhỏ ở `UnifiedHoistProfile.js` giữ `<= 25` dòng vào mỗi file cũ): ổn định lò xo móc tời ở STS Direct khi `Hạ` (không rung nẩy do `c._j = 0`) và hạ êm tới `groundClearance <= 0.008m` trước khi `finishSmoothSetDown()`.
  - *(Chú ý giới hạn 3 file/bước: Bước 1A làm `JobsiteSiteVisuals.js`, `beams_seed.js`, `step_engine.js`; Bước 1B hay gộp `dynamics.js`/`hoist_contacts.js` — hãy giữ đúng 3 file: `JobsiteSiteVisuals.js`, `beams_seed.js`, `step_engine.js`, xử lý hoàn chỉnh cả gỗ kê & hạ STS!)*
- **Kiểm tra:** `npx vitest run test/v2_ux_dunnage_ruler_regression.test.js test/v3_ruler_drag_hoist_sts_gear_regression.test.js test/pretension_nhom_cap.test.js` + `npm run architecture:gate` + `npm run build`.

### [ ] Bước 2: Hoàn thiện `Ghi / Xem / Dừng` tái hiện 100% Lắc kiện, Cắt cáp, Rớt kiện OOG, Đứt dây chằng (giới hạn 60s)
- **File sửa (3 file):**
  1. `src/rigging/ReplayRecorder.js` (`< 260` dòng): tăng giới hạn `MAX_REPLAY_FRAMES = 1200` (`60.0s`), lưu & phát lại đầy đủ trạng thái OOG (`status`, `strapsBroken`, `lashing.isIntact`, `localPos`, `worldPos`, `worldQuat`, vị trí/góc 3D `flatRackOogCargo`, trạng thái đứt từng dây `strapNodes`), lưu đầy đủ `cable.broken` + `break.frac/upperLen/lowerLen/tipU/tipL` + `cable._failureProcessed` và áp trực tiếp vào `activeCargoVisual` trong `applyReplayFrame()`.
  2. `src/sim/library/reconstruction_export.js`: truyền `activeCargoVisual` (và `cableIsBroken` / `clearCableBreak` / `syncOOG`) vào `ReplayRecorder`, hiển thị đếm ngược `REC Xs / 60s`.
  3. `src/sim/session/presets_events.js`: khi bấm `Ghi` ghi ngay cấu hình ban đầu; khi bấm `Xem` khôi phục sạch về frame `0` (reset các cờ vật lý cũ không cho dính sang lần xem lại), chạy trơn tru tới hết; khi bấm `Dừng` chốt frame cuối rõ ràng.
- **Kiểm tra:** `npx vitest run test/v3_ruler_drag_hoist_sts_gear_regression.test.js` + `npm run architecture:gate` + `npm run build`.

### [ ] Bước 3: Cây thước đo độ cao mặc định bên PHẢI khi F5 & con số to gấp đôi
- **File sửa (3 file):**
  1. `src/graphics/ElevationRulerTool.js` (`< 298` dòng): đổi tọa độ mặc định (`customPos === null`) sang bên phải `+X` (`cx + Math.max(2.4, L * 0.5) + 1.55`) đúng như vị trí chuẩn trong hình F5; tăng gấp đôi độ lớn font + khung nhãn của 4 mốc (`Hook`, `Ngáng`, `Đỉnh`, `Đáy`), `Điểm Đỏ` và vạch số `2m, 4m...`.
  2. `src/sim/physics/hoist_contacts.js`: bổ sung chốt mượt chống giật cho `advanceHook()` khi STS Direct bắt đầu/kết thúc `Hạ` (tránh `clampHookOutOfSolids()` nẩy ngược khi chạm đất).
  3. `test/v2_ux_dunnage_ruler_regression.test.js`: cập nhật assertion kiểm tra vị trí phải mặc định & kích thước nhãn to gấp đôi của thước.
- **Kiểm tra:** `npx vitest run test/v2_ux_dunnage_ruler_regression.test.js test/v3_ruler_drag_hoist_sts_gear_regression.test.js` + `npm run build`.

### [ ] Bước 4: Tối ưu Tablet (iPad / Android >= 4GB RAM) & Không mất bảng điều khiển chức năng
- **File tạo/sửa (3 file):**
  1. Tạo `src/styles/tablet.css` (`< 140` dòng, `@purpose:`): media rules chuyên cho tablet (`max-width: 1280px` & `pointer: coarse`): thanh `#top-bar` cho phép cuộn ngang chạm mượt hoặc rớt dòng không bị ẩn nút bên phải; `#bottom-dock-bar` hiển thị trọn đủ cụm `Ghi/Xem/Dừng`, `Kéo/Hạ`, `Nhấc thử/Cân bằng/Hạ đất` không tràn mép; ngăn kéo `#right-side-drawer` & `#gear-editor` co giãn vừa vặn theo màn hình tablet, nút bấm tối thiểu `36–44px` dễ chạm; `#canvas-container canvas` đặt `touch-action: none`.
  2. `src/main.js` (hoặc `index.html` CSS import): import `tablet.css` đúng chỗ.
  3. `src/graphics/SceneRenderer.js`: tự nhận diện tablet/touch (`pointer: coarse` / RAM >= 4GB) giới hạn `maxDPR <= 1.5` ở chế độ mặc định để GPU iPad/Android giữ ổn định 60 FPS, không tụt khung hình hay văng WebGL.
- **Kiểm tra:** `npm run architecture:gate` + `npm run build` + `npm run check:dist`.

### [ ] Bước 5: Nghiệm thu toàn bộ kiểm thử mới + kiểm tra an toàn V7
- **File sửa/chạy (2 file):**
  1. Cập nhật `test/v3_ruler_drag_hoist_sts_gear_regression.test.js`: bổ sung test kéo kiện lệch tâm lên thanh gỗ không xuyên, test ReplayRecorder 60s tái hiện đủ OOG rơi + đứt dây chằng + cắt cáp + đong đưa, test thước mặc định bên phải & font gấp đôi, test tablet viewport/CSS & STS hạ êm tới sát sàn.
  2. Chạy toàn bộ: `npx vitest run`, `npm run architecture:gate`, `npm run build`, `npm run check:dist`, `./scripts/auto_check.ps1`, `./scripts/auto_log.ps1`.

### [ ] Bước 6: Triển khai lên GitHub & Cloudflare Pages
- **Thao tác:**
  1. Kiểm tra `git status` sạch sẽ, gộp nhánh `feat/horizon-clouds` về `master` và đẩy lên GitHub (`git push origin master`) theo xác nhận của Founder.
  2. Chạy `npm run build && npm run check:dist` lần cuối, rồi deploy `dist/` lên Cloudflare Pages (`npx wrangler pages deploy dist --project-name safelift3d`) và báo link production thực tế cho Founder.
