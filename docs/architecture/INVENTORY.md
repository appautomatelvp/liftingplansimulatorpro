# Architecture Inventory (Phase 0 Baseline)

Generated as the freeze baseline for the strangler-fig restructure.

## Runtime entry

| Path | Role |
|------|------|
| [src/main.js](../../src/main.js) | Vite entry: CSS + `virtual:lifting-sim` + CAE/GFX globals |
| [vite.config.js](../../vite.config.js) | Concatenates `src/sim/*.js` into one shared scope |
| [index.html](../../index.html) | UI shell (drawer, dock, HUD) |

## Live simulator monolith (`src/sim`, ~30k LOC)

Assembled in order by `virtual:lifting-sim` / `test/sim_test_harness.js`:

| File | ~LOC | Primary responsibility |
|------|------|------------------------|
| state.js | 500 | `state`, `phy`, scene globals, `bootSimulator` |
| ui-layout.js | 212 | Panel exclusion / z-index |
| audio.js | 600 | SFX |
| scene.js | 1.6k | Three.js world, lights, cranes |
| rigging.js | 3.7k | Sling drawing, rope paths, shackles |
| cargo.js | 4.0k | Cargo meshes, CoG, pad-eyes, flatrack |
| dynamics.js | 660 | Hoist rope dynamics helpers |
| physics.js | 6.5k | XPBD/cables, contacts, hoist, step loop |
| telemetry.js | 0.9k | HUD / scene update |
| gear.js | 2.3k | Gear editor, parkHookSlack |
| session.js | 4.8k | Controls, Nhớm/Nhấc/Hạ, i18n, reset |
| library.js | 3.2k | Asset library / CAD import / render loop |
| compliance.js | 0.5k | Lift plan / audit UI bridge |
| plan_wizard.js | 0.6k | Guided plan wizard |

## Parallel libraries (partially used)

| Area | Path | Status |
|------|------|--------|
| CAE barrel | `src/core/index.js` | Live exports; sim uses subset via `window.CAE` |
| Standards | `src/core/standards/*` | Used via `resolveSling`, sling specs |
| Assets | AssetPipeline, HullOptimizer, AssemblyEngine | Used from `library.js` |
| Physics world | `src/core/physics-world/*` | **Not wired** into live step loop |
| Rapier/Cannon backends | same | **Experimental / unused** by UI sim |
| SimulationEngine | `src/core/SimulationEngine.js` | **Unused** by boot path |
| PhysicalCableSolver | `src/core/PhysicalCableSolver.js` | **Unused** by boot path |
| New rigging pkg | `src/rigging/*` | Partial; imported as `window.RIG` |
| Graphics | `src/graphics/*` | Used (PBR / env / renderer) |

## Critical coupling

1. **Shared lexical scope** — sim files are not ES modules; free variables (`state`, `phy`, `scene`, …) cross file boundaries.
2. **Dual physics** — live XPBD in `src/sim/physics.js` vs unused `PhysicsWorldManager`.
3. **Globals** — `window.CAE`, `window.GFX`, `window.RIG`, many `window.*` helpers for UI/tests.
4. **Test harness mirrors concat** — [test/sim_test_harness.js](../../test/sim_test_harness.js).

## Invariants (must not break during migration)

- Nhớm cáp / Nhấc thử / Hạ đất / Kéo-Hạ dock semantics
- Cargo seating flush on quay after set-down
- Spreader must not tunnel cargo roof
- Vitest headless harness still boots
- Vite `npm run build` succeeds
