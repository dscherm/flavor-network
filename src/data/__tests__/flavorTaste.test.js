import { describe, it, expect } from 'vitest';
import { labelWeights, tasteProfile, TASTE_AXES, TASTELESS_WEIGHT, isTasteless } from '../flavorTaste.js';

const LABELS = {
  sugar: 'sweet', lime: 'sour', coffee: 'bitter', salt: 'salty', miso: 'umami salty', chili: 'spicy pungent',
  garlic: 'pungent', gin: 'bitter', bitters: 'bitter', soda: 'neutral', butter: 'rich', cream: 'rich sweet',
  tea: 'astringent', campari: 'bitter sweet sour', odd: 'zesty',
};
const lookup = (k) => LABELS[k];

describe('labelWeights', () => {
  it('one word counts 1.0', () => {
    expect(labelWeights('sweet').axes).toMatchObject({ sweet: 1, sour: 0, heat: 0 });
  });
  it('two words count 1.0 then 0.6', () => {
    expect(labelWeights('umami salty').axes).toMatchObject({ umami: 1, salty: 0.6 });
  });
  it('three words count 1.0, 0.6, 0.35', () => {
    expect(labelWeights('bitter sweet sour').axes).toMatchObject({ bitter: 1, sweet: 0.6, sour: 0.35 });
  });
  it('ignores a fourth word', () => {
    expect(labelWeights('sweet sour bitter salty').axes.salty).toBe(0);
  });
  it('heat comes from spicy and from pungent, and they add', () => {
    expect(labelWeights('spicy').axes.heat).toBe(1);
    expect(labelWeights('pungent').axes.heat).toBe(1);
    expect(labelWeights('spicy pungent').axes.heat).toBeCloseTo(1.6);
    expect(labelWeights('sweet pungent').axes).toMatchObject({ sweet: 1, heat: 0.6 });
  });
  it('astringent gives half its weight to bitter', () => {
    expect(labelWeights('astringent').axes.bitter).toBe(0.5);
    expect(labelWeights('sweet astringent').axes.sweet).toBe(1);
    expect(labelWeights('sweet astringent').axes.bitter).toBeCloseTo(0.3);
  });
  it('neutral and rich contribute to no axis; rich is reported on its own', () => {
    const n = labelWeights('neutral');
    expect(n.neutral).toBe(true);
    expect(n.any).toBe(true);
    expect(TASTE_AXES.every((a) => n.axes[a] === 0)).toBe(true);
    const r = labelWeights('rich');
    expect(TASTE_AXES.every((a) => r.axes[a] === 0)).toBe(true);
    expect(r.rich).toBe(1);
    const rs = labelWeights('rich sweet');
    expect(rs.axes.sweet).toBe(0.6); // the second word keeps its position's weight
    expect(rs.rich).toBe(1);
    expect(isTasteless(r)).toBe(true);
    expect(isTasteless(rs)).toBe(false);
  });
  it('an unknown word is ignored and reported; nothing known means no data', () => {
    const w = labelWeights('zesty sweet');
    expect(w.unknown).toEqual(['zesty']);
    expect(w.axes.sweet).toBe(0.6);
    expect(labelWeights('zesty').any).toBe(false);
    expect(labelWeights('').any).toBe(false);
    expect(labelWeights(null).any).toBe(false);
  });
});

