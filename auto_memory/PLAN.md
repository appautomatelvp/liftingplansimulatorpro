# KẾ HOẠCH NÂNG CẤP CHUYÊN SÂU: CẤU TẠO H-STYLE LIFTING BEAM (2 THANH NGANG 4 GÓC) & TÙY CHỌN LIÊN KẾT TRÊN / DƯỚI (ACTIVE)

- **Trạng thái:** `ACTIVE`
- **Ngày lập:** 2026-11-16
- **Phân loại:** **VIỆC LỚN** (nâng cấp toàn bộ hình học 3D, khớp vật lý `beamRecipe`, cơ chế nâng hạ và giao diện chọn liên kết Trên/Dưới cho `Lifting Beam` theo 4 hình mẫu công nghiệp của Founder).
- **Nhánh thực thi:** `feat/horizon-clouds` (đã sao lưu an toàn vào `_BACKUPS_LOCAL/`).

---

## 1. YÊU CẦU & MÔ TẢ CẤU TẠO CHUẨN CÔNG NGHIỆP (THEO HÌNH MẪU FOUNDER GỬI)

1. **Hình dáng 3D Dầm nâng chữ H (`H-Style Lifting Beam`):**
   - Thân chính ở giữa chạy dọc theo chiều dài dầm (`±halfX`, trục X), kết cấu dầm chữ H / hộp gia cường với lưới uốn `widthSegments = 32` và các gân tăng cứng nằm gọn bên trong.
   - Hai thanh ngang ở 2 đầu dầm chạy vuông góc dọc trục Z (`x = ±halfX`, dài phủ bì `spanZ`, tạo thành hình chữ **H** từ trên nhìn xuống như 3 ảnh mẫu).
   - Có bản mã gia cường tại 2 nút giao chữ T/H giữa dầm chính và 2 thanh ngang, **1 tai treo trung tâm (Bail Eye)** trên đỉnh giữa dầm `(0, +0.28, 0)`, **2 tai treo trên đỉnh 2 đầu dầm chính** `(±halfX, +0.24, 0)`, và **4 điểm bắt ở 4 góc đầu thanh ngang** `(±halfX, -0.22, ±halfZ)`.
2. **Tùy chọn liên kết PHÍA TRÊN (Với Hook Link / Móc cẩu):**
   - `bridle2` *(mặc định)*: Vẫn giữ 2 nhánh cáp/xích từ 2 tai đầu dầm chính `(±halfX, +0.24, 0)` chụm lên vòng khuyên chính (`Master Link`) của móc cẩu.
   - `direct_hook`: Bắt trực tiếp vòng khuyên móc cẩu (`Master Link`) vào tai treo trung tâm trên đỉnh giữa dầm `(0, +0.28, 0)` — **không dùng 2 sợi cáp trên**, đúng kiểu dầm trần thấp như Ảnh 1 & Ảnh 2.
3. **Tùy chọn liên kết PHÍA DƯỚI (Từ 4 góc thanh ngang xuống kiện hàng):**
   - `cable` *(mặc định)*: Treo **4 nhánh cáp hoặc xích** kèm ma ní từ **4 góc ngoài của 2 thanh ngang** `(±halfX, -0.22, ±halfZ)` xuống 4 góc/tai cẩu của kiện hàng (như Ảnh 1, 2, 3), khắc phục hẳn kiểu cũ vốn chỉ treo ở giữa `z = ±0.065`.
   - `direct`: Gắn **4 chốt gù Twistlock ISO** ở 4 góc dưới thanh ngang `(±halfX, -0.22, ±halfZ)` để **gắp trực tiếp vào 4 lỗ gù nóc container** (không cần cáp/xích dưới).

---

## 2. LUẬT AN TOÀN BẮT BUỘC KHI THỰC THI
- Tách logic tạo hình chữ H, bản mã, tai giữa, Twistlock 4 góc và tính toán span/khớp nối sang module mới **`src/rigging/HStyleLiftingBeam.js`** (`< 240` dòng, bắt đầu bằng `// @purpose:`).
- Các file cũ `⚠️>300` dòng (`specialty_meshes.js`, `hoist_contacts.js`, `beams_seed.js`, `footprint_rig.js`, `telemetry.js`, `prelift_reset.js`, `ui_units_bom.js`, `presets_events.js`, `index.html`) chỉ gọi sang module mới, tuyệt đối không nhồi thêm `> 25` dòng code mới vào file cũ (hoặc thay thế đoạn code `lifting_beam` cũ để tổng dòng không tăng quá mức).
- Không sửa bất kỳ file `[LOCKED]` nào (`src/core/**`, `src/sim/manifest.js`, `firestore.rules`, `src/utils/**`).

