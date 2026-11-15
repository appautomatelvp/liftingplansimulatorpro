// [LOCKED] - BỘ ĐO LƯỜNG NGƯỜI DÙNG (CHỐNG CHÁY QUOTA SPARK), PHÂN TÍCH HÀNH VI & THU THẬP FEEDBACK (V7)
// @purpose: Thống kê DAU/MAU, thói quen tính năng (gom 1 lần ghi/ngày), tích hợp Clarity & hộp thư Feedback khách hàng
import { doc, setDoc, addDoc, collection, increment, serverTimestamp } from "firebase/firestore";
import { db, appId } from "../lib/firebase.js";
import { prepareFirestorePayload } from "./firestoreSanitize.js";

const BUFFER_KEY = `${appId}_telemetry_buffer_v1`;
const LAST_FLUSH_KEY = `${appId}_telemetry_last_flush_day`;
const FEEDBACK_RATE_KEY = `${appId}_feedback_timestamps`;

function getTodayISO() {
  return new Date().toISOString().slice(0, 10); // YYYY-MM-DD
}

// 1. Tích hợp Microsoft Clarity (Miễn phí 100% trọn đời: Xem lại video thao tác & Bản đồ nhiệt Heatmap của khách)
export function initZeroCostAnalytics() {
  const env = typeof import.meta !== "undefined" ? import.meta.env : {};
  const clarityId = env.VITE_CLARITY_ID;
  if (clarityId && typeof document !== "undefined" && !window.__clarityLoaded) {
    window.__clarityLoaded = true;
    (function (c, l, a, r, i, t, y) {
      c[a] = c[a] || function () { (c[a].q = c[a].q || []).push(arguments); };
      t = l.createElement(r); t.async = 1; t.src = "https://www.clarity.ms/tag/" + i;
      y = l.getElementsByTagName(r)[0]; y.parentNode.insertBefore(t, y);
    })(window, document, "clarity", "script", clarityId);
  }
  flushDailyTelemetryIfNeeded();
}

// 2. Ghi nhận thói quen dùng tính năng vào bộ đệm LocalStorage (0 lượt ghi Firestore khi đang bấm)
export function trackFeatureUsage(featureName) {
  if (!featureName || typeof localStorage === "undefined") return;
  try {
    const raw = localStorage.getItem(BUFFER_KEY);
    const buf = raw ? JSON.parse(raw) : { features: {}, sessions: 0, errors: 0 };
    buf.features[featureName] = (buf.features[featureName] || 0) + 1;
    localStorage.setItem(BUFFER_KEY, JSON.stringify(buf));
  } catch (err) {
    console.warn("⚠️ [TELEMETRY - TRACK]: Không ghi được buffer:", err);
  }
}

// 3. Đồng bộ 1 LẦN DUY NHẤT / NGƯỜI / NGÀY lên Firestore (Bảo vệ tuyệt đối hạn mức 20k write/ngày của gói Spark)
export async function flushDailyTelemetryIfNeeded(userId = "anon") {
  if (!db || typeof localStorage === "undefined") return;
  const today = getTodayISO();
  const lastFlush = localStorage.getItem(LAST_FLUSH_KEY);
  if (lastFlush === today) return; // Đã gửi hôm nay rồi -> không tốn thêm write nào nữa

  try {
    const raw = localStorage.getItem(BUFFER_KEY);
    const buf = raw ? JSON.parse(raw) : { features: {} };
    const isMobile = typeof navigator !== "undefined" && /Android|iPhone|iPad|Mobile/i.test(navigator.userAgent || "");

    const updates = {
      date: today,
      activeUsersCount: increment(1),
      mobileUsersCount: increment(isMobile ? 1 : 0),
      desktopUsersCount: increment(isMobile ? 0 : 1),
      updatedAt: serverTimestamp(),
    };

    for (const [feat, count] of Object.entries(buf.features || {})) {
      const safeKey = String(feat).replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 40);
      updates[`feature_${safeKey}`] = increment(Number(count) || 1);
    }

    const dailyRef = doc(db, "artifacts", appId, "public", "data", "analytics_daily", today);
    await setDoc(dailyRef, updates, { merge: true });

    localStorage.setItem(LAST_FLUSH_KEY, today);
    localStorage.removeItem(BUFFER_KEY);
  } catch (err) {
    console.error("❌ [TELEMETRY - FLUSH]: Lỗi đồng bộ chỉ số ngày:", err);
  }
}

// 4. Hộp thư nhận Feedback & Báo lỗi trực tiếp từ khách hàng (Có chống spam 3 lần/giờ)
export async function submitUserFeedback({
  rating = 5,
  category = "idea", // "idea" | "bug" | "ux"
  message = "",
  screenName = "",
  userId = "anon",
  userRole = "member",
}) {
  if (!message || !String(message).trim()) {
    throw new Error("Vui lòng nhập nội dung góp ý.");
  }
  // Chống spam phía client: tối đa 3 feedback / giờ
  const now = Date.now();
  const rawStamps = localStorage.getItem(FEEDBACK_RATE_KEY);
  const stamps = (rawStamps ? JSON.parse(rawStamps) : []).filter((t) => now - t < 3600 * 1000);
  if (stamps.length >= 3) {
    throw new Error("Bạn đã gửi 3 góp ý trong giờ qua. Vui lòng thử lại sau ít phút nhé!");
  }

  const isMobile = typeof navigator !== "undefined" && /Android|iPhone|iPad|Mobile/i.test(navigator.userAgent || "");
  const payload = prepareFirestorePayload({
    rating: Math.min(5, Math.max(1, Number(rating) || 5)),
    category,
    message: String(message).trim().slice(0, 1500),
    screenName: String(screenName || (typeof location !== "undefined" ? location.pathname : "")),
    device: isMobile ? "mobile" : "desktop",
    userId: String(userId || "anon"),
    userRole: String(userRole || "member"),
    status: "new", // "new" | "reviewed" | "resolved"
    createdAt: new Date().toISOString(),
  });

  if (db) {
    const colRef = collection(db, "artifacts", appId, "public", "data", "feedbacks");
    await addDoc(colRef, payload);
  }
  stamps.push(now);
  localStorage.setItem(FEEDBACK_RATE_KEY, JSON.stringify(stamps));
  return true;
}
