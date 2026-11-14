/**
 * savedInventions.js — keeping what the cook invented in the profile, and turning
 * it back into the shapes the Cocktail Lab and Sauce Lab lists already render.
 * Pure: no I/O. useUserProfile stores whatever saveInvention / deleteInvention
 * return; the labs call withSavedCocktails / withSavedSauces on their loaded data.
 *
 * Storage (all in the profile document, beside the existing arrays):
 *   profile.cocktails  invented cocktails (inventSaved.js SavedItem, kind 'cocktail')
 *   profile.sauces     invented sauces    (SavedItem, kind 'sauce')
 *   profile.recipes    invented recipes   (the existing user-recipe shape plus
 *                      { id, source: 'invent', instructions?, cuisine? })
 * The cocktails / sauces arrays may also hold older entries written by the
 * Profile panel (no `kind` / `lines`); they are never read as inventions and
 * never dropped when one is saved.
 */
import {
  SAVED_LIMITS, toSavedItem, cleanSavedList, upsertSaved, removeSaved,
} from './inventSaved.js';
import { recommendCategory } from './inventBuild.js';
import { cocktailSkeleton } from './cocktailInvent.js';
import { INVENT_STYLES, INVENT_STYLE_BY_ID, sauceSkeleton } from './inventSauce.js';

export const PROFILE_FIELD = Object.freeze({ cocktail: 'cocktails', sauce: 'sauces', recipe: 'recipes' });
const NOUN = Object.freeze({ cocktail: 'cocktails', sauce: 'sauces', recipe: 'recipes' });
export const UNCATEGORISED = Object.freeze({ id: null, name: 'Uncategorised', color: '#9a8f7a' });

const text = (v) => (typeof v === 'string' ? v.trim() : '');
const asList = (v) => (Array.isArray(v) ? v : []);
const isSavedShape = (it) => !!it && typeof it === 'object' && typeof it.kind === 'string' && Array.isArray(it.lines);

/** The cook's saved cocktails or sauces from a profile; [] for a missing or malformed field. */
export function readSaved(profile, kind) {
  if (kind !== 'cocktail' && kind !== 'sauce') return [];
  return cleanSavedList(profile?.[PROFILE_FIELD[kind]]).filter((it) => it.kind === kind);
}

/** "2 oz" + "gin" → "2 oz gin"; no amount → "gin". */
export const lineText = (l) => [text(l?.amount), text(l?.key)].filter(Boolean).join(' ');

/** A saved item as an existing-shape user recipe (Cookbook lists these as it does any other). */
export function recipeFromItem(item) {
  return {
    id: item.id,
    name: item.name,
    ingredients: item.lines.map((l) => ({ name: l.key.toLowerCase(), quantity: null, unit: null, raw: lineText(l) })),
    ...(item.method ? { instructions: item.method } : {}),
    ...(item.cuisine ? { cuisine: item.cuisine } : {}),
    source: 'invent',
  };
}

const sameName = (a, b) => text(a?.name).toLowerCase() === text(b?.name).toLowerCase();

/**
 * Save an invention into a profile (returns a NEW profile; nothing else in it changes).
 * @param {object} profile
 * @param {{ kind, id?, name, category?, lines, method?, glass?, protein?, cuisine? }} input
 * @param {{ now?: number, makeId?: () => string }} [ctx]
 * @returns {{ ok: boolean, profile: object, item: object|null, reason?: string }}
 */
