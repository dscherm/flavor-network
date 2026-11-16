// @vitest-environment jsdom
// SHARE-3: Save, Make it your own and the signed-out invitation on the public shared page.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent, within } from '@testing-library/react';
import { readFileSync } from 'node:fs';

const h = vi.hoisted(() => ({
  auth: { user: null, loading: false, authError: null },
  profile: {},
  writer: null,
  loginGoogle: null,
  loginApple: null,
}));
vi.mock('../../hooks/useAuth.js', () => ({
  default: () => ({ ...h.auth, loginWithGoogle: h.loginGoogle, loginWithApple: h.loginApple }),
}));
vi.mock('../../hooks/useUserProfile.js', () => ({
  default: () => ({ profile: h.profile, saveInvention: h.writer }),
}));

import SharedRecipePage from '../SharedRecipePage.jsx';
import { saveInvention } from '../../data/savedInventions.js';
import { SEED_RECIPES } from '../../data/seedRecipes.js';
import { RECIPE_DETAILS } from '../../data/seedRecipeDetails.js';
import { PENDING_KEY, SEED_KEY } from '../../data/sharedHandoff.js';
import { readCuratedCodex } from '../../../scripts/lib/curatedCodex.mjs';

const codex = readCuratedCodex();
const sauceRaw = JSON.parse(readFileSync('public/data/sauce_augment.json', 'utf8'));
const loadData = async (kind) => {
  if (kind === 'cocktail') return { cocktails: codex.cocktails, families: codex.families };
  if (kind === 'sauce') return { sauces: sauceRaw.sauces };
  return { dishes: SEED_RECIPES, dishDetails: RECIPE_DETAILS };
};
const loadNodes = async () => new Map();
const NEGRONI = { kind: 'cocktail', slug: 'negroni' };

const show = (route = NEGRONI, props = {}) => render(<SharedRecipePage route={route} loadData={loadData} loadNodes={loadNodes} {...props} />);
const saveBtn = () => screen.findByTestId('shared-save');
const pending = () => sessionStorage.getItem(PENDING_KEY);

beforeEach(() => {
  sessionStorage.clear();
  localStorage.clear();
  h.auth = { user: null, loading: false, authError: null };
  h.profile = {};
  h.writer = vi.fn((input) => {
    const res = saveInvention(h.profile, input);
    if (res.ok) h.profile = res.profile;
    return res;
  });
  h.loginGoogle = vi.fn(async () => true);
  h.loginApple = vi.fn(async () => true);
});

const signIn = () => { h.auth = { user: { uid: 'u1' }, loading: false, authError: null }; };

describe('Save, signed in', () => {
  it.each([
    [{ kind: 'cocktail', slug: 'daiquiri' }, 'Save to my cocktails', 'cocktails'],
    [{ kind: 'sauce', slug: 'alfredo' }, 'Save to my sauces', 'sauces'],
    [{ kind: 'dish', slug: 'beef-bolognese' }, 'Save to my cookbook', 'recipes'],
  ])('%j saves one copy into profile.%s with sharedFrom', async (route, label, field) => {
    signIn();
    show(route);
    const btn = await saveBtn();
    expect(btn.textContent).toBe(label);
    fireEvent.click(btn);
    await waitFor(() => expect(screen.getByTestId('shared-save').textContent).toBe('Saved'));
    expect(h.writer).toHaveBeenCalledTimes(1);
    expect(h.profile[field]).toHaveLength(1);
    expect(h.profile[field][0].sharedFrom).toBe(`${route.kind}/${route.slug}`);
    expect(screen.getByTestId('shared-save-note').textContent).toMatch(/Saved to your/);
  });

  it('saving the same recipe again does not write or duplicate', async () => {
    signIn();
    const { rerender } = show();
    fireEvent.click(await saveBtn());
    await waitFor(() => expect(screen.getByTestId('shared-save').textContent).toBe('Saved'));
    rerender(<SharedRecipePage route={NEGRONI} loadData={loadData} loadNodes={loadNodes} />);
    fireEvent.click(screen.getByTestId('shared-save'));
    await waitFor(() => expect(screen.getByTestId('shared-save-note').textContent).toBe('Already in your cocktails'));
    expect(h.writer).toHaveBeenCalledTimes(1);
    expect(h.profile.cocktails).toHaveLength(1);
  });

  it('shows "Already in your cocktails" when the profile already holds a copy', async () => {
    signIn();
    h.profile = { cocktails: [{ id: 'x', sharedFrom: 'cocktail/negroni' }] };
    show();
    expect((await saveBtn()).textContent).toBe('Already in your cocktails');
    fireEvent.click(screen.getByTestId('shared-save'));
    expect(h.writer).not.toHaveBeenCalled();
  });

  it('a failed write says so and keeps the Save button', async () => {
    signIn();
    h.writer = vi.fn(() => ({ ok: false, reason: 'You have 200 saved cocktails. Delete one to save another.' }));
    show();
    fireEvent.click(await saveBtn());
    await waitFor(() => expect(screen.getByTestId('shared-save-note').dataset.status).toBe('error'));
    expect(screen.getByTestId('shared-save').textContent).toBe('Save to my cocktails');
  });
});

