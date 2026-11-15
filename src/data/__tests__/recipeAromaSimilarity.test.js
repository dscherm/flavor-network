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
// computeRecipeAroma: the hand-tuned aroma table (FLAVOR-6), not the model's per-ingredient values
// ---------------------------------------------------------------------------

describe('computeRecipeAroma', () => {
  it('returns null for empty, null and undefined lists', () => {
    expect(computeRecipeAroma([])).toBeNull();
    expect(computeRecipeAroma(null)).toBeNull();
    expect(computeRecipeAroma(undefined)).toBeNull();
  });

  it('returns null when no ingredient has an aroma of its own', () => {
    expect(computeRecipeAroma(['salt', 'sugar'])).toBeNull();
    expect(computeRecipeAroma(['not-a-real-ingredient'])).toBeNull();
  });

  it('gives a 6-vector in AROMA_KEYS order from the table: mint is green, butter is fatty', () => {
    const mint = computeRecipeAroma(['mint']);
    expect(mint).toHaveLength(AROMA_KEYS.length);
    expect(mint.indexOf(Math.max(...mint))).toBe(AROMA_KEYS.indexOf('odor_green'));
    const butter = computeRecipeAroma(['butter']);
    expect(butter.indexOf(Math.max(...butter))).toBe(AROMA_KEYS.indexOf('odor_fatty'));
  });

  it('is the same profile the chart draws: lemon leads fruity', () => {
    const v = computeRecipeAroma(['lemon', 'sugar']);
    expect(v.indexOf(Math.max(...v))).toBe(AROMA_KEYS.indexOf('odor_fruity'));
  });

  it('does not read the model: ingredientsData is not an argument any more', () => {
    expect(computeRecipeAroma.length).toBe(1);
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
  const cocktails = [
    { name: 'Gimlet', ingredients: ['gin', 'lime'], image: 'gimlet.jpg' },
    { name: 'Old Fashioned', ingredients: ['bourbon', 'bitters'], image: 'old-fashioned.jpg' },
    { name: 'White Russian', ingredients: ['cream', 'vodka'], image: 'white-russian.jpg' },
  ];
  const vecOf = (names) => computeRecipeAroma(names);

  it('returns results in descending similarity order, best match first', () => {
    const results = rankByAromaSimilarity(vecOf(['lemon', 'lime']), cocktails, 8);
    expect(results.length).toBeGreaterThan(0);
    for (let i = 1; i < results.length; i++) {
      expect(results[i - 1].similarity).toBeGreaterThanOrEqual(results[i].similarity);
    }
    expect(results[0].item.name).toBe('Gimlet');
  });

  it('returns at most topN results', () => {
    expect(rankByAromaSimilarity(vecOf(['lemon']), cocktails, 2).length).toBeLessThanOrEqual(2);
  });

  it('filters items with no aroma vector', () => {
    const none = [{ name: 'Mystery', ingredients: ['unknown-a', 'unknown-b'], image: 'x.jpg' }];
    expect(rankByAromaSimilarity(vecOf(['lemon']), none, 8)).toHaveLength(0);
  });

  it('null and undefined recipeVector return an empty array', () => {
    expect(rankByAromaSimilarity(null, cocktails)).toEqual([]);
    expect(rankByAromaSimilarity(undefined, cocktails)).toEqual([]);
  });

  it('null and undefined items return an empty array', () => {
    expect(rankByAromaSimilarity(vecOf(['lemon']), null)).toEqual([]);
    expect(rankByAromaSimilarity(vecOf(['lemon']), undefined)).toEqual([]);
  });

  it('each result has similarity, matchedAromas and the item passed through unchanged', () => {
    const results = rankByAromaSimilarity(vecOf(['lemon']), cocktails, 8);
    for (const r of results) {
      expect(typeof r.similarity).toBe('number');
      expect(Array.isArray(r.matchedAromas)).toBe(true);
      expect(r.item).toBeDefined();
    }
    const gimlet = results.find((r) => r.item.name === 'Gimlet');
    expect(gimlet.item.image).toBe('gimlet.jpg');
    expect(Array.isArray(gimlet.item.ingredients)).toBe(true);
  });

  it('different recipes get different top matches (the model values gave the same two every time)', () => {
    const citrus = rankByAromaSimilarity(vecOf(['lemon', 'lime']), cocktails, 1)[0].item.name;
    const creamy = rankByAromaSimilarity(vecOf(['butter', 'cream']), cocktails, 1)[0].item.name;
    expect(citrus).not.toBe(creamy);
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
