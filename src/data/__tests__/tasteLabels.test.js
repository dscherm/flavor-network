// DATA-5: the taste vocabulary gains 'neutral' and 'rich'; labels are corrected through tasteOverrides.json;
// every reader of the taste field copes with the two new words.
import { describe, it, expect, beforeAll } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { applyCuration } from '../curation/applyCuration.js';
import { CURATION_TABLES } from '../curation/tables.js';
import { validateCuration, vocabulariesOf } from '../curation/validateCuration.js';
import { findTasteNeutralSweet, findTasteVocabulary, TASTE_VOCAB } from '../dataAudit.js';
import { TASTE_COLORS, colorForTaste, TASTE_WORD_NOTES } from '../../utils/color.js';
import { TASTE_HEX } from '../../components/livingArchConstants.js';
import { BRISCIONE_TASTE } from '../briscionePalette.js';
import { CATEGORY_TO_TASTE } from '../../hooks/useProData.js';
import { tasteMatches, getColorForNode } from '../../three/NodeMesh.js';
import { scoreIngredient } from '../tastePositioning.js';
import { aggregateRecipeTastes } from '../tasteScoring.js';
import { computeDominantTaste, rankAddByTaste } from '../addModeBucketing.js';
import { scoreRecipe } from '../recipeScoring.js';
import { resolveIngredientName } from '../recipePairingMatch.js';
import { barKey, isBooze, barKeyLists } from '../myBar.js';
import { TASTE_WORDS, TASTE_EXAMPLES, TASTE_RULES } from '../tasteScheme.js';
import { loadCuratedDataset } from '../curation/loadDataset.js';
import { buildPairingIndex } from '../recipePairingMatch.js';
import { rankByRecipeCooccurrence } from '../recipeSuggestionEngine.js';

const PUB = resolve(__dirname, '../../../public');
const readJson = (p) => JSON.parse(readFileSync(resolve(PUB, p), 'utf8'));
const HEX = /^#[0-9a-f]{6}$/i;

let raw; let cur;
beforeAll(() => {
  raw = readJson('proDataset/ingredients.json');
  cur = applyCuration(raw, null, CURATION_TABLES).ingredients;
}, 60000);

describe('the vocabulary and the labelling rules', () => {
  it('declares neutral and rich, each with a reason', () => {
    for (const w of ['neutral', 'rich']) {
      expect(CURATION_TABLES.vocabulary.tastes[w].reason.length).toBeGreaterThan(20);
      expect(TASTE_VOCAB).toContain(w);
    }
  });
  it('every taste word in the curated data is in the vocabulary, and the tables validate', () => {
    expect(findTasteVocabulary(cur)).toEqual([]);
    const names = new Set(Object.keys(raw).filter((k) => !k.startsWith('_')));
    expect(validateCuration(CURATION_TABLES, { ingredientNames: names, ...vocabulariesOf(raw) })).toEqual([]);
  });
  it('neutral stands alone in every label', () => {
    for (const [name, e] of Object.entries(cur)) {
      if (name.startsWith('_')) continue;
      const words = String(e.taste).split(/\s+/);
      if (words.includes('neutral')) expect(words, name).toEqual(['neutral']);
    }
  });
  it('no starch, plain fat, water or neutral spirit is labelled sweet', () => {
    expect(findTasteNeutralSweet(cur)).toEqual([]);
  });
  it('every override carries a specific reason that names what is wrong or why it is right', () => {
    for (const [name, o] of Object.entries(CURATION_TABLES.tasteOverrides)) {
      expect(o.reason.length, name).toBeGreaterThan(25);
      expect(o.taste.trim().split(/\s+/).length, name).toBeLessThanOrEqual(3);
    }
  });
  it('the high-use and bar ingredients read as a cook would say', () => {
    const label = (n) => cur[n].taste;
    expect(label('flour')).toBe('neutral');
    expect(label('rice')).toBe('neutral');
    expect(label('pasta')).toBe('neutral');
    expect(label('bread')).toBe('neutral');
    expect(label('cornstarch')).toBe('neutral');
    expect(label('water')).toBe('neutral');
    expect(label('soda water')).toBe('neutral');
    expect(label('vodka')).toBe('neutral');
    expect(label('butter')).toBe('rich');
    expect(label('olive oil')).toBe('rich');
    expect(label('salad oil')).toBe('rich');
    expect(label('cream').split(' ')[0]).toBe('rich');
    expect(label('egg').split(' ')[0]).toBe('rich');
    expect(label('sugar')).toBe('sweet');
    expect(label('lemon juice')).toBe('sour');
    expect(label('gin').split(' ')[0]).toBe('bitter');
    expect(label('bourbon')).toBe('sweet');
    expect(label('campari').split(' ')[0]).toBe('bitter');
  });
  it('no spirit is labelled pungent or spicy (those feed heat)', () => {
    for (const [name, e] of Object.entries(cur)) {
      if (e.category === 'spirit' && !/pepper|peppar|chili|chile|jalape|habanero|hot/.test(name)) {
        expect(e.taste, name).not.toMatch(/pungent|spicy/);
      }
    }
  });
});

