import { useEffect, useState } from 'react';
import AnimatedLogo from './AnimatedLogo.jsx';
import { hapticMedium } from '../utils/native.js';
import { ChalkBottle, ChalkLoader, LabArt, WINE_RED } from './chalkArt.jsx';
import { ACCENT, SANS } from './inventUi.jsx';
import { COCKTAIL_SPIRIT_COLORS } from '../data/cocktailBaseSpirit.js';
import { getConsent, subscribeConsent } from '../data/usage.js';
import {
  FONT, CHALK_CREAM, CHALK_DIM, CHALK_RAIL, CHALK_SHADOW, chalkSurfaceStyle,
} from '../data/chalkTheme.js';

/**
 * LandingScreen (LOOK-5) — the front page. The logo, then a modest back-bar shelf under it; under it a one-line promise; then the six labs as a
 * written menu board (name in the chalk hand, one steady line under it, a chalk
 * rule between rows). The menu is the one way in: the shelf drawings are
 * decorative and take no taps.
 *
 * Doubles as the loading surface: when `isLoading` is true after a pick, the
 * picked row's underline turns to the accent and a chalk glass fills in where
 * the line was; the other rows dim and wait.
 */

// The labs; the Recipe Lab (what's in your kitchen) leads. `art` is the chalkArt
// LabArt id; `ink` is the drawing's tint, chosen by what it shows, not by lab.
export const LAB_TILES = [
  { id: 'make',     label: 'Recipe Lab',   subheadline: 'Cook from your kitchen, or invent', art: 'recipe',   ink: CHALK_DIM },
  { id: 'cocktail', label: 'Cocktail Lab', subheadline: 'Mix, riff or invent a drink',       art: 'cocktail', ink: CHALK_CREAM },
  { id: 'sauce',    label: 'Sauce Lab',    subheadline: 'The mother sauces and beyond',      art: 'sauce',    ink: CHALK_CREAM },
  { id: 'wine',     label: 'Wine Lab',     subheadline: 'A wine for any dish',               art: 'wine',     ink: WINE_RED },
  { id: 'cookbook', label: 'Cookbook',     subheadline: '83 dishes, start to finish',        art: 'cookbook', ink: CHALK_DIM },
  { id: 'pairing',  label: 'Pairing Lab',  subheadline: 'What goes with what',               art: 'pairing',  ink: CHALK_DIM },
];
const TILES = LAB_TILES;

const BOTTLE_LABEL = { rum: 'Rum', vermouth: 'Vermouth', vodka: 'Vodka', whiskey: 'Whiskey', gin: 'Gin' };

// A bottle on the shelf. `cls` carries its size and the lift that puts its base
// on the shelf line (sizes are fractions of the logo's height, --u).
function ShelfBottle({ spirit, cls }) {
  return (
    <ChalkBottle
      spirit={spirit}
      label={BOTTLE_LABEL[spirit]}
      active
      color={COCKTAIL_SPIRIT_COLORS[spirit]}
      className={`flex-none h-auto ${cls}`}
    />
  );
}

function ShelfArt({ art, cls }) {
  return (
    <span className={`flex-none block ${cls}`} aria-hidden="true">
      <LabArt id={art} size="100%" shelf={false} />
    </span>
  );
}

