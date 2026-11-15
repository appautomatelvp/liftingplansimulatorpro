# KẾ HOẠCH (bàn giao: model mạnh viết → model thực thi làm từng bước)
Trạng thái: ACTIVE      <!-- NONE | ACTIVE | DONE -->

## Mục tiêu
Cập nhật hình nền khởi động / đăng nhập bằng ảnh công nghiệp chỉnh màu bản quyền sạch với hiệu ứng **Zoom Out**, đồng thời sửa lỗi mất logo ở màn hình Đăng nhập và **đồng bộ 100% Logo + Icon SafeLift3D cùng 1 loại duy nhất** trên toàn hệ thống (Favicon/App Icon, Splash Khởi động, Đăng nhập/Xác thực, Thanh Top-Bar 3D, và CMS `/admin`):
1. **Hình nền Công nghiệp Mới (Sửa bản quyền + Zoom Out):**
   - Dùng công cụ `image-generator` tạo bản vẽ/ảnh công nghiệp mới lấy cảm hứng từ ảnh tải về (`media_1794732046841_4da36e9c.jpg`), đổi góc máy, tư thế kỹ sư, chi tiết thiết bị & nhà xưởng để tránh dính bản quyền ảnh gốc; chỉnh tông màu chuẩn **SafeLift3D Industrial Dark Cockpit** (xanh thép tối `#07111b`, ánh sáng nhấn cyan `#38bdf8`, móc cẩu & đường vạch vàng an toàn `#f59e0b`), khoảng tối bên trái để khung Đăng nhập/Loading nổi bật rõ nét, không chứa chữ hay watermark.
   - Đổi animation nền ở cả `#app-loading-screen` (`index.html`) và `.saas-auth-screen` (`src/saas/saas.css`) từ Zoom In (`1 → 1.09`) sang hiệu ứng **Zoom Out mượt khi khởi động (`1.14 → 1.0`)**.
2. **Sửa lỗi Mất Logo & Đồng bộ Logo–Icon 1 Loại Duy nhất:**
   - **Nguyên nhân gốc vừa phát hiện:** Màn hình Đăng nhập (`src/saas/auth_screen.js`) và Màn hình Khởi động (`index.html`) đang gọi `/safelift3d-icons/branding/main-logo.svg`, nhưng file SVG này lại chứa `<image href="../../brand/safelift3d-lockup.png">` nên bị trình duyệt chặn tải ảnh ngoài khi đặt trong thẻ `<img>` (tạo ra khoảng đen trống mất logo như ảnh báo lỗi của Founder). Trong khi đó `/admin` đang dùng `safelift3d-lockup.png` (có nền bãi container màu cam lạc tông), còn `#top-bar` và favicon đang dùng `app-icon.png` (biểu tượng khối lập phương `SL` + móc cẩu).
   - **Giải pháp đồng bộ:** Lấy biểu tượng **`app-icon.png` (khối lập phương `SL` + móc cẩu)** làm **1 Icon chuẩn duy nhất**, kết hợp cùng cụm chữ **`SAFELIFT` (trắng bạc) `3D` (vàng hổ phách) + phụ đề kỹ thuật** thành một **Brand Lockup đồng bộ** trên nền tối tại tất cả các nơi: Màn hình Khởi động, Màn hình Đăng nhập/Đăng ký/Xác thực, Thanh Top-Bar 3D và Header CMS `/admin` (kèm xử lý lại `main-logo.svg` tự chứa không phụ thuộc link ngoài).

## Giả định đã chọn (founder không cần trả lời)
- Giữ nguyên biểu tượng khối `SL` móc cẩu (`/safelift3d-icons/branding/app-icon.png` & `favicon.ico`) vì Founder đã chốt `"LOGO HIỆN TẠI THÌ OK RỒI"`.
- Tách dùng chung 1 hàm/cấu trúc lockup đồng bộ để đảm bảo Icon ở góc trên Top-Bar, Favicon, Splash Screen, Login Card và CMS `/admin` hoàn toàn đồng nhất cùng 1 loại.
- Giữ nguyên 100% selector kiểm thử và các test hiện có (`test/auth_screen.test.js`, `e2e/cms-roles.spec.js`, `test/i18n_keys.test.js`).
- Không chỉnh sửa bất kỳ file `[LOCKED]` nào trong `STATE.md`, `src/core/*`, hoặc `firestore.rules`.

