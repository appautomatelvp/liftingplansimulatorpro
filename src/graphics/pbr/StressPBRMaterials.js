// @purpose: Tạo bản đồ PBR thép sơn công nghiệp, thép rèn mạ kẽm và màu ứng suất căng cơ học thời gian thực
import * as THREE from 'three';
import { makeCanvas } from './ProceduralTextures.js';

function seededRand(seed) {
  let s = seed | 0;
  return () => {
    s = (s * 1664525 + 1013904223) | 0;
    return ((s >>> 0) % 10000) / 10000;
  };
}

function drawSafeScratch(ctx, x0, y0, dx, dy, width, color) {
  ctx.fillStyle = color;
  const steps = Math.max(4, Math.ceil(Math.hypot(dx, dy) / 2));
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    ctx.fillRect(x0 + dx * t, y0 + dy * t, width, width);
  }
}

/**
 * Generates industrial painted steel beam PBR textures:
 * matte paint base (low metalness, higher roughness) with exposed shiny steel edge scratches.
 */
export function drawPaintedSteelMaps(size = 256, paintHex = '#d97706') {
  const cvsBase = makeCanvas(size, size), ctxBase = cvsBase.getContext('2d');
  const cvsNorm = makeCanvas(size, size), ctxNorm = cvsNorm.getContext('2d');
  const cvsRough = makeCanvas(size, size), ctxRough = cvsRough.getContext('2d');
  const cvsMetal = makeCanvas(size, size), ctxMetal = cvsMetal.getContext('2d');

  ctxBase.fillStyle = paintHex;
  ctxBase.fillRect(0, 0, size, size);
  ctxNorm.fillStyle = '#8080ff';
  ctxNorm.fillRect(0, 0, size, size);
  ctxRough.fillStyle = '#757575'; // ~0.46 paint roughness
  ctxRough.fillRect(0, 0, size, size);
  ctxMetal.fillStyle = '#282828'; // ~0.16 paint metalness
  ctxMetal.fillRect(0, 0, size, size);

  const rand = seededRand(4219);
  for (let i = 0; i < 36; i++) {
    const x = rand() * size;
    const y = rand() * size;
    const dx = (rand() - 0.5) * (size * 0.35);
    const dy = (rand() - 0.5) * 14;
    const w = 1 + rand() * 2;
    drawSafeScratch(ctxBase, x, y, dx, dy, w, '#cbd5e1');
    drawSafeScratch(ctxNorm, x, y, dx, dy, w, '#6890ff');
    drawSafeScratch(ctxRough, x, y, dx, dy, w, '#383838'); // ~0.22 exposed bare steel roughness
    drawSafeScratch(ctxMetal, x, y, dx, dy, w, '#e6e6e6'); // ~0.90 exposed bare steel metalness
  }

  return { cvsBase, cvsNorm, cvsRough, cvsMetal };
}

/**
 * Generates forged galvanized steel textures for shackles, hooks, and master links.
 */
export function drawForgedSteelMaps(size = 256) {
  const cvsBase = makeCanvas(size, size), ctxBase = cvsBase.getContext('2d');
  const cvsNorm = makeCanvas(size, size), ctxNorm = cvsNorm.getContext('2d');
  const cvsRough = makeCanvas(size, size), ctxRough = cvsRough.getContext('2d');
  const cvsMetal = makeCanvas(size, size), ctxMetal = cvsMetal.getContext('2d');

  ctxBase.fillStyle = '#94a3b8';
  ctxBase.fillRect(0, 0, size, size);
  ctxNorm.fillStyle = '#8080ff';
  ctxNorm.fillRect(0, 0, size, size);
  ctxRough.fillStyle = '#4a4a4a'; // ~0.29 brushed forged steel
  ctxRough.fillRect(0, 0, size, size);
  ctxMetal.fillStyle = '#e0e0e0'; // ~0.88 metalness
  ctxMetal.fillRect(0, 0, size, size);

  const rand = seededRand(9001);
  for (let i = 0; i < 64; i++) {
    const x = rand() * size;
    const y = rand() * size;
    const s = 3 + rand() * 10;
    const bright = rand() > 0.5;
    ctxBase.fillStyle = bright ? '#cbd5e1' : '#64748b';
    ctxBase.fillRect(x, y, s, 2);
    ctxNorm.fillStyle = bright ? '#9278ff' : '#708aff';
    ctxNorm.fillRect(x, y, s, 2);
    ctxRough.fillStyle = bright ? '#3a3a3a' : '#5e5e5e';
    ctxRough.fillRect(x, y, s, 2);
  }

  return { cvsBase, cvsNorm, cvsRough, cvsMetal };
}

/**
 * Computes real-time mechanical stress shading parameters relative to Safe Working Load (SWL).
 */
export function computeMechanicalStressVisual(tensionT = 0, swlT = 15, mblT = null) {
  const safeSwl = Math.max(0.05, Number.isFinite(swlT) ? swlT : 15);
  const safeT = Math.max(0, Number.isFinite(tensionT) ? tensionT : 0);
  const ratio = safeT / safeSwl;

  if (ratio < 0.70) {
    return { ratio, zone: 'safe', blendAmount: 0, tintHex: null, emissiveHex: 0x000000, emissiveIntensity: 0 };
  }
  if (ratio < 1.0) {
    const k = THREE.MathUtils.clamp((ratio - 0.70) / 0.30, 0, 1);
    return {
      ratio,
      zone: 'warning',
      blendAmount: THREE.MathUtils.lerp(0.20, 0.55, k),
      tintHex: 0xf59e0b,
      emissiveHex: 0xd97706,
      emissiveIntensity: THREE.MathUtils.lerp(0.12, 0.35, k)
    };
  }
  const mblRatio = mblT && mblT > safeSwl ? THREE.MathUtils.clamp((safeT - safeSwl) / (mblT - safeSwl), 0, 1) : 1;
  return {
    ratio,
    zone: 'overload',
    blendAmount: THREE.MathUtils.lerp(0.60, 0.90, mblRatio),
    tintHex: 0xef4444,
    emissiveHex: 0xdc2626,
    emissiveIntensity: THREE.MathUtils.lerp(0.45, 0.95, mblRatio)
  };
}

/**
 * Returns an untainted baseMat below 70% SWL, or a cached quantized material clone tinted for strain.
 */
export function resolveStressTintedMaterial(baseMat, tensionT = 0, swlT = 15, cacheMap = null) {
  if (!baseMat) return baseMat;
  const stress = computeMechanicalStressVisual(tensionT, swlT);
  if (stress.zone === 'safe' || !stress.tintHex) return baseMat;

  const bucket = Math.min(20, Math.round(stress.ratio * 20));
  const key = `${baseMat.uuid}_${stress.zone}_${bucket}`;
  if (cacheMap && cacheMap.has(key)) return cacheMap.get(key);

  const tinted = baseMat.clone();
  const baseCol = baseMat.color ? baseMat.color.clone() : new THREE.Color(0x94a3b8);
  tinted.color = baseCol.lerp(new THREE.Color(stress.tintHex), stress.blendAmount);
  if ('emissive' in tinted) {
    tinted.emissive = new THREE.Color(stress.emissiveHex);
    tinted.emissiveIntensity = stress.emissiveIntensity;
  }
  if (cacheMap) cacheMap.set(key, tinted);
  return tinted;
}
