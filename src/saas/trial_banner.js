// @purpose: Hiển thị thanh đếm ngược 24h Pro Trial (HH:MM:SS + progress bar) và modal thông báo khi hết hạn về Free
import { getTrialState } from './trial_access.js';
import { saasT } from './i18n.js';

export function showTrialExpiredModal({ onUpgrade, onClose } = {}) {
  const doc = typeof document !== 'undefined' ? document : null;
  if (!doc) return null;
  doc.getElementById('saas-trial-expired-modal')?.remove();

  const backdrop = doc.createElement('div');
  backdrop.id = 'saas-trial-expired-modal';
  backdrop.className = 'saas-trial-modal-backdrop';
  backdrop.setAttribute('role', 'dialog');
  backdrop.setAttribute('aria-modal', 'true');
  backdrop.innerHTML = `
    <div class="saas-trial-modal">
      <div class="saas-trial-modal-icon">⏳</div>
      <h3>${saasT('trialExpiredTitle')}</h3>
      <p>${saasT('trialExpiredBody')}</p>
      <div class="saas-trial-modal-actions">
        <button type="button" class="saas-workspace-secondary" data-trial-dismiss>${saasT('trialExpiredDismiss')}</button>
        <button type="button" class="saas-workspace-primary" data-trial-upgrade>${saasT('trialExpiredCta')}</button>
      </div>
    </div>
  `;

  const cleanup = () => {
    backdrop.remove();
    onClose?.();
  };
  backdrop.querySelector('[data-trial-dismiss]')?.addEventListener('click', cleanup);
  backdrop.querySelector('[data-trial-upgrade]')?.addEventListener('click', () => {
    backdrop.remove();
    onUpgrade?.();
  });
  backdrop.addEventListener('click', (e) => {
    if (e.target === backdrop) cleanup();
  });

  doc.body.appendChild(backdrop);
  return backdrop;
}

export function mountTrialCountdownBanner({
  getProfile,
  onExpired,
  onUpgrade,
  nowFn = () => Date.now(),
  intervalMs = 1000
} = {}) {
  const doc = typeof document !== 'undefined' ? document : null;
  let timerId = null;
  let bannerEl = null;
  let expiredTriggeredForUid = null;
  let wasInTrial = false;

  function removeBanner() {
    if (bannerEl) {
      bannerEl.remove();
      bannerEl = null;
    }
    if (doc?.body) doc.body.classList.remove('has-trial-banner');
  }

  function ensureBanner() {
    if (!doc || !doc.body) return null;
    if (bannerEl && doc.body.contains(bannerEl)) return bannerEl;
    doc.getElementById('saas-trial-banner')?.remove();
    const el = doc.createElement('div');
    el.id = 'saas-trial-banner';
    el.className = 'saas-trial-banner';
    el.setAttribute('role', 'status');
    el.innerHTML = `
      <div class="saas-trial-banner-inner">
        <span class="saas-trial-banner-text" data-trial-text></span>
        <button type="button" class="saas-trial-upgrade-btn" data-trial-upgrade></button>
      </div>
      <div class="saas-trial-progress-track">
        <div class="saas-trial-progress-fill" data-trial-fill></div>
      </div>
    `;
    el.querySelector('[data-trial-upgrade]')?.addEventListener('click', () => {
      onUpgrade?.();
    });
    doc.body.appendChild(el);
    doc.body.classList.add('has-trial-banner');
    bannerEl = el;
    return el;
  }

  function tick() {
    const profile = getProfile?.();
    const state = getTrialState(profile, nowFn());
    if (state.inTrial) {
      wasInTrial = true;
      expiredTriggeredForUid = null;
      const el = ensureBanner();
      if (!el) return;
      const textEl = el.querySelector('[data-trial-text]');
      const btnEl = el.querySelector('[data-trial-upgrade]');
      const fillEl = el.querySelector('[data-trial-fill]');
      if (textEl) textEl.textContent = saasT('trialBannerText', { hms: state.formattedHms });
      if (btnEl) btnEl.textContent = saasT('trialUpgradeBtn');
      if (fillEl) fillEl.style.width = `${state.progressPct.toFixed(2)}%`;
      return;
    }

    removeBanner();
    const uid = profile?.uid || 'anon';
    if (state.expired && wasInTrial && expiredTriggeredForUid !== uid) {
      expiredTriggeredForUid = uid;
      wasInTrial = false;
      onExpired?.(profile);
      showTrialExpiredModal({ onUpgrade });
    } else if (!state.expired) {
      wasInTrial = false;
    }
  }

  function startTimer() {
    if (timerId !== null) return;
    if (typeof setInterval === 'function' && intervalMs > 0) {
      timerId = setInterval(tick, intervalMs);
    }
  }

  function stopTimer() {
    if (timerId !== null && typeof clearInterval === 'function') {
      clearInterval(timerId);
      timerId = null;
    }
  }

  function sync() {
    tick();
    const state = getTrialState(getProfile?.(), nowFn());
    if (state.inTrial) startTimer();
    else stopTimer();
  }

  const onLangChange = () => tick();
  if (typeof window !== 'undefined' && typeof window.addEventListener === 'function') {
    window.addEventListener('safelift:langchange', onLangChange);
  }

  sync();

  return {
    sync,
    tick,
    dispose() {
      stopTimer();
      removeBanner();
      doc?.getElementById('saas-trial-expired-modal')?.remove();
      if (typeof window !== 'undefined' && typeof window.removeEventListener === 'function') {
        window.removeEventListener('safelift:langchange', onLangChange);
      }
    }
  };
}
