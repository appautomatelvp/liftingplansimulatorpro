# KẾ HOẠCH THỰC HIỆN (PLAN.md)
Trạng thái: ACTIVE
Tính năng: HIERARCHICAL RIGGING NAMING CONVENTION — Định danh cáp & phụ kiện theo Cây Phân Cấp (`LP1 -> LP11, LP12 -> LP111...`) truy xuất nguồn gốc lực (Load Path Traceability)
Nhánh Git: feat/horizon-clouds (backup: `_BACKUPS_LOCAL\LIFTING PLAN SIMULATOR PRO-084417112026 (test - hierarchical-rigging-naming).zip`)
Người lập kế hoạch: Model cao nhất (KHÔNG viết code ở bước này). Gõ `làm tiếp` 1 lần để chạy một mạch Bước 1 → 5.

## 0. KẾT QUẢ KHÁM CODE
- **Nguyên nhân gốc rễ:** `buildRigTopology()` (`src/sim/physics/hoist_contacts.js:480-785`) tạo mảng phẳng `cables[]` với `role` (`upper`, `hanger`, `leg`) và `index` phẳng `0..3` độc lập giữa các tầng. Do đó:
  - Tầng trên bị gọi là `Upper sling 1/2` / `Treo 1/2` (`editor.js:64, 2604`, `step_engine.js:780`, `cables_break.js:1352`).
  - Tầng dưới bị đánh số `LP1..LP4` theo thứ tự góc kiện hàng (`telemetry.js:577, 579`), khiến bên nhánh `LP1` hiện nhầm thành `LP3, LP4` hoặc trộn lẫn nhánh trái/phải.
- **Điểm thuận lợi sẵn có:** Mỗi phần tử trong `cables[]` đã có sẵn tọa độ đầu nối `a` (`hook` / `hook2` / `body(id, lx, ly, lz)`) và đầu nối `b` (`body(id, lx, ly, lz)` / `cargo(idx)`), đủ dữ liệu dựng cây phân cấp đệ quy từ `Crane Hook` mà KHÔNG cần thay đổi logic vật lý hiện tại.

## 1. Giả định đã chọn
1. Giữ nguyên `c.role` và `c.index` để 100% phép tính lực, XPBD, `state.gear.{uppers,hangers,legs}` và `test/*` cũ chạy ổn định; chỉ bổ sung thuộc tính `c.name`, `c.hierarchicalName`, `c.parentId`, `c.parentName`, `c.tier` và đồng bộ lên UI.
2. Thuật toán đệ quy `assignHierarchicalNames` đi từ `Crane Hook`:
   - Tầng 1 nối trực tiếp `hook`/`hook2`: `LP1`, `LP2`, `LP3`...
   - Nút nối tiếp trên dầm (như đầu trái `m.b` vs đầu phải `m.a` của Spreader/Lifting Beam, hoặc từng khớp trên dầm chữ H/Basket/Cascaded): cáp con cắm vào vùng đầu nối của cáp cha nào thì kế thừa tiền tố của cáp cha đó (`LP1` → `LP11`, `LP12`; `LP2` → `LP21`, `LP22`; tầng 3 → `LP111`, `LP112`...).
   - Trường hợp nhiều cáp cùng nối chung 1 tâm (như `direct_hook` 1 link trên H-Beam): cả 4 nhánh dưới chia từ tâm dầm kế thừa tiền tố `LP1` → `LP11..LP14`.
3. Toàn bộ file mới `< 220` dòng, có `@purpose`; file cũ phình (`telemetry.js`, `editor.js`, `hoist_contacts.js`, `cables_break.js`, `step_engine.js`) chỉ chèn `≤ 25` dòng gọi hàm.
4. Giữ nguyên song ngữ EN/VI (`window.SafeLift.i18n.L` + `EXTRA_UI_EN`) — không rò chữ Việt ở chế độ EN.

