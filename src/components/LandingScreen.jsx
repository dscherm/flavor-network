import AnimatedLogo from './AnimatedLogo.jsx';
import { hapticMedium } from '../utils/native.js';

/**
 * LandingScreen — permanent landing surface. Top half = animated brand
 * mark + tagline. Bottom half = four primary tiles (Network, Cocktail
 * Lab, Sauce Lab, Recipe Lab) each with a per-mode visual glyph.
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
    <svg viewBox="0 0 100 100" className="w-16 h-16" aria-hidden="true">
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

function CocktailVisual() {
  return (
    <svg viewBox="0 0 100 100" className="w-16 h-16" aria-hidden="true">
      <path
        d="M 22 22 L 78 22 L 54 56 L 46 56 Z"
        fill="rgba(167,139,250,0.18)" stroke="rgb(167,139,250)" strokeWidth="2"
      />
      <line x1="50" y1="56" x2="50" y2="80" stroke="rgb(167,139,250)" strokeWidth="2" />
      <line x1="34" y1="80" x2="66" y2="80" stroke="rgb(167,139,250)" strokeWidth="2" />
      <circle cx="44" cy="44" r="3.5" fill="rgb(125,186,94)"
        style={{ filter: 'drop-shadow(0 0 4px rgba(125,186,94,0.8))' }}
      />
      <line x1="28" y1="30" x2="72" y2="30" stroke="rgba(167,139,250,0.4)" strokeWidth="1" />
    </svg>
  );
}

function SauceVisual() {
  return (
    <svg viewBox="0 0 100 100" className="w-16 h-16" aria-hidden="true">
      <path
        d="M 22 38 L 78 38 L 74 76 Q 74 84 66 84 L 34 84 Q 26 84 26 76 Z"
        fill="rgba(251,191,36,0.20)" stroke="rgb(251,191,36)" strokeWidth="2"
      />
      <rect x="78" y="44" width="14" height="4" rx="1.5" fill="rgb(251,191,36)" />
      <ellipse cx="50" cy="42" rx="26" ry="3.5" fill="rgba(217,74,61,0.6)" />
      <path
        d="M 36 42 Q 42 40 50 42 Q 58 44 64 42"
        fill="none" stroke="rgba(255,255,255,0.5)" strokeWidth="0.8"
      />
      <path
        d="M 40 22 Q 44 18 40 14 Q 36 10 40 6"
        fill="none" stroke="rgba(251,191,36,0.4)" strokeWidth="1.4"
        className="motion-safe:animate-pulse"
        style={{ animationDuration: '3s' }}
      />
      <path
        d="M 56 22 Q 60 18 56 14 Q 52 10 56 6"
        fill="none" stroke="rgba(251,191,36,0.4)" strokeWidth="1.4"
        className="motion-safe:animate-pulse"
        style={{ animationDuration: '3s', animationDelay: '0.8s' }}
      />
    </svg>
  );
}

function GuidedVisual() {
  // Stylised thought bubble with a small spark inside — visual cue
  // for the Guided Discovery flow (you tell us what you're cooking,
  // we surface the matching pairings).
  return (
    <svg viewBox="0 0 100 100" className="w-16 h-16" aria-hidden="true">
      {/* Main thought bubble */}
      <path
        d="M 26 28 Q 26 18 38 18 L 70 18 Q 82 18 82 30 Q 82 42 70 42 L 50 42 L 38 56 L 38 42 Q 26 42 26 30 Z"
        fill="rgba(52,211,153,0.18)" stroke="rgb(52,211,153)" strokeWidth="2"
      />
      {/* Trailing dots leading to the thought */}
      <circle cx="32" cy="68" r="3" fill="rgba(52,211,153,0.6)" />
      <circle cx="22" cy="78" r="2" fill="rgba(52,211,153,0.45)" />
      <circle cx="14" cy="86" r="1.4" fill="rgba(52,211,153,0.3)" />
      {/* Spark / question inside the bubble */}
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