export function saveInvention(profile, input, ctx = {}) {
  const base = profile || {};
  const made = toSavedItem(input, ctx);
  if (!made.ok) return { ok: false, profile: base, item: null, reason: made.reason };
  const { item } = made;
  const field = PROFILE_FIELD[item.kind];

  if (item.kind === 'recipe') {
    const recipe = recipeFromItem({ ...item, cuisine: text(input?.cuisine) });
    const list = asList(base.recipes);
    const at = list.findIndex((r) => (r?.id && r.id === recipe.id) || (!input?.id && r?.source === 'invent' && sameName(r, recipe)));
    const invented = list.filter((r) => r?.source === 'invent').length;
    if (at < 0 && invented >= SAVED_LIMITS.perKind) {
      return { ok: false, profile: base, item: null, reason: `You have ${SAVED_LIMITS.perKind} saved recipes. Delete one to save another.` };
    }
    const next = at >= 0 ? list.map((r, i) => (i === at ? recipe : r)) : [...list, recipe];
    return { ok: true, profile: { ...base, recipes: next }, item: recipe };
  }

  const current = asList(base[field]);
  const saved = cleanSavedList(current);
  const exists = saved.some((x) => x.id === item.id);
  if (!exists && saved.length >= SAVED_LIMITS.perKind) {
    return { ok: false, profile: base, item: null, reason: `You have ${SAVED_LIMITS.perKind} saved ${NOUN[item.kind]}. Delete one to save another.` };
  }
  const savedIds = new Set(saved.map((x) => x.id));
  // Entries that are not inventions (older Profile-panel saves) ride along untouched.
  const others = current.filter((x) => !(isSavedShape(x) && savedIds.has(x.id)));
  const nextSaved = upsertSaved(saved, item);
  return { ok: true, profile: { ...base, [field]: [...nextSaved, ...others] }, item };
}

/** Remove one saved cocktail / sauce / recipe by id; everything else is untouched. */
export function deleteInvention(profile, kind, id) {
  const base = profile || {};
  const field = PROFILE_FIELD[kind];
  if (!field) return base;
  if (kind === 'recipe') return { ...base, recipes: asList(base.recipes).filter((r) => r?.id !== id) };
  const current = asList(base[field]);
  const saved = cleanSavedList(current);
  const savedIds = new Set(saved.map((x) => x.id));
  const others = current.filter((x) => !(isSavedShape(x) && savedIds.has(x.id)));
  return { ...base, [field]: [...removeSaved(saved, id), ...others] };
}

// ── names ──────────────────────────────────────────────────────────

const canon = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^\w\s-]/g, '').replace(/\s+/g, ' ').trim();

/** A display name no list entry already uses: "Negroni" taken → "Negroni (yours)". */
function uniqueName(name, taken) {
  let out = name;
  let n = 1;
  while (taken.has(canon(out))) { n += 1; out = n === 2 ? `${name} (yours)` : `${name} (yours ${n - 1})`; }
  taken.add(canon(out));
  return out;
}

// ── cocktails ──────────────────────────────────────────────────────

/** The family id a saved cocktail belongs to: the saved category, else the recommended one, else null. */
export function cocktailFamilyId(item, families, roles = {}) {
  const ids = asList(families).map((f) => f.id);
  const asId = (v) => {
    if (v == null || v === '') return null;
    const n = typeof v === 'number' ? v : Number(v);
    return Number.isFinite(n) && ids.includes(n) ? n : null;
  };
  const saved = asId(item.category);
  if (saved != null) return saved;
  const keys = item.lines.map((l) => l.key);
  const skeletons = asList(families).map((f) => ({ id: f.id, skeleton: cocktailSkeleton(f.id, { roles }) }));
  const rec = recommendCategory(keys, skeletons);
  return rec ? rec.id : null;
}

/** A saved cocktail in the codex shape the browse list, card, My bar and search read. */
export function savedCocktailToCodex(item, { families, roles = {}, name = item.name } = {}) {
  return {
    name,
    canonical: canon(name),
    family_id: cocktailFamilyId(item, families, roles),
    subcluster_id: null,
    is_root: false,
    iba_official: false,
    iba_category: null,
    ingredients_raw: item.lines.map((l) => ({ raw: lineText(l) })),
    recipe_text: item.method || '',
    glass: item.glass || null,
    garnishes: [],
    build_method: null,
    ice_format: null,
    aeration: null,
    mine: true,
    savedId: item.id,
    createdAt: item.createdAt,
  };
}

