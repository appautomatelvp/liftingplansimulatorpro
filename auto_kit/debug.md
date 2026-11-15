# @debug — SỬA LỖI

1. Đọc `auto_memory/CONTEXT.md` + **10 mục HISTORY mới nhất** (lỗi thường do thay đổi vừa rồi) + MAP để tìm đúng file.
2. Tái hiện/đọc đúng thông báo lỗi (Console F12, terminal). Ghi 1 dòng: "nguyên nhân nghi ngờ".
3. Sửa TỐI THIỂU đúng nguyên nhân gốc. Không viết lại cả file, không sửa file `[LOCKED]`, không tạo `patch*.js`.
4. Chạy lại, chạy `auto_check`, ghi `auto_log -Type fix` kèm NGUYÊN NHÂN (để model sau không đoán lại).
5. Sửa 2 lần vẫn lỗi → DỪNG. Ghi vào HISTORY: đã thử gì, vì sao chưa được. Đề nghị founder quay về backup (`git checkout main` hoặc zip trong `_BACKUPS_LOCAL`) hoặc đổi sang model mạnh hơn.
6. Lỗi liên quan dữ liệu → đọc thêm `auto_kit/data.md`; lỗi tính sai → `auto_kit/test.md`.
