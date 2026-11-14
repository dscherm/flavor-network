import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import {
  MY_BAR_KEY, loadBar, barKey, isBooze, splitBar, coverCocktail, namedBottle, GENERIC_BOTTLE_KEYS,
} from '../myBar.js';

// The real graph and roles: the averna / cassis bugs came from the real alias
// table meeting the real names, which a toy name set cannot reproduce.
const read = (p) => JSON.parse(fs.readFileSync(path.join(process.cwd(), p), 'utf8'));
const names = new Set(Object.keys(read('public/proDataset/ingredients.json')));
const roles = read('public/data/cocktail_roles.json').byIngredient;

const ing = (raw) => ({ raw });
const memStorage = (initial = {}) => {
  const m = new Map(Object.entries(initial));
  return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)) };
};

describe('named bottles are bar items with their own key', () => {
  const cases = [
    ['amaretto', 'amaretto'],
    ['Disaronno', 'amaretto'],
    ['creme de cassis', 'creme de cassis'],
    ['Crème de Cassis', 'creme de cassis'],
    ['Licor 43', 'licor 43'],
    ['Licor 43 Cuarenta y Tres', 'licor 43'],
    ['génépy', 'genepy'],
    ['Dolin Genepy des Alpes', 'genepy'],
    ['Amarula', 'amarula'],
    ['Goldwasser', 'goldwasser'],
    ['crème de violette', 'creme de violette'],
    ['limoncello', 'limoncello'],
    ['aquavit', 'aquavit'],
  ];
  for (const [typed, key] of cases) {
    it(`${typed} -> ${key}`, () => {
      const k = barKey(typed, names);
      expect(k).toBe(key);
      expect(GENERIC_BOTTLE_KEYS.has(k)).toBe(false);
      expect(isBooze(k, roles)).toBe(true);
    });
  }

  it('isBooze accepts the other kinds and brands that have no generic word', () => {
    const kinds = ['ouzo', 'pastis', 'arak', 'raki', 'soju', 'baijiu', 'eau de vie', 'calvados', 'armagnac', 'pisco', 'slivovitz', 'kirsch',
      'creme de menthe', 'creme de mure', 'creme de banane', 'creme de cacao', 'creme de peche', 'sake',
      'licor 43', 'disaronno', 'chartreuse', 'benedictine', 'drambuie', 'galliano', 'strega', 'st-germain', 'jagermeister',
      'goldwasser', 'cynar', 'averna', 'fernet', 'aperol', 'campari', 'suze', 'lillet', 'dubonnet', "pimm's", 'kahlua', 'cointreau',
      'grand marnier', 'midori', 'chambord', 'frangelico', 'sambuca', 'malibu', 'baileys', 'amarula'];
    for (const k of kinds) expect(isBooze(k, roles), k).toBe(true);
  });

  it('keeps the protections: cherries, juice, syrup and friends are still not booze', () => {
    for (const k of ['cherry', 'cherry juice', 'lemon juice', 'simple syrup', 'orange peel', 'egg white', 'ginger beer', 'tonic water', 'apple cider vinegar', 'cream', 'coconut cream'])
      expect(isBooze(k, roles), k).toBe(false);
    expect(isBooze('cherry liqueur', roles)).toBe(true);
    expect(isBooze('cherry brandy', roles)).toBe(true);
  });
});

describe('a named amaro or liqueur never becomes a different brand', () => {
  it('averna and jagermeister are not amaro montenegro', () => {
    expect(barKey('averna', names)).not.toBe('amaro montenegro');
    expect(barKey('jagermeister', names)).not.toBe('amaro montenegro');
    expect(barKey('Jägermeister', names)).toBe('jagermeister');
    expect(barKey('Averna Amaro Siciliano', names)).toBe('averna');
    expect(barKey('amaro nonino', names)).toBe('amaro nonino');
  });
  it('a plain "amaro" and Montenegro itself are unchanged', () => {
    expect(barKey('amaro', names)).toBe('amaro montenegro');
    expect(barKey('Amaro Montenegro', names)).toBe('amaro montenegro');
  });
  it('a generic answer keeps the bottle\'s own name', () => {
    expect(barKey('herbal liqueur', names)).toBe('herbal liqueur');
    expect(barKey('coffee liqueur', names)).toBe('coffee liqueur');
    expect(namedBottle('Licor 43 Cuarenta y Tres')).toBe('licor 43');
    expect(namedBottle('Maker\'s Mark')).toBe('');
  });
  it('sloe gin, irish cream and the creme de menthe schnapps resolution are unchanged', () => {
    expect(barKey('sloe gin', names)).toBe('sloe gin');
    expect(barKey('irish cream', names)).toBe('irish cream');
    expect(barKey('creme de menthe', names)).toBe('peppermint schnapp');
    expect(barKey('green chartreuse', names)).toBe('green chartreuse');
    expect(barKey('st-germain', names)).toBe('elderflower cordial');
    expect(barKey('calvados', names)).toBe('apple brandy');
  });
});

describe('a bar saved before this change', () => {
  it('still loads, and booze entries stay on the shelf when it is split', () => {
    const saved = ['bourbon', 'campari', 'amaro montenegro', 'sweet vermouth', 'angostura bitters', 'blackcurrant', 'lemon juice'];
    const bar = loadBar(memStorage({ [MY_BAR_KEY]: JSON.stringify(saved) }));
    expect(bar).toEqual(saved);
    const { bar: keep, moved } = splitBar(bar, roles);
    expect(keep).toEqual(['bourbon', 'campari', 'amaro montenegro', 'sweet vermouth', 'angostura bitters']);
    expect(moved).toEqual(['blackcurrant', 'lemon juice']);
  });

  const cover = (lines, bar) => coverCocktail({ name: 't', ingredients_raw: lines.map(ing) }, bar, { roles, names });

  it('covers what it covered: bourbon for a whiskey line, any bitters for "bitters", campari for campari', () => {
    const whiskey = cover(['2 oz Whiskey', '1 oz Sweet vermouth'], ['bourbon', 'sweet vermouth']);
    expect(whiskey.missing).toEqual([]);
    expect(whiskey.substitutions).toEqual([{ from: 'whiskey', to: 'bourbon' }]);
    const bitters = cover(['2 oz Gin', '2 dashes Bitters'], ['gin', 'angostura bitters']);
    expect(bitters.missing).toEqual([]);
    expect(cover(['1 oz Campari', '1 oz Gin'], ['campari', 'gin']).missing).toEqual([]);
  });

  it('an old amaro montenegro entry still covers a recipe line that says amaro', () => {
    const c = cover(['1 oz Amaro', '2 oz Bourbon'], ['amaro montenegro', 'bourbon']);
    expect(c.missing).toEqual([]);
  });

  it('a named bottle covers its own recipe line', () => {
    expect(cover(['1 oz Amaretto', '1 oz Bourbon'], ['amaretto', 'bourbon']).missing).toEqual([]);
    expect(cover(['1/2 oz Creme de cassis', '2 oz Gin'], ['creme de cassis', 'gin']).missing).toEqual([]);
  });
});
