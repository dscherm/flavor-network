#!/usr/bin/env node
/**
 * Cocktail Codex v2 — Phase 1, step 2: merge IBA Official Cocktails.
 *
 * The full IBA list (102 cocktails as of 2024 update — Unforgettables +
 * Contemporary Classics + New Era Drinks) is hardcoded below. We've
 * already captured 58 IBA-tagged cocktails from TheCocktailDB's strIBA
 * field. This script:
 *   1. Cross-references the full IBA list against our local corpus
 *   2. Marks every match as iba_official=true (overrides CDB's
 *      possibly-stale tags)
 *   3. Reports cocktails missing from our corpus (need external recipe
 *      acquisition in a later step)
 *
 * Inputs:
 *   proDataset/cocktails_v2/raw/local_ingested.json
 *   proDataset/cocktails_v2/raw/local_syrups.json (search for fallback)
 *
 * Outputs:
 *   proDataset/cocktails_v2/raw/iba_merged.json
 *   proDataset/cocktails_v2/raw/iba_missing.json   (need recipes)
 *   proDataset/cocktails_v2/raw/iba_merge_report.txt
 */

const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '../../..');
const IN_PATH = path.join(ROOT, 'proDataset/cocktails_v2/raw/local_ingested.json');
const OUT_DIR = path.join(ROOT, 'proDataset/cocktails_v2/raw');
const OUT_PATH = path.join(OUT_DIR, 'iba_merged.json');
const MISSING_PATH = path.join(OUT_DIR, 'iba_missing.json');
const REPORT_PATH = path.join(OUT_DIR, 'iba_merge_report.txt');

