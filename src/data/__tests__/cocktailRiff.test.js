import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { buildPairingIndex } from '../recipePairingMatch.js';
import { riffRows, buildRolePool, swapCandidates, applySwap, nearestCocktails, familyKey } from '../cocktailRiff.js';

const root = process.cwd();
const read = (p) => JSON.parse(fs.readFileSync(path.join(root, p), 'utf8'));
const ingredients = read('public/proDataset/ingredients.json');
const roles = read('public/data/cocktail_roles.json').byIngredient;
const cocktails = read('public/data/cocktail_codex_v2.json').cocktails;
const edges = read('public/proDataset/pairings.json')
  .filter((p) => p.ingredientA in ingredients && p.ingredientB in ingredients)
  .map((p) => ({ source: p.ingredientA, target: p.ingredientB, strength: p.strength, cooccurrence: p.tradition, known: p.known === true }));
const index = buildPairingIndex(edges, Object.keys(ingredients));
const pool = buildRolePool(roles, index.names);
const byName = (n) => cocktails.find((c) => c.name === n);

describe('riffRows', () => {
  it('reads each line of a Negroni with its role', () => {
    const rows = riffRows(byName('Negroni'), roles, index.names);
    expect(rows.map((r) => [r.key, r.role])).toEqual([
      ['gin', 'spirit'], ['sweet vermouth', 'vermouth'], ['campari', 'amaro_liqueur'],
    ]);
    expect(rows.every((r) => r.swappable)).toBe(true);
  });
  it('water stays fixed; sugar is swappable', () => {
    const rows = riffRows(byName('Old Fashioned'), roles, index.names);
    expect(rows.find((r) => /water/i.test(r.name)).swappable).toBe(false);
    expect(rows.find((r) => r.key === 'sugar').swappable).toBe(true);
  });
});

describe('buildRolePool', () => {
  it('keeps garnishes out of liqueurs and whole fruit out of sweeteners', () => {
    expect(pool.get('amaro_liqueur').has('maraschino cherry')).toBe(false);
    for (const name of pool.get('sweet').keys()) expect(name).toMatch(/syrup|sugar|honey|agave|grenadine|orgeat|falernum|cordial|molasses|nectar|maple|liqueur/);
  });
});

describe('swapCandidates', () => {
  it('only offers same-role swaps not already in the drink', () => {
    const rows = riffRows(byName('Negroni'), roles, index.names);
    const spirits = swapCandidates(rows, 0, pool, index, 6);
    expect(spirits.length).toBeGreaterThan(2);
    for (const c of spirits) {
      expect(pool.get('spirit').has(c.name)).toBe(true);
      expect(c.name).not.toBe('gin');
      expect(c.reason).toBeTruthy();
    }
  });
  it('nothing for a fixed line', () => {
    const rows = riffRows(byName('Old Fashioned'), roles, index.names);
    const water = rows.findIndex((r) => /water/i.test(r.name));
    expect(swapCandidates(rows, water, pool, index)).toEqual([]);
  });
});

describe('nearestCocktails', () => {
  it('a whiskey Negroni is a Boulevardier', () => {
    const rows = applySwap(riffRows(byName('Negroni'), roles, index.names), 0, 'whiskey');
    const [first] = nearestCocktails(rows, cocktails, index.names, { exclude: 'Negroni' });
    expect(first.cocktail.name).toBe('Boulevardier');
    expect(first.similarity).toBeGreaterThanOrEqual(0.9);
  });
  it('a tequila Daiquiri is a Margarita', () => {
    const rows = applySwap(riffRows(byName('Daiquiri'), roles, index.names), 0, 'tequila');
    const [first] = nearestCocktails(rows, cocktails, index.names, { exclude: 'Daiquiri' });
    expect(first.cocktail.name).toMatch(/Margarita/);
  });
  it('records what a swapped line replaced', () => {
    const rows = applySwap(riffRows(byName('Negroni'), roles, index.names), 0, 'whiskey');
    expect(rows[0]).toEqual(expect.objectContaining({ name: 'whiskey', key: 'whiskey', swappedFrom: 'Gin' }));
  });
});

describe('familyKey', () => {
  it('groups spirits by family', () => {
    expect(familyKey('bourbon')).toBe('whiskey');
    expect(familyKey('rye')).toBe('whiskey');
    expect(familyKey('mezcal')).toBe('agave spirit');
    expect(familyKey('campari')).toBe('campari');
  });
});
