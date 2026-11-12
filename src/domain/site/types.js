/** Site / quay domain vocabulary (pure). */

export function createSiteDefaults(partial = {}) {
  return {
    unitSystem: partial.unitSystem || 'metric',
    groundFriction: partial.groundFriction ?? 0.55,
    windEnabled: partial.windEnabled ?? false
  };
}
