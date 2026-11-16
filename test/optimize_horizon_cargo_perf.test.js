// @purpose: Kiểm thử tự động cho hòa chân trời, 3D Steel Pipe / Vehicle, cache CAD và tối ưu hiệu năng
import { describe, expect, it, vi } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import * as THREE from 'three';
import { createHorizonSkyDome } from '../src/graphics/HorizonSkyDome.js';
import { applyGroundHorizonFade } from '../src/graphics/GroundHorizonFade.js';
import {
  buildSteelPipeCargoMesh,
  buildProceduralCoachBusMesh
} from '../src/graphics/SpecialtyCargoMeshes.js';
import { sealSolidCargoShell } from '../src/graphics/SolidShellSealer.js';
import {
  clampToneSettings,
  buildCanvasFilterCss,
  applyToneSettingsToCanvas
} from '../src/graphics/GraphicsToneHelper.js';
import {
  tryReuseSettledSlackRope,
  recordSolvedSlackRope,
  writeChainLinkInstanceMatrix
} from '../src/rigging/SlingPerfHelper.js';
import { QUALITY_TIERS } from '../src/graphics/SceneRenderer.js';
import { AssetLoaders } from '../src/core/AssetLoaders.js';

describe('Horizon seamless blend', () => {
  it('matches Three.js fog_fragment space (un-tonemapped + colorspace_fragment) with smooth gradient above y=0', () => {
    const scene = new THREE.Scene();
    const dome = createHorizonSkyDome(scene);
    const mat = dome.material;
    expect(mat.toneMapped).toBe(false);
    expect(mat.fragmentShader).not.toContain('#include <tonemapping_fragment>');
    expect(mat.fragmentShader).toContain('#include <colorspace_fragment>');
    expect(mat.fragmentShader).toContain('float elev = clamp(y, 0.0, 1.0);');
    expect(mat.fragmentShader).not.toContain('y + 0.055');
  });

  it('patches ground material once for radial horizon fade', () => {
    const mat = new THREE.MeshStandardMaterial({ color: 0x475569 });
    applyGroundHorizonFade(mat, 130, 490);
    expect(mat.userData.__groundHorizonFadeKey).toBe('ground_horizon_fade_130_490');
    expect(typeof mat.onBeforeCompile).toBe('function');
    const mockShader = { vertexShader: 'void main() {\n#include <fog_vertex>\n}' };
    mat.onBeforeCompile(mockShader, null);
    expect(mockShader.vertexShader).toContain('_groundRadialM');
    expect(mockShader.vertexShader).toContain('vFogDepth = max(vFogDepth');
  });
});

describe('Solid opaque sealing for bus and 3D cargo blocks', () => {
  it('converts transparent glass and FrontSide meshes into opaque DoubleSide and seals bus belly/cabin', () => {
    const g = new THREE.Group();
    const glassMesh = new THREE.Mesh(
      new THREE.BoxGeometry(1, 1, 1),
      new THREE.MeshStandardMaterial({ name: 'Vehicle_Glass', transparent: true, opacity: 0.72 })
    );
    const bodyMesh = new THREE.Mesh(
      new THREE.BoxGeometry(9, 2.8, 2.38),
      new THREE.MeshStandardMaterial({ name: 'Vehicle_BodyPaint' })
    );
    g.add(glassMesh, bodyMesh);
    sealSolidCargoShell(THREE, g, 'car', { L: 9, W: 2.38, H: 2.8 });
    expect(glassMesh.material.transparent).toBe(false);
    expect(glassMesh.material.opacity).toBe(1);
    expect(glassMesh.material.side).toBe(THREE.DoubleSide);
    expect(bodyMesh.material.side).toBe(THREE.DoubleSide);
    expect(g.children.some((c) => c.name === 'Vehicle_Belly_Seal')).toBe(true);
    expect(g.children.some((c) => c.name === 'Vehicle_Cabin_Seal')).toBe(true);
  });

  it('adds sealed inner core for closed ISO containers and floor slab for uncovered open-top', () => {
    const dryBox = new THREE.Group();
    sealSolidCargoShell(THREE, dryBox, 'iso40', { L: 12.19, W: 2.44, H: 2.59 });
    expect(dryBox.children.some((c) => c.name === 'Solid_Seal_Core')).toBe(true);

    const openTop = new THREE.Group();
    sealSolidCargoShell(THREE, openTop, 'opentop', { L: 6.06, W: 2.44, H: 2.59, oogTarp: false });
    expect(openTop.children.some((c) => c.name === 'Cargo_Deck_Seal')).toBe(true);
  });
});

describe('Steel Pipe (OOG) & consistent Vehicle coach bus', () => {
  it('builds Steel Pipe (OOG) 3D group with pipe shell, cradles, lugs and valid bounds', () => {
    const group = buildSteelPipeCargoMesh(THREE, 12.0, 2.2, 2.2, {});
    let meshCount = 0;
    group.traverse((o) => { if (o.isMesh) meshCount += 1; });
    expect(meshCount).toBeGreaterThanOrEqual(8);
    const size = new THREE.Box3().setFromObject(group).getSize(new THREE.Vector3());
    expect(size.x).toBeGreaterThan(11.5);
    expect(size.y).toBeGreaterThan(1.8);
    expect(size.z).toBeGreaterThan(1.5);
  });

  it('builds consistent teal coach bus fallback matching 9.0x2.38x2.80m CAD dims', () => {
    const bus = buildProceduralCoachBusMesh(THREE, 9.0, 2.38, 2.80, {});
    let meshCount = 0;
    bus.traverse((o) => { if (o.isMesh) meshCount += 1; });
    expect(meshCount).toBeGreaterThanOrEqual(10);
    const size = new THREE.Box3().setFromObject(bus).getSize(new THREE.Vector3());
    expect(size.x).toBeCloseTo(9.0, 0);
    expect(size.y).toBeCloseTo(2.8, 0);
    expect(size.z).toBeCloseTo(2.38, 0);
  });

  it('registers pipe preset in sim state libraryCatalog', () => {
    const stateSrc = fs.readFileSync(path.resolve('src/sim/state.js'), 'utf8');
    expect(stateSrc).toContain("id: 'pipe'");
    expect(stateSrc).toContain("meshName: 'Steel_Pipe_OOG'");
  });
});

