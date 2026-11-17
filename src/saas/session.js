import {
  createUserWithEmailAndPassword, GoogleAuthProvider, onAuthStateChanged,
  reload, sendEmailVerification, sendPasswordResetEmail,
  signInWithEmailAndPassword, signInWithPopup, signOut, updateProfile
} from 'firebase/auth';
import { mountAuthScreen } from './auth_screen.js';
import { mountAdminDashboard } from './admin_dashboard.js';
import { ensureUserProfile, watchUserProfile } from './firebase_data.js';
import { initializeFirebaseClient, getFirebaseSetupStatus } from './firebase.js';
import { installFeatureAccessUI } from './feature_access_ui.js';
import { needsEmailVerification } from './access.js';
import { getLang, t } from '../i18n/index.js';
import { saasT } from './i18n.js';
import { installBoundedErrorCounter, normalizeFeatureFlags, readFeatureFlags } from './telemetry_usage.js';
import { isMaintenance, loadFlagsOnce } from './runtime_flags.js';
import { mountWorkspaceDashboard } from './workspace_dashboard.js';
import { mountTrialCountdownBanner } from './trial_banner.js';
import { openDeveloperContact } from './contact_dialog.js';
import { clearAppSplash, ensureSaasRoot, installSessionShellUI, mountAccountWidget, playCinemaWorkspaceReveal } from './session_ui_bindings.js';

function createGoogleProvider() {
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: 'select_account' });
  return provider;
}

