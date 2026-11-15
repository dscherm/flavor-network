// @vitest-environment jsdom
// SHARE-6: the publish step for a recipe the cook made. The flag is forced ON here; its committed value (off)
// is covered by OwnShare.flagOff.test.jsx.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup, within } from '@testing-library/react';

vi.mock('../../data/shareTargets.js', async (importOriginal) => ({ ...(await importOriginal()), SHARE_OWN_ENABLED: true }));
const publishShare = vi.fn(async () => {});
vi.mock('../../data/shareStore.js', () => ({ publishShare: (...a) => publishShare(...a), getShare: vi.fn(), unshare: vi.fn() }));
vi.mock('../../data/sharedLoaders.js', () => ({ loadLabelNodes: async () => null, defaultLoadData: vi.fn(), defaultLoadNodes: vi.fn() }));
vi.mock('../ShareImages.jsx', () => ({ default: ({ link, bars }) => <div data-testid="stub-images" data-link={link} data-bars={JSON.stringify(bars ?? null)} /> }));

import { OwnShareButton, ShareOwnContext, LIMIT_MESSAGE } from '../OwnShare.jsx';
import { shareFingerprint } from '../../data/sharePublish.js';
import LabNodeCard from '../LabNodeCard.jsx';
import InventNameSave from '../InventNameSave.jsx';
import { RecipeDetail } from '../CookbookLab.jsx';

const ITEM = {
  id: 'inv-1', name: 'Grandma Sour', kind: 'cocktail', category: 'sours',
  lines: [{ key: 'bourbon', amount: '2 oz', role: 'base' }, { key: 'lemon juice', amount: '1 oz', role: null }],
  method: 'Shake with ice. Strain.', glass: 'Rocks', source: 'invent',
};
const USER = { uid: 'u1', displayName: 'Dan Schermele', email: 'dan@example.com', photoURL: 'http://photo' };
const getDb = async () => ({ fake: 'db' });

function setup({ user = USER, shares = [], item = ITEM, addShare = vi.fn() } = {}) {
  const value = (u, s) => ({
    userProfile: { profile: { shares: s }, addShare },
    auth: { user: u, authError: null, loginWithGoogle: vi.fn(), loginWithApple: vi.fn() },
  });
  const ui = (u, s, it) => (
    <ShareOwnContext.Provider value={value(u, s)}>
      <OwnShareButton kind="cocktail" item={it} getDb={getDb} />
    </ShareOwnContext.Provider>
  );
  const utils = render(ui(user, shares, item));
  return { ...utils, addShare, ui };
}
const open = () => fireEvent.click(screen.getByTestId('own-share-button'));

beforeEach(() => { publishShare.mockClear(); });
afterEach(() => { cleanup(); });

