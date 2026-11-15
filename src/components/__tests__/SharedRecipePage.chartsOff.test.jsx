// @vitest-environment jsdom
// SHARE-8: SHARE_CHARTS_ENABLED is off in the committed state. No flavor chart, no "not enough data" line,
// and the flavor data file is not requested for the shared page.
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, waitFor, cleanup } from '@testing-library/react';

vi.mock('../../hooks/useAuth.js', () => ({ default: () => ({ user: null, loading: false, authError: null, loginWithGoogle: vi.fn(), loginWithApple: vi.fn() }) }));
vi.mock('../../hooks/useUserProfile.js', () => ({ default: () => ({ profile: {}, saveInvention: vi.fn() }) }));
import SharedRecipePage from '../SharedRecipePage.jsx';
import { SHARE_CHARTS_ENABLED } from '../../data/shareTargets.js';

const COCKTAIL = { name: 'Negroni', lines: [{ key: 'gin', amount: '1 oz' }, { key: 'campari', amount: '1 oz' }], method: 'Stir.', family: 'x' };
const loadData = async () => ({ cocktails: [COCKTAIL], families: [] });
const DOC = { kind: 'cocktail', name: 'Grandma Sour', owner: 'u1', createdAt: 1, removed: false, by: null, lines: [{ key: 'bourbon', amount: '2 oz' }], bars: [{ label: 'sweet', color: '#ff00aa', score: 0.5 }] };
afterEach(() => cleanup());

describe('shared page with charts off', () => {
  it('the committed switch is off', () => { expect(SHARE_CHARTS_ENABLED).toBe(false); });

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
