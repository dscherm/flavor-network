/**
 * InventRecipe — "Invent a recipe" for the Recipe Lab (KITCHEN-2).
 * The food counterpart of InventCocktail.
 *
 * Pick a cuisine (chips from the recipe model's cuisines, defaulting to
 * the ones the kitchen leans toward) and optionally a main ingredient from
 * the kitchen. The set-completion model grows a dish from the kitchen
 * (src/data/inventRecipe.js); at most two "you'd need" ingredients come
 * from outside it when the dish is thin. Three inventions at a time, each
 * with amounts (quantityRuntime), the closest real recipe (title + method)
 * and an honest note that it is an idea, not a tested recipe.
 *
 * If the model fails to load the panel says invent is unavailable; if the
 * real-recipe index fails, inventions simply have no "closest" line.
 */
import { useEffect, useMemo, useState } from 'react';
import { inventRecipes, kitchenCuisines, cuisineOptions, inventionHandoff } from '../data/inventRecipe.js';
import { isBasic } from '../data/myKitchen.js';
import { buildPairingIndex } from '../data/recipePairingMatch.js';
import { blendIndex } from '../data/everydayPairs.js';
import useEverydayPairs from '../hooks/useEverydayPairs.js';
import { loadInventModel, loadRealRecipes } from '../ml/kitchenRuntime.js';
import { closestRealRecipe } from '../data/kitchenRecipes.js';
import { predictBowlAmounts } from '../ml/quantityRuntime.js';
import { FONT, CHALK_CREAM, CHALK_DIM, CHALK_SUB, CHALK_RAIL, CHALK_SHADOW, chalkSurfaceStyle } from '../data/chalkTheme.js';
import { DishArt, ChalkLoader, IngredientArt } from './chalkArt.jsx';

const SANS = 'system-ui, -apple-system, "Segoe UI", sans-serif';
const FOCUS = 'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2';
const PER_PAGE = 3;
const ACCENT = '#a3e635';

