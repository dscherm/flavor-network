import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { wineProfileAxes, wineFoodMapping, aromaFamilyOf, STRUCTURE_AXES, reviewHighlights } from '../wineProfile.js';
import { dishProfile, scoreWine } from '../winePairing.js';

const WINES = JSON.parse(fs.readFileSync(path.resolve(process.cwd(), 'public/data/wine_styles.json'), 'utf8')).wines;
const wine = (id) => WINES.find((w) => w.id === id);
const ruleIds = (id) => wineFoodMapping(wine(id)).rules.map((r) => r.id);
const avoidIds = (id) => wineFoodMapping(wine(id)).avoid.map((r) => r.id);
const mean = (xs) => xs.reduce((s, x) => s + x, 0) / Math.max(1, xs.length);

describe('wineProfileAxes', () => {
  it('gives every wine six structure axes in 0..1', () => {
    for (const w of WINES) {
      const { axes, values } = wineProfileAxes(w);
      expect(axes.map((a) => a.key)).toEqual(STRUCTURE_AXES.map((a) => a.key));
      for (const a of axes) {
        expect(a.value).toBeGreaterThanOrEqual(0);
        expect(a.value).toBeLessThanOrEqual(1);
        expect(values[a.key]).toBe(a.value);
      }
    }
  });

  it('normalises on each scale: grippy tannin is 1, bone-dry is the 1-of-5 floor, pronounced oak is 1', () => {
    const barolo = wineProfileAxes(wine('barolo')).values;
    expect(barolo.tannin).toBe(1);
    expect(barolo.sweetness).toBeCloseTo(0.2);
    expect(wineProfileAxes(wine('champagne')).values.tannin).toBe(0);
    expect(wineProfileAxes(wine('chardonnay-oaked')).values.oak).toBe(1);
    expect(wineProfileAxes(wine('muscadet')).values.oak).toBe(0);
  });

  it('maps every aroma tag in the data to a family', () => {
    for (const w of WINES) expect(wineProfileAxes(w).unmappedAromas).toEqual([]);
    expect(aromaFamilyOf('saline')).toBe('mineral-saline');
    expect(aromaFamilyOf('nope')).toBeNull();
  });

  it('aroma shares sum to 1 and come strongest first', () => {
    for (const w of WINES) {
      const fams = wineProfileAxes(w).aromaFamilies;
      expect(fams.reduce((s, f) => s + f.share, 0)).toBeCloseTo(1, 6);
      for (let i = 1; i < fams.length; i += 1) expect(fams[i - 1].share).toBeGreaterThanOrEqual(fams[i].share);
    }
    expect(wineProfileAxes(wine('barolo')).aromaFamilies.map((f) => f.id)).toContain('earthy');
  });

  it('survives a wine with missing fields', () => {
    const p = wineProfileAxes({});
    expect(p.axes).toHaveLength(6);
    expect(p.aromaFamilies).toEqual([]);
    expect(wineFoodMapping({}).rules).toEqual(expect.any(Array));
  });
});

describe('wineFoodMapping — rules fire for the right wines', () => {
  it('Barolo gets the firm-tannin rule and the fish warning', () => {
    expect(ruleIds('barolo')).toContain('tannin');
    expect(wineFoodMapping(wine('barolo')).rules.find((r) => r.id === 'tannin').trait).toBe('firm tannin');
    expect(avoidIds('barolo')).toContain('tannin-fish');
  });

  it('off-dry Riesling gets the heat rule; high-alcohol wines get the chili warning', () => {
    expect(ruleIds('riesling-offdry')).toContain('heat');
    expect(wineFoodMapping(wine('riesling-offdry')).rules.find((r) => r.id === 'heat').examples).toContain('chili');
    expect(ruleIds('cab-napa')).not.toContain('heat');
    expect(avoidIds('cab-napa')).toContain('hot-chili');
    expect(avoidIds('riesling-offdry')).not.toContain('hot-chili');
  });

  it('Sauternes gets the dessert rule and no savoury rules', () => {
    const ids = ruleIds('sauternes');
    expect(ids).toContain('dessert');
    expect(ids).not.toContain('tannin');
    expect(ids).not.toContain('body');
    expect(avoidIds('sauternes')).toContain('savoury-main');
  });

  it('Champagne gets the bubbles and acid rules; sweet Moscato d’Asti does not get bubbles', () => {
    expect(ruleIds('champagne')).toEqual(expect.arrayContaining(['bubbles', 'acid']));
    expect(ruleIds('moscato-dasti')).not.toContain('bubbles');
  });

  it('Ruby Port (sweet, tannic) is not sent to red meat', () => {
    expect(ruleIds('ruby-port')).toContain('dessert');
    expect(ruleIds('ruby-port')).not.toContain('tannin');
  });

  it('every dry wine warns off desserts; no wine both recommends and avoids desserts', () => {
    for (const w of WINES) {
      const m = wineFoodMapping(w);
      const recommends = m.rules.some((r) => r.id === 'dessert');
      const avoids = m.avoid.some((a) => a.id === 'dessert');
      expect(recommends && avoids).toBe(false);
      if (w.sweetness === 1) expect(avoids).toBe(true);
    }
  });

  it('examples always come from the wine’s own classic matches', () => {
    for (const w of WINES) {
      for (const r of wineFoodMapping(w).rules) for (const ex of r.examples) expect(w.classicMatches).toContain(ex);
    }
  });
});

