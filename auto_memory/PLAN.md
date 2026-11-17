# KẾ HOẠCH THỰC HIỆN (PLAN.md)
Trạng thái: ACTIVE
Tính năng: MASTER HOTFIX — Khôi phục đồng bộ dữ liệu theo Cây Phân Cấp (`LP1 -> LP11, LP12...`), UI Parity cho Cáp Tầng Trên, Sửa lỗi Góc Ngang >90° (`96°/98°`), và Phân Bố Lực Đàn Hồi 4 Điểm theo Độ Cứng Xoắn Dầm (`EA + GJ` XPBD thay cho ép `100/0/100/0`)
Nhánh Git: feat/horizon-clouds
Người lập kế hoạch: Model cao nhất (CHƯA viết code ở bước này). Gõ `làm tiếp` 1 lần để chạy một mạch Bước 1 → 5.

## 0. KẾT QUẢ KHÁM CODE (NGUYÊN NHÂN GỐC RỄ ĐÃ TÌM RA)
1. **FIX 1 — Mất đồng bộ dữ liệu Cây Phân Cấp (`telemetry.js:541-626`, `HierarchicalNaming.js`, `index.html:1857`):**
   - Bảng thanh lực căng & 3D label ở `telemetry.js:541-609` vẫn chạy vòng `for (let i = 0; i < 4; i++)` theo chỉ số phẳng `i = 0..3`, lấy chiều dài dùng chung `state.slingLength` thay vì đọc đúng node `node.id` / `node.name` (`LP11`, `LP12`, `LP21`, `LP22`...) và chiều dài riêng `c.L0` + tăng đơ của từng nhánh.
   - Nhãn thanh bảng bên trái (`#leg-lbl-0..3` trong `index.html:1857`) đang ghi cứng `LP1..LP4` thay vì đồng bộ tên cây phân cấp thực tế.
2. **FIX 2 — Cáp tầng trên `LP1/LP2` bị thiếu Góc, Chiều dài & `%SWL` ma ní (`telemetry.js:613-626`, `cables_break.js:1339-1379`):**
   - `topPool` trong `telemetry.js:624` chỉ render `${cName} · ${tens.toFixed(1)}T`, bỏ qua hoàn toàn góc ngang, chiều dài `L: ...m` và tải ma ní `SH(Bow/Pin): ...%`.
   - Trong `cables_break.js:1339-1379`, nhánh `c.role === 'upper'` và `'hanger'` chưa gọi `evaluateShackleComponentLoad` để gán `c._hardwareStress`, và nhánh `'hanger'` chưa lưu `phy.hangerAngleDeg[c.index]`.
3. **FIX 3 — Lỗi Góc Ngang > 90° (`96°/98°`) (`cables_break.js:1405`, `telemetry.js:105-109, 214-215`, `SlingAngleGizmo.js:35`):**
   - Ở `cables_break.js:1405` (`publishCableLoads`), công thức viết `Math.asin(clamp(n.y, -1, 1))` **thiếu `Math.abs`**. Khi đầu dưới hơi cao hơn đầu trên hoặc vector ngược hướng (`n.y < 0`), góc ngang bị âm (vd `-6°` / `-8°`), dẫn tới `phy.maxAngleVert = 90 - (-6) = 96°` (hiển thị thành `96°` / `98°` trên HUD & tooltip!).
   - Ở `SlingAngleGizmo.js` & `telemetry.js:215, 309-313, 351-352, 585`, góc ngang chưa được tính thống nhất bằng `asin(|top.y - bot.y| / length) * (180 / Math.PI)` và kẹp chặt `[0°, 90°]`.
4. **FIX 4 — Phân bố lực 4 điểm bị ép `100/0/100/0` thay vì đàn hồi thực (`DnvFourPointLift.js`, `RiggingPhysicsSolver.js:489-561`, `beams_seed.js:2462-2505`):**
   - Trong bộ giải XPBD (`beams_seed.js:2487-2488`), ràng buộc dây cáp đang giải cứng hoàn toàn (`wSum = endCompliance(a) + endCompliance(b)` không có độ mềm kéo trục dây `alpha_EA = L0 / (EA * dt^2)`), và chưa liên kết độ mềm xoắn Saint-Venant (`GJ`) của dầm nâng trong bước giải lực, nên chênh lệch dài vài mm làm 2 sợi chéo rơi xuống `slack = true` (`0.0T`).
   - Đồng thời `DnvFourPointLift.js:99-102` & `RiggingPhysicsSolver.js:489-560` đang ép 2 chân chéo thụ động bằng `0t` (`shares = [0, 0, ...]`) ngay cả khi dầm/khung có độ mềm xoắn (`GJ > 0`), ghi đè lên chia tải đàn hồi thực tế.

