/**
 * guidedIcons.jsx — pure SVG icon set for Guided Discovery cards +
 * sub-category chips (iter 2026-05-16). Two tiers of icons:
 *
 *   1. Bubble-card headers (one per BUBBLE_REGISTRY entry) — rendered
 *      in the closed-state summary next to the +/✓ indicator.
 *   2. Sub-category chip icons — small inline glyphs that ride
 *      alongside the chip label (winter = snowflake, beef = T-bone…).
 *
 * Every component takes a `className` prop and inherits color via
 * `currentColor`, so the consumer controls size + tint with Tailwind.
 * Each viewBox is 24x24 unless noted; stroke widths target a clean
 * read at 14-18px rendered size.
 *
 * Conventions:
 *   - aria-hidden by default (parent provides the accessible label)
 *   - flex-shrink-0 so the icon doesn't squish in a chip row
 *   - default size class is w-4 h-4 (16px); pass `className` to override
 */
import React from 'react';

const baseProps = {
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.8,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
  'aria-hidden': 'true',
};

const Wrap = ({ className = 'w-4 h-4 flex-shrink-0', children }) => (
  <svg className={className} {...baseProps}>
    {children}
  </svg>
);

// ────────── Bubble-card header icons ──────────

export const IngredientHeaderIcon = ({ className }) => (
  <Wrap className={className}>
    {/* Herb sprig with three leaves — universal "ingredient" cue.
        Replaces the prior abstract basil-leaf which didn't read at
        large size. */}
    <path d="M12 22V7" />
    <path d="M12 16c-4 0-6-3-6-7 4 0 6 2 6 6" />
    <path d="M12 13c4 0 6-3 6-7-4 0-6 2-6 6" />
    <path d="M12 19c-3 0-5-2-5-5 3 0 5 1 5 4" />
  </Wrap>
);

export const SeasonHeaderIcon = ({ className }) => (
  <Wrap className={className}>
    {/* four-quadrant ring suggesting the cycle of seasons */}
    <circle cx="12" cy="12" r="8" />
    <path d="M12 4v16M4 12h16" />
  </Wrap>
);

export const CuisineHeaderIcon = ({ className }) => (
  <Wrap className={className}>
    {/* globe — recipe geography */}
    <circle cx="12" cy="12" r="9" />
    <path d="M3 12h18M12 3a13 13 0 010 18M12 3a13 13 0 000 18" />
  </Wrap>
);

export const MeatHeaderIcon = ({ className }) => (
  <Wrap className={className}>
    {/* T-bone steak silhouette — wide cushion shape with a "T" bone.
        Clearer than the prior drumstick at large size. */}
    <path d="M5 8c0-2 3-4 7-4s7 2 7 4c2 0 3 2 3 4s-1 4-3 4c0 2-3 4-7 4s-7-2-7-4c-2 0-3-2-3-4s1-4 3-4z" />
    <path d="M12 8v8" strokeWidth="1.6" />
    <path d="M9 11h6" strokeWidth="1.6" />
  </Wrap>
);

export const AromaHeaderIcon = ({ className }) => (
  <Wrap className={className}>
    {/* Profile nose silhouette — the universal "smell" cue. Face
        looks left; the curve traces forehead → bridge → tip →
        nostril → lip → chin. Two scent dots float in front of the
        nostril to reinforce the "scent" meaning. */}
    <path d="M14 3c-3 1-4 4-4 7l-3 2c-1 1-1 2 0 3l1 1v2c0 1 1 2 2 2h2v2h3" />
    <path d="M11 13c1 0 1.5-0.5 2-1" strokeWidth="1.4" />
    <circle cx="4" cy="9" r="0.9" fill="currentColor" stroke="none" />
    <circle cx="2" cy="13" r="0.7" fill="currentColor" stroke="none" />
  </Wrap>
);

export const CocktailHeaderIcon = ({ className }) => (
  <Wrap className={className}>
    {/* martini glass — borrowed silhouette from LandingScreen.CocktailVisual */}
    <path d="M4 5h16l-7 9h-2z" />
    <path d="M12 14v5M8 19h8" />
    <circle cx="9" cy="8" r="0.8" fill="currentColor" stroke="none" />
  </Wrap>
);

