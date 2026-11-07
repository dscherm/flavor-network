import { describe, it, expect } from 'vitest';
import { buildPairingIndex } from '../recipePairingMatch.js';
import { buildRolePool, roleOf } from '../cocktailRiff.js';
import {
  inventCocktails, FAMILY_SKELETONS, scaleAmounts, formatOz, ozOf, isBaseSpirit, ingredientKind, drinkAsCocktail,
} from '../cocktailInvent.js';

const roles = {
  gin: { role: 'spirit' }, rye: { role: 'spirit' }, bourbon: { role: 'spirit' }, vodka: { role: 'spirit' }, rum: { role: 'spirit' },
  sherry: { role: 'spirit' },
  'lemon juice': { role: 'sour' }, 'lime juice': { role: 'sour' }, 'orange juice': { role: 'sour' },
  'simple syrup': { role: 'sweet' }, 'honey syrup': { role: 'sweet' },
  'sweet vermouth': { role: 'vermouth' }, 'dry vermouth': { role: 'vermouth' },
  campari: { role: 'amaro_liqueur' }, aperol: { role: 'amaro_liqueur' }, 'amaro montenegro': { role: 'amaro_liqueur' },
  'triple sec': { role: 'amaro_liqueur' }, 'maraschino liqueur': { role: 'amaro_liqueur' }, prosecco: { role: 'amaro_liqueur' },
  'soda water': { role: 'modifier' }, 'pineapple juice': { role: 'modifier' }, 'egg white': { role: 'modifier' },
  'angostura bitters': { role: 'bitter' },
};
const names = Object.keys(roles);
const index = buildPairingIndex([
  { source: 'rye', target: 'amaro montenegro', strength: 0.9, known: true },
  { source: 'rye', target: 'lemon juice', strength: 0.5, known: true },
  { source: 'amaro montenegro', target: 'lemon juice', strength: 0.4, known: true },
  { source: 'rye', target: 'simple syrup', strength: 0.3, known: true },
  { source: 'gin', target: 'campari', strength: 0.8, known: true },
  { source: 'gin', target: 'sweet vermouth', strength: 0.8, known: true },
  { source: 'campari', target: 'sweet vermouth', strength: 0.9, known: true },
  { source: 'campari', target: 'soda water', strength: 0.6, known: true },
], names);
const pool = buildRolePool(roles, index.names);
const run = (opts) => inventCocktails({ roles, pool, pairingIndex: index, ...opts });

const SOUR = /lemon|lime|grapefruit/;
function assertGuardRails(drink) {
  const keys = drink.lines.map((l) => l.key);
  expect(new Set(keys).size).toBe(keys.length); // no ingredient twice
  expect(keys.filter((k) => SOUR.test(k)).length).toBeLessThanOrEqual(1); // never two sours
  expect(drink.lines.filter((l) => l.slot === 'base').length).toBeLessThanOrEqual(1); // one base spirit
  expect(keys.filter((k) => isBaseSpirit(k, roles)).length).toBeLessThanOrEqual(1);
}

describe('amounts', () => {
  it('parses and formats quarter ounces', () => {
    expect(ozOf('¾ oz')).toBe(0.75);
    expect(ozOf('2 oz')).toBe(2);
    expect(ozOf('2 dashes')).toBeNull();
    expect(formatOz(1.75)).toBe('1¾ oz');
    expect(formatOz(0.5)).toBe('½ oz');
    expect(formatOz(2)).toBe('2 oz');
    expect(formatOz(0.05)).toBe('¼ oz');
  });
  it('scales the pour into the family volume range, leaving dashes alone', () => {
    const skel = FAMILY_SKELETONS[4];
    const filled = skel.slots.map((slot) => ({ slot, role: slot.roles[0] }));
    const amounts = scaleAmounts(filled, skel.volume);
    const total = amounts.map(ozOf).filter((x) => x != null).reduce((a, b) => a + b, 0);
    expect(total).toBeGreaterThanOrEqual(skel.volume[0] - 0.25);
    expect(total).toBeLessThanOrEqual(skel.volume[1] + 0.25);
    expect(amounts[amounts.length - 1]).toBe('2 dashes');
  });
  it('a sour is 2 : ¾ : ¾', () => {
    const r = run({ familyId: 2, bar: ['gin', 'lemon juice', 'simple syrup'] });
    expect(r.drinks[0].lines.map((l) => l.amount)).toEqual(['2 oz', '¾ oz', '¾ oz']);
  });
});

