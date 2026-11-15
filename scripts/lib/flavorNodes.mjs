// Node-side flavor nodes: Map name -> { taste, gnnProbs? } built from the curated taste labels
// (scripts/buildTasteLabels.mjs, computed fresh from the curation layer) and the model's per-ingredient
// values (public/proDataset/gnn_entropy.json; the aroma half still reads these).
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildTasteLabels } from '../buildTasteLabels.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');

export function loadFlavorNodes() {
  const labels = buildTasteLabels();
  const raw = JSON.parse(readFileSync(resolve(ROOT, 'public/proDataset/gnn_entropy.json'), 'utf8'));
  const nodes = new Map();
  for (const [name, taste] of Object.entries(labels)) nodes.set(name, { taste });
  for (const [name, info] of Object.entries(raw)) {
    if (name.startsWith('_') || !info?.probs) continue;
    nodes.set(name, { ...(nodes.get(name) || {}), gnnProbs: info.probs });
  }
  return nodes;
}
