import { describe, it, expect } from 'vitest';
import { scoreItem, summarize } from '../flavorScore.js';

const bar = (axis, score) => ({ axis, score });
const negroni = { expect: ['bitter', 'sweet'], not: ['sour'] };

describe('scoreItem', () => {
  it('all right: top two both expected, nothing forbidden', () => {
    const r = scoreItem([bar('sweet', 0.5), bar('bitter', 0.8), bar('sour', 0.2)], negroni, { counted: 3, total: 3 });
    expect(r).toMatchObject({ tops: ['bitter', 'sweet'], top1: true, top2: true, forbiddenLead: false, noChart: false, coverage: 1 });
  });
  it('top-1 wrong, and a forbidden taste leading', () => {
    const r = scoreItem([bar('sour', 0.9), bar('bitter', 0.5)], negroni, { counted: 1, total: 4 });
    expect(r.top1).toBe(false);
    expect(r.top2).toBe(false);
    expect(r.forbiddenLead).toBe(true);
    expect(r.coverage).toBe(0.25);
  });
  it('top-1 right but second wrong fails top2 only', () => {
    const r = scoreItem([bar('bitter', 0.9), bar('sour', 0.5)], negroni);
    expect([r.top1, r.top2]).toEqual([true, false]);
  });
  it('no taste bars: noChart, nothing right, nothing forbidden', () => {
    const r = scoreItem([bar('odor_green', 0.4)], negroni, { counted: 0, total: 3 });
    expect(r).toMatchObject({ noChart: true, top1: false, top2: false, forbiddenLead: false, tops: [], coverage: 0 });
    expect(scoreItem(undefined, negroni).noChart).toBe(true);
  });
  it('single expected taste is scored on top1 only; heat is a taste like the others', () => {
    expect(scoreItem([bar('umami', 0.7)], { expect: ['umami'] }).top2).toBeNull();
    expect(scoreItem([bar('sour', 0.7)], { expect: ['heat'] }).top1).toBe(false);
    expect(scoreItem([bar('heat', 0.7), bar('sour', 0.2)], { expect: ['heat'] }).top1).toBe(true);
    expect(scoreItem([bar('heat', 0.7)], { expect: ['sour'], not: ['heat'] }).forbiddenLead).toBe(true);
  });
  it('aroma: expected axes must be in the top two aroma bars, taste bars ignored', () => {
    const t = { expect: ['sour'], aroma: ['green'] };
    const ok = scoreItem([bar('sour', 0.9), bar('odor_woody', 0.5), bar('odor_green', 0.4), bar('odor_fatty', 0.1)], t);
    const bad = scoreItem([bar('sour', 0.9), bar('odor_woody', 0.5), bar('odor_fatty', 0.4), bar('odor_green', 0.1)], t);
    expect(ok.aromaOk).toBe(true);
    expect(bad.aromaOk).toBe(false);
    expect(scoreItem([bar('sour', 0.9)], { expect: ['sour'] }).aromaOk).toBeNull();
  });
  it('does not mutate its input', () => {
    const bars = [bar('sweet', 0.1), bar('bitter', 0.9)];
    scoreItem(bars, negroni);
    expect(bars[0].axis).toBe('sweet');
  });
});

describe('summarize', () => {
  const rows = [
    scoreItem([bar('bitter', 0.8), bar('sweet', 0.5)], negroni, { counted: 2, total: 2 }),
    scoreItem([bar('sour', 0.8)], negroni, { counted: 1, total: 2 }),
    scoreItem([], { expect: ['umami'] }, { counted: 0, total: 2 }),
    scoreItem([bar('umami', 0.8), bar('odor_green', 0.3)], { expect: ['umami'], aroma: ['green'] }, { counted: 2, total: 2 }),
  ];
  it('counts and percentages', () => {
    expect(summarize(rows)).toEqual({
      items: 4, top1: 2, top1Pct: 50, top2: 1, top2Of: 2, top2Pct: 50,
      forbiddenLeads: 1, noChart: 1, aromaOk: 1, aromaOf: 1, aromaPct: 100, countedPct: 62.5,
    });
  });
  it('empty input gives nulls, not NaN', () => {
    expect(summarize([])).toMatchObject({ items: 0, top1Pct: null, top2Pct: null, countedPct: null });
    expect(summarize(undefined).items).toBe(0);
  });
});
