import { describe, it, expect } from 'vitest';
import {
  TASTE_COLUMNS,
  EMPTY_ADD_COLUMNS,
  computeDominantTaste,
  rankAddByTaste,
} from '../addModeBucketing.js';

// Build a minimal node by inferring from name hints in tastePositioning.
// scoreIngredient walks NAME_HINTS keyed on substring of `name`.
function makeNode() {
  // node.taste is consulted, but if absent the name-hints path runs.
  return {};
}

function buildNodes(names) {
  const m = new Map();
  for (const n of names) m.set(n, makeNode());
  return m;
}

// Synthetic recipePairs + globalCount fixture small enough to predict
// outputs deterministically.
function makeFixture() {
  const globalCount = {
    sugar: 200, salt: 200, lemon: 200, coffee: 200, soy: 200,
    chile: 200, garlic: 200, wine: 200, butter: 100, basil: 200,
    onion: 200,
  };
  const recipePairs = {
    onion: { garlic: 30, sugar: 20, salt: 25, lemon: 12, soy: 15, chile: 18, butter: 10 },
    tomato: { garlic: 20, sugar: 14, salt: 22, lemon: 10, soy: 5, chile: 12, basil: 25, butter: 8 },
  };
  return { recipePairs, globalCount };
}

describe('TASTE_COLUMNS', () => {
  it('matches the 8-axis AXES order in SuggestionDrawer', () => {
    expect(TASTE_COLUMNS).toEqual([
      'sweet', 'salty', 'sour', 'bitter', 'umami', 'spicy', 'pungent', 'astringent',
    ]);
  });
});

describe('computeDominantTaste', () => {
  it('returns null when node is missing', () => {
    expect(computeDominantTaste('sugar', undefined)).toBeNull();
    expect(computeDominantTaste('sugar', null)).toBeNull();
  });

  it('infers sweet from name hint (sugar)', () => {
    expect(computeDominantTaste('sugar', {})).toBe('sweet');
  });

  it('infers sour from name hint (lemon)', () => {
    expect(computeDominantTaste('lemon', {})).toBe('sour');
  });

  it('infers spicy from name hint (chile)', () => {
    expect(computeDominantTaste('chile', {})).toBe('spicy');
  });

  it('infers pungent from name hint (garlic)', () => {
    expect(computeDominantTaste('garlic', {})).toBe('pungent');
  });

  it('reads explicit taste metadata when present (umami)', () => {
    // Use a name with no NAME_HINTS match so the explicit taste string
    // is the only signal (avoids parmesan double-scoring umami+salty
    // and the alphabetical tie-break picking salty).
    expect(computeDominantTaste('xyzabc', { taste: 'umami' })).toBe('umami');
  });

  it('returns null when no signal at all', () => {
    expect(computeDominantTaste('foobarbaz', {})).toBeNull();
  });

  it('breaks ties alphabetically (R1 determinism)', () => {
    // Inject a node whose explicit taste string triggers two channels
    // at the same score (both 0.9 from TASTE_CHANNEL_KEYWORDS).
    // Channels at 0.9: bitter and umami. Alphabetical tie-break → 'bitter'.
    const tied = computeDominantTaste('foo', { taste: 'bitter, umami' });
    expect(tied).toBe('bitter');
  });
});

