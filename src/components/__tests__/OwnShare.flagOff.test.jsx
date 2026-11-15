// @vitest-environment jsdom
// SHARE-6: with SHARE_OWN_ENABLED at its committed value (false) no user-made item shows a Share button anywhere.
// SHARE-7 flips the flag; until then this must hold.
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';

vi.mock('../ShareImages.jsx', () => ({ default: () => null }));
import { SHARE_OWN_ENABLED } from '../../data/shareTargets.js';
import { OwnShareButton, ShareOwnContext } from '../OwnShare.jsx';
import { ShareButton } from '../ShareSheet.jsx';
import LabNodeCard from '../LabNodeCard.jsx';
import InventNameSave from '../InventNameSave.jsx';

const ITEM = { id: 'inv-1', name: 'Grandma Sour', kind: 'cocktail', lines: [{ key: 'bourbon', amount: '2 oz' }, { key: 'lemon', amount: '1 oz' }] };
const CTX = {
  userProfile: { profile: { shares: [] }, addShare: vi.fn() },
  auth: { user: { uid: 'u1', displayName: 'Dan' }, loginWithGoogle: vi.fn(), loginWithApple: vi.fn() },
};

afterEach(() => cleanup());

describe('SHARE_OWN_ENABLED is off in the committed state', () => {
  it('the flag is false', () => {
    expect(SHARE_OWN_ENABLED).toBe(false);
  });
  it('OwnShareButton renders nothing, even signed in with a provider', () => {
    render(<ShareOwnContext.Provider value={CTX}><OwnShareButton kind="cocktail" item={ITEM} /></ShareOwnContext.Provider>);
    expect(screen.queryByTestId('own-share-button')).toBeNull();
    expect(screen.queryByRole('button')).toBeNull();
  });
  it('ShareButton for an own item renders nothing', () => {
    render(<ShareButton ownItem recipe={{ kind: 'cocktail', name: 'x' }} onPublish={() => {}} />);
    expect(screen.queryByTestId('share-button')).toBeNull();
  });
  it('a lab card for the cook\'s own recipe has no Share button', () => {
    render(
      <ShareOwnContext.Provider value={CTX}>
        <LabNodeCard name="Grandma Sour" ownShare={{ kind: 'cocktail', item: ITEM }} actions={[]} onClose={() => {}} />
      </ShareOwnContext.Provider>,
    );
    expect(screen.queryByTestId('card-own-share')).toBeNull();
    expect(screen.queryByTestId('card-share')).toBeNull();
  });
  it('the saved state of an invent panel has no Share button', () => {
    render(
      <ShareOwnContext.Provider value={CTX}>
        <InventNameSave name="Grandma Sour" onName={() => {}} canSave status="saved" shareItem={{ kind: 'cocktail', item: ITEM }} onSave={() => {}} />
      </ShareOwnContext.Provider>,
    );
    expect(screen.queryByTestId('namesave-share')).toBeNull();
    expect(screen.queryByText('Share')).toBeNull();
    fireEvent.click(screen.getByTestId('namesave-save'));
  });
});
