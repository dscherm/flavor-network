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
import { FONT, CHALK_CREAM, CHALK_DIM, CHALK_SUB } from '../data/chalkTheme.js';
import { shoppingListText } from '../data/whatDoINeed.js';

const SANS = 'system-ui, -apple-system, "Segoe UI", sans-serif';
const SHADOW = '0 0 1px rgba(245,239,222,0.55), 0 0 3px rgba(245,239,222,0.22)';

/**
 * @param {{
 *   title: string,
 *   needs: ReturnType<import('../data/whatDoINeed.js').needsFromKitchen>,
 *   stockEmpty?: boolean,       // nothing saved yet: say so, list everything as needed
 *   stockLabel?: string,        // "kitchen" | "bar and kitchen"
 *   onHave?: (name: string) => void,
 *   color?: string,
 * }} props
 */
export default function WhatDoINeed({ title, needs, stockEmpty = false, stockLabel = 'kitchen', onHave = null, color = '#a3e635' }) {
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
      <div className="uppercase tracking-[0.16em] mb-1.5 mt-3"
        style={{ color: CHALK_DIM, fontFamily: FONT, fontSize: 'clamp(13px, 1.7vh, 18px)', textShadow: SHADOW }}>
        What do I need?
      </div>

      <p className="mb-2" data-testid="what-do-i-need-summary" style={{ fontFamily: FONT, fontSize: 20, color: CHALK_CREAM, lineHeight: 1.2, textShadow: SHADOW }}>
        {stockEmpty
          ? `Your ${stockLabel} is empty, so here is everything you'd need.`
          : missing.length === 0
            ? (swaps.length
              ? `You can make it ✓ — with ${swaps.length === 1 ? 'a swap' : `${swaps.length} swaps`}`
              : better.length ? 'You can make it ✓' : 'You have everything ✓')
            :`You have ${have.length} of ${have.length + missing.length} — you need ${missing.length}:`}
      </p>

      {missing.length > 0 && (
        <ul className="flex flex-col gap-1" data-testid="what-do-i-need-missing">
          {missing.map((m) => (
            <li key={m.name} className="flex items-center gap-2 min-h-[40px]">
              <span className="flex-1 min-w-0">
                <span style={{ fontFamily: FONT, fontSize: 19, color: CHALK_CREAM }}>{m.name}</span>
                {m.amount && <span className="ml-1.5 text-[12px]" style={{ fontFamily: SANS, color: CHALK_DIM }}>{m.amount}</span>}
                {m.hint && <span className="block text-[12px]" style={{ fontFamily: SANS, color: CHALK_SUB }}>{m.hint}</span>}
              </span>
              {onHave && (
                <button type="button" onClick={() => onHave(m.name)} data-testid={`what-do-i-need-have-${m.name}`}
                  aria-label={`I have ${m.name}: add it to my ${stockLabel}`}
                  className="px-2.5 rounded-full border min-h-[36px] text-[14px] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
                  style={{ fontFamily: FONT, borderColor: `${color}88`, color: CHALK_CREAM, outlineColor: CHALK_CREAM }}>
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
            <li key={w.name} className="text-[16px]" style={{ fontFamily: FONT, color: CHALK_CREAM }}>
              ⇄ Use your {w.use} for the {w.name}
            </li>
          ))}
        </ul>
      )}

      {better.length > 0 && (
        <p className="mt-1.5 text-[16px]" data-testid="what-do-i-need-better" style={{ fontFamily: FONT, color: CHALK_DIM, lineHeight: 1.25 }}>
          Even better with: {better.map((b) => b.name).join(', ')}
        </p>
      )}

      {optional.length > 0 && (
        <p className="mt-1 text-[13px]" data-testid="what-do-i-need-optional" style={{ fontFamily: SANS, color: CHALK_SUB }}>
          Nice to have: {optional.map((o) => `${o.name}${o.amount ? ` (${o.amount})` : ''}`).join(', ')}
        </p>
      )}

      <div className="mt-2 flex flex-wrap items-center gap-2">
        {missing.length + optional.length + better.length > 0 && (
          <button type="button" onClick={copy} data-testid="what-do-i-need-copy"
            className="px-3 rounded-lg border min-h-[44px] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
            style={{ fontFamily: FONT, fontSize: 18, borderColor: `${color}88`, color: CHALK_CREAM, outlineColor: CHALK_CREAM }}>
            {copied ? 'Copied ✓' : '🛒 Copy shopping list'}
          </button>
        )}
        {have.length > 0 && (
          <button type="button" onClick={() => setShowHave((v) => !v)} aria-expanded={showHave} data-testid="what-do-i-need-toggle-have"
            className="px-2 min-h-[44px] underline underline-offset-4" style={{ fontFamily: FONT, fontSize: 16, color: CHALK_DIM }}>
            {showHave ? 'Hide' : 'Show'} what you have ({have.length})
          </button>
        )}
      </div>

      {showHave && (
        <p className="mt-1 text-[13px]" data-testid="what-do-i-need-have" style={{ fontFamily: SANS, color: CHALK_DIM }}>
          {have.map((h) => (h.swap ? `${h.name} (your ${h.swap} instead)` : h.via ? `${h.name} (your ${h.via})` : h.name)).join(', ')}
        </p>
      )}
      {basics.length > 0 && (
        <p className="mt-1 text-[12px]" style={{ fontFamily: SANS, color: CHALK_SUB }}>
          Assumed on hand: {basics.join(', ')}.
        </p>
      )}
    </section>
  );
}
