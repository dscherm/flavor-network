import { describe, it, expect } from 'vitest';
import { sauceShapeKey, SAUCE_SHAPE_LEGEND } from '../sauceShapes.js';
import { SHAPE_KEYS } from '../../three/Geometries.js';

describe('sauceShapeKey', () => {
  it('maps each top-7 cuisine to its dedicated shape', () => {
    expect(sauceShapeKey('French')).toBe('cube');
    expect(sauceShapeKey('Italian')).toBe('torus');
    expect(sauceShapeKey('Indian')).toBe('bipyramid');
    expect(sauceShapeKey('Mexican')).toBe('cone');
    expect(sauceShapeKey('American')).toBe('cylinder');
    expect(sauceShapeKey('Japanese')).toBe('tetrahedron');
    expect(sauceShapeKey('Chinese')).toBe('sphere');
  });

  it('folds smaller cuisines into the "Other" octahedron bucket', () => {
    expect(sauceShapeKey('Thai')).toBe('octahedron');
    expect(sauceShapeKey('Korean')).toBe('octahedron');
    expect(sauceShapeKey('Mediterranean')).toBe('octahedron');
    expect(sauceShapeKey('Middle Eastern')).toBe('octahedron');
    expect(sauceShapeKey('African')).toBe('octahedron');
    expect(sauceShapeKey('Peruvian')).toBe('octahedron');
    expect(sauceShapeKey('Vietnamese')).toBe('octahedron');
    expect(sauceShapeKey('Argentine')).toBe('octahedron');
  });

  it('is case-insensitive and trims whitespace', () => {
    expect(sauceShapeKey('FRENCH')).toBe('cube');
    expect(sauceShapeKey('italian')).toBe('torus');
    expect(sauceShapeKey('  Mexican  ')).toBe('cone');
  });

  it('falls back to octahedron for null/undefined/empty/unknown', () => {
    expect(sauceShapeKey(null)).toBe('octahedron');
    expect(sauceShapeKey(undefined)).toBe('octahedron');
    expect(sauceShapeKey('')).toBe('octahedron');
    expect(sauceShapeKey('Martian')).toBe('octahedron');
  });

  it('only emits values from the master shape kit', () => {
    const cuisines = [
      'French', 'Italian', 'Indian', 'Mexican', 'American',
      'Japanese', 'Chinese', 'Thai', 'Korean', 'Other', null,
    ];
    for (const c of cuisines) {
      expect(SHAPE_KEYS).toContain(sauceShapeKey(c));
    }
  });
});

describe('SAUCE_SHAPE_LEGEND', () => {
  it('contains 8 distinct legend rows (top-7 cuisines + Other)', () => {
    expect(SAUCE_SHAPE_LEGEND).toHaveLength(8);
    const cats = SAUCE_SHAPE_LEGEND.map((p) => p.category);
    expect(new Set(cats).size).toBe(8);
  });

  it('every legend shape is in SHAPE_KEYS', () => {
    for (const { shape } of SAUCE_SHAPE_LEGEND) {
      expect(SHAPE_KEYS).toContain(shape);
    }
  });

  it('every legend shape is unique (no shape collisions)', () => {
    const shapes = SAUCE_SHAPE_LEGEND.map((p) => p.shape);
    expect(new Set(shapes).size).toBe(shapes.length);
  });

  it('uses at most 3 polyhedra (Pass-4 limit on hard-edged shapes)', () => {
    const polyhedra = new Set([
      'tetrahedron', 'octahedron', 'dodecahedron', 'icosahedron', 'bipyramid',
    ]);
    const polyCount = SAUCE_SHAPE_LEGEND.filter(({ shape }) => polyhedra.has(shape)).length;
    expect(polyCount).toBeLessThanOrEqual(3);
  });
});