## 1. Giả định đã chọn & Lưu ý Golden Tests (`@test`)
1. Không đụng các file `[LOCKED]` trong `STATE.md` (`src/core/standards/*`, `src/core/DeformableSteelStructure.js`, `src/core/PhysicalCableSolver.js`, `src/core/physics-world/*`, `manifest.js`, `firestore.rules`, `firestoreSanitize.js`, `localDataStore.js`). Mọi hàm mới tách gọn vào module `<250` dòng (`@purpose`).
2. **Lưu ý về FIX 4 & Golden Tests cũ:**
   - Hai bài test cũ (`test/dnv_four_point_lift.test.js` & `test/rigging_physics_and_alarms.test.js`) hiện kiểm tra `passive === 0` (quy tắc cứng tuyệt đối `100/0/100/0`). Theo FIX 4, khi dầm/hệ có độ mềm xoắn (`GJ > 0` / cáp có độ giãn trục `EA > 0`), thuật toán sẽ tính chia tải đàn hồi không ép `0t` (ra tỷ lệ lệch tự nhiên như `~35%/15%/35%/15%` tùy chênh dài & độ cứng dầm), và chỉ giữ trường hợp `beamGJ = 0, cableEA = Infinity` cho kịch bản cứng lý tưởng thuần túy nếu gọi tường minh; cập nhật bộ số test để kiểm chứng phân bố đàn hồi `> 0` trên cả 4 nhánh khi `GJ > 0` & `EA > 0`.

## 2. File CẤM đụng
`src/core/standards/*`, `src/core/DeformableSteelStructure.js`, `src/core/PhysicalCableSolver.js`, `src/core/CraneLoadChartEngine.js`, `src/core/GroundPressureEngine.js`, `src/core/physics-world/*`, `src/sim/manifest.js`, `src/utils/firestoreSanitize.js`, `src/utils/localDataStore.js`, `firestore.rules`.

---

## CÁC BƯỚC THỰC HIỆN TUẦN TỰ (chạy 1 mạch từ đầu đến hết, mỗi bước xong: `vitest` + `architecture:gate` → tick `[x]` → `git commit` → làm tiếp)

### [x] Bước 1: Tạo Helper Đồng Bộ Cây & Thống Nhất Công Thức Góc Ngang `[0°..90°]` (FIX 1 + FIX 3 lõi)
- **Tạo mới:** `src/rigging/CableTelemetryMapper.js` (< 180 dòng, `@purpose: Chuẩn hóa dữ liệu telemetry từng nhánh cáp theo node.id/node.name cây phân cấp và công thức góc ngang [0°..90°]`):
  - `computeHorizontalSlingAngleDeg(topAnchor, bottomAnchor)`: tính đúng `dy = Math.abs(top.y - bot.y)`, `len = hypot(dx, dy, dz)`, `Math.max(0, Math.min(90, Math.asin(clamp(dy / len, 0, 1)) * 180 / Math.PI))` — tuyệt đối không bao giờ ra `<0°` hay `>90°`.
  - `buildHierarchicalCableSnapshots(phy, state, helpers)`: duyệt cây `phy.cables` theo `assignHierarchicalNames`, trả về danh sách/bản đồ tra cứu theo `node.id` & `node.name` gồm `{ id, name, parentId, parentName, tier, role, index, tensionT, angleDeg, lengthM, swlT, hardwareStress, slack, broken }`.
  - `formatSlingHudLabel({ snapshot, dOpt, lang })`: định dạng thống nhất **cùng một chuẩn hiển thị** cho cả Tầng Trên (`LP1`, `LP2`) lẫn Tầng Dưới (`LP11`, `LP12`...): `Name · TensionT · Angle° · SH(Pin/Bow): XX% · L: X.Xm`.
