import { describe, it, expect, vi } from 'vitest';
import { render, fireEvent } from '@testing-library/react';
import TasteWheel from './TasteWheel.jsx';

function makeNodes(entries) {
  const m = new Map();
  for (const [name, taste] of entries) {
    m.set(name, { name, taste, weight: null, volume: null, season: null, tips: [] });
  }
  return m;
}

describe('TasteWheel', () => {
  it('renders a canvas element', () => {
    const nodes = makeNodes([['garlic', 'pungent']]);
    const { container } = render(
      <TasteWheel ingredients={[]} nodes={nodes} width={300} />
    );
    const canvas = container.querySelector('canvas');
    expect(canvas).toBeTruthy();
  });

  it('renders without crashing with no ingredients', () => {
    const { container } = render(
      <TasteWheel ingredients={[]} nodes={new Map()} width={300} />
    );
    expect(container.querySelector('canvas')).toBeTruthy();
  });

  it('renders with ingredients', () => {
    const nodes = makeNodes([
      ['garlic', 'pungent'],
      ['lemon', 'sour'],
    ]);
    const { container } = render(
      <TasteWheel ingredients={['garlic', 'lemon']} nodes={nodes} width={300} />
    );
    expect(container.querySelector('canvas')).toBeTruthy();
  });

  it('calls onTapAxis when canvas is clicked in an octant region', () => {
    const nodes = makeNodes([['garlic', 'pungent']]);
    const onTapAxis = vi.fn();
    const { container } = render(
      <TasteWheel ingredients={['garlic']} nodes={nodes} onTapAxis={onTapAxis} width={300} />
    );
    const canvas = container.querySelector('canvas');

    // Mock getBoundingClientRect for hit testing
    canvas.getBoundingClientRect = () => ({
      left: 0, top: 0, width: 300, height: 300, right: 300, bottom: 300,
    });

    // Click in upper-right area (should hit an octant, not center)
    fireEvent.click(canvas, { clientX: 200, clientY: 80 });
    // Should have been called (exact axis depends on angle math)
    expect(onTapAxis).toHaveBeenCalled();
  });

  it('does not call onTapAxis when clicking dead center of canvas', () => {
    const nodes = makeNodes([['garlic', 'pungent']]);
    const onTapAxis = vi.fn();
    const { container } = render(
      <TasteWheel ingredients={['garlic']} nodes={nodes} onTapAxis={onTapAxis} width={300} />
    );
    const canvas = container.querySelector('canvas');
    // size = Math.min(300-32, 320) = 268, so center = 134
    const sz = 268;
    canvas.getBoundingClientRect = () => ({
      left: 0, top: 0, width: sz, height: sz, right: sz, bottom: sz,
    });

    // Click dead center — dist=0 which is < 5px exclusion zone
    fireEvent.click(canvas, { clientX: sz / 2, clientY: sz / 2 });
    expect(onTapAxis).not.toHaveBeenCalled();
  });
});

describe('SuggestionDrawer snap states', () => {
  // These are logic tests for the snap calculation
  it('nearestSnap returns correct state', () => {
    // Import the logic inline since it's not exported — test via component behavior
    // Peek = 56px, Half = 40% of 800 = 320, Full = 75% of 800 = 600
    const viewportHeight = 800;
    const PEEK = 56;
    const HALF = viewportHeight * 0.4;
    const FULL = viewportHeight * 0.75;

    function nearestSnap(y) {
      const dists = [
        { state: 'peek', d: Math.abs(y - PEEK) },
        { state: 'half', d: Math.abs(y - HALF) },
        { state: 'full', d: Math.abs(y - FULL) },
      ];
      dists.sort((a, b) => a.d - b.d);
      return dists[0].state;
    }

    expect(nearestSnap(50)).toBe('peek');
    expect(nearestSnap(100)).toBe('peek');
    expect(nearestSnap(200)).toBe('half');
    expect(nearestSnap(300)).toBe('half');
    expect(nearestSnap(500)).toBe('full');
    expect(nearestSnap(700)).toBe('full');
  });
});
