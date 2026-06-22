import { describe, it, expect } from 'vitest';
import {
  recipeAxisProfile, recipeAxisProfileWeighted, amountGrams, describeRecipeProfile,
  axisInsight, profileDelta, topMovers, rankByAxisImpact, buildAxisEnhancements, AXES, axisLabel,
  methodFlavorEffect,
} from './recipeProfileAnalysis.js';

function nodesFrom(map) {
  return new Map(Object.entries(map).map(([k, gnnProbs]) => [k, { gnnProbs }]));
}
const z = () => Object.fromEntries(AXES.map((a) => [a, 0]));
const probs = (o) => ({ ...z(), ...o });

describe('recipeAxisProfile', () => {
  it('averages per-axis and ranks drivers', () => {
    const nodes = nodesFrom({
      honey: probs({ sweet: 0.9 }),
      lemon: probs({ sour: 0.8, sweet: 0.1 }),
    });
    const { scores, drivers, n } = recipeAxisProfile(['honey', 'lemon'], nodes);
    expect(n).toBe(2);
    expect(scores.sweet).toBeCloseTo(0.5);
    expect(scores.sour).toBeCloseTo(0.4);
    expect(drivers.sweet[0]).toBe('honey'); // highest sweet
  });

  it('skips ingredients without probs', () => {
    const nodes = nodesFrom({ honey: probs({ sweet: 0.9 }) });
    const { n, scores } = recipeAxisProfile(['honey', 'mystery'], nodes);
    expect(n).toBe(1);
    expect(scores.sweet).toBeCloseTo(0.9);
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
  const nodes = nodesFrom({
    honey: probs({ sweet: 0.9 }),
    lemon: probs({ sour: 0.8 }),
  });

  it('equals the unweighted mean when no amounts are known', () => {
    const w = recipeAxisProfileWeighted(['honey', 'lemon'], nodes);
    const m = recipeAxisProfile(['honey', 'lemon'], nodes);
    expect(w.weighted).toBe(false);
    expect(w.n).toBe(2);
    expect(w.scores.sweet).toBeCloseTo(m.scores.sweet); // 0.45
    expect(w.scores.sour).toBeCloseTo(m.scores.sour);
  });

  it('weights ingredients by entered amount', () => {
    const entries = [
      { ingredient: 'honey', amount: { qty: null, unit: 'pinch' } }, // ~1g
      { ingredient: 'lemon', amount: { qty: 2, unit: 'cup' } },      // ~480g
    ];
    const w = recipeAxisProfileWeighted(entries, nodes);
    expect(w.weighted).toBe(true);
    // lemon dominates → sour share far exceeds sweet.
    expect(w.scores.sour).toBeGreaterThan(w.scores.sweet);
    expect(w.scores.sour).toBeGreaterThan(0.7);
  });

  it('falls back to mean known weight for un-quantified ingredients', () => {
    const entries = [
      { ingredient: 'honey', amount: { qty: 1, unit: 'cup' } }, // 240g
      { ingredient: 'lemon', amount: null },                    // unknown → fallback 240g
    ];
    const w = recipeAxisProfileWeighted(entries, nodes);
    expect(w.weighted).toBe(true);
    expect(w.scores.sweet).toBeCloseTo(0.45); // equal weights → same as mean
  });

  it('skips ingredients without probs and is null-safe', () => {
    const w = recipeAxisProfileWeighted(['honey', 'mystery'], nodes);
    expect(w.n).toBe(1);
    expect(w.scores.sweet).toBeCloseTo(0.9);
    expect(recipeAxisProfileWeighted(null, nodes).n).toBe(0);
  });
});

describe('describeRecipeProfile', () => {
  const profile = (scores, drivers = {}, n = 3) => ({ scores: probs(scores), drivers, n });

  it('returns a prompt when the bowl has no flavor data', () => {
    expect(describeRecipeProfile({ scores: z(), drivers: {}, n: 0 })).toMatch(/Add ingredients/i);
  });

  it('describes a sweet-lean recipe and flags the missing balancing axis', () => {
    const out = describeRecipeProfile(profile({ sweet: 0.6, sour: 0.05 }, { sweet: ['honey'] }));
    expect(out).toMatch(/leads with sweet/i);
    expect(out).toMatch(/from honey/i);
    expect(out).toMatch(/little sour/i); // suggests adding the counter-axis
  });

  it('calls out a balanced sweet/sour pair', () => {
    const out = describeRecipeProfile(profile({ sweet: 0.3, sour: 0.2 }));
    expect(out).toMatch(/sweet and sour sit in balance/i);
  });

  it('handles an umami-rich profile', () => {
    const out = describeRecipeProfile(profile({ umami: 0.6 }, { umami: ['mushroom'] }));
    expect(out).toMatch(/umami/i);
    expect(out).toMatch(/from mushroom/i);
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
    const p = profile({ sweet: 0.4, odor_green: 0.3 }, { sweet: ['honey'] });
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
    const nodes = nodesFrom({ fig: probs({ sweet: 0.8, odor_fruity: 0.4 }) });
    const d = profileDelta('fig', scores, 2, nodes); // /(n+1)=/3
    expect(d.sweet).toBeCloseTo((0.8 - 0.2) / 3);
    const movers = topMovers(d, 2).map((m) => m.axis);
    expect(movers).toContain('sweet');
  });
  it('returns null for unknown candidate', () => {
    expect(profileDelta('nope', z(), 1, nodesFrom({}))).toBeNull();
  });
});

describe('rankByAxisImpact', () => {
  const nodes = nodesFrom({
    fig: probs({ sweet: 0.9 }),
    date: probs({ sweet: 0.7 }),
    lemon: probs({ sour: 0.9 }),
  });
  const scores = { ...z(), sweet: 0.1 };

  it('boost ranks candidates by positive delta on the axis', () => {
    const r = rankByAxisImpact(['fig', 'date', 'lemon'], 'sweet', scores, 3, nodes, { mode: 'boost' });
    expect(r.map((x) => x.name)).toEqual(['fig', 'date']); // lemon adds no sweet
  });

  it('temper ranks by the balancing axis (sweet→sour)', () => {
    const r = rankByAxisImpact(['fig', 'lemon'], 'sweet', scores, 3, nodes, { mode: 'temper' });
    expect(r[0].name).toBe('lemon'); // raises sour, the balance for sweet
  });
});

describe('buildAxisEnhancements', () => {
  const nodes = nodesFrom({
    fig: probs({ sweet: 0.9 }),
    lemon: probs({ sour: 0.9 }),
    salt: probs({ salty: 0.9 }),
  });
  const scores = { ...z(), sweet: 0.1 };

  it('returns per-axis boost + temper buckets from the candidate pool', () => {
    const rows = buildAxisEnhancements(['sweet'], ['fig', 'lemon', 'salt'], scores, 3, nodes);
    expect(rows).toHaveLength(1);
    expect(rows[0].axis).toBe('sweet');
    expect(rows[0].boost.map((b) => b.name)).toContain('fig');   // adds sweet
    expect(rows[0].temper.map((t) => t.name)).toContain('lemon'); // raises sour (balances sweet)
  });

  it('drops axes with neither boost nor temper candidates', () => {
    // salt adds neither bitter (boost) nor sweet (bitter's balance/temper) → row dropped.
    const rows = buildAxisEnhancements(['bitter'], ['salt'], scores, 3, nodes);
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
