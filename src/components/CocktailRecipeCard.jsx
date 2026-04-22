import { useState } from 'react';
import OdorBadge from './OdorBadge.jsx';

/**
 * CocktailRecipeCard — Displays a cocktail recipe with swap functionality.
 * Each ingredient is clickable to enter swap mode, showing ranked alternatives.
 * Supports real-time swap preview with accept/cancel.
 */
export default function CocktailRecipeCard({
  cocktail,
  onSwapIngredient,
  swapIngredient,
  alternatives,
  onSelectAlternative,
  onCancelSwap,
  previewAlt,
  onAcceptSwap,
  bridgeCompounds,
}) {
  const [expandInstructions, setExpandInstructions] = useState(false);

  if (!cocktail) return null;

  return (
    <div className="space-y-2.5">
      {/* Header with image */}
      <div className="flex gap-2.5">
        {cocktail.image && (
          <img
            src={`${cocktail.image}/preview`}
            alt=""
            className="w-16 h-16 rounded-lg object-cover flex-shrink-0"
          />
        )}
        <div className="min-w-0">
          <h3 className="text-sm font-medium text-gray-200 leading-tight">
            {cocktail.name}
          </h3>
          {cocktail.glass && (
            <p className="text-[9px] text-gray-500 mt-0.5">{cocktail.glass}</p>
          )}
          {cocktail.category && (
            <span className="inline-block text-[8px] text-purple-400/80 bg-purple-500/10 rounded px-1.5 py-0.5 mt-1">
              {cocktail.category}
            </span>
          )}
        </div>
      </div>

      {/* Ingredients list */}
      <div>
        <p className="text-[9px] text-gray-600 uppercase tracking-wider mb-1">
          Ingredients
        </p>
        <div className="space-y-0.5">
          {cocktail.ingredients.map((ing, idx) => {
            const isSwapping = swapIngredient === ing.name;
            const isBeingReplaced = previewAlt && swapIngredient === ing.name;
            return (
              <button
                key={`${ing.name}-${idx}`}
                onClick={() => {
                  if (isSwapping) {
                    onCancelSwap?.();
                  } else {
                    onSwapIngredient?.(ing.name);
                  }
                }}
                className={`w-full min-h-[44px] flex items-center justify-between px-2 py-1 rounded text-left text-[11px] transition-all ${
                  isBeingReplaced
                    ? 'bg-green-500/15 border border-green-500/30 text-green-300'
                    : isSwapping
                    ? 'bg-purple-500/20 border border-purple-500/40 text-purple-300'
                    : 'hover:bg-[#1a1a2e] text-gray-300 border border-transparent'
                }`}
              >
                <span className="truncate">
                  {isBeingReplaced ? (
                    <>
                      <span className="line-through text-gray-600 mr-1">{ing.name}</span>
                      <span className="text-green-300">{previewAlt.name}</span>
                    </>
                  ) : (
                    ing.name
                  )}
                </span>
                <span className="text-[9px] text-gray-600 flex-shrink-0 ml-2">
                  {ing.measure || '—'}
                </span>
              </button>
            );
          })}
        </div>
        <p className="text-[8px] text-gray-700 mt-1 italic">
          Click an ingredient to find alternatives
        </p>
      </div>

      {/* Swap alternatives panel */}
      {swapIngredient && (
        <div className="border border-purple-500/20 rounded-lg p-2 bg-purple-500/5">
          <div className="flex items-center justify-between mb-1.5">
            <p className="text-[10px] text-purple-400">
              Swap <span className="font-medium">{swapIngredient}</span>
            </p>
            <button
              onClick={onCancelSwap}
              className="text-[9px] text-gray-600 hover:text-gray-400 transition-colors"
            >
              Cancel
            </button>
          </div>

          {/* Preview accept bar */}
          {previewAlt && (
            <div className="flex items-center justify-between mb-2 px-2 py-1.5 bg-green-500/10 border border-green-500/20 rounded">
              <p className="text-[10px] text-green-300">
                {swapIngredient} → <span className="font-medium">{previewAlt.name}</span>
                <span className="text-[9px] text-gray-500 ml-1">({previewAlt.score}/10)</span>
              </p>
              <button
                onClick={onAcceptSwap}
                className="text-[9px] bg-green-500/20 text-green-300 hover:bg-green-500/30 rounded px-2 py-0.5 transition-colors"
              >
                Accept
              </button>
            </div>
          )}

          {alternatives && alternatives.length > 0 ? (
            <div className="space-y-0.5 max-h-48 overflow-y-auto">
              {alternatives.map((alt) => {
                const isPreview = previewAlt?.name === alt.name;
                return (
                  <button
                    key={alt.name}
                    onClick={() => onSelectAlternative?.(alt.name)}
                    className={`w-full min-h-[44px] flex items-center justify-between px-2 py-1 rounded text-left text-[10px] transition-colors group ${
                      isPreview
                        ? 'bg-green-500/15 border border-green-500/30'
                        : 'hover:bg-purple-500/10 border border-transparent'
                    }`}
                  >
                    <div className="min-w-0 flex-1">
                      <span className={`truncate block ${isPreview ? 'text-green-300' : 'text-gray-300 group-hover:text-purple-300'}`}>
                        {alt.name}
                      </span>
                      <span className="text-[8px] text-gray-600">{alt.category}</span>
                    </div>
                    <div className="flex items-center gap-1 flex-shrink-0 ml-2">
                      <div className="w-12 h-1 bg-[#1a1a2e] rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full"
                          style={{
                            width: `${Math.min(100, alt.score * 10)}%`,
                            backgroundColor: isPreview ? '#4ade80' : alt.score > 7 ? '#a78bfa' : alt.score > 4 ? '#7c3aed50' : '#4c1d9550',
                          }}
                        />
                      </div>
                      <span className="text-[9px] text-gray-500 w-5 text-right">
                        {alt.score}
                      </span>
                      <OdorBadge a={swapIngredient} b={alt.name} bridgeCompounds={bridgeCompounds} compact />
                    </div>
                  </button>
                );
              })}
            </div>
          ) : (
            <p className="text-[9px] text-gray-600 text-center py-2">
              No alternatives found in the network
            </p>
          )}
        </div>
      )}

      {/* Instructions */}
      {cocktail.instructions && (
        <div>
          <button
            onClick={() => setExpandInstructions(!expandInstructions)}
            className="flex items-center gap-1 text-[9px] text-gray-600 uppercase tracking-wider hover:text-gray-400 transition-colors"
          >
            <svg
              className={`w-2.5 h-2.5 transition-transform ${expandInstructions ? 'rotate-90' : ''}`}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
            </svg>
            Instructions
          </button>
          {expandInstructions && (
            <p className="text-[10px] text-gray-400 mt-1 leading-relaxed">
              {cocktail.instructions}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
