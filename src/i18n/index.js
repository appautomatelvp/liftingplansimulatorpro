import { KEYS, SPLASH_STAGES } from './keys.js';
import { formatCargoDerivedLabel, formatCargoCrateLabel } from './cargo_labels.js';
import { BRAND, COPYRIGHT, applyDocumentBrand } from '../saas/branding.js';
import { safeReadLocalStore, safeWriteLocalStore } from '../utils/localDataStore.js';

const SUPPORTED = new Set(['vi', 'en']);
const STORAGE_KEY = 'safelift3d.lang';
const MIGRATION_KEY = 'safelift3d.lang.en_v1';

function detectInitialLang() {
  if (typeof localStorage === 'undefined') return 'en';
  try {
    if (localStorage.getItem(MIGRATION_KEY) !== '1') {
      if (localStorage.getItem(STORAGE_KEY) === '"vi"') {
        localStorage.removeItem(STORAGE_KEY);
      }
      localStorage.setItem(MIGRATION_KEY, '1');
    }
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return 'en';
    if (SUPPORTED.has(raw)) return raw;
    const cleaned = raw.replace(/^"|"$/g, '');
    if (SUPPORTED.has(cleaned)) return cleaned;
  } catch (_) { /* ignore */ }
  const saved = safeReadLocalStore(STORAGE_KEY, null);
  if (SUPPORTED.has(saved)) return saved;
  return 'en';
}

let currentLang = detectInitialLang();
let inToggleCall = false;
let syncingSimBtn = false;

function syncSimulatorButtonIfNeeded() {
  if (inToggleCall || syncingSimBtn || typeof window === 'undefined') return;
  const simState = window.__LIFTING_RUNTIME__?.state || window.__LIFTING_RUNTIME__?.api?.getState?.();
  if (!simState || typeof simState !== 'object' || simState.lang === currentLang) return;
  const langBtn = typeof document !== 'undefined' ? document.getElementById('btn-lang') : null;
  if (langBtn) {
    syncingSimBtn = true;
    try { langBtn.click(); } finally { syncingSimBtn = false; }
  } else {
    simState.lang = currentLang;
  }
}

export function getLang() {
  return currentLang;
}

export function setLang(lang) {
  if (!SUPPORTED.has(lang)) return currentLang;
  const changed = currentLang !== lang;
  currentLang = lang;
  if (typeof window !== 'undefined') window.__SAFELIFT_BOOT_LANG__ = currentLang;
  if (changed && typeof localStorage !== 'undefined') {
    safeWriteLocalStore(STORAGE_KEY, lang);
  }
  applyDocumentBrand(currentLang);
  syncSimulatorButtonIfNeeded();
  if (changed && typeof window !== 'undefined' && typeof window.dispatchEvent === 'function') {
    window.dispatchEvent(new CustomEvent('safelift:language-changed', { detail: { lang: currentLang } }));
  }
  return currentLang;
}

export function toggleLang() {
  if (syncingSimBtn) return currentLang;
  inToggleCall = true;
  try {
    return setLang(currentLang === 'vi' ? 'en' : 'vi');
  } finally {
    inToggleCall = false;
  }
}

export function t(key, lang = currentLang) {
  const pack = KEYS[lang] || KEYS.en;
  return pack[key] || KEYS.en[key] || key;
}

export function L(en, vi, lang = currentLang) {
  return lang === 'en' ? en : vi;
}

export function splashMessage(keyOrPct, lang = currentLang) {
  if (typeof keyOrPct === 'string') return t(keyOrPct, lang);
  const stage = SPLASH_STAGES.find((s) => s.pct === keyOrPct)
    || [...SPLASH_STAGES].reverse().find((s) => s.pct <= keyOrPct);
  return stage ? t(stage.key, lang) : t('splashReady', lang);
}

export function applyDataI18n(root = typeof document !== 'undefined' ? document : null) {
  if (!root) return;
  root.querySelectorAll('[data-i18n]').forEach((el) => {
    const key = el.dataset.i18n;
    if (!key) return;
    el.textContent = t(key);
  });
  const attributeKeys = {
    title: 'i18nTitle',
    'aria-label': 'i18nAriaLabel',
    placeholder: 'i18nPlaceholder'
  };
  for (const [attribute, dataKey] of Object.entries(attributeKeys)) {
    root.querySelectorAll(`[data-${dataKey.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`)}]`).forEach((el) => {
      const key = el.dataset[dataKey];
      if (key) el.setAttribute(attribute, t(key));
    });
  }
}

export function createI18nApi() {
  return {
    getLang,
    setLang,
    toggleLang,
    t,
    L,
    formatCargoDerivedLabel,
    formatCargoCrateLabel,
    splashMessage,
    applyDataI18n,
    KEYS,
    SPLASH_STAGES,
    BRAND,
    COPYRIGHT
  };
}

export { KEYS, SPLASH_STAGES, BRAND, COPYRIGHT };
