import { describe, it, expect } from 'vitest';
import {
  recipeAxisProfile, recipeAxisProfileWeighted, amountGrams, describeRecipeProfile,
  axisInsight, profileDelta, topMovers, rankByAxisImpact, buildAxisEnhancements, AXES, axisLabel,
  methodFlavorEffect, TASTE_AXES, axisColor, BALANCING, nodeProbs,
} from './recipeProfileAnalysis.js';

// A value is a curated taste label ('sweet', 'sour sweet'), or { taste, probs } to add model aroma values.
// (Fixture names are deliberately NOT real ingredient names: real ones such as honey and lemon now have lines in the
// FLAVOR-4 strength table, which would replace these labels. Those lines are tested in flavorStrengths.test.js.)
function nodesFrom(map) {
  return new Map(Object.entries(map).map(([k, v]) => [k, typeof v === 'string' ? { taste: v } : { taste: v.taste, gnnProbs: v.probs }]));
}
const z = () => Object.fromEntries(AXES.map((a) => [a, 0]));
const probs = (o) => ({ ...z(), ...o });

describe('recipeAxisProfile', () => {
  it('averages per-axis and ranks drivers', () => {
    const nodes = nodesFrom({ syrupy: 'sweet', citrusy: 'sour sweet' });
    const { scores, drivers, n } = recipeAxisProfile(['syrupy', 'citrusy'], nodes);
    expect(n).toBe(2);
    expect(scores.sweet).toBeCloseTo((1 + 0.6) / 2);
    expect(scores.sour).toBeCloseTo(0.5);
    expect(drivers.sweet[0]).toBe('syrupy'); // highest sweet
  });

  it('skips ingredients without a taste label', () => {
    const nodes = nodesFrom({ syrupy: 'sweet', jam: 'sweet sour' });
    const { n, scores } = recipeAxisProfile(['syrupy', 'jam', 'mystery'], nodes);
    expect(n).toBe(2);
    expect(scores.sweet).toBeCloseTo(1);
  });
});

describe('amountGrams', () => {
  it('converts qty + unit to gram-equivalent', () => {
    expect(amountGrams({ qty: 2, unit: 'cup' })).toBeCloseTo(480); // 2 * 240
    expect(amountGrams({ qty: 1, unit: 'tbsp' })).toBeCloseTo(15);
  });
  it('defaults qty to 1 for a unit-only amount', () => {
    expect(amountGrams({ qty: null, unit: 'pinch' })).toBeCloseTo(1);
  });
  it('returns null when nothing is parseable', () => {
    expect(amountGrams(null)).toBeNull();
    expect(amountGrams({ qty: null, unit: null })).toBeNull();
    expect(amountGrams({ qty: 2, unit: null })).toBeNull(); // qty without a unit
  });
});

describe('recipeAxisProfileWeighted', () => {
  const nodes = nodesFrom({ syrupy: 'sweet', citrusy: 'sour' });

  it('equals the unweighted mean when no amounts are known', () => {
    const w = recipeAxisProfileWeighted(['syrupy', 'citrusy'], nodes);
    const m = recipeAxisProfile(['syrupy', 'citrusy'], nodes);
    expect(w.weighted).toBe(false);
    expect(w.n).toBe(2);
    expect(w.scores.sweet).toBeCloseTo(m.scores.sweet); // 0.5
    expect(w.scores.sour).toBeCloseTo(m.scores.sour);
  });

  it('weights ingredients by entered amount', () => {
    const entries = [
      { ingredient: 'syrupy', amount: { qty: null, unit: 'pinch' } }, // ~1g
      { ingredient: 'citrusy', amount: { qty: 2, unit: 'cup' } },      // ~480g
    ];
    const w = recipeAxisProfileWeighted(entries, nodes);
    expect(w.weighted).toBe(true);
    // citrusy dominates → sour share far exceeds sweet.
    expect(w.scores.sour).toBeGreaterThan(w.scores.sweet);
    expect(w.scores.sour).toBeGreaterThan(0.7);
  });

  it('falls back to mean known weight for un-quantified ingredients', () => {
    const entries = [
      { ingredient: 'syrupy', amount: { qty: 1, unit: 'cup' } }, // 240g
      { ingredient: 'citrusy', amount: null },                    // unknown → fallback 240g
    ];
    const w = recipeAxisProfileWeighted(entries, nodes);
    expect(w.weighted).toBe(true);
    expect(w.scores.sweet).toBeCloseTo(0.5); // equal weights → same as mean
  });

  it('skips ingredients without a label and is null-safe', () => {
    const w = recipeAxisProfileWeighted(['syrupy', 'citrusy', 'mystery'], nodes);
    expect(w.n).toBe(2);
    expect(w.scores.sweet).toBeCloseTo(0.5);
    expect(recipeAxisProfileWeighted(null, nodes).n).toBe(0);
  });
});

