// @purpose: Bộ collider hợp chất (sub-OBB + Convex vertices), lọc thô AABB và va chạm tinh SAT/CCD chống xuyên tuyệt đối

function rotateVecByQuat(v, q) {
  const x = v.x || 0, y = v.y || 0, z = v.z || 0;
  const qx = q?.x || 0, qy = q?.y || 0, qz = q?.z || 0, qw = q?.w ?? 1;
  const ix = qw * x + qy * z - qz * y;
  const iy = qw * y + qz * x - qx * z;
  const iz = qw * z + qx * y - qy * x;
  const iw = -qx * x - qy * y - qz * z;
  return {
    x: ix * qw + iw * -qx + iy * -qz - iz * -qy,
    y: iy * qw + iw * -qy + iz * -qx - ix * -qz,
    z: iz * qw + iw * -qz + ix * -qy - iy * -qx
  };
}

function getObbAxes(q) {
  return [
    rotateVecByQuat({ x: 1, y: 0, z: 0 }, q),
    rotateVecByQuat({ x: 0, y: 1, z: 0 }, q),
    rotateVecByQuat({ x: 0, y: 0, z: 1 }, q)
  ];
}

function dot(a, b) {
  return a.x * b.x + a.y * b.y + a.z * b.z;
}

export function buildCompoundBeamCollider({
  center = { x: 0, y: 0, z: 0 },
  quat = { x: 0, y: 0, z: 0, w: 1 },
  spanX = 6,
  beamWidth = 0.36,
  beamHeight = 0.42,
  endPlateHeight = 0.62,
  isHBeam = false,
  crossSpanZ = 2.4
} = {}) {
  const halfX = Math.max(0.25, spanX * 0.5);
  const hw = Math.max(0.08, beamWidth * 0.5);
  const hh = Math.max(0.08, beamHeight * 0.5);
  const eph = Math.max(hh, endPlateHeight * 0.5);
  const obbs = [];

  const addLocalObb = (lx, ly, lz, hx, hy, hz, tag) => {
    const off = rotateVecByQuat({ x: lx, y: ly, z: lz }, quat);
    obbs.push({
      tag,
      center: { x: center.x + off.x, y: center.y + off.y, z: center.z + off.z },
      half: { x: hx, y: hy, z: hz },
      quat: { x: quat.x || 0, y: quat.y || 0, z: quat.z || 0, w: quat.w ?? 1 }
    });
  };

  if (isHBeam) {
    const hz = Math.max(0.3, crossSpanZ * 0.5);
    addLocalObb(0, 0, 0, halfX, hh, hw, 'spine');
    addLocalObb(-halfX * 0.9, 0, 0, hw * 1.1, hh, hz, 'cross_left');
    addLocalObb(halfX * 0.9, 0, 0, hw * 1.1, hh, hz, 'cross_right');
  } else {
    addLocalObb(0, 0, 0, halfX, hh, hw, 'main_tube');
    addLocalObb(-halfX * 0.95, 0, 0, 0.14, eph, hw * 1.35, 'end_plate_left');
    addLocalObb(halfX * 0.95, 0, 0, 0.14, eph, hw * 1.35, 'end_plate_right');
    addLocalObb(0, hh + 0.08, 0, 0.22, 0.08, hw * 0.9, 'center_lug');
  }
  return { kind: isHBeam ? 'hbeam' : 'beam', obbs, aabb: computeCompoundAabb(obbs) };
}

export function buildCompoundCargoCollider({
  center = { x: 0, y: 1.3, z: 0 },
  quat = { x: 0, y: 0, z: 0, w: 1 },
  L = 6.06,
  W = 2.44,
  H = 2.59
} = {}) {
  const obbs = [{
    tag: 'cargo_hull',
    center: { x: center.x || 0, y: center.y || 0, z: center.z || 0 },
    half: { x: Math.max(0.1, L * 0.5), y: Math.max(0.1, H * 0.5), z: Math.max(0.1, W * 0.5) },
    quat: { x: quat.x || 0, y: quat.y || 0, z: quat.z || 0, w: quat.w ?? 1 }
  }];
  return { kind: 'cargo', obbs, aabb: computeCompoundAabb(obbs) };
}

export function computeCompoundAabb(obbs = []) {
  let minX = Infinity, minY = Infinity, minZ = Infinity;
  let maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;
  for (const box of obbs) {
    const axes = getObbAxes(box.quat);
    const rx = Math.abs(axes[0].x) * box.half.x + Math.abs(axes[1].x) * box.half.y + Math.abs(axes[2].x) * box.half.z;
    const ry = Math.abs(axes[0].y) * box.half.x + Math.abs(axes[1].y) * box.half.y + Math.abs(axes[2].y) * box.half.z;
    const rz = Math.abs(axes[0].z) * box.half.x + Math.abs(axes[1].z) * box.half.y + Math.abs(axes[2].z) * box.half.z;
    minX = Math.min(minX, box.center.x - rx); maxX = Math.max(maxX, box.center.x + rx);
    minY = Math.min(minY, box.center.y - ry); maxY = Math.max(maxY, box.center.y + ry);
    minZ = Math.min(minZ, box.center.z - rz); maxZ = Math.max(maxZ, box.center.z + rz);
  }
  return { minX, minY, minZ, maxX, maxY, maxZ };
}

export function aabbOverlap(a, b) {
  return a && b && a.minX <= b.maxX && a.maxX >= b.minX
    && a.minY <= b.maxY && a.maxY >= b.minY
    && a.minZ <= b.maxZ && a.maxZ >= b.minZ;
}

