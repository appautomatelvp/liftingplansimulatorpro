// @purpose: Mô phỏng XPBD sóng quật, thu hồi năng lượng đàn hồi và va chạm CCD cho hai nửa cáp đứt hoặc cáp tháo chốt
import * as THREE from 'three';
import { applyMaterialCoulombContact, resolveSweptSphereObbCCD } from './CollisionMaterialSolver.js';

const GRAVITY = 9.81;
const MAX_RECOIL_SPEED = 35;

export const CABLE_MATERIAL_PROFILES = Object.freeze({
  wire: Object.freeze({
    youngsModulusPa: 100e9,
    densityFactor: 0.62,
    bendRadiusDiameters: 30,
    bendCompliance: 0.001,
    airDamping: 0.45
  }),
  chain: Object.freeze({
    youngsModulusPa: 200e9,
    densityFactor: 0.9,
    bendRadiusDiameters: 0,
    bendCompliance: 0.08,
    airDamping: 0.32
  }),
  web: Object.freeze({
    youngsModulusPa: 5e9,
    densityFactor: 0.08,
    bendRadiusDiameters: 2,
    bendCompliance: 0.05,
    airDamping: 1.8
  })
});

export function normalizeCableMaterial(material = 'wire') {
  const key = material === 'round_sling' || material === 'synthetic' || material === 'poly' ? 'web' : material;
  return CABLE_MATERIAL_PROFILES[key] ? key : 'wire';
}

export function computeElasticSnapRecoil({ tensionN, lengthM, youngsModulusPa, areaM2, linearMassKgM, maxRecoilSpeedMps = MAX_RECOIL_SPEED }) {
  const safeT = Math.max(0, tensionN || 0);
  const safeL = Math.max(0.05, lengthM || 1);
  const safeEA = Math.max(1, (youngsModulusPa || 100e9) * (areaM2 || 1e-4));
  const extensionM = (safeT * safeL) / safeEA;
  const storedElasticEnergyJ = 0.5 * safeT * extensionM;
  const cableMassKg = Math.max(0.05, (linearMassKgM || 1) * safeL);
  const rawSpeed = Math.sqrt((2 * storedElasticEnergyJ) / cableMassKg);
  return {
    extensionM,
    storedElasticEnergyJ,
    recoilSpeedMps: Math.min(maxRecoilSpeedMps, rawSpeed)
  };
}

function buildBranchNodes(start, end, restLen, segs, pinStart, pinEnd, massPerNode) {
  const positions = [];
  const previous = [];
  const invMasses = [];
  const invM = 1 / Math.max(0.02, massPerNode);
  for (let i = 0; i <= segs; i++) {
    const p = start.clone().lerp(end, i / segs);
    positions.push(p);
    previous.push(p.clone());
    const pinned = (i === 0 && pinStart) || (i === segs && pinEnd);
    invMasses.push(pinned ? 0 : invM);
  }
  return { positions, previous, invMasses, segLen: restLen / segs, pinStart, pinEnd, massPerNode };
}

function solveDistancePass(branch) {
  const { positions, invMasses, segLen } = branch;
  const delta = new THREE.Vector3();
  for (let i = 0; i < positions.length - 1; i++) {
    const a = positions[i], b = positions[i + 1];
    const wa = invMasses[i], wb = invMasses[i + 1];
    const wSum = wa + wb;
    if (wSum <= 0) continue;
    delta.subVectors(b, a);
    const d = delta.length();
    if (d < 1e-9) continue;
    const corr = (d - segLen) / d;
    a.addScaledVector(delta, (wa / wSum) * corr);
    b.addScaledVector(delta, -(wb / wSum) * corr);
  }
}

/**
 * Multi-node XPBD whip simulator for snapped lifting slings (upper and lower stubs).
 */
export class BrokenCableWhipSimulator {
  constructor({ totalLengthM = 4, breakFraction = 0.5, diameterMm = 16, material = 'wire', segmentsPerHalf = 12 } = {}) {
    const matKey = normalizeCableMaterial(material);
    this.profile = CABLE_MATERIAL_PROFILES[matKey];
    this.material = matKey;
    this.totalLengthM = Math.max(0.3, totalLengthM);
    this.breakFraction = THREE.MathUtils.clamp(breakFraction, 0.15, 0.85);
    this.diameterM = Math.max(0.006, diameterMm / 1000);
    this.areaM2 = Math.PI * (this.diameterM * 0.5) ** 2;
    this.linearMassKgM = matKey === 'web'
      ? Math.max(0.12, this.profile.densityFactor * diameterMm / 50)
      : Math.max(0.25, 7850 * this.areaM2 * this.profile.densityFactor);
    this.radiusM = matKey === 'chain' ? this.diameterM * 1.1 : Math.max(0.014, this.diameterM * 0.55);
    this.segmentsPerHalf = Math.max(6, Math.min(24, segmentsPerHalf | 0));
    this.upper = null;
    this.lower = null;
    this.recoilSpeedMps = 0;
    this.storedElasticEnergyJ = 0;
    this.age = 0;
  }

