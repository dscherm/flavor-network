// DATA-6: the cocktail correction layer. Pure behaviour on a small stub, then the real table on the real generated codex,
// then a guard that nothing reads the raw codex around the layer.
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { applyCocktailCuration, validateCocktailCuration } from '../applyCocktailCuration.js';
import { curateCodexRaw } from '../../cocktailCodexV2.js';
import { cocktailChecks, isCreamOrEggDrink } from '../../dataAudit.js';
import { readRawCodex, readCuratedCodex } from '../../../../scripts/lib/curatedCodex.mjs';
import TABLE from '../cocktailOverrides.json' with { type: 'json' };

const drink = (name, family_id, subcluster_id, lines, extra = {}) => ({
  name, canonical: name.toLowerCase(), family_id, subcluster_id, is_root: false, ingredients_raw: lines.map((raw) => ({ raw })),
  recipe_text: [...lines, 'Garnish: a twist'].join('\n'), ...extra,
});
const stub = () => ({
  _meta: {},
  families: [{ id: 0, name: 'Sours', color: '#111', signature: { size: 0 } }],
  subclusters: [{ id: '0.0', family_id: 0, size: 0, exemplars: [] }],
  cocktails: [drink('A', 0, '0.0', ['Gin', 'Lime']), drink('A', 0, '0.0', ['Gin', 'Lime']), drink('B', 0, '0.0', ['Rum']), drink('C', 0, '0.0', ['Vodka', 'Cream'])],
});
const table = {
  families: [{ id: 1, name: 'Creamy', blurb: 'rich', color: '#222', cultural_root: 'C', reason: 'x' }],
  subgroups: { '0.0': { name: 'Plain' }, '1.0': { family_id: 1, name: 'Cream', exemplars: ['C'], reason: 'x' } },
  dedupe: { a: 'twice' },
  remove: { b: { reason: 'same as A', slug: 'b', slugTo: 'a' } },
  moves: { c: { family_id: 1, subcluster_id: '1.0', reason: 'cream' } },
  fixes: { a: { lines: ['30 ml Gin', '15 ml Lime'], source: 'test', reason: 'amounts' } },
  add: [drink('D', 0, '0.0', ['1 oz Tequila'], { source: 'test' })],
};

describe('applyCocktailCuration (stub)', () => {
  const out = applyCocktailCuration(stub(), table);
  it('drops the second copy of a duplicate, removes a merged drink, adds a new one, moves one', () => {
    expect(out.cocktails.map((c) => c.name)).toEqual(['A', 'C', 'D']);
    expect(out.cocktails.find((c) => c.name === 'C').family_id).toBe(1);
  });
  it('adds the family and sub-group, names the old sub-group, makes the named drink the new family root, recounts', () => {
    expect(out.families.map((f) => f.id)).toEqual([0, 1]);
    expect(out.families[1].signature.size).toBe(1);
    expect(out.families[1].reason).toBeUndefined();
    expect(out.subclusters.map((s) => [s.id, s.name, s.size])).toEqual([['0.0', 'Plain', 2], ['1.0', 'Cream', 1]]);
    expect(out.cocktails.find((c) => c.name === 'C').is_root).toBe(true);
    expect(out._meta).toMatchObject({ n_cocktails: 3, n_families: 2, n_subclusters: 2 });
  });
  it('a line fix rewrites the recipe text with the new lines and keeps the garnish line', () => {
    const a = out.cocktails.find((c) => c.name === 'A');
    expect(a.ingredients_raw.map((l) => l.raw)).toEqual(['30 ml Gin', '15 ml Lime']);
    expect(a.recipe_text).toBe('30 ml Gin\n15 ml Lime\nGarnish: a twist');
  });
  it('is idempotent and never changes its input', () => {
    const input = stub();
    const before = JSON.stringify(input);
    const once = applyCocktailCuration(input, table);
    expect(JSON.stringify(input)).toBe(before);
    expect(applyCocktailCuration(once, table)).toEqual(once);
  });
  it('leaves a payload without cocktails or families (a test stub) alone', () => {
    expect(applyCocktailCuration({ foo: 1 }, table)).toEqual({ foo: 1 });
    expect(applyCocktailCuration(null, table)).toBeNull();
  });
  it('a line patch changes one line and keeps its other fields', () => {
    const raw = { families: [], cocktails: [{ name: 'M', canonical: 'm', family_id: 0, ingredients_raw: [{ raw: '2-4 Mint', name: 'mint', measure: '2-4', amount_ml: null }, { raw: 'Rum' }], recipe_text: '2-4 Mint\nRum' }] };
    const got = applyCocktailCuration(raw, { fixes: { m: { patch: [{ match: '2-4 Mint', set: { raw: '6 mint sprigs', measure: '6 sprigs' } }], reason: 'r' } } });
    expect(got.cocktails[0].ingredients_raw[0]).toEqual({ raw: '6 mint sprigs', name: 'mint', measure: '6 sprigs', amount_ml: null });
    expect(got.cocktails[0].recipe_text).toBe('6 mint sprigs\nRum');
  });
});

