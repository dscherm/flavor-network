// @vitest-environment node
// LOOK-6b contract tests (blind): written from plan.md (LOOK-6b acceptance_criteria AC-3..AC-6) and the
// approved brief .schermness/design/LOOK-6b.md (sections 3.1, 3.4, 3.5, 10 tests 4-6 and 8). No
// implementation file was read; layouts come from the public exports layoutCard / layoutSet of
// src/data/shareCardLayout.js, built the way the existing share-card tests and the designer's sweep build them:
//   preview  : the function's input, share-cards.json, as the recipe (method ''), its stored bars
//   portrait, tall, set portrait, set tall : the full built-in recipe (resolveBuiltIn) with its profile bars
// Every built-in in share-cards.json (602) in all five formats; widths and glyphs measured from the bundled
// woff files in functions/fonts (advance widths, no kerning; 0.5 px tolerance).
import { describe, it, expect, beforeAll } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { readWoff, measure, missingChars } from './_woff.js';
import { layoutCard, layoutSet, SITE_NAME } from '../../../src/data/shareCardLayout.js';
import { resolveBuiltIn } from '../../../src/data/sharedRecipe.js';
import { readCuratedCodex } from '../../../scripts/lib/curatedCodex.mjs';
import { curateSauceAugment } from '../../../src/data/curation/applySauceCuration.js';
import { SEED_RECIPES } from '../../../src/data/seedRecipes.js';
import { RECIPE_DETAILS } from '../../../src/data/seedRecipeDetails.js';
import { profileForRecipe } from '../../../src/data/shareCardData.js';
import { loadFlavorNodes } from '../../../scripts/lib/flavorNodes.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '../../..');
const FN_FONTS = path.join(ROOT, 'functions', 'fonts');
const ELL = '…';
const DOT = ' · ';
const UNSUPPORTED_FRACTIONS = /[⅓⅔⅛⅜⅝⅞⅕⅖⅗⅘⅙⅚]/;

// The face file a text primitive is drawn with, by (font, weight). Brief 6 "Font files".
const faceFile = (font, weight) =>
  font === 'hand'
    ? path.join(FN_FONTS, `caveat-latin-${weight}-normal.woff`)
    : path.join(FN_FONTS, `alegreya-sans-lining-latin-${weight}-normal.woff`);
// One file check and one parse per (font, weight).
const FACES = new Map();
const faceFor = (p) => {
  const key = `${p.font}|${p.weight}`;
  if (!FACES.has(key)) {
    const f = faceFile(p.font, p.weight);
    FACES.set(key, fs.existsSync(f) ? readWoff(f) : null);
  }
  return FACES.get(key);
};

const texts = (card) => card.primitives.filter((p) => p.type === 'text');
const norm = (s) => String(s).replace(/[\s ]+/g, ' ').trim();
const stripEll = (s) => norm(String(s).split(ELL).join(''));

// Every string a recipe object holds (deep), the "data" a card may print as it is.
function dataStrings(obj, out = []) {
  if (typeof obj === 'string') out.push(obj);
  else if (Array.isArray(obj)) obj.forEach((v) => dataStrings(v, out));
  else if (obj && typeof obj === 'object') Object.values(obj).forEach((v) => dataStrings(v, out));
  return out;
}

// ---- the sweep (built once) ----
let SWEEP = []; // [{ id, fmt, card, recipe, data: [string] }]
let RESOLVED = 0;
let TOTAL = 0;
let BUILD_MS = 0;

beforeAll(() => {
  const t0 = Date.now();
  const codex = readCuratedCodex();
  const sauces = curateSauceAugment(JSON.parse(fs.readFileSync(path.join(ROOT, 'public/data/sauce_augment.json'), 'utf8'))).sauces || [];
  const data = { cocktails: codex.cocktails, families: codex.families, sauces, dishes: SEED_RECIPES, dishDetails: RECIPE_DETAILS };
  const nodes = loadFlavorNodes();
  const cards = JSON.parse(fs.readFileSync(path.join(ROOT, 'functions/src/share/share-cards.json'), 'utf8'));
  const ids = Object.keys(cards);
  TOTAL = ids.length;
  const out = [];
  for (const id of ids) {
    const [kind, slug] = id.split('/');
    const link = `neuralflavor.web.app/r/${id}`;
    const cd = cards[id];
    const prev = { kind: cd.kind, name: cd.name, category: cd.category, glass: cd.glass, meta: cd.meta, garnish: cd.garnish, lines: cd.lines, lineCount: cd.lineCount, method: '' };
    out.push({ id, fmt: 'preview', card: layoutCard({ format: 'preview', recipe: prev, bars: cd.bars, link }), recipe: prev, link });
    const r = resolveBuiltIn(kind, slug, data);
    if (!r) continue;
    RESOLVED++;
    const bars = profileForRecipe(r, nodes).bars.map((b) => ({ label: b.label, color: b.color, score: b.score }));
    out.push({ id, fmt: 'portrait', card: layoutCard({ format: 'portrait', recipe: r, bars, link }), recipe: r, link });
    out.push({ id, fmt: 'tall', card: layoutCard({ format: 'tall', recipe: r, bars, link }), recipe: r, link });
    layoutSet({ format: 'portrait', recipe: r, bars, link }).forEach((c, i) => out.push({ id, fmt: `set-portrait-${i + 1}`, card: c, recipe: r, link }));
    layoutSet({ format: 'tall', recipe: r, bars, link }).forEach((c, i) => out.push({ id, fmt: `set-tall-${i + 1}`, card: c, recipe: r, link }));
  }
  for (const e of out) e.data = dataStrings(e.recipe);
  SWEEP = out;
  BUILD_MS = Date.now() - t0;
}, 120_000);

