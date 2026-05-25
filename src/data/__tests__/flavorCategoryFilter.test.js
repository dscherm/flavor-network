import { describe, it, expect } from 'vitest';
import {
  matchesFlavorCategory,
  buildFlavorCategoryMask,
} from '../flavorCategoryFilter.js';

const chefNode = {
  name: 'parsley',
  flavorGraph: {
    tier1: ['green'],
    tier2: ['bitter'],
    tier3: ['fresh'],
    leaves: ['phenolic', 'herbal', 'leafy'],
    source: 'chef',
  },
};

const longTailNode = {
  name: 'banana',
  flavorGraph: null,
  primaryTier1Aroma: 'fruity',
};

describe('matchesFlavorCategory', () => {
  it('returns true for chef-curated node with no term (scope default)', () => {
    expect(matchesFlavorCategory(chefNode)).toBe(true);
  });

  it('returns false for long-tail (GNN-only) node regardless of term', () => {
    expect(matchesFlavorCategory(longTailNode)).toBe(false);
    expect(matchesFlavorCategory(longTailNode, 'fruity')).toBe(false);
  });

  it('matches against tier1/tier2/tier3/leaves arrays case-insensitively', () => {
    expect(matchesFlavorCategory(chefNode, 'green')).toBe(true);
    expect(matchesFlavorCategory(chefNode, 'BITTER')).toBe(true);
    expect(matchesFlavorCategory(chefNode, 'fresh')).toBe(true);
    expect(matchesFlavorCategory(chefNode, 'phenolic')).toBe(true);
  });

  it('returns false when term not in any tier array', () => {
    expect(matchesFlavorCategory(chefNode, 'umami')).toBe(false);
    expect(matchesFlavorCategory(chefNode, 'plasma')).toBe(false);
  });

  it('handles null/missing node fields gracefully', () => {
    expect(matchesFlavorCategory(null)).toBe(false);
    expect(matchesFlavorCategory({})).toBe(false);
    expect(matchesFlavorCategory({ flavorGraph: {} }, 'green')).toBe(false);
  });
});

describe('buildFlavorCategoryMask', () => {
  it('returns null when filter is inactive (short-circuit)', () => {
    const nodes = new Map([['parsley', chefNode], ['banana', longTailNode]]);
    expect(buildFlavorCategoryMask(nodes, false)).toBe(null);
  });

  it('returns a per-name visibility map when active', () => {
    const nodes = new Map([['parsley', chefNode], ['banana', longTailNode]]);
    const mask = buildFlavorCategoryMask(nodes, true);
    expect(mask.get('parsley')).toBe(true);
    expect(mask.get('banana')).toBe(false);
  });

  it('honors the term argument', () => {
    const nodes = new Map([['parsley', chefNode], ['banana', longTailNode]]);
    const mask = buildFlavorCategoryMask(nodes, true, 'green');
    expect(mask.get('parsley')).toBe(true);
    expect(mask.get('banana')).toBe(false);
    const noMatch = buildFlavorCategoryMask(nodes, true, 'umami');
    expect(noMatch.get('parsley')).toBe(false);
  });
});
