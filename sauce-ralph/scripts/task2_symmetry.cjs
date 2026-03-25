/**
 * task2_symmetry.cjs — Fix caraway category typo and enforce pairing symmetry
 * in sauce_augment.json.
 *
 * For every pairing A->B, ensures B->A also exists at the same strength.
 * Fixes caraway category from "spice" to "Seasoning".
 */

const fs = require('fs');
const path = require('path');

const FILE = path.join(__dirname, '..', '..', 'public', 'data', 'sauce_augment.json');

const data = JSON.parse(fs.readFileSync(FILE, 'utf-8'));

// --- Fix caraway category typo ---
let typosFixed = 0;
for (const ing of data.ingredients || []) {
  if (ing.name.toLowerCase() === 'caraway' && ing.category === 'spice') {
    ing.category = 'Seasoning';
    typosFixed++;
  }
}

// --- Enforce pairing symmetry ---
const pairings = data.pairings || [];
const pairMap = new Map();

// Index existing pairings by "source|target" key
for (const p of pairings) {
  const key = `${p.source.toLowerCase()}|${p.target.toLowerCase()}`;
  pairMap.set(key, p.strength);
}

let asymmetricFixed = 0;

// Collect new pairings to add
const toAdd = [];
for (const p of pairings) {
  const src = p.source.toLowerCase();
  const tgt = p.target.toLowerCase();
  const reverseKey = `${tgt}|${src}`;

  if (!pairMap.has(reverseKey)) {
    // Reverse does not exist -- add it
    toAdd.push({ source: p.target, target: p.source, strength: p.strength });
    pairMap.set(reverseKey, p.strength);
    asymmetricFixed++;
  } else {
    // Reverse exists but may have different strength -- take max
    const reverseStrength = pairMap.get(reverseKey);
    if (reverseStrength !== p.strength) {
      const maxStrength = Math.max(reverseStrength, p.strength);
      // Update both directions to max
      p.strength = maxStrength;
      pairMap.set(reverseKey, maxStrength);
      // Find and update the reverse pairing in the array
      for (const rp of pairings) {
        if (rp.source.toLowerCase() === tgt && rp.target.toLowerCase() === src) {
          rp.strength = maxStrength;
          break;
        }
      }
      asymmetricFixed++;
    }
  }
}

// Append new reverse pairings
for (const p of toAdd) {
  pairings.push(p);
}

data.pairings = pairings;

// --- Write updated file ---
fs.writeFileSync(FILE, JSON.stringify(data, null, 2) + '\n', 'utf-8');

console.log('=== Sauce Augment Symmetry Fix ===');
console.log(`Typos fixed:           ${typosFixed}`);
console.log(`Asymmetric pairs fixed: ${asymmetricFixed}`);
console.log(`Total pairings after:   ${pairings.length}`);
