import { createEventBus } from '../shared/events.js';

/**
 * Application runtime bag — DI root for sim installers and UI services.
 */
export function createRuntime(deps = {}) {
  const events = createEventBus();
  const runtime = {
    events,
    deps: {
      THREE: deps.THREE ?? null,
      CANNON: deps.CANNON ?? null,
      CAE: deps.CAE ?? null,
      GFX: deps.GFX ?? null,
      RIG: deps.RIG ?? null
    },
    /** Filled by sim attach */
    state: null,
    phy: null,
    api: null,
    flags: {
      experimentalPhysicsWorld: false,
      ...deps.flags
    },
    getState() {
      return this.state;
    },
    getPhy() {
      return this.phy;
    },
    emit(type, payload) {
      this.events.emit(type, payload);
    },
    on(type, handler) {
      return this.events.on(type, handler);
    }
  };
  return runtime;
}
