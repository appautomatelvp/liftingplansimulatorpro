import { describe, it, expect } from 'vitest';
import { formatCargoDerivedLabel, formatCargoCrateLabel } from '../src/i18n/cargo_labels.js';

const VIETNAMESE_DIACRITICS = /[ạ-ỹà-ỹăâêôơư]/i;

describe('cargo_labels', () => {
  const geom = { cL: 11.39, cW: 3.1, cH: 2.47 };
  const state = { cogX: 0, cogY: 0.16, cogZ: 0 };

  it('formats EN flat-rack label without Vietnamese diacritics and with end gaps', () => {
    const out = formatCargoDerivedLabel({
      lang: 'en',
      geom,
      state,
      isFlatRack: true,
      gapF: 0.4,
      gapR: 0.4
    });
    expect(out).toBe('Derived crate 11.39×3.10×2.47 m · Envelope CoG (0.00, 0.16, 0.00) · End gaps 0.40 / 0.40 m');
    expect(VIETNAMESE_DIACRITICS.test(out)).toBe(false);
  });

  it('formats EN non-flat-rack label without end gaps', () => {
    const out = formatCargoDerivedLabel({
      lang: 'en',
      geom,
      state,
      isFlatRack: false
    });
    expect(out).toBe('Derived crate 11.39×3.10×2.47 m · Envelope CoG (0.00, 0.16, 0.00)');
    expect(VIETNAMESE_DIACRITICS.test(out)).toBe(false);
  });

  it('formats VI flat-rack and non-flat-rack labels', () => {
    const flat = formatCargoDerivedLabel({
      lang: 'vi',
      geom,
      state,
      isFlatRack: true,
      gapF: 0.4,
      gapR: 0.4
    });
    expect(flat).toContain('Kiện quy đổi 11.39×3.10×2.47 m');
    expect(flat).toContain('CoG bao (0.00, 0.16, 0.00)');
    expect(flat).toContain('Khe cánh 0.40 / 0.40 m');

    const platform = formatCargoDerivedLabel({
      lang: 'vi',
      geom,
      state,
      isFlatRack: false
    });
    expect(platform).toContain('Kiện quy đổi');
    expect(platform).not.toContain('Khe cánh');
  });

  it('formats compact crate labels and handles missing geometry', () => {
    expect(formatCargoCrateLabel({ lang: 'en', geom })).toBe('Cargo crate 11.39×3.10×2.47 m');
    expect(formatCargoCrateLabel({ lang: 'vi', geom })).toBe('Kiện quy đổi 11.39×3.10×2.47 m');
    expect(formatCargoDerivedLabel({ lang: 'en' })).toBe('— × — × — m');
    expect(formatCargoCrateLabel({ lang: 'en' })).toBe('— × — × — m');
  });
});
