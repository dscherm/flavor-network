/**
 * 10-derive-sauce-clusters.js
 *
 * Derives mother-sauce cluster assignments per ingredient by walking
 * the 77 curated sauces in `public/data/sauce_augment.json`. Each
 * curated sauce carries a `motherSauce` field; we count how many
 * times each ingredient appears under each mother and assign the
 * argmax.
 *
 * Cluster IDs (Auguste Escoffier's five mother sauces):
 *   0  Béchamel     milk + roux
 *   1  Velouté      light stock + roux
 *   2  Espagnole    brown stock + tomato + mirepoix
 *   3  Tomate       tomato-based
 *   4  Hollandaise  egg yolk + butter emulsion
 *
 * Output schema mirrors `cocktail_clusters.json` so the lab loaders
 * can use one shared shape.
 */

import fs from 'fs';
import path from 'path';
import { ensureDir, log } from '../utils.js';

const SAUCE_AUGMENT = path.join(process.cwd(), '..', 'public', 'data', 'sauce_augment.json');
const OUT_PATH      = path.join(process.cwd(), '..', 'public', 'data', 'sauce_clusters.json');

const MOTHERS = [
  { id: 0, label: 'Béchamel',    color: '#fde68a' },  // pale cream
  { id: 1, label: 'Velouté',     color: '#facc15' },  // golden
  { id: 2, label: 'Espagnole',   color: '#92400e' },  // brown
  { id: 3, label: 'Tomate',      color: '#dc2626' },  // red
  { id: 4, label: 'Hollandaise', color: '#fb923c' },  // butter-orange
];

const NAME_TO_ID = Object.fromEntries(MOTHERS.map(m => [m.label.toLowerCase(), m.id]));

// Common motherSauce string variants → canonical mapping.
const ALIASES = {
  'béchamel':    0,
  'bechamel':    0,
  'velouté':     1,
  'veloute':     1,
  'espagnole':   2,
  'espanole':    2,
  'demi-glace':  2,
  'demi glace':  2,
  'tomate':      3,
  'tomato':      3,
  'sauce tomate':3,
  'hollandaise': 4,
};

function motherIdFor(motherSauceField) {
  if (!motherSauceField) return null;
  const k = motherSauceField.trim().toLowerCase();
  if (ALIASES[k] != null) return ALIASES[k];
  if (NAME_TO_ID[k] != null) return NAME_TO_ID[k];
  return null;
}

async function run() {
  log('Step 10: Derive mother-sauce clusters from curated sauces');

  if (!fs.existsSync(SAUCE_AUGMENT)) {
    throw new Error(`Missing ${SAUCE_AUGMENT}.`);
  }

  const augment = JSON.parse(fs.readFileSync(SAUCE_AUGMENT, 'utf8'));
  const sauces  = augment.sauces || [];
  log(`  Loaded ${sauces.length} curated sauces`);

  const tally = new Map();   // name → number[5]
  const saucesByFamily = [0,0,0,0,0];
  let unmatched = 0;

  for (const sauce of sauces) {
    const fam = motherIdFor(sauce.motherSauce);
    if (fam == null) { unmatched++; continue; }
    saucesByFamily[fam]++;
    for (const item of (sauce.ingredients || [])) {
      const name = (item?.name || '').trim().toLowerCase();
      if (!name) continue;
      if (!tally.has(name)) tally.set(name, [0,0,0,0,0]);
      tally.get(name)[fam]++;
    }
  }

  log(`  Sauces per mother: ` + MOTHERS.map((m, i) => `${m.label}=${saucesByFamily[i]}`).join(', ') + (unmatched ? ` (unmatched=${unmatched})` : ''));

  const ingredientClusters = {};
  const memberCounts = [0,0,0,0,0];
  for (const [name, votes] of tally) {
    let best = 0, bestVal = votes[0];
    for (let i = 1; i < votes.length; i++) {
      if (votes[i] > bestVal) { bestVal = votes[i]; best = i; }
    }
    ingredientClusters[name] = {
      cluster_id: best,
      cluster_label: MOTHERS[best].label,
    };
    memberCounts[best]++;
  }

  const output = {
    _meta: {
      source: 'sauce_augment.json',
      saucesClassified: sauces.length - unmatched,
      ingredients: tally.size,
      generatedAt: new Date().toISOString(),
    },
    clusters: MOTHERS.map((m, i) => ({ ...m, members: memberCounts[i] })),
    ingredient_clusters: ingredientClusters,
  };

  ensureDir(path.dirname(OUT_PATH));
  fs.writeFileSync(OUT_PATH, JSON.stringify(output, null, 2));
  const sizeKB = (fs.statSync(OUT_PATH).size / 1024).toFixed(1);
  log(`  Wrote ${OUT_PATH} (${sizeKB} KB)`);
  log('  Members per mother: ' + MOTHERS.map((m, i) => `${m.label}=${memberCounts[i]}`).join(', '));
}

run().catch(err => { console.error(err); process.exit(1); });
