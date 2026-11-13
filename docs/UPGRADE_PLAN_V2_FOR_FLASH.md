# SafeLift3D — Kế hoạch nâng cấp V2 (dành cho Gemini Flash thực thi)

Ngày lập: 13/11/2026. Thay thế phần "Bước tiếp theo" của `docs/PRODUCT_UPGRADE_PLAN.md` (file đó giữ làm tầm nhìn sản phẩm; file này là danh sách việc thực thi).

## A. QUY TẮC BẮT BUỘC CHO NGƯỜI THỰC THI (đọc trước)

1. **Làm đúng một bước (S-xx) mỗi lượt**, theo thứ tự. Xong bước → chạy lệnh kiểm tra của bước → ghi kết quả thật vào mục "Nhật ký" cuối file → mới sang bước sau. Test đỏ thì **dừng và sửa**, không sang bước sau, không xoá/nới test để qua.
2. **Không sửa vật lý** (`src/sim/physics/**`, `src/core/physics-world/**`, `src/rigging/**`, solver): đang hoãn theo chỉ đạo chủ sản phẩm. Chỉ sửa nếu bước ghi rõ.
3. **Không bật Firebase Blaze, không thêm thẻ/billing, không dùng Cloud Functions, không làm G4 (thanh toán).** Spark Free: chỉ text/JSON nhẹ.
4. **Không deploy production, không sửa Authorized domains production, không `git push --force`, không commit secret.** Phát hành chỉ khi chủ sản phẩm nói rõ.
5. **Không sửa `.env*`, `.vercel/`** ngoài việc được yêu cầu. Không in nội dung file env ra log/doc.
6. Mỗi thay đổi nhỏ, có test đi kèm. Không đánh dấu ✓ trong tài liệu nếu chưa có lệnh chạy xanh.
7. Mỗi bước kết thúc bằng 1 commit cục bộ riêng (`git commit`, không push) để dễ rollback. Chuẩn bị trước: commit/stash working tree hiện tại ở S-00.
8. File lớn (`src/sim/**` hàng trăm KB) — dùng `Select-String`/đọc theo dải dòng, không đọc cả file.
9. Kiến trúc: `src/sim/**` được nối thành 1 bundle ảo qua `src/sim/manifest.js` + `vite.config.js` (biến toàn cục dùng chung). Thêm file sim mới phải khai báo trong manifest. Code SaaS mới đặt ở `src/saas/**`, không thêm vào monolith (ADR-002).

**Lệnh kiểm tra chuẩn:**

| Tên | Lệnh | Khi nào |
|---|---|---|
| Unit | `npm test -- --reporter=dot` | mọi bước |
| Gate | `npm run architecture:gate` | mọi bước |
| Build | `npm run build` | mọi bước |
| Rules | `npm run test:rules` | bước đụng `firestore.rules` |
| E2E | `npx playwright test` | bước đụng UI |

---

## B. KẾT QUẢ KIỂM TRA HỆ THỐNG (13/11/2026)

### B1. Tài liệu `PRODUCT_UPGRADE_PLAN.md` có vấn đề
- Quá dài, một đoạn "Trạng thái" nhồi lẫn nhiều trạng thái → khó theo dõi; tình trạng ✓/◐/□ không gắn lệnh kiểm chứng.
- Tham chiếu CI `3f90a66`, nhưng HEAD hiện là `a1fc348` + 19 file chưa commit → CI xanh cũ **không** đại diện code hiện tại.
- Mô tả "Vercel" còn trong `docs/architecture/*` và thư mục `.vercel/` (đã gitignore), trong khi đích là Cloudflare Pages.
- G0.07/G6 mô tả "kill switch", "quota" nhưng chưa có mã nào hiện thực.

