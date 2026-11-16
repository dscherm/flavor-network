// STANDIN-3: the bar half of the stand-in table (barStandIns.js), over the REAL table, the REAL role table and the REAL names.
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import { alternativesFor, sameIngredient } from '../shoppingAlternatives.js';
import { STAND_INS, SWAPS, swapsFor, findSwap, standInsFor, standInKind } from '../kitchenSwaps.js';
import { BAR_STAND_INS } from '../barStandIns.js';
import { familyKey } from '../cocktailRiff.js';
import { coverLine } from '../myBar.js';
import { canonicalKey, LIST_SYNONYMS, addLine } from '../shoppingList.js';
import { isTrivialIngredient } from '../recipePairingMatch.js';
import { haveIngredient } from '../myKitchen.js';
import { normalizeIngredient } from '../normalizeIngredient.js';
import { isSuggestable } from '../curation/suggestable.js';
import { loadCurationTables, applyCuration } from '../../../scripts/lib/curationTables.mjs';

const read = (p) => JSON.parse(fs.readFileSync(`${process.cwd()}/${p}`, 'utf8'));
const roles = read('public/data/cocktail_roles.json').byIngredient;
const ingredients = applyCuration(read('public/proDataset/ingredients.json'), null, loadCurationTables()).ingredients;
const names = new Set(Object.keys(ingredients).filter((k) => !k.startsWith('_')));
const alts = (key, ctx = {}) => alternativesFor({ key }, { roles, names, ...ctx });
const keysOf = (key, ctx) => alts(key, ctx).alternatives.map((a) => a.key);

describe('the bar entries are one reviewable table beside the food ones', () => {
  it('every bar entry is marked bar, is in STAND_INS and is never in SWAPS (the recipe side)', () => {
    expect(BAR_STAND_INS.length).toBeGreaterThan(100);
    for (const s of BAR_STAND_INS) {
      expect(s.bar, s.for).toBe(true);
      expect(STAND_INS).toContain(s);
      expect(SWAPS).not.toContain(s);
    }
    expect(STAND_INS.filter((s) => s.bar)).toHaveLength(BAR_STAND_INS.length);
  });
  it('the recipe side reads none of it: swapsFor and findSwap give nothing for a bar item', () => {
    expect(swapsFor('triple sec')).toEqual([]);
    expect(swapsFor('campari')).toEqual([]);
    expect(findSwap('triple sec', (k) => k === 'cointreau')).toBeNull();
    expect(standInsFor('triple sec').length).toBeGreaterThan(0);
  });
  it("My bar's own coverage is unchanged: a Cointreau still does not cover a triple sec line", () => {
    expect(coverLine({ key: 'triple sec', role: 'amaro_liqueur' }, new Set(['cointreau']), roles).covered).toBe(false);
    expect(coverLine({ key: 'campari', role: 'amaro_liqueur' }, new Set(['aperol']), roles).covered).toBe(false);
  });
  it('every name is one a cocktail line resolves to (canonical) and is suggestable; every none has a reason; every make an amount', () => {
    for (const s of BAR_STAND_INS) {
      expect(canonicalKey(s.for, names), `for ${s.for}`).toBe(s.for);
      expect(String(s.note || s.reason || s.amountNote || '').length, s.for).toBeGreaterThan(0);
      if (standInKind(s) === 'none') { expect(s.use).toBeNull(); expect(s.reason.length, s.for).toBeGreaterThan(20); continue; }
      for (const p of [s.use, ...s.plus]) {
        // A form may be the row's own ingredient under another name (bottled lemon juice -> lemon juice), as for thyme.
        expect(canonicalKey(p, names), `${p} for ${s.for}`).toBe(standInKind(s) === 'form' && p === s.use ? s.for : p);
        expect(isSuggestable(p), p).toBe(true);
      }
      if (standInKind(s) === 'make') expect(s.amountNote, s.for).toBeTruthy();
      if (standInKind(s) === 'swap') expect(s.note, `${s.use} for ${s.for} needs a note saying what changes`).toBeTruthy();
    }
  });
});

