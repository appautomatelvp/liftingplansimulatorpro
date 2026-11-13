# SafeLift3D — Kế hoạch nâng cấp sản phẩm toàn diện

**Mục tiêu:** đưa SafeLift3D từ một trình mô phỏng nâng hạ có đăng nhập thành nền tảng chuyên nghiệp cho người dùng, khách hàng và đội ngũ quản trị. Hai ảnh người dùng gửi là nguồn artwork chuẩn cho logo SafeLift3D và nền bãi container. Tên, email và số điện thoại nhà phát triển được người dùng xác nhận để hiển thị công khai.

**Trạng thái triển khai (13/11/2026):** lỗi vật lý được hoãn theo chỉ đạo người dùng. G1 đã có artwork gốc cho logo/nền, bộ icon, thông tin nhà phát triển, giao diện đăng nhập song ngữ, loading và menu liên hệ; accessibility, reduced motion, bản dịch toàn bộ mô phỏng và timeout vẫn cần nghiệm thu. G2 có kho dụng cụ/lift plan theo tài khoản, schema/giới hạn và Firestore Rules owner-scoped; cần migration và E2E trên môi trường triển khai. G0.02 có CI xanh (run `43422385135`, commit `63db54f`). G0.03 đã tạo Firebase staging, Firestore ở `asia-southeast1`, Rules, Email/Password và Google Auth. Cloudflare Preview settings hiện trỏ `VITE_APP_ENV=staging` và các biến Firebase đều là project staging; domain Preview cũng có trong Authorized domains staging. Dù cấu hình dashboard khớp, sign-in trên Preview vẫn báo domain không được phép; cần kiểm tra project/config thật trong bundle hoặc Firebase response trước khi kết luận nguyên nhân. Không mở allowlist production. G0.04 đã quét lịch sử Git với Gitleaks; chưa phát hiện private key/payment/webhook secret trong các phạm vi đã rà. Backup định kỳ/restore Firebase cần billing; theo chỉ đạo ngày 13/11/2026, hoãn phần này và không bật billing. Delete protection vẫn bật. Billing dashboard/alerts phụ thuộc gói cũng hoãn; cảnh báo lỗi miễn phí và rà soát admin/MFA vẫn cần làm. G3.01 đã bổ sung phân trang cursor, tìm email theo tiền tố và giới hạn 25 user/trang; bộ test mới đạt. Rules Emulator CI chưa chạy cho lần sửa này. G4 chưa có thanh toán/ledger/webhook; G5 mới có `mailto`, chưa có ticket/backend/chống spam; G6 chưa có SLO/giám sát/incident runbook. Các thay đổi khác trong working tree chưa được phát hành lên Cloudflare Pages.

## 0. Checklist thực thi theo thứ tự

Ký hiệu: **✓** hoàn tất và có bằng chứng; **◐** đã có một phần, còn cổng nghiệm thu; **□** chưa làm. Không đánh dấu xong chỉ vì có giao diện hoặc cấu hình mẫu.

### G0 — Nền tảng, bảo mật và chi phí

