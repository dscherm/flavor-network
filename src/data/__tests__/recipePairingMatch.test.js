import { describe, it, expect } from 'vitest';
import {
  buildPairingIndex, resolveIngredientName, scoreItemForRecipe, rankByPairing, formatPairedVia, formatMatchBadge,
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

describe('coverage — items judged on a sliver of their recipe', () => {
  it('scales the score by the share of ingredients that resolve', () => {
    // Same two readable ingredients; the second item also has two we cannot read
    // (the "Normandie Club Bloody Mary" case: aquavit + bottled mix unmatched).
    const full = scoreItemForRecipe(['beef', 'tomato'], ['Red wine', 'Cognac'], index());
    const sliver = scoreItemForRecipe(['beef', 'tomato'], ['Red wine', 'Cognac', 'Aquavit', 'House Bloody Mary Mix'], index());
    expect(sliver.score).toBeCloseTo(full.score / 2, 5);
  });

  it('a mostly-unreadable drink no longer outranks a fully-read one', () => {
    const items = [
      { name: 'Mystery Mary', ingredients: ['Red wine', 'Cognac', 'Aquavit', 'Secret mix', 'Pickle brine X'] },
      { name: 'Wine Punch', ingredients: ['Red wine', 'Cognac', 'Tomato'] },
    ];
    expect(rankByPairing(['beef', 'tomato'], items, index())[0].item.name).toBe('Wine Punch');
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

describe('name resolution — aliases, accents, trivial ingredients', () => {
  const names = new Set([...NAMES, 'apple brandy', 'benedictine', 'creme de cacao', 'madeira wine', 'cayenne pepper', 'maple syrup', 'half and half']);
  it('maps spirits the graph spells differently', () => {
    expect(resolveIngredientName('Calvados', names)).toBe('apple brandy');
    expect(resolveIngredientName('Rainwater madeira', names)).toBe('madeira wine');
    expect(resolveIngredientName('cayenne', names)).toBe('cayenne pepper');
  });
  it('strips accents and hyphens', () => {
    expect(resolveIngredientName('Bénédictine', names)).toBe('benedictine');
    expect(resolveIngredientName('1 ounce white crème de cacao', names)).toBe('creme de cacao');
    expect(resolveIngredientName('1 ounce half-and-half', names)).toBe('half and half');
  });
  it('survives a leading adjective before a comma', () => {
    expect(resolveIngredientName('½ ounce dark, robust maple syrup', names)).toBe('maple syrup');
  });
  it('ice and soda are trivial: neither matched nor counted as unresolved', () => {
    expect(resolveIngredientName('3 oz Club soda', names)).toBeNull();
    const a = scoreItemForRecipe(['beef', 'tomato'], ['Red wine', 'Cognac'], index());
    const b = scoreItemForRecipe(['beef', 'tomato'], ['Red wine', 'Cognac', 'cubes ice', 'cold seltzer'], index());
    expect(b.score).toBeCloseTo(a.score, 6);
  });
});

describe('scoring floors and badges', () => {
  it('rankByPairing drops items under the match floor', () => {
    const items = [{ name: 'Gin Tonic', ingredients: ['Gin', 'Tonic water'] }];
    expect(rankByPairing(['beef'], items, index())).toEqual([]);
  });
  it('a hub-only drink scores below a drink with a specific pairing', () => {
    const items = [
      { name: 'Syrup Sour', ingredients: ['Syrup', 'Lime juice', 'Lime'] },
      { name: 'Wine Punch', ingredients: ['Red wine', 'Cognac'] },
    ];
    const [first] = rankByPairing(['beef', 'tomato'], items, index(), 2, 0);
    expect(first.item.name).toBe('Wine Punch');
  });
  it('formatMatchBadge labels weak matches instead of quoting a low percent', () => {
    expect(formatMatchBadge(0.12)).toBe('loose match');
    expect(formatMatchBadge(0.47)).toBe('47% match');
  });
});
