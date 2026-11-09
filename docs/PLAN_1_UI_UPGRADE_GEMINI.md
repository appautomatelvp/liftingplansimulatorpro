# KẾ HOẠCH 1 — NÂNG CẤP UI/UX (giao cho Gemini Flash code từng bước)

> **Dự án:** Lifting Plan Simulator Pro · **File chính:** `index.html` (2.7k dòng), `src/styles/app.css`, `src/sim/*.js` (nối bằng `vite.config.js` → `virtual:lifting-sim`)
> **Mục tiêu:** menu phân nhóm đúng, không bị che, không chồng đè, không trùng chức năng, mọi thông số chỉnh được ở đúng 1 nơi.

---

## 0. KẾT QUẢ KIỂM TRA HIỆN TRẠNG (căn cứ từ code + ảnh chụp)

| # | Lỗi | Bằng chứng | Hậu quả |
|---|-----|-----------|---------|
| L1 | **Drawer phải đè lên dock dưới & HUD cảnh báo** | `#right-side-drawer` `bottom:66px`, dock `#bottom-dock-bar` cao 56px, `z-index` 1045 > drawer 1040; câu cảnh báo "…cáp trê…" bị cắt (ảnh) | Mất thông tin an toàn |
| L2 | **Thang z-index lộn xộn** | top-bar 1000, drawer 1040, dock 1045, `.drawer-nav` 1046, popover 100000 / `z-[999999]`, `#library-studio-modal` **z 50**, `#compliance-hud-panel` **z-40**, `#gear-editor` **z 90** | Modal Thư viện 3D & Compliance HUD **nằm DƯỚI drawer/top-bar** → bị che |
| L3 | **Nhiều panel nổi cùng chiếm vùng phải** | `#compliance-hud-panel` (fixed top-14 right-4 w-96), `#gear-editor` (right 8px, 24vw), `#right-side-drawer` (right 0, 25vw) | 3 bảng chồng nhau đúng vị trí, như ảnh người dùng |
| L4 | **Menu điều hướng bị nhân đôi** | 6 nút `data-drawer-tab` ở **footer-right-menu** (L481-498) + 6 nút lặp ở **drawer-inner-tabs** (L536-541) + nút "Thư viện 3D" | Trùng lặp, chiếm chỗ dock |
| L5 | **Tên tab ≠ nội dung ≠ đánh số** | Tab "Dầm" → page `rig` đánh số 1-2-3; tab "Cáp" → page `gear` bắt đầu "3."; tab "Tải cẩu" → page `lugs` có "3. CoG" + "4. Lifting Point"; tab "Kiện" có 1,2,**5** (thiếu 3,4); tab "Sàn kê", "Cẩu 3D" đều bắt đầu "1." | Người dùng không biết thông số nằm đâu |
| L6 | **Trộn lẫn nhập liệu và giám sát** | Page `gear` chứa thanh tải `bar-t0..t3`, bảng khối lượng 16.00T/0.29T… (L1472-1528) | Trang chỉnh sửa bị dài, lẫn với đồng hồ |
| L7 | **Điều khiển trùng giữa Dock và Drawer** | Xoay hàng: `hdr-inp-cargo-yaw`, `hdr-btn-yaw-*` (dock) **và** mục "5. Góc Xoay" trong page cargo; nâng hạ: `num-hook-y` + `inp-hook-y`(hidden) + preset ở dock **và** page crane | Hai nguồn chân lý → lệch trạng thái |
| L8 | **Nút “ma” ẩn** | `btn-collapse-left/right`, `btn-toggle-hud`, `btn-toggle-cam`, `btn-gear-sheet`, `btn-rig-fit`, `btn-reset-all`, `btn-toggle-hud-extra` đều `class="hidden"` (L471, L508-514) | Code legacy, JS vẫn bind |
| L9 | **Dock quá tải, không responsive** | `#bottom-dock-bar` `flex-wrap: nowrap`, ~35 nút trên 56px (Nhóm cáp, Nhấc thử, Đong đưa, Cân bằng, Hạ đất, Reset, Đặt mốc, Ghi/Xem/Dừng, hoist, slew, yaw…) | Tràn/cắt ở màn <1600px |
| L10 | **Top bar tràn** | `#top-bar` `overflow:hidden`, nhiều nút `hidden xl:inline` | Mất nút ở màn nhỏ mà không có menu "…" |
| L11 | **Popover định vị lệch** | `#display-options-popover`, `#gfx-menu-popover` `fixed` tính tay bằng JS | Tràn ra ngoài viewport |
| L12 | **Ngôn ngữ/đơn vị** | Chữ hỏng dấu trong vài chỗ (`D?m`, `S?N SANG`) khi đọc bằng console không UTF-8; nút `btn-lang`, `btn-unit-toggle` | Cần rà soát encoding |

