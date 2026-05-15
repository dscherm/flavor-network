/**
 * recipeFocus.js — auto-infer recipe proportions + focal-ingredient
 * detection for the Recipe Lab flavor wheel.
 *
 * Two responsibilities:
 *   1. inferMassShares() — given a list of ingredient names (and
 *      optional user-provided quantities), return Map<name, share>
 *      summing to 1.0. Uses role-weighted defaults when quantities are
 *      missing.
 *   2. detectFocus() — given the same input, return
 *      { mode: 'centered' | 'balanced', focal?: string, scores: Map }.
 *      Centered mode triggers when one ingredient has focus_score >=
 *      0.5; otherwise balanced.
 *
 * The focus_score formula:
 *   focus_score(i) = 0.5 * mass_share(i)
 *                  + 0.3 * role_factor(role(i))
 *                  + 0.2 * pairing_density(i, recipe)
 *
 * Why these weights:
 *   - mass dominates because a 500g protein vs 5g herb is obviously
 *     the recipe's center of gravity
 *   - role_factor amplifies role hierarchy (protein > vegetable >
 *     spice) so a single-protein recipe reliably triggers Centered
 *   - pairing_density adds a "how much does this anchor the others"
 *     signal, computed against the dataset's pairings
 */

import { getGeneralRole } from './ingredientRoles.js';

// Role → focus_score role_factor. Distinct from MASS_DEFAULT_SHARE
// below; role_factor expresses "how recipe-central is this role".
const ROLE_FACTOR = {
  protein:   1.0,
  starch:    0.8,
  vegetable: 0.7,
  fruit:     0.7,
  dairy:     0.5,
  fat:       0.5,
  acid:      0.4,
  sweetener: 0.4,
  aromatic:  0.3,
  herb:      0.3,
  spice:     0.2,
  thickener: 0.2,
  salt:      0.1,
  other:     0.5,
};

// Role → default mass-share when ONLY one ingredient of that role is
// in the recipe. Used to seed inferMassShares(); we renormalize after
// summing across the actual roles present so the shares sum to 1.0.
const MASS_DEFAULT_BY_ROLE = {
  protein:   0.50,
  starch:    0.25,
  vegetable: 0.15,
  fruit:     0.10,
  dairy:     0.05,
  fat:       0.05,
  acid:      0.02,
  sweetener: 0.02,
  aromatic:  0.02,
  herb:      0.015,
  spice:     0.01,
  thickener: 0.01,
  salt:      0.005,
  other:     0.05,
};

const CENTERED_THRESHOLD = 0.5;

/**
 * @param {string} name
 * @param {object} node  optional graph node (gives access to clusterId
 *                       for the cluster-fallback role classifier)
 * @returns {string} role
 */
export function roleOfIngredient(name, node) {
  return getGeneralRole(name, node);
}

/**
 * inferMassShares — return Map<ingredientName, share in [0,1]>.
 *
 * Resolution order:
 *   1. Caller-provided quantities (Map<name, gramsOrUnit>) — used
 *      directly, normalized to sum=1.
 *   2. Role-based defaults — each ingredient's role looked up against
 *      MASS_DEFAULT_BY_ROLE, distributed if multiple ingredients share
 *      a role, then renormalized.
 *
 * @param {string[]} names
 * @param {object} opts
 * @param {Map<string,number>=} opts.quantities  caller-provided
 * @param {Map<string,any>=}    opts.nodes       graph-node lookup for
 *                                               cluster-fallback role
 * @returns {Map<string, number>}
 */
