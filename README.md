# Lifting Plan Simulator Pro

Professional 3D lifting **game-sim webapp** (static SPA). Vite build → `dist`. Deploy to **Vercel** and/or **Cloudflare Pages** from GitHub.

## Architecture (extensible)

| Layer | Path | Role |
|-------|------|------|
| Boot / DI | `src/app/` | `bootApp`, runtime, command bus, scenario runtime |
| Content | `src/content/` | Scenarios, equipment catalog, PBR materials (data-driven) |
| Domain | `src/domain/` | Pure cargo/rigging/crane/site + standards façade |
| Physics port | `src/sim/physics/port.js` | App-facing XPBD API (`step`, snug, trial lift, set-down) |
| Sim parts | `src/sim/` + `manifest.js` | Assembled shared-scope XPBD / scene / session |
| UI | `src/ui/` | Controllers + services over commands/port |
| Assets | `public/assets/` | Models / textures only (no root dumps) |

Docs: [`docs/architecture/`](docs/architecture/) — ADRs, [`ROADMAP.md`](docs/architecture/ROADMAP.md), performance budgets.  
CI: `npm run ci` (= architecture gate + vitest + build).

### Extending later

- New lift situation → JSON in `src/content/scenarios/` + register in `scenarios/index.js`
- New tool → row in `src/content/catalog/equipment.json` + file under `public/assets/models/`
- New material → `src/content/materials/pbr_defs.json`
- Do **not** grow god-file shims (`physics.js`, `session.js`, …) — ADR-002 / ADR-004

## UI shell

- `index.html` — drawer / dock / HUD (to be thinned over time — ROADMAP C5)
- Bottom dock: Nhớm cáp, Nhấc thử, Hạ đất, Reset, REC, crane controls
- Layout exclusion: `src/sim/ui-layout.js`

## Local

```bash
npm install
npm run dev
```

```bash
npm run build
npm run preview
```

```bash
npm test
npm run test:ui   # Playwright
npm run ci
```

## Deploy (GitHub → Vercel + Cloudflare)

**Artifact:** `npm run build` → `dist/` (same for both hosts).

### Vercel

- Import the GitHub repo (or use existing [`vercel.json`](vercel.json))
- Build: `npm run build` · Output: `dist` · Node 24.x

### Cloudflare Pages

- Connect the same GitHub repo
- Build: `npm run build` · Output: `dist`
- Config also in [`wrangler.toml`](wrangler.toml) (`pages_build_output_dir = "dist"`)

### GitHub Actions

[`.github/workflows/ci.yml`](.github/workflows/ci.yml) runs architecture gate, unit tests, and production build on push/PR.

**Assets:** keep 3D under `public/assets/` only (~40 MB today). If near host limits, move HDR/textures to a CDN later — do not reintroduce a root `3Dmodels/` dump.
