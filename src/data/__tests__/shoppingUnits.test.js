// SHOP-6: shopping list amounts across metric and US. Display only; what is stored never changes.
import { describe, it, expect } from 'vitest';
import { formatAmount, loadUnitSystem, saveUnitSystem, UNITS_KEY } from '../shoppingUnits.js';
import { emptyList, addLine, toggle, replaceItem, undoReplace, toText, itemAmountText } from '../shoppingList.js';

const T = () => ({ now: 1000, newId: (() => { let n = 0; return () => `id${n++}`; })() });
const put = (list, key, amount) => addLine(list, { key, amount }, T()).list;
const partsOf = (list, key) => list.items.find((i) => i.key === key).parts;
const build = (key, ...amounts) => amounts.reduce((l, a) => put(l, key, a), emptyList());

describe('one part across systems (acceptance table)', () => {
  it.each([
    ['flour', ['200 g', '8 oz'], 'us', 'about 15 oz'],
    ['flour', ['200 g', '8 oz'], 'metric', 'about 425 g'],
    ['milk', ['250 ml', '1 cup'], 'us', 'about 2 cups'],
    ['milk', ['250 ml', '1 cup'], 'metric', 'about 485 ml'],
    ['rum', ['30 ml'], 'us', 'about 1 fl oz'],
    ['rum', ['30 ml'], 'metric', '30 ml'],
    ['milk', ['1 cup', '2 tbsp'], 'us', '1 cup 2 tbsp'],
    ['garlic', ['2 cloves', '1 tbsp'], 'us', '2 cloves + 1 tbsp'],
    ['garlic', ['2 cloves', '1 tbsp'], 'metric', '2 cloves + about 15 ml'],
    ['stock', ['200 g', '1 cup'], 'us', 'about 7 oz + 1 cup'],
    ['stock', ['200 g', '1 cup'], 'metric', '200 g + about 235 ml'],
  ])('%s %j in %s reads "%s"', (key, amounts, system, want) => {
    expect(formatAmount(partsOf(build(key, ...amounts), key), system)).toBe(want);
  });

  it('a line entered and shown in the same system has no "about"', () => {
    expect(formatAmount([{ qty: 500, unit: 'g' }], 'metric')).toBe('500 g');
    expect(formatAmount([{ qty: 2, unit: 'lb' }], 'us')).toBe('2 lb');
    expect(formatAmount([{ qty: 1.5, unit: 'tbsp' }], 'us')).toBe('1½ tbsp');
  });

  it('no system shows the parts as entered', () => {
    expect(formatAmount([{ qty: 200, unit: 'g' }, { qty: 8, unit: 'oz' }])).toBe('200 g + 8 oz');
    expect(formatAmount([])).toBe('');
  });

  it('weight is never turned into volume: two parts stay two', () => {
    expect(partsOf(build('x', '200 g', '1 cup'), 'x')).toHaveLength(2);
  });
});

describe('what is stored stays what was entered', () => {
  const ENTERED = [{ qty: 300, unit: 'g' }, { qty: 1, unit: 'lb' }, { qty: 8, unit: 'oz' }]; // 200 g + 100 g, and 8 oz + 1 lb: each exact ladder summed as the merge rule always did, systems apart

  it('parts are identical after merges and after switching the display back and forth', () => {
    let l = build('flour', '200 g', '8 oz', '100 g', '1 lb');
    expect(partsOf(l, 'flour')).toEqual(ENTERED);
    const stored = JSON.stringify(l);
    for (const s of ['us', 'metric', 'us', 'metric']) { formatAmount(partsOf(l, 'flour'), s); toText(l, { system: s }); }
    expect(JSON.stringify(l)).toBe(stored);
    l = toggle(l, l.items[0].id, T());
    l = toggle(l, l.items[0].id, T());
    expect(partsOf(l, 'flour')).toEqual(ENTERED);
  });

  it('replaceItem then Undo restores the parts exactly', () => {
    const l = build('milk', '250 ml', '1 cup');
    const before = JSON.stringify(partsOf(l, 'milk'));
    const r = replaceItem(l, l.items[0].id, { key: 'oat milk' }, T());
    const back = undoReplace(r.list, r.list.items[0].id, T());
    expect(JSON.stringify(partsOf(back, 'milk'))).toBe(before);
  });
});

