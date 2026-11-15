// DATA-2: the curation layer over the REAL data files and the REAL model vocabulary.
import { describe, it, expect, beforeAll } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { loadCuratedDataset } from '../curation/loadDataset.js';
import { applyCuration } from '../curation/applyCuration.js';
import { CURATION_TABLES } from '../curation/tables.js';
import { validateCuration, vocabulariesOf } from '../curation/validateCuration.js';
import { resolveIngredient, aliasTarget, isRetiredIngredient } from '../curation/resolveIngredient.js';
import { resolveIngredientName } from '../recipePairingMatch.js';
import { parseQuery, buildIngredientVocab } from '../ingredientSearch.js';
import { barKey, loadBar } from '../myBar.js';
import { kitchenKey, loadKitchen } from '../myKitchen.js';
import { toSavedItem } from '../inventSaved.js';
import { buildVocabIndex, buildRecipeInputs, rankLogits } from '../../ml/recipeRuntime.js';
import { buildVocabIndex as quantityVocabIndex, predictQuantity } from '../../ml/quantityModel.js';
import { buildVocabMaps, resolveNamesToIds, retrieveDirections } from '../../ml/directionsRuntime.js';

const PUB = resolve(__dirname, '../../../public');
const read = (p) => readFileSync(resolve(PUB, p));
const readJson = (p) => JSON.parse(read(p).toString('utf8'));

const ALIASES = Object.entries(CURATION_TABLES.aliases).map(([variant, { to }]) => [variant, to]);
const HIDDEN = Object.keys(CURATION_TABLES.hidden);
const PACKAGED = Object.keys(CURATION_TABLES.packaged);

const fetchFromDisk = async (url) => {
  const file = url.replace(/^\//, '');
  try {
    const buf = read(file);
    return {
      ok: true,
      json: async () => JSON.parse(buf.toString('utf8')),
      arrayBuffer: async () => buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength),
    };
  } catch { return { ok: false }; }
};

let raw; let rawPairings; let loaded; let vocab;
beforeAll(async () => {
  raw = readJson('proDataset/ingredients.json');
  rawPairings = readJson('proDataset/pairings.json');
  loaded = await loadCuratedDataset(fetchFromDisk);
  vocab = readJson('models/recipe_vocab.json').vocab;
}, 60000);

describe('the tables against the real data', () => {
  it('are valid', () => {
    const names = new Set(Object.keys(raw).filter((k) => !k.startsWith('_')));
    expect(validateCuration(CURATION_TABLES, { ingredientNames: names, ...vocabulariesOf(raw) })).toEqual([]);
  });
  it('seed ten entries that all name something in the raw data', () => {
    expect(ALIASES.length + HIDDEN.length + PACKAGED.length).toBe(10);
    for (const name of [...ALIASES.flat(), ...HIDDEN, ...PACKAGED]) expect(raw[name], name).toBeDefined();
  });
});

