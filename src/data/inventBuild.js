/**
 * inventBuild.js — the shared "Build" state behind the three invent panels
 * (cocktail, sauce, recipe). A build starts EMPTY (openBuild): the cook's own
 * lines are all it holds. A category (skeleton) is optional and re-homes the same
 * lines into slots without adding or dropping any (applyCategory / clearCategory);
 * checklist() says which parts are ticked, advice() reports soft notes, and
 * suggestNext() ranks what to add. The older slot-first helpers (seedBuild,
 * fillRequired, setSlot, shortlist, addExtra, ...) remain for tests and for
 * setSlot / shortlist, which the panels still use to put a pick in a part.
 *
 * Lab-agnostic and pure: no React, no fetch, no lab imports. A lab injects
 *   - a skeleton   { slots: [{ id, label, required, accepts(key)→bool, ...passthrough }], rules?: [rule] }
 *   - a rankFn     (slot, currentKeys) → ordered candidate keys, or { key, ...extra } objects
 * and keeps amounts, method and colour to itself: a Line here is only
 * { key, source } plus whatever fields the lab attaches later.
 *
 *   Build = { lab, baseline, slots: [Slot], extras: [Line], rules: [rule], rejected: [{ key, reason }] }
 *   Slot  = { id, label, required, accepts, line: Line|null, locked: bool, ...passthrough }
 *   Line  = { key, source: 'auto'|'user'|'search', ...extra }
 *
 * A build keeps `baseRules` (the lab's own rules, given to openBuild): applyCategory
 * adds the skeleton's rules to them (an advice rule of the same `kind` is not doubled)
 * and clearCategory goes back to them.
 *
 * Every function returns a new build and never mutates its input (a deep-
 * frozen build works). Operations that can be refused (setSlot, addExtra)
 * return { ok, build, reason }; the build is the unchanged input on refusal.
 * Operations that cannot fail (clearSlot, removeExtra, fillRequired,
 * seedBuild) return the build itself.
 *
 * Guard rails: no key twice anywhere in the build is built in. Everything
 * else is a rule, (build, key, slotId|null) → null | 'one-line reason', where
 * `build` is the build WITHOUT the line being replaced (so a swap is never
 * refused for clashing with the very pick it replaces). oneOf() builds the
 * "only one X" rule from an injected predicate.
 */
import { isSuggestable } from './curation/suggestable.js';

/**
 * "Same kind of thing": the same name, or both end in the same word ("black pepper",
 * "white pepper", "pepper"; "olive oil", "sesame oil"). For leaving a near-duplicate
 * out of a suggestion list; never used to refuse a line.
 */
export function sameKind(a, b) {
  const x = String(a).toLowerCase().trim();
  const y = String(b).toLowerCase().trim();
  if (!x || !y) return false;
  if (x === y) return true;
  const last = (t) => t.split(/\s+/).pop().replace(/(es|s)$/, '');
  return last(x) === last(y);
}

/** Normalise a rankFn result into { key, ...extra } objects. */
function asCandidates(list) {
  return (list || []).map((c) => (typeof c === 'string' ? { key: c } : c)).filter((c) => c && c.key);
}

/** Every key in slots then extras, in order. */
export function buildKeys(build) {
  return [
    ...build.slots.filter((s) => s.line).map((s) => s.line.key),
    ...build.extras.map((l) => l.key),
  ];
}

/** Labels of required slots that are empty. */
export function missing(build) {
  return build.slots.filter((s) => s.required && !s.line).map((s) => s.label);
}

/** The build with one slot's line taken out (for rule checks on a swap). */
function without(build, slotId) {
  if (slotId == null) return build;
  return { ...build, slots: build.slots.map((s) => (s.id === slotId ? { ...s, line: null } : s)) };
}

/** First reason this key may not go in (slotId, or extras when null), else null. */
function refusal(build, key, slotId) {
  const rest = without(build, slotId);
  if (buildKeys(rest).includes(key)) return `${key} is already in the build`;
  for (const rule of build.rules) {
    if (rule.advise) continue;
    const reason = rule(rest, key, slotId);
    if (reason) return reason;
  }
  return null;
}

