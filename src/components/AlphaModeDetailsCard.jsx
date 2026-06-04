/**
 * AlphaModeDetailsCard — α-mode Screen 1 / Network details overlay.
 * (B-version rev 2 per user 2026-06-04.)
 *
 * Shows the focal ingredient's NAME, TIERS, CUISINES, SEASON, and
 * CHEMISTRY (when GNN top-compound data exists). Replaces the 4
 * taste radars from rev 1 with a SWIPEABLE AFFINITY CAROUSEL that
 * groups the focal's pairings by sharing reason:
 *
 *   View 1 — Tier 1 pairings (shared aroma)
 *   View 2 — Tier 2 pairings (shared taste)
 *   View 3 — Tier 3 / Leaves pairings (shared mouthfeel / leaves)
 *   View 4 — Shared cuisines
 *
 * Each view shows the focal at center labeled with the view's name +
 * up to 12 pairings as cluster-colored dots on a dashed orbit.
 *   - Single-tap a node → reveals the pairing's name (inline label).
 *   - Double-tap a node → fires onSelectPairing(name).
 * Swipe left/right (touch + mouse drag) cycles the 4 views; bottom
 * buttons mirror the swipe.
 *
 * Also used from Network mode as the first screen after a node tap
 * (before PairingMode).
 */

