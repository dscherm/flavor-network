import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  resolveSecond, tableRanking, secondAromas, compareAromaTable, summarizeAgreement, unreviewedDisagreements,
  validateAccepted, disagreementTsv, disagreements, AXIS_SETS,
} from '../aromaAgreement.js';
import { AROMAS } from '../flavorAromas.js';
import { aliasEntries } from '../curation/resolveIngredient.js';

const root = process.cwd();
const distilled = JSON.parse(readFileSync(resolve(root, 'public/proDataset/flavor_profiles_distilled.json'), 'utf8'));
const accepted = JSON.parse(readFileSync(resolve(root, 'data/review/aroma-accepted.json'), 'utf8'));

const second = (o) => ({ ingredients: o });
const e = (aromas, source = 'llm-distilled') => ({ aromas, source });

describe('tableRanking', () => {
  it('orders by strength, drops zeros, renames spicy to spice', () => {
    expect(tableRanking({ green: 1, spicy: 2, potency: 3 })).toEqual([{ axis: 'spice', v: 2 }, { axis: 'green', v: 1 }]);
  });
});

describe('secondAromas', () => {
  it('maps to the six-axis set and reports words with no home', () => {
    expect(secondAromas(['spicy', 'roasted', 'citrusy', 'fruity'], AXIS_SETS.six)).toEqual({ mapped: ['spice', 'fruity'], homeless: ['roasted'] });
  });
  it('the eleven-axis set has a home for those words', () => {
    expect(secondAromas(['roasted', 'meaty'], AXIS_SETS.eleven)).toEqual({ mapped: ['toasty', 'savory'], homeless: [] });
  });
  it('ignores words outside the vocabulary', () => {
    expect(secondAromas(['nonsense'], AXIS_SETS.six)).toEqual({ mapped: [], homeless: [] });
  });
});

describe('resolveSecond', () => {
  const ing = { 'crème de cassis': e(['fruity']), potato: e(['earthy']) };
  it('matches names ignoring accents and case', () => {
    expect(resolveSecond('Creme de Cassis', ing).key).toBe('crème de cassis');
  });
  it('follows a merge in either direction', () => {
    expect(resolveSecond('spud', ing, new Map([['spud', 'potato']])).key).toBe('potato');
    expect(resolveSecond('potato', { spud: e(['earthy']) }, new Map([['spud', 'potato']])).key).toBe('spud');
  });
  it('returns null when there is no counterpart', () => {
    expect(resolveSecond('unobtainium', ing)).toBeNull();
  });
});

describe('compareAromaTable', () => {
  const table = {
    mint: { green: 3, potency: 10 },
    gin: { green: 1.5, fruity: 1, potency: 0.7 },
    coffee: { woody: 3, potency: 1.5 },
    water: { potency: 0 },
    lonely: { fruity: 2, potency: 1 },
    tie: { green: 2, fruity: 2, potency: 1 },
  };
  const d = second({
    mint: e(['green'], 'chef'),
    gin: e(['spicy', 'woody', 'citrusy']),
    coffee: e(['roasted']),
    water: e(['green']),
    tie: e(['fruity']),
  });
  const { rows, summary } = compareAromaTable(table, d);
  const by = (n) => rows.find((r) => r.name === n);
  it('agrees when the strongest aroma is among the second source\'s', () => {
    expect(by('mint').status).toBe('agree');
    expect(by('mint').chef).toBe(true);
  });
  it('flags a disagreement and keeps both sides', () => {
    const g = by('gin');
    expect(g.status).toBe('disagree');
    expect(g.tableTop).toEqual(['green']);
    expect(g.secondMapped).toEqual(['spice', 'woody', 'fruity']);
    expect(g.top2Overlap).toBe(true);
  });
  it('a tie for strongest agrees when either tied axis is in the second source', () => {
    expect(by('tie').status).toBe('agree');
  });
  it('reports a second source that has no aroma on these axes, apart from disagreements', () => {
    expect(by('coffee').status).toBe('no-expressible');
    expect(by('coffee').homeless).toEqual(['roasted']);
    expect(compareAromaTable(table, d, { axes: AXIS_SETS.eleven }).rows.find((r) => r.name === 'coffee').status).toBe('disagree');
  });
  it('reports lines with no counterpart and skips lines with no aroma of their own', () => {
    expect(by('lonely').status).toBe('no-counterpart');
    expect(by('water')).toBeUndefined();
    expect(summary.aromaless).toBe(1);
    expect(summary).toMatchObject({ lines: 6, withAroma: 5, noCounterpart: 1, noExpressible: 1, compared: 3, agree: 2, disagree: 1, comparedChef: 1, agreeChef: 1 });
    expect(summary.agreePct).toBeCloseTo(66.7, 1);
  });
});

describe('summarizeAgreement', () => {
  it('has null percentages when nothing was compared', () => {
    expect(summarizeAgreement([])).toMatchObject({ compared: 0, agreePct: null, agreeChefPct: null });
  });
});

describe('review bookkeeping', () => {
  const rows = [
    { name: 'a', status: 'disagree', tableTop: ['green'], second: 'a', secondWords: ['woody'], secondMapped: ['woody'], homeless: [], chef: true, line: { green: 1, potency: 1 } },
    { name: 'b', status: 'agree' },
  ];
  it('unreviewed = disagreements not in the accepted file', () => {
    expect(unreviewedDisagreements(rows, {}).map((r) => r.name)).toEqual(['a']);
    expect(unreviewedDisagreements(rows, { a: { kind: 'table-right', reason: 'a long enough reason' } })).toEqual([]);
  });
  it('validateAccepted rejects thin reasons, bad kinds, missing aroma, and entries that no longer disagree', () => {
    const p = validateAccepted({
      a: { kind: 'missing-axis', reason: 'short' },
      b: { kind: 'table-right', reason: 'this one agrees now so is stale' },
      c: { kind: 'whatever', reason: 'a perfectly long reason here' },
    }, rows);
    expect(p.join('\n')).toMatch(/a: reason/);
    expect(p.join('\n')).toMatch(/a: missing-axis needs "aroma"/);
    expect(p.join('\n')).toMatch(/b: no longer disagrees/);
    expect(p.join('\n')).toMatch(/c: kind must be one of/);
  });
  it('writes a TSV with both sides and the chef flag', () => {
    const tsv = disagreementTsv(disagreements(rows));
    expect(tsv.split('\n')[0]).toMatch(/^name\ttable_top/);
    expect(tsv).toMatch(/^a\tgreen\tgreen 1, potency 1\ta\twoody\twoody\t\tchef$/m);
  });
});

describe('the real aroma table against the real second source (eleven axes)', () => {
  const { rows } = compareAromaTable(AROMAS, distilled, { aliases: new Map(aliasEntries()), axes: AXIS_SETS.eleven });
  it('every disagreement has been read and decided', () => {
    expect(unreviewedDisagreements(rows, accepted).map((r) => r.name)).toEqual([]);
  });
  it('the accepted file holds no stale or thin entry', () => {
    expect(validateAccepted(accepted, rows)).toEqual([]);
  });
  it('the table agrees with the second source about the strongest aroma at least nine times in ten', () => {
    const cmp = rows.filter((r) => r.status === 'agree' || r.status === 'disagree');
    expect(cmp.filter((r) => r.status === 'agree').length / cmp.length).toBeGreaterThan(0.9);
  });
});