export const SauceHeaderIcon = ({ className }) => (
  <Wrap className={className}>
    {/* Saucepan with extended handle (iter 2026-05-16: handle
        lengthened from 3 → 6 units per user feedback). */}
    <path d="M2 9h15v6a3 3 0 01-3 3H5a3 3 0 01-3-3z" />
    <path d="M17 11h6v2h-6" />
    <path d="M4 7l1-2M8 7l1-2M12 7l1-2" />
  </Wrap>
);

export const DessertHeaderIcon = ({ className }) => (
  <Wrap className={className}>
    {/* Cupcake — domed frosting swirl on top, wrapper below.
        Wrapper carries 4 thin slightly-slanted vertical lines
        (per user spec: matches the wrapper's outward-flaring sides
        so the inner ridges mirror the silhouette). */}
    {/* Frosting dome — three rounded swirls */}
    <path d="M6 11c0-3 3-6 6-6s6 3 6 6" />
    <path d="M7 9c1-1.5 3-3 5-3" />
    <path d="M17 9c-1-1.5-3-3-5-3" />
    <path d="M12 5v-2" />
    {/* Wrapper — trapezoid (wider at top, narrower at bottom) */}
    <path d="M5 11h14l-2 9H7z" />
    {/* Four thin slanted ridges inside the wrapper. Each follows
        the wrapper's outward flare — left two slant left-down,
        right two slant right-down. */}
    <path d="M8 12l-0.7 7" strokeWidth="0.9" />
    <path d="M10.5 12l-0.25 7.5" strokeWidth="0.9" />
    <path d="M13.5 12l0.25 7.5" strokeWidth="0.9" />
    <path d="M16 12l0.7 7" strokeWidth="0.9" />
  </Wrap>
);

export const DietaryHeaderIcon = ({ className }) => (
  <Wrap className={className}>
    {/* leaf with veined center — "plant / dietary" universal cue */}
    <path d="M5 19c0-9 6-15 15-15-1 9-6 15-15 15z" />
    <path d="M5 19l9-9" />
  </Wrap>
);

// ────────── Season chip icons (4) ──────────

export const SpringIcon = ({ className }) => (
  <Wrap className={className}>
    {/* tulip: two petals + stem + leaf — reads clearly at 28px and 48px */}
    <path d="M12 22V13" />
    <path d="M12 13c0-4-3-6-3-9 1 0 3 2 3 5" />
    <path d="M12 13c0-4 3-6 3-9-1 0-3 2-3 5" />
    <path d="M12 17c-3 0-5-1-5-1" />
  </Wrap>
);

export const SummerIcon = ({ className }) => (
  <Wrap className={className}>
    {/* sun with rays */}
    <circle cx="12" cy="12" r="4" />
    <path d="M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6l1.4 1.4M17 17l1.4 1.4M5.6 18.4L7 17M17 7l1.4-1.4" />
  </Wrap>
);

export const FallIcon = ({ className }) => (
  <Wrap className={className}>
    {/* oak leaf — lobed silhouette reads clearly at 28px and 48px */}
    <path d="M12 21v-5" />
    <path d="M12 16c-1 0-3-1-4-3 1 0 3 0 4 2" />
    <path d="M12 16c1 0 3-1 4-3-1 0-3 0-4 2" />
    <path d="M12 13c-1-1-2-3-2-5 2 0 3 2 3 5" />
    <path d="M12 13c1-1 2-3 2-5-2 0-3 2-3 5" />
    <path d="M12 10c-1-1-1-3-1-5 1 0 2 2 2 4" />
    <path d="M12 10c1-1 1-3 1-5-1 0-2 2-2 4" />
  </Wrap>
);

export const WinterIcon = ({ className }) => (
  <Wrap className={className}>
    {/* snowflake — six radial arms */}
    <path d="M12 3v18M3 12h18M5 5l14 14M19 5L5 19" />
    <path d="M9 6l3-3 3 3M9 18l3 3 3-3M6 9l-3 3 3 3M18 9l3 3-3 3" />
  </Wrap>
);

// ────────── Meat chip icons (6) ──────────

