import { describe, it, expect } from 'vitest';
import {
  AROMA_KEYS,
  computeRecipeAroma,
  cosineSim,
  topAromaOverlap,
  rankByAromaSimilarity,
  formatSimilarityBadge,
} from '../recipeAromaSimilarity.js';

// ---------------------------------------------------------------------------
// Fixture helpers
// ---------------------------------------------------------------------------

/** Build a minimal ingredientsData lookup keyed by ingredient name. */
function mkIngredientsData(entries) {
  const out = {};
  for (const [name, gnnProbs] of Object.entries(entries)) {
    out[name] = { gnnProbs };
  }
  return out;
}

/** Build a gnnProbs object using short aroma keys (fruity, fatty, etc.). */
function gnnProbs(values) {
  const out = {};
  for (const [k, v] of Object.entries(values)) {
    out[`odor_${k}`] = v;
  }
  return out;
}

// ---------------------------------------------------------------------------
// computeRecipeAroma
// ---------------------------------------------------------------------------

describe('computeRecipeAroma', () => {
  it('returns null for empty ingredient list', () => {
    expect(computeRecipeAroma([], {})).toBeNull();
  });

  it('returns null when passed null/undefined ingredient list', () => {
    expect(computeRecipeAroma(null, {})).toBeNull();
    expect(computeRecipeAroma(undefined, {})).toBeNull();
  });

  it('returns null when no ingredients have GNN data', () => {
    const data = mkIngredientsData({ salt: null, sugar: null });
    // null gnnProbs entries are excluded by the filter
    expect(computeRecipeAroma(['salt', 'sugar'], data)).toBeNull();
  });

  it('returns null when ingredients exist in data but have no numeric aroma keys', () => {
    const data = { water: { gnnProbs: { taste_sweet: 0.1 } } };
    expect(computeRecipeAroma(['water'], data)).toBeNull();
  });

  it('happy path: returns mean vector for 3-ingredient fixture', () => {
    const data = mkIngredientsData({
      apple:    gnnProbs({ fruity: 0.9, floral: 0.2, green: 0.4, woody: 0.1, spicy: 0.0, fatty: 0.1 }),
      cinnamon: gnnProbs({ fruity: 0.1, floral: 0.1, green: 0.1, woody: 0.6, spicy: 0.8, fatty: 0.1 }),
      butter:   gnnProbs({ fruity: 0.0, floral: 0.0, green: 0.0, woody: 0.0, spicy: 0.0, fatty: 0.9 }),
    });
    const vec = computeRecipeAroma(['apple', 'cinnamon', 'butter'], data);
    expect(vec).not.toBeNull();
    expect(vec).toHaveLength(AROMA_KEYS.length);
    // odor_fruity mean = (0.9 + 0.1 + 0.0) / 3
    expect(vec[0]).toBeCloseTo(1.0 / 3, 5);
    // odor_fatty mean = (0.1 + 0.1 + 0.9) / 3
    expect(vec[5]).toBeCloseTo(1.1 / 3, 5);
  });

  it('partial GNN coverage: 1 of 3 ingredients has data → returns that single vector', () => {
    const data = {
      apple:    { gnnProbs: gnnProbs({ fruity: 0.8, fatty: 0.2 }) },
      salt:     {},                 // no gnnProbs at all
      mystery:  { gnnProbs: null }, // explicit null
    };
    const vec = computeRecipeAroma(['apple', 'salt', 'mystery'], data);
    expect(vec).not.toBeNull();
    // Single-ingredient mean = the ingredient's own values
    expect(vec[0]).toBeCloseTo(0.8, 5); // odor_fruity
    expect(vec[5]).toBeCloseTo(0.2, 5); // odor_fatty
  });

  it('missing aroma keys in a vector are treated as 0', () => {
    const data = mkIngredientsData({
      apple:    gnnProbs({ fruity: 0.6 }),           // only fruity
      cinnamon: gnnProbs({ woody: 0.5, spicy: 0.4 }), // no fruity
    });
    const vec = computeRecipeAroma(['apple', 'cinnamon'], data);
    // odor_fruity: (0.6 + 0) / 2 = 0.3
    expect(vec[0]).toBeCloseTo(0.3, 5);
    // odor_woody: (0 + 0.5) / 2 = 0.25
    expect(vec[3]).toBeCloseTo(0.25, 5);
  });
});

// ---------------------------------------------------------------------------
// cosineSim
// ---------------------------------------------------------------------------

