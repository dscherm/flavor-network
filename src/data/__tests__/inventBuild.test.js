import { describe, it, expect } from 'vitest';
import {
  seedBuild, fillRequired, shortlist, setSlot, clearSlot, addExtra, removeExtra, missing, buildKeys, oneOf,
} from '../inventBuild.js';
import { FAMILY_SKELETONS } from '../cocktailInvent.js';

const deepFreeze = (o) => {
  if (o && typeof o === 'object' && !Object.isFrozen(o)) {
    Object.freeze(o);
    Object.values(o).forEach(deepFreeze);
  }
  return o;
};

const SPIRITS = ['bourbon', 'rye', 'gin'];
const SOURS = ['lemon juice', 'lime juice'];
const isSpirit = (k) => SPIRITS.includes(k);
const isSour = (k) => SOURS.includes(k);
const skeleton = (extra = {}) => ({
  slots: [
    { id: 'base', label: 'base spirit', required: true, accepts: isSpirit },
    { id: 'sour', label: 'sour', required: true, accepts: isSour },
    { id: 'sweet', label: 'sweetener', required: true, accepts: (k) => /syrup/.test(k) },
    { id: 'bitters', label: 'bitters', required: false, accepts: (k) => /bitters/.test(k) },
  ],
  rules: [
    oneOf(isSpirit, 'only one base spirit'),
    oneOf(isSour, 'never two sours'),
  ],
  ...extra,
});
const POOL = ['gin', 'rye', 'lemon juice', 'lime juice', 'simple syrup', 'honey syrup', 'angostura bitters'];
const rankFn = (slot) => POOL.filter((k) => slot.accepts(k));
const lineOf = (b, id) => b.slots.find((s) => s.id === id).line;

describe('seedBuild', () => {
  it('puts pinned keys in the first accepting slot, locked with source; unmatched go to extras', () => {
    const b = seedBuild(skeleton(), {
      lab: 'cocktail', baseline: { family: 2 },
      pinned: [{ key: 'bourbon', source: 'user' }, { key: 'lime juice', source: 'search' }, { key: 'cucumber', source: 'search' }],
    });
    expect(b.lab).toBe('cocktail');
    expect(b.baseline).toEqual({ family: 2 });
    expect(lineOf(b, 'base')).toEqual({ key: 'bourbon', source: 'user' });
    expect(lineOf(b, 'sour')).toEqual({ key: 'lime juice', source: 'search' });
    expect(b.slots.find((s) => s.id === 'base').locked).toBe(true);
    expect(b.slots.find((s) => s.id === 'sweet').locked).toBe(false);
    expect(b.extras).toEqual([{ key: 'cucumber', source: 'search' }]);
  });

  it('a second key for a filled slot goes to the next accepting slot, else extras', () => {
    const sk = skeleton({ rules: [] });
    sk.slots.push({ id: 'base2', label: 'second spirit', required: false, accepts: isSpirit });
    const b = seedBuild(sk, { pinned: [{ key: 'rye', source: 'user' }, { key: 'gin', source: 'user' }, { key: 'bourbon', source: 'user' }] });
    expect(lineOf(b, 'base').key).toBe('rye');
    expect(lineOf(b, 'base2').key).toBe('gin');
    expect(b.extras.map((l) => l.key)).toEqual(['bourbon']);
  });

  it('skips a pin a rule refuses and records why', () => {
    const b = seedBuild(skeleton(), { pinned: [{ key: 'rye', source: 'user' }, { key: 'gin', source: 'search' }] });
    expect(buildKeys(b)).toEqual(['rye']);
    expect(b.rejected).toEqual([{ key: 'gin', reason: 'only one base spirit' }]);
  });
});

