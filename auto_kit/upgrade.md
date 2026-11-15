# @upgrade — NÂNG CẤP & TÁI CẤU TRÚC DỰ ÁN CŨ VỀ CHUẨN MỚI (LEGACY MODERNIZATION)

**Mục tiêu:** Đưa một dự án cũ đang chạy (vốn làm kiểu "đắp gạch", có nhiều file >300 dòng, có file `patch*.js`, hoặc thiếu bộ giáp Firebase/LocalStorage) về đúng chuẩn kiến trúc V7 **MÀ KHÔNG LÀM HỎNG BẤT KỲ TÍNH NĂNG NÀO ĐANG CHẠY**.

---

## LUẬT THÉP KHI TÁI CẤU TRÚC DỰ ÁN CŨ ("PHẪU THUẬT TỪNG LÁT MỎNG")

1. **CẤM ĐẬP ĐI XÂY LẠI CẢ DỰ ÁN TRONG 1 LẦN:**
   - Tuyệt đối không sửa/tách đồng loạt 5–10 file lớn trong cùng 1 bước (rất dễ đứt `import`, lệch `state`, trắng màn hình).
   - **Mỗi bước chỉ được phép xử lý ĐÚNG 1 CỤM hoặc TÁCH ĐÚNG 1 FILE LỚN**, kiểm tra `npm run build` chạy xanh 100% rồi mới sang bước tiếp theo.
2. **GIỮ NGUYÊN 100% HÀNH VI & DỮ LIỆU CŨ:**
   - Giao diện, màu sắc, đường dẫn Firestore (`artifacts/{appId}...` hoặc `projects/{tenantId}...`), tên khóa `localStorage`, và kết quả công thức tính toán phải giữ nguyên 100% (Backward-Compatible).

---

## QUY TRÌNH 4 GIAI ĐOẠN KHI FOUNDER GỌI `@upgrade` (HOẶC BẢO "NÂNG CẤP / TÁI CẤU TRÚC DỰ ÁN CŨ")

### GIAI ĐOẠN 1: KHÁM TỔNG QUÁT & LẬP "BỆNH ÁN DỰ ÁN" (Chưa sửa code ngay)
1. Chạy `./scripts/auto_map.ps1` và `./scripts/auto_check.ps1`.
2. Đọc `auto_memory/MAP.md` (mục `⚠️ Cần tách (quá 300 dòng)`), `package.json`, và cấu trúc `src/`.
3. Cập nhật `auto_memory/CONTEXT.md` và `STATE.md` (ghi rõ hợp đồng đường dẫn Firestore hiện có và đánh dấu `[LOCKED]` cho các file công thức cốt lõi đang chạy ổn).
4. In ra cho Founder **"BẢNG CHẨN ĐOÁN DỰ ÁN CŨ"** (ngắn gọn, dễ hiểu):
   - **Hạng mục 1 — Rác kỹ thuật:** Các file `patch*.js`, `fix*.js`, file trùng lặp `_old`, `_backup` cần dọn.
   - **Hạng mục 2 — Bộ giáp dữ liệu & hạ tầng (`auto_kit/templates_src/`):** Dự án đã có chống lỗi `undefined` (`prepareFirestorePayload`), chống tràn 5MB `localStorage` (`withoutDataUrls`), Long Polling 4G, và nén ảnh `<canvas>` chưa?
   - **Hạng mục 3 — Danh sách file phình to (`>300 dòng`):** Liệt kê các file >300 dòng theo thứ tự ưu tiên tách (tách utils/hàm tính toán trước → tách modal/tab con → tách màn hình chính sau cùng).
   - **Hạng mục 4 — Bảo mật (`@secure`):** Có lộ API key ở Front-end hay `firestore.rules` đang mở toang không?

### GIAI ĐOẠN 2: LẬP KẾ HOẠCH ĐẠI TU TỪNG BƯỚC VÀO `auto_memory/PLAN.md`
1. Chạy `./scripts/auto_backup.ps1 -FeatureName "upgrade-v7"` (tự động nén `.zip` bản gốc vào `_BACKUPS_LOCAL/` và tách nhánh Git nháp để bảo toàn 100% dự án cũ).
2. Ghi kế hoạch từng bước nhỏ vào `auto_memory/PLAN.md` (`Trạng thái: ACTIVE`):
   - **Bước 1:** Dọn file rác (`patch*.js`, file thừa) & lắp bộ giáp hạ tầng từ `auto_kit/templates_src/` (`firestoreSanitize.js`, `localDataStore.js`) mà không làm đổi đường dẫn dữ liệu cũ.
   - **Bước 2:** Tách các hàm tính toán thuần túy từ file lớn ra `/src/utils/` hoặc `/src/core/` (`<250 dòng/file`) + gắn bộ số kiểm chứng (`@test`).
   - **Bước 3..N:** Mỗi bước chỉ tách **1 file giao diện/logic lớn (`>300 dòng`)** thành các sub-components / custom hooks nhỏ (`<250 dòng/file`, có dòng `@purpose` ở đầu file).
   - **Bước Cuối:** Kiểm tra bảo mật (`@secure`), chạy `auto_check.ps1` và chốt bản ổn định (`@chot`).
3. DỪNG và báo Founder: **"Đã khám xong và lập kế hoạch nâng cấp an toàn trong `auto_memory/PLAN.md` (đã backup bản gốc). Mày có thể chuyển sang model thực thi (Auto/Flash/Hydro) và gõ `làm tiếp` để nâng cấp từng bước một!"**

### GIAI ĐOẠN 3: THỰC THI TỪNG BƯỚC (Khi Founder gõ `làm tiếp` / `@tiep`)
1. Làm ĐÚNG 1 bước trong `auto_memory/PLAN.md`.
2. Sau khi tách file ở bước đó:
   - Chạy `npm run build` (và `npm test` nếu có) để chắc chắn không đứt `import` nào.
   - Chạy `./scripts/auto_check.ps1` và `./scripts/auto_log.ps1`.
   - Tick `[x]` vào bước vừa xong trong `PLAN.md` và `git commit` riêng bước đó.
3. Nếu tách file mà gây lỗi không sửa được sau 2 lần thử: chạy `git checkout -- .` để hoàn tác ngay bước đó, giữ dự án luôn chạy ổn định.

### GIAI ĐOẠN 4: NGHIỆM THU & KHÓA SỔ (`@chot`)
Khi toàn bộ các bước trong `PLAN.md` đã `[x]`:
- Cập nhật `STATE.md`, đóng dấu `[LOCKED]` vào các module lõi vừa chuẩn hóa, và nhắc Founder chạy `@chot` (`./scripts/manual_chot_ban.ps1`) để gộp về `main` + gắn tag `stable-...`.