// A user recipe with fractions the faces lack (brief 3.5, AC-5).
const USER = {
  kind: 'cocktail',
  name: 'My Third Tuesday',
  lines: [
    { key: 'rye whiskey', label: 'Rye whiskey', amount: '1⅔ oz' },
    { key: 'sweet vermouth', label: 'Sweet vermouth', amount: '⅓ oz' },
    { key: 'lemon juice', label: 'Lemon juice', amount: '½ oz' },
  ],
  method: 'Stir with ice.\nStrain into a chilled coupe.',
};
const USER_BARS = [
  { label: 'Bitter', color: '#a855f7', score: 0.8 },
  { label: 'Sweet', color: '#ff5fa2', score: 0.5 },
  { label: 'Fruity', color: '#fd875a', score: 0.3 },
];
const USER_LINK = 'neuralflavor.web.app/r/ab12cd34ef';
const userCards = () => [
  ['preview', layoutCard({ format: 'preview', recipe: USER, bars: USER_BARS, link: USER_LINK })],
  ['portrait', layoutCard({ format: 'portrait', recipe: USER, bars: USER_BARS, link: USER_LINK })],
  ['tall', layoutCard({ format: 'tall', recipe: USER, bars: USER_BARS, link: USER_LINK })],
  ...layoutSet({ format: 'portrait', recipe: USER, bars: USER_BARS, link: USER_LINK }).map((c, i) => [`set-portrait-${i + 1}`, c]),
  ...layoutSet({ format: 'tall', recipe: USER, bars: USER_BARS, link: USER_LINK }).map((c, i) => [`set-tall-${i + 1}`, c]),
];

const report = (list, n = 15) => `${list.length} found, first ${Math.min(n, list.length)}:\n${list.slice(0, n).join('\n')}`;

describe('LOOK-6b sweep: every built-in, every format', () => {
  it('builds layouts for every built-in (guards against an empty sweep)', () => {
    expect(TOTAL).toBeGreaterThanOrEqual(600);
    expect(RESOLVED, 'built-ins that resolve to a full recipe').toBeGreaterThanOrEqual(TOTAL - 5);
    expect(SWEEP.length).toBeGreaterThan(TOTAL * 8);
    // eslint-disable-next-line no-console
    console.log(`[LOOK-6b] ${TOTAL} built-ins, ${RESOLVED} resolved, ${SWEEP.length} cards, built in ${BUILD_MS} ms`);
  });
});

describe('LOOK-6b AC-3: hand only for the name, Ingredients, Method and the signature', () => {
  // Covers: AC-3
  it('every hand primitive is weight 700 and is a name line, "Ingredients", "Method" or "Neural Flavor"', () => {
    const bad = [];
    for (const { id, fmt, card, recipe } of SWEEP) {
      const name = norm(recipe.name);
      for (const p of texts(card)) {
        if (p.font !== 'hand') continue;
        const t = stripEll(p.text);
        const allowed = t === 'Ingredients' || t === 'Method' || t === SITE_NAME || (t.length > 0 && name.includes(t));
        if (!allowed || p.weight !== 700) bad.push(`${id} ${fmt}: hand ${p.weight} "${p.text}"`);
      }
    }
    expect(bad, report(bad)).toEqual([]);
  });

  // Covers: AC-3
  it('every other text primitive is sans at weight 400 or 500', () => {
    const bad = [];
    for (const { id, fmt, card } of SWEEP) {
      for (const p of texts(card)) {
        if (p.font === 'hand') continue;
        if (p.font !== 'sans' || (p.weight !== 400 && p.weight !== 500)) bad.push(`${id} ${fmt}: ${p.font} ${p.weight} "${p.text}"`);
      }
    }
    expect(bad, report(bad)).toEqual([]);
  });

  // Covers: AC-3 (brief D3: the tasting note is a sentence in Alegreya Sans, not the hand)
  it('the tasting note (the primitive with runs) is sans 400', () => {
    const bad = [];
    let seen = 0;
    for (const { id, fmt, card } of SWEEP) {
      for (const p of texts(card)) {
        if (!Array.isArray(p.runs)) continue;
        seen++;
        if (p.font !== 'sans' || p.weight !== 400) bad.push(`${id} ${fmt}: ${p.font} ${p.weight} "${p.text}"`);
      }
    }
    expect(seen, 'no tasting-note primitives found in the sweep').toBeGreaterThan(0);
    expect(bad, report(bad)).toEqual([]);
  });
});

