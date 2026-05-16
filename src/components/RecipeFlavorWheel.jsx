/**
 * RecipeFlavorWheel — Recipe Lab profile radar (per user 2026-05-16).
 *
 * Single dynamic radar with switchable axis (taste / aroma / season /
 * cuisine / method) — answers "how is this dish leaning?" at a glance.
 * Replaces the prior wedge-grid (which clustered every accent in one
 * cell when the focal had sparse metadata).
 *
 * Drop-in compatible with the previous mount in RecipeLabMobile:
 *   <RecipeFlavorWheel ingredients={recipe} nodes={graphNodes} onTapAroma={cb} />
 *
 * `onTapAroma` is preserved — clicking the active axis chip when it
 * already equals 'aroma' fires `onTapAroma('<dominantKey>')`.
 *
 * Anchor / "Centered on" UI is retained from the prior implementation
 * so the user can still force a focal ingredient.
 */

import React, { useMemo, useState } from 'react';
import { detectFocus } from '../data/recipeFocus.js';
import ProfileAxisRadar from './ProfileAxisRadar.jsx';

export default function RecipeFlavorWheel({
  ingredients = [],
  nodes,
  onTapAroma,
  width = 320,
}) {
  const [axis, setAxis] = useState('aroma');
  const [anchorOverride, setAnchorOverride] = useState(null);
  const [showAnchorPicker, setShowAnchorPicker] = useState(false);

  const { focusMode, focusFocal, names } = useMemo(() => {
    const ns = (ingredients || []).map((i) => (typeof i === 'string' ? i : i.name)).filter(Boolean);
    if (ns.length === 0 || !nodes) {
      return { focusMode: 'empty', focusFocal: null, names: [] };
    }
    let focus = detectFocus(ns, { nodes });
    if (anchorOverride && ns.includes(anchorOverride)) {
      focus = { ...focus, mode: 'centered', focal: anchorOverride };
    }
    return { focusMode: focus.mode, focusFocal: focus.focal, names: ns };
  }, [ingredients, nodes, anchorOverride]);

  const focalName = focusMode === 'centered' ? focusFocal : null;

  return (
    <div className="flex flex-col items-center gap-1.5" style={{ width }}>
      <ProfileAxisRadar
        ingredients={names}
        nodes={nodes}
        axis={axis}
        focalName={focalName}
        onAxisChange={(next) => {
          // If the user re-taps the active axis when it's aroma,
          // forward to the legacy onTapAroma so the suggestion drawer
          // re-opens (preserves the prior interaction contract).
          if (next === axis && next === 'aroma' && typeof onTapAroma === 'function') {
            onTapAroma('aroma');
          }
          setAxis(next);
        }}
        width={width}
        theme="light"
      />

      {/* "Centered on" status row + anchor picker */}
      {names.length > 0 && (
        <div className="flex items-center gap-1.5 text-[10px]">
          <span className="uppercase tracking-wider text-stone-600">
            {focusMode === 'centered' ? 'Centered on' : 'Balanced'}
          </span>
          {focusMode === 'centered' && focusFocal && (
            <span className="text-cyan-800 font-semibold">{focusFocal}</span>
          )}
          {names.length > 1 && (
            <button
              type="button"
              onClick={() => setShowAnchorPicker((v) => !v)}
              className="underline opacity-70 hover:opacity-100"
              aria-expanded={showAnchorPicker}
              aria-haspopup="menu"
            >
              Re-anchor
            </button>
          )}
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

      {/* Gentle prompt for balanced multi-ingredient recipes. */}
      {focusMode === 'balanced' && names.length >= 3 && (
        <div className="text-[9px] text-stone-600 italic">
          Add weights in the notebook for more accurate centering.
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
