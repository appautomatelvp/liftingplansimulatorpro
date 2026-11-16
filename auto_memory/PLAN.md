# KẾ HOẠCH (Model cao nhất lập Plan → Model thực thi chạy 1 mạch từ Bước 1 đến Bước cuối)
Trạng thái: DONE        <!-- NONE | ACTIVE | DONE -->

## Mục tiêu
Ẩn hoàn toàn số điện thoại cá nhân và email nhà phát triển khỏi toàn bộ màn hình công khai, HTML tĩnh và mã nguồn đóng gói (`dist/`); chỉ giữ tên nhà phát triển (`Lê Việt Phương (Mr)`) kèm nút mở hộp thoại **Gửi email góp ý / Hỗ trợ**, chỉ giải mã & bàn giao email cho ứng dụng mail của khách sau khi vượt qua hàng rào chống bot/spam đa lớp (ẩn địa chỉ tới tận lúc khách gửi thật).

## Giả định đã chọn (founder không cần trả lời)
- Giữ tên `Lê Việt Phương (Mr)` ở màn hình Splash, chân trang Đăng nhập/Xác minh, tiêu đề hộp thoại Góp ý và chân trang PDF/BOM (`LiftPlanModel.js`) để giữ bản quyền & không làm sai `e2e/saas-accessibility.spec.js`.
- Xóa 100% số điện thoại (`+84 968 051 697` / `tel:`) khỏi giao diện, metadata `branding.js` và file `index.html`.
- Địa chỉ email nhận góp ý KHÔNG xuất hiện dưới dạng chuỗi thô trong HTML/DOM hay JS bundle (`dist/assets/*.js`); chỉ được giải mã trong bộ nhớ tại thời điểm khách qua bước xác minh người thật để mở `mailto:` (và hiển thị tùy chọn dự phòng sao chép **chỉ sau khi gửi hợp lệ**).
- Hàng rào chống bot/spam 5 lớp chạy 100% trên nền miễn phí (Static + `localDataStore.js`):
  1. Trường bẫy bot ẩn (**Honeypot**) chặn bot tự điền mọi ô.
  2. Khóa thời gian tương tác tối thiểu (`>= 2500ms` từ lúc mở form) chặn submit tức thời.
  3. Phép tính xác minh người thật ngẫu nhiên mỗi lần mở form (`a + b = ?`).
  4. Giới hạn tần suất bền vững qua `localDataStore.js` (khóa `safelift.feedback.rate.v1`: giãn cách `30s`/lần và tối đa `3` lần/giờ).
  5. Kiểm tra nội dung tối thiểu (`>= 10` ký tự thật) và chặn thư rác chứa `>2` đường link URL.

## Rủi ro & Biện pháp kiểm soát
- `index.html` dài `>300` dòng (`3133` dòng) → chỉ **xóa** dòng `<a class="copy-contact"...>` chứa email & SĐT (giảm dòng, không thêm code mới).
- Không sửa `src/i18n/keys.js` (`598` dòng) và tuyệt đối không sửa file `[LOCKED]` (`firestore.rules`, `localDataStore.js`, `src/core/*`). Chuỗi song ngữ VI/EN của hộp thoại góp ý nằm gọn trong `src/saas/contact_dialog.js` (`<250` dòng).
- Giữ chữ ký hàm `buildDeveloperContactMailto()` tương thích ngược một phần cho tham số chính (`subject`, `message`) nhưng nâng cấp tham số bảo vệ chống spam và cập nhật đồng bộ `test/feedback_mailto.test.js`.

## Các bước (Model thực thi chạy tuần tự một mạch từ Bước 1 đến Bước cuối — tự kiểm tra + commit sau mỗi bước, KHÔNG dừng hỏi giữa chừng)
- [x] Bước 1: Nâng cấp lõi chống bot/spam & ẩn email khỏi chuỗi tĩnh trong `src/saas/feedback.js` + cập nhật test `test/feedback_mailto.test.js`
  - Sửa: `src/saas/feedback.js`, `test/feedback_mailto.test.js`
  - CẤM đụng: `src/utils/localDataStore.js`, `firestore.rules`, `src/core/*`
  - Chi tiết: Gỡ `FEEDBACK_EMAIL` chuỗi thô; dùng hàm giải mã động `resolveFeedbackEmail()` từ mảng mã lệch; bổ sung `createContactChallenge()`, `verifyContactChallenge()`, kiểm tra honeypot, dwell-time `>= 2500ms`, chống URL spam (`<= 2` links), giới hạn gửi bền vững via `safeReadLocalStore`/`safeWriteLocalStore` (`30s` cooldown + `3` lần/giờ), và chuẩn hóa tiêu đề theo phân loại `[SafeLift3D · Loại]`.
  - Kiểm tra xong: chạy `npx vitest run test/feedback_mailto.test.js` và kiểm tra file `src/saas/feedback.js` `< 200` dòng.

