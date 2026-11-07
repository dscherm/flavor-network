import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import {
  MY_BAR_KEY, loadBar, saveBar, barKey, addToBar, removeFromBar, coverCocktail, whatCanIMake,
  substitutionText, commonBarIngredients, countedLines,
} from '../myBar.js';

const ing = (raw) => ({ raw });
const roles = {
  gin: { role: 'spirit' }, vodka: { role: 'spirit' }, bourbon: { role: 'spirit' }, rye: { role: 'spirit' },
  whiskey: { role: 'spirit' }, rum: { role: 'spirit' }, tequila: { role: 'spirit' }, mezcal: { role: 'spirit' },
  'lemon juice': { role: 'sour' }, 'lime juice': { role: 'sour' }, lemon: { role: 'sour' },
  'simple syrup': { role: 'sweet' }, 'honey syrup': { role: 'sweet' },
  'sweet vermouth': { role: 'vermouth' }, 'dry vermouth': { role: 'vermouth' },
  campari: { role: 'amaro_liqueur' }, 'triple sec': { role: 'amaro_liqueur' }, 'sparkling wine': { role: 'amaro_liqueur' },
  'soda water': { role: 'modifier' }, 'tonic water': { role: 'modifier' }, 'egg white': { role: 'modifier' },
  'angostura bitters': { role: 'bitter' }, bitters: { role: 'bitter' }, 'lemon peel': { role: 'aromatic' },
};
const names = new Set(Object.keys(roles));

const negroni = { name: 'Negroni', ingredients_raw: [ing('1 oz Gin'), ing('1 oz Sweet vermouth'), ing('1 oz Campari'), ing('Orange peel')] };
const whiskeySour = { name: 'Whiskey Sour', ingredients_raw: [ing('2 oz Bourbon'), ing('3/4 oz Lemon juice'), ing('3/4 oz Simple syrup'), ing('Egg white')] };
const oldPal = { name: 'Bourbon Highball', ingredients_raw: [ing('2 oz Bourbon'), ing('Soda water'), ing('Ice')] };
const martini = { name: 'Martini', ingredients_raw: [ing('2 1/2 oz Gin'), ing('1/2 oz Dry vermouth'), ing('Garnish: olive')] };
const vodkaMartini = { name: 'Vodka Martini', ingredients_raw: [ing('2 1/2 oz Vodka'), ing('1/2 oz Dry vermouth')] };
const gimlet = { name: 'Gimlet', ingredients_raw: [ing('2 oz Gin'), ing('3/4 oz Lime juice'), ing('3/4 oz Simple syrup')] };
const french75 = { name: 'French 75', ingredients_raw: [ing('1 oz Gin'), ing('1/2 oz Lemon juice'), ing('1/2 oz Simple syrup'), ing('Sparkling wine')] };
const gt = { name: 'Gin and Tonic', ingredients_raw: [ing('2 oz Gin'), ing('Tonic water')] };

function memStorage(initial = {}) {
  const m = new Map(Object.entries(initial));
  return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), _m: m };
}

describe('bar storage', () => {
  it('round-trips through the fn-my-bar key', () => {
    const s = memStorage();
    expect(saveBar(['gin', 'campari'], s)).toBe(true);
    expect(s._m.get(MY_BAR_KEY)).toBe('["gin","campari"]');
    expect(loadBar(s)).toEqual(['gin', 'campari']);
  });
  it('never throws: missing, malformed and throwing storage give an empty bar', () => {
    expect(loadBar(null)).toEqual([]);
    expect(loadBar(memStorage({ [MY_BAR_KEY]: '{not json' }))).toEqual([]);
    expect(loadBar(memStorage({ [MY_BAR_KEY]: '{"a":1}' }))).toEqual([]);
    const throwing = { getItem: () => { throw new Error('denied'); }, setItem: () => { throw new Error('denied'); } };
    expect(loadBar(throwing)).toEqual([]);
    expect(saveBar(['gin'], throwing)).toBe(false);
  });
});

describe('bar keys', () => {
  it('resolves free text to graph names and dedupes', () => {
    expect(barKey('2 oz Fresh Lemon Juice', names)).toBe('lemon juice');
    let bar = addToBar([], 'Gin', names);
    bar = addToBar(bar, 'gin', names);
    expect(bar).toEqual(['gin']);
    expect(removeFromBar(['gin', 'rum'], 'gin')).toEqual(['rum']);
  });
  it('keeps "sloe gin" apart from gin', () => {
    expect(barKey('Sloe gin', names)).toBe('sloe gin');
  });
  it('skips trivial and garnish lines', () => {
    expect(countedLines(negroni, roles, names).map((l) => l.key)).toEqual(['gin', 'sweet vermouth', 'campari']);
    expect(countedLines(oldPal, roles, names).map((l) => l.key)).toEqual(['bourbon']);
  });
});

