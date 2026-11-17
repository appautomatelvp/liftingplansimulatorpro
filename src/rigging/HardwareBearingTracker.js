// @purpose: Truy vết vị trí dây tựa thực tế trên ma ní (Pin vs Bow) và góc tải lệch bên (side-loading angle) theo ASME B30.26

function norm3(v, fallback = { x: 0, y: 1, z: 0 }) {
  const x = Number(v?.x) || 0;
  const y = Number(v?.y) || 0;
  const z = Number(v?.z) || 0;
  const len = Math.hypot(x, y, z);
  if (len < 1e-8) return { ...fallback };
  return { x: x / len, y: y / len, z: z / len };
}

function dot3(a, b) {
  return a.x * b.x + a.y * b.y + a.z * b.z;
}

/**
 * Determines whether the sling seats on the shackle 'pin' or 'bow',
 * and measures out-of-plane side-loading angle (degrees) relative to the shackle bow plane.
 */
export function trackShackleBearing({
  pinPos = null,
  crownPos = null,
  contactPos = null,
  shackleAxis = { x: 0, y: 1, z: 0 },
  pinAxis = { x: 1, y: 0, z: 0 },
  slingLeaveVec = null,
  pinHalfSpanM = 0.04,
  inverted = false
} = {}) {
  const axis = (crownPos && pinPos)
    ? norm3({ x: crownPos.x - pinPos.x, y: crownPos.y - pinPos.y, z: crownPos.z - pinPos.z }, shackleAxis)
    : norm3(shackleAxis, { x: 0, y: 1, z: 0 });
  const pAxis = norm3(pinAxis, { x: 1, y: 0, z: 0 });
  const leave = slingLeaveVec
    ? norm3(slingLeaveVec, axis)
    : ((crownPos && pinPos) ? axis : norm3(shackleAxis, axis));

  let bearingOn = inverted ? 'pin' : 'bow';
  let axialPosM = 0;

  if (contactPos && pinPos) {
    const rel = {
      x: (Number(contactPos.x) || 0) - (Number(pinPos.x) || 0),
      y: (Number(contactPos.y) || 0) - (Number(pinPos.y) || 0),
      z: (Number(contactPos.z) || 0) - (Number(pinPos.z) || 0)
    };
    axialPosM = dot3(rel, axis);
    const span = Math.max(0.005, Number(pinHalfSpanM) || 0.04);
    bearingOn = axialPosM <= span ? 'pin' : 'bow';
  } else if (dot3(leave, axis) < -0.15) {
    // Cable pulls back past the pin rather than resting in the bow apex
    bearingOn = 'pin';
  }

  // Out-of-plane angle relative to bow plane (normal = pinAxis)
  const sinSide = Math.min(1, Math.max(0, Math.abs(dot3(leave, pAxis))));
  const sideAngleDeg = Number(((Math.asin(sinSide) * 180) / Math.PI).toFixed(2));

  return {
    bearingOn,
    sideAngleDeg,
    axialPosM: Number(axialPosM.toFixed(4))
  };
}
