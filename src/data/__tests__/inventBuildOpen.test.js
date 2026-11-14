import { describe, it, expect } from 'vitest';
import {
  openBuild, applyCategory, clearCategory, checklist, advice, recommendCategory, rankCategories, suggestNext,
  addLine, removeLine, replaceLine, setSlot, addExtra, removeExtra, clearSlot, missing, buildKeys, oneOf, hasCategory,
} from '../inventBuild.js';
import { cocktailSkeleton, INVENT_FAMILY_ORDER } from '../cocktailInvent.js';

const deepFreeze = (o) => {
  if (o && typeof o === 'object' && !Object.isFrozen(o)) { Object.freeze(o); Object.values(o).forEach(deepFreeze); }
  return o;
};

const SPIRITS = ['bourbon', 'rye', 'gin'];
const isSpirit = (k) => SPIRITS.includes(k);
const isSour = (k) => /juice/.test(k);
const skeleton = (rules) => ({
  slots: [
    { id: 'base', label: 'base spirit', required: true, accepts: isSpirit, why: 'the body' },
    { id: 'sour', label: 'sour', required: true, accepts: isSour },
    { id: 'sweet', label: 'sweetener', required: true, accepts: (k) => /syrup|sugar/.test(k) },
    { id: 'bitters', label: 'bitters', required: false, accepts: (k) => /bitters/.test(k) },
  ],
  rules: rules || [oneOf(isSpirit, 'only one base spirit')],
});
const L = (...keys) => keys.map((key) => ({ key, source: 'user' }));

describe('openBuild / applyCategory / clearCategory', () => {
  it('holds exactly the lines given, no category, no slots', () => {
    const b = openBuild({ lab: 'cocktail', baseline: { base: 'gin' }, lines: L('gin', 'lime juice') });
    expect(b.slots).toEqual([]);
    expect(b.rules).toEqual([]);
    expect(b.extras.map((l) => l.key)).toEqual(['gin', 'lime juice']);
    expect(hasCategory(b)).toBe(false);
    expect(checklist(b)).toEqual([]);
    expect(missing(b)).toEqual([]);
    expect(buildKeys(b)).toEqual(['gin', 'lime juice']);
  });

  it('drops a repeated key and says so', () => {
    const b = openBuild({ lines: L('gin', 'gin') });
    expect(b.extras).toHaveLength(1);
    expect(b.rejected[0].key).toBe('gin');
  });

  it('applyCategory then clearCategory returns the same lines in the same order; nothing added or dropped', () => {
    const b = deepFreeze(openBuild({ lines: [...L('cucumber', 'simple syrup'), { key: 'gin', source: 'search', amount: '2 oz' }, ...L('lime juice')] }));
    const under = applyCategory(b, skeleton());
    expect(hasCategory(under)).toBe(true);
    expect(buildKeys(under).sort()).toEqual(['cucumber', 'gin', 'lime juice', 'simple syrup']);
    expect(under.extras.map((l) => l.key)).toEqual(['cucumber']);
    expect(under.slots.find((s) => s.id === 'base').line).toEqual({ key: 'gin', source: 'search', amount: '2 oz' });
    // flat order after clear = slot order, then extras: stable and complete
    const flat = clearCategory(under);
    expect(flat.slots).toEqual([]);
    expect(flat.extras.map((l) => l.key)).toEqual(['gin', 'lime juice', 'simple syrup', 'cucumber']);
    expect(clearCategory(applyCategory(flat, skeleton())).extras.map((l) => l.key)).toEqual(flat.extras.map((l) => l.key));
  });

  it('uses a best assignment, not first-fit', () => {
    const sk = {
      slots: [
        { id: 'veg', label: 'veg', required: true, accepts: (k) => ['carrot', 'onion'].includes(k) },
        { id: 'aroma', label: 'aromatic', required: true, accepts: (k) => k === 'onion' },
      ],
    };
    const b = applyCategory(openBuild({ lines: L('onion', 'carrot') }), sk);
    expect(b.slots.find((s) => s.id === 'veg').line.key).toBe('carrot');
    expect(b.slots.find((s) => s.id === 'aroma').line.key).toBe('onion');
    expect(b.extras).toEqual([]);
  });

  it('keeps a line a refusal rule would have refused', () => {
    const b = applyCategory(openBuild({ lines: L('gin', 'rye') }), skeleton());
    expect(buildKeys(b).sort()).toEqual(['gin', 'rye']);
  });
});

