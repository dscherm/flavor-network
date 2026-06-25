import { describe, it, expect } from 'vitest';
import {
  LENSES,
  LENS_LABELS,
  LENS_TO_AXIS,
  egoNeighborhood,
  groupByLens,
  lensInsight,
  partnerBridges,
  sharedNeighborhood,
  monthToSeasonLabel,
  serendipitousPick,
  surprisingNeighborhood,
} from '../pairingEgoModel.js';

// ── Fixture ───────────────────────────────────────────────────────────
// Center 'garlic' with 5 partners of decreasing strength. Each node
// carries the fields the categorical bucketers read: flavorGraph.tier1
// (aroma — chef-tier1 wins, deterministic), taste (string), cuisines,
// category. Season comes from ctx.seasonMap.
const NODES = new Map([
  ['garlic', { name: 'garlic', taste: 'pungent', category: 'Aromatic',  cuisines: ['Italian'],       flavorGraph: { tier1: ['pungent'] } }],
  ['basil',  { name: 'basil',  taste: 'bitter',  category: 'Herb',      cuisines: ['Italian'],       flavorGraph: { tier1: ['green'] } }],
  ['lemon',  { name: 'lemon',  taste: 'sour',    category: 'Fruit',     cuisines: ['Mediterranean'], flavorGraph: { tier1: ['citrus'] } }],
  ['onion',  { name: 'onion',  taste: 'pungent', category: 'Vegetable', cuisines: ['French'],        flavorGraph: { tier1: ['pungent'] } }],
  ['butter', { name: 'butter', taste: 'sweet',   category: 'Fat',       cuisines: ['French'],        flavorGraph: { tier1: ['creamy'] } }],
  ['thyme',  { name: 'thyme',  taste: 'bitter',  category: 'Herb',      cuisines: ['Mediterranean'], flavorGraph: { tier1: ['herbal'] } }],
]);

const EDGES = [
  { source: 'garlic', target: 'basil',  strength: 0.9 },
  { source: 'lemon',  target: 'garlic', strength: 0.8 }, // reversed orientation
  { source: 'garlic', target: 'onion',  strength: 0.7 },
  { source: 'garlic', target: 'butter', strength: 0.6 },
  { source: 'garlic', target: 'thyme',  strength: 0.5 },
  { source: 'lemon',  target: 'thyme',  strength: 0.4 }, // unrelated to garlic
];

const DATA = { graph: { nodes: NODES, edges: EDGES } };
const CTX = {
  cuisineMap: {},
  seasonMap: {
    basil:  { season: 'summer' },
    lemon:  { season: 'winter' },
    onion:  { season: 'year-round' },
    butter: { season: 'year-round' },
    thyme:  { season: 'summer' },
  },
};

// ── exports ───────────────────────────────────────────────────────────
describe('pairingEgoModel — exports', () => {
  it('LENSES is the ordered lens set with affinity first', () => {
    expect(LENSES).toEqual(['affinity', 'aroma', 'taste', 'cuisine', 'season']);
    expect(LENS_LABELS.affinity).toBe('Affinity');
    expect(LENS_TO_AXIS.aroma).toBe('aromas'); // plural axis key
    expect(LENS_TO_AXIS.affinity).toBeNull();
  });
});

// ── egoNeighborhood ───────────────────────────────────────────────────
describe('egoNeighborhood', () => {
  it('returns partners sorted by strength desc, self excluded, node attached', () => {
    const ego = egoNeighborhood('garlic', DATA);
    expect(ego.map((p) => p.name)).toEqual(['basil', 'lemon', 'onion', 'butter', 'thyme']);
    expect(ego.every((p) => p.name !== 'garlic')).toBe(true);
    expect(ego[0]).toMatchObject({ name: 'basil', strength: 0.9 });
    expect(ego[0].node).toBe(NODES.get('basil'));
  });

  it('respects the limit', () => {
    const ego = egoNeighborhood('garlic', DATA, { limit: 3 });
    expect(ego.map((p) => p.name)).toEqual(['basil', 'lemon', 'onion']);
  });

  it('carries pairing provenance (chemistry when no cuisine index)', () => {
    const ego = egoNeighborhood('garlic', DATA);
    expect(ego.every((p) => p.provenance === 'chemistry')).toBe(true);
  });

  it('picks up reversed-orientation edges (target === center)', () => {
    const ego = egoNeighborhood('garlic', DATA);
    expect(ego.find((p) => p.name === 'lemon')).toBeTruthy();
  });

  it('is null-safe on missing/empty data', () => {
    expect(egoNeighborhood('garlic', {})).toEqual([]);
    expect(egoNeighborhood('garlic', { graph: { edges: [] } })).toEqual([]);
    expect(egoNeighborhood('', DATA)).toEqual([]);
    expect(egoNeighborhood(null, DATA)).toEqual([]);
  });

  it('tolerates partners missing from the nodes map (node = null)', () => {
    const data = { graph: { nodes: new Map(), edges: EDGES } };
    const ego = egoNeighborhood('garlic', data);
    expect(ego.length).toBe(5);
    expect(ego.every((p) => p.node === null)).toBe(true);
  });
});

