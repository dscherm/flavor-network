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
 *     variant="chalk"        // 'light' (network UI) | 'chalk' (recipe cards)
 *     placement="bottom"     // 'bottom' | 'top'
 *   />
 */
import { useEffect, useRef, useState } from 'react';

// Variant palettes. 'light' matches HelpButton.jsx (dark translucent + cyan
// accent on the network UI); 'chalk' matches the chalkboard cards
// (RecipeFlavorProfilesCard / IngredientProfileCard).
const VARIANTS = {
  light: {
    btn: 'text-gray-400 bg-[#12121a]/90 border-[#1e1e2e] hover:text-cyan-300 hover:border-cyan-500/40 focus:ring-cyan-500',
    pop: { background: '#12121aF2', border: '1px solid #2a2a3a', color: '#d8dae0' },
    title: '#67e8f9',
    sub: '#9aa0ac',
    font: 'inherit',
    shadow: '0 6px 24px rgba(0,0,0,0.5)',
  },
  chalk: {
    btn: 'text-[#bdb6a3] bg-[#1c1c1c]/90 border-[#4a4a4a] hover:text-[#f5efde] hover:border-[#6a6a6a] focus:ring-[#6a6a6a]',
    pop: {
      background: 'radial-gradient(ellipse at center, #1c1c1c 0%, #0a0a0a 75%, #050505 100%), #0a0a0a',
      border: '2px double #4a4a4a',
      color: '#f5efde',
    },
    title: '#f5efde',
    sub: '#bdb6a3',
    font: 'Caveat, cursive',
    shadow: '0 8px 24px rgba(0,0,0,0.55)',
  },
};

export default function HelpBubble({
  title,
  body,
  variant = 'light',
  placement = 'bottom',
  label = 'Help',
  testId = 'help-bubble',
  className = '',
}) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef(null);
  const v = VARIANTS[variant] || VARIANTS.light;
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
        className={
          'inline-flex items-center justify-center min-h-[44px] min-w-[44px] '
          + 'rounded-full border text-sm font-bold backdrop-blur-md '
          + 'transition-all duration-200 focus:outline-none focus:ring-1 '
          + v.btn
        }
      >
        <span
          aria-hidden="true"
          className="inline-flex items-center justify-center rounded-full"
          style={{ width: 24, height: 24, fontFamily: v.font }}
        >
          ?
        </span>
      </button>

      {open && (
        <div
          role="dialog"
          aria-label={title || label}
          data-testid={`${testId}-popover`}
          className="absolute z-[60] rounded-xl p-3"
          style={{
            ...posStyle,
            width: 248,
            maxWidth: '78vw',
            boxShadow: v.shadow,
            ...v.pop,
          }}
        >
          <div className="flex items-start justify-between gap-2 mb-1">
            {title && (
              <h4 className="text-base font-semibold" style={{ color: v.title, fontFamily: v.font, margin: 0 }}>
                {title}
              </h4>
            )}
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Close help"
              data-testid={`${testId}-close`}
              className="ml-auto -mt-1 -mr-1 px-1 text-lg leading-none"
              style={{ color: v.sub, background: 'none', border: 'none', cursor: 'pointer' }}
            >
              ×
            </button>
          </div>
          {lines.map((line, i) => (
            <p
              key={i}
              className="text-sm"
              style={{ color: i === 0 && !title ? v.title : 'inherit', fontFamily: v.font, margin: '0 0 4px', lineHeight: 1.4 }}
            >
              {line}
            </p>
          ))}
        </div>
      )}
    </span>
  );
}
