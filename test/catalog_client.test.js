import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  CATALOG_QUERY_LIMIT,
  canAccessCatalogTier,
  clearCatalogCache,
  filterCatalogItems,
  loadCatalogForUser,
  mapCatalogItemToEquipmentInput
} from '../src/saas/catalog_client.js';

describe('shared catalog client consumer', () => {
  beforeEach(() => {
    clearCatalogCache();
  });

  it('filters disabled items and checks tier access per user role/tier', () => {
    const items = [
      { id: 'c-free', title: 'Free Sling', enabled: true, tier: 'free' },
      { id: 'c-prem', title: 'Pro Beam', enabled: true, tier: 'premium' },
      { id: 'c-off', title: 'Hidden Shackle', enabled: false, tier: 'free' }
    ];

    expect(canAccessCatalogTier('free', { tier: 'free', role: 'user' })).toBe(true);
    expect(canAccessCatalogTier('premium', { tier: 'free', role: 'user' })).toBe(false);
    expect(canAccessCatalogTier('premium', { tier: 'premium', role: 'user' })).toBe(true);
    expect(canAccessCatalogTier('premium', { tier: 'free', role: 'admin' })).toBe(true);

    expect(filterCatalogItems(items, { tier: 'free', role: 'user' }).map((i) => i.id)).toEqual(['c-free']);
    expect(filterCatalogItems(items, { tier: 'premium', role: 'user' }).map((i) => i.id)).toEqual(['c-free', 'c-prem']);
    expect(filterCatalogItems(items, { tier: 'free', role: 'admin' }).map((i) => i.id)).toEqual(['c-free', 'c-prem']);
  });

  it('enforces bounded query limit <= 50, caches in RAM, and falls back to [] on read errors', async () => {
    const docs = [
      { id: 'item-1', data: () => ({ title: '4-Leg Wire Rope', kind: 'sling', tier: 'free', enabled: true, wllT: 10 }) },
      { id: 'item-2', data: () => ({ title: 'Pro Spreader', kind: 'beam', tier: 'premium', enabled: true, wllT: 40 }) },
      { id: 'item-3', data: () => ({ title: 'Draft Cargo', kind: 'cargo', tier: 'free', enabled: false }) }
    ];
    const limitFn = vi.fn((value) => ({ limit: value }));
    const getDocsFn = vi.fn().mockResolvedValue({ docs });
    const deps = {
      collectionFn: vi.fn((_db, name) => ({ name })),
      orderByFn: vi.fn((field, dir) => ({ field, dir })),
      limitFn,
      queryFn: vi.fn((...args) => ({ args })),
      getDocsFn
    };
    const db = {};

    const first = await loadCatalogForUser(db, { tier: 'free', role: 'user' }, deps);
    expect(first.map((i) => i.id)).toEqual(['item-1']);
    expect(limitFn).toHaveBeenCalledWith(CATALOG_QUERY_LIMIT);
    expect(CATALOG_QUERY_LIMIT).toBeLessThanOrEqual(50);

    const second = await loadCatalogForUser(db, { tier: 'free', role: 'user' }, deps);
    expect(second).toBe(first);
    expect(getDocsFn).toHaveBeenCalledTimes(1);

    const upgraded = await loadCatalogForUser(db, { tier: 'premium', role: 'user' }, deps);
    expect(upgraded.map((i) => i.id)).toEqual(['item-1', 'item-2']);
    expect(getDocsFn).toHaveBeenCalledTimes(2);

    clearCatalogCache();
    const errorWarn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const failing = await loadCatalogForUser(db, { tier: 'free', role: 'user' }, {
      ...deps,
      getDocsFn: vi.fn().mockRejectedValue(new Error('network/offline'))
    });
    expect(failing).toEqual([]);
    errorWarn.mockRestore();
  });

  it('maps catalog metadata cleanly to valid equipment input bounds', () => {
    const beamInput = mapCatalogItemToEquipmentInput({
      id: 'beam-40t',
      kind: 'beam',
      category: 'spreader_heavy_custom',
      title: 'X'.repeat(120),
      wllT: 40,
      massKg: 1200,
      notes: 'N'.repeat(600)
    });
    expect(beamInput.name.length).toBe(80);
    expect(beamInput.category).toBe('lifting_beam');
    expect(beamInput.manufacturer).toBe('SafeLift3D Catalog');
    expect(beamInput.model).toBe('beam-40t');
    expect(beamInput.wllT).toBe(40);
    expect(beamInput.massKg).toBe(1200);
    expect(beamInput.notes.length).toBe(500);

    const directCat = mapCatalogItemToEquipmentInput({ id: 'shk-1', kind: 'hardware', category: 'shackle', title: 'Bow Shackle 25t' });
    expect(directCat.category).toBe('shackle');
  });
});