function Shelf() {
  return (
    <div
      className="relative w-full flex items-end justify-center mb-[10px] [--u:clamp(110px,38vw,135px)] md:[--u:220px]"
      data-testid="landing-shelf"
    >
      <div className="flex items-end flex-none" aria-hidden="true">
        <ShelfBottle spirit="rum" cls="md:hidden w-[calc(var(--u)*0.37)] -mr-[calc(var(--u)*0.05)] -ml-[calc(var(--u)*0.05)] mb-[calc(var(--u)*-0.041)]" />
        <ShelfBottle spirit="vodka" cls="hidden md:block w-[calc(var(--u)*0.32)] -mx-[calc(var(--u)*0.03)] mb-[calc(var(--u)*-0.032)]" />
        <ShelfBottle spirit="whiskey" cls="hidden md:block w-[calc(var(--u)*0.32)] -mx-[calc(var(--u)*0.03)] mb-[calc(var(--u)*-0.032)]" />
        <ShelfArt art="sauce" cls="w-[calc(var(--u)*0.318)] md:w-[calc(var(--u)*0.255)] mb-[calc(var(--u)*-0.032)] md:mb-[calc(var(--u)*-0.0255)]" />
      </div>
      <div className="flex items-end flex-none" aria-hidden="true">
        <ShelfArt art="cocktail" cls="w-[calc(var(--u)*0.297)] md:w-[calc(var(--u)*0.242)] mb-[calc(var(--u)*-0.03)] md:mb-[calc(var(--u)*-0.024)]" />
        <ShelfBottle spirit="vermouth" cls="md:hidden w-[calc(var(--u)*0.4)] -ml-[calc(var(--u)*0.05)] -mr-[calc(var(--u)*0.05)] mb-[calc(var(--u)*-0.044)]" />
        <ShelfBottle spirit="rum" cls="hidden md:block w-[calc(var(--u)*0.32)] -mx-[calc(var(--u)*0.03)] mb-[calc(var(--u)*-0.032)]" />
        <ShelfBottle spirit="gin" cls="hidden md:block w-[calc(var(--u)*0.29)] -mx-[calc(var(--u)*0.03)] mb-[calc(var(--u)*-0.032)]" />
      </div>
      <svg
        className="absolute left-0 right-0 top-full -mt-[2px] w-full h-[10px] overflow-visible pointer-events-none"
        viewBox="0 0 360 10"
        preserveAspectRatio="none"
        aria-hidden="true"
        focusable="false"
      >
        <path d="M3 2 Q90 1.1 180 2.3 T357 1.8" fill="none" stroke={CHALK_DIM} strokeOpacity="0.8" strokeWidth="3.5" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
        <path d="M9 6.6 Q90 7.3 180 6.4 T351 6.9" fill="none" stroke={CHALK_RAIL} strokeOpacity="0.7" strokeWidth="2" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
      </svg>
    </div>
  );
}

const RULES = [
  'M3 2.2 Q70 1 150 2.1 T297 1.6',
  'M3 2.2 Q79 1.9 150 2.1 T297 1.9',
  'M3 2.2 Q88 1 150 2.1 T297 2.2',
  'M3 2.2 Q97 1.9 150 2.1 T297 1.6',
  'M3 2.2 Q106 1 150 2.1 T297 1.9',
];

