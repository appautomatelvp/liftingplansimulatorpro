// @purpose: Chuẩn hóa dữ liệu telemetry từng nhánh cáp theo node.id/node.name cây phân cấp và công thức góc ngang [0°..90°]
import { assignHierarchicalNames, resolveCableLabel } from './HierarchicalNaming.js';

/**
 * Computes the acute horizontal sling angle (0°..90°) between two 3D anchor endpoints.
 * Strict formula: dy = |top.y - bot.y|, alpha = asin(clamp(dy / length, 0, 1)) in [0, 90].
 */
export function computeHorizontalSlingAngleDeg(topAnchor, bottomAnchor) {
  if (!topAnchor || !bottomAnchor) return 90.0;
  const dx = (Number(topAnchor.x) || 0) - (Number(bottomAnchor.x) || 0);
  const dy = Math.abs((Number(topAnchor.y) || 0) - (Number(bottomAnchor.y) || 0));
  const dz = (Number(topAnchor.z) || 0) - (Number(bottomAnchor.z) || 0);
  const length = Math.hypot(dx, dy, dz);
  if (!(length > 1e-6)) return 90.0;
  const sinAlpha = Math.max(0, Math.min(1, dy / length));
  const alphaDeg = Math.round(Math.asin(sinAlpha) * (180 / Math.PI) * 1e6) / 1e6;
  return Math.max(0, Math.min(90, alphaDeg));
}

function getGearRecord(state, cable) {
  if (!state?.gear || !cable) return null;
  if (cable.role === 'upper') return state.gear.uppers?.[cable.index] || null;
  if (cable.role === 'hanger') return state.gear.hangers?.[cable.index] || null;
  if (cable.role === 'extra') return state.gear.extraCables?.[cable.index] || null;
  return state.gear.legs?.[cable.index] || null;
}

function resolveTierSwl(state, cable, legSwlFn, upperSwlFn) {
  const idx = Number(cable?.index) || 0;
  if (cable?.role === 'upper') {
    if (typeof upperSwlFn === 'function') return Math.max(0.05, Number(upperSwlFn(idx)) || 20);
    return Math.max(0.05, Number(state?.gear?.uppers?.[idx]?.swlT || state?.upperWll || 20));
  }
  if (cable?.role === 'hanger') {
    return Math.max(0.05, Number(state?.gear?.hangers?.[idx]?.swlT || state?.upperWll || 25));
  }
  if (typeof legSwlFn === 'function') return Math.max(0.05, Number(legSwlFn(idx)) || 15);
  return Math.max(0.05, Number(state?.gear?.legs?.[idx]?.swlT || state?.wllPerLeg || 15));
}

function resolveTierTension(phy, cable) {
  const idx = Number(cable?.index) || 0;
  if (cable?.role === 'upper') {
    const t = phy?.upperTensions?.[idx];
    return Number.isFinite(t) ? t : Math.max(0, Number(cable.tensionT) || 0);
  }
  if (cable?.role === 'hanger') {
    const t = phy?.hangerTensions?.[idx];
    return Number.isFinite(t) ? t : Math.max(0, Number(cable.tensionT) || 0);
  }
  if (cable?.role === 'leg') {
    const t = phy?.legTensions?.[idx];
    return Number.isFinite(t) ? t : Math.max(0, Number(cable.tensionT) || 0);
  }
  return Math.max(0, Number(cable?.tensionT) || 0);
}

function resolveTierAngleDeg(phy, cable, attachWorldFn) {
  if (typeof attachWorldFn === 'function' && cable?.a && cable?.b) {
    const A = attachWorldFn(cable.a);
    const B = attachWorldFn(cable.b);
    if (A && B) return computeHorizontalSlingAngleDeg(A, B);
  }
  const idx = Number(cable?.index) || 0;
  let raw = cable?.angleDeg;
  if (!Number.isFinite(raw)) {
    if (cable?.role === 'upper') raw = phy?.upperAngleDeg?.[idx];
    else if (cable?.role === 'hanger') raw = phy?.hangerAngleDeg?.[idx];
    else raw = phy?.legAngleDeg?.[idx];
  }
  if (!Number.isFinite(raw)) return 60.0;
  return Math.max(0, Math.min(90, raw));
}

