// @purpose: Cấu tạo 3D và thông số khớp nối H-Style Lifting Beam (tùy chọn trên Direct Hook/2-Cáp và dưới 4-Cáp/Twistlock)
import * as THREE from 'three';

const _euler = new THREE.Euler(0, 0, 0, 'YXZ');

/** Tính tọa độ 4 góc chữ H `(±halfX, ±halfZ)` và phủ bì cho chế độ cáp hoặc gắp container trực tiếp. */
export function resolveHBeamCorners(spanX, spanZ, cargoDims, bottomMode = 'cable') {
  const L = Math.max(1.2, cargoDims?.L || 6.058);
  const W = Math.max(0.8, cargoDims?.W || 2.438);
  if (bottomMode === 'direct') {
    const pitchX = L >= 13.0 ? 13.557 : (L >= 9.0 ? 11.985 : (L >= 4.5 ? 5.853 : Math.max(0.8, L - 0.207)));
    const pitchZ = Math.abs(W - 2.438) < 0.12 ? 2.259 : Math.max(0.6, W - 0.179);
    const halfX = pitchX * 0.5;
    const halfZ = pitchZ * 0.5;
    return {
      halfX,
      halfZ,
      spanX: pitchX,
      spanZ: pitchZ,
      outerX: Math.max(L, pitchX + 0.22),
      outerZ: Math.max(W, pitchZ + 0.20),
      corners: [[halfX, halfZ, 0], [-halfX, halfZ, 1], [-halfX, -halfZ, 2], [halfX, -halfZ, 3]]
    };
  }
  const safeSpanX = Math.max(0.8, spanX || L - 0.24);
  const safeSpanZ = Math.max(0.6, spanZ || W - 0.22);
  const halfX = safeSpanX * 0.5;
  const halfZ = safeSpanZ * 0.5;
  return {
    halfX,
    halfZ,
    spanX: safeSpanX,
    spanZ: safeSpanZ,
    outerX: safeSpanX + 0.28,
    outerZ: safeSpanZ + 0.26,
    corners: [[halfX, halfZ, 0], [-halfX, halfZ, 1], [-halfX, -halfZ, 2], [halfX, -halfZ, 3]]
  };
}

/** Dựng hình học 3D H-Style Lifting Beam (dầm chính + 2 thanh ngang 4 góc + tai giữa + phụ kiện). */
export function buildHStyleLiftingBeamMeshes({
  group, yellowMat, darkMat, spanX, spanZ, cargoDims,
  topMode = 'bridle2', bottomMode = 'cable',
  tagMesh, addLug, addPick, addShackle, addTwistlockFeet
}) {
  const layout = resolveHBeamCorners(spanX, spanZ, cargoDims, bottomMode);
  const { halfX, halfZ, outerX, outerZ, corners } = layout;
  const matYellow = yellowMat || new THREE.MeshStandardMaterial({ color: 0xeab308, metalness: 0.45, roughness: 0.35 });
  const matDark = darkMat || new THREE.MeshStandardMaterial({ color: 0x1e293b, metalness: 0.65, roughness: 0.4 });
  const attach = (mesh, isMainYellow = true) => {
    if (isMainYellow && typeof tagMesh === 'function') {
      tagMesh(mesh, 'main');
      return;
    }
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.userData.gearKind = 'member';
    mesh.userData.memberId = 'main';
    mesh.userData.memberBody = true;
    if (group) group.add(mesh);
  };

  // 1. Dầm chính H-section dọc trục X (32 đoạn chia để uốn đồng bộ, không lòi gân đen)
  const web = new THREE.Mesh(new THREE.BoxGeometry(outerX, 0.274, 0.028, 32, 1, 1), matYellow);
  const topF = new THREE.Mesh(new THREE.BoxGeometry(outerX, 0.036, 0.24, 32, 1, 1), matYellow);
  topF.position.y = 0.155;
  const botF = new THREE.Mesh(new THREE.BoxGeometry(outerX, 0.036, 0.24, 32, 1, 1), matYellow);
  botF.position.y = -0.155;
  attach(web, true);
  attach(topF, true);
  attach(botF, true);

  const ribs = Math.max(4, Math.round(outerX / 0.75));
  for (let r = 0; r < ribs; r++) {
    const rx = -outerX * 0.45 + (r + 0.5) * ((outerX * 0.9) / ribs);
    if (Math.abs(rx) > halfX - 0.14) continue;
    [-0.068, 0.068].forEach((rz) => {
      const rib = new THREE.Mesh(new THREE.BoxGeometry(0.016, 0.244, 0.064), matDark);
      rib.position.set(rx, 0, rz);
      attach(rib, false);
    });
  }

  // 2. Hai thanh ngang vuông góc tại 2 đầu (±halfX) tạo khung chữ H với 4 góc bắt tải
  [halfX, -halfX].forEach((cx) => {
    const crossWeb = new THREE.Mesh(new THREE.BoxGeometry(0.028, 0.256, outerZ), matYellow);
    crossWeb.position.set(cx, -0.02, 0);
    const crossTop = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.032, outerZ), matYellow);
    crossTop.position.set(cx, 0.124, 0);
    const crossBot = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.032, outerZ), matYellow);
    crossBot.position.set(cx, -0.164, 0);
    attach(crossWeb, true);
    attach(crossTop, true);
    attach(crossBot, true);

    [-1, 1].forEach((sz) => {
      const cap = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.32, 0.022), matDark);
      cap.position.set(cx, -0.02, sz * (outerZ * 0.5));
      attach(cap, false);
    });
  });

  // 3. Tai treo trung tâm (Bail Eye tại 0, +0.28, 0) chuẩn Hình 1 & 2 cho móc cẩu trực tiếp
  const bailGroup = new THREE.Group();
  const lugSide = new THREE.BoxGeometry(0.32, 0.18, 0.036);
  [-0.06, 0.06].forEach((oz) => {
    const cheek = new THREE.Mesh(lugSide, matYellow);
    cheek.position.set(0, 0.25, oz);
    bailGroup.add(cheek);
  });
  const arch = new THREE.Mesh(new THREE.TorusGeometry(0.11, 0.032, 10, 20, Math.PI), matYellow);
  arch.position.set(0, 0.27, 0);
  const pin = new THREE.Mesh(new THREE.CylinderGeometry(0.026, 0.026, 0.18, 12), matDark);
  pin.rotation.x = Math.PI / 2;
  pin.position.set(0, 0.30, 0);
  bailGroup.add(arch, pin);
  bailGroup.traverse((o) => {
    if (!o.isMesh) return;
    o.castShadow = true;
    o.userData.gearKind = 'member';
    o.userData.memberId = 'main';
    o.userData.memberBody = true;
  });
  if (group) group.add(bailGroup);

  // 4. Tai treo phía trên & 4 góc phía dưới
  if (topMode === 'bridle2') {
    [halfX, -halfX].forEach((lx, idx) => {
      if (addLug) addLug(lx, 0.24, 0, 'main', false);
      if (addShackle) addShackle(lx, 0.24, 0, 'main', { role: 'upper', index: idx === 0 ? 1 : 0 });
    });
  } else if (addPick) {
    addPick(0, 0.30, 0, 'main');
  }

  corners.forEach(([cx, cz, idx]) => {
    if (addPick) addPick(cx, 0, cz, 'main');
    if (bottomMode === 'cable') {
      if (addLug) addLug(cx, -0.22, cz, 'main', true);
      if (addShackle) addShackle(cx, -0.22, cz, 'main', { role: 'leg', index: idx });
    }
  });

  if (bottomMode === 'direct' && typeof addTwistlockFeet === 'function') {
    addTwistlockFeet(group, halfX, halfZ, -0.22, false);
  }
  return layout;
}

