# Architecture contribution rules

## Freeze (ADR-002)

Do **not** append new feature logic to legacy god-files:

- `src/sim/physics.js` (shim only after Phase 2)
- `src/sim/session.js`
- `src/sim/cargo.js`
- `src/sim/library.js`
- `src/sim/gear.js`
- `src/sim/rigging.js`

Add code under the matching bounded folder (`src/sim/physics/…`, `src/domain/…`, `src/app/…`, `src/ui/…`).

## Assemble order

`src/sim/manifest.js` is the single source of truth for sim part order. Update it when adding or renaming parts. Vite and the headless test harness both read this manifest.

## Layers

See [TARGET.md](./TARGET.md). UI must not call physics internals directly — go through app services / runtime API.

## Dual physics

Live solver = XPBD path under `src/sim/physics/`. `src/core/physics-world/*` is quarantined experimental (see ADR-003). Do not wire a second live step loop without an ADR.
