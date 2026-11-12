/**
 * Command bus — dock / UI actions as runtime events.
 * Event names are stable for future save/replay and scenario scripting.
 */

export const CMD = Object.freeze({
  SNUG: 'cmd:snug',
  TRIAL_LIFT: 'cmd:trialLift',
  SET_DOWN: 'cmd:setDown',
  RESET_PRELIFT: 'cmd:resetPreLift',
  RESET_FACTORY: 'cmd:resetFactory',
  REBUILD: 'cmd:rebuild',
  LOAD_SCENARIO: 'cmd:loadScenario'
});

/**
 * @param {object} runtime
 * @param {ReturnType<import('../../sim/physics/port.js').createPhysicsPort>} port
 * @param {{ loadScenario?: Function }} [extras]
 */
export function installCommandBus(runtime, port, extras = {}) {
  const unsubs = [];

  const on = (type, handler) => {
    unsubs.push(runtime.on(type, handler));
  };

  on(CMD.SNUG, () => {
    port.pretension();
    runtime.emit('sim:snugged', port.getTelemetry());
  });

  on(CMD.TRIAL_LIFT, (payload = {}) => {
    const clearance = payload.clearance ?? 3.0;
    port.trialLift(clearance);
    runtime.emit('sim:trialLift', { clearance, telemetry: port.getTelemetry() });
  });

  on(CMD.SET_DOWN, () => {
    port.setDown();
    runtime.emit('sim:setDown', port.getTelemetry());
  });

  on(CMD.RESET_PRELIFT, () => {
    port.resetPreLift();
    runtime.emit('sim:resetPreLift', port.getTelemetry());
  });

  on(CMD.RESET_FACTORY, () => {
    port.resetFactory();
    runtime.emit('sim:resetFactory', port.getTelemetry());
  });

  on(CMD.REBUILD, (payload = {}) => {
    port.rebuild(!!payload.reset);
    runtime.emit('sim:rebuilt', { reset: !!payload.reset });
  });

  on(CMD.LOAD_SCENARIO, async (payload = {}) => {
    if (typeof extras.loadScenario !== 'function') return;
    const result = await extras.loadScenario(payload.id || payload.scenarioId || 'default_flatrack');
    runtime.emit('sim:scenarioLoaded', result);
  });

  return {
    dispose() {
      for (const off of unsubs) {
        try { off?.(); } catch { /* ignore */ }
      }
    },
    dispatch(type, payload) {
      runtime.emit(type, payload);
    }
  };
}