describe('Runtime & Asset performance helpers', () => {
  it('reuses settled slack rope points after 8 idle frames and invalidates on motion', () => {
    const slingObj = {};
    const A = new THREE.Vector3(-2, 4, 0);
    const B = new THREE.Vector3(2, 4, 0);
    const pts = [A.clone(), new THREE.Vector3(0, 3.2, 0), B.clone()];
    for (let f = 0; f < 9; f++) {
      expect(tryReuseSettledSlackRope(slingObj, A, B, 5.2, 'crate|1', true)).toBeNull();
      recordSolvedSlackRope(slingObj, A, B, 5.2, 'crate|1', pts, true);
    }
    expect(tryReuseSettledSlackRope(slingObj, A, B, 5.2, 'crate|1', true)).toBe(pts);
    const movedA = new THREE.Vector3(-2.05, 4, 0);
    expect(tryReuseSettledSlackRope(slingObj, movedA, B, 5.2, 'crate|1', true)).toBeNull();
  });

  it('writes chain link instance matrix cleanly without errors', () => {
    const geo = new THREE.BoxGeometry(0.1, 0.2, 0.1);
    const mat = new THREE.MeshStandardMaterial();
    const inst = new THREE.InstancedMesh(geo, mat, 4);
    writeChainLinkInstanceMatrix(
      THREE, inst, 0,
      new THREE.Vector3(0, 0, 0),
      new THREE.Vector3(0, 1, 0),
      0.5, new THREE.Vector3(0, 0, 1),
      1, 1, new THREE.Vector3(0, 1, 0)
    );
    const m = new THREE.Matrix4();
    inst.getMatrixAt(0, m);
    expect(m.elements[13]).toBeCloseTo(0.5, 4);
  });

  it('caches loadFromUrl results and returns independent clones', async () => {
    AssetLoaders.urlCache.clear();
    const simpleObj = 'o Cube\nv 0 0 0\nv 1 0 0\nv 0 1 0\nf 1 2 3\n';
    const fetchSpy = vi.fn().mockResolvedValue({
      ok: true,
      text: async () => simpleObj
    });
    const origFetch = globalThis.fetch;
    globalThis.fetch = fetchSpy;
    try {
      const loader = new AssetLoaders();
      const first = await loader.loadFromUrl('/assets/models/mock_box.obj', {});
      const second = await loader.loadFromUrl('/assets/models/mock_box.obj', {});
      expect(fetchSpy).toHaveBeenCalledTimes(1);
      expect(first.root).not.toBe(second.root);
      expect(second.report.fromCache).toBe(true);
    } finally {
      globalThis.fetch = origFetch;
      AssetLoaders.urlCache.clear();
    }
  });

  it('keeps high and studio quality tier shadow map sizes valid', () => {
    expect(QUALITY_TIERS.high.shadowMapSize).toBe(4096);
    expect(QUALITY_TIERS.studio.shadowMapSize).toBe(2048);
    expect(QUALITY_TIERS.ultra.shadowMapSize).toBe(4096);
  });

  it('skips EdgesGeometry for massive >8000 vertex CAD meshes in scene.js', () => {
    const sceneSrc = fs.readFileSync(path.resolve('src/sim/scene.js'), 'utf8');
    expect(sceneSrc).toContain('if (count > 8000) return;');
  });

  it('clamps and applies game-style brightness and contrast filter strings', () => {
    expect(clampToneSettings({ brightness: 3.0, contrast: 0.1 })).toEqual({ brightness: 1.8, contrast: 0.6 });
    expect(buildCanvasFilterCss({ brightness: 1.0, contrast: 1.0 })).toBe('none');
    expect(buildCanvasFilterCss({ brightness: 1.25, contrast: 1.15 })).toBe('brightness(1.25) contrast(1.15)');
    const mockCanvas = { style: {} };
    applyToneSettingsToCanvas(mockCanvas, { brightness: 1.3, contrast: 1.2 });
    expect(mockCanvas.style.filter).toBe('brightness(1.30) contrast(1.20)');
  });

  it('adds dark-sky dithering, organic drifting clouds without sticks, and multi-scale concrete maps', () => {
    const domeSrc = fs.readFileSync(path.resolve('src/graphics/HorizonSkyDome.js'), 'utf8');
    const wxSrc = fs.readFileSync(path.resolve('src/sim/weather_fx.js'), 'utf8');
    const texSrc = fs.readFileSync(path.resolve('src/graphics/pbr/ProceduralTextures.js'), 'utf8');
    const pbrSrc = fs.readFileSync(path.resolve('src/graphics/PBRMaterialFactory.js'), 'utf8');
    expect(domeSrc).toContain('dither');
    expect(wxSrc).toContain('destination-in');
    expect(wxSrc).not.toContain('windStreaks');
    expect(wxSrc).not.toContain('size * 0.42');
    expect(texSrc).toContain('drawTileableBlotch');
    expect(pbrSrc).toContain('options.includeJoints !== false');
  });
});