describe('publish step (flag on)', () => {
  it('shows exactly what will be public, with no name by default, and writes nothing before the tap', () => {
    setup();
    open();
    expect(screen.getByTestId('own-preview-name').textContent).toBe('Grandma Sour');
    const lines = screen.getAllByTestId('own-preview-line').map((l) => l.textContent);
    expect(lines).toEqual(['2 ozbourbon', '1 ozlemon juice']);
    expect(screen.getByTestId('own-preview-method').textContent).toBe('Shake with ice. Strain.');
    expect(screen.getByTestId('own-by-none').checked).toBe(true);
    expect(screen.getByTestId('own-by-shown').textContent).toBe('No name is shown');
    expect(publishShare).not.toHaveBeenCalled();
  });

  it('Create link publishes once, stores no name, then offers the normal share actions for /r/<id>', async () => {
    const { addShare } = setup();
    open();
    fireEvent.click(screen.getByTestId('own-create'));
    await screen.findByTestId('share-copy');
    expect(publishShare).toHaveBeenCalledTimes(1);
    const [db, doc, id] = publishShare.mock.calls[0];
    expect(db).toEqual({ fake: 'db' });
    expect(id).toMatch(/^[abcdefghjkmnpqrstuvwxyz23456789]{10}$/);
    expect(doc).toMatchObject({ kind: 'cocktail', name: 'Grandma Sour', by: null, owner: 'u1', removed: false });
    const text = JSON.stringify(doc);
    for (const leak of ['dan@example.com', 'Dan Schermele', 'http://photo']) expect(text).not.toContain(leak);
    expect(addShare).toHaveBeenCalledWith(expect.objectContaining({
      id, kind: 'cocktail', sourceId: 'inv-1', name: 'Grandma Sour', fingerprint: shareFingerprint({ ...ITEM, kind: 'cocktail' }),
    }));
    expect(screen.getByTestId('stub-images').getAttribute('data-link')).toBe(`/r/${id}`);
    expect(screen.getByTestId('own-live')).toBeTruthy();
    expect(screen.queryByTestId('own-create')).toBeNull();
  });

  it('first name: shows it, and stores exactly that', async () => {
    setup();
    open();
    expect(screen.getByTestId('share-sheet').textContent).toContain('My first name (Dan)');
    fireEvent.click(screen.getByTestId('own-by-first'));
    expect(screen.getByTestId('own-by-shown').textContent).toBe('Shared by Dan');
    fireEvent.click(screen.getByTestId('own-create'));
    await screen.findByTestId('share-copy');
    expect(publishShare.mock.calls[0][1].by).toBe('Dan');
  });

  it('nickname: needs text, caps at 30, and stores exactly what was shown', async () => {
    setup();
    open();
    fireEvent.click(screen.getByTestId('own-by-nick'));
    expect(screen.getByTestId('own-create').disabled).toBe(true);
    const input = screen.getByTestId('own-nick-input');
    expect(input.getAttribute('maxlength')).toBe('30');
    fireEvent.change(input, { target: { value: '  Chef Zed  ' } });
    expect(screen.getByTestId('own-by-shown').textContent).toBe('Shared by Chef Zed');
    fireEvent.click(screen.getByTestId('own-create'));
    await screen.findByTestId('share-copy');
    expect(publishShare.mock.calls[0][1].by).toBe('Chef Zed');
  });

  it('without a display name the first-name choice is unavailable', () => {
    setup({ user: { uid: 'u1', displayName: null } });
    open();
    expect(screen.getByTestId('own-by-first').disabled).toBe(true);
  });

  it('signed out: asks to sign in first, shows no preview and writes nothing; signing in returns to the publish step', () => {
    const { rerender, ui } = setup({ user: null });
    open();
    expect(screen.getByTestId('own-signin').textContent).toContain('Sign in to share a recipe you made');
    expect(screen.queryByTestId('own-preview')).toBeNull();
    expect(screen.queryByTestId('own-create')).toBeNull();
    expect(publishShare).not.toHaveBeenCalled();
    rerender(ui(USER, [], ITEM));
    expect(screen.getByTestId('own-preview')).toBeTruthy();
    expect(publishShare).not.toHaveBeenCalled();
  });

  it('an unedited item that already has a live link skips the publish step', () => {
    const shares = [{ id: 'abcdefghjk', kind: 'cocktail', sourceId: 'inv-1', fingerprint: shareFingerprint({ ...ITEM, kind: 'cocktail' }), name: 'Grandma Sour', createdAt: 1 }];
    setup({ shares });
    open();
    expect(screen.queryByTestId('own-create')).toBeNull();
    expect(screen.getByTestId('share-copy')).toBeTruthy();
    expect(screen.getByTestId('stub-images').getAttribute('data-link')).toBe('/r/abcdefghjk');
    expect(publishShare).not.toHaveBeenCalled();
  });

  it('an edited item gets the publish step again (a new link)', () => {
    const shares = [{ id: 'abcdefghjk', kind: 'cocktail', sourceId: 'inv-1', fingerprint: shareFingerprint({ ...ITEM, kind: 'cocktail' }), name: 'Grandma Sour', createdAt: 1 }];
    setup({ shares, item: { ...ITEM, method: 'Stir instead.' } });
    open();
    expect(screen.getByTestId('own-create')).toBeTruthy();
    expect(screen.queryByTestId('share-copy')).toBeNull();
  });

  it('the 51st live share is refused with a plain sentence and nothing is written', () => {
    const shares = Array.from({ length: 50 }, (_, i) => ({ id: `abcdefghj${i % 10}`, fingerprint: `f${i}`, name: 'x', kind: 'cocktail', createdAt: 1 }));
    const { addShare } = setup({ shares });
    open();
    fireEvent.click(screen.getByTestId('own-create'));
    expect(screen.getByTestId('own-status').textContent).toBe(LIMIT_MESSAGE);
    expect(LIMIT_MESSAGE).toMatch(/50/);
    expect(publishShare).not.toHaveBeenCalled();
    expect(addShare).not.toHaveBeenCalled();
  });

  it('a failed write says so, adds nothing to the profile and leaves the step open', async () => {
    publishShare.mockRejectedValueOnce(new Error('permission-denied'));
    const { addShare } = setup();
    open();
    fireEvent.click(screen.getByTestId('own-create'));
    await waitFor(() => expect(screen.getByTestId('own-status').textContent).toMatch(/Nothing was shared/));
    expect(addShare).not.toHaveBeenCalled();
    expect(screen.getByTestId('own-create').disabled).toBe(false);
  });

  it('renders as text only: hostile names and ingredients are never parsed as HTML', () => {
    setup({ item: { ...ITEM, name: '<img src=x onerror=alert(1)>', lines: [{ key: '"><script>x</script>', amount: '1' }, { key: 'b', amount: '' }] } });
    open();
    const sheet = screen.getByTestId('share-sheet');
    expect(sheet.querySelector('img')).toBeNull();
    expect(sheet.querySelector('script')).toBeNull();
    expect(within(sheet).getByTestId('own-preview-name').textContent).toBe('<img src=x onerror=alert(1)>');
  });

  it('an item with no name or ingredients says what is missing instead of offering Create', () => {
    setup({ item: { ...ITEM, name: '' } });
    open();
    expect(screen.queryByTestId('own-create')).toBeNull();
    expect(screen.getByTestId('own-status').textContent).toMatch(/name and at least one ingredient/);
  });
});

