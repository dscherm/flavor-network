/**
 * vocabAliases.js — keeps the on-device models on THEIR vocabulary after ingredients are merged.
 *
 * The set-completion, quantity and directions models were trained on the OLD ingredient names
 * (recipe_vocab.json still has "peache" and "peach" as two ids). The app now speaks canonical names.
 * This plan says, for one vocab array:
 *   extra        extra name -> id entries: a canonical name the vocab lacks maps to its variant's id, and a
 *                variant name maps to its canonical's id, so no merge ever makes an ingredient "unknown"
 *   variantIds   canonical id -> ids of its merged variants (fed to the model alongside the canonical id,
 *                because most of the training signal sits under the variant spelling)
 *   retired      ids never offered as a suggestion (a variant whose canonical has its own id; hidden names)
 *   display      id -> the canonical name to show for a variant id
 *   hiddenIds    ids of hidden (not-food) names: left out of ingredient lists shown to the cook
 */
import { aliasEntries, isRetiredIngredient } from './resolveIngredient.js';
import hidden from './hidden.json' with { type: 'json' };
import { curationKey } from './normalize.js';

const cache = new WeakMap();

export function planVocabAliases(vocab) {
  if (!Array.isArray(vocab)) return { extra: new Map(), variantIds: new Map(), retired: new Set(), display: new Map(), hiddenIds: new Set() };
  const hit = cache.get(vocab);
  if (hit) return hit;
  const index = new Map();
  for (let i = 0; i < vocab.length; i++) index.set(String(vocab[i]).toLowerCase(), i);
  const extra = new Map();
  const variantIds = new Map();
  const retired = new Set();
  const display = new Map();
  const hiddenIds = new Set();
  const orphans = new Map(); // canonical name the vocab lacks -> the ids of its variants
  for (const [variant, canon] of aliasEntries()) {
    const vid = index.get(variant);
    if (vid == null) continue;
    const cid = index.get(canon);
    display.set(vid, canon);
    if (cid == null) { orphans.set(canon, [...(orphans.get(canon) || []), vid]); continue; }
    extra.set(variant, cid);
    retired.add(vid);
    if (!variantIds.has(cid)) variantIds.set(cid, []);
    variantIds.get(cid).push(vid);
  }
  // A canonical with no id of its own is carried by its first variant's id; the other variants' ids are
  // folded in (fed together with it, never suggested), so a many-to-one merge keeps all of its signal.
  for (const [canon, vids] of orphans) {
    const [primary, ...rest] = vids.sort((x, y) => x - y);
    extra.set(canon, primary);
    for (const vid of rest) {
      extra.set(String(vocab[vid]).toLowerCase(), primary);
      retired.add(vid);
    }
    if (rest.length) variantIds.set(primary, rest);
  }
  for (const name of Object.keys(hidden)) {
    const id = index.get(curationKey(name));
    if (id != null) { retired.add(id); hiddenIds.add(id); }
  }
  const plan = { extra, variantIds, retired, display, hiddenIds };
  cache.set(vocab, plan);
  return plan;
}

export { isRetiredIngredient };
