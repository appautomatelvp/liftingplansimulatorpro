// @purpose: Danh mục Asset 3D & Tính năng CMS, đồng bộ realtime system_config/feature_locks với 3 trạng thái Active / Tier Locked / Under Upgrade
import { doc, getDoc, onSnapshot, serverTimestamp, setDoc } from 'firebase/firestore';
import { hasProAccess } from './trial_access.js';

export const LOCK_STATES = Object.freeze({
  ACTIVE: 'active',
  TIER_LOCKED: 'tier_locked',
  UPGRADING: 'upgrading'
});

export const VALID_LOCK_STATES = new Set(Object.values(LOCK_STATES));

export const CMS_LOCK_ITEMS = Object.freeze([
  { id: 'cargo_crate_oog', group: 'asset', label: 'OOG Wooden Crate', selector: '#cargo-library [data-cargo="crate"]', featureId: 'cargo.oog', defaultState: LOCK_STATES.TIER_LOCKED },
  { id: 'cargo_oog_transformer', group: 'asset', label: 'OOG Transformer Cargo', selector: '#cargo-library [data-cargo="transformer"]', featureId: 'cargo.specialized', defaultState: LOCK_STATES.TIER_LOCKED },
  { id: 'cargo_specialized', group: 'asset', label: 'Vessel / Nacelle / Specialty Cargo', selector: '#cargo-library [data-cargo="vessel"], #cargo-library [data-cargo="wind_nacelle"], #cargo-library [data-cargo="excavator"], #cargo-library [data-cargo="boat"], #cargo-library [data-cargo="pipe"]', featureId: 'cargo.specialized', defaultState: LOCK_STATES.TIER_LOCKED },
  { id: 'spreader_modular', group: 'asset', label: 'Modular Spreader Beam', selector: '#beam-store [data-beam="spreader"]', featureId: null, defaultState: LOCK_STATES.ACTIVE },
  { id: 'lifting_beam', group: 'asset', label: 'Lifting Beam', selector: '#beam-store [data-beam="lifting_beam"]', featureId: null, defaultState: LOCK_STATES.ACTIVE },
  { id: 'beam_h_frame', group: 'asset', label: 'H-Beam Frame Spreader', selector: '#beam-store [data-beam="frame"]', featureId: 'beam.frame', defaultState: LOCK_STATES.TIER_LOCKED },
  { id: 'beam_sts_container', group: 'asset', label: 'STS Container Spreader', selector: '#beam-store [data-beam="container_spreader"]', featureId: 'beam.container', defaultState: LOCK_STATES.TIER_LOCKED },
  { id: 'crane_mobile_crawler', group: 'asset', label: 'Mobile & Crawler Cranes', selector: '#crane-store [data-crane="mobile_telescopic"], #crane-store [data-crane="crawler"]', featureId: null, defaultState: LOCK_STATES.ACTIVE },
  { id: 'crane_sts_gantry', group: 'asset', label: 'STS / Gantry Crane', selector: '#crane-store [data-crane="gantry"]', featureId: null, defaultState: LOCK_STATES.ACTIVE },
  { id: 'windSimulation', group: 'feature', label: 'Wind Simulation & Dynamic Sway', selector: '#rng-wind-speed', featureId: 'wind.simulation', defaultState: LOCK_STATES.ACTIVE },
  { id: 'riskAssessmentGenerator', group: 'feature', label: 'JSA / HSE Risk Assessment & PDF', selector: '#btn-comp-hud-export, #btn-liftplan-print', featureId: 'risk.assessment', defaultState: LOCK_STATES.ACTIVE }
]);

export function defaultFeatureLocksMap() {
  const locks = {};
  for (const item of CMS_LOCK_ITEMS) {
    locks[item.id] = item.defaultState;
  }
  return locks;
}

export function normalizeFeatureLocksDoc(raw) {
  const base = defaultFeatureLocksMap();
  const srcLocks = raw && typeof raw === 'object' && raw.locks && typeof raw.locks === 'object' ? raw.locks : {};
  for (const item of CMS_LOCK_ITEMS) {
    const candidate = String(srcLocks[item.id] || '').trim().toLowerCase();
    if (VALID_LOCK_STATES.has(candidate)) {
      base[item.id] = candidate;
    }
  }
  return {
    locks: base,
    updatedBy: String(raw?.updatedBy || ''),
    updatedAt: raw?.updatedAt || null
  };
}

export function evaluateItemLockState({ itemId, profile = null, featureLocks = null, nowMs = Date.now() }) {
  const normalized = normalizeFeatureLocksDoc(featureLocks);
  const configuredState = normalized.locks[itemId] || LOCK_STATES.ACTIVE;
  if (configuredState === LOCK_STATES.UPGRADING) {
    return {
      itemId,
      configuredState,
      state: LOCK_STATES.UPGRADING,
      allowed: false,
      reason: 'upgrading'
    };
  }
  if (configuredState === LOCK_STATES.TIER_LOCKED) {
    if (hasProAccess(profile, nowMs)) {
      return { itemId, configuredState, state: LOCK_STATES.ACTIVE, allowed: true, reason: 'ok' };
    }
    return { itemId, configuredState, state: LOCK_STATES.TIER_LOCKED, allowed: false, reason: 'tier_locked' };
  }
  return { itemId, configuredState, state: LOCK_STATES.ACTIVE, allowed: true, reason: 'ok' };
}

export function findCmsItemByFeatureId(featureId) {
  return CMS_LOCK_ITEMS.find((item) => item.featureId === featureId) || null;
}

export function subscribeFeatureLocks(db, onChange, onError) {
  if (!db) {
    onChange?.(normalizeFeatureLocksDoc({}));
    return () => {};
  }
  const ref = doc(db, 'system_config', 'feature_locks');
  return onSnapshot(
    ref,
    (snap) => {
      onChange?.(normalizeFeatureLocksDoc(snap.exists() ? snap.data() : {}));
    },
    (err) => {
      console.error('❌ [CMS - subscribeFeatureLocks]: Lỗi lắng nghe system_config/feature_locks', err);
      onError?.(err);
    }
  );
}

export async function readFeatureLocks(db) {
  if (!db) return normalizeFeatureLocksDoc({});
  try {
    const snap = await getDoc(doc(db, 'system_config', 'feature_locks'));
    return normalizeFeatureLocksDoc(snap.exists() ? snap.data() : {});
  } catch (err) {
    console.error('❌ [CMS - readFeatureLocks]: Không đọc được system_config/feature_locks', err);
    return normalizeFeatureLocksDoc({});
  }
}

export async function saveFeatureLocks(db, adminUid, nextLocksDoc) {
  const normalized = normalizeFeatureLocksDoc(nextLocksDoc);
  const payload = {
    locks: normalized.locks,
    updatedBy: String(adminUid || 'admin'),
    updatedAt: serverTimestamp()
  };
  await setDoc(doc(db, 'system_config', 'feature_locks'), payload);
  return { ...normalized, updatedBy: payload.updatedBy };
}
