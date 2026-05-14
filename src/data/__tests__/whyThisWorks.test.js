import { describe, it, expect, beforeEach } from 'vitest';
import { whyThisWorks, groundTruthHas, _resetCachesForTests } from '../whyThisWorks.js';

const PAIRING_COUNT = 50312;

const BRIDGE_DATA = {
  'salmon|dill': {
    bridges: [
      { name: 'limonene', tags: ['citrus', 'fresh'], rarity: 0.92 },
    ],
    summary: 'share limonene',
  },
  'tomato|basil': {
    bridges: [
      { name: 'eugenol', tags: ['clove', 'spice'], rarity: 0.88 },
    ],
    summary: 'share eugenol',
  },
};

const GROUND_TRUTH = {
  pairings: [
    {
      a: 'salmon',
      b: 'dill',
      sources: [
        { ref: 'Flavor Bible p. 281', url: 'https://example.com/fb-281' },
      ],
      axes_validated: ['cross-aroma'],
    },
  ],
};

const GNN_ENTROPY = {
  apple: { probs: { sweet: 0.6, odor_fruity: 0.3, bitter: 0.1 } },
  pear:  { probs: { sweet: 0.55, odor_fruity: 0.32, bitter: 0.13 } },
  // No data for "salmon" / "dill" → fallback path is exercised
  // separately below.
};

beforeEach(() => {
  _resetCachesForTests();
});

