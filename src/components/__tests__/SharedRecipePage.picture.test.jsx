// @vitest-environment jsdom
// PICTURE-4: the picture on the public page of a user's copy, and the Report reason about it.
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { render, screen, waitFor, cleanup, fireEvent } from '@testing-library/react';

vi.mock('../../hooks/useAuth.js', () => ({ default: () => ({ user: null, loading: false, authError: null, loginWithGoogle: vi.fn(), loginWithApple: vi.fn() }) }));
vi.mock('../../hooks/useUserProfile.js', () => ({ default: () => ({ profile: {}, saveInvention: vi.fn() }) }));
vi.mock('../../firebase.js', () => ({ db: { fake: 'db' }, auth: {} }));
const loadSharedPicture = vi.fn();
vi.mock('../../data/pictureStore.js', async (orig) => ({ ...(await orig()), loadSharedPicture: (...a) => loadSharedPicture(...a) }));

import SharedRecipePage from '../SharedRecipePage.jsx';
import { clearPictureCache } from '../PictureView.jsx';

const ID = 'abcdefghjk';
const DOC = {
  kind: 'cocktail', name: 'Grandma Sour', owner: 'u1', createdAt: 1, removed: false, by: null,
  lines: [{ key: 'bourbon', amount: '2 oz' }, { key: 'lemon juice', amount: '1 oz' }], method: 'Shake.', glass: 'Rocks', bars: [],
};
const loadNodes = async () => new Map();
const page = (doc) => render(<SharedRecipePage route={{ id: ID }} loadShared={vi.fn(async () => doc)} loadNodes={loadNodes} loadData={vi.fn(async () => ({}))} />);

beforeEach(() => { clearPictureCache(); loadSharedPicture.mockReset(); });
afterEach(() => { cleanup(); });

describe('shared page: the picture', () => {
  it('a copy with no picture shows none, and reads no picture', async () => {
    page(DOC);
    await screen.findByTestId('shared-name');
    expect(screen.queryByTestId('shared-picture')).toBeNull();
    expect(loadSharedPicture).not.toHaveBeenCalled();
  });

  it('a drawing is drawn straight away with no read', async () => {
    page({ ...DOC, picture: { kind: 'icon', icon: 'glass:martini' } });
    const box = await screen.findByTestId('shared-picture');
    expect(box.querySelector('[data-picture="glass:martini"]')).toBeTruthy();
    expect(loadSharedPicture).not.toHaveBeenCalled();
  });

  it('a chalk picture is read from the share\'s own picture document and shown', async () => {
    loadSharedPicture.mockResolvedValue({ dataUrl: 'data:image/jpeg;base64,AAAA', w: 600, h: 600 });
    page({ ...DOC, picture: { kind: 'chalk' } });
    await waitFor(() => expect(screen.getByTestId('shared-picture-view').getAttribute('data-picture-kind')).toBe('chalk'));
    expect(screen.getByTestId('shared-picture-view').querySelector('img').getAttribute('src')).toBe('data:image/jpeg;base64,AAAA');
    expect(loadSharedPicture).toHaveBeenCalledWith({ fake: 'db' }, ID);
  });

  it('a chalk picture that is gone (removed, unreadable) leaves the page whole, with the recipe and no broken image', async () => {
    loadSharedPicture.mockResolvedValue(null);
    page({ ...DOC, picture: { kind: 'chalk' } });
    await waitFor(() => expect(screen.queryByTestId('shared-picture-view')).toBeNull());
    expect(screen.getByTestId('shared-name').textContent).toBe('Grandma Sour');
    expect(document.querySelector('img')).toBeNull();
  });

  it('a malformed picture field is ignored', async () => {
    page({ ...DOC, picture: { kind: 'icon', icon: '<script>' } });
    await screen.findByTestId('shared-name');
    expect(screen.queryByTestId('shared-picture')).toBeNull();
  });

  it('the Report sheet offers "The picture" as a reason', async () => {
    page({ ...DOC, picture: { kind: 'icon', icon: 'glass:coupe' } });
    fireEvent.click(await screen.findByTestId('report-open'));
    const options = [...screen.getByTestId('report-reason').querySelectorAll('option')].map((o) => [o.value, o.textContent]);
    expect(options).toContainEqual(['picture', 'The picture']);
  });
});
