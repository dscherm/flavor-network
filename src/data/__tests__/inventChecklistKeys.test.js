import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { openBuild, applyCategory, clearCategory, checklist, advice, oneOf } from '../inventBuild.js';
import { FAMILY_SKELETONS, cocktailSkeleton, cocktailAdviceRules } from '../cocktailInvent.js';
import { sauceSkeleton } from '../inventSauce.js';
import { buildCategoryMap } from '../saucePantry.js';

const L = (...keys) => keys.map((key) => ({ key, source: 'user' }));
const augment = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../../../public/data/sauce_augment.json'), 'utf8'));
const catMap = buildCategoryMap(augment.ingredients);

describe('checklist(): the ticked part always carries the cook\'s ingredient', () => {
  it('a skeleton slot\'s own `key` flag (names the drink) never replaces the ingredient', () => {
    const roles = {
      bourbon: { role: 'spirit' }, 'simple syrup': { role: 'sweet' }, 'angostura bitters': { role: 'bitter' },
    };
    const boozy = Object.entries(FAMILY_SKELETONS).find(([, f]) => f.name === 'Boozy Sippers')[0];
    const items = checklist(applyCategory(openBuild({ lines: L('bourbon', 'simple syrup', 'angostura bitters') }), cocktailSkeleton(Number(boozy), { roles })));
    const sweet = items.find((i) => i.label === 'sweetener');
    expect(sweet).toMatchObject({ done: true, key: 'simple syrup' });
    expect(items.filter((i) => i.done).map((i) => i.key).sort()).toEqual(['angostura bitters', 'bourbon', 'simple syrup']);
    for (const i of items) expect(typeof i.key === 'string' || i.key === null).toBe(true);
  });

  it('sauce: butter + egg yolk + lemon juice ticked as an Emulsion all show their ingredient', () => {
    const items = checklist(applyCategory(openBuild({ lines: L('butter', 'egg yolk', 'lemon juice') }), sauceSkeleton('Hollandaise', { catMap })));
    const done = items.filter((i) => i.done);
    expect(done.map((i) => i.key).sort()).toEqual(['butter', 'egg yolk', 'lemon juice']);
    expect(done.every((i) => typeof i.key === 'string')).toBe(true);
    expect(items.find((i) => i.slotId === 'acid').key).toBe('lemon juice');
  });

  it('an unticked part has key null', () => {
    const items = checklist(applyCategory(openBuild({ lines: L('butter') }), sauceSkeleton('Hollandaise', { catMap })));
    expect(items.filter((i) => !i.done).every((i) => i.key === null)).toBe(true);
  });
});

describe('baseRules survive a category being applied and cleared', () => {
  const kind = 'split-base';
  const isSpirit = (k) => ['gin', 'rye'].includes(k);
  const base = () => [oneOf(isSpirit, 'split base', { advise: true, kind })];
  const skel = (rules) => ({ slots: [{ id: 'base', label: 'base', required: true, accepts: isSpirit }], rules });

  it('clearCategory restores the lab\'s rules, not []', () => {
    const open = openBuild({ rules: base(), lines: L('gin', 'rye') });
    const there = applyCategory(open, skel([]));
    const back = clearCategory(there);
    expect(back.rules).toBe(open.baseRules);
    expect(advice(back).map((a) => a.kind)).toEqual([kind]);
  });

  it('applyCategory keeps the base rules and does not double an advice rule of the same kind', () => {
    const open = openBuild({ rules: base(), lines: L('gin', 'rye') });
    const there = applyCategory(open, skel(base()));
    expect(advice(there).map((a) => a.kind)).toEqual([kind]);
    expect(there.rules).toHaveLength(1);
    const withExtra = applyCategory(open, skel([oneOf(() => false, 'x')]));
    expect(withExtra.rules).toHaveLength(2);
  });

  it('the real cocktail advice rules still report after apply then clear', () => {
    const roles = { gin: { role: 'spirit' }, rye: { role: 'spirit' }, 'lemon juice': { role: 'sour' } };
    const open = openBuild({ lab: 'cocktail', rules: cocktailAdviceRules(roles), lines: L('gin', 'rye') });
    const cycled = clearCategory(applyCategory(open, cocktailSkeleton(2, { roles })));
    expect(advice(cycled).map((a) => a.kind)).toEqual(['split-base']);
  });
});
