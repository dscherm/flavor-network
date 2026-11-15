// DATA-3: packaged and hidden entries are never OFFERED (suggestions, stand-ins, checklist picks, partner
// lists), on the real data, at each choke point. They stay findable by typing and valid in saved recipes.
import { describe, it, expect, beforeAll } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { isSuggestable, suggestableOnly } from '../curation/suggestable.js';
import { CURATION_TABLES } from '../curation/tables.js';
import { loadCuratedDataset } from '../curation/loadDataset.js';
import { getNeighbors, getNeighborsEnriched } from '../graph.js';
import { buildPairingIndex, resolveIngredientName } from '../recipePairingMatch.js';
import { buildIngredientVocab, parseQuery } from '../ingredientSearch.js';
import { toSavedItem } from '../inventSaved.js';
import {
  seedBuild, fillRequired, shortlist, suggestNext, openBuild,
} from '../inventBuild.js';
import { rankCocktailSlot, cocktailSkeleton, INVENT_FAMILY_ORDER } from '../cocktailInvent.js';
import { riffRows, buildRolePool, swapCandidates } from '../cocktailRiff.js';
import { INVENT_STYLES, sauceSkeleton, rankSauceSlot, sauceReplacements, buildSaucePool } from '../inventSauce.js';
import { buildCategoryMap } from '../saucePantry.js';
import { DISH_SKELETON_ORDER, dishSkeleton, rankDishSlot } from '../dishSkeletons.js';
import { findSwap, SWAPS } from '../kitchenSwaps.js';
import { rankByAxisImpact, buildAxisEnhancements } from '../recipeProfileAnalysis.js';
import { rankLogits } from '../../ml/recipeRuntime.js';

const PUB = path.resolve(__dirname, '../../../public');
const readJson = (p) => JSON.parse(fs.readFileSync(path.join(PUB, p), 'utf8'));
const PACKAGED = Object.keys(CURATION_TABLES.packaged);
const HIDDEN = Object.keys(CURATION_TABLES.hidden);
const VARIANTS = Object.keys(CURATION_TABLES.aliases);
const BLOCKED = new Set([...PACKAGED, ...HIDDEN, ...VARIANTS]);
const none = (keys, label) => { for (const k of keys) expect(BLOCKED.has(k), `${label}: ${k}`).toBe(false); };

