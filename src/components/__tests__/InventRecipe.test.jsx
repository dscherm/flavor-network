// @vitest-environment jsdom
// "Invent a recipe": pick a dish type and a main, get a pre-filled skeleton, build it yourself.
// The recipe model, real-recipe index and quantity model are mocked.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, within, waitFor } from '@testing-library/react';

const LOGITS = { broccoli: 2, carrot: 0, zucchini: -1 };
const defaultSuggest = async (observed, { k }) => Object.entries(LOGITS)
  .filter(([n]) => !observed.includes(n))
  .map(([name, score]) => ({ name, score }))
  .sort((a, b) => b.score - a.score)
  .slice(0, k);
const suggest = vi.fn(defaultSuggest);
let modelResult;
const VOCAB = ['chicken', 'broccoli', 'garlic', 'rice'];
const REC = [{ v: [0, 1, 2, 3], t: 'Chicken Broccoli Stir-fry', d: ['Sear the chicken.', 'Toss it all together.'] }];
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
  ['tofu', { category: 'protein', cuisines: [] }],
  ['pork', { category: 'protein', cuisines: [] }],
  ['broccoli', { category: 'vegetable', cuisines: [] }],
  ['carrot', { category: 'vegetable', cuisines: [] }],
  ['zucchini', { category: 'vegetable', cuisines: ['chinese cuisine'] }],
  ['garlic', { category: 'aromatic', cuisines: [] }],
  ['ginger', { category: 'aromatic', cuisines: [] }],
  ['soy sauce', { category: 'condiment', cuisines: [] }],
  ['oyster sauce', { category: 'condiment', cuisines: [] }],
  ['rice', { category: 'grain', cuisines: [] }],
  ['noodle', { category: 'grain', cuisines: [] }],
  ['corn tortilla', { category: 'grain', cuisines: [] }],
  ['taco sauce', { category: 'condiment', cuisines: [] }],
  ['lettuce', { category: 'vegetable', cuisines: [] }],
  ['lime', { category: 'citrus', cuisines: [] }],
]);
const ALL = [...NODES.keys()];
const CUISINES = ['Global', 'Italian', 'Chinese', 'Thai'];
const P = 'invent-recipe-slots';

function mount(props = {}) {
  const p = { kitchen: ALL, nodes: NODES, edges: null, onClose: vi.fn(), onWrite: vi.fn(), onEditKitchen: vi.fn(), ...props };
  render(<InventRecipe {...p} />);
  return p;
}
const line = (id) => screen.getByTestId(`${P}-line-${id}`).textContent;
const row = (id) => screen.getByTestId(`${P}-slot-${id}`);
const filled = (id) => row(id).getAttribute('data-empty') === 'false';
const options = (id) => {
  if (!screen.queryByTestId(`${P}-shortlist-${id}`)) fireEvent.click(screen.getByTestId(`${P}-open-${id}`));
  return within(screen.getByTestId(`${P}-shortlist-${id}`)).getAllByTestId(`${P}-option`).map((b) => b.textContent.replace(/·.*$/, '').trim());
};
const mainsGroup = () => screen.getByRole('group', { name: 'Main' });

