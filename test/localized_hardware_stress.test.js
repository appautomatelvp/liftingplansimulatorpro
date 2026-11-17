import { describe, expect, it } from 'vitest';
import { evaluateShackleComponentLoad } from '../src/core/LocalizedHardwareStress.js';

describe('Localized Shackle Hardware Stress (Pin Shear vs Bow ASME B30.26 Derating)', () => {
  it('applies ASME B30.26 side-load derating on bow: 45° -> 70% WLL, 90° -> 50% WLL', () => {
    const inline = evaluateShackleComponentLoad({ wllT: 17, loadT: 8.5, bearingOn: 'bow', sideAngleDeg: 0 });
    expect(inline.derateFactor).toBe(1.0);
    expect(inline.bowLimitT).toBeCloseTo(17, 3);
    expect(inline.governing).toBe('bow');
    expect(inline.utilizationPct).toBeCloseTo(50, 1);

    const deg45 = evaluateShackleComponentLoad({ wllT: 17, loadT: 11.9, bearingOn: 'bow', sideAngleDeg: 45 });
    expect(deg45.derateFactor).toBe(0.70);
    expect(deg45.bowLimitT).toBeCloseTo(11.9, 3);
    expect(deg45.utilizationPct).toBeCloseTo(100, 1);
    expect(deg45.isOverloaded).toBe(false);

    const deg90 = evaluateShackleComponentLoad({ wllT: 17, loadT: 10.2, bearingOn: 'bow', sideAngleDeg: 90 });
    expect(deg90.derateFactor).toBe(0.50);
    expect(deg90.bowLimitT).toBeCloseTo(8.5, 3);
    expect(deg90.utilizationPct).toBeGreaterThan(119);
    expect(deg90.isOverloaded).toBe(true);
  });

  it('tracks pin double-shear stress separately when sling bears on shackle pin', () => {
    const onPin = evaluateShackleComponentLoad({
      wllT: 17,
      pinMm: 41.3,
      jawMm: 44,
      loadT: 17,
      bearingOn: 'pin',
      sideAngleDeg: 0
    });
    expect(onPin.governing).toBe('pin');
    expect(onPin.pinShearStressMPa).toBeGreaterThan(0);
    expect(onPin.pinShearLimitT).toBeGreaterThan(17);
    expect(onPin.utilizationPct).toBeGreaterThan(0);
    expect(onPin.utilizationPct).toBeLessThan(100);

    // Undersized pin triggers pin shear overload even below nominal bow WLL
    const thinPin = evaluateShackleComponentLoad({
      wllT: 17,
      pinMm: 22,
      jawMm: 44,
      loadT: 12,
      bearingOn: 'pin',
      sideAngleDeg: 0
    });
    expect(thinPin.governing).toBe('pin');
    expect(thinPin.isOverloaded).toBe(true);
    expect(thinPin.utilizationPct).toBeGreaterThan(100);
  });

  it('handles zero, NaN, and prohibited >90° side angle gracefully without NaN', () => {
    const bad = evaluateShackleComponentLoad({ wllT: 17, loadT: Number.NaN, pinMm: 0, jawMm: 0, sideAngleDeg: 110 });
    for (const key of ['bowLimitT', 'pinShearLimitT', 'utilizationPct', 'derateFactor', 'pinShearStressMPa']) {
      expect(Number.isFinite(bad[key])).toBe(true);
    }
    expect(bad.isAllowed).toBe(false);
    expect(bad.isProhibited).toBe(true);
    expect(bad.isOverloaded).toBe(true);
  });
});
