// @vitest-environment jsdom
// INVENT-12: the save path — the profile writer (useUserProfile) and the onSave a lab hands its invent panel.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';

vi.mock('firebase/firestore', () => ({
  doc: () => ({}), getDoc: async () => ({ exists: () => false }), setDoc: async () => {},
}));
vi.mock('../../firebase.js', () => ({ db: {}, auth: {} }));

const useUserProfile = (await import('../useUserProfile.js')).default;
const useSaveInvention = (await import('../useSaveInvention.js')).default;

const KEY = 'flavor-user-profile-v2';
const INPUT = { name: 'Dusk', category: 3, lines: [{ key: 'bourbon', amount: '2 oz', role: null }, { key: 'bitters', amount: '', role: null }] };

beforeEach(() => localStorage.clear());

describe('useUserProfile.saveInvention', () => {
  it('writes one cocktail into profile.cocktails and nothing else; the same id updates in place', () => {
    const { result } = renderHook(() => useUserProfile());
    const before = result.current.profile;
    let res;
    act(() => { res = result.current.saveInvention({ ...INPUT, kind: 'cocktail' }); });
    expect(res.ok).toBe(true);
    const after = result.current.profile;
    expect(after.cocktails).toHaveLength(1);
    expect({ ...after, cocktails: [] }).toEqual({ ...before, cocktails: [] });
    expect(JSON.parse(localStorage.getItem(KEY)).cocktails).toHaveLength(1);
    act(() => { result.current.saveInvention({ ...INPUT, kind: 'cocktail', id: res.item.id, name: 'Dusk II' }); });
    expect(result.current.profile.cocktails.map((c) => c.name)).toEqual(['Dusk II']);
  });

  it('saves a recipe through profile.recipes (the Cookbook list), keeping its method and source', () => {
    const { result } = renderHook(() => useUserProfile());
    act(() => { result.current.saveInvention({ kind: 'recipe', name: 'Soup', method: 'Simmer.', lines: [{ key: 'stock' }, { key: 'carrot' }] }); });
    expect(result.current.profile.recipes).toHaveLength(1);
    expect(result.current.profile.recipes[0]).toMatchObject({ name: 'Soup', instructions: 'Simmer.', source: 'invent' });
    // survives a reload from storage
    const again = renderHook(() => useUserProfile());
    expect(again.result.current.profile.recipes[0]).toMatchObject({ name: 'Soup', instructions: 'Simmer.', source: 'invent' });
  });

  it('deleteInvention removes it', () => {
    const { result } = renderHook(() => useUserProfile());
    let id;
    act(() => { id = result.current.saveInvention({ ...INPUT, kind: 'sauce' }).item.id; });
    expect(result.current.profile.sauces).toHaveLength(1);
    act(() => { result.current.deleteInvention('sauce', id); });
    expect(result.current.profile.sauces).toEqual([]);
  });

  it('a profile with no cocktails / sauces fields, or malformed ones, loads without an error', () => {
    localStorage.setItem(KEY, JSON.stringify({ cuisines: [], ingredients: [], recipes: [], quizAnswers: null }));
    const a = renderHook(() => useUserProfile());
    expect(a.result.current.profile.cocktails).toEqual([]);
    expect(a.result.current.profile.sauces).toEqual([]);
    localStorage.setItem(KEY, JSON.stringify({ cocktails: 'x', sauces: { no: 1 }, recipes: [{ name: 'R' }] }));
    const b = renderHook(() => useUserProfile());
    expect(b.result.current.profile.cocktails).toEqual([]);
    let res;
    act(() => { res = b.result.current.saveInvention({ ...INPUT, kind: 'cocktail' }); });
    expect(res.ok).toBe(true);
    localStorage.setItem(KEY, JSON.stringify({ cocktails: [null, 3, { id: 1 }] }));
    const c = renderHook(() => useUserProfile());
    act(() => { res = c.result.current.saveInvention({ ...INPUT, kind: 'cocktail' }); });
    expect(res.ok).toBe(true);
    expect(c.result.current.profile.cocktails.filter((x) => x && x.kind === 'cocktail')).toHaveLength(1);
  });

  it('reports a failed local write and changes nothing', () => {
    const { result } = renderHook(() => useUserProfile());
    const spy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('quota'); });
    let res;
    act(() => { res = result.current.saveInvention({ ...INPUT, kind: 'cocktail' }); });
    spy.mockRestore();
    expect(res.ok).toBe(false);
    expect(res.reason).toMatch(/Nothing was lost/);
    expect(result.current.profile.cocktails).toEqual([]);
  });
});

