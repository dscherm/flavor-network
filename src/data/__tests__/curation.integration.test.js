// DATA-2: the curation layer over the REAL data files and the REAL model vocabulary.
import { describe, it, expect, beforeAll, vi } from 'vitest';
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

// GATE-1: Two tests merge the full pairings.json (about 2.2 s each alone, 3.0 s in the full run).
// 5 s default leaves under 2x headroom when the machine is busy; 20 s still fails a real hang.
vi.setConfig({ testTimeout: 20000 });

const PUB = resolve(__dirname, '../../../public');
const read = (p) => readFileSync(resolve(PUB, p));
const readJson = (p) => JSON.parse(read(p).toString('utf8'));

const ALIASES = Object.entries(CURATION_TABLES.aliases).map(([variant, { to }]) => [variant, to]);
const HIDDEN = Object.keys(CURATION_TABLES.hidden);
const PACKAGED = Object.keys(CURATION_TABLES.packaged);
const ADDITIONS = Object.keys(CURATION_TABLES.additions);

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
  it('every variant, hidden and packaged name exists in the raw data; every alias target is real or an addition', () => {
    for (const name of [...ALIASES.map(([v]) => v), ...HIDDEN, ...PACKAGED]) expect(raw[name], name).toBeDefined();
    for (const [variant, to] of ALIASES) expect(raw[to] || CURATION_TABLES.additions[to], `${variant} -> ${to}`).toBeDefined();
  });
  it('no alias points at another alias, a hidden name, a packaged name or itself', () => {
    const variants = new Set(ALIASES.map(([v]) => v));
    for (const [variant, to] of ALIASES) {
      expect(variants.has(to), `${variant} -> ${to} is a chain`).toBe(false);
      expect(HIDDEN.includes(to) || PACKAGED.includes(to), `${variant} -> ${to}`).toBe(false);
      expect(to).not.toBe(variant);
    }
  });
  it('no name sits in two tables, and every entry carries a specific reason', () => {
    const all = [...ALIASES.map(([v]) => v), ...HIDDEN, ...PACKAGED];
    expect(new Set(all).size).toBe(all.length);
    const entries = [...Object.entries(CURATION_TABLES.aliases), ...Object.entries(CURATION_TABLES.hidden), ...Object.entries(CURATION_TABLES.packaged), ...Object.entries(CURATION_TABLES.additions)];
    for (const [name, e] of entries) {
      expect(typeof e.reason, name).toBe('string');
      expect(e.reason.length, name).toBeGreaterThan(15);
      expect(/^(duplicate|merge|alias|hidden|packaged)\.?$/i.test(e.reason.trim()), `${name}: generic reason`).toBe(false);
    }
  });
  // DATA-5: bottles and ingredients that built-in recipes use and the generated data lacks. They are not alias targets.
  const STANDALONE = new Set(['rye whiskey', 'cola', "peychaud's bitters", 'fernet branca', 'cynar', 'southern comfort', "pimm's", 'peach schnapps',
    'creme de cassis', 'suze', 'jagermeister', 'sloe gin', 'limoncello', 'aquavit', 'clove', 'tomatillo']);
  it('every addition is used (an alias points at it, or it is a listed standalone entry) and does not already exist', () => {
    for (const a of ADDITIONS) {
      expect(raw[a], a).toBeUndefined();
      expect(STANDALONE.has(a) || ALIASES.some(([, to]) => to === a), a).toBe(true);
    }
    for (const a of STANDALONE) expect(CURATION_TABLES.additions[a], a).toBeDefined();
  });
});

