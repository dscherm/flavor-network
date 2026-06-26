/**
 * PairingMode — Tinder-stack swipe browser for an ingredient's pairings
 * (B-version spec §PAIRING-MODE-TINDER).
 *
 * Replaces double-click-to-α as the way users inspect an ingredient
 * from Network mode. Single-tap a node → opens PairingMode focused on
 * that node. Back button exits → returns to Network.
 *
 * Four-direction interaction (works as touch-swipes AND on-screen
 * arrow buttons in B-version so review without touch device is easy):
 *   - LEFT  = peel top card → next pairing in stack
 *   - RIGHT = rotate highlighted spoke within current radar
 *             (cycles through axes of the active filter)
 *   - UP    = cycle filter category up
 *             (taste → aroma → season → cuisine → taste)
 *   - DOWN  = cycle filter category down
 *
 * Next-card ordering is RADAR-FILTER-AWARE: when chosenAxis is set,
 * the stack contains only focal-pairings that match that inner axis.
 * Switching filter or rotating spoke rebuilds the stack.
 *
 * Card-stack rendering: top card is full-opacity; cards 2-3 peek
 * behind with reduced scale + opacity for the Tinder feel.
 */

import { useEffect, useMemo, useState, useRef, useCallback } from 'react';
import {
  getAxesFor,
  pairingMatchesAxis,
} from '../data/guidedRadarAxes.js';
import { getNeighborsEnriched } from '../data/graph.js';
import PairingModeCard from './PairingModeCard.jsx';
import { hydrateNode, buildAnalysis, sharedCompoundsFor } from '../data/pairingCardData.js';

const FILTER_CYCLE = ['taste', 'aroma', 'season', 'cuisine'];
const SWIPE_THRESHOLD = 50;


