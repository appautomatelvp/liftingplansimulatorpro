import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import {
  assertFails, assertSucceeds, initializeTestEnvironment
} from '@firebase/rules-unit-testing';
import {
  collection, doc, getDoc, getDocs, serverTimestamp, setDoc, updateDoc
} from 'firebase/firestore';
import { readFile } from 'node:fs/promises';

const projectId = 'safelift3d-rules-test';
const ownerUid = 'free-owner';
const premiumUid = 'premium-owner';
const otherUid = 'other-user';
let env;

function profile(uid, tier = 'free', role = 'user') {
  return { uid, email: `${uid}@example.test`, displayName: uid, role, tier, status: 'active' };
}

function equipment(ownerUid) {
  return {
    ownerUid, schemaVersion: 1, name: 'Test sling', category: 'sling', manufacturer: 'Test', model: 'S-1',
    wllT: 5, lengthM: 3, massKg: 12, safetyFactor: 5, certificateNo: '', inspectionExpiry: '', notes: '',
    createdAt: serverTimestamp(), updatedAt: serverTimestamp()
  };
}

function plan(ownerUid) {
  return {
    ownerUid, schemaVersion: 1, title: 'Test lift', description: '', revision: 1, solverVersion: '5.0',
    archived: false, snapshot: '{"schemaVersion":1,"inputs":{}}', equipmentIds: [],
    createdAt: serverTimestamp(), updatedAt: serverTimestamp()
  };
}

before(async () => {
  env = await initializeTestEnvironment({
    projectId,
    firestore: {
      host: '127.0.0.1', port: 8080,
      rules: await readFile(new URL('../firestore.rules', import.meta.url), 'utf8')
    }
  });
  await env.withSecurityRulesDisabled(async (context) => {
    const db = context.firestore();
    for (const [uid, tier, role] of [
      [ownerUid, 'free', 'user'], [premiumUid, 'premium', 'user'], [otherUid, 'free', 'user'], ['admin-user', 'admin', 'admin']
    ]) {
      await setDoc(doc(db, 'users', uid), profile(uid, tier, role));
    }
  });
});

after(async () => {
  await env?.cleanup();
});

test('signed-in active owner may read own workspace; other and anonymous users may not', async () => {
  await assertSucceeds(getDoc(doc(env.authenticatedContext(ownerUid).firestore(), 'users', ownerUid, 'equipment', '1')));
  await assertFails(getDoc(doc(env.authenticatedContext(otherUid).firestore(), 'users', ownerUid, 'equipment', '1')));
  await assertFails(getDoc(doc(env.unauthenticatedContext().firestore(), 'users', ownerUid, 'equipment', '1')));
});

test('equipment writes enforce owner, schema, and free-tier slot limits', async () => {
  const db = env.authenticatedContext(ownerUid).firestore();
  await assertSucceeds(setDoc(doc(db, 'users', ownerUid, 'equipment', '1'), equipment(ownerUid)));
  await assertFails(setDoc(doc(db, 'users', ownerUid, 'equipment', '21'), equipment(ownerUid)));
  await assertFails(setDoc(doc(db, 'users', ownerUid, 'equipment', '2'), { ...equipment(ownerUid), extra: 'not allowed' }));
  await assertFails(setDoc(doc(db, 'users', ownerUid, 'equipment', '2'), equipment(otherUid)));
});

test('premium tier supports slot 200 but rejects slot 201', async () => {
  const db = env.authenticatedContext(premiumUid).firestore();
  await assertSucceeds(setDoc(doc(db, 'users', premiumUid, 'equipment', '200'), equipment(premiumUid)));
  await assertFails(setDoc(doc(db, 'users', premiumUid, 'equipment', '201'), equipment(premiumUid)));
});

test('lift plans require bounded snapshots and increasing revisions', async () => {
  const db = env.authenticatedContext(ownerUid).firestore();
  const ref = doc(db, 'users', ownerUid, 'liftPlans', '1');
  await assertSucceeds(setDoc(ref, plan(ownerUid)));
  await assertSucceeds(updateDoc(ref, { revision: 2, updatedAt: serverTimestamp() }));
  await assertFails(updateDoc(ref, { revision: 2, updatedAt: serverTimestamp() }));
  await assertFails(setDoc(doc(db, 'users', ownerUid, 'liftPlans', '2'), { ...plan(ownerUid), snapshot: 'x'.repeat(48_001) }));
});

test('users may change lastLogin only; admin may change tier/status, not role', async () => {
  const ownerDb = env.authenticatedContext(ownerUid).firestore();
  const ownerProfile = doc(ownerDb, 'users', ownerUid);
  await assertSucceeds(updateDoc(ownerProfile, { lastLogin: serverTimestamp() }));
  await assertFails(updateDoc(ownerProfile, { tier: 'premium' }));

  const adminDb = env.authenticatedContext('admin-user').firestore();
  await assertSucceeds(updateDoc(doc(adminDb, 'users', ownerUid), { tier: 'premium', status: 'active' }));
  await assertFails(updateDoc(doc(adminDb, 'users', ownerUid), { role: 'admin' }));
});

test('workspace list is owner-scoped and user profile listing remains admin-only', async () => {
  const ownerDb = env.authenticatedContext(ownerUid).firestore();
  await assertSucceeds(getDocs(collection(ownerDb, 'users', ownerUid, 'equipment')));
  await assertFails(getDocs(collection(ownerDb, 'users', otherUid, 'equipment')));
  await assertFails(getDocs(collection(ownerDb, 'users')));
  await assertSucceeds(getDocs(collection(env.authenticatedContext('admin-user').firestore(), 'users')));
});
