// src/rigging/RiggingPhysicsSolver.js
/**
 * Realistic 3D Lifting & Rigging Simulation Architecture
 * Target Standards: ASME B30.9 (Slings), ASME B30.26 (Hardware), DNV-ST-N001 (Marine Ops & Skew)
 */

import {
  TOPOLOGY,
  HITCH,
  SHACKLE_DERATING,
  ANGLE_THRESHOLDS,
  DNV_4LEG,
  ZONE,
  CASCADE_SHOCK,
  GRAVITY,
  T_TO_KN
} from './riggingConstants.js';
import { resolveFourLegDiagonalLoad } from './DnvFourPointLift.js';

export {
  TOPOLOGY,
  HITCH,
  SHACKLE_DERATING,
  ANGLE_THRESHOLDS,
  DNV_4LEG,
  ZONE,
  CASCADE_SHOCK,
  GRAVITY,
  T_TO_KN
};

/**
 * 3D Sling Angle Calculation (Y-up coordinate system)
 * @param {{x: number, y: number, z: number}} topPoint
 * @param {{x: number, y: number, z: number}} bottomPoint
 * @returns {{ angleDeg: number, horizDist: number, vertDist: number }}
 */
export function computeSlingAngle3D(topPoint, bottomPoint) {
  if (!topPoint || !bottomPoint) {
    return { angleDeg: 90.0, horizDist: 0.0, vertDist: 0.0 };
  }
  const dx = (Number(topPoint.x) || 0) - (Number(bottomPoint.x) || 0);
  const dz = (Number(topPoint.z) || 0) - (Number(bottomPoint.z) || 0);
  const horizDist = Math.hypot(dx, dz);
  const vertDist = Math.abs((Number(topPoint.y) || 0) - (Number(bottomPoint.y) || 0));
  const length = Math.hypot(dx, vertDist, dz);

  if (length < 1e-6 || horizDist < 1e-4) {
    return { angleDeg: 90.0, horizDist: 0.0, vertDist };
  }
  if (vertDist < 1e-4) {
    return { angleDeg: 0.0, horizDist, vertDist: 0.0 };
  }

  const ratio = Math.max(0, Math.min(1, vertDist / length));
  const angleDeg = Math.max(0, Math.min(90, Math.asin(ratio) * (180.0 / Math.PI)));
  return {
    angleDeg: Number(angleDeg.toFixed(2)),
    horizDist: Number(horizDist.toFixed(4)),
    vertDist: Number(vertDist.toFixed(4))
  };
}

/**
 * Classify sling angle according to ASME B30.9
 * @param {number} angleDeg
 * @returns {{ zone: 'SAFE'|'WARNING_LOW_ANGLE'|'CRITICAL_LOW_ANGLE', canLift: boolean }}
 */
export function classifyAngle(angleDeg) {
  const a = Number(angleDeg) || 0;
  if (a >= ANGLE_THRESHOLDS.SAFE_MIN) {
    return { zone: 'SAFE', canLift: true };
  }
  if (a >= ANGLE_THRESHOLDS.CRITICAL_MAX) {
    return { zone: 'WARNING_LOW_ANGLE', canLift: true };
  }
  return { zone: 'CRITICAL_LOW_ANGLE', canLift: false };
}

/**
 * Shackle side-load derating factor per ASME B30.26
 * @param {'bow_shackle'|'dee_shackle'|'BOW'|'DEE'|string} shackleType
 * @param {number} sideAngleDeg - out-of-plane deviation from pin axis in degrees
 * @returns {{ factor: number, status: string, isAllowed: boolean }}
 */
export function computeShackleSideDerate(shackleType = 'bow_shackle', sideAngleDeg = 0) {
  const theta = Math.abs(Number(sideAngleDeg) || 0);
  const typeKey = String(shackleType).toLowerCase();
  const isDee = typeKey.includes('dee') || typeKey === 'd_shackle';

  if (isDee) {
    const table = SHACKLE_DERATING.DEE;
    for (const rule of table) {
      if (theta <= rule.maxAngle) {
        return {
          factor: rule.factor,
          status: rule.status,
          isAllowed: rule.factor > 0
        };
      }
    }
    return { factor: 0.0, status: 'CRITICAL_SIDE_LOAD', isAllowed: false };
  }

  // Bow shackle
  const table = SHACKLE_DERATING.BOW;
  for (const rule of table) {
    if (theta <= rule.maxAngle) {
      return {
        factor: rule.factor,
        status: rule.status,
        isAllowed: rule.factor > 0
      };
    }
  }
  return { factor: 0.0, status: 'CRITICAL_ERROR', isAllowed: false };
}

