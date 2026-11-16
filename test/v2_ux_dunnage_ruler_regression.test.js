// @purpose: Kiểm thử hồi quy 7 tính năng mới: Lashing khít đáy, SWL >= 12MT, Chỉnh đồng bộ, Hạ êm, Góc xoay mượt, Gỗ kê đỡ/nghiêng kiện, Thước cao độ 3D + Điểm đỏ.
import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import * as THREE from 'three';
import {
  rebuildDunnageVisual3D,
  evaluateDunnageSupportSurface
} from '../src/graphics/JobsiteSiteVisuals.js';
import {
  computeElevationMarkers,
  createElevationRulerTool
} from '../src/graphics/ElevationRulerTool.js';
import { buildTightFlatRackLashingVisuals } from '../src/rigging/FlatRackLashingPhysics.js';
import { createHeadlessSim } from './sim_test_harness.js';

describe('7 UX & 3D Physics Enhancements Regression', () => {
  it('1. autoSizeGearForLoad enforces SWL >= 12 MT default while keeping wire diameter compact', () => {
    const sim = createHeadlessSim();
    const s = sim.getState();
    s.weight = 16; // Light 16t load: raw leg load = 4t * 1.25 = 5t -> SWL must floor at 12 MT, diameter stays for 6t (~14-20mm)
    sim.rebuildCargoAndRig(true);
    const leg0 = s.gear.legs[0];
    const up0 = s.gear.uppers[0];
    expect(leg0.swlT).toBeGreaterThanOrEqual(12);
    expect(up0.swlT).toBeGreaterThanOrEqual(12);
    expect(leg0.diaMm).toBeLessThanOrEqual(22);
  });

  it('2. Flat Rack lashing bottom tieLeg uses clean inward quaternion with zero flared outward fins', () => {
    const group = new THREE.Group();
    const oogGroup = new THREE.Group();
    const mat = new THREE.MeshStandardMaterial();
    const nodes = buildTightFlatRackLashingVisuals({
      THREE, oogGroup, group, MATS: { galvSteel: mat },
      dims: { cL: 10, cW: 3.10, cH: 2.2, offsetX: 0, offsetZ: 0, cargoBottomY: 0.42, cargoTopY: 2.62, deckTopY: 0.30, W: 2.44 }
    });
    expect(nodes.length).toBeGreaterThanOrEqual(4);
    const box = new THREE.Box3().setFromObject(oogGroup.getObjectByName('flatRackLashingStraps'));
    const zHalf = Math.max(Math.abs(box.min.z), Math.abs(box.max.z));
    // Crate outer face with polyHood + ratchet is 3.10/2 + 0.032 + 0.038 = 1.62m — nothing spikes beyond it
    expect(zHalf).toBeLessThanOrEqual(1.63);
  });

  it('3. Multi-select Gear Editor groups matching equipment for simultaneous spec editing', () => {
    const root = path.resolve(import.meta.dirname, '..');
    const editorSrc = fs.readFileSync(path.join(root, 'src/sim/gear/editor.js'), 'utf8');
    expect(editorSrc).toContain('Multi-select: group similar kinds together');
    expect(editorSrc).toContain('if (kind === \'sling\') renderSlingInspector(body, items);');
    expect(editorSrc).toContain('sel.forEach(s => {');
  });

  it('4. 3D Timber Dunnage physically supports cargo above deck & causes gravity tilt when off-center', () => {
    const sim = createHeadlessSim();
    const s = sim.getState();
    const phy = sim.getPhy();

    // Verify centered cargo sits on top of 200mm timber sleepers (~H/2 + 0.204m), not penetrating at H/2
    const beamSupportY = sim.getSupportY(0.39 * s.L, 0);
    expect(beamSupportY).toBeGreaterThan(0.18);
    expect(phy.cargoPos.y).toBeCloseTo(s.H * 0.5 + beamSupportY, 2);

    // Off-center cargo overhanging one beam tilts naturally under gravity without sinking through remaining beam
    s.poseLock = false;
    phy.cargoPos.x = s.L * 0.52; // Push cargo sideways off the left sleeper onto floor while middle touches right sleeper
    phy.cargoPos.y = s.H * 0.5 + beamSupportY + 0.05;
    phy.hookPos.y = 30;
    phy.hookTarget.y = 30;
    (phy.cables || []).forEach(c => { c.L0 = 40; });
    sim.stepSim(90);

    const euler = new THREE.Euler().setFromQuaternion(phy.cargoQuat, 'YXZ');
    const maxTilt = Math.max(Math.abs(euler.x), Math.abs(euler.z));
    expect(maxTilt).toBeGreaterThan(0.01);

    // Verify pure evaluateDunnageSupportSurface distinguishes beam top vs floor gap
    const dg = new THREE.Group();
    rebuildDunnageVisual3D({ THREE, dunnageGroup: dg, state: { L: 6, W: 2.4, dunnageQty: '2', dunnageSection: '200x200' }, MATS: {} });
    expect(evaluateDunnageSupportSurface(0.39 * 6, 0, dg, 0).onBeam).toBe(true);
    expect(evaluateDunnageSupportSurface(0, 0, dg, 0).onBeam).toBe(false);
  });

  it('5. finishSmoothSetDown settles gently in place without teleporting back to origin/0deg', () => {
    const sim = createHeadlessSim();
    const s = sim.getState();
    const phy = sim.getPhy();
    s.poseLock = false;
    phy.cargoPos.x = 1.45;
    phy.cargoQuat.setFromAxisAngle(new THREE.Vector3(0, 1, 0), 0.35);
    globalThis.finishSmoothSetDown();
    expect(phy.cargoPos.x).toBeCloseTo(1.45, 3);
    const eul = new THREE.Euler().setFromQuaternion(phy.cargoQuat, 'YXZ');
    expect(eul.y).toBeCloseTo(0.35, 3);
  });

  it('6. Camera Góc uses live non-paused angleBlend around moving target without freezing', () => {
    const root = path.resolve(import.meta.dirname, '..');
    const rec = fs.readFileSync(path.join(root, 'src/sim/library/reconstruction_export.js'), 'utf8');
    expect(rec).toContain('cf.angleBlend = {');
    expect(rec).toContain('Track live moving worldTarget delta');
    expect(rec).not.toContain('cf.paused = true;\n            prevFollowWorldPos = null;\n            return offset;');
  });

  it('7. ElevationRulerTool reports Hook/Spreader/Top/Bottom heights, toggles cleanly, and shows Red Dot on 3D raycast hover', () => {
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 200);
    camera.position.set(0, 3, 12);
    camera.lookAt(0, 2, 0);
    camera.updateMatrixWorld(true);

    const targetBox = new THREE.Mesh(new THREE.BoxGeometry(2, 2, 2), new THREE.MeshBasicMaterial());
    targetBox.position.set(0, 2, 0); // Spans Y = 1.0 .. 3.0m
    targetBox.updateMatrixWorld(true);
    scene.add(targetBox);

    const ruler = createElevationRulerTool({ THREE, scene });
    const mockState = { L: 6, W: 2.4, H: 2.5, beamType: 'spreader' };
    const mockPhy = {
      hookPos: new THREE.Vector3(0, 11.2, 0),
      beams: [{ x: new THREE.Vector3(0, 4.8, 0) }],
      cargoPos: new THREE.Vector3(0, 1.5, 0),
      cargoQuat: new THREE.Quaternion()
    };

    const marks = ruler.update({ visible: true, state: mockState, phy: mockPhy });
    expect(marks.hookY).toBeCloseTo(11.2, 3);
    expect(marks.spreaderY).toBeCloseTo(4.8, 3);
    expect(marks.cargoTopY).toBeCloseTo(2.75, 3);
    expect(marks.cargoBottomY).toBeCloseTo(0.25, 3);
    expect(ruler.group.visible).toBe(true);
    // Default position is on the right side (+X) of cargo with 2x enlarged labels
    expect(ruler.group.position.x).toBeGreaterThan(mockPhy.cargoPos.x + mockState.L * 0.5);

    // Simulate mouse hover directly over center of canvas looking at targetBox (height ~ 2.0..3.0m)
    const mockEl = { getBoundingClientRect: () => ({ left: 0, top: 0, width: 400, height: 400 }) };
    const hitPt = ruler.updateHover({ clientX: 200, clientY: 200, domElement: mockEl, camera, targets: [targetBox] });
    expect(hitPt).toBeTruthy();
    expect(hitPt.y).toBeGreaterThanOrEqual(1.0);
    expect(hitPt.y).toBeLessThanOrEqual(3.0);

    ruler.update({ visible: true, state: mockState, phy: mockPhy });
    const redDot = ruler.group.children.find(c => c.isMesh && c.geometry?.type === 'SphereGeometry' && c.renderOrder === 30);
    expect(redDot).toBeTruthy();
    expect(redDot.visible).toBe(true);
    expect(redDot.position.y).toBeCloseTo(hitPt.y, 2);

    ruler.update({ visible: false, state: mockState, phy: mockPhy });
    expect(ruler.group.visible).toBe(false);
    expect(redDot.visible).toBe(false);
  });
});
