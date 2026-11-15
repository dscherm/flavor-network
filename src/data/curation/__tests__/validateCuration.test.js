import { describe, it, expect } from 'vitest';
import { validateCuration, vocabulariesOf } from '../validateCuration.js';

const names = new Set(['peach', 'peache', 'beef', 'fryer']);
const vocab = { categories: new Set(['fruit', 'protein']), tastes: new Set(['sweet', 'umami']) };
const opts = { ingredientNames: names, ...vocab };
const ok = { aliases: { peache: { to: 'peach', reason: 'r' } }, hidden: { fryer: { reason: 'r' } } };
const joined = (t) => validateCuration(t, opts).join('|');

describe('validateCuration', () => {
  it('accepts a valid set of tables, including empty ones', () => {
    expect(validateCuration(ok, opts)).toEqual([]);
    expect(validateCuration({}, opts)).toEqual([]);
  });
  it('rejects an alias chain', () => {
    expect(joined({ aliases: { a: { to: 'b', reason: 'r' }, b: { to: 'peach', reason: 'r' } } })).toMatch(/itself an alias/);
  });
  it('rejects an alias to a hidden name', () => {
    expect(joined({ aliases: { peache: { to: 'fryer', reason: 'r' } }, hidden: { fryer: { reason: 'r' } } })).toMatch(/is hidden/);
  });
  it('rejects an alias to a missing canonical unless it is in additions', () => {
    expect(joined({ aliases: { peache: { to: 'melba', reason: 'r' } } })).toMatch(/not in the data/);
    const withAddition = { aliases: { peache: { to: 'melba', reason: 'r' } }, additions: { melba: { category: 'fruit', taste: 'sweet', reason: 'r' } } };
    expect(validateCuration(withAddition, opts)).toEqual([]);
  });
  it('rejects an alias to itself', () => {
    expect(joined({ aliases: { peach: { to: 'peach', reason: 'r' } } })).toMatch(/aliases itself/);
  });
  it('rejects a name in two contradictory tables', () => {
    expect(joined({ aliases: { peache: { to: 'peach', reason: 'r' } }, hidden: { peache: { reason: 'r' } } }))
      .toMatch(/"peache" appears in contradictory tables: aliases, hidden/);
    expect(joined({ hidden: { fryer: { reason: 'r' } }, packaged: { fryer: { reason: 'r' } } })).toMatch(/contradictory/);
  });
  it('rejects a missing or blank reason in every table', () => {
    expect(joined({ aliases: { peache: { to: 'peach' } } })).toMatch(/missing reason/);
    expect(joined({ hidden: { fryer: { reason: '  ' } } })).toMatch(/missing reason/);
    expect(joined({ packaged: { fryer: {} } })).toMatch(/missing reason/);
    expect(joined({ categoryOverrides: { beef: { category: 'protein' } } })).toMatch(/missing reason/);
  });
  it('rejects unknown category and taste words, accepting new ones declared in vocabulary', () => {
    const t = { categoryOverrides: { beef: { category: 'meat', reason: 'r' } }, tasteOverrides: { beef: { taste: 'umami rich', reason: 'r' } } };
    expect(joined(t)).toMatch(/unknown category "meat"/);
    expect(joined(t)).toMatch(/unknown taste word "rich"/);
    const declared = { ...t, vocabulary: { categories: { meat: { reason: 'r' } }, tastes: { rich: { reason: 'r' } } } };
    const distinct = { ...declared, categoryOverrides: { peach: declared.categoryOverrides.beef } };
    expect(validateCuration(distinct, opts)).toEqual([]);
  });
  it('rejects badly spelled keys and an addition that already exists', () => {
    expect(joined({ hidden: { 'Fryer ': { reason: 'r' } } })).toMatch(/key must be lowercase/);
    expect(joined({ additions: { beef: { category: 'protein', taste: 'umami', reason: 'r' } } })).toMatch(/already in the data/);
  });
  it('rejects a table that is not an object', () => {
    expect(joined({ aliases: [] })).toMatch(/must be an object/);
  });
  it('reads vocabularies from the data', () => {
    const v = vocabulariesOf({ _x: {}, a: { category: 'fruit', taste: 'sweet sour' }, b: { category: 'herb', taste: 'umami' } });
    expect([...v.categories].sort()).toEqual(['fruit', 'herb']);
    expect([...v.tastes].sort()).toEqual(['sour', 'sweet', 'umami']);
  });
});
