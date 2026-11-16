// @purpose: Dựng khối 3D ống thép siêu trường Steel Pipe (OOG) và xe buýt procedural đồng bộ CAD
function pickMat(THREE, mats, key, fallbackOpts) {
  if (mats && mats[key]) return mats[key];
  return new THREE.MeshStandardMaterial(fallbackOpts);
}

/**
 * Builds an industrial out-of-gauge (OOG) steel pipe bundle/pipeline with
 * end weld flanges, painted lifting bands, top pad-eyes, and anti-roll cradle skids.
 */
export function buildSteelPipeCargoMesh(THREE, L = 12.0, W = 2.2, H = 2.2, mats = {}) {
  const group = new THREE.Group();
  group.name = 'Steel_Pipe_OOG';
  const radius = Math.max(0.28, Math.min(H, W) * 0.39);
  const cradleH = Math.max(0.16, H - radius * 2);
  const pipeCenterY = -H * 0.5 + cradleH + radius;

  const steelMat = pickMat(THREE, mats, 'vesselSteel', { color: 0x64748b, roughness: 0.42, metalness: 0.78 });
  const boreMat = pickMat(THREE, mats, 'darkSteel', { color: 0x1e293b, roughness: 0.55, metalness: 0.7 });
  const bandMat = pickMat(THREE, mats, 'yellowHazard', { color: 0xf59e0b, roughness: 0.38, metalness: 0.25 });
  const timberMat = pickMat(THREE, mats, 'timber', { color: 0x78552b, roughness: 0.85, metalness: 0.05 });

  // Main cylindrical steel shell along X axis
  const shell = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, L, 36, 1, false), steelMat);
  shell.rotation.z = Math.PI / 2;
  shell.position.y = pipeCenterY;
  shell.castShadow = true;
  shell.receiveShadow = true;
  group.add(shell);

  // Dark inner bore caps at both ends to show hollow thick-wall pipe
  const bore = new THREE.Mesh(new THREE.CylinderGeometry(radius * 0.84, radius * 0.84, L + 0.012, 28), boreMat);
  bore.rotation.z = Math.PI / 2;
  bore.position.y = pipeCenterY;
  group.add(bore);

  // End weld neck flanges + painted rigging saddle collars
  const collarPositions = [-L * 0.485, -L * 0.30, L * 0.30, L * 0.485];
  collarPositions.forEach((cx, idx) => {
    const isEndFlange = idx === 0 || idx === 3;
    const collarR = isEndFlange ? radius * 1.07 : radius * 1.025;
    const collarW = isEndFlange ? 0.14 : 0.22;
    const collar = new THREE.Mesh(
      new THREE.CylinderGeometry(collarR, collarR, collarW, 32),
      isEndFlange ? boreMat : bandMat
    );
    collar.rotation.z = Math.PI / 2;
    collar.position.set(cx, pipeCenterY, 0);
    collar.castShadow = true;
    group.add(collar);
  });

  // Top welded lifting pad-eye ribs near sling collars (±0.30 L)
  [-L * 0.30, L * 0.30].forEach((lx) => {
    [-radius * 0.48, radius * 0.48].forEach((lz) => {
      const lug = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.18, 0.06), bandMat);
      lug.position.set(lx, pipeCenterY + radius * 0.92, lz);
      lug.castShadow = true;
      group.add(lug);
    });
  });

  // Two heavy timber + steel saddle cradles keeping pipe stable on quay
  [-L * 0.26, L * 0.26].forEach((sx) => {
    const baseBeam = new THREE.Mesh(new THREE.BoxGeometry(0.32, cradleH * 0.85, W * 0.92), boreMat);
    baseBeam.position.set(sx, -H * 0.5 + cradleH * 0.425, 0);
    baseBeam.castShadow = true;
    baseBeam.receiveShadow = true;
    group.add(baseBeam);

    [-W * 0.28, W * 0.28].forEach((cz) => {
      const chock = new THREE.Mesh(new THREE.BoxGeometry(0.28, cradleH * 1.25, 0.22), timberMat);
      chock.position.set(sx, -H * 0.5 + cradleH * 0.85, cz);
      chock.rotation.x = cz < 0 ? 0.35 : -0.35;
      chock.castShadow = true;
      group.add(chock);
    });
  });

  return group;
}

/**
 * Builds a coach bus proxy matching `bus.obj` scale and teal-green palette so
 * selecting Vehicle never flips from a small red sedan to a large teal coach bus.
 */
export function buildProceduralCoachBusMesh(THREE, L = 9.0, W = 2.38, H = 2.80, mats = {}) {
  const group = new THREE.Group();
  group.name = 'Vehicle_Coach_Bus';
  const bodyMat = new THREE.MeshStandardMaterial({ color: 0x2c8c8a, roughness: 0.42, metalness: 0.22 });
  const roofMat = new THREE.MeshStandardMaterial({ color: 0xdbeafe, roughness: 0.5, metalness: 0.1 });
  const glassMat = pickMat(THREE, mats, 'glassDark', { color: 0x0f172a, roughness: 0.15, metalness: 0.7 });
  const tireMat = pickMat(THREE, mats, 'rubberTire', { color: 0x18181b, roughness: 0.88, metalness: 0.05 });
  const rimMat = pickMat(THREE, mats, 'darkSteel', { color: 0xcbd5e1, roughness: 0.3, metalness: 0.8 });

  const wheelR = Math.min(0.46, H * 0.165);
  const bodyH = H - wheelR * 0.72;
  const bodyY = -H * 0.5 + wheelR * 0.72 + bodyH * 0.5;

  // Lower skirt & main coach body
  const hull = new THREE.Mesh(new THREE.BoxGeometry(L * 0.98, bodyH, W * 0.98), bodyMat);
  hull.position.set(0, bodyY, 0);
  hull.castShadow = true;
  hull.receiveShadow = true;
  group.add(hull);

  // Side & front panoramic window belt
  const sideGlass = new THREE.Mesh(new THREE.BoxGeometry(L * 0.90, bodyH * 0.34, W + 0.015), glassMat);
  sideGlass.position.set(L * 0.01, bodyY + bodyH * 0.16, 0);
  group.add(sideGlass);

  const windshield = new THREE.Mesh(new THREE.BoxGeometry(0.06, bodyH * 0.42, W * 0.88), glassMat);
  windshield.position.set(L * 0.49, bodyY + bodyH * 0.14, 0);
  group.add(windshield);

  // Roof HVAC unit
  const hvac = new THREE.Mesh(new THREE.BoxGeometry(L * 0.28, 0.14, W * 0.56), roofMat);
  hvac.position.set(0, H * 0.5 - 0.05, 0);
  hvac.castShadow = true;
  group.add(hvac);

  // 4 dual coach wheels
  const wheelW = 0.28;
  [-L * 0.30, L * 0.31].forEach((wx) => {
    [-W * 0.46, W * 0.46].forEach((wz) => {
      const tire = new THREE.Mesh(new THREE.CylinderGeometry(wheelR, wheelR, wheelW, 20), tireMat);
      tire.rotation.x = Math.PI / 2;
      tire.position.set(wx, -H * 0.5 + wheelR, wz);
      tire.castShadow = true;
      group.add(tire);

      const hub = new THREE.Mesh(new THREE.CylinderGeometry(wheelR * 0.55, wheelR * 0.55, wheelW + 0.015, 14), rimMat);
      hub.rotation.x = Math.PI / 2;
      hub.position.copy(tire.position);
      group.add(hub);
    });
  });

  return group;
}
