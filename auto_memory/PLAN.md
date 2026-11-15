# KẾ HOẠCH (bàn giao: model mạnh viết → model thực thi làm từng bước)
Trạng thái: DONE        <!-- NONE | ACTIVE | DONE -->

## Mục tiêu
Nâng cấp toàn diện hệ thống **CMS Quản trị (`http://localhost:5173/admin`)** của `LIFTING PLAN SIMULATOR PRO (SafeLift3D)` lên chuẩn **Enterprise Command Center quốc tế** (phong cách Cloudflare / Vercel / Linear kết hợp chữ ký Industrial Dark Cockpit `@ui`):
1. **Xóa triệt để các lỗi vỡ giao diện trên `/admin`:**
   - Sửa lỗi khối hộp đen khổng lồ trôi giữa màn hình che khuất tiêu đề (do `.saas-admin-screen` bị kế thừa `place-items: center` từ `.saas-auth-screen` và logo SVG `/safelift3d-icons/branding/main-logo.svg` gọi ảnh ngoài bị Chrome chặn tạo ra khoảng đen cao 160px).
   - Sửa lỗi các ô chọn `<select>` (`Loại`, `Gói truy cập`) bị nền trắng chữ trắng không đọc được và lỗi các nút bấm (`Tìm kiếm`, `Xóa lọc`, `Lưu mục catalog`, `Xóa biểu mẫu`) bị kéo giãn 100% chiều ngang xếp chồng lên nhau.
2. **Nâng cấp trải nghiệm & tính năng quản trị chuyên nghiệp cho Admin / Support / Catalog-Editor:**
   - **Thanh Header & Điều hướng Phân hệ (Command Bar & Section Switcher):** Hiển thị thương hiệu chuẩn `/brand/safelift3d-lockup.png`, badge môi trường (`DEVELOPMENT` / `STAGING` / `PRODUCTION`), trạng thái hệ thống (`LIVE` / `MAINTENANCE`), thông tin Admin và thanh chuyển nhanh phân hệ (`Tất cả phân hệ`, `Người dùng & Quyền`, `Cấu hình & Module`, `Catalog Thiết bị`, `Nhật ký Kiểm toán`).
   - **Dải 6 Chỉ số KPI Thời gian thực (`Executive KPI Ribbon`):** Tổng tài khoản & cơ cấu vai trò, Tỷ lệ đang hoạt động (`Active %`), Tỷ lệ chuyển đổi `Premium`, Kho Catalog thiết bị đang kích hoạt, Cấu hình bảo trì & hạn mức Free, Sức khỏe phiên & số bản ghi Audit.
   - **Quản lý Người dùng Chuyên sâu:** Bộ lọc tức thì theo **Vai trò (`Role`)**, **Gói (`Tier`)**, **Trạng thái (`Status`)**; thanh **Gợi ý nhanh lý do kiểm toán 1-chạm (`Quick Reason Chips`)**; hiển thị thêm Avatar chữ cái đầu, UID, Ngày tạo, Đăng nhập gần nhất; khóa bảo vệ không cho tự khóa/đổi gói chính mình; hộp thoại **Xem chi tiết hồ sơ người dùng (`User Inspector Modal`)** và nút **Xuất CSV (`Export CSV`)**.
   - **Cấu hình Hệ thống, Công tắc Module & Trình khám lỗi (`Feature Flags & Session Error Inspector`):** Lưới 2 cột chuyên nghiệp, nút chọn nhanh hạn mức gói Free (`20 / 50 / 100`), **7 công tắc bật/tắt trực quan cho từng module kỹ thuật** (đồng bộ 2 chiều với ô `disabledModules`), và bảng chi tiết 10 lỗi client gần nhất trong phiên.
   - **Quản lý Catalog Thiết bị Chuẩn Kỹ thuật:** Thanh **4 Mẫu Thiết bị Chuẩn (`Quick Templates`)** điền nhanh 1-chạm, biểu mẫu lưới 3 cột sắc nét, bộ lọc nhanh theo loại (`cargo`, `beam`, `sling`, `hardware`) / gói / từ khóa.
   - **Nhật ký Kiểm toán (`Immutable Audit Trail`):** Bộ lọc theo loại hành động (`USER_ACCESS_UPDATE`, `FLAGS_UPDATE`, `CATALOG_UPSERT`, `CATALOG_DELETE`), ô tìm kiếm nhanh, hiển thị thẻ so sánh `Trước → Sau` trực quan và nút **Xuất Audit CSV**.