- **Sửa (≤ 25 dòng/file):**
  - `src/rigging/index.js`: export `CableTelemetryMapper.js`.
  - `src/rigging/RiggingPhysicsSolver.js`: thêm/dùng `computeHorizontalSlingAngleDeg` cho `computeSlingAngle3D`, đảm bảo luôn kẹp `[0, 90]`.
  - `src/graphics/SlingAngleGizmo.js`: sửa `computeSlingAngleArcData` tính bằng `Math.asin(clamp(|dy| / len, 0, 1))` và kẹp `[0, 90]`.
- **Kiểm tra:** `npx vitest run test/hierarchical_naming.test.js test/sling_angle_gizmo.test.js` + `npm run architecture:gate`.

### [x] Bước 2: Sửa Góc Ngang & Đánh Giá Ma Ní Đầy Đủ Cho Mọi Tầng Cáp Trong Physics Sync (FIX 2 + FIX 3 runtime)
- **Sửa (≤ 25 dòng/file):**
  - `src/sim/physics/cables_break.js`:
    - Trong `publishXpbdLoads()` (~dòng 1281–1385): tính `horiz` trực tiếp từ hai đầu `attachWorld(c.a)` và `attachWorld(c.b)` qua `computeHorizontalSlingAngleDeg` (lưu `c.angleDeg = horiz`, gán `phy.legAngleDeg`, `phy.upperAngleDeg`, `phy.hangerAngleDeg`); chạy `evaluateShackleComponentLoad` cho **cả `upper`, `hanger`, lẫn `leg`** để tầng trên luôn có `c._hardwareStress` (`Bow`/`Pin`, `%SWL`); kẹp `phy.maxAngleVert` chặt trong `[0, 90]`.
    - Trong `publishCableLoads()` (~dòng 1405 & 1455–1488): sửa lỗi thiếu `Math.abs` ở dòng 1405 (`horiz` luôn dương `[0, 90]`), tính luôn `phy.upperAngleDeg[i]` & kẹp `phy.maxAngleVert` trong `[0, 90]`.
- **Kiểm tra:** `npx vitest run test/rigging.test.js test/custom_slings.test.js test/compliance*` (hoặc toàn bộ unit test liên quan) + `npm run architecture:gate`.

### [x] Bước 3: Khôi Phục Liên Kết Cây & UI Parity Đầy Đủ Cho Tầng Trên Trên Màn Hình 3D + Bảng HUD (FIX 1 + FIX 2 UI)
- **Sửa (≤ 25 dòng/file):**
  - `src/sim/telemetry.js`:
    - Trong `noteSlingAngle` (~dòng 105), dòng 214–215, 309–314, 351–353: dùng `computeHorizontalSlingAngleDeg` và kẹp `[0, 90]` ở mọi nơi hiển thị góc (`#hud-beta`, `#out-angle-vert`, `#out-angle-horiz`, `#lbl-hook`).
    - Ở phần render nhãn 3D & bảng thanh lực căng (~dòng 541–627): chuyển sang dùng `RIG.buildHierarchicalCableSnapshots(phy, state, ...)` + `RIG.formatSlingHudLabel(...)` tra cứu theo `node.id` / `node.name` — đồng bộ nhãn `#leg-lbl-0..3` sang tên cây thực tế (`LP11..LP22`), dùng chiều dài thực `snapshot.lengthM` của từng nhánh (hết dùng `state.slingLength` chung), và render **đầy đủ 4 thông số** (`LP1: 17.8T · 54° · L: 8.0m · SH(Bow): 75%`) cho **cả cáp Tầng Trên (`topPool`) lẫn Tầng Dưới (`lbl-t0..t3` / mở rộng >4 nhánh nếu có)**!
- **Kiểm tra:** `npx vitest run test/hierarchical_naming.test.js test/rigging.test.js test/telemetry_usage.test.js` + `npm run architecture:gate`.

