#!/usr/bin/env node
/**
 * Cocktail Codex v2 — Phase 1, step 3: merge IBA Wikipedia recipes.
 *
 * Loads `iba_wikipedia_recipes.json` (32 cocktails fetched by the
 * research agent) and adds them to the corpus. Re-applies the
 * deterministic exclusion rules from step 1 so that IBA-blessed but
 * still-manufactured drinks (e.g. Espresso Martini if Wikipedia had it
 * by some chance) are still filtered.
 *
 * Inputs:
 *   proDataset/cocktails_v2/raw/iba_merged.json   (482 + 59 IBA tags)
 *   proDataset/cocktails_v2/raw/iba_wikipedia_recipes.json (32 new)
 *
 * Outputs:
 *   proDataset/cocktails_v2/raw/corpus_v1.json    (final Phase 1)
 *   proDataset/cocktails_v2/raw/corpus_v1_report.txt
 */

const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '../../..');
const MERGED_PATH = path.join(ROOT, 'proDataset/cocktails_v2/raw/iba_merged.json');
const WIKI_PATH = path.join(ROOT, 'proDataset/cocktails_v2/raw/iba_wikipedia_recipes.json');
const OUT_DIR = path.join(ROOT, 'proDataset/cocktails_v2/raw');
const OUT_PATH = path.join(OUT_DIR, 'corpus_v1.json');
const REPORT_PATH = path.join(OUT_DIR, 'corpus_v1_report.txt');

// Re-import the same filter logic as step 1.
const SHOTS_RE = /\b(shot|shooter|bomb|test\s*tube|jello|jelly\s*shot|slushie)\b/i;
const ENERGY_RE = /\b(red\s*bull|monster|jagerbomb|jager\s*bomb|vegas\s*bomb)\b/i;

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
const TINI_LEGITIMATE_EXACT = new Set(['vesper', 'gibson']);
const TINI_MANUFACTURED_RE = /\b(apple|cherry|chocolate|cinnamon|coconut|coffee|cosmo|cranberry|espresso|french|kiwi|lemon|lychee|mango|melon|orange|peach|pineapple|pomegranate|pornstar|raspberry|strawberry|watermelon|passion\s*fruit|rumtini|appletini|saketini|zorbatini|martini\s+apfelsaft)\b/i;

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
  'piña colada',
]);

function endsInTini(c) { return /tini$/.test(c) || /\btini\b/.test(c); }
function isLegitimateTini(c) {
  if (TINI_LEGITIMATE_EXACT.has(c)) return true;
  return TINI_LEGITIMATE_PREFIXES.some((p) => c === p || c.startsWith(p + ' '));
}
function isManufacturedTini(c) {
  if (!endsInTini(c)) return false;
  if (TINI_MANUFACTURED_RE.test(c)) return true;
  if (isLegitimateTini(c)) return false;
  return true;
}
function applyDeterministicFilters(c) {
  const reasons = [];
  const cn = c.name_canonical;
  if (SHOTS_RE.test(cn)) reasons.push('rule-2: shots/novelty regex');
  if (isManufacturedTini(cn)) reasons.push('rule-3: manufactured/flavored tini');
  if ((c.ingredients_raw || []).length <= 1) reasons.push('rule-4: ≤1 ingredient');
  if (ENERGY_RE.test(cn)) reasons.push('rule-6: energy-drink combo');
  if (MANUAL_BLOCKLIST.has(cn)) reasons.push('rule-7: manual blocklist');
  return reasons;
}

