# Strangler migration status

| Phase | Status | Deliverables |
|-------|--------|--------------|
| 0 Baseline | Done | Inventory, ADRs, characterization tests, freeze rule |
| 1 ESM + DI boot | Done | `src/app/boot.js`, `createRuntime`, `virtual:lifting-sim` → `attachSimBundle`, manifest-driven assemble |
| 2 Split god-files | Done | `physics/`, `session/`, `cargo/`, `gear/`, `library/`, `rigging/` parts; shims frozen |
| 3 Domain + core | Done | `src/domain/*`, standards façade, physics-world quarantine (ADR-003) |
| 4 App UI | Done | `src/ui/controllers`, `src/ui/services`, UI_LAYER.md |
| 5 Quality | Done | Architecture gate, CI workflow, jsconfig paths, arch tests |
| 6 Hardening | Done | Performance budgets, Rapier lazy-only, dead-code deprecations |
| Game-sim A–C | Done | Junk cleanup; PhysicsPort + CMD bus; content/scenarios/catalog/materials; ADR-004; ROADMAP; deploy docs |

## Invariants preserved

- Headless harness + Vitest suite green
- `npm run build` succeeds
- Live solver remains XPBD under `src/sim/physics`
- Prototype HTML / root `3Dmodels` removed — primary deploy target = Cloudflare Pages (`wrangler.toml`)

