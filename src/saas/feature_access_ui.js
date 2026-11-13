import { canAccessFeature, getFeatureRule } from './access.js';
import { trapDialogFocus } from './dialog_accessibility.js';
import { saasT } from './i18n.js';

const LOCKED_SELECTOR_FEATURES = [
  ['#cargo-library [data-cargo="crate"]', 'cargo.oog'],
  ['#cargo-library [data-cargo="transformer"]', 'cargo.specialized'],
  ['#cargo-library [data-cargo="vessel"]', 'cargo.specialized'],
  ['#cargo-library [data-cargo="wind_nacelle"]', 'cargo.specialized'],
  ['#cargo-library [data-cargo="excavator"]', 'cargo.specialized'],
  ['#cargo-library [data-cargo="boat"]', 'cargo.specialized'],
  ['#cargo-library [data-cargo="pipe"]', 'cargo.specialized'],
  ['#beam-store [data-beam="frame"]', 'beam.frame'],
  ['#beam-store [data-beam="container_spreader"]', 'beam.container'],
  ['#beam-store [data-beam="cascaded"]', 'beam.cascaded'],
  ['#beam-store [data-beam="modular_truss"]', 'beam.truss']
];

export function installFeatureAccessUI() {
  let activeProfile = null;
  const applyLocks = (profile) => {
    LOCKED_SELECTOR_FEATURES.forEach(([selector, featureId]) => {
      document.querySelectorAll(selector).forEach((card) => decorateCard(card, featureId, profile));
    });
    const oog = document.getElementById('oog-cargo-panel');
    if (oog) {
      oog.dataset.featureGate = 'cargo.oog';
      oog.classList.toggle('saas-feature-locked', !canAccessFeature(profile, 'cargo.oog'));
      decoratePanel(oog, 'cargo.oog', profile);
    }
    document.querySelectorAll('[data-feature-gate]').forEach((element) => {
      if (LOCKED_SELECTOR_FEATURES.some(([selector]) => element.matches(selector))) return;
      const featureId = element.dataset.featureGate;
      if (featureId === 'cargo.oog' && element === oog) return;
      decorateCard(element, featureId, profile);
    });
  };
  const refreshLocalizedBadges = () => applyLocks(activeProfile);

  const showPaywall = (featureId, profile, comingSoon = false) => {
    const rule = getFeatureRule(featureId);
    if (!rule) return;
    document.querySelector('.saas-paywall-backdrop')?.remove();
    const lang = window.SafeLift?.i18n?.getLang?.() || document.documentElement.lang || 'vi';
    const isEntitled = canAccessFeature(profile, featureId);
    const backdrop = document.createElement('div');
    backdrop.className = 'saas-paywall-backdrop';
    backdrop.innerHTML = `
      <section class="saas-paywall" role="dialog" aria-modal="true" aria-labelledby="saas-paywall-title">
        <button class="saas-paywall-close" type="button" aria-label="${saasT('saasClose', null, lang)}">×</button>
        <div class="saas-paywall-lock">${comingSoon ? '🛠️' : '🔒'}</div>
        <div class="saas-auth-kicker">${saasT('paywallKicker', null, lang)}</div>
        <h2 id="saas-paywall-title">${featureLabel(featureId, lang, rule.label)}</h2>
        <p>${comingSoon || isEntitled ? saasT('paywallComingSoonBody', null, lang) : saasT('paywallPremiumBody', null, lang)}</p>
        <a class="saas-contact-link" href="mailto:levietphuong.hcmutrans@gmail.com">${saasT('paywallContactCta', null, lang)}</a>
      </section>`;
    let releaseFocusTrap = () => {};
    const onEscape = (event) => {
      if (event.key === 'Escape') close();
    };
    const close = () => {
      backdrop.remove();
      document.removeEventListener('keydown', onEscape);
      releaseFocusTrap();
    };
    backdrop.addEventListener('click', (event) => { if (event.target === backdrop) close(); });
    backdrop.querySelector('button')?.addEventListener('click', close);
    document.addEventListener('keydown', onEscape);
    document.body.append(backdrop);
    releaseFocusTrap = trapDialogFocus(backdrop.querySelector('[role="dialog"]'), { initialFocus: backdrop.querySelector('button') });
  };

  const onClick = (event) => {
    const target = event.target instanceof Element ? event.target.closest('[data-feature-gate]') : null;
    if (!target) return;
    const featureId = target.dataset.featureGate;
    const profile = window.SafeLift?.saas?.profile || null;
    const comingSoon = target.dataset.featureComingSoon === 'true';
    if (comingSoon || !canAccessFeature(profile, featureId)) {
      event.preventDefault();
      event.stopImmediatePropagation();
      showPaywall(featureId, profile, comingSoon);
    }
  };
  document.addEventListener('click', onClick, true);
  window.addEventListener('safelift:language-changed', refreshLocalizedBadges);

  return {
    setProfile(profile) {
      activeProfile = profile;
      window.SafeLift.saas.profile = profile;
      window.SafeLift.saas.canAccessFeature = (featureId) => canAccessFeature(profile, featureId);
      applyLocks(profile);
    },
    dispose() {
      document.removeEventListener('click', onClick, true);
      window.removeEventListener('safelift:language-changed', refreshLocalizedBadges);
      document.querySelector('.saas-paywall-backdrop')?.remove();
    }
  };
}

