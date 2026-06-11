import { describe, it, expect } from 'vitest';
import { deriveBowlCuisine } from './deriveBowlCuisine.js';

const CUISINE_VOCAB = ['Global', 'Italian', 'French', 'Mexican', 'Japanese', 'Thai'];

function nodesFrom(map) {
  return new Map(Object.entries(map));
}

describe('deriveBowlCuisine', () => {
  it('picks the dominant cuisine, stripping the " cuisine" suffix', () => {
    const nodes = nodesFrom({
      basil: { cuisines: ['italian cuisine'] },
      tomato: { cuisines: ['italian cuisine', 'french cuisine'] },
      garlic: { cuisines: ['italian cuisine'] },
    });
    const bowl = [{ ingredient: 'basil' }, { ingredient: 'tomato' }, { ingredient: 'garlic' }];
    expect(deriveBowlCuisine(bowl, nodes, CUISINE_VOCAB)).toBe('Italian'); // 3 italian > 1 french
  });

  it('matches case-insensitively and returns the canonical vocab casing', () => {
    const nodes = nodesFrom({ soy: { cuisines: ['JAPANESE cuisine'] } });
    expect(deriveBowlCuisine([{ ingredient: 'soy' }], nodes, CUISINE_VOCAB)).toBe('Japanese');
  });

  it('ignores cuisines not in the model vocab', () => {
    const nodes = nodesFrom({
      brisket: { cuisines: ['tex-mex cuisine'] }, // not in vocab
      lime: { cuisines: ['mexican cuisine'] },
    });
    const bowl = [{ ingredient: 'brisket' }, { ingredient: 'lime' }];
    expect(deriveBowlCuisine(bowl, nodes, CUISINE_VOCAB)).toBe('Mexican');
  });

  it('returns null when no bowl cuisine matches the vocab', () => {
    const nodes = nodesFrom({ x: { cuisines: ['martian cuisine'] } });
    expect(deriveBowlCuisine([{ ingredient: 'x' }], nodes, CUISINE_VOCAB)).toBeNull();
  });

  it('accepts string[] bowls as well as BowlEntry[]', () => {
    const nodes = nodesFrom({ miso: { cuisines: ['japanese cuisine'] } });
    expect(deriveBowlCuisine(['miso'], nodes, CUISINE_VOCAB)).toBe('Japanese');
  });

  it('is null-safe for empty bowl / missing nodes / empty vocab', () => {
    const nodes = nodesFrom({ a: { cuisines: ['italian cuisine'] } });
    expect(deriveBowlCuisine([], nodes, CUISINE_VOCAB)).toBeNull();
    expect(deriveBowlCuisine([{ ingredient: 'a' }], null, CUISINE_VOCAB)).toBeNull();
    expect(deriveBowlCuisine([{ ingredient: 'a' }], nodes, [])).toBeNull();
  });

  it('breaks ties deterministically by vocab order', () => {
    const nodes = nodesFrom({
      a: { cuisines: ['french cuisine'] },
      b: { cuisines: ['italian cuisine'] },
    });
    // 1 french, 1 italian → Italian appears earlier in vocab → wins.
    expect(deriveBowlCuisine([{ ingredient: 'a' }, { ingredient: 'b' }], nodes, CUISINE_VOCAB)).toBe('Italian');
  });
});
