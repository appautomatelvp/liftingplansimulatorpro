import equipment from './equipment.json';

const BY_ID = Object.freeze(
  Object.fromEntries((equipment.items || []).map((item) => [item.id, item]))
);

export function listEquipment(kind) {
  const items = equipment.items || [];
  if (!kind) return items.slice();
  return items.filter((i) => i.kind === kind);
}

export function getEquipment(id) {
  return BY_ID[id] || null;
}

export function getCatalogVersion() {
  return equipment.version || 1;
}
