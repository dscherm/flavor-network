// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import { readFileSync } from 'node:fs';
// The page's account hooks reach Firebase; these tests are about the recipe, signed out.
vi.mock('../../hooks/useAuth.js', () => ({ default: () => ({ user: null, loading: false, authError: null, loginWithGoogle: vi.fn(), loginWithApple: vi.fn() }) }));
vi.mock('../../hooks/useUserProfile.js', () => ({ default: () => ({ profile: {}, saveInvention: vi.fn() }) }));
vi.mock('../../data/shareTargets.js', async (orig) => ({ ...(await orig()), SHARE_CHARTS_ENABLED: true }));
import SharedRecipePage from '../SharedRecipePage.jsx';
import { SEED_RECIPES } from '../../data/seedRecipes.js';
import { RECIPE_DETAILS } from '../../data/seedRecipeDetails.js';
import { readCuratedCodex } from '../../../scripts/lib/curatedCodex.mjs';

const codex = readCuratedCodex();
const sauceRaw = JSON.parse(readFileSync('public/data/sauce_augment.json', 'utf8'));
const entropy = JSON.parse(readFileSync('public/proDataset/gnn_entropy.json', 'utf8'));

const loadData = vi.fn(async (kind) => {
  if (kind === 'cocktail') return { cocktails: codex.cocktails, families: codex.families };
  if (kind === 'sauce') return { sauces: sauceRaw.sauces };
  if (kind === 'dish') return { dishes: SEED_RECIPES, dishDetails: RECIPE_DETAILS };
  return {};
});
const loadNodes = async () => new Map(Object.entries(entropy).filter(([k, v]) => !k.startsWith('_') && v?.probs).map(([k, v]) => [k, { gnnProbs: v.probs }]));

// The last column: does the recipe have enough real (non-placeholder) flavor data to draw a chart? Since FLAVOR-4 the
// hand-tuned strength table is a taste source of its own, so a recipe of ingredients on that table draws one even when
// the model's values for them are placeholders.
const CASES = {
  cocktail: [['negroni', 'Negroni', 'gin', true], ['daiquiri', 'Daiquiri', 'lime juice', true], ['margarita', 'Margarita', 'tequila', true]],
  sauce: [['alfredo', 'Alfredo', 'parmesan', true], ['hollandaise', 'Hollandaise', 'butter', true], ['bearnaise', 'Béarnaise', 'tarragon', true]],
  dish: [['margherita-pizza', 'Margherita Pizza', 'mozzarella', true], ['beef-bolognese', 'Beef Bolognese', 'carrot', true], ['risotto-saffron', 'Saffron Risotto', 'saffron', true]],
};

describe('SharedRecipePage, signed out, real data', () => {
  for (const [kind, rows] of Object.entries(CASES)) {
    for (const [slug, name, ingredient, hasChart] of rows) {
      it(`${kind}/${slug} shows name, ingredients, method${kind === 'cocktail' ? ', glass' : ''} and ${hasChart ? 'the chart' : 'no chart, only the plain line'}`, async () => {
        render(<SharedRecipePage route={{ kind, slug }} loadData={loadData} loadNodes={loadNodes} />);
        expect((await screen.findByTestId('shared-name')).textContent).toBe(name);
        const lines = screen.getAllByTestId('shared-line');
        expect(lines.length).toBeGreaterThanOrEqual(2);
        expect(lines.some((l) => l.textContent.toLowerCase().includes(ingredient))).toBe(true);
        expect(screen.getByTestId('shared-method').textContent.length).toBeGreaterThan(10);
        if (kind === 'cocktail') expect(screen.getByTestId('shared-glass').textContent).toMatch(/Glass: .+/);
        if (kind === 'dish') expect(lines.some((l) => /\d/.test(l.textContent))).toBe(true);
        const chart = await screen.findByTestId('shared-profile');
        expect(within(chart).getByText(/Flavor profile \(visual guide\)/)).toBeTruthy();
        if (hasChart) {
          expect(within(chart).getAllByRole('listitem').length).toBeGreaterThan(0);
          expect(screen.getByTestId('shared-profile-note')).toBeTruthy();
        } else {
          expect(screen.getByTestId('shared-profile-empty').textContent).toBe('Not enough flavor data for a chart yet.');
          expect(within(chart).queryAllByRole('listitem')).toHaveLength(0);
        }
        expect(screen.getByTestId('shared-actions')).toBeTruthy();
      });
    }
  }

  it('still renders the recipe when the flavor data fails to load', async () => {
    render(<SharedRecipePage route={{ kind: 'cocktail', slug: 'negroni' }} loadData={loadData} loadNodes={async () => { throw new Error('offline'); }} />);
    expect((await screen.findByTestId('shared-name')).textContent).toBe('Negroni');
    await waitFor(() => expect(screen.queryByTestId('shared-profile')).toBeNull());
  });

  it('shows the actions slot content', async () => {
    render(<SharedRecipePage route={{ kind: 'sauce', slug: 'alfredo' }} loadData={loadData} loadNodes={loadNodes} actions={<button>Later</button>} />);
    const slot = await screen.findByTestId('shared-actions');
    expect(within(slot).getByText('Later')).toBeTruthy();
  });

  it('has a header link home', async () => {
    render(<SharedRecipePage route={{ kind: 'sauce', slug: 'alfredo' }} loadData={loadData} loadNodes={loadNodes} />);
    const link = screen.getByText('Neural Flavor').closest('a');
    expect(link.getAttribute('href')).toBe('/');
  });

  for (const [label, route] of [
    ['unknown slug', { kind: 'cocktail', slug: 'no-such-drink' }],
    ['unknown kind', { kind: 'wine', slug: 'merlot' }],
    ['a user-copy id that is not found', { id: 'abc123def4' }],
  ]) {
    it(`says it is no longer shared for ${label}`, async () => {
      render(<SharedRecipePage route={route} loadData={loadData} loadNodes={loadNodes} loadShared={async () => null} />);
      expect(await screen.findByTestId('shared-gone')).toBeTruthy();
      expect(screen.getByText('This recipe is no longer shared')).toBeTruthy();
      expect(screen.getByTestId('shared-home').getAttribute('href')).toBe('/');
      expect(screen.queryByTestId('shared-name')).toBeNull();
    });
  }

  it('says it is no longer shared when the recipe file fails to load', async () => {
    render(<SharedRecipePage route={{ kind: 'cocktail', slug: 'negroni' }} loadData={async () => { throw new Error('x'); }} loadNodes={loadNodes} />);
    expect(await screen.findByTestId('shared-gone')).toBeTruthy();
  });
});
