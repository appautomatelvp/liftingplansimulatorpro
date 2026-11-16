// @purpose: Điều chỉnh và lưu độ sáng tối (Brightness) và tương phản (Contrast) cho khung hình 3D như game
export const GFX_TONE_STORAGE_KEY = 'safelift_gfx_tone_v1';

export const DEFAULT_TONE_SETTINGS = Object.freeze({
  brightness: 1.0,
  contrast: 1.0
});

export const TONE_LIMITS = Object.freeze({
  minBrightness: 0.5,
  maxBrightness: 1.8,
  minContrast: 0.6,
  maxContrast: 1.8
});

function clampNum(val, min, max, fallback) {
  const n = Number(val);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, n));
}

export function clampToneSettings(input = {}) {
  return {
    brightness: Number(clampNum(input.brightness, TONE_LIMITS.minBrightness, TONE_LIMITS.maxBrightness, 1.0).toFixed(2)),
    contrast: Number(clampNum(input.contrast, TONE_LIMITS.minContrast, TONE_LIMITS.maxContrast, 1.0).toFixed(2))
  };
}

export function buildCanvasFilterCss(settings = DEFAULT_TONE_SETTINGS) {
  const s = clampToneSettings(settings);
  if (Math.abs(s.brightness - 1.0) < 0.005 && Math.abs(s.contrast - 1.0) < 0.005) {
    return 'none';
  }
  return `brightness(${s.brightness.toFixed(2)}) contrast(${s.contrast.toFixed(2)})`;
}

export function applyToneSettingsToCanvas(canvas, settings) {
  const normalized = clampToneSettings(settings);
  if (canvas && canvas.style) {
    canvas.style.filter = buildCanvasFilterCss(normalized);
  }
  return normalized;
}

export function loadSavedToneSettings() {
  try {
    if (typeof localStorage === 'undefined') return { ...DEFAULT_TONE_SETTINGS };
    const raw = localStorage.getItem(GFX_TONE_STORAGE_KEY);
    if (!raw) return { ...DEFAULT_TONE_SETTINGS };
    return clampToneSettings(JSON.parse(raw));
  } catch (_) {
    return { ...DEFAULT_TONE_SETTINGS };
  }
}

export function saveToneSettings(settings) {
  const normalized = clampToneSettings(settings);
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(GFX_TONE_STORAGE_KEY, JSON.stringify(normalized));
    }
  } catch (_) { /* ignore quota / private mode */ }
  return normalized;
}

/**
 * Binds Brightness / Contrast game sliders inside #gfx-menu-popover cleanly.
 */
export function bindGraphicsToneControls(getRenderer) {
  if (typeof document === 'undefined') return;
  const rngB = document.getElementById('rng-gfx-brightness');
  const rngC = document.getElementById('rng-gfx-contrast');
  const lblB = document.getElementById('v-gfx-brightness');
  const lblC = document.getElementById('v-gfx-contrast');
  const btnReset = document.getElementById('btn-reset-gfx-tone');
  if (!rngB || !rngC) return;

  const syncDisplay = (settings) => {
    const bp = Math.round(settings.brightness * 100);
    const cp = Math.round(settings.contrast * 100);
    rngB.value = String(bp);
    rngC.value = String(cp);
    if (lblB) lblB.textContent = `${bp}%`;
    if (lblC) lblC.textContent = `${cp}%`;
  };

  const applyFromUI = () => {
    const next = saveToneSettings({
      brightness: (parseFloat(rngB.value) || 100) / 100,
      contrast: (parseFloat(rngC.value) || 100) / 100
    });
    syncDisplay(next);
    const sr = typeof getRenderer === 'function' ? getRenderer() : null;
    if (sr && typeof sr.setToneSettings === 'function') {
      sr.setToneSettings(next);
    }
  };

  const initial = loadSavedToneSettings();
  syncDisplay(initial);
  const sr0 = typeof getRenderer === 'function' ? getRenderer() : null;
  if (sr0 && typeof sr0.setToneSettings === 'function') sr0.setToneSettings(initial);

  rngB.addEventListener('input', applyFromUI);
  rngC.addEventListener('input', applyFromUI);
  if (btnReset) {
    btnReset.addEventListener('click', () => {
      const def = saveToneSettings(DEFAULT_TONE_SETTINGS);
      syncDisplay(def);
      const sr = typeof getRenderer === 'function' ? getRenderer() : null;
      if (sr && typeof sr.setToneSettings === 'function') sr.setToneSettings(def);
    });
  }
}
