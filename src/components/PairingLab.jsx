/**
 * PairingLab.jsx — PAIR-LAB-P2.
 *
 * The Pairing Lab shell: a chalk-framed surface holding an ingredient
 * search, the lens segmented control, the PairingBoard ego renderer, a
 * one-line lens-contrast insight, and a bottom-sheet partner peek. This
 * reintroduces "network mode" as an ingredient-first ego-network — see
 * .omc/plans/pairing-lab-design-2026-06-25.md.
 *
 * Reuses the existing model wholesale: egoNeighborhood / groupByLens /
 * lensInsight (pairingEgoModel) over graph.js pairings + the
 * categoricalAxes lenses. No new data, no model training.
 *
 * Additive + null-safe: degrades to a clear message if the pairing data
 * isn't loaded; the board itself degrades to a partner list if the 2D
 * canvas is unavailable.
 */
import { useState, useMemo, useEffect, useRef } from 'react';
import SearchBar from './SearchBar.jsx';
import BottomSheet from './BottomSheet.jsx';
import PairingBoard from './PairingBoard.jsx';
import {
  LENSES, LENS_LABELS, egoNeighborhood, lensInsight,
} from '../data/pairingEgoModel.js';
import {
  FONT, CHALK_CREAM, CHALK_DIM, CHALK_SUB, CHALK_RAIL, chalkSurfaceStyle,
} from '../data/chalkTheme.js';

const SANS = 'system-ui, -apple-system, "Segoe UI", sans-serif';

function pickDefaultCenter(names) {
  if (!Array.isArray(names) || names.length === 0) return null;
  // Garlic is a famously well-connected hub — a good first impression.
  if (names.includes('garlic')) return 'garlic';
  return names[0];
}

