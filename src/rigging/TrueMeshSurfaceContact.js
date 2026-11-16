// @purpose: Bộ giải tiếp xúc bề mặt 3D thực (0mm khe hở, không xuyên thủng) cho cáp và xích ôm sát kiện hàng 3D
import * as THREE from 'three';

const RAY_SKIP_RE = /(hit|marker|cog|outline|picker|shadow|arrow|gizmo)/i;
const _raycaster = new THREE.Raycaster();
const _vA = new THREE.Vector3();
const _vB = new THREE.Vector3();
const _wOrigin = new THREE.Vector3();
const _wDir = new THREE.Vector3();

function collectContactMeshes(cargoVisual) {
  const meshes = [];
  if (!cargoVisual || typeof cargoVisual.traverse !== 'function') return meshes;
  cargoVisual.traverse((obj) => {
    if (!obj.isMesh || obj.visible === false || !obj.geometry) return;
    const ud = obj.userData || {};
    if (ud.noLugWeld || ud.isCADEdge || ud.isHitMesh || ud.dragType) return;
    if (obj.name && RAY_SKIP_RE.test(obj.name)) return;
    if (obj.material && obj.material.transparent && obj.material.opacity === 0) return;
    meshes.push(obj);
  });
  return meshes;
}

function getAnalyticalRadiusInfo(cargoType, dims, surfaceField) {
  const L = Math.max(0.4, dims?.L || 2);
  const W = Math.max(0.4, dims?.W || 2);
  const H = Math.max(0.4, dims?.H || 2);
  if (cargoType === 'vessel' || cargoType === 'pipe') {
    const r = Math.min(W, H) * 0.42 + 0.022;
    const cylLen = Math.max(1.2, L - Math.min(W, H) * 0.42 * 1.5);
    return { kind: 'cylinderX', r, halfCyl: cylLen * 0.5, headRx: Math.min(W, H) * 0.42 * 0.6, cy: H * 0.06 };
  }
  if (cargoType === 'isotank') {
    return { kind: 'cylinderX', r: Math.min(W, H) * 0.43, halfCyl: L * 0.46, headRx: 0.25, cy: -H * 0.02 };
  }
  if (cargoType === 'spherical_tank' || cargoType === 'sphere') {
    return { kind: 'sphere', r: Math.min(L, W, H) * 0.48, cx: 0, cy: 0, cz: 0 };
  }
  return surfaceField?.detectedSphere ? { kind: 'sphere', ...surfaceField.detectedSphere } : null;
}

function sampleGridBilinear(grid, nx, nz, halfX, halfZ, lx, lz) {
  if (!grid || Math.abs(lx) > halfX || Math.abs(lz) > halfZ) return null;
  const u = ((lx + halfX) / Math.max(1e-5, halfX * 2)) * (nx - 1);
  const v = ((lz + halfZ) / Math.max(1e-5, halfZ * 2)) * (nz - 1);
  const ix = Math.max(0, Math.min(nx - 2, Math.floor(u)));
  const iz = Math.max(0, Math.min(nz - 2, Math.floor(v)));
  const fx = THREE.MathUtils.clamp(u - ix, 0, 1);
  const fz = THREE.MathUtils.clamp(v - iz, 0, 1);
  const c00 = grid[iz * nx + ix], c10 = grid[iz * nx + ix + 1];
  const c01 = grid[(iz + 1) * nx + ix], c11 = grid[(iz + 1) * nx + ix + 1];
  const valid = [c00, c10, c01, c11].filter(Number.isFinite);
  if (!valid.length) return null;
  if (valid.length < 4) return Math.max(...valid);
  return THREE.MathUtils.lerp(THREE.MathUtils.lerp(c00, c10, fx), THREE.MathUtils.lerp(c01, c11, fx), fz);
}

