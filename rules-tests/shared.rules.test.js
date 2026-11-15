// SHARE-6. Firestore rules for shared/{id} (and a check that the other collections stayed closed/open as before).
// Runs against the LOCAL Firestore emulator only, under a demo- project id (no production access possible):
//   npm run test:rules
import { readFileSync } from 'node:fs';
import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest';
import { assertFails, assertSucceeds, initializeTestEnvironment } from '@firebase/rules-unit-testing';
import { deleteDoc, doc, getDoc, getDocs, collection, setDoc, updateDoc } from 'firebase/firestore';

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
      bars: Array.from({ length: 12 }, () => ({ label: 'x', color: '#000000', score: 0 })),
    };
    for (const [k, v] of Object.entries(over)) {
      await assertFails(setDoc(doc(asOwner(), 'shared', ID), good({ [k]: v })));
    }
  });
  it('accepts the limits exactly', async () => {
    await assertSucceeds(setDoc(doc(asOwner(), 'shared', ID), good({
      name: 'n'.repeat(80), by: 'b'.repeat(30), method: 'm'.repeat(2000),
      lines: Array.from({ length: 40 }, (_, i) => ({ key: `k${i}`, amount: '' })),
      bars: Array.from({ length: 11 }, () => ({ label: 'x', color: '#000000', score: 0 })),
    })));
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
