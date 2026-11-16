/**
 * InventCocktail — "Invent a cocktail" for the Cocktail Lab. Starts EMPTY: the
 * panel never adds an ingredient or a name on its own.
 *
 *   1. Which liquor?  (the bar's base spirits first, then the common liquors,
 *      a text box). Nothing else shows until this is answered.
 *   2. Your ingredients: add by typing or from suggestions, remove, edit the
 *      suggested amounts; a line the cook does not have offers same-role
 *      stand-ins from what they do have.
 *   3. Going for a particular style? (optional, collapsed). Choosing one shows
 *      a checklist of the parts that style usually has; with none chosen, two
 *      or more ingredients get a RECOMMENDED style, applied only on Accept.
 *   4. Goes well with what you have; the flavor profile of the drink.
 *   5. Glass, method, why-line and closest cocktails appear once a style is
 *      chosen or accepted. The cook names it and adds it to their cocktails.
 *
 * Props: bar (stock: bottles + kitchen), kitchen (optional extra stock),
 * cocktails, families, roles, pool, pairingIndex, nodes (Map name -> { taste }, may
 * be null), seed ({ familyId?, fromName?, base?, pinned }), editItem
 * ({ id, name, baseline: { category }, lines: [{ key, amount, role }] }),
 * onSave(input) → Promise<{ status: 'saved'|'signin'|'error', message? }>,
 * onClose, onRiff, onOpenRecipeLab, onSelectCocktail.
 * onSave input: { kind: 'cocktail', id?, name, category: familyId|null,
 * lines: [{ key, amount, role }], method?, glass? } (the argument of toSavedItem).
 */
import { useMemo, useState } from 'react';
import {
  cocktailSkeleton, cocktailAdviceRules, rankCocktailSlot, liquorChoices, drinkFromBuild, drinkRows, drinkAsCocktail, isBaseSpirit, extraAmount,
  FAMILY_SKELETONS, FAMILY_BLURB, INVENT_FAMILY_ORDER,
} from '../data/cocktailInvent.js';
import {
  openBuild, applyCategory, clearCategory, hasCategory, checklist, advice, recommendCategory, suggestNext, shortlist,
  addLine, removeLine, replaceLine, setSlot, buildKeys,
} from '../data/inventBuild.js';
import { buildFlavorProfile } from '../data/inventProfile.js';
import { nearestCocktails, swapCandidates, roleOf } from '../data/cocktailRiff.js';
import { SLOT_DEFAULT_AMOUNT } from '../data/cocktailAmounts.js';
import { barKey, barRolePool, coverLine, stockFor } from '../data/myBar.js';
import { FONT, CHALK_CREAM, CHALK_DIM, CHALK_SUB, CHALK_RAIL, CHALK_SHADOW, chalkSurfaceStyle } from '../data/chalkTheme.js';
import { CocktailFamilyGlass, DrinkGlass } from './cocktailGlasses.jsx';
import { drinkColor } from '../data/drinkColor.js';
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
import { useInventUsage } from '../hooks/useUsage.js';
import { noteTypedIngredient } from '../data/usageIngredient.js';

const SANS = 'system-ui, -apple-system, "Segoe UI", sans-serif';
const NEUTRAL = '#9a8f7a';
const NO_PINS = [];
const NO_STOCK = [];
const article = (w) => `${/^[aeiou]/i.test(w) ? 'An' : 'A'} ${w}`;

