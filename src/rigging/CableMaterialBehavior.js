// @purpose: Hành vi vật liệu XPBD (uốn cáp/xích/vải, lực cản gió ½ρCdAv²) và trạng thái bật giật hồi đàn hồi (whipPhase) khi đứt cáp
import { computeElasticSnapRecoil, normalizeCableMaterial, CABLE_MATERIAL_PROFILES } from './BrokenCableWhipXPBD.js';

const AIR_DENSITY_KG_M3 = 1.225;

export const MATERIAL_CONTINUUM_BEHAVIORS = Object.freeze({
  wire: Object.freeze({
    ...CABLE_MATERIAL_PROFILES.wire,
    windCd: 0.45,
    windWidthFactor: 1.0,
    whipFrames: 8
  }),
  chain: Object.freeze({
    ...CABLE_MATERIAL_PROFILES.chain,
    windCd: 0.35,
    windWidthFactor: 1.2,
    whipFrames: 5
  }),
  web: Object.freeze({
    ...CABLE_MATERIAL_PROFILES.web,
    windCd: 1.85,
    windWidthFactor: 4.5, // wide flat polyester ribbon catches lateral wind
    whipFrames: 10
  })
});

export function getMaterialBehavior(material = 'wire') {
  const key = normalizeCableMaterial(material);
  return MATERIAL_CONTINUUM_BEHAVIORS[key] || MATERIAL_CONTINUUM_BEHAVIORS.wire;
}

/** Computes ½ρ·Cd·A·v² lateral wind acceleration (m/s²) on one sling node. */
export function computeWindDragAccel({
  material = 'wire',
  windVelocity = null,
  diameterM = 0.02,
  segmentLengthM = 0.25,
  nodeMassKg = 1.0
} = {}) {
  if (!windVelocity) return { x: 0, y: 0, z: 0 };
  const wx = Number(windVelocity.x) || 0;
  const wy = Number(windVelocity.y) || 0;
  const wz = Number(windVelocity.z) || 0;
  const speedSq = wx * wx + wy * wy + wz * wz;
  if (speedSq < 1e-6) return { x: 0, y: 0, z: 0 };

  const beh = getMaterialBehavior(material);
  const speed = Math.sqrt(speedSq);
  const widthM = Math.max(0.008, Number(diameterM) || 0.02) * beh.windWidthFactor;
  const areaM2 = widthM * Math.max(0.05, Number(segmentLengthM) || 0.25);
  const massKg = Math.max(0.02, Number(nodeMassKg) || 1.0);
  const forceMag = 0.5 * AIR_DENSITY_KG_M3 * beh.windCd * areaM2 * speedSq;
  const accelMag = Math.min(45, forceMag / massKg);

  return {
    x: (wx / speed) * accelMag,
    y: (wy / speed) * accelMag,
    z: (wz / speed) * accelMag
  };
}

/**
 * Stamps initial elastic recoil velocities and a 6-10 frame whipPhase onto a parted cable.
 */
export function applySnapWhip(cable, tensionN = 0, mblN = 1, {
  material = 'wire',
  lengthM = 4,
  diameterMm = 20,
  tangent = { x: 0, y: 1, z: 0 }
} = {}) {
  const safeT = Math.max(0, Number(tensionN) || 0);
  const safeMbl = Math.max(1, Number(mblN) || 1);
  const beh = getMaterialBehavior(material);
  const diaM = Math.max(0.006, (Number(diameterMm) || 20) * 0.001);
  const areaM2 = Math.PI * (diaM * 0.5) ** 2;
  const linMass = normalizeCableMaterial(material) === 'web'
    ? Math.max(0.05, beh.densityFactor * (Number(diameterMm) || 20) / 50)
    : 7850 * areaM2 * beh.densityFactor;

  const { storedElasticEnergyJ, recoilSpeedMps } = computeElasticSnapRecoil({
    tensionN: Math.max(safeT, safeMbl * 0.35),
    lengthM: Math.max(0.2, Number(lengthM) || 4),
    youngsModulusPa: beh.youngsModulusPa,
    areaM2,
    linearMassKgM: linMass
  });

  const tx = Number(tangent?.x) || 0;
  const ty = Number(tangent?.y) || 0;
  const tz = Number(tangent?.z) || 0;
  const tLen = Math.hypot(tx, ty, tz) || 1;
  const nx = tx / tLen, ny = ty / tLen, nz = tz / tLen;

  // Tangent points A (upper) -> B (lower), so upper snaps toward -tangent and lower snaps toward +tangent
  const whipState = {
    active: safeT >= safeMbl || Boolean(cable?.broken),
    whipPhase: beh.whipFrames,
    totalWhipFrames: beh.whipFrames,
    recoilSpeedMps: Number(recoilSpeedMps.toFixed(3)),
    storedElasticEnergyJ: Number(storedElasticEnergyJ.toFixed(2)),
    airDamping: beh.airDamping,
    tipVelUpper: { x: -nx * recoilSpeedMps, y: -ny * recoilSpeedMps, z: -nz * recoilSpeedMps },
    tipVelLower: { x: nx * recoilSpeedMps, y: ny * recoilSpeedMps, z: nz * recoilSpeedMps }
  };
  if (cable) cable._whipState = whipState;
  return whipState;
}

export function advanceSnapWhipFrame(whipState, dt = 1 / 60) {
  if (!whipState || !whipState.active || whipState.whipPhase <= 0) return whipState;
  const drag = Math.exp(-(whipState.airDamping || 0.45) * Math.max(0.001, dt));
  for (const tip of [whipState.tipVelUpper, whipState.tipVelLower]) {
    if (!tip) continue;
    tip.x *= drag;
    tip.y *= drag;
    tip.z *= drag;
  }
  whipState.whipPhase = Math.max(0, whipState.whipPhase - 1);
  if (whipState.whipPhase === 0) whipState.active = false;
  return whipState;
}
