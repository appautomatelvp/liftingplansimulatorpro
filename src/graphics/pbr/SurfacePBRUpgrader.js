// @purpose: Phủ bản đồ PBR và tạo UV triplanar cho model tải bất đồng bộ và các bề mặt công nghiệp tránh bị trơn nhựa
import {
  drawCorrugatedContainerMaps,
  drawTimberWoodMaps,
  drawCanvasTarpMaps
} from './IndustrialWearPBR.js';
import { drawForgedSteelMaps, drawPaintedSteelMaps } from './StressPBRMaterials.js';

const STEEL_RE = /steel|galv|cast|stainless|hinge|corner|cavity|rail|pin|bolt|twistlock|lug|padeye|shackle|hook|iron|alloy|rim|chrome/i;
const TIMBER_RE = /wood|timber|plank|dunnage|crate|lumber|oak|pine|deck/i;
const RUBBER_RE = /rubber|tire|tyre|mat|neoprene|gasket|hose|bumper/i;
const TARP_RE = /tarp|canvas|cover|fabric|cloth|sheeting|webbing/i;
const GLASS_RE = /glass|window|windscreen|windshield|headlamp|lens|mirror/i;
const CORRUGATED_RE = /wall|side|panel|door|roof|corrug|shell|body|box|container|hull|reefer/i;

/**
 * Computes box-projected UV coordinates in world meters if an imported OBJ/CAD
 * geometry lacks a UV attribute so procedural PBR maps tile naturally instead of sampling (0,0).
 */
export function ensureTriplanarBoxUVs(THREE, geometry, scalePerMeter = 0.45) {
  if (!geometry || !geometry.attributes?.position) return false;
  if (geometry.attributes.uv && geometry.attributes.uv.count === geometry.attributes.position.count) {
    return false;
  }
  const pos = geometry.attributes.position;
  let norm = geometry.attributes.normal;
  if (!norm && typeof geometry.computeVertexNormals === 'function') {
    geometry.computeVertexNormals();
    norm = geometry.attributes.normal;
  }
  const count = pos.count;
  const uvs = new Float32Array(count * 2);
  const s = Number.isFinite(scalePerMeter) && scalePerMeter > 0 ? scalePerMeter : 0.45;
  for (let i = 0; i < count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const z = pos.getZ(i);
    const nx = norm ? Math.abs(norm.getX(i)) : 0;
    const ny = norm ? Math.abs(norm.getY(i)) : 1;
    const nz = norm ? Math.abs(norm.getZ(i)) : 0;
    let u = x * s;
    let v = z * s;
    if (nx >= ny && nx >= nz) {
      u = z * s;
      v = y * s;
    } else if (nz >= ny && nz >= nx) {
      u = x * s;
      v = y * s;
    }
    uvs[i * 2] = u;
    uvs[i * 2 + 1] = v;
  }
  geometry.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
  return true;
}

/**
 * Classifies a mesh/material surface into an authentic industrial PBR category.
 */
export function classifySurfaceKind(meshName = '', matName = '', material = null) {
  const label = `${meshName || ''} ${matName || ''}`;
  if (GLASS_RE.test(label) || (material?.clearcoat >= 0.85 && material?.metalness >= 0.6)) return 'glass';
  if (RUBBER_RE.test(label)) return 'rubber';
  if (TIMBER_RE.test(label)) return 'timber';
  if (TARP_RE.test(label)) return 'tarp';
  if (STEEL_RE.test(label)) return 'steel_bare';
  if (CORRUGATED_RE.test(label)) return 'corrugated';
  return 'painted_steel';
}

