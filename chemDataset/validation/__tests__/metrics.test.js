import { describe, it, expect } from 'vitest';
import {
  precisionAt,
  recallAt,
  beyondBookAt,
  axisDistribution,
  verdictGate,
  crossSourceAgreement,
  canonicalPairKey,
} from '../lib/metrics.js';

describe('chemDataset/validation — metrics', () => {
  it('precisionAt exact correctness on a 5-pairing oracle', () => {
    const ranked = ['a|b', 'c|d', 'e|f', 'g|h', 'i|j'];
    const gt = new Set(['a|b', 'e|f', 'i|j']);
    // top-3 hits {a|b, e|f} → 2/3
    expect(precisionAt(3, ranked, gt)).toBeCloseTo(2 / 3, 6);
    // top-5 hits {a|b, e|f, i|j} → 3/5
    expect(precisionAt(5, ranked, gt)).toBeCloseTo(3 / 5, 6);
    // top-1 hit → 1/1
    expect(precisionAt(1, ranked, gt)).toBeCloseTo(1, 6);
    // k = 0
    expect(precisionAt(0, ranked, gt)).toBe(0);
    // empty ranked
    expect(precisionAt(5, [], gt)).toBe(0);
  });

  it('recallAt exact correctness', () => {
    const ranked = ['a|b', 'c|d', 'e|f', 'g|h', 'i|j'];
    const gt = new Set(['a|b', 'e|f', 'i|j', 'k|l']); // |GT|=4
    // top-3 captures 2 of 4 → 0.5
    expect(recallAt(3, ranked, gt)).toBeCloseTo(0.5, 6);
    // top-5 captures 3 of 4 → 0.75
    expect(recallAt(5, ranked, gt)).toBeCloseTo(0.75, 6);
    // empty GT
    expect(recallAt(5, ranked, new Set())).toBe(0);
  });

  it('beyondBookAt complement: precision + beyondBook fraction = 1', () => {
    const ranked = ['a|b', 'c|d', 'e|f', 'g|h', 'i|j'];
    const gt = new Set(['a|b', 'e|f']);
    const k = 5;
    const p = precisionAt(k, ranked, gt);
    const bb = beyondBookAt(k, ranked, gt);
    // bb is a count; bb/k is the complement fraction
    expect(p + bb / k).toBeCloseTo(1, 6);
    // sanity: bb should equal k - hits = 5 - 2 = 3
    expect(bb).toBe(3);
  });

  it('verdictGate boundary at n=14 (insufficient) vs n=15 (ready)', () => {
    const counts = {
      'cross-aroma': 15,
      'cross-cuisine': 14,
      'absent-from-books': 100,
      'chem-bridged-rare': 0,
    };
    const v = verdictGate(counts, 15);
    expect(v['cross-aroma']).toBe('ready');
    expect(v['cross-cuisine']).toBe('insufficient');
    expect(v['absent-from-books']).toBe('ready');
    expect(v['chem-bridged-rare']).toBe('insufficient');
  });

  it('axisDistribution aggregates correctly', () => {
    const gt = [
      { a: 'salmon', b: 'dill', axes_validated: ['cross-aroma'] },
      { a: 'tomato', b: 'basil', axes_validated: ['cross-aroma'] },
      { a: 'chocolate', b: 'blue cheese', axes_validated: ['cross-cuisine', 'cross-aroma', 'absent-from-books'] },
      { a: 'mushroom', b: 'coffee', axes_validated: ['chem-bridged-rare', 'absent-from-books'] },
      { a: 'x', b: 'y' }, // no axes
    ];
    const d = axisDistribution(gt);
    expect(d['cross-aroma']).toBe(3);
    expect(d['cross-cuisine']).toBe(1);
    expect(d['absent-from-books']).toBe(2);
    expect(d['chem-bridged-rare']).toBe(1);
  });

  it('crossSourceAgreement jaccard on synthetic FB-only and Matrix-only sets', () => {
    const gt = [
      { a: 'salmon', b: 'dill', sources: [{ ref: 'Flavor Bible' }] },
      { a: 'tomato', b: 'basil', sources: [{ ref: 'Flavor Bible' }] },
      { a: 'mushroom', b: 'coffee', sources: [{ ref: 'Flavor Matrix' }] },
      // overlap: same pair in both source-only sets
      { a: 'pork', b: 'apple', sources: [{ ref: 'Flavor Bible (Page/Dornenburg)' }] },
      { a: 'pork', b: 'apple', sources: [{ ref: 'Flavor Matrix (Briscione)' }] },
    ];
    // FB-only = {salmon|dill, tomato|basil, apple|pork}
    // Matrix-only = {coffee|mushroom, apple|pork}
    // intersection = {apple|pork} = 1
    // union = 3 + 2 - 1 = 4
    const j = crossSourceAgreement(gt);
    expect(j).toBeCloseTo(1 / 4, 6);
  });

  it('crossSourceAgreement returns 0 when one side is empty', () => {
    const gt = [
      { a: 'salmon', b: 'dill', sources: [{ ref: 'Flavor Bible' }] },
    ];
    expect(crossSourceAgreement(gt)).toBe(0);
  });

  it('canonicalPairKey is order-independent and lowercases', () => {
    expect(canonicalPairKey('Salmon', 'Dill')).toBe(canonicalPairKey('dill', 'salmon'));
    expect(canonicalPairKey('A', 'B')).toBe('a|b');
    expect(canonicalPairKey('B', 'A')).toBe('a|b');
  });
});
