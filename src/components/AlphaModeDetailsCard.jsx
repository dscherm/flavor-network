/**
 * AlphaModeDetailsCard — α-mode Screen 1 / Network details overlay.
 * (B-version rev 3 per user 2026-06-04.)
 *
 * STACKED, FILTER-AWARE redesign:
 *   - Single vertical column (meta on top, affinity ring below) inside a
 *     tall card that fills the viewport; text is viewport-scaled (clamp
 *     on vh) so it grows with the card height.
 *   - The meta block at the top is LENS-AWARE: it shows the focal
 *     ingredient's own tags for whichever dimension the carousel is on.
 *     Swipe the carousel and the top meta morphs to match the lens.
 *       aroma → focal's Tier-1 aromas, taste → Tier-2, mouthfeel →
 *       Tier-3 + leaves, cuisine → cuisines, season → season,
 *       chemistry → shared molecules (GNN top compounds).
 *   - Each focal tag chip is tappable: selecting it isolates the ring to
 *     only the pairings that share THAT specific tag. For chemistry this
 *     means one sub-view per shared molecule.
 *   - Every lens is color-coded (header, dot selector, chips, ring,
 *     focal halo) so the card reads as a spectrum, not a wash of green.
 *
 * CHEMISTRY RARITY FILTER:
 *   The chemistry lens only counts molecules that actually *discriminate*
 *   a pairing. A handful of compounds (Ethanol, L-Histidine, Caffeine,
 *   Theobromine) appear in ~70% of all ingredients — sharing them says
 *   nothing about why two foods pair. We compute each compound's
 *   document-frequency across the graph and drop any appearing in more
 *   than COMMON_COMPOUND_MAX_FRACTION of ingredients before scoring.
 *
 * Carousel nodes are cluster-colored dots on a dashed orbit.
 *   - Single-tap a node → reveals the pairing's name (inline label).
 *   - Double-tap a node → fires onSelectPairing(name).
 * Swipe left/right (touch + mouse drag), arrow buttons, color dots, or
 * ←/→ keys cycle the lenses.
 *
 * Also used from Network mode as the first screen after a node tap
 * (before PairingMode).
 */

