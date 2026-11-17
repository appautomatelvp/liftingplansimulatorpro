// @purpose: Emulator test bo sung cho rules 24h trial_devices anti-abuse va system_config/feature_locks
import { after, before, test } from 'node:test';
import { assertFails, assertSucceeds, initializeTestEnvironment } from '@firebase/rules-unit-testing';
import { doc, getDoc, serverTimestamp, setDoc } from 'firebase/firestore';
import { readFile } from 'node:fs/promises';

const projectId = 'safelift3d-trial-cms-rules';
let env;

before(async () => {
  const rules = await readFile(new URL('../firestore.rules', import.meta.url), 'utf8');
  env = await initializeTestEnvironment({ projectId, firestore: { rules } });
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    await setDoc(doc(db, 'users', 'free-owner'), {
      uid: 'free-owner', email: 'free-owner@example.test', displayName: 'Free', role: 'user', tier: 'free', status: 'active'
    });
    await setDoc(doc(db, 'users', 'other-user'), {
      uid: 'other-user', email: 'other@example.test', displayName: 'Other', role: 'user', tier: 'free', status: 'active'
    });
    await setDoc(doc(db, 'users', 'admin-user'), {
      uid: 'admin-user', email: 'admin@example.test', displayName: 'Admin', role: 'admin', tier: 'pro', status: 'active'
    });
  });
});

after(async () => {
  await env?.cleanup();
});

test('trial_devices is write-once per fingerprint and system_config/feature_locks is admin-write only', async () => {
  const ownerDb = env.authenticatedContext('free-owner', { email_verified: true }).firestore();
  const otherDb = env.authenticatedContext('other-user', { email_verified: true }).firestore();
  const adminDb = env.authenticatedContext('admin-user', { email_verified: true }).firestore();

  const fpId = 'fp-device-001';
  await assertSucceeds(setDoc(doc(ownerDb, 'trial_devices', fpId), {
    uid: 'free-owner',
    claimedAt: serverTimestamp()
  }));
  await assertFails(setDoc(doc(otherDb, 'trial_devices', fpId), {
    uid: 'other-user',
    claimedAt: serverTimestamp()
  }));

  await assertSucceeds(setDoc(doc(adminDb, 'system_config', 'feature_locks'), {
    locks: { windSimulation: 'upgrading' },
    updatedBy: 'admin-user',
    updatedAt: serverTimestamp()
  }));
  await assertSucceeds(getDoc(doc(ownerDb, 'system_config', 'feature_locks')));
  await assertFails(setDoc(doc(ownerDb, 'system_config', 'feature_locks'), {
    locks: { windSimulation: 'active' }
  }));
});
