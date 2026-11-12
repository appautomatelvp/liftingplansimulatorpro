import defs from './pbr_defs.json';

const BY_ID = Object.freeze(
  Object.fromEntries((defs.materials || []).map((m) => [m.id, m]))
);

export function listMaterials() {
  return (defs.materials || []).slice();
}

export function getMaterial(id) {
  return BY_ID[id] || null;
}

/**
 * Apply a content material def onto a THREE.MeshPhysicalMaterial-like target.
 * Does not import three — caller passes material instance.
 */
export function applyMaterialDef(threeMaterial, defOrId) {
  const def = typeof defOrId === 'string' ? getMaterial(defOrId) : defOrId;
  if (!threeMaterial || !def) return threeMaterial;
  if (def.color && threeMaterial.color?.setStyle) threeMaterial.color.setStyle(def.color);
  if (typeof def.metalness === 'number') threeMaterial.metalness = def.metalness;
  if (typeof def.roughness === 'number') threeMaterial.roughness = def.roughness;
  if (typeof def.clearcoat === 'number' && 'clearcoat' in threeMaterial) {
    threeMaterial.clearcoat = def.clearcoat;
  }
  threeMaterial.needsUpdate = true;
  return threeMaterial;
}
