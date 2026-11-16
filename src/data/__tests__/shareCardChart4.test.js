// CHART-4. Share cards draw the tasting note (design D): the sentence with underlined note words, two strips, and on a set's
// cover the fixed wheel. The sentence a card prints is the one the shared page prints, and a published copy keeps every
// note, so the sentence and strips drawn from it equal the ones the owner saw.
import { describe, it, expect } from 'vitest';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { layoutCard, layoutSet } from '../shareCardLayout.js';
import { flavorNote, flavorStrips } from '../flavorCharts.js';
import { FLOOR } from '../flavorDisplay.js';
import { profileForRecipe, barsFor } from '../shareCardData.js';
import { toSharedDoc, fromSharedDoc, SHARE_LIMITS } from '../sharePublish.js';
import { resolveBuiltIn, slugFor, uniqueBySlug } from '../sharedRecipe.js';
import { SEED_RECIPES } from '../seedRecipes.js';
import { RECIPE_DETAILS } from '../seedRecipeDetails.js';
import { readCuratedCodex } from '../../../scripts/lib/curatedCodex.mjs';
import { loadFlavorNodes } from '../../../scripts/lib/flavorNodes.mjs';

const ROOT = resolve(__dirname, '../../..');
const nodes = loadFlavorNodes();
const codex = readCuratedCodex();
const sauces = JSON.parse(readFileSync(resolve(ROOT, 'public/data/sauce_augment.json'), 'utf8')).sauces || [];
const data = { cocktails: codex.cocktails || [], families: codex.families || [], sauces, dishes: SEED_RECIPES, dishDetails: RECIPE_DETAILS };
const builtIn = (kind, slug) => resolveBuiltIn(kind, slug, data);

const BARS = [
  { label: 'Bitter', color: '#a855f7', score: 0.9 }, { label: 'Sweet', color: '#ff5fa2', score: 0.7 }, { label: 'Sour', color: '#22d3ee', score: 0.2 },
  { label: 'Fruity', color: '#ff8a5c', score: 0.55 }, { label: 'Green', color: '#7ccd7c', score: 0.4 }, { label: 'Spice', color: '#c0561f', score: 0.38 },
  { label: 'Woody', color: '#a08a60', score: 0.3 }, { label: 'Floral', color: '#d9a8e0', score: 0.12 },
];
const rec = {
  kind: 'cocktail', name: 'Negroni', category: 'Aromatic Stirred', glass: 'Old-fashioned glass',
  lines: [{ label: 'gin', amount: '30 ml' }, { label: 'campari', amount: '30 ml' }, { label: 'sweet vermouth', amount: '30 ml' }], method: 'Stir with ice.\nStrain.',
};
const texts = (c) => c.primitives.filter((p) => p.type === 'text');

describe('the tasting note on every card', () => {
  const note = flavorNote(BARS);
  const strips = flavorStrips(BARS);
  const cards = {
    preview: layoutCard({ format: 'preview', recipe: rec, bars: BARS, link: 'x' }),
    portrait: layoutCard({ format: 'portrait', recipe: rec, bars: BARS, link: 'x' }),
    tall: layoutCard({ format: 'tall', recipe: rec, bars: BARS, link: 'x' }),
    setPortrait: layoutSet({ format: 'portrait', recipe: rec, bars: BARS, link: 'x' })[0],
    setTall: layoutSet({ format: 'tall', recipe: rec, bars: BARS, link: 'x' })[0],
  };
  for (const [name, card] of Object.entries(cards)) {
    it(`${name}: the sentence is flavorNote's, its note words underlined in the note's colours, nothing hidden`, () => {
      const lines = texts(card).filter((t) => t.runs);
      expect(lines.length).toBeGreaterThan(0);
      expect(lines.map((t) => t.text).join(' ')).toBe(note.text);
      for (const l of lines) expect(l.runs.map((r) => r.text).join('')).toBe(l.text);
      const underlined = lines.flatMap((l) => l.runs.filter((r) => r.underline));
      expect(underlined.map((r) => [r.text.toLowerCase(), r.underline])).toEqual(note.words.map((w) => [w.label.toLowerCase(), w.color]));
      expect(texts(card).map((t) => t.text).join(' ')).not.toMatch(/fainter/);
    });
    it(`${name}: Taste and Aroma strips, a label on exactly the segments flavorStrips marks`, () => {
      const all = texts(card).map((t) => t.text);
      expect(all).toContain('TASTE');
      expect(all).toContain('AROMA');
      for (const row of [strips.taste, strips.aroma]) {
        for (const s of row.segments) expect(all.includes(s.label)).toBe(s.labelled);
      }
    });
  }
  it('only a set cover draws the wheel: 17 tracks, plus one wedge for each note that is on', () => {
    for (const [name, card] of Object.entries(cards)) {
      const wedges = card.primitives.filter((p) => p.type === 'wedge');
      if (name.startsWith('set')) expect(wedges.length).toBe(17 + BARS.length);
      else expect(wedges).toHaveLength(0);
    }
  });
  it('a long recipe name keeps the sentence in its own column and everything inside the card', () => {
    const long = { ...rec, name: 'Extraordinarily Long Cocktail Name With Several Extra Words Indeed' };
    const card = layoutCard({ format: 'preview', recipe: long, bars: BARS, link: 'neuralflavor.web.app/r/cocktail/extraordinarily-long' });
    const sentence = texts(card).filter((t) => t.runs);
    expect(Math.min(...sentence.map((t) => t.x))).toBeGreaterThan(600);
    for (const p of texts(card)) expect(p.y + p.h).toBeLessThanOrEqual(card.height);
  });
});

