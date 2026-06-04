/**
 * AlphaModeDetailsCard — α-mode Screen 1 (B-version 2026-06-04).
 *
 * Per user spec, when the user lands in α-mode (post Guided Discovery
 * focal-pick), the FIRST screen is a rich details card showing:
 *   - Ingredient name
 *   - Tier info (Aroma / Taste / Mouthfeel / Leaves)
 *   - 4 flavor radars (Taste / Aroma / Cuisine / Season)
 *   - Affinity ring: focal in center, top pairings as dots around it
 *     · Single-tap a node → reveal the pairing's name (inline label)
 *     · Double-tap a node → fires onSelectPairing(name) so the parent
 *       can route to a per-pairing card view
 *   - "Ingredient pairings →" CTA → fires onIngredientPairings() so
 *     the parent can route to the existing PairingMode Tinder browser
 *
 * Chalkboard palette to match the rest of the B-version UI.
 */

import React, { useMemo, useState, useRef } from 'react';
import {
  getAxesFor,
  getColorMapFor,
} from '../data/guidedRadarAxes.js';
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

function valueForAxis(node, filterType, axisKey) {
  if (!node) return 0;
  const key = String(axisKey).toLowerCase();
  if (filterType === 'taste')   return tokenize(node.taste).includes(key) ? 1 : 0;
  if (filterType === 'season')  return tokenize(node.season).includes(key) ? 1 : 0;
  if (filterType === 'cuisine') {
    const list = Array.isArray(node?.cuisines) ? node.cuisines : [];
    return list.some((c) => String(c).toLowerCase() === key) ? 1 : 0;
  }
  if (filterType === 'aroma') {
    const tier1 = node?.flavorGraph?.tier1;
    if (Array.isArray(tier1) && tier1.some((t) => String(t).toLowerCase() === key)) return 1;
    const gnnMap = { fruity: 'odor_fruity', floral: 'odor_floral', green: 'odor_green', woody: 'odor_woody', creamy: 'odor_fatty' };
    const p = node?.gnnProbs?.[gnnMap[key]];
    return typeof p === 'number' ? Math.max(0, Math.min(1, p)) : 0;
  }
  return 0;
}

function axisAngle(i, n) {
  return (Math.PI * 2 * i) / n - Math.PI / 2;
}

function MiniRadar({ node, filterType, label, size = 130 }) {
  const axes = getAxesFor(filterType) || [];
  const colors = getColorMapFor(filterType) || {};
  const N = axes.length;
  if (N === 0) return null;
  const cx = size / 2;
  const cy = size / 2;
  const radius = size * 0.28;
  const labelOffset = size * 0.085;
  const values = axes.map((ax) => valueForAxis(node, filterType, ax));
  const polyPoints = values.map((v, i) => {
    const a = axisAngle(i, N);
    const r = v * radius;
    return `${cx + r * Math.cos(a)},${cy + r * Math.sin(a)}`;
  }).join(' ');
  const gridPts = (lvl) => axes.map((_, i) => {
    const a = axisAngle(i, N);
    const r = lvl * radius;
    return `${cx + r * Math.cos(a)},${cy + r * Math.sin(a)}`;
  }).join(' ');
  const fontSize = N > 8 ? 8 : 9;
  return (
    <div className="flex flex-col items-center gap-0.5" style={{ width: size + 12 }}>
      <svg width="100%" viewBox={`0 0 ${size} ${size}`} preserveAspectRatio="xMidYMid meet" role="img" aria-label={`${label} radar`}>
        {[0.33, 0.66, 1.0].map((lvl) => (
          <polygon key={lvl} points={gridPts(lvl)} fill="none" stroke={`${CHALK_BORDER_INNER}88`} strokeWidth={lvl === 1.0 ? 1 : 0.5} />
        ))}
        {axes.map((_, i) => {
          const a = axisAngle(i, N);
          return <line key={i} x1={cx} y1={cy} x2={cx + radius * Math.cos(a)} y2={cy + radius * Math.sin(a)} stroke={`${CHALK_BORDER_INNER}66`} strokeWidth={0.5} />;
        })}
        <polygon points={polyPoints} fill="rgba(134,231,245,0.30)" stroke="#86e7f5" strokeWidth={1.5} />
        {axes.map((axLbl, i) => {
          const a = axisAngle(i, N);
          const cosA = Math.cos(a);
          const sinA = Math.sin(a);
          const tx = cx + (radius + labelOffset) * cosA;
          const ty = cy + (radius + labelOffset) * sinA;
          const textAnchor = cosA > 0.15 ? 'start' : cosA < -0.15 ? 'end' : 'middle';
          const dominantBaseline = sinA > 0.55 ? 'hanging' : sinA < -0.55 ? 'auto' : 'middle';
          return (
            <text key={axLbl} x={tx} y={ty} textAnchor={textAnchor} dominantBaseline={dominantBaseline}
              fontSize={fontSize} fontWeight={600} fill={colors[axLbl] || CHALK_DIM}
              style={{ fontFamily: FONT, letterSpacing: '0.04em' }}
            >{axLbl}</text>
          );
        })}
      </svg>
      <span className="text-[10px] uppercase tracking-wider" style={{ color: CHALK_SUB, fontFamily: FONT, textShadow: CHALK_TEXT_SHADOW }}>
        {label}
      </span>
    </div>
  );
}

