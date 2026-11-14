import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import {
  INVENT_STYLES, inventSauces, fitsSlot, amountFor, methodFor, proteinVocabulary, buildSaucePool,
  sauceSizeTerm, isSauceBasic, nextSauces, EXHAUSTED_SAUCE, SAUCE_SIZE,
  sauceSkeleton, rankSauceSlot, sauceFromBuild, haveSauceKey,
} from '../inventSauce.js';
import { SAUCE_TEMPLATES } from '../sauceScoring.js';
import { buildCategoryMap, sauceRoleOf, sauceKind } from '../saucePantry.js';
import { buildPairingIndex } from '../recipePairingMatch.js';
import { nearestSauces } from '../sauceSimilarity.js';
import { winesForSauce } from '../sauceWines.js';
import { seedBuild, fillRequired, shortlist, setSlot, clearSlot, addExtra, missing } from '../inventBuild.js';

// The real sauce catalogue: these tests are about kitchen chemistry on the
// data the app ships, not on a toy fixture.
const augment = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../../../public/data/sauce_augment.json'), 'utf8'));
const meta = augment.ingredients;
const sauces = augment.sauces.map((s) => ({ ...s, ingredients: s.ingredients.map((i) => i.name) }));
const catMap = buildCategoryMap(meta);
const sauceIndex = buildPairingIndex(augment.pairings, meta.map((i) => i.name));
const base = { meta, sauces, catMap, sauceIndex };

const roleKind = (k) => { const r = sauceRoleOf(k, catMap); return [r, sauceKind(k, r)]; };
const hasKind = (inv, role, kinds) => inv.lines.some((l) => { const [r, k] = roleKind(l.key); return r === role && kinds.includes(k); });

describe('styles follow SAUCE_TEMPLATES', () => {
  it('one style per template, every required template role is a required slot', () => {
    expect(INVENT_STYLES.map((s) => s.id).sort()).toEqual(SAUCE_TEMPLATES.map((t) => t.name).sort());
    for (const style of INVENT_STYLES) {
      expect(style.template).toBeTruthy();
      const required = new Set(style.slots.filter((s) => s.required).flatMap((s) => s.roles));
      for (const [role, w] of Object.entries(style.template.roles)) {
        if (w >= 1) expect(required.has(role), `${style.id} needs ${role}`).toBe(true);
      }
    }
  });
});