function RecipeVisual() {
  // Open notebook: two-page spread, three lines on each page
  // suggesting recipe text + a small pencil overlay.
  return (
    <svg viewBox="0 0 100 100" className="w-16 h-16" aria-hidden="true">
      {/* Left page */}
      <path
        d="M 14 22 Q 14 18 18 18 L 50 22 L 50 84 L 18 80 Q 14 80 14 76 Z"
        fill="rgba(56,189,248,0.14)" stroke="rgb(56,189,248)" strokeWidth="2"
      />
      {/* Right page */}
      <path
        d="M 86 22 Q 86 18 82 18 L 50 22 L 50 84 L 82 80 Q 86 80 86 76 Z"
        fill="rgba(56,189,248,0.10)" stroke="rgb(56,189,248)" strokeWidth="2"
      />
      {/* Center binding */}
      <line x1="50" y1="22" x2="50" y2="84" stroke="rgb(56,189,248)" strokeWidth="1.5" />
      {/* Recipe lines — left page */}
      <line x1="22" y1="36" x2="44" y2="37" stroke="rgba(255,255,255,0.6)" strokeWidth="1.2" />
      <line x1="22" y1="46" x2="44" y2="47" stroke="rgba(255,255,255,0.45)" strokeWidth="1" />
      <line x1="22" y1="56" x2="40" y2="57" stroke="rgba(255,255,255,0.45)" strokeWidth="1" />
      {/* Recipe lines — right page */}
      <line x1="56" y1="37" x2="78" y2="36" stroke="rgba(255,255,255,0.45)" strokeWidth="1" />
      <line x1="56" y1="47" x2="78" y2="46" stroke="rgba(255,255,255,0.45)" strokeWidth="1" />
      <line x1="56" y1="57" x2="74" y2="56" stroke="rgba(255,255,255,0.45)" strokeWidth="1" />
      {/* Pencil */}
      <g transform="rotate(28 70 72)">
        <rect x="60" y="68" width="20" height="3" rx="0.5" fill="rgb(255,193,76)" />
        <path d="M 80 68 L 84 69.5 L 80 71 Z" fill="rgb(120,80,30)" />
        <rect x="58" y="68" width="3" height="3" fill="rgb(245,108,108)" />
      </g>
    </svg>
  );
}

const TILES = [
  {
    id: 'guided',
    label: 'Guided Discovery',
    description: 'Tell us what you’re cooking; we’ll find the pairings.',
    accent: '#34d399',
    Visual: GuidedVisual,
  },
  {
    id: 'pairing',
    label: 'Explore the NeuFlavor Network',
    description: '3,913 ingredients · 48,588 pairings, clustered by chemistry.',
    accent: '#4f8fff',
    Visual: PairingVisual,
  },
  {
    id: 'cocktail',
    label: 'Cocktail Lab',
    description: '441 cocktails across 6 clusters.',
    accent: '#a78bfa',
    Visual: CocktailVisual,
  },
  {
    id: 'sauce',
    label: 'Sauce Lab',
    description: '77 sauces across the 10 mother families.',
    accent: '#fbbf24',
    Visual: SauceVisual,
  },
  {
    id: 'recipe',
    label: 'Recipe Lab',
    description: 'Build a recipe with live pairing-strength + GNN-aroma scoring.',
    accent: '#38bdf8',
    Visual: RecipeVisual,
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

      {/* Five primary tiles in the bottom half. Grid columns scale
          1 → 2 → 3 → 5 across breakpoints so the new Guided Discovery
          card fits without forcing a partial bottom row on desktop. */}
      <div className="w-full max-w-5xl grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-3 sm:gap-4">
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
              aria-label={`${tile.label}. ${tile.description}`}
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
              <div className="flex items-center justify-center w-16 h-16 rounded-lg bg-[#0a1428]/60 border border-[#1d3158]/80">
                <Visual />
              </div>
              <div>
                <span className="block text-base sm:text-lg font-medium text-white">{tile.label}</span>
                <span className="block text-xs text-[#9bb6da] leading-relaxed mt-1">{tile.description}</span>
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