describe('checklist', () => {
  it('ticks a part only when a line fits it, one line per part, passthrough kept, never adds a line', () => {
    const b = applyCategory(openBuild({ lines: L('gin', 'lime juice', 'cucumber') }), skeleton());
    const c = checklist(b);
    expect(c.map((i) => [i.slotId, i.done, i.key])).toEqual([
      ['base', true, 'gin'], ['sour', true, 'lime juice'], ['sweet', false, null], ['bitters', false, null],
    ]);
    expect(c[0]).toMatchObject({ label: 'base spirit', required: true, why: 'the body' });
    expect(c[3].required).toBe(false);
    expect(buildKeys(b)).toHaveLength(3);
    const two = applyCategory(openBuild({ lines: L('gin', 'rye') }), skeleton());
    expect(checklist(two).filter((i) => i.done)).toHaveLength(1);
  });
});

describe('advice', () => {
  const rules = () => [oneOf(isSpirit, 'Two base spirits: a split base, fine, just know it.', { advise: true, kind: 'split-base' })];
  it('reports a second base spirit as a note and the add still succeeds', () => {
    let b = applyCategory(openBuild({ lines: L('gin') }), skeleton(rules()));
    expect(advice(b)).toEqual([]);
    const r = addLine(b, 'rye');
    expect(r.ok).toBe(true);
    b = r.build;
    expect(advice(b)).toEqual([{ kind: 'split-base', message: 'Two base spirits: a split base, fine, just know it.', keys: ['gin', 'rye'] }]);
    expect(advice(removeLine(b, 'rye'))).toEqual([]);
  });
  it('still refuses a duplicate ingredient', () => {
    const b = applyCategory(openBuild({ lines: L('gin') }), skeleton(rules()));
    const r = addLine(b, 'gin');
    expect(r.ok).toBe(false);
    expect(r.reason).toMatch(/already/);
    expect(r.build).toBe(b);
    expect(addLine(openBuild({ lines: L('gin') }), 'gin').ok).toBe(false);
  });
  it('refusal rules are unchanged', () => {
    const b = applyCategory(openBuild({ lines: L('gin') }), skeleton());
    expect(addLine(b, 'rye')).toMatchObject({ ok: false, reason: 'only one base spirit' });
  });
});

