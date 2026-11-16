// @vitest-environment jsdom
import { render, screen, fireEvent } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import RecipeFlavorProfilesCard from '../RecipeFlavorProfilesCard.jsx';
import InventFlavorProfile from '../InventFlavorProfile.jsx';
import { buildFlavorProfile } from '../../data/inventProfile.js';
import { AXES, AROMA_AXES, axisLabel } from '../../data/recipeProfileAnalysis.js';

// AROMA-3: seventeen axes (six tastes, eleven aromas) must still render on the Recipe Notebook card and an invent panel.
const MANY = ['mushroom', 'soy sauce', 'almond', 'coffee', 'mezcal', 'bacon', 'parmesan', 'butter', 'strawberry', 'mint', 'cinnamon', 'lavender', 'miso', 'vanilla', 'truffle', 'lemon'];
const nodes = new Map(MANY.map((k) => [k, { taste: 'sweet', gnnProbs: {} }]));

beforeEach(() => {
  global.fetch = vi.fn(() => Promise.resolve({ ok: false }));
  try { localStorage.clear(); } catch { /* ignore */ }
});

describe('Flavor Profiles card with eleven aromas', () => {
  it('draws the overview under the display rule (6 + 6 at most, "show all" for the rest) and a map of 3 to 8 spokes', () => {
    render(<RecipeFlavorProfilesCard bowlNames={MANY} nodes={nodes} />);
    const bars = screen.getAllByTestId('overview-bar');
    expect(bars.length).toBeGreaterThan(5);
    expect(bars.length).toBeLessThanOrEqual(12);
    fireEvent.click(screen.getByTestId('overview-showall'));
    const all = screen.getAllByTestId('overview-bar');
    expect(all.length).toBeGreaterThan(bars.length);
    expect(all.some((b) => AROMA_AXES.slice(6).includes(b.getAttribute('data-axis')))).toBe(true);
    fireEvent.click(screen.getByLabelText('Next'));
    const map = screen.getByTestId('flavor-map-radar');
    const labels = AXES.filter((a) => map.textContent.includes(axisLabel(a).toLowerCase()) && !MANY.includes(axisLabel(a).toLowerCase()));
    expect(labels.length).toBeGreaterThanOrEqual(3);
    expect(labels.length).toBeLessThanOrEqual(8);
  });
  it('walks every page of the carousel, one per shown axis, without throwing', () => {
    render(<RecipeFlavorProfilesCard bowlNames={MANY} nodes={nodes} />);
    let pages = 1;
    for (let i = 0; i < 40; i += 1) {
      const next = screen.queryByLabelText('Next');
      if (!next || next.disabled) break;
      fireEvent.click(next);
      pages += 1;
    }
    // overview, flavor map, one page per shown axis, enhance and pairings
    expect(pages).toBeGreaterThan(8);
  });
});

describe('an invent panel profile with eleven aromas', () => {
  it('names the strongest notes in a sentence, keeps every note in the hidden ranked list and draws the wheel on the second page', () => {
    const profile = buildFlavorProfile(MANY, nodes, { noun: 'recipe' });
    render(<InventFlavorProfile profile={profile} testidPrefix="p" />);
    expect(screen.getByTestId('p-sentence')).toHaveTextContent(/\.$/);
    expect(screen.getAllByRole('listitem', { hidden: true })).toHaveLength(profile.bars.length);
    expect(profile.bars.length).toBeLessThanOrEqual(17);
    fireEvent.click(screen.getByTestId('p-dot-wheel'));
    expect(screen.getByTestId('p-page-wheel').getAttribute('data-active')).toBe('true');
  });
});