describe('Save, signed out: popup sign-in', () => {
  it('opens the prompt with the reason, then saves by itself when the account arrives', async () => {
    const { rerender } = show();
    fireEvent.click(await saveBtn());
    const dialog = await screen.findByTestId('invent-save-signin');
    expect(dialog.textContent).toMatch(/Create a free account to keep this recipe/);
    expect(within(dialog).getByTestId('invent-save-signin-google')).toBeTruthy();
    expect(within(dialog).getByTestId('invent-save-signin-apple')).toBeTruthy();
    expect(h.writer).not.toHaveBeenCalled();
    expect(pending()).toBeNull();

    fireEvent.click(within(dialog).getByTestId('invent-save-signin-google'));
    expect(h.loginGoogle).toHaveBeenCalledTimes(1);
    expect(JSON.parse(pending())).toMatchObject({ kind: 'cocktail', slug: 'negroni' });

    signIn();
    rerender(<SharedRecipePage route={NEGRONI} loadData={loadData} loadNodes={loadNodes} />);
    await waitFor(() => expect(h.writer).toHaveBeenCalledTimes(1));
    expect(h.profile.cocktails[0].sharedFrom).toBe('cocktail/negroni');
    await waitFor(() => expect(pending()).toBeNull());
    await waitFor(() => expect(screen.getByTestId('invent-save-toast').textContent).toMatch(/Saved to your cocktails/));
    expect(screen.queryByTestId('invent-save-signin')).toBeNull();
    expect(screen.getByTestId('shared-save').textContent).toBe('Saved');
  });

  it('Apple sign-in sets the marker the same way', async () => {
    show();
    fireEvent.click(await saveBtn());
    fireEvent.click(await screen.findByTestId('invent-save-signin-apple'));
    expect(h.loginApple).toHaveBeenCalledTimes(1);
    expect(pending()).not.toBeNull();
  });

  it('a cancelled sign-in clears the marker and saves nothing', async () => {
    h.loginGoogle = vi.fn(async () => false);
    show();
    fireEvent.click(await saveBtn());
    fireEvent.click(await screen.findByTestId('invent-save-signin-google'));
    await waitFor(() => expect(pending()).toBeNull());
    expect(h.writer).not.toHaveBeenCalled();
  });

  it('"Not now" closes the prompt and drops the queued save', async () => {
    const { rerender } = show();
    fireEvent.click(await saveBtn());
    fireEvent.click(await screen.findByTestId('invent-save-signin-google'));
    fireEvent.click(screen.getByTestId('invent-save-signin-cancel'));
    expect(screen.queryByTestId('invent-save-signin')).toBeNull();
    expect(pending()).toBeNull();
    signIn();
    rerender(<SharedRecipePage route={NEGRONI} loadData={loadData} loadNodes={loadNodes} />);
    await new Promise((r) => setTimeout(r, 30));
    expect(h.writer).not.toHaveBeenCalled();
  });

  it('a sign-in error clears the marker, shows the error, and saves nothing', async () => {
    const { rerender } = show();
    fireEvent.click(await saveBtn());
    fireEvent.click(await screen.findByTestId('invent-save-signin-google'));
    expect(pending()).not.toBeNull();
    h.auth = { user: null, loading: false, authError: 'Sign-in was blocked by the browser.' };
    rerender(<SharedRecipePage route={NEGRONI} loadData={loadData} loadNodes={loadNodes} />);
    await waitFor(() => expect(pending()).toBeNull());
    expect(screen.getByTestId('invent-save-signin-error').textContent).toMatch(/blocked/);
    expect(h.writer).not.toHaveBeenCalled();
  });
});

