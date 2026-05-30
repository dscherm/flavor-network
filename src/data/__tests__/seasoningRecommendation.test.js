import { describe, it, expect } from 'vitest';
import {
  rankSeasonings,
  deriveSeasoningPool,
  isSeasoning,
  SEASONING_CATEGORIES,
} from '../seasoningRecommendation.js';
import { makeBowlEntry } from '../bowlEntry.js';

const NODES = new Map([
  ['salt',     { category: 'seasoning' }],
  ['pepper',   { category: 'spice' }],
  ['cinnamon', { category: 'spice' }],
  ['vanilla',  { category: 'spice' }],
  ['basil',    { category: 'herb' }],
  ['oregano',  { category: 'herb' }],
  ['mint',     { category: 'herb' }],
  ['garlic',   { category: 'aromatic' }],
  ['ginger',   { category: 'aromatic' }],
  // Non-seasoning entries:
  ['tomato',   { category: 'vegetable' }],
  ['beef',     { category: 'protein' }],
  ['butter',   { category: 'fat' }],
  ['cumin',    { category: 'spice' }],
  ['paprika',  { category: 'spice' }],
  ['nutmeg',   { category: 'spice' }],
]);

const CTX_BASE = {
  recipePairs: {
    tomato: { basil: 1000, oregano: 600, garlic: 800, pepper: 500, cinnamon: 4, vanilla: 2 },
    basil:  { tomato: 1000, oregano: 700, garlic: 500, mint: 400, pepper: 300 },
    beef:   { pepper: 900, cumin: 700, paprika: 600, garlic: 500, cinnamon: 4, vanilla: 2, mint: 50 },
    apple:  { cinnamon: 900, vanilla: 700, mint: 200, ginger: 600, nutmeg: 500 },
  },
  globalCount: {
    salt: 9000, pepper: 8000, basil: 3000, oregano: 1200, garlic: 4500,
    cinnamon: 1500, vanilla: 1800, ginger: 1100, mint: 900,
    cumin: 800, paprika: 700, nutmeg: 600,
    tomato: 5000, beef: 6000, apple: 4000, butter: 7000,
  },
  nodes: NODES,
};

describe('isSeasoning + deriveSeasoningPool', () => {
  it('treats spice / herb / aromatic / seasoning categories as seasonings', () => {
    for (const c of SEASONING_CATEGORIES) {
      expect(isSeasoning({ category: c })).toBe(true);
    }
  });

  it('rejects vegetable / protein / fat / fruit categories', () => {
    for (const c of ['vegetable', 'protein', 'fat', 'fruit', 'grain', 'sweetener']) {
      expect(isSeasoning({ category: c })).toBe(false);
    }
  });

  it('returns false for missing/empty category', () => {
    expect(isSeasoning(null)).toBe(false);
    expect(isSeasoning({})).toBe(false);
    expect(isSeasoning({ category: '' })).toBe(false);
  });

  it('deriveSeasoningPool returns all seasoning-category entries (Map input)', () => {
    const pool = deriveSeasoningPool(NODES);
    expect(pool).toContain('salt');
    expect(pool).toContain('pepper');
    expect(pool).toContain('cinnamon');
    expect(pool).toContain('basil');
    expect(pool).toContain('mint');
    expect(pool).toContain('garlic');
    expect(pool).not.toContain('tomato');
    expect(pool).not.toContain('beef');
    expect(pool).not.toContain('butter');
  });

  it('deriveSeasoningPool handles plain Object input', () => {
    const obj = { salt: { category: 'seasoning' }, beef: { category: 'protein' } };
    const pool = deriveSeasoningPool(obj);
    expect(pool).toEqual(['salt']);
  });

  it('deriveSeasoningPool returns [] for null/undefined nodes', () => {
    expect(deriveSeasoningPool(null)).toEqual([]);
    expect(deriveSeasoningPool(undefined)).toEqual([]);
  });
});

