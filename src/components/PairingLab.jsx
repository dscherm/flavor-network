/**
 * PairingLab.jsx — PAIR-LAB-P2 shell + P3 extras.
 *
 * The Pairing Lab: a chalk-framed surface holding an ingredient search,
 * the lens segmented control, the PairingBoard ego renderer, a one-line
 * lens-contrast insight, and a bottom-sheet partner peek. Reintroduces
 * "network mode" as an ingredient-first ego-network — design in
 * .omc/plans/pairing-lab-design-2026-06-25.md.
 *
 * P3 extras layered in:
 *   a) bridge arcs — partnerBridges() passed to the board.
 *   b) build-a-plate — collect partners into a tray → send to
 *      Cocktail/Sauce/Recipe via the existing handoffs.
 *   c) two-ingredient mode — "pair with" sets a second center; the board
 *      shows the shared neighborhood.
 *   d) season-now — the season lens stars the current month's bucket.
 *   e) serendipity — 🎲 re-centers on a strong-but-not-obvious partner.
 *
 * Reuses the existing model wholesale (pairingEgoModel over graph.js +
 * categoricalAxes). No new data, no model training. Additive + null-safe.
 */
import { useState, useMemo, useEffect, useRef } from 'react';
import SearchBar from './SearchBar.jsx';
import BottomSheet from './BottomSheet.jsx';
import PairingBoard from './PairingBoard.jsx';
import {
  LENSES, LENS_LABELS, egoNeighborhood, lensInsight,
  partnerBridges, sharedNeighborhood, monthToSeasonLabel, serendipitousPick,
} from '../data/pairingEgoModel.js';
import {
  FONT, CHALK_CREAM, CHALK_DIM, CHALK_SUB, CHALK_RAIL, chalkSurfaceStyle,
} from '../data/chalkTheme.js';

const SANS = 'system-ui, -apple-system, "Segoe UI", sans-serif';

function pickDefaultCenter(names) {
  if (!Array.isArray(names) || names.length === 0) return null;
  if (names.includes('garlic')) return 'garlic'; // a famously well-connected hub
  return names[0];
}

const chip = (border = CHALK_RAIL) => ({
  fontFamily: FONT, fontSize: 17, padding: '2px 12px', borderRadius: 14,
  border: `1px solid ${border}`, background: '#0a0a0a', color: CHALK_CREAM, cursor: 'pointer',
});

