/**
 * WhatDoINeed — the "What do I need?" section of a recipe, sauce or
 * cocktail card: what the cook already has (the shared kitchen, plus the
 * bar for cocktails), what to buy with amounts, "I have it" to add an item,
 * and a copyable shopping list. Logic in src/data/whatDoINeed.js.
 *
 * WEAK-3: for Cookbook recipes, "You need" lists only missing MAINS;
 * missing flavourings show as "Even better with…", and a missing item the
 * kitchen can swap ("use your onion for the scallion") counts as had.
 */
import { useState } from 'react';
import { TEXT, HAND, CHALK_CREAM, CHALK_DIM, CHALK_SUB } from '../data/chalkTheme.js';
import { textAction, FOCUS } from './inventUi.jsx';
import { shoppingListText } from '../data/whatDoINeed.js';
import AddToShoppingList from './AddToShoppingList.jsx';
import { IngredientName } from './IngredientCardProvider.jsx';

const SHADOW = '0 0 1px rgba(245,239,222,0.55), 0 0 3px rgba(245,239,222,0.22)';

/**
 * @param {{
 *   title: string,
 *   needs: ReturnType<import('../data/whatDoINeed.js').needsFromKitchen>,
 *   stockEmpty?: boolean,       // nothing saved yet: say so, list everything as needed
 *   stockLabel?: string,        // "kitchen" | "bar and kitchen"
 *   onHave?: (name: string) => void,
 *   color?: string,
 *   shopping?: { recipe, list, onChange, onOpen }, // SHOP-3: shows "Add to shopping list" (adds what Copy copies: missing + better + optional)
 * }} props
 */
export default function WhatDoINeed({ title, needs, stockEmpty = false, stockLabel = 'kitchen', onHave = null, color = '#a3e635', shopping = null }) {
  const [copied, setCopied] = useState(false);
  const [showHave, setShowHave] = useState(false);
  if (!needs || needs.total + needs.optional.length + (needs.better?.length || 0) === 0) return null;
  const { have, missing, optional, basics } = needs;
  const better = needs.better || [];
  const swaps = needs.swaps || [];

  const copy = async () => {
    const text = shoppingListText(title, missing, optional, better);
    try { await navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 1800); } catch { setCopied(false); }
  };

  return (
    <section data-testid="what-do-i-need" aria-label="What do I need?">
      <h3 style={{ color: CHALK_CREAM, fontFamily: HAND, fontSize: 22, fontWeight: 400, marginTop: 40, marginBottom: 12, textShadow: SHADOW }}>
        What do I need?
      </h3>

      <p className="mb-3" data-testid="what-do-i-need-summary" style={{ fontFamily: TEXT, fontSize: 20, color: CHALK_CREAM, lineHeight: 1.2, textShadow: SHADOW }}>
        {stockEmpty
          ? `Your ${stockLabel} is empty, so here is everything you'd need.`
          : missing.length === 0
            ? (swaps.length
              ? `You can make it, with ${swaps.length === 1 ? 'a swap' : `${swaps.length} swaps`}.`
              : better.length ? 'You can make it.' : 'You have everything.')
            :`You have ${have.length} of ${have.length + missing.length} — you need ${missing.length}:`}
      </p>

      {missing.length > 0 && (
        <ul className="flex flex-col gap-0" data-testid="what-do-i-need-missing">
          {missing.map((m) => (
            <li key={m.name} className="flex items-center gap-2 min-h-[44px]">
              <span className="flex-1 min-w-0">
                {m.amount && <span className="mr-1.5 text-[14px]" data-testid={`what-do-i-need-amount-${m.name}`} style={{ fontFamily: TEXT, color: CHALK_DIM }}>{m.amount}</span>}{m.amount ? ' ' : null}
                <IngredientName name={m.name} loose tall testid={`what-do-i-need-name-${m.name}`} style={{ fontFamily: TEXT, fontSize: 19, color: CHALK_CREAM }}>{m.name}</IngredientName>
                {m.hint && <span className="block text-[12px]" style={{ fontFamily: TEXT, color: CHALK_SUB }}>{m.hint}</span>}
              </span>
              {onHave && (
                <button type="button" onClick={() => onHave(m.name)} data-testid={`what-do-i-need-have-${m.name}`}
                  aria-label={`I have ${m.name}: add it to my ${stockLabel}`}
                  className={`flex-shrink-0 ${FOCUS}`}
                  style={textAction({ fontSize: 15, color: CHALK_DIM })}>
                  I have it
                </button>
              )}
            </li>
          ))}
        </ul>
      )}

      {swaps.length > 0 && (
        <ul className="mt-1 flex flex-col gap-0.5" data-testid="what-do-i-need-swaps" aria-label="Swaps from your kitchen">
          {swaps.map((w) => (
            <li key={w.name} className="text-[16px]" style={{ fontFamily: TEXT, color: CHALK_CREAM }}>
              Use your {w.use} for the {w.name}
            </li>
          ))}
        </ul>
      )}

      {better.length > 0 && (
        <p className="mt-1.5 text-[16px]" data-testid="what-do-i-need-better" style={{ fontFamily: TEXT, color: CHALK_DIM, lineHeight: 1.25 }}>
          Even better with: {better.map((b) => b.name).join(', ')}
        </p>
      )}

      {optional.length > 0 && (
        <p className="mt-1 text-[13px]" data-testid="what-do-i-need-optional" style={{ fontFamily: TEXT, color: CHALK_SUB }}>
          Nice to have: {optional.map((o) => `${o.name}${o.amount ? ` (${o.amount})` : ''}`).join(', ')}
        </p>
      )}

      <div className="mt-4 flex flex-wrap items-center gap-x-6 gap-y-0">
        {shopping && missing.length + better.length + optional.length > 0 && (
          <AddToShoppingList recipe={shopping.recipe} missing={missing} better={better} optional={optional} list={shopping.list}
            onChange={shopping.onChange} onOpen={shopping.onOpen} color={color} />
        )}
        {missing.length + optional.length + better.length > 0 && (
          <button type="button" onClick={copy} data-testid="what-do-i-need-copy"
            className={`${FOCUS} mx-auto sm:mx-0`}
            style={textAction({ fontSize: 17 })}>
            {copied ? 'Copied' : 'Copy shopping list'}
          </button>
        )}
        {have.length > 0 && (
          <button type="button" onClick={() => setShowHave((v) => !v)} aria-expanded={showHave} data-testid="what-do-i-need-toggle-have"
            className={`min-h-[44px] ${FOCUS}`} style={textAction({ fontSize: 16, color: CHALK_DIM })}>
            {showHave ? 'Hide' : 'Show'} what you have ({have.length})
          </button>
        )}
      </div>

      {showHave && (
        <p className="mt-1 text-[13px]" data-testid="what-do-i-need-have" style={{ fontFamily: TEXT, color: CHALK_DIM }}>
          {have.map((h) => (h.swap ? `${h.name} (your ${h.swap} instead)` : h.via ? `${h.name} (your ${h.via})` : h.name)).join(', ')}
        </p>
      )}
      {basics.length > 0 && (
        <p className="mt-1 text-[12px]" style={{ fontFamily: TEXT, color: CHALK_SUB }}>
          Assumed on hand: {basics.join(', ')}.
        </p>
      )}
    </section>
  );
}