---

## 1. KIẾN TRÚC THÔNG TIN MỤC TIÊU (single source of truth)

```
┌─ TOP BAR (44px) ───────────────────────────────────────────────────────┐
│ [Logo+Chuẩn] [Trạng thái|Net|Rig|Gross] [CAMERA ▾] [HIỂN THỊ ▾] [CÔNG CỤ ▾] [HỒ SƠ ▾] [⚙ HỆ THỐNG ▾] │
├──────────────────────────────────────────────────┬─────────────────────┤
│                                                  │ INSPECTOR (phải)    │
│              3D VIEWPORT                         │ 6 tab, 1 panel/lần  │
│   (HUD cảnh báo nổi giữa-trên, không bị che)     │ cuộn trong, accordion│
│                                                  │                     │
├──────────────────────────────────────────────────┴─────────────────────┤
│ DOCK (≤2 hàng, wrap): [MÔ PHỎNG] [CẨU: Hoist/Slew] [GHI/XEM]  | [HUD Telemetry thu gọn] │
└────────────────────────────────────────────────────────────────────────┘
```

### 1.1 Phân nhóm 6 tab Inspector (đặt tên & đánh số lại, MỖI THÔNG SỐ CHỈ 1 NƠI)

| Tab (icon) | `data-drawer-tab` | Mục (accordion, đánh số 1.x liên tục) | Chuyển từ đâu |
|---|---|---|---|
| **① Hàng hóa** | `cargo` | 1.1 Loại hàng · 1.2 Kích thước & khối lượng · 1.3 **Trọng tâm CoG** · 1.4 **Hướng xoay/kéo (yaw)** · 1.5 Hàng quá khổ OOG | CoG từ `lugs` (L1544); yaw đã có ở cargo, **bỏ bản trùng ở dock** |
| **② Điểm nâng** | `lugs` | 2.1 Pad-eye / tai cẩu · 2.2 Vị trí & số điểm · 2.3 Bảo vệ góc (corner protector) | `lugs` mục "4. Lifting Point" |
| **③ Dầm & Hình học treo** | `rig` | 3.1 Loại dầm · 3.2 Chiều dài (span) · 3.3 Tầng cáp & góc bridle | giữ nguyên `rig`, đánh lại số |
| **④ Cáp & Phụ kiện** | `gear` | 4.1 Dây cáp/sling · 4.2 Shackle/móc/hardware · 4.3 Phân bổ lực & WLL | `gear`; **chuyển thanh tải `bar-t0..t3` & bảng khối lượng sang HUD Phân tích** |
| **⑤ Cẩu & Móc** | `crane` | 5.1 Thiết bị cẩu 3D · 5.2 Đầu hook · 5.3 Biểu đồ tải LMI | `crane`; hoist chỉ **điều khiển ở dock**, tại đây chỉ **hiển thị+đặt giá trị chính xác** (cùng 1 state) |
| **⑥ Hiện trường** | `site` | 6.1 Sàn thử/nền đất · 6.2 Sàn kê (dunnage) · 6.3 Gió & môi trường | `site` |

> Tab "Thư viện 3D" **không** là tab Inspector → chuyển thành mục trong menu **HỒ SƠ ▾** / nút trong Tab ① (mở modal).

### 1.2 Phân nhóm Top Bar thành 5 menu thả xuống (thay ~20 nút rời)