describe('the curated dataset', () => {
  it('loads from the packed binary and leaves no merged or hidden name as an ingredient', () => {
    expect(loaded.usedFormat).toBe('bin');
    for (const [variant] of ALIASES) expect(loaded.ingredientsData[variant], variant).toBeUndefined();
    for (const name of HIDDEN) expect(loaded.ingredientsData[name], name).toBeUndefined();
    expect(Object.keys(loaded.ingredientsData).length).toBe(Object.keys(raw).length - ALIASES.length - HIDDEN.length);
  });
  it('keeps packaged entries, flagged', () => {
    for (const name of PACKAGED) expect(loaded.ingredientsData[name].packaged).toBe(true);
  });
  it('folds a variant\'s counts into the canonical entry', () => {
    for (const [variant, to] of ALIASES) {
      expect(loaded.ingredientsData[to].totalCount).toBe(raw[to].totalCount + raw[variant].totalCount);
    }
  });
  it('has no pairing that touches a merged or hidden name, nor a self-pair', () => {
    const gone = new Set([...ALIASES.map(([v]) => v), ...HIDDEN]);
    for (const p of loaded.pairingsData) {
      expect(gone.has(p.ingredientA) || gone.has(p.ingredientB)).toBe(false);
      expect(p.ingredientA).not.toBe(p.ingredientB);
    }
  });
  it('puts every merged variant\'s pairings on the canonical entry', () => {
    const edges = new Set(loaded.pairingsData.map((p) => `${p.ingredientA}|${p.ingredientB}`));
    const has = (a, b) => edges.has(`${a}|${b}`) || edges.has(`${b}|${a}`);
    for (const [variant, to] of ALIASES) {
      let checked = 0;
      for (const p of rawPairings) {
        const other = p.ingredientA === variant ? p.ingredientB : p.ingredientB === variant ? p.ingredientA : null;
        if (!other || other === to || HIDDEN.includes(other) || !raw[other]) continue;
        if (ALIASES.some(([v]) => v === other)) continue;
        expect(has(to, other), `${variant} -> ${to}: ${other}`).toBe(true);
        checked += 1;
      }
      expect(checked, variant).toBeGreaterThan(20);
    }
  });
  it('is exactly what a build-time merge of pairings.json gives (the committed binary is in sync with the tables)', () => {
    const { pairings } = applyCuration(raw, rawPairings, CURATION_TABLES);
    const inIndex = pairings.filter((p) => raw[p.ingredientA] && raw[p.ingredientB]);
    expect(loaded.pairingsData.length).toBe(inIndex.length);
    const key = (p) => (p.ingredientA < p.ingredientB ? `${p.ingredientA}|${p.ingredientB}` : `${p.ingredientB}|${p.ingredientA}`);
    const binByKey = new Map(loaded.pairingsData.map((p) => [key(p), p]));
    for (const p of inIndex) {
      const b = binByKey.get(key(p));
      expect(b, key(p)).toBeDefined();
      expect(b.strength).toBeCloseTo(p.strength, 5);
    }
  });
  it('merges at load too when the binary is unavailable (JSON fallback)', async () => {
    const noBin = async (url) => (url.endsWith('.bin') ? { ok: false } : fetchFromDisk(url));
    const viaJson = await loadCuratedDataset(noBin);
    expect(viaJson.usedFormat).toBe('json');
    expect(viaJson.pairingsData.length).toBe(applyCuration(raw, rawPairings, CURATION_TABLES).pairings.length);
    expect(viaJson.ingredientsData.peache).toBeUndefined();
  }, 60000);
});

describe('typed names, search, typeaheads and keys land on the canonical entry', () => {
  const names = () => new Set(Object.keys(loaded.ingredientsData));

  it('resolveIngredient maps variants and normalises', () => {
    expect(resolveIngredient('peache')).toBe('peach');
    expect(resolveIngredient('  Peache ')).toBe('peach');
    expect(resolveIngredient('Lean  Beef')).toBe('beef');
    expect(resolveIngredient('basil')).toBe('basil');
    expect(aliasTarget('basil')).toBeNull();
    expect(isRetiredIngredient('fryer')).toBe(true);
    expect(isRetiredIngredient('peach')).toBe(false);
  });
  it('resolveIngredientName reads a variant as its canonical, on a curated and on a raw name set', () => {
    for (const [variant, to] of ALIASES) {
      expect(resolveIngredientName(variant, names()), variant).toBe(to);
      expect(resolveIngredientName(variant, new Set(Object.keys(raw))), `${variant} (raw names)`).toBe(to);
    }
    expect(resolveIngredientName('2 peaches', names())).toBe('peach');
  });
  it('search terms and the autocomplete vocabulary use the canonical name', () => {
    expect(parseQuery('peache, gin')).toEqual(['peach', 'gin']);
    expect(buildIngredientVocab([['peache', 'peach', 'fryer', 'gin']])).toEqual(['gin', 'peach']);
  });
  it('barKey and kitchenKey store the canonical, with or without the graph names', () => {
    expect(barKey('green chilie', names())).toBe('green chili');
    expect(barKey('green chilie')).toBe('green chili');
    expect(kitchenKey('red potatoe', names())).toBe('red potato');
    expect(kitchenKey('red potatoe')).toBe('red potato');
  });
  it('a bar or kitchen saved before the merge reads back on the canonical key', () => {
    const store = (v) => ({ getItem: () => JSON.stringify(v) });
    expect(loadKitchen(store(['peache', 'basil']))).toEqual(['peach', 'basil']);
    expect(loadBar(store(['lean beef']))).toEqual(['beef']);
  });
});

