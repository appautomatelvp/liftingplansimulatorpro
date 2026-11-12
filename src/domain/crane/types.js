/** Crane domain vocabulary (pure). */

export const CRANE_TYPES = Object.freeze([
  'hook_only',
  'mobile_telescopic',
  'crawler',
  'gantry'
]);

export function createCraneSelection(partial = {}) {
  return {
    craneType: partial.craneType || 'hook_only',
    hookCount: partial.hookCount ?? 1,
    hoistSpeedScale: partial.hoistSpeedScale ?? 1
  };
}
