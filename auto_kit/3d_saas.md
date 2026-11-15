# @3d / @saas — MODULE CHUYÊN SÂU: MÔ PHỎNG 3D KỸ THUẬT & SAAS THƯƠNG MẠI (V7)
**Đúc kết từ 2 dự án đỉnh cao nhất trong `PHUONG PROJECT`:**
1. **`LIFTING PLAN SIMULATOR PRO` (`SafeLift3D`)** — Kiến trúc mô phỏng 3D & vật lý công nghiệp.
2. **`CARBOOK` & `ROSTER2`** — Kiến trúc SaaS đa người dùng, thanh toán tự động & xử lý dữ liệu lớn.

---

## MODULE A: LUẬT KIẾN TRÚC CHO APP MÔ PHỎNG 3D & VẬT LÝ (`SafeLift3D` Standard)

1. **Luật Cách Ly Vật Lý (`Physics Quarantine` - `ADR-003`):**
   - Toàn bộ thư viện vật lý (`@dimforge/rapier3d-compat`, `cannon-es`) chỉ được phép gọi bên trong `/src/core/physics-world/` thông qua lớp trung gian `IPhysicsBackend.js` và `PhysicsWorldManager.js`.
   - Giao diện UI và Three.js `SceneRenderer.js` chỉ được phép đọc tọa độ `(position, quaternion)` đã nội suy (`alpha`) để cập nhật khung hình.
2. **Luật Vòng Lặp Bước Cố Định (`FixedStepLoop.js`):**
   - Tuyệt đối không truyền trực tiếp `deltaTime` biến thiên của màn hình vào bộ giải vật lý. Phải dùng bộ tích lũy thời gian cố định (`fixedDt = 1/60`), chặn trần `clampedDt` và `maxSteps = 10` để khi chuyển tab trình duyệt quay lại, vật thể 3D không bị văng nổ tung khỏi màn hình!
3. **Luật Chuẩn Màu & Ánh Sáng Three.js r170+ (`SceneRenderer.js` & `PBRMaterialFactory.js`):**
   - Luôn thiết lập:
     - `renderer.outputColorSpace = THREE.SRGBColorSpace`
     - `renderer.toneMapping = THREE.ACESFilmicToneMapping`
     - Texture màu (`map`, `emissiveMap`) dùng `THREE.SRGBColorSpace`; texture vật lý (`normalMap`, `roughnessMap`, `metalnessMap`) dùng `THREE.NoColorSpace`.
   - Luôn hỗ trợ 3 mức chất lượng (`QUALITY_TIERS`: `low`, `medium`, `high`) và giải phóng bộ nhớ (`geometry.dispose()`, `material.dispose()`) khi đổi cảnh.
4. **Luật Tách Môi Trường Staging vs Production (`deployment_environment.js`):**
   - Mọi dự án 3D/SaaS lớn phải tách riêng biến môi trường Preview/Staging (VD: `safelift3d-staging`) và Production (`safelift3d`) trên Cloudflare Pages / Vercel kèm App Check (`ReCaptchaEnterpriseProvider`).

---

## MODULE B: LUẬT KIẾN TRÚC CHO APP SAAS THƯƠNG MẠI (`CARBOOK` & `ROSTER2` Standard)

1. **Luật Chia Nhỏ Document Firestore (`weekDoc.js` Pattern):**
   - Firestore giới hạn tối đa **1MB / document** và tính tiền theo số lượt đọc/ghi.
   - Với dữ liệu dạng lịch trình, chấm công, nhật ký dài ngày: KHÔNG lưu cả năm vào 1 document khổng lồ. Hãy chia nhỏ theo từng tuần (`weekIdOf(dateISO)` lấy ngày Thứ Hai đầu tuần làm ID document) và chỉ tải cửa sổ các tuần lân cận (`nearbyRosterWindow.js`).
2. **Luật Thương Mại Hóa & Chế Độ Chỉ Đọc (`CARBOOK` Subscription Pattern):**
   - Mọi tính năng ghi dữ liệu của khách hàng SaaS đều kiểm tra quyền qua `evaluateSubscriptionAccess(user)`.
   - Khi tài khoản hết hạn gói cước: **KHÔNG khóa đăng nhập!** Bật cờ `isReadOnly = true` để khách vẫn xem, tra cứu và xuất được toàn bộ dữ liệu cũ của họ, chỉ chặn thao tác Thêm/Sửa mới và hiển thị mã QR thanh toán VietQR (`CB[0-9]{6}[A-Z0-9]{4}`).
3. **Luật Serverless Proxy Trên Cloudflare Pages (`functions/api/`):**
   - Mọi khóa bí mật (`GOOGLE_ROUTES_API_KEY`, `GEMINI_API_KEY`, `PAYMENT_WEBHOOK_SECRET`) chỉ được đặt trong `context.env` của Cloudflare Pages Functions (`/functions/api/*.js`) hoặc Vercel (`/api/*.js`), tuyệt đối không để lộ trong code Front-end.
