# BẢNG TRẠNG THÁI & BỘ NHỚ DỰ ÁN — LIFTING PLAN SIMULATOR PRO (V7)
> **CHỈ THỊ CHO AI:** Đọc kỹ file này cùng `auto_memory/CONTEXT.md` đầu tiên ở mọi phiên làm việc. Tuyệt đối cấm sửa các file `[LOCKED]` và phải giữ nguyên kiến trúc Physics Quarantine bên dưới.

---

## 1. HỒ SƠ DỰ ÁN
- **Tên dự án:** `LIFTING PLAN SIMULATOR PRO` (`SafeLift3D`)
- **Khung Kiến trúc áp dụng:** Khung 8B + 8A — 3D Engineering & Physics Quarantine + SaaS Multi-Tenant (`MODULE_3D`)
- **Định danh Firebase (`appId` / `tenantId`):** `safelift3d` (Staging: `safelift3d-staging`, Test Emulator: `safelift3d-rules-test`)
- **Chế độ Multi-Tenant:** Chia theo `users/{uid}` và phân quyền RBAC (`admin`, `support`, `catalog-editor`, `user`) trong `src/saas/`
- **Giai đoạn:** `PROTOTYPE` / `STAGING`
- **Trạng thái bản dựng:** `TEST DRAFT` (đang chạy dev tại `http://localhost:5173`)

---

## 2. HỢP ĐỒNG KIẾN TRÚC & DỮ LIỆU (BACKWARD-COMPATIBLE 100%)
- **Vùng cách ly vật lý (`Physics Quarantine`):**
  - Toàn bộ tính toán vật lý & tiêu chuẩn kỹ thuật nằm trong `/src/core/`. Không chứa DOM hay Three.js.
  - Lớp `/src/graphics/` chỉ nhận tọa độ `(position, quaternion)` đã nội suy để vẽ.
- **Đường dẫn Firestore (`firestore.rules`):**
  - `users/{uid}`: Hồ sơ & quyền truy cập (`role`, `tier`, `status`, `createdAt`, `lastLogin`).
  - `users/{uid}/equipment/{itemId}`: Thiết bị nâng hạ cá nhân (`schemaVersion: 1`, slot `1..20` free / `1..200` premium).
  - `users/{uid}/liftPlans/{itemId}`: Phương án nâng hạ (`schemaVersion: 1`, `revision`, `snapshot` JSON ≤ 48 KB).
  - `users/{uid}/meta/usage`: Quota ghi hàng ngày (`dayKey`, `writesToday <= 200`, `plansCount`, `equipmentCount`).
  - `config/featureFlags`: Cấu hình hệ thống (`maintenanceMode`, `freePlanLimit`, `disabledModules`).
  - `adminAuditLogs/{logId}`: Nhật ký kiểm toán quản trị (`USER_ACCESS_UPDATE`, `FLAGS_UPDATE`, `CATALOG_UPSERT`, `CATALOG_DELETE`).
  - `catalog/{itemId}`: Danh mục thiết bị mẫu toàn hệ thống.
- **Khóa `localStorage` đang dùng:**
  - `safelift_lang`, `safelift_auth_attempts_v1`, `lp-user-rigs`, `lp-user-rigs-migrated:{uid}`, `lifting_sim_audio_muted`, `lifting_sim_audio_vol`.
- **Bản đồ cấu trúc:** Xem `auto_memory/MAP.md` (234 file đã được đánh chỉ mục tự động).

---

## 3. DANH SÁCH FILE & MODULE ĐÃ KHÓA (`[LOCKED]` - BẤT KHẢ XÂM PHẠM)

