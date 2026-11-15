# KẾ HOẠCH (bàn giao: model mạnh viết → model thực thi làm từng bước)
Trạng thái: ACTIVE        <!-- NONE | ACTIVE | DONE -->

## Mục tiêu
Nâng cấp & tái cấu trúc dự án `LIFTING PLAN SIMULATOR PRO (SafeLift3D)` về chuẩn AI Starter Kit Pro V7 (`@upgrade`) theo nguyên tắc **"Phẫu thuật từng lát mỏng"**:
1. Lắp bộ giáp dữ liệu V7 (`firestoreSanitize.js`, `localDataStore.js`) và chuẩn hóa công cụ kiểm tra sức khỏe dự án (`auto_check.ps1`).
2. Tách gọn từng module `src/saas/`, `src/graphics/`, và `src/core/` đang vượt 300 dòng xuống dưới ngưỡng chuẩn (`<250 dòng/file` cho module mới) mà **KHÔNG làm thay đổi bất kỳ hành vi, giao diện, đường dẫn Firestore, khóa LocalStorage hay kết quả của 308 bài kiểm thử tự động**.

## Giả định đã chọn (founder không cần trả lời)
- Giữ nguyên 100% cấu trúc dữ liệu Firestore (`users/{uid}`, `equipment`, `liftPlans`, `meta/usage`, `config/featureFlags`, `adminAuditLogs`, `catalog`) và `firestore.rules` (đã rất chặt và có bộ test emulator riêng).
- Giữ nguyên cơ chế lắp ghép `src/sim/manifest.js` (được kiểm soát bởi `npm run architecture:gate`).
- `src/core/physics-world/FixedStepLoop.js` là module lõi vật lý `[LOCKED]` (bị regex `^(patch|fix...)` trong `auto_check.ps1` bắt nhầm do chữ `Fix` ở đầu tên file), và `apiKey` trong `src/saas/firebase.js` là định danh Firebase Web công khai theo thiết kế (Mục 4.2 Luật Lõi). Sẽ tinh chỉnh regex trong `scripts/auto_check.ps1` ở Bước 1 để không báo đỏ giả.

## Rủi ro & Cách phòng tránh
- **Rủi ro đứt import hoặc hỏng bài test:** Mỗi bước chỉ xử lý đúng 1 cụm nhỏ (≤ 3 file), giữ nguyên toàn bộ hàm `export` công khai (re-export tại file gốc nếu test hoặc module khác đang gọi) và bắt buộc chạy `npm run architecture:gate && npm test && npm run build` xanh 100% cuối mỗi bước.
- **Rủi ro chạm vùng cấm:** Tuyệt đối không sửa các file `[LOCKED]` trong `STATE.md`.

## Các bước (làm ĐÚNG 1 bước mỗi lần khi founder gõ `làm tiếp`)

- [x] Bước 1: Lắp bộ giáp dữ liệu V7 (`firestoreSanitize.js`, `localDataStore.js`) & tinh chỉnh `auto_check.ps1`
  - Sửa: `src/utils/firestoreSanitize.js` (tạo mới từ `auto_kit/templates_src/utils/firestoreSanitize.js`, thêm `@purpose`), `src/utils/localDataStore.js` (tạo mới từ `auto_kit/templates_src/utils/localDataStore.js`, thêm `@purpose`), `scripts/auto_check.ps1` (sửa regex mục 2 thành `^(patch|fix[-_.]|revert|replace)` để không bắt nhầm `FixedStepLoop.js`, và mục 4 bỏ qua `firebase.js` chứa public Firebase `apiKey`)
  - CẤM đụng: Mọi file `[LOCKED]` trong `STATE.md`, `src/core/*`, `firestore.rules`
  - Kiểm tra xong: Chạy `npm run architecture:gate && npm test && npm run build` đạt 100%; `./scripts/auto_check.ps1` không còn báo lỗi giả ở `FixedStepLoop.js` và `src/saas/firebase.js`

- [x] Bước 2: Tích hợp bộ giáp `prepareFirestorePayload` và `safeReadLocalStore` / `safeWriteLocalStore` vào tầng SaaS
  - Sửa: `src/saas/firebase_data.js`, `src/saas/auth_screen.js`, `src/i18n/index.js`
  - CẤM đụng: `firestore.rules`, `src/core/*`, tên khóa `localStorage` cũ (`safelift_lang`, `safelift_auth_attempts_v1`)
  - Kiểm tra xong: Chạy `npm test` (đặc biệt `test/auth_screen.test.js`, `test/admin_users.test.js`, `test/i18n_keys.test.js`) và `npm run build` xanh 100%

- [x] Bước 3: Tách `src/saas/auth_screen.js` (313 dòng -> dưới 300 dòng)
  - Sửa: `src/saas/auth_rate_limit.js` (tạo mới `<120 dòng`, chứa logic kiểm soát giới hạn thử đăng nhập & chuẩn hóa thông báo lỗi Auth), `src/saas/auth_screen.js` (import lại từ `auth_rate_limit.js` và re-export nếu cần để xuống `<260 dòng`)
  - CẤM đụng: `src/saas/firebase.js`, `firestore.rules`, `src/core/*`
  - Kiểm tra xong: `src/saas/auth_screen.js` và `src/saas/auth_rate_limit.js` đều ≤ 300 dòng; chạy `npm test` và `npm run build` xanh 100%