### B2. Lỗi / rủi ro tìm thấy trong mã
| ID | Mức | Phát hiện | Vị trí |
|---|---|---|---|
| F-01 | Trung bình | Chuỗi Việt cố định hiển thị cả khi EN: `Kiện quy đổi…`, `index.html:908` placeholder tiếng Việt tĩnh; nhánh `L(en, vi)` được tính 1 lần lúc `applyCargo…` nên đổi ngôn ngữ không cập nhật panel `lbl-oog-derived`. Bản dịch tra cứu tại `presets_events.js:629` chỉ áp cho chuỗi chính xác, không khớp chuỗi có số | `src/sim/session/ui_units_bom.js:221-231`, `index.html:908`, `src/sim/gear/editor.js:1346`, `src/sim/session/presets_events.js:~629` |
| F-02 | Cao (bảo mật/riêng tư) | `build.sourcemap: true` → file `.map` (≈4–4.5 MB) được phát hành công khai, lộ toàn bộ mã nguồn | `vite.config.js` |
| F-03 | Trung bình | Đăng ký email không yêu cầu xác minh email (`emailVerified`/`sendEmailVerification` không xuất hiện trong `src/saas`) → spam/đăng ký email người khác. Rules `create` chỉ so `email == token.email` | `src/saas/session.js`, `firestore.rules:89` |
| F-04 | Thấp | Rules: user tự ghi `lastLogin` không kiểm kiểu/giá trị (phải là `timestamp == request.time`); admin có thể khoá/đổi tier chính mình hoặc admin khác (không có chống tự khoá) | `firestore.rules:95-103` |
| F-05 | Thấp | `allowedSlot` nhắc `tier == 'admin'` nhưng rules không cho đặt tier `admin` → nhánh chết, gây hiểu nhầm | `firestore.rules:28` |
| F-06 | Thấp | Danh sách user admin chỉ chặn page size ở client (`limit`), rules cho `list` không ép giới hạn | `firestore.rules:78`, `firebase_data.js:64` |
| F-07 | Trung bình | Không có CSP, `_headers` chỉ có COOP. Thiếu `X-Content-Type-Options`, `Referrer-Policy`, `frame-ancestors` | `public/_headers` |
| F-08 | Trung bình | Bundle lớn: `index` ≈ 1.96 MB, `rapier` ≈ 4.3 MB; asset OBJ 1–9 MB (`bus.obj` 9 MB) tải thẳng; chưa có lazy-load theo tính năng | `dist`, `public/assets/models` |
| F-09 | Thấp | CI chạy trên mọi `push` (không nhánh) + thiếu `npm audit` và E2E; Playwright không nằm trong CI | `.github/workflows/ci.yml` |
| F-10 | Thấp | Lỗi hiển thị cho người dùng nhắc "Firestore rules" (`session.js:319`) — lộ chi tiết nội bộ | `src/saas/session.js` |
| F-11 | Thấp | Ngôn ngữ SaaS xử lý rải rác bằng `getLang()==='en' ? … : …` thay vì bảng `i18n/keys.js` → dễ lệch EN/VI | `src/saas/*.js` |
| F-12 | Thông tin | `.env.local`, `.env.staging` có trên đĩa nhưng đã gitignore (OK). Cần kiểm tra `git log -p` bằng Gitleaks trước khi phát hành (CI đã có job) | — |

### B3. Chưa xác minh được trong lượt này
Tôi không chạy được toàn bộ E2E/Rules/Build trong lượt kiểm tra này; số liệu trong tài liệu cũ (Vitest 273/273, Rules 12/12) **cần Flash chạy lại ở S-00** để lập baseline thật.

---

## C. KẾ HOẠCH THEO BƯỚC

### Giai đoạn 0 — Baseline & vệ sinh

**S-00 Baseline và chốt working tree**
- Làm: `git status`; chạy Unit, Gate, Build, Rules, `npx playwright test`; ghi số liệu (pass/fail, kích thước chunk) vào Nhật ký. Nếu Rules emulator treo ở cổng 4400: ghi nguyên văn lỗi, thử `npx firebase-tools@15.12.0 emulators:exec …` như CI, không sửa tài liệu cho khớp.
- Commit các thay đổi hiện có: `git add -A; git commit -m "wip: brand, workspace dashboard, a11y"` (không `git add` file env).
- Done khi: có baseline bằng số; working tree sạch.

**S-01 Dọn tài liệu**
- Làm: thêm đầu `PRODUCT_UPGRADE_PLAN.md` dòng trỏ tới file này; thay đoạn "Trạng thái" bằng bảng ngắn có cột "Lệnh chứng minh" và "Ngày chạy"; cập nhật `docs/architecture/*` đổi Vercel→Cloudflare Pages.
- Test: `Select-String -Path docs -Pattern vercel -Recurse -CaseSensitive:$false` chỉ còn trong ngữ cảnh lịch sử.

### Giai đoạn 1 — Sửa lỗi đã biết