/**
 * Determinant of 3x3 matrix:
 * [ m0 m1 m2 ]
 * [ m3 m4 m5 ]
 * [ m6 m7 m8 ]
 */
function det3(m0, m1, m2, m3, m4, m5, m6, m7, m8) {
  return (
    m0 * (m4 * m8 - m5 * m7) -
    m1 * (m3 * m8 - m5 * m6) +
    m2 * (m3 * m7 - m4 * m6)
  );
}

/**
 * 3D Moment Equilibrium for Asymmetric Center of Gravity (CoG)
 * Computes vertical load share fraction per attachment lug.
 * Sum of fractions = 1.0 (unless degenerate).
 * @param {Array<{x: number, y?: number, z: number, id?: string}>} lugs
 * @param {{x: number, y?: number, z: number}} cogWorld
 * @param {number} totalWeightT
 * @returns {number[]} loadShare fractions [f_0, f_1, ...]
 */
export function solveCoGMomentEquilibrium(lugs, cogWorld = { x: 0, y: 0, z: 0 }, totalWeightT = 1.0) {
  const n = lugs ? lugs.length : 0;
  if (n <= 0) return [];
  if (n === 1) return [1.0];

  const cx = cogWorld.x || 0;
  const cz = cogWorld.z || 0;

  // Case 2 lugs (1D lever balance)
  if (n === 2) {
    const p0 = lugs[0];
    const p1 = lugs[1];
    const dx = p1.x - p0.x;
    const dz = p1.z - p0.z;
    const lenSq = dx * dx + dz * dz;
    if (lenSq < 1e-7) return [0.5, 0.5];

    // Project CoG onto line segment p0 -> p1
    let t = ((cx - p0.x) * dx + (cz - p0.z) * dz) / lenSq;
    t = Math.max(0.0, Math.min(1.0, t));
    return [Number((1.0 - t).toFixed(6)), Number(t.toFixed(6))];
  }

  // Case 3 lugs (3D static equilibrium via Cramer's rule)
  if (n === 3) {
    const x0 = lugs[0].x, z0 = lugs[0].z;
    const x1 = lugs[1].x, z1 = lugs[1].z;
    const x2 = lugs[2].x, z2 = lugs[2].z;

    const D = det3(
      1, 1, 1,
      x0, x1, x2,
      z0, z1, z2
    );

    if (Math.abs(D) > 1e-6) {
      const D0 = det3(
        1, 1, 1,
        cx, x1, x2,
        cz, z1, z2
      );
      const D1 = det3(
        1, 1, 1,
        x0, cx, x2,
        z0, cz, z2
      );
      const D2 = det3(
        1, 1, 1,
        x0, x1, cx,
        z0, z1, cz
      );

      let v0 = D0 / D;
      let v1 = D1 / D;
      let v2 = D2 / D;

      // Check if CoG is strictly inside the triangle of lugs
      if (v0 >= 0 && v1 >= 0 && v2 >= 0) {
        return [
          Number(v0.toFixed(6)),
          Number(v1.toFixed(6)),
          Number(v2.toFixed(6))
        ];
      }
      // If one lug is slack (CoG outside), clamp negative to 0 and renormalize
      v0 = Math.max(0, v0);
      v1 = Math.max(0, v1);
      v2 = Math.max(0, v2);
      const sum = v0 + v1 + v2;
      if (sum > 1e-6) {
        return [
          Number((v0 / sum).toFixed(6)),
          Number((v1 / sum).toFixed(6)),
          Number((v2 / sum).toFixed(6))
        ];
      }
    }
  }

  // Case 4 lugs or general N lugs (bilinear / distance inverse interpolation)
  // Check symmetric rectangular distribution
  let totalInvDist = 0;
  const weights = [];
  for (let i = 0; i < n; i++) {
    const dx = lugs[i].x - cx;
    const dz = lugs[i].z - cz;
    const dist = Math.sqrt(dx * dx + dz * dz);
    // Inverse distance weighting to approximate centroid share
    const w = 1.0 / Math.max(0.05, dist);
    weights.push(w);
    totalInvDist += w;
  }

  // If all distances identical (e.g. CoG at exact center of symmetric lugs)
  const isSymmetric = weights.every(w => Math.abs(w - weights[0]) < 1e-4);
  if (isSymmetric) {
    const equalShare = Number((1.0 / n).toFixed(6));
    return new Array(n).fill(equalShare);
  }

  return weights.map(w => Number((w / totalInvDist).toFixed(6)));
}