/**
 * "Only one of these": refuses `key` when predicate(key) is true and another
 * line already satisfies predicate. reason is a string or (key) -> string.
 *
 * { advise: true } makes it ADVICE instead: the add succeeds, and advice(build)
 * reports { kind, message, keys } once two or more lines satisfy predicate.
 * (Any rule function may carry an `advise(build) -> { kind, message, keys } | null`
 * property to be advice; refusal rules never have one.)
 */
export function oneOf(predicate, reason, { advise = false, kind = 'advice' } = {}) {
  const say = (key) => (typeof reason === 'function' ? reason(key) : reason);
  if (!advise) {
    return (build, key) => {
      if (!predicate(key)) return null;
      return buildKeys(build).some((k) => predicate(k)) ? say(key) : null;
    };
  }
  const rule = () => null;
  rule.kind = kind;
  rule.advise = (build) => {
    const hits = buildKeys(build).filter((k) => predicate(k));
    return hits.length > 1 ? { kind, message: say(hits[hits.length - 1]), keys: hits } : null;
  };
  return rule;
}

/**
 * Start a build. `pinned` is an ordered list of { key, source: 'user'|'search' }:
 * each goes into the FIRST empty slot whose accepts() takes it (locked, with
 * that source); a key no slot takes goes to extras. A pin a rule or the
 * no-duplicates guard refuses is skipped and listed in build.rejected.
 */
export function seedBuild(skeleton, { lab = null, baseline = {}, pinned = [] } = {}) {
  let build = {
    lab,
    baseline,
    slots: (skeleton.slots || []).map((s) => ({ ...s, line: null, locked: false })),
    extras: [],
    rules: skeleton.rules || [],
    rejected: [],
  };
  for (const p of pinned) {
    const source = p.source || 'user';
    const slot = build.slots.find((s) => !s.line && s.accepts(p.key) && !refusal(build, p.key, s.id));
    if (slot) {
      build = { ...build, slots: build.slots.map((s) => (s === slot ? { ...s, line: { key: p.key, source }, locked: true } : s)) };
      continue;
    }
    const reason = refusal(build, p.key, null);
    build = reason
      ? { ...build, rejected: [...build.rejected, { key: p.key, reason }] }
      : { ...build, extras: [...build.extras, { key: p.key, source }] };
  }
  return build;
}

/**
 * Fill each EMPTY required slot with the top usable pick of
 * rankFn(slot, currentKeys). Usable = not already in the build, accepted by
 * the slot, not refused by a rule. Locked, user-set and optional slots are
 * never touched; a slot with no usable pick stays empty (see missing()).
 */
export function fillRequired(build, rankFn) {
  let out = build;
  for (const slot of build.slots) {
    if (!slot.required || slot.line) continue;
    const pick = asCandidates(rankFn(slot, buildKeys(out))).find(
      (c) => isSuggestable(c.key) && slot.accepts(c.key) && !refusal(out, c.key, slot.id),
    );
    if (!pick) continue;
    out = { ...out, slots: out.slots.map((s) => (s.id === slot.id ? { ...s, line: { ...pick, source: 'auto' } } : s)) };
  }
  return out;
}

/**
 * Ranked candidates for one slot given the REST of the build (the slot's own
 * pick is not in the context). Returns up to n { key, ...extra } objects,
 * excluding keys already in the build, keys the slot rejects, and keys a rule
 * refuses. [] for an unknown slot.
 */
export function shortlist(build, slotId, rankFn, n = 8) {
  const slot = build.slots.find((s) => s.id === slotId);
  if (!slot) return [];
  const rest = without(build, slotId);
  const inBuild = new Set(buildKeys(build));
  return asCandidates(rankFn(slot, buildKeys(rest)))
    .filter((c) => !inBuild.has(c.key) && isSuggestable(c.key) && slot.accepts(c.key) && !refusal(build, c.key, slotId))
    .slice(0, n);
}

/** Put key in a slot (replacing its line). → { ok, build, reason? }. */
export function setSlot(build, slotId, key, { source = 'user', ...extra } = {}) {
  const slot = build.slots.find((s) => s.id === slotId);
  if (!slot) return { ok: false, build, reason: `no slot called ${slotId}` };
  if (!slot.accepts(key)) return { ok: false, build, reason: `${key} doesn't fit as the ${slot.label}` };
  const reason = refusal(build, key, slotId);
  if (reason) return { ok: false, build, reason };
  const slots = build.slots.map((s) => (s.id === slotId ? { ...s, line: { ...extra, key, source }, locked: false } : s));
  return { ok: true, build: { ...build, slots } };
}

