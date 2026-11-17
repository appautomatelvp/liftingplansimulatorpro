import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { PBRMaterialFactory } from '../src/graphics/PBRMaterialFactory.js';
import { ensureTriplanarBoxUVs, upgradeLoadedModelGroup } from '../src/graphics/pbr/SurfacePBRUpgrader.js';

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

  it('builds dark greased wire rope, matte forged chain, and rough sawn timber wood PBR materials', () => {
    const factory = new PBRMaterialFactory(null);
    const wire = factory.createWireRopeMaterial();
    expect(wire.roughness).toBeGreaterThanOrEqual(0.50);
    expect(wire.roughnessMap).toBeTruthy();
    expect(wire.normalMap).toBeTruthy();

    const chain = factory.createChainAlloyMaterial('body');
    expect(chain.metalness).toBeGreaterThanOrEqual(0.88);
    expect(chain.roughness).toBeGreaterThanOrEqual(0.45);
    expect(chain.roughnessMap).toBeTruthy();

    const timber = factory.createTimberWoodMaterial('#8b5a2b');
    expect(timber.map).toBeTruthy();
    expect(timber.normalMap).toBeTruthy();
    expect(timber.roughnessMap).toBeTruthy();
    expect(timber.metalness).toBeLessThanOrEqual(0.05);
  });

  it('enriches async loaded OBJ/MTL meshes with triplanar UVs and wear PBR maps while keeping color tint', () => {
    const factory = new PBRMaterialFactory(null);
    const geoNoUv = new THREE.BoxGeometry(2, 1, 2);
    geoNoUv.deleteAttribute('uv');
    const mtlMat = new THREE.MeshStandardMaterial({ color: 0xb91c1c, roughness: 0.25, metalness: 0.4 });
    const mesh = new THREE.Mesh(geoNoUv, mtlMat);
    mesh.name = 'Side_Panel_Steel';
    const root = new THREE.Group();
    root.add(mesh);

    upgradeLoadedModelGroup(THREE, root, factory);
    expect(geoNoUv.attributes.uv).toBeTruthy();
    expect(mtlMat.color.getHex()).toBe(0xb91c1c);
    expect(mtlMat.roughnessMap).toBeTruthy();
    expect(mtlMat.normalMap).toBeTruthy();

    // Ensure concrete slab repeat tiles realistically around cargo instead of 51m stretch
    const concrete = factory.createQuayConcreteMaterial();
    expect(concrete.map.repeat.x).toBeGreaterThanOrEqual(100);

    // Ensure non-UV helper works idempotently
    expect(ensureTriplanarBoxUVs(THREE, geoNoUv)).toBe(false);
  });
});
