import { describe, it, expect } from 'vitest';
import { buildPairingIndex } from '../recipePairingMatch.js';
import { buildRolePool, roleOf } from '../cocktailRiff.js';
import {
  FAMILY_SKELETONS, scaleAmounts, formatOz, ozOf, isBaseSpirit, ingredientKind, drinkAsCocktail,
  cocktailSkeleton, cocktailAdviceRules, rankCocktailSlot, drinkFromBuild, drinkRows, extraAmount, FAMILY_BLURB,
} from '../cocktailInvent.js';
import { seedBuild, fillRequired, setSlot, addExtra, advice, openBuild } from '../inventBuild.js';

const roles = {
  gin: { role: 'spirit' }, rye: { role: 'spirit' }, bourbon: { role: 'spirit' }, vodka: { role: 'spirit' }, rum: { role: 'spirit' },
  sherry: { role: 'spirit' },
  'lemon juice': { role: 'sour' }, 'lime juice': { role: 'sour' }, 'orange juice': { role: 'sour' },
  'simple syrup': { role: 'sweet' }, 'honey syrup': { role: 'sweet' },
  'sweet vermouth': { role: 'vermouth' }, 'dry vermouth': { role: 'vermouth' },
  campari: { role: 'amaro_liqueur' }, aperol: { role: 'amaro_liqueur' }, 'amaro montenegro': { role: 'amaro_liqueur' },
  'triple sec': { role: 'amaro_liqueur' }, 'maraschino liqueur': { role: 'amaro_liqueur' }, prosecco: { role: 'amaro_liqueur' },
  'soda water': { role: 'modifier' }, 'pineapple juice': { role: 'modifier' }, 'egg white': { role: 'modifier' },
  'angostura bitters': { role: 'bitter' },
};
const names = Object.keys(roles);
const index = buildPairingIndex([
  { source: 'rye', target: 'amaro montenegro', strength: 0.9, known: true },
  { source: 'rye', target: 'lemon juice', strength: 0.5, known: true },
  { source: 'amaro montenegro', target: 'lemon juice', strength: 0.4, known: true },
  { source: 'rye', target: 'simple syrup', strength: 0.3, known: true },
  { source: 'gin', target: 'campari', strength: 0.8, known: true },
  { source: 'gin', target: 'sweet vermouth', strength: 0.8, known: true },
  { source: 'campari', target: 'sweet vermouth', strength: 0.9, known: true },
  { source: 'campari', target: 'soda water', strength: 0.6, known: true },
], names);
const pool = buildRolePool(roles, index.names);

describe('amounts', () => {
  it('parses and formats quarter ounces', () => {
    expect(ozOf('¾ oz')).toBe(0.75);
    expect(ozOf('2 oz')).toBe(2);
    expect(ozOf('2 dashes')).toBeNull();
    expect(formatOz(1.75)).toBe('1¾ oz');
    expect(formatOz(0.5)).toBe('½ oz');
    expect(formatOz(2)).toBe('2 oz');
    expect(formatOz(0.05)).toBe('¼ oz');
  });
  it('scales the pour into the family volume range, leaving dashes alone', () => {
    const skel = FAMILY_SKELETONS[4];
    const filled = skel.slots.map((slot) => ({ slot, role: slot.roles[0] }));
    const amounts = scaleAmounts(filled, skel.volume);
    const total = amounts.map(ozOf).filter((x) => x != null).reduce((a, b) => a + b, 0);
    expect(total).toBeGreaterThanOrEqual(skel.volume[0] - 0.25);
    expect(total).toBeLessThanOrEqual(skel.volume[1] + 0.25);
    expect(amounts[amounts.length - 1]).toBe('2 dashes');
  });
});

describe('ingredientKind', () => {
  it('separates bubbles, citrus, dairy and liqueurs', () => {
    expect(ingredientKind('prosecco', 'amaro_liqueur')).toBe('bubbles');
    expect(ingredientKind('soda water', 'modifier')).toBe('bubbles');
    expect(ingredientKind('lime juice', 'sour')).toBe('citrus');
    expect(ingredientKind('egg white', 'modifier')).toBe('dairy');
    expect(ingredientKind('campari', 'amaro_liqueur')).toBe('bitter');
    expect(ingredientKind('triple sec', 'amaro_liqueur')).toBe('sweet liqueur');
  });
});