| Menu | Chứa | ID giữ nguyên |
|---|---|---|
| **CAMERA ▾** | Iso/Móc/Đứng/Bên/Bằng/Cẩu + chế độ Bám (`btn-cam-follow`, `sel-cam-follow-mode`) | `.cam-btn[data-cam]`, `btn-cam-follow` |
| **HIỂN THỊ ▾** | CAD, X-Ray, Lực (vectors), + nội dung `display-options-popover` | `btn-toggle-cad-edges`, `btn-xray`, `btn-toggle-vectors`, `btn-display-options` |
| **ĐỒ HỌA ▾** | nội dung `gfx-menu-popover` (Chất lượng, bóng, môi trường) | `btn-toggle-gfx` |
| **KIỂM ĐỊNH & HỒ SƠ ▾** | Tiêu chuẩn (`btn-open-compliance`), Hồ sơ (`btn-open-liftplan`), PDF (`btn-quick-export-pdf`), Thư viện 3D (`btn-open-3d-library`) | giữ |
| **HỆ THỐNG ▾** | Âm thanh, Ngôn ngữ, Đơn vị, Toàn màn hình | `btn-sound-toggle`, `btn-lang`, `btn-unit-toggle`, `btn-fullscreen-view` |

Hiển thị **luôn** trên top bar (không vào menu): trạng thái (`status-led`, `sim-status-text`), Net/Rig/Gross, nút **Đóng drawer**.

### 1.3 Phân nhóm Dock dưới — chỉ còn *vận hành*

| Nhóm | Nút | Ghi chú |
|---|---|---|
| **A. Mô phỏng** | `btn-pretension` Nhóm cáp · `btn-test-lift` Nhấc thử · `btn-swing-test` Đong đưa · `btn-auto-level` Cân bằng · `btn-reset-initial` Hạ đất · `btn-hard-reset` Reset · `btn-set-baseline` Đặt mốc | nhóm 1 hàng, ngăn bằng divider |
| **B. Điều khiển cẩu** | Hoist (`btn-hoist-*`, `num-hook-y`, preset) · Slew (`btn-slew-*`, `.btn-slew-step`) | nguồn chân lý duy nhất của độ cao hook & góc quay |
| **C. Ghi & Phát lại** | `btn-rec`, `btn-replay`, `btn-replay-stop` | |
| **D. HUD telemetry** | `#dock-hud` thu gọn → bấm mở **Panel Phân tích** | |

Bỏ khỏi dock: yaw hàng (`hdr-*`) — đã có ở Tab ① 1.4; bỏ **footer-right-menu** (trùng tab).

---

## 2. QUY CHUẨN KỸ THUẬT BẮT BUỘC (Gemini phải tuân thủ)

### 2.1 Design tokens — thêm vào đầu `src/styles/app.css`
```css
:root{
  --topbar-h:44px; --dock-h:56px; --dock-gap:6px;
  --drawer-w:clamp(360px,26vw,480px);
  --z-canvas:1; --z-labels:5; --z-hud:20; --z-dock:30;
  --z-drawer:40; --z-topbar:50; --z-popover:60; --z-modal:80; --z-toast:100;
}
```
Thay **toàn bộ** số z-index rời bằng token trên (kể cả `z-40`, `z-[999999]`, `100000 !important`, `1040/1045/1046`, modal `50`, gear-editor `90`).

### 2.2 Vùng an toàn bố cục
- Viewport 3D thực = `calc(100vh - topbar - dock)`; khi drawer mở, **đẩy** `#ui-layer`/HUD sang trái bằng `body.drawer-open { --safe-right: var(--drawer-w) }`, không để drawer che HUD.
- Drawer: `top: var(--topbar-h)`; `bottom: calc(var(--dock-h) + var(--dock-gap)*2)`; nội dung `overflow-y:auto`, header tab **sticky**.
- Dock: cho phép `flex-wrap: wrap`, tối đa 2 hàng; < 1280px chuyển sang icon-only + tooltip.
- Mọi nút/ô nhập phải nhìn thấy đủ ở **1280×720** (không cắt chữ; dùng `min-width:0; text-overflow:ellipsis` + `title`).

