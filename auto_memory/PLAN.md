# KẾ HOẠCH NÂNG CẤP CHUYÊN SÂU: TIẾP XÚC BỀ MẶT 3D THẬT (0MM KHE HỞ), KẾT CẤU DẦM CHỮ H, CHUẨN HÓA NGÁNG CẨU STS ISO 1161/668 & VẬT LÝ ĐỨT CÁP THỰC TẾ (ACTIVE)

- **Trạng thái:** `ACTIVE`
- **Ngày lập:** 2026-04-20
- **Phân loại:** **VIỆC LỚN** (nâng cấp chuyên sâu 6 vấn đề cốt lõi về hình học 3D, va chạm tiếp xúc bề mặt cong/mesh thực, biến dạng kết cấu dầm nâng, kích thước & cơ chế vận hành ngáng cẩu cảng STS theo chuẩn quốc tế ISO 668 / ISO 1161, và động lực học cáp/xích khi cắt).
- **Nhánh thực thi:** `feat/true-rigging-sts-contact-upgrade` (tự tạo bởi `scripts/auto_backup.ps1`).

---

## 1. CHẨN ĐOÁN NGUYÊN NHÂN GỐC RỄ (TỪ 5 ẢNH CHỤP MÀN HÌNH THỰC TẾ)

1. **Vấn đề 1 — Sợi xích/cáp ôm kiện 3D luôn có "khoảng mờ vô hình", không chạm sát mặt 3D của kiện (Ảnh 2 - Bồn cầu trắng):**
   - **Nguyên nhân gốc:** Trong `src/sim/rigging/hook_pool.js`, hàm `cargoWrapSolid(pad)` (dòng 1763–1865) và `cargoLocalRoofY(lx, lz, pad)` (dòng 1868–1957) chỉ có nhánh xử lý riêng cho `flatrack`, `opentop`, `platform` và `vessel`/`pipe`. Với tất cả các kiện 3D khác (`spherical_tank` bồn cầu, máy biến áp, tua-bin, tàu, xe, hoặc kiện CAD 3D trong `customCargoMeshes`), hệ thống biến toàn bộ kiện thành **một hộp chữ nhật vô hình (`AABB: L/2 × H/2 × W/2`)**! Do đó sợi xích bị ép đi vòng qua "góc hộp chữ nhật trong suốt" lơ lửng ngoài không trung thay vì ôm sát vào mặt cong hình cầu/hình trụ của kiện.
   - Chưa hết, `cargoWrapSolid(pad)` đã cộng sẵn `+ p` (`2–3 cm`) vào `solid.hx/hy/hz/roofY`, sau đó `ejectFromCargoSolid` và `liftRopeOntoCargoRoof` lại cộng thêm `+ p` lần thứ 2 (**lỗi cộng đúp đệm `double-padding`**), tạo ra khe hở 5–8 cm ngay cả trên mặt phẳng. Ngoài ra, ở `src/sim/rigging/draw_update.js` (dòng 312–339), khi cáp căng (`physicallyTaut = true`), đường cáp nối thẳng `rawPts = [pointA, end]` bỏ qua bước trượt ôm sát bề mặt 3D thực.

2. **Vấn đề 2 — Dầm ngang chữ H màu vàng bị lòi hàng loạt thanh màu đen ra phía dưới bụng dầm khi cẩu (Ảnh 3):**
   - **Nguyên nhân gốc:** Trong `src/sim/gear/editor.js` (dòng 2341–2372, nhánh `beamType === 'lifting_beam'`), thân dầm vàng (`web`, `topFlange`, `botFlange`) được tạo bằng `new THREE.BoxGeometry(main.length, ...)` với số đoạn chia dọc mặc định `widthSegments = 1` (chỉ có đúng 2 đầu mút $x = \pm L/2$, không có đỉnh lưới nào ở giữa nhịp!). Trong khi đó, các gân tăng cứng màu đen (`rib`, dùng `MATS.darkSteel`) là các khối rời rạc đặt dọc theo thân dầm từ $-L/2$ đến $+L/2$.
   - Khi `stepStructuralDeformation` (`src/sim/physics/beams_seed.js` dòng 2810–2829) gọi `applyMeshDeformation` để uốn cong dầm theo hàm $\sin(\pi \xi)$, vì thân dầm vàng chỉ có đỉnh ở $\xi=0$ và $\xi=1$ ($\sin(0)=\sin(\pi)=0$) nên **cây dầm vàng đứng im thẳng tắp, còn hàng chục thanh gân đen ở giữa nhịp bị đẩy tụt xuống dưới 0.3–0.5m thành hình sóng răng cưa lòi ra ngoài đáy dầm!** Đồng thời hệ số $I_{\text{beam}} = 1.0 \times 10^{-4}\text{ m}^4$ đang đặt quá nhỏ làm độ võng bị phóng đại quá mức.

