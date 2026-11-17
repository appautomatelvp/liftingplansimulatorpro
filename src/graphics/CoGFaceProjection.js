// @purpose: Tạo và cập nhật 6 dấu cắt chữ thập của Trọng Tâm (CoG) chiếu lên 6 mặt ngoài kiện hàng theo thời gian thực

function makeFaceMarker(THREE, colorHex, rot) {
  const g = new THREE.Group();
  const mat = new THREE.MeshBasicMaterial({
    color: colorHex,
    transparent: true,
    opacity: 0.85,
    side: THREE.DoubleSide,
    depthTest: false,
    depthWrite: false
  });
  const ring = new THREE.Mesh(new THREE.RingGeometry(0.11, 0.165, 24), mat);
  ring.renderOrder = 999;
  const barH = new THREE.Mesh(new THREE.PlaneGeometry(0.46, 0.022), mat);
  barH.renderOrder = 999;
  const barV = new THREE.Mesh(new THREE.PlaneGeometry(0.022, 0.46), mat);
  barV.renderOrder = 999;
  const dot = new THREE.Mesh(new THREE.CircleGeometry(0.048, 16), mat);
  dot.renderOrder = 1000;
  g.add(ring, barH, barV, dot);
  g.rotation.set(rot[0], rot[1], rot[2]);
  g.userData.markerMat = mat;
  return g;
}

function makeLaserBeam(THREE, colorHex, rot) {
  const mat = new THREE.MeshBasicMaterial({
    color: colorHex,
    transparent: true,
    opacity: 0.55,
    depthTest: false,
    depthWrite: false
  });
  const mesh = new THREE.Mesh(new THREE.CylinderGeometry(0.011, 0.011, 1.0, 8), mat);
  mesh.rotation.set(rot[0], rot[1], rot[2]);
  mesh.renderOrder = 997;
  mesh.userData.beamMat = mat;
  return mesh;
}

/**
 * Builds the 6 surface intersection crosshairs (+X/-X red, +Y/-Y green, +Z/-Z blue)
 * and 3 orthogonal laser projection bars spanning from CoG to cargo faces.
 */
export function createCogFaceProjectionGroup(THREE) {
  const root = new THREE.Group();
  root.name = 'CoG_Face_Projections';

  const faces = {
    px: makeFaceMarker(THREE, 0xef4444, [0, Math.PI / 2, 0]),
    nx: makeFaceMarker(THREE, 0xef4444, [0, -Math.PI / 2, 0]),
    py: makeFaceMarker(THREE, 0x22c55e, [-Math.PI / 2, 0, 0]),
    ny: makeFaceMarker(THREE, 0x22c55e, [Math.PI / 2, 0, 0]),
    pz: makeFaceMarker(THREE, 0x3b82f6, [0, 0, 0]),
    nz: makeFaceMarker(THREE, 0x3b82f6, [0, Math.PI, 0])
  };
  const beams = {
    x: makeLaserBeam(THREE, 0xef4444, [0, 0, -Math.PI / 2]),
    y: makeLaserBeam(THREE, 0x22c55e, [0, 0, 0]),
    z: makeLaserBeam(THREE, 0x3b82f6, [Math.PI / 2, 0, 0])
  };

  Object.values(faces).forEach((f) => root.add(f));
  Object.values(beams).forEach((b) => root.add(b));
  root.userData.faces = faces;
  root.userData.beams = beams;
  return root;
}

/**
 * Updates face crosshair positions & laser sightlines inside `cogIndicatorGroup`
 * so the 6 face intersection marks stay pinned to the cargo's outer skin cleanly.
 */
export function updateCogFaceProjections(cogIndicatorGroup, { L = 6, W = 2.4, H = 2.5, cogX = 0, cogY = 0, cogZ = 0, activeDrag = false } = {}) {
  if (!cogIndicatorGroup) return;
  const proj = cogIndicatorGroup.getObjectByName('CoG_Face_Projections');
  if (!proj || !proj.userData?.faces || !proj.userData?.beams) return;

  const pad = 0.025;
  const hx = Math.max(0.25, Number(L) || 6) * 0.5;
  const hy = Math.max(0.25, Number(H) || 2.5) * 0.5;
  const hz = Math.max(0.25, Number(W) || 2.4) * 0.5;
  const cx = Number(cogX) || 0;
  const cy = Number(cogY) || 0;
  const cz = Number(cogZ) || 0;

  const posX = hx - cx + pad;
  const negX = -hx - cx - pad;
  const posY = hy - cy + pad;
  const negY = -hy - cy - pad;
  const posZ = hz - cz + pad;
  const negZ = -hz - cz - pad;

  const { faces, beams } = proj.userData;
  faces.px.position.set(posX, 0, 0);
  faces.nx.position.set(negX, 0, 0);
  faces.py.position.set(0, posY, 0);
  faces.ny.position.set(0, negY, 0);
  faces.pz.position.set(0, 0, posZ);
  faces.nz.position.set(0, 0, negZ);

  const markerScale = activeDrag ? 1.18 : 0.92;
  const markerOpacity = activeDrag ? 0.96 : 0.78;
  Object.values(faces).forEach((f) => {
    f.scale.setScalar(markerScale);
    if (f.userData.markerMat) f.userData.markerMat.opacity = markerOpacity;
  });

  const spanX = Math.max(0.05, posX - negX);
  beams.x.scale.set(1, spanX, 1);
  beams.x.position.set((posX + negX) * 0.5, 0, 0);

  const spanY = Math.max(0.05, posY - negY);
  beams.y.scale.set(1, spanY, 1);
  beams.y.position.set(0, (posY + negY) * 0.5, 0);

  const spanZ = Math.max(0.05, posZ - negZ);
  beams.z.scale.set(1, spanZ, 1);
  beams.z.position.set(0, 0, (posZ + negZ) * 0.5);

  const beamOpacity = activeDrag ? 0.85 : 0.42;
  Object.values(beams).forEach((b) => {
    if (b.userData.beamMat) b.userData.beamMat.opacity = beamOpacity;
  });
}
