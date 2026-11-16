// @vitest-environment jsdom
// BUILDER-2: what the chalkboard recipe builder took over from the Recipe Notebook (models and the card mocked).
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

const LOGITS = { broccoli: 2, carrot: 1, zucchini: 0.5, onion: 0.2 };
const defaultSuggest = async (observed, { k }) => Object.entries(LOGITS)
  .filter(([n]) => !observed.includes(n))
  .map(([name, score]) => ({ name, score }))
  .sort((a, b) => b.score - a.score)
  .slice(0, k);
const suggest = vi.fn(defaultSuggest);
let modelResult;
const VOCAB = ['chicken', 'broccoli', 'garlic', 'rice'];
vi.mock('../../ml/kitchenRuntime.js', () => ({
  loadInventModel: vi.fn(() => modelResult),
  loadRealRecipes: vi.fn(async () => ({ index: { recipes: [], inv: {} }, vocab: VOCAB })),
}));
vi.mock('../../ml/quantityRuntime.js', () => ({
  predictBowlAmounts: vi.fn(async (names) => names.map((name) => ({ name, amount: name === 'chicken' ? { raw: '1 lb', qty: 1, unit: 'lb', inferred: true } : null }))),
}));
vi.mock('../../ml/directionsRuntime.js', () => ({
  loadDirectionsIndex: vi.fn(async () => ({ recipes: [], inv: {} })),
  retrieveCookingMethods: vi.fn(() => ({ methods: [{ method: 'sear', frac: 0.6 }, { method: 'roast', frac: 0.4 }] })),
}));

let cardProps = null;
vi.mock('../RecipeFlavorProfilesCard.jsx', () => ({
  default: (props) => {
    cardProps = props;
    return (
      <div data-testid="card-stub">
        <button type="button" data-testid="card-boost" onClick={() => props.onAdd('onion', { raw: '1 medium', qty: 1, unit: 'medium', inferred: true })}>boost onion</button>
        <button type="button" data-testid="card-cocktail" onClick={() => props.onFindCocktail?.()}>cocktail</button>
        <button type="button" data-testid="card-sauce" onClick={() => props.onFindSauce?.()}>sauce</button>
        <button type="button" data-testid="card-wine" onClick={() => props.onFindWine?.()}>wine</button>
        <button type="button" data-testid="card-close" onClick={props.onClose}>close</button>
      </div>
    );
  },
}));

// RecipeCookingMethod caches its vocabulary fetch for the life of the module, so the stub is in place before any test runs.
vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => ({ vocab: VOCAB }) })));

import InventRecipe from '../InventRecipe.jsx';

const NODES = new Map([
  ['chicken', { category: 'protein', cuisines: [], taste: 'umami sweet' }],
  ['broccoli', { category: 'vegetable', cuisines: [], taste: 'bitter' }],
  ['carrot', { category: 'vegetable', cuisines: [], taste: 'sweet' }],
  ['zucchini', { category: 'vegetable', cuisines: [] }],
  ['garlic', { category: 'aromatic', cuisines: [], taste: 'pungent' }],
  ['onion', { category: 'aromatic', cuisines: [], taste: 'sweet pungent' }],
  ['rice', { category: 'grain', cuisines: [] }],
]);
const ALL = [...NODES.keys()];
const P = 'invent-recipe';

function mount(props = {}) {
  render(<InventRecipe kitchen={ALL} nodes={NODES} edges={null} onClose={vi.fn()} onWrite={vi.fn()} onEditKitchen={vi.fn()} {...props} />);
}
const seeded = (...keys) => ({ pinned: keys.map((key) => ({ key, source: 'search' })) });
const lineKeys = () => screen.queryAllByTestId(`${P}-list-line`).map((r) => r.getAttribute('data-key'));
const chipKeys = () => screen.queryAllByTestId(`${P}-suggest-item`).map((b) => b.getAttribute('data-key'));

