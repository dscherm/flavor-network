/**
 * PairingModeCard — chalkboard-menu styled card for the Tinder-stack
 * pairing browser. (B-version P3 revision per user feedback.)
 *
 * Aesthetic: dark slate-green chalkboard background, double chalk-rail
 * border, cream-chalk text, Caveat handwriting font for the ingredient
 * name, tiny chalk-caps section labels. Keeps the existing flavor
 * palette for axis colors + tier chips so the chalkboard feels lit by
 * the same neon vocabulary used elsewhere in the app.
 *
 * Fixed dimensions — every card in the stack is identical:
 *   width  = min(26rem, 92vw)
 *   height = min(620px, calc(100dvh - 180px))
 *
 * No internal scrolling — content is packed to fit the fixed budget.
 * If the viewport shrinks below the budget, the height clamp kicks in.
 *
 * Sections, top → bottom (all centered):
 *   1. Hero disc (cluster-color, ingredient initial)
 *   2. Ingredient name (Caveat 28px cream)
 *   3. Pair-strength readout
 *   4. Pairing analysis block (1-2 sentences) — hidden if null
 *   5. Stylized "chalkboard menu" table — Pairings / Cuisines / Season
 *   6. Tier chip rows — Aroma / Taste / Mouthfeel / Leaves
 *   7. Shared aroma compound chips — hidden if empty
 *   8. Polygon profile radar with colored axis labels
 */

import React from 'react';
import {
  getAxesFor,
  getColorMapFor,
} from '../data/guidedRadarAxes.js';

const FONT_HAND = "Caveat, cursive";

// ── Chalkboard palette ─────────────────────────────────────────────
// Near-black slate with the chalk-dust radial wash that gives real
// chalkboards their lit-from-center look. Cream-chalk text with a soft
// shadow for the slightly-smudged feel.
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

// ── Card dimensions ────────────────────────────────────────────────
const CARD_WIDTH_CLASS = 'w-[min(26rem,92vw)]';
const CARD_HEIGHT_CLASS = 'h-[min(620px,calc(100dvh-180px))]';

// ── Cluster colors (hero disc) ─────────────────────────────────────
const CLUSTER_COLORS = [
  '#22c55e', '#f59e0b', '#ec4899', '#06b6d4', '#a855f7',
  '#84cc16', '#fb7185', '#0ea5e9', '#facc15', '#14b8a6',
  '#fde68a', '#94a3b8',
];
function clusterColor(node) {
  const cid = typeof node?.cluster === 'number' ? node.cluster : 0;
  return CLUSTER_COLORS[cid % CLUSTER_COLORS.length];
}

// ── Subcomponents ──────────────────────────────────────────────────

function HeroDisc({ node }) {
  const ch = (node?.name || '?').trim().charAt(0).toUpperCase();
  const fill = clusterColor(node);
  return (
    <div
      className="flex items-center justify-center rounded-full"
      style={{
        width: 52,
        height: 52,
        backgroundColor: fill,
        boxShadow: `0 0 14px ${fill}66`,
        color: '#0a0a0f',
        fontSize: 26,
        fontWeight: 700,
        fontFamily: FONT_HAND,
      }}
      aria-hidden="true"
    >
      {ch}
    </div>
  );
}

function MenuTable({ rows }) {
  const visible = rows.filter((r) => r.value);
  if (visible.length === 0) return null;
  return (
    <div
      className="w-full grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 px-3 py-1.5 border-t border-b"
      style={{ borderColor: CHALK_BORDER_INNER + '55' }}
      data-testid="pairing-card-table"
    >
      {visible.map((r) => (
        <React.Fragment key={r.label}>
          <span
            className="text-[10px] uppercase tracking-[0.18em] self-center text-right"
            style={{ color: CHALK_DIM, fontFamily: FONT_HAND, letterSpacing: '0.06em', textShadow: CHALK_TEXT_SHADOW }}
            data-testid={`pairing-card-row-${r.label.toLowerCase()}`}
          >
            {r.label}
          </span>
          <span
            className="text-[14px] self-center"
            style={{ color: r.valueColor || CHALK_CREAM, fontFamily: FONT_HAND, lineHeight: 1.1, textShadow: CHALK_TEXT_SHADOW }}
          >
            {r.value}
          </span>
        </React.Fragment>
      ))}
    </div>
  );
}

