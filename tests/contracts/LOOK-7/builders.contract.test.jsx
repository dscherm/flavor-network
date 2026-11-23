// @vitest-environment jsdom
// LOOK-7 contract tests (blind): the three builders. Written from plan.md (LOOK-7 AC-1, AC-2, AC-3) and the
// approved brief .schermness/design/LOOK-7.md (sections 3.4, 9, decisions D3). Render setups reused from
// src/components/__tests__/InventCocktail.test.jsx, InventSauce.test.jsx and InventRecipe.test.jsx (same props,
// same mocks, same testids).
//
// Main state (AC-1, AC-3): two ingredients in the list and a name typed -> the save button
// ("Add to my cocktails / sauces / recipes", testid <prefix>-namesave-save) is the one primary.
// Start step (AC-2): the builder freshly opened on its first question -> no primary at all.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react';
import { primaries, expectOnePrimary, expectNoOtherAccentFill } from './helpers.js';

// InventRecipe's models, mocked as InventRecipe.test.jsx does.
const LOGITS = { broccoli: 2, carrot: 0, zucchini: -1 };
const suggest = vi.fn(async (observed, { k }) => Object.entries(LOGITS)
  .filter(([n]) => !observed.includes(n))
  .map(([name, score]) => ({ name, score }))
  .sort((a, b) => b.score - a.score)
  .slice(0, k));
const VOCAB = ['chicken', 'broccoli', 'garlic', 'rice'];
const REC = [{ v: [0, 1, 2, 3], t: 'Chicken Broccoli Stir-fry', d: ['Sear the chicken.', 'Toss it all together.'] }];
vi.mock('../../../src/ml/kitchenRuntime.js', () => ({
  loadInventModel: vi.fn(() => Promise.resolve({ suggest, cuisineVocab: ['Global', 'Italian', 'Chinese', 'Thai'] })),
  loadRealRecipes: vi.fn(async () => ({ index: { recipes: REC, inv: { 0: [0], 1: [0], 2: [0], 3: [0] } }, vocab: VOCAB })),
}));
vi.mock('../../../src/ml/quantityRuntime.js', () => ({
  predictBowlAmounts: vi.fn(async (names) => names.map((name) => ({ name, amount: name === 'chicken' ? { raw: '1 lb', qty: 1, unit: 'lb', inferred: true } : null }))),
}));

import InventCocktail from '../../../src/components/InventCocktail.jsx';
import InventSauce from '../../../src/components/InventSauce.jsx';
import InventRecipe from '../../../src/components/InventRecipe.jsx';
import { buildPairingIndex } from '../../../src/data/recipePairingMatch.js';
import { buildRolePool } from '../../../src/data/cocktailRiff.js';
import { buildCategoryMap } from '../../../src/data/saucePantry.js';

