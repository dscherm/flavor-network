/**
 * InventDeck — the one suggestion deck, opened from an invent panel (cocktail, sauce, recipe). A chalk overlay over the
 * panel that holds SuggestionCardDeck: one card per candidate with the build's profile now and with it added (or swapped
 * in), drawn as two fixed flavor grids. The Now grid is worked out from the build's lines with their amounts by the same
 * calculation the panel's own flavor profile uses, so the two always lead with the same notes.
 *
 * Props
 *   mode        'add' | 'replace'
 *   ingredient  the line being replaced (replace mode)
 *   keys        the build's ingredient keys
 *   amounts     { key: amount text } as the panel gives its profile
 *   nodes       Map name → { taste } | null
 *   candidates  [key]  every suggestion (add) or stand-in (replace), in order
 *   onAdd       (key)      adds the line exactly as the panel's chip does; the deck then closes
 *   onSwap      (old, new) replaces the line; the deck then closes
 *   onClose     back to the panel, list untouched
 */
import { useMemo } from 'react';
import SuggestionCardDeck from './SuggestionCardDeck.jsx';
import { chalkSurfaceStyle, CHALK_CREAM } from '../data/chalkTheme.js';

export default function InventDeck({ mode = 'add', ingredient = null, keys = [], amounts = null, nodes = null, candidates = [], onAdd, onSwap, onClose }) {
  const keySig = keys.join('|');
  const candSig = candidates.join('|');
  const amountSig = keys.map((k) => `${k}=${amounts?.[k] ?? ''}`).join('|');
  const bowl = useMemo(() => [...keys], [keySig]); // eslint-disable-line react-hooks/exhaustive-deps
  const cands = useMemo(() => [...candidates], [candSig]); // eslint-disable-line react-hooks/exhaustive-deps
  const amountMap = useMemo(() => ({ ...(amounts || {}) }), [amountSig]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <div className="fixed inset-x-0 top-0 safe-top-pad z-[90] flex flex-col overflow-hidden"
      style={{ ...chalkSurfaceStyle(), bottom: 'var(--tab-bar-h)', color: CHALK_CREAM }}
      data-testid="invent-deck" role="dialog" aria-label={mode === 'replace' ? `Stand-ins for ${ingredient}` : 'How each suggestion changes the flavor'}>
      <SuggestionCardDeck
        mode={mode}
        ingredient={ingredient}
        bowlNames={bowl}
        nodes={nodes}
        candidates={cands}
        amounts={amountMap}
        includeUnscored
        qtyPrefill={false}
        headerLabel={mode === 'replace' ? `Stand-ins for ${ingredient}` : 'How each one changes the flavor'}
        onAdd={(name) => { onAdd?.(name); onClose?.(); }}
        onSwap={(oldKey, name) => { onSwap?.(oldKey, name); onClose?.(); }}
        onClose={onClose}
      />
    </div>
  );
}
