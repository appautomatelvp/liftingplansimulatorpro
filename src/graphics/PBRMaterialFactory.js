// @purpose: Nhà máy tạo vật liệu PBR chuẩn công nghiệp hàng hải và đồng bộ không gian màu Three.js r170+
import * as THREE from 'three';
import {
  drawHazardChevronCanvas,
  drawMaritimeWaterNormalCanvas,
  drawQuayConcreteMaps,
  drawRoundSlingMaps,
  drawWebSlingMaps,
  makeCanvas
} from './pbr/ProceduralTextures.js';
import {
  drawForgedSteelMaps,
  drawPaintedSteelMaps,
  resolveStressTintedMaterial
} from './pbr/StressPBRMaterials.js';
import {
  drawCorrugatedContainerMaps,
  drawForgedChainMaps,
  drawGreasedWireRopeMaps,
  drawTimberWoodMaps
} from './pbr/IndustrialWearPBR.js';
import { upgradeLoadedModelGroup } from './pbr/SurfacePBRUpgrader.js';

export class PBRMaterialFactory {
  constructor(renderer = null) {
    this.renderer = renderer;
    this.cachedTextures = new Map();
    this.cachedMaterials = new Map();
    this.maxAnisotropy = renderer ? renderer.capabilities.getMaxAnisotropy() : 16;
  }

  _buildRepeatTexture(canvas, isSRGB, repeatX = 1, repeatY = 1, applyAniso = true) {
    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = isSRGB ? THREE.SRGBColorSpace : THREE.NoColorSpace;
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    if (repeatX !== 1 || repeatY !== 1) tex.repeat.set(repeatX, repeatY);
    if (applyAniso) tex.anisotropy = this.maxAnisotropy;
    return tex;
  }

  enforcePBRMaterials(root) {
    if (!root) return root;
    root.traverse((child) => {
      if (!child.isMesh) return;
      if (!child.userData.noShadow) {
        child.castShadow = true;
        child.receiveShadow = true;
      }
      const mats = Array.isArray(child.material) ? child.material : [child.material];
      mats.forEach((mat, idx) => {
        if (!mat) return;
        if (mat.map) { mat.map.colorSpace = THREE.SRGBColorSpace; mat.map.anisotropy = this.maxAnisotropy; }
        if (mat.emissiveMap) mat.emissiveMap.colorSpace = THREE.SRGBColorSpace;
        if (mat.normalMap) { mat.normalMap.colorSpace = THREE.NoColorSpace; mat.normalMap.anisotropy = this.maxAnisotropy; }
        if (mat.roughnessMap) mat.roughnessMap.colorSpace = THREE.NoColorSpace;
        if (mat.metalnessMap) mat.metalnessMap.colorSpace = THREE.NoColorSpace;
        if (mat.aoMap) {
          mat.aoMap.colorSpace = THREE.NoColorSpace;
          if (child.geometry && !child.geometry.attributes.uv2 && child.geometry.attributes.uv) {
            child.geometry.setAttribute('uv2', child.geometry.attributes.uv);
          }
        }
        if (!child.userData.preserveMaterial &&
          !(mat instanceof THREE.MeshStandardMaterial || mat instanceof THREE.MeshPhysicalMaterial) &&
          !child.userData.isCADEdge && !child.userData.dragType) {
          const upgraded = new THREE.MeshStandardMaterial({
            color: mat.color ? mat.color.clone() : new THREE.Color(0x94a3b8),
            map: mat.map || null,
            metalness: 0.45,
            roughness: 0.35
          });
          if (Array.isArray(child.material)) child.material[idx] = upgraded;
          else child.material = upgraded;
        }
      });
    });
    return upgradeLoadedModelGroup(THREE, root, this);
  }

  createQuayConcreteMaterial(options = {}) {
    const cacheKey = 'quay_concrete_pbr';
    if (this.cachedMaterials.has(cacheKey)) return this.cachedMaterials.get(cacheKey);

    const { cvsBase, cvsNorm, cvsRough, cvsAO } = drawQuayConcreteMaps(1024, options.includeJoints !== false);
    const rx = options.repeatX || 115;
    const ry = options.repeatY || 115;
    const material = new THREE.MeshStandardMaterial({
      map: this._buildRepeatTexture(cvsBase, true, rx, ry, true),
      normalMap: this._buildRepeatTexture(cvsNorm, false, rx, ry, true),
      normalScale: new THREE.Vector2(1.15, 1.15),
      roughnessMap: this._buildRepeatTexture(cvsRough, false, rx, ry, false),
      roughness: 0.90,
      metalness: 0.08,
      aoMap: this._buildRepeatTexture(cvsAO, false, rx, ry, false),
      aoMapIntensity: 0.95
    });
    this.cachedMaterials.set(cacheKey, material);
    return material;
  }