/** Separating Axis Theorem (15 axes) between two OBBs; pushes OBB A along minimum penetration normal. */
export function satObbVsObb(boxA, boxB) {
  const A = getObbAxes(boxA.quat);
  const B = getObbAxes(boxB.quat);
  const aH = [boxA.half.x, boxA.half.y, boxA.half.z];
  const bH = [boxB.half.x, boxB.half.y, boxB.half.z];
  const d = { x: boxA.center.x - boxB.center.x, y: boxA.center.y - boxB.center.y, z: boxA.center.z - boxB.center.z };

  const testAxes = [...A, ...B];
  for (let i = 0; i < 3; i++) {
    for (let j = 0; j < 3; j++) {
      testAxes.push({
        x: A[i].y * B[j].z - A[i].z * B[j].y,
        y: A[i].z * B[j].x - A[i].x * B[j].z,
        z: A[i].x * B[j].y - A[i].y * B[j].x
      });
    }
  }

  let minOverlap = Infinity;
  let bestAxis = { x: 0, y: 1, z: 0 };
  for (const raw of testAxes) {
    const len = Math.hypot(raw.x, raw.y, raw.z);
    if (len < 1e-6) continue;
    const axis = { x: raw.x / len, y: raw.y / len, z: raw.z / len };
    const rA = aH[0] * Math.abs(dot(axis, A[0])) + aH[1] * Math.abs(dot(axis, A[1])) + aH[2] * Math.abs(dot(axis, A[2]));
    const rB = bH[0] * Math.abs(dot(axis, B[0])) + bH[1] * Math.abs(dot(axis, B[1])) + bH[2] * Math.abs(dot(axis, B[2]));
    const dist = Math.abs(dot(d, axis));
    const overlap = (rA + rB) - dist;
    if (overlap <= 0) return { collided: false, penetrationM: 0, normal: { x: 0, y: 1, z: 0 } };
    if (overlap < minOverlap) {
      minOverlap = overlap;
      const sign = dot(d, axis) >= 0 ? 1 : -1;
      bestAxis = { x: axis.x * sign, y: axis.y * sign, z: axis.z * sign };
    }
  }
  return {
    collided: minOverlap > 0 && Number.isFinite(minOverlap),
    penetrationM: Number.isFinite(minOverlap) ? minOverlap : 0,
    normal: bestAxis
  };
}

export function resolveCompoundContact(compA, compB) {
  if (!compA?.obbs?.length || !compB?.obbs?.length) {
    return { collided: false, penetrationM: 0, normal: { x: 0, y: 1, z: 0 }, point: null };
  }
  const aabbA = compA.aabb || computeCompoundAabb(compA.obbs);
  const aabbB = compB.aabb || computeCompoundAabb(compB.obbs);
  if (!aabbOverlap(aabbA, aabbB)) {
    return { collided: false, penetrationM: 0, normal: { x: 0, y: 1, z: 0 }, point: null };
  }
  let maxPen = 0;
  let bestNormal = { x: 0, y: 1, z: 0 };
  let bestPoint = null;
  for (const boxA of compA.obbs) {
    for (const boxB of compB.obbs) {
      const hit = satObbVsObb(boxA, boxB);
      if (hit.collided && hit.penetrationM > maxPen) {
        maxPen = hit.penetrationM;
        bestNormal = hit.normal;
        bestPoint = {
          x: (boxA.center.x + boxB.center.x) * 0.5,
          y: boxA.center.y - bestNormal.y * boxA.half.y,
          z: (boxA.center.z + boxB.center.z) * 0.5
        };
      }
    }
  }
  return {
    collided: maxPen > 0,
    penetrationM: maxPen,
    normal: bestNormal,
    point: bestPoint
  };
}

export function resolveCompoundSweptContact({ prevPos, nextPos, makeColliderA, colliderB, groundY = 0 }) {
  const dx = nextPos.x - prevPos.x;
  const dy = nextPos.y - prevPos.y;
  const dz = nextPos.z - prevPos.z;
  const dist = Math.hypot(dx, dy, dz);
  const steps = Math.max(1, Math.min(24, Math.ceil(dist / 0.04)));
  const pos = { x: prevPos.x, y: prevPos.y, z: prevPos.z };
  let collided = false;
  let normal = { x: 0, y: 1, z: 0 };
  let penetrationM = 0;
  for (let s = 1; s <= steps; s++) {
    pos.x = prevPos.x + (dx * s) / steps;
    pos.y = prevPos.y + (dy * s) / steps;
    pos.z = prevPos.z + (dz * s) / steps;
    const compA = makeColliderA(pos);
    const hit = resolveCompoundContact(compA, colliderB);
    if (hit.collided) {
      pos.x += hit.normal.x * hit.penetrationM;
      pos.y += hit.normal.y * hit.penetrationM;
      pos.z += hit.normal.z * hit.penetrationM;
      collided = true;
      normal = hit.normal;
      penetrationM = Math.max(penetrationM, hit.penetrationM);
      break;
    }
    const aabb = compA.aabb || computeCompoundAabb(compA.obbs);
    if (aabb.minY < groundY) {
      const gPen = groundY - aabb.minY;
      pos.y += gPen;
      collided = true;
      normal = { x: 0, y: 1, z: 0 };
      penetrationM = Math.max(penetrationM, gPen);
      break;
    }
  }
  return { position: pos, collided, normal, penetrationM };
}
