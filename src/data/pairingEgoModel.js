/**
 * pairingEgoModel.js — pure model for the Pairing Lab ego-network
 * (PAIR-LAB-P0). No DOM / canvas / React here: just data in, plain
 * objects out, so the renderer (PairingBoard) and the lab shell
 * (PairingLab) can stay thin and this layer stays unit-testable.
 *
 * The "lenses" ARE the existing categorical axes (aroma / taste /
 * cuisine / season) from categoricalAxes.js — we reuse their bucket
 * classifiers + palettes verbatim rather than inventing new ones. The
 * only genuinely new idea is the *ego* framing: one center ingredient +
 * its strongest partners, grouped/recolored by whichever lens is active.
 */

import { getNeighbors } from './graph.js';
import { CATEGORICAL_AXES } from './categoricalAxes.js';

// Ordered lens set surfaced by the segmented control. 'affinity' is the
// default pure-pairing view (no categorical grouping); the rest map onto
// a CATEGORICAL_AXES key.
export const LENSES = ['affinity', 'aroma', 'taste', 'cuisine', 'season'];

export const LENS_LABELS = {
  affinity: 'Affinity',
  aroma: 'Aroma',
  taste: 'Taste',
  cuisine: 'Cuisine',
  season: 'Season',
};

// Lens → CATEGORICAL_AXES key. 'affinity' has no axis (single group).
// Note the aroma axis is keyed 'aromas' (plural) in categoricalAxes.js.
export const LENS_TO_AXIS = {
  affinity: null,
  aroma: 'aromas',
  taste: 'taste',
  cuisine: 'cuisine',
  season: 'season',
};

const AFFINITY_GROUP_COLOR = '#cbd5e1'; // neutral chalk for the un-lensed view

/**
 * Top pairing partners of `centerName`, strongest first.
 *
 * @param {string} centerName
 * @param {object} data        useProData() payload (reads data.graph.{edges,nodes})
 * @param {{limit?: number}} [opts]
 * @returns {Array<{name: string, strength: number, node: object|null}>}
 */
export function egoNeighborhood(centerName, data, { limit = 12 } = {}) {
  if (!centerName || typeof centerName !== 'string') return [];
  const edges = data?.graph?.edges;
  const nodes = data?.graph?.nodes;
  if (!Array.isArray(edges) || edges.length === 0) return [];

  // getNeighbors already excludes self and sorts by strength desc.
  const raw = getNeighbors(centerName, edges);

  // Dedupe by name (keep the strongest edge if the graph ever has
  // parallel edges), then cap.
  const best = new Map();
  for (const n of raw) {
    const prev = best.get(n.name);
    if (!prev || n.strength > prev.strength) best.set(n.name, n);
  }

  const partners = [...best.values()]
    .sort((a, b) => b.strength - a.strength)
    .slice(0, Math.max(0, limit))
    .map((n) => ({
      name: n.name,
      strength: n.strength,
      node: nodes?.get?.(n.name) || null,
    }));

  return partners;
}

/**
 * Group an ego partner list under a lens.
 *
 * For 'affinity' → a single group ordered by strength.
 * For a categorical lens → one group per non-empty bucket, in the axis's
 * own label order, each carrying its palette color. Partners that don't
 * classify into any bucket are collected into a trailing 'Other' group
 * (kept rather than dropped so the count math stays honest).
 *
 * @param {Array<{name,strength,node}>} partners  from egoNeighborhood()
 * @param {string} lens                            one of LENSES
 * @param {object} [ctx]                           { gnnEntropy, cuisineMap, seasonMap }
 * @returns {Array<{label: string, color: string, members: Array}>}
 */
export function groupByLens(partners, lens, ctx = {}) {
  const list = Array.isArray(partners) ? partners : [];
  if (lens === 'affinity' || !LENS_TO_AXIS[lens]) {
    if (list.length === 0) return [];
    return [{
      label: 'Affinity',
      color: AFFINITY_GROUP_COLOR,
      members: [...list].sort((a, b) => b.strength - a.strength),
    }];
  }

  const axisKey = LENS_TO_AXIS[lens];
  const axis = CATEGORICAL_AXES[axisKey];
  if (!axis) return [];

  const colorByLabel = {};
  axis.labels.forEach((l, i) => { colorByLabel[l] = axis.colors[i]; });

  const membersByLabel = new Map();
  const other = [];
  for (const p of list) {
    const label = p.node ? axis.bucketOf(p.node, ctx) : null;
    if (!label || !colorByLabel[label]) { other.push(p); continue; }
    if (!membersByLabel.has(label)) membersByLabel.set(label, []);
    membersByLabel.get(label).push(p);
  }

  // Emit in the axis's canonical label order, dropping empties, members
  // sorted by strength within each bucket.
  const groups = [];
  for (const label of axis.labels) {
    const members = membersByLabel.get(label);
    if (!members || members.length === 0) continue;
    groups.push({
      label,
      color: colorByLabel[label],
      members: members.sort((a, b) => b.strength - a.strength),
    });
  }
  if (other.length > 0) {
    groups.push({
      label: 'Other',
      color: '#64748b',
      members: other.sort((a, b) => b.strength - a.strength),
    });
  }
  return groups;
}

/**
 * One rule-based sentence describing the partner set under a lens — the
 * "lens-contrast insight line". Returns '' when there are no partners.
 *
 * @param {Array<{name,strength,node}>} partners
 * @param {string} lens
 * @param {object} [ctx]
 * @returns {string}
 */
export function lensInsight(partners, lens, ctx = {}) {
  const list = Array.isArray(partners) ? partners : [];
  const total = list.length;
  if (total === 0) return '';

  if (lens === 'affinity' || !LENS_TO_AXIS[lens]) {
    const top = [...list]
      .sort((a, b) => b.strength - a.strength)
      .slice(0, 3)
      .map((p) => p.name);
    return `${total} partner${total === 1 ? '' : 's'}, led by ${top.join(', ')}.`;
  }

  // Categorical: rank non-'Other' buckets by member count.
  const groups = groupByLens(list, lens, ctx).filter((g) => g.label !== 'Other');
  const lensWord = (LENS_LABELS[lens] || lens).toLowerCase();
  if (groups.length === 0) {
    return `${total} partner${total === 1 ? '' : 's'} — no clear ${lensWord} grouping.`;
  }
  const ranked = [...groups].sort((a, b) => b.members.length - a.members.length);
  const b1 = ranked[0].label;
  const b2 = ranked[1] && ranked[1].members.length > 0 ? ranked[1].label : null;
  const skew = b2 ? `${b1} & ${b2}` : b1;
  return `${total} partner${total === 1 ? '' : 's'} — mostly ${skew} (${lensWord}).`;
}