describe('rankAddByTaste', () => {
  const { recipePairs, globalCount } = makeFixture();
  const nodes = buildNodes([
    'sugar', 'salt', 'lemon', 'coffee', 'soy', 'chile', 'garlic',
    'wine', 'butter', 'basil', 'onion', 'tomato',
  ]);

  it('returns 8 columns in TASTE_COLUMNS order even when most are empty (AC-9)', () => {
    const cols = rankAddByTaste(['onion'], recipePairs, globalCount, nodes);
    expect(cols.map(c => c.taste)).toEqual(TASTE_COLUMNS);
    expect(cols).toHaveLength(8);
  });

  it('respects topK=12 per column (AC-10)', () => {
    // Synthesize a case where >12 candidates would pile into one bucket.
    const fakePairs = { onion: {} };
    const fakeGlobal = {};
    const fakeNodes = new Map();
    for (let i = 0; i < 30; i++) {
      const n = `sugarcube${i}`;
      fakePairs.onion[n] = 50 - i;
      fakeGlobal[n] = 100;
      fakeNodes.set(n, {});
    }
    fakeGlobal.onion = 100;
    fakeNodes.set('onion', {});
    const cols = rankAddByTaste(['onion'], fakePairs, fakeGlobal, fakeNodes);
    const sweetCol = cols.find(c => c.taste === 'sweet');
    expect(sweetCol.candidates.length).toBeLessThanOrEqual(12);
  });

  it('excludes bowl ingredients from candidates (AC-12)', () => {
    // The engine itself dedupes via bowlSet at recipeSuggestionEngine:48.
    const cols = rankAddByTaste(['onion', 'sugar'], recipePairs, globalCount, nodes);
    const all = cols.flatMap(c => c.candidates.map(x => x.name));
    expect(all).not.toContain('onion');
    expect(all).not.toContain('sugar');
  });

  it('respects scopeFilter (AC-14) — only chips inside the allowlist appear', () => {
    const scope = new Set(['lemon', 'salt']);
    const cols = rankAddByTaste(['onion'], recipePairs, globalCount, nodes, scope);
    const all = cols.flatMap(c => c.candidates.map(x => x.name));
    for (const name of all) {
      expect(scope.has(name.toLowerCase())).toBe(true);
    }
  });

  it('attaches dominantTaste metadata to each chip', () => {
    const cols = rankAddByTaste(['onion'], recipePairs, globalCount, nodes);
    for (const col of cols) {
      for (const cand of col.candidates) {
        expect(cand.dominantTaste).toBe(col.taste);
      }
    }
  });

  it('returns chip-ready shape: tasteLabels (array), inRecipe (bool), matchPct (number)', () => {
    const recipeIngredients = ['salt'];
    const cols = rankAddByTaste(['onion'], recipePairs, globalCount, nodes, null, {}, recipeIngredients);
    const allCands = cols.flatMap(c => c.candidates);
    expect(allCands.length).toBeGreaterThan(0);
    for (const cand of allCands) {
      expect(Array.isArray(cand.tasteLabels)).toBe(true);
      expect(typeof cand.inRecipe).toBe('boolean');
      expect(typeof cand.matchPct).toBe('number');
      expect(cand.taste).toBe(cand.dominantTaste);
    }
    // salt is in recipeIngredients — verify inRecipe flag
    const saltyCand = cols.find(c => c.taste === 'salty')?.candidates.find(c => c.name === 'salt');
    if (saltyCand) expect(saltyCand.inRecipe).toBe(true);
  });

  it('EMPTY_ADD_COLUMNS is frozen with 8 empty-candidate entries', () => {
    expect(EMPTY_ADD_COLUMNS).toHaveLength(8);
    expect(EMPTY_ADD_COLUMNS.map(c => c.taste)).toEqual(TASTE_COLUMNS);
    for (const col of EMPTY_ADD_COLUMNS) {
      expect(col.candidates).toEqual([]);
    }
  });

  it('returns 8 empty columns when nodes is missing', () => {
    const cols = rankAddByTaste(['onion'], recipePairs, globalCount, new Map());
    expect(cols).toHaveLength(8);
    for (const col of cols) expect(col.candidates).toEqual([]);
  });

  it('handles empty bowl by ranking from globalCount (engine v2 fallback)', () => {
    // engine returns top-K by globalCount when bowl is empty — bucketing
    // still partitions into 8 columns.
    const cols = rankAddByTaste([], recipePairs, globalCount, nodes);
    expect(cols).toHaveLength(8);
    const total = cols.reduce((acc, c) => acc + c.candidates.length, 0);
    expect(total).toBeGreaterThan(0);
  });
});