### [ ] Bước 4: Nâng Cấp Phân Bố Lực Đàn Hồi 4 Điểm Theo Độ Cứng Dọc Trục Cáp (`EA`) & Độ Cứng Xoắn Dầm (`GJ`) (FIX 4)
- **Tạo mới:** `src/rigging/ElasticFourPointSolver.js` (< 180 dòng, `@purpose: Giải cân bằng tương thích biến dạng đàn hồi 4 nhánh (EA cáp + xoắn Saint-Venant GJ dầm/kiện) thay cho ép 100/0/100/0 cứng`):
  - `computeCableAxialCompliance({ L0, diameterMm, material, dt })`: tính tham số mềm XPBD `alpha = L0 / (E * A * dt^2)` từ mô-đun Young thực (`CableDynamicsXPBD` profiles).
  - `solveElasticFourPointDistribution({ totalLoadT, cogShares, legLengthsM, beamGJ, cableEA, lugSpanM, widthM })`: giải cân bằng lực đàn hồi kết hợp kéo dọc trục `EA` và góc xoắn dầm `φ = M_x * L / GJ` — khi dầm/cáp có tính đàn hồi (`GJ > 0, EA > 0`), 2 nhánh chéo ngắn hơn chịu tỷ lệ cao hơn nhưng 2 nhánh còn lại **tự căng và gánh tải thực (> 0t)**, tự nhiên ra phân bố lệch (vd ~35%–15%–35%–15%) phụ thuộc dung sai chiều dài và độ cứng dầm, tuyệt đối không hardcode.
  - `applyXpbdBeamTorsionalCoupling(beamBody, cables, dt)`: hàm hỗ trợ bổ sung mô-men hồi phục xoắn & tương tác góc xoắn trong vòng lặp XPBD (`beams_seed.js`).
- **Sửa (≤ 25 dòng/file):**
  - `src/rigging/index.js`: export `ElasticFourPointSolver.js`.
  - `src/rigging/DnvFourPointLift.js`: tích hợp `solveElasticFourPointDistribution` vào `resolveFourLegDiagonalLoad` khi có độ cứng xoắn/đàn hồi (mặc định bật `elasticTorsion: true` với tham số thép công nghiệp hoặc nhận `beamGJ` / `cableEA` thực tế; chỉ về rigid `0t` nếu caller truyền tường minh `elasticTorsion: false, isRigid: true`).
  - `src/rigging/RiggingPhysicsSolver.js`: truyền `beamGJ` & `cableEA` thực của cấu hình hiện tại vào `resolveFourLegDiagonalLoad`, ưu tiên lực XPBD đàn hồi hữu cơ thay vì ép `0t` lên 2 nhánh.
  - `src/sim/physics/beams_seed.js` (~dòng 2485–2505): đưa độ mềm dọc trục XPBD `alpha_EA` vào `wSum` của `phy.cables` + ghép cặp xoắn đàn hồi `GJ` của `phy.beams` trong vòng giải XPBD để cả 4 dây cùng tham gia chịu lực một cách tự nhiên theo vật lý thực.
- **Cập nhật & tạo test:**
  - `test/elastic_four_point_torsion.test.js`: test mới kiểm chứng khi có chênh chiều dài cáp + dầm có `GJ` & cáp có `EA`, lực phân bố bất đối xứng hợp lý (tổng = tải + cả 4 nhánh đều > 0, độ lệch tăng giảm tỷ lệ thuận với `GJ` và chênh chiều dài), KHÔNG ép `0t` và KHÔNG hardcode.
  - Cập nhật `test/dnv_four_point_lift.test.js` & `test/rigging_physics_and_alarms.test.js` phù hợp quy tắc Elastic 4-Point (giữ kiểm chứng trường hợp thuần cứng khi tắt đàn hồi và kiểm chứng chia tải thực `> 0` khi bật đàn hồi `GJ/EA`).
- **Kiểm tra:** `npx vitest run test/elastic_four_point_torsion.test.js test/dnv_four_point_lift.test.js test/rigging_physics_and_alarms.test.js test/cog_tilt_stability.test.js`.

### [ ] Bước 5: Nghiệm Thu Toàn Diện & Báo Cáo Xác Minh UI Binding
- Chạy `npx vitest run` (toàn bộ ~61 file test), `npm run architecture:gate`, `npm run build`, `npm run check:dist`, `npx playwright test e2e/saas-accessibility.spec.js --project=fhd-1080p`, `./scripts/auto_check.ps1`.
- Đặt `Trạng thái: DONE` trong `PLAN.md`, chạy `./scripts/auto_log.ps1`, cập nhật `auto_memory/CONTEXT.md`, commit sạch tại chỗ và báo cáo danh sách file + bằng chứng test chi tiết cho Founder.
