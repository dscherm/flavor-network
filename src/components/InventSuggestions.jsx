/**
 * InventSuggestions — "Goes well with what you have": ranked ingredients, one tap
 * to add. Lab-agnostic; the panel decides when to show it (hidden until the list
 * has an ingredient) and ranks with inventBuild.suggestNext.
 *
 * Props
 *   title      string
 *   items      [{ key, have?, note? }]
 *   onAdd      (key)
 *   emptyText  string | undefined     shown when items is empty; when absent an empty list renders nothing
 *   onDeck     () → opens the suggestion deck over the panel (BUILDER-1); the button shows only when there are items
 *   labels     { have, deck }
 *   testidPrefix default 'suggest'
 * Test ids: {p} root, {p}-item (each chip, data-key), {p}-info (the small i beside it: opens the ingredient card), {p}-deck (the deck button), {p}-empty.
 */
import { IngredientInfoButton } from './IngredientCardProvider.jsx';
import { AddRow, textAction, heading, FOCUS, CHALK_SUB } from './inventUi.jsx';

import { TEXT } from '../data/chalkTheme.js';
export default function InventSuggestions({ title, items = [], onAdd, onDeck, emptyText, labels = {}, testidPrefix = 'suggest' }) {
  const p = testidPrefix;
  if (!items.length && !emptyText) return null;
  return (
    <div data-testid={p} className="min-w-0">
      {title && <p className="mb-1" style={heading}>{title}</p>}
      {items.length === 0
        ? <p className="text-[14px]" style={{ fontFamily: TEXT, color: CHALK_SUB }} data-testid={`${p}-empty`}>{emptyText}</p>
        : (
          <div className="flex flex-wrap gap-x-4 gap-y-0">
            {items.map((it) => (
              <span key={it.key} className="inline-flex items-center max-w-full">
                <AddRow name={it.key} have={!!it.have} note={it.note} haveLabel={labels.have || 'have'} testid={`${p}-item`} onClick={() => onAdd(it.key)} />
                <IngredientInfoButton name={it.key} testid={`${p}-info`} />
              </span>
            ))}
          </div>
        )}
      {onDeck && items.length > 0 && (
        <button type="button" onClick={onDeck} data-testid={`${p}-deck`} className={`min-h-[44px] mt-2 ${FOCUS}`} style={textAction({ fontSize: 17 })}>
          {labels.deck || 'See how each changes the flavor'}
        </button>
      )}
    </div>
  );
}
