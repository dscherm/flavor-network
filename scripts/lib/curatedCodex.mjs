// The cocktail codex as the app sees it: the generated file plus the checked-in corrections (DATA-6).
// Every script and test that needs the codex reads it here, never the raw JSON directly.
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { curateCodexRaw } from '../../src/data/cocktailCodexV2.js';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
export const CODEX_PATH = resolve(ROOT, 'public/data/cocktail_codex_v2.json');

export function readRawCodex() {
  return JSON.parse(readFileSync(CODEX_PATH, 'utf8'));
}

export function readCuratedCodex() {
  return curateCodexRaw(readRawCodex());
}