describe('describeRecipeProfile', () => {
  const profile = (scores, drivers = {}, n = 3) => ({ scores: probs(scores), drivers, n });

  it('returns a prompt when the bowl has no flavor data', () => {
    expect(describeRecipeProfile({ scores: z(), drivers: {}, n: 0 })).toMatch(/Add ingredients/i);
  });

  it('describes a sweet-lean recipe and flags the missing balancing axis', () => {
    const out = describeRecipeProfile(profile({ sweet: 0.6, sour: 0.05 }, { sweet: ['syrupy'] }));
    expect(out).toMatch(/leads with sweet/i);
    expect(out).toMatch(/from syrupy/i);
    expect(out).toMatch(/little sour/i); // suggests adding the counter-axis
  });

  it('calls out a balanced sweet/sour pair', () => {
    const out = describeRecipeProfile(profile({ sweet: 0.3, sour: 0.2 }));
    expect(out).toMatch(/sweet and sour sit in balance/i);
  });

  it('handles an umami-rich profile', () => {
    const out = describeRecipeProfile(profile({ umami: 0.6 }, { umami: ['fungus'] }));
    expect(out).toMatch(/umami/i);
    expect(out).toMatch(/from fungus/i);
  });

  it('calls a flat profile mild and even', () => {
    expect(describeRecipeProfile(profile({}))).toMatch(/mild and even/i);
  });

  it('reads a dominant aroma and a creamy mouthfeel', () => {
    const out = describeRecipeProfile(profile({ odor_fruity: 0.5, odor_fatty: 0.4 }, { odor_fruity: ['apple'] }));
    expect(out).toMatch(/aromatically it reads fruity/i);
    expect(out).toMatch(/rich and rounded/i);
  });

  it('folds in an aroma-match pairing signal', () => {
    const out = describeRecipeProfile(profile({ sweet: 0.3 }), { aromaMatch: { name: 'Negroni', similarity: 0.8 } });
    expect(out).toMatch(/Negroni/);
    expect(out).toMatch(/80% match/);
  });

  it('appends a preparation-method effect sentence when a method is given (FP-OV-5)', () => {
    const out = describeRecipeProfile(profile({ sweet: 0.3 }), { cookingMethod: 'roast' });
    expect(out).toMatch(/Likely roast — browning brings out deeper, sweeter, roasted notes\./);
  });

  it('omits the method sentence for an unknown or missing method', () => {
    const base = describeRecipeProfile(profile({ sweet: 0.3 }));
    expect(describeRecipeProfile(profile({ sweet: 0.3 }), { cookingMethod: null })).toBe(base);
    expect(describeRecipeProfile(profile({ sweet: 0.3 }), { cookingMethod: 'levitate' })).toBe(base);
  });

  it('is deterministic for identical input', () => {
    const p = profile({ sweet: 0.4, odor_green: 0.3 }, { sweet: ['syrupy'] });
    expect(describeRecipeProfile(p)).toBe(describeRecipeProfile(p));
  });
});