describe('validateCocktailCuration (stub)', () => {
  it('passes the good table and names each kind of problem', () => {
    expect(validateCocktailCuration(stub(), table)).toEqual([]);
    const bad = { ...table, moves: { zz: { family_id: 1, subcluster_id: '1.0', reason: 'r' }, c: { family_id: 9, subcluster_id: '1.0', reason: '' } }, add: [{ ...table.add[0], source: '' }], fixes: { a: { lines: ['30 ml Gin'], reason: 'r' } } };
    const p = validateCocktailCuration(stub(), bad).join('\n');
    expect(p).toMatch(/move zz: no such drink/);
    expect(p).toMatch(/move c: no reason/);
    expect(p).toMatch(/move c: unknown family 9/);
    expect(p).toMatch(/add D: no source/);
    expect(p).toMatch(/fix a: adds amounts without a source/);
  });
});

describe('the real table on the real codex', () => {
  const raw = readRawCodex();
  const out = readCuratedCodex();
  const fam = Object.fromEntries(out.families.map((f) => [f.id, f.name]));
  const byName = (n) => out.cocktails.find((c) => c.name === n);

  it('is valid, idempotent, and leaves the raw file as generated (441 drinks, six families)', () => {
    expect(validateCocktailCuration(raw, TABLE)).toEqual([]);
    expect(applyCocktailCuration(out, TABLE)).toEqual(out);
    expect(curateCodexRaw(raw)).toEqual(out);
    expect(raw.cocktails).toHaveLength(441);
    expect(raw.families).toHaveLength(6);
  });
  it('has seven families, the seventh named Flips & Cream Drinks with its own root and two named sub-groups', () => {
    expect(out.families).toHaveLength(7);
    expect(fam[6]).toBe('Flips & Cream Drinks');
    expect(out.cocktails.filter((c) => c.family_id === 6 && c.is_root).map((c) => c.name)).toEqual(['Brandy Alexander']);
    expect(out.subclusters.filter((s) => s.family_id === 6).map((s) => s.name)).toEqual(['Flips & eggnogs', 'Cream & dessert drinks']);
    expect(out.subclusters.every((s) => s.name)).toBe(true);
  });
  it('files the White Russian, the flips and the eggnogs under it; keeps egg-white sours, Piña Colada and the kept fizzes where they were', () => {
    for (const n of ['White Russian', 'Brandy Alexander', 'Grasshopper', 'Eggnog', 'Brandy Flip', 'Tom and Jerry', 'B-52']) expect(fam[byName(n).family_id], n).toBe('Flips & Cream Drinks');
    for (const n of ['Whiskey Sour', 'Pisco Sour', 'Clover Club']) expect(fam[byName(n)?.family_id], n).toBe('Sour Family');
    expect(fam[byName('Pina Colada').family_id]).toBe('Tropical Sours');
    expect(fam[byName('Ramos Gin Fizz').family_id]).toBe('Highballs & Fizzes');
  });
  it('no cream or egg drink is left outside the family except the named keep list', () => {
    const keep = new Set(JSON.parse(readFileSync('data/review/keep.json', 'utf8')).cocktailCreamKeep.map((k) => k.name));
    const left = out.cocktails.filter((c) => isCreamOrEggDrink(c) && fam[c.family_id] !== 'Flips & Cream Drinks').map((c) => c.name);
    expect(left.filter((n) => !keep.has(n))).toEqual([]);
    expect(cocktailChecks(out, { creamKeep: keep }).findings.filter((f) => f.rule === 'cocktail-cream-egg')).toEqual([]);
  });
  it('the Mojito is a highball, the Bramble a sour', () => {
    expect(fam[byName('Mojito').family_id]).toBe('Highballs & Fizzes');
    expect(fam[byName('Bramble').family_id]).toBe('Sour Family');
  });
  it('has no duplicate names, no unnamed sub-group, and the classics the audit looked for', () => {
    const names = out.cocktails.map((c) => c.canonical.replace(/[^a-z0-9]+/g, ''));
    expect(new Set(names).size).toBe(names.length);
    const rules = cocktailChecks(out).findings.map((f) => f.rule);
    for (const r of ['cocktail-duplicate', 'cocktail-subgroup-unnamed', 'cocktail-missing-classic']) expect(rules).not.toContain(r);
    for (const n of ['Espresso Martini', 'Long Island Iced Tea', 'Sex on the Beach']) expect(byName(n)?.ingredients_raw.length, n).toBeGreaterThan(2);
  });
  it('fixes the three merged recipes, the stray lines and the lines whose amount sat in the name', () => {
    expect(byName('20th Century').ingredients_raw).toHaveLength(4);
    expect(byName('Twist of Menton').ingredients_raw).toHaveLength(5);
    expect(byName('Between the Sheets (Our Ideal Recipe)').ingredients_raw).toHaveLength(5);
    expect(byName('Old Fashioned').ingredients_raw.map((l) => l.raw)).toContain('1 dash Water');
    expect(byName('Mojito').ingredients_raw.map((l) => l.raw)).toContain('6 mint sprigs');
    expect(byName('Margarita').ingredients_raw.map((l) => l.raw)).toEqual(['50 ml Blanco tequila', '20 ml Orange liqueur', '15 ml Fresh lime juice']);
    expect(byName('20th Century').recipe_text).not.toMatch(/Last Word/);
  });
  it('every amount the table adds names its published source', () => {
    for (const [k, f] of Object.entries(TABLE.fixes)) if ((f.lines || []).some((l) => /^\d/.test(l))) expect(f.source, k).toMatch(/IBA/);
    for (const a of TABLE.add) expect(a.source, a.name).toMatch(/IBA/);
  });
});

