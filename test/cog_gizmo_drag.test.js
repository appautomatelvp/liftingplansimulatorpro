import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import * as THREE from 'three';
import {
  createCoGAxisHandles,
  buildCogDragPlane,
  applyCogDragDelta
} from '../src/graphics/CoGGizmoHelper.js';
import { EXTRA_UI_EN } from '../src/i18n/sim_ui_phrases.js';

describe('CoG 3D Axis Handles & Drag Behavior (Section 3)', () => {
  it('builds X/Y/Z axis handles and free hit proxy with depthTest disabled and renderOrder=999', () => {
    const handles = createCoGAxisHandles(THREE);
    const tagged = [];
    handles.traverse((o) => {
      if (o.userData?.dragType === 'cog') tagged.push(o);
    });
    expect(tagged.length).toBeGreaterThanOrEqual(10); // 1 free proxy + 3 axes * (shaft+cone+hit)
    const axes = new Set(tagged.map((o) => o.userData.cogAxis));
    expect(axes.has('x')).toBe(true);
    expect(axes.has('y')).toBe(true);
    expect(axes.has('z')).toBe(true);
    expect(axes.has('free')).toBe(true);
    expect(tagged[0].renderOrder).toBe(999);
    expect(tagged[0].material.depthTest).toBe(false);
  });

  it('constrains axis drags cleanly, updates state.cogX/Y/Z, and clamps to ±0.45 bounds', () => {
    const cargoRootGroup = new THREE.Group();
    cargoRootGroup.position.set(0, 1.3, 0);
    cargoRootGroup.updateMatrixWorld(true);

    const state = { L: 12.0, H: 2.6, W: 2.4, cogX: 0, cogY: 0, cogZ: 0 };
    const worldCoG = new THREE.Vector3(0, 1.3, 0);
    const camDir = new THREE.Vector3(0, -0.35, -0.94).normalize();

    // Drag along +X axis by +2.5 m -> only cogX changes
    const planeX = buildCogDragPlane({ THREE, axis: 'x', worldCoG, cameraDir: camDir, cargoQuat: new THREE.Quaternion() });
    const rayX = new THREE.Ray(new THREE.Vector3(2.5, 5.0, 5.0), new THREE.Vector3(0, -3.7, -5.0).normalize());
    applyCogDragDelta({
      THREE, ray: rayX, dragPlane: planeX, axis: 'x',
      startWorld: worldCoG.clone(), startCog: { x: 0, y: 0, z: 0 }, cargoRootGroup, state
    });
    expect(state.cogX).toBeCloseTo(2.5, 2);
    expect(state.cogY).toBe(0);
    expect(state.cogZ).toBe(0);

    // Extreme X drag clamps at 0.45 * 12 = 5.4 m
    const rayFar = new THREE.Ray(new THREE.Vector3(20, 5.0, 5.0), new THREE.Vector3(0, -3.7, -5.0).normalize());
    applyCogDragDelta({
      THREE, ray: rayFar, dragPlane: planeX, axis: 'x',
      startWorld: worldCoG.clone(), startCog: { x: 0, y: 0, z: 0 }, cargoRootGroup, state
    });
    expect(state.cogX).toBeCloseTo(5.4, 2);
  });

  it('exposes all 4 taskbar quick toggles with bindings and EN/VI translations', () => {
    const root = path.resolve(import.meta.dirname, '..');
    const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
    const eventsSrc = fs.readFileSync(path.join(root, 'src/sim/session/presets_events.js'), 'utf8');
    for (const id of ['btn-qt-angle', 'btn-qt-tension', 'btn-qt-ruler', 'btn-qt-cog']) {
      expect(html).toContain(`id="${id}"`);
      expect(eventsSrc).toContain(id);
    }
    expect(EXTRA_UI_EN['Lực căng']).toBe('Tension');
    expect(EXTRA_UI_EN['Thước']).toBe('Ruler');
  });
});