/**
 * DNV-ST-N001 Statically Indeterminate 4-Leg Bridle Rule
 * With manufacturing length tolerance (+-0.25%), payload is carried by 1 diagonal pair.
 * Active diagonal pair carries 100% load * SKL factor (SKL in [1.25, 1.50]).
 * Passive diagonal pair carries 0% vertical load (anti-tip stabilizers).
 * @param {Array<any>} legs4
 * @param {number[]} cogLoadShares - pre-DNV load shares [f0, f1, f2, f3]
 * @param {number} SKL - Skew Load Factor (default 1.25)
 * @returns {number[]} dnvShares - multipliers/fractions per leg
 */
export function applyDNV4LegSkewRule(legs4, cogLoadShares = [0.25, 0.25, 0.25, 0.25], SKL = DNV_4LEG.SKL_DEFAULT) {
  const legLengthsM = Array.isArray(legs4) ? legs4.map((c) => (c && c.L0) || 0) : null;
  const res = resolveFourLegDiagonalLoad({
    totalLoadT: 1.0,
    cogLoadShares,
    legLengthsM,
    skl: SKL,
    isRigid: true,
    isEqualizer: false
  });
  const dnvShares = [...res.shares];
  dnvShares.activeDiagonal = res.activeDiagonal;
  dnvShares.passiveDiagonal = res.passiveDiagonal;
  dnvShares.sklUsed = res.sklUsed;
  dnvShares.heavyPairSharePct = res.heavyPairSharePct;
  dnvShares.hasSkewRisk = res.hasSkewRisk;
  dnvShares.dnvNotice = `DNV-ST-N001: 4-leg statically indeterminate lift. Active diagonal carries 100% load * SKL (${res.sklUsed}x). Passive legs carry 0t.`;
  return dnvShares;
}

/**
 * Axial Sling Tension calculation
 * T = (loadShareT * Kdyn) / (hitchFactor * sin(alpha))
 * @param {number} loadShareT - vertical share on this leg (tonnes)
 * @param {number} hitchFactor - from HITCH enum (e.g. 1.0 vertical, 0.8 choker, 2.0 basket)
 * @param {number} angleDeg - sling angle from horizontal
 * @param {number} Kdyn - Dynamic Amplification Factor (>= 1.0)
 * @returns {number} Axial tension T (tonnes)
 */
export function computeLegTension(loadShareT = 0, hitchFactor = 1.0, angleDeg = 90.0, Kdyn = 1.0) {
  const share = Number(loadShareT) || 0;
  if (share <= 0) return 0.0;

  const hFactor = Math.max(0.1, Number(hitchFactor) || 1.0);
  const dyn = Math.max(1.0, Math.min(3.0, Number(Kdyn) || 1.0));
  
  // Safe clamped angle (minimum 10 deg to avoid division by zero)
  const a = Math.max(10.0, Math.min(90.0, Number(angleDeg) || 90.0));
  const sinAlpha = Math.sin(a * (Math.PI / 180.0));

  const tension = ((share / hFactor) * dyn) / sinAlpha;
  return Number(tension.toFixed(4));
}

/**
 * 3-Zone Alarm & Failure Evaluation (ASME B30.9)
 * ZONE 1 - SAFE: T <= SWL_effective
 * ZONE 2 - OVERLOAD: SWL_effective < T < MBL (payload stays suspended)
 * ZONE 3 - SNAP: T >= MBL (constraint sever & cascade trigger)
 * @param {number} T_actual - actual tension in tonnes
 * @param {number} SWL_effective - effective Safe Working Load in tonnes
 * @param {number} MBL - Minimum Breaking Load in tonnes
 * @returns {{ zone: number, pctSWL: number, pctMBL: number }}
 */
