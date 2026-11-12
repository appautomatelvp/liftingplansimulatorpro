# ADR-003: Quarantine unused PhysicsWorld / Rapier path

## Status

Accepted

## Context

`src/core/physics-world/*` (PhysicsWorldManager, RapierBackend, CannonBackend) and `PhysicalCableSolver` / `SimulationEngine` are exported from CAE but are **not** the live UI step loop. Live dynamics run in `src/sim/physics/*` (XPBD).

## Decision

1. Mark `src/core/physics-world` as **experimental / quarantined**.
2. Live boot must not instantiate `PhysicsWorldManager` unless an explicit feature flag and ADR enable it.
3. Domain standards (`src/domain/standards` → `src/core/standards`) remain the shared rules layer for both paths.
4. Delete or wire intentionally in Phase 6 hardening — until then, keep behind quarantine docs and optional `CAE.__experimental`.

## Consequences

- No silent dual solvers.
- Experimental backends remain available for unit tests that import them explicitly.
