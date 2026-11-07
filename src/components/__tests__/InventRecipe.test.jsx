// @vitest-environment jsdom
// KITCHEN-2: "Invent a recipe". The recipe model, real-recipe index and
// quantity model are mocked.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, within, waitFor } from '@testing-library/react';

const LOGITS = { lemon: 1, garlic: 0.5, tomato: -0.5, rice: -1, onion: -1.5, chocolate: -6, basil: 0.2, parmesan: 0.1 };
const suggest = vi.fn(async (observed, { candidateNames, k }) => {
  const pool = candidateNames || Object.keys(LOGITS);
  return pool.filter((n) => !observed.includes(n) && n in LOGITS)
    .map((name) => ({ name, score: LOGITS[name] }))
    .sort((a, b) => b.score - a.score)
    .slice(0, k);
});
let modelResult;
const VOCAB = ['chicken', 'lemon', 'garlic', 'thyme'];
const REC = [{ v: [0, 1, 2, 3], t: 'Lemon Garlic Chicken', d: ['Roast it all together.'] }];
vi.mock('../../ml/kitchenRuntime.js', () => ({
  loadInventModel: vi.fn(() => modelResult),
  loadRealRecipes: vi.fn(async () => ({ index: { recipes: REC, inv: { 0: [0], 1: [0], 2: [0], 3: [0] } }, vocab: VOCAB })),
}));
vi.mock('../../ml/quantityRuntime.js', () => ({
  predictBowlAmounts: vi.fn(async (names) => names.map((name) => ({ name, amount: name === 'chicken' ? { raw: '1 lb', qty: 1, unit: 'lb', inferred: true } : null }))),
}));

import InventRecipe from '../InventRecipe.jsx';

const NODES = new Map([
  ['chicken', { category: 'protein', cuisines: ['italian cuisine'] }],
  ['lemon', { category: 'citrus', cuisines: ['italian cuisine', 'greek cuisine'] }],
  ['garlic', { category: 'aromatic', cuisines: ['italian cuisine'] }],
  ['tomato', { category: 'vegetable', cuisines: ['italian cuisine'] }],
  ['rice', { category: 'grain', cuisines: ['indian cuisine'] }],
  ['onion', { category: 'aromatic', cuisines: [] }],
  ['basil', { category: 'herb', cuisines: ['italian cuisine'] }],
  ['parmesan', { category: 'dairy', cuisines: ['italian cuisine'] }],
]);
const EDGES = [
  { source: 'chicken', target: 'lemon', strength: 0.8, known: true },
  { source: 'chicken', target: 'garlic', strength: 0.6, known: true },
  { source: 'chicken', target: 'basil', strength: 0.5, known: true },
];
const CUISINES = ['Global', 'Italian', 'Indian', 'Greek', 'Thai', 'italian'];

function mount(props = {}) {
  const p = { kitchen: ['chicken', 'lemon', 'garlic', 'tomato', 'rice', 'onion'], nodes: NODES, edges: EDGES, onClose: vi.fn(), onWrite: vi.fn(), onEditKitchen: vi.fn(), ...props };
  render(<InventRecipe {...p} />);
  return p;
}

describe('InventRecipe', () => {
  beforeEach(() => {
    suggest.mockClear();
    modelResult = Promise.resolve({ suggest, cuisineVocab: CUISINES });
  });

  it('defaults to the cuisine the kitchen leans toward and shows up to 3 inventions', async () => {
    mount();
    const cuisines = await screen.findByRole('group', { name: 'Cuisine' });
    await waitFor(() => expect(within(cuisines).getByRole('button', { name: 'Italian' })).toHaveAttribute('aria-pressed', 'true'));
    const cards = await screen.findAllByTestId('invent-recipe-card');
    expect(cards.length).toBeGreaterThan(0);
    expect(cards.length).toBeLessThanOrEqual(3);
    expect(cards[0]).toHaveTextContent(/Italian-style/);
    expect(cards[0]).toHaveTextContent('An idea from what pairs, not a tested recipe');
    expect(within(cards[0]).getByTestId('dish-art')).toBeInTheDocument();
    // Model calls carry the cuisine and stay inside the kitchen first.
    expect(suggest.mock.calls[0][1]).toMatchObject({ cuisine: 'Italian' });
    expect(suggest.mock.calls[0][1].candidateNames).not.toContain('basil');
  });

  it('a main ingredient leads the dish; amounts and the closest real recipe appear', async () => {
    mount();
    const mains = await screen.findByRole('group', { name: 'Main ingredient' });
    fireEvent.click(within(mains).getByRole('button', { name: 'chicken' }));
    await waitFor(() => expect(screen.getAllByTestId('invent-recipe-name')[0]).toHaveTextContent(/^Chicken & Lemon/));
    const card = screen.getAllByTestId('invent-recipe-card')[0];
    await waitFor(() => expect(card).toHaveTextContent('1 lb'));
    const closest = await within(card).findByTestId('invent-recipe-closest');
    expect(closest).toHaveTextContent('Lemon Garlic Chicken');
    fireEvent.click(within(closest).getByRole('button', { expanded: false }));
    expect(within(closest).getByText('Roast it all together.')).toBeInTheDocument();
  });

  it('a thin kitchen gets at most two "you\'d need" ingredients', async () => {
    // No pairing graph here: the toy graph has no "common" (degree ≥ 50) ingredient.
    mount({ kitchen: ['chicken'], edges: null });
    const card = (await screen.findAllByTestId('invent-recipe-card'))[0];
    const needed = within(card).getAllByTestId('invent-recipe-needed');
    expect(needed.length).toBeGreaterThan(0);
    expect(needed.length).toBeLessThanOrEqual(2);
  });

  it('"Write it in the Recipe Notebook" hands the invention over', async () => {
    const p = mount();
    const [btn] = await screen.findAllByTestId('invent-recipe-write');
    fireEvent.click(btn);
    expect(p.onWrite).toHaveBeenCalledWith(expect.objectContaining({ source: 'make-invent', mode: 'recipe', title: expect.any(String) }));
    expect(p.onWrite.mock.calls[0][0].ingredients[0]).toEqual(expect.objectContaining({ ingredient: expect.any(String) }));
  });

  it('switching cuisine re-invents', async () => {
    mount();
    const cuisines = await screen.findByRole('group', { name: 'Cuisine' });
    await screen.findAllByTestId('invent-recipe-card');
    fireEvent.click(within(cuisines).getByRole('button', { name: /^all/ }));
    fireEvent.click(within(cuisines).getByRole('button', { name: 'Thai' }));
    await waitFor(() => expect(screen.getAllByTestId('invent-recipe-name')[0]).toHaveTextContent('Thai-style'));
  });

  it('an empty kitchen says to add things first', async () => {
    mount({ kitchen: [] });
    expect(await screen.findByTestId('invent-recipe-missing')).toHaveTextContent(/Add a few things/);
  });

  it('if the model fails to load, invent says it is unavailable', async () => {
    modelResult = Promise.resolve(null);
    mount();
    expect(await screen.findByTestId('invent-recipe-unavailable')).toHaveTextContent('Invent is unavailable');
    expect(screen.queryByTestId('invent-recipe-card')).toBeNull();
  });
});
