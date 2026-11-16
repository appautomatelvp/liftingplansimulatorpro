import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { getLang, setLang, toggleLang } from '../src/i18n/index.js';
import { KEYS, SAAS_KEYS } from '../src/i18n/keys.js';
import { saasT } from '../src/saas/i18n.js';

function placeholders(str) {
  return [...String(str).matchAll(/\{([a-zA-Z0-9_]+)\}/g)].map((m) => m[1]).sort();
}

describe('i18n dictionary and SaaS key parity', () => {
  it('keeps KEYS.vi and KEYS.en keys symmetric and non-empty', () => {
    const viKeys = Object.keys(KEYS.vi).sort();
    const enKeys = Object.keys(KEYS.en).sort();
    expect(enKeys).toEqual(viKeys);
    for (const key of viKeys) {
      expect(typeof KEYS.vi[key]).toBe('string');
      expect(typeof KEYS.en[key]).toBe('string');
      expect(KEYS.vi[key].trim().length).toBeGreaterThan(0);
      expect(KEYS.en[key].trim().length).toBeGreaterThan(0);
      expect(placeholders(KEYS.en[key])).toEqual(placeholders(KEYS.vi[key]));
    }
  });

  it('includes all SAAS_KEYS in KEYS and formats placeholders via saasT', () => {
    const saasKeys = Object.keys(SAAS_KEYS.vi);
    expect(saasKeys.length).toBeGreaterThan(50);
    for (const key of saasKeys) {
      expect(KEYS.vi[key]).toBe(SAAS_KEYS.vi[key]);
      expect(KEYS.en[key]).toBe(SAAS_KEYS.en[key]);
    }
    expect(saasT('wsPageCount', { count: 7 }, 'vi')).toBe('7 mục trên trang này');
    expect(saasT('wsPageCount', { count: 7 }, 'en')).toBe('7 items on this page');
    expect(saasT('adminPageNumber', { page: 3 }, 'en')).toBe('Page 3');
  });

  it('avoids scattered language ternaries in src/saas UI modules', () => {
    const saasDir = resolve(process.cwd(), 'src/saas');
    const files = readdirSync(saasDir).filter((file) => file.endsWith('.js'));
    for (const file of files) {
      const content = readFileSync(resolve(saasDir, file), 'utf8');
      expect(content, `${file} should use centralized i18n keys`).not.toMatch(/getLang\(\)\s*===\s*'en'|lang\(\)\s*===\s*'en'/);
    }
  });

  it('defaults to English (en) on startup and synchronizes EN/VI toggles cleanly', () => {
    const loaderInit = readFileSync(resolve(process.cwd(), 'public/loading-screen-init.js'), 'utf8');
    expect(loaderInit).toContain("var lang = 'en';");
    expect(getLang()).toBe('en');
    expect(toggleLang()).toBe('vi');
    expect(getLang()).toBe('vi');
    expect(setLang('en')).toBe('en');
    expect(getLang()).toBe('en');
  });
});
