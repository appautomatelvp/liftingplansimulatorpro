// @purpose: Động lực học vật rắn lệch tâm (Steiner-Huygens Inertia Tensor), mô-men xoắn/nghiêng khi cẩu và rơi tự do 9.81 m/s²
import * as THREE from 'three';
import { BrokenCableWhipSimulator } from './BrokenCableWhipXPBD.js';
import {
  applyMaterialCoulombContact,
  resolveInterCableCapsuleCollisions,
  resolveSweptSphereObbCCD
} from './CollisionMaterialSolver.js';

const GRAVITY = 9.81;

/**
 * Computes the 3x3 inertia tensor of a rectangular rigid body shifted to an eccentric CoG
 * using the parallel-axis theorem (Steiner-Huygens): I = I_box + m * ((d.d)E - d x d^T).
 */
export function computeEccentricInertiaTensor(massKg = 1000, dimsM = { L: 2, W: 2, H: 2 }, cogOffsetM = { x: 0, y: 0, z: 0 }) {
  const m = Math.max(0.1, Number.isFinite(massKg) ? massKg : 1000);
  const L = Math.max(0.1, dimsM.L || 2);
  const W = Math.max(0.1, dimsM.W || 2);
  const H = Math.max(0.1, dimsM.H || 2);
  const dx = Number.isFinite(cogOffsetM.x) ? cogOffsetM.x : 0;
  const dy = Number.isFinite(cogOffsetM.y) ? cogOffsetM.y : 0;
  const dz = Number.isFinite(cogOffsetM.z) ? cogOffsetM.z : 0;

  const ibx = (m / 12) * (H * H + W * W);
  const iby = (m / 12) * (L * L + W * W);
  const ibz = (m / 12) * (L * L + H * H);
  const d2 = dx * dx + dy * dy + dz * dz;

  const ixx = ibx + m * (d2 - dx * dx);
  const iyy = iby + m * (d2 - dy * dy);
  const izz = ibz + m * (d2 - dz * dz);
  const ixy = -m * dx * dy;
  const ixz = -m * dx * dz;
  const iyz = -m * dy * dz;

  const matrix = new THREE.Matrix3().set(
    ixx, ixy, ixz,
    ixy, iyy, iyz,
    ixz, iyz, izz
  );
  const inverseMatrix = matrix.clone().invert();
  return { massKg: m, ixx, iyy, izz, ixy, ixz, iyz, matrix, inverseMatrix };
}

/**
 * Evaluates net force and 3D rotational torque induced by rigging sling tensions about an eccentric CoG.
 */
export function computeAsymmetricRiggingTorque({
  anchorPointsWorld = [],
  tensionsN = [],
  pullTargetWorld = null,
  cogWorld = new THREE.Vector3(),
  massKg = 1000,
  inertia = null
} = {}) {
  const netForce = new THREE.Vector3(0, -Math.max(0.1, massKg) * GRAVITY, 0);
  const netTorque = new THREE.Vector3(0, 0, 0);
  const activeLegs = [];

  for (let i = 0; i < anchorPointsWorld.length; i++) {
    const pt = anchorPointsWorld[i];
    const tMag = Math.max(0, tensionsN[i] || 0);
    if (!pt || tMag <= 0) continue;
    const upper = Array.isArray(pullTargetWorld) ? pullTargetWorld[i] : pullTargetWorld;
    const dir = upper ? upper.clone().sub(pt) : new THREE.Vector3(0, 1, 0);
    if (dir.lengthSq() < 1e-8) dir.set(0, 1, 0);
    dir.normalize();
    const force = dir.multiplyScalar(tMag);
    netForce.add(force);
    const lever = pt.clone().sub(cogWorld);
    netTorque.add(new THREE.Vector3().crossVectors(lever, force));
    activeLegs.push(i);
  }

  const tensor = inertia || computeEccentricInertiaTensor(massKg);
  const angularAccel = netTorque.clone().applyMatrix3(tensor.inverseMatrix);
  return {
    netForce,
    netTorque,
    angularAccel,
    torqueMagnitudeNm: netTorque.length(),
    tiltAxis: netTorque.lengthSq() > 1e-6 ? netTorque.clone().normalize() : new THREE.Vector3(0, 0, 1),
    activeLegCount: activeLegs.length
  };
}

/**
 * Steps any detached rigid body (hookless cargo, dropped beam, severed shackle) under -9.81 m/s^2 gravity
 * with zero floating, swept CCD solid resolution, Coulomb contact friction, and corner tipping torque.
 */