export default function PairingLab({ ctx: data }) {
  const nodes = data?.graph?.nodes;
  const ingredientNames = useMemo(() => {
    const list = data?.graph?.ingredientList;
    if (Array.isArray(list) && list.length) return list;
    if (nodes?.keys) return [...nodes.keys()];
    return [];
  }, [data, nodes]);

  const bucketCtx = useMemo(() => ({
    gnnEntropy: data?.gnnEntropy,
    cuisineMap: data?.cuisineMap,
    seasonMap: data?.seasonMap,
  }), [data]);

  const [center, setCenter] = useState(() => pickDefaultCenter(ingredientNames));
  const [lens, setLens] = useState('affinity');
  const [peek, setPeek] = useState(null);

  // Adopt a default center once data arrives (center may start null).
  useEffect(() => {
    if (!center && ingredientNames.length) setCenter(pickDefaultCenter(ingredientNames));
  }, [center, ingredientNames]);

  const partners = useMemo(
    () => egoNeighborhood(center, data, { limit: 12 }),
    [center, data],
  );
  const insight = useMemo(
    () => lensInsight(partners, lens, bucketCtx),
    [partners, lens, bucketCtx],
  );

  // Measure the board area (mobile-first; fall back to sane defaults).
  const boardRef = useRef(null);
  const [dims, setDims] = useState({ w: 360, h: 440 });
  useEffect(() => {
    const measure = () => {
      const el = boardRef.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      setDims({ w: Math.max(280, Math.round(r.width)), h: Math.max(320, Math.round(r.height)) });
    };
    measure();
    if (typeof window !== 'undefined') {
      window.addEventListener('resize', measure);
      return () => window.removeEventListener('resize', measure);
    }
    return undefined;
  }, []);

  const hasData = Array.isArray(data?.graph?.edges) && data.graph.edges.length > 0;
  const peekNode = peek && nodes?.get?.(peek);

  return (
    <div
      data-testid="pairing-lab"
      className="fixed inset-0 flex flex-col overflow-hidden"
      style={{ ...chalkSurfaceStyle(), paddingTop: 'var(--nav-h)', color: CHALK_CREAM }}
    >
      {/* Header — title + search */}
      <div style={{ padding: '10px 12px 6px', borderBottom: `1px solid ${CHALK_RAIL}` }}>
        <div style={{ fontFamily: FONT, fontSize: 26, lineHeight: 1, color: CHALK_CREAM }}>
          Pairing Lab
        </div>
        <div style={{ fontFamily: SANS, fontSize: 12, color: CHALK_SUB, marginBottom: 8 }}>
          Stand on one ingredient — twist the lens to see its partners by aroma, taste, cuisine or season.
        </div>
        <SearchBar ingredients={ingredientNames} onSelect={(name) => { setCenter(name); }} />
      </div>

      {/* Lens segmented control */}
      <div
        role="tablist"
        aria-label="Pairing lens"
        style={{ display: 'flex', gap: 6, padding: '8px 12px', flexWrap: 'wrap' }}
      >
        {LENSES.map((l) => {
          const active = l === lens;
          return (
            <button
              key={l}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => setLens(l)}
              data-testid={`lens-${l}`}
              style={{
                fontFamily: FONT, fontSize: 18, padding: '2px 12px', borderRadius: 14,
                border: `1px solid ${active ? CHALK_CREAM : CHALK_RAIL}`,
                background: active ? CHALK_CREAM : 'transparent',
                color: active ? '#0a0a0a' : CHALK_DIM,
                cursor: 'pointer',
              }}
            >
              {LENS_LABELS[l]}
            </button>
          );
        })}
      </div>

      {/* Insight line */}
      <div
        data-testid="lens-insight"
        style={{ fontFamily: SANS, fontSize: 13, color: CHALK_DIM, padding: '0 12px 6px', minHeight: 18 }}
      >
        {insight}
      </div>

      {/* Board */}
      <div ref={boardRef} style={{ flex: 1, position: 'relative', display: 'flex', justifyContent: 'center' }}>
        {!hasData ? (
          <div style={{ alignSelf: 'center', fontFamily: SANS, color: CHALK_SUB, padding: 24, textAlign: 'center' }}>
            Pairing data isn’t loaded yet.
          </div>
        ) : partners.length === 0 ? (
          <div style={{ alignSelf: 'center', fontFamily: SANS, color: CHALK_SUB, padding: 24, textAlign: 'center' }}>
            {center ? `No pairings found for ${center}. Search another ingredient.` : 'Search an ingredient to begin.'}
          </div>
        ) : (
          <PairingBoard
            center={center}
            centerNode={center ? nodes?.get?.(center) : null}
            partners={partners}
            lens={lens}
            ctx={bucketCtx}
            width={dims.w}
            height={dims.h}
            onSelectPartner={(name) => setCenter(name)}
            onPeek={(name) => setPeek(name)}
          />
        )}
      </div>

      {/* Partner peek */}
      <BottomSheet isOpen={!!peek} onClose={() => setPeek(null)} title={peek || ''}>
        {peekNode ? (
          <div style={{ fontFamily: SANS, fontSize: 14, color: CHALK_CREAM, lineHeight: 1.5 }}>
            {peekNode.taste && <div><strong>Taste:</strong> {peekNode.taste}</div>}
            {Array.isArray(peekNode.cuisines) && peekNode.cuisines.length > 0 && (
              <div><strong>Cuisines:</strong> {peekNode.cuisines.join(', ')}</div>
            )}
            {Array.isArray(peekNode.flavorGraph?.tier1) && peekNode.flavorGraph.tier1.length > 0 && (
              <div><strong>Aroma:</strong> {peekNode.flavorGraph.tier1.join(', ')}</div>
            )}
            <button
              type="button"
              onClick={() => { if (peek) setCenter(peek); setPeek(null); }}
              style={{
                marginTop: 12, fontFamily: FONT, fontSize: 18, padding: '4px 16px',
                borderRadius: 14, border: `1px solid ${CHALK_RAIL}`, background: '#0a0a0a',
                color: CHALK_CREAM, cursor: 'pointer',
              }}
            >
              Center on {peek}
            </button>
          </div>
        ) : (
          <div style={{ fontFamily: SANS, color: CHALK_SUB }}>No details available.</div>
        )}
      </BottomSheet>
    </div>
  );
}
