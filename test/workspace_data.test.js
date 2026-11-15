import { describe, expect, it } from 'vitest';
import { buildEquipmentRecord, exportAllWorkspaceData, makeLegacyRigSnapshot, makePlanSnapshot, MAX_PLAN_BYTES, migrateSnapshot, parsePlanSnapshot, SOLVER_VERSION } from '../src/saas/workspace_data.js';

describe('SafeLift personal workspace data', () => {
  it('normalizes equipment fields and rejects invalid engineering values', () => {
    const equipment = buildEquipmentRecord({
      name: '  Main hook  ', category: 'hook', manufacturer: 'SafeLift', model: 'H-40',
      wllT: '40', lengthM: '', massKg: '380', safetyFactor: '4', certificateNo: 'CERT-1',
      inspectionExpiry: '2027-05-01', notes: 'Annual inspection'
    }, 'user-a');

    expect(equipment).toMatchObject({ ownerUid: 'user-a', name: 'Main hook', category: 'hook', wllT: 40, lengthM: null, massKg: 380, safetyFactor: 4 });
    expect(() => buildEquipmentRecord({ name: 'Hook', wllT: '-1' }, 'user-a')).toThrow(/WLL/);
    expect(() => buildEquipmentRecord({ name: 'x'.repeat(81) }, 'user-a')).toThrow(/Name/);
  });

  it('serializes only approved simulator inputs and restores lift points as plain coordinates', () => {
    const state = {
      cargoType: 'flatrack', L: 12.192, W: 2.438, H: 2.591, weight: 24,
      cogX: 0.2, cogY: -0.3, cogZ: 0, beamType: 'spreader',
      lugs: [{ x: 2, y: 1.2, z: 1 }, { x: -2, y: 1.2, z: 1 }],
      scene: { children: [{ binaryModel: new Uint8Array([1, 2, 3]) }] },
      camera: { position: { x: 1, y: 2, z: 3 } }
    };
    const serialized = makePlanSnapshot(state, { overallStatus: 'PASS', checks: [{ code: 'TEST', status: 'PASS' }] });
    const parsed = parsePlanSnapshot(serialized);

    expect(parsed.schemaVersion).toBe(1);
    expect(parsed.inputs).not.toHaveProperty('scene');
    expect(parsed.inputs).not.toHaveProperty('camera');
    expect(parsed.inputs.lugs).toEqual([{ x: 2, y: 1.2, z: 1 }, { x: -2, y: 1.2, z: 1 }]);
    expect(parsed.analysis.overallStatus).toBe('PASS');
    expect(new TextEncoder().encode(serialized).length).toBeLessThanOrEqual(MAX_PLAN_BYTES);
  });

  it('rejects oversized snapshots, unknown fields, and non-finite engineering values', () => {
    expect(() => makePlanSnapshot({ gear: { extraCables: ['x'.repeat(MAX_PLAN_BYTES)] } })).toThrow(/48 KB/);
    expect(() => parsePlanSnapshot(JSON.stringify({ schemaVersion: 1, inputs: { admin: true } }))).toThrow(/unsupported simulation fields/);
    expect(() => parsePlanSnapshot(JSON.stringify({ schemaVersion: 1, inputs: { weight: 'heavy' } }))).toThrow(/numeric value/);
    expect(() => parsePlanSnapshot(JSON.stringify({ schemaVersion: 2, inputs: {} }))).toThrow(/schema version/);
  });

  it('migrates a local rig into a bounded lift-plan snapshot without mutating the live simulation', () => {
    const state = { cargoType: 'container', weight: 24, beamType: 'default', gear: { members: { main: { lengthM: 8 } }, extraCables: [] } };
    const rig = {
      id: 'userrig-1', beamType: 'spreader', slingType: 'chain', hwType: 'shackle', slingLength: 10,
      rigFit: 'auto', members: { main: { lengthM: 12, swlT: 40 } },
      extraCables: [{ id: 'extra-1', slingType: 'wire', lengthM: 8, lug: 1 }]
    };

    const result = parsePlanSnapshot(makeLegacyRigSnapshot(state, rig));
    expect(result.inputs).toMatchObject({ cargoType: 'container', beamType: 'spreader', slingType: 'chain', hwType: 'shackle', slingLength: 10, rigFit: 'auto' });
    expect(result.inputs.gear.members.main).toEqual({ lengthM: 12, swlT: 40 });
    expect(result.inputs.gear.extraCables).toEqual(rig.extraCables);
    expect(state.beamType).toBe('default');
    expect(state.gear.members.main.lengthM).toBe(8);
  });

  it('rejects malformed legacy rig data before it can be written to Firestore', () => {
    expect(() => makeLegacyRigSnapshot({}, { members: [], extraCables: [] })).toThrow(/invalid equipment settings/);
    expect(() => makeLegacyRigSnapshot({}, { members: {}, extraCables: Array(9).fill({}) })).toThrow(/number of additional cables/);
  });

  it('migrates legacy solver snapshots, passes current snapshots unchanged, and flags unknown versions', () => {
    const legacyFixture = {
      schemaVersion: 1,
      solverVersion: '4.2',
      savedAt: '2025-05-01T00:00:00.000Z',
      inputs: { cargoType: 'flatrack', L: 12, W: 2.4, H: 2.6, weight: 22 },
      analysis: { overallStatus: 'PASS' }
    };
    const legacyResult = migrateSnapshot(legacyFixture);
    expect(legacyResult.migrated).toBe(true);
    expect(legacyResult.compatible).toBe(true);
    expect(legacyResult.fromVersion).toBe('4.2');
    expect(legacyResult.toVersion).toBe(SOLVER_VERSION);
    expect(legacyResult.warnings).toContain('LEGACY_SOLVER_MIGRATED');
    expect(legacyResult.snapshot.solverVersion).toBe(SOLVER_VERSION);
    expect(legacyResult.snapshot.inputs).toMatchObject({
      cargoType: 'flatrack',
      weight: 22,
      unitSystem: 'metric',
      rigFit: 'fixed',
      windSpeedMps: 0,
      windLimitMps: 15,
      slewDeg: 0
    });
    expect(legacyFixture.inputs.unitSystem).toBeUndefined();

    const currentFixture = {
      schemaVersion: 1,
      solverVersion: SOLVER_VERSION,
      savedAt: '2026-01-01T00:00:00.000Z',
      inputs: { cargoType: 'container', unitSystem: 'imperial', windSpeedMps: 8 },
      analysis: null
    };
    const currentResult = migrateSnapshot(currentFixture);
    expect(currentResult.migrated).toBe(false);
    expect(currentResult.compatible).toBe(true);
    expect(currentResult.warnings).toEqual([]);
    expect(currentResult.snapshot.inputs.unitSystem).toBe('imperial');

    const unknownFixture = {
      schemaVersion: 1,
      solverVersion: '9.1',
      savedAt: '2027-01-01T00:00:00.000Z',
      inputs: { cargoType: 'vessel', weight: 80 },
      analysis: null
    };
    const unknownResult = migrateSnapshot(unknownFixture);
    expect(unknownResult.migrated).toBe(false);
    expect(unknownResult.compatible).toBe(false);
    expect(unknownResult.warnings).toContain('UNKNOWN_SOLVER_VERSION');
    expect(unknownResult.snapshot.inputs.weight).toBe(80);
  });

  it('exports all user lift plans and equipment across cursor pages with cooldown enforcement', async () => {
    const validSnap = makePlanSnapshot({ cargoType: 'container', weight: 18 });
    const planPages = [
      { items: [{ id: '1', title: 'Plan A', revision: 1, solverVersion: '5.0', snapshot: validSnap, createdAt: { toDate: () => new Date('2026-01-01T00:00:00Z') } }], cursor: 'c1', hasMore: true },
      { items: [{ id: '2', title: 'Plan B', revision: 2, solverVersion: '5.0', snapshot: 'not-json' }], cursor: 'c2', hasMore: false }
    ];
    const equipPages = [
      { items: [{ id: '1', name: 'Hook 40T', category: 'hook', wllT: 40 }], cursor: null, hasMore: false }
    ];
    let planIdx = 0;
    let equipIdx = 0;
    const fetchPage = async (_db, _uid, type) => (type === 'liftPlans' ? planPages[planIdx++] : equipPages[equipIdx++]);

    const exported = await exportAllWorkspaceData({
      db: {},
      profile: { uid: 'u1', email: 'eng@safelift3d.test', displayName: 'Eng', role: 'user', tier: 'free' },
      fetchPage,
      now: 100_000,
      lastExportAt: 0
    });

    expect(exported.account).toMatchObject({ uid: 'u1', email: 'eng@safelift3d.test', tier: 'free' });
    expect(exported.liftPlans).toHaveLength(2);
    expect(exported.liftPlans[0].snapshot.inputs.weight).toBe(18);
    expect(exported.liftPlans[0].createdAt).toBe('2026-01-01T00:00:00.000Z');
    expect(exported.liftPlans[1].snapshot).toBeNull();
    expect(exported.liftPlans[1].snapshotError).toBeTruthy();
    expect(exported.equipment).toHaveLength(1);
    expect(exported.equipment[0].name).toBe('Hook 40T');

    await expect(() => exportAllWorkspaceData({
      db: {},
      profile: { uid: 'u1' },
      fetchPage,
      now: 105_000,
      lastExportAt: 100_000
    })).rejects.toMatchObject({ code: 'safelift/export-cooldown', retryAfterSec: 5 });
  });
});
