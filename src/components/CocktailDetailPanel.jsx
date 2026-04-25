import { useState } from 'react';

/**
 * CocktailDetailPanel — opens when a cocktail node is clicked in the
 * Cocktail Lab. Two tabs:
 *   - Ingredients: the recipe text + garnishes, plus a "Recipe Lab"
 *     button that hands the cocktail's ingredients off to the Recipe
 *     Lab where per-ingredient replacement suggestions live.
 *   - Similar: top Jaccard-similar cocktails within the codex.
 */
export default function CocktailDetailPanel({
  cocktail,
  family,
  subclusterLabel,
  similarCocktails,
  onSelectCocktail,
  onOpenRecipeLab,        // (ingredients[]) => void
  onClose,
}) {
  const [tab, setTab] = useState('ingredients');
  const [collapsed, setCollapsed] = useState(false);

  if (!cocktail) return null;

  const ingredients = cocktail.ingredients || [];
  const garnishes = cocktail.garnishes || [];

  function handleOpenInRecipeLab() {
    if (!onOpenRecipeLab) return;
    // Strip measurements/qualifiers to bare ingredient names, dedupe.
    const seen = new Set();
    const out = [];
    for (const raw of ingredients) {
      const cleaned = String(raw)
        .replace(/^[¼½¾⅓⅔⅛⅜⅝⅞0-9][¼½¾⅓⅔⅛⅜⅝⅞0-9.\s/()-]*\s*(oz|ounce|ounces|cl|ml|dash|dashes|drop|drops|tsp|tbsp|teaspoons?|tablespoons?|parts?|cubes?|splash|sprays?|to taste|pinch|jiggers?|cups?)?\s*/i, '')
        .replace(/\([^)]*\)/g, '')
        .replace(/[,;].*$/, '')
        .trim()
        .toLowerCase();
      if (cleaned && !seen.has(cleaned)) {
        seen.add(cleaned);
        out.push(cleaned);
      }
    }
    onOpenRecipeLab('replace', out);
  }

  return (
    <div
      className="fixed top-0 right-0 h-full z-40 flex pointer-events-none"
      style={{
        transform: collapsed ? 'translateX(calc(100% - 32px))' : 'translateX(0)',
        transition: 'transform 240ms ease',
      }}
    >
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

              {/* Hand-off to Recipe Lab — that's where per-ingredient
                  replacement suggestions live now. */}
              {ingredients.length > 0 && onOpenRecipeLab && (
                <button
                  onClick={handleOpenInRecipeLab}
                  className="w-full mt-2 px-3 py-2 text-[12px] font-medium text-purple-100 bg-purple-500/20 hover:bg-purple-500/30 ring-1 ring-purple-500/40 hover:ring-purple-400/60 rounded-lg transition-colors flex items-center justify-center gap-2"
                  title="Load this cocktail's ingredients into the Recipe Lab and explore replacements per ingredient"
                >
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                  </svg>
                  Open in Recipe Lab
                </button>
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
        </div>
      </div>
    </div>
  );
}
