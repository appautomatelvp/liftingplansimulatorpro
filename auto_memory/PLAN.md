# KẾ HOẠCH (Model cao nhất lập Plan → Model thực thi chạy 1 mạch từ Bước 1 đến Bước cuối)
Trạng thái: DONE        <!-- NONE | ACTIVE | DONE -->

## Mục tiêu
Nâng cấp toàn diện **SafeLift3D** từ trình mô phỏng 3D cơ bản lên **Môi trường Mô phỏng Vật lý Thực & Đồ họa PBR Siêu thực (Hyper-Realistic True-Physics & Photorealistic PBR Sandbox)** theo 3 trụ cột của Master Directive:
1. **Pillar 1 — Va chạm Tuyệt đối & Không Xuyên Thủng (CCD & Material Contact):** Kiểm tra va chạm liên tục (Continuous Collision Detection — Swept Sphere/Capsule vs. OBB & Ground), giải va chạm hạt-đoạn giữa các sợi cáp/xích khác nhau (không bao giờ xuyên qua mắt xích của nhau), và áp dụng bảng hệ số ma sát ($\mu_s, \mu_d$) + độ nảy phụ thuộc khối lượng ($e(m)$) theo từng cặp vật liệu (`Thép-Thép`, `Thép-Gỗ`, `Thép-Bê tông`, `Đai vải-Thép`).
2. **Pillar 2 — Động lực học Vật rắn & Cáp mềm Liên tục (True Gravity $g = 9.81\text{ m/s}^2$, Inertia Tensor & XPBD Whip):** Mọi vật thể (từ kiện hàng 20–50 tấn, dầm ngang, ma ní đến đoạn cáp đứt) đều có khối lượng $m$, trọng tâm CoG, tensor quán tính 3 chiều dịch trục Steiner ($\mathbf{I}_{\text{ecc}}$) và chịu trọng trường $-9.81\text{ m/s}^2$ (tuyệt đối không lơ lửng khi mất liên kết). Khi cáp đứt dưới tải lớn, năng lượng đàn hồi tích trữ ($\frac{1}{2} T \Delta L$) giải phóng thành sóng quật/thu hồi đa điểm (Multi-Node XPBD Whip & Recoil) trước khi rơi và uốn vắt thực tế lên nóc hàng/mặt bãi.
3. **Pillar 3 — Đồ họa Vật liệu PBR Siêu thực & Hiển thị Ứng suất Căng (PBR Shading & Mechanical Stress Visualization):** Bổ sung bản đồ độ nhám (`roughnessMap`), kim loại (`metalnessMap`) và vết xước vi mô (`normalMap`) cho dầm thép sơn công nghiệp, xích/ma ní thép rèn mạ kẽm; nâng cấp phản xạ HDRI cảng công nghiệp và hiệu ứng hiển thị ứng suất cơ học thời gian thực (chuyển sắc cảnh báo tải trọng khi cáp/dầm tiến sát ngưỡng SWL/MBL).

## Giả định đã chọn (founder không cần trả lời)
- **Tuân thủ tuyệt đối Luật V7 & Physics Quarantine (`ADR-003`):** Không chạm vào bất kỳ file `[LOCKED]` nào (`src/core/physics-world/*`, `src/core/standards/*`, `src/core/PhysicalCableSolver.js`, `src/sim/manifest.js`, `firestore.rules`, `src/utils/*`).
- **Chống phình code (`< 250` dòng/module mới):** Toàn bộ thuật toán mới được tách thành 4 module độc lập dưới `240` dòng (`src/rigging/CollisionMaterialSolver.js`, `src/rigging/BrokenCableWhipXPBD.js`, `src/rigging/RigidInertialDynamics.js`, `src/graphics/pbr/StressPBRMaterials.js`). Đồng thời rút gọn `src/rigging/CableDynamicsXPBD.js` từ `310` dòng xuống `< 275` dòng để xóa cảnh báo `⚠️>300`.
- **Với các file runtime cũ `> 300` dòng (`cables_break.js`, `draw_update.js`):** Chỉ chèn `<= 18` dòng lệnh gọi hàm sang module mới, giữ nguyên 100% tương thích ngược với 308+ bài test hiện hành.

