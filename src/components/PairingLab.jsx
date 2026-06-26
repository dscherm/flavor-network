/**
 * PairingLab.jsx — PAIR-LAB-P2 shell + P3/P4 extras.
 *
 * The Pairing Lab: an ingredient-first flavor ego-network. Search/tap a
 * center ingredient → its strongest partners; twist the lens to regroup
 * + recolor them; tap to re-center. Design:
 * .omc/plans/pairing-lab-design-2026-06-25.md.
 *
 * P4 round (user feedback + /design):
 *   - lines: weight = strength, style = provenance (board) + a key here.
 *   - axis caption: always names the active lens's buckets.
 *   - 🎲 Surprise: SAME center, cross-category partners (surprisingNeighborhood).
 *   - peek insights: provenance + ★ strength tier + why-line.
 *   - network pathway: an inline teaser that expands → the focused 3D network.
 *
 * Reuses the existing model wholesale. Additive + null-safe.
 */
import { useState, useMemo, useEffect, useRef } from 'react';
import SearchBar from './SearchBar.jsx';
import PairingBoard from './PairingBoard.jsx';
import PairingModeCard from './PairingModeCard.jsx';
import {
  LENSES, LENS_LABELS, egoNeighborhood, lensInsight, groupByLens,
  sharedNeighborhood, surprisingNeighborhood, partnerBridges,
} from '../data/pairingEgoModel.js';
import { buildPairingCardProps } from '../data/pairingCardData.js';
import {
  FONT, CHALK_CREAM, CHALK_DIM, CHALK_SUB, CHALK_RAIL, chalkSurfaceStyle,
} from '../data/chalkTheme.js';

const SANS = 'system-ui, -apple-system, "Segoe UI", sans-serif';
const PROV_LABEL = {
  chemistry: 'shared chemistry',
  cuisine: 'culinary tradition',
  both: 'chemistry & tradition',
};

function pickDefaultCenter(names) {
  if (!Array.isArray(names) || names.length === 0) return null;
  if (names.includes('garlic')) return 'garlic'; // a famously well-connected hub
  return names[0];
}

function strengthTier(strength, thr) {
  const t = thr || { weak: 0.2, moderate: 0.5, strong: 0.8 };
  if (strength >= t.strong) return '★★★';
  if (strength >= t.moderate) return '★★';
  return '★';
}

const chip = (border = CHALK_RAIL) => ({
  fontFamily: FONT, fontSize: 17, padding: '2px 12px', borderRadius: 14,
  border: `1px solid ${border}`, background: '#0a0a0a', color: CHALK_CREAM, cursor: 'pointer',
});

