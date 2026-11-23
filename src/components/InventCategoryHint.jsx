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
import { textAction, FOCUS, CHALK_CREAM, CHALK_DIM } from './inventUi.jsx';

import { TEXT } from '../data/chalkTheme.js';
export default function InventCategoryHint({ label, blurb, onAccept, onDismiss, labels = {}, testidPrefix = 'hint' }) {
  const L = { lead: 'This looks like', accept: 'Use it', dismiss: 'Not now', ...labels };
  const p = testidPrefix;
  return (
    <div data-testid={p} role="status" className="min-w-0">
      <p className="text-[15px] mb-2" style={{ fontFamily: TEXT, color: CHALK_CREAM }}>
        {L.lead} <strong>{label}</strong>{blurb ? <span style={{ color: CHALK_DIM }}> — {blurb}</span> : null}. Use it?
      </p>
      <div className="flex gap-6 flex-wrap" role="group" aria-label="Style suggestion">
        <button type="button" onClick={onAccept} data-testid={`${p}-accept`} className={`min-h-[44px] ${FOCUS}`} style={textAction()}>{L.accept}</button>
        <button type="button" onClick={onDismiss} data-testid={`${p}-dismiss`} className={`min-h-[44px] ${FOCUS}`} style={textAction({ color: CHALK_DIM })}>{L.dismiss}</button>
      </div>
    </div>
  );
}
