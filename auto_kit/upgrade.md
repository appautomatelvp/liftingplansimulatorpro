# @upgrade — NÂNG CẤP & TÁI CẤU TRÚC DỰ ÁN CŨ VỀ CHUẨN MỚI (2 GIAI ĐOẠN: LÊN PLAN → CHẠY 1 MẠCH ĐẾN HẾT)

**Mục tiêu:** Đưa một dự án cũ đang chạy về chuẩn kiến trúc V7 **MÀ KHÔNG LÀM HỎNG TÍNH NĂNG CŨ**, đúng theo thói quen: **Model cao nhất khám & lên Plan → Đổi sang Model thực thi gõ `làm tiếp` ĐÚNG 1 LẦN là nó tự chạy tuần tự từ Bước 1 đến hết Bước cuối cùng!**

---

## GIAI ĐOẠN 1 — Ở MODEL CAO NHẤT (Khi `auto_memory/PLAN.md` chưa `ACTIVE`): KHÁM BỆNH & LẬP PLAN RỒI DỪNG

1. Chạy `./scripts/auto_map.ps1` và `./scripts/auto_check.ps1`.
2. Đọc `auto_memory/MAP.md` (danh sách file `⚠️>300`), `package.json`, cập nhật `auto_memory/CONTEXT.md` và `STATE.md` (khóa `[LOCKED]` các công thức tính toán cốt lõi).
3. Chạy `./scripts/auto_backup.ps1 -FeatureName "upgrade-v7"` (tự nén `.zip` bản gốc vào `_BACKUPS_LOCAL/` và tách nhánh Git nháp).
4. Lập kế hoạch chi tiết vào `auto_memory/PLAN.md` (`Trạng thái: ACTIVE`):
   - **Bước 1:** Dọn file rác (`patch*.js`, `fix*.js`) & lắp bộ giáp dữ liệu từ `auto_kit/templates_src/` (`firestoreSanitize.js`, `localDataStore.js`, `telemetryAndFeedback.js`) giữ nguyên 100% đường dẫn Firestore/LocalStorage cũ.
   - **Bước 2..N:** Mỗi bước tách **đúng 1 file lớn (`>300 dòng`)** thành các module/components nhỏ `<250 dòng` (ưu tiên tách hàm tính toán/utils trước → tách modal/tab con → tách màn hình chính).
5. **DỪNG LẠI** và báo Founder: **"Đã khám xong, backup bản gốc và lập kế hoạch nâng cấp trong `auto_memory/PLAN.md`. Mày đổi sang model thực thi (Auto/Flash/Hydro) và gõ `làm tiếp` 1 lần — nó sẽ tự chạy một mạch từ Bước 1 đến hết kế hoạch!"**

---

## GIAI ĐOẠN 2 — Ở MODEL THỰC THI (Khi Founder đổi model và gõ `làm tiếp` 1 LẦN DUY NHẤT): CHẠY MỘT MẠCH TỪ BƯỚC 1 ĐẾN KẾT THÚC

1. **Không bao giờ dừng lại bắt Founder gõ `làm tiếp` ở từng bước:** Model thực thi phải chạy liên tục từ bước chưa tick đầu tiên cho đến khi hoàn tất bước cuối cùng trong `PLAN.md`.
2. **Kỷ luật bên trong (Tuần tự từng bước + Chốt an toàn ngầm + Cầu chì tự ngắt):**
   - CẤM sửa gộp tất cả các bước thành 1 cục. Phải làm tuần tự **Bước 1 → Bước 2 → Bước 3...**:
   - **Kết thúc mỗi Bước `N`:**
     - Tự chạy kiểm tra `npm run build` (và `npm test` nếu có) + `./scripts/auto_check.ps1`.
     - **Nếu XANH:** Tự đánh dấu `[x]` Bước `N` trong `PLAN.md`, tự chạy `git commit -m "refactor(step-N): ..."` để khóa mốc an toàn của bước đó, rồi **TỰ ĐỘNG CHUYỂN SANG LÀM LUÔN BƯỚC `N+1` NGAY LẬP TỨC**!
     - **Nếu ĐỎ (Cầu chì tự ngắt):** Tự sửa tối đa **2 lần**. Nếu sau 2 lần vẫn lỗi → chạy `git checkout -- .` để **hoàn tác riêng Bước `N` bị lỗi** (giữ nguyên toàn bộ các Bước `1..N-1` đã commit sạch sẽ trước đó!), ghi `BLOCKED` vào `PLAN.md` và dừng lại báo Founder.
3. **Khi chạy xong bước cuối cùng:** Đặt `Trạng thái: DONE` trong `PLAN.md`, chạy `./scripts/auto_check.ps1` + `./scripts/auto_log.ps1` và báo cáo tổng kết toàn bộ kế hoạch cho Founder!
