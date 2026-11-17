import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { CableDynamicsXPBD } from '../src/rigging/CableDynamicsXPBD.js';
import { applySnapWhip, advanceSnapWhipFrame, computeWindDragAccel } from '../src/rigging/CableMaterialBehavior.js';

describe('XPBD Cable Material Behavior & Elastic Snap Whip Recoil (Pillar 4)', () => {
  it('(a) snaps when tension >= MBL and removes broken distance constraint', () => {
    const xpbd = new CableDynamicsXPBD({ lengthM: 4, diameterMm: 20, material: 'wire', segments: 20 });
    const a = new THREE.Vector3(0, 6, 0);
    const b = new THREE.Vector3(0, 2.2, 0);
    xpbd.reset(a, b);
    xpbd.step(1 / 60, a, b);

    const res = xpbd.breakAt(10, 200e3, 200e3); // T === MBL
    expect(res.broken).toBe(true);
    expect(xpbd.brokenSegment).toBe(10);
    expect(res.whipPhase).toBeGreaterThanOrEqual(6);
  });

  it('(b) snapped free tips recoil OPPOSITE to tension immediately after break before settling under gravity', () => {
    const xpbd = new CableDynamicsXPBD({ lengthM: 6, diameterMm: 22, material: 'wire', segments: 24 });
    const left = new THREE.Vector3(-2.9, 6, 0);
    const right = new THREE.Vector3(2.9, 6, 0);
    xpbd.reset(left, right);
    xpbd.step(1 / 60, left, right);

    const snap = xpbd.breakAt(12, 420e3, 300e3);
    expect(snap.recoilSpeedMps).toBeGreaterThan(2);

    const leftTipInitX = xpbd.positions[12].x;
    const rightTipInitX = xpbd.positions[13].x;
    // Immediately after snap, broken tips whip outward away from the cut (opposite tension)
    expect(xpbd.nodeVelocity(12).x).toBeLessThan(-1);
    expect(xpbd.nodeVelocity(13).x).toBeGreaterThan(1);
    xpbd.step(1 / 60, left, right, { iterations: 8 });
    expect(xpbd.positions[12].x).toBeLessThan(leftTipInitX);
    expect(xpbd.positions[13].x).toBeGreaterThan(rightTipInitX);

    // After whip phase completes, tips fall under gravity (-Y) with finite positions
    const afterWhipY = xpbd.positions[12].y;
    for (let f = 0; f < 65; f++) {
      xpbd.step(1 / 60, left, right, { iterations: 8 });
    }
    expect(xpbd.positions[12].y).toBeLessThan(afterWhipY - 0.25);
    for (const p of xpbd.positions) {
      expect(Number.isFinite(p.x) && Number.isFinite(p.y) && Number.isFinite(p.z)).toBe(true);
    }
  });

  it('(c) chain slack folds sharply while wire rope enforces minimum bend radius', () => {
    const a = new THREE.Vector3(0, 8, 0);
    const b = new THREE.Vector3(4, 8, 0);
    const chain = new CableDynamicsXPBD({ lengthM: 7.5, diameterMm: 18, material: 'chain', segments: 24 }).reset(a, b);
    const wire = new CableDynamicsXPBD({ lengthM: 7.5, diameterMm: 18, material: 'wire', segments: 24 }).reset(a, b);
    for (let f = 0; f < 320; f++) {
      chain.step(1 / 60, a, b, { iterations: 12 });
      wire.step(1 / 60, a, b, { iterations: 12 });
    }
    const chainMinY = Math.min(...chain.positions.map((p) => p.y));
    const wireMinY = Math.min(...wire.positions.map((p) => p.y));
    expect(chainMinY).toBeLessThan(wireMinY - 0.04);
    expect(wire.profile.bendRadiusDiameters).toBeGreaterThan(chain.profile.bendRadiusDiameters);
  });

  it('(d) lateral wind deflects flat web slings while steel wire barely sways', () => {
    const top = new THREE.Vector3(0, 6, 0);
    const bottom = new THREE.Vector3(0, 1.8, 0);
    const web = new CableDynamicsXPBD({ lengthM: 5, diameterMm: 60, material: 'web', segments: 16 }).reset(top, bottom);
    const wire = new CableDynamicsXPBD({ lengthM: 5, diameterMm: 20, material: 'wire', segments: 16 }).reset(top, bottom);
    const wind = { x: 14, y: 0, z: 0 };
    for (let f = 0; f < 35; f++) {
      web.step(1 / 60, top, bottom, { windVelocity: wind });
      wire.step(1 / 60, top, bottom, { windVelocity: wind });
    }
    expect(web.positions[8].x).toBeGreaterThan(0.5);
    expect(web.positions[8].x).toBeGreaterThan(wire.positions[8].x * 3);
    expect(computeWindDragAccel({ material: 'web', windVelocity: wind }).x).toBeGreaterThan(
      computeWindDragAccel({ material: 'wire', windVelocity: wind }).x * 5
    );
  });

  it('(e) applySnapWhip tracks whipPhase frames and decays smoothly with air damping', () => {
    const cable = { L0: 4, tensionT: 30, n: { x: 0, y: 1, z: 0 } };
    const ws = applySnapWhip(cable, 300e3, 250e3, { material: 'wire', lengthM: 4, diameterMm: 22 });
    expect(ws.whipPhase).toBe(8);
    const v0 = Math.abs(ws.tipVelUpper.y);
    for (let f = 0; f < 8; f++) advanceSnapWhipFrame(ws, 1 / 60);
    expect(ws.whipPhase).toBe(0);
    expect(ws.active).toBe(false);
    expect(Math.abs(ws.tipVelUpper.y)).toBeLessThan(v0);
  });
});