export function evaluateZone(T_actual = 0, SWL_effective = 1.0, MBL = 5.0) {
  const T = Math.max(0, Number(T_actual) || 0);
  const swl = Math.max(0.01, Number(SWL_effective) || 1.0);
  const mbl = Math.max(swl, Number(MBL) || (swl * 5.0));

  const pctSWL = Number(((T / swl) * 100.0).toFixed(2));
  const pctMBL = Number(((T / mbl) * 100.0).toFixed(2));

  let zone = ZONE.SAFE;
  if (T >= mbl) {
    zone = ZONE.SNAP;
  } else if (T > swl) {
    zone = ZONE.OVERLOAD;
  }

  return { zone, pctSWL, pctMBL };
}

/**
 * Cascade Failure & Dynamic Shock Calculation (DNV-ST-N001)
 * Shock multiplier Kshock = 2.0 applied to surviving legs upon constraint snap.
 * @param {string|{id: string, T_actual?: number}} snappedLeg
 * @param {Array<{id: string, T_actual: number, SWL_effective: number, MBL: number}>} survivingLegs
 * @param {number} shockMult - default CASCADE_SHOCK (2.0)
 * @param {number} _depth - recursion depth guard
 * @returns {Array<{legId: string, newT: number, zone: number, alsoSnapped: boolean}>}
 */
export function cascadeFailure(snappedLeg, survivingLegs = [], shockMult = CASCADE_SHOCK, _depth = 0) {
  if (!survivingLegs || survivingLegs.length === 0 || _depth > 4) {
    return [];
  }

  const snappedT = typeof snappedLeg === 'object' && snappedLeg !== null
    ? (snappedLeg.T_actual || snappedLeg.tensionT || 20.0)
    : 20.0;

  const totalSurvivingT = survivingLegs.reduce((sum, l) => sum + (Number(l.T_actual) || 0), 0);
  const shock = Math.max(1.0, Number(shockMult) || CASCADE_SHOCK);
  const redistribute = snappedT * shock;

  const results = [];
  const nextSnapped = [];
  const nextSurviving = [];

  for (const leg of survivingLegs) {
    const currentT = Number(leg.T_actual) || 0;
    const shareRatio = totalSurvivingT > 1e-4
      ? (currentT / totalSurvivingT)
      : (1.0 / survivingLegs.length);

    const extraT = shareRatio * redistribute;
    const newT = Number((currentT + extraT).toFixed(4));
    const evalResult = evaluateZone(newT, leg.SWL_effective, leg.MBL);
    const alsoSnapped = (evalResult.zone === ZONE.SNAP);

    results.push({
      legId: leg.id,
      newT,
      zone: evalResult.zone,
      alsoSnapped
    });

    if (alsoSnapped) {
      nextSnapped.push({ id: leg.id, T_actual: newT });
    } else {
      nextSurviving.push({ ...leg, T_actual: newT });
    }
  }

  // Recursive shock wave if secondary legs snapped
  if (nextSnapped.length > 0 && nextSurviving.length > 0 && _depth < 4) {
    for (const snap of nextSnapped) {
      const secondaryResults = cascadeFailure(snap, nextSurviving, shock, _depth + 1);
      for (const sec of secondaryResults) {
        const found = results.find(r => r.legId === sec.legId);
        if (found) {
          found.newT = sec.newT;
          found.zone = sec.zone;
          found.alsoSnapped = found.alsoSnapped || sec.alsoSnapped;
        }
      }
    }
  }

  return results;
}

/**
 * Spreader Beam Axial Compression: N = V / (2 * tan(alpha_top))
 * @param {number} vertLoadTotalT - total vertical load suspended under spreader (t)
 * @param {number} bridleAngleDeg - angle of top bridle slings from horizontal (deg)
 * @returns {number} Axial compressive force N (tonnes)
 */
