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
| T-01 | □ | | | |
| T-02 | □ | | | |
| T-03 | □ | | | |
| T-04 | □ | | | |
| T-05 | ◐ (UI-015 chỉ sửa test; UI-008/UI-003 hoãn) | | | |
| T-06 | □ | | | |
| T-07 | □ | | | |
| T-08 | □ | | | |
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