describe('methodFlavorEffect (FP-OV-5)', () => {
  it('maps every canonical method to a family + note + axis nudges', () => {
    const cases = {
      roast: 'brown', sear: 'brown', grill: 'brown', broil: 'brown', bake: 'brown', toast: 'brown',
      fry: 'fry', 'deep-fry': 'fry', 'stir-fry': 'fry', 'sauté': 'fry', saute: 'fry',
      caramelize: 'caramelize',
      braise: 'meld', simmer: 'meld',
      steam: 'gentle', poach: 'gentle', boil: 'gentle', blanch: 'gentle',
      marinate: 'marinate',
      raw: 'raw', chill: 'raw', whisk: 'raw', blend: 'raw',
    };
    for (const [method, family] of Object.entries(cases)) {
      const eff = methodFlavorEffect(method);
      expect(eff, method).not.toBeNull();
      expect(eff.family, method).toBe(family);
      expect(eff.note.length, method).toBeGreaterThan(0);
      expect(Object.keys(eff.axes).length, method).toBeGreaterThan(0);
    }
  });

  it('is case-insensitive', () => {
    expect(methodFlavorEffect('ROAST').family).toBe('brown');
    expect(methodFlavorEffect('Braise').family).toBe('meld');
  });

  it('returns null for empty/unknown methods', () => {
    expect(methodFlavorEffect(null)).toBeNull();
    expect(methodFlavorEffect(undefined)).toBeNull();
    expect(methodFlavorEffect('')).toBeNull();
    expect(methodFlavorEffect('teleport')).toBeNull();
  });
});

describe('heat, the sixth taste', () => {
  it('is a taste axis with its own label, a red colour and sweet as its balance', () => {
    expect(TASTE_AXES).toEqual(['sweet', 'sour', 'bitter', 'salty', 'umami', 'heat']);
    expect(AXES).toHaveLength(12);
    expect(axisLabel('heat')).toBe('Heat');
    expect(axisColor('heat')).toBe(axisColor('odor_spicy'));
    expect(BALANCING.heat).toBe('sweet');
    expect(axisInsight('heat', 0.7)).toBe('Runs hot — balance with sweet.');
  });
  it('a peppery charts heat, drives it, and nodeProbs carries it', () => {
    const nodes = nodesFrom({ peppery: 'spicy pungent', zesty: 'astringent', brinex: 'rich salty' });
    const p = recipeAxisProfile(['peppery', 'zesty'], nodes);
    expect(p.scores.heat).toBeGreaterThan(p.scores.bitter); // spicy + pungent is capped at the top of the scale (3), the same as one first word
    expect(p.scores.heat).toBeGreaterThanOrEqual(p.scores.salty);
    expect(p.drivers.heat).toEqual(['peppery']);
    expect(nodeProbs('peppery', nodes).heat).toBeCloseTo(1); // spicy + pungent is capped at the top of the scale
    expect(describeRecipeProfile(p)).toMatch(/leads with heat from peppery/);
  });
  it('neutral ingredients are counted but add no taste, and a boost of heat ranks chilies first', () => {
    const nodes = nodesFrom({ aquax: 'neutral', peppery: 'spicy', sweetx: 'sweet' });
    expect(nodeProbs('aquax', nodes)).toMatchObject({ _tasteless: true, sweet: 0, heat: 0 });
    const scores = { ...z(), sweet: 0.6 };
    const r = rankByAxisImpact(['aquax', 'peppery', 'sweetx'], 'heat', scores, 2, nodes, { mode: 'boost' });
    expect(r.map((x) => x.name)).toEqual(['peppery']);
    expect(profileDelta('aquax', scores, 2, nodes).sweet).toBeLessThan(0); // dilutes, at the tasteless rate
  });
  it('a recipe of only neutral ingredients has nothing to chart', () => {
    const nodes = nodesFrom({ aquax: 'neutral', powderx: 'neutral' });
    const p = recipeAxisProfile(['aquax', 'powderx'], nodes);
    expect(p.n).toBe(2);
    expect(p.tasteDrawn).toBe(false);
    expect(p.drawn).toBe(false);
  });
});

