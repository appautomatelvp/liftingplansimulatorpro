/**
 * ============================================================================
 * UNITS & CONSTANTS (Units.js)
 * Standards: ASME B30.9, ASME B30.26, DNV-ST-N001, EN 13155
 * ============================================================================
 */

export const GRAVITY_STANDARD = 9.80665; // m/s^2 (Standard ISO gravity)
export const G_ACCEL = 9.81; // m/s^2 (Standard engineering value)

// Pressure & Modulus
export const MPA = 1e6; // Pascals
export const GPA = 1e9; // Pascals

// Mass units
export const TONNE = 1000.0; // kg

// Material Elastic Modulus (Effective Axial Rigidity E)
export const E_MODULUS = {
    STEEL_WIRE_ROPE_IWRC: 100 * GPA, // Independent Wire Rope Core
    STEEL_WIRE_ROPE_FC: 80 * GPA,   // Fiber Core
    CHAIN_GRADE_80: 160 * GPA,
    CHAIN_GRADE_100: 175 * GPA,
    POLYESTER_WEBBING: 3.5 * GPA,   // Synthetic Webbing
    POLYESTER_ROUND: 4.2 * GPA,     // High-performance Round Sling
    HMPE_DYNEEMA: 55 * GPA          // High Modulus Polyethylene
};

// Internal Material Damping Ratio (Zeta)
export const MATERIAL_DAMPING = {
    STEEL_WIRE: 0.02,     // 2% critical damping
    STEEL_CHAIN: 0.03,    // 3% critical damping
    SYNTHETIC_WEB: 0.08,  // 8% critical damping
    GROMMET: 0.04
};

// Safety Factors (ASME B30.9 / DNV-ST-N001)
export const SAFETY_FACTOR = {
    WIRE_ROPE_SLING: 5.0,
    ALLOY_STEEL_CHAIN: 4.0,
    SYNTHETIC_WEBBING: 5.0,
    SYNTHETIC_ROUND: 5.0,
    SHACKLE_ALLOY: 5.0,
    LIFTING_BEAM: 3.0,
    PAD_EYE_WELD: 3.0
};
