# @data — BỘ GIÁP HẠ TẦNG FIREBASE SPARK & ĐỒNG BỘ OFFLINE-FIRST (V7)
**Đúc kết trực tiếp từ mã nguồn thực tế:**
- `herocmitapp/src/config/firebase.js` & `SMARTTASK/src/lib/firebase.js` (Long Polling 4G + Persistent Multi-Tab Cache)
- `CARBOOK/src/utils/firestoreSanitize.js`, `firestoreBootstrap.js`, `localDataStore.js` (Chống lỗi `undefined`, bảo toàn `Date`/`Timestamp`, gọt ảnh Base64 chống tràn 5MB)
- `containercheckingcmitapp/patch8.js` (Delta Sync lùi 5 phút + dọn rác 30 ngày)
- `ROSTER2/src/utils/weekDoc.js` (Chia document theo tuần chống tràn giới hạn 1MB của Firestore)

---

## PHẦN 1: KHỞI TẠO FIREBASE CHUẨN ĐA MÔI TRƯỜNG (`src/lib/firebase.js`)

```javascript
// [LOCKED] - CHUẨN KHỞI TẠO FIREBASE CHỐNG RỚT 4G & ĐA TAB (V7)
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
  // Bản PRODUCTION cấm đăng nhập ẩn danh -> bắt buộc màn hình đăng nhập thật (Email/Google).
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
```

---

## PHẦN 2: BỘ LỌC AN TOÀN TRƯỚC KHI GHI FIRESTORE (`src/utils/firestoreSanitize.js`)

> **BẮT BUỘC:** Mọi lệnh `setDoc`, `updateDoc`, `addDoc` đều phải bọc dữ liệu qua `prepareFirestorePayload(payload)`. Hàm này dùng `isPlainObject` để giữ nguyên vẹn `Date`, `Timestamp`, `serverTimestamp()`, `increment()` (không bị biến thành `{}`).

```javascript
// [LOCKED] - BỘ LỌC CHỐNG LỖI UNDEFINED & RÒ RỈ BÍ MẬT FIRESTORE (V7)
const SECRET_KEYS = new Set(["password", "rawPassword", "pin", "secret", "apiKey", "token"]);

// Chỉ đi sâu vào object/array "thuần". Date, Timestamp, FieldValue... giữ nguyên.
function isPlainObject(v) {
  if (v === null || typeof v !== "object") return false;
  const proto = Object.getPrototypeOf(v);
  return proto === Object.prototype || proto === null;
}

export function omitNullishFields(obj) {
  if (Array.isArray(obj)) return obj.map(omitNullishFields).filter((v) => v !== undefined);
  if (isPlainObject(obj)) {
    const cleaned = {};
    for (const [k, v] of Object.entries(obj)) {
      if (v === undefined) continue;
      cleaned[k] = omitNullishFields(v);
    }
    return cleaned;
  }
  return obj;
}

export function sanitizeForFirestore(obj) {
  if (Array.isArray(obj)) return obj.map(sanitizeForFirestore);
  if (!isPlainObject(obj)) return obj;
  const result = {};
  for (const [k, v] of Object.entries(obj)) {
    if (SECRET_KEYS.has(k) || v === undefined) continue;
    result[k] = sanitizeForFirestore(v);
  }
  return result;
}

export function prepareFirestorePayload(rawObj) {
  return sanitizeForFirestore(omitNullishFields(rawObj));
}
```

---

## PHẦN 3: KHO LƯU TRỮ CỤC BỘ CHỐNG TRÀN 5MB `LOCALSTORAGE` (`src/utils/localDataStore.js`)

```javascript
// [LOCKED] - LƯU NHÁP OFFLINE-FIRST & GỌT ẢNH BASE64 CHỐNG TRÀN 5MB (V7)
export function withoutDataUrls(value) {
  if (typeof value === "string") {
    return /^data:(?:image|application)\//i.test(value) ? "" : value;
  }
  if (Array.isArray(value)) {
    return value.map(withoutDataUrls);
  }
  if (value && typeof value === "object") {
    const next = {};
    for (const [k, v] of Object.entries(value)) {
      next[k] = withoutDataUrls(v);
    }
    return next;
  }
  return value;
}

export function safeReadLocalStore(storageKey, fallbackValue = null) {
  try {
    const raw = localStorage.getItem(storageKey);
    return raw ? JSON.parse(raw) : fallbackValue;
  } catch (err) {
    console.warn(`⚠️ [LOCAL STORE - READ]: Lỗi đọc khóa ${storageKey}:`, err);
    return fallbackValue;
  }
}

export function safeWriteLocalStore(storageKey, payload) {
  try {
    const slimPayload = withoutDataUrls(payload);
    localStorage.setItem(storageKey, JSON.stringify(slimPayload));
    return true;
  } catch (err) {
    console.warn("⚠️ [LOCAL STORE - WRITE]: Đầy bộ nhớ đệm, đang dọn dẹp bản cũ:", err);
    try {
      localStorage.removeItem(storageKey);
      localStorage.setItem(storageKey, JSON.stringify(withoutDataUrls(payload)));
      return true;
    } catch (e2) {
      console.error("❌ [LOCAL STORE - WRITE]: Không thể ghi LocalStorage:", e2);
      return false;
    }
  }
}
```

---

## PHẦN 4: FIRESTORE RULES (V7)

**KHÔNG còn dán mẫu `request.auth != null` cho bản khách thật nữa** (hở: đăng nhập ẩn danh cũng lọt).
- App ĐANG TEST / không có dữ liệu thật (`PROTOTYPE`): dùng `templates/firestore.rules.prototype`.
- App ĐÃ CÓ KHÁCH THẬT (`PRODUCTION`): dùng `templates/firestore.rules` (bắt đăng nhập thật, admin riêng, mặc định cấm).
`manual_khoi_tao.ps1 -Stage prototype|production` tự chọn đúng file và copy thành `firestore.rules`.
