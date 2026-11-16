// SHOP-4: alternatives for a shopping row, over the REAL swap table and the REAL cocktail role table.
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import { alternativesFor, swappedAmount, restoreRow, sameIngredient, MAX_ALTERNATIVES } from '../shoppingAlternatives.js';
import { SWAPS, swapsFor, swapUseText } from '../kitchenSwaps.js';
import { buildRolePool, swapCandidates, familyKey } from '../cocktailRiff.js';
import { addLine } from '../shoppingList.js';

const read = (p) => JSON.parse(fs.readFileSync(`${process.cwd()}/${p}`, 'utf8'));
const roles = read('public/data/cocktail_roles.json').byIngredient;
const ingredients = read('public/proDataset/ingredients.json');
const names = new Set(Object.keys(ingredients).filter((k) => !k.startsWith('_')));

const alts = (key, ctx = {}) => alternativesFor({ key }, { roles, names, ...ctx });
const keysOf = (key, ctx) => alts(key, ctx).alternatives.map((a) => a.key);

describe('food alternatives come from kitchenSwaps, with the usage in plain words', () => {
  it('buttermilk: milk with lemon, then yogurt', () => {
    const { alternatives } = alts('buttermilk');
    expect(alternatives.map((a) => a.key)).toEqual(['milk', 'yogurt']);
    expect(alternatives[0].useText).toBe('Use milk and lemon instead.');
    expect(alternatives[0].plus).toEqual(['lemon']);
    expect(alternatives[1].useText).toBe('Use yogurt instead.');
    expect(alternatives.every((a) => a.source === 'kitchenSwaps')).toBe(true);
  });
  it('shallot: onion', () => expect(keysOf('shallot')).toEqual(['onion']));
  it('parmesan: pecorino (one hard cheese for another)', () => expect(keysOf('parmesan')).toEqual(['pecorino']));
  it('a fresh herb with a listed stand-in: parsley -> cilantro', () => {
    expect(keysOf('parsley')).toEqual(['cilantro']);
    expect(alts('parsley').alternatives[0].useText).toBe('Use cilantro instead.');
  });
  it('lime juice: lemon juice', () => expect(keysOf('lime juice')).toEqual(['lemon juice']));
  it('never more than three, and the wording is advice, not a promise', () => {
    for (const k of new Set(SWAPS.map((s) => s.for))) {
      const { alternatives } = alts(k);
      expect(alternatives.length).toBeLessThanOrEqual(MAX_ALTERNATIVES);
      for (const a of alternatives) expect(a.useText).toMatch(/^(Use .* instead\.|Another .* could stand in)/);
    }
  });
  it('white wine has four table entries; three are shown', () => {
    expect(swapsFor('white wine').length).toBeGreaterThan(3);
    expect(alts('white wine').alternatives).toHaveLength(3);
  });
  it('a swap that holds only for a supporting item (butter -> oil) is not offered: the row has no recipe role', () => {
    expect(swapsFor('butter').length).toBeGreaterThan(0);
    expect(alts('butter').known).toBe(false);
    expect(keysOf('olive oil')).toEqual([]);
  });
  it('a swap flagged sauce:false is dropped for a row from a sauce, kept otherwise', () => {
    expect(keysOf('cream')).toEqual(['milk']);
    expect(keysOf('cream', { sauce: true })).toEqual([]);
    expect(keysOf('buttermilk', { sauce: true })).toEqual(['yogurt']);
  });
  it('"you have this" follows what the cook has, and what they have comes first', () => {
    const has = (k) => k === 'yogurt' || k === 'milk';
    const { alternatives } = alts('buttermilk', { has });
    // milk needs lemon too, which the cook lacks, so only yogurt is "have", and it goes first
    expect(alternatives.map((a) => [a.key, a.have])).toEqual([['yogurt', true], ['milk', false]]);
  });
});

