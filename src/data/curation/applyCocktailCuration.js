/**
 * applyCocktailCuration.js — the correction layer over the generated cocktail codex (DATA-6).
 *
 * public/data/cocktail_codex_v2.json comes from proDataset/cocktails_v2/scripts/09-emit-codex-v2.cjs (a K-Means run over a
 * gitignored corpus). It is not edited; corrections live in src/data/curation/cocktailOverrides.json and are applied here, on
 * every load. Pure and idempotent: applying the result again changes nothing.
 *
 *   applyCocktailCuration(raw, table) -> curated copy of raw ({ _meta, families, subclusters, cocktails })
 *
 * Order: dedupe (exact duplicate rows), remove, fixes (line lists), moves, additions, new families, sub-group names, roots, counts.
 * A payload without cocktails/families (a test stub) comes back unchanged.
 */
const norm = (s) => String(s ?? '').trim().toLowerCase();

function rawText(l) { return typeof l === 'string' ? l : (l?.raw ?? l?.name ?? ''); }

/** New recipe_text: the new ingredient lines, then whatever of the old text was not an ingredient line (garnish, prose). */
function rewriteText(oldText, oldLines, newLines) {
  const old = new Set(oldLines.map((l) => rawText(l).trim()));
  const rest = String(oldText || '').split('\n').filter((l) => l.trim() && !old.has(l.trim()));
  return [...newLines.map((l) => rawText(l)), ...rest].join('\n');
}

export function applyCocktailCuration(raw, table) {
  if (!raw || !Array.isArray(raw.cocktails) || !Array.isArray(raw.families) || !table) return raw;
  const t = table;
  let cocktails = raw.cocktails.map((c) => ({ ...c }));

  const dedupe = new Set(Object.keys(t.dedupe || {}));
  const seen = new Set();
  cocktails = cocktails.filter((c) => {
    if (!dedupe.has(c.canonical)) return true;
    if (seen.has(c.canonical)) return false;
    seen.add(c.canonical);
    return true;
  });

  const removed = new Set(Object.keys(t.remove || {}));
  cocktails = cocktails.filter((c) => !removed.has(c.canonical));

  for (const c of cocktails) {
    const f = (t.fixes || {})[c.canonical];
    if (!f) continue;
    if (f.lines) {
      const old = c.ingredients_raw || [];
      c.recipe_text = rewriteText(c.recipe_text, old, f.lines);
      c.ingredients_raw = f.lines.map((raw) => ({ raw }));
    }
    if (f.patch) {
      const old = c.ingredients_raw || [];
      const next = old.map((l) => {
        const hit = f.patch.find((p) => norm(p.match) === norm(rawText(l)) || (typeof l === 'object' && norm(p.set?.raw) === norm(l.raw)));
        return hit ? { ...l, ...hit.set } : l;
      });
      c.recipe_text = rewriteText(c.recipe_text, old, next);
      c.ingredients_raw = next;
    }
  }

  for (const c of cocktails) {
    const m = (t.moves || {})[c.canonical];
    if (m) { c.family_id = m.family_id; c.subcluster_id = m.subcluster_id; }
  }

  const have = new Set(cocktails.map((c) => c.canonical));
  for (const a of t.add || []) {
    if (have.has(a.canonical)) continue;
    cocktails.push({ ...a });
    have.add(a.canonical);
  }

  const families = raw.families.map((f) => ({ ...f }));
  for (const nf of t.families || []) {
    if (families.some((f) => f.id === nf.id)) continue;
    const { reason, ...rest } = nf;
    families.push({ ...rest, signature: { dominant_slots: [], size: 0 } });
  }
  families.sort((a, b) => a.id - b.id);

  const subs = new Map((raw.subclusters || []).map((s) => [s.id, { ...s }]));
  for (const [id, def] of Object.entries(t.subgroups || {})) {
    const cur = subs.get(id) || { id, family_id: def.family_id, size: 0, signature: { dominant_slots: [] }, exemplars: [] };
    if (def.family_id != null) cur.family_id = def.family_id;
    if (def.exemplars) cur.exemplars = [...def.exemplars];
    cur.name = def.name;
    subs.set(id, cur);
  }
  const subclusters = [...subs.values()].sort((a, b) => String(a.id).localeCompare(String(b.id), undefined, { numeric: true }));

  // Each new family has one root: the named drink, when the family has none yet.
  for (const nf of t.families || []) {
    if (cocktails.some((c) => c.family_id === nf.id && c.is_root)) continue;
    const root = cocktails.find((c) => c.family_id === nf.id && c.name === nf.cultural_root);
    if (root) root.is_root = true;
  }

  const count = (pred) => cocktails.filter(pred).length;
  for (const f of families) f.signature = { ...(f.signature || {}), size: count((c) => c.family_id === f.id) };
  for (const s of subclusters) s.size = count((c) => c.subcluster_id === s.id);

  return {
    ...raw,
    _meta: { ...(raw._meta || {}), n_cocktails: cocktails.length, n_families: families.length, n_subclusters: subclusters.length, curated: 'DATA-6' },
    families, subclusters, cocktails,
  };
}

