import { describe, it, expect } from 'vitest';
import { buildFlavorProfile } from '../inventProfile.js';
import { AXES } from '../recipeProfileAnalysis.js';

const probs = (o) => ({ ...Object.fromEntries(AXES.map((a) => [a, 0])), ...o });
// TASTE comes from the curated label, AROMA from gnnProbs. (Fixture names are NOT in the FLAVOR-4 strength table, so
// these tests exercise the label path; the table has its own tests in flavorStrengths.test.js.)
const nodes = new Map([
  ['sour fruit', { taste: 'sour', gnnProbs: probs({ odor_fruity: 0.6 }) }],
  ['sweet stuff', { taste: 'sweet', gnnProbs: probs({}) }],
  ['bitter root', { taste: 'bitter', gnnProbs: probs({ odor_woody: 0.4 }) }],
]);

describe('buildFlavorProfile', () => {
  it('scores the axes, orders the firing ones, and names keys with no data', () => {
    const p = buildFlavorProfile(['sour fruit', 'sweet stuff', 'bitter root', 'mystery bitters'], nodes);
    expect(Object.keys(p.scores)).toHaveLength(12);
    expect(p.counted).toEqual(['sour fruit', 'sweet stuff', 'bitter root']);
    expect(p.uncounted).toEqual(['mystery bitters']);
    expect(p.scores.sour).toBeCloseTo(1 / 3);
    expect(p.scores.heat).toBe(0);
    expect(p.axes).toContain('sour');
    expect(p.axes).toContain('sweet');
    expect(p.axes).not.toContain('umami');
    const vals = p.axes.map((a) => p.scores[a]);
    expect([...vals].sort((a, b) => b - a)).toEqual(vals);
    expect(p.bars[0]).toMatchObject({ axis: p.axes[0], score: p.scores[p.axes[0]] });
    expect(p.bars[0].label).toBeTruthy();
    expect(p.bars[0].color).toMatch(/^#/);
    expect(p.summary).toMatch(/^On the chart, the strongest signal/);
  });
  it('uses the noun the panel asks for', () => {
    expect(buildFlavorProfile(['sour fruit', 'sweet stuff'], nodes, { noun: 'drink' }).summary).toMatch(/strongest signal/);
    expect(buildFlavorProfile(['x', 'y'], new Map([['x', { taste: 'sweet' }], ['y', { taste: 'sweet' }]]), { noun: 'drink' }).summary).toMatch(/strongest signal/);
    expect(buildFlavorProfile(['x', 'y'], new Map([['x', { taste: 'neutral' }], ['y', { taste: 'neutral' }]]), { noun: 'drink' }).summary).toMatch(/not enough flavor data/i);
  });
  it('an empty list gives an empty profile and never throws', () => {
    for (const keys of [[], null, undefined, 'nope']) {
      const p = buildFlavorProfile(keys, nodes);
      expect(p).toMatchObject({ axes: [], bars: [], counted: [], uncounted: [], summary: '' });
      expect(Object.values(p.scores).every((v) => v === 0)).toBe(true);
    }
  });
  it('null or empty nodes: everything is uncounted, still no throw', () => {
    const p = buildFlavorProfile(['bitter root', 'sour fruit'], null);
    expect(p.counted).toEqual([]);
    expect(p.uncounted).toEqual(['bitter root', 'sour fruit']);
    expect(p.axes).toEqual([]);
    expect(p.summary).toMatch(/flavor data/);
  });
});

describe('summary wording rules', () => {
  const n2 = new Map([
    ['sour fruit', { taste: 'sour' }],
    ['sweet stuff', { taste: 'sweet sour' }],
  ]);
  it('describes the chart and never credits an ingredient', () => {
    const s = buildFlavorProfile(['sour fruit', 'sweet stuff'], n2, { noun: 'drink' }).summary;
    expect(s).toBe('On the chart, the strongest signals are sour and sweet.');
    expect(s).not.toMatch(/from|mostly|lime|syrup/);
  });
  it('one axis reads singular', () => {
    const one = new Map([['a', { taste: 'sour' }], ['b', { taste: 'sour' }]]);
    expect(buildFlavorProfile(['a', 'b'], one, { noun: 'sauce' }).summary).toBe('On the chart, the strongest signal is sour.');
  });
  it('names at most two axes', () => {
    const many = new Map([
      ['a', { taste: 'sweet sour bitter' }],
      ['b', { taste: 'sweet sour bitter' }],
    ]);
    expect(buildFlavorProfile(['a', 'b'], many).summary.match(/ and /g) || []).toHaveLength(1);
  });
  it('fewer than two counted ingredients: not enough to go on', () => {
    expect(buildFlavorProfile(['sour fruit'], n2).summary).toBe('Not enough flavor data for a chart yet.');
    expect(buildFlavorProfile(['sour fruit', 'mystery'], n2).summary).toMatch(/Not enough/);
  });
  it('nothing firing: no strong signal', () => {
    // One neutral ingredient and one with no label: nothing to chart.
    const flat = new Map([['x', { taste: 'neutral' }], ['y', { gnnProbs: probs({}) }]]);
    expect(buildFlavorProfile(['x', 'y'], flat, { noun: 'dish' }).summary).toMatch(/Not enough flavor data/);
  });
  it('still returns drivers and bars', () => {
    const p = buildFlavorProfile(['sour fruit', 'sweet stuff'], n2);
    expect(p.drivers).toBeTruthy();
    expect(p.bars.length).toBeGreaterThan(0);
  });
});