function ChipStrip({ label, items, color }) {
  if (!Array.isArray(items) || items.length === 0) return null;
  return (
    <div
      className="flex items-center gap-1.5 w-full"
      data-testid={`pairing-card-${label.toLowerCase()}`}
    >
      <span
        className="text-[10px] uppercase tracking-[0.16em] flex-shrink-0 w-[68px] text-right"
        style={{ color: CHALK_DIM, fontFamily: FONT_HAND, letterSpacing: '0.06em', textShadow: CHALK_TEXT_SHADOW }}
      >
        {label}
      </span>
      <div className="flex items-center justify-start gap-1 flex-wrap flex-1">
        {items.map((t, i) => (
          <span
            key={`${t}-${i}`}
            className="px-2 py-0 rounded-full text-[11px] border"
            style={{
              color,
              borderColor: `${color}66`,
              backgroundColor: `${color}15`,
            }}
          >
            {t}
          </span>
        ))}
      </div>
    </div>
  );
}

function CompoundList({ compounds }) {
  if (!Array.isArray(compounds) || compounds.length === 0) return null;
  const names = compounds
    .map((c) => (typeof c === 'string' ? c : c?.name || c?.compound || null))
    .filter(Boolean)
    .slice(0, 5);
  if (names.length === 0) return null;
  const overflow = compounds.length - names.length;
  return (
    <div
      className="w-full flex flex-col items-center gap-0.5"
      data-testid="pairing-card-compounds"
      data-count={compounds.length}
    >
      <span
        className="text-[10px] uppercase tracking-[0.16em]"
        style={{ color: '#86efac', fontFamily: FONT_HAND, letterSpacing: '0.06em', textShadow: CHALK_TEXT_SHADOW }}
      >
        Shared aroma compounds ({compounds.length})
      </span>
      <div className="flex flex-wrap justify-center gap-1">
        {names.map((n, i) => (
          <span
            key={`${n}-${i}`}
            className="px-1.5 py-0 rounded text-[10px]"
            style={{
              color: '#bbf7d0',
              backgroundColor: 'rgba(16, 78, 51, 0.45)',
              border: '1px solid rgba(110, 231, 183, 0.30)',
            }}
          >
            {n}
          </span>
        ))}
        {overflow > 0 && (
          <span
            className="px-1.5 py-0 rounded text-[10px]"
            style={{ color: CHALK_SUB, backgroundColor: 'rgba(255,255,255,0.04)', border: `1px solid ${CHALK_BORDER_INNER}40` }}
          >
            +{overflow}
          </span>
        )}
      </div>
    </div>
  );
}

function AnalysisBlock({ analysis }) {
  if (!analysis || typeof analysis !== 'string' || !analysis.trim()) return null;
  return (
    <div
      className="w-full text-center px-2"
      data-testid="pairing-card-analysis"
    >
      <p
        className="text-[19px] leading-snug"
        style={{ color: CHALK_CREAM, fontFamily: FONT_HAND, textShadow: CHALK_TEXT_SHADOW }}
      >
        {analysis}
      </p>
    </div>
  );
}

// ── Polygon radar ──────────────────────────────────────────────────

function axisAngle(i, n) {
  return (Math.PI * 2 * i) / n - Math.PI / 2;
}

