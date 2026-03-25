/**
 * task9_validate_augment.cjs
 * Automated validation for cocktail_augment.json
 *
 * Checks:
 *   a) No duplicate ingredient names
 *   b) No duplicate pairings (order-independent)
 *   c) No self-pairings
 *   d) All pairing refs exist in augment ingredients or main dataset
 *   e) All strengths between 0 (exclusive) and 1 (inclusive)
 *   f) Pairing symmetry: A->B implies B->A at same strength
 *   g) All ingredients have required fields: name, category, taste, weight, codexRole
 *   h) cocktailIngredientNames contains all ingredient names
 *
 * Exit code 0 = all pass, 1 = any fail.
 */

const fs = require('fs');
const path = require('path');

const AUGMENT_PATH = path.resolve(__dirname, '../../public/data/cocktail_augment.json');
const MAIN_INGREDIENTS_PATH = path.resolve(__dirname, '../../public/proDataset/ingredients.json');

// ── Load data ──────────────────────────────────────────────────────────────────

let augment, mainIngredients;

try {
  augment = JSON.parse(fs.readFileSync(AUGMENT_PATH, 'utf-8'));
} catch (err) {
  console.error(`FATAL: Cannot read ${AUGMENT_PATH}\n${err.message}`);
  process.exit(1);
}

try {
  mainIngredients = JSON.parse(fs.readFileSync(MAIN_INGREDIENTS_PATH, 'utf-8'));
} catch (err) {
  console.error(`FATAL: Cannot read ${MAIN_INGREDIENTS_PATH}\n${err.message}`);
  process.exit(1);
}

const { ingredients, pairings, cocktailIngredientNames } = augment;
const mainNames = new Set(Object.keys(mainIngredients).map(n => n.toLowerCase()));

const REQUIRED_FIELDS = ['name', 'category', 'taste', 'weight', 'codexRole'];

let allPassed = true;

function report(label, passed, details) {
  const status = passed ? 'PASS' : 'FAIL';
  console.log(`  [${status}] ${label}`);
  if (!passed) {
    allPassed = false;
    for (const d of details) {
      console.log(`         - ${d}`);
    }
  }
}

console.log('=== Cocktail Augment Validation ===\n');

// ── (a) No duplicate ingredient names ──────────────────────────────────────────

const nameCount = {};
for (const ing of ingredients) {
  const key = ing.name.toLowerCase();
  nameCount[key] = (nameCount[key] || 0) + 1;
}
const dupeNames = Object.entries(nameCount).filter(([, c]) => c > 1).map(([n, c]) => `"${n}" (x${c})`);
report('No duplicate ingredient names', dupeNames.length === 0, dupeNames);

// ── (b) No duplicate pairings (order-independent) ─────────────────────────────

const pairingKeys = {};
const dupePairings = [];
for (let i = 0; i < pairings.length; i++) {
  const p = pairings[i];
  const a = p.source.toLowerCase();
  const b = p.target.toLowerCase();
  const key = a < b ? `${a}|||${b}` : `${b}|||${a}`;
  if (pairingKeys[key]) {
    pairingKeys[key]++;
    if (pairingKeys[key] === 2) {
      // Only report the key once when we first detect a duplicate pair direction
      // But since symmetry is expected (A->B and B->A), we need to check for
      // actual duplicates: same ordered pair appearing more than once
    }
  } else {
    pairingKeys[key] = 1;
  }
}

// Actually, since symmetry means A->B and B->A both exist, we need to check
// for DIRECTED duplicates (same source+target appearing twice).
const directedKeys = {};
const directedDupes = [];
for (const p of pairings) {
  const key = `${p.source.toLowerCase()}|||${p.target.toLowerCase()}`;
  if (directedKeys[key]) {
    directedDupes.push(`${p.source} -> ${p.target}`);
  } else {
    directedKeys[key] = true;
  }
}
report('No duplicate pairings (same directed source->target)', directedDupes.length === 0, directedDupes);

// ── (c) No self-pairings ──────────────────────────────────────────────────────

const selfPairings = pairings.filter(p => p.source.toLowerCase() === p.target.toLowerCase())
  .map(p => `${p.source} -> ${p.target}`);