/** Empty a slot (locked or not). It stays empty, and listed by missing() if required, until set or refilled explicitly. */
export function clearSlot(build, slotId) {
  return { ...build, slots: build.slots.map((s) => (s.id === slotId ? { ...s, line: null, locked: false } : s)) };
}

/** Add an extra ingredient. → { ok, build, reason? }. */
export function addExtra(build, key, { source = 'user', ...extra } = {}) {
  const reason = refusal(build, key, null);
  if (reason) return { ok: false, build, reason };
  return { ok: true, build: { ...build, extras: [...build.extras, { ...extra, key, source }] } };
}

/** Remove an extra by key. */
export function removeExtra(build, key) {
  return { ...build, extras: build.extras.filter((l) => l.key !== key) };
}

// ======================================================================
// Second pass — "start empty": a build may have NO category (slots: []),
// and the cook's lines are the only thing in it.
// ======================================================================

/** True when the build is under a category (has slots). */
export function hasCategory(build) {
  return build.slots.length > 0;
}

/** Filled slots in slot order, then extras. */
function flatLines(build) {
  return [...build.slots.filter((s) => s.line).map((s) => s.line), ...build.extras];
}

/**
 * A build with NO category: slots [], every line in `extras` in the order given,
 * rules [] (plus the built-in no-duplicates guard; `rules` may be passed so a lab
 * can still report advice on a flat list). A repeated key is dropped and listed
 * in build.rejected. Lines are { key, source: 'user'|'search', ...extra }.
 */
export function openBuild({ lab = null, baseline = {}, lines = [], rules = [] } = {}) {
  const seen = new Set();
  const extras = [];
  const rejected = [];
  for (const l of lines || []) {
    if (!l || !l.key) continue;
    if (seen.has(l.key)) { rejected.push({ key: l.key, reason: `${l.key} is already in the build` }); continue; }
    seen.add(l.key);
    extras.push({ ...l, source: l.source || 'user' });
  }
  return { lab, baseline, slots: [], extras, rules, baseRules: rules, rejected };
}

/**
 * Best assignment of keys to DISTINCT slots (augmenting paths, not first-come:
 * "carrot" may go to the vegetable slot so the aromatic slot can take "onion").
 * Required slots are matched first, keys are tried in the order given.
 * -> Map slotId -> key.
 */
export function assignKeys(slots, keys) {
  const order = [...slots].sort((a, b) => (b.required ? 1 : 0) - (a.required ? 1 : 0));
  const holder = new Map(); // key -> slot
  const attempt = (slot, seen) => {
    for (const k of keys) {
      if (seen.has(k) || !slot.accepts(k)) continue;
      seen.add(k);
      const other = holder.get(k);
      if (!other || attempt(other, seen)) { holder.set(k, slot); return true; }
    }
    return false;
  };
  for (const slot of order) attempt(slot, new Set());
  return new Map([...holder.entries()].map(([k, slot]) => [slot.id, k]));
}

/**
 * Put the SAME lines under a skeleton. Each line goes to a slot by a best
 * assignment (assignKeys: required slots first, augmenting paths, never plain
 * first-fit), the rest stay extras in their original relative order. No line is
 * added or dropped, even one a skeleton rule would have refused (the cook put it
 * there; advice() will say so). Slots start unlocked. Returns the new build.
 */
export function applyCategory(build, skeleton) {
  const lines = flatLines(build);
  const slots = (skeleton.slots || []).map((s) => ({ ...s, line: null, locked: false }));
  const taken = assignKeys(slots, lines.map((l) => l.key));
  const used = new Set();
  const placed = slots.map((s) => {
    const line = taken.has(s.id) ? lines.find((l) => l.key === taken.get(s.id)) : null;
    if (line) used.add(line.key);
    return { ...s, line: line || null };
  });
  const base = build.baseRules || [];
  const same = (r) => base.some((b) => b === r || (r.kind && b.kind === r.kind));
  const rules = [...base, ...(skeleton.rules || []).filter((r) => !same(r))];
  return { ...build, slots: placed, extras: lines.filter((l) => !used.has(l.key)), rules };
}