- [✓] **G0.01** Cloudflare Pages và tên miền `safelift3d.com` đã được thiết lập trước đó; cấu hình build nằm trong `wrangler.toml`.
- [✓] **G0.02** `.github/workflows/ci.yml` chạy xanh trên GitHub Actions run `43415934866` cho commit `125599c`: architecture gate, unit/regression, Firestore Rules Emulator (12 ca), production build và Gitleaks. Dùng checkout v6, setup-node v5, setup-java v5, Node 24 và Ubuntu 24.04.
- [◐] **G0.03** Firebase staging `safelift3d-staging` có Web app, Firestore, Rules và Email/Password + Google Auth. Cloudflare Preview build variables hiện đặt `VITE_APP_ENV=staging` cùng config dự án staging. Domain `codex-safelift-g0-ci.safelift3d.pages.dev` có trong Authorized domains staging theo kiểm tra Console và đã được người dùng đồng ý thêm. Preview vẫn báo domain không được phép; nguyên nhân runtime còn chưa được xác định. Không thêm domain vào allowlist production. Release gate Production còn chờ.
- [◐] **G0.04** Gitleaks đã quét toàn bộ lịch sử Git thành công; rà mã nguồn và Cloudflare Production/Preview variables chỉ thấy Firebase Web API config và App Check site key là client-side identifiers, không tìm thấy private key/payment/webhook secret theo các mẫu đã kiểm tra. GitHub repository secrets không chứa secret ứng dụng. Vite/Vitest đã được nâng lên 6.4.6/4.1.12 để xử lý các cảnh báo audit; `npm audit` hiện 0 lỗ hổng. Tiếp tục rà trước khi bật backend/billing.
- [◐] **G0.05** Firebase Auth providers và Rules đã phát hành trên staging; production Rules đã phát hành. Delete protection bật trên production và staging. Staging App Check key riêng đã được đăng ký ở Preview, nhưng traffic/metrics chưa nghiệm thu và enforcement chưa bật. Backup định kỳ/restore yêu cầu billing; theo chỉ đạo, hoãn phần này và không bật billing. Quyền admin/MFA vẫn cần rà soát.
- [✓] **G0.06** Threat model và danh sách kiểm soát còn thiếu đã được ghi tại `docs/SECURITY_THREAT_MODEL.md`; phân biệt biện pháp hiện có với hạng mục chưa triển khai.
- [◐] **G0.07** Firestore Rules Emulator có 12 ca đạt trên CI, gồm cross-account get/list/update/delete, tài khoản khóa, tự cấp quyền, schema sai và giới hạn slot. Auth/Functions backend chưa được triển khai; test feedback/billing chờ tới khi có các luồng server tương ứng.
- [□] **G0.08** Dashboard/cảnh báo chi phí và lỗi Firebase, Cloudflare, email chưa có.
- [◐] **G0.09** Có role admin cơ bản; chưa có phân quyền support/billing/catalog, MFA bắt buộc hay audit quản trị.

### G1 — Nhận diện, đăng nhập và loading

- [✓] **G1.01** Tích hợp artwork logo và nền container do người dùng cung cấp; attribution nhà phát triển được hiển thị.
- [✓] **G1.02** Đồng bộ logo/favicon/app icon và bộ SVG chức năng trong `public/safelift3d-icons/`.
- [◐] **G1.03** Login email/Google/reset và VI/EN đã có; chưa nghiệm thu toàn bộ bản dịch ở các màn mô phỏng.
- [✓] **G1.04** Mục liên hệ nhà phát triển mở email soạn sẵn; đây chưa phải feedback ticket.
- [◐] **G1.05** Loading có các bước khởi tạo và cập nhật tiến trình; cần chứng minh phần trăm gắn với công việc thật, timeout và retry.
- [□] **G1.06** Kiểm thử mobile, bàn phím, screen reader, contrast, reduced motion và fallback lỗi tải.
- [□] **G1.07** E2E login/logout, popup đóng, mạng lỗi, tài khoản khóa và locale trên domain production/preview.

### G2 — Kho dụng cụ và lift plan

- [✓] **G2.01** Kho dụng cụ theo tài khoản: thêm/sửa/xóa thông số nhẹ, không upload mô hình 3D lên Firestore.
- [✓] **G2.02** Lift plan: lưu/mở/sao chép/archive/xóa/xuất JSON, liên kết dụng cụ và lưu snapshot có phiên bản solver.
- [✓] **G2.03** Cursor pagination, giới hạn payload và quota slot Free/Premium đã có.
- [✓] **G2.04** Firestore Rules production đã phát hành.
- [◐] **G2.05** Emulator Rules đạt 6/6; cần thêm test chặn cross-account update/delete, locked user, payload/quota đầy đủ và quyền admin.
- [□] **G2.06** Migration dữ liệu/schema cũ và kiểm tra mở lại qua phiên bản solver chưa có.
- [□] **G2.07** E2E trên staging/production: đăng nhập, CRUD, tải lại trang, giới hạn quota và không rò dữ liệu giữa user.