export const BeefIcon = ({ className }) => (
  <Wrap className={className}>
    {/* T-bone steak silhouette */}
    <path d="M5 8c0-2 2-4 5-4s5 2 5 4c2 0 4 2 4 4s-2 4-4 4c0 2-2 4-5 4s-5-2-5-4c-2 0-4-2-4-4s2-4 4-4z" />
    <path d="M12 8v8M9 12h6" />
  </Wrap>
);

export const PorkIcon = ({ className }) => (
  <Wrap className={className}>
    {/* pig profile — snout + ear */}
    <path d="M4 14c0-4 3-7 8-7s8 3 8 7-3 6-8 6-8-2-8-6z" />
    <circle cx="17" cy="13" r="1" fill="currentColor" stroke="none" />
    <path d="M18 11c1-2 2-3 3-3 0 1-1 2-2 3M14 17l-1 2M9 17l-1 2" />
  </Wrap>
);

export const ChickenIcon = ({ className }) => (
  <Wrap className={className}>
    {/* drumstick — slimmer than MeatHeaderIcon */}
    <path d="M16 4a4 4 0 014 4c0 1-1 3-2 4l-7 7c-1 1-2 1-3 0s-1-2 0-3l7-7c1-1 3-2 4-2z" />
    <path d="M7 16l-3 3M9 18l-3 1" />
  </Wrap>
);

export const FishIcon = ({ className }) => (
  <Wrap className={className}>
    {/* fish silhouette */}
    <path d="M4 12c0-3 3-6 8-6s8 3 8 6-3 6-8 6-8-3-8-6z" />
    <path d="M20 12l3-3v6z" />
    <circle cx="9" cy="11" r="0.8" fill="currentColor" stroke="none" />
  </Wrap>
);

export const LambIcon = ({ className }) => (
  <Wrap className={className}>
    {/* sheep — fluffy cloud body + head */}
    <path d="M5 13a3 3 0 010-6 3 3 0 014-2 3 3 0 016 0 3 3 0 014 2 3 3 0 010 6c0 3-3 5-7 5s-7-2-7-5z" />
    <circle cx="9" cy="11" r="0.7" fill="currentColor" stroke="none" />
    <circle cx="13" cy="11" r="0.7" fill="currentColor" stroke="none" />
  </Wrap>
);

export const GameIcon = ({ className }) => (
  <Wrap className={className}>
    {/* antlers + head */}
    <path d="M8 4l-2 4 1 1 2-2M16 4l2 4-1 1-2-2" />
    <path d="M8 8v2a4 4 0 008 0V8" />
    <path d="M9 13c-2 0-3 2-3 4 1 2 3 3 6 3s5-1 6-3c0-2-1-4-3-4" />
  </Wrap>
);

// ────────── Aroma chip icons (6) ──────────

export const FruityIcon = ({ className }) => (
  <Wrap className={className}>
    {/* cherry pair */}
    <circle cx="8" cy="17" r="4" />
    <circle cx="16" cy="18" r="3" />
    <path d="M8 13c0-4 2-6 4-9M16 15c0-3 1-5 2-7" />
  </Wrap>
);

export const FloralIcon = ({ className }) => (
  <Wrap className={className}>
    {/* 5-petal flower */}
    <circle cx="12" cy="12" r="2" />
    <circle cx="12" cy="6" r="3" />
    <circle cx="12" cy="18" r="3" />
    <circle cx="6" cy="12" r="3" />
    <circle cx="18" cy="12" r="3" />
  </Wrap>
);

export const GreenIcon = ({ className }) => (
  <Wrap className={className}>
    {/* mint sprig */}
    <path d="M12 21V8" />
    <path d="M12 14c-3-1-5-3-5-6 3 0 5 2 5 5M12 11c3-1 5-3 5-6-3 0-5 2-5 5" />
  </Wrap>
);

export const WoodyIcon = ({ className }) => (
  <Wrap className={className}>
    {/* simple tree silhouette — trunk + triangular crown. The earlier
        cross-section idea (trunk rect + aerial rings) mixed
        perspectives and didn't read as wood at 14px. */}
    <path d="M12 3l-6 8h3l-4 6h5v4h4v-4h5l-4-6h3z" />
  </Wrap>
);