describe('cocktailSkeleton', () => {
  it('has the family slots with accepts() adapters', () => {
    const sk = cocktailSkeleton(2, { roles });
    expect(sk.slots.map((s) => s.id)).toEqual(['base', 'sour', 'sweet']);
    const [base, sour, sweet] = sk.slots;
    expect(base.accepts('rye')).toBe(true);
    expect(base.accepts('campari')).toBe(false);
    expect(sour.accepts('lime juice')).toBe(true);
    expect(sour.accepts('simple syrup')).toBe(false);
    expect(sweet.accepts('simple syrup')).toBe(true);
    expect(sweet.accepts('lemon juice')).toBe(false);
  });
  it('a second base spirit and a second sour are advice, not refusals; a duplicate is refused', () => {
    const b = seedBuild(cocktailSkeleton(2, { roles }), { pinned: [{ key: 'gin', source: 'user' }] });
    const r = addExtra(b, 'rye');
    expect(r.ok).toBe(true);
    expect(advice(r.build).map((a) => a.kind)).toEqual(['split-base']);
    expect(advice(r.build)[0].message).toMatch(/split base/i);
    const s = setSlot(b, 'sour', 'lemon juice');
    const two = addExtra(s.build, 'lime juice');
    expect(two.ok).toBe(true);
    expect(advice(two.build).map((a) => a.kind)).toEqual(['two-sours']);
    expect(addExtra(s.build, 'lemon juice').ok).toBe(false);
  });
  it('cocktailAdviceRules work on a flat, style-less build', () => {
    const flat = openBuild({ lab: 'cocktail', rules: cocktailAdviceRules(roles), lines: [{ key: 'gin' }, { key: 'rye' }] });
    expect(advice(flat)[0].kind).toBe('split-base');
  });
});

describe('rankCocktailSlot', () => {
  const slot = cocktailSkeleton(4, { roles }).slots.find((s) => s.id === 'vermouth');
  it('puts bar bottles first and marks them, then the rest of the pool', () => {
    const r = rankCocktailSlot({ slot, currentKeys: ['gin'], bar: ['dry vermouth'], pool, roles, pairingIndex: index });
    expect(r[0]).toMatchObject({ key: 'dry vermouth', have: true });
    expect(r.find((c) => c.key === 'sweet vermouth').have).toBe(false);
  });
  it('ranks by mean pairing with the current keys', () => {
    const r = rankCocktailSlot({ slot, currentKeys: ['gin', 'campari'], bar: [], pool, roles, pairingIndex: index });
    expect(r[0].key).toBe('sweet vermouth');
    expect(r.every((c) => c.have === false)).toBe(true);
    expect(r[0].score).toBeGreaterThan(r[1].score);
  });
  it('with no slot ranks the whole pool of every role by pairing, bar first', () => {
    const r = rankCocktailSlot({ slot: null, currentKeys: ['gin'], bar: ['dry vermouth'], pool, roles, pairingIndex: index });
    expect(r[0]).toMatchObject({ key: 'dry vermouth', have: true });
    const roleSet = new Set(r.map((c) => roleOf(c.key, roles)));
    expect(roleSet.size).toBeGreaterThan(3);
    expect(r.map((c) => c.key)).not.toContain('gin');
    const open = rankCocktailSlot({ slot: null, currentKeys: ['gin', 'campari'], bar: [], pool, roles, pairingIndex: index });
    expect(open[0].key).toBe('sweet vermouth');
  });
  it('excludes keys already in the build', () => {
    const r = rankCocktailSlot({ slot, currentKeys: ['sweet vermouth'], bar: [], pool, roles, pairingIndex: index });
    expect(r.map((c) => c.key)).not.toContain('sweet vermouth');
  });
});

