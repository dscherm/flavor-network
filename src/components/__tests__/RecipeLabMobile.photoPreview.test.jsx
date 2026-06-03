// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import RecipeLabMobile from '../RecipeLabMobile.jsx';

function buildFullData(ingredientList = ['tomato', 'basil']) {
  const nodes = new Map(ingredientList.map((n) => [n, { name: n, taste: 'umami' }]));
  const edges = [];
  for (let i = 0; i < ingredientList.length; i++) {
    for (let j = i + 1; j < ingredientList.length; j++) {
      edges.push({ source: ingredientList[i], target: ingredientList[j], strength: 0.5 });
    }
  }
  return { graph: { nodes, edges, ingredientList }, cuisineNeighborIndex: null };
}

function makeImageFile(name = 'dish.png', type = 'image/png') {
  return new File(['x'], name, { type });
}

describe('RecipeLabMobile — MAKE-PHOTO-PREVIEW (§5.3 image preview)', () => {
  beforeEach(() => {
    if (typeof globalThis.ResizeObserver === 'undefined') {
      globalThis.ResizeObserver = class {
        observe() {} unobserve() {} disconnect() {}
      };
    }
    // jsdom needs an explicit polyfill; use a counter so we can assert
    // create/revoke pairs.
    let counter = 0;
    globalThis.URL.createObjectURL = vi.fn(() => `blob:test-${++counter}`);
    globalThis.URL.revokeObjectURL = vi.fn();
  });

  it('handoff with source="make-photo" + image=<File> renders an <img> at ≥80px tall', () => {
    const { rerender } = render(<RecipeLabMobile fullData={buildFullData()} />);
    const file = makeImageFile();
    rerender(
      <RecipeLabMobile
        fullData={buildFullData()}
        handoff={{ ts: 1, source: 'make-photo', ingredients: [], image: file, mode: null }}
      />,
    );
    const img = screen.getByTestId('recipe-photo-preview');
    expect(img).toBeInTheDocument();
    expect(img.tagName).toBe('IMG');
    expect(img.getAttribute('alt')).toBe('Recipe photo');
    const minHeight = parseInt(img.style.minHeight || '0', 10);
    expect(minHeight).toBeGreaterThanOrEqual(80);
    expect(globalThis.URL.createObjectURL).toHaveBeenCalledTimes(1);
    expect(globalThis.URL.createObjectURL).toHaveBeenCalledWith(file);
  });

  it('remove button revokes the object URL and removes the preview', () => {
    const { rerender } = render(<RecipeLabMobile fullData={buildFullData()} />);
    const file = makeImageFile();
    rerender(
      <RecipeLabMobile
        fullData={buildFullData()}
        handoff={{ ts: 1, source: 'make-photo', ingredients: [], image: file, mode: null }}
      />,
    );
    expect(screen.getByTestId('recipe-photo-preview')).toBeInTheDocument();
    fireEvent.click(screen.getByTestId('recipe-photo-remove'));
    expect(screen.queryByTestId('recipe-photo-preview')).toBeNull();
    expect(globalThis.URL.revokeObjectURL).toHaveBeenCalledWith('blob:test-1');
  });

  it('clearing the bowl (Clear button) revokes the object URL', () => {
    const { rerender } = render(<RecipeLabMobile fullData={buildFullData()} />);
    const file = makeImageFile();
    rerender(
      <RecipeLabMobile
        fullData={buildFullData()}
        initialIngredients={['tomato']}
        handoff={{ ts: 1, source: 'make-photo', ingredients: ['tomato'], image: file, mode: null }}
      />,
    );
    expect(screen.getByTestId('recipe-photo-preview')).toBeInTheDocument();
    fireEvent.click(screen.getByText(/^Clear$/));
    expect(screen.queryByTestId('recipe-photo-preview')).toBeNull();
    expect(globalThis.URL.revokeObjectURL).toHaveBeenCalledWith('blob:test-1');
  });

  it('second photo handoff revokes the prior URL and creates a new one', () => {
    const { rerender } = render(<RecipeLabMobile fullData={buildFullData()} />);
    rerender(
      <RecipeLabMobile
        fullData={buildFullData()}
        handoff={{ ts: 1, source: 'make-photo', ingredients: [], image: makeImageFile('a.png'), mode: null }}
      />,
    );
    rerender(
      <RecipeLabMobile
        fullData={buildFullData()}
        handoff={{ ts: 2, source: 'make-photo', ingredients: [], image: makeImageFile('b.png'), mode: null }}
      />,
    );
    expect(globalThis.URL.createObjectURL).toHaveBeenCalledTimes(2);
    expect(globalThis.URL.revokeObjectURL).toHaveBeenCalledWith('blob:test-1');
  });

  it('unmount revokes the object URL', () => {
    const { rerender, unmount } = render(<RecipeLabMobile fullData={buildFullData()} />);
    rerender(
      <RecipeLabMobile
        fullData={buildFullData()}
        handoff={{ ts: 1, source: 'make-photo', ingredients: [], image: makeImageFile(), mode: null }}
      />,
    );
    unmount();
    expect(globalThis.URL.revokeObjectURL).toHaveBeenCalledWith('blob:test-1');
  });

  it('non-photo handoff (e.g. source="make-scratch", no image) does NOT render a preview', () => {
    const { rerender } = render(<RecipeLabMobile fullData={buildFullData()} />);
    rerender(
      <RecipeLabMobile
        fullData={buildFullData()}
        handoff={{ ts: 1, source: 'make-scratch', ingredients: [], image: null, mode: null }}
      />,
    );
    expect(screen.queryByTestId('recipe-photo-preview')).toBeNull();
    expect(globalThis.URL.createObjectURL).not.toHaveBeenCalled();
  });

  // B-version (2026-06-03): the General/Cocktail/Sauce mode strip
  // was removed from the Recipe Notebook chrome. labMode is still
  // tracked in component state but never surfaced in UI, so this
  // test was rewritten to assert the strip is gone — the prior
  // 'General' button assertion no longer applies.
  it('mode strip (General/Cocktail/Sauce) is no longer rendered after photo attach', () => {
    const { rerender } = render(<RecipeLabMobile fullData={buildFullData()} />);
    rerender(
      <RecipeLabMobile
        fullData={buildFullData()}
        handoff={{ ts: 1, source: 'make-photo', ingredients: [], image: makeImageFile(), mode: null }}
      />,
    );
    // 'General' is unique to the removed mode strip. 'Sauce' would
    // collide with the dish-type joystick pill of the same label, so
    // we only assert 'General' (the unambiguous marker).
    expect(screen.queryByText('General')).toBeNull();
    expect(screen.queryByText('Cocktail')).toBeNull();
  });
});