describe('fillRequired', () => {
  it('fills empty required slots with the top pick; leaves optional, locked and user-set untouched', () => {
    let b = seedBuild(skeleton(), { pinned: [{ key: 'bourbon', source: 'user' }] });
    b = setSlot(b, 'sweet', 'honey syrup').build;
    const filled = fillRequired(b, rankFn);
    expect(lineOf(filled, 'base')).toEqual({ key: 'bourbon', source: 'user' });
    expect(filled.slots.find((s) => s.id === 'base').locked).toBe(true);
    expect(lineOf(filled, 'sweet')).toEqual({ key: 'honey syrup', source: 'user' });
    expect(lineOf(filled, 'sour')).toEqual({ key: 'lemon juice', source: 'auto' });
    expect(lineOf(filled, 'bitters')).toBeNull();
    expect(missing(filled)).toEqual([]);
  });

  it('keeps extra fields from rankFn objects, skips unusable keys, leaves a slot empty with no pick', () => {
    const b = seedBuild(skeleton(), { pinned: [{ key: 'lemon juice', source: 'user' }] });
    const f = fillRequired(b, (slot) => (slot.id === 'sour'
      ? [{ key: 'lemon juice' }, { key: 'lime juice' }]
      : slot.id === 'base' ? [{ key: 'honey syrup' }, { key: 'gin', have: true }, 'rye'] : []));
    expect(lineOf(f, 'base')).toEqual({ key: 'gin', have: true, source: 'auto' });
    expect(lineOf(f, 'sour').source).toBe('user');
    expect(missing(f)).toEqual(['sweetener']);
  });
});

describe('shortlist', () => {
  it('excludes keys already in the build and re-ranks when another slot changes', () => {
    const seen = [];
    const rank = (slot, keys) => {
      seen.push(keys);
      return keys.includes('rye') ? ['honey syrup', 'simple syrup'] : ['simple syrup', 'honey syrup'];
    };
    let b = fillRequired(seedBuild(skeleton(), {}), rankFn);
    expect(lineOf(b, 'sweet').key).toBe('simple syrup');
    expect(shortlist(b, 'sweet', rank).map((c) => c.key)).toEqual(['honey syrup']);
    b = setSlot(b, 'base', 'rye').build;
    expect(shortlist(b, 'sweet', rank).map((c) => c.key)).toEqual(['honey syrup']);
    expect(seen.at(-1)).toContain('rye');
    expect(seen.at(-1)).not.toContain('simple syrup');
    b = clearSlot(b, 'sweet');
    expect(shortlist(b, 'sweet', rank).map((c) => c.key)).toEqual(['honey syrup', 'simple syrup']);
    expect(shortlist(b, 'sweet', rank, 1)).toHaveLength(1);
    expect(shortlist(b, 'nope', rank)).toEqual([]);
  });

  it('does not offer a key a rule would refuse', () => {
    const b = seedBuild(skeleton(), { pinned: [{ key: 'bourbon', source: 'user' }] });
    expect(shortlist(b, 'base', () => ['gin', 'rye']).map((c) => c.key)).toEqual(['gin', 'rye']);
    expect(shortlist(b, 'sour', () => ['lemon juice', 'bourbon']).map((c) => c.key)).toEqual(['lemon juice']);
  });
});

describe('clearSlot / missing', () => {
  it('leaves a required slot empty, lists its label, and nothing refills it until fillRequired', () => {
    let b = fillRequired(seedBuild(skeleton(), {}), rankFn);
    b = clearSlot(b, 'sour');
    expect(lineOf(b, 'sour')).toBeNull();
    expect(missing(b)).toEqual(['sour']);
    b = addExtra(b, 'cucumber').build;
    b = setSlot(b, 'sweet', 'honey syrup').build;
    b = removeExtra(b, 'cucumber');
    expect(missing(b)).toEqual(['sour']);
    expect(missing(fillRequired(b, rankFn))).toEqual([]);
  });

  it('lists only required slots', () => {
    expect(missing(seedBuild(skeleton(), {}))).toEqual(['base spirit', 'sour', 'sweetener']);
  });
});