describe('named cases', () => {
  it('simple syrup: make it from sugar and water, with amounts', () => {
    const [a] = alts('simple syrup').alternatives;
    expect(a).toMatchObject({ key: 'sugar', kind: 'make', plus: ['water'], dropQty: true });
    expect(a.useText).toBe('Make it from sugar and water.');
    expect(a.amountNote).toMatch(/1\/2 cup sugar/);
    expect(a.amountNote).toMatch(/1\/2 cup hot water/);
  });
  it('grenadine: make it from pomegranate juice and sugar; honey syrup from honey and water', () => {
    expect(alts('grenadine').alternatives[0]).toMatchObject({ key: 'pomegranate juice', kind: 'make', plus: ['sugar'] });
    expect(alts('honey syrup').alternatives.find((a) => a.kind === 'make')).toMatchObject({ key: 'honey', plus: ['water'] });
  });
  it('triple sec offers the orange liqueurs, closest first, with what changes; never anything else', () => {
    const { alternatives } = alts('triple sec');
    expect(alternatives.map((a) => a.key)).toEqual(['cointreau', 'orange curacao', 'orange liqueur']);
    expect(alternatives[0].note).toMatch(/drier and stronger/);
    const all = standInsFor('triple sec').map((s) => s.use);
    expect(new Set(all)).toEqual(new Set(['cointreau', 'orange curacao', 'orange liqueur', 'grand marnier', 'blue curacao']));
    expect(standInsFor('triple sec').find((s) => s.use === 'blue curacao').note).toMatch(/turn the drink blue/);
  });
  it('an orange liqueur stands in for any other; cointreau is not offered for campari', () => {
    for (const k of ['cointreau', 'orange curacao', 'grand marnier', 'orange liqueur']) expect(keysOf(k, { max: 9 })).toContain('triple sec');
    expect(keysOf('campari', { max: 9 })).not.toContain('cointreau');
  });
  it('campari offers aperol with a note, and aperol offers campari', () => {
    const [a] = alts('campari').alternatives;
    expect(a.key).toBe('aperol');
    expect(a.note).toMatch(/sweeter/);
    expect(a.note).toMatch(/much less bitter/);
    expect(keysOf('aperol')).toEqual(['campari']);
  });
  it('dry and sweet vermouth are never one for the other', () => {
    expect(keysOf('dry vermouth', { max: 9 })).toEqual(['lillet blanc']);
    expect(keysOf('sweet vermouth', { max: 9 })).toEqual(['dubonnet rouge']);
    expect(keysOf('dubonnet rouge', { max: 9 })).not.toContain('dry vermouth');
  });
  it('bitters: aromatic and orange bitters stand in for each other with a note', () => {
    expect(keysOf('angostura bitters')).toEqual(["peychaud's bitters", 'bitters', 'orange bitters']);
    expect(alts('orange bitters').alternatives[0]).toMatchObject({ key: 'angostura bitters' });
    expect(alts('orange bitters').alternatives[0].note).toMatch(/orange peel/);
  });
  it('chartreuse and maraschino say nothing replaces them, and why', () => {
    for (const k of ['green chartreuse', 'yellow chartreuse', 'maraschino liqueur']) {
      const r = alts(k);
      expect(r.alternatives, k).toEqual([]);
      expect(r.known, k).toBe(false);
      expect(r.none.reason.length, k).toBeGreaterThan(30);
    }
    expect(alts('maraschino liqueur').none.reason).toMatch(/not cherry brandy/);
  });
  it('egg white offers aquafaba with the amount', () => {
    const [a] = alts('egg white').alternatives;
    expect(a).toMatchObject({ key: 'chickpea', kind: 'make', dropQty: true });
    expect(a.amountNote).toMatch(/2 tbsp \(1 oz\) aquafaba/);
  });
  it('fresh and bottled citrus: squeeze the fruit, or use the bottle, with what changes', () => {
    const lemon = alts('lemon juice', { max: 9 }).alternatives;
    expect(lemon.map((a) => [a.key, a.kind])).toEqual(expect.arrayContaining([['lime juice', 'swap'], ['lemon', 'make'], ['bottled lemon juice', 'form']]));
    expect(lemon.find((a) => a.key === 'lemon').amountNote).toMatch(/1 oz/);
    expect(lemon[0].note).toMatch(/more bitter/);
    expect(alts('lime juice').alternatives[0].note).toMatch(/different drink/);
    expect(alts('orange juice', { max: 9 }).alternatives.map((a) => a.key)).toEqual(expect.arrayContaining(['orange', 'bottled orange juice']));
  });
  it('sparkling wines, ginger soda and coffee liqueurs stand in with notes', () => {
    expect(keysOf('champagne')).toEqual(['sparkling wine', 'prosecco']);
    expect(keysOf('ginger beer')).toEqual(['ginger ale']);
    expect(keysOf('coffee liqueur').sort()).toEqual(['kahlua', 'tia maria']);
    expect(keysOf('baileys irish cream')).toEqual(['irish cream']);
  });
  it('half and half can be made from milk and cream; absinthe and pernod stand in for each other', () => {
    expect(alts('half and half').alternatives[0]).toMatchObject({ key: 'milk', kind: 'make', plus: ['cream'] });
    expect(keysOf('absinthe')).toEqual(['pernod']);
    expect(keysOf('pernod')).toEqual(['absinthe']);
  });
});

