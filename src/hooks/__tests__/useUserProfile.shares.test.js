// @vitest-environment jsdom
// SHARE-6: profile.shares survives a reload (SHARE-3 once lost a field in this normalisation).
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';

vi.mock('firebase/firestore', () => ({
  doc: () => ({}), getDoc: async () => ({ exists: () => false }), setDoc: async () => {},
}));
vi.mock('../../firebase.js', () => ({ db: {}, auth: {} }));
const useUserProfile = (await import('../useUserProfile.js')).default;

const KEY = 'flavor-user-profile-v2';
const ENTRY = { id: 'abcdefghjk', kind: 'cocktail', sourceId: 'inv-1', fingerprint: 'f1', name: 'Grandma Sour', createdAt: 5 };
beforeEach(() => localStorage.clear());

describe('profile.shares', () => {
  it('starts empty, adds, replaces by id, removes', () => {
    const { result } = renderHook(() => useUserProfile());
    expect(result.current.profile.shares).toEqual([]);
    act(() => { result.current.addShare(ENTRY); });
    act(() => { result.current.addShare({ ...ENTRY, name: 'Renamed' }); });
    expect(result.current.profile.shares).toEqual([{ ...ENTRY, name: 'Renamed' }]);
    act(() => { result.current.removeShare(ENTRY.id); });
    expect(result.current.profile.shares).toEqual([]);
  });

  it('keeps shares on reload from storage', () => {
    const first = renderHook(() => useUserProfile());
    act(() => { first.result.current.addShare(ENTRY); });
    expect(JSON.parse(localStorage.getItem(KEY)).shares).toEqual([ENTRY]);
    first.unmount();
    const second = renderHook(() => useUserProfile());
    expect(second.result.current.profile.shares).toEqual([ENTRY]);
  });

  it('drops malformed entries on load (a bad id never reaches Firestore calls)', () => {
    localStorage.setItem(KEY, JSON.stringify({ shares: [ENTRY, { id: '../x' }, null, 'x', { id: 'abcdefghjk', name: 'dup' }] }));
    const { result } = renderHook(() => useUserProfile());
    expect(result.current.profile.shares).toEqual([ENTRY]);
  });

  it('a share with a bad id is refused', () => {
    const { result } = renderHook(() => useUserProfile());
    let ok;
    act(() => { ok = result.current.addShare({ ...ENTRY, id: 'short' }); });
    expect(ok).toBe(false);
    expect(result.current.profile.shares).toEqual([]);
  });

  it('clearing the profile leaves live links listed', () => {
    const { result } = renderHook(() => useUserProfile());
    act(() => { result.current.addShare(ENTRY); });
    act(() => { result.current.addIngredient('basil'); });
    act(() => { result.current.clearProfile(); });
    expect(result.current.profile.ingredients).toEqual([]);
    expect(result.current.profile.shares).toEqual([ENTRY]);
  });
});