// The card must explain the engine, not contradict it. These compare the
// engine's own scores for dishes built by its own dishProfile.
describe('wineFoodMapping agrees with the pairing engine', () => {
  const steak = dishProfile(['beef steak', 'butter', 'black pepper', 'garlic'], { methodText: 'grill the steak' });
  const fish = dishProfile(['white fish', 'lemon', 'butter', 'parsley']);
  const thai = dishProfile(['chicken', 'thai chili', 'fish sauce', 'lime', 'lemongrass', 'chili']);
  const dessert = dishProfile(['sugar', 'cream', 'egg yolk', 'vanilla', 'caramel'], { dishType: 'baking' });
  const fried = dishProfile(['chicken', 'flour', 'oil', 'salt'], { methodText: 'deep fry until golden' });
  const score = (w, p) => scoreWine(w, p).score;
  const withRule = (id) => WINES.filter((w) => wineFoodMapping(w).rules.some((r) => r.id === id));
  const withAvoid = (id) => WINES.filter((w) => wineFoodMapping(w).avoid.some((a) => a.id === id));

  it('the dish fixtures are what they claim to be', () => {
    expect(steak.protein).toBe('red meat');
    expect(thai.heat).toBeGreaterThan(0.2);
    expect(dessert.dessert).toBe(true);
    expect(fried.fried).toBe(true);
  });

  it('firm-tannin wines beat the fish-safe wines for steak, and lose to them for fish', () => {
    const tannic = WINES.filter((w) => wineFoodMapping(w).rules.some((r) => r.id === 'tannin' && r.trait === 'firm tannin'));
    const fishSafe = withRule('no-tannin');
    expect(mean(tannic.map((w) => score(w, steak)))).toBeGreaterThan(mean(fishSafe.map((w) => score(w, steak))));
    expect(mean(tannic.map((w) => score(w, fish)))).toBeLessThan(mean(fishSafe.map((w) => score(w, fish))));
  });

  it('heat-rule wines beat chili-warning wines for a hot Thai dish', () => {
    expect(mean(withRule('heat').map((w) => score(w, thai)))).toBeGreaterThan(mean(withAvoid('hot-chili').map((w) => score(w, thai))));
    // and the engine gives Riesling its "calms the heat" reason
    expect(scoreWine(wine('riesling-offdry'), thai).reasons.join(' ')).toMatch(/calms the chili heat/);
  });

  it('dessert-rule wines beat dessert-warning wines for a dessert', () => {
    expect(mean(withRule('dessert').map((w) => score(w, dessert)))).toBeGreaterThan(mean(withAvoid('dessert').map((w) => score(w, dessert))) + 1);
  });

  it('a dry sparkling wine gains more from frying than a still wine of the same build', () => {
    const plain = dishProfile(['chicken', 'flour', 'salt']);
    const gain = (w) => score(w, fried) - score(w, plain);
    const champagne = wine('champagne');
    const stillTwin = { ...champagne, sparkling: false };
    expect(gain(champagne)).toBeGreaterThan(gain(stillTwin));
    // the bubbles rule fires exactly for dry sparkling wines, as the engine's bonus does
    for (const w of WINES) expect(ruleIds(w.id).includes('bubbles')).toBe(Boolean(w.sparkling && w.sweetness <= 2));
  });
});

describe('reviewHighlights (Wine Reviews aggregates)', () => {
  const REVIEWS = JSON.parse(fs.readFileSync(path.resolve(process.cwd(), 'public/data/wine_review_aromas.json'), 'utf8')).styles;

  it('keeps only families mentioned often and more than for wine in general', () => {
    const h = reviewHighlights(REVIEWS.gewurztraminer);
    expect(h.reviews).toBeGreaterThan(100);
    expect(h.families.length).toBeLessThanOrEqual(4);
    for (const f of h.families) { expect(f.share).toBeGreaterThanOrEqual(0.1); expect(f.lift).toBeGreaterThanOrEqual(1.3); }
    expect(h.families.map((f) => f.family)).toContain('spice');
  });

  it('says nothing for an unprofiled style or missing data', () => {
    expect(reviewHighlights(REVIEWS.madeira)).toBeNull();
    expect(reviewHighlights(undefined)).toBeNull();
  });

  it('every wine style id has an entry in the review file', () => {
    for (const w of WINES) expect(REVIEWS[w.id], w.id).toBeTruthy();
  });
});
