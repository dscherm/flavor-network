/**
 * RecipeFlavorWheel — Recipe Lab wedge-grid wheel (light theme).
 *
 * Per user feedback (Image #2 review, 2026-05-16): the Recipe Lab now
 * uses the same WedgeGridFlavorWheel as the IngredientPanel / 3D
 * affinity overlay, but with `theme='light'` for the cream/notebook
 * surface. detectFocus() still picks the centered ingredient; the
 * other recipe ingredients become the "neighbors" rendered as cells.
 *
 * Drop-in compatible with the previous mount in RecipeLabMobile:
 *   <RecipeFlavorWheel ingredients={recipe} nodes={graphNodes} onTapAroma={cb} />
 *
 * `onTapAroma` is adapted to WedgeGridFlavorWheel's `onFilterBucket`
 * by intercepting `(axis, key)` and firing `onTapAroma(key)` only when
 * `axis === 'aroma'`.
 */
import React, { useMemo, useState } from 'react';
import { detectFocus } from '../data/recipeFocus.js';
import WedgeGridFlavorWheel from './WedgeGridFlavorWheel.jsx';

const NEIGHBOR_STRENGTH = 0.8; // uniform; recipe ingredients aren't ranked

export default function RecipeFlavorWheel({
  ingredients = [],
  nodes,
  onTapAroma,
  width = 320,
}) {
  // Anchor override — when set, force CENTERED mode with this name as
  // the focal. null/undefined = let detectFocus decide.
  const [anchorOverride, setAnchorOverride] = useState(null);
  const [showAnchorPicker, setShowAnchorPicker] = useState(false);

  const { focusMode, focusFocal, names, focalNode, neighbors } = useMemo(() => {
    const ns = (ingredients || []).map((i) => (typeof i === 'string' ? i : i.name)).filter(Boolean);
    if (ns.length === 0 || !nodes) {
      return { focusMode: 'empty', focusFocal: null, names: [], focalNode: null, neighbors: [] };
    }

    let focus = detectFocus(ns, { nodes });
    if (anchorOverride && ns.includes(anchorOverride)) {
      focus = { ...focus, mode: 'centered', focal: anchorOverride };
    }
    // Balanced mode → pick the highest-mass ingredient as the visual focal
    // (the wheel still needs a center; the "balanced" verbal hint shows below).
    const focal = focus.focal || ns[0];
    const focalNodeObj = nodes.get(focal) || { name: focal };
    const neighborList = ns
      .filter((n) => n !== focal)
      .map((n) => ({ name: n, strength: NEIGHBOR_STRENGTH }));
    return {
      focusMode: focus.mode,
      focusFocal: focus.focal,
      names: ns,
      focalNode: focalNodeObj,
      neighbors: neighborList,
    };
  }, [ingredients, nodes, anchorOverride]);

  const handleFilterBucket = (axis, key) => {
    if (axis === 'aroma' && typeof onTapAroma === 'function') {
      onTapAroma(key);
    }
  };

  return (
    <div className="flex flex-col items-center gap-1.5">
      <div className="relative inline-flex items-center justify-center" style={{ width, height: width }}>
        <WedgeGridFlavorWheel
          focalNode={focalNode}
          neighbors={neighbors}
          graphNodes={nodes}
          size={width}
          theme="light"
          onFilterBucket={handleFilterBucket}
        />
      </div>

      {/* Phase 4 — gentle prompt to add quantities. Surfaces only when
          the focus decision was Balanced AND there are ≥3 ingredients
          (so the heuristic is meaningful). Quantity input lives in
          RecipeNotebook as a follow-up; for now we just hint. */}
      {focusMode === 'balanced' && names.length >= 3 && (
        <div className="text-[9px] text-gray-600 italic">
          Add weights in the notebook for more accurate centering.
        </div>
      )}

      {/* Phase 5 — anchor override. Only shown when there are multiple
          ingredients to choose between. */}
      {names.length > 1 && (
        <div className="flex items-center gap-1.5 text-[10px]">
          <span className="uppercase tracking-wider text-gray-600">
            {focusMode === 'centered' ? 'Centered on' : 'Balanced'}
          </span>
          {focusMode === 'centered' && focusFocal && (
            <span className="text-cyan-700">{focusFocal}</span>
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
              className="underline text-amber-700 opacity-70 hover:opacity-100"
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
                ? 'bg-stone-200 border-stone-500 text-stone-900'
                : 'bg-white/60 border-stone-300 text-stone-700 hover:bg-white/90'
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
                  ? 'bg-cyan-100 border-cyan-500 text-cyan-900'
                  : 'bg-white/60 border-stone-300 text-stone-700 hover:bg-white/90'
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
