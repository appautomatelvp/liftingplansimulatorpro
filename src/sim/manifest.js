/**
 * Single source of truth for sim assemble order (Vite + headless harness).
 * After Phase 2, god-files are replaced by bounded-context parts under subfolders.
 */
export const SIM_PARTS = [
  'state.js',
  'ui-layout.js',
  'audio.js',
  'scene.js',
  'rigging/hook_pool.js',
  'rigging/draw_update.js',
  'cargo/containers_iso.js',
  'cargo/specialty_meshes.js',
  'cargo/shell_rebuild.js',
  'dynamics.js',
  'weather_fx.js',
  'physics/footprint_rig.js',
  'physics/flatrack_payload.js',
  'physics/cables_break.js',
  'physics/hoist_contacts.js',
  'physics/beams_seed.js',
  'physics/step_engine.js',
  'telemetry.js',
  'gear/editor.js',
  'gear/park_apply.js',
  'session/prelift_reset.js',
  'session/ui_units_bom.js',
  'session/presets_events.js',
  'library/core.js',
  'library/parsers.js',
  'library/reconstruction_export.js',
  'compliance.js',
  'plan_wizard.js'
];

/** Headless harness omits UI-layout + plan_wizard (DOM chrome / wizard). */
export const SIM_PARTS_HEADLESS = SIM_PARTS.filter(
  (f) => f !== 'ui-layout.js' && f !== 'plan_wizard.js'
);