describe('nothing reads the raw codex around the layer', () => {
  const ALLOWED = new Set([
    'src/data/curation/__tests__/applyCocktailCuration.test.js', 'scripts/lib/curatedCodex.mjs', 'scripts/recluster-fam-1-3.cjs',
    'src/data/cocktailCodexV2.js', 'src/data/sharedLoaders.js',
  ]);
  const walk = (dir, out = []) => {
    for (const e of readdirSync(dir)) {
      const p = join(dir, e);
      if (statSync(p).isDirectory()) { if (!/node_modules|dist|\.cache|generated/.test(e)) walk(p, out); } else if (/\.(jsx?|mjs|cjs|ts)$/.test(e)) out.push(p.replace(/\\/g, '/'));
    }
    return out;
  };
  it('every source file that names the file also goes through the curation (curateCodexRaw or readCuratedCodex)', () => {
    const offenders = [];
    for (const f of [...walk('src'), ...walk('scripts')]) {
      if (ALLOWED.has(f)) continue;
      const s = readFileSync(f, 'utf8');
      if (/['"`][^'"`\r\n]*cocktail_codex_v2\.json/.test(s) && !/curateCodexRaw|readCuratedCodex/.test(s)) offenders.push(f);
    }
    expect(offenders).toEqual([]);
  });
  it('the loaders that fetch the file apply the layer', () => {
    for (const f of ['src/App.jsx', 'src/components/CocktailLabV2.jsx', 'src/components/RecipeFlavorProfilesCard.jsx', 'src/data/sharedLoaders.js']) {
      expect(readFileSync(f, 'utf8'), f).toMatch(/curateCodexRaw\(/);
    }
  });
});
