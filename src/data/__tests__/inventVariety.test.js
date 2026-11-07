import { describe, it, expect } from 'vitest';
import {
  jaccard, ideaKey, nextIdeas, mmrOrder, dropThinSubsets, assignUniqueNames,
  EXHAUSTED_RECIPE, EXHAUSTED_SAUCE, MMR_LAMBDA,
} from '../inventVariety.js';

const keysOf = (x) => x.keys;
const idea = (keys, score) => ({ keys, score });

describe('jaccard / ideaKey', () => {
  it('measures ingredient overlap', () => {
    expect(jaccard(['a', 'b'], ['a', 'b'])).toBe(1);
    expect(jaccard(['a', 'b'], ['c'])).toBe(0);
    expect(jaccard(['a', 'b', 'c'], ['a', 'b', 'd'])).toBeCloseTo(0.5);
    expect(jaccard([], [])).toBe(0);
  });
  it('identifies an idea by its ingredients, in any order', () => {
    expect(ideaKey(['b', 'a'])).toBe(ideaKey(['a', 'b']));
  });
});

describe('nextIdeas (maximal marginal relevance)', () => {
  // Two near-copies of the best dish, and a different dish scoring a little lower.
  const pool = [
    idea(['chicken', 'lemon', 'garlic', 'rice'], 1.0),
    idea(['chicken', 'lemon', 'garlic', 'rice', 'basil'], 0.98),
    idea(['beef', 'potato', 'carrot', 'thyme'], 0.9),
    idea(['chicken', 'tomato', 'onion', 'rice'], 0.5),
  ];

  it('starts with the best idea', () => {
    expect(nextIdeas(pool, [], 1, { keysOf })[0]).toBe(pool[0]);
  });

  it('prefers a different dish over a near-copy of one already shown', () => {
    const second = nextIdeas(pool, [pool[0]], 1, { keysOf })[0];
    expect(second).toBe(pool[2]);
    // Without the overlap penalty (lambda 1) the near-copy would come next.
    expect(nextIdeas(pool, [pool[0]], 1, { keysOf, lambda: 1 })[0]).toBe(pool[1]);
    expect(MMR_LAMBDA).toBeLessThan(1);
  });

  it('never shows an idea twice, and returns [] once the pool is exhausted', () => {
    const shown = [];
    for (let i = 0; i < 10; i++) {
      const next = nextIdeas(pool, shown, 3, { keysOf });
      if (next.length === 0) break;
      shown.push(...next);
    }
    expect(shown).toHaveLength(pool.length);
    expect(new Set(shown.map((x) => ideaKey(x.keys))).size).toBe(pool.length);
    expect(nextIdeas(pool, shown, 3, { keysOf })).toEqual([]);
  });

  it('page after page is the same order as the whole session order', () => {
    const order = mmrOrder(pool, { keysOf });
    const paged = [...nextIdeas(pool, [], 2, { keysOf })];
    paged.push(...nextIdeas(pool, paged, 2, { keysOf }));
    expect(paged).toEqual(order);
  });

  it('treats two candidates with the same ingredients as one idea', () => {
    const dup = [idea(['a', 'b'], 1), idea(['b', 'a'], 0.9), idea(['c', 'd'], 0.5)];
    expect(mmrOrder(dup, { keysOf })).toHaveLength(2);
  });

  it('is safe on an empty pool', () => {
    expect(nextIdeas([], [], 3, { keysOf })).toEqual([]);
    expect(nextIdeas(null, [], 3, { keysOf })).toEqual([]);
  });
});

describe('dropThinSubsets / assignUniqueNames', () => {
  it('drops a thin idea that is a better idea with things left out', () => {
    const ideas = [idea(['tomato', 'garlic', 'shallot', 'lemon', 'chili'], 1), idea(['tomato', 'garlic'], 0.9), idea(['mango', 'onion'], 0.8)];
    expect(dropThinSubsets(ideas, { keysOf, minSize: 5 }).map((x) => x.keys.join())).toEqual(['tomato,garlic,shallot,lemon,chili', 'mango,onion']);
    // An idea already of a good size stays, even inside a bigger one.
    expect(dropThinSubsets(ideas, { keysOf, minSize: 2 })).toHaveLength(3);
  });

  it('gives each idea its first free name and drops one with none left', () => {
    const named = assignUniqueNames([{ n: ['A', 'B'] }, { n: ['A', 'C'] }, { n: ['A'] }], (x) => x.n);
    expect(named.map((x) => x.name)).toEqual(['A', 'C']);
  });
});

describe('exhausted messages', () => {
  it('say the space is done and how to get more', () => {
    expect(EXHAUSTED_RECIPE).toBe("That's every idea for this kitchen; add an ingredient for more.");
    expect(EXHAUSTED_SAUCE).toMatch(/every idea for this pantry; add an ingredient for more/);
  });
});