/** Back to a flat list: lines in slot order then extras; the category's rules go, the lab's base rules stay. */
export function clearCategory(build) {
  return { ...build, slots: [], extras: flatLines(build), rules: build.baseRules || [] };
}

/**
 * What the category asks for: [{ slotId, label, required, done, key, ...slot
 * passthrough (why, parts, ...) }], in slot order; [] when there is no category.
 * A slot is done when it holds a line; one line ticks at most one part. `key` is always
 * the line's ingredient: a skeleton slot's own `key` flag (marks a naming slot) is overridden.
 */
export function checklist(build) {
  return build.slots.map(({ id, label, required, accepts, line, locked, ...rest }) => ({
    ...rest, slotId: id, label, required: !!required, done: !!line, key: line ? line.key : null,
  }));
}

/** Soft notes from advice rules: [{ kind, message, keys }]. */
export function advice(build) {
  return (build.rules || []).map((r) => (r.advise ? r.advise(build) : null)).filter(Boolean);
}

/** Every category ranked by fit: [{ id, placed, requiredPlaced }] best first (order breaks ties). */
export function rankCategories(keys, skeletons, { order = null } = {}) {
  const list = skeletons instanceof Map
    ? [...skeletons.entries()].map(([id, skeleton]) => ({ id, skeleton }))
    : [...(skeletons || [])];
  const uniqKeys = [...new Set((keys || []).filter(Boolean))];
  const rank = new Map((order || list.map((c) => c.id)).map((id, i) => [id, i]));
  const at = (id) => (rank.has(id) ? rank.get(id) : Number.MAX_SAFE_INTEGER);
  return list
    .map(({ id, skeleton }) => {
      const slots = skeleton.slots || [];
      const taken = assignKeys(slots, uniqKeys);
      const requiredPlaced = slots.filter((s) => s.required && taken.has(s.id)).length;
      return { id, placed: taken.size, requiredPlaced };
    })
    .sort((a, b) => (b.placed - a.placed) || (b.requiredPlaced - a.requiredPlaced) || (at(a.id) - at(b.id)));
}

/**
 * The category these keys look like: the one placing the most keys in distinct
 * slots, ties to most required slots placed, then `order` (ids; default the order
 * of `skeletons`). null under two distinct keys, or when nothing places two.
 * @param {string[]} keys
 * @param {Array<{ id, skeleton }> | Map<id, skeleton>} skeletons
 */
export function recommendCategory(keys, skeletons, { order = null } = {}) {
  if (new Set((keys || []).filter(Boolean)).size < 2) return null;
  const best = rankCategories(keys, skeletons, { order })[0];
  return best && best.placed >= 2 ? best : null;
}

/**
 * Ranked suggestions for the WHOLE list: [{ key, slotId?, have?, score?, ...whatever the ranker returned }].
 *
 * rankFn({ slot, currentKeys, build }) -> keys or { key, ... } objects, best first:
 *   - slot: the Slot (id, label, required, accepts, ...passthrough) of an UNTICKED
 *     part, or null for "anything that goes with the list";
 *   - currentKeys: buildKeys(build);
 *   - build: the build itself.
 * Without a category it is called once with slot null. With one it is called once per
 * unticked part (and once with null); required parts' candidates come first, optional
 * next, general last, parts taking turns (round-robin) so one part cannot fill the list.
 * Inside each group, owned items (have === true) come first. Dropped: keys already in the
 * build, keys the part does not accept, keys a refusal rule would refuse.
 */
