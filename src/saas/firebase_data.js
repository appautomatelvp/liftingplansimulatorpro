import {
  collection,
  doc,
  endAt,
  getDoc,
  getDocs,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  startAfter,
  startAt,
  setDoc,
  updateDoc
} from 'firebase/firestore';
import { prepareFirestorePayload } from '../utils/firestoreSanitize.js';
import {
  TRIAL_DURATION_MS,
  getOrCreateDeviceFingerprint,
  hasLocalTrialClaimed,
  markLocalTrialClaimed
} from './trial_access.js';

export async function ensureUserProfile(db, authUser) {
  const profileRef = doc(db, 'users', authUser.uid);
  const profileSnapshot = await getDoc(profileRef);
  if (!profileSnapshot.exists()) {
    const fp = getOrCreateDeviceFingerprint();
    let eligibleForTrial = !hasLocalTrialClaimed();
    if (eligibleForTrial) {
      try {
        const devSnap = await getDoc(doc(db, 'trial_devices', fp));
        if (devSnap.exists()) eligibleForTrial = false;
      } catch { /* fallback cleanly if offline */ }
    }
    const nowMs = Date.now();
    const trialEndsAt = eligibleForTrial ? new Date(nowMs + TRIAL_DURATION_MS) : null;
    const profile = {
      uid: authUser.uid,
      email: authUser.email || '',
      displayName: authUser.displayName || '',
      role: 'user',
      tier: 'free',
      deviceFingerprint: fp,
      trialStartedAt: eligibleForTrial ? serverTimestamp() : null,
      trialEndsAt,
      createdAt: serverTimestamp(),
      lastLogin: serverTimestamp(),
      status: 'active'
    };
    await setDoc(profileRef, prepareFirestorePayload(profile));
    if (eligibleForTrial) {
      markLocalTrialClaimed(fp, authUser.uid);
      try {
        await setDoc(doc(db, 'trial_devices', fp), prepareFirestorePayload({
          deviceFingerprint: fp,
          firstUid: authUser.uid,
          claimedAt: serverTimestamp()
        }));
      } catch { /* non-fatal if another tab/account just claimed */ }
    }
    return {
      ...profile,
      trialStartedAt: eligibleForTrial ? new Date(nowMs) : null,
      createdAt: new Date(nowMs),
      lastLogin: new Date(nowMs)
    };
  }

  const profile = profileSnapshot.data();
  if (profile.status !== 'active') {
    const error = new Error('This account is suspended. Contact SafeLift3D support.');
    error.code = 'safelift/account-suspended';
    throw error;
  }
  await updateDoc(profileRef, prepareFirestorePayload({ lastLogin: serverTimestamp() }));
  return { ...profile, lastLogin: new Date() };
}

export function watchUserProfile(db, uid, onProfile, onError) {
  return onSnapshot(doc(db, 'users', uid), (snapshot) => {
    onProfile(snapshot.exists() ? snapshot.data() : null);
  }, onError);
}

export const ADMIN_USERS_PAGE_SIZE = 25;

export async function listUsersPage(db, { cursor = null, emailPrefix = '', pageSize = ADMIN_USERS_PAGE_SIZE } = {}) {
  const normalizedPrefix = String(emailPrefix).trim().toLowerCase().slice(0, 254);
  const requestedPageSize = Number(pageSize);
  const boundedPageSize = Number.isFinite(requestedPageSize)
    ? Math.min(Math.max(1, Math.floor(requestedPageSize)), ADMIN_USERS_PAGE_SIZE)
    : ADMIN_USERS_PAGE_SIZE;
  const constraints = normalizedPrefix
    ? [orderBy('email'), startAt(normalizedPrefix), endAt(`${normalizedPrefix}\uf8ff`)]
    : [orderBy('createdAt', 'desc')];
  if (cursor) constraints.push(startAfter(cursor));
  constraints.push(limit(boundedPageSize + 1));

  const snapshot = await getDocs(query(collection(db, 'users'), ...constraints));
  const pageDocs = snapshot.docs.slice(0, boundedPageSize);
  return {
    users: pageDocs.map((entry) => ({ id: entry.id, ...entry.data() })),
    cursor: pageDocs.length ? pageDocs[pageDocs.length - 1] : null,
    hasMore: snapshot.docs.length > boundedPageSize
  };
}

export async function setUserAccess(db, uid, update) {
  const allowed = {};
  if (update.tier === 'free' || update.tier === 'premium' || update.tier === 'pro' || update.tier === 'enterprise') {
    allowed.tier = update.tier;
  }
  if (update.status === 'active' || update.status === 'locked' || update.status === 'banned') allowed.status = update.status;
  if (!Object.keys(allowed).length) throw new Error('No valid access change was provided.');
  await updateDoc(doc(db, 'users', uid), prepareFirestorePayload(allowed));
}
