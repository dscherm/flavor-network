import { describe, it, expect } from 'vitest';
import { cocktailShapeKey, COCKTAIL_SHAPE_LEGEND } from '../cocktailShapes.js';
import { SHAPE_KEYS } from '../../three/Geometries.js';

describe('cocktailShapeKey', () => {
  it('maps each canonical subcluster category to its shape', () => {
    expect(cocktailShapeKey('Root')).toBe('sphere');
    expect(cocktailShapeKey('Core')).toBe('cube');
    expect(cocktailShapeKey('Balance')).toBe('torus');
    expect(cocktailShapeKey('Seasoning')).toBe('cylinder');
    expect(cocktailShapeKey('Variations')).toBe('cone');
    expect(cocktailShapeKey('Extended Family')).toBe('torusKnot');
    expect(cocktailShapeKey('Recipes')).toBe('bipyramid');
  });

  it('folds the two "Experimenting with [the] Balance" variants', () => {
    expect(cocktailShapeKey('Experimenting with Balance')).toBe('torus');
    expect(cocktailShapeKey('Experimenting with the Balance')).toBe('torus');
  });

  it('folds "Variations & Extended Family" into Extended Family', () => {
    expect(cocktailShapeKey('Variations & Extended Family')).toBe('torusKnot');
  });

  it('is case-insensitive', () => {
    expect(cocktailShapeKey('ROOT')).toBe('sphere');
    expect(cocktailShapeKey('core')).toBe('cube');
    expect(cocktailShapeKey('  Balance  ')).toBe('torus');
  });

  it('falls back to sphere for null/undefined/empty/unknown', () => {
    expect(cocktailShapeKey(null)).toBe('sphere');
    expect(cocktailShapeKey(undefined)).toBe('sphere');
    expect(cocktailShapeKey('')).toBe('sphere');
    expect(cocktailShapeKey('Spaghetti')).toBe('sphere');
  });

  it('only emits values from the master shape kit', () => {
    for (const cat of [
      'Root', 'Core', 'Balance', 'Seasoning',
      'Variations', 'Extended Family', 'Recipes', 'Unknown',
    ]) {
      expect(SHAPE_KEYS).toContain(cocktailShapeKey(cat));
    }
  });
});

describe('COCKTAIL_SHAPE_LEGEND', () => {
  it('contains exactly 7 distinct categories', () => {
    expect(COCKTAIL_SHAPE_LEGEND).toHaveLength(7);
    const cats = COCKTAIL_SHAPE_LEGEND.map((p) => p.category);
    expect(new Set(cats).size).toBe(7);
  });

  it('every legend shape is in SHAPE_KEYS', () => {
    for (const { shape } of COCKTAIL_SHAPE_LEGEND) {
      expect(SHAPE_KEYS).toContain(shape);
    }
  });

  it('every legend shape is unique (no two categories share a shape)', () => {
    const shapes = COCKTAIL_SHAPE_LEGEND.map((p) => p.shape);
    expect(new Set(shapes).size).toBe(shapes.length);
  });

  it('legend categories agree with cocktailShapeKey() forward mapping', () => {
    for (const { category, shape } of COCKTAIL_SHAPE_LEGEND) {
      expect(cocktailShapeKey(category)).toBe(shape);
    }
  });
});