describe('InventRecipe: Flavor Profiles card', () => {
  beforeEach(() => {
    cardProps = null;
    suggest.mockImplementation(defaultSuggest);
    modelResult = Promise.resolve({ suggest, cuisineVocab: ['Global'] });
  });

  it('the button needs three ingredients, then opens the card with the build and its amounts', async () => {
    mount({ seed: seeded('chicken', 'garlic') });
    expect(screen.queryByTestId(`${P}-profiles`)).toBeNull();
    fireEvent.change(screen.getByTestId(`${P}-list-add-input`), { target: { value: 'rice' } });
    fireEvent.click(screen.getByTestId(`${P}-list-add`));
    await waitFor(() => expect(screen.getByTestId(`${P}-profiles`)).toBeInTheDocument());
    fireEvent.click(screen.getByTestId(`${P}-profiles`));
    await screen.findByTestId('card-stub');
    expect(cardProps.bowlNames).toEqual(['chicken', 'garlic', 'rice']);
    await waitFor(() => expect(cardProps.bowlEntries.find((e) => e.ingredient === 'chicken').amount?.raw).toBe('1 lb'));
    fireEvent.click(screen.getByTestId('card-close'));
    expect(screen.queryByTestId('card-stub')).toBeNull();
  });

  it('a Boost chip adds its ingredient to the build with the amount the card passes', async () => {
    mount({ seed: seeded('chicken', 'garlic', 'rice') });
    fireEvent.click(await screen.findByTestId(`${P}-profiles`));
    fireEvent.click(await screen.findByTestId('card-boost'));
    expect(lineKeys()).toEqual(['chicken', 'garlic', 'rice', 'onion']);
    await waitFor(() => expect(cardProps.bowlEntries.find((e) => e.ingredient === 'onion').amount.raw).toBe('1 medium'));
  });

  it('the card and the builder buttons call the handlers with the build names and the title', async () => {
    const onFindCocktail = vi.fn(); const onFindSauce = vi.fn(); const onFindWine = vi.fn();
    mount({ seed: seeded('chicken', 'garlic', 'rice'), onFindCocktail, onFindSauce, onFindWine });
    fireEvent.click(screen.getByTestId(`${P}-find-cocktail`));
    fireEvent.click(screen.getByTestId(`${P}-find-sauce`));
    fireEvent.click(screen.getByTestId(`${P}-find-wine`));
    for (const f of [onFindCocktail, onFindSauce, onFindWine]) expect(f).toHaveBeenLastCalledWith(['chicken', 'garlic', 'rice'], '');
    fireEvent.click(screen.getByTestId(`${P}-profiles`));
    fireEvent.click(await screen.findByTestId('card-cocktail'));
    fireEvent.click(screen.getByTestId('card-sauce'));
    fireEvent.click(screen.getByTestId('card-wine'));
    expect(onFindCocktail).toHaveBeenCalledTimes(2);
    expect(onFindSauce).toHaveBeenCalledTimes(2);
    expect(onFindWine).toHaveBeenCalledTimes(2);
  });

  it('a missing handler hides its button', () => {
    mount({ seed: seeded('chicken', 'garlic', 'rice'), onFindWine: vi.fn() });
    expect(screen.queryByTestId(`${P}-find-cocktail`)).toBeNull();
    expect(screen.queryByTestId(`${P}-find-sauce`)).toBeNull();
    expect(screen.getByTestId(`${P}-find-wine`)).toBeInTheDocument();
  });
});