describe('rankSeasonings — §15.3 seasoning ranker + recipe-type gate', () => {
  it('returns [] for empty bowl', () => {
    expect(rankSeasonings([], null, CTX_BASE)).toEqual([]);
  });

  it('returns [] when ctx missing recipePairs / globalCount / nodes', () => {
    const bowl = [makeBowlEntry('tomato')];
    expect(rankSeasonings(bowl, null, {})).toEqual([]);
    expect(rankSeasonings(bowl, null, { recipePairs: CTX_BASE.recipePairs })).toEqual([]);
    expect(rankSeasonings(bowl, null, { recipePairs: CTX_BASE.recipePairs, globalCount: CTX_BASE.globalCount })).toEqual([]);
  });

  it('surfaces seasonings only — never non-seasoning candidates', () => {
    const bowl = [makeBowlEntry('tomato'), makeBowlEntry('beef')];
    const ranked = rankSeasonings(bowl, null, CTX_BASE);
    for (const r of ranked) {
      const node = NODES.get(r.name);
      expect(node).toBeTruthy();
      expect(SEASONING_CATEGORIES.has(node.category)).toBe(true);
    }
  });

  it('respects FAMILIARITY_FLOOR via rankSuggestions (no obscure seasonings)', () => {
    // 'nutmeg' has globalCount=600 which is well above the floor of 50,
    // so it should NOT be gated out for an apple-based bowl.
    const bowl = [makeBowlEntry('apple')];
    const ranked = rankSeasonings(bowl, null, CTX_BASE);
    expect(ranked.find((r) => r.name === 'nutmeg')).toBeTruthy();
  });

  it('returns top K results (default 5)', () => {
    const bowl = [makeBowlEntry('beef'), makeBowlEntry('tomato')];
    const ranked = rankSeasonings(bowl, null, CTX_BASE);
    expect(ranked.length).toBeLessThanOrEqual(5);
  });

  it('honors custom K', () => {
    const bowl = [makeBowlEntry('beef')];
    const ranked = rankSeasonings(bowl, null, CTX_BASE, 2);
    expect(ranked.length).toBeLessThanOrEqual(2);
  });

  it('recipeType="dessert" filters to sweet-friendly seasonings only', () => {
    const bowl = [makeBowlEntry('apple')];
    const ranked = rankSeasonings(bowl, null, { ...CTX_BASE, recipeType: 'dessert' });
    expect(ranked.length).toBeGreaterThan(0);
    for (const r of ranked) {
      const lower = r.name.toLowerCase();
      const SWEET = new Set([
        'cinnamon', 'cardamom', 'anise', 'star anise', 'nutmeg', 'cloves',
        'vanilla', 'mace', 'allspice', 'ginger', 'mint', 'lavender',
        'rose', 'orange blossom', 'fennel seed',
      ]);
      expect(SWEET.has(lower), `${r.name} should be in dessert allow-list`).toBe(true);
    }
  });

  it('recipeType="dessert" hides savory-only spices (pepper, paprika, cumin)', () => {
    const bowl = [makeBowlEntry('apple'), makeBowlEntry('beef')];
    const ranked = rankSeasonings(bowl, null, { ...CTX_BASE, recipeType: 'dessert' });
    expect(ranked.find((r) => r.name === 'pepper')).toBeUndefined();
    expect(ranked.find((r) => r.name === 'paprika')).toBeUndefined();
    expect(ranked.find((r) => r.name === 'cumin')).toBeUndefined();
  });

  it('recipeType="main" surfaces savory seasonings (no sweet-only gate)', () => {
    const bowl = [makeBowlEntry('beef'), makeBowlEntry('tomato')];
    const ranked = rankSeasonings(bowl, null, { ...CTX_BASE, recipeType: 'main' });
    // pepper / cumin / paprika are appropriate for main and should be surfaceable
    const names = new Set(ranked.map((r) => r.name));
    expect(names.has('pepper') || names.has('cumin') || names.has('paprika')).toBe(true);
  });

  it('recipeType="sauce" enables all seasoning classes (no tone gate)', () => {
    const bowl = [makeBowlEntry('apple'), makeBowlEntry('beef')];
    const ranked = rankSeasonings(bowl, null, { ...CTX_BASE, recipeType: 'sauce' });
    expect(ranked.length).toBeGreaterThan(0);
  });

  it('recipeType=null imposes no gate (savory default)', () => {
    const bowl = [makeBowlEntry('beef')];
    const ranked = rankSeasonings(bowl, null, CTX_BASE);
    expect(ranked.length).toBeGreaterThan(0);
  });

  it('bowl members are never returned as seasoning candidates', () => {
    const bowl = [makeBowlEntry('basil'), makeBowlEntry('garlic')];
    const ranked = rankSeasonings(bowl, null, CTX_BASE);
    for (const r of ranked) {
      expect(['basil', 'garlic']).not.toContain(r.name);
    }
  });

  it('passes focalKey through to rankSuggestions (focal-weighted ordering)', () => {
    const bowl = [makeBowlEntry('tomato'), makeBowlEntry('beef')];
    const focalA = rankSeasonings(bowl, 'tomato', CTX_BASE);
    const focalB = rankSeasonings(bowl, 'beef', CTX_BASE);
    // Different focals produce different score distributions, so the
    // serialized lists should not be byte-identical for this fixture.
    expect(JSON.stringify(focalA)).not.toBe(JSON.stringify(focalB));
  });
});