### 2.3 Quy tắc chống phá vỡ logic
1. **KHÔNG đổi/xóa `id`** đã được JS tham chiếu (`session.js` ≈340 chỗ, `library.js` ≈162, `telemetry.js` ≈54, `gear.js` ≈44). Chỉ **di chuyển DOM**; nếu bắt buộc đổi → cập nhật JS cùng commit.
2. Trước khi xoá nút "ma" (L508-514): `Select-String -Pattern "<id>" src` — nếu JS còn bind, **giữ lại phần tử ẩn** trong `<div id="legacy-shims" hidden>`.
3. Mỗi bước: `npm run dev` không lỗi console, `npm test` xanh, commit riêng.
4. Không dùng `!important` mới. Không thêm inline `style` (hiện 6 chỗ → dọn dần).
5. Tuyệt đối giữ chuỗi i18n/tiếng Việt UTF‑8 (file lưu UTF‑8 no BOM).

---

## 3. CÁC BƯỚC THỰC HIỆN (mỗi bước = 1 commit, làm tuần tự)

### BƯỚC 0 — Chuẩn bị & an toàn
- [ ] Tạo nhánh `ui-refactor`; chạy `npm test` ghi baseline.
- [ ] Tạo `docs/ui-id-registry.md`: xuất danh sách 449 `id` + file JS tham chiếu (script: regex `getElementById\('([^']+)'` trên `src/sim/*.js`).
- [ ] Chụp 4 screenshot gốc (1280×720, 1366×768, 1920×1080, 2560×1440) vào `docs/ui-before/`.
- **Nghiệm thu:** registry đầy đủ, test baseline lưu.

### BƯỚC 1 — Hệ z-index & design tokens (sửa L2)
- Thêm `:root` tokens (mục 2.1). Thay thế mọi z-index theo bảng:
  | Phần tử | Cũ | Mới |
  |---|---|---|
  | `#canvas-container` | 1 | `--z-canvas` |
  | `#labels-container` | 5 | `--z-labels` |
  | `#ui-layer`, `#compliance-hud-panel`, `#fit-banner` | 10 / 40 | `--z-hud` |
  | `#bottom-dock-bar` | 1045 | `--z-dock` |
  | `#right-side-drawer`, `#gear-editor` | 1040 / 90 | `--z-drawer` |
  | `#top-bar` | 1000 | `--z-topbar` |
  | `*-popover` | 100000 / 999999 | `--z-popover` |
  | `#library-studio-modal`, `#liftplan-modal` (`.modal-layer`) | 50 / ? | `--z-modal` |
- Xoá `z-index: 1046 !important` ở `.drawer-nav-btn`.
- **Nghiệm thu:** mở Thư viện 3D / Hồ sơ Lift Plan khi drawer đang mở → modal nằm **trên cùng**; popover nằm trên drawer.

### BƯỚC 2 — Khung bố cục & vùng an toàn (sửa L1, L9)
- Thêm biến `--safe-right`; JS toggle `body.drawer-open` tại hàm mở/đóng drawer (tìm `drawer-open`/`drawer-closed` trong `src/sim/session.js`).
- `#bottom-dock-bar`: `right: calc(8px + var(--safe-right))` khi drawer mở → dock co lại **không bị drawer đè**; cho `flex-wrap: wrap`, `height:auto; max-height:calc(var(--dock-h)*2)`.
- `#right-side-drawer.bottom` = chiều cao thực dock (dùng CSS var cập nhật bằng `ResizeObserver` trên dock).
- HUD cảnh báo (`#fit-banner`, `#dock-hud`) căn giữa **vùng viewport còn lại** (trừ safe-right).
- **Nghiệm thu:** drawer mở/đóng ở 4 độ phân giải: không phần tử nào bị cắt, thanh cảnh báo "thiếu … m" đọc đủ.

