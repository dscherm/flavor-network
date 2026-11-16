// @vitest-environment jsdom
// SHOP-2: profile.shopping survives load, the local<->cloud merge and the save (earlier fields were once dropped by this
// normalisation), the device copy has its own versioned key, and two devices' edits merge per item.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';

const cloud = { doc: null, saved: [] };
vi.mock('firebase/firestore', () => ({
  doc: () => ({}),
  getDoc: async () => ({ exists: () => cloud.doc != null, data: () => cloud.doc }),
  setDoc: async (_ref, data) => { cloud.saved.push(JSON.parse(JSON.stringify(data))); },
}));
vi.mock('../../firebase.js', () => ({ db: {}, auth: {} }));
const useUserProfile = (await import('../useUserProfile.js')).default;
const { SHOPPING_KEY, commitList, emptyShopping } = await import('../../data/shoppingStore.js');
const { addLine, toggle, emptyList } = await import('../../data/shoppingList.js');

const PROFILE_KEY = 'flavor-user-profile-v2';
const T = Date.now() - 1000;
let n = 0;
const newId = () => `h${++n}`;
const addTo = (key, at) => (list) => addLine(list, { key, label: key }, { now: at, newId }).list;
const settle = () => act(async () => { await new Promise((r) => setTimeout(r, 30)); });
const keys = (shopping) => shopping.list.items.map((i) => i.key).sort();

beforeEach(() => { localStorage.clear(); cloud.doc = null; cloud.saved = []; n = 0; });

describe('profile.shopping on a device', () => {
  it('a profile with no shopping field loads as an empty list', () => {
    localStorage.setItem(PROFILE_KEY, JSON.stringify({ cuisines: ['thai'] }));
    const { result } = renderHook(() => useUserProfile());
    expect(result.current.profile.shopping).toEqual(emptyShopping());
    expect(result.current.profile.cuisines).toEqual(['thai']);
  });

  it('starts empty, saves to its own key (not the profile blob), and survives a reload', () => {
    const first = renderHook(() => useUserProfile());
    act(() => { first.result.current.updateShopping(addTo('milk', T), { now: T }); });
    act(() => { first.result.current.updateShopping(addTo('kale', T + 1), { now: T + 1 }); });
    expect(JSON.parse(localStorage.getItem(SHOPPING_KEY)).list.items).toHaveLength(2);
    expect(JSON.parse(localStorage.getItem(PROFILE_KEY)).shopping).toBeUndefined();
    first.unmount();
    const second = renderHook(() => useUserProfile());
    expect(keys(second.result.current.profile.shopping)).toEqual(['kale', 'milk']);
  });

  it('a list saved before the profile blob exists still loads', () => {
    const s = commitList(emptyShopping(), addTo('milk', T)(emptyList()), { now: T });
    localStorage.setItem(SHOPPING_KEY, JSON.stringify({ v: 1, ...s }));
    const { result } = renderHook(() => useUserProfile());
    expect(keys(result.current.profile.shopping)).toEqual(['milk']);
  });

  it('a corrupt or older-version device value is ignored safely', () => {
    for (const bad of ['{nope', JSON.stringify({ v: 0, list: { items: [{ id: 'a', key: 'k' }] } })]) {
      localStorage.setItem(SHOPPING_KEY, bad);
      const { result, unmount } = renderHook(() => useUserProfile());
      expect(result.current.profile.shopping).toEqual(emptyShopping());
      unmount();
    }
  });

  it('removals leave tombstones; clearing or importing the profile keeps the shopping list', () => {
    const { result } = renderHook(() => useUserProfile());
    act(() => { result.current.updateShopping(addTo('milk', T), { now: T }); });
    const id = result.current.profile.shopping.list.items[0].id;
    act(() => { result.current.updateShopping(() => emptyList(), { now: T + 5 }); });
    expect(result.current.profile.shopping.removed).toEqual({ [id]: T + 5 });
    act(() => { result.current.updateShopping(addTo('kale', T + 6), { now: T + 6 }); });
    act(() => { result.current.clearProfile(); });
    expect(keys(result.current.profile.shopping)).toEqual(['kale']);
    act(() => { result.current.importProfile(JSON.stringify({ cuisines: ['thai'] })); });
    expect(keys(result.current.profile.shopping)).toEqual(['kale']);
  });

  it('a change function that returns the same list changes nothing', () => {
    const { result } = renderHook(() => useUserProfile());
    const before = result.current.profile;
    act(() => { result.current.updateShopping((l) => l); });
    expect(result.current.profile).toBe(before);
  });
});

