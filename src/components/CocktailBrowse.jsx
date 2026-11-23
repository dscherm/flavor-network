import { useEffect, useMemo, useState } from 'react';
import { useNoResultSearch } from '../hooks/useUsage.js';
import { cocktailBaseSpirit, COCKTAIL_SPIRIT_LEGEND, COCKTAIL_SPIRIT_COLORS } from '../data/cocktailBaseSpirit.js';
import {
  TEXT,
  HAND,
  CHALK_BG,
  CHALK_CREAM,
  CHALK_DIM,
  CHALK_SUB,
  CHALK_RAIL,
  CHALK_SHADOW,
  chalkSurfaceStyle,
} from '../data/chalkTheme.js';
import { parseQuery, matchItem, cocktailIngredientNames, buildIngredientVocab } from '../data/ingredientSearch.js';
import { subclusterName } from '../data/cocktailSubclusters.js';
import { deriveFacets, matchesFacetFilter, loadFacetContext, FACET_GROUPS } from '../data/cocktailFacets.js';
import { glassMark, glassTypeFor } from './cocktailGlasses.jsx';
import { UNCATEGORISED } from '../data/savedInventions.js';
import PictureView from './PictureView.jsx';

import { ChalkBottle } from './chalkArt.jsx';
import { Shaker, Close, Search, Filters, ChevronDown, ChevronUp } from './ChalkIcons.jsx';
import { primaryBtn, textAction, FOCUS, ACCENT } from './inventUi.jsx';

// The 2D cocktail list IS a bar menu, so it's drawn as colored chalk on
// slate (shared kitchen-world DNA, see chalkTheme.js). Caveat carries
// names/headings; small data (counts, IBA, spirit) stays in a legible sans.

/**
 * CocktailBrowse — 2D selection surface for the Cocktail Lab. Sits as
 * an alternative to the 3D NetworkScene (toggled at the lab header).
 *
 * Three regions, top to bottom:
 *   1. Mini-map — seven family bubbles, sized by cocktail count, click
 *      to filter the list to that family. Hand-tuned 2x3 layout (vibe
 *      only, not a literal projection of 3D centroids).
 *   2. Filter bar — spirit chips (Gin/Whiskey/Rum/etc.), IBA-only
 *      toggle, free-text search.
 *   3. Sectioned list — grouped family → subcluster → cocktail. Each
 *      cocktail row is clickable; click hands off to the parent which
 *      mounts the existing CocktailDetailPanel.
 *
 * State that needs to be shared with the lab (filterFamily,
 * filterSpirit, selectedCocktail) is lifted; this component is pure
 * UI driven by props.
 */


// Word-wrap a family name into up to 2 lines for the shelf tag (no truncation).

/**
 * Derive a human label for a subcluster. The data only carries an id
 * like "3.1"; the readable label comes from the is_root cocktail of
 * that subcluster, falling back to the first member's name.
 */
function deriveSubclusterLabel(members) {
  if (!members || members.length === 0) return null;
  const root = members.find((m) => m.is_root);
  return (root || members[0]).name;
}

// Distinct colored-chalk hues for subgroup headers, cycled within each family
// (colored chalks on a slate board — each subgroup gets its own).

// v1.0.4: dark family colours (Espagnole brown, Mole) vanish as text or outline
// on the near-black card. Lift anything below a luminance floor toward chalk
// cream; bright families pass through unchanged.
function popColor(hex) {
  const m = /^#?([0-9a-f]{6})$/i.exec(String(hex || ''));
  if (!m) return hex;
  const n = parseInt(m[1], 16);
  const r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
  const lum = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
  if (lum >= 0.5) return hex;
  const t = Math.min(0.65, (0.5 - lum) * 1.8);
  const mix = (c, target) => Math.round(c + (target - c) * t);
  return `#${[mix(r, 245), mix(g, 239), mix(b, 222)].map((v) => v.toString(16).padStart(2, '0')).join('')}`;
}

// Keyword → flavor-family glyph, matched against the subgroup's root-cocktail
// name + member names; first hit wins, generic glass is the fallback.
const SUBGROUP_GLYPHS = [
  { kind: 'coconut', rx: /colada|coconut|painkiller|mai\s*tai|zombie|hurricane|tiki|tropical|bahama/ },
  { kind: 'mint',    rx: /mojito|mint|julep|basil|smash|southside|cucumber/ },
  { kind: 'coffee',  rx: /espresso|coffee|mudslide/ },
  { kind: 'cream',   rx: /cream|alexander|\bflip\b|\begg\b|grasshopper|\bnog\b|white russian|milk punch/ },
  { kind: 'bubbly',  rx: /spritz|mimosa|champagne|royale|sparkl|prosecco|bellini|aperol|french\s*75|\bsoda\b|highball|\bfizz\b/ },
  { kind: 'spice',   rx: /old\s*fashioned|manhattan|negroni|boulevardier|sazerac|toddy|mule|ginger|spice|chai|cinnamon|\bhot\b/ },
  { kind: 'berry',   rx: /bramble|berry|raspberr|strawberr|blackberr|clover club/ },
  { kind: 'citrus',  rx: /margarita|daiquiri|sour|gimlet|sidecar|collins|cosmo|kamikaze|caipirinha|caipi|lime|lemon|citrus|rickey|paloma|screwdriver/ },
];
function subgroupKind(text) {
  const t = String(text || '').toLowerCase();
  for (const { kind, rx } of SUBGROUP_GLYPHS) if (rx.test(t)) return kind;
  return 'glass';
}

