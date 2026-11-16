// @purpose: Thuật toán bắt điểm 3D cho thước đo cao độ (lưới khối + dây cáp mảnh + ma ní)

/**
 * Finds the closest 3D point under the mouse ray across mesh targets and thin cable/shackle segments.
 * Ensures thin slings, chains, shackles, and hook links trigger the Red Dot reliably from Hook to Cargo Bottom.
 *
 * @param {object} params
 * @param {object} params.THREE
 * @param {object} params.raycaster
 * @param {Array} [params.targets]
 * @param {Array} [params.segments] Array of { a: THREE.Vector3, b: THREE.Vector3, radius?: number }
 * @param {number} [params.thresholdM]
 * @returns {THREE.Vector3|null}
 */
export function pickBestElevationHoverPoint({
  THREE,
  raycaster,
  targets = [],
  segments = [],
  thresholdM = 0.18
} = {}) {
  if (!THREE || !raycaster) return null;

  if (raycaster.params && raycaster.params.Line) {
    raycaster.params.Line.threshold = Math.max(raycaster.params.Line.threshold || 0.05, 0.12);
  }

  const list = [];
  for (let i = 0; i < targets.length; i++) {
    const root = targets[i];
    if (!root || root.visible === false || root.userData?.isElevationRuler) continue;
    list.push(root);
  }

  const hits = list.length
    ? raycaster.intersectObjects(list, true).filter(
      (h) => h && h.object && h.object.visible !== false && !h.object.userData?.isElevationRuler
    )
    : [];
  const bestMeshHit = hits.length ? hits[0] : null;

  let bestSegPoint = null;
  let bestSegRayDist = Infinity;
  let bestSegScore = Infinity;

  if (Array.isArray(segments) && segments.length && raycaster.ray) {
    const ptRay = new THREE.Vector3();
    const ptSeg = new THREE.Vector3();
    for (let i = 0; i < segments.length; i++) {
      const seg = segments[i];
      if (!seg || !seg.a || !seg.b) continue;
      const rad = Math.max(thresholdM, Number(seg.radius) || thresholdM);
      const distSq = raycaster.ray.distanceSqToSegment(seg.a, seg.b, ptRay, ptSeg);
      if (distSq <= rad * rad) {
        const camDist = raycaster.ray.origin.distanceTo(ptSeg);
        // Prefer cables/shackles closest to the cursor ray, breaking ties by camera proximity.
        const score = distSq + camDist * 1e-4;
        if (score < bestSegScore) {
          bestSegScore = score;
          bestSegRayDist = camDist;
          bestSegPoint = ptSeg.clone();
        }
      }
    }
  }

  if (bestSegPoint && (!bestMeshHit || bestSegRayDist <= bestMeshHit.distance + 0.45)) {
    return bestSegPoint;
  }
  return bestMeshHit ? bestMeshHit.point.clone() : null;
}

/**
 * Collects all 3D meshes (including slings, shackles, pad-eyes, beams, hook) and world cable/shackle segments
 * so hovering any point from Hook down to Cargo Bottom shows the Red Dot cleanly.
 */
export function buildRulerHoverInputs({
  THREE, phy, cargoRootGroup, spreaderRootGroup, craneVehicleGroup,
  dunnageGroup, hookAssemblyGroup, padEyeMeshes, hwMeshes, sling3DPool, attachWorld
} = {}) {
  const targets = [cargoRootGroup, spreaderRootGroup, craneVehicleGroup, dunnageGroup];
  if (hookAssemblyGroup) targets.push(hookAssemblyGroup);
  if (Array.isArray(phy?.beamGroups)) phy.beamGroups.forEach((g) => { if (g) targets.push(g); });
  if (Array.isArray(padEyeMeshes)) padEyeMeshes.forEach((p) => { if (p && p.visible !== false) targets.push(p); });
  if (Array.isArray(hwMeshes)) hwMeshes.forEach((h) => { if (h && h.visible !== false) targets.push(h); });
  if (Array.isArray(sling3DPool)) sling3DPool.forEach((s) => { if (s?.group && s.group.visible) targets.push(s.group); });
  if (phy?._stsHbVis?.root && phy._stsHbVis.root.visible) targets.push(phy._stsHbVis.root);

  const segments = [];
  if (THREE && phy?.hookPos) {
    const hp = phy.hookPos.clone();
    segments.push({ a: hp.clone().setY(hp.y + 0.35), b: hp.clone().setY(hp.y - 0.65), radius: 0.28 });
  }
  if (typeof attachWorld === 'function' && Array.isArray(phy?.cables)) {
    phy.cables.forEach((c) => {
      if (!c || !c.a || !c.b) return;
      const pA = attachWorld(c.a);
      const pB = attachWorld(c.b);
      if (c.broken && c.break) {
        if (c.break.tipU) segments.push({ a: pA, b: c.break.tipU, radius: 0.16 });
        if (c.break.tipL) segments.push({ a: pB, b: c.break.tipL, radius: 0.16 });
      } else {
        segments.push({ a: pA, b: pB, radius: 0.18 });
      }
    });
  }
  if (THREE && Array.isArray(hwMeshes)) {
    const offY = new THREE.Vector3(0, 0.14, 0);
    hwMeshes.forEach((h) => {
      if (!h || h.visible === false) return;
      const wp = new THREE.Vector3();
      h.getWorldPosition(wp);
      segments.push({ a: wp.clone().sub(offY), b: wp.clone().add(offY), radius: 0.24 });
    });
  }
  return { targets, segments };
}
