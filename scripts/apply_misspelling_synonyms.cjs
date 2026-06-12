'use strict';
// Map misspelled keys (potatoe/tomatoe variants) to their correct-spelling keys in synonyms.json.
// The misspelled keys remain in ingredients.json (no key rename), but lookups for the
// correct spelling will find the canonical misspelled key... wait — that's backwards.
// We want: searches for "baking potato" to also match "baking potatoe" (the actual key).
// So the synonym should be: "baking potato" → "baking potatoe" (correct spelling → misspelled key).
// But that's weird. Better: since the correctly-spelled version also EXISTS as a key,
// we should map the misspelled → correct (canonical = correct spelling).
// This way a user searching "baking potatoe" gets redirected to "baking potato".
// The misspelled key stays in the graph but lookups normalize it.

const fs = require('fs');
const synonyms = JSON.parse(fs.readFileSync('D:/Projects/flavor-network/proDataset/data/synonyms.json'));

// These are all cases where BOTH the misspelled and correct versions exist as keys.
// Map misspelled → correct so lookups hit the canonical key.
const misspelledToCanonical = [
  ['baking potatoe', 'baking potato'],
  ['italian tomatoe', 'italian tomato'],
  ['new potatoe', 'new potato'],
  ['red potatoe', 'red potato'],
  ['white potatoe', 'white potato'],
  ['green tomatoe', 'green tomato'],
  ['mashed sweet potatoe', 'mashed sweet potato'],
  ['tomatoe sauce', 'tomato sauce'],
  ['red tomatoe', 'red tomato'],
  ['tomatoe', 'tomato'],
  ['beefsteak tomatoe', 'beefsteak tomato'],
  ['instant mashed potatoe', 'instant mashed potato'],
  ['yellow tomatoe', 'yellow tomato'],
  ['gold potatoe', 'gold potato'],
];

let added = 0;
for (const [variant, canonical] of misspelledToCanonical) {
  if (!synonyms[variant]) {
    synonyms[variant] = canonical;
    console.log('ADD:', variant, '->', canonical);
    added++;
  } else {
    console.log('SKIP (exists):', variant, '->', synonyms[variant]);
  }
}

console.log('\nAdded:', added);
fs.writeFileSync('D:/Projects/flavor-network/proDataset/data/synonyms.json', JSON.stringify(synonyms, null, 2));
console.log('Written synonyms.json');