export const SpicyIcon = ({ className }) => (
  <Wrap className={className}>
    {/* chili pepper — curved body + stem + cap reads at 28px and 48px */}
    <path d="M8 20c-1-3 0-7 3-10s7-5 9-5c0 3-2 7-5 9s-6 7-7 6z" />
    <path d="M17 5c1-2 3-3 4-2" />
    <path d="M8 20c0-1 1-1 2 0" />
  </Wrap>
);

export const FattyIcon = ({ className }) => (
  <Wrap className={className}>
    {/* butter pat */}
    <path d="M4 16l5-9h6l5 9z" />
    <path d="M4 16h16v3H4z" />
  </Wrap>
);

// ────────── Cuisine chip icons (8 — continent/region silhouettes) ──────────
// ADR-3 C1: hand-curated inline SVGs, continuation of existing 30+ inline SVG
// pattern. stroke="currentColor" so Briscione palette auto-tints on active state.
// All viewBox 24x24. Continent outlines are simplified recognizable silhouettes,
// NOT flag icons (CATEGORICAL_AXES.cuisine.labels are regional buckets, not nations).

export const GlobalCuisineIcon = CuisineHeaderIcon;

export const EuropeanCuisineIcon = ({ className }) => (
  <Wrap className={className}>
    {/* Europe continent silhouette — Iberian peninsula SW, Scandinavian NE,
        Mediterranean coast S, British Isles implied by NW indentation */}
    <path d="M5 5c1-1 2-1 3 0l1-1h2l1 1 2-1 2 1 1 2-1 1 1 2-1 2-2 1-1 2-2 1-1 2-2 1-2-1-2 1-2-1-1-2 1-2-1-2 1-2-1-1z" />
  </Wrap>
);

export const AmericasCuisineIcon = ({ className }) => (
  <Wrap className={className}>
    {/* North + South America silhouette — wide top (N America), narrow
        isthmus, bulge at Brazil (E), tapered Patagonian tip (S) */}
    <path d="M7 3c2 0 5 1 6 3l2-1 2 2-1 2 1 2-2 2 1 2-1 2-2 1-1 3-1 2-1 1-1-1-1 1-1-1v-3l-1-2 1-2-1-2-2-1 1-2-1-1 1-2-2-2 1-2z" />
  </Wrap>
);

export const EastAsianCuisineIcon = ({ className }) => (
  <Wrap className={className}>
    {/* East Asia silhouette — China mainland (large mass center-left),
        Korean peninsula (SE), Japanese archipelago dots (E) */}
    <path d="M5 4c1 0 3 1 4 3l3-1 3 1 2 2 1 3-1 3-2 2-3 1-2 2-3 1-3-1-2-2 1-3-1-2 1-3-1-3z" />
    <circle cx="18" cy="9" r="1" fill="currentColor" stroke="none" />
    <circle cx="19" cy="12" r="0.8" fill="currentColor" stroke="none" />
    <path d="M15 14l2 1 1 2" strokeWidth="1.2" />
  </Wrap>
);

export const SEAsianCuisineIcon = ({ className }) => (
  <Wrap className={className}>
    {/* SE Asia silhouette — Indochina peninsula (top), Malay peninsula
        (narrow finger S), island arc dots (Indonesia/Philippines) */}
    <path d="M7 3c2 0 4 1 5 3l2 1 1 3-1 2-2 2-2 4-1 2-1-1-1-3-1-2-2-1-1-2 1-3-1-2z" />
    <circle cx="16" cy="14" r="0.9" fill="currentColor" stroke="none" />
    <circle cx="18" cy="16" r="0.8" fill="currentColor" stroke="none" />
    <circle cx="15" cy="17" r="0.7" fill="currentColor" stroke="none" />
  </Wrap>
);

export const SouthAsianCuisineIcon = ({ className }) => (
  <Wrap className={className}>
    {/* South Asia silhouette — Indian subcontinent triangle pointing S,
        Sri Lanka dot SE, Himalayan flat top N */}
    <path d="M6 4h12l1 2-1 2 1 3-1 3-2 3-3 4-2 1-2-1-3-4-2-3 1-3-1-3 1-2z" />
    <circle cx="16" cy="18" r="0.8" fill="currentColor" stroke="none" />
  </Wrap>
);

