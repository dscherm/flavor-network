import { describe, it, expect } from 'vitest';
import { aromaProfile, ingredientAroma, AROMALESS_WEIGHT, AROMA_AXES } from '../flavorAroma.js';
import { buildFlavorProfile } from '../inventProfile.js';
import { nodeProbs, drawRule, profileDelta } from '../recipeProfileAnalysis.js';

const L = (key, amount) => ({ key, amount });

describe('aromaProfile', () => {
  it('scores the six chart axes, all 0..1, and counts what it knows', () => {
    const p = aromaProfile([L('mint', '5 g'), L('lemon juice', '1 oz')]);
    expect(Object.keys(p.scores)).toEqual(AROMA_AXES);
    for (const v of Object.values(p.scores)) { expect(v).toBeGreaterThanOrEqual(0); expect(v).toBeLessThanOrEqual(1); }
    expect(p.counted).toEqual(['mint', 'lemon juice']);
    expect(p.uncounted).toEqual([]);
    expect(p.charted).toBe(true);
  });
  it('an ingredient with no line is not counted; with nothing counted nothing is charted', () => {
    const p = aromaProfile([L('zzz unknown', '1 oz'), L('mint', '5 g')]);
    expect(p.uncounted).toEqual(['zzz unknown']);
    expect(p.counted).toEqual(['mint']);
    const none = aromaProfile([L('zzz unknown', '1 oz')]);
    expect(none.charted).toBe(false);
    expect(none.n).toBe(0);
    expect(Object.values(none.scores).every((v) => v === 0)).toBe(true);
  });
  it('a mint leaf or a citrus twist registers against 2 oz of spirit', () => {
    const spirit = aromaProfile([L('gin', '2 oz'), L('vodka', '2 oz')]);
    const withMint = aromaProfile([L('gin', '2 oz'), L('mint', '2 g')]);
    expect(withMint.scores.odor_green).toBeGreaterThan(1.5 * spirit.scores.odor_green);
    const twist = aromaProfile([L('vodka', '2 oz'), L('lemon', '2 g')]);
    expect(twist.scores.odor_fruity).toBeGreaterThan(0.15);
    expect(twist.drivers.odor_fruity[0]).toBe('lemon');
  });
  it('a dash of bitters is a note, not the drink', () => {
    const p = aromaProfile([L('bourbon', '2 oz'), L('angostura bitters', '2 dashes')]);
    expect(p.scores.odor_woody).toBeGreaterThan(p.scores.odor_spicy);
    expect(p.scores.odor_spicy).toBeGreaterThan(0.05);
  });
  it('the table overrides the fallback lookup, and the lookup is used only where the table has nothing', () => {
    const fb = () => ({ axes: { floral: 3 }, potency: 1 });
    const mixed = aromaProfile([L('mint', '5 g'), L('zzz unknown', '5 g')], fb);
    expect(mixed.counted).toEqual(['mint', 'zzz unknown']);
    expect(mixed.drivers.odor_green[0]).toBe('mint');
    expect(mixed.scores.odor_floral).toBeGreaterThan(0);
    const onlyMint = aromaProfile([L('mint', '5 g')], fb);
    expect(onlyMint.scores.odor_floral).toBe(0);
    expect(ingredientAroma('mint', { lookup: fb }).fromTable).toBe(true);
    expect(ingredientAroma('zzz unknown', { lookup: fb }).fromTable).toBe(false);
  });
  it('table: null switches the hand-tuned table off', () => {
    const p = aromaProfile([L('mint', '5 g')], null, { table: null });
    expect(p.counted).toEqual([]);
    expect(p.charted).toBe(false);
  });
  it('aromaless ingredients (water, sugar, vodka) count as data and dilute at AROMALESS_WEIGHT', () => {
    expect(AROMALESS_WEIGHT).toBeGreaterThan(0);
    expect(AROMALESS_WEIGHT).toBeLessThan(1);
    const neat = aromaProfile([L('gin', '2 oz')]);
    const long = aromaProfile([L('gin', '2 oz'), L('soda water', '4 oz'), L('sugar', '1 tsp')]);
    expect(long.counted).toEqual(['gin', 'soda water', 'sugar']);
    expect(long.scores.odor_green).toBeLessThan(neat.scores.odor_green);
    expect(long.scores.odor_green).toBeGreaterThan(0.4 * neat.scores.odor_green);
    const water = aromaProfile([L('water', '1 cup'), L('sugar', '1 cup')]);
    expect(water.counted.length).toBe(2);
    expect(water.charted).toBe(false);
  });
  it('without amounts every ingredient counts equally; with some, an unmeasured one gets a typical portion or the mean', () => {
    const eq = aromaProfile([L('mint'), L('butter')]);
    expect(eq.weighted).toBe(false);
    const w = aromaProfile([L('butter', '100 g'), L('cinnamon', '1')]);
    expect(w.weighted).toBe(true);
    expect(w.scores.odor_spicy).toBeGreaterThan(0.05);
  });
  it('a bare count of a whole citrus fruit counts as its zest, not the whole fruit', () => {
    const p = aromaProfile([L('bourbon', '2 oz'), L('orange', '1')]);
    const big = aromaProfile([L('bourbon', '2 oz'), L('orange', '100 g')]);
    expect(big.scores.odor_fruity).toBeGreaterThan(2 * p.scores.odor_fruity);
  });
  it('plain string keys and bad input do not throw', () => {
    expect(aromaProfile(['mint', 'butter']).counted).toEqual(['mint', 'butter']);
    expect(aromaProfile(null).n).toBe(0);
    expect(aromaProfile([null, {}, { key: '' }]).n).toBe(0);
  });
  it('drivers name up to three ingredients, strongest first', () => {
    const p = aromaProfile([L('mint', '3 g'), L('basil', '3 g'), L('parsley', '3 g'), L('cilantro', '3 g')]);
    expect(p.drivers.odor_green.length).toBe(3);
    expect(p.drivers.odor_green[0]).toBe('mint');
  });
});

