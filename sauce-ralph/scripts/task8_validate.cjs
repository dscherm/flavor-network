/**
 * task8_validate.cjs — Validate sauce_augment.json integrity.
 *
 * Checks:
 *   a) No duplicate ingredient names
 *   b) No duplicate pairings (order-independent)
 *   c) No self-pairings
 *   d) All pairing refs exist in ingredient list or main ProData dataset
 *   e) All strengths between 0 and 1
 *   f) Pairing symmetry: every A->B has B->A at same strength
 *   g) All ingredients have required fields: name, category, taste, weight, codexRole
 *   h) sauceIngredientNames contains all ingredient names
 *   i) All recipe ingredients can be resolved to an augment ingredient or main dataset ingredient
 *   j) All sauces have required fields: name, motherSauce, cuisine, ingredients, instructions, pairsWith
 *
 * Exit 0 if all pass, 1 if any fail.
 */

const path = require('path');
const fs = require('fs');

const AUGMENT_PATH = path.resolve(__dirname, '../../public/data/sauce_augment.json');
const PRODATA_PATH = path.resolve(__dirname, '../../public/proDataset/ingredients.json');

const augment = JSON.parse(fs.readFileSync(AUGMENT_PATH, 'utf-8'));
const proData = JSON.parse(fs.readFileSync(PRODATA_PATH, 'utf-8'));

const { ingredients, pairings, sauceIngredientNames, sauces } = augment;

const proNames = new Set(Object.keys(proData).map(n => n.toLowerCase()));
const augNames = new Set(ingredients.map(i => i.name.toLowerCase()));
const allKnown = new Set([...proNames, ...augNames]);

let allPass = true;

function check(label, fn) {
  const { pass, details } = fn();
  const status = pass ? 'PASS' : 'FAIL';
  console.log(`[${status}] ${label}`);
  if (!pass) {
    allPass = false;
    for (const d of details) {
      console.log(`       ${d}`);
    }
  }
}

// (a) No duplicate ingredient names
check('(a) No duplicate ingredient names', () => {
  const seen = new Set();
  const dupes = [];
  for (const ing of ingredients) {
    const key = ing.name.toLowerCase();
    if (seen.has(key)) dupes.push(key);
    seen.add(key);
  }
  return { pass: dupes.length === 0, details: dupes.map(d => `Duplicate: "${d}"`) };
});

// (b) No duplicate pairings (order-independent)
// Note: symmetric pairs (A->B and B->A) are expected and checked by (f).
// This check flags when the same ordered pair appears more than once,
// or more than 2 entries exist for the same unordered pair.
check('(b) No duplicate pairings (order-independent)', () => {
  // Check for exact duplicate directed pairs
  const directedSeen = new Set();
  const directedDupes = [];
  for (const p of pairings) {
    const key = `${p.source.toLowerCase()}|${p.target.toLowerCase()}`;
    if (directedSeen.has(key)) directedDupes.push(`${p.source} -> ${p.target}`);
    directedSeen.add(key);
  }
  // Check for more than 2 entries per unordered pair (would mean triple+ entries)
  const countMap = new Map();
  for (const p of pairings) {
    const a = p.source.toLowerCase();
    const b = p.target.toLowerCase();
    const key = a < b ? `${a}|${b}` : `${b}|${a}`;
    countMap.set(key, (countMap.get(key) || 0) + 1);
  }
  const triples = [];
  for (const [key, count] of countMap) {
    if (count > 2) triples.push(`${key} appears ${count} times (expected at most 2)`);
  }
  const all = [...directedDupes.map(d => `Exact duplicate: ${d}`), ...triples];
  return { pass: all.length === 0, details: all };
});

// (c) No self-pairings
check('(c) No self-pairings', () => {
  const selfPairs = pairings.filter(p => p.source.toLowerCase() === p.target.toLowerCase());
  return {
    pass: selfPairs.length === 0,
    details: selfPairs.map(p => `Self-pairing: "${p.source}"`)
  };
});

// (d) All pairing refs exist in ingredient list or main ProData dataset
check('(d) All pairing refs exist in augment or ProData', () => {
  const missing = [];
  for (const p of pairings) {
    if (!allKnown.has(p.source.toLowerCase())) missing.push(p.source);
    if (!allKnown.has(p.target.toLowerCase())) missing.push(p.target);
  }
  const unique = [...new Set(missing)];
  return { pass: unique.length === 0, details: unique.map(m => `Unknown ingredient in pairing: "${m}"`) };
});

