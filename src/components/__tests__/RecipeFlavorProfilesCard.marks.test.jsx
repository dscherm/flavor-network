import { render, screen, fireEvent } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import RecipeFlavorProfilesCard from '../RecipeFlavorProfilesCard.jsx';
import { ingredientMarks, thinLabels } from '../../data/flavorMarks.js';

const nodes = new Map([
  ['sugar', { taste: 'sweet' }], ['lemon', { taste: 'sour' }], ['coffee', { taste: 'bitter' }],
  ['salt', { taste: 'salty' }], ['soy sauce', { taste: 'umami salty' }], ['strawberry', { taste: 'sweet' }],
  ['cranberry', { taste: 'sour' }], ['vanilla', { taste: 'sweet' }], ['honey', { taste: 'sweet' }],
  ['lime', { taste: 'sour' }], ['dark chocolate', { taste: 'bitter sweet' }], ['mystery', {}],
]);
const twelve = ['sugar', 'lemon', 'coffee', 'salt', 'soy sauce', 'strawberry', 'cranberry', 'vanilla', 'honey', 'lime', 'dark chocolate', 'mystery'];

beforeEach(() => {
  global.fetch = vi.fn(() => Promise.resolve({ ok: false }));
  try { localStorage.clear(); } catch { /* ignore */ }
});

describe('ingredientMarks', () => {
  it('gives one mark per ingredient that has notes, none for one without', () => {
    const marks = ingredientMarks(twelve, nodes);
    expect(marks.map((m) => m.name)).not.toContain('mystery');
    expect(new Set(marks.map((m) => m.name)).size).toBe(marks.length);
    expect(marks.length).toBeGreaterThanOrEqual(9);
    for (const m of marks) { expect(m.t).toBeGreaterThanOrEqual(0); expect(m.t).toBeLessThanOrEqual(1); expect(m.notes.length).toBeGreaterThan(0); }
  });
  it('places an ingredient toward its own strongest note, and different notes in different places', () => {
    const [sugar, lemon] = ingredientMarks(['sugar', 'salt'], nodes);
    expect(sugar.dominant).toBe('sweet');
    expect(lemon.dominant).toBe('salty');
    expect(Math.abs(sugar.angle - lemon.angle)).toBeGreaterThan(5);
  });
  it('ignores a half the chart does not draw', () => {
    const marks = ingredientMarks(['sugar', 'strawberry'], nodes, { taste: false, aroma: true });
    for (const m of marks) expect(m.dominant.startsWith('odor_')).toBe(true);
    expect(ingredientMarks(['sugar'], nodes, { taste: false, aroma: false })).toEqual([]);
  });
  it('thinLabels keeps strongest first and never lets two labels overlap', () => {
    const placed = [
      { name: 'garlic', x: 10, y: 10, t: 0.8 }, { name: 'garlicky', x: 12, y: 11, t: 0.5 }, { name: 'honey', x: -40, y: -30, t: 0.4 },
    ];
    const keep = thinLabels(placed);
    expect(keep.has('garlic')).toBe(true);
    expect(keep.has('garlicky')).toBe(false);
    expect(keep.has('honey')).toBe(true);
  });
});

describe('Flavor map marks', () => {
  it('shows a mark and a listed name for each ingredient with notes, with twelve ingredients, labels thinned', () => {
    render(<RecipeFlavorProfilesCard bowlNames={twelve} nodes={nodes} />);
    fireEvent.click(screen.getByLabelText('Next'));
    const dots = screen.getAllByTestId(/^flavor-map-mark-\d+$/);
    const list = screen.getByTestId('flavor-map-marks-list');
    expect(dots.length).toBeGreaterThanOrEqual(9);
    expect(list.querySelectorAll('li')).toHaveLength(dots.length);
    expect(list.textContent).toMatch(/sugar \(sweet/);
    expect(list.textContent).not.toMatch(/mystery/);
    const labels = screen.queryAllByTestId(/^flavor-map-mark-label-\d+$/);
    expect(labels.length).toBeGreaterThan(0);
    expect(labels.length).toBeLessThanOrEqual(dots.length);
  });
});