describe('whyThisWorks — output schema', () => {
  it('causalSentence is non-empty for every input + includes pairingCount substitution', () => {
    const pair = { ingredientA: 'salmon', ingredientB: 'dill', sharedCompounds: [] };
    const story = whyThisWorks(pair, { pairingCount: PAIRING_COUNT }, {
      bridgeCompounds: BRIDGE_DATA,
      groundTruth: GROUND_TRUTH,
    });
    expect(typeof story.causalSentence).toBe('string');
    expect(story.causalSentence.length).toBeGreaterThan(0);
    // Must include the pairing-count substitution (50,312).
    expect(story.causalSentence).toMatch(/50,312/);
  });

  it('annotativeSentence is null when no bridge OR GNN entropy match', () => {
    const pair = { ingredientA: 'unobtainium', ingredientB: 'phlogiston', sharedCompounds: [] };
    const story = whyThisWorks(pair, { pairingCount: PAIRING_COUNT }, {
      bridgeCompounds: BRIDGE_DATA,
      gnnEntropy: GNN_ENTROPY,
      groundTruth: { pairings: [] },
    });
    expect(story.annotativeSentence).toBeNull();
    expect(story.isAnnotativeCompoundUsedByRuntime).toBe(false);
  });

  it('isAnnotativeCompoundUsedByRuntime === false when bridge.compound NOT in pair.sharedCompounds', () => {
    const pair = {
      ingredientA: 'salmon',
      ingredientB: 'dill',
      sharedCompounds: [], // ← x3==0.5 reality — empty
    };
    const story = whyThisWorks(pair, { pairingCount: PAIRING_COUNT }, {
      bridgeCompounds: BRIDGE_DATA,
      groundTruth: GROUND_TRUTH,
    });
    expect(story.annotativeSentence).toMatch(/limonene/i);
    expect(story.isAnnotativeCompoundUsedByRuntime).toBe(false);
  });

  it('isAnnotativeCompoundUsedByRuntime === true when bridge.compound IS in pair.sharedCompounds', () => {
    const pair = {
      ingredientA: 'salmon',
      ingredientB: 'dill',
      sharedCompounds: ['limonene'], // matches bridge.compound
    };
    const story = whyThisWorks(pair, { pairingCount: PAIRING_COUNT }, {
      bridgeCompounds: BRIDGE_DATA,
      groundTruth: GROUND_TRUTH,
    });
    expect(story.isAnnotativeCompoundUsedByRuntime).toBe(true);
  });

  it('citationsIfAny populated when ground_truth has match', () => {
    const pair = { ingredientA: 'salmon', ingredientB: 'dill', sharedCompounds: [] };
    const story = whyThisWorks(pair, { pairingCount: PAIRING_COUNT }, {
      bridgeCompounds: BRIDGE_DATA,
      groundTruth: GROUND_TRUTH,
    });
    expect(story.citationsIfAny).toHaveLength(1);
    expect(story.citationsIfAny[0]).toMatchObject({
      ref: expect.stringContaining('Flavor Bible'),
      url: expect.stringContaining('https://'),
    });
  });

  it('citationsIfAny is empty when ground_truth has no match', () => {
    const pair = { ingredientA: 'beet', ingredientB: 'walnut', sharedCompounds: [] };
    const story = whyThisWorks(pair, { pairingCount: PAIRING_COUNT }, {
      bridgeCompounds: BRIDGE_DATA,
      groundTruth: GROUND_TRUTH,
    });
    expect(story.citationsIfAny).toEqual([]);
  });

  it('surpriseAxesMatched returns array length 0–4 (Phase 1 axes)', () => {
    const pair = {
      ingredientA: 'salmon',
      ingredientB: 'dill',
      sharedCompounds: [],
      strength: 0.85,
      breakdown: { x3: 0.5 },
    };
    const story = whyThisWorks(pair, { pairingCount: PAIRING_COUNT }, {
      bridgeCompounds: BRIDGE_DATA,
      groundTruth: GROUND_TRUTH,
      ingredientMeta: {},
      gnnEntropy: GNN_ENTROPY,
    });
    expect(Array.isArray(story.surpriseAxesMatched)).toBe(true);
    expect(story.surpriseAxesMatched.length).toBeGreaterThanOrEqual(0);
    expect(story.surpriseAxesMatched.length).toBeLessThanOrEqual(4);
    for (const a of story.surpriseAxesMatched) {
      expect(['chem-bridged-rare', 'absent-from-books', 'cross-cuisine', 'cross-aroma']).toContain(a);
    }
  });

  it('compound-foods edge case: pair where neither bridge nor GNN entropy has data → annotativeSentence === null', () => {
    const pair = { ingredientA: 'mayonnaise', ingredientB: 'ketchup', sharedCompounds: [] };
    const story = whyThisWorks(pair, { pairingCount: PAIRING_COUNT }, {
      bridgeCompounds: {},
      gnnEntropy: {},
      groundTruth: { pairings: [] },
    });
    expect(story.annotativeSentence).toBeNull();
    expect(story.isAnnotativeCompoundUsedByRuntime).toBe(false);
  });

  it('GNN-entropy fallback fires when bridge missing but both ingredients share top class', () => {
    const pair = { ingredientA: 'apple', ingredientB: 'pear', sharedCompounds: [] };
    const story = whyThisWorks(pair, { pairingCount: PAIRING_COUNT }, {
      bridgeCompounds: {},
      gnnEntropy: GNN_ENTROPY,
      groundTruth: { pairings: [] },
    });
    expect(story.annotativeSentence).toMatch(/sweet/i);
    // Class names aren't compound names → never claim runtime usage.
    expect(story.isAnnotativeCompoundUsedByRuntime).toBe(false);
  });

  it('case-insensitive bridge lookup works for either ordering', () => {
    const story1 = whyThisWorks(
      { ingredientA: 'Tomato', ingredientB: 'BASIL', sharedCompounds: [] },
      { pairingCount: PAIRING_COUNT },
      { bridgeCompounds: BRIDGE_DATA, groundTruth: { pairings: [] } },
    );
    const story2 = whyThisWorks(
      { ingredientA: 'basil', ingredientB: 'tomato', sharedCompounds: [] },
      { pairingCount: PAIRING_COUNT },
      { bridgeCompounds: BRIDGE_DATA, groundTruth: { pairings: [] } },
    );
    expect(story1.annotativeSentence).toMatch(/eugenol/i);
    expect(story2.annotativeSentence).toMatch(/eugenol/i);
  });

  it('falls back gracefully when pairingCount is missing', () => {
    const pair = { ingredientA: 'salmon', ingredientB: 'dill', sharedCompounds: [] };
    const story = whyThisWorks(pair, {}, {
      bridgeCompounds: BRIDGE_DATA,
      groundTruth: GROUND_TRUTH,
    });
    expect(story.causalSentence).toMatch(/recipe co-occurrence/);
  });
});

describe('groundTruthHas', () => {
  it('returns true for an entry that exists in injected ground_truth', () => {
    expect(groundTruthHas('salmon', 'dill', { groundTruth: GROUND_TRUTH })).toBe(true);
  });

  it('returns false for an entry not in ground_truth', () => {
    expect(groundTruthHas('beet', 'walnut', { groundTruth: GROUND_TRUTH })).toBe(false);
  });

  it('respects ordering — (b, a) finds the same entry', () => {
    expect(groundTruthHas('dill', 'salmon', { groundTruth: GROUND_TRUTH })).toBe(true);
  });
});