describe('kitchen chemistry', () => {
  const pantries = [
    [],
    ['butter', 'egg yolk', 'lemon', 'shallot', 'white wine', 'cream', 'tomato', 'garlic'],
    ['olive oil', 'garlic', 'lemon'],
    ['butter', 'flour', 'milk'],
  ];
  it('never invents an emulsion without an emulsifier, a fat and an acid', () => {
    for (const kitchen of pantries) {
      const r = inventSauces({ ...base, styleId: 'Hollandaise', kitchen, protein: 'salmon' });
      expect(r.ok).toBe(true);
      for (const inv of r.sauces) {
        expect(hasKind(inv, 'Thickener', ['egg']), inv.name).toBe(true);
        expect(hasKind(inv, 'Fat', ['butter', 'oil']), inv.name).toBe(true);
        expect(hasKind(inv, 'Acid', ['citrus', 'vinegar']), inv.name).toBe(true);
      }
    }
  });
  it('names the missing emulsifier instead of inventing around it', () => {
    const r = inventSauces({ ...base, styleId: 'Hollandaise', kitchen: ['butter', 'lemon', 'flour', 'cornstarch'], pantryOnly: true });
    expect(r.ok).toBe(false);
    expect(r.missing).toEqual(['egg yolk (the emulsifier)']);
    expect(r.reason).toMatch(/emulsifier/);
  });
  it('a roux sauce always has fat, flour (not cornstarch) and a liquid', () => {
    for (const styleId of ['Béchamel', 'Velouté', 'Espagnole']) {
      for (const kitchen of pantries) {
        const r = inventSauces({ ...base, styleId, kitchen });
        expect(r.ok).toBe(true);
        for (const inv of r.sauces) {
          expect(hasKind(inv, 'Fat', ['butter', 'oil', 'animal fat'])).toBe(true);
          expect(hasKind(inv, 'Thickener', ['flour'])).toBe(true);
          expect(hasKind(inv, 'Thickener', ['starch', 'egg'])).toBe(false);
          expect(hasKind(inv, 'Liquid', styleId === 'Béchamel' ? ['milk', 'cream'] : ['stock'])).toBe(true);
        }
      }
    }
  });
  it('no béchamel without a liquid when only the pantry counts', () => {
    const r = inventSauces({ ...base, styleId: 'Béchamel', kitchen: ['butter', 'flour', 'nutmeg'], pantryOnly: true });
    expect(r).toMatchObject({ ok: false, missing: ['milk or cream'] });
  });
  it('every style builds from an empty pantry, with required ingredients marked to buy', () => {
    for (const style of INVENT_STYLES) {
      const r = inventSauces({ ...base, styleId: style.id, kitchen: [] });
      expect(r.ok, style.id).toBe(true);
      expect(r.sauces.length).toBeGreaterThan(0);
      for (const inv of r.sauces) {
        expect(inv.method.length).toBeGreaterThan(40);
        expect(inv.method).not.toMatch(/undefined|null/);
        expect(inv.need).toEqual(inv.lines.filter((l) => !l.have).map((l) => l.key));
      }
    }
  });
  it('no ingredient twice, every line has an amount', () => {
    for (const style of INVENT_STYLES) {
      const r = inventSauces({ ...base, styleId: style.id, kitchen: pantries[1], protein: 'chicken' });
      for (const inv of r.sauces) {
        const keys = inv.lines.map((l) => l.key);
        expect(new Set(keys).size).toBe(keys.length);
        for (const l of inv.lines) expect(l.amount).toBeTruthy();
      }
    }
  });
});

describe('pantry first', () => {
  it('fills from the pantry and only buys what a required role lacks', () => {
    const r = inventSauces({ ...base, styleId: 'Hollandaise', kitchen: ['butter', 'eggs', 'lemon', 'shallot'] });
    const inv = r.sauces[0];
    expect(inv.need).toEqual([]);
    expect(inv.lines.map((l) => l.key)).toEqual(expect.arrayContaining(['butter', 'eggs', 'lemon']));
  });
  it('a missing required role falls back to a common ingredient, marked you would need', () => {
    const r = inventSauces({ ...base, styleId: 'Velouté', kitchen: ['butter', 'white wine', 'shallot'] });
    expect(r.ok).toBe(true);
    for (const inv of r.sauces) {
      const stock = inv.lines.find((l) => l.slot === 'liquid');
      expect(stock.have).toBe(false);
      expect(inv.need).toContain(stock.key);
    }
  });
  it('optional slots never send the cook shopping when the pantry is not empty', () => {
    const r = inventSauces({ ...base, styleId: 'Tomato', kitchen: ['tomato', 'garlic'] });
    for (const inv of r.sauces) for (const l of inv.lines) expect(l.have).toBe(true);
  });
  it('emulsion with oil is named a mayonnaise / aïoli, with butter a butter sauce', () => {
    const oil = inventSauces({ ...base, styleId: 'Hollandaise', kitchen: ['olive oil', 'egg yolk', 'lemon', 'garlic'], assumeBasics: false });
    expect(oil.sauces[0].name).toMatch(/Aïoli|Mayonnaise/);
    expect(oil.sauces[0].method).toMatch(/room temperature/);
    const butter = inventSauces({ ...base, styleId: 'Hollandaise', kitchen: ['butter', 'egg yolk', 'lemon'], assumeBasics: false });
    expect(butter.sauces[0].name).toMatch(/Butter Sauce/);
    expect(butter.sauces[0].method).toMatch(/70 °C/);
  });
});

