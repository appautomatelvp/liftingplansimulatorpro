# UI layer (Phase 4)

## Goal

Keep `index.html` + CSS as a thin shell. Behaviour belongs in:

| Path | Role |
|------|------|
| `src/ui/controllers` | DOM event wiring, panel open/close orchestration |
| `src/ui/services` | Façade over `runtime.api` (pretension, rebuild, step) |
| `src/app/boot.js` | DI boot, attaches sim bundle |
| `src/sim/session/*` | Legacy UI bindings (strangler — migrate gradually into controllers) |

## Rules

1. New UI features → controllers/services, not `session/*.js` growth when avoidable.
2. Controllers talk to services, not `phy` internals.
3. `ui-layout.js` remains the z-index / exclusion authority until extracted to `src/ui/layout`.
