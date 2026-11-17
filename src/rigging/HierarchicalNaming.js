// @purpose: Thuật toán đệ quy đặt tên cáp & phụ kiện theo Cây Phân Cấp (LP1 -> LP11, LP12 -> LP111...) truy xuất nguồn gốc lực

function getEndpointBodyId(ep) {
  if (!ep) return null;
  if (ep.kind === 'body' && ep.id) return String(ep.id);
  if (ep.body && ep.body.id) return String(ep.body.id);
  return null;
}

function getEndpointLocalXYZ(ep) {
  if (!ep || !ep.local) return [0, 0, 0];
  if (Array.isArray(ep.local)) {
    return [Number(ep.local[0]) || 0, Number(ep.local[1]) || 0, Number(ep.local[2]) || 0];
  }
  return [Number(ep.local.x) || 0, Number(ep.local.y) || 0, Number(ep.local.z) || 0];
}

function isHookEndpoint(ep) {
  return Boolean(ep && (ep.kind === 'hook' || ep.kind === 'hook2'));
}

function xzDistanceSq(epA, epB) {
  const a = getEndpointLocalXYZ(epA);
  const b = getEndpointLocalXYZ(epB);
  const dx = a[0] - b[0];
  const dz = a[2] - b[2];
  return dx * dx + dz * dz;
}

function rolePriority(role) {
  if (role === 'upper') return 0;
  if (role === 'hanger') return 1;
  if (role === 'leg') return 2;
  return 3;
}

function compareCables(a, b) {
  const rp = rolePriority(a.role) - rolePriority(b.role);
  if (rp !== 0) return rp;
  return (Number(a.index) || 0) - (Number(b.index) || 0);
}

function cableUniqueId(c) {
  return `${c.role || 'leg'}:${c.index ?? 0}`;
}

/**
 * Recursively assigns hierarchical rigging names starting from the Crane Hook (`LP`):
 * - Tier 1 (connected to Hook): `LP1`, `LP2`, ...
 * - Tier 2 (connected below `LP1`): `LP11`, `LP12`, ...
 * - Tier 3 (cascade spreaders below `LP11`): `LP111`, `LP112`, ...
 */
export function assignHierarchicalNames(cables = [], options = {}) {
  const list = Array.isArray(cables) ? cables.filter(Boolean) : [];
  const rootPrefix = String(options.prefix || 'LP');
  const rootId = String(options.rootId || 'hook');
  const rootName = String(options.rootName || 'HOOK');

  const assigned = new Set();
  const byCableId = {};
  const byRoleIndex = {};

  function getConnectedChildren(parentNode) {
    if (parentNode.isRoot) {
      return list
        .filter((c) => !assigned.has(c) && isHookEndpoint(c.a))
        .sort(compareCables);
    }
    const parentBodyId = getEndpointBodyId(parentNode.cable.b);
    if (!parentBodyId) return [];

    // Find all cables on this same body whose top end `a` sits closest in XZ to this parent's bottom end `b`
    const sameBodyParents = list.filter((p) => getEndpointBodyId(p.b) === parentBodyId);
    const matches = [];
    for (const c of list) {
      if (assigned.has(c) || c === parentNode.cable) continue;
      if (getEndpointBodyId(c.a) !== parentBodyId) continue;

      let bestParent = null;
      let bestDist = Infinity;
      for (const p of sameBodyParents) {
        const d = xzDistanceSq(c.a, p.b);
        if (d < bestDist - 1e-6 || (Math.abs(d - bestDist) <= 1e-6 && compareCables(p, bestParent) < 0)) {
          bestDist = d;
          bestParent = p;
        }
      }
      if (bestParent === parentNode.cable) matches.push(c);
    }
    return matches.sort(compareCables);
  }

  function recurse(parentNode, prefix, depth) {
    if (depth > 8) return;
    const children = getConnectedChildren(parentNode);
    children.forEach((child, idx) => {
      assigned.add(child);
      const childName = `${prefix}${idx + 1}`;
      const id = cableUniqueId(child);
      child.id = id;
      child.name = childName;
      child.hierarchicalName = childName;
      child.parentId = parentNode.id;
      child.parentName = parentNode.name;
      child.tier = depth;
      byCableId[id] = childName;
      byRoleIndex[`${child.role}:${child.index}`] = childName;
      recurse({ isRoot: false, id, name: childName, cable: child }, childName, depth + 1);
    });
  }

  recurse({ isRoot: true, id: rootId, name: rootName, cable: null }, rootPrefix, 1);

  // Fallback for any disconnected/extra cable not reachable from hook
  let extraCounter = 1;
  for (const c of list) {
    if (assigned.has(c)) continue;
    const id = cableUniqueId(c);
    const fallbackName = c.role === 'extra' ? `${rootPrefix}X${extraCounter++}` : `${rootPrefix}${(Number(c.index) || 0) + 1}`;
    c.id = id;
    c.name = fallbackName;
    c.hierarchicalName = fallbackName;
    c.parentId = rootId;
    c.parentName = rootName;
    c.tier = 1;
    byCableId[id] = fallbackName;
    byRoleIndex[`${c.role}:${c.index}`] = fallbackName;
  }

  return { byCableId, byRoleIndex, cables: list };
}

/** Synchronizes computed hierarchical names and parent pointers into `state.gear.*` records. */
export function syncHierarchicalNamesToGear(cables = [], state = null) {
  if (!state?.gear) return;
  for (const c of (cables || [])) {
    if (!c || !c.name) continue;
    let rec = null;
    if (c.role === 'upper') rec = state.gear.uppers?.[c.index];
    else if (c.role === 'hanger') rec = state.gear.hangers?.[c.index];
    else if (c.role === 'leg') rec = state.gear.legs?.[c.index];
    else if (c.role === 'extra') rec = state.gear.extraCables?.[c.index];
    if (rec) {
      rec.name = c.name;
      rec.hierarchicalName = c.name;
      rec.parentId = c.parentId || null;
      rec.parentName = c.parentName || null;
      rec.tier = c.tier || 1;
    }
    if (c.role === 'leg' && state.gear.shackles?.[c.index]) {
      state.gear.shackles[c.index].parentName = c.name;
      state.gear.shackles[c.index].parentId = c.id || `${c.role}:${c.index}`;
      state.gear.shackles[c.index].hierarchicalName = c.name;
    }
  }
}

/** Resolves display name (e.g. `LP1`, `LP11`) for a cable object or `(role, index)` pair. */
export function resolveCableLabel(cableOrRole, index = 0, state = null, phy = null) {
  if (cableOrRole && typeof cableOrRole === 'object') {
    if (cableOrRole.hierarchicalName || cableOrRole.name) return cableOrRole.hierarchicalName || cableOrRole.name;
    return resolveCableLabel(cableOrRole.role || 'leg', cableOrRole.index ?? 0, state, phy);
  }
  const role = String(cableOrRole || 'leg');
  const idx = Number(index) || 0;
  const fromPhy = phy?.cables?.find((c) => c && c.role === role && c.index === idx);
  if (fromPhy?.hierarchicalName || fromPhy?.name) return fromPhy.hierarchicalName || fromPhy.name;

  const rec = role === 'upper' ? state?.gear?.uppers?.[idx]
    : role === 'hanger' ? state?.gear?.hangers?.[idx]
    : role === 'extra' ? state?.gear?.extraCables?.[idx]
    : state?.gear?.legs?.[idx];
  if (rec?.hierarchicalName || rec?.name) return rec.hierarchicalName || rec.name;

  if (role === 'extra') return `LPX${idx + 1}`;
  return `LP${idx + 1}`;
}
