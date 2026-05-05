#!/usr/bin/env node
/**
 * Cocktail Codex v2 — Phase 1, step 4: hand-add canonical classics
 * not found in IBA / TheCocktailDB / Cocktail Codex.
 *
 * Two cocktails the validation harness (§7.1 of spec) requires that
 * weren't in any of our prior sources:
 *   - Rob Roy (Scotch Manhattan variant — wikipedia)
 *   - Gibson (Martini variant with onion garnish — wikipedia)
 *
 * Recipes pulled directly from Wikipedia by hand-fetch, normalized to
 * our schema. This script also normalizes curly apostrophes in
 * existing canonical names so harness queries like "bee's knees"
 * match "bee’s knees" entries.
 *
 * Inputs:
 *   proDataset/cocktails_v2/raw/corpus_v1.json
 *
 * Outputs:
 *   proDataset/cocktails_v2/raw/corpus_v2.json   (Phase 1 final)
 */

const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '../../..');
const IN_PATH = path.join(ROOT, 'proDataset/cocktails_v2/raw/corpus_v1.json');
const OUT_PATH = path.join(ROOT, 'proDataset/cocktails_v2/raw/corpus_v2.json');

function canonicalName(name) {
  return name
    .toLowerCase()
    .replace(/[‘’'`]/g, '') // strip ALL apostrophe variants
    .replace(/[^\w\s-]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

const ADDITIONS = [
  {
    name: 'Rob Roy',
    sources: ['wikipedia'],
    iba_official: false,
    iba_category: null,
    ingredients_raw: [
      { raw: '4.5 cl Scotch whisky', name: 'scotch whisky', amount_ml: 45, measure: '4.5 cl' },
      { raw: '2.5 cl sweet vermouth', name: 'sweet vermouth', amount_ml: 25, measure: '2.5 cl' },
      { raw: 'dash Angostura bitters', name: 'angostura bitters', amount_ml: 0.92, measure: 'dash' },
    ],
    recipe_text: 'Stir over ice, strain into chilled glass.',
    glass: 'cocktail glass',
    garnishes: ['maraschino cherry'],
    build_method: 'stir',
  },
  {
    name: 'Gibson',
    sources: ['wikipedia'],
    iba_official: false,
    iba_category: null,
    ingredients_raw: [
      { raw: '60 ml gin', name: 'gin', amount_ml: 60, measure: '60 ml' },
      { raw: '10 ml dry vermouth', name: 'dry vermouth', amount_ml: 10, measure: '10 ml' },
    ],
    recipe_text: 'Stir well with ice, strain into a chilled cocktail glass.',
    glass: 'cocktail glass',
    garnishes: ['cocktail onion'],
    build_method: 'stir',
  },
];

function main() {
  const data = JSON.parse(fs.readFileSync(IN_PATH, 'utf-8'));
  const cocktails = data.cocktails;

  // Re-canonicalize every entry with the upgraded normalization (strips
  // curly apostrophes too — was missing before, caused "Bee's Knees"
  // lookups to fail against "Bee’s Knees" stored entries).
  for (const c of cocktails) {
    const newCanon = canonicalName(c.name);
    if (newCanon !== c.name_canonical) c.name_canonical = newCanon;
  }

  const byCanonical = new Map();
  for (const c of cocktails) byCanonical.set(c.name_canonical, c);

  let added = 0;
  for (const addition of ADDITIONS) {
    const newEntry = {
      ...addition,
      name_canonical: canonicalName(addition.name),
      thecocktaildb_id: null,
      cocktail_codex_family_id: null,
      cocktail_codex_subcluster_id: null,
      is_codex_root: false,
    };
    if (byCanonical.has(newEntry.name_canonical)) {
      // Enrich existing instead
      const existing = byCanonical.get(newEntry.name_canonical);
      if ((!existing.ingredients_raw || existing.ingredients_raw.length === 0)) {
        existing.ingredients_raw = newEntry.ingredients_raw;
      }
      if (!existing.build_method) existing.build_method = newEntry.build_method;
      continue;
    }
    cocktails.push(newEntry);
    byCanonical.set(newEntry.name_canonical, newEntry);
    added++;
  }

  fs.writeFileSync(
    OUT_PATH,
    JSON.stringify(
      {
        _meta: {
          generatedAt: new Date().toISOString(),
          script: '04-add-missing-classics.cjs',
          input_count: data.cocktails.length,
          added: added,
          final_count: cocktails.length,
          iba_official_count: cocktails.filter((c) => c.iba_official).length,
          phase: 'Phase 1 final corpus',
        },
        cocktails,
      },
      null,
      2,
    ),
  );

  console.log(`Final Phase 1 corpus: ${cocktails.length} cocktails (added ${added})`);
}

main();
