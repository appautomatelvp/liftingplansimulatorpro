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
