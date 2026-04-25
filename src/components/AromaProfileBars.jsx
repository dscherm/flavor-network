import { useMemo } from 'react';
import { scoreRecipeAroma, AROMA_LABELS, AROMA_COLORS } from '../data/recipeScoring.js';

const FONT_FAMILY = 'Caveat, cursive';

/**
 * AromaProfileBars — Notebook-themed aroma profile for the Recipe Lab.
 * Replaces the octagonal TasteWheel; aroma is the dominant flavor
 * channel and the GNN's odor heads are reasonably calibrated, so the
 * 6-D aroma profile is a more honest "what does this combo smell like"
 * read than the old 8-axis taste octagon.
 *
 * `onTapAroma(odorKey)` fires when the user taps a bar — used to
 * route the SuggestionDrawer to a chips-filtered-by-that-aroma view
 * (mirrors the wheel's old onTapAxis behaviour).
 */
export default function AromaProfileBars({ ingredients = [], nodes, onTapAroma }) {
  const aroma = useMemo(() => {
    if (!nodes || ingredients.length === 0) return null;
    const data = ingredients
      .map(name => nodes.get(name))
      .filter(Boolean);
    return scoreRecipeAroma(data);
  }, [ingredients, nodes]);

  const entries = useMemo(() => {
    const ordered = Object.keys(AROMA_LABELS).map((key, i) => ({
      key,
      label: AROMA_LABELS[key],
      color: AROMA_COLORS[key],
      p: aroma?.profile?.[i] || 0,
    }));
    ordered.sort((a, b) => b.p - a.p);
    return ordered;
  }, [aroma]);

  return (
    <div
      className="w-full max-w-md mx-auto px-4 py-3"
      style={{
        backgroundColor: '#fefae0',
        borderBottom: '1px solid #e8dcc0',
      }}
    >
      <div className="flex items-baseline justify-between mb-2">
        <h3 className="text-base" style={{ fontFamily: FONT_FAMILY, color: '#5a4a2a' }}>
          Aroma Profile
        </h3>
        {aroma?.hasSignal && aroma.confidence < 1 && (
          <span className="text-[10px]" style={{ fontFamily: FONT_FAMILY, color: '#a09070' }}>
            {Math.round(aroma.confidence * 100)}% covered
          </span>
        )}
      </div>

      {(!aroma || !aroma.hasSignal) && (
        <p
          className="text-sm py-2 text-center"
          style={{ fontFamily: FONT_FAMILY, color: '#a09070' }}
        >
          {ingredients.length === 0
            ? 'Add ingredients to see the aroma profile'
            : 'No aroma data for these ingredients yet'}
        </p>
      )}

      {aroma?.hasSignal && (
        <div className="space-y-1.5">
          {entries.map(e => {
            const tappable = !!onTapAroma;
            const Wrapper = tappable ? 'button' : 'div';
            return (
              <Wrapper
                key={e.key}
                {...(tappable ? {
                  type: 'button',
                  onClick: () => onTapAroma(e.key),
                  title: `Show ingredients with strong ${e.label} aroma`,
                } : {})}
                className={`w-full flex items-center gap-2 ${tappable ? 'rounded-sm hover:bg-[#f0e8d0]/60 active:bg-[#f0e8d0] transition-colors px-1 py-0.5 -mx-1' : ''}`}
              >
                <span
                  className="w-14 text-xs capitalize text-left"
                  style={{ fontFamily: FONT_FAMILY, color: '#5a4a2a' }}
                >
                  {e.label}
                </span>
                <div
                  className="flex-1 h-3 rounded-sm overflow-hidden"
                  style={{ background: '#f0e8d0', border: '1px solid #d8cca8' }}
                >
                  <div
                    className="h-full transition-all duration-500"
                    style={{
                      width: `${Math.max(0, Math.min(1, e.p)) * 100}%`,
                      background: e.color,
                      opacity: 0.85,
                    }}
                  />
                </div>
                <span
                  className="w-8 text-right text-[11px] tabular-nums"
                  style={{ fontFamily: FONT_FAMILY, color: '#7a6a4a' }}
                >
                  {Math.round(e.p * 100)}%
                </span>
              </Wrapper>
            );
          })}
        </div>
      )}
    </div>
  );
}
