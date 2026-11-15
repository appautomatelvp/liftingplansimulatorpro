// [LOCKED] - CHUẨN KHỞI TẠO FIREBASE CHỐNG RỚT 4G & ĐA TAB (V4.5)
import { initializeApp, getApps } from "firebase/app";
import { getAuth, signInAnonymously } from "firebase/auth";
import {
  getFirestore,
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
  collection,
  doc
} from "firebase/firestore";
import { getStorage } from "firebase/storage";

const env = typeof import.meta !== "undefined" ? import.meta.env : {};

function parseFirebaseConfig() {
  const raw = env.VITE_FIREBASE_CONFIG || env.VITE_FIREBASE_CONFIG_LOCAL;
  if (raw) {
    try {
      return typeof raw === "string" ? JSON.parse(raw) : raw;
    } catch (e) {
      console.warn("⚠️ [FIREBASE CONFIG]: Chuỗi JSON không hợp lệ, chuyển sang biến lẻ:", e);
    }
  }
  return {
    apiKey: env.VITE_FIREBASE_API_KEY || "",
    authDomain: env.VITE_FIREBASE_AUTH_DOMAIN || "",
    projectId: env.VITE_FIREBASE_PROJECT_ID || "",
    storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET || "",
    messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID || "",
    appId: env.VITE_FIREBASE_APP_ID || "",
  };
}

const firebaseConfig = parseFirebaseConfig();
export const isConfigured = Boolean(firebaseConfig?.apiKey && firebaseConfig?.projectId);
export const appId = env.VITE_APP_ID || env.VITE_FIREBASE_TENANT_ID || "default-app-v1";

export const app = isConfigured
  ? (getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0])
  : null;

export const auth = app ? getAuth(app) : null;
export const storage = app ? getStorage(app) : null;

// Tự bật Long Polling trên mạng 4G di động hoặc khi ép cờ VITE_FIREBASE_LONG_POLLING=true
const isMobile = typeof navigator !== "undefined" && /Android|iPhone|iPad|Mobile/i.test(navigator.userAgent || "");
const forceLongPolling =
  env.VITE_FIREBASE_LONG_POLLING === "true" ||
  (env.VITE_FIREBASE_LONG_POLLING !== "false" && isMobile);

export const db = (() => {
  if (!app) return null;
  try {
    return initializeFirestore(app, {
      experimentalForceLongPolling: forceLongPolling,
      localCache: persistentLocalCache({
        tabManager: persistentMultipleTabManager(),
      }),
    });
  } catch (err) {
    console.warn("⚠️ [FIRESTORE]: Chuyển sang getFirestore mặc định:", err.message);
    return getFirestore(app);
  }
})();

export async function ensureFirebaseAuth() {
  if (!auth) return null;
  if (auth.currentUser) return auth.currentUser;
  // V5: bản PRODUCTION cấm đăng nhập ẩn danh -> bắt buộc màn hình đăng nhập thật (Email/Google).
  if (env.VITE_APP_ENV === "production") {
    console.warn("🔒 [FIREBASE AUTH]: production không cho đăng nhập ẩn danh, cần đăng nhập thật.");
    return null;
  }
  try {
    const cred = await signInAnonymously(auth);
    return cred.user;
  } catch (err) {
    console.error("❌ [FIREBASE AUTH]: Lỗi đăng nhập ẩn danh:", err);
    return null;
  }
}

export const getCollectionRef = (colName) =>
  collection(db, "artifacts", appId, "public", "data", colName);

export const getDocRef = (colName, docId) =>
  doc(db, "artifacts", appId, "public", "data", colName, String(docId));

export const getCompanyCollectionRef = (companyId, colName) =>
  collection(db, "artifacts", appId, "public", "data", "companies", String(companyId), colName);
