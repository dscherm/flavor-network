// @vitest-environment jsdom
// LOOK-9 contract tests (blind): the cooking-method chips in the recipe builder (RecipeCookingMethod, chalk
// branch). Written from plan.md (LOOK-9 AC-2: "a cooking method ... selected") and the approved brief
// .schermness/design/LOOK-9.md (section 3.9, 9 test 3). No file under src/ was read; the render setup (models,
// quantity and directions runtimes and the Flavor Profiles card mocked, fetch stubbed before import) is the one in
// src/components/__tests__/InventRecipe.builder2.test.jsx.
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { hasAnyBackground, hasAccentBackground, expectSelectedNotFilled } from './helpers.js';

const suggest = vi.fn(async () => []);
const VOCAB = ['chicken', 'broccoli', 'garlic', 'rice'];
vi.mock('../../../src/ml/kitchenRuntime.js', () => ({
  loadInventModel: vi.fn(() => Promise.resolve({ suggest, cuisineVocab: ['Global'] })),
  loadRealRecipes: vi.fn(async () => ({ index: { recipes: [], inv: {} }, vocab: VOCAB })),
}));
vi.mock('../../../src/ml/quantityRuntime.js', () => ({
  predictBowlAmounts: vi.fn(async (names) => names.map((name) => ({ name, amount: null }))),
}));
vi.mock('../../../src/ml/directionsRuntime.js', () => ({
  loadDirectionsIndex: vi.fn(async () => ({ recipes: [], inv: {} })),
  retrieveCookingMethods: vi.fn(() => ({ methods: [{ method: 'sear', frac: 0.6 }, { method: 'roast', frac: 0.4 }] })),
}));
vi.mock('../../../src/components/RecipeFlavorProfilesCard.jsx', () => ({ default: () => <div data-testid="card-stub" /> }));
// RecipeCookingMethod caches its vocabulary fetch for the life of the module (builder2 note).
vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => ({ vocab: VOCAB }) })));

import InventRecipe from '../../../src/components/InventRecipe.jsx';

const NODES = new Map([
  ['chicken', { category: 'protein', cuisines: [], taste: 'umami sweet' }],
  ['garlic', { category: 'aromatic', cuisines: [], taste: 'pungent' }],
  ['rice', { category: 'grain', cuisines: [] }],
]);
const P = 'invent-recipe';
afterEach(cleanup);

describe('LOOK-9 cooking-method chips', () => {
  // Covers: AC-2
  it('a chosen cooking method says so (aria-pressed) and is not filled; no chip has an accent background', async () => {
    render(<InventRecipe kitchen={[...NODES.keys()]} nodes={NODES} edges={null} onClose={vi.fn()} onWrite={vi.fn()} onEditKitchen={vi.fn()}
      seed={{ pinned: [{ key: 'chicken', source: 'search' }, { key: 'garlic', source: 'search' }] }} />);
    fireEvent.change(screen.getByTestId(`${P}-list-add-input`), { target: { value: 'rice' } });
    fireEvent.click(screen.getByTestId(`${P}-list-add`));
    const chips = await screen.findAllByTestId('cooking-method-chip');
    expect(chips.length).toBe(2);
    fireEvent.click(chips[0]);
    const [chosen, other] = screen.getAllByTestId('cooking-method-chip');
    expectSelectedNotFilled(expect, chosen, `cooking method "${chosen.textContent}"`);
    expect(other.getAttribute('aria-pressed')).toBe('false');
    expect(hasAnyBackground(other), `unchosen chip "${other.textContent}" has a background`).toBe(false);
    const box = screen.getByTestId('cooking-method-chips');
    const accent = [box, ...box.querySelectorAll('*')].filter(hasAccentBackground).map((el) => el.outerHTML.slice(0, 100));
    expect(accent).toEqual([]);
  });
});
