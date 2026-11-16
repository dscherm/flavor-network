// @vitest-environment jsdom
// FLAVOR-6: Beef Bolognese in the Recipe Lab invent panel leads with the same tastes as the recipe itself.
// The invent panel weighs the amounts the (mocked) quantity model predicts; here those are the recipe's own
// amounts, so the inputs match. With the model's real amounts the lead can legitimately move.
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

const AMOUNTS = {};
vi.mock('../ml/kitchenRuntime.js', () => ({
  loadInventModel: vi.fn(async () => null),
  loadRealRecipes: vi.fn(async () => null),
}));
vi.mock('../ml/quantityRuntime.js', () => ({
  predictBowlAmounts: vi.fn(async (names) => names.map((name) => ({ name, amount: AMOUNTS[name] ?? null }))),
}));

import InventRecipe from '../components/InventRecipe.jsx';
import { SEED_RECIPES } from '../data/seedRecipes.js';
import { RECIPE_DETAILS } from '../data/seedRecipeDetails.js';
import { resolveBuiltIn } from '../data/sharedRecipe.js';
import { groupBars } from '../data/flavorDisplay.js';
import { profileForRecipe } from '../data/shareCardData.js';
import { parseAmountText } from '../data/amountGrams.js';
import { loadFlavorNodes } from '../../scripts/lib/flavorNodes.mjs';

const nodes = loadFlavorNodes();
const recipe = resolveBuiltIn('dish', 'beef-bolognese', { dishes: SEED_RECIPES, dishDetails: RECIPE_DETAILS });
for (const l of recipe.lines) { const a = parseAmountText(l.amount); if (a) AMOUNTS[l.key] = { raw: l.amount, ...a, inferred: true }; }

describe('Beef Bolognese in the Recipe Lab invent panel', () => {
  it('leads with the same two tastes and two aromas as the recipe', async () => {
    const keys = new Set(recipe.lines.map((l) => l.key));
    const kitchenNodes = new Map([...nodes].filter(([k]) => keys.has(k)).map(([k, v]) => [k, { ...v, category: 'protein', cuisines: [] }]));
    render(<InventRecipe kitchen={[...kitchenNodes.keys()]} nodes={kitchenNodes} edges={null} onClose={vi.fn()} onWrite={vi.fn()} onEditKitchen={vi.fn()} />);
    fireEvent.change(screen.getByTestId('invent-recipe-start-input'), { target: { value: recipe.lines[0].key } });
    fireEvent.click(screen.getByTestId('invent-recipe-start-go'));
    for (const l of recipe.lines.slice(1)) {
      fireEvent.change(screen.getByTestId('invent-recipe-list-add-input'), { target: { value: l.key } });
      fireEvent.click(screen.getByTestId('invent-recipe-list-add'));
    }
    await screen.findByTestId('invent-recipe-profile');
    await new Promise((r) => setTimeout(r, 50));
    const axes = screen.getAllByTestId(/^invent-recipe-profile-bar-/).map((b) => b.getAttribute('data-testid').replace('invent-recipe-profile-bar-', ''));
    const truth = profileForRecipe(recipe, nodes).bars.map((b) => b.axis);
    const tastes = (a) => a.filter((x) => !x.startsWith('odor_')).slice(0, 2);
    const aromas = (a) => a.filter((x) => x.startsWith('odor_')).slice(0, 2);
    const ruled = groupBars(profileForRecipe(recipe, nodes).bars, 'full').bars.map((b) => b.axis);
    expect(tastes(axes).length).toBe(2);
    expect(tastes(axes)).toEqual(tastes(ruled));
    expect(aromas(axes)).toEqual(aromas(ruled));
  });
});