export default function PairingLab({ ctx: data, onFindCocktail, onFindSauce, onSendToRecipe, onOpenInNetwork }) {
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
  const [compareWith, setCompareWith] = useState(null); // P3c two-ingredient
  const [surprise, setSurprise] = useState(false);       // P4 cross-category
  const [tray, setTray] = useState([]);                  // P3b build-a-plate
  const [netOpen, setNetOpen] = useState(false);         // P4 network teaser

  useEffect(() => {
    if (!center && ingredientNames.length) setCenter(pickDefaultCenter(ingredientNames));
  }, [center, ingredientNames]);

  // Effective partner set:
  //   compareWith → shared neighborhood (two-ingredient mode)
  //   surprise    → cross-category partners (same center)
  //   else        → plain ego neighborhood
  const partners = useMemo(() => {
    if (compareWith) return sharedNeighborhood(center, compareWith, data, { limit: 12 });
    if (surprise) return surprisingNeighborhood(center, data, bucketCtx, { limit: 12 });
    return egoNeighborhood(center, data, { limit: 12 });
  }, [center, compareWith, surprise, data, bucketCtx]);

  const insight = useMemo(() => lensInsight(partners, lens, bucketCtx), [partners, lens, bucketCtx]);
  // PAIR-LAB-P3a — partner pairs that also pair with each other (trios);
  // PairingBoard draws a faint arc between them. (Restored 2026-06-25:
  // the P4 PairingLab rewrite had dropped this wiring.)
  const bridges = useMemo(() => partnerBridges(partners, data), [partners, data]);
  const axisCaption = useMemo(() => {
    if (lens === 'affinity') return '';
    const groups = groupByLens(partners, lens, bucketCtx).filter((g) => g.label !== 'Other');
    if (!groups.length) return '';
    return `${LENS_LABELS[lens]}: ${groups.map((g) => g.label).join(' · ')}`;
  }, [partners, lens, bucketCtx]);

  const displayCenter = compareWith ? `${center} + ${compareWith}` : center;
  const highlightGroup = lens === 'season'
    ? (() => { try { const m = ['Winter', 'Winter', 'Spring', 'Spring', 'Spring', 'Summer', 'Summer', 'Summer', 'Autumn', 'Autumn', 'Autumn', 'Winter'][new Date().getMonth()]; return m; } catch { return null; } })()
    : null;

  const recenter = (name) => { setCenter(name); setCompareWith(null); setSurprise(false); };
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
  const peekPartner = peek && partners.find((p) => p.name === peek);

  return (
    <div
      data-testid="pairing-lab"
      className="fixed inset-0 flex flex-col overflow-hidden"
      style={{ ...chalkSurfaceStyle(), paddingTop: 'var(--nav-h)', color: CHALK_CREAM }}
    >
      {/* Header — title + Surprise + search */}
      <div style={{ padding: '10px 12px 6px', borderBottom: `1px solid ${CHALK_RAIL}` }}>
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
          <div style={{ fontFamily: FONT, fontSize: 26, lineHeight: 1, color: CHALK_CREAM }}>Pairing Lab</div>
          <button
            type="button" data-testid="surprise-btn" aria-pressed={surprise}
            onClick={() => setSurprise((s) => !s)}
            style={{ ...chip(surprise ? CHALK_CREAM : CHALK_RAIL), fontSize: 18, color: surprise ? '#0a0a0a' : CHALK_CREAM, background: surprise ? CHALK_CREAM : '#0a0a0a' }}
          >
            {surprise ? '🎲 Surprising' : '🎲 Surprise'}
          </button>
        </div>
        <div style={{ fontFamily: SANS, fontSize: 12, color: CHALK_SUB, margin: '2px 0 8px' }}>
          Stand on one ingredient — twist the lens to see its partners by aroma, taste, cuisine or season.
        </div>
        <SearchBar inline ingredients={ingredientNames} onSelect={(name) => recenter(name)} />
      </div>

      {/* Mode banners */}
      {compareWith && (
        <div data-testid="compare-banner" style={bannerStyle}>
          <span>Pairs with <strong>{center}</strong> &amp; <strong>{compareWith}</strong></span>
          <button type="button" onClick={() => setCompareWith(null)} aria-label="Exit pair view" style={bannerX}>×</button>
        </div>
      )}
      {surprise && !compareWith && (
        <div data-testid="surprise-banner" style={bannerStyle}>
          <span>Surprising affinities for <strong>{center}</strong> — partners from other flavor families</span>
          <button type="button" onClick={() => setSurprise(false)} aria-label="Exit surprise view" style={bannerX}>×</button>
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

      {/* Insight line + axis caption */}
      <div data-testid="lens-insight" style={{ fontFamily: SANS, fontSize: 13, color: CHALK_DIM, padding: '0 12px 2px', minHeight: 18 }}>
        {insight}
      </div>
      {axisCaption && (
        <div data-testid="axis-caption" style={{ fontFamily: SANS, fontSize: 12, color: CHALK_SUB, padding: '0 12px 6px' }}>
          {axisCaption}
        </div>
      )}

      {/* Board */}
      <div ref={boardRef} style={{ flex: 1, position: 'relative', display: 'flex', justifyContent: 'center' }}>
        {!hasData ? (
          <div style={emptyStyle}>Pairing data isn’t loaded yet.</div>
        ) : partners.length === 0 ? (
          <div style={emptyStyle}>
            {compareWith
              ? `Nothing pairs with both ${center} and ${compareWith}.`
              : center ? `No pairings found for ${center}. Search another ingredient.` : 'Search an ingredient to begin.'}
          </div>
        ) : (
          <>
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
            {/* Line key */}
            <div style={{ position: 'absolute', left: 8, bottom: 6, fontFamily: SANS, fontSize: 10, color: CHALK_SUB, pointerEvents: 'none', lineHeight: 1.4 }}>
              <div>thicker line = stronger pairing</div>
              <div>solid = chemistry · dashed = tradition</div>
            </div>
          </>
        )}
      </div>

      {/* Network pathway — inline teaser that expands to the focused 3D network */}
      {hasData && (
        <div data-testid="network-teaser" style={{ borderTop: `1px solid ${CHALK_RAIL}`, padding: '6px 12px', background: 'rgba(10,10,10,0.5)' }}>
          {!netOpen ? (
            <button type="button" data-testid="network-teaser-toggle" onClick={() => setNetOpen(true)}
              style={{ background: 'none', border: 'none', color: CHALK_DIM, fontFamily: SANS, fontSize: 12, cursor: 'pointer', padding: 0 }}>
              🌐 Where do these pairings come from?
            </button>
          ) : (
            <div style={{ fontFamily: SANS, fontSize: 12, color: CHALK_DIM, lineHeight: 1.5 }}>
              Each line is a real co-occurrence across 2.2M recipes plus shared flavor chemistry. The full
              <strong> flavor network</strong> maps every ingredient at once — this lab zooms into one.
              <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
                <button type="button" data-testid="network-open" style={chip()}
                  onClick={() => onOpenInNetwork?.(center)}>See {center} in the network →</button>
                <button type="button" onClick={() => setNetOpen(false)} aria-label="Collapse"
                  style={{ ...chip(), color: CHALK_DIM }}>Hide</button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Build-a-plate tray */}
      {tray.length > 0 && (
        <div data-testid="tray-bar" style={{ borderTop: `1px solid ${CHALK_RAIL}`, padding: '8px 12px', background: 'rgba(10,10,10,0.6)' }}>
          <div style={{ fontFamily: SANS, fontSize: 12, color: CHALK_SUB, marginBottom: 4 }}>
            Your plate · {tray.length} pick{tray.length === 1 ? '' : 's'}: {tray.join(', ')} — send to a lab to build with them:
          </div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            <button type="button" data-testid="tray-send-cocktail" style={chip()} onClick={() => onFindCocktail?.(tray, center)}>🍸 Cocktail</button>
            <button type="button" data-testid="tray-send-sauce" style={chip()} onClick={() => onFindSauce?.(tray, center)}>🥣 Sauce</button>
            <button type="button" data-testid="tray-send-recipe" style={chip()} onClick={() => onSendToRecipe?.(tray, center)}>📓 Recipe</button>
            <button type="button" data-testid="tray-clear" style={{ ...chip(), color: CHALK_DIM }} onClick={() => setTray([])}>Clear</button>
          </div>
        </div>
      )}

      {/* Partner / focus pairing card — the rich Guided card (analysis,
          shared compounds, profile radar), no swipe deck. Opened by a
          tap-then-details on a partner, or a long-press on the focus oval
          (peek === center → the focus ingredient's own profile). */}
      {peek && peekNode && (
        <div
          data-testid="pairing-card-overlay"
          className="fixed inset-0 flex items-center justify-center bg-black/75 p-3"
          style={{ zIndex: 150 }}
          onClick={() => setPeek(null)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="flex flex-col items-center gap-3 max-h-full overflow-y-auto py-2"
          >
            <PairingModeCard
              {...buildPairingCardProps(center, peek, data, {
                strength: peek === center ? null : (peekPartner?.strength ?? null),
                lens,
              })}
            />
            <div
              data-testid="peek-insight"
              style={{ fontFamily: SANS, fontSize: 12, color: CHALK_DIM, textAlign: 'center', maxWidth: 360 }}
            >
              {peek === center
                ? `${peek} — its own flavor profile.`
                : `${strengthTier(peekPartner?.strength, data?.affinityThresholds)} pairs with ${center} via ${PROV_LABEL[peekPartner?.provenance] || 'shared chemistry'}.`}
            </div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', justifyContent: 'center' }}>
              {peek !== center && (
                <button type="button" data-testid="peek-center" style={chip()} onClick={() => { recenter(peek); setPeek(null); }}>Center on {peek}</button>
              )}
              {peek !== center && (
                <button type="button" data-testid="peek-pair" style={chip()} onClick={() => { setCompareWith(peek); setPeek(null); }}>🔗 Pair with {center}</button>
              )}
              <button type="button" data-testid="peek-add" style={chip()} onClick={() => { addToTray(peek); setPeek(null); }}>➕ Add to plate</button>
              <button type="button" data-testid="peek-close" style={{ ...chip(), color: CHALK_DIM }} onClick={() => setPeek(null)}>Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const bannerStyle = {
  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
  padding: '6px 12px', fontFamily: SANS, fontSize: 13, color: CHALK_CREAM,
  background: 'rgba(245,239,222,0.06)', borderBottom: `1px solid ${CHALK_RAIL}`,
};
const bannerX = { background: 'none', border: 'none', color: CHALK_DIM, fontSize: 18, cursor: 'pointer' };
const emptyStyle = { alignSelf: 'center', fontFamily: SANS, color: CHALK_SUB, padding: 24, textAlign: 'center' };
