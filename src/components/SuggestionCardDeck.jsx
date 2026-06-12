/**
 * SuggestionCardDeck — smart ingredient suggestions (add) / substitutions
 * (replace) for a recipe, shown as a flavor-profile-aware panel.
 *
 * Top: the recipe's current flavor-profile radar (context). Below: a scrollable
 * list of many ranked suggestions, each with a "sweet ▲ green ▼" delta of how
 * it shifts the recipe's profile, and an Add/Swap action.
 *
 * Smartness (FM-P2 set-completion model):
 *  - CUISINE-CONDITIONED — the bowl's dominant cuisine drives suggestions
 *    (pad thai → Thai → cilantro/lime/scallion, not salt/flour).
 *  - POPULARITY-DISCOUNTED — α·baseline subtraction demotes global staples.
 *  - REPLACE = same-category substitutes ranked by recipe fit (rice noodle →
 *    other noodles/rice, not condiments).
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { recipeAxisProfile, profileDelta, topMovers, nodeProbs } from '../data/recipeProfileAnalysis.js';
import { deriveBowlCuisine } from '../data/deriveBowlCuisine.js';
import ProfileDeltaRadar, { DeltaSummary } from './ProfileDeltaRadar.jsx';
import { loadQuantityModel, predictAmountFromCtx } from '../ml/quantityRuntime.js';

const ALPHA = 0.3; // popularity-discount strength (mild — high α promotes junk)

let _modelPromise = null;
function getModel() {
  if (!_modelPromise) {
    _modelPromise = import('../ml/recipeRuntime.js')
      .then((m) => m.loadRecipeModel().then((model) => ({ ...m, model })))
      .catch(() => null);
  }
  return _modelPromise;
}

export default function SuggestionCardDeck({
  mode = 'add', ingredient = null, bowlNames = [], nodes, scopeFilter = null,
  onAdd, onSwap, onClose,
}) {
  const { scores, n } = useMemo(() => recipeAxisProfile(bowlNames, nodes), [bowlNames, nodes]);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  const quantityCtxRef = useRef(null);
  useEffect(() => {
    let c = false;
    loadQuantityModel().then((ctx) => { if (!c) quantityCtxRef.current = ctx; });
    return () => { c = true; };
  }, []);

  useEffect(() => {
    setLoading(true);
    const observed = mode === 'replace' ? bowlNames.filter((x) => x !== ingredient) : bowlNames;
    if (observed.length === 0 || !nodes) { setItems([]); setLoading(false); return undefined; }
    const bowlSet = new Set(bowlNames);
    let cancelled = false;

    getModel().then((rt) => {
      if (cancelled || !rt || !rt.model) { setItems([]); setLoading(false); return undefined; }
      const cuisine = deriveBowlCuisine(bowlNames, nodes, rt.model.meta.cuisine_vocab);

      // Replace → restrict to same-category substitutes (rice noodle → grains).
      let candidateNames = null;
      if (mode === 'replace') {
        const focalCat = nodes.get(ingredient)?.category;
        if (focalCat) {
          candidateNames = [];
          for (const [nm, node] of nodes) {
            if (node?.category === focalCat && nm !== ingredient && !bowlSet.has(nm)) candidateNames.push(nm);
          }
        }
      }

      return rt.suggestIngredients(observed, { cuisine, alpha: ALPHA, k: 60, candidateNames }, rt.model)
        .then((sugg) => {
          if (cancelled) return;
          const out = [];
          for (const s of sugg) {
            if (bowlSet.has(s.name) || s.name === ingredient) continue;
            if (scopeFilter && !scopeFilter.has(s.name.toLowerCase())) continue;
            const node = nodes.get(s.name);
            if (!node) continue;
            let delta;
            if (mode === 'replace') {
              const swapped = recipeAxisProfile([...observed, s.name], nodes).scores;
              delta = {};
              for (const a of Object.keys(scores)) delta[a] = (swapped[a] || 0) - (scores[a] || 0);
            } else {
              delta = profileDelta(s.name, scores, n, nodes) || {};
            }
            out.push({ name: s.name, delta, movers: topMovers(delta, 3) });
            if (out.length >= 18) break;
          }
          setItems(out);
          setLoading(false);
        });
    }).catch(() => { if (!cancelled) { setItems([]); setLoading(false); } });
    return () => { cancelled = true; };
  }, [mode, ingredient, bowlNames, nodes, scopeFilter]); // eslint-disable-line react-hooks/exhaustive-deps

  const commit = (name) => {
    if (mode === 'replace') { onSwap?.(ingredient, name); return; }
    const amount = quantityCtxRef.current ? predictAmountFromCtx(name, quantityCtxRef.current) : null;
    if (amount) onAdd?.(name, amount); else onAdd?.(name);
  };

  return (
    <div className="w-full bg-[#fefae0] border-t border-[#c9b99a] rounded-t-xl shadow-2xl" style={{ maxHeight: '62vh', display: 'flex', flexDirection: 'column' }} data-testid={`suggestion-deck-${mode}`}>
      <div className="flex items-center justify-between px-4 pt-2.5 pb-1 flex-shrink-0">
        <span className="text-[12px] uppercase tracking-wider text-[#7a6a4a]" style={{ fontFamily: 'Caveat, cursive' }}>
          {mode === 'replace' ? `⇄ Smart swaps for ${ingredient}` : '✨ Smart suggestions'}
        </span>
        <button onClick={onClose} aria-label="Close" className="text-[#a09070] hover:text-[#5a4a2a] px-2 text-xl">×</button>
      </div>

      {/* recipe flavor-profile radar (context) */}
      {n > 0 && (
        <div className="flex items-center gap-2 px-4 pb-1 flex-shrink-0 border-b border-[#e8dcc0]">
          <ProfileDeltaRadar before={scores} delta={null} size={92} />
          <p className="text-[11px] text-[#a09070]" style={{ fontFamily: 'Caveat, cursive', fontSize: 13 }}>
            Your recipe&apos;s flavor profile. Each suggestion shows how it would shift it.
          </p>
        </div>
      )}

      <div className="overflow-y-auto px-2 py-2" style={{ flex: 1 }}>
        {loading && <p className="text-center text-base text-[#b8a88a] py-6" style={{ fontFamily: 'Caveat, cursive' }}>Finding smart suggestions…</p>}
        {!loading && items.length === 0 && <p className="text-center text-base text-[#b8a88a] py-6" style={{ fontFamily: 'Caveat, cursive' }}>No suggestions for this recipe yet.</p>}
        <ul className="space-y-1">
          {items.map((it) => (
            <li key={it.name}>
              <div className="w-full flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-[#f0e8d0]">
                <span className="flex-1 truncate text-base" style={{ fontFamily: 'Caveat, cursive', color: '#3a3428' }}>{it.name}</span>
                <DeltaSummary movers={it.movers} />
                <button
                  onClick={() => commit(it.name)}
                  data-testid="deck-commit"
                  className="flex-shrink-0 min-h-[36px] px-3 rounded-full border border-[#e0c873] bg-[#fff7d6] text-[#6a5a2a] hover:bg-[#ffefb8]"
                  style={{ fontFamily: 'Caveat, cursive', fontSize: 15 }}
                >
                  {mode === 'replace' ? 'Swap' : '+ Add'}
                </button>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
