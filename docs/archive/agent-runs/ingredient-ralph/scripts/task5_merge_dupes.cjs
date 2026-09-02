/**
 * task5_merge_dupes.cjs
 *
 * Merges near-duplicate ingredient entries in ingredients.json and updates
 * pairings.json accordingly. Handles both a hardcoded list of known merge
 * groups and auto-detected duplicates (by normalizing away hyphens/spaces).
 */

const fs = require('fs');
const path = require('path');

const INGREDIENTS_PATH = path.resolve(__dirname, '../../public/proDataset/ingredients.json');
const PAIRINGS_PATH = path.resolve(__dirname, '../../public/proDataset/pairings.json');

// Known merge groups: canonical -> aliases
const KNOWN_MERGES = {
  'cornstarch': ['corn starch'],
  'cornmeal': ['corn meal'],
  'cornbread': ['corn bread'],
  'lemongrass': ['lemon grass'],
  'eggplant': ['egg plant'],
  'flaxseed': ['flax seed'],
  'chickpea': ['chick pea', 'chick-pea'],
  'semisweet chocolate chip': ['semi-sweet chocolate chip', 'semi sweet chocolate chip'],
  'strawberry jello': ['strawberry jell-o'],
  'lemon jello': ['lemon jell-o'],
  'lime jello': ['lime jell-o'],
  'orange jello': ['orange jell-o'],
  'cherry jello': ['cherry jell-o'],
  'raspberry jello': ['raspberry jell-o'],
  'italian seasoned bread crumb': [
    'italian-seasoned breadcrumb',
    'italian-seasoned bread crumb',
    'italian seasoned breadcrumb'
  ],
};

function normalize(name) {
  return name.replace(/[-\s]/g, '').toLowerCase();
}