## Giả định đã chọn (founder không cần trả lời)
- Giữ nguyên 100% hợp đồng dữ liệu Firestore và `firestore.rules` (`[LOCKED]` — `LOCK-04`): các collection `users`, `config/featureFlags`, `adminAuditLogs`, `catalog` và phân quyền RBAC (`admin`, `support`, `catalog-editor`, `user`) giữ nguyên tuyệt đối.
- Chế độ hiển thị mặc định khi vào `/admin` là **`Tất cả phân hệ (all)`** để Admin vừa nhìn bao quát toàn cảnh hoặc bấm lọc từng phân hệ trên thanh điều hướng, vừa giữ nguyên 100% khả năng tương thích với kịch bản kiểm thử tự động `e2e/cms-roles.spec.js`.
- Giữ nguyên toàn bộ selector kiểm thử hiện có (`.saas-admin-card`, `[data-action="search-form"]`, `[data-action="flags-form"]`, `[data-action="catalog-form"]`, `[data-action="refresh-audit"]`, `#admin-access-reason`, `.saas-users-table`, `[data-tier]`, `[data-status]`).
- Mọi file mới/sửa đều tuân thủ nghiêm ngặt giới hạn `<250–300 dòng/file` (tách riêng `src/i18n/cms_keys.js`, `src/saas/admin_cms.css`, `src/saas/admin_helpers.js`, `src/saas/admin_catalog_audit_panels.js`).

## Rủi ro & Cách phòng tránh
- **Rủi ro lệch khóa ngôn ngữ VI/EN (`test/i18n_keys.test.js`):** Mọi khóa mới trong `src/i18n/cms_keys.js` bắt buộc có đủ cả `vi` và `en` với cùng biến `{placeholder}` và không dùng toán tử 3 ngôi check ngôn ngữ trong `src/saas/*.js`.
- **Rủi ro vượt 300 dòng/file (`auto_check.ps1`):** Chia rõ trách nhiệm từng module (`admin_helpers.js`, `admin_panels.js`, `admin_catalog_audit_panels.js`, `admin_dashboard.js`, `admin_cms.css`), mỗi file giữ trong khoảng `150–260 dòng`.

## Các bước (làm ĐÚNG 1 bước mỗi lần khi founder gõ `làm tiếp`)

- [x] Bước 1: Tạo bộ từ điển song ngữ VI/EN chuyên biệt cho CMS Enterprise (`src/i18n/cms_keys.js` & `src/i18n/keys.js`)
  - Sửa: `src/i18n/cms_keys.js` (tạo mới `<170 dòng`, có `@purpose`, chứa đầy đủ khóa `vi` và `en` cho điều hướng phân hệ, 6 thẻ KPI, bộ lọc Role/Tier/Status/Kind/Audit, Quick Reason Chips, công tắc module, bảng lỗi phiên, mẫu thiết bị Catalog, modal chi tiết user và nút xuất CSV), `src/i18n/keys.js` (import `CMS_KEYS` và gộp vào `SAAS_KEYS.vi` / `SAAS_KEYS.en` trong ≤ 6 dòng)
  - CẤM đụng: Mọi file `[LOCKED]` trong `STATE.md`, `src/core/*`, `firestore.rules`
  - Kiểm tra xong: Chạy `npx vitest run test/i18n_keys.test.js` và `npm run build` xanh 100%; `src/i18n/cms_keys.js` ≤ 250 dòng

- [x] Bước 2: Thiết kế stylesheet `src/saas/admin_cms.css` chuẩn Enterprise Command Center & sửa lỗi vỡ Header / Dropdown trên `/admin`
  - Sửa: `src/saas/admin_cms.css` (tạo mới `<240 dòng`, có `@purpose`, định nghĩa bố cục `.saas-admin-screen` full-width `place-items: unset`, Header Command Bar cao gọn với logo `/brand/safelift3d-lockup.png`, thanh điều hướng phân hệ `.saas-cms-nav`, lưới 6 thẻ KPI `.saas-cms-kpi-grid`, thanh công cụ lọc ngang `.saas-cms-toolbar`, lưới form 2–3 cột `.saas-cms-form-grid` với `<select>` / `<input>` nền tối `#070e19` chữ sáng `#f8fafc`, chip gợi ý `.saas-cms-chip`, bảng ghim tiêu đề và modal chi tiết), `src/saas/saas.css` (thêm `@import './admin_cms.css';` ở đầu file và rút gọn các dòng `.saas-admin-*` cũ để `saas.css` giảm xuống `<250 dòng`)
  - CẤM đụng: Mọi file `[LOCKED]` trong `STATE.md`, `src/core/*`, `src/styles/app.css`
  - Kiểm tra xong: `src/saas/admin_cms.css` và `src/saas/saas.css` đều ≤ 260 dòng; chạy `npm test` và `npm run build` xanh 100%

