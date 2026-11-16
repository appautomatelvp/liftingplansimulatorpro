// @purpose: Bộ giải động lực học cáp/xích XPBD chịu kéo, tự va chạm và đứt thu hồi đàn hồi
import * as THREE from 'three';
import { CABLE_MATERIAL_PROFILES, computeElasticSnapRecoil, normalizeCableMaterial } from './BrokenCableWhipXPBD.js';

export { CABLE_MATERIAL_PROFILES };

const GRAVITY = 9.81;

function finiteVector(value) {
  return value && Number.isFinite(value.x) && Number.isFinite(value.y) && Number.isFinite(value.z);
}

/** Time-stepped XPBD model for a flexible, tension-only cable or chain. */
export class CableDynamicsXPBD {
  constructor({ lengthM, diameterMm = 16, material = 'wire', segments = 40, youngsModulusPa } = {}) {
    if (!(Number.isFinite(lengthM) && lengthM > 0)) throw new RangeError('lengthM must be positive');
    const key = material === 'round_sling' || material === 'synthetic' ? 'web' : (CABLE_MATERIAL_PROFILES[material] ? material : normalizeCableMaterial(material));
    if (!CABLE_MATERIAL_PROFILES[key] || (material !== 'wire' && material !== 'chain' && material !== 'web' && material !== 'round_sling' && material !== 'synthetic')) {
      throw new RangeError(`Unsupported cable material: ${material}`);
    }
    this.profile = CABLE_MATERIAL_PROFILES[key];
    this.material = key;
    this.lengthM = lengthM;
    this.diameterM = Math.max(0.003, diameterMm / 1000);
    this.segments = Math.max(6, Math.min(80, Math.round(segments)));
    this.segmentLength = lengthM / this.segments;
    this.youngsModulusPa = youngsModulusPa || this.profile.youngsModulusPa;
    this.areaM2 = Math.PI * (this.diameterM / 2) ** 2;
    this.linearMassKgM = key === 'web'
      ? Math.max(0.05, this.profile.densityFactor * diameterMm / 50)
      : 7850 * this.areaM2 * this.profile.densityFactor;
    this.radiusM = key === 'chain' ? this.diameterM * 1.1 : Math.max(0.004, this.diameterM / 2);
    this.positions = [];
    this.previous = [];
    this.inverseMasses = [];
    this.pinnedA = true;
    this.pinnedB = true;
    this.brokenSegment = null;
    this.lastDt = 1 / 60;
    this._bendLambda = new Float64Array(this.segments + 1);
    this._curvatureLambda = new Float64Array(this.segments + 1);
    this._distanceLambda = new Float64Array(this.segments);
  }

  reset(pointA, pointB) {
    if (!finiteVector(pointA) || !finiteVector(pointB)) throw new TypeError('Cable endpoints must be finite vectors');
    const chord = pointA.distanceTo(pointB);
    const slack = Math.max(0, this.lengthM - chord);
    const initialSag = Math.min(this.lengthM * 0.45, Math.sqrt(3 * chord * slack / 8));
    this.positions = Array.from({ length: this.segments + 1 }, (_, i) => {
      const t = i / this.segments;
      return pointA.clone().lerp(pointB, t).add(new THREE.Vector3(0, -initialSag * Math.sin(Math.PI * t), 0));
    });
    this.previous = this.positions.map((point) => point.clone());
    this.inverseMasses = Array(this.segments + 1).fill(1 / Math.max(1e-5, this.linearMassKgM * this.segmentLength));
    this.pinnedA = true;
    this.pinnedB = true;
    this.brokenSegment = null;
    this._setEndpointInverseMasses();
    this._distanceLambda.fill(0);
    this._bendLambda.fill(0);
    this._curvatureLambda.fill(0);
    return this;
  }

  _setEndpointInverseMasses() {
    const nodeInvM = 1 / Math.max(1e-5, this.linearMassKgM * this.segmentLength);
    this.inverseMasses[0] = this.pinnedA ? 0 : nodeInvM;
    this.inverseMasses[this.segments] = this.pinnedB ? 0 : nodeInvM;
  }

  setPins(pinnedA, pinnedB) {
    this.pinnedA = !!pinnedA;
    this.pinnedB = !!pinnedB;
    if (this.inverseMasses.length === this.segments + 1) this._setEndpointInverseMasses();
    return this;
  }

  _projectDistance(index, dt, hard = false) {
    if (index === this.brokenSegment) return;
    const a = this.positions[index];
    const b = this.positions[index + 1];
    const delta = b.clone().sub(a);
    const distance = delta.length();
    if (distance < 1e-9) return;
    const constraint = distance - this.segmentLength;
    const wa = this.inverseMasses[index];
    const wb = this.inverseMasses[index + 1];
    if (wa + wb === 0) return;
    const alpha = hard ? 0 : (this.segmentLength / (this.youngsModulusPa * this.areaM2)) / (dt * dt);
    const lambda = this._distanceLambda[index];
    const change = (-constraint - alpha * lambda) / (wa + wb + alpha);
    this._distanceLambda[index] += change;
    const direction = delta.multiplyScalar(1 / distance);
    a.addScaledVector(direction, -wa * change);
    b.addScaledVector(direction, wb * change);
  }