// ── groupByLens ───────────────────────────────────────────────────────
describe('groupByLens', () => {
  const ego = egoNeighborhood('garlic', DATA);

  it('affinity → a single strength-sorted group', () => {
    const groups = groupByLens(ego, 'affinity', CTX);
    expect(groups).toHaveLength(1);
    expect(groups[0].label).toBe('Affinity');
    expect(groups[0].members.map((m) => m.name)).toEqual(['basil', 'lemon', 'onion', 'butter', 'thyme']);
  });

  it('aroma → one group per chef-tier1 bucket, in axis order, colored', () => {
    const groups = groupByLens(ego, 'aroma', CTX);
    const labels = groups.map((g) => g.label);
    // axis order: Citrus, Fruity, Floral, Herbal, Green, Creamy, ... Pungent
    expect(labels).toEqual(['Citrus', 'Herbal', 'Green', 'Creamy', 'Pungent']);
    expect(groups.every((g) => typeof g.color === 'string' && g.color.startsWith('#'))).toBe(true);
    expect(groups.find((g) => g.label === 'Citrus').members[0].name).toBe('lemon');
  });

  it('taste → groups by taste tag, dominant bucket has the most members', () => {
    const groups = groupByLens(ego, 'taste', CTX);
    const bitter = groups.find((g) => g.label === 'Bitter');
    expect(bitter.members.map((m) => m.name).sort()).toEqual(['basil', 'thyme']);
  });

  it('cuisine → all five map to European here', () => {
    const groups = groupByLens(ego, 'cuisine', CTX);
    expect(groups).toHaveLength(1);
    expect(groups[0].label).toBe('European');
    expect(groups[0].members).toHaveLength(5);
  });

  it('season → Summer / Winter / All Year from ctx.seasonMap', () => {
    const groups = groupByLens(ego, 'season', CTX);
    const byLabel = Object.fromEntries(groups.map((g) => [g.label, g.members.map((m) => m.name)]));
    expect(byLabel.Summer.sort()).toEqual(['basil', 'thyme']);
    expect(byLabel.Winter).toEqual(['lemon']);
    expect(byLabel['All Year'].sort()).toEqual(['butter', 'onion']);
  });

  it('partners with no bucket fall into a trailing Other group', () => {
    // A partner whose node has none of the classifiable fields.
    const ego2 = [{ name: 'mystery', strength: 0.3, node: { name: 'mystery' } }];
    const groups = groupByLens(ego2, 'taste', CTX);
    expect(groups).toHaveLength(1);
    expect(groups[0].label).toBe('Other');
  });

  it('is null-safe on empty input', () => {
    expect(groupByLens([], 'aroma', CTX)).toEqual([]);
    expect(groupByLens(null, 'affinity', CTX)).toEqual([]);
  });
});

// ── lensInsight ───────────────────────────────────────────────────────
describe('lensInsight', () => {
  const ego = egoNeighborhood('garlic', DATA);

  it('affinity insight names the strongest partners', () => {
    expect(lensInsight(ego, 'affinity', CTX)).toBe('5 partners, led by basil, lemon, onion.');
  });

  it('categorical insight surfaces the dominant bucket(s)', () => {
    expect(lensInsight(ego, 'taste', CTX)).toMatch(/^5 partners — mostly Bitter/);
    expect(lensInsight(ego, 'cuisine', CTX)).toBe('5 partners — mostly European (cuisine).');
  });

  it('returns empty string for no partners', () => {
    expect(lensInsight([], 'aroma', CTX)).toBe('');
    expect(lensInsight(null, 'affinity', CTX)).toBe('');
  });

  it('reports no grouping when nothing classifies', () => {
    const ego2 = [{ name: 'mystery', strength: 0.3, node: { name: 'mystery' } }];
    expect(lensInsight(ego2, 'taste', CTX)).toBe('1 partner — no clear taste grouping.');
  });
});

