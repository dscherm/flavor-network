import { describe, it, expect, beforeEach } from 'vitest';
import {
  everydayScore, pmiOf, nameVariants, mapCooccurrenceNames, selectEverydayPairs, pairStrengths,
} from '../everydayPairsSelect.js';
import {
  parseEverydayPairs, loadEverydayPairs, resetEverydayPairs, strength, partners, blendIndex,
} from '../everydayPairs.js';
import { buildPairingIndex } from '../recipePairingMatch.js';
import { inventRecipes } from '../inventRecipe.js';

// ── Builder selection rule (tiny fixture) ─────────────────────────────

// 1000 recipes. garlic and onion are hubs; salt is everywhere.
const CO = {
  totalRecipes: 1000,
  ingredients: {
    garlic: 400, onion: 450, 'olive oil': 300, chicken: 200, lemon: 150,
    salt: 900, vanilla: 100, saffron: 40, 'freshly squeezed lemon juice': 60, 'lemon juice': 80,
    tomatoes: 250,
  },
  pairs: {
    'garlic|onion': { count: 300 },          // hub pair, modest lift
    'garlic|olive oil': { count: 220 },
    'chicken|garlic': { count: 120 },
    'chicken|lemon': { count: 40 },          // small lift, still common
    'garlic|salt': { count: 380 },           // trivial partner
    'garlic|vanilla': { count: 5 },          // below the count floor
    'onion|vanilla': { count: 40 },          // negative PMI (450·100/1000 = 45 expected)
    'chicken|saffron': { count: 12 },        // below the floor
    'freshly squeezed lemon juice|garlic': { count: 30 },
    'garlic|lemon juice': { count: 30 },
    'garlic|tomatoes': { count: 200 },
    'olive oil|onion': { count: 140 },       // second best on both sides
  },
};
const VOCAB = new Set(['garlic', 'onion', 'olive oil', 'chicken', 'lemon', 'salt', 'vanilla', 'saffron', 'lemon juice', 'tomato']);

describe('everydayScore / pmiOf', () => {
  it('is zero without positive PMI and grows with count', () => {
    expect(everydayScore(100, 0)).toBe(0);
    expect(everydayScore(100, -1)).toBe(0);
    expect(everydayScore(1000, 0.5)).toBeGreaterThan(everydayScore(100, 0.5));
    expect(everydayScore(100, 1)).toBeGreaterThan(everydayScore(100, 0.2));
  });
  it('lets a common modest-lift pair beat a rare high-lift one', () => {
    // chicken|lemon in RecipeNLG: 8198 recipes, PMI 0.21 vs an oddity: 40 recipes, PMI 3
    expect(everydayScore(8198, 0.21)).toBeGreaterThan(everydayScore(40, 3));
  });
  it('computes log2 PMI', () => {
    expect(pmiOf(50, 100, 100, 200)).toBeCloseTo(0, 6);
    expect(pmiOf(100, 100, 100, 200)).toBeCloseTo(1, 6);
  });
});

describe('name mapping', () => {
  it('offers singular, joined and modifier-free variants', () => {
    expect(nameVariants('tomatoes')).toContain('tomato');
    expect(nameVariants('lemon grass')).toContain('lemongrass');
    expect(nameVariants('freshly squeezed lemon juice')).toContain('lemon juice');
    expect(nameVariants('aubergine')).toContain('eggplant');
  });
  it('maps direct names first and reports the rest', () => {
    const m = mapCooccurrenceNames(['garlic', 'tomatoes', 'freshly squeezed lemon juice', 'zzz'], VOCAB);
    expect(m.map.get('garlic')).toBe('garlic');
    expect(m.map.get('tomatoes')).toBe('tomato');
    expect(m.map.get('freshly squeezed lemon juice')).toBe('lemon juice');
    expect(m.direct).toBe(1);
    expect(m.aliased).toBe(2);
    expect(m.unmapped).toEqual(['zzz']);
  });
});

describe('selectEverydayPairs', () => {
  const run = (opts = {}) => selectEverydayPairs(CO, { vocab: VOCAB, exclude: ['salt'], minCount: 30, topK: 3, ...opts });
  const keys = (r) => r.pairs.map((p) => `${p.a}|${p.b}`);

  it('keeps hub pairs the NPMI blend dropped', () => {
    const k = keys(run());
    expect(k).toContain('garlic|onion');
    expect(k).toContain('garlic|olive oil');
    expect(k).toContain('chicken|garlic');
  });
  it('drops the trivial set, the count floor and non-positive PMI', () => {
    const k = keys(run());
    expect(k.some((x) => x.includes('salt'))).toBe(false);
    expect(k).not.toContain('garlic|vanilla');
    expect(k).not.toContain('onion|vanilla');
    expect(k).not.toContain('chicken|saffron');
  });
  it('merges aliased names onto the vocab name (counts summed)', () => {
    const r = run();
    const lj = r.pairs.find((p) => p.a === 'garlic' && p.b === 'lemon juice');
    expect(lj?.count).toBe(60);
    expect(keys(r)).toContain('garlic|tomato');
  });
  it('keeps a pair when it is in the top K of EITHER side', () => {
    // With K=1 garlic keeps only onion on its side, but chicken|garlic
    // survives as chicken's best and chicken|lemon as lemon's best;
    // olive oil|onion is second on both sides and goes.
    const k = keys(run({ topK: 1 }));
    expect(k).toContain('chicken|garlic');
    expect(k).toContain('chicken|lemon');
    expect(k).not.toContain('olive oil|onion');
    expect(keys(run({ topK: 3 }))).toContain('olive oil|onion');
  });
  it('is deterministic and sorted', () => {
    expect(keys(run())).toEqual(keys(run()));
    const k = keys(run());
    expect([...k].sort()).toEqual(k);
    for (const p of run().pairs) expect(p.a < p.b).toBe(true);
  });
});

