/**
 * AddToShoppingList (SHOP-3) — the "Add to shopping list" button on a What do I need? panel.
 *
 * Adds exactly the lines the panel lists as missing, through the same addRecipe as the shopping list's own
 * "Add from a recipe" (same merge rule, same ask-first when the recipe is already on the list), then says what
 * happened and offers "Open list".
 *
 *   recipe    { kind, slug | id, name } — the identity of this recipe (shoppingRecipes.recipeRefFor)
 *   missing   the panel's missing lines: [{ name, amount }]
 *   list      the shopping list now (profile.shopping.list)
 *   onChange  (change, opts?) => void — useUserProfile.updateShopping
 *   onOpen    opens the shopping list screen
 */
import { useRef, useState } from 'react';
import { emptyList } from '../data/shoppingList.js';
import { usage } from '../data/usageEvents.js';
import { addTicked, askAgainText, shopRecipeUsage, summaryText } from '../data/shoppingRecipes.js';
import { FONT, CHALK_CREAM, CHALK_DIM } from '../data/chalkTheme.js';

const SANS = 'system-ui, -apple-system, "Segoe UI", sans-serif';
const FOCUS = 'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2';

export default function AddToShoppingList({ recipe, missing, list, onChange, onOpen = null, color = '#a3e635' }) {
  const [ask, setAsk] = useState(false);
  const [done, setDone] = useState('');
  const cancelRef = useRef(null);
  const buttonRef = useRef(null);
  const current = list || emptyList();
  const lines = (missing || []).map((m) => ({ key: m.name, amount: m.amount || '' }));
  if (!lines.length || typeof onChange !== 'function') return null;

  const commit = (force) => {
    const res = addTicked(current, recipe, lines, { force });
    onChange((cur) => addTicked(cur || emptyList(), recipe, lines, { force }).list);
    setAsk(false);
    const ev = shopRecipeUsage(recipe, 'panel', res.summary);
    if (ev) usage.shopRecipeAdded(ev);
    setDone(summaryText(recipe.name, res.summary));
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
        className={`px-3 rounded-lg border min-h-[44px] ${FOCUS}`}
        style={{ fontFamily: FONT, fontSize: 18, borderColor: `${color}88`, color: CHALK_CREAM, outlineColor: CHALK_CREAM }}>
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