describe('ranking and output', () => {
  it('prefers what pairs with the protein', () => {
    const idx = buildPairingIndex([
      { source: 'dill', target: 'salmon', strength: 1 },
      { source: 'tarragon', target: 'salmon', strength: 0.01 },
    ], ['dill', 'salmon', 'tarragon']);
    const kitchen = ['butter', 'egg yolk', 'lemon', 'dill', 'tarragon'];
    const r = inventSauces({ ...base, sauceIndex: null, styleId: 'Hollandaise', kitchen, protein: 'salmon', pairingIndex: idx });
    expect(r.sauces[0].lines.map((l) => l.key)).toContain('dill');
    expect(r.sauces[0].why).toMatch(/salmon/);
  });
  it('returns distinct inventions with names', () => {
    const r = inventSauces({ ...base, styleId: 'Curry', kitchen: [], limit: 3 });
    const names = r.sauces.map((s) => s.name);
    expect(new Set(names).size).toBe(names.length);
    for (const s of r.sauces) expect(s.familyId).toBe(5);
  });
  it('the closest existing sauce of a classic hollandaise is a hollandaise-family sauce', () => {
    const r = inventSauces({ ...base, styleId: 'Hollandaise', kitchen: ['butter', 'egg yolk', 'lemon juice'], assumeBasics: false });
    const near = nearestSauces(r.sauces[0].lines.map((l) => l.key), sauces, 1);
    expect(['Hollandaise', 'Mousseline', 'Maltaise', 'Béarnaise']).toContain(near[0].sauce.name);
  });
});

describe('helpers', () => {
  it('slot fit, amounts and method', () => {
    const emul = INVENT_STYLES.find((s) => s.id === 'Hollandaise');
    const slot = emul.slots.find((s) => s.id === 'emulsifier');
    expect(fitsSlot('egg yolk', slot, catMap)).toBe(true);
    expect(fitsSlot('flour', slot, catMap)).toBe(false);
    expect(fitsSlot('cornstarch', slot, catMap)).toBe(false);
    expect(amountFor('butter', emul.slots[0], 'Hollandaise', catMap)).toMatch(/½ cup/);
    expect(amountFor('garlic', { required: true }, 'Tomato', catMap)).toBe('2 cloves, minced');
    expect(methodFor('Béchamel', [
      { key: 'butter', slot: 'fat' }, { key: 'flour', slot: 'roux' }, { key: 'milk', slot: 'liquid' },
    ])).toMatch(/Melt the butter.*flour.*milk/);
  });
  it('protein vocabulary and the pool', () => {
    const v = proteinVocabulary(sauces);
    expect(v[0]).toBe('chicken');
    expect(v).toContain('salmon');
    const pool = buildSaucePool(meta, sauces);
    expect(pool.get('garlic')).toBeGreaterThan(10);
  });
  it('unknown style', () => {
    expect(inventSauces({ ...base, styleId: 'Nope' })).toMatchObject({ ok: false });
  });
});

