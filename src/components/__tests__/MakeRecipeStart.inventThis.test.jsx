// @vitest-environment jsdom
// INVENT-6: the Cookbook's "✨ Invent this" seed, handed to Make a recipe, opens Recipe Lab invent on it.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';

vi.mock('../../hooks/useAuth.js', () => ({
  default: () => ({ user: { uid: 't' }, loading: false, authError: null, loginWithGoogle: vi.fn(), loginWithApple: vi.fn(), logout: vi.fn() }),
}));
vi.mock('../../ml/kitchenRuntime.js', () => ({
  loadRealRecipes: vi.fn(async () => ({ index: { recipes: [], inv: {} }, vocab: [] })),
  loadInventModel: vi.fn(async () => null),
}));
vi.mock('../../ml/quantityRuntime.js', () => ({ predictBowlAmounts: vi.fn(async (names) => names.map((name) => ({ name, amount: null }))) }));
vi.mock('../ProfileAxisRadar.jsx', () => ({ default: () => null }));

import MakeRecipeStart from '../MakeRecipeStart.jsx';
import { recipeSeedFromSearch } from '../../data/inventSearch.js';

const NODES = new Map([
  ['chicken', { category: 'protein', cuisines: [] }], ['tofu', { category: 'protein', cuisines: [] }],
  ['broccoli', { category: 'vegetable', cuisines: [] }], ['garlic', { category: 'aromatic', cuisines: [] }],
  ['ginger', { category: 'aromatic', cuisines: [] }], ['soy sauce', { category: 'condiment', cuisines: [] }],
  ['rice', { category: 'grain', cuisines: [] }], ['noodle', { category: 'grain', cuisines: [] }],
]);

function mount(extra = {}) {
  const s = { setRecipeHandoff: vi.fn(), setRecipeMounted: vi.fn(), setActiveTab: vi.fn(), setCookbookPickerMode: vi.fn() };
  const onInventSeedConsumed = vi.fn();
  const view = render(<MakeRecipeStart {...s} nodes={NODES} edges={[]} onInventSeedConsumed={onInventSeedConsumed} {...extra} />);
  return { ...s, onInventSeedConsumed, view };
}
const line = (id) => screen.getByTestId(`invent-recipe-slots-line-${id}`).textContent;

describe('MakeRecipeStart — initialInventSeed', () => {
  beforeEach(() => { localStorage.clear(); });

  it("a 'chicken' seed opens Recipe invent with chicken as the main, and reports it consumed", async () => {
    const { seed } = recipeSeedFromSearch('chicken', { recipes: [], nodes: NODES });
    const m = mount({ initialInventSeed: seed });
    expect(await screen.findByTestId('invent-recipe')).toBeInTheDocument();
    expect(line('main')).toBe('chicken');
    expect(m.onInventSeedConsumed).toHaveBeenCalledTimes(1);
  });

  it('changing the dish type keeps the searched ingredients', async () => {
    const { seed } = recipeSeedFromSearch('noodle, soy sauce, ginger, chicken', { recipes: [], nodes: NODES });
    mount({ initialInventSeed: seed });
    await screen.findByTestId('invent-recipe');
    expect(seed.type).toBe('stir-fry');
    expect(line('main')).toBe('chicken');
    expect(line('aromatic')).toBe('ginger');
    fireEvent.click(within(screen.getByRole('group', { name: 'What kind of dish?' })).getByRole('button', { name: 'Soup' }));
    expect(line('main')).toBe('chicken');
    // soup's aromatic slot is an onion-family base, so ginger moves to the extras instead of vanishing
    expect(screen.getByTestId('invent-recipe-slots-extras')).toHaveTextContent('ginger');
  });

  it('opening Invent from the cards afterwards starts fresh', async () => {
    const { seed } = recipeSeedFromSearch('chicken', { recipes: [], nodes: NODES });
    mount({ initialInventSeed: seed });
    await screen.findByTestId('invent-recipe');
    fireEvent.click(screen.getByTestId('invent-recipe-close'));
    fireEvent.click(screen.getByTestId('make-card-invent'));
    await screen.findByTestId('invent-recipe');
    expect(screen.getByTestId('invent-recipe').textContent).not.toMatch(/from your search/);
  });
});