## Rủi ro & Cách phòng tránh
- **Rủi ro trình duyệt vẫn không hiện logo nếu còn dùng SVG link ngoài:** Loại bỏ hoàn toàn phụ thuộc `<image href="../../brand/...">` bằng cách dùng trực tiếp `/safelift3d-icons/branding/app-icon.png` trong HTML/CSS Lockup và cập nhật `main-logo.svg` sang dạng tự chứa nếu nơi khác cần.
- **Rủi ro vượt ngưỡng `300 dòng/file` ở `src/saas/saas.css` hoặc `src/saas/auth_screen.js` (`auto_check.ps1`):** Giữ `src/saas/saas.css` `<= 260 dòng` và `src/saas/auth_screen.js` `<= 250 dòng`, không nhồi CSS dài thừa.
- **Rủi ro nền ảnh bị chói che mất chữ form Đăng nhập / Loading:** Phủ lớp gradient tối ở `::before` phía trên nền (tối bên trái/trung tâm, vừa đủ thấy cảnh cẩu nâng rotor công nghiệp phía sau).

## Các bước (làm ĐÚNG 1 bước mỗi lần khi founder gõ `làm tiếp`)

- [x] Bước 1: Tạo hình nền công nghiệp bản quyền sạch (`public/brand/industrial-lifting-bg.png`) bằng `image-generator`
  - Sửa / Tạo: `public/brand/industrial-lifting-bg.png` (dùng subagent `image-generator` tham khảo bố cục từ `C:/Users/Admin/.gemini/antigravity/brain/13e1743e-02a7-4593-b5fe-3c4126a5fdd4/.user_uploaded/media_1794732046841_4da36e9c.jpg`, vẽ lại thành ảnh mới gốc — thay đổi góc nhìn rộng hơn, tư thế/vị trí 2 kỹ sư bảo hộ, kết cấu nhà xưởng thép & máy phát điện công nghiệp đang được cẩu bằng cẩu trục móc vàng đen và cáp 4 nhánh; chỉnh tông màu chuẩn công nghiệp SafeLift3D: xanh thép navy `#07111b`, ánh sáng điểm cyan `#38bdf8`, móc cẩu & vạch an toàn vàng `#f59e0b`; khoảng tối gọn bên trái để đặt card Đăng nhập; tuyệt đối KHÔNG có chữ, số, logo hay watermark trong ảnh)
  - CẤM đụng: Code JS/CSS trong `src/`, `index.html`, `firestore.rules`
  - Kiểm tra xong: Dùng `read_file` mở xem trực tiếp ảnh `public/brand/industrial-lifting-bg.png`, xác nhận đúng tông công nghiệp, sạch chữ/watermark và đủ khác biệt với ảnh gốc để an toàn bản quyền.

- [x] Bước 2: Cập nhật hiệu ứng Background Zoom-Out & đồng bộ Logo + Icon ở Màn hình Khởi động (`index.html`)
  - Sửa: `index.html` (chỉ sửa vùng CSS/HTML của `#app-loading-screen` từ dòng 66–256, giữ nguyên các phần khác):
    1) Trỏ `#app-loading-screen::after` sang `url('/brand/industrial-lifting-bg.png')` và đổi `@keyframes yard-zoom` thành hiệu ứng **Zoom Out khi khởi động** (`from { transform: scale(1.14); } to { transform: scale(1); }`).
    2) Thay thẻ `<img class="loader-brand-mark" src="/safelift3d-icons/branding/main-logo.svg">` bằng cụm Brand Lockup đồng bộ gồm `<img src="/safelift3d-icons/branding/app-icon.png" alt="SafeLift3D">` (cùng loại với `#top-bar` và `favicon`) + chữ `SAFELIFT` (trắng bạc) `3D` (vàng `#fbbf24`) + dòng phụ đề `HEAVY RIGGING & LIFT PLANNER · CAE DIGITAL TWIN`.
  - CẤM đụng: `src/core/*`, `firestore.rules`, phần logic mô phỏng 3D trong `index.html`
  - Kiểm tra xong: Chạy `npm run build` và `./scripts/auto_check.ps1` xanh 100%, 0 lỗi đỏ.

