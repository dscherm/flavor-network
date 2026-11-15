import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { AROMA_WORD_MAP, AROMA_WORDS, AROMAS_ELEVEN, AROMAS_SIX, toEleven, toSix, chefTruthItems } from '../aromaWordMap.js';

const distilled = JSON.parse(readFileSync(resolve(process.cwd(), 'public/proDataset/flavor_profiles_distilled.json'), 'utf8'));

describe('aromaWordMap', () => {
  it('covers exactly the 17 words of the distilled vocabulary', () => {
    expect([...AROMA_WORDS].sort()).toEqual([...distilled.meta.vocab_aroma].sort());
    expect(AROMA_WORDS).toHaveLength(17);
  });
  it('every home is a real axis', () => {
    for (const [, [eleven, six]] of Object.entries(AROMA_WORD_MAP)) {
      expect(AROMAS_ELEVEN).toContain(eleven);
      if (six !== null) expect(AROMAS_SIX).toContain(six);
    }
  });
  it('maps and de-duplicates', () => {
    expect(toEleven(['citrusy', 'fruity', 'marine', 'meaty'])).toEqual(['fruity', 'savory']);
    expect(toSix(['roasted', 'smoky', 'spicy'])).toEqual(['spice']);
    expect(toEleven(['nonsense'])).toEqual([]);
  });
  it('builds truth items from chef entries only', () => {
    const items = chefTruthItems(distilled);
    const chef = Object.values(distilled.ingredients).filter((e) => e.source === 'chef').length;
    expect(items.length).toBeGreaterThan(0);
    expect(items.length).toBeLessThanOrEqual(chef);
    for (const it of items) {
      expect(distilled.ingredients[it.key].source).toBe('chef');
      expect(it.expect.length).toBeGreaterThan(0);
    }
  });
});
