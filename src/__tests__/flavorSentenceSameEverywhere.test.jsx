// @vitest-environment jsdom
// CHART-3: the tasting-note sentence is the same on the shared page, behind the Flavor profile button and in an invent
// panel, for two named built-in recipes; and each surface reaches the wheel by dot, swipe and keyboard.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

const AMOUNTS = {};
vi.mock('../ml/kitchenRuntime.js', () => ({ loadInventModel: vi.fn(async () => null), loadRealRecipes: vi.fn(async () => null) }));
vi.mock('../ml/quantityRuntime.js', () => ({
  predictBowlAmounts: vi.fn(async (names) => names.map((name) => ({ name, amount: AMOUNTS[name] ?? null }))),
}));
vi.mock('../hooks/useAuth.js', () => ({ default: () => ({ user: null, loading: false, authError: null, loginWithGoogle: vi.fn(), loginWithApple: vi.fn() }) }));
vi.mock('../hooks/useUserProfile.js', () => ({ default: () => ({ profile: {}, saveInvention: vi.fn() }) }));
vi.mock('../components/NetworkScene.jsx', () => ({ default: () => null }));

import SharedRecipePage from '../components/SharedRecipePage.jsx';
import LabNodeCard from '../components/LabNodeCard.jsx';
import InventRecipe from '../components/InventRecipe.jsx';
import { flavorNote } from '../data/flavorCharts.js';
import { SEED_RECIPES } from '../data/seedRecipes.js';
import { RECIPE_DETAILS } from '../data/seedRecipeDetails.js';
import { resolveBuiltIn } from '../data/sharedRecipe.js';
import { profileForRecipe } from '../data/shareCardData.js';
import { parseAmountText } from '../data/amountGrams.js';
import { loadFlavorNodes } from '../../scripts/lib/flavorNodes.mjs';
import { readCuratedCodex } from '../../scripts/lib/curatedCodex.mjs';

const codex = readCuratedCodex();
const data = { cocktails: codex.cocktails, families: codex.families, dishes: SEED_RECIPES, dishDetails: RECIPE_DETAILS };
const loadData = async (kind) => (kind === 'cocktail' ? { cocktails: data.cocktails, families: data.families } : { dishes: SEED_RECIPES, dishDetails: RECIPE_DETAILS });
const nodes = loadFlavorNodes();
const sentenceOf = (id) => screen.getByTestId(id).getAttribute('data-note');

beforeEach(() => { global.fetch = vi.fn(() => Promise.resolve({ ok: false })); });

const RECIPES = { negroni: ['cocktail', 'negroni'], 'beef-bolognese': ['dish', 'beef-bolognese'] };

for (const [name, [kind, slug]] of Object.entries(RECIPES)) {
  describe(`${name}: one sentence on every surface`, () => {
    const recipe = resolveBuiltIn(kind, slug, data);
    const truth = flavorNote(profileForRecipe(recipe, nodes).bars).text;

    it('the reference sentence is a real one', () => { expect(truth).toMatch(/^[A-Z].*\.$/); });

    it('the shared page opens on it and reaches the wheel by dot, swipe and keyboard', async () => {
      render(<SharedRecipePage route={{ kind, slug }} loadData={loadData} loadNodes={async () => nodes} />);
      await screen.findByTestId('shared-profile-sentence');
      expect(sentenceOf('shared-profile-sentence')).toBe(truth);
      expect(screen.getByTestId('shared-profile-page-wheel').getAttribute('data-active')).toBe('false');
      fireEvent.click(screen.getByTestId('shared-profile-dot-wheel'));
      expect(screen.getByTestId('shared-profile-page-wheel').getAttribute('data-active')).toBe('true');
      fireEvent.keyDown(screen.getByTestId('shared-profile-swipe'), { key: 'ArrowLeft' });
      expect(screen.getByTestId('shared-profile-page-note').getAttribute('data-active')).toBe('true');
      const area = screen.getByTestId('shared-profile-page-note').parentElement.parentElement;
      fireEvent.pointerDown(area, { clientX: 250, clientY: 10 });
      fireEvent.pointerUp(area, { clientX: 100, clientY: 12 });
      expect(screen.getByTestId('shared-profile-page-wheel').getAttribute('data-active')).toBe('true');
    });

    it('the Flavor profile button opens on it and reaches the wheel by dot, swipe and keyboard', () => {
      render(<LabNodeCard kind={kind === 'cocktail' ? 'cocktail' : 'sauce'} name={recipe.name} ingredients={[]} actions={[]} onClose={() => {}} flavor={{ recipe, nodes, builtIn: true }} />);
      fireEvent.click(screen.getByTestId('flavor-profile-button'));
      expect(sentenceOf('recipe-profile-sentence')).toBe(truth);
      expect(screen.getByTestId('recipe-profile-page-wheel').getAttribute('data-active')).toBe('false');
      fireEvent.click(screen.getByTestId('recipe-profile-dot-wheel'));
      expect(screen.getByTestId('recipe-profile-page-wheel').getAttribute('data-active')).toBe('true');
      fireEvent.keyDown(screen.getByTestId('recipe-profile-swipe'), { key: 'ArrowLeft' });
      const area = screen.getByTestId('recipe-profile-page-note').parentElement.parentElement;
      fireEvent.pointerDown(area, { clientX: 250, clientY: 10 });
      fireEvent.pointerUp(area, { clientX: 100, clientY: 12 });
      expect(screen.getByTestId('recipe-profile-page-wheel').getAttribute('data-active')).toBe('true');
    });
  });
}

describe('Beef Bolognese in the Recipe Lab invent panel (the amounts the quantity model is given are the recipe\'s own)', () => {
  const recipe = resolveBuiltIn('dish', 'beef-bolognese', data);
  for (const l of recipe.lines) { const a = parseAmountText(l.amount); if (a) AMOUNTS[l.key] = { raw: l.amount, ...a, inferred: true }; }

  it('opens on the same sentence and reaches the wheel by dot and keyboard', async () => {
    const truth = flavorNote(profileForRecipe(recipe, nodes).bars).text;
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
    expect(sentenceOf('invent-recipe-profile-sentence')).toBe(truth);
    fireEvent.click(screen.getByTestId('invent-recipe-profile-dot-wheel'));
    expect(screen.getByTestId('invent-recipe-profile-page-wheel').getAttribute('data-active')).toBe('true');
    fireEvent.keyDown(screen.getByTestId('invent-recipe-profile-swipe'), { key: 'ArrowLeft' });
    expect(screen.getByTestId('invent-recipe-profile-page-note').getAttribute('data-active')).toBe('true');
  });
});