describe('LOOK-6b AC-4: no text wider than its box, measured from the bundled fonts', () => {
  // Covers: AC-4
  it('the face files the cards use exist (Caveat 700, Alegreya Sans Lining 400 and 500)', () => {
    const used = new Set();
    for (const { card } of SWEEP) for (const p of texts(card)) used.add(`${p.font}|${p.weight}`);
    const missing = [...used].filter((k) => {
      const [font, w] = k.split('|');
      return !fs.existsSync(faceFile(font, Number(w)));
    });
    expect(missing, `no font file for: ${missing.join(', ')}`).toEqual([]);
  });

  // Covers: AC-4
  it('every text primitive measures at most its box width at its drawn size', () => {
    const over = [];
    const seen = new Set();
    for (const { id, fmt, card } of SWEEP) {
      for (const p of texts(card)) {
        const face = faceFor(p);
        if (!face) {
          over.push(`${id} ${fmt}: no face file for ${p.font} ${p.weight}`);
          continue;
        }
        const width = measure(face, p.text, p.size);
        if (width > p.w + 0.5) {
          const key = `${p.text}|${p.size}|${p.w}|${p.font}|${p.weight}`;
          if (seen.has(key)) continue;
          seen.add(key);
          over.push(`${id} ${fmt}: ${p.font} ${p.weight} ${p.size}px "${p.text.slice(0, 60)}" ${width.toFixed(1)} > ${p.w}`);
        }
      }
    }
    expect(over, report(over)).toEqual([]);
  });

  // Covers: AC-4 (self-check: the measure is the font's, not a constant)
  it('the measure tells a wide string from a narrow one', () => {
    const f = readWoff(path.join(FN_FONTS, 'caveat-latin-700-normal.woff'));
    expect(measure(f, 'WWWW', 40)).toBeGreaterThan(measure(f, 'iiii', 40));
    expect(measure(f, 'Negroni', 80)).toBeCloseTo(2 * measure(f, 'Negroni', 40), 5);
  });
});

describe('LOOK-6b AC-5: every character exists in its face; fractions the faces lack print as n/d', () => {
  // Covers: AC-5
  it('no built-in card text holds a character outside its face file', () => {
    const bad = [];
    const seen = new Set();
    for (const { id, fmt, card } of SWEEP) {
      for (const p of texts(card)) {
        const face = faceFor(p);
        if (!face) {
          bad.push(`${id} ${fmt}: no face file for ${p.font} ${p.weight}`);
          continue;
        }
        const miss = missingChars(face, p.text);
        if (!miss.length) continue;
        const key = `${p.font}${p.weight}|${miss.join('')}|${id}`;
        if (seen.has(key)) continue;
        seen.add(key);
        bad.push(`${id} ${fmt}: ${p.font} ${p.weight} lacks ${miss.map((c) => `U+${c.codePointAt(0).toString(16).toUpperCase().padStart(4, '0')}`).join(' ')} in "${p.text.slice(0, 60)}"`);
      }
    }
    expect(bad, report(bad)).toEqual([]);
  });

  // Covers: AC-5 (the Winter Rita method ends in U+2800, which no card face has)
  it('the Winter Rita set prints no U+2800 braille blank', () => {
    const rita = SWEEP.filter((e) => e.id === 'cocktail/winter-rita');
    expect(rita.length).toBeGreaterThan(0);
    for (const { card } of rita) for (const p of texts(card)) expect(p.text).not.toMatch(/[⠀​﻿]/);
  });

  // Covers: AC-5
  it('a user recipe with 1⅔ oz, ⅓ oz and ½ oz prints 1 2/3 oz, 1/3 oz and ½ oz in every format', () => {
    for (const [fmt, card] of userCards()) {
      const ts = texts(card).map((p) => p.text);
      for (const t of ts) expect(t, `${fmt}: "${t}"`).not.toMatch(UNSUPPORTED_FRACTIONS);
      // Formats that show the ingredient rows (set cards 1 and 3 do not).
      if (!ts.some((t) => /Rye whiskey|Sweet vermouth/.test(t))) continue;
      const all = ts.join('\n');
      expect(all, `${fmt}: 1⅔ oz should print as 1 2/3 oz`).toContain('1 2/3 oz');
      expect(all, `${fmt}: ⅓ oz should print as 1/3 oz`).toMatch(/(^|[^\d ])1\/3 oz/m);
      expect(all, `${fmt}: ½ oz stays a glyph`).toContain('½ oz');
      expect(all, `${fmt}: ½ must not become 1/2`).not.toContain('1/2 oz');
    }
  });

  // Covers: AC-5
  it('the user recipe cards hold no character outside their face files', () => {
    const bad = [];
    for (const [fmt, card] of userCards()) {
      for (const p of texts(card)) {
        const face = faceFor(p);
        if (!face) bad.push(`${fmt}: no face file for ${p.font} ${p.weight}`);
        else {
          const miss = missingChars(face, p.text);
          if (miss.length) bad.push(`${fmt}: "${p.text}" lacks ${miss.join(' ')}`);
        }
      }
    }
    expect(bad, report(bad)).toEqual([]);
  });

  // Covers: AC-5 (every format of the user recipe shows its amounts somewhere: guard against a vacuous pass)
  it('at least the portrait, tall and preview user cards show the amounts', () => {
    const shown = userCards().filter(([, c]) => texts(c).some((p) => p.text.includes('2/3 oz'))).map(([f]) => f);
    for (const f of ['preview', 'portrait', 'tall']) expect(shown).toContain(f);
  });
});

