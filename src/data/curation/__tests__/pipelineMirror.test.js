// The curation tables are mirrored into the pipeline's inputs (proDataset/data) so a future rebuild agrees
// with the app. This test fails when the two drift. It proves the inputs carry the same entries and that the
// pipeline's own apply function gives the same answer as the app's on the real data; it does NOT run the
// pipeline (the full rebuild is deliberately not done: see BACKLOG.md).
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadCurationTables } from '../../../../scripts/lib/curationTables.mjs';
import { applyCuration } from '../applyCuration.js';
import {
  MIRRORED_TABLES, buildCurationMirror, mirrorSynonyms, mirrorDrift, synonymRewrites,
} from '../../../../scripts/lib/curationMirror.mjs';
import { curateMaster, hiddenNames, loadCuration } from '../../../../proDataset/curation.js';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../../../..');
const readJson = (rel) => JSON.parse(readFileSync(resolve(ROOT, rel), 'utf8'));
const tables = loadCurationTables();
const curationJson = readJson('proDataset/data/curation.json');
const synonyms = readJson('proDataset/data/synonyms.json');

describe('pipeline inputs mirror the app curation tables', () => {
  it('has no drift', () => {
    expect(mirrorDrift(tables, curationJson, synonyms)).toEqual([]);
  });

  it('curation.json carries every mirrored table entry for entry', () => {
    for (const name of MIRRORED_TABLES) expect(curationJson[name], name).toEqual(tables[name]);
    expect(curationJson).toEqual(buildCurationMirror(tables));
  });

  it('every alias is a synonym with the same target, and no synonym points at an alias', () => {
    for (const [variant, { to }] of Object.entries(tables.aliases)) expect(synonyms[variant], variant).toBe(to);
    for (const [k, v] of Object.entries(synonyms)) {
      if (k.startsWith('_')) continue;
      expect(v in tables.aliases, `${k} -> ${v}`).toBe(false);
    }
  });

  it('no canonical the curation relies on is folded into something else by the synonym map', () => {
    const relied = [...Object.values(tables.aliases).map((a) => a.to), ...Object.keys(tables.additions)];
    for (const name of relied) {
      if (name in tables.aliases) continue;
      if (name in synonyms) expect(synonyms[name], name).toBe(name);
    }
  });

  it('keeps the existing synonym entries: the comment, and only the known re-pointed ones changed', () => {
    expect(synonyms._comment).toMatch(/Maps variant ingredient names/);
    expect(synonyms['garlic clove']).toBe('garlic');
    expect(synonyms['allium cepa']).toBe('onion');
    const n = Object.keys(synonyms).filter((k) => !k.startsWith('_')).length;
    expect(n).toBeGreaterThanOrEqual(524);
    // the 12 existing entries the curation contradicted, re-pointed on purpose (see docs/data-quality.md)
    const repointed = {
      'roma tomato': 'roma tomato', pepper: 'pepper', 'chicken breast': 'chicken breast', capers: 'caper',
      'rye whiskey': 'rye whiskey', 'udon noodle': 'udon noodle', candlenut: 'candlenut', kemiri: 'candlenut',
      'jalapeno chilie': 'jalapeno chili', 'freshly- black pepper': 'black pepper', 'jalapeno chili': 'jalapeno chili',
      'mashed sweet potatoe': 'sweet potato',
    };
    for (const [k, v] of Object.entries(repointed)) expect(synonyms[k], k).toBe(v);
  });

  it('the synonym merge is idempotent and reports what it re-pointed', () => {
    const again = mirrorSynonyms(synonyms, tables);
    expect(again).toEqual(synonyms);
    const old = { a: 'b', 'b': 'c', cc: 'c' };
    const t = { aliases: { b: { to: 'c', reason: 'x' } }, additions: {} };
    const merged = mirrorSynonyms(old, t);
    expect(merged).toEqual({ a: 'c', b: 'c', cc: 'c' });
    expect(synonymRewrites(old, merged)).toEqual([{ key: 'a', was: 'b', now: 'c' }]);
  });
});

