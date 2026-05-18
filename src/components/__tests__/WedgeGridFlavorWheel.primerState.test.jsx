/**
 * WedgeGridFlavorWheel — P4 primer-state test (Network Cleanup Tactical).
 *
 * Verifies the two acceptance halves of ADR-1 §P4:
 *
 *   1. **Primer state** (startingState='primer'): suppresses the cell
 *      text, accent lines, and dropped-neighbor footnote; renders the
 *      focal-dominant taste-ring shading + a primer-only conditionally
 *      MOUNTED aria-live element. Activated aroma sectors (the shaded
 *      sector backgrounds) continue to render — same data source as
 *      pairings, the primer is purely subtractive.
 *
 *   2. **Pairings byte-identity** (Principle #4 lock): the default
 *      render (no `startingState` prop) is DOM-equal to the explicit
 *      `startingState="pairings"` render. P4 cannot alter the pairings
 *      render path; this is the binding regression contract.
 */
import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import WedgeGridFlavorWheel from '../WedgeGridFlavorWheel.jsx';

const focal = {
  name: 'apple',
  taste: 'sweet,sour',
  season: 'autumn',
  cuisines: ['american', 'french'],
  gnnProbs: {
    odor_fruity: 0.82,
    odor_floral: 0.18,
    odor_green:  0.41,
    odor_woody:  0.12,
    odor_spicy:  0.05,
    odor_fatty:  0.04,
  },
};

const neighbors = [
  { name: 'cinnamon', strength: 0.88 },
  { name: 'butter',   strength: 0.72 },
  { name: 'walnut',   strength: 0.61 },
];

// Build a minimal graph-nodes map that the algorithm can read.
const graphNodes = new Map([
  ['cinnamon', { name: 'cinnamon', taste: 'sweet,pungent', cuisines: ['middle-eastern'], gnnProbs: { odor_spicy: 0.71, odor_woody: 0.30 } }],
  ['butter',   { name: 'butter',   taste: 'rich',          cuisines: ['french'],         gnnProbs: { odor_fatty: 0.85 } }],
  ['walnut',   { name: 'walnut',   taste: 'bitter',        cuisines: ['mediterranean'],  gnnProbs: { odor_woody: 0.61, odor_green: 0.35 } }],
]);

const baseProps = { focalNode: focal, neighbors, graphNodes, size: 280 };

describe('WedgeGridFlavorWheel — P4 primer state', () => {
  it('default render omits startingState prop and renders pairings (no primer aria-live)', () => {
    const { container } = render(<WedgeGridFlavorWheel {...baseProps} />);
    // No primer aria-live message in default (pairings) mode.
    const text = container.textContent || '';
    expect(text).not.toMatch(/Showing apple's flavor profile/i);
  });

  it("startingState='primer' mounts the primer aria-live element with focal name", () => {
    const { container } = render(<WedgeGridFlavorWheel {...baseProps} startingState="primer" />);
    const text = container.textContent || '';
    expect(text).toMatch(/Showing apple's flavor profile/i);
  });

  it("startingState='primer' suppresses accent lines (no <line> elements with stroke-opacity)", () => {
    const { container } = render(<WedgeGridFlavorWheel {...baseProps} startingState="primer" />);
    // Accent lines carry stroke-opacity="0.7"; sector dividers do not.
    const accentLines = container.querySelectorAll('line[stroke-opacity="0.7"]');
    expect(accentLines.length).toBe(0);
  });

  it("startingState='pairings' (explicit) DOES render accent lines for neighbors", () => {
    const { container } = render(<WedgeGridFlavorWheel {...baseProps} startingState="pairings" />);
    const accentLines = container.querySelectorAll('line[stroke-opacity="0.7"]');
    expect(accentLines.length).toBeGreaterThan(0);
  });

  it("startingState='primer' suppresses cell-text role=button groups (no clickable cells)", () => {
    const { container } = render(<WedgeGridFlavorWheel {...baseProps} startingState="primer" />);
    const cellButtons = container.querySelectorAll('g[role="button"]');
    expect(cellButtons.length).toBe(0);
  });

  it("startingState='pairings' (explicit) DOES render clickable cell-text groups", () => {
    const { container } = render(<WedgeGridFlavorWheel {...baseProps} startingState="pairings" />);
    const cellButtons = container.querySelectorAll('g[role="button"]');
    expect(cellButtons.length).toBeGreaterThan(0);
  });

  it("startingState='primer' renders the taste-ring shading (2 half-arcs in BRISCIONE_TASTE color)", () => {
    const { container } = render(<WedgeGridFlavorWheel {...baseProps} startingState="primer" />);
    // The taste-ring arcs carry fill-opacity="0.32"; nothing else in the
    // wheel uses that opacity value.
    const tasteArcs = container.querySelectorAll('path[fill-opacity="0.32"]');
    expect(tasteArcs.length).toBe(2);
  });

  it("startingState='primer' still shades activated aroma sectors (purely subtractive primer)", () => {
    const { container } = render(<WedgeGridFlavorWheel {...baseProps} startingState="primer" />);
    // Sector backgrounds carry fill-opacity 0.55 (activated) or 1
    // (faint background). At least one activated sector is expected for
    // the apple fixture (odor_fruity = 0.82).
    const activatedSectors = container.querySelectorAll('path[fill-opacity="0.55"]');
    expect(activatedSectors.length).toBeGreaterThan(0);
  });

  it('Principle #4 byte-identity — omitted prop === explicit startingState="pairings"', () => {
    const a = render(<WedgeGridFlavorWheel {...baseProps} />);
    const b = render(<WedgeGridFlavorWheel {...baseProps} startingState="pairings" />);
    // innerHTML comparison is the most direct byte-identity assertion.
    // Any divergence in the pairings render path (e.g. a stray primer
    // branch leaking) would fail here.
    expect(a.container.innerHTML).toBe(b.container.innerHTML);
  });
});
