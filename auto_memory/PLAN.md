# KẾ HOẠCH THỰC HIỆN (PLAN.md)
Trạng thái: ACTIVE
Tính năng: 24H PRO TRIAL, DYNAMIC CMS FEATURE LOCKS (`system_config/feature_locks`), RISK ASSESSMENT (JSA/HSE) & 3D ANTI-THEFT BRANDING (Three.js Decals + Viewport & PDF Watermark)
Nhánh Git: feat/horizon-clouds (Backup: `LIFTING PLAN SIMULATOR PRO-112617112026 (test - trial-cms-locks-branding-risk).zip`)
Người lập kế hoạch: Model cao nhất (CHƯA viết code ở bước này — chờ Founder duyệt mở khóa `firestore.rules` `[LOCK-04]` và gõ `làm tiếp`).

## 0. KẾT QUẢ KHÁM CODE HIỆN TẠI
1. **SaaS Auth, Tier & Feature Flags (`src/saas/`):**
   - `src/saas/firebase_data.js` (`ensureUserProfile` dòng 19–45) đang tạo `users/{uid}` với `{ uid, email, displayName, role: 'user', tier: 'free', createdAt, lastLogin, status: 'active' }` (chưa có `trialStartedAt`, `trialEndsAt`, `deviceFingerprint`, chưa kiểm tra `trial_devices`).
   - `src/saas/access.js` (`TIERS`, `FEATURE_RULES`, `canAccessFeature`) chỉ nhận `free | premium | admin` (`enterprise` hiện đang bị quy về `free` theo `test/saas_access.test.js:23`); chưa có `hasProAccess(user)` xét thời hạn dùng thử 24h.
   - `src/saas/telemetry_usage.js` + `runtime_flags.js` hiện đọc 1 lần (`loadFlagsOnce`) tài liệu `config/featureFlags` chứ chưa subscribe realtime `onSnapshot` tới `system_config/feature_locks`, và chưa phân biệt 3 trạng thái `Active` / `Tier Locked` / `Under Upgrade` ở từng khối 3D (Cargo, Spreader, Crane) hay tính năng (`windSimulation`, `riskAssessmentGenerator`).
   - `src/saas/admin_dashboard.js` + `admin_panels.js` + `admin_helpers.js` chưa có tab `"Feature & 3D Asset Matrix"` cho nút bấm đổi 3 trạng thái tức thì.
2. **Bảo mật & `[LOCKED]` Firestore Rules (`firestore.rules` — `LOCK-04`):**
   - `firestore.rules:146-162` đang khóa cứng `users/{uid}` `create` chỉ cho phép `hasOnly(['uid', 'email', 'displayName', 'role', 'tier', 'createdAt', 'lastLogin', 'status'])` và `catch-all deny` cuối file. Để lưu `trialStartedAt`, `trialEndsAt`, `deviceFingerprint`, chống gian lận đa tài khoản qua `trial_devices/{fpHash}`, hỗ trợ `tier in ['free', 'premium', 'pro', 'enterprise']` và bật `system_config/feature_locks` cho Admin CMS **bắt buộc phải sửa `firestore.rules` (`[LOCK-04]`)** và cập nhật `test/firestore-rules-emulator.mjs`.
   - `test/auth_screen.test.js:34-42` cấm lộ SĐT/email thô trong `index.html`, `auth_screen.js`, `feature_access_ui.js`, `contact_dialog.js`, `COPYRIGHT`, `AUTH_COPY` — nên mọi chuỗi bản quyền có SĐT/email **chỉ** đưa vào lớp vẽ Decal 3D (`CanvasTexture`) và trang xuất PDF qua helper tách riêng (`resolveAttributionStrings`), không rò ra màn hình Auth/Splash.
