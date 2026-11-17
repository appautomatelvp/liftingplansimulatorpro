import { describe, expect, it } from 'vitest';
import {
  computeLoadPathConnectivity,
  stepFreeFallBody,
  computeRestingTorque,
  bendingDeflectionProfile
} from '../src/rigging/LoadPathGravity.js';

describe('Load-Path Free-Fall Gravity, Resting Torque & All-Beam Euler-Bernoulli Deflection (Pillar 5)', () => {
  it('(a) total load-path loss marks cargoFreeFall=true and body drops ~ 0.5 * g * t^2 in 1.0s (±5%)', () => {
    const conn = computeLoadPathConnectivity([
      { role: 'leg', broken: true },
      { role: 'leg', broken: true },
      { role: 'upper', broken: false }
    ], 'spreader');
    expect(conn.hasCargoPath).toBe(false);
    expect(conn.cargoFreeFall).toBe(true);

    const body = { y: 15.0, vy: 0 };
    const steps = 60;
    const dt = 1 / 60;
    for (let i = 0; i < steps; i++) {
      stepFreeFallBody(body, dt, { groundY: 0, halfHeight: 1.0, airDamping: 0 });
    }
    const dropM = 15.0 - body.y;
    const exactDrop = 0.5 * 9.81 * 1.0 * 1.0; // 4.905 m
    expect(dropM).toBeGreaterThan(exactDrop * 0.95);
    expect(dropM).toBeLessThan(exactDrop * 1.05);
  });

  it('(b) generates restoring overturning torque when CoG falls outside ground support polygon', () => {
    const support = [
      { x: -1.5, z: -0.6 },
      { x: 1.5, z: -0.6 },
      { x: 1.5, z: 0.6 },
      { x: -1.5, z: 0.6 }
    ];
    const balanced = computeRestingTorque({ cogWorld: { x: 0, y: 1.2, z: 0 }, supportPolygon: support, massKg: 20000 });
    expect(balanced.insideSupport).toBe(true);
    expect(balanced.torqueMagNm).toBe(0);

    const overhanging = computeRestingTorque({ cogWorld: { x: 2.3, y: 1.2, z: 0 }, supportPolygon: support, massKg: 20000 });
    expect(overhanging.insideSupport).toBe(false);
    expect(overhanging.leverArm.x).toBeCloseTo(0.8, 3);
    // torque = r * m * g = 0.8 * 20000 * 9.81 = 156,960 Nm
    expect(overhanging.torqueMagNm).toBeCloseTo(0.8 * 20000 * 9.81, 0);
  });

  it('(c) computes 12m 30t beam mid-span deflection matching 5wL^4 / 384EI within ±5%', () => {
    const L = 12.0;
    const loadN = 30 * 1000 * 9.81;
    const E = 200e9;
    const I = 8.5e-4;
    const prof = bendingDeflectionProfile({ lengthM: L, loadN, E_Pa: E, I_m4: I, distribution: 'uniform' });
    const w = loadN / L;
    const exactM = (5 * w * Math.pow(L, 4)) / (384 * E * I);
    expect(prof.maxDeflectionM).toBeCloseTo(exactM, 6);
    expect(prof.nodes[10].deflectionY).toBeCloseTo(-exactM, 6);
    expect(prof.nodes[0].deflectionY).toBeCloseTo(0, 8);
    expect(prof.nodes[20].deflectionY).toBeCloseTo(0, 8);
  });
});
