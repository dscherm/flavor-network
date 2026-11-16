// PICTURE-3: the storage module. Firestore is a recording double; nothing here can reach a network.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';

const writes = [];
let failOn = null;
let store = {};
const key = (ref) => ref.path.join('/');
vi.mock('firebase/firestore', () => ({
  doc: (db, ...path) => ({ path }),
  setDoc: vi.fn(async (ref, data) => { if (failOn === 'set') throw new Error('offline'); writes.push(['set', key(ref), data]); store[key(ref)] = data; }),
  deleteDoc: vi.fn(async (ref) => { if (failOn === 'delete') throw new Error('denied'); writes.push(['delete', key(ref)]); delete store[key(ref)]; }),
  getDoc: vi.fn(async (ref) => ({ exists: () => key(ref) in store, data: () => store[key(ref)] })),
  updateDoc: vi.fn(async (ref, data) => { writes.push(['update', key(ref), data]); }),
  addDoc: vi.fn(),
  collection: vi.fn(),
  writeBatch: vi.fn(() => {
    const ops = [];
    return {
      set: (ref, data) => ops.push(['set', key(ref), data]),
      commit: async () => { if (failOn === 'batch') throw new Error('denied'); for (const o of ops) { writes.push(['batch', ...o]); store[o[1]] = o[2]; } },
    };
  }),
}));

const ps = await import('../pictureStore.js');
const { publishShareWithPicture, unshare } = await import('../shareStore.js');
const { toSharedDoc, fromSharedDoc } = await import('../sharePublish.js');

const DB = { name: 'db' };
const blob = (n = 300, type = 'image/jpeg') => new Blob([new Uint8Array(n).fill(65)], { type });
const chalk = (over = {}) => ({ kind: 'chalk', blob: blob(), mime: 'image/jpeg', w: 600, h: 450, ...over });
const A300 = btoa('A'.repeat(300));

beforeEach(() => { writes.length = 0; failOn = null; store = {}; });

describe('pure helpers', () => {
  it('cleanPictureField / sharedPictureField', () => {
    expect(ps.cleanPictureField({ kind: 'icon', icon: 'glass:coupe', v: 3, extra: 1 })).toEqual({ kind: 'icon', icon: 'glass:coupe', v: 3 });
    expect(ps.cleanPictureField({ kind: 'chalk', v: 4, data: 'AAAA' })).toEqual({ kind: 'chalk', v: 4 });
    expect(ps.cleanPictureField({ kind: 'icon', icon: '<script>' })).toBeNull();
    expect(ps.cleanPictureField('x')).toBeNull();
    expect(ps.sharedPictureField({ kind: 'chalk', v: 9 })).toEqual({ kind: 'chalk' });
    expect(ps.sharedPictureField({ kind: 'icon', icon: 'dish:pasta', v: 9 })).toEqual({ kind: 'icon', icon: 'dish:pasta' });
  });
  it('fieldFromValue: undefined keeps, null clears, icon and chalk get a new v', () => {
    const prev = { kind: 'chalk', v: 1 };
    expect(ps.fieldFromValue(undefined, prev)).toEqual(prev);
    expect(ps.fieldFromValue(null, prev)).toBeNull();
    expect(ps.fieldFromValue({ kind: 'icon', icon: 'glass:flute' }, prev, 7)).toEqual({ kind: 'icon', icon: 'glass:flute', v: 7 });
    expect(ps.fieldFromValue({ kind: 'chalk' }, prev, 8)).toEqual({ kind: 'chalk', v: 8 });
  });
  it('encodeChalk returns base64 under the cap and refuses what the rules would refuse', async () => {
    const enc = await ps.encodeChalk(chalk());
    expect(enc).toEqual({ data: A300, mime: 'image/jpeg', w: 600, h: 450 });
    await expect(ps.encodeChalk(chalk({ blob: blob(160000) }))).rejects.toThrow(ps.PICTURE_TOO_BIG);
    await expect(ps.encodeChalk(chalk({ mime: 'image/png', blob: blob(10, 'image/png') }))).rejects.toThrow();
    await expect(ps.encodeChalk(chalk({ mime: 'image/webp', blob: blob(10, 'image/webp') }))).rejects.toThrow();
    await expect(ps.encodeChalk(chalk({ w: 8 }))).rejects.toThrow();
    await expect(ps.encodeChalk(chalk({ w: 600.5 }))).rejects.toThrow();
    await expect(ps.encodeChalk({ kind: 'icon', icon: 'glass:coupe' })).rejects.toThrow();
  });
  it('a 150 KB picture fits the 210,000-character cap', async () => {
    const enc = await ps.encodeChalk(chalk({ blob: blob(150 * 1024) }));
    expect(enc.data.length).toBeLessThan(210000);
  });
});

