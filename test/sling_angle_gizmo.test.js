import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import {
  classifySlingAngleZone,
  computeSlingAngleArcData,
  createSlingAngleGizmo
} from '../src/graphics/SlingAngleGizmo.js';

describe('Interactive 3D Sling Angle Gizmo (Pillar 2.1)', () => {
  it('classifies green (>=45°), yellow (30°-44°), red (<30°) accurately', () => {
    expect(classifySlingAngleZone(60).zone).toBe('safe');
    expect(classifySlingAngleZone(45).zone).toBe('safe');
    expect(classifySlingAngleZone(44.9).zone).toBe('warn');
    expect(classifySlingAngleZone(30).zone).toBe('warn');
    expect(classifySlingAngleZone(29.9).zone).toBe('danger');
  });

  it('computes arc span matching true horizontal sling angle', () => {
    const pA = { x: 0, y: 1, z: 0 };
    const pB = { x: 1, y: 2, z: 0 }; // dx=1, dy=1 -> 45 deg
    const arc = computeSlingAngleArcData(pA, pB);
    expect(arc.angleDeg).toBeCloseTo(45, 2);
    expect(arc.color.zone).toBe('safe');
    expect(arc.arcVertices.length).toBe((24 + 2) * 3);
  });

  it('toggles visibility, reuses geometry handles without leaks, and disposes cleanly', () => {
    const scene = new THREE.Scene();
    const gizmo = createSlingAngleGizmo({ THREE, scene });
    expect(gizmo.group.visible).toBe(false);

    const hGeoBefore = gizmo.hLine.geometry;
    const arcGeoBefore = gizmo.arcMesh.geometry;

    const d = gizmo.update({
      visible: true,
      qualityTier: 'high',
      pointA: { x: 0, y: 0, z: 0 },
      pointB: { x: Math.sqrt(3), y: 1, z: 0 } // 30°
    });
    expect(gizmo.group.visible).toBe(true);
    expect(d.angleDeg).toBeCloseTo(30, 1);
    expect(gizmo.arcMesh.material.color.getHex()).toBe(0xf59e0b);
    expect(gizmo.hLine.geometry).toBe(hGeoBefore);
    expect(gizmo.arcMesh.geometry).toBe(arcGeoBefore);

    // Performance tier or unselected cable hides cleanly
    gizmo.update({ visible: true, qualityTier: 'performance', pointA: { x: 0, y: 0, z: 0 }, pointB: { x: 1, y: 1, z: 0 } });
    expect(gizmo.group.visible).toBe(false);

    gizmo.update({ visible: false });
    expect(gizmo.group.visible).toBe(false);

    gizmo.dispose();
    expect(scene.children.length).toBe(0);
  });
});