3. **Vấn đề 3 — Ngáng cẩu Container STS (`container_spreader`) to phình vượt ra ngoài kích thước Container và lệch tâm lỗ gù ISO (Ảnh 1, 4, 5):**
   - **Nguyên nhân gốc:** Trong `src/sim/gear/editor.js` (dòng 2154–2183, hàm `fitCadToIso` trong `rebuildSpreaderVisuals`), hàm `measureStsCadTwistlockSpan(cad)` đo khoảng cách trung bình các đỉnh của nhóm chốt gù nội bộ (`pins.spanZ` nhỏ hơn bề rộng dầm đầu), rồi lấy `targetSpanZ / pins.spanZ` để phóng to toàn bộ khung CAD màu vàng lên tới ~3.1–3.3m (trong khi bề rộng chuẩn quốc tế ISO 668 của container chỉ là **2.438m**!). Nghiêm trọng hơn, dòng 2177–2183 lại gọi `fitCadToIso()` chồng lần thứ 2 sau khi đã dịch tâm `cad.position`, làm khung ngang STS phình to tràn ra ngoài thành container cả nửa mét.

4. **Vấn đề 4 & 5 — Cắt cáp trên STS Spreader bị phóng tia đỏ nhọn hoắt lên trời (Ảnh 1, 5) hoặc văng chuỗi xích đứt nét ngang ra ngoài (Ảnh 4), không tuân theo vật lý:**
   - **Nguyên nhân gốc:** Trong `src/sim/telemetry.js` (dòng 133–134), cáp đứt được vẽ bằng 2 lệnh `paintSling`: nửa trên (`brokenHalf: 'upper'`, từ chốt trên `A` đến `br.tipU`) và nửa dưới (`brokenHalf: 'lower'`, từ chốt kiện hàng `B` đến `br.tipL`).
   - Thế nhưng hàm `stepBrokenWhipPath` trong `src/rigging/RigidInertialDynamics.js` (dòng 184–199) lại truyền `(pointA, end)` vào `BrokenCableWhipSimulator.step(dt, upperAnchor, lowerAnchor)` như thể `pointA` luôn là chốt trên và `end` luôn là chốt dưới! Với nửa dưới (`brokenHalf: 'lower'`), `this.lower` bị gắn neo vào đầu mút tự do `end` và `injectWhip(this.lower, +1)` bắn toàn bộ các nút ở giữa `pts[1..N-1]` **vọt ngược lên trời 4–5 mét** với vận tốc `MAX_RECOIL_SPEED = 35 m/s`! Sau đó `src/sim/rigging/draw_update.js` (dòng 384–388) lại cưỡng bức kéo điểm cuối `pts[N].y = pointA.y - 0.06` về sát góc container, tạo thành **cây kim đỏ khổng lồ đâm thẳng lên trời 5 mét rồi gập ngược về góc container** (Ảnh 1 & 5) hoặc vòng xích bay ngang (Ảnh 4)!
   - Ngoài ra, trong `src/rigging/BrokenCableWhipXPBD.js` (dòng 185–193), hàm `solveDistancePass` dịch chuyển `positions` mà không cập nhật `previous`, gây nổ vận tốc giả tạo ở bước con tiếp theo.