/**
 * Traverses the hierarchical cable tree (`phy.cables`) and produces unified
 * telemetry snapshots indexed by both `node.id` (`byId`) and `node.name` (`byName`).
 */
export function buildHierarchicalCableSnapshots(phy, state, { attachWorldFn, legSwlFn, upperSwlFn } = {}) {
  const cables = Array.isArray(phy?.cables) ? phy.cables.filter(Boolean) : [];
  if (cables.length && cables.some((c) => !c.hierarchicalName || !c.id)) {
    assignHierarchicalNames(cables);
  }
  const byId = {};
  const byName = {};
  const list = [];

  for (const c of cables) {
    const name = c.hierarchicalName || c.name || resolveCableLabel(c, c.index, state, phy);
    const id = c.id || `${c.role || 'leg'}:${c.index ?? 0}`;
    const rec = getGearRecord(state, c);
    const broken = Boolean(c.broken || rec?.broken);
    const swlT = resolveTierSwl(state, c, legSwlFn, upperSwlFn);
    const tensionT = broken ? 0 : resolveTierTension(phy, c);
    const slack = broken || (c.role === 'leg' && phy?.legSlacks?.[c.index] !== undefined ? Boolean(phy.legSlacks[c.index]) : tensionT <= 0.02);
    const angleDeg = resolveTierAngleDeg(phy, c, attachWorldFn);
    const deltaM = c.role === 'leg' ? (Number(state?.legDeltaL?.[c.index]) || 0) : 0;
    const baseLen = Number(c.L0) || Number(rec?.lengthM) || Number(state?.slingLength) || 4.0;
    const hwStress = c._hardwareStress || null;
    const pctSWL = hwStress && Number.isFinite(hwStress.utilizationPct)
      ? hwStress.utilizationPct
      : (tensionT / Math.max(0.05, swlT)) * 100;

    const snap = {
      id,
      name,
      parentId: c.parentId || null,
      parentName: c.parentName || null,
      tier: c.tier || 1,
      role: c.role || 'leg',
      index: Number(c.index) || 0,
      tensionT,
      angleDeg,
      lengthM: baseLen,
      deltaLM: deltaM,
      swlT,
      pctSWL,
      hardwareStress: hwStress,
      slack,
      broken,
      overloaded: Boolean(hwStress?.isOverloaded || (!broken && tensionT > swlT))
    };
    byId[id] = snap;
    byName[name] = snap;
    list.push(snap);
  }

  return { list, byId, byName };
}

/**
 * Formats identical UI telemetry metrics across BOTH Upper & Lower tiers:
 * e.g. `LP1: 17.8T · 54° · SH(Bow): 75% · L: 8.0m`
 */
export function formatSlingHudLabel({ snapshot, dOpt = {}, lang = 'vi' } = {}) {
  if (!snapshot) return '';
  if (snapshot.broken) {
    return `${snapshot.name}: ${lang === 'en' ? 'PARTED' : 'ĐỨT'}`;
  }
  const parts = [];
  if (dOpt.showForces !== false) {
    parts.push(`${snapshot.name}: ${snapshot.slack ? '0.0T' : `${snapshot.tensionT.toFixed(1)}T`}`);
  } else {
    parts.push(snapshot.name);
  }
  if (dOpt.showSlingAngles !== false) {
    const ang = Math.max(0, Math.min(90, Math.round(snapshot.angleDeg)));
    parts.push(`${ang}°`);
  }
  if (dOpt.showShackleLoads !== false) {
    const hw = snapshot.hardwareStress;
    const prefix = lang === 'en' ? 'SH' : 'MN';
    if (hw && hw.governing) {
      const gov = hw.governing === 'pin' ? 'Pin' : 'Bow';
      parts.push(`${prefix}(${gov}): ${Math.round(hw.utilizationPct || 0)}%`);
    } else {
      parts.push(`${prefix}(Bow): ${Math.round(snapshot.pctSWL || 0)}%`);
    }
  }
  if (dOpt.showSlingLengths !== false) {
    const delta = snapshot.deltaLM || 0;
    const turnStr = Math.abs(delta) > 0.01 ? ` (${delta > 0 ? '+' : ''}${delta.toFixed(2)}m)` : '';
    parts.push(`L: ${snapshot.lengthM.toFixed(1)}m${turnStr}`);
  }
  return parts.join(' · ');
}
