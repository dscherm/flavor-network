import { describe, it, expect } from 'vitest';
import { cocktailShapeKey, COCKTAIL_SHAPE_LEGEND } from '../cocktailShapes.js';
import { SHAPE_KEYS } from '../../three/Geometries.js';

describe('cocktailShapeKey', () => {
  it('maps each canonical subcluster category to its shape', () => {
    expect(cocktailShapeKey('Root')).toBe('cube');
    expect(cocktailShapeKey('Core')).toBe('sphere');
    expect(cocktailShapeKey('Balance')).toBe('octahedron');
    expect(cocktailShapeKey('Seasoning')).toBe('cylinder');
    expect(cocktailShapeKey('Variations')).toBe('dodecahedron');
    expect(cocktailShapeKey('Extended Family')).toBe('icosahedron');
    expect(cocktailShapeKey('Recipes')).toBe('torus');
  });

  it('folds the two "Experimenting with [the] Balance" variants', () => {
    expect(cocktailShapeKey('Experimenting with Balance')).toBe('octahedron');
    expect(cocktailShapeKey('Experimenting with the Balance')).toBe('octahedron');
  });

  it('folds "Variations & Extended Family" into Extended Family', () => {
    expect(cocktailShapeKey('Variations & Extended Family')).toBe('icosahedron');
  });

  it('is case-insensitive', () => {
    expect(cocktailShapeKey('ROOT')).toBe('cube');
    expect(cocktailShapeKey('core')).toBe('sphere');
    expect(cocktailShapeKey('  Balance  ')).toBe('octahedron');
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