describe('guard rails', () => {
  const full = () => fillRequired(seedBuild(skeleton(), { pinned: [{ key: 'bourbon', source: 'user' }] }), rankFn);

  it('refuses a duplicate key, anywhere in the build', () => {
    const b = addExtra(full(), 'cucumber').build;
    for (const r of [addExtra(b, 'cucumber'), addExtra(b, 'lemon juice'), setSlot(b, 'bitters', 'cucumber')]) {
      expect(r.ok).toBe(false);
      expect(r.reason).toBeTruthy();
      expect(r.build).toBe(b);
    }
    expect(addExtra(b, 'cucumber').reason).toBe('cucumber is already in the build');
  });

  it('refuses a second base spirit', () => {
    const b = full();
    const r = addExtra(b, 'gin');
    expect(r).toEqual({ ok: false, build: b, reason: 'only one base spirit' });
  });

  it('refuses a second sour', () => {
    const b = full();
    expect(addExtra(b, 'lime juice')).toEqual({ ok: false, build: b, reason: 'never two sours' });
  });

  it('allows swapping a slot for a key of the same kind (the replaced pick is not counted)', () => {
    const b = full();
    const r = setSlot(b, 'base', 'rye');
    expect(r.ok).toBe(true);
    expect(lineOf(r.build, 'base').key).toBe('rye');
    expect(setSlot(b, 'sour', 'lime juice').ok).toBe(true);
  });

  it('refuses a key the slot does not accept, and an unknown slot', () => {
    const b = full();
    const r = setSlot(b, 'base', 'honey syrup');
    expect(r.ok).toBe(false);
    expect(r.build).toBe(b);
    expect(r.reason).toMatch(/base spirit/);
    expect(setSlot(b, 'zzz', 'gin').ok).toBe(false);
  });

  it('runs lab rules with (build, key, slotId|null)', () => {
    const calls = [];
    const sk = skeleton({ rules: [(build, key, slotId) => { calls.push([key, slotId]); return key === 'ice' ? 'no ice here' : null; }] });
    const b = seedBuild(sk, {});
    expect(addExtra(b, 'ice').reason).toBe('no ice here');
    setSlot(b, 'base', 'gin');
    expect(calls).toEqual([['ice', null], ['gin', 'base']]);
  });
});

describe('purity', () => {
  it('works on a deep-frozen build and never mutates it', () => {
    const b = deepFreeze(fillRequired(seedBuild(skeleton(), { pinned: [{ key: 'bourbon', source: 'user' }, { key: 'mint', source: 'search' }] }), rankFn));
    const snap = JSON.stringify(b);
    expect(setSlot(b, 'sweet', 'honey syrup').ok).toBe(true);
    expect(addExtra(b, 'cucumber').ok).toBe(true);
    expect(removeExtra(b, 'mint').extras).toEqual([]);
    expect(clearSlot(b, 'base').slots[0].line).toBeNull();
    expect(fillRequired(clearSlot(b, 'sour'), rankFn)).not.toBe(b);
    expect(shortlist(b, 'bitters', rankFn)).toHaveLength(1);
    expect(missing(b)).toEqual([]);
    expect(buildKeys(b)).toEqual(['bourbon', 'lemon juice', 'simple syrup', 'mint']);
    expect(JSON.stringify(b)).toBe(snap);
    expect(b.extras).toHaveLength(1);
  });
});

describe('hosts a real cocktail skeleton', () => {
  it('FAMILY_SKELETONS[2] through a thin accepts adapter', () => {
    const roles = { bourbon: 'spirit', gin: 'spirit', 'lemon juice': 'sour', 'lime juice': 'sour', 'simple syrup': 'sweet', 'triple sec': 'amaro_liqueur', campari: 'amaro_liqueur' };
    const fam = FAMILY_SKELETONS[2];
    const sk = {
      slots: fam.slots.map((s) => ({
        ...s,
        accepts: (k) => s.roles.includes(roles[k]) && (!s.test || !!s.test(k, roles[k])),
      })),
      rules: [oneOf((k) => roles[k] === 'spirit', 'one base spirit only'), oneOf((k) => roles[k] === 'sour', 'never two sours')],
    };
    let b = seedBuild(sk, { lab: 'cocktail', baseline: { family: 2 }, pinned: [{ key: 'bourbon', source: 'user' }] });
    expect(b.slots.map((s) => s.id)).toEqual(['base', 'sour', 'sweet']);
    expect(b.slots[0].base).toBe(true);
    b = fillRequired(b, () => Object.keys(roles));
    expect(buildKeys(b)).toEqual(['bourbon', 'lemon juice', 'simple syrup']);
    expect(addExtra(b, 'gin').reason).toBe('one base spirit only');
    expect(setSlot(b, 'sweet', 'triple sec').ok).toBe(true);
    expect(setSlot(b, 'sweet', 'campari').ok).toBe(false);
    expect(shortlist(b, 'sweet', () => Object.keys(roles)).map((c) => c.key)).toEqual(['triple sec']);
  });
});
