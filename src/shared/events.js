/**
 * Tiny typed-ish event bus for app ↔ UI ↔ sim facades.
 */
export function createEventBus() {
  const listeners = new Map();

  return {
    on(type, handler) {
      if (!listeners.has(type)) listeners.set(type, new Set());
      listeners.get(type).add(handler);
      return () => listeners.get(type)?.delete(handler);
    },
    off(type, handler) {
      listeners.get(type)?.delete(handler);
    },
    emit(type, payload) {
      const set = listeners.get(type);
      if (!set) return;
      for (const handler of set) {
        try {
          handler(payload);
        } catch (err) {
          console.error(`[events] handler failed for ${type}`, err);
        }
      }
    },
    clear() {
      listeners.clear();
    }
  };
}