describe('recommendCategory', () => {
  const fake = [
    { id: 'a', skeleton: { slots: [{ id: 's1', required: false, accepts: (k) => k === 'x' }, { id: 's2', required: false, accepts: (k) => k === 'y' }] } },
    { id: 'b', skeleton: { slots: [{ id: 's1', required: true, accepts: (k) => k === 'x' }, { id: 's2', required: true, accepts: (k) => k === 'y' }, { id: 's3', required: false, accepts: (k) => k === 'z' }] } },
    { id: 'c', skeleton: { slots: [{ id: 's1', required: false, accepts: (k) => k === 'x' }, { id: 's2', required: false, accepts: (k) => k === 'y' }, { id: 's3', required: false, accepts: (k) => k === 'z' }] } },
  ];
  it('null under two keys or when nothing places two', () => {
    expect(recommendCategory([], fake)).toBeNull();
    expect(recommendCategory(['x'], fake)).toBeNull();
    expect(recommendCategory(['x', 'x'], fake)).toBeNull();
    expect(recommendCategory(['x', 'q'], fake)).toBeNull();
  });
  it('most keys placed wins, then required placed, then order', () => {
    expect(recommendCategory(['x', 'y', 'z'], fake)).toEqual({ id: 'b', placed: 3, requiredPlaced: 2 });
    expect(recommendCategory(['x', 'y', 'z'], fake.filter((c) => c.id !== 'b'))).toEqual({ id: 'c', placed: 3, requiredPlaced: 0 });
    expect(recommendCategory(['x', 'y'], fake)).toEqual({ id: 'b', placed: 2, requiredPlaced: 2 });
    expect(recommendCategory(['x', 'y'], fake.filter((c) => c.id !== 'b'))).toMatchObject({ id: 'a' });
    expect(recommendCategory(['x', 'y'], fake.filter((c) => c.id !== 'b'), { order: ['c', 'a'] })).toMatchObject({ id: 'c' });
    expect(recommendCategory(['x', 'y'], new Map(fake.map((c) => [c.id, c.skeleton])))).toMatchObject({ id: 'b' });
  });
  it('counts distinct slots by best assignment', () => {
    const sk = { slots: [{ id: 'v', required: true, accepts: (k) => ['carrot', 'onion'].includes(k) }, { id: 'a', required: true, accepts: (k) => k === 'onion' }] };
    expect(recommendCategory(['onion', 'carrot'], [{ id: 'k', skeleton: sk }])).toMatchObject({ placed: 2 });
  });
  describe('on the real cocktail families', () => {
    const roles = {
      gin: { role: 'spirit' }, bourbon: { role: 'spirit' }, 'lime juice': { role: 'sour' }, 'simple syrup': { role: 'sweet' },
      sugar: { role: 'sweet' }, 'angostura bitters': { role: 'bitter' },
    };
    const skeletons = INVENT_FAMILY_ORDER.map((id) => ({ id, skeleton: cocktailSkeleton(id, { roles }) }));
    it('gin + lime juice + simple syrup is a Sour (family 2)', () => {
      expect(recommendCategory(['gin', 'lime juice', 'simple syrup'], skeletons, { order: INVENT_FAMILY_ORDER })).toMatchObject({ id: 2, placed: 3 });
    });
    it('bourbon + sugar + bitters is Boozy Sippers (family 3)', () => {
      expect(recommendCategory(['bourbon', 'sugar', 'angostura bitters'], skeletons, { order: INVENT_FAMILY_ORDER })).toMatchObject({ id: 3, placed: 3 });
    });
  });
  it('rankCategories lists every category, best first', () => {
    expect(rankCategories(['x', 'y', 'z'], fake).map((r) => r.id)).toEqual(['b', 'c', 'a']);
  });
});

describe('suggestNext', () => {
  const POOL = [{ key: 'gin', have: false }, { key: 'rye', have: true }, { key: 'lime juice', have: false }, { key: 'lemon juice', have: true },
    { key: 'simple syrup', have: false }, { key: 'angostura bitters', have: true }, { key: 'mint', have: true }];
  const calls = [];
  const rankFn = (arg) => { calls.push(arg); return POOL.filter((c) => !arg.slot || arg.slot.accepts(c.key)); };

  it('without a category: one call with slot null, excludes the list, owned first', () => {
    calls.length = 0;
    const b = openBuild({ lines: L('gin') });
    const out = suggestNext(b, rankFn, 8);
    expect(calls).toHaveLength(1);
    expect(calls[0].slot).toBeNull();
    expect(calls[0].currentKeys).toEqual(['gin']);
    expect(calls[0].build).toBe(b);
    expect(out.map((c) => c.key)).not.toContain('gin');
    const haves = out.map((c) => c.have);
    expect(haves.indexOf(false)).toBeGreaterThan(haves.lastIndexOf(true));
  });
  it('with a category: unticked required parts first (taking turns), then optional, then general; sets slotId', () => {
    const b = applyCategory(openBuild({ lines: L('gin') }), skeleton());
    const out = suggestNext(b, rankFn, 8);
    expect(out[0]).toMatchObject({ key: 'lemon juice', slotId: 'sour' });
    expect(out[1]).toMatchObject({ key: 'simple syrup', slotId: 'sweet' });
    const keys = out.map((c) => c.key);
    expect(keys).not.toContain('gin');
    expect(new Set(keys).size).toBe(keys.length);
    expect(keys.indexOf('angostura bitters')).toBeGreaterThan(keys.indexOf('lime juice'));
    expect(out.find((c) => c.key === 'mint').slotId).toBeUndefined();
  });
  it('drops what a refusal rule would refuse, honours n', () => {
    const b = applyCategory(openBuild({ lines: L('gin') }), skeleton());
    const keys = suggestNext(b, () => ['rye', 'lime juice'], 8).map((c) => c.key);
    expect(keys).not.toContain('rye');
    expect(suggestNext(b, () => ['lime juice', 'lemon juice', 'mint'], 2)).toHaveLength(2);
  });
});

