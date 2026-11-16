# KẾ HOẠCH TỐI ƯU TỔNG THỂ HỆ THỐNG & SỬA LỖI (PLAN V7)
Trạng thái: ACTIVE
Nhánh thực hiện: feat/horizon-clouds (đã sao lưu an toàn vào `_BACKUPS_LOCAL`)

## 1. Mục tiêu
1. **Chân trời hòa mượt 100% (không lộ đường cắt ngang):** Khắc phục lệch tone-mapping giữa `HorizonSkyDome` (`toneMapped: false`) và `scene.fog` (`ACESFilmicToneMapping`), sửa dải chuyển `elev` bắt đầu quá thấp so với mép đĩa nền `floorMesh`, và làm mờ dần rìa đĩa nền vào sương mù ở mọi chế độ bầu trời (Real-Time, Sunset, Overcast, Print Sheet).
2. **Sửa lỗi thiếu mô hình `Steel Pipe (OOG)` (`pipe`) & đồng nhất 1 hình cho `Vehicle` (`car`):** Thêm bộ dựng 3D cho `pipe` (ống thép cỡ lớn + gân bích + gối đỡ chống lăn + tai cẩu), bổ sung vào danh mục `libraryCatalog.cargo`; đồng thời loại bỏ lỗi nhấn `Vehicle` lúc đầu ra xe con màu đỏ rồi bất ngờ nhảy thành xe buýt xanh (`bus.obj`) kèm reset lugs.
3. **Khử lag khi load mô hình CAD (`bus.obj` 9.16 MB & ISO OBJs):** Bỏ `EdgesGeometry` trên các mesh mật độ đỉnh quá cao (`> 8000` đỉnh), tái sử dụng cache tải URL + khử fetch trùng + nhường luồng chính (`yieldToMain`), và giới hạn LRU + `dispose()` bộ nhớ cho `cargoMeshCache`.
4. **Khử lag giật trong quá trình mô phỏng (60 FPS ổn định):** Thêm bộ đệm nghỉ/tái sử dụng `ropeSim` khi cáp đứng yên, khử cấp phát rác `Vector3/Matrix4/Quaternion` trong vòng lặp xích/cáp `draw_update.js`, chống vẽ lại DOM thừa mỗi frame ở `telemetry.js`, và hạ `shadowMapSize` của mức `high` từ `4096` xuống `2048` (giữ `4096` cho `ultra`).

## 2. Giả định & Thiết kế kiến trúc
- **Cơ chế nạp module:** `src/sim/manifest.js` bị `[LOCKED]`, nên mọi file mới bổ sung cho sim **phải đặt trong `src/graphics/` hoặc `src/rigging/`** và re-export qua `src/graphics/index.js` (`GFX`) hoặc `src/rigging/index.js` (`RIG`). Hai namespace `GFX` và `RIG` được `src/app/boot.js` truyền trực tiếp vào toàn bộ bundle `src/sim/*` (cả app thật và headless Vitest).
- Tôn trọng tuyệt đối luật chống phình file (`⚠️>300` không nhồi `> 25` dòng; tách logic mới sang file module `< 250` dòng có `@purpose:` ở dòng 1).
- Không sửa bất kỳ file `[LOCKED]` nào trong `STATE.md`.
- Đối với `Vehicle (car)`: vì tệp 3D CAD là xe buýt (`bus.obj`, kích thước `9.0 × 2.38 × 2.80m`), nhánh dựng nhanh ban đầu (`specialty_meshes.js`) phải dựng **xe buýt xanh ngọc đồng bộ tỷ lệ** (`buildProceduralCoachBusMesh`) thay vì xe con đỏ 4.6m, để khi `bus.obj` (CAD 1:1) tải xong luôn nhất quán cùng 1 loại xe và dùng `rebuildCargoAndRig(false)` giữ nguyên lugs/tư thế.

## 3. Rủi ro cần lưu ý
- `HorizonSkyDome.js` dùng `ShaderMaterial`: khi bật `toneMapped: true` và `#include <tonemapping_fragment>`, phải đặt `#include <tonemapping_fragment>` TRƯỚC `#include <colorspace_fragment>` và giữ `y <= 0.005` thuần `uHorizonColor` để trùng 100% với `scene.fog.color` của nền.
- `applyGroundHorizonFade` trên `MATS.quayConcrete` hoặc material sàn: dùng `onBeforeCompile` + `material.customProgramCacheKey` riêng để không hỏng shader chuẩn Three.js khi đổi groundPreset.

---

## 4. Các bước thực hiện (Chạy tuần tự từng bước, kiểm tra xanh rồi mới sang bước kế)