---

## 3. CÁC BƯỚC THỰC THI CHI TIẾT (CHẠY MỘT MẠCH TỪ BƯỚC 1 ĐẾN BƯỚC 5)

### Bước 1: Tạo Module Dựng Hình & Thông Số Kỹ Thuật H-Style Lifting Beam (`src/rigging/HStyleLiftingBeam.js`, `src/rigging/index.js`)
- [x] **Trạng thái:** Hoàn tất (`188` dòng, `architecture:gate` & `vite build` xanh)
- **Mục tiêu:** Đóng gói toàn bộ logic hình học 3D và thông số kích thước/khớp nối của Dầm nâng chữ H mới vào một module sạch `< 240` dòng.
- **File được phép tạo/sửa (tối đa 2 file):**
  1. `src/rigging/HStyleLiftingBeam.js` *(tạo mới, `< 240` dòng, có dòng đầu `// @purpose: Cấu tạo 3D và thông số khớp nối H-Style Lifting Beam (tùy chọn liên kết trên Direct Hook/2-Cáp và dưới 4-Cáp/Twistlock)`)*:
     - `resolveHBeamCorners(spanX, spanZ, cargoDims, bottomMode)`: Tính tọa độ 4 góc `(±halfX, ±halfZ)` — nếu `bottomMode === 'direct'` thì khóa theo đúng khoảng cách lỗ gù ISO của container (`L - 0.207`, `W - 0.179`); nếu `'cable'` thì theo `spanX, spanZ` hiện hành của ngáng.
     - `buildHStyleLiftingBeamMeshes(opts)`: Dựng dầm chính chữ H (`32` segment uốn), 2 thanh ngang vuông góc ở 2 đầu (`crossbarPlus`, `crossbarMinus`), gân tăng cứng gọn trong bụng dầm, bản mã góc, **1 tai treo giữa dầm (Central Bail Eye)** dạng tấm thép có chốt ngang/khuyên bo tròn (Ảnh 1 & 3), 2 tai đầu trên (khi `topMode === 'bridle2'`), 4 tai góc dưới (khi `bottomMode === 'cable'`) hoặc **4 chân chốt gù ISO Twistlock** (khi `bottomMode === 'direct'`), trả về danh sách mesh đã gắn `memberId = 'main'` & tọa độ các điểm neo.
     - `solveHBeamDirectCoupling(...)`: Hỗ trợ tính vị trí móc sát tai giữa (khi `topMode === 'direct_hook'`) và ghép khít 4 góc Twistlock lên nóc container (khi `bottomMode === 'direct'`).
  2. `src/rigging/index.js` *(sửa $\le 4$ dòng)*: Export `HStyleLiftingBeam.js`.
- **Cách kiểm tra:** `npm run architecture:gate` && `npm run build` xanh.

---

### Bước 2: Đấu nối Hình học 3D Chữ H, Trạng thái & Ma-ní 4 góc (`src/sim/state.js`, `src/sim/cargo/specialty_meshes.js`)
- [x] **Trạng thái:** Hoàn tất (`state.js`, `specialty_meshes.js`, `shell_rebuild.js` đã đấu nối H-Style & ẩn pad-eye khi gắp trực tiếp; `architecture:gate` & `vite build` xanh)
- **Mục tiêu:** Thay khối dầm thẳng cũ của `lifting_beam` bằng khối chữ H 2 thanh ngang 4 góc hoàn chỉnh, hỗ trợ 4 tổ hợp trên/dưới.
- **File được phép sửa (tối đa 2 file):**
  1. `src/sim/state.js` *(sửa $\le 6$ dòng)*:
     - Thêm 2 trường mặc định vào `state`:
       - `liftingBeamTopMode: 'bridle2'` (`'bridle2'` | `'direct_hook'`)
       - `liftingBeamBottomMode: 'cable'` (`'cable'` | `'direct'`)
  2. `src/sim/cargo/specialty_meshes.js` *(thay thế nhánh `lifting_beam` dòng 2305–2360 bằng $\le 22$ dòng gọi `RIG.buildHStyleLiftingBeamMeshes` + cập nhật `getLPBoundingSpan` dòng 1665 cho `lifting_beam` trả về `spanZ` thực của thanh ngang)*.
     - Khi `topMode === 'bridle2'`: gắn 2 ma-ní trên ở `(±halfX, +0.24, 0)`. Khi `'direct_hook'`: ẩn 2 ma-ní trên hai đầu, dùng tai giữa `(0, +0.28, 0)` gắn chốt nối thẳng lên Master Link.
     - Khi `bottomMode === 'cable'`: gắn **4 ma-ní dưới ở 4 góc thanh ngang `(±halfX, -0.22, ±halfZ)`** để treo 4 cáp/xích xuống 4 góc kiện hàng. Khi `'direct'`: gắn 4 chốt gù Twistlock tại 4 góc để gắp trực tiếp container.
