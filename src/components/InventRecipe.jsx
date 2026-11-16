/**
 * InventRecipe — the one chalkboard recipe builder (the Recipe Notebook tab and Make a recipe both open it). Starts EMPTY: the panel
 * never puts an ingredient or a name in front of the cook on its own.
 *
 * 1 · "What is the main ingredient?"  kitchen items the main slot would take first,
 *     a few common mains, a text box. Nothing else shows until this is answered;
 *     the list then holds ONLY that ingredient.
 * 2 · "A particular kind of dish? (optional)"  collapsed; the 8 dish types. Choosing
 *     one shows a checklist of what it usually has. With none chosen, a recommended
 *     type appears once the list has two ingredients, applied only on Accept.
 * 3 · Cuisine (optional)  only steers suggestions.
 * 4 · The list: add by typing, remove, editable suggested amounts, replacements from
 *     the cook's kitchen for lines they do not have.
 * 5 · Suggestions "goes well with what you have": the set-completion model blended
 *     with the pairing index (kitchen first). Offered, never added. The model is
 *     optional: while it loads or if it failed, the pairing index alone.
 * 6 · Flavor profile of the list (a visual aid, buildFlavorProfile).
 * 7 · Method + closest real recipe only once a dish type is chosen or accepted.
 * 8 · Name (starts empty) and, with `onSave`, "Add to my recipes"; "Write it" hands off
 *     to the Recipe Notebook.
 *
 * Props
 *   kitchen, nodes, edges    as before (names the cook has; ingredient graph; pairing edges)
 *   seed       { type?, fromName?, main?, cuisine?, pinned?: [{ key, source: 'search' | 'user' }] } from the
 *              Cookbook search. Searched ingredients become the list; `main` answers step 1 (with
 *              none, step 1 is skipped); `type` is applied only when `fromName` (the search named
 *              a recipe), otherwise the best fit is simply recommended; `cuisine` sets the chip.
 *   editItem   { id, name, baseline: { category, … }, lines } (fromSavedItem + id): opens on that dish
 *              with its own name; onSave is called with the same id.
 *   onSave     (input) → Promise<{ status: 'saved'|'signin'|'error', message? }>. input is the
 *              argument for toSavedItem: { kind: 'recipe', id?, name, category: dishTypeId|null,
 *              lines: [{ key, amount, role }], method?, cuisine? }. No onSave → no save row.
 *   onWrite, onEditKitchen, onClose
 *   onFindCocktail, onFindSauce, onFindWine   (names, title) → the App's aroma-match handlers; each missing one hides its button.
 *   seed also carries a handoff's { steps, stepsFrom, image (File | url) } (shown as a collapsed Method and a photo with remove)
 *   and pinned[].amount (a typed amount for that line). seedFromHandoff (inventRecipe.js) builds one from any recipeHandoff;
 *   it adds { title (the name box), editId (save under that saved recipe's id), replaces (the name of a recipe the old
 *   Notebook saved with names only: saving replaces it rather than adding a second) }.
 *
 * Test ids: invent-recipe, -close, -kitchen, -source, -no-model, -cuisines, -dishline, -method,
 * -closest, -note, -write, -restart, plus the shared components' prefixes
 * invent-recipe-start, -category, -list, -hint, -checklist, -suggest, -profile, -namesave
 * (see each Invent* component for the ids it adds).
 */
import { lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { kitchenCuisines, cuisineOptions, inventionHandoff, isBasicLike, INVENT_ALPHA } from '../data/inventRecipe.js';
import { isBasic, haveIngredient, kitchenKey } from '../data/myKitchen.js';
import { buildPairingIndex } from '../data/recipePairingMatch.js';
import { blendIndex } from '../data/everydayPairs.js';
import { parseAmount } from '../data/portionParser.js';
import useEverydayPairs from '../hooks/useEverydayPairs.js';
import { loadInventModel, loadRealRecipes } from '../ml/kitchenRuntime.js';
import { closestRealRecipe } from '../data/kitchenRecipes.js';
import { predictBowlAmounts } from '../ml/quantityRuntime.js';
import { swapsFor } from '../data/kitchenSwaps.js';
import {
  DISH_SKELETON_ORDER, DISH_SKELETONS, dishSkeleton, rankDishSlot, isMainKey,
} from '../data/dishSkeletons.js';
import {
  openBuild, applyCategory, clearCategory, checklist, recommendCategory, suggestNext, shortlist,
  addLine, removeLine, replaceLine, setSlot, buildKeys,
} from '../data/inventBuild.js';
import { buildFlavorProfile } from '../data/inventProfile.js';
import { toSavedItem } from '../data/inventSaved.js';
import { FONT, CHALK_CREAM, CHALK_DIM, CHALK_SUB, CHALK_RAIL, CHALK_SHADOW, chalkSurfaceStyle } from '../data/chalkTheme.js';
import { DishArt, ChalkLoader } from './chalkArt.jsx';
import InventStart from './InventStart.jsx';
import InventList from './InventList.jsx';
import { IngredientBuilderScope } from './IngredientCardProvider.jsx';
import InventChecklist from './InventChecklist.jsx';
import InventSuggestions from './InventSuggestions.jsx';
import InventDeck from './InventDeck.jsx';
import InventCategoryHint from './InventCategoryHint.jsx';
import InventCategoryPicker from './InventCategoryPicker.jsx';
import InventFlavorProfile from './InventFlavorProfile.jsx';
import InventNameSave from './InventNameSave.jsx';
import RecipeCookingMethod from './RecipeCookingMethod.jsx';
import { isSuggestable } from '../data/curation/suggestable.js';
import { useInventUsage } from '../hooks/useUsage.js';
import { noteTypedIngredient } from '../data/usageIngredient.js';

const RecipeFlavorProfilesCard = lazy(() => import('./RecipeFlavorProfilesCard.jsx'));

const SANS = 'system-ui, -apple-system, "Segoe UI", sans-serif';
const FOCUS = 'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2';
const ACCENT = '#a3e635';
const NO_PINS = [];
const NO_KITCHEN = [];
const MODEL_K = 300;
const MODEL_EXTRA = 4;
const COMMON_MAINS = ['chicken', 'beef', 'pork', 'salmon', 'shrimp', 'eggs', 'tofu', 'mushrooms'];
const lower = (s) => String(s || '').toLowerCase().trim();

const fresh = () => ({ started: false, build: openBuild({ lab: 'recipe' }), typeId: null, cuisine: null, name: '', edits: new Map(), editId: null });

export default function InventRecipe({
  kitchen = NO_KITCHEN, nodes = null, edges = null, seed = null, editItem = null, onSave = null, onClose, onWrite, onEditKitchen,
  onFindCocktail = null, onFindSauce = null, onFindWine = null,
}) {
  const names = useMemo(() => {
    if (!nodes) return new Set();
    return new Set(nodes instanceof Map ? nodes.keys() : Object.keys(nodes));
  }, [nodes]);
  const nodeMap = useMemo(() => (nodes instanceof Map ? nodes : (nodes ? new Map(Object.entries(nodes)) : null)), [nodes]);
  const everyday = useEverydayPairs();
  const curatedIndex = useMemo(() => (edges ? buildPairingIndex(edges, names) : null), [edges, names]);
  const pairingIndex = useMemo(() => blendIndex(curatedIndex, everyday), [curatedIndex, everyday]);
  const pantry = useMemo(() => kitchen.filter((k) => !isBasic(k)), [kitchen]);
  const kitchenSet = useMemo(() => new Set(kitchen.map(lower)), [kitchen]);
  const vocab = useMemo(() => [...names], [names]);

  const [model, setModel] = useState({ status: 'loading', data: null });
  const [real, setReal] = useState(null);
  const [scores, setScores] = useState(null); // Map name → model score for the current list
  const [showAllCuisines, setShowAllCuisines] = useState(false);
  const [amounts, setAmounts] = useState(new Map());
  const [openMethod, setOpenMethod] = useState(false);
  const [notice, setNotice] = useState(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [openPart, setOpenPart] = useState(null);
  const [hintOff, setHintOff] = useState(null); // the list signature "Not now" was pressed on
  const [deck, setDeck] = useState(null); // BUILDER-1: null | { mode: 'add' | 'replace', ingredient?, candidates }
  const [saveState, setSaveState] = useState({ status: 'idle', message: '' });
  const [profilesOpen, setProfilesOpen] = useState(false);
  const [swapPool, setSwapPool] = useState(new Map()); // missing line key → the model's same-category stand-ins
  const [chosenMethods, setChosenMethods] = useState([]); // BUILDER-2: cooking-method chips the cook picked
  // BUILDER-2: the method steps and the photo a handoff carried.
  const [handoffMethod, setHandoffMethod] = useState(() => (Array.isArray(seed?.steps) && seed.steps.length
    ? { steps: seed.steps.map(String), from: seed.stepsFrom || '' } : null));
  const [methodOpen, setMethodOpen] = useState(false);
  const [photoUrl, setPhotoUrl] = useState(null);
  const handoffFile = photoUrl && typeof File !== 'undefined' && seed?.image instanceof File ? seed.image : null;
  // PICTURE-4: undefined = untouched (an edited dish keeps its own); null = none; else the chooser's value.
  const [picture, setPicture] = useState(undefined);

  const [state, setState] = useState(() => {
    if (editItem && Array.isArray(editItem.lines)) {
      const cat = editItem.baseline?.category;
      const typeId = DISH_SKELETONS[cat] ? cat : null;
      let build = openBuild({ lab: 'recipe', lines: editItem.lines.map((l) => ({ key: lower(l.key), source: 'user' })) });
      if (typeId) build = applyCategory(build, dishSkeleton(typeId, { nodes: nodeMap }));
      const edits = new Map(editItem.lines.filter((l) => l.amount).map((l) => [lower(l.key), String(l.amount)]));
      return { started: true, build, typeId, cuisine: null, name: String(editItem.name || ''), edits, editId: editItem.id ?? null };
    }
    const pins = (seed?.pinned || NO_PINS).map((p) => lower(p.key)).filter(Boolean);
    const main = seed?.main ? lower(seed.main) : null;
    const keys = [...new Set([...(main ? [main] : []), ...pins])];
    const ownKeys = new Set((seed?.pinned || NO_PINS).filter((p) => p?.source === 'user').map((p) => lower(p.key)));
    const typeId = seed?.fromName && DISH_SKELETONS[seed.type] ? seed.type : null;
    let build = openBuild({ lab: 'recipe', lines: keys.map((key) => ({ key, source: ownKeys.has(key) ? 'user' : 'search' })) });
    if (typeId) build = applyCategory(build, dishSkeleton(typeId, { nodes: nodeMap }));
    const seededAmounts = new Map((seed?.pinned || NO_PINS).filter((p) => p?.key && p.amount).map((p) => [lower(p.key), String(p.amount)]));
    return {
      ...fresh(), started: keys.length > 0, build, typeId, cuisine: seed?.cuisine || null, edits: seededAmounts,
      name: typeof seed?.title === 'string' ? seed.title : '', editId: seed?.editId ?? null, replaces: seed?.replaces || '',
    };
  });
  const { started, build, typeId, cuisine, name, edits, editId, replaces } = state;
  const skeleton = typeId ? DISH_SKELETONS[typeId] : null;
  const invent = useInventUsage('recipe', { started, categoryId: typeId, editing: !!editItem });
  const patch = (p) => setState((st) => ({ ...st, ...p }));

  useEffect(() => {
    let live = true;
    loadInventModel()
      .then((data) => { if (live) setModel(data ? { status: 'ready', data } : { status: 'failed', data: null }); })
      .catch(() => { if (live) setModel({ status: 'failed', data: null }); });
    loadRealRecipes().then((data) => { if (live) setReal(data); }).catch(() => {});
    return () => { live = false; };
  }, []);

  useEffect(() => {
    const img = seed?.image;
    if (typeof img === 'string' && img) { setPhotoUrl(img); return undefined; }
    if (typeof File !== 'undefined' && img instanceof File && img.type?.startsWith('image/') && typeof URL.createObjectURL === 'function') {
      const url = URL.createObjectURL(img);
      setPhotoUrl(url);
      return () => { if (typeof URL.revokeObjectURL === 'function') URL.revokeObjectURL(url); };
    }
    return undefined;
  }, [seed?.image]);

  const suggest = model.data?.suggest;
  const keys = buildKeys(build);
  const keysSig = keys.join('|');

  // Model scores: one call per list or cuisine change, never per part; a result for an older list is dropped.
  const latest = useRef(0);
  useEffect(() => {
    if (!suggest || !keysSig) { setScores(null); return undefined; }
    const token = ++latest.current;
    Promise.resolve()
      .then(() => suggest(keysSig.split('|'), { cuisine, alpha: INVENT_ALPHA, k: MODEL_K }))
      .then((rows) => { if (token === latest.current) setScores(new Map((rows || []).map((r) => [lower(r.name), r.score]))); })
      .catch(() => { if (token === latest.current) setScores(null); });
    return () => { latest.current += 1; };
  }, [suggest, keysSig, cuisine]);

  // Suggested amounts for lines that have none yet.
  useEffect(() => {
    const need = keys.filter((n) => !amounts.has(n));
    if (need.length === 0) return undefined;
    let live = true;
    Promise.resolve().then(() => predictBowlAmounts(need)).then((rows) => {
      if (!live) return;
      setAmounts((prev) => {
        const next = new Map(prev);
        for (const { name: n, amount } of rows || []) next.set(n, amount);
        return next;
      });
    }).catch(() => {});
    return () => { live = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [keysSig, amounts]);

  const cuisineList = useMemo(() => cuisineOptions(model.data?.cuisineVocab), [model.data]);
  const leaning = useMemo(() => kitchenCuisines(pantry, nodes, model.data?.cuisineVocab, 4), [pantry, nodes, model.data]);
  const closest = useMemo(
    () => (skeleton && real && keys.length ? closestRealRecipe(keys, real.index, real.vocab) : null),
    [skeleton, real, keysSig], // eslint-disable-line react-hooks/exhaustive-deps
  );

  const keyFor = (text) => kitchenKey(text, names);
  const owns = (k) => haveIngredient(k, kitchenSet, { assumeBasics: true, names }).covered;
  const rank = ({ slot, currentKeys }) => rankDishSlot({ slot, currentKeys, kitchen, cuisine, nodes: nodeMap, pairingIndex, modelScores: scores });

  const skeletons = useMemo(
    () => DISH_SKELETON_ORDER.map((id) => ({ id, skeleton: dishSkeleton(id, { nodes: nodeMap }) })),
    [nodeMap],
  );
  const recommended = !typeId && started && keys.length >= 2 && hintOff !== keysSig
    ? recommendCategory(keys, skeletons, { order: DISH_SKELETON_ORDER })
    : null;

  const mainOptions = useMemo(() => {
    const own = pantry.map(lower).filter((k) => isMainKey(k, nodeMap)).map((key) => ({ key, have: true }));
    const seen = new Set(own.map((o) => o.key));
    const common = COMMON_MAINS.filter((k) => !seen.has(k) && (names.size === 0 || names.has(k))).map((key) => ({ key, have: kitchenSet.has(key) }));
    return [...own, ...common];
  }, [pantry, nodeMap, names, kitchenSet]);

  // The pairing-ranked list, plus the set-completion model's own top picks the ranking left out; kitchen first, no duplicates.
  // With no model (scores null) this is the pairing list alone.
  const suggestions = useMemo(() => {
    if (!keys.length) return [];
    const base = suggestNext(build, rank, 8).map((s) => ({ key: s.key, have: !!s.have, note: s.have ? undefined : "you'd need" }));
    if (!scores || !nodeMap) return base;
    const seen = new Set(base.map((b) => b.key));
    const extra = [];
    for (const [n] of [...scores.entries()].sort((a, b) => b[1] - a[1])) {
      if (extra.length >= MODEL_EXTRA) break;
      if (seen.has(n) || !nodeMap.has(n) || !isSuggestable(n, nodeMap) || isBasic(n) || isBasicLike(n) || keys.includes(n)) continue;
      if (!addLine(build, n, { source: 'user' }).ok) continue;
      const have = owns(n);
      extra.push({ key: n, have, note: have ? undefined : "you'd need" });
    }
    return [...base, ...extra].map((x, i) => ({ x, i })).sort((a, b) => ((b.x.have === true) - (a.x.have === true)) || (a.i - b.i)).map((o) => o.x);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [build, scores, cuisine, kitchen, nodeMap, pairingIndex]);
  const slotLines = build.slots.filter((s) => s.line).map((s) => ({ ...s.line, role: s.id }));
  const allLines = [...slotLines, ...build.extras.map((l) => ({ ...l, role: null }))];
  const amountOf = (k) => edits.get(k) ?? amounts.get(k)?.raw ?? '';
  const profileAmounts = Object.fromEntries(keys.map((k) => [k, amountOf(k)]));
  const amountSig = keys.map((k) => `${k}=${profileAmounts[k]}`).join('|');
  const profile = useMemo(() => buildFlavorProfile(keys, nodeMap, { noun: 'dish', amounts: profileAmounts }), [amountSig, nodeMap]); // eslint-disable-line react-hooks/exhaustive-deps
  const lines = allLines.map((l) => ({
    key: l.key, source: l.source, amount: amountOf(l.key) || undefined, have: kitchen.length ? owns(l.key) : undefined,
  }));

  // Smart swaps: for each line the cook lacks, the model's same-category stand-ins (asked with that line left out).
  const missingSig = lines.filter((l) => l.have === false).map((l) => l.key).join('|');
  useEffect(() => {
    if (!suggest || !missingSig || !nodeMap) { setSwapPool((p) => (p.size ? new Map() : p)); return undefined; }
    let live = true;
    Promise.all(missingSig.split('|').map(async (k) => {
      const cat = nodeMap.get(k)?.category;
      const candidateNames = cat ? [...nodeMap.keys()].filter((n) => n !== k && nodeMap.get(n)?.category === cat) : undefined;
      try {
        const rows = await suggest(keysSig.split('|').filter((x) => x !== k), { cuisine, alpha: INVENT_ALPHA, k: MODEL_K, candidateNames });
        return [k, (rows || []).map((r) => lower(r.name))];
      } catch { return [k, []]; }
    })).then((entries) => { if (live) setSwapPool(new Map(entries)); });
    return () => { live = false; };
  }, [suggest, missingSig, keysSig, cuisine, nodeMap]);

  // The build as BowlEntry[] for the Flavor Profiles card: the same names and amounts the panel's own profile reads.
  const entryAmount = (k) => {
    const typed = edits.get(k);
    if (typed != null && typed.trim()) return { raw: typed, qty: null, unit: null, inferred: false, ...(parseAmount(typed) || {}) };
    return amounts.get(k) || null;
  };
  const bowlEntries = keys.map((k) => ({ ingredient: k, amount: entryAmount(k) }));

  // ---- actions
  const reset = (extra = {}) => { setNotice(null); setOpenPart(null); setPickerOpen(false); setHintOff(null); setSaveState({ status: 'idle', message: '' }); patch(extra); };
  const add = (key, extra = {}) => {
    const r = addLine(build, key, { source: 'user', ...extra });
    if (!r.ok) { setNotice(r.reason || `${key} can't go in.`); return false; }
    setNotice(null);
    patch({ build: r.build });
    return true;
  };
  const addFromCard = (name, amount) => {
    const k = lower(name);
    if (!add(k)) return;
    if (amount && typeof amount === 'object') setAmounts((prev) => new Map(prev).set(k, amount));
    else if (typeof amount === 'string' && amount.trim()) setState((st) => ({ ...st, edits: new Map(st.edits).set(k, amount) }));
  };
  const addTyped = (text) => { const k = keyFor(text); if (k) noteTypedIngredient('recipe', text, names); return k ? add(k) : false; };
  const start = (text) => {
    const k = keyFor(text);
    if (!k) return;
    noteTypedIngredient('recipe', text, names);
    const r = addLine(openBuild({ lab: 'recipe' }), k, { source: 'user' });
    if (r.ok) reset({ started: true, build: r.build });
  };
  const pickType = (id) => {
    const b = id == null ? clearCategory(build) : applyCategory(build, dishSkeleton(id, { nodes: nodeMap }));
    reset({ typeId: id, build: b });
    setPickerOpen(false);
  };
  const remove = (k) => { setNotice(null); patch({ build: removeLine(build, k) }); };
  const setAmount = (k, text) => setState((st) => { const e = new Map(st.edits); e.set(k, text); return { ...st, edits: e }; });
  const replaceOptions = (k) => {
    const taken = new Set(keys);
    const out = [];
    for (const s of swapsFor(k)) {
      const use = keyFor(s.use);
      if (!use || taken.has(use) || out.some((o) => o.key === use)) continue;
      if (s.supportingOnly && isMainKey(k, nodeMap)) continue;
      if (!owns(s.use) || !s.plus.every(owns)) continue;
      out.push({ key: use, note: s.plus.length ? `with ${s.plus.join(', ')}` : undefined });
    }
    const cat = nodeMap?.get(k)?.category;
    for (const n of swapPool.get(k) || []) {
      if (out.length >= 8) break;
      if (taken.has(n) || out.some((o) => o.key === n) || !nodeMap?.has(n) || !isSuggestable(n, nodeMap) || isBasic(n) || isBasicLike(n)) continue;
      if (cat && nodeMap.get(n)?.category !== cat) continue;
      if (!owns(n)) continue;
      out.push({ key: n, note: 'model pick' });
    }
    return out;
  };
  const replace = (oldKey, newKey) => {
    const r = replaceLine(build, oldKey, newKey, { have: true });
    if (!r.ok) { setNotice(r.reason); return; }
    setNotice(null);
    setState((st) => {
      const e = new Map(st.edits);
      if (e.has(oldKey)) { e.set(newKey, e.get(oldKey)); e.delete(oldKey); }
      return { ...st, build: r.build, edits: e };
    });
  };
  const pickForPart = (slotId, key) => {
    const r = setSlot(build, slotId, key, { have: kitchenSet.has(key) });
    if (!r.ok) { setNotice(r.reason); return; }
    setNotice(null);
    setOpenPart(null);
    patch({ build: r.build });
  };
  const partOptions = (slotId) => shortlist(build, slotId, (slot, currentKeys) => rank({ slot, currentKeys }), 8)
    .map((c) => ({ key: c.key, have: !!c.have, note: c.have ? undefined : "you'd need" }));

  const savedLines = allLines.map((l) => ({ key: l.key, amount: amountOf(l.key), role: l.role }));
  const savedInput = {
    kind: 'recipe', ...(editId ? { id: editId } : {}), name, category: typeId || null, lines: savedLines,
    ...(skeleton ? { method: skeleton.method } : {}), ...(cuisine ? { cuisine } : {}),
    ...(picture !== undefined ? { picture } : {}),
    ...(replaces ? { replacesName: replaces } : {}),
  };
  const check = toSavedItem(savedInput);
  const [lastSaved, setLastSaved] = useState(null);
  const save = async () => {
    if (!onSave || !check.ok) return;
    setSaveState({ status: 'saving', message: '' });
    try {
      const res = await onSave(savedInput);
      setSaveState({ status: res?.status || 'saved', message: res?.message || '', pictureReason: res?.pictureReason || '' });
      if ((res?.status || 'saved') === 'saved') setLastSaved(picture === undefined && editItem?.picture ? { ...savedInput, picture: editItem.picture } : savedInput);
    } catch (e) {
      setSaveState({ status: 'error', message: 'Could not save. Try again.' });
    }
  };

  const write = () => {
    const amountMap = new Map();
    for (const k of keys) {
      const typed = edits.get(k);
      if (typed != null && typed.trim()) amountMap.set(k, { raw: typed, qty: null, unit: null, inferred: false, ...(parseAmount(typed) || {}) });
      else if (amounts.get(k)) amountMap.set(k, amounts.get(k));
    }
    onWrite?.(inventionHandoff(
      { name: name.trim() || 'Untitled dish', ingredients: keys.map((n) => ({ name: n })), type: typeId, cuisine },
      { amounts: amountMap, closest: skeleton ? closest : null },
    ));
  };

  const chip = (active) => ({
    fontFamily: FONT, color: active ? '#0a0a0a' : CHALK_CREAM, background: active ? CHALK_CREAM : 'transparent', borderColor: CHALK_RAIL, outlineColor: CHALK_CREAM,
  });
  const btn = { fontFamily: FONT, fontSize: 18, borderColor: CHALK_RAIL, color: CHALK_CREAM, outlineColor: CHALK_CREAM };
  const cuisineChips = showAllCuisines ? cuisineList : [...new Set([...leaning, ...(cuisine ? [cuisine] : [])])];
  const typeOptions = DISH_SKELETON_ORDER.map((id) => {
    const d = DISH_SKELETONS[id];
    return { id, label: d.label, blurb: d.blurb, art: <DishArt kind={d.dishType} accent={ACCENT} size={30} /> };
  });
  const dishLine = [skeleton?.label, cuisine].filter(Boolean).join(' · ');
  const rule = { color: CHALK_SUB };

  return (
    <IngredientBuilderScope onAdd={(k) => { add(k); }} has={(k) => keys.includes(k)} addLabel="Add to this recipe">
    <div className="fixed inset-x-0 top-0 safe-top-pad z-[83] flex flex-col items-center px-4 py-3 overflow-y-auto overflow-x-hidden"
      style={{ ...chalkSurfaceStyle(), bottom: 'var(--tab-bar-h)', color: CHALK_CREAM }}
      data-testid="invent-recipe" role="dialog" aria-label="Build a recipe">
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

      <div className="w-full max-w-[560px] rounded-2xl px-4 py-4 flex flex-col gap-4" style={{ border: `2px double ${CHALK_RAIL}`, background: 'rgba(255,255,255,0.025)' }}>
        <div>
          <h2 className="text-center text-[34px] leading-tight" style={{ fontFamily: FONT, textShadow: CHALK_SHADOW }}>{editId ? 'Edit your recipe' : 'Build a recipe'}</h2>
          <p className="text-center text-[13px]" style={{ fontFamily: SANS, color: CHALK_SUB }} data-testid="invent-recipe-source">
            {pantry.length
              ? `Your kitchen (${pantry.length} item${pantry.length === 1 ? '' : 's'}) comes first; anything else is marked “you'd need”.`
              : 'Your kitchen is empty, so this draws on common ingredients.'}
          </p>
          {model.status === 'loading' && <div className="py-1"><ChalkLoader compact label="Warming up the recipe model…" color={ACCENT} /></div>}
          {model.status === 'failed' && (
            <p className="text-center text-[12px] mt-1" style={{ fontFamily: SANS, color: CHALK_DIM }} data-testid="invent-recipe-no-model" role="status">
              Suggestions are running without the recipe model (offline?) — pairings still guide them.
            </p>
          )}
        </div>

        {!started && (
          <InventStart testidPrefix="invent-recipe-start" question="What is the main ingredient?" options={mainOptions}
            placeholder="or type any main ingredient" labels={{ go: 'Use', have: 'have' }} onPick={start} />
        )}

        {started && (
          <>
            <InventCategoryPicker testidPrefix="invent-recipe-category" title="A particular kind of dish? (optional)" options={typeOptions}
              value={typeId} open={pickerOpen} onToggle={() => setPickerOpen((o) => !o)} onChange={pickType}
              labels={{ none: 'No particular kind', noneBlurb: 'Choose your own ingredients; we suggest as you go.' }} />

            {cuisineList.length > 0 && (
              <div>
                <p className="text-[12px] uppercase tracking-wider mb-1" style={rule}>Cuisine (optional, steers suggestions)</p>
                <div className="flex flex-wrap gap-1.5" role="group" aria-label="Cuisine" data-testid="invent-recipe-cuisines">
                  <button type="button" aria-pressed={cuisine === null} onClick={() => patch({ cuisine: null })}
                    className={`px-3 py-1 rounded-full border min-h-[44px] text-[17px] ${FOCUS}`} style={chip(cuisine === null)}>any</button>
                  {cuisineChips.map((c) => (
                    <button key={c} type="button" aria-pressed={cuisine === c} onClick={() => patch({ cuisine: c })}
                      className={`px-3 py-1 rounded-full border min-h-[44px] text-[17px] ${FOCUS}`} style={chip(cuisine === c)}>{c}</button>
                  ))}
                  <button type="button" onClick={() => setShowAllCuisines((s) => !s)} aria-expanded={showAllCuisines}
                    className={`px-3 py-1 rounded-full border min-h-[44px] text-[16px] ${FOCUS}`} style={{ ...chip(false), borderStyle: 'dashed', color: CHALK_DIM }}>
                    {showAllCuisines ? 'fewer' : `all ${cuisineList.length}…`}
                  </button>
                </div>
              </div>
            )}

            <InventList testidPrefix="invent-recipe-list" lines={lines} vocab={vocab} notice={notice}
              onAdd={addTyped} onRemove={remove} onAmount={setAmount} replacementsFor={replaceOptions} onReplace={replace}
              onReplaceDeck={(k, cands) => setDeck({ mode: 'replace', ingredient: k, candidates: cands })} />

            {recommended && (
              <InventCategoryHint testidPrefix="invent-recipe-hint" label={DISH_SKELETONS[recommended.id].label} blurb={DISH_SKELETONS[recommended.id].blurb}
                onAccept={() => pickType(recommended.id)} onDismiss={() => setHintOff(keysSig)} />
            )}

            {skeleton && (
              <InventChecklist testidPrefix="invent-recipe-checklist" title={`${skeleton.label} usually have`} items={checklist(build)}
                openId={openPart} onOpen={(id) => setOpenPart((o) => (o === id ? null : id))} optionsFor={partOptions} onPick={pickForPart} />
            )}

            <InventSuggestions testidPrefix="invent-recipe-suggest" title="Goes well with what you have" items={suggestions} onAdd={(k) => add(k)}
              onDeck={() => setDeck({ mode: 'add', candidates: suggestions.map((x) => x.key) })} />

            {keys.length > 0 && (
              <InventFlavorProfile testidPrefix="invent-recipe-profile" title="Flavor profile" profile={profile} />
            )}

            {keys.length >= 3 && nodeMap && (
              <button type="button" onClick={() => setProfilesOpen(true)} data-testid="invent-recipe-profiles"
                className={`w-full px-3 py-2 rounded-lg border min-h-[44px] text-left ${FOCUS}`} style={btn}>
                ◆ Flavor Profiles — each note, what to boost or temper
              </button>
            )}

            {keys.length >= 3 && (
              <div data-testid="invent-recipe-cooking">
                <RecipeCookingMethod bowlNames={keys} chalk selected={chosenMethods}
                  onToggle={(m) => setChosenMethods((cur) => (cur.includes(m) ? cur.filter((x) => x !== m) : [...cur, m]))} />
              </div>
            )}

            {keys.length > 0 && (onFindCocktail || onFindSauce || onFindWine) && (
              <div data-testid="invent-recipe-serve">
                <p className="text-[12px] uppercase tracking-wider mb-1" style={rule}>Serve it with</p>
                <div className="flex flex-wrap gap-2">
                  {onFindCocktail && (
                    <button type="button" onClick={() => onFindCocktail(keys, name.trim())} data-testid="invent-recipe-find-cocktail"
                      className={`px-3 py-2 rounded-lg border min-h-[44px] ${FOCUS}`} style={{ ...btn, fontSize: 17 }}>🍸 Find a cocktail</button>
                  )}
                  {onFindSauce && (
                    <button type="button" onClick={() => onFindSauce(keys, name.trim())} data-testid="invent-recipe-find-sauce"
                      className={`px-3 py-2 rounded-lg border min-h-[44px] ${FOCUS}`} style={{ ...btn, fontSize: 17 }}>🥣 Need a sauce</button>
                  )}
                  {onFindWine && (
                    <button type="button" onClick={() => onFindWine(keys, name.trim())} data-testid="invent-recipe-find-wine"
                      className={`px-3 py-2 rounded-lg border min-h-[44px] ${FOCUS}`} style={{ ...btn, fontSize: 17 }}>🍷 Find wines</button>
                  )}
                </div>
              </div>
            )}

            {photoUrl && (
              <div className="flex items-start gap-2" data-testid="invent-recipe-photo">
                <img src={photoUrl} alt="Recipe photo" data-testid="invent-recipe-photo-img" className="rounded-lg object-cover min-w-0"
                  style={{ height: 96, maxWidth: '60%', border: `1px solid ${CHALK_RAIL}` }} />
                <button type="button" onClick={() => setPhotoUrl(null)} aria-label="Remove recipe photo" data-testid="invent-recipe-photo-remove"
                  className={`min-h-[44px] min-w-[44px] rounded-full border ${FOCUS}`} style={btn}>×</button>
              </div>
            )}

            {handoffMethod && (
              <div data-testid="invent-recipe-handoff-method">
                <button type="button" onClick={() => setMethodOpen((o) => !o)} aria-expanded={methodOpen}
                  className={`w-full min-h-[44px] flex items-center justify-between gap-2 rounded-lg px-3 text-left ${FOCUS}`}
                  style={{ fontFamily: FONT, color: CHALK_CREAM, border: `1px dashed ${CHALK_RAIL}`, outlineColor: CHALK_CREAM }}>
                  <span className="text-[19px] leading-tight min-w-0">
                    Method ({handoffMethod.steps.length} steps)
                    {handoffMethod.from && handoffMethod.from !== name && (
                      <span className="block text-[14px]" style={{ color: CHALK_SUB }}>from “{handoffMethod.from}”</span>
                    )}
                  </span>
                  <span aria-hidden="true">{methodOpen ? '▾' : '▸'}</span>
                </button>
                {methodOpen && (
                  <ol className="mt-2 space-y-1.5 list-decimal pl-6 text-[14px] leading-snug" style={{ fontFamily: SANS, color: CHALK_CREAM }} data-testid="invent-recipe-handoff-steps">
                    {handoffMethod.steps.map((st, i) => <li key={i}>{st}</li>)}
                  </ol>
                )}
              </div>
            )}

            {skeleton && (
              <div className="min-w-0">
                <p className="text-[12px]" style={{ fontFamily: SANS, color: CHALK_DIM }} data-testid="invent-recipe-dishline">{dishLine}</p>
                <p className="mt-1 text-[14px]" style={{ fontFamily: SANS, color: CHALK_CREAM }} data-testid="invent-recipe-method">{skeleton.method}</p>
                <p className="mt-1 text-[12px]" style={{ fontFamily: SANS, color: CHALK_SUB }}>plus salt, pepper and oil to taste</p>
                {closest && (
                  <div className="mt-2" data-testid="invent-recipe-closest">
                    <p className="text-[12px] uppercase tracking-wider" style={rule}>Closest real recipe</p>
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
              </div>
            )}
            <p className="text-[12px] italic" style={{ fontFamily: SANS, color: CHALK_DIM }} data-testid="invent-recipe-note">
              An idea from what pairs, not a tested recipe — taste as you go.
            </p>

            {onSave && (
              <InventNameSave testidPrefix="invent-recipe-namesave" name={name} placeholder="Name your dish" saveLabel="Add to my recipes"
                canSave={check.ok} disabledReason={check.ok ? undefined : check.reason}
                status={saveState.status} message={saveState.message}
                pictureField={{ kind: 'dish', value: picture, onChange: setPicture, item: editItem, initialPhoto: handoffFile }} pictureNote={saveState.pictureReason}
                shareItem={lastSaved ? { kind: 'recipe', item: lastSaved } : null}
                onNameCommit={invent.named} onName={(t) => { setSaveState({ status: 'idle', message: '' }); patch({ name: t }); }} onSave={save} />
            )}

            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={() => { setState(fresh()); setPicture(undefined); setHandoffMethod(null); setPhotoUrl(null); setChosenMethods([]); setProfilesOpen(false); reset(); }} data-testid="invent-recipe-restart"
                className={`px-3 py-2 rounded-lg border min-h-[44px] ${FOCUS}`} style={btn}>
                Start over
              </button>
              {onWrite && (
                <button type="button" onClick={write} disabled={!keys.length} data-testid="invent-recipe-write"
                  className={`flex-1 px-3 py-2 rounded-lg min-h-[44px] ${FOCUS}`}
                  style={{ fontFamily: FONT, fontSize: 19, color: '#0a0a0a', background: CHALK_CREAM, outlineColor: CHALK_CREAM, opacity: keys.length ? 1 : 0.5 }}>
                  Write it in the Recipe Notebook →
                </button>
              )}
            </div>
          </>
        )}
      </div>
      {profilesOpen && nodeMap && (
        <div className="fixed inset-x-0 top-0 z-[95]" style={{ bottom: 'var(--tab-bar-h)' }} data-testid="invent-recipe-profiles-overlay">
          <Suspense fallback={<ChalkLoader compact label="Opening the flavor profiles…" color={ACCENT} />}>
            <RecipeFlavorProfilesCard
              bowlNames={keys}
              bowlEntries={bowlEntries}
              nodes={nodeMap}
              edges={edges}
              recipeType={null}
              onAdd={addFromCard}
              onFindCocktail={onFindCocktail ? () => onFindCocktail(keys, name.trim()) : null}
              onFindSauce={onFindSauce ? () => onFindSauce(keys, name.trim()) : null}
              onFindWine={onFindWine ? () => onFindWine(keys, name.trim()) : null}
              onClose={() => setProfilesOpen(false)}
            />
          </Suspense>
        </div>
      )}
      {deck && (
        <InventDeck mode={deck.mode} ingredient={deck.ingredient} keys={keys} amounts={profileAmounts} nodes={nodeMap} candidates={deck.candidates}
          onAdd={(k) => add(k)} onSwap={replace} onClose={() => setDeck(null)} />
      )}
    </div>
    </IngredientBuilderScope>
  );
}
