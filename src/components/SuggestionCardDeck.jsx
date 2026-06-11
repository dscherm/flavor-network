/**
 * SuggestionCardDeck — swipeable card presentation for ingredient suggestions
 * (replaces the chip popout for ✨ Suggest / add and ✨ Smart swaps / replace).
 *
 * Each card shows a candidate ingredient + a before→after radar of how it
 * shifts the recipe's flavor profile (FM-P2 set-completion model picks
 * candidates that fit the recipe; recipeProfileAnalysis computes the delta).
 * Add prefills a quantity (FM-Q2). Replace performs an in-place swap.
 *
 * Lazy + null-safe: if the model can't load, the deck shows nothing and the
 * caller can fall back. Pure candidate math is in recipeProfileAnalysis.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { recipeAxisProfile, profileDelta, topMovers, nodeProbs } from '../data/recipeProfileAnalysis.js';
import ProfileDeltaRadar, { DeltaSummary } from './ProfileDeltaRadar.jsx';
import { loadQuantityModel, predictAmountFromCtx } from '../ml/quantityRuntime.js';

let _modelPromise = null;
function getModel() {
  if (!_modelPromise) {
    _modelPromise = import('../ml/recipeRuntime.js')
      .then((m) => m.loadRecipeModel().then((model) => ({ ...m, model })))
      .catch(() => null);
  }
  return _modelPromise;
}

function profileCosine(a, b) {
  if (!a || !b) return 0;
  let dot = 0, na = 0, nb = 0;
  for (const k of Object.keys(a)) { const v = a[k] || 0; na += v * v; if (k in b) dot += v * (b[k] || 0); }
  for (const k of Object.keys(b)) { const v = b[k] || 0; nb += v * v; }
  return (na && nb) ? dot / (Math.sqrt(na) * Math.sqrt(nb)) : 0;
}

export default function SuggestionCardDeck({
  mode = 'add', ingredient = null, bowlNames = [], nodes, scopeFilter = null,
  onAdd, onSwap, onClose,
}) {
  const { scores, n } = useMemo(() => recipeAxisProfile(bowlNames, nodes), [bowlNames, nodes]);
  const [cards, setCards] = useState([]);
  const [idx, setIdx] = useState(0);
  const [loading, setLoading] = useState(true);

  const quantityCtxRef = useRef(null);
  useEffect(() => {
    let cancelled = false;
    loadQuantityModel().then((ctx) => { if (!cancelled) quantityCtxRef.current = ctx; });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    setIdx(0);
    setLoading(true);
    const observed = mode === 'replace' ? bowlNames.filter((x) => x !== ingredient) : bowlNames;
    if (observed.length === 0 || !nodes) { setCards([]); setLoading(false); return undefined; }

    const focalProbs = mode === 'replace' ? nodeProbs(ingredient, nodes) : null;
    const focalCat = mode === 'replace' ? nodes.get(ingredient)?.category : null;
    let cancelled = false;

    getModel().then((rt) => {
      if (cancelled) return undefined;
      if (!rt || !rt.model) { setCards([]); setLoading(false); return undefined; }
      const { deriveBowlCuisine } = rt;
      const cuisine = deriveBowlCuisine ? deriveBowlCuisine(bowlNames, nodes, rt.model.meta.cuisine_vocab) : null;
      return rt.suggestIngredients(observed, { cuisine, k: mode === 'replace' ? 40 : 16 }, rt.model).then((sugg) => {
        if (cancelled) return;
        const exclude = new Set(bowlNames);
        const out = [];
        for (const s of sugg) {
          if (exclude.has(s.name)) continue;
          if (scopeFilter && !scopeFilter.has(s.name.toLowerCase())) continue;
          const node = nodes.get(s.name);
          if (!node) continue;
          // Delta: add = candidate added; replace = focal swapped out for candidate.
          let delta;
          if (mode === 'replace') {
            if (focalProbs && node.gnnProbs) {
              const cos = profileCosine(focalProbs, node.gnnProbs);
              const sameCat = focalCat && node.category === focalCat;
              if (!sameCat && cos < 0.85) continue; // keep plausible substitutes only
            }
            const swapped = recipeAxisProfile([...observed, s.name], nodes).scores;
            delta = {};
            for (const a of Object.keys(scores)) delta[a] = (swapped[a] || 0) - (scores[a] || 0);
          } else {
            delta = profileDelta(s.name, scores, n, nodes) || {};
          }
          out.push({ name: s.name, delta, movers: topMovers(delta, 3) });
          if (out.length >= 12) break;
        }
        setCards(out);
        setLoading(false);
      });
    }).catch(() => { if (!cancelled) { setCards([]); setLoading(false); } });
    return () => { cancelled = true; };
  }, [mode, ingredient, bowlNames, nodes, scopeFilter]); // eslint-disable-line react-hooks/exhaustive-deps

  const card = cards[idx];
  const commit = () => {
    if (!card) return;
    if (mode === 'replace') { onSwap?.(ingredient, card.name); return; }
    const amount = quantityCtxRef.current ? predictAmountFromCtx(card.name, quantityCtxRef.current) : null;
    if (amount) onAdd?.(card.name, amount); else onAdd?.(card.name);
  };

  return (
    <div className="w-full bg-[#fefae0] border-t border-[#c9b99a] rounded-t-xl shadow-2xl" data-testid={`suggestion-deck-${mode}`}>
      <div className="flex items-center justify-between px-4 pt-2 pb-1">
        <span className="text-[11px] uppercase tracking-wider text-[#a09070]" style={{ fontFamily: 'Caveat, cursive' }}>
          {mode === 'replace' ? `✨ Smart swaps for ${ingredient}` : '✨ Smart suggestions'}
        </span>
        <button onClick={onClose} aria-label="Close" className="text-[#a09070] hover:text-[#5a4a2a] px-2 text-lg">×</button>
      </div>

      <div className="px-4 pb-3 min-h-[230px] flex flex-col items-center justify-center">
        {loading && <p className="text-base text-[#b8a88a]" style={{ fontFamily: 'Caveat, cursive' }}>Finding suggestions…</p>}
        {!loading && !card && (
          <p className="text-base text-[#b8a88a]" style={{ fontFamily: 'Caveat, cursive' }}>No suggestions for this recipe yet.</p>
        )}
        {card && (
          <>
            <h3 className="text-2xl mb-1" style={{ fontFamily: 'Caveat, cursive', color: '#3a3428' }}>{card.name}</h3>
            <ProfileDeltaRadar before={scores} delta={card.delta} movers={card.movers} />
            <div className="mt-1 mb-2"><DeltaSummary movers={card.movers} /></div>
            <button
              onClick={commit}
              data-testid="deck-commit"
              className="min-h-[44px] px-6 rounded-full border border-[#c9b99a] bg-[#fff7d6] text-[#6a5a2a] hover:bg-[#ffefb8]"
              style={{ fontFamily: 'Caveat, cursive', fontSize: 18 }}
            >
              {mode === 'replace' ? `Swap → ${card.name}` : `+ Add ${card.name}`}
            </button>
          </>
        )}
      </div>

      {cards.length > 1 && (
        <div className="flex items-center justify-between px-4 pb-3">
          <button
            onClick={() => setIdx((i) => Math.max(0, i - 1))}
            disabled={idx === 0}
            className="min-h-[44px] px-4 text-[#7a6a4a] disabled:opacity-30"
            aria-label="Previous suggestion"
          >◀</button>
          <span className="text-xs text-[#a09070]">{idx + 1} / {cards.length}</span>
          <button
            onClick={() => setIdx((i) => Math.min(cards.length - 1, i + 1))}
            disabled={idx >= cards.length - 1}
            className="min-h-[44px] px-4 text-[#7a6a4a] disabled:opacity-30"
            aria-label="Next suggestion"
          >▶</button>
        </div>
      )}
    </div>
  );
}
