// @vitest-environment jsdom
// BUILDER-1: the suggestion deck from the recipe invent panel (models mocked as in InventRecipe.test.jsx).
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

const LOGITS = { broccoli: 2, carrot: 0, zucchini: -1 };
const defaultSuggest = async (observed, { k }) => Object.entries(LOGITS)
  .filter(([n]) => !observed.includes(n))
  .map(([name, score]) => ({ name, score }))
  .sort((a, b) => b.score - a.score)
  .slice(0, k);
const suggest = vi.fn(defaultSuggest);
let modelResult;
const VOCAB = ['chicken', 'broccoli', 'garlic', 'rice'];
const REC = [{ v: [0, 1, 2, 3], t: 'Chicken Broccoli Stir-fry', d: ['Sear the chicken.'] }];
vi.mock('../../ml/kitchenRuntime.js', () => ({
  loadInventModel: vi.fn(() => modelResult),
  loadRealRecipes: vi.fn(async () => ({ index: { recipes: REC, inv: { 0: [0], 1: [0], 2: [0], 3: [0] } }, vocab: VOCAB })),
}));
vi.mock('../../ml/quantityRuntime.js', () => ({
  predictBowlAmounts: vi.fn(async (names) => names.map((name) => ({ name, amount: name === 'chicken' ? { raw: '1 lb', qty: 1, unit: 'lb', inferred: true } : null }))),
}));

import InventRecipe from '../InventRecipe.jsx';

const NODES = new Map([
  ['chicken', { category: 'protein', cuisines: ['italian cuisine'], taste: 'umami sweet' }],
  ['pork', { category: 'protein', cuisines: [], taste: 'sweet umami' }],
  ['broccoli', { category: 'vegetable', cuisines: [] }],
  ['carrot', { category: 'vegetable', cuisines: [] }],
  ['zucchini', { category: 'vegetable', cuisines: ['chinese cuisine'] }],
  ['garlic', { category: 'aromatic', cuisines: [], taste: 'pungent' }],
  ['onion', { category: 'aromatic', cuisines: [], taste: 'sweet pungent' }],
  ['scallion', { category: 'aromatic', cuisines: [] }],
  ['rice', { category: 'grain', cuisines: [] }],
]);
const ALL = [...NODES.keys()];
const P = 'invent-recipe';

function mount(props = {}) {
  render(<InventRecipe kitchen={ALL} nodes={NODES} edges={null} onClose={vi.fn()} onWrite={vi.fn()} onEditKitchen={vi.fn()} {...props} />);
}
const lineKeys = () => screen.queryAllByTestId(`${P}-list-line`).map((r) => r.getAttribute('data-key'));
const answer = (text) => {
  fireEvent.change(screen.getByTestId(`${P}-start-input`), { target: { value: text } });
  fireEvent.click(screen.getByTestId(`${P}-start-go`));
};
const addTyped = (text) => {
  fireEvent.change(screen.getByTestId(`${P}-list-add-input`), { target: { value: text } });
  fireEvent.click(screen.getByTestId(`${P}-list-add`));
};
const chipKeys = () => screen.queryAllByTestId(`${P}-suggest-item`).map((b) => b.getAttribute('data-key'));

describe('InventDeck in the recipe panel', () => {
  beforeEach(() => {
    suggest.mockClear();
    modelResult = Promise.resolve({ suggest, cuisineVocab: ['Global', 'Italian'] });
  });

  it('opens a deck with one card per suggestion; Add on the second card adds it and closes with the list intact', async () => {
    mount();
    answer('chicken');
    await waitFor(() => expect(chipKeys().length).toBeGreaterThan(1));
    const chips = chipKeys();
    fireEvent.click(screen.getByTestId(`${P}-suggest-deck`));
    expect(screen.getByTestId('suggestion-deck-add')).toHaveAttribute('data-stack-size', String(chips.length));
    fireEvent.click(screen.getByTestId('deck-next'));
    expect(screen.getByTestId('suggestion-card')).toHaveAttribute('data-ingredient', chips[1]);
    fireEvent.click(screen.getByTestId('deck-commit'));
    expect(screen.queryByTestId('invent-deck')).toBeNull();
    expect(lineKeys()).toEqual(['chicken', chips[1]]);
  });

  it("the deck's Now grid leads with the same notes as the panel's flavor profile", async () => {
    mount();
    answer('pork');
    addTyped('chicken');
    addTyped('onion');
    await waitFor(() => expect(chipKeys().length).toBeGreaterThan(0));
    const panel = screen.queryAllByTestId(/^invent-recipe-profile-bar-/).map((e) => e.dataset.testid.replace('invent-recipe-profile-bar-', ''));
    expect(panel.length).toBeGreaterThan(1);
    fireEvent.click(screen.getByTestId(`${P}-suggest-deck`));
    const now = [...screen.getByTestId('ingredient-card-grid-before').querySelectorAll('[data-testid="flavor-grid-cell"]')]
      .filter((c) => c.dataset.on === 'true').map((c) => ({ axis: c.dataset.axis, r: Number(c.dataset.radius) }))
      .sort((a, b) => b.r - a.r);
    expect(new Set(now.map((n) => n.axis))).toEqual(new Set(panel));
    expect(now[0].axis).toBe(panel[0]);
  });

  it('swap mode replaces the line with the stand-in and closes', async () => {
    mount({ kitchen: ['chicken', 'onion', 'rice'] });
    answer('chicken');
    addTyped('scallion');
    fireEvent.click(screen.getByTestId(`${P}-list-need-scallion`));
    fireEvent.click(screen.getByTestId(`${P}-list-replace-deck-scallion`));
    expect(screen.getByTestId('suggestion-deck-replace')).toHaveAttribute('data-stack-size', '1');
    fireEvent.click(screen.getByTestId('deck-commit'));
    expect(screen.queryByTestId('invent-deck')).toBeNull();
    expect(lineKeys()).toEqual(['chicken', 'onion']);
  });
});
