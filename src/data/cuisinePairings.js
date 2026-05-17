/**
 * cuisinePairings.js — lookups + utilities for the cuisine_pairings.json
 * artifact (Stage 1 of the cuisine-pairings ingestion).
 *
 * Shape of a record (see proDataset/scripts/14-build-cuisine-pairings.js):
 *   {
 *     evidence: [{ cuisine, count, recipePct }],
 *     primary: <cuisine>,
 *     novelty: 0..1 (1 = not in chemistry model),
 *     modelStrength: 0..1 | null,
 *   }
 *
 * All lookups normalize the pair key as `lower(a) < lower(b) ? a|b : b|a`
 * so callers don't have to think about ordering.
 */

import { CATEGORICAL_AXES } from './categoricalAxes.js';

// pairKey is the same convention used in the build script + pairings.json.
export function pairKey(a, b) {
  const la = String(a).toLowerCase().trim();
  const lb = String(b).toLowerCase().trim();
  return la < lb ? `${la}|${lb}` : `${lb}|${la}`;
}

/**
 * Look up a cuisine-anchored record for an ingredient pair.
 * @param {Map} lookup - data.cuisinePairLookup from useProData
 * @returns {object|null}
 */
export function getCuisinePair(lookup, a, b) {
  if (!lookup) return null;
  return lookup.get(pairKey(a, b)) || null;
}

/**
 * Should a cuisine badge be shown for this pair? Returns truthy when the
 * primary cuisine signal dominates the secondary one by a clear margin —
 * otherwise the pair is multi-cuisine and the chip would over-claim.
 *
 * @param record cuisine-pair record
 * @returns the primary cuisine string when displayable, else null
 */
export function displayableCuisine(record) {
  if (!record) return null;
  const ev = record.evidence;
  if (!Array.isArray(ev) || ev.length === 0) return null;
  const primary = ev[0];
  if (primary.count < 5) return null;
  if (ev.length === 1) return primary.cuisine;
  const secondary = ev[1];
  // Primary must be >= 1.5× the secondary recipe%-share to count as
  // dominant. Below that threshold the pair is multi-cuisine and we
  // hide the chip to avoid over-claiming one origin.
  if (primary.recipePct >= 1.5 * secondary.recipePct) return primary.cuisine;
  return null;
}

/**
 * Compute the cuisine-anchor "boost score" used by the affinity-tier
 * promoter (Stage 4). Higher = stronger reason to promote into the
 * Surprising tier. Combines:
 *   - recipePct in primary cuisine (credibility),
 *   - novelty (how much the chemistry model missed the pair),
 *   - log(count) (raw evidence weight, dampened).
 *
 * Returns 0 when the record is missing or fails the displayable gate.
 */
export function cuisineBoost(record) {
  if (!record) return 0;
  const cui = displayableCuisine(record);
  if (!cui) return 0;
  const primary = record.evidence[0];
  const credibility = Math.min(1, primary.recipePct * 4);   // saturate at 25%
  const evidence = Math.min(1, Math.log10(primary.count + 1) / 3);   // 1000 → 1.0
  const novelty = record.novelty;
  return credibility * 0.5 + evidence * 0.3 + novelty * 0.2;
}

// Cuisine color palette — maps the CulinaryDB cuisine names used in
// the build script to the existing CATEGORICAL_AXES.cuisine bucket
// labels so the chip color matches the wheel's bucket color.
const CUISINE_TO_BUCKET = {
  'Italy': 'European',
  'France': 'European',
  'Spain': 'European',
  'Greece': 'European',
  'British Isles': 'European',
  'DACH Countries': 'European',
  'Eastern Europe': 'European',
  'Scandinavia': 'European',
  'USA': 'Americas',
  'Canada': 'Americas',
  'Mexico': 'Americas',
  'Caribbean': 'Americas',
  'South America': 'Americas',
  'Indian Subcontinent': 'South Asian',
  'China': 'East Asian',
  'Japan': 'East Asian',
  'Korea': 'East Asian',
  'Thailand': 'SE Asian',
  'South East Asia': 'SE Asian',
  'Middle East': 'Middle Eastern',
  'Africa': 'African',
  'Australia & NZ': 'Global',
};

const cuisineAxis = CATEGORICAL_AXES.cuisine;
const BUCKET_COLOR = {};
for (let i = 0; i < cuisineAxis.labels.length; i++) {
  BUCKET_COLOR[cuisineAxis.labels[i]] = cuisineAxis.colors[i];
}

export function cuisineColor(cuisine) {
  const bucket = CUISINE_TO_BUCKET[cuisine];
  if (bucket && BUCKET_COLOR[bucket]) return BUCKET_COLOR[bucket];
  return '#94a3b8';
}

/**
 * Build a per-ingredient inverted index of cuisine-anchored neighbors.
 * Single-source-of-truth helper: every downstream consumer that wants
 * cuisine pairs alongside chemistry pairs goes through this index
 * (via `getNeighborsEnriched` in graph.js) rather than scanning the
 * raw lookup themselves.
 *
 * Only pairs that pass the `displayableCuisine` dominance gate are
 * included — multi-cuisine pairs would over-claim a single origin.
 *
 * @param {Map<string, object>} cuisinePairLookup   pairKey → record
 * @param {Iterable<string>} knownIngredients       set of ingredients
 *   present in the chemistry graph (used to filter out cuisine pairs
 *   that reference an ingredient we don't render)
 * @returns {Map<string, Array<{name: string, cuisineStrength: number,
 *   cuisineAnchor: {cuisine: string, record: object}}>>}
 */
export function buildCuisineNeighborIndex(cuisinePairLookup, knownIngredients) {
  const index = new Map();
  if (!cuisinePairLookup || cuisinePairLookup.size === 0) return index;
  const known = knownIngredients instanceof Set
    ? knownIngredients
    : new Set(knownIngredients);

  for (const [key, record] of cuisinePairLookup) {
    const cui = displayableCuisine(record);
    if (!cui) continue;
    const sep = key.indexOf('|');
    if (sep < 0) continue;
    const a = key.slice(0, sep);
    const b = key.slice(sep + 1);
    if (!known.has(a) || !known.has(b)) continue;
    const strength = cuisineBoost(record);
    if (strength <= 0) continue;
    const anchor = { cuisine: cui, record };
    if (!index.has(a)) index.set(a, []);
    if (!index.has(b)) index.set(b, []);
    index.get(a).push({ name: b, cuisineStrength: strength, cuisineAnchor: anchor });
    index.get(b).push({ name: a, cuisineStrength: strength, cuisineAnchor: anchor });
  }

  for (const list of index.values()) {
    list.sort((x, y) => y.cuisineStrength - x.cuisineStrength);
  }
  return index;
}