/**
 * The loaded codex graph plus the cook's cocktails: appended to `cocktails`,
 * `byCanonical` and (when a family is known) `byFamily`; all of them also in
 * `mine`. With nothing saved the same graph object comes back untouched.
 */
export function withSavedCocktails(graph, saved, { roles = {} } = {}) {
  if (!graph || !saved?.length) return graph;
  const taken = new Set(graph.cocktails.map((c) => c.canonical || canon(c.name)));
  const mine = saved.map((it) => savedCocktailToCodex(it, { families: graph.families, roles, name: uniqueName(it.name, taken) }));
  const byFamily = new Map([...(graph.byFamily || [])].map(([k, v]) => [k, [...v]]));
  const byCanonical = new Map(graph.byCanonical || []);
  for (const c of mine) {
    byCanonical.set(c.canonical, c);
    if (c.family_id != null) {
      if (!byFamily.has(c.family_id)) byFamily.set(c.family_id, []);
      byFamily.get(c.family_id).push(c);
    }
  }
  return { ...graph, cocktails: [...graph.cocktails, ...mine], byFamily, byCanonical, mine };
}

// ── sauces ─────────────────────────────────────────────────────────

/** The sauce family id for a saved sauce: its style / family category, else the recommended style's family, else null. */
export function sauceFamilyId(item, clusters, catMap = null) {
  const list = asList(clusters);
  const ids = list.map((c) => c.id);
  const cat = item.category;
  if (typeof cat === 'string' && INVENT_STYLE_BY_ID.has(cat)) {
    const fid = INVENT_STYLE_BY_ID.get(cat).familyId;
    if (ids.includes(fid)) return fid;
  }
  if (cat != null && cat !== '') {
    const n = typeof cat === 'number' ? cat : Number(cat);
    if (Number.isFinite(n) && ids.includes(n)) return n;
    const byName = list.find((c) => c.name === cat);
    if (byName) return byName.id;
  }
  const skeletons = INVENT_STYLES.map((s) => ({ id: s.id, skeleton: sauceSkeleton(s.id, { catMap }) }));
  const rec = recommendCategory(item.lines.map((l) => l.key), skeletons);
  const fid = rec ? INVENT_STYLE_BY_ID.get(rec.id)?.familyId : null;
  return fid != null && ids.includes(fid) ? fid : null;
}

/** A saved sauce in the codex-node shape the sauce list, card and pantry read. */
export function savedSauceToCodex(item, { clusters, catMap = null, name = item.name } = {}) {
  const family_id = sauceFamilyId(item, clusters, catMap);
  const fam = asList(clusters).find((c) => c.id === family_id) || null;
  return {
    name,
    family_id,
    family: fam?.name || UNCATEGORISED.name,
    clusterColor: fam?.color || UNCATEGORISED.color,
    cuisine: null,
    isRoot: false,
    ingredients: item.lines.map((l) => l.key),
    ingredientsDetailed: item.lines.map((l) => ({ name: l.key, measure: text(l.amount) })),
    instructions: item.method || '',
    ...(item.protein ? { proteins: [item.protein] } : {}),
    pairsWith: [],
    mine: true,
    savedId: item.id,
    createdAt: item.createdAt,
  };
}

/** The loaded sauce codex plus the cook's sauces (added to graph.nodes by display name; all also in `mine`). */
export function withSavedSauces(codexData, saved, { catMap = null } = {}) {
  if (!codexData || !saved?.length) return codexData;
  const taken = new Set([...codexData.graph.nodes.keys()].map(canon));
  const clusters = codexData.codex?.clusters || [];
  const mine = saved.map((it) => savedSauceToCodex(it, { clusters, catMap, name: uniqueName(it.name, taken) }));
  const nodes = new Map(codexData.graph.nodes);
  for (const s of mine) nodes.set(s.name, s);
  return { ...codexData, graph: { ...codexData.graph, nodes }, mine };
}
