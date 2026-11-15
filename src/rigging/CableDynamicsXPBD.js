import * as THREE from 'three';

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

function finiteVector(value) {
  return value && Number.isFinite(value.x) && Number.isFinite(value.y) && Number.isFinite(value.z);
}

/** Time-stepped XPBD model for a flexible, tension-only cable or chain. */
export class CableDynamicsXPBD {
  constructor({ lengthM, diameterMm = 16, material = 'wire', segments = 40, youngsModulusPa } = {}) {
    if (!(Number.isFinite(lengthM) && lengthM > 0)) throw new RangeError('lengthM must be positive');
    const key = material === 'round_sling' || material === 'synthetic' ? 'web' : material;
    if (!CABLE_MATERIAL_PROFILES[key]) throw new RangeError(`Unsupported cable material: ${material}`);
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
    if (this.pinnedA) this.inverseMasses[0] = 0;
    if (this.pinnedB) this.inverseMasses[this.segments] = 0;
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
    const first = this.positions[index - 1];
    const center = this.positions[index];
    const third = this.positions[index + 1];

    // XPBD curvature spring: penalize center-node distance from the neighbor midpoint.
    // A chain has zero curvature restraint; wire and textile profiles carry compliance.
    const midpoint = first.clone().add(third).multiplyScalar(0.5);
    const curveDelta = center.clone().sub(midpoint);
    const curveDistance = curveDelta.length();
    if (curveDistance > 1e-9 && this.profile.bendCompliance > 0) {
      const wa = this.inverseMasses[index - 1];
      const wb = this.inverseMasses[index];
      const wc = this.inverseMasses[index + 1];
      const weight = wb + 0.25 * (wa + wc);
      const alpha = this.profile.bendCompliance / (dt * dt);
      const oldLambda = this._curvatureLambda[index];
      const change = (-curveDistance - alpha * oldLambda) / (weight + alpha);
      this._curvatureLambda[index] += change;
      curveDelta.multiplyScalar(1 / curveDistance);
      first.addScaledVector(curveDelta, -0.5 * wa * change);
      center.addScaledVector(curveDelta, wb * change);
      third.addScaledVector(curveDelta, -0.5 * wc * change);
    }

    const span = third.clone().sub(first);
    const distance = span.length();
    if (distance < 1e-9) return;
    const radius = Math.max(this.profile.bendRadiusDiameters * this.diameterM, this.segmentLength * 0.45);
      const maxTurn = THREE.MathUtils.clamp(this.segmentLength / radius, 0.06, 0.5);
    const minimumSpan = 2 * this.segmentLength * Math.cos(maxTurn / 2);
    const constraint = distance - minimumSpan;
    if (constraint >= 0) {
      this._bendLambda[index] = 0;
      return;
    }
    const wa = this.inverseMasses[index - 1];
    const wb = this.inverseMasses[index + 1];
    const weight = wa + wb;
    if (weight <= 0) return;
    const compliance = this.profile.bendCompliance / Math.max(1e-5, this.segmentLength);
    const alpha = compliance / (dt * dt);
    const oldLambda = this._bendLambda[index];
    const nextLambda = Math.max(0, oldLambda + (-constraint - alpha * oldLambda) / (weight + alpha));
    const change = nextLambda - oldLambda;
    this._bendLambda[index] = nextLambda;
    span.multiplyScalar(1 / distance);
    first.addScaledVector(span, -wa * change);
    third.addScaledVector(span, wb * change);
  }

