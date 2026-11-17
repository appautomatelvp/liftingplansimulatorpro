// @purpose: Vẽ texture canvas thủ công (bê tông cảng, cáp thép, xích, sling, mặt nước, vạch cảnh báo)
export function makeCanvas(width, height) {
  if (typeof document !== 'undefined') {
    const cvs = document.createElement('canvas');
    cvs.width = width;
    cvs.height = height;
    return cvs;
  }
  const gradStub = { addColorStop: () => {} };
  return {
    width,
    height,
    getContext: () => ({
      fillStyle: '',
      strokeStyle: '',
      lineWidth: 1,
      globalAlpha: 1,
      globalCompositeOperation: 'source-over',
      fillRect: () => {},
      clearRect: () => {},
      strokeRect: () => {},
      beginPath: () => {},
      closePath: () => {},
      moveTo: () => {},
      lineTo: () => {},
      quadraticCurveTo: () => {},
      bezierCurveTo: () => {},
      arc: () => {},
      fill: () => {},
      stroke: () => {},
      save: () => {},
      restore: () => {},
      translate: () => {},
      scale: () => {},
      rotate: () => {},
      createLinearGradient: () => gradStub,
      createRadialGradient: () => gradStub,
      getImageData: () => ({ data: new Uint8ClampedArray(width * height * 4) }),
      putImageData: () => {}
    })
  };
}

function addStops(grad, stops) {
  stops.forEach(([offset, color]) => grad.addColorStop(offset, color));
  return grad;
}