describe('coverage', () => {
  it('exact: a Negroni bar makes a Negroni', () => {
    const c = coverCocktail(negroni, ['gin', 'sweet vermouth', 'campari'], { roles, names });
    expect(c.missing).toEqual([]);
    expect(c.substitutions).toEqual([]);
  });

  it('one away: names the missing line and suggests a same-role, same-kind bar item', () => {
    const c = coverCocktail(gimlet, ['gin', 'lemon juice', 'simple syrup'], { roles, names });
    expect(c.missing.map((m) => m.key)).toEqual(['lime juice']);
    expect(c.suggestion?.use).toBe('lemon juice');
  });

  it('no suggestion across kinds: Campari never stands in for sparkling wine', () => {
    const c = coverCocktail(french75, ['gin', 'lemon juice', 'simple syrup', 'campari'], { roles, names });
    expect(c.missing.map((m) => m.key)).toEqual(['sparkling wine']);
    expect(c.suggestion).toBeNull();
  });

  it('family substitution: rye covers bourbon and says so', () => {
    const c = coverCocktail(whiskeySour, ['rye', 'lemon juice', 'simple syrup', 'egg white'], { roles, names });
    expect(c.missing).toEqual([]);
    expect(c.substitutions).toEqual([{ from: 'bourbon', to: 'rye' }]);
    expect(substitutionText(c.substitutions)).toBe('with rye instead of bourbon');
  });

  it('no family substitution across families: vodka never covers gin', () => {
    const c = coverCocktail(martini, ['vodka', 'dry vermouth'], { roles, names });
    expect(c.missing.map((m) => m.key)).toEqual(['gin']);
    expect(c.substitutions).toEqual([]);
  });

  it('plain-language equivalents: a recipe "lemon" is covered by lemon juice', () => {
    const c = coverCocktail({ name: 'X', ingredients_raw: [ing('Gin'), ing('Juice of 1/2 lemon')] }, ['gin', 'lemon juice'], { roles, names });
    expect(c.missing).toEqual([]);
  });

  it('whatCanIMake ranks exact before substituted, and lists one-away drinks', () => {
    const all = [negroni, whiskeySour, oldPal, martini, vodkaMartini, gimlet, gt];
    const bar = ['gin', 'sweet vermouth', 'campari', 'dry vermouth', 'rye', 'lemon juice', 'simple syrup'];
    const { make, oneAway } = whatCanIMake(all, bar, { roles, names });
    const makeNames = make.map((m) => m.cocktail.name);
    expect(makeNames).toEqual(expect.arrayContaining(['Negroni', 'Martini', 'Bourbon Highball']));
    expect(makeNames).not.toContain('Vodka Martini');
    expect(makeNames.indexOf('Bourbon Highball')).toBeGreaterThan(makeNames.indexOf('Negroni'));
    const away = Object.fromEntries(oneAway.map((m) => [m.cocktail.name, m.missing[0].key]));
    expect(away['Whiskey Sour']).toBe('egg white');
    expect(away.Gimlet).toBe('lime juice');
    expect(away['Gin and Tonic']).toBe('tonic water');
    expect(away['Vodka Martini']).toBe('vodka');
  });

  it('an empty bar makes nothing', () => {
    expect(whatCanIMake([negroni], [], { roles, names })).toEqual({ make: [], oneAway: [] });
  });
});

describe('real codex', () => {
  const root = process.cwd();
  const read = (p) => JSON.parse(fs.readFileSync(path.join(root, p), 'utf8'));
  const realRoles = read('public/data/cocktail_roles.json').byIngredient;
  const realNames = new Set(Object.keys(read('public/proDataset/ingredients.json')));
  const codex = read('public/data/cocktail_codex_v2.json').cocktails;

  it('the brief\'s bar (gin, campari, sweet vermouth, lemon, syrup, soda) makes a Negroni and an Americano', () => {
    let bar = [];
    for (const x of ['gin', 'campari', 'sweet vermouth', 'lemon juice', 'simple syrup', 'soda water']) bar = addToBar(bar, x, realNames);
    const { make, oneAway } = whatCanIMake(codex, bar, { roles: realRoles, names: realNames });
    const makeNames = make.map((m) => m.cocktail.name);
    expect(makeNames).toEqual(expect.arrayContaining(['Negroni', 'Americano']));
    // A Boulevardier is one bourbon away; vodka drinks never count as covered by gin.
    expect(oneAway.find((m) => m.cocktail.name === 'Boulevardier')?.missing[0].key).toBe('bourbon');
    expect(makeNames.some((n) => /vodka/i.test(n))).toBe(false);
  });

  it('quick-add chips are the 20 most common cocktail ingredients', () => {
    const top = commonBarIngredients(codex, realRoles, realNames, 20);
    expect(top).toHaveLength(20);
    expect(top.slice(0, 3)).toEqual(expect.arrayContaining(['gin', 'rum']));
    expect(top).not.toContain('water');
  });
});
