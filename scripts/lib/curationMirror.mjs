// The curation tables (src/data/curation) are what the app applies on load. This module computes and
// checks their mirror in the pipeline's inputs (proDataset/data), so a future rebuild of the dataset
// agrees with the app. Pure: no file access here (scripts/syncCurationMirror.mjs and the drift test do the I/O).
//
//   aliases           -> proDataset/data/synonyms.json   (variant -> canonical, merged into the existing map)
//   everything else   -> proDataset/data/curation.json  (same entries as the tables, read by the blend steps)
//
// cocktailOverrides and sauceGroups are not mirrored: they correct generated codex data that the pipeline's
// ingredient steps never read, and sauce_augment.json (the sauce source) is hand-written, not rebuilt.

export const MIRRORED_TABLES = ['hidden', 'packaged', 'categoryOverrides', 'categoryRenames', 'tasteOverrides', 'additions', 'vocabulary'];

export const CURATION_JSON_COMMENT =
  'Mirror of src/data/curation/*.json for the pipeline (read by 01-parse-recipenlg.js, 05-blend.js, 07-blend-v2.js). '
  + 'Written by scripts/syncCurationMirror.mjs; do not edit by hand. A test fails when it drifts from the app tables.';

export function buildCurationMirror(tables) {
  const out = { _comment: CURATION_JSON_COMMENT };
  for (const name of MIRRORED_TABLES) out[name] = tables[name] || {};
  return out;
}

/**
 * Merge the alias table into the synonym map. Existing entries keep their place and value except where they
 * contradict the curation (the table wins, with the reason on its own line):
 *   1. every alias becomes a synonym (variant -> canonical), overriding an existing entry for the same variant;
 *   2. a canonical the curation relies on (an alias target or an added ingredient) that the map folds into
 *      something else is pinned to itself, so a rebuild keeps it as its own ingredient;
 *   3. an existing entry that points at a name the curation now aliases is re-pointed at that name's canonical
 *      (the pipeline resolves one hop, so chains are collapsed here).
 * Idempotent: mirrorSynonyms(mirrorSynonyms(x)) equals mirrorSynonyms(x).
 */
export function mirrorSynonyms(syn, tables) {
  const aliases = tables.aliases || {};
  const additions = tables.additions || {};
  const out = { ...syn };
  for (const [variant, { to }] of Object.entries(aliases)) out[variant] = to;
  const pinned = new Set([...Object.values(aliases).map((a) => a.to), ...Object.keys(additions)]);
  for (const name of pinned) {
    if (name in aliases) continue;
    if (name in out && out[name] !== name) out[name] = name;
  }
  for (const [k, v] of Object.entries(out)) {
    if (k.startsWith('_')) continue;
    if (v in aliases) out[k] = aliases[v].to;
  }
  return out;
}

/** What changed in the existing synonym entries (not the additions): [{ key, was, now }]. */
export function synonymRewrites(before, after) {
  const out = [];
  for (const [k, v] of Object.entries(before)) if (k in after && after[k] !== v) out.push({ key: k, was: v, now: after[k] });
  return out;
}

/** Problems found comparing the tables with their pipeline mirror; [] means no drift. */
export function mirrorDrift(tables, curationJson, synonyms) {
  const problems = [];
  const cj = curationJson || {};
  for (const name of MIRRORED_TABLES) {
    const want = JSON.stringify(tables[name] || {});
    const have = JSON.stringify(cj[name] || {});
    if (want !== have) problems.push(`curation.json "${name}" differs from src/data/curation/${name}.json`);
  }
  const syn = synonyms || {};
  for (const [variant, { to }] of Object.entries(tables.aliases || {})) {
    if (syn[variant] !== to) problems.push(`synonyms.json "${variant}" is ${JSON.stringify(syn[variant])}, the alias table says "${to}"`);
  }
  const want = mirrorSynonyms(syn, tables);
  for (const k of Object.keys(want)) {
    if (want[k] !== syn[k]) problems.push(`synonyms.json "${k}" should be ${JSON.stringify(want[k])} (was ${JSON.stringify(syn[k])}): a canonical the curation relies on is folded elsewhere, or an entry points at an alias`);
  }
  return problems;
}
