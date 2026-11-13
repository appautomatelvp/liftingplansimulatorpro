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

export async function ensureUserProfile(db, authUser) {
  const profileRef = doc(db, 'users', authUser.uid);
  const profileSnapshot = await getDoc(profileRef);
  if (!profileSnapshot.exists()) {
    const profile = {
      uid: authUser.uid,
      email: authUser.email || '',
      displayName: authUser.displayName || '',
      role: 'user',
      tier: 'free',
      createdAt: serverTimestamp(),
      lastLogin: serverTimestamp(),
      status: 'active'
    };
    await setDoc(profileRef, profile);
    return { ...profile, createdAt: new Date(), lastLogin: new Date() };
  }

  const profile = profileSnapshot.data();
  if (profile.status !== 'active') {
    const error = new Error('This account is suspended. Contact SafeLift3D support.');
    error.code = 'safelift/account-suspended';
    throw error;
  }
  await updateDoc(profileRef, { lastLogin: serverTimestamp() });
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
  if (update.tier === 'free' || update.tier === 'premium') allowed.tier = update.tier;
  if (update.status === 'active' || update.status === 'locked' || update.status === 'banned') allowed.status = update.status;
  if (!Object.keys(allowed).length) throw new Error('No valid access change was provided.');
  await updateDoc(doc(db, 'users', uid), allowed);
}
