import { describe, it, expect } from 'vitest';
import { buildFlavorProfile, ATTRIBUTION_MIN } from '../inventProfile.js';
import { AXES } from '../recipeProfileAnalysis.js';

const probs = (o) => ({ ...Object.fromEntries(AXES.map((a) => [a, 0])), ...o });
const nodes = new Map([
  ['lime juice', { gnnProbs: probs({ sour: 0.9, odor_fruity: 0.6 }) }],
  ['simple syrup', { gnnProbs: probs({ sweet: 0.8 }) }],
  ['gin', { gnnProbs: probs({ odor_woody: 0.4, bitter: 0.2 }) }],
]);

describe('buildFlavorProfile', () => {
  it('scores the axes, orders the firing ones, and names keys with no data', () => {
    const p = buildFlavorProfile(['lime juice', 'simple syrup', 'gin', 'mystery bitters'], nodes);
    expect(Object.keys(p.scores)).toHaveLength(11);
    expect(p.counted).toEqual(['lime juice', 'simple syrup', 'gin']);
    expect(p.uncounted).toEqual(['mystery bitters']);
    expect(p.scores.sour).toBeCloseTo(0.3);
    expect(p.axes[0]).toBe('sour');
    expect(p.axes).toContain('sour');
    expect(p.axes).not.toContain('umami');
    const vals = p.axes.map((a) => p.scores[a]);
    expect([...vals].sort((a, b) => b - a)).toEqual(vals);
    expect(p.bars[0]).toMatchObject({ axis: p.axes[0], score: p.scores[p.axes[0]] });
    expect(p.bars[0].label).toBeTruthy();
    expect(p.bars[0].color).toMatch(/^#/);
    expect(p.summary).toMatch(/This recipe/);
  });
  it('uses the noun the panel asks for', () => {
    expect(buildFlavorProfile(['lime juice', 'simple syrup'], nodes, { noun: 'drink' }).summary).toMatch(/This drink/);
  });
  it('an empty list gives an empty profile and never throws', () => {
    for (const keys of [[], null, undefined, 'nope']) {
      const p = buildFlavorProfile(keys, nodes);
      expect(p).toMatchObject({ axes: [], bars: [], counted: [], uncounted: [], summary: '' });
      expect(Object.values(p.scores).every((v) => v === 0)).toBe(true);
    }
  });
  it('null or empty nodes: everything is uncounted, still no throw', () => {
    const p = buildFlavorProfile(['gin', 'lime juice'], null);
    expect(p.counted).toEqual([]);
    expect(p.uncounted).toEqual(['gin', 'lime juice']);
    expect(p.axes).toEqual([]);
    expect(p.summary).toMatch(/flavor data/);
  });
});

describe('summary wording rules', () => {
  const n2 = new Map([
    ['lime juice', { gnnProbs: probs({ sour: 0.9 }) }],
    ['simple syrup', { gnnProbs: probs({ sweet: 0.3, bitter: 0.2 }) }],
    ['butter', { gnnProbs: probs({ bitter: 0.3, sweet: 0.2 }) }],
  ]);
  it('credits an ingredient only when its own score on the axis is at least ATTRIBUTION_MIN', () => {
    expect(ATTRIBUTION_MIN).toBe(0.6);
    const s = buildFlavorProfile(['lime juice', 'simple syrup'], n2, { noun: 'drink' }).summary;
    expect(s).toBe('This drink leans sour (mostly from lime juice) and sweet.');
  });
  it('never blames a weak contributor: no "from" when nobody is clearly high', () => {
    const s = buildFlavorProfile(['simple syrup', 'butter'], n2, { noun: 'sauce' }).summary;
    expect(s).toMatch(/^This sauce leans /);
    expect(s).not.toMatch(/from/);
  });
  it('names at most two axes', () => {
    const many = new Map([
      ['a', { gnnProbs: probs({ sweet: 0.5, sour: 0.5, bitter: 0.5 }) }],
      ['b', { gnnProbs: probs({ sweet: 0.5, sour: 0.5, bitter: 0.5 }) }],
    ]);
    const s = buildFlavorProfile(['a', 'b'], many).summary;
    expect(s.match(/ and /g) || []).toHaveLength(1);
  });
  it('fewer than two counted ingredients: not enough to go on', () => {
    expect(buildFlavorProfile(['lime juice'], n2).summary).toBe('Not enough flavor data in this list to go on yet.');
    expect(buildFlavorProfile(['lime juice', 'mystery'], n2).summary).toMatch(/Not enough/);
  });
  it('nothing firing: says no single flavor stands out', () => {
    const flat = new Map([['x', { gnnProbs: probs({}) }], ['y', { gnnProbs: probs({}) }]]);
    expect(buildFlavorProfile(['x', 'y'], flat, { noun: 'dish' }).summary).toBe('No single flavor stands out in this dish.');
  });
});
