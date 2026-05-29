/**
 * bowlEntry — RECIPE-LAB-SPEC §11.1 BowlEntry shape + bowl manipulation
 * helpers. Bowl is the source of truth for the in-flight recipe; every
 * read site in RecipeLabMobile either consumes the full BowlEntry[] or
 * adapts to a string[] via `bowlNames(bowl)` when only ingredient names
 * matter (aroma match handlers, search, save flow).
 *
 *   BowlEntry = {
 *     ingredient: string,
 *     amount: {
 *       raw: string,            // verbatim user entry; never mutated
 *       qty: number | null,     // parseAmount output
 *       unit: string | null,    // parseAmount output (canonical short)
 *       inferred: boolean,      // §12 auto-portion path; default false
 *     } | null,                 // null when the user has typed nothing yet
 *   }
 */
import { parseAmount } from './portionParser.js';

export function emptyAmount() {
  return { raw: '', qty: null, unit: null, inferred: false };
}

export function makeBowlEntry(name, amount = null) {
  return { ingredient: String(name), amount };
}

// Strict shape detection so the handoff watcher can accept both
// legacy string[] payloads and forward-shape BowlEntry[] payloads.
function isBowlEntry(x) {
  return x && typeof x === 'object' && typeof x.ingredient === 'string';
}

export function bowlNames(bowl) {
  if (!Array.isArray(bowl)) return [];
  return bowl.map((b) => (typeof b === 'string' ? b : b?.ingredient)).filter(Boolean);
}

// Coerce a legacy string[] (or already-BowlEntry[]) into BowlEntry[].
// Dedupes by ingredient name, preserving first-seen order.
export function bowlFromIngredients(items) {
  if (!Array.isArray(items)) return [];
  const seen = new Set();
  const out = [];
  for (const item of items) {
    const entry = isBowlEntry(item)
      ? item
      : (typeof item === 'string' ? makeBowlEntry(item) : null);
    if (!entry) continue;
    if (seen.has(entry.ingredient)) continue;
    seen.add(entry.ingredient);
    out.push(entry);
  }
  return out;
}

export function bowlIncludes(bowl, name) {
  if (!Array.isArray(bowl) || !name) return false;
  return bowl.some((b) => b?.ingredient === name);
}

export function bowlAddIngredient(bowl, name, amount = null) {
  if (!name) return bowl;
  if (bowlIncludes(bowl, name)) return bowl;
  return [...bowl, makeBowlEntry(name, amount)];
}

export function bowlRemoveIngredient(bowl, name) {
  if (!Array.isArray(bowl) || !name) return bowl;
  return bowl.filter((b) => b?.ingredient !== name);
}

// Replace `oldName` with `newName` in-place (preserving position +
// amount). If `newName` already exists at a different position, the
// old slot is removed and no second copy is created.
export function bowlSwapIngredient(bowl, oldName, newName) {
  if (!Array.isArray(bowl) || !oldName || !newName) return bowl;
  const idx = bowl.findIndex((b) => b?.ingredient === oldName);
  if (idx === -1) {
    return bowlIncludes(bowl, newName) ? bowl : bowlAddIngredient(bowl, newName);
  }
  if (bowlIncludes(bowl, newName)) {
    // Avoid duplicates: drop the old slot, keep the existing new entry.
    return bowlRemoveIngredient(bowl, oldName);
  }
  const next = [...bowl];
  next[idx] = { ...next[idx], ingredient: newName };
  return next;
}

// Parse the user's raw text and write the structured amount onto the
// matching entry. Raw text is always preserved verbatim; structured
// fields are null when parsing fails.
export function bowlSetAmount(bowl, name, rawText, { inferred = false } = {}) {
  if (!Array.isArray(bowl) || !name) return bowl;
  const idx = bowl.findIndex((b) => b?.ingredient === name);
  if (idx === -1) return bowl;
  const raw = typeof rawText === 'string' ? rawText : '';
  if (raw.trim().length === 0) {
    const next = [...bowl];
    next[idx] = { ...next[idx], amount: null };
    return next;
  }
  const parsed = parseAmount(raw);
  const amount = {
    raw,
    qty: parsed?.qty ?? null,
    unit: parsed?.unit ?? null,
    inferred,
  };
  const next = [...bowl];
  next[idx] = { ...next[idx], amount };
  return next;
}

export function bowlGetAmount(bowl, name) {
  if (!Array.isArray(bowl) || !name) return null;
  const entry = bowl.find((b) => b?.ingredient === name);
  return entry?.amount || null;
}
