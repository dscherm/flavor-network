// Node-side access to the curation layer (src/data/curation): reads the table JSON with fs (the
// browser bundle imports the same files), validates, and re-exports applyCuration.
import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { applyCuration } from '../../src/data/curation/applyCuration.js';
import { validateCuration, vocabulariesOf, TABLE_NAMES } from '../../src/data/curation/validateCuration.js';

const DIR = resolve(dirname(fileURLToPath(import.meta.url)), '../../src/data/curation');

export function loadCurationTables() {
  const out = {};
  for (const name of [...TABLE_NAMES, 'vocabulary']) {
    const p = resolve(DIR, `${name}.json`);
    out[name] = existsSync(p) ? JSON.parse(readFileSync(p, 'utf8')) : {};
  }
  return out;
}

/** Validate the tables against the raw ingredients (names and vocabularies come from the data). */
export function validateAgainst(tables, rawIngredients) {
  const names = new Set(Object.keys(rawIngredients).filter((k) => !k.startsWith('_')));
  return validateCuration(tables, { ingredientNames: names, ...vocabulariesOf(rawIngredients) });
}

export { applyCuration };
