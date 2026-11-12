/**
 * UI controllers — app-level chrome only.
 * Dock buttons (Nhớm / Nhấc / Hạ) remain in session/* during strangler;
 * new UI should call services.emit(CMD.*) instead of growing session.
 */
export function installUiControllers(runtime, services) {
  if (typeof document === 'undefined') return { dispose() {} };

  const root = document.documentElement;
  root.dataset.appBoot = '1';
  root.dataset.cmdBus = '1';

  const onKey = (ev) => {
    if (ev.key === 'F1') services.emit('ui:help', { source: 'keyboard' });
  };
  window.addEventListener('keydown', onKey);

  const offBoot = runtime.on('app:booted', () => {
    services.emit('ui:ready', { at: Date.now() });
  });

  return {
    dispose() {
      window.removeEventListener('keydown', onKey);
      offBoot?.();
    }
  };
}