let loaded; let nodes; let raw; let edges; let pairingIndex;
beforeAll(async () => {
  raw = readJson('proDataset/ingredients.json');
  const fetchFromDisk = async (url) => {
    try {
      const buf = fs.readFileSync(path.join(PUB, url.replace(/^\//, '')));
      return { ok: true, json: async () => JSON.parse(buf.toString('utf8')), arrayBuffer: async () => buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) };
    } catch { return { ok: false }; }
  };
  loaded = await loadCuratedDataset(fetchFromDisk);
  nodes = new Map(Object.entries(loaded.ingredientsData));
  edges = loaded.pairingsData.map((p) => ({ source: p.ingredientA, target: p.ingredientB, strength: p.strength, cooccurrence: p.tradition, known: p.known === true }));
  pairingIndex = buildPairingIndex(edges, nodes.keys());
}, 60000);

describe('isSuggestable', () => {
  it('is false for a packaged product, a hidden name and a merged variant, true for an ordinary ingredient', () => {
    for (const n of ['cool whip', 'velveeta cheese', 'cream of mushroom soup', 'yellow cake mix', 'cheesecloth', 'peache', 'Cool  Whip']) {
      expect(isSuggestable(n), n).toBe(false);
    }
    for (const n of ['peach', 'butter', 'basil', 'cherry tomato', 'baking potato']) expect(isSuggestable(n), n).toBe(true);
    expect(isSuggestable('')).toBe(false);
  });
  it('also honours a packaged flag on the dataset entry, in an object or a Map', () => {
    expect(isSuggestable('mystery bar', { 'mystery bar': { packaged: true } })).toBe(false);
    expect(isSuggestable('mystery bar', new Map([['mystery bar', { packaged: true }]]))).toBe(false);
    expect(isSuggestable('mystery bar', { 'mystery bar': {} })).toBe(true);
  });
  it('suggestableOnly filters strings and { key } / { name } objects', () => {
    expect(suggestableOnly(['butter', 'cool whip'])).toEqual(['butter']);
    expect(suggestableOnly([{ key: 'butter' }, { key: 'nutella' }])).toEqual([{ key: 'butter' }]);
    expect(suggestableOnly([{ name: 'cake mix' }, { name: 'sugar' }])).toEqual([{ name: 'sugar' }]);
  });
  it('the real tables name something to hide in every group', () => {
    expect(PACKAGED.length).toBeGreaterThan(100);
    expect(HIDDEN.length).toBeGreaterThan(10);
  });
});

describe('the curated dataset', () => {
  it('flags every packaged entry and keeps none of the hidden or merged names', () => {
    for (const n of PACKAGED) expect(loaded.ingredientsData[n]?.packaged, n).toBe(true);
    for (const n of [...HIDDEN, ...VARIANTS]) expect(loaded.ingredientsData[n], n).toBeUndefined();
  });
});

describe('Pairing Lab and every "goes with" list (getNeighbors, getNeighborsEnriched)', () => {
  it('never lists a packaged or hidden partner, for the busiest ingredients', () => {
    const busiest = [...nodes.entries()].filter(([, v]) => !v.packaged).sort((a, b) => (b[1].totalCount || 0) - (a[1].totalCount || 0)).slice(0, 40).map(([k]) => k);
    let listed = 0;
    for (const name of busiest) {
      const a = getNeighbors(name, edges).map((n) => n.name);
      const b = getNeighborsEnriched(name, edges, null).map((n) => n.name);
      none(a, `neighbors of ${name}`); none(b, `enriched neighbors of ${name}`);
      listed += a.length;
    }
    expect(listed).toBeGreaterThan(1000);
  });
  it('the unfiltered graph does carry packaged partners (so the filter is doing the work)', () => {
    const hit = edges.some((e) => PACKAGED.includes(e.source) || PACKAGED.includes(e.target));
    expect(hit).toBe(true);
  });
  it('drops a cuisine-index partner that is packaged', () => {
    const idx = new Map([['butter', [{ name: 'cool whip', cuisineStrength: 0.9, cuisineAnchor: 'x' }, { name: 'sugar', cuisineStrength: 0.8, cuisineAnchor: 'x' }]]]);
    const names = getNeighborsEnriched('butter', [], idx).map((n) => n.name);
    expect(names).toEqual(['sugar']);
  });
});

describe('the three invent panels', () => {
  const packagedBar = PACKAGED.slice(0, 200);

  it('cocktail: slot shortlists and the no-slot list never offer a packaged name, even from a bar that holds one', () => {
    const roles = readJson('data/cocktail_roles.json').byIngredient;
    const rolePool = buildRolePool(roles, new Set([...nodes.keys(), ...PACKAGED]));
    for (const p of PACKAGED) { rolePool.get('sweet')?.set(p, 99); rolePool.get('modifier')?.set(p, 99); }
    let seen = 0;
    for (const id of INVENT_FAMILY_ORDER) {
      const sk = cocktailSkeleton(id, { roles });
      for (const slot of [...sk.slots, null]) {
        const r = rankCocktailSlot({ slot, currentKeys: [], bar: ['gin', ...packagedBar], pool: rolePool, roles, pairingIndex });
        none(r.map((c) => c.key), `cocktail ${id}/${slot?.id}`);
        seen += r.length;
      }
    }
    expect(seen).toBeGreaterThan(50);
  });

  it('sauce: every style and slot, with a pantry and a pool full of packaged names', () => {
    const augment = readJson('data/sauce_augment.json');
    const meta = augment.ingredients;
    const catMap = buildCategoryMap(meta);
    for (const p of PACKAGED) catMap.set(p, 'Liquid');
    const pool = buildSaucePool(meta, augment.sauces.map((s) => ({ ...s, ingredients: s.ingredients.map((i) => i.name) })));
    for (const p of PACKAGED) pool.set(p, 40);
    let seen = 0;
    for (const style of INVENT_STYLES) {
      for (const slot of [...sauceSkeleton(style.id, { catMap }).slots, null]) {
        const r = rankSauceSlot({ slot, currentKeys: ['butter'], kitchen: ['butter', 'flour', 'milk', ...packagedBar], pool, catMap });
        none(r.map((c) => c.key), `sauce ${style.id}/${slot?.id}`);
        seen += r.length;
      }
    }
    expect(seen).toBeGreaterThan(50);
    const rep = sauceReplacements('cream', { kitchen: ['milk', ...PACKAGED], catMap, assumeBasics: false });
    none(rep.map((c) => c.key), 'sauce replacements');
  });

  it('recipe: every dish type and slot, with packaged products that look like real candidates', () => {
    const looksLike = ['broccoli', 'chicken', 'rice', 'parmesan', 'tomato', 'spinach', 'pasta'].filter((n) => nodes.has(n));
    const withPackaged = new Map(nodes);
    const index = { ...pairingIndex, degree: new Map(pairingIndex.degree) };
    PACKAGED.forEach((p, i) => {
      withPackaged.set(p, { ...nodes.get(looksLike[i % looksLike.length]), name: p, packaged: true });
      index.degree.set(p, 5000);
    });
    let seen = 0;
    for (const id of DISH_SKELETON_ORDER) {
      for (const slot of [...dishSkeleton(id, { nodes: withPackaged }).slots, null]) {
        const r = rankDishSlot({ slot, currentKeys: ['chicken'], kitchen: packagedBar, nodes: withPackaged, pairingIndex: index });
        none(r.map((c) => c.key), `dish ${id}/${slot?.id}`);
        seen += r.length;
      }
    }
    expect(seen).toBeGreaterThan(50);
  });

  it('the shared build helpers drop a packaged pick even if a ranker offers it first', () => {
    const rankFn = (slot) => [{ key: 'cool whip' }, { key: 'butter' }, { key: 'cake mix' }, { key: 'sugar' }];
    const open = openBuild({ lab: 'x', lines: [] });
    expect(suggestNext(open, rankFn, 8).map((c) => c.key)).toEqual(['butter', 'sugar']);
    const skeleton = { slots: [{ id: 'a', label: 'a', required: true, accepts: () => true }] };
    const seeded = seedBuild(skeleton, { lab: 'x' });
    expect(shortlist(seeded, 'a', rankFn).map((c) => c.key)).toEqual(['butter', 'sugar']);
    expect(fillRequired(seeded, rankFn).slots[0].line.key).toBe('butter');
  });
});

describe('stand-ins', () => {
  it('cocktail swaps never offer a packaged or merged name', () => {
    const roles = readJson('data/cocktail_roles.json').byIngredient;
    const cocktails = readJson('data/cocktail_codex_v2.json').cocktails;
    const index = buildPairingIndex(edges, [...nodes.keys()]);
    const pool = buildRolePool(roles, index.names);
    for (const [, m] of pool) for (const p of PACKAGED) m.set(p, 50);
    let seen = 0;
    for (const c of cocktails.slice(0, 80)) {
      const rows = riffRows(c, roles, index.names);
      rows.forEach((_, i) => { const r = swapCandidates(rows, i, pool, index, 12); none(r.map((x) => x.name), `swap in ${c.name}`); seen += r.length; });
    }
    expect(seen).toBeGreaterThan(50);
  });
  it('the kitchen swap table never hands back a packaged stand-in', () => {
    const has = () => true;
    for (const s of SWAPS) { const f = findSwap(s.for, has, {}); if (f) expect(isSuggestable(f.use), `${s.for} -> ${f.use}`).toBe(true); }
  });
});

describe('Recipe Notebook boost and temper', () => {
  const mk = (probs) => ({ gnnProbs: { sweet: 0, sour: 0, bitter: 0, salty: 0, umami: 0, odor_fruity: 0, odor_floral: 0, odor_green: 0, odor_woody: 0, odor_spicy: 0, odor_fatty: 0, ...probs } });
  const fake = new Map([
    ['whipped cream', mk({ sweet: 0.8, odor_fruity: 0.5 })], ['cool whip', mk({ sweet: 0.95, odor_fruity: 0.5 })],
    ['honey', mk({ sweet: 0.9, odor_fruity: 0.5 })],
  ]);
  const scores = { sweet: 0.1, sour: 0, bitter: 0, salty: 0, umami: 0, odor_fruity: 0.1, odor_floral: 0, odor_green: 0, odor_woody: 0, odor_spicy: 0, odor_fatty: 0 };
  it('rankByAxisImpact skips a packaged candidate, however strong', () => {
    const r = rankByAxisImpact(['cool whip', 'whipped cream', 'honey'], 'sweet', scores, 3, fake, { mode: 'boost', topN: 5 });
    expect(r.map((x) => x.name)).toEqual(['honey', 'whipped cream']);
  });
  it('buildAxisEnhancements inherits it', () => {
    const out = buildAxisEnhancements(['sweet'], ['cool whip', 'honey'], scores, 3, fake);
    expect(out[0].boost.map((x) => x.name)).toEqual(['honey']);
  });
  it('set completion (rankLogits) never ranks a packaged, hidden or merged name, with the real vocabulary', () => {
    const vocab = readJson('models/recipe_vocab.json').vocab;
    const logits = vocab.map(() => 0);
    const loud = vocab.map((n, i) => [n, i]).filter(([n]) => PACKAGED.includes(n) || HIDDEN.includes(n));
    expect(loud.length).toBeGreaterThan(20);
    for (const [, i] of loud) logits[i] = 100;
    const top = rankLogits(logits, vocab, [], 60).map((r) => r.name);
    none(top, 'rankLogits');
  });
});

describe('packaged ingredients stay findable and valid', () => {
  it('typing one finds it: the typeahead vocabulary keeps it and a search term is not rewritten', () => {
    const v = buildIngredientVocab([['cool whip', 'cream of mushroom soup', 'butter', 'cheesecloth', 'peache']]);
    expect(v).toEqual(expect.arrayContaining(['cool whip', 'cream of mushroom soup', 'butter']));
    expect(v).not.toContain('cheesecloth');
    expect(parseQuery('cool whip, butter')).toEqual(['cool whip', 'butter']);
  });
  it('typed text resolves to the packaged entry, which is in the curated dataset', () => {
    const names = new Set(Object.keys(loaded.ingredientsData));
    expect(resolveIngredientName('cool whip', names)).toBe('cool whip');
    expect(resolveIngredientName('cream of mushroom soup', names)).toBe('cream of mushroom soup');
  });
  it('a saved recipe containing one is stored and still opens as written', () => {
    const r = toSavedItem({
      kind: 'recipe', name: 'Green bean casserole', category: null,
      lines: [{ key: 'cream of mushroom soup', amount: '1 can' }, { key: 'green bean', amount: '1 lb' }],
    });
    expect(r.ok).toBe(true);
    expect(r.item.lines.map((l) => l.key)).toEqual(['cream of mushroom soup', 'green bean']);
    const names = new Set(Object.keys(loaded.ingredientsData));
    expect(r.item.lines.map((l) => resolveIngredientName(l.key, names))).toEqual(['cream of mushroom soup', 'green bean']);
  });
});
