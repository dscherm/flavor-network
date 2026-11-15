import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import list from '../flavorPlaceholders.json' with { type: 'json' };
import { isPlaceholderTaste, isPlaceholderAroma, hasRealTaste, hasRealAroma } from '../flavorPlaceholders.js';
import { buildFlavorPlaceholders, MIN_SHARED } from '../../../scripts/buildFlavorPlaceholders.mjs';
import { buildFlavorProfile } from '../inventProfile.js';
import {
  recipeAxisProfile, recipeAxisProfileWeighted, rankByAxisImpact, buildAxisEnhancements, profileDelta,
  describeRecipeProfile, drawRule, AXES, NO_CHART_LINE,
} from '../recipeProfileAnalysis.js';

const raw = JSON.parse(readFileSync('public/proDataset/gnn_entropy.json', 'utf8'));
const nodes = new Map(Object.entries(raw).filter(([k, v]) => !k.startsWith('_') && v?.probs).map(([k, v]) => [k, { gnnProbs: v.probs }]));
const probsOf = (name) => raw[name].probs;

const z = () => Object.fromEntries(AXES.map((a) => [a, 0]));
const real = (o) => ({ ...z(), ...o });
const PLACEHOLDER_TASTE = { sweet: 0.6094, sour: 0.6218, bitter: 0.5795, salty: 0.1521, umami: 0.1351 };
const PLACEHOLDER_AROMA = { odor_fruity: 0.0314, odor_floral: 0.0017, odor_green: 0.0529, odor_woody: 0.0987, odor_spicy: 0.0957, odor_fatty: 0.0096 };

describe('the generated placeholder list', () => {
  it('matches what the script generates from gnn_entropy.json', () => {
    expect(buildFlavorPlaceholders(raw)).toEqual(list);
    expect(list.minShared).toBe(MIN_SHARED);
  });
  it('holds the 1,526-ingredient taste vector and the 2,06x-ingredient aroma vector', () => {
    expect(Object.values(list.taste)).toContain(1526);
    expect(Math.max(...Object.values(list.aroma))).toBeGreaterThanOrEqual(2062);
    expect(Math.min(...Object.values(list.taste), ...Object.values(list.aroma))).toBeGreaterThan(MIN_SHARED);
  });
  it('treats sugar, salt, coffee and lemon as having no real taste (real data file)', () => {
    for (const name of ['sugar', 'salt', 'coffee', 'lemon', 'gin']) {
      expect(isPlaceholderTaste(probsOf(name))).toBe(true);
      expect(hasRealTaste(probsOf(name))).toBe(false);
    }
  });
  it('does not flag a vector shared by a handful of aliases (vanilla, chicken)', () => {
    expect(isPlaceholderTaste(probsOf('vanilla'))).toBe(false);
    expect(isPlaceholderTaste(probsOf('chicken'))).toBe(false);
    expect(isPlaceholderAroma(probsOf('chicken'))).toBe(false);
  });
});

describe('isPlaceholder*', () => {
  it('judges taste and aroma separately', () => {
    const mixed = { ...PLACEHOLDER_TASTE, odor_fruity: 0.7, odor_floral: 0.1, odor_green: 0.2, odor_woody: 0.3, odor_spicy: 0.1, odor_fatty: 0.4 };
    expect(isPlaceholderTaste(mixed)).toBe(true);
    expect(isPlaceholderAroma(mixed)).toBe(false);
    expect(hasRealAroma(mixed)).toBe(true);
    expect(hasRealTaste(mixed)).toBe(false);
  });
  it('is false for missing or partial vectors', () => {
    expect(isPlaceholderTaste(null)).toBe(false);
    expect(isPlaceholderAroma({ odor_fruity: 0.0314 })).toBe(false);
    expect(hasRealTaste({})).toBe(false);
  });
});

