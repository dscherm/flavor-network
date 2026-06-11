import { describe, it, expect } from 'vitest';
import { isInFlavorBible, flavorBibleOnlyNeighbors } from './IngredientPanel.jsx';

function ctxWith({ pairs = [], adj = {} } = {}) {
  return {
    flavorBibleSet: new Set(
      pairs.map(([a, b]) => (a < b ? `${a}|${b}` : `${b}|${a}`)),
    ),
    flavorBibleNeighbors: new Map(Object.entries(adj)),
  };
}

describe('isInFlavorBible', () => {
  it('matches order-independently', () => {
    const ctx = ctxWith({ pairs: [['fig', 'anise']] });
    expect(isInFlavorBible('anise', 'fig', ctx)).toBe(true);
    expect(isInFlavorBible('fig', 'anise', ctx)).toBe(true);
  });

  it('returns false for a non-FB pair', () => {
    const ctx = ctxWith({ pairs: [['fig', 'anise']] });
    expect(isInFlavorBible('fig', 'beef', ctx)).toBe(false);
  });

  it('is null-safe when ctx/set absent', () => {
    expect(isInFlavorBible('a', 'b', undefined)).toBe(false);
    expect(isInFlavorBible('a', 'b', {})).toBe(false);
    expect(isInFlavorBible(null, 'b', ctxWith({ pairs: [] }))).toBe(false);
  });
});

describe('flavorBibleOnlyNeighbors', () => {
  const graphNodes = new Map([
    ['anchovy', {}], ['walnut', {}], ['lamb', {}], ['ghost', {}],
  ]);

  it('returns FB neighbors that are NOT already corpus neighbors', () => {
    const ctx = ctxWith({ adj: { thyme: ['lamb', 'anchovy', 'walnut'] } });
    const sortedNeighbors = [{ name: 'lamb', strength: 0.9 }]; // lamb is corpus
    const out = flavorBibleOnlyNeighbors('thyme', sortedNeighbors, ctx, graphNodes);
    expect(out).toEqual(['anchovy', 'walnut']); // sorted, lamb excluded
  });

  it('drops FB neighbors with no graph node (not clickable)', () => {
    const ctx = ctxWith({ adj: { thyme: ['anchovy', 'phantom'] } });
    const out = flavorBibleOnlyNeighbors('thyme', [], ctx, graphNodes);
    expect(out).toEqual(['anchovy']); // phantom not in graphNodes
  });

  it('dedupes and excludes the focal itself', () => {
    const ctx = ctxWith({ adj: { thyme: ['anchovy', 'anchovy', 'thyme'] } });
    const out = flavorBibleOnlyNeighbors('thyme', [], ctx, graphNodes);
    expect(out).toEqual(['anchovy']);
  });

  it('returns [] when no FB adjacency / null-safe', () => {
    expect(flavorBibleOnlyNeighbors('thyme', [], {}, graphNodes)).toEqual([]);
    expect(flavorBibleOnlyNeighbors('thyme', [], ctxWith({}), graphNodes)).toEqual([]);
  });

  it('skips the graph-node filter when graphNodes is absent', () => {
    const ctx = ctxWith({ adj: { thyme: ['anything'] } });
    const out = flavorBibleOnlyNeighbors('thyme', [], ctx, null);
    expect(out).toEqual(['anything']);
  });
});
