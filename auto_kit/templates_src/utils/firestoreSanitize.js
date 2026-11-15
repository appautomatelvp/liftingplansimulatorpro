// [LOCKED] - BỘ LỌC CHỐNG LỖI UNDEFINED & RÒ RỈ BÍ MẬT FIRESTORE (V5)
// V5: giữ nguyên Date / Timestamp / serverTimestamp()/ increment() (V4 làm hỏng chúng thành {}).
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
