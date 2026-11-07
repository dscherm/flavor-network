/**
 * KitchenPanel — "What's in my kitchen?" for the Recipe Lab (KITCHEN-2).
 * The food counterpart of MyBarPanel.
 *
 * Add / remove what you have (autocomplete over ingredient names, quick-add
 * chips for the Cookbook's most-used ingredients, basics assumed unless
 * switched off), then see, live:
 *   • You can make — Cookbook recipes the kitchen fully covers;
 *   • One or two away — named ("missing basil");
 *   • From 40,000 real recipes — RecipeNLG matches, with how many of their
 *     ingredients you have and what is missing. The 14 MB index loads only
 *     when this panel opens; a chalk loader shows meanwhile, and a failed
 *     load leaves the Cookbook lists working.
 *
 * The kitchen is stored by the parent (localStorage `fn-my-kitchen`, shared
 * with the Sauce Lab). Logic: src/data/myKitchen.js + kitchenRecipes.js.
 */
import { useEffect, useMemo, useState } from 'react';
import { addToKitchen, removeFromKitchen } from '../data/myKitchen.js';
import {
  commonKitchenIngredients, kitchenVocab, kitchenSuggestions, missingText,
  cookbookForKitchen, realRecipesForKitchen,
} from '../data/kitchenRecipes.js';
import { SEED_RECIPES, CUISINE_COLOR } from '../data/seedRecipes.js';
import { dishTypeOf } from '../data/dishType.js';
import { loadRealRecipes } from '../ml/kitchenRuntime.js';
import { FONT, CHALK_CREAM, CHALK_DIM, CHALK_SUB, CHALK_RAIL, CHALK_SHADOW, chalkSurfaceStyle } from '../data/chalkTheme.js';
import { DishArt, ChalkLoader, IngredientArt } from './chalkArt.jsx';

const SANS = 'system-ui, -apple-system, "Segoe UI", sans-serif';
const NEARLY_SHOWN = 12;
const FOCUS = 'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2';
const NEUTRAL = CHALK_DIM;