  createWireRopeMaterial() {
    const cacheKey = 'wire_rope_pbr';
    if (this.cachedMaterials.has(cacheKey)) return this.cachedMaterials.get(cacheKey);

    const { cvsBase, cvsNorm, cvsRough } = drawGreasedWireRopeMaps(256);
    const material = new THREE.MeshStandardMaterial({
      map: this._buildRepeatTexture(cvsBase, true, 1, 16, true),
      normalMap: this._buildRepeatTexture(cvsNorm, false, 1, 16, true),
      normalScale: new THREE.Vector2(1.25, 1.25),
      roughnessMap: this._buildRepeatTexture(cvsRough, false, 1, 16, false),
      roughness: 0.62,
      metalness: 0.86
    });
    this.cachedMaterials.set(cacheKey, material);
    return material;
  }

  createChainAlloyMaterial(variant = 'body') {
    const cacheKey = `chain_alloy_${variant}`;
    if (this.cachedMaterials.has(cacheKey)) return this.cachedMaterials.get(cacheKey);

    if (variant === 'powder_red' || variant === 'powder_yellow') {
      const mat = new THREE.MeshStandardMaterial({
        color: variant === 'powder_red' ? 0xb91c1c : 0xd97706,
        metalness: 0.35,
        roughness: 0.48
      });
      this.cachedMaterials.set(cacheKey, mat);
      return mat;
    }

    const { cvsBase, cvsRough } = drawForgedChainMaps(256);
    const mat = new THREE.MeshStandardMaterial({
      map: this._buildRepeatTexture(cvsBase, true, 1, 1, false),
      roughnessMap: this._buildRepeatTexture(cvsRough, false, 1, 1, false),
      color: 0x4b5563,
      metalness: 0.90,
      roughness: 0.50
    });
    this.cachedMaterials.set(cacheKey, mat);
    return mat;
  }

  createWebSlingMaterial(colorHex = '#16a34a', stripeCount = 2) {
    const cacheKey = `web_sling_${colorHex}_${stripeCount}`;
    if (this.cachedMaterials.has(cacheKey)) return this.cachedMaterials.get(cacheKey);

    const { cvsBase, cvsNorm } = drawWebSlingMaps(1024, colorHex, stripeCount);
    const material = new THREE.MeshStandardMaterial({
      map: this._buildRepeatTexture(cvsBase, true, 1, 6, true),
      normalMap: this._buildRepeatTexture(cvsNorm, false, 1, 6, false),
      normalScale: new THREE.Vector2(1.05, 1.05),
      roughness: 0.95,
      metalness: 0.0,
      side: THREE.DoubleSide
    });
    this.cachedMaterials.set(cacheKey, material);
    return material;
  }

  createRoundSlingMaterial(colorHex = '#2563eb') {
    const cacheKey = `round_sling_${colorHex}`;
    if (this.cachedMaterials.has(cacheKey)) return this.cachedMaterials.get(cacheKey);

    const { cvsBase, cvsNorm } = drawRoundSlingMaps(512, colorHex);
    const material = new THREE.MeshStandardMaterial({
      map: this._buildRepeatTexture(cvsBase, true, 1, 6, true),
      normalMap: this._buildRepeatTexture(cvsNorm, false, 1, 6, false),
      normalScale: new THREE.Vector2(0.65, 0.65),
      roughness: 0.88,
      metalness: 0.02
    });
    this.cachedMaterials.set(cacheKey, material);
    return material;
  }

  createMaritimeWaterMaterial(options = {}) {
    const cacheKey = 'maritime_water_pbr';
    if (this.cachedMaterials.has(cacheKey)) return this.cachedMaterials.get(cacheKey);

    const normalTex = this._buildRepeatTexture(drawMaritimeWaterNormalCanvas(512), false, 16, 12, true);
    const material = new THREE.MeshPhysicalMaterial({
      color: options.color || 0x03445e,
      roughness: 0.14,
      metalness: 0.75,
      clearcoat: 0.85,
      clearcoatRoughness: 0.08,
      transparent: true,
      opacity: 0.92,
      normalMap: normalTex,
      normalScale: new THREE.Vector2(0.35, 0.35)
    });
    this.cachedMaterials.set(cacheKey, material);
    return material;
  }

  createHazardChevronTexture(repeats = 4) {
    return this._buildRepeatTexture(drawHazardChevronCanvas(512, repeats), true, 1, 1, true);
  }

  createCanvas(width, height) {
    return makeCanvas(width, height);
  }

