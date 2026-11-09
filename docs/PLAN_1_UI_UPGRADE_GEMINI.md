# KẾ HOẠCH 1 (CẬP NHẬT GIAI ĐOẠN 2) — KIỂM TOÁN THỰC TẾ & PHƯƠNG ÁN SỬA DỨT ĐIỂM CHO GEMINI FLASH

> **Dự án:** Lifting Plan Simulator Pro · **File chính:** [`index.html`](file:///d:/APP%20PROJECT/PHUONG%20PROJECT/LIFTING%20PLAN%20SIMULATOR%20PRO/index.html), [`src/styles/app.css`](file:///d:/APP%20PROJECT/PHUONG%20PROJECT/LIFTING%20PLAN%20SIMULATOR%20PRO/src/styles/app.css), [`src/sim/session.js`](file:///d:/APP%20PROJECT/PHUONG%20PROJECT/LIFTING%20PLAN%20SIMULATOR%20PRO/src/sim/session.js), [`src/sim/ui-layout.js`](file:///d:/APP%20PROJECT/PHUONG%20PROJECT/LIFTING%20PLAN%20SIMULATOR%20PRO/src/sim/ui-layout.js)
> **Mục tiêu Giai đoạn 2:** Xử lý triệt để 100% các lỗi hiển thị thực tế phát hiện qua ảnh chụp màn hình sau đợt nâng cấp đầu tiên, đảm bảo giao diện đạt chuẩn phần mềm kỹ thuật CAE chuyên nghiệp.

---

## PHẦN I — BÁO CÁO KIỂM TOÁN: ĐỐI CHIẾU THỰC TẾ HỆ THỐNG VỚI KẾ HOẠCH 1 BAN ĐẦU

Qua kiểm tra trực tiếp mã nguồn hiện tại và đối chiếu với 2 ảnh chụp màn hình thực tế của người dùng, dưới đây là đánh giá trung thực từng hạng mục đã làm và chưa đạt:

### 1. Bảng tổng hợp mức độ hoàn thành các Bước (0 → 10)

| Bước trong Kế hoạch 1 | Trạng thái thực tế | Đánh giá chi tiết & Nguyên nhân tồn đọng |
|---|---|---|
| **Bước 0:** Registry ID & Hạ tầng Playwright | ✅ **Đạt (100%)** | Đã xuất [`docs/ui-id-registry.md`](file:///d:/APP%20PROJECT/PHUONG%20PROJECT/LIFTING%20PLAN%20SIMULATOR%20PRO/docs/ui-id-registry.md) (449 ID), cài `@playwright/test`, giữ nguyên 2 tab **Dầm (`rig`)** và **Cáp (`gear`)** tách biệt. |
| **Bước 1:** Chuẩn hóa thang `z-index` tokens | ✅ **Đạt (95%)** | Đã tạo `:root` tokens (`--z-canvas` → `--z-toast`). Tuy nhiên `#fit-banner` đang dùng `--z-hud` (20) thấp hơn `#bottom-dock-bar` (`--z-dock` = 30) nên bị Dock đè. |
| **Bước 2:** Khung bố cục, vùng an toàn & `#fit-banner` | ❌ **Chưa đạt (40%)** | **Lỗi 1:** `#fit-banner` vẫn nằm trong luồng flex cuối `#ui-layer` nên rơi xuống đáy màn hình và bị `#dock-hud` che khuất.<br>**Lỗi 2:** `#right-side-drawer` bị khống chế `bottom: 68px` (trong khi Dock đã dịch sang trái), tạo ra khoảng trống đen ~70px rất xấu dưới đáy Drawer. |
| **Bước 3:** Gộp điều hướng 6 Tab trong Drawer | ❌ **Chưa đạt (50%)** | Đã bỏ menu trùng dưới Dock, nhưng `#drawer-inner-tabs` lại để `flex overflow-x-auto` trên 1 hàng ngang → sinh ra **thanh kéo ngang** và làm khuất mất Tab 4, 5, 6. |
| **Bước 4:** Tái cấu trúc nội dung 6 Tab (1.x–6.x) | ⚠️ **Đạt một phần (75%)** | Đã chuyển CoG về Tab ① và đánh số lại 1.1–6.3. Tuy nhiên các mục chưa có tính năng thu gọn `<details>` đồng bộ, và Tab ④ vẫn còn bảng thanh tải `bar-t0..t3` làm trang bị dài. |
| **Bước 5:** Top Bar → 5 Menu thả xuống | ❌ **Lỗi nghiêm trọng (30%)** | **Lỗi liệt nút Camera, Hồ Sơ, Hệ Thống:** 3 panel `#dropdown-panel-camera`, `#dropdown-panel-docs`, `#dropdown-panel-system` bị đặt **bên trong** `<header id="top-bar">` vốn có `backdrop-filter: blur(20px)` + `max-height: 44px; overflow: hidden` → khi mở ra bị `#top-bar` cắt cụt 100%, không hiện lên màn hình! Ngoài ra 3 nút `CAD`, `X-Ray`, `Lực` vẫn nằm rời ngoài Top Bar. |
| **Bước 6:** Panel Kiểm định & Phân tích | ⚠️ **Đạt một phần (80%)** | Đã chuyển `#compliance-hud-panel` và `#gear-editor` sang góc trái không còn đè lên Drawer phải. |
| **Bước 7:** Bộ điều khiển loại trừ `ui-layout.js` | ✅ **Đạt (90%)** | Đã tạo [`src/sim/ui-layout.js`](file:///d:/APP%20PROJECT/PHUONG%20PROJECT/LIFTING%20PLAN%20SIMULATOR%20PRO/src/sim/ui-layout.js) quản lý đóng/mở Modal, Menu, Drawer và phím `Esc`. |
| **Bước 8:** Phân nhóm Dock & Chống tràn HUD | ⚠️ **Chưa đạt phần HUD (60%)** | Đã chia 4 cụm `dock-sim`, `dock-crane`, `dock-rec`, `dock-hud` và bỏ cụm yaw trùng. **NHƯNG** các ô số trong `#dock-hud` (`.hud-card`) bị giới hạn `max-width: 52px` làm các con số hàng 2 (`77.5 t`, `0.0 m`, `0.00 / 0.00 m`, `0.0°`) tràn đè chữ lên nhau. |
| **Bước 9 & 10:** UTF-8, `data-testid` & Tài liệu | ✅ **Đạt (100%)** | Không còn lỗi font UTF-8, đã gắn `data-testid` cho các khối chính. |

---

### 2. Giải phẫu 5 nguyên nhân gốc rễ từ Code (Root-Cause Analysis)

> [!CAUTION]
> **Gemini Flash cần đọc kỹ 5 nguyên nhân dưới đây trước khi sửa code để hiểu chính xác tại sao giao diện bị lỗi:**

1. **Tại sao bấm nút `Camera` (và `Hồ Sơ & Chuẩn`, `Hệ Thống`) không hiện gì?**
   - Trong [`index.html`](file:///d:/APP%20PROJECT/PHUONG%20PROJECT/LIFTING%20PLAN%20SIMULATOR%20PRO/index.html#L244-L340), 3 thẻ `<div id="dropdown-panel-camera">`, `<div id="dropdown-panel-docs">`, `<div id="dropdown-panel-system">` đang là con trực tiếp của `<header id="top-bar">`.
   - Trong [`src/styles/app.css`](file:///d:/APP%20PROJECT/PHUONG%20PROJECT/LIFTING%20PLAN%20SIMULATOR%20PRO/src/styles/app.css#L60-L84), `#top-bar` có:
     ```css
     height: 44px !important;
     max-height: 44px !important;
     backdrop-filter: blur(20px);
     overflow-x: hidden !important;
     overflow-y: hidden !important;
     ```
   - Theo đặc tả CSS của trình duyệt, khi thẻ cha (`#top-bar`) có `backdrop-filter`, nó trở thành **containing block** của mọi thẻ con có `position: fixed` hoặc `position: absolute`. Kết hợp với `max-height: 44px; overflow: hidden`, mọi popup mở ở tọa độ `top: 50px` (bên dưới thanh Top Bar) đều bị cắt phăng 100%!
   - Bằng chứng: Hai nút `Hiển Thị` và `Đồ Họa` vẫn bấm được bình thường vì `#display-options-popover` và `#gfx-menu-popover` nằm ở cuối `<body>` (dòng 2628 & 2714), bên ngoài `<header id="top-bar">`.

2. **Tại sao dòng cảnh báo đỏ (`#fit-banner`: *"Cáp không giãn — cáp trên 2 không tới..."*) bị ẩn đằng sau bảng chỉ số `#dock-hud`?**
   - Trong [`src/styles/app.css`](file:///d:/APP%20PROJECT/PHUONG%20PROJECT/LIFTING%20PLAN%20SIMULATOR%20PRO/src/styles/app.css#L108-L113), `#ui-layer` là `display: flex; flex-direction: column; justify-content: flex-end; z-index: var(--z-hud) (20)`.
   - Khi chuyển `#bottom-dock-bar` sang `position: fixed; bottom: 6px; z-index: var(--z-dock) (30)`, thanh Dock thoát khỏi luồng flex của `#ui-layer`, làm cho `#fit-banner` (vốn là phần tử flex còn lại trong `#ui-layer`) tụt thẳng xuống đáy màn hình (`bottom: 0px`) ở lớp `z-index: 20` — nằm lọt thỏm phía sau `#dock-hud` (`z-index: 30`)!

3. **Tại sao bảng Menu hiệu chỉnh bên phải (`#right-side-drawer`) bị hụt một khoảng trống lớn bên dưới?**
   - Khi Drawer mở, `#bottom-dock-bar` đã tự động thu ngắn chiều ngang sang bên trái nhờ `right: calc(8px + var(--safe-right))` (tức là dưới đáy của Drawer hoàn toàn không có thanh Dock nào nằm chắn).
   - Thế nhưng cả CSS ([`src/styles/app.css` dòng 120](file:///d:/APP%20PROJECT/PHUONG%20PROJECT/LIFTING%20PLAN%20SIMULATOR%20PRO/src/styles/app.css#L120): `bottom: calc(var(--dock-h) + var(--dock-gap) * 2) !important`) lẫn JS ([`src/sim/session.js` dòng 1916 & 2001](file:///d:/APP%20PROJECT/PHUONG%20PROJECT/LIFTING%20PLAN%20SIMULATOR%20PRO/src/sim/session.js#L1915-L1916): `drawer.style.bottom = '${botH + 4}px'`) đều ép Drawer phải dừng cách đáy màn hình ~70px, tạo ra một hốc trống vô duyên ở góc dưới bên phải.

4. **Tại sao thanh chuyển Tab (`#drawer-inner-tabs`) lại xuất hiện thanh kéo ngang và che mất các tab 4, 5, 6?**
   - Trong [`index.html` dòng 549](file:///d:/APP%20PROJECT/PHUONG%20PROJECT/LIFTING%20PLAN%20SIMULATOR%20PRO/index.html#L549), `#drawer-inner-tabs` dùng `flex items-center gap-1 overflow-x-auto`. Tổng bề rộng 6 nút tab có chữ tiếng Việt + icon là ~530px, lớn hơn chiều rộng của Drawer (~360px–460px).
   - Đồng thời [`src/styles/app.css` dòng 369](file:///d:/APP%20PROJECT/PHUONG%20PROJECT/LIFTING%20PLAN%20SIMULATOR%20PRO/src/styles/app.css#L369) khai báo `::-webkit-scrollbar { height: 5px; }` khiến trình duyệt vẽ một thanh kéo ngang màu xám bên dưới các tab và cắt khuất Tab 4, 5, 6.

5. **Tại sao chữ số trong bảng `#dock-hud` dưới đáy lại đè lên nhau (`0.0 m0.00 / 0.00 m0.0°`)?**
   - Trong [`src/styles/app.css` dòng 287–288](file:///d:/APP%20PROJECT/PHUONG%20PROJECT/LIFTING%20PLAN%20SIMULATOR%20PRO/src/styles/app.css#L287-L288), `.hud-card` bị bó cứng `max-width: 52px; padding: 0 1px;` trong khi `.hud-val` có `white-space: nowrap`. Khi giá trị `#hud-cog` hiển thị `0.00 / 0.00 m` (rộng ~78px), phần chữ vượt quá 52px tràn thẳng sang 2 ô bên cạnh.

---

## PHẦN II — KẾ HOẠCH NÂNG CẤP CHI TIẾT GIAI ĐOẠN 2 (GIAO GEMINI FLASH THỰC HIỆN TỪNG BƯỚC)

> [!IMPORTANT]
> **Quy tắc bắt buộc cho Gemini Flash:**
> - Thực hiện tuần tự từ **BƯỚC F1 đến BƯỚC F6**. Mỗi bước hoàn thành phải chạy `npm run build` để kiểm tra không lỗi cú pháp rồi mới commit (`git commit -m "fix(ui-fX): ..."`).
> - **Tuyệt đối KHÔNG xóa hoặc đổi tên bất kỳ `id` nào** trong DOM.
> - Giữ nguyên tách biệt 2 tab **3. Dầm ngáng (`rig`)** và **4. Cáp treo (`gear`)**.

---

### BƯỚC F1 — Sửa dứt điểm lỗi liệt nút Camera, Hồ Sơ, Hệ Thống & Gom gọn Top Bar

#### 1.1. Di chuyển 3 khối Dropdown Panel ra khỏi `<header id="top-bar">` trong `index.html`
- **Vị trí cần sửa 1 — Trong `<header id="top-bar">` ([`index.html` dòng 239–340](file:///d:/APP%20PROJECT/PHUONG%20PROJECT/LIFTING%20PLAN%20SIMULATOR%20PRO/index.html#L239-L340)):**
  - Giữ lại **chỉ các nút bấm** (`#btn-menu-camera`, `#btn-display-options`, `#btn-toggle-gfx`, `#btn-menu-docs`, `#btn-menu-system`) bên trong `<header id="top-bar">`.
  - **Cắt (Cut)** toàn bộ 3 thẻ `<div id="dropdown-panel-camera">...</div>`, `<div id="dropdown-panel-docs">...</div>`, `<div id="dropdown-panel-system">...</div>` ra khỏi `<header id="top-bar">`.
  - **Cắt (Cut)** 3 nút rời `#btn-toggle-cad-edges` (CAD), `#btn-xray` (X-Ray), `#btn-toggle-vectors` (Lực) đang nằm ở dòng 276–278 của `#top-bar` để đưa vào trong đầu menu `#display-options-popover`.

- **Code thay thế cho cụm 5 nút Menu trong `<header id="top-bar">` (`index.html` dòng 239–341):**
```html
        <!-- CỤM 5 MENU ĐIỀU KHIỂN TRUNG TÂM & NÚT ĐÓNG/MỞ DRAWER -->
        <div class="flex items-center gap-1.5 shrink-0">
            <!-- 1. MENU CAMERA -->
            <div id="menu-camera" class="menu-dropdown relative inline-block dropdown-wrapper shrink-0">
                <button id="btn-menu-camera" type="button" class="pendant-btn !py-1 !px-2.5 text-[11px] font-bold whitespace-nowrap flex items-center gap-1 shadow" data-testid="menu-camera" title="Góc nhìn camera 3D &amp; Chế độ bám">
                    <span>🎥 Camera</span> <span class="text-[8px] transition-transform" id="arrow-camera-menu">▼</span>
                </button>
            </div>

            <!-- 2. MENU HIỂN THỊ -->
            <div id="menu-display" class="menu-dropdown relative inline-block dropdown-wrapper shrink-0">
                <button id="btn-display-options" type="button" class="pendant-btn emerald !py-1 !px-2.5 text-[11px] font-bold whitespace-nowrap flex items-center gap-1 shadow" data-testid="menu-display" title="Tùy chọn ẩn/hiện CAD, X-Ray, véc-tơ lực và các chỉ số kỹ thuật 3D">
                    <span>👁️ Hiển Thị</span>
                    <span class="text-[8px] transition-transform" id="arrow-display-options">▼</span>
                </button>
            </div>

            <!-- 3. MENU ĐỒ HỌA -->
            <div id="menu-gfx" class="menu-dropdown relative inline-block dropdown-wrapper shrink-0">
                <button id="btn-toggle-gfx" type="button" class="pendant-btn !py-1 !px-2.5 text-[11px] font-bold whitespace-nowrap flex items-center gap-1 shadow" data-testid="menu-gfx" title="Cấu hình đồ họa &amp; Ánh sáng môi trường CAE">
                    <span>✨ Đồ Họa</span>
                    <span class="text-[8px] transition-transform" id="arrow-gfx-menu">▼</span>
                </button>
            </div>

            <!-- 4. MENU HỒ SƠ & TIÊU CHUẨN -->
            <div id="menu-docs" class="menu-dropdown relative inline-block dropdown-wrapper shrink-0">
                <button id="btn-menu-docs" type="button" class="pendant-btn yellow !py-1 !px-2.5 text-[11px] font-bold whitespace-nowrap flex items-center gap-1 shadow" data-testid="menu-docs" title="Hồ sơ Lift Plan, Tiêu chuẩn an toàn &amp; Thư viện 3D">
                    <span>📋 Hồ Sơ &amp; Chuẩn</span> <span class="text-[8px] transition-transform" id="arrow-docs-menu">▼</span>
                </button>
            </div>

            <!-- 5. MENU HỆ THỐNG -->
            <div id="menu-system" class="menu-dropdown relative inline-block dropdown-wrapper shrink-0">
                <button id="btn-menu-system" type="button" class="pendant-btn !py-1 !px-2.5 text-[11px] font-bold whitespace-nowrap flex items-center gap-1 shadow" data-testid="menu-system" title="Cài đặt hệ thống, đơn vị, âm thanh &amp; toàn màn hình">
                    <span>⚙️ Hệ Thống</span> <span class="text-[8px] transition-transform" id="arrow-system-menu">▼</span>
                </button>
            </div>

            <!-- NÚT MỞ/ĐÓNG BẢNG THÔNG SỐ (DRAWER TOGGLE) -->
            <button id="btn-toggle-drawer" type="button" class="pendant-btn emerald !py-1 !px-2.5 text-[11px] font-extrabold shadow-lg flex items-center gap-1.5 ml-1" title="Mở/Đóng Bảng Thông Số Kỹ Thuật (Phím 1-6 / Esc)" data-testid="drawer-toggle">
                <span>📐</span> <span>Thông Số (1-6)</span>
            </button>
        </div>
```

- **Vị trí cần sửa 2 — Đặt toàn bộ 5 Popover Panel ở cuối `<body>` ([`index.html` dòng 2625 trở đi](file:///d:/APP%20PROJECT/PHUONG%20PROJECT/LIFTING%20PLAN%20SIMULATOR%20PRO/index.html#L2625-L2748)):**
  - Đặt `#dropdown-panel-camera`, `#display-options-popover` (có tích hợp 3 nút `#btn-toggle-cad-edges`, `#btn-xray`, `#btn-toggle-vectors` ở ngay hàng đầu tiên), `#gfx-menu-popover`, `#dropdown-panel-docs`, `#dropdown-panel-system` nằm ngang hàng nhau trực tiếp dưới `<body>`, dùng class chung `.topbar-popover-panel`:
```html
    <!-- ======================================================================= -->
    <!-- FLOATING POPOVERS: ĐẶT Ở CẤP ROOT BODY ĐỂ KHÔNG BỊ #TOP-BAR CẮT (CLIP)  -->
    <!-- ======================================================================= -->

    <!-- 1. POPOVER CAMERA -->
    <div id="dropdown-panel-camera" class="topbar-popover-panel hidden fixed bg-slate-900/98 backdrop-blur-xl border border-sky-500/50 rounded-lg shadow-2xl p-3 text-xs text-slate-200 select-none w-72 box-border pointer-events-auto">
        <div class="flex items-center justify-between pb-2 mb-2 border-b border-slate-700/80">
            <span class="font-extrabold text-[11px] uppercase tracking-wider text-sky-400">🎥 Góc Nhìn Camera 3D</span>
        </div>
        <div class="grid grid-cols-3 gap-1.5 mb-2.5">
            <button type="button" class="pendant-btn !py-1.5 !px-2 text-[11px] cam-btn active justify-center" data-cam="iso" title="Phối cảnh 3D cận cảnh">Iso</button>
            <button type="button" class="pendant-btn !py-1.5 !px-2 text-[11px] cam-btn justify-center" data-cam="hook" title="Cận cảnh Đầu Hook &amp; Cáp">Móc</button>
            <button type="button" class="pendant-btn !py-1.5 !px-2 text-[11px] cam-btn justify-center" data-cam="front" title="Mặt đứng chính diện">Đứng</button>
            <button type="button" class="pendant-btn !py-1.5 !px-2 text-[11px] cam-btn justify-center" data-cam="side" title="Mặt bên">Bên</button>
            <button type="button" class="pendant-btn !py-1.5 !px-2 text-[11px] cam-btn justify-center" data-cam="top" title="Mặt bằng kiểm tra CoG">Bằng</button>
            <button type="button" class="pendant-btn !py-1.5 !px-2 text-[11px] cam-btn justify-center" data-cam="crane" title="Toàn cảnh máy cẩu">Cẩu</button>
        </div>
        <div class="pt-2 border-t border-slate-800 flex items-center justify-between gap-2">
            <button id="btn-cam-follow" type="button" class="pendant-btn !py-1 !px-2 text-[10.5px] flex items-center gap-1 font-semibold text-slate-300 hover:text-sky-300 transition">
                <span>🎥</span>
                <span id="cam-follow-label">Bám: TẮT</span>
            </button>
            <select id="sel-cam-follow-mode" class="hidden bg-slate-800 text-sky-300 border border-slate-600 rounded text-[10px] px-1.5 py-1 outline-none focus:border-sky-400 cursor-pointer">
                <option value="cog">Trọng tâm (CoG)</option>
                <option value="center">Tâm kiện (Center)</option>
                <option value="top">Đỉnh kiện (Top)</option>
                <option value="hook">Móc cẩu (Hook)</option>
                <option value="lp1">Tai cẩu LP1</option>
                <option value="lp2">Tai cẩu LP2</option>
                <option value="lp3">Tai cẩu LP3</option>
                <option value="lp4">Tai cẩu LP4</option>
                <option value="custom">Tùy chỉnh...</option>
            </select>
        </div>
    </div>

    <!-- 2. POPOVER HIỂN THỊ (Tích hợp luôn CAD, X-Ray, Véc-tơ Lực ở đầu) -->
    <!-- Giữ nguyên #display-options-popover, chèn thêm hàng 3 nút nhanh ở ngay dưới tiêu đề: -->
    <!--
        <div class="grid grid-cols-3 gap-1.5 pb-2 mb-2 border-b border-slate-800">
            <button id="btn-toggle-cad-edges" type="button" class="pendant-btn !py-1 !px-2 text-[10.5px] justify-center" title="Bật nét CAD kỹ thuật">📐 Nét CAD</button>
            <button id="btn-xray" type="button" class="pendant-btn !py-1 !px-2 text-[10.5px] justify-center" title="Nhìn xuyên vỏ hàng">🔍 X-Ray</button>
            <button id="btn-toggle-vectors" type="button" class="pendant-btn !py-1 !px-2 text-[10.5px] justify-center" title="Mũi tên véc-tơ lực cáp">↗️ Véc-tơ Lực</button>
        </div>
    -->

    <!-- 4. POPOVER HỒ SƠ & CHUẨN -->
    <div id="dropdown-panel-docs" class="topbar-popover-panel hidden fixed bg-slate-900/98 backdrop-blur-xl border border-amber-500/50 rounded-lg shadow-2xl p-2.5 text-xs text-slate-200 select-none w-64 box-border pointer-events-auto space-y-1.5">
        <div class="text-[10px] font-extrabold uppercase tracking-wider text-amber-400 pb-1 border-b border-slate-800">📋 Hồ Sơ Kỹ Thuật &amp; Thư Viện</div>
        <button id="btn-open-compliance" type="button" class="w-full text-left pendant-btn emerald !py-1.5 !px-2.5 text-[11px] font-bold shadow flex items-center gap-2">
            <span>🛡️</span> <span>Kiểm Định An Toàn (ASME/ISO)</span>
        </button>
        <button id="btn-open-liftplan" type="button" class="w-full text-left pendant-btn yellow !py-1.5 !px-2.5 text-[11px] font-bold shadow flex items-center gap-2">
            <span>📋</span> <span>Hồ Sơ Lift Plan ASME P30.1</span>
        </button>
        <button id="btn-quick-export-pdf" type="button" class="w-full text-left pendant-btn !py-1.5 !px-2.5 text-[11px] font-bold shadow bg-rose-700/90 hover:bg-rose-600 text-white border border-rose-400/80 flex items-center gap-2">
            <span>📄</span> <span>Xuất Báo Cáo PDF</span>
        </button>
        <div class="h-px bg-slate-800 my-1"></div>
        <button id="btn-open-3d-library" type="button" class="w-full text-left pendant-btn blue !py-1.5 !px-2.5 text-[11px] font-bold shadow flex items-center gap-2">
            <span>📚</span> <span>Thư Viện 3D &amp; Upload CAD</span>
        </button>
    </div>

    <!-- 5. POPOVER HỆ THỐNG -->
    <div id="dropdown-panel-system" class="topbar-popover-panel hidden fixed bg-slate-900/98 backdrop-blur-xl border border-slate-600 rounded-lg shadow-2xl p-2.5 text-xs text-slate-200 select-none w-56 box-border pointer-events-auto space-y-1.5">
        <div class="text-[10px] font-extrabold uppercase tracking-wider text-slate-300 pb-1 border-b border-slate-800">⚙️ Cài Đặt Hệ Thống</div>
        <div class="flex items-center justify-between p-1 hover:bg-slate-800/80 rounded">
            <span>Âm thanh (M):</span>
            <button id="btn-sound-toggle" type="button" class="pendant-btn !px-2.5 !py-0.5 text-[10.5px] active">🔊 Bật</button>
        </div>
        <div class="flex items-center justify-between p-1 hover:bg-slate-800/80 rounded">
            <span>Ngôn ngữ:</span>
            <button id="btn-lang" type="button" class="pendant-btn !px-2.5 !py-0.5 text-[10.5px] text-amber-200 border-amber-400/50">VI / EN</button>
        </div>
        <div class="flex items-center justify-between p-1 hover:bg-slate-800/80 rounded">
            <span>Hệ đo lường:</span>
            <button id="btn-unit-toggle" type="button" class="pendant-btn !px-2.5 !py-0.5 text-[10.5px] font-bold text-sky-200 border-sky-400/50">Mét (m)</button>
        </div>
        <div class="flex items-center justify-between p-1 hover:bg-slate-800/80 rounded">
            <span>Toàn màn hình (H):</span>
            <button id="btn-fullscreen-view" type="button" class="pendant-btn yellow !px-2.5 !py-0.5 text-[10.5px]">⛶ Mở</button>
        </div>
    </div>
```

#### 1.2. Cập nhật `allDropdowns` trong [`src/sim/session.js` (dòng 3240–3305)](file:///d:/APP%20PROJECT/PHUONG%20PROJECT/LIFTING%20PLAN%20SIMULATOR%20PRO/src/sim/session.js#L3240-L3305)
- Bổ sung `arrowId` cho cả 5 menu (`arrow-camera-menu`, `arrow-display-options`, `arrow-gfx-menu`, `arrow-docs-menu`, `arrow-system-menu`).
- Khi click vào một mục hành động bên trong `#dropdown-panel-docs` (`#btn-open-compliance`, `#btn-open-liftplan`, `#btn-quick-export-pdf`, `#btn-open-3d-library`) hoặc chọn góc `.cam-btn`, tự động gọi `closeAllTopDropdowns()` để đóng menu gọn gàng ngay lập tức.

---

### BƯỚC F2 — Xóa bỏ thanh kéo ngang Tab Menu, hiển thị đồng thời cả 6 Tab bằng Lưới 3×2

> **Yêu cầu của người dùng:** *"TAO KO MUỐN DÙNG NHỮNG THANH KÉO NGANG ĐỂ CHUYỂN TAB MENU MÀ TẤT CẢ CÁC TAB PHẢI HIỆN HỮU CHO DỄ SỬ DỤNG."*

#### 2.1. Sửa HTML `#drawer-inner-tabs` trong [`index.html` (dòng 548–556)](file:///d:/APP%20PROJECT/PHUONG%20PROJECT/LIFTING%20PLAN%20SIMULATOR%20PRO/index.html#L548-L556)
- Thay `flex items-center gap-1 ... overflow-x-auto` bằng lưới cố định 3 cột × 2 hàng (`grid grid-cols-3 gap-1.5`):
```html
            <!-- Thanh chuyển 6 Tab hiển thị 100% dạng Lưới 3x2 — TUYỆT ĐỐI KHÔNG CUỘN NGANG -->
            <div class="grid grid-cols-3 gap-1.5 px-2.5 py-2 border-b border-slate-800 bg-slate-950/90 shrink-0" id="drawer-inner-tabs" role="tablist" aria-label="Các trang hiệu chỉnh">
                <button class="drawer-inner-tab-btn active" data-drawer-tab="cargo" type="button" role="tab" data-testid="tab-cargo">📦 1. Hàng hóa</button>
                <button class="drawer-inner-tab-btn" data-drawer-tab="lugs" type="button" role="tab" data-testid="tab-lugs">📍 2. Điểm nâng</button>
                <button class="drawer-inner-tab-btn" data-drawer-tab="rig" type="button" role="tab" data-testid="tab-rig">🟠 3. Dầm ngáng</button>
                <button class="drawer-inner-tab-btn" data-drawer-tab="gear" type="button" role="tab" data-testid="tab-gear">⛓️ 4. Cáp treo</button>
                <button class="drawer-inner-tab-btn" data-drawer-tab="crane" type="button" role="tab" data-testid="tab-crane">🏗️ 5. Cẩu 3D</button>
                <button class="drawer-inner-tab-btn" data-drawer-tab="site" type="button" role="tab" data-testid="tab-site">🌍 6. Hiện trường</button>
            </div>
```

#### 2.2. Sửa CSS `.drawer-inner-tab-btn` trong [`src/styles/app.css` (dòng 154–177)](file:///d:/APP%20PROJECT/PHUONG%20PROJECT/LIFTING%20PLAN%20SIMULATOR%20PRO/src/styles/app.css#L154-L177)
```css
        #drawer-inner-tabs {
            display: grid !important;
            grid-template-columns: repeat(3, minmax(0, 1fr)) !important;
            gap: 5px !important;
            overflow: visible !important;
        }
        .drawer-inner-tab-btn {
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 4px;
            padding: 5px 6px;
            font-size: 11px;
            font-weight: 700;
            border-radius: 6px;
            color: #94a3b8;
            background: rgba(15, 23, 42, 0.85);
            border: 1px solid rgba(51, 65, 85, 0.7);
            white-space: nowrap;
            cursor: pointer;
            transition: all 0.15s ease;
            box-sizing: border-box !important;
            line-height: 1.25 !important;
            text-align: center;
            min-width: 0;
        }
        .drawer-inner-tab-btn:hover {
            color: #f8fafc;
            background: rgba(30, 41, 59, 0.9);
            border-color: rgba(100, 116, 139, 0.8);
        }
        .drawer-inner-tab-btn.active {
            color: #38bdf8;
            background: linear-gradient(180deg, rgba(14, 165, 233, 0.25) 0%, rgba(3, 105, 161, 0.35) 100%);
            border-color: #38bdf8;
            box-shadow: 0 0 10px rgba(56, 189, 248, 0.25);
        }
```

---

### BƯỚC F3 — Kéo dài Bảng Menu Hiệu Chỉnh (`#right-side-drawer`) chạm sát đáy màn hình 100%

> **Yêu cầu của người dùng:** *"BẢNG MENU HIỆU CHỈNH SỐ LIỆU KO TẬN DỤNG HẾT ĐƯỢC KHOẢNG KHÔNG BÊN DƯỚI NHÌN RẤT THIẾU CHUYÊN NGHIỆP."*

#### 3.1. Sửa CSS `#right-side-drawer` trong [`src/styles/app.css` (dòng 116–153)](file:///d:/APP%20PROJECT/PHUONG%20PROJECT/LIFTING%20PLAN%20SIMULATOR%20PRO/src/styles/app.css#L116-L153)
- Vì `#bottom-dock-bar` đã tự lùi sang bên trái (`right: calc(8px + var(--safe-right))`), vùng không gian bên phải từ dưới `#top-bar` (`44px`) xuống tới sát đáy màn hình (`bottom: 0`) hoàn toàn thuộc về `#right-side-drawer`.
- Thay đổi dòng 118–120 của `src/styles/app.css`:
```css
        #right-side-drawer {
            position: fixed;
            top: var(--topbar-h) !important;
            right: 0;
            bottom: 0 !important;
            height: calc(100vh - var(--topbar-h)) !important;
            width: var(--drawer-w);
            min-width: 360px;
            max-width: 520px;
            z-index: var(--z-drawer) !important;
            background: rgba(11, 17, 32, 0.98);
            backdrop-filter: blur(24px);
            border-left: 1.5px solid rgba(71, 85, 105, 0.85);
            box-shadow: -12px 0 40px rgba(0, 0, 0, 0.75);
            transition: transform 0.28s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.25s ease;
            display: flex;
            flex-direction: column;
            pointer-events: auto !important;
            box-sizing: border-box;
        }
```
- Giảm `padding-bottom` của `#right-side-drawer > div:last-child` (dòng 150) từ `120px` xuống `32px !important` để cuộn vừa khít, chuyên nghiệp.

#### 3.2. Xóa code JS gán cứng `drawer.style.bottom` trong [`src/sim/session.js`](file:///d:/APP%20PROJECT/PHUONG%20PROJECT/LIFTING%20PLAN%20SIMULATOR%20PRO/src/sim/session.js#L1910-L2004)
- Tại hàm `openRightDrawer` (dòng 1911–1916):
  ```javascript
  const topBar = document.getElementById('top-bar');
  const topH = (topBar ? topBar.offsetHeight : 44) || 44;
  drawer.style.top = `${topH}px`;
  drawer.style.bottom = '0px';
  ```
- Tại sự kiện `window.addEventListener('resize', ...)` (dòng 1993–2003):
  ```javascript
  if (isDrawerOpen) {
      const topBar = document.getElementById('top-bar');
      const drawer = document.getElementById('right-side-drawer');
      if (drawer && topBar) {
          const topH = (topBar ? topBar.offsetHeight : 44) || 44;
          drawer.style.top = `${topH}px`;
          drawer.style.bottom = '0px';
      }
  }
  ```

---

### BƯỚC F4 — Đưa thanh Cảnh báo `#fit-banner` lên vị trí nổi độc lập, không bị `#dock-hud` che khuất

> **Yêu cầu của người dùng:** *"CẢNH BÁO VẪN BỊ ẨN ĐẰNG SAU BỞI THANH CÁC CHỈ SỐ."*

#### 4.1. Sửa CSS `#fit-banner` trong [`src/styles/app.css` (dòng 325–329)](file:///d:/APP%20PROJECT/PHUONG%20PROJECT/LIFTING%20PLAN%20SIMULATOR%20PRO/src/styles/app.css#L325-L329)
- Chuyển `#fit-banner` sang `position: fixed`, neo ở **phía trên thanh Bottom Dock** (`bottom: calc(var(--dock-h) + 22px)`), căn giữa theo vùng không gian 3D thực tế (`left: calc((100vw - var(--safe-right)) / 2); transform: translateX(-50%);`), với `z-index: var(--z-popover)` để luôn nổi rõ trên mọi thành phần:
```css
        #fit-banner {
            display: none;
            position: fixed;
            bottom: calc(var(--dock-h) + 22px);
            left: calc((100vw - var(--safe-right)) / 2);
            transform: translateX(-50%);
            max-width: calc(100vw - var(--safe-right) - 32px);
            width: max-content;
            z-index: var(--z-popover);
            background: linear-gradient(180deg, rgba(153, 27, 27, 0.96) 0%, rgba(127, 29, 29, 0.98) 100%);
            color: #fef2f2;
            border: 1.5px solid #f87171;
            box-shadow: 0 8px 25px rgba(220, 38, 38, 0.45), 0 0 12px rgba(239, 68, 68, 0.35);
            border-radius: 8px;
            padding: 6px 14px;
            font-size: 12px;
            font-weight: 700;
            text-align: center;
            pointer-events: none;
            transition: left 0.28s cubic-bezier(0.16, 1, 0.3, 1);
        }
```

---

### BƯỚC F5 — Sửa lỗi chữ đè nhau trong bảng chỉ số `#dock-hud` & Tối ưu Bottom Dock

#### 5.1. Sửa CSS `.hud-shell`, `.hud-row`, `.hud-card` trong [`src/styles/app.css` (dòng 255–312)](file:///d:/APP%20PROJECT/PHUONG%20PROJECT/LIFTING%20PLAN%20SIMULATOR%20PRO/src/styles/app.css#L255-L312)
- Xóa bỏ giới hạn `max-width: 52px` trên `.hud-card` (nguyên nhân khiến chuỗi `0.00 / 0.00 m` và `77.5 t` tràn đè lên nhau).
- Chuyển `.hud-row` sang **CSS Grid 7 cột tự cân bằng (`grid-template-columns: repeat(7, minmax(max-content, 1fr))`)** có khoảng cách rõ ràng để bảng đồng hồ kỹ thuật sắc nét, thẳng cột trên – dưới và không bao giờ đè chữ:
```css
        .hud-shell {
            background: linear-gradient(180deg, rgba(15, 23, 42, 0.94), rgba(2, 6, 23, 0.96));
            border: 1px solid rgba(56, 189, 248, 0.4);
            box-shadow: 0 8px 30px rgba(0, 0, 0, 0.65), inset 0 0 18px rgba(14, 165, 233, 0.08);
            display: flex;
            flex-direction: column;
            justify-content: center;
            gap: 3px;
            padding: 4px 10px;
            height: 100%;
            box-sizing: border-box;
        }
        .hud-row {
            display: grid;
            grid-template-columns: repeat(7, minmax(max-content, 1fr));
            align-items: center;
            column-gap: 8px;
            line-height: 1.1;
        }
        .hud-card {
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            text-align: center;
            min-width: 52px;
            padding: 1px 4px;
            box-sizing: border-box;
        }
        .hud-card .hud-label {
            font-size: 7.5px;
            font-weight: 700;
            text-transform: uppercase;
            letter-spacing: 0.03em;
            color: #94a3b8;
            white-space: nowrap;
            line-height: 1.1;
            margin-bottom: 1px;
        }
        .hud-card .hud-val {
            font-family: 'JetBrains Mono', monospace;
            font-weight: 700;
            font-size: 10.5px;
            line-height: 1.15;
            white-space: nowrap;
        }
```

#### 5.2. Cập nhật chiều cao động `--dock-h` bằng `ResizeObserver`
- Trong [`src/sim/ui-layout.js`](file:///d:/APP%20PROJECT/PHUONG%20PROJECT/LIFTING%20PLAN%20SIMULATOR%20PRO/src/sim/ui-layout.js), gắn `ResizeObserver` vào `#bottom-dock-bar` để cập nhật biến CSS `--dock-h` theo chiều cao thực tế của Dock (ví dụ khi màn hình nhỏ Dock xuống 2 dòng → `--dock-h` tăng lên → `#fit-banner` và `#gear-editor` tự động nâng cao lên theo, không bao giờ chạm vào Dock).

---

### BƯỚC F6 — Kiểm tra nghiệm thu kỹ thuật trước khi bàn giao sang Kế hoạch 2 (Codex)

Sau khi Gemini Flash hoàn tất Bước F1 → F5:
1. Chạy `npm run build` → 0 lỗi.
2. Chạy `npm test` → 160/160 test Vitest xanh.
3. Chạy script chụp lại ảnh màn hình ở 4 độ phân giải (`node scripts/capture-screens.js`) và kiểm tra bằng mắt + Playwright:
   - [ ] Nút **Camera**, **Hiển Thị**, **Đồ Họa**, **Hồ Sơ & Chuẩn**, **Hệ Thống** bấm vào đều mở popup rõ ràng bên dưới Top Bar.
   - [ ] Thanh chuyển Tab trong Drawer hiển thị dạng **Lưới 3×2 (6 tab hiện đủ 100%)**, không có thanh kéo ngang.
   - [ ] Bảng Drawer bên phải kéo dài từ sát dưới Top Bar (`44px`) tới **sát đáy màn hình (`0px`)**, không còn khoảng hở đen.
   - [ ] Thanh cảnh báo đỏ `#fit-banner` nổi rõ ràng phía trên thanh Dock, không bị `#dock-hud` che khuất.
   - [ ] Các con số trong `#dock-hud` tách cột rõ ràng, không đè chữ lên nhau.
