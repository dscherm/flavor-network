import { describe, it, expect } from 'vitest';
import { profileForRecipe, barsFor } from '../shareCardData.js';
import { loadFlavorNodes } from '../../../scripts/lib/flavorNodes.mjs';

const nodes = loadFlavorNodes();

describe('profileForRecipe (the one place a recipe becomes a chart outside the app)', () => {
  const dry = { kind: 'cocktail', name: 'Dry', lines: [{ key: 'tequila', amount: '2 oz' }, { key: 'lime juice', amount: '1 oz' }] };

  it('counts the garnish: a salt rim adds salty, a lime twist adds aroma', () => {
    const plain = profileForRecipe(dry, nodes);
    const rimmed = profileForRecipe({ ...dry, garnish: 'Salt rim, lime wheel' }, nodes);
    expect(plain.scores.salty).toBe(0);
    expect(rimmed.scores.salty).toBeGreaterThan(0);
    expect(rimmed.scores.odor_fruity).toBeGreaterThanOrEqual(plain.scores.odor_fruity);
  });

  it('weights by amount (a kilogram is not a pinch)', () => {
    const a = profileForRecipe({ kind: 'dish', name: 'x', lines: [{ key: 'apple', amount: '1.2 kg' }, { key: 'cinnamon', amount: '1 tsp' }] }, nodes);
    const b = profileForRecipe({ kind: 'dish', name: 'x', lines: [{ key: 'apple', amount: '1 tsp' }, { key: 'cinnamon', amount: '1 tsp' }] }, nodes);
    expect(a.scores.odor_fruity).toBeGreaterThan(b.scores.odor_fruity);
  });

  it('is safe on missing input', () => {
    expect(profileForRecipe(null, null).bars).toEqual([]);
    expect(barsFor(null, nodes)).toEqual([]);
  });

  it('barsFor is the same bars as the profile, with label, colour and score only', () => {
    const p = profileForRecipe(dry, nodes);
    expect(barsFor(dry, nodes)).toEqual(p.bars.map((b) => ({ label: b.label, color: b.color, score: b.score })));
  });
});
