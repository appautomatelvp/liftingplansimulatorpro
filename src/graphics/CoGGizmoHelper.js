// @purpose: Tay cầm kéo thả 3 trục X/Y/Z cho Gizmo Trọng Tâm (CoG), auto X-Ray và logic kéo màn hình / giữ Shift chỉnh độ sâu theo camera

function createAxisBadgeSprite(THREE, letter, hexStr) {
  if (typeof document === 'undefined' || !THREE?.SpriteMaterial || !THREE?.CanvasTexture) return null;
  const cvs = document.createElement('canvas');
  cvs.width = 64;
  cvs.height = 64;
  const ctx = cvs.getContext('2d');
  if (!ctx) return null;
  ctx.clearRect(0, 0, 64, 64);
  ctx.fillStyle = 'rgba(15, 23, 42, 0.88)';
  ctx.beginPath();
  ctx.arc(32, 32, 24, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = hexStr;
  ctx.lineWidth = 4;
  ctx.stroke();
  ctx.fillStyle = hexStr;
  ctx.font = 'bold 30px Inter, system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(letter, 32, 33);
  const tex = new THREE.CanvasTexture(cvs);
  if (THREE.SRGBColorSpace) tex.colorSpace = THREE.SRGBColorSpace;
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, depthTest: false, depthWrite: false, transparent: true }));
  sprite.scale.set(0.36, 0.36, 1);
  sprite.renderOrder = 1000;
  return sprite;
}

/**
 * Builds interactive 3D X/Y/Z axis coordinate bars (+X red, +Y green, +Z blue)
 * plus negative guide rails and enlarged invisible hit proxies for internal CoG picking.
 */
export function createCoGAxisHandles(THREE) {
  const handles = new THREE.Group();
  handles.name = 'CoG_Axis_Handles';

  const hitProxy = new THREE.Mesh(
    new THREE.SphereGeometry(0.48, 12, 12),
    new THREE.MeshBasicMaterial({ transparent: true, opacity: 0.0, depthTest: false, depthWrite: false })
  );
  hitProxy.name = 'CoG_Hit_Proxy';
  hitProxy.renderOrder = 999;
  hitProxy.userData = { dragType: 'cog', cogAxis: 'free' };
  handles.add(hitProxy);

  const specs = [
    { axis: 'x', label: 'X', hex: '#f87171', color: 0xef4444, rot: [0, 0, -Math.PI / 2], pos: [0.85, 0, 0], negPos: [-0.85, 0, 0], conePos: [1.48, 0, 0], badgePos: [1.82, 0, 0] },
    { axis: 'y', label: 'Y', hex: '#4ade80', color: 0x22c55e, rot: [0, 0, 0], pos: [0, 0.85, 0], negPos: [0, -0.85, 0], conePos: [0, 1.48, 0], badgePos: [0, 1.82, 0] },
    { axis: 'z', label: 'Z', hex: '#60a5fa', color: 0x3b82f6, rot: [Math.PI / 2, 0, 0], pos: [0, 0, 0.85], negPos: [0, 0, -0.85], conePos: [0, 0, 1.48], badgePos: [0, 0, 1.82] }
  ];

  const shaftGeo = new THREE.CylinderGeometry(0.032, 0.032, 1.28, 10);
  const negBarGeo = new THREE.CylinderGeometry(0.014, 0.014, 1.35, 8);
  const coneGeo = new THREE.ConeGeometry(0.115, 0.30, 12);
  const hitCylGeo = new THREE.CylinderGeometry(0.16, 0.16, 1.75, 8);
  const hitCylMat = new THREE.MeshBasicMaterial({ transparent: true, opacity: 0.0, depthTest: false, depthWrite: false });

  for (const sp of specs) {
    const mat = new THREE.MeshBasicMaterial({ color: sp.color, depthTest: false, depthWrite: false });
    const negMat = new THREE.MeshBasicMaterial({ color: sp.color, transparent: true, opacity: 0.45, depthTest: false, depthWrite: false });

    const shaft = new THREE.Mesh(shaftGeo, mat);
    shaft.rotation.set(...sp.rot);
    shaft.position.set(...sp.pos);
    shaft.renderOrder = 999;
    shaft.userData = { dragType: 'cog', cogAxis: sp.axis };

    const negBar = new THREE.Mesh(negBarGeo, negMat);
    negBar.rotation.set(...sp.rot);
    negBar.position.set(...sp.negPos);
    negBar.renderOrder = 998;
    negBar.userData = { dragType: 'cog', cogAxis: sp.axis };

    const cone = new THREE.Mesh(coneGeo, mat);
    cone.rotation.set(...sp.rot);
    cone.position.set(...sp.conePos);
    cone.renderOrder = 999;
    cone.userData = { dragType: 'cog', cogAxis: sp.axis };

    const hitCyl = new THREE.Mesh(hitCylGeo, hitCylMat);
    hitCyl.rotation.set(...sp.rot);
    hitCyl.position.set(...sp.pos);
    hitCyl.renderOrder = 999;
    hitCyl.userData = { dragType: 'cog', cogAxis: sp.axis };

    handles.add(shaft, negBar, cone, hitCyl);

    const badge = createAxisBadgeSprite(THREE, sp.label, sp.hex);
    if (badge) {
      badge.position.set(...sp.badgePos);
      badge.userData = { dragType: 'cog', cogAxis: sp.axis };
      handles.add(badge);
    }
  }
  return handles;
}

