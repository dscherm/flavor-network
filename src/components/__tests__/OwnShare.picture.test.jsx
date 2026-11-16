// @vitest-environment jsdom
// PICTURE-4: the picture in the share sheet's publish step. Nothing about the picture is public before "Create link";
// the preview shows what will be; a picture that cannot be stored is one plain line and the link is still made.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';

vi.mock('../../data/shareTargets.js', async (importOriginal) => ({ ...(await importOriginal()), SHARE_OWN_ENABLED: true }));
const publishShare = vi.fn(async () => {});
const publishShareWithPicture = vi.fn(async (_db, _doc, id) => ({ id, picture: 'chalk' }));
vi.mock('../../data/shareStore.js', () => ({
  publishShare: (...a) => publishShare(...a),
  publishShareWithPicture: (...a) => publishShareWithPicture(...a),
  getShare: vi.fn(), unshare: vi.fn(),
}));
vi.mock('../../data/sharedLoaders.js', () => ({ loadLabelNodes: async () => null, defaultLoadData: vi.fn(), defaultLoadNodes: vi.fn() }));
vi.mock('../ShareImages.jsx', () => ({
  default: ({ link, picture }) => <div data-testid="stub-images" data-link={link} data-picture={picture ? picture.kind : ''} />,
}));

import { OwnShareButton } from '../OwnShare.jsx';
import { ShareOwnContext } from '../shareOwnContext.js';
import { clearPictureCache } from '../PictureView.jsx';

const BASE = {
  id: 'inv-1', name: 'Grandma Sour', kind: 'cocktail', category: 'sours',
  lines: [{ key: 'bourbon', amount: '2 oz', role: 'base' }, { key: 'lemon juice', amount: '1 oz', role: null }],
  method: 'Shake with ice. Strain.', glass: 'Rocks', source: 'invent',
};
const USER = { uid: 'u1', displayName: 'Dan Schermele' };
const getDb = async () => ({ fake: 'db' });
const chalkValue = () => ({ kind: 'chalk', blob: new Blob(['x'], { type: 'image/jpeg' }), mime: 'image/jpeg', w: 600, h: 600 });

function setup({ item = BASE, addShare = vi.fn(), shares = [] } = {}) {
  const value = { userProfile: { profile: { shares }, addShare }, auth: { user: USER, authError: null, loginWithGoogle: vi.fn(), loginWithApple: vi.fn() } };
  render(
    <ShareOwnContext.Provider value={value}>
      <OwnShareButton kind="cocktail" item={item} getDb={getDb} />
    </ShareOwnContext.Provider>,
  );
  fireEvent.click(screen.getByTestId('own-share-button'));
  return { addShare };
}

beforeEach(() => {
  publishShare.mockClear(); publishShareWithPicture.mockClear(); clearPictureCache();
  URL.createObjectURL = vi.fn(() => 'blob:preview'); URL.revokeObjectURL = vi.fn();
});
afterEach(() => { cleanup(); });

