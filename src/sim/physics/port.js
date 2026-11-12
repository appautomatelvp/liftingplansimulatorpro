/**
 * PhysicsPort — single façade over the live XPBD sim API.
 * UI / commands / scenarios call this; never reach into phy internals.
 * Experimental Rapier path stays behind runtime.flags.experimentalPhysicsWorld (ADR-003/004).
 */

/**
 * @param {object} runtime — from createRuntime / bootApp
 * @returns {import('./port.js').PhysicsPort}
 */
export function createPhysicsPort(runtime) {
  const api = () => runtime.api || {};

  return {
    getState() {
      return runtime.getState?.() ?? api().getState?.() ?? null;
    },
    getPhy() {
      return runtime.getPhy?.() ?? api().getPhy?.() ?? null;
    },
    getRigSpec() {
      return api().getRigSpec?.() ?? null;
    },
    step(dt) {
      return api().stepPhysicsEngine?.(dt);
    },
    pretension() {
      return api().pretensionRig?.();
    },
    trialLift(clearance = 3.0) {
      return api().autoPositionHookForLift?.(clearance);
    },
    setDown() {
      return api().beginSmoothSetDown?.();
    },
    resetPreLift() {
      return api().resetToInitialPreLiftState?.();
    },
    resetFactory() {
      return api().resetAllToFactoryDefaults?.();
    },
    rebuild(reset = false) {
      return api().rebuildCargoAndRig?.(reset);
    },
    getTelemetry() {
      const phy = this.getPhy();
      const state = this.getState();
      if (!phy) return null;
      return {
        hookY: phy.hookPos?.y ?? null,
        cargoY: phy.cargoPos?.y ?? null,
        groundClearance: phy.groundClearance ?? null,
        cableCount: Array.isArray(phy.cables) ? phy.cables.length : 0,
        cargoType: state?.cargoType ?? null,
        weightT: state?.weight ?? null
      };
    }
  };
}
