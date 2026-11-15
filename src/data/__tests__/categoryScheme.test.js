// DATA-4: the category scheme, checked over the real curated data.
//
//  1. every ingredient has a category in the scheme, none is still called 'umami', every example is real;
//  2. every category has a glyph, a unit dimension and a fallback taste;
//  3. the audit's category rules report nothing;
//  4. the named guarantees of the category change over the live data (lemon and lime juice still offered for a sour,
//     flour for a roux, every bottle recognised). The one-off before/after comparison of DATA-4 was retired in DATA-5.
import { describe, it, expect, beforeAll } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { CATEGORY_SCHEME, SCHEME_CATEGORIES } from '../categoryScheme.js';
import { findCategoryInconsistencies, categorySplits } from '../dataAudit.js';
import { CURATION_TABLES } from '../curation/tables.js';
import { applyCuration } from '../curation/applyCuration.js';
import { ingredientGlyphKind, ingredientArtKind } from '../../components/chalkArt.jsx';
import { CATEGORY_DEFAULT_DIMENSION } from '../../ml/kitchenUnits.js';
import { CATEGORY_TO_TASTE } from '../../hooks/useProData.js';
import { computeSnapshot } from '../../../scripts/lib/categoryHarness.mjs';
import { INVENT_STYLES, sauceSkeleton, fitsSlot } from '../inventSauce.js';
import { buildCategoryMap } from '../saucePantry.js';
import { KINDS } from '../dishSkeletons.js';

const ROOT = path.resolve(__dirname, '../../..');
const raw = JSON.parse(fs.readFileSync(path.join(ROOT, 'public/proDataset/ingredients.json'), 'utf8'));
const curated = applyCuration(raw, null, CURATION_TABLES).ingredients;
const entries = Object.entries(curated).filter(([k]) => !k.startsWith('_'));
const categoriesInData = [...new Set(entries.map(([, v]) => v.category))].sort();

describe('the scheme and the curated data', () => {
  it('every ingredient has a category from the scheme, and nothing is still filed under the taste word umami', () => {
    const outside = entries.filter(([, v]) => !SCHEME_CATEGORIES.has(v.category)).map(([k, v]) => `${k}: ${v.category}`);
    expect(outside).toEqual([]);
    expect(categoriesInData).not.toContain('umami');
    expect(categoriesInData).toContain('savory seasoning');
  });
  it('every category in the scheme is used, and every example is an ingredient filed under it', () => {
    for (const { category, examples, definition } of CATEGORY_SCHEME) {
      expect(categoriesInData, category).toContain(category);
      expect(definition.length, category).toBeGreaterThan(15);
      expect(examples, category).toHaveLength(3);
      for (const e of examples) expect(curated[e]?.category, `${category}: ${e}`).toBe(category);
    }
    expect(CATEGORY_SCHEME.length).toBe(categoriesInData.length);
  });
  it('the four new categories are declared and the old one is renamed, each with a reason', () => {
    for (const c of ['savory seasoning', 'juice', 'wine', 'beer']) expect(CURATION_TABLES.vocabulary.categories[c]?.reason?.length, c).toBeGreaterThan(15);
    expect(CURATION_TABLES.categoryRenames.umami.to).toBe('savory seasoning');
  });
});

describe('every category has a glyph, a unit dimension and a fallback taste', () => {
  // 'other' is the deliberate fallback: the plain bowl, no chip glyph.
  const real = categoriesInData.filter((c) => c !== 'other');
  it('the notebook drawing and the chip glyph', () => {
    for (const c of real) {
      expect(ingredientGlyphKind(c), `chip glyph for ${c}`).toBeTruthy();
      expect(ingredientArtKind(c, ''), `notebook drawing for ${c}`).not.toBe('bowl');
    }
  });
  it('the default measuring dimension and the fallback taste colour', () => {
    for (const c of categoriesInData) expect(CATEGORY_DEFAULT_DIMENSION[c], `dimension for ${c}`).toBeTruthy();
    for (const c of real) expect(CATEGORY_TO_TASTE[c], `fallback taste for ${c}`).toBeTruthy();
  });
  it('reuses the closest existing drawing for the new categories', () => {
    expect(ingredientGlyphKind('wine')).toBe(ingredientGlyphKind('spirit'));
    expect(ingredientGlyphKind('beer')).toBe(ingredientGlyphKind('spirit'));
    expect(ingredientGlyphKind('juice')).toBe(ingredientGlyphKind('liquid'));
    expect(ingredientGlyphKind('savory seasoning')).toBe('veg');
  });
});