/** Quét lưới bề mặt 3D thực của cargoVisual bằng Raycaster (chỉ chạy 1 lần khi đổi kiện). */
export function bakeCargoSurfaceField(cargoVisual, dims, cargoType) {
  const L = Math.max(0.4, dims?.L || 4), W = Math.max(0.4, dims?.W || 2), H = Math.max(0.4, dims?.H || 2);
  const meshes = collectContactMeshes(cargoVisual);
  if (!meshes.length) return null;

  const refObj = cargoVisual.parent || cargoVisual;
  refObj.updateMatrixWorld(true);
  const rootM = refObj.matrixWorld.clone();
  const invRootM = rootM.clone().invert();

  const nx = 25, nz = 25, halfX = L * 0.52, halfZ = W * 0.52;
  const topGrid = new Float32Array(nx * nz).fill(NaN);
  const botGrid = new Float32Array(nx * nz).fill(NaN);
  const castLocalRay = (ox, oy, oz, dx, dy, dz, farDist) => {
    _wOrigin.set(ox, oy, oz).applyMatrix4(rootM);
    _wDir.set(dx, dy, dz).transformDirection(rootM).normalize();
    _raycaster.set(_wOrigin, _wDir);
    _raycaster.near = 0.001;
    _raycaster.far = farDist;
    const hits = _raycaster.intersectObjects(meshes, false);
    return hits.length ? hits[0].point.clone().applyMatrix4(invRootM) : null;
  };

  let maxSkinY = -Infinity;
  let minSkinY = Infinity;
  for (let iz = 0; iz < nz; iz++) {
    const lz = -halfZ + (iz / (nz - 1)) * (halfZ * 2);
    for (let ix = 0; ix < nx; ix++) {
      const lx = -halfX + (ix / (nx - 1)) * (halfX * 2);
      const tHit = castLocalRay(lx, H * 0.65 + 1.0, lz, 0, -1, 0, H * 1.4 + 2.0);
      if (tHit) { topGrid[iz * nx + ix] = tHit.y; maxSkinY = Math.max(maxSkinY, tHit.y); }
      const bHit = castLocalRay(lx, -H * 0.65 - 1.0, lz, 0, 1, 0, H * 1.4 + 2.0);
      if (bHit) { botGrid[iz * nx + ix] = bHit.y; minSkinY = Math.min(minSkinY, bHit.y); }
    }
  }
  if (!Number.isFinite(maxSkinY)) maxSkinY = H * 0.5;
  if (!Number.isFinite(minSkinY)) minSkinY = -H * 0.5;

  const ny = 11, na = 24, radialGrid = new Float32Array(ny * na).fill(0);
  const outerR = Math.hypot(halfX, halfZ) + 1.0;
  for (let iy = 0; iy < ny; iy++) {
    const ly = -H * 0.48 + (iy / (ny - 1)) * (H * 0.96);
    for (let ia = 0; ia < na; ia++) {
      const ang = (ia / na) * Math.PI * 2, ca = Math.cos(ang), sa = Math.sin(ang);
      const hit = castLocalRay(ca * outerR, ly, sa * outerR, -ca, 0, -sa, outerR * 1.8);
      radialGrid[iy * na + ia] = hit ? Math.max(0, hit.x * ca + hit.z * sa) : 0;
    }
  }

  let detectedSphere = null;
  if (meshes.length <= 3) {
    const sph = meshes.find((m) => m.geometry?.type === 'SphereGeometry');
    if (sph && sph.geometry.parameters?.radius) {
      sph.geometry.computeBoundingBox();
      const c = new THREE.Vector3();
      sph.geometry.boundingBox.getCenter(c).applyMatrix4(sph.matrixWorld).applyMatrix4(invRootM);
      const sc = new THREE.Vector3();
      sph.getWorldScale(sc);
      if (Math.abs(sc.x - sc.y) < 0.08 && Math.abs(sc.y - sc.z) < 0.08) {
        detectedSphere = { cx: c.x, cy: c.y, cz: c.z, r: sph.geometry.parameters.radius * sc.x };
      }
    }
  }
  return { cargoType, L, W, H, nx, nz, halfX, halfZ, ny, na, topGrid, botGrid, radialGrid, detectedSphere, maxSkinY, minSkinY };
}