describe('publish step: the picture', () => {
  it('an item with no picture: no picture in the preview, the plain publish, and "Add a picture" is only a closed row', async () => {
    setup();
    expect(screen.queryByTestId('own-preview-picture')).toBeNull();
    expect(screen.getByTestId('own-picture-field-open').textContent).toBe('Add a picture (optional)');
    fireEvent.click(screen.getByTestId('own-create'));
    await screen.findByTestId('share-copy');
    expect(publishShare).toHaveBeenCalledTimes(1);
    expect(publishShareWithPicture).not.toHaveBeenCalled();
    expect('picture' in publishShare.mock.calls[0][1]).toBe(false);
  });

  it('the item\'s drawing shows in the preview, and goes out only when Create link is tapped', async () => {
    setup({ item: { ...BASE, picture: { kind: 'icon', icon: 'glass:coupe', v: 1 } } });
    expect(screen.getByTestId('own-preview-picture').querySelector('[data-picture="glass:coupe"]')).toBeTruthy();
    expect(publishShare).not.toHaveBeenCalled();
    expect(publishShareWithPicture).not.toHaveBeenCalled();
    fireEvent.click(screen.getByTestId('own-create'));
    await screen.findByTestId('share-copy');
    expect(publishShare.mock.calls[0][1].picture).toEqual({ kind: 'icon', icon: 'glass:coupe' });
  });

  it('a picture chosen here is for this link: the preview changes at once, nothing is written until Create link', async () => {
    setup();
    fireEvent.click(screen.getByTestId('own-picture-field-open'));
    fireEvent.click(screen.getByRole('radio', { name: 'A drawing' }));
    fireEvent.click(screen.getByRole('radio', { name: 'Highball' }));
    expect(screen.getByTestId('own-preview-picture').querySelector('[data-picture="glass:highball"]')).toBeTruthy();
    expect(publishShare).not.toHaveBeenCalled();
    expect(publishShareWithPicture).not.toHaveBeenCalled();
    fireEvent.click(screen.getByTestId('own-create'));
    await screen.findByTestId('share-copy');
    expect(publishShare.mock.calls[0][1].picture).toEqual({ kind: 'icon', icon: 'glass:highball' });
  });

  it('"No picture" for this link leaves the picture out of the public copy', async () => {
    setup({ item: { ...BASE, picture: { kind: 'icon', icon: 'glass:coupe', v: 1 } } });
    fireEvent.click(screen.getByTestId('own-picture-field-open'));
    fireEvent.click(screen.getByRole('radio', { name: 'No picture' }));
    expect(screen.queryByTestId('own-preview-picture')).toBeNull();
    fireEvent.click(screen.getByTestId('own-create'));
    await screen.findByTestId('share-copy');
    expect('picture' in publishShare.mock.calls[0][1]).toBe(false);
  });

  it('a chalk picture is published with its image in one call, only on Create link, and the link remembers it', async () => {
    const chalk = chalkValue();
    const { addShare } = setup({ item: { ...BASE, picture: chalk } });
    expect(screen.getByTestId('own-preview-picture')).toBeTruthy();
    expect(publishShareWithPicture).not.toHaveBeenCalled();
    fireEvent.click(screen.getByTestId('own-create'));
    await screen.findByTestId('share-copy');
    expect(publishShare).not.toHaveBeenCalled();
    expect(publishShareWithPicture).toHaveBeenCalledTimes(1);
    const [, doc, id, opts] = publishShareWithPicture.mock.calls[0];
    expect(doc.picture).toEqual({ kind: 'chalk' });
    expect(JSON.stringify(doc)).not.toContain('blob');
    expect(opts.owner).toBe('u1');
    expect(opts.chalk.blob).toBe(chalk.blob);
    expect(addShare).toHaveBeenCalledWith(expect.objectContaining({ id, picture: { kind: 'chalk' } }));
  });

  it('a picture that could not be stored is ONE plain line; the link is still made and the cards go ahead', async () => {
    publishShareWithPicture.mockImplementationOnce(async (_db, _doc, id) => ({ id, picture: null, reason: 'The picture could not be saved, so it was left out. You can add it again later.' }));
    const { addShare } = setup({ item: { ...BASE, picture: chalkValue() } });
    fireEvent.click(screen.getByTestId('own-create'));
    await screen.findByTestId('share-copy');
    const notes = screen.getAllByTestId('own-picture-note');
    expect(notes).toHaveLength(1);
    expect(notes[0].textContent).toBe('The picture could not be saved, so it was left out. You can add it again later.');
    expect(screen.getByTestId('own-live')).toBeTruthy();
    expect(addShare.mock.calls[0][0].picture).toBeUndefined();
    expect(screen.getByTestId('stub-images').getAttribute('data-picture')).toBe('');
  });

  it('after Create link the cards get the picture the link was published with (a drawing here)', async () => {
    setup({ item: { ...BASE, picture: { kind: 'icon', icon: 'glass:coupe', v: 1 } } });
    fireEvent.click(screen.getByTestId('own-create'));
    await screen.findByTestId('share-copy');
    await waitFor(() => expect(screen.getByTestId('stub-images').getAttribute('data-picture')).toBe('icon'));
  });

  it('an existing link draws its cards with the picture stored on the link, not the item\'s current one', async () => {
    const { fingerprint } = await (async () => ({ fingerprint: (await import('../../data/sharePublish.js')).shareFingerprint({ ...BASE, kind: 'cocktail' }) }))();
    setup({ shares: [{ id: 'abcde23456', kind: 'cocktail', fingerprint, name: 'Grandma Sour', createdAt: 1, picture: { kind: 'icon', icon: 'glass:mug' } }] });
    await waitFor(() => expect(screen.getByTestId('stub-images').getAttribute('data-picture')).toBe('icon'));
  });
});
