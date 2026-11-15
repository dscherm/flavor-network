// Node-side flavor nodes: Map name -> { taste } built from the curated taste labels
// (scripts/buildTasteLabels.mjs, computed fresh from the curation layer). Aroma needs no node: it comes from
// the hand-tuned table in src/data/flavorAromas.js. The model's per-ingredient values are not read.
import { buildTasteLabels } from '../buildTasteLabels.mjs';

export function loadFlavorNodes() {
  const nodes = new Map();
  for (const [name, taste] of Object.entries(buildTasteLabels())) nodes.set(name, { taste });
  return nodes;
}
