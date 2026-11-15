# SafeLift3D — Kế hoạch nâng cấp sản phẩm toàn diện

> **Kế hoạch thực thi chi tiết (S-00 → S-15):** xem tại [UPGRADE_PLAN_V2_FOR_FLASH.md](./UPGRADE_PLAN_V2_FOR_FLASH.md). Tài liệu này giữ vai trò tầm nhìn sản phẩm và kiến trúc tổng thể.

**Mục tiêu:** đưa SafeLift3D từ một trình mô phỏng nâng hạ có đăng nhập thành nền tảng chuyên nghiệp cho người dùng, khách hàng và đội ngũ quản trị. Hai ảnh người dùng gửi là nguồn artwork chuẩn cho logo SafeLift3D và nền bãi container. Tên, email và số điện thoại nhà phát triển được người dùng xác nhận để hiển thị công khai.

### Bảng trạng thái kiểm chứng gần nhất

| Hạng mục | Trạng thái | Lệnh chứng minh | Ngày chạy |
|---|---|---|---|
| Unit & regression suite | ✓ 40/40 file, 295/295 test đạt | `npm test -- --reporter=dot` | 13/11/2026 |
| Architecture gate | ✓ Đạt (6 shim, 28 phần manifest) | `npm run architecture:gate` | 13/11/2026 |
| Production build & `.map` check | ✓ Đạt (`vite build` + không có `.map` trong `dist/`) | `npm run build && npm run check:dist` | 13/11/2026 |
| Security dependency audit | ✓ 0 lỗ hổng mức high+ | `npm audit --audit-level=high` | 13/11/2026 |
| Firestore Rules Emulator | ✓ 16/16 ca đạt | `npm run test:rules` | 13/11/2026 |
| Auth + Firestore Emulator E2E | ✓ 2/2 kịch bản đạt | `npm run test:e2e:auth` | 13/11/2026 |
| Playwright SaaS & Accessibility E2E | ✓ 16/16 ca đạt (4 viewport) | `npx playwright test e2e/saas-accessibility.spec.js --reporter=list` | 13/11/2026 |
| Playwright Layout E2E (ngoài phạm vi SaaS) | ◐ UI-015 đã đạt 4/4 sau khi sửa test (Gear Editor bắt buộc 4 slider); còn 5 lỗi hoãn (`UI-008` ×4 viewport, `UI-003` tại `hd-720p`) đến khi cấu hình Firebase xong | `npx playwright test e2e/layout.spec.js -g "UI-015" --reporter=list` | 13/11/2026 |
| S-00 → S-15 implementation | ✓ Hoàn tất toàn bộ 16 bước trên nhánh local `codex/safelift-g0-ci` | Xem `docs/UPGRADE_PLAN_V2_FOR_FLASH.md` | 13/11/2026 |
| Giai đoạn 5 (Deploy Staging / Production / CI remote) | □ Chờ người dùng push remote, cấu hình Authorized domains & deploy | — | — |

**Phạm vi cố định:** lỗi vật lý được hoãn theo chỉ đạo người dùng; Spark Free là yêu cầu (chỉ text/JSON nhẹ, không ảnh/mô hình, không gắn thẻ/Blaze); G4 (billing) hoãn hoàn toàn.

## 0. Checklist thực thi theo thứ tự

Ký hiệu: **✓** hoàn tất và có bằng chứng; **◐** đã có một phần, còn cổng nghiệm thu; **□** chưa làm. Không đánh dấu xong chỉ vì có giao diện hoặc cấu hình mẫu.

### G0 — Nền tảng, bảo mật và chi phí

- [✓] **G0.01** Cloudflare Pages và tên miền `safelift3d.com` đã được thiết lập trước đó; cấu hình build nằm trong `wrangler.toml`.
- [◐] **G0.02** CI trước đó đã xanh cho commit `3f90a66` (run `43425550695`), gồm architecture gate, tests, Rules Emulator, build và Gitleaks. Working tree hiện tại chưa được CI xác nhận; không coi kết quả cũ là nghiệm thu cho thay đổi mới.
- [◐] **G0.03** Firebase staging `safelift3d-staging` có Web app, Firestore, Rules và Email/Password + Google Auth. Cloudflare Preview build variables hiện đặt `VITE_APP_ENV=staging` cùng config dự án staging. Domain `codex-safelift-g0-ci.safelift3d.pages.dev` có trong Authorized domains staging theo kiểm tra Console và đã được người dùng đồng ý thêm. Preview vẫn báo domain không được phép; nguyên nhân runtime còn chưa được xác định. Không thêm domain vào allowlist production. Release gate Production còn chờ.
- [◐] **G0.04** Gitleaks đã quét lịch sử Git; các lần rà trước không phát hiện private key/payment/webhook secret theo mẫu đã kiểm tra. `npm audit` gần nhất không có lỗ hổng. Giữ Firebase trên Spark Free, không yêu cầu thẻ/billing và không tự nâng Blaze. Kiểm tra lại CI/audit trước mỗi lần phát hành.
- [◐] **G0.05** Firebase Auth providers và Rules đã phát hành trên staging; production Rules đã phát hành. Delete protection bật trên production và staging. Staging App Check key riêng đã đăng ký ở Preview, nhưng metrics/enforcement chưa nghiệm thu. Không triển khai backup tự động/PITR/restore Firebase phụ thuộc Blaze; dùng export JSON phía người dùng như tính năng portability, không quảng bá thay thế backup. MFA không nhất thiết cần liên kết billing: Identity Platform hỗ trợ TOTP không cần SMS, nhưng Firebase Auth with Identity Platform trên Spark có giới hạn 3.000 DAU/ngày; chưa bật vì cần xác minh lưu lượng dự kiến và xử lý enrolment/recovery cho admin. Không bật SMS MFA mặc định.
- [✓] **G0.06** Threat model và danh sách kiểm soát còn thiếu đã được ghi tại `docs/SECURITY_THREAT_MODEL.md`; phân biệt biện pháp hiện có với hạng mục chưa triển khai.
- [◐] **G0.07** Firestore Rules Emulator đã chạy trên CI. Mọi tính năng mới phải có quota và kiểm thử abuse trước khi phát hành. Cloud Functions yêu cầu Blaze để deploy; không dùng cho sản phẩm hiện tại. Feedback/backend chỉ được chọn sau khi chứng minh chạy được trong Spark Free hoặc Cloudflare free limits.
- [◐] **G0.08** Không làm dashboard hóa đơn/billing alerts khi dùng Spark. Cần hoàn thiện theo dõi miễn phí các quota Firestore/Auth, số document/payload theo user, lỗi và abuse; khi gần hạn mức sẽ giới hạn hoặc tạm dừng ghi không thiết yếu, thay vì nâng cấp tự động.
- [◐] **G0.09** Đã triển khai 3 role CMS tách biệt (`admin`, `support`, `catalog-editor`) cùng `adminAuditLogs` append-only ghi nguyên tử với `reason` bắt buộc và diff `before`/`after` (verified 20/20 ca Firestore Rules Emulator và `e2e/cms-roles.spec.js`). Chưa triển khai role billing và chưa bật TOTP MFA cho tài khoản quản trị trên Spark/Identity Platform.

