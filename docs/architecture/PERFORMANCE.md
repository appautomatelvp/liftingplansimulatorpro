# Performance budgets (Phase 6)

| Metric | Budget | Notes |
|--------|--------|-------|
| Vite production bundle (main chunk) | ≤ 1200 kB warn (vite `chunkSizeWarningLimit`) | Prefer code-split UI later |
| Headless `stepPhysicsEngine` × 60 | ≤ 2.5 s on CI ubuntu | Characterization can assert soft bound |
| Asset GLB decode (primary cargo) | Prefer Draco/optimized hull via AssetPipeline | See AssetPipeline |
| Draw calls (typical plan) | Prefer instanced/sling pool reuse | `sling3DPool` |

## Asset pipeline cleanup

- CAD imports go through `CAE.AssetPipeline` / `HullOptimizer` from `library/*`.
- Avoid duplicating parsers outside `src/sim/library/parsers.js`.
- Quarantined physics WASM (Rapier) must not load on default boot.

## Baseline & On-Demand CAD (13/11/2026 — S-07)

- **Rapier WASM (`4,336.69 kB` chunk):** đã tách riêng qua `loadRapierBackend()` (`import('./RapierBackend.js')`), `0` request trên boot mặc định.
- **Auth landing (`vite preview`):** `722 ms` tới màn đăng nhập, `21` requests (`2.91 MB` header bytes), `0` model, `0` Rapier.
- **Simulator boot (`VITE_AUTH_DEV_BYPASS=true`, Chromium):**
  - Trước S-07: `55` model requests (**35,541,005 bytes ≈ 35.5 MB**), `SIM_READY_MS: 7,667 ms`.
  - Sau S-07 (chỉ nạp model của `cargoType`/`beamType` đang chọn, model khác nạp theo nhu cầu): `5` model requests (**544,761 bytes ≈ 0.54 MB**, giảm **98.5%**), `SIM_READY_MS: 7,401 ms`.
- **HTTP Caching (`public/_headers`):** `/assets/*` dùng `public, max-age=31536000, immutable`; `/assets/models/*` dùng `public, max-age=86400`.

## Dead code policy

| Module | Action |
|--------|--------|
| `src/core/physics-world/*` | Quarantined — keep for experiments |
| `PhysicalCableSolver` / `SimulationEngine` | Not on boot path; keep exported for tests |
| Legacy god-file shims | Thin comments only; delete content already moved |