### G3 — CMS quản trị

- [◐] **G3.01** CMS có danh sách user và đổi tier/status; đã bổ sung phân trang cursor, tìm email theo tiền tố và truy vấn giới hạn 25 hồ sơ/trang. Unit tests đạt 269/269; Rules Emulator cần xác nhận trên CI.
- [□] **G3.02** Dashboard usage, lỗi, phản hồi, doanh thu đối soát và cảnh báo.
- [□] **G3.03** Lịch sử user, quyền tạm thời có lý do/hạn, bộ lọc và công cụ hỗ trợ.
- [□] **G3.04** Quản lý version gói/entitlement, catalog và feature flags.
- [□] **G3.05** Phân hệ billing, refund/reconcile, feedback inbox, audit log và phân quyền admin/support/billing.

### G5 — Feedback và hỗ trợ

- [◐] **G5.01** Liên hệ `mailto` có giới hạn nội dung; chưa ghi nhận ticket phía server.
- [□] **G5.02** Form ticket có validate, Auth/App Check, rate limit/cooldown và chống gửi lặp.
- [□] **G5.03** Backend gửi email qua secret store; lỗi email có retry giới hạn, ticket không mất.
- [□] **G5.04** CMS xử lý ticket, trạng thái, SLA, retention và xóa dữ liệu.

### G4 — Billing và tín dụng

- [□] **G4.01** Chốt subscription/credit, đơn vị tính phí, giá và quyền lợi.
- [□] **G4.02** Chọn nhà cung cấp/merchant phù hợp Việt Nam và xác minh quy trình sandbox.
- [□] **G4.03** Backend checkout, xác minh chữ ký webhook, idempotency, ledger bất biến và entitlement server-owned.
- [□] **G4.04** CMS giao dịch, refund/chargeback, đối soát, audit và kiểm thử replay/tamper.
- [□] **G4.05** Hoàn thiện điều khoản, hóa đơn/thuế, hoàn tiền và hỗ trợ trước khi thu tiền thật.

### G6 — Vận hành và mở rộng

- [□] **G6.01** Đặt SLO/error tracking cho login, workspace, feedback, email và billing; không log token/PII dư thừa.
- [□] **G6.02** Cost dashboard, quota alerts và kill switch theo tính năng.
- [□] **G6.03** Bật App Check enforcement theo từng dịch vụ sau khi kiểm metrics.
- [□] **G6.04** Backup mã hóa, diễn tập restore, incident runbook và rollback.
- [□] **G6.05** Chỉ sau các cổng trên mới mở R2 upload, collaboration, SSO hoặc analytics sâu.

**Bước đang thực hiện:** kiểm tra nguyên nhân Google sign-in Preview còn bị từ chối dù Firebase staging domain và Cloudflare Preview variables đã khớp; không đổi allowlist production. Đưa CMS pagination/search qua Rules Emulator CI. Tiếp đó làm dashboard/lịch sử người dùng rồi feedback backend. Backup/restore và billing dashboard cần gói trả phí được hoãn theo chỉ đạo; không bật billing. CI run `43422385135` cho commit `63db54f` xanh. Delete protection vẫn bật ở production. Chưa merge hay phát hành production.

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
5. **Giới hạn chi phí theo tính năng:** định mức số bản ghi, dung lượng metadata, tốc độ tạo, truy vấn, số lần xuất và tác vụ nặng theo gói; có cảnh báo chi phí và nút tạm khóa các luồng tốn tài nguyên.
6. **Mọi thao tác quản trị có dấu vết:** ai làm, lúc nào, mục tiêu nào, giá trị trước/sau và lý do; không lưu bí mật thanh toán hoặc thông tin thẻ.
7. **Thiết kế theo module:** UI → app services → domain/API; tiếp tục giữ simulator hiện tại chạy ổn và chỉ tích hợp qua các điểm kết nối ổn định.