describe('InventRecipe: model suggestions and smart swaps', () => {
  beforeEach(() => {
    suggest.mockImplementation(defaultSuggest);
    modelResult = Promise.resolve({ suggest, cuisineVocab: ['Global'] });
  });

  it("the model's picks join the list without duplicates, kitchen first", async () => {
    mount({ seed: seeded('chicken'), kitchen: ['chicken', 'broccoli', 'carrot', 'garlic', 'rice'] });
    await waitFor(() => expect(chipKeys()).toContain('broccoli'));
    const keys = chipKeys();
    expect(new Set(keys).size).toBe(keys.length);
    // zucchini and onion are not in the kitchen: they may appear, but only after every owned suggestion
    const owned = screen.queryAllByTestId(`${P}-suggest-item`).map((b) => !b.textContent.includes("you'd need"));
    const firstNot = owned.indexOf(false);
    expect(owned.slice(0, firstNot < 0 ? owned.length : firstNot).every(Boolean)).toBe(true);
    if (firstNot >= 0) expect(owned.slice(firstNot).some(Boolean)).toBe(false);
  });

  it('with no model the list still fills from the pairing index', async () => {
    modelResult = Promise.resolve(null);
    mount({ seed: seeded('chicken') });
    expect(await screen.findByTestId(`${P}-no-model`)).toBeInTheDocument();
    await waitFor(() => expect(chipKeys().length).toBeGreaterThan(0));
  });

  it("a line the cook lacks gets the model's same-category stand-ins they own", async () => {
    mount({ seed: seeded('chicken', 'zucchini'), kitchen: ['chicken', 'broccoli', 'garlic'] });
    fireEvent.click(await screen.findByTestId(`${P}-list-need-zucchini`));
    await waitFor(() => {
      const opts = screen.queryAllByTestId(`${P}-list-replace-option`).map((b) => b.textContent);
      expect(opts.some((t) => t.includes('broccoli'))).toBe(true);
    });
    expect(suggest).toHaveBeenCalledWith(expect.not.arrayContaining(['zucchini']), expect.objectContaining({ candidateNames: expect.arrayContaining(['broccoli', 'carrot']) }));
    expect(screen.queryAllByTestId(`${P}-list-replace-option`).every((b) => !b.textContent.includes('garlic'))).toBe(true);
  });
});

describe('InventRecipe: cooking method chips and the handoff', () => {
  beforeEach(() => {
    suggest.mockImplementation(defaultSuggest);
    modelResult = Promise.resolve({ suggest, cuisineVocab: ['Global'] });
  });

  it('chips render for three or more ingredients and the selection survives adding another', async () => {
    mount({ seed: seeded('chicken', 'garlic') });
    expect(screen.queryByTestId('cooking-method-chips')).toBeNull();
    fireEvent.change(screen.getByTestId(`${P}-list-add-input`), { target: { value: 'rice' } });
    fireEvent.click(screen.getByTestId(`${P}-list-add`));
    const chips = await screen.findAllByTestId('cooking-method-chip');
    expect(chips.map((c) => c.dataset.method)).toEqual(['sear', 'roast']);
    fireEvent.click(chips[0]);
    expect(screen.getAllByTestId('cooking-method-chip')[0]).toHaveAttribute('aria-pressed', 'true');
    fireEvent.change(screen.getByTestId(`${P}-list-add-input`), { target: { value: 'onion' } });
    fireEvent.click(screen.getByTestId(`${P}-list-add`));
    await waitFor(() => expect(lineKeys()).toContain('onion'));
    expect(screen.getAllByTestId('cooking-method-chip')[0]).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getAllByTestId('cooking-method-chip')[1]).toHaveAttribute('aria-pressed', 'false');
  });

  it('shows a handoff\'s steps (collapsed) and its picture, and the picture can be removed', () => {
    mount({ seed: { ...seeded('chicken', 'garlic'), steps: ['Sear the chicken.', 'Add garlic.'], stepsFrom: 'Garlic Chicken', image: 'data:image/png;base64,AAAA' } });
    const method = screen.getByTestId(`${P}-handoff-method`);
    expect(method).toHaveTextContent('Method (2 steps)');
    expect(method).toHaveTextContent('Garlic Chicken');
    expect(screen.queryByTestId(`${P}-handoff-steps`)).toBeNull();
    fireEvent.click(method.querySelector('button'));
    expect(screen.getByTestId(`${P}-handoff-steps`).querySelectorAll('li')).toHaveLength(2);
    expect(screen.getByTestId(`${P}-photo-img`)).toHaveAttribute('src', 'data:image/png;base64,AAAA');
    fireEvent.click(screen.getByTestId(`${P}-photo-remove`));
    expect(screen.queryByTestId(`${P}-photo`)).toBeNull();
  });

  it('a pinned line can carry its amount', () => {
    mount({ seed: { pinned: [{ key: 'chicken', source: 'search', amount: '2 lb' }] } });
    expect(screen.getByTestId(`${P}-list-amount-chicken`)).toHaveValue('2 lb');
  });
});
