import { getFeatureRule } from './access.js';
import { applyFlagsToAccess } from './runtime_flags.js';
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
  let activeFlags = null;
  const applyLocks = (profile) => {
    LOCKED_SELECTOR_FEATURES.forEach(([selector, featureId]) => {
      document.querySelectorAll(selector).forEach((card) => decorateCard(card, featureId, profile, activeFlags));
    });
    const oog = document.getElementById('oog-cargo-panel');
    if (oog) {
      oog.dataset.featureGate = 'cargo.oog';
      oog.classList.toggle('saas-feature-locked', !applyFlagsToAccess(activeFlags, profile, 'cargo.oog').allowed);
      decoratePanel(oog, 'cargo.oog', profile, activeFlags);
    }
    document.querySelectorAll('[data-feature-gate]').forEach((element) => {
      if (LOCKED_SELECTOR_FEATURES.some(([selector]) => element.matches(selector))) return;
      const featureId = element.dataset.featureGate;
      if (featureId === 'cargo.oog' && element === oog) return;
      decorateCard(element, featureId, profile, activeFlags);
    });
  };
  const refreshLocalizedBadges = () => applyLocks(activeProfile);

  const showPaywall = (featureId, profile, comingSoon = false, accessReason = 'tier_locked') => {
    const rule = getFeatureRule(featureId);
    if (!rule) return;
    document.querySelector('.saas-paywall-backdrop')?.remove();
    const lang = window.SafeLift?.i18n?.getLang?.() || document.documentElement.lang || 'vi';
    const bodyText = accessReason === 'disabled_module'
      ? saasT('paywallDisabledModuleBody', null, lang)
      : (accessReason === 'maintenance'
        ? (activeFlags?.maintenanceMessage || saasT('maintenanceDefaultMsg', null, lang))
        : (comingSoon || accessReason === 'ok'
          ? saasT('paywallComingSoonBody', null, lang)
          : saasT('paywallPremiumBody', null, lang)));
    const backdrop = document.createElement('div');
    backdrop.className = 'saas-paywall-backdrop';
    backdrop.innerHTML = `
      <section class="saas-paywall" role="dialog" aria-modal="true" aria-labelledby="saas-paywall-title">
        <button class="saas-paywall-close" type="button" aria-label="${saasT('saasClose', null, lang)}">×</button>
        <div class="saas-paywall-lock">${accessReason === 'disabled_module' ? '⛔' : (comingSoon || accessReason === 'maintenance' ? '🛠️' : '🔒')}</div>
        <div class="saas-auth-kicker">${saasT('paywallKicker', null, lang)}</div>
        <h2 id="saas-paywall-title">${featureLabel(featureId, lang, rule.label)}</h2>
        <p>${bodyText}</p>
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
    const access = applyFlagsToAccess(activeFlags, profile, featureId);
    if (comingSoon || !access.allowed) {
      event.preventDefault();
      event.stopImmediatePropagation();
      showPaywall(featureId, profile, comingSoon, access.reason);
    }
  };
  document.addEventListener('click', onClick, true);
  window.addEventListener('safelift:language-changed', refreshLocalizedBadges);

  return {
    setProfile(profile) {
      activeProfile = profile;
      window.SafeLift.saas.profile = profile;
      window.SafeLift.saas.canAccessFeature = (featureId) => applyFlagsToAccess(activeFlags, profile, featureId).allowed;
      applyLocks(profile);
    },
    setFlags(flags) {
      activeFlags = flags || null;
      window.SafeLift.saas.flags = activeFlags;
      window.SafeLift.saas.canAccessFeature = (featureId) => applyFlagsToAccess(activeFlags, activeProfile, featureId).allowed;
      applyLocks(activeProfile);
    },
    dispose() {
      document.removeEventListener('click', onClick, true);
      window.removeEventListener('safelift:language-changed', refreshLocalizedBadges);
      document.querySelector('.saas-paywall-backdrop')?.remove();
    }
  };
}

function resolveBadgeText(access, comingSoon, lang) {
  if (access.reason === 'disabled_module') return saasT('badgeDisabledModule', null, lang);
  if (access.reason === 'maintenance') return saasT('badgeMaintenance', null, lang);
  if (comingSoon && access.allowed) return saasT('badgeComingSoon', null, lang);
  return saasT('badgePremium', null, lang);
}

function decorateCard(card, featureId, profile, flags) {
  const rule = getFeatureRule(featureId);
  if (!rule) return;
  card.dataset.featureGate = featureId;
  const comingSoon = card.dataset.featureComingSoon === 'true';
  const access = applyFlagsToAccess(flags, profile, featureId);
  const locked = comingSoon || !access.allowed;
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
    badge.textContent = resolveBadgeText(access, comingSoon, lang);
    badge.hidden = !locked;
  }
}

function decoratePanel(panel, featureId, profile, flags) {
  const rule = getFeatureRule(featureId);
  if (!rule) return;
  let badge = panel.querySelector(':scope > .saas-lock-badge');
  const access = applyFlagsToAccess(flags, profile, featureId);
  const locked = !access.allowed;
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
    badge.textContent = resolveBadgeText(access, false, lang);
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
