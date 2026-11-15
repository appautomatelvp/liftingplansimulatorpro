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