describe('tasteProfile', () => {
  it('equal weights when no amount is known', () => {
    const p = tasteProfile([{ key: 'sugar' }, { key: 'lime' }], lookup);
    expect(p.weighted).toBe(false);
    expect(p.scores.sweet).toBeCloseTo(0.5);
    expect(p.scores.sour).toBeCloseTo(0.5);
  });
  it('2 oz outweighs a dash', () => {
    const p = tasteProfile([{ key: 'gin', amount: '2 oz' }, { key: 'sugar', amount: '1 dash' }], lookup);
    expect(p.weighted).toBe(true);
    expect(p.scores.bitter).toBeGreaterThan(0.9);
    expect(p.scores.sweet).toBeLessThan(0.05);
    const flipped = tasteProfile([{ key: 'gin', amount: '1 dash' }, { key: 'sugar', amount: '2 oz' }], lookup);
    expect(flipped.scores.sweet).toBeGreaterThan(0.9);
  });
  it('accepts { qty, unit } and grams as amounts', () => {
    const p = tasteProfile([{ key: 'sugar', amount: { qty: 1, unit: 'cup' } }, { key: 'lime', amount: 10 }], lookup);
    expect(p.scores.sweet).toBeGreaterThan(p.scores.sour);
  });
  it('an unknown amount takes the mean known weight', () => {
    const p = tasteProfile([{ key: 'sugar', amount: '1 oz' }, { key: 'lime' }], lookup);
    expect(p.scores.sweet).toBeCloseTo(0.5);
    expect(p.scores.sour).toBeCloseTo(0.5);
  });
  it('an ingredient with no label is uncounted, not zero', () => {
    const p = tasteProfile([{ key: 'sugar' }, { key: 'mystery' }, { key: 'odd' }], lookup);
    expect(p.counted).toEqual(['sugar']);
    expect(p.uncounted).toEqual(['mystery', 'odd']);
    expect(p.n).toBe(1);
    expect(p.scores.sweet).toBe(1);
  });
  it('neutral and rich ingredients count as data and dilute at the tasteless rate', () => {
    expect(TASTELESS_WEIGHT).toBeGreaterThan(0);
    expect(TASTELESS_WEIGHT).toBeLessThan(1);
    const dry = tasteProfile([{ key: 'sugar', amount: '1 oz' }], lookup);
    const wet = tasteProfile([{ key: 'sugar', amount: '1 oz' }, { key: 'soda', amount: '4 oz' }], lookup);
    expect(wet.counted).toEqual(['sugar', 'soda']);
    expect(wet.uncounted).toEqual([]);
    expect(wet.scores.sweet).toBeLessThan(dry.scores.sweet);
    expect(wet.scores.sweet).toBeCloseTo(1 / (1 + 4 * TASTELESS_WEIGHT));
    const fat = tasteProfile([{ key: 'sugar', amount: '1 oz' }, { key: 'butter', amount: '1 oz' }], lookup);
    expect(fat.scores.sweet).toBeLessThan(1);
    expect(fat.rich).toBeGreaterThan(0);
  });
  it('dilution never changes which taste leads', () => {
    const lines = (soda) => [{ key: 'campari', amount: '1 oz' }, { key: 'lime', amount: '1 oz' }, { key: 'soda', amount: soda }];
    const order = (p) => TASTE_AXES.filter((a) => p.scores[a] > 0).sort((x, y) => p.scores[y] - p.scores[x]);
    expect(order(tasteProfile(lines('1 oz'), lookup))).toEqual(order(tasteProfile(lines('8 oz'), lookup)));
    expect(order(tasteProfile(lines('1 oz'), lookup, { tastelessWeight: 0 }))).toEqual(order(tasteProfile(lines('1 oz'), lookup, { tastelessWeight: 1 })));
  });
  it('a long drink still tastes of its spirit; the explicit rates bracket the default', () => {
    const lines = [{ key: 'gin', amount: '2 oz' }, { key: 'soda', amount: '6 oz' }];
    const at = (f) => tasteProfile(lines, lookup, { tastelessWeight: f }).scores.bitter;
    expect(at(0)).toBe(1);
    expect(at(1)).toBeCloseTo(0.25);
    expect(at(TASTELESS_WEIGHT)).toBeGreaterThan(at(1));
    expect(at(TASTELESS_WEIGHT)).toBeLessThan(at(0));
  });
  it('all tasteless: counted, but nothing to chart', () => {
    const p = tasteProfile([{ key: 'soda' }, { key: 'butter' }], lookup);
    expect(p.counted).toHaveLength(2);
    expect(p.charted).toBe(false);
    expect(TASTE_AXES.every((a) => p.scores[a] === 0)).toBe(true);
  });
  it('heat from a chili, drivers by label weight times amount', () => {
    const p = tasteProfile([{ key: 'chili', amount: '1 tsp' }, { key: 'garlic', amount: '1 clove' }, { key: 'sugar', amount: '1 tsp' }], lookup);
    expect(p.scores.heat).toBeGreaterThan(p.scores.sweet);
    expect(p.drivers.heat[0]).toBe('chili');
    expect(p.drivers.sweet).toEqual(['sugar']);
  });
  it('scores stay within 0..1 and tolerate empty and bad input', () => {
    const p = tasteProfile([{ key: 'chili' }], lookup);
    expect(Math.max(...TASTE_AXES.map((a) => p.scores[a]))).toBeLessThanOrEqual(1);
    for (const bad of [null, undefined, [], 'x', [null, {}]]) {
      const e = tasteProfile(bad, lookup);
      expect(e.n).toBe(0);
      expect(e.charted).toBe(false);
    }
    expect(tasteProfile([{ key: 'sugar' }], null).n).toBe(0);
  });
});
