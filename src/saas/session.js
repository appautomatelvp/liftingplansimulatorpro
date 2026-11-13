import {
  createUserWithEmailAndPassword,
  GoogleAuthProvider,
  onAuthStateChanged,
  reload,
  sendEmailVerification,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  updateProfile
} from 'firebase/auth';
import { mountAuthScreen } from './auth_screen.js';
import { mountAdminDashboard } from './admin_dashboard.js';
import { ensureUserProfile, watchUserProfile } from './firebase_data.js';
import { initializeFirebaseClient, getFirebaseSetupStatus } from './firebase.js';
import { installFeatureAccessUI } from './feature_access_ui.js';
import { needsEmailVerification } from './access.js';
import { getLang, t } from '../i18n/index.js';
import { saasT } from './i18n.js';
import { installBoundedErrorCounter } from './telemetry_usage.js';
import { mountWorkspaceDashboard } from './workspace_dashboard.js';
import { trapDialogFocus } from './dialog_accessibility.js';

function ensureRoot() {
  let root = document.getElementById('saas-root');
  if (!root) {
    root = document.createElement('div');
    root.id = 'saas-root';
    document.body.append(root);
  }
  root.hidden = false;
  return root;
}

function clearSplash() {
  const splash = document.getElementById('app-loading-screen');
  if (splash) splash.remove();
}

function mountAccountWidget(profile, authUser, onSignOut, onWorkspace) {
  document.getElementById('saas-account-widget')?.remove();
  const widget = document.createElement('aside');
  widget.id = 'saas-account-widget';
  widget.className = 'saas-account-widget';
  const render = () => {
    const lang = getLang();
    widget.innerHTML = `<span class="saas-account-dot"></span><span class="saas-account-copy"><strong>${escapeHtml(authUser.displayName || authUser.email || 'SafeLift3D user')}</strong><small>${profile.role === 'admin' ? 'ADMIN' : (profile.tier === 'premium' ? 'PREMIUM' : 'FREE')}</small></span><button type="button" data-action="workspace">${saasT('saasMyWorkspace', null, lang)}</button>${profile.role === 'admin' ? `<a href="/admin">${saasT('saasAdminCms', null, lang)}</a>` : ''}<button type="button" data-action="signout">${saasT('adminSignOut', null, lang)}</button>`;
    widget.querySelector('[data-action="workspace"]')?.addEventListener('click', onWorkspace);
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
    dispose() {
      window.removeEventListener('safelift:language-changed', onLanguageChanged);
      widget.remove();
    }
  };
}

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch]);
}

function createGoogleProvider() {
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: 'select_account' });
  return provider;
}

function openDeveloperContact() {
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
    const subject = String(form.get('subject') || '').trim().slice(0, 120);
    const message = String(form.get('message') || '').trim().slice(0, 3000);
    if (!subject || !message) return;
    window.location.href = `mailto:levietphuong.hcmutrans@gmail.com?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(message)}`;
    close();
  });
  document.body.append(dialog);
  releaseFocusTrap = trapDialogFocus(dialog.querySelector('[role="dialog"]'), { initialFocus: dialog.querySelector('[name="message"]') });
}