function valueForAxis(node, filterType, axisKey) {
  if (!node || axisKey == null) return 0;
  const key = String(axisKey).toLowerCase();
  if (filterType === 'taste') {
    const tokens = (node.taste || '').toLowerCase().split(/[\s,/]+/).filter(Boolean);
    return tokens.includes(key) ? 1 : 0;
  }
  if (filterType === 'season') {
    const tokens = (node.season || '').toLowerCase().split(/[\s,/-]+/).filter(Boolean);
    return tokens.includes(key) ? 1 : 0;
  }
  if (filterType === 'aroma') {
    const tier1 = node?.flavorGraph?.tier1;
    if (Array.isArray(tier1) && tier1.some((t) => String(t).toLowerCase() === key)) return 1;
    const gnnMap = {
      fruity: 'odor_fruity',
      floral: 'odor_floral',
      green: 'odor_green',
      woody: 'odor_woody',
      creamy: 'odor_fatty',
    };
    const col = gnnMap[key];
    if (col && node?.gnnProbs?.[col] != null) {
      return Math.max(0, Math.min(1, node.gnnProbs[col]));
    }
    return 0;
  }
  if (filterType === 'cuisine') {
    const list = Array.isArray(node?.cuisines) ? node.cuisines : [];
    return list.some((c) => String(c).toLowerCase() === key) ? 1 : 0;
  }
  if (filterType === 'family') {
    const cat = String(node?.category || '').toLowerCase();
    return cat === key ? 1 : 0;
  }
  return 0;
}

