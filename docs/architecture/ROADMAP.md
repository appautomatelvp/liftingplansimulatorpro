# Product roadmap (Phase C+ hooks)

Extension rule: **content + command + optional physics plugin** — never append to god-file shims (ADR-002 / ADR-004).

## C1 — Tình huống nâng hạ

- Add scenario JSON under [`src/content/scenarios/`](../../src/content/scenarios/)
- Register in `scenarios/index.js`
- Load via `runtime.scenarios.load(id)` or `cmd:loadScenario`
- Win conditions already on schema (`winConditions`)

## C2 — Dụng cụ / equipment

- Add row to [`src/content/catalog/equipment.json`](../../src/content/catalog/equipment.json)
- Drop GLB/OBJ into `public/assets/models/`
- Wire mesh id through library/gear gradually (bridge catalog → sim)

## C3 — Materials / 3D design refresh

- Edit [`src/content/materials/pbr_defs.json`](../../src/content/materials/pbr_defs.json)
- Use `applyMaterialDef` from GFX/PBR paths
- Prefer AssetPipeline / HullOptimizer for CAD imports

## C4 — Vật lý thực tế hơn

1. Improve XPBD (contacts, cable, set-down) first — live path
2. When multi-body WASM needed: implement alternate backend behind PhysicsPort + ADR
3. Do not dual-step XPBD and Rapier in one frame

## C5 — Thin UI shell

- Split `index.html` drawer tabs into `src/ui/screens/*` templates
- Controllers own DOM; session keeps legacy until migrated
- Keep `ui-layout.js` as z-index authority until moved to `src/ui/layout`

## C6 — Save / replay

- Record `cmd:*` + telemetry snapshots on event bus
- Existing REC dock becomes consumer of the same timeline format

## Deploy (ongoing)

See README — GitHub Actions → `dist` → Vercel + Cloudflare Pages. Assets stay in `public/` only.