  createPaintedSteelBeamMaterial(paintHex = '#d97706') {
    const cacheKey = `painted_steel_beam_${paintHex}`;
    if (this.cachedMaterials.has(cacheKey)) return this.cachedMaterials.get(cacheKey);
    const { cvsBase, cvsNorm, cvsRough, cvsMetal } = drawPaintedSteelMaps(256, paintHex);
    const material = new THREE.MeshPhysicalMaterial({
      map: this._buildRepeatTexture(cvsBase, true, 2, 1, true),
      normalMap: this._buildRepeatTexture(cvsNorm, false, 2, 1, true),
      roughnessMap: this._buildRepeatTexture(cvsRough, false, 2, 1, false),
      metalnessMap: this._buildRepeatTexture(cvsMetal, false, 2, 1, false),
      roughness: 1.0,
      metalness: 1.0,
      clearcoat: 0.06,
      clearcoatRoughness: 0.56
    });
    this.cachedMaterials.set(cacheKey, material);
    return material;
  }

  createTimberWoodMaterial(woodHex = '#8b5a2b') {
    const cacheKey = `timber_wood_${woodHex}`;
    if (this.cachedMaterials.has(cacheKey)) return this.cachedMaterials.get(cacheKey);
    const { cvsBase, cvsNorm, cvsRough } = drawTimberWoodMaps(256, woodHex);
    const mat = new THREE.MeshStandardMaterial({
      map: this._buildRepeatTexture(cvsBase, true, 2, 2, true),
      normalMap: this._buildRepeatTexture(cvsNorm, false, 2, 2, true),
      normalScale: new THREE.Vector2(0.95, 0.95),
      roughnessMap: this._buildRepeatTexture(cvsRough, false, 2, 2, false),
      roughness: 1.0,
      metalness: 0.03
    });
    this.cachedMaterials.set(cacheKey, mat);
    return mat;
  }

  createRubberMaterial(rubberHex = '#17191f') {
    const cacheKey = `rubber_matte_${rubberHex}`;
    if (this.cachedMaterials.has(cacheKey)) return this.cachedMaterials.get(cacheKey);
    const mat = new THREE.MeshStandardMaterial({ color: rubberHex, roughness: 0.92, metalness: 0.04 });
    upgradeLoadedModelGroup(THREE, { traverse: (fn) => fn({ isMesh: true, material: mat, name: 'rubber_pad', userData: {} }) }, this);
    this.cachedMaterials.set(cacheKey, mat);
    return mat;
  }

  createForgedShackleMaterial() {
    const cacheKey = 'forged_shackle_pbr';
    if (this.cachedMaterials.has(cacheKey)) return this.cachedMaterials.get(cacheKey);
    const { cvsBase, cvsNorm, cvsRough, cvsMetal } = drawForgedSteelMaps(256);
    const material = new THREE.MeshPhysicalMaterial({
      map: this._buildRepeatTexture(cvsBase, true, 1, 1, true),
      normalMap: this._buildRepeatTexture(cvsNorm, false, 1, 1, true),
      roughnessMap: this._buildRepeatTexture(cvsRough, false, 1, 1, false),
      metalnessMap: this._buildRepeatTexture(cvsMetal, false, 1, 1, false),
      roughness: 1.0,
      metalness: 1.0,
      clearcoat: 0.24,
      clearcoatRoughness: 0.26
    });
    this.cachedMaterials.set(cacheKey, material);
    return material;
  }

  createIndustrialCargoMaterial(paintHex = '#0369a1', options = {}) {
    const rx = options.repeatX || 2;
    const ry = options.repeatY || 1;
    const cacheKey = `ind_cargo_${paintHex}_${rx}_${ry}`;
    if (this.cachedMaterials.has(cacheKey)) return this.cachedMaterials.get(cacheKey);
    const { cvsBase, cvsNorm, cvsRough, cvsMetal } = drawCorrugatedContainerMaps(options.size || 256, paintHex);
    const material = new THREE.MeshStandardMaterial({
      map: this._buildRepeatTexture(cvsBase, true, rx, ry, true),
      normalMap: this._buildRepeatTexture(cvsNorm, false, rx, ry, true),
      normalScale: new THREE.Vector2(options.normalScale ?? 1.15, options.normalScale ?? 1.15),
      roughnessMap: this._buildRepeatTexture(cvsRough, false, rx, ry, false),
      metalnessMap: this._buildRepeatTexture(cvsMetal, false, rx, ry, false),
      roughness: 1.0,
      metalness: 1.0
    });
    this.cachedMaterials.set(cacheKey, material);
    return material;
  }

  getStressVisualMaterial(baseMat, tensionT = 0, swlT = 15) {
    return resolveStressTintedMaterial(baseMat, tensionT, swlT, this.cachedMaterials);
  }
}
