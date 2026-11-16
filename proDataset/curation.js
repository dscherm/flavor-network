import fs from 'fs';
import path from 'path';
import { DATA_DIR } from './config.js';

// The pipeline's side of the app's curation tables (src/data/curation). data/curation.json is written by
// scripts/syncCurationMirror.mjs in the app repo root and a test there fails if it drifts from the tables.
// Aliases are not here: they are entries in data/synonyms.json and are applied by canonicalizeIngredient.

export function loadCuration(dataDir = DATA_DIR) {
  try {
    return JSON.parse(fs.readFileSync(path.join(dataDir, 'curation.json'), 'utf8'));
  } catch {
    return {};
  }
}

export function hiddenNames(curation) {
  return new Set(Object.keys(curation.hidden || {}));
}

/**
 * Apply the curation to a blended ingredient Map (name -> { sources, category, taste, totalCount }), in the
 * app's order: additions, hidden, packaged, category renames, category overrides, taste overrides.
 * Mutates the Map. Returns the set of names removed so the caller can drop their pairs.
 */
export function curateMaster(master, curation) {
  const additions = curation.additions || {};
  const renames = curation.categoryRenames || {};
  for (const [name, a] of Object.entries(additions)) {
    if (!master.has(name)) master.set(name, { sources: ['curation'], category: a.category, taste: a.taste, totalCount: 0 });
  }
  const removed = new Set();
  for (const name of Object.keys(curation.hidden || {})) {
    if (master.delete(name)) removed.add(name);
  }
  for (const name of Object.keys(curation.packaged || {})) {
    const info = master.get(name);
    if (info) info.packaged = true;
  }
  for (const info of master.values()) {
    const r = renames[info.category];
    if (r) info.category = r.to;
  }
  for (const [name, o] of Object.entries(curation.categoryOverrides || {})) {
    const info = master.get(name);
    if (info) info.category = o.category;
  }
  for (const [name, o] of Object.entries(curation.tasteOverrides || {})) {
    const info = master.get(name);
    if (info) info.taste = o.taste;
  }
  return removed;
}
