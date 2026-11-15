# @ship — RA MẮT CHO KHÁCH THẬT (chuyển PRODUCTION)

Chạy checklist, báo bảng ✅/❌. Chưa xong hết thì KHÔNG push/deploy.
1. `npm run build` qua, không cảnh báo lạ. `./scripts/auto_check.ps1` không có 🔴.
2. Chạy toàn bộ `@secure`.
3. `STATE.md` đổi giai đoạn sang PRODUCTION; `.env` production đặt `VITE_APP_ENV=production`.
4. `firestore.rules` = bản chặt (`templates/firestore.rules`), đã có doc `admins/{UID}` đầu tiên; hướng dẫn founder dán lên Firebase Console → Rules → Publish.
5. Có màn hình đăng nhập thật (Email/Google); không còn đăng nhập ẩn danh.
6. Tuân thủ dữ liệu cá nhân (Mục 4B): (a) ô tick điều khoản mặc định `false`, (b) có nút cho người dùng tự xóa dữ liệu/tài khoản, (c) lọc bỏ thông tin cá nhân nhạy cảm (mật khẩu, CCCD, bí mật thanh toán) trước khi gửi sang API AI bên ngoài.
7. Có môi trường STAGING (Firebase project riêng) nếu app có dữ liệu khách; test trên đó trước.
8. Biến môi trường đã nhập đủ trên Cloudflare Pages/Vercel (khóa bí mật chỉ nằm ở đó).
9. Dữ liệu quan trọng: hướng dẫn founder export Firestore + copy `_BACKUPS_LOCAL` ra ổ ngoài.
10. Chốt: `./scripts/manual_chot_ban.ps1` (gộp main + tag stable).
11. Đưa danh sách bước tay cho founder: `git push origin main`, kiểm tra Cloudflare build xanh, mở link thật bấm thử. Chờ founder gõ "ĐỒNG Ý" trước khi tự push/deploy.
