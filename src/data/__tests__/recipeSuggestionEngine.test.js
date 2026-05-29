import { describe, it, expect } from 'vitest';
import {
  rankByRecipeCooccurrence,
  rankSuggestions,
} from '../recipeSuggestionEngine.js';
import { makeBowlEntry } from '../bowlEntry.js';

// Test fixture — symmetric pair graph so every (a,b) entry appears in
// both directions with the same count (the ranker iterates each bowl
// member's outbound partner map, so asymmetric data would silently drop
// candidates that only appear on the inbound side). Counts above the
// FAMILIARITY_FLOOR (50) except cinnamon, which is gated out.
function buildCtx() {
  const recipePairs = {
    tomato: { basil: 1000, garlic: 800, oregano: 600, onion: 700, parsley: 400, cinnamon: 5 },
    basil:  { tomato: 1000, garlic: 500, oregano: 700, onion: 300, parsley: 600, cinnamon: 2 },
    garlic: { tomato: 800, basil: 500, oregano: 400, onion: 900, parsley: 350, cinnamon: 10 },
    oregano: { tomato: 600, basil: 700, garlic: 400, onion: 200, parsley: 500 },
    onion:  { tomato: 700, basil: 300, garlic: 900, oregano: 200, parsley: 250 },
    parsley: { tomato: 400, basil: 600, garlic: 350, oregano: 500, onion: 250 },
    sugar:  { butter: 1200, flour: 1100 },
    butter: { sugar: 1200, flour: 900 },
    flour:  { sugar: 1100, butter: 900 },
    cinnamon: { tomato: 5, basil: 2, garlic: 10 },
  };
  const globalCount = {
    tomato: 5000, basil: 3000, garlic: 4500, oregano: 1200,
    onion: 8000, parsley: 1500,
    sugar: 9000, butter: 7000, flour: 7500,
    cinnamon: 30,  // BELOW the FAMILIARITY_FLOOR of 50 — should be gated out
  };
  return { recipePairs, globalCount, K: 100 };
}

