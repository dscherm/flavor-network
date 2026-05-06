const fs = require('node:fs');
const path = require('node:path');
const codex = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../../../public/data/cocktail_codex_v2.json'), 'utf-8'));

const lookup = new Map();
for (const c of codex.cocktails) lookup.set(c.canonical, c);

const NEAR = [
  ['negroni', 'boulevardier'],
  ['manhattan', 'rob roy'],   // accepted as different per user decision
  ['daiquiri', 'gimlet'],
  ['daiquiri', 'margarita'],
  ['whiskey sour', 'daiquiri'],
  ['old fashioned', 'sazerac'],
  ['martini', 'gibson'],
  ['martini', 'vesper'],
  ['aviation', 'bees knees'],
  ['mai tai', 'jungle bird'],
];
const FAR = [
  ['negroni', 'daiquiri'],
  ['old fashioned', 'daiquiri'],
  ['manhattan', 'margarita'],
  ['bloody mary', 'old fashioned'],
];

console.log('Validation harness on emitted cocktail_codex_v2.json:');
console.log();
console.log('Near pairs (should be SAME family):');
let nearHit = 0, nearTotal = 0;
for (const [a, b] of NEAR) {
  const ca = lookup.get(a);
  const cb = lookup.get(b);
  if (!ca || !cb) {
    console.log(`  ✗ MISSING ${a} or ${b}`);
    continue;
  }
  nearTotal++;
  const same = ca.family_id === cb.family_id;
  if (same) nearHit++;
  console.log(`  ${same ? '✓' : '○'} ${a} (C${ca.family_id}) ↔ ${b} (C${cb.family_id})`);
}
console.log();
console.log('Far pairs (should be DIFFERENT family):');
let farHit = 0, farTotal = 0;
for (const [a, b] of FAR) {
  const ca = lookup.get(a);
  const cb = lookup.get(b);
  if (!ca || !cb) {
    console.log(`  ✗ MISSING ${a} or ${b}`);
    continue;
  }
  farTotal++;
  const diff = ca.family_id !== cb.family_id;
  if (diff) farHit++;
  console.log(`  ${diff ? '✓' : '✗'} ${a} (C${ca.family_id}) ⊥ ${b} (C${cb.family_id})`);
}
console.log();
console.log(`Near: ${nearHit}/${nearTotal} (Manhattan↔Rob Roy expected ○ per user decision)`);
console.log(`Far:  ${farHit}/${farTotal}`);

console.log();
console.log('One-root-per-family check:');
const rootsPerFam = new Map();
for (const c of codex.cocktails) {
  if (c.is_root) {
    const arr = rootsPerFam.get(c.family_id) || [];
    arr.push(c.name);
    rootsPerFam.set(c.family_id, arr);
  }
}
for (let fid = 0; fid < 6; fid++) {
  const roots = rootsPerFam.get(fid) || [];
  console.log(`  C${fid}: ${roots.length === 1 ? '✓' : '✗'} (${roots.join(', ') || 'none'})`);
}
