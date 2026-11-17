// @purpose: Thuật toán chia tải 4 nhánh kết hợp độ mềm xoắn dầm Saint-Venant (GJ) + độ giãn trục cáp (EA)
import { DNV_4LEG } from './riggingConstants.js';
import { solveElasticFourPointDistribution } from './ElasticFourPointSolver.js';

function inverseDistanceWeights(lugs, cogXZ) {
  const cx = Number(cogXZ?.x) || 0;
  const cz = Number(cogXZ?.z) || 0;
  const raw = lugs.map((p) => 1 / Math.max(0.05, Math.hypot((p.x || 0) - cx, (p.z || 0) - cz)));
  const sum = raw.reduce((a, b) => a + b, 0) || 1;
  return raw.map((w) => w / sum);
}

/**
 * Computes effective Skew Load Factor SKL in [1.25, 1.50] from manufacturing
 * sling-length tolerances and elastic axial stretch when explicit SKL is omitted.
 */
export function computeAdaptiveSKL({ toleranceFrac = 0, stretchStrainPerT = 0, totalLoadT = 20, legLengthsM = null, skl = null } = {}) {
  if (skl != null && Number.isFinite(Number(skl))) {
    return Math.max(DNV_4LEG.SKL_MIN, Math.min(DNV_4LEG.SKL_MAX, Number(skl)));
  }
  let lenSpreadFrac = Math.max(0, Number(toleranceFrac) || 0);
  if (Array.isArray(legLengthsM) && legLengthsM.length === 4) {
    const valid = legLengthsM.map(Number).filter((v) => Number.isFinite(v) && v > 0);
    if (valid.length === 4) {
      const avg = valid.reduce((a, b) => a + b, 0) / 4;
      const maxDev = Math.max(...valid.map((v) => Math.abs(v - avg)));
      lenSpreadFrac = Math.max(lenSpreadFrac, maxDev / Math.max(0.2, avg));
    }
  }
  const stretchBump = Math.max(0, Number(stretchStrainPerT) || 0) * Math.max(0, Number(totalLoadT) || 0);
  const rawSkl = DNV_4LEG.SKL_MIN + Math.min(0.25, lenSpreadFrac * 20.0 + stretchBump * 5.0);
  return Number(Math.max(DNV_4LEG.SKL_MIN, Math.min(DNV_4LEG.SKL_MAX, rawSkl)).toFixed(4));
}

/**
 * Single source of truth for DNV-ST-N001 4-point statically indeterminate lift.
 * Rigid payload without an equalizer beam concentrates 100% of vertical load * SKL
 * onto one diagonal pair [0,2] or [1,3] while the passive diagonal carries 0.
 */
export function resolveFourLegDiagonalLoad({
  totalLoadT = 20,
  cogOffsetXZ = { x: 0, z: 0 },
  lugPositions = null,
  cogLoadShares = null,
  legLengthsM = null,
  toleranceFrac = 0.0025,
  stretchStrainPerT = 0,
  skl = DNV_4LEG.SKL_DEFAULT,
  isEqualizer = false,
  isRigid = true,
  elasticTorsion = true,
  beamGJ = 3.2e7,
  cableEA = 2.2e7,
  beamSpanM = 6.0,
  lugWidthM = 2.2
} = {}) {
  const W = Math.max(0, Number(totalLoadT) || 0);
  const baseShares = Array.isArray(cogLoadShares) && cogLoadShares.length === 4
    ? cogLoadShares.map((v) => Math.max(0, Number(v) || 0))
    : (Array.isArray(lugPositions) && lugPositions.length === 4
      ? inverseDistanceWeights(lugPositions, cogOffsetXZ)
      : [0.25, 0.25, 0.25, 0.25]);
  const shareSum = baseShares.reduce((a, b) => a + b, 0) || 1;
  const normShares = baseShares.map((s) => s / shareSum);

  if (isEqualizer || !isRigid) {
    const shares = normShares.map((s) => Number(s.toFixed(4)));
    const tensionsT = shares.map((s) => Number((s * W).toFixed(4)));
    const shareA = (shares[0] + shares[2]) * 100;
    const shareB = (shares[1] + shares[3]) * 100;
    const reasons = [isEqualizer ? 'equalizer_beam_balanced' : 'flexible_payload_balanced'];
    return {
      activeDiagonal: shareB > shareA ? [1, 3] : [0, 2],
      passiveDiagonal: shareB > shareA ? [0, 2] : [1, 3],
      shares,
      tensionsT,
      sklUsed: 1.0,
      heavyPairSharePct: Number(Math.max(shareA, shareB).toFixed(1)),
      hasSkewRisk: false,
      reasons
    };
  }

  if (elasticTorsion && (beamGJ > 0 || cableEA > 0)) {
    return solveElasticFourPointDistribution({
      totalLoadT: W,
      normShares,
      legLengthsM,
      toleranceFrac,
      beamGJ,
      cableEA,
      beamSpanM,
      lugWidthM
    });
  }

  const sklUsed = computeAdaptiveSKL({ toleranceFrac, stretchStrainPerT, totalLoadT: W, legLengthsM, skl });
  const diagAShare = normShares[0] + normShares[2];
  const diagBShare = normShares[1] + normShares[3];

  // Tie-break on shorter diagonal when CoG shares are nearly symmetric
  let diagALen = 0;
  let diagBLen = 0;
  if (Array.isArray(legLengthsM) && legLengthsM.length === 4) {
    diagALen = (Number(legLengthsM[0]) || 0) + (Number(legLengthsM[2]) || 0);
    diagBLen = (Number(legLengthsM[1]) || 0) + (Number(legLengthsM[3]) || 0);
  }
  const pickB = diagBShare > diagAShare + 0.02
    || (Math.abs(diagBShare - diagAShare) <= 0.02 && diagBLen > 0 && diagALen > 0 && diagBLen < diagALen - 1e-4);

  const activeDiagonal = pickB ? [1, 3] : [0, 2];
  const passiveDiagonal = pickB ? [0, 2] : [1, 3];
  const [i0, i1] = activeDiagonal;
  const activeSum = normShares[i0] + normShares[i1];
  const r0 = activeSum > 1e-6 ? (normShares[i0] / activeSum) : 0.5;
  const r1 = activeSum > 1e-6 ? (normShares[i1] / activeSum) : 0.5;

  const shares = [0, 0, 0, 0];
  shares[i0] = Number((r0 * sklUsed).toFixed(4));
  shares[i1] = Number((r1 * sklUsed).toFixed(4));
  const tensionsT = shares.map((s) => Number((s * W).toFixed(4)));

  return {
    activeDiagonal,
    passiveDiagonal,
    shares,
    tensionsT,
    sklUsed,
    heavyPairSharePct: 100.0,
    hasSkewRisk: true,
    reasons: [
      'dnv_4leg_rigid_indeterminate',
      pickB ? 'active_diagonal_1_3' : 'active_diagonal_0_2',
      `skl_${sklUsed}`
    ]
  };
}
