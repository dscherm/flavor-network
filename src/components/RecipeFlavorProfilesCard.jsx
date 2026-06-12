/**
 * RecipeFlavorProfilesCard — swipeable per-axis flavor analysis for a recipe.
 *
 * One page per firing flavor axis (taste + aroma): the recipe's score on that
 * axis, what's driving it, a rule-based insight, and model-ranked Boost/Temper
 * ingredient suggestions (tap to add, quantity-prefilled). A final Pairings
 * page lists similar dishes (FM-DIR1) + routes to Cocktail/Sauce Lab.
 *
 * Degrades gracefully: the static analysis (score/drivers/insight) renders even
 * if the model / dish index fail to load — only Boost/Temper + dishes drop out.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  recipeAxisProfile, axisInsight, axisLabel, axisColor, rankByAxisImpact, AXES,
} from '../data/recipeProfileAnalysis.js';
import { loadDirectionsIndex, retrieveDirections } from '../ml/directionsRuntime.js';
import { loadQuantityModel, predictAmountFromCtx } from '../ml/quantityRuntime.js';
import { deriveBowlCuisine } from '../data/deriveBowlCuisine.js';

const FONT = 'Caveat, cursive';

let _modelPromise = null;
function getModel() {
  if (!_modelPromise) {
    _modelPromise = import('../ml/recipeRuntime.js')
      .then((m) => m.loadRecipeModel().then((model) => ({ ...m, model })))
      .catch(() => null);
  }
  return _modelPromise;
}
let _vocabPromise = null;
function loadRecipeVocab() {
  if (!_vocabPromise) {
    _vocabPromise = fetch('/models/recipe_vocab.json').then((r) => (r.ok ? r.json() : null)).then((j) => j?.vocab ?? null).catch(() => null);
  }
  return _vocabPromise;
}

function Chip({ name, delta, onTap }) {
  return (
    <button
      onClick={() => onTap(name)}
      className="flex-shrink-0 inline-flex items-center gap-1 px-2.5 rounded-full border whitespace-nowrap"
      style={{ minHeight: 40, paddingTop: 5, paddingBottom: 5, background: '#fff7d6', borderColor: '#e0c873', color: '#6a5a2a', fontFamily: FONT, fontSize: 16 }}
      title={`Add ${name}`}
    >
      {name}{typeof delta === 'number' ? <span className="text-[10px] text-[#a08a4a]">+{(delta).toFixed(2)}</span> : null}
    </button>
  );
}

export default function RecipeFlavorProfilesCard({ bowlNames = [], nodes, onAdd, onFindCocktail, onFindSauce, onClose }) {
  const { scores, drivers, n } = useMemo(() => recipeAxisProfile(bowlNames, nodes), [bowlNames, nodes]);

  // Firing axes (score above a small floor), strongest first.
  const axes = useMemo(
    () => AXES.filter((a) => scores[a] > 0.08).sort((x, y) => scores[y] - scores[x]),
    [scores],
  );

  const [candidates, setCandidates] = useState([]); // model pool that fits the recipe
  const [dishes, setDishes] = useState([]);
  const quantityCtxRef = useRef(null);

  useEffect(() => {
    let cancelled = false;
    loadQuantityModel().then((ctx) => { if (!cancelled) quantityCtxRef.current = ctx; });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (bowlNames.length === 0 || !nodes) return undefined;
    let cancelled = false;
    getModel().then((rt) => {
      if (cancelled || !rt || !rt.model) return undefined;
      const cuisine = deriveBowlCuisine(bowlNames, nodes, rt.model.meta.cuisine_vocab);
      return rt.suggestIngredients(bowlNames, { cuisine, alpha: 0.3, k: 80 }, rt.model).then((sugg) => {
        if (cancelled) return;
        const bowlSet = new Set(bowlNames);
        setCandidates(sugg.map((s) => s.name).filter((nm) => !bowlSet.has(nm) && nodes.get(nm)));
      });
    }).catch(() => {});
    // dishes
    Promise.all([loadDirectionsIndex(), loadRecipeVocab()]).then(([idx, vocab]) => {
      if (cancelled || !idx || !vocab) return;
      const recs = retrieveDirections(bowlNames, idx, vocab, { k: 4, minOverlap: 2 });
      setDishes(recs.map((r) => r.title));
    }).catch(() => {});
    return () => { cancelled = true; };
  }, [bowlNames, nodes]);

  const [page, setPage] = useState(0);
  const totalPages = axes.length + 1; // + pairings
  const isPairings = page >= axes.length;

  const addWithQty = (name) => {
    const amount = quantityCtxRef.current ? predictAmountFromCtx(name, quantityCtxRef.current) : null;
    if (amount) onAdd?.(name, amount); else onAdd?.(name);
  };

  const axis = axes[page];
  const boost = axis ? rankByAxisImpact(candidates, axis, scores, n, nodes, { mode: 'boost', topN: 4 }) : [];
  const temper = axis ? rankByAxisImpact(candidates, axis, scores, n, nodes, { mode: 'temper', topN: 3 }) : [];

  return (
    <div className="w-full bg-[#fefae0] border-t border-[#c9b99a] rounded-t-xl shadow-2xl" data-testid="flavor-profiles-card">
      <div className="flex items-center justify-between px-4 pt-2 pb-1">
        <span className="text-[11px] uppercase tracking-wider text-[#a09070]" style={{ fontFamily: FONT }}>Flavor Profiles</span>
        <button onClick={onClose} aria-label="Close" className="text-[#a09070] hover:text-[#5a4a2a] px-2 text-lg">×</button>
      </div>

      <div className="px-4 pb-2 min-h-[210px]">
        {n === 0 && <p className="text-base text-[#b8a88a] py-6 text-center" style={{ fontFamily: FONT }}>Add ingredients with flavor data to see profiles.</p>}

        {!isPairings && axis && (
          <div>
            <div className="flex items-baseline gap-2">
              <h3 className="text-2xl capitalize" style={{ fontFamily: FONT, color: axisColor(axis) }}>{axisLabel(axis)}</h3>
              <span className="text-sm text-[#a09070]">{Math.round(scores[axis] * 100)}%</span>
            </div>
            {/* score bar */}
            <div className="h-2 rounded-full mt-1 mb-2" style={{ background: '#eadfc4' }}>
              <div className="h-2 rounded-full" style={{ width: `${Math.min(100, scores[axis] * 100)}%`, background: axisColor(axis) }} />
            </div>
            {drivers[axis]?.length > 0 && (
              <p className="text-sm text-[#7a6a4a] mb-1" style={{ fontFamily: FONT }}>
                Driven by: <span style={{ color: '#3a3428' }}>{drivers[axis].join(', ')}</span>
              </p>
            )}
            <p className="text-base text-[#5a4a2a] mb-2" style={{ fontFamily: FONT }}>{axisInsight(axis, scores[axis])}</p>

            {boost.length > 0 && (
              <div className="mb-1.5">
                <p className="text-[10px] uppercase tracking-wider text-[#a09070] mb-0.5">Boost</p>
                <div className="flex gap-1 overflow-x-auto" style={{ scrollbarWidth: 'none' }}>
                  {boost.map((b) => <Chip key={`b-${b.name}`} name={b.name} delta={b.delta} onTap={addWithQty} />)}
                </div>
              </div>
            )}
            {temper.length > 0 && (
              <div>
                <p className="text-[10px] uppercase tracking-wider text-[#a09070] mb-0.5">Temper / balance</p>
                <div className="flex gap-1 overflow-x-auto" style={{ scrollbarWidth: 'none' }}>
                  {temper.map((t) => <Chip key={`t-${t.name}`} name={t.name} onTap={addWithQty} />)}
                </div>
              </div>
            )}
          </div>
        )}

        {isPairings && (
          <div>
            <h3 className="text-2xl mb-2" style={{ fontFamily: FONT, color: '#3a3428' }}>Pairs well with</h3>
            {dishes.length > 0 && (
              <div className="mb-2">
                <p className="text-[10px] uppercase tracking-wider text-[#a09070] mb-0.5">🍽 Similar dishes</p>
                <ul className="text-base text-[#3a3428]" style={{ fontFamily: FONT }}>
                  {dishes.map((d) => <li key={d}>· {d}</li>)}
                </ul>
              </div>
            )}
            <div className="flex flex-wrap gap-2 mt-1">
              {onFindCocktail && (
                <button onClick={onFindCocktail} className="min-h-[44px] px-4 rounded-full border border-[#c9b99a] bg-[#fde8a0] text-[#7a5a2a]" style={{ fontFamily: FONT, fontSize: 16 }}>🍸 Find cocktails</button>
              )}
              {onFindSauce && (
                <button onClick={onFindSauce} className="min-h-[44px] px-4 rounded-full border border-[#c9b99a] bg-[#ffd0a0] text-[#7a5a2a]" style={{ fontFamily: FONT, fontSize: 16 }}>🥣 Find sauces</button>
              )}
            </div>
          </div>
        )}
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between px-4 pb-3">
          <button onClick={() => setPage((p) => Math.max(0, p - 1))} disabled={page === 0} className="min-h-[44px] px-4 text-[#7a6a4a] disabled:opacity-30" aria-label="Previous">◀</button>
          <span className="text-xs text-[#a09070]">{isPairings ? 'Pairings' : `${page + 1} / ${axes.length}`}</span>
          <button onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))} disabled={page >= totalPages - 1} className="min-h-[44px] px-4 text-[#7a6a4a] disabled:opacity-30" aria-label="Next">▶</button>
        </div>
      )}
    </div>
  );
}
