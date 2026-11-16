// @purpose: Chuẩn hóa kích thước ISO 668/1161, hệ cáp tời 8 nhánh và cơ học nâng hạ thực tế cho Ngáng cẩu Container STS
import * as THREE from 'three';

const ISO_CLASSES = Object.freeze({
  20: Object.freeze({ ft: 20, outerLength: 6.058, outerWidth: 2.438, pinSpanX: 5.853, pinSpanZ: 2.259, outerHeight: 2.591 }),
  40: Object.freeze({ ft: 40, outerLength: 12.192, outerWidth: 2.438, pinSpanX: 11.985, pinSpanZ: 2.259, outerHeight: 2.591 }),
  45: Object.freeze({ ft: 45, outerLength: 13.716, outerWidth: 2.438, pinSpanX: 13.557, pinSpanZ: 2.259, outerHeight: 2.896 })
});

const FLIPPER_OR_AUX_RE = /(flip|guide|gather|arm|twistlock|pin|headblock|sheave_top)/i;
const _yUp = new THREE.Vector3(0, 1, 0);
const _tmpDir = new THREE.Vector3();
const _tmpMid = new THREE.Vector3();
const _tmpBot = new THREE.Vector3();
const _tmpTop = new THREE.Vector3();
const _tmpEuler = new THREE.Euler(0, 0, 0, 'YXZ');

/**
 * Trả về thông số kích thước phủ bì chuẩn ISO 668 & tâm chốt gù Twistlock chuẩn ISO 1161.
 */
export function computeIsoContainerSpreaderSpec(cargoLength = 12.192, cargoWidth = 2.438, forceFt = null) {
  let ft = Number(forceFt) || 0;
  if (!ft) {
    if (cargoLength >= 13.0) ft = 45;
    else if (cargoLength >= 9.0) ft = 40;
    else ft = 20;
  }
  const base = ft <= 20 ? ISO_CLASSES[20] : (ft >= 45 ? ISO_CLASSES[45] : ISO_CLASSES[40]);
  const outerLength = base.outerLength;
  const outerWidth = THREE.MathUtils.clamp(cargoWidth || base.outerWidth, 2.2, 2.59);
  const pinSpanX = base.pinSpanX;
  const pinSpanZ = outerWidth === base.outerWidth ? base.pinSpanZ : Math.max(0.8, outerWidth - 0.179);
  return {
    ft: base.ft,
    outerLength,
    outerWidth,
    pinSpanX,
    pinSpanZ,
    halfX: pinSpanX * 0.5,
    halfZ: pinSpanZ * 0.5,
    endBeamBottomY: -0.34,
    twistlockFootY: -0.22
  };
}

function isFlipperOrAuxMesh(mesh) {
  const label = `${mesh.name || ''} ${mesh.material?.name || ''}`;
  if (FLIPPER_OR_AUX_RE.test(label)) return true;
  const col = mesh.material?.color;
  if (col && col.r > 0.55 && col.g < 0.28 && col.b < 0.28) return true;
  return false;
}

function measureYellowChassisBox(cadGroup) {
  cadGroup.updateMatrixWorld(true);
  const box = new THREE.Box3();
  let count = 0;
  cadGroup.traverse((o) => {
    if (!o.isMesh || o.visible === false) return;
    if (isFlipperOrAuxMesh(o)) return;
    box.expandByObject(o);
    count++;
  });
  if (!count || box.isEmpty()) box.setFromObject(cadGroup);
  return box;
}

/**
 * Hiệu chỉnh tỷ lệ mô hình CAD ngáng STS đúng 1 lần duy nhất để khung dầm vàng
 * khớp chính xác bao hình ISO `outerLength × outerWidth` (không bị phóng to vượt mép container).
 */
export function calibrateStsCadToIsoEnvelope(cadGroup, spec) {
  if (!cadGroup || !spec) return null;
  cadGroup.scale.set(1, 1, 1);
  cadGroup.position.set(0, 0, 0);
  const box0 = measureYellowChassisBox(cadGroup);
  const sz0 = new THREE.Vector3();
  const c0 = new THREE.Vector3();
  box0.getSize(sz0);
  box0.getCenter(c0);
  cadGroup.position.sub(c0);

  const sx = THREE.MathUtils.clamp((spec.outerLength || 12.192) / Math.max(0.5, sz0.x), 0.35, 2.8);
  const sz = THREE.MathUtils.clamp((spec.outerWidth || 2.438) / Math.max(0.5, sz0.z), 0.35, 2.8);
  const sy = THREE.MathUtils.clamp((sx + sz) * 0.5, 0.35, 2.8);
  cadGroup.scale.set(sx, sy, sz);

  const box1 = measureYellowChassisBox(cadGroup);
  const c1 = new THREE.Vector3();
  const sz1 = new THREE.Vector3();
  box1.getCenter(c1);
  box1.getSize(sz1);
  cadGroup.position.x -= c1.x;
  cadGroup.position.z -= c1.z;
  const bottomTarget = spec.endBeamBottomY ?? -0.34;
  cadGroup.position.y -= (box1.min.y - bottomTarget);
  cadGroup.updateMatrixWorld(true);
  return { outerX: sz1.x, outerZ: sz1.z, scaleX: sx, scaleY: sy, scaleZ: sz };
}

