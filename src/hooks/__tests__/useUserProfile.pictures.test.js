// @vitest-environment jsdom
// PICTURE-3: saved items and their pictures through the profile hook and the save hook.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';

const writes = [];
let failPicture = false;
let cloud = null; // profiles/{uid} snapshot data, or null
const key = (ref) => ref.path.join('/');
vi.mock('firebase/firestore', () => ({
  doc: (db, ...path) => ({ path }),
  getDoc: async (ref) => ({ exists: () => ref.path.length === 2 && cloud != null, data: () => cloud }),
  setDoc: async (ref, data) => {
    if (failPicture && ref.path[2] === 'pictures') throw new Error('offline');
    writes.push(['set', key(ref), data]);
  },
  deleteDoc: async (ref) => { writes.push(['delete', key(ref)]); },
}));
vi.mock('../../firebase.js', () => ({ db: {}, auth: {} }));
vi.mock('../../data/usageEvents.js', () => ({ usage: { inventSaved: vi.fn() }, labForKind: (k) => k }));

const useUserProfile = (await import('../useUserProfile.js')).default;
const useSaveInvention = (await import('../useSaveInvention.js')).default;

const KEY = 'flavor-user-profile-v2';
const USER = { uid: 'u1' };
const blob = (n = 300) => new Blob([new Uint8Array(n).fill(66)], { type: 'image/jpeg' });
const chalk = (n = 300) => ({ kind: 'chalk', blob: blob(n), mime: 'image/jpeg', w: 600, h: 450 });
const lines = [{ key: 'bourbon', amount: '2 oz' }, { key: 'lemon juice', amount: '1 oz' }];
const input = (over = {}) => ({ kind: 'cocktail', name: 'Grandma Sour', lines, ...over });
const picDocs = () => writes.filter((w) => w[1].includes('/pictures/'));
const profileWrites = () => writes.filter((w) => w[1] === 'profiles/u1');

async function signedIn() {
  const hook = renderHook(() => useUserProfile(USER));
  await waitFor(() => expect(profileWrites().length >= 0).toBe(true));
  await act(async () => { await Promise.resolve(); });
  return hook;
}

beforeEach(() => { localStorage.clear(); writes.length = 0; failPicture = false; cloud = null; });