5. **Vấn đề 6 — Thao tác kéo của Ngáng STS khi gắp trực tiếp (Twistlock) hoặc dùng cáp/xích chưa đúng chuẩn vận hành thực tế:**
   - **Nguyên nhân gốc:**
     - Cụm Headblock trên lưng ngáng STS (`updateStsHeadblockVisual` trong `src/sim/cargo/specialty_meshes.js` dòng 1576–1610) chỉ vẽ 8 đoạn cáp cụt ngủn dài 0.30m (`y = 0.48..0.78m`) lơ lửng giữa trời thay vì nối thẳng lên cụm puly/trolley (`phy.hookPos`).
     - Ở chế độ gắp trực tiếp (`direct`), `enforceStsDirectTwistlockCouple` (`src/sim/physics/beams_seed.js` dòng 2911–2957) khóa cứng góc nghiêng bằng `0.0` (không phản ánh độ nghiêng đàn hồi 0.5°–3.5° của hệ cáp tời khi container lệch trọng tâm CoG), và khi hạ/nhớm chưa khớp mượt mặt phẳng đáy dầm đầu STS với mặt nóc gù ISO.
     - Ở chế độ dùng cáp (`cable`) cho hàng siêu trường OOG / container hỏng gù, 4 nhánh cáp/xích treo từ 4 tai cẩu dưới gầm dầm đầu STS xuống 4 lỗ gù container phải có khớp ma-ní thực tế tại đúng tọa độ chuẩn ISO ($\pm \text{halfSpanX}, \pm \text{halfSpanZ}$) và khi cắt 1 sợi thì tải trọng dồn sang các sợi còn lại làm nghiêng kiện hàng + ngáng STS theo đúng mô-men lực thực tế.

---

## 2. GIẢ ĐỊNH KỸ THUẬT & NGUYÊN TẮC THIẾT KẾ

- **Tiếp xúc 1:1 (Zero Air-Gap, Zero Interpenetration):** Khoảng cách từ tâm sợi cáp/mắt xích đến bề mặt thực 3D của kiện hàng bằng đúng bán kính ngoài vật lý của sợi cáp/xích ($r_{\text{contact}} = d_{\text{rope}}/2$ với cáp/bản vải, hoặc $r_{\text{chain}} = 1.65 \times d_{\text{nom}}$ với mắt xích 3D), **chỉ tính 1 lần duy nhất**, tuyệt đối không cộng đúp `pad`.
- **Quét bề mặt thực 3D (`TrueMeshSurfaceContact`):** Kết hợp giải tích chính xác cho các mặt cong kỹ thuật (`spherical_tank` hình cầu + chân đế, `vessel`/`pipe`/`isotank` hình trụ + chỏm cầu, `wind_nacelle`, `transformer`) và bản đồ độ cao/vỏ bán kính lấy mẫu bằng Raycast trực tiếp trên `activeCargoVisual` (`bakeCargoSurfaceField`) cho mọi kiện 3D phức tạp hoặc mô hình CAD nhập ngoài.
- **Chuẩn quốc tế ISO 668 & ISO 1161 cho Ngáng STS (`StsSpreaderRealism`):**
  - Bề rộng phủ bì khung ngáng STS chuẩn: $W_{\text{outer}} = 2.438\text{ m}$ (khớp 1:1 bề rộng container ISO).
  - Chiều dài phủ bì khung ngáng STS chuẩn: $6.058\text{ m}$ (20ft), $12.192\text{ m}$ (40ft), $13.716\text{ m}$ (45ft), hoặc co giãn telescopic khớp đúng chiều dài container hiện tại.
  - Tâm lỗ gù Twistlock & tai cẩu góc theo ISO 1161: cách mép đầu $0.1035\text{ m}$ ($X = \pm (L/2 - 0.1035)$) và cách mép hông $0.0895\text{ m}$ ($Z = \pm (W/2 - 0.0895)$, tức khoảng cách ngang tâm-tới-tâm $= 2.259\text{ m}$ trên container rộng $2.438\text{ m}$).
  - 4 chân dẫn hướng màu đỏ (Flippers / Gather Guides) ôm sát mép ngoài 4 góc container.
- **Tuân thủ tuyệt đối Luật V7:**
  - Không đụng bất kỳ file `[LOCKED]` nào (kể cả `src/core/DeformableSteelStructure.js`).
  - Mọi file tạo mới phải `< 240` dòng và bắt đầu bằng `// @purpose: ...`.
  - Với các file cũ `⚠️>300` dòng (`hook_pool.js`, `draw_update.js`, `editor.js`, `beams_seed.js`, `shell_rebuild.js`, `specialty_meshes.js`), chỉ sửa tại chỗ hoặc gọi hàm từ module mới, tuyệt đối không nhồi thêm $>25$ dòng vào file cũ.

---

## 3. CÁC BƯỚC THỰC THI CHI TIẾT (CHẠY MỘT MẠCH TỪ BƯỚC 1 ĐẾN BƯỚC 6)