  _projectBending(index, dt) {
    if (!(this.profile.bendRadiusDiameters > 0) || index < 1 || index >= this.segments) return;
    const first = this.positions[index - 1], center = this.positions[index], third = this.positions[index + 1];
    const wa = this.inverseMasses[index - 1], wb = this.inverseMasses[index], wc = this.inverseMasses[index + 1];
    const curveDelta = center.clone().sub(first.clone().add(third).multiplyScalar(0.5));
    const curveDistance = curveDelta.length();
    if (curveDistance > 1e-9 && this.profile.bendCompliance > 0) {
      const weight = wb + 0.25 * (wa + wc), alpha = this.profile.bendCompliance / (dt * dt);
      const change = (-curveDistance - alpha * this._curvatureLambda[index]) / (weight + alpha);
      this._curvatureLambda[index] += change;
      curveDelta.multiplyScalar(1 / curveDistance);
      first.addScaledVector(curveDelta, -0.5 * wa * change);
      center.addScaledVector(curveDelta, wb * change);
      third.addScaledVector(curveDelta, -0.5 * wc * change);
    }
    const span = third.clone().sub(first), distance = span.length();
    if (distance < 1e-9) return;
    const radius = Math.max(this.profile.bendRadiusDiameters * this.diameterM, this.segmentLength * 0.45);
    const maxTurn = THREE.MathUtils.clamp(this.segmentLength / radius, 0.06, 0.5);
    const constraint = distance - 2 * this.segmentLength * Math.cos(maxTurn / 2);
    if (constraint >= 0) { this._bendLambda[index] = 0; return; }
    const endWeight = wa + wc;
    if (endWeight <= 0) return;
    const alpha = (this.profile.bendCompliance / Math.max(1e-5, this.segmentLength)) / (dt * dt);
    const oldLambda = this._bendLambda[index];
    const nextLambda = Math.max(0, oldLambda + (-constraint - alpha * oldLambda) / (endWeight + alpha));
    const change = nextLambda - oldLambda;
    this._bendLambda[index] = nextLambda;
    span.multiplyScalar(1 / distance);
    first.addScaledVector(span, -wa * change);
    third.addScaledVector(span, wc * change);
  }

  _separateNodePair(i, j, minDistance, minDistanceSq) {
    if (i - j < 3 || (this.brokenSegment != null && j <= this.brokenSegment && i === this.brokenSegment + 1)) return;
    const a = this.positions[i], b = this.positions[j];
    const delta = a.clone().sub(b);
    const d2 = delta.lengthSq();
    if (d2 >= minDistanceSq) return;
    const weight = this.inverseMasses[i] + this.inverseMasses[j];
    if (weight <= 0) return;
    const distance = Math.sqrt(d2);
    if (distance < 1e-9) {
      const axis = (i + j) % 3;
      delta.set(axis === 0 ? 1 : 0, axis === 1 ? 1 : 0, axis === 2 ? 1 : 0);
    } else delta.multiplyScalar(1 / distance);
    const correction = minDistance - distance;
    a.addScaledVector(delta, correction * (this.inverseMasses[i] / weight));
    b.addScaledVector(delta, -correction * (this.inverseMasses[j] / weight));
  }

  _projectSelfCollision() {
    const minDist = this.radiusM * 2, minDistSq = minDist * minDist, cellSize = Math.max(1e-4, minDist);
    const buckets = new Map();
    for (let i = 0; i < this.positions.length; i++) {
      const a = this.positions[i];
      const cx = Math.floor(a.x / cellSize), cy = Math.floor(a.y / cellSize), cz = Math.floor(a.z / cellSize);
      for (let ox = -1; ox <= 1; ox++) {
        for (let oy = -1; oy <= 1; oy++) {
          for (let oz = -1; oz <= 1; oz++) {
            const cands = buckets.get(`${cx + ox},${cy + oy},${cz + oz}`);
            if (cands) cands.forEach((j) => this._separateNodePair(i, j, minDist, minDistSq));
          }
        }
      }
      const key = `${cx},${cy},${cz}`;
      if (!buckets.has(key)) buckets.set(key, []);
      buckets.get(key).push(i);
    }
  }

