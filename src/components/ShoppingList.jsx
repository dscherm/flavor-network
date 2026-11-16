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
 * Places left for later tasks: the "Add from a recipe" control and the empty-state sentence about it
 * (SHOP-3), and the per-row "Store doesn't have it?" control (SHOP-4) go where marked below.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  addLine, toggle, clearChecked, emptyList, groupByAisle, toText, itemAmountText, uncheckedCount,
} from '../data/shoppingList.js';
import { kitchenSuggestions } from '../data/kitchenRecipes.js';
import { loadKitchen, saveKitchen, addToKitchen } from '../data/myKitchen.js';
import { loadBar, saveBar, addToBar, isBooze } from '../data/myBar.js';
import { loadShoppingIngredients } from '../data/shoppingIngredients.js';
import { FONT, CHALK_CREAM, CHALK_DIM, CHALK_SUB, CHALK_RAIL, chalkSurfaceStyle } from '../data/chalkTheme.js';

const SANS = 'system-ui, -apple-system, "Segoe UI", sans-serif';
const FOCUS = 'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2';
const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;
const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);

const buttonStyle = { fontFamily: SANS, fontSize: 14, color: CHALK_CREAM, border: `1.5px solid ${CHALK_DIM}`, background: 'transparent', outlineColor: CHALK_CREAM };
const inputStyle = { fontFamily: SANS, fontSize: 16, color: CHALK_CREAM, background: 'rgba(10,10,10,0.6)', border: `1.5px solid ${CHALK_DIM}`, outlineColor: CHALK_CREAM };

export default function ShoppingList({ shopping, onChange, onClose, loadIngredients = loadShoppingIngredients }) {
  const list = shopping?.list || emptyList();
  const [ing, setIng] = useState({ status: 'loading', names: new Set(), vocab: [], categories: new Map() });
  const [text, setText] = useState('');
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [confirmClear, setConfirmClear] = useState(false);
  const keepRef = useRef(null);
  const addRef = useRef(null);

  useEffect(() => {
    let live = true;
    loadIngredients()
      .then((d) => { if (live) setIng({ status: 'ready', names: d.names, vocab: d.vocab, categories: d.categories }); })
      .catch(() => { if (live) setIng((s) => ({ ...s, status: 'failed' })); });
    return () => { live = false; };
  }, [loadIngredients]);

  useEffect(() => { if (confirmClear) keepRef.current?.focus(); }, [confirmClear]);

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
    const qty = itemAmountText(res.item);
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
      await navigator.clipboard.writeText(toText(list, { title: '' }));
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
        {/* SHOP-3: "Add from a recipe" goes here, beside the add box. */}

        <p data-testid="shopping-note" role="status" aria-live="polite" style={{ fontFamily: SANS, fontSize: 14, color: CHALK_CREAM, marginTop: 8, minHeight: 20 }}>{note}</p>

        {list.items.length === 0 ? (
          <div data-testid="shopping-empty" className="mt-4 rounded-xl p-4" style={{ border: `1.5px dashed ${CHALK_RAIL}` }}>
            <div style={{ fontFamily: FONT, fontSize: 26 }}>Nothing on your list yet</div>
            <p style={{ fontFamily: SANS, fontSize: 14, color: CHALK_DIM, marginTop: 4 }}>
              Type an item above and tap Add. Tick things off as you shop; ticked items drop to the bottom of their aisle so you can see what is left.
            </p>
            {/* SHOP-3: extend this with the "add from a recipe" way to fill the list. */}
          </div>
        ) : (
          <div className="mt-2">
            {groups.map((g) => (
              <section key={g.aisle} aria-label={cap(g.aisle)} data-testid={`shopping-aisle-${g.aisle.replace(/\s+/g, '-')}`} className="mt-3">
                <h2 style={{ fontFamily: FONT, fontSize: 24, color: CHALK_DIM, borderBottom: `1px solid ${CHALK_RAIL}` }}>{cap(g.aisle)}</h2>
                <ul>
                  {g.items.map((item) => {
                    const qty = itemAmountText(item);
                    const forNames = item.from.map((id) => recipeName.get(id)).filter(Boolean);
                    return (
                      <li key={item.id} data-testid={`shopping-row-${item.key}`} style={{ borderBottom: `1px solid ${CHALK_RAIL}55` }}>
                        <label className="flex items-center gap-3 w-full min-h-[56px] py-2 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={item.checked}
                            onChange={() => onChange((cur) => toggle(cur, item.id))}
                            className={`flex-shrink-0 ${FOCUS}`}
                            style={{ width: 28, height: 28, accentColor: CHALK_CREAM, outlineColor: CHALK_CREAM }}
                          />
                          <span className="flex-1 min-w-0" style={{ fontFamily: SANS, opacity: item.checked ? 0.6 : 1 }}>
                            <span className="block break-words" style={{ fontSize: 17, textDecoration: item.checked ? 'line-through' : 'none' }}>
                              {item.label}
                              {qty && <span style={{ color: CHALK_DIM, fontSize: 15 }}>{' · '}{qty}</span>}
                            </span>
                            {forNames.length > 0 && (
                              <span className="block break-words" style={{ fontSize: 13, color: CHALK_DIM }}>for {forNames.join(', ')}</span>
                            )}
                          </span>
                        </label>
                        {/* SHOP-4: the "Store doesn't have it?" control for an unchecked row goes here. */}
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
    </div>
  );
}