describe('saving an item with a picture', () => {
  it('a chalk picture writes two documents; the profile document carries only a small field', async () => {
    const { result } = await signedIn();
    const without = JSON.stringify({ ...result.current.profile });
    let res;
    await act(async () => { res = await result.current.saveInventionWithPicture(input({ picture: chalk(100000) })); });
    expect(res.ok).toBe(true);
    expect(res.pictureReason).toBeUndefined();
    const item = result.current.profile.cocktails[0];
    expect(item.picture).toMatchObject({ kind: 'chalk' });
    expect(typeof item.picture.v).toBe('number');
    // the picture document
    expect(picDocs()).toHaveLength(1);
    expect(picDocs()[0][1]).toBe(`profiles/u1/pictures/${item.id}`);
    expect(Object.keys(picDocs()[0][2]).sort()).toEqual(['data', 'h', 'mime', 'updatedAt', 'w']);
    const imageData = picDocs()[0][2].data;
    // the profile document: saved locally and (when synced) written to the cloud, never with the image
    const local = localStorage.getItem(KEY);
    expect(local).not.toContain(imageData);
    expect(imageData.length).toBeGreaterThan(100000);
    expect(local.length - without.length).toBeLessThan(600);
    expect(JSON.stringify(profileWrites())).not.toContain(imageData);
  });
  it('an icon writes no picture document at all', async () => {
    const { result } = await signedIn();
    await act(async () => { await result.current.saveInventionWithPicture(input({ picture: { kind: 'icon', icon: 'glass:flute' } })); });
    expect(result.current.profile.cocktails[0].picture).toMatchObject({ kind: 'icon', icon: 'glass:flute' });
    expect(picDocs()).toEqual([]);
  });
  it('works for sauces and recipes too (recipes keep the field through the normaliser)', async () => {
    const { result, unmount } = await signedIn();
    await act(async () => { await result.current.saveInventionWithPicture(input({ kind: 'recipe', name: 'Soup', picture: chalk() })); });
    expect(result.current.profile.recipes[0].picture).toMatchObject({ kind: 'chalk' });
    await act(async () => { await result.current.saveInventionWithPicture(input({ kind: 'sauce', name: 'Sauce', picture: { kind: 'icon', icon: 'sauce:jar' } })); });
    expect(result.current.profile.sauces[0].picture).toMatchObject({ kind: 'icon' });
    unmount();
    const again = renderHook(() => useUserProfile());
    expect(again.result.current.profile.recipes[0].picture).toMatchObject({ kind: 'chalk' });
  });
  it('a failed picture write still saves the item, without the picture, and returns one plain line', async () => {
    failPicture = true;
    const { result } = await signedIn();
    let res;
    await act(async () => { res = await result.current.saveInventionWithPicture(input({ picture: chalk() })); });
    expect(res.ok).toBe(true);
    expect(res.pictureReason).toMatch(/picture could not be saved/);
    expect(res.pictureReason).not.toMatch(/\n/);
    expect(result.current.profile.cocktails).toHaveLength(1);
    expect(result.current.profile.cocktails[0].picture).toBeUndefined();
  });
  it('switching chalk -> icon and chalk -> none deletes the picture document', async () => {
    const { result } = await signedIn();
    await act(async () => { await result.current.saveInventionWithPicture(input({ picture: chalk() })); });
    const id = result.current.profile.cocktails[0].id;
    writes.length = 0;
    await act(async () => { await result.current.saveInventionWithPicture(input({ id, picture: { kind: 'icon', icon: 'glass:coupe' } })); });
    expect(writes.filter((w) => w[0] === 'delete')).toEqual([['delete', `profiles/u1/pictures/${id}`]]);
    expect(result.current.profile.cocktails[0].picture).toMatchObject({ kind: 'icon' });

    await act(async () => { await result.current.saveInventionWithPicture(input({ id, picture: chalk() })); });
    writes.length = 0;
    await act(async () => { await result.current.saveInventionWithPicture(input({ id, picture: null })); });
    expect(writes.filter((w) => w[0] === 'delete')).toEqual([['delete', `profiles/u1/pictures/${id}`]]);
    expect(result.current.profile.cocktails[0].picture).toBeUndefined();
  });
  it('an edit that does not mention the picture keeps it and touches no picture document', async () => {
    const { result } = await signedIn();
    await act(async () => { await result.current.saveInventionWithPicture(input({ picture: chalk() })); });
    const item = result.current.profile.cocktails[0];
    writes.length = 0;
    await act(async () => { await result.current.saveInventionWithPicture(input({ id: item.id, name: 'Renamed' })); });
    expect(result.current.profile.cocktails[0]).toMatchObject({ name: 'Renamed', picture: item.picture });
    expect(picDocs()).toEqual([]);
    expect(writes.filter((w) => w[0] === 'delete')).toEqual([]);
  });
  it('without a picture the plain saveInvention behaves as before', async () => {
    const { result } = await signedIn();
    act(() => { result.current.saveInvention(input()); });
    expect(result.current.profile.cocktails[0].picture).toBeUndefined();
    expect(picDocs()).toEqual([]);
  });
});

describe('deleting an item', () => {
  it('deletes the item and its chalk picture document; an icon item deletes no document', async () => {
    const { result } = await signedIn();
    await act(async () => { await result.current.saveInventionWithPicture(input({ picture: chalk() })); });
    const id = result.current.profile.cocktails[0].id;
    writes.length = 0;
    act(() => { result.current.deleteInvention('cocktail', id); });
    expect(result.current.profile.cocktails).toEqual([]);
    expect(writes.filter((w) => w[0] === 'delete')).toEqual([['delete', `profiles/u1/pictures/${id}`]]);

    await act(async () => { await result.current.saveInventionWithPicture(input({ name: 'Other', picture: { kind: 'icon', icon: 'glass:coupe' } })); });
    const id2 = result.current.profile.cocktails[0].id;
    writes.length = 0;
    act(() => { result.current.deleteInvention('cocktail', id2); });
    expect(writes.filter((w) => w[0] === 'delete')).toEqual([]);
  });
});

