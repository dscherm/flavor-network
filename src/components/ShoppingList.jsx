/**
 * ShoppingList.jsx (SHOP-2) — the shopping list, as a chalkboard screen you tick off in the shop.
 *
 * Opened from the Labs menu. State and storage live in useUserProfile (profile.shopping: device first,
 * the account when signed in); this component only draws it and asks for changes:
 *   shopping   { list, removed } from profile.shopping
 *   onChange   (change, opts?) => void   change = (list) => nextList, built from src/data/shoppingList.js
 *              (useUserProfile.updateShopping makes the tombstones for whatever left the list)
 *   onClose    back to the Labs menu
 *   loadIngredients  () => Promise<{ names, vocab, categories }>, defaults to the lazy loader
 *
 * What is fetched when it opens: ingredients.json only (about 0.6 MB, curated names and categories, for the
 * add box and the aisles). Not the pairings, not the graph, not any model. Until it arrives (or if it fails)
 * every item sits in "other" and the add box takes free text only; the list itself works.
 *
 * "Add from a recipe" is ShoppingRecipeAdd (SHOP-3); props own / loadRecipes / recipeStock feed it (the cook's saved
 * items, a test loader, a test stock). Each unchecked row has "Store doesn't have it?" (SHOP-4, StoreAlternatives): up to three alternatives, replace with Undo,
 * or "Use what I have". prop loadRoles feeds the bar side (tests).
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  addLine, toggle, clearChecked, emptyList, groupByAisle, toText, itemAmountText, uncheckedCount,
  replaceItem, undoReplace, remove, makeHas,
} from '../data/shoppingList.js';
import { swappedAmount, restoreRow } from '../data/shoppingAlternatives.js';
import { IngredientName } from './IngredientCardProvider.jsx';
import { kitchenSuggestions } from '../data/kitchenRecipes.js';
import { loadKitchen, saveKitchen, addToKitchen } from '../data/myKitchen.js';
import { loadBar, saveBar, addToBar, isBooze } from '../data/myBar.js';
import { loadShoppingIngredients } from '../data/shoppingIngredients.js';
import { usage } from '../data/usageEvents.js';
import { loadUnitSystem, saveUnitSystem } from '../data/shoppingUnits.js';
import ShoppingRecipeAdd from './ShoppingRecipeAdd.jsx';
import StoreAlternatives from './StoreAlternatives.jsx';
import { FONT, CHALK_CREAM, CHALK_DIM, CHALK_SUB, CHALK_RAIL, chalkSurfaceStyle } from '../data/chalkTheme.js';

const SANS = 'system-ui, -apple-system, "Segoe UI", sans-serif';
const FOCUS = 'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2';
const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;
const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);

const buttonStyle = { fontFamily: SANS, fontSize: 14, color: CHALK_CREAM, border: `1.5px solid ${CHALK_DIM}`, background: 'transparent', outlineColor: CHALK_CREAM };
const inputStyle = { fontFamily: SANS, fontSize: 16, color: CHALK_CREAM, background: 'rgba(10,10,10,0.6)', border: `1.5px solid ${CHALK_DIM}`, outlineColor: CHALK_CREAM };

export default function ShoppingList({ shopping, onChange, onClose, loadIngredients = loadShoppingIngredients, own = null, loadRecipes, recipeStock, loadRoles }) {
  const list = shopping?.list || emptyList();
  const [ing, setIng] = useState({ status: 'loading', names: new Set(), vocab: [], categories: new Map() });
  const [text, setText] = useState('');
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [confirmClear, setConfirmClear] = useState(false);
  const [system, setSystem] = useState(() => loadUnitSystem()); // US or metric display; kept on this device only
  const chooseSystem = (s) => { setSystem(s); saveUnitSystem(s); };
  const keepRef = useRef(null);
  const addRef = useRef(null);
  const [sheetId, setSheetId] = useState(null); // the row whose alternatives are open
  const [removed, setRemoved] = useState(null); // { row, at, msg }: "Use what I have" can be undone while its message shows
  const altButtons = useRef(new Map());
  const companions = useRef(new Map()); // swapped row id -> ids of rows the swap added for its companion ingredient

  useEffect(() => {
    let live = true;
    loadIngredients()
      .then((d) => { if (live) setIng({ status: 'ready', names: d.names, vocab: d.vocab, categories: d.categories }); })
      .catch(() => { if (live) setIng((s) => ({ ...s, status: 'failed' })); });
    return () => { live = false; };
  }, [loadIngredients]);

  useEffect(() => { if (confirmClear) keepRef.current?.focus(); }, [confirmClear]);

  // shop_opened: once per opening of this screen (the ref also covers a development double-mount).
  const openedRef = useRef(false);
  useEffect(() => {
    if (openedRef.current) return;
    openedRef.current = true;
    usage.shopOpened();
  }, []);

  const groups = useMemo(() => groupByAisle(list, (k) => ing.categories.get(k)), [list, ing.categories]);
  const recipeName = useMemo(() => new Map(list.recipes.map((r) => [r.id, r.name])), [list.recipes]);
  const open = uncheckedCount(list);
  const checked = list.items.filter((i) => i.checked);
  const suggestions = useMemo(() => kitchenSuggestions(text, ing.vocab, [], 5), [text, ing.vocab]);
  const opts = { names: ing.names.size ? ing.names : null };

  const add = (line) => {
    const res = addLine(list, { ...line, amount: amount.trim() || undefined }, opts);
    if (res.status === 'empty') { setNote('Type what you need first.'); return; }
    if (res.status === 'capped') { setNote(res.message); return; }
    const name = res.item.label;
    const qty = itemAmountText(res.item, system);
    onChange((cur) => addLine(cur, { ...line, amount: amount.trim() || undefined }, opts).list);
    setNote(res.status === 'merged'
      ? (qty ? `Added to ${name}: now ${qty}.` : `${cap(name)} is already on your list.`)
      : `Added ${name}${qty ? ` (${qty})` : ''}.`);
    setText('');
    setAmount('');
    addRef.current?.focus();
  };

  const copy = async () => {
    const n = open;
    if (!n) { setNote('Nothing left to copy.'); return; }
    try {
      await navigator.clipboard.writeText(toText(list, { title: '', system }));
      setNote(`Copied ${plural(n, 'item', 'items')}.`);
    } catch {
      setNote('Could not copy here. Select the items and copy them by hand.');
    }
  };

  const clearDone = () => {
    const n = checked.length;
    onChange((cur) => clearChecked(cur));
    setNote(`Cleared ${plural(n, 'checked item', 'checked items')}.`);
  };

  // Rule: alcohol (isBooze: spirits, liqueurs, wine, beer, bitters, vermouth) goes to My bar; everything else to My kitchen.
  const putInKitchen = () => {
    const bar = checked.filter((i) => isBooze(i.key));
    const food = checked.filter((i) => !isBooze(i.key));
    let kitchen = loadKitchen();
    let shelf = loadBar();
    for (const i of food) kitchen = addToKitchen(kitchen, i.key, ing.names);
    for (const i of bar) shelf = addToBar(shelf, i.key, ing.names);
    const ok = (!food.length || saveKitchen(kitchen)) && (!bar.length || saveBar(shelf));
    if (!ok) { setNote('Could not save to this device, so the items stay on your list.'); return; }
    onChange((cur) => clearChecked(cur));
    const parts = [];
    if (food.length) parts.push(`${plural(food.length, 'item', 'items')} in My kitchen`);
    if (bar.length) parts.push(`${plural(bar.length, 'item', 'items')} in My bar`);
    setNote(`Put ${parts.join(' and ')}, and took them off the list.`);
  };

  const stockNow = useMemo(
    () => recipeStock || (() => ({ kitchen: loadKitchen(), pantry: [], bar: loadBar() })),
    [recipeStock],
  );
  const sheetItem = sheetId ? list.items.find((i) => i.id === sheetId) : null;
  const sauceRecipe = new Set(list.recipes.filter((r) => r.kind === 'sauce').map((r) => r.id));

  const closeSheet = (returnTo) => {
    setSheetId(null);
    const id = returnTo || sheetId;
    setTimeout(() => {
      const el = altButtons.current.get(id) || document.querySelector('[data-alt-button]');
      el?.focus?.();
    }, 0);
  };

  const pickAlternative = (item, alt) => {
    const amount = swappedAmount(item, alt);
    const alt1 = { key: alt.key, label: alt.label, amount, note: amount ? `${alt.useText} Amount adjusted.` : alt.useText };
    const res = replaceItem(list, item.id, alt1, opts);
    if (res.status === 'missing' || res.status === 'empty' || res.status === 'same') { setNote('Nothing changed.'); closeSheet(item.id); return; }

    // An alternative that needs a second ingredient (the table names it: buttermilk -> milk and lemon): the
    // companion goes on the list too, by the usual no-doubling-up rule, unless the cook already has it.
    const haveIt = makeHas({ ...stockNow(), names: opts.names });
    const wanted = (alt.plus || []).filter((p) => !haveIt(p));
    const stamp = Date.now();
    const ids = wanted.map((_, i) => `companion-${stamp}-${i}`);
    const companionNote = `With the ${alt.label} that stands in for ${item.label}`;
    const withCompanions = (base) => wanted.reduce((acc, c, i) => {
      const r = addLine(acc.list, { key: c, note: companionNote }, { ...opts, newId: () => ids[i] });
      return { list: r.list, results: [...acc.results, r.status] };
    }, { list: base, results: [] });
    const pre = withCompanions(res.list);
    const addedKeys = wanted.filter((_, i) => pre.results[i] === 'added');
    const alreadyKeys = wanted.filter((_, i) => pre.results[i] === 'merged');
    const addedIds = ids.filter((_, i) => pre.results[i] === 'added');

    onChange((cur) => withCompanions(replaceItem(cur, item.id, alt1, opts).list).list);
    setRemoved(null);
    const extra = [
      addedKeys.length ? ` ${cap(alt.label)} needs ${addedKeys.join(' and ')}, so that is on the list too.` : '',
      alreadyKeys.length ? ` ${cap(alreadyKeys.join(' and '))} ${alreadyKeys.length > 1 ? 'are' : 'is'} already on your list.` : '',
    ].join('');
    if (res.status === 'merged') {
      const target = res.list.items.find((i) => i.swappedFrom === item.key && i.key !== item.key);
      const qty = target ? itemAmountText(target, system) : '';
      if (addedIds.length) companions.current.set(target?.id || item.id, addedIds);
      setNote((qty ? `Added to ${target.label}: now ${qty}.` : `${cap(alt.label)} is already on your list, so ${item.label} was added to it.`) + extra);
      closeSheet(target?.id || item.id);
    } else {
      if (addedIds.length) companions.current.set(item.id, addedIds);
      setNote(`Swapped ${item.label} for ${alt.label}${amount ? ' and adjusted the amount' : ''}.${extra} You can undo it on the row.`);
      closeSheet(item.id);
    }
    usage.shopAlternativeUsed({ alt_source: alt.source === 'cocktailRiff' ? 'bar' : 'food', outcome: 'replaced' });
  };

  const useWhatIHave = (item, alt) => {
    const at = list.items.findIndex((i) => i.id === item.id);
    const msg = `Took ${item.label} off the list: you have ${alt.label}.`;
    onChange((cur) => remove(cur, item.id));
    setRemoved({ row: item, at, msg });
    setNote(msg);
    usage.shopAlternativeUsed({ alt_source: alt.source === 'cocktailRiff' ? 'bar' : 'food', outcome: 'used_own' });
    closeSheet();
  };

  const undoRemoval = () => {
    if (!removed) return;
    const { row, at } = removed;
    onChange((cur) => restoreRow(cur, row, at));
    setRemoved(null);
    setNote(`Put ${row.label} back on the list.`);
  };

  const undoSwap = (item) => {
    const added = companions.current.get(item.id) || [];
    companions.current.delete(item.id);
    const gone = added.filter((id) => list.items.some((i) => i.id === id && !i.checked));
    onChange((cur) => {
      const back = undoReplace(cur, item.id);
      return gone.length ? { ...back, items: back.items.filter((i) => !(gone.includes(i.id) && !i.checked)) } : back;
    });
    const goneNames = gone.map((id) => list.items.find((i) => i.id === id)?.label).filter(Boolean);
    setNote(`Put ${item.was?.row?.label || 'the original'} back.${goneNames.length ? ` Took ${goneNames.join(' and ')} off the list again.` : ''}`);
  };

  const clearAll = () => {
    onChange(() => emptyList());
    setConfirmClear(false);
    setNote('Cleared the list.');
  };

  const countText = list.items.length === 0 ? 'Nothing on the list'
    : `${open} to buy${checked.length ? `, ${checked.length} in the basket` : ''}`;

  return (
    <div
      data-testid="shopping-list"
      className="fixed inset-x-0 top-0 overflow-y-auto"
      style={{ bottom: 'var(--tab-bar-h)', ...chalkSurfaceStyle(), color: CHALK_CREAM, paddingTop: 'env(safe-area-inset-top, 0px)' }}
    >
      <div className="mx-auto w-full max-w-md px-4" style={{ paddingBottom: 150 }}>
        <div className="flex items-center gap-2 pt-3">
          <button type="button" onClick={onClose} data-testid="shopping-back" className={`min-h-[44px] px-3 rounded-lg ${FOCUS}`} style={buttonStyle}>
            ‹ Labs
          </button>
        </div>
        <h1 style={{ fontFamily: FONT, fontSize: 36, lineHeight: 1.1, marginTop: 6 }}>Shopping list</h1>
        <p data-testid="shopping-count" role="status" aria-live="polite" style={{ fontFamily: SANS, fontSize: 14, color: CHALK_DIM, minHeight: 20 }}>{countText}</p>
        <div role="group" aria-label="Amounts shown in" data-testid="shopping-units" className="flex items-center gap-2 mt-1">
          <span style={{ fontFamily: SANS, fontSize: 14, color: CHALK_DIM }}>Amounts</span>
          {[['us', 'US'], ['metric', 'Metric']].map(([id, label]) => (
            <button
              key={id}
              type="button"
              aria-pressed={system === id}
              data-testid={`shopping-units-${id}`}
              onClick={() => chooseSystem(id)}
              className={`min-h-[44px] px-4 rounded-lg ${FOCUS}`}
              style={{ ...buttonStyle, ...(system === id ? { background: CHALK_CREAM, color: '#1a1a1a', borderColor: CHALK_CREAM } : {}) }}
            >{label}</button>
          ))}
        </div>

        <form
          className="mt-3"
          onSubmit={(e) => { e.preventDefault(); add({ text }); }}
          aria-label="Add an item"
        >
          <div className="flex gap-2">
            <input
              ref={addRef}
              type="text"
              value={text}
              onChange={(e) => setText(e.target.value)}
              aria-label="Item to add"
              placeholder="Add an item"
              autoComplete="off"
              data-testid="shopping-add-text"
              className={`flex-1 min-w-0 min-h-[44px] rounded-lg px-3 ${FOCUS}`}
              style={inputStyle}
            />
            <input
              type="text"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              aria-label="Amount (optional)"
              placeholder="Amount"
              autoComplete="off"
              data-testid="shopping-add-amount"
              className={`min-h-[44px] rounded-lg px-2 ${FOCUS}`}
              style={{ ...inputStyle, width: 92 }}
            />
            <button type="submit" data-testid="shopping-add-button" className={`min-h-[44px] px-3 rounded-lg ${FOCUS}`} style={{ ...buttonStyle, fontWeight: 600 }}>
              Add
            </button>
          </div>
          {suggestions.length > 0 && (
            <ul data-testid="shopping-suggestions" aria-label="Suggestions" className="mt-2 flex flex-wrap gap-2">
              {suggestions.map((s) => (
                <li key={s}>
                  <button type="button" onClick={() => add({ key: s, label: s })} className={`min-h-[44px] px-3 rounded-full ${FOCUS}`} style={buttonStyle}>
                    {s}
                  </button>
                </li>
              ))}
            </ul>
          )}
          {ing.status === 'failed' && (
            <p style={{ fontFamily: SANS, fontSize: 12, color: CHALK_SUB, marginTop: 6 }}>Ingredient suggestions are not available right now. You can still type any item.</p>
          )}
        </form>
        <ShoppingRecipeAdd
          list={list}
          onChange={onChange}
          own={own}
          names={ing.names.size ? ing.names : null}
          {...(loadRecipes ? { loadSources: loadRecipes } : {})}
          {...(recipeStock ? { stock: recipeStock } : {})}
        />

        <p data-testid="shopping-note" role="status" aria-live="polite" style={{ fontFamily: SANS, fontSize: 14, color: CHALK_CREAM, marginTop: 8, minHeight: 20 }}>
          {note}
          {removed && note === removed.msg && (
            <button type="button" data-testid="shopping-undo-removal" onClick={undoRemoval} className={`ml-2 min-h-[44px] px-3 rounded-lg ${FOCUS}`} style={buttonStyle}>Undo</button>
          )}
        </p>

        {list.items.length === 0 ? (
          <div data-testid="shopping-empty" className="mt-4 rounded-xl p-4" style={{ border: `1.5px dashed ${CHALK_RAIL}` }}>
            <div style={{ fontFamily: FONT, fontSize: 26 }}>Nothing on your list yet</div>
            <p style={{ fontFamily: SANS, fontSize: 14, color: CHALK_DIM, marginTop: 4 }}>
              Type an item above and tap Add, or tap Add from a recipe and search a cocktail, sauce or dish by name: it adds only what you do not already have. You can also tap Add to shopping list under What do I need? on any recipe. Tick things off as you shop; ticked items drop to the bottom of their aisle so you can see what is left.
            </p>
          </div>
        ) : (
          <div className="mt-2">
            {groups.map((g) => (
              <section key={g.aisle} aria-label={cap(g.aisle)} data-testid={`shopping-aisle-${g.aisle.replace(/\s+/g, '-')}`} className="mt-3">
                <h2 style={{ fontFamily: FONT, fontSize: 24, color: CHALK_DIM, borderBottom: `1px solid ${CHALK_RAIL}` }}>{cap(g.aisle)}</h2>
                <ul>
                  {g.items.map((item) => {
                    const qty = itemAmountText(item, system);
                    const forNames = item.from.map((id) => recipeName.get(id)).filter(Boolean);
                    return (
                      <li key={item.id} data-testid={`shopping-row-${item.key}`} style={{ borderBottom: `1px solid ${CHALK_RAIL}55` }}>
                        <div className="flex items-center gap-3 w-full min-h-[56px] py-2">
                          {/* The checkbox keeps its own 44 px label-less target; the NAME is a separate button (BUILDER-4) so a tap on it opens the ingredient card and never ticks the row. */}
                          <label className="flex items-center justify-center flex-shrink-0 cursor-pointer min-h-[56px] min-w-[44px]">
                            <input
                              type="checkbox"
                              id={`shopping-check-${item.id}`}
                              checked={item.checked}
                              aria-label={item.label}
                              onChange={() => onChange((cur) => toggle(cur, item.id))}
                              className={`flex-shrink-0 ${FOCUS}`}
                              style={{ width: 28, height: 28, accentColor: CHALK_CREAM, outlineColor: CHALK_CREAM }}
                            />
                          </label>
                          <span className="flex-1 min-w-0" style={{ fontFamily: SANS, opacity: item.checked ? 0.6 : 1 }}>
                            <span className="block break-words" style={{ fontSize: 17, textDecoration: item.checked ? 'line-through' : 'none' }}>
                              <IngredientName name={item.key} loose tall testid={`shopping-name-${item.key}`} ariaName={item.label}
                                style={item.checked ? { textDecoration: 'none' } : undefined}>
                                <span style={{ textDecoration: item.checked ? 'line-through' : 'none' }}>{item.label}</span>
                              </IngredientName>
                              {qty && <label htmlFor={`shopping-check-${item.id}`} style={{ color: CHALK_DIM, fontSize: 15, cursor: 'pointer' }}>{' · '}{qty}</label>}
                            </span>
                            {forNames.length > 0 && (
                              <label htmlFor={`shopping-check-${item.id}`} className="block break-words" style={{ fontSize: 13, color: CHALK_DIM, cursor: 'pointer' }}>for {forNames.join(', ')}</label>
                            )}
                          </span>
                        </div>
                                        {(item.swappedFrom || item.note) && (
                          <div className="pl-10 pb-1" data-testid={`shopping-swap-${item.key}`} style={{ fontFamily: SANS, fontSize: 13, color: CHALK_DIM }}>
                            {item.swappedFrom && <span>instead of {item.swappedFrom}</span>}
                            {item.note && <span className="block break-words">{item.note}</span>}
                          </div>
                        )}
                        <div className="pl-10 pb-2 flex flex-wrap gap-2">
                          {!item.checked && (
                            <button
                              type="button"
                              ref={(el) => { if (el) altButtons.current.set(item.id, el); else altButtons.current.delete(item.id); }}
                              data-alt-button
                              data-testid={`shopping-alt-${item.key}`}
                              aria-label={`Store doesn't have it? Find an alternative for ${item.label}`}
                              onClick={() => setSheetId(item.id)}
                              className={`min-h-[44px] px-3 rounded-lg ${FOCUS}`}
                              style={buttonStyle}
                            >
                              Store doesn&apos;t have it?
                            </button>
                          )}
                          {item.was && (
                            <button
                              type="button"
                              data-testid={`shopping-undo-swap-${item.key}`}
                              aria-label={`Undo the swap: put ${item.was.row?.label || 'the original'} back`}
                              onClick={() => undoSwap(item)}
                              className={`min-h-[44px] px-3 rounded-lg ${FOCUS}`}
                              style={buttonStyle}
                            >
                              Undo
                            </button>
                          )}
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </section>
            ))}

            <div className="mt-5 flex flex-wrap gap-2">
              <button type="button" onClick={copy} data-testid="shopping-copy" className={`min-h-[44px] px-4 rounded-lg ${FOCUS}`} style={buttonStyle}>Copy list</button>
              {checked.length > 0 && (
                <button type="button" onClick={clearDone} data-testid="shopping-clear-checked" className={`min-h-[44px] px-4 rounded-lg ${FOCUS}`} style={buttonStyle}>Clear checked</button>
              )}
              <button type="button" onClick={() => setConfirmClear(true)} data-testid="shopping-clear-all" className={`min-h-[44px] px-4 rounded-lg ${FOCUS}`} style={buttonStyle}>Clear all</button>
            </div>

            {checked.length > 0 && (
              <div className="mt-3">
                <button type="button" onClick={putInKitchen} data-testid="shopping-put-away" className={`min-h-[44px] px-4 rounded-lg ${FOCUS}`} style={{ ...buttonStyle, fontWeight: 600 }}>
                  Put checked items in my kitchen
                </button>
                <p style={{ fontFamily: SANS, fontSize: 12, color: CHALK_SUB, marginTop: 4 }}>
                  Wine, beer, spirits and liqueurs go to My bar, everything else to My kitchen. Nothing moves unless you tap this.
                </p>
              </div>
            )}

            {confirmClear && (
              <div
                role="alertdialog"
                aria-labelledby="shopping-clear-title"
                aria-describedby="shopping-clear-desc"
                data-testid="shopping-clear-confirm"
                className="mt-4 rounded-xl p-4"
                style={{ border: `2px solid ${CHALK_CREAM}`, background: 'rgba(10,10,10,0.8)' }}
                onKeyDown={(e) => { if (e.key === 'Escape') setConfirmClear(false); }}
              >
                <div id="shopping-clear-title" style={{ fontFamily: FONT, fontSize: 24 }}>Clear the whole list?</div>
                <p id="shopping-clear-desc" style={{ fontFamily: SANS, fontSize: 14, color: CHALK_DIM }}>
                  This removes all {plural(list.items.length, 'item', 'items')}, ticked or not. It cannot be undone.
                </p>
                <div className="mt-3 flex gap-2">
                  <button ref={keepRef} type="button" onClick={() => setConfirmClear(false)} data-testid="shopping-clear-cancel" className={`min-h-[44px] px-4 rounded-lg ${FOCUS}`} style={{ ...buttonStyle, fontWeight: 600 }}>Keep my list</button>
                  <button type="button" onClick={clearAll} data-testid="shopping-clear-confirm-yes" className={`min-h-[44px] px-4 rounded-lg ${FOCUS}`} style={buttonStyle}>Clear all</button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
      {sheetItem && !sheetItem.checked && (
        <StoreAlternatives
          item={sheetItem}
          sauce={sheetItem.from.some((id) => sauceRecipe.has(id))}
          names={ing.names.size ? ing.names : null}
          stock={stockNow}
          {...(loadRoles ? { loadRoles } : {})}
          onPick={(alt) => pickAlternative(sheetItem, alt)}
          onUseHave={(alt) => useWhatIHave(sheetItem, alt)}
          onClose={() => closeSheet()}
        />
      )}
    </div>
  );
}