| Mã Khóa | Đường dẫn File / Cụm | Chức năng cốt lõi | Quy tắc bảo vệ |
| :--- | :--- | :--- | :--- |
| **LOCK-01** | `/src/core/physics-world/*` (`PhysicsWorldManager.js`, `RapierBackend.js`, `CannonBackend.js`, `FixedStepLoop.js`, `ConstraintGraph.js`, `IPhysicsBackend.js`, `Units.js`) | Lõi vật lý & vòng lặp bước cố định `1/60s` | `[LOCKED]` - Cấm sửa khi chưa xin phép |
| **LOCK-02** | `/src/core/standards/*` (`RiggingRuleEngine.js`, `wireRope.js`, `chain.js`, `slingAngle.js`, `belowTheHook.js`, `hardware.js`, `steelGrades.js`, `syntheticSling.js`) | Công thức tiêu chuẩn cáp, xích, góc sling ASME B30.9 | `[LOCKED]` - Cấm đổi công thức khi chưa có lệnh |
| **LOCK-03** | `/src/core/CraneLoadChartEngine.js`, `GroundPressureEngine.js`, `PhysicalCableSolver.js`, `DeformableSteelStructure.js` | Tính toán bảng tải cẩu, áp lực nền & giải cáp vật lý | `[LOCKED]` - Đã qua kiểm chứng 308 test |
| **LOCK-04** | `/firestore.rules` | Luật bảo mật Firestore nghiêm ngặt hiện có của dự án | `[LOCKED]` - Không tự ý nới lỏng rule |
| **LOCK-05** | `/src/sim/manifest.js` & các shim `/src/sim/{physics,session,cargo,library,gear,rigging}.js` | Hợp đồng lắp ghép runtime mô phỏng (`architecture:gate`) | `[LOCKED]` - Giữ nguyên thứ tự nạp |
| **LOCK-06** | `/src/utils/firestoreSanitize.js`, `/src/utils/localDataStore.js` | Bộ giáp lọc `undefined`/bí mật trước khi ghi Firestore & chống tràn 5MB `localStorage` | `[LOCKED]` - Bắt buộc đi qua khi lưu dữ liệu |

---

## 4. CÔNG VIỆC ĐANG LÀM DỞ (ONGOING WORK)
- **Mục tiêu hiện tại:** Hoàn tất 6/6 bước nâng cấp chuyên sâu **Tiếp xúc Bề mặt 3D Thực (0mm khe hở), Kết cấu Dầm chữ H, Chuẩn hóa Ngáng Cẩu STS ISO 1161/668 & Vật lý Đứt cáp Thực tế** (`auto_memory/PLAN.md` `Trạng thái: DONE`, nhánh `feat/horizon-clouds`):
  1. `src/rigging/TrueMeshSurfaceContact.js` (`220` dòng) + đấu nối vào `shell_rebuild.js`, `hook_pool.js`, `draw_update.js`: Quét & giải tiếp xúc 1:1 trực tiếp trên bề mặt cong/mesh 3D thực, xóa hộp chữ nhật vô hình và lỗi cộng đúp `pad`.
  2. Chia lưới dọc `widthSegments = 32` cho dầm nâng chữ H (`specialty_meshes.js`), thu gọn gân đen nằm trong lòng bụng dầm, và chuẩn hóa độ cứng $I_{\text{beam}}$ (`beams_seed.js`) để không bao giờ lòi thanh đen xuống đáy dầm.
  3. Sửa `BrokenCableWhipXPBD.js`, `RigidInertialDynamics.js`, `draw_update.js`: Mỗi nửa cáp đứt neo đúng chốt của nó (`stepSingleStub`), triệt tiêu tia đỏ bắn lên trời & xích văng ngang.
  4. `src/rigging/StsSpreaderRealism.js` (`174` dòng) + đấu nối `specialty_meshes.js`, `beams_seed.js`: Chuẩn hóa kích thước phủ bì khung Ngáng STS khớp chuẩn quốc tế ISO 668 / ISO 1161 ($2.438\text{ m}$ rộng), nối liền 8 cáp tời Headblock lên trolley (`hookPos`), và chuẩn hóa nâng/hạ + nghiêng lệch CoG chế độ Direct & Cable.
  5. Bộ kiểm thử Vàng `test/rigging_realism_sts_contact.test.js` (5/5 test đạt).
- **Bước tiếp theo:** Founder kiểm tra trực quan trên màn hình 3D (chọn bồn cầu/trụ bọc xích, thử dầm nâng chữ H 30T, thử ngáng STS gắp công & cắt cáp ở chế độ Cáp/Trực tiếp), nếu ưng ý thì chạy `./scripts/manual_chot_ban.ps1`.

---

## 5. CHECKLIST NGHIỆM THU TRƯỚC KHI CHỐT `STABLE VERSION`
- [x] Tất cả các file mới/vừa tách đều dưới 300 dòng, có `@purpose`, không sinh ra file `patch*.js` hay `fix.js` nào.
- [x] Không vi phạm Physics Quarantine (`/src/core/` không import DOM/Three.js) và qua `npm run architecture:gate`.
- [x] Đã chạy `./scripts/auto_check.ps1` và `./scripts/auto_log.ps1` để cập nhật `auto_memory/HISTORY.md` + `auto_memory/MAP.md`.
- [x] Toàn bộ 44 file / 331 test (`npm test`), kiểm tra bảo mật (`@secure`) + Golden Test (`@test`) và `npm run build` chạy khớp 100%. (Founder mở F12 kiểm tra thêm trên trình duyệt trước khi chốt bản).