export function suggestNext(build, rankFn, n = 8) {
  const currentKeys = buildKeys(build);
  const inBuild = new Set(currentKeys);
  const group = (slot) => asCandidates(rankFn({ slot, currentKeys, build }))
    .filter((c) => !inBuild.has(c.key) && isSuggestable(c.key) && (!slot || slot.accepts(c.key)) && !refusal(build, c.key, null))
    .map((c) => (slot ? { ...c, slotId: slot.id } : c))
    .map((c, i) => ({ c, i }))
    .sort((a, b) => ((b.c.have === true) - (a.c.have === true)) || (a.i - b.i))
    .map((x) => x.c);
  const out = [];
  const seen = new Set();
  const take = (c) => { if (!seen.has(c.key)) { seen.add(c.key); out.push(c); } };
  const robin = (groups) => {
    for (let i = 0; groups.some((g) => i < g.length); i += 1) groups.forEach((g) => { if (i < g.length) take(g[i]); });
  };
  const open = build.slots.filter((s) => !s.line);
  robin(open.filter((s) => s.required).map(group));
  robin(open.filter((s) => !s.required).map(group));
  robin([group(null)]);
  return out.slice(0, n);
}

/** Slots with `line` placed: a direct empty accepting slot first, else move an occupant (augmenting). null if no room. */
function placeLine(slots, line) {
  const direct = slots.find((s) => !s.line && s.accepts(line.key));
  if (direct) return slots.map((s) => (s === direct ? { ...s, line, locked: false } : s));
  const next = slots.map((s) => ({ ...s }));
  const move = (ln, seen) => {
    for (const s of next) {
      if (seen.has(s.id) || !s.accepts(ln.key)) continue;
      seen.add(s.id);
      const occupant = s.line;
      if (!occupant || move(occupant, seen)) { s.line = ln; s.locked = false; return true; }
    }
    return false;
  };
  return move(line, new Set()) ? next : null;
}

/** Pull extras into empty slots they fit (augmenting), keeping extras' order. */
function settle(build) {
  let out = build;
  for (const x of build.extras) {
    const placed = placeLine(out.slots, x);
    if (placed) out = { ...out, slots: placed, extras: out.extras.filter((e) => e !== x) };
  }
  return out;
}

/**
 * Add a line, with or without a category. With one: the first empty accepting slot
 * (moving a placed line elsewhere if that makes room), else extras. Without: extras.
 * -> { ok, build, reason? } (duplicate / rule refusals leave the build unchanged).
 */
export function addLine(build, key, { source = 'user', ...extra } = {}) {
  if (!key) return { ok: false, build, reason: 'Type an ingredient first.' };
  const reason = refusal(build, key, null);
  if (reason) return { ok: false, build, reason };
  const line = { ...extra, key, source };
  const slots = hasCategory(build) ? placeLine(build.slots, line) : null;
  return { ok: true, build: slots ? { ...build, slots } : { ...build, extras: [...build.extras, line] } };
}

/** Remove a line wherever it is; extras that now fit a freed slot move up into it. */
export function removeLine(build, key) {
  return settle({
    ...build,
    slots: build.slots.map((s) => (s.line && s.line.key === key ? { ...s, line: null, locked: false } : s)),
    extras: build.extras.filter((l) => l.key !== key),
  });
}

/**
 * Swap one line's key for another in the same position, keeping its other fields
 * (amount, note, ...); `have` is dropped unless given in opts. In a slot that does
 * not accept the new key, the line moves to extras (and may settle into another slot).
 * -> { ok, build, reason? }.
 */
export function replaceLine(build, oldKey, newKey, { source = 'user', ...extra } = {}) {
  const slot = build.slots.find((s) => s.line && s.line.key === oldKey);
  const old = slot ? slot.line : build.extras.find((l) => l.key === oldKey);
  if (!old) return { ok: false, build, reason: `${oldKey} is not in the build` };
  if (!newKey) return { ok: false, build, reason: 'Choose what to use instead.' };
  if (newKey === oldKey) return { ok: true, build };
  const rest = {
    ...build,
    slots: build.slots.map((s) => (s === slot ? { ...s, line: null } : s)),
    extras: build.extras.filter((l) => l !== old),
  };
  const reason = refusal(rest, newKey, null);
  if (reason) return { ok: false, build, reason };
  const { have, ...kept } = old;
  const line = { ...kept, ...extra, key: newKey, source };
  if (slot && slot.accepts(newKey)) {
    return { ok: true, build: { ...build, slots: build.slots.map((s) => (s === slot ? { ...s, line, locked: false } : s)) } };
  }
  if (slot) return { ok: true, build: settle({ ...rest, extras: [...rest.extras, line] }) };
  return { ok: true, build: { ...build, extras: build.extras.map((l) => (l === old ? line : l)) } };
}
