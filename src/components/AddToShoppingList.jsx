/**
 * AddToShoppingList (SHOP-3) — the "Add to shopping list" button on a What do I need? panel.
 *
 * Adds what "Copy shopping list" copies (SHOP-7): the missing "You need" lines AND the optional ones ("Even better
 * with", "Nice to have"), through the same addRecipe as the shopping list's own
 * "Add from a recipe" (same merge rule, same ask-first when the recipe is already on the list), then says what
 * happened and offers "Open list".
 *
 *   recipe    { kind, slug | id, name } — the identity of this recipe (shoppingRecipes.recipeRefFor)
 *   missing   the panel's missing lines: [{ name, amount }]
 *   better, optional   the panel's "Even better with" and "Nice to have" lines, same shape (added too; counted in the summary)
 *   list      the shopping list now (profile.shopping.list)
 *   onChange  (change, opts?) => void — useUserProfile.updateShopping
 *   onOpen    opens the shopping list screen
 */
import { useRef, useState } from 'react';
import { canonicalKey, emptyList } from '../data/shoppingList.js';
import { usage } from '../data/usageEvents.js';
import { loadUnitSystem } from '../data/shoppingUnits.js';
import { addTicked, askAgainText, countOptional, shopRecipeUsage, summaryText } from '../data/shoppingRecipes.js';
import { FONT, CHALK_CREAM, CHALK_DIM } from '../data/chalkTheme.js';
import { Basket } from './ChalkIcons.jsx';

const SANS = 'system-ui, -apple-system, "Segoe UI", sans-serif';
const FOCUS = 'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2';

export default function AddToShoppingList({ recipe, missing, better = [], optional = [], list, onChange, onOpen = null, color = '#a3e635' }) {
  const [ask, setAsk] = useState(false);
  const [done, setDone] = useState('');
  const cancelRef = useRef(null);
  const buttonRef = useRef(null);
  const current = list || emptyList();
  const extra = [...(better || []), ...(optional || [])];
  const lines = [...(missing || []), ...extra].map((m) => ({ key: m.name, amount: m.amount || '' }));
  const optionalKeys = new Set(extra.map((m) => canonicalKey(m.name)));
  if (!lines.length || typeof onChange !== 'function') return null;

  const commit = (force) => {
    const res = addTicked(current, recipe, lines, { force });
    onChange((cur) => addTicked(cur || emptyList(), recipe, lines, { force }).list);
    setAsk(false);
    const ev = shopRecipeUsage(recipe, 'panel', res.summary);
    if (ev) usage.shopRecipeAdded(ev);
    setDone(summaryText(recipe.name, res.summary, { system: loadUnitSystem(), optional: countOptional(res.summary, optionalKeys) }));
  };

  const click = () => {
    setDone('');
    const res = addTicked(current, recipe, lines);
    if (res.summary.alreadyOnList) {
      setAsk(true);
      setTimeout(() => cancelRef.current?.focus(), 0);
      return;
    }
    commit(false);
  };

  return (
    <>
      <button type="button" ref={buttonRef} onClick={click} data-testid="what-do-i-need-add-shopping"
        className={`px-3 rounded-lg border min-h-[44px] inline-flex items-center gap-1 ${FOCUS}`}
        style={{ fontFamily: FONT, fontSize: 18, borderColor: `${color}88`, color: CHALK_CREAM, outlineColor: CHALK_CREAM }}>
        <Basket size={20} />
        Add to shopping list
      </button>
      {ask && (
        <div role="alertdialog" aria-labelledby="add-shop-ask" data-testid="what-do-i-need-add-ask"
          className="basis-full rounded-xl p-3 mt-1" style={{ border: `1.5px solid ${CHALK_CREAM}`, background: 'rgba(10,10,10,0.6)' }}
          onKeyDown={(e) => { if (e.key === 'Escape') { setAsk(false); buttonRef.current?.focus(); } }}>
          <p id="add-shop-ask" style={{ fontFamily: SANS, fontSize: 14, color: CHALK_CREAM }}>{askAgainText(recipe.name)}</p>
          <div className="mt-2 flex gap-2">
            <button type="button" ref={cancelRef} onClick={() => { setAsk(false); buttonRef.current?.focus(); }} data-testid="what-do-i-need-add-cancel"
              className={`min-h-[44px] px-4 rounded-lg ${FOCUS}`} style={{ fontFamily: SANS, fontSize: 14, border: `1.5px solid ${CHALK_DIM}`, color: CHALK_CREAM, fontWeight: 600, outlineColor: CHALK_CREAM }}>
              Cancel
            </button>
            <button type="button" onClick={() => commit(true)} data-testid="what-do-i-need-add-again"
              className={`min-h-[44px] px-4 rounded-lg ${FOCUS}`} style={{ fontFamily: SANS, fontSize: 14, border: `1.5px solid ${CHALK_DIM}`, color: CHALK_CREAM, outlineColor: CHALK_CREAM }}>
              Add it again
            </button>
          </div>
        </div>
      )}
      <div role="status" aria-live="polite" className="basis-full" data-testid="what-do-i-need-add-summary">
        {done && (
          <p style={{ fontFamily: SANS, fontSize: 13, color: CHALK_CREAM }}>
            {done}
            {onOpen && (
              <>
                {' '}
                <button type="button" onClick={onOpen} data-testid="what-do-i-need-open-list"
                  className={`underline underline-offset-4 min-h-[44px] px-1 ${FOCUS}`} style={{ color: CHALK_CREAM, fontFamily: SANS, fontSize: 14, outlineColor: CHALK_CREAM }}>
                  Open list
                </button>
              </>
            )}
          </p>
        )}
      </div>
    </>
  );
}
