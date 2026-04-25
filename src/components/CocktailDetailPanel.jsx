import { useState, useMemo } from 'react';
import { normalizeIngredient } from '../data/cocktailCodex.js';

/**
 * CocktailDetailPanel — opens when a cocktail node is clicked in the
 * Cocktail Lab. Three tabs:
 *   - Ingredients:   the recipe text + garnishes
 *   - Cocktails like this: top Jaccard-similar cocktails (within family + cross-family)
 *   - Swap an ingredient: for each ingredient, top ProData pairings to
 *     suggest substitutions for experimentation
 */
export default function CocktailDetailPanel({
  cocktail,                  // codex node {name, ingredients, garnishes, family_id, subcluster_id, isRoot, ...}
  family,                    // {id, name, color}
  subclusterLabel,           // string
  similarCocktails,          // [{ name, similarity, family_id, color }]
  ingredientPairings,        // Map<normalizedIngredient, Array<{name, strength}>> — top neighbors from ProData
  onSelectCocktail,          // (name) => void
  onClose,
}) {
  const [tab, setTab] = useState('ingredients');
  const [collapsed, setCollapsed] = useState(false);

  const ingredients = cocktail?.ingredients || [];
  const garnishes = cocktail?.garnishes || [];

  const swapEntries = useMemo(() => {
    if (!ingredientPairings) return [];
    return ingredients
      .map(raw => ({
        original: raw,
        normalized: normalizeIngredient(raw),
      }))
      .filter(e => e.normalized && ingredientPairings.has(e.normalized))
      .map(e => ({
        ...e,
        pairings: (ingredientPairings.get(e.normalized) || []).slice(0, 5),
      }))
      .filter(e => e.pairings.length > 0);
  }, [ingredients, ingredientPairings]);

  if (!cocktail) return null;

  return (
    <div
      className="fixed top-0 right-0 h-full z-40 flex pointer-events-none"
      style={{
        transform: collapsed ? 'translateX(calc(100% - 32px))' : 'translateX(0)',
        transition: 'transform 240ms ease',
      }}
    >
      {/* Snap tab on the left edge so the panel docks like the existing IngredientPanel */}
      <button
        onClick={() => setCollapsed(c => !c)}
        className="self-center bg-[#12121a]/90 backdrop-blur-md border border-[#1e1e2e] border-r-0 rounded-l-lg px-1.5 py-3 pointer-events-auto"
        title={collapsed ? 'Expand details' : 'Collapse details'}
      >
        <span className="text-[10px] uppercase tracking-widest font-medium text-gray-400" style={{ writingMode: 'vertical-rl' }}>
          {collapsed ? 'Details' : 'Hide'}
        </span>
      </button>

      <div className="w-80 h-full bg-[#0c0c14]/95 backdrop-blur-md border-l border-[#1e1e2e] overflow-y-auto pointer-events-auto">
        {/* Header */}
        <div className="sticky top-0 z-10 bg-[#0c0c14]/95 backdrop-blur-md border-b border-[#1e1e2e] p-4">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <span
                  className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                  style={{ backgroundColor: family?.color || '#888' }}
                />
                <span className="text-[10px] uppercase tracking-wider text-gray-400 truncate">
                  {family?.name}{subclusterLabel ? ` · ${subclusterLabel}` : ''}
                  {cocktail.isRoot ? ' · ROOT' : ''}
                </span>
              </div>
              <h2 className="text-lg font-semibold text-white truncate" title={cocktail.name}>
                {cocktail.name}
              </h2>
            </div>
            <button
              onClick={onClose}
              className="text-gray-500 hover:text-red-400 transition-colors flex-shrink-0"
              title="Close"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Tabs */}
          <div className="flex gap-1 mt-3">
            {[
              { id: 'ingredients', label: 'Ingredients' },
              { id: 'similar',     label: 'Similar' },
              { id: 'swap',        label: 'Swap' },
            ].map(t => (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={`flex-1 text-[11px] py-1.5 rounded transition-colors ${
                  tab === t.id
                    ? 'bg-purple-500/20 text-purple-200 ring-1 ring-purple-500/40'
                    : 'text-gray-500 hover:text-gray-300 hover:bg-white/5'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>

        {/* Body */}
        <div className="p-4 space-y-4">
          {tab === 'ingredients' && (
            <div className="space-y-3">
              <section>
                <p className="text-[9px] uppercase tracking-wider text-gray-600 mb-1.5">
                  Ingredients
                </p>
                <ul className="space-y-1">
                  {ingredients.length === 0 && (
                    <li className="text-[12px] text-gray-500 italic">No ingredients on file.</li>
                  )}
                  {ingredients.map((line, i) => (
                    <li key={i} className="text-[12px] text-gray-200 leading-snug">
                      <span className="text-gray-500 mr-1.5">·</span>{line}
                    </li>
                  ))}
                </ul>
              </section>
              {garnishes.length > 0 && (
                <section className="pt-2 border-t border-[#1e1e2e]">
                  <p className="text-[9px] uppercase tracking-wider text-gray-600 mb-1.5">
                    Garnish
                  </p>
                  <ul className="space-y-1">
                    {garnishes.map((g, i) => (
                      <li key={i} className="text-[12px] text-amber-200/80 leading-snug">
                        <span className="text-amber-700 mr-1.5">✦</span>{g}
                      </li>
                    ))}
                  </ul>
                </section>
              )}
            </div>
          )}

          {tab === 'similar' && (
            <div className="space-y-2">
              <p className="text-[9px] uppercase tracking-wider text-gray-600 mb-1">
                Cocktails like this
              </p>
              {similarCocktails.length === 0 && (
                <p className="text-[12px] text-gray-500 italic">No close matches in the codex.</p>
              )}
              {similarCocktails.map(sim => (
                <button
                  key={sim.name}
                  onClick={() => onSelectCocktail(sim.name)}
                  className="w-full text-left flex items-center justify-between gap-2 px-2 py-1.5 rounded hover:bg-white/5 transition-colors"
                >
                  <span className="flex items-center gap-2 min-w-0">
                    <span
                      className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                      style={{ backgroundColor: sim.color }}
                    />
                    <span className="text-[12px] text-gray-200 truncate">{sim.name}</span>
                  </span>
                  <span className="text-[10px] text-gray-500 flex-shrink-0">
                    {Math.round(sim.similarity * 100)}%
                  </span>
                </button>
              ))}
            </div>
          )}

          {tab === 'swap' && (
            <div className="space-y-3">
              <p className="text-[10px] text-gray-500 leading-snug">
                For each ingredient, top ProData pairings — swap one in to
                experiment with a new flavor profile.
              </p>
              {swapEntries.length === 0 && (
                <p className="text-[12px] text-gray-500 italic">
                  No pairings found for this recipe's ingredients in the dataset.
                </p>
              )}
              {swapEntries.map(entry => (
                <section key={entry.normalized}>
                  <p className="text-[11px] text-gray-300 mb-1">
                    <span className="text-gray-500">Replace:</span> {entry.original}
                  </p>
                  <ul className="pl-3 space-y-0.5 border-l border-[#1e1e2e]">
                    {entry.pairings.map(p => (
                      <li key={p.name} className="text-[11px] text-gray-400 flex items-center justify-between">
                        <span className="truncate">{p.name}</span>
                        <span className="text-[9px] text-gray-600 ml-2">
                          {p.strength.toFixed(2)}
                        </span>
                      </li>
                    ))}
                  </ul>
                </section>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