export default function PairingLab({ ctx: data, onFindCocktail, onFindSauce, onSendToRecipe }) {
  const nodes = data?.graph?.nodes;
  const ingredientNames = useMemo(() => {
    const list = data?.graph?.ingredientList;
    if (Array.isArray(list) && list.length) return list;
    if (nodes?.keys) return [...nodes.keys()];
    return [];
  }, [data, nodes]);

  const bucketCtx = useMemo(() => ({
    gnnEntropy: data?.gnnEntropy, cuisineMap: data?.cuisineMap, seasonMap: data?.seasonMap,
  }), [data]);

  const [center, setCenter] = useState(() => pickDefaultCenter(ingredientNames));
  const [lens, setLens] = useState('affinity');
  const [peek, setPeek] = useState(null);
  const [compareWith, setCompareWith] = useState(null); // P3c
  const [tray, setTray] = useState([]);                 // P3b

  // current season for the season-now star (P3d). new Date() is fine in
  // app runtime (only the workflow sandbox forbids it).
  const currentSeason = useMemo(() => {
    try { return monthToSeasonLabel(new Date().getMonth()); } catch { return null; }
  }, []);

  useEffect(() => {
    if (!center && ingredientNames.length) setCenter(pickDefaultCenter(ingredientNames));
  }, [center, ingredientNames]);

  // Effective partner set: shared neighborhood in two-ingredient mode,
  // otherwise the plain ego neighborhood.
  const partners = useMemo(() => (
    compareWith
      ? sharedNeighborhood(center, compareWith, data, { limit: 12 })
      : egoNeighborhood(center, data, { limit: 12 })
  ), [center, compareWith, data]);

  const bridges = useMemo(() => partnerBridges(partners, data), [partners, data]);
  const insight = useMemo(() => lensInsight(partners, lens, bucketCtx), [partners, lens, bucketCtx]);
  const displayCenter = compareWith ? `${center} + ${compareWith}` : center;
  const highlightGroup = lens === 'season' ? currentSeason : null;

  const recenter = (name) => { setCenter(name); setCompareWith(null); };
  const shuffle = () => { const pick = serendipitousPick(partners, Math.random); if (pick) recenter(pick); };
  const addToTray = (name) => setTray((t) => (t.includes(name) ? t : [...t, name]));

  // Board sizing (mobile-first; sane fallbacks).
  const boardRef = useRef(null);
  const [dims, setDims] = useState({ w: 360, h: 420 });
  useEffect(() => {
    const measure = () => {
      const el = boardRef.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      setDims({ w: Math.max(280, Math.round(r.width)), h: Math.max(300, Math.round(r.height)) });
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
      {/* Header — title + shuffle + search */}
      <div style={{ padding: '10px 12px 6px', borderBottom: `1px solid ${CHALK_RAIL}` }}>
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
          <div style={{ fontFamily: FONT, fontSize: 26, lineHeight: 1, color: CHALK_CREAM }}>Pairing Lab</div>
          <button
            type="button" data-testid="shuffle-btn" onClick={shuffle} aria-label="Surprise me"
            style={{ ...chip(), fontSize: 18 }}
          >
            🎲 Surprise
          </button>
        </div>
        <div style={{ fontFamily: SANS, fontSize: 12, color: CHALK_SUB, margin: '2px 0 8px' }}>
          Stand on one ingredient — twist the lens to see its partners by aroma, taste, cuisine or season.
        </div>
        <SearchBar ingredients={ingredientNames} onSelect={(name) => recenter(name)} />
      </div>

      {/* Two-ingredient banner (P3c) */}
      {compareWith && (
        <div
          data-testid="compare-banner"
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '6px 12px', fontFamily: SANS, fontSize: 13, color: CHALK_CREAM,
            background: 'rgba(245,239,222,0.06)', borderBottom: `1px solid ${CHALK_RAIL}`,
          }}
        >
          <span>Pairs with <strong>{center}</strong> &amp; <strong>{compareWith}</strong></span>
          <button type="button" onClick={() => setCompareWith(null)} aria-label="Exit pair view"
            style={{ background: 'none', border: 'none', color: CHALK_DIM, fontSize: 18, cursor: 'pointer' }}>×</button>
        </div>
      )}

      {/* Lens segmented control */}
      <div role="tablist" aria-label="Pairing lens" style={{ display: 'flex', gap: 6, padding: '8px 12px', flexWrap: 'wrap' }}>
        {LENSES.map((l) => {
          const active = l === lens;
          return (
            <button
              key={l} type="button" role="tab" aria-selected={active}
              onClick={() => setLens(l)} data-testid={`lens-${l}`}
              style={{
                fontFamily: FONT, fontSize: 18, padding: '2px 12px', borderRadius: 14,
                border: `1px solid ${active ? CHALK_CREAM : CHALK_RAIL}`,
                background: active ? CHALK_CREAM : 'transparent',
                color: active ? '#0a0a0a' : CHALK_DIM, cursor: 'pointer',
              }}
            >
              {LENS_LABELS[l]}
            </button>
          );
        })}
      </div>

      {/* Insight line */}
      <div data-testid="lens-insight" style={{ fontFamily: SANS, fontSize: 13, color: CHALK_DIM, padding: '0 12px 6px', minHeight: 18 }}>
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
            {compareWith
              ? `Nothing pairs with both ${center} and ${compareWith}.`
              : center ? `No pairings found for ${center}. Search another ingredient.` : 'Search an ingredient to begin.'}
          </div>
        ) : (
          <PairingBoard
            center={displayCenter}
            centerNode={center ? nodes?.get?.(center) : null}
            partners={partners}
            lens={lens}
            ctx={bucketCtx}
            bridges={bridges}
            highlightGroup={highlightGroup}
            width={dims.w}
            height={dims.h}
            onSelectPartner={(name) => recenter(name)}
            onPeek={(name) => setPeek(name)}
          />
        )}
      </div>

      {/* Build-a-plate tray (P3b) */}
      {tray.length > 0 && (
        <div
          data-testid="tray-bar"
          style={{ borderTop: `1px solid ${CHALK_RAIL}`, padding: '8px 12px', background: 'rgba(10,10,10,0.6)' }}
        >
          <div style={{ fontFamily: SANS, fontSize: 12, color: CHALK_SUB, marginBottom: 4 }}>
            Plate ({tray.length}): {tray.join(', ')}
          </div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            <button type="button" data-testid="tray-send-cocktail" style={chip()}
              onClick={() => onFindCocktail?.(tray, center)}>🍸 Cocktail</button>
            <button type="button" data-testid="tray-send-sauce" style={chip()}
              onClick={() => onFindSauce?.(tray, center)}>🥣 Sauce</button>
            <button type="button" data-testid="tray-send-recipe" style={chip()}
              onClick={() => onSendToRecipe?.(tray, center)}>📓 Recipe</button>
            <button type="button" data-testid="tray-clear"
              style={{ ...chip(), color: CHALK_DIM }} onClick={() => setTray([])}>Clear</button>
          </div>
        </div>
      )}

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
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 12 }}>
              <button type="button" data-testid="peek-center" style={chip()}
                onClick={() => { if (peek) recenter(peek); setPeek(null); }}>Center on {peek}</button>
              <button type="button" data-testid="peek-pair" style={chip()}
                onClick={() => { setCompareWith(peek); setPeek(null); }}>🔗 Pair with {center}</button>
              <button type="button" data-testid="peek-add" style={chip()}
                onClick={() => { addToTray(peek); setPeek(null); }}>➕ Add to plate</button>
            </div>
          </div>
        ) : (
          <div style={{ fontFamily: SANS, color: CHALK_SUB }}>No details available.</div>
        )}
      </BottomSheet>
    </div>
  );
}
