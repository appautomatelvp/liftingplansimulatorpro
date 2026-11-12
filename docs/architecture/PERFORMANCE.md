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

## Dead code policy

| Module | Action |
|--------|--------|
| `src/core/physics-world/*` | Quarantined — keep for experiments |
| `PhysicalCableSolver` / `SimulationEngine` | Not on boot path; keep exported for tests |
| Legacy god-file shims | Thin comments only; delete content already moved |
