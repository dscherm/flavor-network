/**
 * inventUi — the small pieces the Invent* components share (chalk styling,
 * a text box with an add button and optional typeahead). Imports only react and
 * chalkTheme; nothing lab-specific.
 */
import { useId, useState } from 'react';
import { TYPE, TEXT, CHALK_CREAM, CHALK_DIM, CHALK_SUB, CHALK_RAIL, CONTROL_RADIUS } from '../data/chalkTheme.js';

export { CHALK_CREAM, CHALK_DIM, CHALK_SUB, CHALK_RAIL };
export const ACCENT = '#e8c97a';

export const SLATE = '#0a0a0a';
/** The focus-visible ring class string: the ring itself is the Focus token in index.css. */
export const FOCUS = 'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2';

/** A Rail-outline control (inputs' submit, choice chips). */
export const btn = (extra = {}) => ({ ...TYPE.control, border: `1px solid ${CHALK_RAIL}`, color: CHALK_CREAM, borderRadius: CONTROL_RADIUS, ...extra });
/** A text control: Chalk words, a Rail underline, a 44 px hit area. No box. */
export const textAction = (extra = {}) => ({ ...TYPE.control, color: CHALK_CREAM, background: 'transparent', textDecoration: 'underline', textDecorationColor: CHALK_RAIL, textUnderlineOffset: 6, minHeight: 44, ...extra });
/** The one filled button of a view: Accent fill, Slate text. Disabled is an outline, never a fill. */
export const primaryBtn = (extra = {}, disabled = false) => (disabled
  ? { ...TYPE.control, border: `1px solid ${CHALK_RAIL}`, color: CHALK_SUB, background: 'transparent', borderRadius: CONTROL_RADIUS, minHeight: 48, ...extra }
  : { ...TYPE.control, background: ACCENT, color: SLATE, border: 'none', borderRadius: CONTROL_RADIUS, minHeight: 48, ...extra });
export const inputStyle = { ...TYPE.body, color: CHALK_CREAM, background: 'rgba(255,255,255,0.05)', border: `1px solid ${CHALK_RAIL}` };
export const heading = { ...TYPE.heading, color: CHALK_CREAM };
export const small = { ...TYPE.small, color: CHALK_SUB };

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
        data-testid={testid} className="flex-1 min-w-0 px-3 min-h-[44px]" style={{ ...inputStyle, borderRadius: CONTROL_RADIUS }}
        list={matches.length ? listId : undefined} maxLength={maxLength} autoComplete="off" />
      {matches.length > 0 && <datalist id={listId}>{matches.map((m) => <option key={m} value={m} />)}</datalist>}
      <button type="submit" data-testid={buttonTestid} className={`px-3 min-h-[44px] min-w-[44px] flex-shrink-0 ${FOCUS}`} style={btn()}>{buttonLabel}</button>
    </form>
  );
}

/** A choice chip: name, an optional "have" word and note. Selected = an Accent border, never a fill. */
export function Chip({ item, onClick, testid, haveLabel = 'have', pressed, fit = false }) {
  return (
    <button type="button" onClick={onClick} data-testid={testid} data-key={item.key} aria-pressed={pressed}
      className={`px-3 min-h-[44px] inline-flex items-center gap-1 ${FOCUS} ${fit ? '' : 'max-w-full'}`}
      style={btn(pressed ? { border: `1.5px solid ${ACCENT}` } : {})}>
      <span className="truncate flex-shrink-0 max-w-full">{item.key}</span>
      {item.have ? <span className="text-[11px] flex-shrink-0" style={{ fontFamily: TEXT, color: CHALK_DIM }}>{haveLabel}</span> : null}
      {item.note ? <span className="text-[11px]" style={{ fontFamily: TEXT, color: CHALK_SUB }}>{item.note}</span> : null}
    </button>
  );
}

/** Adding from a list: a "+" in Muted chalk, the name, small print after it. The whole row is the 44 px button. */
export function AddRow({ name, note, have = false, haveLabel = 'have', onClick, testid, disabled = false, ariaLabel, children }) {
  return (
    <button type="button" onClick={onClick} data-testid={testid} data-key={name} disabled={disabled} aria-label={ariaLabel}
      className={`inline-flex items-center gap-2 min-h-[44px] text-left max-w-full ${FOCUS}`}
      style={{ ...TYPE.control, color: CHALK_CREAM, background: 'transparent' }}>
      <span aria-hidden="true" style={{ color: CHALK_DIM }}>+</span>
      <span className="min-w-0 truncate">{name}</span>
      {have ? <span style={{ ...TYPE.small }}>{haveLabel}</span> : null}
      {note ? <span style={{ ...TYPE.small }}>{note}</span> : null}
      {children}
    </button>
  );
}
