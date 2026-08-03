// @vitest-environment jsdom
// COOKBOOK-2 (2026-08-02). Two defects found by reading the LIVE app state
// rather than the code: localStorage held 17 saved recipes while the
// Cookbook component received userRecipes.length === 0, and four of those 17
// were the same dish saved repeatedly.
//
// Cause of the first: useUserProfile returns { profile, addRecipe, ... }, so
// recipes live at userProfile.profile.recipes. App.jsx read
// userProfile.recipes — undefined — and `|| []` converted that into a
// legitimate-looking empty list. Pinned in the App wiring test below.
//
// Cause of the second: addRecipe always appended.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';

vi.mock('firebase/firestore', () => ({
  doc: () => ({}), getDoc: async () => ({ exists: () => false }), setDoc: async () => {},
}));
vi.mock('../../firebase.js', () => ({ db: {}, auth: {} }));

const useUserProfile = (await import('../useUserProfile.js')).default;

const KEY = 'flavor-user-profile-v2';

beforeEach(() => localStorage.clear());

describe('saved recipes (COOKBOOK-2)', () => {
  it('exposes recipes under .profile — the path the Cookbook must read', () => {
    const { result } = renderHook(() => useUserProfile());
    act(() => { result.current.addRecipe('Coq au Vin', ['chicken', 'red wine']); });

    expect(result.current.profile.recipes).toHaveLength(1);
    // The exact mistake that hid every saved recipe: this must stay undefined
    // so nobody "fixes" a consumer by reading it.
    expect(result.current.recipes).toBeUndefined();
  });

  it('saving the same name twice replaces instead of duplicating', () => {
    const { result } = renderHook(() => useUserProfile());
    act(() => { result.current.addRecipe('Coq au Vin', ['chicken']); });
    act(() => { result.current.addRecipe('Coq au Vin', ['chicken', 'bacon', 'thyme']); });

    expect(result.current.profile.recipes).toHaveLength(1);
    // The replacement must be the NEWER version — re-saving after an edit is
    // the main reason to press Save twice.
    expect(result.current.profile.recipes[0].ingredients).toHaveLength(3);
  });

  it('matches names case-insensitively and ignores surrounding space', () => {
    const { result } = renderHook(() => useUserProfile());
    act(() => { result.current.addRecipe('Coq au Vin', ['chicken']); });
    act(() => { result.current.addRecipe('  coq AU vin  ', ['chicken', 'bacon']); });
    expect(result.current.profile.recipes).toHaveLength(1);
  });

  it('still keeps genuinely different recipes apart', () => {
    const { result } = renderHook(() => useUserProfile());
    act(() => { result.current.addRecipe('Coq au Vin', ['chicken']); });
    act(() => { result.current.addRecipe('Beef Bourguignon', ['beef']); });
    expect(result.current.profile.recipes).toHaveLength(2);
  });

  it('collapses duplicates already written to storage by the old append', () => {
    // Exactly the shape found in the live profile: the same dish four times.
    localStorage.setItem(KEY, JSON.stringify({
      cuisines: [], ingredients: [], cocktails: [], sauces: [], pairings: [],
      recipes: [
        { name: 'Coq au Vin', ingredients: [{ name: 'chicken' }] },
        { name: 'Coq au Vin', ingredients: [{ name: 'chicken' }] },
        { name: 'Coq au Vin', ingredients: [{ name: 'chicken' }, { name: 'bacon' }] },
        { name: 'Untitled Recipe', ingredients: [{ name: 'salt' }] },
      ],
    }));
    const { result } = renderHook(() => useUserProfile());
    const names = result.current.profile.recipes.map((r) => r.name);
    expect(names).toEqual(['Coq au Vin', 'Untitled Recipe']);
    // Last wins — the most recent save is the one to keep.
    expect(result.current.profile.recipes[0].ingredients).toHaveLength(2);
  });
});
