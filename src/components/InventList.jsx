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
 * Ingredient card (BUILDER-4): {p}-name-{key} opens it; {p}-replace-info beside each replacement opens it with "Swap it in".
 */
import { useState } from 'react';
import { IngredientName, IngredientInfoButton } from './IngredientCardProvider.jsx';
import { Close } from './ChalkIcons.jsx';
import { TextAdd, Chip, btn, textAction, inputStyle, heading, small, FOCUS, CHALK_CREAM, CHALK_DIM, CHALK_SUB } from './inventUi.jsx';
import { chalkRule } from './ChalkIcons.jsx';

import { TEXT, CHALK_RAIL, CONTROL_RADIUS } from '../data/chalkTheme.js';
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
  haveIt: 'you have it',
  fromSearch: 'from your search',
  deck: 'See how each changes the flavor',
};

// The name is a 44 px target; it still truncates inside the row.
const NAME_BLOCK = { display: 'block', width: '100%', minHeight: 44, lineHeight: '44px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' };

function AmountBox({ line, p, L, onAmount }) {
  const [draft, setDraft] = useState(null);
  return (
    <input type="text" value={draft ?? line.amount ?? ''} placeholder={L.amountPlaceholder}
      aria-label={`${L.suggested}: ${line.key}`} data-testid={`${p}-amount-${line.key}`}
      onChange={(e) => { setDraft(e.target.value); onAmount(line.key, e.target.value); }}
      onBlur={() => setDraft(null)}
      className="w-20 flex-shrink-0 px-2 min-h-[44px] text-right" style={{ ...inputStyle, fontSize: 14, borderRadius: CONTROL_RADIUS }} />
  );
}

function Line({ line, p, L, onRemove, onAmount, replacementsFor, onReplace, onReplaceDeck }) {
  const [open, setOpen] = useState(false);
  const missing = line.have === false;
  const options = open ? (replacementsFor ? replacementsFor(line.key) || [] : []) : [];
  return (
    <li data-testid={`${p}-line`} data-key={line.key} data-have={line.have === false ? 'false' : line.have ? 'true' : 'unknown'}>
      <div className="flex items-center gap-2 min-w-0">
        <AmountBox line={line} p={p} L={L} onAmount={onAmount} />
        <span className="flex-1 min-w-0">
          <span className="block text-[20px]" style={{ fontFamily: TEXT, color: CHALK_CREAM }}>
            <IngredientName name={line.key} testid={`${p}-name-${line.key}`} style={NAME_BLOCK}>{line.key}</IngredientName>
          </span>
          <span className="block text-[11px] -mt-1.5" style={{ fontFamily: TEXT, color: CHALK_SUB }}>
            {[line.have ? L.haveIt : '', line.source === 'search' ? L.fromSearch : '', line.note || ''].filter(Boolean).join(', ')}
          </span>
        </span>
        <button type="button" onClick={() => onRemove(line.key)} aria-label={`${L.remove} ${line.key}`} data-testid={`${p}-remove-${line.key}`}
          className={`min-h-[44px] min-w-[44px] flex-shrink-0 inline-flex items-center justify-center ${FOCUS}`} style={{ color: CHALK_DIM, background: 'transparent' }}><Close size={20} /></button>
      </div>
      {missing && (
        <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open} data-testid={`${p}-need-${line.key}`}
          className={`min-h-[44px] mt-1 text-left ${FOCUS}`} style={textAction({ fontSize: 14, color: CHALK_DIM })}>
          {open ? L.close : L.need}
        </button>
      )}
      {missing && open && (
        <div className="mt-2" data-testid={`${p}-replacements-${line.key}`}>
          {options.length === 0
            ? <p className="text-[13px]" style={{ fontFamily: TEXT, color: CHALK_DIM }} data-testid={`${p}-no-replacements-${line.key}`}>{L.noReplacements}</p>
            : (
              <div className="flex flex-wrap gap-1.5">
                {options.map((o) => (
                  <span key={o.key} className="inline-flex items-center max-w-full">
                    <Chip fit item={{ ...o, have: o.have !== false }} testid={`${p}-replace-option`} haveLabel={L.have}
                      onClick={() => { onReplace(line.key, o.key); setOpen(false); }} />
                    <IngredientInfoButton name={o.key} testid={`${p}-replace-info`} swapFor={line.key} onSwap={(k) => { onReplace(line.key, k); setOpen(false); }} />
                  </span>
                ))}
              </div>
            )}
          {onReplaceDeck && options.length > 0 && (
            <button type="button" onClick={() => onReplaceDeck(line.key, options.map((o) => o.key))} data-testid={`${p}-replace-deck-${line.key}`}
              className={`min-h-[44px] mt-2 ${FOCUS}`} style={textAction({ fontSize: 16 })}>{L.deck}</button>
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
        ? <p className="text-[14px] mb-2" style={{ fontFamily: TEXT, color: CHALK_SUB }} data-testid={`${p}-empty`}>{L.empty}</p>
        : (
          <ul className="flex flex-col gap-2 mb-3" data-testid={`${p}-lines`}>
            {lines.map((l) => (
              <Line key={l.key} line={l} p={p} L={L} onRemove={onRemove} onAmount={onAmount} replacementsFor={replacementsFor} onReplace={onReplace} onReplaceDeck={onReplaceDeck} />
            ))}
          </ul>
        )}
      {lines.length > 0 && <div className="mb-3" style={{ color: CHALK_RAIL, lineHeight: 0 }} aria-hidden="true">{chalkRule()}</div>}
      <TextAdd placeholder={L.addPlaceholder} buttonLabel={L.add} label="Add an ingredient" onSubmit={onAdd} vocab={vocab}
        testid={`${p}-add-input`} buttonTestid={`${p}-add`} />
      {notice && (
        <p role="alert" className="mt-2 text-[14px]" style={{ ...small, fontSize: 14, color: CHALK_CREAM }} data-testid={`${p}-notice`}>
          {notice}
        </p>
      )}
    </div>
  );
}
