import { describe, it, expect, beforeAll } from 'vitest';
import { createPhysicsPort } from '../../src/sim/physics/port.js';
import { createRuntime } from '../../src/app/createRuntime.js';
import { CMD, installCommandBus } from '../../src/app/commands/index.js';
import { createScenarioRuntime } from '../../src/app/scenarios/ScenarioRuntime.js';
import { listScenarios, getScenario } from '../../src/content/scenarios/index.js';
import { listEquipment, getEquipment } from '../../src/content/catalog/index.js';
import { listMaterials, getMaterial } from '../../src/content/materials/index.js';
import { createHeadlessSim } from '../sim_test_harness.js';

describe('Content packs', () => {
  it('lists scenarios including default_flatrack', () => {
    const list = listScenarios();
    expect(list.some((s) => s.id === 'default_flatrack')).toBe(true);
    expect(getScenario('default_flatrack')?.cargo?.cargoType).toBe('flatrack');
    expect(getScenario('sts_container_lift')?.rig?.beamType).toBe('container_spreader');
  });

  it('exposes equipment catalog and materials', () => {
    expect(listEquipment('beam').length).toBeGreaterThan(0);
    expect(getEquipment('modulift_spreader')?.meshUrl).toContain('modulift_spreader');
    expect(getMaterial('steel_painted')?.metalness).toBeGreaterThan(0);
    expect(listMaterials().length).toBeGreaterThan(2);
  });
});

describe('PhysicsPort + commands + scenario load', () => {
  let api;
  let runtime;
  let port;
  let scenarios;

  beforeAll(() => {
    api = createHeadlessSim();
    runtime = createRuntime();
    runtime.api = {
      getState: () => api.getState(),
      getPhy: () => api.getPhy(),
      getRigSpec: () => api.getRigSpec(),
      stepPhysicsEngine: (dt) => api.stepPhysicsEngine(dt),
      pretensionRig: () => api.getState() && (api.getPhy().nhomHold = true),
      rebuildCargoAndRig: (reset) => api.rebuildCargoAndRig(reset),
      autoPositionHookForLift: (c) => api.autoPositionHookForLift(c),
      beginSmoothSetDown: () => {},
      resetToInitialPreLiftState: () => api.resetAllToFactoryDefaults(),
      resetAllToFactoryDefaults: () => api.resetAllToFactoryDefaults()
    };
    runtime.state = api.getState();
    runtime.phy = api.getPhy();
    port = createPhysicsPort(runtime);
    scenarios = createScenarioRuntime(runtime, port);
    installCommandBus(runtime, port, { loadScenario: (id) => scenarios.load(id) });
  }, 60_000);

  it('port telemetry is finite', () => {
    const t = port.getTelemetry();
    expect(t).toBeTruthy();
    expect(Number.isFinite(t.hookY)).toBe(true);
    expect(Number.isFinite(t.cargoY)).toBe(true);
  });

  it('cmd:snug emits sim:snugged', () => {
    let seen = false;
    runtime.on('sim:snugged', () => { seen = true; });
    runtime.emit(CMD.SNUG);
    expect(seen).toBe(true);
  });

  it('loads default_flatrack scenario and rebuilds', () => {
    const result = scenarios.load('default_flatrack');
    expect(result.ok).toBe(true);
    expect(scenarios.getActiveId()).toBe('default_flatrack');
    expect(port.getState().cargoType).toBe('flatrack');
    expect(() => port.step(1 / 60)).not.toThrow();
  });
});
