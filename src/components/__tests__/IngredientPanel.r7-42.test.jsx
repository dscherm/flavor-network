import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import IngredientPanel from '../IngredientPanel.jsx';

const node = { name: 'tomato', pairingCount: 12 };
const neighbors = [
  { name: 'basil', strength: 0.91 },
  { name: 'olive oil', strength: 0.78 },
  { name: 'garlic', strength: 0.62 },
];

describe('R7-42 — Top Pairings header click highlights neighbors on the network', () => {
  it('calls onHighlightPairings with all neighbor names (strength desc) on header click', () => {
    const onHighlightPairings = vi.fn();
    render(
      <IngredientPanel
        node={node}
        neighbors={neighbors}
        onHighlightPairings={onHighlightPairings}
        selectedNodes={[]}
        selectedNodesData={[]}
        selectedCount={0}
        commonPairings={[]}
        embedded
      />,
    );

    const header = screen.getByRole('button', { name: /Top Pairings/i });
    fireEvent.click(header);

    expect(onHighlightPairings).toHaveBeenCalledTimes(1);
    expect(onHighlightPairings).toHaveBeenCalledWith(['basil', 'olive oil', 'garlic']);
  });

  it('subsequent clicks fire onHighlightPairings again with the same names (toggle is owned by App.jsx)', () => {
    const onHighlightPairings = vi.fn();
    render(
      <IngredientPanel
        node={node}
        neighbors={neighbors}
        onHighlightPairings={onHighlightPairings}
        selectedNodes={[]}
        selectedNodesData={[]}
        selectedCount={0}
        commonPairings={[]}
        embedded
      />,
    );

    const header = screen.getByRole('button', { name: /Top Pairings/i });
    fireEvent.click(header);
    fireEvent.click(header);

    expect(onHighlightPairings).toHaveBeenCalledTimes(2);
    expect(onHighlightPairings.mock.calls[0][0]).toEqual(['basil', 'olive oil', 'garlic']);
    expect(onHighlightPairings.mock.calls[1][0]).toEqual(['basil', 'olive oil', 'garlic']);
  });
});
