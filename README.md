# Lifting Plan Simulator Pro

Static 3D lifting-plan simulator. The site is built with Vite and can be hosted on Vercel, Cloudflare Pages, or Firebase Hosting.

## Layout & Information Architecture

- `index.html` — Page shell with zero overlapping panels and strictly managed z-index hierarchy
- `src/main.js` — App entry point
- `src/styles/app.css` — Design tokens (`--z-*`, `--safe-right`, `--topbar-h`, `--dock-h`) and responsive rules
- `src/sim/` — Simulator modules, assembled into one scope at build time:
  - `state.js` — Configuration, physics state, startup
  - `ui-layout.js` — Centralized layout and panel exclusion controller (`window.UI.layout`)
  - `audio.js` — Sound and audio effects
  - `scene.js` — Scene, lighting, world, 3D cranes
  - `rigging.js` — Hook, slings, rope clearance, spreader beams
  - `cargo.js` — Cargo meshes, pad-eyes, center of gravity (CoG)
  - `physics.js` — Rigid bodies, dynamic cables, contact
  - `telemetry.js` — Scene update and HUD readouts
  - `gear.js` — Individual component gear editor and 3D dragging
  - `session.js` — Hotkeys (1-6, Esc), language, camera controls, reset
  - `library.js` — 3D asset library, CAD/STL import, render loop
  - `compliance.js` — ASME P30.1 / ISO 3874 safety audit and Lift Plan generation

### Giao diện người dùng (UI Architecture)
1. **Top Bar**: Tinh gọn với 5 dropdown menus (`menu-camera`, `menu-display`, `menu-gfx`, `menu-docs`, `menu-system`) và nút mở nhanh Drawer (`btn-toggle-drawer`). Tự động chống tràn trên màn hình từ 1280px đến 2560px.
2. **Right Side Drawer (25vw, min 360px)**: Bảng thông số kỹ thuật duy nhất bên phải màn hình, gồm 6 tab chuyên biệt đánh số 1.x đến 6.x:
   - `Tab 1: Hàng hóa (Cargo)` — Kích thước, khối lượng, CoG, góc xoay mặt đất, OOG
   - `Tab 2: Điểm nâng (Lugs)` — Cấu hình pad-eyes, góc chịu lực, pad-eye 3D
   - `Tab 3: Dầm ngáng (Rig)` — 8 cấu hình dầm (Modular, Spreader, H-Beam, Bridle 4-leg...), span dầm, phân tầng cáp
   - `Tab 4: Cáp treo (Gear)` — Loại cáp (Wire rope, Grommet, Round sling), đường kính, tăng đơ, ma ní
   - `Tab 5: Cẩu 3D (Crane)` — Loại cẩu, bán kính làm việc R, góc cần, tải trọng cho phép
   - `Tab 6: Hiện trường (Site)` — Mặt bằng thi công, vật cản, đà kê dunnage, gió
3. **Bottom Dock Bar**: Gom thành 4 nhóm độc lập:
   - `dock-sim`: Thử tải mô phỏng (Nhớm cáp, Nhấc thử, Đung đưa, Cân bằng, Hạ đất, Reset, Đặt mốc)
   - `dock-rec`: Ghi và phát lại chuyển động (REC, Xem, Dừng)
   - `dock-crane`: Điều khiển tời móc (-1m..+1m, độ cao Y) và quay cần (-15°..+15°)
   - `dock-hud`: HUD Telemetry kỹ thuật 2 hàng đầy đủ số liệu
4. **Quy tắc loại trừ Panel (`ui-layout.js`)**:
   - Tối đa 1 Drawer + 1 Modal + 1 Dropdown Menu mở cùng lúc.
   - Khi mở Modal hoặc Drawer, các dropdown menu tự động đóng để không bị chồng đè.
   - Bảng Kiểm định (`compliance-hud-panel`) neo cố định bên trái (`left-4`), không bao giờ va chạm với Drawer bên phải.
   - Phím `Esc` đóng lần lượt theo thứ tự ưu tiên: Modal -> Menu -> Floating Panel -> Drawer.

## Testing & Quality Assurance

Hệ thống hỗ trợ 2 tầng kiểm thử tự động toàn diện:
1. **Core Unit & Physics Tests (Vitest - 160 tests)**:
   ```bash
   npm test
   ```
2. **Browser End-to-End Layout & Collision Tests (Playwright)**:
   ```bash
   npm run test:ui
   ```
   Chạy toàn bộ 14 kịch bản kiểm thử trên 4 độ phân giải: 1280×720 (HD), 1366×768 (Laptop), 1920×1080 (FHD), 2560×1440 (QHD).
3. **Chạy tất cả kiểm thử**:
   ```bash
   npm run test:all
   ```

## Local

```bash
npm install
npm run dev
```

Production build:

```bash
npm run build
npm run preview
```

The build output is the `dist` folder.

## Deploy

Vercel: import the GitHub repository. The build command is `npm run build` and the output is `dist`.

Cloudflare Pages: build command `npm run build`, output directory `dist`.

Firebase Hosting:

```bash
npm run build
npx firebase deploy --only hosting
```
