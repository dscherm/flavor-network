/**
 * inventProfile.js — the flavor profile of an Invent list, drawn like the Recipe
 * Notebook's Flavor Profiles card. Pure: a thin shaping layer over
 * recipeProfileAnalysis.js. A VISUAL AID built from per-ingredient flavor data
 * (gnnProbs), not a taste test and not an accuracy claim.
 *
 * buildFlavorProfile(keys, nodes, { noun = 'recipe', minScore = 0.05 }) →
 *   {
 *     scores:   { axis: number }   all 11 axes (sweet, sour, bitter, salty, umami,
 *                                  odor_fruity ... odor_fatty), 0..1; all 0 when nothing counted
 *     axes:     [axis]             the FIRING axes (score >= minScore), strongest first
 *     bars:     [{ axis, label, color, score }]   same order as `axes`, ready to draw
 *     drivers:  { axis: [key] }    up to 3 ingredients behind each axis
 *     counted:  [key]              keys that had flavor data (list order)
 *     uncounted:[key]              keys with none (list order)
 *     summary:  string             one modest sentence (see summarize); '' for an empty list
 *   }
 * `nodes` is a Map name → { gnnProbs } or null (then everything is uncounted).
 * Never throws: bad input gives the empty profile.
 */
import { AXES, axisLabel, axisColor, nodeProbs, recipeAxisProfile } from './recipeProfileAnalysis.js';

/** An ingredient is named as the source of an axis only when its OWN score there is at least this. */
export const ATTRIBUTION_MIN = 0.6;
/** Fewer counted ingredients than this and the summary says there is not enough to go on. */
export const MIN_COUNTED = 2;

/**
 * A modest sentence. The per-ingredient flavor data is weak, so: name the leading one
 * or two axes, and credit an ingredient only where its own score on that axis is at
 * least ATTRIBUTION_MIN (then "mostly from lime", at most two). Under MIN_COUNTED
 * counted ingredients there is nothing to say.
 */
export function summarize({ axes, scores, counted, nodes, noun = 'recipe' }) {
  if (counted.length < MIN_COUNTED) return 'Not enough flavor data in this list to go on yet.';
  const lead = axes.slice(0, 2);
  if (!lead.length) return `No single flavor stands out in this ${noun}.`;
  const part = (axis) => {
    const strong = counted
      .map((k) => ({ k, v: nodeProbs(k, nodes)?.[axis] || 0 }))
      .filter((x) => x.v >= ATTRIBUTION_MIN)
      .sort((x, y) => y.v - x.v)
      .slice(0, 2)
      .map((x) => x.k);
    const name = axisLabel(axis).toLowerCase();
    return strong.length ? `${name} (mostly from ${strong.join(' and ')})` : name;
  };
  return `This ${noun} leans ${lead.map(part).join(' and ')}.`;
}

export function buildFlavorProfile(keys, nodes, { noun = 'recipe', minScore = 0.05 } = {}) {
  const list = [...new Set((Array.isArray(keys) ? keys : []).filter((k) => typeof k === 'string' && k))];
  const counted = list.filter((k) => nodeProbs(k, nodes));
  const uncounted = list.filter((k) => !nodeProbs(k, nodes));
  const prof = recipeAxisProfile(counted, nodes);
  const axes = AXES.filter((a) => prof.scores[a] >= minScore).sort((a, b) => prof.scores[b] - prof.scores[a]);
  const summary = list.length ? summarize({ axes, scores: prof.scores, counted, nodes, noun }) : '';
  return {
    scores: prof.scores,
    axes,
    bars: axes.map((axis) => ({ axis, label: axisLabel(axis), color: axisColor(axis), score: prof.scores[axis] })),
    drivers: prof.drivers,
    counted,
    uncounted,
    summary,
  };
}
