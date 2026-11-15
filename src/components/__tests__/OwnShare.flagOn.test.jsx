// @vitest-environment jsdom
// SHARE-7: the flag that lets a cook share their own recipe ships together with the Report link.
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup, waitFor } from '@testing-library/react';

vi.mock('../../hooks/useAuth.js', () => ({ default: () => ({ user: null, loading: false, authError: null, loginWithGoogle: vi.fn(), loginWithApple: vi.fn() }) }));
vi.mock('../../hooks/useUserProfile.js', () => ({ default: () => ({ profile: {}, saveInvention: vi.fn() }) }));
vi.mock('../ShareImages.jsx', () => ({ default: () => null }));
import { SHARE_OWN_ENABLED } from '../../data/shareTargets.js';
import { OwnShareButton, ShareOwnContext } from '../OwnShare.jsx';
import SharedRecipePage from '../SharedRecipePage.jsx';

const ITEM = { id: 'inv-1', name: 'Grandma Sour', kind: 'cocktail', lines: [{ key: 'bourbon', amount: '2 oz' }, { key: 'lemon', amount: '1 oz' }] };
const CTX = {
  userProfile: { profile: { shares: [] }, addShare: vi.fn() },
  auth: { user: { uid: 'u1', displayName: 'Dan' }, loginWithGoogle: vi.fn(), loginWithApple: vi.fn() },
};
const DOC = { kind: 'cocktail', name: 'Grandma Sour', owner: 'u1', createdAt: 1, removed: false, by: null, lines: ITEM.lines, bars: [] };

afterEach(() => cleanup());

describe('SHARE_OWN_ENABLED is on, together with the Report link', () => {
  it('the flag is true', () => {
    expect(SHARE_OWN_ENABLED).toBe(true);
  });
  it('a user-made item shows Share without any mocking of the flag', () => {
    render(<ShareOwnContext.Provider value={CTX}><OwnShareButton kind="cocktail" item={ITEM} /></ShareOwnContext.Provider>);
    expect(screen.getByTestId('own-share-button')).toBeTruthy();
  });
  it('the page for a user copy renders the Report link in the report slot', async () => {
    render(<SharedRecipePage route={{ id: 'abcdefghjk' }} loadShared={async () => DOC} loadNodes={async () => new Map()} loadData={async () => ({})} />);
    const slot = await screen.findByTestId('shared-report-slot');
    await waitFor(() => expect(slot.querySelector('[data-testid="report-open"]')).toBeTruthy());
  });
});