export default function InventRecipe({ kitchen = [], nodes = null, edges = null, onClose, onWrite, onEditKitchen }) {
  const names = useMemo(() => {
    if (!nodes) return new Set();
    return new Set(nodes instanceof Map ? nodes.keys() : Object.keys(nodes));
  }, [nodes]);
  // Curated pairing graph + the everyday pairs it lacks (chicken|garlic …),
  // max per pair (WEAK-A). Without the everyday file: the curated graph alone.
  const everyday = useEverydayPairs();
  const curatedIndex = useMemo(() => (edges ? buildPairingIndex(edges, names) : null), [edges, names]);
  const pairingIndex = useMemo(() => blendIndex(curatedIndex, everyday), [curatedIndex, everyday]);
  const pantry = useMemo(() => kitchen.filter((k) => !isBasic(k)), [kitchen]);

  const [model, setModel] = useState({ status: 'loading', data: null });
  const [real, setReal] = useState(null);
  const [cuisine, setCuisine] = useState(undefined); // undefined = not yet defaulted
  const [showAllCuisines, setShowAllCuisines] = useState(false);
  const [main, setMain] = useState(null);
  const [result, setResult] = useState(null);
  const [busy, setBusy] = useState(false);
  const [page, setPage] = useState(0);
  const [amounts, setAmounts] = useState(new Map());
  const [openMethod, setOpenMethod] = useState(null);

  useEffect(() => {
    let live = true;
    loadInventModel()
      .then((data) => { if (live) setModel(data ? { status: 'ready', data } : { status: 'failed', data: null }); })
      .catch(() => { if (live) setModel({ status: 'failed', data: null }); });
    loadRealRecipes().then((data) => { if (live) setReal(data); }).catch(() => {});
    return () => { live = false; };
  }, []);

  const options = useMemo(() => cuisineOptions(model.data?.cuisineVocab), [model.data]);
  const leaning = useMemo(
    () => kitchenCuisines(pantry, nodes, model.data?.cuisineVocab, 4),
    [pantry, nodes, model.data],
  );
  useEffect(() => {
    if (cuisine === undefined && model.status === 'ready') setCuisine(leaning[0] || null);
  }, [cuisine, model.status, leaning]);
  useEffect(() => { if (main && !pantry.includes(main)) setMain(null); }, [main, pantry]);

  useEffect(() => {
    if (model.status !== 'ready' || cuisine === undefined) return undefined;
    let live = true;
    setBusy(true);
    inventRecipes({ kitchen, cuisine, main, suggest: model.data.suggest, pairingIndex, nodes, names, limit: 12 })
      .then((r) => { if (live) { setResult(r); setPage(0); setOpenMethod(null); } })
      .catch(() => { if (live) setResult({ ok: false, reason: 'Something went wrong inventing a dish. Try another cuisine.' }); })
      .finally(() => { if (live) setBusy(false); });
    return () => { live = false; };
  }, [model, cuisine, main, kitchen, pairingIndex, nodes, names]);

  const inventions = useMemo(() => (result?.ok ? result.inventions : []), [result]);
  const pages = Math.max(1, Math.ceil(inventions.length / PER_PAGE));
  const shown = useMemo(
    () => inventions.slice((page % pages) * PER_PAGE, (page % pages) * PER_PAGE + PER_PAGE),
    [inventions, page, pages],
  );

  const closest = useMemo(() => {
    const m = new Map();
    if (!real) return m;
    for (const inv of shown) {
      const hit = closestRealRecipe(inv.ingredients.map((i) => i.name), real.index, real.vocab);
      if (hit) m.set(inv.name, hit);
    }
    return m;
  }, [real, shown]);

  // Likely amounts for every ingredient on the page (null-safe: no model → no amounts).
  useEffect(() => {
    const need = [...new Set(shown.flatMap((inv) => inv.ingredients.map((i) => i.name)))].filter((n) => !amounts.has(n));
    if (need.length === 0) return undefined;
    let live = true;
    predictBowlAmounts(need).then((rows) => {
      if (!live) return;
      setAmounts((prev) => {
        const next = new Map(prev);
        for (const { name, amount } of rows) next.set(name, amount);
        return next;
      });
    }).catch(() => {});
    return () => { live = false; };
  }, [shown, amounts]);

  const chip = (active) => ({
    fontFamily: FONT,
    color: active ? '#0a0a0a' : CHALK_CREAM,
    background: active ? CHALK_CREAM : 'transparent',
    borderColor: CHALK_RAIL,
    outlineColor: CHALK_CREAM,
  });
  const cuisineChips = showAllCuisines ? options : [...new Set([...leaning, ...(cuisine ? [cuisine] : [])])];
  const btn = { fontFamily: FONT, fontSize: 18, borderColor: CHALK_RAIL, color: CHALK_CREAM, outlineColor: CHALK_CREAM };

  return (
    <div className="fixed inset-x-0 top-0 z-[83] flex flex-col items-center px-4 py-3 overflow-y-auto overflow-x-hidden"
      style={{ ...chalkSurfaceStyle(), bottom: 'var(--tab-bar-h)', color: CHALK_CREAM }}
      data-testid="invent-recipe" role="dialog" aria-label="Invent a recipe">
      <div className="w-full max-w-[560px] flex items-center justify-between mb-2 gap-2">
        <button type="button" onClick={onClose} data-testid="invent-recipe-close"
          className={`px-3 py-2 rounded-lg min-h-[44px] border ${FOCUS}`} style={btn}>
          ← Back
        </button>
        {onEditKitchen && (
          <button type="button" onClick={onEditKitchen} data-testid="invent-recipe-kitchen"
            className={`px-3 py-2 rounded-lg min-h-[44px] border ${FOCUS}`} style={btn}>
            My kitchen ({pantry.length})
          </button>
        )}
      </div>

      <div className="w-full max-w-[560px] rounded-2xl px-4 py-4" style={{ border: `2px double ${CHALK_RAIL}`, background: 'rgba(255,255,255,0.025)' }}>
        <h2 className="text-center text-[34px] leading-tight" style={{ fontFamily: FONT, textShadow: CHALK_SHADOW }}>Invent a recipe</h2>
        <p className="text-center text-[13px] mb-3" style={{ fontFamily: SANS, color: CHALK_SUB }} data-testid="invent-recipe-source">
          {pantry.length
            ? `From your kitchen (${pantry.length} item${pantry.length === 1 ? '' : 's'}), in what pairs in real recipes.`
            : 'Your kitchen is empty — add what you have first.'}
        </p>

        {model.status === 'loading' && (
          <div className="py-4"><ChalkLoader compact label="Warming up the recipe model…" color={ACCENT} /></div>
        )}
        {model.status === 'failed' && (
          <div className="mt-2 rounded-lg px-3 py-3" style={{ border: `1px dashed ${CHALK_RAIL}` }} data-testid="invent-recipe-unavailable" role="status">
            <p className="text-[20px]" style={{ fontFamily: FONT }}>Invent is unavailable right now.</p>
            <p className="text-[13px]" style={{ fontFamily: SANS, color: CHALK_DIM }}>
              The recipe model didn't load (offline?). What you can make from the Cookbook still works.
            </p>
          </div>
        )}

        {model.status === 'ready' && (
          <>
            <p className="text-[12px] uppercase tracking-wider mb-1" style={{ color: CHALK_SUB }}>Cuisine</p>
            <div className="flex flex-wrap gap-1.5" role="group" aria-label="Cuisine" data-testid="invent-recipe-cuisines">
              <button type="button" aria-pressed={cuisine === null} onClick={() => setCuisine(null)}
                className={`px-3 py-1 rounded-full border min-h-[44px] text-[17px] ${FOCUS}`} style={chip(cuisine === null)}>any</button>
              {cuisineChips.map((c) => (
                <button key={c} type="button" aria-pressed={cuisine === c} onClick={() => setCuisine(c)}
                  className={`px-3 py-1 rounded-full border min-h-[44px] text-[17px] ${FOCUS}`} style={chip(cuisine === c)}>{c}</button>
              ))}
              <button type="button" onClick={() => setShowAllCuisines((s) => !s)} aria-expanded={showAllCuisines}
                className={`px-3 py-1 rounded-full border min-h-[44px] text-[16px] ${FOCUS}`} style={{ ...chip(false), borderStyle: 'dashed', color: CHALK_DIM }}>
                {showAllCuisines ? 'fewer' : `all ${options.length}…`}
              </button>
            </div>

            {pantry.length > 0 && (
              <>
                <p className="mt-3 text-[12px] uppercase tracking-wider mb-1" style={{ color: CHALK_SUB }}>Main ingredient</p>
                <div className="flex flex-wrap gap-1.5" role="group" aria-label="Main ingredient" data-testid="invent-recipe-mains">
                  <button type="button" aria-pressed={main == null} onClick={() => setMain(null)}
                    className={`px-3 py-1 rounded-full border min-h-[44px] text-[17px] ${FOCUS}`} style={chip(main == null)}>any</button>
                  {pantry.map((k) => (
                    <button key={k} type="button" aria-pressed={main === k} onClick={() => setMain(k)}
                      className={`px-3 py-1 rounded-full border min-h-[44px] text-[17px] ${FOCUS}`} style={chip(main === k)}>{k}</button>
                  ))}
                </div>
              </>
            )}

            {busy && !result && <div className="py-4"><ChalkLoader compact label="Inventing…" color={ACCENT} /></div>}

            {result && !result.ok && (
              <div className="mt-4 rounded-lg px-3 py-3" style={{ border: `1px dashed ${CHALK_RAIL}` }} data-testid="invent-recipe-missing">
                <p className="text-[18px]" style={{ fontFamily: FONT, color: CHALK_CREAM }}>{result.reason}</p>
              </div>
            )}

            {shown.length > 0 && (
              <div className="mt-4 flex flex-col gap-3" data-testid="invent-recipe-cards" aria-busy={busy}>
                {shown.map((inv) => {
                  const near = closest.get(inv.name);
                  const methodOpen = openMethod === inv.name;
                  return (
                    <article key={inv.name + inv.ingredients.map((i) => i.name).join()} className="rounded-xl px-4 py-3"
                      style={{ border: `1px solid ${ACCENT}88`, background: `${ACCENT}10` }} data-testid="invent-recipe-card">
                      <div className="flex items-center gap-3 mb-2">
                        <DishArt kind={inv.dishType} accent={ACCENT} size={64} />
                        <h3 className="flex-1 min-w-0 text-[26px] leading-tight" style={{ fontFamily: FONT, textShadow: CHALK_SHADOW }} data-testid="invent-recipe-name">{inv.name}</h3>
                      </div>
                      <ul className="flex flex-col gap-0.5" aria-label="Ingredients">
                        {inv.ingredients.map((i) => (
                          <li key={i.name} className="flex items-center gap-2">
                            <span className="text-[13px] w-20 flex-shrink-0 text-right" style={{ fontFamily: SANS, color: CHALK_DIM }}>
                              {amounts.get(i.name)?.raw || ''}
                            </span>
                            <IngredientArt category={nodes?.get?.(i.name)?.category} name={i.name} size={20} />
                            <span className="text-[20px] min-w-0 truncate" style={{ fontFamily: FONT, color: CHALK_CREAM }}>{i.name}</span>
                            {i.needed && (
                              <span className="text-[11px] px-1.5 rounded-full border flex-shrink-0" style={{ fontFamily: SANS, color: CHALK_CREAM, borderColor: '#f59e0b' }} data-testid="invent-recipe-needed">
                                you'd need
                              </span>
                            )}
                          </li>
                        ))}
                      </ul>
                      <p className="mt-1 text-[12px]" style={{ fontFamily: SANS, color: CHALK_SUB }}>plus salt, pepper and oil to taste</p>
                      <p className="mt-2 text-[14px]" style={{ fontFamily: SANS, color: CHALK_CREAM }}>{inv.why}</p>
                      {near && (
                        <div className="mt-2" data-testid="invent-recipe-closest">
                          <p className="text-[12px] uppercase tracking-wider" style={{ color: CHALK_SUB }}>Closest real recipe</p>
                          <button type="button" aria-expanded={methodOpen} onClick={() => setOpenMethod(methodOpen ? null : inv.name)}
                            className={`w-full text-left min-h-[44px] flex items-center gap-2 rounded-lg ${FOCUS}`} style={{ outlineColor: CHALK_CREAM }}>
                            <span className="text-[19px] flex-1 min-w-0" style={{ fontFamily: FONT, color: CHALK_CREAM }}>{near.title}</span>
                            <span className="text-[14px] flex-shrink-0" style={{ fontFamily: FONT, color: CHALK_SUB }}>{methodOpen ? '▾ hide method' : '▸ method'}</span>
                          </button>
                          {methodOpen && (
                            <ol className="space-y-1 list-decimal list-inside text-[13px]" style={{ fontFamily: SANS, color: CHALK_CREAM }}>
                              {near.steps.map((s, j) => <li key={j}>{s}</li>)}
                            </ol>
                          )}
                        </div>
                      )}
                      <p className="mt-2 text-[12px] italic" style={{ fontFamily: SANS, color: CHALK_DIM }} data-testid="invent-recipe-note">
                        An idea from what pairs, not a tested recipe — taste as you go.
                      </p>
                      {onWrite && (
                        <button type="button" onClick={() => onWrite(inventionHandoff(inv, { amounts, closest: near }))} data-testid="invent-recipe-write"
                          className={`mt-2 w-full px-3 py-2 rounded-lg min-h-[44px] ${FOCUS}`} style={{ fontFamily: FONT, fontSize: 19, color: '#0a0a0a', background: CHALK_CREAM, outlineColor: CHALK_CREAM }}>
                          Write it in the Recipe Notebook →
                        </button>
                      )}
                    </article>
                  );
                })}
                <button type="button" onClick={() => { setPage((p) => p + 1); setOpenMethod(null); }} disabled={pages < 2} data-testid="invent-recipe-shuffle"
                  className={`self-center px-4 py-2 rounded-lg border min-h-[44px] disabled:opacity-40 ${FOCUS}`} style={btn}>
                  🔀 Shuffle
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
