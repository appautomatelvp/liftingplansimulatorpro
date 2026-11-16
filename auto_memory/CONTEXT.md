# Ngữ cảnh dự án (AI đọc ĐẦU TIÊN, giữ ≤ 80 dòng, cập nhật khi có quyết định mới)

## 1. App này là gì
- Tên: **LIFTING PLAN SIMULATOR PRO (`SafeLift3D`)**
- Làm gì: Phần mềm mô phỏng phương án nâng hạ 3D, tính toán cáp/xích/góc sling, áp lực nền và bảng tải cẩu theo tiêu chuẩn kỹ thuật công nghiệp, kèm tầng quản trị SaaS.
- Người dùng: Kỹ sư lập phương án nâng hạ (Lifting Plan), quản lý vận hành cảng/công trường.

## 2. Công nghệ
- Khung: `3d` + `saas` (Khung 8B + 8A: Three.js r170 + Rapier3D / Cannon Physics + Vite + Firebase Auth/Firestore/AppCheck)
- Hosting: Cloudflare Pages / Vercel | Dữ liệu & Auth: Firebase (`safelift3d`, Staging: `safelift3d-staging`) + App Check (`ReCaptchaEnterpriseProvider`)
- Giai đoạn: `PROTOTYPE` / `STAGING` -> tiến tới `PRODUCTION` (chi tiết ở `STATE.md`)

## 3. Cấu trúc tóm tắt (chi tiết từng file ở `auto_memory/MAP.md` — 234 file)
- `src/core/` : **VÙNG CÁCH LY KỸ THUẬT (`Physics Quarantine`)** — `physics-world/` (Rapier, Cannon, FixedStepLoop), `standards/` (RiggingRuleEngine, wireRope, chain, slingAngle), `EngineeringEngine.js`, `CraneLoadChartEngine.js`. **CẤM import DOM, React hoặc Three.js vào đây.**
- `src/graphics/` : Chỉ VẼ 3D (`SceneRenderer.js`, `PBRMaterialFactory.js`, `EnvironmentManager.js`).
- `src/rigging/`, `src/sim/`, `src/simulation/` : Mô hình cáp XPBD, trạng thái & vòng lặp mô phỏng.
- `src/saas/` : Tầng đăng nhập, workspace, admin dashboard, môi trường triển khai.
- `src/ui/`, `src/app/` : Giao diện điều khiển.
- `test/`, `e2e/` : Kiểm thử tự động Vitest (42 file / 308 test) & Playwright.

## 4. Hợp đồng dữ liệu Firestore & LocalStorage (Bất khả xâm phạm khi nâng cấp)
- **Firestore Collections (`firestore.rules`):**
  - `users/{uid}`: Hồ sơ người dùng (`role`: `user|admin|support|catalog-editor`, `tier`: `free|premium`, `status`: `active|locked|banned`).
  - `users/{uid}/equipment/{itemId}`: Thiết bị cá nhân (slot `1..20` free, `1..200` premium).
  - `users/{uid}/liftPlans/{itemId}`: Phương án nâng hạ (`snapshot` JSON ≤ 48 KB, tăng `revision` mỗi lần lưu).
  - `users/{uid}/meta/usage`: Bộ đếm quota ghi mỗi ngày (`DAILY_WRITE_LIMIT = 200`).
  - `config/featureFlags`, `adminAuditLogs/{logId}`, `catalog/{itemId}`.
- **LocalStorage Keys:** `safelift_lang`, `safelift_auth_attempts_v1`, `lp-user-rigs`, `lp-user-rigs-migrated:{uid}`, `lifting_sim_audio_muted`, `lifting_sim_audio_vol`.

