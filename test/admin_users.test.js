import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('firebase/firestore', () => ({
  collection: vi.fn((db, ...path) => ({ kind: 'collection', db, path })),
  doc: vi.fn(), endAt: vi.fn((value) => ({ kind: 'endAt', value })), getDoc: vi.fn(),
  getDocs: vi.fn(), limit: vi.fn((count) => ({ kind: 'limit', count })), onSnapshot: vi.fn(),
  orderBy: vi.fn((field, direction) => ({ kind: 'orderBy', field, direction })),
  query: vi.fn((collectionRef, ...constraints) => ({ collectionRef, constraints })),
  serverTimestamp: vi.fn(), setDoc: vi.fn(), startAfter: vi.fn((cursor) => ({ kind: 'startAfter', cursor })),
  startAt: vi.fn((value) => ({ kind: 'startAt', value })), updateDoc: vi.fn()
}));

import { getDocs } from 'firebase/firestore';
import { ADMIN_USERS_PAGE_SIZE, listUsersPage } from '../src/saas/firebase_data.js';

const snapshotDoc = (id) => ({ id, data: () => ({ uid: id, email: `${id}@example.test` }) });

describe('admin user directory queries', () => {
  beforeEach(() => vi.clearAllMocks());

  it('bounds each page and returns a cursor only from visible documents', async () => {
    getDocs.mockResolvedValue({ docs: Array.from({ length: 26 }, (_, index) => snapshotDoc(`user-${index}`)) });
    const page = await listUsersPage({ id: 'db' });

    expect(ADMIN_USERS_PAGE_SIZE).toBe(25);
    expect(page.users).toHaveLength(25);
    expect(page.cursor.id).toBe('user-24');
    expect(page.hasMore).toBe(true);
    expect(getDocs.mock.calls[0][0].constraints.at(-1)).toEqual({ kind: 'limit', count: 26 });
  });

  it('builds a normalized email-prefix query and clamps requested page sizes', async () => {
    getDocs.mockResolvedValue({ docs: [snapshotDoc('alpha-1')] });
    const cursor = snapshotDoc('previous');
    const page = await listUsersPage({ id: 'db' }, { emailPrefix: '  Alpha ', cursor, pageSize: 500 });
    const query = getDocs.mock.calls[0][0];

    expect(query.constraints).toEqual([
      { kind: 'orderBy', field: 'email', direction: undefined },
      { kind: 'startAt', value: 'alpha' },
      { kind: 'endAt', value: 'alpha\uf8ff' },
      { kind: 'startAfter', cursor },
      { kind: 'limit', count: 26 }
    ]);
    expect(page.users[0].email).toBe('alpha-1@example.test');
    expect(page.hasMore).toBe(false);
  });

  it('accepts an empty result without exposing a stale cursor', async () => {
    getDocs.mockResolvedValue({ docs: [] });
    const page = await listUsersPage({ id: 'db' }, { pageSize: 0 });

    expect(page).toEqual({ users: [], cursor: null, hasMore: false });
    expect(getDocs.mock.calls[0][0].constraints.at(-1)).toEqual({ kind: 'limit', count: 2 });
  });
});
