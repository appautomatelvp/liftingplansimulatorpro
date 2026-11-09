# Lifting Plan Simulator Pro

Static 3D lifting-plan simulator. The site is built with Vite and can be hosted on Vercel, Cloudflare Pages, or Firebase Hosting.

## Layout

- `index.html` — page shell
- `src/main.js` — app entry
- `src/styles/app.css` — layout and Tailwind
- `src/sim/` — simulator modules, assembled into one scope at build time
  - `state.js` — configuration, physics state, startup
  - `scene.js` — scene, world, cranes
  - `rigging.js` — hook, slings, rope clearance
  - `cargo.js` — cargo meshes and pad-eyes
  - `physics.js` — rigid bodies, cables, contact
  - `telemetry.js` — scene update and readouts
  - `gear.js` — gear editor and 3D dragging
  - `session.js` — language, panels, reset
  - `library.js` — 3D library, file import, render loop

## Local

```bash
npm install
npm run dev
```

Production build:

```bash
npm run build
npm run preview
```

The build output is the `dist` folder.

## Deploy

Vercel: import the GitHub repository. The build command is `npm run build` and the output is `dist`.

Cloudflare Pages: build command `npm run build`, output directory `dist`.

Firebase Hosting:

```bash
npm run build
npx firebase deploy --only hosting
```
