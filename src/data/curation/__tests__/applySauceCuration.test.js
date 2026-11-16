// DATA-7: the sauce grouping table. Pure behaviour on a stub, then the real table on the real sauce file,
// then the real codex loader: every sauce keeps exactly one group, the catch-all shrinks, share links still resolve.
import { describe, it, expect, vi, afterEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { applySauceCuration, validateSauceCuration, sauceGroupFamilies, curateSauceAugment, CATCH_ALL, MIN_GROUP_SIZE } from '../applySauceCuration.js';
import TABLE from '../sauceGroups.json' with { type: 'json' };
import { loadSauceCodex, computeSauceCodexPositions } from '../../sauceCodex.js';
import { resolveBuiltIn, slugFor, uniqueBySlug } from '../../sharedRecipe.js';
import { sauceChecks } from '../../dataAudit.js';
import { sauceVesselFor } from '../../../components/sauceVessels.jsx';

const RAW = JSON.parse(readFileSync(`${process.cwd()}/public/data/sauce_augment.json`, 'utf8'));
const MOTHERS = ['Béchamel', 'Velouté', 'Espagnole', 'Hollandaise', 'Tomato', 'Curry', 'Stir-fry', 'Mole', 'Salsa', 'Nut Sauce'];

const stub = () => ({ sauces: [
  { name: 'A', motherSauce: 'Independent' }, { name: 'B', motherSauce: 'Independent' }, { name: 'C', motherSauce: 'Independent' },
  { name: 'D', motherSauce: 'Independent' }, { name: 'E', motherSauce: 'Mole' },
] });
const stubTable = {
  groups: [{ name: 'Herbs', color: '#111', blurb: 'x' }, { name: 'Independent', color: '#222', blurb: 'y' }],
  assign: {
    A: { group: 'Herbs', reason: 'r' }, B: { group: 'Herbs', reason: 'r' }, C: { group: 'Herbs', reason: 'r' }, D: { group: 'Independent', reason: 'r' },
  },
};

describe('applySauceCuration (stub)', () => {
  it('regroups the named sauces and leaves the rest alone', () => {
    const out = applySauceCuration(stub(), stubTable);
    expect(out.sauces.map((s) => s.motherSauce)).toEqual(['Herbs', 'Herbs', 'Herbs', 'Independent', 'Mole']);
  });
  it('is idempotent and does not touch its input', () => {
    const input = stub();
    const once = applySauceCuration(input, stubTable);
    expect(applySauceCuration(once, stubTable)).toEqual(once);
    expect(input.sauces[0].motherSauce).toBe('Independent');
  });
  it('returns a payload without sauces unchanged', () => {
    const odd = { nothing: true };
    expect(applySauceCuration(odd, stubTable)).toBe(odd);
  });
  it('numbers the groups as families from the first free id', () => {
    expect(sauceGroupFamilies(stubTable, 10).map((f) => [f.id, f.name])).toEqual([[10, 'Herbs'], [11, 'Independent']]);
  });
  it('a sound table validates clean; each kind of mistake is named', () => {
    expect(validateSauceCuration(stub(), stubTable)).toEqual([]);
    const bad = {
      groups: [{ name: 'Herbs', color: '#111', blurb: 'x' }, { name: 'Independent', color: '#222', blurb: 'y' }],
      assign: { A: { group: 'Herbs', reason: 'r' }, ZZ: { group: 'Herbs', reason: 'r' }, B: { group: 'Nowhere', reason: 'r' }, C: { group: 'Herbs', reason: ' ' } },
    };
    const p = validateSauceCuration(stub(), bad).join('\n');
    expect(p).toMatch(/ZZ: no such sauce/);
    expect(p).toMatch(/B: unknown group 'Nowhere'/);
    expect(p).toMatch(/C: no reason/);
    expect(p).toMatch(/D: 'Independent' with no entry/);
    expect(p).toMatch(/group 'Herbs' has 2 sauces, needs at least 3/);
  });
});

describe('sauceGroups.json on the real sauce file', () => {
  const curated = curateSauceAugment(RAW).sauces;
  const groupOf = (name) => curated.find((s) => s.name === name).motherSauce;

  it('is sound', () => {
    expect(validateSauceCuration(RAW)).toEqual([]);
  });
  it('covers all 27 sauces the file tags Independent, each with a reason, and nothing else', () => {
    const independent = RAW.sauces.filter((s) => s.motherSauce === CATCH_ALL).map((s) => s.name).sort();
    expect(independent).toHaveLength(27);
    expect(Object.keys(TABLE.assign).sort()).toEqual(independent);
    for (const a of Object.values(TABLE.assign)) expect(a.reason.length).toBeGreaterThan(10);
  });
  it("'Independent' holds fewer than 12 sauces and every new group has at least three", () => {
    const n = (g) => curated.filter((s) => s.motherSauce === g).length;
    expect(n(CATCH_ALL)).toBeLessThan(12);
    for (const g of TABLE.groups.filter((x) => x.name !== CATCH_ALL)) expect(n(g.name), g.name).toBeGreaterThanOrEqual(MIN_GROUP_SIZE);
  });
  it('every sauce has exactly one group, and it is a family the lab draws', () => {
    const families = new Set([...MOTHERS, ...TABLE.groups.map((g) => g.name)]);
    expect(curated).toHaveLength(77);
    for (const s of curated) expect(families.has(s.motherSauce), s.name).toBe(true);
    expect(new Set(curated.map((s) => s.name)).size).toBe(77);
  });
  it('the audit counts the catch-all after the table', () => {
    expect(sauceChecks(curated).independent).toBe(2);
    expect(sauceChecks(RAW.sauces).independent).toBe(27);
  });
  it('spot checks: the judgement calls the report lists', () => {
    expect(groupOf('Harissa')).toBe('Chili & Hot Sauces');
    expect(groupOf('Chimichurri')).toBe('Herb Sauces');
    expect(groupOf('Toum')).toBe('Cold & Creamy');
    expect(groupOf('Sofrito')).toBe('Tomato');
    expect(groupOf('Gravy (Southern)')).toBe('Béchamel');
    expect(groupOf('Dashi')).toBe(CATCH_ALL);
  });
  it('every new group has a vessel of its own kind (not the gravy-boat fallback, not the stir-fry wok)', () => {
    for (const g of TABLE.groups) expect(['boat', 'wok']).not.toContain(sauceVesselFor(g.name));
  });
});

describe('the Sauce Lab codex with the table', () => {
  afterEach(() => vi.unstubAllGlobals());
  const load = async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => JSON.parse(JSON.stringify(RAW)) }));
    return loadSauceCodex('/data');
  };

  it('puts all 77 sauces in a family, sixteen families in all', async () => {
    const codex = await load();
    expect(codex.nodes.size).toBe(77);
    expect(codex.codex.clusters).toHaveLength(MOTHERS.length + TABLE.groups.length);
    const ids = codex.codex.clusters.map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const n of codex.nodes.values()) expect(ids).toContain(n.family_id);
    const byName = Object.fromEntries(codex.codex.clusters.map((c) => [c.name, c.id]));
    expect(codex.nodes.get('Zhug').family_id).toBe(byName['Herb Sauces']);
    expect(codex.nodes.get('Zhug').family).toBe('Herb Sauces');
    expect(codex.nodes.get('Dashi').family).toBe(CATCH_ALL);
  });
  it('the 3D layout positions every sauce, with the family sphere widened for 16 families', async () => {
    const codex = await load();
    const { positions } = computeSauceCodexPositions(codex.nodes, codex.codex.clusters);
    expect(Object.keys(positions)).toHaveLength(77);
    for (const p of Object.values(positions)) for (const v of p) expect(Number.isFinite(v)).toBe(true);
  });
  it('every sauce still resolves as a share link and as a card, under the same slug as before', () => {
    const sauces = curateSauceAugment(RAW).sauces;
    const data = { sauces };
    for (const s of uniqueBySlug('sauce', sauces)) {
      const r = resolveBuiltIn('sauce', slugFor('sauce', s), data);
      expect(r, s.name).toBeTruthy();
      expect(r.name).toBe(s.name);
      expect(slugFor('sauce', s)).toBe(slugFor('sauce', RAW.sauces.find((x) => x.name === s.name)));
    }
    expect(resolveBuiltIn('sauce', 'zhug', data).category).toBe('Herb Sauces');
    expect(resolveBuiltIn('sauce', 'dashi', data).category).toBeNull();
  });
});