function TierRow({ label, items, color }) {
  if (!Array.isArray(items) || items.length === 0) return null;
  return (
    <div className="flex items-center gap-1.5">
      <span className="text-[10px] uppercase tracking-[0.16em] w-[68px] text-right flex-shrink-0"
        style={{ color: CHALK_DIM, fontFamily: FONT, letterSpacing: '0.06em', textShadow: CHALK_TEXT_SHADOW }}>
        {label}
      </span>
      <div className="flex flex-wrap gap-1">
        {items.map((t, i) => (
          <span key={`${t}-${i}`} className="px-2 py-0 rounded-full text-[11px] border"
            style={{ color, borderColor: `${color}66`, backgroundColor: `${color}15` }}>
            {t}
          </span>
        ))}
      </div>
    </div>
  );
}

const RING_SIZE = 280;
const RING_CENTER = RING_SIZE / 2;
const RING_RADIUS = RING_CENTER - 30;
const RING_MAX = 12;

function AffinityRing({ focalName, focalNode, pairings, onTapPairing, onDoubleTapPairing, revealed }) {
  const visible = pairings.slice(0, RING_MAX);
  const tapTrackRef = useRef({});
  const handleTap = (name) => {
    const now = Date.now();
    const last = tapTrackRef.current[name] || 0;
    if (now - last < 350) {
      onDoubleTapPairing?.(name);
      tapTrackRef.current[name] = 0;
    } else {
      onTapPairing?.(name);
      tapTrackRef.current[name] = now;
    }
  };
  return (
    <svg width="100%" viewBox={`0 0 ${RING_SIZE} ${RING_SIZE}`} preserveAspectRatio="xMidYMid meet"
      role="img" aria-label={`Affinity ring for ${focalName}`}
      data-testid="alpha-affinity-ring" style={{ maxWidth: RING_SIZE }}>
      <circle cx={RING_CENTER} cy={RING_CENTER} r={RING_RADIUS} fill="none" stroke={`${CHALK_BORDER_INNER}55`} strokeWidth={1} strokeDasharray="3 3" />
      {visible.map((p, i) => {
        const angle = (Math.PI * 2 * i) / visible.length - Math.PI / 2;
        const x = RING_CENTER + RING_RADIUS * Math.cos(angle);
        const y = RING_CENTER + RING_RADIUS * Math.sin(angle);
        const fill = clusterColor(p.node);
        const isRevealed = revealed === p.name;
        return (
          <g key={p.name} style={{ cursor: 'pointer' }}
             onClick={() => handleTap(p.name)}
             onDoubleClick={() => onDoubleTapPairing?.(p.name)}
             data-testid={`alpha-affinity-node-${p.name}`}>
            <line x1={RING_CENTER} y1={RING_CENTER} x2={x} y2={y} stroke={`${fill}44`} strokeWidth={1} />
            <circle cx={x} cy={y} r={isRevealed ? 9 : 6} fill={fill} stroke={isRevealed ? '#fff' : `${CHALK_BORDER_INNER}55`} strokeWidth={isRevealed ? 2 : 1} />
            {isRevealed && (
              <g>
                <rect x={x - 50} y={y + 12} width={100} height={22} rx={4}
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
      <circle cx={RING_CENTER} cy={RING_CENTER} r={14} fill={clusterColor(focalNode)} stroke="#fff" strokeWidth={2} />
      <text x={RING_CENTER} y={RING_CENTER + 30} textAnchor="middle" fontSize={14} fontWeight={700}
        fill={CHALK_CREAM} style={{ fontFamily: FONT, textShadow: CHALK_TEXT_SHADOW }}>
        {focalName}
      </text>
    </svg>
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

  const pairings = useMemo(() => {
    if (!focalName || !ctx?.graph?.edges) return [];
    try {
      const list = getNeighborsEnriched(focalName, ctx.graph.edges, ctx?.cuisineNeighborIndex || null);
      return list.slice(0, RING_MAX).map((p) => ({
        name: p.name,
        strength: typeof p.strength === 'number' ? p.strength : 0,
        node: ctx.graph.nodes.get?.(p.name) || { name: p.name },
      }));
    } catch { return []; }
  }, [focalName, ctx]);

  const [revealed, setRevealed] = useState(null);

  const tier1 = focalNode?.flavorGraph?.tier1;
  const tier2 = focalNode?.flavorGraph?.tier2;
  const tier3 = focalNode?.flavorGraph?.tier3;
  const leaves = focalNode?.flavorGraph?.leaves;

  return (
    <div className="fixed inset-0 z-[80] flex flex-col items-center px-4 py-4 overflow-y-auto"
      style={{ background: CHALK_BG }}
      data-testid="alpha-details-card"
      data-focal={focalName || ''}>
      <div className="w-full max-w-3xl flex items-center justify-between mb-3">
        <button type="button" onClick={() => onExit?.()}
          data-testid="alpha-details-back"
          className="px-3 py-2 rounded-lg text-sm"
          style={{ color: CHALK_CREAM, background: 'rgba(255,255,255,0.04)', border: `1px solid ${CHALK_BORDER_INNER}`, fontFamily: FONT, textShadow: CHALK_TEXT_SHADOW }}>
          ← Back
        </button>
        <span className="text-xs" style={{ color: CHALK_DIM, fontFamily: FONT, textShadow: CHALK_TEXT_SHADOW }}>
          α-mode · details
        </span>
      </div>

      <div className="w-full max-w-3xl rounded-2xl px-5 py-4 mb-4"
        style={{ background: 'rgba(255,255,255,0.025)', border: `2px double ${CHALK_BORDER_OUTER}`, boxShadow: `inset 0 0 0 1px ${CHALK_BORDER_INNER}55, 0 8px 24px rgba(0,0,0,0.55)` }}>
        <h2 className="text-center mb-3"
          style={{ color: CHALK_CREAM, fontFamily: FONT, fontSize: 34, textShadow: CHALK_TEXT_SHADOW, letterSpacing: '0.01em' }}>
          {focalName}
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-[1fr_1.2fr] gap-4">
          <div className="flex flex-col gap-2">
            <TierRow label="Aroma"     items={tier1}  color="#86e7f5" />
            <TierRow label="Taste"     items={tier2}  color="#fbbf24" />
            <TierRow label="Mouthfeel" items={tier3}  color="#a78bfa" />
            <TierRow label="Leaves"    items={leaves} color="#cbd5e1" />
            <div className="grid grid-cols-2 gap-2 mt-2">
              <MiniRadar node={focalNode} filterType="taste"   label="Taste" />
              <MiniRadar node={focalNode} filterType="aroma"   label="Aroma" />
              <MiniRadar node={focalNode} filterType="cuisine" label="Cuisine" />
              <MiniRadar node={focalNode} filterType="season"  label="Season" />
            </div>
          </div>

          <div className="flex flex-col items-center">
            <span className="text-[11px] uppercase tracking-wider mb-2"
              style={{ color: CHALK_DIM, fontFamily: FONT, textShadow: CHALK_TEXT_SHADOW }}>
              Top pairings — tap to name · double-tap to inspect
            </span>
            {focalNode && pairings.length > 0 ? (
              <AffinityRing
                focalName={focalName}
                focalNode={focalNode}
                pairings={pairings}
                revealed={revealed}
                onTapPairing={(name) => setRevealed(name)}
                onDoubleTapPairing={(name) => onSelectPairing?.(name)}
              />
            ) : (
              <span className="text-sm" style={{ color: CHALK_SUB, fontFamily: FONT }}>
                No pairings found for {focalName}.
              </span>
            )}
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
