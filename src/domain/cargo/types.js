/** Cargo domain vocabulary (pure). */

export const CARGO_TYPES = Object.freeze([
  'flatrack',
  'opentop',
  'dry',
  'reefer',
  'tank',
  'custom'
]);

export function createCargoIdentity(partial = {}) {
  return {
    cargoType: partial.cargoType || 'flatrack',
    L: partial.L ?? 12.192,
    W: partial.W ?? 2.438,
    H: partial.H ?? 2.591,
    weight: partial.weight ?? 22,
    isoCode: partial.isoCode || null,
    tareT: partial.tareT ?? null,
    maxGrossT: partial.maxGrossT ?? null
  };
}
