// @purpose: Gắn kết giao diện header, widget tài khoản, banner bảo trì và hộp thoại liên hệ SaaS
import { canAccessCms } from './cms_data.js';
import { getLang } from '../i18n/index.js';
import { saasT } from './i18n.js';
import { isMaintenance } from './runtime_flags.js';
import { buildDeveloperContactMailto } from './feedback.js';
import { trapDialogFocus } from './dialog_accessibility.js';

export function ensureSaasRoot() {
  let root = document.getElementById('saas-root');
  if (!root) {
    root = document.createElement('div');
    root.id = 'saas-root';
    document.body.append(root);
  }
  root.hidden = false;
  return root;
}

export function clearAppSplash() {
  const splash = document.getElementById('app-loading-screen');
  if (splash) splash.remove();
}

export function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch]);
}

export function mountAccountWidget(profile, authUser, onSignOut, onWorkspace) {
  document.getElementById('saas-account-widget')?.remove();
  const widget = document.createElement('aside');
  widget.id = 'saas-account-widget';
  widget.className = 'saas-account-widget';
  let maintenanceBlocked = false;
  const render = () => {
    const lang = getLang();
    const roleBadge = profile.role === 'admin'
      ? 'ADMIN'
      : (canAccessCms(profile)
        ? String(profile.role).toUpperCase()
        : (profile.tier === 'premium' ? 'PREMIUM' : 'FREE'));
    const blockedTitle = maintenanceBlocked ? ` disabled aria-disabled="true" title="${escapeHtml(saasT('maintenanceWorkspaceBlocked', null, lang))}"` : '';
    widget.innerHTML = `<span class="saas-account-dot"></span><span class="saas-account-copy"><strong>${escapeHtml(authUser.displayName || authUser.email || 'SafeLift3D user')}</strong><small>${escapeHtml(roleBadge)}</small></span><button type="button" data-action="workspace"${blockedTitle}>${saasT('saasMyWorkspace', null, lang)}</button>${canAccessCms(profile) ? `<a href="/admin">${saasT('saasAdminCms', null, lang)}</a>` : ''}<button type="button" data-action="signout">${saasT('adminSignOut', null, lang)}</button>`;
    widget.querySelector('[data-action="workspace"]')?.addEventListener('click', () => {
      if (!maintenanceBlocked) onWorkspace();
    });
    widget.querySelector('[data-action="signout"]')?.addEventListener('click', async (event) => {
      const button = event.currentTarget;
      button.disabled = true;
      try {
        await onSignOut();
      } catch (error) {
        console.error('[SafeLift3D] Sign-out failed', error);
        button.disabled = false;
        button.textContent = saasT('saasSignOutFailedRetry', null, lang);
      }
    });
  };
  const onLanguageChanged = () => render();
  render();
  window.addEventListener('safelift:language-changed', onLanguageChanged);
  const accountMenu = document.getElementById('dropdown-panel-system');
  (accountMenu || document.body).append(widget);
  return {
    setMaintenance(blocked) {
      if (maintenanceBlocked === Boolean(blocked)) return;
      maintenanceBlocked = Boolean(blocked);
      render();
    },
    dispose() {
      window.removeEventListener('safelift:language-changed', onLanguageChanged);
      widget.remove();
    }
  };
}