import React, { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { getNeighborsEnriched } from '../data/graph.js';

const FONT = 'Caveat, cursive';
const CHALK_BG = `
  radial-gradient(ellipse at center, #1c1c1c 0%, #0a0a0a 75%, #050505 100%),
  #0a0a0a
`;
const CHALK_BORDER_OUTER = '#4a4a4a';
const CHALK_BORDER_INNER = '#6a6a6a';
const CHALK_CREAM = '#f5efde';
const CHALK_DIM = '#bdb6a3';
const CHALK_SUB = '#8a8478';
const CHALK_TEXT_SHADOW = '0 0 1px rgba(245,239,222,0.55), 0 0 3px rgba(245,239,222,0.22)';

const CLUSTER_COLORS = [
  '#22c55e', '#f59e0b', '#ec4899', '#06b6d4', '#a855f7',
  '#84cc16', '#fb7185', '#0ea5e9', '#facc15', '#14b8a6',
  '#fde68a', '#94a3b8',
];
function clusterColor(node) {
  const cid = typeof node?.cluster === 'number' ? node.cluster : 0;
  return CLUSTER_COLORS[cid % CLUSTER_COLORS.length];
}

function tokenize(str) {
  if (!str || typeof str !== 'string') return [];
  return str.toLowerCase().split(/[\s,/-]+/).filter(Boolean);
}

const RING_SIZE = 300;
const RING_CENTER = RING_SIZE / 2;
const RING_RADIUS = RING_CENTER - 36;
const RING_MAX = 12;

const VIEWS = [
  { id: 'aroma',     label: 'Tier 1 pairings',   sub: 'shared aroma' },
  { id: 'taste',     label: 'Tier 2 pairings',   sub: 'shared taste' },
  { id: 'mouthfeel', label: 'Tier 3 / Leaves',   sub: 'shared mouthfeel + leaves' },
  { id: 'cuisine',   label: 'Shared cuisines',   sub: 'cooked in the same kitchens' },
];

function intersectLower(a, b) {
  if (!Array.isArray(a) || !Array.isArray(b) || a.length === 0 || b.length === 0) return [];
  const setB = new Set(b.map((s) => String(s).toLowerCase()));
  return a.filter((s) => setB.has(String(s).toLowerCase()));
}

function pairingScoreForView(focalNode, pairingNode, viewId) {
  if (!focalNode || !pairingNode) return 0;
  if (viewId === 'aroma') {
    return intersectLower(focalNode.flavorGraph?.tier1, pairingNode.flavorGraph?.tier1).length;
  }
  if (viewId === 'taste') {
    // Use focal.flavorGraph.tier2 first, fall back to taste-string tokens.
    const a = focalNode.flavorGraph?.tier2;
    const b = pairingNode.flavorGraph?.tier2;
    if (Array.isArray(a) && Array.isArray(b) && a.length > 0 && b.length > 0) {
      return intersectLower(a, b).length;
    }
    return intersectLower(tokenize(focalNode.taste), tokenize(pairingNode.taste)).length;
  }
  if (viewId === 'mouthfeel') {
    const a = [...(focalNode.flavorGraph?.tier3 || []), ...(focalNode.flavorGraph?.leaves || [])];
    const b = [...(pairingNode.flavorGraph?.tier3 || []), ...(pairingNode.flavorGraph?.leaves || [])];
    return intersectLower(a, b).length;
  }
  if (viewId === 'cuisine') {
    const a = Array.isArray(focalNode.cuisines) ? focalNode.cuisines : [];
    const b = Array.isArray(pairingNode.cuisines) ? pairingNode.cuisines : [];
    return intersectLower(a, b).length;
  }
  return 0;
}

function TierRow({ label, items, color }) {
  if (!Array.isArray(items) || items.length === 0) return null;
  return (
    <div className="flex items-center gap-1.5">
      <span className="text-[10px] uppercase tracking-[0.16em] w-[78px] text-right flex-shrink-0"
        style={{ color: CHALK_DIM, fontFamily: FONT, letterSpacing: '0.06em', textShadow: CHALK_TEXT_SHADOW }}
        data-testid={`alpha-details-row-${label.toLowerCase().replace(/\s+/g, '-')}`}>
        {label}
      </span>
      <div className="flex flex-wrap gap-1">
        {items.map((t, i) => (
          <span key={`${t}-${i}`} className="px-2 py-0 rounded-full text-[12px] border"
            style={{ color, borderColor: `${color}66`, backgroundColor: `${color}15`, fontFamily: FONT }}>
            {t}
          </span>
        ))}
      </div>
    </div>
  );
}

function AffinityCarousel({ focalName, focalNode, viewIdx, allPairings, revealed, onTapNode, onDoubleTapNode }) {
  const view = VIEWS[viewIdx];
  const pairings = useMemo(() => {
    if (!focalNode || !view) return [];
    return allPairings
      .map((p) => ({ ...p, score: pairingScoreForView(focalNode, p.node, view.id) }))
      .filter((p) => p.score > 0)
      .sort((a, b) => b.score - a.score || (b.strength || 0) - (a.strength || 0))
      .slice(0, RING_MAX);
  }, [allPairings, focalNode, view]);

  const tapTrackRef = useRef({});
  const handleTap = (name) => {
    const now = Date.now();
    const last = tapTrackRef.current[name] || 0;
    if (now - last < 350) {
      onDoubleTapNode?.(name);
      tapTrackRef.current[name] = 0;
    } else {
      onTapNode?.(name);
      tapTrackRef.current[name] = now;
    }
  };

  return (
    <div className="flex flex-col items-center w-full" data-testid="alpha-affinity-carousel"
      data-view-idx={viewIdx} data-view-id={view?.id || ''}>
      <span className="text-[11px] uppercase tracking-wider mb-1"
        style={{ color: CHALK_DIM, fontFamily: FONT, textShadow: CHALK_TEXT_SHADOW }}>
        {view?.sub}
      </span>
      <svg width="100%" viewBox={`0 0 ${RING_SIZE} ${RING_SIZE}`} preserveAspectRatio="xMidYMid meet"
        role="img" aria-label={`${view?.label} — ${pairings.length} pairings`}
        style={{ maxWidth: RING_SIZE }}
        data-testid="alpha-affinity-ring">
        <circle cx={RING_CENTER} cy={RING_CENTER} r={RING_RADIUS}
          fill="none" stroke={`${CHALK_BORDER_INNER}55`} strokeWidth={1} strokeDasharray="3 3" />
        {pairings.length === 0 && (
          <text x={RING_CENTER} y={RING_CENTER + 40} textAnchor="middle" fontSize={13}
            fill={CHALK_SUB} style={{ fontFamily: FONT }}>
            No pairings share this signal.
          </text>
        )}
        {pairings.map((p, i) => {
          const angle = (Math.PI * 2 * i) / Math.max(1, pairings.length) - Math.PI / 2;
          const x = RING_CENTER + RING_RADIUS * Math.cos(angle);
          const y = RING_CENTER + RING_RADIUS * Math.sin(angle);
          const fill = clusterColor(p.node);
          const isRevealed = revealed === p.name;
          return (
            <g key={p.name} style={{ cursor: 'pointer' }}
               onClick={() => handleTap(p.name)}
               onDoubleClick={() => onDoubleTapNode?.(p.name)}
               data-testid={`alpha-affinity-node-${p.name}`}>
              <line x1={RING_CENTER} y1={RING_CENTER} x2={x} y2={y} stroke={`${fill}44`} strokeWidth={1} />
              <circle cx={x} cy={y} r={isRevealed ? 9 : 6}
                fill={fill} stroke={isRevealed ? '#fff' : `${CHALK_BORDER_INNER}55`}
                strokeWidth={isRevealed ? 2 : 1} />
              {isRevealed && (
                <g>
                  <rect x={x - 56} y={y + 12} width={112} height={22} rx={4}
                    fill="#0a0a0a" stroke={CHALK_BORDER_INNER} strokeWidth={1} />
                  <text x={x} y={y + 26} textAnchor="middle" fontSize={12} fill={CHALK_CREAM}
                    style={{ fontFamily: FONT, textShadow: CHALK_TEXT_SHADOW }}>
                    {p.name}
                  </text>
                </g>
              )}
            </g>
          );
        })}
        <circle cx={RING_CENTER} cy={RING_CENTER} r={28}
          fill={clusterColor(focalNode)} stroke="#fff" strokeWidth={2} />
        <text x={RING_CENTER} y={RING_CENTER - 4} textAnchor="middle" fontSize={11}
          fontWeight={700} fill="#0a0a0a" style={{ fontFamily: FONT }}>
          {focalName}
        </text>
        <text x={RING_CENTER} y={RING_CENTER + 10} textAnchor="middle" fontSize={9}
          fill="#0a0a0a" style={{ fontFamily: FONT }}>
          {view?.label}
        </text>
      </svg>
    </div>
  );
}

export default function AlphaModeDetailsCard({
  focal,
  ctx,
  onIngredientPairings,
  onSelectPairing,
  onExit,
}) {
  const focalName = typeof focal === 'string' ? focal : focal?.name;
  const focalNode = useMemo(() => {
    if (!focalName || !ctx?.graph?.nodes?.get) return null;
    return ctx.graph.nodes.get(focalName) || { name: focalName };
  }, [focalName, ctx]);

  const allPairings = useMemo(() => {
    if (!focalName || !ctx?.graph?.edges) return [];
    try {
      const list = getNeighborsEnriched(focalName, ctx.graph.edges, ctx?.cuisineNeighborIndex || null);
      return list.slice(0, 60).map((p) => ({
        name: p.name,
        strength: typeof p.strength === 'number' ? p.strength : 0,
        node: ctx.graph.nodes.get?.(p.name) || { name: p.name },
      }));
    } catch { return []; }
  }, [focalName, ctx]);

  const [viewIdx, setViewIdx] = useState(0);
  const [revealed, setRevealed] = useState(null);

  // Reset reveal + view on focal change.
  useEffect(() => { setRevealed(null); setViewIdx(0); }, [focalName]);

  const goNext = useCallback(() => setViewIdx((i) => (i + 1) % VIEWS.length), []);
  const goPrev = useCallback(() => setViewIdx((i) => (i - 1 + VIEWS.length) % VIEWS.length), []);

  // Touch swipe + mouse drag for the carousel.
  const dragRef = useRef(null);
  const SWIPE_THRESHOLD = 50;
  const onTouchStart = (e) => {
    const t = e.touches?.[0];
    if (!t) return;
    dragRef.current = { x: t.clientX, y: t.clientY, kind: 'touch' };
  };
  const onTouchEnd = (e) => {
    const start = dragRef.current;
    dragRef.current = null;
    if (!start || start.kind !== 'touch') return;
    const t = (e.changedTouches?.[0]) || null;
    if (!t) return;
    const dx = t.clientX - start.x;
    if (Math.abs(dx) > SWIPE_THRESHOLD) (dx < 0 ? goNext : goPrev)();
  };
  const onMouseDown = (e) => {
    if (e.target?.closest?.('button')) return;
    if (e.target?.closest?.('[data-testid^="alpha-affinity-node-"]')) return;
    dragRef.current = { x: e.clientX, y: e.clientY, kind: 'mouse' };
  };
  const onMouseUp = (e) => {
    const start = dragRef.current;
    dragRef.current = null;
    if (!start || start.kind !== 'mouse') return;
    const dx = e.clientX - start.x;
    if (Math.abs(dx) > SWIPE_THRESHOLD) (dx < 0 ? goNext : goPrev)();
  };

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'ArrowLeft') { e.preventDefault(); goPrev(); }
      else if (e.key === 'ArrowRight') { e.preventDefault(); goNext(); }
      else if (e.key === 'Escape') { e.preventDefault(); onExit?.(); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [goNext, goPrev, onExit]);

  const tier1 = focalNode?.flavorGraph?.tier1;
  const tier2 = focalNode?.flavorGraph?.tier2;
  const tier3 = focalNode?.flavorGraph?.tier3;
  const leaves = focalNode?.flavorGraph?.leaves;
  const cuisines = Array.isArray(focalNode?.cuisines) ? focalNode.cuisines : [];
  const season = focalNode?.season;
  const seasonItems = (() => {
    if (Array.isArray(season)) return season;
    if (typeof season === 'string' && season.trim()) {
      return season.split(/[\s,/-]+/).filter(Boolean);
    }
    return [];
  })();
  const compounds = focalNode?.gnnCompounds?.top_compounds;
  const chemistryItems = Array.isArray(compounds)
    ? compounds.slice(0, 5).map((c) => (typeof c === 'string' ? c : c?.name)).filter(Boolean)
    : [];

  const view = VIEWS[viewIdx];

  return (
    <div className="fixed inset-0 z-[80] flex flex-col items-center px-4 py-4 overflow-y-auto"
      style={{ background: CHALK_BG }}
      data-testid="alpha-details-card"
      data-focal={focalName || ''}
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
      onMouseDown={onMouseDown}
      onMouseUp={onMouseUp}>
      <div className="w-full max-w-3xl flex items-center justify-between mb-3">
        <button type="button" onClick={() => onExit?.()}
          data-testid="alpha-details-back"
          className="px-3 py-2 rounded-lg text-sm"
          style={{ color: CHALK_CREAM, background: 'rgba(255,255,255,0.04)', border: `1px solid ${CHALK_BORDER_INNER}`, fontFamily: FONT, textShadow: CHALK_TEXT_SHADOW }}>
          ← Back
        </button>
        <span className="text-xs" style={{ color: CHALK_DIM, fontFamily: FONT, textShadow: CHALK_TEXT_SHADOW }}>
          α-mode · ingredient
        </span>
      </div>

      <div className="w-full max-w-3xl rounded-2xl px-5 py-4 mb-4"
        style={{ background: 'rgba(255,255,255,0.025)', border: `2px double ${CHALK_BORDER_OUTER}`, boxShadow: `inset 0 0 0 1px ${CHALK_BORDER_INNER}55, 0 8px 24px rgba(0,0,0,0.55)` }}>
        <h2 className="text-center mb-3"
          style={{ color: CHALK_CREAM, fontFamily: FONT, fontSize: 34, textShadow: CHALK_TEXT_SHADOW, letterSpacing: '0.01em' }}>
          {focalName}
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-[1.05fr_1.4fr] gap-4">
          <div className="flex flex-col gap-2">
            <TierRow label="Aroma"     items={tier1}          color="#86e7f5" />
            <TierRow label="Taste"     items={tier2}          color="#fbbf24" />
            <TierRow label="Mouthfeel" items={tier3}          color="#a78bfa" />
            <TierRow label="Leaves"    items={leaves}         color="#cbd5e1" />
            <TierRow label="Cuisines"  items={cuisines}       color="#fb923c" />
            <TierRow label="Season"    items={seasonItems}    color="#86efac" />
            {chemistryItems.length > 0 && (
              <TierRow label="Chemistry" items={chemistryItems} color="#fde68a" />
            )}
          </div>

          <div className="flex flex-col items-center">
            <div className="flex items-center justify-between w-full mb-1">
              <button type="button" onClick={goPrev}
                data-testid="alpha-carousel-prev"
                className="px-2 py-1 rounded-md"
                style={{ color: CHALK_CREAM, background: 'rgba(255,255,255,0.04)', border: `1px solid ${CHALK_BORDER_INNER}`, fontFamily: FONT, fontSize: 16, textShadow: CHALK_TEXT_SHADOW }}>
                ←
              </button>
              <div className="flex flex-col items-center">
                <span className="text-[15px]" style={{ color: CHALK_CREAM, fontFamily: FONT, textShadow: CHALK_TEXT_SHADOW }}>
                  {view?.label}
                </span>
                <span className="text-[10px] uppercase tracking-wider" style={{ color: CHALK_SUB, fontFamily: FONT }}>
                  {viewIdx + 1} / {VIEWS.length} · swipe to change
                </span>
              </div>
              <button type="button" onClick={goNext}
                data-testid="alpha-carousel-next"
                className="px-2 py-1 rounded-md"
                style={{ color: CHALK_CREAM, background: 'rgba(255,255,255,0.04)', border: `1px solid ${CHALK_BORDER_INNER}`, fontFamily: FONT, fontSize: 16, textShadow: CHALK_TEXT_SHADOW }}>
                →
              </button>
            </div>
            <AffinityCarousel
              focalName={focalName}
              focalNode={focalNode}
              viewIdx={viewIdx}
              allPairings={allPairings}
              revealed={revealed}
              onTapNode={(name) => setRevealed(name)}
              onDoubleTapNode={(name) => onSelectPairing?.(name)}
            />
            <span className="text-[11px] uppercase tracking-wider mt-1"
              style={{ color: CHALK_SUB, fontFamily: FONT, textShadow: CHALK_TEXT_SHADOW }}>
              Tap to name · double-tap to inspect
            </span>
          </div>
        </div>
      </div>

      <button type="button" onClick={() => onIngredientPairings?.()}
        data-testid="alpha-details-ingredient-pairings"
        className="w-full max-w-3xl py-3 rounded-lg"
        style={{
          color: '#bbf7d0',
          background: 'rgba(16, 78, 51, 0.55)',
          border: '1.5px solid rgba(110, 231, 183, 0.45)',
          fontFamily: FONT,
          fontSize: 20,
          textShadow: CHALK_TEXT_SHADOW,
        }}>
        Ingredient pairings →
      </button>
    </div>
  );
}

export { VIEWS as ALPHA_DETAILS_VIEWS };
