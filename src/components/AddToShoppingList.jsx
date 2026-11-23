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
import { TEXT, CHALK_CREAM, CHALK_DIM, CHALK_RAIL, CONTROL_RADIUS } from '../data/chalkTheme.js';
import { primaryBtn, textAction, FOCUS } from './inventUi.jsx';
import { Basket } from './ChalkIcons.jsx';

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
        data-primary="true" className={`w-full sm:w-auto px-5 inline-flex items-center justify-center gap-2 ${FOCUS}`}
        style={primaryBtn({ fontSize: 18 })}>
        <Basket size={20} />
        Add to shopping list
      </button>
      {ask && (
        <div role="alertdialog" aria-labelledby="add-shop-ask" data-testid="what-do-i-need-add-ask"
          className="basis-full p-3 mt-1" style={{ border: `1.5px solid ${CHALK_CREAM}`, borderRadius: CONTROL_RADIUS, background: 'rgba(10,10,10,0.6)' }}
          onKeyDown={(e) => { if (e.key === 'Escape') { setAsk(false); buttonRef.current?.focus(); } }}>
          <p id="add-shop-ask" style={{ fontFamily: TEXT, fontSize: 14, color: CHALK_CREAM }}>{askAgainText(recipe.name)}</p>
          <div className="mt-2 flex gap-6 items-center">
            <button type="button" ref={cancelRef} onClick={() => { setAsk(false); buttonRef.current?.focus(); }} data-testid="what-do-i-need-add-cancel"
              className={FOCUS} style={textAction({ fontSize: 15, color: CHALK_DIM })}>
              Cancel
            </button>
            <button type="button" onClick={() => commit(true)} data-testid="what-do-i-need-add-again"
              className={`px-4 ${FOCUS}`} style={{ ...textAction({ fontSize: 15 }), textDecoration: 'none', border: `1px solid ${CHALK_RAIL}`, borderRadius: CONTROL_RADIUS }}>
              Add it again
            </button>
          </div>
        </div>
      )}
      <div role="status" aria-live="polite" className="basis-full" data-testid="what-do-i-need-add-summary">
        {done && (
          <p style={{ fontFamily: TEXT, fontSize: 13, color: CHALK_CREAM }}>
            {done}
            {onOpen && (
              <>
                {' '}
                <button type="button" onClick={onOpen} data-testid="what-do-i-need-open-list"
                  className={`underline underline-offset-4 min-h-[44px] px-1 ${FOCUS}`} style={{ color: CHALK_CREAM, fontFamily: TEXT, fontSize: 14 }}>
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
