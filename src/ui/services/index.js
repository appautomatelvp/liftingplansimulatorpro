import { CMD } from '../../app/commands/index.js';

/**
 * Thin UI services — façade over PhysicsPort + command bus.
 */
export function createUiServices(runtime) {
  const port = () => runtime.physicsPort;

  return {
    getState() {
      return port()?.getState() ?? runtime.getState();
    },
    getPhy() {
      return port()?.getPhy() ?? runtime.getPhy();
    },
    getTelemetry() {
      return port()?.getTelemetry?.() ?? null;
    },
    pretensionRig() {
      runtime.emit(CMD.SNUG);
    },
    trialLift(clearance) {
      runtime.emit(CMD.TRIAL_LIFT, { clearance });
    },
    setDown() {
      runtime.emit(CMD.SET_DOWN);
    },
    resetPreLift() {
      runtime.emit(CMD.RESET_PRELIFT);
    },
    rebuildCargoAndRig(reset = false) {
      runtime.emit(CMD.REBUILD, { reset });
    },
    loadScenario(id) {
      runtime.emit(CMD.LOAD_SCENARIO, { id });
    },
    stepPhysics(dt) {
      return port()?.step(dt);
    },
    on(type, handler) {
      return runtime.on(type, handler);
    },
    emit(type, payload) {
      runtime.emit(type, payload);
    },
    CMD
  };
}
