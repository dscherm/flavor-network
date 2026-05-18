/**
 * IngredientPanel — P5 AffinityMode glue for primer-state wedge wheel.
 *
 * Verifies the parent-controlled primer/pairings transition:
 *   - `affinityEngaged={false}` (default) → wheel starts in 'pairings'
 *     (no primer aria-live element in the DOM)
 *   - `affinityEngaged={true}` → wheel starts in 'primer' (primer aria-live
 *     announces "Showing {focal}'s flavor profile")
 *   - Click anywhere on the wheel container → transition to 'pairings'
 *     (primer aria-live element disappears from the DOM)
 *   - Focal change while affinityEngaged → wheel resets back to primer
 */
import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import IngredientPanel from '../IngredientPanel.jsx';

const tomato = {
  name: 'tomato',
  pairingCount: 12,
  taste: 'sweet,sour',
  season: 'summer',
  cuisines: ['italian', 'mediterranean'],
  gnnProbs: { odor_fruity: 0.71, odor_green: 0.55, odor_fatty: 0.04 },
};
const apple = {
  name: 'apple',
  pairingCount: 14,
  taste: 'sweet',
  season: 'autumn',
  cuisines: ['american'],
  gnnProbs: { odor_fruity: 0.82 },
};

const neighbors = [
  { name: 'basil', strength: 0.91 },
  { name: 'olive oil', strength: 0.78 },
  { name: 'garlic', strength: 0.62 },
];

function expandTopPairings() {
  const header = screen.getByRole('button', { name: /Top Pairings/i });
  fireEvent.click(header);
}

const baseProps = {
  neighbors,
  selectedNodes: [],
  selectedNodesData: [],
  selectedCount: 0,
  commonPairings: [],
  embedded: true,
};

describe('IngredientPanel — P5 affinityEngaged primer glue', () => {
  it('default (affinityEngaged omitted) renders wheel in pairings — no primer aria-live', () => {
    const { container } = render(<IngredientPanel {...baseProps} node={tomato} />);
    expandTopPairings();
    const text = container.textContent || '';
    expect(text).not.toMatch(/Showing tomato's flavor profile/i);
  });

  it('affinityEngaged=false explicitly renders wheel in pairings', () => {
    const { container } = render(<IngredientPanel {...baseProps} node={tomato} affinityEngaged={false} />);
    expandTopPairings();
    const text = container.textContent || '';
    expect(text).not.toMatch(/Showing tomato's flavor profile/i);
  });

  it('affinityEngaged=true renders wheel in primer — primer aria-live present', () => {
    const { container } = render(<IngredientPanel {...baseProps} node={tomato} affinityEngaged />);
    expandTopPairings();
    const text = container.textContent || '';
    expect(text).toMatch(/Showing tomato's flavor profile/i);
  });

  it('clicking the wheel container transitions primer → pairings', () => {
    const { container } = render(<IngredientPanel {...baseProps} node={tomato} affinityEngaged />);
    expandTopPairings();
    expect(container.textContent).toMatch(/Showing tomato's flavor profile/i);

    // The wheel container is a div wrapping the WedgeGridFlavorWheel SVG;
    // click anywhere inside it (the svg target works) to fire onClick on
    // the wrapping div (event bubbling).
    const svg = container.querySelector('svg');
    expect(svg).not.toBeNull();
    fireEvent.click(svg);

    // After the explicit click, the primer aria-live element is gone.
    // (Accent-line presence depends on graphNodes which this panel test
    // doesn't plumb; the accent-line render path is covered by
    // WedgeGridFlavorWheel.primerState.test.jsx in isolation.)
    expect(container.textContent).not.toMatch(/Showing tomato's flavor profile/i);
  });

  it('focal change while affinityEngaged resets wheel back to primer', () => {
    const { container, rerender } = render(<IngredientPanel {...baseProps} node={tomato} affinityEngaged />);
    expandTopPairings();
    // Confirm primer is on for tomato
    expect(container.textContent).toMatch(/Showing tomato's flavor profile/i);

    // Click to exit primer for tomato
    fireEvent.click(container.querySelector('svg'));
    expect(container.textContent).not.toMatch(/Showing tomato's flavor profile/i);

    // Re-render with a new focal — primer should be ON for apple, the
    // effect's [node.name] dependency triggers the reset.
    rerender(<IngredientPanel {...baseProps} node={apple} affinityEngaged />);
    expect(container.textContent).toMatch(/Showing apple's flavor profile/i);
  });
});
