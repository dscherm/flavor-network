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
    <svg viewBox="0 0 100 100" className="w-full h-full" aria-hidden="true">
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
    <svg viewBox="0 0 100 100" className="w-full h-full" aria-hidden="true">
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

function MakeVisual() {
  // B-version P5 — pot with glowing balls (per spec restore).
  // Cylindrical pot with rim + handles; 4 luminous balls inside echo
  // the NeuFlavor ingredient nodes glowing in their broth.
  return (
    <svg viewBox="0 0 100 100" className="w-full h-full" aria-hidden="true">
      {/* Pot body */}
      <rect
        x="20" y="42" width="60" height="42" rx="4"
        fill="rgba(167,139,250,0.16)" stroke="rgb(167,139,250)" strokeWidth="2"
      />
      {/* Rim */}
      <rect
        x="16" y="38" width="68" height="8" rx="2"
        fill="rgba(167,139,250,0.30)" stroke="rgb(167,139,250)" strokeWidth="2"
      />
      {/* Handles */}
      <path d="M 16 50 Q 10 50 10 58 Q 10 64 16 64"
        fill="none" stroke="rgb(167,139,250)" strokeWidth="2" strokeLinecap="round" />
      <path d="M 84 50 Q 90 50 90 58 Q 90 64 84 64"
        fill="none" stroke="rgb(167,139,250)" strokeWidth="2" strokeLinecap="round" />
      {/* Glowing balls */}
      <circle cx="34" cy="62" r="4" fill="rgb(125,186,94)"
        className="motion-safe:animate-pulse"
        style={{ filter: 'drop-shadow(0 0 6px rgba(125,186,94,0.95))', animationDelay: '0s', animationDuration: '2.4s' }} />
      <circle cx="50" cy="58" r="4.5" fill="rgb(245,158,11)"
        className="motion-safe:animate-pulse"
        style={{ filter: 'drop-shadow(0 0 6px rgba(245,158,11,0.95))', animationDelay: '0.4s', animationDuration: '2.4s' }} />
      <circle cx="66" cy="64" r="4" fill="rgb(236,72,153)"
        className="motion-safe:animate-pulse"
        style={{ filter: 'drop-shadow(0 0 6px rgba(236,72,153,0.95))', animationDelay: '0.8s', animationDuration: '2.4s' }} />
      <circle cx="44" cy="72" r="3.5" fill="rgb(6,182,212)"
        className="motion-safe:animate-pulse"
        style={{ filter: 'drop-shadow(0 0 5px rgba(6,182,212,0.95))', animationDelay: '1.2s', animationDuration: '2.4s' }} />
      {/* Steam wisps */}
      <path d="M 36 34 Q 32 28 36 22" fill="none" stroke="rgba(167,139,250,0.55)" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M 50 32 Q 46 26 50 20" fill="none" stroke="rgba(167,139,250,0.55)" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M 64 34 Q 60 28 64 22" fill="none" stroke="rgba(167,139,250,0.55)" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

function _RemovedLegacyChefHatVisual() {
  return (
    <svg viewBox="0 0 100 100" className="w-full h-full" aria-hidden="true">
      {/* (kept only to swallow the dangling chef-hat SVG below — not rendered) */}
      <line x1="30" y1="72" x2="68" y2="72" stroke="rgba(167,139,250,0.35)" strokeWidth="1.2" />
      {/* Chef's hat */}
      <path
        d="M 32 36 Q 26 36 26 30 Q 26 22 34 22 Q 36 14 50 14 Q 64 14 66 22 Q 74 22 74 30 Q 74 36 68 36 Z"
        fill="rgba(244,114,182,0.22)" stroke="rgb(244,114,182)" strokeWidth="2"
      />
      {/* Hat band */}
      <line x1="32" y1="36" x2="68" y2="36" stroke="rgb(244,114,182)" strokeWidth="2" />
      {/* Spark/star on the hat — "you make it" cue */}
      <circle cx="50" cy="26" r="2"
        fill="rgb(244,114,182)"
        style={{ filter: 'drop-shadow(0 0 4px rgba(244,114,182,0.9))' }}
      />
    </svg>
  );
}

// B-version P5 — spec'd order: Guided (1) → Make (2) → Network (3).
const TILES = [
  {
    id: 'guided',
    label: 'Guided Discovery',
    subheadline: 'You want a guided tour to discover ways of exploring ingredient pairings and why they pair well.',
    accent: '#34d399',
    Visual: GuidedVisual,
  },
  {
    id: 'make',
    label: 'Make a recipe',
    subheadline: 'Start a recipe from scratch, from a photo, or from a saved Cookbook recipe.',
    accent: '#a78bfa',
    Visual: MakeVisual,
  },
  {
    id: 'pairing', // routes to existing 'network' tab — preserves activeTab wiring
    label: 'Explore the Network',
    subheadline: "You're ready to poke around the NeuFlavor Network model without guidance to explore all kinds of ways of pairing ingredients.",
    accent: '#4f8fff',
    Visual: PairingVisual,
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
      className="flex flex-col items-center w-full min-h-screen max-h-screen px-4 pb-4 sm:pb-8 overflow-hidden"
      role="dialog"
      aria-modal="true"
      aria-labelledby="fn-landing-title"
      style={{
        // B-version P5 — chalkboard chrome (near-black slate radial wash).
        background: 'radial-gradient(ellipse at center, #1c1c1c 0%, #0a0a0a 75%, #050505 100%), #0a0a0a',
      }}
      data-testid="landing-screen"
    >
      <h1 id="fn-landing-title" className="sr-only">Neural Flavor</h1>

      {/* Top — animated logo. B-version (2026-06-03): shrunk to 32vh
          on small viewports + flex-shrink so the 3 tile buttons
          guaranteed-fit beneath the logo on iOS portrait. */}
      <div className="w-full flex items-center justify-center pt-[max(env(safe-area-inset-top),0.5rem)] h-[32vh] sm:h-[50vh] flex-shrink-0">
        <AnimatedLogo className="h-full w-auto max-w-full" />
      </div>

      {/* Tagline directly below the logo */}
      <p
        className="text-center text-sm sm:text-xl max-w-xl mt-1 sm:mt-2 mb-2 sm:mb-6 leading-snug flex-shrink-0"
        style={{
          color: '#bdb6a3',
          fontFamily: 'Caveat, cursive',
          textShadow: '0 0 1px rgba(245,239,222,0.45), 0 0 3px rgba(245,239,222,0.18)',
        }}
      >
        Built on 2.2M recipes, 48,588 pairings, and real molecular chemistry.
      </p>

      {/* 3 primary tiles. iOS portrait shows them stacked at compact
          height; sm+ goes to 3-up. flex-1 + min-h-0 lets the grid
          consume the remaining viewport. */}
      <div className="w-full max-w-5xl grid grid-cols-1 sm:grid-cols-3 gap-2 sm:gap-4 flex-1 min-h-0 pb-[env(safe-area-inset-bottom,0px)]">
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
              className={`group relative flex flex-row sm:flex-col items-stretch sm:items-center text-left sm:text-center gap-3 sm:gap-2 rounded-xl p-3 sm:px-[5px] sm:pt-[5px] sm:pb-3 min-h-[88px] transition-all overflow-hidden focus:outline-none
                ${dimmed ? 'opacity-40 cursor-wait' : 'hover:brightness-110'}
              `}
              style={{
                // Chalkboard tile: double chalk-rail border + slate wash.
                background: 'radial-gradient(ellipse at center, #1c1c1c 0%, #0e0e0e 100%)',
                border: `2px double ${isPicked ? tile.accent : '#4a4a4a'}`,
                boxShadow: isPicked
                  ? `inset 0 0 0 1px #6a6a6a55, 0 0 24px ${tile.accent}55`
                  : 'inset 0 0 0 1px #6a6a6a55, 0 8px 24px rgba(0,0,0,0.55)',
              }}
              data-testid={`landing-tile-${tile.id}`}
            >
              <span
                className="absolute left-0 top-0 bottom-0 w-1"
                style={{ background: tile.accent }}
                aria-hidden="true"
              />
              <div
                className="flex items-center justify-center rounded-lg flex-shrink-0 aspect-square h-full sm:h-auto sm:w-[82%] p-2 sm:p-1.5"
                style={{
                  background: 'rgba(255,255,255,0.025)',
                  border: `1px solid #6a6a6a55`,
                }}
              >
                <Visual />
              </div>
              <div className="flex-1 min-w-0 flex flex-col justify-center sm:px-2 sm:pb-1">
                <span
                  className="block text-2xl sm:text-3xl leading-tight"
                  style={{
                    color: '#f5efde',
                    fontFamily: 'Caveat, cursive',
                    textShadow: '0 0 1px rgba(245,239,222,0.55), 0 0 3px rgba(245,239,222,0.22)',
                  }}
                >
                  {tile.label}
                </span>
                <span
                  className="block text-sm sm:text-base leading-snug mt-0.5 sm:mt-1.5 line-clamp-2 sm:line-clamp-3"
                  style={{
                    color: '#bdb6a3',
                    fontFamily: 'Caveat, cursive',
                    textShadow: '0 0 1px rgba(245,239,222,0.45), 0 0 3px rgba(245,239,222,0.18)',
                  }}
                >
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
