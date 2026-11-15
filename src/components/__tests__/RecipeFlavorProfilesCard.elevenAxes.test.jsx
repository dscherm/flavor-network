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
  it('draws the overview bars and the 17-spoke flavor map without throwing, each aroma label present', () => {
    render(<RecipeFlavorProfilesCard bowlNames={MANY} nodes={nodes} />);
    const bars = screen.getAllByTestId('overview-bar');
    expect(bars.length).toBeGreaterThan(5);
    expect(bars.length).toBeLessThanOrEqual(AXES.length);
    expect(bars.some((b) => AROMA_AXES.slice(6).includes(b.getAttribute('data-axis')))).toBe(true);
    fireEvent.click(screen.getByLabelText('Next'));
    const map = screen.getByTestId('flavor-map-radar');
    for (const a of AROMA_AXES) expect(map.textContent).toContain(axisLabel(a).toLowerCase());
  });
  it('walks every page of the carousel, one per firing axis, without throwing', () => {
    render(<RecipeFlavorProfilesCard bowlNames={MANY} nodes={nodes} />);
    let pages = 1;
    for (let i = 0; i < 40; i += 1) {
      const next = screen.queryByLabelText('Next');
      if (!next || next.disabled) break;
      fireEvent.click(next);
      pages += 1;
    }
    // overview, flavor map, one page per firing axis, enhance and pairings
    expect(pages).toBeGreaterThan(8);
  });
});

describe('an invent panel profile with eleven aromas', () => {
  it('lists a bar per firing axis (at most 17), each label truncating inside its row', () => {
    const profile = buildFlavorProfile(MANY, nodes, { noun: 'recipe' });
    render(<InventFlavorProfile profile={profile} testidPrefix="p" />);
    const rows = screen.getAllByRole('listitem');
    expect(rows.length).toBe(profile.bars.length);
    expect(rows.length).toBeLessThanOrEqual(17);
    for (const r of rows) expect(r.className).toContain('min-w-0');
  });
});
