// USAGE-3. The Admin-SDK reader in scripts/accountTotals.mjs, run against the LOCAL Firestore emulator only
// (demo- project; FIRESTORE_EMULATOR_HOST is set by `npm run test:rules`). Never touches a real project.
import { createRequire } from 'node:module';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { initializeTestEnvironment } from '@firebase/rules-unit-testing';
import { doc, setDoc } from 'firebase/firestore';
import { buildTotals, formatTotals, readTotals } from '../scripts/accountTotals.mjs';

const PROJECT = 'demo-totals-reader'; // its own project id so the parallel shared.rules test's clearFirestore cannot wipe this data
let env;

beforeAll(async () => {
  expect(process.env.FIRESTORE_EMULATOR_HOST).toBeTruthy();
  env = await initializeTestEnvironment({ projectId: PROJECT });
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    await setDoc(doc(db, 'profiles', 'u1'), { email: 'a@example.com', cocktails: [{ id: '1', name: 'Secret', sharedFrom: 'cocktail/negroni' }], sauces: [], recipes: [{ id: '2' }] });
    await setDoc(doc(db, 'profiles', 'u2'), { email: 'b@example.com' });
    await setDoc(doc(db, 'shared', 'aaaaaaaaaa'), { kind: 'cocktail', removed: false, name: 'Secret' });
    await setDoc(doc(db, 'shared', 'bbbbbbbbbb'), { kind: 'recipe', removed: true });
    await setDoc(doc(db, 'shareReports', 'r1'), { reason: 'spam', note: 'Secret' });
    await setDoc(doc(db, 'scanCodes', 'c1'), { enabled: true, label: 'Secret' });
    await setDoc(doc(db, 'barScans', 'c1_2026-11-16'), { count: 4, day: '2026-11-16' });
    await setDoc(doc(db, 'barScans', 'c1_2026-11-17'), { count: 3, day: '2026-11-17' });
  });
});
afterAll(async () => { await env?.cleanup(); });

describe('readTotals against the emulator', () => {
  it('returns the counts and nothing else', async () => {
    const req = createRequire(new URL('../functions/package.json', import.meta.url));
    const { initializeApp } = req('firebase-admin/app');
    const { getFirestore, AggregateField } = req('firebase-admin/firestore');
    const app = initializeApp({ projectId: PROJECT }, 'totals-test');
    const t = await readTotals(getFirestore(app), AggregateField);
    expect(t.accounts).toBe(2);
    expect(t.accountsWithSaved).toBe(1);
    expect(t.savedItems).toMatchObject({ cocktail: 1, sauce: 0, recipe: 1, total: 2 });
    expect(t.savedFromSharedLink.cocktail).toBe(1);
    expect(t.sharedLinksLive).toMatchObject({ cocktail: 1, total: 1 });
    expect(t.sharedLinksRemoved).toMatchObject({ recipe: 1, total: 1 });
    expect(t.reportsWaiting).toMatchObject({ total: 1, spam: 1 });
    expect(t.inviteCodeScans).toEqual({ codes: 1, scansTotal: 7 });
    expect(formatTotals(t)).not.toMatch(/Secret|example\.com|aaaaaaaaaa/);
    expect(buildTotals).toBeTypeOf('function');
  });
});