## 2. Rủi ro
- **R1:** Test cũ kiểm tra chuỗi `"Upper sling"` hoặc `"LP3"` ở UI/telemetry → rà soát toàn bộ test liên quan khi chạy `npx vitest run` ở Bước 5.
- **R2:** Nhãn 3D cho tầng trên (`LP1`, `LP2`) thêm vào `#labels-container` cần ẩn sạch khi dùng `direct` (chỉ có 1 tầng `LP1..LP4`) hoặc khi tắt nhãn hiển thị (`showForces`/`showSlingAngles`/`showShackleLoads`/`showSlingLengths`), tránh chồng chữ lên Hook.

## 3. File CẤM đụng
`src/core/standards/*`, `src/core/DeformableSteelStructure.js`, `src/core/PhysicalCableSolver.js`, `src/core/CraneLoadChartEngine.js`, `src/core/GroundPressureEngine.js`, `src/core/physics-world/*`, `src/sim/manifest.js`, `src/utils/firestoreSanitize.js`, `src/utils/localDataStore.js`, `firestore.rules`.

---

## CÁC BƯỚC THỰC HIỆN TUẦN TỰ (mỗi bước xong: `vitest` + `architecture:gate` + `auto_check.ps1` → tick `[x]` → `git commit` → làm tiếp)

### [x] Bước 1: Tạo lõi Cây Phân Cấp `HierarchicalNaming.js` + Golden Test
- **Tạo:** `src/rigging/HierarchicalNaming.js` (<220 dòng, hàm thuần):
  - `assignHierarchicalNames(cables, { bodies, hookLabel })`: dựng cây nối từ `hook` / `hook2`, tìm nút cha cho từng cáp dựa trên `(endpointKind, bodyId, vị trí cục bộ khớp đầu dầm)`, đánh số đệ quy `LP1, LP2 -> LP11, LP12 -> LP111...`, gắn `{ id, name, hierarchicalName, parentId, parentName, tier }` lên từng cáp và trả về map tra cứu nhanh (`byCableKey`, `byRoleIndex`).
  - `syncHierarchicalNamesToGear(cables, state)`: đồng bộ `hierarchicalName`, `parentId`, `parentName` vào `state.gear.uppers[]`, `hangers[]`, `legs[]`, `shackles[]`.
  - `resolveCableLabel(cOrRole, idx, state, phy)`: hàm chung trả tên phân cấp (VD: `LP11`), fallback an toàn nếu chưa dựng cây.
- **Sửa:** `src/rigging/index.js` (export `./HierarchicalNaming.js`), `auto_kit/test.md` (thêm Golden Test).
- **Tạo test:** `test/hierarchical_naming.test.js` kiểm tra: cẩu trực tiếp 4 chân (`LP1..LP4`), Spreader 2+4 (`LP1, LP2` & `LP11, LP12, LP21, LP22`), Cascaded 2+4+4 (`LP1 → LP11 → LP111`), Inline-8 3 tầng (`LP111..LP222`), H-Beam `direct_hook` (`LP1 → LP11..LP14`), kiểm tra `parentId`/`parentName` khớp 100%.
- **Kiểm tra:** `npx vitest run test/hierarchical_naming.test.js` + `npm run architecture:gate`.

### [ ] Bước 2: Gắn đệ quy đặt tên vào Physics Engine (`hoist_contacts.js` & `beams_seed.js`)
- **Sửa (≤25 dòng/file):**
  - `src/sim/physics/hoist_contacts.js`: ngay trước khi `return { bodies, cables, lugs }` (hoặc bao chung qua helper trước khi trả kết quả `buildRigTopology()`), gọi `RIG.assignHierarchicalNames(cables, { bodies })`.
  - `src/sim/physics/beams_seed.js`: tại điểm khởi tạo/nạp `phy.cables` gọi `RIG.assignHierarchicalNames(phy.cables, { bodies: phy.beams })` và `RIG.syncHierarchicalNamesToGear(phy.cables, state)`.