### Bước 1: Xây dựng Bộ giải Tiếp xúc Bề mặt 3D Thực (`src/rigging/TrueMeshSurfaceContact.js`)
- [x] **Trạng thái:** Hoàn tất (`220` dòng, `architecture:gate`, `vite build`, `auto_check.ps1` xanh)
- **Mục tiêu:** Tạo module độc lập tính toán bề mặt thực 3D của mọi loại kiện hàng (hình cầu, hình trụ, máy móc, kiện 3D đa giác bất kỳ) để cáp và xích chạm sát 1:1 vào vỏ 3D của kiện mà không bị kênh trên hộp chữ nhật vô hình và không xuyên qua kiện.
- **File được phép tạo/sửa (tối đa 2 file):**
  1. `src/rigging/TrueMeshSurfaceContact.js` *(tạo mới, `< 240` dòng, có dòng đầu `// @purpose: Bộ giải tiếp xúc bề mặt 3D thực (0mm khe hở, không xuyên thủng) cho cáp và xích ôm sát kiện hàng 3D`)*:
     - Hàm `bakeCargoSurfaceField(cargoVisual, dims, cargoType)`: Quét lưới tia (Raycaster 6 hướng + trụ/cầu) trên `cargoVisual` (bỏ qua các mesh phụ như `cogMarker`, `label`, `outline`) để lưu bản đồ bề mặt 3D thực `surfaceField` (gồm bán kính cầu/trụ thực tế từ mesh và lưới cao độ/vỏ ngang `gridY`, `gridZ`, `gridX`).
     - Hàm `sampleTrueCargoRoofY(lx, lz, pad, cargoType, dims, surfaceField)`: Trả về cao độ mặt trên thực tế tại `(lx, lz)` + đúng 1 lần bán kính `pad` (hỗ trợ chính xác mặt cầu `spherical_tank`, trụ nằm `vessel`/`pipe`/`isotank`, hộp giật cấp, và `surfaceField` raycast).
     - Hàm `projectPointOntoTrueCargoSurface(localPt, pad, cargoType, dims, surfaceField)`: Đẩy điểm nằm trong lòng kiện ra đúng mặt ngoài 3D thực + `pad` theo pháp tuyến ngắn nhất (mặt cầu: đẩy theo bán kính tâm cầu $R + \text{pad}$; mặt trụ: đẩy theo bán kính trụ $R + \text{pad}$; mặt mesh: đẩy theo `surfaceField`).
     - Hàm `conformPathToTrueCargoSurface(localPts, pad, cargoType, dims, surfaceField, isTaut)`: Chia mịn đoạn dây đi qua vùng kiện hàng và ép đường cáp/xích trượt sát trên mặt cong 3D thực (kể cả khi cáp đang căng `isTaut` nhưng đường nối thẳng cắt qua bụng quả cầu/thân bồn trụ!).
  2. `src/rigging/index.js` *(sửa $\le 8$ dòng)*: Export các hàm của `TrueMeshSurfaceContact.js`.
- **File CẤM đụng:** Toàn bộ `src/core/**` (`[LOCKED]`).
- **Cách kiểm tra:** `npm run build` && `./scripts/auto_check.ps1` xanh.

---

