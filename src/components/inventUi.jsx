/**
 * inventUi — the small pieces the Invent* components share (chalk styling,
 * a text box with an add button and optional typeahead). Imports only react and
 * chalkTheme; nothing lab-specific.
 */
import { useId, useState } from 'react';
import { FONT, CHALK_CREAM, CHALK_DIM, CHALK_SUB, CHALK_RAIL } from '../data/chalkTheme.js';

export { FONT, CHALK_CREAM, CHALK_DIM, CHALK_SUB, CHALK_RAIL };
export const SANS = 'system-ui, -apple-system, "Segoe UI", sans-serif';
export const ACCENT = '#e8c97a';

export const btn = (extra = {}) => ({ fontFamily: FONT, fontSize: 18, border: `1px solid ${CHALK_RAIL}`, color: CHALK_CREAM, ...extra });
export const inputStyle = { fontFamily: SANS, fontSize: 16, color: CHALK_CREAM, background: 'rgba(255,255,255,0.05)', border: `1px solid ${CHALK_RAIL}` };
export const heading = { fontFamily: FONT, fontSize: 20, color: CHALK_CREAM };
export const small = { fontFamily: SANS, fontSize: 12, color: CHALK_SUB };

/** A text box + button; submits trimmed text. `vocab` (strings) drives a native typeahead. onSubmit returning false keeps the text. */
export function TextAdd({ placeholder, buttonLabel, onSubmit, label, testid, buttonTestid, vocab = null, maxLength }) {
  const [text, setText] = useState('');
  const listId = useId();
  const submit = (e) => {
    e.preventDefault();
    const t = text.trim();
    if (!t) return;
    if (onSubmit(t) !== false) setText('');
  };
  const q = text.trim().toLowerCase();
  const matches = vocab && q.length >= 2 ? vocab.filter((v) => v.toLowerCase().includes(q)).slice(0, 20) : [];
  return (
    <form onSubmit={submit} className="flex gap-1.5 min-w-0">
      <input type="text" value={text} onChange={(e) => setText(e.target.value)} placeholder={placeholder} aria-label={label || placeholder}
        data-testid={testid} className="flex-1 min-w-0 px-3 rounded-lg min-h-[44px]" style={inputStyle}
        list={matches.length ? listId : undefined} maxLength={maxLength} autoComplete="off" />
      {matches.length > 0 && <datalist id={listId}>{matches.map((m) => <option key={m} value={m} />)}</datalist>}
      <button type="submit" data-testid={buttonTestid} className="px-3 rounded-lg min-h-[44px] min-w-[44px] flex-shrink-0" style={btn()}>{buttonLabel}</button>
    </form>
  );
}

/** A candidate chip: name, an owned mark, an optional note. */
export function Chip({ item, onClick, testid, color = ACCENT, haveLabel = 'have', pressed, fit = false }) {
  return (
    <button type="button" onClick={onClick} data-testid={testid} data-key={item.key} aria-pressed={pressed}
      className={`px-3 rounded-full min-h-[44px] inline-flex items-center gap-1 ${fit ? '' : 'max-w-full'}`} style={btn({ background: item.have ? `${color}33` : 'transparent' })}>
      <span className="truncate flex-shrink-0 max-w-full">{item.key}</span>
      {item.have ? <span className="text-[11px] flex-shrink-0" style={{ fontFamily: SANS, color: CHALK_DIM }}>· {haveLabel}</span> : null}
      {item.note ? <span className="text-[11px]" style={{ fontFamily: SANS, color: CHALK_SUB }}>· {item.note}</span> : null}
    </button>
  );
}
