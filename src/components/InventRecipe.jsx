/**
 * InventRecipe — "Invent a recipe" for the Recipe Lab. The food counterpart of
 * InventCocktail.
 *
 * 1 · What kind of dish? (the 8 dish skeletons, src/data/dishSkeletons.js)
 * 2 · Main (a kitchen item the main slot takes, or any ingredient typed; "any" lets the pairing pick it)
 * 3 · Cuisine, optional (default none; it only re-orders shortlists)
 *
 * The panel seeds the skeleton (src/data/inventBuild.js), pre-fills each
 * REQUIRED slot with the best pick (kitchen first, then pair strength with the
 * rest of the dish, blended with the set-completion model's score when it has
 * loaded) and leaves optional slots empty. The cook swaps any slot from a
 * ranked shortlist or by typing, and adds extras. Amounts (quantityRuntime) and
 * the closest real recipe update on every change. No shuffle.
 *
 * The model is optional: while it loads, or if it failed, ranking uses the
 * pairing index alone and the panel works the same (a quiet note says so).
 * Model scores are fetched once per build change, never per slot, and a result
 * for an older build is dropped.
 *
 * `seed` = { type?, main?, cuisine?, pinned?: [{ key, source: 'search' }] } is
 * the initial state. Search pins are locked into the slots they fit and survive
 * a change of dish type or main. With pins and no `type`, the dish type is the
 * one that places the most pins (dishTypeForIngredients).
 *
 * Test ids: invent-recipe, -close, -kitchen, -source, -types, -type-{id},
 * -mains, -main-any, -main-input, -main-add, -cuisines, -card, -name, -dishline,
 * -missing, -needed, -method, -closest, -note, -write, -restart, -no-model;
 * the slot list uses testidPrefix "invent-recipe-slots" (see InventSlots).
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { kitchenCuisines, cuisineOptions, inventionHandoff, inventionName, isBasicLike, INVENT_ALPHA } from '../data/inventRecipe.js';
import { isBasic, haveIngredient, kitchenKey } from '../data/myKitchen.js';
import { buildPairingIndex } from '../data/recipePairingMatch.js';
import { blendIndex } from '../data/everydayPairs.js';
import useEverydayPairs from '../hooks/useEverydayPairs.js';
import { loadInventModel, loadRealRecipes } from '../ml/kitchenRuntime.js';
import { closestRealRecipe } from '../data/kitchenRecipes.js';
import { predictBowlAmounts } from '../ml/quantityRuntime.js';
import {
  DISH_SKELETON_ORDER, DISH_SKELETONS, dishSkeleton, rankDishSlot, dishTypeForIngredients,
} from '../data/dishSkeletons.js';
import { seedBuild, fillRequired, shortlist, setSlot, clearSlot, addExtra, removeExtra, missing, buildKeys } from '../data/inventBuild.js';
import { FONT, CHALK_CREAM, CHALK_DIM, CHALK_SUB, CHALK_RAIL, CHALK_SHADOW, chalkSurfaceStyle } from '../data/chalkTheme.js';
import { DishArt, ChalkLoader } from './chalkArt.jsx';
import InventSlots from './InventSlots.jsx';

const SANS = 'system-ui, -apple-system, "Segoe UI", sans-serif';
const FOCUS = 'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2';
const ACCENT = '#a3e635';
const NO_PINS = [];
const MODEL_K = 300;
const lower = (s) => String(s || '').toLowerCase().trim();

export default function InventRecipe({
  kitchen = [], nodes = null, edges = null, seed = null, onClose, onWrite, onEditKitchen,
}) {
  const names = useMemo(() => {
    if (!nodes) return new Set();
    return new Set(nodes instanceof Map ? nodes.keys() : Object.keys(nodes));
  }, [nodes]);
  const everyday = useEverydayPairs();
  const curatedIndex = useMemo(() => (edges ? buildPairingIndex(edges, names) : null), [edges, names]);
  const pairingIndex = useMemo(() => blendIndex(curatedIndex, everyday), [curatedIndex, everyday]);
  const pantry = useMemo(() => kitchen.filter((k) => !isBasic(k)), [kitchen]);
  const kitchenSet = useMemo(() => new Set(kitchen.map(lower)), [kitchen]);
  const nodeMap = useMemo(() => (nodes instanceof Map ? nodes : (nodes ? new Map(Object.entries(nodes)) : null)), [nodes]);

  const [model, setModel] = useState({ status: 'loading', data: null });
  const [real, setReal] = useState(null);
  const [scores, setScores] = useState(null); // Map name → model score for the current build
  const [showAllCuisines, setShowAllCuisines] = useState(false);
  const [amounts, setAmounts] = useState(new Map());
  const [openMethod, setOpenMethod] = useState(false);
  const [notice, setNotice] = useState(null);
  const [mainText, setMainText] = useState('');

  const rankFor = (cuisine, modelScores) => (slot, currentKeys) => rankDishSlot({
    slot, currentKeys, kitchen, cuisine, nodes: nodeMap, pairingIndex, modelScores,
  });

  // Seed + fill. pins: ordered [{ key, source }]; the main (if any) goes first.
  const seedFor = (typeId, main, pins, cuisine, modelScores) => {
    const skel = dishSkeleton(typeId, { nodes: nodeMap });
    const all = [...(main ? [{ key: main, source: 'user' }] : []), ...pins.filter((p) => p.key !== main)];
    const seeded = seedBuild(skel, { lab: 'recipe', baseline: { type: typeId, main, cuisine }, pinned: all });
    return fillRequired(seeded, rankFor(cuisine, modelScores));
  };

  const [state, setState] = useState(() => {
    const pins = (seed?.pinned || NO_PINS).map((p) => ({ key: lower(p.key), source: 'search' }));
    const typeId = DISH_SKELETONS[seed?.type]
      ? seed.type
      : (pins.length ? dishTypeForIngredients(pins.map((p) => p.key), { nodes: nodeMap }) : DISH_SKELETON_ORDER[0]);
    const main = seed?.main ? lower(seed.main) : null;
    const cuisine = seed?.cuisine || null;
    const build = seedFor(typeId, main, pins, cuisine, null);
    return { typeId, main, cuisine, seedPins: pins, build, nonce: 0 };
  });
  const { typeId, main, cuisine, build } = state;
  const skeleton = DISH_SKELETONS[typeId];
  const touched = useRef(false); // the cook has edited this build by hand

  useEffect(() => {
    let live = true;
    loadInventModel()
      .then((data) => { if (live) setModel(data ? { status: 'ready', data } : { status: 'failed', data: null }); })
      .catch(() => { if (live) setModel({ status: 'failed', data: null }); });
    loadRealRecipes().then((data) => { if (live) setReal(data); }).catch(() => {});
    return () => { live = false; };
  }, []);

  const suggest = model.data?.suggest;
  const askModel = (keys, c) => Promise.resolve()
    .then(() => suggest(keys, { cuisine: c, alpha: INVENT_ALPHA, k: MODEL_K }))
    .then((rows) => new Map((rows || []).map((r) => [lower(r.name), r.score])));

  // Model scores for the current build: once per build change (not per slot).
  const keysSig = buildKeys(build).join('|');
  const latest = useRef(0);
  useEffect(() => {
    if (!suggest || !keysSig) { setScores(null); return undefined; }
    const token = ++latest.current;
    askModel(keysSig.split('|'), cuisine)
      .then((m) => { if (token === latest.current) setScores(m); })
      .catch(() => { if (token === latest.current) setScores(null); });
    return () => { latest.current += 1; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [suggest, keysSig, cuisine]);

  // A fresh seed (first open, dish type or main changed) is first filled from
  // the pairing index alone; when the model is ready, fill it again with the
  // model's score unless the cook has already edited it or a newer seed took over.
  const refined = useRef(0);
  useEffect(() => {
    if (!suggest || refined.current === state.nonce) return undefined;
    refined.current = state.nonce;
    const nonce = state.nonce;
    const pinKeys = [...(state.main ? [state.main] : []), ...state.seedPins.map((p) => p.key)];
    let live = true;
    (pinKeys.length ? askModel(pinKeys, state.cuisine) : Promise.resolve(null))
      .then((m) => {
        if (!live || touched.current) return;
        setState((st) => (st.nonce !== nonce ? st : { ...st, build: seedFor(st.typeId, st.main, st.seedPins, st.cuisine, m) }));
      })
      .catch(() => {});
    return () => { live = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [suggest, state.nonce]);

  // Pins carried into a re-seed: search pins plus everything the cook set by hand that the new skeleton may take.
  const keptPins = (old, nextTypeId, nextMain) => {
    const skel = dishSkeleton(nextTypeId, { nodes: nodeMap });
    const lines = [...old.build.slots.filter((s) => s.line).map((s) => s.line), ...old.build.extras];
    const keep = lines.filter((l) => l.source !== 'auto' && l.key !== old.main && l.key !== nextMain
      && (l.source === 'search' || skel.slots.some((s) => s.accepts(l.key))));
    return [
      ...old.seedPins.filter((p) => p.key !== nextMain),
      ...keep.filter((l) => !old.seedPins.some((p) => p.key === l.key)).map((l) => ({ key: l.key, source: 'user' })),
    ];
  };

  const reseed = (nextType, nextMain, { fresh = false } = {}) => {
    touched.current = false;
    const pins = fresh ? state.seedPins : keptPins(state, nextType, nextMain);
    const next = seedFor(nextType, nextMain, pins, cuisine, scores);
    setState((st) => ({ ...st, typeId: nextType, main: nextMain, seedPins: pins, build: next, nonce: st.nonce + 1 }));
    setNotice(next.rejected.length ? next.rejected.map((r) => r.reason).join(' ') : null);
  };
  const edit = (fn) => { touched.current = true; setState((st) => ({ ...st, build: fn(st.build) })); };
  const update = (res) => {
    if (res.ok) { touched.current = true; setState((st) => ({ ...st, build: res.build })); setNotice(null); } else setNotice(res.reason);
    return res.ok;
  };

  const options = useMemo(() => cuisineOptions(model.data?.cuisineVocab), [model.data]);
  const leaning = useMemo(() => kitchenCuisines(pantry, nodes, model.data?.cuisineVocab, 4), [pantry, nodes, model.data]);
  const setCuisine = (c) => setState((st) => ({ ...st, cuisine: c }));

  const keys = buildKeys(build);
  const needs = missing(build);
  const needed = keys.filter((k) => !isBasicLike(k) && !haveIngredient(k, kitchenSet, { assumeBasics: true, names }).covered);
  const mainChoices = useMemo(() => {
    const own = pantry.filter((k) => dishSkeleton(typeId, { nodes: nodeMap }).slots.find((s) => s.id === 'main')?.accepts(k));
    return main && !own.includes(main) ? [main, ...own] : own;
  }, [pantry, typeId, nodeMap, main]);

  const nameInfo = useMemo(
    () => (keys.length ? inventionName(keys, { cuisine, nodes: nodeMap, index: pairingIndex }) : { name: skeleton.label }),
    [keys.join('|'), cuisine, nodeMap, pairingIndex, skeleton], // eslint-disable-line react-hooks/exhaustive-deps
  );
  const closest = useMemo(() => (real && keys.length ? closestRealRecipe(keys, real.index, real.vocab) : null), [real, keysSig]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const need = keys.filter((n) => !amounts.has(n));
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [keysSig, amounts]);

  const keyFor = (text) => kitchenKey(text, names);
  const rank = rankFor(cuisine, scores);
  const shortlistFor = (slotId) => shortlist(build, slotId, rank, 8)
    .map((c) => ({ key: c.key, have: !!c.have, note: !c.have ? "you'd need" : undefined }));

  const write = () => onWrite?.(inventionHandoff(
    { name: nameInfo.name, ingredients: keys.map((name) => ({ name })) },
    { amounts: new Map([...amounts].map(([k, v]) => [k, v])), closest },
  ));

  const chip = (active) => ({
    fontFamily: FONT,
    color: active ? '#0a0a0a' : CHALK_CREAM,
    background: active ? CHALK_CREAM : 'transparent',
    borderColor: CHALK_RAIL,
    outlineColor: CHALK_CREAM,
  });
  const btn = { fontFamily: FONT, fontSize: 18, borderColor: CHALK_RAIL, color: CHALK_CREAM, outlineColor: CHALK_CREAM };
  const cuisineChips = showAllCuisines ? options : [...new Set([...leaning, ...(cuisine ? [cuisine] : [])])];
  const dishLine = [skeleton.label, cuisine].filter(Boolean).join(' · ');

  return (
    <div className="fixed inset-x-0 top-0 safe-top-pad z-[83] flex flex-col items-center px-4 py-3 overflow-y-auto overflow-x-hidden"
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
            ? `Your kitchen (${pantry.length} item${pantry.length === 1 ? '' : 's'}) comes first; anything else is marked “you'd need”.`
            : 'Your kitchen is empty, so this draws on common ingredients.'}
        </p>
        {model.status === 'loading' && <div className="py-1"><ChalkLoader compact label="Warming up the recipe model…" color={ACCENT} /></div>}
        {model.status === 'failed' && (
          <p className="text-center text-[12px] mb-2" style={{ fontFamily: SANS, color: CHALK_DIM }} data-testid="invent-recipe-no-model" role="status">
            Suggestions are running without the recipe model (offline?) — pairings still guide them.
          </p>
        )}

        <p className="text-[12px] uppercase tracking-wider mb-1" style={{ color: CHALK_SUB }}>1 · What kind of dish?</p>
        <div className="flex flex-col gap-1.5" role="group" aria-label="What kind of dish?" data-testid="invent-recipe-types">
          {DISH_SKELETON_ORDER.map((id) => {
            const d = DISH_SKELETONS[id];
            return (
              <button key={id} type="button" aria-label={d.label} aria-pressed={typeId === id} data-testid={`invent-recipe-type-${id}`}
                onClick={() => reseed(id, main)}
                className={`pl-2 pr-3 py-1 rounded-xl border min-h-[48px] inline-flex items-center gap-2 text-left ${FOCUS}`} style={chip(typeId === id)}>
                <DishArt kind={d.dishType} accent={typeId === id ? '#0a0a0a' : ACCENT} size={34} />
                <span className="min-w-0">
                  <span className="block text-[19px] leading-tight">{d.label}</span>
                  <span className="block text-[12px] leading-tight" style={{ fontFamily: SANS, opacity: 0.75 }}>{d.blurb}</span>
                </span>
              </button>
            );
          })}
        </div>

        <p className="mt-3 text-[12px] uppercase tracking-wider mb-1" style={{ color: CHALK_SUB }}>2 · Main</p>
        <div className="flex flex-wrap gap-1.5" role="group" aria-label="Main" data-testid="invent-recipe-mains">
          <button type="button" aria-pressed={main == null} onClick={() => reseed(typeId, null)} data-testid="invent-recipe-main-any"
            className={`px-3 py-1 rounded-full border min-h-[44px] text-[17px] ${FOCUS}`} style={chip(main == null)}>any</button>
          {mainChoices.map((k) => (
            <button key={k} type="button" aria-pressed={main === k} onClick={() => reseed(typeId, k)}
              className={`px-3 py-1 rounded-full border min-h-[44px] text-[17px] ${FOCUS}`} style={chip(main === k)}>{k}</button>
          ))}
        </div>
        <form className="mt-1.5 flex gap-1.5 min-w-0" onSubmit={(e) => {
          e.preventDefault();
          const k = keyFor(mainText);
          if (!k) return;
          reseed(typeId, k);
          setMainText('');
        }}>
          <input type="text" value={mainText} onChange={(e) => setMainText(e.target.value)} placeholder="or type any main ingredient"
            aria-label="Type a main ingredient" data-testid="invent-recipe-main-input"
            className="flex-1 min-w-0 px-3 rounded-lg min-h-[44px]"
            style={{ fontFamily: SANS, fontSize: 16, color: CHALK_CREAM, background: 'rgba(255,255,255,0.05)', border: `1px solid ${CHALK_RAIL}` }} />
          <button type="submit" data-testid="invent-recipe-main-add" className={`px-3 rounded-lg min-h-[44px] flex-shrink-0 border ${FOCUS}`} style={btn}>Use</button>
        </form>

        {options.length > 0 && (
          <>
            <p className="mt-3 text-[12px] uppercase tracking-wider mb-1" style={{ color: CHALK_SUB }}>3 · Cuisine (optional)</p>
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
          </>
        )}

        <article className="mt-4 rounded-xl px-4 py-3" style={{ border: `1px solid ${ACCENT}88`, background: `${ACCENT}10` }} data-testid="invent-recipe-card">
          <div className="flex items-center gap-3 mb-2">
            <DishArt kind={skeleton.dishType} accent={ACCENT} size={64} />
            <div className="flex-1 min-w-0">
              <h3 className="text-[26px] leading-tight" style={{ fontFamily: FONT, textShadow: CHALK_SHADOW }} data-testid="invent-recipe-name">{nameInfo.name}</h3>
              <p className="text-[12px]" style={{ fontFamily: SANS, color: CHALK_DIM }} data-testid="invent-recipe-dishline">{dishLine}</p>
            </div>
          </div>

          {needs.length > 0 && (
            <p className="mb-2 text-[15px] rounded-lg px-3 py-2" style={{ fontFamily: SANS, color: CHALK_CREAM, border: `1px dashed ${CHALK_RAIL}` }} data-testid="invent-recipe-missing">
              Still needs: {needs.join(', ')}.
            </p>
          )}

          <InventSlots build={build} color={ACCENT} testidPrefix="invent-recipe-slots" notice={notice}
            shortlistFor={shortlistFor} amountFor={(k) => amounts.get(k)?.raw || undefined}
            onPick={(slotId, v) => update(setSlot(build, slotId, keyFor(v), { have: kitchenSet.has(keyFor(v)) }))}
            onAddExtra={(t) => update(addExtra(build, keyFor(t)))}
            onClear={(slotId) => { edit((b) => clearSlot(b, slotId)); setNotice(null); }}
            onRemoveExtra={(k) => { edit((b) => removeExtra(b, k)); setNotice(null); }} />

          {needed.length > 0 && (
            <p className="mt-2 text-[13px]" style={{ fontFamily: SANS, color: CHALK_CREAM }} data-testid="invent-recipe-needed">
              <span className="px-1.5 rounded-full border mr-1.5 text-[11px]" style={{ borderColor: '#f59e0b' }}>you'd need</span>
              {needed.join(', ')}
            </p>
          )}
          <p className="mt-1 text-[12px]" style={{ fontFamily: SANS, color: CHALK_SUB }}>plus salt, pepper and oil to taste</p>

          <p className="mt-2 text-[14px]" style={{ fontFamily: SANS, color: CHALK_CREAM }} data-testid="invent-recipe-method">{skeleton.method}</p>

          {closest && (
            <div className="mt-2" data-testid="invent-recipe-closest">
              <p className="text-[12px] uppercase tracking-wider" style={{ color: CHALK_SUB }}>Closest real recipe</p>
              <button type="button" aria-expanded={openMethod} onClick={() => setOpenMethod((o) => !o)}
                className={`w-full text-left min-h-[44px] flex items-center gap-2 rounded-lg ${FOCUS}`} style={{ outlineColor: CHALK_CREAM }}>
                <span className="text-[19px] flex-1 min-w-0" style={{ fontFamily: FONT, color: CHALK_CREAM }}>{closest.title}</span>
                <span className="text-[14px] flex-shrink-0" style={{ fontFamily: FONT, color: CHALK_SUB }}>{openMethod ? '▾ hide method' : '▸ method'}</span>
              </button>
              {openMethod && (
                <ol className="space-y-1 list-decimal list-inside text-[13px]" style={{ fontFamily: SANS, color: CHALK_CREAM }}>
                  {closest.steps.map((s, j) => <li key={j}>{s}</li>)}
                </ol>
              )}
            </div>
          )}
          <p className="mt-2 text-[12px] italic" style={{ fontFamily: SANS, color: CHALK_DIM }} data-testid="invent-recipe-note">
            An idea from what pairs, not a tested recipe — taste as you go.
          </p>

          <div className="mt-2 flex flex-wrap gap-2">
            <button type="button" onClick={() => reseed(typeId, main, { fresh: true })} data-testid="invent-recipe-restart"
              className={`px-3 py-2 rounded-lg border min-h-[44px] ${FOCUS}`} style={btn}>
              Start over
            </button>
            {onWrite && (
              <button type="button" onClick={write} data-testid="invent-recipe-write"
                className={`flex-1 px-3 py-2 rounded-lg min-h-[44px] ${FOCUS}`} style={{ fontFamily: FONT, fontSize: 19, color: '#0a0a0a', background: CHALK_CREAM, outlineColor: CHALK_CREAM }}>
                Write it in the Recipe Notebook →
              </button>
            )}
          </div>
        </article>
      </div>
    </div>
  );
}