describe('axisInsight', () => {
  it('flags a dominant axis with its balancing axis', () => {
    expect(axisInsight('sweet', 0.7)).toMatch(/balance with sour/i);
  });
  it('calls a low axis faint', () => {
    expect(axisInsight('umami', 0.05)).toMatch(/faint/i);
  });
});

describe('profileDelta + topMovers', () => {
  it('computes the shift a candidate causes', () => {
    const scores = { ...z(), sweet: 0.2 };
    const nodes = nodesFrom({ fig: { taste: 'sweet', probs: probs({ odor_fruity: 0.4 }) } });
    const d = profileDelta('fig', scores, 2, nodes); // /(n+1)=/3
    expect(d.sweet).toBeCloseTo((1 - 0.2) / 3);
    expect(d.odor_fruity).toBeCloseTo(0.5 / 3); // fig's aroma comes from the aroma table (fruity 1.5 of 3), not from probs
    const movers = topMovers(d, 2).map((m) => m.axis);
    expect(movers).toContain('sweet');
  });
  it('returns null for unknown candidate', () => {
    expect(profileDelta('nope', z(), 1, nodesFrom({}))).toBeNull();
  });
});

describe('rankByAxisImpact', () => {
  const nodes = nodesFrom({ fig: 'sweet', date: 'bitter sweet', citrusy: 'sour' });
  const scores = { ...z(), sweet: 0.1 };

  it('boost ranks candidates by positive delta on the axis', () => {
    const r = rankByAxisImpact(['fig', 'date', 'citrusy'], 'sweet', scores, 3, nodes, { mode: 'boost' });
    expect(r.map((x) => x.name)).toEqual(['fig', 'date']); // citrusy adds no sweet
  });

  it('temper ranks by the balancing axis (sweet→sour)', () => {
    const r = rankByAxisImpact(['fig', 'citrusy'], 'sweet', scores, 3, nodes, { mode: 'temper' });
    expect(r[0].name).toBe('citrusy'); // raises sour, the balance for sweet
  });
});

describe('buildAxisEnhancements', () => {
  const nodes = nodesFrom({ fig: 'sweet', citrusy: 'sour', brinex: 'salty' });
  const scores = { ...z(), sweet: 0.1 };

  it('returns per-axis boost + temper buckets from the candidate pool', () => {
    const rows = buildAxisEnhancements(['sweet'], ['fig', 'citrusy', 'brinex'], scores, 3, nodes);
    expect(rows).toHaveLength(1);
    expect(rows[0].axis).toBe('sweet');
    expect(rows[0].boost.map((b) => b.name)).toContain('fig');   // adds sweet
    expect(rows[0].temper.map((t) => t.name)).toContain('citrusy'); // raises sour (balances sweet)
  });

  it('drops axes with neither boost nor temper candidates', () => {
    // brinex adds neither bitter (boost) nor sweet (bitter's balance/temper) → row dropped.
    const rows = buildAxisEnhancements(['bitter'], ['brinex'], scores, 3, nodes);
    expect(rows).toHaveLength(0);
  });

  it('is null-safe for empty axes / candidates', () => {
    expect(buildAxisEnhancements([], ['fig'], scores, 1, nodes)).toEqual([]);
    expect(buildAxisEnhancements(['sweet'], [], scores, 1, nodes)).toEqual([]);
    expect(buildAxisEnhancements(null, null, scores, 1, nodes)).toEqual([]);
  });
});

describe('axisLabel', () => {
  it('uses chef aroma vocab (creamy for odor_fatty)', () => {
    expect(axisLabel('odor_fatty')).toBe('creamy');
    expect(axisLabel('sweet')).toBe('Sweet');
  });
});
