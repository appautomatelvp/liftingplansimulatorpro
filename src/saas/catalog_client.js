import { collection, getDocs, limit, orderBy, query } from 'firebase/firestore';

export const CATALOG_QUERY_LIMIT = 50;

const VALID_EQUIPMENT_CATEGORIES = new Set([
  'hook', 'sling', 'chain', 'shackle', 'spreader', 'lifting_beam', 'crane', 'other'
]);

const KIND_TO_EQUIPMENT_CATEGORY = {
  beam: 'lifting_beam',
  sling: 'sling',
  hardware: 'shackle',
  cargo: 'other'
};

let catalogCache = null;

function resolveTierBucket(profile) {
  if (!profile) return 'free';
  if (profile.role === 'admin' || profile.tier === 'premium') return 'premium';
  return 'free';
}

export function canAccessCatalogTier(itemTier, profile) {
  if (itemTier === 'premium') return resolveTierBucket(profile) === 'premium';
  return itemTier === 'free' || !itemTier;
}

export function filterCatalogItems(items = [], profile = null) {
  if (!Array.isArray(items)) return [];
  return items.filter((item) => item && item.enabled === true && canAccessCatalogTier(item.tier, profile));
}

export function clearCatalogCache() {
  catalogCache = null;
}

export function mapCatalogItemToEquipmentInput(item = {}) {
  const rawCategory = String(item.category || '').trim().toLowerCase();
  const category = VALID_EQUIPMENT_CATEGORIES.has(rawCategory)
    ? rawCategory
    : (KIND_TO_EQUIPMENT_CATEGORY[String(item.kind || '').trim().toLowerCase()] || 'other');
  const title = String(item.title || item.id || '').trim();
  return {
    name: title.slice(0, 80) || 'Catalog Equipment',
    category,
    manufacturer: 'SafeLift3D Catalog',
    model: String(item.id || '').trim().slice(0, 80),
    wllT: item.wllT ?? null,
    lengthM: null,
    massKg: item.massKg ?? null,
    safetyFactor: null,
    certificateNo: '',
    inspectionExpiry: '',
    notes: String(item.notes || '').trim().slice(0, 500)
  };
}

export async function loadCatalogForUser(db, profile = null, deps = {}) {
  if (!db) return [];
  const tierBucket = resolveTierBucket(profile);
  const {
    collectionFn = collection,
    queryFn = query,
    orderByFn = orderBy,
    limitFn = limit,
    getDocsFn = getDocs,
    forceRefresh = false
  } = deps;

  if (!forceRefresh && catalogCache && catalogCache.db === db && catalogCache.tierBucket === tierBucket) {
    return catalogCache.items;
  }

  try {
    const ref = collectionFn(db, 'catalog');
    const q = queryFn(ref, orderByFn('updatedAt', 'desc'), limitFn(CATALOG_QUERY_LIMIT));
    const snapshot = await getDocsFn(q);
    const rawItems = snapshot.docs.map((entry) => ({ id: entry.id, ...entry.data() }));
    const filtered = filterCatalogItems(rawItems, profile);
    catalogCache = { db, tierBucket, items: filtered };
    return filtered;
  } catch (error) {
    console.warn('[SafeLift3D] Catalog load fell back to empty list', error);
    return [];
  }
}