// IBA Official Cocktails — full 102-cocktail list (2024 update).
// Each entry: { name, category, base }
const IBA_LIST = [
  // Unforgettables (34)
  { name: 'Alexander', category: 'unforgettables', base: 'cognac' },
  { name: 'Americano', category: 'unforgettables', base: 'campari' },
  { name: 'Angel Face', category: 'unforgettables', base: 'gin' },
  { name: 'Aviation', category: 'unforgettables', base: 'gin' },
  { name: 'Between the Sheets', category: 'unforgettables', base: 'rum' },
  { name: 'Boulevardier', category: 'unforgettables', base: 'whiskey' },
  { name: 'Brandy Crusta', category: 'unforgettables', base: 'brandy' },
  { name: 'Casino', category: 'unforgettables', base: 'gin' },
  { name: 'Clover Club', category: 'unforgettables', base: 'gin' },
  { name: 'Daiquiri', category: 'unforgettables', base: 'rum' },
  { name: 'Dry Martini', category: 'unforgettables', base: 'gin' },
  { name: 'Gin Fizz', category: 'unforgettables', base: 'gin' },
  { name: 'Hanky Panky', category: 'unforgettables', base: 'gin' },
  { name: 'John Collins', category: 'unforgettables', base: 'gin' },
  { name: 'Last Word', category: 'unforgettables', base: 'gin' },
  { name: 'Manhattan', category: 'unforgettables', base: 'whiskey' },
  { name: 'Martinez', category: 'unforgettables', base: 'gin' },
  { name: 'Mary Pickford', category: 'unforgettables', base: 'rum' },
  { name: 'Monkey Gland', category: 'unforgettables', base: 'gin' },
  { name: 'Negroni', category: 'unforgettables', base: 'gin' },
  { name: 'Old Fashioned', category: 'unforgettables', base: 'whiskey' },
  { name: 'Paradise', category: 'unforgettables', base: 'gin' },
  { name: "Planter's Punch", category: 'unforgettables', base: 'rum' },
  { name: 'Porto Flip', category: 'unforgettables', base: 'brandy' },
  { name: 'Ramos Fizz', category: 'unforgettables', base: 'gin' },
  { name: 'Remember the Maine', category: 'unforgettables', base: 'whiskey' },
  { name: 'Rusty Nail', category: 'unforgettables', base: 'scotch' },
  { name: 'Sazerac', category: 'unforgettables', base: 'whiskey' },
  { name: 'Sidecar', category: 'unforgettables', base: 'cognac' },
  { name: 'Stinger', category: 'unforgettables', base: 'brandy' },
  { name: 'Tuxedo', category: 'unforgettables', base: 'gin' },
  { name: 'Vieux Carré', category: 'unforgettables', base: 'whiskey' },
  { name: 'Whiskey Sour', category: 'unforgettables', base: 'whiskey' },
  { name: 'White Lady', category: 'unforgettables', base: 'gin' },

  // Contemporary Classics (34)
  { name: 'Bellini', category: 'contemporary', base: 'prosecco' },
  { name: 'Black Russian', category: 'contemporary', base: 'vodka' },
  { name: 'Bloody Mary', category: 'contemporary', base: 'vodka' },
  { name: 'Caipirinha', category: 'contemporary', base: 'cachaca' },
  { name: 'Cardinale', category: 'contemporary', base: 'gin' },
  { name: 'Champagne Cocktail', category: 'contemporary', base: 'champagne' },
  { name: 'Corpse Reviver #2', category: 'contemporary', base: 'gin' },
  { name: 'Cosmopolitan', category: 'contemporary', base: 'vodka' },
  { name: 'Cuba Libre', category: 'contemporary', base: 'rum' },
  { name: 'French 75', category: 'contemporary', base: 'gin' },
  { name: 'French Connection', category: 'contemporary', base: 'cognac' },
  { name: 'Garibaldi', category: 'contemporary', base: 'campari' },
  { name: 'Grasshopper', category: 'contemporary', base: 'creme de menthe' },
  { name: 'Hemingway Special', category: 'contemporary', base: 'rum' },
  { name: "Horse's Neck", category: 'contemporary', base: 'brandy' },
  { name: 'Irish Coffee', category: 'contemporary', base: 'irish whiskey' },
  { name: 'Kir', category: 'contemporary', base: 'white wine' },
  { name: 'Lemon Drop Martini', category: 'contemporary', base: 'vodka' },
  { name: 'Long Island Iced Tea', category: 'contemporary', base: 'mixed' },
  { name: 'Mai Tai', category: 'contemporary', base: 'rum' },
  { name: 'Margarita', category: 'contemporary', base: 'tequila' },
  { name: 'Mimosa', category: 'contemporary', base: 'champagne' },
  { name: 'Mint Julep', category: 'contemporary', base: 'whiskey' },
  { name: 'Mojito', category: 'contemporary', base: 'rum' },
  { name: 'Moscow Mule', category: 'contemporary', base: 'vodka' },
  { name: 'Piña Colada', category: 'contemporary', base: 'rum' },
  { name: 'Pisco Sour', category: 'contemporary', base: 'pisco' },
  { name: 'Rabo de Galo', category: 'contemporary', base: 'cachaca' },
  { name: 'Sea Breeze', category: 'contemporary', base: 'vodka' },
  { name: 'Sex on the Beach', category: 'contemporary', base: 'vodka' },
  { name: 'Singapore Sling', category: 'contemporary', base: 'gin' },
  { name: 'Tequila Sunrise', category: 'contemporary', base: 'tequila' },
  { name: 'Vesper', category: 'contemporary', base: 'gin' },
  { name: 'Zombie', category: 'contemporary', base: 'rum' },

  // New Era Drinks (34)
  { name: "Bee's Knees", category: 'new_era', base: 'gin' },
  { name: 'Bramble', category: 'new_era', base: 'gin' },
  { name: 'Canchanchara', category: 'new_era', base: 'aguardiente' },
  { name: 'Chartreuse Swizzle', category: 'new_era', base: 'chartreuse' },
  { name: "Dark 'n' Stormy", category: 'new_era', base: 'rum' },
  { name: "Don's Special Daiquiri", category: 'new_era', base: 'rum' },
  { name: 'Espresso Martini', category: 'new_era', base: 'vodka' },
  { name: 'Fernandito', category: 'new_era', base: 'fernet' },
  { name: 'French Martini', category: 'new_era', base: 'vodka' },
  { name: 'Gin Basil Smash', category: 'new_era', base: 'gin' },
  { name: 'Grand Margarita', category: 'new_era', base: 'tequila' },
  { name: 'IBA Tiki', category: 'new_era', base: 'rum' },
  { name: 'Illegal', category: 'new_era', base: 'mezcal' },
  { name: 'Jungle Bird', category: 'new_era', base: 'rum' },
  { name: "Missionary's Downfall", category: 'new_era', base: 'rum' },
  { name: 'Naked and Famous', category: 'new_era', base: 'mezcal' },
  { name: 'New York Sour', category: 'new_era', base: 'whiskey' },
  { name: 'Old Cuban', category: 'new_era', base: 'rum' },
  { name: 'Paloma', category: 'new_era', base: 'tequila' },
  { name: 'Paper Plane', category: 'new_era', base: 'whiskey' },
  { name: 'Penicillin', category: 'new_era', base: 'scotch' },
  { name: 'Pisco Punch', category: 'new_era', base: 'pisco' },
  { name: 'Porn Star Martini', category: 'new_era', base: 'vodka' },
  { name: 'Russian Spring Punch', category: 'new_era', base: 'vodka' },
  { name: 'Sherry Cobbler', category: 'new_era', base: 'sherry' },
  { name: 'South Side', category: 'new_era', base: 'gin' },
  { name: 'Spicy Fifty', category: 'new_era', base: 'vodka' },
  { name: 'Spritz', category: 'new_era', base: 'prosecco' },
  { name: 'Suffering Bastard', category: 'new_era', base: 'mixed' },
  { name: 'Three Dots and a Dash', category: 'new_era', base: 'rum' },
  { name: 'Tipperary', category: 'new_era', base: 'irish whiskey' },
  { name: "Tommy's Margarita", category: 'new_era', base: 'tequila' },
  { name: 'Trinidad Sour', category: 'new_era', base: 'whiskey' },
  { name: 'Ve.n.to', category: 'new_era', base: 'grappa' },
];