report('No self-pairings', selfPairings.length === 0, selfPairings);

// ── (d) All pairing refs exist in ingredient list OR main dataset ─────────────

const augmentNames = new Set(ingredients.map(i => i.name.toLowerCase()));
const allKnownNames = new Set([...augmentNames, ...mainNames]);

const missingRefs = [];
for (const p of pairings) {
  if (!allKnownNames.has(p.source.toLowerCase())) {
    missingRefs.push(`source "${p.source}" not found in any dataset`);
  }
  if (!allKnownNames.has(p.target.toLowerCase())) {
    missingRefs.push(`target "${p.target}" not found in any dataset`);
  }
}
const uniqueMissingRefs = [...new Set(missingRefs)];
report('All pairing refs exist in augment or main dataset', uniqueMissingRefs.length === 0, uniqueMissingRefs);

// ── (e) All strengths between 0 (exclusive) and 1 (inclusive) ─────────────────

const badStrengths = [];
for (const p of pairings) {
  if (typeof p.strength !== 'number' || p.strength <= 0 || p.strength > 1) {
    badStrengths.push(`${p.source} -> ${p.target}: strength=${p.strength}`);
  }
}
report('All strengths in (0, 1]', badStrengths.length === 0, badStrengths);

// ── (f) Pairing symmetry: A->B implies B->A at same strength ─────────────────

const pairingMap = {};
for (const p of pairings) {
  const key = `${p.source.toLowerCase()}|||${p.target.toLowerCase()}`;
  pairingMap[key] = p.strength;
}

const asymmetric = [];
for (const p of pairings) {
  const reverseKey = `${p.target.toLowerCase()}|||${p.source.toLowerCase()}`;
  const reverseStrength = pairingMap[reverseKey];
  if (reverseStrength === undefined) {
    asymmetric.push(`${p.source} -> ${p.target} exists but reverse is missing`);
  } else if (Math.abs(reverseStrength - p.strength) > 1e-9) {
    asymmetric.push(`${p.source} <-> ${p.target}: forward=${p.strength}, reverse=${reverseStrength}`);
  }
}
// Deduplicate (A->B missing reverse and B->A missing reverse are the same issue)
const seenAsym = new Set();
const dedupedAsym = asymmetric.filter(msg => {
  if (seenAsym.has(msg)) return false;
  seenAsym.add(msg);
  return true;
});
report('Pairing symmetry (A->B implies B->A at same strength)', dedupedAsym.length === 0, dedupedAsym);

// ── (g) All ingredients have required fields ──────────────────────────────────

const missingFields = [];
for (const ing of ingredients) {
  const missing = REQUIRED_FIELDS.filter(f => !ing[f] && ing[f] !== 0);
  if (missing.length > 0) {
    missingFields.push(`"${ing.name || '(unnamed)'}": missing [${missing.join(', ')}]`);
  }
}
report('All ingredients have required fields', missingFields.length === 0, missingFields);

// ── (h) cocktailIngredientNames contains all ingredient names ─────────────────

const cocktailNamesSet = new Set((cocktailIngredientNames || []).map(n => n.toLowerCase()));
const missingFromList = [];
for (const ing of ingredients) {
  if (!cocktailNamesSet.has(ing.name.toLowerCase())) {
    missingFromList.push(`"${ing.name}" in ingredients but not in cocktailIngredientNames`);
  }
}
report('cocktailIngredientNames contains all ingredient names', missingFromList.length === 0, missingFromList);

// ── Summary ────────────────────────────────────────────────────────────────────

console.log('\n--- Summary ---');
console.log(`  Total ingredients: ${ingredients.length}`);
console.log(`  Total pairings:    ${pairings.length}`);
console.log(`  cocktailIngredientNames count: ${(cocktailIngredientNames || []).length}`);
console.log(`  Main dataset ingredients:      ${mainNames.size}`);
console.log(`  Result: ${allPassed ? 'ALL CHECKS PASSED' : 'SOME CHECKS FAILED'}`);

process.exit(allPassed ? 0 : 1);
