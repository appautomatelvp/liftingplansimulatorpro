// @purpose: Lớp phủ SVG pattern chéo bán trong suốt (pointer-events: none) bảo vệ viewport 3D cho tài khoản Free & 24h Trial
import { getTrialState, hasProAccess } from './trial_access.js';

export function resolveWatermarkMode(profile, nowMs = Date.now()) {
  if (!profile) return 'free';
  const state = getTrialState(profile, nowMs);
  if (state.isPaidPro) return 'pro';
  if (state.inTrial) return 'trial';
  if (hasProAccess(profile, nowMs)) return 'pro';
  return 'free';
}

export function buildWatermarkSvgDataUrl(labelText = 'SAFELIFT3D.COM \u2022 L\u00ca VI\u1ec6T PH\u01af\u01a0NG') {
  const safe = String(labelText).replace(/[<>&"]/g, '');
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="380" height="220" viewBox="0 0 380 220"><g transform="rotate(-24 190 110)"><text x="190" y="114" text-anchor="middle" fill="#e2e8f0" fill-opacity="0.92" font-family="Segoe UI, Arial, sans-serif" font-weight="700" font-size="14" letter-spacing="1.4">${safe}</text></g></svg>`;
  return `url("data:image/svg+xml;utf8,${encodeURIComponent(svg)}")`;
}

export function syncViewportWatermark(profile, { doc = typeof document !== 'undefined' ? document : null, nowMs = Date.now() } = {}) {
  if (!doc || !doc.body) return { visible: false, mode: 'none' };
  const mode = resolveWatermarkMode(profile, nowMs);
  const existing = doc.getElementById('saas-viewport-watermark');
  if (mode === 'pro') {
    existing?.remove();
    return { visible: false, mode };
  }

  let layer = existing;
  if (!layer) {
    layer = doc.createElement('div');
    layer.id = 'saas-viewport-watermark';
    layer.className = 'saas-viewport-watermark';
    layer.setAttribute('aria-hidden', 'true');
    const host = doc.getElementById('canvas-wrap') || doc.getElementById('canvas-container') || doc.body;
    host.appendChild(layer);
  }
  layer.dataset.watermarkMode = mode;
  layer.style.backgroundImage = buildWatermarkSvgDataUrl();
  layer.style.opacity = mode === 'trial' ? '0.09' : '0.075';
  return { visible: true, mode };
}