describe('addLine / removeLine / replaceLine', () => {
  it('without a category they work on the flat list', () => {
    let b = deepFreeze(openBuild({ lines: [{ key: 'gin', source: 'user', amount: '2 oz' }, ...L('mint')] }));
    b = addLine(b, 'lime juice').build;
    expect(buildKeys(b)).toEqual(['gin', 'mint', 'lime juice']);
    const r = replaceLine(b, 'gin', 'rye', { have: true });
    expect(r.ok).toBe(true);
    expect(buildKeys(r.build)).toEqual(['rye', 'mint', 'lime juice']);
    expect(r.build.extras[0]).toEqual({ key: 'rye', source: 'user', amount: '2 oz', have: true });
    expect(buildKeys(removeLine(r.build, 'mint'))).toEqual(['rye', 'lime juice']);
    expect(replaceLine(b, 'nope', 'x').ok).toBe(false);
    expect(replaceLine(b, 'gin', 'mint').ok).toBe(false);
  });
  it('with a category addLine places in the first empty accepting slot, else extras', () => {
    let b = applyCategory(openBuild({ lines: L('gin') }), skeleton());
    b = addLine(b, 'lime juice').build;
    b = addLine(b, 'mint').build;
    expect(b.slots.find((s) => s.id === 'sour').line.key).toBe('lime juice');
    expect(b.extras.map((l) => l.key)).toEqual(['mint']);
  });
  it('addLine moves a placed line aside when that frees a slot for the new one', () => {
    const sk = { slots: [
      { id: 'veg', label: 'veg', required: true, accepts: (k) => ['carrot', 'onion'].includes(k) },
      { id: 'aroma', label: 'aromatic', required: true, accepts: (k) => k === 'onion' },
    ] };
    let b = applyCategory(openBuild({ lines: L('onion') }), sk);
    expect(b.slots[0].line.key).toBe('onion');
    b = addLine(b, 'carrot').build;
    expect(b.slots[0].line.key).toBe('carrot');
    expect(b.slots[1].line.key).toBe('onion');
    expect(b.extras).toEqual([]);
  });
  it('removeLine pulls a fitting extra up into the freed slot; replaceLine keeps the slot and fields', () => {
    let b = applyCategory(openBuild({ lines: [{ key: 'gin', source: 'user', amount: '2 oz' }, ...L('lime juice')] }), skeleton());
    b = addLine(b, 'lemon juice').build; // second sour: extras
    expect(b.extras.map((l) => l.key)).toEqual(['lemon juice']);
    const gone = removeLine(b, 'lime juice');
    expect(gone.slots.find((s) => s.id === 'sour').line.key).toBe('lemon juice');
    const r = replaceLine(b, 'gin', 'rye');
    expect(r.build.slots.find((s) => s.id === 'base').line).toMatchObject({ key: 'rye', amount: '2 oz' });
    const out = replaceLine(b, 'gin', 'mint'); // slot refuses mint: line goes to extras
    expect(out.ok).toBe(true);
    expect(out.build.slots.find((s) => s.id === 'base').line).toBeNull();
    expect(buildKeys(out.build)).toContain('mint');
  });
  it('replaceLine is not refused for clashing with the line it replaces', () => {
    const b = applyCategory(openBuild({ lines: L('gin') }), skeleton());
    expect(replaceLine(b, 'gin', 'rye').ok).toBe(true);
  });
});

describe('existing operations on a build with no category', () => {
  it('behave sensibly', () => {
    const b = openBuild({ lines: L('gin') });
    expect(setSlot(b, 'base', 'rye').ok).toBe(false);
    expect(clearSlot(b, 'base')).toEqual(b);
    const added = addExtra(b, 'mint');
    expect(added.ok).toBe(true);
    expect(buildKeys(removeExtra(added.build, 'mint'))).toEqual(['gin']);
  });
});