export const MiddleEasternCuisineIcon = ({ className }) => (
  <Wrap className={className}>
    {/* Middle East / West Asia silhouette — Arabian peninsula (large
        triangular mass S), Anatolian plateau (N), Persian Gulf implied */}
    <path d="M4 6c1-1 3-1 4 0l2-1 3 0 3 1 2 2 1 3-1 2 1 2-1 3-2 2-2 1-2-1-3 1-2-1-1-3-2-2-2-1-1-3 1-3z" />
    <path d="M11 13l1 5-1 2-1-2z" strokeWidth="1.2" />
  </Wrap>
);

export const AfricanCuisineIcon = ({ className }) => (
  <Wrap className={className}>
    {/* Africa continent silhouette — wide top (Sahara), Gulf of Guinea
        bulge W, Horn of Africa NE point, tapered Cape S */}
    <path d="M7 3h10l2 2 1 3-1 2 1 3-1 3-2 3-2 2-3 2-2-1-3-2-2-3-1-3 1-3-1-3 1-3z" />
  </Wrap>
);

// ────────── Dietary chip icons (8) ──────────

export const VegetarianIcon = ({ className }) => (
  <Wrap className={className}>
    {/* leaf — same motif as DietaryHeaderIcon but slimmer */}
    <path d="M5 19c0-8 6-14 15-14-1 8-6 14-15 14z" />
  </Wrap>
);

export const VeganIcon = ({ className }) => (
  <Wrap className={className}>
    {/* two leaves (a stricter "V") */}
    <path d="M3 12c0-5 4-9 9-9-1 5-4 9-9 9z" />
    <path d="M21 12c0-5-4-9-9-9 1 5 4 9 9 9z" />
    <path d="M12 21V12" />
  </Wrap>
);

export const GlutenFreeIcon = ({ className }) => (
  <Wrap className={className}>
    {/* wheat stalk with a slash */}
    <path d="M12 21V6" />
    <path d="M12 12c-2-1-3-3-3-5 2 0 3 2 3 5M12 12c2-1 3-3 3-5-2 0-3 2-3 5" />
    <path d="M12 9c-2-1-3-2-3-4 2 0 3 1 3 4M12 9c2-1 3-2 3-4-2 0-3 1-3 4" />
    <path d="M4 20L20 4" strokeWidth="2.4" />
  </Wrap>
);

export const DairyFreeIcon = ({ className }) => (
  <Wrap className={className}>
    {/* milk carton with slash */}
    <path d="M8 3h8v3l1 2v11a1 1 0 01-1 1H8a1 1 0 01-1-1V8l1-2z" />
    <path d="M4 20L20 4" strokeWidth="2.4" />
  </Wrap>
);

export const NutFreeIcon = ({ className }) => (
  <Wrap className={className}>
    {/* acorn with slash */}
    <path d="M8 9h8l-1 8a3 3 0 01-3 3 3 3 0 01-3-3z" />
    <path d="M7 9c0-2 2-4 5-4s5 2 5 4" />
    <path d="M4 20L20 4" strokeWidth="2.4" />
  </Wrap>
);

export const PescatarianIcon = FishIcon;

export const KosherIcon = ({ className }) => (
  <Wrap className={className}>
    {/* Star of David — two overlapping triangles. Recognized symbol;
        used here as the canonical kosher cue, not religiously claimed. */}
    <path d="M12 3l9 15H3z" />
    <path d="M12 21L3 6h18z" />
  </Wrap>
);

export const HalalIcon = ({ className }) => (
  <Wrap className={className}>
    {/* crescent moon — canonical halal cue */}
    <path d="M16 4a8 8 0 100 16 7 7 0 01-3-13 8 8 0 013-3z" />
  </Wrap>
);