- [ ] Bước 3: Đồng bộ Logo + Icon & hiệu ứng Background Zoom-Out ở Màn hình Đăng nhập (`src/saas/auth_screen.js` & `src/saas/saas.css`)
  - Sửa: `src/saas/auth_screen.js` (`<250 dòng`), `src/saas/saas.css` (`<260 dòng`):
    1) Trong `src/saas/saas.css`: trỏ `.saas-auth-screen::after` sang `url('/brand/industrial-lifting-bg.png')` với hiệu ứng **Zoom Out** (`from { transform: scale(1.14); } to { transform: scale(1); }`) đồng bộ màn hình khởi động; định nghĩa style dùng chung `.saas-brand-lockup` (icon `app-icon.png` + text `SAFELIFT3D` + phụ đề) gọn đẹp trên dark card và CMS.
    2) Trong `src/saas/auth_screen.js`: tách 1 helper `renderBrandLockup()` dùng chung cho cả màn hình Đăng nhập/Đăng ký và màn hình Xác thực email (DRY), thay cho ảnh `<img src="/safelift3d-icons/branding/main-logo.svg">` đang bị ẩn rỗng.
  - CẤM đụng: `src/core/*`, `src/saas/firebase*.js`, `firestore.rules`
  - Kiểm tra xong: `npx vitest run test/auth_screen.test.js`, `npm run build`, `./scripts/auto_check.ps1` xanh 100%; kiểm tra số dòng `auth_screen.js` `<250` và `saas.css` `<260`.

- [ ] Bước 4: Đồng bộ Logo + Icon tại CMS `/admin`, dọn `main-logo.svg` & Kiểm tra Nghiệm thu Toàn diện trên Trình duyệt
  - Sửa: `src/saas/admin_panels.js` (`<200 dòng`), `src/saas/admin_cms.css` (`<200 dòng`), `public/safelift3d-icons/branding/main-logo.svg` (chuyển thành SVG tự chứa nhúng PNG data URI hoặc vector đồng bộ `app-icon.png` để không bao giờ rỗng nếu mở trực tiếp), `STATE.md`, `auto_memory/CONTEXT.md`:
    1) Trong `admin_panels.js` (`renderUnauthorizedAdminCard` và `renderAdminShell`) + `admin_cms.css`: dùng đúng icon `/safelift3d-icons/branding/app-icon.png` + wordmark đồng bộ thay vì `/brand/safelift3d-lockup.png` cắt nền cam lạc tông.
    2) Chạy `npm run architecture:gate && npm test && npm run build` và `./scripts/auto_check.ps1` xanh 100%.
    3) Dùng `browser` subagent mở `http://localhost:5173/`, chụp ảnh nghiệm thu màn hình Khởi động & Đăng nhập xác nhận nền công nghiệp Zoom-Out hiển thị sắc nét, Logo & Icon `SafeLift3D` hiện rõ ở mục Đăng nhập và đồng bộ cùng 1 loại với Top-Bar/Favicon.
  - CẤM đụng: `src/core/*`, `src/saas/cms_data.js`, `firestore.rules`
  - Kiểm tra xong: Toàn bộ test + build + architecture gate + auto_check xanh và ảnh chụp trình duyệt xác nhận hiển thị đạt chuẩn.
