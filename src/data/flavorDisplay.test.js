import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import {
  AXES, TASTE_AXES, AROMA_AXES, FLOOR, SURFACES, MIN_SPOKES, hiddenLine,
  compareBars, rankAxes, groupBars, selectAxes, radarAxes, radarKeys, barGroup, axisOfBar,
} from './flavorDisplay.js';
import * as pa from './recipeProfileAnalysis.js';
import { buildFlavorProfile } from './inventProfile.js';
import { layoutCard, layoutSet } from './shareCardLayout.js';
import { loadFlavorNodes } from '../../scripts/lib/flavorNodes.mjs';

const nodes = loadFlavorNodes();
const all17 = (v) => Object.fromEntries(AXES.map((a, i) => [a, typeof v === 'function' ? v(a, i) : v]));

describe('flavorDisplay: the axes match the app', () => {
  it('has the same seventeen axes, in the same order, as recipeProfileAnalysis', () => {
    expect(AXES).toEqual(pa.AXES);
    expect(TASTE_AXES).toEqual(pa.TASTE_AXES);
    expect(AROMA_AXES).toEqual(pa.AROMA_AXES);
  });
  it('reads every chart label back to its axis', () => {
    for (const a of AXES) expect(axisOfBar({ label: pa.axisLabel(a) })).toBe(a);
  });
});

describe('flavorDisplay: the one ordering', () => {
  it('strongest first, ties by canonical axis order, compared at 3 decimals', () => {
    const scores = { odor_fruity: 0.387, sweet: 0.3869, bitter: 0.2, odor_woody: 0.9 };
    expect(rankAxes(scores)).toEqual(['odor_woody', 'sweet', 'odor_fruity', 'bitter']);
    expect(compareBars({ axis: 'sweet', score: 0.3869 }, { axis: 'odor_fruity', score: 0.387 })).toBeLessThan(0);
    expect(compareBars({ axis: 'odor_fruity', score: 0.387 }, { axis: 'sweet', score: 0.3869 })).toBeGreaterThan(0);
  });
  it('is the order buildFlavorProfile gives its bars', () => {
    const p = buildFlavorProfile(['gin', 'campari', 'sweet vermouth'], nodes, { noun: 'drink' });
    const again = [...p.bars].sort(compareBars).map((b) => b.axis);
    expect(p.bars.map((b) => b.axis)).toEqual(again);
    for (const b of p.bars) expect(b.group).toBe(TASTE_AXES.includes(b.axis) ? 'taste' : 'aroma');
  });
  it('drops anything under the floor', () => {
    expect(rankAxes({ sweet: FLOOR - 0.001, sour: FLOOR })).toEqual(['sour']);
  });
});

describe('flavorDisplay: surfaces and their maxima', () => {
  const full = all17(() => 0.5);
  for (const [surface, cfg] of Object.entries(SURFACES)) {
    it(`${surface}: at most ${cfg.taste} tastes + ${cfg.aroma} aromas, hidden counted, show-all only where offered`, () => {
      const bars = AXES.map((a) => ({ axis: a, score: full[a] }));
      const g = groupBars(bars, surface);
      expect(g.groups.map((x) => x.id)).toEqual(['taste', 'aroma']);
      expect(g.groups[0].bars.length).toBe(cfg.taste);
      expect(g.groups[1].bars.length).toBe(cfg.aroma);
      expect(g.hidden).toBe(17 - cfg.taste - cfg.aroma);
      expect(g.canShowAll).toBe(cfg.showAll);
      const every = groupBars(bars, surface, { all: true });
      expect(every.bars.length).toBe(cfg.showAll ? 17 : cfg.taste + cfg.aroma);
    });
  }
  it('compact is 4 + 4, full 6 + 6, radar 4 + 4, and there are no other surfaces', () => {
    expect(Object.keys(SURFACES).sort()).toEqual(['compact', 'full', 'radar']);
    expect([SURFACES.compact.taste, SURFACES.compact.aroma]).toEqual([4, 4]);
    expect([SURFACES.full.taste, SURFACES.full.aroma]).toEqual([6, 6]);
  });
  it('lists taste first, then aroma, each strongest first, and works from labels alone', () => {
    const g = groupBars([
      { label: 'Savory', score: 0.9 }, { label: 'Sweet', score: 0.2 }, { label: 'Umami', score: 0.6 }, { label: 'Woody', score: 0.3 },
    ], 'compact');
    expect(g.bars.map((b) => b.label)).toEqual(['Umami', 'Sweet', 'Savory', 'Woody']);
    expect(barGroup({ label: 'Heat' })).toBe('taste');
    expect(barGroup({ label: 'Spice' })).toBe('aroma');
  });
  it('says what was left out in one short line', () => {
    expect(hiddenLine(1)).toBe('+1 fainter note');
    expect(hiddenLine(3)).toBe('+3 fainter notes');
  });
  it('selectAxes gives the same axes groupBars shows', () => {
    const scores = all17((a, i) => 0.9 - i * 0.04);
    const s = selectAxes(scores, 'compact');
    expect(s.taste.length).toBe(4);
    expect(s.aroma.length).toBe(4);
    expect(s.hidden).toBe(9);
    expect(selectAxes(scores, 'compact', { all: true }).axes.length).toBe(17);
  });
});