// ---- cocktail fixture (InventCocktail.test.jsx) ----
const ing = (raw) => ({ raw });
const negroni = { name: 'Negroni', ingredients_raw: [ing('1 oz Gin'), ing('1 oz Sweet vermouth'), ing('1 oz Campari')] };
const oldFashioned = { name: 'Old Fashioned', ingredients_raw: [ing('2 oz Bourbon'), ing('1 tsp Simple syrup'), ing('2 dashes Angostura bitters')] };
const roles = {
  gin: { role: 'spirit' }, rye: { role: 'spirit' }, bourbon: { role: 'spirit' },
  'lemon juice': { role: 'sour' }, 'lime juice': { role: 'sour' }, 'simple syrup': { role: 'sweet' },
  'sweet vermouth': { role: 'vermouth' }, campari: { role: 'amaro_liqueur' }, 'triple sec': { role: 'amaro_liqueur' },
  'soda water': { role: 'modifier' }, 'angostura bitters': { role: 'bitter' },
};
const index = buildPairingIndex([
  { source: 'gin', target: 'campari', strength: 0.8, known: true },
  { source: 'gin', target: 'sweet vermouth', strength: 0.8, known: true },
  { source: 'campari', target: 'sweet vermouth', strength: 0.9, known: true },
  { source: 'gin', target: 'lemon juice', strength: 0.6, known: true },
  { source: 'bourbon', target: 'simple syrup', strength: 0.7, known: true },
  { source: 'bourbon', target: 'angostura bitters', strength: 0.7, known: true },
], Object.keys(roles));
const pool = buildRolePool(roles, index.names);
const cFamilies = [{ id: 2, name: 'Sour Family', color: '#a16207' }, { id: 4, name: 'Aromatic Stirred', color: '#7c3aed' }, { id: 3, name: 'Boozy Sippers', color: '#92400e' }];
const BAR = ['gin', 'campari', 'sweet vermouth', 'lemon juice', 'simple syrup'];
const cNodes = new Map([
  ['lemon juice', { taste: 'sour' }], ['simple syrup', { taste: 'sweet' }],
  ['gin', { taste: 'bitter' }], ['sweet vermouth', { taste: 'sweet bitter' }], ['campari', { taste: 'bitter sweet sour' }],
]);
const renderCocktail = (props = {}) => render(<InventCocktail bar={BAR} cocktails={[negroni, oldFashioned]}
  families={cFamilies} roles={roles} pool={pool} pairingIndex={index} nodes={cNodes} onClose={vi.fn()} onSave={vi.fn()} {...props} />);

// ---- sauce fixture (InventSauce.test.jsx) ----
const meta = [
  { name: 'butter', category: 'Fat' }, { name: 'olive oil', category: 'Fat' },
  { name: 'flour', category: 'Thickener' }, { name: 'egg yolk', category: 'Thickener' },
  { name: 'milk', category: 'Liquid' }, { name: 'cream', category: 'Liquid' }, { name: 'chicken stock', category: 'Liquid' },
  { name: 'lemon juice', category: 'Acid' }, { name: 'white wine vinegar', category: 'Acid' }, { name: 'tomato', category: 'Acid' },
  { name: 'shallot', category: 'Aromatic' }, { name: 'garlic', category: 'Aromatic' }, { name: 'onion', category: 'Aromatic' },
  { name: 'tarragon', category: 'Herb' }, { name: 'nutmeg', category: 'Seasoning' }, { name: 'cumin', category: 'Seasoning' },
];
const catMap = buildCategoryMap(meta);
const sFamilies = [
  { id: 0, name: 'Béchamel', color: '#f5f0d6' }, { id: 1, name: 'Velouté', color: '#e8c989' }, { id: 2, name: 'Espagnole', color: '#a05a2c' },
  { id: 3, name: 'Hollandaise', color: '#f3d44e' }, { id: 4, name: 'Tomato', color: '#d94a3d' },
];
const sauces = [
  { name: 'Hollandaise', family_id: 3, ingredients: ['egg yolk', 'butter', 'lemon juice', 'salt'], proteins: ['salmon', 'eggs'] },
  { name: 'Béchamel', family_id: 0, ingredients: ['butter', 'flour', 'milk', 'nutmeg'], proteins: ['chicken'] },
  { name: 'Marinara', family_id: 4, ingredients: ['olive oil', 'tomato', 'garlic'], proteins: ['chicken'] },
];
const PANTRY = ['butter', 'egg yolk', 'lemon', 'shallot', 'cream', 'tomato', 'garlic'];
const renderSauce = (props = {}) => render(<InventSauce kitchen={PANTRY} sauces={sauces} families={sFamilies} meta={meta}
  catMap={catMap} wineStyles={null} onClose={vi.fn()} onSave={vi.fn()} {...props} />);