function main() {
  console.log('Reading ingredients.json...');
  const ingredients = JSON.parse(fs.readFileSync(INGREDIENTS_PATH, 'utf-8'));
  console.log('Reading pairings.json...');
  const pairings = JSON.parse(fs.readFileSync(PAIRINGS_PATH, 'utf-8'));

  const allNames = Object.keys(ingredients);
  console.log(`Loaded ${allNames.length} ingredients, ${pairings.length} pairings.\n`);

  // Build alias -> canonical map from known merges
  const aliasToCanonical = new Map();

  for (const [canonical, aliases] of Object.entries(KNOWN_MERGES)) {
    for (const alias of aliases) {
      aliasToCanonical.set(alias, canonical);
    }
  }

  // Auto-detect additional duplicates by normalized form
  // Group all ingredient names by their normalized form
  const normGroups = new Map(); // normalized -> [name, ...]
  for (const name of allNames) {
    const norm = normalize(name);
    if (!normGroups.has(norm)) {
      normGroups.set(norm, []);
    }
    normGroups.get(norm).push(name);
  }

  // For groups with 2+ members, pick canonical (highest totalCount) and add aliases
  let autoDetectedCount = 0;
  for (const [norm, members] of normGroups) {
    if (members.length < 2) continue;

    // Check if any member is already handled by known merges
    // We still process the group but respect known canonical choices
    const knownCanonical = members.find(m => KNOWN_MERGES[m]);
    const knownAliases = new Set();
    for (const m of members) {
      if (aliasToCanonical.has(m)) knownAliases.add(m);
    }

    if (knownCanonical && members.length === knownAliases.size + 1) {
      // Fully covered by known merges already
      continue;
    }

    // Pick canonical: if one is in KNOWN_MERGES keys, use that; otherwise highest totalCount
    let canonical;
    if (knownCanonical) {
      canonical = knownCanonical;
    } else {
      canonical = members.reduce((best, m) => {
        const countM = (ingredients[m] && ingredients[m].totalCount) || 0;
        const countBest = (ingredients[best] && ingredients[best].totalCount) || 0;
        return countM > countBest ? m : best;
      });
    }

    for (const m of members) {
      if (m === canonical) continue;
      if (!aliasToCanonical.has(m)) {
        aliasToCanonical.set(m, canonical);
        autoDetectedCount++;
      }
    }
  }

  // Build a summary of merge groups: canonical -> [aliases]
  const mergeGroups = new Map();
  for (const [alias, canonical] of aliasToCanonical) {
    // Only count if both exist in ingredients
    if (!ingredients[alias] && !ingredients[canonical]) continue;
    if (!mergeGroups.has(canonical)) {
      mergeGroups.set(canonical, []);
    }
    mergeGroups.get(canonical).push(alias);
  }

  // Filter to only groups where at least one alias actually exists in the data
  const activeMerges = new Map();
  for (const [canonical, aliases] of mergeGroups) {
    const existingAliases = aliases.filter(a => ingredients[a]);
    if (existingAliases.length > 0) {
      activeMerges.set(canonical, existingAliases);
    }
  }

  console.log(`Found ${activeMerges.size} merge groups (${autoDetectedCount} auto-detected aliases).`);
  console.log('');

  // Step 4a: Merge ingredient entries
  let totalAliasesRemoved = 0;
  const mergeLog = [];

  for (const [canonical, aliases] of activeMerges) {
    // Ensure canonical exists in ingredients; if not, create from first alias
    if (!ingredients[canonical]) {
      const firstAlias = aliases[0];
      ingredients[canonical] = { ...ingredients[firstAlias] };
    }

    const canonEntry = ingredients[canonical];

    for (const alias of aliases) {
      const aliasEntry = ingredients[alias];
      if (!aliasEntry) continue;

      // Sum totalCount
      canonEntry.totalCount = (canonEntry.totalCount || 0) + (aliasEntry.totalCount || 0);

      // Keep higher bridgingScore
      if ((aliasEntry.bridgingScore || 0) > (canonEntry.bridgingScore || 0)) {
        canonEntry.bridgingScore = aliasEntry.bridgingScore;
      }

      // Remove alias entry
      delete ingredients[alias];
      totalAliasesRemoved++;
      mergeLog.push(`  "${alias}" -> "${canonical}"`);
    }
  }

  // Step 4b: Rename alias references in pairings
  // Build a fast lookup from the aliasToCanonical map (only aliases that existed)
  const renameMap = new Map();
  for (const [canonical, aliases] of activeMerges) {
    for (const alias of aliases) {
      renameMap.set(alias, canonical);
    }
  }

  let renameCount = 0;
  for (const p of pairings) {
    if (renameMap.has(p.ingredientA)) {
      p.ingredientA = renameMap.get(p.ingredientA);
      renameCount++;
    }
    if (renameMap.has(p.ingredientB)) {
      p.ingredientB = renameMap.get(p.ingredientB);
      renameCount++;
    }
  }

  // Step 4c: Remove self-pairings and dedup
  let selfPairingsRemoved = 0;
  let pairingsDedupedCount = 0;

  // Filter out self-pairings first
  const nonSelfPairings = pairings.filter(p => {
    if (p.ingredientA === p.ingredientB) {
      selfPairingsRemoved++;
      return false;
    }
    return true;
  });

  // Dedup: for same A+B pair (order-independent), keep highest strength
  const pairingMap = new Map();
  for (const p of nonSelfPairings) {
    // Normalize key ordering so A-B and B-A are the same
    const key = [p.ingredientA, p.ingredientB].sort().join('|||');
    if (pairingMap.has(key)) {
      pairingsDedupedCount++;
      const existing = pairingMap.get(key);
      if (p.strength > existing.strength) {
        pairingMap.set(key, p);
      }
    } else {
      pairingMap.set(key, p);
    }
  }

  const dedupedPairings = Array.from(pairingMap.values());

  // Step 5: Write output
  console.log('Writing updated ingredients.json...');
  fs.writeFileSync(INGREDIENTS_PATH, JSON.stringify(ingredients, null, 2), 'utf-8');

  console.log('Writing updated pairings.json...');
  fs.writeFileSync(PAIRINGS_PATH, JSON.stringify(dedupedPairings, null, 2), 'utf-8');

  // Step 6: Summary
  const finalIngredientCount = Object.keys(ingredients).length;
  const finalPairingCount = dedupedPairings.length;

  console.log('\n=== MERGE SUMMARY ===');
  console.log(`Merge groups processed: ${activeMerges.size}`);
  console.log(`Total aliases removed: ${totalAliasesRemoved}`);
  console.log(`Pairing references renamed: ${renameCount}`);
  console.log(`Self-pairings removed: ${selfPairingsRemoved}`);
  console.log(`Duplicate pairings merged: ${pairingsDedupedCount}`);
  console.log(`Final ingredients: ${finalIngredientCount}`);
  console.log(`Final pairings: ${finalPairingCount}`);
  console.log('\nAll merges applied:');
  for (const line of mergeLog) {
    console.log(line);
  }
}

main();