function main() {
  const merged = JSON.parse(fs.readFileSync(MERGED_PATH, 'utf-8'));
  const wiki = JSON.parse(fs.readFileSync(WIKI_PATH, 'utf-8'));

  const byCanonical = new Map();
  for (const c of merged.cocktails) byCanonical.set(c.name_canonical, c);

  let added = 0;
  let updated = 0;
  let dropped = [];

  for (const w of wiki.cocktails || []) {
    // Normalize the wiki entry to our schema (some fields differ)
    const normalized = {
      name: w.name,
      name_canonical: w.name_canonical,
      sources: w.sources || ['iba', 'wikipedia'],
      ingredients_raw: w.ingredients_raw || [],
      recipe_text: w.recipe_text || '',
      glass: w.glass || null,
      iba_official: w.iba_official === true,
      iba_category: w.iba_category || null,
      iba_base: w.iba_base || null,
      thecocktaildb_id: null,
      cocktail_codex_family_id: null,
      cocktail_codex_subcluster_id: null,
      garnishes: w.garnishes || [],
      is_codex_root: false,
      build_method: w.build_method || null, // pre-curated by agent — bonus
    };
    const reasons = applyDeterministicFilters(normalized);
    if (reasons.length > 0) {
      dropped.push({ name: normalized.name, reasons });
      continue;
    }
    const existing = byCanonical.get(normalized.name_canonical);
    if (existing) {
      // Update existing entry — keep its richer fields, but enrich
      // missing ones from the wiki recipe.
      if (!existing.ingredients_raw || existing.ingredients_raw.length === 0
          || existing.ingredients_raw.every((i) => i.amount_ml == null)) {
        existing.ingredients_raw = normalized.ingredients_raw;
      }
      if (!existing.recipe_text) existing.recipe_text = normalized.recipe_text;
      if (!existing.glass) existing.glass = normalized.glass;
      if (!existing.build_method) existing.build_method = normalized.build_method;
      if (!existing.garnishes || existing.garnishes.length === 0)
        existing.garnishes = normalized.garnishes;
      existing.iba_official = true;
      if (!existing.iba_category) existing.iba_category = normalized.iba_category;
      for (const s of normalized.sources)
        if (!existing.sources.includes(s)) existing.sources.push(s);
      updated++;
    } else {
      byCanonical.set(normalized.name_canonical, normalized);
      added++;
    }
  }

  const cocktails = [...byCanonical.values()];

  // Write outputs
  fs.writeFileSync(
    OUT_PATH,
    JSON.stringify(
      {
        _meta: {
          generatedAt: new Date().toISOString(),
          script: '03-merge-iba-wikipedia.cjs',
          input_corpus: merged.cocktails.length,
          input_wiki: (wiki.cocktails || []).length,
          wiki_added: added,
          wiki_updated: updated,
          wiki_dropped: dropped.length,
          wiki_failed_to_fetch: (wiki._meta?.failed_names || []).length,
          final_count: cocktails.length,
          iba_official_count: cocktails.filter((c) => c.iba_official).length,
        },
        cocktails,
      },
      null,
      2,
    ),
  );

  const lines = [];
  lines.push('Cocktail v2 Phase 1 — corpus_v1 report (post IBA-Wikipedia merge)');
  lines.push(`Generated: ${new Date().toISOString()}`);
  lines.push('');
  lines.push(`Input corpus:        ${merged.cocktails.length}`);
  lines.push(`Wiki recipes fetched: ${(wiki.cocktails || []).length}`);
  lines.push(`  Added (new):       ${added}`);
  lines.push(`  Updated (enriched): ${updated}`);
  lines.push(`  Dropped (filter):  ${dropped.length}`);
  lines.push(`Wiki agent failed:   ${(wiki._meta?.failed_names || []).length}  (need other sources)`);
  lines.push(`FINAL CORPUS:        ${cocktails.length}`);
  lines.push(`  IBA-official:      ${cocktails.filter((c) => c.iba_official).length}`);
  lines.push(`  Codex-tagged:      ${cocktails.filter((c) => c.sources.includes('cocktail_codex')).length}`);
  lines.push(`  CDB-only:          ${cocktails.filter((c) => c.sources.length === 1 && c.sources[0] === 'thecocktaildb').length}`);
  lines.push('');
  lines.push('--- Wiki cocktails added ---');
  const newOnes = cocktails.filter((c) => c.sources.includes('wikipedia') && !c.thecocktaildb_id && !c.cocktail_codex_family_id);
  for (const c of newOnes) {
    lines.push(`  ${c.name.padEnd(28)} [${c.iba_category || 'unk'.padEnd(15)}] (${(c.ingredients_raw || []).length} ingredients)`);
  }
  if (dropped.length > 0) {
    lines.push('');
    lines.push('--- Dropped from wiki batch ---');
    for (const d of dropped) lines.push(`  ${d.name}: ${d.reasons.join('; ')}`);
  }
  if (wiki._meta?.failed_names) {
    lines.push('');
    lines.push('--- Wiki agent could not fetch (skip or hand-curate) ---');
    for (const n of wiki._meta.failed_names) lines.push(`  ${n}`);
  }
  fs.writeFileSync(REPORT_PATH, lines.join('\n'));

  console.log(`Final corpus: ${cocktails.length} cocktails (${cocktails.filter((c) => c.iba_official).length} IBA)`);
  console.log(`Report at ${REPORT_PATH}`);
}

main();