### G1 — Nhận diện, đăng nhập và loading

- [✓] **G1.01** Tích hợp artwork logo và nền container do người dùng cung cấp; attribution nhà phát triển được hiển thị.
- [✓] **G1.02** Đồng bộ logo/favicon/app icon và bộ SVG chức năng trong `public/safelift3d-icons/`.
- [◐] **G1.03** Login email/Google/reset và VI/EN đã có; lỗi đăng nhập không còn để nút mắc ở trạng thái “đang chờ”. Quét English trên giao diện ban đầu đạt, nhưng quét mở rộng sáu tab đã bắt được chuỗi Việt động ở OOG Cargo (`Kiện quy đổi … · CoG bao … · Khe cánh …`); chưa sửa. Google login staging chưa nghiệm thu lại sau lỗi `auth/unauthorized-domain`.
- [✓] **G1.04** Mục liên hệ nhà phát triển mở email soạn sẵn; đây chưa phải feedback ticket.
- [◐] **G1.05** Màn hình loading (`public/loading-screen-init.js` tách sang `'self'` để sẵn sàng CSP) hiển thị tiến trình/ngôn ngữ; phần timeout/retry gắn với từng pha tải asset nâng cao tiếp tục hoàn thiện nếu mở rộng pipeline.
- [◐] **G1.06** E2E local đã xác nhận focus trap/restore, reduced motion và English locale (`e2e/saas-accessibility.spec.js` 16/16); còn mobile, screen reader đầy đủ, contrast và fallback lỗi tải.
- [◐] **G1.07** Đã có E2E Auth + Firestore Emulator (`npm run test:e2e:auth`: `e2e/auth.spec.js` + `e2e/cms-roles.spec.js`, 5/5 ca đạt cho đăng ký/xác minh email, CRUD reload, khóa tài khoản, lỗi mạng, kill-switch bảo trì, catalog và phân quyền CMS). Còn kiểm thử Google login popup và domain Cloudflare Preview staging thật do chủ sản phẩm thực hiện.

### G2 — Kho dụng cụ và lift plan

- [✓] **G2.01** Kho dụng cụ theo tài khoản: thêm/sửa/xóa thông số nhẹ, không upload mô hình 3D lên Firestore.
- [✓] **G2.02** Lift plan: lưu/mở/sao chép/archive/xóa/xuất JSON, liên kết dụng cụ và lưu snapshot có phiên bản solver.
- [✓] **G2.03** Cursor pagination, giới hạn payload và quota slot Free/Premium đã có.
- [✓] **G2.04** Firestore Rules production đã phát hành.
- [✓] **G2.05** Firestore Rules Emulator đạt 20/20; đã kiểm chặn cross-account get/update/delete, locked user, giới hạn slot và payload/schema, profile tự nâng quyền, quyền admin/support/catalog-editor, audit log bất biến có `reason` bắt buộc + diff `before`/`after` ≤400 ký tự, cùng phân trang danh sách user/audit/catalog.
- [◐] **G2.06** Luồng UI nhập rig cũ đã qua E2E và `migrateSnapshot` hỗ trợ di trú phiên bản solver (`workspace_data.test.js`); còn nghiệm thu trên dữ liệu Firestore staging thật.
- [□] **G2.07** E2E trên staging/production: đăng nhập, CRUD, tải lại trang, giới hạn quota và không rò dữ liệu giữa user.

### G3 — CMS quản trị