- [x] Bước 4: Tách `src/saas/workspace_data.js` (374 dòng -> dưới 300 dòng)
  - Sửa: `src/saas/plan_snapshot.js` (tạo mới `<180 dòng`, chứa `SNAPSHOT_FIELDS`, `makePlanSnapshot`, `makeLegacyRigSnapshot`, `parsePlanSnapshot`, `buildEquipmentRecord`), `src/saas/workspace_data.js` (import & re-export từ `plan_snapshot.js` để giữ tương thích 100%, giảm còn `<240 dòng`)
  - CẤM đụng: `firestore.rules`, `src/core/*`, `test/workspace_data.test.js`
  - Kiểm tra xong: `src/saas/workspace_data.js` và `src/saas/plan_snapshot.js` đều ≤ 300 dòng; chạy `npx vitest run test/workspace_data.test.js` và `npm run build` xanh 100%

- [ ] Bước 5: Tách `src/saas/admin_dashboard.js` (388 dòng -> dưới 300 dòng)
  - Sửa: `src/saas/admin_panels.js` (tạo mới `<180 dòng`, chứa các hàm render hàng người dùng, nhật ký audit và biểu mẫu catalog), `src/saas/admin_dashboard.js` (import từ `admin_panels.js`, giảm xuống `<260 dòng`)
  - CẤM đụng: `src/saas/cms_data.js`, `firestore.rules`, `src/core/*`
  - Kiểm tra xong: `src/saas/admin_dashboard.js` và `src/saas/admin_panels.js` đều ≤ 300 dòng; chạy `npm test` và `npm run build` xanh 100%

- [ ] Bước 6: Tách `src/saas/workspace_dashboard.js` (430 dòng -> dưới 300 dòng)
  - Sửa: `src/saas/workspace_views.js` (tạo mới `<200 dòng`, chứa các hàm render thẻ phương án, danh sách thiết bị và di trú dữ liệu `lp-user-rigs` qua `localDataStore.js`), `src/saas/workspace_dashboard.js` (import từ `workspace_views.js`, giảm xuống `<260 dòng`)
  - CẤM đụng: `src/saas/workspace_data.js`, `firestore.rules`, `src/core/*`
  - Kiểm tra xong: `src/saas/workspace_dashboard.js` và `src/saas/workspace_views.js` đều ≤ 300 dòng; chạy `npm test` và `npm run build` xanh 100%

- [ ] Bước 7: Tách `src/saas/session.js` (454 dòng -> dưới 300 dòng)
  - Sửa: `src/saas/session_ui_bindings.js` (tạo mới `<220 dòng`, chứa các hàm gắn kết nút bấm header/banner/hộp thoại tài khoản), `src/saas/session.js` (import từ `session_ui_bindings.js`, giảm xuống `<270 dòng`)
  - CẤM đụng: `src/saas/firebase.js`, `firestore.rules`, `src/core/*`
  - Kiểm tra xong: `src/saas/session.js` và `src/saas/session_ui_bindings.js` đều ≤ 300 dòng; chạy `npm test` và `npm run build` xanh 100%

- [ ] Bước 8: Tách `src/graphics/SceneRenderer.js` (321 dòng) & `src/graphics/EnvironmentManager.js` (763 dòng)
  - Sửa: `src/graphics/HorizonSkyDome.js` (tạo mới `<180 dòng`, chứa class/helper dựng vòm bầu trời `HorizonSkyDome` và cấu hình preset khí quyển), `src/graphics/EnvironmentManager.js` (import từ `HorizonSkyDome.js`), `src/graphics/SceneRenderer.js` (rút gọn phần khởi tạo pass/gizmo để xuống ≤ 300 dòng)
  - CẤM đụng: `src/core/*`, `test/graphics.test.js`
  - Kiểm tra xong: `src/graphics/SceneRenderer.js` và `src/graphics/HorizonSkyDome.js` đều ≤ 300 dòng; chạy `npx vitest run test/graphics.test.js` và `npm run build` xanh 100%

- [ ] Bước 9: Tách `src/graphics/PBRMaterialFactory.js` (659 dòng)
  - Sửa: `src/graphics/pbr/ProceduralTextures.js` (tạo mới `<240 dòng`, chứa các hàm vẽ canvas texture bê tông cảng, sợi cáp thép, mặt nước biển và vạch cảnh báo), `src/graphics/PBRMaterialFactory.js` (gọi helper từ `ProceduralTextures.js`, giữ nguyên toàn bộ method public)
  - CẤM đụng: `src/core/*`, `test/graphics.test.js`
  - Kiểm tra xong: `src/graphics/pbr/ProceduralTextures.js` ≤ 300 dòng; chạy `npx vitest run test/graphics.test.js` và `npm run build` xanh 100%

- [ ] Bước 10: Kiểm tra tổng thể bảo mật (`@secure`), chạy bộ kiểm thử Golden Test (`@test`) & nghiệm thu kế hoạch
  - Sửa: `STATE.md` (cập nhật danh sách `[LOCKED]` mới và tick checklist mục 5), `auto_memory/PLAN.md` (đổi trạng thái sang `DONE`)
  - CẤM đụng: `src/core/*`, `firestore.rules`
  - Kiểm tra xong: Chạy `npm run architecture:gate && npm test && npm run build` xanh 100%, chạy `./scripts/auto_check.ps1` và `./scripts/auto_log.ps1`, báo cáo founder chạy `./scripts/manual_chot_ban.ps1`
