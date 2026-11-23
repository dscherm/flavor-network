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
import { Chip, btn, heading, CHALK_SUB } from './inventUi.jsx';

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
          <div className="flex flex-wrap gap-1.5">
            {items.map((it) => (
              <span key={it.key} className="inline-flex items-center max-w-full">
                <Chip fit item={it} testid={`${p}-item`} haveLabel={labels.have || 'have'} onClick={() => onAdd(it.key)} />
                <IngredientInfoButton name={it.key} testid={`${p}-info`} />
              </span>
            ))}
          </div>
        )}
      {onDeck && items.length > 0 && (
        <button type="button" onClick={onDeck} data-testid={`${p}-deck`} className="mt-2 px-3 rounded-lg min-h-[44px]" style={btn({ fontSize: 17 })}>
          {labels.deck || 'See how each changes the flavor'}
        </button>
      )}
    </div>
  );
}
