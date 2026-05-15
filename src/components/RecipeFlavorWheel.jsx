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
import React, { useMemo } from 'react';
import FlavorPieWheel from './FlavorPieWheel.jsx';
import AromaHexWheel from './AromaHexWheel.jsx';
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
  // Build the focus decision + per-ring data.
  const { rings, ringLabels, centerLabel } = useMemo(() => {
    const names = (ingredients || []).map((i) => (typeof i === 'string' ? i : i.name)).filter(Boolean);
    if (names.length === 0 || !nodes) {
      return { rings: [{ values: {}, label: null }], ringLabels: [], centerLabel: null };
    }

    const focus = detectFocus(names, { nodes });
    const namesByMass = [...names].sort(
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
    };
  }, [ingredients, nodes]);

  return (
    <div className="relative inline-flex items-center justify-center" style={{ width, height: width }}>
      {/* Outer pie wheel (Briscione bands). */}
      <FlavorPieWheel
        size={width}
        axis="aroma"
        rings={rings}
        ringLabels={ringLabels}
        showHex
        onSliceClick={onTapAroma ? (key) => onTapAroma(key) : null}
        activeBucket={activeBucket}
        centerLabel={null}
        className="absolute inset-0"
      />
      {/* Inner hex — pencil-stroke blended profile. Smaller than the
          pie so it sits in the hub. */}
      <div
        className="absolute inset-0 flex items-center justify-center pointer-events-none"
        aria-hidden="true"
      >
        <AromaHexWheel
          ingredients={ingredients}
          nodes={nodes}
          onTapAroma={null}
          width={width * 0.45}
        />
      </div>
      {/* Center caption sits above both layers so users can see
          which mode the wheel is in. */}
      {centerLabel && (
        <div
          className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none text-[10px] uppercase tracking-wider"
          style={{ color: 'rgba(255,255,255,0.7)' }}
        >
          {centerLabel}
        </div>
      )}
    </div>
  );
}
