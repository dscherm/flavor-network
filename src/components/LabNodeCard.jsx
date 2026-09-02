/**
 * LabNodeCard — full-screen "card mode" for a Cocktail Lab or Sauce Lab
 * node, in the same charcoal/chalk aesthetic as AlphaModeDetailsCard.
 *
 * Opens when a sauce/cocktail node is tapped. Shows, top→bottom:
 *   - name (big, chalk-outlined)
 *   - cluster / family chip (color-coded by family)
 *   - prep details row (glass / build / ice / cuisine …)
 *   - ingredient list
 *   - preparation text
 *   - "{Cocktails|Sauces} like this" chips (within-family cousins)
 *   - "Bridges other families" chips (cross-family cousins)
 *   - optional "Pairs with" chips
 *
 * Every section hides itself when it has no data, so the same component
 * serves both labs (cocktails carry glass/build/bridges; sauces carry
 * cuisine/technique/pairsWith).
 */

import React, { useEffect } from 'react';
import { FONT, CHALK_CREAM, CHALK_DIM, CHALK_SUB, chalkSurfaceStyle } from '../data/chalkTheme.js';

const CHALK_BORDER_OUTER = '#4a4a4a';
const CHALK_BORDER_INNER = '#6a6a6a';
const CHALK_TEXT_SHADOW = '0 0 1px rgba(245,239,222,0.55), 0 0 3px rgba(245,239,222,0.22)';
const TEXT_OUTLINE = { WebkitTextStroke: '0.6px rgba(8,8,8,0.62)', paintOrder: 'stroke fill' };

const FS_NAME = 'clamp(34px, 6vh, 60px)';
const FS_SECTION = 'clamp(13px, 1.7vh, 18px)';
// Ingredients + preparation are the heart of the card — set noticeably larger
// than the cousin/bridge chips (FS_CHIP) so they read first.
const FS_BODY = 'clamp(19px, 2.7vh, 27px)';
const FS_CHIP = 'clamp(14px, 2vh, 20px)';
const FS_MEASURE = 'clamp(15px, 1.9vh, 19px)';
const FS_SUB = 'clamp(11px, 1.5vh, 15px)';

// Split a free-text preparation into steps. Priority: explicit line breaks →
// pre-existing numbered markers ("1. … 2. …") → sentence boundaries. Any
// leading enumerator is stripped so our own numbering never doubles up
// (recipes that already carry numbers won't render "1. 1. …"). Returns ≥2
// entries only when the text really is multi-step.
function splitPrepSteps(text) {
  const t = String(text).trim();
  let parts = t.split(/\n+/).map((s) => s.trim()).filter(Boolean);
  if (parts.length <= 1 && /(?:^|\s)\d+[.)]\s+/.test(t)) {
    parts = t.split(/\s*\d+[.)]\s+/).map((s) => s.trim()).filter(Boolean);
  }
  if (parts.length <= 1) {
    parts = t.split(/(?<=[.!?])\s+(?=[A-Z0-9])/).map((s) => s.trim()).filter(Boolean);
  }
  return parts.map((s) => s.replace(/^\d+[.)]\s*/, '').trim()).filter(Boolean);
}

function SectionLabel({ children, color = CHALK_DIM }) {
  return (
    <div className="uppercase tracking-[0.16em] mb-1.5 mt-3"
      style={{ color, fontFamily: FONT, fontSize: FS_SECTION, textShadow: CHALK_TEXT_SHADOW }}>
      {children}
    </div>
  );
}

