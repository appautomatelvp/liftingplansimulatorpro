# QUARANTINE — experimental physics backends

**Status:** Not wired into the live UI step loop (see ADR-003).

Live dynamics: `src/sim/physics/*` (XPBD).

This folder (`PhysicsWorldManager`, Rapier/Cannon backends, FixedStepLoop) is kept for:

- Isolated unit experiments
- Future optional dual-solver feature flag (`runtime.flags.experimentalPhysicsWorld`)

Do **not** instantiate from `bootSimulator` / `attachSimBundle` without an ADR update.
