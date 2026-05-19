/**
 * GuidedDiscoverySwipe — Track 3, Phase 5 (2026-05-18).
 *
 * Collapsed 2-card Guided Discovery flow:
 *   - Card 1: Ingredient picker (SearchBar + "Suggest one for me" fallback).
 *   - Card 2: <GuidedFilterTypeCard /> (the user picks a single filter type:
 *     taste / aroma / season / cuisine).
 *
 * The 5-card swipe deck (ingredient + season + cuisine + aroma +
 * dietary/meat) from Phase 2 has been retired here. The bubble registry
 * is preserved in `src/data/guidedDiscovery.js` for Build's flow and is
 * intentionally NOT imported in this file — see Track 3 ralplan §2.4
 * verification gate.
 *
 * Cards do NOT auto-advance. Each card commits via an explicit user
 * action ("Got it" on Card 1 once an ingredient is picked; "Got it" on
 * Card 2 once a filter type is picked). On Card 2 commit, the parent's
 * `onComplete({ ingredient, filterType })` fires.
 *
 * Constraint #4: this component owns no global filter state. The only
 * handoff is `onComplete` — the parent (App.jsx) routes that payload
 * into `GuidedDiscoveryResults`.
 */
import { useCallback, useState } from 'react';
import SearchBar from './SearchBar.jsx';
import GuidedFilterTypeCard from './GuidedFilterTypeCard.jsx';

const SUGGESTION_POOL = ['chicken', 'onion', 'basil', 'vanilla'];

export default function GuidedDiscoverySwipe({ ingredients = [], onComplete }) {
  const [ingredient, setIngredient] = useState(null);
  // Two-step flow: 'ingredient' → 'filterType'. Advances only on
  // explicit user "Got it" click — no auto-advance.
  const [step, setStep] = useState('ingredient');

  const handleSuggestRandom = useCallback(() => {
    const pick = SUGGESTION_POOL[Math.floor(Math.random() * SUGGESTION_POOL.length)];
    setIngredient(pick);
  }, []);

  const handleIngredientGotIt = useCallback(() => {
    if (ingredient) setStep('filterType');
  }, [ingredient]);

  const handleFilterTypeCommit = useCallback(
    (filterType) => {
      onComplete?.({ ingredient, filterType });
    },
    [ingredient, onComplete],
  );

  return (
    <div
      className="flex flex-col items-center w-full min-h-screen px-4 pt-8 pb-12"
      style={{ backgroundColor: '#0d1f38' }}
      data-testid="guided-discovery-swipe"
    >
      <div className="w-full max-w-4xl">
        <h1 className="text-2xl sm:text-3xl text-white text-center font-bold tracking-tight mb-2">
          I'm thinking about pairing that…
        </h1>
        <p className="text-sm text-[#9bb6da] text-center mb-6">
          Two quick picks. Tap Got it to advance.
        </p>

        {step === 'ingredient' && (
          <div className="w-full max-w-xl mx-auto">
            <h2 className="text-lg sm:text-xl font-bold text-white text-center mb-4">
              Starts with a specific ingredient
            </h2>
            <div className="rounded-xl border border-cyan-400/40 bg-[#12203b] p-5 sm:p-6 shadow-[0_0_24px_-8px_rgba(34,211,238,0.35)]">
              <p className="text-xs text-gray-400 mb-3 text-center">
                Pick one — we'll start the wheel from here.
              </p>
              <div className="guided-search-inline relative mb-3">
                <SearchBar
                  ingredients={ingredients}
                  onSelect={(name) => setIngredient(name)}
                />
              </div>
              <div className="flex items-center gap-2 justify-center">
                <button
                  type="button"
                  onClick={handleSuggestRandom}
                  className="px-4 py-2 text-xs font-medium rounded-full bg-cyan-500/20 text-cyan-200 border border-cyan-400/40 hover:bg-cyan-500/30 transition-colors"
                >
                  Suggest one for me
                </button>
                {ingredient && (
                  <span className="text-xs text-emerald-300 inline-flex items-center gap-1">
                    ✓ Picked <strong className="text-emerald-200">{ingredient}</strong>
                  </span>
                )}
              </div>
              <style>{`
                .guided-search-inline > div { position: static !important; width: 100% !important; transform: none !important; left: auto !important; top: auto !important; z-index: auto !important; }
              `}</style>
            </div>
            <div className="flex items-center justify-center mt-6">
              <button
                type="button"
                onClick={handleIngredientGotIt}
                disabled={!ingredient}
                aria-disabled={!ingredient ? 'true' : 'false'}
                className="px-8 py-3 rounded-full font-semibold text-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                style={{
                  background: ingredient ? '#60a5fa' : 'rgba(42, 42, 58, 1)',
                  color: ingredient ? '#0a0a0f' : 'rgba(100, 100, 120, 1)',
                }}
              >
                Got it
              </button>
            </div>
          </div>
        )}

        {step === 'filterType' && (
          <GuidedFilterTypeCard onCommit={handleFilterTypeCommit} />
        )}
      </div>
    </div>
  );
}
