// @vitest-environment jsdom
// LOOK-7 contract tests (blind): the shopping list and the Flavor Profiles card. Written from plan.md
// (LOOK-7 AC-1, AC-2, AC-3) and the approved brief .schermness/design/LOOK-7.md (sections 3.5, 3.6, 9,
// decisions D3, D6). Render setups reused from src/components/__tests__/ShoppingList.test.jsx (the Harness that
// holds state through commitList) and RecipeFlavorProfilesCard.test.jsx (nodes from curated taste labels).
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { useState } from 'react';
import { primaries, expectOnePrimary, expectNoOtherAccentFill } from './helpers.js';

import ShoppingList from '../../../src/components/ShoppingList.jsx';
import RecipeFlavorProfilesCard from '../../../src/components/RecipeFlavorProfilesCard.jsx';
import { commitList, emptyShopping } from '../../../src/data/shoppingStore.js';
import { addLine } from '../../../src/data/shoppingList.js';
import { resetShoppingIngredients } from '../../../src/data/shoppingIngredients.js';
import { AXES } from '../../../src/data/recipeProfileAnalysis.js';

// ---- shopping list (ShoppingList.test.jsx) ----
const CATS = new Map([['milk', 'dairy'], ['cheddar', 'dairy'], ['garlic', 'aromatic'], ['onion', 'aromatic'], ['vodka', 'spirit'], ['cumin', 'spice']]);
const INGREDIENTS = { names: new Set(CATS.keys()), vocab: [...CATS.keys()].sort(), categories: CATS };
const loadIngredients = () => Promise.resolve(INGREDIENTS);
function Harness({ initial = emptyShopping() }) {
  const [state, setState] = useState(initial);
  return <ShoppingList shopping={state} onChange={(change, opts) => setState((s) => { const next = change(s.list); return next === s.list ? s : commitList(s, next, opts); })} onClose={() => {}} loadIngredients={loadIngredients} />;
}
const stateWith = (lines) => {
  let list = { items: [], recipes: [] };
  let n = 0;
  for (const l of lines) list = addLine(list, l, { now: 1000 + n, newId: () => `i${n++}`, names: INGREDIENTS.names }).list;
  return { list, removed: {} };
};
const TWO = () => stateWith([
  { key: 'cheddar', label: 'cheddar', amount: '200 g' },
  { key: 'milk', label: 'milk', amount: '2 cups' },
]);

// ---- Flavor Profiles card (RecipeFlavorProfilesCard.test.jsx) ----
const probs = () => Object.fromEntries(AXES.map((a) => [a, 0]));
const NODES = new Map([
  ['strawberry', { taste: 'sweet', gnnProbs: probs() }],
  ['cranberry', { taste: 'sour', gnnProbs: probs() }],
  ['coconut cream', { taste: 'rich sweet', gnnProbs: probs() }],
]);

beforeEach(() => {
  try { localStorage.clear(); } catch { /* */ }
  resetShoppingIngredients();
  global.fetch = vi.fn(() => Promise.resolve({ ok: false }));
});
afterEach(cleanup);

describe('LOOK-7 shopping list', () => {
  // Covers: AC-1
  it('with two items has exactly one primary: a button filled with the accent (Add from a recipe)', async () => {
    const { container } = render(<Harness initial={TWO()} />);
    await screen.findByTestId('shopping-row-cheddar');
    const p = expectOnePrimary(expect, container, 'shopping list, two items');
    // Brief D6: the shopping list's one filled button is "Add from a recipe".
    expect(p.textContent).toMatch(/Add from a recipe/i);
  });

  // Covers: AC-3
  it('with two items nothing other than the primary has the accent as its background (US selected included)', async () => {
    const { container } = render(<Harness initial={TWO()} />);
    await screen.findByTestId('shopping-row-cheddar');
    expectNoOtherAccentFill(expect, container, 'shopping list, US selected');
    fireEvent.click(screen.getByTestId('shopping-units-metric'));
    expectNoOtherAccentFill(expect, container, 'shopping list, Metric selected');
    expect(primaries(container)).toHaveLength(1);
  });
});

describe('LOOK-7 Flavor Profiles card', () => {
  // Covers: AC-2
  it('has no primary on any of its pages', () => {
    const { container } = render(<RecipeFlavorProfilesCard bowlNames={['strawberry', 'cranberry', 'coconut cream']} nodes={NODES} />);
    expect(screen.getByText('Flavor notes')).toBeInTheDocument();
    expect(primaries(container)).toHaveLength(0);
    for (let i = 0; i < 20; i += 1) {
      const next = screen.queryByLabelText('Next');
      if (!next || next.disabled || next.getAttribute('aria-disabled') === 'true') break;
      fireEvent.click(next);
      expect(primaries(container), `page ${i + 2}`).toHaveLength(0);
    }
  });
});