describe('two names for one ingredient are one alternative (SHOP-5)', () => {
  // The app's curated names include "rye whiskey" (curation additions); the raw file does not.
  const curated = new Set([...names, 'rye whiskey']);

  it('bourbon offers rye whiskey, not "rye" and "rye whiskey" side by side; the fuller name is kept', () => {
    const keys = alts('bourbon', { names: curated, max: 9 }).alternatives.map((a) => a.key);
    expect(keys).toContain('rye whiskey');
    expect(keys).not.toContain('rye');
    expect(keys).toEqual(expect.arrayContaining(['scotch']));
  });
  it('the dedupe keeps "you have this": a cook with plain "rye" still sees rye whiskey as theirs', () => {
    const { alternatives } = alts('bourbon', { names: curated, has: (k) => k === 'rye' || k === 'rye whiskey' });
    const rye = alternatives.find((a) => a.key === 'rye whiskey');
    expect(rye.have).toBe(true);
    expect(alternatives[0].key).toBe('rye whiskey');
  });
  it('an alternative that is the row itself under another name is not offered back', () => {
    expect(alts('rye', { names: curated, max: 9 }).alternatives.map((a) => a.key)).not.toContain('rye whiskey');
    expect(alts('rye whiskey', { names: curated, max: 9 }).alternatives.map((a) => a.key)).not.toContain('rye');
  });
  it('sameIngredient is about the same thing, not a stand-in', () => {
    expect(sameIngredient('rye', 'rye whiskey')).toBe(true);
    expect(sameIngredient('lemon', 'lemon juice')).toBe(true);
    expect(sameIngredient('bourbon', 'rye whiskey')).toBe(false);
    expect(sameIngredient('milk', 'buttermilk')).toBe(false);
  });
  it('over every curated name, no list of alternatives holds the same ingredient twice', () => {
    for (const k of [...curated]) {
      const list = alts(k, { names: curated, max: 9 }).alternatives.map((a) => a.key);
      for (let i = 0; i < list.length; i++) for (let j = i + 1; j < list.length; j++) expect(sameIngredient(list[i], list[j]), `${k}: ${list[i]} / ${list[j]}`).toBe(false);
    }
  });
});

describe('bar alternatives come from cocktailRiff.swapCandidates, same family only', () => {
  it('bourbon: other plain whiskeys, never gin or a flavoured vodka', () => {
    const { alternatives } = alts('bourbon');
    expect(alternatives.length).toBeGreaterThan(0);
    expect(alternatives.map((a) => a.key)).toEqual(expect.arrayContaining(['scotch', 'rye']));
    for (const a of alternatives) {
      expect(a.source).toBe('cocktailRiff');
      expect(familyKey(a.key)).toBe('whiskey');
      expect(a.useText).toBe('Another whiskey could stand in; it will taste a little different.');
    }
    expect(keysOf('bourbon')).not.toContain('gin');
    expect(keysOf('bourbon')).not.toContain('whiskey');
  });
  it('tequila: mezcal; vodka and gin: nothing plain to offer', () => {
    expect(keysOf('tequila')).toEqual(['mezcal']);
    expect(keysOf('vodka')).toEqual([]);
    expect(keysOf('gin')).toEqual([]);
  });
  it('a flavoured or fruit bottle gets nothing; a liqueur or vermouth gets nothing (no safe rule)', () => {
    for (const k of ['apricot brandy', 'cherry brandy', 'raspberry vodka', 'triple sec', 'sweet vermouth', 'campari', 'angostura bitters', 'soda water']) {
      expect(keysOf(k), k).toEqual([]);
    }
  });
  it('words that merely contain a spirit (rye bread, vodka sauce, scotch bonnet) get nothing', () => {
    for (const k of ['rye bread', 'rye flour', 'vodka sauce', 'whiskey sauce', 'scotch bonnet']) expect(keysOf(k), k).toEqual([]);
  });
  it('without the role table no bar alternative is offered', () => {
    expect(alternativesFor({ key: 'bourbon' }, { roles: null, names }).known).toBe(false);
  });
  it('"you have this" works for a bottle on the shelf', () => {
    const { alternatives } = alts('bourbon', { has: (k) => k === 'rye' });
    expect(alternatives[0]).toMatchObject({ key: 'rye', have: true });
  });
});

