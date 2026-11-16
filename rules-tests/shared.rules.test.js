// SHARE-6. Firestore rules for shared/{id} (and a check that the other collections stayed closed/open as before).
// Runs against the LOCAL Firestore emulator only, under a demo- project id (no production access possible):
//   npm run test:rules
import { readFileSync } from 'node:fs';
import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest';
import { assertFails, assertSucceeds, initializeTestEnvironment } from '@firebase/rules-unit-testing';
import { addDoc, deleteDoc, doc, getDoc, getDocs, collection, setDoc, updateDoc } from 'firebase/firestore';

const ID = 'abcdefghjk';
const OWNER = 'owner-uid';
const OTHER = 'other-uid';

let env;

const good = (over = {}) => ({
  kind: 'cocktail',
  name: 'Grandma Sour',
  lines: [{ key: 'bourbon', amount: '2 oz' }, { key: 'lemon juice', amount: '1 oz' }],
  method: 'Shake with ice.',
  glass: 'Rocks',
  category: 'sours',
  bars: [{ label: 'Sweet', color: '#ff00aa', score: 0.4 }],
  by: null,
  owner: OWNER,
  createdAt: Date.now(),
  removed: false,
  ...over,
});

const asOwner = () => env.authenticatedContext(OWNER).firestore();
const asOther = () => env.authenticatedContext(OTHER).firestore();
const anon = () => env.unauthenticatedContext().firestore();
const seed = async (data = good(), id = ID) => {
  await env.withSecurityRulesDisabled(async (ctx) => { await setDoc(doc(ctx.firestore(), 'shared', id), data); });
};

beforeAll(async () => {
  env = await initializeTestEnvironment({
    projectId: 'demo-neuralflavor',
    firestore: { rules: readFileSync('firestore.rules', 'utf8') },
  });
});
afterAll(async () => { await env?.cleanup(); });
beforeEach(async () => { await env.clearFirestore(); });

describe('shared/{id}: reading', () => {
  it('lets anyone get one document by id, signed out too', async () => {
    await seed();
    await assertSucceeds(getDoc(doc(anon(), 'shared', ID)));
    await assertSucceeds(getDoc(doc(asOther(), 'shared', ID)));
  });
  it('lets nobody list the collection', async () => {
    await seed();
    await assertFails(getDocs(collection(anon(), 'shared')));
    await assertFails(getDocs(collection(asOwner(), 'shared')));
  });
  it('does not return a removed share to anyone but its owner', async () => {
    await seed(good({ removed: true }));
    await assertFails(getDoc(doc(anon(), 'shared', ID)));
    await assertFails(getDoc(doc(asOther(), 'shared', ID)));
    await assertSucceeds(getDoc(doc(asOwner(), 'shared', ID)));
  });
});