3. **3D Meshes & Báo cáo PDF (`src/sim/`, `src/core/LiftPlanModel.js`):**
   - Cụm móc cẩu `hookAssemblyGroup` nằm trong `src/sim/rigging/hook_pool.js` (`plate` má móc dòng 214–222); các loại cẩu (`mobile_telescopic`, `crawler`, `gantry`, `hook_only`) dựng ở `buildCraneVehicle()` trong `src/sim/scene.js:789-1060` (có `craneVehicleCache`); dầm/ngáng (`spreader`, `lifting_beam`, `h_beam`, `frame`, `cascaded`, `modular_truss`, `basket`, `container_spreader`) dựng trong `rebuildSpreaderVisuals()` ở `src/sim/cargo/specialty_meshes.js:2080+`; kiện hàng dựng ở `src/sim/cargo/shell_rebuild.js:407+`.
   - Xuất PDF chạy từ `src/sim/compliance.js:131-165` (`exportLiftPlanToPDF` + `buildCurrentLiftPlanModel`) gọi `LiftPlanModel.generatePrintableHTML(screenshot)` (`src/core/LiftPlanModel.js:780-1073`). Lưu ý `src/core/` nằm trong **Physics Quarantine** (cấm import DOM / Three.js) nên logic đánh giá Risk Assessment JSA/HSE & ghép HTML watermark là hàm JS thuần 100%.

## 1. Giả định & Quyết định chờ Founder xác nhận (khi gõ `làm tiếp`)
1. **Xin phép sửa file `[LOCKED]` `firestore.rules` (`LOCK-04`):** Cần bổ sung rule chặt cho `trialStartedAt`/`trialEndsAt`/`deviceFingerprint` (giới hạn `trialEndsAt <= request.time + duration.value(24, 'h')`, user tự update không được sửa `trialEndsAt`/`tier`), collection `trial_devices/{fpHash}` (chỉ cho phép tạo 1 lần bởi user khớp `deviceFingerprint`, cấm sửa/xóa) và `system_config/feature_locks` (signed-in `get`, chỉ `activeAdmin()` ghi kèm audit log).
2. **Tương thích ngược `tier: 'premium'` vs `'pro' | 'enterprise'`:** Giữ nguyên hỗ trợ `'premium'` cho khách cũ, đồng thời công nhận `'pro'` và `'enterprise'` trong `hasProAccess(user)` và `TIERS`.
3. **Không làm tụt FPS WebGL:** Bộ decal 3D dùng **1 shared `THREE.CanvasTexture` cache + 1 `PlaneGeometry` tái sử dụng**, gắn trực tiếp làm con của boom cẩu, má móc cẩu, dầm/spreader, và góc kiện hàng (tự cập nhật theo kích thước kiện / quay & nhận sáng bóng đổ chung với vật thể mà chi phí GPU ≈ `0 ms/frame`).

## 2. File CẤM đụng
`src/sim/physics/*` (bảo toàn 100% XPBD solver), `src/core/standards/*`, `src/core/physics-world/*`, `src/core/DeformableSteelStructure.js`, `src/core/PhysicalCableSolver.js`, `src/core/CraneLoadChartEngine.js`, `src/core/GroundPressureEngine.js`, `src/sim/manifest.js`, `src/utils/firestoreSanitize.js`, `src/utils/localDataStore.js`.

---

## CÁC BƯỚC THỰC HIỆN TUẦN TỰ (chạy 1 mạch Bước 1 → 6 sau khi được phép, mỗi bước xong: test + `architecture:gate` → tick `[x]` → `git commit`)

### [x] Bước 1: Module 1 — Logic 24h Pro Trial, Anti-Abuse `deviceFingerprint` & Firestore Schema
- **Tạo mới:** `src/saas/trial_access.js` (< 210 dòng, `@purpose: Quản lý gói dùng thử Pro 24h, dấu vân tay thiết bị chống lập nhiều Gmail và helper hasProAccess(user)`):
  - `TRIAL_DURATION_MS = 24 * 60 * 60 * 1000`, `DEVICE_FP_KEY = 'safelift_device_fp_v1'`.
  - `getOrCreateDeviceFingerprint()`: sinh hash ổn định (SHA-256 fallback FNV-1a kết hợp thông số trình duyệt/màn hình/timezone + lưu `localStorage` qua `safeWriteLocalStore` / đọc an toàn).
  - `toMillis(ts)` (hỗ trợ cả `Date`, `number`, Firestore `Timestamp.toMillis()`).
  - `hasProAccess(user, nowMs = Date.now())`: trả `true` nếu `tier === 'pro' | 'premium' | 'enterprise' | 'admin'`, `role === 'admin'`, hoặc `status === 'active' && nowMs < toMillis(user.trialEndsAt)`.
  - `getTrialState(user, nowMs = Date.now())`: trả `{ inTrial, expired, remainingMs, progressPct, tierLabel }` (khi `user.tier === 'free'` và không phải admin).