describe('without the provider', () => {
  it('renders nothing (no Share button)', () => {
    render(<OwnShareButton kind="cocktail" item={ITEM} />);
    expect(screen.queryByTestId('own-share-button')).toBeNull();
  });
});

describe('mounts for items the cook made (flag on)', () => {
  const ctx = {
    userProfile: { profile: { shares: [] }, addShare: vi.fn() },
    auth: { user: USER, loginWithGoogle: vi.fn(), loginWithApple: vi.fn() },
  };
  const wrap = (ui) => <ShareOwnContext.Provider value={ctx}>{ui}</ShareOwnContext.Provider>;

  it('a Yours card in the Cocktail or Sauce Lab shows Share and opens the publish step', () => {
    render(wrap(<LabNodeCard name="Grandma Sour" ownShare={{ kind: 'cocktail', item: ITEM }} actions={[]} onClose={() => {}} />));
    fireEvent.click(screen.getByTestId('card-own-share'));
    expect(screen.getByTestId('own-preview-name').textContent).toBe('Grandma Sour');
  });
  it('a built-in card still gets the plain Share button, not the publish step', () => {
    render(wrap(<LabNodeCard name="Negroni" share={{ link: '/r/cocktail/negroni', recipe: { kind: 'cocktail', name: 'Negroni' } }} actions={[]} onClose={() => {}} />));
    expect(screen.getByTestId('card-share')).toBeTruthy();
    expect(screen.queryByTestId('card-own-share')).toBeNull();
  });
  it('the name-and-save step of the invent panels offers Share only once saved', () => {
    const { rerender } = render(wrap(<InventNameSave name="Grandma Sour" onName={() => {}} canSave status="idle" shareItem={{ kind: 'cocktail', item: ITEM }} onSave={() => {}} />));
    expect(screen.queryByTestId('namesave-share')).toBeNull();
    rerender(wrap(<InventNameSave name="Grandma Sour" onName={() => {}} canSave status="saved" shareItem={{ kind: 'cocktail', item: ITEM }} onSave={() => {}} />));
    expect(screen.getByTestId('namesave-share')).toBeTruthy();
    rerender(wrap(<InventNameSave name="Grandma Sour" onName={() => {}} canSave status="saved" shareItem={null} onSave={() => {}} />));
    expect(screen.queryByTestId('namesave-share')).toBeNull();
  });
  it('a saved Cookbook recipe shows Share; a built-in dish does not get the publish button', () => {
    const user = { id: 'user-soup', name: 'Soup', cuisine: 'Personal', cluster: 'personal', ingredients: ['carrot', 'onion'], _userSaved: true };
    const raw = { name: 'Soup', ingredients: [{ name: 'carrot', quantity: 2, unit: null, raw: '2 carrot' }, { name: 'onion', quantity: null, unit: null, raw: 'onion' }], instructions: 'Simmer.' };
    const { unmount } = render(wrap(<RecipeDetail recipe={user} userRecipe={raw} ctx={null} onClose={() => {}} />));
    expect(screen.getByTestId('recipe-own-share-button')).toBeTruthy();
    unmount();
    render(wrap(<RecipeDetail recipe={user} userRecipe={null} ctx={null} onClose={() => {}} />));
    expect(screen.queryByTestId('recipe-own-share-button')).toBeNull();
  });
});
