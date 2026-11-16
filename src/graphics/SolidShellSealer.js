// @purpose: Bịt kín lõi/đáy rỗng và bật hai mặt vật liệu cho xe 3D và kiện hàng tránh nhìn xuyên
const CLOSED_BOX_CARGO_TYPES = new Set([
  'container', 'container_20ft_glb', 'iso20hc', 'iso40', 'container_40ft_glb',
  'iso40hc', 'iso45hc', 'container10', 'iso53hc', 'reefer', 'reefer20',
  'halfheight', 'drybulk', 'crate'
]);

const OPEN_DECK_TYPES = new Set(['flatrack', 'flatrack20', 'platform', 'platform20']);

function ensureSolidMaterials(THREE, root) {
  root.traverse((child) => {
    if (!child.isMesh || child.userData?.isCADEdge || child.userData?.isSolidSealCore) return;
    const mats = Array.isArray(child.material) ? child.material : [child.material];
    mats.forEach((m) => {
      if (!m) return;
      const matName = String(m.name || child.name || '').toLowerCase();
      if (matName.includes('glass') || matName.includes('window') || matName.includes('wind')) {
        // Opaque deep-tinted obsidian cabin glass: shiny reflection without exposing hollow interior
        if (m.color && m.color.setHex) m.color.setHex(0x0b1526);
        m.transparent = false;
        m.opacity = 1.0;
        m.depthWrite = true;
        if ('roughness' in m) m.roughness = 0.08;
        if ('metalness' in m) m.metalness = 0.86;
      } else {
        m.transparent = false;
        m.opacity = 1.0;
        m.depthWrite = true;
      }
      m.side = THREE.DoubleSide;
      m.needsUpdate = true;
    });
  });
}

function makeSealMesh(THREE, sx, sy, sz, yPos, mat, name = 'Solid_Seal_Core') {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(sx, sy, sz), mat);
  mesh.name = name;
  mesh.position.set(0, yPos, 0);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  mesh.userData = { noCADEdge: true, noLugWeld: true, isSolidSealCore: true };
  return mesh;
}

/**
 * Seals hollow interiors, thin undersides, and transparent windows across vehicles
 * and ISO/OOG cargo models so camera angles never see empty voids or the floor grid through geometry.
 */
export function sealSolidCargoShell(THREE, group, cargoType, dims = {}) {
  if (!group || !THREE) return group;
  ensureSolidMaterials(THREE, group);

  const alreadySealed = group.children.some((ch) => ch.userData?.isSolidSealCore);
  if (alreadySealed) return group;

  const L = Math.max(0.5, Number(dims.L) || 6.0);
  const W = Math.max(0.5, Number(dims.W) || 2.4);
  const H = Math.max(0.3, Number(dims.H) || 2.5);
  const sealMat = new THREE.MeshStandardMaterial({
    color: 0x0f172a,
    roughness: 0.88,
    metalness: 0.22,
    side: THREE.DoubleSide,
    name: 'Solid_Seal_Core_Mat'
  });

  if (cargoType === 'car') {
    const wheelClear = Math.min(0.42, H * 0.14);
    const bellyY = -H * 0.5 + wheelClear + 0.09;
    const belly = makeSealMesh(THREE, L * 0.88, 0.16, W * 0.84, bellyY, sealMat, 'Vehicle_Belly_Seal');
    const cabinH = Math.max(0.4, (H - wheelClear) * 0.68);
    const cabinY = bellyY + cabinH * 0.5 + 0.04;
    const cabinCore = makeSealMesh(THREE, L * 0.86, cabinH, W * 0.82, cabinY, sealMat, 'Vehicle_Cabin_Seal');
    group.add(belly, cabinCore);
    return group;
  }

  const isOpenTop = cargoType === 'opentop' || cargoType === 'opentop40';
  if (CLOSED_BOX_CARGO_TYPES.has(cargoType) || (isOpenTop && dims.oogTarp !== false)) {
    const core = makeSealMesh(
      THREE,
      Math.max(0.25, L - 0.16),
      Math.max(0.25, H - 0.16),
      Math.max(0.25, W - 0.16),
      0,
      sealMat
    );
    group.add(core);
    return group;
  }

  if (isOpenTop || OPEN_DECK_TYPES.has(cargoType)) {
    const deckH = Math.min(0.14, H * 0.18);
    const deckY = -H * 0.5 + deckH * 0.5 + 0.02;
    const floorSeal = makeSealMesh(
      THREE,
      Math.max(0.3, L - 0.16),
      deckH,
      Math.max(0.3, W - 0.14),
      deckY,
      sealMat,
      'Cargo_Deck_Seal'
    );
    group.add(floorSeal);
  }

  return group;
}
