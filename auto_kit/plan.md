# @plan — LẬP KẾ HOẠCH (Model cao nhất lên Plan → Model thực thi chạy 1 mạch từ đầu đến cuối)

1. Đọc bộ nhớ theo thứ tự: `auto_memory/CONTEXT.md` → `STATE.md` → 5 mục HISTORY mới nhất → `auto_memory/MAP.md`; chỉ mở những file liên quan.
2. Có ý tưởng mơ hồ → đọc `auto_kit/spec.md`, tự chọn phương án mặc định thay vì hỏi nhiều.
3. Viết `auto_memory/PLAN.md` đúng mẫu: Mục tiêu / Giả định đã chọn / Rủi ro / Các bước.
4. Mỗi bước: ≤ 3 file, ghi rõ **Sửa:** file nào, **CẤM đụng:** file nào, **Kiểm tra xong:** lệnh `npm run build` / `npm test`. Đủ rõ để model thực thi chạy tuần tự một mạch từ Bước 1 đến Bước cuối mà không phải đoán.
5. Đặt `Trạng thái: ACTIVE`, chạy `./scripts/auto_backup.ps1 -FeatureName "<tên>"`.
6. **DỪNG LẠI** và nói: **"Kế hoạch đã lập xong trong `auto_memory/PLAN.md`. Mày chuyển sang model thực thi (Auto/Flash/Hydro) và gõ `làm tiếp` 1 lần — nó sẽ tự chạy một mạch từ Bước 1 đến hết Bước cuối cùng cho mày!"** KHÔNG tự viết code ở lượt lập kế hoạch này.