export function computeSpreaderCompression(vertLoadTotalT = 0, bridleAngleDeg = 60.0) {
  const v = Math.max(0, Number(vertLoadTotalT) || 0);
  const a = Math.max(5.0, Math.min(85.0, Number(bridleAngleDeg) || 60.0));
  const tanAlpha = Math.tan(a * (Math.PI / 180.0));
  const N = v / (2.0 * tanAlpha);
  return Number(N.toFixed(4));
}

/**
 * Lifting Beam Central Bending Moment: M = (W * L) / 4
 * @param {number} payloadWeightT - total suspended payload weight (t)
 * @param {number} beamLengthM - span between pick points (m)
 * @returns {number} Bending moment M (t*m)
 */
export function computeLiftingBeamMoment(payloadWeightT = 0, beamLengthM = 1.0) {
  const w = Math.max(0, Number(payloadWeightT) || 0);
  const L = Math.max(0.1, Number(beamLengthM) || 1.0);
  const M = (w * L) / 4.0;
  return Number(M.toFixed(4));
}

/**
 * Resolve load-path topology from beamType / plan (ASME / industrial).
 * Spreader_Beam = compression + top bridle; Lifting_Beam = bending, no top bridle.
 */
export function resolveTopology(state, legCount = 0) {
  if (state?.rigSolver?.topologyOverride) return state.rigSolver.topologyOverride;
  const bt = state?.beamType || 'none';
  if (bt === 'lifting_beam' || bt === 'straight' || bt === 'adjustable') {
    return TOPOLOGY.LIFTING_BEAM;
  }
  if (
    bt === 'spreader' || bt === 'container_spreader' || bt === 'modular' ||
    bt === 'cascaded' || bt === 'frame' || bt === 'modular_truss' ||
    bt === 'inline4' || bt === 'inline8' || bt === 'spatial8'
  ) {
    return TOPOLOGY.SPREADER_BEAM;
  }
  if (bt === 'none' || bt === 'basket') {
    if (legCount <= 1) return TOPOLOGY.DIRECT_HOOK;
    return TOPOLOGY.MULTI_LEG;
  }
  return TOPOLOGY.MULTI_LEG;
}

/** Hitch WLL factor from HITCH table / state.rigSolver.hitch */
export function getHitchFactor(stateOrId) {
  const id = typeof stateOrId === 'string'
    ? stateOrId
    : (stateOrId?.rigSolver?.hitch || stateOrId?.hitch || 'Vertical');
  const key = String(id).toLowerCase();
  if (key.includes('choker')) return HITCH.CHOKER.wllFactor;
  if (key.includes('basket')) return HITCH.BASKET_90.wllFactor;
  return HITCH.VERTICAL.wllFactor;
}

/**
 * Main Rigging Evaluation Loop (Phase 1 — static / quasi-static).
 * Sits on top of XPBD: does not rewrite stepPhysicsEngine / runXpbdFrame.
 * Zone 2 = overload (suspend, no snap). Zone 3 = MBL snap + cascade Kdyn≥2.
 */