- **Sửa (≤ 25 dòng/file):**
  - `src/saas/access.js`: hỗ trợ `TIERS.PRO`, `TIERS.ENTERPRISE`, `TIERS.PREMIUM` & re-export `hasProAccess` trong `canAccessFeature(profile, featureId, nowMs)`.
  - `src/saas/firebase_data.js`: cập nhật `ensureUserProfile(db, authUser)` khi tạo user mới: tính `deviceFingerprint`, kiểm tra `trial_devices/{fp}` (và `localStorage`) — nếu thiết bị chưa từng nhận trial thì ghi `trial_devices/{fp}` + đặt `trialStartedAt: serverTimestamp()`, `trialEndsAt: new Date(Date.now() + 24h)`, còn nếu đã nhận rồi thì đặt `trialEndsAt: null` (trả về `free` ngay).
  - **`firestore.rules` (`[LOCKED] - cần Founder đồng ý`)** & `test/firestore-rules-emulator.mjs`: cho phép tạo `users/{uid}` kèm `trialStartedAt == request.time`, `trialEndsAt <= request.time + 24h`, `deviceFingerprint`; thêm rule `match /trial_devices/{fp}` (`create` 1 lần nếu chưa tồn tại); hỗ trợ `'pro' | 'enterprise' | 'premium'` trong tier.
- **Tạo / cập nhật test:** `test/trial_access.test.js` (test `hasProAccess`, hết hạn đúng `24h`, chống tạo lại trial trên cùng `deviceFingerprint`), cập nhật `test/saas_access.test.js`.
- **Kiểm tra:** `npx vitest run test/trial_access.test.js test/saas_access.test.js test/auth_screen.test.js` + `npm run architecture:gate`.

### [x] Bước 2: Module 1 (UI) — Thanh Đếm Ngược 24h Live & Hết Hạn Khóa Về Free
- **Tạo mới:** `src/saas/trial_banner.js` (< 190 dòng, `@purpose: Hiển thị thanh đếm ngược 24h Trial ở đầu workspace và modal thông báo khi hết hạn về Free`):
  - `mountTrialCountdownBanner({ getProfile, onExpired })`: tạo bar mượt `[HH:MM:SS]` kèm thanh progress tự tụt theo `%` thời gian còn lại trong 24h; hỗ trợ song ngữ EN/VN đúng câu lệnh (*"🎁 Trải nghiệm Full Tính Năng Pro miễn phí: Còn lại [HH:MM:SS] — Nâng cấp ngay để không bị gián đoạn."*).
  - Khi đồng hồ chạm `00:00:00`: tự động gọi `onExpired()` để làm mới `featureAccess.setProfile(...)` khóa ngay các tính năng Pro về `free`, gỡ banner countdown và mở modal thân thiện hướng dẫn nâng cấp Pro (kèm nút Liên hệ Kỹ sư / mở `openDeveloperContact`).
- **Sửa (≤ 25 dòng/file):**
  - `src/saas/i18n.js`: thêm key song ngữ EN/VN cho Trial Countdown Banner & Expired Upgrade Modal (không chứa raw email/phone).
  - `src/saas/saas.css`: style gọn đẹp cho `#saas-trial-banner`, thanh progress bar và `#saas-trial-expired-modal`.
  - `src/saas/session.js`: gắn `mountTrialCountdownBanner` sau khi mở workspace và xử lý callback `onExpired` ép re-apply khóa Pro realtime + `playQuota`/`viewportWatermark` refresh ngay lập tức.
- **Kiểm tra:** thêm test UI countdown `HH:MM:SS` & auto-expire vào `test/trial_access.test.js`; chạy `npx vitest run test/trial_access.test.js test/i18n_keys.test.js` + `npm run architecture:gate`.