export default function PairingMode({
  focal,
  ctx,
  odorThresholds = null,
  onExit,
  onDiscover = null,
}) {
  const [filterType, setFilterType] = useState('taste');
  const [chosenAxis, setChosenAxis] = useState(null);
  const [cardIdx, setCardIdx] = useState(0);

  const focalName = typeof focal === 'string' ? focal : focal?.name;

  // Shared-compound lookup uses two sources:
  //   1. ctx.bridgeCompoundIndex (curated bridge_compounds.json, 771
  //      entries — chef-validated bridges with rarity scores).
  //   2. GNN top-5 compound intersection (fallback when curated bridge
  //      is missing). bridge_compounds only covers 1.6% of pairs, so
  //      most ingredients fall through to the GNN intersection. Each
  //      node carries `gnnCompounds.top_compounds: [{name,...}, ...]`.
  const allPairings = useMemo(() => {
    if (!focalName || !ctx?.graph?.edges) return [];
    const focalNode = hydrateNode(focalName, ctx);
    try {
      const list = getNeighborsEnriched(
        focalName,
        ctx.graph.edges,
        ctx?.cuisineNeighborIndex || null,
      );
      const corpus = list
        .map((p) => {
          const node = hydrateNode(p.name, ctx);
          const strength = typeof p.strength === 'number' ? p.strength : 0;
          const sharedCompounds = sharedCompoundsFor(focalName, focalNode, p.name, node, ctx);
          const fb = ctx?.flavorBibleSet?.has(
            focalName < p.name ? `${focalName}|${p.name}` : `${p.name}|${focalName}`,
          ) ?? false;
          return {
            name: p.name,
            strength,
            node,
            sharedCompounds,
            fb,
            analysis: buildAnalysis(focalNode, node, strength, sharedCompounds),
          };
        })
        .filter((p) => p.node && p.node.name);

      // Append Flavor Bible pairings the recipe corpus never recorded
      // (~82% of FB pairs have no co-occurrence edge). They carry
      // strength 0 so they sit at the end of the swipe deck — after every
      // corpus pair — and ride the 📖 badge via fb:true. Only those that
      // hydrate to a real graph node are kept. Sorted for deterministic
      // deck order.
      const fbNeighbors = ctx?.flavorBibleNeighbors?.get?.(focalName);
      if (Array.isArray(fbNeighbors) && fbNeighbors.length > 0) {
        const seen = new Set(corpus.map((p) => p.name));
        const fbOnly = [];
        for (const name of [...fbNeighbors].sort()) {
          if (!name || name === focalName || seen.has(name)) continue;
          seen.add(name);
          const node = hydrateNode(name, ctx);
          if (!node || !node.name) continue;
          const sharedCompounds = sharedCompoundsFor(focalName, focalNode, name, node, ctx);
          fbOnly.push({
            name,
            strength: 0,
            node,
            sharedCompounds,
            fb: true,
            analysis: buildAnalysis(focalNode, node, 0, sharedCompounds),
          });
        }
        return [...corpus, ...fbOnly];
      }
      return corpus;
    } catch {
      return [];
    }
  }, [focalName, ctx]);

  const filteredStack = useMemo(() => {
    if (chosenAxis == null) return allPairings;
    return allPairings.filter((p) =>
      pairingMatchesAxis(p.node, filterType, chosenAxis, odorThresholds),
    );
  }, [allPairings, filterType, chosenAxis, odorThresholds]);

  useEffect(() => {
    setCardIdx(0);
  }, [filterType, chosenAxis, focalName]);

  const rotateSpoke = useCallback(() => {
    const axes = getAxesFor(filterType);
    if (!axes || axes.length === 0) return;
    if (chosenAxis == null) {
      setChosenAxis(axes[0]);
    } else {
      const i = axes.indexOf(chosenAxis);
      const next = axes[(i + 1) % axes.length];
      setChosenAxis(next);
    }
  }, [filterType, chosenAxis]);

  const cycleFilter = useCallback((dir) => {
    setChosenAxis(null);
    const i = FILTER_CYCLE.indexOf(filterType);
    const n = FILTER_CYCLE.length;
    const next = FILTER_CYCLE[(i + (dir === 'up' ? 1 : n - 1)) % n];
    setFilterType(next);
  }, [filterType]);

  const nextCard = useCallback(() => {
    if (filteredStack.length === 0) return;
    setCardIdx((idx) => (idx + 1 < filteredStack.length ? idx + 1 : idx));
  }, [filteredStack.length]);

  // Unified pointer handler covers BOTH touch and mouse drag (B-version
  // P3 fix per user feedback). We track start pos on pointerdown and
  // dispatch a swipe action on pointerup if the delta exceeds the
  // SWIPE_THRESHOLD on either axis.
  const dragStartRef = useRef(null);
  const dispatchSwipe = useCallback((dx, dy) => {
    const absDx = Math.abs(dx);
    const absDy = Math.abs(dy);
    if (absDx < SWIPE_THRESHOLD && absDy < SWIPE_THRESHOLD) return;
    if (absDx > absDy) {
      if (dx < 0) nextCard();
      else rotateSpoke();
    } else {
      if (dy < 0) cycleFilter('up');
      else cycleFilter('down');
    }
  }, [nextCard, rotateSpoke, cycleFilter]);
  const onTouchStart = (e) => {
    const t = e.touches?.[0];
    if (!t) return;
    dragStartRef.current = { x: t.clientX, y: t.clientY, kind: 'touch' };
  };
  const onTouchEnd = (e) => {
    const start = dragStartRef.current;
    dragStartRef.current = null;
    if (!start || start.kind !== 'touch') return;
    const t = (e.changedTouches?.[0]) || null;
    if (!t) return;
    dispatchSwipe(t.clientX - start.x, t.clientY - start.y);
  };
  const onMouseDown = (e) => {
    // Don't capture clicks on buttons — let them act normally.
    if (e.target?.closest?.('button')) return;
    dragStartRef.current = { x: e.clientX, y: e.clientY, kind: 'mouse' };
  };
  const onMouseUp = (e) => {
    const start = dragStartRef.current;
    dragStartRef.current = null;
    if (!start || start.kind !== 'mouse') return;
    dispatchSwipe(e.clientX - start.x, e.clientY - start.y);
  };

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'ArrowLeft') { e.preventDefault(); nextCard(); }
      else if (e.key === 'ArrowRight') { e.preventDefault(); rotateSpoke(); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); cycleFilter('up'); }
      else if (e.key === 'ArrowDown') { e.preventDefault(); cycleFilter('down'); }
      else if (e.key === 'Escape') { e.preventDefault(); onExit?.(); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [nextCard, rotateSpoke, cycleFilter, onExit]);

  const topCard = filteredStack[cardIdx] || null;
  const peekCards = filteredStack.slice(cardIdx + 1, cardIdx + 3);

  return (
    <div
      className="fixed inset-0 z-[80] flex flex-col items-center bg-[#0a0a0f] px-4 py-4 sm:py-6 overflow-hidden"
      data-testid="pairing-mode"
      data-focal={focalName || ''}
      data-filter-type={filterType}
      data-chosen-axis={chosenAxis || ''}
      data-card-idx={cardIdx}
      data-stack-size={filteredStack.length}
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
      onMouseDown={onMouseDown}
      onMouseUp={onMouseUp}
    >
      <div className="w-full max-w-[min(32rem,92vw)] flex items-center justify-between mb-2">
        <button
          type="button"
          onClick={() => onExit?.()}
          data-testid="pairing-mode-back"
          className="px-3 py-2 rounded-lg text-sm text-gray-200 bg-[#13243d] border border-[#1d3158] hover:bg-[#1a2f4a]"
          aria-label="Exit Pairing Mode"
        >
          ← Back
        </button>
        <div className="text-xs text-gray-400 text-right">
          <span data-testid="pairing-mode-progress">
            {filteredStack.length === 0
              ? '0/0'
              : `${Math.min(cardIdx + 1, filteredStack.length)}/${filteredStack.length}`}
          </span>
          <span className="mx-2 text-gray-600">·</span>
          <span className="capitalize">{filterType}</span>
          {chosenAxis && (
            <>
              <span className="mx-2 text-gray-600">·</span>
              <span className="text-cyan-300">leaning {String(chosenAxis).toLowerCase()}</span>
            </>
          )}
        </div>
      </div>

      <h2
        className="text-lg sm:text-xl font-medium text-gray-100 text-center mb-2 capitalize"
        data-testid="pairing-mode-title"
      >
        {focalName ? `${focalName} pairs well with…` : 'Pairs'}
      </h2>

      <div className="relative flex-1 flex items-start justify-center w-full min-h-0">
        {filteredStack.length === 0 ? (
          <div
            className="w-full max-w-[min(32rem,92vw)] bg-[#0a1428] border border-[#1d3158] rounded-2xl px-6 py-12 text-center text-sm text-gray-400"
            data-testid="pairing-mode-empty"
          >
            No pairings match this filter.
            {chosenAxis ? ' Tap → to rotate the spoke or ↑/↓ to switch filters.' : ''}
          </div>
        ) : (
          <>
            {peekCards.map((p, i) => (
              <div
                key={`peek-${p.name}`}
                className="absolute pointer-events-none"
                style={{
                  transform: `scale(${1 - (i + 1) * 0.04}) translateY(${(i + 1) * 10}px)`,
                  opacity: 1 - (i + 1) * 0.35,
                  zIndex: 1 - i,
                }}
                aria-hidden="true"
                data-testid={`pairing-card-peek-${i}`}
              >
                <PairingModeCard
                  node={p.node}
                  filterType={filterType}
                  chosenAxis={chosenAxis}
                  strength={p.strength}
                  sharedCompounds={p.sharedCompounds}
                  analysis={p.analysis}
                  fb={p.fb}
                />
              </div>
            ))}
            {topCard && (
              <div className="relative" style={{ zIndex: 5 }} data-testid="pairing-card-top">
                <PairingModeCard
                  node={topCard.node}
                  filterType={filterType}
                  chosenAxis={chosenAxis}
                  strength={topCard.strength}
                  sharedCompounds={topCard.sharedCompounds}
                  analysis={topCard.analysis}
                  fb={topCard.fb}
                />
              </div>
            )}
          </>
        )}
      </div>

      {onDiscover && topCard && (
        <button
          type="button"
          onClick={() => onDiscover(topCard.name)}
          data-testid="pairing-mode-discover"
          className="w-full max-w-[min(32rem,92vw)] mt-3 py-2 rounded-lg"
          style={{
            color: '#bbf7d0',
            background: 'rgba(16, 78, 51, 0.45)',
            border: '1.5px solid rgba(110, 231, 183, 0.45)',
            fontFamily: 'Caveat, cursive',
            fontSize: 17,
            textShadow: '0 0 1px rgba(245,239,222,0.55), 0 0 3px rgba(245,239,222,0.22)',
          }}
        >
          Discover where these flavor pairings come from →
        </button>
      )}

      <div className="w-full max-w-[min(32rem,92vw)] mt-3 grid grid-cols-4 gap-2">
        <button
          type="button"
          onClick={nextCard}
          disabled={cardIdx + 1 >= filteredStack.length}
          data-testid="pairing-mode-left"
          className="py-3 rounded-lg text-sm text-gray-100 bg-[#13243d] border border-[#1d3158] hover:bg-[#1a2f4a] disabled:opacity-30 disabled:cursor-not-allowed"
          aria-label="Next pairing (swipe left)"
        >
          ← Next
        </button>
        <button
          type="button"
          onClick={rotateSpoke}
          data-testid="pairing-mode-right"
          className="py-3 rounded-lg text-sm text-gray-100 bg-[#13243d] border border-[#1d3158] hover:bg-[#1a2f4a]"
          aria-label="Rotate spoke (swipe right)"
        >
          Rotate →
        </button>
        <button
          type="button"
          onClick={() => cycleFilter('up')}
          data-testid="pairing-mode-up"
          className="py-3 rounded-lg text-sm text-gray-100 bg-[#13243d] border border-[#1d3158] hover:bg-[#1a2f4a]"
          aria-label="Cycle filter up (swipe up)"
        >
          ↑ Filter
        </button>
        <button
          type="button"
          onClick={() => cycleFilter('down')}
          data-testid="pairing-mode-down"
          className="py-3 rounded-lg text-sm text-gray-100 bg-[#13243d] border border-[#1d3158] hover:bg-[#1a2f4a]"
          aria-label="Cycle filter down (swipe down)"
        >
          ↓ Filter
        </button>
      </div>

      <div className="text-[10px] text-gray-500 mt-2 text-center max-w-md">
        Keys: ← next · → rotate · ↑/↓ filter · Esc back
      </div>
    </div>
  );
}

export { FILTER_CYCLE };