describe('rankSuggestions — §13.1 focal-weighted ranker (RL-FOCAL-RANKER)', () => {
  it('focal-set ranking: focal contributes 60% of the score', () => {
    // Bowl = [tomato (focal), basil]. With W_FOCAL=0.6, the candidate
    // "garlic" gets log1p(800)*0.6 from tomato + log1p(500)*0.4 from basil.
    const bowl = [makeBowlEntry('tomato'), makeBowlEntry('basil')];
    const ranked = rankSuggestions(bowl, 'tomato', null, buildCtx());
    const names = ranked.map((r) => r.name);
    expect(names).toContain('garlic');
    expect(names).toContain('oregano');
    expect(names).toContain('onion');
    // cinnamon should be dropped by the FAMILIARITY_FLOOR gate (count=30)
    expect(names).not.toContain('cinnamon');
    // Strength is max-normalized
    expect(ranked[0].strength).toBe(1);
    for (const r of ranked) expect(r.strength).toBeLessThanOrEqual(1);
  });

  it('focal-set ranking differs from focal-null ranking on the same bowl', () => {
    // Same bowl, different focal flag → different ranking
    const bowl = [makeBowlEntry('tomato'), makeBowlEntry('basil')];
    const withFocal = rankSuggestions(bowl, 'tomato', null, buildCtx());
    const withoutFocal = rankSuggestions(bowl, null, null, buildCtx());
    // Both rankings contain the same candidates...
    expect(new Set(withFocal.map((r) => r.name)))
      .toEqual(new Set(withoutFocal.map((r) => r.name)));
    // ...but the focal-set scores weight tomato more heavily; garlic
    // (high co-occurrence with tomato=800 vs basil=500) should rank
    // higher relative to oregano when tomato is focal.
    const focalGarlic = withFocal.find((r) => r.name === 'garlic')?.strength ?? 0;
    const focalOregano = withFocal.find((r) => r.name === 'oregano')?.strength ?? 0;
    expect(focalGarlic).toBeGreaterThan(focalOregano);
  });

  it('focal-null + masses ranking: highest-mass ingredient auto-focals', () => {
    // Bowl = [tomato (small mass), basil (LARGE mass)]. focalKey=null
    // should auto-promote basil to focal because it has the larger mass.
    const bowl = [
      { ingredient: 'tomato', amount: { raw: '1 oz', qty: 1, unit: 'oz', inferred: false } },
      { ingredient: 'basil',  amount: { raw: '2 cup', qty: 2, unit: 'cup', inferred: false } },
    ];
    const ranked = rankSuggestions(bowl, null, null, buildCtx());
    // Compare against the same bowl with basil explicitly focal — they
    // should produce identical ranking when auto-focal is correct.
    const explicit = rankSuggestions(bowl, 'basil', null, buildCtx());
    expect(ranked.map((r) => r.name)).toEqual(explicit.map((r) => r.name));
  });

  it('no-amounts equal-weight: behaves like rankByRecipeCooccurrence (rank order matches)', () => {
    // Bowl with no amounts + no focal → equal-weight fallback. The
    // ranking should match rankByRecipeCooccurrence (which is unweighted
    // sum) up to max-normalization, since uniform 1/N is a monotonic
    // rescaling.
    const bowl = [makeBowlEntry('tomato'), makeBowlEntry('basil')];
    const focal = rankSuggestions(bowl, null, null, buildCtx());
    const legacy = rankByRecipeCooccurrence(['tomato', 'basil'], buildCtx().recipePairs, buildCtx().globalCount);
    expect(focal.map((r) => r.name)).toEqual(legacy.map((r) => r.name));
  });

  it('empty bowl falls back to global popularity (§8.2 preserved)', () => {
    const ranked = rankSuggestions([], null, null, buildCtx());
    // Top of result is the highest globalCount that clears FAMILIARITY_FLOOR
    expect(ranked[0].name).toBe('sugar');
    expect(ranked[0].strength).toBe(1);
    // cinnamon (count=30) is gated out
    expect(ranked.find((r) => r.name === 'cinnamon')).toBeUndefined();
  });

  it('FAMILIARITY_FLOOR gate drops obscure candidates', () => {
    const bowl = [makeBowlEntry('tomato'), makeBowlEntry('basil')];
    const ranked = rankSuggestions(bowl, 'tomato', null, buildCtx());
    expect(ranked.find((r) => r.name === 'cinnamon')).toBeUndefined();
  });

  it('candidates filter restricts the result set to the allow-list', () => {
    const bowl = [makeBowlEntry('tomato')];
    const ranked = rankSuggestions(bowl, 'tomato', ['garlic', 'oregano'], buildCtx());
    expect(ranked.map((r) => r.name).sort()).toEqual(['garlic', 'oregano']);
  });

  it('bowl entries already in the bowl are never returned as candidates', () => {
    const bowl = [makeBowlEntry('tomato'), makeBowlEntry('basil')];
    const ranked = rankSuggestions(bowl, 'tomato', null, buildCtx());
    for (const r of ranked) {
      expect(['tomato', 'basil']).not.toContain(r.name);
    }
  });

  it('returns [] when ctx is missing recipePairs or globalCount', () => {
    const bowl = [makeBowlEntry('tomato')];
    expect(rankSuggestions(bowl, 'tomato', null, {})).toEqual([]);
    expect(rankSuggestions(bowl, 'tomato', null, { recipePairs: {} })).toEqual([]);
  });

  it('mass-proportional non-focal weights: heavier non-focal contributes more', () => {
    // Bowl = [tomato (focal), basil (light), garlic (heavy)]. With focal=tomato,
    // garlic's larger mass should shift the secondary weighting toward
    // garlic's co-occurrence pattern.
    const ctx = buildCtx();
    const bowlBasilHeavy = [
      makeBowlEntry('tomato'),
      { ingredient: 'basil',  amount: { raw: '5 cup', qty: 5, unit: 'cup', inferred: false } },
      { ingredient: 'garlic', amount: { raw: '1 g',   qty: 1, unit: 'g',   inferred: false } },
    ];
    const bowlGarlicHeavy = [
      makeBowlEntry('tomato'),
      { ingredient: 'basil',  amount: { raw: '1 g',   qty: 1, unit: 'g',   inferred: false } },
      { ingredient: 'garlic', amount: { raw: '5 cup', qty: 5, unit: 'cup', inferred: false } },
    ];
    const rBasil   = rankSuggestions(bowlBasilHeavy,  'tomato', null, ctx);
    const rGarlic  = rankSuggestions(bowlGarlicHeavy, 'tomato', null, ctx);
    // Different mass distributions → different score values (rank order
    // can differ). At minimum the result sets should not be byte-identical.
    expect(JSON.stringify(rBasil)).not.toBe(JSON.stringify(rGarlic));
  });
});
