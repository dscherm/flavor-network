import { describe, expect, it } from 'vitest';
import {
  CHART_CAPTION, FORMATS, PALETTE, SITE_NAME, ellipsize, fitName, layoutCard, layoutSet, textWidth, wrapText,
} from '../shareCardLayout.js';
import { CHALK_CREAM, CHALK_DIM, CHALK_SUB, CHALK_RAIL } from '../chalkTheme.js';
import { ACCENT } from '../../components/inventUi.jsx';

const LINK = 'neuralflavor.web.app/r/cocktail/negroni';
const ELL = '…';
const lines = (n) => Array.from({ length: n }, (_, i) => ({ key: `ing${i}`, label: `Ingredient number ${i + 1}`, amount: `${i + 1} oz` }));
const recipe = (over = {}) => ({ kind: 'cocktail', name: 'Negroni', category: 'Aromatic stirred', lines: lines(3), method: 'Stir with ice.\nStrain over a big cube.', glass: 'Rocks', ...over });
const BARS = [
  { label: 'Bitter', color: '#a855f7', score: 0.8 },
  { label: 'Sweet', color: '#f472b6', score: 0.5 },
  { label: 'Fruity', color: '#fb923c', score: 0.3 },
];
const texts = (card) => card.primitives.filter((p) => p.type === 'text');
const allText = (card) => texts(card).map((t) => t.text).join('\n');
const inside = (card, p) => p.x >= 0 && p.y >= 0 && p.x + p.w <= card.width + 1 && p.y + p.h <= card.height;

describe('palette', () => {
  it('matches the chalkboard tokens the app uses', () => {
    expect(PALETTE.cream).toBe(CHALK_CREAM);
    expect(PALETTE.dim).toBe(CHALK_DIM);
    expect(PALETTE.sub).toBe(CHALK_SUB);
    expect(PALETTE.rail).toBe(CHALK_RAIL);
    expect(PALETTE.accent).toBe(ACCENT);
  });
});

describe('text helpers', () => {
  it('measures deterministically and ellipsizes to fit', () => {
    expect(textWidth('abc', 20)).toBe(textWidth('abc', 20));
    const out = ellipsize('A very long ingredient name that cannot fit', 30, {}, 200);
    expect(out.endsWith(ELL)).toBe(true);
    expect(textWidth(out, 30, {})).toBeLessThanOrEqual(200);
    expect(ellipsize('Gin', 30, {}, 200)).toBe('Gin');
  });
  it('wraps and truncates the last allowed line', () => {
    const ls = wrapText('one two three four five six seven eight nine ten', 30, {}, 200, 2);
    expect(ls).toHaveLength(2);
    expect(ls[1].endsWith(ELL)).toBe(true);
  });
  it('shrinks a name first, then wraps, then truncates', () => {
    const o = { font: 'hand', weight: 700 };
    const short = fitName('Negroni', { size: 100, maxW: 900 });
    expect(short.size).toBe(100);
    expect(short.lines).toEqual(['Negroni']);
    const mid = fitName('Negroni Sbagliato with a long twist', { size: 100, maxW: 700 });
    expect(mid.size).toBeLessThanOrEqual(100);
    const long = fitName('Extraordinarily Long Cocktail Name '.repeat(3).trim(), { size: 100, maxW: 600 });
    expect(long.lines.length).toBeLessThanOrEqual(2);
    expect(long.lines.at(-1).endsWith(ELL)).toBe(true);
    for (const l of long.lines) expect(textWidth(l, long.size, o)).toBeLessThanOrEqual(600);
  });
});

