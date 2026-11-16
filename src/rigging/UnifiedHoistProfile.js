// @purpose: Quy chuẩn tốc độ nâng/hạ kiện hàng đồng nhất (0.85 m/s * scale) và chống giật bắn cho mọi phương án cáp & STS Spreader

export const UNIFIED_BASE_HOIST_SPEED_MPS = 0.85;
export const STS_HEADBLOCK_GAP_M = 0.22;

function clampScale(scale) {
  const n = Number(scale);
  if (!Number.isFinite(n)) return 1.0;
  return Math.max(0.25, Math.min(2.0, n));
}

/**
 * Returns symmetrical up/down hoisting rate in m/s independent of cargo weight or spreader type.
 */
export function computeUnifiedHoistRates(speedScale = 1.0) {
  const v = UNIFIED_BASE_HOIST_SPEED_MPS * clampScale(speedScale);
  return { up: v, down: v };
}

/**
 * Advances `currentY` toward `targetY` with strict rate cap `maxSpeedMps * dt` (zero teleport spikes).
 */
export function stepRateLimitedY(currentY, targetY, maxSpeedMps, dt = 1 / 60) {
  const stepMax = Math.max(0, Number(maxSpeedMps) || 0) * Math.max(1e-4, Number(dt) || 1 / 60);
  const delta = targetY - currentY;
  if (Math.abs(delta) <= stepMax) return targetY;
  return currentY + Math.sign(delta) * stepMax;
}

/**
 * Computes the next vertical coordinate for STS Spreader tracking trolley hook without gap or bounce.
 */
export function computeStsHeadblockFollow({
  hookPosY,
  beamY,
  roofContactY,
  maxSpeedMps,
  dt = 1 / 60
} = {}) {
  const headY = (Number(hookPosY) || 0) - STS_HEADBLOCK_GAP_M;
  const targetY = Math.max(Number(roofContactY) || 0, headY);
  const nextY = stepRateLimitedY(Number(beamY) || targetY, targetY, (Number(maxSpeedMps) || UNIFIED_BASE_HOIST_SPEED_MPS) * 1.05, dt);
  return Math.max(Number(roofContactY) || 0, nextY);
}

/**
 * Distributes static hoist & twistlock tensions for STS Direct when XPBD is bypassed cleanly.
 */
export function populateStsDirectTensions(cables, cargoWeightT = 20, gearWeightT = 9.5, carryingLoad = false) {
  if (!Array.isArray(cables) || !cables.length) return;
  const intactLegs = cables.filter((c) => c && c.role === 'leg' && !c.broken);
  const intactUppers = cables.filter((c) => c && c.role === 'upper' && !c.broken);
  const legShare = carryingLoad && intactLegs.length ? cargoWeightT / intactLegs.length : 0;
  const upShare = intactUppers.length ? ((carryingLoad ? cargoWeightT : 0) + gearWeightT) / intactUppers.length : 0;
  for (const c of cables) {
    if (!c || c.broken) continue;
    if (c.role === 'leg') {
      c.tensionT = legShare;
      c.slack = !carryingLoad;
    } else if (c.role === 'upper') {
      c.tensionT = upShare;
      c.slack = false;
    }
  }
}