describe('cosineSim', () => {
  it('identical vectors → 1', () => {
    const v = [0.5, 0.2, 0.8, 0.0, 0.3, 0.6];
    expect(cosineSim(v, v)).toBeCloseTo(1.0, 10);
  });

  it('orthogonal vectors → 0', () => {
    const a = [1, 0, 0, 0, 0, 0];
    const b = [0, 1, 0, 0, 0, 0];
    expect(cosineSim(a, b)).toBe(0);
  });

  it('zero-magnitude vector a → 0', () => {
    expect(cosineSim([0, 0, 0, 0, 0, 0], [1, 0, 0, 0, 0, 0])).toBe(0);
  });

  it('zero-magnitude vector b → 0', () => {
    expect(cosineSim([1, 0, 0, 0, 0, 0], [0, 0, 0, 0, 0, 0])).toBe(0);
  });

  it('both zero-magnitude → 0', () => {
    expect(cosineSim([0, 0, 0, 0, 0, 0], [0, 0, 0, 0, 0, 0])).toBe(0);
  });

  it('null inputs → 0', () => {
    expect(cosineSim(null, [1, 0, 0, 0, 0, 0])).toBe(0);
    expect(cosineSim([1, 0, 0, 0, 0, 0], null)).toBe(0);
    expect(cosineSim(null, null)).toBe(0);
  });

  it('mismatched lengths → 0', () => {
    expect(cosineSim([1, 0], [1, 0, 0])).toBe(0);
  });

  it('proportional vectors → 1', () => {
    expect(cosineSim([1, 2, 3], [2, 4, 6])).toBeCloseTo(1.0, 10);
  });

  it('known result: [1,1,0] vs [1,0,1] → cos(60°) ≈ 0.5', () => {
    expect(cosineSim([1, 1, 0], [1, 0, 1])).toBeCloseTo(0.5, 10);
  });
});

// ---------------------------------------------------------------------------
// topAromaOverlap
// ---------------------------------------------------------------------------

describe('topAromaOverlap', () => {
  it('returns top-2 axes by product', () => {
    // odor_fruity: 0.8*0.9=0.72, odor_fatty: 0.6*0.7=0.42, rest near 0
    const recipe = [0.8, 0.0, 0.0, 0.0, 0.0, 0.6]; // fruity, floral, green, woody, spicy, fatty
    const item   = [0.9, 0.0, 0.0, 0.0, 0.0, 0.7];
    const result = topAromaOverlap(recipe, item, 2);
    expect(result).toEqual(['odor_fruity', 'odor_fatty']);
  });

  it('returns empty when one vector is all zeros', () => {
    const zero = [0, 0, 0, 0, 0, 0];
    const v    = [0.5, 0.3, 0.2, 0.1, 0.4, 0.6];
    expect(topAromaOverlap(zero, v, 2)).toEqual([]);
    expect(topAromaOverlap(v, zero, 2)).toEqual([]);
  });

  it('returns only k axes even when both agree on more than k', () => {
    const v = [0.9, 0.8, 0.7, 0.6, 0.5, 0.4];
    const result = topAromaOverlap(v, v, 2);
    expect(result).toHaveLength(2);
    expect(result[0]).toBe('odor_fruity'); // highest product 0.81
    expect(result[1]).toBe('odor_floral'); // second highest 0.64
  });

  it('returns empty when recipeVec is null', () => {
    expect(topAromaOverlap(null, [0.5, 0.3, 0.2, 0.1, 0.4, 0.6], 2)).toEqual([]);
  });

  it('returns empty when itemVec is null', () => {
    expect(topAromaOverlap([0.5, 0.3, 0.2, 0.1, 0.4, 0.6], null, 2)).toEqual([]);
  });

  it('k=1 returns exactly one result', () => {
    const v = [0.9, 0.1, 0.1, 0.1, 0.1, 0.1];
    expect(topAromaOverlap(v, v, 1)).toHaveLength(1);
    expect(topAromaOverlap(v, v, 1)[0]).toBe('odor_fruity');
  });
});

// ---------------------------------------------------------------------------
// rankByAromaSimilarity
// ---------------------------------------------------------------------------

