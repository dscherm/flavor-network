/**
 * resolveIngredient.js — map a variant ingredient name to its canonical name through the alias table.
 *
 * Every place that turns text into an ingredient key goes through here, so an old, misspelled or
 * merged name still lands on the canonical entry. A name with no alias comes back normalised and
 * otherwise unchanged. Tables are single-hop (the validator rejects chains).
 */
import { curationKey } from './normalize.js';
import aliases from './aliases.json' with { type: 'json' };
import hidden from './hidden.json' with { type: 'json' };

export function makeResolver(aliasTable = {}, hiddenTable = {}) {
  const map = new Map(Object.entries(aliasTable).map(([k, v]) => [curationKey(k), curationKey(v.to)]));
  const hide = new Set(Object.keys(hiddenTable).map(curationKey));
  return {
    resolve: (name) => { const k = curationKey(name); return map.get(k) ?? k; },
    /** The canonical name when `name` is a merged variant, else null. */
    aliasTarget: (name) => map.get(curationKey(name)) ?? null,
    /** True for a merged variant or a hidden name: the app never offers it as an ingredient. */
    isRetired: (name) => { const k = curationKey(name); return map.has(k) || hide.has(k); },
    /** Variant names that merge into `canonical`. */
    variantsOf: (canonical) => { const c = curationKey(canonical); return [...map].filter(([, to]) => to === c).map(([v]) => v); },
    aliases: map,
  };
}

const live = makeResolver(aliases, hidden);

export const resolveIngredient = live.resolve;
export const aliasTarget = live.aliasTarget;
export const isRetiredIngredient = live.isRetired;
export const variantsOf = live.variantsOf;
export const aliasEntries = () => [...live.aliases];