### Sơ đồ dịch vụ đích

```text
Browser / PWA
  ├─ Cloudflare Pages: giao diện Vite, asset tĩnh, tên miền safelift3d.com
  ├─ Firebase Auth: đăng nhập và danh tính
  ├─ Firestore client: dữ liệu cá nhân nhẹ, theo Security Rules + App Check
  └─ Cloudflare Pages Functions / Worker: rate-limit, Turnstile khi phù hợp,
       nhận yêu cầu feedback, tạo phiên checkout và API biên
              └─ Backend tin cậy (Firebase Functions/Admin SDK hoặc Worker được cấp IAM hẹp)
                   ├─ xác minh token, vai trò và schema
                   ├─ webhook thanh toán, idempotency, ledger/entitlement
                   └─ email thông báo và audit

3D built-in → Cloudflare static/CDN
3D user upload (nếu bật sau) → Cloudflare R2; metadata/owner/quota → Firestore
```

Chọn backend tin cậy theo năng lực vận hành hiện có trước khi triển khai giao dịch. Firebase Admin SDK bỏ qua Firestore Security Rules nên mọi backend dùng SDK này phải áp IAM chặt, xác thực đầu vào và tự kiểm tra quyền; không coi Firestore Rules là hàng rào của luồng server.

## 3. Các giai đoạn triển khai

Thời lượng dưới đây là cỡ công việc theo sprint, chưa phải cam kết ngày giao hàng; cần chốt sau khi thống nhất nhà cung cấp thanh toán, chính sách gói và định mức.

### Giai đoạn 0 — Chốt nền tảng, bảo mật và đo chi phí

- Cập nhật tài liệu kiến trúc/triển khai: Cloudflare Pages + GitHub Actions; tách môi trường preview, staging và production; bí mật chỉ nằm trong secret store, không trong repository hay bundle.
- Kiểm kê Firestore/Auth/App Check đã bật ở Firebase Console, quyền admin thật, backup/khôi phục, domain OAuth và cấu hình DNS; không dựa vào giả định chỉ từ mã nguồn.
- Lập threat model cho spam đăng ký, dò mật khẩu, lạm dụng API, leo quyền, sửa giá, giả webhook, spam email, đọc chéo dữ liệu và tạo tài liệu hàng loạt.
- Thiết lập project thử nghiệm/emulator cho Auth/Firestore/Functions; mọi rule mới có ma trận cho phép/từ chối trước khi lên production.
- Đặt dashboard cảnh báo lỗi Auth, denied rules, mức dùng reads/writes, lưu lượng Functions/Workers, email và hóa đơn; định nghĩa ngưỡng cảnh báo cùng hành động giảm tải.
- Quyết định vai trò admin/support/billing và bước xác minh bổ sung (MFA cho quản trị); lưu role tin cậy do backend provisioning cấp, không cho người dùng tự sửa.

**Cổng nghiệm thu:** không có secret trong git/bundle; không có rule mở toàn cục; backup/restore được diễn tập; staging tách dữ liệu production; cảnh báo chi phí và quy trình rollback đã định nghĩa.

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
3. **Gói & entitlement:** tạo bản nháp, sửa nội dung/quyền lợi/hạn mức/giá, preview, phát hành phiên bản mới, ngừng bán mà không sửa lịch sử giao dịch cũ.
4. **Thanh toán:** danh sách giao dịch, trạng thái webhook, đối soát, hoàn tiền theo nhà cung cấp, xử lý ngoại lệ, tra mã tham chiếu. Không sửa số dư trực tiếp; thao tác điều chỉnh phải ghi ledger và audit với lý do.
5. **Feedback/support:** hộp thư phản hồi, gán trạng thái/nhân sự, chủ đề, mức độ ưu tiên, ghi chú nội bộ, trả lời qua email, thời điểm phản hồi và thống kê SLA.
6. **Kho/catalog:** quản lý dụng cụ mẫu chính thức, version, trạng thái công bố và kiểm duyệt metadata; phân biệt rõ catalog do SafeLift3D xác minh với đồ dùng tự tạo của khách hàng.
7. **Hệ thống:** cấu hình cờ tính năng, quotas, thông báo bảo trì, giới hạn upload, mẫu email, nhật ký quản trị, export báo cáo có quyền và audit.

