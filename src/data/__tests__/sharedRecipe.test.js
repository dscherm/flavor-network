import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { SEED_RECIPES } from '../seedRecipes.js';
import { RECIPE_DETAILS } from '../seedRecipeDetails.js';
import {
  parseSharePath, slugify, slugFor, shareLinkFor, resolveBuiltIn, uniqueBySlug, SHARE_KINDS,
} from '../sharedRecipe.js';

const codex = JSON.parse(readFileSync('public/data/cocktail_codex_v2.json', 'utf8'));
const sauceRaw = JSON.parse(readFileSync('public/data/sauce_augment.json', 'utf8'));
const DATA = {
  cocktails: codex.cocktails, families: codex.families, sauces: sauceRaw.sauces,
  dishes: SEED_RECIPES, dishDetails: RECIPE_DETAILS,
};
const LISTS = { cocktail: DATA.cocktails, sauce: DATA.sauces, dish: DATA.dishes };

describe('parseSharePath', () => {
  it('reads /r/<kind>/<slug>', () => {
    expect(parseSharePath('/r/cocktail/negroni')).toEqual({ kind: 'cocktail', slug: 'negroni' });
    expect(parseSharePath('/r/dish/beef-bolognese/')).toEqual({ kind: 'dish', slug: 'beef-bolognese' });
  });
  it('reads /r/<id> as an id', () => {
    expect(parseSharePath('/r/a1b2c3d4e5')).toEqual({ id: 'a1b2c3d4e5' });
  });
  it('decodes and lowercases the slug', () => {
    expect(parseSharePath('/r/Sauce/Beurre%20Blanc')).toEqual({ kind: 'sauce', slug: 'beurre blanc' });
    expect(parseSharePath('/r/cocktail/%E0%A4%A')).toEqual({ kind: 'cocktail', slug: '%e0%a4%a' });
  });
  it('keeps an unknown kind so the page can say it is gone', () => {
    expect(parseSharePath('/r/wine/merlot')).toEqual({ kind: 'wine', slug: 'merlot' });
    expect(parseSharePath('/r/a/b/c/d')).toEqual({ id: 'a/b/c/d' });
  });
  it('returns null when it is not a share path', () => {
    for (const p of ['/', '', '/r', '/r/', '/rx/cocktail/negroni', '/recipes/x', null, undefined, 5]) {
      expect(parseSharePath(p)).toBeNull();
    }
  });
  it('ignores a query or hash left on the path', () => {
    expect(parseSharePath('/r/cocktail/negroni?x=1#y')).toEqual({ kind: 'cocktail', slug: 'negroni' });
  });
});

describe('slugs', () => {
  it('handles accents, apostrophes, ampersands and punctuation', () => {
    expect(slugify("Piña Colada's #2")).toBe('pina-coladas-2');
    expect(slugify('Béarnaise')).toBe('bearnaise');
    expect(slugify('Mac & Cheese')).toBe('mac-and-cheese');
    expect(slugify("  Rock ’n’ Roll!  ")).toBe('rock-n-roll');
    expect(slugify('')).toBe('');
  });
  it('slugFor and shareLinkFor are stable and URL-safe', () => {
    const neg = DATA.cocktails.find((c) => c.canonical === 'negroni');
    expect(slugFor('cocktail', neg)).toBe('negroni');
    expect(shareLinkFor('cocktail', neg)).toBe('/r/cocktail/negroni');
    expect(shareLinkFor('sauce', { name: 'Sauce Béarnaise' })).toBe('/r/sauce/sauce-bearnaise');
    expect(shareLinkFor('dish', { id: 'beef-bolognese', name: 'x' })).toBe('/r/dish/beef-bolognese');
  });
  it('gives nothing for an unknown kind or an empty item', () => {
    expect(slugFor('wine', { name: 'Merlot' })).toBe('');
    expect(shareLinkFor('cocktail', null)).toBe('');
    expect(shareLinkFor('cocktail', {})).toBe('');
  });
  for (const kind of SHARE_KINDS) {
    it(`every built-in ${kind} has a URL-safe slug and no two share one`, () => {
      const list = LISTS[kind];
      const slugs = list.map((it) => slugFor(kind, it));
      for (const s of slugs) expect(s).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
      // The codex lists two cocktails twice (identical rows): those are one recipe.
      const distinctNames = new Set(list.map((it) => (kind === 'dish' ? it.id : kind === 'cocktail' ? it.canonical : it.name)));
      expect(new Set(slugs).size).toBe(distinctNames.size);
      expect(uniqueBySlug(kind, list)).toHaveLength(distinctNames.size);
    });
  }
});

