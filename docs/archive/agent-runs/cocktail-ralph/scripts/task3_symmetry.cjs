/**
 * task3_symmetry.cjs
 * Enforces pairing symmetry in cocktail_augment.json.
 * For every {source, target, strength}, ensures {target, source} exists too.
 * If both directions exist with different strengths, keeps the higher value for both.
 */
const fs = require('fs');
const path = require('path');

const AUGMENT_PATH = path.resolve(__dirname, '../../public/data/cocktail_augment.json');

const data = JSON.parse(fs.readFileSync(AUGMENT_PATH, 'utf8'));

// Build a map: "a|b" -> index in pairings array (using sorted key for canonical form)
// We need to track both directions independently first
const pairingMap = new Map(); // "source|target" -> { index, strength }

for (let i = 0; i < data.pairings.length; i++) {
  const p = data.pairings[i];
  const key = `${p.source.toLowerCase()}|${p.target.toLowerCase()}`;
  pairingMap.set(key, { index: i, strength: p.strength });
}

let asymmetricFixed = 0;

// Pass 1: Harmonize strengths where both directions exist but differ
const processed = new Set();
for (const p of data.pairings) {
  const fwd = `${p.source.toLowerCase()}|${p.target.toLowerCase()}`;
  const rev = `${p.target.toLowerCase()}|${p.source.toLowerCase()}`;

  if (processed.has(fwd) || processed.has(rev)) continue;
  processed.add(fwd);
  processed.add(rev);

  const fwdEntry = pairingMap.get(fwd);
  const revEntry = pairingMap.get(rev);

  if (fwdEntry && revEntry) {
    // Both exist -- harmonize to higher strength
    if (fwdEntry.strength !== revEntry.strength) {
      const maxStrength = Math.max(fwdEntry.strength, revEntry.strength);
      data.pairings[fwdEntry.index].strength = maxStrength;
      data.pairings[revEntry.index].strength = maxStrength;
      asymmetricFixed++;
    }
  }
}

// Pass 2: Add missing reverse pairings
const newPairings = [];
const existingKeys = new Set(
  data.pairings.map(p => `${p.source.toLowerCase()}|${p.target.toLowerCase()}`)
);

for (const p of data.pairings) {
  const rev = `${p.target.toLowerCase()}|${p.source.toLowerCase()}`;
  if (!existingKeys.has(rev)) {
    newPairings.push({
      source: p.target.toLowerCase(),
      target: p.source.toLowerCase(),
      strength: p.strength
    });
    existingKeys.add(rev);
    asymmetricFixed++;
  }
}

data.pairings.push(...newPairings);

// Write back
fs.writeFileSync(AUGMENT_PATH, JSON.stringify(data, null, 2), 'utf8');

console.log(`Asymmetric pairs fixed: ${asymmetricFixed}`);
console.log(`  - Strength harmonized (both existed): ${asymmetricFixed - newPairings.length}`);
console.log(`  - Reverse pairings added: ${newPairings.length}`);
console.log(`Total pairings after: ${data.pairings.length}`);
