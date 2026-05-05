#!/usr/bin/env node
/**
 * Cocktail Codex v2 — Phase 1, step 1: ingest local data sources.
 *
 * Inputs:
 *   public/data/cocktail_codex.json       (172 curated)
 *   proDataset/raw/cocktaildb/drinks_*.json  (TheCocktailDB sharded)
 *
 * Output:
 *   proDataset/cocktails_v2/raw/local_ingested.json
 *   proDataset/cocktails_v2/raw/local_ingest_report.txt
 *
 * Schema (per cocktail):
 *   {
 *     name, name_canonical, sources[], ingredients_raw[], recipe_text,
 *     glass, iba_official, thecocktaildb_id, cocktail_codex_family_id,
 *     cocktail_codex_subcluster_id, garnishes[]
 *   }
 *
 * Applies the deterministic subset of §4.2 exclusion rules:
 *   2. Name regex (shots / novelty)
 *   3. Bad-tini regex
 *   4. Ingredient count ≤ 2
 *   6. Energy-drink + spirit + sugar
 *   7. Manual override blocklist
 *
 * Defers rules 1 (liqueur-base) and 5 (sweetener-count) to a second
 * pass after slot dictionary (`02-apply-slot-filters.cjs`) — those need
 * structural slot info that doesn't exist yet.
 */

const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '../../..');
const CODEX_PATH = path.join(ROOT, 'public/data/cocktail_codex.json');
const COCKTAILDB_DIR = path.join(ROOT, 'proDataset/raw/cocktaildb');
const OUT_DIR = path.join(ROOT, 'proDataset/cocktails_v2/raw');
const OUT_PATH = path.join(OUT_DIR, 'local_ingested.json');
const REPORT_PATH = path.join(OUT_DIR, 'local_ingest_report.txt');

// ---- Exclusion rules (deterministic subset) ----
// Rule 2: shots / novelty
const SHOTS_RE = /\b(shot|shooter|bomb|test\s*tube|jello|jelly\s*shot|slushie)\b/i;

// Rule 3: bad-tini — ends in "tini" but isn't an authentic Martini variant.
// Whitelist matched as a substring via TINI_LEGITIMATE_PREFIXES (any
// canonical name beginning with one of these, OR equal to one of the
// short ones like "vesper" / "gibson", is kept).
const TINI_LEGITIMATE_PREFIXES = [
  'martini',
  'dry martini',
  'wet martini',
  'dirty martini',
  'vodka martini',
  'gin martini',
  'naked martini',
  'fifty fifty',
  'normandie club martini',
  'vesper martini',
];
const TINI_LEGITIMATE_EXACT = new Set([
  'vesper',
  'gibson',
]);
// Manufactured / flavored tinis to actively reject (matches anywhere in
// the canonical name; takes precedence over the whitelist if both hit).
const TINI_MANUFACTURED_RE = /\b(apple|cherry|chocolate|cinnamon|coconut|coffee|cosmo|cranberry|espresso|french|kiwi|lemon|lychee|mango|melon|orange|peach|pineapple|pomegranate|pornstar|raspberry|strawberry|watermelon|passion\s*fruit|rumtini|appletini|saketini|zorbatini|martini\s+apfelsaft)\b/i;

// Rule 6: energy-drink combos
const ENERGY_RE = /\b(red\s*bull|monster|jagerbomb|jager\s*bomb|vegas\s*bomb)\b/i;

// Rule 7: manual blocklist (per spec §4.2)
const MANUAL_BLOCKLIST = new Set([
  'espresso martini',
  'long island iced tea',
  'long island ice tea',
  'lynchburg lemonade',
  'sex on the beach',
  'fuzzy navel',
  'screaming orgasm',
  'blue lagoon',
  'midori sour',
  'malibu sunrise',
  'piña colada', // moved from "iconic" — too sweet/manufactured per the user's spec
]);

