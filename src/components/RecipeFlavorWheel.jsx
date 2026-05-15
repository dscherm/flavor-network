/**
 * RecipeFlavorWheel — Briscione-style multi-ring pie chart layered
 * with the existing hexagonal scribble wheel.
 *
 * Composition:
 *   - Outer: FlavorPieWheel with N concentric rings (one per
 *     ingredient OR focal + accent rings) + bucket-color slices.
 *     Hexagonal outer frame so the surface keeps its hex identity.
 *   - Inner: AromaHexWheel — the blended pencil-stroke profile, sized
 *     smaller so it sits inside the pie's hub.
 *
 * Ring selection is driven by detectFocus():
 *   - 'centered' mode (one ingredient dominates) → ring 0 = focal,
 *     ring 1 = blend (faded "accents")
 *   - 'balanced' mode → up to 4 rings, one per top-mass ingredient,
 *     plus a final blended summary ring
 *
 * Drop-in compatible with the previous <AromaHexWheel> mount: takes
 * `ingredients` (array of names), `nodes` (Map<name, node>), and
 * `onTapAroma`.
 */
import React, { useMemo, useState } from 'react';
import FlavorPieWheel from './FlavorPieWheel.jsx';
import { detectFocus } from '../data/recipeFocus.js';

const BRISCIONE_AROMA_KEYS = ['fruity', 'floral', 'green', 'woody', 'spicy', 'fatty'];

function nodeAromaValues(node) {
  if (!node?.gnnProbs) return null;
  const probs = node.gnnProbs;
  const out = {};
  for (const k of BRISCIONE_AROMA_KEYS) {
    out[k] = Math.max(0, Math.min(1, probs[`odor_${k}`] || 0));
  }
  return out;
}

function blendedAromaValues(nodes) {
  const agg = { fruity: 0, floral: 0, green: 0, woody: 0, spicy: 0, fatty: 0 };
  let count = 0;
  for (const n of nodes) {
    const v = nodeAromaValues(n);
    if (!v) continue;
    count++;
    for (const k of BRISCIONE_AROMA_KEYS) agg[k] += v[k];
  }
  if (count === 0) return agg;
  // Normalize so the blend fills the wheel (not just sums to N).
  let total = 0;
  for (const k of BRISCIONE_AROMA_KEYS) total += agg[k];
  if (total > 0) {
    for (const k of BRISCIONE_AROMA_KEYS) agg[k] = agg[k] / total * 6;
    // Clip to [0,1] AFTER normalization — the *6 makes the dominant
    // axis hit ~1.0 when the blend is highly concentrated, while a
    // diffuse blend stays in [0.1-0.3] across all 6.
    for (const k of BRISCIONE_AROMA_KEYS) agg[k] = Math.min(1, agg[k]);
  }
  return agg;
}