describe('flavorDisplay: every SURFACES entry has a caller', () => {
  const sources = [];
  const walk = (d) => {
    for (const e of readdirSync(d, { withFileTypes: true })) {
      const f = `${d}/${e.name}`;
      if (e.isDirectory()) { if (e.name !== '__tests__') walk(f); } else if (/\.(jsx?|mjs)$/.test(e.name) && !/\.test\./.test(e.name) && e.name !== 'flavorDisplay.js') sources.push([f, readFileSync(f, 'utf8')]);
    }
  };
  walk('src');
  // BUILDER-1: the Sauce deck's radars were the only caller of 'radar'; it now draws the fixed grid, so the surface is kept (radarAxes still exists and is tested below) with no component caller.
  for (const key of Object.keys(SURFACES).filter((k) => k !== 'radar')) {
    it(`'${key}' is passed by a component or data module outside flavorDisplay.js`, () => {
      const callers = sources.filter(([, text]) => new RegExp(`(groupBars|selectAxes|radarAxes)[(][^)]*['"]${key}['"]`).test(text));
      expect(callers.map(([f]) => f)).not.toEqual([]);
    });
  }
});

describe('flavorDisplay: radars never plot seventeen spokes', () => {
  it('radarAxes gives 3 to 8 spokes in canonical order, padded when the recipe is faint', () => {
    expect(radarAxes(all17(() => 0.5)).length).toBe(8);
    const faint = radarAxes({ sweet: 0.3 });
    expect(faint.length).toBe(MIN_SPOKES);
    expect(faint).toEqual(AXES.filter((a) => faint.includes(a)));
    expect(faint).toContain('sweet');
  });
  it('a pool restricts it (the aroma wheel on a suggestion card)', () => {
    const r = radarAxes(all17(() => 0.5), 'radar', { pool: AROMA_AXES });
    expect(r.every((a) => AROMA_AXES.includes(a))).toBe(true);
    expect(r.length).toBe(4);
    expect(radarAxes({}, 'radar', { pool: AROMA_AXES }).length).toBe(MIN_SPOKES);
  });
  it('extra axes (the ones a candidate moves) are always plotted', () => {
    expect(radarAxes(all17(() => 0.5), 'radar', { extra: ['odor_savory'] })).toContain('odor_savory');
  });
  it('radarKeys picks keys with a signal, padded to three, in vocabulary order', () => {
    const keys = ['a', 'b', 'c', 'd', 'e'];
    expect(radarKeys({ d: 1, b: 0.5 }, keys, 8)).toEqual(['a', 'b', 'd']);
    expect(radarKeys({ a: 1, b: 0.9, c: 0.8, d: 0.7, e: 0.6 }, keys, 2)).toEqual(['a', 'b', 'c']);
    expect(radarKeys(new Map([['e', 1], ['c', 0.4], ['a', 0.2], ['b', 0.1]]), keys, 3)).toEqual(['a', 'c', 'e']);
  });
});

