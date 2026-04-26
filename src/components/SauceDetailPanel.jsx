import { useState } from 'react';

/**
 * SauceDetailPanel — opens when a sauce node is clicked in the
 * Sauce Lab. Two tabs:
 *   - Ingredients: the recipe ingredient list (with measures) plus
 *     instructions/technique, and an "Open in Recipe Lab" button
 *     that loads the sauce's ingredients into the Recipe Lab in
 *     Sauce mode for per-ingredient replacement exploration.
 *   - Similar: top Jaccard-similar sauces within the same family.
 *
 * Mirrors CocktailDetailPanel.jsx so the two labs feel identical.
 */
export default function SauceDetailPanel({
  sauce,
  family,
  similarSauces,
  onSelectSauce,
  onOpenRecipeLab,        // (mode, ingredients[]) => void
  onClose,
}) {
  const [tab, setTab] = useState('ingredients');
  const [collapsed, setCollapsed] = useState(false);

  if (!sauce) return null;

  // Prefer the original {name, measure} array for display so the
  // panel shows quantities, but the codex normalizes a parallel
  // string[] for clean handoff to Recipe Lab.
  const displayIngredients = sauce.ingredientsDetailed?.length
    ? sauce.ingredientsDetailed
    : (sauce.ingredients || []).map(n => ({ name: n, measure: '' }));
  const cleanNames = sauce.ingredients || [];

  function handleOpenInRecipeLab() {
    if (!onOpenRecipeLab) return;
    // Hand off canonical lower-case names so the Recipe Lab's
    // pairings index can resolve them. Dedupe to keep the bowl tidy.
    const seen = new Set();
    const out = [];
    for (const raw of cleanNames) {
      const key = String(raw).toLowerCase().trim();
      if (key && !seen.has(key)) {
        seen.add(key);
        out.push(key);
      }
    }
    onOpenRecipeLab('sauce', out);
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
                  {family?.name}
                  {sauce.cuisine ? ` · ${sauce.cuisine}` : ''}
                  {sauce.isRoot ? ' · MOTHER' : ''}
                </span>
              </div>
              <h2 className="text-lg font-semibold text-white truncate" title={sauce.name}>
                {sauce.name}
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
                    ? 'bg-amber-500/20 text-amber-200 ring-1 ring-amber-500/40'
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
                  {displayIngredients.length === 0 && (
                    <li className="text-[12px] text-gray-500 italic">No ingredients on file.</li>
                  )}
                  {displayIngredients.map((ing, i) => {
                    const name = typeof ing === 'string' ? ing : ing.name;
                    const measure = typeof ing === 'string' ? '' : (ing.measure || '');
                    return (
                      <li key={i} className="flex items-start gap-2 text-[12px] text-gray-200 leading-snug">
                        <span className="text-gray-500 flex-shrink-0">·</span>
                        <span className="flex-1">{name}</span>
                        {measure && (
                          <span className="text-[10px] text-gray-600 flex-shrink-0">{measure}</span>
                        )}
                      </li>
                    );
                  })}
                </ul>
              </section>

              {sauce.instructions && (
                <section className="pt-2 border-t border-[#1e1e2e]">
                  <p className="text-[9px] uppercase tracking-wider text-gray-600 mb-1.5">
                    Technique
                  </p>
                  <p className="text-[11px] text-gray-300 leading-relaxed">
                    {sauce.instructions}
                  </p>
                </section>
              )}

              {sauce.pairsWith && sauce.pairsWith.length > 0 && (
                <section className="pt-2 border-t border-[#1e1e2e]">
                  <p className="text-[9px] uppercase tracking-wider text-gray-600 mb-1.5">
                    Pairs With
                  </p>
                  <div className="flex flex-wrap gap-1">
                    {sauce.pairsWith.map(item => (
                      <span
                        key={item}
                        className="text-[10px] text-amber-200/80 bg-amber-500/10 rounded px-1.5 py-0.5"
                      >
                        {item}
                      </span>
                    ))}
                  </div>
                </section>
              )}

              {/* Hand-off to Recipe Lab — same UX as the cocktail
                  panel: load this sauce's ingredients into the Recipe
                  Lab so the user can explore per-ingredient swaps. */}
              {cleanNames.length > 0 && onOpenRecipeLab && (
                <button
                  onClick={handleOpenInRecipeLab}
                  className="w-full mt-2 px-3 py-2 text-[12px] font-medium text-amber-100 bg-amber-500/20 hover:bg-amber-500/30 ring-1 ring-amber-500/40 hover:ring-amber-400/60 rounded-lg transition-colors flex items-center justify-center gap-2"
                  title="Load this sauce's ingredients into the Recipe Lab and explore replacements per ingredient"
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
                Sauces like this
              </p>
              {similarSauces.length === 0 && (
                <p className="text-[12px] text-gray-500 italic">No close matches in the codex.</p>
              )}
              {similarSauces.map(sim => (
                <button
                  key={sim.name}
                  onClick={() => onSelectSauce(sim.name)}
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
