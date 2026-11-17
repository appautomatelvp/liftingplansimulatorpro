// @purpose: Giải phân bố lực đàn hồi 4 điểm dựa trên độ cứng kéo dọc trục cáp (EA) và độ cứng xoắn Saint-Venant của dầm (GJ)

const G_EARTH = 9.81;

/**
 * Computes effective axial stiffness EA (Newtons) and k = EA / L0 (N/m) for a rigging cable.
 */
export function computeCableAxialStiffness({ material = 'wire', diameterMm = 20, lengthM = 4.0 } = {}) {
  const matKey = String(material || 'wire').toLowerCase();
  let modulusPa = 110e9;
  let fillFactor = 0.52;
  if (matKey.includes('chain')) {
    modulusPa = 200e9;
    fillFactor = 0.72;
  } else if (matKey.includes('web') || matKey.includes('round') || matKey.includes('synth')) {
    modulusPa = 4.5e9;
    fillFactor = 0.65;
  }
  const diaM = Math.max(0.006, (Number(diameterMm) || 20) / 1000);
  const areaM2 = Math.PI * (diaM * 0.5) ** 2 * fillFactor;
  const eaN = modulusPa * areaM2;
  const lenM = Math.max(0.25, Number(lengthM) || 4.0);
  return { eaN, stiffnessNPerM: eaN / lenM, areaM2, modulusPa };
}

/**
 * Returns the XPBD distance constraint compliance term `alpha / dt^2` (units: kg^-1)
 * combining cable axial elasticity EA with beam torsional flexibility GJ when attached to a beam.
 */
export function computeXpbdCableCompliance(cable, state, dt = 1 / 60) {
  const safeDt = Math.max(1e-4, Number(dt) || 1 / 60);
  const idx = Number(cable?.index) || 0;
  const rec = cable?.role === 'upper'
    ? state?.gear?.uppers?.[idx]
    : (cable?.role === 'hanger' ? state?.gear?.hangers?.[idx] : state?.gear?.legs?.[idx]);
  const mat = rec?.type || state?.slingType || 'wire';
  const dia = Number(rec?.diameterMm) || Number(state?.slingDiameterMm) || 22;
  const len = Math.max(0.35, Number(cable?.L0) || Number(state?.slingLength) || 4.0);
  const { stiffnessNPerM } = computeCableAxialStiffness({ material: mat, diameterMm: dia, lengthM: len });

  // Bounded XPBD compliance scaled safely relative to hoist substeps (prevents rubber-band sag bounce)
  let compliance = (1.0 / Math.max(1e3, stiffnessNPerM * safeDt * safeDt)) * 0.003;
  const hasBeam = state?.beamType && state.beamType !== 'none' && (cable?.a?.kind === 'body' || cable?.b?.kind === 'body');
  if (hasBeam) {
    const beamSpan = Math.max(1.5, Number(state?.beamLength) || 6.0);
    const swlT = Math.max(10, Number(state?.gear?.beam?.swlT) || 30);
    const jM4 = Math.max(3.8e-4, beamSpan * beamSpan * swlT * 2.0e-7);
    const halfW = Math.max(0.6, (Number(state?.W) || 2.4) * 0.5);
    const kTorsionNPerM = (79.3e9 * jM4) / (beamSpan * halfW * halfW);
    compliance += (1.0 / Math.max(1e3, kTorsionNPerM * safeDt * safeDt)) * 0.003;
  }
  return Math.min(2.5e-5, Math.max(0, compliance));
}

/**
 * Solves statically indeterminate 4-point load sharing using axial elasticity EA and
 * Saint-Venant beam/cargo torsional flexibility GJ.
 * Never zeroes out taut secondary diagonals when structural flexibility exists.
 */