  _shiftEndpoint(endIdx, targetPoint, fromStart) {
    const delta = targetPoint.clone().sub(this.positions[endIdx]);
    for (let i = 1; i < this.segments; i++) {
      const w = fromStart ? (1 - i / this.segments) : (i / this.segments);
      this.positions[i].addScaledVector(delta, w);
      this.previous[i].addScaledVector(delta, w);
    }
    this.positions[endIdx].copy(targetPoint);
    this.previous[endIdx].copy(targetPoint);
  }

  step(dt, pointA, pointB, { gravityY = -GRAVITY, collide, iterations = 10 } = {}) {
    if (!this.positions.length) this.reset(pointA, pointB);
    if (!finiteVector(pointA) || !finiteVector(pointB) || !(dt > 0)) return this.positions.map((p) => p.clone());
    const steps = Math.max(1, Math.min(8, Math.ceil(dt / (1 / 60))));
    const subDt = Math.min(1 / 60, dt / steps);
    for (let stepIndex = 0; stepIndex < steps; stepIndex++) {
      if (this.pinnedA) this._shiftEndpoint(0, pointA, true);
      if (this.pinnedB) this._shiftEndpoint(this.segments, pointB, false);
      const drag = Math.exp(-this.profile.airDamping * subDt);
      for (let i = 0; i <= this.segments; i++) {
        if (this.inverseMasses[i] === 0) continue;
        const position = this.positions[i], old = position.clone();
        const velocity = position.clone().sub(this.previous[i]).multiplyScalar(drag);
        position.add(velocity).add(new THREE.Vector3(0, gravityY * subDt * subDt, 0));
        this.previous[i].copy(old);
      }
      this._setEndpointInverseMasses();
      this._distanceLambda.fill(0);
      this._bendLambda.fill(0);
      this._curvatureLambda.fill(0);
      for (let iteration = 0; iteration < iterations; iteration++) {
        for (let i = 1; i < this.segments; i++) this._projectBending(i, subDt);
        for (let i = 0; i < this.segments; i++) this._projectDistance(i, subDt);
        if (collide) {
          for (let i = 0; i <= this.segments; i++) {
            if (this.inverseMasses[i] === 0) continue;
            const before = this.positions[i].clone();
            collide(this.positions[i], i, this.radiusM);
            this.previous[i].add(this.positions[i].clone().sub(before));
          }
        }
        this._projectSelfCollision();
        if (this.pinnedA) this.positions[0].copy(pointA);
        if (this.pinnedB) this.positions[this.segments].copy(pointB);
      }
      for (let pass = 0; pass < 20; pass++) {
        for (let i = 0; i < this.segments; i++) this._projectDistance(i, subDt, true);
        for (let i = this.segments - 1; i >= 0; i--) this._projectDistance(i, subDt, true);
      }
    }
    this.lastDt = dt;
    return this.positions.map((p) => p.clone());
  }

  breakAt(segmentIndex, tensionN, minimumBreakingLoadN) {
    if (!(tensionN > minimumBreakingLoadN)) return { broken: false, recoilSpeedMps: 0 };
    const index = Math.max(0, Math.min(this.segments - 1, Math.round(segmentIndex)));
    if (!this.positions.length) return { broken: false, recoilSpeedMps: 0 };
    this.brokenSegment = index;
    if (index === 0) this.pinnedA = false;
    if (index === this.segments - 1) this.pinnedB = false;
    this._setEndpointInverseMasses();
    const tangent = this.positions[index + 1].clone().sub(this.positions[index]);
    if (tangent.lengthSq() < 1e-9) tangent.set(1, 0, 0);
    tangent.normalize();
    const { storedElasticEnergyJ: energyJ, recoilSpeedMps } = computeElasticSnapRecoil({
      tensionN,
      lengthM: this.lengthM,
      youngsModulusPa: this.youngsModulusPa,
      areaM2: this.areaM2,
      linearMassKgM: this.linearMassKgM
    });
    const directions = [[index, -1], [index + 1, 1]];
    directions.forEach(([node, sign]) => {
      this.inverseMasses[node] = Math.max(this.inverseMasses[node], 1 / Math.max(0.01, this.linearMassKgM * this.segmentLength));
      const velocity = tangent.clone().multiplyScalar(sign * recoilSpeedMps);
      this.previous[node].copy(this.positions[node]).addScaledVector(velocity, -this.lastDt);
    });
    this._distanceLambda.fill(0);
    return { broken: true, segmentIndex: index, storedElasticEnergyJ: energyJ, recoilSpeedMps };
  }

  nodeVelocity(index) {
    if (!this.positions.length) return new THREE.Vector3();
    const i = Math.max(0, Math.min(this.segments, index | 0));
    return this.positions[i].clone().sub(this.previous[i]).multiplyScalar(1 / Math.max(1e-6, this.lastDt));
  }

  getArcLength() {
    let length = 0;
    for (let i = 1; i < this.positions.length; i++) length += this.positions[i].distanceTo(this.positions[i - 1]);
    return length;
  }
}
