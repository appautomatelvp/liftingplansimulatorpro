# @spec — PHỄU LỌC BẢN VẼ 1 TRANG (IDEA-TO-SPEC FILTER - V7)
**Mục đích:** Biến ý tưởng thô / mù mờ của Founder thành bản vẽ `SPEC.md` chuẩn kiến trúc mà KHÔNG bắt Founder trả lời dài dòng.

---

## QUY TRÌNH DÀNH CHO AI KHI ĐƯỢC GỌI `@spec` (HOẶC KHI FOUNDER NÊU Ý TƯỞNG MỚI)

1. **Đọc ngữ cảnh:** Đọc `STATE.md`, `auto_memory/CONTEXT.md` (nếu có) và `auto_kit/ui.md`.
2. **Tự chốt 5 quyết định cốt lõi bằng Phương án Mặc định Tối ưu** (trừ khi thông tin quá thiếu không thể đoán, lúc đó chỉ hỏi tối đa 1–2 câu ngắn kèm đề xuất):
   - **Quyết định 1 (Khung Kiến Trúc & Dòng Giao Diện):**
     - Khung A: SaaS React+Vite (`CARBOOK`/`ROSTER2`) — mặc định cho app quản lý/nhập liệu/PWA.
     - Khung B: 3D Engineering (`SafeLift3D`) — cho mô phỏng 3D/vật lý.
     - Khung C: Dashboard Vanilla JS (`SHIFTREPORT`) — cho bảng tính/báo cáo nhẹ.
   - **Quyết định 2 (Đầu vào & Công thức `/core` hoặc `/utils`):** Xác định các thông số đầu vào, công thức tính toán cốt lõi và ngưỡng cảnh báo Xanh/Vàng/Đỏ.
   - **Quyết định 3 (Lưu trữ & Phạm vi Dữ liệu):** Khởi động 0ms từ `localStorage` (`safeWriteLocalStore` / `withoutDataUrls`) + đồng bộ Firestore qua `prepareFirestorePayload()` tại nhánh `artifacts/{appId}/public/data/...` (chia `weekDoc` nếu là lịch/nhật ký dài ngày).
   - **Quyết định 4 (Phân quyền & Giai đoạn):** Mặc định `PROTOTYPE` (ẩn danh) khi đang thử nghiệm; nếu là SaaS thương mại thì chuẩn bị sẵn cờ `isReadOnly = true` khi hết hạn gói.
   - **Quyết định 5 (Đầu ra & Báo cáo):** Xuất PDF A4 song ngữ (`jsPDF`), Excel (`XLSX`, ô trống ghi `'—'`), hoặc ảnh nén `<canvas>` (`maxWidth = 1024px`).
3. **Xuất file `SPEC.md`:** Ghi rõ 5 quyết định trên + danh sách các file dự kiến tạo (mỗi file ≤ 300 dòng, có `@purpose`).
4. **Chuyển tiếp:** Nếu đây là việc LỚN, lập tức chuyển sang `@plan` (ghi các bước thực thi vào `auto_memory/PLAN.md`) theo đúng Mục 9.D của Luật Lõi.