function drawTileableBlotch(ctx, x, y, r, colorInner, colorOuter, size) {
  for (let ox = -1; ox <= 1; ox++) {
    for (let oy = -1; oy <= 1; oy++) {
      const cx = x + ox * size;
      const cy = y + oy * size;
      if (cx + r < 0 || cx - r > size || cy + r < 0 || cy - r > size) continue;
      const g = ctx.createRadialGradient(cx, cy, r * 0.1, cx, cy, r);
      g.addColorStop(0, colorInner);
      g.addColorStop(1, colorOuter);
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

export function drawQuayConcreteMaps(size = 1024, includeJoints = true) {
  const cvsBase = makeCanvas(size, size), ctxBase = cvsBase.getContext('2d');
  const cvsNorm = makeCanvas(size, size), ctxNorm = cvsNorm.getContext('2d');
  const cvsRough = makeCanvas(size, size), ctxRough = cvsRough.getContext('2d');
  const cvsAO = makeCanvas(size, size), ctxAO = cvsAO.getContext('2d');

  ctxBase.fillStyle = '#4e5662';
  ctxBase.fillRect(0, 0, size, size);
  ctxRough.fillStyle = 'rgb(218, 218, 218)';
  ctxRough.fillRect(0, 0, size, size);
  ctxAO.fillStyle = 'rgb(252, 252, 252)';
  ctxAO.fillRect(0, 0, size, size);

  // Subtle cured slab-to-slab tonal variation before adding trowel mottling
  const half = size * 0.5;
  if (includeJoints) {
    const slabShades = ['rgba(255,255,255,0.025)', 'rgba(15,23,42,0.035)', 'rgba(15,23,42,0.015)', 'rgba(255,255,255,0.018)'];
    [[0, 0], [half, 0], [0, half], [half, half]].forEach(([sx, sy], idx) => {
      ctxBase.fillStyle = slabShades[idx];
      ctxBase.fillRect(sx, sy, half, half);
    });
  }

  // Multi-scale weathered troweled concrete blotches & moisture stains (seamless tiling)
  for (let b = 0; b < 36; b++) {
    const bx = Math.random() * size;
    const by = Math.random() * size;
    const br = size * (0.06 + Math.random() * 0.14);
    const dark = b % 2 === 0;
    drawTileableBlotch(
      ctxBase, bx, by, br,
      dark ? 'rgba(30, 36, 46, 0.16)' : 'rgba(148, 163, 184, 0.12)',
      'rgba(0, 0, 0, 0)',
      size
    );
    drawTileableBlotch(
      ctxRough, bx, by, br,
      dark ? 'rgba(165, 165, 165, 0.35)' : 'rgba(240, 240, 240, 0.30)',
      'rgba(218, 218, 218, 0)',
      size
    );
  }

  // Coarse + fine mineral aggregate texture so concrete grain survives camera distance & mipmaps
  const imgData = ctxBase.getImageData(0, 0, size, size);
  const d = imgData.data;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const i = (y * size + x) * 4;
      const cell = (((x >> 2) * 73856093) ^ ((y >> 2) * 19349663)) & 31;
      const macro = (cell - 15.5) * 0.85;
      const fine = (Math.random() - 0.5) * 34;
      const delta = macro + fine;
      d[i] = Math.min(255, Math.max(0, d[i] + delta));
      d[i + 1] = Math.min(255, Math.max(0, d[i + 1] + delta));
      d[i + 2] = Math.min(255, Math.max(0, d[i + 2] + delta * 0.92));
    }
  }
  ctxBase.putImageData(imgData, 0, 0);

  // Micro-aggregate stone flecks & surface pits
  for (let k = 0; k < 520; k++) {
    const px = Math.random() * size;
    const py = Math.random() * size;
    const pr = 1.1 + Math.random() * 2.4;
    ctxBase.fillStyle = k % 3 === 0 ? 'rgba(203, 213, 225, 0.18)' : 'rgba(20, 25, 34, 0.22)';
    ctxBase.beginPath();
    ctxBase.arc(px, py, pr, 0, Math.PI * 2);
    ctxBase.fill();
  }

  ctxNorm.fillStyle = 'rgb(128, 128, 255)';
  ctxNorm.fillRect(0, 0, size, size);
  const normData = ctxNorm.getImageData(0, 0, size, size);
  const nd = normData.data;
  for (let i = 0; i < nd.length; i += 4) {
    nd[i] = Math.min(255, Math.max(0, 128 + (Math.random() - 0.5) * 26));
    nd[i + 1] = Math.min(255, Math.max(0, 128 + (Math.random() - 0.5) * 26));
    nd[i + 2] = 255;
  }
  ctxNorm.putImageData(normData, 0, 0);

  if (includeJoints) {
    const joints = [0, half, size - 1];
    joints.forEach((p) => {
      ctxBase.fillStyle = '#232a34';
      ctxBase.fillRect(p - 2, 0, 4, size);
      ctxBase.fillRect(0, p - 2, size, 4);
      ctxBase.fillStyle = 'rgba(148, 163, 184, 0.18)';
      ctxBase.fillRect(p + 2, 0, 2, size);
      ctxBase.fillRect(0, p + 2, size, 2);
      ctxNorm.fillStyle = 'rgb(88, 128, 255)'; ctxNorm.fillRect(p - 3, 0, 3, size);
      ctxNorm.fillStyle = 'rgb(168, 128, 255)'; ctxNorm.fillRect(p, 0, 3, size);
      ctxNorm.fillStyle = 'rgb(128, 88, 255)'; ctxNorm.fillRect(0, p - 3, size, 3);
      ctxNorm.fillStyle = 'rgb(128, 168, 255)'; ctxNorm.fillRect(0, p, size, 3);
      ctxRough.fillStyle = 'rgb(100, 100, 100)';
      ctxRough.fillRect(p - 3, 0, 6, size);
      ctxRough.fillRect(0, p - 3, size, 6);
      ctxAO.fillStyle = 'rgb(115, 115, 115)';
      ctxAO.fillRect(p - 4, 0, 8, size);
      ctxAO.fillRect(0, p - 4, size, 8);
    });
  }
  return { cvsBase, cvsNorm, cvsRough, cvsAO };
}

export function drawWireRopeMaps(size = 512) {
  const cvsBase = makeCanvas(size, size), ctxBase = cvsBase.getContext('2d');
  const cvsNorm = makeCanvas(size, size), ctxNorm = cvsNorm.getContext('2d');
  const cvsRough = makeCanvas(size, size), ctxRough = cvsRough.getContext('2d');

  ctxBase.fillStyle = '#6e7885'; ctxBase.fillRect(0, 0, size, size);
  ctxNorm.fillStyle = 'rgb(128, 128, 255)'; ctxNorm.fillRect(0, 0, size, size);
  ctxRough.fillStyle = 'rgb(65, 65, 65)'; ctxRough.fillRect(0, 0, size, size);

  const strandCount = 6;
  const strandW = size / strandCount;
  const fillBand = (ctx, style, y0, y1) => {
    ctx.fillStyle = style;
    ctx.beginPath();
    ctx.moveTo(0, y0);
    ctx.lineTo(size, y1);
    ctx.lineTo(size, y1 + strandW);
    ctx.lineTo(0, y0 + strandW);
    ctx.fill();
  };

  for (let i = 0; i < strandCount * 2; i++) {
    const y0 = i * strandW, y1 = (i - 1) * strandW;
    fillBand(ctxBase, addStops(ctxBase.createLinearGradient(0, y0, size, y1), [[0.0, '#221f1d'], [0.25, '#7f8b9b'], [0.5, '#6b7583'], [0.75, '#8a96a6'], [1.0, '#221f1d']]), y0, y1);
    fillBand(ctxNorm, addStops(ctxNorm.createLinearGradient(0, y0, size, y1), [[0.0, 'rgb(60, 128, 230)'], [0.5, 'rgb(128, 128, 255)'], [1.0, 'rgb(195, 128, 230)']]), y0, y1);
    fillBand(ctxRough, addStops(ctxRough.createLinearGradient(0, y0, size, y1), [[0.0, 'rgb(160, 160, 160)'], [0.5, 'rgb(60, 60, 60)'], [1.0, 'rgb(160, 160, 160)']]), y0, y1);
  }
  return { cvsBase, cvsNorm, cvsRough };
}

export function drawChainAlloyCanvas(size = 256) {
  const cvsBase = makeCanvas(size, size), ctxBase = cvsBase.getContext('2d');
  ctxBase.fillStyle = '#2b303a';
  ctxBase.fillRect(0, 0, size, size);
  ctxBase.fillStyle = addStops(ctxBase.createLinearGradient(0, 0, size, size), [[0.0, '#788496'], [0.3, '#2a2e37'], [0.7, '#24272f'], [1.0, '#788496']]);
  ctxBase.fillRect(0, 0, size, size);
  return cvsBase;
}

export function drawWebSlingMaps(size = 1024, colorHex = '#16a34a', stripeCount = 2) {
  const cvsBase = makeCanvas(size, size), ctxBase = cvsBase.getContext('2d');
  const cvsNorm = makeCanvas(size, size), ctxNorm = cvsNorm.getContext('2d');
  ctxBase.fillStyle = colorHex;
  ctxBase.fillRect(0, 0, size, size);
  const edgeW = Math.round(size * 0.08);
  ctxBase.fillStyle = 'rgba(0, 0, 0, 0.14)';
  ctxBase.fillRect(0, 0, edgeW, size);
  ctxBase.fillRect(size - edgeW, 0, edgeW, size);
  for (let i = 0; i < 36; i++) {
    const sx = (Math.sin(i * 19.3) * 0.5 + 0.5) * size, sy = (Math.cos(i * 31.7) * 0.5 + 0.5) * size, r = size * (0.04 + (i % 5) * 0.016);
    ctxBase.fillStyle = addStops(ctxBase.createRadialGradient(sx, sy, 0, sx, sy, r), [[0, i % 2 ? 'rgba(255,255,255,0.04)' : 'rgba(15,23,42,0.07)'], [1, 'rgba(0,0,0,0)']]);
    ctxBase.fillRect(sx - r, sy - r, r * 2, r * 2);
  }
  const step = Math.max(4, Math.round(size / 128));
  ctxNorm.fillStyle = 'rgb(128, 128, 255)';
  ctxNorm.fillRect(0, 0, size, size);
  for (let y = 0; y < size; y += step) {
    const even = ((y / step) | 0) % 2 === 0;
    ctxBase.fillStyle = even ? 'rgba(255,255,255,0.085)' : 'rgba(0,0,0,0.075)';
    for (let x = 0; x < size; x += step * 2) ctxBase.fillRect(even ? x : x + step, y, step, Math.max(2, step >> 1));
    ctxNorm.fillStyle = 'rgb(112,128,255)'; ctxNorm.fillRect(0, y, size, Math.max(1, step >> 2));
    ctxNorm.fillStyle = 'rgb(144,128,255)'; ctxNorm.fillRect(0, y + (step >> 1), size, Math.max(1, step >> 2));
  }
  ctxNorm.fillStyle = 'rgb(128,114,255)';
  for (let x = 0; x < size; x += step * 2) ctxNorm.fillRect(x, 0, Math.max(1, step >> 2), size);
  const sCount = stripeCount == null ? 2 : Math.max(0, Math.min(12, stripeCount | 0));
  if (sCount > 0) {
    const span = size * 0.62, x0 = (size - span) * 0.5, sw = Math.max(4, Math.round(size * (sCount >= 8 ? 0.014 : 0.020)));
    ctxBase.fillStyle = '#0f172a';
    for (let s = 0; s < sCount; s++) ctxBase.fillRect(Math.round(x0 + ((s + 0.5) / sCount) * span - sw * 0.5), 0, sw, size);
  }
  ctxBase.fillStyle = 'rgba(241, 245, 249, 0.72)';
  for (const fx of [0.16, 0.24, 0.76, 0.84]) {
    for (let y = 0; y < size; y += step * 3) ctxBase.fillRect(Math.round(size * fx), y, Math.max(2, Math.round(size * 0.005)), Math.round(step * 1.8));
  }
  return { cvsBase, cvsNorm };
}

export function drawRoundSlingMaps(size = 512, colorHex = '#2563eb') {
  const cvsBase = makeCanvas(size, size), ctxBase = cvsBase.getContext('2d');
  const cvsNorm = makeCanvas(size, size), ctxNorm = cvsNorm.getContext('2d');
  ctxBase.fillStyle = colorHex; ctxBase.fillRect(0, 0, size, size);
  for (let y = 0; y < size; y += 24) {
    ctxBase.fillStyle = addStops(ctxBase.createLinearGradient(0, y, 0, y + 24), [[0.0, 'rgba(0, 0, 0, 0.18)'], [0.45, 'rgba(255, 255, 255, 0.12)'], [1.0, 'rgba(0, 0, 0, 0.18)']]);
    ctxBase.fillRect(0, y, size, 24);
  }
  ctxNorm.fillStyle = 'rgb(128, 128, 255)'; ctxNorm.fillRect(0, 0, size, size);
  for (let y = 0; y < size; y += 24) {
    ctxNorm.fillStyle = 'rgb(128, 105, 255)'; ctxNorm.fillRect(0, y, size, 6);
    ctxNorm.fillStyle = 'rgb(128, 150, 255)'; ctxNorm.fillRect(0, y + 12, size, 6);
  }
  return { cvsBase, cvsNorm };
}

export function drawMaritimeWaterNormalCanvas(size = 512) {
  const cvs = makeCanvas(size, size), ctx = cvs.getContext('2d');
  const img = ctx.getImageData(0, 0, size, size), d = img.data;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const idx = (y * size + x) * 4;
      const nx = Math.sin(x * 0.12) * Math.cos(y * 0.08) * 0.5 + Math.sin((x + y) * 0.22) * 0.3;
      const ny = Math.cos(x * 0.09) * Math.sin(y * 0.14) * 0.5 + Math.cos((x - y) * 0.25) * 0.3;
      d[idx] = Math.floor((nx * 0.5 + 0.5) * 255);
      d[idx + 1] = Math.floor((ny * 0.5 + 0.5) * 255);
      d[idx + 2] = 245;
      d[idx + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  return cvs;
}

export function drawHazardChevronCanvas(size = 512, repeats = 4) {
  const cvs = makeCanvas(size, size), ctx = cvs.getContext('2d');
  ctx.fillStyle = '#eab308'; ctx.fillRect(0, 0, size, size);
  ctx.fillStyle = '#0f172a';
  const stripeWidth = size / (repeats * 2);
  for (let x = -size; x < size * 2; x += stripeWidth * 2) {
    ctx.beginPath();
    ctx.moveTo(x, 0); ctx.lineTo(x + stripeWidth, 0);
    ctx.lineTo(x + stripeWidth - size, size); ctx.lineTo(x - size, size);
    ctx.fill();
  }
  return cvs;
}
