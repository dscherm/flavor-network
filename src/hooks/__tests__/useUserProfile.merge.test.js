// @vitest-environment jsdom
// SHOP-5: favourite pairings used to be dropped when the device copy and the account copy merged at sign-in
// (mergeProfiles returned no `pairings`, and the cloud load never read them), and the next save then wrote the
// profile back without them. Every field of the default profile must survive the merge.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';

const cloud = { doc: null, saved: [] };
vi.mock('firebase/firestore', () => ({
  doc: () => ({}),
  getDoc: async () => ({ exists: () => cloud.doc != null, data: () => cloud.doc }),
  setDoc: async (_ref, data) => { cloud.saved.push(JSON.parse(JSON.stringify(data))); },
}));
vi.mock('../../firebase.js', () => ({ db: {}, auth: {} }));
const useUserProfile = (await import('../useUserProfile.js')).default;

const PROFILE_KEY = 'flavor-user-profile-v2';
const USER = { uid: 'u1' };
const settle = () => act(async () => { await new Promise((r) => setTimeout(r, 40)); });
const pairs = (list) => list.map((p) => `${p.a}+${p.b}`).sort();

beforeEach(() => { localStorage.clear(); cloud.doc = null; cloud.saved = []; });

describe('sign-in merge of favourite pairings', () => {
  it('keeps this device\'s pairings and the account\'s, once each, in canonical form', async () => {
    localStorage.setItem(PROFILE_KEY, JSON.stringify({ pairings: [{ a: 'sage', b: 'butter' }, { a: 'garlic', b: 'lemon' }] }));
    cloud.doc = { pairings: [{ a: 'lemon', b: 'garlic' }, { a: 'basil', b: 'tomato' }], cuisines: ['thai'] };
    const { result } = renderHook(() => useUserProfile(USER));
    await settle();
    expect(pairs(result.current.profile.pairings)).toEqual(['basil+tomato', 'butter+sage', 'garlic+lemon']);
    expect(result.current.hasPairing('tomato', 'basil')).toBe(true);
    expect(result.current.hasPairing('butter', 'sage')).toBe(true);
  });

  it('an account with pairings and a device with none gets them (they were dropped before)', async () => {
    cloud.doc = { pairings: [{ a: 'basil', b: 'tomato' }] };
    const { result } = renderHook(() => useUserProfile(USER));
    await settle();
    expect(pairs(result.current.profile.pairings)).toEqual(['basil+tomato']);
  });

  it('pairings that exist only on the device are written to the account, and a later save keeps all of them', async () => {
    localStorage.setItem(PROFILE_KEY, JSON.stringify({ pairings: [{ a: 'sage', b: 'butter' }] }));
    cloud.doc = { pairings: [{ a: 'basil', b: 'tomato' }] };
    const { result } = renderHook(() => useUserProfile(USER));
    await settle();
    expect(cloud.saved.length).toBeGreaterThan(0);
    expect(pairs(cloud.saved.at(-1).pairings)).toEqual(['basil+tomato', 'butter+sage']);
    act(() => { result.current.addCuisine('Thai'); });
    await settle();
    expect(pairs(cloud.saved.at(-1).pairings)).toEqual(['basil+tomato', 'butter+sage']);
  });

  it('malformed pairing entries in the account are ignored, not carried', async () => {
    cloud.doc = { pairings: [{ a: 'basil', b: 'tomato' }, { a: 'x' }, null, { a: 'same', b: 'same' }, 'junk'] };
    const { result } = renderHook(() => useUserProfile(USER));
    await settle();
    expect(pairs(result.current.profile.pairings)).toEqual(['basil+tomato']);
  });
});

describe('the merge carries every field of the profile', () => {
  it('after sign-in the profile has exactly the keys a signed-out profile has', async () => {
    const signedOut = renderHook(() => useUserProfile());
    const keys = Object.keys(signedOut.result.current.profile).sort();
    signedOut.unmount();
    localStorage.clear();
    cloud.doc = { cuisines: ['thai'], ingredients: ['garlic'], recipes: [], cocktails: [], sauces: [], shares: [], pairings: [{ a: 'a', b: 'b' }], quizAnswers: { q: 1 } };
    const { result } = renderHook(() => useUserProfile(USER));
    await settle();
    expect(Object.keys(result.current.profile).sort()).toEqual(keys);
    for (const k of keys) expect(result.current.profile[k], k).not.toBeUndefined();
    expect(result.current.profile.quizAnswers).toEqual({ q: 1 });
    expect(result.current.profile.cuisines).toEqual(['thai']);
    expect(result.current.profile.ingredients).toEqual(['garlic']);
  });
});
