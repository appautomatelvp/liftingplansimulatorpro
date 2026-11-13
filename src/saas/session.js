import {
  createUserWithEmailAndPassword,
  GoogleAuthProvider,
  onAuthStateChanged,
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
import { getLang } from '../i18n/index.js';

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

function mountAccountWidget(profile, authUser, onSignOut) {
  document.getElementById('saas-account-widget')?.remove();
  const widget = document.createElement('aside');
  widget.id = 'saas-account-widget';
  widget.className = 'saas-account-widget';
  const render = () => {
    const en = getLang() === 'en';
    widget.innerHTML = `<span class="saas-account-dot"></span><span class="saas-account-copy"><strong>${escapeHtml(authUser.displayName || authUser.email || 'SafeLift3D user')}</strong><small>${profile.role === 'admin' ? 'ADMIN' : (profile.tier === 'premium' ? 'PREMIUM' : 'FREE')}</small></span>${profile.role === 'admin' ? `<a href="/admin">${en ? 'Admin CMS' : 'CMS quản trị'}</a>` : ''}<button type="button" data-action="signout">${en ? 'Sign out' : 'Đăng xuất'}</button>`;
    widget.querySelector('[data-action="signout"]')?.addEventListener('click', onSignOut);
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

export function installSaasSession({ onWorkspaceAuthorized, onProfileChange, onSignedOut }) {
  document.body.classList.add('saas-locked');
  const root = ensureRoot();
  const featureAccess = installFeatureAccessUI();
  let authScreen = null;
  let adminScreen = null;
  let accountWidget = null;
  let unsubscribeAuth = null;
  let unsubscribeProfile = null;
  let currentUser = null;
  let workspaceStarted = false;
  let authRun = 0;
  let lastProfileKey = '';
  let firebase = null;
  const onAdminRoute = window.location.pathname.replace(/\/$/, '') === '/admin';

  window.SafeLift.saas = { profile: null, authUser: null, db: null, canAccessFeature: () => false };

  function showInitial(message, isError = false) {
    if (authScreen) authScreen.dispose();
    authScreen = mountAuthScreen(root, {
      lang: getLang,
      configured: Boolean(firebase?.configured),
      actions: {
        signIn(email, password) { return signInWithEmailAndPassword(firebase.auth, email, password); },
        create(email, password, displayName) {
          return createUserWithEmailAndPassword(firebase.auth, email, password).then(async (credential) => {
            if (displayName) await updateProfile(credential.user, { displayName });
            return credential;
          });
        },
        google() { return signInWithPopup(firebase.auth, new GoogleAuthProvider()); },
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
    accountWidget = mountAccountWidget(profile, authUser, () => signOut(firebase.auth));
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
    window.SafeLift.saas.profile = null;
    window.SafeLift.saas.authUser = null;
    window.SafeLift.saas.canAccessFeature = () => false;
    featureAccess.setProfile(null);
    adminScreen?.dispose();
    adminScreen = null;
    if (firebase?.configured) showInitial();
    else if (import.meta.env.DEV && import.meta.env.VITE_AUTH_DEV_BYPASS === 'true') return;
    onSignedOut?.();
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
    if (import.meta.env.DEV && import.meta.env.VITE_AUTH_DEV_BYPASS === 'true') {
      console.warn('[SafeLift3D] Development-only authentication bypass is active.');
      const profile = { uid: 'local-developer', email: 'local@localhost', displayName: 'Local Developer', role: 'user', tier: 'free', status: 'active' };
      const authUser = { uid: profile.uid, email: profile.email, displayName: profile.displayName };
      handleProfile(profile, authUser);
      return { dispose() { featureAccess.dispose(); } };
    }
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
        return credential;
      },
      google() { return signInWithPopup(firebase.auth, new GoogleAuthProvider()); },
      reset(email) { return sendPasswordResetEmail(firebase.auth, email); }
    },
    onLanguageChange() {
      const lang = window.SafeLift.i18n.toggleLang();
      window.__SAFELIFT_BOOT_LANG__ = lang;
      authScreen?.setLanguage();
    }
  });
  clearSplash();

  unsubscribeAuth = onAuthStateChanged(firebase.auth, async (authUser) => {
    if (!authUser) {
      if (currentUser) showSignedOut();
      else if (!workspaceStarted && onAdminRoute) showInitial();
      return;
    }
    currentUser = authUser;
    const run = ++authRun;
    if (authScreen) authScreen.showMessage(getLang() === 'en' ? 'Checking account access…' : 'Đang kiểm tra quyền tài khoản…');
    try {
      const profile = await ensureUserProfile(firebase.db, authUser);
      if (run !== authRun) return;
      unsubscribeProfile?.();
      unsubscribeProfile = watchUserProfile(firebase.db, authUser.uid, (freshProfile) => {
        if (!freshProfile || freshProfile.status !== 'active') {
          const msg = getLang() === 'en' ? 'This account has been suspended.' : 'Tài khoản này đã bị khóa.';
          if (authScreen) authScreen.showMessage(msg, true);
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
        authScreen?.showMessage(getLang() === 'en' ? error.message : 'Tài khoản đang bị khóa. Vui lòng liên hệ SafeLift3D.', true);
        await signOut(firebase.auth);
      } else {
        authScreen?.showMessage(getLang() === 'en'
          ? 'Could not verify your account. Check your connection and Firestore rules.'
          : 'Không thể xác minh tài khoản. Kiểm tra kết nối và Firestore rules.', true);
      }
    }
  });

  return {
    dispose() {
      unsubscribeAuth?.();
      unsubscribeProfile?.();
      authScreen?.dispose();
      adminScreen?.dispose();
      accountWidget?.dispose();
      featureAccess.dispose();
    }
  };
}
