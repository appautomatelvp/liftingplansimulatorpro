# 08. BẢN ĐỒ KHO BÁU & 15 KHỐI LEGO CÓ SẴN TRONG `D:\APP PROJECT` (V4.0)
**Đã định vị đường dẫn chính xác từ toàn bộ 25+ dự án trong ổ cứng của mày.**
Mỗi khi làm dự án mới, mày chỉ cần copy câu lệnh ở cuối file này và chỉ tên khối Lego muốn lấy — AI sẽ bốc đúng code đã chạy ổn định của mày sang dùng ngay trong 30 giây!

---

## I. NHÓM LEGO HẠ TẦNG, BẢO MẬT & THANH TOÁN SAAS

### 1. Bộ Thanh Toán Tự Động VietQR & Quản Lý Gói Cước SaaS (Chế độ Chỉ Đọc khi hết hạn)
- **Đường dẫn gốc:**
  - `D:\APP PROJECT\PHUONG PROJECT\CARBOOK\functions\api\webhooks\vietqr.js` (Webhook nhận biến động số dư tự động gia hạn gói)
  - `D:\APP PROJECT\PHUONG PROJECT\CARBOOK\src\utils\subscriptionService.js` (19.7 KB — `evaluateSubscriptionAccess`, `calculateExtendedExpiry`, `generateOrderCode`)
  - `D:\APP PROJECT\PHUONG PROJECT\CARBOOK\src\components\subscription\SubscriptionGate.jsx` (23.8 KB)
  - `D:\APP PROJECT\PHUONG PROJECT\CARBOOK\src\cms\CmsApp.jsx` (51.5 KB — Cổng quản trị thành viên, gói cước & doanh thu)

### 2. Bộ Xác Thực Nickname / PIN / Cloudflare Turnstile Chống Spam
- **Đường dẫn gốc:**
  - `D:\APP PROJECT\PHUONG PROJECT\CARBOOK\functions\api\auth\resolve-nick.js` (Xác thực Turnstile + tra cứu Nickname qua Firestore REST API)
  - `D:\APP PROJECT\PHUONG PROJECT\CARBOOK\src\utils\antiSpam.js` & `profanityFilter.js`
  - `D:\APP PROJECT\PHUONG PROJECT\SMARTROUTE\src\components\PinLogin.jsx` (18.0 KB)

### 3. Bộ Đồng Bộ Local-First & Chống Tràn 5MB `localStorage` + Lọc `undefined`
- **Đường dẫn gốc:**
  - `D:\APP PROJECT\PHUONG PROJECT\CARBOOK\src\utils\localDataStore.js` (`withoutDataUrls`, `freeLocalQuota`)
  - `D:\APP PROJECT\PHUONG PROJECT\CARBOOK\src\utils\firestoreSanitize.js` & `firestoreBootstrap.js` (`seedCollectionIfEmpty`, `probeFirestoreUsersWrite`)
  - `D:\APP PROJECT\CMIT\CMIT-PROJECT\containercheckingcmitapp\patch8.js` (Thuật toán Delta Sync lùi 5 phút + dọn rác 30 ngày)

### 4. Bộ Khóa Tạm Dừng Hệ Thống Từ Xa (`PauseLock`)
- **Đường dẫn gốc:**
  - `D:\APP PROJECT\CMIT\CMIT-PROJECT\herocmitapp\pauselock\pauselock-core.js` & `pauselock.jsx`

### 5. Bộ Gọi Gemini AI Serverless Có Fallback Model & Chống Lỗi 429
- **Đường dẫn gốc:**
  - `D:\APP PROJECT\CMIT\CMIT-PROJECT\containercheckingcmitapp\api\gemini.js` & `src\utils\geminiAi.js`
  - `D:\APP PROJECT\PHUONG PROJECT\WISOPFASTER\src\utils\geminiApi.js`

---

## II. NHÓM LEGO GIAO DIỆN, BẢNG BIỂU, QR & XUẤT BÁO CÁO

### 6. Bộ Undo / Redo Đa Vùng (`Ctrl+Z` / `Ctrl+Y`) & Bảng Xếp Ca Ảo Hóa Hiệu Năng Cao
- **Đường dẫn gốc:**
  - `D:\APP PROJECT\PHUONG PROJECT\ROSTER2\roster-app\src\context\UndoRedoContext.jsx` & `src\hooks\useUndoRedo.js`
  - `D:\APP PROJECT\PHUONG PROJECT\ROSTER2\roster-app\src\hooks\useVirtualRowWindow.js` & `useGridMultiSelect.js`
  - `D:\APP PROJECT\PHUONG PROJECT\ROSTER2\roster-app\src\utils\weekDoc.js` (Chia dữ liệu Firestore theo từng tuần)

### 7. Bộ Quét Mã QR Camera / Ảnh Tải Lên & Xuất Thẻ QR Dọc (`400x640`)
- **Đường dẫn gốc:**
  - `D:\APP PROJECT\CMIT\CMIT-PROJECT\herocmitapp\src\components\qr\QRScannerModal.jsx` (12.5 KB)
  - `D:\APP PROJECT\CMIT\CMIT-PROJECT\herocmitapp\src\components\QRCodeDisplay.jsx` (8.1 KB — `downloadHeroCard`)

