import { describe, it, expect } from 'vitest';
import { getOdorBadge } from './odorBadge.js';

const bc = {
  _meta: { edges: 3, total_entities: 6 },
  'lemon|thyme': {
    shared_count: 4,
    distinctive_count: 4,
    bridges: [
      { name: 'Limonene', tags: ['citrus', 'lemon'] },
      { name: 'Linalool', tags: ['citrus', 'floral'] },
      { name: 'Citral', tags: ['citrus', 'lemon'] },
      { name: 'Geraniol', tags: ['floral', 'rose'] },
    ],
  },
  'salt|water': {
    bridges: [
      { name: 'Sodium', tags: ['odorless'] },
      { name: 'Chloride', tags: ['odorless'] },
    ],
  },
  'a|b': {
    bridges: [
      { name: 'x', tags: ['apple'] },
      { name: 'y', tags: ['pear'] },
      { name: 'z', tags: ['melon'] },
    ],
  },
};

describe('getOdorBadge', () => {
  it('returns null when inputs missing', () => {
    expect(getOdorBadge(null, 'lemon', bc)).toBeNull();
    expect(getOdorBadge('lemon', null, bc)).toBeNull();
    expect(getOdorBadge('lemon', 'thyme', null)).toBeNull();
  });

  it('returns null for unknown pair', () => {
    expect(getOdorBadge('unknown', 'pair', bc)).toBeNull();
  });

  it('finds dominant tag (citrus beats floral for lemon+thyme)', () => {
    const r = getOdorBadge('lemon', 'thyme', bc);
    expect(r).not.toBeNull();
    expect(r.tag).toBe('citrus');
    expect(r.count).toBe(3);
    expect(r.total).toBe(4);
  });

  it('order-insensitive (b|a works)', () => {
    expect(getOdorBadge('thyme', 'lemon', bc)).toEqual(getOdorBadge('lemon', 'thyme', bc));
  });

  it('filters uninformative tags (salt+water = null, only odorless tags)', () => {
    expect(getOdorBadge('salt', 'water', bc)).toBeNull();
  });

  it('returns null when no tag hits min count of 2', () => {
    // a|b has 3 bridges, each with a unique tag — no tag reaches count >= 2
    expect(getOdorBadge('a', 'b', bc)).toBeNull();
  });
});
