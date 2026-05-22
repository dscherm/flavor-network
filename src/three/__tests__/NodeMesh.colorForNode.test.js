import { describe, it, expect } from 'vitest';
import { getColorForNode } from '../NodeMesh.js';
import { BRISCIONE_AROMA } from '../../data/briscionePalette.js';

function hex(color) {
  return `#${color.getHexString()}`;
}

describe('getColorForNode — canonical-spec §3.1 color precedence', () => {
  it('uses clusterColor when set (wins over tier1 + taste, per spec §3.1)', () => {
    const node = {
      primaryTier1Aroma: 'green',
      clusterColor: '#ff0000',
      taste: 'sweet',
      gnnEntropy: 0,
    };
    expect(hex(getColorForNode(node))).toBe('#ff0000');
  });

  it('falls through to tier1 when clusterColor is null', () => {
    for (const aroma of ['fruity', 'floral', 'green', 'woody', 'fatty']) {
      const c = getColorForNode({
        primaryTier1Aroma: aroma,
        clusterColor: null,
        gnnEntropy: 0,
      });
      expect(hex(c)).toBe(BRISCIONE_AROMA[aroma]);
    }
  });

  it('uses clusterColor when primaryTier1Aroma is null', () => {
    const node = { primaryTier1Aroma: null, clusterColor: '#abcdef', gnnEntropy: 0 };
    expect(hex(getColorForNode(node))).toBe('#abcdef');
  });

  it('falls through to taste palette when no cluster + no tier1', () => {
    const node = { primaryTier1Aroma: null, clusterColor: null, taste: 'sweet', gnnEntropy: 0 };
    expect(hex(getColorForNode(node))).toBe('#ff6b9d');
  });

  it('does not crash on null node fields', () => {
    const node = {};
    expect(() => getColorForNode(node)).not.toThrow();
  });
});