### BƯỚC 3 — Gộp & loại trùng điều hướng (sửa L4)
- Xoá `#footer-right-menu` (L479-515) khỏi dock; **giữ** `#drawer-inner-tabs` (L535) làm điều hướng duy nhất.
- Thêm **phím tắt**: `1–6` mở tab, `Esc` đóng drawer; nút mở drawer (⚙/☰) đặt ở top bar.
- Đổi nhãn & icon 6 tab theo bảng 1.1; thêm `aria-label`, `role="tablist"`.
- **Nghiệm thu:** chỉ còn 1 bộ tab; click tab/phím tắt chuyển đúng page; `data-drawer-tab` giữ nguyên giá trị.

### BƯỚC 4 — Tái cấu trúc nội dung 6 tab (sửa L5, L6, L7)
Làm **lần lượt từng tab**, mỗi tab 1 commit:
1. **Cargo**: đánh số 1.1–1.5; chuyển khối CoG (L1544–L1584 của page `lugs`) vào đây.
2. **Lugs → "Điểm nâng"**: chỉ còn Pad-eye + vị trí + corner protector (2.1–2.3).
3. **Rig**: đánh số 3.1–3.3.
4. **Gear → "Cáp & Phụ kiện"**: 4.1–4.3; **cắt** khối `bar-t0..t3` + bảng khối lượng (L1472–L1530) sang HUD Phân tích (Bước 6), để lại `<div id="gear-load-summary">` chỉ 1 dòng tóm tắt.
5. **Crane**: 5.1–5.3; ô độ cao hook = `data-bind` tới cùng state với `num-hook-y` (dock).
6. **Site**: 6.1–6.3.
- Mỗi mục là `<details class="acc" open>`/`<summary>`; mặc định chỉ mở mục đầu; trạng thái đóng/mở lưu `localStorage`.
- Mỗi nhóm thông số: `label` bên trái – `input/slider` giữa – đơn vị bên phải, grid 3 cột thống nhất (`.field-row`).
- **Nghiệm thu:** không còn số thứ tự trùng/nhảy; mỗi thông số chỉ xuất hiện 1 lần (grep `id` không nhân đôi); đổi giá trị ở dock ↔ drawer luôn đồng bộ.

### BƯỚC 5 — Top bar → 5 menu thả xuống (sửa L10, L11)
- Tạo component `.menu-dropdown` (HTML `<div class="menu"><button aria-haspopup>…</button><div class="menu-panel">…</div></div>`) dùng **1 JS helper** `UI.menu.toggle()`; chỉ 1 menu mở cùng lúc, đóng khi click ngoài/Esc.
- Popover đặt vị trí bằng CSS (`position:absolute; top:100%`), thêm kiểm tra tràn `getBoundingClientRect` → lật trái nếu vượt viewport.
- Thêm nút **"…" (overflow)** tự gom nút khi top bar < 1100px.
- Chuyển nội dung `display-options-popover`, `gfx-menu-popover` thành panel của menu tương ứng, giữ `id`.
- **Nghiệm thu:** không nút nào bị `overflow:hidden` cắt ở 1280px; mở menu này tự đóng menu kia.

### BƯỚC 6 — Panel Phân tích hợp nhất (gom HUD, sửa L3)
- Tạo `#analysis-panel` (neo **trái-dưới viewport**, thu gọn/phóng to, kéo được, z `--z-hud`) gồm 3 tab nhỏ: **Tải & Lực** (bar-t0..t3, bảng khối lượng) · **Kiểm định** (nội dung `compliance-hud-panel`) · **Cảnh báo**.
- `#compliance-hud-panel` chuyển vào đây (bỏ `fixed top-14 right-4 w-96`).
- `#gear-editor` (panel nổi thứ 3): chuyển thành **mục 4.x trong Tab ④**, xoá CSS `#gear-editor{right:8px…}`.
- **Nghiệm thu:** tại mọi thời điểm chỉ có **tối đa 1 panel bên phải (drawer)**; không bảng nào đè bảng khác.

