// @purpose: Bộ giải va chạm liên tục (CCD), ma sát cặp vật liệu, độ nảy theo khối lượng và chống xuyên giữa các sợi cáp/xích
import * as THREE from 'three';

const GRAVITY = 9.81;

export const CONTACT_MATERIAL_PAIRS = Object.freeze({
  steel_on_steel: Object.freeze({ muStatic: 0.58, muKinetic: 0.42, baseRestitution: 0.18 }),
  steel_on_wood: Object.freeze({ muStatic: 0.48, muKinetic: 0.35, baseRestitution: 0.08 }),
  steel_on_concrete: Object.freeze({ muStatic: 0.62, muKinetic: 0.48, baseRestitution: 0.06 }),
  web_on_steel: Object.freeze({ muStatic: 0.32, muKinetic: 0.24, baseRestitution: 0.03 }),
  chain_on_steel: Object.freeze({ muStatic: 0.55, muKinetic: 0.40, baseRestitution: 0.20 })
});

export function getContactMaterialPair(pairId = 'steel_on_steel') {
  return CONTACT_MATERIAL_PAIRS[pairId] || CONTACT_MATERIAL_PAIRS.steel_on_steel;
}

/**
 * Heavy steel cargo (>= 5000 kg) absorbs energy plastically (e <= 0.02) and produces
 * large impact forces; light forged hardware (< 80 kg) retains metallic bounce (0.14-0.22).
 */
export function computeMassScaledRestitution(pairId = 'steel_on_steel', massKg = 1000, impactSpeedMps = 0, dt = 1 / 60) {
  const pair = getContactMaterialPair(pairId);
  const safeMass = Math.max(0.05, Number.isFinite(massKg) ? massKg : 1000);
  const safeSpeed = Math.max(0, Number.isFinite(impactSpeedMps) ? Math.abs(impactSpeedMps) : 0);
  const safeDt = Math.max(1 / 480, Math.min(0.05, dt || 1 / 60));

  let restitution = pair.baseRestitution;
  if (safeMass >= 5000) {
    const heavyScale = Math.min(1, (safeMass - 5000) / 15000);
    restitution = THREE.MathUtils.lerp(0.02, 0.005, heavyScale);
  } else if (safeMass <= 80) {
    if (pairId === 'steel_on_steel' || pairId === 'chain_on_steel') {
      const hardwareBias = 1 - Math.min(1, safeMass / 80);
      restitution = THREE.MathUtils.clamp(0.14 + 0.08 * hardwareBias, 0.14, 0.22);
    }
  } else {
    const t = Math.log10(safeMass / 80) / Math.log10(5000 / 80);
    restitution = THREE.MathUtils.lerp(pair.baseRestitution, 0.02, THREE.MathUtils.clamp(t, 0, 1));
  }

  if (safeSpeed < 0.15) restitution = 0;
  const contactDuration = safeMass >= 1000 ? safeDt : Math.max(0.004, safeDt * 0.5);
  const deltaV = safeSpeed * (1 + restitution);
  const impactForceN = (safeMass * deltaV) / contactDuration;
  const peakG = impactForceN / (safeMass * GRAVITY);

  return { restitution, impactForceN, peakG };
}

