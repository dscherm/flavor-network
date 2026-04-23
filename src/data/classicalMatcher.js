/**
 * classicalMatcher — given a list of user ingredients and a lab mode,
 * find the deepest classical recipe their build matches, plus the
 * root-of-family ancestor and the closest partial match.
 *
 * Matching: ingredient-name containment (lowercased substring), with
 * a completeness ratio = covered / total key_ingredients. A match is
 * "complete" at ≥ 0.8. Below 0.8, the closest partial node is still
 * returned as a directional hint ("this looks like a...").
 *
 * Returns:
 *   {
 *     root:        { name, family, description } | null
 *     complete:    { name, description, path, ratio } | null   // ratio ≥ 0.8
 *     partial:     { name, description, path, ratio } | null   // 0.5 ≤ ratio < 0.8
 *     depth:       number  // 0=root, 1=daughter, etc.
 *     allMatches:  [{ name, path, ratio }]  // sorted by ratio desc
 *   }
 */

import { SAUCE_TREE, COCKTAIL_CODEX_TREE } from './classicalTree.js';

const COMPLETE_THRESHOLD = 0.8;
const PARTIAL_THRESHOLD = 0.5;

function normalizeIngredient(s) {
  return (s || '').toLowerCase().trim();
}

function ingredientMatches(recipeIngredients, key) {
  const k = normalizeIngredient(key);
  for (const ri of recipeIngredients) {
    const r = normalizeIngredient(ri);
    if (r === k) return true;
    // substring match either direction so "lemon juice" matches "lemon"
    if (r.includes(k) || k.includes(r)) return true;
  }
  return false;
}

function scoreNode(node, recipeIngredients) {
  const keys = node.key_ingredients || [];
  if (keys.length === 0) return 0;
  let hits = 0;
  for (const k of keys) {
    if (ingredientMatches(recipeIngredients, k)) hits++;
  }
  return hits / keys.length;
}

function walk(tree, recipeIngredients, path = []) {
  const results = [];
  for (const node of tree) {
    const ratio = scoreNode(node, recipeIngredients);
    const currentPath = [...path, node.name];
    results.push({
      name: node.name,
      description: node.description,
      family: node.family,
      technique: node.technique,
      key_ingredients: node.key_ingredients,
      path: currentPath,
      ratio,
      depth: currentPath.length - 1,
      rootName: currentPath[0],
    });
    if (Array.isArray(node.children) && node.children.length > 0) {
      results.push(...walk(node.children, recipeIngredients, currentPath));
    }
  }
  return results;
}

export function matchClassical(labMode, recipeIngredients) {
  const tree = labMode === 'cocktail' ? COCKTAIL_CODEX_TREE
             : labMode === 'sauce'    ? SAUCE_TREE
             : null;
  if (!tree || !recipeIngredients || recipeIngredients.length === 0) {
    return { root: null, complete: null, partial: null, depth: 0, allMatches: [] };
  }

  const all = walk(tree, recipeIngredients);
  // Ranking:
  //   1. Higher ratio wins (fraction of this node's keys the recipe covers).
  //   2. On tied ratios, prefer the node whose key-set is LARGER because
  //      more-specific descriptions (Espagnole = 7 keys) beat generic
  //      parents (Demi-glace's 4-key subset) when the user supplied
  //      enough ingredients to satisfy the larger set.
  //   3. Finally break with depth desc so Mornay still beats Béchamel
  //      when their key-counts are equal and user added cheese.
  all.sort((a, b) => {
    if (Math.abs(a.ratio - b.ratio) > 0.01) return b.ratio - a.ratio;
    const aKeys = a.key_ingredients?.length ?? 0;
    const bKeys = b.key_ingredients?.length ?? 0;
    if (aKeys !== bKeys) return bKeys - aKeys;
    return b.depth - a.depth;
  });

  const best = all[0];
  const complete = best && best.ratio >= COMPLETE_THRESHOLD ? best : null;
  const partial = !complete && best && best.ratio >= PARTIAL_THRESHOLD ? best : null;

  // Root = first-level ancestor of whichever match we return (prefer complete).
  const anchor = complete || partial || best;
  const rootName = anchor?.rootName;
  const root = rootName ? { name: rootName, family: tree.find(r => r.name === rootName)?.family } : null;

  return {
    root,
    complete,
    partial,
    depth: anchor?.depth ?? 0,
    allMatches: all.slice(0, 6),
  };
}

export function findInTree(labMode, name) {
  const tree = labMode === 'cocktail' ? COCKTAIL_CODEX_TREE
             : labMode === 'sauce'    ? SAUCE_TREE
             : null;
  if (!tree) return null;
  const all = walk(tree, []);
  return all.find(x => x.name === name) || null;
}