describe('inventCocktails', () => {
  it('builds a Sour from the bar, picking the best-pairing modifier and naming it', () => {
    const r = run({ familyId: 2, bar: ['rye', 'lemon juice', 'amaro montenegro', 'simple syrup'] });
    expect(r.ok).toBe(true);
    const d = r.drinks[0];
    expect(d.lines.map((l) => l.key)).toEqual(['rye', 'lemon juice', 'amaro montenegro']);
    expect(d.name).toBe('Rye & Amaro Montenegro Sour');
    expect(d.why).toMatch(/rye \+ amaro montenegro/);
    expect(d.build).toMatch(/Shake/);
    expect(r.drinks.length).toBeGreaterThan(1); // something to shuffle to
    r.drinks.forEach(assertGuardRails);
  });

  it('uses only bar ingredients when the bar is not empty', () => {
    const bar = ['gin', 'campari', 'sweet vermouth', 'lemon juice', 'simple syrup', 'soda water'];
    for (const fid of [2, 4, 1, 5, 3]) {
      const r = run({ familyId: fid, bar });
      expect(r.ok).toBe(true);
      for (const d of r.drinks) {
        d.lines.forEach((l) => expect(bar).toContain(l.key));
        assertGuardRails(d);
      }
    }
  });

  it('Aromatic Stirred from a Negroni bar is the Negroni build', () => {
    const r = run({ familyId: 4, bar: ['gin', 'campari', 'sweet vermouth'] });
    expect(r.drinks[0].lines.map((l) => l.key)).toEqual(['gin', 'sweet vermouth', 'campari']);
    expect(r.drinks[0].name).toBe('Gin & Campari Stirred');
  });

  it('honours a chosen base spirit', () => {
    const r = run({ familyId: 2, bar: ['gin', 'rye', 'lemon juice', 'simple syrup'], base: 'gin' });
    expect(r.drinks.every((d) => d.lines[0].key === 'gin')).toBe(true);
    expect(r.drinks.every((d) => !d.lines.some((l) => l.key === 'rye'))).toBe(true);
  });

  it('never uses a second spirit, even with several in the bar', () => {
    const r = run({ familyId: 2, bar: ['gin', 'rye', 'vodka', 'lemon juice', 'lime juice', 'simple syrup'] });
    r.drinks.forEach(assertGuardRails);
  });

  it('reports the missing role instead of inventing one', () => {
    const r = run({ familyId: 2, bar: ['gin', 'simple syrup'] });
    expect(r.ok).toBe(false);
    expect(r.missing).toEqual(['sour']);
    const t = run({ familyId: 0, bar: ['rum', 'lime juice', 'simple syrup'] });
    expect(t.ok).toBe(false);
    expect(t.missing).toEqual(['juice']);
    const noBase = run({ familyId: 4, bar: ['sherry', 'sweet vermouth'] });
    expect(noBase.ok).toBe(false);
    expect(noBase.missing).toEqual(['base spirit']);
  });

  it('Aperitivo needs no spirit: the aperitif is the base', () => {
    const r = run({ familyId: 5, bar: ['campari', 'soda water', 'gin'] });
    expect(r.ok).toBe(true);
    expect(r.drinks[0].lines.map((l) => l.key)).toEqual(['campari', 'soda water']);
    expect(r.drinks[0].name).toBe('Campari Spritz');
  });

  it('with an empty bar draws from the whole pool', () => {
    const r = run({ familyId: 2, bar: [] });
    expect(r.ok).toBe(true);
    r.drinks.forEach(assertGuardRails);
  });

  it('the drink converts to a codex-shaped cocktail the riff panel can read', () => {
    const d = run({ familyId: 2, bar: ['gin', 'lemon juice', 'simple syrup'] }).drinks[0];
    const c = drinkAsCocktail(d);
    expect(c.ingredients_raw.map((r) => r.raw)).toEqual(['2 oz gin', '¾ oz lemon juice', '¾ oz simple syrup']);
    expect(roleOf(c.ingredients_raw[1].raw, roles)).toBe('sour');
  });
});

describe('ingredientKind', () => {
  it('separates bubbles, citrus, dairy and liqueurs', () => {
    expect(ingredientKind('prosecco', 'amaro_liqueur')).toBe('bubbles');
    expect(ingredientKind('soda water', 'modifier')).toBe('bubbles');
    expect(ingredientKind('lime juice', 'sour')).toBe('citrus');
    expect(ingredientKind('egg white', 'modifier')).toBe('dairy');
    expect(ingredientKind('campari', 'amaro_liqueur')).toBe('bitter');
    expect(ingredientKind('triple sec', 'amaro_liqueur')).toBe('sweet liqueur');
  });
});
