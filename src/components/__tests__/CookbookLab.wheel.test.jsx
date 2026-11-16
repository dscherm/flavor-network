// @vitest-environment jsdom
// WHEEL-2: the Cookbook recipe card draws the combined flavor wheel, from the same profileForRecipe call the card's
// Flavor profile button uses, so the two agree. No polygon radar and no axis chips remain.
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import CookbookLab from '../CookbookLab.jsx';
import { SEED_RECIPES } from '../../data/seedRecipes.js';
import { RECIPE_DETAILS } from '../../data/seedRecipeDetails.js';
import { normaliseBuiltIn } from '../../data/sharedRecipe.js';
import { profileForRecipe } from '../../data/shareCardData.js';
import { flavorNote } from '../../data/flavorCharts.js';
import { loadFlavorNodes } from '../../../scripts/lib/flavorNodes.mjs';

vi.setConfig({ testTimeout: 20000 });
vi.mock('../NetworkScene.jsx', () => ({ default: () => null }));

const nodes = loadFlavorNodes();
const ctx = { graph: { nodes } };
const DISHES = ['beef-bolognese', 'pad-thai', 'chicken-tikka'];

describe('Cookbook recipe card: combined flavor wheel', () => {
  for (const id of DISHES) {
    it(`${id}: the wheel's strongest wedges are the leading notes of its Flavor profile`, () => {
      const recipe = SEED_RECIPES.find((r) => r.id === id);
      const expected = profileForRecipe(normaliseBuiltIn('dish', recipe, { dishDetails: { [id]: RECIPE_DETAILS[id] } }), nodes);
      expect(expected.drawn).toBe(true);
      const note = flavorNote(expected.bars);
      render(<CookbookLab ctx={ctx} />);
      fireEvent.click(screen.getByRole('button', { name: new RegExp(recipe.name, 'i') }));
      const dialog = screen.getByRole('dialog');
      const chart = within(dialog).getByTestId('recipe-profile');
      expect(within(chart).getByRole('img', { name: /Flavor wheel/i })).toBeInTheDocument();
      expect(chart.querySelector('[data-testid$="radar-polygon"]')).toBeNull();
      for (const axis of [...note.lead, ...note.behind]) expect(within(chart).getByTestId(`recipe-wheel-wedge-${axis}`)).toBeInTheDocument();
      const wedgeAxes = [...chart.querySelectorAll('[data-testid^="recipe-wheel-wedge-"]')].map((e) => e.getAttribute('data-testid').replace('recipe-wheel-wedge-', ''));
      expect(wedgeAxes.sort()).toEqual(expected.bars.map((b) => b.axis).sort());
      // the button's section draws the same notes
      fireEvent.click(within(dialog).getByTestId('flavor-profile-button'));
      const section = screen.getByTestId('flavor-profile-section');
      expect(within(section).getByTestId('recipe-profile-sentence')).toHaveTextContent(new RegExp(expected.bars[0].label, 'i'));
      expect(within(chart).queryByRole('button', { name: 'Aroma' })).toBeNull();
    });
  }
});
