import { describe, it, expect } from 'vitest';
import {
  createCargoIdentity,
  createRiggingSelection,
  createCraneSelection,
  createSiteDefaults,
  CARGO_TYPES,
  BEAM_TYPES,
  standards
} from '../../src/domain/index.js';

describe('Domain façade', () => {
  it('exposes cargo / rigging / crane / site factories', () => {
    expect(CARGO_TYPES).toContain('flatrack');
    expect(BEAM_TYPES).toContain('spreader');
    expect(createCargoIdentity().L).toBeCloseTo(12.192, 2);
    expect(createRiggingSelection().slingType).toBe('chain');
    expect(createCraneSelection().craneType).toBe('hook_only');
    expect(createSiteDefaults().unitSystem).toBe('metric');
  });

  it('re-exports standards helpers', () => {
    expect(typeof standards.resolveSling).toBe('function');
    expect(typeof standards.lafOf).toBe('function');
  });
});
