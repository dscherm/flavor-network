import { useMemo, useState } from 'react';
import { cocktailBaseSpirit, COCKTAIL_SPIRIT_LEGEND } from '../data/cocktailBaseSpirit.js';

// ── Bistro-chalkboard palette (shared kitchen-world DNA, matches
//    RecipeFlavorProfilesCard). The 2D cocktail list IS a bar menu, so it's
//    drawn as colored chalk on slate. Caveat carries names/headings; small
//    data (counts, IBA, spirit) stays in a legible sans for readability.
const FONT = 'Caveat, cursive';
const CHALK_BG = 'radial-gradient(ellipse at center, #1c1c1c 0%, #0a0a0a 75%, #050505 100%), #0a0a0a';
const CHALK_CREAM = '#f5efde';
const CHALK_DIM = '#bdb6a3';
const CHALK_SUB = '#8a8478';
const CHALK_RAIL = '#4a4a4a';
const CHALK_SHADOW = '0 0 1px rgba(245,239,222,0.5), 0 0 3px rgba(245,239,222,0.2)';

/**
 * CocktailBrowse — 2D selection surface for the Cocktail Lab. Sits as
 * an alternative to the 3D NetworkScene (toggled at the lab header).
 *
 * Three regions, top to bottom:
 *   1. Mini-map — six family bubbles, sized by cocktail count, click
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

// 2x3 mini-map layout: column x positions and row y positions in
// viewBox coords. Bubble radius is sqrt(count)-scaled so the visual
// area roughly tracks the family size.
const MAP_VIEWBOX = '0 0 720 220';
const COL_X = [140, 360, 580];
const ROW_Y = [70, 168];
const FAMILY_GRID = [
  { idx: 0, col: 0, row: 0 }, // top-left
  { idx: 1, col: 1, row: 0 },
  { idx: 2, col: 2, row: 0 }, // biggest cluster, top-right
  { idx: 3, col: 0, row: 1 },
  { idx: 4, col: 1, row: 1 },
  { idx: 5, col: 2, row: 1 },
];
const BUBBLE_R_BASE = 14;
const BUBBLE_R_SCALE = 2.4;

function bubbleRadius(count) {
  return BUBBLE_R_BASE + Math.sqrt(count) * BUBBLE_R_SCALE;
}

/**
 * Pretty-print a family short-name that fits inside the bubble. The
 * full names from the data are sometimes long ("Highballs & Fizzes"),
 * so we strip ampersand-tails for the in-bubble label and show the
 * full name underneath.
 */
function bubbleShortName(name) {
  if (!name) return '';
  if (name.length <= 14) return name;
  // Drop everything after " & " or " · " for the inside-bubble label
  const cut = name.split(/ & | · /)[0];
  return cut.length <= 14 ? cut : cut.slice(0, 12) + '…';
}

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