### Bước 2: Đấu nối Tiếp xúc Ôm sát Bề mặt 3D vào Hệ thống Dựng Kiện & Vẽ Cáp/Xích (`shell_rebuild.js`, `hook_pool.js`, `draw_update.js`)
- [ ] **Trạng thái:** Chưa làm
- **Mục tiêu:** Xóa bỏ hoàn toàn khoảng mờ vô hình và lỗi cộng đúp `pad` khi xích/cáp ôm vào bồn cầu, bồn trụ, container và các kiện 3D.
- **File được phép sửa (tối đa 3 file):**
  1. `src/sim/cargo/shell_rebuild.js` *(sửa $\le 12$ dòng)*:
     - Import `bakeCargoSurfaceField` từ `../../rigging/TrueMeshSurfaceContact.js`.
     - Ngay sau khi tạo `activeCargoVisual` trong `rebuildCargoAndRig`, gọi `activeCargoVisual.userData.trueSurfaceField = bakeCargoSurfaceField(activeCargoVisual, ST.dims, ST.cargo)` để lưu bản đồ bề mặt 3D thực.
  2. `src/sim/rigging/hook_pool.js` *(sửa $\le 20$ dòng)*:
     - Import `sampleTrueCargoRoofY`, `projectPointOntoTrueCargoSurface`, `conformPathToTrueCargoSurface` từ `../../rigging/TrueMeshSurfaceContact.js`.
     - Trong `cargoLocalRoofY(lx, lz, pad)` và `pushOutOfCargoShellLocal(localPt, pad)`: gọi thẳng `sampleTrueCargoRoofY` và `projectPointOntoTrueCargoSurface` với `activeCargoVisual?.userData?.trueSurfaceField`, giúp bồn cầu (`spherical_tank`) và mọi kiện 3D có bề mặt cong chính xác 100%.
     - Trong `ejectFromCargoSolid`, `liftRopeOntoCargoRoof` và `routeRopeAroundCargo`: truyền `0` vào lời gọi phụ khi `solid` đã mang sẵn `pad` (xóa bỏ hoàn toàn lỗi cộng đúp `pad + p` gây hở 5–8cm) và gọi `conformPathToTrueCargoSurface` ở cuối bước định tuyến để sợi xích/cáp ôm khít mặt cầu/trụ.
  3. `src/sim/rigging/draw_update.js` *(sửa $\le 18$ dòng)*:
     - Khi tính `simPad` cho xích/cáp (`line 301`): dùng đúng bán kính tiếp xúc thực của mắt xích (`chainRadius = (slingObj.nomDia || 0.024) * 1.35`) hoặc bán kính cáp (`ropeRadius = (slingObj.nomDia || 0.024) * 0.55`), không cộng dư.
     - Trong nhánh `physicallyTaut` (`lines 312–335`): nếu đoạn thẳng `pointA -> end` đi xuyên qua vỏ 3D của kiện hàng (như khi tai cẩu nằm dưới bụng bồn cầu ở Ảnh 2), tự động chạy qua `conformPathToTrueCargoSurface` để sợi xích khi kéo căng vẫn **ôm sát dọc theo đường kinh tuyến của mặt cầu/mặt trụ** thay vì cắt xuyên qua hoặc bay lơ lửng ngoài khoảng không!
- **File CẤM đụng:** Toàn bộ `src/core/**` (`[LOCKED]`).
- **Cách kiểm tra:** `npm run build` && `./scripts/auto_check.ps1` xanh.

---

### Bước 3: Sửa triệt để lỗi Dầm ngang chữ H lòi các thanh đen ra ngoài bụng dầm khi chịu tải (`editor.js`, `beams_seed.js`)
- [ ] **Trạng thái:** Chưa làm
- **Mục tiêu:** Làm cho toàn bộ dầm nâng chữ H màu vàng (`web`, `topFlange`, `botFlange`) và các gân tăng cứng màu đen (`rib`) uốn cong đồng bộ 100% như một khối thép liền mạch, không bao giờ có thanh đen nào lòi ra khỏi đáy dầm.
- **File được phép sửa (tối đa 2 file):**
  1. `src/sim/gear/editor.js` *(sửa $\le 18$ dòng tại nhánh `beamType === 'lifting_beam'`, dòng 2341–2372)*:
     - Tăng số đoạn lưới dọc `widthSegments = 32` cho cả 3 bộ phận chính của dầm chữ H:
       - `web`: `new THREE.BoxGeometry(main.length, 0.28, 0.028, 32, 1, 1)`
       - `topFlange`: `new THREE.BoxGeometry(main.length, 0.032, 0.24, 32, 1, 1)`
       - `botFlange`: `new THREE.BoxGeometry(main.length, 0.032, 0.24, 32, 1, 1)`
     - Thu gọn chiều cao và bề rộng của các thanh gân tăng cứng `rib` (`new THREE.BoxGeometry(0.016, 0.244, 0.21, 1, 1, 1)`) để chúng nằm lọt hoàn toàn bên trong lòng bụng chữ H (giữa `topFlange` ở $+0.155\text{ m}$ và `botFlange` ở $-0.155\text{ m}$), không bao giờ thò đầu đen ra khỏi mép cánh dầm.
  2. `src/sim/physics/beams_seed.js` *(sửa $\le 18$ dòng tại `stepStructuralDeformation`, dòng 2775–2829)*:
     - Tính mô-men quán tính tiết diện thực tế $I_{\text{beam}}$ theo tải trọng định mức `swl` và chiều dài dầm (`I_beam = Math.max(8.5e-4, span * span * (topBeam.swl || 30) * 1.2e-6)`) thay vì hằng số `1.0e-4` quá yếu, và giảm hệ số phóng đại trực quan `visualExaggeration` xuống mức hợp lý (`3.0` thay vì `15.0`) để độ võng của dầm thép công nghiệp chuẩn xác, vừa mắt và các thanh gân không bao giờ bị biến dạng lệch pha khỏi cánh dầm.
