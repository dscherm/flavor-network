// SHARE-4. Writes the small index the sharePreview Cloud Function uses to fill in
// link previews for built-in recipes, so the function does not bundle the app's
// data modules. Slugs come from src/data/sharedRecipe.js (the same code the
// /r/ page uses). Runs in `prebuild` and in the functions predeploy; the output
// is committed so functions tests and deploys never depend on run order.
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createRequire } from 'node:module';
import { resolveBuiltIn, slugFor, uniqueBySlug, SLUG_ALIASES } from '../src/data/sharedRecipe.js';
import { readCuratedCodex } from './lib/curatedCodex.mjs';
import { curateSauceAugment } from '../src/data/curation/applySauceCuration.js';
import { SEED_RECIPES } from '../src/data/seedRecipes.js';
import { RECIPE_DETAILS } from '../src/data/seedRecipeDetails.js';
import { profileForRecipe } from '../src/data/shareCardData.js';
import { SHARE_CHARTS_ENABLED } from '../src/data/shareTargets.js';
import { loadFlavorNodes } from './lib/flavorNodes.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
export const OUT_PATH = resolve(ROOT, 'functions/src/share/share-index.json');
const SITE = 'Neural Flavor';
const NOUN = { cocktail: 'cocktail', sauce: 'sauce', dish: 'dish' };
const MAX_DESC = 160;
export const CARDS_PATH = resolve(ROOT, 'functions/src/share/share-cards.json');
export const DISPLAY_SRC = resolve(ROOT, 'src/data/flavorDisplay.js');
export const CHARTS_SRC = resolve(ROOT, 'src/data/flavorCharts.js');
export const LAYOUT_SRC = resolve(ROOT, 'src/data/shareCardLayout.js');
export const LAYOUT_OUT = resolve(ROOT, 'functions/src/share/cardLayout.generated.ts');
export const PICTURES_OUT_APP = resolve(ROOT, 'src/data/pictureSvgs.generated.js');
export const PICTURES_OUT_FN = resolve(ROOT, 'functions/src/share/pictureSvgs.generated.ts');
const CARD_LINES = 8;

const readJson = (rel) => JSON.parse(readFileSync(resolve(ROOT, rel), 'utf8'));
const cap = (s) => (s ? s[0].toUpperCase() + s.slice(1) : s);

export function describe(kind, lines) {
  const names = [];
  for (const l of lines) {
    const n = String(l.label || l.key || '').trim();
    if (n && !names.some((x) => x.toLowerCase() === n.toLowerCase())) names.push(n);
    if (names.length === 4) break;
  }
  const tail = ` A ${NOUN[kind]} on ${SITE}.`;
  while (names.length) {
    const head = cap(names.join(", ").toLowerCase()) + ".";
    const out = head + tail;
    if (out.length <= MAX_DESC) return out;
    names.pop();
  }
  return `A ${NOUN[kind]} on ${SITE}.`;
}

function loadData() {
  const codex = readCuratedCodex();
  const sauces = curateSauceAugment(readJson('public/data/sauce_augment.json')).sauces || [];
  return {
    cocktails: codex.cocktails || [], families: codex.families || [],
    sauces, dishes: SEED_RECIPES, dishDetails: RECIPE_DETAILS,
  };
}

function eachBuiltIn(data, fn) {
  const lists = { cocktail: data.cocktails, sauce: data.sauces, dish: data.dishes };
  for (const kind of Object.keys(lists)) {
    for (const item of uniqueBySlug(kind, lists[kind])) {
      const slug = slugFor(kind, item);
      const r = resolveBuiltIn(kind, slug, data);
      if (r) fn(kind, slug, r);
    }
  }
}

/** A merged duplicate's old slug (DATA-6) gets the same entry as the drink that absorbed it, so old links still preview. */
function addAliases(out) {
  for (const [kind, map] of Object.entries(SLUG_ALIASES)) {
    for (const [from, to] of Object.entries(map)) if (out[`${kind}/${to}`] && !out[`${kind}/${from}`]) out[`${kind}/${from}`] = out[`${kind}/${to}`];
  }
  return out;
}

export function buildShareIndex() {
  const data = loadData();
  const index = {};
  eachBuiltIn(data, (kind, slug, r) => {
    index[`${kind}/${slug}`] = { name: r.name, description: describe(kind, r.lines), kind };
  });
  return addAliases(index);
}

/**
 * What the shareCard function needs to draw a built-in recipe's preview card, so it never loads the
 * flavor data or the app's modules: the first few ingredient lines, and the chart bars worked out
 * here with the same code the share page uses.
 */
