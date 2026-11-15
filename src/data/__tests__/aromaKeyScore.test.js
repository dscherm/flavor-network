import { describe, it, expect } from 'vitest';
import { scoreAromaKey, summarizeAromaKey, AROMA_SET_SIX, AROMA_SET_ELEVEN } from '../flavorScore.js';

const bars = (o) => Object.entries(o).map(([axis, score]) => ({ axis, score }));

describe('scoreAromaKey', () => {
  it('top1 and top2 against the six-axis expectation', () => {
    const b = bars({ odor_green: 0.6, odor_fruity: 0.4, odor_woody: 0.1 });
    const r = scoreAromaKey(b, { expect: ['fruity'], expect6: ['fruity'] });
    expect(r.tops).toEqual(['green', 'fruity']);
    expect(r.top1).toBe(false);
    expect(r.top2).toBe(true);
  });
  it('maps spice to odor_spicy', () => {
    const r = scoreAromaKey(bars({ odor_spicy: 0.5 }), { expect: ['spice'], expect6: ['spice'] });
    expect(r.top1).toBe(true);
  });
  it('an empty expect6 is inexpressible, not a miss', () => {
    const r = scoreAromaKey(bars({ odor_fatty: 0.5 }), { expect: ['savory'], expect6: [] });
    expect(r.inexpressible).toBe(true);
    expect(r.top1).toBe(false);
    const s = summarizeAromaKey([r, scoreAromaKey(bars({ odor_fatty: 0.5 }), { expect6: ['fatty'] })]);
    expect(s).toMatchObject({ items: 2, inexpressible: 1, scored: 1, top1: 1 });
  });
  it('flags a forbidden lead and no chart', () => {
    expect(scoreAromaKey(bars({ odor_fatty: 0.5 }), { expect6: ['green'], not: ['fatty'] }).forbiddenLead).toBe(true);
    const none = scoreAromaKey(bars({ odor_fatty: 0 }), { expect6: ['green'] });
    expect(none.noChart).toBe(true);
    expect(none.top1).toBe(false);
  });
  it('the axis set is a parameter: eleven reads expect and the extra axes', () => {
    const r = scoreAromaKey(bars({ odor_smoky: 0.7, odor_woody: 0.2 }), { expect: ['smoky'], expect6: [] }, AROMA_SET_ELEVEN);
    expect(r.top1).toBe(true);
    expect(scoreAromaKey(bars({ odor_smoky: 0.7 }), { expect: ['smoky'], expect6: [] }, AROMA_SET_SIX).inexpressible).toBe(true);
  });
});
