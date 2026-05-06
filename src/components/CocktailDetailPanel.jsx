import { useState } from 'react';
import { normalizeIngredient } from '../data/cocktailCodex.js';

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
  // v2-only (optional): engineering metadata, cross-family bridges,
  // explicit ingredient + recipe overrides. Pre-v2 callers pass none
  // of these and the panel renders identically to its prior shape.
  crossFamilyCousins,
  engineering,
  ingredients: ingredientsProp,
  recipe,
  onSelectCocktail,
  onOpenRecipeLab,        // (ingredients[]) => void
  onClose,
}) {
  const [tab, setTab] = useState('ingredients');
  const [collapsed, setCollapsed] = useState(false);

  if (!cocktail) return null;

  // v2 may pass ingredients_raw objects [{raw, name, amount_ml, ...}]
  // or raw strings. Normalize to displayable strings.
  const rawIngredients = ingredientsProp || cocktail.ingredients || [];
  const ingredients = rawIngredients.map((line) => {
    if (typeof line === 'string') return line;
    if (line && typeof line === 'object') {
      return line.raw || `${line.measure || ''} ${line.name || ''}`.trim();
    }
    return '';
  }).filter(Boolean);
  const garnishes = cocktail.garnishes || [];
  const hasEngineering = engineering && (engineering.build || engineering.glass || engineering.ice || engineering.aeration);
  const hasBridges = Array.isArray(crossFamilyCousins) && crossFamilyCousins.length > 0;

  function handleOpenInRecipeLab() {
    if (!onOpenRecipeLab) return;
    // normalizeIngredient strips measurements ("0.75 oz") AND qualifier
    // words ("Fresh", "Cold", "Dry") so the bowl sees canonical names
    // that match the ProData pairings index. The inline regex used to
    // miss qualifier-only forms ("Fresh lemon juice") and stranded the
    // bowl with strings that had zero pairings.
    const seen = new Set();
    const out = [];
    for (const raw of ingredients) {
      const cleaned = normalizeIngredient(raw);
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

      <div className="w-[88vw] max-w-[360px] sm:w-80 sm:max-w-none h-full bg-[#0c0c14]/95 backdrop-blur-md border-l border-[#1e1e2e] overflow-y-auto pointer-events-auto">
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
              {/* v2 only: family Root narrative line */}
              {family?.root && family.root !== cocktail.name && (
                <p className="text-[10px] text-gray-500 mt-1 truncate">
                  Root of {family.name}: <span className="text-gray-300">{family.root}</span>
                </p>
              )}
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
              ...(hasEngineering ? [{ id: 'engineering', label: 'Method' }] : []),
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
            <div className="space-y-3">
              <section>
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
              </section>

              {/* v2 only: cross-family bridges */}
              {hasBridges && (
                <section className="pt-2 border-t border-[#1e1e2e]">
                  <p className="text-[9px] uppercase tracking-wider text-gray-600 mb-1.5">
                    Bridges to other families
                  </p>
                  <p className="text-[10px] text-gray-500 italic mb-1.5">
                    Outside this family but chemically close.
                  </p>
                  {crossFamilyCousins.map(b => (
                    <button
                      key={b.name}
                      onClick={() => onSelectCocktail(b.name)}
                      className="w-full text-left flex items-center justify-between gap-2 px-2 py-1.5 rounded hover:bg-white/5 transition-colors"
                    >
                      <span className="flex items-center gap-2 min-w-0">
                        <span
                          className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                          style={{ backgroundColor: b.color }}
                        />
                        <span className="text-[12px] text-gray-200 truncate">{b.name}</span>
                        <span className="text-[9px] text-gray-500 truncate">{b.family_name}</span>
                      </span>
                      <span className="text-[10px] text-gray-500 flex-shrink-0">
                        {Math.round(b.similarity * 100)}%
                      </span>
                    </button>
                  ))}
                </section>
              )}
            </div>
          )}

          {tab === 'engineering' && hasEngineering && (
            <div className="space-y-3">
              <p className="text-[9px] uppercase tracking-wider text-gray-600 mb-1">
                Method
              </p>
              <dl className="grid grid-cols-2 gap-2 text-[12px]">
                {engineering.build && (
                  <>
                    <dt className="text-gray-500">Build</dt>
                    <dd className="text-gray-200 capitalize">{engineering.build}</dd>
                  </>
                )}
                {engineering.glass && (
                  <>
                    <dt className="text-gray-500">Glass</dt>
                    <dd className="text-gray-200 capitalize">{engineering.glass}</dd>
                  </>
                )}
                {engineering.ice && (
                  <>
                    <dt className="text-gray-500">Ice</dt>
                    <dd className="text-gray-200 capitalize">{engineering.ice}</dd>
                  </>
                )}
                {engineering.aeration && (
                  <>
                    <dt className="text-gray-500">Aeration</dt>
                    <dd className="text-gray-200 capitalize">{engineering.aeration}</dd>
                  </>
                )}
              </dl>
              {recipe && (
                <section className="pt-2 border-t border-[#1e1e2e]">
                  <p className="text-[9px] uppercase tracking-wider text-gray-600 mb-1.5">
                    Instructions
                  </p>
                  <p className="text-[12px] text-gray-300 leading-relaxed whitespace-pre-line">
                    {recipe}
                  </p>
                </section>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
