// @vitest-environment jsdom
// USAGE-2: sharing events. A user's own recipe is reported by kind and origin only.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup, act } from '@testing-library/react';

vi.mock('../../data/shareTargets.js', async (importOriginal) => ({ ...(await importOriginal()), SHARE_OWN_ENABLED: true }));
vi.mock('../../data/shareStore.js', () => ({ publishShare: async () => {}, getShare: vi.fn(), unshare: vi.fn() }));
vi.mock('../../data/sharedLoaders.js', () => ({ loadLabelNodes: async () => null, defaultLoadData: vi.fn(), defaultLoadNodes: vi.fn() }));
vi.mock('../ShareImages.jsx', () => ({ default: () => null }));
vi.mock('../../hooks/useAuth.js', () => ({ default: () => ({ user: null, loading: false, authError: null, loginWithGoogle: vi.fn(), loginWithApple: vi.fn() }) }));
vi.mock('../../hooks/useUserProfile.js', () => ({ default: () => ({ profile: {}, saveInvention: vi.fn() }) }));

import { OwnShareButton, ShareOwnContext } from '../OwnShare.jsx';
import { ShareButton } from '../ShareSheet.jsx';
import SharedRecipePage from '../SharedRecipePage.jsx';
import { setConsent, __resetUsageForTests } from '../../data/usage.js';

let handle;
const sent = () => handle.logEvent.mock.calls.map(([n, p]) => [n, p]);
const flush = () => act(async () => { await new Promise((r) => setTimeout(r, 0)); });

beforeEach(() => {
  window.localStorage.clear();
  handle = { logEvent: vi.fn(), setEnabled: vi.fn() };
  __resetUsageForTests({ loader: async () => handle, isLocal: () => false });
  setConsent('yes');
});
afterEach(() => { cleanup(); __resetUsageForTests(); });

const ITEM = { id: 'inv-1', name: "Grandma's Secret Sour", kind: 'cocktail', lines: [{ key: 'bourbon', amount: '2 oz' }, { key: 'lemon', amount: '1 oz' }] };
const CTX = {
  userProfile: { profile: { shares: [] }, addShare: vi.fn() },
  auth: { user: { uid: 'u1', displayName: 'Dan' }, loginWithGoogle: vi.fn(), loginWithApple: vi.fn() },
};
const SECRET = /Grandma|Secret|bourbon|inv-1|u1|Dan/;

describe('sharing usage', () => {
  it('own recipe: sheet opened and link created carry kind and origin only', async () => {
    render(<ShareOwnContext.Provider value={CTX}><OwnShareButton kind="cocktail" item={ITEM} getDb={async () => ({})} /></ShareOwnContext.Provider>);
    fireEvent.click(screen.getByTestId('own-share-button'));
    fireEvent.click(screen.getByTestId('own-create'));
    await screen.findByTestId('share-copy');
    await flush();
    expect(sent()).toEqual([
      ['share_sheet_opened', { kind: 'cocktail', origin: 'own' }],
      ['share_link_created', { kind: 'cocktail' }],
    ]);
    expect(JSON.stringify(sent())).not.toMatch(SECRET);
  });

  it('built-in recipe: the sheet reports the slug, once per opening', async () => {
    render(<ShareButton recipe={{ kind: 'cocktail', name: 'Negroni' }} link="/r/cocktail/negroni" />);
    fireEvent.click(screen.getByTestId('share-button'));
    await flush();
    expect(sent()).toEqual([['share_sheet_opened', { kind: 'cocktail', origin: 'built_in', slug: 'negroni' }]]);
    fireEvent.click(screen.getByTestId('share-close'));
    fireEvent.click(screen.getByTestId('share-button'));
    await flush();
    expect(sent()).toHaveLength(2);
  });

  it('a shared page for a user copy reports kind and origin, never the id or name', async () => {
    const DOC = { kind: 'cocktail', name: "Grandma's Secret Sour", owner: 'u1', createdAt: 1, removed: false, by: 'Dan', lines: ITEM.lines, bars: [] };
    render(<SharedRecipePage route={{ id: 'abcdefghjk' }} loadShared={async () => DOC} loadNodes={async () => new Map()} loadData={async () => ({})} />);
    await screen.findByTestId('shared-name');
    await flush();
    expect(sent().filter(([n]) => n === 'shared_page_opened')).toEqual([['shared_page_opened', { kind: 'cocktail', origin: 'own' }]]);
    expect(JSON.stringify(sent())).not.toMatch(/Grandma|Secret|bourbon|abcdefghjk|Dan/);
  });

  it('the shared page links to the privacy page', async () => {
    render(<SharedRecipePage route={{ id: 'abcdefghjk' }} loadShared={async () => null} loadNodes={async () => new Map()} loadData={async () => ({})} />);
    await screen.findByTestId('shared-gone');
    expect(screen.getByTestId('shared-privacy-link').getAttribute('href')).toBe('/privacy');
  });
});
