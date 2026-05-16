import AnimatedLogo from './AnimatedLogo.jsx';
import { hapticMedium } from '../utils/native.js';

/**
 * LandingScreen — permanent landing surface. Top half = animated brand
 * mark + tagline. Bottom half = 3 primary tiles (Explore the Network /
 * Guided Discovery / Build your Recipe).
 *
 * Iter 2026-05-16 (UX pipeline Phase 1):
 *   - Reduced from 5 tiles to 3 (per plan.md §1). Cocktail / Sauce /
 *     Recipes Lab become sublistings UNDER "Explore the Network",
 *     surfaced via the in-app secondary nav (not the landing page).
 *   - Each tile carries a subheadline from the user spec.
 *   - "Build your Recipe" is a new top-level path that replaces the
 *     prior Recipe Lab notebook entry — actual builder UX lands in
 *     pipeline Phase 5.
 *
 * Doubles as the loading surface: when `isLoading` is true after the
 * user has tapped a tile, the picked tile shows a shimmer; the others
 * dim. The animated logo keeps running.
 */

function PairingVisual() {
  // Lifted from StartPage.jsx — a dot-network silhouette mirroring
  // the 3D ingredient graph behind the Network tab.
  const dots = [
    { x: 50, y: 12, d: 0 },
    { x: 14, y: 36, d: 0.3 },
    { x: 86, y: 36, d: 0.6 },
    { x: 50, y: 50, d: 0.15 },
    { x: 24, y: 78, d: 0.45 },
    { x: 76, y: 78, d: 0.75 },
    { x: 50, y: 90, d: 0.9 },
  ];
  const edges = [
    [0, 3], [1, 3], [2, 3], [3, 4], [3, 5], [4, 6], [5, 6], [1, 4], [2, 5],
  ];
  return (
    <svg viewBox="0 0 100 100" className="w-20 h-20" aria-hidden="true">
      {edges.map(([a, b], i) => (
        <line
          key={i}
          x1={dots[a].x} y1={dots[a].y} x2={dots[b].x} y2={dots[b].y}
          stroke="rgba(79,143,255,0.35)" strokeWidth="0.7"
        />
      ))}
      {dots.map((dot, i) => (
        <circle
          key={i}
          cx={dot.x} cy={dot.y} r="3.5"
          fill="rgb(79,143,255)"
          className="motion-safe:animate-pulse"
          style={{
            filter: 'drop-shadow(0 0 3px rgba(79,143,255,0.9))',
            animationDelay: `${dot.d}s`,
            animationDuration: '2.4s',
          }}
        />
      ))}
    </svg>
  );
}

function GuidedVisual() {
  // Thought bubble + spark — Guided Discovery's universal cue.
  return (
    <svg viewBox="0 0 100 100" className="w-20 h-20" aria-hidden="true">
      <path
        d="M 26 28 Q 26 18 38 18 L 70 18 Q 82 18 82 30 Q 82 42 70 42 L 50 42 L 38 56 L 38 42 Q 26 42 26 30 Z"
        fill="rgba(52,211,153,0.18)" stroke="rgb(52,211,153)" strokeWidth="2"
      />
      <circle cx="32" cy="68" r="3" fill="rgba(52,211,153,0.6)" />
      <circle cx="22" cy="78" r="2" fill="rgba(52,211,153,0.45)" />
      <circle cx="14" cy="86" r="1.4" fill="rgba(52,211,153,0.3)" />
      <circle cx="46" cy="30" r="2.2" fill="rgb(125,186,94)"
        style={{ filter: 'drop-shadow(0 0 4px rgba(125,186,94,0.8))' }}
      />
      <circle cx="56" cy="30" r="2.2" fill="rgb(125,186,94)"
        style={{ filter: 'drop-shadow(0 0 4px rgba(125,186,94,0.8))' }}
      />
      <circle cx="66" cy="30" r="2.2" fill="rgb(125,186,94)"
        style={{ filter: 'drop-shadow(0 0 4px rgba(125,186,94,0.8))' }}
      />
    </svg>
  );
}

function BuildVisual() {
  // Mixing bowl with rising ingredients — "you bring the ingredients,
  // we dig deeper". Slimmer + bolder than the prior notebook glyph.
  return (
    <svg viewBox="0 0 100 100" className="w-20 h-20" aria-hidden="true">
      {/* Bowl body */}
      <path
        d="M 18 50 L 82 50 L 76 84 Q 76 90 70 90 L 30 90 Q 24 90 24 84 Z"
        fill="rgba(56,189,248,0.16)" stroke="rgb(56,189,248)" strokeWidth="2"
      />
      {/* Bowl rim highlight */}
      <ellipse cx="50" cy="50" rx="32" ry="3" fill="rgba(56,189,248,0.4)" />
      {/* Ingredients rising from the bowl */}
      <circle cx="34" cy="40" r="5" fill="rgb(244,114,182)" opacity="0.85"
        style={{ filter: 'drop-shadow(0 0 4px rgba(244,114,182,0.7))' }} />
      <circle cx="50" cy="32" r="6" fill="rgb(250,204,21)" opacity="0.85"
        style={{ filter: 'drop-shadow(0 0 4px rgba(250,204,21,0.7))' }} />
      <circle cx="66" cy="40" r="5" fill="rgb(34,197,94)" opacity="0.85"
        style={{ filter: 'drop-shadow(0 0 4px rgba(34,197,94,0.7))' }} />
      {/* Steam wisps */}
      <path
        d="M 38 18 Q 42 14 38 10"
        fill="none" stroke="rgba(255,255,255,0.4)" strokeWidth="1.4"
        className="motion-safe:animate-pulse"
        style={{ animationDuration: '3s' }}
      />
      <path
        d="M 62 18 Q 66 14 62 10"
        fill="none" stroke="rgba(255,255,255,0.4)" strokeWidth="1.4"
        className="motion-safe:animate-pulse"
        style={{ animationDuration: '3s', animationDelay: '0.6s' }}
      />
    </svg>
  );
}

