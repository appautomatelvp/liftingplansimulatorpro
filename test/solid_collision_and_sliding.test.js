/**
 * Phase 3 / 4 — Compound OBB collision, inclined deck-parallel slide, gravity torque settle.
 */
import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { createHeadlessSim } from './sim_test_harness.js';

function makeInclinedRack() {
  const sim = createHeadlessSim();
  const state = sim.getState();
  const phy = sim.getPhy();
  state.cargoType = 'flatrack';
  state.L = 12.2;
  state.W = 2.44;
  state.H = 2.59;
  state.weight = 22;
  state.oogHasCargo = true;
  state.oogOh = 0.68;
  state.oogOwL = -0.12;
  state.oogOwR = -0.12;
  state.oogOlF = -1.10;
  state.oogOlR = -1.10;
  state.poseLock = false;
  sim.rebuildCargoAndRig(true);
  phy.cargoPos.set(0, 8, 0);
  phy.cargoQuat.setFromEuler(new THREE.Euler(0, 0, THREE.MathUtils.degToRad(35)));
  phy.groundClearance = 4;
  return { sim, state, phy };
}

function pointInsideObb(point, box) {
  const local = point.clone().sub(box.center).applyQuaternion(box.quat.clone().invert());
  return Math.abs(local.x) < box.half.x - 0.002
    && Math.abs(local.y) < box.half.y - 0.002
    && Math.abs(local.z) < box.half.z - 0.002;
}

describe('solid_collision_and_sliding (Phase 3)', () => {
  it('Flat Rack exposes 3 compound OBBs (deck + 2 end walls)', () => {
    const { sim } = makeInclinedRack();
    const boxes = sim.getFlatRackSolidBoxesWorld();
    expect(boxes.length).toBe(3);
  });

  it('sub-cargo slides parallel to tilted deck (Δy≈0 local) after lashing MBL failure', () => {
    const { sim, state, phy } = makeInclinedRack();
    state.oogLashingMblN = 1;
    sim.stepFlatRackPayloadPhysics(1 / 60);
    expect(phy.oogState.status).toBe('sliding');
    expect(phy.oogState.aSlide).toBeGreaterThan(0);

    const start = phy.oogState.localPos.clone();
    for (let i = 0; i < 10; i++) sim.stepFlatRackPayloadPhysics(1 / 60);
    const moved = phy.oogState.localPos.clone().sub(start);
    expect(Math.hypot(moved.x, moved.z)).toBeGreaterThan(0.03);
    // Parallel to deck: local Y travel ~ 0 while still on board
    expect(Math.abs(moved.y)).toBeLessThan(0.02);

    const crate = sim.getCargoVisual().getObjectByName('flatRackOogCargo');
    expect(crate.position.y).toBeCloseTo(0, 4);
  });

  it('does not penetrate Flat Rack compound solids (depth ≤ 1 mm class)', () => {
    // Match proven settling harness: level rack, forced OOG overlap, then depenetrate.
    const sim = createHeadlessSim();
    const state = sim.getState();
    const phy = sim.getPhy();
    state.cargoType = 'flatrack';
    state.oogHasCargo = true;
    state.oogOh = 0.68;
    state.oogOwL = -0.12;
    state.oogOwR = -0.12;
    state.oogOlF = -1.10;
    state.oogOlR = -1.10;
    sim.rebuildCargoAndRig(true);
    state.poseLock = false;
    phy.cargoPos.set(0, 3.0, 0);
    const meta = sim.getCargoVisual().getObjectByName('flatRackOogCargo').userData.oogMeta;
    sim.setOogFreeBody({
      position: new THREE.Vector3(meta.offsetX || 0, 3.0 + meta.centerY - 0.08, meta.offsetZ || 0),
      quaternion: new THREE.Quaternion(),
      velocity: new THREE.Vector3()
    });
    for (let i = 0; i < 90; i++) sim.stepFlatRackPayloadPhysics(1 / 60);
    const boxes = sim.getFlatRackSolidBoxesWorld();
    const corners = sim.getOogWorldCorners();
    const hits = corners.filter((c) => boxes.some((b) => pointInsideObb(c, b)));
    expect(hits).toHaveLength(0);
    expect(phy.oogState.lastCompoundPenetration || 0).toBeLessThan(0.01);
  });

  it('tilted free body on ground rotates flat via gravity torque', () => {
    const { sim, phy } = makeInclinedRack();
    const halfY = sim.getCargoVisual().getObjectByName('flatRackOogCargo').userData.oogMeta.half.hy;
    sim.setOogFreeBody({
      position: new THREE.Vector3(0, sim.getSupportY(0, 0) + halfY + 2.0, 0),
      quaternion: new THREE.Quaternion().setFromEuler(new THREE.Euler(0, 0, THREE.MathUtils.degToRad(30))),
      velocity: new THREE.Vector3(0, -0.5, 0)
    });
    for (let i = 0; i < 720; i++) sim.stepFlatRackPayloadPhysics(1 / 60);
    const up = new THREE.Vector3(0, 1, 0).applyQuaternion(phy.oogState.worldQuat);
    const tiltDeg = THREE.MathUtils.radToDeg(Math.acos(THREE.MathUtils.clamp(Math.abs(up.y), 0, 1)));
    expect(phy.oogState.status).toBe('grounded');
    expect(Math.min(tiltDeg, Math.abs(90 - tiltDeg))).toBeLessThan(3.0);
  });
});