- [◐] **G3.01** CMS có danh sách user, đổi tier/status (kèm lý do bắt buộc & xác nhận khóa/ban), cursor pagination, tìm email theo tiền tố và giới hạn 25–26 hồ sơ/trang. Unit suite, Rules Emulator (20/20) và Emulator E2E (`e2e/cms-roles.spec.js`) đều đạt; chờ push lấy kết quả CI và nghiệm thu staging thật.
- [◐] **G3.02** Có telemetry usage/quota phía client (`src/saas/telemetry_usage.js`), bộ đếm lỗi cục bộ và nhãn ước lượng ghi ngày trong Workspace; không hiển thị doanh thu khi chưa thu tiền và chưa có feedback inbox phía server.
- [◐] **G3.03** Có lọc/tìm user theo tiền tố email, đổi tier/trạng thái với lý do bắt buộc + log diff và giao diện chỉ-đọc cho `support`; chưa triển khai quyền tạm thời có thời hạn (time-boxed grants).
- [✓] **G3.04** Quản lý catalog dụng cụ (`admin_dashboard.js` + `cms_data.js` + `catalog_client.js` picker phía người dùng) và runtime kill-switch `config/featureFlags` (`src/saas/runtime_flags.js`: `maintenanceMode`, `disabledModules`, `freePlanLimit`); verified qua unit tests, Rules Emulator (20/20) và Emulator E2E (5/5).
- [◐] **G3.05** Đã có `adminAuditLogs` ghi nguyên tử qua `writeBatch` (`commitWithAudit`), giữ append-only với lý do bắt buộc và `before`/`after`, cùng phân quyền `admin`/`support`/`catalog-editor` verified trên Emulator; feedback inbox phía server chưa triển khai (giữ `mailto`). Không gộp billing/refund/đối soát vào CMS hiện tại.

### G5 — Feedback và hỗ trợ

- [✓] **G5.01** Liên hệ `mailto` (`src/saas/feedback.js`) chuẩn hóa tiêu đề/nội dung, giới hạn độ dài và verified bằng `test/feedback_mailto.test.js`; chưa ghi nhận ticket phía server (hoãn theo phương án Spark Free).
- [□] **G5.02** Form ticket có validate, Auth/App Check, rate limit/cooldown và chống gửi lặp; trước tiên chọn cách lưu/gửi không phát sinh Firebase Blaze.
- [□] **G5.03** Cloud Functions cần Blaze để deploy nên không dùng hiện tại. Chỉ triển khai backend gửi email nếu dịch vụ miễn phí khác khả dụng, có giới hạn chống spam rõ ràng và không yêu cầu Firebase billing; nếu không, giữ `mailto`.
- [□] **G5.04** CMS xử lý ticket, trạng thái, SLA, retention và xóa dữ liệu.

### G4 — Billing và tín dụng

**Trạng thái:** hoãn hoàn toàn, không phải điều kiện để hoàn thành sản phẩm hiện tại. Đây là thanh toán người dùng cho SafeLift3D, khác với billing của nhà cung cấp Firebase. Không bật Firebase Blaze, không thêm thẻ và không xây luồng thu tiền cho đến khi chủ sản phẩm chủ động thay đổi quyết định.

- [□] **G4.01** Chốt subscription/credit, đơn vị tính phí, giá và quyền lợi.
- [□] **G4.02** Chọn nhà cung cấp/merchant phù hợp Việt Nam và xác minh quy trình sandbox.
- [□] **G4.03** Backend checkout, xác minh chữ ký webhook, idempotency, ledger bất biến và entitlement server-owned.
- [□] **G4.04** CMS giao dịch, refund/chargeback, đối soát, audit và kiểm thử replay/tamper.
- [□] **G4.05** Hoàn thiện điều khoản, hóa đơn/thuế, hoàn tiền và hỗ trợ trước khi thu tiền thật.

### G6 — Vận hành và mở rộng

- [□] **G6.01** Đặt SLO/error tracking cho login, workspace và feedback; không log token/PII dư thừa.
- [✓] **G6.02** Theo dõi quota ước lượng phía client (`telemetry_usage.js`) và kill switch runtime theo tính năng (`runtime_flags.js`: `maintenanceMode`, `disabledModules`, `freePlanLimit`); không dùng dashboard hóa đơn hay tự chuyển sang Blaze.
- [□] **G6.03** Bật App Check enforcement theo từng dịch vụ sau khi kiểm metrics.
- [◐] **G6.04** Incident runbook, rollback, export JSON từng lift plan và `exportAllWorkspaceData` toàn bộ workspace có cooldown (`workspace_data.js`) đã có. Backup tự động/PITR/restore do Firebase cung cấp được hoãn (cần billing); không tuyên bố export là backup vận hành.
- [□] **G6.05** Chỉ sau các cổng trên mới mở R2 upload, collaboration, SSO hoặc analytics sâu.

  **Bước tiếp theo khi tiếp tục:** xem bảng trạng thái và danh sách việc dành cho chủ sản phẩm trong [`docs/UPGRADE_PLAN_V3_SUPPLEMENT.md`](./UPGRADE_PLAN_V3_SUPPLEMENT.md) (push nhánh chạy CI lấy run id, kiểm tra Preview Cloudflare `VITE_APP_ENV=staging`, quyết định bật CSP/App Check enforce, và mở lại 5 lỗi layout hoãn `UI-008` ×4 + `UI-003` ×1 sau khi cấu hình xong Firebase). Không bật Firebase Blaze hoặc thêm billing account.

## 1. Hiện trạng đã kiểm tra trong repository

