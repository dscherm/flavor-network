// CHART-2: the pure pieces of the four flavor charts, checked on real profiles computed through profileForRecipe.
import { describe, it, expect, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { flavorNote, flavorStrips, flavorWheel, flavorGrid, AXIS_LABEL, STRIP_LABEL_MIN, WEDGE_MIN_LENGTH, GRID_ROWS } from '../flavorCharts.js';
import { AXES, TASTE_AXES, AROMA_AXES, compareBars } from '../flavorDisplay.js';
import { AROMA_LABELS } from '../recipeScoring.js';
import { resolveBuiltIn, uniqueBySlug, slugFor } from '../sharedRecipe.js';
import { profileForRecipe } from '../shareCardData.js';
import { SEED_RECIPES } from '../seedRecipes.js';
import { RECIPE_DETAILS } from '../seedRecipeDetails.js';
import { loadFlavorNodes } from '../../../scripts/lib/flavorNodes.mjs';
import { readCuratedCodex } from '../../../scripts/lib/curatedCodex.mjs';

// GATE-1: One test charts every built-in recipe (1.7 s in the full run).
// 5 s default leaves under 2x headroom when the machine is busy; 20 s still fails a real hang.
vi.setConfig({ testTimeout: 20000 });

const nodes = loadFlavorNodes();
const codex = readCuratedCodex();
const sauces = JSON.parse(readFileSync(resolve(process.cwd(), 'public/data/sauce_augment.json'), 'utf8')).sauces || [];
const data = { cocktails: codex.cocktails, families: codex.families, sauces, dishes: SEED_RECIPES, dishDetails: RECIPE_DETAILS };
const barsOf = (kind, slug) => profileForRecipe(resolveBuiltIn(kind, slug, data), nodes).bars;

const bar = (axis, score, extra = {}) => ({ axis, label: AXIS_LABEL[axis], color: '#abc', score, ...extra });

describe('AXIS_LABEL', () => {
  it('covers exactly the seventeen axes and matches the chart words in recipeScoring', () => {
    expect(Object.keys(AXIS_LABEL).sort()).toEqual([...AXES].sort());
    for (const a of AROMA_AXES) expect(AXIS_LABEL[a].toLowerCase()).toBe(AROMA_LABELS[a]);
    for (const a of TASTE_AXES) expect(AXIS_LABEL[a].toLowerCase()).toBe(a);
  });
});

describe('flavorNote on real recipes', () => {
  const note = (kind, slug) => flavorNote(barsOf(kind, slug));
  it('Old Fashioned', () => {
    const n = note('cocktail', 'old-fashioned');
    expect(n.text).toBe('Woody and sweet, with bitter, spice and toasty behind.');
    expect(n.lead).toEqual(['odor_woody', 'sweet']);
    expect(n.behind).toEqual(['bitter', 'odor_spicy', 'odor_toasty']);
  });
  it('Hollandaise', () => {
    const n = note('sauce', 'hollandaise');
    expect(n.text).toBe('Creamy above all, with sour, salty and nutty behind.');
    expect(n.lead).toEqual(['odor_fatty']);
  });
  it('Margarita, Thai Green Curry and Tiramisu name notes only and follow the rule', () => {
    for (const [kind, slug] of [['cocktail', 'margarita'], ['dish', 'thai-green-curry'], ['dish', 'tiramisu']]) {
      const bars = barsOf(kind, slug);
      const n = flavorNote(bars);
      const live = bars.filter((b) => b.score >= 0.05).sort(compareBars);
      expect(n.text, `${slug}`).toMatch(/^[A-Z][a-z]+( and [a-z]+| above all)(, with [a-z, ]+ behind)?\.$/);
      expect(n.lead[0]).toBe(live[0].axis);
      const solo = live[0].score >= 2 * live[1].score;
      expect(n.lead.length).toBe(solo ? 1 : 2);
      expect(n.behind.length).toBe(Math.min(3, live.length - n.lead.length));
      expect(n.text.toLowerCase()).toContain(AXIS_LABEL[n.lead[0]].toLowerCase());
    }
  });
  it('prints the five real sentences', () => {
    const out = [['cocktail', 'old-fashioned'], ['sauce', 'hollandaise'], ['cocktail', 'margarita'], ['dish', 'thai-green-curry'], ['dish', 'tiramisu']]
      .map(([k, s]) => `${k}/${s}: ${note(k, s).text}`);
    process.stderr.write(`CHART-2 sentences\n${out.join('\n')}\n`);
    expect(out).toHaveLength(5);
  });
});

describe('flavorNote edge cases', () => {
  it('no bars: empty text and arrays', () => {
    for (const x of [[], null, undefined]) expect(flavorNote(x)).toEqual({ lead: [], behind: [], text: '', words: [] });
  });
  it('bars under the floor do not count', () => {
    expect(flavorNote([bar('sweet', 0.04)]).text).toBe('');
  });
  it('one note: "<Note> above all."', () => {
    expect(flavorNote([bar('odor_smoky', 0.4)])).toMatchObject({ lead: ['odor_smoky'], behind: [], text: 'Smoky above all.' });
  });
  it('two notes under a 2x gap: both lead, nothing behind', () => {
    expect(flavorNote([bar('sour', 0.5), bar('sweet', 0.3)]).text).toBe('Sour and sweet.');
  });
  it('a 2x lead is "above all" (exactly twice counts)', () => {
    expect(flavorNote([bar('sour', 0.6), bar('sweet', 0.3), bar('bitter', 0.1)]).text).toBe('Sour above all, with sweet and bitter behind.');
  });
  it('at most three behind', () => {
    const bars = ['sweet', 'sour', 'bitter', 'salty', 'umami', 'heat', 'odor_woody'].map((a, i) => bar(a, 0.9 - i * 0.05));
    const n = flavorNote(bars);
    expect(n.lead).toHaveLength(2);
    expect(n.behind).toHaveLength(3);
  });
  it('ties are broken by the canonical axis order (compareBars)', () => {
    expect(flavorNote([bar('odor_woody', 0.3), bar('sweet', 0.3), bar('sour', 0.3)]).lead).toEqual(['sweet', 'sour']);
    // scores equal at three decimals tie
    expect(flavorNote([bar('sour', 0.3001), bar('sweet', 0.3004)]).lead).toEqual(['sweet', 'sour']);
  });
  it('tastes only and aromas only', () => {
    expect(flavorNote([bar('sweet', 0.5), bar('sour', 0.4)]).text).toBe('Sweet and sour.');
    expect(flavorNote([bar('odor_fatty', 0.5), bar('odor_nutty', 0.4)]).text).toBe('Creamy and nutty.');
  });
  it('label-only bars (as stored on a share card) give the same answer', () => {
    const real = barsOf('cocktail', 'old-fashioned');
    const stored = real.map((b) => ({ label: b.label, color: b.color, score: b.score }));
    expect(flavorNote(stored)).toEqual(flavorNote(real));
  });
  it('a bar whose axis cannot be read is ignored', () => {
    expect(flavorNote([{ label: 'Mystery', score: 0.9 }, bar('sweet', 0.4)]).text).toBe('Sweet above all.');
  });
  it('words carry colours for underlining', () => {
    const n = flavorNote([bar('sweet', 0.5, { color: '#ff5fa2' }), bar('sour', 0.4, { color: '#2bd4d4' }), bar('bitter', 0.2)]);
    expect(n.words.map((w) => [w.label, w.role, w.color])).toEqual([['Sweet', 'lead', '#ff5fa2'], ['Sour', 'lead', '#2bd4d4'], ['Bitter', 'behind', '#abc']]);
  });
});

describe('flavorStrips', () => {
  it('Hollandaise: aroma row (creamy, nutty) is longer than the taste row; segments sum to total / scale', () => {
    const s = flavorStrips(barsOf('sauce', 'hollandaise'));
    expect(s.aroma.length).toBeGreaterThan(s.taste.length);
    expect(s.scale).toBeCloseTo(s.aroma.total, 10);
    expect(s.aroma.length).toBeCloseTo(1, 10);
    for (const row of [s.taste, s.aroma]) {
      expect(row.segments.reduce((t, g) => t + g.length, 0)).toBeCloseTo(row.total / s.scale, 10);
      expect(row.length).toBeCloseTo(row.total / s.scale, 10);
    }
  });
  it('Old Fashioned: the weaker group is the shorter row; both are on the shared scale', () => {
    const s = flavorStrips(barsOf('cocktail', 'old-fashioned'));
    const [longer, shorter] = s.aroma.total >= s.taste.total ? [s.aroma, s.taste] : [s.taste, s.aroma];
    expect(shorter.length).toBeLessThan(longer.length);
    expect(longer.length).toBeCloseTo(1, 10);
  });
  it('segments are ordered strongest first and carry the labelling threshold', () => {
    const s = flavorStrips([bar('sweet', 0.6), bar('sour', 0.3), bar('bitter', 0.1), bar('odor_woody', 0.2)]);
    expect(s.taste.segments.map((g) => g.axis)).toEqual(['sweet', 'sour', 'bitter']);
    expect(s.scale).toBeCloseTo(1.0, 10);
    expect(s.taste.segments.map((g) => g.labelled)).toEqual([true, true, false]);
    expect(s.aroma.segments[0].labelled).toBe(STRIP_LABEL_MIN <= 0.2);
    expect(s.labelMin).toBe(STRIP_LABEL_MIN);
  });
  it('empty and one-sided profiles', () => {
    const e = flavorStrips([]);
    expect(e).toMatchObject({ scale: 1, taste: { total: 0, length: 0, segments: [] }, aroma: { total: 0, length: 0, segments: [] } });
    const t = flavorStrips([bar('sweet', 0.5), bar('sour', 0.25)]);
    expect(t.aroma.segments).toEqual([]);
    expect(t.taste.length).toBeCloseTo(1, 10);
  });
});

describe('flavorWheel', () => {
  it('Old Fashioned: seventeen wedges, aromas first clockwise from the top then a gap then tastes', () => {
    const w = flavorWheel(barsOf('cocktail', 'old-fashioned'));
    expect(w.wedges.map((x) => x.axis)).toEqual([...AROMA_AXES, ...TASTE_AXES]);
    const first = w.wedges[0];
    expect(first.start).toBeGreaterThan(-90);
    for (let i = 1; i < 17; i++) expect(w.wedges[i].start).toBeGreaterThan(w.wedges[i - 1].end);
    const gapMid = w.wedges[11].start - w.wedges[10].end;
    const gapIn = w.wedges[5].start - w.wedges[4].end;
    expect(gapMid).toBeGreaterThan(gapIn + 10);
    const last = w.wedges[16];
    expect(last.end).toBeLessThan(270);
    expect(first.start - (-90) + (270 - last.end)).toBeGreaterThan(10); // a gap at the top
    expect(w.wedges.filter((x) => x.group === 'taste').every((x) => x.mid > 90 && x.mid < 270)).toBe(true);
    expect(w.wedges.filter((x) => x.group === 'taste').every((x) => (x.mid + 360) % 360 > 150)).toBe(true); // lower-left to upper-left
  });
  it('length is scaled to the strongest note and absent wedges are off', () => {
    const w = flavorWheel(barsOf('cocktail', 'old-fashioned'));
    const woody = w.wedges.find((x) => x.axis === 'odor_woody');
    expect(woody.length).toBe(1);
    expect(w.wedges.find((x) => x.axis === 'sweet').length).toBeCloseTo(0.349 / 0.65, 1);
    const off = w.wedges.filter((x) => !x.on);
    expect(off.length).toBeGreaterThan(0);
    for (const x of off) expect(x).toMatchObject({ length: 0, drawn: 0, labelled: false, score: 0 });
    for (const x of w.wedges.filter((y) => y.on)) expect(x.drawn).toBeGreaterThanOrEqual(WEDGE_MIN_LENGTH);
  });
  it('labels: a small size labels only the strongest few, full labels every wedge that is on', () => {
    const bars = barsOf('cocktail', 'old-fashioned');
    const card = flavorWheel(bars, 'card').wedges.filter((x) => x.labelled).map((x) => x.axis);
    expect(card).toEqual(expect.arrayContaining(['odor_woody', 'sweet', 'bitter', 'odor_spicy']));
    expect(card).toHaveLength(4);
    expect(flavorWheel(bars, 'mini').wedges.filter((x) => x.labelled)).toHaveLength(3);
    const full = flavorWheel(bars, 'full');
    expect(full.wedges.filter((x) => x.labelled).length).toBe(full.wedges.filter((x) => x.on).length);
  });
  it('colours: from the bar when present, from `colors` for an absent axis, otherwise null', () => {
    const w = flavorWheel([bar('sweet', 0.5, { color: '#ff5fa2' })], 'full', { colors: { sour: '#2bd4d4' } });
    expect(w.wedges.find((x) => x.axis === 'sweet').color).toBe('#ff5fa2');
    expect(w.wedges.find((x) => x.axis === 'sour').color).toBe('#2bd4d4');
    expect(w.wedges.find((x) => x.axis === 'bitter').color).toBeNull();
  });
  it('empty profile: seventeen off wedges, no peak', () => {
    const w = flavorWheel([]);
    expect(w.wedges).toHaveLength(17);
    expect(w.peak).toBe(0);
    expect(w.wedges.every((x) => !x.on && x.length === 0)).toBe(true);
  });
  it('ignores an axis outside the seventeen', () => {
    const w = flavorWheel([{ axis: 'odor_mystery', label: 'Mystery', score: 0.9 }, bar('sweet', 0.3)]);
    expect(w.wedges).toHaveLength(17);
    expect(w.wedges.map((x) => x.axis).every((a) => AXES.includes(a))).toBe(true);
    expect(w.peak).toBe(0.3);
  });
});

describe('flavorGrid', () => {
  it('seventeen fixed cells: tastes in one row of six, aromas in rows of six and five', () => {
    const g = flavorGrid(barsOf('dish', 'tiramisu'));
    expect(g.cells.map((c) => c.axis)).toEqual([...TASTE_AXES, ...AROMA_AXES]);
    expect(g.rows).toEqual(GRID_ROWS);
    const rows = [0, 1, 2].map((r) => g.cells.filter((c) => c.row === r));
    expect(rows.map((r) => r.length)).toEqual([6, 6, 5]);
    expect(rows[0].every((c) => c.group === 'taste')).toBe(true);
    expect(rows[1].concat(rows[2]).every((c) => c.group === 'aroma')).toBe(true);
    expect(g.cells.map((c) => c.col)).toEqual([0, 1, 2, 3, 4, 5, 0, 1, 2, 3, 4, 5, 0, 1, 2, 3, 4]);
  });
  it('dot area follows the score: radius is sqrt(score / strongest), strongest is 1, absent is 0', () => {
    const g = flavorGrid(barsOf('dish', 'tiramisu'));
    const toasty = g.cells.find((c) => c.axis === 'odor_toasty');
    const sweet = g.cells.find((c) => c.axis === 'sweet');
    expect(toasty.radius).toBe(1);
    expect(sweet.radius).toBeCloseTo(Math.sqrt(sweet.score / toasty.score), 10);
    expect(sweet.radius ** 2 * toasty.score).toBeCloseTo(sweet.score, 10);
    for (const c of g.cells.filter((x) => !x.on)) expect(c.radius).toBe(0);
  });
  it('a shared scale makes two grids comparable, and a larger score is capped at 1', () => {
    const before = flavorGrid([bar('sweet', 0.2)], { scale: 0.8 });
    const after = flavorGrid([bar('sweet', 0.2), bar('sour', 0.8)], { scale: 0.8 });
    expect(before.cells[0].radius).toBeCloseTo(0.5, 10);
    expect(after.cells[0].radius).toBe(before.cells[0].radius);
    expect(flavorGrid([bar('sweet', 0.9)], { scale: 0.5 }).cells[0].radius).toBe(1);
  });
  it('empty profile and label-only bars', () => {
    const e = flavorGrid([]);
    expect(e.cells).toHaveLength(17);
    expect(e.cells.every((c) => !c.on && c.radius === 0)).toBe(true);
    const stored = barsOf('dish', 'tiramisu').map((b) => ({ label: b.label, color: b.color, score: b.score }));
    expect(flavorGrid(stored)).toEqual(flavorGrid(barsOf('dish', 'tiramisu')));
  });
});

describe('fixed positions for every built-in recipe', () => {
  const lists = {
    cocktail: uniqueBySlug('cocktail', data.cocktails),
    sauce: uniqueBySlug('sauce', data.sauces),
    dish: uniqueBySlug('dish', data.dishes),
  };
  it('every axis sits in the same place on the wheel and the grid for all recipes, and no axis outside the seventeen appears', () => {
    const ref = flavorWheel([]);
    const refGrid = flavorGrid([]);
    let n = 0;
    let drawn = 0;
    for (const [kind, list] of Object.entries(lists)) {
      for (const item of list) {
        const recipe = resolveBuiltIn(kind, slugFor(kind, item), data);
        const p = profileForRecipe(recipe, nodes);
        const bars = p.drawn ? p.bars : [];
        n += 1;
        if (bars.length) drawn += 1;
        const w = flavorWheel(bars);
        expect(w.wedges.map((x) => [x.axis, x.start, x.end, x.index])).toEqual(ref.wedges.map((x) => [x.axis, x.start, x.end, x.index]));
        expect(w.wedges.every((x) => AXES.includes(x.axis))).toBe(true);
        for (const x of w.wedges) { expect(x.length).toBeGreaterThanOrEqual(0); expect(x.length).toBeLessThanOrEqual(1); }
        const g = flavorGrid(bars);
        expect(g.cells.map((c) => [c.axis, c.row, c.col])).toEqual(refGrid.cells.map((c) => [c.axis, c.row, c.col]));
        expect(g.cells.every((c) => AXES.includes(c.axis))).toBe(true);
        // every bar the profile has is placed, and nothing else is on
        const placed = new Set(w.wedges.filter((x) => x.on).map((x) => x.axis));
        const expected = new Set(bars.filter((b) => b.score >= 0.05).map((b) => b.axis));
        expect(placed).toEqual(expected);
        const note = flavorNote(bars);
        for (const a of [...note.lead, ...note.behind]) expect(AXES.includes(a)).toBe(true);
        const st = flavorStrips(bars);
        for (const seg of [...st.taste.segments, ...st.aroma.segments]) expect(AXES.includes(seg.axis)).toBe(true);
      }
    }
    expect(n).toBeGreaterThan(500);
    expect(drawn).toBeGreaterThan(400);
  });
});