function pushOutSingleObb(point, radius, box, invQuatOut, bestNormal) {
  if (!box || !box.center || !box.half || !box.quat) return 0;
  invQuatOut.copy(box.quat).invert();
  const local = point.clone().sub(box.center).applyQuaternion(invQuatOut);
  const hx = box.half.x ?? box.half.hx ?? 0.1;
  const hy = box.half.y ?? box.half.hy ?? 0.1;
  const hz = box.half.z ?? box.half.hz ?? 0.1;

  const clampedX = THREE.MathUtils.clamp(local.x, -hx, hx);
  const clampedY = THREE.MathUtils.clamp(local.y, -hy, hy);
  const clampedZ = THREE.MathUtils.clamp(local.z, -hz, hz);

  const dx = local.x - clampedX;
  const dy = local.y - clampedY;
  const dz = local.z - clampedZ;
  const distSq = dx * dx + dy * dy + dz * dz;

  if (distSq >= radius * radius) return 0;

  let localNormal;
  let depth = 0;
  if (distSq > 1e-12) {
    const dist = Math.sqrt(distSq);
    depth = radius - dist;
    localNormal = new THREE.Vector3(dx / dist, dy / dist, dz / dist);
  } else {
    const penX = hx - Math.abs(local.x);
    const penY = hy - Math.abs(local.y);
    const penZ = hz - Math.abs(local.z);
    if (penY <= penX && penY <= penZ) {
      localNormal = new THREE.Vector3(0, local.y >= 0 ? 1 : -1, 0);
      depth = penY + radius;
    } else if (penX <= penZ) {
      localNormal = new THREE.Vector3(local.x >= 0 ? 1 : -1, 0, 0);
      depth = penX + radius;
    } else {
      localNormal = new THREE.Vector3(0, 0, local.z >= 0 ? 1 : -1);
      depth = penZ + radius;
    }
  }

  bestNormal.copy(localNormal).applyQuaternion(box.quat).normalize();
  point.addScaledVector(bestNormal, depth);
  return depth;
}

/**
 * Swept-sphere continuous collision detection against OBB solids and the quay ground plane.
 */
export function resolveSweptSphereObbCCD(prevPos, nextPos, radius = 0.02, obbBoxes = [], groundY = 0) {
  const safeR = Math.max(0.004, radius);
  const start = prevPos ? prevPos.clone() : nextPos.clone();
  const target = nextPos.clone();
  const travel = target.distanceTo(start);
  const substeps = Math.max(1, Math.min(24, Math.ceil(travel / Math.max(0.01, safeR * 0.5))));

  const current = start.clone();
  const stepVec = target.clone().sub(start).multiplyScalar(1 / substeps);
  const normal = new THREE.Vector3(0, 1, 0);
  const tmpNormal = new THREE.Vector3();
  const invQ = new THREE.Quaternion();
  let collided = false;
  let maxDepth = 0;
  let contactType = 'none';

  for (let s = 0; s < substeps; s++) {
    current.add(stepVec);
    if (Array.isArray(obbBoxes) && obbBoxes.length > 0) {
      for (let i = 0; i < obbBoxes.length; i++) {
        const depth = pushOutSingleObb(current, safeR, obbBoxes[i], invQ, tmpNormal);
        if (depth > 0) {
          collided = true;
          maxDepth = Math.max(maxDepth, depth);
          normal.copy(tmpNormal);
          contactType = 'obb';
        }
      }
    }
    const minY = (Number.isFinite(groundY) ? groundY : 0) + safeR;
    if (current.y < minY) {
      maxDepth = Math.max(maxDepth, minY - current.y);
      current.y = minY;
      collided = true;
      normal.set(0, 1, 0);
      contactType = contactType === 'obb' ? 'ground_obb' : 'ground';
    }
  }

  return { position: current, collided, normal, penetrationDepthM: maxDepth, contactType };
}

/**
 * Resolves velocity with material-pair Coulomb static/kinetic friction and mass-scaled restitution.
 */
export function applyMaterialCoulombContact(vel, normal, pairId = 'steel_on_steel', massKg = 1000, dt = 1 / 60) {
  const n = normal.clone().normalize();
  const vn = vel.dot(n);
  if (vn >= 0) {
    return { velocity: vel.clone(), normalImpulseNs: 0, impactForceN: 0, peakG: 0, restitution: 0, sticking: false };
  }

  const pair = getContactMaterialPair(pairId);
  const { restitution, impactForceN, peakG } = computeMassScaledRestitution(pairId, massKg, -vn, dt);
  const safeMass = Math.max(0.05, massKg);
  const jn = -(1 + restitution) * vn * safeMass;

  const tangentVel = vel.clone().addScaledVector(n, -vn);
  const vt = tangentVel.length();
  let sticking = false;

  if (vt > 1e-6) {
    const tDir = tangentVel.clone().multiplyScalar(1 / vt);
    const neededFrictionImpulse = safeMass * vt;
    const maxStaticImpulse = pair.muStatic * jn;
    if (neededFrictionImpulse <= maxStaticImpulse) {
      tangentVel.set(0, 0, 0);
      sticking = true;
    } else {
      const kineticImpulse = pair.muKinetic * jn;
      const newVt = Math.max(0, vt - kineticImpulse / safeMass);
      tangentVel.copy(tDir).multiplyScalar(newVt);
    }
  } else {
    sticking = true;
  }

  const nextVn = Math.max(0, -vn * restitution);
  const outVel = tangentVel.addScaledVector(n, nextVn);
  return { velocity: outVel, normalImpulseNs: jn, impactForceN, peakG, restitution, sticking };
}