describe('pairStrengths', () => {
  const pairs = [{ score: 1 }, { score: 3 }, { score: 2 }];
  it('maps score percentiles to 0..1', () => {
    expect(pairStrengths(pairs)).toEqual([0.01, 1, 0.5]);
  });
  it('quantile-maps onto a reference distribution', () => {
    expect(pairStrengths(pairs, [0.1, 0.2, 0.6])).toEqual([0.1, 0.6, 0.2]);
  });
});

// ── Loader + blend ────────────────────────────────────────────────────

const ARTIFACT = { names: ['chicken', 'garlic', 'lemon', 'onion'], pairs: [0, 1, 70, 0, 2, 50, 1, 3, 90] };

describe('parseEverydayPairs / strength / partners', () => {
  const ev = parseEverydayPairs(ARTIFACT);
  it('reads both directions', () => {
    expect(strength(ev, 'chicken', 'garlic')).toBe(0.7);
    expect(strength(ev, 'garlic', 'chicken')).toBe(0.7);
    expect(strength(ev, 'chicken', 'onion')).toBe(0);
    expect(strength(null, 'chicken', 'garlic')).toBe(0);
  });
  it('lists partners strongest first', () => {
    expect(partners(ev, 'garlic', 5).map((p) => p.name)).toEqual(['onion', 'chicken']);
    expect(partners(ev, 'garlic', 1)).toEqual([{ name: 'onion', s: 0.9 }]);
    expect(partners(ev, 'nothing')).toEqual([]);
  });
  it('rejects malformed input', () => {
    expect(parseEverydayPairs(null)).toBeNull();
    expect(parseEverydayPairs({ names: ['a'], pairs: [0, 1] })).toBeNull();
  });
});

describe('loadEverydayPairs', () => {
  beforeEach(() => resetEverydayPairs());
  it('loads once and caches', async () => {
    let calls = 0;
    const f = async () => { calls += 1; return { ok: true, json: async () => ARTIFACT }; };
    const a = await loadEverydayPairs(f);
    const b = await loadEverydayPairs(f);
    expect(a).toBe(b);
    expect(calls).toBe(1);
    expect(strength(a, 'garlic', 'onion')).toBe(0.9);
  });
  it('resolves to null on a failed fetch, and retries later', async () => {
    expect(await loadEverydayPairs(async () => ({ ok: false, json: async () => null }))).toBeNull();
    expect(await loadEverydayPairs(async () => { throw new Error('offline'); })).toBeNull();
    expect(await loadEverydayPairs(async () => ({ ok: true, json: async () => { throw new Error('bad json'); } }))).toBeNull();
    const ok = await loadEverydayPairs(async () => ({ ok: true, json: async () => ARTIFACT }));
    expect(ok).not.toBeNull();
  });
});

describe('blendIndex', () => {
  const NAMES = ['chicken', 'garlic', 'lemon', 'onion', 'saffron'];
  const curated = buildPairingIndex([
    { source: 'chicken', target: 'saffron', strength: 0.4, known: true },
    { source: 'garlic', target: 'onion', strength: 0.95, known: true },
  ], NAMES);
  const ev = parseEverydayPairs(ARTIFACT);

  it('has the buildPairingIndex shape and takes the max per pair', () => {
    const b = blendIndex(curated, ev);
    expect(b.strength).toBeInstanceOf(Map);
    expect(b.names).toBe(curated.names);
    expect(b.nodeCount).toBe(NAMES.length);
    expect(b.strength.get('chicken|garlic')).toBe(0.7);       // everyday only
    expect(b.strength.get('saffron|chicken')).toBe(0.4);      // curated only
    expect(b.strength.get('onion|garlic')).toBe(0.95);        // curated higher
    expect(b.degree.get('garlic')).toBe(2);                   // onion + chicken
    expect(b.degree.get('chicken')).toBe(3);
  });
  it('does not mutate the curated index', () => {
    blendIndex(curated, ev);
    expect(curated.strength.has('chicken|garlic')).toBe(false);
  });
  it('falls back cleanly', () => {
    expect(blendIndex(curated, null)).toBe(curated);
    expect(blendIndex(null, null)).toBeNull();
    const alone = blendIndex(null, ev);
    expect(alone.strength.get('garlic|onion')).toBe(0.9);
    expect(alone.names.has('lemon')).toBe(true);
  });
  it('caches per (curated, everyday) pair', () => {
    expect(blendIndex(curated, ev)).toBe(blendIndex(curated, ev));
  });
  it('drops into an existing scorer unchanged', async () => {
    const suggest = async (members, { candidateNames }) => (candidateNames || []).map((name, i) => ({ name, score: 2 - i * 0.1 }));
    const kitchen = ['chicken', 'garlic', 'onion'];
    const nodes = new Map([['chicken', { category: 'protein' }]]);
    const before = await inventRecipes({ kitchen, suggest, pairingIndex: curated, nodes, names: new Set(NAMES), limit: 3 });
    const after = await inventRecipes({ kitchen, suggest, pairingIndex: blendIndex(curated, ev), nodes, names: new Set(NAMES), limit: 3 });
    expect(after.ok).toBe(true);
    expect(after.inventions[0].score).toBeGreaterThan(before.inventions[0].score);
    expect(after.inventions[0].why).toMatch(/garlic/);
  });
});