### [x] Bước 3: Module 2 — Firestore Realtime `system_config/feature_locks` & Admin CMS Asset/Feature Matrix (`/admin`)
- **Tạo mới:**
  - `src/saas/feature_locks_cms.js` (< 210 dòng, `@purpose: Định nghĩa danh mục Asset 3D & Tính năng, đồng bộ realtime system_config/feature_locks và giải quyết 3 trạng thái Active/TierLocked/UnderUpgrade`):
    - Danh mục chuẩn hóa `ASSET_LOCK_CATALOG` & `FEATURE_LOCK_CATALOG`: gồm `cargo_oog_transformer`, `cargo_specialized`, `spreader_modular`, `lifting_beam`, `crane_sts_gantry`, `crane_mobile_crawler`, `windSimulation`, `riskAssessmentGenerator`...
    - `normalizeFeatureLocksDoc(raw)`, `evaluateItemLockState({ itemId, profile, featureLocks, nowMs })` trả về `{ state: 'active' | 'tier_locked' | 'upgrading', allowed, reason, minTier }`.
    - `subscribeFeatureLocks(db, onChange, onError)` (Firestore `onSnapshot` tới `system_config/feature_locks`) & `saveFeatureLocks(db, adminUid, docData, deps)` (ghi batch kèm audit log `FLAGS_UPDATE`).
  - `src/saas/admin_feature_locks_panel.js` (< 180 dòng, `@purpose: Giao diện tab "Feature & 3D Asset Matrix" trong /admin cho phép đổi 3 trạng thái Active / Tier Locked / Under Upgrade bằng 1 click`).
- **Sửa (≤ 25 dòng/file):**
  - **`firestore.rules` (`[LOCKED]`)**: cho phép `match /system_config/feature_locks { allow get: if signedIn(); allow create, update: if activeAdmin(); }` (với validation schema chặt).
  - `src/saas/admin_dashboard.js` + `src/saas/admin_panels.js`: thêm tab `"Feature & 3D Asset Matrix"` (`activeSection === 'locks'`) nối tới `saveFeatureLocks` + `subscribeFeatureLocks`.
  - `src/saas/feature_access_ui.js` & `src/saas/session.js`: subscribe realtime `system_config/feature_locks`; gắn selector `#cargo-library [data-cargo]`, `#beam-store [data-beam]`, `#crane-store [data-crane]`, `[data-feature-gate="windSimulation"]`, `[data-feature-gate="riskAssessmentGenerator"]`; khi một mục ở trạng thái `Under Upgrade` (`upgrading`), tự chèn badge `🛠️ Đang nâng cấp / Upgrading...`, disable chọn, và hiện tooltip + modal thông báo đúng nội dung: *"Khối 3D / Chức năng này đang được Kỹ sư Lê Việt Phương nâng cấp thuật toán vật lý. Vui lòng quay lại sau!"*.
- **Tạo test:** `test/feature_locks_cms.test.js` kiểm tra normalize 3 trạng thái, priority rule (`upgrading` chặn cả Pro/Trial, `tier_locked` mở cho Trial/Pro), và DOM badge/tooltip UI; kiểm tra lại `test/runtime_flags.test.js`.
- **Kiểm tra:** `npx vitest run test/feature_locks_cms.test.js test/runtime_flags.test.js test/cms_data.test.js` + `npm run architecture:gate`.

