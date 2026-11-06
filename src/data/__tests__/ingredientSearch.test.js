import { describe, it, expect } from 'vitest';
import {
  normalizeText, parseQuery, termMatchesIngredient, matchItem,
  cocktailIngredientNames, buildIngredientVocab,
} from '../ingredientSearch.js';

describe('normalizeText', () => {
  it('strips accents, case and punctuation', () => {
    expect(normalizeText('Bénédictine')).toBe('benedictine');
    expect(normalizeText('Peychaud’s  Bitters!')).toBe('peychauds bitters');
  });
});

describe('parseQuery', () => {
  it('splits on commas and plus signs', () => {
    expect(parseQuery('Gin, lime + Mint')).toEqual(['gin', 'lime', 'mint']);
  });
  it('returns [] for blank input', () => {
    expect(parseQuery('  ')).toEqual([]);
    expect(parseQuery(undefined)).toEqual([]);
  });
});

describe('termMatchesIngredient', () => {
  it('matches whole words', () => {
    expect(termMatchesIngredient('gin', 'London dry gin')).toBe(true);
    expect(termMatchesIngredient('lime', 'Fresh lime juice')).toBe(true);
  });
  it('does not let a short term match inside a longer word', () => {
    expect(termMatchesIngredient('gin', 'Ginger beer')).toBe(false);
    expect(termMatchesIngredient('rum', 'Drambuie')).toBe(false);
  });
  it('lets 4+ letter terms match a word prefix', () => {
    expect(termMatchesIngredient('ging', 'Ginger beer')).toBe(true);
  });
  it('handles plurals both ways', () => {
    expect(termMatchesIngredient('lime', 'limes')).toBe(true);
    expect(termMatchesIngredient('tomatoes', 'tomato')).toBe(true);
    expect(termMatchesIngredient('berry', 'raspberries')).toBe(false);
    expect(termMatchesIngredient('raspberry', 'raspberries')).toBe(true);
  });
  it('matches multi-word terms as a phrase', () => {
    expect(termMatchesIngredient('egg white', '1 egg white')).toBe(true);
    expect(termMatchesIngredient('egg white', 'white egg')).toBe(false);
  });
  it('matches accented ingredients from plain queries', () => {
    expect(termMatchesIngredient('benedictine', 'Bénédictine')).toBe(true);
  });
});

describe('matchItem', () => {
  const negroni = { name: 'Negroni', ingredients: ['Gin', 'Campari', 'Sweet vermouth'] };

  it('matches everything on an empty query', () => {
    expect(matchItem(negroni, [])).toEqual({ match: true, hits: [] });
  });
  it('requires every term to hit (AND)', () => {
    expect(matchItem(negroni, ['gin', 'campari']).match).toBe(true);
    expect(matchItem(negroni, ['gin', 'lime']).match).toBe(false);
  });
  it('reports the ingredients that matched', () => {
    expect(matchItem(negroni, ['vermouth']).hits).toEqual(['Sweet vermouth']);
  });
  it('still matches by name', () => {
    const r = matchItem(negroni, ['negr']);
    expect(r.match).toBe(true);
    expect(r.hits).toEqual([]);
  });
});

describe('cocktailIngredientNames', () => {
  it('reads raw strings off ingredients_raw', () => {
    expect(cocktailIngredientNames({ ingredients_raw: [{ raw: 'Gin' }, { raw: '' }, 'Lime'] }))
      .toEqual(['Gin', 'Lime']);
    expect(cocktailIngredientNames({})).toEqual([]);
  });
});

describe('buildIngredientVocab', () => {
  it('dedupes case/accents, drops long phrases, sorts', () => {
    const vocab = buildIngredientVocab([
      ['Lime juice', 'gin'],
      ['LIME JUICE', 'Two dashes of something very long here'],
    ]);
    expect(vocab).toEqual(['gin', 'lime juice']);
  });
});