describe('shared/{id}: create', () => {
  it('allows a signed-in owner with a valid document', async () => {
    await assertSucceeds(setDoc(doc(asOwner(), 'shared', ID), good()));
  });
  it('allows a chosen name, no method and no optional fields', async () => {
    const d = good({ by: 'Dan' });
    delete d.method; delete d.glass; delete d.category;
    await assertSucceeds(setDoc(doc(asOwner(), 'shared', ID), d));
  });
  it('denies signed out', async () => {
    await assertFails(setDoc(doc(anon(), 'shared', ID), good()));
  });
  it('denies another uid as owner', async () => {
    await assertFails(setDoc(doc(asOther(), 'shared', ID), good({ owner: OWNER })));
  });
  it('denies an id that is not 10 lowercase characters', async () => {
    await assertFails(setDoc(doc(asOwner(), 'shared', 'short'), good()));
    await assertFails(setDoc(doc(asOwner(), 'shared', 'ABCDEFGHJK'), good()));
    await assertFails(setDoc(doc(asOwner(), 'shared', 'abcdefghjkl'), good()));
  });
  it('denies an extra key', async () => {
    await assertFails(setDoc(doc(asOwner(), 'shared', ID), good({ email: 'a@b.c' })));
  });
  it('denies a missing required key', async () => {
    for (const k of ['kind', 'name', 'lines', 'bars', 'by', 'owner', 'createdAt', 'removed']) {
      const d = good();
      delete d[k];
      await assertFails(setDoc(doc(asOwner(), 'shared', ID), d));
    }
  });
  it('denies removed: true', async () => {
    await assertFails(setDoc(doc(asOwner(), 'shared', ID), good({ removed: true })));
  });
  it('denies each limit being exceeded', async () => {
    const over = {
      name: 'n'.repeat(81),
      by: 'b'.repeat(31),
      method: 'm'.repeat(2001),
      glass: 'g'.repeat(61),
      category: 'c'.repeat(61),
      protein: 'p'.repeat(61),
      lines: Array.from({ length: 41 }, (_, i) => ({ key: `k${i}`, amount: '' })),
      bars: Array.from({ length: 18 }, () => ({ label: 'x', color: '#000000', score: 0 })),
    };
    for (const [k, v] of Object.entries(over)) {
      await assertFails(setDoc(doc(asOwner(), 'shared', ID), good({ [k]: v })));
    }
  });
  it('accepts the limits exactly', async () => {
    await assertSucceeds(setDoc(doc(asOwner(), 'shared', ID), good({
      name: 'n'.repeat(80), by: 'b'.repeat(30), method: 'm'.repeat(2000),
      lines: Array.from({ length: 40 }, (_, i) => ({ key: `k${i}`, amount: '' })),
      bars: Array.from({ length: 17 }, () => ({ label: 'x', color: '#000000', score: 0 })),
    })));
  });
  it('CHART-4: all 17 notes may be stored, and an older copy with 4 + 4 or 11 bars is still valid', async () => {
    const bar = (i) => ({ label: `n${i}`, color: '#000000', score: 0.5 });
    await assertSucceeds(setDoc(doc(asOwner(), 'shared', 'abcdefghjk'), good({ bars: Array.from({ length: 17 }, (_, i) => bar(i)) })));
    for (const [id, n] of [['abcdefghj1', 8], ['abcdefghj2', 11], ['abcdefghj3', 0]]) {
      await assertSucceeds(setDoc(doc(asOwner(), 'shared', id), good({ bars: Array.from({ length: n }, (_, i) => bar(i)) })));
    }
    await assertFails(setDoc(doc(asOwner(), 'shared', 'abcdefghj4'), good({ bars: Array.from({ length: 18 }, (_, i) => bar(i)) })));
  });
  it('denies wrong types and an empty name or empty lines', async () => {
    for (const over of [{ name: '' }, { name: 5 }, { lines: [] }, { lines: 'x' }, { bars: 'x' }, { by: 5 }, { kind: 'wine' }, { createdAt: 'now' }]) {
      await assertFails(setDoc(doc(asOwner(), 'shared', ID), good(over)));
    }
  });
  it('denies a createdAt far in the future', async () => {
    await assertFails(setDoc(doc(asOwner(), 'shared', ID), good({ createdAt: Date.now() + 10 * 86400000 })));
  });
});

describe('shared/{id}: update and delete', () => {
  it('lets the owner set removed: true', async () => {
    await seed();
    await assertSucceeds(updateDoc(doc(asOwner(), 'shared', ID), { removed: true }));
  });
  it('denies a non-owner updating removed', async () => {
    await seed();
    await assertFails(updateDoc(doc(asOther(), 'shared', ID), { removed: true }));
    await assertFails(updateDoc(doc(anon(), 'shared', ID), { removed: true }));
  });
  it('denies the owner changing any other field', async () => {
    await seed();
    for (const patch of [{ name: 'New name' }, { owner: OTHER }, { by: 'Dan' }, { lines: [{ key: 'x', amount: '' }] }, { removed: false }, { name: 'x', removed: true }]) {
      await assertFails(updateDoc(doc(asOwner(), 'shared', ID), patch));
    }
  });
  it('lets the owner delete, and nobody else', async () => {
    await seed();
    await assertFails(deleteDoc(doc(asOther(), 'shared', ID)));
    await assertFails(deleteDoc(doc(anon(), 'shared', ID)));
    await assertSucceeds(deleteDoc(doc(asOwner(), 'shared', ID)));
  });
});

