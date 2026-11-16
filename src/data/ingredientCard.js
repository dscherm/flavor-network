/**
 * ingredientCard.js — pure helpers for the tap-an-ingredient card (BUILDER-4).
 *
 * resolveCardIngredient turns the text a surface shows ("scallions", "2 oz gin", a builder key) into the
 * canonical node name the Pairing Lab card is drawn from, or null when the app has no card for it.
 * Names go through the curation aliases first, so a merged variant lands on the canonical entry.
 */
import { curationKey } from './curation/normalize.js';
import { resolveIngredient } from './curation/resolveIngredient.js';
import { resolveIngredientName } from './recipePairingMatch.js';
import { egoNeighborhood } from './pairingEgoModel.js';

const NAME_SETS = new WeakMap();

/**
 * @param {string} raw
 * @param {Map|null|undefined} nodes  data.graph.nodes
 * @param {{loose?: boolean}} [opts]  loose also strips amounts and tries the recipe-line matcher
 *                                    (for Cookbook and shopping text); strict is exact name or alias.
 * @returns {string|null}
 */
export function resolveCardIngredient(raw, nodes, { loose = false } = {}) {
  if (!nodes || typeof nodes.has !== 'function') return null;
  const text = String(raw ?? '').trim();
  if (!text) return null;
  const key = curationKey(text);
  if (nodes.has(key)) return key;
  const viaAlias = resolveIngredient(text);
  if (nodes.has(viaAlias)) return viaAlias;
  if (!loose) return null;
  if (!(nodes instanceof Map)) return null;
  let names = NAME_SETS.get(nodes);
  if (!names) { names = new Set(nodes.keys()); NAME_SETS.set(nodes, names); }
  const hit = resolveIngredientName(text, names);
  if (!hit) return null;
  const canon = resolveIngredient(hit);
  return nodes.has(canon) ? canon : (nodes.has(hit) ? hit : null);
}

/** Top partners of one ingredient, strongest first: [{ name, strength }]. */
export function cardPairings(name, data, limit = 8) {
  return egoNeighborhood(name, data, { limit }).map((p) => ({ name: p.name, strength: p.strength }));
}