**Kiểm soát CMS:** role-based access cho `admin`, `support`, `billing`, `catalog-editor`; MFA cho tài khoản đặc quyền; xác nhận lại với khóa user/hoàn tiền/đổi giá; quyền tối thiểu; phân trang; che bớt PII; log trước/sau không cho client sửa/xóa.

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
- Gửi tới backend, yêu cầu Auth khi phù hợp; kiểm tra App Check, giới hạn request theo UID/IP, Turnstile cho lưu lượng rủi ro, honeypot, độ dài tối đa, escape nội dung, cooldown và trùng lặp.
- Firestore chỉ giữ nội dung gọn + metadata + trạng thái xử lý; backend gửi email quản trị qua nhà cung cấp thư có thể cấu hình secret. Không gửi email trực tiếp từ client và không dựa vào `mailto` làm hệ thống theo dõi.
- Trả mã ticket cho người dùng; email chỉ xác nhận đã nhận. Quản trị viên phản hồi từ CMS hoặc hộp thư được tích hợp; có chính sách retention/xóa.

**Cổng nghiệm thu:** không thể spam hàng loạt không giới hạn; quota/cooldown hoạt động; email không chứa secret/PII không cần thiết; thất bại email không làm mất ticket; có trạng thái gửi lỗi để retry có giới hạn.

### Giai đoạn 6 — Vận hành, đo lường và mở rộng

- Theo dõi SLO cho đăng nhập thành công, tải workspace, lưu/mở kế hoạch, phản hồi, webhook và email; ghi error code có cấu trúc, không log token/mật khẩu.
- Theo dõi Firestore reads/writes/storage, số document/user, email, App Check assessment, Workers/Functions, R2 nếu bật; cảnh báo trước ngưỡng dự toán tháng và có kill switch theo từng tính năng.
- Bật App Check enforcement theo từng Firebase service sau khi xem metrics và xác minh client hợp lệ. App Check giúp xác nhận nguồn app; nó không thay Security Rules, xác thực/ủy quyền hay rate limits.
- Thêm backup/export có mã hóa, kiểm tra khôi phục, quy trình incident/rollback và lịch rà soát quyền admin.
- Sau khi SaaS ổn định mới cân nhắc upload mô hình private R2, cộng tác nhóm/organization, chia sẻ kế hoạch, SSO doanh nghiệp và analytics sâu.

## 4. Mô hình dữ liệu khởi điểm

| Dữ liệu | Nơi lưu | Quyền sở hữu / kiểm soát |
|---|---|---|
| Hồ sơ user, locale, trạng thái hiển thị | Firestore `users/{uid}` | User sửa một allowlist nhỏ; quyền/role/status do server quản lý |
| Dụng cụ tùy chỉnh | Firestore `users/{uid}/equipment/{equipmentId}` | Chỉ owner; schema, giới hạn số trường/kích thước/định mức |
| Lift plan và input/output đã chọn | Firestore `users/{uid}/liftPlans/{planId}` | Chỉ owner; JSON nhẹ, versioned, không binary |
| Gói, giá, entitlement, thanh toán, wallet ledger | Firestore collection server-owned | Ghi từ trusted backend; client chỉ đọc projection được phép |
| Phản hồi và audit | Firestore collection riêng | Ticket do backend tiếp nhận; audit append-only, đọc theo vai trò |
| Built-in 3D/models | Public asset pipeline/CDN của Cloudflare | Versioned static assets, không tải lên Firestore |
| User model files (nếu chấp thuận mở sau) | Cloudflare R2 | Private object, signed upload/download, MIME/size/quota kiểm soát; Firestore giữ metadata |