describe('the other collections are unchanged', () => {
  it('profiles: only the owner reads and writes', async () => {
    await assertSucceeds(setDoc(doc(asOwner(), 'profiles', OWNER), { cuisines: [] }));
    await assertSucceeds(getDoc(doc(asOwner(), 'profiles', OWNER)));
    await assertFails(getDoc(doc(asOther(), 'profiles', OWNER)));
    await assertFails(getDoc(doc(anon(), 'profiles', OWNER)));
    await assertFails(setDoc(doc(asOther(), 'profiles', OWNER), { cuisines: [] }));
  });
  it('scanCodes and barScans: closed to every client', async () => {
    for (const [c, id] of [['scanCodes', 'x'], ['barScans', 'x_2026-01-01']]) {
      await assertFails(getDoc(doc(asOwner(), c, id)));
      await assertFails(setDoc(doc(asOwner(), c, id), { a: 1 }));
    }
  });
});

// SHARE-7. Reports: create by anyone within limits, never readable or changeable through the app.
const goodReport = (over = {}) => ({ shareId: ID, reason: 'spam', note: 'Looks like an advert.', at: Date.now(), ...over });
const makeReport = (db, data) => addDoc(collection(db, 'shareReports'), data);

describe('shareReports/{id}', () => {
  it('lets anyone create a valid report, signed out or signed in', async () => {
    await assertSucceeds(makeReport(anon(), goodReport()));
    await assertSucceeds(makeReport(asOther(), goodReport({ note: '' })));
    await assertSucceeds(makeReport(anon(), goodReport({ note: 'x'.repeat(300) })));
  });
  it('accepts every reason on the list', async () => {
    for (const reason of ['offensive', 'spam', 'private', 'not-recipe', 'picture', 'other']) {
      await assertSucceeds(makeReport(anon(), goodReport({ reason })));
    }
  });
  it('denies a note over 300 characters', async () => {
    await assertFails(makeReport(anon(), goodReport({ note: 'x'.repeat(301) })));
  });
  it('denies a reason that is not on the list', async () => {
    await assertFails(makeReport(anon(), goodReport({ reason: 'because' })));
  });
  it('denies an extra key, such as a reporter uid', async () => {
    await assertFails(makeReport(asOther(), goodReport({ uid: OTHER })));
  });
  it('denies a missing key', async () => {
    const d = goodReport(); delete d.note;
    await assertFails(makeReport(anon(), d));
  });
  it('denies a bad shareId', async () => {
    for (const shareId of ['short', 'ABCDEFGHJK', 'abcdefghjk1', 'abcdefghj!', 42, null]) {
      await assertFails(makeReport(anon(), goodReport({ shareId })));
    }
  });
  it('denies a wrong type for note or at, and a time more than a day ahead', async () => {
    await assertFails(makeReport(anon(), goodReport({ note: 5 })));
    await assertFails(makeReport(anon(), goodReport({ at: 'now' })));
    await assertFails(makeReport(anon(), goodReport({ at: Date.now() + 2 * 86400000 })));
    await assertSucceeds(makeReport(anon(), goodReport({ at: Date.now() - 5 * 86400000 })));
  });
  it('denies get, list, update and delete to everyone, including a signed-in user', async () => {
    let rid;
    await env.withSecurityRulesDisabled(async (ctx) => {
      rid = (await addDoc(collection(ctx.firestore(), 'shareReports'), goodReport())).id;
    });
    for (const db of [anon(), asOther(), asOwner()]) {
      await assertFails(getDoc(doc(db, 'shareReports', rid)));
      await assertFails(getDocs(collection(db, 'shareReports')));
      await assertFails(updateDoc(doc(db, 'shareReports', rid), { note: 'edited' }));
      await assertFails(deleteDoc(doc(db, 'shareReports', rid)));
    }
  });
});

describe('site-owner takedown, exercised against the emulator', () => {
  it('setting removed: true on a shared document (as the console does, bypassing rules) stops anonymous reads', async () => {
    await seed();
    await assertSucceeds(getDoc(doc(anon(), 'shared', ID)));
    await env.withSecurityRulesDisabled(async (ctx) => {
      await updateDoc(doc(ctx.firestore(), 'shared', ID), { removed: true });
    });
    await assertFails(getDoc(doc(anon(), 'shared', ID)));
    await assertFails(getDoc(doc(asOther(), 'shared', ID)));
  });
});