export function inferMassShares(names, opts = {}) {
  const result = new Map();
  if (!Array.isArray(names) || names.length === 0) return result;

  // Path 1 — caller-provided quantities.
  if (opts.quantities && opts.quantities.size > 0) {
    let total = 0;
    for (const n of names) {
      const q = opts.quantities.get(n) || 0;
      total += Math.max(0, q);
    }
    if (total > 0) {
      for (const n of names) {
        result.set(n, Math.max(0, opts.quantities.get(n) || 0) / total);
      }
      return result;
    }
    // total === 0 — fall through to role inference
  }

  // Path 2 — role-based defaults.
  // First count how many ingredients per role; distribute share evenly.
  const roleByName = new Map();
  const countByRole = new Map();
  for (const n of names) {
    const role = roleOfIngredient(n, opts.nodes?.get?.(n));
    roleByName.set(n, role);
    countByRole.set(role, (countByRole.get(role) || 0) + 1);
  }

  let runningTotal = 0;
  for (const n of names) {
    const role = roleByName.get(n);
    const roleShare = MASS_DEFAULT_BY_ROLE[role] ?? MASS_DEFAULT_BY_ROLE.other;
    const perIngredient = roleShare / Math.max(1, countByRole.get(role));
    result.set(n, perIngredient);
    runningTotal += perIngredient;
  }

  // Renormalize so the recipe's mass shares sum to 1.
  if (runningTotal > 0) {
    for (const [k, v] of result) result.set(k, v / runningTotal);
  }
  return result;
}

/**
 * pairingDensity — fraction of the OTHER ingredients in the recipe
 * that pick this ingredient as a top-K affinity neighbor. Higher
 * density = this ingredient is the recipe's flavor anchor (others
 * orbit it).
 *
 * @param {string} name
 * @param {string[]} allNames
 * @param {Map<string, Array<{name:string, strength:number}>>=} neighborIndex
 *        optional pre-built neighbor lookup. When omitted, density
 *        falls back to 0.5 (neutral).
 * @param {number} K
 * @returns {number} in [0, 1]
 */
export function pairingDensity(name, allNames, neighborIndex, K = 10) {
  if (!neighborIndex || allNames.length <= 1) return 0.5;
  const others = allNames.filter((x) => x !== name);
  if (others.length === 0) return 0.5;
  let anchored = 0;
  for (const other of others) {
    const topK = (neighborIndex.get(other) || []).slice(0, K);
    if (topK.some((n) => n.name === name)) anchored++;
  }
  return anchored / others.length;
}

/**
 * focusScore — combined heuristic for "how central is this ingredient
 * to the recipe?" Returns a value in approximately [0, 1].
 *
 * focus_score = 0.5 * mass_share
 *             + 0.3 * role_factor
 *             + 0.2 * pairing_density
 */
export function focusScore({
  name,
  massShare,
  role,
  allNames = [name],
  neighborIndex = null,
}) {
  const ms = Math.max(0, Math.min(1, Number(massShare) || 0));
  const rf = ROLE_FACTOR[role] ?? ROLE_FACTOR.other;
  const pd = pairingDensity(name, allNames, neighborIndex);
  return 0.5 * ms + 0.3 * rf + 0.2 * pd;
}

/**
 * detectFocus — full pipeline. Given recipe ingredients (+ optional
 * quantities + optional neighbor index), return the focal-mode
 * decision.
 *
 * @returns {{
 *   mode: 'centered' | 'balanced',
 *   focal: string | null,
 *   scores: Map<string, number>,
 *   massShares: Map<string, number>,
 *   roles: Map<string, string>,
 * }}
 */
export function detectFocus(names, opts = {}) {
  const massShares = inferMassShares(names, opts);
  const roles = new Map();
  for (const n of names) {
    roles.set(n, roleOfIngredient(n, opts.nodes?.get?.(n)));
  }

  const scores = new Map();
  let bestName = null;
  let bestScore = -Infinity;
  for (const n of names) {
    const s = focusScore({
      name: n,
      massShare: massShares.get(n) || 0,
      role: roles.get(n),
      allNames: names,
      neighborIndex: opts.neighborIndex || null,
    });
    scores.set(n, s);
    if (s > bestScore) {
      bestScore = s;
      bestName = n;
    }
  }

  const mode = bestScore >= CENTERED_THRESHOLD ? 'centered' : 'balanced';
  return {
    mode,
    focal: mode === 'centered' ? bestName : null,
    scores,
    massShares,
    roles,
  };
}

// Re-exports for testing.
export const _ROLE_FACTOR = ROLE_FACTOR;
export const _MASS_DEFAULT_BY_ROLE = MASS_DEFAULT_BY_ROLE;
export const _CENTERED_THRESHOLD = CENTERED_THRESHOLD;