function closestSegmentPoints(p0, p1, q0, q1) {
  const u = p1.clone().sub(p0);
  const v = q1.clone().sub(q0);
  const w = p0.clone().sub(q0);
  const a = u.dot(u);
  const b = u.dot(v);
  const c = v.dot(v);
  const d = u.dot(w);
  const e = v.dot(w);
  const denom = a * c - b * b;
  let sc, tc;
  if (denom < 1e-9) {
    sc = 0;
    tc = b > c ? d / b : (c > 1e-9 ? e / c : 0);
  } else {
    sc = THREE.MathUtils.clamp((b * e - c * d) / denom, 0, 1);
    tc = THREE.MathUtils.clamp((a * e - b * d) / denom, 0, 1);
  }
  const cP = p0.clone().addScaledVector(u, sc);
  const cQ = q0.clone().addScaledVector(v, tc);
  return { sc, tc, cP, cQ, delta: cP.clone().sub(cQ) };
}

function applyPairSeparation(ptsA, i, ptsB, j, rA, rB) {
  const p0 = ptsA[i], p1 = ptsA[i + 1], q0 = ptsB[j], q1 = ptsB[j + 1];
  const minDist = rA + rB;
  const hit = closestSegmentPoints(p0, p1, q0, q1);
  const dSq = hit.delta.lengthSq();
  if (dSq >= minDist * minDist) return 0;
  const dist = Math.sqrt(dSq);
  const n = dist > 1e-8 ? hit.delta.multiplyScalar(1 / dist) : new THREE.Vector3(1, 0, 0);
  const push = n.multiplyScalar((minDist - dist) * 0.5);
  const wA0 = i === 0 ? 0 : (1 - hit.sc), wA1 = i + 1 === ptsA.length - 1 ? 0 : hit.sc;
  const wB0 = j === 0 ? 0 : (1 - hit.tc), wB1 = j + 1 === ptsB.length - 1 ? 0 : hit.tc;
  const sumA = wA0 + wA1 || 1, sumB = wB0 + wB1 || 1;
  if (wA0 > 0) p0.addScaledVector(push, wA0 / sumA);
  if (wA1 > 0) p1.addScaledVector(push, wA1 / sumA);
  if (wB0 > 0) q0.addScaledVector(push, -(wB0 / sumB));
  if (wB1 > 0) q1.addScaledVector(push, -(wB1 / sumB));
  return 1;
}

/** Enforces capsule-capsule separation across distinct cables/chains so swinging lines never pass through each other. */
export function resolveInterCableCapsuleCollisions(cablePointArrays = [], radiiArray = [], iterations = 2) {
  if (!Array.isArray(cablePointArrays) || cablePointArrays.length < 2) return 0;
  let separations = 0;
  const iters = Math.max(1, Math.min(6, iterations | 0));
  for (let iter = 0; iter < iters; iter++) {
    for (let a = 0; a < cablePointArrays.length; a++) {
      const ptsA = cablePointArrays[a];
      if (!Array.isArray(ptsA) || ptsA.length < 2) continue;
      const rA = Math.max(0.008, radiiArray[a] || 0.02);
      for (let b = a + 1; b < cablePointArrays.length; b++) {
        const ptsB = cablePointArrays[b];
        if (!Array.isArray(ptsB) || ptsB.length < 2) continue;
        const rB = Math.max(0.008, radiiArray[b] || 0.02);
        for (let i = 0; i < ptsA.length - 1; i++) {
          for (let j = 0; j < ptsB.length - 1; j++) {
            separations += applyPairSeparation(ptsA, i, ptsB, j, rA, rB);
          }
        }
      }
    }
  }
  return separations;
}