- **Cách kiểm tra:** `npm run architecture:gate` && `npm run build` xanh.

---

### Bước 3: Đấu nối Vật lý Khớp nối Trên/Dưới & Hiển thị Cáp/Hook (`hoist_contacts.js`, `beams_seed.js`, `footprint_rig.js`, `prelift_reset.js`, `telemetry.js`)
- [x] **Trạng thái:** Hoàn tất (đấu nối `hoist_contacts.js`, `cables_break.js`, `footprint_rig.js`, `beams_seed.js`, `prelift_reset.js`, `telemetry.js`; `architecture:gate`, `vite build`, `rigging_realism_sts_contact.test.js` xanh)
- **Mục tiêu:** Cho phép `lifting_beam` hoạt động chuẩn vật lý với cả 4 tổ hợp (trên `direct_hook`/`bridle2`, dưới `direct`/`cable`).
- **File được phép sửa (tối đa 5 file, mỗi file $\le 18$ dòng):**
  1. `src/sim/physics/hoist_contacts.js` *(tại `beamRecipe` dòng 636–648)*:
     - Tách riêng nhánh `type === 'lifting_beam'`:
       - Dùng khối cứng dạng `'frame'` (trọng lượng gồm thân chính + 2 thanh ngang) để phát hiện va chạm 4 góc chính xác.
       - Phía trên: nếu `topMode === 'direct_hook'` thì tạo **1 liên kết cứng ngắn** (`role: 'upper', index: 0`) nối từ `endOf('hook')` thẳng xuống tai giữa `(0, +0.28, 0)` với `L0 ≈ 0.14m`; nếu `'bridle2'` thì nối 2 nhánh `upper` từ `(±halfX, +0.24, 0)` lên `hook`/`hook2`.
       - Phía dưới: nếu `bottomMode === 'direct'` thì tạo 4 chốt gù Twistlock (`L0 ≈ 0.06m`) tại `(±halfX, -0.22, ±halfZ)` xuống 4 góc nóc container; nếu `'cable'` thì treo **4 nhánh `leg` từ 4 góc `(±halfX, -0.22, ±halfZ)`** xuống 4 tai kiện hàng.
  2. `src/sim/physics/footprint_rig.js` *(tại `getRigSpec` dòng 177–258)*:
     - Khi `beamType === 'lifting_beam'`: nếu `topMode === 'direct_hook'` thì `horizU = 0.05`, `minUpper = 0.08`, `recUpper = 0.14`; nếu `bottomMode === 'direct'` thì `minLower = 0.04, recLower = 0.06, maxLower = 0.12`.
  3. `src/sim/physics/beams_seed.js` *(tại `syncHookToRigTaut`, `enforceStsSpreaderAsHeadblock` / couple loop)*:
     - Khi `lifting_beam` dùng `direct_hook`: ghì mượt tai giữa dầm với Master Link của móc cẩu (không xoay lắc vô lý); khi dùng `bottomMode === 'direct'`: tái sử dụng `RIG.solveStsDirectTwistlockPose` giữ 4 góc dầm chữ H áp khít nóc container & nghiêng đàn hồi khi lệch CoG.
  4. `src/sim/session/prelift_reset.js` *($\le 12$ dòng trong `autoPositionHookForLift` & snapshot save/restore)*:
     - Hỗ trợ lưu/nạp `liftingBeamTopMode`, `liftingBeamBottomMode` và căn `targetY` chính xác khi `direct_hook` hoặc `direct` container.
  5. `src/sim/telemetry.js` *($\le 10$ dòng trong vòng lặp `phy.cables.forEach`)*:
     - Khi `lifting_beam` đang ở `direct_hook`, không vẽ cáp bridle giả cho `upper` (tai giữa móc sát vào Hook Link); khi `bottomMode === 'direct'`, ẩn 4 sợi cáp dưới và pad-eye/shackle (vì gắp bằng 4 chốt Twistlock góc).