export default function InventCocktail({
  bar = NO_STOCK,
  kitchen = NO_STOCK,
  cocktails = [],
  families = [],
  roles = {},
  pool = null,
  pairingIndex = null,
  nodes = null,
  seed = null,
  editItem = null,
  onSave,
  onClose,
  onRiff,
  onOpenRecipeLab,
  onSelectCocktail,
}) {
  const names = pairingIndex?.names || new Set();
  const stock = useMemo(() => stockFor(bar, kitchen), [bar, kitchen]);
  const stockSet = useMemo(() => new Set(stock), [stock]);
  const familyById = useMemo(() => new Map((families || []).map((f) => [f.id, f])), [families]);
  const adviceRules = useMemo(() => cocktailAdviceRules(roles), [roles]);
  const skeletons = useMemo(() => INVENT_FAMILY_ORDER.map((id) => ({ id, skeleton: cocktailSkeleton(id, { roles }) })), [roles]);

  const keyFor = (text) => barKey(text, names) || String(text).trim().toLowerCase();
  const familyName = (id) => familyById.get(id)?.name || FAMILY_SKELETONS[id]?.name || '';
  const familyColor = (id) => familyById.get(id)?.color || NEUTRAL;

  const emptyState = () => ({
    started: false, categoryId: null, build: openBuild({ lab: 'cocktail', rules: adviceRules }), edited: {}, name: '', itemId: undefined,
  });
  const initialState = () => {
    const base = emptyState();
    if (editItem) {
      let build = openBuild({ lab: 'cocktail', rules: adviceRules, lines: (editItem.lines || []).map((l) => ({ key: l.key, source: 'user' })) });
      const cat = editItem.baseline?.category;
      if (cat != null && FAMILY_SKELETONS[cat]) build = applyCategory(build, cocktailSkeleton(cat, { roles }));
      const edited = {};
      for (const l of editItem.lines || []) if (l.amount) edited[l.key] = l.amount;
      return { ...base, started: true, build, categoryId: cat != null && FAMILY_SKELETONS[cat] ? cat : null, edited, name: editItem.name || '', itemId: editItem.id };
    }
    const pinned = seed?.pinned || NO_PINS;
    if (seed && (pinned.length || seed.base)) {
      const lines = pinned.map((p) => ({ key: p.key, source: p.source || 'search' }));
      if (seed.base && !lines.some((l) => l.key === seed.base)) lines.unshift({ key: seed.base, source: 'user' });
      let build = openBuild({ lab: 'cocktail', rules: adviceRules, lines });
      const named = seed.fromName && FAMILY_SKELETONS[seed.familyId];
      if (named) build = applyCategory(build, cocktailSkeleton(seed.familyId, { roles }));
      return { ...base, started: true, build, categoryId: named ? seed.familyId : null };
    }
    return base;
  };

  const [st, setSt] = useState(initialState);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [openPart, setOpenPart] = useState(null);
  const [notice, setNotice] = useState(null);
  const [hintOff, setHintOff] = useState(null);
  const [deck, setDeck] = useState(null); // BUILDER-1: null | { mode: 'add' | 'replace', ingredient?, candidates }
  const [saveState, setSaveState] = useState({ status: 'idle', message: '' });
  // PICTURE-4: undefined = the cook has not touched the picture (an edited drink keeps its own); null = none; else the chooser's value.
  const [picture, setPicture] = useState(undefined);
  const { started, categoryId, build, edited, name } = st;
  const invent = useInventUsage('cocktail', { started, categoryId, editing: !!editItem });
  const patch = (p) => setSt((s) => ({ ...s, ...p }));

  const keys = buildKeys(build);
  const styled = categoryId != null && hasCategory(build);
  const hasList = keys.length > 0;

  const owned = (key) => {
    if (!stockSet.size) return undefined;
    const c = coverLine({ key, role: roleOf(key, roles) }, stockSet, roles);
    return !!(c.covered && !c.substitution);
  };

  const rank = ({ slot, currentKeys }) => rankCocktailSlot({ slot, currentKeys, bar: stock, pool, roles, pairingIndex });

  // Step 1: the base spirits the cook has, then the common liquors.
  const startOptions = useMemo(() => liquorChoices({ stock, roles }), [stock, roles]);

  const add = (text, extra = {}) => {
    const key = keyFor(text);
    const res = addLine(build, key, { source: 'user', ...extra });
    if (!res.ok) { setNotice(res.reason); return false; }
    setNotice(null);
    patch({ build: res.build });
    setSaveState({ status: 'idle', message: '' });
    return undefined;
  };
  const startWith = (text) => {
    const key = keyFor(text);
    if (!key) return;
    noteTypedIngredient('cocktail', text, names);
    const res = addLine(build, key, { source: 'user' });
    patch({ started: true, ...(res.ok ? { build: res.build } : {}) });
  };
  const remove = (key) => {
    const e = { ...edited }; delete e[key];
    patch({ build: removeLine(build, key), edited: e });
    setNotice(null);
  };
  const replace = (oldKey, newKey) => {
    const res = replaceLine(build, oldKey, newKey, { source: 'user', have: true });
    if (!res.ok) { setNotice(res.reason); return; }
    const e = { ...edited };
    if (e[oldKey] !== undefined) { e[newKey] = e[oldKey]; delete e[oldKey]; }
    patch({ build: res.build, edited: e });
    setNotice(null);
  };
  const pickCategory = (id) => {
    setOpenPart(null);
    if (id == null) patch({ categoryId: null, build: clearCategory(build) });
    else patch({ categoryId: id, build: applyCategory(build, cocktailSkeleton(id, { roles })) });
  };
  const pickPart = (slotId, key) => {
    const res = setSlot(build, slotId, key, { source: 'user' });
    if (!res.ok) { setNotice(res.reason); return; }
    setNotice(null); setOpenPart(null);
    patch({ build: res.build });
  };

  // What each line pours: the cook's own text, else the style's proportions, else a role default.
  const drink = useMemo(
    () => (styled ? drinkFromBuild(build, { familyId: categoryId, familyName: familyName(categoryId), roles, pairingIndex }) : null),
    [styled, build, categoryId, roles, pairingIndex, familyById], // eslint-disable-line react-hooks/exhaustive-deps
  );
  const styledAmounts = useMemo(() => new Map((drink?.lines || []).map((l) => [l.key, l.amount])), [drink]);
  const amountFor = (key) => {
    if (edited[key] !== undefined) return edited[key];
    if (styled && styledAmounts.has(key)) return styledAmounts.get(key);
    const role = roleOf(key, roles);
    return SLOT_DEFAULT_AMOUNT[role] || extraAmount(key, role);
  };

  const lines = [...build.slots.filter((s) => s.line).map((s) => s.line), ...build.extras]
    .map((l) => ({ key: l.key, source: l.source, amount: amountFor(l.key), have: owned(l.key) }));

  const replacementsFor = (key) => {
    const rows = lines.map((l) => ({ key: l.key, role: roleOf(l.key, roles), swappable: true }));
    const idx = rows.findIndex((r) => r.key === key);
    if (idx < 0) return [];
    const mine = barRolePool(stock, roles, rows[idx]);
    return swapCandidates(rows, idx, mine, pairingIndex, 6).map((c) => ({ key: c.name, note: c.reason }));
  };

  const optionsFor = (slotId) => shortlist(build, slotId, (slot, currentKeys) => rank({ slot, currentKeys }), 8)
    .map((c) => ({ key: c.key, have: !!c.have, note: stockSet.size && !c.have ? 'not in your bar' : undefined }));
  const suggestions = hasList
    ? suggestNext(build, rank, 8).map((c) => ({ key: c.key, have: !!c.have, note: stockSet.size && !c.have ? 'not in your bar' : undefined }))
    : [];

  const sig = keys.join('|');
  const rec = !styled && keys.length >= 2 && hintOff !== sig ? recommendCategory(keys, skeletons, { order: INVENT_FAMILY_ORDER }) : null;

  // The taste half is weighted by what each line pours, so a dash of bitters does not count like 2 oz of spirit.
  const profileAmounts = Object.fromEntries(keys.map((k) => [k, amountFor(k)]));
  const amountSig = keys.map((k) => `${k}=${profileAmounts[k]}`).join('|');
  const profile = useMemo(() => buildFlavorProfile(keys, nodes, { noun: 'drink', amounts: profileAmounts }), [amountSig, nodes]); // eslint-disable-line react-hooks/exhaustive-deps

  const finalDrink = drink ? { ...drink, lines: drink.lines.map((l) => ({ ...l, amount: amountFor(l.key) })) } : null;
  const nearest = useMemo(
    () => (finalDrink?.lines.length ? nearestCocktails(drinkRows(finalDrink), cocktails, names, { k: 3 }) : []),
    [drink, edited, cocktails, names], // eslint-disable-line react-hooks/exhaustive-deps
  );
  const color = styled ? familyColor(categoryId) : NEUTRAL;
  const pour = useMemo(() => (drink ? drinkColor(drink.lines.map((l) => l.key), color) : null), [drink, color]);

  const canSave = name.trim().length > 0 && keys.length >= 2;
  const disabledReason = !name.trim() ? 'Give it a name, then add it to your cocktails.' : 'Add at least two ingredients.';
  const [lastSaved, setLastSaved] = useState(null);
  const save = async () => {
    if (!onSave || !canSave) return;
    setSaveState({ status: 'saving', message: '' });
    const input = {
      kind: 'cocktail',
      ...(st.itemId !== undefined ? { id: st.itemId } : {}),
      name: name.trim(),
      category: styled ? categoryId : null,
      lines: lines.map((l) => ({ key: l.key, amount: l.amount || '', role: roleOf(l.key, roles) || null })),
      ...(styled ? { method: drink.build, glass: drink.glass } : {}),
      ...(picture !== undefined ? { picture } : {}),
    };
    let res;
    try { res = await onSave(input); } catch { res = { status: 'error', message: 'Could not save. Try again.' }; }
    setSaveState({ status: res?.status || 'error', message: res?.message || '', pictureReason: res?.pictureReason || '' });
    if (res?.status === 'saved') setLastSaved(picture === undefined && editItem?.picture ? { ...input, picture: editItem.picture } : input);
  };

  const pickerOptions = INVENT_FAMILY_ORDER.map((id) => ({
    id,
    label: familyName(id),
    blurb: `${FAMILY_BLURB[id]} · ${FAMILY_SKELETONS[id].glass.split(' or ')[0]}`,
    art: <CocktailFamilyGlass familyName={familyName(id)} color={familyColor(id)} liquid={familyColor(id)} size={30} testid={`invent-family-glass-${id}`} />,
  }));

  const btnStyle = { fontFamily: FONT, fontSize: 18, border: `1px solid ${CHALK_RAIL}`, color: CHALK_CREAM };
  const adviceNotes = advice(build);
  const vocab = useMemo(() => [...names].slice(0, 4000), [names]);

  return (
    <IngredientBuilderScope onAdd={(k) => { add(k); }} has={(k) => lines.some((l) => l.key === k)} addLabel="Add to this drink">
    <div className="fixed inset-x-0 top-0 safe-top-pad z-[82] flex flex-col items-center px-4 py-3 overflow-y-auto overflow-x-hidden"
      style={{ ...chalkSurfaceStyle(), bottom: 'var(--tab-bar-h)', color: CHALK_CREAM }}
      data-testid="invent-cocktail" role="dialog" aria-label="Invent a cocktail">
      <div className="w-full max-w-[560px] flex items-center justify-between mb-2">
        <button type="button" onClick={onClose} data-testid="invent-close" className="px-3 py-2 rounded-lg min-h-[44px]" style={btnStyle}>← Back</button>
      </div>

      <div className="w-full max-w-[560px] rounded-2xl px-4 py-4 flex flex-col gap-4 min-w-0" style={{ border: `2px double ${CHALK_RAIL}`, background: 'rgba(255,255,255,0.025)' }}>
        <h2 className="text-center text-[34px] leading-tight" style={{ fontFamily: FONT, textShadow: CHALK_SHADOW }}>Invent a cocktail</h2>

        {!started ? (
          <InventStart question="Which liquor do you want to use?" options={startOptions} onPick={startWith}
            placeholder="or type one" labels={{ go: 'Start' }} testidPrefix="invent-start" />
        ) : (
          <>
            <p className="text-center text-[13px] -mt-2" style={{ fontFamily: SANS, color: CHALK_SUB }} data-testid="invent-source">
              {stock.length
                ? `Marked against your bar and kitchen (${stock.length} item${stock.length === 1 ? '' : 's'}).`
                : 'Your bar is empty, so suggestions draw on every bottle in the cocktail list.'}
            </p>

            <InventList lines={lines} vocab={vocab} notice={notice} onAdd={(t) => { noteTypedIngredient('cocktail', t, names); return add(t); }} onRemove={remove}
              onAmount={(k, t) => patch({ edited: { ...edited, [k]: t } })}
              replacementsFor={replacementsFor} onReplace={replace} onReplaceDeck={(k, cands) => setDeck({ mode: 'replace', ingredient: k, candidates: cands })} testidPrefix="invent-list" />

            {adviceNotes.length > 0 && (
              <div data-testid="invent-advice">
                {adviceNotes.map((a) => (
                  <p key={a.kind} className="text-[13px]" style={{ fontFamily: SANS, color: CHALK_DIM }} data-testid={`invent-advice-${a.kind}`}>{a.message}</p>
                ))}
              </div>
            )}

            {rec && (
              <InventCategoryHint label={familyName(rec.id)} blurb={FAMILY_BLURB[rec.id]}
                onAccept={() => pickCategory(rec.id)} onDismiss={() => setHintOff(sig)} testidPrefix="invent-hint" />
            )}

            <InventCategoryPicker title="Going for a particular style? (optional)" options={pickerOptions} value={categoryId}
              onChange={pickCategory} open={pickerOpen} onToggle={() => setPickerOpen((o) => !o)} testidPrefix="invent-category" />

            {styled && (
              <InventChecklist title={`${article(FAMILY_SKELETONS[categoryId].word)} usually has`} items={checklist(build)} openId={openPart}
                onOpen={(id) => setOpenPart((o) => (o === id ? null : id))} optionsFor={optionsFor} onPick={pickPart} testidPrefix="invent-checklist" />
            )}

            <InventSuggestions title="Goes well with what you have" items={suggestions} onAdd={(k) => add(k)}
              onDeck={() => setDeck({ mode: 'add', candidates: suggestions.map((x) => x.key) })} testidPrefix="invent-suggest" />

            <div>
              <InventFlavorProfile profile={profile} title="Flavor profile of the drink" testidPrefix="invent-profile" />
              {!nodes && (
                <p className="mt-1 text-[12px]" style={{ fontFamily: SANS, color: CHALK_SUB }} data-testid="invent-profile-nodata">
                  No flavor data is loaded here, so the profile cannot be drawn yet.
                </p>
              )}
            </div>

            {styled && drink && (
              <article className="rounded-xl px-4 py-3" style={{ border: `1px solid ${color}aa`, background: `${color}1a` }} data-testid="invent-card">
                <div className="flex items-center gap-3 mb-2">
                  <span data-testid="invent-glass" data-color={pour.color} data-tinted={pour.tinted ? 'true' : 'false'} className="flex-shrink-0">
                    <CocktailFamilyGlass familyName={familyName(categoryId)} color={color} liquid={pour.color} size={92} testid="invent-drink-glass" />
                  </span>
                  <div className="flex-1 min-w-0">
                    <h3 className="text-[24px] leading-tight" style={{ fontFamily: FONT, textShadow: CHALK_SHADOW }} data-testid="invent-style">{familyName(categoryId)}</h3>
                    <p className="text-[12px]" style={{ fontFamily: SANS, color: CHALK_DIM }} data-testid="invent-method">{drink.build} · {drink.glass}</p>
                  </div>
                </div>
                <p className="text-[14px]" style={{ fontFamily: SANS, color: CHALK_CREAM }} data-testid="invent-why">{drink.why}</p>
                <p className="mt-1 text-[11px]" style={{ fontFamily: SANS, color: CHALK_SUB }}>Amounts are suggestions for the style, not a tested recipe. Taste and adjust.</p>
                {nearest.length > 0 && (
                  <div className="mt-3" data-testid="invent-nearest">
                    <p className="text-[12px] uppercase tracking-wider mb-1" style={{ color: CHALK_SUB }}>Closest existing cocktails</p>
                    {nearest.map((x) => (
                      <button key={x.cocktail.name} type="button" onClick={() => onSelectCocktail?.(x.cocktail.name)}
                        className="w-full text-left flex items-center gap-2 py-0.5 min-h-[44px]">
                        <DrinkGlass cocktail={x.cocktail} familyById={familyById} size={32} />
                        <span className="text-[19px]" style={{ fontFamily: FONT, color: CHALK_CREAM }}>{x.cocktail.name}</span>
                        <span className="text-[12px]" style={{ fontFamily: SANS, color: CHALK_DIM }}>{Math.round(x.similarity * 100)}% alike</span>
                      </button>
                    ))}
                  </div>
                )}
              </article>
            )}

            {onSave && (
              <InventNameSave name={name} onName={(t) => { patch({ name: t }); setSaveState({ status: 'idle', message: '' }); }}
                placeholder="Name your drink" onNameCommit={invent.named} canSave={canSave} disabledReason={disabledReason} saveLabel="Add to my cocktails"
                status={saveState.status} message={saveState.message} onSave={save} testidPrefix="invent-namesave"
                pictureField={{ kind: 'cocktail', value: picture, onChange: setPicture, item: editItem, color: pour?.color || undefined }} pictureNote={saveState.pictureReason}
                shareItem={lastSaved ? { kind: 'cocktail', item: lastSaved } : null} />
            )}

            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={() => { setSt(emptyState()); setPicture(undefined); setNotice(null); setHintOff(null); setOpenPart(null); setPickerOpen(false); setSaveState({ status: 'idle', message: '' }); }}
                data-testid="invent-restart" className="px-3 py-2 rounded-lg border min-h-[44px]" style={btnStyle}>Start over</button>
              {onRiff && styled && drink && (
                <button type="button" onClick={() => onRiff(drinkAsCocktail({ ...finalDrink, name: name.trim() || finalDrink.name }))} data-testid="invent-riff"
                  className="px-3 py-2 rounded-lg border min-h-[44px]" style={btnStyle}>Riff on it</button>
              )}
              {onOpenRecipeLab && hasList && (
                <button type="button" onClick={() => onOpenRecipeLab(keys)} data-testid="invent-notebook"
                  className="px-3 py-2 rounded-lg min-h-[44px]" style={{ fontFamily: FONT, fontSize: 18, color: '#0a0a0a', background: CHALK_CREAM }}>
                  Write it in the Recipe Notebook →
                </button>
              )}
            </div>
          </>
        )}
      </div>
      {deck && (
        <InventDeck mode={deck.mode} ingredient={deck.ingredient} keys={keys} amounts={profileAmounts} nodes={nodes} candidates={deck.candidates}
          onAdd={(k) => add(k)} onSwap={replace} onClose={() => setDeck(null)} />
      )}
    </div>
    </IngredientBuilderScope>
  );
}