describe('Save, signed out: redirect sign-in returns', () => {
  const mark = (route = NEGRONI) => sessionStorage.setItem(PENDING_KEY, JSON.stringify({ ...route, at: Date.now() }));

  it('mounts with a marker and a signed-in user: saves once, no tap, clears the marker', async () => {
    mark();
    signIn();
    show();
    await waitFor(() => expect(h.writer).toHaveBeenCalledTimes(1));
    expect(h.profile.cocktails[0].sharedFrom).toBe('cocktail/negroni');
    expect(pending()).toBeNull();
    await waitFor(() => expect(screen.getByTestId('shared-save').textContent).toBe('Saved'));
    expect(screen.queryByTestId('invent-save-signin')).toBeNull();
  });

  it('waits for auth to settle before deciding', async () => {
    mark();
    h.auth = { user: null, loading: true, authError: null };
    const { rerender } = show();
    await saveBtn();
    expect(h.writer).not.toHaveBeenCalled();
    expect(pending()).not.toBeNull();
    h.auth = { user: { uid: 'u1' }, loading: false, authError: null };
    rerender(<SharedRecipePage route={NEGRONI} loadData={loadData} loadNodes={loadNodes} />);
    await waitFor(() => expect(h.writer).toHaveBeenCalledTimes(1));
    expect(pending()).toBeNull();
  });

  it('returning without an account clears the marker and saves nothing', async () => {
    mark();
    show();
    await saveBtn();
    await waitFor(() => expect(pending()).toBeNull());
    expect(h.writer).not.toHaveBeenCalled();
  });

  it('a marker for a different recipe is not completed here', async () => {
    mark({ kind: 'sauce', slug: 'alfredo' });
    signIn();
    show();
    await saveBtn();
    await new Promise((r) => setTimeout(r, 30));
    expect(h.writer).not.toHaveBeenCalled();
  });

  it('does not save again when the copy is already in the profile', async () => {
    mark();
    signIn();
    h.profile = { cocktails: [{ id: 'shared-cocktail-negroni', sharedFrom: 'cocktail/negroni' }] };
    show();
    await waitFor(() => expect(screen.getByTestId('shared-save-note').textContent).toBe('Already in your cocktails'));
    expect(h.writer).not.toHaveBeenCalled();
    expect(pending()).toBeNull();
  });
});

describe('the signed-out invitation', () => {
  it('shows once, signed out, with a button that opens the same prompt without a pending save', async () => {
    show();
    await saveBtn();
    const invites = screen.getAllByTestId('shared-invite');
    expect(invites).toHaveLength(1);
    expect(invites[0].textContent).toMatch(/Neural Flavor helps you build drinks, sauces and dishes from what pairs well/);
    fireEvent.click(screen.getByTestId('shared-invite-button'));
    const dialog = await screen.findByTestId('invent-save-signin');
    expect(dialog.textContent).toMatch(/Create a free account/);
    fireEvent.click(within(dialog).getByTestId('invent-save-signin-google'));
    expect(h.loginGoogle).toHaveBeenCalledTimes(1);
    expect(pending()).toBeNull();
    expect(h.writer).not.toHaveBeenCalled();
  });

  it('is absent when signed in and while auth is still resolving', async () => {
    signIn();
    const { unmount } = show();
    await saveBtn();
    expect(screen.queryByTestId('shared-invite')).toBeNull();
    unmount();
    h.auth = { user: null, loading: true, authError: null };
    show();
    await saveBtn();
    expect(screen.queryByTestId('shared-invite')).toBeNull();
  });

  it('is not a blocking dialog: the recipe is fully readable beside it', async () => {
    show();
    await saveBtn();
    expect(screen.queryByTestId('invent-save-signin')).toBeNull();
    expect(screen.getAllByTestId('shared-line').length).toBeGreaterThan(1);
  });
});

describe('Make it your own', () => {
  it.each([
    [{ kind: 'cocktail', slug: 'negroni' }, '/?path=cocktail', 'cocktail'],
    [{ kind: 'sauce', slug: 'hollandaise' }, '/?path=sauce', 'sauce'],
    [{ kind: 'dish', slug: 'beef-bolognese' }, '/?path=make', 'make'],
  ])('%j stashes the seed and goes to its lab, no sign-in needed', async (route, url, lab) => {
    const navigate = vi.fn();
    show(route, { navigate });
    fireEvent.click(await screen.findByTestId('shared-own'));
    await waitFor(() => expect(navigate).toHaveBeenCalledWith(url));
    const stash = JSON.parse(sessionStorage.getItem(SEED_KEY));
    expect(stash.lab).toBe(lab);
    expect(stash.seed.pinned.length + (stash.seed.main ? 1 : 0)).toBeGreaterThanOrEqual(3);
    expect(h.writer).not.toHaveBeenCalled();
  });

  it('puts Save first, Make it your own second, Share third', async () => {
    show();
    await saveBtn();
    const slot = screen.getByTestId('shared-actions');
    const ids = [...slot.querySelectorAll('button')].map((b) => b.dataset.testid).filter(Boolean);
    expect(ids.slice(0, 3)).toEqual(['shared-save', 'shared-own', 'share-button']);
  });
});