- **Cách kiểm tra:** `npm run architecture:gate` && `npm run build` xanh.

---

### Bước 4: Thêm Bảng Chọn Liên Kết Trên & Dưới Trong Giao Diện (`index.html`, `ui_units_bom.js`, `presets_events.js`, `plan_wizard.js`)
- [ ] **Trạng thái:** Chưa làm
- **Mục tiêu:** Cung cấp nút bấm trực quan ngay khi người dùng chọn `Lifting Beam` (và trong Wizard) để chuyển qua lại tức thì giữa:
  - Phía trên: **Bắt trực tiếp Hook Link** ↔ **Dùng 2 cáp / xích lên Hook**
  - Phía dưới: **Dùng 4 cáp / xích từ 4 góc** ↔ **Gắp trực tiếp vào Container**
- **File được phép sửa (tối đa 4 file, mỗi file $\le 25$ dòng):**
  1. `index.html` *($\le 24$ dòng ngay dưới `#sts-size-panel`)*: Thêm panel `#lifting-beam-mode-panel` ẩn mặc định (`hidden`), hiện khi chọn `Lifting Beam` với 2 hàng nút `data-lb-top="direct_hook|bridle2"` và `data-lb-bot="cable|direct"`.
  2. `src/sim/session/ui_units_bom.js` *($\le 22$ dòng)*: Cập nhật `updateLiftingBeamModeUI()` (ẩn/hiện `#lifting-beam-mode-panel`, đồng bộ màu nút đang chọn, và khóa/ẩn điều chỉnh chiều dài cáp trên khi đang `direct_hook`, ẩn chiều dài cáp dưới khi đang `direct`).
  3. `src/sim/session/presets_events.js` *($\le 18$ dòng)*: Bắt sự kiện click `.btn-lb-top` và `.btn-lb-bot` gọi `rebuildCargoAndRig(false)` + `syncHookToRigTaut()` + `updateLiftingBeamModeUI()`.
  4. `src/sim/plan_wizard.js` *($\le 18$ dòng)*: Khi ở bước chọn `Lifting Beam`, cho phép chọn nhanh liên kết trên/dưới tương ứng.
- **Cách kiểm tra:** `npm run architecture:gate` && `npm run build` xanh.

---

### Bước 5: Bộ Kiểm Thử Vàng H-Style Lifting Beam & Nghiệm Thu Toàn Diện (`test/h_style_lifting_beam.test.js`)
- [ ] **Trạng thái:** Chưa làm
- **Mục tiêu:** Kiểm chứng toàn bộ 4 chế độ của H-Style Lifting Beam và đảm bảo 100% test cũ không bị ảnh hưởng.
- **File được phép tạo/sửa (tối đa 3 file):**
  1. `test/h_style_lifting_beam.test.js` *(tạo mới, `< 200` dòng, có `// @purpose: Kiểm thử vàng cấu tạo H-Style Lifting Beam 4 góc và 4 tổ hợp liên kết Trên/Dưới`)*:
     - Kiểm tra lưới 3D chữ H có 2 thanh ngang vuông góc, tai giữa dầm và 4 điểm góc tại `(±halfX, ±halfZ)`.
     - Chạy mô phỏng không đầu (`createHeadlessSim`) kiểm thử đủ 4 tổ hợp:
       1. `bridle2 + cable`: 2 cáp trên + 4 cáp/xích dưới từ 4 góc thanh ngang, nâng kiện lên thăng bằng ổn định.
       2. `direct_hook + cable`: móc cẩu bắt trực tiếp vào tai giữa dầm (0 cáp trên), 4 cáp/xích dưới chịu tải đều.
       3. `bridle2 + direct`: 2 cáp trên kéo dầm chữ H, 4 chốt gù dưới gắp trực tiếp container ISO 40ft (0 cáp dưới).
       4. `direct_hook + direct`: bắt trực tiếp vào Hook Link + gắp trực tiếp 4 chốt container.
  2. `auto_memory/PLAN.md` *(đánh dấu `[x]` toàn bộ 5 bước và `Trạng thái: DONE`)*.
  3. `STATE.md` *(cập nhật trạng thái hoàn tất)*.
- **Cách kiểm tra:** `npm test` (toàn bộ suite) && `npm run architecture:gate` && `npm run build` && `./scripts/auto_check.ps1` xanh 100%.