export function installSaasSession({ onWorkspaceAuthorized, onProfileChange, onSignedOut }) {
  document.body.classList.add('saas-locked');
  installBoundedErrorCounter();
  const root = ensureSaasRoot();
  const featureAccess = installFeatureAccessUI();
  let authScreen = null;
  let adminScreen = null;
  let accountWidget = null;
  let workspaceDashboard = null;
  let trialBanner = null;
  let unsubscribeAuth = null;
  let unsubscribeProfile = null;
  let currentUser = null;
  let workspaceStarted = false;
  let authRun = 0;
  let lastProfileKey = '';
  let pendingAuthNotice = null;
  let sessionFlags = null;
  let loadSessionFlags = null;
  let firebase = null;
  const onAdminRoute = window.location.pathname.replace(/\/$/, '') === '/admin';
  const { syncMaintenanceBanner, dispose: disposeShellUI } = installSessionShellUI({ getProfile: () => window.SafeLift?.saas?.profile, getFlags: () => sessionFlags });

  window.SafeLift.saas = { profile: null, authUser: null, db: null, flags: null, canAccessFeature: () => false };

  function buildAuthActions() {
    return {
      signIn(email, password) { return signInWithEmailAndPassword(firebase.auth, email, password); },
      async create(email, password, displayName) {
        const credential = await createUserWithEmailAndPassword(firebase.auth, email, password);
        if (displayName) await updateProfile(credential.user, { displayName });
        await sendEmailVerification(credential.user);
        return credential;
      },
      google() { return signInWithPopup(firebase.auth, createGoogleProvider()); },
      reset(email) { return sendPasswordResetEmail(firebase.auth, email); }
    };
  }

  function renderAuthView({ configured = Boolean(firebase?.configured), message = '', isError = false } = {}) {
    root.hidden = false;
    if (authScreen) authScreen.dispose();
    authScreen = mountAuthScreen(root, {
      lang: getLang,
      configured: Boolean(configured),
      actions: configured ? buildAuthActions() : {},
      onLanguageChange() {
        const lang = window.SafeLift.i18n.toggleLang();
        window.__SAFELIFT_BOOT_LANG__ = lang;
        authScreen?.setLanguage();
      }
    });
    clearAppSplash();
    if (message) authScreen.showMessage(message, isError);
  }

  const showInitial = (message, isError = false) => renderAuthView({ configured: Boolean(firebase?.configured), message, isError });
  const showConfigError = (error) => { console.error('[SafeLift3D] Firebase initialization failed', error); renderAuthView({ configured: false }); };

  function syncFlagsToUI(profile, flags) {
    featureAccess.setFlags(flags);
    syncMaintenanceBanner(profile, flags);
    accountWidget?.setMaintenance(isMaintenance(flags, profile));
  }

  function applyRuntimeFlags(profile) {
    if (!loadSessionFlags) {
      loadSessionFlags = loadFlagsOnce(() => (firebase?.db ? readFeatureFlags(firebase.db) : normalizeFeatureFlags({})));
    }
    loadSessionFlags().then((loaded) => {
      sessionFlags = loaded;
      const latestProfile = window.SafeLift?.saas?.profile || profile;
      if (latestProfile) syncFlagsToUI(latestProfile, loaded);
    }).catch(() => {});
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
      adminScreen = mountAdminDashboard(root, { db: firebase.db, profile, authUser, signOut: () => signOut(firebase.auth) });
      clearAppSplash();
      return;
    }
    const enteringFromAuth = Boolean(authScreen);
    if (authScreen) { authScreen.dispose(); authScreen = null; }
    root.hidden = true;
    if (enteringFromAuth) playCinemaWorkspaceReveal();
    accountWidget?.dispose();
    accountWidget = mountAccountWidget(profile, authUser, () => signOut(firebase.auth), () => {
      if (isMaintenance(sessionFlags, window.SafeLift?.saas?.profile || profile)) {
        syncMaintenanceBanner(window.SafeLift?.saas?.profile || profile, sessionFlags);
        return;
      }
      workspaceDashboard?.dispose();
      workspaceDashboard = mountWorkspaceDashboard({ db: firebase.db, profile, flags: sessionFlags });
    });
    if (sessionFlags) syncFlagsToUI(profile, sessionFlags);
    else applyRuntimeFlags(profile);
    if (!trialBanner) {
      trialBanner = mountTrialCountdownBanner({
        getProfile: () => window.SafeLift?.saas?.profile,
        onExpired: (expiredProfile) => {
          featureAccess.setProfile(expiredProfile);
          onProfileChange?.(expiredProfile, authUser);
          window.dispatchEvent(new CustomEvent('safelift:trial-expired', { detail: { uid: expiredProfile?.uid } }));
        },
        onUpgrade: () => openDeveloperContact({ category: 'enterprise', subject: 'Upgrade SafeLift3D Pro License' })
      });
    } else {
      trialBanner.sync();
    }
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
    sessionFlags = null;
    loadSessionFlags = null;
    syncMaintenanceBanner(null, null);
    featureAccess.setFlags(null);
    accountWidget?.dispose();
    accountWidget = null;
    trialBanner?.dispose();
    trialBanner = null;
    workspaceDashboard?.dispose();
    workspaceDashboard = null;
    window.SafeLift.saas.profile = null;
    window.SafeLift.saas.authUser = null;
    window.SafeLift.saas.flags = null;
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

  async function completeAuthorizedSession(authUser, run) {
    if (authScreen) authScreen.showMessage(saasT('saasCheckingAccess'));
    try {
      const profile = await ensureUserProfile(firebase.db, authUser);
      if (run !== authRun) return;
      unsubscribeProfile?.();
      unsubscribeProfile = watchUserProfile(firebase.db, authUser.uid, (freshProfile) => {
        if (!freshProfile || freshProfile.status !== 'active') {
          pendingAuthNotice = { message: saasT('saasAccountSuspended'), isError: true };
          showSignedOut();
          signOut(firebase.auth).catch((error) => console.error('[SafeLift3D] Sign-out failed', error));
          return;
        }
        handleProfile(freshProfile, authUser);
      }, (error) => console.error('[SafeLift3D] Profile watch failed', error));
      handleProfile(profile, authUser);
    } catch (error) {
      if (run !== authRun) return;
      console.error('[SafeLift3D] Account profile could not be loaded', error);
      if (!authScreen) showInitial();
      if (error?.code === 'safelift/account-suspended') {
        const suspendedMsg = saasT('saasAccountSuspendedContact');
        pendingAuthNotice = { message: suspendedMsg, isError: true };
        authScreen?.showMessage(suspendedMsg, true);
        await signOut(firebase.auth).catch(() => {});
      } else {
        authScreen?.showMessage(t('authVerifyAccountError', getLang()), true);
      }
    }
  }

  unsubscribeAuth = onAuthStateChanged(firebase.auth, async (authUser) => {
    if (!authUser) {
      if (currentUser) showSignedOut();
      else if (!workspaceStarted) showInitial();
      return;
    }
    currentUser = authUser;
    const run = ++authRun;
    if (needsEmailVerification(authUser)) {
      if (!authScreen) showInitial();
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
      disposeShellUI();
      authScreen?.dispose();
      adminScreen?.dispose();
      accountWidget?.dispose();
      trialBanner?.dispose();
      workspaceDashboard?.dispose();
      featureAccess.dispose();
    }
  };
}