import React, { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { getNeighborsEnriched } from '../data/graph.js';

const FONT = 'Caveat, cursive';
const CHALK_BG = `
  radial-gradient(ellipse at center, #1c1c1c 0%, #0a0a0a 75%, #050505 100%),
  #0a0a0a
`;
const CHALK_BORDER_OUTER = '#4a4a4a';
const CHALK_BORDER_INNER = '#6a6a6a';
const CHALK_CREAM = '#f5efde';
const CHALK_DIM = '#bdb6a3';
const CHALK_SUB = '#8a8478';
const CHALK_TEXT_SHADOW = '0 0 1px rgba(245,239,222,0.55), 0 0 3px rgba(245,239,222,0.22)';
// Chalk-edge outline so the focal name + shared-flavor labels stay legible
// over any lens hue.
const TEXT_OUTLINE = { WebkitTextStroke: '0.6px rgba(8,8,8,0.62)', paintOrder: 'stroke fill' };

// Viewport-scaled font sizes — grow with card height (clamp on vh).
const FS_FOCAL = 'clamp(42px, 7.2vh, 72px)';
const FS_LENS = 'clamp(26px, 4.4vh, 46px)';
const FS_CHIP = 'clamp(16px, 2.4vh, 24px)';
const FS_CAPTION = 'clamp(13px, 1.9vh, 19px)';
const FS_SUB = 'clamp(11px, 1.5vh, 16px)';

function tokenize(str) {
  if (!str || typeof str !== 'string') return [];
  return str.toLowerCase().split(/[\s,/-]+/).filter(Boolean);
}

const RING_SIZE = 300;
const RING_CENTER = RING_SIZE / 2;
const RING_RADIUS = RING_CENTER - 36;
const RING_MAX = 12;

// A compound appearing in more than this fraction of all ingredients is
// treated as ubiquitous "background" (e.g. caffeine) and excluded from
// the chemistry lens — sharing it is not indicative of a good pairing.
const COMMON_COMPOUND_MAX_FRACTION = 0.30;

// Each lens is one swipeable view + its color-code. `meta` is the label
// for the focal's own tag row; `noun` describes the shared signal.
// Colors are muted "colored-chalk" tones to sit on the charcoal card
// rather than neon — each shared-flavor lens gets its own chalk hue.
const VIEWS = [
  { id: 'aroma',     label: 'Shared Aroma',     meta: 'Aroma',     noun: 'aroma',     color: '#8fd3dd' },
  { id: 'taste',     label: 'Shared Taste',     meta: 'Taste',     noun: 'taste',     color: '#e3b777' },
  { id: 'mouthfeel', label: 'Shared Mouthfeel', meta: 'Mouthfeel', noun: 'texture',   color: '#b6a6e0' },
  { id: 'cuisine',   label: 'Shared Cuisine',   meta: 'Cuisines',  noun: 'kitchen',   color: '#dd9a63' },
  { id: 'season',    label: 'Shared Season',    meta: 'Season',    noun: 'season',    color: '#9ac99a' },
  { id: 'chemistry', label: 'Shared Chemistry', meta: 'Chemistry', noun: 'molecule',  color: '#e0cd8c' },
  { id: 'surprising', label: 'Surprising Pairings', meta: 'Surprising', noun: 'surprise', color: '#df96b6' },
];

// The flavor dimensions a "surprising" pairing must NOT obviously share.
const SURPRISE_DIMS = ['aroma', 'taste', 'mouthfeel'];

function seasonList(season) {
  if (Array.isArray(season)) return season.filter(Boolean);
  if (typeof season === 'string' && season.trim()) {
    return season.split(/[\s,/-]+/).filter(Boolean);
  }
  return [];
}

/**
 * Scan every node's top_compounds and return the set (lowercased) of
 * compounds that are too common to be discriminative. `fraction`
 * defaults to COMMON_COMPOUND_MAX_FRACTION.
 */
function computeCommonCompounds(nodes, fraction = COMMON_COMPOUND_MAX_FRACTION) {
  const common = new Set();
  if (!nodes) return common;
  const df = new Map();
  let total = 0;
  const visit = (node) => {
    total += 1;
    const arr = node?.gnnCompounds?.top_compounds;
    if (!Array.isArray(arr)) return;
    const seen = new Set();
    for (const c of arr) {
      const n = typeof c === 'string' ? c : c?.name;
      if (!n) continue;
      const key = n.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      df.set(key, (df.get(key) || 0) + 1);
    }
  };
  if (typeof nodes.forEach === 'function') nodes.forEach(visit);
  else for (const n of nodes) visit(n);
  if (total === 0) return common;
  const limit = total * fraction;
  for (const [key, count] of df) if (count > limit) common.add(key);
  return common;
}

// Indicative molecules for a node — drops the ubiquitous background set,
// then keeps the top few that remain.
function compoundNames(node, common) {
  const arr = node?.gnnCompounds?.top_compounds;
  if (!Array.isArray(arr)) return [];
  const out = [];
  for (const c of arr) {
    const n = typeof c === 'string' ? c : c?.name;
    if (!n) continue;
    if (common && common.has(n.toLowerCase())) continue;
    out.push(n);
    if (out.length >= 8) break;
  }
  return out;
}

// The focal's (or any pairing's) tags for a given lens. Same shape for
// both so overlap is a plain set intersection.
function tagsForView(node, viewId, common) {
  if (!node) return [];
  switch (viewId) {
    case 'aroma':
      return node.flavorGraph?.tier1 || [];
    case 'taste': {
      const t2 = node.flavorGraph?.tier2;
      if (Array.isArray(t2) && t2.length > 0) return t2;
      return tokenize(node.taste);
    }
    case 'mouthfeel':
      return [...(node.flavorGraph?.tier3 || []), ...(node.flavorGraph?.leaves || [])];
    case 'cuisine':
      return Array.isArray(node.cuisines) ? node.cuisines : [];
    case 'season':
      return seasonList(node.season);
    case 'chemistry':
      return compoundNames(node, common);
    case 'surprising':
      return []; // no single dimension drives this lens
    default:
      return [];
  }
}

// Count how much two nodes obviously share across the flavor dimensions
// (aroma + taste + mouthfeel). Drives the "surprising" lens.
function flavorOverlap(focalNode, pairNode, common) {
  let n = 0;
  for (const d of SURPRISE_DIMS) {
    const fset = new Set(tagsForView(focalNode, d, common).map((s) => String(s).toLowerCase()));
    for (const t of tagsForView(pairNode, d, common)) {
      if (fset.has(String(t).toLowerCase())) n += 1;
    }
  }
  return n;
}

// Pairings for the active lens, grounded in the FOCAL's properties.
//   - activeTag set → isolate to the focal's pairings that share that one
//     focal tag (e.g. one specific aroma / one molecule).
//   - chemistry, no tag → only pairings that share an indicative molecule
//     (ubiquitous compounds already stripped from `common`).
//   - other lenses, no tag → ALL of the focal's real pairings, ranked so
//     the ones echoing the focal's tags float to the top. We do NOT gate
//     on shared tags here: these are "{focal}'s pairings seen through its
//     {aroma}", not "ingredients that happen to share an aroma".
function rankPairings(focalNode, allPairings, viewId, activeTag, common) {
  // Surprising = the focal's strongest pairings that share NO obvious
  // aroma / taste / texture — unexpected matches.
  if (viewId === 'surprising') {
    return allPairings
      .map((p) => ({ ...p, score: 0, _sig: flavorOverlap(focalNode, p.node, common) }))
      .filter((p) => p._sig === 0)
      .sort((a, b) => (b.strength || 0) - (a.strength || 0))
      .slice(0, RING_MAX);
  }
  const focalTags = tagsForView(focalNode, viewId, common).map((s) => String(s).toLowerCase());
  const focalSet = new Set(focalTags);
  const wantTag = activeTag ? String(activeTag).toLowerCase() : null;
  const gateOnShared = viewId === 'chemistry';
  return allPairings
    .map((p) => {
      const pTags = tagsForView(p.node, viewId, common).map((s) => String(s).toLowerCase());
      let overlap = 0;
      for (const t of pTags) if (focalSet.has(t)) overlap += 1;
      let include;
      if (wantTag) include = pTags.includes(wantTag);
      else if (gateOnShared) include = overlap > 0;
      else include = true;
      return { ...p, score: wantTag ? (include ? 1 : 0) : overlap, _include: include };
    })
    .filter((p) => p._include)
    .sort((a, b) => b.score - a.score || (b.strength || 0) - (a.strength || 0))
    .slice(0, RING_MAX);
}

// One-line explanation under the ring — adapts to the lens + sub-filter.
function pairingBlurb({ view, focalName, focalTags, activeTag, count }) {
  const name = focalName || 'This ingredient';
  const list = (focalTags || []).slice(0, 4).join(', ') + ((focalTags || []).length > 4 ? '…' : '');
  if (view.id === 'surprising') {
    return count > 0
      ? `${name}'s ${count} most surprising pairings — strong matches with no shared aroma, taste, or texture. Tap one to see what bridges it.`
      : `No surprising pairings for ${name} — its strong partners all share an obvious flavor signal.`;
  }
  if (activeTag != null) {
    return `${count} of ${name}'s pairings share its “${activeTag}” ${view.noun}.`;
  }
  if (view.id === 'chemistry') {
    if (!focalTags || focalTags.length === 0) {
      return `No indicative molecules for ${name} — only ubiquitous compounds (caffeine, ethanol…) that don't explain a pairing.`;
    }
    return `${name} carries ${list}. These ${count} pairings each share at least one of those molecules; ubiquitous compounds like caffeine are excluded.`;
  }
  if (!focalTags || focalTags.length === 0) {
    return `${name}'s ${count} strongest pairings.`;
  }
  return `${name}'s ${view.noun} — ${list} — anchors these ${count} pairings. Tap a ${view.noun} above to spotlight the partners that echo it.`;
}

// When a ring node is tapped, explain THAT pairing specifically.
function pairExplanation({ focalName, focalNode, pairNode, pairName, view, common }) {
  const a = focalName || 'This ingredient';
  const b = pairName || 'that ingredient';
  if (view.id === 'surprising') {
    return `${a} + ${b}: a strong pairing with no shared aroma, taste, or texture — the bond is chemistry or tradition, not obvious overlap.`;
  }
  const fset = new Set(tagsForView(focalNode, view.id, common).map((s) => String(s).toLowerCase()));
  const shared = tagsForView(pairNode, view.id, common).filter((t) => fset.has(String(t).toLowerCase()));
  if (shared.length > 0) {
    const list = shared.slice(0, 3).join(', ');
    if (view.id === 'chemistry') {
      return `${a} + ${b} both contain ${list} — sharing that molecule is the chemical basis for the pairing.`;
    }
    return `${a} + ${b} both bring ${list} — that ${view.noun} overlap is what links them.`;
  }
  return `${a} + ${b} pair without a shared ${view.noun} — try the other lenses to find what bridges them.`;
}

/** Lens dots — color-coded pagination + jump control. */
function ViewDots({ viewIdx, onPick }) {
  return (
    <div className="flex items-center justify-center gap-2.5 mb-2" data-testid="alpha-view-dots">
      {VIEWS.map((v, i) => {
        const active = i === viewIdx;
        return (
          <button
            key={v.id}
            type="button"
            onClick={() => onPick(i)}
            aria-label={v.label}
            aria-current={active ? 'true' : undefined}
            data-testid={`alpha-view-dot-${v.id}`}
            data-active={active ? 'true' : 'false'}
            className="rounded-full transition-all"
            style={{
              width: active ? 15 : 10,
              height: active ? 15 : 10,
              background: active ? v.color : `${v.color}40`,
              border: active ? `2px solid ${v.color}` : `1px solid ${v.color}55`,
              boxShadow: active ? `0 0 8px ${v.color}aa` : 'none',
            }}
          />
        );
      })}
    </div>
  );
}

/**
 * Lens-aware meta row: the focal's own tags for the current dimension.
 * Tapping a chip toggles the active sub-filter (isolate the ring to that
 * tag); tapping it again (or "All") clears it.
 */
function FocalTagRow({ focalName, tags, color, activeTag, onPickTag, noun }) {
  if (!Array.isArray(tags) || tags.length === 0) {
    return (
      <div className="text-center mb-3" style={{ color: CHALK_SUB, fontFamily: FONT, fontSize: FS_CAPTION }}
        data-testid="alpha-focal-tags-empty">
        No {noun} data for {focalName}.
      </div>
    );
  }
  return (
    <div className="flex flex-col items-center gap-2 mb-3" data-testid="alpha-focal-tags">
      <div className="flex flex-wrap items-center justify-center gap-2 max-w-xl">
        <button
          type="button"
          onClick={() => onPickTag(null)}
          data-testid="alpha-focal-tag-all"
          data-active={activeTag == null ? 'true' : 'false'}
          className="px-3 py-0.5 rounded-full border transition-all"
          style={{
            color: activeTag == null ? '#0a0a0a' : color,
            background: activeTag == null ? color : `${color}14`,
            borderColor: `${color}66`,
            fontFamily: FONT,
            fontSize: FS_CHIP,
            ...TEXT_OUTLINE,
          }}
        >
          All
        </button>
        {tags.map((t, i) => {
          const isActive = activeTag != null && String(activeTag).toLowerCase() === String(t).toLowerCase();
          return (
            <button
              key={`${t}-${i}`}
              type="button"
              onClick={() => onPickTag(isActive ? null : t)}
              data-testid={`alpha-focal-tag-${String(t).toLowerCase().replace(/\s+/g, '-')}`}
              data-active={isActive ? 'true' : 'false'}
              className="px-3 py-0.5 rounded-full border transition-all"
              style={{
                color: isActive ? '#0a0a0a' : color,
                background: isActive ? color : `${color}14`,
                borderColor: `${color}66`,
                boxShadow: isActive ? `0 0 10px ${color}aa` : 'none',
                fontFamily: FONT,
                fontSize: FS_CHIP,
                ...TEXT_OUTLINE,
              }}
            >
              {t}
            </button>
          );
        })}
      </div>
      <span className="uppercase tracking-wider" style={{ color: CHALK_SUB, fontFamily: FONT, fontSize: FS_SUB }}>
        {activeTag != null
          ? `Pairings sharing "${activeTag}"`
          : `Tap a ${noun} to isolate its pairings`}
      </span>
    </div>
  );
}

function AffinityCarousel({ focalName, focalNode, view, pairings, revealed, onTapNode, onDoubleTapNode }) {
  const color = view?.color || CHALK_BORDER_INNER;
  const tapTrackRef = useRef({});
  const handleTap = (name) => {
    const now = Date.now();
    const last = tapTrackRef.current[name] || 0;
    if (now - last < 350) {
      onDoubleTapNode?.(name);
      tapTrackRef.current[name] = 0;
    } else {
      onTapNode?.(name);
      tapTrackRef.current[name] = now;
    }
  };

  return (
    <div className="flex flex-col items-center w-full flex-1 min-h-0 justify-center" data-testid="alpha-affinity-carousel"
      data-view-id={view?.id || ''}>
      <svg width="100%" height="100%" viewBox={`0 0 ${RING_SIZE} ${RING_SIZE}`} preserveAspectRatio="xMidYMid meet"
        role="img" aria-label={`${view?.label} — ${pairings.length} pairings`}
        style={{ maxWidth: 'min(92vw, 56vh)', maxHeight: '56vh' }}
        data-testid="alpha-affinity-ring">
        <circle cx={RING_CENTER} cy={RING_CENTER} r={RING_RADIUS}
          fill="none" stroke={`${color}66`} strokeWidth={1.25} strokeDasharray="3 3" />
        {pairings.length === 0 && (
          <text x={RING_CENTER} y={RING_CENTER + 44} textAnchor="middle" fontSize={15}
            fill={CHALK_SUB} style={{ fontFamily: FONT }}>
            No pairings share this signal.
          </text>
        )}
        {pairings.map((p, i) => {
          const angle = (Math.PI * 2 * i) / Math.max(1, pairings.length) - Math.PI / 2;
          const x = RING_CENTER + RING_RADIUS * Math.cos(angle);
          const y = RING_CENTER + RING_RADIUS * Math.sin(angle);
          const isRevealed = revealed === p.name;
          // Whole graphic is themed to the active lens; depth comes from
          // fading opacity down the strength-ranked order, not hue.
          const op = 0.95 - (i / Math.max(1, pairings.length)) * 0.42;
          return (
            <g key={p.name} style={{ cursor: 'pointer' }}
               onClick={() => handleTap(p.name)}
               onDoubleClick={() => onDoubleTapNode?.(p.name)}
               data-testid={`alpha-affinity-node-${p.name}`}>
              <line x1={RING_CENTER} y1={RING_CENTER} x2={x} y2={y} stroke={`${color}55`} strokeWidth={1} />
              <circle cx={x} cy={y} r={isRevealed ? 10 : 7}
                fill={color} fillOpacity={isRevealed ? 1 : op}
                stroke={isRevealed ? '#fff' : `${color}aa`}
                strokeWidth={isRevealed ? 2 : 1} />
              {isRevealed && (
                <g>
                  <rect x={x - 70} y={y + 12} width={140} height={28} rx={5}
                    fill="#0a0a0a" stroke={color} strokeWidth={1.25} />
                  <text x={x} y={y + 31} textAnchor="middle" fontSize={18} fill={CHALK_CREAM}
                    style={{ fontFamily: FONT, textShadow: CHALK_TEXT_SHADOW }}>
                    {p.name}
                  </text>
                </g>
              )}
            </g>
          );
        })}
        {/* Focal hub — lens-colored core + brighter halo. */}
        <circle cx={RING_CENTER} cy={RING_CENTER} r={33}
          fill="none" stroke={color} strokeWidth={2.5} opacity={0.85} />
        <circle cx={RING_CENTER} cy={RING_CENTER} r={30}
          fill={color} stroke="#fff" strokeWidth={2} />
        <text x={RING_CENTER} y={RING_CENTER - 3} textAnchor="middle" fontSize={15}
          fontWeight={700} fill="#0a0a0a" stroke={CHALK_CREAM} strokeWidth={0.65}
          paintOrder="stroke" style={{ fontFamily: FONT }}>
          {focalName}
        </text>
        <text x={RING_CENTER} y={RING_CENTER + 14} textAnchor="middle" fontSize={11}
          fill="#0a0a0a" stroke={CHALK_CREAM} strokeWidth={0.5}
          paintOrder="stroke" style={{ fontFamily: FONT }}>
          {view?.label}
        </text>
      </svg>
    </div>
  );
}

export default function AlphaModeDetailsCard({
  focal,
  ctx,
  commonCompounds: commonCompoundsProp,
  onIngredientPairings,
  onSelectPairing,
  onExit,
}) {
  const focalName = typeof focal === 'string' ? focal : focal?.name;
  const focalNode = useMemo(() => {
    if (!focalName || !ctx?.graph?.nodes?.get) return null;
    return ctx.graph.nodes.get(focalName) || { name: focalName };
  }, [focalName, ctx]);

  // Ubiquitous-compound exclusion set (caffeine et al). Injectable for
  // tests; otherwise derived once from the graph.
  const commonCompounds = useMemo(() => {
    if (commonCompoundsProp instanceof Set) return commonCompoundsProp;
    return computeCommonCompounds(ctx?.graph?.nodes);
  }, [commonCompoundsProp, ctx]);

  const allPairings = useMemo(() => {
    if (!focalName || !ctx?.graph?.edges) return [];
    try {
      const list = getNeighborsEnriched(focalName, ctx.graph.edges, ctx?.cuisineNeighborIndex || null);
      return list.slice(0, 60).map((p) => ({
        name: p.name,
        strength: typeof p.strength === 'number' ? p.strength : 0,
        node: ctx.graph.nodes.get?.(p.name) || { name: p.name },
      }));
    } catch { return []; }
  }, [focalName, ctx]);

  const [viewIdx, setViewIdx] = useState(0);
  const [revealed, setRevealed] = useState(null);
  const [activeTag, setActiveTag] = useState(null);

  // Reset reveal + lens + sub-filter on focal change.
  useEffect(() => { setRevealed(null); setViewIdx(0); setActiveTag(null); }, [focalName]);
  // Reset the sub-filter + reveal whenever the lens changes.
  useEffect(() => { setActiveTag(null); setRevealed(null); }, [viewIdx]);

  const goNext = useCallback(() => setViewIdx((i) => (i + 1) % VIEWS.length), []);
  const goPrev = useCallback(() => setViewIdx((i) => (i - 1 + VIEWS.length) % VIEWS.length), []);

  // Touch swipe + mouse drag for the carousel.
  const dragRef = useRef(null);
  const SWIPE_THRESHOLD = 50;
  const onTouchStart = (e) => {
    const t = e.touches?.[0];
    if (!t) return;
    dragRef.current = { x: t.clientX, y: t.clientY, kind: 'touch' };
  };
  const onTouchEnd = (e) => {
    const start = dragRef.current;
    dragRef.current = null;
    if (!start || start.kind !== 'touch') return;
    const t = (e.changedTouches?.[0]) || null;
    if (!t) return;
    const dx = t.clientX - start.x;
    if (Math.abs(dx) > SWIPE_THRESHOLD) (dx < 0 ? goNext : goPrev)();
  };
  const onMouseDown = (e) => {
    if (e.target?.closest?.('button')) return;
    if (e.target?.closest?.('[data-testid^="alpha-affinity-node-"]')) return;
    dragRef.current = { x: e.clientX, y: e.clientY, kind: 'mouse' };
  };
  const onMouseUp = (e) => {
    const start = dragRef.current;
    dragRef.current = null;
    if (!start || start.kind !== 'mouse') return;
    const dx = e.clientX - start.x;
    if (Math.abs(dx) > SWIPE_THRESHOLD) (dx < 0 ? goNext : goPrev)();
  };

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'ArrowLeft') { e.preventDefault(); goPrev(); }
      else if (e.key === 'ArrowRight') { e.preventDefault(); goNext(); }
      else if (e.key === 'Escape') { e.preventDefault(); onExit?.(); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [goNext, goPrev, onExit]);

  const view = VIEWS[viewIdx];
  const focalTags = useMemo(
    () => tagsForView(focalNode, view.id, commonCompounds),
    [focalNode, view, commonCompounds],
  );
  const pairings = useMemo(
    () => rankPairings(focalNode, allPairings, view.id, activeTag, commonCompounds),
    [focalNode, allPairings, view, activeTag, commonCompounds],
  );

  // Blurb: when a ring node is revealed, explain THAT pairing; otherwise
  // describe the lens as a whole.
  const revealedPairing = revealed ? pairings.find((p) => p.name === revealed) : null;
  const blurbText = revealedPairing
    ? pairExplanation({
        focalName, focalNode, pairNode: revealedPairing.node,
        pairName: revealedPairing.name, view, common: commonCompounds,
      })
    : pairingBlurb({ view, focalName, focalTags, activeTag, count: pairings.length });

  return (
    <div className="fixed inset-0 z-[80] flex flex-col items-center justify-center px-4 py-3"
      style={{ background: CHALK_BG }}
      data-testid="alpha-details-card"
      data-focal={focalName || ''}
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
      onMouseDown={onMouseDown}
      onMouseUp={onMouseUp}>
      <div className="w-full max-w-[544px] flex items-center justify-between mb-2 flex-shrink-0">
        <button type="button" onClick={() => onExit?.()}
          data-testid="alpha-details-back"
          className="px-3 py-2 rounded-lg"
          style={{ color: CHALK_CREAM, background: 'rgba(255,255,255,0.04)', border: `1px solid ${CHALK_BORDER_INNER}`, fontFamily: FONT, fontSize: FS_CAPTION, textShadow: CHALK_TEXT_SHADOW }}>
          ← Back
        </button>
        <span style={{ color: CHALK_DIM, fontFamily: FONT, fontSize: FS_SUB, textShadow: CHALK_TEXT_SHADOW }}>
          α-mode · ingredient
        </span>
      </div>

      <div className="w-full max-w-[544px] flex-1 min-h-0 flex flex-col rounded-2xl px-5 py-4 mb-3 overflow-y-auto"
        style={{ maxHeight: '69vh', background: 'rgba(255,255,255,0.025)', border: `2px double ${CHALK_BORDER_OUTER}`, boxShadow: `inset 0 0 0 1px ${CHALK_BORDER_INNER}55, 0 8px 24px rgba(0,0,0,0.55)` }}>
        <h2 className="text-center mb-2 flex-shrink-0"
          style={{ color: CHALK_CREAM, fontFamily: FONT, fontSize: FS_FOCAL, textShadow: CHALK_TEXT_SHADOW, letterSpacing: '0.01em', lineHeight: 1.05, WebkitTextStroke: '1px rgba(8,8,8,0.55)', paintOrder: 'stroke fill' }}>
          {focalName}
        </h2>

        {/* Color-coded lens selector dots */}
        <div className="flex-shrink-0"><ViewDots viewIdx={viewIdx} onPick={setViewIdx} /></div>

        {/* Lens header — prev / title / next */}
        <div className="flex items-center justify-between w-full mb-2 flex-shrink-0">
          <button type="button" onClick={goPrev}
            data-testid="alpha-carousel-prev"
            className="px-3 py-1 rounded-md"
            style={{ color: CHALK_CREAM, background: 'rgba(255,255,255,0.04)', border: `1px solid ${view.color}55`, fontFamily: FONT, fontSize: FS_LENS, lineHeight: 1, textShadow: CHALK_TEXT_SHADOW }}>
            ←
          </button>
          <div className="flex flex-col items-center">
            <span data-testid="alpha-lens-title"
              style={{ color: view.color, fontFamily: FONT, fontSize: FS_LENS, textShadow: `0 0 6px ${view.color}55`, ...TEXT_OUTLINE }}>
              {view.label}
            </span>
            <span className="uppercase tracking-wider" style={{ color: CHALK_SUB, fontFamily: FONT, fontSize: FS_SUB }}>
              {viewIdx + 1} / {VIEWS.length} · swipe to change
            </span>
          </div>
          <button type="button" onClick={goNext}
            data-testid="alpha-carousel-next"
            className="px-3 py-1 rounded-md"
            style={{ color: CHALK_CREAM, background: 'rgba(255,255,255,0.04)', border: `1px solid ${view.color}55`, fontFamily: FONT, fontSize: FS_LENS, lineHeight: 1, textShadow: CHALK_TEXT_SHADOW }}>
            →
          </button>
        </div>

        {/* Lens-aware focal meta (the "{Aroma} of the focal" row).
            The surprising lens has no single dimension to tag, so it
            shows a hint instead of chips. */}
        <div className="flex-shrink-0">
          {view.id === 'surprising' ? (
            <div className="text-center mb-3 uppercase tracking-wider"
              data-testid="alpha-surprising-hint"
              style={{ color: view.color, fontFamily: FONT, fontSize: FS_SUB }}>
              Strong pairings · no obvious flavor overlap
            </div>
          ) : (
            <FocalTagRow
              focalName={focalName}
              tags={focalTags}
              color={view.color}
              activeTag={activeTag}
              onPickTag={setActiveTag}
              noun={view.noun}
            />
          )}
        </div>

        {/* Shared-ingredient ring for the active lens / sub-filter */}
        <AffinityCarousel
          focalName={focalName}
          focalNode={focalNode}
          view={view}
          pairings={pairings}
          revealed={revealed}
          onTapNode={(name) => setRevealed(name)}
          onDoubleTapNode={(name) => onSelectPairing?.(name)}
        />

        {/* Plain-language explanation of what the ring is showing */}
        <p className="text-center mt-1 mb-0.5 flex-shrink-0 leading-snug"
          data-testid="alpha-pairing-blurb"
          style={{ color: CHALK_DIM, fontFamily: FONT, fontSize: FS_CAPTION, textShadow: CHALK_TEXT_SHADOW, maxWidth: '34rem', marginInline: 'auto' }}>
          {blurbText}
        </p>
        <span className="block text-center uppercase tracking-wider flex-shrink-0"
          style={{ color: CHALK_SUB, fontFamily: FONT, fontSize: FS_SUB, textShadow: CHALK_TEXT_SHADOW }}>
          Tap to name · double-tap to inspect
        </span>
      </div>

      <button type="button" onClick={() => onIngredientPairings?.()}
        data-testid="alpha-details-ingredient-pairings"
        className="w-full max-w-[544px] py-3 rounded-lg flex-shrink-0"
        style={{
          color: '#bbf7d0',
          background: 'rgba(16, 78, 51, 0.55)',
          border: '1.5px solid rgba(110, 231, 183, 0.45)',
          fontFamily: FONT,
          fontSize: FS_LENS,
          textShadow: CHALK_TEXT_SHADOW,
        }}>
        Ingredient pairings →
      </button>
    </div>
  );
}

export { VIEWS as ALPHA_DETAILS_VIEWS, tagsForView, rankPairings, computeCommonCompounds };