/**
 * Đồng bộ cụm Headblock & 8 sợi cáp tời đứng nối liền từ thân ngáng STS lên tới puly cẩu/trolley (`hookPos`).
 */
export function syncStsHeadblockHoistRopes(vis, beamPos, beamQuat, hookPos, hbLocals) {
  if (!vis || !vis.block || !Array.isArray(vis.ropes) || !beamPos || !Array.isArray(hbLocals)) return;
  const q = beamQuat || new THREE.Quaternion();
  const minHeadY = beamPos.y + 0.92;
  const targetHeadY = hookPos ? Math.max(minHeadY, hookPos.y) : minHeadY;
  const headX = hookPos ? THREE.MathUtils.lerp(beamPos.x, hookPos.x, 0.85) : beamPos.x;
  const headZ = hookPos ? THREE.MathUtils.lerp(beamPos.z, hookPos.z, 0.85) : beamPos.z;

  vis.block.position.set(headX, targetHeadY, headZ);
  vis.block.quaternion.copy(q);

  for (let i = 0; i < vis.ropes.length && i < hbLocals.length; i++) {
    const loc = hbLocals[i];
    _tmpBot.set(loc[0], loc[1], loc[2]).applyQuaternion(q).add(beamPos);
    _tmpTop.set(loc[0] * 0.35, -0.14, loc[2] * 0.35).applyQuaternion(q).add(vis.block.position);
    _tmpMid.copy(_tmpTop).add(_tmpBot).multiplyScalar(0.5);
    const len = Math.max(0.08, _tmpTop.distanceTo(_tmpBot));
    _tmpDir.subVectors(_tmpBot, _tmpTop);
    if (_tmpDir.lengthSq() < 1e-8) _tmpDir.set(0, -1, 0);
    else _tmpDir.normalize();

    const rope = vis.ropes[i];
    rope.position.copy(_tmpMid);
    rope.scale.set(1, len, 1);
    rope.quaternion.setFromUnitVectors(_yUp, _tmpDir);
  }
}

/**
 * Giải tư thế ghép nối thực tế cho ngáng STS chế độ Gắp trực tiếp Twistlock (`direct`):
 * - Khớp khít 0mm lên mặt nóc container, không lún xuyên qua container khi hạ xuống sàn.
 * - Khi nhấc khỏi đất (`airborne`), phản ánh độ nghiêng đàn hồi thực tế của hệ 8 cáp tời khi lệch CoG hoặc đứt góc.
 */
export function solveStsDirectTwistlockPose({
  beamPos, cargoPos, cargoDims, cogOffset, yawRad = 0, floorY = 0, brokenCorners = 0
} = {}) {
  const H = Math.max(0.5, cargoDims?.H || 2.591);
  const L = Math.max(2.0, cargoDims?.L || 12.192);
  const W = Math.max(1.5, cargoDims?.W || 2.438);
  const tipPad = 0.34;
  const groundCargoCenterY = floorY + H * 0.5;
  const minBeamY = floorY + H + tipPad;

  const rawBeamY = beamPos ? beamPos.y : minBeamY;
  const clampedBeamY = Math.max(minBeamY, rawBeamY);
  const cargoY = Math.max(groundCargoCenterY, clampedBeamY - tipPad - H * 0.5);
  const clearance = Math.max(0, cargoY - groundCargoCenterY);
  const airborneFactor = THREE.MathUtils.clamp((clearance - 0.02) / 0.12, 0, 1);

  const cogX = cogOffset?.x || 0;
  const cogZ = cogOffset?.z || 0;
  // Lệch tâm CoG gây nghiêng thực tế 0..3.8° trên hệ cáp tời 8 nhánh; đứt góc chốt gù làm tăng nghiêng cảnh báo
  const rawPitch = -(cogX / Math.max(1.5, L * 0.45)) * 0.055;
  const rawRoll = (cogZ / Math.max(0.8, W * 0.45)) * 0.045;
  const brokenBias = Math.min(2, brokenCorners || 0) * 0.065;
  const tiltPitchRad = airborneFactor * THREE.MathUtils.clamp(rawPitch - brokenBias, -0.18, 0.18);
  const tiltRollRad = airborneFactor * THREE.MathUtils.clamp(rawRoll + brokenBias * 0.6, -0.16, 0.16);

  _tmpEuler.set(tiltRollRad, yawRad, tiltPitchRad, 'YXZ');
  const quat = new THREE.Quaternion().setFromEuler(_tmpEuler);

  return {
    clampedBeamY,
    cargoY,
    clearance,
    tiltPitchRad,
    tiltRollRad,
    quat,
    seatedOnDeck: clearance <= 0.02
  };
}
