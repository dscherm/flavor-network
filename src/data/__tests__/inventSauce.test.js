import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import {
  INVENT_STYLES, fitsSlot, amountFor, methodFor, proteinVocabulary, buildSaucePool, isSauceBasic,
  sauceSkeleton, rankSauceSlot, sauceFromBuild, haveSauceKey, canAnchorSauce, sauceAnchors, sauceReplacements,
} from '../inventSauce.js';
import { SAUCE_TEMPLATES } from '../sauceScoring.js';
import { buildCategoryMap } from '../saucePantry.js';
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
  it('unknown style gives an empty skeleton', () => {
    expect(sauceSkeleton('Nope', { catMap })).toEqual({ slots: [], rules: [] });
  });
});

describe('basics', () => {
  it('basics fill slots but never make the "why"', () => {
    expect(isSauceBasic('butter')).toBe(true);
    expect(isSauceBasic('olive oil')).toBe(true);
    expect(isSauceBasic('sesame oil')).toBe(true);
    expect(isSauceBasic('garlic')).toBe(false);
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

  it('a roux sauce takes flour, never cornstarch, and fat and a liquid from the right kinds', () => {
    const b = built('Béchamel', {}, []);
    const roux = b.slots.find((s) => s.id === 'roux');
    expect(roux.line.key).toBe('flour');
    const slot = sauceSkeleton('Béchamel', { catMap }).slots.find((s) => s.id === 'roux');
    expect(rankSauceSlot({ slot, kitchen: ['cornstarch'], pool, catMap, pantryOnly: true }).map((c) => c.key)).not.toContain('cornstarch');
    expect(lineOf(b, 'liquid')).toMatch(/milk|cream/);
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

describe('start-empty helpers (INVENT-10)', () => {
  const pool = buildSaucePool(meta, sauces);
  it('every technique has a blurb and every required part a plain why', () => {
    for (const s of INVENT_STYLES) {
      expect(s.blurb, s.id).toMatch(/\S/);
      for (const sl of s.slots.filter((x) => x.required)) expect(sl.why, `${s.id}/${sl.id}`).toMatch(/\S/);
    }
    expect(INVENT_STYLES.find((s) => s.id === 'Hollandaise').slots.find((s) => s.id === 'emulsifier').why).toMatch(/lecithin/);
  });

  it('rankSauceSlot with no slot ranks the pool: pantry first, then pairing with the list and protein', () => {
    const idx = buildPairingIndex([{ source: 'tomato', target: 'basil', strength: 1 }], ['tomato', 'basil']);
    const r = rankSauceSlot({ slot: null, currentKeys: ['basil'], kitchen: ['garlic', 'tomato'], assumeBasics: false, pool, catMap, pairingIndex: idx });
    expect(r.length).toBeGreaterThan(5);
    expect(r.slice(0, 2).map((c) => c.key).sort()).toEqual(['garlic', 'tomato']);
    expect(r[0].key).toBe('tomato'); // pairs with basil
    expect(r.find((c) => c.key === 'basil')).toBeUndefined();
    expect(r.some((c) => /^(water|salt)$/.test(c.key))).toBe(false);
    const only = rankSauceSlot({ slot: null, currentKeys: ['basil'], kitchen: ['garlic', 'tomato'], assumeBasics: false, pantryOnly: true, pool, catMap });
    expect(only.map((c) => c.key).sort()).toEqual(['garlic', 'tomato']);
    expect(only.every((c) => c.have)).toBe(true);
  });

  it('canAnchorSauce: a main like tomato, butter or tahini can; a pinch of nutmeg cannot', () => {
    for (const k of ['tomato', 'butter', 'cream', 'tahini', 'soy sauce', 'chicken stock']) expect(canAnchorSauce(k, catMap), k).toBe(true);
    expect(canAnchorSauce('nutmeg', catMap)).toBe(false);
    expect(canAnchorSauce('egg yolk', catMap)).toBe(false);
  });

  it('sauceAnchors: pantry anchors first, then common ones from the sauce list, no duplicates', () => {
    const a = sauceAnchors({ kitchen: ['tahini', 'nutmeg', 'cream'], pool, catMap });
    expect(a.slice(0, 2).map((x) => x.key)).toEqual(['tahini', 'cream']);
    expect(a.slice(0, 2).every((x) => x.have)).toBe(true);
    expect(a.map((x) => x.key)).not.toContain('nutmeg');
    expect(new Set(a.map((x) => x.key)).size).toBe(a.length);
    expect(a.length).toBeGreaterThan(5);
    expect(a.length).toBeLessThanOrEqual(14);
    expect(a.slice(2).some((x) => !x.have)).toBe(true);
  });

  it('sauceReplacements: same role AND kind from the pantry; never across kinds; never one already used', () => {
    const r = sauceReplacements('onion', { kitchen: ['shallot', 'garlic', 'butter'], catMap });
    expect(r.map((x) => x.key)).toContain('shallot');
    expect(r.map((x) => x.key)).not.toContain('butter');
    const none = sauceReplacements('egg yolk', { kitchen: ['flour', 'cornstarch'], catMap });
    expect(none.map((x) => x.key)).not.toContain('flour');
    const used = sauceReplacements('onion', { kitchen: ['shallot'], buildKeys: ['shallot'], catMap });
    expect(used.map((x) => x.key)).not.toContain('shallot');
  });

  it('sauceReplacements with a slot offers what fits that slot, and respects kitchenSwaps sauce:false', () => {
    const acid = sauceSkeleton('Hollandaise', { catMap }).slots.find((s) => s.id === 'acid');
    const r = sauceReplacements('lemon juice', { slot: acid, kitchen: ['white wine vinegar', 'flour', 'tomato'], assumeBasics: false, catMap });
    expect(r.map((x) => x.key)).toContain('white wine vinegar');
    expect(r.map((x) => x.key)).not.toContain('flour');
    // milk for cream is a pan swap that does not hold in a sauce.
    const cream = sauceReplacements('cream', { kitchen: ['milk', 'butter'], assumeBasics: false, catMap });
    expect(cream.find((x) => x.key === 'milk' && x.note)).toBeUndefined();
  });
});

describe('sauce no-technique suggestions leave out noise', () => {
  const pool = buildSaucePool(meta, sauces);
  const rank = (currentKeys) => rankSauceSlot({ slot: null, currentKeys, kitchen: [], pool, catMap, sauceIndex }).map((c) => c.key);
  it('no salt, pepper, water or ice', () => {
    const out = rank(['chicken']);
    for (const k of ['salt', 'pepper', 'black pepper', 'white pepper', 'water', 'ice']) expect(out).not.toContain(k);
  });
  it('nothing of the same kind as a line already there, and one per kind', () => {
    const out = rank(['butter', 'lemon juice']);
    expect(out).not.toContain('lime juice');
    expect(out).not.toContain('lemon juice');
    const lastWords = out.map((k) => k.split(' ').pop());
    expect(new Set(lastWords.filter((w) => w.length > 3)).size).toBe(lastWords.filter((w) => w.length > 3).length);
  });
});
