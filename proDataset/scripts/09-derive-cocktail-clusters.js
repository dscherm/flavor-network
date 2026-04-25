/**
 * 09-derive-cocktail-clusters.js
 *
 * Derives cocktail-codex cluster assignments per ingredient using the
 * full TheCocktailDB recipe cache (proDataset/raw/cocktaildb/drinks_*.json,
 * 426 drinks). Each drink is heuristically classified into one of the
 * six Death-&-Co codex families:
 *
 *   0  Old-Fashioned   spirit + sugar/syrup + bitters (no citrus, no vermouth)
 *   1  Martini         spirit + vermouth (stirred, dry)
 *   2  Daiquiri        spirit + citrus juice + sweetener
 *   3  Sidecar         spirit + citrus juice + orange liqueur (curaçao / triple sec)
 *   4  Highball        spirit + carbonated mixer (tonic / soda / cola / ginger ale)
 *   5  Flip            spirit + sugar + whole egg / egg yolk
 *
 * For each ingredient we count its appearances per family and assign
 * the argmax. Ingredients that never appear in a classified drink fall
 * back to "Old-Fashioned" (the most spirit-forward family) so they
 * still get a cluster colour in the 3D scene.
 *
 * Output schema (mirrors public/proDataset/cluster_explanations.json
 * so the labs can use the same loader pattern as LivingArchView):
 *   {
 *     _meta: { source: 'cocktaildb', drinksClassified: N, ... },
 *     clusters: [{ id, label, color, members: count }],
 *     ingredient_clusters: { <name>: { cluster_id, cluster_label } }
 *   }
 */

import fs from 'fs';
import path from 'path';
import { RAW_DIR } from '../config.js';
import { canonicalizeIngredient, ensureDir, log } from '../utils.js';

const CACHE_DIR = path.join(RAW_DIR, 'cocktaildb');
const OUT_PATH  = path.join(process.cwd(), '..', 'public', 'data', 'cocktail_clusters.json');

const FAMILIES = [
  { id: 0, label: 'Old-Fashioned', color: '#b45309' },
  { id: 1, label: 'Martini',       color: '#94a3b8' },
  { id: 2, label: 'Daiquiri',      color: '#facc15' },
  { id: 3, label: 'Sidecar',       color: '#ea580c' },
  { id: 4, label: 'Highball',      color: '#22c55e' },
  { id: 5, label: 'Flip',          color: '#a855f7' },
];

const BITTERS_RE   = /\b(bitter|angostura|peychaud)/;
const VERMOUTH_RE  = /\b(vermouth|lillet|punt e mes)\b/;
const CITRUS_RE    = /\b(lemon juice|lime juice|grapefruit juice|orange juice|yuzu juice)\b/;
const SWEETENER_RE = /\b(simple syrup|sugar|grenadine|honey|agave|maple|cane syrup|gomme|orgeat|falernum)\b/;
const ORANGE_LIQUEUR_RE = /\b(triple sec|cointreau|grand marnier|curacao|curaçao|orange liqueur)\b/;
const CARBONATED_RE = /\b(soda water|club soda|tonic|cola|ginger ale|ginger beer|seltzer|sparkling|champagne|prosecco|sprite|7\s?up|lemonade)\b/;
const EGG_RE       = /\begg(\s?(white|yolk))?\b/;
const SPIRIT_RE    = /\b(gin|vodka|whiskey|whisky|bourbon|rye|scotch|tequila|mezcal|rum|cachaça|cachaca|cognac|brandy|pisco|aquavit|sake|absinthe)\b/;

