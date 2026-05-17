/**
 * 17-merge-manual-pairings.js
 *
 * Bootstrap pairings for ingredients RecipeNLG / MealDB don't carry.
 * Reads proDataset/data/manual_pairings.json (curated edge lists) and
 * synthesizes entries into cuisine_pairings.json so the new
 * ingredients flow through getNeighborsEnriched alongside the
 * corpus-derived pairs.
 *
 * Behavior:
 *   --dry-run (default): prints what would be added
 *   --apply:             writes both proDataset/output/ and
 *                        public/proDataset/ copies of cuisine_pairings.json
 *
 * Each synthesized record uses count=25 + recipePct=0.10 so it
 * passes the displayableCuisine 1.5× dominance gate without
 * overclaiming. source='manual-bootstrap' tags every entry for audit.
 *
 * Skips:
 *   - partners not present in ingredients.json (would create
 *     dangling edges in the graph)
 *   - pairs that already exist in cuisine_pairings.json (preserves
 *     corpus-derived evidence)
 */
import fs from 'fs';
import path from 'path';
import { OUTPUT_DIR, DATA_DIR } from '../config.js';
import { ensureDir, writeJson, log } from '../utils.js';

const MANUAL_PATH = path.join(DATA_DIR, 'manual_pairings.json');
const CUISINE_PAIRS_PATH = path.join(OUTPUT_DIR, 'cuisine_pairings.json');
const PUBLIC_CUISINE_PAIRS_PATH = path.resolve(OUTPUT_DIR, '..', '..', 'public', 'proDataset', 'cuisine_pairings.json');
const INGREDIENTS_PATH = path.join(OUTPUT_DIR, 'ingredients.json');

const COUNT = 25;
const RECIPE_PCT = 0.10;

function pairKey(a, b) {
  const la = String(a).toLowerCase().trim();
  const lb = String(b).toLowerCase().trim();
  return la < lb ? `${la}|${lb}` : `${lb}|${la}`;
}

function main() {
  const isApply = process.argv.includes('--apply');
  log(`=== 17: merge manual pairings (${isApply ? 'APPLY' : 'DRY-RUN'}) ===`);

  const manual = JSON.parse(fs.readFileSync(MANUAL_PATH, 'utf8'));
  const cuisinePairs = JSON.parse(fs.readFileSync(CUISINE_PAIRS_PATH, 'utf8'));
  const ingredients = JSON.parse(fs.readFileSync(INGREDIENTS_PATH, 'utf8'));

  const knownIngredients = new Set(Object.keys(ingredients).filter(k => !k.startsWith('_')));
  const pairs = cuisinePairs.pairs || {};
  const initialPairCount = Object.keys(pairs).length;

  let added = 0, skippedMissing = 0, skippedExisting = 0;
  const auditLines = [];

  for (const [focal, spec] of Object.entries(manual.bootstraps)) {
    // Skip _extra suffix variants only if they carry no partners
    if (!spec.partners || spec.partners.length === 0) continue;
    // Strip _extra suffix to get the actual focal ingredient name
    const focalIng = focal.endsWith('_extra') ? focal.slice(0, -6) : focal;
    if (!knownIngredients.has(focalIng)) {
      auditLines.push(`  ⚠ focal "${focalIng}" not in ingredients.json — skipping all partners`);
      continue;
    }
    auditLines.push(`\n  ${focalIng}  (${spec.cuisine})`);

    for (const partner of spec.partners) {
      if (!knownIngredients.has(partner)) {
        skippedMissing++;
        auditLines.push(`    skip  ${partner.padEnd(28)} (not in ingredients.json)`);
        continue;
      }
      const key = pairKey(focalIng, partner);
      if (pairs[key]) {
        skippedExisting++;
        auditLines.push(`    keep  ${partner.padEnd(28)} (existing corpus pair, not overwriting)`);
        continue;
      }
      pairs[key] = {
        evidence: [{
          cuisine: spec.cuisine,
          count: COUNT,
          recipePct: RECIPE_PCT,
        }],
        primary: spec.cuisine,
        novelty: 1.0,
        modelStrength: null,
        source: 'manual-bootstrap',
      };
      added++;
      auditLines.push(`    ADD   ${partner.padEnd(28)} → ${key}`);
    }
  }

  log(`\nAdditions: ${added}`);
  log(`Skipped (partner missing): ${skippedMissing}`);
  log(`Skipped (already exists in corpus): ${skippedExisting}`);
  log(`Total cuisine pairs: ${initialPairCount} → ${initialPairCount + added}`);
  log('\nDetails:');
  for (const line of auditLines) log(line);

  if (!isApply) {
    log('\n(dry-run — pass --apply to write changes)');
    return;
  }

  ensureDir(OUTPUT_DIR);
  writeJson(CUISINE_PAIRS_PATH, { pairs, _meta: cuisinePairs._meta });
  log(`Wrote ${CUISINE_PAIRS_PATH}`);
  fs.copyFileSync(CUISINE_PAIRS_PATH, PUBLIC_CUISINE_PAIRS_PATH);
  log(`Mirrored to ${PUBLIC_CUISINE_PAIRS_PATH}`);
}

main();