- [x] Bước 3: Xây dựng module hàm thuần `src/saas/admin_helpers.js` (KPI, Bộ lọc Đa chiều, Gợi ý Nhanh, Mẫu Thiết bị & Xuất CSV) kèm Unit Test
  - Sửa: `src/saas/admin_helpers.js` (tạo mới `<210 dòng`, có `@purpose`, xuất các hằng số & hàm thuần: `CMS_CONTROLLABLE_MODULES`, `QUICK_AUDIT_REASONS`, `CATALOG_QUICK_TEMPLATES`, `computeAdminKpiSummary`, `filterUsersList`, `filterCatalogList`, `filterAuditLogs`, `toggleModuleInList`, `buildUsersCsv`, `buildAuditCsv`, `triggerCsvDownload`), `test/cms_data.test.js` (bổ sung bài test kiểm chứng `computeAdminKpiSummary`, các hàm lọc, `toggleModuleInList` và `buildUsersCsv` / `buildAuditCsv`, tổng số dòng `test/cms_data.test.js` ≤ 240 dòng)
  - CẤM đụng: `src/saas/cms_data.js`, `firestore.rules`, `src/core/*`
  - Kiểm tra xong: Chạy `npx vitest run test/cms_data.test.js` và `npm test` xanh 100%; `src/saas/admin_helpers.js` và `test/cms_data.test.js` đều ≤ 250 dòng

- [x] Bước 4: Nâng cấp `src/saas/admin_panels.js` (Header Command Bar, Dải 6 KPI, Phân hệ Người dùng & Phân hệ Cấu hình Hệ thống / Lỗi Phiên)
  - Sửa: `src/saas/admin_panels.js` (nâng cấp dưới `<250 dòng`, giữ nguyên các hàm đọc form `EMPTY_CATALOG_DRAFT`, `catalogDraftFromItem`, `readFlagsFormPayload`, `readCatalogFormPayload`, `escapeHtml`, `formatAuditTime`, `renderUnauthorizedAdminCard`, và nâng cấp `renderAdminShell`, `renderKpiRibbon`, `renderUsersSection`, `renderFlagsSection` với bộ lọc Role/Tier/Status, Quick Reason Chips, cột Ngày tạo/Đăng nhập cuối, khóa bảo vệ tài khoản tự thân, công tắc 7 module kỹ thuật và bảng chi tiết lỗi phiên)
  - CẤM đụng: `src/saas/cms_data.js`, `firestore.rules`, `src/core/*`
  - Kiểm tra xong: `src/saas/admin_panels.js` ≤ 250 dòng; giữ nguyên toàn bộ selector bắt buộc của `e2e/cms-roles.spec.js`

- [x] Bước 5: Tạo `src/saas/admin_catalog_audit_panels.js` (Phân hệ Catalog Thiết bị 3 cột, Nhật ký Kiểm toán Diff & Modal Chi tiết Người dùng)
  - Sửa: `src/saas/admin_catalog_audit_panels.js` (tạo mới `<220 dòng`, có `@purpose`, chứa `renderCatalogSection` với 4 nút Mẫu Thiết bị Chuẩn + lưới 3 cột + thanh lọc Kind/Tier/Search, `renderAuditSection` với bộ lọc Action/Search + nút Xuất CSV + thẻ Diff `Trước → Sau`, và `renderUserDetailModal`), `src/saas/admin_panels.js` (re-export `renderCatalogSection`, `renderAuditSection`, `renderUserDetailModal` và cập nhật `renderUsersAndFlagsSections` để tương thích ngược)
  - CẤM đụng: `src/saas/cms_data.js`, `firestore.rules`, `src/core/*`
  - Kiểm tra xong: `src/saas/admin_catalog_audit_panels.js` và `src/saas/admin_panels.js` đều ≤ 250 dòng; chạy `npm test` và `npm run build` xanh 100%

- [x] Bước 6: Kết nối toàn bộ tương tác trong `src/saas/admin_dashboard.js` & Kiểm tra Nghiệm thu Toàn diện trên Trình duyệt
  - Sửa: `src/saas/admin_dashboard.js` (`<270 dòng`, gắn sự kiện chuyển đổi phân hệ `activeSection`, lọc người dùng theo Role/Tier/Status, bấm chip điền nhanh lý do kiểm toán, mở/đóng modal chi tiết người dùng, bật/tắt trực quan 7 module kỹ thuật, nạp nhanh mẫu thiết bị Catalog, lọc Catalog/Audit và xuất CSV cho Người dùng & Nhật ký Audit), `STATE.md`, `auto_memory/CONTEXT.md`
  - CẤM đụng: `src/saas/cms_data.js`, `firestore.rules`, `src/core/*`
  - Kiểm tra xong: Chạy `npm run architecture:gate && npm test && npm run build` xanh 100%, chạy `./scripts/auto_check.ps1` đạt 0 lỗi đỏ, mở `http://localhost:5173/admin` xác nhận giao diện Command Center mới đẹp chuẩn quốc tế, không còn hộp đen che màn hình hay dropdown trắng xóa