describe('the aroma half in the shared profile', () => {
  const nodes = new Map();
  it('nodeProbs reads the aroma table by name and never the model values', () => {
    const fakeModel = { gnnProbs: { odor_fruity: 0.9, odor_floral: 0.9, odor_green: 0.9, odor_woody: 0.9, odor_spicy: 0.9, odor_fatty: 0.9 } };
    const p = nodeProbs('mint', new Map([['mint', fakeModel]]));
    expect(p.odor_green).toBe(1);
    expect(p.odor_floral).toBe(0);
    expect(nodeProbs('zzz unknown', new Map([['zzz unknown', fakeModel]]))).toBeNull();
  });
  it('an aromaless ingredient is flagged and has zero on every aroma axis', () => {
    const p = nodeProbs('soda water', nodes);
    expect(p._aromaless).toBe(true);
    for (const a of AROMA_AXES) expect(p[a]).toBe(0);
  });
  it('the draw rule: at least two ingredients and at least half with an aroma line', () => {
    expect(drawRule(4, 4, 2).aromaDrawn).toBe(true);
    expect(drawRule(4, 4, 1).aromaDrawn).toBe(false);
    expect(drawRule(5, 5, 2).aromaDrawn).toBe(false);
    expect(drawRule(2, 2, 2).aromaDrawn).toBe(true);
    expect(drawRule(4, 4, 2, 6).aromaDrawn).toBe(false);
  });
  it('a spirit, citrus and sugar cocktail draws its citrus aroma', () => {
    const p = buildFlavorProfile(['white rum', 'lime juice', 'simple syrup'], nodes, { amounts: { 'white rum': '2 oz', 'lime juice': '3/4 oz', 'simple syrup': '1/2 oz' } });
    expect(p.aromaDrawn).toBe(true);
    expect(p.axes.filter((a) => a.startsWith('odor_'))[0]).toBe('odor_fruity');
  });
  it('a recipe where fewer than half the ingredients have an aroma line draws no aroma', () => {
    const p = buildFlavorProfile(['mint', 'zzz one', 'zzz two', 'zzz three'], nodes);
    expect(p.aromaDrawn).toBe(false);
    expect(p.axes.some((a) => a.startsWith('odor_'))).toBe(false);
  });
  it('a garnish twist or mint sprig adds to the aroma half only', () => {
    const amounts = { bourbon: '2 oz', 'simple syrup': '1/4 oz' };
    const base = buildFlavorProfile(['bourbon', 'simple syrup'], nodes, { amounts });
    const twist = buildFlavorProfile(['bourbon', 'simple syrup'], nodes, { amounts, garnish: '1 orange twist' });
    expect(twist.scores.odor_fruity).toBeGreaterThan(base.scores.odor_fruity);
    for (const a of ['sweet', 'sour', 'bitter', 'salty', 'umami', 'heat']) expect(twist.scores[a]).toBe(base.scores[a]);
    const mint = buildFlavorProfile(['gin', 'lime juice'], nodes, { amounts: { gin: '2 oz', 'lime juice': '3/4 oz' }, garnish: 'Mint sprig' });
    expect(mint.drivers.odor_green).toContain('mint');
  });
  it('profileDelta: adding mint to a drink moves green up; adding soda dilutes aroma', () => {
    const base = buildFlavorProfile(['gin', 'lime juice'], nodes, { amounts: { gin: '2 oz', 'lime juice': '3/4 oz' } });
    expect(profileDelta('mint', base.scores, 2, nodes).odor_green).toBeGreaterThan(0);
    expect(profileDelta('soda water', base.scores, 2, nodes).odor_fruity).toBeLessThan(0);
  });
});