describe('the curated dataset', () => {
  it('loads from the packed binary and leaves no merged or hidden name as an ingredient', () => {
    expect(loaded.usedFormat).toBe('bin');
    for (const [variant] of ALIASES) expect(loaded.ingredientsData[variant], variant).toBeUndefined();
    for (const name of HIDDEN) expect(loaded.ingredientsData[name], name).toBeUndefined();
    expect(Object.keys(loaded.ingredientsData).length).toBe(Object.keys(raw).length - ALIASES.length - HIDDEN.length + ADDITIONS.length);
  });
  it('keeps packaged entries, flagged', () => {
    for (const name of PACKAGED) expect(loaded.ingredientsData[name].packaged).toBe(true);
  });
  it('folds a variant\'s counts into the canonical entry', () => {
    for (const [variant, to] of ALIASES) {
      const siblings = ALIASES.filter(([, t]) => t === to).reduce((n, [v]) => n + raw[v].totalCount, 0);
      expect(loaded.ingredientsData[to].totalCount, `${variant} -> ${to}`).toBe((raw[to]?.totalCount ?? 0) + siblings);
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
    const variantSet = new Set(ALIASES.map(([v]) => v));
    const hiddenSet = new Set(HIDDEN);
    const target = new Map(ALIASES);
    let checked = 0;
    for (const p of rawPairings) {
      const a = target.get(p.ingredientA) ?? p.ingredientA;
      const b = target.get(p.ingredientB) ?? p.ingredientB;
      if (a === b || hiddenSet.has(p.ingredientA) || hiddenSet.has(p.ingredientB) || !raw[p.ingredientA] || !raw[p.ingredientB]) continue;
      if (!(variantSet.has(p.ingredientA) || variantSet.has(p.ingredientB))) continue;
      expect(has(a, b), `${p.ingredientA} + ${p.ingredientB} -> ${a} + ${b}`).toBe(true);
      checked += 1;
    }
    expect(checked).toBeGreaterThan(5000);
  });
  it('is exactly what a build-time merge of pairings.json gives (the committed binary is in sync with the tables)', () => {
    const { pairings } = applyCuration(raw, rawPairings, CURATION_TABLES);
    const known = (n) => raw[n] || CURATION_TABLES.additions[n];
    const inIndex = pairings.filter((p) => known(p.ingredientA) && known(p.ingredientB));
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
    expect(isRetiredIngredient('cheesecloth')).toBe(true);
    expect(isRetiredIngredient('fryer')).toBe(true); // merged into chicken, so never offered as itself
    expect(resolveIngredient('fryer')).toBe('chicken');
    expect(resolveIngredient('Lemon juice freshly squeezed')).toBe('lemon juice');
    expect(resolveIngredient('lemons juice')).toBe('lemon juice');
    expect(isRetiredIngredient('juice from')).toBe(true);
    expect(isRetiredIngredient('peach')).toBe(false);
  });
  it('resolveIngredientName reads a variant as its canonical, on a curated and on a raw name set', () => {
    for (const [variant, to] of ALIASES) {
      expect(resolveIngredientName(variant, names()), variant).toBe(to);
      // The raw names still hold the variant. A canonical with its own row wins; a corrected canonical the
      // data has no row for ("grape tomato") falls back to the variant's row rather than losing the data.
      const got = resolveIngredientName(variant, new Set(Object.keys(raw)));
      if (raw[to]) expect(got, `${variant} (raw names)`).toBe(to);
      else expect(ALIASES.filter(([, t]) => t === to).map(([v]) => v), `${variant} (raw names)`).toContain(got);
    }
    expect(resolveIngredientName('grape tomato', new Set(Object.keys(raw)))).toBe('grape tomatoe');
    expect(resolveIngredientName('2 peaches', names())).toBe('peach');
  });
  it('search terms and the autocomplete vocabulary use the canonical name', () => {
    expect(parseQuery('peache, gin')).toEqual(['peach', 'gin']);
    expect(buildIngredientVocab([['peache', 'peach', 'cheesecloth', 'gin']])).toEqual(['gin', 'peach']);
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
  // Aliases whose canonical name has its own id in the model vocabulary, and those where only the variant has one.
  const BOTH = () => ALIASES.filter(([v, t]) => vocab.includes(v) && vocab.includes(t));
  const VARIANT_ONLY = () => ALIASES.filter(([v, t]) => vocab.includes(v) && !vocab.includes(t));
  it('real vocab still holds the old names (the premise of the mapping)', () => {
    for (const [variant] of ALIASES) expect(vocab, variant).toContain(variant);
    expect(BOTH().length).toBeGreaterThan(50);
    expect(VARIANT_ONLY().length).toBeGreaterThan(10);
  });
  it('set completion: canonical and variant names both get ids, and the canonical is fed together with its variant id', () => {
    const idx = buildVocabIndex(vocab);
    const meta = { maxlen: 24, pad_id: 0, cuisine_vocab: [], cuisine_null: 0, season_vocab: [], season_null: 0 };
    for (const [variant, to] of BOTH()) {
      expect(idOf(idx, to), to).toBe(vocab.indexOf(to));
      expect(idOf(idx, variant), variant).toBe(vocab.indexOf(to));
      const ids = buildRecipeInputs([to], {}, meta, idx).observedIds;
      expect(ids).toContain(vocab.indexOf(to));
      expect(ids).toContain(vocab.indexOf(variant));
      for (const id of ids) expect(typeof vocab[id]).toBe('string');
    }
    // A corrected canonical the vocabulary lacks ("grape tomato") is fed as its variant's id, never unknown.
    for (const [variant, to] of VARIANT_ONLY()) {
      const ids = ALIASES.filter(([v, t]) => t === to && vocab.includes(v)).map(([v]) => vocab.indexOf(v));
      expect(idOf(idx, to), to).toBe(Math.min(...ids));
      // Every variant's id is fed with the canonical (many-to-one merges keep all of their signal).
      expect(buildRecipeInputs([to], {}, meta, idx).observedIds, to).toEqual(expect.arrayContaining(ids));
    }
  });
  it('set completion never suggests a merged variant or a hidden name', () => {
    const logits = vocab.map(() => 0);
    for (const [variant] of ALIASES) logits[vocab.indexOf(variant)] = 100;
    for (const name of HIDDEN) if (vocab.includes(name)) logits[vocab.indexOf(name)] = 99;
    const top = rankLogits(logits, vocab, [], vocab.length).map((r) => r.name);
    for (const [variant] of ALIASES) expect(top).not.toContain(variant);
    for (const name of HIDDEN) expect(top).not.toContain(name);
    for (const name of PACKAGED) expect(top).not.toContain(name);
    // A variant whose canonical has no id of its own is shown under the canonical name, not dropped.
    for (const [, to] of VARIANT_ONLY()) expect(top, to).toContain(to);
  });
  it('quantity: a canonical name answers from the best-sampled of its own and its variant\'s statistics', () => {
    const artifact = readJson('models/quantity_model.json');
    const idx = quantityVocabIndex(vocab);
    for (const [variant, to] of BOTH()) {
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
    const peachIds = [vocab.indexOf('peach'), ...ALIASES.filter(([, t]) => t === 'peach').map(([v]) => vocab.indexOf(v)).filter((i) => i >= 0)];
    expect(resolveNamesToIds(['peach'], nameToId).sort()).toEqual(peachIds.sort());
    expect(idToName.get(vocab.indexOf('peache'))).toBe('peach');
    const index = {
      recipes: [{ t: 'Peach crumble', d: ['bake'], v: [vocab.indexOf('peache'), vocab.indexOf('flour'), vocab.indexOf('cheesecloth')] }],
      inv: { [vocab.indexOf('peache')]: [0], [vocab.indexOf('flour')]: [0], [vocab.indexOf('cheesecloth')]: [0] },
    };
    const found = retrieveDirections(['peach', 'flour'], index, vocab, { k: 1, minOverlap: 2 });
    expect(found).toHaveLength(1);
    expect(found[0].matchedNames).toEqual(expect.arrayContaining(['peach', 'flour']));
    expect(found[0].ingredients).not.toContain('cheesecloth');
    expect(found[0].ingredients).not.toContain('peache');
  });
});