function decorateCard(card, featureId, profile) {
  const rule = getFeatureRule(featureId);
  if (!rule) return;
  card.dataset.featureGate = featureId;
  const comingSoon = card.dataset.featureComingSoon === 'true';
  const locked = comingSoon || !canAccessFeature(profile, featureId);
  card.classList.toggle('saas-feature-locked', locked);
  card.setAttribute('aria-disabled', String(locked));
  if (!card.hasAttribute('tabindex')) card.tabIndex = 0;
  if (!card.hasAttribute('role')) card.setAttribute('role', 'button');
  let badge = card.querySelector(':scope > .saas-lock-badge');
  if (locked && !badge) {
    badge = document.createElement('span');
    badge.className = 'saas-lock-badge';
    card.append(badge);
  }
  if (badge) {
    const lang = window.SafeLift?.i18n?.getLang?.() || document.documentElement.lang || 'vi';
    badge.textContent = comingSoon && canAccessFeature(profile, featureId)
      ? saasT('badgeComingSoon', null, lang)
      : saasT('badgePremium', null, lang);
    badge.hidden = !locked;
  }
}

function decoratePanel(panel, featureId, profile) {
  const rule = getFeatureRule(featureId);
  if (!rule) return;
  let badge = panel.querySelector(':scope > .saas-lock-badge');
  const locked = !canAccessFeature(profile, featureId);
  panel.querySelectorAll('button, input, select, textarea').forEach((control) => {
    if (locked) {
      if (!control.hasAttribute('data-saas-disabled-origin')) {
        control.dataset.saasDisabledOrigin = control.disabled ? 'true' : 'false';
      }
      control.disabled = true;
    } else if (control.hasAttribute('data-saas-disabled-origin')) {
      control.disabled = control.dataset.saasDisabledOrigin === 'true';
      delete control.dataset.saasDisabledOrigin;
    }
  });
  if (locked && !badge) {
    badge = document.createElement('span');
    badge.className = 'saas-lock-badge saas-lock-badge-panel';
    panel.prepend(badge);
  }
  if (badge) {
    const lang = window.SafeLift?.i18n?.getLang?.() || document.documentElement.lang || 'vi';
    badge.textContent = saasT('badgePremium', null, lang);
    badge.hidden = !locked;
  }
}

const FEATURE_LABEL_KEYS = {
  'cargo.oog': 'featureCargoOog',
  'cargo.specialized': 'featureCargoSpecialized',
  'beam.equalizer': 'featureBeamEqualizer',
  'beam.cascaded': 'featureBeamCascaded',
  'beam.truss': 'featureBeamTruss',
  'beam.container': 'featureBeamContainer',
  'beam.frame': 'featureBeamFrame'
};

function featureLabel(id, lang, fallback) {
  const key = FEATURE_LABEL_KEYS[id];
  return key ? saasT(key, null, lang) : fallback || id;
}