- **Kiểm tra:** `npx vitest run test/hierarchical_naming.test.js test/rigging.test.js` + `npm run architecture:gate`.

### [ ] Bước 3: Cập nhật nhãn 3D trên viewport (`telemetry.js`)
- **Sửa (≤25 dòng):** `src/sim/telemetry.js`:
  - Tại vòng lặp vẽ nhãn `#lbl-t0..t7` (~dòng 569): lấy `cableName = RIG.resolveCableLabel('leg', i, state, phy)` thay cho `` `LP${i + 1}` `` cứng, hiển thị đúng `LP11 · 7.1T · 60° · ...` (hoặc `LP11: ĐỨT/PARTED`).
  - Bổ sung cập nhật nhãn nổi cho các nhánh tầng trên (`upper`, `hanger`) qua pool `lbl-hier-*` tạo động một lần trong `#labels-container` khi có nhiều tầng (`state.beamType !== 'none'`), hiển thị tên `LP1`, `LP2`, `LP11`... tại trung điểm cáp và ẩn khi tắt hiển thị.
- **Kiểm tra:** `npx vitest run test/hierarchical_naming.test.js test/v3_ruler_drag_hoist_sts_gear_regression.test.js` + `npm run architecture:gate`.

### [ ] Bước 4: Đồng bộ UI Inspector, Cảnh báo góc, Đứt cáp, Compliance & Replay
- **Sửa (≤25 dòng/file):**
  - `src/sim/gear/editor.js`: trong `gearItemLabel()` (~dòng 64) và `refreshGearLive()` (~dòng 2602), thay `Upper sling X` / `Treo X` / `Hanger X` / `LP{i+1}` bằng tên phân cấp (`LP1`, `LP2`, `LP11`...), đồng thời ma ní thừa kế tên dây cha (`Ma ní LP11` / `Shackle LP11`). Cập nhật cả `tierName` dòng ~1974.
  - `src/sim/physics/step_engine.js` (~dòng 779): banner cảnh báo góc kéo dưới màn hình dùng tên phân cấp (`worstCable.name`, VD: `Sling LP2 is 41.7°` thay vì `upper sling 2 is 41.7°`).
  - `src/sim/physics/cables_break.js` (~dòng 1333–1479): các thông báo đứt cáp dùng `RIG.resolveCableLabel(c.role, c.index, state, phy)`.
  - `src/sim/compliance.js` (~dòng 215) & `src/rigging/ReplayRecorder.js`: dùng/lưu `name`, `parentId`, `parentName`, `tier` khi ghi & phát lại 60s.
- **Kiểm tra:** `npx vitest run test/hierarchical_naming.test.js test/i18n_keys.test.js test/rigging_physics_and_alarms.test.js` + `npm run architecture:gate`.

### [ ] Bước 5: Kiểm thử tích hợp 3D + E2E & Nghiệm thu cuối
- Bổ sung test tích hợp headless 3D vào `test/hierarchical_naming.test.js`: bật Spreader Beam, xác nhận `phy.cables` có đúng `LP1`, `LP2`, `LP11`, `LP12`, `LP21`, `LP22`, nhãn 3D `#lbl-t*` và banner cảnh báo góc dùng đúng `LP2`, đồng thời kiểm tra chế độ `cascaded` 3 tầng (`LP111`).
- Chạy toàn bộ: `npx vitest run`, `npm run architecture:gate`, `npm run build`, `npm run check:dist`, `npx playwright test e2e/saas-accessibility.spec.js --project=fhd-1080p`, `./scripts/auto_check.ps1`.
- Cập nhật `auto_memory/CONTEXT.md`, `STATE.md`, đặt `Trạng thái: DONE`, chạy `./scripts/auto_log.ps1 -Type feat ...`.
- **KHÔNG tự `git push`/deploy** nếu founder chưa cho phép ở phiên thực thi.