function canonicalName(name) {
  return name
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function endsInTini(canonical) {
  return /tini$/.test(canonical) || /\btini\b/.test(canonical);
}

function isLegitimateTini(canonical) {
  if (TINI_LEGITIMATE_EXACT.has(canonical)) return true;
  return TINI_LEGITIMATE_PREFIXES.some((p) => canonical === p || canonical.startsWith(p + ' '));
}

// Rule 3 check: drop only manufactured/flavored "tinis", not legitimate
// Martini variants. Whitelist hits override this; manufactured-pattern
// hits force a drop even within the whitelist.
function isManufacturedTini(canonical) {
  if (!endsInTini(canonical)) return false;
  if (TINI_MANUFACTURED_RE.test(canonical)) return true;
  if (isLegitimateTini(canonical)) return false;
  return true;
}

// Syrup detection: anything in the Codex Syrups family (id=6) OR
// name ends in syrup / solution / tincture / cordial / acid is a
// non-cocktail utility entry. These are siphoned into a separate
// output so they don't pollute the cocktail clustering corpus.
function isSyrup(c) {
  if (c.cocktail_codex_family_id === 6) return true;
  return /\b(syrup|solution|tincture|cordial|acid|infusion|reduction)\b/i.test(c.name);
}

function applyDeterministicFilters(c) {
  const reasons = [];
  const cn = c.name_canonical;

  if (SHOTS_RE.test(cn)) reasons.push('rule-2: shots/novelty regex');
  if (isManufacturedTini(cn)) reasons.push('rule-3: manufactured/flavored tini');
  // Single-ingredient pours aren't cocktails (e.g. "Whiskey Neat").
  // 2-ingredient drinks like Martini, Bellini, Gin & Tonic are legit.
  if ((c.ingredients_raw || []).length <= 1) reasons.push('rule-4: ≤1 ingredient');
  if (ENERGY_RE.test(cn)) reasons.push('rule-6: energy-drink combo');
  if (MANUAL_BLOCKLIST.has(cn)) reasons.push('rule-7: manual blocklist');

  return reasons;
}

// ---- Cocktail Codex ingest ----

function ingestCodex() {
  const raw = JSON.parse(fs.readFileSync(CODEX_PATH, 'utf-8'));
  const cocktails = [];

  for (const c of raw.cocktails || []) {
    cocktails.push({
      name: c.name,
      name_canonical: canonicalName(c.name),
      sources: ['cocktail_codex'],
      ingredients_raw: (c.ingredients || []).map((s) => ({ raw: s })),
      recipe_text: (c.recipe_text || []).join('\n'),
      glass: null,
      iba_official: false,
      thecocktaildb_id: null,
      cocktail_codex_family_id: c.family_id,
      cocktail_codex_subcluster_id: c.subcluster_id,
      garnishes: c.garnishes || [],
      is_codex_root: !!c.isRoot,
    });
  }
  return cocktails;
}

// ---- TheCocktailDB ingest ----

function parseMeasure(measureStr) {
  if (!measureStr || typeof measureStr !== 'string') return { amount_ml: null };
  const m = measureStr.trim().toLowerCase();
  // Match "1 oz", "1.5 oz", "1/2 oz", "30 ml", "2 dashes", "1 splash"
  const ozMatch = m.match(/(\d+(?:\.\d+)?|\d+\s*\/\s*\d+)\s*(oz|ounce)/);
  if (ozMatch) {
    const num = ozMatch[1].includes('/')
      ? eval(ozMatch[1].replace(/\s/g, ''))
      : parseFloat(ozMatch[1]);
    return { amount_ml: num * 29.5735 };
  }
  const mlMatch = m.match(/(\d+(?:\.\d+)?)\s*ml/);
  if (mlMatch) return { amount_ml: parseFloat(mlMatch[1]) };
  const clMatch = m.match(/(\d+(?:\.\d+)?)\s*cl/);
  if (clMatch) return { amount_ml: parseFloat(clMatch[1]) * 10 };
  const dashMatch = m.match(/(\d+(?:\.\d+)?)\s*dash/);
  if (dashMatch) return { amount_ml: parseFloat(dashMatch[1]) * 0.92 };
  const dropMatch = m.match(/(\d+(?:\.\d+)?)\s*drop/);
  if (dropMatch) return { amount_ml: parseFloat(dropMatch[1]) * 0.05 };
  return { amount_ml: null };
}

function ingestCocktailDb() {
  const cocktails = [];
  const files = fs.readdirSync(COCKTAILDB_DIR).filter((f) => f.startsWith('drinks_'));
  for (const file of files) {
    const data = JSON.parse(fs.readFileSync(path.join(COCKTAILDB_DIR, file), 'utf-8'));
    for (const d of data.drinks || []) {
      // Skip non-alcoholic (we want cocktails, not mocktails for this v2)
      if (d.strAlcoholic !== 'Alcoholic') continue;
      const ingredients = [];
      for (let i = 1; i <= 15; i++) {
        const name = d[`strIngredient${i}`];
        const measure = d[`strMeasure${i}`];
        if (!name) continue;
        const measured = parseMeasure(measure);
        ingredients.push({
          raw: `${(measure || '').trim()} ${name}`.trim(),
          name: name.trim().toLowerCase(),
          measure: (measure || '').trim(),
          amount_ml: measured.amount_ml,
        });
      }
      cocktails.push({
        name: d.strDrink,
        name_canonical: canonicalName(d.strDrink),
        sources: ['thecocktaildb'],
        ingredients_raw: ingredients,
        recipe_text: d.strInstructions || '',
        glass: d.strGlass || null,
        iba_official: !!d.strIBA, // strIBA names the IBA list it appears in
        iba_list: d.strIBA || null,
        thecocktaildb_id: d.idDrink,
        cocktail_codex_family_id: null,
        cocktail_codex_subcluster_id: null,
        garnishes: [],
        is_codex_root: false,
      });
    }
  }
  return cocktails;
}

// ---- Merge by name_canonical ----

function mergeBySources(codex, cdb) {
  const byName = new Map();
  for (const c of codex) byName.set(c.name_canonical, c);
  for (const c of cdb) {
    if (byName.has(c.name_canonical)) {
      // Merge: keep Codex as primary, append source + add CDB-only fields
      const merged = byName.get(c.name_canonical);
      merged.sources = [...new Set([...merged.sources, ...c.sources])];
      if (!merged.glass) merged.glass = c.glass;
      if (!merged.thecocktaildb_id) merged.thecocktaildb_id = c.thecocktaildb_id;
      if (c.iba_official) {
        merged.iba_official = true;
        merged.iba_list = c.iba_list;
      }
      // If Codex didn't parse amounts but CDB has them, use CDB's parsed.
      const codexHasParsed = (merged.ingredients_raw || []).some((i) => i.amount_ml != null);
      if (!codexHasParsed && (c.ingredients_raw || []).some((i) => i.amount_ml != null)) {
        merged.ingredients_raw_cdb = c.ingredients_raw;
      }
    } else {
      byName.set(c.name_canonical, c);
    }
  }
  return [...byName.values()];
}

// ---- Main ----

function main() {
  const codex = ingestCodex();
  const cdb = ingestCocktailDb();
  const merged = mergeBySources(codex, cdb);

  const kept = [];
  const dropped = [];
  const syrups = [];

  for (const c of merged) {
    if (isSyrup(c)) {
      syrups.push(c);
      continue;
    }
    const reasons = applyDeterministicFilters(c);
    if (reasons.length === 0) {
      kept.push(c);
    } else {
      dropped.push({ name: c.name, sources: c.sources, reasons });
    }
  }

  fs.mkdirSync(OUT_DIR, { recursive: true });
  fs.writeFileSync(
    OUT_PATH,
    JSON.stringify(
      {
        _meta: {
          generatedAt: new Date().toISOString(),
          script: '01-ingest-local.cjs',
          input_codex_count: codex.length,
          input_cdb_count: cdb.length,
          merged_count: merged.length,
          syrup_count: syrups.length,
          kept_count: kept.length,
          dropped_count: dropped.length,
        },
        cocktails: kept,
      },
      null,
      2,
    ),
  );
  // Syrups carve-out (per spec §4.4)
  const SYRUPS_PATH = path.join(OUT_DIR, 'local_syrups.json');
  fs.writeFileSync(
    SYRUPS_PATH,
    JSON.stringify(
      {
        _meta: {
          generatedAt: new Date().toISOString(),
          script: '01-ingest-local.cjs',
          count: syrups.length,
          note: 'Non-cocktail utility entries (syrups, solutions, tinctures, cordials, acids). Used as ingredients in cocktails, not as cocktails themselves.',
        },
        syrups,
      },
      null,
      2,
    ),
  );

  // Build a human-readable report
  const lines = [];
  lines.push(`Cocktail v2 Phase 1 — local ingestion report`);
  lines.push(`Generated: ${new Date().toISOString()}`);
  lines.push('');
  lines.push(`Codex input:        ${codex.length}`);
  lines.push(`TheCocktailDB input: ${cdb.length}`);
  lines.push(`After merge:        ${merged.length} (${codex.length + cdb.length - merged.length} dedup matches)`);
  lines.push(`Syrups carved out:  ${syrups.length}`);
  lines.push(`Kept (cocktails):   ${kept.length}`);
  lines.push(`Dropped:            ${dropped.length}`);
  lines.push('');
  lines.push(`IBA-official kept:  ${kept.filter((c) => c.iba_official).length}`);
  lines.push(`Codex kept:         ${kept.filter((c) => c.sources.includes('cocktail_codex')).length}`);
  lines.push(`CDB-only kept:      ${kept.filter((c) => c.sources.length === 1 && c.sources[0] === 'thecocktaildb').length}`);
  lines.push('');
  lines.push(`--- Dropped sample (first 30) ---`);
  for (const d of dropped.slice(0, 30)) {
    lines.push(`  ${d.name.padEnd(40)} [${d.sources.join('+')}]  ${d.reasons.join('; ')}`);
  }
  lines.push('');
  lines.push(`--- Drop reason histogram ---`);
  const hist = {};
  for (const d of dropped) for (const r of d.reasons) hist[r] = (hist[r] || 0) + 1;
  for (const [r, n] of Object.entries(hist).sort((a, b) => b[1] - a[1])) {
    lines.push(`  ${n.toString().padStart(4)}  ${r}`);
  }
  fs.writeFileSync(REPORT_PATH, lines.join('\n'));

  console.log(`Wrote ${kept.length} cocktails to ${OUT_PATH}`);
  console.log(`Report at ${REPORT_PATH}`);
}

main();