const SPIRIT_CHIPS = [
  { key: null,        label: 'All Spirits' },
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
}) {
  const [searchTerm, setSearchTerm] = useState('');
  const [ibaOnly, setIbaOnly] = useState(false);

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
    return map;
  }, [graph]);

  // Apply the spirit/IBA/search filters to a member list.
  const applyFilters = (members) => {
    const term = searchTerm.trim().toLowerCase();
    return members.filter((m) => {
      const a = annotated.get(m.name);
      if (!a) return false;
      if (filterSpirit && a.spirit !== filterSpirit) return false;
      if (ibaOnly && !a.iba_official) return false;
      if (term && !a.name.toLowerCase().includes(term)) return false;
      return true;
    });
  };

  // Family list to render — either all 6 or just the selected one.
  const familiesToRender = useMemo(() => {
    if (!graph) return [];
    if (filterFamily == null) return graph.families;
    return graph.families.filter((f) => f.id === filterFamily);
  }, [graph, filterFamily]);

  if (!graph || !annotated) {
    return (
      <div className="flex items-center justify-center w-full h-full pt-10" style={{ background: CHALK_BG }}>
        <p className="text-base" style={{ fontFamily: FONT, color: CHALK_SUB }}>Chalking up the menu…</p>
      </div>
    );
  }

  return (
    <div
      className="absolute inset-0 top-10 overflow-y-auto"
      style={{ background: CHALK_BG, color: CHALK_CREAM, boxShadow: `inset 0 0 0 2px ${CHALK_RAIL}55, inset 0 0 0 4px #00000080` }}
      data-browse-root
    >
      {/* ───── Board header — the bistro "specials board" title ───── */}
      <div className="px-4 pt-5 pb-2 max-w-4xl mx-auto text-center">
        <h1
          className="inline-block text-4xl pb-1"
          style={{ fontFamily: FONT, color: CHALK_CREAM, textShadow: CHALK_SHADOW, borderBottom: `2px solid ${CHALK_DIM}88` }}
        >
          Cocktail Menu
        </h1>
        <p className="text-base mt-1.5" style={{ fontFamily: FONT, color: CHALK_SUB }}>
          Tap a family to filter · tap a drink for the recipe
        </p>
      </div>

      {/* ───── Family map — chalk-drawn bubbles ───── */}
      <div className="px-4 pt-1 pb-2 max-w-4xl mx-auto">
        <svg viewBox={MAP_VIEWBOX} className="w-full h-auto" role="img" aria-label="Cocktail family map">
          <title>Cocktail family map</title>
          {FAMILY_GRID.map(({ idx, col, row }) => {
            const fam = graph.families[idx];
            if (!fam) return null;
            const cx = COL_X[col];
            const cy = ROW_Y[row];
            const count = (graph.byFamily.get(fam.id) || []).length;
            const r = bubbleRadius(count);
            const isActive = filterFamily === fam.id;
            return (
              <g
                key={fam.id}
                onClick={() => onFilterFamily(isActive ? null : fam.id)}
                style={{ cursor: 'pointer' }}
              >
                <circle
                  cx={cx}
                  cy={cy}
                  r={r}
                  fill={fam.color}
                  fillOpacity={filterFamily == null || isActive ? 0.55 : 0.18}
                  stroke={isActive ? CHALK_CREAM : `${fam.color}`}
                  strokeOpacity={isActive ? 0.95 : 0.6}
                  strokeWidth={isActive ? 3 : 1.6}
                  strokeDasharray={isActive ? '0' : '5 3'}
                />
                <text
                  x={cx}
                  y={cy - 1}
                  textAnchor="middle"
                  fontSize="16"
                  fontFamily="Caveat, cursive"
                  fill={CHALK_CREAM}
                  pointerEvents="none"
                >
                  {bubbleShortName(fam.name)}
                </text>
                <text
                  x={cx}
                  y={cy + 16}
                  textAnchor="middle"
                  fontSize="12"
                  fill={CHALK_CREAM}
                  fillOpacity="0.7"
                  pointerEvents="none"
                >
                  {count}
                </text>
              </g>
            );
          })}
        </svg>
        {filterFamily != null && (
          <div className="text-center -mt-1">
            <button
              type="button"
              onClick={() => onFilterFamily(null)}
              className="text-sm underline underline-offset-2"
              style={{ fontFamily: FONT, color: CHALK_DIM }}
            >
              Show all families
            </button>
          </div>
        )}
      </div>

      {/* ───── Filter bar — chalk-outline chips ───── */}
      <div
        className="sticky top-0 z-30 backdrop-blur-md px-4 py-2.5 max-w-4xl mx-auto"
        style={{ background: '#0a0a0aE6', borderBottom: `1px solid ${CHALK_RAIL}66` }}
      >
        <div className="flex flex-wrap items-center gap-1.5">
          {SPIRIT_CHIPS.map((chip) => {
            const active = filterSpirit === chip.key;
            return (
              <button
                key={String(chip.key)}
                type="button"
                onClick={() => onFilterSpirit(active ? null : chip.key)}
                className="px-3 py-1 rounded-full text-[15px] border transition-colors"
                style={{
                  fontFamily: FONT,
                  color: active ? '#0a0a0a' : CHALK_DIM,
                  background: active ? CHALK_CREAM : 'rgba(255,255,255,0.04)',
                  borderColor: active ? CHALK_CREAM : `${CHALK_RAIL}`,
                  textShadow: active ? 'none' : CHALK_SHADOW,
                }}
              >
                {chip.label}
              </button>
            );
          })}
          <label className="ml-2 flex items-center gap-1.5 text-[13px] cursor-pointer" style={{ color: CHALK_DIM }}>
            <input
              type="checkbox"
              checked={ibaOnly}
              onChange={(e) => setIbaOnly(e.target.checked)}
              style={{ accentColor: CHALK_CREAM }}
            />
            IBA only
          </label>
          <input
            type="search"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search…"
            className="ml-auto px-2.5 py-1 rounded-md focus:outline-none w-32 text-[15px]"
            style={{ fontFamily: FONT, background: 'rgba(255,255,255,0.05)', border: `1px solid ${CHALK_RAIL}`, color: CHALK_CREAM }}
          />
        </div>
      </div>

      {/* ───── Menu sections — colored-chalk family headers ───── */}
      <div className="px-4 py-4 max-w-4xl mx-auto pb-24">
        {familiesToRender.map((fam) => {
          const members = graph.byFamily.get(fam.id) || [];
          const filtered = applyFilters(members);
          if (filtered.length === 0) return null;

          // Group by subcluster_id, preserving original order.
          const bySub = new Map();
          for (const m of filtered) {
            const sid = m.subcluster_id || 'misc';
            if (!bySub.has(sid)) bySub.set(sid, []);
            bySub.get(sid).push(m);
          }
          const subIds = [...bySub.keys()].sort();

          return (
            <section key={fam.id} className="mb-7">
              <header className="flex items-baseline gap-2 mb-2 pb-1" style={{ borderBottom: `1.5px solid ${fam.color}66` }}>
                <h2 className="text-2xl" style={{ fontFamily: FONT, color: fam.color, textShadow: CHALK_SHADOW }}>{fam.name}</h2>
                <span className="text-[12px]" style={{ color: CHALK_SUB }}>{filtered.length} of {members.length}</span>
              </header>

              {subIds.map((sid) => {
                const subMembers = bySub.get(sid);
                const subLabel = deriveSubclusterLabel(subMembers);
                return (
                  <div key={sid} className="mb-3">
                    <div className="text-[11px] uppercase tracking-wider mb-1" style={{ color: CHALK_SUB }}>
                      {subLabel ? `${subLabel}-style` : `Subcluster ${sid}`}
                      <span className="ml-1.5" style={{ color: `${CHALK_SUB}99` }}>· {subMembers.length}</span>
                    </div>
                    <ul className="grid grid-cols-1 sm:grid-cols-2 gap-0.5">
                      {subMembers.map((c, idx) => {
                        const a = annotated.get(c.name);
                        const isSelected = selectedCocktail === c.name;
                        return (
                          <li key={`${c.canonical || c.name}-${idx}`}>
                            <button
                              type="button"
                              onClick={() => onSelectCocktail(c.name)}
                              className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-md text-left transition-colors min-h-[36px]"
                              style={{
                                background: isSelected ? `${fam.color}22` : 'transparent',
                                border: `1px solid ${isSelected ? `${fam.color}88` : 'transparent'}`,
                              }}
                            >
                              <span
                                className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                                style={{ background: fam.color }}
                                aria-hidden="true"
                              />
                              <span className="flex-1 truncate text-[17px]" style={{ fontFamily: FONT, color: CHALK_CREAM, textShadow: CHALK_SHADOW }}>{c.name}</span>
                              {a?.iba_official && (
                                <span className="text-[9px] rounded px-1 py-px tracking-wide" style={{ color: '#fde68a', border: '1px solid rgba(252,211,77,0.35)' }}>IBA</span>
                              )}
                              {a?.spirit && a.spirit !== 'other' && (
                                <span className="text-[10px] capitalize" style={{ color: CHALK_SUB }}>{a.spirit}</span>
                              )}
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                );
              })}
            </section>
          );
        })}
        {familiesToRender.every((f) => applyFilters(graph.byFamily.get(f.id) || []).length === 0) && (
          <div className="text-center text-base py-12" style={{ fontFamily: FONT, color: CHALK_SUB }}>
            No cocktails match these filters.{' '}
            <button
              type="button"
              onClick={() => { onFilterFamily(null); onFilterSpirit(null); setSearchTerm(''); setIbaOnly(false); }}
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
