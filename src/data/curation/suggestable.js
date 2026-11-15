/**
 * suggestable.js - the one predicate for "may the app OFFER this ingredient on its own?".
 *
 * Packaged products (brands, boxed mixes, canned condensed soups), hidden names and merged variants stay
 * findable by typing and stay valid in saved recipes, but the app never puts them in front of a cook as a
 * suggestion, a stand-in, a checklist pick or a pairing partner. Every place that OFFERS an ingredient
 * the cook did not type filters through here (see docs/data-quality.md, "After DATA-3", for the list).
 *
 *   isSuggestable(name, dataset?)   dataset: an ingredients object or a Map of nodes; a `packaged` flag on
 *                                   the entry also counts, so a flag set outside the table is honoured.
 *   suggestableOnly(list, nameOf?)  the list without the names that are not suggestable
 */
import { curationKey } from './normalize.js';
import aliases from './aliases.json' with { type: 'json' };
import hidden from './hidden.json' with { type: 'json' };
import packaged from './packaged.json' with { type: 'json' };

const BLOCKED = new Set([...Object.keys(aliases), ...Object.keys(hidden), ...Object.keys(packaged)].map(curationKey));

export function isSuggestable(name, dataset = null) {
  const key = curationKey(name);
  if (!key || BLOCKED.has(key)) return false;
  const entry = dataset ? (typeof dataset.get === 'function' ? dataset.get(name) : dataset[name]) : null;
  return !(entry && entry.packaged === true);
}

export function suggestableOnly(list, nameOf = (x) => (typeof x === 'string' ? x : x?.key ?? x?.name), dataset = null) {
  return (Array.isArray(list) ? list : []).filter((x) => isSuggestable(nameOf(x), dataset));
}