describe('the draw rule', () => {
  it('needs two ingredients and half of them', () => {
    expect(drawRule(4, 2, 0)).toEqual({ tasteDrawn: true, aromaDrawn: false });
    expect(drawRule(5, 2, 3)).toEqual({ tasteDrawn: false, aromaDrawn: true });
    expect(drawRule(1, 1, 1)).toEqual({ tasteDrawn: false, aromaDrawn: false });
  });

  it('a recipe of ingredients with no taste label, no taste line and no aroma line draws nothing and says so', () => {
    // FLAVOR-5: the model's values (placeholders or not) are never read; only labels, the strength table and the aroma table.
    const keys = ['zzz one', 'zzz two', 'zzz three', 'zzz four'];
    const p = buildFlavorProfile(keys, nodes, { noun: 'drink' });
    expect(p.drawn).toBe(false);
    expect(p.bars).toEqual([]);
    expect(p.counted).toEqual([]);
    expect(p.uncounted).toEqual(keys);
    expect(p.summary).toBe(NO_CHART_LINE);
  });

  it('draws taste only when the taste label is there and aroma is a placeholder (halves are independent)', () => {
    const n = new Map([
      ['a', { taste: 'sweet', gnnProbs: { ...PLACEHOLDER_AROMA } }],
      ['b', { taste: 'sour sweet', gnnProbs: { ...PLACEHOLDER_AROMA } }],
    ]);
    const p = buildFlavorProfile(['a', 'b'], n);
    expect(p.tasteDrawn).toBe(true);
    expect(p.aromaDrawn).toBe(false);
    expect(p.counted).toEqual(['a', 'b']);
    expect(p.bars.length).toBeGreaterThan(0);
    expect(p.bars.every((b) => ['sweet', 'sour', 'bitter', 'salty', 'umami', 'heat'].includes(b.axis))).toBe(true);
    expect(AXES.filter((a) => a.startsWith('odor_')).every((a) => p.scores[a] === 0)).toBe(true);
  });

  it('draws aroma only when there is an aroma line and no taste label (the model values never count)', () => {
    const fake = { gnnProbs: { ...PLACEHOLDER_TASTE, odor_fruity: 0.9, odor_floral: 0.1, odor_green: 0.1, odor_woody: 0.1, odor_spicy: 0.1, odor_fatty: 0.1 } };
    const n = new Map([['lavender', fake], ['rose water', fake]]);
    const p = recipeAxisProfile(['lavender', 'rose water'], n);
    expect(p.tasteDrawn).toBe(false);
    expect(p.aromaDrawn).toBe(true);
    expect(p.scores.sweet).toBe(0);
    expect(p.scores.odor_floral).toBeCloseTo(1);
    expect(p.scores.odor_fruity).toBe(0);
    const w = recipeAxisProfileWeighted(['lavender', 'rose water'], n);
    expect(w.tasteDrawn).toBe(false);
    expect(w.scores.odor_floral).toBeCloseTo(1);
  });

  it('one real ingredient among many placeholders is not enough', () => {
    const n = new Map([
      ['a', { gnnProbs: real({ sweet: 0.9 }) }],
      ['b', { gnnProbs: PLACEHOLDER_TASTE }], ['c', { gnnProbs: PLACEHOLDER_TASTE }],
    ]);
    expect(recipeAxisProfile(['a', 'b', 'c'], n).drawn).toBe(false);
    expect(recipeAxisProfileWeighted(['a', 'b', 'c'], n).drawn).toBe(false);
  });

  it('the description says nothing about a half that is not drawn', () => {
    const text = describeRecipeProfile({ scores: { ...z(), odor_fruity: 0.7 }, n: 2, tasteDrawn: false, aromaDrawn: true });
    expect(text).not.toMatch(/mild and even|leans|leads with/);
    expect(text).toMatch(/fruity/i);
    expect(describeRecipeProfile({ scores: z(), n: 2, tasteDrawn: false, aromaDrawn: false })).toBe(NO_CHART_LINE);
  });
});

describe('boost / temper ranking', () => {
  const cands = new Map([
    ['unlabelled stuff', { gnnProbs: PLACEHOLDER_TASTE }],
    ['jam', { taste: 'sweet', gnnProbs: { ...PLACEHOLDER_AROMA } }],
  ]);
  const scores = z();
  it('never ranks a candidate on placeholder values', () => {
    expect(rankByAxisImpact(['unlabelled stuff'], 'sweet', scores, 3, cands)).toEqual([]);
    expect(rankByAxisImpact(['unlabelled stuff'], 'sour', scores, 3, cands, { mode: 'temper' })).toEqual([]);
    expect(profileDelta('unlabelled stuff', scores, 3, cands)).toBeNull();
  });
  it('still ranks a candidate with real values', () => {
    expect(rankByAxisImpact(['unlabelled stuff', 'jam'], 'sweet', scores, 3, cands).map((r) => r.name)).toEqual(['jam']);
  });
  it('returns nothing when the recipe half is not drawn', () => {
    const drawn = { taste: false, aroma: false };
    expect(rankByAxisImpact(['jam'], 'sweet', scores, 3, cands, { drawn })).toEqual([]);
    expect(buildAxisEnhancements(['sweet'], ['jam'], scores, 3, cands, { drawn })).toEqual([]);
    expect(buildAxisEnhancements(['sweet'], ['jam'], scores, 3, cands, { drawn: { taste: true, aroma: false } })).toHaveLength(1);
  });
});

