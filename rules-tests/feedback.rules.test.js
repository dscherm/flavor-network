// USAGE-4. Firestore rules for feedback/{id}: create by anyone within limits, never readable or changeable
// through the app. LOCAL emulator only, demo- project id:  npm run test:rules
import { readFileSync } from 'node:fs';
import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest';
import { assertFails, assertSucceeds, initializeTestEnvironment } from '@firebase/rules-unit-testing';
import { addDoc, collection, deleteDoc, doc, getDoc, getDocs, serverTimestamp, setDoc, updateDoc } from 'firebase/firestore';

let env;
const anon = () => env.unauthenticatedContext().firestore();
const asUser = () => env.authenticatedContext('some-uid').firestore();

const good = (over = {}) => ({ note: 'The search is slow.', goal: 'Find a gin drink', lab: 'cocktail', at: serverTimestamp(), ...over });
const make = (db, data) => addDoc(collection(db, 'feedback'), data);

beforeAll(async () => {
  env = await initializeTestEnvironment({ projectId: 'demo-neuralflavor', firestore: { rules: readFileSync('firestore.rules', 'utf8') } });
});
afterAll(async () => { await env?.cleanup(); });
beforeEach(async () => { await env.clearFirestore(); });

describe('feedback/{id}: create', () => {
  it('lets anyone create a valid note, signed out or signed in', async () => {
    await assertSucceeds(make(anon(), good()));
    await assertSucceeds(make(asUser(), good()));
  });
  it('allows an empty goal and the longest allowed texts', async () => {
    await assertSucceeds(make(anon(), good({ goal: '' })));
    await assertSucceeds(make(anon(), good({ note: 'x'.repeat(500), goal: 'y'.repeat(200) })));
  });
  it('accepts every screen on the list', async () => {
    for (const lab of ['labs', 'shared', 'cocktail', 'sauce', 'recipe', 'make', 'cookbook', 'pairing', 'wine', 'network', 'profile', 'other']) {
      await assertSucceeds(make(anon(), good({ lab })));
    }
  });
  it('denies an empty note', async () => {
    await assertFails(make(anon(), good({ note: '' })));
  });
  it('denies a note over 500 and a goal over 200 characters', async () => {
    await assertFails(make(anon(), good({ note: 'x'.repeat(501) })));
    await assertFails(make(anon(), good({ goal: 'y'.repeat(201) })));
  });
  it('denies an extra key, including uid, email and name', async () => {
    for (const extra of [{ uid: 'some-uid' }, { email: 'a@b.co' }, { name: 'Dan' }, { owner: 'x' }]) {
      await assertFails(make(asUser(), good(extra)));
    }
  });
  it('denies a missing key', async () => {
    for (const k of ['note', 'goal', 'lab', 'at']) {
      const d = good(); delete d[k];
      await assertFails(make(anon(), d));
    }
  });
  it('denies wrong types and an unknown screen', async () => {
    await assertFails(make(anon(), good({ note: 5 })));
    await assertFails(make(anon(), good({ goal: null })));
    await assertFails(make(anon(), good({ lab: 'https://x.test/?id=1' })));
    await assertFails(make(anon(), good({ lab: 7 })));
  });
  it('denies a client-chosen time: only the server time is accepted', async () => {
    await assertFails(make(anon(), good({ at: Date.now() })));
    await assertFails(make(anon(), good({ at: new Date('2020-01-01') })));
  });
  it('denies overwriting a document that already exists', async () => {
    await assertSucceeds(setDoc(doc(anon(), 'feedback', 'abc'), good()));
    await assertFails(setDoc(doc(anon(), 'feedback', 'abc'), good({ note: 'changed' })));
  });
});

describe('feedback/{id}: no reads or changes through the app', () => {
  it('denies get, list, update and delete to everyone, including the writer', async () => {
    const writer = asUser();
    const ref = await make(writer, good());
    for (const db of [anon(), writer, asUser()]) {
      await assertFails(getDoc(doc(db, 'feedback', ref.id)));
      await assertFails(getDocs(collection(db, 'feedback')));
      await assertFails(updateDoc(doc(db, 'feedback', ref.id), { note: 'edited' }));
      await assertFails(deleteDoc(doc(db, 'feedback', ref.id)));
    }
  });
});
