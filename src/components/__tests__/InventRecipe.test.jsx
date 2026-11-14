// @vitest-environment jsdom
// "Invent a recipe", second pass: it starts EMPTY. The cook answers "what is the main ingredient?",
// adds their own ingredients, optionally picks a dish type (or accepts a recommended one), and names it.
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
import { recipeSeedFromSearch } from '../../data/inventSearch.js';

const SWEETISH = { sweet: 0.8, odor_fruity: 0.4 };
const NODES = new Map([
  ['chicken', { category: 'protein', cuisines: ['italian cuisine'], gnnProbs: SWEETISH }],
  ['tofu', { category: 'protein', cuisines: [] }],
  ['pork', { category: 'protein', cuisines: [] }],
  ['broccoli', { category: 'vegetable', cuisines: [] }],
  ['carrot', { category: 'vegetable', cuisines: [] }],
  ['zucchini', { category: 'vegetable', cuisines: ['chinese cuisine'] }],
  ['garlic', { category: 'aromatic', cuisines: [] }],
  ['ginger', { category: 'aromatic', cuisines: [] }],
  ['onion', { category: 'aromatic', cuisines: [] }],
  ['scallion', { category: 'aromatic', cuisines: [] }],
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

function mount(props = {}) {
  const p = { kitchen: ALL, nodes: NODES, edges: null, onClose: vi.fn(), onWrite: vi.fn(), onEditKitchen: vi.fn(), ...props };
  render(<InventRecipe {...p} />);
  return p;
}
const lineKeys = () => screen.queryAllByTestId('invent-recipe-list-line').map((r) => r.getAttribute('data-key'));
const answer = (text) => {
  fireEvent.change(screen.getByTestId('invent-recipe-start-input'), { target: { value: text } });
  fireEvent.click(screen.getByTestId('invent-recipe-start-go'));
};
const addTyped = (text) => {
  fireEvent.change(screen.getByTestId('invent-recipe-list-add-input'), { target: { value: text } });
  fireEvent.click(screen.getByTestId('invent-recipe-list-add'));
};
const pickType = (id) => {
  if (!screen.queryByTestId('invent-recipe-category-options')) fireEvent.click(screen.getByTestId('invent-recipe-category-toggle'));
  fireEvent.click(screen.getByTestId(`invent-recipe-category-option-${id}`));
};
const suggestKeys = () => screen.queryAllByTestId('invent-recipe-suggest-item').map((b) => b.getAttribute('data-key'));

describe('InventRecipe', () => {
  beforeEach(() => {
    suggest.mockClear();
    suggest.mockImplementation(defaultSuggest);
    modelResult = Promise.resolve({ suggest, cuisineVocab: CUISINES });
  });

  it('opens showing only the main-ingredient question', async () => {
    mount();
    expect(screen.getByTestId('invent-recipe-start-question')).toHaveTextContent('What is the main ingredient?');
    expect(screen.queryByTestId('invent-recipe-list')).toBeNull();
    expect(screen.queryByTestId('invent-recipe-category')).toBeNull();
    expect(screen.queryByTestId('invent-recipe-suggest')).toBeNull();
    expect(screen.queryByTestId('invent-recipe-profile')).toBeNull();
    expect(screen.queryByTestId('invent-recipe-namesave')).toBeNull();
    expect(screen.queryByTestId('invent-recipe-method')).toBeNull();
    expect(screen.queryByRole('group', { name: 'Cuisine' })).toBeNull();
    // kitchen mains first (protein / hearty vegetable that the main slot takes), and only those that are mains
    const keys = screen.getAllByTestId('invent-recipe-start-option').map((b) => b.getAttribute('data-key'));
    expect(keys.slice(0, 3)).toEqual(expect.arrayContaining(['chicken', 'tofu', 'pork']));
    expect(keys).not.toContain('soy sauce');
    expect(suggest).not.toHaveBeenCalled();
  });

  it('after picking chicken the list is exactly [chicken] and the name box is empty', async () => {
    mount({ onSave: vi.fn() });
    fireEvent.click(screen.getAllByTestId('invent-recipe-start-option').find((b) => b.getAttribute('data-key') === 'chicken'));
    expect(lineKeys()).toEqual(['chicken']);
    expect(screen.queryByTestId('invent-recipe-start')).toBeNull();
    expect(screen.getByTestId('invent-recipe-namesave-name').value).toBe('');
    expect(screen.getByTestId('invent-recipe-namesave-name').getAttribute('placeholder')).toMatch(/Name your dish/);
    // no dish type is chosen: no checklist, no method, no closest recipe
    expect(screen.queryByTestId('invent-recipe-checklist')).toBeNull();
    expect(screen.queryByTestId('invent-recipe-method')).toBeNull();
    expect(screen.queryByTestId('invent-recipe-closest')).toBeNull();
    await screen.findByRole('group', { name: 'Cuisine' });
    expect(lineKeys()).toEqual(['chicken']);
  });

  it('typing the main answers step 1 as well', () => {
    mount();
    answer('tofu');
    expect(lineKeys()).toEqual(['tofu']);
  });

  it('the dish-type picker is collapsed, lists the 8 types with drawings, and has "No particular kind"', () => {
    mount();
    answer('chicken');
    expect(screen.queryByTestId('invent-recipe-category-options')).toBeNull();
    fireEvent.click(screen.getByTestId('invent-recipe-category-toggle'));
    const opts = screen.getByTestId('invent-recipe-category-options');
    expect(within(opts).getAllByTestId('dish-art')).toHaveLength(8);
    for (const id of ['stir-fry', 'braise-stew', 'soup', 'salad', 'pasta', 'roast', 'tacos', 'grain-bowl']) {
      expect(screen.getByTestId(`invent-recipe-category-option-${id}`)).toBeTruthy();
    }
    expect(screen.getByTestId('invent-recipe-category-none')).toHaveTextContent('No particular kind');
  });

  it('with no dish type, noodle + soy sauce + ginger recommends Stir-fry, applied only on Accept', () => {
    mount();
    answer('noodle');
    expect(screen.queryByTestId('invent-recipe-hint')).toBeNull(); // one ingredient: nothing to recommend yet
    addTyped('soy sauce');
    addTyped('ginger');
    const hint = screen.getByTestId('invent-recipe-hint');
    expect(hint).toHaveTextContent('Stir-fry');
    // nothing applied silently
    expect(screen.queryByTestId('invent-recipe-checklist')).toBeNull();
    expect(screen.queryByTestId('invent-recipe-method')).toBeNull();
    expect(lineKeys()).toEqual(['noodle', 'soy sauce', 'ginger']);
    fireEvent.click(screen.getByTestId('invent-recipe-hint-accept'));
    expect(screen.queryByTestId('invent-recipe-hint')).toBeNull();
    expect(screen.getByTestId('invent-recipe-checklist')).toHaveTextContent('Stir-fry usually have');
    expect(screen.getByTestId('invent-recipe-method')).toBeInTheDocument();
    expect(lineKeys()).toEqual(expect.arrayContaining(['noodle', 'soy sauce', 'ginger']));
    expect(lineKeys()).toHaveLength(3);
  });

  it('"Not now" hides the recommendation until the list changes', () => {
    mount();
    answer('noodle');
    addTyped('soy sauce');
    expect(screen.getByTestId('invent-recipe-hint')).toBeInTheDocument();
    fireEvent.click(screen.getByTestId('invent-recipe-hint-dismiss'));
    expect(screen.queryByTestId('invent-recipe-hint')).toBeNull();
    expect(screen.queryByTestId('invent-recipe-checklist')).toBeNull();
    addTyped('ginger');
    expect(screen.getByTestId('invent-recipe-hint')).toBeInTheDocument();
  });

  it('with Tacos chosen the checklist shows tortilla, salsa or sauce and fresh topping unticked, and fills nothing in', () => {
    mount();
    answer('pork');
    pickType('tacos');
    const list = screen.getByTestId('invent-recipe-checklist');
    expect(list).toHaveTextContent('Tacos usually have');
    expect(screen.getByTestId('invent-recipe-checklist-item-main')).toHaveAttribute('data-done', 'true');
    for (const id of ['tortilla', 'sauce', 'topping']) {
      const item = screen.getByTestId(`invent-recipe-checklist-item-${id}`);
      expect(item).toHaveAttribute('data-done', 'false');
      expect(item).toHaveAttribute('data-required', 'true');
    }
    expect(screen.getByTestId('invent-recipe-checklist-item-tortilla')).toHaveTextContent('tortilla');
    expect(screen.getByTestId('invent-recipe-checklist-item-sauce')).toHaveTextContent('salsa or sauce');
    expect(screen.getByTestId('invent-recipe-checklist-item-topping')).toHaveTextContent('fresh topping');
    expect(lineKeys()).toEqual(['pork']);
    // the dish type shows its method and drawing line now
    expect(screen.getByTestId('invent-recipe-method')).toHaveTextContent(/tortillas/);
    // opening a part offers options; tapping one adds it, and not before
    fireEvent.click(screen.getByTestId('invent-recipe-checklist-open-tortilla'));
    const opts = within(screen.getByTestId('invent-recipe-checklist-options-tortilla')).getAllByTestId('invent-recipe-checklist-option');
    expect(opts.map((o) => o.getAttribute('data-key'))).toContain('corn tortilla');
    expect(lineKeys()).toEqual(['pork']);
    fireEvent.click(opts.find((o) => o.getAttribute('data-key') === 'corn tortilla'));
    expect(lineKeys().sort()).toEqual(['corn tortilla', 'pork']);
    expect(screen.getByTestId('invent-recipe-checklist-item-tortilla')).toHaveAttribute('data-done', 'true');
  });

  it('choosing "No particular kind" afterwards drops the checklist and method but keeps the list', () => {
    mount();
    answer('pork');
    pickType('tacos');
    fireEvent.click(screen.getByTestId('invent-recipe-category-toggle'));
    fireEvent.click(screen.getByTestId('invent-recipe-category-none'));
    expect(screen.queryByTestId('invent-recipe-checklist')).toBeNull();
    expect(screen.queryByTestId('invent-recipe-method')).toBeNull();
    expect(lineKeys()).toEqual(['pork']);
  });

  it('the model scores suggestions, one call per list change, and nothing is added by itself', async () => {
    mount();
    answer('chicken');
    await waitFor(() => expect(suggest).toHaveBeenCalledTimes(1));
    expect(suggest.mock.calls[0][0]).toEqual(['chicken']);
    await waitFor(() => expect(suggestKeys()[0]).toBe('broccoli'));
    expect(suggestKeys().length).toBeLessThanOrEqual(8);
    expect(suggestKeys()).not.toContain('chicken');
    expect(lineKeys()).toEqual(['chicken']);
    // choosing a dish type and opening parts do not ask the model again
    pickType('stir-fry');
    fireEvent.click(screen.getByTestId('invent-recipe-checklist-open-vegetable'));
    await waitFor(() => expect(suggest).toHaveBeenCalledTimes(1));
    expect(lineKeys()).toEqual(['chicken']);
    // tapping a suggestion adds exactly that one, and asks the model once more
    fireEvent.click(screen.getAllByTestId('invent-recipe-suggest-item').find((b) => b.getAttribute('data-key') === 'broccoli'));
    expect(lineKeys()).toEqual(['chicken', 'broccoli']);
    await waitFor(() => expect(suggest).toHaveBeenCalledTimes(2));
    expect(suggest.mock.calls[1][0]).toEqual(['chicken', 'broccoli']);
  });

  it('a stale model answer for an older list is dropped', async () => {
    let release;
    suggest.mockImplementationOnce(() => new Promise((res) => { release = () => res([{ name: 'zucchini', score: 9 }]); }));
    mount();
    answer('chicken');
    await waitFor(() => expect(suggest).toHaveBeenCalledTimes(1));
    addTyped('garlic');
    await waitFor(() => expect(suggest).toHaveBeenCalledTimes(2));
    release();
    await waitFor(() => expect(suggestKeys()[0]).toBe('broccoli'));
  });

  it('when the model failed, suggestions come from the pairing index alone, with a quiet note, and nothing is added', async () => {
    modelResult = Promise.resolve(null);
    mount();
    answer('chicken');
    expect(await screen.findByTestId('invent-recipe-no-model')).toBeInTheDocument();
    expect(suggest).not.toHaveBeenCalled();
    expect(suggestKeys().length).toBeGreaterThan(0);
    expect(lineKeys()).toEqual(['chicken']);
    expect(screen.queryByRole('group', { name: 'Cuisine' })).toBeNull(); // no model vocabulary: no cuisine chips
  });

  it('suggestions never offer salt, oil or water', async () => {
    const nodes = new Map([...NODES, ['salt', { category: 'seasoning' }], ['olive oil', { category: 'fat' }]]);
    mount({ nodes, kitchen: [...ALL, 'salt', 'olive oil'] });
    answer('chicken');
    await waitFor(() => expect(suggestKeys().length).toBeGreaterThan(0));
    expect(suggestKeys()).not.toContain('salt');
    expect(suggestKeys()).not.toContain('olive oil');
  });

  it('a line not in the kitchen shows a swap from the kitchen when kitchenSwaps has one, and tapping it replaces the line', () => {
    mount({ kitchen: ['chicken', 'onion', 'rice'] });
    answer('chicken');
    addTyped('scallion');
    const need = screen.getByTestId('invent-recipe-list-need-scallion');
    fireEvent.click(need);
    const opts = within(screen.getByTestId('invent-recipe-list-replacements-scallion')).getAllByTestId('invent-recipe-list-replace-option');
    expect(opts.map((o) => o.getAttribute('data-key'))).toEqual(['onion']);
    expect(lineKeys()).toEqual(['chicken', 'scallion']);
    fireEvent.click(opts[0]);
    expect(lineKeys()).toEqual(['chicken', 'onion']);
  });

  it('a line with no stand-in in the kitchen says so, and lines the cook has show no swap button', () => {
    mount({ kitchen: ['chicken', 'rice'] });
    answer('chicken');
    addTyped('scallion');
    expect(screen.queryByTestId('invent-recipe-list-need-chicken')).toBeNull();
    fireEvent.click(screen.getByTestId('invent-recipe-list-need-scallion'));
    expect(screen.getByTestId('invent-recipe-list-no-replacements-scallion')).toBeInTheDocument();
  });

  it('the flavor profile renders for the list', () => {
    mount();
    answer('chicken');
    const profile = screen.getByTestId('invent-recipe-profile');
    expect(profile).toBeInTheDocument();
    expect(screen.getByTestId('invent-recipe-profile-bar-sweet')).toBeInTheDocument();
    addTyped('tofu'); // no profile data: named as not counted
    expect(screen.getByTestId('invent-recipe-profile-uncounted')).toHaveTextContent('tofu');
  });

  it('amounts are editable suggestions that survive list changes', async () => {
    mount();
    answer('chicken');
    await waitFor(() => expect(screen.getByTestId('invent-recipe-list-amount-chicken').value).toBe('1 lb'));
    fireEvent.change(screen.getByTestId('invent-recipe-list-amount-chicken'), { target: { value: '2 lb' } });
    addTyped('tofu');
    expect(screen.getByTestId('invent-recipe-list-amount-chicken').value).toBe('2 lb');
  });

  it('a duplicate is refused with a reason and the list is unchanged', () => {
    mount();
    answer('chicken');
    addTyped('chicken');
    expect(lineKeys()).toEqual(['chicken']);
    expect(screen.getByTestId('invent-recipe-list-notice')).toBeInTheDocument();
  });

  it('cuisine only steers suggestions, never the list', async () => {
    mount();
    answer('chicken');
    const group = await screen.findByRole('group', { name: 'Cuisine' });
    expect(within(group).getByRole('button', { name: 'any' })).toHaveAttribute('aria-pressed', 'true');
    fireEvent.click(within(group).getByRole('button', { name: /all \d+/ }));
    fireEvent.click(within(group).getByRole('button', { name: 'Chinese' }));
    await waitFor(() => expect(suggest.mock.calls.some(([, o]) => o.cuisine === 'Chinese')).toBe(true));
    expect(lineKeys()).toEqual(['chicken']);
  });

  it('Save is disabled until there is a name and two ingredients, and sends the toSavedItem input', async () => {
    const onSave = vi.fn(async () => ({ status: 'saved', message: 'Saved to your recipes' }));
    mount({ onSave });
    answer('chicken');
    const save = () => screen.getByTestId('invent-recipe-namesave-save');
    expect(save()).toBeDisabled();
    fireEvent.change(screen.getByTestId('invent-recipe-namesave-name'), { target: { value: 'Weeknight bowl' } });
    expect(save()).toBeDisabled(); // one ingredient
    addTyped('broccoli');
    expect(save()).not.toBeDisabled();
    expect(save()).toHaveTextContent('Add to my recipes');
    await waitFor(() => expect(screen.getByTestId('invent-recipe-list-amount-chicken').value).toBe('1 lb'));
    fireEvent.click(save());
    await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1));
    const input = onSave.mock.calls[0][0];
    expect(input).toMatchObject({ kind: 'recipe', name: 'Weeknight bowl', category: null });
    expect(input.id).toBeUndefined();
    expect(input.lines).toEqual([
      { key: 'chicken', amount: '1 lb', role: null },
      { key: 'broccoli', amount: '', role: null },
    ]);
    expect(await screen.findByTestId('invent-recipe-namesave-status')).toHaveTextContent('Saved to your recipes');
  });

  it('with a dish type the saved input carries its id, the part each line fills and the method', async () => {
    const onSave = vi.fn(async () => ({ status: 'saved' }));
    mount({ onSave });
    answer('pork');
    addTyped('corn tortilla');
    pickType('tacos');
    fireEvent.change(screen.getByTestId('invent-recipe-namesave-name'), { target: { value: 'Pork tacos' } });
    fireEvent.click(screen.getByTestId('invent-recipe-namesave-save'));
    await waitFor(() => expect(onSave).toHaveBeenCalled());
    const input = onSave.mock.calls[0][0];
    expect(input.category).toBe('tacos');
    expect(input.lines.map((l) => [l.key, l.role]).sort()).toEqual([['corn tortilla', 'tortilla'], ['pork', 'main']]);
    expect(input.method).toMatch(/tortillas/);
  });

  it('a sign-in answer is shown and the button stays usable', async () => {
    const onSave = vi.fn(async () => ({ status: 'signin' }));
    mount({ onSave });
    answer('chicken');
    addTyped('broccoli');
    fireEvent.change(screen.getByTestId('invent-recipe-namesave-name'), { target: { value: 'Mine' } });
    fireEvent.click(screen.getByTestId('invent-recipe-namesave-save'));
    expect(await screen.findByTestId('invent-recipe-namesave-status')).toHaveAttribute('data-status', 'signin');
    expect(screen.getByTestId('invent-recipe-namesave-save')).not.toBeDisabled();
  });

  it('without onSave there is no save row', () => {
    mount();
    answer('chicken');
    expect(screen.queryByTestId('invent-recipe-namesave')).toBeNull();
  });

  it('Write it hands the list and amounts to the Recipe Notebook, named by the cook (or untitled)', async () => {
    const p = mount({ onSave: vi.fn() });
    answer('chicken');
    addTyped('broccoli');
    await waitFor(() => expect(screen.getByTestId('invent-recipe-list-amount-chicken').value).toBe('1 lb'));
    fireEvent.change(screen.getByTestId('invent-recipe-list-amount-broccoli'), { target: { value: '2 cups' } });
    fireEvent.click(screen.getByTestId('invent-recipe-write'));
    const h = p.onWrite.mock.calls[0][0];
    expect(h.source).toBe('make-invent');
    expect(h.mode).toBe('recipe');
    expect(h.title).toBe('Untitled dish');
    expect(h.ingredients.map((i) => i.ingredient)).toEqual(['chicken', 'broccoli']);
    expect(h.ingredients[0].amount.raw).toBe('1 lb');
    expect(h.ingredients[1].amount).toMatchObject({ raw: '2 cups', qty: 2, unit: 'cup' });
    expect(h.steps).toEqual([]); // no dish type: no borrowed method
    fireEvent.change(screen.getByTestId('invent-recipe-namesave-name'), { target: { value: 'My dish' } });
    fireEvent.click(screen.getByTestId('invent-recipe-write'));
    expect(p.onWrite.mock.calls[1][0].title).toBe('My dish');
  });

  it('the closest real recipe and its method show only once a dish type is chosen', async () => {
    mount();
    answer('chicken');
    addTyped('broccoli');
    addTyped('garlic');
    addTyped('rice');
    expect(screen.queryByTestId('invent-recipe-closest')).toBeNull();
    pickType('stir-fry');
    const closest = await screen.findByTestId('invent-recipe-closest');
    expect(closest).toHaveTextContent('Chicken Broccoli Stir-fry');
    fireEvent.click(within(closest).getByRole('button'));
    expect(closest).toHaveTextContent('Sear the chicken.');
  });

  it('Start over returns to step 1, cleared', () => {
    mount({ onSave: vi.fn() });
    answer('chicken');
    addTyped('broccoli');
    pickType('stir-fry');
    fireEvent.change(screen.getByTestId('invent-recipe-namesave-name'), { target: { value: 'Mine' } });
    fireEvent.click(screen.getByTestId('invent-recipe-restart'));
    expect(screen.getByTestId('invent-recipe-start-question')).toBeInTheDocument();
    expect(screen.queryByTestId('invent-recipe-list')).toBeNull();
    answer('tofu');
    expect(lineKeys()).toEqual(['tofu']);
    expect(screen.queryByTestId('invent-recipe-checklist')).toBeNull();
    expect(screen.getByTestId('invent-recipe-namesave-name').value).toBe('');
  });

  it('Back and My kitchen call their handlers', () => {
    const p = mount();
    fireEvent.click(screen.getByTestId('invent-recipe-close'));
    fireEvent.click(screen.getByTestId('invent-recipe-kitchen'));
    expect(p.onClose).toHaveBeenCalled();
    expect(p.onEditKitchen).toHaveBeenCalled();
  });

  describe('opening from the Cookbook search seed', () => {
    it('searched ingredients are the list; the best-fit type is only recommended', () => {
      const { seed } = recipeSeedFromSearch('noodle, soy sauce, ginger, chicken', { recipes: [], nodes: NODES });
      expect(seed.fromName).toBeUndefined();
      mount({ seed });
      expect(screen.queryByTestId('invent-recipe-start')).toBeNull();
      expect(lineKeys().sort()).toEqual(['chicken', 'ginger', 'noodle', 'soy sauce']);
      expect(screen.getAllByTestId('invent-recipe-list-line').some((r) => /from your search/.test(r.textContent))).toBe(true);
      expect(screen.queryByTestId('invent-recipe-checklist')).toBeNull();
      expect(screen.getByTestId('invent-recipe-hint')).toHaveTextContent('Stir-fry');
    });

    it("a 'chicken' seed answers step 1", () => {
      const { seed } = recipeSeedFromSearch('chicken', { recipes: [], nodes: NODES });
      mount({ seed });
      expect(lineKeys()).toEqual(['chicken']);
    });

    it('with no main-like term, step 1 is skipped and the list is the searched ingredients', () => {
      const { seed } = recipeSeedFromSearch('ginger, soy sauce', { recipes: [], nodes: NODES });
      mount({ seed });
      expect(screen.queryByTestId('invent-recipe-start')).toBeNull();
      expect(lineKeys().sort()).toEqual(['ginger', 'soy sauce']);
    });

    it('a searched recipe name applies its dish type and cuisine', () => {
      const recipes = [{ name: 'Chicken stir fry', ingredients: ['chicken', 'broccoli', 'soy sauce', 'garlic'], cuisine: 'Chinese', cluster: 'stir-fry' }];
      const { seed } = recipeSeedFromSearch('chicken stir fry', { recipes, nodes: NODES });
      expect(seed.fromName).toBe(true);
      mount({ seed });
      expect(screen.getByTestId('invent-recipe-checklist')).toBeInTheDocument();
      expect(lineKeys()).toEqual(expect.arrayContaining(['chicken']));
    });
  });

  describe('editItem', () => {
    const editItem = {
      id: 'inv-1', name: 'Pork tacos', baseline: { category: 'tacos' },
      lines: [{ key: 'pork', amount: '1 lb', role: 'main' }, { key: 'corn tortilla', amount: '8', role: 'tortilla' }],
    };
    it('opens on that dish with its own name, lines, amounts and type, and saves with the same id', async () => {
      const onSave = vi.fn(async () => ({ status: 'saved' }));
      mount({ editItem, onSave });
      expect(screen.queryByTestId('invent-recipe-start')).toBeNull();
      expect(lineKeys()).toEqual(expect.arrayContaining(['pork', 'corn tortilla']));
      expect(screen.getByTestId('invent-recipe-list-amount-pork').value).toBe('1 lb');
      expect(screen.getByTestId('invent-recipe-namesave-name').value).toBe('Pork tacos');
      expect(screen.getByTestId('invent-recipe-checklist')).toHaveTextContent('Tacos usually have');
      fireEvent.click(screen.getByTestId('invent-recipe-namesave-save'));
      await waitFor(() => expect(onSave).toHaveBeenCalled());
      expect(onSave.mock.calls[0][0]).toMatchObject({ id: 'inv-1', name: 'Pork tacos', category: 'tacos' });
    });
  });
});