describe('prepareItemPicture', () => {
  const base = { db: DB, uid: 'u1', itemId: 'inv-1' };
  it('chalk: writes profiles/{uid}/pictures/{itemId} with exactly the encoded data', async () => {
    const r = await ps.prepareItemPicture({ ...base, value: chalk(), prev: null, now: 99 });
    expect(r).toEqual({ field: { kind: 'chalk', v: 99 }, obsolete: false });
    expect(writes).toEqual([['set', 'profiles/u1/pictures/inv-1', { data: A300, mime: 'image/jpeg', w: 600, h: 450, updatedAt: 99 }]]);
  });
  it('a failed write gives one reason and keeps the previous picture field', async () => {
    failOn = 'set';
    const r = await ps.prepareItemPicture({ ...base, value: chalk(), prev: { kind: 'chalk', v: 1 } });
    expect(r.reason).toBe(ps.PICTURE_FAILED);
    expect(r.field).toEqual({ kind: 'chalk', v: 1 });
    const none = await ps.prepareItemPicture({ ...base, value: chalk(), prev: null });
    expect(none.field).toBeNull();
  });
  it('an oversize picture and a signed-out save each give their own plain line, with no write', async () => {
    const big = await ps.prepareItemPicture({ ...base, value: chalk({ blob: blob(160000) }), prev: null });
    expect(big.reason).toBe(ps.PICTURE_TOO_BIG);
    const out = await ps.prepareItemPicture({ db: DB, uid: '', itemId: 'inv-1', value: chalk(), prev: null });
    expect(out.reason).toBe(ps.PICTURE_SIGNIN);
    expect(writes).toEqual([]);
  });
  it('chalk -> icon and chalk -> none mark the old document obsolete; no write yet', async () => {
    const prev = { kind: 'chalk', v: 1 };
    const icon = await ps.prepareItemPicture({ ...base, value: { kind: 'icon', icon: 'dish:pasta' }, prev, now: 5 });
    expect(icon).toEqual({ field: { kind: 'icon', icon: 'dish:pasta', v: 5 }, obsolete: true });
    const none = await ps.prepareItemPicture({ ...base, value: null, prev });
    expect(none).toEqual({ field: null, obsolete: true });
    expect(writes).toEqual([]);
  });
  it('icon -> none and an untouched picture never mark anything obsolete and touch no network', async () => {
    expect((await ps.prepareItemPicture({ ...base, value: null, prev: { kind: 'icon', icon: 'dish:pasta', v: 1 } })).obsolete).toBe(false);
    const same = await ps.prepareItemPicture({ ...base, value: undefined, prev: { kind: 'chalk', v: 1 } });
    expect(same).toEqual({ field: { kind: 'chalk', v: 1 }, obsolete: false });
    expect(writes).toEqual([]);
  });
});

describe('own pictures: load and delete', () => {
  it('loadPicture reads one document lazily and returns a data URL; missing or malformed is null', async () => {
    store['profiles/u1/pictures/inv-1'] = { data: 'QUJD', mime: 'image/jpeg', w: 600, h: 450, updatedAt: 1 };
    expect(await ps.loadPicture(DB, 'u1', 'inv-1')).toMatchObject({ data: 'QUJD', dataUrl: 'data:image/jpeg;base64,QUJD', w: 600 });
    expect(await ps.loadPicture(DB, 'u1', 'inv-2')).toBeNull();
    store['profiles/u1/pictures/inv-3'] = { data: 'QUJD', mime: 'text/html', w: 600, h: 450 };
    expect(await ps.loadPicture(DB, 'u1', 'inv-3')).toBeNull();
    expect(await ps.loadPicture(DB, 'u1', '../x')).toBeNull();
  });
  it('deletePicture removes the document and never throws', async () => {
    store['profiles/u1/pictures/inv-1'] = { data: 'QUJD' };
    expect(await ps.deletePicture(DB, 'u1', 'inv-1')).toBe(true);
    failOn = 'delete';
    expect(await ps.deletePicture(DB, 'u1', 'inv-1')).toBe(false);
  });
});

describe('sharing: toSharedDoc / fromSharedDoc carry only the kind, never image data', () => {
  const item = { name: 'Grandma Sour', lines: [{ key: 'bourbon', amount: '2 oz' }, { key: 'lemon', amount: '1 oz' }] };
  it('without a picture the document is exactly as before', () => {
    const d = toSharedDoc(item, { kind: 'cocktail', uid: 'u1', now: 5 });
    expect('picture' in d).toBe(false);
    expect('picture' in fromSharedDoc({ ...d }, 'abcdefghjk')).toBe(false);
  });
  it('a chalk or icon picture is copied as { kind } / { kind, icon }', () => {
    expect(toSharedDoc({ ...item, picture: { kind: 'chalk', v: 3 } }, { kind: 'cocktail', uid: 'u1' }).picture).toEqual({ kind: 'chalk' });
    expect(toSharedDoc({ ...item, picture: { kind: 'icon', icon: 'glass:coupe', v: 3 } }, { kind: 'cocktail', uid: 'u1' }).picture).toEqual({ kind: 'icon', icon: 'glass:coupe' });
    expect(fromSharedDoc({ ...toSharedDoc(item, { kind: 'cocktail', uid: 'u1' }), picture: { kind: 'chalk', data: 'x' } }, 'abcdefghjk').picture).toEqual({ kind: 'chalk' });
  });
});

