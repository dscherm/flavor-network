// @vitest-environment jsdom
// SHARE-8 / FLAVOR-6: the committed switch is on, but turning SHARE_CHARTS_ENABLED off (mocked here) still hides
// the chart: no flavor chart, no "not enough data" line, and the label file is not requested for the shared page.
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, waitFor, cleanup } from '@testing-library/react';

vi.mock('../../data/shareTargets.js', async (orig) => ({ ...(await orig()), SHARE_CHARTS_ENABLED: false }));
vi.mock('../../hooks/useAuth.js', () => ({ default: () => ({ user: null, loading: false, authError: null, loginWithGoogle: vi.fn(), loginWithApple: vi.fn() }) }));
vi.mock('../../hooks/useUserProfile.js', () => ({ default: () => ({ profile: {}, saveInvention: vi.fn() }) }));
import SharedRecipePage from '../SharedRecipePage.jsx';

const COCKTAIL = { name: 'Negroni', lines: [{ key: 'gin', amount: '1 oz' }, { key: 'campari', amount: '1 oz' }], method: 'Stir.', family: 'x' };
const loadData = async () => ({ cocktails: [COCKTAIL], families: [] });
const DOC = { kind: 'cocktail', name: 'Grandma Sour', owner: 'u1', createdAt: 1, removed: false, by: null, lines: [{ key: 'bourbon', amount: '2 oz' }], bars: [{ label: 'sweet', color: '#ff00aa', score: 0.5 }] };
afterEach(() => cleanup());

describe('shared page with the switch off', () => {
  it('built-in recipe: no chart section, no empty line, no flavor-data request', async () => {
    const loadNodes = vi.fn(async () => new Map());
    render(<SharedRecipePage route={{ kind: 'cocktail', slug: 'negroni' }} loadData={loadData} loadNodes={loadNodes} />);
    await screen.findByTestId('shared-name');
    expect(screen.queryByTestId('shared-profile')).toBeNull();
    expect(screen.queryByTestId('shared-profile-empty')).toBeNull();
    expect(screen.queryByText(/Flavor profile/)).toBeNull();
    expect(screen.queryByText(/Not enough flavor data/)).toBeNull();
    await new Promise((r) => setTimeout(r, 30));
    expect(loadNodes).not.toHaveBeenCalled();
  });

  it('user copy, even one with stored bars: no chart, no flavor-data request', async () => {
    const loadNodes = vi.fn(async () => new Map());
    render(<SharedRecipePage route={{ id: 'abcdefghjk' }} loadShared={async () => DOC} loadNodes={loadNodes} />);
    await screen.findByTestId('shared-name');
    expect(screen.queryByTestId('shared-profile')).toBeNull();
    expect(screen.queryByText(/Not enough flavor data/)).toBeNull();
    await waitFor(() => expect(loadNodes).not.toHaveBeenCalled());
  });
});