describe('drinkFromBuild', () => {
  const rankFn = (slot, currentKeys) => rankCocktailSlot({ slot, currentKeys, bar: [], pool, roles, pairingIndex: index });
  const make = (familyId, pinned) => fillRequired(seedBuild(cocktailSkeleton(familyId, { roles }), { pinned }), rankFn);
  it('turns a filled build into the card drink, re-scaling amounts', () => {
    const d = drinkFromBuild(make(2, [{ key: 'gin', source: 'user' }]), { familyId: 2, familyName: 'Sour Family', roles, pairingIndex: index });
    expect(d.lines.map((l) => l.slot)).toEqual(['base', 'sour', 'sweet']);
    expect(d.lines[0]).toMatchObject({ key: 'gin', amount: '2 oz', locked: true, source: 'user' });
    expect(d.family).toBe('Sour Family');
    expect(d.build).toMatch(/Shake/);
    expect(d.glass).toMatch(/Coupe/);
    expect(d.name).toMatch(/^Gin .*Sour$/);
  });
  it('gives extras a default pour by role and keeps riff/closest helpers working', () => {
    let b = make(2, [{ key: 'gin', source: 'user' }]);
    b = addExtra(b, 'angostura bitters').build;
    const d = drinkFromBuild(b, { familyId: 2, roles });
    const extra = d.lines.find((l) => l.slot === 'extra');
    expect(extra).toMatchObject({ key: 'angostura bitters', amount: '2 dashes' });
    expect(drinkAsCocktail(d).ingredients_raw.at(-1).raw).toBe('2 dashes angostura bitters');
    expect(drinkRows(d).at(-1)).toMatchObject({ key: 'angostura bitters', role: 'bitter' });
  });
  it('a sour is 2 : ¾ : ¾, and converts to a codex-shaped cocktail the riff panel can read', () => {
    const d = drinkFromBuild(make(2, [{ key: 'gin', source: 'user' }, { key: 'lemon juice', source: 'user' }, { key: 'simple syrup', source: 'user' }]), { familyId: 2, roles, pairingIndex: index });
    expect(d.lines.map((l) => l.amount)).toEqual(['2 oz', '¾ oz', '¾ oz']);
    const c = drinkAsCocktail(d);
    expect(c.ingredients_raw.map((r) => r.raw)).toEqual(['2 oz gin', '¾ oz lemon juice', '¾ oz simple syrup']);
    expect(roleOf(c.ingredients_raw[1].raw, roles)).toBe('sour');
  });
  it('a solid or herb extra is never "1 dash" or poured', () => {
    let b = make(2, [{ key: 'gin', source: 'user' }]);
    b = addExtra(b, 'cucumber').build;
    b = addExtra(b, 'mint leaves').build;
    b = addExtra(b, 'fresh mint').build;
    b = addExtra(b, 'olives').build;
    const d = drinkFromBuild(b, { familyId: 2, roles });
    const amount = (k) => d.lines.find((l) => l.key === k).amount;
    expect(amount('cucumber')).toBe('a few slices');
    expect(amount('mint leaves')).toBe('a few leaves');
    expect(amount('fresh mint')).toBe('a sprig');
    expect(amount('olives')).toBe('a few');
    expect(d.lines.filter((l) => l.slot === 'extra').some((l) => /dash/.test(l.amount))).toBe(false);
  });
  it('works on a build with an empty slot (no crash, fewer lines)', () => {
    const b = fillRequired(seedBuild(cocktailSkeleton(4, { roles }), {}), () => []);
    const d = drinkFromBuild(b, { familyId: 4, roles });
    expect(d.lines).toEqual([]);
    expect(typeof d.name).toBe('string');
  });
});

describe('FAMILY_BLURB', () => {
  it('has one plain line per family', () => {
    expect(Object.keys(FAMILY_BLURB).sort()).toEqual(['0', '1', '2', '3', '4', '5']);
    expect(FAMILY_BLURB[2]).toBe('bright, shaken, citrus-forward');
    expect(FAMILY_BLURB[5]).toBe('low-proof, bittersweet, bubbly');
  });
});

describe('extraAmount', () => {
  it('keeps liquid defaults by role and a dash only for a liquid aromatic', () => {
    expect(extraAmount('angostura bitters', 'bitter')).toBe('2 dashes');
    expect(extraAmount('lime juice', 'sour')).toBe('¼ oz');
    expect(extraAmount('orange juice', 'modifier')).toBe('½ oz');
    expect(extraAmount('rose water', 'aromatic')).toBe('1 dash');
    expect(extraAmount('orange slice', 'aromatic')).toBe('a few slices');
    expect(extraAmount('basil', null)).toBe('a sprig');
    expect(extraAmount('mystery thing', null)).toBe('to taste');
  });
});
