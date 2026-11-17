// @purpose: Trường mũi tên véc-tơ lực 3D thời gian thực từ CoG & các điểm nối (tái sử dụng pool, không cấp phát mỗi khung hình)
const MAX_CONNECTION_ARROWS = 12;

export function computeVectorLength(tensionT, swlT = 10) {
  const t = Math.max(0, Number(tensionT) || 0);
  const swl = Math.max(0.25, Number(swlT) || 10);
  if (t <= 0.01) return 0;
  // Scale by normalized sqrt(T/SWL) so low and extreme loads stay readable in 3D space
  const ratio = t / swl;
  return Math.min(4.2, Math.max(0.55, 0.55 + Math.sqrt(ratio) * 1.95));
}

export function classifyForceColorHex(tensionT, swlT = 10) {
  const t = Math.max(0, Number(tensionT) || 0);
  const swl = Math.max(0.25, Number(swlT) || 10);
  if (t > swl) return 0xef4444;
  if (t > swl * 0.8) return 0xfacc15;
  return 0x10b981;
}

export function getSlingAngleTooltip(lang = 'vi') {
  const vi = 'Góc ngang của dây (α): Góc tạo bởi nhánh dây cáp và mặt phẳng nằm ngang.';
  const en = 'Horizontal Sling Angle (α): The angle between the sling leg and the horizontal plane.';
  return String(lang).toLowerCase() === 'en' ? en : vi;
}

export function createForceVectorField({ THREE, scene }) {
  const group = new THREE.Group();
  group.name = 'Force_Vector_Field_3D';
  group.visible = false;

  const dirUp = new THREE.Vector3(0, 1, 0);
  const dirDown = new THREE.Vector3(0, -1, 0);
  const tmpDir = new THREE.Vector3();

  const cogGravityArrow = new THREE.ArrowHelper(dirDown, new THREE.Vector3(), 1.5, 0xa855f7, 0.32, 0.18);
  const cogLiftArrow = new THREE.ArrowHelper(dirUp, new THREE.Vector3(), 1.5, 0x38bdf8, 0.32, 0.18);
  cogGravityArrow.name = 'CoG_Gravity_Force_Vector';
  cogLiftArrow.name = 'CoG_Resultant_Force_Vector';
  group.add(cogGravityArrow, cogLiftArrow);

  const connArrows = [];
  for (let i = 0; i < MAX_CONNECTION_ARROWS; i++) {
    const arr = new THREE.ArrowHelper(dirUp, new THREE.Vector3(), 1.0, 0x10b981, 0.28, 0.15);
    arr.visible = false;
    connArrows.push(arr);
    group.add(arr);
  }
  if (scene) scene.add(group);

  let disposed = false;

  function update({
    visible = false,
    qualityTier = 'high',
    cogWorld = null,
    cargoWeightT = 0,
    totalHookLoadT = 0,
    connections = []
  } = {}) {
    if (disposed || !visible || qualityTier === 'performance') {
      group.visible = false;
      return;
    }
    group.visible = true;

    if (cogWorld && cargoWeightT > 0.05) {
      const refW = Math.max(5, cargoWeightT);
      const gravLen = computeVectorLength(cargoWeightT, refW);
      cogGravityArrow.visible = true;
      cogGravityArrow.position.set(cogWorld.x, cogWorld.y, cogWorld.z);
      cogGravityArrow.setDirection(dirDown);
      cogGravityArrow.setLength(gravLen, Math.min(0.38, gravLen * 0.28), 0.18);

      if (totalHookLoadT > 0.05) {
        const upLen = computeVectorLength(totalHookLoadT, refW);
        cogLiftArrow.visible = true;
        cogLiftArrow.position.set(cogWorld.x, cogWorld.y, cogWorld.z);
        cogLiftArrow.setDirection(dirUp);
        cogLiftArrow.setLength(upLen, Math.min(0.38, upLen * 0.28), 0.18);
      } else {
        cogLiftArrow.visible = false;
      }
    } else {
      cogGravityArrow.visible = false;
      cogLiftArrow.visible = false;
    }

    const list = Array.isArray(connections) ? connections : [];
    for (let i = 0; i < connArrows.length; i++) {
      const arr = connArrows[i];
      const item = list[i];
      if (!item || !item.origin || !item.dir || !(item.tensionT > 0.02)) {
        arr.visible = false;
        continue;
      }
      tmpDir.set(item.dir.x || 0, item.dir.y || 0, item.dir.z || 0);
      if (tmpDir.lengthSq() < 1e-8) {
        arr.visible = false;
        continue;
      }
      tmpDir.normalize();
      const len = computeVectorLength(item.tensionT, item.swlT || 10);
      arr.visible = true;
      arr.position.set(item.origin.x || 0, item.origin.y || 0, item.origin.z || 0);
      arr.setDirection(tmpDir);
      arr.setColor(classifyForceColorHex(item.tensionT, item.swlT || 10));
      arr.setLength(len, Math.min(0.35, len * 0.28), 0.16);
    }
  }

  function dispose() {
    if (disposed) return;
    disposed = true;
    if (scene) scene.remove(group);
    [cogGravityArrow, cogLiftArrow, ...connArrows].forEach((a) => {
      if (typeof a.dispose === 'function') a.dispose();
    });
  }

  return { group, cogGravityArrow, cogLiftArrow, connArrows, update, dispose };
}
