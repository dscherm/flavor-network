// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import CookbookLab from '../CookbookLab.jsx';
import { SEED_RECIPES } from '../../data/seedRecipes.js';

// NetworkScene is a thin wrapper around Three.js that we don't want to
// boot in jsdom. Stub it so click handlers can be exercised via a
// synthetic surface.
// Render one button per scene node so tests can fire node clicks via
// onNodeClick. We derive the list from props.data.nodes (a Map keyed by
// recipe name) — Map.entries() handles iteration across realms.
// NetworkScene stub: render one button per scene node so tests can fire
// node clicks via onNodeClick. buildRecipesScene returns
// { graph: { nodes: Map<name,node>, ... }, ... } — read from data.graph.nodes.
vi.mock('../NetworkScene.jsx', () => ({
  default: (props) => {
    const nodes = props.data?.graph?.nodes;
    const list = [];
    if (nodes && typeof nodes.forEach === 'function') {
      nodes.forEach((value) => list.push(value));
    }
    return (
      <div data-testid="network-scene-stub">
        {list.map((n) => (
          <button
            key={n.name}
            type="button"
            data-testid={`scene-node-${n.name}`}
            onClick={() => props.onNodeClick?.(n)}
          >
            {n.name}
          </button>
        ))}
      </div>
    );
  },
}));

vi.mock('../MultiAxisRadarStack.jsx', () => ({
  default: () => null,
}));

describe('CookbookLab — MAKE-COOKBOOK-PICKER (pickerMode="make")', () => {
  beforeEach(() => {
    if (typeof globalThis.ResizeObserver === 'undefined') {
      globalThis.ResizeObserver = class {
        observe() {} unobserve() {} disconnect() {}
      };
    }
  });

  it('default mode: card click opens RecipeDetail modal (no handoff)', () => {
    const onOpenRecipeLab = vi.fn();
    render(
      <CookbookLab onOpenRecipeLab={onOpenRecipeLab} />,
    );
    const firstRecipe = SEED_RECIPES.find((r) => r.cluster === 'savory') || SEED_RECIPES[0];
    fireEvent.click(screen.getByRole('button', { name: new RegExp(firstRecipe.name, 'i') }));
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(onOpenRecipeLab).not.toHaveBeenCalled();
  });

  it('pickerMode="make": card click emits recipeHandoff and does NOT open the modal', () => {
    const onOpenRecipeLab = vi.fn();
    render(
      <CookbookLab pickerMode="make" onOpenRecipeLab={onOpenRecipeLab} />,
    );
    const firstRecipe = SEED_RECIPES.find((r) => r.cluster === 'savory') || SEED_RECIPES[0];
    fireEvent.click(screen.getByRole('button', { name: new RegExp(firstRecipe.name, 'i') }));
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(onOpenRecipeLab).toHaveBeenCalledTimes(1);
    const [mode, ingredients, extras] = onOpenRecipeLab.mock.calls[0];
    expect(mode).toBe('recipe');
    expect(ingredients).toEqual(firstRecipe.ingredients);
    expect(extras.source).toBe('make-cookbook');
    expect(extras.recipeType).toBe(firstRecipe.cluster);
    expect(extras.title).toBe(firstRecipe.name);
  });

  it('pickerMode="make": breadcrumb "Make → Pick a recipe" renders and fires onExitPickerMode', () => {
    const onExitPickerMode = vi.fn();
    render(
      <CookbookLab pickerMode="make" onOpenRecipeLab={vi.fn()} onExitPickerMode={onExitPickerMode} />,
    );
    const crumb = screen.getByTestId('cookbook-picker-breadcrumb');
    expect(crumb).toBeInTheDocument();
    expect(crumb.textContent).toMatch(/Make/);
    expect(crumb.textContent).toMatch(/Pick a recipe/);
    fireEvent.click(crumb);
    expect(onExitPickerMode).toHaveBeenCalledTimes(1);
  });

  it('default mode: breadcrumb does NOT render', () => {
    render(<CookbookLab onOpenRecipeLab={vi.fn()} />);
    expect(screen.queryByTestId('cookbook-picker-breadcrumb')).toBeNull();
  });

  it('pickerMode="make": header subtitle is "Pick one to start cooking"', () => {
    render(<CookbookLab pickerMode="make" onOpenRecipeLab={vi.fn()} />);
    expect(screen.getByText('Pick one to start cooking')).toBeInTheDocument();
    expect(
      screen.queryByText('15 hand-curated dishes spanning 6 culinary traditions'),
    ).toBeNull();
  });

  it('pickerMode="make": externalFilter is ignored (does not narrow the visible set)', () => {
    // Pass an externalFilter that would normally narrow Italian cuisine.
    // In picker mode it must be ignored so the user can pick any recipe.
    render(
      <CookbookLab
        pickerMode="make"
        externalFilter={{ cuisine: 'italian' }}
        onOpenRecipeLab={vi.fn()}
      />,
    );
    // No external-filter narrowing → all SEED_RECIPES render under
    // the default 'savory' cluster filter (the default narrows by
    // cluster but NOT by externalFilter).
    const savoryCount = SEED_RECIPES.filter((r) => r.cluster === 'savory').length;
    const visibleCards = screen.getAllByRole('button').filter(
      (b) => SEED_RECIPES.some((r) => b.textContent.startsWith(r.name)),
    );
    expect(visibleCards.length).toBe(savoryCount);
  });
});
