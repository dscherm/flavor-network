import { describe, it, expect } from 'vitest';
import { coverageLosses } from '../../../scripts/checkAliasCoverage.mjs';

describe('coverageLosses', () => {
  const aliases = { 'grape tomatoe': { to: 'grape tomato' }, peache: { to: 'peach' }, chilie: { to: 'chili' } };
  const files = {
    'a.json': { 'grape tomatoe': {}, peache: {}, peach: {}, chilie: {} },
    'b.json': { peache: {}, chili: {} },
  };
  it('reports each file where the variant has a row and the canonical has none', () => {
    expect(coverageLosses(aliases, files)).toEqual([
      { variant: 'grape tomatoe', to: 'grape tomato', files: ['a.json'] },
      { variant: 'peache', to: 'peach', files: ['b.json'] },
      { variant: 'chilie', to: 'chili', files: ['a.json'] },
    ]);
  });
  it('reports nothing when every canonical has its own rows, or the variant has none', () => {
    expect(coverageLosses({ peache: { to: 'peach' } }, { 'a.json': { peache: {}, peach: {} } })).toEqual([]);
    expect(coverageLosses({ peache: { to: 'peach' } }, { 'a.json': { peach: {} } })).toEqual([]);
  });
});
