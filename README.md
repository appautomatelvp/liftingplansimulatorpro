# SafeLift3D

Professional 3D lifting **game-sim webapp** (static SPA). Brand: **SafeLift3D**. The public production URL will use `safelift3d.com` after the domain is registered and connected.

Vite build → `dist`. Production hosting and automatic deployments use **Cloudflare Pages connected to GitHub**.

## Architecture (extensible)

| Layer | Path | Role |
|-------|------|------|
| Boot / DI | `src/app/` | `bootApp`, runtime, command bus, scenario runtime |
| SaaS shell | `src/saas/`, `src/i18n/` | Branding, localization, Firebase Auth/App Check, entitlements and admin CMS |
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
- Language: EN ↔ VI via top-bar toggle (`src/i18n`)

## SaaS setup (Phases 2–4)

Authentication is fail-closed: the simulator does not boot until Firebase confirms an active user. Set the Firebase **web app** configuration in `.env.local` using `.env.example` as a template. These web configuration values are public identifiers, not server credentials; never put a service-account key in Vite variables.

In Firebase Console:

1. Enable **Email/Password** and **Google** under Authentication → Sign-in method; keep other providers disabled.
2. Add `localhost` and the deployed SafeLift3D domains under Authentication → Settings → Authorized domains.
3. Create a Cloud Firestore database, then deploy the repository rules with `firebase deploy --only firestore:rules`.
4. Register a reCAPTCHA Enterprise score-based key for the production domains, register the web app under Firebase App Check → Fraud Defense, and set its public site key as `VITE_FIREBASE_APPCHECK_SITE_KEY`. Start in monitoring mode, confirm valid traffic, then enforce App Check for Cloud Firestore. For local development, allowlist a Firebase App Check debug token; never use the debug provider in a production deployment.
5. Create the first account through the app, then set that document's `role` to `admin` in the Firebase Console. The browser CMS deliberately cannot grant the admin role.

The initial account schema is `{ uid, email, displayName, role, tier, createdAt, lastLogin, status }`. New accounts are created as `role: user`, `tier: free`, and `status: active`. The admin CMS can change tier and status only. Firestore rules prevent clients from changing their own role, tier, or status; an admin role is provisioned out-of-band.

Free access includes standard cargo, the modular spreader beam, the lifting beam, core rigging controls, crane setup, and jobsite tools. OOG cargo, specialized cargo, and advanced spreader variants require Premium. The equalizer beam is listed as an upcoming module and cannot activate unsupported physics.

For local visual work before a Firebase project is available, `VITE_AUTH_DEV_BYPASS=true` explicitly opens the workspace as a local Free user in Vite development only. Production builds ignore this bypass. Do not enable it for a shared or deployed development environment.

## Deploy (GitHub → Cloudflare Pages)

Cloudflare Pages Git integration builds the production branch on every push and creates preview deployments for other branches. Connect `appautomatelvp/liftingplansimulatorpro` in Cloudflare → Workers & Pages → Create application → Pages → Connect to Git.

Build settings:

- Production branch: `master`
- Root directory: `/`
- Build command: `npm run build`
- Build output directory: `dist`
- Node.js version: `24`

Add the Firebase web configuration as Pages environment variables for **Production** and **Preview**: `VITE_FIREBASE_API_KEY`, `VITE_FIREBASE_AUTH_DOMAIN`, `VITE_FIREBASE_PROJECT_ID`, `VITE_FIREBASE_APP_ID`, `VITE_FIREBASE_MESSAGING_SENDER_ID`, `VITE_FIREBASE_STORAGE_BUCKET`, and `VITE_FIREBASE_APPCHECK_SITE_KEY`. Set `VITE_FIREBASE_APPCHECK_DEBUG=false` and `VITE_AUTH_DEV_BYPASS=false`. These values are used by the browser app; never upload `.env.local`, a service-account key, or other private credentials.

After the first successful Pages deployment, add its production `*.pages.dev` hostname to Firebase Authentication → Authorized domains. When `safelift3d.com` is purchased, attach it under Pages → Custom domains, then add `safelift3d.com` and `www.safelift3d.com` to Firebase Authentication and App Check. DNS will be managed in Cloudflare.

## Local

```bash
npm install
npm run dev
```

```bash
npm run build
npm test
```