function sampleRadialContour(field, ly, angle) {
  if (!field?.radialGrid) return 0;
  const { ny, na, H, radialGrid, minSkinY, maxSkinY } = field;
  if (ly > (maxSkinY ?? H * 0.5) + 0.05 || ly < (minSkinY ?? -H * 0.5) - 0.05) return 0;
  const ty = THREE.MathUtils.clamp((ly + H * 0.48) / Math.max(1e-4, H * 0.96), 0, 1) * (ny - 1);
  const iy0 = Math.max(0, Math.min(ny - 2, Math.floor(ty))), fy = ty - iy0;
  const normAng = ((angle % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
  const ta = (normAng / (Math.PI * 2)) * na, ia0 = Math.floor(ta) % na, ia1 = (ia0 + 1) % na, fa = ta - Math.floor(ta);
  const r0 = THREE.MathUtils.lerp(radialGrid[iy0 * na + ia0], radialGrid[iy0 * na + ia1], fa);
  const r1 = THREE.MathUtils.lerp(radialGrid[(iy0 + 1) * na + ia0], radialGrid[(iy0 + 1) * na + ia1], fa);
  return THREE.MathUtils.lerp(r0, r1, fy);
}

/** Lấy cao độ mặt trên 3D thực tại (lx, lz) + đúng 1 lớp bán kính tiếp xúc `pad`. */
export function sampleTrueCargoRoofY(lx, lz, pad, cargoType, dims, surfaceField) {
  const rPad = Math.max(0.005, pad || 0);
  const ana = getAnalyticalRadiusInfo(cargoType, dims, surfaceField);
  let yAna = null;
  if (ana?.kind === 'sphere') {
    const rad = ana.r + rPad, d2 = (lx - ana.cx) ** 2 + (lz - ana.cz) ** 2;
    if (d2 <= rad * rad) yAna = ana.cy + Math.sqrt(Math.max(0, rad * rad - d2));
  } else if (ana?.kind === 'cylinderX') {
    const rad = ana.r + rPad;
    if (Math.abs(lx) <= ana.halfCyl + ana.headRx + rPad && Math.abs(lz) <= rad) {
      const r2 = rad * rad - lz * lz;
      yAna = r2 > 0 ? ana.cy + Math.sqrt(r2) : ana.cy;
    }
  }
  const rawY = surfaceField
    ? sampleGridBilinear(surfaceField.topGrid, surfaceField.nx, surfaceField.nz, surfaceField.halfX, surfaceField.halfZ, lx, lz)
    : null;
  const yField = rawY != null ? rawY + rPad : null;
  if (yAna != null && yField != null) return Math.max(yAna, yField);
  return yField ?? yAna;
}

/** Đẩy 1 điểm trong không gian cục bộ kiện hàng ra đúng bề mặt 3D thực + đúng 1 bán kính `pad`. */
export function projectPointOntoTrueCargoSurface(localPt, pad, cargoType, dims, surfaceField, biasUp = false) {
  const q = localPt.clone();
  const rPad = Math.max(0.005, pad || 0);
  const ana = getAnalyticalRadiusInfo(cargoType, dims, surfaceField);
  if (ana?.kind === 'sphere') {
    const dx = q.x - ana.cx, dy = q.y - ana.cy, dz = q.z - ana.cz;
    const dist = Math.hypot(dx, dy, dz), need = ana.r + rPad;
    if (dist < need) {
      if (dist > 1e-5) q.set(ana.cx + dx * (need + 0.001) / dist, ana.cy + dy * (need + 0.001) / dist, ana.cz + dz * (need + 0.001) / dist);
      else q.set(ana.cx, ana.cy + need + 0.001, ana.cz);
    }
  }
  if (!surfaceField) return q;
  const topBound = (surfaceField.maxSkinY ?? surfaceField.H * 0.5) + rPad;
  const botBound = (surfaceField.minSkinY ?? -surfaceField.H * 0.5) - rPad;
  if (q.y > topBound || q.y < botBound) return q;

  const skinTop = sampleGridBilinear(surfaceField.topGrid, surfaceField.nx, surfaceField.nz, surfaceField.halfX, surfaceField.halfZ, q.x, q.z);
  const skinBot = sampleGridBilinear(surfaceField.botGrid, surfaceField.nx, surfaceField.nz, surfaceField.halfX, surfaceField.halfZ, q.x, q.z);
  if (skinTop != null && q.y > skinTop + rPad) return q;
  if (skinBot != null && q.y < skinBot - rPad) return q;
  const rShell = sampleRadialContour(surfaceField, q.y, Math.atan2(q.z, q.x));
  const rHoriz = Math.hypot(q.x, q.z);
  if (skinTop == null && skinBot == null && rShell <= 1e-4) return q;

  const needR = rShell > 1e-4 ? rShell + rPad : 0;
  const penRad = needR > 0 ? needR - rHoriz : -1;
  const needTop = skinTop != null ? skinTop + rPad : -Infinity;
  const penTop = skinTop != null && q.y >= (skinBot ?? -surfaceField.H * 0.5) - rPad ? needTop - q.y : -1;
  if (penTop <= 0 && penRad <= 0) return q;

  if ((biasUp && penTop > 0) || (penTop > 0 && (penRad <= 0 || penTop <= penRad + 0.08))) {
    q.y = needTop + 0.001;
  } else if (penRad > 0 && rHoriz > 1e-5) {
    const s = (needR + 0.001) / rHoriz;
    q.x *= s;
    q.z *= s;
  } else if (skinTop != null) {
    q.y = needTop + 0.001;
  }
  return q;
}

/** Ép đường gấp khúc cục bộ (kể cả khi cáp căng cắt qua bụng cầu/trụ) trượt sát bề mặt 3D thực. */
export function conformPathToTrueCargoSurface(localPts, pad, cargoType, dims, surfaceField, isTaut = false) {
  if (!localPts || localPts.length < 2) return localPts || [];
  const rPad = Math.max(0.005, pad || 0);
  const subdivided = [];
  const subCount = isTaut ? 10 : 4;
  for (let i = 0; i < localPts.length - 1; i++) {
    const a = localPts[i], b = localPts[i + 1];
    subdivided.push(a.clone());
    const segLen = a.distanceTo(b);
    const steps = segLen > 0.35 ? subCount : (segLen > 0.12 ? 2 : 1);
    for (let s = 1; s < steps; s++) {
      _vA.lerpVectors(a, b, s / steps);
      subdivided.push(_vA.clone());
    }
  }
  subdivided.push(localPts[localPts.length - 1].clone());
  for (let pass = 0; pass < 2; pass++) {
    for (let i = 1; i < subdivided.length - 1; i++) {
      _vB.copy(projectPointOntoTrueCargoSurface(subdivided[i], rPad, cargoType, dims, surfaceField, true));
      subdivided[i].copy(_vB);
    }
  }
  return subdivided;
}
