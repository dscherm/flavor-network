// DATA-4. Writes the "before" behaviour fixture. Only run on the tree as it was BEFORE the category scheme
// change; the test src/data/__tests__/categoryScheme.test.js compares the live code with it.
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { computeSnapshot } from './lib/categoryHarness.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const out = resolve(ROOT, 'src/data/__tests__/fixtures/categoryBehaviour.before.json');
mkdirSync(dirname(out), { recursive: true });
const snap = await computeSnapshot();
writeFileSync(out, JSON.stringify(snap));
console.log(`wrote ${out}`);
for (const [k, v] of Object.entries(snap)) console.log(k.padEnd(20), Array.isArray(v) ? v.length : Object.keys(v).length);
