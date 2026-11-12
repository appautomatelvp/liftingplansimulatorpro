# ADR-004: Content packs + PhysicsPort

## Status

Accepted

## Context

The product is evolving into a professional 3D lifting **game-sim webapp**. Features (scenarios, equipment, materials, realism) must plug in without growing shared-scope god-files.

## Decision

1. **PhysicsPort** (`src/sim/physics/port.js`) is the only application-facing physics API. Live backend = XPBD. Experimental Rapier remains behind `runtime.flags.experimentalPhysicsWorld` + `loadRapierBackend()`.
2. **Content packs** live under `src/content/`:
   - `scenarios/` — JSON scenario defs + registry
   - `catalog/` — equipment IDs → mesh URL / WLL metadata
   - `materials/` — PBR defs for GFX
3. **Commands** use stable event names (`cmd:snug`, `cmd:trialLift`, `cmd:setDown`, …) on `runtime.events` for UI, scripting, and future replay.
4. **ScenarioRuntime** patches `state` then `rebuild(true)` — does not fork the solver.

## Consequences

- New lift situations = new JSON under `scenarios/`.
- New tools = catalog row + asset under `public/assets/models/`.
- UI must prefer `services` / `CMD` over calling `phy.*` directly.
