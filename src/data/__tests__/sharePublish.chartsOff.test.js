import { describe, it, expect, vi } from 'vitest';
vi.mock('../shareTargets.js', async (orig) => ({ ...(await orig()), SHARE_CHARTS_ENABLED: false }));
import { toSharedDoc } from '../sharePublish.js';

describe('toSharedDoc with the switch off (SHARE-8)', () => {
  it('stores bars: [] even when bars are passed', () => {
    const d = toSharedDoc({ id: 'i', name: 'Sour', kind: 'cocktail', lines: [{ key: 'bourbon', amount: '2 oz' }] }, { kind: 'cocktail', uid: 'u1', bars: [{ label: 'Sweet', color: '#ff00aa', score: 0.5 }] });
    expect(d.bars).toEqual([]);
  });
});