| Khu vực | Hiện có | Khoảng trống chính |
|---|---|---|
| Đăng nhập | Firebase Auth, email/mật khẩu, Google popup, đặt lại mật khẩu; chặn workspace khi chưa xác thực | Cần hoàn thiện trải nghiệm chờ/khôi phục lỗi và đồng nhất giao diện với thương hiệu mới |
| Tài khoản và quyền | Hồ sơ người dùng Firestore; `free`/`premium`; admin có thể xem và cập nhật trạng thái/gói | Chưa có quyền theo tính năng, gói có phiên bản, hạn dùng, hạn mức, usage hoặc lịch sử thao tác |
| CMS | Một màn quản lý thành viên cơ bản tại `/admin` | Thiếu phân hệ vận hành, tìm kiếm/phân trang, gói cước, thanh toán, kho, phản hồi, nhật ký và báo cáo; danh sách hiện đọc toàn bộ hồ sơ user một lần nên cần chuyển sang phân trang cursor trước khi số tài khoản tăng |
| Dữ liệu | Có hồ sơ `users/{uid}` và hai vùng owner-scoped `equipment`/`liftPlans`; Rules giới hạn trường, kích thước, slot và vai trò | Chưa có migration dữ liệu cũ, quota theo tốc độ, ledger, feedback ticket, audit hoặc entitlement server-owned |
| Kho dụng cụ | Có kho thông số riêng theo tài khoản, thêm/sửa/xóa và liên kết dụng cụ vào lift plan; không tải mô hình 3D lên Firestore | Chưa có phiên bản/migration schema, mẫu được quản trị, tìm kiếm xuyên trang hoặc CRUD end-to-end đã nghiệm thu production |
| Màn hình tải | `src/sim/state.js` đã có tiến trình và các nhãn khởi tạo mô phỏng | Cần làm mới nhận diện, đồng bộ tiến trình với công việc thật, cải thiện thời gian chờ và khả năng truy cập |
| Feedback | Có liên kết mail liên hệ ở một số trạng thái truy cập | Chưa có luồng gửi phản hồi trong sản phẩm, chống spam, hộp thư quản trị hoặc trạng thái xử lý |
| Thanh toán | Chưa thấy luồng nạp tiền, đơn thanh toán, ledger hay quản lý bảng giá trong repository | Chưa có nhà cung cấp được chọn; cần thiết kế giao dịch có xác minh và đối soát |
| Triển khai | Có cấu hình Cloudflare Pages (`wrangler.toml`); tài liệu kiến trúc cũ còn nhắc Vercel | Cập nhật tài liệu/CI để Cloudflare Pages là đích chính theo quyết định hiện tại |

Simulator có phần lõi lớn, đang dùng chung nhiều biến toàn cục và có một lộ trình tách lớp riêng. Nên bổ sung SaaS/CMS qua các module và API có ranh giới rõ, không lấy việc viết lại toàn bộ mô phỏng làm điều kiện tiên quyết.

## 2. Nguyên tắc sản phẩm và kiến trúc

1. **Một nguồn dữ liệu có chủ sở hữu:** mọi hồ sơ, thông số, dụng cụ và lift plan của khách hàng có `ownerUid`, schema version, `createdAt`/`updatedAt`; chỉ chủ sở hữu và vai trò được phép mới đọc được.
2. **Firebase lưu dữ liệu nhẹ, có cấu trúc:** hồ sơ, tùy chọn, định nghĩa dụng cụ, thông số, phiên bản kế hoạch, sự kiện usage và metadata. Không đưa GLB/OBJ/STL, texture, video, cache mô phỏng hoặc file CAD nặng vào Firestore.
3. **Tài sản tĩnh và tài sản tải lên là hai luồng riêng:** mô hình dựng sẵn được đóng gói/đưa qua CDN của Cloudflare; nếu sau này mở upload thì lưu blob ở Cloudflare R2 với giới hạn kích thước/loại file, URL ký hạn ngắn và kiểm tra nội dung. Firestore chỉ giữ metadata và quyền truy cập.
4. **Client không quyết định quyền lợi hoặc tiền:** client chỉ hiển thị gói/quyền; server xác minh thanh toán và phát hành entitlement/ledger. Không bao giờ cho trình duyệt tự ghi role, số dư, trạng thái thanh toán hoặc quyền premium.
5. **Spark Free là mặc định:** chỉ lưu văn bản/JSON có schema và giới hạn kích thước, số lượng bản ghi, tần suất ghi và truy vấn. Không lưu ảnh, mô hình 3D hoặc tệp nhị phân trong Firebase. Không yêu cầu thẻ, không tự nâng Blaze. Nếu gần quota Spark, giới hạn hoặc tạm dừng tính năng không thiết yếu và giải thích cho người dùng; không coi quota vượt là khoản phí tự động.
6. **Mọi thao tác quản trị có dấu vết:** ai làm, lúc nào, mục tiêu nào, giá trị trước/sau và lý do; không lưu bí mật thanh toán hoặc thông tin thẻ.
7. **Thiết kế theo module:** UI → app services → domain/API; tiếp tục giữ simulator hiện tại chạy ổn và chỉ tích hợp qua các điểm kết nối ổn định.

### Sơ đồ dịch vụ đích

```text
Browser / desktop-first web app
  ├─ Cloudflare Pages: giao diện Vite, asset tĩnh, tên miền safelift3d.com
  ├─ Firebase Auth: đăng nhập và danh tính
  ├─ Firestore client: dữ liệu cá nhân nhẹ, theo Security Rules + App Check
  └─ Cloudflare Pages Functions / Worker (chỉ khi free limits đáp ứng):
       rate-limit hoặc feedback endpoint; tránh Firebase Functions nếu cần Blaze
              └─ Trusted backend chỉ cho tính năng cần quyền server-side
                   ├─ xác minh token, vai trò và schema
                   ├─ thanh toán/ledger chỉ khi G4 được chủ sản phẩm bật lại
                   └─ email/audit với quota và chống spam

3D built-in → Cloudflare static/CDN
3D user upload (nếu bật sau) → Cloudflare R2; metadata/owner/quota → Firestore
```

