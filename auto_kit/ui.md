# @ui — FOUNDER DNA & UI SIGNATURE (CHỮ KÝ GIAO DIỆN 3 DÒNG SẢN PHẨM - V7)
**Đúc kết từ mã nguồn thực tế:**
- `herocmitapp/src/lib/designSystem.js` & `containercheckingcmitapp` & `shiftreportcmitapp`
- `CARBOOK/src/index.css`, `BottomNav.jsx`, `FabMenu.jsx`, `InsightsTab.jsx`
- `ROSTER2/src/components/ribbon/RosterRibbonToolbar.jsx`, `RosterGrid.jsx`
- `LIFTING PLAN SIMULATOR PRO/src/styles/app.css`, `AnalysisHUD.js`, `saas.css`

> **CHỈ THỊ CHO AI:** Mỗi khi dựng giao diện cho Founder, hãy xác định dự án thuộc dòng nào trong 3 dòng dưới đây để áp đúng "chữ ký" màu sắc, bố cục và trải nghiệm người dùng mà Founder yêu thích.

---

## 1. DÒNG 1: VẬN HÀNH CẢNG, ĐIỀU ĐỘ & XẾP CA (`CMIT`, `ROSTER2`, `BERTHOVERVIEW`, `SMARTTASK`)
- **Triết lý:** Mật độ thông tin cao, nhìn bao quát trên 1 màn hình, bảng biểu ghim đầu trang (`sticky`), phân biệt ca trực/trạng thái bằng màu sắc tương phản rõ rệt.
- **Bảng màu chữ ký (`designSystem.js`):**
  - Primary Navy: `#0f4c81` / `#1e3a8a` (Hover: `#172554`), Gradient Header: `bg-gradient-to-r from-[#1a3673] to-[#1e3a8a]`
  - Accent Cyan: `#00b4d8` | An toàn/Đạt chuẩn: `#10b981` | Cảnh báo: `#d97706` | Nguy hiểm/Hư hỏng: `#dc2626` (Nền `#fee2e2`)
  - Ca Ngày (`D1`): `bg-[#FFF9C4] text-black border-yellow-400` | Ca Đêm (`D2`): `bg-[#1a2657] text-white border-[#0f1a40]`
  - Sticky Table Header: `sticky top-0 z-[50] bg-[#eef2ff] shadow-[0_1px_0_0_rgb(199,210,254)]`
- **Tính năng UI đặc trưng:** Thanh Ribbon công cụ trên cùng (`ROSTER2`), chọn nhiều ô bằng chuột (`useGridMultiSelect`), nút Undo/Redo (`Ctrl+Z`), và xuất Excel (`xlsx-js-style`) / PDF A4 song ngữ (`jsPDF`).

---

## 2. DÒNG 2: APP DI ĐỘNG / PWA CÁ NHÂN & THƯƠNG MẠI (`CARBOOK`, `BIKEWORKSHOP`)
- **Triết lý:** Trải nghiệm mượt như App Native trên điện thoại (`Mobile-First PWA`), thao tác 1 ngón tay qua thanh điều hướng đáy (`BottomNav`) và nút cộng nổi (`FabMenu`), hỗ trợ khóa PIN nhanh (`PinScreen`) và mã QR tài khoản (`AccountQr`).
- **Thành phần UI đặc trưng (`CARBOOK`):**
  - **Bottom Navigation Bar + Floating Action Button (`FabMenu`):** Mở nhanh các phiếu nhập liệu (Đổ xăng, Bảo dưỡng, Hành trình, Chi phí).
  - **Banner Trạng thái Gói cước (`SubscriptionGate`):** Hiển thị số ngày còn lại; nếu hết hạn thì chuyển sang chế độ Chỉ Đọc kèm nút mở mã VietQR gia hạn ngay.
  - **Lịch sử & Thống kê trực quan (`InsightsTab` / `TimelineTab`):** Biểu đồ tiêu hao nhiên liệu, cảnh báo đăng kiểm/bảo hiểm/bảo dưỡng đến hạn.

---

## 3. DÒNG 3: BUỒNG LÁI MÔ PHỎNG KỸ THUẬT & ĐỒ HỌA 3D (`LIFTING PLAN SIMULATOR PRO` / `SafeLift3D`)
- **Triết lý:** Buồng lái kỹ thuật chuyên nghiệp (Industrial CAD / Engineering Dark Cockpit) — khung cảnh 3D chiếm 100% màn hình, các bảng thông số nổi bán trong suốt (`backdrop-blur`), số liệu kỹ thuật thẳng hàng tuyệt đối (`tabular-nums` / `JetBrains Mono`).
- **Thành phần UI đặc trưng (`SafeLift3D`):**
  - **Analysis HUD (`AnalysisHUD.js`):** Hiển thị trực tiếp trên màn hình 3D các chỉ số sống còn: Tải trọng thực tế (Tấn), Bán kính làm việc (m), Góc nghiêng cáp, Hệ số tải (% Load Chart), Áp lực chân chống (`GroundPressureEngine`).
  - **Đèn báo An toàn 3 cấp:** Xanh (`< 80%` tải cho phép) -> Vàng (`80% - 95%` tiệm cận giới hạn) -> Đỏ nhấp nháy (`> 95%` hoặc vi phạm góc cáp `RiggingRuleEngine`).
  - **Tùy chỉnh Chất lượng Đồ họa (`QUALITY_TIERS`):** Cho phép chuyển đổi mượt giữa `low`, `medium`, `high` để chạy tốt trên cả laptop văn phòng lẫn máy trạm.
