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

function drawSoftRadialSmudge(ctx, x, y, r, rgbStr, peakAlpha, size) {
  for (let ox = -1; ox <= 1; ox++) {
    for (let oy = -1; oy <= 1; oy++) {
      const cx = x + ox * size;
      const cy = y + oy * size;
      if (cx + r < 0 || cx - r > size || cy + r < 0 || cy - r > size) continue;
      const g = ctx.createRadialGradient(cx, cy, r * 0.05, cx, cy, r);
      g.addColorStop(0, `rgba(${rgbStr}, ${peakAlpha.toFixed(3)})`);
      g.addColorStop(0.5, `rgba(${rgbStr}, ${(peakAlpha * 0.4).toFixed(3)})`);
      g.addColorStop(1, `rgba(${rgbStr}, 0)`);
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

function drawSafeScratch(ctx, x0, y0, dx, dy, width, color) {
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(x0, y0);
  ctx.lineTo(x0 + dx, y0 + dy);
  ctx.stroke();
}

/**
 * Generates industrial painted steel beam PBR textures:
 * smooth matte enamel base with sparse, soft organic dust weathering and faint fine scuffs.
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
  ctxRough.fillStyle = '#a2a2a2'; // ~0.63 industrial semi-matte coat
  ctxRough.fillRect(0, 0, size, size);
  ctxMetal.fillStyle = '#2c2c2c'; // ~0.17 paint film metalness
  ctxMetal.fillRect(0, 0, size, size);

  const rand = seededRand(4219);
  // Sparse, soft radial weathering clouds (no sharp rectangular blocks)
  for (let m = 0; m < 10; m++) {
    const rx = rand() * size;
    const ry = rand() * size;
    const rr = size * (0.12 + rand() * 0.16);
    const dusty = m % 2 === 0;
    drawSoftRadialSmudge(ctxBase, rx, ry, rr, dusty ? '30, 35, 44' : '226, 232, 240', 0.055, size);
    drawSoftRadialSmudge(ctxRough, rx, ry, rr, dusty ? '210, 210, 210' : '128, 128, 128', 0.22, size);
  }
  // Only 6 faint rounded hairline scuffs
  for (let i = 0; i < 6; i++) {
    const x = rand() * size;
    const y = rand() * size;
    const dx = (rand() - 0.5) * (size * 0.24);
    const dy = (rand() - 0.5) * 10;
    const w = 1.0 + rand() * 0.8;
    drawSafeScratch(ctxBase, x, y, dx, dy, w, 'rgba(203, 213, 225, 0.24)');
    drawSafeScratch(ctxRough, x, y, dx, dy, w, 'rgba(84, 84, 84, 0.35)');
    drawSafeScratch(ctxMetal, x, y, dx, dy, w, 'rgba(210, 210, 210, 0.38)');
  }

  return { cvsBase, cvsNorm, cvsRough, cvsMetal };
}

/**
 * Generates forged galvanized steel textures for shackles, hooks, and master links (soft brushed grain, zero pixels).
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
  ctxRough.fillStyle = '#5a5a5a'; // ~0.35 brushed forged steel
  ctxRough.fillRect(0, 0, size, size);
  ctxMetal.fillStyle = '#dedede'; // ~0.87 metalness
  ctxMetal.fillRect(0, 0, size, size);

  const rand = seededRand(9001);
  for (let m = 0; m < 10; m++) {
    const x = rand() * size;
    const y = rand() * size;
    const r = size * (0.12 + rand() * 0.16);
    const bright = rand() > 0.5;
    drawSoftRadialSmudge(ctxBase, x, y, r, bright ? '203, 213, 225' : '71, 85, 105', 0.12, size);
    drawSoftRadialSmudge(ctxRough, x, y, r, bright ? '72, 72, 72' : '116, 116, 116', 0.22, size);
  }
  for (let i = 0; i < 14; i++) {
    const x = rand() * size;
    const y = rand() * size;
    const dx = 18 + rand() * 44;
    const bright = rand() > 0.5;
    drawSafeScratch(ctxBase, x, y, dx, (rand() - 0.5) * 3, 1.2, bright ? 'rgba(226, 232, 240, 0.18)' : 'rgba(51, 65, 85, 0.18)');
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