Chọn backend tin cậy theo năng lực vận hành hiện có trước khi triển khai giao dịch. Firebase Admin SDK bỏ qua Firestore Security Rules nên mọi backend dùng SDK này phải áp IAM chặt, xác thực đầu vào và tự kiểm tra quyền; không coi Firestore Rules là hàng rào của luồng server.

## 3. Các giai đoạn triển khai

Thời lượng dưới đây là cỡ công việc theo sprint, chưa phải cam kết ngày giao hàng. G0–G3, G5 và G6 triển khai theo ưu tiên; G4 bị hoãn và không chặn sản phẩm hiện tại.

### Giai đoạn 0 — Chốt nền tảng, bảo mật và đo chi phí

- Cập nhật tài liệu kiến trúc/triển khai: Cloudflare Pages + GitHub Actions; tách môi trường preview, staging và production; bí mật chỉ nằm trong secret store, không trong repository hay bundle.
- Kiểm kê Firestore/Auth/App Check đã bật ở Firebase Console, quyền admin thật, export/portability, domain OAuth và cấu hình DNS; không giả định có backup/restore tự động trên Spark.
- Lập threat model cho spam đăng ký, dò mật khẩu, lạm dụng API, leo quyền, sửa giá, giả webhook, spam email, đọc chéo dữ liệu và tạo tài liệu hàng loạt.
- Thiết lập project thử nghiệm/emulator cho Auth/Firestore; chỉ thêm Functions nếu có quyết định riêng về Blaze. Mọi rule mới có ma trận cho phép/từ chối trước production.
- Theo dõi miễn phí lỗi Auth/denied rules, reads/writes và giới hạn dữ liệu mỗi user bằng công cụ khả dụng; định nghĩa ngưỡng throttle/disable trước khi gần quota. Không yêu cầu billing alerts.
- Chốt quyền admin/support/catalog-editor và MFA cho tài khoản đặc quyền; không tạo role billing trong khi chưa bán gói.

**Cổng nghiệm thu:** không có secret trong git/bundle; không có rule mở toàn cục; staging tách dữ liệu production; quota theo user được kiểm thử; có quy trình throttle/rollback và export dữ liệu. Không yêu cầu backup Firebase trả phí.

### Giai đoạn 1 — Bộ nhận diện, đăng nhập và loading kỹ thuật

- Dùng chính artwork logo SafeLift3D được chủ sản phẩm cung cấp; không vẽ lại biểu tượng. Tạo các kích thước hiển thị/cắt từ ảnh gốc cho favicon, splash, đăng nhập, CMS và thanh ứng dụng.
- Dùng ảnh bãi container từ artwork tham chiếu làm nền loading/login, với zoom nhẹ, lớp phủ tương phản và fallback màu nếu ảnh không tải được. Giữ phông chữ hiện tại.
- Thiết kế lại login: rõ phân cấp, email/Google, quên mật khẩu, trạng thái khóa tài khoản, lỗi mạng, ngôn ngữ VI/EN, link hỗ trợ và quyền riêng tư. Tránh mất nội dung trên mobile hoặc khi trình duyệt chặn popup.
- Nâng loading thành chuỗi bước có thật: khởi tạo ứng dụng → xác minh phiên → nạp catalog → tạo scene → sẵn sàng. Chỉ báo bước khi tác vụ đó thực sự chạy; không giả % tiến độ. Có timeout, nút thử lại, thông báo lỗi, hỗ trợ `prefers-reduced-motion` và không khóa trang nếu tải xong nhanh.
- Đồng bộ nhận diện trên workspace, CMS, login, trang lỗi, favicon và PDF/export; hiển thị đầy đủ attribution “Lê Việt Phương (Mr)” cùng email/điện thoại đã được chủ sản phẩm xác nhận.
- Thêm mục liên hệ nhà phát triển ở menu hệ thống với biểu mẫu giới hạn độ dài, mở email soạn sẵn trên thiết bị người dùng; nếu cần lưu/gửi phản hồi hoàn toàn trong ứng dụng, triển khai endpoint có xác thực, quota và chống spam ở giai đoạn feedback.

**Cổng nghiệm thu:** nhận diện rõ ở 16×16 đến desktop; VI/EN không trộn; tương thích bàn phím/đọc màn hình; mobile; kiểm tra giảm chuyển động; tải nhanh hơn baseline đã đo; lỗi xác thực không để màn hình loading vô hạn.

### Giai đoạn 2 — Tài khoản, kho dụng cụ và kế hoạch nâng có thể tái sử dụng

- Thêm “My Equipment” theo tài khoản: loại dụng cụ, nhà sản xuất/model, WLL, kích thước, khối lượng, hệ số, chứng chỉ/expiry dạng metadata và ghi chú. Không xem nội dung do người dùng nhập là tiêu chuẩn đã được xác nhận.
- Thêm lift plan đã lưu: tên, mô tả, cargo/CoG, rigging setup, crane/site inputs, cấu hình vật lý, cảnh báo/kết quả, revision, phiên bản schema và phiên bản solver. Lưu đầu vào/kết quả dạng JSON có giới hạn; khi mở lại, migrate schema có kiểm soát.
- Chức năng tạo từ mẫu, sao chép, gắn dụng cụ vào plan, tìm kiếm, archive/xóa, xuất hồ sơ. Cảnh báo khi mở lại dữ liệu được tạo bởi phiên bản solver khác.
- Tách dữ liệu khách hàng theo `users/{uid}/equipment/{id}`, `users/{uid}/liftPlans/{id}`, `users/{uid}/preferences/{id}` hoặc collection theo chủ sở hữu phù hợp cho phân trang. Dùng cursor pagination, projection nhẹ, giới hạn payload; tránh tải toàn bộ thư viện lúc mở app.
- Built-in catalog vẫn được quản lý như dữ liệu versioned trong repository/CDN. Upload mô hình cá nhân để sau một giai đoạn riêng; mặc định chưa nhận file 3D.