describe('the audit category rules, over the curated data', () => {
  it('report zero inconsistencies for cheese, juice, flour, wine, vermouth, beer and spirit, and no umami', () => {
    expect(findCategoryInconsistencies(curated)).toEqual([]);
    const splits = Object.fromEntries(categorySplits(curated).map((s) => [s.family, s]));
    for (const family of ['cheese', 'juice', 'flour', 'wine', 'vermouth', 'beer', 'spirit']) {
      expect(splits[family].total, family).toBeGreaterThan(0);
      expect(splits[family].outside, family).toEqual([]);
    }
  });
  it('the rules do find the problem in the generated data (so they are not vacuous)', () => {
    const rules = new Set(findCategoryInconsistencies(raw).map((f) => f.rule));
    for (const r of ['category-cheese', 'category-juice', 'category-flour', 'category-wine', 'category-umami']) expect(rules.has(r), r).toBe(true);
  });
  it('the decisions that are easy to get wrong', () => {
    expect(curated.parmesan.category).toBe('dairy');
    expect(curated['lemon juice'].category).toBe('citrus');
    expect(curated['lime juice'].category).toBe('citrus');
    expect(curated['pineapple juice'].category).toBe('juice');
    expect(curated['apple cider'].category).toBe('juice');
    expect(curated.cider.category).toBe('beer');
    expect(curated['ginger beer'].category).toBe('mixer');
    expect(curated.cornstarch.category).toBe('thickener');
    expect(curated['wheat flour'].category).toBe('grain');
    expect(curated['sweet vermouth'].category).toBe('liqueur');
    expect(curated.sake.category).toBe('wine');
    expect(curated.sherry.category).toBe('wine');
    expect(curated.champagne.category).toBe('wine');
    expect(curated['fish sauce'].category).toBe('savory seasoning');
    expect(curated.rum.category).toBe('spirit');
  });
});

// DATA-4 compared every shortlist, bar result, recipe role and filter with a snapshot taken before the category change and
// listed the 11 intended differences (see .schermness/reports/DATA-4.md). That snapshot was pinned to the data as it was then:
// DATA-5 (aliases, added bottles, labels) legitimately changes shortlists, so the comparison was retired. What stays is what
// does not decay: the named guarantees below, which read the live data.
describe('what the category change promised, over the live data', () => {
  let after;
  beforeAll(async () => { after = await computeSnapshot(); }, 90000);

  it('the snapshot covers what it claims to', () => {
    expect(Object.keys(after.dishShortlists).length).toBeGreaterThan(150);
    expect(Object.keys(after.cocktailShortlists).length).toBeGreaterThan(90);
    expect(Object.keys(after.sauceShortlists).length).toBeGreaterThan(150);
    expect(Object.keys(after.bar).length).toBeGreaterThan(500);
    expect(Object.keys(after.recipeRoles).length).toBeGreaterThan(80);
    expect(Object.keys(after.winePairing).length).toBeGreaterThan(80);
  });
  it('lemon and lime juice are still offered for a sour or acid part, in every panel', () => {
    for (const [key, list] of Object.entries(after.cocktailShortlists)) if (/\/sour\//.test(key)) expect(list, key).toEqual(expect.arrayContaining(['lemon juice', 'lime juice']));
    for (const [key, list] of Object.entries(after.sauceShortlists)) if (/^(Velouté|Hollandaise|Curry|Stir-fry|Salsa|Nut Sauce)\/acid\//.test(key)) expect(list, key).toEqual(expect.arrayContaining(['lemon juice', 'lime juice']));
    for (const n of ['lemon juice', 'lime juice']) expect(after.dishKinds.acid).toContain(n);
  });
  it('flour and cornstarch are still offered for a thickener part', () => {
    const meta = JSON.parse(fs.readFileSync(path.join(ROOT, 'public/data/sauce_augment.json'), 'utf8')).ingredients;
    const catMap = buildCategoryMap(meta);
    const slotOf = (style, id) => sauceSkeleton(style, { catMap }).slots.find((s) => s.id === id);
    const roux = slotOf('Béchamel', 'roux');
    const slurry = INVENT_STYLES.map((s) => sauceSkeleton(s.id, { catMap }).slots.find((x) => x.id === 'starch')).find(Boolean);
    for (const f of ['flour', 'wheat flour', 'white flour']) expect(fitsSlot(f, roux, catMap), f).toBe(true);
    expect(fitsSlot('cornstarch', slurry, catMap)).toBe(true);
    expect(after.sauceShortlists['Béchamel/roux/butter']).toContain('flour');
  });
  it('My bar still recognises every bottle in the cocktail roles', () => {
    for (const [name, key] of Object.entries(after.bar)) expect(key, name).toBeTruthy();
  });
  it('every Cookbook recipe still has a role for each ingredient and a main, and every dish kind still accepts something', () => {
    for (const [name, roles] of Object.entries(after.recipeRoles)) expect(Object.keys(roles).length, name).toBeGreaterThan(0);
    for (const [name, mains] of Object.entries(after.recipeMains)) expect(mains.length, name).toBeGreaterThan(0);
    for (const kind of Object.keys(KINDS)) expect(after.dishKinds[kind].length, kind).toBeGreaterThan(0);
  });
  it('every wine ranking has three wines', () => {
    for (const [name, wines] of Object.entries(after.winePairing)) expect(wines.length, name).toBe(3);
  });
});