// ── P3a partnerBridges ────────────────────────────────────────────────
describe('partnerBridges', () => {
  it('finds partner pairs that also pair with each other (trios)', () => {
    const ego = egoNeighborhood('garlic', DATA);
    const bridges = partnerBridges(ego, DATA);
    // EDGES has lemon-thyme, and both are garlic partners → one bridge.
    expect(bridges).toEqual([{ a: 'lemon', b: 'thyme' }]);
  });

  it('is null-safe / empty for <2 partners or no edges', () => {
    expect(partnerBridges([], DATA)).toEqual([]);
    expect(partnerBridges([{ name: 'basil', strength: 1 }], DATA)).toEqual([]);
    expect(partnerBridges(egoNeighborhood('garlic', DATA), {})).toEqual([]);
  });
});

// ── P3c sharedNeighborhood ────────────────────────────────────────────
describe('sharedNeighborhood', () => {
  it('returns ingredients pairing with BOTH, excluding the two centers', () => {
    // garlic↔thyme and lemon↔thyme both exist → thyme is shared.
    const shared = sharedNeighborhood('garlic', 'lemon', DATA);
    expect(shared.map((p) => p.name)).toEqual(['thyme']);
    expect(shared[0].strength).toBe(Math.min(0.5, 0.4)); // min of the two links
  });

  it('is null-safe and rejects identical / missing inputs', () => {
    expect(sharedNeighborhood('garlic', 'garlic', DATA)).toEqual([]);
    expect(sharedNeighborhood('garlic', '', DATA)).toEqual([]);
    expect(sharedNeighborhood('garlic', 'lemon', {})).toEqual([]);
  });
});

// ── P3d monthToSeasonLabel ────────────────────────────────────────────
describe('monthToSeasonLabel', () => {
  it('maps months to the season lens labels', () => {
    expect(monthToSeasonLabel(0)).toBe('Winter');  // Jan
    expect(monthToSeasonLabel(3)).toBe('Spring');  // Apr
    expect(monthToSeasonLabel(6)).toBe('Summer');  // Jul
    expect(monthToSeasonLabel(9)).toBe('Autumn');  // Oct
    expect(monthToSeasonLabel(11)).toBe('Winter'); // Dec
  });
  it('returns null on bad input', () => {
    expect(monthToSeasonLabel(12)).toBeNull();
    expect(monthToSeasonLabel(-1)).toBeNull();
    expect(monthToSeasonLabel(1.5)).toBeNull();
  });
});

// ── P3e serendipitousPick ─────────────────────────────────────────────
describe('serendipitousPick', () => {
  const ego = egoNeighborhood('garlic', DATA); // basil .9 .. thyme .5
  it('picks from the back half (novelty over the obvious top)', () => {
    // tail = [onion(.7), butter(.6), thyme(.5)]; rng=0 → first of tail.
    expect(serendipitousPick(ego, () => 0)).toBe('onion');
    expect(serendipitousPick(ego, () => 0.99)).toBe('thyme');
  });
  it('handles tiny / empty sets', () => {
    expect(serendipitousPick([], () => 0)).toBeNull();
    expect(serendipitousPick([{ name: 'solo', strength: 1 }], () => 0)).toBe('solo');
  });
});

// ── P4 surprisingNeighborhood ─────────────────────────────────────────
describe('surprisingNeighborhood', () => {
  it('keeps the center but returns partners from a DIFFERENT taste family', () => {
    // garlic = pungent; onion is also pungent → excluded as "not surprising".
    // limit:4 fills exactly with the 4 cross-family partners (no top-up pad).
    const surprises = surprisingNeighborhood('garlic', DATA, CTX, { limit: 4 });
    expect(surprises.map((p) => p.name)).toEqual(['basil', 'lemon', 'butter', 'thyme']);
    expect(surprises.find((p) => p.name === 'onion')).toBeUndefined();
  });

  it('tops up with same-family partners only when cross-family is too thin', () => {
    // Only 4 cross-family exist; default limit 12 → pad with onion last.
    const surprises = surprisingNeighborhood('garlic', DATA, CTX);
    expect(surprises.map((p) => p.name)).toEqual(['basil', 'lemon', 'butter', 'thyme', 'onion']);
  });

  it('respects the limit and carries provenance', () => {
    const surprises = surprisingNeighborhood('garlic', DATA, CTX, { limit: 2 });
    expect(surprises).toHaveLength(2);
    expect(surprises[0].provenance).toBe('chemistry');
  });

  it('is null-safe', () => {
    expect(surprisingNeighborhood('', DATA, CTX)).toEqual([]);
    expect(surprisingNeighborhood('garlic', {}, CTX)).toEqual([]);
  });
});