- **File CẤM đụng:** `src/core/DeformableSteelStructure.js` (`[LOCKED]`).
- **Cách kiểm tra:** `npm run build` && `./scripts/auto_check.ps1` xanh.

---

### Bước 4: Sửa lỗi Cắt cáp phóng tia đỏ lên trời / văng xích ngang & Chuẩn hóa Vật lý Đứt cáp (`BrokenCableWhipXPBD.js`, `RigidInertialDynamics.js`, `draw_update.js`)
- [ ] **Trạng thái:** Chưa làm
- **Mục tiêu:** Chấm dứt 100% hiện tượng tia đỏ bắn vọt lên trời (Ảnh 1, 5) và chuỗi xích bay ngang (Ảnh 4) khi bấm nút Cắt cáp; mô phỏng đúng vật lý thực tế của cáp thép và xích thép khi đứt (thu hồi đàn hồi nhẹ dọc trục rồi rơi thẳng xuống theo trọng lực $9.81\text{ m/s}^2$, rũ dọc dưới chốt treo hoặc nằm gọn trên nóc container/mặt đất).
- **File được phép sửa (tối đa 3 file):**
  1. `src/rigging/BrokenCableWhipXPBD.js` *(sửa $\le 45$ dòng)*:
     - Bổ sung phương thức `stepSingleStub(dt, anchorPos, freeTipHint, isUpperStub)` cho một nửa cáp đứt độc lập: nút `0` neo cố định tại `anchorPos` (`pointA`), các nút `1..N` khởi tạo thẳng hàng từ `anchorPos` tới `freeTipHint` (tại thời điểm cắt), với vận tốc thu hồi ban đầu thực tế (`recoilSpeed = Math.min(3.5, ...)` thay vì `35 m/s`!).
     - Trong `solveDistancePass`: sau khi dịch `positions[i]` và `positions[i+1]`, đồng bộ lại `previous[i]` theo hệ số giảm chấn dọc trục (`0.85`) để triệt tiêu hoàn toàn hiện tượng nổ vận tốc giả tạo của XPBD.
     - Thêm va chạm mặt phẳng nóc kiện hàng / mặt đất và lực cản không khí để nửa cáp dưới (`isUpperStub = false`) đổ gục tự nhiên xuống nóc container hoặc rũ xuống cạnh hông container, còn nửa cáp trên (`isUpperStub = true`) đong đưa nhẹ rồi treo thẳng đứng dưới ma-ní của dầm/spreader.
  2. `src/rigging/RigidInertialDynamics.js` *(sửa $\le 25$ dòng tại `stepBrokenWhipPath`, dòng 184–206)*:
     - Nhận thêm tham số `brokenHalf` (`'upper'` hoặc `'lower'`) và `gearType`.
     - Gọi `whip.stepSingleStub(1/60, pointA, end, brokenHalf !== 'lower')` để trả về đúng mảng các nút của nửa cáp đó (từ chốt neo `pointA` đến đầu đứt tự do), tuyệt đối không lấy nhầm `this.lower` gắn ngược chốt!
  3. `src/sim/rigging/draw_update.js` *(sửa $\le 16$ dòng tại nhánh `slingObj.broken`, dòng 357–392)*:
     - Truyền `slingObj.brokenHalf` vào `stepBrokenWhipPath`.
     - Xóa bỏ đoạn code cưỡng bức `pts[pts.length - 1].y = Math.min(..., pointA.y - 0.06)` (thủ phạm kéo gập đầu mút về góc container trong khi thân cáp đang ở trên trời tạo thành tia nhọn đỏ).
     - Pha trộn mượt (`lerp`) quỹ đạo hạt `whipPts` với đường cáp trọng trường `rawPts` (`pointA -> end`) để cả cáp thép lẫn mắt xích 3D rơi xuống và rũ tự nhiên 100%.
