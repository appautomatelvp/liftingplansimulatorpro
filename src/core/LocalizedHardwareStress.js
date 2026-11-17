// @purpose: Phân tích ứng suất cục bộ phụ kiện (Pin vs Bow) bọc ngoài standards/hardware.js theo ASME B30.26
import {
  computeShackleSideDerate,
  HARDWARE_SAFETY_FACTOR_MIN
} from './standards/hardware.js';

const G_SI = 9.80665;
const TONNE_KG = 1000;
const PIN_SHEAR_ULTIMATE_PA = 415e6; // Alloy forged Grade 8 pin shear threshold (~0.577 * 720 MPa)
const PIN_SHEAR_ALLOW_PA = PIN_SHEAR_ULTIMATE_PA / HARDWARE_SAFETY_FACTOR_MIN; // 83 MPa working allowable

function inferPinMmFromWll(wllT) {
  const w = Math.max(0.5, Number(wllT) || 17);
  // Matches Crosby G-2130 scale (~41.3mm at 17t, ~35mm at 12t, ~25mm at 6.5t)
  return Math.max(8, 11.4 * Math.pow(w, 0.455));
}

/**
 * Computes localized component stress limits for a rigging shackle, tracking
 * Pin double-shear stress vs Bow ASME B30.26 side-load derating.
 */
export function evaluateShackleComponentLoad({
  wllT = 17,
  pinMm = null,
  jawMm = 44,
  loadT = 0,
  bearingOn = 'bow',
  sideAngleDeg = 0,
  hwType = 'bow_shackle'
} = {}) {
  const safeWllT = Math.max(0.1, Number.isFinite(Number(wllT)) ? Number(wllT) : 17);
  const safeLoadT = Math.max(0, Number.isFinite(Number(loadT)) ? Number(loadT) : 0);
  const safePinMm = Math.max(6, Number.isFinite(Number(pinMm)) && Number(pinMm) > 0 ? Number(pinMm) : inferPinMmFromWll(safeWllT));
  const safeJawMm = Math.max(10, Number.isFinite(Number(jawMm)) && Number(jawMm) > 0 ? Number(jawMm) : 44);
  const bearing = String(bearingOn || 'bow').toLowerCase() === 'pin' ? 'pin' : 'bow';
  const theta = Number.isFinite(Number(sideAngleDeg)) ? Math.abs(Number(sideAngleDeg)) : 0;

  // 1. Bow side-load derating via [LOCKED] standards/hardware.js (ASME B30.26)
  const derate = computeShackleSideDerate(hwType, theta);
  const derateFactor = Number.isFinite(Number(derate.factor)) ? Number(derate.factor) : 0;
  const bowLimitT = Number((safeWllT * derateFactor).toFixed(4));

  // 2. Pin double-shear capacity: τ = F / (2 * A_pin), adjusted slightly for wide jaw bending
  const radiusM = (safePinMm * 0.001) * 0.5;
  const pinAreaM2 = Math.PI * radiusM * radiusM;
  const jawSlenderness = Math.max(1.0, safeJawMm / Math.max(8, safePinMm * 1.45));
  const pinBendingDerate = 1 / (1 + 0.12 * Math.max(0, jawSlenderness - 1));
  const pinShearLimitN = 2 * pinAreaM2 * PIN_SHEAR_ALLOW_PA * pinBendingDerate;
  const pinShearLimitT = Number((pinShearLimitN / (TONNE_KG * G_SI)).toFixed(4));

  const forceN = safeLoadT * TONNE_KG * G_SI;
  const pinShearStressMPa = Number(((forceN / Math.max(1e-9, 2 * pinAreaM2)) / 1e6).toFixed(3));
  const pinAllowableShearMPa = Number(((PIN_SHEAR_ALLOW_PA * pinBendingDerate) / 1e6).toFixed(3));

  // 3. Select governing component threshold based on where the sling bears
  let governing = bearing;
  let activeLimitT = bearing === 'pin' ? pinShearLimitT : bowLimitT;
  if (!derate.isAllowed || bowLimitT <= 0) {
    governing = 'bow';
    activeLimitT = 0;
  } else if (bearing === 'bow' && pinShearLimitT < bowLimitT * 0.85) {
    // Undersized custom pin becomes critical even when bearing on bow
    governing = 'pin';
    activeLimitT = pinShearLimitT;
  }

  const utilizationPct = activeLimitT > 1e-6
    ? Number(((safeLoadT / activeLimitT) * 100).toFixed(2))
    : (safeLoadT > 0 ? 999.99 : 0);

  const bowUtilPct = bowLimitT > 1e-6
    ? Number(((safeLoadT / bowLimitT) * 100).toFixed(2))
    : (safeLoadT > 0 ? 999.99 : 0);
  const pinUtilPct = pinShearLimitT > 1e-6
    ? Number(((safeLoadT / pinShearLimitT) * 100).toFixed(2))
    : (safeLoadT > 0 ? 999.99 : 0);

  return {
    bearingOn: bearing,
    governing,
    wllT: safeWllT,
    loadT: safeLoadT,
    pinMm: Number(safePinMm.toFixed(2)),
    jawMm: Number(safeJawMm.toFixed(2)),
    sideAngleDeg: Number(theta.toFixed(2)),
    derateFactor,
    bowLimitT,
    pinShearLimitT,
    activeLimitT: Number(activeLimitT.toFixed(4)),
    utilizationPct,
    bowUtilPct,
    pinUtilPct,
    pinShearStressMPa,
    pinAllowableShearMPa,
    isAllowed: Boolean(derate.isAllowed),
    isProhibited: Boolean(derate.isProhibited),
    isOverloaded: !derate.isAllowed || utilizationPct > 100,
    error: derate.error || null
  };
}