describe('flavorDisplay: the share cards follow the rule', () => {
  const recipe = { kind: 'cocktail', name: 'Test', lines: [{ amount: '2 oz', label: 'Gin', key: 'gin' }], method: 'Stir.' };
  const bars = AXES.map((a, i) => ({ label: pa.axisLabel(a), color: '#fff', score: 0.9 - i * 0.04 }));
  const labelsIn = (card) => card.primitives.filter((p) => p.type === 'text').map((p) => p.text);
  // CHART-4: the cards draw the tasting note and two strips instead of capped bars, so nothing is cut and no line says so.
  for (const format of ['preview', 'portrait', 'tall']) {
    it(`${format}: the tasting note with Taste and Aroma strips, nothing capped and no fainter-notes line`, () => {
      const card = layoutCard({ format, recipe, bars, link: 'x/y' });
      const texts = labelsIn(card);
      expect(texts).toContain('TASTE');
      expect(texts).toContain('AROMA');
      expect(card.primitives.some((p) => p.type === 'text' && p.runs)).toBe(true);
      expect(texts.some((t) => t.includes('fainter'))).toBe(false);
    });
  }
  it('the set cover draws the note, the strips and the 17-wedge wheel', () => {
    const [cover] = layoutSet({ format: 'portrait', recipe, bars, link: 'x/y' });
    expect(cover.primitives.some((p) => p.type === 'text' && p.runs)).toBe(true);
    expect(cover.primitives.filter((p) => p.type === 'wedge').length).toBeGreaterThanOrEqual(17);
  });
  it('a card with no bars has no chart and no headings', () => {
    const card = layoutCard({ format: 'preview', recipe, bars: [], link: 'x/y' });
    expect(labelsIn(card)).not.toContain('TASTE');
  });
  it('the functions copy inlines the same rule (no import left)', () => {
    const gen = readFileSync('functions/src/share/cardLayout.generated.ts', 'utf8');
    expect(gen).toContain('export function groupBars');
    expect(gen).toContain('export function flavorNote');
    expect(gen).not.toContain("from './flavorDisplay.js'");
    expect(gen).not.toContain("from './flavorCharts.js'");
  });
});

describe('flavorDisplay: every surface uses the rule (source check)', () => {
  const uses = (f) => readFileSync(f, 'utf8').includes('flavorDisplay.js');
  for (const f of [
    'src/components/InventFlavorProfile.jsx',
    'src/components/RecipeFlavorProfilesCard.jsx',
    'src/components/ProfileAxisRadar.jsx',
    'src/data/profileGridPair.js',
    'src/data/shareCardLayout.js',
    'src/data/inventProfile.js',
  ]) it(`${f} imports flavorDisplay`, () => { expect(uses(f)).toBe(true); });
  it('the Sauce deck draws its chart through profileGridPair (the same grid as the suggestion deck), not its own radar', () => {
    const src = readFileSync('src/components/SauceSuggestionDeck.jsx', 'utf8');
    expect(src).toContain('profileGridPair.js');
    expect(src).toContain('FlavorGrid');
  });
  it('the shared page draws its chart through InventFlavorProfile', () => {
    expect(readFileSync('src/components/SharedRecipePage.jsx', 'utf8')).toContain('InventFlavorProfile');
  });
});

describe('every one of the seventeen axes has a page and a boost / temper entry', () => {
  const names = [...nodes.keys()].filter((n) => pa.nodeProbs(n, nodes));
  const candidates = names.slice(0, 1500);
  const scores = all17(() => 0.1);
  for (const a of AXES) {
    it(`${a}: label, colour, insight, a balancing axis, boost and temper candidates`, () => {
      expect(pa.axisLabel(a)).toBeTruthy();
      expect(pa.axisColor(a)).toMatch(/^#/);
      expect(pa.axisInsight(a, 0.6)).toBeTruthy();
      expect(AXES).toContain(pa.BALANCING[a]);
      const e = pa.buildAxisEnhancements([a], candidates, scores, 3, nodes)[0];
      expect(e, `${a} has an enhance row`).toBeTruthy();
      expect(e.boost.length).toBeGreaterThan(0);
      expect(e.temper.length).toBeGreaterThan(0);
    });
  }
});
