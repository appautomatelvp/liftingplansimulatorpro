# SafeLift3D Icon Pack

Industrial interface icons for SafeLift3D. Function icons are standalone SVG files with a `64 × 64` viewBox and use this palette:

- Dark background: `#1A232A`
- Industrial blues: `#1D5C8A`, `#0E77B3`
- Safety orange: `#F26522`
- Gold: `#FFB800`, `#E5A93B`
- Safety green: `#28A745`

## Branding

- `branding/main-logo.svg` displays the exact SafeLift3D lockup artwork supplied by the product owner (PNG source in `public/brand/safelift3d-lockup.png`). It is an SVG wrapper around the approved artwork so the supplied logo is not redrawn.
- `branding/app-icon.png` is the rounded application icon cropped from the supplied reference sheet.
- `branding/favicon.ico` contains 16, 32, and 48 pixel PNG-backed ICO frames.

## Equipment

`equipment/crane.svg`, `hook.svg`, `shackle.svg`, `sling-chain.svg`, and `spreader-bar.svg`.

## Physics and calculation

`physics-calculation/center-of-gravity.svg`, `load-tension.svg`, `rigging-angle.svg`, `cae-fem.svg`, and `collision-check.svg`.

## Operations and system

`operations-system/3d-viewer.svg`, `digital-twin.svg`, `simulation.svg`, `lift-plan.svg`, `safety-check.svg`, `reports.svg`, and `settings.svg`.

Use SVGs as external images for toolbar/dashboard displays, or inline them when CSS tinting and interaction are needed. Keep the logo artwork unchanged when generating alternate sizes.