describe('rounding is one a cook can measure', () => {
  const FRAC = /[¼½¾⅓⅔⅛]/g;
  const check = (text) => {
    const body = text.replace(/^about /, '');
    expect(body).not.toMatch(/\d\.\d/);
    expect(body.match(FRAC)?.length || 0).toBeLessThanOrEqual(1);
    expect(body).not.toMatch(/(^|\s)0(\s|$)/);
    expect(body).not.toMatch(/(^|\s)0[¼½¾⅓⅔⅛]/);
  };
  it('US output over a range of grams and ml has at most one fraction, no decimal, never 0', () => {
    for (let n = 1; n <= 6000; n += 7) {
      for (const unit of ['g', 'ml']) {
        const t = formatAmount([{ qty: n, unit }], 'us');
        expect(t).toMatch(/^about /);
        check(t);
      }
    }
  });
  it('tiny amounts do not round to nothing', () => {
    expect(formatAmount([{ qty: 1, unit: 'g' }], 'us')).toBe('about ⅛ oz');
    expect(formatAmount([{ qty: 1, unit: 'ml' }], 'us')).toBe('about ¼ tsp');
    expect(formatAmount([{ qty: 0.1, unit: 'tsp' }], 'metric')).toBe('about 1 ml');
  });
  it('US weights and volumes in their steps', () => {
    expect(formatAmount([{ qty: 500, unit: 'g' }], 'us')).toBe('about 1 lb 2 oz');
    expect(formatAmount([{ qty: 1500, unit: 'g' }], 'us')).toBe('about 3¼ lb');
    expect(formatAmount([{ qty: 100, unit: 'g' }], 'us')).toBe('about 3½ oz');
    expect(formatAmount([{ qty: 15, unit: 'ml' }], 'us')).toBe('about 1 tbsp');
    expect(formatAmount([{ qty: 120, unit: 'ml' }], 'us')).toBe('about ½ cup');
    expect(formatAmount([{ qty: 80, unit: 'ml' }], 'us')).toBe('about ⅓ cup');
  });
  it('metric steps', () => {
    expect(formatAmount([{ qty: 1, unit: 'oz' }], 'metric')).toBe('about 30 g');
    expect(formatAmount([{ qty: 1, unit: 'tsp' }], 'metric')).toBe('about 5 ml');
    expect(formatAmount([{ qty: 3, unit: 'lb' }], 'metric')).toBe('about 1.35 kg');
    expect(formatAmount([{ qty: 8, unit: 'cup' }], 'metric')).toBe('about 1.9 l');
  });
});

describe('copy text and the switch memory', () => {
  it('toText follows the system', () => {
    const l = build('flour', '200 g', '8 oz');
    expect(toText(l, { system: 'us' })).toBe('Shopping list:\n- about 15 oz flour');
    expect(toText(l, { system: 'metric' })).toBe('Shopping list:\n- about 425 g flour');
    expect(itemAmountText(l.items[0], 'us')).toBe('about 15 oz');
  });
  it('is remembered in storage, defaults to US, ignores junk, and never throws', () => {
    const mem = new Map();
    const st = { getItem: (k) => mem.get(k) ?? null, setItem: (k, v) => mem.set(k, v) };
    expect(loadUnitSystem(st)).toBe('us');
    expect(saveUnitSystem('metric', st)).toBe(true);
    expect(mem.get(UNITS_KEY)).toBe('metric');
    expect(loadUnitSystem(st)).toBe('metric');
    expect(saveUnitSystem('stone', st)).toBe(false);
    mem.set(UNITS_KEY, 'junk');
    expect(loadUnitSystem(st)).toBe('us');
    const bad = { getItem: () => { throw new Error('x'); }, setItem: () => { throw new Error('x'); } };
    expect(loadUnitSystem(bad)).toBe('us');
    expect(saveUnitSystem('us', bad)).toBe(false);
  });
});