export default function RecipeFlavorWheel({
  ingredients = [],
  nodes,
  onTapAroma,
  width = 320,
  activeBucket = null,
}) {
  // Anchor override — when set, force CENTERED mode with this name as
  // the focal. null/undefined = let detectFocus decide.
  const [anchorOverride, setAnchorOverride] = useState(null);
  const [showAnchorPicker, setShowAnchorPicker] = useState(false);

  // Build the focus decision + per-ring data.
  const { rings, ringLabels, centerLabel, focusMode, focusFocal, names } = useMemo(() => {
    const ns = (ingredients || []).map((i) => (typeof i === 'string' ? i : i.name)).filter(Boolean);
    if (ns.length === 0 || !nodes) {
      return { rings: [{ values: {}, label: null }], ringLabels: [], centerLabel: null, focusMode: 'empty', focusFocal: null, names: [] };
    }

    let focus = detectFocus(ns, { nodes });
    // User override forces centered mode on the chosen ingredient.
    if (anchorOverride && ns.includes(anchorOverride)) {
      focus = { ...focus, mode: 'centered', focal: anchorOverride };
    }
    const namesByMass = [...ns].sort(
      (a, b) => (focus.massShares.get(b) || 0) - (focus.massShares.get(a) || 0),
    );

    // Inner-to-outer ring construction.
    const r = [];
    const rl = [];

    if (focus.mode === 'centered' && focus.focal) {
      // Ring 0 = focal's own aroma (anchor band).
      const focalNode = nodes.get(focus.focal);
      const focalValues = nodeAromaValues(focalNode) || {};
      r.push({ values: focalValues, label: focus.focal });
      rl.push(focus.focal);

      // Ring 1 = blend of the OTHER ingredients only (the accents),
      // so the user reads "focal core + accenting halo".
      const otherNodes = names.filter((n) => n !== focus.focal).map((n) => nodes.get(n)).filter(Boolean);
      const accentValues = blendedAromaValues(otherNodes);
      // Dim the accent ring slightly so the focal reads as the center.
      for (const k of BRISCIONE_AROMA_KEYS) accentValues[k] = (accentValues[k] || 0) * 0.7;
      r.push({ values: accentValues, label: 'accents' });
      rl.push('accents');
    } else {
      // Balanced mode: top 3 ingredients by mass each get their own
      // ring, then a final blended summary ring outermost. Cap at 4
      // rings total so the slices stay readable.
      const top = namesByMass.slice(0, 3);
      for (const name of top) {
        const v = nodeAromaValues(nodes.get(name));
        if (!v) continue;
        r.push({ values: v, label: name });
        rl.push(name);
      }
      const allNodes = names.map((n) => nodes.get(n)).filter(Boolean);
      const blend = blendedAromaValues(allNodes);
      r.push({ values: blend, label: 'blend' });
      rl.push('blend');
    }

    return {
      rings: r,
      ringLabels: rl,
      centerLabel: focus.mode === 'centered' ? focus.focal : 'balanced',
      focusMode: focus.mode,
      focusFocal: focus.focal,
      names: ns,
    };
  }, [ingredients, nodes, anchorOverride]);

  return (
    <div className="flex flex-col items-center gap-1.5">
      <div className="relative inline-flex items-center justify-center" style={{ width, height: width }}>
        <FlavorPieWheel
          size={width}
          axis="aroma"
          rings={rings}
          ringLabels={ringLabels}
          showHex
          onSliceClick={onTapAroma ? (key) => onTapAroma(key) : null}
          activeBucket={activeBucket}
          centerLabel={centerLabel}
          className="absolute inset-0"
        />
      </div>

      {/* Phase 4 — gentle prompt to add quantities. Surfaces only when
          the focus decision was Balanced AND there are ≥3 ingredients
          (so the heuristic is meaningful). Quantity input lives in
          RecipeNotebook as a follow-up; for now we just hint. */}
      {focusMode === 'balanced' && names.length >= 3 && (
        <div className="text-[9px] text-gray-500 italic">
          Add weights in the notebook for more accurate centering.
        </div>
      )}

      {/* Phase 5 — anchor override. Only shown when there are multiple
          ingredients to choose between. Click a name to force Centered
          mode on that ingredient; click "Auto" to release the override
          and let detectFocus pick. */}
      {names.length > 1 && (
        <div className="flex items-center gap-1.5 text-[10px]">
          <span className="uppercase tracking-wider text-gray-500">
            {focusMode === 'centered' ? 'Centered on' : 'Balanced'}
          </span>
          {focusMode === 'centered' && focusFocal && (
            <span className="text-cyan-300">{focusFocal}</span>
          )}
          <button
            type="button"
            onClick={() => setShowAnchorPicker((v) => !v)}
            className="underline opacity-70 hover:opacity-100"
            aria-expanded={showAnchorPicker}
            aria-haspopup="menu"
          >
            Re-anchor
          </button>
          {anchorOverride && (
            <button
              type="button"
              onClick={() => { setAnchorOverride(null); setShowAnchorPicker(false); }}
              className="underline text-amber-300 opacity-70 hover:opacity-100"
            >
              clear
            </button>
          )}
        </div>
      )}

      {showAnchorPicker && names.length > 1 && (
        <div role="menu" aria-label="Choose anchor ingredient" className="flex flex-wrap gap-1 max-w-[90%] justify-center">
          <button
            role="menuitem"
            onClick={() => { setAnchorOverride(null); setShowAnchorPicker(false); }}
            className={`px-2 py-0.5 rounded-full text-[10px] border ${
              anchorOverride === null
                ? 'bg-white/15 border-white/50 text-white'
                : 'bg-white/[0.04] border-white/15 text-gray-300 hover:bg-white/[0.08]'
            }`}
          >
            Auto
          </button>
          {names.map((n) => (
            <button
              key={n}
              role="menuitem"
              onClick={() => { setAnchorOverride(n); setShowAnchorPicker(false); }}
              className={`px-2 py-0.5 rounded-full text-[10px] border ${
                anchorOverride === n
                  ? 'bg-cyan-500/20 border-cyan-400/60 text-cyan-200'
                  : 'bg-white/[0.04] border-white/15 text-gray-300 hover:bg-white/[0.08]'
              }`}
            >
              {n}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
