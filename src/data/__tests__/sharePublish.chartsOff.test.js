import { describe, it, expect } from 'vitest';
import { toSharedDoc } from '../sharePublish.js';

describe('toSharedDoc with charts off (SHARE-8, the committed state)', () => {
  it('stores bars: [] even when bars are passed', () => {
    const d = toSharedDoc({ id: 'i', name: 'Sour', kind: 'cocktail', lines: [{ key: 'bourbon', amount: '2 oz' }] }, { kind: 'cocktail', uid: 'u1', bars: [{ label: 'Sweet', color: '#ff00aa', score: 0.5 }] });
    expect(d.bars).toEqual([]);
  });
});
