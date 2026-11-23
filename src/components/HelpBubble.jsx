/**
 * HelpBubble — a tiny circular "?" button that toggles a small, dismissible
 * anchored popover explaining a surface (what it is, how to use, what to try).
 *
 * This is the TARGETED, per-surface help affordance (HELP-1) — distinct from
 * the global `HelpButton.jsx`, which is a fixed-position trigger for the guided
 * tour. Mount one HelpBubble in a surface's header/chrome and pass it the
 * surface-specific copy; it carries no app data and is fully presentational.
 *
 * Reveal: tap the "?" → popover opens. Dismiss: tap outside, press Esc, or the
 * in-popover ×. Only this instance's popover is affected. Accessible
 * (aria-label / aria-expanded / role) with a ≥44px touch target.
 *
 *   <HelpBubble
 *     title="Adding an ingredient"
 *     body={['Tap a row to pin it on the radar.', 'Tap the dot → Yes, add.']}
 *     placement="bottom"     // 'bottom' | 'top'
 *   />
 */
import { useEffect, useRef, useState } from 'react';
import { Close } from './ChalkIcons.jsx';

import { HAND, TEXT, CHALK_CREAM, CHALK_DIM, CHALK_RAIL, CONTROL_RADIUS } from '../data/chalkTheme.js';
import { FOCUS, SLATE } from './inventUi.jsx';

export default function HelpBubble({
  title,
  body,
  placement = 'bottom',
  label = 'Help',
  testId = 'help-bubble',
  className = '',
}) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef(null);
  const lines = Array.isArray(body) ? body.filter(Boolean) : (body ? [body] : []);

  // Dismiss on outside-click + Esc while open.
  useEffect(() => {
    if (!open) return undefined;
    const onDown = (e) => { if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false); };
    const onKey = (e) => { if (e.key === 'Escape') { e.preventDefault(); setOpen(false); } };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const posStyle = placement === 'top'
    ? { bottom: 'calc(100% + 6px)', right: 0 }
    : { top: 'calc(100% + 6px)', right: 0 };

  return (
    <span ref={wrapRef} className={`relative inline-flex ${className}`} style={{ lineHeight: 0 }}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label={label}
        aria-haspopup="dialog"
        aria-expanded={open}
        title={label}
        data-testid={testId}
        className={`inline-flex items-center justify-center min-h-[44px] min-w-[44px] rounded-full border text-sm font-bold ${FOCUS}`}
        style={{ color: CHALK_DIM, borderColor: CHALK_RAIL, background: 'transparent' }}
      >
        <span
          aria-hidden="true"
          className="inline-flex items-center justify-center rounded-full"
          style={{ width: 24, height: 24, fontFamily: TEXT }}
        >
          ?
        </span>
      </button>

      {open && (
        <div
          role="dialog"
          aria-label={title || label}
          data-testid={`${testId}-popover`}
          className="absolute z-[60] p-3"
          style={{
            ...posStyle,
            width: 284,
            maxWidth: '82vw',
            background: SLATE,
            border: `1px solid ${CHALK_RAIL}`,
            borderRadius: CONTROL_RADIUS,
            color: CHALK_CREAM,
          }}
        >
          <div className="flex items-start justify-between gap-2 mb-1">
            {title && (
              <h4 className="font-semibold" style={{ color: CHALK_CREAM, fontFamily: HAND, fontSize: 22, lineHeight: 1.2, margin: 0 }}>
                {title}
              </h4>
            )}
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Close help"
              data-testid={`${testId}-close`}
              className={`ml-auto -mt-3 -mr-3 inline-flex items-center justify-center min-h-[44px] min-w-[44px] ${FOCUS}`}
              style={{ color: CHALK_DIM, background: 'none', border: 'none', cursor: 'pointer' }}
            >
              <Close size={20} />
            </button>
          </div>
          {lines.map((line, i) => (
            <p
              key={i}
              style={{ color: i === 0 && !title ? CHALK_CREAM : 'inherit', fontFamily: TEXT, fontSize: 15, margin: '0 0 5px', lineHeight: 1.4 }}
            >
              {line}
            </p>
          ))}
        </div>
      )}
    </span>
  );
}