## Rủi ro & Biện pháp kiểm soát
- **Rủi ro 1 — Cáp đứt văng tốc độ cao xuyên qua nóc container hoặc sàn cảng:** Khắc phục bằng `resolveSweptSphereObbCCD` (chia nhỏ quãng đường di chuyển theo bán kính hạt cáp và đẩy ra khỏi mặt OBB gần nhất trước khi cập nhật vận tốc).
- **Rủi ro 2 — Hai nhánh xích/cáp đong đưa xuyên qua nhau:** Khắc phục bằng bộ giải `resolveInterCableCapsuleCollisions` dùng lưới băm không gian (Spatial Hash) kiểm tra khoảng cách tối thiểu $r_A + r_B$ giữa các hạt thuộc các sợi cáp khác nhau.
- **Rủi ro 3 — Thay đổi vật liệu dùng chung làm toàn bộ các cáp đổi màu cùng lúc khi 1 cáp quá tải:** Trong `StressPBRMaterials.js`, mỗi nhánh cáp khi bước vào vùng ứng suất cao ($T/\text{SWL} \ge 0.70$) sẽ dùng bản sao vật liệu nhẹ theo mức tải hoặc cập nhật màu sắc theo từng nhánh mà không làm bẩn vật liệu gốc trong `MATS`.

## Các bước (Model thực thi chạy tuần tự một mạch từ Bước 1 đến Bước cuối — tự kiểm tra + commit sau mỗi bước, KHÔNG dừng hỏi giữa chừng)

- [x] Bước 1: Xây dựng bộ giải Va chạm Liên tục (CCD), Ma sát cặp vật liệu ($\mu_s, \mu_d$), Độ nảy theo khối lượng ($e$) và Chống xuyên giữa các sợi cáp (`src/rigging/CollisionMaterialSolver.js`)
  - Sửa: `src/rigging/CollisionMaterialSolver.js` (tạo mới `< 240` dòng, mở đầu bằng `// @purpose:`), `src/rigging/index.js`
  - CẤM đụng: `src/core/physics-world/*`, `src/core/standards/*`, `src/sim/manifest.js`
  - Chi tiết:
    1. Định nghĩa `CONTACT_MATERIAL_PAIRS` cho `steel_on_steel` ($\mu_s = 0.58, \mu_d = 0.42$), `steel_on_wood` ($\mu_s = 0.48, \mu_d = 0.35$), `steel_on_concrete` ($\mu_s = 0.62, \mu_d = 0.48$), `web_on_steel` ($\mu_s = 0.32, \mu_d = 0.24$), `chain_on_steel` ($\mu_s = 0.55, \mu_d = 0.40$).
    2. Viết hàm `computeMassScaledRestitution(pairId, massKg, impactSpeedMps)`: kiện hàng nặng $\ge 5\,000\text{ kg}$ có độ nảy gần bằng 0 ($e \le 0.02$) kèm tính xung lực va đập `impactForceN` & `peakG`; phụ kiện thép nhỏ (ma ní, mắt xích, móc $< 80\text{ kg}$) có độ nảy kim loại thực tế ($e \approx 0.14\text{–}0.22$).
    3. Viết hàm `resolveSweptSphereObbCCD(prevPos, nextPos, radius, obbBoxes, groundY)` và `applyMaterialCoulombContact(vel, normal, pairId, massKg, dt)` để triệt tiêu hoàn toàn hiện tượng xuyên thủng (Zero Interpenetration) giữa dầm thép, kiện hàng, phụ kiện và mặt bãi.
    4. Viết hàm `resolveInterCableCapsuleCollisions(cablePointArrays, radiiArray, iterations = 2)` để các sợi cáp/xích khác nhau khi va đập phải bật/trượt khỏi nhau, không bao giờ cắt xuyên qua nhau.
  - Kiểm tra xong: `npm run architecture:gate && npm run build` xanh, `src/rigging/CollisionMaterialSolver.js` `< 240` dòng.