export function evaluate(phy, state, deps = {}) {
  if (!phy || !state) return;
  if (state.rigSolver && state.rigSolver.enabled === false) return;

  const legSwlFn = deps.legSwl || (() => 10.0);
  const attachWorldFn = deps.attachWorld || null;
  const cableIsBrokenFn = deps.cableIsBroken || (() => false);
  const breakCableFn = deps.breakCable || null;

  const hookVy = phy.hookVel?.y ?? phy.hoist?.vel?.y ?? 0;
  const az = Math.abs(hookVy);
  let Kdyn = Number(Math.min(2.5, Math.max(1.0, 1.0 + az / GRAVITY)).toFixed(3));
  if ((phy.shockFrames || 0) > 0) {
    Kdyn = Math.max(Kdyn, Math.min(3.0, Number(phy.shock) || CASCADE_SHOCK));
  }

  const allLegs = (phy.cables || []).filter((c) => c.role === 'leg');
  const legCables = allLegs.filter((c) => !cableIsBrokenFn(c));
  const numLegs = legCables.length;
  const topology = resolveTopology(state, numLegs);
  const hitchFactor = getHitchFactor(state);
  const payloadWeightT = Number(
    phy.effectiveCargoWeightT != null ? phy.effectiveCargoWeightT : (state.weight || 10.0)
  );
  const airborne = !state.poseLock && (phy.groundClearance || 0) > 0.05;
  const equalizer = !!(state.rigSolver && state.rigSolver.equalizer);

  // --- DNV 4-leg skew (rigid cargo, no equalizer) ---
  let dnvNotice = null;
  let dnvShares = null;
  const useDnv =
    airborne &&
    !equalizer &&
    numLegs === 4 &&
    (topology === TOPOLOGY.MULTI_LEG || topology === TOPOLOGY.SPREADER_BEAM);

  if (useDnv && attachWorldFn) {
    const lugs = legCables.map((c) => {
      const p = attachWorldFn(c.b);
      return { x: p.x, y: p.y, z: p.z, id: `L${c.index}` };
    });
    const cogWorld = {
      x: (phy.cargoPos?.x || 0) + (state.cogX || 0),
      y: phy.cargoPos?.y || 0,
      z: (phy.cargoPos?.z || 0) + (state.cogZ || 0)
    };
    const cogShares = solveCoGMomentEquilibrium(lugs, cogWorld, payloadWeightT);
    const skl = (state.rigSolver && state.rigSolver.skl) || DNV_4LEG.SKL_DEFAULT;
    dnvShares = applyDNV4LegSkewRule(legCables, cogShares, skl);
    dnvNotice = dnvShares.dnvNotice;
  }

  const legEvaluations = [];
  let minAngleDeg = 90.0;
  let canLift = true;
  let angleWarning = false;
  let angleCritical = false;

  legCables.forEach((c, i) => {
    let topPt = { x: 0, y: 5, z: 0 };
    let botPt = { x: 0, y: 0, z: 0 };
    if (attachWorldFn) {
      topPt = attachWorldFn(c.a);
      botPt = attachWorldFn(c.b);
    }
    const angleInfo = computeSlingAngle3D(topPt, botPt);
    const classification = classifyAngle(angleInfo.angleDeg);

    const span = (topPt.distanceTo && botPt.distanceTo)
      ? topPt.distanceTo(botPt)
      : Math.hypot(topPt.x - botPt.x, topPt.y - botPt.y, topPt.z - botPt.z);
    const isTaut = (c.tensionT > 0.04) || (span >= (c.L0 || 1.0) - 0.06);

    if (isTaut && classification.zone === 'WARNING_LOW_ANGLE') angleWarning = true;
    if (isTaut && classification.zone === 'CRITICAL_LOW_ANGLE') {
      angleCritical = true;
      canLift = false;
    }
    if (angleInfo.angleDeg < minAngleDeg) minAngleDeg = angleInfo.angleDeg;

    const idx = c.index !== undefined ? c.index : i;
    const gearLeg = state.gear?.legs?.[idx] || {};
    const rawSwl = Number(legSwlFn(idx)) || 10.0;
    // Hitch derates WLL/SWL capacity (ASME B30.9 hitch factors)
    const SWL_effective = rawSwl * hitchFactor;
    const sf = Math.max(1.5, gearLeg.sf || 5.0);
    const MBL = SWL_effective * sf;

    // Quasi-static design tension (DNV diagonal) vs live XPBD tension.
    // A genuinely slack/unloaded cable (e.g. hanging loose after its upper bridle
    // snaps) carries zero tension and must never trigger a phantom 1/sin(α) MBL snap.
    let designT = 0;
    if (isTaut && dnvShares && dnvShares[i] != null) {
      const vertShareT = dnvShares[i] * payloadWeightT;
      designT = computeLegTension(vertShareT, 1.0, angleInfo.angleDeg, Kdyn);
    }
    const xpbdT = Number(c.tensionT) || 0;
    // Conservative alarm: use the larger of live XPBD and DNV design share
    const T_actual = Math.max(xpbdT, designT);

    const zoneInfo = evaluateZone(T_actual, SWL_effective, MBL);

    // Zone 2 visual flag — elastic stretch cue for renderer (no snap)
    c._alarmZone = zoneInfo.zone;
    c._elasticStretchVisual = zoneInfo.zone === ZONE.OVERLOAD
      ? Math.min(1, (T_actual - SWL_effective) / Math.max(1e-3, MBL - SWL_effective))
      : 0;
    c._angleDanger = classification.zone !== 'SAFE';

    legEvaluations.push({
      id: `leg_${idx}`,
      index: idx,
      cable: c,
      angleDeg: angleInfo.angleDeg,
      angleZone: classification.zone,
      canLift: classification.canLift,
      isTaut,
      T_actual,
      T_xpbd: xpbdT,
      T_design: designT,
      dnvShare: dnvShares ? dnvShares[i] : null,
      hitchFactor,
      SWL_effective,
      MBL,
      pctSWL: zoneInfo.pctSWL,
      pctMBL: zoneInfo.pctMBL,
      zone: zoneInfo.zone
    });
  });

  let overallZone = ZONE.SAFE;
  for (const leg of legEvaluations) {
    if (leg.zone > overallZone) overallZone = leg.zone;
  }
  if (angleCritical && overallZone < ZONE.OVERLOAD) {
    // Angle critical blocks lift but is not a snap by itself
    canLift = false;
  }

  // Zone 3 only: remove constraint + cascade (Kdyn shock ≥ 2). Zone 2 stays suspended.
  const cascadeEvents = [];
  if (overallZone === ZONE.SNAP && airborne) {
    const snapped = legEvaluations.filter((l) => l.zone === ZONE.SNAP && !l.cable?._failureProcessed);
    let surviving = legEvaluations.filter((l) => l.zone < ZONE.SNAP);
    phy.shock = Math.max(phy.shock || 1, CASCADE_SHOCK);
    phy.shockFrames = Math.max(phy.shockFrames || 0, 16);

    for (const snap of snapped) {
      if (breakCableFn && snap.cable) {
        breakCableFn(snap.cable, 0.5);
        snap.cable._failureProcessed = true;
      }
      const cascade = cascadeFailure(
        { id: snap.id, T_actual: snap.T_actual },
        surviving.map((s) => ({
          id: s.id,
          T_actual: s.T_actual,
          SWL_effective: s.SWL_effective,
          MBL: s.MBL,
          cable: s.cable
        })),
        Math.max(CASCADE_SHOCK, Kdyn)
      );
      cascadeEvents.push(...cascade);
      for (const cas of cascade) {
        if (cas.alsoSnapped && breakCableFn) {
          const casLeg = surviving.find((s) => s.id === cas.legId);
          if (casLeg?.cable && !casLeg.cable._failureProcessed) {
            breakCableFn(casLeg.cable, 0.5);
            casLeg.cable._failureProcessed = true;
          }
        }
      }
      surviving = surviving.filter((s) => !cascade.some((c) => c.legId === s.id && c.alsoSnapped));
    }
  }

  // Beam topology metrics for HUD
  let beamMetric = null;
  if (topology === TOPOLOGY.SPREADER_BEAM) {
    const topAng = legEvaluations[0]?.angleDeg ?? 60;
    beamMetric = {
      kind: 'compression',
      valueT: computeSpreaderCompression(payloadWeightT, Math.max(25, topAng))
    };
  } else if (topology === TOPOLOGY.LIFTING_BEAM) {
    const span = state.beamLength || state.L || 6;
    beamMetric = {
      kind: 'bending',
      valueTm: computeLiftingBeamMoment(payloadWeightT, span)
    };
  }

  phy.rigging = {
    topology,
    hitchFactor,
    legs: legEvaluations,
    overallZone,
    canLift: canLift && !angleCritical,
    minAngleDeg,
    angleWarning,
    angleCritical,
    dnvNotice,
    dnvShares: dnvShares ? Array.from(dnvShares) : null,
    dnvMeta: dnvShares && dnvShares.sklUsed ? {
      activeDiagonal: dnvShares.activeDiagonal,
      passiveDiagonal: dnvShares.passiveDiagonal,
      sklUsed: dnvShares.sklUsed,
      heavyPairSharePct: dnvShares.heavyPairSharePct,
      hasSkewRisk: dnvShares.hasSkewRisk
    } : null,
    Kdyn,
    cascadeEvents,
    beamMetric,
    zoneLabel: overallZone === ZONE.SNAP ? 'SNAP'
      : overallZone === ZONE.OVERLOAD ? 'OVERLOAD' : 'SAFE',
    uiColor: overallZone === ZONE.SAFE ? 'green' : 'red'
  };
}
