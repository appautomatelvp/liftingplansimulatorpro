import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { PBRMaterialFactory } from '../src/graphics/PBRMaterialFactory.js';

describe('Industrial Wear & Tear PBR Materials (Section 4)', () => {
  it('builds weathered corrugated container material with roughnessMap, normalMap, and metalnessMap', () => {
    const factory = new PBRMaterialFactory(null);
    const mat = factory.createIndustrialCargoMaterial('#0369a1', { repeatX: 3, repeatY: 1 });
    expect(mat).toBeInstanceOf(THREE.MeshStandardMaterial);
    expect(mat.map).toBeTruthy();
    expect(mat.map.colorSpace).toBe(THREE.SRGBColorSpace);
    expect(mat.normalMap).toBeTruthy();
    expect(mat.normalMap.colorSpace).toBe(THREE.NoColorSpace);
    expect(mat.roughnessMap).toBeTruthy();
    expect(mat.roughnessMap.colorSpace).toBe(THREE.NoColorSpace);
    expect(mat.metalnessMap).toBeTruthy();
    expect(mat.metalnessMap.colorSpace).toBe(THREE.NoColorSpace);
  });

  it('builds dark greased wire rope with higher matte roughness and high-metalness matte chain alloy', () => {
    const factory = new PBRMaterialFactory(null);
    const wire = factory.createWireRopeMaterial();
    expect(wire.roughness).toBeGreaterThanOrEqual(0.50);
    expect(wire.roughnessMap).toBeTruthy();
    expect(wire.normalMap).toBeTruthy();

    const chain = factory.createChainAlloyMaterial('body');
    expect(chain.metalness).toBeGreaterThanOrEqual(0.88);
    expect(chain.roughness).toBeGreaterThanOrEqual(0.45);
    expect(chain.roughnessMap).toBeTruthy();
  });
});