describe('saved items keep their original text', () => {
  it('a saved recipe naming a merged ingredient is stored and shown as written, and matches on the canonical', () => {
    const r = toSavedItem({
      kind: 'recipe', name: 'Peach salad', category: null,
      lines: [{ key: 'peache', amount: '2' }, { key: 'cheesecloth', amount: '' }, { key: 'basil', amount: '1 bunch' }],
    });
    expect(r.ok).toBe(true);
    expect(r.item.lines.map((l) => l.key)).toEqual(['peache', 'cheesecloth', 'basil']);
    const names = new Set(Object.keys(loaded.ingredientsData));
    expect(r.item.lines.map((l) => resolveIngredientName(l.key, names))).toEqual(['peach', null, 'basil']);
  });
});

describe('the models stay on their own vocabulary', () => {
  const idOf = (index, name) => index.get(name);
  it('real vocab still holds the old names (the premise of the mapping)', () => {
    for (const [variant, to] of ALIASES) { expect(vocab).toContain(variant); expect(vocab).toContain(to); }
  });
  it('set completion: canonical and variant names both get ids, and the canonical is fed together with its variant id', () => {
    const idx = buildVocabIndex(vocab);
    const meta = { maxlen: 24, pad_id: 0, cuisine_vocab: [], cuisine_null: 0, season_vocab: [], season_null: 0 };
    for (const [variant, to] of ALIASES) {
      expect(idOf(idx, to), to).toBe(vocab.indexOf(to));
      expect(idOf(idx, variant), variant).toBe(vocab.indexOf(to));
      const ids = buildRecipeInputs([to], {}, meta, idx).observedIds;
      expect(ids).toContain(vocab.indexOf(to));
      expect(ids).toContain(vocab.indexOf(variant));
      for (const id of ids) expect(typeof vocab[id]).toBe('string');
    }
  });
  it('set completion never suggests a merged variant or a hidden name', () => {
    const logits = vocab.map(() => 0);
    for (const [variant] of ALIASES) logits[vocab.indexOf(variant)] = 100;
    for (const name of HIDDEN) logits[vocab.indexOf(name)] = 99;
    const top = rankLogits(logits, vocab, [], vocab.length).map((r) => r.name);
    for (const [variant] of ALIASES) expect(top).not.toContain(variant);
    for (const name of HIDDEN) expect(top).not.toContain(name);
    expect(top.length).toBe(vocab.length - ALIASES.length - HIDDEN.length);
  });
  it('quantity: a canonical name answers from the best-sampled of its own and its variant\'s statistics', () => {
    const artifact = readJson('models/quantity_model.json');
    const idx = quantityVocabIndex(vocab);
    for (const [variant, to] of ALIASES) {
      const own = artifact.model?.[vocab.indexOf(to)];
      const alt = artifact.model?.[vocab.indexOf(variant)];
      const best = (alt?.n ?? 0) > (own?.n ?? 0) ? alt : own;
      const got = predictQuantity(to, { artifact, vocabIndex: idx });
      expect(got, to).not.toBeNull();
      if (best && best.n >= (artifact._meta?.minSamples ?? 5)) expect(got.source).toBe('model');
      expect(predictQuantity(variant, { artifact, vocabIndex: idx })).toEqual(got);
    }
  });
  it('directions: canonical names resolve to the vocab ids and recipes written with the variant spelling are found', () => {
    const { nameToId, idToName } = buildVocabMaps(vocab);
    expect(resolveNamesToIds(['peach'], nameToId).sort()).toEqual([vocab.indexOf('peach'), vocab.indexOf('peache')].sort());
    expect(idToName.get(vocab.indexOf('peache'))).toBe('peach');
    const index = {
      recipes: [{ t: 'Peach crumble', d: ['bake'], v: [vocab.indexOf('peache'), vocab.indexOf('flour'), vocab.indexOf('fryer')] }],
      inv: { [vocab.indexOf('peache')]: [0], [vocab.indexOf('flour')]: [0], [vocab.indexOf('fryer')]: [0] },
    };
    const found = retrieveDirections(['peach', 'flour'], index, vocab, { k: 1, minOverlap: 2 });
    expect(found).toHaveLength(1);
    expect(found[0].matchedNames).toEqual(expect.arrayContaining(['peach', 'flour']));
    expect(found[0].ingredients).not.toContain('fryer');
    expect(found[0].ingredients).not.toContain('peache');
  });
});
