// @vitest-environment jsdom
// BUILDER-3: what the chalkboard recipe builder needs to be the Recipe Notebook tab: a handed-over title,
// dish type and cuisine, the photo going to the picture chooser, and saving a recipe the old Notebook kept (names only).
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

let modelResult;
vi.mock('../../ml/kitchenRuntime.js', () => ({
  loadInventModel: vi.fn(() => modelResult),
  loadRealRecipes: vi.fn(async () => ({ index: { recipes: [], inv: {} }, vocab: [] })),
}));
vi.mock('../../ml/quantityRuntime.js', () => ({
  predictBowlAmounts: vi.fn(async (names) => names.map((name) => ({ name, amount: null }))),
}));
vi.mock('../../ml/directionsRuntime.js', () => ({
  loadDirectionsIndex: vi.fn(async () => ({ recipes: [], inv: {} })),
  retrieveCookingMethods: vi.fn(() => ({ methods: [] })),
  retrieveDirections: vi.fn(() => []),
}));
vi.mock('../RecipeFlavorProfilesCard.jsx', () => ({ default: () => null }));
vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => ({ vocab: [] }) })));

const pictureProps = { current: null };
vi.mock('../PictureField.jsx', () => ({
  default: (props) => { pictureProps.current = props; return <div data-testid="picture-field-stub" data-has-photo={String(!!props.initialPhoto)} />; },
}));

import InventRecipe from '../InventRecipe.jsx';
import { inventionHandoff, seedFromHandoff, handoffFromProfileRecipe } from '../../data/inventRecipe.js';

const NODES = new Map([
  ['chicken', { category: 'protein', cuisines: [] }],
  ['broccoli', { category: 'vegetable', cuisines: [] }],
  ['garlic', { category: 'aromatic', cuisines: [] }],
  ['soy sauce', { category: 'condiment', cuisines: [] }],
  ['rice', { category: 'grain', cuisines: [] }],
]);
const P = 'invent-recipe';
const lineKeys = () => screen.queryAllByTestId(`${P}-list-line`).map((r) => r.getAttribute('data-key'));
const mount = (props = {}) => render(<InventRecipe kitchen={[]} nodes={NODES} edges={null} onClose={vi.fn()} {...props} />);

beforeEach(() => {
  pictureProps.current = null;
  modelResult = Promise.resolve({ suggest: async () => [], cuisineVocab: ['Global', 'Thai', 'Italian'] });
});

describe('InventRecipe: opened from a handoff', () => {
  it('an invention handed over keeps its lines, amounts, name, dish type and cuisine', async () => {
    const amounts = new Map([['chicken', { raw: '1 lb', qty: 1, unit: 'lb', inferred: false }]]);
    const handoff = inventionHandoff(
      { name: 'Wok night', ingredients: [{ name: 'chicken' }, { name: 'broccoli' }, { name: 'garlic' }], type: 'stir-fry', cuisine: 'Thai' },
      { amounts },
    );
    mount({ seed: seedFromHandoff(handoff), onSave: vi.fn() });
    expect(lineKeys()).toEqual(['chicken', 'broccoli', 'garlic']);
    expect(screen.getByTestId(`${P}-list-amount-chicken`)).toHaveValue('1 lb');
    expect(screen.getByTestId(`${P}-namesave-name`)).toHaveValue('Wok night');
    expect(screen.getByTestId(`${P}-dishline`)).toHaveTextContent('Thai stir-fry');
    expect(screen.getByTestId(`${P}-checklist`)).toHaveTextContent('Stir-fry');
    await waitFor(() => expect(screen.getByRole('button', { name: 'Thai' })).toHaveAttribute('aria-pressed', 'true'));
  });

  it('a handoff with no dish type opens with no dish chosen', () => {
    mount({ seed: seedFromHandoff({ ingredients: ['chicken', 'rice'], title: 'Plain' }), onSave: vi.fn() });
    expect(screen.queryByTestId(`${P}-checklist`)).toBeNull();
    expect(screen.getByTestId(`${P}-namesave-name`)).toHaveValue('Plain');
  });

  it('a handoff with no ingredients (a photo) opens at the first question', () => {
    mount({ seed: seedFromHandoff({ source: 'make-photo', ingredients: [], image: 'data:image/png;base64,AAAA' }) });
    expect(screen.getByTestId(`${P}-start-question`)).toBeInTheDocument();
  });
});

