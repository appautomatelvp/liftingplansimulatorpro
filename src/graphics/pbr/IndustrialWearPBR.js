// @purpose: Sinh bản đồ PBR hao mòn công nghiệp mềm mại (radial gradient loang tự nhiên, không ô vuông thô)
import { makeCanvas } from './ProceduralTextures.js';

function seededRand(seed) {
  let s = seed | 0;
  return () => {
    s = (s * 1664525 + 1013904223) | 0;
    return ((s >>> 0) % 10000) / 10000;
  };
}

/**
 * Draws a soft, seamless tile-wrapped elliptical patina cloud that fades smoothly
 * to 0 alpha at its perimeter (eliminating all hard rectangular edges).
 */
function drawSoftPatinaCloud(ctx, x, y, rx, ry, rotRad, rgbStr, peakAlpha, tileSize) {
  for (let ox = -1; ox <= 1; ox++) {
    for (let oy = -1; oy <= 1; oy++) {
      const cx = x + ox * tileSize;
      const cy = y + oy * tileSize;
      const maxR = Math.max(rx, ry);
      if (cx + maxR < 0 || cx - maxR > tileSize || cy + maxR < 0 || cy - maxR > tileSize) continue;
      ctx.save();
      ctx.translate(cx, cy);
      if (rotRad) ctx.rotate(rotRad);
      ctx.scale(1, Math.max(0.25, ry / Math.max(1, rx)));
      const g = ctx.createRadialGradient(0, 0, rx * 0.05, 0, 0, rx);
      g.addColorStop(0, `rgba(${rgbStr}, ${peakAlpha.toFixed(3)})`);
      g.addColorStop(0.45, `rgba(${rgbStr}, ${(peakAlpha * 0.42).toFixed(3)})`);
      g.addColorStop(0.78, `rgba(${rgbStr}, ${(peakAlpha * 0.12).toFixed(3)})`);
      g.addColorStop(1, `rgba(${rgbStr}, 0)`);
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(0, 0, rx, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }
}

/**
 * Generates corrugated container / heavy painted industrial steel PBR maps
 * with smooth rolled steel ribs and sparse, soft organic weathering & patina.
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
  ctxRough.fillStyle = '#a2a2a2'; // ~0.63 satin-matte weathered marine enamel
  ctxRough.fillRect(0, 0, size, size);
  ctxMetal.fillStyle = '#383838'; // ~0.22 painted steel
  ctxMetal.fillRect(0, 0, size, size);

  // Smooth linear-gradient corrugation ribs (no harsh stripe blocks)
  const ribs = 16;
  const ribW = size / ribs;
  for (let i = 0; i < ribs; i++) {
    const x0 = i * ribW;
    const gBase = ctxBase.createLinearGradient(x0, 0, x0 + ribW, 0);
    gBase.addColorStop(0.0, 'rgba(0, 0, 0, 0.08)');
    gBase.addColorStop(0.32, 'rgba(0, 0, 0, 0.0)');
    gBase.addColorStop(0.55, 'rgba(255, 255, 255, 0.05)');
    gBase.addColorStop(0.85, 'rgba(0, 0, 0, 0.03)');
    gBase.addColorStop(1.0, 'rgba(0, 0, 0, 0.08)');
    ctxBase.fillStyle = gBase;
    ctxBase.fillRect(x0, 0, ribW, size);

    const gNorm = ctxNorm.createLinearGradient(x0, 0, x0 + ribW, 0);
    gNorm.addColorStop(0.0, '#6a80ff');
    gNorm.addColorStop(0.28, '#8080ff');
    gNorm.addColorStop(0.58, '#9680ff');
    gNorm.addColorStop(0.85, '#8080ff');
    gNorm.addColorStop(1.0, '#6a80ff');
    ctxNorm.fillStyle = gNorm;
    ctxNorm.fillRect(x0, 0, ribW, size);
  }

  // Sparse, soft multi-toned salt-spray / grime / sun-fade clouds (natural gradient mottling)
  const rand = seededRand(7183);
  for (let i = 0; i < 12; i++) {
    const x = rand() * size;
    const y = rand() * size;
    const rx = size * (0.10 + rand() * 0.16);
    const ry = size * (0.06 + rand() * 0.11);
    const rot = (rand() - 0.5) * 1.4;
    const lightFade = rand() > 0.55;
    drawSoftPatinaCloud(ctxBase, x, y, rx, ry, rot, lightFade ? '210, 220, 232' : '22, 26, 34', lightFade ? 0.065 : 0.075, size);
    drawSoftPatinaCloud(ctxRough, x, y, rx, ry, rot, lightFade ? '218, 218, 218' : '125, 125, 125', 0.24, size);
  }

  // Subtle soft oxide / sea-air patina near bottom/top structural frame seams (only 6 clouds, gentle fade)
  for (let i = 0; i < 6; i++) {
    const x = rand() * size;
    const y = rand() > 0.5 ? rand() * (size * 0.12) : size - rand() * (size * 0.12);
    const rx = size * (0.07 + rand() * 0.09);
    const ry = size * (0.035 + rand() * 0.045);
    const isRust = rand() > 0.45;
    drawSoftPatinaCloud(ctxBase, x, y, rx, ry, 0, isRust ? '120, 53, 28' : '148, 163, 184', 0.16, size);
    drawSoftPatinaCloud(ctxRough, x, y, rx, ry, 0, isRust ? '220, 220, 220' : '115, 115, 115', 0.30, size);
    drawSoftPatinaCloud(ctxMetal, x, y, rx, ry, 0, isRust ? '30, 30, 30' : '185, 185, 185', 0.28, size);
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

  ctxBase.fillStyle = '#272f3b';
  ctxBase.fillRect(0, 0, size, size);
  ctxNorm.fillStyle = '#8080ff';
  ctxNorm.fillRect(0, 0, size, size);
  ctxRough.fillStyle = '#929292';
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
 * Generates matte forged alloy steel maps for Grade 80/100 chains with soft patina blooms.
 */
export function drawForgedChainMaps(size = 256) {
  const cvsBase = makeCanvas(size, size), ctxBase = cvsBase.getContext('2d');
  const cvsRough = makeCanvas(size, size), ctxRough = cvsRough.getContext('2d');
  ctxBase.fillStyle = '#3b424f';
  ctxBase.fillRect(0, 0, size, size);
  ctxRough.fillStyle = '#848484';
  ctxRough.fillRect(0, 0, size, size);

  const rand = seededRand(8812);
  for (let i = 0; i < 12; i++) {
    const x = rand() * size;
    const y = rand() * size;
    const rx = size * (0.09 + rand() * 0.14);
    const ry = size * (0.07 + rand() * 0.11);
    const light = rand() > 0.5;
    drawSoftPatinaCloud(ctxBase, x, y, rx, ry, rand() * Math.PI, light ? '148, 163, 184' : '15, 23, 42', 0.14, size);
    drawSoftPatinaCloud(ctxRough, x, y, rx, ry, rand() * Math.PI, light ? '160, 160, 160' : '102, 102, 102', 0.24, size);
  }
  return { cvsBase, cvsRough };
}

/**
 * Generates organic rough-sawn hardwood timber maps (wavy wood grain curves & soft radial knots).
 */
export function drawTimberWoodMaps(size = 256, woodHex = '#8b5a2b') {
  const cvsBase = makeCanvas(size, size), ctxBase = cvsBase.getContext('2d');
  const cvsNorm = makeCanvas(size, size), ctxNorm = cvsNorm.getContext('2d');
  const cvsRough = makeCanvas(size, size), ctxRough = cvsRough.getContext('2d');

  ctxBase.fillStyle = woodHex;
  ctxBase.fillRect(0, 0, size, size);
  ctxNorm.fillStyle = '#8080ff';
  ctxNorm.fillRect(0, 0, size, size);
  ctxRough.fillStyle = '#d6d6d6';
  ctxRough.fillRect(0, 0, size, size);

  const rand = seededRand(5123);
  for (let i = 0; i < 10; i++) {
    drawSoftPatinaCloud(ctxBase, rand() * size, rand() * size, size * 0.25, size * 0.08, 0, rand() > 0.5 ? '42, 24, 10' : '212, 168, 118', 0.11, size);
  }
  // Gently wavy longitudinal wood grain fibers
  for (let i = 0; i < 28; i++) {
    const y = (i / 28) * size + (rand() - 0.5) * 4;
    const wave = (rand() - 0.5) * 9;
    const dark = rand() > 0.42;
    ctxBase.strokeStyle = dark ? 'rgba(42, 24, 10, 0.20)' : 'rgba(222, 184, 135, 0.12)';
    ctxBase.lineWidth = 1.2 + rand() * 1.8;
    ctxBase.beginPath();
    ctxBase.moveTo(0, y);
    ctxBase.quadraticCurveTo(size * 0.5, y + wave, size, y);
    ctxBase.stroke();

    ctxNorm.strokeStyle = dark ? '#8070ff' : '#8090ff';
    ctxNorm.lineWidth = 1.5;
    ctxNorm.beginPath();
    ctxNorm.moveTo(0, y);
    ctxNorm.quadraticCurveTo(size * 0.5, y + wave, size, y);
    ctxNorm.stroke();
  }
  // Subtle wood knots & soft plank dividers
  for (let k = 0; k < 2; k++) {
    drawSoftPatinaCloud(ctxBase, rand() * size, rand() * size, 16 + rand() * 10, 6 + rand() * 4, 0.1, '35, 18, 8', 0.24, size);
  }
  for (let p = 1; p < 3; p++) {
    const py = Math.round((p / 3) * size);
    ctxBase.fillStyle = 'rgba(20, 12, 6, 0.24)';
    ctxBase.fillRect(0, py, size, 1.5);
  }
  return { cvsBase, cvsNorm, cvsRough };
}

/**
 * Generates woven matte tarpaulin / canvas cover maps with subtle organic dust & fold shading.
 */
export function drawCanvasTarpMaps(size = 256, tintHex = '#e2e8f0') {
  const cvsBase = makeCanvas(size, size), ctxBase = cvsBase.getContext('2d');
  const cvsNorm = makeCanvas(size, size), ctxNorm = cvsNorm.getContext('2d');
  const cvsRough = makeCanvas(size, size), ctxRough = cvsRough.getContext('2d');

  ctxBase.fillStyle = tintHex;
  ctxBase.fillRect(0, 0, size, size);
  ctxNorm.fillStyle = '#8080ff';
  ctxNorm.fillRect(0, 0, size, size);
  ctxRough.fillStyle = '#dedede';
  ctxRough.fillRect(0, 0, size, size);

  const rand = seededRand(6109);
  for (let i = 0; i < 6; i++) {
    drawSoftPatinaCloud(ctxBase, rand() * size, rand() * size, size * 0.22, size * 0.14, rand() * Math.PI, '100, 116, 139', 0.05, size);
    drawSoftPatinaCloud(ctxRough, rand() * size, rand() * size, size * 0.22, size * 0.14, rand() * Math.PI, '235, 235, 235', 0.18, size);
  }
  const step = 8;
  for (let i = 0; i < size; i += step) {
    ctxBase.fillStyle = 'rgba(15, 23, 42, 0.035)';
    ctxBase.fillRect(i, 0, 1.5, size);
    ctxBase.fillRect(0, i, size, 1.5);
    ctxNorm.fillStyle = '#7888ff';
    ctxNorm.fillRect(i, 0, 1.5, size);
    ctxNorm.fillStyle = '#8878ff';
    ctxNorm.fillRect(0, i, size, 1.5);
  }
  return { cvsBase, cvsNorm, cvsRough };
}
