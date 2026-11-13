import { initializeApp, getApps } from 'firebase/app';
import { initializeAppCheck, ReCaptchaEnterpriseProvider } from 'firebase/app-check';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

const env = import.meta.env;

function readFirebaseConfig() {
  return {
    apiKey: env.VITE_FIREBASE_API_KEY,
    authDomain: env.VITE_FIREBASE_AUTH_DOMAIN,
    projectId: env.VITE_FIREBASE_PROJECT_ID,
    appId: env.VITE_FIREBASE_APP_ID,
    messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID,
    storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET
  };
}

export function getFirebaseSetupStatus() {
  const config = readFirebaseConfig();
  const required = ['apiKey', 'authDomain', 'projectId', 'appId'];
  const missing = required.filter((key) => !config[key]);
  if (env.PROD && !env.VITE_FIREBASE_APPCHECK_SITE_KEY) missing.push('VITE_FIREBASE_APPCHECK_SITE_KEY');
  return { configured: missing.length === 0, missing, config };
}

export function initializeFirebaseClient() {
  const setup = getFirebaseSetupStatus();
  if (!setup.configured) return { ...setup, app: null, auth: null, db: null, appCheck: null };

  const app = getApps()[0] || initializeApp(setup.config);
  let appCheck = null;
  const siteKey = env.VITE_FIREBASE_APPCHECK_SITE_KEY;

  if (siteKey) {
    if (env.DEV && env.VITE_FIREBASE_APPCHECK_DEBUG === 'true') {
      self.FIREBASE_APPCHECK_DEBUG_TOKEN = true;
    }
    appCheck = initializeAppCheck(app, {
      provider: new ReCaptchaEnterpriseProvider(siteKey),
      isTokenAutoRefreshEnabled: true
    });
  } else if (env.PROD) {
    throw new Error('Firebase App Check reCAPTCHA v3 site key is required in production.');
  }

  // App Check is initialized before obtaining Auth or Firestore instances.
  const auth = getAuth(app);
  const db = getFirestore(app);
  return { ...setup, app, auth, db, appCheck };
}
