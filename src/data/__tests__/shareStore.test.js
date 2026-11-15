import { describe, it, expect, vi, beforeEach } from 'vitest';

const calls = [];
let stored = null;
vi.mock('firebase/firestore', () => ({
  doc: (db, col, id) => ({ db, col, id }),
  setDoc: vi.fn(async (ref, data) => { calls.push(['set', ref, data]); }),
  updateDoc: vi.fn(async (ref, data) => { calls.push(['update', ref, data]); }),
  getDoc: vi.fn(async (ref) => { calls.push(['get', ref]); return { exists: () => stored != null, data: () => stored }; }),
}));

const { publishShare, getShare, unshare } = await import('../shareStore.js');
const DB = { name: 'db' };

beforeEach(() => { calls.length = 0; stored = null; });

describe('shareStore', () => {
  it('publishShare writes shared/{id}', async () => {
    await publishShare(DB, { name: 'x' }, 'abcdefghjk');
    expect(calls).toEqual([['set', { db: DB, col: 'shared', id: 'abcdefghjk' }, { name: 'x' }]]);
  });
  it('publishShare and unshare refuse a malformed id without touching Firestore', async () => {
    await expect(publishShare(DB, {}, 'short')).rejects.toThrow();
    await expect(unshare(DB, '../profiles')).rejects.toThrow();
    expect(calls).toEqual([]);
  });
  it('getShare returns the document', async () => {
    stored = { name: 'x', removed: false };
    expect(await getShare(DB, 'abcdefghjk')).toEqual({ name: 'x', removed: false });
  });
  it('getShare returns null for a missing or removed share and for a bad id (no read)', async () => {
    expect(await getShare(DB, 'abcdefghjk')).toBeNull();
    stored = { name: 'x', removed: true };
    expect(await getShare(DB, 'abcdefghjk')).toBeNull();
    calls.length = 0;
    expect(await getShare(DB, 'nope')).toBeNull();
    expect(calls).toEqual([]);
  });
  it('unshare sets removed: true and nothing else', async () => {
    await unshare(DB, 'abcdefghjk');
    expect(calls).toEqual([['update', { db: DB, col: 'shared', id: 'abcdefghjk' }, { removed: true }]]);
  });
});