describe('rankByAromaSimilarity', () => {
  const ingredientsData = mkIngredientsData({
    whiskey: gnnProbs({ fruity: 0.3, woody: 0.8, spicy: 0.6, fatty: 0.1 }),
    sugar:   gnnProbs({ fruity: 0.5, floral: 0.3 }),
    bitters: gnnProbs({ woody: 0.5, spicy: 0.7 }),
    gin:     gnnProbs({ floral: 0.7, green: 0.6, spicy: 0.3 }),
    lime:    gnnProbs({ fruity: 0.9, green: 0.5 }),
    cream:   gnnProbs({ fatty: 0.8, floral: 0.2 }),
  });

  const cocktails = [
    { name: 'Old Fashioned', ingredients: ['whiskey', 'sugar', 'bitters'], image: 'old-fashioned.jpg' },
    { name: 'Gimlet',        ingredients: ['gin', 'lime'],                 image: 'gimlet.jpg' },
    { name: 'White Russian', ingredients: ['cream', 'whiskey'],            image: 'white-russian.jpg' },
  ];

  // recipe vector strongly woody+spicy (matches Old Fashioned best)
  const woodySpicyVec = [0.0, 0.0, 0.0, 0.9, 0.9, 0.0]; // fruity,floral,green,woody,spicy,fatty

  it('returns results in descending similarity order', () => {
    const results = rankByAromaSimilarity(woodySpicyVec, cocktails, ingredientsData, 8);
    expect(results.length).toBeGreaterThan(0);
    for (let i = 1; i < results.length; i++) {
      expect(results[i - 1].similarity).toBeGreaterThanOrEqual(results[i].similarity);
    }
  });

  it('returns ≤ topN results', () => {
    const results = rankByAromaSimilarity(woodySpicyVec, cocktails, ingredientsData, 2);
    expect(results.length).toBeLessThanOrEqual(2);
  });

  it('filters items with no usable GNN vector', () => {
    const noDataItems = [
      { name: 'Mystery', ingredients: ['unknown-a', 'unknown-b'], image: 'x.jpg' },
    ];
    const results = rankByAromaSimilarity(woodySpicyVec, noDataItems, ingredientsData, 8);
    expect(results).toHaveLength(0);
  });

  it('null recipeVector returns empty array', () => {
    expect(rankByAromaSimilarity(null, cocktails, ingredientsData)).toEqual([]);
  });

  it('undefined recipeVector returns empty array', () => {
    expect(rankByAromaSimilarity(undefined, cocktails, ingredientsData)).toEqual([]);
  });

  it('null/undefined items returns empty array', () => {
    expect(rankByAromaSimilarity(woodySpicyVec, null, ingredientsData)).toEqual([]);
    expect(rankByAromaSimilarity(woodySpicyVec, undefined, ingredientsData)).toEqual([]);
  });

  it('each result has similarity, matchedAromas, and item fields', () => {
    const results = rankByAromaSimilarity(woodySpicyVec, cocktails, ingredientsData, 8);
    for (const r of results) {
      expect(typeof r.similarity).toBe('number');
      expect(Array.isArray(r.matchedAromas)).toBe(true);
      expect(r.item).toBeDefined();
    }
  });

  // -------------------------------------------------------------------------
  // Schema round-trip (critical)
  // -------------------------------------------------------------------------
  it('schema round-trip: all item keys pass through unchanged', () => {
    const results = rankByAromaSimilarity(woodySpicyVec, cocktails, ingredientsData, 8);
    expect(results.length).toBeGreaterThan(0);
    const first = results[0];
    expect(first.item.name).toBe('Old Fashioned');
    expect(Array.isArray(first.item.ingredients)).toBe(true);
    expect(first.item.image).toBe('old-fashioned.jpg');
  });

  it('schema round-trip: fixture cocktail with only whiskey having gnnProbs', () => {
    const partialData = mkIngredientsData({
      whiskey: gnnProbs({ fruity: 0.3, woody: 0.8, spicy: 0.6, fatty: 0.1 }),
      // sugar and bitters have no entry → treated as no GNN data
    });
    const singleCocktail = [
      { name: 'Old Fashioned', ingredients: ['whiskey', 'sugar', 'bitters'], image: 'old-fashioned.jpg' },
    ];
    const results = rankByAromaSimilarity(woodySpicyVec, singleCocktail, partialData, 8);
    expect(results).toHaveLength(1);
    expect(results[0].item.name).toBe('Old Fashioned');
    expect(Array.isArray(results[0].item.ingredients)).toBe(true);
    expect(results[0].item.image).toBe('old-fashioned.jpg');
  });
});

// ---------------------------------------------------------------------------
// formatSimilarityBadge
// ---------------------------------------------------------------------------

describe('formatSimilarityBadge', () => {
  it('0.823 → "82% match"', () => {
    expect(formatSimilarityBadge(0.823)).toMatch(/^82% match$/);
  });

  it('boundary: 0.0 → "0% match"', () => {
    expect(formatSimilarityBadge(0.0)).toBe('0% match');
  });

  it('boundary: 1.0 → "100% match"', () => {
    expect(formatSimilarityBadge(1.0)).toBe('100% match');
  });

  it('null → "0% match"', () => {
    expect(formatSimilarityBadge(null)).toBe('0% match');
  });

  it('undefined → "0% match"', () => {
    expect(formatSimilarityBadge(undefined)).toBe('0% match');
  });

  it('rounds correctly: 0.505 → "51% match"', () => {
    expect(formatSimilarityBadge(0.505)).toBe('51% match');
  });

  it('rounds correctly: 0.499 → "50% match"', () => {
    expect(formatSimilarityBadge(0.499)).toBe('50% match');
  });
});
