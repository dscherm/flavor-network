import fs from 'fs';
import path from 'path';
import { DATA_DIR } from './config.js';

/* ───────── synonym cache ───────── */
let _synonyms = null;

function loadSynonyms() {
  if (_synonyms) return _synonyms;
  try {
    const raw = fs.readFileSync(path.join(DATA_DIR, 'synonyms.json'), 'utf-8');
    _synonyms = JSON.parse(raw);
  } catch {
    _synonyms = {};
  }
  return _synonyms;
}

/* ───────── Ingredient canonicalization ───────── */

const QUANTITY_RE = /^\s*[\d¼½¾⅓⅔⅛⅜⅝⅞./\-–]+\s*/;
const UNIT_RE = /\b(cups?|tbsp|tsp|tablespoons?|teaspoons?|ounces?|oz|pounds?|lbs?|grams?|g|kg|ml|liters?|litres?|quarts?|pints?|gallons?|cloves?|slices?|pieces?|sticks?|cans?|bunche?s?|heads?|sprigs?|stalks?|pinche?s?|dashe?s?|drops?|handfuls?|packages?|containers?)\b/gi;
const ADJ_RE = /\b(fresh|dried|ground|chopped|diced|minced|sliced|crushed|grated|shredded|whole|large|medium|small|finely|thinly|coarsely|roughly|toasted|roasted|raw|frozen|canned|packed|sifted|melted|softened|chilled|cold|warm|hot|room temperature)\b/gi;
const PAREN_RE = /\(.*?\)/g;

export function canonicalizeIngredient(rawName) {
  if (!rawName) return '';
  const synonyms = loadSynonyms();

  let s = rawName.toLowerCase().trim();

  // strip parentheticals, quantities, units, adjectives
  s = s.replace(PAREN_RE, '');
  s = s.replace(QUANTITY_RE, '');
  s = s.replace(UNIT_RE, '');
  s = s.replace(ADJ_RE, '');
  s = s.replace(/[,;]/g, ' ');
  s = s.replace(/\s+/g, ' ').trim();

  // remove leading "of "
  s = s.replace(/^of\s+/, '');

  // exact synonym match first
  if (synonyms[s]) return synonyms[s];

  // simple singularize: trailing 's' (but not 'ss')
  if (s.length > 3 && s.endsWith('s') && !s.endsWith('ss')) {
    const singular = s.slice(0, -1);
    if (synonyms[singular]) return synonyms[singular];
    // also try the plural itself — it might already be canonical
  }

  // try synonym on singular form
  if (s.length > 3 && s.endsWith('s') && !s.endsWith('ss')) {
    const singular = s.slice(0, -1);
    return singular;
  }

  return s;
}

/* ───────── Pair key ───────── */

export function pairKey(a, b) {
  return a < b ? `${a}|${b}` : `${b}|${a}`;
}

/* ───────── PMI ───────── */

export function computePMI(pairCount, countA, countB, total) {
  if (!pairCount || !countA || !countB || !total) return 0;
  const pAB = pairCount / total;
  const pA = countA / total;
  const pB = countB / total;
  const pmi = Math.log2(pAB / (pA * pB));
  return Math.max(0, pmi); // clamp negatives
}

/* ───────── NPMI (Normalized PMI) ───────── */
// Returns value in [0, 1] where 1 = perfect co-occurrence, 0 = independent or worse
export function computeNPMI(pairCount, countA, countB, total) {
  if (!pairCount || !countA || !countB || !total) return 0;
  const pAB = pairCount / total;
  const pA = countA / total;
  const pB = countB / total;
  const pmi = Math.log2(pAB / (pA * pB));
  if (pmi <= 0) return 0;
  const npmi = pmi / (-Math.log2(pAB));
  return Math.max(0, Math.min(1, npmi));
}

/* ───────── Hybrid score: NPMI + log-count ───────── */
// Blends statistical surprise (NPMI) with raw co-occurrence frequency so that
// common, genuinely paired ingredients (eggplant+garlic) aren't penalized.
// logCountWeight controls the blend: 0 = pure NPMI, 1 = pure log-count.
export function computeHybridScore(pairCount, countA, countB, total, logCountWeight = 0.35) {
  const npmi = computeNPMI(pairCount, countA, countB, total);
  // log-count normalized: log2(count+1) / log2(maxReasonableCount)
  // Using log2(total) as the ceiling since no pair can exceed total
  const logCount = Math.log2(pairCount + 1) / Math.log2(total);
  return npmi * (1 - logCountWeight) + logCount * logCountWeight;
}

/* ───────── Normalize map values to [0,1] ───────── */

export function normalizeMap(map) {
  let min = Infinity;
  let max = -Infinity;
  for (const v of map.values()) {
    if (v < min) min = v;
    if (v > max) max = v;
  }
  const range = max - min || 1;
  const result = new Map();
  for (const [k, v] of map) {
    result.set(k, (v - min) / range);
  }
  return result;
}

/* ───────── Throttled fetch with retry ───────── */

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export async function throttledFetch(url, delayMs = 500) {
  const MAX_RETRIES = 3;
  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    await delay(delayMs);
    try {
      const res = await fetch(url);
      if (res.status === 429 || res.status === 503) {
        const backoff = delayMs * Math.pow(2, attempt + 1);
        log(`Rate limited (${res.status}), retrying in ${backoff}ms...`);
        await delay(backoff);
        continue;
      }
      return res;
    } catch (err) {
      if (attempt === MAX_RETRIES - 1) throw err;
      const backoff = delayMs * Math.pow(2, attempt + 1);
      log(`Fetch error: ${err.message}, retrying in ${backoff}ms...`);
      await delay(backoff);
    }
  }
  throw new Error(`Failed to fetch ${url} after ${MAX_RETRIES} attempts`);
}

/* ───────── FS helpers ───────── */

export function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

export function readJson(filePath) {
  try {
    const raw = fs.readFileSync(filePath, 'utf-8');
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function writeJson(filePath, data) {
  ensureDir(path.dirname(filePath));
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
}

/* ───────── Logging ───────── */

export function log(msg) {
  const ts = new Date().toISOString().slice(11, 19);
  console.log(`[${ts}] ${msg}`);
}
