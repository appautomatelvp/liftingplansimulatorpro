# @plan — LẬP KẾ HOẠCH (việc lớn, chưa viết code)

1. Đọc bộ nhớ theo thứ tự: `auto_memory/CONTEXT.md` → `STATE.md` → 5 mục HISTORY mới nhất → `auto_memory/MAP.md`; chỉ mở những file liên quan.
2. Có ý tưởng mơ hồ → đọc `auto_kit/spec.md`, tự chọn phương án mặc định thay vì hỏi nhiều.
3. Viết `auto_memory/PLAN.md` đúng mẫu trong file đó: Mục tiêu / Giả định đã chọn / Rủi ro / Các bước.
4. Mỗi bước: ≤ 3 file, ghi rõ **Sửa:** file nào, **CẤM đụng:** file nào, **Kiểm tra xong:** lệnh hoặc "mở màn hình X thấy Y". Đủ rõ để model yếu làm đúng mà không phải đoán.
5. Đặt `Trạng thái: ACTIVE`, chạy `./scripts/auto_backup.ps1 -FeatureName "<tên>"`.
6. DỪNG, nói: **"Kế hoạch xong. Đổi sang model thực thi (Auto/Flash/Hydro) và gõ: làm tiếp."** KHÔNG tự thực thi.