export function buildShareCards() {
  const data = loadData();
  const nodes = SHARE_CHARTS_ENABLED ? loadFlavorNodes() : new Map();
  const out = {};
  eachBuiltIn(data, (kind, slug, r) => {
    const bars = !SHARE_CHARTS_ENABLED ? [] : profileForRecipe(r, nodes).bars
      .map((b) => ({ label: b.label, color: b.color, score: Math.round(b.score * 1000) / 1000 }));
    const lines = r.lines.slice(0, CARD_LINES).map((l) => {
      const o = { label: l.label || l.key, amount: l.amount || '' };
      if (l.suggested) o.suggested = true;
      return o;
    });
    const card = { name: r.name, kind, lines, lineCount: r.lines.length, bars };
    for (const f of ['category', 'glass', 'meta', 'garnish']) if (r[f]) card[f] = r[f];
    out[`${kind}/${slug}`] = card;
  });
  addAliases(out);
  return Object.fromEntries(Object.keys(out).sort().map((k) => [k, out[k]]));
}

/** The layout module, emitted for the functions package (which cannot import from src/). */
export function buildLayoutModule() {
  // The layout imports the chart pieces (src/data/flavorCharts.js, which imports src/data/flavorDisplay.js); the functions
  // package cannot import from src/, so both sources are inlined ahead of the layout and their import lines are dropped.
  const dropImports = (file) => readFileSync(file, 'utf8').split(/\r?\n/).filter((l) => !l.includes("from './flavorDisplay.js'") && !l.includes("from './flavorCharts.js'")).join('\n');
  const rule = `${readFileSync(DISPLAY_SRC, 'utf8')}\n${dropImports(CHARTS_SRC)}`;
  const src = dropImports(LAYOUT_SRC);
  return `// @ts-nocheck
// GENERATED by scripts/buildShareIndex.mjs from src/data/shareCardLayout.js. Do not edit.
// From src/data/shareTargets.js (SHARE-8): whether a card draws the flavor chart.
export const SHARE_CHARTS_ENABLED = ${SHARE_CHARTS_ENABLED};
${rule}
${src}`;
}

/**
 * PICTURE-4. Every drawing a cook can pick (src/components/pictureArt.jsx), as a standalone SVG string at its default colours, so
 * the share cards can draw an icon picture without React: the browser canvas (lazy chunk) and the shareCard function (satori) both
 * read this map. Rendered with react-dom/server from the real component, so the card shows exactly what the app draws.
 */
export async function buildPictureSvgs() {
  const { build: esbuild } = await import('esbuild'); // lazy: esbuild refuses to load in a jsdom test environment
  const entry = `import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { PictureArt, allPictureIds } from './src/components/pictureArt.jsx';
export const SVGS = Object.fromEntries(allPictureIds().map((id) => [id, renderToStaticMarkup(React.createElement(PictureArt, { id, size: 256 }))]));`;
  const out = await esbuild({
    stdin: { contents: entry, resolveDir: ROOT, loader: 'js' },
    bundle: true, write: false, format: 'cjs', platform: 'node', jsx: 'automatic', loader: { '.jsx': 'jsx' },
    external: ['react', 'react-dom', 'react-dom/server'], logLevel: 'silent',
  });
  const mod = { exports: {} };
  new Function('module', 'exports', 'require', out.outputFiles[0].text)(mod, mod.exports, createRequire(resolve(ROOT, 'package.json')));
  const svgs = {};
  for (const id of Object.keys(mod.exports.SVGS).sort()) {
    svgs[id] = mod.exports.SVGS[id].replace(/^<svg([^>]*)>/, (_m, attrs) => {
      const keep = attrs.replace(/\s(?:style|aria-hidden|focusable|data-testid|data-picture)="[^"]*"/g, '');
      return `<svg xmlns="http://www.w3.org/2000/svg"${keep}>`;
    });
  }
  return svgs;
}

export function pictureSvgsModule(svgs, { ts = false } = {}) {
  return `${ts ? '// @ts-nocheck\n' : ''}// GENERATED by scripts/buildShareIndex.mjs from src/components/pictureArt.jsx. Do not edit.
// Every pickable drawing as a standalone SVG string (PICTURE-4): the share cards draw icon pictures from this.
export const PICTURE_SVGS${ts ? ': Record<string, string>' : ''} = ${JSON.stringify(svgs, null, 1)};
`;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const index = buildShareIndex();
  const sorted = Object.fromEntries(Object.keys(index).sort().map((k) => [k, index[k]]));
  writeFileSync(OUT_PATH, JSON.stringify(sorted) + '\n');
  console.log(`share index: ${Object.keys(sorted).length} recipes -> ${OUT_PATH}`);
  const cards = buildShareCards();
  writeFileSync(CARDS_PATH, `${JSON.stringify(cards)}
`);
  console.log(`share cards: ${Object.keys(cards).length} recipes -> ${CARDS_PATH}`);
  writeFileSync(LAYOUT_OUT, buildLayoutModule());
  console.log(`share card layout -> ${LAYOUT_OUT}`);
  const svgs = await buildPictureSvgs();
  writeFileSync(PICTURES_OUT_APP, pictureSvgsModule(svgs));
  writeFileSync(PICTURES_OUT_FN, pictureSvgsModule(svgs, { ts: true }));
  console.log(`picture drawings: ${Object.keys(svgs).length} -> ${PICTURES_OUT_APP}, ${PICTURES_OUT_FN}`);
}
