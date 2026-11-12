# ADR-001: Strangler-fig restructure (no big-bang rewrite)

## Status

Accepted

## Context

The live simulator is a ~30k LOC shared-scope bundle. A parallel “modern” tree under `src/core/physics-world` exists but is not the live step loop. A rewrite would freeze features and risk regressions in safety-critical lift semantics.

## Decision

Migrate with a **strangler-fig**:

1. Keep behaviour as the contract (characterization tests).
2. Split god-files into ordered parts while concat still works.
3. Introduce `src/app` + `src/shared` + `src/domain` facades.
4. Replace concat with real ES modules only after parts have explicit `install(runtime)` boundaries.
5. Wire or quarantine unused core physics — never leave two silent live solvers.

## Consequences

- Longer calendar time, lower risk.
- Temporary dual folder layouts (`src/sim/physics.js` shims → `src/sim/physics/*.js`).
- Docs and CI must block new code from growing the monolith.
