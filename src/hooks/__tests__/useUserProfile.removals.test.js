// @vitest-environment jsdom
// PROFILE-2: a deletion made on one device (signed out or in) is not undone by the other copy at sign-in or on save.
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
const settle = () => act(async () => { await new Promise((r) => setTimeout(r, 60)); });
const names = (list) => list.map((r) => r.name).sort();

beforeEach(() => { localStorage.clear(); cloud.doc = null; cloud.saved = []; });

describe('deleting signed out, then signing in', () => {
  it('keeps every list deleted although the account still holds the items', async () => {
    const first = renderHook(() => useUserProfile());
    act(() => {
      first.result.current.addCuisine('Thai');
      first.result.current.addIngredient('Garlic');
      first.result.current.addPairing('sage', 'butter');
      first.result.current.addRecipe('Beef Stew', ['beef']);
      first.result.current.addCocktail({ id: 'c1', name: 'Mine' });
      first.result.current.addSauce({ id: 's1', name: 'Mine' });
    });
    act(() => {
      first.result.current.removeCuisine('thai');
      first.result.current.removeIngredient('garlic');
      first.result.current.removePairing('butter', 'sage');
      first.result.current.removeRecipe(0);
      first.result.current.removeCocktail('c1');
      first.result.current.removeSauce('s1');
    });
    expect(JSON.parse(localStorage.getItem(PROFILE_KEY)).removed.cuisines.thai).toBeGreaterThan(0);
    first.unmount();

    cloud.doc = {
      cuisines: ['thai'], ingredients: ['garlic'], pairings: [{ a: 'butter', b: 'sage' }],
      recipes: [{ name: 'Beef Stew', ingredients: [] }], cocktails: [{ id: 'c1', name: 'Mine' }], sauces: [{ id: 's1', name: 'Mine' }],
    };
    const { result } = renderHook(() => useUserProfile(USER));
    await settle();
    const p = result.current.profile;
    expect(p.cuisines).toEqual([]);
    expect(p.ingredients).toEqual([]);
    expect(p.pairings).toEqual([]);
    expect(p.recipes).toEqual([]);
    expect(p.cocktails).toEqual([]);
    expect(p.sauces).toEqual([]);
    // and the account is told, so a third device sees it too
    const written = cloud.saved.at(-1);
    expect(written.cuisines).toEqual([]);
    expect(Object.keys(written.removed).sort()).toEqual(['cocktails', 'cuisines', 'ingredients', 'pairings', 'recipes', 'sauces']);
  });

  it('adding the thing back signed out keeps it', async () => {
    const first = renderHook(() => useUserProfile());
    act(() => { first.result.current.addIngredient('garlic'); });
    act(() => { first.result.current.removeIngredient('garlic'); });
    act(() => { first.result.current.addIngredient('garlic'); });
    first.unmount();
    cloud.doc = { ingredients: ['garlic'] };
    const { result } = renderHook(() => useUserProfile(USER));
    await settle();
    expect(result.current.profile.ingredients).toEqual(['garlic']);
  });
});

describe('deleting while signed in', () => {
  it('writes the marker with the lists, and a stale device cannot bring the item back by saving', async () => {
    cloud.doc = { ingredients: ['garlic', 'onion'], recipes: [{ name: 'Beef Stew', ingredients: [] }] };
    const { result } = renderHook(() => useUserProfile(USER));
    await settle();
    act(() => { result.current.removeIngredient('garlic'); });
    await settle();
    const last = cloud.saved.at(-1);
    expect(last.ingredients).toEqual(['onion']);
    expect(last.removed.ingredients.garlic).toBeGreaterThan(0);

    // another device, still holding garlic, signs in later and saves something else
    cloud.doc = last;
    localStorage.clear();
    localStorage.setItem(PROFILE_KEY, JSON.stringify({ ingredients: ['garlic', 'onion'] }));
    const other = renderHook(() => useUserProfile(USER));
    await settle();
    expect(other.result.current.profile.ingredients).toEqual(['onion']);
  });

  it('a device already signed in folds in a deletion made elsewhere before it writes', async () => {
    cloud.doc = { ingredients: ['garlic', 'onion'] };
    const { result } = renderHook(() => useUserProfile(USER));
    await settle();
    // meanwhile another device deleted garlic and wrote its marker
    cloud.doc = { ingredients: ['onion'], removed: { ingredients: { garlic: Date.now() } } };
    act(() => { result.current.addCuisine('thai'); });
    await settle();
    expect(result.current.profile.ingredients).toEqual(['onion']);
    expect(cloud.saved.at(-1).ingredients).toEqual(['onion']);
    expect(cloud.saved.at(-1).cuisines).toEqual(['thai']);
  });

  it('Clear marks everything it cleared', async () => {
    const { result } = renderHook(() => useUserProfile());
    act(() => { result.current.addCuisine('thai'); });
    act(() => { result.current.clearProfile(); });
    expect(result.current.profile.cuisines).toEqual([]);
    expect(result.current.profile.removed.cuisines.thai).toBeGreaterThan(0);
  });

  it('a profile with no markers anywhere loads and merges as before', async () => {
    localStorage.setItem(PROFILE_KEY, JSON.stringify({ recipes: [{ name: 'A', ingredients: [] }] }));
    cloud.doc = { recipes: [{ name: 'B', ingredients: [] }] };
    const { result } = renderHook(() => useUserProfile(USER));
    await settle();
    expect(names(result.current.profile.recipes)).toEqual(['A', 'B']);
    expect(result.current.profile.removed).toEqual({});
  });
});