describe('resolveBuiltIn', () => {
  it('returns null for an unknown kind, an unknown slug and empty input', () => {
    expect(resolveBuiltIn('wine', 'merlot', DATA)).toBeNull();
    expect(resolveBuiltIn('cocktail', 'no-such-drink', DATA)).toBeNull();
    expect(resolveBuiltIn('cocktail', '', DATA)).toBeNull();
    expect(resolveBuiltIn('cocktail', 'negroni', null)).toBeNull();
    expect(resolveBuiltIn('sauce', 'x', {})).toBeNull();
  });
  it('resolves a cocktail with amounts, glass, method and family', () => {
    const r = resolveBuiltIn('cocktail', 'daiquiri', DATA);
    expect(r.kind).toBe('cocktail');
    expect(r.name).toBe('Daiquiri');
    expect(r.lines.map((l) => l.amount)).toEqual(['2 oz', '0.75 oz', '0.5 oz']);
    expect(r.lines[0].key).toBe('white rum');
    expect(r.glass).toBe('Cocktail glass');
    expect(r.method).toMatch(/shake/i);
    expect(r.category).toBeTruthy();
  });
  it('suggests an amount, flagged, when the source gives none', () => {
    const r = resolveBuiltIn('cocktail', 'negroni', DATA);
    expect(r.lines.every((l) => l.amount)).toBe(true);
    expect(r.lines.some((l) => l.suggested)).toBe(true);
    expect(r.garnish).toMatch(/orange/);
  });
  it('resolves by slug regardless of case and for a repeated codex row', () => {
    expect(resolveBuiltIn('cocktail', 'PINA-COLADA', DATA).name).toMatch(/Pina Colada/);
    expect(resolveBuiltIn('cocktail', 'corpse-reviver-2', DATA).lines.length).toBeGreaterThan(2);
  });
  it('keeps the two Old Fashioned recipes apart', () => {
    expect(resolveBuiltIn('cocktail', 'old-fashioned', DATA).lines.some((l) => /cube/.test(l.key + l.amount))).toBe(true);
    expect(resolveBuiltIn('cocktail', 'old-fashioned-2', DATA).name).toBe('Old-Fashioned');
  });
  it('resolves a sauce and a dish with amounts and steps', () => {
    const s = resolveBuiltIn('sauce', 'alfredo', DATA);
    expect(s.lines[0]).toEqual({ key: 'butter', amount: '4 tbsp' });
    expect(s.method).toMatch(/Melt butter/);
    expect(s.glass).toBeNull();
    const d = resolveBuiltIn('dish', 'beef-bolognese', DATA);
    expect(d.lines.find((l) => l.key === 'beef').amount).toBe('500 g minced');
    expect(d.method.split('\n')).toHaveLength(5);
    expect(d.meta).toMatch(/Serves 4/);
  });
  it('resolves every built-in item to a recipe with a name and lines', () => {
    for (const kind of SHARE_KINDS) {
      for (const it of uniqueBySlug(kind, LISTS[kind])) {
        const r = resolveBuiltIn(kind, slugFor(kind, it), DATA);
        expect(r, `${kind} ${slugFor(kind, it)}`).not.toBeNull();
        expect(r.name).toBeTruthy();
        expect(r.slug).toBe(slugFor(kind, it));
        expect(r.lines.length).toBeGreaterThan(0);
        for (const l of r.lines) expect(typeof l.key).toBe('string');
      }
    }
  });
});
