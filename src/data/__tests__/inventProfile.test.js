import { describe, it, expect } from 'vitest';
import { buildFlavorProfile } from '../inventProfile.js';
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
