/**
 * RecipeFlavorProfile — PROFILE-1. The flavor profile of one recipe, opened in place from the recipe card next to
 * "Riff on it" (Cocktail Lab, Sauce Lab) and from the Cookbook recipe view. One calculation (shareCardData.profileForRecipe,
 * the same the shared page and the share cards use) and one display rule (flavorDisplay.js, through InventFlavorProfile).
 *
 *   useFlavorToggle(onOpen)  { open, toggle, close, btnRef, onKeyDown }   tap + keyboard: Escape closes and returns focus to the button
 *   FlavorProfileButton      the toggle button (aria-expanded, aria-controls, 44px target)
 *   FlavorProfileSection     the expanding region: Taste and Aroma bars, "Driven by", "Not counted", the note;
 *                            too little data (or no label data loaded) gives the plain line and no bars
 *
 * Nothing is fetched: `nodes` is the Map the app already holds (curated taste labels on the ingredient nodes).
 * Test ids: flavor-profile-button, flavor-profile-section, flavor-profile-driven, recipe-profile-* (see InventFlavorProfile).
 */
import { useMemo, useRef, useState } from 'react';
import InventFlavorProfile from './InventFlavorProfile.jsx';
import { profileForRecipe } from '../data/shareCardData.js';
import { NO_CHART_LINE } from '../data/recipeProfileAnalysis.js';
import { heading, small, SANS, CHALK_CREAM, CHALK_SUB } from './inventUi.jsx';

export function useFlavorToggle(onOpen) {
  const [open, setOpen] = useState(false);
  const btnRef = useRef(null);
  const toggle = () => { if (!open) onOpen?.(); setOpen(!open); };
  const close = () => { setOpen(false); btnRef.current?.focus?.(); };
  const onKeyDown = (e) => {
    if (open && e.key === 'Escape') { e.stopPropagation(); e.preventDefault(); close(); }
  };
  return { open, toggle, close, btnRef, onKeyDown };
}

export const FLAVOR_SECTION_ID = 'recipe-flavor-profile-section';

export function FlavorProfileButton({ toggle, className = '', style, label = 'Flavor profile' }) {
  const { open, toggle: onClick, btnRef, onKeyDown } = toggle;
  return (
    <button type="button" ref={btnRef} onClick={onClick} onKeyDown={onKeyDown} aria-expanded={open} aria-controls={FLAVOR_SECTION_ID}
      data-testid="flavor-profile-button" className={`min-h-[44px] ${className}`} style={style}>
      {label}
    </button>
  );
}

function drivenBy(profile) {
  const firstOf = (group) => profile.bars.find((b) => b.group === group);
  return ['taste', 'aroma'].map((g) => {
    const bar = firstOf(g);
    const keys = bar ? (profile.drivers?.[bar.axis] || []) : [];
    return bar && keys.length ? `${g === 'taste' ? 'Taste' : 'Aroma'} (${bar.label.toLowerCase()}): ${keys.join(', ')}` : null;
  }).filter(Boolean);
}

export function RecipeFlavorProfile({ recipe, nodes, testidPrefix = 'recipe-profile' }) {
  const profile = useMemo(
    () => (recipe && nodes instanceof Map && nodes.size ? profileForRecipe(recipe, nodes) : null),
    [recipe, nodes],
  );
  if (!profile || !profile.drawn) {
    return (
      <div data-testid={testidPrefix} className="min-w-0">
        <p className="mb-1" style={heading}>Flavor profile</p>
        <p className="text-[14px]" style={{ fontFamily: SANS, color: CHALK_SUB }} data-testid={`${testidPrefix}-empty`}>{NO_CHART_LINE}</p>
      </div>
    );
  }
  const driven = drivenBy(profile);
  return (
    <div className="min-w-0">
      <InventFlavorProfile profile={profile} testidPrefix={testidPrefix} />
      {driven.length > 0 && (
        <p className="mt-1 text-[13px]" style={{ fontFamily: SANS, color: CHALK_CREAM }} data-testid="flavor-profile-driven">
          <span style={small}>Driven by </span>{driven.join(' · ')}
        </p>
      )}
    </div>
  );
}

export function FlavorProfileSection({ toggle, recipe, nodes, className = '', style }) {
  if (!toggle.open) return null;
  return (
    <div id={FLAVOR_SECTION_ID} role="region" aria-label="Flavor profile" data-testid="flavor-profile-section" onKeyDown={toggle.onKeyDown}
      className={`rounded-xl px-3 py-3 ${className}`} style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(245,239,222,0.18)', ...style }}>
      <RecipeFlavorProfile recipe={recipe} nodes={nodes} />
      <button type="button" onClick={toggle.close} data-testid="flavor-profile-close" className="mt-1 min-h-[44px] px-2 text-[13px] underline" style={{ fontFamily: SANS, color: CHALK_SUB }}>
        Close
      </button>
    </div>
  );
}
