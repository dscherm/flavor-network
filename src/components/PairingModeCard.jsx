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
 *   8. Flavor wheel (FlavorWheel: seventeen fixed wedges for this one ingredient's notes)
 */

import React from 'react';
import FlavorWheel from './FlavorWheel.jsx';
import { ingredientNoteBars, wheelAxisFor } from '../data/pairingCardData.js';
import { NO_CHART_LINE, axisColor } from '../data/recipeProfileAnalysis.js';

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

// ── Flavor wheel ───────────────────────────────────────────────────

function NotesWheel({ node, filterType, chosenAxis }) {
  const bars = ingredientNoteBars(node);
  const wedge = wheelAxisFor(filterType, chosenAxis);
  const leaning = chosenAxis ? String(chosenAxis).toLowerCase() : null;
  return (
    <div
      className="flex flex-col items-center gap-0.5 w-full"
      data-testid="pairing-card-chart"
      data-filter-type={filterType}
      data-chosen-axis={chosenAxis || ''}
      data-chosen-wedge={wedge || ''}
    >
      {bars.length === 0 ? (
        <p
          className="text-center text-[16px]"
          style={{ color: CHALK_SUB, fontFamily: FONT_HAND, textShadow: CHALK_TEXT_SHADOW }}
          data-testid="pairing-card-no-chart"
        >
          {NO_CHART_LINE}
        </p>
      ) : (
        <>
          <FlavorWheel bars={bars} testidPrefix="pairing-card" highlight={wedge} maxWidth={250} />
          <ol className="sr-only" data-testid="pairing-card-notes">
            {bars.map((b) => <li key={b.axis}>{b.label}</li>)}
          </ol>
        </>
      )}
      {leaning && (
        <div
          className="text-[16px] italic"
          style={{ color: CHALK_DIM, fontFamily: FONT_HAND, textShadow: CHALK_TEXT_SHADOW }}
        >
          Leaning <span style={{ color: wedge ? axisColor(wedge) : '#86e7f5' }}>{leaning}</span>
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
  fb = false,
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
      {fb && (
        <div
          className="text-[15px] tracking-wide"
          style={{ color: CHALK_CREAM, fontFamily: FONT_HAND, textShadow: CHALK_TEXT_SHADOW }}
          data-testid="pairing-card-fb"
          title="Listed as a pairing in The Flavor Bible"
        >
          📖 in The Flavor Bible
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
        <NotesWheel
          node={node}
          filterType={filterType}
          chosenAxis={chosenAxis}
        />
      </div>
    </div>
  );
}

export { clusterColor };