function canonicalName(name) {
  return name
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

// Some IBA names need fuzzy match against our local data.
// These aliases let us catch CDB names like "Pina Colada" vs "Piña Colada".
const NAME_ALIASES = {
  'pina colada': 'piña colada',
  'cafe royale': 'cafe royal',
  'porn star martini': 'pornstar martini',
  'corpse reviver 2': 'corpse reviver #2',
  'corpse reviver no 2': 'corpse reviver #2',
  'corpse reviver': 'corpse reviver #2',
  'darknstormy': "dark 'n' stormy",
  'dark and stormy': "dark 'n' stormy",
  'dark n stormy': "dark 'n' stormy",
  'gin & tonic': 'gin and tonic',
};

function aliasedCanonical(name) {
  const cn = canonicalName(name);
  return NAME_ALIASES[cn] || cn;
}

function main() {
  const data = JSON.parse(fs.readFileSync(IN_PATH, 'utf-8'));
  const cocktails = data.cocktails;
  const byCanonical = new Map();
  for (const c of cocktails) byCanonical.set(c.name_canonical, c);

  const matched = [];
  const missing = [];
  let alreadyTagged = 0;
  let newlyTagged = 0;

  for (const iba of IBA_LIST) {
    const canonical = aliasedCanonical(iba.name);
    let match = byCanonical.get(canonical);
    // Fallback: try without diacritics / accents normalization
    if (!match) {
      const stripped = canonical.replace(/[À-ſ]/g, (c) => {
        const map = { 'á': 'a', 'é': 'e', 'í': 'i', 'ó': 'o', 'ú': 'u', 'ñ': 'n' };
        return map[c] || c;
      });
      for (const [k, v] of byCanonical) {
        if (k.replace(/[À-ſ]/g, '') === stripped) {
          match = v;
          break;
        }
      }
    }
    if (match) {
      const wasTagged = match.iba_official;
      match.iba_official = true;
      match.iba_category = iba.category;
      match.iba_base = iba.base;
      // Add 'iba' source if not already present
      if (!match.sources.includes('iba')) match.sources.push('iba');
      matched.push({ iba_name: iba.name, matched_name: match.name, was_tagged: wasTagged });
      if (wasTagged) alreadyTagged++;
      else newlyTagged++;
    } else {
      missing.push(iba);
    }
  }

  // Write outputs
  fs.writeFileSync(
    OUT_PATH,
    JSON.stringify(
      {
        _meta: {
          ...data._meta,
          generatedAt: new Date().toISOString(),
          script: '02-merge-iba.cjs',
          iba_total: IBA_LIST.length,
          iba_matched: matched.length,
          iba_already_tagged: alreadyTagged,
          iba_newly_tagged: newlyTagged,
          iba_missing: missing.length,
        },
        cocktails,
      },
      null,
      2,
    ),
  );

  fs.writeFileSync(
    MISSING_PATH,
    JSON.stringify(
      {
        _meta: {
          generatedAt: new Date().toISOString(),
          note: 'IBA Official Cocktails not present in local corpus. Need external recipe acquisition (PUNCH / Difford\'s / Wikipedia individual articles) before they can enter the clustering pipeline.',
          count: missing.length,
        },
        missing,
      },
      null,
      2,
    ),
  );

  // Report
  const lines = [];
  lines.push('Cocktail v2 Phase 1 — IBA merge report');
  lines.push(`Generated: ${new Date().toISOString()}`);
  lines.push('');
  lines.push(`IBA Official total:  ${IBA_LIST.length}`);
  lines.push(`Matched in local:    ${matched.length}`);
  lines.push(`  Already iba=true:  ${alreadyTagged}`);
  lines.push(`  Newly tagged:      ${newlyTagged}`);
  lines.push(`Missing from local:  ${missing.length}  (need external recipes)`);
  lines.push('');
  lines.push('--- Missing IBA cocktails ---');
  for (const m of missing) {
    lines.push(`  ${m.name.padEnd(28)} [${m.category.padEnd(15)}] base: ${m.base}`);
  }
  fs.writeFileSync(REPORT_PATH, lines.join('\n'));

  console.log(`IBA: ${matched.length}/${IBA_LIST.length} matched (${newlyTagged} newly tagged), ${missing.length} missing.`);
  console.log(`Report at ${REPORT_PATH}`);
}

main();