  triggerSnap(pointA, pointB, tensionN = 0, { detachA = false, detachB = false, lateralHint = null } = {}) {
    const segU = this.segmentsPerHalf;
    const segL = this.segmentsPerHalf;
    const upperLen = Math.max(0.15, this.totalLengthM * this.breakFraction);
    const lowerLen = Math.max(0.15, this.totalLengthM * (1 - this.breakFraction));
    const snapPt = pointA.clone().lerp(pointB, this.breakFraction);
    const axis = pointB.clone().sub(pointA);
    if (axis.lengthSq() < 1e-8) axis.set(0, -1, 0);
    axis.normalize();

    const perp = lateralHint ? lateralHint.clone() : new THREE.Vector3().crossVectors(axis, new THREE.Vector3(0, 1, 0));
    if (perp.lengthSq() < 1e-6) perp.set(1, 0, 0);
    perp.normalize();

    const recoil = computeElasticSnapRecoil({
      tensionN,
      lengthM: this.totalLengthM,
      youngsModulusPa: this.profile.youngsModulusPa,
      areaM2: this.areaM2,
      linearMassKgM: this.linearMassKgM
    });
    this.recoilSpeedMps = recoil.recoilSpeedMps;
    this.storedElasticEnergyJ = recoil.storedElasticEnergyJ;
    this.age = 0;

    const uMass = (this.linearMassKgM * upperLen) / segU;
    const lMass = (this.linearMassKgM * lowerLen) / segL;
    this.upper = buildBranchNodes(pointA, snapPt, upperLen, segU, !detachA, false, uMass);
    this.lower = buildBranchNodes(pointB, snapPt, lowerLen, segL, !detachB, false, lMass);

    const seedDt = 1 / 60;
    const whipAmp = Math.min(8, recoil.recoilSpeedMps * 0.35);
    const injectWhip = (branch, signAlong) => {
      const n = branch.positions.length - 1;
      for (let i = 0; i <= n; i++) {
        if (branch.invMasses[i] === 0) continue;
        const t = i / n;
        const whipVel = axis.clone().multiplyScalar(signAlong * recoil.recoilSpeedMps * t)
          .addScaledVector(perp, signAlong * whipAmp * Math.sin(Math.PI * t));
        branch.previous[i].copy(branch.positions[i]).addScaledVector(whipVel, -seedDt);
      }
    };
    injectWhip(this.upper, -1);
    injectWhip(this.lower, 1);
    return {
      recoilSpeedMps: this.recoilSpeedMps,
      storedElasticEnergyJ: this.storedElasticEnergyJ,
      upperTip: this.upper.positions[segU],
      lowerTip: this.lower.positions[segL]
    };
  }

  _stepBranch(branch, anchorWorld, subDt, obbBoxes, groundY, pairId) {
    if (!branch) return;
    if (branch.pinStart && anchorWorld) {
      branch.positions[0].copy(anchorWorld);
      branch.previous[0].copy(anchorWorld);
    }
    const drag = Math.exp(-this.profile.airDamping * subDt);
    const vel = new THREE.Vector3();
    for (let i = 0; i < branch.positions.length; i++) {
      if (branch.invMasses[i] === 0) continue;
      const pos = branch.positions[i];
      const prev = branch.previous[i];
      vel.subVectors(pos, prev).multiplyScalar(drag / subDt);
      vel.y -= GRAVITY * subDt;
      const candidate = pos.clone().addScaledVector(vel, subDt);
      const hit = resolveSweptSphereObbCCD(pos, candidate, this.radiusM, obbBoxes, groundY);
      if (hit.collided) {
        const res = applyMaterialCoulombContact(vel, hit.normal, pairId, branch.massPerNode, subDt);
        prev.copy(hit.position).addScaledVector(res.velocity, -subDt);
        pos.copy(hit.position);
      } else {
        prev.copy(pos);
        pos.copy(candidate);
      }
    }
    for (let iter = 0; iter < 8; iter++) {
      solveDistancePass(branch);
      if (branch.pinStart && anchorWorld) branch.positions[0].copy(anchorWorld);
    }
    for (let i = 0; i < branch.positions.length; i++) {
      if (branch.invMasses[i] === 0) continue;
      const hit = resolveSweptSphereObbCCD(branch.previous[i], branch.positions[i], this.radiusM, obbBoxes, groundY);
      if (hit.collided) branch.positions[i].copy(hit.position);
    }
  }

  step(dt, anchorA, anchorB, { obbBoxes = [], groundY = 0, pairId = 'steel_on_steel' } = {}) {
    if (!this.upper || !this.lower || !(dt > 0)) return null;
    const steps = Math.max(1, Math.min(6, Math.ceil(dt / (1 / 120))));
    const subDt = Math.min(1 / 60, dt / steps);
    for (let s = 0; s < steps; s++) {
      this._stepBranch(this.upper, anchorA, subDt, obbBoxes, groundY, pairId);
      this._stepBranch(this.lower, anchorB, subDt, obbBoxes, groundY, pairId);
    }
    this.age += dt;
    return {
      upperPoints: this.upper.positions.map((p) => p.clone()),
      lowerPoints: this.lower.positions.map((p) => p.clone()),
      upperTip: this.upper.positions[this.upper.positions.length - 1].clone(),
      lowerTip: this.lower.positions[this.lower.positions.length - 1].clone()
    };
  }
}
