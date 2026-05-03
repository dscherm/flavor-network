/**
 * R15-4 load-saved-recipe contract test.
 *
 * Locks the click semantics on the RecipeList row inside ProfilePanel:
 * with `onLoadRecipe` provided, the recipe name renders as a button that,
 * when clicked, fires the callback with the full recipe object. The X
 * (remove) button stays separate. Without `onLoadRecipe`, the recipe name
 * stays as a non-interactive span (preserves the legacy display-only mode).
 */
import { describe, it, expect, vi } from 'vitest';
import { render, fireEvent } from '@testing-library/react';
import ProfilePanel from '../ProfilePanel.jsx';

function makeProfile(recipes = []) {
  return {
    ingredients: [],
    cuisines: [],
    recipes,
  };
}

function makeActions(overrides = {}) {
  return {
    addIngredient: vi.fn(),
    removeIngredient: vi.fn(),
    addCuisine: vi.fn(),
    removeCuisine: vi.fn(),
    addRecipe: vi.fn(),
    removeRecipe: vi.fn(),
    exportProfile: vi.fn(() => '{}'),
    importProfile: vi.fn(() => true),
    ...overrides,
  };
}

describe('R15-4: ProfilePanel recipe load → Recipe Lab', () => {
  it('clicking the recipe name fires onLoadRecipe with the full recipe', () => {
    const onLoadRecipe = vi.fn();
    const recipe = { name: 'Tomato Soup', ingredients: ['tomato', 'basil', 'cream'] };
    const { container, getByLabelText } = render(
      <ProfilePanel
        profile={makeProfile([recipe])}
        actions={makeActions()}
        ingredientList={[]}
        cuisines={[]}
        isOpen
        onClose={() => {}}
        graphNodes={[]}
        onLoadRecipe={onLoadRecipe}
      />,
    );

    // Switch to Recipes tab
    const recipesTab = Array.from(container.querySelectorAll('button')).find(
      (b) => b.textContent.includes('Recipes'),
    );
    fireEvent.click(recipesTab);

    // Click the recipe name button (aria-label set in RecipeList)
    const loadBtn = getByLabelText('Load recipe Tomato Soup into Recipe Lab');
    fireEvent.click(loadBtn);

    expect(onLoadRecipe).toHaveBeenCalledTimes(1);
    expect(onLoadRecipe).toHaveBeenCalledWith(recipe);
  });

  it('the X (remove) button still calls removeRecipe with the index', () => {
    const onLoadRecipe = vi.fn();
    const removeRecipe = vi.fn();
    const recipe = { name: 'Tomato Soup', ingredients: ['tomato'] };
    const { container, getByLabelText } = render(
      <ProfilePanel
        profile={makeProfile([recipe])}
        actions={makeActions({ removeRecipe })}
        ingredientList={[]}
        cuisines={[]}
        isOpen
        onClose={() => {}}
        graphNodes={[]}
        onLoadRecipe={onLoadRecipe}
      />,
    );

    fireEvent.click(
      Array.from(container.querySelectorAll('button')).find((b) =>
        b.textContent.includes('Recipes'),
      ),
    );

    fireEvent.click(getByLabelText('Remove recipe Tomato Soup'));

    expect(removeRecipe).toHaveBeenCalledWith(0);
    // Removal must NOT also fire load (event isolation)
    expect(onLoadRecipe).not.toHaveBeenCalled();
  });

  it('without onLoadRecipe, the recipe name renders as non-interactive text', () => {
    const recipe = { name: 'Tomato Soup', ingredients: ['tomato'] };
    const { container, queryByLabelText } = render(
      <ProfilePanel
        profile={makeProfile([recipe])}
        actions={makeActions()}
        ingredientList={[]}
        cuisines={[]}
        isOpen
        onClose={() => {}}
        graphNodes={[]}
        // onLoadRecipe omitted on purpose
      />,
    );

    fireEvent.click(
      Array.from(container.querySelectorAll('button')).find((b) =>
        b.textContent.includes('Recipes'),
      ),
    );

    // No load button when callback absent
    expect(queryByLabelText('Load recipe Tomato Soup into Recipe Lab')).toBeNull();
  });
});