/**
 * Builds an intuitive camera-consistent drag plane for CoG adjustment:
 * - Default free drag (`shiftDepth = false`): vertical screen-aligned billboard plane
 *   (horiz camera forward normal) so dragging UP/DOWN adjusts pure elevation Y without
 *   depth drift, and LEFT/RIGHT moves laterally across camera view.
 * - Shift depth drag (`shiftDepth = true`): horizontal depth plane (normal = +Y, or
 *   tilted 45° fallback at near-horizon camera pitches so rays never graze to infinity).
 * - Axis handle drag (`'x'|'y'|'z'`): 1D axis lock aligned to view ray.
 */
export function buildCogDragPlane({ THREE, axis = 'free', worldCoG, cameraDir, cargoQuat, shiftDepth = false }) {
  const cam = (cameraDir && cameraDir.lengthSq() > 1e-6)
    ? cameraDir.clone().normalize()
    : new THREE.Vector3(0, -0.35, -0.94).normalize();
  const normal = new THREE.Vector3(0, 0, 1);

  if (axis === 'free' || !cargoQuat) {
    if (shiftDepth) {
      const horizLen = Math.hypot(cam.x, cam.z);
      if (Math.abs(cam.y) >= 0.22 || horizLen < 1e-4) {
        normal.set(0, 1, 0);
      } else {
        // Near eye-level horizon: tilt plane 45 deg toward viewer so upward pointer moves push cleanly in depth
        const horizX = cam.x / horizLen;
        const horizZ = cam.z / horizLen;
        normal.set(-horizX * 0.5, 0.866, -horizZ * 0.5).normalize();
      }
      return new THREE.Plane().setFromNormalAndCoplanarPoint(normal, worldCoG);
    }

    // Default screen up/down + lateral drag: vertical billboard plane (zero unintended depth drift)
    if (Math.abs(cam.y) <= 0.90 && Math.hypot(cam.x, cam.z) > 1e-4) {
      normal.set(cam.x, 0, cam.z).normalize();
    } else {
      normal.copy(cam);
    }
    return new THREE.Plane().setFromNormalAndCoplanarPoint(normal, worldCoG);
  }

  const axisWorld = new THREE.Vector3(axis === 'x' ? 1 : 0, axis === 'y' ? 1 : 0, axis === 'z' ? 1 : 0)
    .applyQuaternion(cargoQuat)
    .normalize();
  const side = new THREE.Vector3().crossVectors(axisWorld, cam);
  if (side.lengthSq() < 1e-6) {
    normal.set(axis === 'y' ? 1 : 0, axis === 'y' ? 0 : 1, 0);
  } else {
    normal.crossVectors(side, axisWorld).normalize();
  }
  return new THREE.Plane().setFromNormalAndCoplanarPoint(normal, worldCoG);
}

