// @purpose: Sinh bản đồ PBR hao mòn công nghiệp (tôn sóng container, rỉ cạnh, bụi xước roughnessMap, cáp dầu mỡ & xích rèn nhám)
import { makeCanvas } from './ProceduralTextures.js';

function seededRand(seed) {
  let s = seed | 0;
  return () => {
    s = (s * 1664525 + 1013904223) | 0;
    return ((s >>> 0) % 10000) / 10000;
  };
}

/**
 * Generates corrugated container / heavy painted industrial steel PBR maps
 * with matte dust/scratch roughness, corrugated normal ribs, and edge wear + rust.
 */
export function drawCorrugatedContainerMaps(size = 512, paintHex = '#0369a1') {
  const cvsBase = makeCanvas(size, size), ctxBase = cvsBase.getContext('2d');
  const cvsNorm = makeCanvas(size, size), ctxNorm = cvsNorm.getContext('2d');
  const cvsRough = makeCanvas(size, size), ctxRough = cvsRough.getContext('2d');
  const cvsMetal = makeCanvas(size, size), ctxMetal = cvsMetal.getContext('2d');

  ctxBase.fillStyle = paintHex;
  ctxBase.fillRect(0, 0, size, size);
  ctxNorm.fillStyle = '#8080ff';
  ctxNorm.fillRect(0, 0, size, size);
  // Industrial weathered paint base roughness ~0.62 (no glossy plastic look)
  ctxRough.fillStyle = '#9e9e9e';
  ctxRough.fillRect(0, 0, size, size);
  ctxMetal.fillStyle = '#363636'; // ~0.21 paint film metalness
  ctxMetal.fillRect(0, 0, size, size);

  const rand = seededRand(7183);

  // Corrugated steel vertical ribs + subtle specular groove modulation
  const ribs = 16;
  const ribW = size / ribs;
  for (let i = 0; i < ribs; i++) {
    const x0 = i * ribW;
    ctxBase.fillStyle = 'rgba(0, 0, 0, 0.08)';
    ctxBase.fillRect(x0, 0, ribW * 0.22, size);
    ctxBase.fillStyle = 'rgba(255, 255, 255, 0.06)';
    ctxBase.fillRect(x0 + ribW * 0.45, 0, ribW * 0.2, size);

    ctxNorm.fillStyle = '#6280ff';
    ctxNorm.fillRect(x0, 0, ribW * 0.16, size);
    ctxNorm.fillStyle = '#9e80ff';
    ctxNorm.fillRect(x0 + ribW * 0.34, 0, ribW * 0.16, size);
  }

  // Grunge / dust / grime patches in roughness & color channels
  for (let i = 0; i < 140; i++) {
    const x = rand() * size;
    const y = rand() * size;
    const w = 10 + rand() * 38;
    const h = 6 + rand() * 24;
    const dusty = rand() > 0.35;
    ctxBase.fillStyle = dusty ? 'rgba(30, 27, 24, 0.09)' : 'rgba(148, 163, 184, 0.08)';
    ctxBase.fillRect(x, y, w, h);
    ctxRough.fillStyle = dusty ? 'rgba(216, 216, 216, 0.45)' : 'rgba(110, 110, 110, 0.40)';
    ctxRough.fillRect(x, y, w, h);
  }

  // Edge wear & light rust near borders and corner lug/seam bands
  const borderBand = Math.max(12, Math.round(size * 0.08));
  for (let i = 0; i < 110; i++) {
    const onEdge = rand() > 0.25;
    const x = onEdge && rand() > 0.5 ? (rand() > 0.5 ? rand() * borderBand : size - rand() * borderBand) : rand() * size;
    const y = onEdge ? (rand() > 0.5 ? rand() * borderBand : size - rand() * borderBand) : rand() * size;
    const sw = 3 + rand() * 14;
    const sh = 2 + rand() * 7;
    const isRust = rand() > 0.42;
    ctxBase.fillStyle = isRust ? 'rgba(124, 45, 18, 0.62)' : 'rgba(148, 163, 184, 0.55)';
    ctxBase.fillRect(x, y, sw, sh);
    ctxRough.fillStyle = isRust ? '#d2d2d2' : '#707070'; // rust matte ~0.82, scuffed metal ~0.44
    ctxRough.fillRect(x, y, sw, sh);
    ctxMetal.fillStyle = isRust ? '#202020' : '#d8d8d8'; // exposed steel metalness ~0.85
    ctxMetal.fillRect(x, y, sw, sh);
    ctxNorm.fillStyle = isRust ? '#7290ff' : '#9072ff';
    ctxNorm.fillRect(x, y, sw, sh);
  }

  return { cvsBase, cvsNorm, cvsRough, cvsMetal };
}

