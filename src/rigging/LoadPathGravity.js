// @purpose: Kết nối đường tải trọng lực (rơi tự do g=-9.81 khi mất cáp), mô-men lật τ=r×mg trên mặt đỡ và võng uốn dầm Euler-Bernoulli
const G_SI = 9.81;

function cross2D(ax, az, bx, bz, px, pz) {
  return (bx - ax) * (pz - az) - (bz - az) * (px - ax);
}

function closestPointOnSegment2D(px, pz, ax, az, bx, bz) {
  const dx = bx - ax;
  const dz = bz - az;
  const lenSq = dx * dx + dz * dz;
  if (lenSq < 1e-10) return { x: ax, z: az };
  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (pz - az) * dz) / lenSq));
  return { x: ax + t * dx, z: az + t * dz };
}

export function pointInConvexPolygonXZ(pt, polygon = []) {
  if (!Array.isArray(polygon) || polygon.length < 3) return false;
  let pos = 0;
  let neg = 0;
  for (let i = 0; i < polygon.length; i++) {
    const a = polygon[i];
    const b = polygon[(i + 1) % polygon.length];
    const c = cross2D(a.x, a.z, b.x, b.z, pt.x, pt.z);
    if (c > 1e-8) pos++;
    else if (c < -1e-8) neg++;
    if (pos > 0 && neg > 0) return false;
  }
  return true;
}

/**
 * Checks whether active intact cables maintain a valid structural load path from hook to cargo & beams.
 */
export function computeLoadPathConnectivity(cables = [], beamType = 'none') {
  let intactLegs = 0;
  let intactUppers = 0;
  let intactHangers = 0;
  for (const c of (cables || [])) {
    if (!c || c.broken || (c.break && !c.intact)) continue;
    if (c.role === 'leg') intactLegs++;
    else if (c.role === 'upper') intactUppers++;
    else if (c.role === 'hanger') intactHangers++;
  }
  const hasBeam = beamType && beamType !== 'none';
  const hasUpperPath = hasBeam ? (intactUppers > 0 || intactHangers > 0) : true;
  const hasCargoPath = intactLegs > 0 && hasUpperPath;
  return {
    intactLegs,
    intactUppers,
    intactHangers,
    hasBeamPath: hasBeam ? hasUpperPath : false,
    hasCargoPath,
    beamFreeFall: Boolean(hasBeam && !hasUpperPath),
    cargoFreeFall: !hasCargoPath
  };
}

/**
 * Advances free-falling rigid body under Newtonian gravity -9.81 m/s² without artificial speed clamps.
 */
export function stepFreeFallBody(body, dt = 1 / 60, { groundY = 0, halfHeight = 0, airDamping = 0.0 } = {}) {
  const stepDt = Math.max(1 / 480, Math.min(0.05, Number(dt) || 1 / 60));
  const drag = Math.exp(-Math.max(0, airDamping) * stepDt);
  body.vy = ((Number(body.vy) || 0) - G_SI * stepDt) * drag;
  body.y = (Number(body.y) || 0) + body.vy * stepDt;
  const floorY = (Number(groundY) || 0) + Math.max(0, Number(halfHeight) || 0);
  let grounded = false;
  if (body.y <= floorY) {
    body.y = floorY;
    if (body.vy < 0) body.vy = 0;
    grounded = true;
  }
  return { y: body.y, vy: body.vy, grounded };
}

/**
 * Computes overturning restoring torque τ = r × (m·g) when CoG projection falls outside the support polygon.
 */
export function computeRestingTorque({ cogWorld = { x: 0, y: 1, z: 0 }, supportPolygon = [], massKg = 20000 } = {}) {
  const m = Math.max(1, Number(massKg) || 20000);
  if (!Array.isArray(supportPolygon) || supportPolygon.length === 0) {
    return { insideSupport: false, pivot: null, leverArm: { x: 0, z: 0 }, torqueNm: { x: 0, y: 0, z: 0 }, torqueMagNm: 0 };
  }
  const cx = Number(cogWorld.x) || 0;
  const cz = Number(cogWorld.z) || 0;
  if (pointInConvexPolygonXZ({ x: cx, z: cz }, supportPolygon)) {
    return { insideSupport: true, pivot: null, leverArm: { x: 0, z: 0 }, torqueNm: { x: 0, y: 0, z: 0 }, torqueMagNm: 0 };
  }

  let bestDistSq = Infinity;
  let pivot = { x: supportPolygon[0].x, z: supportPolygon[0].z };
  for (let i = 0; i < supportPolygon.length; i++) {
    const a = supportPolygon[i];
    const b = supportPolygon[(i + 1) % supportPolygon.length];
    const q = closestPointOnSegment2D(cx, cz, a.x, a.z, b.x, b.z);
    const dSq = (cx - q.x) ** 2 + (cz - q.z) ** 2;
    if (dSq < bestDistSq) {
      bestDistSq = dSq;
      pivot = q;
    }
  }
  // r = cog - pivot; F = (0, -m*g, 0) => τ = r × F = (-rz * (-mg), 0, rx * (-mg)) -> rotates high corner down toward +r
  const rx = cx - pivot.x;
  const rz = cz - pivot.z;
  const weightN = m * G_SI;
  const tx = -rz * weightN;
  const tz = rx * weightN;
  const mag = Math.hypot(tx, tz);
  return {
    insideSupport: false,
    pivot,
    leverArm: { x: rx, z: rz },
    torqueNm: { x: Number(tx.toFixed(2)), y: 0, z: Number(tz.toFixed(2)) },
    torqueMagNm: Number(mag.toFixed(2))
  };
}

/**
 * Euler-Bernoulli deflection curve δ(x) for any spreader / lifting / H-beam.
 * Uniform load mode uses exact 5·w·L^4 / (384·E·I); point load uses P·L^3 / (48·E·I).
 */
export function bendingDeflectionProfile({
  lengthM = 12,
  loadN = 30 * 1000 * 9.81,
  E_Pa = 200e9,
  I_m4 = 0.0008,
  compressionN = 0,
  distribution = 'uniform',
  numNodes = 21
} = {}) {
  const L = Math.max(0.5, Number(lengthM) || 12);
  const F = Math.max(0, Number(loadN) || 0);
  const E = Math.max(1e9, Number(E_Pa) || 200e9);
  const I = Math.max(1e-6, Number(I_m4) || 0.0008);
  const Pcr = (Math.PI * Math.PI * E * I) / (L * L);
  const P = Math.max(0, Math.min(Number(compressionN) || 0, 0.92 * Pcr));
  const amp = P > 0 ? 1 / (1 - P / Pcr) : 1;

  const w = F / L;
  const rawMidM = distribution === 'point'
    ? (F * Math.pow(L, 3)) / (48 * E * I)
    : (5 * w * Math.pow(L, 4)) / (384 * E * I);
  const maxDeflectionM = rawMidM * amp;

  const nodes = [];
  const count = Math.max(3, numNodes | 0);
  for (let i = 0; i < count; i++) {
    const xi = i / (count - 1);
    const x = (xi - 0.5) * L;
    // Uniform-load exact normalized shape (16/5) * (xi^4 - 2*xi^3 + xi)
    const shape = distribution === 'point'
      ? Math.sin(Math.PI * xi)
      : (16 / 5) * (xi ** 4 - 2 * xi ** 3 + xi);
    nodes.push({ x, deflectionY: -maxDeflectionM * shape });
  }
  return {
    maxDeflectionM,
    maxDeflectionMm: maxDeflectionM * 1000,
    amplificationFactor: amp,
    nodes
  };
}
