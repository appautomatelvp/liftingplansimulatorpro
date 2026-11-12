// src/rigging/riggingConstants.js
// ASME B30.9 / B30.26 / DNV-ST-N001 Constants

export const TOPOLOGY = Object.freeze({
  DIRECT_HOOK:    'Direct_Hook',
  MULTI_LEG:      'Multi-Leg_Bridle',
  SPREADER_BEAM:  'Spreader_Beam',
  LIFTING_BEAM:   'Lifting_Beam',
});

export const HITCH = Object.freeze({
  VERTICAL:    { id: 'Vertical',    wllFactor: 1.0 },
  CHOKER:      { id: 'Choker',      wllFactor: 0.8 },
  BASKET_90:   { id: 'Basket_90deg', wllFactor: 2.0 },
});

// Shackle side-load derating (ASME B30.26)
// angle in degrees from vertical pin axis
export const SHACKLE_DERATING = Object.freeze({
  BOW: [
    { maxAngle:  5,  factor: 1.00, status: 'SAFE' },
    { maxAngle: 45,  factor: 0.70, status: 'WARNING_SIDE_LOAD' },
    { maxAngle: 90,  factor: 0.50, status: 'CAUTION_HIGH_SIDE_LOAD' },
    { maxAngle: 999, factor: 0.00, status: 'CRITICAL_ERROR' },
  ],
  DEE: [
    { maxAngle: 5,   factor: 1.00, status: 'SAFE' },
    { maxAngle: 999, factor: 0.00, status: 'CRITICAL_SIDE_LOAD' },
  ],
});

// Sling angle alarm thresholds (ASME B30.9 §4)
export const ANGLE_THRESHOLDS = Object.freeze({
  SAFE_MIN:    45,  // deg — below this: WARNING
  CRITICAL_MAX: 30, // deg — below this: CRITICAL (lift prohibited)
});

// DNV-ST-N001 §9 — 4-leg statically indeterminate skew load
export const DNV_4LEG = Object.freeze({
  SKL_MIN: 1.25,
  SKL_MAX: 1.50,
  SKL_DEFAULT: 1.25,
  // Active diagonal = legs [0,2] (index 0 & 2 of 4-leg array)
  ACTIVE_DIAGONAL:  [0, 2],
  PASSIVE_DIAGONAL: [1, 3],
});

// 3-Zone alarm engine (ASME B30.9)
export const ZONE = Object.freeze({
  SAFE:        1,  // T <= SWL_effective
  OVERLOAD:    2,  // SWL_effective < T < MBL
  SNAP:        3,  // T >= MBL -> cascade failure
});

// Cascade failure shock multiplier (DNV-ST-N001)
export const CASCADE_SHOCK = 2.0;

// Sub-stepping for high mass-ratio stability (Chaos Physics equivalent)
export const SOLVER_SUBSTEPS = 8;  // 240 Hz effective when main loop = 60 Hz

// Dynamic Amplification Factor base formula: Kdyn = 1 + az/g
// az = vertical acceleration of hook (m/s²); g = 9.81
export const GRAVITY = 9.81; // m/s²

// Standard conversion factor
export const T_TO_KN = 9.80665;

// Manufacturing length tolerance per DNV §9.5.3 (+-0.25% of nominal)
export const LENGTH_TOLERANCE_RATIO = 0.0025;
