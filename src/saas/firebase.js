import { initializeApp, getApps } from 'firebase/app';
import { initializeAppCheck, ReCaptchaEnterpriseProvider } from 'firebase/app-check';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { validateDeploymentEnvironment } from './deployment_environment.js';
import { requiresAppCheckSiteKey, resolveAppCheckSiteKey } from './app_check_config.js';

const env = import.meta.env;
const appEnvironment = env.VITE_APP_ENV || 'development';

// Firebase Web configuration and the App Check site key are public client-side
// identifiers. Keep these defaults so static hosts that do not expose build
// variables still initialize the configured SafeLift3D Firebase project.
const defaultFirebaseConfig = {
  apiKey: 'AIzaSyBIpTKRD6YwclG_8CVoA0dvfo5Xqo6AJHE',
  authDomain: 'safelift3d.firebaseapp.com',
  projectId: 'safelift3d',
  appId: '1:736616598477:web:1a53b1932ce5c433111284',
  messagingSenderId: '736616598477',
  storageBucket: 'safelift3d.firebasestorage.app'
};
const defaultAppCheckSiteKey = '6LcT4R0uAAAAAFn1R33TccDuguLZshAlgz-0S2mo';

function readAppCheckSiteKey() {
  return resolveAppCheckSiteKey({
    environment: appEnvironment,
    configuredSiteKey: env.VITE_FIREBASE_APPCHECK_SITE_KEY,
    productionSiteKey: defaultAppCheckSiteKey
  });
}

function readFirebaseConfig() {
  const useIsolatedConfig = appEnvironment === 'preview' || appEnvironment === 'staging';
  return {
    apiKey: env.VITE_FIREBASE_API_KEY || (useIsolatedConfig ? '' : defaultFirebaseConfig.apiKey),
    authDomain: env.VITE_FIREBASE_AUTH_DOMAIN || (useIsolatedConfig ? '' : defaultFirebaseConfig.authDomain),
    projectId: env.VITE_FIREBASE_PROJECT_ID || (useIsolatedConfig ? '' : defaultFirebaseConfig.projectId),
    appId: env.VITE_FIREBASE_APP_ID || (useIsolatedConfig ? '' : defaultFirebaseConfig.appId),
    messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID || (useIsolatedConfig ? '' : defaultFirebaseConfig.messagingSenderId),
    storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET || (useIsolatedConfig ? '' : defaultFirebaseConfig.storageBucket)
  };
}

export function getFirebaseSetupStatus() {
  const config = readFirebaseConfig();
  const required = ['apiKey', 'authDomain', 'projectId', 'appId'];
  const missing = required.filter((key) => !config[key]);
  const appCheckSiteKey = readAppCheckSiteKey();
  if (requiresAppCheckSiteKey({ buildIsProduction: env.PROD, environment: appEnvironment }) && !appCheckSiteKey) {
    missing.push('VITE_FIREBASE_APPCHECK_SITE_KEY');
  }
  const deployment = validateDeploymentEnvironment({
    environment: appEnvironment,
    projectId: config.projectId,
    productionProjectId: defaultFirebaseConfig.projectId
  });
  return { configured: missing.length === 0 && deployment.valid, missing, config, deployment };
}

export function initializeFirebaseClient() {
  const setup = getFirebaseSetupStatus();
  if (!setup.configured) return { ...setup, app: null, auth: null, db: null, appCheck: null };

  const app = getApps()[0] || initializeApp(setup.config);
  let appCheck = null;
  const siteKey = readAppCheckSiteKey();

  if (siteKey) {
    if (env.DEV && env.VITE_FIREBASE_APPCHECK_DEBUG === 'true') {
      self.FIREBASE_APPCHECK_DEBUG_TOKEN = true;
    }
    appCheck = initializeAppCheck(app, {
      provider: new ReCaptchaEnterpriseProvider(siteKey),
      isTokenAutoRefreshEnabled: true
    });
  } else if (requiresAppCheckSiteKey({ buildIsProduction: env.PROD, environment: appEnvironment })) {
    throw new Error('Firebase App Check reCAPTCHA v3 site key is required in production.');
  }

  // App Check is initialized before obtaining Auth or Firestore instances.
  const auth = getAuth(app);
  const db = getFirestore(app);
  return { ...setup, app, auth, db, appCheck };
}