/**
 * Generates heavily lubricated dark graphite wire rope maps (high roughness, grease sheen).
 */
export function drawGreasedWireRopeMaps(size = 256) {
  const cvsBase = makeCanvas(size, size), ctxBase = cvsBase.getContext('2d');
  const cvsNorm = makeCanvas(size, size), ctxNorm = cvsNorm.getContext('2d');
  const cvsRough = makeCanvas(size, size), ctxRough = cvsRough.getContext('2d');

  ctxBase.fillStyle = '#272f3b'; // dark oil-stained steel core
  ctxBase.fillRect(0, 0, size, size);
  ctxNorm.fillStyle = '#8080ff';
  ctxNorm.fillRect(0, 0, size, size);
  ctxRough.fillStyle = '#929292'; // ~0.57 rough oil-grit film
  ctxRough.fillRect(0, 0, size, size);

  const rand = seededRand(3347);
  ctxNorm.lineWidth = 4;
  for (let i = -size; i < size * 2; i += 14) {
    ctxBase.strokeStyle = rand() > 0.5 ? '#3b4454' : '#1b212c';
    ctxBase.lineWidth = 5;
    ctxBase.beginPath(); ctxBase.moveTo(i, 0); ctxBase.lineTo(i + size * 0.65, size); ctxBase.stroke();

    ctxNorm.strokeStyle = '#6098ff';
    ctxNorm.beginPath(); ctxNorm.moveTo(i, 0); ctxNorm.lineTo(i + size * 0.65, size); ctxNorm.stroke();

    ctxRough.strokeStyle = rand() > 0.4 ? '#a6a6a6' : '#787878';
    ctxRough.lineWidth = 4;
    ctxRough.beginPath(); ctxRough.moveTo(i, 0); ctxRough.lineTo(i + size * 0.65, size); ctxRough.stroke();
  }
  return { cvsBase, cvsNorm, cvsRough };
}

/**
 * Generates matte forged alloy steel maps for Grade 80/100 chains (high metalness, rough scale).
 */
export function drawForgedChainMaps(size = 256) {
  const cvsBase = makeCanvas(size, size), ctxBase = cvsBase.getContext('2d');
  const cvsRough = makeCanvas(size, size), ctxRough = cvsRough.getContext('2d');
  ctxBase.fillStyle = '#373e4b';
  ctxBase.fillRect(0, 0, size, size);
  ctxRough.fillStyle = '#7e7e7e'; // ~0.49 matte forged steel roughness
  ctxRough.fillRect(0, 0, size, size);

  const rand = seededRand(8812);
  for (let i = 0; i < 90; i++) {
    const x = rand() * size;
    const y = rand() * size;
    ctxBase.fillStyle = rand() > 0.5 ? 'rgba(148,163,184,0.16)' : 'rgba(15,23,42,0.28)';
    ctxBase.fillRect(x, y, 4 + rand() * 10, 3 + rand() * 8);
    ctxRough.fillStyle = rand() > 0.5 ? '#969696' : '#646464';
    ctxRough.fillRect(x, y, 4 + rand() * 10, 3 + rand() * 8);
  }
  return { cvsBase, cvsRough };
}