### [x] Bước 1: Hòa mượt đường chân trời (Horizon Seamless Blend — 3 files)
- **File được sửa / tạo:**
  1. `src/graphics/GroundHorizonFade.js` *(FILE MỚI, `< 100` dòng, `@purpose:`)*: Export `applyGroundHorizonFade(material, fadeStartM, fadeEndM)` dùng `onBeforeCompile` (kèm `customProgramCacheKey`) hòa mượt màu pixel mặt đất theo khoảng cách XZ ra ngoài vào `fogColor` / `uHorizonFogColor`, đảm bảo mép ngoài đĩa nền biến mất hoàn toàn trong sương mù.
  2. `src/graphics/HorizonSkyDome.js` *(≤ 280 dòng)*: Bật `toneMapped: true`, thêm `#include <tonemapping_fragment>` ngay trước `#include <colorspace_fragment>` trong `SKY_FRAGMENT_SHADER`, chỉnh `elev = smoothstep(0.0, 0.42, max(y, 0.0))` (vùng `y <= 0.005` giữ thuần `uHorizonColor` không pha `uMidSkyColor`/mây để triệt tiêu hoàn toàn đường cắt ngang tại mép sàn `dir.y ≈ -0.02`).
  3. `src/graphics/index.js` *(+2 dòng)* & `src/sim/scene.js` *(thêm/sửa `≤ 14` dòng quanh `657–688`)*: Re-export `applyGroundHorizonFade` qua `GFX`, tăng bán kính đĩa nền `560m` và gọi `GFX.applyGroundHorizonFade(floorMesh.material, 220, 540)` khi tạo/đổi sàn.
- **File CẤM đụng:** Toàn bộ `[LOCKED]`, `src/core/`, `draw_update.js`, `parsers.js`.
- **Kiểm tra:** `npm run architecture:gate; npm run build`

### [x] Bước 2: Bổ sung 3D `Steel Pipe (OOG)` & đồng nhất hình ảnh `Vehicle` (3 files)
- **File được sửa / tạo:**
  1. `src/graphics/SpecialtyCargoMeshes.js` *(FILE MỚI, `< 200` dòng, `@purpose:`)*: Export `buildSteelPipeCargoMesh(THREE, L, W, H, mats)` (ống thép siêu trường OOG gồm thân ống trụ lớn, bích đầu ống tăng cứng, 2 gối kê chống lăn chữ H/chữ V và 4 tai cẩu hàn) và `buildProceduralCoachBusMesh(THREE, L, W, H, mats)` (xe buýt xanh ngọc đồng bộ tỷ lệ `9.0×2.38×2.80m` với `bus.obj` để chọn `Vehicle` không còn nhảy từ xe đỏ sang xe xanh).
  2. `src/graphics/index.js` *(+2 dòng)* & `src/sim/state.js` *(+3 dòng vào `libraryCatalog.cargo` quanh dòng `257`)*: Re-export 2 hàm qua `GFX` và thêm preset `{ id: 'pipe', meshName: 'Steel_Pipe_OOG', name: 'Steel Pipe (OOG) — Ống thép siêu trường', L: 12.0, W: 2.2, H: 2.2, weight: 28, cogX: 0, cogY: -0.05, cogZ: 0, badge: 'OOG Pipe' }`.
  3. `src/sim/cargo/specialty_meshes.js` *(sửa `≤ 20` dòng quanh dòng `1160–1225`)*: Thêm nhánh `else if (type === 'pipe')` gọi `GFX.buildSteelPipeCargoMesh(THREE, L, W, H, MATS)` và đổi nhánh `else if (type === 'car')` gọi `GFX.buildProceduralCoachBusMesh(THREE, L, W, H, MATS)`.
- **File CẤM đụng:** Toàn bộ `[LOCKED]`, `HorizonSkyDome.js`, `draw_update.js`.
- **Kiểm tra:** `npm run architecture:gate; npm run build`

### [x] Bước 3: Tối ưu tải mô hình CAD & khử giật lag lúc load (3 files)
- **File được sửa / tạo:**
  1. `src/core/AssetLoaders.js` *(sửa `≤ 25` dòng trong `loadFromUrl`)*: Thêm cache `urlCache` (`Map`) lưu bản gốc đã parse/normalize (trả về `root.clone(true)` khi mở lại URL cũ thay vì fetch + parse lại `9.16 MB` text), kèm `await new Promise(r => setTimeout(r, 0))` nhường luồng chính giữa lúc tải text, parse OBJ và normalize.
  2. `src/sim/library/parsers.js` *(sửa `≤ 20` dòng ở `ensureCargoPortAsset` dòng `520–585`)*: Thêm `_inflightCargoLoads` `Map` chống fetch trùng khi click liên tiếp; với `car` khi `bus.obj` tải xong chỉ gọi `rebuildCargoAndRig(false)` (không reset lugs/tư thế `true`).
  3. `src/sim/scene.js` *(sửa `≤ 14` dòng tại `applyCADFeatureEdges` dòng `195–235`)*: Bỏ qua tạo `new THREE.EdgesGeometry` cho mesh mật độ đỉnh quá cao (`count > 8000` như `bus.obj`) để loại bỏ đứng hình hàng giây lúc tải CAD.