// ---- recipe fixture (InventRecipe.test.jsx) ----
const NODES = new Map([
  ['chicken', { category: 'protein', cuisines: ['italian cuisine'], taste: 'umami sweet', gnnProbs: { odor_fruity: 0.4 } }],
  ['tofu', { category: 'protein', cuisines: [] }],
  ['broccoli', { category: 'vegetable', cuisines: [] }],
  ['carrot', { category: 'vegetable', cuisines: [] }],
  ['garlic', { category: 'aromatic', cuisines: [] }],
  ['ginger', { category: 'aromatic', cuisines: [] }],
  ['soy sauce', { category: 'condiment', cuisines: [] }],
  ['rice', { category: 'grain', cuisines: [] }],
]);
const renderRecipe = (props = {}) => render(<InventRecipe kitchen={[...NODES.keys()]} nodes={NODES} edges={null}
  onClose={vi.fn()} onWrite={vi.fn()} onEditKitchen={vi.fn()} onSave={vi.fn(async () => ({ status: 'saved' }))} {...props} />);

const type = (testid, value) => fireEvent.change(screen.getByTestId(testid), { target: { value } });

const BUILDERS = [
  {
    label: 'cocktail builder',
    render: renderCocktail,
    startStep: () => screen.getByTestId('invent-start-question'),
    fill: async () => {
      type('invent-start-input', 'gin');
      fireEvent.submit(screen.getByTestId('invent-start-input').closest('form'));
      type('invent-list-add-input', 'campari');
      fireEvent.submit(screen.getByTestId('invent-list-add-input').closest('form'));
      expect(screen.getAllByTestId('invent-list-line')).toHaveLength(2);
      type('invent-namesave-name', 'Garden Bitter');
      return screen.getByTestId('invent-namesave-save');
    },
  },
  {
    label: 'sauce builder',
    render: renderSauce,
    startStep: () => screen.getByTestId('sauce-invent-start'),
    fill: async () => {
      type('sauce-invent-start-input', 'butter');
      fireEvent.click(screen.getByTestId('sauce-invent-start-go'));
      type('sauce-invent-list-add-input', 'lemon juice');
      fireEvent.click(screen.getByTestId('sauce-invent-list-add'));
      expect(screen.getAllByTestId('sauce-invent-list-line')).toHaveLength(2);
      type('sauce-invent-namesave-name', 'My butter sauce');
      return screen.getByTestId('sauce-invent-namesave-save');
    },
  },
  {
    label: 'recipe builder',
    render: renderRecipe,
    startStep: () => screen.getByTestId('invent-recipe-start-question'),
    fill: async () => {
      type('invent-recipe-start-input', 'chicken');
      fireEvent.click(screen.getByTestId('invent-recipe-start-go'));
      type('invent-recipe-list-add-input', 'garlic');
      fireEvent.click(screen.getByTestId('invent-recipe-list-add'));
      expect(screen.getAllByTestId('invent-recipe-list-line')).toHaveLength(2);
      type('invent-recipe-namesave-name', 'Weeknight chicken');
      // let the cuisine row and the model-driven suggestions settle
      await screen.findByRole('group', { name: 'Cuisine' });
      return screen.getByTestId('invent-recipe-namesave-save');
    },
  },
];

beforeEach(() => { try { localStorage.clear(); } catch { /* */ } });
afterEach(cleanup);

describe.each(BUILDERS)('LOOK-7 $label', ({ label, render: mount, startStep, fill }) => {
  // Covers: AC-1
  it('with two ingredients and a name has exactly one primary, the save, filled with the accent', async () => {
    const { container } = mount();
    const save = await fill();
    await waitFor(() => expect(save).not.toBeDisabled());
    const p = expectOnePrimary(expect, container, `${label}, two ingredients and a name`);
    expect(p).toBe(save);
  });

  // Covers: AC-3
  it('with two ingredients and a name nothing other than the primary has the accent as its background', async () => {
    const { container } = mount();
    const save = await fill();
    await waitFor(() => expect(save).not.toBeDisabled());
    expectNoOtherAccentFill(expect, container, `${label}, two ingredients and a name`);
  });

  // Covers: AC-2
  it('on its start step has no primary', () => {
    const { container } = mount();
    expect(startStep()).toBeTruthy();
    expect(primaries(container)).toHaveLength(0);
  });
});