**Cổng nghiệm thu:** kiểm thử rules chứng minh A không đọc/sửa/xóa được dữ liệu B; chủ sở hữu CRUD đúng; migration phiên bản có kiểm thử; quotas chặn tạo/lưu quá mức; không phát sinh tải asset 3D lên Firestore.

### Giai đoạn 3 — CMS quản trị chuyên nghiệp

1. **Tổng quan:** số tài khoản theo ngày, active/suspended, gói, sử dụng, doanh thu giao dịch đã đối soát, phản hồi chờ xử lý, lỗi dịch vụ và cảnh báo ngưỡng.
2. **Người dùng:** tìm kiếm theo email/UID, lọc trạng thái/gói/ngày; phân trang; xem lịch sử gói/usage; khóa/mở khóa, reset/quy trình hỗ trợ; cấp quyền tạm thời có lý do và hạn kết thúc.
3. **Catalog & feature flags:** quản lý mẫu dụng cụ, quota và cờ tính năng. Gói/entitlement thương mại chỉ thêm nếu G4 được mở lại.
4. **Thanh toán (G4 tùy chọn):** nếu sau này mở bán, quản lý giao dịch, webhook, đối soát/refund và audit; chưa thuộc CMS hiện tại.
5. **Feedback/support:** hộp thư phản hồi, gán trạng thái/nhân sự, chủ đề, mức độ ưu tiên, ghi chú nội bộ, trả lời qua email, thời điểm phản hồi và thống kê SLA.
6. **Kho/catalog:** quản lý dụng cụ mẫu chính thức, version, trạng thái công bố và kiểm duyệt metadata; phân biệt rõ catalog do SafeLift3D xác minh với đồ dùng tự tạo của khách hàng.
7. **Hệ thống:** cấu hình cờ tính năng, quotas, thông báo bảo trì, giới hạn upload, mẫu email, nhật ký quản trị, export báo cáo có quyền và audit.

**Kiểm soát CMS:** role-based access cho `admin`, `support`, `catalog-editor`; MFA cho tài khoản đặc quyền; xác nhận lại khi khóa user/đổi quyền hoặc cấu hình; quyền tối thiểu; phân trang; che bớt PII; log trước/sau không cho client sửa/xóa. Chỉ thêm role `billing` nếu G4 được bật lại.

### Giai đoạn 4 — Gói cước, thanh toán và nạp tín dụng

- Chốt mô hình thương mại: subscription theo chu kỳ, prepaid credit theo thao tác, hoặc kết hợp. Định nghĩa chính xác đơn vị tính phí; tránh trừ credit cho các thao tác nhẹ bất ngờ.
- Chọn cổng có hỗ trợ doanh nghiệp, tiền tệ và phương thức thu tiền tại Việt Nam sau khi xác minh pháp lý/tài khoản merchant/API. Checkout do nhà cung cấp lưu thẻ; ứng dụng không nhận/lưu PAN/CVV.
- Mô hình dữ liệu server-owned: `plans` (versioned), `entitlements/{uid}`, `paymentIntents`, `webhookEvents`, `wallets/{uid}`, `walletLedger`, `invoiceRefs`, `adminAuditLogs`. Số dư là tổng sổ cái hoặc trường cache được cập nhật transactionally từ ledger bất biến.
- Luồng nạp: client yêu cầu checkout → backend xác thực user/gói/số tiền từ catalog server → nhà cung cấp trả về checkout → webhook ký số được xác minh → idempotency key chống xử lý trùng → ghi payment + ledger + entitlement atomically → thông báo và cập nhật CMS.
- Xử lý trạng thái pending/paid/failed/cancelled/refunded/chargeback; webhook lặp, đến sai thứ tự, timeout, sai tiền tệ và đối soát thủ công. Không tin redirect “thanh toán thành công” từ trình duyệt.
- Admin có thể cấu hình gói/giá/quyền lợi/hạn mức, nhưng việc publish tạo version mới; không thay đổi quyền đã trả tiền trong lịch sử mà không có chính sách migration/hoàn tiền.
- Trước khi mở thật: kiểm tra môi trường sandbox, hoàn tiền, thuế/chứng từ, điều khoản, chính sách hoàn tiền và hỗ trợ khách hàng.

**Cổng nghiệm thu:** payment không thể tự giả bằng client; webhook không thể cộng hai lần; tiền và entitlement khớp ledger; hoàn tiền/chargeback có trạng thái và audit; giao dịch lỗi không làm mất tiền hoặc cấp nhầm quyền.

### Giai đoạn 5 — Feedback email và hỗ trợ khách hàng