### [ ] Bước 4: Module 3 (3D + Viewport) — Stencil Decal Bản Quyền 3D & Watermark Bảo Vệ Màn Hình
- **Tạo mới:**
  - `src/graphics/BrandDecalHelper.js` (< 210 dòng, `@purpose: Tạo texture decal công nghiệp cache 1 lần (CanvasTexture) và gắn tem bản quyền 3D lên Cần cẩu, Móc cẩu, Dầm/Spreader và Kiện hàng mà không ảnh hưởng FPS`):
    - `createBrandDecalTexture(THREE, options)` dùng HTML5 Canvas vẽ chữ stencil sắc nét `SAFELIFT3D.COM • DEV BY LÊ VIỆT PHƯƠNG (+84968051697)` trên nền tấm tem công nghiệp có đinh tán/viền cảnh báo, cache chung `THREE.CanvasTexture` + `MeshStandardMaterial` (`polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2`, `SRGBColorSpace`).
    - `stampCraneBrandDecals(THREE, craneVehicleGroup, craneDynamicParts, type)`: gắn decal dọc 2 bên thành cần chính (`teleBoom`, `boomMesh` lattice, `gantry` dầm cầu).
    - `stampHookBrandDecals(THREE, hookAssemblyGroup)`: gắn decal lên 2 mặt má thép bên ngoài cụm móc (`cz = ±0.068`).
    - `stampSpreaderBrandDecals(THREE, spreaderRootGroup, beamType, spanX)`: gắn tem stencil dọc 2 bên bụng/cánh dầm spreader / lifting beam (`spreader`, `lifting_beam`, `h_beam`, `frame`, `cascaded`, `container_spreader`, `basket`).
    - `stampCargoBrandPlate(THREE, cargoRootGroup, dims)`: gắn biển kiểm định / tem stencil bản quyền ở góc cạnh trên mặt trước/bên của khối kiện hàng (`cargoRootGroup`), tự khớp theo `(L, W, H)`.
  - `src/saas/viewport_watermark.js` (< 140 dòng, `@purpose: Lớp phủ SVG pattern chéo bán trong suốt bảo vệ màn hình 3D đối với tài khoản Free & 24h Trial`):
    - `syncViewportWatermark(profile, nowMs)`: bật `#saas-viewport-watermark` (lớp `pointer-events: none` SVG chéo mờ lặp lại trên vùng canvas 3D) cho `free` và `trial`, tự ẩn/giảm cực nhẹ khi tài khoản là `pro` / `enterprise` / `admin`.
- **Sửa (≤ 18 dòng/file — KHÔNG đụng `src/sim/physics/*`):**
  - `src/graphics/index.js`: export các hàm từ `BrandDecalHelper.js`.
  - `src/sim/scene.js` (`buildCraneVehicle`, trước khi đẩy vào `craneVehicleCache`): gọi `GFX.stampCraneBrandDecals(THREE, craneVehicleGroup, craneDynamicParts, type)`.
  - `src/sim/rigging/hook_pool.js` (`buildHookAndRiggingPool`): gọi `GFX.stampHookBrandDecals(THREE, hookAssemblyGroup)`.
  - `src/sim/cargo/specialty_meshes.js` (`rebuildSpreaderVisuals`): gọi `GFX.stampSpreaderBrandDecals(THREE, spreaderRootGroup, beamType, spanX)`.
  - `src/sim/cargo/shell_rebuild.js` (`rebuildCargoAndRig`): gọi `GFX.stampCargoBrandPlate(THREE, cargoRootGroup, { L, W, H })`.
  - `src/saas/session.js` + `src/saas/saas.css`: gọi `syncViewportWatermark(profile)` khi đổi profile / hết hạn trial.
- **Tạo test:** `test/brand_decal_and_watermark.test.js` kiểm tra tái sử dụng cache `CanvasTexture`, gắn đủ decal vào Hook / Boom / Spreader / Cargo và kiểm tra lớp phủ SVG watermark theo trạng thái `free` / `trial` / `pro` (và đảm bảo `test/auth_screen.test.js` vẫn xanh).
- **Kiểm tra:** `npx vitest run test/brand_decal_and_watermark.test.js test/auth_screen.test.js test/graphics.test.js test/rigging.test.js` + `npm run architecture:gate`.