// A row of clickable cousin chips (like-this / bridges / pairs-with).
function ChipRow({ items, onSelect, showFamily = false, testid }) {
  if (!Array.isArray(items) || items.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-2" data-testid={testid}>
      {items.map((it, i) => {
        const name = typeof it === 'string' ? it : it.name;
        const color = (typeof it === 'object' && it.color) || '#9a8f7a';
        const fam = showFamily && typeof it === 'object' ? it.family_name : null;
        return (
          <button
            key={`${name}-${i}`}
            type="button"
            onClick={onSelect ? () => onSelect(name) : undefined}
            data-testid={`labcard-chip-${String(name).toLowerCase().replace(/\s+/g, '-')}`}
            className="px-3 py-1 rounded-full border transition-all flex items-center gap-2"
            style={{
              color: CHALK_CREAM, background: `${color}1f`, borderColor: `${color}77`,
              fontFamily: FONT, fontSize: FS_CHIP, cursor: onSelect ? 'pointer' : 'default',
              ...TEXT_OUTLINE,
            }}
          >
            <span className="inline-block rounded-full" style={{ width: 9, height: 9, background: color }} />
            {name}{fam ? <span style={{ color: CHALK_SUB }}> · {fam}</span> : null}
          </button>
        );
      })}
    </div>
  );
}