Đặt giới hạn rõ: chiều dài chuỗi, số trường, payload/document, số phần tử mảng, tốc độ ghi, số bản lưu và tuổi dữ liệu. Ưu tiên cursor pagination và query có index; tránh query không lọc hoặc tính phí theo từng lần mở trang.

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
- **Billing:** sandbox, amount/currency tamper, webhook chữ ký sai, replay/trùng, đến trễ, refund, chargeback, timeout và đối soát.
- **Abuse/cost:** tải lặp vào route nhạy cảm; rate-limit, cooldown, email cap và kill switch; kiểm tra metrics/cost alerts trước/sau thử nghiệm.
- **UI/accessibility:** desktop/mobile, bàn phím, focus, contrast, screen reader, reduced motion, VI/EN, lỗi tải model và fallback ảnh nền.
- **Regression simulator:** các luồng nâng/hạ, trạng thái cargo, rigging, tính tải, xuất hồ sơ và kiến trúc CI hiện có vẫn chạy qua gate release.
- **Release:** feature flag; internal → beta → nhóm người dùng nhỏ → mở rộng; rollback mã nguồn, rules, Functions/Worker và catalog version; không trộn triển khai app với sửa giá/balance không kiểm soát.

## 7. Quyết định cần chốt trước khi bật billing

1. Bán subscription, credit nạp trước hay cả hai; đơn vị sử dụng nào được tính phí.
2. Cổng thanh toán/merchant và tài khoản nhận tiền tại Việt Nam; quy trình hoàn tiền/đối soát.
3. Tên gói, giá, chu kỳ, hạn mức và lợi ích cụ thể.
4. Email hỗ trợ công khai; chính sách lưu/xóa phản hồi và dữ liệu người dùng.
5. Có cho upload file 3D tùy chỉnh không; nếu có, định dạng, dung lượng, retention và quyền chia sẻ.
6. Ngân sách vận hành tối đa theo tháng và các ngưỡng tự tắt/giảm tải.

## 8. Thứ tự khuyến nghị

**G0 nền tảng/bảo mật → G1 nhận diện/login/loading → G2 kho dụng cụ/lift plan → G3 CMS → G5 feedback → G4 billing → G6 vận hành/mở rộng.** Feedback đưa lên trước billing vì cung cấp kênh hỗ trợ ngay khi có beta; billing chỉ mở sau khi ledger, webhook, đối soát và điều khoản được nghiệm thu. Các giai đoạn có thể triển khai dần, nhưng mọi dữ liệu khách hàng mới phải có rules/quota và kiểm thử emulator trước khi phát hành.

## Tài liệu tham chiếu chính thức

- [Firestore Security Rules](https://firebase.google.com/docs/firestore/security/get-started) — rules kiểm soát request từ client; server SDK bỏ qua rules và cần IAM riêng.
- [Firebase App Check for web](https://firebase.google.com/docs/app-check/web/recaptcha-enterprise-provider) — theo dõi metrics trước khi bật enforcement; enforcement riêng theo dịch vụ.
- [Cloudflare Pages Functions](https://developers.cloudflare.com/pages/functions/get-started/) — API edge có thể chạy cùng Pages.
- [Pages Functions bindings and secrets](https://developers.cloudflare.com/pages/functions/bindings/) — tích hợp bindings; bí mật cần dùng secret store.
- [Cloudflare rate limiting rules](https://developers.cloudflare.com/waf/rate-limiting-rules/) — giới hạn request ở edge; khả năng phụ thuộc gói/tính năng.
