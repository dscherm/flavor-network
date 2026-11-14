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
 *   labels     { have }
 *   testidPrefix default 'suggest'
 * Test ids: {p} root, {p}-item (each chip, data-key), {p}-empty.
 */
import { Chip, heading, SANS, CHALK_SUB } from './inventUi.jsx';

export default function InventSuggestions({ title, items = [], onAdd, emptyText, labels = {}, testidPrefix = 'suggest' }) {
  const p = testidPrefix;
  if (!items.length && !emptyText) return null;
  return (
    <div data-testid={p} className="min-w-0">
      {title && <p className="mb-1" style={heading}>{title}</p>}
      {items.length === 0
        ? <p className="text-[14px]" style={{ fontFamily: SANS, color: CHALK_SUB }} data-testid={`${p}-empty`}>{emptyText}</p>
        : (
          <div className="flex flex-wrap gap-1.5">
            {items.map((it) => <Chip key={it.key} item={it} testid={`${p}-item`} haveLabel={labels.have || 'have'} onClick={() => onAdd(it.key)} />)}
          </div>
        )}
    </div>
  );
}
