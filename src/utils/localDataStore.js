// @purpose: Đọc ghi LocalStorage an toàn chống tràn 5MB và tự gọt ảnh DataURL
// [LOCKED] - LƯU NHÁP OFFLINE-FIRST & GỌT ẢNH BASE64 CHỐNG TRÀN 5MB (V4.5)
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