- **File CẤM đụng:** Toàn bộ `src/core/**` (`[LOCKED]`).
- **Cách kiểm tra:** `npm run build` && `./scripts/auto_check.ps1` xanh.

---

### Bước 5: Chuẩn hóa Thiết kế 3D & Cơ chế Kéo Thực tế của Ngáng Cẩu Container STS (`StsSpreaderRealism.js`, `editor.js`, `beams_seed.js`)
- [ ] **Trạng thái:** Chưa làm
- **Mục tiêu:**
  1. Đưa kích thước dài × rộng của Ngáng STS (`container_spreader`) về chuẩn quốc tế ISO 668 / ISO 1161: khung vàng vừa khít kích thước container ($2.438\text{ m}$ rộng), 4 chốt gù Twistlock và 4 ma-ní góc nằm đúng tâm lỗ gù góc container, 4 chân dẫn hướng màu đỏ (Flippers) ôm sát mép ngoài 4 góc container.
  2. Cụm Headblock & 8 sợi cáp tời đứng nối liền mạch từ lưng ngáng STS lên cụm puly/trolley phía trên (`phy.hookPos`).
  3. Thao tác kéo (Nhớm cáp, Nhấc thử, Kéo/Hạ tời, Cắt cáp) của STS đúng thực tế cảng biển ở cả 2 chế độ: **Gắp trực tiếp Twistlock (`direct`)** và **Treo cáp/xích (`cable`)**.
- **File được phép tạo/sửa (tối đa 3 file):**
  1. `src/rigging/StsSpreaderRealism.js` *(tạo mới, `< 240` dòng, có dòng đầu `// @purpose: Chuẩn hóa kích thước ISO 668/1161, hệ cáp tời 8 nhánh và cơ học nâng hạ thực tế cho Ngáng cẩu Container STS`)*:
     - Hàm `computeIsoContainerSpreaderSpec(cargoLength, cargoWidth)`: Trả về thông số chuẩn ISO 668 & ISO 1161 (`outerLength`, `outerWidth = Math.min(cargoWidth, 2.438)`, `pinSpanX = outerLength - 0.207`, `pinSpanZ = outerWidth - 0.179`, `halfX`, `halfZ`, `endBeamBottomY = -0.26`).
     - Hàm `calibrateStsCadToIsoEnvelope(cadGroup, spec)`: Đo chính xác bao hình khung dầm vàng chủ đạo của mô hình CAD STS (loại trừ phần vây nghiêng của 4 tai dẫn hướng đỏ), co giãn đúng **1 lần duy nhất** để khung dầm đầu vừa khít `spec.outerLength × spec.outerWidth`, căn tâm đối xứng hoàn hảo và đặt 4 chốt Twistlock / 4 ma-ní vào đúng tọa độ `(±spec.halfX, ±spec.halfZ)`.
     - Hàm `syncStsHeadblockHoistRopes(beamGroup, beamWorldPos, hookWorldPos)`: Cập nhật chiều dài và vị trí của 8 sợi cáp tời đứng trên cụm Headblock nối thẳng từ puly ngáng STS lên cao độ móc cẩu/trolley `hookWorldPos.y`, giúp khi bấm Kéo/Hạ tời nhìn thấy hệ cáp tời thu/nhả chuẩn xác như cẩu bờ STS ngoài cảng.
     - Hàm `solveStsDirectTwistlockPose(beamState, cargoDims, cogOffset, isGrounded, brokenCorners)`: Giải tư thế ghép nối cứng đàn hồi giữa ngáng STS và container khi gắp trực tiếp bằng 4 chốt Twistlock: mặt đáy dầm đầu STS áp khít mặt nóc gù container (`gap = 0mm`), khi nhấc khỏi đất nếu CoG lệch tâm hoặc bị cắt 1 góc chốt gù thì toàn khối (ngáng + container) nghiêng đàn hồi thực tế theo độ giãn hệ cáp tời 8 nhánh.
  2. `src/sim/gear/editor.js` *(sửa $\le 20$ dòng tại `rebuildSpreaderVisuals`, dòng 2099–2195)*:
     - Import `computeIsoContainerSpreaderSpec`, `calibrateStsCadToIsoEnvelope` từ `../../rigging/StsSpreaderRealism.js`.
     - Thay thế đoạn `fitCadToIso` bị gọi đúp gây phình kích thước bằng lời gọi duy nhất `calibrateStsCadToIsoEnvelope(cad, isoSpec)` và đặt `halfX = isoSpec.halfX`, `halfZ = isoSpec.halfZ`.
  3. `src/sim/physics/beams_seed.js` *(sửa $\le 22$ dòng tại `seatStsSpreaderToCargo`, `enforceStsSpreaderAsHeadblock`, `enforceStsDirectTwistlockCouple`)*:
     - Import và gọi `solveStsDirectTwistlockPose` và `syncStsHeadblockHoistRopes` từ `../../rigging/StsSpreaderRealism.js` để đồng bộ cả chế độ `direct` (gắp Twistlock sát nóc container, có nghiêng đàn hồi theo CoG/góc đứt) lẫn chế độ `cable` (treo 4 cáp/xích thẳng đứng từ 4 lỗ gù chuẩn ISO dưới ngáng STS xuống 4 lỗ gù container, hệ cáp tời 8 nhánh nối lên trolley).
