# SafeLift3D — Kế hoạch bổ sung V3 (sau S-00 → S-15)

Ngày lập: 13/11/2026. Nền: HEAD `7949b7e`, nhánh local `codex/safelift-g0-ci`, chưa push.
Kế thừa nguyên **Mục A (quy tắc bắt buộc)** của `UPGRADE_PLAN_V2_FOR_FLASH.md`: một bước mỗi lượt, test đỏ thì dừng, một commit cục bộ mỗi bước, không sửa vật lý, không Blaze/billing/Cloud Functions, không deploy production, không push, không đụng `.env*`, không xoá/nới test. Ghi kết quả thật vào mục "Nhật ký" cuối file này.

## 1. Kết quả kiểm tra V2 so với yêu cầu

**Đạt (đã chạy lại trên HEAD):** gate OK; Unit 40 file / 295 test; Rules 16/16; build + `check:dist` OK; `npm audit` 0 lỗ hổng; E2E Auth Emulator 2/2; E2E SaaS 16/16.

**Chưa đạt / còn hở (đã xác minh bằng chạy lệnh hoặc đọc mã):**

| ID | Mức | Phát hiện | Bằng chứng |
|---|---|---|---|
| G-01 | Cao → Hoãn một phần | `e2e/layout.spec.js` có 9 lỗi lúc kiểm tra (UI-008 ×4, UI-015 ×4, UI-003 ×1). **Cập nhật 13/11/2026:** UI-015 do test sai (Gear Editor bắt buộc 4 slider) → đã sửa test; UI-008/UI-003 (5 ca) **hoãn** đến khi chủ sản phẩm cấu hình xong Firebase. CI không chạy file này nên lỗi bị che. | Playwright, 43 đạt / 9 lỗi |
| G-02 | Cao | **Feature flags chưa là kill-switch thật**: `maintenanceMode`, `disabledModules`, `freePlanLimit` chỉ được đọc/ghi ở `admin_dashboard.js` + `telemetry_usage.js`; không thấy `session.js`/`feature_access_ui.js` áp dụng (cần Flash grep lại để xác nhận ở T-01). Mục G6.02 vẫn chỉ "◐". | grep `src/` |
| G-03 | Trung bình | **Catalog chưa được ai dùng**: `listCatalogItems` chỉ gọi từ `admin_dashboard.js`; simulator/workspace không đọc catalog. | grep `src/` |
| G-04 | Trung bình | **Audit log yếu hơn yêu cầu** của `PRODUCT_UPGRADE_PLAN.md` mục 2.6 (ai/lúc nào/mục tiêu/**giá trị trước-sau/lý do**): chỉ có `summary` ≤240 ký tự; ghi log sau khi mutation và nuốt lỗi (`.catch(() => {})`) → có thể thay đổi quyền mà không có log. | `cms_data.js`, `admin_dashboard.js`, `validAuditLog()` |
| G-05 | Trung bình | **Quota Spark chỉ mang tính hiển thị**: rules chỉ ép `usage` tăng tuần tự ≤200, không ràng buộc rằng mỗi ghi equipment/liftPlan phải đi cùng tăng `usage` → client cố ý bỏ qua được. Cần ghi rõ giới hạn hoặc ép bằng batch + `getAfter()`. | `firestore.rules` meta/usage |
| G-06 | Trung bình | CI chỉ chạy `e2e/saas-accessibility.spec.js`; **không chạy** `test:e2e:auth` và `layout.spec.js`. CI GitHub chưa từng chạy cho HEAD. | `.github/workflows/ci.yml` |
| G-07 | Thấp | CSP vẫn **Report-Only**; còn 2 inline vi phạm (`index.html` handler `onclick` và script loading). | Nhật ký S-04 |
| G-08 | Thấp | Admin UI theo vai trò (support chỉ đọc, catalog-editor chỉ thấy catalog) **chưa có test UI/E2E**; chỉ có rules test + unit hàm thuần. | `test/`, `e2e/` |
| G-09 | Thấp | `PRODUCT_UPGRADE_PLAN.md`: tôi chỉ cập nhật bảng trạng thái; **checklist G0–G6 và đoạn "Bước tiếp theo" vẫn cũ** (G1.05, G1.06, G1.07, G2.06, G3.02–G3.05, G5.01, G6.02, G6.04, G0.09…). | đọc file |
| G-10 | Thông tin | Việc chủ sản phẩm phải làm tay (Flash không làm): push, CI xanh có run id, Preview staging, domain `auth/unauthorized-domain`, App Check metrics, bật CSP enforce. | Giai đoạn 5 V2 |

Chưa kiểm chứng trong lượt này: nguyên nhân gốc của 9 lỗi layout, hành vi thực tế trên staging, mobile/screen reader/contrast (G1.06).

## 2. Kế hoạch theo bước

### T-00 Baseline
- `git status` sạch; chạy Unit, Gate, Build, `check:dist`, Rules, `npx playwright test e2e/layout.spec.js`; ghi số vào Nhật ký. Không sửa tài liệu cho khớp số cũ.

### T-01 Làm feature flags thành kill-switch thật (G-02)
1. `Select-String` toàn `src` để xác nhận chưa ai dùng `maintenanceMode/disabledModules/freePlanLimit` ngoài CMS.
2. Tạo `src/saas/runtime_flags.js` (hàm thuần): `applyFlagsToAccess(flags, profile, featureId)` → `{allowed, reason}`; `getFreePlanLimit(flags)` clamp 1–200; `isMaintenance(flags, profile)` (admin/support luôn qua).
3. `session.js`: sau khi có `authUser` + profile, gọi `readFeatureFlags` **một lần/phiên** (cache RAM, lỗi → dùng mặc định, không chặn app). Hiển thị banner bảo trì (key i18n mới, VI/EN cân xứng) và chặn mở workspace khi `maintenanceMode` với user thường.
4. `feature_access_ui.js`: module trong `disabledModules` hiển thị paywall "tạm tắt".
5. `workspace_data.js`/`workspace_dashboard.js`: dùng `getFreePlanLimit` thay hằng cứng (rules vẫn là trần thật; client chỉ thấp hơn hoặc bằng).
- Test: `test/runtime_flags.test.js` (≥8 ca: flags rỗng, bảo trì + user thường/admin, module bị tắt, limit ngoài biên, lỗi đọc flags không crash); mở rộng `e2e/auth.spec.js` 1 ca: admin bật bảo trì → user thường thấy banner (dùng Emulator), tắt lại.
- Done: Unit + Gate + Build + E2E auth xanh.

### T-02 Audit log đủ trường, ghi nguyên tử (G-04)
1. **Rules trước**: thêm trường tuỳ chọn `reason` (string ≤200), `before`/`after` (string JSON ≤400 mỗi trường, đã lọc trường nhạy cảm) vào `validAuditLog()`; bắt buộc `reason` cho `USER_ACCESS_UPDATE`. Giữ append-only.
2. `cms_data.js`: `appendAuditLog` nhận `{reason, before, after}`; thêm `commitWithAudit(db, writes, auditEntry)` dùng `writeBatch` để mutation + audit **cùng commit** (cho `setUserAccess`, `saveFeatureFlags`, `saveCatalogItem`, `deleteCatalogItem`). Bỏ `.catch(() => {})` nuốt lỗi.
3. `admin_dashboard.js`: yêu cầu nhập lý do (input ngắn hoặc `prompt` chuẩn hoá bằng form inline) trước khi khoá/ban/đổi tier; xác nhận lại hành động nguy hiểm (ban/khoá).
4. Hiển thị `before → after` và `reason` trong bảng audit.
- Test: Rules ≥4 ca mới (thiếu reason bị từ chối, before quá dài bị từ chối, support không tạo được log, update/delete log vẫn false); Unit cho `commitWithAudit` (mock: lỗi audit thì mutation không ghi).
- Done: `npm run test:rules` > 16 ca, tất cả xanh.

### T-03 Catalog dùng được ở phía người dùng (G-03)
1. `src/saas/catalog_client.js`: `loadCatalogForUser(db)` (cache RAM, `limit ≤ 50`, chỉ item `enabled`, lọc theo tier user), lỗi → rỗng.
2. `workspace_dashboard.js` tab "Dụng cụ": nút "Thêm từ catalog" tạo bản sao vào `equipment` của user (tôn trọng quota slot Free/Premium và `recordUsageWrite`). Không đụng simulator/vật lý.
3. i18n VI/EN cân xứng; đếm đúng quota.
- Test: Unit `test/catalog_client.test.js` (lọc enabled/tier, cache, lỗi); E2E Emulator 1 ca: catalog-editor tạo item → user thường thêm vào kho → reload còn dữ liệu.
- Done: Unit + Gate + Build + E2E auth xanh.

### T-04 Quota Spark: ép ở rules hoặc ghi rõ giới hạn (G-05)
- Phương án ưu tiên: ghi `equipment`/`liftPlans` kèm cập nhật `meta/usage` trong **một batch**, và rules dùng `getAfter(/databases/$(database)/documents/users/$(uid)/meta/usage).data.writesToday` để từ chối nếu không tăng. Test rules: ghi không kèm usage bị từ chối; kèm usage hợp lệ được; vượt 200 bị từ chối; sang ngày mới reset.
- Nếu chi phí đọc `getAfter` quá lớn/gây vỡ test hiện có: **không ép**, chuyển nhãn UI thành "ước lượng phía client" và ghi rõ trong `docs/SECURITY_THREAT_MODEL.md` (không tuyên bố đây là hàng rào bảo mật).
- Done: Rules xanh; tài liệu phản ánh đúng mức bảo đảm.

### T-05 Lỗi layout E2E (G-01) — ĐÃ CHỐT PHẠM VI (chủ sản phẩm, 13/11/2026)

**Quyết định của chủ sản phẩm:**
- **UI-015:** Gear Editor **bắt buộc có đúng 4 slider** (`#gear-editor input[type="range"]`). UI là đúng, test sai → **đã sửa test** `e2e/layout.spec.js` (tiêu đề + kỳ vọng `toBe(4)`), không sửa UI. Kết quả chạy xem Nhật ký T-05a.
- **UI-008 (4 viewport) và UI-003 (hd-720p): HOÃN** cho đến khi chủ sản phẩm cấu hình xong Firebase. **Flash KHÔNG sửa hai lỗi này** và không nới/xoá test của chúng. Chúng vẫn được ghi nhận là lỗi đã biết ở mọi bản báo cáo.

**Hệ quả cho các bước khác:**
- T-08 (CI) **không** thêm `e2e/layout.spec.js` vào CI chừng nào UI-008/UI-003 còn đỏ; chỉ thêm `test:e2e:auth`. Khi hai lỗi được sửa ở đợt sau mới thêm layout vào CI.
- T-10 báo cáo cuối phải nêu rõ: `layout.spec.js` còn **5 lỗi hoãn** (UI-008 ×4, UI-003 ×1) nếu UI-015 xanh; không được ghi "toàn bộ E2E xanh".
- Khi chủ sản phẩm mở lại hạng mục: điều tra UI-008 (`#safety-hud` bị `#app-loading-screen` che — kiểm tra màn loading có ẩn/`pointer-events:none` sau sẵn sàng, hay test thiếu chờ trạng thái sẵn sàng) và UI-003 (hd-720p, `dockRightEdge 928.52 > drawerLeftEdge+5 = 925`, chỉnh CSS bố cục dock/drawer 1280×720), ghi nguyên nhân gốc trước khi sửa.
- Test T-05a (Flash chạy lại nếu cần): `npx playwright test e2e/layout.spec.js -g "UI-015" --reporter=list` phải xanh ở 4 viewport; sau đó `npx playwright test e2e/saas-accessibility.spec.js --reporter=list` vẫn 16/16.

### T-06 CSP enforce-ready (G-07)
- Bỏ handler `onclick` inline ở `index.html` (dùng `addEventListener` trong module) và chuyển script khởi tạo màn loading thành file module hoặc băm `sha256` được liệt kê trong CSP. Chạy lại probe Playwright (`vite preview` + `dist/_headers`): kỳ vọng **0** vi phạm. Vẫn giữ `Report-Only`; chỉ chủ sản phẩm quyết định bật enforce.

### T-07 Test UI theo vai trò CMS (G-08)
- `e2e/cms-roles.spec.js` (Auth Emulator, seed role bằng Admin REST của emulator): `support` thấy user+audit, nút đổi quyền bị `disabled`; `catalog-editor` chỉ thấy catalog, không thấy bảng user; `user` thường vào `/admin` thấy "Cần quyền admin"; admin đổi tier → xuất hiện dòng audit có lý do.
- Thêm `test:e2e:auth` chạy cả file này (cập nhật `playwright.auth.config.js` testMatch).

### T-08 Nâng CI (G-06)
- `ci.yml`: thêm bước `npm run test:e2e:auth` (Java đã có sẵn trong workflow); giữ upload artifact khi lỗi. **Không thêm `e2e/layout.spec.js`** cho đến khi UI-008/UI-003 được sửa (xem T-05). Kiểm YAML bằng đọc kỹ/`yaml-lint`. Chỉ ghi "CI xanh" khi chủ sản phẩm push và có run id thật.

### T-09 Đồng bộ tài liệu (G-09)
- Cập nhật checklist `PRODUCT_UPGRADE_PLAN.md`: G1.05/G1.07, G2.06, G3.02–G3.05, G5.01, G6.02, G6.04 theo bằng chứng thật (chỉ ✓ khi có lệnh xanh; phần cần staging giữ ◐/□), thay đoạn "Bước tiếp theo" bằng trỏ tới file này.
- Cập nhật `docs/SECURITY_THREAT_MODEL.md` (audit log, quota, flags, role) và `docs/architecture/PERFORMANCE.md` nếu số đo đổi.

### T-10 Rà soát cuối
- Chạy: Gate, Unit, Rules, Build, `check:dist`, `npm audit --audit-level=high`, `npx playwright test` (toàn bộ 4 viewport), `npm run test:e2e:auth`; `git status` sạch. Báo cáo chỉ số đo thật, nêu rõ ca nào lỗi/bỏ qua. **Lỗi đã biết được phép còn lại:** UI-008 ×4 và UI-003 ×1 (hoãn theo T-05); mọi lỗi khác là chưa đạt.

## 3. Việc dành cho chủ sản phẩm (Flash không làm)
1. Push nhánh, xem CI GitHub chạy xanh (ghi run id).
2. Preview Cloudflare với `VITE_APP_ENV=staging`; thêm domain preview vào Authorized domains **staging** (không production); kiểm Google login, CRUD, reload, hai tài khoản.
3. Quyết định bật CSP enforce sau khi probe sạch; App Check enforce sau khi xem metrics.
4. ~~Quyết định yêu cầu UI-015~~ — **đã chốt:** Gear Editor có đúng 4 slider.
5. Cấu hình Firebase xong thì báo lại để mở hạng mục hoãn UI-008/UI-003 (T-05).

## 4. Bảng trạng thái (cập nhật sau mỗi bước)

| Bước | Trạng thái | Lệnh đã chạy | Kết quả | Ngày |
|---|---|---|---|---|
| T-00 | ✓ | `git status`, `architecture:gate`, `npm test`, `npm run build`, `check:dist`, `test:rules`, `layout.spec.js` | Gate OK; Unit 40/40 (295/295); Build 10.79s + `check:dist` OK; Rules 16/16; Layout E2E 31/36 đạt (chỉ còn 5 ca hoãn UI-008 ×4, UI-003 ×1) | 13/11/2026 |
| T-01 | ✓ | `Select-String`, `architecture:gate`, `npm test`, `npm run build`, `check:dist`, `npm run test:e2e:auth` | Tạo `src/saas/runtime_flags.js` (`applyFlagsToAccess`, `getFreePlanLimit`, `isMaintenance`, `loadFlagsOnce`), nối kill-switch vào `session.js`/`feature_access_ui.js`/`workspace_*`; Unit **41/41 (303/303)**; Gate OK; Build 8.25s + `check:dist` OK; E2E Auth **3/3** | 13/11/2026 |
| T-02 | ✓ | `architecture:gate`, `npm test`, `npm run build`, `check:dist`, `test:rules`, `npm run test:e2e:auth` | Rules 20/20 (4 ca audit âm tính mới); `cms_data.js` ghi nguyên tử qua `writeBatch` (`commitWithAudit`), `reason` + `before`/`after` trong `admin_dashboard.js`; Unit **41/41 (304/304)**; Gate OK; Build 6.04s + `check:dist` OK; E2E Auth **3/3** | 13/11/2026 |
| T-03 | ✓ | `architecture:gate`, `npm test`, `npm run build`, `check:dist`, `npm run test:e2e:auth` | Tạo `src/saas/catalog_client.js` (cache RAM, `limit<=50`, lọc `enabled` & tier, fallback `[]`), nối picker vào `workspace_dashboard.js` tab Dụng cụ; Unit **42/42 (307/307)** (`test/catalog_client.test.js` 3 ca mới); Gate OK; Build 5.83s + `check:dist` OK; E2E Auth **4/4** | 13/11/2026 |
| T-04 | ✓ | `architecture:gate`, `npm test`, `npm run build`, `check:dist`, `test:rules` | Chọn phương án 2 để tránh chi phí đọc `getAfter` trên Spark và giữ tương thích CRUD trực tiếp: đổi nhãn `wsDailyQuotaHint` sang ước lượng phía client, ghi rõ giới hạn telemetry trong `SECURITY_THREAT_MODEL.md`; Rules **20/20**; Unit **42/42 (307/307)**; Build 5.66s + `check:dist` OK | 13/11/2026 |
| T-05 | ◐ (UI-015 đã sửa test 4/4; UI-008/UI-003 hoãn) | `npx playwright test e2e/layout.spec.js -g "UI-015"`, `npx playwright test e2e/saas-accessibility.spec.js` | Đúng phạm vi đã chốt: không sửa UI-008/UI-003; `UI-015` đạt **4/4** (`20.5s`); `saas-accessibility.spec.js` đạt **16/16** (`1.8m`) | 13/11/2026 |
| T-06 | ✓ | `architecture:gate`, `npm test`, `npm run build`, `check:dist`, probe Playwright CSP `dist/_headers` | Bỏ `onclick` inline ở `index.html` (`#btn-comp-hud-export` nối qua `src/ui/controllers/index.js`), tách script màn loading sang `public/loading-screen-init.js`; thêm test `security_headers.test.js`; Unit **42/42 (308/308)**; Build 5.76s; Probe CSP `/` & `/admin` **0 vi phạm** (`Content-Security-Policy-Report-Only` giữ nguyên cho chủ sản phẩm bật enforce) | 13/11/2026 |
| T-07 | ✓ | `architecture:gate`, `npm run test:e2e:auth` | Tạo `e2e/emulator_helpers.js` + `e2e/cms-roles.spec.js`, cập nhật `playwright.auth.config.js` chạy cả `auth.spec.js` và `cms-roles.spec.js`; E2E Emulator **5/5 đạt** (`2.3m`: `user` bị chặn, `support` chỉ đọc/nút `disabled`, `catalog-editor` chỉ thấy catalog, `admin` bắt buộc lý do + ghi dòng audit `before -> after`) | 13/11/2026 |
| T-08 | ✓ (chờ push lấy run id) | Kiểm tra cú pháp YAML `.github/workflows/ci.yml` + rà indent | Thêm bước `npm run test:e2e:auth`, giữ upload artifact khi lỗi (`playwright-report/` + `test-results/`), giữ không thêm `e2e/layout.spec.js` theo T-05; YAML sạch, không tab | 13/11/2026 |
| T-09 | □ | | | |
| T-10 | □ | | | |

## 5. Nhật ký

(T-05a, 13/11/2026) `e2e/layout.spec.js` UI-015: kỳ vọng slider đổi từ 0 sang **4** theo quyết định chủ sản phẩm (không sửa UI). `npx playwright test e2e/layout.spec.js -g "UI-015" --reporter=list` → **4/4 đạt** (fhd-1080p, hd-720p, laptop-768p, qhd-1440p). UI-008 ×4 và UI-003 ×1 chưa sửa (hoãn).

### T-00 Baseline — 13/11/2026
- `git status`: working tree sạch trên nhánh `codex/safelift-g0-ci` (`0401a24`).
- `npm run architecture:gate`: đạt (6 shim 7 lines, 28 manifest parts).
- `npm test -- --reporter=dot`: **40/40 file, 295/295 test đạt** (44.35s).
- `npm run build` + `npm run check:dist`: build xong in `10.79s`; `OK: no .map files in dist/`.
- `npm run test:rules`: **16/16 passed** (3.88s).
- `npx playwright test e2e/layout.spec.js --reporter=list`: **31 passed, 5 failed** (5.9m) — gồm đúng 5 ca hoãn (`UI-008` ×4 viewport và `UI-003` trên `hd-720p`); `UI-015` đạt 4/4.

### T-01 Làm feature flags thành kill-switch thật (G-02) — 13/11/2026
- Xác nhận bằng `Select-String` trên `src/**/*.js`: `maintenanceMode`, `disabledModules`, `freePlanLimit` trước đó chỉ xuất hiện trong `admin_dashboard.js`, `telemetry_usage.js` và `keys.js`.
- Tạo `src/saas/runtime_flags.js` (`applyFlagsToAccess`, `getFreePlanLimit`, `getTierSlotLimit`, `isMaintenance`, `isModuleDisabled`, `loadFlagsOnce`).
- Nối cờ vào `src/saas/session.js` (đọc một lần mỗi phiên, hiện `#saas-maintenance-banner` và khóa mở workspace với user thường khi bảo trì; `admin`/`support` vẫn qua), `src/saas/feature_access_ui.js` (paywall "tạm tắt" theo `disabledModules` và bảo trì), `src/saas/workspace_data.js` + `src/saas/workspace_dashboard.js` (`getTierSlotLimit` cho giới hạn Free 1–200), `src/saas/saas.css`, `src/i18n/keys.js` (đối xứng VI/EN).
- Kiểm tra: `architecture:gate` OK; Unit **41/41 file, 303/303 test đạt** (`test/runtime_flags.test.js` 8 ca mới); `npm run build` OK (`8.25s`) + `check:dist` OK; `npm run test:e2e:auth` **3/3 đạt** (gồm ca admin bật/tắt bảo trì và kiểm tra banner/khóa workspace trên Emulator).

### T-02 Audit log đủ trường, ghi nguyên tử (G-04) — 13/11/2026
- `firestore.rules`: mở rộng `validAuditLog()` hỗ trợ `reason` (≤200 ký tự, **bắt buộc không rỗng** khi `action == 'USER_ACCESS_UPDATE'`) và `before`/`after` (chuỗi JSON ≤400 ký tự mỗi trường), giữ append-only (`update, delete: if false`).
- `src/saas/cms_data.js`: thêm `serializeAuditState` (lọc các trường nhạy cảm như token/password), `buildAuditLogEntry`, và `commitWithAudit` dùng `writeBatch` để ghi mutation + `adminAuditLogs` nguyên tử cho `setUserAccessWithAudit`, `saveFeatureFlagsWithAudit`, `saveCatalogItem`, `deleteCatalogItem`; bỏ nuốt lỗi.
- `src/saas/admin_dashboard.js` + `src/i18n/keys.js`: yêu cầu nhập lý do ở form inline `#admin-access-reason` trước khi đổi gói/trạng thái user, hộp thoại xác nhận `window.confirm` trước khi `locked`/`banned`, ô lý do tuỳ chọn cho feature flags/catalog, và hiển thị `reason` + `before -> after` trong bảng audit.
- Kiểm tra: `npm run test:rules` **20/20 passed** (gồm 4 ca mới cho reason bắt buộc, giới hạn 400 ký tự `before`/`after`, `support` bị từ chối ghi log, và `update`/`delete` log bị từ chối); `architecture:gate` OK; Unit **41/41 file, 304/304 test đạt** (`test/cms_data.test.js` kiểm tra `commitWithAudit` nguyên tử & rollback); `npm run build` (`6.04s`) + `check:dist` OK; `npm run test:e2e:auth` **3/3 đạt**.

### T-03 Catalog dùng được ở phía người dùng (G-03) — 13/11/2026
- Tạo `src/saas/catalog_client.js`: `loadCatalogForUser(db, profile)` dùng cache RAM theo tier, truy vấn có `limit <= 50`, chỉ giữ item `enabled: true` và khớp gói (`free` hoặc `premium`/`admin`), fallback mảng rỗng `[]` khi lỗi; kèm `mapCatalogItemToEquipmentInput` chuẩn hóa giới hạn trường theo `firestore.rules`.
- Cập nhật `src/saas/workspace_dashboard.js` + `src/i18n/keys.js` (VI/EN đối xứng): thêm nút `Thêm từ catalog` ở tab Dụng cụ (`tab === 'equipment'`), mở modal picker chọn mục từ catalog để gọi `dataService.createEquipment(..., { flags: activeFlags })` tôn trọng quota slot và `recordUsageWrite`. Không chạm mã vật lý/simulator.
- Kiểm tra: `architecture:gate` OK; Unit **42/42 file, 307/307 test đạt** (`test/catalog_client.test.js` 3 ca mới); `npm run build` (`5.83s`) + `check:dist` OK; `npm run test:e2e:auth` **4/4 đạt** (ca mới: `catalog-editor` tạo mục catalog, user thường thêm bản sao vào kho Dụng cụ, reload trang vẫn còn).

### T-04 Quota Spark: không ép `getAfter`, ghi rõ giới hạn telemetry (G-05) — 13/11/2026
- Chọn phương án 2 theo mục tiêu Spark Free và tính tương thích của `test/firestore-rules-emulator.mjs` (các ca ghi trực tiếp `equipment`/`liftPlans`) và các luồng update/delete trực tiếp: không ép `getAfter(.../meta/usage)` trên từng lần ghi `equipment`/`liftPlans` để tránh tăng lượt đọc Firestore và làm gãy đường ghi trực tiếp.
- Cập nhật `src/i18n/keys.js` (`wsDailyQuotaHint` VI/EN cân xứng) để ghi rõ đây là **ước lượng phía client**, và cập nhật mục 4 của `docs/SECURITY_THREAT_MODEL.md` nêu rõ `meta/usage` là telemetry mềm còn giới hạn slot (`1–20`/`1–200`) và kích thước tài liệu (`<= 48,000` byte) mới là hàng rào bảo mật thực thi bởi `firestore.rules`.
- Kiểm tra: `architecture:gate` OK; Unit **42/42 file, 307/307 test đạt** (`36.83s`, `i18n_keys.test.js` xanh); `npm run build` (`5.66s`) + `check:dist` OK; `npm run test:rules` **20/20 passed**.

### T-05 Xác nhận phạm vi Layout E2E (UI-015 đạt, UI-008/UI-003 hoãn) — 13/11/2026
- Giữ nguyên quyết định của chủ sản phẩm: không sửa UI-008 (`#safety-hud`) và UI-003 (`hd-720p` dock/drawer), không nới/xóa test của chúng.
- Kiểm tra lại: `npx playwright test e2e/layout.spec.js -g "UI-015" --reporter=list` → **4/4 passed** (`20.5s`); `npx playwright test e2e/saas-accessibility.spec.js --reporter=list` → **16/16 passed** (`1.8m`).

### T-06 CSP enforce-ready (G-07) — 13/11/2026
- `index.html` + `src/ui/controllers/index.js`: bỏ thuộc tính `onclick` inline trên nút xuất hồ sơ Lift Plan trong HUD (`#btn-comp-hud-export`), thay bằng `addEventListener('click', ...)` kèm dọn dẹp trong `dispose()`.
- `public/loading-screen-init.js`: tách đoạn `<script>` inline khởi tạo năm/ngôn ngữ màn loading ra file `/loading-screen-init.js` phục vụ từ `'self'`; giữ nguyên `Content-Security-Policy-Report-Only` trong `public/_headers` (quyết định bật enforce thuộc về chủ sản phẩm).
- `test/security_headers.test.js`: bổ sung assert bảo đảm `index.html` không còn `<script>` inline hay thuộc tính `on*=`.
- Kiểm tra: `architecture:gate` OK; Unit **42/42 file, 308/308 test đạt** (`36.98s`); `npm run build` (`5.76s`) + `check:dist` OK; probe Playwright đọc trực tiếp header `Content-Security-Policy-Report-Only` từ `dist/_headers` trên route `/` và `/admin` ghi nhận `TOTAL_CSP_VIOLATIONS=0`, `CSP_CONSOLE=0`.

### T-07 Test UI theo vai trò CMS trên Emulator (G-08) — 13/11/2026
- Tách `e2e/emulator_helpers.js` (dùng chung cho `e2e/auth.spec.js` và `e2e/cms-roles.spec.js` để không lặp logic Emulator Auth/Firestore).
- Tạo `e2e/cms-roles.spec.js` kiểm tra 4 vai trò trên Auth + Firestore Emulator: `user` thường vào `/admin` thấy thông báo `Cần quyền quản trị viên`; `support` thấy bảng user + audit nhưng nút đổi tier/trạng thái/cờ bị `disabled` và không thấy catalog; `catalog-editor` chỉ thấy catalog; `admin` thiếu lý do bị chặn, nhập lý do đổi tier thành công và xuất hiện dòng audit `USER_ACCESS_UPDATE` kèm lý do và diff `free -> premium`.
- Cập nhật `playwright.auth.config.js` `testMatch: ['**/auth.spec.js', '**/cms-roles.spec.js']`.
- Kiểm tra: `architecture:gate` OK; `npm run test:e2e:auth` **5/5 passed** (`2.3m`).

### T-08 Nâng CI (G-06) — 13/11/2026
- `.github/workflows/ci.yml`: giữ Java 21, `architecture:gate`, `npm test`, `test:rules`, `build`, `check:dist`, `e2e/saas-accessibility.spec.js`, đồng thời thêm bước `Run Auth and CMS Emulator E2E tests` (`npm run test:e2e:auth`) và giữ `Upload Playwright artifacts on failure` (`playwright-report/` + `test-results/`, `if-no-files-found: ignore`). Không thêm `e2e/layout.spec.js` chừng nào UI-008/UI-003 còn hoãn theo T-05.
- Kiểm tra cục bộ: xác nhận cấu trúc YAML (97 dòng trước EOF, 0 tab, đúng indent 2 dấu cách), `hasAuthE2E: true`, `hasLayoutSpec: false`. Chưa ghi "CI xanh" cho đến khi chủ sản phẩm push và có run id thật.
