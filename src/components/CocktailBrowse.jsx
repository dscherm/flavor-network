import { useMemo, useState } from 'react';
import { cocktailBaseSpirit, COCKTAIL_SPIRIT_LEGEND } from '../data/cocktailBaseSpirit.js';

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
      <div className="flex items-center justify-center w-full h-full bg-neural-bg pt-10">
        <p className="text-neural-muted text-sm">Loading…</p>
      </div>
    );
  }

  return (
    <div className="absolute inset-0 top-10 overflow-y-auto bg-neural-bg text-neural-text" data-browse-root>
      {/* ───── Mini-map ───── */}
      <div className="px-4 pt-4 pb-2 max-w-4xl mx-auto">
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
                  fillOpacity={filterFamily == null || isActive ? 0.9 : 0.25}
                  stroke={isActive ? '#ffffff' : 'rgba(255,255,255,0.18)'}
                  strokeWidth={isActive ? 3 : 1.4}
                />
                <text
                  x={cx}
                  y={cy - 2}
                  textAnchor="middle"
                  fontSize="13"
                  fontWeight="600"
                  fill="#ffffff"
                  pointerEvents="none"
                >
                  {bubbleShortName(fam.name)}
                </text>
                <text
                  x={cx}
                  y={cy + 14}
                  textAnchor="middle"
                  fontSize="11"
                  fill="rgba(255,255,255,0.85)"
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
              className="text-[10px] text-cyan-300 hover:text-cyan-100 underline underline-offset-2"
            >
              Show all families
            </button>
          </div>
        )}
      </div>

      {/* ───── Filter bar ───── */}
      <div className="sticky top-0 z-30 bg-neural-bg/95 backdrop-blur-md border-b border-[#1e1e2e] px-4 py-2.5 max-w-4xl mx-auto">
        <div className="flex flex-wrap items-center gap-1.5">
          {SPIRIT_CHIPS.map((chip) => {
            const active = filterSpirit === chip.key;
            return (
              <button
                key={String(chip.key)}
                type="button"
                onClick={() => onFilterSpirit(active ? null : chip.key)}
                className={`px-2.5 py-1 rounded-full text-[11px] border transition-colors ${
                  active
                    ? 'bg-cyan-500/20 border-cyan-400/60 text-cyan-200'
                    : 'bg-[#12121a] border-[#2a2a3a] text-gray-400 hover:text-gray-200 hover:border-[#3a3a4a]'
                }`}
              >
                {chip.label}
              </button>
            );
          })}
          <label className="ml-2 flex items-center gap-1.5 text-[11px] text-gray-400 cursor-pointer">
            <input
              type="checkbox"
              checked={ibaOnly}
              onChange={(e) => setIbaOnly(e.target.checked)}
              className="accent-cyan-400"
            />
            IBA only
          </label>
          <input
            type="search"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search…"
            className="ml-auto px-2.5 py-1 text-[11px] bg-[#12121a] border border-[#2a2a3a] rounded-md focus:border-cyan-400/60 focus:outline-none text-gray-200 placeholder:text-gray-600 w-32"
          />
        </div>
      </div>

      {/* ───── Sectioned list ───── */}
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
            <section key={fam.id} className="mb-6">
              <header className="flex items-baseline gap-2 mb-1.5">
                <span
                  className="inline-block w-2.5 h-2.5 rounded-sm"
                  style={{ background: fam.color }}
                  aria-hidden="true"
                />
                <h2 className="text-base font-semibold text-white">{fam.name}</h2>
                <span className="text-[11px] text-gray-500">{filtered.length} of {members.length}</span>
              </header>

              {subIds.map((sid) => {
                const subMembers = bySub.get(sid);
                const subLabel = deriveSubclusterLabel(subMembers);
                return (
                  <div key={sid} className="mb-2.5">
                    <div className="text-[10px] uppercase tracking-wider text-gray-500 mb-1">
                      {subLabel ? `${subLabel}-style` : `Subcluster ${sid}`}
                      <span className="ml-1.5 text-gray-600">· {subMembers.length}</span>
                    </div>
                    <ul className="grid grid-cols-1 sm:grid-cols-2 gap-1">
                      {subMembers.map((c, idx) => {
                        const a = annotated.get(c.name);
                        const isSelected = selectedCocktail === c.name;
                        return (
                          <li key={`${c.canonical || c.name}-${idx}`}>
                            <button
                              type="button"
                              onClick={() => onSelectCocktail(c.name)}
                              className={`w-full flex items-center gap-2 px-2.5 py-1.5 rounded-md text-left text-[12px] transition-colors min-h-[32px] ${
                                isSelected
                                  ? 'bg-cyan-500/15 border border-cyan-400/40 text-white'
                                  : 'border border-transparent hover:bg-[#161622] text-gray-200'
                              }`}
                            >
                              <span
                                className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                                style={{ background: fam.color }}
                                aria-hidden="true"
                              />
                              <span className="flex-1 truncate">{c.name}</span>
                              {a?.iba_official && (
                                <span className="text-[9px] text-amber-300/80 border border-amber-400/30 rounded px-1 py-px tracking-wide">IBA</span>
                              )}
                              {a?.spirit && a.spirit !== 'other' && (
                                <span className="text-[9px] text-gray-500 capitalize">{a.spirit}</span>
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
          <div className="text-center text-sm text-gray-500 py-12">
            No cocktails match these filters.{' '}
            <button
              type="button"
              onClick={() => { onFilterFamily(null); onFilterSpirit(null); setSearchTerm(''); setIbaOnly(false); }}
              className="text-cyan-300 hover:text-cyan-100 underline underline-offset-2"
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