describe('InventRecipe: saving a recipe the old Notebook saved (names only)', () => {
  it('the save carries replacesName and no id, so the profile replaces it instead of adding a second', async () => {
    const onSave = vi.fn(async () => ({ status: 'saved' }));
    const h = handoffFromProfileRecipe({ name: 'Old Soup', ingredients: [{ name: 'chicken', raw: 'chicken' }, { name: 'rice', raw: 'rice' }] });
    mount({ seed: seedFromHandoff(h), onSave });
    expect(screen.getByTestId(`${P}-namesave-name`)).toHaveValue('Old Soup');
    fireEvent.change(screen.getByTestId(`${P}-namesave-name`), { target: { value: 'Chicken and Rice' } });
    fireEvent.click(screen.getByTestId(`${P}-namesave-save`));
    await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1));
    const input = onSave.mock.calls[0][0];
    expect(input).toMatchObject({ kind: 'recipe', name: 'Chicken and Rice', replacesName: 'Old Soup' });
    expect(input.id).toBeUndefined();
    expect(input.lines.map((l) => l.key)).toEqual(['chicken', 'rice']);
  });

  it('an invention reopened from the profile saves under its own id and never asks to replace by name', async () => {
    const onSave = vi.fn(async () => ({ status: 'saved' }));
    const h = handoffFromProfileRecipe({ id: 'inv-7', source: 'invent', name: 'Mine', ingredients: [{ name: 'chicken', raw: '2 chicken' }, { name: 'rice', raw: 'rice' }] });
    mount({ seed: seedFromHandoff(h), onSave });
    expect(screen.getByRole('heading', { level: 2 })).toHaveTextContent('Edit your recipe');
    fireEvent.click(screen.getByTestId(`${P}-namesave-save`));
    await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1));
    expect(onSave.mock.calls[0][0]).toMatchObject({ id: 'inv-7', name: 'Mine' });
    expect(onSave.mock.calls[0][0].replacesName).toBeUndefined();
  });

  it('Start over forgets the old recipe being replaced', async () => {
    const onSave = vi.fn(async () => ({ status: 'saved' }));
    const h = handoffFromProfileRecipe({ name: 'Old Soup', ingredients: [{ name: 'chicken', raw: 'chicken' }, { name: 'rice', raw: 'rice' }] });
    mount({ seed: seedFromHandoff(h), onSave });
    fireEvent.click(screen.getByTestId(`${P}-restart`));
    fireEvent.change(screen.getByTestId(`${P}-start-input`), { target: { value: 'chicken' } });
    fireEvent.click(screen.getByTestId(`${P}-start-go`));
    fireEvent.change(screen.getByTestId(`${P}-list-add-input`), { target: { value: 'rice' } });
    fireEvent.click(screen.getByTestId(`${P}-list-add`));
    fireEvent.change(screen.getByTestId(`${P}-namesave-name`), { target: { value: 'Brand New' } });
    fireEvent.click(screen.getByTestId(`${P}-namesave-save`));
    await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1));
    expect(onSave.mock.calls[0][0].replacesName).toBeUndefined();
  });
});

describe('InventRecipe: the handoff photo and the picture chooser', () => {
  const file = () => new File(['x'], 'dish.jpg', { type: 'image/jpeg' });
  beforeEach(() => {
    URL.createObjectURL = vi.fn(() => 'blob:photo');
    URL.revokeObjectURL = vi.fn();
  });

  it('a photo handed over is offered to the chooser; the original is not saved with the recipe', async () => {
    const f = file();
    const onSave = vi.fn(async () => ({ status: 'saved' }));
    mount({ seed: seedFromHandoff({ ingredients: ['chicken', 'rice'], title: 'Dish', image: f }), onSave });
    expect(pictureProps.current.initialPhoto).toBe(f);
    fireEvent.click(screen.getByTestId(`${P}-namesave-save`));
    await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1));
    expect(onSave.mock.calls[0][0].picture).toBeUndefined();
    expect(JSON.stringify(onSave.mock.calls[0][0])).not.toContain('blob:photo');
  });

  it('removing the photo stops offering it; a photo that is only a URL is display only', () => {
    const f = file();
    mount({ seed: seedFromHandoff({ ingredients: ['chicken', 'rice'], title: 'Dish', image: f }), onSave: vi.fn() });
    fireEvent.click(screen.getByTestId(`${P}-photo-remove`));
    expect(pictureProps.current.initialPhoto).toBeNull();
  });

  it('a URL image is shown but not handed to the chooser', () => {
    mount({ seed: seedFromHandoff({ ingredients: ['chicken', 'rice'], image: 'data:image/png;base64,AAAA' }), onSave: vi.fn() });
    expect(screen.getByTestId(`${P}-photo-img`)).toBeInTheDocument();
    expect(pictureProps.current.initialPhoto).toBeNull();
  });
});
