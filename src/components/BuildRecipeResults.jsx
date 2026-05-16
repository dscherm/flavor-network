/**
 * BuildRecipeResults — Phase 5 (pipeline 2026-05-16).
 *
 * Build path's results page. Three modes depending on the bubbleStack:
 *
 *   1. Cocktail card picked → render a banner + auto-redirect-ish CTA
 *      to Cocktail Lab.
 *   2. Sauce card picked → same for Sauce Lab.
 *   3. Otherwise → MultiAxisRadarStack + "Open in: Cocktail / Sauce /
 *      Recipes" buttons.
 *
 * Each lab-bridge button calls `onOpenLab(labKey, externalFilter)`
 * where `externalFilter` is derived from the bubble stack so the
 * destination lab can apply pill filters on mount.
 */
import { useMemo } from 'react';
import MultiAxisRadarStack from './MultiAxisRadarStack.jsx';

function summarizeBubble(b) {
  if (!b) return '';
  const v = b.value;
  if (typeof v === 'string') return v;
  if (v && typeof v === 'object') {
    if (Array.isArray(v.ingredients)) return v.ingredients.join(', ');
    if (v.ingredient) return v.ingredient;
    if (v.cuisineBucket) return v.cuisineBucket;
    if (v.aromaBucket) return v.aromaBucket;
    if (Array.isArray(v.dietary)) return v.dietary.join(', ');
  }
  return v === true ? 'on' : '';
}

function deriveExternalFilter(bubbleStack) {
  const out = {};
  for (const b of bubbleStack) {
    if (b.key === 'cuisine' && b.value?.cuisineBucket) out.cuisine = b.value.cuisineBucket;
    if (b.key === 'aroma' && b.value?.aromaBucket) out.aroma = b.value.aromaBucket;
    if (b.key === 'season' && typeof b.value === 'string') out.season = b.value;
    if (b.key === 'meat' && typeof b.value === 'string') out.family = b.value;
    if (b.key === 'ingredient' && Array.isArray(b.value?.ingredients)) {
      out.ingredients = [...b.value.ingredients];
    }
  }
  return out;
}

export default function BuildRecipeResults({
  bubbleStack = [],
  ctx = null,
  onBackToCards,
  onOpenLab,        // (labKey: 'cocktail' | 'sauce' | 'recipes-3d', externalFilter) => void
  onAxisSelect,     // (axis) => void — tour entry like Guided
}) {
  const hasCocktail = bubbleStack.some((b) => b.key === 'cocktail');
  const hasSauce = bubbleStack.some((b) => b.key === 'sauce');
  const ingredients = useMemo(() => {
    const ing = bubbleStack.find((b) => b.key === 'ingredient');
    if (Array.isArray(ing?.value?.ingredients)) return ing.value.ingredients;
    return [];
  }, [bubbleStack]);
  const focalName = ingredients[0] || null;
  const externalFilter = useMemo(() => deriveExternalFilter(bubbleStack), [bubbleStack]);

  return (
    <div
      className="flex flex-col items-center w-full min-h-screen px-4 pt-8 pb-12"
      style={{ backgroundColor: '#0d1f38' }}
      data-testid="build-recipe-results"
    >
      <div className="w-full max-w-5xl">
        <h1 className="text-2xl sm:text-3xl text-white text-center font-bold mb-2">
          Build — Results
        </h1>
        <p className="text-sm text-[#9bb6da] text-center mb-5">
          Tap a Pairing Radar to tour the network, or jump straight into a Lab below.
        </p>

        {/* Bubble-stack chip strip */}
        <div
          className="flex flex-wrap justify-center gap-2 mb-5 min-h-[2rem]"
          aria-label="Selected bubbles"
        >
          {bubbleStack.length === 0 ? (
            <span className="text-[11px] text-gray-500 italic">(no selections — return to the cards)</span>
          ) : (
            bubbleStack.map((b) => (
              <span
                key={b.key}
                className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-emerald-500/20 text-emerald-100 border border-emerald-400/40 min-h-[28px]"
              >
                <span className="truncate max-w-[220px]">
                  {b.label}{summarizeBubble(b) ? `: ${summarizeBubble(b)}` : ''}
                </span>
              </span>
            ))
          )}
        </div>

        {/* Cocktail / Sauce direct bridge — short-circuit results page */}
        {(hasCocktail || hasSauce) && (
          <div className="mb-6 rounded-xl border border-cyan-400/40 bg-[#0a1428]/80 p-5 text-center">
            <p className="text-sm text-[#bfd5f0] mb-3">
              You chose to build a <strong className="text-white">{hasCocktail ? 'cocktail' : 'sauce'}</strong>.
              Open the relevant lab with your filters applied:
            </p>
            <button
              type="button"
              onClick={() => onOpenLab?.(hasCocktail ? 'cocktail' : 'sauce', externalFilter)}
              className="px-5 py-2.5 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-white font-medium border border-cyan-300 transition-colors"
            >
              Open the {hasCocktail ? 'Cocktail' : 'Sauce'} Lab →
            </button>
          </div>
        )}

        {/* Radar stack — shown only when not direct-bridging */}
        {!hasCocktail && !hasSauce && ctx?.graph?.nodes && (
          <div className="mb-6">
            {focalName ? (
              <MultiAxisRadarStack
                ingredients={ingredients}
                nodes={ctx.graph.nodes}
                focalName={focalName}
                onAxisSelect={(axis) => onAxisSelect?.(axis)}
              />
            ) : (
              <p className="text-center text-sm text-gray-400 py-10">
                Add at least one ingredient on the previous screen to see Pairing Radars.
              </p>
            )}
          </div>
        )}

        {/* Lab routing buttons (always visible — provides escape hatches) */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-6">
          <button
            type="button"
            onClick={() => onOpenLab?.('cocktail', externalFilter)}
            className="px-4 py-3 rounded-lg bg-[#12203b] hover:bg-[#16284a] border border-violet-400/40 text-violet-200 text-sm font-medium transition-colors"
          >
            Open in Cocktail Lab →
          </button>
          <button
            type="button"
            onClick={() => onOpenLab?.('sauce', externalFilter)}
            className="px-4 py-3 rounded-lg bg-[#12203b] hover:bg-[#16284a] border border-amber-400/40 text-amber-200 text-sm font-medium transition-colors"
          >
            Open in Sauce Lab →
          </button>
          <button
            type="button"
            onClick={() => onOpenLab?.('notebook', externalFilter)}
            className="px-4 py-3 rounded-lg bg-[#12203b] hover:bg-[#16284a] border border-emerald-400/40 text-emerald-200 text-sm font-medium transition-colors"
          >
            Open in Recipe Notebook →
          </button>
        </div>

        {/* Back button */}
        <div className="flex justify-center">
          <button
            type="button"
            onClick={onBackToCards}
            className="px-5 py-2 rounded-lg bg-[#1a2a4a] hover:bg-[#22345a] text-gray-200 border border-[#2c4470] text-sm font-medium transition-colors"
          >
            ← Back to cards
          </button>
        </div>
      </div>
    </div>
  );
}
