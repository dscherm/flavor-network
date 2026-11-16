/**
 * StoreAlternatives.jsx (SHOP-4) — the small sheet behind "Store doesn't have it?" on a shopping row.
 *
 *   item        the shopping row { id, key, label, parts, from }
 *   sauce       the row comes from a sauce (swaps that do not hold in a sauce are left out)
 *   names       curated ingredient names (resolves bar candidates)
 *   stock       () => { kitchen, pantry, bar, spiceRack? } what the cook has, read when the sheet opens
 *   loadRoles   () => Promise<roles>  the cocktail role table, fetched only for an alcohol row
 *   onPick(alt) the cook tapped "Use <name> instead"        (the screen replaces the row)
 *   onUseHave(alt) the cook tapped "Use what I have"        (the screen removes the row; nothing else changes)
 *   onClose()   Escape, Close, or a tap outside
 *
 * Up to three alternatives, from kitchenSwaps and (base spirits) cocktailRiff.swapCandidates only; see
 * shoppingAlternatives.js. Advice, never applied without a tap. Rendered into document.body so it cannot sit
 * behind the bottom bar or the consent banner. Focus goes in, Tab wraps, Escape closes; the screen returns focus
 * to the row's button.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { alternativesFor, needsRoles } from '../data/shoppingAlternatives.js';
import { makeHas } from '../data/shoppingList.js';
import { getCocktailRoles } from '../data/ingredientRoles.js';
import { FONT, CHALK_CREAM, CHALK_DIM, CHALK_RAIL } from '../data/chalkTheme.js';

const SANS = 'system-ui, -apple-system, "Segoe UI", sans-serif';
const FOCUS = 'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2';
const btn = { fontFamily: SANS, fontSize: 14, color: CHALK_CREAM, border: `1.5px solid ${CHALK_DIM}`, background: 'transparent', outlineColor: CHALK_CREAM };

export default function StoreAlternatives({ item, sauce = false, names = null, stock, loadRoles = getCocktailRoles, onPick, onUseHave, onClose }) {
  const sheet = useRef(null);
  const wantsRoles = needsRoles(item.key);
  const [roles, setRoles] = useState({ status: wantsRoles ? 'loading' : 'idle', data: null });

  useEffect(() => {
    if (!wantsRoles) return undefined;
    let live = true;
    Promise.resolve().then(() => loadRoles())
      .then((d) => { if (live) setRoles({ status: 'ready', data: d || {} }); })
      .catch(() => { if (live) setRoles({ status: 'failed', data: null }); });
    return () => { live = false; };
  }, [wantsRoles, loadRoles]);

  const has = useMemo(() => makeHas({ ...(stock ? stock() : {}), names }), [stock, names]);
  const { alternatives, known } = useMemo(
    () => alternativesFor(item, { has, roles: roles.data, names, sauce }),
    [item, has, roles.data, names, sauce],
  );

  useEffect(() => {
    const first = sheet.current?.querySelector('button:not([disabled])');
    first?.focus();
  }, [roles.status]);

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') { e.stopPropagation(); onClose(); return; }
      if (e.key !== 'Tab' || !sheet.current) return;
      const els = [...sheet.current.querySelectorAll('button:not([disabled])')];
      if (!els.length) return;
      const first = els[0];
      const last = els[els.length - 1];
      if (!sheet.current.contains(document.activeElement)) { e.preventDefault(); first.focus(); }
      else if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    };
    document.addEventListener('keydown', onKey, true);
    return () => document.removeEventListener('keydown', onKey, true);
  }, [onClose]);

  const title = `Alternatives for ${item.label}`;
  const loading = roles.status === 'loading';

  return createPortal(
    <div
      data-testid="store-alt-overlay"
      className="fixed inset-0 flex items-end sm:items-center justify-center overflow-y-auto"
      style={{ zIndex: 10000, background: 'rgba(0,0,0,0.6)', padding: 12 }}
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <section
        ref={sheet}
        role="dialog"
        aria-modal="true"
        aria-labelledby="store-alt-title"
        data-testid="store-alt-sheet"
        className="w-full rounded-xl p-4"
        style={{ maxWidth: 440, background: '#161a17', border: `1px solid ${CHALK_RAIL}`, boxSizing: 'border-box', color: CHALK_CREAM }}
      >
        <h2 id="store-alt-title" style={{ fontFamily: FONT, fontSize: 24 }}>{title}</h2>
        <p style={{ fontFamily: SANS, fontSize: 13, color: CHALK_DIM, marginTop: 2 }}>
          The closest I know, not a guarantee. Nothing changes until you tap.
        </p>

        {loading && <p role="status" style={{ fontFamily: SANS, fontSize: 14, color: CHALK_DIM, marginTop: 12 }}>Looking for alternatives…</p>}

        {!loading && known && (
          <ul data-testid="store-alt-list" aria-label="Alternatives" className="mt-3">
            {alternatives.map((a) => (
              <li key={a.key} data-testid={`store-alt-${a.key}`} className="py-2" style={{ borderTop: `1px solid ${CHALK_RAIL}55` }}>
                <div style={{ fontFamily: SANS, fontSize: 17 }}>
                  {a.label}
                  {a.have && <span data-testid={`store-alt-have-${a.key}`} style={{ color: CHALK_CREAM, fontSize: 13, marginLeft: 8, border: `1px solid ${CHALK_DIM}`, borderRadius: 999, padding: '1px 8px' }}>you have this</span>}
                </div>
                <p style={{ fontFamily: SANS, fontSize: 14, color: CHALK_DIM }}>{a.useText}</p>
                <button
                  type="button"
                  data-testid={a.have ? `store-alt-use-have-${a.key}` : `store-alt-pick-${a.key}`}
                  onClick={() => (a.have ? onUseHave(a) : onPick(a))}
                  aria-label={a.have ? `Use what I have: ${a.label}, instead of ${item.label}` : `Use ${a.label} instead of ${item.label}`}
                  className={`mt-1 min-h-[44px] px-3 rounded-lg ${FOCUS}`}
                  style={{ ...btn, fontWeight: 600 }}
                >
                  {a.have ? 'Use what I have' : `Use ${a.label} instead`}
                </button>
              </li>
            ))}
          </ul>
        )}

        {!loading && !known && (
          <p data-testid="store-alt-none" style={{ fontFamily: SANS, fontSize: 15, marginTop: 12 }}>
            No stand-in I&apos;d trust for {item.label}.
          </p>
        )}

        <div className="mt-3">
          <button type="button" data-testid="store-alt-close" onClick={onClose} className={`min-h-[44px] px-4 rounded-lg ${FOCUS}`} style={btn}>Close</button>
        </div>
      </section>
    </div>,
    document.body,
  );
}