- Form “Gửi phản hồi” trong ứng dụng: loại (lỗi/góp ý/câu hỏi), tiêu đề, nội dung, trang/phiên bản app, mã lỗi tùy chọn; không gửi mô hình 3D, cookie, token, thông tin đăng nhập hoặc dữ liệu không cần thiết.
- Gửi qua endpoint chỉ sau khi xác minh hạ tầng trong giới hạn miễn phí; yêu cầu Auth, kiểm tra App Check, giới hạn theo UID/IP, body cap, cooldown và chống trùng. Turnstile chỉ bật khi tích hợp hiện tại không tạo chi phí ngoài ngân sách.
- Không dùng Firebase Functions làm điều kiện cho feedback vì có thể yêu cầu Blaze. Chọn Pages Function/Worker chỉ khi quota/gói Cloudflare hiện tại đáp ứng; nếu không, giữ `mailto`, không nhận/lưu ticket phía server cho đến khi có lựa chọn miễn phí phù hợp.
- Trả mã ticket cho người dùng; email chỉ xác nhận đã nhận. Quản trị viên phản hồi từ CMS hoặc hộp thư được tích hợp; có chính sách retention/xóa.

**Cổng nghiệm thu:** không thể spam hàng loạt không giới hạn; quota/cooldown hoạt động; email không chứa secret/PII không cần thiết; thất bại email không làm mất ticket; có trạng thái gửi lỗi để retry có giới hạn.

### Giai đoạn 6 — Vận hành, đo lường và mở rộng

- Theo dõi SLO cho đăng nhập thành công, tải workspace, lưu/mở kế hoạch, phản hồi, webhook và email; ghi error code có cấu trúc, không log token/mật khẩu.
- Theo dõi Firestore reads/writes/storage, số document/user, App Check assessment và giới hạn Cloudflare miễn phí; dùng dashboard miễn phí nếu có, đặt kill switch theo tính năng. Không liên kết billing để tạo cảnh báo hóa đơn.
- Bật App Check enforcement theo từng Firebase service sau khi xem metrics và xác minh client hợp lệ. App Check giúp xác nhận nguồn app; nó không thay Security Rules, xác thực/ủy quyền hay rate limits.
- Hoàn thiện export dữ liệu phía người dùng, quy trình incident/rollback và rà soát quyền admin. Backup/PITR/restore do nhà cung cấp có thể yêu cầu gói trả phí; tiếp tục hoãn khi Spark Free là yêu cầu.
- Sau khi SaaS ổn định mới cân nhắc upload mô hình private R2, cộng tác nhóm/organization, chia sẻ kế hoạch, SSO doanh nghiệp và analytics sâu.

## 4. Mô hình dữ liệu khởi điểm

| Dữ liệu | Nơi lưu | Quyền sở hữu / kiểm soát |
|---|---|---|
| Hồ sơ user, locale, trạng thái hiển thị | Firestore `users/{uid}` | User sửa một allowlist nhỏ; quyền/role/status do server quản lý |
| Dụng cụ tùy chỉnh | Firestore `users/{uid}/equipment/{equipmentId}` | Chỉ owner; schema, giới hạn số trường/kích thước/định mức |
| Lift plan và input/output đã chọn | Firestore `users/{uid}/liftPlans/{planId}` | Chỉ owner; JSON nhẹ, versioned, không binary |
| Usage/quota | Firestore metadata giới hạn hoặc số liệu tổng hợp | Ghi có kiểm soát; không giữ log sự kiện vô hạn; thiết kế cho Spark Free |
| Gói/entitlement thương mại, thanh toán, wallet ledger (chỉ G4) | Server-owned store | Chưa dùng hiện tại; nếu bật về sau, ghi từ trusted backend |
| Phản hồi và audit | `mailto` hiện tại; ticket backend ở giai đoạn riêng | Không giả định Firebase Functions miễn phí; phải có quota/retention nếu triển khai |
| Built-in 3D/models | Public asset pipeline/CDN của Cloudflare | Versioned static assets, không tải lên Firestore |
| User model files (nếu chấp thuận mở sau) | Cloudflare R2 | Private object, signed upload/download, MIME/size/quota kiểm soát; Firestore giữ metadata |

Đặt giới hạn rõ: chiều dài chuỗi, số trường, payload/document, số phần tử mảng, tốc độ ghi, số bản lưu và tuổi dữ liệu. Ưu tiên cursor pagination và query có index; giảm reads lặp. Người dùng chấp nhận lượt tải đầu PC lớn hơn để có mô phỏng đầy đủ, nhưng dữ liệu Firebase vẫn phải gọn và có hạn mức. Khi Spark quota cạn, Firebase có thể từ chối/tạm ngưng thao tác dịch vụ đến kỳ quota tiếp theo; không tự tính tiền nếu dự án không liên kết billing.

## 5. Phòng spam và bảo vệ chi phí theo lớp

| Lớp | Biện pháp |
|---|---|
| Trình duyệt | Debounce nút gửi; chặn submit lặp; giới hạn ký tự và kích thước; không tải asset nặng mặc định |
| Firebase | Auth; App Check; Firestore Rules kiểm tra owner, trường cho phép, kiểu dữ liệu, trạng thái và giới hạn; query/index được thiết kế có giới hạn |
| Edge/API | Rate limit theo route và UID/IP; Turnstile ở luồng công khai/rủi ro; request body cap; timeout; idempotency; API chỉ bật route cần thiết |
| Backend | Xác minh Firebase ID token; xác minh role/entitlement tại server; validate schema; giới hạn số lần tạo; email queue có retry/cooldown; không tin số tiền từ client |
| Vận hành | Quota theo gói; log/alert; dự toán; tạm dừng email/upload/export hoặc checkout khi bị abuse; quy trình rà soát trước khi tăng giới hạn |

