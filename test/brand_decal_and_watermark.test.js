// @purpose: Tests cho BrandDecalHelper (shared cached CanvasTexture + decal 3D) và Viewport Watermark cho Free/Trial vs Pro
import { describe, it, expect, beforeEach } from 'vitest';
import * as THREE from 'three';
import {
  __resetBrandDecalCacheForTests,
  resolveBrandStencilText,
  getOrCreateBrandDecalMaterial,
  stampCraneBrandDecals,
  stampHookBrandDecals,
  stampSpreaderBrandDecals,
  stampCargoBrandPlate
} from '../src/graphics/BrandDecalHelper.js';
import {
  resolveWatermarkMode,
  buildWatermarkSvgDataUrl,
  syncViewportWatermark
} from '../src/saas/viewport_watermark.js';

describe('3D Brand Decal Helper & Anti-Theft Viewport Watermark', () => {
  beforeEach(() => {
    __resetBrandDecalCacheForTests();
  });

  it('caches single shared material & geometry across Crane, Hook, Spreader, and Cargo stamps', () => {
    const matA = getOrCreateBrandDecalMaterial(THREE);
    const matB = getOrCreateBrandDecalMaterial(THREE);
    expect(matA).toBe(matB);
    expect(resolveBrandStencilText()).toContain('SAFELIFT3D.COM');
    expect(resolveBrandStencilText()).toContain('LÊ VIỆT PHƯƠNG');

    const hookGroup = new THREE.Group();
    const boomPivot = new THREE.Group();
    const craneGroup = new THREE.Group();
    const spreaderGroup = new THREE.Group();
    const cargoGroup = new THREE.Group();

    const hookDecals = stampHookBrandDecals(THREE, hookGroup);
    const craneDecals = stampCraneBrandDecals(THREE, craneGroup, { boomPivot }, 'mobile_telescopic');
    const spreaderDecals = stampSpreaderBrandDecals(THREE, spreaderGroup, 'spreader', 12);
    const cargoDecal = stampCargoBrandPlate(THREE, cargoGroup, { L: 12, W: 2.4, H: 2.6 });

    expect(hookDecals.length).toBe(2);
    expect(craneDecals.length).toBe(2);
    expect(spreaderDecals.length).toBe(2);
    expect(cargoDecal?.userData?.isBrandDecal).toBe(true);
    expect(hookDecals[0].material).toBe(craneDecals[0].material);
    expect(spreaderDecals[0].geometry).toBe(cargoDecal.geometry);
  });

  it('enables diagonal SVG watermark for free and trial accounts, removes for paid Pro', () => {
    const now = 3_000_000_000_000;
    expect(resolveWatermarkMode({ tier: 'free', status: 'active' }, now)).toBe('free');
    expect(resolveWatermarkMode({ tier: 'free', status: 'active', trialEndsAt: now + 3600_000 }, now)).toBe('trial');
    expect(resolveWatermarkMode({ tier: 'pro', status: 'active' }, now)).toBe('pro');
    expect(resolveWatermarkMode({ role: 'admin', tier: 'free', status: 'active' }, now)).toBe('pro');

    const svgUrl = buildWatermarkSvgDataUrl();
    expect(decodeURIComponent(svgUrl)).toContain('SAFELIFT3D.COM');

    const byId = new Map();
    const bodyChildren = [];
    const fakeDoc = {
      body: {
        appendChild(n) { bodyChildren.push(n); if (n.id) byId.set(n.id, n); }
      },
      getElementById: (id) => byId.get(id) || null,
      createElement: () => ({
        id: '',
        className: '',
        dataset: {},
        style: {},
        setAttribute() {},
        remove() { byId.delete(this.id); }
      })
    };

    const trialRes = syncViewportWatermark({ tier: 'free', status: 'active', trialEndsAt: now + 60_000 }, { doc: fakeDoc, nowMs: now });
    expect(trialRes.visible).toBe(true);
    expect(trialRes.mode).toBe('trial');
    expect(byId.get('saas-viewport-watermark')).toBeTruthy();

    const proRes = syncViewportWatermark({ tier: 'pro', status: 'active' }, { doc: fakeDoc, nowMs: now });
    expect(proRes.visible).toBe(false);
    expect(byId.get('saas-viewport-watermark')).toBeUndefined();
  });
});
