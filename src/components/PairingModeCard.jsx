/**
 * PairingModeCard: the chalkboard card for one ingredient (the Pairing Lab peek, the ingredient card overlay,
 * the suggestion decks and the Flavor Profiles card).
 *
 * One 1 px Rail edge on Slate ground (LOOK-9: no double line, inset or drop shadow), the ingredient's own chalk
 * drawing in place of a coloured disc, and plain words for the notes: no pills.
 *
 * Fixed dimensions, so every card in a stack is identical:
 *   width  = min(26rem, 92vw)
 *   height = min(620px, calc(100dvh - 180px))
 *
 * Sections, top to bottom (all centered): drawing, name, pair strength, analysis (hidden if null), a small table
 * (Pairings / Cuisines / Season), one line each for Aroma / Taste / Mouthfeel / More notes, the shared aroma
 * compounds as one comma line (hidden if empty), and the flavor wheel (seventeen fixed wedges for this one
 * ingredient's notes).
 */

import React from 'react';
import FlavorWheel from './FlavorWheel.jsx';
import { IngredientArt } from './chalkArt.jsx';
import { ingredientNoteBars, wheelAxisFor } from '../data/pairingCardData.js';
import { NO_CHART_LINE, axisColor } from '../data/recipeProfileAnalysis.js';
import { HAND, TEXT, CHALK_CREAM, CHALK_DIM, CHALK_SUB, CHALK_RAIL, CHALK_SHADOW } from '../data/chalkTheme.js';

const CHALK_TEXT_SHADOW = CHALK_SHADOW;

// ── Card dimensions ────────────────────────────────────────────────
const CARD_WIDTH_CLASS = 'w-[min(26rem,92vw)]';
const CARD_HEIGHT_CLASS = 'h-[min(620px,calc(100dvh-180px))]';

// ── Subcomponents ──────────────────────────────────────────────────

function MenuTable({ rows }) {
  const visible = rows.filter((r) => r.value);
  if (visible.length === 0) return null;
  return (
    <div
      className="w-full grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 px-3 py-1.5"
      data-testid="pairing-card-table"
    >
      {visible.map((r) => (
        <React.Fragment key={r.label}>
          <span
            className="text-[13px] self-center text-right"
            style={{ color: CHALK_DIM, fontFamily: TEXT }}
            data-testid={`pairing-card-row-${r.label.toLowerCase()}`}
          >
            {r.label}
          </span>
          <span
            className="text-[15px] self-center"
            style={{ color: CHALK_CREAM, fontFamily: TEXT, lineHeight: 1.1 }}
          >
            {r.value}
          </span>
        </React.Fragment>
      ))}
    </div>
  );
}

function ChipStrip({ label, items, id = label.toLowerCase() }) {
  if (!Array.isArray(items) || items.length === 0) return null;
  return (
    <div
      className="flex items-baseline gap-1.5 w-full"
      data-testid={`pairing-card-${id}`}
    >
      <span
        className="text-[13px] flex-shrink-0 w-[72px] text-right"
        style={{ color: CHALK_DIM, fontFamily: TEXT }}
      >
        {label}
      </span>
      <span className="flex-1 text-[15px]" style={{ color: CHALK_CREAM, fontFamily: TEXT, lineHeight: 1.25 }}>
        {items.join(', ')}
      </span>
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
      className="w-full flex flex-col items-center gap-0.5 text-center"
      data-testid="pairing-card-compounds"
      data-count={compounds.length}
    >
      <span className="text-[13px]" style={{ color: CHALK_DIM, fontFamily: TEXT }}>
        Shared aroma compounds ({compounds.length})
      </span>
      <span className="text-[13px]" style={{ color: CHALK_SUB, fontFamily: TEXT, lineHeight: 1.3 }}>
        {names.join(', ')}{overflow > 0 ? ` and ${overflow} more` : ''}
      </span>
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
        style={{ color: CHALK_CREAM, fontFamily: TEXT, textShadow: CHALK_TEXT_SHADOW }}
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
          style={{ color: CHALK_SUB, fontFamily: TEXT, textShadow: CHALK_TEXT_SHADOW }}
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
          style={{ color: CHALK_DIM, fontFamily: TEXT, textShadow: CHALK_TEXT_SHADOW }}
        >
          Leaning <span style={{ color: wedge ? axisColor(wedge) : CHALK_CREAM }}>{leaning}</span>
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
        className={`chalk-board ${CARD_WIDTH_CLASS} ${CARD_HEIGHT_CLASS} rounded-2xl flex items-center justify-center`}
        style={{ border: `1px solid ${CHALK_RAIL}` }}
        data-testid="pairing-card-empty"
      >
        <span style={{ color: CHALK_SUB, fontFamily: TEXT }} className="text-base">No pairing</span>
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
    } : null,
    Array.isArray(node.cuisines) && node.cuisines.length > 0 ? {
      label: 'Cuisines',
      value: node.cuisines.slice(0, 3).join(', '),
    } : null,
    typeof node.season === 'string' && node.season ? {
      label: 'Season',
      value: node.season,
    } : null,
  ].filter(Boolean);

  return (
    <div
      className={`chalk-board ${CARD_WIDTH_CLASS} ${CARD_HEIGHT_CLASS} rounded-2xl overflow-hidden flex flex-col items-center px-4 py-3 gap-2`}
      style={{ border: `1px solid ${CHALK_RAIL}` }}
      data-testid="pairing-card"
      data-ingredient={node.name}
      data-has-chemistry={hasChemistry ? 'yes' : 'no'}
      data-has-analysis={analysis ? 'yes' : 'no'}
    >
      <IngredientArt category={node.category} name={node.name} size={52} ink={CHALK_CREAM} />
      <h3
        className="text-center leading-none"
        style={{
          color: CHALK_CREAM,
          fontFamily: HAND,
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
          className="text-[13px]"
          style={{ color: CHALK_DIM, fontFamily: TEXT, textShadow: CHALK_TEXT_SHADOW }}
        >
          Pair strength {strength.toFixed(2)}
        </div>
      )}
      {fb && (
        <div
          className="text-[15px] tracking-wide"
          style={{ color: CHALK_CREAM, fontFamily: TEXT, textShadow: CHALK_TEXT_SHADOW }}
          data-testid="pairing-card-fb"
          title="Listed as a pairing in The Flavor Bible"
        >
          In The Flavor Bible
        </div>
      )}
      <AnalysisBlock analysis={analysis} />
      <MenuTable rows={tableRows} />
      <div className="w-full flex flex-col gap-0.5">
        <ChipStrip label="Aroma" items={tier1} />
        <ChipStrip label="Taste" items={tier2} />
        <ChipStrip label="Mouthfeel" items={tier3} />
        <ChipStrip label="More notes" id="leaves" items={leaves} />
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