describe('size, why and variety (WEAK-5)', () => {
  const PANTRY = ['butter', 'egg yolk', 'lemon', 'shallot', 'white wine', 'cream', 'tomato', 'garlic'];

  it('the size term peaks at 5–7 ingredients', () => {
    const top = sauceSizeTerm(5);
    for (const n of [5, 6, 7]) expect(sauceSizeTerm(n)).toBe(top);
    expect(sauceSizeTerm(3)).toBeLessThan(sauceSizeTerm(4));
    expect(sauceSizeTerm(4)).toBeLessThan(top);
    expect(sauceSizeTerm(8)).toBeLessThan(top);
  });

  it('basics fill slots but never make the "why"', () => {
    expect(isSauceBasic('butter')).toBe(true);
    expect(isSauceBasic('olive oil')).toBe(true);
    expect(isSauceBasic('sesame oil')).toBe(true);
    expect(isSauceBasic('garlic')).toBe(false);
    for (const style of INVENT_STYLES) {
      const r = inventSauces({ ...base, styleId: style.id, kitchen: PANTRY });
      for (const inv of r.pool) {
        const m = inv.why.match(/: (.*)\.$/);
        if (m) for (const pair of m[1].split(', ')) for (const k of pair.split(' + ')) expect(isSauceBasic(k), `${inv.name}: ${inv.why}`).toBe(false);
      }
    }
  });

  it('fills optional roles from the pantry: mean size at least 5 over every style', () => {
    const sizes = INVENT_STYLES.flatMap((style) => inventSauces({ ...base, styleId: style.id, kitchen: PANTRY }).sauces.map((s) => s.lines.length));
    expect(sizes.reduce((a, b) => a + b, 0) / sizes.length).toBeGreaterThanOrEqual(SAUCE_SIZE.min);
  });

  it('a tomato sauce and a salsa can take onion and garlic both', () => {
    const t = inventSauces({ ...base, styleId: 'Tomato', kitchen: ['tomato', 'garlic', 'onion'] });
    expect(t.sauces[0].lines.map((l) => l.key)).toEqual(expect.arrayContaining(['tomato', 'garlic', 'onion']));
    expect(t.sauces[0].method).toMatch(/garlic and onion|onion and garlic/);
    const s = inventSauces({ ...base, styleId: 'Salsa', kitchen: ['tomato', 'garlic', 'onion'] });
    expect(s.sauces[0].lines.map((l) => l.key)).toEqual(expect.arrayContaining(['tomato', 'garlic', 'onion']));
  });

  it('Shuffle walks every sauce once, names unique, then is exhausted', () => {
    const r = inventSauces({ ...base, styleId: 'Hollandaise', kitchen: PANTRY });
    const shown = [];
    for (let i = 0; i < 100; i++) {
      const next = nextSauces(r.pool, shown, 3);
      if (next.length === 0) break;
      shown.push(...next);
    }
    expect(shown).toHaveLength(r.pool.length);
    expect(new Set(shown.map((s) => s.lines.map((l) => l.key).sort().join())).size).toBe(shown.length);
    expect(new Set(shown.map((s) => s.name)).size).toBe(shown.length);
    expect(nextSauces(r.pool, shown, 3)).toEqual([]);
    expect(EXHAUSTED_SAUCE).toBe("That's every idea for this pantry; add an ingredient for more.");
  });
});

