/** Rigging domain vocabulary (pure). */

export const BEAM_TYPES = Object.freeze([
  'spreader',
  'lifting_beam',
  'cascaded',
  'frame',
  'modular_truss',
  'basket',
  'container_spreader',
  'none'
]);

export const SLING_TYPES = Object.freeze(['wire', 'chain', 'web']);

export function createRiggingSelection(partial = {}) {
  return {
    beamType: partial.beamType || 'spreader',
    slingType: partial.slingType || 'chain',
    hwType: partial.hwType || 'bow_shackle',
    slingLength: partial.slingLength ?? 8,
    upperSlingLength: partial.upperSlingLength ?? 8,
    lowerSlingLength: partial.lowerSlingLength ?? 2
  };
}