describe('the local <-> cloud merge keeps the picture field', () => {
  it('items from the cloud and from this device both keep picture through the merge', async () => {
    const chalkField = { kind: 'chalk', v: 11 };
    const iconField = { kind: 'icon', icon: 'sauce:pan', v: 12 };
    cloud = {
      cuisines: [], ingredients: [], pairings: [],
      recipes: [{ name: 'Cloud Soup', id: 'inv-c1', source: 'invent', ingredients: [], picture: chalkField }],
      cocktails: [{ id: 'inv-c2', kind: 'cocktail', name: 'Cloud Sour', lines, source: 'invent', picture: chalkField }],
      sauces: [],
    };
    localStorage.setItem(KEY, JSON.stringify({
      recipes: [{ name: 'Local Stew', id: 'inv-l1', source: 'invent', ingredients: [], picture: iconField }],
      cocktails: [{ id: 'inv-l2', kind: 'cocktail', name: 'Local Sour', lines, source: 'invent', picture: iconField }],
      sauces: [{ id: 'inv-l3', kind: 'sauce', name: 'Local Sauce', lines, source: 'invent', picture: iconField }],
    }));
    const { result } = renderHook(() => useUserProfile(USER));
    await waitFor(() => expect(result.current.profile.recipes.length).toBe(2));
    const byName = (list, n) => list.find((x) => x.name === n);
    const p = result.current.profile;
    expect(byName(p.recipes, 'Cloud Soup').picture).toEqual(chalkField);
    expect(byName(p.recipes, 'Local Stew').picture).toEqual(iconField);
    expect(byName(p.cocktails, 'Cloud Sour').picture).toEqual(chalkField);
    expect(byName(p.cocktails, 'Local Sour').picture).toEqual(iconField);
    expect(byName(p.sauces, 'Local Sauce').picture).toEqual(iconField);
    const stored = JSON.parse(localStorage.getItem(KEY));
    expect(byName(stored.recipes, 'Cloud Soup').picture).toEqual(chalkField);
    expect(byName(stored.cocktails, 'Cloud Sour').picture).toEqual(chalkField);
  });
});

describe('useSaveInvention', () => {
  const asHook = (profile) => renderHook(() => useSaveInvention({ kind: 'cocktail', userProfile: profile, auth: { user: USER } }));
  it('an input with a picture goes through saveInventionWithPicture and surfaces pictureReason', async () => {
    const withPic = vi.fn(async () => ({ ok: true, pictureReason: 'The picture could not be saved, so it was left out.' }));
    const plain = vi.fn(() => ({ ok: true }));
    const { result } = asHook({ saveInvention: plain, saveInventionWithPicture: withPic });
    let r;
    await act(async () => { r = await result.current.onSave({ name: 'x', lines, picture: null }); });
    expect(withPic).toHaveBeenCalledTimes(1);
    expect(plain).not.toHaveBeenCalled();
    expect(r).toMatchObject({ status: 'saved', pictureReason: expect.stringMatching(/picture/) });
  });
  it('an input without a picture takes the unchanged synchronous path', async () => {
    const withPic = vi.fn();
    const plain = vi.fn(() => ({ ok: true }));
    const { result } = asHook({ saveInvention: plain, saveInventionWithPicture: withPic });
    let r;
    await act(async () => { r = await result.current.onSave({ name: 'x', lines }); });
    expect(plain).toHaveBeenCalledTimes(1);
    expect(withPic).not.toHaveBeenCalled();
    expect(r.status).toBe('saved');
    expect(r.pictureReason).toBeUndefined();
  });
});

describe('saving the same build twice with a picture', () => {
  it('the second save updates the first instead of adding a copy (cocktail and recipe)', async () => {
    const { result } = await signedIn();
    for (const kind of ['cocktail', 'recipe']) {
      const field = kind === 'cocktail' ? 'cocktails' : 'recipes';
      await act(async () => { await result.current.saveInventionWithPicture(input({ kind, name: 'Twice', picture: { kind: 'icon', icon: 'glass:coupe' } })); });
      const id = result.current.profile[field].find((x) => x.name === 'Twice').id;
      await act(async () => { await result.current.saveInventionWithPicture(input({ kind, name: 'twice', picture: { kind: 'icon', icon: 'glass:coupe' } })); });
      const same = result.current.profile[field].filter((x) => x.name.toLowerCase() === 'twice');
      expect(same).toHaveLength(1);
      expect(same[0].id).toBe(id);
    }
  });
  it('a different name is a different item', async () => {
    const { result } = await signedIn();
    await act(async () => { await result.current.saveInventionWithPicture(input({ name: 'One', picture: { kind: 'icon', icon: 'glass:coupe' } })); });
    await act(async () => { await result.current.saveInventionWithPicture(input({ name: 'Two', picture: { kind: 'icon', icon: 'glass:coupe' } })); });
    expect(result.current.profile.cocktails).toHaveLength(2);
  });
});