export default function KitchenPanel({
  kitchen = [],
  onChange,
  assumeBasics = true,
  onAssumeBasicsChange,
  nodes = null,
  onOpenRecipe,
  onUseRealRecipe,
  onInvent,
  onClose,
}) {
  const names = useMemo(() => {
    if (!nodes) return new Set();
    return new Set(nodes instanceof Map ? nodes.keys() : Object.keys(nodes));
  }, [nodes]);
  const [text, setText] = useState('');
  const [real, setReal] = useState({ status: 'loading', data: null });
  const [openSteps, setOpenSteps] = useState(null);

  useEffect(() => {
    let live = true;
    loadRealRecipes()
      .then((data) => { if (live) setReal(data ? { status: 'ready', data } : { status: 'failed', data: null }); })
      .catch(() => { if (live) setReal({ status: 'failed', data: null }); });
    return () => { live = false; };
  }, []);

  const vocab = useMemo(
    () => kitchenVocab([...names, ...SEED_RECIPES.flatMap((r) => r.ingredients)]),
    [names],
  );
  const suggestions = useMemo(() => kitchenSuggestions(text, vocab, kitchen, 6), [text, vocab, kitchen]);
  const common = useMemo(() => commonKitchenIngredients(SEED_RECIPES, 18), []);
  const lookup = names.size ? names : null;
  const cookbook = useMemo(
    () => cookbookForKitchen(SEED_RECIPES, kitchen, { assumeBasics, names: lookup }),
    [kitchen, assumeBasics, lookup],
  );
  const realMatches = useMemo(
    () => (real.status === 'ready'
      ? realRecipesForKitchen(kitchen, real.data.index, real.data.vocab, { assumeBasics, names: lookup, k: 8 })
      : []),
    [real, kitchen, assumeBasics, lookup],
  );

  const add = (raw) => {
    const next = addToKitchen(kitchen, raw, names);
    if (next !== kitchen) onChange?.(next);
  };
  const submit = (e) => {
    e.preventDefault();
    if (!text.trim()) return;
    add(suggestions[0] && suggestions[0].startsWith(text.trim().toLowerCase()) ? suggestions[0] : text);
    setText('');
  };

  const pill = { fontFamily: FONT, borderColor: CHALK_RAIL, color: CHALK_CREAM, outlineColor: CHALK_CREAM };
  const h3 = { fontFamily: FONT, textShadow: CHALK_SHADOW };
  const categoryOf = (n) => (nodes?.get ? nodes.get(n)?.category : null);

  const recipeRow = (entry, nearly) => {
    const r = entry.item;
    const color = CUISINE_COLOR[r.cuisine] || NEUTRAL;
    return (
      <li key={r.id}>
        <button type="button" onClick={() => onOpenRecipe?.(r)} data-testid={`kitchen-recipe-${r.id}`}
          className={`w-full text-left py-1 min-h-[44px] flex items-center gap-2.5 rounded-lg ${FOCUS}`} style={{ outlineColor: CHALK_CREAM }}>
          <DishArt kind={dishTypeOf(r)} accent={color} size={44} />
          <span className="flex-1 min-w-0">
            <span className="block text-[20px] leading-tight" style={{ fontFamily: FONT, color: CHALK_CREAM }}>{r.name}</span>
            <span className="block text-[12px]" style={{ fontFamily: SANS, color: nearly ? CHALK_DIM : CHALK_SUB }}>
              {nearly ? missingText(entry.missing) : `${r.cuisine} · you have all ${entry.total}`}
            </span>
          </span>
        </button>
      </li>
    );
  };

  return (
    <div className="fixed inset-x-0 top-0 z-[82] flex flex-col items-center px-4 py-3 overflow-y-auto overflow-x-hidden"
      style={{ ...chalkSurfaceStyle(), bottom: 'var(--tab-bar-h)', color: CHALK_CREAM }}
      data-testid="kitchen-panel" role="dialog" aria-label="What's in my kitchen">
      <div className="w-full max-w-[560px] flex items-center justify-between mb-2 gap-2">
        <button type="button" onClick={onClose} data-testid="kitchen-close"
          className={`px-3 py-2 rounded-lg min-h-[44px] ${FOCUS}`} style={{ fontFamily: FONT, fontSize: 18, border: `1px solid ${CHALK_RAIL}`, color: CHALK_CREAM, outlineColor: CHALK_CREAM }}>
          ← Recipe Lab
        </button>
        {onInvent && (
          <button type="button" onClick={onInvent} data-testid="kitchen-invent"
            className={`px-3 py-2 rounded-lg min-h-[44px] ${FOCUS}`} style={{ fontFamily: FONT, fontSize: 18, color: '#0a0a0a', background: CHALK_CREAM, outlineColor: CHALK_CREAM }}>
            Invent a recipe →
          </button>
        )}
      </div>

      <div className="w-full max-w-[560px] rounded-2xl px-4 py-4" style={{ border: `2px double ${CHALK_RAIL}`, background: 'rgba(255,255,255,0.025)' }}>
        <h2 className="text-center text-[34px] leading-tight" style={h3}>What's in my kitchen?</h2>
        <p className="text-center text-[13px] mb-3" style={{ fontFamily: SANS, color: CHALK_SUB }}>
          What you have on hand. Kept on this device only.
        </p>

        <form onSubmit={submit} className="flex gap-2" role="search">
          <input
            type="search" value={text} onChange={(e) => setText(e.target.value)}
            placeholder="Add an ingredient — e.g. chicken"
            aria-label="Add an ingredient to my kitchen" data-testid="kitchen-input"
            autoComplete="off"
            className="flex-1 min-w-0 px-2.5 py-2 rounded-md min-h-[44px] text-[17px] focus:outline-none focus-visible:ring-2 focus-visible:ring-white/40"
            style={{ fontFamily: FONT, background: 'rgba(255,255,255,0.05)', border: `1px solid ${CHALK_RAIL}`, color: CHALK_CREAM }}
          />
          <button type="submit" data-testid="kitchen-add" className={`px-4 rounded-md min-h-[44px] border ${FOCUS}`} style={pill}>Add</button>
        </form>
        {suggestions.length > 0 && (
          <ul className="mt-1.5 flex flex-wrap gap-1.5" data-testid="kitchen-suggestions" aria-label="Matching ingredients">
            {suggestions.map((s) => (
              <li key={s}>
                <button type="button" onClick={() => { add(s); setText(''); }}
                  className={`px-3 py-1 rounded-full border min-h-[44px] text-[17px] ${FOCUS}`} style={{ ...pill, background: 'rgba(245,239,222,0.06)' }}>
                  + {s}
                </button>
              </li>
            ))}
          </ul>
        )}

        <ul className="mt-3 flex flex-wrap gap-1.5" data-testid="kitchen-items" aria-label="In my kitchen">
          {kitchen.length === 0 && (
            <li className="text-[16px]" style={{ fontFamily: FONT, color: CHALK_DIM }}>Your kitchen is empty — add what you have, or tap the common ones below.</li>
          )}
          {kitchen.map((k) => (
            <li key={k}>
              <button type="button" onClick={() => onChange?.(removeFromKitchen(kitchen, k))} aria-label={`Remove ${k}`}
                className={`pl-2 pr-3 py-1 rounded-full border min-h-[44px] text-[17px] inline-flex items-center gap-1.5 ${FOCUS}`} style={{ ...pill, background: 'rgba(245,239,222,0.08)' }}>
                <IngredientArt category={categoryOf(k)} name={k} size={20} />
                {k} <span aria-hidden="true" style={{ color: CHALK_SUB }}>×</span>
              </button>
            </li>
          ))}
        </ul>

        {common.some((k) => !kitchen.includes(k)) && (
          <div className="mt-3">
            <p className="text-[12px] uppercase tracking-wider mb-1" style={{ color: CHALK_SUB }}>Quick add — most used in recipes</p>
            <div className="flex flex-wrap gap-1.5" data-testid="kitchen-quick">
              {common.filter((k) => !kitchen.includes(k)).map((k) => (
                <button key={k} type="button" onClick={() => add(k)}
                  className={`px-2.5 py-1 rounded-full border min-h-[44px] text-[16px] ${FOCUS}`} style={{ ...pill, borderStyle: 'dashed', color: CHALK_DIM }}>
                  + {k}
                </button>
              ))}
            </div>
          </div>
        )}

        <button type="button" role="switch" aria-checked={assumeBasics} data-testid="kitchen-basics"
          onClick={() => onAssumeBasicsChange?.(!assumeBasics)}
          className={`mt-3 w-full flex items-center gap-3 text-left min-h-[44px] rounded-lg px-1 ${FOCUS}`} style={{ outlineColor: CHALK_CREAM }}>
          <span aria-hidden="true" className="relative inline-block flex-shrink-0 rounded-full"
            style={{ width: 44, height: 24, border: `1.5px solid ${CHALK_DIM}`, background: assumeBasics ? 'rgba(245,239,222,0.25)' : 'transparent' }}>
            <span className="absolute top-[2px] rounded-full transition-all"
              style={{ width: 17, height: 17, left: assumeBasics ? 22 : 3, background: assumeBasics ? CHALK_CREAM : CHALK_SUB }} />
          </span>
          <span className="text-[18px]" style={{ fontFamily: FONT, color: CHALK_CREAM }}>Assume basics (salt, pepper, oil, butter…)</span>
        </button>

        {kitchen.length > 0 && (
          <>
            <section className="mt-5" data-testid="kitchen-make" aria-label="You can make">
              <h3 className="text-[24px]" style={h3}>You can make ({cookbook.make.length})</h3>
              {cookbook.make.length === 0 && (
                <p className="text-[16px]" style={{ fontFamily: FONT, color: CHALK_DIM }}>No Cookbook recipe is complete yet — see what is one or two away.</p>
              )}
              <ul className="flex flex-col">{cookbook.make.map((e) => recipeRow(e, false))}</ul>
            </section>

            <section className="mt-4" data-testid="kitchen-nearly" aria-label="One or two away">
              <h3 className="text-[24px]" style={h3}>One or two away ({cookbook.nearly.length})</h3>
              <ul className="flex flex-col">{cookbook.nearly.slice(0, NEARLY_SHOWN).map((e) => recipeRow(e, true))}</ul>
              {cookbook.nearly.length > NEARLY_SHOWN && (
                <p className="text-[12px]" style={{ color: CHALK_SUB }}>…and {cookbook.nearly.length - NEARLY_SHOWN} more.</p>
              )}
            </section>

            <section className="mt-4" data-testid="kitchen-real" aria-label="From 40,000 real recipes">
              <h3 className="text-[24px]" style={h3}>From 40,000 real recipes</h3>
              {real.status === 'loading' && (
                <div className="py-2"><ChalkLoader compact label="Leafing through 40,000 recipes…" color="#a3e635" /></div>
              )}
              {real.status === 'failed' && (
                <p className="text-[15px]" style={{ fontFamily: FONT, color: CHALK_DIM }} data-testid="kitchen-real-failed">
                  The real-recipe index didn't load. The Cookbook matches above still work.
                </p>
              )}
              {real.status === 'ready' && realMatches.length === 0 && (
                <p className="text-[15px]" style={{ fontFamily: FONT, color: CHALK_DIM }}>No close matches yet — add a couple more ingredients.</p>
              )}
              <ul className="flex flex-col gap-1">
                {realMatches.map((m, i) => (
                  <li key={m.title} className="rounded-lg" style={{ border: `1px dashed ${CHALK_RAIL}` }}>
                    <div className="flex items-stretch">
                      <button type="button" onClick={() => onUseRealRecipe?.(m)} data-testid={`kitchen-real-${i}`}
                        aria-label={`Cook ${m.title} in the Recipe Notebook`}
                        className={`flex-1 min-w-0 text-left px-2.5 py-1.5 min-h-[44px] rounded-lg ${FOCUS}`} style={{ outlineColor: CHALK_CREAM }}>
                        <span className="block text-[19px] leading-tight" style={{ fontFamily: FONT, color: CHALK_CREAM }}>{m.title}</span>
                        <span className="block text-[12px]" style={{ fontFamily: SANS, color: CHALK_DIM }}>
                          you have {m.covered} of {m.total}{m.missing.length ? ` · ${missingText(m.missing, 3)}` : ' · nothing missing'}
                        </span>
                      </button>
                      {m.steps.length > 0 && (
                        <button type="button" aria-expanded={openSteps === i} onClick={() => setOpenSteps(openSteps === i ? null : i)}
                          aria-label={`${openSteps === i ? 'Hide' : 'Show'} the method for ${m.title}`}
                          className={`px-2 min-w-[44px] min-h-[44px] text-[15px] rounded-lg ${FOCUS}`} style={{ fontFamily: FONT, color: CHALK_SUB, outlineColor: CHALK_CREAM }}>
                          {openSteps === i ? '▾' : '▸'} method
                        </button>
                      )}
                    </div>
                    {openSteps === i && (
                      <ol className="px-3 pb-2 space-y-1 list-decimal list-inside text-[13px]" style={{ fontFamily: SANS, color: CHALK_CREAM }}>
                        {m.steps.map((s, j) => <li key={j}>{s}</li>)}
                      </ol>
                    )}
                  </li>
                ))}
              </ul>
            </section>
            <p className="mt-3 text-[11px]" style={{ fontFamily: SANS, color: CHALK_SUB }}>
              {assumeBasics ? 'Salt, pepper, oil, butter, sugar, flour and water are assumed. ' : ''}
              Lemon counts for lemon juice, stock for broth. Real recipes come from RecipeNLG; tap one to start it in your notebook.
            </p>
          </>
        )}
      </div>
    </div>
  );
}