// (e) All strengths between 0 and 1
check('(e) All strengths between 0 and 1', () => {
  const bad = [];
  for (const p of pairings) {
    if (typeof p.strength !== 'number' || p.strength < 0 || p.strength > 1) {
      bad.push(`${p.source} <-> ${p.target}: strength=${p.strength}`);
    }
  }
  return { pass: bad.length === 0, details: bad };
});

// (f) Pairing symmetry: every A->B has B->A at same strength
check('(f) Pairing symmetry (A->B has B->A at same strength)', () => {
  const map = new Map();
  for (const p of pairings) {
    const key = `${p.source.toLowerCase()}|${p.target.toLowerCase()}`;
    map.set(key, p.strength);
  }
  const asymmetric = [];
  for (const p of pairings) {
    const a = p.source.toLowerCase();
    const b = p.target.toLowerCase();
    const reverseKey = `${b}|${a}`;
    const reverseStrength = map.get(reverseKey);
    if (reverseStrength === undefined) {
      // Only report once (from whichever direction we encounter first)
      if (a < b) asymmetric.push(`Missing reverse: ${a} -> ${b} (${p.strength}) has no ${b} -> ${a}`);
    } else if (Math.abs(reverseStrength - p.strength) > 1e-9) {
      if (a < b) asymmetric.push(`Strength mismatch: ${a} <-> ${b}: ${p.strength} vs ${reverseStrength}`);
    }
  }
  return { pass: asymmetric.length === 0, details: asymmetric };
});

// (g) All ingredients have required fields
check('(g) All ingredients have required fields (name, category, taste, weight, codexRole)', () => {
  const required = ['name', 'category', 'taste', 'weight', 'codexRole'];
  const bad = [];
  for (const ing of ingredients) {
    const missing = required.filter(f => !ing[f] && ing[f] !== 0);
    if (missing.length > 0) {
      bad.push(`"${ing.name || '(unnamed)'}": missing ${missing.join(', ')}`);
    }
  }
  return { pass: bad.length === 0, details: bad };
});

// (h) sauceIngredientNames contains all ingredient names
check('(h) sauceIngredientNames contains all ingredient names', () => {
  const nameSet = new Set((sauceIngredientNames || []).map(n => n.toLowerCase()));
  const missing = [];
  for (const ing of ingredients) {
    if (!nameSet.has(ing.name.toLowerCase())) {
      missing.push(ing.name);
    }
  }
  return { pass: missing.length === 0, details: missing.map(m => `Missing from sauceIngredientNames: "${m}"`) };
});

// (i) All recipe ingredients can be resolved to augment or main dataset
check('(i) All recipe ingredients resolve to augment or ProData', () => {
  const modifiers = /^(fresh|dried|ground|whole|crushed|chopped|minced|sliced|diced|roasted|toasted|smoked|blanched|raw|unsalted|salted|dark|light|sweet|hot|mild|extra|pure|virgin|cold-pressed|clarified)\s+/i;
  const unresolved = [];

  for (const sauce of (sauces || [])) {
    for (const ing of (sauce.ingredients || [])) {
      const name = (typeof ing === 'string' ? ing : ing.name).toLowerCase().trim();
      if (allKnown.has(name)) continue;

      // Try stripping modifiers
      let stripped = name;
      let changed = true;
      while (changed) {
        const next = stripped.replace(modifiers, '');
        changed = next !== stripped;
        stripped = next;
      }
      if (allKnown.has(stripped)) continue;

      // Try substring match
      let found = false;
      for (const known of allKnown) {
        if (known.length >= 3 && name.includes(known)) { found = true; break; }
      }
      if (!found) {
        unresolved.push(`"${name}" in sauce "${sauce.name}"`);
      }
    }
  }

  const unique = [...new Set(unresolved)];
  return { pass: unique.length === 0, details: unique };
});

// (j) All sauces have required fields
check('(j) All sauces have required fields (name, motherSauce, cuisine, ingredients, instructions, pairsWith)', () => {
  const required = ['name', 'motherSauce', 'cuisine', 'ingredients', 'instructions', 'pairsWith'];
  const bad = [];
  for (const sauce of (sauces || [])) {
    const missing = required.filter(f => sauce[f] === undefined || sauce[f] === null);
    if (missing.length > 0) {
      bad.push(`"${sauce.name || '(unnamed)'}": missing ${missing.join(', ')}`);
    }
  }
  return { pass: bad.length === 0, details: bad };
});

// Summary
console.log('');
if (allPass) {
  console.log('All checks PASSED.');
  process.exit(0);
} else {
  console.log('Some checks FAILED.');
  process.exit(1);
}
