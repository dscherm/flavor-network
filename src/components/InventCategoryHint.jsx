/**
 * InventCategoryHint — the recommendation: "This looks like a Sour — bright,
 * shaken, citrus-forward. Use it?" with Accept and Not now. The panel applies
 * nothing until onAccept.
 *
 * Props
 *   label, blurb   the category's name and one-line description
 *   onAccept, onDismiss   () → void
 *   labels         { lead, accept, dismiss }  lead(label) text before the dash is built as `${lead} ${label}`
 *   testidPrefix   default 'hint'
 * Test ids: {p} root, {p}-accept, {p}-dismiss.
 */
import { btn, CHALK_CREAM, CHALK_DIM, ACCENT } from './inventUi.jsx';

import { TEXT } from '../data/chalkTheme.js';
export default function InventCategoryHint({ label, blurb, onAccept, onDismiss, labels = {}, testidPrefix = 'hint' }) {
  const L = { lead: 'This looks like', accept: 'Use it', dismiss: 'Not now', ...labels };
  const p = testidPrefix;
  return (
    <div data-testid={p} role="status" className="rounded-lg px-3 py-2 min-w-0" style={{ border: `1px dashed ${ACCENT}` }}>
      <p className="text-[15px] mb-2" style={{ fontFamily: TEXT, color: CHALK_CREAM }}>
        {L.lead} <strong>{label}</strong>{blurb ? <span style={{ color: CHALK_DIM }}> — {blurb}</span> : null}. Use it?
      </p>
      <div className="flex gap-1.5 flex-wrap">
        <button type="button" onClick={onAccept} data-testid={`${p}-accept`} className="px-4 rounded-lg min-h-[44px]" style={btn({ background: `${ACCENT}33` })}>{L.accept}</button>
        <button type="button" onClick={onDismiss} data-testid={`${p}-dismiss`} className="px-4 rounded-lg min-h-[44px]" style={btn()}>{L.dismiss}</button>
      </div>
    </div>
  );
}