/**
 * Problems in the table against the raw codex (empty = valid): keys that name nothing, moves into a family or sub-group that
 * does not exist or belongs to another family, entries without a reason, additions or amounts without a source, slug aliases
 * that point at nothing.
 */
export function validateCocktailCuration(raw, table) {
  const problems = [];
  const canon = new Set((raw.cocktails || []).map((c) => c.canonical));
  const famIds = new Set([...(raw.families || []).map((f) => f.id), ...(table.families || []).map((f) => f.id)]);
  const subFam = new Map((raw.subclusters || []).map((s) => [s.id, s.family_id]));
  for (const [id, d] of Object.entries(table.subgroups || {})) {
    if (d.family_id != null) subFam.set(id, d.family_id);
    if (!d.name) problems.push(`subgroup ${id}: no name`);
    if (!subFam.has(id)) problems.push(`subgroup ${id}: unknown (give it a family_id)`);
  }
  for (const nf of table.families || []) {
    if (!nf.name || !nf.color || !nf.blurb || !nf.reason) problems.push(`family ${nf.id}: needs name, color, blurb and reason`);
  }
  for (const k of Object.keys(table.dedupe || {})) if (!canon.has(k)) problems.push(`dedupe ${k}: no such drink`);
  for (const [k, v] of Object.entries(table.remove || {})) {
    if (!canon.has(k)) problems.push(`remove ${k}: no such drink`);
    if (!v.reason || !v.slug || !v.slugTo) problems.push(`remove ${k}: needs reason, slug and slugTo`);
  }
  for (const [k, m] of Object.entries(table.moves || {})) {
    if (!canon.has(k)) problems.push(`move ${k}: no such drink`);
    if (!m.reason) problems.push(`move ${k}: no reason`);
    if (!famIds.has(m.family_id)) problems.push(`move ${k}: unknown family ${m.family_id}`);
    else if (subFam.get(m.subcluster_id) !== m.family_id) problems.push(`move ${k}: sub-group ${m.subcluster_id} is not in family ${m.family_id}`);
  }
  for (const [k, f] of Object.entries(table.fixes || {})) {
    if (!canon.has(k)) problems.push(`fix ${k}: no such drink`);
    if (!f.reason) problems.push(`fix ${k}: no reason`);
    if (!f.lines && !f.patch) problems.push(`fix ${k}: needs lines or patch`);
    if ((f.lines || []).some((l) => /^\s*[\d½¼¾]|^a splash/i.test(l)) && !f.source) problems.push(`fix ${k}: adds amounts without a source`);
  }
  const added = new Set();
  for (const a of table.add || []) {
    if (canon.has(a.canonical) || added.has(a.canonical)) problems.push(`add ${a.name}: already present`);
    added.add(a.canonical);
    if (!a.source) problems.push(`add ${a.name}: no source`);
    if (!famIds.has(a.family_id)) problems.push(`add ${a.name}: unknown family`);
    else if (subFam.get(a.subcluster_id) !== a.family_id) problems.push(`add ${a.name}: sub-group ${a.subcluster_id} is not in family ${a.family_id}`);
  }
  return problems;
}