describe('nothing known', () => {
  it('saffron, basil, a free-text item, an empty key', () => {
    for (const k of ['saffron', 'basil', 'chili crisp (hot)', 'something odd', '']) {
      expect(alts(k)).toEqual({ alternatives: [], known: false });
    }
  });
});

describe('no suggestion ever comes from an unsanctioned source', () => {
  it('for every curated ingredient, each alternative traces to swapsFor or to swapCandidates', () => {
    const pool = buildRolePool(roles, names);
    let checked = 0;
    for (const key of names) {
      const { alternatives } = alternativesFor({ key }, { roles, names });
      for (const a of alternatives) {
        checked += 1;
        if (a.source === 'kitchenSwaps') {
          expect(swapsFor(key).some((s) => s.use === a.key && swapUseText(s) === a.useText.replace(/^Use (.*) instead\.$/, '$1')), `${key} -> ${a.key}`).toBe(true);
        } else {
          expect(a.source).toBe('cocktailRiff');
          const cands = swapCandidates([{ key, role: 'spirit', swappable: true }], 0, pool, { names: new Set(), strength: new Map() }, 60).map((c) => c.name);
          expect(cands, `${key} -> ${a.key}`).toContain(a.key);
        }
      }
    }
    expect(checked).toBeGreaterThan(50);
  });
  it('a free-text neighbour is never invented: basil does not get mint, cumin does not get coriander', () => {
    expect(keysOf('basil')).toEqual([]);
    expect(keysOf('cumin')).toEqual([]);
  });
});

describe('the quantity rule', () => {
  const swaps = (name) => (name === 'oat flour' ? [{ for: 'oat flour', use: 'wheat flour', plus: [], role: 'grain', kind: 'flour', ratio: 0.75 }] : []);
  it('no real table entry carries a ratio, so a real swap keeps the original quantity', () => {
    expect(SWAPS.some((s) => s.ratio != null)).toBe(false);
    const item = { key: 'shallot', parts: [{ qty: 4, unit: '' }] };
    const [a] = alternativesFor(item, { roles, names }).alternatives;
    expect(a.ratio).toBeNull();
    expect(swappedAmount(item, a)).toBeUndefined();
  });
  it('a numeric ratio from the table scales a single numeric quantity, and says so', () => {
    const item = { key: 'oat flour', parts: [{ qty: 200, unit: 'g' }] };
    const [a] = alternativesFor(item, { roles, names, swaps }).alternatives;
    expect(a.ratio).toBe(0.75);
    expect(a.useText).toBe('Use wheat flour instead. Use three quarters as much.');
    expect(swappedAmount(item, a)).toBe('150 g');
  });
  it('a ratio is ignored when the row has no quantity or several parts', () => {
    const [a] = alternativesFor({ key: 'oat flour' }, { roles, names, swaps }).alternatives;
    expect(swappedAmount({ parts: [] }, a)).toBeUndefined();
    expect(swappedAmount({ parts: [{ qty: 1, unit: 'cup' }, { qty: 2, unit: 'g' }] }, a)).toBeUndefined();
  });
});

describe('restoreRow', () => {
  const opts = (n) => ({ now: 1000, newId: () => `id${n}` });
  it('puts a removed row back where it was; folds into a twin added meanwhile', () => {
    let list = { items: [], recipes: [] };
    list = addLine(list, { key: 'garlic', label: 'garlic', amount: '2 cloves' }, opts(1)).list;
    list = addLine(list, { key: 'milk', label: 'milk' }, opts(2)).list;
    const row = list.items[0];
    const gone = { ...list, items: list.items.slice(1) };
    expect(restoreRow(gone, row, 0, 2000).items.map((i) => i.key)).toEqual(['garlic', 'milk']);
    const twin = addLine(gone, { key: 'garlic', label: 'garlic', amount: '1 clove' }, opts(3)).list;
    const merged = restoreRow(twin, row, 0, 2000);
    expect(merged.items.filter((i) => i.key === 'garlic')).toHaveLength(1);
    expect(merged.items.find((i) => i.key === 'garlic').parts).toEqual([{ qty: 3, unit: 'clove' }]);
  });
});