export function resolveWearBundle(THREE, pbrFactory, kind) {
  if (!pbrFactory) return null;
  const cacheKey = `wear_bundle_${kind}`;
  if (pbrFactory.cachedTextures.has(cacheKey)) return pbrFactory.cachedTextures.get(cacheKey);
  const mk = (cvs, isSRGB = false, rx = 2, ry = 2) => pbrFactory._buildRepeatTexture(cvs, isSRGB, rx, ry, isSRGB);
  let bundle = null;
  if (kind === 'timber') {
    const { cvsBase, cvsNorm, cvsRough } = drawTimberWoodMaps(256, '#d6c7b2');
    bundle = { map: mk(cvsBase, true, 2, 2), normalMap: mk(cvsNorm, false, 2, 2), roughnessMap: mk(cvsRough, false, 2, 2), roughness: 1.0, metalness: 0.03, normalScale: 0.9 };
  } else if (kind === 'steel_bare') {
    const { cvsNorm, cvsRough, cvsMetal } = drawForgedSteelMaps(256);
    bundle = { normalMap: mk(cvsNorm, false, 2, 2), roughnessMap: mk(cvsRough, false, 2, 2), metalnessMap: mk(cvsMetal, false, 2, 2), roughness: 1.0, metalness: 1.0, normalScale: 0.75 };
  } else if (kind === 'tarp') {
    const { cvsNorm, cvsRough } = drawCanvasTarpMaps(256, '#ffffff');
    bundle = { normalMap: mk(cvsNorm, false, 3, 3), roughnessMap: mk(cvsRough, false, 3, 3), roughness: 1.0, metalness: 0.02, normalScale: 0.7 };
  } else if (kind === 'rubber') {
    const { cvsNorm, cvsRough } = drawCanvasTarpMaps(128, '#262626');
    bundle = { normalMap: mk(cvsNorm, false, 4, 4), roughnessMap: mk(cvsRough, false, 4, 4), roughness: 0.95, metalness: 0.04, normalScale: 0.45 };
  } else if (kind === 'corrugated') {
    const { cvsNorm, cvsRough, cvsMetal } = drawCorrugatedContainerMaps(256, '#94a3b8');
    bundle = { normalMap: mk(cvsNorm, false, 2, 1), roughnessMap: mk(cvsRough, false, 2, 1), metalnessMap: mk(cvsMetal, false, 2, 1), roughness: 1.0, metalness: 1.0, normalScale: 0.85 };
  } else {
    const { cvsNorm, cvsRough, cvsMetal } = drawPaintedSteelMaps(256, '#94a3b8');
    bundle = { normalMap: mk(cvsNorm, false, 2, 2), roughnessMap: mk(cvsRough, false, 2, 2), metalnessMap: mk(cvsMetal, false, 2, 2), roughness: 1.0, metalness: 1.0, normalScale: 0.65 };
  }
  pbrFactory.cachedTextures.set(cacheKey, bundle);
  return bundle;
}

/**
 * Enriches an existing Standard/Physical material (e.g. from async OBJ/MTL loader) with
 * realistic surface PBR maps (normal/roughness/metalness) while preserving authored `.mtl` color.
 */
export function enrichMaterialWithPBR({ THREE, material, geometry, meshName = '', pbrFactory }) {
  if (!material || !pbrFactory) return material;
  if (!(material instanceof THREE.MeshStandardMaterial || material instanceof THREE.MeshPhysicalMaterial)) {
    return material;
  }
  if (material.transparent && (material.opacity ?? 1) < 0.95) return material;
  const emissiveLuma = material.emissive ? (material.emissive.r + material.emissive.g + material.emissive.b) : 0;
  if (emissiveLuma > 0.05 && (material.emissiveIntensity || 0) > 0.4) return material;

  const kind = classifySurfaceKind(meshName, material.name || '', material);
  if (kind === 'glass') return material;

  if (geometry) ensureTriplanarBoxUVs(THREE, geometry, kind === 'timber' ? 0.55 : 0.42);
  if (geometry && material.aoMap && !geometry.attributes.uv2 && geometry.attributes.uv) {
    geometry.setAttribute('uv2', geometry.attributes.uv);
  }

  // Avoid flattening glossy automotive paint explicitly tagged on bus/car bodies
  if (/Vehicle_BodyPaint|carRed/i.test(material.name || '')) return material;

  if (!material.roughnessMap) {
    const bundle = resolveWearBundle(THREE, pbrFactory, kind);
    if (bundle) {
      if (bundle.normalMap && !material.normalMap) {
        material.normalMap = bundle.normalMap;
        material.normalScale = material.normalScale || new THREE.Vector2(bundle.normalScale ?? 0.65, bundle.normalScale ?? 0.65);
      }
      if (bundle.roughnessMap) {
        material.roughnessMap = bundle.roughnessMap;
        material.roughness = bundle.roughness ?? 1.0;
      }
      if (bundle.metalnessMap && !material.metalnessMap) {
        material.metalnessMap = bundle.metalnessMap;
        material.metalness = bundle.metalness ?? 1.0;
      } else if (bundle.metalness !== undefined) {
        material.metalness = bundle.metalness;
      }
      if (bundle.map && !material.map && kind === 'timber') {
        // Apply neutral greyscale wood grain so material.color tints naturally
        material.map = bundle.map;
      }
      if ('clearcoat' in material && kind !== 'steel_bare') {
        material.clearcoat = Math.min(Number(material.clearcoat) || 0, 0.06);
        material.clearcoatRoughness = Math.max(Number(material.clearcoatRoughness) || 0.55, 0.52);
      }
      material.needsUpdate = true;
    }
  }
  return material;
}

/**
 * Traverses a loaded CAD/OBJ root and upgrades every mesh geometry & material in place
 * so PBR wear maps survive async model replacement cleanly.
 */
export function upgradeLoadedModelGroup(THREE, root, pbrFactory) {
  if (!root || !pbrFactory) return root;
  root.traverse((child) => {
    if (!child.isMesh || child.userData?.isCADEdge || child.userData?.dragType || child.userData?.isSolidSealCore) return;
    const mats = Array.isArray(child.material) ? child.material : [child.material];
    mats.forEach((mat) => {
      enrichMaterialWithPBR({ THREE, material: mat, geometry: child.geometry, meshName: child.name, pbrFactory });
    });
  });
  return root;
}
