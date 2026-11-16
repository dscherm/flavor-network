/**
 * InventList — "Your ingredients": exactly what the cook picked or typed, nothing
 * else. Each line has a name, an amount shown as an editable SUGGESTION, a remove
 * button, and (when the cook does not have it) "Don't have it? Try…" with the
 * lab's replacements. An add box is always visible. Lab-agnostic.
 *
 * Props
 *   lines            [{ key, amount?, note?, have?, locked?, source? }]
 *   onRemove         (key)
 *   onAmount         (key, text)                 called on every edit
 *   replacementsFor  (key) → [{ key, note? }]    asked when a line's replacements are opened
 *   onReplace        (oldKey, newKey)
 *   onReplaceDeck    (oldKey, [newKey]) opens the suggestion deck in swap mode over those stand-ins (BUILDER-1)
 *   onAdd            (text) → void | false       typed text, trimmed; false keeps it in the box
 *   vocab            string[] | null             typeahead for the add box
 *   notice           string | null               a refusal reason
 *   labels           copy overrides (see DEFAULTS)
 *   testidPrefix     default 'list'
 * A line with have === false is "missing"; have undefined means unknown (no mark).
 * Test ids: {p} root, {p}-line (row, data-key), {p}-amount-{key}, {p}-remove-{key},
 * {p}-need-{key} (the Don't-have-it button), {p}-replacements-{key}, {p}-replace-option, {p}-replace-deck-{key},
 * {p}-no-replacements-{key}, {p}-add-input, {p}-add, {p}-notice, {p}-empty.
 */
import { useState } from 'react';
import { TextAdd, Chip, btn, inputStyle, heading, small, SANS, FONT, CHALK_CREAM, CHALK_DIM, CHALK_SUB, CHALK_RAIL, ACCENT } from './inventUi.jsx';

export const DEFAULTS = {
  title: 'Your ingredients',
  empty: 'Nothing yet. Add what you want in it.',
  addPlaceholder: '+ add an ingredient',
  add: 'Add',
  remove: 'Remove',
  suggested: 'suggested amount',
  amountPlaceholder: 'amount',
  need: "Don't have it? Try…",
  close: 'Close',
  noReplacements: "Nothing you have is a good stand-in. Type one below.",
  have: 'have',
  fromSearch: 'from your search',
  deck: 'See how each changes the flavor',
};

function AmountBox({ line, p, L, onAmount }) {
  const [draft, setDraft] = useState(null);
  return (
    <input type="text" value={draft ?? line.amount ?? ''} placeholder={L.amountPlaceholder}
      aria-label={`${L.suggested}: ${line.key}`} data-testid={`${p}-amount-${line.key}`}
      onChange={(e) => { setDraft(e.target.value); onAmount(line.key, e.target.value); }}
      onBlur={() => setDraft(null)}
      className="w-20 flex-shrink-0 px-2 rounded-lg min-h-[44px] text-right" style={{ ...inputStyle, fontSize: 14 }} />
  );
}

function Line({ line, p, L, onRemove, onAmount, replacementsFor, onReplace, onReplaceDeck }) {
  const [open, setOpen] = useState(false);
  const missing = line.have === false;
  const options = open ? (replacementsFor ? replacementsFor(line.key) || [] : []) : [];
  return (
    <li className="rounded-lg px-2 py-1.5" data-testid={`${p}-line`} data-key={line.key} data-have={line.have === false ? 'false' : line.have ? 'true' : 'unknown'}
      style={{ border: `1px solid ${CHALK_RAIL}` }}>
      <div className="flex items-center gap-2 min-w-0">
        <span className="flex-1 min-w-0">
          <span className="block text-[20px] truncate" style={{ fontFamily: FONT, color: CHALK_CREAM }}>{line.key}</span>
          <span className="block text-[11px]" style={{ fontFamily: SANS, color: CHALK_SUB }}>
            {line.have ? L.have : ''}
            {line.source === 'search' ? `${line.have ? ' · ' : ''}🔒 ${L.fromSearch}` : ''}
            {line.note ? `${line.have || line.source === 'search' ? ' · ' : ''}${line.note}` : ''}
          </span>
        </span>
        <AmountBox line={line} p={p} L={L} onAmount={onAmount} />
        <button type="button" onClick={() => onRemove(line.key)} aria-label={`${L.remove} ${line.key}`} data-testid={`${p}-remove-${line.key}`}
          className="min-h-[44px] min-w-[44px] rounded-lg flex-shrink-0" style={btn({ fontSize: 20 })}>✕</button>
      </div>
      {missing && (
        <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open} data-testid={`${p}-need-${line.key}`}
          className="mt-1 min-h-[44px] px-3 rounded-lg text-left" style={{ fontFamily: SANS, fontSize: 14, color: ACCENT, border: `1px dashed ${CHALK_RAIL}` }}>
          {open ? L.close : L.need}
        </button>
      )}
      {missing && open && (
        <div className="mt-2" data-testid={`${p}-replacements-${line.key}`}>
          {options.length === 0
            ? <p className="text-[13px]" style={{ fontFamily: SANS, color: CHALK_DIM }} data-testid={`${p}-no-replacements-${line.key}`}>{L.noReplacements}</p>
            : (
              <div className="flex flex-wrap gap-1.5">
                {options.map((o) => (
                  <Chip key={o.key} item={{ ...o, have: true }} testid={`${p}-replace-option`} haveLabel={L.have}
                    onClick={() => { onReplace(line.key, o.key); setOpen(false); }} />
                ))}
              </div>
            )}
          {onReplaceDeck && options.length > 0 && (
            <button type="button" onClick={() => onReplaceDeck(line.key, options.map((o) => o.key))} data-testid={`${p}-replace-deck-${line.key}`}
              className="mt-2 min-h-[44px] px-3 rounded-lg" style={btn({ fontSize: 16 })}>{L.deck}</button>
          )}
        </div>
      )}
    </li>
  );
}

export default function InventList({
  lines = [], onRemove, onAmount = () => {}, replacementsFor, onReplace = () => {}, onReplaceDeck, onAdd, vocab = null, notice = null, labels = {}, testidPrefix = 'list',
}) {
  const L = { ...DEFAULTS, ...labels };
  const p = testidPrefix;
  return (
    <div data-testid={p} className="min-w-0">
      <p className="mb-1" style={heading}>{L.title}</p>
      {lines.length === 0
        ? <p className="text-[14px] mb-2" style={{ fontFamily: SANS, color: CHALK_SUB }} data-testid={`${p}-empty`}>{L.empty}</p>
        : (
          <ul className="flex flex-col gap-1.5 mb-2" data-testid={`${p}-lines`}>
            {lines.map((l) => (
              <Line key={l.key} line={l} p={p} L={L} onRemove={onRemove} onAmount={onAmount} replacementsFor={replacementsFor} onReplace={onReplace} onReplaceDeck={onReplaceDeck} />
            ))}
          </ul>
        )}
      <TextAdd placeholder={L.addPlaceholder} buttonLabel={L.add} label="Add an ingredient" onSubmit={onAdd} vocab={vocab}
        testid={`${p}-add-input`} buttonTestid={`${p}-add`} />
      {notice && (
        <p role="alert" className="mt-2 text-[14px] rounded-lg px-3 py-2" style={{ ...small, fontSize: 14, color: CHALK_CREAM, border: `1px dashed ${ACCENT}` }} data-testid={`${p}-notice`}>
          {notice}
        </p>
      )}
    </div>
  );
}