- [x] Bước 2: Nâng cấp Cơ học Cáp/Xích XPBD Liên tục & Hiệu ứng Quật/Thu hồi năng lượng đàn hồi khi đứt cáp (`src/rigging/BrokenCableWhipXPBD.js` & thu gọn `src/rigging/CableDynamicsXPBD.js`)
  - Sửa: `src/rigging/BrokenCableWhipXPBD.js` (tạo mới `< 230` dòng, mở đầu bằng `// @purpose:`), `src/rigging/CableDynamicsXPBD.js` (rút gọn từ 310 dòng xuống `< 275` dòng), `test/cable_dynamics_xpbd.test.js`
  - CẤM đụng: `src/core/PhysicalCableSolver.js`, `src/core/standards/*`
  - Chi tiết:
    1. Tách hằng số `CABLE_MATERIAL_PROFILES` và hàm tính năng lượng đàn hồi khi đứt `computeElasticSnapRecoil` sang `src/rigging/BrokenCableWhipXPBD.js` (và re-export từ `CableDynamicsXPBD.js` để giữ tương thích 100%).
    2. Xây dựng lớp `BrokenCableWhipSimulator` trong `BrokenCableWhipXPBD.js`: mô phỏng chuỗi hạt XPBD cho 2 nửa cáp sau khi đứt (`upper` và `lower`, hoặc đoạn cáp rời hoàn toàn khi tháo chốt `pinnedA = false, pinnedB = false`), truyền vận tốc phóng ngược dọc trục cáp + sóng quật ngang (whip oscillation), chịu trọng trường $g = -9.81\text{ m/s}^2$ và va chạm CCD với nóc kiện hàng + mặt đất.
    3. Bổ sung bài test trong `test/cable_dynamics_xpbd.test.js` kiểm chứng: (a) đoạn cáp tháo cả 2 chốt rơi tự do theo đúng $-9.81\text{ m/s}^2$, (b) sóng quật `BrokenCableWhipSimulator` khi cáp đứt ở tải lớn và (c) 2 sợi xích va nhau được đẩy tách không xuyên thủng.
  - Kiểm tra xong: `npx vitest run test/cable_dynamics_xpbd.test.js` xanh, `CableDynamicsXPBD.js` `< 275` dòng và `BrokenCableWhipXPBD.js` `< 230` dòng.

- [x] Bước 3: Xây dựng module Động lực học Quán tính Lệch tâm (`src/rigging/RigidInertialDynamics.js`) & Đấu nối CCD + Whip vào Vòng lặp Mô phỏng
  - Sửa: `src/rigging/RigidInertialDynamics.js` (tạo mới `< 220` dòng, mở đầu bằng `// @purpose:`), `src/sim/physics/cables_break.js` (thêm `<= 15` dòng gọi hàm), `src/sim/rigging/draw_update.js` (thêm `<= 18` dòng gọi hàm)
  - CẤM đụng: `src/sim/manifest.js`, `src/core/physics-world/*`
  - Chi tiết:
    1. Tạo `src/rigging/RigidInertialDynamics.js` cung cấp:
       - `computeEccentricInertiaTensor(massKg, dimsM, cogOffsetM)`: tính tensor quán tính chính 3 trục kèm định lý trục song song Steiner-Huygens cho trọng tâm lệch.
       - `computeAsymmetricRiggingTorque(anchorPointsWorld, tensionsN, cogWorld)`: tính lực kéo tổng hợp và mô-men quay làm nghiêng/xoắn kiện hàng khi CoG lệch tâm hoặc khi 1 nhánh cáp bị đứt.
       - `stepDetachedBodyUnderGravity(bodyState, dt, groundY, obbList, materialPairId)`: đảm bảo mọi vật thể/phụ kiện tách rời móc cẩu đều rơi ngay lập tức với $g = -9.81\text{ m/s}^2$ và dừng chuẩn xác trên bề mặt rắn.
    2. Trong `src/sim/physics/cables_break.js`: kết nối `settleBrokenTipOnSolids` với `resolveSweptSphereObbCCD` và `applyMaterialCoulombContact` để đầu cáp đứt trượt/nảy thực tế trên mái nghiêng của kiện hàng và mặt bãi.
    3. Trong `src/sim/rigging/draw_update.js`: dùng `BrokenCableWhipSimulator` cho nhánh cáp đứt và gọi `resolveInterCableCapsuleCollisions` giữa các sợi cáp đang hiển thị để không sợi nào xuyên qua sợi nào.
  - Kiểm tra xong: `npx vitest run test/physics_destruction.test.js test/solid_collision_and_settling.test.js test/solid_collision_and_sliding.test.js` xanh.

