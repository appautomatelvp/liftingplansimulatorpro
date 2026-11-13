import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import {
  assertFails, assertSucceeds, initializeTestEnvironment
} from '@firebase/rules-unit-testing';
import {
  collection, deleteDoc, doc, getDoc, getDocs, limit, query, serverTimestamp, setDoc, updateDoc
} from 'firebase/firestore';
import { readFile } from 'node:fs/promises';
import { listUsersPage } from '../src/saas/firebase_data.js';

const projectId = 'safelift3d-rules-test';
const ownerUid = 'free-owner';
const premiumUid = 'premium-owner';
const otherUid = 'other-user';
const lockedUid = 'locked-owner';
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
      [ownerUid, 'free', 'user'], [premiumUid, 'premium', 'user'], [otherUid, 'free', 'user'],
      [lockedUid, 'free', 'user'], ['admin-user', 'admin', 'admin'], ['inactive-admin', 'admin', 'admin']
    ]) {
      await setDoc(doc(db, 'users', uid), {
        ...profile(uid, tier, role), status: uid === lockedUid || uid === 'inactive-admin' ? 'locked' : 'active'
      });
    }
    for (let index = 0; index < 30; index += 1) {
      const uid = `page-user-${String(index).padStart(2, '0')}`;
      await setDoc(doc(db, 'users', uid), {
        ...profile(uid), email: `${index < 3 ? 'alpha' : 'member'}${String(index).padStart(2, '0')}@example.test`,
        createdAt: new Date(Date.UTC(2026, 0, index + 1))
      });
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

test('workspace list is owner-scoped and user profile listing remains admin-only with bounded limit', async () => {
  const ownerDb = env.authenticatedContext(ownerUid).firestore();
  await assertSucceeds(getDocs(collection(ownerDb, 'users', ownerUid, 'equipment')));
  await assertFails(getDocs(collection(ownerDb, 'users', otherUid, 'equipment')));
  await assertFails(getDocs(query(collection(ownerDb, 'users'), limit(25))));
  const adminDb = env.authenticatedContext('admin-user').firestore();
  await assertSucceeds(getDocs(query(collection(adminDb, 'users'), limit(25))));
  await assertFails(getDocs(collection(adminDb, 'users')));
  await assertFails(getDocs(query(collection(adminDb, 'users'), limit(100))));
  await assertFails(getDocs(query(collection(env.authenticatedContext('inactive-admin').firestore(), 'users'), limit(25))));
});

test('admin user directory paginates with a bounded query and filters by email prefix', async () => {
  const adminDb = env.authenticatedContext('admin-user').firestore();
  const firstPage = await listUsersPage(adminDb, { pageSize: 25 });
  assert.equal(firstPage.users.length, 25);
  assert.equal(firstPage.hasMore, true);
  assert.ok(firstPage.cursor);

  const secondPage = await listUsersPage(adminDb, { cursor: firstPage.cursor, pageSize: 25 });
  assert.equal(secondPage.users.length, 5);
  assert.equal(secondPage.hasMore, false);
  assert.equal(new Set([...firstPage.users, ...secondPage.users].map((user) => user.uid)).size, 30);

  const matching = await listUsersPage(adminDb, { emailPrefix: 'ALPHA', pageSize: 2 });
  assert.deepEqual(matching.users.map((user) => user.email), ['alpha00@example.test', 'alpha01@example.test']);
  assert.equal(matching.hasMore, true);
});

test('cross-account reads, updates, and deletes are denied for equipment and lift plans', async () => {
  const ownerDb = env.authenticatedContext(ownerUid).firestore();
  await assertSucceeds(setDoc(doc(ownerDb, 'users', ownerUid, 'equipment', '3'), equipment(ownerUid)));
  await assertSucceeds(setDoc(doc(ownerDb, 'users', ownerUid, 'liftPlans', '3'), plan(ownerUid)));

  const otherDb = env.authenticatedContext(otherUid).firestore();
  const equipmentRef = doc(otherDb, 'users', ownerUid, 'equipment', '3');
  const planRef = doc(otherDb, 'users', ownerUid, 'liftPlans', '3');
  await assertFails(getDoc(equipmentRef));
  await assertFails(updateDoc(equipmentRef, { notes: 'tampered' }));
  await assertFails(updateDoc(planRef, { title: 'tampered', revision: 2, updatedAt: serverTimestamp() }));
  await assertFails(deleteDoc(equipmentRef));
  await assertFails(deleteDoc(planRef));

  await assertSucceeds(deleteDoc(doc(ownerDb, 'users', ownerUid, 'equipment', '3')));
});

test('locked users cannot access workspace data, including existing records', async () => {
  const lockedDb = env.authenticatedContext(lockedUid).firestore();
  await env.withSecurityRulesDisabled(async (context) => {
    await setDoc(doc(context.firestore(), 'users', lockedUid, 'equipment', '1'), equipment(lockedUid));
  });
  await assertFails(getDoc(doc(lockedDb, 'users', lockedUid, 'equipment', '1')));
  await assertFails(getDocs(collection(lockedDb, 'users', lockedUid, 'equipment')));
  await assertFails(setDoc(doc(lockedDb, 'users', lockedUid, 'equipment', '2'), equipment(lockedUid)));
});

test('profile creation cannot self-assign admin, premium, or a locked status', async () => {
  const db = env.authenticatedContext('new-user', { email: 'new-user@example.test', email_verified: true }).firestore();
  const valid = {
    uid: 'new-user', email: 'new-user@example.test', displayName: 'New user', role: 'user', tier: 'free',
    status: 'active', createdAt: serverTimestamp(), lastLogin: serverTimestamp()
  };
  await assertSucceeds(setDoc(doc(db, 'users', 'new-user'), valid));
  await assertFails(setDoc(doc(db, 'users', 'self-admin'), { ...valid, uid: 'self-admin', role: 'admin' }));

  const premiumDb = env.authenticatedContext('premium-self', { email: 'premium-self@example.test', email_verified: true }).firestore();
  await assertFails(setDoc(doc(premiumDb, 'users', 'premium-self'), { ...valid, uid: 'premium-self', email: 'premium-self@example.test', tier: 'premium' }));
  const lockedProfileDb = env.authenticatedContext('locked-self', { email: 'locked-self@example.test', email_verified: true }).firestore();
  await assertFails(setDoc(doc(lockedProfileDb, 'users', 'locked-self'), { ...valid, uid: 'locked-self', email: 'locked-self@example.test', status: 'locked' }));
});

test('profile creation rejects unverified email tokens and allows verified tokens', async () => {
  const unverifiedDb = env.authenticatedContext('unverified-user', { email: 'unverified@example.test', email_verified: false }).firestore();
  const base = {
    email: 'unverified@example.test', displayName: 'Unverified', role: 'user', tier: 'free',
    status: 'active', createdAt: serverTimestamp(), lastLogin: serverTimestamp()
  };
  await assertFails(setDoc(doc(unverifiedDb, 'users', 'unverified-user'), { ...base, uid: 'unverified-user' }));

  const verifiedDb = env.authenticatedContext('verified-user', { email: 'verified@example.test', email_verified: true }).firestore();
  await assertSucceeds(setDoc(doc(verifiedDb, 'users', 'verified-user'), { ...base, uid: 'verified-user', email: 'verified@example.test', displayName: 'Verified' }));
});

test('rules reject malformed equipment, unknown collections, and unauthorized profile changes', async () => {
  const ownerDb = env.authenticatedContext(ownerUid).firestore();
  await assertFails(setDoc(doc(ownerDb, 'users', ownerUid, 'equipment', '4'), { ...equipment(ownerUid), notes: 'x'.repeat(501) }));
  await assertFails(setDoc(doc(ownerDb, 'users', ownerUid, 'equipment', '5'), { ...equipment(ownerUid), category: 'unsupported' }));
  await assertFails(setDoc(doc(ownerDb, 'users', ownerUid, 'privateData', '1'), { secret: 'no access' }));
  await assertFails(updateDoc(doc(ownerDb, 'users', ownerUid), { role: 'admin' }));
  await assertFails(updateDoc(doc(ownerDb, 'users', ownerUid), { status: 'locked' }));
});

test('lift-plan rules reject malformed fields and administrators cannot use owner data paths', async () => {
  const ownerDb = env.authenticatedContext(ownerUid).firestore();
  await assertFails(setDoc(doc(ownerDb, 'users', ownerUid, 'liftPlans', '4'), { ...plan(ownerUid), revision: 0 }));
  await assertFails(setDoc(doc(ownerDb, 'users', ownerUid, 'liftPlans', '5'), { ...plan(ownerUid), equipmentIds: Array(21).fill('1') }));
  const adminDb = env.authenticatedContext('admin-user').firestore();
  await assertFails(getDocs(collection(adminDb, 'users', ownerUid, 'equipment')));
  await assertFails(setDoc(doc(adminDb, 'users', ownerUid, 'equipment', '6'), equipment(ownerUid)));
});

test('rules enforce serverTimestamp for lastLogin, block admin self-lockout, and cap user list limit', async () => {
  const ownerDb = env.authenticatedContext(ownerUid).firestore();
  await assertFails(updateDoc(doc(ownerDb, 'users', ownerUid), { lastLogin: 'not-a-timestamp' }));
  await assertFails(updateDoc(doc(ownerDb, 'users', ownerUid), { lastLogin: new Date(Date.UTC(2026, 0, 1)) }));

  const adminDb = env.authenticatedContext('admin-user').firestore();
  await assertFails(updateDoc(doc(adminDb, 'users', 'admin-user'), { status: 'locked' }));
  await assertFails(updateDoc(doc(adminDb, 'users', 'admin-user'), { tier: 'free' }));
  await assertSucceeds(getDocs(query(collection(adminDb, 'users'), limit(26))));
  await assertFails(getDocs(query(collection(adminDb, 'users'), limit(27))));
});