describe('layoutCard', () => {
  for (const format of ['preview', 'portrait', 'tall']) {
    it(`${format}: exact size, link, site name, everything inside the card`, () => {
      const card = layoutCard({ format, recipe: recipe(), bars: BARS, link: LINK });
      expect(card.width).toBe(FORMATS[format].width);
      expect(card.height).toBe(FORMATS[format].height);
      const t = allText(card);
      expect(t).toContain(LINK);
      expect(t).toContain(SITE_NAME);
      expect(t).toContain('Negroni');
      for (const p of texts(card)) expect(inside(card, p)).toBe(true);
    });
  }

  it('1 ingredient: one row, no "more" line', () => {
    const card = layoutCard({ format: 'portrait', recipe: recipe({ lines: lines(1) }), bars: BARS, link: LINK });
    expect(allText(card)).toContain('Ingredient number 1');
    expect(allText(card)).not.toContain('more at the link');
  });

  it('8 ingredients fit on a portrait card; 20 end with "+N more at the link"', () => {
    const eight = layoutCard({ format: 'portrait', recipe: recipe({ lines: lines(8) }), bars: BARS, link: LINK });
    expect(allText(eight)).toContain('Ingredient number 8');
    expect(allText(eight)).not.toContain('more at the link');
    const twenty = layoutCard({ format: 'portrait', recipe: recipe({ lines: lines(20) }), bars: BARS, link: LINK });
    const m = allText(twenty).match(/\+(\d+) more at the link/);
    expect(m).toBeTruthy();
    const shown = (allText(twenty).match(/Ingredient number \d+/g) || []).length;
    expect(shown + Number(m[1])).toBe(20);
  });

  it('a card built from a cut-short list uses lineCount for the "+N more"', () => {
    const card = layoutCard({ format: 'preview', recipe: recipe({ lines: lines(8), lineCount: 15 }), bars: BARS, link: LINK });
    const m = allText(card).match(/\+(\d+) more at the link/);
    const shown = (allText(card).match(/Ingredient number \d+/g) || []).length;
    expect(shown + Number(m[1])).toBe(15);
  });

  it('an 80-character name never overflows its box and takes at most two lines', () => {
    const name = 'The Absolutely Unnecessarily Long Winded Imaginary Cocktail Of The Evening Hour';
    expect(name.length).toBeGreaterThanOrEqual(78);
    for (const format of ['preview', 'portrait', 'tall']) {
      const card = layoutCard({ format, recipe: recipe({ name }), bars: BARS, link: LINK });
      const big = texts(card).filter((t) => t.font === 'hand' && t.weight === 700 && t.text !== SITE_NAME);
      expect(big.length).toBeGreaterThan(0);
      expect(big.length).toBeLessThanOrEqual(2);
      for (const t of big) expect(textWidth(t.text, t.size, { font: 'hand', weight: 700 })).toBeLessThanOrEqual(t.w);
    }
  });

  it('chart: drawn with its caption when there is profile data, omitted (not empty) when there is none', () => {
    const withChart = layoutCard({ format: 'portrait', recipe: recipe(), bars: BARS, link: LINK });
    expect(allText(withChart)).toContain(CHART_CAPTION);
    expect(allText(withChart)).toContain('Bitter');
    for (const bars of [null, [], undefined]) {
      const none = layoutCard({ format: 'portrait', recipe: recipe(), bars, link: LINK });
      expect(allText(none)).not.toContain(CHART_CAPTION);
      expect(allText(none)).not.toContain('Bitter');
      expect(none.primitives.filter((p) => p.type === 'rect' && p.fill === 'rgba(255,255,255,0.07)')).toHaveLength(0);
    }
  });

  it('tall: no text in the top or bottom 250px, on a single card or any card of a set', () => {
    const bigMethod = Array.from({ length: 30 }, (_, i) => `Step ${i} ${'words '.repeat(15)}`).join('\n');
    const cards = [
      layoutCard({ format: 'tall', recipe: recipe({ lines: lines(20) }), bars: BARS, link: LINK }),
      layoutCard({ format: 'tall', recipe: recipe({ name: 'x '.repeat(60) }), bars: null, link: LINK }),
      ...layoutSet({ format: 'tall', recipe: recipe({ lines: lines(20), method: bigMethod }), bars: BARS, link: LINK }),
      ...layoutSet({ format: 'tall', recipe: recipe({ lines: [], method: '' }), bars: null, link: LINK }),
    ];
    for (const card of cards) {
      expect(card.height).toBe(1920);
      for (const t of texts(card)) {
        expect(t.y).toBeGreaterThanOrEqual(250);
        expect(t.y + t.h).toBeLessThanOrEqual(1920 - 250);
      }
    }
  });

  it('a link too long for one line is split, never truncated', () => {
    const long = 'neuralflavor.web.app/r/dish/a-really-quite-long-recipe-slug-with-many-words-in-it-for-testing-purposes';
    const card = layoutCard({ format: 'portrait', recipe: recipe(), bars: BARS, link: long });
    const printed = texts(card).filter((t) => long.includes(t.text) && t.text.length > 10).map((t) => t.text).join('');
    expect(printed).toBe(long);
  });
});

describe('layoutSet', () => {
  const longMethod = Array.from({ length: 40 }, (_, i) => `Step number ${i + 1}: ${'stir gently and wait '.repeat(6)}`).join('\n');
  for (const format of ['portrait', 'tall']) {
    it(`${format}: three cards at the exact size, each with the link and site name`, () => {
      const set = layoutSet({ format, recipe: recipe({ lines: lines(8) }), bars: BARS, link: LINK });
      expect(set).toHaveLength(3);
      for (const card of set) {
        expect(card.width).toBe(1080);
        expect(card.height).toBe(FORMATS[format].height);
        expect(allText(card)).toContain(LINK);
        expect(allText(card)).toContain(SITE_NAME);
        for (const p of texts(card)) expect(inside(card, p)).toBe(true);
      }
      expect(allText(set[0])).toContain(CHART_CAPTION);
      expect(allText(set[1])).toContain('Ingredients');
      expect(allText(set[1])).toContain('Ingredient number 8');
      expect(allText(set[2])).toContain('Method');
      expect(allText(set[2])).toContain('Stir with ice.');
    });
  }

  it('a method too long for one card ends with "+N more at the link" and counts the hidden steps', () => {
    const set = layoutSet({ format: 'portrait', recipe: recipe({ method: longMethod }), bars: BARS, link: LINK });
    const t = allText(set[2]);
    const m = t.match(/\+(\d+) more at the link/);
    expect(m).toBeTruthy();
    const shownSteps = (t.match(/^\d+\.$/gm) || []).length;
    expect(shownSteps + Number(m[1])).toBe(40);
    expect(shownSteps).toBeGreaterThan(0);
  });

  it('one enormous step is cut and points at the link', () => {
    const set = layoutSet({ format: 'portrait', recipe: recipe({ method: 'Stir. '.repeat(900) }), bars: null, link: LINK });
    expect(allText(set[2])).toMatch(/…|at the link/);
    for (const p of texts(set[2])) expect(inside(set[2], p)).toBe(true);
  });

  it('no profile data: card 1 has no chart; no method: card 3 says so', () => {
    const set = layoutSet({ format: 'portrait', recipe: recipe({ method: '' }), bars: null, link: LINK });
    expect(allText(set[0])).not.toContain(CHART_CAPTION);
    expect(allText(set[0])).toContain('Negroni');
    expect(allText(set[2])).toContain('full recipe is at the link');
  });

  it('refuses the preview size for a set', () => {
    expect(() => layoutSet({ format: 'preview', recipe: recipe(), link: LINK })).toThrow();
  });
});
