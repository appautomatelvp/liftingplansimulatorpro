// [LOCKED] - ĐỒNG BỘ DELTA LÙI 5 PHÚT + DỌN RÁC 30 NGÀY CHỐNG CHÁY QUOTA (V4.5)
import { collection, query, where, getDocs } from "firebase/firestore";
import { safeReadLocalStore, safeWriteLocalStore } from "./localDataStore.js";

export async function fetchWithDeltaSync({
  db,
  collectionPath,
  cachePrefix,
  idField = "id",
  updatedAtField = "updatedAt",
  initialDays = 7,
  maxRetentionDays = 30,
}) {
  const CACHE_KEY = `${cachePrefix}_data_cache`;
  const TIME_KEY = `${cachePrefix}_last_sync_ms`;
  const nowMs = Date.now();

  const localList = safeReadLocalStore(CACHE_KEY, []);
  const lastSyncMs = parseInt(localStorage.getItem(TIME_KEY) || "0", 10);
  const itemMap = new Map(localList.map((item) => [item[idField], item]));

  if (!db) return localList;

  try {
    const colRef = collection(db, collectionPath);
    const syncFromMs =
      lastSyncMs > 0 && localList.length > 0
        ? lastSyncMs - 5 * 60 * 1000
        : nowMs - initialDays * 24 * 60 * 60 * 1000;

    const deltaQuery = query(colRef, where(updatedAtField, ">=", new Date(syncFromMs).toISOString()));
    const snap = await getDocs(deltaQuery);

    snap.docs.forEach((docSnap) => {
      const data = { [idField]: docSnap.id, ...docSnap.data() };
      itemMap.set(data[idField], data);
    });

    const cutoffMs = nowMs - maxRetentionDays * 24 * 60 * 60 * 1000;
    const recentList = Array.from(itemMap.values()).filter((item) => {
      const itemTime = item[updatedAtField] ? new Date(item[updatedAtField]).getTime() : nowMs;
      return itemTime >= cutoffMs;
    });

    safeWriteLocalStore(CACHE_KEY, recentList);
    localStorage.setItem(TIME_KEY, String(nowMs));
    return recentList;
  } catch (error) {
    console.error("❌ [DELTA SYNC]: Lỗi mạng, đang dùng dữ liệu Offline từ Cache:", error);
    return localList;
  }
}