- **File CẤM đụng:** Toàn bộ `src/core/**` (`[LOCKED]`).
- **Cách kiểm tra:** `npm run build` && `./scripts/auto_check.ps1` xanh.

---

### Bước 6: Kiểm thử Vàng Toàn diện 6 Vấn đề Thực tế & Nghiệm thu (`test/rigging_realism_sts_contact.test.js`)
- [ ] **Trạng thái:** Chưa làm
- **Mục tiêu:** Viết bộ kiểm thử tự động (Vitest) xác minh bằng con số toán học cả 6 yêu cầu nâng cấp của Founder.
- **File được phép tạo/sửa (tối đa 3 file):**
  1. `test/rigging_realism_sts_contact.test.js` *(tạo mới, `< 240` dòng, có dòng đầu `// @purpose: Bộ kiểm thử vàng xác minh tiếp xúc bề mặt 3D thực (0mm khe hở), kích thước STS chuẩn ISO 668/1161 và vật lý đứt cáp`)*:
     - **Test 1 (Ôm sát mặt cầu & mặt trụ 3D):** Kiểm tra `sampleTrueCargoRoofY`, `projectPointOntoTrueCargoSurface`, `conformPathToTrueCargoSurface` với bồn cầu (`spherical_tank`) và bồn trụ (`vessel`): mọi điểm trên đoạn xích/cáp ôm qua kiện có khoảng cách tới bề mặt 3D thực bằng đúng bán kính `pad` (sai số $< 1\text{ mm}$, không xuyên thủng, không bị kê lên góc hộp chữ nhật AABB).
     - **Test 2 (Chuẩn kích thước ISO 668 / ISO 1161 của Ngáng STS):** Kiểm tra `computeIsoContainerSpreaderSpec` và `calibrateStsCadToIsoEnvelope` với container 20ft và 40ft: bề rộng phủ bì khung ngáng đúng bằng $2.438\text{ m}$ (không phình to hơn container), tâm chốt gù khớp chuẩn ISO 1161 ($2.259\text{ m}$ ngang).
     - **Test 3 (Vật lý đứt cáp không bắn tia đỏ lên trời):** Kiểm tra `BrokenCableWhipSimulator.stepSingleStub` và `stepBrokenWhipPath` cho cả nửa trên (`upper`) và nửa dưới (`lower`): không có nút nào vọt cao hơn chốt neo trên quá $0.15\text{ m}$, sau $1.0\text{ s}$ trọng lực kéo đầu cáp đứt hạ thấp xuống ổn định, độ dài từng đoạn bảo toàn không bị kéo giãn thành tia nhọn.
     - **Test 4 (Cơ học ghép nối STS Direct Twistlock):** Kiểm tra `solveStsDirectTwistlockPose` khi CoG cân bằng và khi CoG lệch tâm / đứt 1 góc chốt.
  2. `auto_memory/PLAN.md` *(đánh dấu `[x]` toàn bộ 6 bước và chuyển `Trạng thái: DONE`)*.
  3. `STATE.md` *(cập nhật trạng thái hoàn tất nâng cấp)*.
- **File CẤM đụng:** Toàn bộ `src/core/**` (`[LOCKED]`).
- **Cách kiểm tra:** `npx vitest run` && `npm run build` && `./scripts/auto_check.ps1` xanh 100%.