describe('the added bar entries', () => {
  const ADDED = ['rye whiskey', 'cola', "peychaud's bitters", 'fernet branca', 'cynar', 'southern comfort', "pimm's",
    'peach schnapps', 'creme de cassis', 'suze', 'jagermeister', 'sloe gin', 'limoncello', 'aquavit', 'clove', 'tomatillo'];
  it('each has a category, a taste and a reason, and is in the curated data', () => {
    for (const n of ADDED) {
      const a = CURATION_TABLES.additions[n];
      expect(a, n).toBeDefined();
      expect(a.reason.length).toBeGreaterThan(20);
      expect(cur[n], n).toBeDefined();
      expect(cur[n].taste).toBe(a.taste);
    }
  });
  it('resolve to themselves, key the bar by their own name and are booze where they are bottles', () => {
    const names = new Set(Object.keys(cur));
    for (const [typed, key] of [['Rye whiskey', 'rye whiskey'], ["Peychaud's bitters", "peychaud's bitters"], ['Fernet-Branca', 'fernet branca'],
      ['Cynar', 'cynar'], ['Southern Comfort', 'southern comfort'], ["Pimm's", "pimm's"], ['Peach schnapps', 'peach schnapps'],
      ['Creme de cassis', 'creme de cassis'], ['Suze', 'suze'], ['Jagermeister', 'jagermeister'], ['Sloe gin', 'sloe gin'], ['Limoncello', 'limoncello'], ['Aquavit', 'aquavit']]) {
      expect(resolveIngredientName(typed, names), typed).toBe(key);
      expect(barKey(typed, names), typed).toBe(key);
      expect(isBooze(key), key).toBe(true);
    }
    expect(resolveIngredientName('cloves', names)).toBe('clove');
    expect(resolveIngredientName('Tomatillo', names)).toBe('tomatillo');
    expect(barKey('cola', names)).toBe('cola');
    expect(isBooze('cola')).toBe(false);
  });
  it('rye whiskey and peychaud\'s bitters appear in the My bar typeahead (the keys of the built-in cocktails)', () => {
    const names = new Set(Object.keys(cur));
    const codex = readJson('data/cocktail_codex_v2.json');
    const roles = readJson('data/cocktail_roles.json').byIngredient;
    const vocab = new Set(barKeyLists(codex.cocktails, roles, names).flat());
    for (const k of ['rye whiskey', "peychaud's bitters"]) expect(vocab.has(k), k).toBe(true);
  });
  it('a new ingredient with no pairings does not break suggestions or the pairing index', async () => {
    const fetchFromDisk = async (url) => {
      const buf = readFileSync(resolve(PUB, url.replace(/^\//, '')));
      return { ok: true, json: async () => JSON.parse(buf.toString('utf8')), arrayBuffer: async () => buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) };
    };
    const loaded = await loadCuratedDataset(fetchFromDisk);
    const partners = loaded.pairingsData.filter((p) => ADDED.includes(p.ingredientA) || ADDED.includes(p.ingredientB));
    const withNone = ADDED.filter((n) => !partners.some((p) => p.ingredientA === n || p.ingredientB === n));
    expect(withNone.length).toBeGreaterThan(0);
    const names = new Set(Object.keys(loaded.ingredientsData));
    const index = buildPairingIndex(loaded.pairingsData, names);
    for (const n of withNone) {
      expect(names.has(n), n).toBe(true);
      const ranked = rankByRecipeCooccurrence([n, 'gin'], {}, {}, 10);
      expect(Array.isArray(ranked)).toBe(true);
    }
    const nodes = new Map(Object.entries(loaded.ingredientsData).map(([name, e]) => [name, { name, taste: e.taste }]));
    expect(() => rankAddByTaste(withNone, {}, {}, nodes)).not.toThrow();
    expect(() => scoreRecipe(withNone.map((n) => ({ name: n, taste: nodes.get(n).taste })))).not.toThrow();
  }, 60000);
});

describe('every reader of the taste field copes with neutral and rich', () => {
  it('colours: neutral and rich have a defined colour that is not the default, and a taste word wins in a mixed label', () => {
    for (const w of ['neutral', 'rich']) {
      expect(TASTE_COLORS[w]).toMatch(HEX);
      expect(TASTE_COLORS[w]).not.toBe(TASTE_COLORS.default);
      expect(colorForTaste(w)).toBe(TASTE_COLORS[w]);
      expect(TASTE_HEX[w]).toMatch(HEX);
      expect(BRISCIONE_TASTE[w]).toMatch(HEX);
    }
    expect(colorForTaste('rich sweet')).toBe(TASTE_COLORS.sweet);
    expect(colorForTaste('sweet rich')).toBe(TASTE_COLORS.sweet);
    expect(colorForTaste('rich umami')).toBe(TASTE_COLORS.umami);
  });
  it('colours: every word of the vocabulary and every word in the data has a colour; an unknown word falls back without throwing', () => {
    for (const w of TASTE_VOCAB) expect(colorForTaste(w), w).toMatch(HEX);
    const seen = new Set();
    for (const [name, e] of Object.entries(cur)) if (!name.startsWith('_')) for (const w of String(e.taste).split(/\s+/)) seen.add(w);
    for (const w of seen) expect(colorForTaste(w), w).toMatch(HEX);
    expect(colorForTaste('zzz unknown')).toBe(TASTE_COLORS.default);
    expect(colorForTaste('')).toBe(TASTE_COLORS.default);
    expect(colorForTaste(undefined)).toBe(TASTE_COLORS.default);
  });
  it('the legend explains both words', () => {
    for (const w of ['neutral', 'rich']) expect(TASTE_WORD_NOTES[w]).toMatch(new RegExp(`^${w}:`));
  });
  it('the 3D node colour handles a node whose only label is neutral, rich, or unknown', () => {
    for (const taste of ['neutral', 'rich', 'rich sweet', 'zzz']) {
      const c = getColorForNode({ taste, cuisines: [] });
      expect(typeof c.r).toBe('number');
      expect(Number.isNaN(c.r)).toBe(false);
    }
    const neutral = getColorForNode({ taste: 'neutral', cuisines: [] });
    const unknown = getColorForNode({ taste: 'zzz', cuisines: [] });
    expect(neutral.getHexString()).not.toBe(unknown.getHexString());
  });
  it('taste filters do not crash and do not match the new words by accident', () => {
    for (const filter of ['sweet', 'sour', 'bitter', 'salty', 'umami', 'spicy', 'pungent', 'astringent', 'hot']) {
      expect(tasteMatches('neutral', filter), filter).toBe(false);
      expect(tasteMatches('rich', filter), filter).toBe(false);
    }
    expect(tasteMatches('rich sweet', 'sweet')).toBe(true);
    expect(tasteMatches('neutral', 'neutral')).toBe(true);
    expect(tasteMatches(null, 'sweet')).toBe(false);
  });
  it('taste scoring gives zero channels, not NaN, for neutral and rich', () => {
    for (const taste of ['neutral', 'rich']) {
      const { channels } = scoreIngredient('zzzfoo', { taste });
      for (const v of Object.values(channels)) expect(v).toBe(0);
      expect(computeDominantTaste('zzzfoo', { taste })).toBeNull();
    }
    const nodes = new Map([['a', { taste: 'neutral' }], ['b', { taste: 'rich' }], ['c', { taste: 'rich sweet' }]]);
    const agg = aggregateRecipeTastes(['a', 'b', 'c'], nodes);
    for (const v of [...Object.values(agg.totals), ...Object.values(agg.normalized)]) expect(Number.isNaN(v)).toBe(false);
    expect(agg.totals.sweet).toBeGreaterThan(0);
  });
  it('recipe scoring from labels alone is finite for neutral and rich ingredients', () => {
    const r = scoreRecipe([{ name: 'flour', taste: 'neutral' }, { name: 'butter', taste: 'rich' }]);
    for (const v of r.profile) expect(Number.isFinite(v)).toBe(true);
    expect(Number.isFinite(r.balance)).toBe(true);
  });
  it('the category fallback taste only uses words in the vocabulary', () => {
    for (const [cat, t] of Object.entries(CATEGORY_TO_TASTE)) for (const w of t.split(/\s+/)) expect(TASTE_VOCAB, `${cat}: ${t}`).toContain(w);
  });
});

describe('the written scheme (docs/data-quality.md is generated from it)', () => {
  it('names exactly the ten vocabulary words, in the vocabulary order', () => {
    expect(TASTE_WORDS.map((w) => w.word)).toEqual(TASTE_VOCAB);
    expect(TASTE_RULES.length).toBeGreaterThan(4);
  });
  it('every example for a word leads with that word in the data', () => {
    for (const w of TASTE_WORDS) for (const ex of w.examples) expect(cur[ex], ex).toBeDefined();
    for (const w of TASTE_WORDS) for (const ex of w.examples) expect(cur[ex].taste.split(' ')[0], `${w.word}: ${ex}`).toBe(w.word);
  });
  it('every worked example matches the curated label exactly', () => {
    for (const e of TASTE_EXAMPLES) expect(cur[e.name].taste, e.name).toBe(e.label);
  });
});
