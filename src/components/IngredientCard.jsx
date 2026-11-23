/**
 * IngredientCard — the overlay that opens when a cook taps an ingredient name (BUILDER-4).
 *
 * It is the Pairing Lab's chalk single-ingredient card (PairingModeCard, props from buildPairingCardProps)
 * in a dialog, plus what it pairs with, and the actions: "Add to this recipe" / "Swap it in" when it was
 * opened inside a builder, and "Open in Pairing Lab". Closes with the Back button, Escape and a tap outside;
 * focus is kept inside while it is open. Returning focus to the name that opened it is the provider's job.
 *
 * Props
 *   name        canonical ingredient name, or null while the dataset is still loading / when there is no card
 *   status      'loading' | 'ready' | 'unknown'
 *   asked       the text that was tapped (shown when there is no card)
 *   from        ingredient the cook came from by tapping a partner chip (adds shared compounds), or null
 *   strength    pairing strength of that partner chip, or null
 *   data        useProData() payload
 *   builder     { addLabel?, onAdd?, has?, onSwap?, swapFor? } | null
 *   onClose, onOpenPairingLab(name), onNavigate(name, strength)
 * Test ids: ingredient-card-overlay, ingredient-card-dialog, ingredient-card-back, ingredient-card-loading,
 * ingredient-card-unknown, ingredient-card-pairs, ingredient-card-partner, ingredient-card-add,
 * ingredient-card-swap, ingredient-card-have, ingredient-card-pairing-lab.
 */
import { useEffect, useMemo, useRef } from 'react';
import PairingModeCard from './PairingModeCard.jsx';
import { buildPairingCardProps } from '../data/pairingCardData.js';
import { cardPairings } from '../data/ingredientCard.js';
import { FONT, CHALK_CREAM, CHALK_DIM, CHALK_SUB, CHALK_RAIL } from '../data/chalkTheme.js';

const SANS = 'system-ui, -apple-system, "Segoe UI", sans-serif';
const FOCUSABLE = 'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

const chip = (extra = {}) => ({
  fontFamily: FONT, fontSize: 18, padding: '2px 14px', borderRadius: 14, minHeight: 44,
  border: `1px solid ${CHALK_RAIL}`, background: '#0a0a0a', color: CHALK_CREAM, cursor: 'pointer', ...extra,
});

export default function IngredientCard({
  name = null, status = 'ready', asked = '', from = null, strength = null, data = null,
  builder = null, onClose, onOpenPairingLab, onNavigate,
}) {
  const dialogRef = useRef(null);
  const backRef = useRef(null);

  useEffect(() => {
    backRef.current?.focus();
  }, []);

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation?.();
        onClose?.();
        return;
      }
      if (e.key !== 'Tab') return;
      const root = dialogRef.current;
      if (!root) return;
      const items = [...root.querySelectorAll(FOCUSABLE)];
      if (items.length === 0) { e.preventDefault(); return; }
      const first = items[0];
      const last = items[items.length - 1];
      const active = document.activeElement;
      if (!root.contains(active)) { e.preventDefault(); first.focus(); }
      else if (e.shiftKey && active === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && active === last) { e.preventDefault(); first.focus(); }
    };
    document.addEventListener('keydown', onKey, true);
    return () => document.removeEventListener('keydown', onKey, true);
  }, [onClose]);

  const cardProps = useMemo(() => {
    if (status !== 'ready' || !name) return null;
    return buildPairingCardProps(from || name, name, data, { strength: from ? strength : null, lens: 'affinity' });
  }, [status, name, from, strength, data]);

  const partners = useMemo(() => (status === 'ready' && name ? cardPairings(name, data, 8) : []), [status, name, data]);

  const inRecipe = Boolean(name && builder?.has?.(name));
  const showAdd = Boolean(name && builder?.onAdd);
  const showSwap = Boolean(name && builder?.onSwap);

  const commit = (fn) => () => { fn(name); onClose?.(); };

  return (
    <div
      data-testid="ingredient-card-overlay"
      className="fixed inset-0 flex items-center justify-center bg-black/85 p-3"
      style={{ zIndex: 200 }}
      onClick={onClose}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label={name ? `${name} card` : 'Ingredient card'}
        data-testid="ingredient-card-dialog"
        onClick={(e) => e.stopPropagation()}
        className="flex flex-col items-center gap-3 max-h-full overflow-y-auto overflow-x-hidden py-2 w-full"
        style={{ maxWidth: 420 }}
      >
        <div className="w-full flex justify-start">
          <button type="button" ref={backRef} onClick={onClose} data-testid="ingredient-card-back" style={chip({ fontSize: 20 })}>Back</button>
        </div>

        {status === 'loading' && (
          <p role="status" data-testid="ingredient-card-loading" style={{ fontFamily: FONT, fontSize: 24, color: CHALK_CREAM, padding: '32px 0' }}>
            Loading the flavor data…
          </p>
        )}

        {status === 'unknown' && (
          <p role="status" data-testid="ingredient-card-unknown" style={{ fontFamily: SANS, fontSize: 15, color: CHALK_CREAM, textAlign: 'center', padding: '24px 12px' }}>
            There is no card for “{asked}”. The app has no flavor data for it.
          </p>
        )}

        {cardProps && (
          <>
            <PairingModeCard {...cardProps} />
            {from ? (
              <div data-testid="ingredient-card-insight" style={{ fontFamily: SANS, fontSize: 12, color: CHALK_DIM, textAlign: 'center', maxWidth: 360 }}>
                {cardProps.analysis || `${name} pairs with ${from}.`}
              </div>
            ) : null}

            {partners.length > 0 && (
              <div className="w-full" data-testid="ingredient-card-pairs">
                <p className="mb-1" style={{ fontFamily: FONT, fontSize: 18, color: CHALK_SUB }}>Pairs well with</p>
                <div className="flex flex-wrap gap-1.5">
                  {partners.map((p) => (
                    <button key={p.name} type="button" data-testid="ingredient-card-partner" data-name={p.name}
                      aria-label={`About ${p.name}`}
                      onClick={() => onNavigate?.(p.name, p.strength, name)} style={chip({ fontSize: 17 })}>
                      {p.name}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="flex flex-wrap justify-center gap-2 w-full">
              {showAdd && !inRecipe && (
                <button type="button" data-testid="ingredient-card-add" onClick={commit(builder.onAdd)} style={chip({ borderColor: '#6ee7b7aa' })}>
                  {builder.addLabel || 'Add to this recipe'}
                </button>
              )}
              {showAdd && inRecipe && (
                <span data-testid="ingredient-card-have" style={{ fontFamily: SANS, fontSize: 14, color: CHALK_DIM, alignSelf: 'center' }}>
                  Already in this recipe
                </span>
              )}
              {showSwap && (
                <button type="button" data-testid="ingredient-card-swap" onClick={commit(builder.onSwap)} style={chip({ borderColor: '#6ee7b7aa' })}>
                  {builder.swapFor ? `Swap it in for ${builder.swapFor}` : 'Swap it in'}
                </button>
              )}
              {onOpenPairingLab && (
                <button type="button" data-testid="ingredient-card-pairing-lab" onClick={() => { onOpenPairingLab(name); }} style={chip()}>
                  Open in Pairing Lab
                </button>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