/** Small chalk line-art glyph for a subgroup, stroked in its chalk color. */
function SubgroupGlyph({ kind, color }) {
  const s = { fill: 'none', stroke: color, strokeWidth: 1.4, strokeLinecap: 'round', strokeLinejoin: 'round' };
  let inner;
  switch (kind) {
    case 'citrus':
      inner = (<><circle cx="8" cy="8" r="5.5" {...s} /><line x1="8" y1="8" x2="8" y2="2.5" {...s} /><line x1="8" y1="8" x2="13.5" y2="8" {...s} /><line x1="8" y1="8" x2="8" y2="13.5" {...s} /><line x1="8" y1="8" x2="2.5" y2="8" {...s} /></>); break;
    case 'mint':
      inner = (<><path d="M8 14 C8 10 8 7 8 3" {...s} /><path d="M8 7 C5 7 3.5 5.5 3 3 C6 3 7.7 4.5 8 7Z" {...s} /><path d="M8 9.5 C11 9.5 12.5 8 13 5.5 C10 5.5 8.3 7 8 9.5Z" {...s} /></>); break;
    case 'coconut':
      inner = (<><circle cx="8" cy="9" r="5" {...s} /><circle cx="6.3" cy="7.6" r="0.7" fill={color} stroke="none" /><circle cx="9.6" cy="7.2" r="0.7" fill={color} stroke="none" /><circle cx="8" cy="10.2" r="0.7" fill={color} stroke="none" /></>); break;
    case 'berry':
      inner = (<><circle cx="6" cy="9.7" r="2.6" {...s} /><circle cx="10" cy="9.7" r="2.6" {...s} /><circle cx="8" cy="5.6" r="2.6" {...s} /></>); break;
    case 'cream':
      inner = (<path d="M8 2 C5.5 6.5 4.5 8.5 4.5 10.5 a3.5 3.5 0 0 0 7 0 C11.5 8.5 10.5 6.5 8 2Z" {...s} />); break;
    case 'spice':
      inner = (<><line x1="8" y1="2.5" x2="8" y2="13.5" {...s} /><line x1="2.5" y1="8" x2="13.5" y2="8" {...s} /><line x1="4.2" y1="4.2" x2="11.8" y2="11.8" {...s} /><line x1="11.8" y1="4.2" x2="4.2" y2="11.8" {...s} /></>); break;
    case 'coffee':
      inner = (<g transform="rotate(-18 8 8)"><ellipse cx="8" cy="8" rx="3.8" ry="5.4" {...s} /><path d="M8 3 C6 6 10 10 8 13" {...s} /></g>); break;
    case 'bubbly':
      inner = (<><circle cx="6" cy="10.5" r="2.6" {...s} /><circle cx="10.6" cy="7.4" r="1.9" {...s} /><circle cx="8" cy="4" r="1.2" {...s} /></>); break;
    case 'glass':
    default:
      inner = (<><path d="M3.5 4 L12.5 4 L8 9 Z" {...s} /><line x1="8" y1="9" x2="8" y2="13.5" {...s} /><line x1="5" y1="13.5" x2="11" y2="13.5" {...s} /></>); break;
  }
  return (<svg width="23" height="23" viewBox="0 0 16 16" aria-hidden="true" style={{ flexShrink: 0 }}>{inner}</svg>);
}

// The back-bar bottle shelf, in pour order. Each spirit gets its own
// silhouette (see BOTTLE_PARAMS) — tapping filters the menu to that base.
const SPIRIT_SHELF = [
  { key: 'gin',       label: 'Gin' },
  { key: 'whiskey',   label: 'Whiskey' },
  { key: 'rum',       label: 'Rum' },
  { key: 'vodka',     label: 'Vodka' },
  { key: 'tequila',   label: 'Tequila' },
  { key: 'liqueur',   label: 'Liqueur' },
  { key: 'vermouth',  label: 'Vermouth' },
  { key: 'wine',      label: 'Wine' },
  { key: 'other',     label: 'Other' },
];