describe('build model (INVENT-3)', () => {
  const kitchen = ['butter', 'egg yolk', 'lemon', 'shallot', 'cream', 'tomato', 'garlic'];
  const pool = buildSaucePool(meta, sauces);
  const rankOf = (styleId, extra = {}) => (slot, currentKeys) => rankSauceSlot({
    slot, currentKeys, kitchen, pool, catMap, sauceIndex, styleId, ...extra,
  });
  const built = (styleId, extra = {}, pinned = []) => fillRequired(
    seedBuild(sauceSkeleton(styleId, { catMap }), { lab: 'sauce', pinned }), rankOf(styleId, extra),
  );
  const lineOf = (b, id) => b.slots.find((s) => s.id === id).line?.key;

  it('sauceSkeleton: every style gives its slots with accepts() built on fitsSlot', () => {
    for (const style of INVENT_STYLES) {
      const skel = sauceSkeleton(style.id, { catMap });
      expect(skel.slots.map((s) => s.id)).toEqual(style.slots.map((s) => s.id));
      expect(skel.slots.map((s) => s.required)).toEqual(style.slots.map((s) => s.required));
    }
    const emul = sauceSkeleton('Hollandaise', { catMap });
    const yolk = emul.slots.find((s) => s.id === 'emulsifier');
    expect(yolk.accepts('egg yolk')).toBe(true);
    expect(yolk.accepts('flour')).toBe(false);
    expect(sauceSkeleton('Nope').slots).toEqual([]);
  });

  it('Emulsion: fat + egg yolk + acid pre-filled, aromatic / herb / spice empty; the build reports nothing missing', () => {
    const b = built('Hollandaise');
    expect(lineOf(b, 'fat')).toBe('butter');
    expect(lineOf(b, 'emulsifier')).toBe('egg yolk');
    expect(lineOf(b, 'acid')).toMatch(/lemon/);
    for (const id of ['aromatic', 'herb', 'spice']) expect(lineOf(b, id)).toBeUndefined();
    expect(missing(b)).toEqual([]);
  });

  it('pantry first: with no pantry fit a required slot is filled from outside, marked have:false; pantryOnly leaves it missing', () => {
    const k = ['butter', 'lemon'];
    const fill = (extra) => fillRequired(seedBuild(sauceSkeleton('Hollandaise', { catMap })),
      (slot, cur) => rankSauceSlot({ slot, currentKeys: cur, kitchen: k, pool, catMap, sauceIndex, ...extra }));
    const yolk = fill({}).slots.find((s) => s.id === 'emulsifier').line;
    expect(yolk.key).toBe('egg yolk');
    expect(yolk.have).toBe(false);
    expect(missing(fill({ pantryOnly: true }))).toEqual(['egg yolk (the emulsifier)']);
    for (const style of INVENT_STYLES) {
      for (const s of sauceSkeleton(style.id, { catMap }).slots) {
        const r = rankSauceSlot({ slot: s, kitchen: k, pool, catMap, pantryOnly: true });
        expect(r.every((c) => c.have), `${style.id}/${s.id}`).toBe(true);
      }
    }
    const emulsifier = sauceSkeleton('Hollandaise', { catMap }).slots.find((s) => s.id === 'emulsifier');
    expect(rankSauceSlot({ slot: emulsifier, kitchen: k, pool, catMap, pantryOnly: true })).toEqual([]);
  });

  it('rankSauceSlot: pantry items come before outside ones, which are marked have:false', () => {
    const slot = sauceSkeleton('Hollandaise', { catMap }).slots.find((s) => s.id === 'acid');
    const r = rankSauceSlot({ slot, kitchen: ['lemon'], assumeBasics: true, pool, catMap, sauceIndex });
    const firstOutside = r.findIndex((c) => !c.have);
    expect(firstOutside).toBeGreaterThan(0);
    expect(r.slice(0, firstOutside).every((c) => c.have)).toBe(true);
    expect(r.slice(firstOutside).every((c) => !c.have)).toBe(true);
    expect(r.map((c) => c.key)).toContain('white wine vinegar');
    expect(r.every((c) => typeof c.score === 'number')).toBe(true);
    expect(rankSauceSlot({ slot: null })).toEqual([]);
  });

  it('rankSauceSlot: pairing with the protein re-ranks a slot; basics never count', () => {
    const idx = buildPairingIndex([
      { source: 'dill', target: 'salmon', strength: 1 },
      { source: 'tarragon', target: 'salmon', strength: 0.01 },
    ], ['dill', 'salmon', 'tarragon']);
    const slot = sauceSkeleton('Hollandaise', { catMap }).slots.find((s) => s.id === 'herb');
    const common = { slot, kitchen: ['dill', 'tarragon'], pool, catMap, pairingIndex: idx };
    const withP = rankSauceSlot({ ...common, protein: 'salmon' });
    expect(withP[0].key).toBe('dill');
    expect(withP.find((c) => c.key === 'dill').score).toBeGreaterThan(rankSauceSlot(common).find((c) => c.key === 'dill').score);
    // A basic scores only on commonness, whatever it pairs with.
    const fat = sauceSkeleton('Hollandaise', { catMap }).slots.find((s) => s.id === 'fat');
    const idx2 = buildPairingIndex([{ source: 'butter', target: 'salmon', strength: 1 }], ['butter', 'salmon']);
    const a = rankSauceSlot({ slot: fat, kitchen: ['butter'], pool, catMap, pairingIndex: idx2, protein: 'salmon' }).find((c) => c.key === 'butter');
    const b = rankSauceSlot({ slot: fat, kitchen: ['butter'], pool, catMap, protein: 'salmon' }).find((c) => c.key === 'butter');
    expect(a.score).toBe(b.score);
  });

  it('shortlist excludes what is already in the build and what the slot does not accept', () => {
    const b = built('Hollandaise');
    const list = shortlist(b, 'acid', rankOf('Hollandaise'), 8).map((c) => c.key);
    expect(list.length).toBeGreaterThan(0);
    expect(list).not.toContain('butter');
    expect(list).not.toContain(lineOf(b, 'emulsifier'));
    expect(list.every((k) => b.slots.find((s) => s.id === 'acid').accepts(k))).toBe(true);
  });

  it('sauceFromBuild: lines with amounts, need, name, method on the CURRENT lines, why', () => {
    const b = built('Hollandaise', {}, [{ key: 'tarragon', source: 'search' }]);
    const inv = sauceFromBuild(b, { styleId: 'Hollandaise', catMap, sauceIndex, kitchen });
    expect(inv.lines.map((l) => l.key)).toEqual(expect.arrayContaining(['butter', 'egg yolk', 'tarragon']));
    expect(inv.lines.find((l) => l.slot === 'fat')).toMatchObject({ amount: '½ cup (115 g), melted', have: true, label: 'fat' });
    expect(inv.need).toEqual(['tarragon'])  // a search pin outside the pantry;
    expect(inv.name).toMatch(/Butter Sauce$/);
    expect(inv.technique).toBeTruthy();
    expect(inv.description).toBeTruthy();
    expect(inv.method).toMatch(/lecithin/);
    expect(inv.method).toMatch(/tarragon/);
    expect(inv.why).toBeTruthy();
    // Swap butter for oil: amount, method and name follow.
    const swapped = setSlot(b, 'fat', 'olive oil', { have: true }).build;
    const inv2 = sauceFromBuild(swapped, { styleId: 'Hollandaise', catMap, sauceIndex, kitchen });
    expect(inv2.lines.find((l) => l.slot === 'fat').amount).toBe('¾ cup');
    expect(inv2.method).toMatch(/mayonnaise/);
    expect(inv2.method).not.toBe(inv.method);
    expect(inv2.name).toMatch(/Mayonnaise|Aïoli/);
  });

  it('sauceFromBuild: extras are lines; outside picks are need; method waits for required slots', () => {
    let b = built('Hollandaise');
    b = addExtra(b, 'cumin', { have: false }).build;
    let inv = sauceFromBuild(b, { styleId: 'Hollandaise', catMap, sauceIndex, kitchen });
    expect(inv.lines.at(-1)).toMatchObject({ key: 'cumin', slot: 'extra', have: false });
    expect(inv.need).toEqual(['cumin']);
    b = clearSlot(b, 'emulsifier');
    inv = sauceFromBuild(b, { styleId: 'Hollandaise', catMap, sauceIndex, kitchen });
    expect(inv.method).toBe('');
    expect(inv.lines.some((l) => l.slot === 'emulsifier')).toBe(false);
    expect(sauceFromBuild(b, { styleId: 'Nope' })).toBeNull();
  });

  it('sauceFromBuild feeds nearestSauces and winesForSauce', () => {
    const b = built('Hollandaise');
    const inv = sauceFromBuild(b, { styleId: 'Hollandaise', protein: 'salmon', catMap, sauceIndex, kitchen });
    const keys = inv.lines.map((l) => l.key);
    expect(['Hollandaise', 'Mousseline', 'Maltaise', 'Béarnaise']).toContain(nearestSauces(keys, sauces, 1)[0].sauce.name);
    const wines = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../../../public/data/wine_styles.json'), 'utf8')).wines;
    expect(winesForSauce({ ingredients: keys, proteins: ['salmon'] }, wines)[0]).toBeTruthy();
  });

  it('haveSauceKey: kitchen, assumed basics, and not what is absent', () => {
    expect(haveSauceKey('egg yolk', { kitchen })).toBe(true);
    expect(haveSauceKey('olive oil', { kitchen: [] })).toBe(true);
    expect(haveSauceKey('olive oil', { kitchen: [], assumeBasics: false })).toBe(false);
    expect(haveSauceKey('saffron', { kitchen })).toBe(false);
  });
});