export default function LabNodeCard({
  kind = 'cocktail',
  name,
  clusterName,
  clusterColor = '#9a8f7a',
  clusterTag,
  details = [],          // [{ label, value }]
  ingredients = [],      // string[] | [{ name, measure }]
  prep,                  // string
  likeThis = [],         // [{ name, similarity, color }]
  bridges = [],          // [{ name, family_name, color }]
  pairsWith = [],        // string[]
  onSelect,
  onClose,
}) {
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') { e.preventDefault(); onClose?.(); } };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const cleanDetails = (details || []).filter((d) => d && d.value);
  const ingList = (ingredients || []).map((ing) =>
    typeof ing === 'string' ? { name: ing, measure: '' } : { name: ing?.name, measure: ing?.measure || '' },
  ).filter((ing) => ing.name);
  const likeThisLabel = kind === 'sauce' ? 'Sauces like this' : 'Cocktails like this';

  return (
    <div className="fixed inset-x-0 top-0 z-[80] flex flex-col items-center justify-center px-4 py-3"
      // v1.0.2: bottom stops above the fixed tab bar — inset-0 let the bar cover the card's last ~57px.
      style={{ ...chalkSurfaceStyle(), bottom: 'var(--tab-bar-h)' }}
      data-testid="lab-node-card"
      data-kind={kind}
      data-name={name || ''}>
      <div className="w-full max-w-[560px] flex items-center justify-between mb-2 flex-shrink-0">
        <button type="button" onClick={() => onClose?.()}
          data-testid="lab-node-card-back"
          className="px-3 py-2 rounded-lg"
          style={{ color: CHALK_CREAM, background: 'rgba(255,255,255,0.04)', border: `1px solid ${CHALK_BORDER_INNER}`, fontFamily: FONT, fontSize: FS_SUB, textShadow: CHALK_TEXT_SHADOW }}>
          ← Back
        </button>
        <span style={{ color: CHALK_DIM, fontFamily: FONT, fontSize: FS_SUB, textShadow: CHALK_TEXT_SHADOW }}>
          {kind === 'sauce' ? 'sauce' : 'cocktail'} · card
        </span>
      </div>

      <div className="w-full max-w-[560px] flex-1 min-h-0 flex flex-col rounded-2xl px-5 py-4 mb-3 overflow-y-auto"
        style={{ maxHeight: 'calc(100dvh - var(--tab-bar-h) - 72px)', background: 'rgba(255,255,255,0.025)', border: `2px double ${CHALK_BORDER_OUTER}`, boxShadow: `inset 0 0 0 1px ${CHALK_BORDER_INNER}55, 0 8px 24px rgba(0,0,0,0.55)` }}>
        <h2 className="text-center flex-shrink-0"
          style={{ color: CHALK_CREAM, fontFamily: FONT, fontSize: FS_NAME, lineHeight: 1.05, textShadow: CHALK_TEXT_SHADOW, WebkitTextStroke: '1px rgba(8,8,8,0.55)', paintOrder: 'stroke fill' }}>
          {name}
        </h2>

        {/* Cluster / family chip */}
        {clusterName && (
          <div className="flex justify-center mt-1 mb-1 flex-shrink-0">
            <span className="px-3 py-0.5 rounded-full border inline-flex items-center gap-2"
              data-testid="lab-node-card-cluster"
              style={{ color: CHALK_CREAM, background: `${clusterColor}22`, borderColor: `${clusterColor}88`, fontFamily: FONT, fontSize: FS_CHIP, ...TEXT_OUTLINE }}>
              <span className="inline-block rounded-full" style={{ width: 10, height: 10, background: clusterColor }} />
              {clusterName}{clusterTag ? <span style={{ color: CHALK_SUB }}> · {clusterTag}</span> : null}
            </span>
          </div>
        )}

        {/* Prep details */}
        {cleanDetails.length > 0 && (
          <div className="flex flex-wrap justify-center gap-x-4 gap-y-1 mt-1 flex-shrink-0">
            {cleanDetails.map((d) => (
              <span key={d.label} style={{ fontFamily: FONT, fontSize: FS_SUB }}>
                <span style={{ color: CHALK_SUB }}>{d.label}: </span>
                <span style={{ color: CHALK_DIM }}>{d.value}</span>
              </span>
            ))}
          </div>
        )}

        {/* Ingredients */}
        {ingList.length > 0 && (
          <div className="flex-shrink-0">
            <SectionLabel>Ingredients</SectionLabel>
            <ul className="flex flex-col gap-1" data-testid="lab-node-card-ingredients">
              {ingList.map((ing, i) => (
                <li key={`${ing.name}-${i}`} className="flex items-baseline gap-2"
                  style={{ fontFamily: FONT, fontSize: FS_BODY, color: CHALK_CREAM }}>
                  <span className="flex-shrink-0" style={{ color: clusterColor }}>→</span>
                  <span className="flex-shrink-0">{ing.name}</span>
                  {ing.measure ? (
                    <>
                      <span className="flex-1 self-center mx-1" aria-hidden="true"
                        style={{ borderBottom: `1px dotted ${CHALK_SUB}88`, transform: 'translateY(-2px)' }} />
                      <span className="flex-shrink-0 whitespace-nowrap" style={{ color: CHALK_DIM, fontSize: FS_MEASURE }}>{ing.measure}</span>
                    </>
                  ) : null}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Preparation — numbered steps when multi-step, else a paragraph. */}
        {prep && (() => {
          const steps = splitPrepSteps(prep);
          return (
            <div className="flex-shrink-0">
              <SectionLabel>Preparation</SectionLabel>
              {steps.length > 1 ? (
                <ol className="flex flex-col gap-1.5" data-testid="lab-node-card-prep">
                  {steps.map((step, i) => (
                    <li key={i} className="flex gap-2"
                      style={{ fontFamily: FONT, fontSize: FS_BODY, color: CHALK_CREAM, lineHeight: 1.45 }}>
                      <span className="flex-shrink-0" style={{ color: clusterColor, fontWeight: 700 }}>{i + 1}.</span>
                      <span>{step}</span>
                    </li>
                  ))}
                </ol>
              ) : (
                <p data-testid="lab-node-card-prep" style={{ fontFamily: FONT, fontSize: FS_BODY, color: CHALK_CREAM, lineHeight: 1.45 }}>{prep}</p>
              )}
            </div>
          );
        })()}

        {/* Like this */}
        {likeThis.length > 0 && (
          <div className="flex-shrink-0">
            <SectionLabel color={clusterColor}>{likeThisLabel}</SectionLabel>
            <ChipRow items={likeThis} onSelect={onSelect} testid="lab-node-card-like-this" />
          </div>
        )}

        {/* Bridges other families */}
        {bridges.length > 0 && (
          <div className="flex-shrink-0">
            <SectionLabel>Bridges other families</SectionLabel>
            <ChipRow items={bridges} onSelect={onSelect} showFamily testid="lab-node-card-bridges" />
          </div>
        )}

        {/* Pairs with */}
        {Array.isArray(pairsWith) && pairsWith.length > 0 && (
          <div className="flex-shrink-0">
            <SectionLabel>Pairs with</SectionLabel>
            <ChipRow items={pairsWith} onSelect={null} testid="lab-node-card-pairs-with" />
          </div>
        )}
      </div>
    </div>
  );
}