### BƯỚC 7 — Quy tắc "panel loại trừ" (chống chồng đè)
- Tạo `UI.layout` (file mới `src/sim/ui-layout.js`, thêm vào `simParts` trong `vite.config.js` sau `state.js`) quản lý:
  - 1 drawer, 1 modal, 1 menu mở cùng lúc.
  - Mở modal → tự `blur` input, tạm khoá phím tắt 3D; đóng → khôi phục.
  - API: `UI.layout.openDrawer(tab)`, `closeDrawer()`, `openModal(id)`, `closeAllTransient()`.
- Mọi code cũ gọi `classList.add('drawer-open')` thay bằng API này.
- **Nghiệm thu:** bấm liên tiếp nhiều nút menu/modal nhanh → không có trạng thái chồng; `Esc` luôn đóng lớp trên cùng.

### BƯỚC 8 — Dock gọn & loại trùng (sửa L7, L8, L9)
- Chia dock thành 4 nhóm A/B/C/D (mục 1.3), thêm nhãn nhóm nhỏ + divider; < 1280px → icon-only.
- Xoá cụm `hdr-*` yaw khỏi dock (chuyển tham chiếu JS sang `inp-cargo-yaw` của tab ①; cập nhật `session.js`).
- Xoá hoặc gom 7 nút ẩn vào `<div id="legacy-shims" hidden>` (sau khi grep JS).
- **Nghiệm thu:** ≤ 2 hàng ở 1280px; không nút trùng; yaw & hoist chỉ có 1 điều khiển trực tiếp.

### BƯỚC 9 — Hoàn thiện form, đơn vị, i18n, truy cập
- Chuẩn hoá `.field-row`, ô số có `min/max/step`, validate + hiển thị đơn vị theo `btn-unit-toggle` (m/ft, T/kN).
- Rà soát encoding UTF‑8 toàn `index.html`, `src/sim/*.js` (sửa chuỗi `?`).
- Tab-focus theo thứ tự, `aria-*`, tooltip tiếng Việt thống nhất (viết hoa đầu, không trộn Anh/Việt trong 1 nhãn — ví dụ "Spreaders & Lifting Beams - Dầm Ngang…" → "Dầm ngang & dầm nâng").
- **Nghiệm thu:** Lighthouse a11y ≥ 90; chuyển EN/VI đổi đủ nhãn.

### BƯỚC 10 — Dọn dẹp & bàn giao
- Xoá CSS/HTML chết (`btn-collapse-*`, `#footer-right-menu` css, v.v.), đo `index.html` giảm ≥ 5%.
- Cập nhật `README.md` mục "Bố cục giao diện" + sơ đồ IA mục 1.
- Chụp screenshot "after" 4 độ phân giải; xuất `docs/ui-after/`.
- **Bàn giao cho Codex** (Kế hoạch 2): kèm `ui-id-registry.md`, danh sách data-testid.

---

## 4. `data-testid` BẮT BUỘC (để Codex test — thêm ở Bước 3–8)
`tab-cargo, tab-lugs, tab-rig, tab-gear, tab-crane, tab-site` · `drawer`, `drawer-close` · `menu-camera, menu-display, menu-gfx, menu-docs, menu-system` · `dock-sim, dock-crane, dock-rec, dock-hud` · `analysis-panel` · `modal-library, modal-liftplan` · `toast`.

## 5. TIÊU CHÍ HOÀN THÀNH TOÀN KẾ HOẠCH (Definition of Done)
- [ ] 0 phần tử bị cắt/che ở 4 độ phân giải (kể cả khi drawer mở).
- [ ] Thang z-index chỉ dùng token; không `!important` z-index.
- [ ] Tối đa 1 drawer + 1 modal + 1 menu cùng lúc; `Esc` đóng đúng lớp.
- [ ] Mỗi thông số chỉnh ở **đúng 1** nơi; 0 `id` trùng; không nút chức năng lặp.
- [ ] Đánh số mục liên tục theo tab (1.x…6.x).
- [ ] `npm test` xanh, `npm run build` thành công, console không lỗi/warning mới.
- [ ] Tất cả lệnh cũ (nhấc thử, đong đưa, cân bằng, ghi/phát lại, xuất PDF, Lift Plan) hoạt động như trước.