function MiniRadar({ node, filterType, chosenAxis, size = 200 }) {
  const axes = getAxesFor(filterType) || [];
  const colorMap = getColorMapFor(filterType) || {};
  const N = axes.length;
  if (N === 0) return null;

  // Internal viewBox stays at the nominal `size`; SVG is rendered at
  // 100% width so the parent container drives the actual pixels. Card
  // gets a dynamically-sized radar based on how much vertical room is
  // left after the chip rows + analysis + compounds.
  // B-version (2026-06-03): label cutoff fix — radius shrunk + label
  // offset bumped so long aroma/cuisine names ('Fermented', 'Middle
  // Eastern', 'East Asian') no longer clip the edge. Dynamic
  // textAnchor (below) puts the anchor at the inner edge so the rest
  // of the word grows outward, never past the SVG bounds.
  const cx = size / 2;
  const cy = size / 2;
  const radius = size * 0.28;
  const labelOffset = size * 0.075;
  const chosenIdx = chosenAxis != null ? axes.indexOf(chosenAxis) : -1;
  const gridLevels = [0.33, 0.66, 1.0];

  const values = axes.map((ax, i) => {
    let v = valueForAxis(node, filterType, ax);
    if (i === chosenIdx) v = Math.max(v, 0.85);
    return v;
  });

  const polygonPoints = values.map((v, i) => {
    const a = axisAngle(i, N);
    const r = v * radius;
    return `${cx + r * Math.cos(a)},${cy + r * Math.sin(a)}`;
  }).join(' ');

  const gridPoints = (level) => axes.map((_, i) => {
    const a = axisAngle(i, N);
    const r = level * radius;
    return `${cx + r * Math.cos(a)},${cy + r * Math.sin(a)}`;
  }).join(' ');

  const dotMarkers = values
    .map((v, i) => ({ v, i }))
    .filter((d) => d.v >= 0.5);

  // Label font sizes bumped per user 2026-06-03 (+2-3px).
  const fontSize = N > 8 ? 11 : 13;

  return (
    <div className="flex flex-col items-center gap-0.5 w-full" style={{ maxWidth: size + 40 }}>
      <svg
        width="100%"
        viewBox={`0 0 ${size} ${size}`}
        preserveAspectRatio="xMidYMid meet"
        style={{ display: 'block', height: 'auto' }}
        role="img"
        aria-label={`${filterType} radar for ${node.name}`}
        data-testid="pairing-card-radar"
        data-filter-type={filterType}
        data-chosen-axis={chosenAxis || ''}
      >
        {gridLevels.map((level) => (
          <polygon
            key={level}
            points={gridPoints(level)}
            fill="none"
            stroke={CHALK_BORDER_INNER + '88'}
            strokeWidth={level === 1.0 ? 1 : 0.5}
          />
        ))}
        {axes.map((_, i) => {
          const a = axisAngle(i, N);
          return (
            <line
              key={i}
              x1={cx}
              y1={cy}
              x2={cx + radius * Math.cos(a)}
              y2={cy + radius * Math.sin(a)}
              stroke={CHALK_BORDER_INNER + '66'}
              strokeWidth={0.5}
            />
          );
        })}
        {/* Per-axis cones: every axis where the node's value >= 0.5
            gets a faint wedge in that axis's color. Cones make the
            ingredient's category memberships legible at a glance.
            The chosen axis gets a stronger wedge on top. */}
        {values.map((v, i) => {
          if (v < 0.5) return null;
          const half = Math.PI / N;
          const a = axisAngle(i, N);
          const x0 = cx + radius * Math.cos(a - half);
          const y0 = cy + radius * Math.sin(a - half);
          const x1 = cx + radius * Math.cos(a + half);
          const y1 = cy + radius * Math.sin(a + half);
          const d = `M ${cx} ${cy} L ${x0} ${y0} A ${radius} ${radius} 0 0 1 ${x1} ${y1} Z`;
          return (
            <path
              key={`cone-${i}`}
              d={d}
              fill={colorMap[axes[i]] || '#22d3ee'}
              fillOpacity={0.18}
              data-testid={`pairing-card-cone-${axes[i]}`}
            />
          );
        })}
        {chosenIdx >= 0 && (
          <path
            d={(() => {
              const half = Math.PI / N;
              const a = axisAngle(chosenIdx, N);
              const x0 = cx + radius * Math.cos(a - half);
              const y0 = cy + radius * Math.sin(a - half);
              const x1 = cx + radius * Math.cos(a + half);
              const y1 = cy + radius * Math.sin(a + half);
              return `M ${cx} ${cy} L ${x0} ${y0} A ${radius} ${radius} 0 0 1 ${x1} ${y1} Z`;
            })()}
            fill={colorMap[chosenAxis] || '#22d3ee'}
            fillOpacity={0.30}
            stroke={colorMap[chosenAxis] || '#22d3ee'}
            strokeWidth={1}
          />
        )}
        <polygon
          points={polygonPoints}
          fill="rgba(34,211,238,0.28)"
          stroke="#86e7f5"
          strokeWidth={1.5}
          data-testid="pairing-card-radar-polygon"
        />
        {dotMarkers.map(({ v, i }) => {
          const a = axisAngle(i, N);
          const r = v * radius;
          return (
            <circle
              key={`dot-${i}`}
              cx={cx + r * Math.cos(a)}
              cy={cy + r * Math.sin(a)}
              r={3}
              fill={colorMap[axes[i]] || '#fb923c'}
              stroke="#0a0a0f"
              strokeWidth={1}
            />
          );
        })}
        {axes.map((label, i) => {
          const a = axisAngle(i, N);
          const cosA = Math.cos(a);
          const sinA = Math.sin(a);
          const tx = cx + (radius + labelOffset) * cosA;
          const ty = cy + (radius + labelOffset) * sinA;
          const isChosen = i === chosenIdx;
          // Dynamic textAnchor: labels grow outward away from the
          // center so long words never clip the SVG bounds. Left
          // half (cos < -0.15) anchors 'end', right half (cos > 0.15)
          // anchors 'start', vertical-axis labels (top/bottom) stay
          // 'middle'.
          const textAnchor = cosA > 0.15 ? 'start' : cosA < -0.15 ? 'end' : 'middle';
          const dominantBaseline = sinA > 0.55 ? 'hanging' : sinA < -0.55 ? 'auto' : 'middle';
          return (
            <text
              key={label}
              x={tx}
              y={ty}
              textAnchor={textAnchor}
              dominantBaseline={dominantBaseline}
              fontSize={fontSize}
              fontWeight={isChosen ? 700 : 600}
              fill={colorMap[label] || CHALK_DIM}
              style={{ fontFamily: FONT_HAND, letterSpacing: '0.04em' }}
            >
              {label}
            </text>
          );
        })}
      </svg>
      {chosenAxis && (
        <div
          className="text-[16px] italic"
          style={{ color: CHALK_DIM, fontFamily: FONT_HAND, textShadow: CHALK_TEXT_SHADOW }}
        >
          Leaning <span style={{ color: colorMap[chosenAxis] || '#86e7f5' }}>{String(chosenAxis).toLowerCase()}</span>
        </div>
      )}
    </div>
  );
}

