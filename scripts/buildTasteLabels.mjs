// FLAVOR-3. Writes the small file of curated taste labels (name -> label) that pages and scripts load
// instead of the full ingredients.json, which is several MB. Same curation layer as the app applies on
// load, so a label here is the label the app shows. Runs in `prebuild`; the output is committed.
import { readFileSync, writeFileSync } from 'node:fs';
import { gzipSync } from 'node:zlib';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { loadCurationTables, applyCuration } from './lib/curationTables.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
export const OUT_PATH = resolve(ROOT, 'public/proDataset/taste_labels.json');

export function buildTasteLabels() {
  const raw = JSON.parse(readFileSync(resolve(ROOT, 'public/proDataset/ingredients.json'), 'utf8'));
  const cur = applyCuration(raw, null, loadCurationTables()).ingredients;
  const out = {};
  for (const name of Object.keys(cur).sort()) {
    if (name.startsWith('_') || !cur[name].taste) continue;
    out[name] = cur[name].taste;
  }
  return out;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const labels = buildTasteLabels();
  const text = `${JSON.stringify(labels)}\n`;
  writeFileSync(OUT_PATH, text);
  console.log(`taste labels: ${Object.keys(labels).length} ingredients, ${text.length} bytes raw, ${gzipSync(text).length} bytes gzipped -> ${OUT_PATH}`);
}