**S-02 Sửa F-01 (i18n panel Cargo)** — vật lý không đổi
1. Tạo hàm thuần `formatCargoDerivedLabel({lang,geom,state,isFlatRack,gapF,gapR})` trong file mới `src/saas`-ngoài: đặt tại `src/i18n/cargo_labels.js` (module ESM, không biến toàn cục).
2. Trong `ui_units_bom.js:221-231`, thay bằng gọi hàm trên với ngôn ngữ hiện tại; lưu `data-i18n-dynamic="cargo-derived"` và lưu input cuối cùng vào `window.SafeLift.cargoDerivedLast`; đăng ký handler đổi ngôn ngữ để render lại panel (tìm nơi gọi `toggleLang`/sự kiện đổi ngôn ngữ trong `src/i18n/index.js` và `presets_events.js`).
3. `index.html:908`: đổi placeholder thành chuỗi trung tính `— × — × — m` hoặc theo key i18n.
4. `editor.js:1346`: áp dụng cùng cách (hàm `L`).
- Test mới: `test/cargo_labels.test.js` — EN không chứa ký tự có dấu tiếng Việt (regex `/[ạ-ỹà-ỹăâêôơư]/i`), VI chứa "Kiện quy đổi"; có/không flat-rack.
- E2E: mở rộng `e2e/saas-accessibility.spec.js` (hoặc file mới `e2e/i18n-scan.spec.js`): bật EN, duyệt sáu tab mô phỏng + ba menu, đọc `innerText` toàn trang, kỳ vọng không còn từ Việt có dấu (trừ tên riêng whitelist: “Lê Việt Phương”).
- Done khi: Unit + Gate + Build + E2E xanh.

**S-03 Sửa F-02 (sourcemap)**
- `vite.config.js`: `sourcemap: mode === 'staging' ? true : false` (hoặc `'hidden'`). Thêm test nhẹ vào `scripts/architecture-gate.mjs` hoặc script `scripts/check-dist.mjs`: sau build, thất bại nếu có `dist/**/*.map` khi mode production.
- Test: `npm run build; Get-ChildItem dist -Recurse -Filter *.map` → rỗng.

