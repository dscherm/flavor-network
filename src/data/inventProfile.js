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
 *     summary:  string             one sentence describing the chart (see summarize); '' for an empty list
 *   }
 * `nodes` is a Map name → { gnnProbs } or null (then everything is uncounted).
 * Never throws: bad input gives the empty profile.
 */
import { AXES, axisLabel, axisColor, nodeProbs, recipeAxisProfile } from './recipeProfileAnalysis.js';

/** Fewer counted ingredients than this and the summary says there is not enough to go on. */
export const MIN_COUNTED = 2;

/**
 * Describes the chart; never asserts taste and never credits an ingredient (the
 * per-ingredient flavor data is too weak for that): the one or two strongest axes,
 * "no strong signal" when none fires, "not enough" under MIN_COUNTED counted keys.
 */
export function summarize({ axes, counted, noun = 'recipe' }) {
  if (counted.length < MIN_COUNTED) return 'Not enough flavor data in this list to go on yet.';
  const lead = axes.slice(0, 2).map((a) => axisLabel(a).toLowerCase());
  if (!lead.length) return `The chart shows no strong signal for this ${noun}.`;
  return `On the chart, the strongest signal${lead.length > 1 ? 's are' : ' is'} ${lead.join(' and ')}.`;
}

export function buildFlavorProfile(keys, nodes, { noun = 'recipe', minScore = 0.05 } = {}) {
  const list = [...new Set((Array.isArray(keys) ? keys : []).filter((k) => typeof k === 'string' && k))];
  const counted = list.filter((k) => nodeProbs(k, nodes));
  const uncounted = list.filter((k) => !nodeProbs(k, nodes));
  const prof = recipeAxisProfile(counted, nodes);
  const axes = AXES.filter((a) => prof.scores[a] >= minScore).sort((a, b) => prof.scores[b] - prof.scores[a]);
  const summary = list.length ? summarize({ axes, counted, noun }) : '';
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