- [x] Bước 2: Tạo hộp thoại Góp ý chống spam chuyên nghiệp `src/saas/contact_dialog.js` và bổ sung CSS ở `src/saas/saas.css`
  - Sửa: `src/saas/contact_dialog.js` (tạo mới `< 230` dòng, mở đầu `@purpose`), `src/saas/saas.css`
  - CẤM đụng: `index.html`, `src/i18n/keys.js`, các file `[LOCKED]`
  - Chi tiết: Xây dựng `openDeveloperContact({ category, subject } = {})` hỗ trợ song ngữ VI/EN: chỉ hiện tên `Lê Việt Phương (Mr)` và nhãn kênh hỗ trợ chính thức (TUYỆT ĐỐI không hiện SĐT và KHÔNG in email vào DOM trước khi gửi); gồm phân loại góp ý, chủ đề, nội dung, trường honeypot ẩn, câu hỏi xác minh toán học, thông báo lỗi rõ ràng (`role="status"`), mở `mailto:` khi hợp lệ và hiện thẻ dự phòng sao chép chỉ ở bước sau khi gửi thành công.
  - Kiểm tra xong: `npm run build` và `npm run check:dist` xanh, `src/saas/contact_dialog.js` `< 250` dòng và `src/saas/saas.css` `< 300` dòng.

- [x] Bước 3: Gỡ toàn bộ email/SĐT khỏi màn hình công khai & nối nút mở hộp thoại Góp ý sạch
  - Sửa: `index.html` (chỉ xóa 2 link `mailto:`/`tel:` ở `.loader-copyright`), `src/saas/branding.js`, `src/saas/auth_screen.js`, `src/saas/feature_access_ui.js`, `src/saas/session_ui_bindings.js`, `test/auth_screen.test.js`
  - CẤM đụng: `src/i18n/keys.js`, `src/core/*`, `firestore.rules`
  - Chi tiết:
    - `index.html`: Xóa `<a href="mailto:...">` và `<a href="tel:...">` ở Splash Screen (chỉ giữ `© 2026 SafeLift3D · Phát triển bởi Lê Việt Phương (Mr)`).
    - `src/saas/branding.js`: Xóa `email`, `tel`, `contactLine()` khỏi `COPYRIGHT`.
    - `src/saas/auth_screen.js`: Xóa `<a href="mailto:...">` và `<a href="tel:...">` ở cả footer Xác minh & Đăng nhập; giữ tên tác giả và thêm nút `data-action="contact-developer"` gọi `openDeveloperContact()`.
    - `src/saas/feature_access_ui.js`: Đổi `<a class="saas-contact-link" href="mailto:...">` thành `<button type="button" class="saas-contact-link" data-action="contact-developer">` gọi `openDeveloperContact({ category: 'enterprise' })`.
    - `src/saas/session_ui_bindings.js`: Gỡ bản `openDeveloperContact` cũ có lộ SĐT/email, import từ `./contact_dialog.js`.
    - `test/auth_screen.test.js`: Thêm test kiểm chứng footer Auth không chứa chuỗi email/SĐT thô và có nút mở góp ý.
  - Kiểm tra xong: quét `src/` + `index.html` + `dist/` xác nhận KHÔNG còn SĐT `968.*051` hay chuỗi email thô `levietphuong.hcmutrans`; chạy `npm run architecture:gate && npm test && npm run build && npm run check:dist`.

- [x] Bước 4: Nghiệm thu toàn diện & cập nhật bộ nhớ dự án V7
  - Sửa: `auto_memory/PLAN.md` (`DONE`), `STATE.md`, `auto_memory/CONTEXT.md`
  - Kiểm tra xong: Chạy E2E `npx playwright test e2e/saas-accessibility.spec.js --reporter=list`, chạy `./scripts/auto_log.ps1`, chạy `./scripts/auto_check.ps1` (kiểm tra trạng thái cuối, lưu ý rõ nếu `index.html` đã commit ở Bước 3) và tổng kết báo cáo 3 dòng cho Founder.
