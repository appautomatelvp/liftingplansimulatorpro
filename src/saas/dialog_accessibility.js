const FOCUSABLE = [
  'a[href]', 'button:not([disabled])', 'input:not([disabled])', 'select:not([disabled])',
  'textarea:not([disabled])', '[tabindex]:not([tabindex="-1"])'
].join(',');

export function trapDialogFocus(dialog, { initialFocus = null } = {}) {
  if (!dialog) return () => {};
  const previousFocus = document.activeElement;
  const focusables = () => Array.from(dialog.querySelectorAll(FOCUSABLE)).filter((element) =>
    !element.hidden && element.getAttribute('aria-hidden') !== 'true' && element.getClientRects().length > 0
  );
  dialog.tabIndex = dialog.hasAttribute('tabindex') ? dialog.tabIndex : -1;
  const firstTarget = initialFocus || focusables()[0] || dialog;
  firstTarget.focus({ preventScroll: true });

  const onKeyDown = (event) => {
    if (event.key !== 'Tab') return;
    event.stopPropagation();
    const items = focusables();
    if (!items.length) {
      event.preventDefault();
      dialog.focus({ preventScroll: true });
      return;
    }
    const first = items[0];
    const last = items[items.length - 1];
    if (event.shiftKey && (document.activeElement === first || !dialog.contains(document.activeElement))) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && (document.activeElement === last || !dialog.contains(document.activeElement))) {
      event.preventDefault();
      first.focus();
    }
  };
  dialog.addEventListener('keydown', onKeyDown);

  return () => {
    dialog.removeEventListener('keydown', onKeyDown);
    if (previousFocus instanceof HTMLElement && previousFocus.isConnected && !previousFocus.hasAttribute('disabled') && previousFocus.getClientRects().length > 0) {
      previousFocus.focus({ preventScroll: true });
    } else {
      dialog.parentElement?.closest('[role="dialog"]')?.focus({ preventScroll: true });
    }
  };
}