export function openDeveloperContact() {
  let lastFeedbackAt = 0;
  const lang = getLang();
  const tr = (key) => saasT(key, null, lang);
  document.getElementById('saas-contact-dialog')?.remove();
  const dialog = document.createElement('div');
  dialog.id = 'saas-contact-dialog';
  dialog.className = 'saas-contact-backdrop';
  dialog.innerHTML = `<section class="saas-contact-dialog" role="dialog" aria-modal="true" aria-labelledby="saas-contact-title">
    <button type="button" class="saas-contact-close" aria-label="${tr('saasClose')}" data-contact-close>×</button>
    <div class="saas-contact-kicker">SAFELIFT3D · DEVELOPER</div>
    <h2 id="saas-contact-title">${tr('saasContactTitle')}</h2>
    <p class="saas-contact-person">Lê Việt Phương (Mr)</p>
    <div class="saas-contact-details"><a href="mailto:levietphuong.hcmutrans@gmail.com">levietphuong.hcmutrans@gmail.com</a><a href="tel:+84968051697">+84 968 051 697</a></div>
    <form class="saas-contact-form">
      <label>${tr('saasContactSubjectLabel')}<input name="subject" maxlength="120" required value="${tr('saasContactSubjectDefault')}"></label>
      <label>${tr('saasContactMessageLabel')}<textarea name="message" maxlength="3000" rows="5" required placeholder="${tr('saasContactMessagePlaceholder')}"></textarea></label>
      <small>${tr('saasContactMailHint')}</small>
      <button type="submit" class="saas-primary-button">${tr('saasContactSubmit')}</button>
    </form>
  </section>`;
  let releaseFocusTrap = () => {};
  const close = () => { dialog.remove(); releaseFocusTrap(); };
  dialog.addEventListener('click', (event) => { if (event.target === dialog || event.target.closest('[data-contact-close]')) close(); });
  dialog.addEventListener('keydown', (event) => { if (event.key === 'Escape') close(); });
  dialog.querySelector('form')?.addEventListener('submit', (event) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const now = Date.now();
    try {
      const href = buildDeveloperContactMailto({
        subject: form.get('subject'),
        message: form.get('message'),
        lastSentAt: lastFeedbackAt,
        now
      });
      lastFeedbackAt = now;
      window.location.href = href;
      close();
    } catch {
      /* Keep dialog open when input is blank or cooldown is active. */
    }
  });
  document.body.append(dialog);
  releaseFocusTrap = trapDialogFocus(dialog.querySelector('[role="dialog"]'), { initialFocus: dialog.querySelector('[name="message"]') });
}

export function installSessionShellUI({ getProfile, getFlags }) {
  let maintenanceBanner = null;
  const contactButton = document.getElementById('btn-contact-developer');
  const renderContactLabel = () => {
    const label = contactButton?.querySelector('[data-contact-label]');
    if (label) label.textContent = saasT('saasContactButton');
  };
  const syncMaintenanceBanner = (profile, flags) => {
    if (!flags || !isMaintenance(flags, profile)) {
      maintenanceBanner?.remove();
      maintenanceBanner = null;
      return;
    }
    if (!maintenanceBanner) {
      maintenanceBanner = document.createElement('div');
      maintenanceBanner.id = 'saas-maintenance-banner';
      maintenanceBanner.className = 'saas-maintenance-banner';
      maintenanceBanner.setAttribute('role', 'status');
      maintenanceBanner.setAttribute('aria-live', 'polite');
    }
    const lang = getLang();
    maintenanceBanner.innerHTML = `<strong>${escapeHtml(saasT('maintenanceBannerTitle', null, lang))}:</strong> <span>${escapeHtml(flags.maintenanceMessage || saasT('maintenanceDefaultMsg', null, lang))}</span>`;
    if (!maintenanceBanner.isConnected) document.body.append(maintenanceBanner);
  };
  const onLanguageRefresh = () => {
    renderContactLabel();
    syncMaintenanceBanner(getProfile(), getFlags());
  };
  const onContactClick = () => openDeveloperContact();
  contactButton?.addEventListener('click', onContactClick);
  window.addEventListener('safelift:language-changed', onLanguageRefresh);
  renderContactLabel();
  return {
    syncMaintenanceBanner,
    dispose() {
      contactButton?.removeEventListener('click', onContactClick);
      window.removeEventListener('safelift:language-changed', onLanguageRefresh);
      syncMaintenanceBanner(null, null);
      document.getElementById('saas-contact-dialog')?.remove();
    }
  };
}
