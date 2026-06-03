/**
 * GuidedDiscoveryFocalPicker — chalkboard-styled Screen 1 of the
 * B-version Guided Discovery flow.
 *
 * The user picks a focal ingredient via:
 *   - a search bar (substring match on ingredient name)
 *   - OR a "Pick for me" button (random ingredient with pairings)
 *
 * Once a focal is picked, the parent (App.jsx) routes to the PairingMode
 * Tinder browser as Screen 2. Inside PairingMode the user can swipe
 * through pairings AND tap a "Discover where these flavor pairings
 * come from" button that re-enters the older radar/α-mode discovery
 * flow (Screen 3 = the existing GuidedDiscoveryResults).
 */

import React, { useMemo, useState } from 'react';

const FONT_HAND = 'Caveat, cursive';
const CHALK_BG = `
  radial-gradient(ellipse at center, #1c1c1c 0%, #0a0a0a 75%, #050505 100%),
  #0a0a0a
`;
const CHALK_BORDER_INNER = '#6a6a6a';
const CHALK_CREAM = '#f5efde';
const CHALK_DIM = '#bdb6a3';
const CHALK_SUB = '#8a8478';
const CHALK_TEXT_SHADOW = '0 0 1px rgba(245,239,222,0.55), 0 0 3px rgba(245,239,222,0.22)';

// "Pick an ingredient for me" only chooses from the top-pairing
// ingredients (per user 2026-06-03 — random picks were landing on
// long-tail ingredients where the next-screen PairingMode looked
// sparse). Top 200 by pairingCount.
const RANDOM_POOL_TOP_N = 200;

export default function GuidedDiscoveryFocalPicker({
  ingredients = [],
  onPickFocal,
  onClose,
}) {
  const [query, setQuery] = useState('');

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    const out = [];
    for (const ing of ingredients) {
      const name = typeof ing === 'string' ? ing : ing?.name;
      if (!name) continue;
      if (name.toLowerCase().includes(q)) {
        out.push(name);
        if (out.length >= 8) break;
      }
    }
    return out;
  }, [query, ingredients]);

  const pickRandom = () => {
    // Rank by pairingCount desc, take top N, then random-pick from that
    // set. Ensures "Pick for me" always lands on a well-connected
    // ingredient with a rich Tinder stack to swipe.
    const ranked = ingredients
      .map((ing) => ({
        name: typeof ing === 'string' ? ing : ing?.name,
        pc: typeof ing === 'string' ? 0 : (ing?.pairingCount || 0),
      }))
      .filter((x) => x.name)
      .sort((a, b) => b.pc - a.pc)
      .slice(0, RANDOM_POOL_TOP_N);
    if (ranked.length === 0) return;
    const pick = ranked[Math.floor(Math.random() * ranked.length)];
    if (pick?.name) onPickFocal?.(pick.name);
  };

  return (
    <div
      className="fixed inset-0 z-[40] flex flex-col items-center px-4 py-6 overflow-y-auto"
      style={{ background: CHALK_BG }}
      data-testid="guided-focal-picker"
    >
      <div
        className="w-full max-w-xl rounded-2xl px-5 py-6 flex flex-col items-center gap-4"
        style={{
          background: 'rgba(255,255,255,0.02)',
          border: `2px double #4a4a4a`,
          boxShadow: 'inset 0 0 0 1px #6a6a6a55',
        }}
      >
        <div className="w-full flex items-start justify-between">
          <h2
            className="text-2xl sm:text-3xl"
            style={{ color: CHALK_CREAM, fontFamily: FONT_HAND, textShadow: CHALK_TEXT_SHADOW }}
          >
            Guided Discovery
          </h2>
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              data-testid="guided-focal-close"
              aria-label="Close Guided Discovery"
              style={{
                color: CHALK_DIM,
                fontFamily: FONT_HAND,
                fontSize: 22,
                background: 'transparent',
                border: 'none',
                padding: '0 6px',
                cursor: 'pointer',
              }}
            >
              ×
            </button>
          )}
        </div>

        <p
          className="text-center text-base sm:text-lg"
          style={{ color: CHALK_DIM, fontFamily: FONT_HAND, textShadow: CHALK_TEXT_SHADOW }}
        >
          Pick an ingredient to start swiping its pairings.
        </p>

        <div className="w-full flex flex-col gap-2">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search for an ingredient…"
            data-testid="guided-focal-search"
            className="w-full px-3 py-2 rounded-md outline-none"
            style={{
              background: 'rgba(255,255,255,0.04)',
              border: `1px solid ${CHALK_BORDER_INNER}`,
              color: CHALK_CREAM,
              fontFamily: FONT_HAND,
              fontSize: 20,
              textShadow: CHALK_TEXT_SHADOW,
            }}
          />
          {matches.length > 0 && (
            <div
              className="rounded-md max-h-64 overflow-y-auto"
              style={{
                background: 'rgba(255,255,255,0.02)',
                border: `1px solid ${CHALK_BORDER_INNER}55`,
              }}
              data-testid="guided-focal-matches"
            >
              {matches.map((name) => (
                <button
                  key={name}
                  type="button"
                  onClick={() => onPickFocal?.(name)}
                  data-testid={`guided-focal-match-${name}`}
                  className="w-full text-left px-3 py-2 hover:bg-white/5"
                  style={{
                    color: CHALK_CREAM,
                    fontFamily: FONT_HAND,
                    fontSize: 18,
                    textShadow: CHALK_TEXT_SHADOW,
                    borderBottom: `1px solid ${CHALK_BORDER_INNER}33`,
                  }}
                >
                  {name}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="w-full flex items-center gap-3">
          <div
            className="flex-1 h-px"
            style={{ background: `${CHALK_BORDER_INNER}55` }}
            aria-hidden="true"
          />
          <span
            style={{ color: CHALK_SUB, fontFamily: FONT_HAND, fontSize: 14, textShadow: CHALK_TEXT_SHADOW }}
          >
            or
          </span>
          <div
            className="flex-1 h-px"
            style={{ background: `${CHALK_BORDER_INNER}55` }}
            aria-hidden="true"
          />
        </div>

        <button
          type="button"
          onClick={pickRandom}
          data-testid="guided-focal-pick-for-me"
          className="w-full rounded-md py-3 px-4"
          style={{
            color: '#bbf7d0',
            background: 'rgba(16, 78, 51, 0.55)',
            border: '1.5px solid rgba(110, 231, 183, 0.45)',
            fontFamily: FONT_HAND,
            fontSize: 20,
            textShadow: CHALK_TEXT_SHADOW,
          }}
        >
          Pick an ingredient for me
        </button>
      </div>
    </div>
  );
}