describe('InventRecipe', () => {
  beforeEach(() => {
    suggest.mockClear();
    suggest.mockImplementation(defaultSuggest);
    modelResult = Promise.resolve({ suggest, cuisineVocab: CUISINES });
  });

  it('opens on stir-fry with the 8 dish types drawn, and no shuffle', async () => {
    mount();
    const types = screen.getByRole('group', { name: 'What kind of dish?' });
    expect(within(types).getAllByRole('button').map((b) => b.getAttribute('aria-label'))).toEqual(
      ['Stir-fry', 'Braise / stew', 'Soup', 'Salad', 'Pasta', 'Roast', 'Tacos', 'Grain bowl'],
    );
    expect(within(types).getAllByTestId('dish-art')).toHaveLength(8);
    expect(within(types).getByRole('button', { name: 'Stir-fry' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByTestId('invent-recipe-dishline')).toHaveTextContent('Stir-fry');
    expect(screen.queryByTestId('invent-recipe-shuffle')).toBeNull();
    expect(screen.getByTestId('invent-recipe-note')).toHaveTextContent('not a tested recipe');
    await screen.findByRole('group', { name: 'Cuisine' });
    // Cuisine starts as "none selected".
    expect(within(screen.getByRole('group', { name: 'Cuisine' })).getByRole('button', { name: 'any' })).toHaveAttribute('aria-pressed', 'true');
  });

  it('stir-fry + chicken: main locked to chicken, vegetable, aromatic, sauce and starch pre-filled', async () => {
    mount();
    fireEvent.click(within(mainsGroup()).getByRole('button', { name: 'chicken' }));
    expect(line('main')).toBe('chicken');
    expect(row('main')).toHaveTextContent('locked');
    for (const id of ['vegetable', 'aromatic', 'sauce', 'starch']) expect(filled(id), id).toBe(true);
    for (const id of ['chili', 'herb', 'crunch']) expect(filled(id), id).toBe(false);
    expect(screen.queryByTestId('invent-recipe-missing')).toBeNull();
    expect(screen.getByTestId('invent-recipe-method')).toHaveTextContent(/sauce/);
  });

  it('with the model, scores are fetched once per build change, not per slot, and never block the panel', async () => {
    mount();
    await waitFor(() => expect(suggest).toHaveBeenCalled());
    await waitFor(() => expect(suggest.mock.calls.some(([observed]) => observed.length === 5)).toBe(true));
    const before = suggest.mock.calls.length;
    fireEvent.click(screen.getByTestId(`${P}-open-vegetable`));
    fireEvent.click(screen.getByTestId(`${P}-open-sauce`));
    expect(suggest.mock.calls.length).toBe(before);
  });

  it('a model score re-orders a shortlist (broccoli outranks carrot and zucchini)', async () => {
    mount();
    await waitFor(() => expect(suggest).toHaveBeenCalled());
    fireEvent.click(screen.getByTestId(`${P}-clear-vegetable`));
    await waitFor(() => expect(suggest.mock.calls.length).toBeGreaterThan(1));
    expect(options('vegetable')[0]).toBe('broccoli');
  });

  it('changing cuisine re-orders shortlists but does not replace pre-filled or user-set slots', async () => {
    suggest.mockImplementation(async () => []); // no model opinion: only pairing order and the cuisine bonus
    mount();
    const cuisines = await screen.findByRole('group', { name: 'Cuisine' });
    fireEvent.click(within(mainsGroup()).getByRole('button', { name: 'chicken' }));
    // User sets the starch by hand.
    fireEvent.click(screen.getByTestId(`${P}-open-starch`));
    fireEvent.click(within(screen.getByTestId(`${P}-shortlist-starch`)).getAllByTestId(`${P}-option`).find((b) => /rice/.test(b.textContent)));
    expect(line("starch")).toBe('rice');
    const before = ['main', 'vegetable', 'aromatic', 'sauce', 'starch'].map(line);
    fireEvent.click(screen.getByTestId(`${P}-clear-vegetable`));
    const none = options('vegetable');
    fireEvent.click(within(cuisines).getByRole('button', { name: /^all/ }));
    fireEvent.click(within(cuisines).getByRole('button', { name: 'Chinese' }));
    const chinese = options('vegetable');
    expect(chinese).not.toEqual(none);
    expect([...chinese].sort()).toEqual([...none].sort());
    expect(chinese.indexOf('zucchini')).toBeLessThan(none.indexOf('zucchini'));
    // The pre-filled and user-set slots stayed as they were.
    expect(['main', 'aromatic', 'sauce', 'starch'].map(line)).toEqual([before[0], before[2], before[3], before[4]]);
    expect(line("starch")).toBe('rice');
    expect(screen.getByTestId('invent-recipe-dishline')).toHaveTextContent('Stir-fry · Chinese');
    await waitFor(() => expect(suggest.mock.calls.some(([, o]) => o.cuisine === 'Chinese')).toBe(true));
  });

  it('changing dish type re-seeds, keeping the main and what the cook set that the new dish takes', async () => {
    mount();
    fireEvent.click(within(mainsGroup()).getByRole('button', { name: 'chicken' }));
    fireEvent.click(screen.getByTestId(`${P}-clear-aromatic`));
    fireEvent.click(screen.getByTestId(`${P}-open-aromatic`));
    fireEvent.click(within(screen.getByTestId(`${P}-shortlist-aromatic`)).getAllByTestId(`${P}-option`).find((b) => /^ginger/.test(b.textContent)));
    fireEvent.click(screen.getByTestId('invent-recipe-type-tacos'));
    expect(line('tortilla')).toBe('corn tortilla');
    expect(line('main')).toBe('chicken');
    expect(screen.getByTestId('invent-recipe-dishline')).toHaveTextContent('Tacos');
    // ginger is no taco ingredient, so it did not carry over as a slot pick.
    expect(screen.queryByTestId(`${P}-line-aromatic`)).toBeNull();
  });

  it('the main can be any typed ingredient, and "any" lets the pairing pick it', async () => {
    mount();
    fireEvent.change(screen.getByTestId('invent-recipe-main-input'), { target: { value: 'tofu' } });
    fireEvent.submit(screen.getByTestId('invent-recipe-main-input').closest('form'));
    expect(line('main')).toBe('tofu');
    expect(within(mainsGroup()).getByRole('button', { name: 'tofu' })).toHaveAttribute('aria-pressed', 'true');
    fireEvent.click(screen.getByTestId('invent-recipe-main-any'));
    expect(filled('main')).toBe(true);
    expect(row('main')).not.toHaveTextContent('locked');
  });

  it('model load failure: the panel opens, says so quietly, and slots fill from the pairing index', async () => {
    modelResult = Promise.resolve(null);
    mount();
    expect(await screen.findByTestId('invent-recipe-no-model')).toHaveTextContent('without the recipe model');
    expect(screen.queryByTestId('invent-recipe-unavailable')).toBeNull();
    fireEvent.click(within(mainsGroup()).getByRole('button', { name: 'chicken' }));
    for (const id of ['main', 'vegetable', 'aromatic', 'sauce', 'starch']) expect(filled(id), id).toBe(true);
    expect(suggest).not.toHaveBeenCalled();
    expect(screen.queryByRole('group', { name: 'Cuisine' })).toBeNull();
  });

  it('a model that rejects is the same as no model', async () => {
    modelResult = Promise.reject(new Error('offline'));
    mount();
    expect(await screen.findByTestId('invent-recipe-no-model')).toBeInTheDocument();
    expect(filled('vegetable')).toBe(true);
  });

  it('kitchen items fill first and the rest is marked "you\'d need"', async () => {
    mount({ kitchen: ['chicken', 'carrot', 'garlic'] });
    expect(line('vegetable')).toBe('carrot');
    expect(line('aromatic')).toBe('garlic');
    const needed = screen.getByTestId('invent-recipe-needed');
    expect(needed).toHaveTextContent("you'd need");
    expect(needed).not.toHaveTextContent('carrot');
    // A space between the label and the list ("you'd need soy sauce", never "you'd needsoy sauce").
    expect(needed.textContent).toMatch(/you'd need\s+\S/);
  });

  it('the dish types are a two-column grid, not eight rows', () => {
    mount();
    const types = screen.getByRole('group', { name: 'What kind of dish?' });
    expect(types.className).toMatch(/grid-cols-2/);
    expect(types.className).not.toMatch(/flex-col/);
    expect(within(types).getAllByRole('button')).toHaveLength(8);
  });

  it('the name agrees with the chosen dish type, whatever the ingredients look like', async () => {
    mount();
    const noun = { 'Stir-fry': /Stir-Fry/, 'Braise / stew': /Braise/, Soup: /Soup/, Salad: /Salad/, Pasta: /Pasta/, Roast: /Roast/, Tacos: /Tacos/, 'Grain bowl': /Bowl/ };
    fireEvent.click(within(mainsGroup()).getByRole('button', { name: 'chicken' }));
    for (const [label, re] of Object.entries(noun)) {
      fireEvent.click(within(screen.getByRole('group', { name: 'What kind of dish?' })).getByRole('button', { name: label }));
      expect(screen.getByTestId('invent-recipe-name').textContent, label).toMatch(re);
      expect(screen.getByTestId('invent-recipe-name').textContent, label).toMatch(/^Chicken/);
    }
  });

  it('says what a required slot still needs when nothing fits', async () => {
    const lean = new Map([...NODES].filter(([k]) => k !== 'soy sauce' && k !== 'oyster sauce'));
    mount({ nodes: lean, kitchen: [...lean.keys()] });
    expect(screen.getByTestId('invent-recipe-missing')).toHaveTextContent('Still needs: sauce');
  });

  it('shows amounts and the closest real recipe with its method', async () => {
    mount();
    fireEvent.click(within(mainsGroup()).getByRole('button', { name: 'chicken' }));
    await waitFor(() => expect(screen.getByTestId(`${P}-amount-main`)).toHaveTextContent('1 lb'));
    const closest = await screen.findByTestId('invent-recipe-closest');
    expect(closest).toHaveTextContent('Chicken Broccoli Stir-fry');
    fireEvent.click(within(closest).getByRole('button', { expanded: false }));
    expect(within(closest).getByText('Toss it all together.')).toBeInTheDocument();
  });

  it('"Write it in the Recipe Notebook" hands over the built ingredients and amounts in the usual shape', async () => {
    const p = mount();
    fireEvent.click(within(mainsGroup()).getByRole('button', { name: 'chicken' }));
    await waitFor(() => expect(screen.getByTestId(`${P}-amount-main`)).toHaveTextContent('1 lb'));
    await screen.findByTestId('invent-recipe-closest');
    fireEvent.click(screen.getByTestId('invent-recipe-write'));
    const h = p.onWrite.mock.calls[0][0];
    expect(h).toMatchObject({ source: 'make-invent', mode: 'recipe', title: expect.any(String), stepsFrom: 'Chicken Broccoli Stir-fry' });
    expect(h.steps.length).toBeGreaterThan(0);
    const names = h.ingredients.map((i) => i.ingredient);
    expect(names).toContain('chicken');
    for (const id of ['vegetable', 'aromatic', 'sauce', 'starch']) expect(names).toContain(line(id));
    expect(h.ingredients.find((i) => i.ingredient === 'chicken').amount).toMatchObject({ raw: '1 lb' });
  });

  it('extras can be added and removed, and a duplicate is refused with a reason', async () => {
    mount();
    fireEvent.change(screen.getByTestId(`${P}-add-input`), { target: { value: 'lime' } });
    fireEvent.click(screen.getByTestId(`${P}-add`));
    expect(screen.getByTestId(`${P}-extras`)).toHaveTextContent('lime');
    fireEvent.change(screen.getByTestId(`${P}-add-input`), { target: { value: 'lime' } });
    fireEvent.click(screen.getByTestId(`${P}-add`));
    expect(screen.getByTestId(`${P}-notice`)).toHaveTextContent('already in the build');
    fireEvent.click(screen.getByTestId(`${P}-remove-lime`));
    expect(screen.getByTestId(`${P}-extras`)).not.toHaveTextContent('lime');
  });

  it('Start over drops the cook\'s edits but keeps the dish type and main', async () => {
    mount();
    fireEvent.click(within(mainsGroup()).getByRole('button', { name: 'chicken' }));
    fireEvent.click(screen.getByTestId(`${P}-clear-sauce`));
    expect(filled('sauce')).toBe(false);
    fireEvent.click(screen.getByTestId('invent-recipe-restart'));
    expect(filled('sauce')).toBe(true);
    expect(line('main')).toBe('chicken');
  });

  it('back and kitchen buttons call through', () => {
    const p = mount();
    fireEvent.click(screen.getByTestId('invent-recipe-close'));
    fireEvent.click(screen.getByTestId('invent-recipe-kitchen'));
    expect(p.onClose).toHaveBeenCalled();
    expect(p.onEditKitchen).toHaveBeenCalled();
  });
});

describe('InventRecipe seed', () => {
  beforeEach(() => { modelResult = Promise.resolve({ suggest, cuisineVocab: CUISINES }); });

  it('opens with search pins locked in the slots they fit, picking the dish type from them', () => {
    mount({ seed: { pinned: [{ key: 'corn tortilla', source: 'search' }, { key: 'pork', source: 'search' }, { key: 'lime', source: 'search' }] } });
    expect(screen.getByRole('button', { name: 'Tacos' })).toHaveAttribute('aria-pressed', 'true');
    expect(line('tortilla')).toBe('corn tortilla');
    expect(row('tortilla')).toHaveTextContent('from your search');
    expect(line('main')).toBe('pork');
    expect(row('main')).toHaveTextContent('from your search');
    expect(line('acid')).toBe('lime');
    // The other required slots are still pre-filled around the pins.
    expect(filled('sauce')).toBe(true);
    expect(filled('topping')).toBe(true);
  });

  it('an explicit type, main and cuisine win; search pins survive a change of main', async () => {
    mount({ seed: { type: 'stir-fry', main: 'tofu', cuisine: 'Thai', pinned: [{ key: 'ginger', source: 'search' }] } });
    expect(line('main')).toBe('tofu');
    expect(line('aromatic')).toBe('ginger');
    expect(screen.getByTestId('invent-recipe-dishline')).toHaveTextContent('Stir-fry · Thai');
    fireEvent.click(within(mainsGroup()).getByRole('button', { name: 'chicken' }));
    expect(line('main')).toBe('chicken');
    expect(line('aromatic')).toBe('ginger');
    expect(row('aromatic')).toHaveTextContent('from your search');
  });
});