- [x] Bước 4: Nâng cấp Vật liệu PBR Siêu thực, HDRI Cảng Công Nghiệp & Hiển thị Ứng suất Căng Cơ học (`src/graphics/pbr/StressPBRMaterials.js`)
  - Sửa: `src/graphics/pbr/StressPBRMaterials.js` (tạo mới `< 230` dòng, mở đầu bằng `// @purpose:`), `src/graphics/PBRMaterialFactory.js`, `src/sim/rigging/draw_update.js` (thêm `<= 12` dòng)
  - CẤM đụng: `src/core/*`, `firestore.rules`
  - Chi tiết:
    1. Tạo `src/graphics/pbr/StressPBRMaterials.js`:
       - Sinh bản đồ `metalnessMap`, `roughnessMap` và `normalMap` vết xước sơn / thép rèn cho **Dầm thép sơn công nghiệp** (lớp sơn `metalness: 0.16, roughness: 0.44`, mép trầy lộ thép sáng `metalness: 0.90, roughness: 0.22`) và **Ma ní / Móc cẩu thép rèn mạ kẽm** (`metalness: 0.88, roughness: 0.28, clearcoat: 0.24`).
       - Viết hàm `computeMechanicalStressVisual(tensionT, swlT, mblT)` và `resolveStressTintedMaterial(baseMat, stressRatio, cacheMap)`: khi tỷ lệ tải $u = T / \text{SWL}$ vượt $70\%$, vật liệu cáp/xích/đai chuyển màu mượt mà từ màu gốc sang cam hổ phách ($70\%\text{–}99\%$) và đỏ hồng ngoại kèm `emissiveIntensity` cảnh báo ứng suất kéo giãn ($\ge 100\%$ SWL) trước khi đứt.
    2. Bổ sung phương thức `createPaintedSteelBeamMaterial()`, `createForgedShackleMaterial()` và `getStressVisualMaterial()` vào `src/graphics/PBRMaterialFactory.js` (giữ file `< 245` dòng).
    3. Kết nối `resolveStressTintedMaterial` vào `update3DSlingGeometry` trong `src/sim/rigging/draw_update.js` để cáp chịu tải cao hiển thị ứng suất trực quan theo thời gian thực.
  - Kiểm tra xong: `npx vitest run test/graphics.test.js` và `npm run build` xanh, mọi file trong `src/graphics/` đều `< 300` dòng.

- [x] Bước 5: Tạo bộ Kiểm thử Vàng Kịch bản 20 Tấn Nâng Lệch Tâm → Cắt Cáp → Quật Cáp → Va Chạm Mặt Đất (`test/hyper_realistic_physics_pbr.test.js`)
  - Sửa: `test/hyper_realistic_physics_pbr.test.js` (tạo mới `< 240` dòng, mở đầu bằng `// @purpose:`)
  - CẤM đụng: `src/core/standards/*`, `firestore.rules`
  - Chi tiết:
    1. **Test Pillar 1 (CCD & Zero-Penetration + Friction/Restitution):** Kiểm chứng dầm thép & kiện hàng 20 tấn rơi xuống mặt bãi/Flat Rack không xuyên thủng ($\le 1\text{ mm}$), trượt có ma sát dừng lại theo $\mu$, container 20 tấn có độ nảy $e \le 0.02$ kèm xung lực lớn trong khi ma ní thép có độ nảy kim loại nhẹ, và 2 sợi xích cắt ngang nhau được đẩy tách không xuyên qua mắt xích.
    2. **Test Pillar 2 (20-Ton Asymmetric Lift & Catastrophic Cable Cut Whip):** Treo kiện hàng 20 tấn lệch tâm ($\text{CoG}_x = +0.85\text{ m}$), kiểm chứng kiện hàng nghiêng thực tế theo mô-men lệch tâm; sau đó cắt 1 nhánh cáp chịu tải chính, kiểm chứng năng lượng đàn hồi phóng vọt thành vận tốc quật cáp (`recoilSpeedMps > 5`), đầu cáp quật XPBD uốn trên mặt phẳng rắn, và kiện hàng rơi/chúi theo $g = 9.81\text{ m/s}^2$ không lơ lửng.
    3. **Test Pillar 3 (PBR Maps & Stress-Strain Visualization):** Kiểm chứng các vật liệu `PaintedSteelBeam`, `ForgedShackle`, `WireRope` có đầy đủ `metalnessMap` / `roughnessMap` / `normalMap` chuẩn không gian màu Three.js r170+ và hàm ứng suất `computeMechanicalStressVisual` đổi màu chính xác ở các mốc $40\%$, $85\%$ và $115\%$ SWL.
  - Kiểm tra xong: `npx vitest run test/hyper_realistic_physics_pbr.test.js` đạt 100%.

- [x] Bước 6: Nghiệm thu toàn diện & Cập nhật Bộ nhớ Dự án V7
  - Sửa: `auto_memory/PLAN.md` (`DONE`), `STATE.md`, `auto_memory/CONTEXT.md`
  - Kiểm tra xong: Chạy `npm run architecture:gate`, `npm test`, `npm run build`, `npm run check:dist`, `./scripts/auto_check.ps1`, `./scripts/auto_log.ps1` và báo cáo tổng kết 3 dòng cho Founder.
