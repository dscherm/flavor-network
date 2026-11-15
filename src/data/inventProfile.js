/**
 * inventProfile.js — the flavor profile of an Invent list, drawn like the Recipe
 * Notebook's Flavor Profiles card. Pure: a thin shaping layer over
 * recipeProfileAnalysis.js. A VISUAL AID built from per-ingredient flavor
 * data, not a taste test and not an accuracy claim. TASTE is worked out from each ingredient's curated taste
 * label and hand-tuned strength (flavorTaste.js, flavorStrengths.js); AROMA from the hand-tuned aroma table
 * (flavorAroma.js, flavorAromas.js); the model's per-ingredient values are not read. Taste and aroma are drawn separately, each only when at least half the
 * ingredients (and at least two) have data for it (recipeProfileAnalysis.drawRule); when neither draws there are no bars and the
 * surface shows NO_CHART_LINE.
 *
 * buildFlavorProfile(keys, nodes, { noun = 'recipe', minScore = 0.05, amounts = null, garnish = '' }) →
 *   `amounts` is { key: "2 oz" | { qty, unit } | grams }: both halves are weighted by it (equal weights without).
 *   `garnish` is the recipe's garnish text: a salt, sugar or chili rim in it adds a thin fixed dusting of that taste;
 *   a citrus twist, a mint sprig and the like add a small fixed amount of that ingredient to the AROMA half only.
 *   {
 *     scores:   { axis: number }   all 12 axes (sweet, sour, bitter, salty, umami, heat,
 *                                  odor_fruity ... odor_fatty), 0..1; all 0 when nothing counted
 *     axes:     [axis]             the FIRING axes (score >= minScore), strongest first
 *     bars:     [{ axis, label, color, score }]   same order as `axes`, ready to draw
 *     drivers:  { axis: [key] }    up to 3 ingredients behind each axis
 *     counted:  [key]              keys with real flavor data for taste or aroma (list order)
 *     uncounted:[key]              keys with none (list order)
 *     tasteDrawn, aromaDrawn: bool which halves the draw rule lets through
 *     drawn:    bool               tasteDrawn || aromaDrawn; false means no chart at all
 *     summary:  string             one sentence describing the chart (see summarize); NO_CHART_LINE when
 *                                  nothing draws; '' for an empty list
 *   }
 * `nodes` is a Map name → { taste } or null (taste labels only; aroma needs no node).
 * Never throws: bad input gives the empty profile.
 */
import { AXES, axisLabel, axisColor, nodeProbs, recipeAxisProfileWeighted, NO_CHART_LINE } from './recipeProfileAnalysis.js';
import { garnishTasteLines } from './flavorStrengths.js';
import { garnishAromaLines } from './flavorAromas.js';

/** Fewer counted ingredients than this and the summary says there is not enough to go on. */
export const MIN_COUNTED = 2;

/**
 * Describes the chart; never asserts taste and never credits an ingredient (the
 * per-ingredient flavor data is too weak for that): the one or two strongest axes,
 * "no strong signal" when none fires, "not enough" under MIN_COUNTED counted keys.
 */
export function summarize({ axes, counted, noun = 'recipe', drawn = true }) {
  if (!drawn || counted.length < MIN_COUNTED) return NO_CHART_LINE;
  const lead = axes.slice(0, 2).map((a) => axisLabel(a).toLowerCase());
  if (!lead.length) return `The chart shows no strong signal for this ${noun}.`;
  return `On the chart, the strongest signal${lead.length > 1 ? 's are' : ' is'} ${lead.join(' and ')}.`;
}

export function buildFlavorProfile(keys, nodes, { noun = 'recipe', minScore = 0.05, amounts = null, garnish = '' } = {}) {
  const list = [...new Set((Array.isArray(keys) ? keys : []).filter((k) => typeof k === 'string' && k))];
  const counted = list.filter((k) => nodeProbs(k, nodes));
  const uncounted = list.filter((k) => !nodeProbs(k, nodes));
  // A salt, sugar or chili rim sits in the garnish text, not in a line: it adds a thin, fixed dusting (flavorStrengths.js).
  const rim = garnishTasteLines(garnish).map((r) => ({ ingredient: r.key, amount: r.amount }));
  const prof = recipeAxisProfileWeighted([...list.map((k) => ({ ingredient: k, amount: amounts?.[k] ?? null })), ...rim], nodes, { aromaExtras: garnishAromaLines(garnish) });
  const axes = AXES.filter((a) => prof.scores[a] >= minScore).sort((a, b) => prof.scores[b] - prof.scores[a]);
  const summary = list.length ? summarize({ axes, counted, noun, drawn: prof.drawn }) : '';
  return {
    scores: prof.scores,
    axes,
    bars: axes.map((axis) => ({ axis, label: axisLabel(axis), color: axisColor(axis), score: prof.scores[axis] })),
    drivers: prof.drivers,
    counted,
    uncounted,
    tasteDrawn: prof.tasteDrawn,
    aromaDrawn: prof.aromaDrawn,
    drawn: prof.drawn,
    summary,
  };
}