  _projectSelfCollision() {
    const minDistance = this.radiusM * 2;
    const minDistanceSq = minDistance * minDistance;
    const cellSize = Math.max(1e-4, minDistance);
    const buckets = new Map();
    const cellKey = (x, y, z) => `${x},${y},${z}`;
    for (let i = 0; i < this.positions.length; i++) {
      const a = this.positions[i];
      const cx = Math.floor(a.x / cellSize);
      const cy = Math.floor(a.y / cellSize);
      const cz = Math.floor(a.z / cellSize);
      for (let ox = -1; ox <= 1; ox++) {
        for (let oy = -1; oy <= 1; oy++) {
          for (let oz = -1; oz <= 1; oz++) {
            const candidates = buckets.get(cellKey(cx + ox, cy + oy, cz + oz));
            if (!candidates) continue;
            for (const j of candidates) {
              if (i - j < 3) continue;
              if (this.brokenSegment != null && j <= this.brokenSegment && i === this.brokenSegment + 1) continue;
              const b = this.positions[j];
              const delta = a.clone().sub(b);
              const d2 = delta.lengthSq();
              if (d2 >= minDistanceSq) continue;
              const distance = Math.sqrt(d2);
              const weight = this.inverseMasses[i] + this.inverseMasses[j];
              if (weight <= 0) continue;
              if (distance < 1e-9) {
                // Coincident particles have no geometric normal; choose a stable axis
                // so self-contact still produces a separating correction.
                delta.set(((i + j) % 3) === 0 ? 1 : 0, ((i + j) % 3) === 1 ? 1 : 0, ((i + j) % 3) === 2 ? 1 : 0);
              } else {
                delta.multiplyScalar(1 / distance);
              }
              const correction = minDistance - distance;
              const wi = this.inverseMasses[i] / weight;
              const wj = this.inverseMasses[j] / weight;
              a.addScaledVector(delta, correction * wi);
              b.addScaledVector(delta, -correction * wj);
            }
          }
        }
      }
      const key = cellKey(cx, cy, cz);
      if (!buckets.has(key)) buckets.set(key, []);
      buckets.get(key).push(i);
    }
  }

  step(dt, pointA, pointB, { gravityY = -GRAVITY, collide, iterations = 10 } = {}) {
    if (!this.positions.length) this.reset(pointA, pointB);
    if (!finiteVector(pointA) || !finiteVector(pointB) || !(dt > 0)) return this.positions.map((p) => p.clone());
    const steps = Math.max(1, Math.min(8, Math.ceil(dt / (1 / 60))));
    const subDt = Math.min(1 / 60, dt / steps);
    for (let stepIndex = 0; stepIndex < steps; stepIndex++) {
      const deltaA = pointA.clone().sub(this.positions[0]);
      const deltaB = pointB.clone().sub(this.positions[this.segments]);
      if (this.pinnedA) {
        for (let i = 1; i < this.segments; i++) {
          this.positions[i].addScaledVector(deltaA, 1 - i / this.segments);
          this.previous[i].addScaledVector(deltaA, 1 - i / this.segments);
        }
        this.positions[0].copy(pointA);
        this.previous[0].copy(pointA);
      }
      if (this.pinnedB) {
        for (let i = 1; i < this.segments; i++) {
          this.positions[i].addScaledVector(deltaB, i / this.segments);
          this.previous[i].addScaledVector(deltaB, i / this.segments);
        }
        this.positions[this.segments].copy(pointB);
        this.previous[this.segments].copy(pointB);
      }
      const drag = Math.exp(-this.profile.airDamping * subDt);
      for (let i = 0; i <= this.segments; i++) {
        if (this.inverseMasses[i] === 0) continue;
        const position = this.positions[i];
        const old = position.clone();
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
            const correction = this.positions[i].clone().sub(before);
            this.previous[i].add(correction);
          }
        }
        this._projectSelfCollision();
        if (this.pinnedA) this.positions[0].copy(pointA);
        if (this.pinnedB) this.positions[this.segments].copy(pointB);
      }
      // Contact and self-collision corrections can slightly lengthen adjacent spans.
      // Finish with a short distance pass so the discretized arc stays near L0.
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
    const extensionM = tensionN * this.lengthM / (this.youngsModulusPa * this.areaM2);
    const energyJ = 0.5 * tensionN * extensionM;
    const cableMassKg = this.linearMassKgM * this.lengthM;
    const recoilSpeedMps = Math.min(MAX_RECOIL_SPEED, Math.sqrt((2 * energyJ) / Math.max(0.01, cableMassKg)));
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