## 5. Quyết định quan trọng (mới nhất ở trên) — ghi KÈM LÝ DO
- [2026-11-16] Lập kế hoạch 6 bước nâng cấp Hyper-Realistic Rigging Simulator (`auto_memory/PLAN.md` `ACTIVE`): tách 4 module `<240` dòng (`CollisionMaterialSolver.js`, `BrokenCableWhipXPBD.js`, `RigidInertialDynamics.js`, `StressPBRMaterials.js`) cho Va chạm liên tục CCD, Ma sát/Độ nảy cặp vật liệu, Chống xuyên cáp đa sợi, Quật cáp đứt XPBD, Quán tính lệch tâm Steiner và Vật liệu PBR kèm hiển thị ứng suất căng cơ học mà không đụng file `[LOCKED]`.
- [2026-11-16] Hoàn tất 4/4 bước ẩn thông tin cá nhân (SĐT & email thô) khỏi toàn bộ màn hình công khai, HTML và gói `dist/`, chuyển sang hộp thoại Gửi góp ý & Hỗ trợ (`contact_dialog.js`, `feedback.js`, `contact_keys.js`) chống bot/spam 5 lớp (honeypot, khóa thao tác `<2.5s`, phép tính xác minh người thật, chặn link spam, giới hạn `30s`/`3 lần/giờ` qua `localDataStore`) — chỉ giải mã bàn giao email qua `mailto:` khi khách xác minh gửi thành công.
- [2026-11-15] Hoàn tất 4/4 bước đồng bộ Logo + Icon (`app-icon.png` + wordmark `SAFELIFT3D`) & cập nhật hình nền công nghiệp bản quyền sạch (`public/brand/industrial-lifting-bg.png`, `1376x768`) kèm hiệu ứng Zoom-Out khi khởi động (`auto_memory/PLAN.md` `DONE`): sửa triệt để lỗi trình duyệt chặn `main-logo.svg` gây mất logo ở Đăng nhập/Loading, thống nhất cùng 1 loại icon trên Favicon, Splash, Đăng nhập, Top-Bar 3D và CMS `/admin`; `architecture:gate`, 309 tests, `vite build`, `auto_check.ps1` và ảnh chụp trình duyệt đều đạt.
- [2026-11-15] Lập kế hoạch 4 bước đồng bộ Logo + Icon (`app-icon.png`) và tạo ảnh nền công nghiệp bản quyền sạch có hiệu ứng Zoom-Out khi khởi động (`auto_memory/PLAN.md` `ACTIVE`): sửa lỗi Chrome chặn `main-logo.svg` khiến màn hình Đăng nhập & Loading bị mất logo, đồng bộ 1 loại icon + chữ `SAFELIFT3D` trên toàn app (Splash, Login, Top-Bar, CMS `/admin`).
- [2026-11-15] Hoàn tất 6/6 bước nâng cấp CMS Quản trị (`/admin`) lên chuẩn Enterprise Command Center (`auto_memory/PLAN.md` `DONE`): tách `admin_cms.css` + `admin_helpers.js` + `admin_catalog_audit_panels.js` + `cms_keys.js` (giữ mọi file <260 dòng), sửa lỗi hộp đen che màn hình & dropdown trắng xóa, bổ sung thanh điều hướng phân hệ, 6 KPI, bộ lọc đa chiều, chip lý do kiểm toán, công tắc 7 module kỹ thuật, modal chi tiết tài khoản, mẫu Catalog nhanh & xuất CSV; `architecture:gate`, 309 tests và `vite build` đều xanh.
- [2026-11-15] Lập kế hoạch 6 bước nâng cấp CMS Quản trị (`/admin`) lên chuẩn Enterprise Command Center (`auto_memory/PLAN.md` `ACTIVE`): sửa lỗi hộp đen che màn hình & dropdown trắng xóa, thêm thanh điều hướng phân hệ, 6 thẻ KPI, bộ lọc đa chiều, chip lý do kiểm toán nhanh, công tắc 7 module kỹ thuật, mẫu Catalog nhanh, bảng lỗi phiên & xuất CSV.
- [2026-11-15] Hoàn tất nâng cấp `@upgrade` 10 bước (`PLAN.md` -> `DONE`): lắp giáp `firestoreSanitize` + `localDataStore` (`LOCK-06`), tách 7 cụm SaaS & Đồ họa (`auth_rate_limit`, `plan_snapshot`, `admin_panels`, `workspace_views`, `session_ui_bindings`, `HorizonSkyDome`, `ProceduralTextures`) dưới 300 dòng mà giữ nguyên 308 test & `architecture:gate`.
- [2026-11-15] Lập bệnh án & kế hoạch nâng cấp `@upgrade` (`auto_memory/PLAN.md` 10 bước) — tái cấu trúc từng lát mỏng các file >300 dòng và lắp bộ giáp dữ liệu V7 mà giữ nguyên 100% hành vi & 308 test.
- [2026-11-15] Nâng cấp chân trời 3D tự nhiên (đĩa tròn 460m + làm mờ lưới đo tròn + vòm bầu trời khớp sương mù 1:1) — xóa góc vuông mặt sàn ở đường chân trời.
- [2026-11-15] Gắn bộ não AI Starter Kit Pro V7 (`MODULE_3D` + `auto_memory/MAP.md` 225 file) — để AI đọc bản đồ dự án trong 1 giây thay vì quét mò toàn bộ source code.
- Cách ly tuyệt đối vật lý (`src/core/physics-world`) và dùng `FixedStepLoop` (`fixedDt = 1/60`) — để vật thể 3D không bị văng nổ khi chuyển tab trình duyệt.

## 6. Quy ước riêng & Điều CẤM của app này
- Đơn vị tính toán trong `/src/core/`: chuẩn SI (mét, kg, giây, Newton); chỉ đổi đơn vị ở tầng hiển thị UI.
- Three.js: `SRGBColorSpace`, `ACESFilmicToneMapping`, hỗ trợ `QUALITY_TIERS` (`ultra`, `high`, `studio`, `performance`).
- CẤM gọi thẳng thư viện vật lý bên ngoài `/src/core/physics-world/`.
- CẤM sửa các công thức tiêu chuẩn cáp/cẩu trong `/src/core/standards/` khi chưa chạy kiểm chứng số mẫu (`@test`).
- CẤM tạo script vá tạm `patch*.js`, `fix*.js`.
