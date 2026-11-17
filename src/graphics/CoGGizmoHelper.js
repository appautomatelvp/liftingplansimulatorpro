// @purpose: Tay cầm kéo thả 3 trục X/Y/Z cho Gizmo Trọng Tâm (CoG) và hàm chiếu tọa độ kẹp biên theo kiện hàng

/**
 * Builds interactive 3D axis handles (+X red, +Y green, +Z blue) plus an enlarged
 * invisible hit proxy so users can grab the CoG gizmo even through solid cargo walls.
 */
export function createCoGAxisHandles(THREE) {
  const handles = new THREE.Group();
  handles.name = 'CoG_Axis_Handles';

  const hitProxy = new THREE.Mesh(
    new THREE.SphereGeometry(0.46, 12, 12),
    new THREE.MeshBasicMaterial({ transparent: true, opacity: 0.0, depthTest: false, depthWrite: false })
  );
  hitProxy.name = 'CoG_Hit_Proxy';
  hitProxy.renderOrder = 999;
  hitProxy.userData = { dragType: 'cog', cogAxis: 'free' };
  handles.add(hitProxy);

  const specs = [
    { axis: 'x', color: 0xef4444, rot: [0, 0, -Math.PI / 2], pos: [0.85, 0, 0], conePos: [1.45, 0, 0] },
    { axis: 'y', color: 0x22c55e, rot: [0, 0, 0], pos: [0, 0.85, 0], conePos: [0, 1.45, 0] },
    { axis: 'z', color: 0x3b82f6, rot: [Math.PI / 2, 0, 0], pos: [0, 0, 0.85], conePos: [0, 0, 1.45] }
  ];

  const shaftGeo = new THREE.CylinderGeometry(0.032, 0.032, 1.25, 10);
  const coneGeo = new THREE.ConeGeometry(0.11, 0.28, 12);
  const hitCylGeo = new THREE.CylinderGeometry(0.15, 0.15, 1.65, 8);
  const hitCylMat = new THREE.MeshBasicMaterial({ transparent: true, opacity: 0.0, depthTest: false, depthWrite: false });

  for (const sp of specs) {
    const mat = new THREE.MeshBasicMaterial({ color: sp.color, depthTest: false, depthWrite: false });
    const shaft = new THREE.Mesh(shaftGeo, mat);
    shaft.rotation.set(...sp.rot);
    shaft.position.set(...sp.pos);
    shaft.renderOrder = 999;
    shaft.userData = { dragType: 'cog', cogAxis: sp.axis };

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

    handles.add(shaft, cone, hitCyl);
  }
  return handles;
}

/**
 * Computes optimal camera-facing drag plane for a 1D CoG axis or free 3D CoG sphere drag.
 */
export function buildCogDragPlane({ THREE, axis = 'free', worldCoG, cameraDir, cargoQuat }) {
  const normal = new THREE.Vector3(0, 0, 1);
  if (axis === 'free' || !cargoQuat) {
    normal.copy(cameraDir).normalize();
    if (normal.lengthSq() < 1e-6) normal.set(0, 0, 1);
    return new THREE.Plane().setFromNormalAndCoplanarPoint(normal, worldCoG);
  }
  const axisWorld = new THREE.Vector3(axis === 'x' ? 1 : 0, axis === 'y' ? 1 : 0, axis === 'z' ? 1 : 0)
    .applyQuaternion(cargoQuat)
    .normalize();
  // Plane containing axisWorld whose normal aligns maximally with the view ray
  const side = new THREE.Vector3().crossVectors(axisWorld, cameraDir);
  if (side.lengthSq() < 1e-6) {
    normal.set(axis === 'y' ? 1 : 0, axis === 'y' ? 0 : 1, 0);
  } else {
    normal.crossVectors(side, axisWorld).normalize();
  }
  return new THREE.Plane().setFromNormalAndCoplanarPoint(normal, worldCoG);
}

/**
 * Projects ray intersection into cargo-local coordinates and updates state.cogX/Y/Z
 * cleanly without triggering a heavy scene rebuild per pointer-move frame.
 */
export function applyCogDragDelta({
  THREE,
  ray,
  dragPlane,
  axis = 'free',
  startWorld,
  startCog = { x: 0, y: 0, z: 0 },
  cargoRootGroup,
  state
}) {
  if (!ray || !dragPlane || !state) return null;
  const hitWorld = new THREE.Vector3();
  if (!ray.intersectPlane(dragPlane, hitWorld)) return null;

  const toLocal = (pt) => (cargoRootGroup && typeof cargoRootGroup.worldToLocal === 'function'
    ? cargoRootGroup.worldToLocal(pt.clone())
    : pt.clone());

  const localNow = toLocal(hitWorld);
  const localStart = startWorld ? toLocal(startWorld) : new THREE.Vector3(startCog.x, startCog.y, startCog.z);
  const delta = localNow.sub(localStart);

  const L = Math.max(0.5, Number(state.L) || 6);
  const H = Math.max(0.5, Number(state.H) || 2.5);
  const W = Math.max(0.5, Number(state.W) || 2.4);
  const clamp = (v, lim) => Math.max(-lim, Math.min(lim, v));

  if (axis === 'x' || axis === 'free') state.cogX = clamp((Number(startCog.x) || 0) + delta.x, L * 0.45);
  if (axis === 'y' || axis === 'free') state.cogY = clamp((Number(startCog.y) || 0) + delta.y, H * 0.45);
  if (axis === 'z' || axis === 'free') state.cogZ = clamp((Number(startCog.z) || 0) + delta.z, W * 0.45);

  return { cogX: state.cogX, cogY: state.cogY, cogZ: state.cogZ };
}