export function installSaasSession({ onWorkspaceAuthorized, onProfileChange, onSignedOut }) {
  document.body.classList.add('saas-locked');
  installBoundedErrorCounter();
  const root = ensureRoot();
  const featureAccess = installFeatureAccessUI();
  let authScreen = null;
  let adminScreen = null;
  let accountWidget = null;
  let workspaceDashboard = null;
  let unsubscribeAuth = null;
  let unsubscribeProfile = null;
  let currentUser = null;
  let workspaceStarted = false;
  let authRun = 0;
  let lastProfileKey = '';
  let pendingAuthNotice = null;
  let firebase = null;
  const onAdminRoute = window.location.pathname.replace(/\/$/, '') === '/admin';
  const contactButton = document.getElementById('btn-contact-developer');
  const renderContactLabel = () => {
    const label = contactButton?.querySelector('[data-contact-label]');
    if (label) label.textContent = saasT('saasContactButton');
  };
  const onContactClick = () => openDeveloperContact();
  contactButton?.addEventListener('click', onContactClick);
  window.addEventListener('safelift:language-changed', renderContactLabel);
  renderContactLabel();

  window.SafeLift.saas = { profile: null, authUser: null, db: null, canAccessFeature: () => false };

  function showInitial(message, isError = false) {
    root.hidden = false;
    if (authScreen) authScreen.dispose();
    authScreen = mountAuthScreen(root, {
      lang: getLang,
      configured: Boolean(firebase?.configured),
      actions: {
        signIn(email, password) { return signInWithEmailAndPassword(firebase.auth, email, password); },
        create(email, password, displayName) {
          return createUserWithEmailAndPassword(firebase.auth, email, password).then(async (credential) => {
            if (displayName) await updateProfile(credential.user, { displayName });
            await sendEmailVerification(credential.user);
            return credential;
          });
        },
        google() { return signInWithPopup(firebase.auth, createGoogleProvider()); },
        reset(email) { return sendPasswordResetEmail(firebase.auth, email); }
      },
      onLanguageChange() {
        const lang = window.SafeLift.i18n.toggleLang();
        window.__SAFELIFT_BOOT_LANG__ = lang;
        authScreen?.setLanguage();
      }
    });
    clearSplash();
    if (message) authScreen.showMessage(message, isError);
  }

  function showConfigError(error) {
    console.error('[SafeLift3D] Firebase initialization failed', error);
    if (authScreen) authScreen.dispose();
    authScreen = mountAuthScreen(root, {
      lang: getLang,
      configured: false,
      actions: {},
      onLanguageChange() {
        const lang = window.SafeLift.i18n.toggleLang();
        window.__SAFELIFT_BOOT_LANG__ = lang;
        authScreen?.setLanguage();
      }
    });
    clearSplash();
  }

  function handleProfile(profile, authUser) {
    const profileKey = JSON.stringify({ uid: authUser.uid, role: profile.role, tier: profile.tier, status: profile.status, displayName: profile.displayName, email: profile.email });
    if (profileKey === lastProfileKey) return;
    lastProfileKey = profileKey;
    window.SafeLift.saas.profile = profile;
    window.SafeLift.saas.authUser = authUser;
    featureAccess.setProfile(profile);
    onProfileChange?.(profile, authUser);
    if (onAdminRoute) {
      adminScreen?.dispose();
      root.hidden = false;
      if (authScreen) { authScreen.dispose(); authScreen = null; }
      adminScreen = mountAdminDashboard(root, {
        db: firebase.db,
        profile,
        authUser,
        signOut: () => signOut(firebase.auth)
      });
      clearSplash();
      return;
    }
    if (authScreen) { authScreen.dispose(); authScreen = null; }
    root.hidden = true;
    accountWidget?.dispose();
    accountWidget = mountAccountWidget(profile, authUser, () => signOut(firebase.auth), () => {
      workspaceDashboard?.dispose();
      workspaceDashboard = mountWorkspaceDashboard({ db: firebase.db, profile });
    });
    if (!workspaceStarted) {
      workspaceStarted = true;
      onWorkspaceAuthorized?.({ profile, authUser, db: firebase.db, auth: firebase.auth, featureAccess });
    }
  }

  function showSignedOut() {
    authRun++;
    unsubscribeProfile?.();
    unsubscribeProfile = null;
    currentUser = null;
    lastProfileKey = '';
    accountWidget?.dispose();
    accountWidget = null;
    workspaceDashboard?.dispose();
    workspaceDashboard = null;
    window.SafeLift.saas.profile = null;
    window.SafeLift.saas.authUser = null;
    window.SafeLift.saas.canAccessFeature = () => false;
    featureAccess.setProfile(null);
    adminScreen?.dispose();
    adminScreen = null;
    const notice = pendingAuthNotice;
    pendingAuthNotice = null;
    if (firebase?.configured) showInitial(notice?.message, Boolean(notice?.isError));
    else if (import.meta.env.DEV && import.meta.env.VITE_AUTH_DEV_BYPASS === 'true') return;
    onSignedOut?.();
  }

  if (import.meta.env.DEV && import.meta.env.VITE_AUTH_DEV_BYPASS === 'true') {
    console.warn('[SafeLift3D] Development-only authentication bypass is active.');
    firebase = { configured: false, auth: null, db: null };
    window.SafeLift.saas.db = null;
    const profile = { uid: 'local-developer', email: 'local@localhost', displayName: 'Local Developer', role: 'user', tier: 'free', status: 'active' };
    const authUser = { uid: profile.uid, email: profile.email, displayName: profile.displayName, emailVerified: true };
    handleProfile(profile, authUser);
    return { dispose() { featureAccess.dispose(); } };
  }

  try {
    firebase = initializeFirebaseClient();
    window.SafeLift.saas.db = firebase.db;
  } catch (error) {
    const setup = getFirebaseSetupStatus();
    firebase = { ...setup, configured: false, auth: null, db: null };
    showConfigError(error);
    return { dispose() { featureAccess.dispose(); } };
  }

  if (!firebase.configured) {
    showInitial();
    return { dispose() { featureAccess.dispose(); } };
  }

  authScreen = mountAuthScreen(root, {
    lang: getLang,
    configured: true,
    actions: {
      signIn(email, password) { return signInWithEmailAndPassword(firebase.auth, email, password); },
      async create(email, password, displayName) {
        const credential = await createUserWithEmailAndPassword(firebase.auth, email, password);
        if (displayName) await updateProfile(credential.user, { displayName });
        await sendEmailVerification(credential.user);
        return credential;
      },
      google() { return signInWithPopup(firebase.auth, createGoogleProvider()); },
      reset(email) { return sendPasswordResetEmail(firebase.auth, email); }
    },
    onLanguageChange() {
      const lang = window.SafeLift.i18n.toggleLang();
      window.__SAFELIFT_BOOT_LANG__ = lang;
      authScreen?.setLanguage();
    }
  });
  clearSplash();

  async function completeAuthorizedSession(authUser, run) {
    if (authScreen) authScreen.showMessage(saasT('saasCheckingAccess'));
    try {
      const profile = await ensureUserProfile(firebase.db, authUser);
      if (run !== authRun) return;
      unsubscribeProfile?.();
      unsubscribeProfile = watchUserProfile(firebase.db, authUser.uid, (freshProfile) => {
        if (!freshProfile || freshProfile.status !== 'active') {
          pendingAuthNotice = { message: saasT('saasAccountSuspended'), isError: true };
          if (authScreen) authScreen.showMessage(saasT('saasAccountSuspended'), true);
          signOut(firebase.auth).catch((error) => console.error('[SafeLift3D] Sign-out failed', error));
          return;
        }
        handleProfile(freshProfile, authUser);
      }, (error) => console.error('[SafeLift3D] Profile watch failed', error));
      handleProfile(profile, authUser);
    } catch (error) {
      if (run !== authRun) return;
      console.error('[SafeLift3D] Account profile could not be loaded', error);
      if (error?.code === 'safelift/account-suspended') {
        const suspendedMsg = saasT('saasAccountSuspendedContact');
        pendingAuthNotice = { message: suspendedMsg, isError: true };
        authScreen?.showMessage(suspendedMsg, true);
        await signOut(firebase.auth);
      } else {
        authScreen?.showMessage(t('authVerifyAccountError', getLang()), true);
      }
    }
  }

  unsubscribeAuth = onAuthStateChanged(firebase.auth, async (authUser) => {
    if (!authUser) {
      if (currentUser) showSignedOut();
      else if (!workspaceStarted && onAdminRoute) showInitial();
      return;
    }
    currentUser = authUser;
    const run = ++authRun;
    if (needsEmailVerification(authUser)) {
      authScreen?.showVerificationPending({
        email: authUser.email,
        onResend: () => sendEmailVerification(firebase.auth.currentUser || authUser),
        onCheckVerified: async () => {
          const target = firebase.auth.currentUser || authUser;
          await reload(target);
          if (needsEmailVerification(target)) return false;
          if (typeof target.getIdToken === 'function') await target.getIdToken(true);
          authScreen?.clearVerificationPending();
          await completeAuthorizedSession(target, run);
          return true;
        },
        onSignOut: () => signOut(firebase.auth)
      });
      return;
    }
    await completeAuthorizedSession(authUser, run);
  });

  return {
    dispose() {
      unsubscribeAuth?.();
      unsubscribeProfile?.();
      contactButton?.removeEventListener('click', onContactClick);
      window.removeEventListener('safelift:language-changed', renderContactLabel);
      document.getElementById('saas-contact-dialog')?.remove();
      authScreen?.dispose();
      adminScreen?.dispose();
      accountWidget?.dispose();
      workspaceDashboard?.dispose();
      featureAccess.dispose();
    }
  };
}