// ────────── Per-card color palette (iter 2026-05-16) ──────────
// Each of the 9 bubble cards gets a unique stroke color drawn from
// Tailwind's 400 family so saturation + luminance read as a single
// palette. Used by the cloud-outline SVG AND the big closed-state
// icon — color match makes "icon belongs to this card" instantly
// obvious. Tints are 8-12% alpha versions for hover/fill use.
export const CARD_COLOR_BY_KEY = {
  ingredient: { stroke: '#22d3ee', tint: 'rgba(34, 211, 238, 0.10)',  text: '#67e8f9' },  // cyan
  season:     { stroke: '#34d399', tint: 'rgba(52, 211, 153, 0.10)',  text: '#6ee7b7' },  // emerald
  cuisine:    { stroke: '#60a5fa', tint: 'rgba(96, 165, 250, 0.10)',  text: '#93c5fd' },  // sky / globe
  meat:       { stroke: '#fb7185', tint: 'rgba(251, 113, 133, 0.10)', text: '#fda4af' },  // rose
  aroma:      { stroke: '#f472b6', tint: 'rgba(244, 114, 182, 0.10)', text: '#f9a8d4' },  // pink
  cocktail:   { stroke: '#a78bfa', tint: 'rgba(167, 139, 250, 0.10)', text: '#c4b5fd' },  // violet (matches LandingScreen)
  sauce:      { stroke: '#fbbf24', tint: 'rgba(251, 191, 36, 0.10)',  text: '#fcd34d' },  // amber (matches LandingScreen)
  dessert:    { stroke: '#e879f9', tint: 'rgba(232, 121, 249, 0.10)', text: '#f0abfc' },  // fuchsia
  dietary:    { stroke: '#a3e635', tint: 'rgba(163, 230, 53, 0.10)',  text: '#bef264' },  // lime
};

