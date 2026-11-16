// @purpose: Tái sử dụng biến toán học scratch và bộ đệm nghỉ XPBD để giảm giật lag vòng lặp cáp 3D

let _scratchV0 = null;
let _scratchV1 = null;
let _scratchX = null;
let _scratchY = null;
let _scratchZ = null;
let _scratchPos = null;
let _scratchScale = null;
let _scratchQuat = null;
let _scratchMat4 = null;
let _scratchBasis = null;

function ensureScratch(THREE) {
  if (_scratchV0) return;
  _scratchV0 = new THREE.Vector3();
  _scratchV1 = new THREE.Vector3();
  _scratchX = new THREE.Vector3();
  _scratchY = new THREE.Vector3();
  _scratchZ = new THREE.Vector3();
  _scratchPos = new THREE.Vector3();
  _scratchScale = new THREE.Vector3();
  _scratchQuat = new THREE.Quaternion();
  _scratchMat4 = new THREE.Matrix4();
  _scratchBasis = new THREE.Matrix4();
}

/**
 * Checks whether a slack rope's endpoints, target length, and cargo config stayed
 * stationary long enough to reuse its settled XPBD polyline without re-solving.
 */
export function tryReuseSettledSlackRope(slingObj, A, B, L, cargoKey, isIdle) {
  if (!slingObj || !isIdle || !slingObj._settledPts || slingObj._settledCargoKey !== cargoKey) {
    if (slingObj) {
      slingObj._settledFrames = 0;
      slingObj._settledCargoKey = cargoKey;
    }
    return null;
  }
  const prevA = slingObj._settledA;
  const prevB = slingObj._settledB;
  const tolSq = 1e-8;
  const sameEndpoints = prevA && prevB
    && prevA.distanceToSquared(A) <= tolSq
    && prevB.distanceToSquared(B) <= tolSq
    && Math.abs((slingObj._settledLen || 0) - L) <= 1e-4;

  if (!sameEndpoints) {
    slingObj._settledFrames = 0;
    return null;
  }
  if ((slingObj._settledFrames || 0) >= 8) {
    return slingObj._settledPts;
  }
  return null;
}

/**
 * Records the latest solved slack polyline and tracks convergence frames when idle.
 */
export function recordSolvedSlackRope(slingObj, A, B, L, cargoKey, pts, isIdle) {
  if (!slingObj || !pts || !pts.length) return pts;
  const prevA = slingObj._settledA;
  const prevB = slingObj._settledB;
  const tolSq = 1e-8;
  const sameEndpoints = isIdle && prevA && prevB
    && slingObj._settledCargoKey === cargoKey
    && prevA.distanceToSquared(A) <= tolSq
    && prevB.distanceToSquared(B) <= tolSq
    && Math.abs((slingObj._settledLen || 0) - L) <= 1e-4;

  if (sameEndpoints) {
    slingObj._settledFrames = (slingObj._settledFrames || 0) + 1;
  } else {
    slingObj._settledFrames = 0;
  }
  if (!slingObj._settledA) slingObj._settledA = A.clone();
  else slingObj._settledA.copy(A);
  if (!slingObj._settledB) slingObj._settledB = B.clone();
  else slingObj._settledB.copy(B);
  slingObj._settledLen = L;
  slingObj._settledCargoKey = cargoKey;
  slingObj._settledPts = pts;
  return pts;
}

/**
 * Writes an instanced chain link matrix without heap Vector3/Matrix4/Quaternion allocations.
 */
export function writeChainLinkInstanceMatrix(THREE, instances, idx, p0, p1, t, zTarget, sx, sy, upY) {
  ensureScratch(THREE);
  _scratchPos.copy(p0).lerp(p1, t);
  _scratchY.subVectors(p1, p0);
  if (_scratchY.lengthSq() < 1e-8) _scratchY.copy(upY);
  else _scratchY.normalize();

  _scratchZ.copy(zTarget);
  _scratchX.crossVectors(_scratchY, _scratchZ);
  if (_scratchX.lengthSq() < 1e-8) {
    if (Math.abs(_scratchY.y) < 0.92) _scratchZ.crossVectors(upY, _scratchY);
    else _scratchZ.set(1, 0, 0).cross(_scratchY);
    _scratchZ.normalize();
    _scratchX.crossVectors(_scratchY, _scratchZ);
  }
  _scratchX.normalize();
  _scratchZ.crossVectors(_scratchX, _scratchY).normalize();
  _scratchBasis.makeBasis(_scratchX, _scratchY, _scratchZ);
  _scratchQuat.setFromRotationMatrix(_scratchBasis);
  _scratchScale.set(sx, sy, sx);
  _scratchMat4.compose(_scratchPos, _scratchQuat, _scratchScale);
  instances.setMatrixAt(idx, _scratchMat4);
}

/**
 * Updates a tubular or flat-web sling segment transform in place without per-segment allocations.
 */
export function applySlingSegmentTransform(THREE, seg, p0, p1, upY, look, overlapLen, dia, actualTension, wllNow, index, totalCount, bodyK) {
  ensureScratch(THREE);
  _scratchV0.subVectors(p1, p0);
  _scratchPos.copy(p0).lerp(p1, 0.5);
  seg.position.copy(_scratchPos);
  _scratchV0.normalize();

  if (look === 'web') {
    const widthM = Math.max(0.045, Math.min(0.30, dia / 1000));
    const thickM = Math.max(0.0022, Math.min(0.008, widthM * 0.045));
    seg.scale.set(widthM, overlapLen, thickM);
    _scratchX.crossVectors(_scratchV0, upY);
    if (_scratchX.lengthSq() < 1e-8) _scratchX.set(1, 0, 0);
    _scratchX.normalize();
    _scratchZ.crossVectors(_scratchV0, _scratchX).normalize();
    _scratchBasis.makeBasis(_scratchX, _scratchV0, _scratchZ);
    seg.quaternion.setFromRotationMatrix(_scratchBasis);
    return;
  }

  seg.quaternion.setFromUnitVectors(upY, _scratchV0);
  if (look === 'round_sling') {
    const tensionRatio = Math.max(0, Math.min(1, actualTension / Math.max(1, wllNow)));
    const pinSquash = (index === 0 || index === totalCount - 1) ? 0.35 : ((index === 1 || index === totalCount - 2) ? 0.18 : 0);
    const flatFactor = Math.max(0, Math.min(0.48, tensionRatio * 0.28 + pinSquash));
    seg.scale.set(bodyK * 0.72 * (1 + flatFactor * 0.65), overlapLen, bodyK * 0.72 * (1 - flatFactor * 0.55));
  } else if (look === 'grommet') {
    seg.scale.set(bodyK * 0.85, overlapLen, bodyK * 0.85);
  } else {
    seg.scale.set(bodyK, overlapLen, bodyK);
  }
}