describe('publishShareWithPicture and unshare', () => {
  const ID = 'abcdefghjk';
  const base = () => ({ kind: 'cocktail', name: 'x', lines: [{ key: 'a', amount: '' }], bars: [], by: null, owner: 'u1', createdAt: 5, removed: false });
  it('writes the share and its picture in ONE batch; shared/{id} holds no image data', async () => {
    const r = await publishShareWithPicture(DB, { ...base(), picture: { kind: 'chalk' } }, ID, { chalk: chalk(), owner: 'u1' });
    expect(r).toEqual({ id: ID, picture: 'chalk' });
    expect(writes.map((w) => w.slice(0, 3))).toEqual([['batch', 'set', `shared/${ID}`], ['batch', 'set', `sharedPictures/${ID}`]]);
    expect(JSON.stringify(writes[0][3])).not.toContain(A300);
    expect(writes[1][3]).toEqual({ data: A300, mime: 'image/jpeg', w: 600, h: 450, owner: 'u1', createdAt: 5 });
  });
  it('a failed picture write still creates the link, without the picture key, with one reason', async () => {
    failOn = 'batch';
    const r = await publishShareWithPicture(DB, { ...base(), picture: { kind: 'chalk' } }, ID, { chalk: chalk(), owner: 'u1' });
    expect(r.picture).toBeNull();
    expect(r.reason).toBe(ps.PICTURE_FAILED);
    expect(writes).toHaveLength(1);
    expect(writes[0][0]).toBe('set');
    expect('picture' in writes[0][2]).toBe(false);
  });
  it('an unreadable chalk value publishes without the picture too', async () => {
    const r = await publishShareWithPicture(DB, { ...base(), picture: { kind: 'chalk' } }, ID, { chalk: null, owner: 'u1' });
    expect(r.reason).toBe(ps.PICTURE_FAILED);
    expect('picture' in writes[0][2]).toBe(false);
  });
  it('an icon or no picture is a plain publish', async () => {
    expect((await publishShareWithPicture(DB, { ...base(), picture: { kind: 'icon', icon: 'dish:pasta' } }, ID, {})).picture).toBe('icon');
    expect((await publishShareWithPicture(DB, base(), ID, {})).picture).toBeNull();
    expect(writes.every((w) => w[0] === 'set')).toBe(true);
  });
  it('if even the fallback publish fails, it throws (the link was not made)', async () => {
    failOn = 'set';
    await expect(publishShareWithPicture(DB, base(), ID, {})).rejects.toThrow();
  });
  it('unshare sets removed: true and then deletes the shared picture; a failed delete does not fail the unshare', async () => {
    store[`sharedPictures/${ID}`] = { data: 'QUJD' };
    await unshare(DB, ID);
    expect(writes).toEqual([['update', `shared/${ID}`, { removed: true }], ['delete', `sharedPictures/${ID}`]]);
    failOn = 'delete';
    await expect(unshare(DB, ID)).resolves.toBeUndefined();
  });
  it('loadSharedPicture reads one live picture; a bad id reads nothing', async () => {
    store[`sharedPictures/${ID}`] = { data: 'QUJD', mime: 'image/jpeg', w: 600, h: 450 };
    expect(await ps.loadSharedPicture(DB, ID)).toMatchObject({ dataUrl: 'data:image/jpeg;base64,QUJD' });
    expect(await ps.loadSharedPicture(DB, '../profiles')).toBeNull();
  });
});

describe('the original photo and the network', () => {
  it('the storage files reference no network API (no fetch, XHR, beacon, socket, upload)', () => {
    for (const f of ['pictureStore.js', 'pictureField.js', 'shareStore.js']) {
      const src = readFileSync(`src/data/${f}`, 'utf8').replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, '');
      expect(src).not.toMatch(/\b(fetch|XMLHttpRequest|sendBeacon|WebSocket|EventSource|uploadBytes|firebase\/storage|createObjectURL)\b/);
    }
  });
  it('only the encoded chalk bytes are written: a photo passed alongside is never read', async () => {
    const photo = { arrayBuffer: vi.fn(), size: 5000000, type: 'image/jpeg', name: 'IMG_1.jpg' };
    await ps.prepareItemPicture({ db: DB, uid: 'u1', itemId: 'inv-1', value: { ...chalk(), photo, original: photo }, prev: null });
    expect(photo.arrayBuffer).not.toHaveBeenCalled();
    expect(JSON.stringify(writes)).not.toContain('IMG_1');
    expect(Object.keys(writes[0][2]).sort()).toEqual(['data', 'h', 'mime', 'updatedAt', 'w']);
  });
});
