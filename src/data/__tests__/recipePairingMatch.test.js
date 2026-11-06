import { describe, it, expect } from 'vitest';
import {
  buildPairingIndex, resolveIngredientName, scoreItemForRecipe, rankByPairing, formatPairedVia,
} from '../recipePairingMatch.js';

const NAMES = ['beef', 'tomato', 'red wine', 'onion', 'gin', 'lime', 'lime juice', 'syrup',
  'tequila', 'cognac', 'tonic water', 'bitters', 'filler1', 'filler2', 'filler3'];

// syrup is a hub: it pairs with everything.
function edge(source, target, strength, known = true) { return { source, target, strength, known }; }
const EDGES = [
  edge('beef', 'red wine', 0.9),
  edge('tomato', 'red wine', 0.6),
  edge('cognac', 'red wine', 0.8),
  edge('tequila', 'lime', 0.9),
  edge('beef', 'gin', 0.95, false), // predicted, not observed — must be ignored
  ...NAMES.filter((n) => n !== 'syrup').map((n) => edge('syrup', n, 0.9)),
];

const index = () => buildPairingIndex(EDGES, NAMES);

describe('resolveIngredientName', () => {
  const names = new Set(NAMES);
  it('strips measures and qualifiers', () => {
    expect(resolveIngredientName('2 oz Gin', names)).toBe('gin');
    expect(resolveIngredientName('1/2 oz fresh lime juice', names)).toBe('lime juice');
  });
  it('falls back to the trailing words', () => {
    expect(resolveIngredientName('London dry gin', names)).toBe('gin');
    expect(resolveIngredientName('Cocchi Americano', names)).toBeNull();
  });
  it('handles simple plurals', () => {
    expect(resolveIngredientName('limes', names)).toBe('lime');
  });
});

describe('buildPairingIndex', () => {
  it('keeps only observed pairings when the flag is present', () => {
    const idx = index();
    expect(idx.strength.get('beef|red wine')).toBe(0.9);
    expect(idx.strength.get('red wine|beef')).toBe(0.9);
    expect(idx.strength.has('beef|gin')).toBe(false);
  });
  it('uses every edge when no edge carries the flag', () => {
    const idx = buildPairingIndex([{ source: 'beef', target: 'gin', strength: 0.5 }], NAMES);
    expect(idx.strength.get('gin|beef')).toBe(0.5);
  });
  it('caches per edges array', () => {
    expect(buildPairingIndex(EDGES, NAMES)).toBe(buildPairingIndex(EDGES, NAMES));
  });
});

describe('scoreItemForRecipe', () => {
  it('returns null when fewer than 2 item ingredients resolve', () => {
    expect(scoreItemForRecipe(['beef'], ['Gin', 'Cocchi Americano'], index())).toBeNull();
  });
  it('reports which pairs drove the score, best first', () => {
    const s = scoreItemForRecipe(['beef', 'tomato'], ['Cognac', 'Red wine'], index());
    expect(s.score).toBeGreaterThan(0);
    expect(s.pairedVia[0]).toEqual({ item: 'red wine', recipe: 'beef' });
  });
  it('a shared ingredient counts as a perfect pair', () => {
    const s = scoreItemForRecipe(['red wine', 'beef'], ['red wine', 'cognac'], index());
    expect(s.pairedVia).toContainEqual({ item: 'red wine', recipe: 'red wine' });
  });
});

describe('rankByPairing', () => {
  const items = [
    { name: 'Margarita', ingredients: ['Tequila', 'Lime juice', 'Syrup'] },
    { name: 'Wine Punch', ingredients: ['Red wine', 'Cognac', 'Syrup'] },
    { name: 'Gin Tonic', ingredients: ['Gin', 'Tonic water'] },
  ];

  it('ranks the drink that truly pairs with the dish first', () => {
    const ranked = rankByPairing(['beef', 'tomato', 'onion'], items, index());
    expect(ranked[0].item.name).toBe('Wine Punch');
  });

  it('a hub ingredient (syrup pairs with everything) cannot carry a drink', () => {
    const ranked = rankByPairing(['beef', 'tomato', 'onion'], items, index());
    const margarita = ranked.find((r) => r.item.name === 'Margarita');
    const punch = ranked.find((r) => r.item.name === 'Wine Punch');
    expect(punch.similarity).toBeGreaterThan(margarita.similarity * 1.5);
  });

  it('ignores predicted pairings (beef–gin is not observed)', () => {
    const ranked = rankByPairing(['beef'], items, index());
    const gt = ranked.find((r) => r.item.name === 'Gin Tonic');
    expect(gt?.similarity ?? 0).toBe(0);
  });

  it('keeps the aroma-ranker result shape', () => {
    const [top] = rankByPairing(['beef', 'tomato'], items, index(), 1);
    expect(top).toEqual(expect.objectContaining({ item: expect.any(Object), similarity: expect.any(Number), matchedAromas: [] }));
    expect(Array.isArray(top.pairedVia)).toBe(true);
  });
});

describe('formatPairedVia', () => {
  it('reads naturally for shared and paired ingredients', () => {
    expect(formatPairedVia({ item: 'red wine', recipe: 'red wine' })).toBe('shares red wine');
    expect(formatPairedVia({ item: 'cognac', recipe: 'beef' })).toBe('cognac + beef');
  });
});
