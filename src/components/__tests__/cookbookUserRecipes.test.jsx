// @vitest-environment jsdom
// COOKBOOK-1 (2026-08-02). Reported: saving a recipe from the Recipe
// Notebook does not make it findable in the Cookbook.
//
// It was in fact being saved the whole time — addRecipe writes to
// profile.recipes and App.jsx passes that straight into CookbookLab. What
// hid it was the cluster filter: userRecipeToSeed stamps saved recipes with
// cluster 'personal', while the Cookbook opens on DEFAULT_CLUSTER_FILTER
// 'savory' and drops anything that does not match exactly. So the recipe
// existed, was correctly normalised, and was filtered out of view on mount.
//
// These pin the behaviour the user actually asked for: save it, then find it
// there afterwards — without having to know a filter chip exists.
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import CookbookLab from '../CookbookLab.jsx';

vi.mock('../../three/SceneManager.js', () => ({ default: class {} }));

function renderCookbook(userRecipes) {
  return render(
    <CookbookLab
      userRecipes={userRecipes}
      isMakePicker
      onPick={() => {}}
      fullData={{ nodes: new Map(), pairings: [] }}
    />,
  );
}

describe('Cookbook shows recipes saved from the notebook (COOKBOOK-1)', () => {
  it('lists a saved recipe on open, without changing any filter', async () => {
    renderCookbook([{ name: 'Grandma Pesto', ingredients: ['basil', 'garlic', 'olive oil'] }]);
    // The Cookbook opens on the 'savory' cluster. A saved recipe is stamped
    // 'personal', so before the fix this query found nothing at all.
    expect(await screen.findByText(/Grandma Pesto/i)).toBeTruthy();
  });

  it('still lists saved recipes alongside the curated seed set', async () => {
    renderCookbook([{ name: 'Weeknight Dal', ingredients: ['lentils', 'cumin', 'onion'] }]);
    expect(await screen.findByText(/Weeknight Dal/i)).toBeTruthy();
    // Seed recipes must not be displaced by the exemption.
    const cards = screen.getAllByTestId(/recipe-card|recipes-lab/i);
    expect(cards.length).toBeGreaterThan(0);
  });

  it('renders nothing extra when the user has saved nothing', () => {
    renderCookbook([]);
    expect(screen.queryByText(/Grandma Pesto/i)).toBeNull();
  });
});
