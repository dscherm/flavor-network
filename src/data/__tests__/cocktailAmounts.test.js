import { describe, it, expect } from 'vitest';
import { splitAmount, suggestAmounts } from '../cocktailAmounts.js';

describe('splitAmount', () => {
  it('splits common bar measures', () => {
    expect(splitAmount('1 1/2 oz Gin')).toEqual({ amount: '1 1/2 oz', name: 'Gin' });
    expect(splitAmount('¾ ounce Fresh lime juice')).toEqual({ amount: '¾ ounce', name: 'Fresh lime juice' });
    expect(splitAmount('2 dashes Angostura bitters')).toEqual({ amount: '2 dashes', name: 'Angostura bitters' });
    expect(splitAmount('4.5 cl gin')).toEqual({ amount: '4.5 cl', name: 'gin' });
    expect(splitAmount('1 egg white')).toEqual({ amount: '1', name: 'egg white' });
  });
  it('leaves bare names alone', () => {
    expect(splitAmount('Sweet vermouth')).toEqual({ amount: '', name: 'Sweet vermouth' });
  });
  it('reads word amounts', () => {
    expect(splitAmount('Top with soda')).toEqual({ amount: 'Top', name: 'soda' });
    expect(splitAmount('dash of orange bitters')).toEqual({ amount: 'dash', name: 'orange bitters' });
  });
});

describe('suggestAmounts', () => {
  const slotOf = (n) => ({ gin: 'spirit', campari: 'amaro_liqueur', 'sweet vermouth': 'vermouth', vermouth: 'vermouth', 'lime juice': 'sour' }[n] || null);
  it('keeps given amounts and suggests per-slot defaults for the rest', () => {
    const { items, anySuggested } = suggestAmounts([{ raw: '1 oz Gin' }, { raw: 'Campari' }, { raw: 'Sweet vermouth' }], slotOf);
    expect(anySuggested).toBe(true);
    expect(items[0]).toEqual({ name: 'Gin', measure: '1 oz', suggested: false });
    expect(items[1]).toEqual({ name: 'Campari', measure: '~¾ oz', suggested: true });
    expect(items[2]).toEqual({ name: 'Sweet vermouth', measure: '~1 oz', suggested: true });
  });
  it('reports nothing suggested when every line has an amount', () => {
    const { anySuggested } = suggestAmounts([{ raw: '2 oz Gin' }, { raw: '¾ oz lime juice' }], slotOf);
    expect(anySuggested).toBe(false);
  });
  it('a split base gets 1 oz per spirit instead of 2 oz each', () => {
    const slots = (n) => ({ scotch: 'spirit', calvados: 'spirit', 'sweet vermouth': 'vermouth' }[n] || null);
    const { items } = suggestAmounts(['Scotch', 'Calvados', 'Sweet vermouth'], slots);
    expect(items.map((i) => i.measure)).toEqual(['~1 oz', '~1 oz', '~1 oz']);
  });
  it('leaves an unknown-slot ingredient without a number', () => {
    const { items } = suggestAmounts(['Mystery mix'], slotOf);
    expect(items[0]).toEqual({ name: 'Mystery mix', measure: '', suggested: false });
  });
});