/**
 * Projects ray intersection into cargo-local coordinates and updates state.cogX/Y/Z.
 * When `shiftDepth` is true during free drag, locks vertical height (`worldDelta.y = 0`)
 * so mouse motion adjusts camera-logical horizontal depth & lateral position smoothly.
 */
export function applyCogDragDelta({
  THREE,
  ray,
  dragPlane,
  axis = 'free',
  startWorld,
  startCog = { x: 0, y: 0, z: 0 },
  cargoRootGroup,
  state,
  shiftDepth = false
}) {
  if (!ray || !dragPlane || !state) return null;
  const hitWorld = new THREE.Vector3();
  if (!ray.intersectPlane(dragPlane, hitWorld)) return null;

  const anchorWorld = startWorld ? startWorld.clone() : hitWorld.clone();
  const worldDelta = hitWorld.clone().sub(anchorWorld);
  if (axis === 'free' && shiftDepth) {
    worldDelta.y = 0; // Shift = strict horizontal depth (XZ), preserve current CoG height
  }

  const clampedTargetWorld = anchorWorld.clone().add(worldDelta);
  const toLocal = (pt) => (cargoRootGroup && typeof cargoRootGroup.worldToLocal === 'function'
    ? cargoRootGroup.worldToLocal(pt.clone())
    : pt.clone());

  const localNow = toLocal(clampedTargetWorld);
  const localStart = toLocal(anchorWorld);
  const delta = localNow.sub(localStart);

  const L = Math.max(0.5, Number(state.L) || 6);
  const H = Math.max(0.5, Number(state.H) || 2.5);
  const W = Math.max(0.5, Number(state.W) || 2.4);
  const clamp = (v, lim) => Math.max(-lim, Math.min(lim, v));

  if (axis === 'x' || axis === 'free') state.cogX = clamp((Number(startCog.x) || 0) + delta.x, L * 0.45);
  if (axis === 'y' || (axis === 'free' && !shiftDepth)) state.cogY = clamp((Number(startCog.y) || 0) + delta.y, H * 0.45);
  if (axis === 'z' || axis === 'free') state.cogZ = clamp((Number(startCog.z) || 0) + delta.z, W * 0.45);

  return { cogX: state.cogX, cogY: state.cogY, cogZ: state.cogZ };
}

/**
 * Transitions a live CoG drag session cleanly between Screen Up/Down and Shift Depth modes
 * by re-anchoring `startWorld` and `startCog` at the current CoG location without jumping.
 */
export function syncCogDragShiftMode({
  THREE,
  dragTarget,
  dragPlane,
  ray,
  camera,
  cargoRootGroup,
  cargoQuat,
  state,
  shiftPressed
}) {
  if (!dragTarget || dragTarget.type !== 'cog') return false;
  const nextShift = Boolean(shiftPressed) && (dragTarget.axis || 'free') === 'free';
  if (nextShift === Boolean(dragTarget.shiftDepth)) return false;

  const worldCoG = new THREE.Vector3(state.cogX || 0, state.cogY || 0, state.cogZ || 0);
  if (cargoRootGroup && typeof cargoRootGroup.localToWorld === 'function') {
    cargoRootGroup.localToWorld(worldCoG);
  }
  const cameraDir = new THREE.Vector3();
  if (camera && typeof camera.getWorldDirection === 'function') camera.getWorldDirection(cameraDir);
  else cameraDir.set(0, -0.35, -0.94);

  const nextPlane = buildCogDragPlane({
    THREE, axis: dragTarget.axis || 'free', worldCoG, cameraDir, cargoQuat, shiftDepth: nextShift
  });
  dragPlane.copy(nextPlane);

  const newAnchor = new THREE.Vector3();
  if (!ray || !ray.intersectPlane(dragPlane, newAnchor)) {
    newAnchor.copy(worldCoG);
  }
  dragTarget.startWorld = newAnchor;
  dragTarget.startCog = { x: state.cogX || 0, y: state.cogY || 0, z: state.cogZ || 0 };
  dragTarget.shiftDepth = nextShift;
  state._cogDragMode = nextShift ? 'depth' : 'screen';
  return true;
}
