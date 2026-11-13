import {
  collection,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  serverTimestamp,
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

export async function listAllUsers(db) {
  const snapshot = await getDocs(collection(db, 'users'));
  return snapshot.docs.map((entry) => ({ id: entry.id, ...entry.data() }))
    .sort((a, b) => (b.createdAt?.toMillis?.() || 0) - (a.createdAt?.toMillis?.() || 0));
}

export async function setUserAccess(db, uid, update) {
  const allowed = {};
  if (update.tier === 'free' || update.tier === 'premium') allowed.tier = update.tier;
  if (update.status === 'active' || update.status === 'locked' || update.status === 'banned') allowed.status = update.status;
  if (!Object.keys(allowed).length) throw new Error('No valid access change was provided.');
  await updateDoc(doc(db, 'users', uid), allowed);
}
