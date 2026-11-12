import { getScenario, listScenarios } from '../../content/scenarios/index.js';

/**
 * Apply a scenario definition onto live sim state via PhysicsPort / rebuild.
 */
export function createScenarioRuntime(runtime, port) {
  let activeId = null;

  function applyPatch(state, scenario) {
    if (!state || !scenario) return;
    const { cargo, rig, crane, site } = scenario;
    if (cargo) Object.assign(state, cargo);
    if (rig) {
      Object.assign(state, {
        beamType: rig.beamType ?? state.beamType,
        slingType: rig.slingType ?? state.slingType,
        hwType: rig.hwType ?? state.hwType,
        upperSlingLength: rig.upperSlingLength ?? state.upperSlingLength,
        lowerSlingLength: rig.lowerSlingLength ?? state.lowerSlingLength,
        stsSizeFt: rig.stsSizeFt ?? state.stsSizeFt,
        stsAttachMode: rig.stsAttachMode ?? state.stsAttachMode
      });
      if (rig.upperSlingLength != null || rig.lowerSlingLength != null) {
        state.slingUserSet = true;
      }
    }
    if (crane) {
      Object.assign(state, {
        craneType: crane.craneType ?? state.craneType,
        hookCount: crane.hookCount ?? state.hookCount,
        hoistSpeedScale: crane.hoistSpeedScale ?? state.hoistSpeedScale
      });
    }
    if (site?.unitSystem) state.unitSystem = site.unitSystem;
  }

  return {
    list: listScenarios,
    getActiveId() {
      return activeId;
    },
    /**
     * @param {string} id
     * @returns {{ ok: boolean, id?: string, name?: string, error?: string }}
     */
    load(id) {
      const scenario = getScenario(id);
      if (!scenario) {
        return { ok: false, error: `Unknown scenario: ${id}` };
      }
      const state = port.getState();
      if (!state) {
        return { ok: false, error: 'Sim state not ready' };
      }
      applyPatch(state, scenario);
      port.rebuild(true);
      activeId = scenario.id;
      runtime.scenarioId = scenario.id;
      return { ok: true, id: scenario.id, name: scenario.name, winConditions: scenario.winConditions };
    }
  };
}