describe('the drift check fails on a deliberate change', () => {
  const clone = (o) => JSON.parse(JSON.stringify(o));

  it('a changed taste override', () => {
    const t = clone(tables);
    const name = Object.keys(t.tasteOverrides)[0];
    t.tasteOverrides[name].taste = 'sour';
    const problems = mirrorDrift(t, curationJson, synonyms);
    expect(problems.length).toBeGreaterThan(0);
    expect(problems.join()).toMatch(/tasteOverrides/);
  });

  it('a new hidden name, a new packaged name, a new addition, a changed category', () => {
    for (const [table, entry] of [
      ['hidden', { reason: 'x' }], ['packaged', { reason: 'x' }], ['additions', { category: 'spice', taste: 'sweet', reason: 'x' }],
    ]) {
      const t = clone(tables);
      t[table]['zz drift probe'] = entry;
      expect(mirrorDrift(t, curationJson, synonyms).join(), table).toMatch(new RegExp(table));
    }
    const t = clone(tables);
    const name = Object.keys(t.categoryOverrides)[0];
    t.categoryOverrides[name].category = 'zzz';
    expect(mirrorDrift(t, curationJson, synonyms).join()).toMatch(/categoryOverrides/);
  });

  it('a changed or new alias, and a synonym that folds a canonical away', () => {
    const t = clone(tables);
    const variant = Object.keys(t.aliases)[0];
    t.aliases[variant].to = 'zz other';
    expect(mirrorDrift(t, curationJson, synonyms).join()).toContain(variant);

    const t2 = clone(tables);
    t2.aliases['zz drift probe'] = { to: 'salt', reason: 'x' };
    expect(mirrorDrift(t2, curationJson, synonyms).join()).toContain('zz drift probe');

    const bad = { ...synonyms, 'chicken breast': 'chicken' };
    expect(mirrorDrift(tables, curationJson, bad).join()).toContain('chicken breast');
  });
});

describe('the pipeline applies the curation the way the app does', () => {
  const raw = readJson('public/proDataset/ingredients.json');
  const asMap = (obj) => new Map(Object.entries(obj).filter(([k]) => !k.startsWith('_')).map(([k, v]) => [k, { ...v }]));
  const { aliases, ...noAliases } = tables;

  it('curateMaster on the real ingredients equals applyCuration without the aliases', () => {
    const master = asMap(raw);
    const removed = curateMaster(master, curationJson);
    const app = applyCuration(raw, null, noAliases).ingredients;
    const appNames = Object.keys(app).filter((k) => !k.startsWith('_'));
    expect([...master.keys()].sort()).toEqual(appNames.sort());
    for (const name of appNames) expect(master.get(name), name).toEqual(app[name]);
    expect([...removed].sort()).toEqual(Object.keys(tables.hidden).filter((h) => h in raw).sort());
  });

  it('a tiny fixture: addition, hidden, packaged, rename, category and taste overrides', () => {
    const t = {
      hidden: { cheesecloth: { reason: 'x' } },
      packaged: { 'cake mix': { reason: 'x' } },
      categoryRenames: { umami: { to: 'savory seasoning', reason: 'x' } },
      categoryOverrides: { 'apple juice': { category: 'juice', reason: 'x' } },
      tasteOverrides: { flour: { taste: 'neutral', reason: 'x' } },
      additions: { 'rye whiskey': { category: 'spirit', taste: 'bitter', reason: 'x' } },
    };
    const fixture = {
      cheesecloth: { category: 'other', taste: 'pungent', sources: ['recipenlg'], totalCount: 3 },
      'cake mix': { category: 'baked', taste: 'sweet', sources: ['recipenlg'], totalCount: 5 },
      'fish sauce': { category: 'umami', taste: 'salty bitter', sources: ['recipenlg'], totalCount: 7 },
      'apple juice': { category: 'liquid', taste: 'sweet sour', sources: ['recipenlg'], totalCount: 9 },
      flour: { category: 'thickener', taste: 'sweet', sources: ['recipenlg'], totalCount: 11 },
    };
    const master = asMap(fixture);
    const removed = curateMaster(master, t);
    expect([...removed]).toEqual(['cheesecloth']);
    expect(Object.fromEntries(master)).toEqual(applyCuration(fixture, null, t).ingredients);
    expect(master.get('rye whiskey')).toEqual({ category: 'spirit', taste: 'bitter', sources: ['curation'], totalCount: 0 });
    expect(master.get('fish sauce').category).toBe('savory seasoning');
    expect(master.get('cake mix').packaged).toBe(true);
    expect(hiddenNames(t)).toEqual(new Set(['cheesecloth']));
    expect(loadCuration('/no/such/dir')).toEqual({});
  });

  it('the three pipeline steps are wired to it', () => {
    const src = (f) => readFileSync(resolve(ROOT, 'proDataset/scripts', f), 'utf8');
    expect(src('05-blend.js')).toMatch(/curateMaster\(masterIngredients, loadCuration\(\)\)/);
    expect(src('07-blend-v2.js')).toMatch(/curateMaster\(masterIngredients, loadCuration\(\)\)/);
    expect(src('01-parse-recipenlg.js')).toMatch(/hiddenNames\(loadCuration\(\)\)/);
    expect(src('01-parse-recipenlg.js')).toMatch(/!HIDDEN_SET\.has\(n\)/);
  });
});
