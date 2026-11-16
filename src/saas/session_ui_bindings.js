// @purpose: Gắn kết giao diện header, widget tài khoản, banner bảo trì và hộp thoại liên hệ SaaS
import { canAccessCms } from './cms_data.js';
import { getLang } from '../i18n/index.js';
import { saasT } from './i18n.js';
import { isMaintenance } from './runtime_flags.js';
import { openDeveloperContact } from './contact_dialog.js';

export { openDeveloperContact };

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

export function playCinemaWorkspaceReveal() {
  if (typeof document === 'undefined' || !document.body) return;
  document.getElementById('saas-cinema-curtain')?.remove();
  const curtain = document.createElement('div');
  curtain.id = 'saas-cinema-curtain';
  curtain.className = 'saas-cinema-curtain';
  curtain.setAttribute('aria-hidden', 'true');
  document.body.append(curtain);

  let revealed = false;
  let observer = null;
  const startReveal = () => {
    if (revealed) return;
    revealed = true;
    observer?.disconnect();
    document.body.classList.add('saas-cinema-entering');
    requestAnimationFrame(() => {
      curtain.classList.add('is-revealing');
    });
    setTimeout(() => {
      curtain.remove();
      document.body?.classList.remove('saas-cinema-entering');
    }, 900);
  };

  if (document.body.classList.contains('app-ready')) {
    setTimeout(startReveal, 220);
  } else if (typeof MutationObserver !== 'undefined') {
    observer = new MutationObserver(() => {
      if (document.body.classList.contains('app-ready')) startReveal();
    });
    observer.observe(document.body, { attributes: true, attributeFilter: ['class'] });
    setTimeout(startReveal, 1600);
  } else {
    setTimeout(startReveal, 900);
  }
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
