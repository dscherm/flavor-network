import { describe, it, expect } from 'vitest';
import { affinityShape, AFFINITY_SHAPE_LEGEND } from '../affinityShapes.js';
import { SHAPE_KEYS } from '../../three/Geometries.js';

describe('affinityShape', () => {
  it('maps each role to its dedicated shape', () => {
    expect(affinityShape('focal')).toBe('dodecahedron');
    expect(affinityShape(3)).toBe('bipyramid');
    expect(affinityShape(2)).toBe('cylinder');
    expect(affinityShape(1)).toBe('sphere');
  });

  it('returns 4 distinct shapes (focal + 3 tiers all unique)', () => {
    const shapes = ['focal', 3, 2, 1].map(affinityShape);
    expect(new Set(shapes).size).toBe(4);
  });

  it('falls back to sphere for unknown roles', () => {
    expect(affinityShape(null)).toBe('sphere');
    expect(affinityShape(undefined)).toBe('sphere');
    expect(affinityShape(0)).toBe('sphere');
    expect(affinityShape(4)).toBe('sphere');
    expect(affinityShape('untiered')).toBe('sphere');
  });

  it('only emits values from the master shape kit', () => {
    for (const role of ['focal', 3, 2, 1, null]) {
      expect(SHAPE_KEYS).toContain(affinityShape(role));
    }
  });

  it('uses at most 2 polyhedra (Pass-4 limit)', () => {
    const polyhedra = new Set([
      'tetrahedron', 'octahedron', 'dodecahedron', 'icosahedron', 'bipyramid',
    ]);
    const all = ['focal', 3, 2, 1].map(affinityShape);
    const polyCount = all.filter((s) => polyhedra.has(s)).length;
    expect(polyCount).toBeLessThanOrEqual(2);
  });
});

describe('AFFINITY_SHAPE_LEGEND', () => {
  it('contains 4 distinct rows (focal + 3 tiers)', () => {
    expect(AFFINITY_SHAPE_LEGEND).toHaveLength(4);
    const cats = AFFINITY_SHAPE_LEGEND.map((p) => p.category);
    expect(new Set(cats).size).toBe(4);
  });

  it('every legend shape is in SHAPE_KEYS and unique', () => {
    const shapes = AFFINITY_SHAPE_LEGEND.map((p) => p.shape);
    for (const s of shapes) {
      expect(SHAPE_KEYS).toContain(s);
    }
    expect(new Set(shapes).size).toBe(shapes.length);
  });
});