export function solveElasticFourPointDistribution({
  totalLoadT = 20,
  normShares = [0.25, 0.25, 0.25, 0.25],
  legLengthsM = null,
  toleranceFrac = 0.0025,
  beamGJ = 3.2e7,
  cableEA = 2.2e7,
  beamSpanM = 6.0,
  lugWidthM = 2.2
} = {}) {
  const W = Math.max(0, Number(totalLoadT) || 0);
  const lenList = Array.isArray(legLengthsM) && legLengthsM.length === 4
    ? legLengthsM.map((v) => Math.max(0.35, Number(v) || 4.0))
    : [4.0, 4.0, 4.0, 4.0];
  const avgLen = (lenList[0] + lenList[1] + lenList[2] + lenList[3]) * 0.25;

  const diagAShare = normShares[0] + normShares[2];
  const diagBShare = normShares[1] + normShares[3];
  const lenA = (lenList[0] + lenList[2]) * 0.5;
  const lenB = (lenList[1] + lenList[3]) * 0.5;
  const rawMismatchM = Math.abs(lenA - lenB);
  const effMismatchM = rawMismatchM > 1e-4 ? rawMismatchM : avgLen * Math.max(0, Number(toleranceFrac) || 0.0025);

  // Pick stiffer/shorter/heavier diagonal as primary pair; weaker pair remains active under torsional twist
  const pickB = diagBShare > diagAShare + 0.015
    || (Math.abs(diagBShare - diagAShare) <= 0.015 && lenB < lenA - 1e-4);
  const activeDiagonal = pickB ? [1, 3] : [0, 2];
  const passiveDiagonal = pickB ? [0, 2] : [1, 3];

  const kCable = Math.max(1e4, Number(cableEA) || 2.2e7) / avgLen;
  const halfW = Math.max(0.4, (Number(lugWidthM) || 2.2) * 0.5);
  const span = Math.max(1.0, Number(beamSpanM) || 6.0);
  const safeGJ = Math.max(1e4, Number(beamGJ) || 3.2e7);
  const kTorsion = safeGJ / (span * halfW * halfW);
  const kEff = 1.0 / (1.0 / kCable + 1.0 / kTorsion);

  // Elastic deflection absorbed before secondary pair carries load: W * g * 0.5 / kEff
  const weightN = Math.max(100, W * 1000 * G_EARTH);
  const elasticDropM = (weightN * 0.5) / Math.max(1e3, kEff);
  const transferFrac = effMismatchM / Math.max(1e-6, effMismatchM + elasticDropM * 1.45);
  // Maximum transfer keeps secondary pair load-bearing whenever torsional twist absorbs mismatch (>0)
  const deltaPair = 0.28 * transferFrac;

  const [a0, a1] = activeDiagonal;
  const [p0, p1] = passiveDiagonal;
  const activeRatio0 = (normShares[a0] + normShares[a1]) > 1e-6 ? normShares[a0] / (normShares[a0] + normShares[a1]) : 0.5;
  const passiveRatio0 = (normShares[p0] + normShares[p1]) > 1e-6 ? normShares[p0] / (normShares[p0] + normShares[p1]) : 0.5;

  const primaryTotal = Math.min(0.84, Math.max(0.50, (normShares[a0] + normShares[a1]) + deltaPair));
  const secondaryTotal = Math.max(0.16, 1.0 - primaryTotal);

  const shares = [0, 0, 0, 0];
  shares[a0] = Number((primaryTotal * activeRatio0).toFixed(4));
  shares[a1] = Number((primaryTotal * (1 - activeRatio0)).toFixed(4));
  shares[p0] = Number((secondaryTotal * passiveRatio0).toFixed(4));
  shares[p1] = Number((secondaryTotal * (1 - passiveRatio0)).toFixed(4));
  const tensionsT = shares.map((s) => Number((s * W).toFixed(4)));

  return {
    activeDiagonal,
    passiveDiagonal,
    shares,
    tensionsT,
    sklUsed: 1.0,
    heavyPairSharePct: Number((primaryTotal * 100).toFixed(1)),
    hasSkewRisk: primaryTotal > 0.58,
    elasticTorsionActive: true,
    reasons: [
      'elastic_torsional_4point_xpbd',
      pickB ? 'primary_diagonal_1_3' : 'primary_diagonal_0_2',
      `primary_${(primaryTotal * 100).toFixed(0)}pct`
    ]
  };
}
