// SHOP-2. The profile document's rule does not look inside the document, so the new `shopping` field needs no rule
// change; this pins what must stay true for it: the owner reads and writes it, nobody else does, signed out cannot.
// Runs against the LOCAL Firestore emulator only, under its own demo- project id: npm run test:rules
import { readFileSync } from 'node:fs';
import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest';
import { assertFails, assertSucceeds, initializeTestEnvironment } from '@firebase/rules-unit-testing';
import { doc, getDoc, setDoc } from 'firebase/firestore';

const OWNER = 'owner-uid';
const OTHER = 'other-uid';
let env;
const asOwner = () => env.authenticatedContext(OWNER).firestore();
const asOther = () => env.authenticatedContext(OTHER).firestore();
const anon = () => env.unauthenticatedContext().firestore();

const item = (n) => ({ id: `s${n}`, key: `k${n}`, label: `item ${n}`, parts: [{ qty: 2, unit: 'clove' }], checked: false, from: [], updatedAt: 1700000000000 + n });
const profile = (count = 3) => ({
  cuisines: [], recipes: [],
  shopping: { list: { items: Array.from({ length: count }, (_, i) => item(i)), recipes: [] }, removed: { gone1: 1700000000000 } },
});

beforeAll(async () => {
  env = await initializeTestEnvironment({ projectId: 'demo-neuralflavor-shopping', firestore: { rules: readFileSync('firestore.rules', 'utf8') } });
});
afterAll(async () => { await env?.cleanup(); });
beforeEach(async () => { await env.clearFirestore(); });

describe('profiles/{uid}.shopping', () => {
  it('the owner can write and read their own list', async () => {
    await assertSucceeds(setDoc(doc(asOwner(), 'profiles', OWNER), profile()));
    const snap = await assertSucceeds(getDoc(doc(asOwner(), 'profiles', OWNER)));
    if (snap.data().shopping.list.items.length !== 3) throw new Error('list not stored');
  });

  it('a full 200-item list with its tombstones is well inside what the owner may write', async () => {
    const p = profile(200);
    p.shopping.removed = Object.fromEntries(Array.from({ length: 300 }, (_, i) => [`t${i}`, 1700000000000 + i]));
    await assertSucceeds(setDoc(doc(asOwner(), 'profiles', OWNER), p));
  });

  it('another signed-in user can neither read nor write it', async () => {
    await env.withSecurityRulesDisabled(async (ctx) => { await setDoc(doc(ctx.firestore(), 'profiles', OWNER), profile()); });
    await assertFails(getDoc(doc(asOther(), 'profiles', OWNER)));
    await assertFails(setDoc(doc(asOther(), 'profiles', OWNER), profile(1)));
  });

  it('signed out can neither read nor write it', async () => {
    await env.withSecurityRulesDisabled(async (ctx) => { await setDoc(doc(ctx.firestore(), 'profiles', OWNER), profile()); });
    await assertFails(getDoc(doc(anon(), 'profiles', OWNER)));
    await assertFails(setDoc(doc(anon(), 'profiles', OWNER), profile(1)));
  });
});