export default function LandingScreen({ onModeSelect, isLoading = false, picked = null }) {
  const [consent, setConsentState] = useState(() => getConsent());
  useEffect(() => subscribeConsent((v) => setConsentState(v)), []);

  const handleTile = (id) => {
    if (isLoading) return;
    hapticMedium();
    onModeSelect?.(id);
  };

  return (
    <div
      className="w-full h-full min-h-screen overflow-y-auto overflow-x-hidden"
      role="dialog"
      aria-modal="true"
      aria-labelledby="fn-landing-title"
      style={{ ...chalkSurfaceStyle(), '--sub': CHALK_DIM, '--hi': CHALK_CREAM }}
      data-testid="landing-screen"
    >
      <div className="mx-auto w-full max-w-[880px] flex flex-col items-center px-4 pb-[calc(env(safe-area-inset-bottom,0px)+24px)]">
        <h1 id="fn-landing-title" className="sr-only">Neural Flavor</h1>

        <div className="w-full flex items-center justify-center pt-[max(env(safe-area-inset-top),0.5rem)] h-[48vh] sm:h-[56vh] flex-shrink-0">
          <AnimatedLogo className="h-full w-auto max-w-full" />
        </div>

        <Shelf />

        {isLoading ? (
          <div className="mt-3 md:mt-4 min-h-[55px] md:min-h-[40px] flex items-center">
            <ChalkLoader compact label="Setting the table…" color={ACCENT} />
          </div>
        ) : (
          <p
            className="mt-3 md:mt-4 text-center text-[22px] md:text-[32px] leading-tight"
            style={{ color: CHALK_CREAM, fontFamily: FONT, textShadow: CHALK_SHADOW }}
          >
            <span className="whitespace-nowrap">Start with what you have.</span>{' '}
            <span className="whitespace-nowrap">Find what goes with it.</span>
          </p>
        )}

        <div className="relative w-full max-w-[480px] md:max-w-[880px] mt-6 md:mt-10">
          <svg
            className="hidden md:block absolute left-1/2 top-2 bottom-2 w-[4px] -ml-[2px] pointer-events-none"
            viewBox="0 0 4 200"
            preserveAspectRatio="none"
            aria-hidden="true"
            focusable="false"
          >
            <path d="M2 2 Q1.2 60 2.2 100 T1.8 198" fill="none" stroke={CHALK_RAIL} strokeWidth="1.4" vectorEffect="non-scaling-stroke" />
          </svg>
          <ul
            aria-label="The labs"
            className="list-none m-0 p-0 w-full md:grid md:grid-cols-2 md:grid-rows-3 md:grid-flow-col md:gap-x-16"
          >
            {TILES.map((tile, i) => {
              const isPicked = picked === tile.id;
              const dimmed = isLoading && !isPicked;
              const busy = isPicked && isLoading;
              return (
                <li key={tile.id}>
                  <button
                    type="button"
                    onClick={() => handleTile(tile.id)}
                    disabled={isLoading}
                    aria-busy={busy ? 'true' : undefined}
                    data-mode={tile.id}
                    aria-label={`${tile.label}. ${tile.subheadline}`}
                    className={`group grid grid-cols-[44px_1fr] md:grid-cols-[48px_1fr] items-center gap-x-3 md:gap-x-4 w-full min-h-[64px] md:min-h-[68px] px-1 py-2 text-left
                      ${dimmed ? 'opacity-40 cursor-wait' : 'cursor-pointer'}`}
                    data-testid={`landing-tile-${tile.id}`}
                  >
                    <span className="block w-11 h-11 md:w-12 md:h-12" aria-hidden="true">
                      <LabArt id={tile.art} accent={tile.ink} size="100%" />
                    </span>
                    <span className="flex flex-col gap-[2px] min-w-0">
                      <span
                        className="relative self-start text-[22px] md:text-[26px] leading-[1.15]"
                        style={{ fontFamily: FONT, color: CHALK_CREAM, textShadow: CHALK_SHADOW }}
                      >
                        {tile.label}
                        <svg
                          className={`absolute -left-[2px] -bottom-[5px] w-[calc(100%+4px)] h-[6px] ${busy ? 'opacity-100' : 'opacity-0 group-hover:opacity-80'}`}
                          style={{ color: busy ? ACCENT : CHALK_DIM }}
                          viewBox="0 0 100 6"
                          preserveAspectRatio="none"
                          aria-hidden="true"
                          focusable="false"
                        >
                          <path d="M2 3.6 Q30 1.6 60 3 T98 2.4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
                        </svg>
                      </span>
                      <span
                        className="text-base leading-[1.3] text-[color:var(--sub)] group-hover:text-[color:var(--hi)]"
                        style={{ fontFamily: SANS }}
                      >
                        {tile.subheadline}
                      </span>
                    </span>
                  </button>
                  {i < TILES.length - 1 && (
                    <svg
                      className={`block w-full h-[4px] ${i === 2 ? 'md:hidden' : ''}`}
                      viewBox="0 0 300 4"
                      preserveAspectRatio="none"
                      aria-hidden="true"
                      focusable="false"
                    >
                      <path d={RULES[i]} fill="none" stroke={CHALK_RAIL} strokeWidth="1.4" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
                    </svg>
                  )}
                </li>
              );
            })}
          </ul>
        </div>

        {consent === null && (
          <div style={{ height: 216 }} aria-hidden="true" data-testid="landing-consent-spacer" />
        )}
      </div>
    </div>
  );
}