/**
 * Giải vị trí móc trực tiếp vào tai giữa dầm (`direct_hook`) và/hoặc 4 chốt Twistlock góc dưới (`direct`).
 */
export function solveHBeamDirectCoupling({
  beamPos, beamQuat, hookPos, cargoPos, cargoDims, cogOffset, yawRad = 0,
  floorY = 0, topMode = 'bridle2', bottomMode = 'cable', masterOffsetY = -0.56
} = {}) {
  const H = Math.max(0.5, cargoDims?.H || 2.591);
  const L = Math.max(1.2, cargoDims?.L || 6.058);
  const W = Math.max(0.8, cargoDims?.W || 2.438);
  const tipPad = 0.34;
  const minBeamY = floorY + H + tipPad;
  const centerFloorY = floorY + H * 0.5;
  let nextBeamY = beamPos ? beamPos.y : minBeamY;

  if (topMode === 'direct_hook' && hookPos) {
    const masterY = hookPos.y + masterOffsetY;
    nextBeamY = Math.max(bottomMode === 'direct' ? minBeamY : 0.35, masterY - 0.30);
  }

  let cargoY = cargoPos ? cargoPos.y : centerFloorY;
  let clearance = Math.max(0, cargoY - centerFloorY);
  let quat = beamQuat ? beamQuat.clone() : new THREE.Quaternion();
  let seatedOnDeck = false;

  if (bottomMode === 'direct') {
    nextBeamY = Math.max(minBeamY, nextBeamY);
    cargoY = Math.max(centerFloorY, nextBeamY - tipPad - H * 0.5);
    clearance = Math.max(0, cargoY - centerFloorY);
    seatedOnDeck = clearance <= 0.02;
    const airFactor = THREE.MathUtils.clamp((clearance - 0.02) / 0.12, 0, 1);
    const pitch = airFactor * THREE.MathUtils.clamp(-((cogOffset?.x || 0) / (L * 0.45)) * 0.055, -0.15, 0.15);
    const roll = airFactor * THREE.MathUtils.clamp(((cogOffset?.z || 0) / (W * 0.45)) * 0.045, -0.14, 0.14);
    _euler.set(roll, yawRad, pitch, 'YXZ');
    quat = new THREE.Quaternion().setFromEuler(_euler);
  }

  return { nextBeamY, cargoY, clearance, quat, seatedOnDeck };
}
