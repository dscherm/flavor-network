import { describe, it, expect } from 'vitest';
import { profilePair, changeText, MARK_THRESHOLD } from '../profileGridPair.js';
import { AXES, recipeAxisProfile, profileDelta } from '../recipeProfileAnalysis.js';

const z = () => Object.fromEntries(AXES.map((a) => [a, 0]));
const mk = (taste, aroma = {}) => ({ taste, gnnProbs: { ...z(), ...aroma }, category: 'spice', cuisines: [] });
const nodes = new Map(Object.entries({
  honey: mk('sweet'),
  lemon: mk('sour'),
  cinnamon: mk('sweet', { odor_spicy: 0.9 }),
}));

describe('profilePair', () => {
  it('marks exactly the cells whose score the existing delta code changes by more than the threshold', () => {
    const { scores, n, tasteDrawn, aromaDrawn } = recipeAxisProfile(['honey', 'lemon'], nodes);
    const delta = profileDelta('cinnamon', scores, n, nodes, { drawn: { taste: tasteDrawn, aroma: aromaDrawn } });
    const pair = profilePair(scores, delta);
    const clamp = (v) => Math.max(0, Math.min(1, v));
    const expected = AXES.filter((a) => Math.abs(clamp(scores[a] + delta[a]) - clamp(scores[a])) > MARK_THRESHOLD);
    expect(Object.keys(pair.marks).sort()).toEqual([...expected].sort());
    expect(expected).toContain('odor_spicy');
    expect(pair.marks.odor_spicy).toBe('up');
    for (const c of pair.after.cells) {
      expect(c.score === 0 || Math.abs(c.score - clamp(scores[c.axis] + delta[c.axis])) < 1e-9).toBe(true);
    }
  });

  it('draws both grids on one scale: an unchanged note has the same dot radius in both', () => {
    const before = { ...z(), sweet: 0.4, sour: 0.2 };
    const delta = { ...z(), odor_spicy: 0.6 };
    const pair = profilePair(before, delta);
    expect(pair.after.scale).toBe(pair.before.scale);
    expect(pair.scale).toBeCloseTo(0.6);
    for (const axis of ['sweet', 'sour']) {
      const b = pair.before.cells.find((c) => c.axis === axis);
      const a = pair.after.cells.find((c) => c.axis === axis);
      expect(a.radius).toBe(b.radius);
      expect(a.radius).toBeGreaterThan(0);
    }
    expect(pair.before.cells.find((c) => c.axis === 'odor_spicy').on).toBe(false);
    expect(pair.after.cells.find((c) => c.axis === 'odor_spicy').radius).toBe(1);
  });

  it('a note that drops is marked down; changes under the threshold are not marked', () => {
    const pair = profilePair({ ...z(), sour: 0.5, sweet: 0.3 }, { ...z(), sour: -0.2, sweet: 0.01 });
    expect(pair.marks).toEqual({ sour: 'down' });
  });

  it('names the two notes that move most, and the labelled set is those two', () => {
    const pair = profilePair({ ...z(), sour: 0.5 }, { ...z(), odor_fatty: 0.4, sour: -0.2, sweet: 0.1 });
    expect(pair.text).toBe('More creamy, less sour');
    expect([...pair.labelled].sort()).toEqual(['odor_fatty', 'sour']);
  });

  it('copes with an empty profile and no delta', () => {
    const pair = profilePair({}, null);
    expect(pair.text).toBe('Hardly changes the flavor');
    expect(pair.before.cells).toHaveLength(17);
  });
});

describe('changeText', () => {
  it('words ups, downs, both ups, both downs', () => {
    expect(changeText([{ axis: 'sweet', diff: 1 }, { axis: 'sour', diff: 1 }])).toBe('More sweet and sour');
    expect(changeText([{ axis: 'sweet', diff: -1 }, { axis: 'sour', diff: -1 }])).toBe('Less sweet and sour');
    expect(changeText([])).toBe('Hardly changes the flavor');
  });
});
