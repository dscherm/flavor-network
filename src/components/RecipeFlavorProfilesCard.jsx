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
import { computeRecipeAroma, rankByAromaSimilarity } from '../data/recipeAromaSimilarity.js';
import { recipeTakesSauce } from '../data/sauceRecommendation.js';

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

// Cocktail / sauce item lists for aroma matching on the Pairings page —
// same data + normalization App.jsx uses for handleFindCocktail/Sauce.
let _cocktailItemsPromise = null;
function loadCocktailItems() {
  if (!_cocktailItemsPromise) {
    _cocktailItemsPromise = fetch(`${import.meta.env.BASE_URL}data/cocktail_codex_v2.json`)
      .then((r) => { if (!r.ok) throw new Error('cocktail fetch failed'); return r.json(); })
      .then((j) => (j?.cocktails || []).map((c) => ({
        ...c,
        ingredients: (c.ingredients_raw || []).map((r) => (typeof r === 'string' ? r : (r?.raw || r?.name || ''))).filter(Boolean),
      })))
      // Don't cache a network failure — reset so a later mount can retry.
      .catch(() => { _cocktailItemsPromise = null; return null; });
  }
  return _cocktailItemsPromise;
}
let _sauceItemsPromise = null;
function loadSauceItems() {
  if (!_sauceItemsPromise) {
    _sauceItemsPromise = fetch(`${import.meta.env.BASE_URL}data/sauce_augment.json`)
      .then((r) => { if (!r.ok) throw new Error('sauce fetch failed'); return r.json(); })
      .then((j) => (j?.sauces || []).map((s) => ({
        ...s,
        ingredients: (s.ingredients || []).map((i) => (typeof i === 'string' ? i : (i?.name || ''))).filter(Boolean),
      })))
      .catch(() => { _sauceItemsPromise = null; return null; });
  }
  return _sauceItemsPromise;
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

export default function RecipeFlavorProfilesCard({ bowlNames = [], nodes, recipeType = null, onAdd, onFindCocktail, onFindSauce, onClose }) {
  const { scores, drivers, n } = useMemo(() => recipeAxisProfile(bowlNames, nodes), [bowlNames, nodes]);

  // Firing axes (score above a small floor), strongest first.
  const axes = useMemo(
    () => AXES.filter((a) => scores[a] > 0.08).sort((x, y) => scores[y] - scores[x]),
    [scores],
  );

  const [candidates, setCandidates] = useState([]); // model pool that fits the recipe
  const [dishes, setDishes] = useState([]);
  const [cocktailMatches, setCocktailMatches] = useState([]); // aroma-matched cocktail names
  const [sauceMatches, setSauceMatches] = useState([]);       // aroma-matched sauce names
  const quantityCtxRef = useRef(null);
  const swipeStartRef = useRef(null); // touch-swipe between carousel pages

  // computeRecipeAroma / rankByAromaSimilarity want a plain {name: node} lookup
  // (node.gnnProbs), but `nodes` is a Map — convert once per nodes change.
  const nodesObj = useMemo(() => (nodes ? Object.fromEntries(nodes) : null), [nodes]);

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
    // aroma-matched cocktail + sauce NAMES for the Pairings page
    const recipeVec = nodesObj ? computeRecipeAroma(bowlNames, nodesObj) : null;
    if (recipeVec) {
      loadCocktailItems().then((items) => {
        if (cancelled || !items) return;
        setCocktailMatches(rankByAromaSimilarity(recipeVec, items, nodesObj, 4));
      }).catch(() => {});
      loadSauceItems().then((items) => {
        if (cancelled || !items) return;
        setSauceMatches(rankByAromaSimilarity(recipeVec, items, nodesObj, 4));
      }).catch(() => {});
    } else {
      setCocktailMatches([]);
      setSauceMatches([]);
    }
    return () => { cancelled = true; };
  }, [bowlNames, nodes, nodesObj]);

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

  // Touch-swipe between carousel pages (left = next page, right = previous).
  const goPage = (delta) => setPage((p) => Math.max(0, Math.min(totalPages - 1, p + delta)));
  const onTouchStart = (e) => {
    const t = e.touches?.[0];
    if (t) swipeStartRef.current = { x: t.clientX, y: t.clientY };
  };
  const onTouchEnd = (e) => {
    const s = swipeStartRef.current;
    swipeStartRef.current = null;
    const t = e.changedTouches?.[0];
    if (!s || !t) return;
    const dx = t.clientX - s.x;
    const dy = t.clientY - s.y;
    if (Math.abs(dx) < 50 || Math.abs(dx) < Math.abs(dy)) return; // ignore vertical scrolls
    goPage(dx < 0 ? 1 : -1);
  };

  return (
    <div
      className="w-full bg-[#fefae0] border-t border-[#c9b99a] rounded-t-xl shadow-2xl"
      data-testid="flavor-profiles-card"
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
    >
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
            {/* 🍸 Cocktails — aroma-matched names; tap deep-links to the
                Cocktail Lab. Falls back to the generic button if no matches. */}
            {onFindCocktail && (
              <div className="mb-2">
                <p className="text-[10px] uppercase tracking-wider text-[#a09070] mb-0.5">🍸 Cocktails</p>
                {cocktailMatches.length > 0 ? (
                  <div className="flex flex-wrap gap-1.5" data-testid="pairings-cocktail-names">
                    {cocktailMatches.map(({ item, similarity }) => (
                      <button
                        key={item.name}
                        onClick={onFindCocktail}
                        className="min-h-[40px] px-3 rounded-full border border-[#c9b99a] bg-[#fde8a0] text-[#7a5a2a]"
                        style={{ fontFamily: FONT, fontSize: 16 }}
                        title={`${Math.round((similarity || 0) * 100)}% aroma match — open in Cocktail Lab`}
                      >
                        {item.name}
                      </button>
                    ))}
                  </div>
                ) : (
                  <button onClick={onFindCocktail} className="min-h-[44px] px-4 rounded-full border border-[#c9b99a] bg-[#fde8a0] text-[#7a5a2a]" style={{ fontFamily: FONT, fontSize: 16 }}>🍸 Find cocktails</button>
                )}
              </div>
            )}

            {/* 🥣 Sauces — gated by recipeTakesSauce; aroma-matched names. */}
            {onFindSauce && recipeTakesSauce(recipeType) && (
              <div>
                <p className="text-[10px] uppercase tracking-wider text-[#a09070] mb-0.5">🥣 Sauces</p>
                {sauceMatches.length > 0 ? (
                  <div className="flex flex-wrap gap-1.5" data-testid="pairings-sauce-names">
                    {sauceMatches.map(({ item, similarity }) => (
                      <button
                        key={item.name}
                        onClick={onFindSauce}
                        className="min-h-[40px] px-3 rounded-full border border-[#c9b99a] bg-[#ffd0a0] text-[#7a5a2a]"
                        style={{ fontFamily: FONT, fontSize: 16 }}
                        title={`${Math.round((similarity || 0) * 100)}% aroma match — open in Sauce Lab`}
                      >
                        {item.name}
                      </button>
                    ))}
                  </div>
                ) : (
                  <button onClick={onFindSauce} className="min-h-[44px] px-4 rounded-full border border-[#c9b99a] bg-[#ffd0a0] text-[#7a5a2a]" style={{ fontFamily: FONT, fontSize: 16 }}>🥣 Find sauces</button>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between px-4 pb-3">
          <button onClick={() => goPage(-1)} disabled={page === 0} className="min-h-[44px] px-4 text-[#7a6a4a] disabled:opacity-30" aria-label="Previous">◀</button>
          <div className="flex items-center gap-1.5" data-testid="profiles-page-dots" role="tablist" aria-label="Flavor Profiles pages">
            {Array.from({ length: totalPages }).map((_, i) => (
              <button
                key={i}
                onClick={() => setPage(i)}
                role="tab"
                aria-selected={i === page}
                aria-label={i === axes.length ? 'Pairings page' : `Axis page ${i + 1}`}
                className="rounded-full transition-all"
                style={{
                  width: i === page ? 9 : 7,
                  height: i === page ? 9 : 7,
                  background: i === page ? '#7a6a4a' : '#d8cba8',
                }}
              />
            ))}
          </div>
          <button onClick={() => goPage(1)} disabled={page >= totalPages - 1} className="min-h-[44px] px-4 text-[#7a6a4a] disabled:opacity-30" aria-label="Next">▶</button>
        </div>
      )}
    </div>
  );
}