- **File CẤM đụng:** Toàn bộ `[LOCKED]`.
- **Kiểm tra:** `npm run architecture:gate; npm run build`

### [ ] Bước 4: Tối ưu hiệu năng vòng lặp 3D & dọn bộ nhớ `cargoMeshCache` (3 files)
- **File được sửa / tạo:**
  1. `src/rigging/SlingPerfHelper.js` *(FILE MỚI, `< 180` dòng, `@purpose:`)*: Chứa bộ scratch (`Vector3`, `Matrix4`, `Quaternion`, `Euler`) tái sử dụng không cấp phát rác cho vòng lặp vẽ mắt xích & đoạn dây, và `canReuseSettledSlackRope(slingObj, A, B, L, cargoKey, isIdle)` cho phép dây chùng tái sử dụng kết quả XPBD khi 2 đầu dây + cargo đứng yên (`Δ < 1e-4m`).
  2. `src/rigging/index.js` *(+2 dòng)* & `src/sim/rigging/draw_update.js` *(sửa `≤ 22` dòng tại `simulateSlackRope` `135–145` và vòng lặp `514–652`)*: Re-export `SlingPerfHelper` qua `RIG`, bỏ cấp phát `new THREE.Vector3/Matrix4()` trong vòng lặp link/segment và bỏ qua bước giải XPBD khi dây đã ổn định.
  3. `src/sim/cargo/shell_rebuild.js` *(sửa `≤ 18` dòng tại `cargoMeshCache` dòng `395–430`)*: Giới hạn `cargoMeshCache` tối đa `6` kiện (LRU) và `dispose()` geometry/material khi loại entry cũ để chống tràn RAM/VRAM.
- **File CẤM đụng:** Toàn bộ `[LOCKED]`.
- **Kiểm tra:** `npm run architecture:gate; npm run build`

### [ ] Bước 5: Tối ưu ghi DOM HUD 60Hz & độ phân giải Shadow mặc định (2 files)
- **File được sửa / tạo:**
  1. `src/sim/telemetry.js` *(sửa `≤ 22` dòng)*: Cache chuỗi text, `className` và tọa độ màn hình `left/top/opacity` trong `projectToScreen` / `lbl-t*` / `lbl-hook` / `lbl-ground-angle` — chỉ ghi DOM khi giá trị thực sự thay đổi, cắt giảm tối đa style/layout thrash ở 60Hz.
  2. `src/graphics/SceneRenderer.js` *(sửa `1–3` dòng tại `QUALITY_TIERS.high`)*: Hạ `high.shadowMapSize` từ `4096` xuống `2048` (mức `ultra` giữ nguyên `4096`) giúp dựng bóng mượt 60 FPS trên GPU tầm trung.
- **File CẤM đụng:** Toàn bộ `[LOCKED]`, `draw_update.js`.
- **Kiểm tra:** `npm run architecture:gate; npm run build`

### [ ] Bước 6: Kiểm thử tự động (Vitest) & Nghiệm thu toàn hệ thống (1 file + full gates)
- **File được tạo:**
  1. `test/optimize_horizon_cargo_perf.test.js` *(FILE MỚI, `< 150` dòng, `@purpose:`)*: Kiểm thử:
     - `HorizonSkyDome` bật `toneMapped: true`, có `#include <tonemapping_fragment>` trước `#include <colorspace_fragment>` và không bắt đầu blend bầu trời sớm dưới `y = 0`.
     - `buildSteelPipeCargoMesh` và `buildProceduralCoachBusMesh` sinh group có `> 0` mesh, kích thước hợp lệ; `libraryCatalog.cargo` có `id: 'pipe'`.
     - `canReuseSettledSlackRope` trả `true` khi dây đã nghỉ và đầu dây không đổi, `false` khi đầu dây dịch chuyển.
     - `AssetLoaders` URL cache trả bản clone độc lập.
- **Lệnh kiểm tra tổng kết:**
  - `npx vitest run`
  - `npm run architecture:gate`
  - `npm run build`
  - `npm run check:dist`
  - `./scripts/auto_check.ps1`
  - Đặt `Trạng thái: DONE` trong `auto_memory/PLAN.md` và chạy `./scripts/auto_log.ps1`.