describe('useSaveInvention', () => {
  const setup = (over = {}) => {
    const writer = over.writer || vi.fn(() => ({ ok: true, item: { id: 'x' } }));
    const props = { kind: 'cocktail', userProfile: { saveInvention: writer }, auth: { user: { uid: 'u' } }, ...over.props };
    const view = renderHook((p) => useSaveInvention(p), { initialProps: props });
    return { writer, view, props };
  };

  it('signed in: writes through the profile writer and says where it went', async () => {
    const { writer, view } = setup();
    let res;
    await act(async () => { res = await view.result.current.onSave(INPUT); });
    expect(res).toEqual({ status: 'saved', message: 'Saved to your cocktails' });
    expect(writer).toHaveBeenCalledTimes(1);
    expect(writer).toHaveBeenCalledWith({ ...INPUT, kind: 'cocktail' });
    expect(view.result.current.pending).toBeNull();
  });

  it('signed out: asks to sign in and saves the SAME invention exactly once after sign-in', async () => {
    const { writer, view, props } = setup({ props: { auth: { user: null }, kind: 'sauce' } });
    let res;
    await act(async () => { res = await view.result.current.onSave(INPUT); });
    expect(res).toEqual({ status: 'signin', message: 'Sign in to save this.' });
    expect(writer).not.toHaveBeenCalled();
    expect(view.result.current.pending).toEqual(INPUT);
    view.rerender({ ...props, auth: { user: { uid: 'u' } } });
    expect(writer).toHaveBeenCalledTimes(1);
    expect(writer).toHaveBeenCalledWith({ ...INPUT, kind: 'sauce' });
    expect(view.result.current.toast).toEqual({ status: 'saved', message: 'Saved to your sauces' });
    expect(view.result.current.pending).toBeNull();
    view.rerender({ ...props, auth: { user: { uid: 'u2' } } });
    view.rerender({ ...props, auth: { user: { uid: 'u2' } } });
    expect(writer).toHaveBeenCalledTimes(1);
  });

  it('cancelPending drops the queued save, so a later sign-in saves nothing', async () => {
    const { writer, view, props } = setup({ props: { auth: { user: null } } });
    await act(async () => { await view.result.current.onSave(INPUT); });
    act(() => { view.result.current.cancelPending(); });
    expect(view.result.current.pending).toBeNull();
    view.rerender({ ...props, auth: { user: { uid: 'u' } } });
    expect(writer).not.toHaveBeenCalled();
  });

  it('a second invention replaces the queued one (only the latest is saved)', async () => {
    const { writer, view, props } = setup({ props: { auth: { user: null } } });
    await act(async () => { await view.result.current.onSave({ ...INPUT, name: 'first' }); });
    await act(async () => { await view.result.current.onSave({ ...INPUT, name: 'second' }); });
    view.rerender({ ...props, auth: { user: { uid: 'u' } } });
    expect(writer).toHaveBeenCalledTimes(1);
    expect(writer.mock.calls[0][0].name).toBe('second');
  });

  it('writer failure resolves error with a plain message', async () => {
    const refuse = vi.fn(() => ({ ok: false, reason: 'You have 200 saved cocktails. Delete one to save another.' }));
    const a = setup({ writer: refuse });
    let res;
    await act(async () => { res = await a.view.result.current.onSave(INPUT); });
    expect(res).toEqual({ status: 'error', message: 'You have 200 saved cocktails. Delete one to save another.' });
    const boom = setup({ writer: vi.fn(() => { throw new Error('disk'); }) });
    await act(async () => { res = await boom.view.result.current.onSave(INPUT); });
    expect(res.status).toBe('error');
    expect(res.message).toMatch(/Nothing was lost/);
  });

  it('without a profile writer there is no onSave (the panel hides its save row)', () => {
    const view = renderHook(() => useSaveInvention({ kind: 'cocktail', userProfile: null, auth: null }));
    expect(view.result.current.onSave).toBeNull();
  });
});