describe('signed in: the account copy', () => {
  const user = { uid: 'u1' };
  const lastSaved = () => cloud.saved[cloud.saved.length - 1];

  it('merges the account copy with this device\'s per item, and the field survives to the saved document', async () => {
    // The account has milk (ticked on another device); this device has milk (not ticked) and kale.
    const shared = commitList(emptyShopping(), addTo('milk', T)(emptyList()), { now: T });
    const milkId = shared.list.items[0].id;
    cloud.doc = { cuisines: [], shopping: commitList(shared, toggle(shared.list, milkId, { now: T + 10 }), { now: T + 10 }) };
    localStorage.setItem(SHOPPING_KEY, JSON.stringify({ v: 1, ...commitList(shared, addTo('kale', T + 5)(shared.list), { now: T + 5 }) }));

    const { result } = renderHook(() => useUserProfile(user));
    await waitFor(() => expect(cloud.saved.length).toBeGreaterThan(0));
    const merged = result.current.profile.shopping;
    expect(keys(merged)).toEqual(['kale', 'milk']);
    expect(merged.list.items.find((i) => i.key === 'milk').checked).toBe(true);
    expect(keys(lastSaved().shopping)).toEqual(['kale', 'milk']);
    expect(lastSaved().shopping.list.items.find((i) => i.key === 'milk').checked).toBe(true);
    expect(JSON.parse(localStorage.getItem(SHOPPING_KEY)).list.items).toHaveLength(2);
  });

  it('an account document with no shopping field loads as an empty list and this device\'s list is kept and saved', async () => {
    cloud.doc = { cuisines: ['thai'] };
    localStorage.setItem(SHOPPING_KEY, JSON.stringify({ v: 1, ...commitList(emptyShopping(), addTo('milk', T)(emptyList()), { now: T }) }));
    const { result } = renderHook(() => useUserProfile(user));
    await waitFor(() => expect(cloud.saved.length).toBeGreaterThan(0));
    expect(keys(result.current.profile.shopping)).toEqual(['milk']);
    expect(keys(lastSaved().shopping)).toEqual(['milk']);
  });

  it('a tick on this device is merged with what the account holds now, not written over it', async () => {
    cloud.doc = { cuisines: [], shopping: emptyShopping() };
    const { result } = renderHook(() => useUserProfile(user));
    await settle();
    // Another device adds eggs to the account while this one is open.
    const other = commitList(emptyShopping(), addTo('rice', T + 50)(emptyList()), { now: T + 50 });
    cloud.doc = { cuisines: [], shopping: other };
    cloud.saved = [];
    act(() => { result.current.updateShopping(addTo('milk', T + 60), { now: T + 60 }); });
    await waitFor(() => expect(cloud.saved.length).toBeGreaterThan(0));
    await waitFor(() => expect(keys(lastSaved().shopping)).toEqual(['milk', 'rice']));
    expect(keys(result.current.profile.shopping)).toEqual(['milk', 'rice']);
  });

  it('a removal here is not undone by the account copy still holding the item', async () => {
    const shared = commitList(emptyShopping(), addTo('milk', T)(emptyList()), { now: T });
    cloud.doc = { cuisines: [], shopping: shared };
    localStorage.setItem(SHOPPING_KEY, JSON.stringify({ v: 1, ...shared }));
    const { result } = renderHook(() => useUserProfile(user));
    await settle();
    cloud.saved = [];
    act(() => { result.current.updateShopping(() => emptyList(), { now: T + 5 }); });
    await waitFor(() => expect(cloud.saved.length).toBeGreaterThan(0));
    expect(keys(lastSaved().shopping)).toEqual([]);
    expect(Object.keys(lastSaved().shopping.removed)).toHaveLength(1);
    expect(keys(result.current.profile.shopping)).toEqual([]);
  });
});