describe('the set cover keeps the wheel clear of the footer', () => {
  it('for a short name, a two-line name and a long info line, in portrait and tall', () => {
    for (const name of ['Negroni', 'Slow Braised Thai Green Curry With Coconut Milk And Fresh Thai Basil', 'x '.repeat(60)]) {
      for (const format of ['portrait', 'tall']) {
        const card = layoutSet({ format, recipe: { ...rec, name, garnish: 'a long garnish description that goes on and on', glass: 'g'.repeat(80) }, bars: BARS, link: 'neuralflavor.web.app/r/cocktail/negroni' })[0];
        const rule = Math.max(...card.primitives.filter((p) => p.type === 'line').map((p) => p.y1));
        const above = card.primitives.filter((p) => p.type !== 'line' && !(p.type === 'rect' && p.w > card.width - 100) && p.y < rule - 1);
        const bottoms = above.map((p) => (p.type === 'wedge' ? p.cy + p.r1 : p.y + (p.h || 0)));
        expect(Math.max(...bottoms)).toBeLessThanOrEqual(rule);
        expect(card.primitives.some((p) => p.type === 'wedge')).toBe(true);
      }
    }
  });
});

describe('cards with no chart are unchanged by CHART-4', () => {
  it('layouts with no bars hash to what they were before the tasting note (checked identical to the previous layout)', () => {
    const big = { ...rec, garnish: 'orange', name: 'A really quite extraordinarily long recipe name indeed', lines: Array.from({ length: 12 }, (_, i) => ({ label: `thing ${i}`, amount: `${i} g` })), lineCount: 14 };
    const h = createHash('sha256');
    for (const r of [{ ...rec, garnish: 'orange' }, big]) {
      for (const bars of [null, []]) {
        for (const f of ['preview', 'portrait', 'tall']) h.update(JSON.stringify(layoutCard({ format: f, recipe: r, bars, link: 'x.com/r/a' })));
        for (const f of ['portrait', 'tall']) h.update(JSON.stringify(layoutSet({ format: f, recipe: r, bars, link: 'x.com/r/a' })));
      }
    }
    expect(h.digest('hex')).toBe('39b36d90c8afb3c6c8dd4d84fdf2c77aae6ea96d9c59582ed4a2b0b8302b3b9d');
  });
});

describe('server cards and the shared page word a recipe the same', () => {
  const committed = JSON.parse(readFileSync(resolve(ROOT, 'functions/src/share/share-cards.json'), 'utf8'));
  it('every built-in card in share-cards.json has the sentence profileForRecipe gives the page', () => {
    let n = 0;
    for (const [kind, list] of [['cocktail', data.cocktails], ['sauce', data.sauces], ['dish', data.dishes]]) {
      for (const item of uniqueBySlug(kind, list)) {
        const slug = slugFor(kind, item);
        const r = builtIn(kind, slug);
        expect(flavorNote(committed[`${kind}/${slug}`].bars).text).toBe(flavorNote(profileForRecipe(r, nodes).bars).text);
        n += 1;
      }
    }
    expect(n).toBeGreaterThan(500);
  }, 60_000);
});

describe('a published copy keeps the sentence and strips the owner saw', () => {
  const stored = (kind, r) => {
    // what OwnShare does: bars from the lines (key + amount), then the document cleaner
    const item = { name: r.name, lines: r.lines.map((l) => ({ key: l.key || l.label, amount: l.amount || '' })) };
    const bars = barsFor({ kind: r.kind, lines: item.lines }, nodes, { stored: true });
    return toSharedDoc(item, { kind, uid: 'u', bars });
  };
  const cases = [['cocktail', 'negroni', 'cocktail'], ['cocktail', 'old-fashioned', 'cocktail'], ['sauce', 'hollandaise', 'sauce'], ['dish', 'thai-green-curry', 'recipe'], ['dish', 'beef-bolognese', 'recipe']];
  for (const [kind, slug, docKind] of cases) {
    it(`${slug}: sentence and strips from the stored bars equal the page's`, () => {
      const r = builtIn(kind, slug);
      const doc = stored(docKind, r);
      const page = profileForRecipe(fromSharedDoc(doc, 'abcdefghjk'), nodes).bars;
      expect(flavorNote(doc.bars).text).toBe(flavorNote(page).text);
      const strip = (b) => { const s = flavorStrips(b); return [s.taste, s.aroma].map((row) => row.segments.map((x) => [x.axis, x.labelled])); };
      expect(strip(doc.bars)).toEqual(strip(page));
    });
  }
  it('every built-in: stored sentence equals the page sentence, and some recipes need more than the old 11 bars', () => {
    let over11 = 0;
    for (const [kind, list, docKind] of [['cocktail', data.cocktails, 'cocktail'], ['sauce', data.sauces, 'sauce'], ['dish', data.dishes, 'recipe']]) {
      for (const item of uniqueBySlug(kind, list)) {
        const r = builtIn(kind, slugFor(kind, item));
        const doc = stored(docKind, r);
        const live = profileForRecipe(fromSharedDoc(doc, 'abcdefghjk'), nodes).bars.filter((b) => b.score >= FLOOR);
        if (live.length > 11) over11 += 1;
        expect(doc.bars.length).toBeLessThanOrEqual(SHARE_LIMITS.bars);
        expect(flavorNote(doc.bars).text).toBe(flavorNote(live).text);
      }
    }
    expect(over11).toBeGreaterThan(0);
    expect(SHARE_LIMITS.bars).toBe(17);
  }, 90_000);
});
