/**
 * AffinityPanel — β-mode mobile fallback for the Flavor Affinity rings.
 *
 * On viewports under 640px the planetary α-mode rings cramp + the touch
 * raycast on small spheres is unreliable, so we surface the same data
 * (top 30 tier-coded affinities) as a three-column chip layout instead.
 *
 * Two render modes:
 *   - Embedded (default): renders as a panel section, no overlay/dismiss.
 *     Used inside IngredientPanel on mobile.
 *   - Standalone overlay: pass `onClose` and AffinityPanel becomes a
 *     fixed-position card with capture-phase tap-outside dismiss + X
 *     button (matches the spec's "Flavor Bible page" overlay shape).
 */
import { useEffect, useRef } from 'react';

const TIER_LABEL = { 3: '★★★', 2: '★★', 1: '★', 0: 'Surprising' };
const TIER_TONE = {
  3: 'border-yellow-400/40 text-yellow-200/95 bg-yellow-400/5 hover:bg-yellow-400/15',
  2: 'border-zinc-300/40 text-zinc-200/95 bg-zinc-300/5 hover:bg-zinc-300/15',
  1: 'border-amber-700/40 text-amber-200/85 bg-amber-700/5 hover:bg-amber-700/15',
  0: 'border-fuchsia-500/40 text-fuchsia-200/95 bg-fuchsia-500/5 hover:bg-fuchsia-500/15',
};
const TIER_HEADER_TONE = {
  3: 'text-yellow-300',
  2: 'text-zinc-300',
  1: 'text-amber-500',
  0: 'text-fuchsia-300',
};

function TierColumn({ tier, items, onPivot }) {
  const titleFor = (aff) =>
    tier === 0 && aff.bridge
      ? `${aff.name} — bridged by ${aff.bridge}`
      : `${aff.name} — strength ${aff.strength.toFixed(2)}`;
  return (
    <div className="flex-1 min-w-0">
      <div className={`text-[10px] uppercase tracking-widest font-semibold mb-2 flex items-baseline gap-1 ${TIER_HEADER_TONE[tier]}`}>
        <span>{TIER_LABEL[tier]}</span>
        <span className="text-gray-500 normal-case tracking-normal">({items.length})</span>
      </div>
      <div className="flex flex-col gap-1">
        {items.map((aff) => (
          <button
            key={aff.name}
            type="button"
            onClick={() => onPivot?.(aff.name)}
            className={`text-left px-2 py-1 rounded border text-xs font-medium transition truncate ${TIER_TONE[tier]}`}
            title={titleFor(aff)}
          >
            {aff.name}
          </button>
        ))}
        {items.length === 0 && (
          <span className="text-[10px] text-gray-600 italic">none</span>
        )}
      </div>
    </div>
  );
}

export default function AffinityPanel({ focal, affinities = [], onPivot, onClose }) {
  const panelRef = useRef(null);
  const isOverlay = typeof onClose === 'function';

  useEffect(() => {
    if (!isOverlay) return undefined;
    const handlePointer = (e) => {
      if (!panelRef.current) return;
      if (panelRef.current.contains(e.target)) return;
      onClose?.();
    };
    const handleKey = (e) => {
      if (e.key === 'Escape') onClose?.();
    };
    document.addEventListener('pointerdown', handlePointer, { capture: true });
    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('pointerdown', handlePointer, { capture: true });
      document.removeEventListener('keydown', handleKey);
    };
  }, [isOverlay, onClose]);

  const ring3 = affinities.filter((a) => a.ringIdx === 3);
  const ring2 = affinities.filter((a) => a.ringIdx === 2);
  const ring1 = affinities.filter((a) => a.ringIdx === 1);
  const ring0 = affinities.filter((a) => a.ringIdx === 0);

  if (!affinities.length) return null;

  const body = (
    <div ref={panelRef} className="w-full">
      <div className="flex items-baseline justify-between mb-2">
        <h3 className="text-[11px] uppercase tracking-widest text-gray-500 font-semibold">
          Flavor Affinities {focal ? <span className="text-gray-400 normal-case tracking-normal">— {focal}</span> : null}
        </h3>
        {isOverlay && (
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="text-gray-500 hover:text-gray-200 px-2 -mr-2"
          >
            ×
          </button>
        )}
      </div>
      <div className="flex gap-2">
        <TierColumn tier={3} items={ring3} onPivot={onPivot} />
        <TierColumn tier={2} items={ring2} onPivot={onPivot} />
        <TierColumn tier={1} items={ring1} onPivot={onPivot} />
        {ring0.length > 0 && (
          <TierColumn tier={0} items={ring0} onPivot={onPivot} />
        )}
      </div>
    </div>
  );

  if (isOverlay) {
    return (
      <div className="fixed inset-x-3 top-3 z-40 rounded-lg border border-gray-700/60 bg-gray-900/95 backdrop-blur p-3 shadow-2xl">
        {body}
      </div>
    );
  }
  return body;
}
