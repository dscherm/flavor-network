import { useEffect, useState } from 'react';

/**
 * ClassicalMatchToast — celebratory pop-in when the user's recipe
 * transitions from partial-match to complete-match against a
 * classical entry. Fires once per completion event, auto-dismisses
 * after 4 seconds.
 *
 * Props:
 *   match — the complete-match object from classicalMatcher
 *           (null when recipe is incomplete)
 *   onDismiss — optional callback
 */

const FONT_FAMILY = 'Caveat, cursive';

export default function ClassicalMatchToast({ match, onDismiss }) {
  const [visible, setVisible] = useState(false);
  const [current, setCurrent] = useState(null);

  useEffect(() => {
    if (!match) return;
    // Dedup: only re-show if match.name changed.
    if (current?.name === match.name) return;
    setCurrent(match);
    setVisible(true);
    const t = setTimeout(() => {
      setVisible(false);
      onDismiss?.();
    }, 4000);
    return () => clearTimeout(t);
  }, [match, current, onDismiss]);

  if (!current || !visible) return null;

  return (
    <div
      className="fixed left-1/2 -translate-x-1/2 z-50 pointer-events-none"
      style={{
        top: 'calc(var(--nav-h, 2.5rem) + 0.75rem)',
        animation: 'classicalToastIn 320ms ease-out',
      }}
    >
      <style>{`
        @keyframes classicalToastIn {
          from { transform: translate(-50%, -16px) scale(0.9); opacity: 0; }
          to   { transform: translate(-50%, 0)    scale(1);   opacity: 1; }
        }
      `}</style>
      <div
        className="pointer-events-auto px-4 py-2 rounded-full shadow-lg border-2 flex items-center gap-2"
        style={{
          fontFamily: FONT_FAMILY,
          background: 'linear-gradient(135deg, #e4f1d8 0%, #f5edd0 100%)',
          borderColor: '#8aa87a',
          color: '#3a5a2a',
        }}
      >
        <span className="text-lg">✨</span>
        <span className="text-xs uppercase tracking-wider opacity-70">You built a</span>
        <span className="text-lg font-medium">{current.name}</span>
      </div>
    </div>
  );
}