export default function CocktailBrowse({
  graph,
  selectedCocktail,
  onSelectCocktail,
  filterFamily,
  onFilterFamily,
  filterSpirit,
  onFilterSpirit,
  // My bar / Invent entry points (optional — buttons hidden without them).
  barCount = 0,
  onOpenMyBar = null,
  onOpenInvent = null,
  // "✨ Invent this": called with the search text; inventSummary(query) → short phrase under the button.
  onInventThis = null,
  inventSummary = null,
  // Names of drinks the bar + kitchen fully covers (myBar.whatCanIMake);
  // null hides the "Only what I have" switch.
  makeableNames = null,
}) {
  const [searchTerm, setSearchTerm] = useState('');
  const [ibaOnly, setIbaOnly] = useState(false);
  // "Only what I have" — remembered on this device.
  const [barOnly, setBarOnlyRaw] = useState(() => {
    try { return localStorage.getItem('fn-cocktail-bar-only') === '1'; } catch { return false; }
  });
  const setBarOnly = (on) => {
    setBarOnlyRaw(on);
    try { localStorage.setItem('fn-cocktail-bar-only', on ? '1' : '0'); } catch { /* private mode */ }
  };
  const barFilterOn = barOnly && makeableNames != null;
  // Facet filter: { occasions: 'brunch', strength: 'light', noEgg: true, … }.
  const [facetFilter, setFacetFilter] = useState({});
  // DESIGN-1: the six facet rows sit behind one Filters chip so the glass
  // and bottle shelves stay on screen.
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [facetCtx, setFacetCtx] = useState(null);
  useEffect(() => {
    let cancelled = false;
    loadFacetContext(import.meta.env.BASE_URL).then((ctx) => { if (!cancelled) setFacetCtx(ctx); });
    return () => { cancelled = true; };
  }, []);
  const activeFacetCount = Object.values(facetFilter).filter((v) => v).length;

  // Annotate every cocktail with its derived spirit once. Cached on
  // the graph object so re-renders don't recompute.
  const annotated = useMemo(() => {
    if (!graph) return null;
    const map = new Map();
    for (const fam of graph.families) {
      const members = graph.byFamily.get(fam.id) || [];
      for (const c of members) {
        map.set(c.name, {
          ...c,
          spirit: cocktailBaseSpirit(c.ingredients_raw),
        });
      }
    }
    // The cook's own drinks with no family still count, search and filter like the rest.
    for (const c of graph.mine || []) {
      if (!map.has(c.name)) map.set(c.name, { ...c, spirit: cocktailBaseSpirit(c.ingredients_raw) });
    }
    return map;
  }, [graph]);

  // Facets per cocktail (strength, occasion, season…), once the slot and
  // season lookups have loaded. Before that they derive from text alone.
  const facetsByName = useMemo(() => {
    if (!annotated) return null;
    const m = new Map();
    for (const a of annotated.values()) m.set(a.name, deriveFacets(a, facetCtx || {}));
    return m;
  }, [annotated, facetCtx]);

  // Search matches drink names AND ingredients ("gin, lime" = both).
  // Map of cocktail name → matched ingredient strings; null = no search.
  const searchHits = useMemo(() => {
    const terms = parseQuery(searchTerm);
    if (!annotated || terms.length === 0) return null;
    const hits = new Map();
    for (const a of annotated.values()) {
      const r = matchItem({ name: a.name, ingredients: cocktailIngredientNames(a) }, terms);
      if (r.match) hits.set(a.name, r.hits);
    }
    return hits;
  }, [annotated, searchTerm]);
  useNoResultSearch('cocktail', searchTerm, !!searchHits && searchHits.size === 0);

  // Ingredient vocabulary for the search box's autocomplete.
  const ingredientVocab = useMemo(
    () => (annotated ? buildIngredientVocab([...annotated.values()].map(cocktailIngredientNames)) : []),
    [annotated],
  );

  // Apply the spirit/IBA/search filters to a member list.
  const applyFilters = (members) => members.filter((m) => {
    const a = annotated.get(m.name);
    if (!a) return false;
    if (filterSpirit && a.spirit !== filterSpirit) return false;
    if (ibaOnly && !a.iba_official) return false;
    if (barFilterOn && !makeableNames.has(a.name)) return false;
    if (searchHits && !searchHits.has(a.name)) return false;
    if (activeFacetCount && !matchesFacetFilter(facetsByName?.get(a.name), facetFilter)) return false;
    return true;
  });

  // Per-chip counts under every OTHER active filter, so a chip shows how
  // many drinks it would leave rather than going dead without warning.
  const chipCounts = useMemo(() => {
    if (!annotated || !facetsByName) return new Map();
    const base = [...annotated.values()].filter((a) => {
      if (filterSpirit && a.spirit !== filterSpirit) return false;
      if (ibaOnly && !a.iba_official) return false;
      if (barFilterOn && !makeableNames.has(a.name)) return false;
      if (searchHits && !searchHits.has(a.name)) return false;
      if (filterFamily != null && a.family_id !== filterFamily) return false;
      return true;
    });
    const counts = new Map();
    for (const g of FACET_GROUPS) {
      for (const v of g.values) {
        const others = { ...facetFilter, [g.key]: v };
        counts.set(`${g.key}:${v}`, base.filter((a) => matchesFacetFilter(facetsByName.get(a.name), others)).length);
      }
    }
    return counts;
  }, [annotated, facetsByName, facetFilter, filterSpirit, ibaOnly, barFilterOn, makeableNames, searchHits, filterFamily]);

  const matchCount = useMemo(() => {
    if (!annotated) return 0;
    let n = 0;
    for (const a of annotated.values()) {
      if (filterSpirit && a.spirit !== filterSpirit) continue;
      if (ibaOnly && !a.iba_official) continue;
      if (barFilterOn && !makeableNames.has(a.name)) continue;
      if (searchHits && !searchHits.has(a.name)) continue;
      if (filterFamily != null && a.family_id !== filterFamily) continue;
      if (activeFacetCount && !matchesFacetFilter(facetsByName?.get(a.name), facetFilter)) continue;
      n += 1;
    }
    return n;
  }, [annotated, filterSpirit, ibaOnly, barFilterOn, makeableNames, searchHits, filterFamily, activeFacetCount, facetFilter, facetsByName]);

  // A search that matches nothing shows ONE empty state: the invent offer, with a way back.
  const inventEmpty = !!(searchHits && onInventThis && searchTerm.trim() && matchCount === 0);
  const inventSummaryText = onInventThis && inventSummary && searchTerm.trim() ? inventSummary(searchTerm) : '';
  const inventButton = onInventThis ? (
    <div className="inline-flex flex-col items-start">
      <button type="button" onClick={() => onInventThis(searchTerm.trim())} data-testid="cocktail-invent-this"
        className={`px-4 min-h-[44px] text-[17px] inline-flex items-center gap-1 ${FOCUS}`}
        style={{ fontFamily: TEXT, border: `1px solid ${CHALK_RAIL}`, borderRadius: 8, color: CHALK_CREAM }}>
        <Shaker size={20} />
        Invent this
      </button>
      {inventSummaryText && (
        <span className="text-[13px] mt-0.5" data-testid="cocktail-invent-this-summary" style={{ color: CHALK_SUB }}>{inventSummaryText}</span>
      )}
    </div>
  ) : null;

  // Cocktails per base spirit — drives the bottle-shelf counts.
  const spiritCounts = useMemo(() => {
    const counts = {};
    if (annotated) for (const a of annotated.values()) {
      counts[a.spirit] = (counts[a.spirit] || 0) + 1;
    }
    return counts;
  }, [annotated]);

  // Family list to render — either all 6 or just the selected one.
  const familiesToRender = useMemo(() => {
    if (!graph) return [];
    if (filterFamily == null) return graph.families;
    return graph.families.filter((f) => f.id === filterFamily);
  }, [graph, filterFamily]);

  if (!graph || !annotated) {
    return (
      <div className="flex items-center justify-center w-full h-full pt-10" style={{ background: CHALK_BG }}>
        <p className="text-base" style={{ fontFamily: TEXT, color: CHALK_SUB }}>Chalking up the menu…</p>
      </div>
    );
  }

  // The cook's own drinks: a "Yours" group first, and again inside their family
  // (or an "Uncategorised" section when no family fits), each marked "yours".
  const familyOf = (c) => graph.families.find((f) => f.id === c.family_id) || UNCATEGORISED;
  const yoursShown = (graph.mine || []).filter((c) => (filterFamily == null || c.family_id === filterFamily) && applyFilters([c]).length > 0);
  const uncategorised = filterFamily == null ? (graph.mine || []).filter((c) => c.family_id == null) : [];
  const sections = [
    ...familiesToRender.map((fam) => {
      const members = graph.byFamily.get(fam.id) || [];
      return { fam, members, filtered: applyFilters(members) };
    }),
    ...(uncategorised.length ? [{ fam: UNCATEGORISED, members: uncategorised, filtered: applyFilters(uncategorised) }] : []),
  ];
  const renderRow = (c, fam, famGlassType) => {
    const a = annotated.get(c.name);
    const isSelected = selectedCocktail === c.name;
    return (
      <button
        type="button"
        onClick={() => onSelectCocktail(c.name)}
        data-testid="cocktail-row"
        data-yours={c.mine ? 'true' : undefined}
        aria-current={isSelected ? 'true' : undefined}
        className={`w-full flex items-center gap-2 py-1 text-left ${FOCUS}`}
        style={{ minHeight: 44, background: 'transparent' }}
      >
        {c.mine && c.picture ? (
          <PictureView picture={c.picture} itemId={c.savedId} size={40} testid="yours-row-picture" />
        ) : (
          <svg width="15" height="22" viewBox="0 20 52 88" aria-hidden="true" className="flex-shrink-0">
            {glassMark(famGlassType, 26, fam.color, fam.color, true)}
          </svg>
        )}
        <span className="flex-1 min-w-0">
          <span className="block truncate text-[20px]" style={{ fontFamily: TEXT, color: isSelected ? ACCENT : popColor(fam.color) }}>{c.name}</span>
          {searchHits?.get(c.name)?.length > 0 && (
            <span className="block truncate text-[11px]" style={{ color: CHALK_DIM }} data-search-hit>
              with {searchHits.get(c.name).join(', ')}
            </span>
          )}
        </span>
        {c.mine && (
          <span className="text-[12px]" data-testid="yours-tag" style={{ fontFamily: TEXT, color: CHALK_SUB }}>Yours</span>
        )}
        {a?.iba_official && (
          <span className="text-[12px]" title="IBA official cocktail" aria-label="IBA official cocktail" style={{ fontFamily: TEXT, color: CHALK_SUB }}>IBA</span>
        )}
        {a?.spirit && a.spirit !== 'other' && (
          <span className="text-[12px] capitalize" style={{ fontFamily: TEXT, color: CHALK_SUB }}>{a.spirit}</span>
        )}
      </button>
    );
  };

  return (
    <div
      className="absolute inset-x-0 top-0 overflow-y-auto" // v1.0.3: top-10 reserved a top nav that is hidden — 40px blank band
      // v1.0.2/3: bottom stops above the fixed tab bar (inset-0 hid the last ~57px).
      style={{
        bottom: 'var(--tab-bar-h)',
        paddingTop: 'env(safe-area-inset-top, 0px)',
        ...chalkSurfaceStyle(),
        color: CHALK_CREAM,
      }}
      data-browse-root
    >
      {/* ───── Board header — the bistro "specials board" title ───── */}
      <div className="px-4 pt-5 pb-2 max-w-4xl mx-auto text-center">
        <h1
          className="inline-block text-5xl sm:text-6xl pb-1.5"
          style={{ fontFamily: HAND, color: CHALK_CREAM, textShadow: CHALK_SHADOW, borderBottom: `2px solid ${CHALK_DIM}88` }}
        >
          Cocktail Menu
        </h1>
      </div>

      {/* ───── Back-bar shelf — one chalk bottle per family ───── */}
      <div className="px-4 pt-1 pb-2 max-w-4xl mx-auto">
        <div className="text-[22px] mb-1" style={{ fontFamily: HAND, color: CHALK_CREAM, textShadow: CHALK_SHADOW }}>Families</div>
        <div className="pb-1">
        <svg
          viewBox={`0 -48 ${graph.families.length * 120} 170`}
          preserveAspectRatio="xMidYMid meet"
          style={{ width: '100%', maxWidth: Math.round(graph.families.length * 120 * 200 / 240), height: 'auto', display: 'block', margin: '0 auto' }}
          role="img"
          aria-label="Cocktail families — back-bar shelf"
        >
          <title>Cocktail families</title>
          {/* the shelf */}
          <line x1="6" y1="104" x2={graph.families.length * 120 - 6} y2="104" stroke={`${CHALK_DIM}cc`} strokeWidth="3.5" strokeLinecap="round" />
          <line x1="6" y1="108.5" x2={graph.families.length * 120 - 6} y2="108.5" stroke={`${CHALK_RAIL}99`} strokeWidth="2" strokeLinecap="round" />
          {graph.families.map((fam, i) => {
            const cx = 60 + i * 120;
            const count = (graph.byFamily.get(fam.id) || []).length;
            const active = filterFamily === fam.id;
            const dim = filterFamily != null && !active;
            const stroke = active ? CHALK_CREAM : fam.color;
            return (
              <g
                key={fam.id}
                onClick={() => onFilterFamily(active ? null : fam.id)}
                style={{ cursor: 'pointer', opacity: dim ? 0.4 : 1, transition: 'opacity .15s' }}
                role="button"
                aria-label={`${fam.name}, ${count} cocktails`}
              >
                {/* full-slot invisible hit area so the whole glass is tappable
                    (chalk outlines alone are thin + hard to hit) */}
                <rect x={cx - 59} y="-48" width="118" height="222" fill="transparent" />
                {/* the family's signature glass, scaled up about the shelf base */}
                <g transform={`translate(${cx} 104) scale(1.85) translate(${-cx} -104)`} pointerEvents="none">
                  {glassMark(glassTypeFor(fam.name), cx, fam.color, stroke, active)}
                </g>
              </g>
            );
          })}
        </svg>
        {/* v1.0.4: family names + counts as fixed-size HTML "shelf tags". Inside the
            scaled SVG they rendered at ~8px on phones; here they stay 14–18px at any
            width, hang at alternating slants like chalk price tags, and are tappable. */}
        <div
          className="grid mx-auto mt-1"
          style={{ gridTemplateColumns: `repeat(${graph.families.length}, minmax(0, 1fr))`, width: '100%', maxWidth: Math.round(graph.families.length * 120 * 200 / 240) }}
        >
          {graph.families.map((fam, i) => {
            const active = filterFamily === fam.id;
            const dim = filterFamily != null && !active;
            const count = (graph.byFamily.get(fam.id) || []).length;
            const ink = active ? CHALK_CREAM : popColor(fam.color);
            return (
              <button
                key={fam.id}
                type="button"
                onClick={() => onFilterFamily(active ? null : fam.id)}
                aria-label={`${fam.name}, ${count} cocktails`}
                aria-pressed={active}
                className="flex flex-col items-center px-0.5 pt-1 pb-1 min-w-0"
                style={{ opacity: dim ? 0.4 : 1, transition: 'opacity .15s' }}
              >
                <span
                  className="text-[13px] sm:text-[18px] leading-[1.05] text-center px-1 py-0.5 rounded-sm max-w-full min-h-[2.4em] flex items-center justify-center"
                  style={{ fontFamily: TEXT, color: ink, border: `1px dashed ${ink}99`, background: `${fam.color}1a`, transform: `rotate(${i % 2 ? 5 : -5}deg)`, textShadow: CHALK_SHADOW, boxShadow: `0 0 8px ${fam.color}33` }}
                >
                  {fam.name}
                </span>
                <span className="text-[11px] sm:text-[13px] mt-1.5" style={{ fontFamily: TEXT, color: CHALK_DIM }}>{count} drinks</span>
              </button>
            );
          })}
        </div>
        </div>
        {filterFamily != null && (
          <div className="text-center -mt-1">
            <button
              type="button"
              onClick={() => onFilterFamily(null)}
              className="text-sm underline underline-offset-2"
              style={{ fontFamily: TEXT, color: CHALK_DIM }}
            >
              Show all families
            </button>
          </div>
        )}
      </div>

      {/* ───── Back-bar bottle shelf — one chalk bottle per base spirit ───── */}
      <div className="px-4 pt-1 pb-2 max-w-4xl mx-auto">
        <div className="flex items-baseline justify-between mb-1">
          <div className="text-[22px]" style={{ fontFamily: HAND, color: CHALK_CREAM, textShadow: CHALK_SHADOW }}>Spirits</div>
        </div>
        <div className="pb-1 overflow-x-auto chip-row -mx-4 px-4">
        <div style={{ minWidth: SPIRIT_SHELF.length * 76 }}>
        <svg
          viewBox={`0 -66 ${SPIRIT_SHELF.length * 122} 180`}
          preserveAspectRatio="xMidYMid meet"
          style={{ width: '100%', maxWidth: Math.round(SPIRIT_SHELF.length * 122 * 190 / 204), height: 'auto', display: 'block', margin: '0 auto' }}
          role="img"
          aria-label="Base spirits — back-bar bottle shelf"
        >
          <title>Base spirits</title>
          {/* the shelf */}
          <line x1="6" y1="104" x2={SPIRIT_SHELF.length * 122 - 6} y2="104" stroke={`${CHALK_DIM}cc`} strokeWidth="3.5" strokeLinecap="round" />
          <line x1="6" y1="108.5" x2={SPIRIT_SHELF.length * 122 - 6} y2="108.5" stroke={`${CHALK_RAIL}99`} strokeWidth="2" strokeLinecap="round" />
          {SPIRIT_SHELF.map((s, i) => {
            const cx = 61 + i * 122;
            const count = spiritCounts[s.key] || 0;
            const active = filterSpirit === s.key;
            const dim = filterSpirit != null && !active;
            const color = COCKTAIL_SPIRIT_COLORS[s.key] || CHALK_DIM;
            const stroke = active ? CHALK_CREAM : color;
            return (
              <g
                key={s.key}
                onClick={() => onFilterSpirit(active ? null : s.key)}
                style={{ cursor: 'pointer', opacity: dim ? 0.4 : 1, transition: 'opacity .15s' }}
                role="button"
                aria-label={`${s.label}, ${count} cocktails`}
              >
                {/* full-slot invisible hit area — chalk outlines alone are hard to hit */}
                <rect x={cx - 60} y="-66" width="120" height="192" fill="transparent" />
                {/* per-bottle scale: everything bumped up except gin (held smaller) */}
                <ChalkBottle
                  spirit={s.key} label={s.label} color={color} stroke={stroke} active={active}
                  scale={1.85} x={cx} y={104} pointerEvents="none"
                />
              </g>
            );
          })}
        </svg>
        {/* v1.0.4: spirit tags as HTML (see the family tags above). Nine bottles
            cannot fit a phone at a readable size, so this shelf swipes sideways
            at a fixed minimum width instead of shrinking. */}
        <div
          className="grid mx-auto mt-1"
          style={{ gridTemplateColumns: `repeat(${SPIRIT_SHELF.length}, minmax(0, 1fr))`, width: '100%', maxWidth: Math.round(SPIRIT_SHELF.length * 122 * 190 / 204) }}
        >
          {SPIRIT_SHELF.map((sp, i) => {
            const active = filterSpirit === sp.key;
            const dim = filterSpirit != null && !active;
            const count = spiritCounts[sp.key] || 0;
            const base = COCKTAIL_SPIRIT_COLORS[sp.key] || CHALK_DIM;
            const ink = active ? CHALK_CREAM : popColor(base);
            return (
              <button
                key={sp.key}
                type="button"
                onClick={() => onFilterSpirit(active ? null : sp.key)}
                aria-label={`${sp.label}, ${count} cocktails`}
                aria-pressed={active}
                className="flex flex-col items-center px-0.5 pt-1 pb-1 min-w-0"
                style={{ opacity: dim ? 0.4 : 1, transition: 'opacity .15s' }}
              >
                <span
                  className="text-[14px] sm:text-[17px] leading-[1.05] text-center px-1.5 py-0.5 rounded-sm max-w-full min-h-[1.6em] flex items-center justify-center"
                  style={{ fontFamily: TEXT, color: ink, border: `1px dashed ${ink}99`, background: `${base}1a`, transform: `rotate(${i % 2 ? 5 : -5}deg)`, textShadow: CHALK_SHADOW, boxShadow: `0 0 8px ${base}33` }}
                >
                  {sp.label}
                </span>
                <span className="text-[11px] sm:text-[13px] mt-1.5" style={{ fontFamily: TEXT, color: CHALK_DIM }}>{count} drinks</span>
              </button>
            );
          })}
        </div>
        </div>
        </div>
        {filterSpirit != null && (
          <div className="text-center -mt-1">
            <button
              type="button"
              onClick={() => onFilterSpirit(null)}
              className="text-sm underline underline-offset-2"
              style={{ fontFamily: TEXT, color: CHALK_DIM }}
            >
              Show all spirits
            </button>
          </div>
        )}
      </div>

      {/* ───── Filter bar — IBA toggle + search (spirits live on the shelf) ───── */}
      <div
        className="sticky top-0 z-30 backdrop-blur-md px-4 py-2.5 max-w-4xl mx-auto"
        style={{ background: '#0a0a0aE6', borderBottom: `1px solid ${CHALK_RAIL}66` }}
      >
        <div className="flex flex-wrap items-center gap-2">
          <label className="flex items-center gap-1.5 text-[13px] cursor-pointer" style={{ color: CHALK_DIM }}>
            <input
              type="checkbox"
              checked={ibaOnly}
              onChange={(e) => setIbaOnly(e.target.checked)}
              style={{ accentColor: CHALK_CREAM }}
            />
            IBA only
          </label>
          {makeableNames != null && (
            <button
              type="button"
              role="switch"
              aria-checked={barOnly}
              onClick={() => setBarOnly(!barOnly)}
              data-testid="cocktail-bar-only"
              className={`inline-flex items-center gap-2 px-2 min-h-[44px] ${FOCUS}`}
              style={{ fontFamily: TEXT, fontSize: 16, border: `1px solid ${barOnly ? CHALK_CREAM : CHALK_RAIL}`, borderRadius: 8, color: CHALK_CREAM }}
            >
              {/* the pill: a track with a sliding knob */}
              <span aria-hidden="true" className="relative inline-block rounded-full transition-colors"
                style={{ width: 34, height: 20, background: barOnly ? CHALK_CREAM : 'rgba(255,255,255,0.12)', border: `1px solid ${barOnly ? CHALK_CREAM : CHALK_RAIL}` }}>
                <span className="absolute top-[2px] rounded-full transition-all"
                  style={{ width: 14, height: 14, left: barOnly ? 17 : 2, background: barOnly ? '#0a0a0a' : CHALK_CREAM }} />
              </span>
              Only what I have
              <span className="text-[13px]" style={{ fontFamily: TEXT, color: CHALK_DIM }}>({makeableNames.size})</span>
            </button>
          )}
          {filterSpirit != null && (
            <span className="text-[15px] inline-flex items-center gap-1.5" style={{ fontFamily: TEXT, color: COCKTAIL_SPIRIT_COLORS[filterSpirit] || CHALK_CREAM }}>
              <span className="inline-block rounded-full" style={{ width: 8, height: 8, background: COCKTAIL_SPIRIT_COLORS[filterSpirit] || CHALK_CREAM }} aria-hidden="true" />
              {SPIRIT_SHELF.find((s) => s.key === filterSpirit)?.label}
              <button type="button" onClick={() => onFilterSpirit(null)} aria-label="Clear spirit filter" className="inline-flex items-center" style={{ color: CHALK_SUB }}><Close size={16} /></button>
            </span>
          )}
          <span className="relative ml-auto flex-1 min-w-[12rem] sm:max-w-sm inline-flex items-center">
          <span aria-hidden="true" className="absolute left-2 pointer-events-none" style={{ color: CHALK_SUB, lineHeight: 0 }}><Search size={20} /></span>
          <input
            type="search"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search a drink, or ingredients like gin, lime"
            aria-label="Search cocktails by name or ingredient"
            list="cocktail-ingredient-vocab"
            data-cocktail-search
            className="w-full pr-2.5 py-1 min-h-[44px] text-[16px]"
            style={{ paddingLeft: 32, borderRadius: 8, fontFamily: TEXT, background: 'rgba(255,255,255,0.05)', border: `1px solid ${CHALK_RAIL}`, color: CHALK_CREAM }}
          />
          </span>
          <datalist id="cocktail-ingredient-vocab">
            {ingredientVocab.map((v) => <option key={v} value={v} />)}
          </datalist>
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <button type="button" onClick={() => setFiltersOpen((o) => !o)} data-testid="cocktail-filters-toggle"
            aria-expanded={filtersOpen} aria-controls="cocktail-facet-rail"
            className={`flex items-center gap-1.5 ${FOCUS}`}
            style={textAction({ fontSize: 17, textDecoration: 'none' })}>
            <Filters size={20} />
            Filters
            {activeFacetCount > 0 && (
              <span className="text-[15px]" style={{ fontFamily: TEXT, color: CHALK_DIM }}>{activeFacetCount}</span>
            )}
            <span aria-hidden="true" style={{ color: CHALK_SUB, lineHeight: 0 }}>{filtersOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}</span>
          </button>
          {onOpenMyBar && (
            <button type="button" onClick={onOpenMyBar} data-testid="cocktail-my-bar-open"
              className={FOCUS}
              style={textAction({ fontSize: 17, textDecoration: 'none' })}>
              My bar{barCount ? ` (${barCount})` : ''}
            </button>
          )}
          {onOpenInvent && (
            <button type="button" onClick={onOpenInvent} data-testid="cocktail-invent-open"
              data-primary="true" className={`px-5 inline-flex items-center gap-2 ${FOCUS}`}
              style={primaryBtn({ fontSize: 17 })}>
              <Shaker size={20} />
              Invent a cocktail
            </button>
          )}
          {barFilterOn && makeableNames.size === 0 && (
            <p className="w-full text-[14px]" role="status" data-testid="cocktail-bar-only-empty" style={{ fontFamily: TEXT, color: CHALK_DIM }}>
              Nothing complete from your bar yet.{' '}
              {onOpenMyBar && <button type="button" onClick={onOpenMyBar} className="underline underline-offset-2" style={{ color: CHALK_CREAM }}>Add bottles in My bar</button>}
            </p>
          )}
          {!filtersOpen && activeFacetCount > 0 && (
            <button type="button" onClick={() => setFacetFilter({})} className="text-[13px] underline underline-offset-2" style={{ color: CHALK_DIM }}>
              Clear filters ({matchCount} shown)
            </button>
          )}
        </div>
        {searchHits && (
          <p className="mt-1 text-[13px]" style={{ color: CHALK_SUB }} aria-live="polite">
            {matchCount} cocktail{matchCount === 1 ? '' : 's'} match “{searchTerm.trim()}”
          </p>
        )}
        {searchHits && onInventThis && searchTerm.trim() && matchCount > 0 && (
          <div className="mt-1.5">
            {inventButton}
          </div>
        )}

        {/* ───── Facet rail — occasion / season / strength / character / effort / glass ───── */}
        {filtersOpen && (
        <div className="mt-2 flex flex-col gap-1.5" id="cocktail-facet-rail" data-testid="cocktail-facet-rail">
          {FACET_GROUPS.map((g) => (
            <div key={g.key} className="flex items-center gap-1.5 overflow-x-auto chip-row" role="group" aria-label={`Filter by ${g.label.toLowerCase()}`}>
              <span className="text-[13px] flex-shrink-0 w-[4.5rem]" style={{ fontFamily: TEXT, color: CHALK_SUB }}>{g.label}</span>
              {g.values.map((v) => {
                const active = facetFilter[g.key] === v;
                const count = chipCounts.get(`${g.key}:${v}`);
                const dead = count === 0 && !active;
                return (
                  <button
                    key={v}
                    type="button"
                    aria-pressed={active}
                    disabled={dead}
                    onClick={() => setFacetFilter((f) => ({ ...f, [g.key]: active ? null : v }))}
                    className={`px-3 min-h-[44px] text-[15px] whitespace-nowrap flex-shrink-0 ${FOCUS}`}
                    style={{
                      fontFamily: TEXT,
                      color: dead ? `${CHALK_SUB}99` : CHALK_CREAM,
                      background: 'transparent',
                      border: `${active ? '1.5px' : '1px'} solid ${active ? ACCENT : `${CHALK_RAIL}99`}`,
                      borderRadius: 8,
                      opacity: dead ? 0.5 : 1,
                    }}
                  >
                    {v}{typeof count === 'number' && !active ? ` ${count}` : ''}
                  </button>
                );
              })}
            </div>
          ))}
          <div className="flex items-center gap-3 text-[13px]" style={{ color: CHALK_DIM }}>
            <label className="flex items-center gap-1.5 cursor-pointer">
              <input type="checkbox" checked={!!facetFilter.noEgg} onChange={(e) => setFacetFilter((f) => ({ ...f, noEgg: e.target.checked }))} style={{ accentColor: CHALK_CREAM }} />
              No egg
            </label>
            <label className="flex items-center gap-1.5 cursor-pointer">
              <input type="checkbox" checked={!!facetFilter.noDairy} onChange={(e) => setFacetFilter((f) => ({ ...f, noDairy: e.target.checked }))} style={{ accentColor: CHALK_CREAM }} />
              No dairy
            </label>
            {activeFacetCount > 0 && (
              <button type="button" onClick={() => setFacetFilter({})} className="underline underline-offset-2" style={{ color: CHALK_DIM }}>
                Clear filters ({matchCount} shown)
              </button>
            )}
          </div>
        </div>
        )}
      </div>

      {/* ───── Menu sections — colored-chalk family headers ───── */}
      <div className="px-4 py-4 max-w-4xl mx-auto pb-24">
        {inventEmpty && (
          <div className="text-center py-6" data-testid="cocktail-invent-empty" style={{ fontFamily: TEXT, color: CHALK_CREAM }}>
            <p className="text-[20px] mb-3">No cocktail has {parseQuery(searchTerm).join(' + ')} — invent one?</p>
            {inventButton}
            <p className="mt-3 text-[15px]" style={{ color: CHALK_SUB }}>
              <button type="button" data-testid="cocktail-invent-empty-clear"
                onClick={() => { onFilterFamily(null); onFilterSpirit(null); setSearchTerm(''); setIbaOnly(false); setFacetFilter({}); }}
                className="underline underline-offset-2" style={{ color: CHALK_DIM }}>
                Clear search and filters
              </button>
            </p>
          </div>
        )}
        {yoursShown.length > 0 && (
          <section className="mb-10" data-testid="cocktail-yours-group" aria-label="Yours">
            <header className="flex items-baseline gap-2.5 mb-2 pb-2" style={{ borderBottom: `1px solid ${CHALK_RAIL}` }}>
              <h2 className="text-[36px] leading-none" style={{ fontFamily: HAND, color: CHALK_CREAM, textShadow: CHALK_SHADOW }}>Yours</h2>
              <span className="text-[13px]" style={{ fontFamily: TEXT, color: CHALK_SUB }}>{yoursShown.length} drinks</span>
            </header>
            <ul className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1 ml-5">
              {yoursShown.map((c, idx) => {
                const fam = familyOf(c);
                return (
                  <li key={`yours-${c.savedId || c.name}-${idx}`}>
                    {renderRow(c, fam, glassTypeFor(fam.name))}
                  </li>
                );
              })}
            </ul>
          </section>
        )}
        {sections.map(({ fam, members, filtered }) => {
          if (filtered.length === 0) return null;
          const famGlassType = glassTypeFor(fam.name);

          // Group by subcluster_id, preserving original order; the cook's own drinks sit in a "Yours" subgroup.
          const bySub = new Map();
          const mineHere = [];
          for (const m of filtered) {
            if (m.mine) { mineHere.push(m); continue; }
            const sid = m.subcluster_id || 'misc';
            if (!bySub.has(sid)) bySub.set(sid, []);
            bySub.get(sid).push(m);
          }
          const subIds = [...bySub.keys()].sort();
          const groups = [
            ...subIds.map((sid) => ({ sid, members: bySub.get(sid), yours: false })),
            ...(mineHere.length ? [{ sid: 'yours', members: mineHere, yours: true }] : []),
          ];

          return (
            <section key={fam.id ?? 'uncategorised'} className="mb-10" data-testid={fam.id == null ? 'cocktail-uncategorised-group' : undefined}>
              <header className="flex items-center gap-2.5 mb-2 pb-2" style={{ borderBottom: `1px solid ${CHALK_RAIL}` }}>
                <svg width="38" height="58" viewBox="0 16 52 92" aria-hidden="true" style={{ flexShrink: 0 }}>
                  {glassMark(famGlassType, 26, fam.color, fam.color, true)}
                </svg>
                <h2 className="text-[36px] leading-none" style={{ fontFamily: HAND, color: fam.color, textShadow: CHALK_SHADOW }}>{fam.name}</h2>
                <span className="text-[13px]" style={{ fontFamily: TEXT, color: CHALK_SUB }}>{filtered.length} of {members.length} drinks</span>
              </header>

              {groups.map(({ sid, members: subMembers, yours }) => {
                const derived = deriveSubclusterLabel(subMembers);
                const subName = yours ? 'Yours' : subclusterName(sid, null);
                const subLabel = subName || (derived ? `${derived}-style` : null);
                const kind = yours ? 'glass' : subgroupKind(`${subLabel || ''} ${subMembers.map((m) => m.name).join(' ')}`);
                return (
                  <div
                    key={sid}
                    className="mb-6 ml-5"
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <SubgroupGlyph kind={kind} color={CHALK_DIM} />
                      <span className="text-[24px] leading-tight" style={{ fontFamily: HAND, color: CHALK_CREAM, textShadow: CHALK_SHADOW }}>
                        {subLabel || `More ${fam.name}`}
                      </span>
                      <span className="text-[13px]" style={{ fontFamily: TEXT, color: CHALK_SUB }}>{subMembers.length} drinks</span>
                    </div>
                    <ul className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1">
                      {subMembers.map((c, idx) => (
                        <li key={`${c.canonical || c.name}-${idx}`}>
                          {renderRow(c, fam, famGlassType)}
                        </li>
                      ))}
                    </ul>
                  </div>
                );
              })}
            </section>
          );
        })}
        {!inventEmpty && yoursShown.length === 0 && sections.every((x) => x.filtered.length === 0) && (
          <div className="text-center text-base py-12" style={{ fontFamily: TEXT, color: CHALK_SUB }}>
            No cocktails match these filters.{' '}
            <button
              type="button"
              onClick={() => { onFilterFamily(null); onFilterSpirit(null); setSearchTerm(''); setIbaOnly(false); setFacetFilter({}); }}
              className="underline underline-offset-2"
              style={{ color: CHALK_DIM }}
            >
              Reset all
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

/** Stable export of the same legend the 3D scene uses, so the
 *  ShapeLegend overlay can stay shared. */
export { COCKTAIL_SPIRIT_LEGEND };