describe('a base spirit never crosses families', () => {
  it('gin and vodka are honest nones with a reason; the sheet offers no other spirit', () => {
    for (const k of ['gin', 'vodka']) {
      const r = alts(k);
      expect(r.alternatives, k).toEqual([]);
      expect(r.none.reason.length, k).toBeGreaterThan(40);
    }
    expect(alts('gin').none.reason).toMatch(/juniper/);
  });
  it('every spirit swap in the bar table stays inside one family (apple brandy and applejack, cachaca and rum)', () => {
    const spirits = BAR_STAND_INS.filter((s) => standInKind(s) === 'swap' && s.role === 'spirit' && s.kind !== 'cherry liqueur' && s.kind !== 'anise spirit');
    expect(spirits.length).toBeGreaterThan(0);
    // familyKey does not know applejack (an American apple brandy); that one pair is checked by name.
    const APPLE = new Set(['apple brandy', 'applejack']);
    for (const s of spirits) {
      if (APPLE.has(s.for) && APPLE.has(s.use)) continue;
      expect(familyKey(s.use), `${s.use} for ${s.for}`).toBe(familyKey(s.for));
    }
    expect(spirits.some((s) => s.for === 'cachaca' && familyKey(s.use) === 'rum')).toBe(true);
    expect(familyKey('cachaca')).toBe('rum');
  });
  it('bourbon still gets whiskey-family bottles only, and never gin', () => {
    const ks = keysOf('bourbon');
    expect(ks.length).toBeGreaterThan(0);
    for (const k of ks) expect(familyKey(k)).toBe('whiskey');
    expect(ks).not.toContain('gin');
  });
});

describe('fizzy waters are one ingredient; tonic is not', () => {
  const FIZZ = ['soda water', 'club soda', 'seltzer', 'seltzer water', 'sparkling water', 'carbonated water'];
  it('every name folds to soda water on the list, so no row doubles', () => {
    for (const n of FIZZ) expect(canonicalKey(n, names), n).toBe('soda water');
    expect(LIST_SYNONYMS['club soda']).toBe('soda water');
    expect(canonicalKey('tonic water', names)).toBe('tonic water');
  });
  it('a list never holds two of them: club soda and seltzer added in turn are one row', () => {
    let list = { items: [], recipes: [] };
    for (const [i, n] of ['seltzer', 'club soda', 'Soda Water'].entries()) list = addLine(list, { key: n }, { now: 1000 + i, newId: () => `r${i}`, names }).list;
    expect(list.items.map((i) => i.key)).toEqual(['soda water']);
  });
  it('soda water lists no other fizzy water as a stand-in; its answer says they are the same thing', () => {
    const r = alts('soda water');
    expect(r.alternatives).toEqual([]);
    expect(r.none.same).toMatch(/same thing/);
    expect(r.none.reason).toMatch(/club soda, seltzer, sparkling water/);
    const others = FIZZ.filter((f) => f !== 'soda water');
    for (const s of STAND_INS) for (const p of [s.use, ...(s.plus || [])]) expect(others, `${p} for ${s.for}`).not.toContain(p);
  });
  it('tonic water says nothing replaces it, and soda water is not offered for it', () => {
    const r = alts('tonic water');
    expect(r.alternatives).toEqual([]);
    expect(r.none.reason).toMatch(/quinine/);
    expect(r.none.same).toBeUndefined();
  });
});

describe('half and half is an ingredient, not "nothing" (found in STANDIN-2)', () => {
  it('its name is nothing but stop words, yet it is not trivial and no kitchen has it by default', () => {
    expect(normalizeIngredient('half and half')).toBe('');
    expect(isTrivialIngredient('half and half')).toBe(false);
    expect(isTrivialIngredient('2 oz half and half')).toBe(false);
    expect(haveIngredient('half and half', new Set(['milk']), { names }).covered).toBe(false);
    expect(haveIngredient('half and half', new Set(['half and half']), { names }).covered).toBe(true);
  });
  it('words that really are only stop words stay trivial', () => {
    for (const w of ['', 'and', 'the', '1 oz', 'to taste']) expect(isTrivialIngredient(w), w).toBe(true);
  });
  it('no other stored ingredient name is made only of stop words', () => {
    const empty = [...names].filter((n) => !normalizeIngredient(n));
    expect(empty).toEqual(['half and half']);
    expect(sameIngredient('half and half', 'cream')).toBe(false);
  });
});
