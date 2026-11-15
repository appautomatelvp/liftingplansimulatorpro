# @secure — SOI BẢO MẬT, ĐĂNG NHẬP, PHÂN QUYỀN

Kiểm từng mục, báo kết quả bằng bảng ✅/❌ + cách sửa tiếng Việt thường:
1. Khóa bí mật (Gemini, webhook, thanh toán) có nằm trong code Front-end hoặc biến `VITE_*` không? Phải nằm ở `functions/api/` hoặc `api/`.
2. `.env*` có trong Git không (`git ls-files`)? Có → `git rm --cached` rồi BÁO founder đổi key.
3. `firestore.rules`: đang là bản prototype hay production (so với giai đoạn trong `STATE.md`)? Có chỗ `if true` hoặc chỉ `auth != null` cho dữ liệu thật không?
4. Giai đoạn PRODUCTION mà vẫn đăng nhập ẩn danh? → ❌.
5. Role (admin/member) lưu ở đâu? User có tự sửa được role/gói cước của mình không? Rules phải chặn.
6. Dữ liệu người dùng nhập có đi vào `innerHTML` không? → đổi `textContent`.
7. Có `console.log` token/mật khẩu/dữ liệu cá nhân không?
8. Chạy `./scripts/auto_check.ps1` và đưa kết quả vào báo cáo.
Sửa lỗi ❌ thuộc nhóm đổi Rules/đăng nhập = việc LỚN: backup trước, và nhóm "DỪNG HỎI" nếu đụng dữ liệu khách đang dùng.