function classifyDrink(canonicalNames) {
  const joined = canonicalNames.join(' | ');
  const hasSpirit = SPIRIT_RE.test(joined);

  // Flip — egg with sugar/spirit. Egg whites in a sour go to Sidecar/Daiquiri
  // instead, but a whole-egg + sugar drink is canonically a flip.
  if (/\begg yolk\b/.test(joined) && SWEETENER_RE.test(joined)) return 5;
  if (/\begg\b(?!\s?white)/.test(joined) && SWEETENER_RE.test(joined) && hasSpirit) return 5;

  // Old-Fashioned — bitters present, no citrus juice, no vermouth.
  if (BITTERS_RE.test(joined) && !CITRUS_RE.test(joined) && !VERMOUTH_RE.test(joined)) return 0;

  // Martini — vermouth present, no citrus juice.
  if (VERMOUTH_RE.test(joined) && !CITRUS_RE.test(joined)) return 1;

  // Sidecar — orange liqueur + citrus + spirit.
  if (ORANGE_LIQUEUR_RE.test(joined) && CITRUS_RE.test(joined) && hasSpirit) return 3;

  // Highball — carbonated mixer + spirit (and not already classified above).
  if (CARBONATED_RE.test(joined) && hasSpirit) return 4;

  // Daiquiri — citrus + sweetener + spirit (the catch-all sour).
  if (CITRUS_RE.test(joined) && SWEETENER_RE.test(joined) && hasSpirit) return 2;

  // Fallback: drinks with bitters → Old-Fashioned, with vermouth → Martini,
  // citrus → Daiquiri, otherwise Old-Fashioned (most spirit-forward).
  if (BITTERS_RE.test(joined)) return 0;
  if (VERMOUTH_RE.test(joined)) return 1;
  if (CITRUS_RE.test(joined)) return 2;
  return 0;
}

function extractIngredients(drink) {
  const out = [];
  for (let i = 1; i <= 15; i++) {
    const raw = drink[`strIngredient${i}`];
    if (!raw || !raw.trim()) continue;
    const canonical = canonicalizeIngredient(raw);
    if (canonical) out.push(canonical);
  }
  return [...new Set(out)];
}

async function run() {
  log('Step 9: Derive cocktail-codex clusters from cached recipe data');

  if (!fs.existsSync(CACHE_DIR)) {
    throw new Error(`Missing ${CACHE_DIR}. Run step 4 (fetch-cocktaildb) first.`);
  }

  const drinks = [];
  for (const f of fs.readdirSync(CACHE_DIR)) {
    if (!f.endsWith('.json')) continue;
    const j = JSON.parse(fs.readFileSync(path.join(CACHE_DIR, f), 'utf8'));
    if (j?.drinks) drinks.push(...j.drinks);
  }
  log(`  Loaded ${drinks.length} drinks from cache`);

  // Per-ingredient family vote tally
  const tally = new Map();    // name → number[6]
  const drinksByFamily = [0,0,0,0,0,0];

  for (const drink of drinks) {
    const ings = extractIngredients(drink);
    if (ings.length < 2) continue;
    const fam = classifyDrink(ings);
    drinksByFamily[fam]++;
    for (const ing of ings) {
      if (!tally.has(ing)) tally.set(ing, [0,0,0,0,0,0]);
      tally.get(ing)[fam]++;
    }
  }

  log('  Drinks per family: ' + FAMILIES.map((f, i) => `${f.label}=${drinksByFamily[i]}`).join(', '));

  // Argmax per ingredient
  const ingredientClusters = {};
  const memberCounts = [0,0,0,0,0,0];
  for (const [name, votes] of tally) {
    let best = 0, bestVal = votes[0];
    for (let i = 1; i < votes.length; i++) {
      if (votes[i] > bestVal) { bestVal = votes[i]; best = i; }
    }
    ingredientClusters[name] = {
      cluster_id: best,
      cluster_label: FAMILIES[best].label,
    };
    memberCounts[best]++;
  }

  const output = {
    _meta: {
      source: 'cocktaildb',
      drinksClassified: drinks.length,
      ingredients: tally.size,
      generatedAt: new Date().toISOString(),
    },
    clusters: FAMILIES.map((f, i) => ({ ...f, members: memberCounts[i] })),
    ingredient_clusters: ingredientClusters,
  };

  ensureDir(path.dirname(OUT_PATH));
  fs.writeFileSync(OUT_PATH, JSON.stringify(output, null, 2));
  const sizeKB = (fs.statSync(OUT_PATH).size / 1024).toFixed(1);
  log(`  Wrote ${OUT_PATH} (${sizeKB} KB)`);
  log('  Members per family: ' + FAMILIES.map((f, i) => `${f.label}=${memberCounts[i]}`).join(', '));
}

run().catch(err => { console.error(err); process.exit(1); });
