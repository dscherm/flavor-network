/**
 * inventBuild.js — the shared "Build" state behind the three invent panels
 * (cocktail, sauce, recipe). The user picks a baseline, gets a skeleton whose
 * REQUIRED slots are pre-filled with the best-pairing pick and whose optional
 * slots start empty, then swaps slots and adds extras themselves.
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
    const reason = rule(rest, key, slotId);
    if (reason) return reason;
  }
  return null;
}

/**
 * "Only one of these": refuses `key` when predicate(key) is true and another
 * line already satisfies predicate. reason is a string or (key) → string.
 */
export function oneOf(predicate, reason) {
  return (build, key) => {
    if (!predicate(key)) return null;
    return buildKeys(build).some((k) => predicate(k)) ? (typeof reason === 'function' ? reason(key) : reason) : null;
  };
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
      (c) => slot.accepts(c.key) && !refusal(out, c.key, slot.id),
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
    .filter((c) => !inBuild.has(c.key) && slot.accepts(c.key) && !refusal(build, c.key, slotId))
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
