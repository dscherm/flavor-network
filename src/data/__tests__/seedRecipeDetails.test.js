import { describe, it, expect } from 'vitest';
import { SEED_RECIPES } from '../seedRecipes.js';
import { RECIPE_DETAILS, getRecipeDetails } from '../seedRecipeDetails.js';

describe('seedRecipeDetails', () => {
  it('every seed recipe has servings, time and at least 3 steps', () => {
    for (const r of SEED_RECIPES) {
      const d = RECIPE_DETAILS[r.id];
      expect(d, r.id).toBeTruthy();
      expect(d.serves, r.id).toBeGreaterThan(0);
      expect(d.time, r.id).toBeTruthy();
      expect(d.steps.length, r.id).toBeGreaterThanOrEqual(3);
    }
  });

  it('every ingredient of every recipe has an amount', () => {
    const missing = SEED_RECIPES.flatMap((r) =>
      r.ingredients.filter((i) => !RECIPE_DETAILS[r.id]?.amounts?.[i]).map((i) => `${r.id}: ${i}`));
    expect(missing).toEqual([]);
  });

  it('no amount is listed for an ingredient the recipe does not use', () => {
    const extra = SEED_RECIPES.flatMap((r) =>
      Object.keys(RECIPE_DETAILS[r.id]?.amounts || {})
        .filter((k) => !r.ingredients.includes(k)).map((k) => `${r.id}: ${k}`));
    expect(extra).toEqual([]);
  });

  it('has no details for ids that are not seed recipes', () => {
    const ids = new Set(SEED_RECIPES.map((r) => r.id));
    expect(Object.keys(RECIPE_DETAILS).filter((id) => !ids.has(id))).toEqual([]);
    expect(getRecipeDetails('user-something')).toBeNull();
  });
});
