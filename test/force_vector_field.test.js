import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import {
  computeVectorLength,
  getSlingAngleTooltip,
  createForceVectorField
} from '../src/graphics/ForceVectorField.js';
import { EXTRA_UI_EN } from '../src/i18n/sim_ui_phrases.js';

describe('Real-time 3D Force Vector Field & Bilingual Angle Tooltip (Pillar 2)', () => {
  it('scales vector length monotonically with tension and classifies colors', () => {
    const lenLow = computeVectorLength(5, 20);
    const lenHigh = computeVectorLength(18, 20);
    expect(lenLow).toBeGreaterThan(0);
    expect(lenHigh).toBeGreaterThan(lenLow);
    expect(computeVectorLength(0, 20)).toBe(0);
  });

  it('positions CoG weight and connection force arrows without reallocating', () => {
    const scene = new THREE.Scene();
    const field = createForceVectorField({ THREE, scene });
    expect(field.group.visible).toBe(false);

    const arrowRefBefore = field.connArrows[0];
    field.update({
      visible: true,
      cogWorld: { x: 1, y: 2, z: 3 },
      cargoWeightT: 24,
      totalHookLoadT: 25,
      connections: [
        { origin: { x: 2, y: 3, z: 1 }, dir: { x: -0.5, y: 1, z: 0 }, tensionT: 14, swlT: 12 }
      ]
    });

    expect(field.group.visible).toBe(true);
    expect(field.cogGravityArrow.visible).toBe(true);
    expect(field.cogGravityArrow.position.toArray()).toEqual([1, 2, 3]);
    expect(field.cogLiftArrow.visible).toBe(true);
    expect(field.connArrows[0]).toBe(arrowRefBefore);
    expect(field.connArrows[0].visible).toBe(true);
    expect(field.connArrows[1].visible).toBe(false);

    field.dispose();
    expect(scene.children.length).toBe(0);
  });

  it('provides complete EN and VI explanatory tooltip matching EXTRA_UI_EN dictionary', () => {
    const viTip = getSlingAngleTooltip('vi');
    const enTip = getSlingAngleTooltip('en');
    expect(viTip).toContain('Góc ngang của dây (α)');
    expect(enTip).toContain('Horizontal Sling Angle (α)');
    expect(EXTRA_UI_EN[viTip]).toBe(enTip);
  });
});