describe('LOOK-6b AC-6: no tracked capitals, no middle-dot separators built by the layout', () => {
  const capsWord = (s) => {
    const letters = (String(s).match(/\p{L}/gu) || []).join('');
    return letters.length >= 3 && letters === letters.toUpperCase() && letters !== letters.toLowerCase();
  };

  // Covers: AC-6
  it('no primitive except the link is all capitals with three or more letters (data printed as it is excepted)', () => {
    const bad = [];
    const seen = new Set();
    for (const { id, fmt, card, data, link } of SWEEP) {
      for (const p of texts(card)) {
        if (!capsWord(p.text)) continue;
        const t = stripEll(p.text);
        if (link.includes(t)) continue; // the printed link (or a piece of it when it wraps)
        if (data.some((d) => norm(d).includes(t))) continue; // e.g. a recipe named "ABC" or "AT&T"
        const key = `${id}|${p.text}`;
        if (seen.has(key)) continue;
        seen.add(key);
        bad.push(`${id} ${fmt}: "${p.text}"`);
      }
    }
    expect(bad, report(bad)).toEqual([]);
  });

  // Covers: AC-6
  it('no primitive contains " · " except inside a data string printed as it is (dish meta such as "Serves 4 · 45 min")', () => {
    const bad = [];
    const seen = new Set();
    for (const { id, fmt, card, data } of SWEEP) {
      const nd = data.map(norm);
      for (const p of texts(card)) {
        const t = norm(p.text);
        let at = t.indexOf(DOT);
        while (at !== -1) {
          // The dot with up to 6 characters either side (ellipsis removed) must appear in one data string.
          const win = stripEll(t.slice(Math.max(0, at - 6), at + DOT.length + 6));
          if (!nd.some((d) => d.includes(win))) {
            const key = `${id}|${p.text}`;
            if (!seen.has(key)) {
              seen.add(key);
              bad.push(`${id} ${fmt}: "${p.text}"`);
            }
            break;
          }
          at = t.indexOf(DOT, at + 1);
        }
      }
    }
    expect(bad, report(bad)).toEqual([]);
  });

  // Covers: AC-6 (self-check of both rules on probes)
  it('the rules catch the old kind label and strip titles and pass data meta', () => {
    expect(capsWord('COCKTAIL · AROMATIC STIRRED')).toBe(true);
    expect(capsWord('TASTE')).toBe(true);
    expect(capsWord('Taste')).toBe(false);
    expect(capsWord('1/3')).toBe(false);
    const data = ['Serves 4 · 45 min', 'Rocks', 'Orange peel'];
    const t = 'Serves 4 · 45 min';
    const at = t.indexOf(DOT);
    expect(data.some((d) => d.includes(stripEll(t.slice(Math.max(0, at - 6), at + DOT.length + 6))))).toBe(true);
    const built = 'Glass: Rocks · Garnish: Orange peel';
    const b = built.indexOf(DOT);
    expect(data.some((d) => d.includes(stripEll(built.slice(Math.max(0, b - 6), b + DOT.length + 6))))).toBe(false);
  });
});
