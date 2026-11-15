# @insight — ĐO LƯỜNG NGƯỜI DÙNG, PHÂN TÍCH THÓI QUEN KHÁCH HÀNG & HỘP THƯ FEEDBACK (V7)

**Mục tiêu cốt lõi:** Giúp Founder nắm rõ 3 thứ ở mọi sản phẩm: **(1) Có bao nhiêu người đang dùng thực tế (DAU/MAU), (2) Khách hay dùng tính năng nào / bị vướng ở đâu, (3) Khách góp ý hay phàn nàn gì** — nhưng **TUYỆT ĐỐI KHÔNG LÀM CHÁY QUOTA 20.000 LƯỢT GHI/NGÀY CỦA GÓI FIREBASE SPARK MIỄN PHÍ!**

---

## 1. BẪY CHÁY QUOTA KHI ĐẾM NGƯỜI DÙNG & CÁCH GIẢI QUYẾT CHUẨN CTO

- **Bẫy chết người:** Nếu mỗi lần khách mở trang hoặc bấm 1 nút mà gọi `addDoc`/`updateDoc` lên Firestore -> chỉ cần 200 khách bấm 100 lần/ngày là bay sạch 20.000 lượt ghi miễn phí của Firebase Spark!
- **Giải pháp Mặc định trong Bộ Kit (`src/utils/telemetryAndFeedback.js`):**
  1. **Gom vào `localStorage` (`trackFeatureUsage`):** Khách bấm tính năng nào (`xuat_pdf`, `tinh_tai_trong`, `xep_ca`...) thì cộng dồn vào `localStorage` trên máy khách trước (tốn **0 lượt ghi Firestore**).
  2. **Đồng bộ 1 lần/người/ngày (`flushDailyTelemetryIfNeeded`):** Mỗi người dùng chỉ gửi **đúng 1 lượt `setDoc(..., { merge: true })` với `increment()` mỗi ngày** vào document `artifacts/{appId}/public/data/analytics_daily/{YYYY-MM-DD}`.
     - Kết quả: **1.000 người dùng/ngày = chỉ tốn đúng 1.000 lượt ghi Firestore**, mà vẫn có đủ: Tổng người dùng trong ngày (`activeUsersCount`), tỷ lệ Điện thoại vs Máy tính (`mobileUsersCount` / `desktopUsersCount`), và bảng xếp hạng số lần dùng từng tính năng (`feature_*`)!
  3. **Xem Video thao tác thật & Bản đồ nhiệt (Heatmap) Miễn phí 100% (`Microsoft Clarity`):**
     - Chỉ cần điền `VITE_CLARITY_ID` vào `.env.local`, hàm `initZeroCostAnalytics()` tự nhúng Microsoft Clarity (miễn phí trọn đời, không giới hạn lưu lượng).
     - Founder mở bảng Clarity lên là xem được video khách thật bấm chuột/chạm màn hình như thế nào, chỗ nào khách bấm điên cuồng vì lỗi (Rage Clicks), chỗ nào khách bỏ cuộc!

---

## 2. CHUẨN HỘP THƯ FEEDBACK & BÁO LỖI 1-CHẠM TRONG APP (`submitUserFeedback`)

Mọi dự án của Founder mặc định phải có **Nút Góp Ý / Báo Lỗi nhanh** (ở góc màn hình hoặc trên thanh công cụ) và một tab xem danh sách góp ý trong màn hình Admin:
1. **Form gửi siêu gọn (3 giây là bấm xong):**
   - Chọn mức độ hài lòng: `1 ⭐` đến `5 ⭐`.
   - Chọn phân loại: `💡 Đề xuất tính năng` (`idea`) | `🐞 Báo lỗi` (`bug`) | `🤔 Khó thao tác` (`ux`).
   - Ô nhập nội dung góp ý (tối đa 1.500 ký tự).
2. **Tự động đính kèm ngữ cảnh kỹ thuật (Khách không cần tự mô tả):**
   - Tự ghi nhận: Khách đang đứng ở màn hình/tab nào (`screenName`), dùng Điện thoại hay Máy tính (`device`), thời gian (`createdAt`).
   - Chống spam tự động: Giới hạn tối đa **3 lượt gửi / giờ** trên mỗi thiết bị.
   - Lọc sạch thông tin nhạy cảm qua `prepareFirestorePayload()` trước khi lưu vào `artifacts/{appId}/public/data/feedbacks`.

---

## 3. BẢNG CHỈ SỐ MẶC ĐỊNH TRONG TRANG ADMIN CỦA FOUNDER

Khi AI dựng trang Admin / Dashboard quản trị cho dự án, phải có tab **"Chỉ Số & Góp Ý Khách Hàng"** hiển thị:
1. **Lượng người dùng:** Hôm nay (`DAU`), 7 ngày qua (`WAU`), 30 ngày qua (`MAU`) và tỷ lệ `% Mobile / % Desktop` (đọc từ 30 document gần nhất của `analytics_daily` -> chỉ tốn tối đa 30 lượt đọc!).
2. **Xếp hạng tính năng:** Top 5 tính năng khách dùng nhiều nhất & các tính năng gần như không ai bấm (để Founder biết nên đầu tư vào đâu).
3. **Danh sách Feedback mới nhất:** Lọc theo `Chưa xử lý (new)` / `Đã xử lý (resolved)`, ưu tiên hiện các báo lỗi `1–2 ⭐` lên đầu.
