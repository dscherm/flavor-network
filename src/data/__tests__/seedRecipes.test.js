import { describe, it, expect } from 'vitest';
import { SEED_RECIPES, CUISINE_COLOR, buildRecipesNetworkData } from '../seedRecipes.js';

describe('seedRecipes — Phase 4', () => {
  it('exports exactly 15 recipes', () => {
    expect(SEED_RECIPES).toHaveLength(15);
  });

  it('every recipe has id, name, cuisine, ingredients[], position3D', () => {
    for (const r of SEED_RECIPES) {
      expect(r.id).toBeTruthy();
      expect(r.name).toBeTruthy();
      expect(r.cuisine).toBeTruthy();
      expect(Array.isArray(r.ingredients)).toBe(true);
      expect(r.ingredients.length).toBeGreaterThan(0);
      expect(Array.isArray(r.position3D)).toBe(true);
      expect(r.position3D).toHaveLength(3);
    }
  });

  it('covers at least 6 cuisines (per plan §4.1)', () => {
    const cuisines = new Set(SEED_RECIPES.map((r) => r.cuisine));
    expect(cuisines.size).toBeGreaterThanOrEqual(6);
  });

  it('every cuisine has a color mapping', () => {
    for (const r of SEED_RECIPES) {
      expect(CUISINE_COLOR[r.cuisine]).toMatch(/^#[0-9a-f]{6}$/i);
    }
  });

  it('recipe IDs are unique', () => {
    const ids = SEED_RECIPES.map((r) => r.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('buildRecipesNetworkData returns NetworkScene-shaped data', () => {
    const { nodes, positions } = buildRecipesNetworkData();
    expect(nodes.size).toBe(15);
    expect(Object.keys(positions)).toHaveLength(15);
    for (const r of SEED_RECIPES) {
      expect(nodes.get(r.id)).toBeTruthy();
      expect(positions[r.id]).toEqual(r.position3D);
    }
  });
});