### 8. Bộ Xuất PDF A4 Song Ngữ, Nén Ảnh `<canvas>` & Xuất Excel Chuyên Nghiệp
- **Đường dẫn gốc:**
  - `D:\APP PROJECT\CMIT\CMIT-PROJECT\containercheckingcmitapp\src\utils\pdfUtils.js` (7.9 KB)
  - `D:\APP PROJECT\CMIT\CMIT-PROJECT\containercheckingcmitapp\src\legacy\utils\imageUtils.js` (`compressImageForPDF`)
  - `D:\APP PROJECT\PHUONG PROJECT\ROSTER2\roster-app\src\utils\excelExport.js` & `excelStyle.js`

### 9. Bộ Tìm Kiếm Tức Thì Bigram / Trigram Trong RAM & Hoàn Tác Lịch Sử Hàng Loạt
- **Đường dẫn gốc:**
  - `D:\APP PROJECT\CMIT\CMIT-PROJECT\containercheckingcmitapp\src\legacy\containercheckingLegacy.jsx` (`bigramIndexRef`, `trigramIndexRef`)
  - `D:\APP PROJECT\CMIT\CMIT-PROJECT\containercheckingcmitapp\src\legacy\components\HistoryManagementView.jsx` (Hoàn tác `writeBatch`)

### 10. Bộ Tiện Ích Chuỗi Tiếng Việt, Chuẩn Hóa SĐT & Biểu Đồ SVG Thuần
- **Đường dẫn gốc:**
  - `D:\APP PROJECT\CMIT\CMIT-PROJECT\herocmitapp\src\lib\utils.js` (28.2 KB — `removeAccents`, `normalizePhone`)
  - `D:\APP PROJECT\PHUONG PROJECT\BIKEWORKSHOP\src\components\SVGPriceChart.jsx` (14.9 KB — Biểu đồ không cần thư viện ngoài)

---

## III. NHÓM LEGO KỸ THUẬT 3D, BẢN ĐỒ & MÔ PHỎNG VẬT LÝ

### 11. Khung Đồ Họa Three.js r170+ Chuẩn Điện Ảnh & Vật Liệu PBR Tự Sinh (`SceneRenderer` + `PBRMaterialFactory`)
- **Đường dẫn gốc:**
  - `D:\APP PROJECT\PHUONG PROJECT\LIFTING PLAN SIMULATOR PRO\src\graphics\SceneRenderer.js` (11.8 KB — `ACESFilmicToneMapping`, `SRGBColorSpace`, `QUALITY_TIERS`)
  - `D:\APP PROJECT\PHUONG PROJECT\LIFTING PLAN SIMULATOR PRO\src\graphics\PBRMaterialFactory.js` (25.7 KB — Sinh texture bê tông/thép 1024px bằng Canvas)

### 12. Bộ Cách Ly Động Cơ Vật Lý Rapier3D / Cannon-es & Vòng Lặp Bước Cố Định (`Physics Quarantine`)
- **Đường dẫn gốc:**
  - `D:\APP PROJECT\PHUONG PROJECT\LIFTING PLAN SIMULATOR PRO\src\core\physics-world\PhysicsWorldManager.js`, `RapierBackend.js`, `CannonBackend.js`, `FixedStepLoop.js`

### 13. Bộ Tính Toán Cáp Cẩu, Tiêu Chuẩn Nâng Hạ & Động Lực Học Dây Cáp XPBD
- **Đường dẫn gốc:**
  - `D:\APP PROJECT\PHUONG PROJECT\LIFTING PLAN SIMULATOR PRO\src\core\standards\RiggingRuleEngine.js` (9.2 KB)
  - `D:\APP PROJECT\PHUONG PROJECT\LIFTING PLAN SIMULATOR PRO\src\rigging\CableDynamicsXPBD.js` (13.6 KB)
  - `D:\APP PROJECT\PHUONG PROJECT\LIFTING PLAN SIMULATOR PRO\src\core\CraneLoadChartEngine.js` & `GroundPressureEngine.js`

### 14. Bộ Định Tuyến Bản Đồ, Google Routes Proxy & Đồng Bộ Google Maps
- **Đường dẫn gốc:**
  - `D:\APP PROJECT\PHUONG PROJECT\CARBOOK\functions\api\route.js` (Google Routes v2 `TWO_WHEELER` / `DRIVE`)
  - `D:\APP PROJECT\PHUONG PROJECT\CARBOOK\src\utils\googleMapsSync.js` (19.9 KB)

### 15. Bộ Soạn Thảo Quy Trình SOP & Vẽ Sơ Đồ Mermaid Trực Quan
- **Đường dẫn gốc:**
  - `D:\APP PROJECT\PHUONG PROJECT\WISOPFASTER\src\components\MermaidEditorModal.jsx` (21.4 KB) & `src\utils\sopParser.js`

---

## CÂU LỆNH "BÙA BỐC LEGO" (DÁN CHO AI KHI MUỐN LẮP TÍNH NĂNG CŨ VÀO DỰ ÁN MỚI)
> "Hãy mở file ở đường dẫn `[DÁN ĐƯỜNG DẪN TỪ DANH SÁCH TRÊN]` trong ổ cứng của tao, rút trích đúng cụm chức năng `[TÊN CHỨC NĂNG]` và đóng gói lại thành module sạch sẽ (dưới 300 dòng) để lắp vào dự án hiện tại. Đảm bảo tuân thủ `.cursorrules` và không sửa đổi dự án gốc."