// ────────── Cloud outline (responsive thought-bubble silhouette) ──────────
// SVG cloud silhouette used as an absolute-positioned background on
// each card. Iter v2 (2026-05-16): the original viewBox 100×60 path
// produced dramatic-looking lobes once stretched to fill a tall card.
// New path uses viewBox 100×80 (closer to typical card aspect) and
// shallow bumps (amplitude ~6 in viewBox units, was 18) so the cloud
// reads as "softly scalloped" rather than "cartoony lobes". The
// vector-effect=non-scaling-stroke keeps the outline at 1.4px even
// when the SVG stretches.
export function CloudOutline({ color = '#22d3ee', fillTint = null, className = '' }) {
  return (
    <svg
      viewBox="0 0 100 80"
      preserveAspectRatio="none"
      aria-hidden="true"
      className={`absolute inset-0 w-full h-full pointer-events-none ${className}`}
    >
      <path
        d="
          M 10 26
          C 10 18, 22 18, 22 26
          C 22 18, 36 18, 36 26
          C 36 18, 50 18, 50 26
          C 50 18, 64 18, 64 26
          C 64 18, 78 18, 78 26
          C 78 18, 90 18, 90 26
          C 96 26, 96 40, 90 40
          C 96 40, 96 54, 90 54
          C 90 62, 78 62, 78 54
          C 78 62, 64 62, 64 54
          C 64 62, 50 62, 50 54
          C 50 62, 36 62, 36 54
          C 36 62, 22 62, 22 54
          C 22 62, 10 62, 10 54
          C 4 54, 4 40, 10 40
          C 4 40, 4 26, 10 26
          Z
        "
        fill={fillTint || 'rgba(13, 31, 56, 0.85)'}
        stroke={color}
        strokeWidth={1.4}
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}

// ────────── Lookups (used by the consumers) ──────────

export const HEADER_ICON_BY_KEY = {
  ingredient: IngredientHeaderIcon,
  season: SeasonHeaderIcon,
  cuisine: CuisineHeaderIcon,
  meat: MeatHeaderIcon,
  aroma: AromaHeaderIcon,
  cocktail: CocktailHeaderIcon,
  sauce: SauceHeaderIcon,
  dessert: DessertHeaderIcon,
  dietary: DietaryHeaderIcon,
};

export const SEASON_ICON_BY_KEY = {
  spring: SpringIcon,
  summer: SummerIcon,
  fall: FallIcon,
  winter: WinterIcon,
};

export const MEAT_ICON_BY_KEY = {
  beef: BeefIcon,
  pork: PorkIcon,
  chicken: ChickenIcon,
  fish: FishIcon,
  lamb: LambIcon,
  game: GameIcon,
};

export const AROMA_ICON_BY_LABEL = {
  Fruity: FruityIcon,
  Floral: FloralIcon,
  Green: GreenIcon,
  Woody: WoodyIcon,
  Spicy: SpicyIcon,
  Fatty: FattyIcon,
};

// Renamed from CUISINE_ICON_BY_LABEL → CUISINE_BUCKET_ICON_BY_LABEL (P7, 2026-05-18).
// The rename is intentional: stale imports surface as reference errors rather than
// silent visual regressions (§2.4 verification gate). Update all callers accordingly.
export const CUISINE_BUCKET_ICON_BY_LABEL = {
  Global: GlobalCuisineIcon,
  European: EuropeanCuisineIcon,
  Americas: AmericasCuisineIcon,
  'East Asian': EastAsianCuisineIcon,
  'SE Asian': SEAsianCuisineIcon,
  'South Asian': SouthAsianCuisineIcon,
  'Middle Eastern': MiddleEasternCuisineIcon,
  African: AfricanCuisineIcon,
};

// ────────── Icon size constants ──────────
// FILTER_PILL_ICON_SIZE: used by GuidedFilterTypeCard pills (48px per P1 contract).
// CHIP_ICON_SIZE: used by in-Results chip strip (28px, w-7 h-7).
export const FILTER_PILL_ICON_SIZE = 48;
export const CHIP_ICON_SIZE = 28;

// ────────── Sub-chip filter palettes ──────────
// User-requested: chip icons + active-state should pick up the
// canonical filter color so users see the same hue here as on the
// network filter pills. Sources:
//   - Aroma → BRISCIONE_AROMA via src/data/briscionePalette.js (the
//     chip labels are Title-case, palette keys lower-case)
//   - Season → BRISCIONE_SEASON
//   - Cuisine → CATEGORICAL_AXES.cuisine.colors (canonical bucket
//     palette used by the network color scheme)
//   - Meat / Dietary — no first-class filter axis in the app, so we
//     supply thematic colors that match cultural / visual cues.

export const SEASON_CHIP_COLOR = {
  spring: '#86efac', // pale green (BRISCIONE_SEASON.spring)
  summer: '#fde047', // saturated yellow
  fall:   '#fb923c', // orange
  winter: '#94a3b8', // slate
};

export const AROMA_CHIP_COLOR = {
  Fruity: '#dc2626',  // BRISCIONE_AROMA.fruity
  Floral: '#ec4899',
  Green:  '#22c55e',
  Woody:  '#92400e',
  Spicy:  '#ea580c',
  Fatty:  '#fbbf24',
};

export const CUISINE_CHIP_COLOR = {
  Global:           '#94a3b8',
  European:         '#3b82f6',
  Americas:         '#ef4444',
  'East Asian':     '#f59e0b',
  'SE Asian':       '#22c55e',
  'South Asian':    '#a855f7',
  'Middle Eastern': '#ec4899',
  African:          '#0ea5e9',
};

export const MEAT_CHIP_COLOR = {
  beef:    '#dc2626', // deep red
  pork:    '#fb7185', // rose
  chicken: '#fbbf24', // amber (skin/feather)
  fish:    '#38bdf8', // sky blue (water)
  lamb:    '#d6d3d1', // wool / off-white
  game:    '#92400e', // umber (forest)
};

export const DIETARY_CHIP_COLOR = {
  vegetarian:    '#84cc16', // lime
  vegan:         '#22c55e', // emerald (stricter plants)
  'gluten-free': '#fbbf24', // wheat-amber (the thing avoided)
  'dairy-free':  '#e0e7ff', // off-white (milk cue)
  'nut-free':    '#a16207', // nut-brown
  pescatarian:   '#38bdf8', // sky blue (water)
  kosher:        '#3b82f6', // blue
  halal:         '#10b981', // emerald
};

export const DIETARY_ICON_BY_KEY = {
  vegetarian: VegetarianIcon,
  vegan: VeganIcon,
  'gluten-free': GlutenFreeIcon,
  'dairy-free': DairyFreeIcon,
  'nut-free': NutFreeIcon,
  pescatarian: PescatarianIcon,
  kosher: KosherIcon,
  halal: HalalIcon,
};