const TILES = [
  {
    id: 'pairing', // routes to existing 'network' tab — preserves activeTab wiring
    label: 'Explore the Network',
    subheadline: "You're ready to poke around the NeuFlavor Network model without guidance to explore all kinds of ways of pairing ingredients.",
    accent: '#4f8fff',
    Visual: PairingVisual,
  },
  {
    id: 'guided',
    label: 'Guided Discovery',
    subheadline: 'You want a guided tour to discover ways of exploring ingredient pairings and why they pair well.',
    accent: '#34d399',
    Visual: GuidedVisual,
  },
  {
    id: 'build',
    label: 'Build your Recipe',
    subheadline: "You already have idea of ingredients you'd like to use and/or the type of recipe you'd like to build but just want to dig deeper.",
    accent: '#38bdf8',
    Visual: BuildVisual,
  },
];

export default function LandingScreen({ onModeSelect, isLoading = false, picked = null }) {
  const handleTile = (id) => {
    if (isLoading) return;
    hapticMedium();
    onModeSelect?.(id);
  };

  return (
    <div
      className="flex flex-col items-center w-full min-h-screen px-4 pb-8"
      role="dialog"
      aria-modal="true"
      aria-labelledby="fn-landing-title"
      style={{ backgroundColor: '#0d1f38' }}
    >
      <h1 id="fn-landing-title" className="sr-only">Neural Flavor</h1>

      {/* Top half — animated logo. Sized to fill 50vh on every viewport
          per the design ask ("icon SVG label should take up the top
          half of the screen"). */}
      <div className="w-full flex items-center justify-center pt-[max(env(safe-area-inset-top),1rem)] h-[50vh]">
        <AnimatedLogo className="h-full w-auto max-w-full" />
      </div>

      {/* Tagline directly below the logo */}
      <p className="text-center text-sm sm:text-base text-[#a8c4e8] max-w-xl mt-2 mb-6 leading-relaxed">
        Built on 2.2M recipes, 48,588 pairings, and real molecular chemistry.
      </p>

      {/* 3 primary tiles in the bottom half. Grid columns scale
          1 → 3 across breakpoints — at sm+ the three tiles fit one row. */}
      <div className="w-full max-w-5xl grid grid-cols-1 sm:grid-cols-3 gap-4">
        {TILES.map((tile) => {
          const isPicked = picked === tile.id;
          const dimmed = isLoading && !isPicked;
          const Visual = tile.Visual;
          return (
            <button
              key={tile.id}
              onClick={() => handleTile(tile.id)}
              disabled={isLoading}
              data-mode={tile.id}
              aria-label={`${tile.label}. ${tile.subheadline}`}
              className={`group relative flex flex-col items-center text-center gap-3 rounded-xl border bg-[#12203b] p-5 sm:p-6 min-h-[44px] transition-all overflow-hidden focus:outline-none
                ${dimmed ? 'opacity-40 cursor-wait' : 'hover:bg-[#16284a]'}
                ${isPicked ? 'border-cyan-400/80' : 'border-[#1d3158]'}
              `}
              style={isPicked ? { boxShadow: `0 0 24px ${tile.accent}55` } : undefined}
            >
              <span
                className="absolute left-0 top-0 bottom-0 w-1"
                style={{ background: tile.accent }}
                aria-hidden="true"
              />
              <div className="flex items-center justify-center w-20 h-20 rounded-lg bg-[#0a1428]/60 border border-[#1d3158]/80">
                <Visual />
              </div>
              <div>
                <span className="block text-lg sm:text-xl font-semibold text-white">{tile.label}</span>
                <span className="block text-xs sm:text-sm text-[#9bb6da] leading-relaxed mt-1.5">
                  {tile.subheadline}
                </span>
              </div>
              {isPicked && isLoading && (
                <span className="absolute inset-x-0 bottom-0 h-0.5 overflow-hidden" aria-hidden="true">
                  <span
                    className="block h-full w-1/3 animate-[fn-shimmer_1.4s_ease-in-out_infinite]"
                    style={{ background: tile.accent }}
                  />
                </span>
              )}
            </button>
          );
        })}
      </div>

      <style>{`
        @keyframes fn-shimmer {
          0%   { transform: translateX(-100%); }
          100% { transform: translateX(400%); }
        }
      `}</style>
    </div>
  );
}
