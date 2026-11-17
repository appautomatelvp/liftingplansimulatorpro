// @purpose: Tạo CanvasTexture tem bản quyền công nghiệp cache 1 lần và gắn decal 3D lên Cần cẩu, Móc cẩu, Dầm/Spreader & Kiện hàng
let cachedTexture = null;
let cachedMaterial = null;
let cachedGeometry = null;

export function resolveBrandStencilText() {
  const tel = ['+84', '968', '051', '697'].join('');
  return `SAFELIFT3D.COM \u2022 DEV BY L\u00ca VI\u1ec6T PH\u01af\u01a0NG (${tel})`;
}

export function getOrCreateBrandDecalTexture(THREE) {
  if (cachedTexture) return cachedTexture;
  const text = resolveBrandStencilText();
  const width = 1024;
  const height = 160;
  let canvas = null;
  if (typeof document !== 'undefined' && typeof document.createElement === 'function') {
    canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext && canvas.getContext('2d');
    if (ctx) {
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(0, 0, width, height);
      ctx.strokeStyle = '#f59e0b';
      ctx.lineWidth = 6;
      ctx.strokeRect(4, 4, width - 8, height - 8);
      ctx.fillStyle = '#1e293b';
      for (const [rx, ry] of [[20, 20], [width - 20, 20], [20, height - 20], [width - 20, height - 20]]) {
        ctx.beginPath();
        ctx.arc(rx, ry, 7, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.fillStyle = '#f8fafc';
      ctx.font = 'bold 31px "Segoe UI", Arial, monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(text, width / 2, height / 2 + 2);
    }
  }
  const tex = canvas && typeof THREE.CanvasTexture === 'function'
    ? new THREE.CanvasTexture(canvas)
    : new THREE.Texture();
  if ('SRGBColorSpace' in THREE && 'colorSpace' in tex) {
    tex.colorSpace = THREE.SRGBColorSpace;
  }
  tex.anisotropy = 4;
  tex.needsUpdate = true;
  tex.userData = { ...(tex.userData || {}), brandStencil: text };
  cachedTexture = tex;
  return cachedTexture;
}

export function getOrCreateBrandDecalMaterial(THREE) {
  if (cachedMaterial) return cachedMaterial;
  const map = getOrCreateBrandDecalTexture(THREE);
  cachedMaterial = new THREE.MeshStandardMaterial({
    map,
    roughness: 0.48,
    metalness: 0.3,
    polygonOffset: true,
    polygonOffsetFactor: -2,
    polygonOffsetUnits: -2
  });
  return cachedMaterial;
}

export function getSharedBrandPlaneGeometry(THREE) {
  if (!cachedGeometry) {
    cachedGeometry = new THREE.PlaneGeometry(1, 1);
  }
  return cachedGeometry;
}

function makeDecalPlate(THREE, { width, height, pos, rotY = 0, name = 'brand_decal_plate' }) {
  const mesh = new THREE.Mesh(getSharedBrandPlaneGeometry(THREE), getOrCreateBrandDecalMaterial(THREE));
  mesh.name = name;
  mesh.scale.set(width, height, 1);
  mesh.position.set(pos[0], pos[1], pos[2]);
  if (rotY !== 0) mesh.rotation.y = rotY;
  mesh.castShadow = false;
  mesh.receiveShadow = true;
  mesh.userData.isBrandDecal = true;
  return mesh;
}

export function clearBrandDecals(group) {
  if (!group || !Array.isArray(group.children)) return;
  for (let i = group.children.length - 1; i >= 0; i--) {
    if (group.children[i]?.userData?.isBrandDecal) {
      group.remove(group.children[i]);
    }
  }
}

export function stampHookBrandDecals(THREE, hookAssemblyGroup) {
  if (!THREE || !hookAssemblyGroup) return [];
  clearBrandDecals(hookAssemblyGroup);
  const decals = [
    makeDecalPlate(THREE, { width: 0.34, height: 0.056, pos: [0, 0.37, 0.07], rotY: 0, name: 'hook_brand_decal_front' }),
    makeDecalPlate(THREE, { width: 0.34, height: 0.056, pos: [0, 0.37, -0.07], rotY: Math.PI, name: 'hook_brand_decal_back' })
  ];
  decals.forEach((d) => hookAssemblyGroup.add(d));
  return decals;
}

export function stampCraneBrandDecals(THREE, craneVehicleGroup, dynamicParts, type) {
  if (!THREE || !craneVehicleGroup) return [];
  const targetParent = dynamicParts?.boomPivot || craneVehicleGroup;
  clearBrandDecals(targetParent);
  const decals = [];
  if (type === 'mobile_telescopic' || type === 'crawler') {
    const zOffset = type === 'crawler' ? 0.6 : 0.44;
    const xPos = 4.6;
    const yPos = 0.04;
    decals.push(
      makeDecalPlate(THREE, { width: 3.4, height: 0.52, pos: [xPos, yPos, zOffset], rotY: 0, name: 'crane_boom_brand_right' }),
      makeDecalPlate(THREE, { width: 3.4, height: 0.52, pos: [xPos, yPos, -zOffset], rotY: Math.PI, name: 'crane_boom_brand_left' })
    );
  } else if (type === 'gantry' || type === 'rtg' || type === 'sts_crane_glb') {
    decals.push(
      makeDecalPlate(THREE, { width: 4.2, height: 0.64, pos: [0, 21.8, 0.72], rotY: 0, name: 'gantry_girder_brand_front' }),
      makeDecalPlate(THREE, { width: 4.2, height: 0.64, pos: [0, 21.8, -0.72], rotY: Math.PI, name: 'gantry_girder_brand_back' })
    );
  } else {
    decals.push(
      makeDecalPlate(THREE, { width: 1.8, height: 0.28, pos: [0, 0.25, 0.26], rotY: 0, name: 'crane_overhead_brand' })
    );
  }
  decals.forEach((d) => targetParent.add(d));
  return decals;
}

export function stampSpreaderBrandDecals(THREE, spreaderRootGroup, beamType, spanX = 4) {
  if (!THREE || !spreaderRootGroup || beamType === 'none') return [];
  clearBrandDecals(spreaderRootGroup);
  const cleanSpan = Math.max(1.6, Number(spanX) || 4);
  const decalW = Math.min(3.6, Math.max(1.2, cleanSpan * 0.46));
  const decalH = decalW * 0.16;
  const zOffset = beamType === 'container_spreader' ? 1.26 : (beamType === 'frame' || beamType === 'h_beam' ? 0.24 : 0.22);
  const decals = [
    makeDecalPlate(THREE, { width: decalW, height: decalH, pos: [0, 0.02, zOffset], rotY: 0, name: 'spreader_brand_front' }),
    makeDecalPlate(THREE, { width: decalW, height: decalH, pos: [0, 0.02, -zOffset], rotY: Math.PI, name: 'spreader_brand_back' })
  ];
  decals.forEach((d) => spreaderRootGroup.add(d));
  return decals;
}

export function stampCargoBrandPlate(THREE, cargoRootGroup, dims = {}) {
  if (!THREE || !cargoRootGroup) return null;
  clearBrandDecals(cargoRootGroup);
  const L = Math.max(1, Number(dims.L) || 4);
  const W = Math.max(1, Number(dims.W) || 2);
  const H = Math.max(0.8, Number(dims.H) || 2);
  const plateW = Math.min(2.2, Math.max(0.85, L * 0.32));
  const plateH = plateW * 0.16;
  const decal = makeDecalPlate(THREE, {
    width: plateW,
    height: plateH,
    pos: [-L * 0.24, H * 0.5 - plateH * 0.9, W * 0.5 + 0.015],
    rotY: 0,
    name: 'cargo_brand_inspection_plate'
  });
  cargoRootGroup.add(decal);
  return decal;
}

export function __resetBrandDecalCacheForTests() {
  cachedTexture = null;
  cachedMaterial = null;
  cachedGeometry = null;
}
