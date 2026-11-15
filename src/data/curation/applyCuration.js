/**
 * applyCuration.js — the correction layer over the generated ingredient data.
 *
 * The generated files (public/proDataset/ingredients.json, pairings.json / pairings.bin) are build
 * products: editing them is overwritten by the next pipeline run. Corrections live in the checked-in
 * tables under src/data/curation/ and are applied here, every time the data is loaded.
 *
 * Pure and idempotent. Never throws on a table entry that names something absent: it goes in `report`.
 *
 *   applyCuration(ingredients, pairings, tables) -> { ingredients, pairings, report }
 *
 * `pairings` may be null (skip the pairing merge; used when the pairings were already merged at build
 * time). Order of operations: additions, aliases, hidden, packaged, category and taste overrides.
 *
 * Pairing merge rule when two records collapse onto one unordered pair:
 *   strength  the stronger of the two (also tradition / cooccurrence: the larger)
 *   known     true when either side is observed; the other fields then come from the observed record
 *             (from the stronger when both or neither are observed)
 *   count-like fields (count, totalCount, cooccurrenceCount) are summed
 *   self-pairs created by the merge (variant paired with its own canonical) are dropped
 */
const MAX_FIELDS = ['tradition', 'cooccurrence'];
const SUM_FIELDS = ['count', 'totalCount', 'cooccurrenceCount'];

const num = (v) => (typeof v === 'number' && !Number.isNaN(v) ? v : 0);
const pairKey = (a, b) => (a < b ? `${a}\u0000${b}` : `${b}\u0000${a}`);

function mergePair(x, y) {
  const strongest = num(x.strength) >= num(y.strength) ? x : y;
  const xk = x.known === true;
  const yk = y.known === true;
  const base = xk !== yk ? (xk ? x : y) : strongest;
  const out = { ...base };
  out.strength = Math.max(num(x.strength), num(y.strength));
  for (const f of MAX_FIELDS) {
    if (typeof x[f] === 'number' || typeof y[f] === 'number') out[f] = Math.max(num(x[f]), num(y[f]));
  }
  if (typeof x.known === 'boolean' || typeof y.known === 'boolean') out.known = xk || yk;
  for (const f of SUM_FIELDS) {
    if (typeof x[f] === 'number' || typeof y[f] === 'number') out[f] = num(x[f]) + num(y[f]);
  }
  return out;
}

/**
 * The ingredient order pairings.bin indexes into: the raw ingredients.json keys, then the names the
 * additions table adds (in table order). Builder and loader both go through here so they cannot drift.
 * Returns an object whose key order is that order (the decoder only reads the keys).
 */
export function binaryIndexObject(rawIngredients, additions = {}) {
  const out = { ...rawIngredients };
  for (const name of Object.keys(additions || {})) if (!(name in out)) out[name] = null;
  return out;
}

export function applyCuration(ingredients, pairings, tables = {}) {
  const t = {
    aliases: tables.aliases || {}, hidden: tables.hidden || {}, packaged: tables.packaged || {},
    categoryOverrides: tables.categoryOverrides || {}, tasteOverrides: tables.tasteOverrides || {},
    additions: tables.additions || {},
  };
  const report = {
    aliasesApplied: [], aliasesAbsent: [], aliasesMissingCanonical: [],
    hiddenApplied: [], hiddenAbsent: [],
    packagedApplied: [], packagedAbsent: [],
    categoryApplied: [], categoryAbsent: [], tasteApplied: [], tasteAbsent: [],
    additionsApplied: [], additionsExisting: [],
    pairingsIn: pairings ? pairings.length : 0, pairingsOut: 0, pairingsMerged: 0, pairingsDropped: 0,
  };

  const out = {};
  for (const [name, info] of Object.entries(ingredients || {})) out[name] = name.startsWith('_') ? info : { ...info };

  for (const [name, a] of Object.entries(t.additions)) {
    if (out[name]) { report.additionsExisting.push(name); continue; }
    out[name] = { category: a.category, taste: a.taste, sources: ['curation'], totalCount: 0 };
    report.additionsApplied.push(name);
  }

  const redirect = new Map();
  for (const [variant, { to }] of Object.entries(t.aliases)) {
    if (!out[variant]) { report.aliasesAbsent.push(variant); continue; }
    if (!out[to]) { report.aliasesMissingCanonical.push(variant); continue; }
    const v = out[variant];
    const c = out[to];
    c.totalCount = num(c.totalCount) + num(v.totalCount);
    c.sources = [...new Set([...(c.sources || []), ...(v.sources || [])])];
    delete out[variant];
    redirect.set(variant, to);
    report.aliasesApplied.push(variant);
  }

  const dead = new Set();
  for (const name of Object.keys(t.hidden)) {
    if (!out[name]) { report.hiddenAbsent.push(name); continue; }
    delete out[name];
    dead.add(name);
    report.hiddenApplied.push(name);
  }

  for (const name of Object.keys(t.packaged)) {
    if (!out[name]) { report.packagedAbsent.push(name); continue; }
    out[name].packaged = true;
    report.packagedApplied.push(name);
  }
  for (const [name, o] of Object.entries(t.categoryOverrides)) {
    if (!out[name]) { report.categoryAbsent.push(name); continue; }
    out[name].category = o.category;
    report.categoryApplied.push(name);
  }
  for (const [name, o] of Object.entries(t.tasteOverrides)) {
    if (!out[name]) { report.tasteAbsent.push(name); continue; }
    out[name].taste = o.taste;
    report.tasteApplied.push(name);
  }

  let outPairs = null;
  if (pairings) {
    outPairs = [];
    // Only records touching a merged name (as variant or as canonical target) can collide.
    const targets = new Set(redirect.values());
    const seen = new Map();
    for (const p of pairings) {
      let a = p.ingredientA;
      let b = p.ingredientB;
      if (dead.has(a) || dead.has(b)) { report.pairingsDropped++; continue; }
      const ra = redirect.get(a);
      const rb = redirect.get(b);
      if (ra === undefined && rb === undefined && !targets.has(a) && !targets.has(b)) { outPairs.push(p); continue; }
      if (ra !== undefined) a = ra;
      if (rb !== undefined) b = rb;
      if (a === b) { report.pairingsDropped++; continue; }
      const rec = ra === undefined && rb === undefined ? p : { ...p, ingredientA: a, ingredientB: b };
      const k = pairKey(a, b);
      const at = seen.get(k);
      if (at === undefined) { seen.set(k, outPairs.length); outPairs.push(rec); }
      else { outPairs[at] = mergePair(outPairs[at], rec); report.pairingsMerged++; }
    }
    report.pairingsOut = outPairs.length;
  }

  return { ingredients: out, pairings: outPairs, report };
}
