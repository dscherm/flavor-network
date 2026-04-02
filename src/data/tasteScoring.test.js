import { describe, it, expect } from 'vitest';
import { aggregateRecipeTastes, findWeakestAxis, getAxisContributors } from './tasteScoring.js';

// Build a minimal nodes Map for testing
function makeNodes(entries) {
  const m = new Map();
  for (const [name, taste] of entries) {
    m.set(name, { name, taste, weight: null, volume: null, season: null, tips: [] });
  }
  return m;
}

describe('aggregateRecipeTastes', () => {
  it('returns zero totals for empty recipe', () => {
    const nodes = makeNodes([['garlic', 'pungent']]);
    const result = aggregateRecipeTastes([], nodes);
    expect(result.totals.sweet).toBe(0);
    expect(result.totals.pungent).toBe(0);
    expect(result.max).toBe(0.01); // floor
    // All normalized values should be 0
    for (const val of Object.values(result.normalized)) {
      expect(val).toBe(0);
    }
  });

  it('scores a single sweet ingredient', () => {
    const nodes = makeNodes([['sugar', 'sweet']]);
    const result = aggregateRecipeTastes(['sugar'], nodes);
    expect(result.totals.sweet).toBeGreaterThan(0);
    expect(result.normalized.sweet).toBe(1); // max channel = 1.0
  });

  it('accumulates multiple ingredients', () => {
    const nodes = makeNodes([
      ['sugar', 'sweet'],
      ['lemon', 'sour'],
    ]);
    const result = aggregateRecipeTastes(['sugar', 'lemon'], nodes);
    expect(result.totals.sweet).toBeGreaterThan(0);
    expect(result.totals.sour).toBeGreaterThan(0);
    // Both should be represented in normalized
    expect(result.normalized.sweet).toBeGreaterThan(0);
    expect(result.normalized.sour).toBeGreaterThan(0);
  });

  it('handles unknown ingredient names gracefully', () => {
    const nodes = makeNodes([['garlic', 'pungent']]);
    const result = aggregateRecipeTastes(['garlic', 'nonexistent_thing'], nodes);
    // Should not throw, just skip unknown
    expect(result.totals.pungent).toBeGreaterThan(0);
  });

  it('all-same-taste ingredients produce dominant single axis', () => {
    const nodes = makeNodes([
      ['sugar', 'sweet'],
      ['honey', 'sweet'],
      ['maple syrup', 'sweet'],
    ]);
    const result = aggregateRecipeTastes(['sugar', 'honey', 'maple syrup'], nodes);
    expect(result.normalized.sweet).toBe(1);
    // Other axes should be lower or zero (some may get name-hint scores)
    expect(result.normalized.bitter).toBeLessThan(result.normalized.sweet);
  });
});

describe('findWeakestAxis', () => {
  it('finds the axis with the lowest value', () => {
    const normalized = {
      sweet: 0.8, salty: 0.3, sour: 0.5, bitter: 0.1,
      umami: 0.6, spicy: 0.4, pungent: 0.2, astringent: 0.7,
    };
    const [axis, val] = findWeakestAxis(normalized);
    expect(axis).toBe('bitter');
    expect(val).toBe(0.1);
  });

  it('handles all-zero normalized', () => {
    const normalized = {
      sweet: 0, salty: 0, sour: 0, bitter: 0,
      umami: 0, spicy: 0, pungent: 0, astringent: 0,
    };
    const [axis, val] = findWeakestAxis(normalized);
    expect(val).toBe(0);
    // Any axis is valid when all are 0
    expect(typeof axis).toBe('string');
  });

  it('handles uniform values', () => {
    const normalized = {
      sweet: 0.5, salty: 0.5, sour: 0.5, bitter: 0.5,
      umami: 0.5, spicy: 0.5, pungent: 0.5, astringent: 0.5,
    };
    const [, val] = findWeakestAxis(normalized);
    expect(val).toBe(0.5);
  });
});

describe('getAxisContributors', () => {
  it('returns contributors sorted by score descending', () => {
    const nodes = makeNodes([
      ['garlic', 'pungent'],
      ['onion', 'pungent'],
      ['sugar', 'sweet'],
    ]);
    const contributors = getAxisContributors('pungent', ['garlic', 'onion', 'sugar'], nodes);
    expect(contributors.length).toBeGreaterThanOrEqual(2);
    expect(contributors[0].name).toBe('garlic'); // both have pungent, garlic has name hint too
    // Scores should be descending
    for (let i = 1; i < contributors.length; i++) {
      expect(contributors[i].score).toBeLessThanOrEqual(contributors[i - 1].score);
    }
  });

  it('excludes ingredients with zero contribution to the axis', () => {
    const nodes = makeNodes([
      ['sugar', 'sweet'],
      ['honey', 'sweet'],
    ]);
    const contributors = getAxisContributors('spicy', ['sugar', 'honey'], nodes);
    // Pure sweet ingredients shouldn't score on spicy
    expect(contributors.length).toBe(0);
  });

  it('handles empty ingredient list', () => {
    const nodes = makeNodes([['garlic', 'pungent']]);
    const contributors = getAxisContributors('pungent', [], nodes);
    expect(contributors).toEqual([]);
  });
});
