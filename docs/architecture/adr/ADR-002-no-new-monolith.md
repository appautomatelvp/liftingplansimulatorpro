# ADR-002: Freeze — no new logic in god-files

## Status

Accepted

## Context

`physics.js`, `session.js`, `cargo.js`, `library.js`, `rigging.js`, and `gear.js` already exceed maintainable size.

## Decision

**Freeze rule:** new features and bugfixes must land in a bounded module under:

- `src/sim/<area>/…` (split parts), or
- `src/domain/…`, `src/app/…`, `src/ui/…`, `src/shared/…`

Do **not** append substantial new logic to the legacy monolith files except thin re-exports / wiring.

Allowed in god-files during transition:

- One-line re-exports
- `install(runtime)` wrappers
- Bugfix hotspots that will be moved in the same PR when practical

## Consequences

- PRs that only grow `physics.js` / `session.js` should be rejected in review.
- Manifest in `src/sim/manifest.js` is the source of assemble order.
