// @purpose: Dựng lưới 3D liền mạch chuẩn EN 1492-1 cho cáp bẹ dẹt 2 lớp (Webbing Sling), đầu khuyên thuôn bọc bạt chống mài mòn, chỉ may chữ X/zig-zag và tem xanh/trắng
import { computeWebSlingVisualSize } from './SlingPerfHelper.js';

// 10-point rounded-rectangle 2-ply fabric cross-section (unit width X = ±0.5, thickness Z = ±0.5)
const SECTION_PROFILE = [
  [-0.38,  0.50], [ 0.00,  0.54], [ 0.38,  0.50], [ 0.50,  0.24], [ 0.50, -0.24],
  [ 0.38, -0.50], [ 0.00, -0.54], [-0.38, -0.50], [-0.50, -0.24], [-0.50,  0.24]
];
const PROFILE_U = [0.12, 0.50, 0.88, 0.98, 0.98, 0.88, 0.50, 0.12, 0.02, 0.02];
const RING_VERTS = SECTION_PROFILE.length + 1; // +1 seam vertex so UV u wraps cleanly without back-smear

function fillQuadIndices(maxRings) {
  const indices = [];
  for (let r = 0; r < maxRings - 1; r++) {
    const rowA = r * RING_VERTS;
    const rowB = (r + 1) * RING_VERTS;
    for (let s = 0; s < SECTION_PROFILE.length; s++) {
      const a = rowA + s;
      const b = rowA + s + 1;
      const c = rowB + s;
      const d = rowB + s + 1;
      indices.push(a, c, b, b, c, d);
    }
  }
  return indices;
}