// ── Main card ──────────────────────────────────────────────────────

export default function PairingModeCard({
  node,
  filterType = 'taste',
  chosenAxis = null,
  strength = null,
  sharedCompounds = null,
  analysis = null,
}) {
  if (!node || !node.name) {
    return (
      <div
        className={`${CARD_WIDTH_CLASS} ${CARD_HEIGHT_CLASS} rounded-2xl flex items-center justify-center`}
        style={{ background: CHALK_BG, border: `2px double ${CHALK_BORDER_OUTER}` }}
        data-testid="pairing-card-empty"
      >
        <span style={{ color: CHALK_SUB, fontFamily: FONT_HAND }} className="text-base">No pairing</span>
      </div>
    );
  }

  const tier1 = node?.flavorGraph?.tier1;
  const tier2 = node?.flavorGraph?.tier2;
  const tier3 = node?.flavorGraph?.tier3;
  const leaves = node?.flavorGraph?.leaves;
  const hasChemistry = Array.isArray(sharedCompounds) && sharedCompounds.length > 0;

  const tableRows = [
    typeof node.pairingCount === 'number' && node.pairingCount > 0 ? {
      label: 'Pairings',
      value: node.pairingCount.toLocaleString(),
      valueColor: '#86e7f5',
    } : null,
    Array.isArray(node.cuisines) && node.cuisines.length > 0 ? {
      label: 'Cuisines',
      value: node.cuisines.slice(0, 3).join(' · '),
    } : null,
    typeof node.season === 'string' && node.season ? {
      label: 'Season',
      value: node.season,
    } : null,
  ].filter(Boolean);

  return (
    <div
      className={`${CARD_WIDTH_CLASS} ${CARD_HEIGHT_CLASS} rounded-2xl overflow-hidden flex flex-col items-center px-4 py-3 gap-2`}
      style={{
        background: CHALK_BG,
        border: `2px double ${CHALK_BORDER_OUTER}`,
        boxShadow: `inset 0 0 0 1px ${CHALK_BORDER_INNER}55, 0 8px 24px rgba(0,0,0,0.55)`,
      }}
      data-testid="pairing-card"
      data-ingredient={node.name}
      data-has-chemistry={hasChemistry ? 'yes' : 'no'}
      data-has-analysis={analysis ? 'yes' : 'no'}
    >
      <HeroDisc node={node} />
      <h3
        className="text-center leading-none"
        style={{
          color: CHALK_CREAM,
          fontFamily: FONT_HAND,
          fontSize: 30,
          textShadow: CHALK_TEXT_SHADOW,
          letterSpacing: '0.01em',
        }}
        data-testid="pairing-card-name"
      >
        {node.name}
      </h3>
      {typeof strength === 'number' && strength > 0 && (
        <div
          className="text-[16px] tracking-widest uppercase"
          style={{ color: '#86e7f5', fontFamily: FONT_HAND, textShadow: CHALK_TEXT_SHADOW }}
        >
          pair strength {strength.toFixed(2)}
        </div>
      )}
      <AnalysisBlock analysis={analysis} />
      <MenuTable rows={tableRows} />
      <div className="w-full flex flex-col gap-0.5">
        <ChipStrip label="Aroma" items={tier1} color="#86e7f5" />
        <ChipStrip label="Taste" items={tier2} color="#fbbf24" />
        <ChipStrip label="Mouthfeel" items={tier3} color="#a78bfa" />
        <ChipStrip label="Leaves" items={leaves} color="#cbd5e1" />
      </div>
      <CompoundList compounds={sharedCompounds} />
      <div className="mt-auto">
        <MiniRadar
          node={node}
          filterType={filterType}
          chosenAxis={chosenAxis}
        />
      </div>
    </div>
  );
}

export { clusterColor };