### [ ] Bước 5: Module 3 (PDF) & Risk Assessment JSA/HSE Matrix Động Từ Thông Số 3D
- **Tạo mới:**
  - `src/core/RiskAssessmentReport.js` (< 210 dòng, `@purpose: Đánh giá ma trận rủi ro JSA/HSE động (Đất nền, Góc Sling, Lệch CoG, Gió, Kiểm định thiết bị) và sinh Header/Footer + Watermark in PDF thuần không phụ thuộc DOM`):
    - `evaluateLiveRiskMatrix(planModel)`: nhận thông số vật lý thực (`workingRadiusM`, `groundBearingKpa`, `topBridle.slingAngleDeg`, `cogOffsetM`, `windSpeedMps / maxWindLimitMps`, `inspectionStatus`), chấm mức `LOW / MEDIUM / HIGH / CRITICAL`, xác suất/mức nghiêm trọng và biện pháp kiểm soát cụ thể.
    - `buildPdfBrandingChrome({ isTrialActive, isProUser, lang })`: sinh CSS & HTML cho:
      - Header/Footer mỗi trang PDF (`@page` + print header/footer cố định): `Generated by SafeLift3D (safelift3d.com) | System Architect: Lê Việt Phương (levietphuong.hcmutrans@gmail.com | +84 968 051 697)`.
      - Watermark chéo nền mỗi trang PDF: **chữ đỏ đậm lặp chéo** (`TRIAL VERSION — SAFELIFT3D.COM • NOT FOR CONSTRUCTION`) nếu đang dùng bản **24h Trial / Free**, và watermark bảo mật xám/xanh cực mảnh (`AUTHORIZED PRO LICENSE — SAFELIFT3D.COM`) nếu là **Pro / Enterprise / Admin**.
      - Trang **Integrated Risk Assessment (JSA / HSE)** có ngắt trang in chuẩn A4 (`page-break-before: always`) trình bày đủ 5 hạng mục bắt buộc + bảng ma trận đánh giá + chữ ký HSE.
- **Sửa (≤ 20 dòng/file):**
  - `src/core/LiftPlanModel.js`: dùng `buildPdfBrandingChrome` & `evaluateLiveRiskMatrix` trong `generatePrintableHTML(screenshotUrl, options)` để mỗi trang đều có Header/Footer bản quyền, Watermark theo gói (`trial` vs `pro`) và trang JSA/HSE Risk Assessment tự động ở cuối hồ sơ.
  - `src/sim/compliance.js` (`buildCurrentLiftPlanModel` & `exportLiftPlanToPDF`): truyền trạng thái gió thực (`state.weather / phy.wind`), áp lực nền (`phy.groundBearing` / Tab 6), tình trạng kiểm định (`state.gear`) và trạng thái gói người dùng hiện tại (`window.SafeLift?.saas?.profile` -> `isTrialActive`, `isProUser`), đồng thời kiểm tra khóa `riskAssessmentGenerator` nếu Admin đang đặt `Under Upgrade`!
- **Tạo / cập nhật test:** `test/risk_assessment_pdf.test.js` kiểm tra Risk Assessment Matrix phản ứng đúng theo góc sling `<45°`, CoG lệch lớn, gió cao, quá áp lực nền, và kiểm tra watermark đỏ nặng khi `isTrialActive: true` vs nhẹ khi `isProUser: true` + attribution footer đủ tên/email/SĐT tác giả; chạy `test/liftplan.test.js` & `test/standards_compliance_engine.test.js`.
- **Kiểm tra:** `npx vitest run test/risk_assessment_pdf.test.js test/liftplan.test.js test/standards_compliance_engine.test.js` + `npm run architecture:gate`.

### [ ] Bước 6: Kiểm Thử Toàn Diện, Build Sạch & Nghiệm Thu Cuối
- Chạy: `npx vitest run` (toàn bộ ~65 file test), `npm run architecture:gate`, `npm run build`, `npm run check:dist`, `npx playwright test e2e/saas-accessibility.spec.js --project=fhd-1080p`, `./scripts/auto_check.ps1`.
- Nếu có Firebase Emulator chạy được trên máy, chạy kiểm chứng thêm `node --test test/firestore-rules-emulator.mjs` (hoặc báo rõ nếu chưa mở Java emulator).
- Cập nhật `auto_memory/CONTEXT.md`, `STATE.md`, đặt `Trạng thái: DONE` trong `PLAN.md`, chạy `./scripts/auto_log.ps1`.
- **KHÔNG tự `git push`/deploy** khi chưa được Founder cho phép trong chính phiên đó.
