/**
 * IngredientPanel "View as wheel" debug-flag gating (2026-05-13).
 *
 * The Phase 2 toggle is preserved for A/B comparison but hidden from
 * default UX. Activates when ?debugWheel=1 is in the URL or
 * localStorage `debug:wheel` is '1'.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import IngredientPanel from '../IngredientPanel.jsx';

const node = { name: 'tomato', pairingCount: 12 };
const neighbors = [
  { name: 'basil', strength: 0.91 },
  { name: 'olive oil', strength: 0.78 },
];

const baseProps = {
  node,
  neighbors,
  selectedNodes: [],
  selectedNodesData: [],
  selectedCount: 0,
  commonPairings: [],
  embedded: true,
};

describe('IngredientPanel "View as wheel" toggle (debug-flag gated)', () => {
  beforeEach(() => {
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.removeItem('debug:wheel');
      window.localStorage.removeItem('ingredient-panel-view');
    }
  });

  afterEach(() => {
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.removeItem('debug:wheel');
      window.localStorage.removeItem('ingredient-panel-view');
    }
  });

  it('hides the toggle by default (no debug flag set)', () => {
    render(<IngredientPanel {...baseProps} />);
    // Expand the Top Pairings section so the toggle would be in the DOM
    // if it were going to render.
    const header = screen.getByRole('button', { name: /Top Pairings/i });
    fireEvent.click(header);
    expect(screen.queryByRole('button', { name: /Switch to wheel view/i })).toBeNull();
    expect(screen.queryByRole('button', { name: /Switch to list view/i })).toBeNull();
  });

  it('shows the toggle when localStorage `debug:wheel` is "1"', () => {
    window.localStorage.setItem('debug:wheel', '1');
    render(<IngredientPanel {...baseProps} />);
    const header = screen.getByRole('button', { name: /Top Pairings/i });
    fireEvent.click(header);
    expect(screen.getByRole('button', { name: /Switch to wheel view/i })).toBeInTheDocument();
  });

  it('shows the toggle when ?debugWheel=1 is in the URL', () => {
    // jsdom's window.location is read-only; stub it via vi.spyOn.
    const original = window.location;
    const stub = { ...original, search: '?debugWheel=1' };
    Object.defineProperty(window, 'location', { value: stub, writable: true, configurable: true });
    try {
      render(<IngredientPanel {...baseProps} />);
      const header = screen.getByRole('button', { name: /Top Pairings/i });
      fireEvent.click(header);
      expect(screen.getByRole('button', { name: /Switch to wheel view/i })).toBeInTheDocument();
    } finally {
      Object.defineProperty(window, 'location', { value: original, writable: true, configurable: true });
    }
  });
});