Không có một nút chống spam tuyệt đối. Cloudflare rate limiting, App Check, Turnstile và Firebase Rules giải quyết các lớp khác nhau; cần quota ứng dụng và quan sát sử dụng. Tính khả dụng/tính phí của một số tính năng Cloudflare phụ thuộc gói tài khoản và cần xác nhận trước khi bật.

## 6. Kiểm thử và điều kiện phát hành

- **Security Rules:** Firebase Emulator tests cho user A/B, guest, locked, admin, support, billing; kiểm tra cả đọc/list/query/create/update/delete và payload sai.
- **Auth:** email/password, Google popup, popup đóng/cancel, phiên hết hạn, đăng xuất, chặn tài khoản, mất mạng, domain production/preview, mobile và VI/EN.
- **Dữ liệu:** schema validation, migration version cũ, duplicate submission, pagination, quota, xóa tài khoản/retention và phục hồi.
- **Billing (chỉ khi G4 mở lại):** sandbox, amount/currency tamper, webhook chữ ký sai, replay/trùng, đến trễ, refund, chargeback, timeout và đối soát.
- **Abuse/quota:** tải lặp vào route nhạy cảm; rate-limit, cooldown và kill switch; kiểm tra Firebase/Cloudflare quota và hành vi throttle trước/sau thử nghiệm. Không cần cost alerts khi không liên kết billing.
- **UI/accessibility:** desktop/mobile, bàn phím, focus, contrast, screen reader, reduced motion, VI/EN, lỗi tải model và fallback ảnh nền.
- **Regression simulator:** các luồng nâng/hạ, trạng thái cargo, rigging, tính tải, xuất hồ sơ và kiến trúc CI hiện có vẫn chạy qua gate release.
- **Release:** feature flag; internal → beta → nhóm người dùng nhỏ → mở rộng; rollback mã nguồn, rules, Functions/Worker và catalog version; không trộn triển khai app với sửa giá/balance không kiểm soát.

## 7. Quyết định cho phạm vi hiện tại và G4 tùy chọn

**Đã chốt:** Firebase Spark Free; không bật Blaze, không thêm thẻ/billing account. Dữ liệu chính là text/JSON nhẹ, không phải ảnh hay mô hình 3D. Sản phẩm desktop-first; chấp nhận tải khởi động đầu tiên lớn hơn để nạp giao diện/mô phỏng, tối ưu hiệu năng khi có số đo thực tế. Quota cạn xử lý bằng giới hạn tính năng/ghi và thông báo, không tự phát sinh phí.

G4 chỉ bắt đầu sau quyết định mới của chủ sản phẩm. Khi đó cần phân biệt rõ chi phí dịch vụ cloud với khoản thanh toán mà khách hàng trả cho SafeLift3D; không giả định phải nâng Firebase nếu có kiến trúc khác phù hợp.

1. Bán subscription, credit nạp trước hay cả hai; đơn vị sử dụng nào được tính phí.
2. Cổng thanh toán/merchant và tài khoản nhận tiền tại Việt Nam; quy trình hoàn tiền/đối soát.
3. Tên gói, giá, chu kỳ, hạn mức và lợi ích cụ thể.
4. Email hỗ trợ công khai; chính sách lưu/xóa phản hồi và dữ liệu người dùng.
5. Có cho upload file 3D tùy chỉnh không; nếu có, định dạng, dung lượng, retention và quyền chia sẻ.
6. Nếu sau này mở rộng hạ tầng khỏi Spark Free, ngân sách tối đa và các ngưỡng tự tắt/giảm tải.

## 8. Thứ tự khuyến nghị

**G0 nền tảng/bảo mật → G1 nhận diện/login/loading → G2 kho dụng cụ/lift plan → G3 CMS thiết yếu → G5 feedback trong giới hạn miễn phí → G6 vận hành Spark → G4 tùy chọn.** G4 bị hoãn và không chặn các giai đoạn khác. Mọi dữ liệu khách hàng mới phải có Rules, quota, giới hạn retention và kiểm thử Emulator trước khi phát hành. Không tự chuyển Firebase sang Blaze.

## Tài liệu tham chiếu chính thức

- [Firestore Security Rules](https://firebase.google.com/docs/firestore/security/get-started) — rules kiểm soát request từ client; server SDK bỏ qua rules và cần IAM riêng.
- [Firebase App Check for web](https://firebase.google.com/docs/app-check/web/recaptcha-enterprise-provider) — theo dõi metrics trước khi bật enforcement; enforcement riêng theo dịch vụ.
- [Firebase Authentication with Identity Platform](https://firebase.google.com/docs/auth?authuser=0#firebase_authentication_with_identity_platform) — MFA có sẵn sau khi nâng cấp; Spark áp dụng hạn mức DAU.
- [Identity Platform quotas and limits](https://cloud.google.com/identity-platform/quotas) — giới hạn sử dụng khi không liên kết billing instrument.
- [TOTP MFA for web](https://firebase.google.com/docs/auth/web/totp-mfa) — yếu tố TOTP cho ứng dụng web, yêu cầu Auth with Identity Platform.
- [Cloudflare Pages Functions](https://developers.cloudflare.com/pages/functions/get-started/) — API edge có thể chạy cùng Pages.
- [Pages Functions bindings and secrets](https://developers.cloudflare.com/pages/functions/bindings/) — tích hợp bindings; bí mật cần dùng secret store.
- [Cloudflare rate limiting rules](https://developers.cloudflare.com/waf/rate-limiting-rules/) — giới hạn request ở edge; khả năng phụ thuộc gói/tính năng.