export function stepDetachedBodyUnderGravity(bodyState, dt = 1 / 60, {
  groundY = 0,
  obbList = [],
  pairId = 'steel_on_concrete'
} = {}) {
  if (!bodyState || !(dt > 0)) return bodyState;
  const h = Math.min(1 / 30, Math.max(1 / 240, dt));
  const massKg = Math.max(0.1, bodyState.massKg || 100);
  const halfY = Math.max(0.02, bodyState.halfY || 0.25);
  const halfX = Math.max(0.02, bodyState.halfX || halfY);
  const halfZ = Math.max(0.02, bodyState.halfZ || halfY);
  if (!bodyState.quaternion) bodyState.quaternion = new THREE.Quaternion();
  if (!bodyState.velocity) bodyState.velocity = new THREE.Vector3();
  if (!bodyState.omega) bodyState.omega = new THREE.Vector3();

  // Apply continuous Earth gravity (-9.81 m/s^2) whenever unsupported or released
  bodyState.velocity.y -= GRAVITY * h;
  const prevPos = bodyState.position.clone();
  const nextPos = prevPos.clone().addScaledVector(bodyState.velocity, h);

  // Rotate body with current angular velocity
  const omegaMag = bodyState.omega.length();
  if (omegaMag > 1e-6) {
    const dq = new THREE.Quaternion().setFromAxisAngle(bodyState.omega.clone().divideScalar(omegaMag), omegaMag * h);
    bodyState.quaternion.premultiply(dq).normalize();
  }

  // Evaluate bottommost corner offset under current orientation for flush ground/OBB support
  const corners = [
    new THREE.Vector3(-halfX, -halfY, -halfZ), new THREE.Vector3(halfX, -halfY, -halfZ),
    new THREE.Vector3(-halfX, -halfY, halfZ), new THREE.Vector3(halfX, -halfY, halfZ),
    new THREE.Vector3(-halfX, halfY, -halfZ), new THREE.Vector3(halfX, halfY, -halfZ),
    new THREE.Vector3(-halfX, halfY, halfZ), new THREE.Vector3(halfX, halfY, halfZ)
  ];
  let lowestDy = 0;
  const lowestLocal = new THREE.Vector3();
  for (let i = 0; i < corners.length; i++) {
    const worldRel = corners[i].clone().applyQuaternion(bodyState.quaternion);
    if (worldRel.y < lowestDy) {
      lowestDy = worldRel.y;
      lowestLocal.copy(worldRel);
    }
  }
  const supportFloor = (Number.isFinite(groundY) ? groundY : 0) - lowestDy;
  const hit = resolveSweptSphereObbCCD(prevPos, nextPos, Math.min(halfX, halfY, halfZ) * 0.5, obbList, supportFloor - Math.min(halfX, halfY, halfZ) * 0.5);
  bodyState.position.copy(hit.position);

  let impactForceN = 0;
  let peakG = 0;
  if (hit.collided || bodyState.position.y <= supportFloor + 1e-4) {
    const normal = hit.collided ? hit.normal : new THREE.Vector3(0, 1, 0);
    if (bodyState.position.y < supportFloor) bodyState.position.y = supportFloor;
    const contact = applyMaterialCoulombContact(bodyState.velocity, normal, pairId, massKg, h);
    bodyState.velocity.copy(contact.velocity);
    impactForceN = contact.impactForceN;
    peakG = contact.peakG;

    // Righting torque around the contact point tilts an angled box flat under gravity
    const rContact = lowestLocal.clone();
    const leverToCog = rContact.clone().negate();
    const gravTorque = new THREE.Vector3().crossVectors(leverToCog, new THREE.Vector3(0, -massKg * GRAVITY, 0));
    const inertiaApprox = (massKg / 6) * (halfX * halfX + halfY * halfY + halfZ * halfZ);
    bodyState.omega.addScaledVector(gravTorque, h / Math.max(0.1, inertiaApprox));
    bodyState.omega.multiplyScalar(Math.exp(-4.5 * h));
    bodyState.grounded = Math.abs(bodyState.velocity.y) < 0.08 && bodyState.position.y <= supportFloor + 0.02;
  } else {
    bodyState.grounded = false;
  }

  bodyState.lastImpactForceN = Math.max(bodyState.lastImpactForceN || 0, impactForceN);
  bodyState.lastPeakG = Math.max(bodyState.lastPeakG || 0, peakG);
  return bodyState;
}

function buildCargoObbList(cargoPos, cargoQuat, dims) {
  if (!cargoPos) return [];
  return [{
    center: cargoPos,
    half: new THREE.Vector3(((dims && dims.L) || 6) * 0.5, ((dims && dims.H) || 2.5) * 0.5, ((dims && dims.W) || 2.4) * 0.5),
    quat: cargoQuat || new THREE.Quaternion()
  }];
}

export function applyBrokenTipCCD(tip, vel, previous, radius, cargoPos, cargoQuat, dims, groundY = 0) {
  if (!previous) return { collided: false, normal: null };
  const ccd = resolveSweptSphereObbCCD(previous, tip, radius, buildCargoObbList(cargoPos, cargoQuat, dims), groundY);
  if (!ccd.collided) return { collided: false, normal: null };
  tip.copy(ccd.position);
  vel.copy(applyMaterialCoulombContact(vel, ccd.normal, 'steel_on_steel', 12, 1 / 60).velocity);
  return { collided: true, normal: ccd.normal };
}

export function stepBrokenWhipPath(slingObj, br, meta, pointA, end, workLen, look, dims, cargoPos, cargoQuat, groundY = 0) {
  if (!br || !br.wasTaut || (br.age || 0) >= 1.25) return null;
  if (!slingObj._whipSim || slingObj._whipAge > (br.age || 0)) {
    slingObj._whipSim = new BrokenCableWhipSimulator({
      totalLengthM: workLen,
      breakFraction: br.frac || 0.5,
      diameterMm: (meta && meta.diaMm) || 16,
      material: look,
      segmentsPerHalf: Math.max(8, (slingObj && slingObj.numSegments) || 10)
    });
    slingObj._whipSim.triggerSnap(pointA, end, (br.snapTensionT || 10) * 9810, { lateralHint: br.velU });
  }
  slingObj._whipAge = br.age || 0;
  const res = slingObj._whipSim.step(1 / 60, pointA, end, { obbBoxes: buildCargoObbList(cargoPos, cargoQuat, dims), groundY });
  return meta && meta.brokenHalf === 'upper' ? res?.upperPoints : res?.lowerPoints;
}

export function applySlingPoolCapsuleSeparation(slingObj, pool, pts, simPad) {
  slingObj._renderedPts = pts;
  slingObj._renderedRad = simPad;
  if (!Array.isArray(pool)) return;
  const peer = pool.find((s) => s !== slingObj && s.group?.visible && Array.isArray(s._renderedPts));
  if (peer) resolveInterCableCapsuleCollisions([pts, peer._renderedPts], [simPad, peer._renderedRad || simPad], 1);
}