export function createContinuousWebRibbonMesh(THREE, material, maxRings = 48) {
  const rings = Math.max(8, maxRings | 0);
  const vertCount = rings * RING_VERTS;
  const positions = new Float32Array(vertCount * 3);
  const normals = new Float32Array(vertCount * 3);
  const uvs = new Float32Array(vertCount * 2);
  for (let r = 0; r < rings; r++) {
    for (let s = 0; s <= SECTION_PROFILE.length; s++) {
      const idx = r * RING_VERTS + s;
      uvs[idx * 2] = s < SECTION_PROFILE.length ? PROFILE_U[s] : 0.12;
      uvs[idx * 2 + 1] = r / (rings - 1);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geo.setAttribute('normal', new THREE.BufferAttribute(normals, 3));
  geo.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
  geo.setIndex(fillQuadIndices(rings));
  geo.setDrawRange(0, 0);

  const mesh = new THREE.Mesh(geo, material);
  mesh.name = 'Continuous_Webbing_Ribbon';
  mesh.castShadow = true;
  mesh.receiveShadow = false;
  mesh.frustumCulled = false;
  mesh.visible = false;
  mesh.userData._maxRings = rings;
  mesh.userData._scratch = {
    tan: new THREE.Vector3(),
    prevTan: new THREE.Vector3(),
    side: new THREE.Vector3(),
    norm: new THREE.Vector3(),
    rotQ: new THREE.Quaternion(),
    upY: new THREE.Vector3(0, 1, 0),
    pt: new THREE.Vector3(),
    trimmed: Array.from({ length: rings }, () => new THREE.Vector3())
  };
  return mesh;
}

function buildTrimmedSplinePoints(rawPts, eyeInsetA, eyeInsetB, outPts, maxRings) {
  const srcCount = Math.min(rawPts.length, maxRings);
  if (srcCount < 2) return 0;
  let total = 0;
  for (let i = 1; i < srcCount; i++) total += rawPts[i].distanceTo(rawPts[i - 1]);
  if (total < 1e-4) return 0;

  const startD = Math.min(total * 0.35, Math.max(0, eyeInsetA || 0));
  const endD = Math.max(startD + 0.02, total - Math.min(total * 0.35, Math.max(0, eyeInsetB || 0)));
  const spanD = endD - startD;
  const ringCount = Math.max(6, Math.min(maxRings, Math.max(srcCount, 18)));

  let segIdx = 1;
  let accPrev = 0;
  let accCur = rawPts[1].distanceTo(rawPts[0]);
  for (let r = 0; r < ringCount; r++) {
    const targetD = startD + (r / (ringCount - 1)) * spanD;
    while (segIdx < srcCount - 1 && accCur < targetD) {
      accPrev = accCur;
      segIdx++;
      accCur += rawPts[segIdx].distanceTo(rawPts[segIdx - 1]);
    }
    const segLen = Math.max(1e-6, accCur - accPrev);
    const alpha = Math.max(0, Math.min(1, (targetD - accPrev) / segLen));
    outPts[r].copy(rawPts[segIdx - 1]).lerp(rawPts[segIdx], alpha);
  }
  return ringCount;
}

export function updateWebRibbonMesh(THREE, mesh, rawPts, diaMm, opts = {}) {
  if (!mesh || !mesh.geometry || !rawPts || rawPts.length < 2) return false;
  const maxRings = mesh.userData._maxRings || 48;
  const sc = mesh.userData._scratch;
  const ringCount = buildTrimmedSplinePoints(
    rawPts,
    opts.hasEyeA ? (opts.eyeInsetM || 0.14) : 0,
    opts.hasEyeB ? (opts.eyeInsetM || 0.14) : 0,
    sc.trimmed,
    maxRings
  );
  if (ringCount < 2) return false;

  const { widthM, thickM } = computeWebSlingVisualSize(diaMm);
  const posArr = mesh.geometry.attributes.position.array;
  const normArr = mesh.geometry.attributes.normal.array;
  const uvArr = mesh.geometry.attributes.uv.array;
  const slackGain = Math.max(0, 1 - (opts.slackRatio != null ? opts.slackRatio : 1));
  const waveAmp = thickM * (0.18 + slackGain * 0.9);

  let arcM = 0;
  for (let r = 0; r < ringCount; r++) {
    const cur = sc.trimmed[r];
    if (r > 0) arcM += cur.distanceTo(sc.trimmed[r - 1]);
    if (r === 0) sc.tan.subVectors(sc.trimmed[1], cur);
    else if (r === ringCount - 1) sc.tan.subVectors(cur, sc.trimmed[r - 1]);
    else sc.tan.subVectors(sc.trimmed[r + 1], sc.trimmed[r - 1]);
    if (sc.tan.lengthSq() < 1e-10) sc.tan.copy(sc.upY);
    else sc.tan.normalize();

    if (r === 0) {
      sc.side.crossVectors(sc.tan, sc.upY);
      if (sc.side.lengthSq() < 1e-8) sc.side.set(1, 0, 0);
      sc.side.normalize();
      sc.norm.crossVectors(sc.side, sc.tan).normalize();
    } else {
      sc.rotQ.setFromUnitVectors(sc.prevTan, sc.tan);
      sc.side.applyQuaternion(sc.rotQ).normalize();
      sc.norm.crossVectors(sc.side, sc.tan).normalize();
      sc.side.crossVectors(sc.tan, sc.norm).normalize();
    }
    sc.prevTan.copy(sc.tan);

    const t = r / (ringCount - 1);
    const pinchA = opts.hasEyeA && t < 0.12 ? (t / 0.12) : 1.0;
    const pinchB = opts.hasEyeB && t > 0.88 ? ((1 - t) / 0.12) : 1.0;
    const endTaper = Math.min(pinchA, pinchB);
    const wRing = widthM * (0.58 + 0.42 * endTaper);
    const zRing = thickM * (1.42 - 0.42 * endTaper);
    const microWave = Math.sin(arcM * 18.0 + t * 6.283) * waveAmp * endTaper;
    const vCoord = arcM * 0.45;

    for (let s = 0; s <= SECTION_PROFILE.length; s++) {
      const pIdx = s < SECTION_PROFILE.length ? s : 0;
      const [px, pz] = SECTION_PROFILE[pIdx];
      const vIdx = r * RING_VERTS + s;
      const ox = px * wRing;
      const oz = pz * zRing + microWave;
      posArr[vIdx * 3] = cur.x + sc.side.x * ox + sc.norm.x * oz;
      posArr[vIdx * 3 + 1] = cur.y + sc.side.y * ox + sc.norm.y * oz;
      posArr[vIdx * 3 + 2] = cur.z + sc.side.z * ox + sc.norm.z * oz;

      const nx = sc.side.x * px + sc.norm.x * (pz * 1.8);
      const ny = sc.side.y * px + sc.norm.y * (pz * 1.8);
      const nz = sc.side.z * px + sc.norm.z * (pz * 1.8);
      const nLen = Math.hypot(nx, ny, nz) || 1;
      normArr[vIdx * 3] = nx / nLen;
      normArr[vIdx * 3 + 1] = ny / nLen;
      normArr[vIdx * 3 + 2] = nz / nLen;

      uvArr[vIdx * 2] = pIdx < PROFILE_U.length ? PROFILE_U[pIdx] : 0.12;
      uvArr[vIdx * 2 + 1] = vCoord;
    }
  }

  mesh.geometry.attributes.position.needsUpdate = true;
  mesh.geometry.attributes.normal.needsUpdate = true;
  mesh.geometry.attributes.uv.needsUpdate = true;
  mesh.geometry.setDrawRange(0, (ringCount - 1) * SECTION_PROFILE.length * 6);
  return true;
}

export function createEn1492WebEyeGroup(THREE, MATS) {
  const g = new THREE.Group();
  g.name = 'Synthetic_Web_Eye_Sleeve';

  // Pinched half-width folded becket eye (EN 1492-1): flat 2-ply ribbon arch narrowed at the eye
  const eyeCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(-0.015, 0.112, 0),
    new THREE.Vector3(-0.029, 0.056, 0),
    new THREE.Vector3( 0.000, -0.002, 0),
    new THREE.Vector3( 0.029, 0.056, 0),
    new THREE.Vector3( 0.015, 0.112, 0)
  ], false, 'centripetal', 0.35);
  const loopGeo = new THREE.TubeGeometry(eyeCurve, 28, 0.0072, 10, false);
  loopGeo.scale(1.0, 1.0, 0.62); // Flatten loop tube into folded fabric band
  const loop = new THREE.Mesh(loopGeo, MATS.webGreen);
  loop.name = 'Web_Eye_Loop';

  // Heavy-duty charcoal/black anti-abrasion protective canvas sleeve around the inner loop apex
  const sleeveCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(-0.027, 0.058, 0),
    new THREE.Vector3(-0.020, 0.018, 0),
    new THREE.Vector3( 0.000, -0.002, 0),
    new THREE.Vector3( 0.020, 0.018, 0),
    new THREE.Vector3( 0.027, 0.058, 0)
  ], false, 'centripetal', 0.35);
  const wearMat = new THREE.MeshStandardMaterial({ color: 0x222730, roughness: 0.96, metalness: 0.0 });
  const sleeveGeo = new THREE.TubeGeometry(sleeveCurve, 18, 0.0094, 10, false);
  sleeveGeo.scale(1.0, 1.0, 0.68);
  const wearSleeve = new THREE.Mesh(sleeveGeo, wearMat);
  wearSleeve.name = 'Web_Wear_Sleeve';

  // Tapered beveled transition collar (pinched eye neck -> full duplex strap width)
  const collarGeo = new THREE.CylinderGeometry(0.039, 0.026, 0.072, 12);
  collarGeo.scale(1.0, 1.0, 0.16);
  const cuff = new THREE.Mesh(collarGeo, MATS.webGreen);
  cuff.position.y = 0.140;
  cuff.name = 'Web_Cuff';

  // Box-cross + zig-zag industrial load-bearing stitch thread bars (visible front & back)
  const stitchMat = new THREE.MeshBasicMaterial({ color: 0xe2e8f0 });
  const addStitch = (w, h, y, rz) => {
    const bar = new THREE.Mesh(new THREE.BoxGeometry(w, h, 0.016), stitchMat);
    bar.position.y = y;
    bar.rotation.z = rz;
    g.add(bar);
  };
  addStitch(0.044, 0.0032, 0.136,  0.68);
  addStitch(0.044, 0.0032, 0.136, -0.68);
  addStitch(0.048, 0.0026, 0.114,  0.00);
  addStitch(0.056, 0.0026, 0.158,  0.00);
  addStitch(0.028, 0.0024, 0.126, -0.55);
  addStitch(0.028, 0.0024, 0.148,  0.55);

  // Folded blue/white industrial EN 1492-1 specification safety tag near eye neck
  const tagBlue = new THREE.MeshStandardMaterial({ color: 0x1d4ed8, roughness: 0.85, metalness: 0.0 });
  const tagWhite = new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.88, metalness: 0.0 });
  const tagCover = new THREE.Mesh(new THREE.BoxGeometry(0.032, 0.058, 0.0026), tagBlue);
  tagCover.position.set(0.036, 0.132, 0.003);
  tagCover.rotation.z = -0.24;
  const tagInsert = new THREE.Mesh(new THREE.BoxGeometry(0.026, 0.052, 0.0018), tagWhite);
  tagInsert.position.set(0.038, 0.134, 0.005);
  tagInsert.rotation.z = -0.24;

  g.add(loop, wearSleeve, cuff, tagCover, tagInsert);
  g.traverse(m => { if (m.isMesh) m.castShadow = true; });
  return g;
}