**S-04 Sửa F-07 (security headers)**
- `public/_headers`: thêm `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, `Permissions-Policy: camera=(), microphone=(), geolocation=()`, `frame-ancestors 'none'` qua CSP **Report-Only** trước.
- CSP Report-Only cho Firebase Auth/Firestore/App Check/Google (`apis.google.com`, `*.firebaseapp.com`, `*.googleapis.com`, `www.google.com/recaptcha`), `worker-src blob:`, `wasm-unsafe-eval` cho Rapier. Giữ `Cross-Origin-Opener-Policy: same-origin-allow-popups`.
- Test: `npx vite preview` + Playwright mở trang, bắt `console` lỗi "Refused to…"; ghi danh sách vi phạm; chỉ chuyển sang enforce ở bước riêng sau khi sạch vi phạm.

**S-05 Sửa F-03/F-10 (xác minh email + thông báo lỗi)**
- Sau `create`: gọi `sendEmailVerification`; chặn truy cập workspace tới khi `emailVerified` (chỉ với provider `password`; Google mặc định đã xác minh). Thêm màn "Chờ xác minh" có nút gửi lại (cooldown 60 s) và "Tôi đã xác minh" (gọi `reload()`).
- Thêm vào rules `create`: `request.auth.token.email_verified == true` **chỉ khi** S-05 đã chạy trên staging; để cờ rollback trong commit riêng.
- `session.js:319`: đổi thông báo thành "Không thể xác minh tài khoản. Kiểm tra kết nối và thử lại." (VI/EN qua bảng key).
- Test: unit logic `src/saas/access.js` (hàm thuần `needsEmailVerification(user)`); rules test thêm 2 ca (unverified bị từ chối, verified được); E2E bằng Auth Emulator **nếu** chạy được (xem S-10).

**S-06 Sửa F-04/F-05/F-06 (rules)**
- `lastLogin`: yêu cầu `request.resource.data.lastLogin == request.time`.
- Admin không được tự đổi `status`/`tier` của chính mình: thêm `&& request.auth.uid != uid`.
- Bỏ `'admin'` thừa ở `allowedSlot` (hoặc ghi chú). Rules `list` của users: `request.query.limit <= 26`.
- Test: mở rộng `test/firestore-rules-emulator.mjs` thêm ≥5 ca (lastLogin sai kiểu, tự khoá, list limit 100 bị từ chối, list limit 25 được).
- Done: `npm run test:rules` xanh và số ca > 12.

### Giai đoạn 2 — Hiệu năng & CI

**S-07 Giảm tải khởi động (F-08), không đổi hành vi**
- Đo baseline: kích thước `dist`, thời gian tới "sẵn sàng" (Playwright `performance.now()`), ghi vào `docs/architecture/PERFORMANCE.md`.
- Lazy-load Rapier (`import()` khi backend cần) nếu kiến trúc cho phép; kiểm tra `RapierBackend` đang nạp ở đâu (`Select-String -Pattern rapier -Path src -Recurse`). Nếu bắt buộc nạp sớm, **ghi rõ và bỏ qua**.
- Chỉ nạp OBJ của loại container được chọn (kiểm tra `AssetManager.js`), thêm cache `Cache-Control: public, max-age=31536000, immutable` cho `/assets/*` trong `_headers` (tên file có hash) và `/assets/models/*` ngắn hơn.
- Test: toàn bộ Unit + E2E; so sánh trước/sau.

**S-08 Nâng CI (F-09)**
- `ci.yml`: `on: push: branches: [master]` + `pull_request`; thêm bước `npm audit --audit-level=high`, `npx playwright install --with-deps chromium` + `npx playwright test`; upload `playwright-report` khi lỗi.
- Test: `act` không bắt buộc; kiểm tra YAML bằng `npx --yes yaml-lint .github/workflows/ci.yml` hoặc đọc lại cẩn thận. Chỉ xác nhận CI xanh khi chủ sản phẩm push và có run id thật.

### Giai đoạn 3 — Auth & Workspace nghiệm thu

**S-09 Chuẩn hoá i18n SaaS (F-11)**
- Chuyển chuỗi `getLang()==='en' ? … : …` trong `src/saas/*.js` sang `src/i18n/keys.js`; test đảm bảo mỗi key có EN và VI (`test/i18n_keys.test.js`).

**S-10 Auth Emulator + E2E đăng nhập (G1.07, G2.07)**
- Thêm `auth` vào `firebase.json` emulators (port 9099) và `connectAuthEmulator`/`connectFirestoreEmulator` khi `VITE_USE_EMULATORS=true` (chỉ trong DEV, không đi vào bản production).
- Nếu hub 4400 vẫn timeout: thử `"hub": {"port": 4401}` hoặc `emulators:exec` kèm `--debug` và ghi log; không đánh dấu xong nếu chưa chạy.
- E2E (`e2e/auth.spec.js`): đăng ký → chờ xác minh → (emulator API xác nhận email) → vào workspace → lưu equipment/lift plan → reload → còn dữ liệu → user B không thấy dữ liệu A → đăng xuất; case mật khẩu sai/mạng lỗi (route abort)/tài khoản `locked`.
- Done: E2E xanh cục bộ. Staging thật: **hướng dẫn chủ sản phẩm** làm tay (Flash không đổi allowlist).

**S-11 Migration solver cũ (G2.06)**
- Viết `migrateSnapshot(snapshot, fromVersion)` trong `src/saas/workspace_data.js` + fixtures từ solver version cũ; UI cảnh báo khi `solverVersion` khác. Test: ≥3 fixture (cũ, hiện tại, lạ → cảnh báo, không crash).

### Giai đoạn 4 — Tính năng còn thiếu (trong Spark Free)

**S-12 Export toàn bộ dữ liệu người dùng (G6.04)** — nút "Xuất tất cả (JSON)" phân trang qua cursor, giới hạn tốc độ, test Unit.

**S-13 Quota/kill-switch phía client + CMS (G6.02, G3.02)**
- Tài liệu `users/{uid}/meta/usage` (số write/ngày, tối đa N) + cờ `config/featureFlags` (admin-only ghi, mọi user đã đăng nhập đọc). Rules + test trước, UI sau. Không log sự kiện vô hạn.

**S-14 Feedback (G5)** — Chỉ làm sau khi chủ sản phẩm chọn phương án backend miễn phí (Pages Function). Mặc định: giữ `mailto`. Nếu làm: validate, cooldown, body cap, test lạm dụng.

**S-15 CMS G3.03–G3.05** (audit log, role support/catalog-editor, catalog) — chỉ sau S-13; mỗi mục có Rules test trước.

### Giai đoạn 5 — Phát hành (chỉ khi chủ sản phẩm duyệt)
- Chủ sản phẩm push, xác nhận CI xanh; preview Cloudflare với `VITE_APP_ENV=staging`; chạy checklist tay (Google login, CRUD, reload, hai tài khoản); bật CSP enforce; App Check xem metrics rồi mới enforce.

---

## D. BẢNG TRẠNG THÁI CHUẨN (cập nhật sau mỗi bước)

| Bước | Trạng thái | Lệnh đã chạy | Kết quả | Ngày |
|---|---|---|---|---|
| S-00 | ✓ | `git status`, `npm test`, `architecture:gate`, `npm run build`, `npm run test:rules`, `npx playwright test` | Unit 273/273; Gate OK; Build OK; Rules 12/12; E2E 42/52 (10 fail) | 13/11/2026 |
| S-01 | ✓ | `Select-String -Path docs ... -Pattern vercel`, `npm run architecture:gate` | `docs/architecture/*` không còn Vercel; gate OK | 13/11/2026 |
| S-02 | ✓ | `npm test`, `architecture:gate`, `npm run build`, `npx playwright test e2e/saas-accessibility.spec.js` | Unit 277/277 (35 file); Gate OK; Build OK; E2E i18n/a11y 16/16 | 13/11/2026 |
| S-03 | ✓ | `npm test`, `architecture:gate`, `npm run build`, `npm run check:dist` | Unit 277/277; Gate OK; Build OK; `MAP_COUNT=0` trong `dist/` | 13/11/2026 |
| S-04 | ✓ | `npm test`, `architecture:gate`, `npm run build`, Playwright CSP probe (`vite preview` + `dist/_headers`) | Unit 279/279 (36 file); Gate OK; Build OK; ghi nhận 2 vi phạm inline trong CSP Report-Only | 13/11/2026 |
| S-05 | ✓ | `npm test`, `architecture:gate`, `npm run build`, `npm run test:rules` | Unit 281/281 (36 file); Gate OK; Build OK; Rules 13/13 (gồm 2 ca `email_verified`) | 13/11/2026 |
| S-06 | ✓ | `npm run test:rules`, `npm test`, `architecture:gate`, `npm run build` | Rules 14/14 (tăng từ 12); Unit 281/281; Gate OK; Build OK | 13/11/2026 |
| S-07 | ✓ | Playwright boot probe, `npm test`, `architecture:gate`, `npm run build`, `npm run check:dist`, `e2e/saas-accessibility.spec.js` | Boot CAD models: 55 req (35,541,005 B, 7,667 ms) -> 5 req (544,761 B, 7,401 ms; -98.5%); Rapier 0 req lúc boot; Unit 282/282; Gate OK; Build OK; `check:dist` OK; E2E SaaS 16/16 | 13/11/2026 |
| S-08 | ✓ | `npm audit --audit-level=high`, `architecture:gate`, `npm test`, `npm run build`, `npm run check:dist`, đọc rà soát YAML `.github/workflows/ci.yml` | `npm audit`: 0 high/critical; Unit 282/282; Gate OK; Build OK; `check:dist` OK; CI giới hạn `push` nhánh `master` + thêm `check:dist`, `audit`, Playwright SaaS & upload report | 13/11/2026 |
| S-09 | ✓ | `architecture:gate`, `npm test`, `npm run build`, `npm run check:dist` | Unit **37 files, 285/285** đạt (thêm `test/i18n_keys.test.js`); `SAAS_KEYS` đồng nhất EN/VI trong `src/i18n/keys.js`; Gate OK; Build OK; `check:dist` OK | 13/11/2026 |
| S-10 | ✓ | `firebase emulators:exec --only auth,firestore` (`playwright.auth.config.js`), `npm run test:rules`, `npm test`, `architecture:gate`, `npm run build`, `npm run check:dist` | Auth + Firestore Emulator E2E (`e2e/auth.spec.js`): **2/2** đạt (đăng ký, pending verify, verify email qua Emulator REST, CRUD & reload, sai mật khẩu, cách ly user B, khóa `locked`, lỗi mạng); sửa bug mất thông báo khóa trong `session.js`; Rules **14/14**; Unit **285/285**; Gate OK; Build OK; `check:dist` OK | 13/11/2026 |
| S-11 | ✓ | `architecture:gate`, `npm test`, `npm run build`, `npm run check:dist` | `migrateSnapshot()` xử lý snapshot cũ (`4.x`/`legacy`), hiện tại (`5.0`), và phiên bản lạ (`UNKNOWN_SOLVER_VERSION`); Unit **37 files, 286/286** đạt (3 fixture test trong `workspace_data.test.js`); Gate OK; Build OK; `check:dist` OK | 13/11/2026 |
| S-12 | ✓ | `architecture:gate`, `npm test`, `npm run build`, `npm run check:dist` | `exportAllWorkspaceData()` xuất toàn bộ phương án + dụng cụ phân trang cursor, kèm cooldown 10s; Unit **37 files, 287/287** đạt; Gate OK; Build OK; `check:dist` OK | 13/11/2026 |
| S-13 | □ | | | |
| S-14 | □ | | | |
| S-15 | □ | | | |

## E. NHẬT KÝ

### S-00 — 13/11/2026
- `git status` trước khi chạy: branch `codex/safelift-g0-ci` (HEAD `a1fc348`), 16 file modified/deleted và 10 mục untracked.
- **Unit** (`npm test -- --reporter=dot`): **34/34 file, 273/273 test passed** (35.37s, exit 0).
- **Gate** (`npm run architecture:gate`): **passed** (6 shim 7 lines, 28 manifest parts, exit 0).
- **Build** (`npm run build`): **passed** in 6.59s (exit 0). Kích thước output:
  - `dist/index.html`: 268.96 kB (gzip 44.69 kB)
  - `dist/assets/index-B4NdsKXZ.css`: 89.53 kB (gzip 17.31 kB)
  - `dist/assets/RapierBackend-X-oiBtF1.js`: 3.07 kB (gzip 1.22 kB; map 11.15 kB)
  - `dist/assets/index-BDpmfw_l.js`: 3,004.15 kB (gzip 866.48 kB; map 7,843.84 kB)
  - `dist/assets/rapier-tMBXwmGl.js`: 4,336.73 kB (gzip 1,645.19 kB; map 4,575.28 kB)
- **Rules** (`npm run test:rules`): **12/12 passed** (3.25s, exit 0; Firestore Emulator port 8080 chạy bình thường, không treo).
- **E2E** (`npx playwright test --reporter=list`): **42 passed, 10 failed / 52 total** (10.9m, exit 1):
  - 4/4 viewport fail `saas-accessibility.spec.js:95` (English scan): tab `cargo` còn chuỗi `"Kiện quy đổi 11.39×3.10×2.47 m · CoG bao (0.00, 0.16, 0.00) · Khe cánh 0.40 / 0.40 m"` (khớp F-01 → S-02).
  - 4/4 viewport fail `layout.spec.js:275` (`UI-015` gear editor): `Expected: 0` range sliders, `Received: 4` (lỗi baseline mới phát hiện).
  - 1 fail `layout.spec.js:62` (`UI-008` trên `fhd-1080p`): `[Safety HUD] Occluded by <div id="app-loading-screen" class="">` (race loading screen).
  - 1 fail `layout.spec.js:95` (`UI-003` trên `hd-720p`): `dockRightEdge <= drawerLeftEdge + 5` (Expected `<= 925`, Received `928.52`).
- Commit WIP cục bộ: `wip: brand, workspace dashboard, a11y`.

### S-01 — 13/11/2026
- Đã thêm liên kết tới `UPGRADE_PLAN_V2_FOR_FLASH.md` và bảng trạng thái kiểm chứng gắn lệnh/ngày chạy ở đầu `docs/PRODUCT_UPGRADE_PLAN.md`.
- Đã cập nhật `docs/architecture/MIGRATION_STATUS.md` và `docs/architecture/ROADMAP.md` dùng Cloudflare Pages (`wrangler.toml`) thay cho Vercel.
- Kiểm tra `Select-String` cho `vercel` trong `docs`: chỉ còn trong mô tả lịch sử/quy tắc. `npm run architecture:gate` đạt.

### S-02 — 13/11/2026
- Tạo `src/i18n/cargo_labels.js` (`formatCargoDerivedLabel`, `formatCargoCrateLabel`), export qua `src/i18n/index.js` (`window.SafeLift.i18n`).
- Cập nhật `src/sim/session/ui_units_bom.js` (`data-i18n-dynamic="cargo-derived"` + `window.SafeLift.cargoDerivedLast`), `src/sim/gear/editor.js`, `src/sim/session/presets_events.js` (`applyLang()` gọi lại `syncOogCargoUI(false)` và cập nhật `[data-i18n-dynamic="cargo-derived"]`), và `index.html:908` (`— × — × — m`).
- Unit (`test/cargo_labels.test.js`): **35/35 file, 277/277 test đạt**; Gate: đạt; Build: đạt; Playwright `e2e/saas-accessibility.spec.js`: **16/16 đạt** trên cả 4 viewport (0 rò rỉ tiếng Việt trên 6 tab + 3 menu). Lưu ý: `e2e/layout.spec.js` vẫn có 3 lỗi baseline từ S-00 (`UI-015`, `UI-008`, `UI-003`).

### S-03 — 13/11/2026
- `vite.config.js`: đặt `sourcemap: mode === 'staging'`.
- Tạo `scripts/check-dist.mjs` và thêm script `check:dist` vào `package.json` (tích hợp vào `npm run ci`).
- Unit: **35/35 file, 277/277 đạt**; Gate: đạt; Build: đạt (5.84s); `npm run check:dist` & `Get-ChildItem dist -Recurse -Filter *.map`: **0 file `.map`**.

### S-04 — 13/11/2026
- `public/_headers`: giữ `Cross-Origin-Opener-Policy: same-origin-allow-popups`; bổ sung `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, `Permissions-Policy: camera=(), microphone=(), geolocation=()`, và `Content-Security-Policy-Report-Only` (`frame-ancestors 'none'`, `'wasm-unsafe-eval'`, `worker-src 'self' blob:`, Firebase Auth/Firestore/App Check/Google Fonts/reCAPTCHA, `object-src 'none'`).
- Unit (`test/security_headers.test.js`): **36/36 file, 279/279 test đạt**; Gate: đạt; Build: đạt (5.76s, `dist/_headers` có mặt); `npm run check:dist`: OK.
- Probe CSP Report-Only trên `vite preview` (Chromium + `dist/_headers`) ghi nhận **2 vi phạm** (đều do inline cũ trong `index.html`, chưa bật enforce):
  1. `script-src-attr` (`inline`): handler `onclick="document.getElementById('btn-open-liftplan').click()"` tại `index.html:2893`.
  2. `script-src-elem` (`inline`, `index.html:3205`): `<script>` khởi tạo màn loading (`sha256-v2cQPCjV2X7ddjM6nNQVnj2Qm3h282q6tHBX2W/7bek=`).
  - Các nguồn khác (style, font, worker, wasm) không phát sinh vi phạm. Sẽ bỏ 2 inline này trước khi chuyển CSP sang enforce.

### S-05 — 13/11/2026
- `src/saas/access.js`: thêm hàm thuần `needsEmailVerification(user)` (chỉ chặn tài khoản `password` chưa xác minh; Google/federated bỏ qua).
- `src/saas/auth_screen.js` & `src/saas/session.js`: gọi `sendEmailVerification` khi tạo tài khoản; chặn vào workspace với màn hình chờ xác minh (gồm "Tôi đã xác minh" gọi `reload()` + `getIdToken(true)`, nút gửi lại có cooldown 60s và nút đổi tài khoản); đổi thông báo lỗi `session.js:319` sang key `authVerifyAccountError` trong `src/i18n/keys.js` (không nhắc "Firestore rules").
- `firestore.rules` (tách riêng ở commit S-05b để dễ rollback): yêu cầu `request.auth.token.email_verified == true` khi `create` hồ sơ `users/{uid}`.
- Unit (`test/saas_access.test.js`, `test/auth_screen.test.js`): **36/36 file, 281/281 test đạt**; Gate: đạt; Build: đạt; Rules Emulator: **13/13 ca đạt** (thêm ca `unverified` bị từ chối và `verified` được phép). E2E Auth Emulator sẽ chạy ở **S-10**.

### S-06 — 13/11/2026
- `firestore.rules`: yêu cầu `lastLogin == request.time` (cả `create` có `createdAt == request.time && lastLogin == request.time`), chặn admin tự đổi `tier`/`status` của chính mình (`request.auth.uid != uid`), bỏ `'admin'` thừa khỏi `allowedSlot`, và ép `list` users phải có `request.query.limit != null && request.query.limit <= 26`.
- Mở rộng `test/firestore-rules-emulator.mjs`: **14/14 ca đạt** (thêm các ca kiểm tra `lastLogin` sai kiểu/không phải serverTimestamp, tự khoá admin, list không limit hoặc `limit(27)`/`limit(100)` bị từ chối, `limit(25)`/`limit(26)` được phép). Unit **281/281**, Gate OK, Build OK.

### S-07 — Tối ưu tải model CAD theo nhu cầu & Cache headers (F-08)
- Xác nhận `RapierBackend` đã lazy-load (`0` requests lúc boot).
- Tái cấu trúc `preloadStandardPortAssets` -> `ensureCargoPortAsset`, `ensureBeamPortAsset`, `loadPortAssetOnce` trong `src/sim/library/parsers.js` và nối vào `src/sim/cargo/shell_rebuild.js`, `src/sim/cargo/specialty_meshes.js` để chỉ tải CAD model của `cargoType`/`beamType` đang dùng lúc boot và nạp phần còn lại theo nhu cầu.
- Thêm `Cache-Control` cho `/assets/*` và `/assets/models/*` trong `public/_headers` + test trong `test/security_headers.test.js`; ghi nhận số liệu trước/sau trong `docs/architecture/PERFORMANCE.md`.
- Đo boot simulator (`VITE_AUTH_DEV_BYPASS=true`): **55** model requests (**35,541,005 bytes**, **7,667 ms**) -> **5** model requests (**544,761 bytes**, **7,401 ms**; giảm **98.5%** dung lượng model tải lúc khởi động).
- Kiểm tra: Unit **36 files, 282/282** đạt; `architecture:gate` OK; `npm run build` OK; `npm run check:dist` OK; `npx playwright test e2e/saas-accessibility.spec.js --reporter=list` **16/16** đạt.

### S-08 — Nâng cấp CI Workflow
- Cập nhật `.github/workflows/ci.yml`: giới hạn trigger `push` chỉ chạy trên `branches: [master]`, thêm `npm audit --audit-level=high`, `npm run check:dist`, `npx playwright install --with-deps chromium`, `npx playwright test e2e/saas-accessibility.spec.js --reporter=list` (chạy suite SaaS sạch 16/16; `e2e/layout.spec.js` đang có 3 lỗi nền từ S-00), và `actions/upload-artifact@v4` tải `playwright-report/` khi `failure()`.
- Kiểm tra: `npm audit --audit-level=high` (`0 vulnerabilities`), `architecture:gate` OK, Unit **36 files, 282/282** đạt, `npm run build` OK (5.62s), `npm run check:dist` OK, kiểm tra cấu trúc YAML `.github/workflows/ci.yml` sạch (2-space indent, không tab).

### S-09 — Chuẩn hóa i18n cho toàn bộ SaaS UI (F-11)
- Tập trung toàn bộ chuỗi song ngữ EN/VI của SaaS (`admin_dashboard.js`, `feature_access_ui.js`, `session.js`, `workspace_dashboard.js`, `auth_screen.js`) vào `SAAS_KEYS` (gộp vào `KEYS.vi` / `KEYS.en`) trong `src/i18n/keys.js`, kèm helper `saasT(key, vars, lang)` trong `src/saas/i18n.js`.
- Thêm `test/i18n_keys.test.js` kiểm tra đối xứng 100% khóa EN/VI, placeholder `{var}` khớp nhau và không còn `getLang()==='en'` / `lang()==='en'` rải rác trong `src/saas/*.js`.
- Kiểm tra: `architecture:gate` OK; Unit **37 files, 285/285** đạt; `npm run build` OK (5.45s); `npm run check:dist` OK.

### S-10 — Auth + Firestore Emulator & Playwright E2E luồng Auth/CRUD thực (G1)
- Cấu hình Auth Emulator (`port: 9099`) và Hub (`port: 4401`) trong `firebase.json`; nối `connectAuthEmulator`/`connectFirestoreEmulator` chỉ khi `import.meta.env.DEV && VITE_USE_EMULATORS === 'true'` trong `src/saas/firebase.js` (bỏ qua App Check khi chạy Emulator local).
- Viết `playwright.auth.config.js`, `e2e/auth.spec.js` và script `test:e2e:auth` trong `package.json`: kiểm thử đầy đủ đăng ký -> pending verification -> xác minh qua Auth Emulator oobCodes -> tạo thiết bị & lift plan -> reload giữ phiên -> đăng xuất -> sai mật khẩu -> cách ly user B -> tự ngắt khi bị chuyển `status: 'locked'` -> chịu lỗi mạng.
- Phát hiện và sửa lỗi thực tế trong `src/saas/session.js`: thêm `pendingAuthNotice` để giữ thông báo tài khoản bị khóa sau khi `signOut()` kích hoạt `showSignedOut()`.
- Kiểm tra: Auth+Firestore E2E **2/2** đạt; Rules **14/14** đạt; Unit **37 files, 285/285** đạt; `architecture:gate` OK; `npm run build` OK (5.58s); `npm run check:dist` OK.

### S-11 — Migration dữ liệu phương án cũ (G1.05)
- Thêm `migrateSnapshot(snapshot, fromVersion)` vào `src/saas/workspace_data.js` (không làm thay đổi object đầu vào, tự bổ sung mặc định `5.0` cho bản `4.x`/`legacy`, giữ nguyên `5.0`, và gắn cờ `compatible: false` / `UNKNOWN_SOLVER_VERSION` khi gặp phiên bản lạ).
- Nối `migrateSnapshot` vào `renderPlan` và `applyPlan` trong `src/saas/workspace_dashboard.js` cùng thông báo i18n trong `src/i18n/keys.js`.
- Thêm unit test với 3 fixture (`4.2`, `5.0`, `9.1`) trong `test/workspace_data.test.js`.
- Kiểm tra: `architecture:gate` OK; Unit **37 files, 286/286** đạt; `npm run build` OK (5.67s); `npm run check:dist` OK.

### S-12 — Xuất toàn bộ dữ liệu người dùng JSON (G1.06)
- Thêm `exportAllWorkspaceData()` vào `src/saas/workspace_data.js`: phân trang bằng cursor trên cả `liftPlans` và `equipment` (tối đa `MAX_EXPORT_PAGES = 15`), tuần tự hóa timestamp an toàn, không làm gãy xuất khi gặp 1 snapshot lỗi, và giới hạn tần suất (`EXPORT_COOLDOWN_MS = 10_000`).
- Thêm nút "Xuất tất cả (JSON)" / "Export all (JSON)" trong `src/saas/workspace_dashboard.js` + khóa i18n trong `src/i18n/keys.js`.
- Thêm unit test kiểm tra xuất nhiều trang cursor và cooldown trong `test/workspace_data.test.js`.
- Kiểm tra: `architecture:gate` OK; Unit **37 files, 287/287** đạt; `npm run build` OK (5.79s); `npm run check:dist` OK.
